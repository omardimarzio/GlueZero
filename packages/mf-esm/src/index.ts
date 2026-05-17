/**
 * `@gluezero/mf-esm` — ESM dynamic import loader per micro-frontends GlueZero v2.0.
 *
 * Loader concreto che implementa `MicroFrontendLoaderAdapter` con `type: 'esm'`,
 * carica MF via `import(url)` dinamico con `AbortSignal.timeout(timeoutMs)` (default
 * 15000 ms da PRD §23.4) e normalizza l'export a `MicroFrontendRuntimeModule` con
 * smart fallback priority (exportName → default → named flat → throw
 * `MF_LOADER_INVALID_MODULE`, PRD §23.5).
 *
 * Surface pubblica popolata progressivamente dalle wave W2-W3 della Phase 9:
 * - W1 (Plan 09-01): scaffolding ESM-only multi-entry + Pattern S1 augment marker
 * - W2 (Plan 09-02): `createMfEsmError` + `MfEsmErrorCode` union locale
 * - W2 (Plan 09-03): `esmLoader` LoaderAdapter + internal helpers (normalize + signal compose)
 * - W2 (Plan 09-04): `mfEsmModule()` BrokerModule factory + barrel fill
 * - W3 (Plan 09-05): Tier-3 Playwright Chromium 3 scenari + README + JSDoc closure
 *
 * Vincoli:
 * - Bundle ≤ 3 KB gzipped (D-V2-F9-18)
 * - Pattern S1 augment opt-in via `import '@gluezero/mf-esm/augment'` (D-V2-F9-01)
 * - NO prototype Broker augment (D-V2-F9-02 — `service.load(id)` /
 *   `broker.loadMicroFrontend(id)` da microfrontends/augment coprono già la DX)
 * - D-83 strict carryover esteso v2.0: zero diff `packages/core/src/` +
 *   `packages/microfrontends/src/`
 *
 * Internal helpers NON esportati dal barrel (D-V2-F9-11):
 * - signal-compose helper (`./internal/`) — consumato solo da esm-loader
 * - module-shape normalizer (`./normalize.ts`) — consumato solo da esm-loader
 *
 * @example Quick start
 * ```ts
 * import { createBroker } from '@gluezero/core'
 * import { microfrontendModule } from '@gluezero/microfrontends'
 * import { mfEsmModule } from '@gluezero/mf-esm'
 *
 * const broker = createBroker({
 *   modules: [microfrontendModule(), mfEsmModule()],
 * })
 * ```
 *
 * @packageDocumentation
 * @see PRD §22 (Loader Registry API), §23 (ESM loader §23.1-§23.5), §6.4 (Pattern S1)
 */

// Side-effect import — Pattern S1 intent signaling (D-V2-F9-01 + D-V2-F9-02 stretto).
// Forza il bundler a preservare augment.ts come side-effect (T-F9-01 mitigation).
import './augment'

// Augment marker (T-F9-01 tree-shake fail detection).
export { __mfEsmAugmentLoaded } from './augment'

// ===== Runtime exports (Wave 2 — Plan 09-02 + 09-03 + 09-04) =====

// ESM loader concreto (Plan 09-03)
export { esmLoader } from './esm-loader'

// BrokerModule factory install lookup service (Plan 09-04 — D-V2-F9-01)
export { mfEsmModule } from './mf-esm-module'

// Error factory + types pubblici (Plan 09-02 — D-V2-F9-12)
export {
  type CreateMfEsmErrorParams,
  createMfEsmError,
  type MfEsmErrorCode,
} from './mf-esm-error'
