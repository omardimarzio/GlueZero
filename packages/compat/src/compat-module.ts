/**
 * F12 `compatModule()` factory — `BrokerModule` opt-in per `@gluezero/compat`.
 *
 * Cover REQ-IDs: MF-COMPAT-01 (full descriptor wire) + MF-COMPAT-02 (10 metodi
 * service installed) + MF-COMPAT-04 (5 policy dispatch wired into 3 lifecycle
 * trigger points: register/load/mount).
 *
 * ## Pattern install — Service Locator F8 LOOKUP (D-12-13 carryover F11)
 *
 * Replica il pattern F11 `permissionsModule()` (carryover D-V2-F11-13):
 *
 * 1. Lookup `SERVICE_MICROFRONTENDS` via `ctx.broker.getService(...)`. Se assente
 *    → throw `Error` esplicativo (`@gluezero/compat requires @gluezero/microfrontends...`).
 * 2. Crea `VersionRegistry` (W2) + `SemverChecker` (W2) + `CheckEngine` (W2).
 * 3. Costruisce service API combinata (10 metodi + read-only policy getter).
 * 4. Registra `SERVICE_COMPAT` via `ctx.registerService(...)`.
 * 5. `wrapServiceWithCompat(mfService, engine, broker, policy)` — OQ-1 service-wrap
 *    monkey-patch su register/load/mount con marker idempotente.
 * 6. `wireLifecycleHooks(...)` — subscribe 4 topics F8+F12 per warn telemetry +
 *    cache invalidation event-driven + cleanup cascade D-V2-16.
 *
 * ## D-12-11 minimal single-option factory
 *
 * Coerente con `permissionsModule({permissionMode?, capabilityPolicy?})` F11 pattern
 * ma F12 ha SOLO `compatibilityPolicy` (D-12-11 lockato — niente `semverOptions`
 * V2.1 deferred, niente `onMismatch?` hook che violerebbe il pattern dichiarativo PRD).
 *
 * ## Anti-singleton D-30 (carryover F1)
 *
 * Ogni call ritorna NUOVO `BrokerModule`. Supporta scenario 2-broker indipendenti
 * con compat service separati senza shared state.
 *
 * ## API composition (10 metodi + 1 getter — REVISIONE WARNING 1)
 *
 * - **5 PRD §20.4 standard**: `checkMicroFrontendCompatibility`, `getCompatibilityReport`,
 *   `registerCanonicalModelVersion`, `registerTopicVersion`, `registerRouteVersion`.
 * - **4 D-12-10 additive non-breaking**: `registerWorkerVersion`, `registerLoaderVersion`,
 *   `registerFrameworkVersion`, `registerDependencyVersion`.
 * - **1 D-12-10 theme peer-conditional (REVISIONE WARNING 1)**: `registerThemeVersion(kind, version)` —
 *   peer optional `@gluezero/theme`; setter resta sempre callable ma è no-op semantico
 *   se il peer non è installato (host scelta documentata in README).
 *
 * Read-only introspection: `compatibilityPolicy` getter per devtools/audit.
 *
 * ## D-83 strict triple esteso v2.0 preserved
 *
 * NO modifica `packages/core/src/`, `packages/microfrontends/src/`, `packages/mapper/src/`,
 * `packages/permissions/src/`. Tutte le primitive F12 sono additive in `packages/compat/src/`.
 *
 * @see prd_2.0.0.md §20.4 — API surface
 * @see D-12-02 — default policy `'warn'`
 * @see D-12-10 — Additive dimensions non-breaking
 * @see D-12-11 — Minimal single-option factory
 * @see D-12-13 — Service Locator install carryover F11
 * @see D-83 strict triple esteso v2.0
 * @see plan 12-03 Task 3
 * @see packages/permissions/src/permissions-module.ts (TEMPLATE F11)
 */
import type { BrokerModule } from '@gluezero/core'
import { SERVICE_COMPAT, SERVICE_MICROFRONTENDS } from '@gluezero/core'
import type { MicroFrontendsService } from '@gluezero/microfrontends'
import { createCheckEngine, type CheckEngine } from './check-engine'
import { wrapServiceWithCompat } from './enforcement-points'
import { wireLifecycleHooks } from './lifecycle-hooks'
import { createSemverChecker } from './semver-checker'
import type { CompatibilityPolicy } from './types/policy'
import type { CompatibilityReport } from './types/report'
import { createVersionRegistry } from './version-registry'

/**
 * Setup-time options per `compatModule()` (D-12-11 minimal single-option).
 *
 * Default applicato al call site (D-12-02): `compatibilityPolicy` → `'warn'`.
 *
 * Niente `semverOptions` (V2.1 deferred), niente `onMismatch?` hook (viola pattern
 * dichiarativo PRD §20).
 */
export interface CompatModuleOptions {
  readonly compatibilityPolicy?: CompatibilityPolicy
}

/**
 * API pubblica esposta tramite Service Locator (`broker.getService(SERVICE_COMPAT)`).
 *
 * Composizione: 5 PRD §20.4 + 4 D-12-10 additive + 1 D-12-10 theme peer-conditional
 * = 10 metodi totali (REVISIONE WARNING 1) + read-only `compatibilityPolicy` getter.
 *
 * Pattern carryover F11 `PermissionService` (read-only modes immutable post-install).
 */
export interface CompatService {
  // PRD §20.4 standard 5 API:
  readonly checkMicroFrontendCompatibility: (id: string) => CompatibilityReport
  readonly getCompatibilityReport: {
    (id: string): CompatibilityReport | undefined
    (): ReadonlyMap<string, CompatibilityReport>
  }
  readonly registerCanonicalModelVersion: (namespace: string, version: string) => void
  readonly registerTopicVersion: (topic: string, version: string) => void
  readonly registerRouteVersion: (routeId: string, version: string) => void
  // D-12-10 additive non-breaking 4 API:
  readonly registerWorkerVersion: (workerId: string, version: string) => void
  readonly registerLoaderVersion: (loaderType: string, version: string) => void
  readonly registerFrameworkVersion: (frameworkName: string, version: string) => void
  readonly registerDependencyVersion: (packageName: string, version: string) => void
  // D-12-10 additive theme peer-conditional 1 API (REVISIONE WARNING 1):
  // Setter sempre callable; semanticamente no-op se `@gluezero/theme` peer non installato.
  readonly registerThemeVersion: (kind: 'tokens' | 'roles', version: string) => void
  // Read-only introspection getter:
  readonly compatibilityPolicy: CompatibilityPolicy
}

/**
 * Factory `compatModule({compatibilityPolicy?})` — `BrokerModule` opt-in F12.
 *
 * Install pattern Service Locator F8 (D-12-13 carryover F11):
 *
 * 1. Lookup `SERVICE_MICROFRONTENDS` (deve essere installato PRIMA — throw chiaro se assente).
 * 2. Crea `version-registry` + `semver-checker` + `check-engine` (closure-captured, broker-scoped).
 * 3. Registra `SERVICE_COMPAT` con 10 metodi via `ctx.registerService('compat', service)`.
 * 4. Applica `wrapServiceWithCompat` su register/load/mount (OQ-1 service-wrap monkey-patch).
 * 5. Sottoscrive 4 lifecycle hooks via `wireLifecycleHooks` (OQ-2 dual + invalidate + cleanup).
 *
 * **Anti-singleton (D-30):** ogni call ritorna nuovo `BrokerModule` instance —
 * supporta multi-broker scenari + test isolation.
 *
 * @param options Setup-time options (default `compatibilityPolicy: 'warn'`).
 * @returns Nuovo `BrokerModule` con `install` che lookup `SERVICE_MICROFRONTENDS`,
 *   crea engine+registry, registra `SERVICE_COMPAT`, applica service-wrap + lifecycle hooks.
 *
 * @throws {Error} install error path — `@gluezero/compat requires @gluezero/microfrontends`
 *   se `microfrontendModule()` NON registrato PRIMA di `compatModule()` nell'array `modules`.
 *
 * @example Setup minimo (default policy `'warn'`)
 * ```typescript
 * import { createBroker } from '@gluezero/core'
 * import { microfrontendModule } from '@gluezero/microfrontends'
 * import { compatModule } from '@gluezero/compat'
 *
 * const broker = createBroker({
 *   modules: [microfrontendModule(), compatModule()],
 * })
 *
 * // Host seed version registry:
 * broker.getService('compat').registerCanonicalModelVersion('customer', '1.2.0')
 * ```
 *
 * @example Setup production (block-mount strict)
 * ```typescript
 * const broker = createBroker({
 *   modules: [
 *     microfrontendModule(),
 *     compatModule({ compatibilityPolicy: 'block-mount' }),
 *   ],
 * })
 * ```
 *
 * @example Anti-singleton — 2 broker indipendenti
 * ```typescript
 * const broker1 = createBroker({ modules: [microfrontendModule(), compatModule()] })
 * const broker2 = createBroker({ modules: [microfrontendModule(), compatModule()] })
 * // broker1 e broker2 hanno compat service separati con state isolato.
 * ```
 *
 * @example OQ-2 ordering F11+F12 (cross-fase doc)
 * ```typescript
 * const broker = createBroker({
 *   modules: [
 *     microfrontendModule(),
 *     permissionsModule({ capabilityPolicy: 'block-mount' }),
 *     compatModule({ compatibilityPolicy: 'block-mount' }),
 *   ],
 * })
 * // mount call: F12 compat check FIRST → if throw COMPAT_INCOMPATIBLE, F11 permission NON reached.
 * ```
 *
 * @see ROADMAP §Phase 12 — Compatibility/Versioning
 * @see D-12-11 minimal factory — single option compatibilityPolicy
 * @see D-12-13 Service Locator install carryover F11
 * @see OQ-1 service-wrap pattern (extended scope F12 vs F11)
 * @see OQ-2 dual subscribe lifecycle hooks (carryover F11)
 */
export function compatModule(options: CompatModuleOptions = {}): BrokerModule {
  const policy: CompatibilityPolicy = options.compatibilityPolicy ?? 'warn' // D-12-02 default
  return {
    id: 'compat',
    version: '2.0.0-alpha.0',
    install(ctx): void {
      // F8 Service Locator lookup + non-null capture (carryover F11 permissions-module.ts:132-141).
      const maybeMfService = ctx.broker.getService<MicroFrontendsService>(SERVICE_MICROFRONTENDS)
      if (!maybeMfService) {
        throw new Error(
          '@gluezero/compat requires @gluezero/microfrontends to be installed first. ' +
            'Add microfrontendModule() before compatModule() in the modules array.',
        )
      }
      // Cattura non-null stabile per le inner closures (TS narrowing della variabile
      // parent NON si propaga a nested function declarations).
      const mfService: MicroFrontendsService = maybeMfService

      // Crea pure logic stack W2 (broker-scoped singleton via closure):
      const versionRegistry = createVersionRegistry(ctx.broker)
      const checker = createSemverChecker()
      const engine: CheckEngine = createCheckEngine(
        mfService,
        versionRegistry,
        checker,
        ctx.broker,
        policy,
      )

      // Service API combinata (10 metodi + read-only policy getter — REVISIONE WARNING 1):
      const compatService: CompatService = {
        // PRD §20.4 standard 5 API:
        checkMicroFrontendCompatibility: engine.check,
        getCompatibilityReport: engine.getReport,
        registerCanonicalModelVersion: versionRegistry.registerCanonicalModelVersion,
        registerTopicVersion: versionRegistry.registerTopicVersion,
        registerRouteVersion: versionRegistry.registerRouteVersion,
        // D-12-10 additive non-breaking 4 API:
        registerWorkerVersion: versionRegistry.registerWorkerVersion,
        registerLoaderVersion: versionRegistry.registerLoaderVersion,
        registerFrameworkVersion: versionRegistry.registerFrameworkVersion,
        registerDependencyVersion: versionRegistry.registerDependencyVersion,
        // D-12-10 theme peer-conditional 1 API (REVISIONE WARNING 1):
        registerThemeVersion: versionRegistry.registerThemeVersion,
        // Read-only introspection getter:
        get compatibilityPolicy(): CompatibilityPolicy {
          return policy
        },
      }

      ctx.registerService(SERVICE_COMPAT, compatService)

      // OQ-1 carryover F11: service-wrap monkey-patch su register/load/mount (extended scope F12).
      wrapServiceWithCompat(mfService, engine, ctx.broker, policy)

      // OQ-2 carryover F11: 4 lifecycle hooks subscribe (dual bootstrapped/loaded +
      // version.changed invalidate + unregistered cleanup cascade D-V2-16).
      wireLifecycleHooks(ctx.broker, mfService, engine, versionRegistry, policy)
    },
  }
}
