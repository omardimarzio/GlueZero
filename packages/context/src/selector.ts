/**
 * Selector subscribe + reference identity preserved (MF-CTX-05, D-V2-F10-01..04).
 *
 * **Overload TS:**
 * - Sig 1: function selector `(ctx) => slice` arbitrario.
 * - Sig 2: keys array shortcut `['user', 'tenantId'] as const` → auto `Pick<...>` via
 *   `buildKeysSelector` helper.
 *
 * Discriminazione runtime via `Array.isArray(selectorOrKeys)`. Bundle: ~150 B overload.
 *
 * **Shallow gate (D-V2-F10-02):** Listener NON invocato se `shallowEqual(prevSlice, currentSlice)`.
 * Reference identity preserved cross-update — un aggiornamento `setRuntimeContext({locale: 'it'})`
 * NON triggera handler subscribers su selector `(ctx) => ctx.user` (SC1 scenario critico).
 *
 * **Cleanup:**
 * - Return fn `off(): void` rimuove subscriber dal Set.
 * - Opt `options.signal: AbortSignal` cascade auto-cleanup (D-V2-F10-04) — `signal.abort()`
 *   chiama `off()` automaticamente via `addEventListener('abort', off, { once: true })`.
 *
 * **T-F10-02 (selector throw cascade DoS mitigation):**
 * - `try/catch` separato per `selector(prev)`/`selector(current)` — su throw, skip subscriber
 *   con `continue` (no cascade crash). Test 'T-F10-02 selector throw' verifica goodHandler
 *   chiamato anche dopo bad selector.
 * - `try/catch` separato per `handler(slice, prev)` — log-only (consumer responsabilità),
 *   continue cascade ad altri subscribers.
 *
 * @see D-V2-F10-01 (selector signature overload)
 * @see D-V2-F10-02 (shallowEqual gate)
 * @see D-V2-F10-03 (P-17 cope doc-only)
 * @see D-V2-F10-04 (unsubscribe + AbortSignal cascade)
 * @see T-F10-02 (selector callback throw cascade protection)
 * @packageDocumentation
 */
import { buildKeysSelector } from './internal/keys-selector'
import { shallowEqual } from './shallow-equal'
import { getState } from './storage'
import type { RuntimeContext } from './types/runtime-context'

/**
 * Subscriber interno — selettore + handler + `lastSlice` (cached per shallow gate first
 * dispatch baseline).
 *
 * @internal
 */
interface Subscriber {
  readonly selector: (ctx: Readonly<RuntimeContext>) => unknown
  readonly handler: (slice: unknown, prev: unknown) => void
  lastSlice: unknown
}

const subscribers = new Set<Subscriber>()

/**
 * Subscribe runtime context con selector function `(ctx) => slice`.
 *
 * Sig 1 overload. Listener invocato solo quando slice differisce shallow top-level.
 *
 * @param selector Funzione `(ctx) => T` che estrae slice arbitrario dal context.
 * @param handler Listener `(slice, prev) => void` chiamato su change.
 * @param options Opt `{signal?: AbortSignal}` per cascade auto-cleanup.
 * @returns Fn `off(): void` per unsubscribe esplicito.
 *
 * @example
 * ```ts
 * const off = subscribeRuntimeContext(
 *   (ctx) => ctx.user,
 *   (user, prev) => console.log('user changed', user)
 * )
 * off()  // cleanup
 * ```
 *
 * @see MF-CTX-05, D-V2-F10-01
 */
export function subscribeRuntimeContext<T>(
  selector: (ctx: Readonly<RuntimeContext>) => T,
  handler: (slice: T, prev: T) => void,
  options?: { signal?: AbortSignal },
): () => void
/**
 * Subscribe runtime context con keys-array shortcut.
 *
 * Sig 2 overload. Equivalente a `subscribeRuntimeContext((ctx) => ({k1: ctx.k1, k2: ctx.k2}), ...)`
 * con type-narrowing automatico via `buildKeysSelector`.
 *
 * @param keys Array `readonly [...]` di chiavi `keyof RuntimeContext`. Tipicamente passato
 *   come `['user', 'tenantId'] as const`.
 * @param handler Listener `(slice: Pick<...,K>, prev: Pick<...,K>) => void`.
 * @param options Opt `{signal?: AbortSignal}` per cascade auto-cleanup.
 * @returns Fn `off(): void` per unsubscribe esplicito.
 *
 * @example
 * ```ts
 * const off = subscribeRuntimeContext(
 *   ['user', 'tenantId'] as const,
 *   (slice) => console.log(slice.user, slice.tenantId)
 * )
 * off()
 * ```
 *
 * @see MF-CTX-05, D-V2-F10-01
 */
export function subscribeRuntimeContext<K extends keyof RuntimeContext>(
  keys: ReadonlyArray<K>,
  handler: (slice: Pick<RuntimeContext, K>, prev: Pick<RuntimeContext, K>) => void,
  options?: { signal?: AbortSignal },
): () => void
/**
 * Implementation signature — discriminazione runtime via `Array.isArray`.
 */
export function subscribeRuntimeContext(
  selectorOrKeys:
    | ((ctx: Readonly<RuntimeContext>) => unknown)
    | ReadonlyArray<keyof RuntimeContext>,
  handler: (slice: unknown, prev: unknown) => void,
  options?: { signal?: AbortSignal },
): () => void {
  const selector = Array.isArray(selectorOrKeys)
    ? (buildKeysSelector(selectorOrKeys) as (ctx: Readonly<RuntimeContext>) => unknown)
    : (selectorOrKeys as (ctx: Readonly<RuntimeContext>) => unknown)
  // T-F10-02: selector throw at subscribe-time → set lastSlice = undefined, no cascade crash.
  // Il subscriber è comunque registrato; futuri dispatchSelectors catturano lo stesso throw via try/catch.
  let initialSlice: unknown
  try {
    initialSlice = selector(getState())
  } catch {
    initialSlice = undefined
  }
  const sub: Subscriber = {
    selector,
    handler,
    lastSlice: initialSlice,
  }
  subscribers.add(sub)
  const off = (): void => {
    subscribers.delete(sub)
  }
  // D-V2-F10-04 — AbortSignal cascade auto-cleanup (once: true per evitare leak listener).
  options?.signal?.addEventListener('abort', off, { once: true })
  return off
}

/**
 * Dispatch selectors on state change — chiamato da `setRuntimeContext`/`replaceRuntimeContext`/`clearRuntimeContext`.
 *
 * Per ogni subscriber:
 * 1. Calcola `prevSlice = sub.selector(previous)` e `currentSlice = sub.selector(current)` in
 *    try/catch (T-F10-02 — selector throw → skip subscriber, no cascade crash).
 * 2. Se `!shallowEqual(prevSlice, currentSlice)` → invoca `sub.handler(currentSlice, prevSlice)`
 *    in try/catch (handler throw → log-only, continue cascade).
 * 3. Update `sub.lastSlice = currentSlice`.
 *
 * @param previous State snapshot pre-mutation.
 * @param current State snapshot post-mutation.
 *
 * @see T-F10-02 mitigation
 * @see D-V2-F10-02 shallowEqual gate
 */
export function dispatchSelectors(
  previous: Readonly<RuntimeContext>,
  current: Readonly<RuntimeContext>,
): void {
  for (const sub of subscribers) {
    let prevSlice: unknown
    let currentSlice: unknown
    try {
      prevSlice = sub.selector(previous)
      currentSlice = sub.selector(current)
    } catch {
      // T-F10-02: selector throw → skip subscriber, no cascade crash.
      continue
    }
    if (!shallowEqual(prevSlice, currentSlice)) {
      try {
        sub.handler(currentSlice, prevSlice)
      } catch {
        // T-F10-02: handler throw → log-only (consumer responsabilità), continue cascade.
      }
      sub.lastSlice = currentSlice
    }
  }
}

/**
 * Test-only reset — clear tutti subscriber Set per isolation tra test.
 *
 * NON esportato dal barrel `packages/context/src/index.ts` (D-V2-F9-11 internal helpers).
 *
 * @internal
 */
export function __resetSubscribersForTest(): void {
  subscribers.clear()
}
