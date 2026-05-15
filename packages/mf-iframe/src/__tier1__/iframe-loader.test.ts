/**
 * Tier-1 jsdom — `iframe-loader.ts` iframeLoader factory + createSandbox F13 sblocco
 * duck-typing (D-V2-F15-21).
 *
 * Test focali: factory shape + validation expectedOrigin + sandbox baseline + warn
 * allow-same-origin + createSandbox delegate F13.
 */
import { describe, expect, it, vi } from 'vitest'
import { iframeLoader } from '../iframe-loader'
import { MfIframeError } from '../errors'

describe('iframeLoader — factory + IframeAdapter F13 sblocco (D-V2-F15-21)', () => {
  it('factory returns adapter con type/load/unload/createSandbox shape', () => {
    const adapter = iframeLoader()
    expect(adapter.type).toBe('iframe')
    expect(typeof adapter.load).toBe('function')
    expect(typeof adapter.unload).toBe('function')
    expect(typeof adapter.createSandbox).toBe('function')
  })

  it('createSandbox — F13 sblocco crea iframe + applica sandbox + mutation cast (D-V2-F15-21)', () => {
    const adapter = iframeLoader()
    const mockElement = document.createElement('div')
    const mount = { element: mockElement }
    adapter.createSandbox({ dom: 'iframe' }, 'mf-x', mount)
    // Strategy A mutation cast — mount.element ora dovrebbe essere iframe
    expect((mount.element as HTMLElement).tagName).toBe('IFRAME')
    expect((mount.element as HTMLIFrameElement).getAttribute('sandbox')).toBe('allow-scripts')
    expect((mount.element as HTMLIFrameElement).getAttribute('data-gz-mf-id')).toBe('mf-x')
  })

  it('createSandbox — applica policy.sandbox override se string', () => {
    const adapter = iframeLoader()
    const mount = { element: document.createElement('div') }
    adapter.createSandbox(
      { dom: 'iframe', sandbox: 'allow-scripts allow-forms' },
      'mf-y',
      mount,
    )
    expect((mount.element as HTMLIFrameElement).getAttribute('sandbox')).toBe(
      'allow-scripts allow-forms',
    )
  })

  it('load — throws MF_IFRAME_ORIGIN_MISMATCH se expectedOrigin = *', async () => {
    const adapter = iframeLoader()
    const broker = { publish: vi.fn() } as never
    const definition = {
      type: 'iframe' as const,
      url: 'https://iframe.example.com',
      expectedOrigin: '*', // banned
    }
    const ctx = {
      broker,
      descriptor: {
        id: 'mf-x',
        loader: definition,
      },
    } as never
    await expect(adapter.load(definition, ctx)).rejects.toBeInstanceOf(MfIframeError)
  })

  it('load — throws se url undefined', async () => {
    const adapter = iframeLoader()
    const definition = {
      type: 'iframe' as const,
      url: '' as string,
      expectedOrigin: 'https://iframe.example.com',
    }
    const ctx = {
      broker: { publish: vi.fn() },
      descriptor: { id: 'mf-x', loader: definition },
    } as never
    await expect(adapter.load(definition, ctx)).rejects.toBeInstanceOf(MfIframeError)
  })

  it('load — sandbox baseline default allow-scripts se sandbox undefined', async () => {
    const adapter = iframeLoader()
    const definition = {
      type: 'iframe' as const,
      url: 'https://iframe.example.com',
      expectedOrigin: 'https://iframe.example.com',
      bridge: false, // skip handshake per test
    }
    const ctx = {
      broker: { publish: vi.fn() },
      descriptor: { id: 'mf-x', loader: definition },
    } as never
    const loaded = await adapter.load(definition, ctx)
    expect(loaded.module).toBeInstanceOf(HTMLIFrameElement)
    expect((loaded.module as HTMLIFrameElement).getAttribute('sandbox')).toBe('allow-scripts')
    expect(loaded.metadata).toMatchObject({
      url: 'https://iframe.example.com',
      expectedOrigin: 'https://iframe.example.com',
      sandbox: 'allow-scripts',
    })
  })

  it("load — warn console se sandbox include 'allow-same-origin' (REQ MF-SEC-01 T-15-07)", async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const adapter = iframeLoader()
    const definition = {
      type: 'iframe' as const,
      url: 'https://iframe.example.com',
      expectedOrigin: 'https://iframe.example.com',
      sandbox: 'allow-scripts allow-same-origin',
      bridge: false,
    }
    const ctx = {
      broker: { publish: vi.fn() },
      descriptor: { id: 'mf-x', loader: definition },
    } as never
    await adapter.load(definition, ctx)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('allow-same-origin'),
    )
    warnSpy.mockRestore()
  })

  it('load — bridge: false skip handshake + LoadedModule shape minimale', async () => {
    const adapter = iframeLoader()
    const definition = {
      type: 'iframe' as const,
      url: 'https://iframe.example.com',
      expectedOrigin: 'https://iframe.example.com',
      bridge: false,
    }
    const ctx = {
      broker: { publish: vi.fn() },
      descriptor: { id: 'mf-y', loader: definition },
    } as never
    const loaded = await adapter.load(definition, ctx)
    expect(loaded.module).toBeInstanceOf(HTMLIFrameElement)
    expect(typeof loaded.lifecycle.mount).toBe('function')
    expect(typeof loaded.lifecycle.unmount).toBe('function')
    expect(loaded.metadata?.['bridge']).toBe(false)
  })
})
