/**
 * `bridge-schemas.ts` — 9 Valibot `v.strictObject()` schemas per i message types del
 * bridge postMessage iframe (D-V2-F15-01 lockato — closure D-V2-09 BLOCKING T-15-02).
 *
 * Ogni schema usa `v.strictObject()` che **rigetta qualsiasi campo extra** (default
 * Valibot 1.x è `looseObject`, qui forziamo strict per chiudere il vettore "schema
 * injection via unknown fields" — CVE-2024-49038 + Renwa Mar 2026 mitigation).
 *
 * Common envelope fields:
 *  - `id: string` (nanoid o crypto.randomUUID, length ≥ 1)
 *  - `microFrontendId: string` (length ≥ 1)
 *  - `timestamp: number` (integer ≥ 0, ms da epoch — replay-window 30s D-V2-F15-03)
 *  - `correlationId?: string` (opzionale, tracing cross-frame)
 *  - `type: literal('gz:...')` (discriminator per `v.variant`)
 *  - `payload: v.strictObject({...})` (per-tipo)
 *
 * Le 9 schemas implementano i message types lockati in PRD §26.5:
 *  - `gz:handshake` (host → iframe): protocolVersion + expectedHostOrigin
 *  - `gz:ready` (iframe → host): protocolVersion + capabilities?
 *  - `gz:publish` (iframe → host): topic + data
 *  - `gz:subscribe` (iframe → host): topic + subscriptionId
 *  - `gz:unsubscribe` (iframe → host): subscriptionId
 *  - `gz:context:get` (iframe → host): keys?
 *  - `gz:context:update` (host → iframe): partial record
 *  - `gz:error` (bidirectional): code + message + details?
 *  - `gz:lifecycle` (bidirectional): phase + status + reason?
 *
 * Bundle stima: 9 × ~280 B = ~2.5 KB gzipped (Valibot tree-shake via subpath imports
 * con `import * as v from 'valibot'`).
 *
 * @see PRD §26.5 — 9 message types iframe bridge
 * @see D-V2-F15-01 — Valibot strict-only
 * @see prd_2.0.0.md §44 — Security iframe (Renwa Mar 2026 + CVE-2024-49038)
 */
import * as v from 'valibot'

/**
 * Common envelope entries condivise tra tutti i 9 schemas (DRY).
 *
 * Ogni schema deriva da `v.strictObject({ ...baseEnvelopeEntries, type: ..., payload: ... })`.
 *
 * @internal
 */
/**
 * Common envelope shape comune a tutti i 9 message types.
 *
 * @internal
 */
interface CommonEnvelope {
  readonly id: string
  readonly microFrontendId: string
  readonly timestamp: number
  readonly correlationId?: string | undefined
}

const baseEnvelopeEntries = {
  id: v.pipe(v.string(), v.minLength(1)),
  microFrontendId: v.pipe(v.string(), v.minLength(1)),
  timestamp: v.pipe(v.number(), v.integer(), v.minValue(0)),
  correlationId: v.optional(v.string()),
} as const

/**
 * `gz:handshake` — Host → iframe — primo messaggio handshake protocol.
 *
 * @example
 * ```ts
 * {
 *   id: 'abc123', microFrontendId: 'mf-x', timestamp: 1700000000000,
 *   type: 'gz:handshake',
 *   payload: { protocolVersion: 'gz:bridge/1.0', expectedHostOrigin: 'https://host.com' },
 * }
 * ```
 *
 * @see D-V2-F15-01
 */
interface HandshakeMessage extends CommonEnvelope {
  readonly type: 'gz:handshake'
  readonly payload: {
    readonly protocolVersion: 'gz:bridge/1.0'
    readonly expectedHostOrigin: string
  }
}

const HandshakeSchema = v.strictObject({
  ...baseEnvelopeEntries,
  type: v.literal('gz:handshake'),
  payload: v.strictObject({
    protocolVersion: v.literal('gz:bridge/1.0'),
    expectedHostOrigin: v.pipe(v.string(), v.minLength(1)),
  }),
}) as unknown as v.GenericSchema<HandshakeMessage>

/**
 * `gz:ready` — Iframe → host — ACK handshake (post-init code in-iframe).
 *
 * @example
 * ```ts
 * {
 *   id: 'def456', microFrontendId: 'mf-x', timestamp: 1700000000010,
 *   type: 'gz:ready',
 *   payload: { protocolVersion: 'gz:bridge/1.0', capabilities: ['publish','subscribe'] },
 * }
 * ```
 */
interface ReadyMessage extends CommonEnvelope {
  readonly type: 'gz:ready'
  readonly payload: {
    readonly protocolVersion: 'gz:bridge/1.0'
    readonly capabilities?: readonly string[]
  }
}

const ReadySchema = v.strictObject({
  ...baseEnvelopeEntries,
  type: v.literal('gz:ready'),
  payload: v.strictObject({
    protocolVersion: v.literal('gz:bridge/1.0'),
    capabilities: v.optional(v.array(v.string())),
  }),
}) as unknown as v.GenericSchema<ReadyMessage>

/**
 * `gz:publish` — Iframe → host — publish broker event (canonical envelope).
 *
 * @example
 * ```ts
 * { id, microFrontendId, timestamp, type: 'gz:publish',
 *   payload: { topic: 'user.action', data: { action: 'click' } } }
 * ```
 */
interface PublishMessage extends CommonEnvelope {
  readonly type: 'gz:publish'
  readonly payload: {
    readonly topic: string
    readonly data: unknown
  }
}

const PublishSchema = v.strictObject({
  ...baseEnvelopeEntries,
  type: v.literal('gz:publish'),
  payload: v.strictObject({
    topic: v.pipe(v.string(), v.minLength(1)),
    data: v.unknown(),
  }),
}) as unknown as v.GenericSchema<PublishMessage>

/**
 * `gz:subscribe` — Iframe → host — subscribe topic pattern.
 */
interface SubscribeMessage extends CommonEnvelope {
  readonly type: 'gz:subscribe'
  readonly payload: {
    readonly topic: string
    readonly subscriptionId: string
  }
}

const SubscribeSchema = v.strictObject({
  ...baseEnvelopeEntries,
  type: v.literal('gz:subscribe'),
  payload: v.strictObject({
    topic: v.pipe(v.string(), v.minLength(1)),
    subscriptionId: v.pipe(v.string(), v.minLength(1)),
  }),
}) as unknown as v.GenericSchema<SubscribeMessage>

/**
 * `gz:unsubscribe` — Iframe → host — unsubscribe topic pattern.
 */
interface UnsubscribeMessage extends CommonEnvelope {
  readonly type: 'gz:unsubscribe'
  readonly payload: {
    readonly subscriptionId: string
  }
}

const UnsubscribeSchema = v.strictObject({
  ...baseEnvelopeEntries,
  type: v.literal('gz:unsubscribe'),
  payload: v.strictObject({
    subscriptionId: v.pipe(v.string(), v.minLength(1)),
  }),
}) as unknown as v.GenericSchema<UnsubscribeMessage>

/**
 * `gz:context:get` — Iframe → host — request snapshot RuntimeContext (F10).
 */
interface ContextGetMessage extends CommonEnvelope {
  readonly type: 'gz:context:get'
  readonly payload: {
    readonly keys?: readonly string[]
  }
}

const ContextGetSchema = v.strictObject({
  ...baseEnvelopeEntries,
  type: v.literal('gz:context:get'),
  payload: v.strictObject({
    keys: v.optional(v.array(v.string())),
  }),
}) as unknown as v.GenericSchema<ContextGetMessage>

/**
 * `gz:context:update` — Host → iframe — push update RuntimeContext snapshot.
 */
interface ContextUpdateMessage extends CommonEnvelope {
  readonly type: 'gz:context:update'
  readonly payload: {
    readonly partial: Record<string, unknown>
  }
}

const ContextUpdateSchema = v.strictObject({
  ...baseEnvelopeEntries,
  type: v.literal('gz:context:update'),
  payload: v.strictObject({
    partial: v.record(v.string(), v.unknown()),
  }),
}) as unknown as v.GenericSchema<ContextUpdateMessage>

/**
 * `gz:error` — Bidirectional — error propagation cross-frame.
 */
interface ErrorMessage extends CommonEnvelope {
  readonly type: 'gz:error'
  readonly payload: {
    readonly code: string
    readonly message: string
    readonly details?: Record<string, unknown>
  }
}

const ErrorSchema = v.strictObject({
  ...baseEnvelopeEntries,
  type: v.literal('gz:error'),
  payload: v.strictObject({
    code: v.pipe(v.string(), v.minLength(1)),
    message: v.pipe(v.string(), v.minLength(1)),
    details: v.optional(v.record(v.string(), v.unknown())),
  }),
}) as unknown as v.GenericSchema<ErrorMessage>

/**
 * `gz:lifecycle` — Bidirectional — lifecycle phase transition events.
 */
interface LifecycleMessage extends CommonEnvelope {
  readonly type: 'gz:lifecycle'
  readonly payload: {
    readonly phase: 'bootstrap' | 'mount' | 'unmount' | 'destroy'
    readonly status: 'started' | 'completed' | 'failed'
    readonly reason?: string
  }
}

const LifecycleSchema = v.strictObject({
  ...baseEnvelopeEntries,
  type: v.literal('gz:lifecycle'),
  payload: v.strictObject({
    phase: v.picklist(['bootstrap', 'mount', 'unmount', 'destroy']),
    status: v.picklist(['started', 'completed', 'failed']),
    reason: v.optional(v.string()),
  }),
}) as unknown as v.GenericSchema<LifecycleMessage>

/**
 * `BridgeMessageSchema` — Variant discriminated union sui 9 message types literal
 * `type` (D-V2-F15-01).
 *
 * `v.variant('type', [...])` discrimina per il `type` literal e applica lo schema
 * corretto. Su mismatch → fail validation con issue path `.type`.
 *
 * @example
 * ```ts
 * const result = v.safeParse(BridgeMessageSchema, event.data)
 * if (!result.success) {
 *   // result.issues contiene path/message per debug
 *   return
 * }
 * // result.output: IframeBridgeMessage (type narrowing automatico)
 * ```
 *
 * @see D-V2-F15-01
 */
/**
 * Type union dei 9 message types literal `type` discriminator.
 *
 * Permette type narrowing per `msg.type === 'gz:handshake'` dentro `dispatch(msg)`.
 */
export type IframeBridgeMessage =
  | HandshakeMessage
  | ReadyMessage
  | PublishMessage
  | SubscribeMessage
  | UnsubscribeMessage
  | ContextGetMessage
  | ContextUpdateMessage
  | ErrorMessage
  | LifecycleMessage

// Wrapper local typed variant — cast finale single-step (v.variant accept VariantOption
// strict, ma il narrowing è correct per il narrow runtime check del bridge dispatcher).
const _BridgeMessageSchemaInternal = v.variant('type', [
  HandshakeSchema as never,
  ReadySchema as never,
  PublishSchema as never,
  SubscribeSchema as never,
  UnsubscribeSchema as never,
  ContextGetSchema as never,
  ContextUpdateSchema as never,
  ErrorSchema as never,
  LifecycleSchema as never,
])

export const BridgeMessageSchema: v.GenericSchema<IframeBridgeMessage> =
  _BridgeMessageSchemaInternal as unknown as v.GenericSchema<IframeBridgeMessage>
