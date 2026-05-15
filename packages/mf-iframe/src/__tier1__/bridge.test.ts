/**
 * Tier-1 jsdom — `bridge.ts` BridgeManager — onMessage 5-step chain + handshake +
 * sendMessage dual-defense.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Broker } from '@gluezero/core'
import { BridgeManager } from '../bridge'
import { DedupRegistry } from '../lru-dedup'
import { MfIframeError } from '../errors'
import { RateLimiter } from '../rate-limiter'

function createMockBroker(): Broker & {
  _publishes: Array<{ topic: string; payload: unknown }>
} {
  const publishes: Array<{ topic: string; payload: unknown }> = []
  const publish = vi.fn((topic: string, payload: unknown) => {
    publishes.push({ topic, payload })
  })
  return {
    publish,
    _publishes: publishes,
  } as unknown as Broker & { _publishes: typeof publishes }
}

function createMockIframe(): HTMLIFrameElement {
  const iframe = document.createElement('iframe')
  // Mock contentWindow.postMessage per jsdom
  Object.defineProperty(iframe, 'contentWindow', {
    value: {
      postMessage: vi.fn(),
    },
    configurable: true,
  })
  return iframe
}

function buildHandshakeFromIframe(): Record<string, unknown> {
  return {
    id: 'handshake-1',
    microFrontendId: 'mf-x',
    timestamp: Date.now(),
    type: 'gz:handshake',
    payload: { protocolVersion: 'gz:bridge/1.0', expectedHostOrigin: 'https://host.com' },
  }
}

function buildReady(): Record<string, unknown> {
  return {
    id: 'ready-1',
    microFrontendId: 'mf-x',
    timestamp: Date.now(),
    type: 'gz:ready',
    payload: { protocolVersion: 'gz:bridge/1.0' },
  }
}

function buildPublish(topic: string, data: unknown): Record<string, unknown> {
  return {
    id: `pub-${Math.random().toString(36).slice(2, 8)}`,
    microFrontendId: 'mf-x',
    timestamp: Date.now(),
    type: 'gz:publish',
    payload: { topic, data },
  }
}

describe('BridgeManager — onMessage 5-step dispatcher + handshake', () => {
  let bridges: BridgeManager[] = []

  beforeEach(() => {
    bridges = []
  })

  afterEach(() => {
    for (const b of bridges) {
      try {
        b.close()
      } catch {
        // ignore
      }
    }
  })

  function newBridge(broker: Broker): BridgeManager {
    const bridge = new BridgeManager({
      iframe: createMockIframe(),
      expectedOrigin: 'https://iframe.example.com',
      mfId: 'mf-x',
      broker,
      dedup: new DedupRegistry(),
      limiter: new RateLimiter(),
    })
    bridges.push(bridge)
    return bridge
  }

  it('handshake → state ready on gz:ready dispatch', async () => {
    const broker = createMockBroker()
    const bridge = newBridge(broker)

    const readyPromise = bridge.waitForReady(5000)
    // Simula gz:ready
    window.dispatchEvent(
      new MessageEvent('message', {
        data: buildReady(),
        origin: 'https://iframe.example.com',
      }),
    )

    await expect(readyPromise).resolves.toBeUndefined()
    expect(bridge.getState()).toBe('ready')
  })

  it('handshake timeout MF_IFRAME_BRIDGE_TIMEOUT se ready non arriva', async () => {
    const broker = createMockBroker()
    const bridge = newBridge(broker)
    await expect(bridge.waitForReady(50)).rejects.toBeInstanceOf(MfIframeError)
  })

  it('origin mismatch emit topic + SILENT reject (no throw cascade)', () => {
    const broker = createMockBroker()
    const bridge = newBridge(broker)
    window.dispatchEvent(
      new MessageEvent('message', {
        data: buildPublish('test', null),
        origin: 'https://EVIL.com',
      }),
    )
    expect(broker._publishes).toContainEqual(
      expect.objectContaining({ topic: 'microfrontend.iframe.origin-mismatch' }),
    )
    bridge.close()
  })

  it('Valibot schema-invalid emit topic + SILENT reject', () => {
    const broker = createMockBroker()
    const bridge = newBridge(broker)
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { foo: 'bar' }, // shape malformed
        origin: 'https://iframe.example.com',
      }),
    )
    expect(broker._publishes).toContainEqual(
      expect.objectContaining({ topic: 'microfrontend.iframe.schema-invalid' }),
    )
    bridge.close()
  })

  it('gz:publish dispatch → broker.publish chiamato con topic+data', () => {
    const broker = createMockBroker()
    const bridge = newBridge(broker)
    window.dispatchEvent(
      new MessageEvent('message', {
        data: buildPublish('user.action', { x: 1 }),
        origin: 'https://iframe.example.com',
      }),
    )
    expect(broker._publishes).toContainEqual({ topic: 'user.action', payload: { x: 1 } })
    bridge.close()
  })

  it('sendMessage throws MF_IFRAME_ORIGIN_MISMATCH se expectedOrigin = *', () => {
    const bridge = new BridgeManager({
      iframe: createMockIframe(),
      expectedOrigin: '*', // banned
      mfId: 'mf-x',
      broker: createMockBroker(),
      dedup: new DedupRegistry(),
      limiter: new RateLimiter(),
    })
    bridges.push(bridge)
    expect(() => bridge.sendMessage('gz:handshake', { protocolVersion: 'gz:bridge/1.0' })).toThrow(
      MfIframeError,
    )
  })

  it('close — idempotent + state = closed', () => {
    const broker = createMockBroker()
    const bridge = newBridge(broker)
    bridge.close()
    expect(bridge.getState()).toBe('closed')
    expect(() => bridge.close()).not.toThrow()
  })

  it('replay detect — secondo msg con stesso id reject + emit replay-detected', () => {
    const broker = createMockBroker()
    const bridge = newBridge(broker)
    const msg = buildPublish('topic', 1)
    msg.id = 'fixed-id'
    window.dispatchEvent(
      new MessageEvent('message', { data: msg, origin: 'https://iframe.example.com' }),
    )
    // primo dispatch → broker.publish
    expect(broker._publishes).toContainEqual({ topic: 'topic', payload: 1 })
    // secondo dispatch stesso id → replay
    window.dispatchEvent(
      new MessageEvent('message', { data: msg, origin: 'https://iframe.example.com' }),
    )
    expect(broker._publishes).toContainEqual(
      expect.objectContaining({ topic: 'microfrontend.iframe.replay-detected' }),
    )
    bridge.close()
  })
})
