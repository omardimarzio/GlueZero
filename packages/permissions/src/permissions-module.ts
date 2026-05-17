/**
 * `permissionsModule()` factory — `BrokerModule` opt-in per `@gluezero/permissions`
 * (D-V2-F11-01 scaffolding + D-V2-F11-13 + D-V2-F11-16 + D-V2-F11-18 + D-V2-F11-22).
 *
 * Cover REQ-IDs: MF-PERM-01 (10 enforcement points install) + MF-INT-LIFE-03
 * (wire lifecycle hooks 7 topics) + MF-PIPE-01 (D-V2-20 pipeline §28 BLOCKING chiusura
 * PRD §47.11 — proprietà logica facade chain step 4.5).
 *
 * ## Pattern install — Service Locator F8 LOOKUP
 *
 * Replica il pattern F10 `contextModule()` (carryover F9 D-V2-F9-01):
 *
 * 1. Lookup `SERVICE_MICROFRONTENDS` via `ctx.broker.getService(...)`. Se assente
 *    → throw `Error` esplicativo (`@gluezero/permissions requires @gluezero/microfrontends`).
 * 2. Crea `PermissionEngine` (plan 11-02) + `CapabilityRegistry` (plan 11-04).
 * 3. Costruisce service API combinata (permission + capability + runtime mutation).
 * 4. Registra `SERVICE_PERMISSIONS` via `ctx.registerService(...)`.
 * 5. `wrapServiceWithPermissions(mfService, engine)` — OQ-3 audit marker idempotent.
 * 6. `wireLifecycleHooks(...)` (plan 11-04) — subscribe 7 topics F8+F11 per
 *    capability check best-effort + LRU invalidation event-driven + cleanup cascade.
 *
 * ## 2-options factory (D-V2-F11-18)
 *
 * Divergenza ratificata da `D-V2-F10-18` (F10 era no-args). F11 espone 2
 * setup-time options critical decisions NON per-MF override semantics:
 *
 * - `permissionMode`: enforcement globale runtime check
 *   (`'off'` / `'warn'` / `'enforce'`). Default `'warn'` (D-V2-F11-13).
 * - `capabilityPolicy`: policy globale capability check
 *   (`'off'` / `'warn'` / `'block-load'` / `'block-mount'`). Default `'warn'`
 *   (D-V2-F11-16). Override per-MF via `descriptor.capabilities.policy`
 *   (D-V2-F11-12 more-strict wins, applicato in lifecycle-hooks).
 *
 * ## Anti-singleton D-30 (carryover F1)
 *
 * Ogni call ritorna NUOVO `BrokerModule`. Supporta scenario 2-broker indipendenti
 * con permission service separati senza shared state.
 *
 * ## D-V2-F11-20 — capability registry exposure (PRD §17.4 5 methods public)
 *
 * Tutti i 5 metodi della Capability Registry (registerCapability, unregisterCapability,
 * hasCapability, getCapabilities, checkMicroFrontendCapabilities) sono esposti via il
 * service combinato `SERVICE_PERMISSIONS` (composition con permission engine API).
 *
 * ## D-V2-F11-22 STRICT triple
 *
 * NO modifica `packages/core/src/`, `packages/microfrontends/src/`,
 * `packages/mapper/src/`. Tutte le primitive F11 sono additive in
 * `packages/permissions/src/`.
 *
 * @see prd_2.0.0.md §17.6 — capabilityPolicy default warn
 * @see prd_2.0.0.md §19.7 — permissionMode default warn
 * @see ROADMAP linea 290 — SC4 broker.publish raw NON instrumented
 * @see D-V2-F11-13 / D-V2-F11-16 (default warn entrambi)
 * @see D-V2-F11-18 (2 setup options ratificata)
 * @see D-V2-F11-22 (strict triple)
 */
import type { BrokerModule } from '@gluezero/core'
import { SERVICE_MICROFRONTENDS, SERVICE_PERMISSIONS } from '@gluezero/core'
import type { MicroFrontendsService } from '@gluezero/microfrontends'
import { createCapabilityRegistry } from './capability-registry'
import { wrapServiceWithPermissions } from './enforcement-points'
import { wireLifecycleHooks } from './lifecycle-hooks'
import { createPermissionEngine, type PermissionMode } from './permission-engine'
import type { CapabilityPolicy } from './types/capabilities'
import { getCapabilities } from './types/descriptor-augment'

/**
 * Setup-time options per `permissionsModule()` (D-V2-F11-18).
 *
 * Defaults applicati al call site (D-V2-F11-13 + D-V2-F11-16):
 * - `permissionMode` → `'warn'`
 * - `capabilityPolicy` → `'warn'`
 */
export interface PermissionsModuleOptions {
  readonly permissionMode?: PermissionMode
  readonly capabilityPolicy?: CapabilityPolicy
}

/**
 * Factory `BrokerModule` per `@gluezero/permissions`.
 *
 * @param options Setup-time options (defaults entrambi `'warn'`).
 * @returns Nuovo `BrokerModule` con `install` che lookup `SERVICE_MICROFRONTENDS`,
 *   crea engine+registry, registra `SERVICE_PERMISSIONS`, applica OQ-3 monkey-patch
 *   + wire lifecycle hooks.
 *
 * @throws `Error` se `@gluezero/microfrontends` NON installato PRIMA
 *   (consumer deve aggiungere `microfrontendModule()` nell'array `modules` prima
 *   di `permissionsModule()`).
 *
 * @example Setup minimale (defaults entrambi warn)
 * ```typescript
 * import { createBroker } from '@gluezero/core'
 * import { microfrontendModule } from '@gluezero/microfrontends'
 * import { permissionsModule } from '@gluezero/permissions'
 *
 * const broker = createBroker({
 *   modules: [microfrontendModule(), permissionsModule()],
 * })
 * ```
 *
 * @example Setup production (enforce + block-mount)
 * ```typescript
 * const broker = createBroker({
 *   modules: [
 *     microfrontendModule(),
 *     permissionsModule({ permissionMode: 'enforce', capabilityPolicy: 'block-mount' }),
 *   ],
 * })
 * ```
 *
 * @example Anti-singleton — 2 broker indipendenti
 * ```typescript
 * const broker1 = createBroker({ modules: [microfrontendModule(), permissionsModule()] })
 * const broker2 = createBroker({ modules: [microfrontendModule(), permissionsModule()] })
 * // broker1 e broker2 hanno permission service separati con state isolato.
 * ```
 *
 * @throws {Error} install error path — `@gluezero/permissions requires @gluezero/microfrontends`
 *   se microfrontendModule() NON registrato PRIMA di permissionsModule() nell'array modules.
 *
 * @see ROADMAP linea 456 — MF-PIPE-01 cross-fase obligation BLOCKING.
 */
export function permissionsModule(options: PermissionsModuleOptions = {}): BrokerModule {
  const mode: PermissionMode = options.permissionMode ?? 'warn'
  const policy: CapabilityPolicy = options.capabilityPolicy ?? 'warn'
  return {
    id: 'permissions',
    version: '2.0.0-alpha.0',
    install(ctx): void {
      const maybeMfService = ctx.broker.getService<MicroFrontendsService>(SERVICE_MICROFRONTENDS)
      if (!maybeMfService) {
        throw new Error(
          '@gluezero/permissions requires @gluezero/microfrontends to be installed first. ' +
            'Add microfrontendModule() before permissionsModule() in the modules array.',
        )
      }
      // Cattura non-null stabile per le inner function closures (TS narrowing
      // della variabile parent NON si propaga a nested function declarations).
      const mfService: MicroFrontendsService = maybeMfService
      const engine = createPermissionEngine(ctx.broker, mfService, mode)
      const registry = createCapabilityRegistry(ctx.broker, policy)

      // OQ-5 — runtime mutation API (D-V2-F11-07 invalidation via topic).
      // L'effective LRU clear è delegato al lifecycle-hook che subscribe il topic.
      // @see OQ-5 resolution research §6 — API esplicita per cache invalidation event-driven.
      function setMicroFrontendPermissions(mfId: string, _perms: unknown): void {
        ctx.broker.publish(
          'microfrontend.permissions.updated',
          { id: mfId, timestamp: Date.now() },
          {
            source: {
              type: 'plugin' as const,
              id: 'permissions',
              name: '@gluezero/permissions',
            },
            deliveryMode: 'sync' as const,
          } as never,
        )
      }

      // OQ-2 — API esplicita pre-mount check per consumer hard-block scenario.
      // Lifecycle hooks (plan 11-04) eseguono subscribe-based check post-load
      // best-effort; consumer che vuole hard block invoca questa API direttamente
      // prima di `mfService.mount(id)`.
      function checkCapabilitiesPreMount(mfId: string) {
        const reg = mfService.get(mfId)
        const caps = reg ? getCapabilities(reg.descriptor) : undefined
        return registry.checkMicroFrontendCapabilities(mfId, caps)
      }

      // Service API combinata — Permission + Capability + runtime mutation +
      // introspection read-only modes (D-V2-F11-14 immutable post-install).
      const permissionService = {
        // Permission engine API (plan 11-02):
        check: engine.check,
        enforce: engine.enforce,
        clearCacheByMfId: engine.clearCacheByMfId,
        // Capability registry API (plan 11-04 — 5 metodi PRD §17.4):
        registerCapability: registry.registerCapability,
        unregisterCapability: registry.unregisterCapability,
        hasCapability: registry.hasCapability,
        getCapabilities: registry.getCapabilities,
        checkMicroFrontendCapabilities: registry.checkMicroFrontendCapabilities,
        // Runtime mutation + pre-mount API:
        setMicroFrontendPermissions,
        checkCapabilitiesPreMount,
        // Read-only introspection modes:
        get permissionMode() {
          return mode
        },
        get capabilityPolicy() {
          return policy
        },
      }

      ctx.registerService(SERVICE_PERMISSIONS, permissionService)
      // OQ-3 — service marker idempotent + lifecycle methods wrap (plan 11-03 Task 1).
      wrapServiceWithPermissions(mfService, engine)
      // 7 topics subscribe (plan 11-04):
      // F8 lifecycle (4) + F11 locali (3) per capability check + LRU invalidation.
      wireLifecycleHooks(ctx.broker, mfService, engine, registry, policy)
    },
  }
}
