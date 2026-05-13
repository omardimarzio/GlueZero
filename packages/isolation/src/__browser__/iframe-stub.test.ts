/**
 * Tier-3 Playwright Chromium Scenario 3: iframe stub throw IFRAME_ADAPTER_REQUIRED + FSM failed mock.
 *
 * D-V2-F13-14 + D-V2-F13-07: jsdom supporta error path, Chromium permette verifica
 * isolation crittografica iframe sandbox future F15 (qui solo stub).
 *
 * @see prd_2.0.0.md §21.4 — iframe DOM mode delegate
 * @see D-V2-F13-07 — iframe stub vs F15 delegation
 */
import { describe, expect, it, vi } from 'vitest'
import { applyIframeStub } from '../iframe-stub.js'
import { DEFAULT_ISOLATION_POLICY } from '../types/policy.js'

describe('Tier-3 Chromium — Scenario 3: iframe stub IFRAME_ADAPTER_REQUIRED', () => {
  it('No resolver → throw BrokerError code IFRAME_ADAPTER_REQUIRED + category microfrontend', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const mount = { element: host, context: {} }
    let caught: unknown
    try {
      applyIframeStub(mount, 'mf-iframe-1', { ...DEFAULT_ISOLATION_POLICY, dom: 'iframe' }, {})
    } catch (e) {
      caught = e
    }
    expect(caught).toBeDefined()
    expect((caught as { code?: string }).code).toBe('IFRAME_ADAPTER_REQUIRED')
    expect((caught as { category?: string }).category).toBe('microfrontend')
    document.body.removeChild(host)
  })

  it('FSM → failed transition simulato via mock broker publish chain', () => {
    const broker = {
      published: [] as Array<{ topic: string; payload: unknown }>,
      publish(topic: string, payload: unknown): void {
        this.published.push({ topic, payload })
      },
    }
    const host = document.createElement('div')
    document.body.appendChild(host)
    const mount = { element: host, context: {} }

    let caught: unknown
    try {
      applyIframeStub(mount, 'mf-iframe-2', { ...DEFAULT_ISOLATION_POLICY, dom: 'iframe' }, {})
    } catch (e) {
      caught = e
      // F8 FSM transition simulated by host
      broker.publish('microfrontend.lifecycle.state', {
        id: 'mf-iframe-2',
        state: 'failed',
        reason: (e as { code: string }).code,
      })
    }
    expect(caught).toBeDefined()
    expect(broker.published[0]?.topic).toBe('microfrontend.lifecycle.state')
    expect((broker.published[0]?.payload as { state: string }).state).toBe('failed')
    document.body.removeChild(host)
  })

  it('Valid adapter resolver → createSandbox delegated correttamente', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const mount = { element: host, context: {} }
    const createSandbox = vi.fn()
    const adapter = { createSandbox }
    applyIframeStub(
      mount,
      'mf-iframe-3',
      { ...DEFAULT_ISOLATION_POLICY, dom: 'iframe' },
      { iframeLoader: (): typeof adapter => adapter },
    )
    expect(createSandbox).toHaveBeenCalledTimes(1)
    expect(createSandbox).toHaveBeenCalledWith(
      expect.objectContaining({ dom: 'iframe' }),
      'mf-iframe-3',
      mount,
    )
    document.body.removeChild(host)
  })
})
