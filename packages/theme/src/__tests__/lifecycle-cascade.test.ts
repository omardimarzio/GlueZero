/**
 * LIFE-02 ext F7 cascade tests (W4 plan 07-08, D-F7-06).
 *
 * Verifica cascade `unregisterPlugin → unregisterAdapter`:
 * - register adapter con `ownerPluginId`; emit `system.plugin.unregistered`
 *   {id: 'my-plugin'} → adapter rimosso + ui.adapter.changed cause='plugin-cascade'.
 * - plugin id senza adapter owned: no-op (T-F7-04 spoofing mitigation).
 * - plugin che possiede adapter ATTIVO: previous=adapterId + current=null + cause='plugin-cascade'.
 * - destroy() unsub cascade subscriber.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createThemeManager } from '../theme-manager'
import { UI_ADAPTER_CHANGED } from '../topic-constants'

interface MockBroker {
  calls: { topic: string; payload: unknown }[]
  subs: Map<string, Array<(event: { topic: string; payload: unknown }) => void>>
  publish: (topic: string, payload: unknown) => unknown
  subscribe: (
    topic: string,
    handler: (event: { topic: string; payload: unknown }) => void,
  ) => () => void
  emit: (topic: string, payload: unknown) => void
}

function createMockBroker(): MockBroker {
  const subs = new Map<
    string,
    Array<(event: { topic: string; payload: unknown }) => void>
  >()
  const calls: { topic: string; payload: unknown }[] = []
  return {
    calls,
    subs,
    publish(topic, payload) {
      calls.push({ topic, payload })
      return undefined
    },
    subscribe(topic, handler) {
      const list = subs.get(topic) ?? []
      list.push(handler)
      subs.set(topic, list)
      return () => {
        subs.set(topic, (subs.get(topic) ?? []).filter((h) => h !== handler))
      }
    },
    emit(topic, payload) {
      const list = subs.get(topic) ?? []
      for (const h of list) h({ topic, payload })
    },
  }
}

describe('LIFE-02 ext F7 cascade unregisterPlugin → unregisterAdapter', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-gz-theme')
    document.documentElement.removeAttribute('data-gz-mode')
  })
  afterEach(() => {
    document.documentElement.removeAttribute('data-gz-theme')
    document.documentElement.removeAttribute('data-gz-mode')
  })

  it('cascade removes adapter owned by unregistered plugin (non-active)', () => {
    const broker = createMockBroker()
    const tm = createThemeManager({ broker })
    tm.adapters.register(
      { id: 'tailwind', roleMap: { 'action.primary': 'btn' } },
      { ownerPluginId: 'my-plugin' },
    )
    expect(tm.adapters.has('tailwind')).toBe(true)

    broker.emit('system.plugin.unregistered', { id: 'my-plugin' })

    expect(tm.adapters.has('tailwind')).toBe(false)
    tm.destroy()
  })

  it('cascade no-op when plugin has no owned adapters (T-F7-04 spoofing mitigation)', () => {
    const broker = createMockBroker()
    const tm = createThemeManager({ broker })
    tm.adapters.register(
      { id: 'tailwind', roleMap: { 'action.primary': 'btn' } },
      { ownerPluginId: 'plugin-a' },
    )

    broker.emit('system.plugin.unregistered', { id: 'plugin-b' })

    expect(tm.adapters.has('tailwind')).toBe(true)
    const adapterCalls = broker.calls.filter((c) => c.topic === UI_ADAPTER_CHANGED)
    expect(adapterCalls.length).toBe(0)
    tm.destroy()
  })

  it('cascade emits ui.adapter.changed with cause plugin-cascade when active adapter removed', () => {
    const broker = createMockBroker()
    const tm = createThemeManager({ broker })
    tm.adapters.register(
      { id: 'tailwind', roleMap: { 'action.primary': 'btn' } },
      { ownerPluginId: 'my-plugin' },
    )
    tm.setAdapter('tailwind')
    broker.calls.length = 0

    broker.emit('system.plugin.unregistered', { id: 'my-plugin' })

    const ev = broker.calls.find((c) => c.topic === UI_ADAPTER_CHANGED)
    expect(ev).toBeDefined()
    const p = ev!.payload as {
      previous: string | null
      current: string | null
      cause: string
    }
    expect(p.previous).toBe('tailwind')
    expect(p.current).toBe(null)
    expect(p.cause).toBe('plugin-cascade')
    expect(tm.adapters.has('tailwind')).toBe(false)
    tm.destroy()
  })

  it('cascade removes ALL adapters owned by same pluginId', () => {
    const broker = createMockBroker()
    const tm = createThemeManager({ broker })
    tm.adapters.register(
      { id: 'tw', roleMap: { 'action.primary': 'btn' } },
      { ownerPluginId: 'p1' },
    )
    tm.adapters.register(
      { id: 'bt', roleMap: { 'action.primary': 'btn-primary' } },
      { ownerPluginId: 'p1' },
    )
    tm.adapters.register(
      { id: 'ma', roleMap: { 'action.primary': 'mat-primary' } },
      { ownerPluginId: 'p2' },
    )

    broker.emit('system.plugin.unregistered', { id: 'p1' })

    expect(tm.adapters.has('tw')).toBe(false)
    expect(tm.adapters.has('bt')).toBe(false)
    expect(tm.adapters.has('ma')).toBe(true)
    tm.destroy()
  })

  it('cascade ignores invalid payload (no id field)', () => {
    const broker = createMockBroker()
    const tm = createThemeManager({ broker })
    tm.adapters.register(
      { id: 'tailwind', roleMap: { 'action.primary': 'btn' } },
      { ownerPluginId: 'my-plugin' },
    )

    broker.emit('system.plugin.unregistered', { reason: 'oops' })
    broker.emit('system.plugin.unregistered', null)
    broker.emit('system.plugin.unregistered', { id: 123 })

    expect(tm.adapters.has('tailwind')).toBe(true)
    tm.destroy()
  })

  it('cascade leaves adapter without ownerPluginId untouched', () => {
    const broker = createMockBroker()
    const tm = createThemeManager({ broker })
    tm.adapters.register({ id: 'standalone', roleMap: { 'action.primary': 'btn' } })

    broker.emit('system.plugin.unregistered', { id: 'any-plugin' })

    expect(tm.adapters.has('standalone')).toBe(true)
    tm.destroy()
  })
})
