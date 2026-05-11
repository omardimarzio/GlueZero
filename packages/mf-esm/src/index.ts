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
 * - W2 (Plan 09-03/09-04): esm-loader core + mfEsmModule install + error factory
 * - W3 (Plan 09-05): Tier-3 Playwright Chromium 3 scenari + README + JSDoc closure
 *
 * Vincoli:
 * - Bundle ≤ 3 KB gzipped (D-V2-F9-18)
 * - Pattern S1 augment opt-in via `import '@gluezero/mf-esm/augment'` (D-V2-F9-01)
 * - NO `Broker.prototype` augment (D-V2-F9-02 — `service.load(id)` / `broker.loadMicroFrontend(id)` da microfrontends/augment coprono già la DX)
 * - D-83 strict carryover esteso v2.0: zero diff `packages/core/src/` + `packages/microfrontends/src/`
 *
 * @packageDocumentation
 * @see PRD §22 (Loader Registry API), §23 (ESM loader §23.1-§23.5), §6.4 (Pattern S1)
 */

// Side-effect import — Pattern S1 declaration merging (D-V2-F9-01).
// Forza il bundler a preservare augment.ts come side-effect (T-F9-01 mitigation).
import './augment'

// Augment marker (T-F9-01 tree-shake fail detection).
export { __mfEsmAugmentLoaded } from './augment'

// ===== Runtime exports (stub — popolati in Wave 2 Plan 09-03/09-04) =====
// TODO Wave 2 (Plan 09-03): export { esmLoader } from './esm-loader'
// TODO Wave 2 (Plan 09-04): export { mfEsmModule } from './mf-esm-module'
// TODO Wave 2 (Plan 09-04): export { createMfEsmError, type MfEsmErrorCode, type CreateMfEsmErrorParams } from './mf-esm-error'

export {}
