/**
 * Tier-1 unit tests — Reuse-on-collision (D-V2-F15-08).
 *
 * Coverage:
 * - customElements.get(elementName) reuse path quando element già definito
 * - console.warn match regex `[mf-wc] custom element '...' already defined`
 * - 2 MF entrambi includono stesso elementName → 2° MF reusa + warn
 * - metadata.reused: true permette devtools discriminare collision vs first-define
 *
 * Environment: jsdom.
 *
 * @see D-V2-F15-08 — Multi-instance reuse-on-collision + warning (NO throw)
 */
import { describe, expect, it, vi } from 'vitest'
import type {
  LoaderContext,
  MicroFrontendLoaderDefinition,
} from '@gluezero/microfrontends'
import { webComponentLoader } from '../wc-loader'

let counter = 0
function uniqueName(prefix: string): string {
  counter += 1
  return `${prefix}-${counter}-${Date.now()}`
}

function makeCtx(id: string): LoaderContext {
  return {
    broker: {} as unknown as LoaderContext['broker'],
    descriptor: { id, name: id, version: '1.0.0' } as LoaderContext['descriptor'],
  }
}

function makeDef(elementName: string): MicroFrontendLoaderDefinition {
  return {
    type: 'web-component',
    url: 'data:text/javascript,export%20default%20{}',
    elementName,
  } as MicroFrontendLoaderDefinition
}

describe('Reuse-on-collision (D-V2-F15-08)', () => {
  it('element pre-defined → console.warn match regex + return reused klass + metadata.reused: true', async () => {
    const name = uniqueName('mf-collide')
    class CollidingElement extends HTMLElement {}
    customElements.define(name, CollidingElement)

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const loaded = await webComponentLoader.load(makeDef(name), makeCtx('mf-b'))
      expect(loaded.module).toBe(CollidingElement)
      expect(loaded.metadata?.['reused']).toBe(true)
      expect(warnSpy).toHaveBeenCalled()
      const msg = warnSpy.mock.calls[0]![0] as string
      expect(msg).toMatch(
        new RegExp(`\\[mf-wc\\] custom element '${name}' already defined`),
      )
      expect(msg).toContain('mfId=mf-b')
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('reuse-on-collision NON throw (warning-level, no error)', async () => {
    const name = uniqueName('mf-no-throw')
    class NoThrowElement extends HTMLElement {}
    customElements.define(name, NoThrowElement)

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      // Non deve throw — solo warn + reuse
      await expect(webComponentLoader.load(makeDef(name), makeCtx('mf-x'))).resolves.toBeDefined()
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('2 MF entrambi importano stesso elementName → 2ndo MF reusa klass del 1mo + warn', async () => {
    const name = uniqueName('mf-shared-button')
    class SharedButton extends HTMLElement {}
    customElements.define(name, SharedButton)

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const loadedA = await webComponentLoader.load(makeDef(name), makeCtx('mf-a'))
      const loadedB = await webComponentLoader.load(makeDef(name), makeCtx('mf-b'))

      // Entrambi ricevono la stessa klass (la prima registrata)
      expect(loadedA.module).toBe(SharedButton)
      expect(loadedB.module).toBe(SharedButton)
      expect(loadedA.metadata?.['reused']).toBe(true)
      expect(loadedB.metadata?.['reused']).toBe(true)
      // Warn chiamato 2 volte (una per ogni MF)
      expect(warnSpy).toHaveBeenCalledTimes(2)
      // Ogni warn cita il rispettivo mfId
      expect(warnSpy.mock.calls[0]![0]).toContain('mfId=mf-a')
      expect(warnSpy.mock.calls[1]![0]).toContain('mfId=mf-b')
    } finally {
      warnSpy.mockRestore()
    }
  })
})
