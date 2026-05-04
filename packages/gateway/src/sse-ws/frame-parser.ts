// frame-parser.ts — Pure parser per WebSocket envelope JSON `{ topic, data, id? }` (D-106).
//
// Riferimento decisioni (04-CONTEXT.md):
// - D-106: envelope JSON come default frame format per WebSocket. Frame non-conformi
//   (parse fail o missing topic) → consumer publica `network.error` con
//   `category: 'protocol'` + descarta. Riuso `network.error` esistente (PRD §22.3,
//   ERR-02 ext) — niente nuovi categorie di errore (Q2 closure).
// - D-111: topic interni `__ping__`/`__pong__` riservati per heartbeat WS applicativo
//   (D-111 ping/pong). Filtrati dall'adapter PRIMA del publish.
// - PITFALL §11.7 (chiusura AP-6): `isInternalTopic` deve usare match STRICT
//   (`topic === '__ping__'`), NON prefix `topic.startsWith('__')`. Topic legittimi
//   come `weather.__ping__` (raro ma legittimo) NON devono essere filtrati come
//   internal. Q1 closure 04-CONTEXT.md.
//
// Pattern parser puro identico a `parseRetryAfter` (gateway/src/http/retry-after-parser.ts):
// - input narrow → output union discriminato
// - NO throw (caller gestisce graceful via `.ok` branching)
// - NO side-effect, NO state
// - test deterministici tier-1 jsdom senza setup async
//
// Threat coverage:
// - T-04-02-02 (Tampering — prototype pollution `__proto__`): `JSON.parse` di V8/Node
//   neutralizza `__proto__` di default. Output `data` è opaque (caller responsabilità
//   sanitization).
// - T-04-02-03 (Spoofing — server invia `__ping__`/`__pong__` come finto heartbeat):
//   `isInternalTopic` è il punto di mitigation; il filtro è applicato dall'adapter
//   plan 04-06 PRIMA del publish, quindi i topic non raggiungono i subscriber utente.
// - T-04-02-04 (Information Disclosure — `raw` field espone payload server al
//   consumer): voluto per `network.error` debug; documentato in DOC-04 plan 04-09.

import type { FrameEnvelope, FrameParseResult } from './types/frame-envelope'

/**
 * Topic riservati internal al protocollo realtime (D-111 + PITFALL §11.7).
 *
 * Filtrati dall'adapter WS (plan 04-06) PRIMA del publish — non possono raggiungere
 * i subscriber utente. Match STRICT (no prefix wildcard): topic legittimi consumer
 * come `weather.__ping__` (raro ma legittimo) passano attraverso.
 *
 * Frozen per impedire mutation accidentale dal consumer (immutability garantita).
 */
export const INTERNAL_TOPICS: Readonly<{ readonly PING: '__ping__'; readonly PONG: '__pong__' }> =
  Object.freeze({
    PING: '__ping__',
    PONG: '__pong__',
  } as const)

/**
 * Parse un frame WebSocket testuale come `FrameEnvelope` JSON (D-106).
 *
 * Contract:
 * - `raw` deve essere stringa JSON con shape `{ topic: string, data: unknown, id?: string }`.
 * - Frame non-conformi → `{ ok: false, reason }` (caller publica `network.error`
 *   con `category: 'protocol'` per Q2 closure / PRD §22.3 ERR-02 ext).
 * - NIENTE throw: il caller (websocket-adapter.ts plan 04-06) gestisce graceful via `.ok`.
 *
 * Pattern identico a `parseRetryAfter` (gateway/src/http/retry-after-parser.ts):
 * narrow input/output, no side-effect, no throw, test deterministici tier-1 jsdom.
 *
 * @param raw - Stringa raw del frame (da `MessageEvent.data` su `'message'` event WS).
 *   Tipato `unknown` per gestire difensivamente input non-string (DOM lib tipa
 *   `MessageEvent.data` come `any`).
 * @returns `FrameParseResult` discriminato — caller usa `.ok` per branching.
 *
 * @example
 * ```ts
 * const result = parseFrame(ev.data)
 * if (!result.ok) {
 *   publishFn({ topic: 'network.error', payload: { reason: result.reason, raw: result.raw } })
 *   return
 * }
 * if (isInternalTopic(result.envelope.topic)) {
 *   handleHeartbeat(result.envelope)
 *   return
 * }
 * publishFn({ topic: result.envelope.topic, payload: result.envelope.data })
 * ```
 */
export function parseFrame(raw: unknown): FrameParseResult {
  // Step 1: difesa input non-string. `MessageEvent.data` è `any` da DOM lib —
  // potrebbe essere ArrayBuffer/Blob/number per protocolli misti. V1 supporta
  // solo testo JSON (D-106). `String(raw)` per `raw` field nel result (debug).
  if (typeof raw !== 'string') {
    return { ok: false, reason: 'malformed-json', raw: String(raw) }
  }
  // Step 2: JSON.parse con guard try/catch (no throw garantito al caller).
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, reason: 'malformed-json', raw }
  }
  // Step 3: shape check. JSON valido può essere primitive (number/string/bool),
  // null, array o object. L'envelope D-106 esige object root non-null non-array.
  // Nota: `null` è `typeof 'object'` in JS — guard esplicito necessario.
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, reason: 'invalid-shape', raw }
  }
  // Step 4: topic check (campo obbligatorio non vuoto, D-106).
  // Bracket access richiesto da `noPropertyAccessFromIndexSignature` (TS strict
  // tsconfig F4) — `Record<string, unknown>` esige `obj['topic']` non `obj.topic`.
  const obj = parsed as Record<string, unknown>
  // biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature TS strict require bracket access on Record<string, unknown>
  const topic = obj['topic']
  if (typeof topic !== 'string' || topic.length === 0) {
    return { ok: false, reason: 'missing-topic', raw }
  }
  // Step 5: build envelope con `id` solo se string. `id` non-string è ignorato
  // (Test 10) — il consumer adapter genererà l'id via nanoid se assente.
  // Nota: `data` è unknown raw, NON validato qui — la normalizzazione canonical
  // step 4 §28 e validation step 5/6 sono compito di RouterBroker (D-114, D-116).
  // biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature TS strict require bracket access on Record<string, unknown>
  const data = obj['data']
  // biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature TS strict require bracket access on Record<string, unknown>
  const id = obj['id']
  const envelope: FrameEnvelope = typeof id === 'string' ? { topic, data, id } : { topic, data }
  return { ok: true, envelope }
}

/**
 * Verifica se un topic è riservato internamente al protocollo realtime
 * (D-111 — `__ping__`/`__pong__` per heartbeat WS applicativo).
 *
 * **PITFALL §11.7 (chiave anti-AP-6) — strict match, NON prefix:**
 * Topic legittimi consumer come `weather.__ping__` NON devono essere filtrati. Il
 * confronto è `topic === '__ping__' || topic === '__pong__'` esatto.
 *
 * Usato dall'adapter WS (plan 04-06) PRIMA di `broker.publish` per:
 * - Filtrare i frame heartbeat (consumati internamente).
 * - Aggiornare il timestamp `lastPongReceivedAt` per stale detection (D-111).
 *
 * @example
 * ```ts
 * isInternalTopic('__ping__')         // true (filter)
 * isInternalTopic('__pong__')         // true (filter)
 * isInternalTopic('weather.__ping__') // false (passa attraverso)
 * isInternalTopic('__other__')        // false (no wildcard, no prefix)
 * ```
 */
export function isInternalTopic(topic: string): boolean {
  return topic === INTERNAL_TOPICS.PING || topic === INTERNAL_TOPICS.PONG
}
