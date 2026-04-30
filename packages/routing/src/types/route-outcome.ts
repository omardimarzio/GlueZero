// RouteOutcome — risultato discriminato dell'esecuzione di una route F3 (PRD §17,
// §22.3, REQ ROUTE-12, ERR-02 ext, D-80, D-82).
//
// Riferimento decisioni (03-CONTEXT.md):
// - D-80: il gateway pubblica `<topic>.failed` UNA volta su errore (NO double publish).
// - D-82: durante i retry intermedi nessun outcome viene emesso; solo il finale.
// - Pattern analogo a `ValidationResult` di F2 (validator-adapter.ts) — discriminated
//   union `{ ok: true } | { ok: false }`.
//
// Vincolo `exactOptionalPropertyTypes: true`: tutti i campi opzionali sono
// `readonly X?: T` (mai `readonly X: T | undefined`).

import type { BrokerError } from '@sembridge/core'

/**
 * Metadata opzionale popolato dall'esecuzione (success branch).
 *
 * - `httpStatus` — status HTTP della response che ha generato l'outcome (se route http).
 * - `attemptCount` — numero di attempt totali eseguiti (1 = success al primo tentativo).
 * - `origin` — `'cache'` se servito da cache, `'remote'` se da rete.
 */
export interface RouteOutcomeMetadata {
  readonly httpStatus?: number
  readonly attemptCount?: number
  readonly origin?: 'cache' | 'remote'
}

/**
 * Outcome discriminato dell'esecuzione di una route (D-80, D-82).
 *
 * - Success branch: payload canonico pronto per publish a `<topic>.loaded` (F2 step 11
 *   applicherà l'`inputMap` consumer).
 * - Error branch: `BrokerError` con `code` da `GatewayErrorCode` (D-80), pronto per
 *   publish a `<topic>.failed`.
 *
 * @example
 * ```ts
 * const outcome: RouteOutcome = { ok: true, canonicalPayload: data, routeId: 'weather-http' }
 * if (!outcome.ok) console.error(outcome.error.code)
 * ```
 */
export type RouteOutcome =
  | {
      readonly ok: true
      readonly canonicalPayload: unknown
      readonly routeId: string
      readonly metadata?: RouteOutcomeMetadata
    }
  | {
      readonly ok: false
      readonly error: BrokerError
      readonly routeId: string
    }

/**
 * Alias per il branch success di `RouteOutcome` (utile per assertion in test e per
 * helper che processano solo il caso success).
 */
export type RouteResult = Extract<RouteOutcome, { ok: true }>

/**
 * Alias per il branch error di `RouteOutcome` (utile per assertion in test e per
 * helper che processano solo il caso error).
 */
export type RouteError = Extract<RouteOutcome, { ok: false }>
