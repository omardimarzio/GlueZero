/**
 * MicroFrontendDescriptor type (PRD §11.2, MF-DESC-01).
 *
 * 15+ field interface: 3 mandatori (`id`/`name`/`version`) + 12+ opzionali.
 * Field placeholder F10-F14 lasciati `unknown` (effective validation in fasi target).
 * `metadata` open-ended `Record<string, unknown>` (CONTEXT.md specifics).
 *
 * Validation register-time strict via Valibot (D-V2-11): throw `MF_DESCRIPTOR_INVALID`.
 *
 * @see RESEARCH §4.1 + PATTERNS §24 + PRD §11.2 / §11.4 (id regex)
 */
import type { MicroFrontendContracts } from './contracts'
import type {
  MicroFrontendFailureReason,
  MicroFrontendState,
  MicroFrontendTimings,
} from './lifecycle'
import type { MicroFrontendMountDefinition } from './mount'

/** Owner descriptor (MF-DESC-02). */
export interface MicroFrontendOwner {
  readonly team?: string
  readonly contact?: string
  readonly repository?: string
  readonly documentation?: string
}

/** Loader definition (PRD §22). */
export interface MicroFrontendLoaderDefinition {
  /** 'esm' | 'web-component' | 'iframe' | 'module-federation' | 'single-spa' | custom */
  readonly type: string
  readonly url?: string
  readonly timeoutMs?: number
  readonly exportName?: string
  readonly options?: Readonly<Record<string, unknown>>
}

/** Mapping placeholder (effective F10). */
export interface MicroFrontendMapping {
  readonly namespace?: string
  readonly inputMap?: unknown // F10
  readonly outputMap?: unknown // F10
  readonly serverMap?: unknown // F10
  readonly contextMap?: unknown // F10
  readonly strict?: boolean
}

/**
 * Descriptor di un micro-frontend (PRD §11.2).
 *
 * Solo `id`/`name`/`version` mandatori (`id` regex `^[a-z0-9._-]+$` PRD §11.4).
 * Tutti gli altri field opzionali per consentire scenari incrementali.
 *
 * @example Shape minimale (3 field mandatori)
 * ```ts
 * const minimal: MicroFrontendDescriptor = {
 *   id: 'customer-dashboard',
 *   name: 'Customer Dashboard',
 *   version: '1.0.0',
 * }
 * ```
 *
 * @example Shape con loader + mount (scenario F8 standard)
 * ```ts
 * const withMount: MicroFrontendDescriptor = {
 *   id: 'analytics',
 *   name: 'Analytics MF',
 *   version: '2.1.0',
 *   loader: { type: 'esm', url: '/mfs/analytics.js', timeoutMs: 15000 },
 *   mount: { strategy: 'direct', selector: '#analytics-root', clearBeforeMount: true },
 * }
 * ```
 *
 * @see validateDescriptor — Valibot register-time strict
 * @see PRD §11.2 — 15+ field reference completo
 * @see PRD §11.4 — id regex spec
 */
export interface MicroFrontendDescriptor {
  /** Identificatore unico — regex `^[a-z0-9._-]+$` (PRD §11.4). */
  readonly id: string
  /** Nome display human-readable. */
  readonly name: string
  /** Versione SemVer 2.0 (`X.Y.Z[-pre][+build]`). */
  readonly version: string

  readonly description?: string
  readonly owner?: MicroFrontendOwner
  readonly loader?: MicroFrontendLoaderDefinition
  readonly mount?: MicroFrontendMountDefinition
  readonly contracts?: MicroFrontendContracts
  readonly mapping?: MicroFrontendMapping

  /** F11 — effective validation in `@gluezero/permissions`. */
  readonly capabilities?: unknown
  /** F11 — effective validation in `@gluezero/permissions`. */
  readonly permissions?: unknown
  /** F12 — effective validation in `@gluezero/compat`. */
  readonly compatibility?: unknown
  /** F13 — effective validation in `@gluezero/isolation`. */
  readonly isolation?: unknown
  /** F10 — effective validation in `@gluezero/context`. */
  readonly context?: unknown
  /** F13 — effective validation in `@gluezero/isolation` (theme). */
  readonly theme?: unknown
  /** F14 — effective validation in `@gluezero/fallbacks`. */
  readonly fallback?: unknown
  /** F16 — effective validation in `@gluezero/mf-devtools`. */
  readonly observability?: unknown

  /** Metadata open-ended consumer-provided (NO schema validation F8). */
  readonly metadata?: Record<string, unknown>
}

/**
 * Registrazione interna del MF (visibile via `getMicroFrontend`/`getMicroFrontends`).
 *
 * Contiene descriptor (immutable post-validation) + state mutable + tracking
 * timings/failureReason/loadedModule.
 *
 * @example
 * ```ts
 * const reg = service.get('my-mf')
 * if (reg) {
 *   console.log('Stato:', reg.state)
 *   console.log('Previous:', reg.previousState)
 *   if (reg.timings?.mountedAt) {
 *     console.log('Mounted at:', new Date(reg.timings.mountedAt))
 *   }
 * }
 * ```
 *
 * @see MicroFrontendsService.get — accessor pubblico
 * @see MicroFrontendsService.list — array snapshot
 */
export interface MicroFrontendRegistration {
  readonly descriptor: MicroFrontendDescriptor
  state: MicroFrontendState
  previousState?: MicroFrontendState
  failureReason?: MicroFrontendFailureReason
  timings?: MicroFrontendTimings
  /** Modulo runtime caricato dal loader (popolato da `loaded` state in poi). */
  loadedModule?: unknown
}
