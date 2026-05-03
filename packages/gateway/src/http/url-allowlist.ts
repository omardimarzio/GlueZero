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
 * Valida un URL contro la `gateway.allowlist` (SEC-05, D-71).
 *
 * - `allowlist === undefined` → ritorna silenziosamente (dev convenience).
 * - `allowlist` array di string|RegExp → match richiesto (string = prefix/equality
 *   via `String.startsWith`, RegExp = `regex.test(url)`).
 * - URL fuori allowlist → throw `BrokerError 'gateway.url.forbidden'` con
 *   `category: 'config'` e `details: { url, allowlist }`.
 *
 * Re-utilizzata POST-redirect dal gateway (Pitfall 7 mitigation): se response 3xx
 * contiene `Location`, la function viene chiamata di nuovo prima del refetch per
 * prevenire bypass via redirect a host non autorizzati.
 *
 * @param url - URL della request HTTP.
 * @param allowlist - Array di entry `string` (prefix match) o `RegExp` (pattern match).
 * @param context - Opzionale: routeId/topic/eventId per popolare il `BrokerError`.
 * @throws `BrokerError 'gateway.url.forbidden'` (`category: 'config'`) se l'URL non
 *   è in allowlist.
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
 * ```
 */
export function validateAgainstAllowlist(
  url: string,
  allowlist: readonly AllowlistEntry[] | undefined,
  context: AllowlistValidationContext = {},
): void {
  if (!allowlist) return
  const ok = allowlist.some((entry) =>
    entry instanceof RegExp ? entry.test(url) : url === entry || url.startsWith(entry),
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
