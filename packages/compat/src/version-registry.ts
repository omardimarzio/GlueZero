/**
 * F12 Version Registry singleton broker-scoped — storage 9 dimensioni F12 (D-12-08).
 *
 * Cover REQ-IDs: MF-COMPAT-02 (partial — 8 setter publici PRD §20.4 + D-12-10 additive).
 *
 * **Storage (9 Map closure-captured):**
 * - 3 Map "registry standard" (PRD §20.4): `canonicalModels`, `topics`, `routes`.
 * - 4 Map "additive non-breaking" (D-12-10): `workers`, `loaders`, `framework`, `dependencies`.
 * - 1 Map opzionale (peer optional `@gluezero/theme`): `theme` (set via API specifica con
 *   discriminator `kind: 'tokens' | 'roles'`).
 *
 * Totale 8 setter pubblici (REVISIONE WARNING 1 plan 12-02):
 * 3 PRD §20.4 + 4 D-12-10 additive + 1 D-12-10 theme peer-conditional.
 *
 * **Emission behaviour (D-12-08):**
 * - `register*Version(key, value)` con `oldValue !== value` → emit topic
 *   `microfrontend.compatibility.version.changed` con payload
 *   `{dimension, key, oldVersion, newVersion, timestamp:Date.now()}`.
 * - re-register IDENTICO (`oldValue === value`) → NO emit (no-op idempotent).
 *
 * **Rule 1 fix W2:** nome topic `version-changed` → `version.changed` (dash → dot)
 * per conformare al broker validator regex `^[a-z][a-z0-9]*(\.[a-z][a-z0-9*]*)*$`
 * che vieta `-` nei segmenti. Pattern dot-only carryover F8 (`microfrontend.load.failed`).
 *
 * **Scope (D-12-08 lockato):**
 * - Storage in-memory, scoped al broker, lifetime broker-bound (Map sopravvivono al lifecycle MF).
 * - NO partizionamento per-MF (versioni = contratti globali condivisi tra tutti i MF).
 *
 * **REVISIONE WARNING 6 (plan 12-02):** il payload `version-changed` usa la chiave
 * `dimension` (NON `category`) per allinearsi alla RESEARCH §"Topic emission schema"
 * (linea 991). Internal helper parameter rinominato analogamente.
 *
 * **REVISIONE WARNING 8 (plan 12-02):** la source attribution `broker.publish` è
 * importata dall'internal module condiviso `./internal/compat-source` (NO literal
 * duplicato in-file).
 *
 * @see prd_2.0.0.md §20.4 — register*Version APIs (3 PRD + 4 D-12-10 additive + theme)
 * @see D-12-08 — Version registry shape + lifecycle
 * @see D-12-10 — Additive dimensions non-breaking
 * @see packages/permissions/src/capability-registry.ts (TEMPLATE F11 closure-state pattern)
 */
import type { Broker } from '@gluezero/core'
// REVISIONE WARNING 8: source attribution centralizzata in internal module condiviso.
import { COMPAT_PUBLISH_SOURCE } from './internal/compat-source'

/**
 * Public API Version Registry — 9 ReadonlyMap pubbliche + 8 setter pubblici.
 *
 * **Storage (readonly access):**
 * - `canonicalModels`, `topics`, `routes` (PRD §20.4 standard 3).
 * - `workers`, `loaders`, `framework`, `dependencies` (D-12-10 additive 4).
 * - `theme` (D-12-10 theme peer-conditional, key: `'tokens' | 'roles'`).
 *
 * **Setter (mutating + emit):**
 * Ogni setter chiama internamente `emit version-changed` su value diverso dal precedente.
 */
export interface VersionRegistry {
  readonly canonicalModels: ReadonlyMap<string, string>
  readonly topics: ReadonlyMap<string, string>
  readonly routes: ReadonlyMap<string, string>
  readonly workers: ReadonlyMap<string, string>
  readonly loaders: ReadonlyMap<string, string>
  readonly framework: ReadonlyMap<string, string>
  readonly dependencies: ReadonlyMap<string, string>
  readonly theme: ReadonlyMap<string, string>

  /** PRD §20.4 #3 — `canonicalModels` namespace → version. */
  registerCanonicalModelVersion(namespace: string, version: string): void
  /** PRD §20.4 #4 — `topics` topic name → version. */
  registerTopicVersion(topic: string, version: string): void
  /** PRD §20.4 #5 — `routes` route ID → version. */
  registerRouteVersion(routeId: string, version: string): void
  /** D-12-10 additive non-breaking — `workers` worker ID → version. */
  registerWorkerVersion(workerId: string, version: string): void
  /** D-12-10 additive non-breaking — `loaders` loader type → version. */
  registerLoaderVersion(loaderType: string, version: string): void
  /** D-12-10 additive non-breaking — `framework` name → version. */
  registerFrameworkVersion(name: string, version: string): void
  /** D-12-10 additive non-breaking — `dependencies` package name → version. */
  registerDependencyVersion(packageName: string, version: string): void
  /**
   * D-12-10 additive (peer optional `@gluezero/theme`) — `theme` kind ('tokens'|'roles') → version.
   *
   * Discriminator `kind` mantiene 2 entry separate in una singola Map: tokens version
   * + roles version. Consumer downstream (`check-engine` dim 6 theme) legge entrambi.
   */
  registerThemeVersion(kind: 'tokens' | 'roles', version: string): void
}

/**
 * Factory `VersionRegistry` — bind broker per emit topic + closure state immutabile.
 *
 * Pattern carryover F11 `createCapabilityRegistry(broker, policy)` (closure-captured
 * Map state non-exposed direct, accessibile solo via ReadonlyMap fields).
 *
 * @param broker Broker reference per emit `microfrontend.compatibility.version-changed`.
 * @returns `VersionRegistry` con 8 readonly Map + 8 setter pubblici.
 *
 * @example Setup standalone (test scope)
 * ```ts
 * const broker = createBroker({})
 * const registry = createVersionRegistry(broker)
 * registry.registerCanonicalModelVersion('customer', '1.2.0')
 * registry.canonicalModels.get('customer') // '1.2.0'
 * ```
 *
 * @example Re-register diverso emette topic
 * ```ts
 * const spy = vi.spyOn(broker, 'publish')
 * registry.registerCanonicalModelVersion('customer', '1.2.0')
 * registry.registerCanonicalModelVersion('customer', '1.3.0')
 * expect(spy).toHaveBeenCalledWith(
 *   'microfrontend.compatibility.version.changed',
 *   expect.objectContaining({ dimension: 'canonicalModels', key: 'customer',
 *                             oldVersion: '1.2.0', newVersion: '1.3.0' }),
 *   expect.any(Object),
 * )
 * ```
 *
 * @example Re-register identico è no-op (no emit)
 * ```ts
 * registry.registerCanonicalModelVersion('customer', '1.2.0')
 * registry.registerCanonicalModelVersion('customer', '1.2.0') // NO emit
 * ```
 *
 * @see prd_2.0.0.md §20.4 — register*Version APIs
 * @see D-12-08 — Version registry singleton broker-scoped
 */
export function createVersionRegistry(broker: Broker): VersionRegistry {
  // 8 Map closure-captured (D-12-10 — 3 PRD + 4 additive + 1 theme).
  const canonicalModels = new Map<string, string>()
  const topics = new Map<string, string>()
  const routes = new Map<string, string>()
  const workers = new Map<string, string>()
  const loaders = new Map<string, string>()
  const framework = new Map<string, string>()
  const dependencies = new Map<string, string>()
  const theme = new Map<string, string>()

  /**
   * Emit `microfrontend.compatibility.version.changed` con payload normalizzato.
   *
   * REVISIONE WARNING 6: il parametro è rinominato `dimension` (NON `category`)
   * per allinearsi al payload schema RESEARCH §"Topic emission schema".
   *
   * REVISIONE WARNING 8: la source attribution è importata dall'internal const
   * condiviso `COMPAT_PUBLISH_SOURCE`.
   *
   * **Rule 1 fix W2**: nome topic `version-changed` → `version.changed` (dash→dot)
   * per conformare a broker validator regex (vieta `-` nei segmenti).
   *
   * @internal
   */
  function emitVersionChanged(
    dimension: string,
    key: string,
    oldVersion: string | undefined,
    newVersion: string,
  ): void {
    broker.publish(
      'microfrontend.compatibility.version.changed',
      {
        dimension,
        key,
        oldVersion,
        newVersion,
        timestamp: Date.now(),
      },
      {
        source: COMPAT_PUBLISH_SOURCE,
        deliveryMode: 'sync' as const,
      } as never,
    )
  }

  /**
   * Builder che genera un setter idempotent + emit version-changed.
   *
   * Pattern: cattura Map + dimension nel closure; ritorna `(key, version) => void`.
   *
   * @param map Map storage target.
   * @param dimension Nome dimensione (used as payload key `dimension`).
   * @returns Setter function idempotent (no-op su value identico).
   * @internal
   */
  function makeSetter(
    map: Map<string, string>,
    dimension: string,
  ): (key: string, version: string) => void {
    return (key, version) => {
      const oldVersion = map.get(key)
      if (oldVersion === version) return // no-op idempotent (D-12-08).
      map.set(key, version)
      emitVersionChanged(dimension, key, oldVersion, version)
    }
  }

  return {
    canonicalModels,
    topics,
    routes,
    workers,
    loaders,
    framework,
    dependencies,
    theme,
    registerCanonicalModelVersion: makeSetter(canonicalModels, 'canonicalModels'),
    registerTopicVersion: makeSetter(topics, 'topics'),
    registerRouteVersion: makeSetter(routes, 'routes'),
    registerWorkerVersion: makeSetter(workers, 'workers'),
    registerLoaderVersion: makeSetter(loaders, 'loaders'),
    registerFrameworkVersion: makeSetter(framework, 'framework'),
    registerDependencyVersion: makeSetter(dependencies, 'dependencies'),
    registerThemeVersion: makeSetter(theme, 'theme'),
  }
}
