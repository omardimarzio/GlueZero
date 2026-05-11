/**
 * MicroFrontend contracts types (PRD §15.2, MF-CONTRACT-01).
 *
 * 6 contract types per dichiarare i punti di interazione del MF con il broker:
 * topics, routes, workers, contexts, theme. Validazione pre-mount con policy
 * `warn` | `fail-registration` | `fail-mount` (MF-CONTRACT-02).
 *
 * F8 stub tipologico — validation completa in F11/F13.
 *
 * @see RESEARCH §13.W4 + PATTERNS §27
 */

export type ContractDirection = 'publish' | 'subscribe' | 'both'

export interface TopicContract {
  readonly topic: string
  readonly direction: ContractDirection
  readonly description?: string
  readonly schemaId?: string // canonical schema reference (F2)
}

export interface RouteContract {
  readonly id: string
  readonly pattern: string
  readonly direction: 'request' | 'handler'
  readonly description?: string
}

export interface WorkerContract {
  readonly id: string
  readonly direction: 'register' | 'consume'
  readonly description?: string
}

export interface ContextContract {
  readonly key: string
  readonly access: 'read' | 'write' | 'both'
  readonly description?: string
}

export interface ThemeContract {
  readonly requires?: readonly string[] // theme tokens richiesti
  readonly provides?: readonly string[] // theme tokens forniti
  readonly description?: string
}

/** Policy di validation contratti (MF-CONTRACT-02). */
export type ContractValidationPolicy =
  | 'warn'
  | 'fail-registration'
  | 'fail-mount'

/** Aggregato contratti del descriptor. */
export interface MicroFrontendContracts {
  readonly topics?: readonly TopicContract[]
  readonly routes?: readonly RouteContract[]
  readonly workers?: readonly WorkerContract[]
  readonly contexts?: readonly ContextContract[]
  readonly theme?: ThemeContract
  /** Policy applicata; default `'warn'` (F8). */
  readonly validation?: ContractValidationPolicy
}
