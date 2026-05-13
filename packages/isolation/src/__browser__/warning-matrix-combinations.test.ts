/**
 * Tier-3 Playwright Chromium Scenario 6: warning matrix combinations end-to-end.
 *
 * D-V2-F13-14 + MF-ISO-06: verifica le 5 combinazioni inconsistent end-to-end Chromium
 * con console.warn captured + topic emit + multi-warning composition.
 *
 * @see prd_2.0.0.md §21.9 — Warning matrix P-13 testo lockato
 * @see ROADMAP MF-ISO-06 — 5 combinazioni inconsistent
 */
import { describe, expect, it, vi } from 'vitest'
import { detectInconsistentCombinations } from '../warning-matrix.js'
import { installRegisterHook } from '../lifecycle-register-hook.js'
import { createPolicyCache } from '../internal/policy-cache.js'
import { resolvePolicy } from '../policy-resolver.js'
import { DEFAULT_ISOLATION_POLICY } from '../types/policy.js'

describe('Tier-3 Chromium — Scenario 6: warning matrix combinations', () => {
  it('P-13 js=shared-window + network=blocked → console.warn + topic emit', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const published: Array<{ topic: string; payload: unknown }> = []
    const handlers = new Map<string, Array<(p: unknown) => void>>()
    const broker = {
      subscribe(t: string, h: (p: unknown) => void): { unsubscribe: () => void } {
        const list = handlers.get(t) ?? []
        list.push(h)
        handlers.set(t, list)
        return { unsubscribe: (): void => {} }
      },
      publish(topic: string, payload: unknown): void {
        published.push({ topic, payload })
        for (const h of handlers.get(topic) ?? []) h(payload)
      },
    }

    const cache = createPolicyCache()
    installRegisterHook(broker, { cache })
    broker.publish('microfrontend.registered', {
      descriptor: {
        id: 'mf-p13',
        name: 'mf-p13',
        version: '1.0.0',
        isolation: { js: 'shared-window', network: 'blocked' },
      },
    })

    const warnings = published.filter((e) => e.topic === 'microfrontend.isolation.warning')
    expect(warnings.length).toBeGreaterThanOrEqual(1)
    expect(warnings.some((w) => (w.payload as { code: string }).code === 'P-13')).toBe(true)
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('IFRAME_EVENTS dom=iframe + events=broker-plus-dom → warning emit', () => {
    const resolved = resolvePolicy(
      { dom: 'iframe', events: 'broker-plus-dom' },
      undefined,
      'mf-iframe-evt',
    )
    const warnings = detectInconsistentCombinations(resolved, 'mf-iframe-evt')
    expect(warnings.some((w) => w.code === 'IFRAME_EVENTS')).toBe(true)
  })

  it('Multi-warning composition: js=shared-window + network=blocked + globals=isolated → P-13 + GLOBALS_ISOLATED_JS_SHARED', () => {
    const resolved = resolvePolicy(
      { js: 'shared-window', network: 'blocked', globals: 'isolated' },
      undefined,
      'mf-multi',
    )
    const warnings = detectInconsistentCombinations(resolved, 'mf-multi')
    const codes = warnings.map((w) => w.code)
    expect(codes).toContain('P-13')
    expect(codes).toContain('GLOBALS_ISOLATED_JS_SHARED')
    expect(warnings.length).toBeGreaterThanOrEqual(2)
  })

  it('STORAGE_BLOCKED_SHADOW + JS_SANDBOXED_MOUNT combinazioni derivate', () => {
    const resolved1 = resolvePolicy(
      { storage: 'blocked', dom: 'shadow-dom' },
      undefined,
      'mf-storage',
    )
    expect(detectInconsistentCombinations(resolved1, 'mf-storage').some((w) => w.code === 'STORAGE_BLOCKED_SHADOW')).toBe(true)

    const resolved2 = resolvePolicy(
      { js: 'sandboxed-iframe', dom: 'mount-root' },
      undefined,
      'mf-sandbox',
    )
    expect(detectInconsistentCombinations(resolved2, 'mf-sandbox').some((w) => w.code === 'JS_SANDBOXED_MOUNT')).toBe(true)
  })

  it('Canonical iframe MF combo → zero warning (consistent policy)', () => {
    const resolved = resolvePolicy(
      {
        dom: 'iframe',
        js: 'sandboxed-iframe',
        events: 'isolated',
        network: 'gateway-only',
      },
      undefined,
      'mf-canonical',
    )
    const warnings = detectInconsistentCombinations(resolved, 'mf-canonical')
    expect(warnings.length).toBe(0)
  })

  it('Default policy DEFAULT_ISOLATION_POLICY → zero warning', () => {
    const warnings = detectInconsistentCombinations(DEFAULT_ISOLATION_POLICY, 'mf-default')
    expect(warnings.length).toBe(0)
  })
})
