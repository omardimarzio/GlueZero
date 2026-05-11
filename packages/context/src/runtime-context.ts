/**
 * Public 5 API CRUD runtime context (MF-CTX-01 PRD §18.5).
 *
 * Layer orchestratore che coordina storage + events + selector:
 * 1. Mutation primitive (storage.ts setState/replaceState/clearState).
 * 2. Events fire 1 aggregator + N specific (events.ts fireContextEvents).
 * 3. Selector dispatch shallow gate (selector.ts dispatchSelectors).
 *
 * Pre-requisito: `initRuntimeContext(broker)` chiamato da `contextModule().install`
 * PRIMA di qualsiasi API call. Se brokerRef undefined → throw esplicativo
 * (`@gluezero/context: runtime context not initialized`).
 *
 * **5 API public (MF-CTX-01 PRD §18.5):**
 * - `setRuntimeContext(partial, options?)` — merge spread-copy + events.
 * - `replaceRuntimeContext(next, options?)` — sostituisce intero state + events.
 * - `getRuntimeContext()` — snapshot top-level Readonly.
 * - `subscribeRuntimeContext(...)` — re-export da selector.ts (overload TS function/keys).
 * - `clearRuntimeContext(keys?, options?)` — delete chiavi + events.
 *
 * **No-op guard:** Tutte le API mutation early-return se `changedKeys.length === 0` —
 * NO publish events, NO dispatch selectors (test 'setRuntimeContext senza changes').
 *
 * **Integration point P03 ACL:** `SetContextOptions.callerMfId` è placeholder per
 * future ACL enforcement (D-V2-F10-06) — acquisito ma NON enforced in P02.
 *
 * @see PRD §18.5 (API methods), §18.6 (events)
 * @see D-V2-F10-13 (events fire pattern 1+N sync flush)
 * @see D-V2-F10-14 (sync flush no batching)
 * @packageDocumentation
 */
import type { Broker } from '@gluezero/core'
import { fireContextEvents } from './events'
import {
  __resetSubscribersForTest,
  dispatchSelectors,
  subscribeRuntimeContext,
} from './selector'
import {
  __resetForTest as __resetStorageForTest,
  clearState,
  getState,
  replaceState,
  setState,
} from './storage'
import type { RuntimeContext } from './types/runtime-context'

/**
 * Opzioni per `set/replace/clear` API.
 *
 * **`callerMfId` (P03 integration point):**
 * - `undefined` = app shell (sempre allowed scrivere).
 * - `string` = MF facade → ACL check vs `descriptor.context.writableKeys` (D-V2-F10-06).
 *
 * In P02 questo campo è acquisito ma NON enforced (ACL si attiva in P03).
 *
 * @see D-V2-F10-06 (writableKeys ACL — P03 implementation)
 */
export interface SetContextOptions {
  readonly callerMfId?: string
}

let brokerRef: Broker | undefined

/**
 * Internal init — chiamato da `contextModule().install` per memorizzare broker reference.
 *
 * Necessario perché le 5 API public sono module-level functions (non bound a un Broker
 * instance). Pattern coerente F8 `microfrontendModule` service register +
 * F9 `mfEsmModule` LOOKUP register loader.
 *
 * @param broker Broker reference dall'install hook `ctx.broker`.
 *
 * @internal Esportato dal barrel SOLO per uso da `context-module.ts` (consumer non chiama
 *   direttamente).
 */
export function initRuntimeContext(broker: Broker): void {
  brokerRef = broker
}

/**
 * Guard interno — throw esplicativo se brokerRef undefined.
 *
 * @throws `Error` con messaggio actionable.
 * @internal
 */
function ensureBroker(): Broker {
  if (!brokerRef) {
    throw new Error(
      '@gluezero/context: runtime context not initialized. ' +
        'Add contextModule() to createBroker({ modules: [...] }) before calling runtime context API.',
    )
  }
  return brokerRef
}

/**
 * Merge partial context + emit 1 aggregator + N specific events (D-V2-F10-13).
 *
 * Storage spread-copy on update (D-V2-F10-07). NO publish + NO dispatch se `changedKeys.length === 0`.
 *
 * @param partial Partial map di chiavi `keyof RuntimeContext` → valore.
 * @param _options Opt `{callerMfId?}` (P03 placeholder).
 *
 * @example
 * ```ts
 * setRuntimeContext({ tenantId: 'acme', user: { id: 'u1' } })
 * // Pubblica: context.changed + context.tenant.changed + context.user.changed
 * ```
 *
 * @see MF-CTX-01, PRD §18.5
 */
export function setRuntimeContext(
  partial: Partial<RuntimeContext>,
  _options?: SetContextOptions,
): void {
  // P03 aggiungerà: enforceWrite(broker, _options?.callerMfId, Object.keys(partial), writableKeys)
  const broker = ensureBroker()
  const { previous, current, changedKeys } = setState(partial)
  if (changedKeys.length === 0) return
  fireContextEvents(broker, previous, current, changedKeys)
  dispatchSelectors(previous, current)
}

/**
 * Sostituisce intero state + emette events su tutte le chiavi changed (union previous+next).
 *
 * Le chiavi presenti in `previous` ma NON in `next` appaiono in `changedKeys` (rimosse).
 *
 * @param next Nuovo state completo.
 * @param _options Opt `{callerMfId?}` (P03 placeholder).
 *
 * @example
 * ```ts
 * replaceRuntimeContext({}) // cancella intero state, emette events su tutte chiavi previous
 * ```
 *
 * @see MF-CTX-01, PRD §18.5
 */
export function replaceRuntimeContext(
  next: RuntimeContext,
  _options?: SetContextOptions,
): void {
  const broker = ensureBroker()
  const { previous, current, changedKeys } = replaceState(next)
  if (changedKeys.length === 0) return
  fireContextEvents(broker, previous, current, changedKeys)
  dispatchSelectors(previous, current)
}

/**
 * Ritorna snapshot top-level corrente (Readonly).
 *
 * Consumer non-mutation responsabilità doc-only (NO freeze runtime — D-V2-F10-07).
 *
 * @returns Readonly snapshot — same reference finché un setState/replaceState/clearState
 *   con `changedKeys.length > 0` viene chiamato.
 *
 * @example
 * ```ts
 * const ctx = getRuntimeContext()
 * console.log(ctx.tenantId, ctx.user?.id)
 * ```
 *
 * @see MF-CTX-01, PRD §18.5
 */
export function getRuntimeContext(): Readonly<RuntimeContext> {
  return getState()
}

/**
 * Rimuove chiavi via `delete state[k]` (NOT assign undefined — D-V2-F10-08).
 *
 * No-args → itera 11 chiavi standard PRD §18.4 + delete ognuna.
 *
 * @param keys Chiavi da rimuovere. Default = 11 chiavi standard PRD §18.4.
 * @param _options Opt `{callerMfId?}` (P03 placeholder).
 *
 * @example
 * ```ts
 * clearRuntimeContext(['tenantId'])   // rimuove solo tenantId
 * clearRuntimeContext()                // rimuove tutte le 11 chiavi standard
 * ```
 *
 * @see MF-CTX-01, PRD §18.5
 */
export function clearRuntimeContext(
  keys?: ReadonlyArray<keyof RuntimeContext>,
  _options?: SetContextOptions,
): void {
  const broker = ensureBroker()
  const { previous, current, changedKeys } = clearState(keys)
  if (changedKeys.length === 0) return
  fireContextEvents(broker, previous, current, changedKeys)
  dispatchSelectors(previous, current)
}

/**
 * Re-export `subscribeRuntimeContext` da `selector.ts` (consumer non sa di internal split).
 */
export { subscribeRuntimeContext }

/**
 * Test-only reset — azzera brokerRef + storage + subscribers per isolation tra test.
 *
 * NON esportato dal barrel `packages/context/src/index.ts` (D-V2-F9-11 internal helpers).
 *
 * @internal
 */
export function __resetForTest(): void {
  brokerRef = undefined
  __resetStorageForTest()
  __resetSubscribersForTest()
}
