// theme-inspector.test.ts — F7 plan 07-09 W5a Task 2.
//
// Tier-1 jsdom suite per `createThemeInspector` (UI-DEVTOOLS-01).
//
// Pattern role-match con `packages/devtools/src/event-inspector.test.ts` (F6
// plan 06-05): mock broker minimale (subscribe/publish wildcard `ui.*`) + assert
// su ring buffer 500 + lazy-mode + structuredClone deep-clone + clear/disable.
//
// Refs:
// - 07-09-PLAN.md Task 2 behavior 1-9
// - 07-CONTEXT.md UI-DEVTOOLS-01

import { describe, expect, it } from 'vitest'
import type { BrokerLike } from '@gluezero/theme'
import { createThemeInspector } from '../theme-inspector'

interface MockBroker extends BrokerLike {
  emit(topic: string, payload: unknown, timestamp?: number): void
}

/**
 * Mock broker minimale con supporto wildcard `ui.*`. Gestisce solo
 * subscribe/publish con match prefix sul carattere `*` finale.
 */
function createMockBroker(): MockBroker {
  const subs = new Map<
    string,
    ((event: {
      topic: string
      payload: unknown
      timestamp?: number
    }) => void)[]
  >()
  return {
    publish<P>(_topic: string, _payload: P): unknown {
      return undefined
    },
    subscribe<P>(
      topic: string,
      handler: (event: {
        topic: string
        payload: P
        source?: unknown
        timestamp?: number
      }) => void,
    ): () => void {
      const list = subs.get(topic) ?? []
      list.push(
        handler as (event: {
          topic: string
          payload: unknown
          timestamp?: number
        }) => void,
      )
      subs.set(topic, list)
      return () => {
        const cur = subs.get(topic) ?? []
        subs.set(
          topic,
          cur.filter(
            (h) =>
              h !==
              (handler as (event: {
                topic: string
                payload: unknown
                timestamp?: number
              }) => void),
          ),
        )
      }
    },
    emit(topic: string, payload: unknown, timestamp?: number): void {
      // Match wildcard `ui.*` against topic
      for (const [pattern, handlers] of subs) {
        if (
          pattern === topic ||
          (pattern.endsWith('.*') && topic.startsWith(pattern.slice(0, -2)))
        ) {
          for (const h of handlers) h({ topic, payload, timestamp })
        }
      }
    },
  }
}

describe('createThemeInspector', () => {
  it('exposes enable/disable/getBuffer/clear/getSnapshot/destroy', () => {
    const broker = createMockBroker()
    const i = createThemeInspector(broker)
    expect(typeof i.enable).toBe('function')
    expect(typeof i.disable).toBe('function')
    expect(typeof i.getBuffer).toBe('function')
    expect(typeof i.clear).toBe('function')
    expect(typeof i.getSnapshot).toBe('function')
    expect(typeof i.destroy).toBe('function')
    i.destroy()
  })

  it('captures ui.* events when enabled', () => {
    const broker = createMockBroker()
    const i = createThemeInspector(broker, { initiallyEnabled: true })
    broker.emit('ui.theme.changed', { themeId: 't1', mode: 'dark' })
    const buf = i.getBuffer()
    expect(buf.length).toBe(1)
    expect(buf[0]?.topic).toBe('ui.theme.changed')
    expect((buf[0]?.payload as { mode: string }).mode).toBe('dark')
    i.destroy()
  })

  it('captures multiple ui.* topics (theme/density/direction/adapter/osPreference)', () => {
    const broker = createMockBroker()
    const i = createThemeInspector(broker, { initiallyEnabled: true })
    broker.emit('ui.theme.changed', { mode: 'dark' })
    broker.emit('ui.density.changed', { density: 'compact' })
    broker.emit('ui.direction.changed', { dir: 'rtl' })
    broker.emit('ui.adapter.changed', { current: 'tw', cause: 'manual' })
    broker.emit('ui.osPreference.changed', { kind: 'color-scheme', value: 'dark' })
    const buf = i.getBuffer()
    expect(buf.length).toBe(5)
    const topics = buf.map((e) => e.topic)
    expect(topics).toContain('ui.theme.changed')
    expect(topics).toContain('ui.density.changed')
    expect(topics).toContain('ui.direction.changed')
    expect(topics).toContain('ui.adapter.changed')
    expect(topics).toContain('ui.osPreference.changed')
    i.destroy()
  })

  it('disabled: does not capture (hot-path early return D-160)', () => {
    const broker = createMockBroker()
    const i = createThemeInspector(broker, { initiallyEnabled: false })
    broker.emit('ui.theme.changed', { mode: 'dark' })
    expect(i.getBuffer().length).toBe(0)
    i.destroy()
  })

  it('disable clears buffer (memory hygiene T-F7-03 mitigation)', () => {
    const broker = createMockBroker()
    const i = createThemeInspector(broker, { initiallyEnabled: true })
    broker.emit('ui.theme.changed', {})
    expect(i.getBuffer().length).toBe(1)
    i.disable()
    expect(i.getBuffer().length).toBe(0)
    i.destroy()
  })

  it('cap 500 default (D-167): shift on overflow FIFO drop-oldest', () => {
    const broker = createMockBroker()
    const i = createThemeInspector(broker, { initiallyEnabled: true })
    for (let n = 0; n < 501; n++) broker.emit('ui.theme.changed', { i: n })
    const buf = i.getBuffer()
    expect(buf.length).toBe(500)
    // First entry was shifted out (i=0); first present is i=1; last present is i=500
    expect((buf[0]?.payload as { i: number }).i).toBe(1)
    expect((buf[499]?.payload as { i: number }).i).toBe(500)
    i.destroy()
  })

  it('custom bufferSize honored', () => {
    const broker = createMockBroker()
    const i = createThemeInspector(broker, { initiallyEnabled: true, bufferSize: 3 })
    for (let n = 0; n < 5; n++) broker.emit('ui.theme.changed', { i: n })
    expect(i.getBuffer().length).toBe(3)
    i.destroy()
  })

  it('getBuffer returns deep-clone (D-162) — caller mutation does not corrupt internal', () => {
    const broker = createMockBroker()
    const i = createThemeInspector(broker, { initiallyEnabled: true })
    broker.emit('ui.theme.changed', { tokens: { x: '1' } })
    const buf = i.getBuffer()
    // Mutate the result — internal state must be unaffected
    ;(buf[0]?.payload as { tokens: Record<string, string> }).tokens.x = '999'
    const buf2 = i.getBuffer()
    expect((buf2[0]?.payload as { tokens: Record<string, string> }).tokens.x).toBe('1')
    i.destroy()
  })

  it('clear empties buffer without changing enabled flag', () => {
    const broker = createMockBroker()
    const i = createThemeInspector(broker, { initiallyEnabled: true })
    broker.emit('ui.theme.changed', {})
    i.clear()
    expect(i.getBuffer().length).toBe(0)
    expect(i.getSnapshot().enabled).toBe(true)
    // post-clear ulteriori emit ancora catturati
    broker.emit('ui.theme.changed', {})
    expect(i.getBuffer().length).toBe(1)
    i.destroy()
  })

  it('getSnapshot returns frozen { bufferSize, enabled, entryCount }', () => {
    const broker = createMockBroker()
    const i = createThemeInspector(broker, { initiallyEnabled: true })
    broker.emit('ui.theme.changed', {})
    const s = i.getSnapshot()
    expect(s.bufferSize).toBe(500)
    expect(s.enabled).toBe(true)
    expect(s.entryCount).toBe(1)
    expect(Object.isFrozen(s)).toBe(true)
    i.destroy()
  })

  it('destroy unsubscribes broker (idempotent) — events post-destroy not captured', () => {
    const broker = createMockBroker()
    const i = createThemeInspector(broker, { initiallyEnabled: true })
    i.destroy()
    broker.emit('ui.theme.changed', {})
    expect(i.getBuffer().length).toBe(0)
    // Idempotent: second destroy does not throw
    expect(() => i.destroy()).not.toThrow()
  })

  it('enable() re-enables capture post disable()', () => {
    const broker = createMockBroker()
    const i = createThemeInspector(broker, { initiallyEnabled: false })
    broker.emit('ui.theme.changed', {})
    expect(i.getBuffer().length).toBe(0)
    i.enable()
    broker.emit('ui.theme.changed', {})
    expect(i.getBuffer().length).toBe(1)
    i.destroy()
  })

  it('uses event.timestamp if provided, else Date.now() fallback', () => {
    const broker = createMockBroker()
    const i = createThemeInspector(broker, { initiallyEnabled: true })
    broker.emit('ui.theme.changed', {}, 1234567890)
    broker.emit('ui.density.changed', {}) // no timestamp → fallback
    const buf = i.getBuffer()
    expect(buf[0]?.timestamp).toBe(1234567890)
    expect(buf[1]?.timestamp).toBeGreaterThan(0)
    i.destroy()
  })
})
