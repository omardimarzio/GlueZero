/**
 * Barrel re-export tutti i tipi pubblici di `@gluezero/microfrontends`.
 *
 * @packageDocumentation
 */

export type {
  MicroFrontendDescriptor,
  MicroFrontendLoaderDefinition,
  MicroFrontendMapping,
  MicroFrontendOwner,
  MicroFrontendRegistration,
} from './descriptor'

export type {
  MicroFrontendFailurePhase,
  MicroFrontendFailureReason,
  MicroFrontendState,
  MicroFrontendTimings,
} from './lifecycle'
export { ALLOWED_TRANSITIONS, transitionAllowed } from './lifecycle'

export type {
  MicroFrontendMountDefinition,
  MountStrategy,
} from './mount'

export type {
  ContextContract,
  ContractDirection,
  ContractValidationPolicy,
  MicroFrontendContracts,
  RouteContract,
  ThemeContract,
  TopicContract,
  WorkerContract,
} from './contracts'

export type {
  MicroFrontendEventHandler,
  MicroFrontendPublishOptions,
  MicroFrontendRuntimeContext,
  MicroFrontendRuntimeModule,
} from './runtime-context'

export type {
  MicroFrontendErrorEventPayload,
  MicroFrontendLifecycleEventPayload,
} from './events'
