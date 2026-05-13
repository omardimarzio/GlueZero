/**
 * `@gluezero/compat` — Compatibility/versioning module semver multi-dimensione (9 dim).
 *
 * Fase 12 v2.0.0 (5 REQ-ID: MF-COMPAT-01..05 + MF-PKG-01..04).
 *
 * Modulo opt-in `BrokerModule` che verifica via semver il contratto dichiarato di ogni
 * MicroFrontend (`descriptor.compatibility`, 9 dimensioni — PRD §20.3) contro le versioni
 * runtime registrate sul broker (host-app authoritative source via `register*Version()` API).
 *
 * Install esplicito via:
 * ```typescript
 * createBroker({ modules: [microfrontendModule(), compatModule({ compatibilityPolicy: 'warn' })] })
 * ```
 *
 * Surface pubblica popolata progressivamente dalle wave W2-W3 della Phase 12:
 * - W1 (Plan 12-01): scaffolding ESM-only multi-entry + Pattern S1 augment marker
 *   + types files PRD §20.3/§20.5/§20.6 + internal `__GLUEZERO_VERSION__` declaration
 * - W2 (Plan 12-02): semver-checker + version-registry + check-engine + compat-error + topics
 * - W2 (Plan 12-03): compat-module factory + policy-dispatch + enforcement-points + lifecycle-hooks
 * - W3 (Plan 12-04+05): Tier-1 jsdom closure + README italiano + JSDoc enrichment + bundle gate
 *
 * Vincoli (carryover F11 + divergenze F12):
 * - Bundle ≤ 9 KB gzipped INCLUSO `semver@^7.7.4` tree-shaken (MF-COMPAT-05)
 * - Pattern S1 augment stretto NO declare module / NO Broker.prototype (D-V2-F11-17)
 * - Tier-1 jsdom only — NO Tier-3 Playwright (MF-TEST-01)
 * - D-83 strict triple esteso v2.0: zero diff `packages/{core,microfrontends,mapper,permissions}/src/`
 * - NESSUN peer `@gluezero/permissions` (OQ-7: F12 ortogonale runtime a F11)
 *
 * **Barrel hygiene W3 (plan 12-03 closure)**: internal helpers (`enforcement-points`,
 * `lifecycle-hooks`, `policy-dispatch`, `semver-checker`, `internal/*`) NON sono
 * re-esportati — accessibili solo internamente al modulo. Audit-grep verifica
 * post-build che `wrapServiceWithCompat`, `wireLifecycleHooks`, `enforceCompatPolicy`,
 * `createSemverChecker` NON appaiano nelle Object.keys del barrel.
 *
 * @example Install minimo (default policy `'warn'`)
 * ```typescript
 * import { createBroker } from '@gluezero/core'
 * import { microfrontendModule } from '@gluezero/microfrontends'
 * import { compatModule } from '@gluezero/compat'
 *
 * const broker = createBroker({
 *   modules: [microfrontendModule(), compatModule()],
 * })
 * ```
 *
 * @packageDocumentation
 * @see prd_2.0.0.md §20 — Compatibility/versioning module
 */

// Side-effect import — Pattern S1 stretto intent signaling (D-V2-F11-17 carryover).
// Forza il bundler a preservare augment.ts come side-effect.
import './augment'

// Augment marker (audit-grep tree-shake fail detection).
export { __compatAugmentLoaded } from './augment'

// ===== Types public — PRD §20 interfaces =====
export type {
  MicroFrontendCompatibility,
  CompatibilityIssueType,
  CompatibilityIssue,
  CompatibilityReport,
  CompatibilityPolicy,
  CompatAwareMfDescriptor,
} from './types'

export { getCompatibility } from './types'

// ===== Build-time version constant (OQ-5 resolution) =====
// Re-export del literal injection `__GLUEZERO_VERSION__` (esbuild `define`) via alias
// pubblico `GLUEZERO_VERSION`. esbuild sostituisce letteralmente l'identifier
// `__GLUEZERO_VERSION__` al build-time con la stringa JSON-escaped (default `"2.0.0"`,
// override via env var GLUEZERO_VERSION in CI/changesets).
// Verifica empirica W1: `grep '"2.0.0"' packages/compat/dist/index.js` PASS.
import { GLUEZERO_BUILD_VERSION } from './internal/gluezero-version'

/**
 * Versione corrente di `@gluezero/core` runtime — constant build-time iniettata da tsup
 * `define`. Usata da `check-engine.ts` (W2) per la dim `gluezero` semver satisfies check.
 *
 * @see RESEARCH.md §3 — OQ-5 resolution rationale (tsup define vs runtime read)
 * @see prd_2.0.0.md §20.3 — dim `gluezero` semver range
 */
export const GLUEZERO_VERSION: string = GLUEZERO_BUILD_VERSION

// ===== Topics (local literal + reuse F8 governance — plan 12-02) =====
export { MF_COMPAT_TOPICS } from './topics'
export type { CompatTopic } from './topics'

// ===== Error factory + topic emit helper (plan 12-02) =====
export {
  createCompatError,
  publishCompatTopics,
  type CreateCompatErrorParams,
  type CompatErrorCode,
  type CompatibilityPhase,
} from './compat-error'

// ===== Check engine (plan 12-02) =====
export { createCheckEngine, type CheckEngine } from './check-engine'

// ===== Version registry (plan 12-02) =====
export { createVersionRegistry, type VersionRegistry } from './version-registry'

// ===== BrokerModule factory + install (plan 12-03 W3) =====
export { compatModule } from './compat-module'
export type { CompatModuleOptions, CompatService } from './compat-module'

// Internal helpers NON esposti (audit-grep gate barrel hygiene):
// - enforcement-points (wrapServiceWithCompat)
// - lifecycle-hooks (wireLifecycleHooks)
// - policy-dispatch (enforceCompatPolicy)
// - semver-checker (createSemverChecker)
// - internal/* (COMPAT_PUBLISH_SOURCE, GLUEZERO_BUILD_VERSION non re-export diretto)
