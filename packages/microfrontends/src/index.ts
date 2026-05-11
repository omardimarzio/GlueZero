/**
 * @gluezero/microfrontends — Micro-frontend governance layer (v2.0).
 *
 * Registry MF + Lifecycle FSM 14 stati + 4 mount strategies + 17+7+5 standard topics
 * + EventTap MF-ready pre-instrumentato. Opt-in module extension runtime via
 * `createBroker({ modules: [microfrontendModule()] })`.
 *
 * Vincoli:
 * - Bundle ≤ 12 KB gzipped (D-V2-F8-05)
 * - Pattern S1 augment opt-in via `import '@gluezero/microfrontends/augment'` (D-V2-01)
 * - Subscription tracking via ownerId convention `mf:${id}` (D-V2-16)
 *
 * Surface pubblica popolata progressivamente dalle wave W2-W6 della Phase 8:
 * - W2: descriptor types + Valibot validator + Registry + ServiceLocator + Pattern S1 augment
 * - W3: Lifecycle FSM 14 stati + idempotency `inFlight: Map<id, Promise>`
 * - W4: Mount orchestrator 4 strategies + Contracts validator + Loader Registry concreta
 * - W5: 17+7+5 standard topics + payload shapes + Runtime context facade + MOCK loader
 * - W6: README italiano completo + JSDoc + bundle gate finale
 *
 * @packageDocumentation
 */

// Side-effect import — Pattern S1 declaration merging (D-V2-01).
// Forza il bundler a preservare augment.ts come side-effect (T-F8-08 mitigation).
import './augment'

// Augment marker (T-F8-08 tree-shake fail detection)
export { __mfAugmentLoaded } from './augment'
// Contracts Validator (W4 — MF-CONTRACT-02)
export {
  type ContractValidationContext,
  type ContractValidationResult,
  type ContractWarning,
  type ContractWarningSeverity,
  type ValidationPhase,
  validateContracts,
} from './contracts-validator'
// Helper internal owner-id (audit-friendly grep `mfOwnerId(`)
export { MF_OWNER_PREFIX, mfOwnerId } from './internal/owner-id'
// Lifecycle FSM (W3-P06)
export { type LifecycleFailureContext, LifecycleManager } from './lifecycle-fsm'
// Loader Registry types
export {
  type LoadedModule,
  type LoaderContext,
  LoaderRegistry,
  type MicroFrontendLoaderAdapter,
} from './loader-registry'
// ===== Runtime exports =====
export { createMfError, type MicroFrontendErrorCode } from './microfrontend-error'
export { microfrontendModule } from './microfrontend-module'
// Mount Orchestrator (W4 — barrel export ownership 08-09 per fix M1 plan-check iter 1)
// Implementazione in packages/microfrontends/src/mount-orchestrator.ts (creato da 08-08).
// 08-08 deliberatamente NON modifica index.ts (file ownership disgiunta entro stessa wave).
export { type MountResult, orchestrateMount } from './mount-orchestrator'
// Registry + Service interface
export {
  createMicroFrontendsService,
  type LifecycleOp,
  type ListFilter,
  type LoadOptions,
  type MicroFrontendDebugSnapshot,
  type MicroFrontendsService,
  type MountOptions,
} from './registry'

// Tutti i types pubblici (re-export dal barrel types/)
export {
  ALLOWED_TRANSITIONS,
  type ContextContract,
  type ContractDirection,
  type ContractValidationPolicy,
  type MicroFrontendContracts,
  type MicroFrontendDescriptor,
  type MicroFrontendErrorEventPayload,
  type MicroFrontendEventHandler,
  type MicroFrontendFailurePhase,
  type MicroFrontendFailureReason,
  type MicroFrontendLifecycleEventPayload,
  type MicroFrontendLoaderDefinition,
  type MicroFrontendMapping,
  type MicroFrontendMountDefinition,
  type MicroFrontendOwner,
  type MicroFrontendPublishOptions,
  type MicroFrontendRegistration,
  type MicroFrontendRuntimeContext,
  type MicroFrontendRuntimeModule,
  type MicroFrontendState,
  type MicroFrontendTimings,
  type MountStrategy,
  type RouteContract,
  type ThemeContract,
  type TopicContract,
  transitionAllowed,
  type WorkerContract,
} from './types'
