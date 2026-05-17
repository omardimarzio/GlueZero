/**
 * Tier-3 Playwright Chromium scenario: React 19 `StrictMode` double-mount in dev →
 * NO duplicate side-effect.
 *
 * Verifica P-05 mitigation: `useGlueZeroSubscribe` pattern `useEffect + useRef
 * stable handler` NON causa duplicate subscription o duplicate publish in
 * `StrictMode` dev double-mount.
 *
 * jsdom test (Tier-1) approxima StrictMode ma non garantisce React 19
 * exact double-invoke dev semantics — Tier-3 reale browser è gate.
 *
 * @see MF-TEST-03 scenario (React-specific gap-filling)
 * @see P-05 StrictMode double-mount
 * @see D-V2-F17-01 useEffect+useRef pattern
 */
import { describe, it, expect } from 'vitest'
import { useEffect } from 'react'
import { createBroker } from '@gluezero/core'
import { createReactMicroFrontendLifecycle } from '../../src/factory.js'
import { useGlueZeroSubscribe } from '../../src/hooks/use-gluezero-subscribe.js'

describe('React 19 StrictMode double-mount safety — Tier-3 Playwright Chromium', () => {
  it('useGlueZeroSubscribe NO duplicate delivery anche in StrictMode dev', async () => {
    const broker = createBroker({})
    let invokeCount = 0
    const handler = (): void => {
      invokeCount++
    }

    function SubscriberComp(): JSX.Element {
      useGlueZeroSubscribe('topic.x', handler)
      return <span data-testid="sub">subscribed</span>
    }

    // strictMode default true (D-V2-F17-04)
    const lifecycle = createReactMicroFrontendLifecycle(SubscriberComp, {
      strictMode: true,
    })
    const target = document.createElement('div')
    document.body.appendChild(target)

    try {
      await lifecycle.bootstrap(broker)
      await lifecycle.mount(target)
      // 2 RAF + setTimeout per garantire React 19 useEffect + StrictMode
      // double-mount completato (useEffect è async post-paint).
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
      await new Promise<void>((r) => setTimeout(r, 10))

      // Single publish — assicura sync delivery per test deterministico
      broker.publish(
        'topic.x',
        {},
        { source: { type: 'plugin', id: 'test' }, deliveryMode: 'sync' },
      )
      await new Promise<void>((r) => requestAnimationFrame(() => r()))

      // StrictMode in dev: mountUnmount+mount → useEffect cleanup+resub.
      // Pattern useEffect+useRef stable handler garantisce single subscription
      // attiva al momento della publish → exactly 1 delivery.
      expect(invokeCount).toBe(1)

      await lifecycle.destroy()
    } finally {
      document.body.removeChild(target)
    }
  })

  it('useEffect cleanup invocato correttamente su unmount completo', async () => {
    const broker = createBroker({})
    let mountedFlag = 0

    function EffectComp(): JSX.Element {
      useEffect(() => {
        mountedFlag++
        return () => {
          mountedFlag--
        }
      }, [])
      return <span>effect</span>
    }

    const lifecycle = createReactMicroFrontendLifecycle(EffectComp, {
      strictMode: true,
    })
    const target = document.createElement('div')
    document.body.appendChild(target)

    try {
      await lifecycle.bootstrap(broker)
      await lifecycle.mount(target)
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
      await new Promise<void>((r) => setTimeout(r, 10))

      // StrictMode dev: mount + unmount + mount → mountedFlag ≥ 1 (alla fine
      // sempre 1 active mount netto). In produzione StrictMode è no-op = 1.
      expect(mountedFlag).toBeGreaterThanOrEqual(1)

      await lifecycle.unmount()
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
      await new Promise<void>((r) => setTimeout(r, 10))

      // After unmount: cleanup eseguito → mountedFlag = 0
      expect(mountedFlag).toBe(0)

      await lifecycle.destroy()
    } finally {
      document.body.removeChild(target)
    }
  })
})
