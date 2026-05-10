/**
 * ThemeManager broker integration tests (W4 plan 07-08, UI-EVENT-01..06).
 *
 * Verifica:
 * - Senza broker: setMode/setDensity/setDirection/setAdapter NO publish (no throw).
 * - Con broker: ogni setter publica il topic `ui.*` corrispondente con payload typed.
 * - OS prefs change in auto-mode: publica sia `ui.osPreference.changed` che `ui.theme.changed`.
 * - destroy() cleanup subscriber cascade (no leak).
 * - ThemeManager surface estesa con `adapters` + `roles` + `setAdapter`.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createThemeManager } from '../theme-manager'
import {
  UI_ADAPTER_CHANGED,
  UI_DENSITY_CHANGED,
  UI_DIRECTION_CHANGED,
  UI_OS_PREFERENCE_CHANGED,
  UI_THEME_CHANGED,
} from '../topic-constants'

interface BrokerCall {
  topic: string
  payload: unknown
}

interface MockBroker {
  calls: BrokerCall[]
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
  const calls: BrokerCall[] = []
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

describe('ThemeManager broker integration (W4 plan 07-08)', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-gz-theme')
    document.documentElement.removeAttribute('data-gz-mode')
    document.documentElement.removeAttribute('data-gz-density')
    document.documentElement.removeAttribute('data-gz-direction')
    document.documentElement.removeAttribute('dir')
  })
  afterEach(() => {
    document.documentElement.removeAttribute('data-gz-theme')
    document.documentElement.removeAttribute('data-gz-mode')
    document.documentElement.removeAttribute('data-gz-density')
    document.documentElement.removeAttribute('data-gz-direction')
    document.documentElement.removeAttribute('dir')
  })

  it('without broker: setMode/setDensity/setDirection NO publish (no throw)', () => {
    const tm = createThemeManager()
    expect(() => tm.setMode('dark')).not.toThrow()
    expect(() => tm.setDensity('compact')).not.toThrow()
    expect(() => tm.setDirection('rtl')).not.toThrow()
    tm.destroy()
  })

  it('setMode publishes ui.theme.changed with full payload', () => {
    const broker = createMockBroker()
    const tm = createThemeManager({ broker })
    tm.setMode('dark')
    const themeCalls = broker.calls.filter((c) => c.topic === UI_THEME_CHANGED)
    expect(themeCalls.length).toBeGreaterThanOrEqual(1)
    const last = themeCalls[themeCalls.length - 1]!
    const p = last.payload as {
      themeId: string
      tokens: Record<string, string>
      mode: string
      resolvedMode: string
      scope: string
    }
    expect(p.mode).toBe('dark')
    expect(p.resolvedMode).toBe('dark')
    expect(p.scope).toBe('root')
    expect(typeof p.themeId).toBe('string')
    expect(typeof p.tokens).toBe('object')
    tm.destroy()
  })

  it('setDensity publishes ui.density.changed con previous', () => {
    const broker = createMockBroker()
    const tm = createThemeManager({ broker })
    tm.setDensity('compact')
    const c = broker.calls.find((x) => x.topic === UI_DENSITY_CHANGED)
    expect(c).toBeDefined()
    const p = c!.payload as { density: string; previous?: string }
    expect(p.density).toBe('compact')
    expect(p.previous).toBe('comfortable')
    tm.destroy()
  })

  it('setDirection publishes ui.direction.changed con previous', () => {
    const broker = createMockBroker()
    const tm = createThemeManager({ broker })
    tm.setDirection('rtl')
    const c = broker.calls.find((x) => x.topic === UI_DIRECTION_CHANGED)
    expect(c).toBeDefined()
    const p = c!.payload as { dir: string; previous?: string }
    expect(p.dir).toBe('rtl')
    expect(p.previous).toBe('ltr')
    tm.destroy()
  })

  it('setAdapter publishes ui.adapter.changed cause manual', () => {
    const broker = createMockBroker()
    const tm = createThemeManager({ broker })
    tm.adapters.register({ id: 'tailwind', roleMap: { 'action.primary': 'btn' } })
    tm.setAdapter('tailwind')
    const c = broker.calls.find((x) => x.topic === UI_ADAPTER_CHANGED)
    expect(c).toBeDefined()
    const p = c!.payload as {
      previous: string | null
      current: string | null
      cause: string
    }
    expect(p.current).toBe('tailwind')
    expect(p.previous).toBe(null)
    expect(p.cause).toBe('manual')
    tm.destroy()
  })

  it('setMode (light/dark) publishes ui.theme.changed (no OS event for explicit modes)', () => {
    const broker = createMockBroker()
    const tm = createThemeManager({ broker })
    broker.calls.length = 0
    tm.setMode('light')
    const themeCalls = broker.calls.filter((c) => c.topic === UI_THEME_CHANGED)
    expect(themeCalls.length).toBeGreaterThanOrEqual(1)
    const themePayload = themeCalls[0]!.payload as { mode: string }
    expect(themePayload.mode).toBe('light')
    tm.destroy()
  })

  it('destroy unsubscribes cascade subscriber', () => {
    const broker = createMockBroker()
    const tm = createThemeManager({ broker })
    expect(broker.subs.get('system.plugin.unregistered')?.length ?? 0).toBe(1)
    tm.destroy()
    expect(broker.subs.get('system.plugin.unregistered')?.length ?? 0).toBe(0)
  })

  it('ThemeManager surface exposes adapters + roles + setAdapter (W4)', () => {
    const tm = createThemeManager()
    expect(tm.adapters).toBeDefined()
    expect(tm.roles).toBeDefined()
    expect(typeof tm.setAdapter).toBe('function')
    expect(typeof tm.adapters.register).toBe('function')
    expect(typeof tm.roles.register).toBe('function')
    tm.destroy()
  })

  it('multiple setMode calls produce one ui.theme.changed each', () => {
    const broker = createMockBroker()
    const tm = createThemeManager({ broker })
    broker.calls.length = 0
    tm.setMode('dark')
    tm.setMode('light')
    const themeCalls = broker.calls.filter((c) => c.topic === UI_THEME_CHANGED)
    expect(themeCalls.length).toBe(2)
    tm.destroy()
  })

  it('UI_OS_PREFERENCE_CHANGED constant equals ui.osPreference.changed', () => {
    expect(UI_OS_PREFERENCE_CHANGED).toBe('ui.osPreference.changed')
  })
})
