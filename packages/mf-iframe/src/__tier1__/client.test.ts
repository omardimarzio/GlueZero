/**
 * Tier-1 jsdom — `client.ts` subpath /client createIframeClient (REQ MF-IFRAME-05).
 *
 * Test in jsdom: `window.parent === window` (no iframe parent). I test verificano
 * factory shape + validate + send envelope.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createIframeClient } from '../client'

describe('createIframeClient — REQ MF-IFRAME-05 subpath isolation + REQ MF-IFRAME-04 dual-defense', () => {
  let postMessageSpy: ReturnType<typeof vi.fn>
  let originalParent: typeof window.parent

  beforeEach(() => {
    // Simulate iframe parent by replacing window.parent with mock
    postMessageSpy = vi.fn()
    originalParent = window.parent
    Object.defineProperty(window, 'parent', {
      value: {
        postMessage: postMessageSpy,
      },
      configurable: true,
      writable: true,
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'parent', {
      value: originalParent,
      configurable: true,
      writable: true,
    })
  })

  it('throws se hostOrigin empty', () => {
    expect(() => createIframeClient({ hostOrigin: '', microFrontendId: 'mf-x' })).toThrow(
      /hostOrigin/,
    )
  })

  it("throws se hostOrigin = '*' (REQ MF-IFRAME-04 wildcard ban parallel client-side)", () => {
    expect(() => createIframeClient({ hostOrigin: '*', microFrontendId: 'mf-x' })).toThrow(
      /BANNED/,
    )
  })

  it('factory returns IframeClient con surface minimal (no broker)', () => {
    const client = createIframeClient({
      hostOrigin: 'https://host.example.com',
      microFrontendId: 'mf-x',
    })
    expect(typeof client.handshake).toBe('function')
    expect(typeof client.publish).toBe('function')
    expect(typeof client.subscribe).toBe('function')
    expect(typeof client.getContext).toBe('function')
    expect(typeof client.sendError).toBe('function')
    expect(typeof client.close).toBe('function')
    // verifica NO broker exposure
    expect((client as Record<string, unknown>)['broker']).toBeUndefined()
    client.close()
  })

  it('publish — invia gz:publish envelope con hostOrigin (no wildcard)', () => {
    const client = createIframeClient({
      hostOrigin: 'https://host.example.com',
      microFrontendId: 'mf-x',
    })
    client.publish('user.action', { action: 'click' })
    expect(postMessageSpy).toHaveBeenCalledTimes(1)
    const [envelope, targetOrigin] = postMessageSpy.mock.calls[0] as [
      Record<string, unknown>,
      string,
    ]
    expect(envelope.type).toBe('gz:publish')
    expect(envelope.microFrontendId).toBe('mf-x')
    expect(envelope.payload).toEqual({ topic: 'user.action', data: { action: 'click' } })
    expect(targetOrigin).toBe('https://host.example.com')
    expect(targetOrigin).not.toBe('*')
    client.close()
  })

  it('sendError — invia gz:error envelope', () => {
    const client = createIframeClient({
      hostOrigin: 'https://host.example.com',
      microFrontendId: 'mf-x',
    })
    client.sendError('CLIENT_ERR', 'something broke', { stack: '...' })
    const [envelope] = postMessageSpy.mock.calls[0] as [Record<string, unknown>]
    expect(envelope.type).toBe('gz:error')
    expect(envelope.payload).toEqual({
      code: 'CLIENT_ERR',
      message: 'something broke',
      details: { stack: '...' },
    })
    client.close()
  })

  it('close — listener removed + close idempotent', () => {
    const client = createIframeClient({
      hostOrigin: 'https://host.example.com',
      microFrontendId: 'mf-x',
    })
    client.close()
    // Second close non throws
    expect(() => client.close()).not.toThrow()
  })

  it('handshake rejected su close pre-ready', async () => {
    const client = createIframeClient({
      hostOrigin: 'https://host.example.com',
      microFrontendId: 'mf-x',
      handshakeTimeoutMs: 50,
    })
    const pending = client.handshake()
    client.close()
    await expect(pending).rejects.toThrow(/closed/)
  })

  it('subscribe — register handler + unsubscribe revoca + invia gz:subscribe envelope', () => {
    const client = createIframeClient({
      hostOrigin: 'https://host.example.com',
      microFrontendId: 'mf-x',
    })
    const handler = vi.fn()
    const unsub = client.subscribe('theme.changed', handler)
    expect(typeof unsub).toBe('function')
    // verifica envelope subscribe inviato
    const subEnvelopes = postMessageSpy.mock.calls.filter(
      (call) => (call[0] as Record<string, unknown>).type === 'gz:subscribe',
    )
    expect(subEnvelopes).toHaveLength(1)
    // unsubscribe non throws + invia gz:unsubscribe
    unsub()
    const unsubEnvelopes = postMessageSpy.mock.calls.filter(
      (call) => (call[0] as Record<string, unknown>).type === 'gz:unsubscribe',
    )
    expect(unsubEnvelopes).toHaveLength(1)
    client.close()
  })
})
