// glue-zero-theme.test.ts — Tier-1 jsdom test plan 07-10 W5b (D-F7-07).
//
// Verifica composition aggregate `createGlueZero({ theme? })` opt-in:
// - default (no theme) → field `.theme` ritorna null (zero regressione F1-F6)
// - con theme → field `.theme` espone l'handle Theme con manager/applyTokens/etc.
// - aggregate.theme.manager.setMode applica DOM (`<html data-gz-theme=…>`)
// - typecheck Theme da `@gluezero/theme/factory` (peer optional D-F7-07)
// - zero regressione su altri field (publish/subscribe/getDebugSnapshot) quando
//   theme è omesso o presente.
//
// **D-F7-01 Opzione B standalone**: il theme NON wrappa il broker — è un handle
// separato passato in input. L'aggregate lo espone via passthrough getter.

import { createTheme } from '@gluezero/theme/factory'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createGlueZero } from '../glue-zero'

function cleanupThemeAttrs(): void {
  document.documentElement.removeAttribute('data-gz-theme')
  document.documentElement.removeAttribute('data-gz-mode')
  document.documentElement.removeAttribute('data-gz-density')
  document.documentElement.removeAttribute('data-gz-direction')
}

describe('createGlueZero + theme (D-F7-07 W5b)', () => {
  beforeEach(() => {
    cleanupThemeAttrs()
  })
  afterEach(() => {
    cleanupThemeAttrs()
  })

  it('Test 1 — default: no theme passato → broker.theme === null', () => {
    const broker = createGlueZero({})
    expect(broker.theme).toBeNull()
  })

  it('Test 2 — opt-in: con theme passato, broker.theme === theme handle', () => {
    const theme = createTheme({})
    const broker = createGlueZero({ theme })
    expect(broker.theme).toBe(theme)
    expect(broker.theme?.manager).toBeDefined()
    theme.destroy()
  })

  it('Test 3 — aggregate.theme.manager.setMode applica DOM `data-gz-theme`', () => {
    const theme = createTheme({})
    const broker = createGlueZero({ theme })
    broker.theme?.manager.setMode('dark')
    expect(document.documentElement.getAttribute('data-gz-theme')).toBe('dark')
    theme.destroy()
  })

  it('Test 4 — aggregate.theme.applyTokens passthrough funziona', () => {
    const theme = createTheme({})
    const broker = createGlueZero({ theme })
    expect(() =>
      broker.theme?.applyTokens({ 'color-primary': '#FF6B35' }),
    ).not.toThrow()
    theme.destroy()
  })

  it('Test 5 — zero regressione: createGlueZero({}) preserva publish/subscribe', async () => {
    const broker = createGlueZero({})
    const received: unknown[] = []
    broker.subscribe('w5b.topic', (ev: { payload: unknown }) =>
      received.push(ev.payload),
    )
    broker.publish('w5b.topic', { v: 1 }, {
      source: { type: 'plugin', id: 'app' },
    } as never)
    await new Promise((r) => setTimeout(r, 10))
    expect(received).toEqual([{ v: 1 }])
    expect(broker.theme).toBeNull()
  })

  it('Test 6 — zero regressione: createGlueZero({ theme }) preserva chain F1-F6 (devtools outermost default)', async () => {
    const theme = createTheme({})
    const broker = createGlueZero({ theme }) as ReturnType<
      typeof createGlueZero
    > & {
      getDebugSnapshot?: () => unknown
    }
    // Devtools default-active → getDebugSnapshot disponibile
    expect(typeof broker.getDebugSnapshot).toBe('function')
    // Chain end-to-end ancora funzionante
    const received: unknown[] = []
    broker.subscribe('w5b.chain.topic', (ev: { payload: unknown }) =>
      received.push(ev.payload),
    )
    broker.publish('w5b.chain.topic', { v: 2 }, {
      source: { type: 'plugin', id: 'app' },
    } as never)
    await new Promise((r) => setTimeout(r, 10))
    expect(received).toEqual([{ v: 2 }])
    // Theme handle disponibile in passthrough
    expect(broker.theme).toBe(theme)
    theme.destroy()
  })

  it('Test 7 — broker.theme è readonly (Object.defineProperty writable: false)', () => {
    const theme = createTheme({})
    const broker = createGlueZero({ theme })
    // strict mode: assignment a readonly property throws TypeError
    expect(() => {
      ;(broker as { theme: unknown }).theme = null
    }).toThrow(TypeError)
    theme.destroy()
  })

  it('Test 8 — broker.theme è non-enumerable (no impatto su Object.keys/spread)', () => {
    const theme = createTheme({})
    const broker = createGlueZero({ theme })
    // Object.keys non include `theme` → consumer pre-W5b che fa spread/iterate
    // sulle chiavi enumerable NON viene impattato.
    expect(Object.keys(broker)).not.toContain('theme')
    // Ma il field è accessibile direttamente
    expect(broker.theme).toBe(theme)
    theme.destroy()
  })

  it('Test 9 — D-30 anti-singleton: due aggregate con theme distinti restano isolati', () => {
    const themeA = createTheme({})
    const themeB = createTheme({})
    const brokerA = createGlueZero({ theme: themeA })
    const brokerB = createGlueZero({ theme: themeB })
    expect(brokerA).not.toBe(brokerB)
    expect(brokerA.theme).toBe(themeA)
    expect(brokerB.theme).toBe(themeB)
    expect(brokerA.theme).not.toBe(brokerB.theme)
    themeA.destroy()
    themeB.destroy()
  })

  it('Test 10 — features opt-out + theme: theme esposto anche su chain minimal F1+F2+F3', () => {
    const theme = createTheme({})
    const broker = createGlueZero({
      theme,
      features: {
        cache: false,
        devtools: false,
        worker: false,
        realtime: false,
      },
    })
    expect(broker.theme).toBe(theme)
    expect(typeof broker.publish).toBe('function')
    expect(typeof broker.subscribe).toBe('function')
    theme.destroy()
  })
})
