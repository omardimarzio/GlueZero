/**
 * MicroFrontend error factory (MF-DESC-03, MF-LIFE-02, etc.).
 *
 * Wrapper di `createBrokerError` (`@gluezero/core`) con:
 * - `category: 'microfrontend'` fisso (literal esteso in ErrorCategory union da 08-03 Task 4)
 * - `MicroFrontendErrorCode` typed union (8 codes audit-friendly)
 *
 * F8 NON definisce custom class (vs `extends BrokerError`) — deferred F14
 * FallbackPolicy. F8 stub solo factory + code union.
 *
 * @see RESEARCH §4.2 + PATTERNS §38
 * @see packages/core/src/types/error.ts ErrorCategory union (esteso in 08-03 Task 4 con 'microfrontend' literal)
 */
import { type BrokerError, createBrokerError, type ErrorCategory } from '@gluezero/core'

/** Codes errore MF — typed union audit-friendly. */
export type MicroFrontendErrorCode =
  | 'MF_DESCRIPTOR_INVALID'
  | 'MF_STATE_INVALID'
  | 'MF_NOT_REGISTERED'
  | 'MF_LIFECYCLE_IN_FLIGHT'
  | 'MF_LOADER_NOT_FOUND'
  | 'MF_LOADER_TYPE_DUPLICATE'
  | 'MF_LOADER_INVALID_MODULE'
  | 'MF_MOUNT_TARGET_NOT_FOUND'

export interface CreateMfErrorParams {
  readonly code: MicroFrontendErrorCode
  readonly message: string
  readonly details?: Record<string, unknown>
  readonly originalError?: Error
}

/**
 * Factory per `MicroFrontendError` (wrapper di `BrokerError` con category fisso).
 *
 * @example Throw error in validator
 * ```ts
 * throw createMfError({
 *   code: 'MF_DESCRIPTOR_INVALID',
 *   message: 'Invalid id: must match /^[a-z0-9._-]+$/',
 *   details: { field: 'id', reason: 'regex mismatch' },
 * })
 * ```
 *
 * @example Wrap original error in lifecycle op
 * ```ts
 * try {
 *   await loader.load(def, ctx)
 * } catch (err) {
 *   throw createMfError({
 *     code: 'MF_LOADER_INVALID_MODULE',
 *     message: `Loader ${def.type} failed`,
 *     details: { mfId: 'demo', type: def.type },
 *     originalError: err as Error,
 *   })
 * }
 * ```
 *
 * @throws Mai — la factory ritorna sempre. È chi chiama che `throw createMfError(...)`.
 *
 * @see createBrokerError — wrapper sottostante in `@gluezero/core`
 * @see MicroFrontendErrorCode — 8 codes audit-friendly union
 */
export function createMfError(params: CreateMfErrorParams): BrokerError {
  return createBrokerError({
    code: params.code,
    // 'microfrontend' literal nel ErrorCategory union (08-03 Task 4 estensione additive).
    // Type-safe: cast diretto al literal, no double-cast necessario (fix B1 iter 2).
    category: 'microfrontend' as ErrorCategory,
    message: params.message,
    ...(params.details && { details: params.details }),
    ...(params.originalError && { originalError: params.originalError }),
  })
}
