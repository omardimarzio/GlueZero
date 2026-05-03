// url-allowlist.ts — Guard pre-fetch per SEC-05 (D-71).
//
// Riferimento decisioni (03-CONTEXT.md):
// - D-71: URL allowlist obbligatoria. Tentativo di fetch verso URL non in allowlist →
//   throw `BrokerError 'gateway.url.forbidden'` PRIMA della fetch (no network call).
//   Default `allowlist: undefined` → tutti gli URL consentiti (dev convenience), ma
//   `createBroker` emette warning `'gateway.allowlist.missing'` in dev mode (plan 03-12).
// - Pitfall 7 (chiusura): post-redirect re-validation. La fetch in `http-gateway.ts`
//   usa `redirect: 'manual'` + re-call `validateAgainstAllowlist(Location)` per
//   prevenire bypass via 302 to evil.com.
//
// Pattern analogo: `validateTopic` di F1 (`packages/core/src/core/topic-matcher.ts:35`).
//
// Threat coverage:
// - T-03-08-01 (Information Disclosure — redirect leak Authorization): mitigate via
//   `redirect: 'manual'` + re-validate Location header (gestito in http-gateway.ts).
// - T-03-08-02 (Tampering — URL injection bypass): regex/prefix match strict; URL parsing
//   per redirect via `new URL(location, base)` per resolve relative URL.

import { createBrokerError } from '@sembridge/core'
import type { AllowlistEntry } from './types/gateway-config'

/**
 * Contesto opzionale per l'errore lanciato dalla guard. I 3 field popolano il
 * `BrokerError` per consentire correlazione con la pipeline (Inspector debug).
 */
export interface AllowlistValidationContext {
  readonly routeId?: string
  readonly topic?: string
  readonly eventId?: string
}

/**
 * Verifica match string-entry vs URL parsed con boundary check robusto (CR-02 fix).
 *
 * Strategia (chiusura BLOCKER iter 2 — bypass via subdomain spoofing / typo squat /
 * userinfo trick):
 * 1. Parse l'`entry` come URL (struct compare invece di string prefix).
 * 2. `parsed.origin` deve `===` `entryUrl.origin` (no subdomain spoofing
 *    `api.example.com.evil.com`).
 * 3. `parsed.pathname` deve essere `===` a `entryUrl.pathname` oppure inizia con
 *    `entryUrl.pathname + '/'` (boundary su slash → no `foo` matcha `foobar`).
 *
 * Se `entry` non è un URL valido (es. legacy plain string `'https://api.example.com'`),
 * fallback al match strict-equality (no startsWith) sull'URL completo — coerente con
 * il match doc precedente ma SENZA il pattern bypass-prone `startsWith`.
 *
 * @internal
 */
function matchStringEntry(parsed: URL, entry: string): boolean {
  let entryUrl: URL
  try {
    entryUrl = new URL(entry)
  } catch {
    // Fallback strict-equality (no prefix bypass).
    return parsed.href === entry
  }
  // 1. Origin (scheme + host + port) deve essere identico — chiude il bypass via
  //    `api.example.com.evil.com` (host diverso) e `api.example.com@evil.com` (host evil).
  if (parsed.origin !== entryUrl.origin) return false
  // 2. Path prefix con boundary `/` — chiude bypass via typo squat `comp` su `com`.
  const entryPath = entryUrl.pathname
  const urlPath = parsed.pathname
  if (entryPath === '/' || entryPath === '') return true
  if (urlPath === entryPath) return true
  // Aggiungi `/` finale a entryPath se mancante per garantire boundary.
  const entryPrefix = entryPath.endsWith('/') ? entryPath : `${entryPath}/`
  return urlPath.startsWith(entryPrefix)
}

/**
 * Valida un URL contro la `gateway.allowlist` (SEC-05, D-71).
 *
 * - `allowlist === undefined` → ritorna silenziosamente (dev convenience).
 * - `allowlist` array di string|RegExp → match richiesto:
 *   * `string` → URL parsing strutturato (CR-02 fix): origin esatto + pathname prefix
 *     con boundary `/` (no subdomain spoofing/typo squat/userinfo trick).
 *   * `RegExp` → `regex.test(url)`.
 * - URL fuori allowlist → throw `BrokerError 'gateway.url.forbidden'` con
 *   `category: 'config'` e `details: { url, allowlist }`.
 * - URL non parsabile come `URL` → throw `BrokerError 'gateway.url.forbidden'`
 *   (CR-02 fix: prima ritornava silenziosamente con startsWith, ora fail-fast).
 *
 * Re-utilizzata POST-redirect dal gateway (Pitfall 7 mitigation): se response 3xx
 * contiene `Location`, la function viene chiamata di nuovo prima del refetch per
 * prevenire bypass via redirect a host non autorizzati.
 *
 * @param url - URL della request HTTP.
 * @param allowlist - Array di entry `string` (origin+path prefix con boundary) o
 *   `RegExp` (pattern match).
 * @param context - Opzionale: routeId/topic/eventId per popolare il `BrokerError`.
 * @throws `BrokerError 'gateway.url.forbidden'` (`category: 'config'`) se l'URL non
 *   è in allowlist o non è un URL valido.
 *
 * @example
 * ```ts
 * validateAgainstAllowlist('https://api.example.com/v1/weather', [
 *   /^https:\/\/api\.example\.com\//,
 * ])
 * // ok — non throw
 *
 * validateAgainstAllowlist('https://evil.com/x', ['https://api.example.com'])
 * // throws BrokerError code='gateway.url.forbidden'
 *
 * // CR-02: i seguenti bypass ora sono BLOCCATI (prima passavano):
 * validateAgainstAllowlist('https://api.example.com.evil.com/x', ['https://api.example.com'])
 * // throws (subdomain spoofing)
 * validateAgainstAllowlist('https://api.example.comp/x', ['https://api.example.com'])
 * // throws (typo squat)
 * validateAgainstAllowlist('https://api.example.com@evil.com/x', ['https://api.example.com'])
 * // throws (userinfo trick — host = evil.com)
 * ```
 */
export function validateAgainstAllowlist(
  url: string,
  allowlist: readonly AllowlistEntry[] | undefined,
  context: AllowlistValidationContext = {},
): void {
  if (!allowlist) return
  // CR-02 fix: parse l'URL UNA volta strutturato per applicare match con boundary.
  // Se l'URL non è parsabile come URL valido, fail-fast (previene match accidentali).
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    throw createBrokerError({
      code: 'gateway.url.forbidden',
      category: 'config',
      message: `URL "${url}" is not a valid absolute URL (SEC-05)`,
      details: {
        url,
        allowlist: allowlist.map((e) => (e instanceof RegExp ? e.source : String(e))),
        reason: 'invalid-url',
      },
      ...(context.routeId !== undefined && { routeId: context.routeId }),
      ...(context.topic !== undefined && { topic: context.topic }),
      ...(context.eventId !== undefined && { eventId: context.eventId }),
    })
  }
  const ok = allowlist.some((entry) =>
    entry instanceof RegExp ? entry.test(url) : matchStringEntry(parsedUrl, entry),
  )
  if (!ok) {
    throw createBrokerError({
      code: 'gateway.url.forbidden',
      category: 'config',
      message: `URL "${url}" is not in gateway allowlist (SEC-05)`,
      details: {
        url,
        allowlist: allowlist.map((e) => (e instanceof RegExp ? e.source : String(e))),
      },
      ...(context.routeId !== undefined && { routeId: context.routeId }),
      ...(context.topic !== undefined && { topic: context.topic }),
      ...(context.eventId !== undefined && { eventId: context.eventId }),
    })
  }
}
