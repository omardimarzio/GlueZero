/**
 * `MfSingleSpaError` — Class error custom per scope `@gluezero/mf-single-spa` (F15).
 *
 * Coverage decisione: D-V2-F15-12 (Custom error class per-package). 4 literal codes union
 * coverage lifecycle phases single-spa.
 *
 * ## D-83 strict OCTUPLE
 *
 * F15 NON modifica `packages/microfrontends/src/microfrontend-error.ts`. F15 aggiunge
 * class opt-in in `@gluezero/mf-single-spa/src/`.
 *
 * @see prd_2.0.0.md §27 — single-spa Adapter (experimental @0.x.0)
 * @see D-V2-F15-12 — Custom error class per-package
 * @see D-V2-F15-11 — Peer dep single-spa@^5.9.0 || ^6.0.0
 * @packageDocumentation
 */
import type { BrokerError, ErrorCategory } from '@gluezero/core'

/**
 * Codici errore specifici del loader single-spa (`@gluezero/mf-single-spa`).
 *
 * Union locale F15 (D-V2-F15-12) — 4 phases lifecycle.
 *
 * - `MF_SS_LIFECYCLE_INVALID`: modulo non-conforming a single-spa contract (manca
 *   `bootstrap`/`mount`/`unmount` o non sono functions).
 * - `MF_SS_BOOTSTRAP_FAILED`: invocation `bootstrap(props)` throw.
 * - `MF_SS_MOUNT_FAILED`: invocation `mount(props)` throw.
 * - `MF_SS_UNMOUNT_FAILED`: invocation `unmount(props)` throw.
 *
 * @see D-V2-F15-11 (peer single-spa ^5.9.0 || ^6.0.0)
 */
export type MfSingleSpaErrorCode =
  | 'MF_SS_LIFECYCLE_INVALID'
  | 'MF_SS_BOOTSTRAP_FAILED'
  | 'MF_SS_MOUNT_FAILED'
  | 'MF_SS_UNMOUNT_FAILED'

/**
 * Parametri Constructor per `MfSingleSpaError`.
 */
export interface CreateMfSingleSpaErrorParams {
  readonly code: string | MfSingleSpaErrorCode
  readonly message: string
  readonly microFrontendId?: string
  readonly appName?: string
  readonly details?: Record<string, unknown>
  readonly originalError?: Error
  readonly cause?: unknown
}

/**
 * Class `MfSingleSpaError` extends Error con `BrokerError` shape inline.
 *
 * Campo `appName?` aggiuntivo per identificare l'app single-spa scatenante l'errore.
 *
 * @example Throw lifecycle invalid
 * ```ts
 * throw new MfSingleSpaError({
 *   code: 'MF_SS_LIFECYCLE_INVALID',
 *   message: `Module does not export single-spa bootstrap/mount/unmount lifecycle`,
 *   microFrontendId: mfId,
 *   appName: definition.appName,
 *   details: { hasLifecycle: { bootstrap: false, mount: true, unmount: true } },
 * })
 * ```
 *
 * @example Throw mount failed con cause chain ES2022
 * ```ts
 * try {
 *   await app.mount(props)
 * } catch (err) {
 *   throw new MfSingleSpaError({
 *     code: 'MF_SS_MOUNT_FAILED',
 *     message: `single-spa mount() invocation failed for ${appName}`,
 *     microFrontendId: mfId,
 *     appName,
 *     cause: err,
 *   })
 * }
 * ```
 *
 * @throws Il constructor non throw; popula `code/microFrontendId/appName/details/originalError`
 *   e setta `cause` ES2022 se `params.cause` definito o auto-alias `originalError`.
 * @throws Tipicamente il caller fa `throw new MfSingleSpaError(...)` direttamente
 *   (vedi `ss-loader.ts` lifecycle wrapper error mapping per ognuno dei 4 codes).
 * @throws `MfSingleSpaError` istanza è marker per `isBrokerError(err)` duck-typing
 *   compat (D-V2-F15-12 BrokerError shape inline preserved).
 *
 * @see D-V2-F15-12 — Custom error class per-package
 * @see createMfSingleSpaError — factory helper coerente
 * @see REQ MF-SS-01 — Lifecycle mapping + 4 phase error codes
 */
export class MfSingleSpaError extends Error implements BrokerError {
  override readonly name = 'MfSingleSpaError' as const
  readonly category: ErrorCategory = 'microfrontend'
  readonly code: string
  readonly microFrontendId?: string
  readonly appName?: string
  readonly details?: Record<string, unknown>
  readonly originalError?: Error

  constructor(params: CreateMfSingleSpaErrorParams) {
    super(
      params.message,
      params.cause !== undefined ? { cause: params.cause } : undefined,
    )
    this.code = params.code
    if (params.microFrontendId !== undefined) this.microFrontendId = params.microFrontendId
    if (params.appName !== undefined) this.appName = params.appName
    if (params.details) this.details = params.details
    if (params.originalError) {
      this.originalError = params.originalError
      if (params.cause === undefined) {
        ;(this as { cause?: unknown }).cause = params.originalError
      }
    }
    Object.setPrototypeOf(this, MfSingleSpaError.prototype)
  }
}

/**
 * Factory helper per costruire `MfSingleSpaError` con shape coerente (carryover
 * F11/F12/F13/F14 + F15 mf-iframe `createMfIframeError`).
 *
 * Equivalente semantico di `new MfSingleSpaError(params)` ma comoda per chiamate inline
 * dentro `ss-loader.ts` senza `new`.
 *
 * @example Throw mount failed
 * ```ts
 * throw createMfSingleSpaError({
 *   code: 'MF_SS_MOUNT_FAILED',
 *   message: `single-spa mount() invocation failed`,
 *   microFrontendId: mfId,
 *   appName,
 *   originalError: err,
 * })
 * ```
 *
 * @example Throw lifecycle invalid (no bootstrap function)
 * ```ts
 * throw createMfSingleSpaError({
 *   code: 'MF_SS_LIFECYCLE_INVALID',
 *   message: 'Module does not export valid bootstrap/mount/unmount functions',
 *   microFrontendId: mfId,
 *   appName,
 *   details: { hasBootstrap: false, hasMount: true, hasUnmount: false },
 * })
 * ```
 *
 * @throws La factory stessa NON throw; ritorna l'istanza di errore — il caller deve
 *   poi `throw` esplicito secondo necessità nel flow lifecycle (4 codes: LIFECYCLE_INVALID,
 *   BOOTSTRAP_FAILED, MOUNT_FAILED, UNMOUNT_FAILED).
 * @throws `MfSingleSpaError` ritornata può a sua volta essere rilanciata dal chiamante;
 *   istanza preserva `code` literal + `microFrontendId` + `appName` + `details` rich
 *   diagnostic.
 *
 * @see D-V2-F15-12 — Custom error class per-package factory carryover
 * @see MfSingleSpaError — class constructor identico
 * @see REQ MF-SS-01 — Lifecycle mapping + 4 error codes
 */
export function createMfSingleSpaError(
  params: CreateMfSingleSpaErrorParams,
): MfSingleSpaError {
  return new MfSingleSpaError(params)
}
