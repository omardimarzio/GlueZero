/**
 * F6 stable-hash — utility pure per derivazione cache key deterministica
 * (D-155 default + D-156 scope prefix).
 *
 * **Pattern primario carryover**: F3 D-74 KeyBased dedupe strategy
 * (`packages/gateway/src/http/strategies/dedupe-strategy.ts:65-90`) — generalizzato
 * qui in funzione pubblica esposta al CacheHandler (06-03) e al CacheBroker
 * (06-08).
 *
 * **NO crypto-grade** — FNV-1a 32-bit è hash deterministico per cache key,
 * NON sicurezza (collision worst case = wrong cache hit, mitigato da scope
 * D-156). Cite C1 RESEARCH §3.2 — collision rate ~1e-6 per 100k entries.
 *
 * **Acyclic invariant**: `stableStringify` NON gestisce cyclic structure.
 * Caller responsabile garantire payload acyclic — Mapper F2 invariante per
 * canonical payload (V1 garantisce). Cyclic input → RangeError stack overflow
 * (T-06-02-06 documented).
 *
 * **NON adottato `json-stable-stringify`** (RESEARCH §3.2): 2 KB ~ valutati ma
 * rigettati per zero-dep priority + budget bundle stretto F6.
 *
 * @see RESEARCH §3 cache key stable hash impl
 * @see prd.md §20.1 cache key behavior
 * @packageDocumentation
 */

/**
 * JSON stringify deterministico — chiavi degli oggetti ordinate alfabeticamente
 * via `Object.keys().sort()`. Array NON ri-ordinati (preserve semantic order).
 *
 * Limitazioni note:
 * - NO cyclic-detection: assume payload acyclic (Mapper F2 invariante).
 *   Cyclic → RangeError "Maximum call stack size exceeded" (T-06-02-06).
 * - undefined-as-object-value seguito JSON.stringify spec (proprietà skippate).
 *
 * @param value Input qualsiasi (tipicamente canonical payload post-mapper F2)
 * @returns Stringa JSON con object key ordering deterministico
 * @throws RangeError se cyclic structure (caller responsibility — F2 garantisce acyclic)
 *
 * @example
 * stableStringify({ b: 2, a: 1 }) // → '{"a":1,"b":2}'
 * stableStringify({ a: 1, b: 2 }) // → '{"a":1,"b":2}' (identico)
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) as string
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const keys = Object.keys(value as Record<string, unknown>).sort()
  const parts = keys.map(
    (k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`,
  )
  return `{${parts.join(',')}}`
}

/**
 * FNV-1a 32-bit hash inline. Riferimento: http://www.isthe.com/chongo/tech/comp/fnv/
 *
 * ~10 LOC, zero deps, ~1e-6 collision rate per 100k entries (cite C1 RESEARCH §3.2).
 * Output: 8-char hex string lowercase padded (`'a1b2c3d4'`).
 *
 * Costanti:
 * - `0x811c9dc5` — FNV offset basis 32-bit
 * - `0x01000193` — FNV prime 32-bit
 *
 * `Math.imul` è usato per moltiplicazione 32-bit safe (no overflow nei
 * float double precision), comportamento spec-compliant ECMAScript 2015.
 *
 * @param str Input string (tipicamente output di stableStringify)
 * @returns 8-char lowercase hex hash padded
 *
 * @example
 * fnv1a32('foo') // → 'a9f37ed7' (deterministic)
 * fnv1a32('foo') === fnv1a32('foo') // → true sempre
 */
export function fnv1a32(str: string): string {
  let hash = 0x811c9dc5 // FNV offset basis 32-bit
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) // FNV prime 32-bit
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/**
 * Stable hash combinato: `stableStringify` + `fnv1a32`. Helper di alto livello
 * consumato dal CacheHandler (06-03) e dal CacheBroker (06-08).
 *
 * @param value Payload qualsiasi (acyclic)
 * @returns 8-char hex hash deterministico
 *
 * @example
 * stableHash({ city: 'Roma' }) === stableHash({ city: 'Roma' })  // true
 * stableHash({ a: 1, b: 2 }) === stableHash({ b: 2, a: 1 })      // true
 */
export function stableHash(value: unknown): string {
  return fnv1a32(stableStringify(value))
}

/**
 * Costruisce la cache key finale per un evento (D-155 default + D-156 scope).
 *
 * Formato:
 * - Senza scope (o scope `null`/`undefined`/`''`): `${topic}::${hash8}`
 *   → es. `weather.requested::a1b2c3d4`
 * - Con scope: `${scope}::${topic}::${hash8}`
 *   → es. `user-42::weather.requested::a1b2c3d4`
 *
 * **D-156 anti cross-tenant** — scope prefix garantisce che payload identici di
 * utenti diversi NON collidono nella cache (information disclosure mitigation
 * T-06-02-02).
 *
 * @param opts.topic BrokerEvent topic (es. `'weather.requested'`)
 * @param opts.payload Canonical payload post-mapper F2 (acyclic)
 * @param opts.scope Optional user/tenant scope D-156 — anti cross-tenant leakage
 * @returns Cache key string deterministico
 *
 * @example
 * cacheKey({ topic: 'weather.requested', payload: { location: 'Roma' } })
 * // → 'weather.requested::a1b2c3d4'
 *
 * cacheKey({ topic: 'weather.requested', payload: { location: 'Roma' }, scope: 'user-42' })
 * // → 'user-42::weather.requested::a1b2c3d4'
 *
 * @see RESEARCH §3.3 override route-level via RouteDefinition.cache.key
 * @see prd.md §20.1 cache key behavior
 */
export function cacheKey(opts: {
  readonly topic: string
  readonly payload: unknown
  readonly scope?: string | null
}): string {
  const baseKey = `${opts.topic}::${stableHash(opts.payload)}`
  return opts.scope ? `${opts.scope}::${baseKey}` : baseKey
}
