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
 * - D-83 strict triple esteso v2.0: zero diff `packages/{core,microfrontends,mapper}/src/`
 * - NESSUN peer `@gluezero/permissions` (OQ-7: F12 ortogonale runtime a F11)
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

// ===== W2 placeholder (completato in plan 12-02 + 12-03) =====
// export { MF_COMPAT_TOPICS, type CompatTopic } from './topics'
// export { createCompatError, publishCompatTopics } from './compat-error'
// export { createCheckEngine, type CheckEngine } from './check-engine'
// export { createVersionRegistry, type VersionRegistry } from './version-registry'
// export { compatModule } from './compat-module'
// export type { CompatModuleOptions, CompatService } from './compat-module'
