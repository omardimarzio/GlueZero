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
import type { MicroFrontendsService } from '@gluezero/microfrontends'
import { enforceWrite, getWritableKeys } from './acl-enforcer'
import { fireContextEvents } from './events'
import { RUNTIME_CONTEXT_KEYS } from './internal/standard-keys'
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
let mfServiceRef: MicroFrontendsService | undefined

/**
 * Internal init — chiamato da `contextModule().install` per memorizzare broker + mfService.
 *
 * **W2 P03 estensione:** signature 2-args (broker + mfService). `mfService` è necessario
 * per il lookup `mfService.get(callerMfId).descriptor` durante l'ACL `enforceWrite` check
 * (D-V2-F10-06). App shell (callerMfId undefined) bypassa il lookup → ACL pass-through.
 *
 * Pattern coerente F8 `microfrontendModule` service register +
 * F9 `mfEsmModule` LOOKUP register loader.
 *
 * @param broker Broker reference dall'install hook `ctx.broker`.
 * @param mfService MicroFrontendsService reference (W2 P03 — ACL descriptor lookup).
 *
 * @internal Esportato dal barrel SOLO per uso da `context-module.ts` (consumer non chiama
 *   direttamente).
 */
export function initRuntimeContext(
  broker: Broker,
  mfService: MicroFrontendsService,
): void {
  brokerRef = broker
  mfServiceRef = mfService
}

/**
 * ACL check helper — risolve `writableKeys` da descriptor MF se `callerMfId` presente,
 * poi chiama `enforceWrite` (throw fail-fast + topic publish PRIMA della mutazione).
 *
 * App shell (`callerMfId === undefined`) bypassa enforcement (D-V2-F10-05).
 * MF non registrato (defensive) → tratta come app shell (pass-through).
 *
 * **Threat T-F10-01 mitigation:** stateless lookup at every call (no cache),
 * descriptor immutable F8 post-register (D-V2-11), default fail-secure
 * (writableKeys vuoto = MF read-only).
 *
 * @param broker Broker reference (per publish denied topic).
 * @param callerMfId `string | undefined`: undefined = app shell; string = MF caller id.
 * @param keys Chiavi che il caller sta tentando di scrivere/cancellare.
 *
 * @throws `BrokerError` con `code: 'MF_CONTEXT_WRITE_DENIED'` se denied.
 * @internal
 * @see D-V2-F10-06 (enforcement throw + topic publish PRIMA del throw)
 */
function checkAcl(
  broker: Broker,
  callerMfId: string | undefined,
  keys: ReadonlyArray<string>,
): void {
  if (callerMfId === undefined) return // App shell pass-through
  const reg = mfServiceRef?.get(callerMfId)
  if (!reg) return // MF non registrato → tratta come app shell (defensive)
  const writableKeys = getWritableKeys(reg.descriptor)
  enforceWrite(broker, callerMfId, keys, writableKeys)
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
 * ACL pre-check fail-fast (D-V2-F10-06): se `callerMfId` defined, verifica che tutte le
 * chiavi in `partial` siano in `descriptor.context.writableKeys` allowlist. App shell
 * (`callerMfId === undefined`) pass-through.
 *
 * @param partial Partial map di chiavi `keyof RuntimeContext` → valore.
 * @param options Opt `{callerMfId?}` (P03 ACL enforcement).
 *
 * @example Set multiple keys
 * ```ts
 * setRuntimeContext({ tenantId: 'acme', user: { id: 'u1' } })
 * // Pubblica: context.changed + context.tenant.changed + context.user.changed
 * ```
 *
 * @example Da MF facade con ACL check
 * ```ts
 * setRuntimeContext({ currentRoute: { path: '/home' } }, { callerMfId: 'mf-x' })
 * // Verifica descriptor.context.writableKeys → throw MF_CONTEXT_WRITE_DENIED se denied
 * ```
 *
 * @throws `BrokerError` con `code: 'MF_CONTEXT_WRITE_DENIED'` se callerMfId tenta
 *   scrittura di chiavi NOT in descriptor.context.writableKeys (D-V2-F10-06)
 *
 * @see MF-CTX-01, PRD §18.5
 * @see D-V2-F10-06 (enforcement mode)
 * @see D-V2-F10-13 (events fire pattern 1+N)
 */
export function setRuntimeContext(
  partial: Partial<RuntimeContext>,
  options?: SetContextOptions,
): void {
  const broker = ensureBroker()
  // ACL pre-check fail-fast (D-V2-F10-06) — throw PRIMA della mutazione storage.
  // No partial mutation: se denied, setState NON viene chiamato.
  checkAcl(broker, options?.callerMfId, Object.keys(partial))
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
 * ACL check su union(previous keys + next keys) — replace tocca TUTTE le chiavi (anche
 * quelle che spariscono da `previous`). Impedisce bypass via stripping writable keys
 * per scrivere chiavi denied.
 *
 * @param next Nuovo state completo.
 * @param options Opt `{callerMfId?}` (P03 ACL enforcement).
 *
 * @example Cancella intero state
 * ```ts
 * replaceRuntimeContext({}) // emette events su tutte chiavi previous
 * ```
 *
 * @example Da MF facade con ACL check
 * ```ts
 * replaceRuntimeContext({ currentRoute: { path: '/home' } }, { callerMfId: 'mf-x' })
 * // Verifica writableKeys vs union(previous keys + new keys) → throw se denied
 * ```
 *
 * @throws `BrokerError` con `code: 'MF_CONTEXT_WRITE_DENIED'` se callerMfId tenta
 *   scrittura su chiavi NOT in descriptor.context.writableKeys (D-V2-F10-06)
 *
 * @see MF-CTX-01, PRD §18.5
 * @see D-V2-F10-06 (ACL enforcement)
 */
export function replaceRuntimeContext(
  next: RuntimeContext,
  options?: SetContextOptions,
): void {
  const broker = ensureBroker()
  // ACL check su union(previous keys + next keys) — replace è write operation che
  // tocca TUTTE le chiavi (anche quelle che sparirebbero da `previous`). Impedisce
  // bypass via stripping writable keys per scrivere chiavi denied.
  const currentKeys = Object.keys(getState())
  const nextKeys = Object.keys(next)
  const allTouchedKeys = Array.from(new Set([...currentKeys, ...nextKeys]))
  checkAcl(broker, options?.callerMfId, allTouchedKeys)
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
 * ACL check (D-V2-F10-08 + D-V2-F10-06): clear è write operation. Le chiavi target
 * (esplicite o default 11 standard) DEVONO essere in `descriptor.context.writableKeys`
 * se `callerMfId` defined.
 *
 * @param keys Chiavi da rimuovere. Default = 11 chiavi standard PRD §18.4.
 * @param options Opt `{callerMfId?}` (P03 ACL enforcement).
 *
 * @example Clear specifico
 * ```ts
 * clearRuntimeContext(['tenantId'])   // rimuove solo tenantId
 * ```
 *
 * @example Clear totale
 * ```ts
 * clearRuntimeContext()                // rimuove tutte le 11 chiavi standard
 * ```
 *
 * @throws `BrokerError` con `code: 'MF_CONTEXT_WRITE_DENIED'` se callerMfId tenta
 *   clear di chiavi NOT in descriptor.context.writableKeys (D-V2-F10-06)
 *
 * @see MF-CTX-01, PRD §18.5
 * @see D-V2-F10-08 (delete vs assign undefined)
 */
export function clearRuntimeContext(
  keys?: ReadonlyArray<keyof RuntimeContext>,
  options?: SetContextOptions,
): void {
  const broker = ensureBroker()
  // ACL check — clear è write operation (D-V2-F10-08 + D-V2-F10-06).
  // No-args → itera 11 chiavi standard PRD §18.4.
  const targetKeys = keys ?? RUNTIME_CONTEXT_KEYS
  checkAcl(broker, options?.callerMfId, targetKeys as ReadonlyArray<string>)
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
  mfServiceRef = undefined
  __resetStorageForTest()
  __resetSubscribersForTest()
}
