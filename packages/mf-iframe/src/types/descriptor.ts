/**
 * `IframeLoaderDefinition` — Type narrowing F8 `MicroFrontendLoaderDefinition`
 * con `type: 'iframe'` discriminator literal + campi iframe-specific.
 *
 * **`expectedOrigin` MANDATORY non-optional** (REQ MF-IFRAME-04 lockato — type-level
 * enforcement). Closure D-V2-09 BLOCKING.
 *
 * Carryover stretto F14 fallbacks types/ (NO `declare module '@gluezero/microfrontends'`
 * upstream — D-V2-F15-19 Pattern S1 stretto).
 *
 * @see REQ MF-IFRAME-04 — expectedOrigin MANDATORY + targetOrigin '*' BANNED
 * @see REQ MF-SEC-01 — Sandbox baseline (allow-scripts solo se necessario; NO allow-same-origin default)
 * @see D-V2-F15-01..04 — Security gates D-V2-09 closure
 * @see PRD §26 — Iframe Loader + Bridge
 */
import type { MicroFrontendLoaderDefinition } from '@gluezero/microfrontends'

/**
 * Loader definition narrowing per `type: 'iframe'`.
 *
 * W2 P03 fill: contract completo + JSDoc per ognuno dei 6 field.
 */
export interface IframeLoaderDefinition extends MicroFrontendLoaderDefinition {
  /** Discriminator literal — narrowing TS. */
  readonly type: 'iframe'

  /** URL pagina iframe (relative o absolute). */
  readonly url: string

  /**
   * Sandbox token list (PRD §26 + REQ MF-SEC-01). Default minimo `'allow-scripts'` solo
   * se necessario. **NON usare `'allow-same-origin'`** in default — viola containment.
   * Esempio: `'allow-scripts allow-forms'`.
   */
  readonly sandbox?: string

  /** Allow token list per Permissions Policy (es. `'camera; microphone'`). */
  readonly allow?: string

  /**
   * Origin atteso per i messaggi postMessage cross-frame — **MANDATORY** (REQ MF-IFRAME-04
   * lockato, D-V2-09 closure). I messaggi da `event.origin ≠ expectedOrigin` vengono
   * rejected con `MfIframeError({code: 'MF_IFRAME_ORIGIN_MISMATCH'})` + emit topic
   * `microfrontend.iframe.origin-mismatch`.
   */
  readonly expectedOrigin: string

  /**
   * Abilita bridge postMessage 9 message types (default true).
   * Se false → iframe loader carica solo (no bridge), MF code deve gestire IO direttamente.
   */
  readonly bridge?: boolean
}
