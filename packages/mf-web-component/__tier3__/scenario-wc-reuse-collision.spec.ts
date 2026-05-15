/**
 * Tier-3 Scenario WC #2: multi-instance customElements.define collision →
 * console.warn captured + customElements.get reused + metadata.reused === true (D-V2-F15-08).
 *
 * Setup: pre-registriamo `customElements.define('shared-button-N', class { ... })` prima
 * di invocare il loader. Il loader fa pre-check `customElements.get(name)` → trova
 * la classe già definita → console.warn `[mf-wc] custom element 'NAME' already defined`
 * → return reused klass + metadata.reused: true (NO throw).
 *
 * Coverage REQ MF-WC-01 reuse + D-V2-F15-08 (multi-MF stesso elementName, design system
 * primitives shared, warning-level only).
 *
 * @see PLAN 15-05 Phase A — Tier-3 Playwright Chromium 8 scenari (2 WC)
 * @see SUMMARY 15-02 — reuse-on-collision.test.ts già copre 3 test in jsdom; Tier-3
 *      valida lo stesso path in registry Chromium nativo (DOMException collision handling
 *      reale, NO jsdom polyfill).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { webComponentLoader } from '../src/wc-loader.js'

let counter = 0
function uniqueName(prefix: string): string {
  counter += 1
  return `${prefix}-${counter}-${Date.now()}`
}

function makeCtx(id = 'mf-tier3-reuse'): {
  broker: unknown
  descriptor: { id: string; name: string; version: string }
} {
  return {
    broker: {} as unknown,
    descriptor: { id, name: id, version: '1.0.0' },
  }
}

describe('Tier-3 WC #2: reuse-on-collision multi-instance + console.warn captured', () => {
  let warnSpy: ReturnType<typeof vi.spyOn> | undefined

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    warnSpy?.mockRestore()
    warnSpy = undefined
  })

  it('pre-defined customElements → loader reuse → console.warn match regex + metadata.reused true', async () => {
    const elementName = uniqueName('shared-button')

    // Pre-define customElement PRIMA del loader (simula altro MF che ha già definito
    // l'element, o app shell che ha bundlato design-system primitives).
    class SharedButton extends HTMLElement {
      static label = 'shared-design-system'
    }
    customElements.define(elementName, SharedButton)
    expect(customElements.get(elementName)).toBe(SharedButton)

    // ESM module a sua volta tenta customElements.define stesso name — loader DEVE
    // pre-checkare via customElements.get + warn + skip define + return reused klass.
    // Usiamo encodeURIComponent (Latin1-safe vs btoa unicode quirk).
    const moduleSrc = `try { class S2 extends HTMLElement {}; customElements.define('${elementName}', S2); } catch (_) {} export default null;`
    const url = `data:text/javascript,${encodeURIComponent(moduleSrc)}`

    const def = {
      type: 'web-component' as const,
      url,
      elementName,
      contextMode: 'property' as const,
      timeoutMs: 5000,
    } as Parameters<typeof webComponentLoader.load>[0]

    const loaded = await webComponentLoader.load(def, makeCtx('mf-reuse-A') as never)

    // Verifica reuse: klass returnata DEVE essere `SharedButton` (la pre-defined).
    expect(loaded.module).toBe(SharedButton)
    const meta = (loaded as { metadata?: { reused?: boolean } }).metadata
    expect(meta?.reused).toBe(true)

    // console.warn captured almeno 1 volta con regex match (D-V2-F15-08)
    expect(warnSpy).toHaveBeenCalled()
    const warnCalls = warnSpy!.mock.calls.flat().map(String).join(' | ')
    expect(warnCalls).toMatch(/\[mf-wc\]/i)
    expect(warnCalls).toMatch(new RegExp(elementName))
    expect(warnCalls).toMatch(/already defined|reusing/i)
  })

  it('2 MF stesso elementName → entrambi reused + 2 warn distinti (NO throw)', async () => {
    const elementName = uniqueName('shared-primitive')

    class Primitive extends HTMLElement {}
    customElements.define(elementName, Primitive)

    const url = `data:text/javascript,export default null;`

    const def = {
      type: 'web-component' as const,
      url,
      elementName,
      contextMode: 'property' as const,
      timeoutMs: 5000,
    } as Parameters<typeof webComponentLoader.load>[0]

    const loaded1 = await webComponentLoader.load(def, makeCtx('mf-reuse-1') as never)
    const loaded2 = await webComponentLoader.load(def, makeCtx('mf-reuse-2') as never)

    expect(loaded1.module).toBe(Primitive)
    expect(loaded2.module).toBe(Primitive)
    expect((loaded1 as { metadata?: { reused?: boolean } }).metadata?.reused).toBe(true)
    expect((loaded2 as { metadata?: { reused?: boolean } }).metadata?.reused).toBe(true)

    // Almeno 2 warn (uno per ogni MF chiamata)
    expect(warnSpy!.mock.calls.length).toBeGreaterThanOrEqual(2)
  })
})
