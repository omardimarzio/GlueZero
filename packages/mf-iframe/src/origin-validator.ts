/**
 * `origin-validator.ts` — Helper centralized per `expectedOrigin` MANDATORY enforcement
 * + `targetOrigin '*'` ban runtime assert dual-defense (REQ MF-IFRAME-04 lockato — closure
 * D-V2-09 BLOCKING T-15-04..T-15-05).
 *
 * ## REQ MF-IFRAME-04 — expectedOrigin MANDATORY
 *
 * `IframeLoaderDefinition.expectedOrigin: string` (NO `?`) — type-level enforcement
 * via TypeScript. Runtime assert backup tramite `validateExpectedOrigin()` (defensive
 * — catch caso `as unknown as Definition` bypass type-checking).
 *
 * ## REQ MF-IFRAME-04 — targetOrigin '*' BANNED
 *
 * `iframe.contentWindow.postMessage(msg, '*')` è BANNED in tutto il codebase F15.
 * Dual-defense:
 *  - **PRIMARY (runtime)**: `validateTargetOrigin()` runtime assert throw `MF_IFRAME_ORIGIN_MISMATCH`
 *    se `targetOrigin === '*'` o vuoto.
 *  - **SECONDARY (planner-time)**: ESLint custom rule (Biome custom rule opt-in) —
 *    deferred a P05 closure gates (planner-time micro-decision).
 *
 * Runtime PRIMARY è always-on (covered by tests `origin-validator.test.ts`). ESLint
 * SECONDARY è additional defense-in-depth ma non necessaria per closure D-V2-09 — il
 * runtime già sufficiente.
 *
 * @see REQ MF-IFRAME-04 — expectedOrigin MANDATORY + targetOrigin '*' BANNED
 * @see D-V2-F15-01..04 — Security gates D-V2-09 closure
 * @see prd_2.0.0.md §44 — Security iframe (Renwa Mar 2026)
 */
import { MfIframeError } from './errors'

/**
 * Valida che `expectedOrigin` sia uno string non-empty e non `'*'` (REQ MF-IFRAME-04).
 *
 * Defensive runtime assert backup di type-level enforcement (`expectedOrigin: string`
 * MANDATORY non-optional in `IframeLoaderDefinition`).
 *
 * @param expectedOrigin - Valore da validare.
 * @param mfId - microFrontendId per error context.
 * @throws `MfIframeError` con `code: 'MF_IFRAME_ORIGIN_MISMATCH'` se invalid.
 *
 * @example
 * ```ts
 * validateExpectedOrigin('https://iframe.example.com', 'mf-x') // ok
 * validateExpectedOrigin(undefined, 'mf-x') // throws
 * validateExpectedOrigin('*', 'mf-x')        // throws (wildcard banned)
 * ```
 */
export function validateExpectedOrigin(
  expectedOrigin: string | undefined,
  mfId: string,
): asserts expectedOrigin is string {
  if (!expectedOrigin || typeof expectedOrigin !== 'string') {
    throw new MfIframeError({
      code: 'MF_IFRAME_ORIGIN_MISMATCH',
      message: `expectedOrigin mancante o non-string per mfId='${mfId}' — REQ MF-IFRAME-04 MANDATORY.`,
      microFrontendId: mfId,
      details: { reason: 'expectedOrigin required', received: String(expectedOrigin) },
    })
  }
  if (expectedOrigin === '*') {
    throw new MfIframeError({
      code: 'MF_IFRAME_ORIGIN_MISMATCH',
      message: `expectedOrigin '*' BANNED per mfId='${mfId}' — REQ MF-IFRAME-04 wildcard ban. Usa origin specifico (es. 'https://iframe.example.com').`,
      microFrontendId: mfId,
      details: { reason: 'wildcard banned', received: '*' },
    })
  }
}

/**
 * Valida che `targetOrigin` (per `iframe.contentWindow.postMessage(msg, targetOrigin)`)
 * NON sia `'*'` o vuoto (REQ MF-IFRAME-04 dual-defense runtime PRIMARY).
 *
 * Chiamato prima di ogni `postMessage` sendMessage helper (`bridge.ts`). Throw immediato
 * se viola.
 *
 * @param targetOrigin - Valore da validare.
 * @param mfId - microFrontendId per error context.
 * @throws `MfIframeError` con `code: 'MF_IFRAME_ORIGIN_MISMATCH'` se invalid.
 *
 * @example
 * ```ts
 * validateTargetOrigin('https://iframe.example.com', 'mf-x') // ok
 * validateTargetOrigin('*', 'mf-x')        // throws
 * validateTargetOrigin('', 'mf-x')         // throws
 * ```
 */
export function validateTargetOrigin(targetOrigin: string, mfId: string): void {
  if (!targetOrigin || typeof targetOrigin !== 'string') {
    throw new MfIframeError({
      code: 'MF_IFRAME_ORIGIN_MISMATCH',
      message: `targetOrigin mancante o non-string per mfId='${mfId}' — REQ MF-IFRAME-04 MANDATORY.`,
      microFrontendId: mfId,
      details: { reason: 'targetOrigin required', received: String(targetOrigin) },
    })
  }
  if (targetOrigin === '*') {
    throw new MfIframeError({
      code: 'MF_IFRAME_ORIGIN_MISMATCH',
      message: `targetOrigin '*' BANNED per mfId='${mfId}' — REQ MF-IFRAME-04 wildcard ban runtime dual-defense.`,
      microFrontendId: mfId,
      origin: '*',
      details: { reason: 'wildcard banned at runtime', received: '*' },
    })
  }
}
