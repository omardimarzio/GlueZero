/**
 * F12 Lifecycle hooks — subscribe 4 topics F8+F12 per integrazione runtime
 * con il lifecycle FSM.
 *
 * Cover REQ-IDs: MF-COMPAT-01 (lifecycle integration partial) +
 * MF-COMPAT-04 (5 policy dispatch wired into 3 lifecycle trigger points).
 *
 * **4 topic subscribe:**
 *
 * 1. `microfrontend.bootstrapped` (F8) → `runCheck(mfId, 'mount')` — warn telemetry
 *    OQ-2 dual subscribe pattern (defensive fallback per scenario auto-bootstrap
 *    inline D-V2-07 dove `bootstrapped` può essere skippato).
 * 2. `microfrontend.loaded` (F8) → `runCheck(mfId, 'load')` — secondo handler
 *    della coppia OQ-2 (assicura check anche se service-wrap bypassed o auto-bootstrap).
 * 3. `microfrontend.compatibility.version.changed` (F12 locale) → invalidate
 *    `lastReports` cache memoization (D-12-08 + D-12-12). Re-compute on-demand al
 *    prossimo `getCompatibilityReport(id)` call.
 * 4. `microfrontend.unregistered` (F8) → cleanup memoization entry tramite
 *    `engine.deleteReport(mfId)` (D-V2-16 cascade — previene memory leak).
 *
 * **OQ-2 RESOLUTION (HIGH) — dual subscribe carryover F11**:
 *
 * F8 NON espone topic `'microfrontend.lifecycle.beforeMount'` (verified
 * `packages/microfrontends/src/registry.ts` — auto-bootstrap D-V2-07 inline scenario
 * SALTA `'bootstrapped'` emit separato). F12 subscribe BOTH `bootstrapped` +
 * `loaded` per coprire:
 *
 * - Standard load → bootstrap (2 emit separate) → primo handler triggera check con phase=mount.
 * - Auto-bootstrap inline (D-V2-07) → solo `'loaded'` emit → secondo handler triggera check con phase=load.
 *
 * **Best-effort post-hoc (carryover F11 OQ-2 amendment A2)**:
 *
 * Il throw di `enforceCompatPolicy` invocato all'interno del subscribe handler
 * NON propaga al `broker.publish` chiamante (F1 pattern pub/sub standard — handler
 * errors swallowed o emit `subscription.error` topic). Per hard block consumer-driven
 * usa il service-wrap (plan 12-03 enforcement-points.ts) che esegue throw sync
 * PRIMA dell'invocazione `mfService.register/load/mount` originale.
 *
 * I subscribe handler in questo file forniscono "warn telemetry" e "defensive check"
 * per scenari dove il service-wrap viene bypassato (es. consumer chiama direttamente
 * lifecycle method senza passare per il Service Locator typed).
 *
 * **D-V2-16 cleanup cascade (carryover F11 lifecycle-hooks.ts:140-145)**:
 *
 * Su `microfrontend.unregistered` cleanup la memo entry `lastReports.delete(mfId)`
 * → previene memory leak quando un MF viene rimosso (memo entries non bound a MF lifecycle).
 *
 * @see prd_2.0.0.md §20 — Compatibility lifecycle integration
 * @see D-12-08 — Version registry singleton broker-scoped + emit version.changed
 * @see D-12-12 — Memoization simple Map (NO LRU eviction)
 * @see D-V2-16 — Cascade unsubscribe pattern carryover F11
 * @see plan 12-03 Task 2
 * @see packages/permissions/src/lifecycle-hooks.ts:111-164 (TEMPLATE F11 dual subscribe)
 */
import type { Broker, BrokerEvent } from '@gluezero/core'
import type { MicroFrontendsService } from '@gluezero/microfrontends'
import type { CheckEngine } from './check-engine'
import type { CompatibilityPhase } from './compat-error'
import { enforceCompatPolicy } from './policy-dispatch'
import { getCompatibility } from './types/descriptor-augment'
import type { CompatibilityPolicy } from './types/policy'
import type { VersionRegistry } from './version-registry'

/**
 * Subset payload F8 consumato da F12 lifecycle hooks (type narrowing locale).
 *
 * F8 payloads contengono `id` field (carryover MfLifecyclePayload pattern F10).
 * `microFrontendId` alternative usato da F12 publish topic emit (compat-error.ts).
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
 * F8 publish con shape `{id}`; F12 publish con shape `{microFrontendId}` —
 * narrowing supporta entrambi (defensive).
 *
 * @internal
 */
function getMfId(event: BrokerEvent<unknown>): string | undefined {
  const p = event.payload as MfLifecyclePayload | undefined
  return p?.id ?? p?.microFrontendId
}

/**
 * Wire lifecycle hooks F12 — composition esterna via subscribe ai 4 topics.
 *
 * **F12 NON modifica F8 registry** (D-83 strict triple esteso v2.0 — zero diff
 * `packages/microfrontends/src/`). Tutti i hooks sono subscribe-based.
 *
 * **Best-effort post-hoc**: il throw `enforceCompatPolicy` invocato dentro un
 * subscribe handler NON propaga al `broker.publish` chiamante. Service-wrap
 * (`enforcement-points.ts`) è il path hard-block sync che lavora a livello di
 * service method invocation.
 *
 * @param broker Broker reference per subscribe ai 4 topics.
 * @param mfService MicroFrontendsService per lookup `reg.descriptor` capabilities.
 * @param engine CheckEngine per `computeReport(mfId, caps)` + `invalidateReportCache()` + `deleteReport(mfId)`.
 * @param _registry VersionRegistry reservato (sub-handler future per per-MF override D-V2-F11-12).
 * @param installPolicy Policy di install-time fallback se `descriptor.compatibility.policy` assente
 *   (F12 attuale: D-12-11 minimal single option, niente per-MF override — ratifica futura).
 *
 * @example Invocato da `compatModule().install` (Task 3)
 * ```ts
 * wireLifecycleHooks(ctx.broker, mfService, engine, registry, installPolicy)
 * ```
 *
 * @throws {BrokerError} `COMPAT_INCOMPATIBLE` propagato da `enforceCompatPolicy`
 *   quando policy=`'block-mount'` o `'block-load'` e il check fallisce — MA il
 *   throw è swallowed dal broker pub/sub layer (handler errors NON re-throws
 *   via broker.publish). Best-effort post-hoc.
 *
 * @see OQ-2 dual subscribe (research §6 carryover F11 + auto-bootstrap inline coverage)
 * @see D-V2-16 cleanup cascade carryover F11
 */
export function wireLifecycleHooks(
  broker: Broker,
  mfService: MicroFrontendsService,
  engine: CheckEngine,
  _registry: VersionRegistry,
  installPolicy: CompatibilityPolicy,
): void {
  function runCheck(mfId: string, phase: CompatibilityPhase): void {
    // Defensive race condition: MF unregistered tra emit e handler invoke.
    const registration = mfService.get(mfId)
    if (!registration) return

    // Defensive descriptor senza compat: skip silenzioso.
    const caps = getCompatibility(registration.descriptor)
    if (!caps) return

    const report = engine.computeReport(mfId, caps)
    try {
      enforceCompatPolicy(broker, mfId, report, installPolicy, phase)
    } catch {
      // F1 broker.subscribe handler errors sono swallowed dal publisher.
      // Su block-* policy il service-wrap (enforcement-points.ts) ha già
      // throwato sync prima — subscribe è defensive layer, NO propagation here.
    }
  }

  // OQ-2 dual subscribe — copre standard load path + auto-bootstrap inline scenario.
  broker.subscribe('microfrontend.bootstrapped', (event) => {
    const mfId = getMfId(event)
    if (mfId) runCheck(mfId, 'mount')
  })
  broker.subscribe('microfrontend.loaded', (event) => {
    const mfId = getMfId(event)
    if (mfId) runCheck(mfId, 'load')
  })

  // D-12-08: cache invalidation totale su version registry mutation.
  broker.subscribe('microfrontend.compatibility.version.changed', () => {
    engine.invalidateReportCache()
  })

  // D-V2-16 cleanup cascade: previene memory leak su unregister.
  broker.subscribe('microfrontend.unregistered', (event) => {
    const mfId = getMfId(event)
    if (mfId) engine.deleteReport(mfId)
  })
}
