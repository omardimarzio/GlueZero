/**
 * `MicroFrontendError` — Class error custom per scope `@gluezero/fallbacks` (F14).
 *
 * Coverage REQ-ID: MF-FALLBACK-04 (MicroFrontendError shape + 5 codici hint type).
 *
 * Pattern divergente dai factory F11/F12/F13 (carryover):
 * - F11 `permission-error.ts`: factory `createPermissionError(params): BrokerError`
 * - F12 `compat-error.ts`: factory analogo
 * - F13 `types/errors.ts`: factory analogo
 * - **F14 `microfrontend-error.ts`: CLASS `extends Error`** (D-V2-F14-05) per supportare
 *   `instanceof MicroFrontendError` type narrowing devtools-friendly + cause ES2022
 *   propagation native.
 *
 * **BrokerError compat duck-typing**: `isBrokerError(value)` di core verifica
 * `value instanceof Error && code !== undefined && category !== undefined`. La class
 * `MicroFrontendError extends Error` con `readonly code` + `readonly category =
 * 'microfrontend'` passa nativamente il guard. Helper opt `toBrokerError()`
 * converte a plain shape (D-V2-F14-07).
 *
 * **D-83 strict septuple**: F14 NON modifica `packages/microfrontends/src/microfrontend-error.ts`
 * (F8 `createMfError` factory + 8-code union resta intoccato). F14 aggiunge class
 * opt-in in `@gluezero/fallbacks/src/`.
 *
 * @see prd_2.0.0.md §29.5 — MicroFrontendError shape
 * @see D-V2-F14-05 — Class divergente da factory carryover
 * @see D-V2-F14-07 — toBrokerError helper opt
 * @see packages/core/src/core/broker-error.ts (isBrokerError duck-typing reference)
 */
import type { BrokerError, ErrorCategory } from '@gluezero/core'
import type {
  MfFallbackErrorCode,
  MicroFrontendErrorLifecyclePhase,
} from './types/errors.js'

/**
 * Parametri Constructor per `MicroFrontendError`.
 *
 * `code` accetta `string` aperto (D-V2-F14-06) per estensione futura; il type
 * literal `MfFallbackErrorCode` è hint TS opzionale per F14-scope check chiamata.
 *
 * - `microFrontendId`: ID del MF interessato (sempre presente, scope F14).
 * - `lifecyclePhase`: phase 7-union F8 carryover (load|bootstrap|mount|runtime|update|unmount|destroy).
 * - `recoverable`: heuristic default true per load/bootstrap/mount/runtime/update; false per unmount/destroy.
 * - `details?`: payload aggiuntivo opzionale (target, attempt, threshold, etc.).
 * - `originalError?`: errore upstream catturato (loader / mount / runtime).
 * - `cause?`: ES2022 cause chain (se omesso, fallback su `originalError`).
 *
 * @see D-V2-F14-06 — code string aperto + MfFallbackErrorCode hint
 */
export interface CreateMicroFrontendErrorParams {
  readonly code: string | MfFallbackErrorCode
  readonly message: string
  readonly microFrontendId: string
  readonly lifecyclePhase: MicroFrontendErrorLifecyclePhase
  readonly recoverable: boolean
  readonly details?: Record<string, unknown>
  readonly originalError?: Error
  readonly cause?: unknown
}

/**
 * Class `MicroFrontendError` extends Error con `BrokerError` shape inline.
 *
 * Readonly fields (PRD §29.5):
 * - `category`: literal `'microfrontend'` (compat F8 union extension W1-P03).
 * - `code`: string aperto (hint type `MfFallbackErrorCode`).
 * - `microFrontendId`: ID del MF interessato.
 * - `lifecyclePhase`: phase 7-union F8 carryover.
 * - `recoverable`: heuristic default true per load/bootstrap/mount/runtime/update; false per unmount/destroy.
 * - `details?`, `originalError?`: opzionali.
 *
 * ES2022 `cause` propagato via `super(message, { cause })` quando definito. Se `cause`
 * omesso ma `originalError` presente, la class auto-popola `cause` da `originalError`
 * per preservare chain `Error.cause` cross-realm (debugger devtools-friendly).
 *
 * `Object.setPrototypeOf(this, MicroFrontendError.prototype)` preserva la prototype
 * chain per `instanceof MicroFrontendError` cross-realm/cross-iframe (carryover
 * pattern es-pre-class custom error WHATWG ricetta).
 *
 * @example Throw runtime error mounting handler
 * ```ts
 * throw new MicroFrontendError({
 *   code: 'MF_FALLBACK_TARGET_NOT_FOUND',
 *   message: `MF "mf-x" mount target #app not found in DOM`,
 *   microFrontendId: 'mf-x',
 *   lifecyclePhase: 'mount',
 *   recoverable: true,
 *   details: { target: '#app' },
 * })
 * ```
 *
 * @example Cause propagation ES2022 chain
 * ```ts
 * try { await loader.load() } catch (originalError) {
 *   throw new MicroFrontendError({
 *     code: 'MF_RETRY_EXHAUSTED',
 *     message: `MF "mf-x" load exhausted after 3 attempts`,
 *     microFrontendId: 'mf-x',
 *     lifecyclePhase: 'load',
 *     recoverable: false,
 *     originalError, // automaticamente propagato come cause ES2022
 *   })
 * }
 * ```
 */
export class MicroFrontendError extends Error implements BrokerError {
  override readonly name = 'MicroFrontendError' as const
  readonly category: ErrorCategory = 'microfrontend'
  readonly code: string
  readonly microFrontendId: string
  readonly lifecyclePhase: MicroFrontendErrorLifecyclePhase
  readonly recoverable: boolean
  readonly details?: Record<string, unknown>
  readonly originalError?: Error

  constructor(params: CreateMicroFrontendErrorParams) {
    super(
      params.message,
      params.cause !== undefined ? { cause: params.cause } : undefined,
    )
    this.code = params.code
    this.microFrontendId = params.microFrontendId
    this.lifecyclePhase = params.lifecyclePhase
    this.recoverable = params.recoverable
    if (params.details) this.details = params.details
    if (params.originalError) {
      this.originalError = params.originalError
      // Se cause non explicit, usa originalError come cause (ES2022 chain)
      if (params.cause === undefined) {
        ;(this as { cause?: unknown }).cause = params.originalError
      }
    }
    // Preserve prototype chain per instanceof cross-realm
    Object.setPrototypeOf(this, MicroFrontendError.prototype)
  }

  /**
   * Converte istanza a plain `BrokerError` shape (D-V2-F14-07 helper opt).
   *
   * Note: `isBrokerError(this)` già ritorna `true` via duck-typing — helper opt-in
   * per consumer che necessitano shape non-class (es. structured clone in postMessage,
   * serializzazione JSON.stringify-safe via spread).
   *
   * @returns Oggetto plain con shape `BrokerError` (preservato `code`, `category`,
   *   `details?`, `originalError?` — escluso `microFrontendId`/`lifecyclePhase`/`recoverable`
   *   che son F14-specific extension).
   */
  toBrokerError(): BrokerError {
    return {
      name: 'BrokerError',
      message: this.message,
      code: this.code,
      category: this.category,
      ...(this.details && { details: this.details }),
      ...(this.originalError && { originalError: this.originalError }),
    } as BrokerError
  }
}
