/**
 * Barrel public types `@gluezero/isolation/types`.
 *
 * Re-export type-only per i 5 file `types/`:
 * - `policy.ts`: MicroFrontendIsolationPolicy 7-key + ResolvedIsolationPolicy + DEFAULT_ISOLATION_POLICY
 * - `theme-policy.ts`: MicroFrontendThemePolicy 8-key
 * - `facades.ts`: StorageFacade / GatewayFacade / WorkerFacade / ThemeFacade + IsolationResolvers
 * - `descriptor-augment.ts`: IsolationAwareMfDescriptor + getIsolation/getThemePolicy helpers
 * - `context-augment.ts`: declaration merging MicroFrontendRuntimeContext (5 optional fields)
 * - `errors.ts`: createIsolationPolicyError factory + IsolationPolicyErrorCode union
 */

// Types pure
export type {
  MicroFrontendIsolationPolicy,
  ResolvedIsolationPolicy,
} from './policy.js'
export { DEFAULT_ISOLATION_POLICY } from './policy.js'

export type { MicroFrontendThemePolicy } from './theme-policy.js'

export type {
  StorageFacade,
  GatewayRequestOptions,
  GatewayFacade,
  WorkerRunOptions,
  WorkerFacade,
  ThemeFacade,
  IsolationResolvers,
} from './facades.js'

export type { IsolationAwareMfDescriptor } from './descriptor-augment.js'
export { getIsolation, getThemePolicy } from './descriptor-augment.js'

// Declaration merging side-effect (forza inclusione `context-augment.ts`).
import './context-augment.js'

// Error factory + codes
export {
  createIsolationPolicyError,
  type CreateIsolationPolicyErrorParams,
  type IsolationPolicyErrorCode,
  type IsolationPolicyErrorContext,
  MF_ISOLATION_WARNING,
} from './errors.js'
