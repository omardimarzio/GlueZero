// BrokerError — errore strutturato del broker (PRD §22, REQ ERR-01).
//
// Coverage ERR-01: il tipo enumera tutti gli 8 campi richiesti
// (`code`, `message` ereditato da Error, `category`, `details`, `originalError`,
// `routeId`, `topic`, `eventId`).
//
// `ErrorCategory` pre-dichiara anche le categorie popolate da F2-F5 (`mapping`, `route`,
// `network`, `worker`) — così non occorre breaking change quando arrivano i moduli relativi.
//
// `CreateBrokerErrorParams` è il tipo input per la factory `createBrokerError(...)`
// (implementazione in plan 04 — `errors.ts`). I campi sono mutabili al call-site (no `readonly`)
// perché il caller costruisce l'oggetto step-by-step; la factory poi ritorna un `BrokerError`
// immutabile (readonly su tutti i campi).

/**
 * Error category enum. Includes F2-F5 categories (`mapping`, `route`,
 * `network`, `worker`) so no breaking change is needed when those modules ship.
 */
export type ErrorCategory =
  | 'validation'
  | 'plugin'
  | 'mapping'
  | 'route'
  | 'network'
  | 'worker'
  | 'system'
  | 'config'
  | 'topic'

/**
 * Structured broker error (PRD §22, REQ ERR-01).
 *
 * Extends native `Error` with `code`, `category`, and optional `details`,
 * `originalError` (also set as `Error.cause` ES2022), `routeId`, `topic`,
 * `eventId`. All fields are readonly after creation (use {@link CreateBrokerErrorParams}
 * to build).
 */
export interface BrokerError extends Error {
  readonly code: string
  readonly category: ErrorCategory
  readonly details?: Record<string, unknown>
  readonly originalError?: Error
  readonly routeId?: string
  readonly topic?: string
  readonly eventId?: string
}

/** Input for the {@link createBrokerError} factory. Mutable at call-site (no `readonly`). */
export interface CreateBrokerErrorParams {
  code: string
  category: ErrorCategory
  message: string
  details?: Record<string, unknown>
  originalError?: Error
  routeId?: string
  topic?: string
  eventId?: string
}
