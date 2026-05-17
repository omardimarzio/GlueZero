/**
 * Tier-1 unit suite per `iframe-stub.ts` (W2 P03 — 3 test).
 *
 * Cover REQ-IDs: MF-ISO-02 parziale (DOM mode 'iframe' stub F13 + F15 delegate).
 *
 * @see D-V2-F13-07 — iframe stub vs F15 delegation pattern
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyIframeStub, type IframeAdapter } from './iframe-stub.js'
import type { MountTarget } from './dom-isolation.js'
import type { ResolvedIsolationPolicy } from './types/policy.js'
import { DEFAULT_ISOLATION_POLICY } from './types/policy.js'

function makeMount(): MountTarget {
  const host = document.createElement('div')
  document.body.appendChild(host)
  return { element: host, context: {} }
}

function policyIframe(): ResolvedIsolationPolicy {
  return { ...DEFAULT_ISOLATION_POLICY, dom: 'iframe' }
}

describe('applyIframeStub', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('No resolver → throw BrokerError con code=IFRAME_ADAPTER_REQUIRED + category=microfrontend', () => {
    const mount = makeMount()

    try {
      applyIframeStub(mount, 'mf-1', policyIframe(), {})
      // Fail-fast: il throw deve avvenire.
      expect.unreachable('Expected throw IFRAME_ADAPTER_REQUIRED')
    } catch (err) {
      const e = err as { code?: string; category?: string; message?: string; details?: Record<string, unknown> }
      expect(e.code).toBe('IFRAME_ADAPTER_REQUIRED')
      expect(e.category).toBe('microfrontend')
      expect(e.message).toContain("no iframe adapter is registered")
      expect(e.message).toContain('mf-1')
      expect(e.details?.microFrontendId).toBe('mf-1')
      expect(e.details?.dimension).toBe('dom')
    }
  })

  it('Resolver valid → delegate createSandbox(policy, mfId, mount)', () => {
    const mount = makeMount()
    const adapter: IframeAdapter = {
      createSandbox: vi.fn(),
    }
    const policy = policyIframe()

    applyIframeStub(mount, 'mf-frame', policy, { iframeLoader: () => adapter })

    expect(adapter.createSandbox).toHaveBeenCalledTimes(1)
    expect(adapter.createSandbox).toHaveBeenCalledWith(policy, 'mf-frame', mount)
  })

  it('Signature mismatch (resolver ritorna oggetto senza createSandbox) → throw BrokerError code=POLICY_INVALID', () => {
    const mount = makeMount()

    try {
      // Resolver ritorna oggetto invalido (no createSandbox method).
      applyIframeStub(mount, 'mf-bad', policyIframe(), {
        iframeLoader: () => ({ wrongMethod: () => undefined }),
      })
      expect.unreachable('Expected throw POLICY_INVALID')
    } catch (err) {
      const e = err as { code?: string; category?: string; message?: string; details?: Record<string, unknown> }
      expect(e.code).toBe('POLICY_INVALID')
      expect(e.category).toBe('microfrontend')
      expect(e.message).toContain('does not implement createSandbox')
      expect(e.details?.reason).toBe('iframe-adapter-signature-mismatch')
    }
  })
})
