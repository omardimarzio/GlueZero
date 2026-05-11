/**
 * ctx.context auto-injection LIVE facade (D-V2-F10-15 + MF-CTX-06).
 *
 * **Strategy A: mutation cast at runtime** (verified F8 `createMfRuntimeContext` ritorna
 * NON-frozen plain object — `packages/microfrontends/src/runtime-context-factory.ts:64-102`).
 *
 * **Lifecycle:**
 * 1. Al `microfrontend.mounted` event → `attachMfContext(mfId, reg, abortSignal)`:
 *    - Compute initial snapshot (state + contextMap alias).
 *    - Mutation cast `reg.runtimeContext.context = snapshot`.
 *    - Internal `subscribeRuntimeContext` con full-state selector → LIVE updates.
 * 2. State change → re-compute snapshot → mutation update `ctx.context`.
 * 3. Al `microfrontend.unmounted`/`destroyed` → `detachMfContext(mfId)`:
 *    - Cascade cleanup via `abortSignal` mount lifecycle F8 plumbed.
 *    - Defensive `off()` esplicito anche se abortSignal copre già.
 *
 * **contextMap aliasing (PRD §18.8):** snapshot include chiavi standard passthrough
 * (`{tenantId, locale, ...}`) + chiavi mapped localizzate (es. `contextMap.currentTenant ===
 * 'tenantId'` → `snapshot.currentTenant` mirrors `state.tenantId`).
 *
 * @see MF-CTX-06, MF-MAP-01 (contextMap)
 * @see D-V2-F10-15 (contextMap auto-injection LIVE)
 * @see T-F10-W2-P04-03 (internal subscribe leak — abortSignal cascade)
 * @see T-F10-W2-P04-04 (mutation cast safety — F8 NON-frozen verified)
 * @see PRD §18.8
 * @packageDocumentation
 */
import type { MicroFrontendDescriptor, MicroFrontendRegistration } from '@gluezero/microfrontends'
import type { MicroFrontendMapping } from './mapping-integration'
import { getRuntimeContext, subscribeRuntimeContext } from './runtime-context'

/**
 * Tracking unsubscribe fn per-MF (per `detachMfContext` explicit cleanup).
 *
 * Cascade cleanup via `abortSignal` mount lifecycle plumbed F8 è il primary path
 * (T-F10-W2-P04-03 mitigation), questo Map è defensive backup.
 */
const mfSubscriptions = new Map<string, () => void>()

/**
 * Type narrowing locale per `descriptor.mapping` field (D-83 strict — NO declaration merging).
 *
 * @internal
 */
function getContextMap(descriptor: MicroFrontendDescriptor): Record<string, string> {
  const mapping = (descriptor as { mapping?: MicroFrontendMapping }).mapping
  return mapping?.contextMap ?? {}
}

/**
 * Compute snapshot per MF: standard keys passthrough + contextMap alias (PRD §18.8).
 *
 * **Shape:** `{...stateStandardKeys, ...mappedAliasKeys}` — gli alias sono OVERLAY
 * sui valori standard (es. `contextMap.currentTenant: 'tenantId'` → `snapshot.currentTenant`
 * mirror di `snapshot.tenantId`). Reference identity preservata per slice non-changed
 * via shallow gate `subscribeRuntimeContext` (delegated).
 *
 * @param descriptor MF descriptor (per leggere `mapping.contextMap`).
 * @returns Snapshot plain object con chiavi standard + alias.
 *
 * @example
 * ```ts
 * // state = { tenantId: 'acme', locale: 'it' }
 * // descriptor.mapping.contextMap = { currentTenant: 'tenantId', language: 'locale' }
 * computeContextSnapshot(descriptor)
 * // → { tenantId: 'acme', locale: 'it', currentTenant: 'acme', language: 'it' }
 * ```
 *
 * @see MF-CTX-06
 * @see PRD §18.8
 */
export function computeContextSnapshot(
  descriptor: MicroFrontendDescriptor,
): Record<string, unknown> {
  const state = getRuntimeContext() as Record<string, unknown>
  const contextMap = getContextMap(descriptor)
  // Passthrough standard keys + contextMap alias overlay
  const snap: Record<string, unknown> = { ...state }
  for (const [localName, canonicalKey] of Object.entries(contextMap)) {
    snap[localName] = state[canonicalKey]
  }
  return snap
}

/**
 * Attach MF context: mutation cast `ctx.context` + LIVE subscribe.
 *
 * **Strategy A mutation cast (D-V2-F10-15):** F8 `createMfRuntimeContext` ritorna
 * oggetto NON-frozen → mutation a runtime OK. Cast `reg.runtimeContext as { context?: unknown }`
 * runtime-safe + TS strict cast esplicito.
 *
 * **Cascade cleanup via `abortSignal` mount lifecycle plumbed F8** (D-V2-F10-04 +
 * D-V2-16 carryover). `signal.abort()` chiama auto-`off()` via
 * `addEventListener('abort', off, { once: true })` interno a `subscribeRuntimeContext`.
 *
 * Edge case: se `reg.runtimeContext` undefined (F8 facade not yet created) → skip
 * (lifecycle order edge — defensive). Coerente con F8 lifecycle pattern.
 *
 * @param mfId Id MF.
 * @param reg Registration F8 (con `runtimeContext` placeholder field).
 * @param abortSignal AbortSignal mount lifecycle F8 plumbed (cascade auto-cleanup).
 *
 * @see D-V2-F10-15 (contextMap auto-injection LIVE)
 * @see D-V2-F10-04 (AbortSignal cascade)
 */
export function attachMfContext(
  mfId: string,
  reg: MicroFrontendRegistration,
  abortSignal: AbortSignal | undefined,
): void {
  // F8 `MicroFrontendRegistration` non espone `runtimeContext` come field tipato
  // (è creato on-demand da `createMfRuntimeContext(broker, reg)` in registry.ts).
  // F10 W2 P04 espone via extension cast — test pattern mock-injects field per
  // verifica LIVE update. Production hook (W3 lifecycle integration) può popolare
  // `reg.runtimeContext` via `createMfRuntimeContext` snapshot store-pattern.
  const regExt = reg as MicroFrontendRegistration & { runtimeContext?: unknown }
  if (!regExt.runtimeContext) return

  // Strategy A mutation cast — F8 NON-frozen verified
  const ctxObj = regExt.runtimeContext as { context?: unknown }

  // Initial snapshot
  ctxObj.context = computeContextSnapshot(reg.descriptor)

  // LIVE subscribe — full state selector + recompute snapshot on every change.
  // abortSignal F8 mount lifecycle plumbed → cascade cleanup automatic
  // (T-F10-W2-P04-03 mitigation).
  const subscribeOptions =
    abortSignal !== undefined ? { signal: abortSignal } : undefined
  const off = subscribeRuntimeContext(
    (state) => state, // full state selector — fires on any change
    () => {
      ctxObj.context = computeContextSnapshot(reg.descriptor)
    },
    subscribeOptions,
  )
  mfSubscriptions.set(mfId, off)
}

/**
 * Detach MF context: cascade cleanup (defensive — abortSignal mount lifecycle copre già).
 *
 * Chiamato al `microfrontend.unmounted`/`destroyed` lifecycle event. Idempotent: chiamate
 * ripetute con stesso `mfId` sono no-op (Map.get undefined → skip).
 *
 * @param mfId Id MF da detach.
 */
export function detachMfContext(mfId: string): void {
  const off = mfSubscriptions.get(mfId)
  if (off) {
    off()
    mfSubscriptions.delete(mfId)
  }
}

/**
 * Debug snapshot — MF-CTX-06 facade per F6 SnapshotProvider integration (W3 P05 finalizza).
 *
 * Espone:
 * - `state` — full RuntimeContext snapshot corrente.
 * - `perMfSubscriptionCount` — counter MF attualmente subscribed.
 *
 * @returns Debug snapshot serializable (no circular refs, no function refs).
 *
 * @see MF-CTX-06
 */
export function getDebugSnapshot(): {
  state: Readonly<Record<string, unknown>>
  perMfSubscriptionCount: number
} {
  return {
    state: getRuntimeContext() as Readonly<Record<string, unknown>>,
    perMfSubscriptionCount: mfSubscriptions.size,
  }
}

/**
 * Test-only reset — cleanup tutte le subscriptions attive.
 *
 * @internal
 */
export function __resetFacadeForTest(): void {
  for (const [, off] of mfSubscriptions) {
    try {
      off()
    } catch {
      // defensive — off può throw se signal già aborted
    }
  }
  mfSubscriptions.clear()
}
