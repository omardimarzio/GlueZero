/**
 * `IframeBridgeMessageType` — Union literal 9 message types iframe bridge (D-V2-F15-01).
 *
 * Coverage REQ MF-IFRAME-01..05 closure D-V2-09 BLOCKING. W2 P03 fill: 9 Valibot
 * `v.strictObject` schemas + `IframeBridgeMessage` union runtime + LRU dedup +
 * replay mitigation 30s + rate-limit 100 msg/s + expectedOrigin enforcement.
 *
 * @see PRD §26 — Iframe Loader + Bridge (9 message types)
 * @see D-V2-F15-01 — Valibot strict-only
 * @see D-V2-F15-02 — LRU dedup 500 per (origin, mfId)
 * @see D-V2-F15-03 — Replay mitigation ID + timestamp 30s
 * @see D-V2-F15-04 — Rate limit 100 msg/s drop + emit
 */

/**
 * 9 message types literal union iframe bridge.
 *
 * - `gz:handshake`: host → iframe — primo messaggio handshake protocol.
 * - `gz:ready`: iframe → host — ACK handshake (post-init code in-iframe).
 * - `gz:publish`: iframe → host — publish broker event (canonical envelope).
 * - `gz:subscribe`: iframe → host — subscribe topic pattern.
 * - `gz:unsubscribe`: iframe → host — unsubscribe topic pattern.
 * - `gz:context:get`: iframe → host — request snapshot RuntimeContext.
 * - `gz:context:update`: host → iframe — push update RuntimeContext snapshot.
 * - `gz:error`: bidirectional — error propagation cross-frame.
 * - `gz:lifecycle`: bidirectional — lifecycle phase transition events.
 */
export type IframeBridgeMessageType =
  | 'gz:handshake'
  | 'gz:ready'
  | 'gz:publish'
  | 'gz:subscribe'
  | 'gz:unsubscribe'
  | 'gz:context:get'
  | 'gz:context:update'
  | 'gz:error'
  | 'gz:lifecycle'

// W2 P03 fill: 9 Valibot v.strictObject schemas + IframeBridgeMessage union runtime
// + LRU dedup buffer + replay mitigation + rate limiter + expectedOrigin enforcement.
