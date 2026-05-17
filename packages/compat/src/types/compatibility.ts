/**
 * Descriptor di compatibilità multi-dimensione (PRD §20.3) — 9 dimensioni semver.
 *
 * Ogni MF dichiara opzionalmente in `descriptor.compatibility` un sottoinsieme delle
 * 9 dimensioni. Le dimensioni non dichiarate sono skippate silenziosamente (D-12 default).
 *
 * Le 9 dimensioni:
 * 1. `gluezero` — scalar range vs `__GLUEZERO_VERSION__` build-time (es. `'^2.0.0'`).
 * 2. `canonicalModels` — `Record<modelKey, range>` vs version registry registrato via
 *    `broker.registerCanonicalModelVersion(namespace, version)` (D-12-06).
 * 3. `topics` — `Record<topicName, range>` vs version registry registrato via
 *    `broker.registerTopicVersion(topic, version)`.
 * 4. `routes` — `Record<routeId, range>` vs version registry registrato via
 *    `broker.registerRouteVersion(routeId, version)`.
 * 5. `workers` — `Record<workerId, range>` vs Map registrata (derivata da worker registry F5 o
 *    compat-specific API; research/plan W2 decide).
 * 6. `theme` — `{ tokens?, roles? }` object con scalar ranges vs `@gluezero/theme` v1.1
 *    (peer optional D-12-07).
 * 7. `loaders` — `Record<loaderType, range>` per loader installato (`@gluezero/mf-esm`, ...).
 * 8. `framework` — `{ name, version? }` object dichiarativo (no register API runtime; warning se
 *    framework non installato o version mismatch).
 * 9. `dependencies` — `Record<package, range>` per shared deps host (es. `react: '19.0.0'`).
 *
 * Tutte le chiavi sono `readonly` + opzionali — adoption progressiva.
 *
 * @see prd_2.0.0.md §20.3 — Compatibility descriptor shape
 * @see prd_2.0.0.md §20.4 — register*Version APIs
 */
export interface MicroFrontendCompatibility {
  readonly gluezero?: string
  readonly canonicalModels?: Readonly<Record<string, string>>
  readonly topics?: Readonly<Record<string, string>>
  readonly routes?: Readonly<Record<string, string>>
  readonly workers?: Readonly<Record<string, string>>
  readonly theme?: {
    readonly tokens?: string
    readonly roles?: string
  }
  readonly loaders?: Readonly<Record<string, string>>
  readonly framework?: {
    readonly name: string
    readonly version?: string
  }
  readonly dependencies?: Readonly<Record<string, string>>
}
