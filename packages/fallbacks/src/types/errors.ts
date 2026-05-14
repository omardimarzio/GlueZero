/**
 * F14 error codes + lifecycle phase union (D-V2-F14-06 hint type locale).
 *
 * Coverage REQ-ID parziale: MF-FALLBACK-04 (MicroFrontendError class skeleton — hint
 * codici W1, class implementation W2 P02).
 *
 * @see prd_2.0.0.md §29.5 — MicroFrontendError shape
 * @see D-V2-F14-06 — Hint type literal locale (NO estende MicroFrontendErrorCode F8)
 */

/**
 * `MfFallbackErrorCode` — Codici errore F14-locali (hint TS, NON enforced runtime).
 *
 * Constructor `MicroFrontendError` accetta `code: string` aperto per estensione
 * futura. Questa union è hint informativo per consumer che vogliono vincolare
 * `code` a un set chiuso F14-scope.
 *
 * **D-V2-F14-06**: NON estende `MicroFrontendErrorCode` di F8 (D-83 strict septuple
 * block diff `packages/microfrontends/src/`). I 5 codici coprono lo scope F14:
 *
 * - `MF_FALLBACK_RENDER_FAILED`: render handler (html/component/event/custom) throw.
 * - `MF_RETRY_EXHAUSTED`: `RetryPolicy.attempts` saturati senza success.
 * - `MF_CIRCUIT_OPEN`: tentato lifecycle phase mentre circuit breaker in stato `open`.
 * - `MF_FALLBACK_TARGET_NOT_FOUND`: target DOM element non risolvibile (html-renderer).
 * - `MF_FALLBACK_COMPONENT_NO_ADAPTER`: `type:'component'` ma `SERVICE_FRAMEWORK_ADAPTER` F15 assente.
 *
 * @see D-V2-F14-06 — Hint type literal locale
 * @see prd_2.0.0.md §29.5 — MicroFrontendError shape
 */
export type MfFallbackErrorCode =
  | 'MF_FALLBACK_RENDER_FAILED'
  | 'MF_RETRY_EXHAUSTED'
  | 'MF_CIRCUIT_OPEN'
  | 'MF_FALLBACK_TARGET_NOT_FOUND'
  | 'MF_FALLBACK_COMPONENT_NO_ADAPTER'

/**
 * Lifecycle phase union F14 (7 phases F8 carryover).
 *
 * Coerente con F8 `MF_ERROR_TOPICS` array literal (`microfrontend.{phase}.failed`
 * per ognuno dei 7 phase). Usato in `MicroFrontendError.lifecyclePhase` field +
 * `MicroFrontendFallbackPolicy.onXError` scope mapping (W2 P04 orchestrator).
 *
 * @see packages/microfrontends/src/topics.ts MF_ERROR_TOPICS literal
 */
export type MicroFrontendErrorLifecyclePhase =
  | 'load'
  | 'bootstrap'
  | 'mount'
  | 'runtime'
  | 'update'
  | 'unmount'
  | 'destroy'
