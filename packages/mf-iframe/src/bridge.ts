/**
 * `bridge.ts` — `BridgeManager` class — postMessage handler + 9 message types dispatcher
 * + handshake state machine 9-step + sendMessage helper con targetOrigin dual-defense.
 *
 * ## onMessage 5-step chain (D-V2-09 BLOCKING closure)
 *
 *  1. **Origin check FIRST**: `event.origin !== expectedOrigin` → emit topic
 *     `microfrontend.iframe.origin-mismatch` + return (SILENT reject, NO throw —
 *     anti-DoS amplification).
 *  2. **Valibot strict parse** (D-V2-F15-01): `v.safeParse(BridgeMessageSchema, event.data)`.
 *     Su fail → emit topic `microfrontend.iframe.schema-invalid` + return.
 *  3. **Rate limit check** (D-V2-F15-04): `limiter.shouldDrop(mfId, origin, broker)`.
 *     Se true → drop silently (`limiter` già emette topic 1×/window internamente).
 *  4. **LRU + timestamp dedup** (D-V2-F15-02 + D-V2-F15-03): `dedup.isReplay(...)`.
 *     Se true → emit topic `microfrontend.iframe.replay-detected` + return.
 *  5. **Dispatch by message type**: `dispatch(parsedMessage)` switch sui 9 type literal.
 *
 * ## Handshake state machine 9-step (PRD §26.5)
 *
 *  - State machine: `'idle' → 'handshaking' → 'ready' → 'closed'`
 *  - `start()` invia `gz:handshake` (host → iframe)
 *  - `gz:ready` ricevuto (iframe → host) → `state = 'ready'` → resolve `waitForReady` Promise
 *  - Timeout default 15000 ms → throw `MF_IFRAME_BRIDGE_TIMEOUT`
 *
 * ## sendMessage targetOrigin ban dual-defense (REQ MF-IFRAME-04)
 *
 * Helper privato `sendMessage(type, payload)` chiama `validateTargetOrigin()` PRIMA di
 * ogni `iframe.contentWindow.postMessage(...)`. Throw `MF_IFRAME_ORIGIN_MISMATCH` se
 * `expectedOrigin === '*'`.
 *
 * @see PRD §26.5 — Handshake protocol 9-step
 * @see D-V2-F15-01..04 — Security gates D-V2-09 closure
 * @see REQ MF-IFRAME-04 — expectedOrigin MANDATORY + targetOrigin '*' BANNED
 */
import type { Broker } from '@gluezero/core'
import * as v from 'valibot'
import {
  BridgeMessageSchema,
  type IframeBridgeMessage,
} from './bridge-schemas'
import type { DedupRegistry } from './lru-dedup'
import { createMfIframeError } from './errors'
import { validateTargetOrigin } from './origin-validator'
import type { RateLimiter } from './rate-limiter'

/**
 * Topic literals emit per security gates D-V2-09 (coerente con `topics.ts`).
 *
 * @internal
 */
const TOPIC_ORIGIN_MISMATCH = 'microfrontend.iframe.origin-mismatch'
const TOPIC_SCHEMA_INVALID = 'microfrontend.iframe.schema-invalid'
const TOPIC_REPLAY_DETECTED = 'microfrontend.iframe.replay-detected'
const TOPIC_CLIENT_ERROR = 'microfrontend.iframe.client-error'
const TOPIC_LIFECYCLE = 'microfrontend.iframe.lifecycle'

/**
 * State machine per handshake protocol.
 *
 * @internal
 */
type BridgeState = 'idle' | 'handshaking' | 'ready' | 'closed'

/**
 * Generatore ID minimal — `crypto.randomUUID()` se disponibile, altrimenti fallback
 * `Date.now()+random`. Usato per sendMessage envelope id.
 *
 * @internal
 */
function generateMessageId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Defensive broker.publish — catch any error per evitare cascade fail nel bridge handler.
 *
 * @internal
 */
function safePublish(broker: Broker, topic: string, payload: unknown): void {
  try {
    broker.publish(topic, payload)
  } catch {
    // No-op (publish errors must not affect bridge dispatch).
  }
}

/**
 * `BridgeManager` — Gestisce il bridge postMessage per un singolo iframe instance.
 *
 * @example
 * ```ts
 * const bridge = new BridgeManager({
 *   iframe,
 *   expectedOrigin: 'https://iframe.example.com',
 *   mfId: 'mf-x',
 *   broker,
 *   dedup,
 *   limiter,
 * })
 * await bridge.waitForReady(15000) // attende gz:ready
 * // bridge attivo dispatch 9 message types
 * bridge.close() // cleanup su unmount
 * ```
 */
export class BridgeManager {
  private state: BridgeState = 'idle'
  private readonly iframe: HTMLIFrameElement
  private readonly expectedOrigin: string
  private readonly mfId: string
  private readonly broker: Broker
  private readonly dedup: DedupRegistry
  private readonly limiter: RateLimiter
  private readonly messageHandler: (ev: MessageEvent) => void
  private readyResolve?: () => void
  private readyReject?: (err: Error) => void
  private timeoutId: ReturnType<typeof setTimeout> | undefined

  constructor(opts: {
    iframe: HTMLIFrameElement
    expectedOrigin: string
    mfId: string
    broker: Broker
    dedup: DedupRegistry
    limiter: RateLimiter
  }) {
    this.iframe = opts.iframe
    this.expectedOrigin = opts.expectedOrigin
    this.mfId = opts.mfId
    this.broker = opts.broker
    this.dedup = opts.dedup
    this.limiter = opts.limiter

    this.messageHandler = (ev: MessageEvent): void => {
      this.onMessage(ev)
    }
    window.addEventListener('message', this.messageHandler)
  }

  /**
   * Avvia il handshake protocol — invia `gz:handshake` (host → iframe).
   *
   * Caller poi `await bridge.waitForReady(timeoutMs)` per attendere `gz:ready` response.
   */
  start(): void {
    if (this.state !== 'idle') return
    this.state = 'handshaking'
    // sendMessage applica targetOrigin validation
    this.sendMessage('gz:handshake', {
      protocolVersion: 'gz:bridge/1.0' as const,
      expectedHostOrigin: window.location.origin,
    })
  }

  /**
   * Attende che il bridge raggiunga state `'ready'` (post `gz:ready` ricevuto).
   *
   * @param timeoutMs - Timeout default 15000 ms.
   * @throws `MfIframeError` con `code: 'MF_IFRAME_BRIDGE_TIMEOUT'` se scaduto.
   */
  waitForReady(timeoutMs: number = 15000): Promise<void> {
    if (this.state === 'ready') return Promise.resolve()
    if (this.state === 'closed') {
      return Promise.reject(
        createMfIframeError({
          code: 'MF_IFRAME_BRIDGE_TIMEOUT',
          message: `Bridge closed prima del ready (mfId='${this.mfId}')`,
          microFrontendId: this.mfId,
        }),
      )
    }

    return new Promise<void>((resolve, reject) => {
      this.readyResolve = resolve
      this.readyReject = reject
      this.timeoutId = setTimeout(() => {
        if (this.state !== 'ready') {
          reject(
            createMfIframeError({
              code: 'MF_IFRAME_BRIDGE_TIMEOUT',
              message: `Bridge handshake timeout dopo ${timeoutMs} ms (mfId='${this.mfId}')`,
              microFrontendId: this.mfId,
              details: { timeoutMs, expectedOrigin: this.expectedOrigin },
            }),
          )
        }
      }, timeoutMs)
    })
  }

  /**
   * onMessage dispatcher principale — 5-step chain security.
   *
   * @internal
   */
  private onMessage(event: MessageEvent): void {
    if (this.state === 'closed') return

    // Step (1) Origin check FIRST — pre-parse anti-DoS
    if (event.origin !== this.expectedOrigin) {
      safePublish(this.broker, TOPIC_ORIGIN_MISMATCH, {
        received: event.origin,
        expected: this.expectedOrigin,
        mfId: this.mfId,
        timestamp: Date.now(),
      })
      return // SILENT reject — no throw cascade
    }

    // Step (2) Valibot strict parse (D-V2-F15-01)
    const parsed = v.safeParse(BridgeMessageSchema, event.data)
    if (!parsed.success) {
      safePublish(this.broker, TOPIC_SCHEMA_INVALID, {
        origin: event.origin,
        errors: parsed.issues.map((i) => i.message),
        mfId: this.mfId,
        timestamp: Date.now(),
      })
      return // SILENT reject post-emit
    }

    const msg = parsed.output

    // Step (3) Rate limit (D-V2-F15-04) — cheap fast-path drop pre-dedup
    if (this.limiter.shouldDrop(msg.microFrontendId, event.origin, this.broker)) {
      return // limiter ha emesso topic 1×/window
    }

    // Step (4) LRU + timestamp dedup (D-V2-F15-02 + D-V2-F15-03)
    if (this.dedup.isReplay(event.origin, msg.microFrontendId, msg.id, msg.timestamp)) {
      safePublish(this.broker, TOPIC_REPLAY_DETECTED, {
        mfId: msg.microFrontendId,
        origin: event.origin,
        messageId: msg.id,
        timestamp: Date.now(),
      })
      return
    }

    // Step (5) Dispatch by message type
    this.dispatch(msg)
  }

  /**
   * Dispatcher switch sui 9 message types literal.
   *
   * @internal
   */
  private dispatch(msg: IframeBridgeMessage): void {
    switch (msg.type) {
      case 'gz:handshake':
        // Host non dovrebbe ricevere gz:handshake (è host-sent). Log + ignore.
        // (In multi-host scenarios potrebbe arrivare; safe to ignore here.)
        return

      case 'gz:ready':
        if (this.state === 'handshaking' || this.state === 'idle') {
          this.state = 'ready'
          if (this.timeoutId !== undefined) {
            clearTimeout(this.timeoutId)
            this.timeoutId = undefined
          }
          this.readyResolve?.()
          delete this.readyResolve
          delete this.readyReject
        }
        return

      case 'gz:publish':
        // Forward al broker host-side (permissions enforcement via F11 facade — out of scope F15)
        safePublish(this.broker, msg.payload.topic, msg.payload.data)
        return

      case 'gz:subscribe':
        // Per F15 baseline: subscribe gestita lato consumer wiring custom. Hook stub:
        // un'implementazione completa registrerebbe handler che ri-postMessage eventi al iframe.
        // Out of scope per closure D-V2-09 (security gates priority).
        return

      case 'gz:unsubscribe':
        // Stub — vedi gz:subscribe.
        return

      case 'gz:context:get':
        // Stub — gz:context:update response handled lato consumer custom hook.
        return

      case 'gz:context:update':
        // Stub — applicare update lato host (F11 permissions enforcement).
        return

      case 'gz:error':
        safePublish(this.broker, TOPIC_CLIENT_ERROR, {
          mfId: msg.microFrontendId,
          code: msg.payload.code,
          message: msg.payload.message,
          details: msg.payload.details,
          timestamp: Date.now(),
        })
        return

      case 'gz:lifecycle':
        safePublish(this.broker, TOPIC_LIFECYCLE, {
          mfId: msg.microFrontendId,
          phase: msg.payload.phase,
          status: msg.payload.status,
          reason: msg.payload.reason,
          timestamp: Date.now(),
        })
        return
    }
  }

  /**
   * Invia un messaggio al iframe con targetOrigin dual-defense + envelope auto-enrichment.
   *
   * Esposto come public per consumer che hanno bisogno di sendare programmaticamente
   * `gz:context:update` o altri host-initiated messages.
   *
   * @throws `MfIframeError` con `code: 'MF_IFRAME_ORIGIN_MISMATCH'` se `expectedOrigin === '*'`.
   */
  sendMessage(type: IframeBridgeMessage['type'], payload: unknown): void {
    // Dual-defense runtime PRIMARY (REQ MF-IFRAME-04)
    validateTargetOrigin(this.expectedOrigin, this.mfId)

    if (this.iframe.contentWindow === null) {
      throw createMfIframeError({
        code: 'MF_IFRAME_BRIDGE_TIMEOUT',
        message: `iframe.contentWindow null per mfId='${this.mfId}' — iframe destroyed?`,
        microFrontendId: this.mfId,
      })
    }

    const envelope = {
      id: generateMessageId(),
      microFrontendId: this.mfId,
      timestamp: Date.now(),
      type,
      payload,
    }

    this.iframe.contentWindow.postMessage(envelope, this.expectedOrigin)
  }

  /**
   * Cleanup completo bridge — remove listener + state closed + reject pending readyPromise.
   *
   * Idempotent safe-to-call su MF unmount.
   */
  close(): void {
    if (this.state === 'closed') return
    this.state = 'closed'
    window.removeEventListener('message', this.messageHandler)

    if (this.timeoutId !== undefined) {
      clearTimeout(this.timeoutId)
      this.timeoutId = undefined
    }

    if (this.readyReject !== undefined) {
      this.readyReject(
        createMfIframeError({
          code: 'MF_IFRAME_BRIDGE_TIMEOUT',
          message: `Bridge closed prima del ready (mfId='${this.mfId}')`,
          microFrontendId: this.mfId,
        }),
      )
      delete this.readyResolve
      delete this.readyReject
    }
  }

  /** Snapshot state corrente (per testing/observability). */
  getState(): BridgeState {
    return this.state
  }
}
