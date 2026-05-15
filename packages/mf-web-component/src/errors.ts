/**
 * `MfWebComponentError` — Class error custom per scope `@gluezero/mf-web-component` (F15).
 *
 * Coverage decisione: D-V2-F15-12 (Custom error class per-package) — class indipendente
 * dalla `MicroFrontendError` F14 fallbacks per evitare cross-package coupling +
 * literal codes union locale W1 hint TS.
 *
 * ## Pattern carryover F14 MicroFrontendError + F9 mf-esm-error
 *
 * `BrokerError` (`@gluezero/core/types/error.ts`) è `interface` (NON class). Soluzione
 * carryover F14: `MfWebComponentError extends Error implements BrokerError` soddisfa il
 * contract via shape compatibility:
 *
 *  - `isBrokerError(err)` di core (duck-typing `code !== undefined && category !== undefined`)
 *    ritorna `true` per ogni istanza.
 *  - Tutti i campi richiesti (`category`, `code`, `message`, `details?`, `originalError?`)
 *    sono `readonly` sull'istanza.
 *
 * ## D-83 strict OCTUPLE
 *
 * F15 NON modifica `packages/microfrontends/src/microfrontend-error.ts` (F8
 * `createMfError` factory + 8-code union resta intoccato). F15 aggiunge class opt-in
 * in `@gluezero/mf-web-component/src/`. Stessa proibizione per `packages/core/`,
 * `packages/mapper/`, `packages/context/`, `packages/permissions/`, `packages/compat/`,
 * `packages/isolation/`, `packages/fallbacks/` (8 protected packages).
 *
 * @see prd_2.0.0.md §25 — Web Component Loader
 * @see D-V2-F15-12 — Custom error class per-package
 * @see packages/fallbacks/src/microfrontend-error.ts (F14 class pattern reference)
 * @see packages/mf-esm/src/mf-esm-error.ts (F9 factory pattern reference)
 * @packageDocumentation
 */
import type { BrokerError, ErrorCategory } from '@gluezero/core'

/**
 * Codici errore specifici del loader Web Component (`@gluezero/mf-web-component`).
 *
 * Union locale F15 (D-V2-F15-12) — NON aggiunta al union F8 `MicroFrontendErrorCode`
 * (D-83 strict octuple: F15 NON modifica `packages/microfrontends/src/`).
 *
 * - `MF_WC_DEFINE_TIMEOUT`: `customElements.whenDefined(elementName)` non risolve entro
 *   `timeoutMs` (default 15000 ms — carryover F9 D-V2-F9-01 pattern).
 * - `MF_WC_ALREADY_DEFINED`: warning-level — element già registrato cross-mount; reused
 *   via `customElements.get()` (D-V2-F15-08 reuse-on-collision NO throw, solo
 *   `console.warn`).
 * - `MF_WC_SCRIPT_LOAD_FAILED`: `import(definition.url)` fallisce (network/CSP/parse).
 * - `MF_WC_CONTEXT_MODE_INVALID`: `contextMode` non in `'property' | 'attribute' | 'event'`.
 *
 * @see D-V2-F15-05 (contextMode default property)
 * @see D-V2-F15-06 (whenDefined + AbortSignal.timeout)
 * @see D-V2-F15-07 (ESM-only via import(url))
 * @see D-V2-F15-08 (reuse-on-collision warning)
 */
export type MfWebComponentErrorCode =
  | 'MF_WC_DEFINE_TIMEOUT'
  | 'MF_WC_ALREADY_DEFINED'
  | 'MF_WC_SCRIPT_LOAD_FAILED'
  | 'MF_WC_CONTEXT_MODE_INVALID'

/**
 * Parametri Constructor per `MfWebComponentError`.
 *
 * `code` accetta `string` aperto per estensione futura; il type literal
 * `MfWebComponentErrorCode` è hint TS opzionale F15-scope.
 */
export interface CreateMfWebComponentErrorParams {
  readonly code: string | MfWebComponentErrorCode
  readonly message: string
  readonly microFrontendId?: string
  readonly details?: Record<string, unknown>
  readonly originalError?: Error
  readonly cause?: unknown
}

/**
 * Class `MfWebComponentError` extends Error con `BrokerError` shape inline.
 *
 * ES2022 `cause` propagato via `super(message, { cause })` quando definito.
 * `Object.setPrototypeOf(this, MfWebComponentError.prototype)` preserva la prototype
 * chain per `instanceof MfWebComponentError` cross-realm/cross-iframe.
 *
 * @example Throw timeout error nel loader
 * ```ts
 * throw new MfWebComponentError({
 *   code: 'MF_WC_DEFINE_TIMEOUT',
 *   message: `customElements.whenDefined("${elementName}") timeout dopo 15000 ms`,
 *   microFrontendId: definition.mfId,
 *   details: { elementName, timeoutMs: 15000 },
 * })
 * ```
 *
 * @see D-V2-F15-12 — Custom error class per-package
 */
export class MfWebComponentError extends Error implements BrokerError {
  override readonly name = 'MfWebComponentError' as const
  readonly category: ErrorCategory = 'microfrontend'
  readonly code: string
  readonly microFrontendId?: string
  readonly details?: Record<string, unknown>
  readonly originalError?: Error

  constructor(params: CreateMfWebComponentErrorParams) {
    super(
      params.message,
      params.cause !== undefined ? { cause: params.cause } : undefined,
    )
    this.code = params.code
    if (params.microFrontendId !== undefined) this.microFrontendId = params.microFrontendId
    if (params.details) this.details = params.details
    if (params.originalError) {
      this.originalError = params.originalError
      if (params.cause === undefined) {
        ;(this as { cause?: unknown }).cause = params.originalError
      }
    }
    Object.setPrototypeOf(this, MfWebComponentError.prototype)
  }
}
