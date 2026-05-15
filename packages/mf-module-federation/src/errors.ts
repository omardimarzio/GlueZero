/**
 * `MfModuleFederationError` — Class error custom per scope `@gluezero/mf-module-federation` (F15).
 *
 * Coverage decisione: D-V2-F15-12 (Custom error class per-package). 5 literal codes union
 * REQ MF-MF-02 lockato.
 *
 * ## D-83 strict OCTUPLE
 *
 * F15 NON modifica `packages/microfrontends/src/microfrontend-error.ts`. F15 aggiunge
 * class opt-in in `@gluezero/mf-module-federation/src/`.
 *
 * @see prd_2.0.0.md §24 — Module Federation Loader (experimental @0.x.0)
 * @see D-V2-F15-12 — Custom error class per-package
 * @see REQ MF-MF-02 — 5 error codes literal union
 * @packageDocumentation
 */
import type { BrokerError, ErrorCategory } from '@gluezero/core'

/**
 * Codici errore specifici del loader Module Federation (`@gluezero/mf-module-federation`).
 *
 * Union locale F15 (D-V2-F15-12) — REQ MF-MF-02 lockato.
 *
 * - `MF_REMOTE_ENTRY_LOAD_FAILED`: fetch `remoteEntry.js` fallita (network/404/CSP).
 * - `MF_REMOTE_SCOPE_NOT_FOUND`: scope completamente assente in host shared section
 *   (NON version mismatch — D-V2-F15-10 riserva quel caso per warn+proceed).
 * - `MF_REMOTE_MODULE_NOT_FOUND`: `loadRemote(scope/module)` ritorna undefined.
 * - `MF_REMOTE_FACTORY_FAILED`: factory invocation lancia exception runtime.
 * - `MF_SHARE_SCOPE_FAILED`: scope NOT FOUND in host (es. host non ha shared section).
 *
 * @see D-V2-F15-09 (webpack-only V2.0 GA)
 * @see D-V2-F15-10 (share scope conflict warn + proceed — NON usa MF_SHARE_SCOPE_FAILED)
 */
export type MfModuleFederationErrorCode =
  | 'MF_REMOTE_ENTRY_LOAD_FAILED'
  | 'MF_REMOTE_SCOPE_NOT_FOUND'
  | 'MF_REMOTE_MODULE_NOT_FOUND'
  | 'MF_REMOTE_FACTORY_FAILED'
  | 'MF_SHARE_SCOPE_FAILED'

/**
 * Parametri Constructor per `MfModuleFederationError`.
 */
export interface CreateMfModuleFederationErrorParams {
  readonly code: string | MfModuleFederationErrorCode
  readonly message: string
  readonly microFrontendId?: string
  readonly scope?: string
  readonly module?: string
  readonly details?: Record<string, unknown>
  readonly originalError?: Error
  readonly cause?: unknown
}

/**
 * Class `MfModuleFederationError` extends Error con `BrokerError` shape inline.
 *
 * Campi `scope?` + `module?` aggiuntivi per identificare quale remote/scope/module ha
 * scatenato l'errore — utile per debugging multi-remote setup.
 *
 * @example Throw remote entry load failure
 * ```ts
 * throw new MfModuleFederationError({
 *   code: 'MF_REMOTE_ENTRY_LOAD_FAILED',
 *   message: `Failed to load remoteEntry.js for scope "${scope}" from "${url}"`,
 *   microFrontendId: mfId,
 *   scope,
 *   details: { url, status: 404 },
 * })
 * ```
 *
 * @see D-V2-F15-12 — Custom error class per-package
 */
export class MfModuleFederationError extends Error implements BrokerError {
  override readonly name = 'MfModuleFederationError' as const
  readonly category: ErrorCategory = 'microfrontend'
  readonly code: string
  readonly microFrontendId?: string
  readonly scope?: string
  readonly module?: string
  readonly details?: Record<string, unknown>
  readonly originalError?: Error

  constructor(params: CreateMfModuleFederationErrorParams) {
    super(
      params.message,
      params.cause !== undefined ? { cause: params.cause } : undefined,
    )
    this.code = params.code
    if (params.microFrontendId !== undefined) this.microFrontendId = params.microFrontendId
    if (params.scope !== undefined) this.scope = params.scope
    if (params.module !== undefined) this.module = params.module
    if (params.details) this.details = params.details
    if (params.originalError) {
      this.originalError = params.originalError
      if (params.cause === undefined) {
        ;(this as { cause?: unknown }).cause = params.originalError
      }
    }
    Object.setPrototypeOf(this, MfModuleFederationError.prototype)
  }
}
