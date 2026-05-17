/**
 * Internal state container — single plain object spread-copy on update (D-V2-F10-07).
 *
 * Strategia di storage del `RuntimeContext` lockata D-V2-F10-07:
 * - `let state: RuntimeContext = {}` module-level (NON class instance — bundle size).
 * - Spread-copy `{...state, ...partial}` su ogni `setState` (immutabilità per-snapshot).
 * - `delete next[k]` (NOT `next[k] = undefined`) su `clearState` per `exactOptionalPropertyTypes`
 *   TS strict (D-V2-F10-08).
 * - NO `Object.freeze` (perf overhead + bundle), NO `immer` (bundle 3 KB sfora cap 4 KB),
 *   NO `deepFreeze`. Consumer non-mutation responsabilità doc-only ("treat returned
 *   snapshots as immutable" — README W3 P05).
 *
 * Export pubblico:
 * - `getState()` — snapshot top-level Readonly corrente.
 * - `setState(partial)` — merge spread-copy + return `{previous, current, changedKeys}`.
 * - `replaceState(next)` — rimpiazza intero state + return tuple union keys.
 * - `clearState(keys?)` — delete chiavi + return tuple changed.
 *
 * Internal test helper `__resetForTest()` NON esposto dal barrel (D-V2-F9-11 carryover).
 *
 * @see PRD §18.4 (RuntimeContext shape)
 * @see D-V2-F10-07 (storage strategy plain object spread-copy)
 * @see D-V2-F10-08 (clearRuntimeContext delete vs assign undefined exactOptional)
 * @packageDocumentation
 */
import { RUNTIME_CONTEXT_KEYS } from './internal/standard-keys'
import type { RuntimeContext } from './types/runtime-context'

/**
 * Tupla di mutazione stato ritornata da `setState` / `replaceState` / `clearState`.
 *
 * Shape coerente con `ContextChangedPayload` (PRD §18.6) — `runtime-context.ts` usa
 * direttamente questa tupla per costruire l'event payload via `fireContextEvents`.
 *
 * - `previous` — riferimento al vecchio state object (PRE-mutation).
 * - `current` — riferimento al nuovo state object (POST-mutation).
 * - `changedKeys` — array di chiavi che hanno diverso valore (Object.is top-level) tra
 *   previous e current. Vuoto array se mutation è no-op (es. `setState({tenantId: 'T1'})`
 *   chiamato su state già `{tenantId: 'T1'}`).
 *
 * @see ContextChangedPayload in `events.ts`
 */
export interface StateMutation {
  readonly previous: Readonly<RuntimeContext>
  readonly current: Readonly<RuntimeContext>
  readonly changedKeys: ReadonlyArray<keyof RuntimeContext>
}

let state: RuntimeContext = {}

/**
 * Ritorna snapshot top-level corrente del `RuntimeContext`.
 *
 * Non-mutation responsabilità doc-only (D-V2-F10-07 NO freeze runtime). Consumer treat
 * returned object as immutable — qualsiasi mutazione esterna NON triggera events.
 *
 * @returns Readonly snapshot — same reference finché un setState/replaceState/clearState
 *   con `changedKeys.length > 0` viene chiamato.
 */
export function getState(): Readonly<RuntimeContext> {
  return state
}

/**
 * Merge partial → spread-copy new state + compute changedKeys (Object.is top-level).
 *
 * Implementa la strategia spread-copy D-V2-F10-07 — `current = {...state, ...partial}`.
 * Le chiavi presenti in `partial` con valore identico al precedente NON appaiono in
 * `changedKeys` (Object.is gate).
 *
 * @param partial Partial map di chiavi `keyof RuntimeContext` → valore. Le chiavi non
 *   presenti in `partial` NON vengono toccate (preservate dal current state).
 * @returns Tupla `{previous, current, changedKeys}`. `current` è sempre un NUOVO oggetto
 *   (mai === previous), anche se `changedKeys` è vuoto.
 *
 * @example
 * ```ts
 * setState({ tenantId: 'T1' })
 * const r = setState({ user: { id: 'u1' } })
 * r.previous  // { tenantId: 'T1' }
 * r.current   // { tenantId: 'T1', user: { id: 'u1' } }
 * r.changedKeys  // ['user']
 * ```
 *
 * @see D-V2-F10-07
 */
export function setState(partial: Partial<RuntimeContext>): StateMutation {
  const previous = state
  const current = { ...state, ...partial }
  const changedKeys = computeChangedKeys(previous, current)
  state = current
  return { previous, current, changedKeys }
}

/**
 * Sostituisce intero state con `next` (spread-copia per consistency reference identity).
 *
 * `changedKeys` è la union delle chiavi presenti in `previous` + `next` con diff Object.is.
 * Le chiavi presenti in `previous` ma NON in `next` appaiono in `changedKeys` (rimosse =
 * `undefined` vs precedente value).
 *
 * @param next Nuovo state completo. Le chiavi non presenti vengono rimosse dal current.
 * @returns Tupla `{previous, current, changedKeys}`.
 *
 * @example
 * ```ts
 * setState({ tenantId: 'T1', locale: 'it' })
 * const r = replaceState({ user: { id: 'u1' } })
 * r.current      // { user: { id: 'u1' } }
 * r.changedKeys  // ['tenantId', 'locale', 'user'] — union previous+next
 * ```
 */
export function replaceState(next: RuntimeContext): StateMutation {
  const previous = state
  const current = { ...next }
  const allKeys = new Set<keyof RuntimeContext>([
    ...(Object.keys(previous) as Array<keyof RuntimeContext>),
    ...(Object.keys(current) as Array<keyof RuntimeContext>),
  ])
  const changedKeys: Array<keyof RuntimeContext> = []
  for (const k of allKeys) {
    if (!Object.is(previous[k], current[k])) changedKeys.push(k)
  }
  state = current
  return { previous, current, changedKeys }
}

/**
 * Rimuove chiavi via `delete next[k]` (NOT `next[k] = undefined` — D-V2-F10-08).
 *
 * No-args → itera `RUNTIME_CONTEXT_KEYS` (11 chiavi standard PRD §18.4). `changedKeys`
 * contiene SOLO le chiavi effettivamente presenti rimosse (not chiavi target già assenti).
 *
 * **D-V2-F10-08 (delete vs assign):** Usato `delete` per compatibilità con
 * `exactOptionalPropertyTypes` TS strict — l'assertion `'tenantId' in current === false`
 * deve valere post-clear (NOT solo `current.tenantId === undefined`).
 *
 * @param keys Chiavi da rimuovere. Default = `RUNTIME_CONTEXT_KEYS` (11 chiavi PRD §18.4).
 * @returns Tupla `{previous, current, changedKeys}`.
 *
 * @example
 * ```ts
 * setState({ tenantId: 'T1', locale: 'it' })
 * const r = clearState(['tenantId'])
 * 'tenantId' in r.current  // false (delete, NOT undefined assign)
 * r.current                // { locale: 'it' }
 * r.changedKeys            // ['tenantId']
 * ```
 *
 * @see D-V2-F10-08
 */
export function clearState(
  keys?: ReadonlyArray<keyof RuntimeContext>,
): StateMutation {
  const previous = state
  const targetKeys = keys ?? RUNTIME_CONTEXT_KEYS
  const next: Record<string, unknown> = { ...state }
  const changedKeys: Array<keyof RuntimeContext> = []
  for (const k of targetKeys) {
    if (k in next) {
      // D-V2-F10-08 — delete vs `= undefined` per exactOptionalPropertyTypes TS strict.
      delete next[k as string]
      changedKeys.push(k as keyof RuntimeContext)
    }
  }
  state = next as RuntimeContext
  return { previous, current: state, changedKeys }
}

/**
 * Computa changedKeys union (previous ∪ current) con gate Object.is top-level.
 *
 * Helper interno (NON esposto dal barrel) usato da `setState` e per simmetria con
 * `replaceState`. Costo O(n) dove n = |union|.
 *
 * @internal
 */
function computeChangedKeys(
  previous: Readonly<RuntimeContext>,
  current: Readonly<RuntimeContext>,
): Array<keyof RuntimeContext> {
  const allKeys = new Set<keyof RuntimeContext>([
    ...(Object.keys(previous) as Array<keyof RuntimeContext>),
    ...(Object.keys(current) as Array<keyof RuntimeContext>),
  ])
  const changed: Array<keyof RuntimeContext> = []
  for (const k of allKeys) {
    if (!Object.is(previous[k], current[k])) changed.push(k)
  }
  return changed
}

/**
 * Test-only reset helper — ripristina `state = {}` per isolation tra test.
 *
 * NON esportato dal barrel `packages/context/src/index.ts` (D-V2-F9-11 internal helpers
 * convention).
 *
 * @internal
 */
export function __resetForTest(): void {
  state = {}
}
