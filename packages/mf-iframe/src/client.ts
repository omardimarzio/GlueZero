/**
 * `@gluezero/mf-iframe/client` — Subpath separato per code che gira **dentro** l'iframe
 * (REQ MF-IFRAME-05 lockato + REQ MF-IFRAME-04 + closure D-V2-09 BLOCKING).
 *
 * ## Scope V2.0
 *
 * Code minimal postMessage wrapper per MF code in-iframe. **NO broker completo
 * esposto cross-frame** — bridge surface ridotta a publish/subscribe + context get +
 * handshake + lifecycle.
 *
 * ## Audit gate: subpath isolation (REQ MF-IFRAME-05)
 *
 * Questo file NON deve importare `@gluezero/core` né `@gluezero/microfrontends` —
 * verificato via tsup `external` + audit-grep `dist/client.js` per `broker` token
 * = 0 match. publint + attw subpath validation in CI gate.
 *
 * Vincoli:
 *  - NO Valibot import (host-side responsibility — bundle minimo ≤ 3 KB gzip).
 *  - NO broker import (REQ MF-IFRAME-05 strict).
 *  - ID generation via `crypto.randomUUID()` native (no nanoid dep — savings ~130B).
 *  - `hostOrigin` MANDATORY (REQ MF-IFRAME-04 dual-defense client-side parallel).
 *  - `targetOrigin '*'` BANNED client-side (parallel host).
 *
 * @see REQ MF-IFRAME-05 — subpath separato (no broker completo cross-frame)
 * @see REQ MF-IFRAME-04 — expectedOrigin/targetOrigin enforcement client-side
 * @see PRD §26 — Iframe Loader + Bridge
 * @see D-V2-F15-01 — protocolVersion 'gz:bridge/1.0' shared host+client
 * @packageDocumentation
 */

/**
 * Marker placeholder export per attw/publint subpath audit (W1 carryover).
 *
 * `grep "__mfIframeClientLoaded" packages/mf-iframe/dist/client.js` deve MATCH per
 * confermare il bundle subpath sia stato generato e tree-shake non l'abbia rimosso.
 *
 * @see REQ MF-IFRAME-05
 */
export const __mfIframeClientLoaded: true = true

/**
 * Protocol version condiviso fra host + client (D-V2-F15-01).
 *
 * MUST match `bridge-schemas.ts` HandshakeSchema literal (gz:bridge/1.0).
 */
const PROTOCOL_VERSION = 'gz:bridge/1.0' as const

/**
 * Default timeout per handshake (allineato `BridgeManager.waitForReady`).
 */
const DEFAULT_HANDSHAKE_TIMEOUT_MS = 15000

/**
 * Opzioni `createIframeClient` factory.
 */
export interface IframeClientOptions {
  /**
   * Host origin atteso per ogni `postMessage` outgoing — **MANDATORY**.
   * MUST match `IframeLoaderDefinition.expectedOrigin` host-side.
   * `'*'` è BANNED runtime (REQ MF-IFRAME-04 parallel).
   */
  readonly hostOrigin: string

  /**
   * microFrontendId — propagato in envelope `microFrontendId` per ogni messaggio.
   */
  readonly microFrontendId: string

  /**
   * Timeout handshake (default 15000 ms).
   */
  readonly handshakeTimeoutMs?: number
}

/**
 * Surface pubblica `IframeClient` esposta al MF code in-iframe.
 *
 * Minimal surface — solo helper utili (publish/subscribe/getContext/handshake/sendError).
 * NON espone broker completo (REQ MF-IFRAME-05).
 */
export interface IframeClient {
  /**
   * Handshake protocol: send `gz:handshake` to host + await `gz:ready` ACK.
   * MUST chiamare prima di publish/subscribe.
   *
   * @throws Error con message `'mf-iframe-client: handshake timeout'` se scaduto.
   */
  readonly handshake: () => Promise<void>

  /**
   * Publish event al broker host-side via `gz:publish` envelope.
   *
   * @param topic - Topic broker (non vuoto).
   * @param data - Payload event (deve essere strutturalmente clonabile).
   */
  readonly publish: (topic: string, data: unknown) => void

  /**
   * Subscribe a topic — handler riceve eventi propagati dal host via `gz:publish`
   * outbound dal bridge handler dispatch.
   *
   * @param topic - Topic broker pattern.
   * @param handler - Callback evento.
   * @returns Funzione `unsubscribe()` idempotent.
   */
  readonly subscribe: (topic: string, handler: (data: unknown) => void) => () => void

  /**
   * Request snapshot RuntimeContext (F10) — await response `gz:context:update`.
   *
   * @param keys - Filtri opzionali per snapshot parziale.
   */
  readonly getContext: (keys?: readonly string[]) => Promise<Record<string, unknown>>

  /**
   * Send error event al host (`gz:error` envelope).
   */
  readonly sendError: (code: string, message: string, details?: Record<string, unknown>) => void

  /**
   * Cleanup: removeEventListener + reject pending promises.
   */
  readonly close: () => void
}

/**
 * Validate hostOrigin client-side — `'*'` BANNED (REQ MF-IFRAME-04 dual-defense parallel).
 *
 * @internal
 */
function validateHostOrigin(hostOrigin: string): void {
  if (!hostOrigin || typeof hostOrigin !== 'string') {
    throw new Error(
      `mf-iframe-client: hostOrigin mancante o non-string — REQ MF-IFRAME-04 MANDATORY`,
    )
  }
  if (hostOrigin === '*') {
    throw new Error(
      `mf-iframe-client: hostOrigin '*' BANNED — REQ MF-IFRAME-04 wildcard ban. Usa origin specifico host (es. 'https://host.example.com').`,
    )
  }
}

/**
 * Generate ID minimal — `crypto.randomUUID()` se disponibile, altrimenti fallback time-random.
 *
 * @internal
 */
function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Factory `IframeClient` minimal in-iframe SDK.
 *
 * Esegue **dentro** l'iframe (non sul host). Lo script consumer deve essere caricato
 * come ESM module dall'URL passato a `IframeLoaderDefinition.url`.
 *
 * @example Inside iframe code
 * ```ts
 * import { createIframeClient } from '@gluezero/mf-iframe/client'
 *
 * const client = createIframeClient({
 *   hostOrigin: 'https://host.example.com', // MANDATORY non-'*'
 *   microFrontendId: 'analytics-iframe',
 * })
 *
 * await client.handshake() // attendi gz:ready ACK
 *
 * client.publish('user.action', { action: 'click', x: 100, y: 200 })
 *
 * const unsubscribe = client.subscribe('theme.changed', (data) => {
 *   console.log('theme changed:', data)
 * })
 *
 * const context = await client.getContext(['tenantId', 'locale'])
 * console.log('runtime context:', context)
 *
 * // su unload
 * unsubscribe()
 * client.close()
 * ```
 *
 * @throws Error se `hostOrigin` invalid (mancante / `'*'` wildcard).
 * @see REQ MF-IFRAME-05 — client subpath isolation
 */
export function createIframeClient(opts: IframeClientOptions): IframeClient {
  validateHostOrigin(opts.hostOrigin)

  const hostOrigin = opts.hostOrigin
  const mfId = opts.microFrontendId
  const handshakeTimeoutMs =
    typeof opts.handshakeTimeoutMs === 'number' &&
    Number.isFinite(opts.handshakeTimeoutMs) &&
    opts.handshakeTimeoutMs > 0
      ? opts.handshakeTimeoutMs
      : DEFAULT_HANDSHAKE_TIMEOUT_MS

  let closed = false
  const subscribers = new Map<string, Set<(data: unknown) => void>>()
  const pendingContext: Map<string, (ctx: Record<string, unknown>) => void> = new Map()
  let readyResolve: (() => void) | undefined
  let readyReject: ((err: Error) => void) | undefined

  // Send envelope helper — applica hostOrigin (no '*' parallel).
  function send(type: string, payload: unknown): void {
    if (closed) return
    if (typeof window === 'undefined' || window.parent === window) {
      throw new Error(
        `mf-iframe-client: not running inside an iframe (window.parent === self) — mfId='${mfId}'`,
      )
    }
    const envelope = {
      id: generateId(),
      microFrontendId: mfId,
      timestamp: Date.now(),
      type,
      payload,
    }
    window.parent.postMessage(envelope, hostOrigin)
  }

  // Message listener per gz:ready + gz:publish (host → iframe) + gz:context:update.
  function onMessage(ev: MessageEvent): void {
    if (closed) return
    // Origin check parallel — accetta solo messaggi dal host atteso
    if (ev.origin !== hostOrigin) return
    const data = ev.data
    if (typeof data !== 'object' || data === null) return
    const msg = data as { type?: string; payload?: unknown; correlationId?: string }
    if (typeof msg.type !== 'string') return

    switch (msg.type) {
      case 'gz:ready': {
        if (readyResolve !== undefined) {
          readyResolve()
          readyResolve = undefined
          readyReject = undefined
        }
        return
      }
      case 'gz:publish': {
        const payload = msg.payload as { topic?: string; data?: unknown } | undefined
        if (payload === undefined || typeof payload.topic !== 'string') return
        const handlers = subscribers.get(payload.topic)
        if (handlers !== undefined) {
          for (const handler of handlers) {
            try {
              handler(payload.data)
            } catch {
              // Defensive — handler errors must not affect dispatch.
            }
          }
        }
        return
      }
      case 'gz:context:update': {
        const corrId = msg.correlationId
        if (typeof corrId === 'string' && pendingContext.has(corrId)) {
          const resolve = pendingContext.get(corrId)
          pendingContext.delete(corrId)
          const payload = msg.payload as { partial?: Record<string, unknown> } | undefined
          resolve?.(payload?.partial ?? {})
        }
        return
      }
      default:
        return
    }
  }

  window.addEventListener('message', onMessage)

  return {
    handshake(): Promise<void> {
      if (closed) {
        return Promise.reject(
          new Error(`mf-iframe-client: closed (mfId='${mfId}')`),
        )
      }
      return new Promise<void>((resolve, reject) => {
        readyResolve = resolve
        readyReject = reject
        send('gz:handshake', {
          protocolVersion: PROTOCOL_VERSION,
          expectedHostOrigin: hostOrigin,
        })
        setTimeout(() => {
          if (readyReject !== undefined) {
            readyReject(
              new Error(
                `mf-iframe-client: handshake timeout dopo ${handshakeTimeoutMs} ms (mfId='${mfId}')`,
              ),
            )
            readyResolve = undefined
            readyReject = undefined
          }
        }, handshakeTimeoutMs)
      })
    },

    publish(topic: string, data: unknown): void {
      send('gz:publish', { topic, data })
    },

    subscribe(topic: string, handler: (data: unknown) => void): () => void {
      let handlers = subscribers.get(topic)
      if (handlers === undefined) {
        handlers = new Set()
        subscribers.set(topic, handlers)
        send('gz:subscribe', { topic, subscriptionId: `${topic}::${generateId()}` })
      }
      handlers.add(handler)
      return (): void => {
        const set = subscribers.get(topic)
        if (set === undefined) return
        set.delete(handler)
        if (set.size === 0) {
          subscribers.delete(topic)
          send('gz:unsubscribe', { subscriptionId: `${topic}::cleanup` })
        }
      }
    },

    getContext(keys?: readonly string[]): Promise<Record<string, unknown>> {
      const correlationId = generateId()
      return new Promise<Record<string, unknown>>((resolve) => {
        pendingContext.set(correlationId, resolve)
        if (closed) {
          pendingContext.delete(correlationId)
          resolve({})
          return
        }
        const envelope = {
          id: generateId(),
          microFrontendId: mfId,
          timestamp: Date.now(),
          correlationId,
          type: 'gz:context:get',
          payload: { keys: keys ?? undefined },
        }
        if (typeof window === 'undefined' || window.parent === window) {
          pendingContext.delete(correlationId)
          resolve({})
          return
        }
        window.parent.postMessage(envelope, hostOrigin)
      })
    },

    sendError(code: string, message: string, details?: Record<string, unknown>): void {
      send('gz:error', { code, message, details })
    },

    close(): void {
      if (closed) return
      closed = true
      window.removeEventListener('message', onMessage)
      if (readyReject !== undefined) {
        readyReject(new Error(`mf-iframe-client: closed (mfId='${mfId}')`))
        readyResolve = undefined
        readyReject = undefined
      }
      subscribers.clear()
      pendingContext.clear()
    },
  }
}
