/**
 * F11 Lifecycle hooks — subscribe 7 topics (4 F8 lifecycle + 3 F11 locali) per:
 *
 * Cover REQ-IDs: MF-INT-LIFE-03 (MF lifecycle integration capability check + LRU
 * invalidation event-driven + cleanup cascade D-V2-16) + MF-CAP-05 (event-driven
 * invalidation D-V2-F11-07).
 *
 * 1. Capability check pre-mount best-effort (OQ-2 — dual subscribe scenario).
 * 2. LRU cache invalidation event-driven (D-V2-F11-07).
 * 3. Cleanup cascade D-V2-16 (registry capabilities + LRU permissions).
 *
 * **OQ-2 best-effort post-hoc resolution (research §6 + addendum A2)**:
 *
 * F8 NON espone topic `'microfrontend.lifecycle.beforeMount'` — verified
 * `packages/microfrontends/src/registry.ts:506-525` mostra auto-bootstrap D-V2-07
 * inline scenario che SALTA `'bootstrapped'` emit separato.
 *
 * F11 subscribe BOTH `'microfrontend.bootstrapped'` + `'microfrontend.loaded'` per
 * coprire:
 *
 * - Standard load → bootstrap (2 emits separate) → primo handler triggera check.
 * - Auto-bootstrap inline (D-V2-07) → solo `'loaded'` emit → secondo handler triggera check.
 *
 * `block-mount` policy = best-effort post-hoc (NOT pre-mount hard block). Per hard
 * block consumer-driven, plan 11-03 espone `permissionService.checkCapabilitiesPreMount(mfId)`.
 *
 * **D-V2-F11-12 per-MF override more-strict wins**:
 * `effectivePolicy = descriptor.capabilities.policy ?? installPolicy`.
 *
 * | Topic                                  | Source | Action                                        |
 * |----------------------------------------|--------|-----------------------------------------------|
 * | `microfrontend.bootstrapped`           | F8     | capability check (path standard)              |
 * | `microfrontend.loaded`                 | F8     | capability check (fallback auto-bootstrap)    |
 * | `microfrontend.unregistered`           | F8     | engine.clearCacheByMfId + registry.cleanupByMfId|
 * | `microfrontend.unmounted`              | F8     | engine.clearCacheByMfId (MF può rimontare)    |
 * | `capability.registered`                | F11    | registry.invalidateCheckCache                 |
 * | `capability.unregistered`              | F11    | registry.invalidateCheckCache                 |
 * | `microfrontend.permissions.updated`    | F11    | engine.clearCacheByMfId                       |
 *
 * @see prd_2.0.0.md §17.7 — lifecycle integration capability check
 * @see ROADMAP linea 288 — SC2 capability missing detection
 * @see D-V2-F11-11 (event-driven invalidation)
 * @see D-V2-F11-12 (per-MF override more-strict wins)
 * @see D-V2-F11-22 (strict triple — internal NON esposto barrel)
 */
import type { Broker, BrokerEvent } from '@gluezero/core'
import type { MicroFrontendsService } from '@gluezero/microfrontends'
import { enforceCapabilityPolicy } from './capability-checker'
import type { CapabilityRegistry } from './capability-registry'
import type { PermissionEngine } from './permission-engine'
import type { CapabilityPolicy } from './types/capabilities'
import { getCapabilities } from './types/descriptor-augment'

/**
 * Subset payload F8 consumato da F11 lifecycle hooks (type narrowing locale).
 *
 * F8 payloads contengono `id` field (carryover MfLifecyclePayload pattern F10).
 * `microFrontendId` alternative usato da F11 capability-checker topic emit.
 *
 * @internal
 */
interface MfLifecyclePayload {
  readonly id?: string
  readonly microFrontendId?: string
}

/**
 * Type narrowing locale per estrarre `mfId` dal BrokerEvent payload.
 *
 * F8 publish con shape `{id}`; F11 publish con shape `{microFrontendId}` —
 * narrowing supporta entrambi (defensive).
 *
 * @internal
 */
function getMfId(event: BrokerEvent<unknown>): string | undefined {
  const p = event.payload as MfLifecyclePayload | undefined
  return p?.id ?? p?.microFrontendId
}

/**
 * Wire lifecycle hooks F11 — composition esterna via subscribe ai 7 topics.
 *
 * **F11 NON modifica F8 registry** (D-V2-F11-22 strict triple — zero diff
 * `packages/microfrontends/src/`). Tutti i hooks sono subscribe-based.
 *
 * **B-02 FIX (OQ-2 amendment A2)**: `block-mount` policy = best-effort post-hoc.
 * Il throw dell'`enforceCapabilityPolicy` invocato all'interno del subscribe
 * handler F11 NON propaga al `broker.publish` chiamante (F1 pattern pub/sub
 * standard — handler errors swallowed o emit `subscription.error` topic). Per
 * hard block test/consumer, usa API esplicita
 * `permissionService.checkCapabilitiesPreMount(mfId)` (plan 11-03).
 *
 * @param broker Broker reference per subscribe ai 7 topics.
 * @param mfService MicroFrontendsService per lookup `reg.descriptor` capabilities.
 * @param engine PermissionEngine per `clearCacheByMfId(mfId)` LRU invalidation.
 * @param registry CapabilityRegistry per `checkMicroFrontendCapabilities` + `cleanupByMfId` + `invalidateCheckCache`.
 * @param installPolicy Policy di install-time fallback se `descriptor.capabilities.policy` assente.
 *
 * @example Invocato da `permissionsModule().install` (W2-P03)
 * ```ts
 * wireLifecycleHooks(ctx.broker, mfService, engine, registry, installPolicy)
 * ```
 *
 * @throws {BrokerError} `CAPABILITY_MISSING` propagato da `enforceCapabilityPolicy`
 *   quando policy effettiva === `'block-mount'` o `'block-load'` (OQ-2 alias) e capability
 *   check del MF fallisce. Best-effort post-hoc: il throw NON re-throws via broker.publish
 *   (F1 pub/sub pattern handler errors swallowed).
 *
 * @see prd_2.0.0.md §17.7 — lifecycle integration MF-INT-LIFE-03
 */
export function wireLifecycleHooks(
  broker: Broker,
  mfService: MicroFrontendsService,
  engine: PermissionEngine,
  registry: CapabilityRegistry,
  installPolicy: CapabilityPolicy,
): void {
  function runCapabilityCheck(mfId: string): void {
    const reg = mfService.get(mfId)
    if (!reg) return // defensive: MF già unregistered (race condition)
    const caps = getCapabilities(reg.descriptor)
    if (!caps) return // no capabilities → skip check
    // D-V2-F11-12 per-MF override more-strict wins.
    const effectivePolicy = caps.policy ?? installPolicy
    const result = registry.checkMicroFrontendCapabilities(mfId, caps)
    enforceCapabilityPolicy(broker, mfId, result, effectivePolicy)
  }

  // OQ-2 dual subscribe — copre standard path + auto-bootstrap D-V2-07 inline scenario.
  broker.subscribe('microfrontend.bootstrapped', (event) => {
    const mfId = getMfId(event)
    if (mfId) runCapabilityCheck(mfId)
  })
  broker.subscribe('microfrontend.loaded', (event) => {
    const mfId = getMfId(event)
    if (mfId) runCapabilityCheck(mfId)
  })

  // Cleanup cascade D-V2-16 — LRU permission cache + registry capability entries providedBy mfId.
  broker.subscribe('microfrontend.unregistered', (event) => {
    const mfId = getMfId(event)
    if (!mfId) return
    engine.clearCacheByMfId(mfId)
    registry.cleanupByMfId(mfId)
  })

  // Unmount: clear LRU only (MF può rimontare con descriptor invariato).
  broker.subscribe('microfrontend.unmounted', (event) => {
    const mfId = getMfId(event)
    if (mfId) engine.clearCacheByMfId(mfId)
  })

  // F11 NEW topics locali — event-driven invalidation D-V2-F11-07.
  broker.subscribe('capability.registered', () => {
    registry.invalidateCheckCache()
  })
  broker.subscribe('capability.unregistered', () => {
    registry.invalidateCheckCache()
  })
  broker.subscribe('microfrontend.permissions.updated', (event) => {
    const mfId = getMfId(event)
    if (mfId) engine.clearCacheByMfId(mfId)
  })
}
