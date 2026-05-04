// types/frame-envelope.ts — Envelope JSON default per WebSocket frames (D-106 + Q2 closure).
//
// Riferimento decisioni (04-CONTEXT.md):
// - D-106: il server WebSocket invia frames JSON con shape `{ topic, data, id? }`.
//   L'adapter WS (plan 04-06) parse il frame, estrae `topic` come `BrokerEvent.topic`,
//   `data` come `payload` raw (poi normalizzato dal mapper step 4 §28 in plan 04-08
//   via RouterBroker), `id` come `BrokerEvent.id` opzionale (se assente, generato
//   via nanoid dall'adapter).
// - Q2 closure (04-CONTEXT decisions): frame non-conformi (parse fail o missing
//   topic) → l'adapter publica `network.error` con `category: 'protocol'` + descarta
//   il frame. Riuso `network.error` esistente (PRD §22.3, ERR-02 ext) — niente
//   nuovi categorie di errore.
// - PITFALL §11.7 (anti AP-6): `__ping__`/`__pong__` sono topic riservati. Match
//   strict, NON prefix-based. Vedi `frame-parser.ts` `isInternalTopic`.

/**
 * Envelope JSON default per WebSocket frames (D-106).
 *
 * Contract:
 * - `topic` → `BrokerEvent.topic`. NON vuota.
 * - `data` → payload raw (poi normalizzato dal mapper step 4 §28 in plan 04-08 via `RouterBroker`).
 * - `id` opzionale → `BrokerEvent.id` (se assente, generato via nanoid dall'adapter).
 *
 * Frame non-conformi (parse fail o missing `topic`) → l'adapter (plan 04-06) publica
 * `network.error` con `category: 'protocol'` + descarta il frame (D-106 + Q2 closure).
 */
export interface FrameEnvelope {
  readonly topic: string
  readonly data: unknown
  readonly id?: string
}

/**
 * Result discriminato del parser (pattern simile a `RouteOutcome` F3 e
 * `parseRetryAfter` di gateway/http).
 *
 * - `ok: true` → envelope estratto correttamente; `envelope` è una `FrameEnvelope`
 *   readonly (consumer NON deve mutare).
 * - `ok: false` → ragione enumerata (`malformed-json` JSON.parse fail o input
 *   non-string, `missing-topic` topic mancante o stringa vuota, `invalid-shape`
 *   JSON valido ma non-object root: array/null/primitive) + `raw` per
 *   debug/forensics nel `network.error` event payload.
 */
export type FrameParseResult =
  | { readonly ok: true; readonly envelope: FrameEnvelope }
  | {
      readonly ok: false
      readonly reason: 'malformed-json' | 'missing-topic' | 'invalid-shape'
      readonly raw: string
    }
