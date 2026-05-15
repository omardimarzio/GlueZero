/**
 * `@gluezero/mf-iframe/client` — Subpath separato per code che gira **dentro** l'iframe
 * (MF-IFRAME-05 lockato).
 *
 * Scope V2.0: postMessage wrapper minimal per MF code in-iframe. **NO broker completo
 * esposto cross-frame** — bridge surface ridotta a publish/subscribe + context get/update
 * + lifecycle.
 *
 * Skeleton stub W1 — body W2 P03 implementation (handshake protocol + Valibot v.parse
 * client-side validation + message envelope construction + dispatcher).
 *
 * @see REQ MF-IFRAME-05 — subpath separato (no broker completo cross-frame)
 * @see PRD §26 — Iframe Loader + Bridge
 * @see D-V2-F15-01 — Valibot strict-only client + host
 * @packageDocumentation
 */

/**
 * Marker placeholder export per attw/publint subpath validation W1.
 *
 * W2 P03 sostituirà con surface pubblica reale (handshake/publish/subscribe/lifecycle
 * helpers wrapper postMessage).
 *
 * @see REQ MF-IFRAME-05
 */
export const __mfIframeClientLoaded: true = true
