/**
 * `MfIframeError` — Class error custom per scope `@gluezero/mf-iframe` (F15).
 *
 * Coverage decisione: D-V2-F15-12 (Custom error class per-package). Pattern carryover
 * F14 `MicroFrontendError` shape: `extends Error implements BrokerError`.
 *
 * Closure D-V2-09 BLOCKING: i 6 literal codes coprono tutti i security gates iframe
 * bridge (Valibot reject + replay + rate-limit + origin mismatch + sandbox + handshake
 * timeout).
 *
 * ## D-83 strict OCTUPLE
 *
 * F15 NON modifica `packages/microfrontends/src/microfrontend-error.ts`. F15 aggiunge
 * class opt-in in `@gluezero/mf-iframe/src/`.
 *
 * @see prd_2.0.0.md §26 — Iframe loader + bridge
 * @see prd_2.0.0.md §44 — Security iframe (Renwa Mar 2026 + CVE-2024-49038)
 * @see D-V2-F15-12 — Custom error class per-package
 * @see D-V2-F15-01/02/03/04 — Security gates D-V2-09 closure
 * @packageDocumentation
 */
import type { BrokerError, ErrorCategory } from '@gluezero/core'

/**
 * Codici errore specifici del loader iframe (`@gluezero/mf-iframe`).
 *
 * Union locale F15 (D-V2-F15-12) — chiude D-V2-09 BLOCKING (6 codici security gates).
 *
 * - `MF_IFRAME_BRIDGE_TIMEOUT`: handshake `gz:handshake` → `gz:ready` 9-step state machine
 *   non completa entro timeout.
 * - `MF_IFRAME_ORIGIN_MISMATCH`: messaggio postMessage da `event.origin` ≠ `expectedOrigin`
 *   (REQ MF-IFRAME-04 MANDATORY).
 * - `MF_IFRAME_SCHEMA_INVALID`: Valibot `v.strictObject()` reject (campo extra o tipo
 *   sbagliato) — D-V2-F15-01.
 * - `MF_IFRAME_REPLAY_DETECTED`: `messageId` già in LRU dedup OR `Math.abs(now - msg.timestamp)
 *   > 30000ms` — D-V2-F15-03 dual-defense.
 * - `MF_IFRAME_RATE_LIMITED`: 101st message in 1s window per mfId — D-V2-F15-04 drop +
 *   emit topic `microfrontend.iframe.bridge.rate-limited`.
 * - `MF_IFRAME_SANDBOX_DENIED`: sandbox policy violation (es. `allow-same-origin` richiesto
 *   ma policy host nega).
 *
 * @see D-V2-F15-01 (Valibot strict)
 * @see D-V2-F15-02 (LRU dedup 500 per (origin, mfId))
 * @see D-V2-F15-03 (Replay mitigation ID + timestamp 30s)
 * @see D-V2-F15-04 (Rate limit 100 msg/s drop + emit)
 * @see REQ MF-IFRAME-04 (expectedOrigin MANDATORY + targetOrigin '*' BANNED)
 */
export type MfIframeErrorCode =
  | 'MF_IFRAME_BRIDGE_TIMEOUT'
  | 'MF_IFRAME_ORIGIN_MISMATCH'
  | 'MF_IFRAME_SCHEMA_INVALID'
  | 'MF_IFRAME_REPLAY_DETECTED'
  | 'MF_IFRAME_RATE_LIMITED'
  | 'MF_IFRAME_SANDBOX_DENIED'

/**
 * Parametri Constructor per `MfIframeError`.
 *
 * `code` accetta `string` aperto per estensione futura; il type literal
 * `MfIframeErrorCode` è hint TS opzionale F15-scope.
 */
export interface CreateMfIframeErrorParams {
  readonly code: string | MfIframeErrorCode
  readonly message: string
  readonly microFrontendId?: string
  readonly origin?: string
  readonly details?: Record<string, unknown>
  readonly originalError?: Error
  readonly cause?: unknown
}

/**
 * Class `MfIframeError` extends Error con `BrokerError` shape inline.
 *
 * Campo `origin?` aggiuntivo (rispetto a `MfWebComponentError`) per supportare il payload
 * di topic emit `microfrontend.iframe.origin-mismatch` e `microfrontend.iframe.bridge.rate-limited`
 * dove l'origin scatenante è osservabile cross-frame.
 *
 * @example Throw origin mismatch
 * ```ts
 * throw new MfIframeError({
 *   code: 'MF_IFRAME_ORIGIN_MISMATCH',
 *   message: `Iframe message rejected — expected origin "${expected}", got "${event.origin}"`,
 *   microFrontendId: mfId,
 *   origin: event.origin,
 *   details: { expected, actual: event.origin },
 * })
 * ```
 *
 * @see D-V2-F15-12 — Custom error class per-package
 */
export class MfIframeError extends Error implements BrokerError {
  override readonly name = 'MfIframeError' as const
  readonly category: ErrorCategory = 'microfrontend'
  readonly code: string
  readonly microFrontendId?: string
  readonly origin?: string
  readonly details?: Record<string, unknown>
  readonly originalError?: Error

  constructor(params: CreateMfIframeErrorParams) {
    super(
      params.message,
      params.cause !== undefined ? { cause: params.cause } : undefined,
    )
    this.code = params.code
    if (params.microFrontendId !== undefined) this.microFrontendId = params.microFrontendId
    if (params.origin !== undefined) this.origin = params.origin
    if (params.details) this.details = params.details
    if (params.originalError) {
      this.originalError = params.originalError
      if (params.cause === undefined) {
        ;(this as { cause?: unknown }).cause = params.originalError
      }
    }
    Object.setPrototypeOf(this, MfIframeError.prototype)
  }
}

/**
 * Factory helper per costruire `MfIframeError` con shape coerente (carryover F11/F12/F13/F14
 * factory pattern + F15 mf-web-component `createMfWebComponentError`).
 *
 * Equivalente semantico di `new MfIframeError(params)` ma comoda per chiamate inline
 * dentro deep-handler `bridge.ts` / `iframe-loader.ts` senza `new`.
 *
 * @example
 * ```ts
 * throw createMfIframeError({
 *   code: 'MF_IFRAME_REPLAY_DETECTED',
 *   message: `Replay detected per mfId='${mfId}' messageId='${id}'`,
 *   microFrontendId: mfId,
 *   origin,
 *   details: { messageId: id },
 * })
 * ```
 *
 * @see D-V2-F15-12 — Custom error class per-package factory carryover
 */
export function createMfIframeError(params: CreateMfIframeErrorParams): MfIframeError {
  return new MfIframeError(params)
}
