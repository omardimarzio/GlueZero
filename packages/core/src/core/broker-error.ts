// Factory + type guard per BrokerError (PRD §22, REQ ERR-01).
//
// `createBrokerError` costruisce un Error nativo (instanceof Error mantenuto) arricchito
// con i campi del contratto BrokerError. Conditional assignment per i campi opzionali:
// `exactOptionalPropertyTypes: true` distingue tra "campo assente" e "campo undefined",
// quindi NON valorizziamo proprietà se non fornite (Test 4 verifica `'details' in err === false`).
//
// `Error.cause` (ES2022) viene settato quando `originalError` è fornito — questo è il pattern
// canonico per chaining di errori senza perdere lo stack del cause.
//
// `isBrokerError` type guard runtime: distingue BrokerError da un Error generico controllando
// la presenza di `code` e `category` (entrambi non-undefined) sull'istanza Error.

import type { BrokerError, CreateBrokerErrorParams } from '../types/error'

// MutableBrokerError — alias mutable usato solo internamente alla factory per costruire l'oggetto
// step-by-step. Il tipo di ritorno pubblico resta `BrokerError` (readonly) — il caller non vede
// mai il cast e non può mutare i campi dopo la creazione (compile-time enforcement).
type MutableBrokerError = {
  -readonly [K in keyof BrokerError]: BrokerError[K]
} & { cause?: unknown }

/**
 * Create a {@link BrokerError} with the given parameters.
 *
 * Returns a native `Error` (instanceof Error preserved) enriched with the
 * BrokerError contract fields. `Error.cause` (ES2022) is set when
 * `originalError` is provided — canonical pattern for chaining errors without
 * losing the cause stack.
 *
 * @param params - Error parameters: `code`, `category`, `message` + optional fields
 *   (`details`, `originalError`, `routeId`, `topic`, `eventId`).
 * @returns A {@link BrokerError} instance (Error subclass, readonly fields).
 *
 * @example
 * ```ts
 * throw createBrokerError({
 *   code: 'topic.invalid',
 *   category: 'topic',
 *   message: `Invalid topic name: "${topic}"`,
 *   details: { topic },
 * })
 * ```
 */
export function createBrokerError(params: CreateBrokerErrorParams): BrokerError {
  const err = new Error(params.message) as Error as MutableBrokerError
  err.name = 'BrokerError'
  err.code = params.code
  err.category = params.category
  if (params.details) err.details = params.details
  if (params.originalError) {
    err.originalError = params.originalError
    err.cause = params.originalError
  }
  if (params.routeId) err.routeId = params.routeId
  if (params.topic) err.topic = params.topic
  if (params.eventId) err.eventId = params.eventId
  return err as BrokerError
}

/**
 * Type guard for {@link BrokerError}.
 *
 * Distinguishes a `BrokerError` from a generic `Error` by checking for the
 * presence of `code` and `category` fields (both non-undefined).
 *
 * @param value - Any value to test.
 * @returns `true` if the value is an `Error` with `code` and `category` properties.
 *
 * @example
 * ```ts
 * try {
 *   broker.publish('Invalid.Topic', {}, { source: { type: 'plugin', id: 'p' } })
 * } catch (err) {
 *   if (isBrokerError(err)) {
 *     console.log(err.code, err.category, err.details)
 *   }
 * }
 * ```
 */
export function isBrokerError(value: unknown): value is BrokerError {
  return (
    value instanceof Error &&
    (value as BrokerError).code !== undefined &&
    (value as BrokerError).category !== undefined
  )
}
