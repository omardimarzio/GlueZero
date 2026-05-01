// retry-after-parser.ts — Parse RFC 7231 §7.1.3 `Retry-After` header.
//
// Riferimento decisioni (03-CONTEXT.md):
// - D-69: la `RetryStrategy` rispetta `Retry-After` calcolando il delay del prossimo
//   attempt. Il backoff esponenziale è cap-ato a `MAX_BACKOFF_MS` per prevenire DoS
//   auto-inflitto (PITFALLS #5).
// - PRD §23.1: retry policy con backoff + rispetto Retry-After.
//
// RFC 7231 §7.1.3 specifica due forme:
//   - delta-seconds: un intero non negativo (es. `120` = 120 secondi).
//   - HTTP-date: data assoluta in formato RFC 1123 (es. `Wed, 30 Apr 2026 12:00:30 GMT`).
//
// Comportamento (specificato nei test):
// - delta-seconds: numero × 1000 → cap a MAX_BACKOFF_MS.
// - HTTP-date future: (date - now) ms → cap a MAX_BACKOFF_MS.
// - HTTP-date past: 0.
// - Malformed/null/empty/negative: `undefined` (caller usa fallback backoff).
//
// Threat coverage:
// - T-03-08-03 (DoS — Retry-After malicioso enorme): cap MAX_BACKOFF_MS = 60s previene
//   stall del client su valori adversarial (server malevolo che richiede attesa di anni).

/**
 * Cap massimo del delay di retry (60 secondi). Server malevoli o malconfigurati
 * possono inviare `Retry-After` con valori enormi (giorni, anni) che farebbero
 * stall-are il client. Cap proteggge la pipeline (PITFALLS #5 / DoS auto-inflitto).
 *
 * Usato anche dalla default `RetryStrategy` (plan 03-09) come `maxDelayMs` ceiling
 * per il backoff esponenziale.
 */
export const MAX_BACKOFF_MS = 60_000

/**
 * Parse RFC 7231 §7.1.3 `Retry-After` header value in millisecondi.
 *
 * Accetta entrambe le forme `delta-seconds` (numero non negativo) e `HTTP-date`
 * (formato RFC 1123 parsabile da `Date.parse`). Il risultato è cap-ato a
 * `MAX_BACKOFF_MS` per prevenire stall su valori adversarial (T-03-08-03 mitigation).
 *
 * @param headerValue - Valore del response header `Retry-After` (può essere `null`).
 * @param now - Timestamp di riferimento per HTTP-date diff (default `Date.now()`,
 *   override per test deterministici).
 * @returns Delay in millisecondi (>= 0, <= MAX_BACKOFF_MS) oppure `undefined` se
 *   il valore è null/empty/malformed/negativo. Il caller usa fallback backoff
 *   esponenziale quando il return è `undefined`.
 *
 * @example
 * ```ts
 * const delay = parseRetryAfter(response.headers.get('Retry-After'))
 * if (delay !== undefined) await sleep(delay)
 * ```
 */
export function parseRetryAfter(
  headerValue: string | null,
  now: number = Date.now(),
): number | undefined {
  if (!headerValue) return undefined
  const trimmed = headerValue.trim()
  if (trimmed.length === 0) return undefined
  // delta-seconds form (numeric string).
  // Numero strict: solo digit (no leading sign, no decimali) per evitare ambiguità.
  // Negative/decimal/leading-sign (`-1`, `1.5`, `+5`) sono rifiutati dal regex e
  // NON possono falsamente passare al ramo HTTP-date (Date.parse('-1') → year -1
  // valido — sarebbe past quindi 0, ma semanticamente è un input malformed → undefined).
  if (/^\d+$/.test(trimmed)) {
    const seconds = Number(trimmed)
    return Math.min(seconds * 1000, MAX_BACKOFF_MS)
  }
  // HTTP-date form (RFC 1123). Pre-check strict: il formato canonico include `GMT`
  // (es. `Wed, 30 Apr 2026 12:00:30 GMT`). Date.parse è troppo permissiva (accetta
  // `-1` come anno -1) — pre-check su `GMT` blocca i falsi positivi più comuni.
  if (!trimmed.includes('GMT')) return undefined
  const dateMs = Date.parse(trimmed)
  if (!Number.isNaN(dateMs)) {
    const delta = dateMs - now
    if (delta < 0) return 0
    return Math.min(delta, MAX_BACKOFF_MS)
  }
  return undefined
}
