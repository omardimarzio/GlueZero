/**
 * Tier-3 Scenario MF #1 (Chromium reale): share scope version mismatch → warn + emit
 * topic `microfrontend.mf.share.version-mismatch` + procede usando shared host
 * (D-V2-F15-10 warn-then-proceed, NO throw).
 *
 * **Strategia**: testiamo `compareShareScopes` in Chromium reale — il check di host
 * version è best-effort (3 fallback strategies per Issue #4071). Settiamo
 * `window.react = {version: '19.0.0'}` per simulare host con shared già caricato,
 * descriptor requires `^18.2` → mismatch → warn + emit topic.
 *
 * Coverage REQ MF-MF-01 + D-V2-F15-10 (warn + proceed) + Issue #4071 host detection.
 *
 * @see PLAN 15-05 Phase A — Tier-3 Playwright Chromium 8 scenari (2 MF)
 * @see SUMMARY 15-04 — share-scope-conflict.test.ts Tier-1 6 PASS
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { compareShareScopes } from '../src/share-scope-conflict.js'

interface CapturedTopic {
  topic: string
  payload: unknown
}

function makeMockBroker(): {
  captured: CapturedTopic[]
  publish: (topic: string, payload: unknown) => void
} {
  const captured: CapturedTopic[] = []
  return {
    captured,
    publish(topic, payload) {
      captured.push({ topic, payload })
    },
  }
}

describe('Tier-3 MF #1: share scope conflict warn + emit topic (D-V2-F15-10)', () => {
  let warnSpy: ReturnType<typeof vi.spyOn> | undefined
  const win = globalThis as unknown as Record<string, unknown>

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    warnSpy?.mockRestore()
    warnSpy = undefined
    delete win.react
    delete win.__webpack_share_scopes__
  })

  it('host react@19.0 requires ^18.2 → warn + emit topic + procede (NO throw)', () => {
    // Setup host: window.react.version = '19.0.0' (Strategy 1 detection)
    win.react = { version: '19.0.0' }

    const broker = makeMockBroker()
    expect(() =>
      compareShareScopes(
        { react: { requiredVersion: '^18.2.0' } },
        broker as never,
        'mf-dashboard',
      ),
    ).not.toThrow()

    // Warn captured + match regex
    expect(warnSpy).toHaveBeenCalled()
    const warnCalls = warnSpy!.mock.calls.flat().map(String).join(' | ')
    expect(warnCalls).toMatch(/\[mf-mf\]/i)
    expect(warnCalls).toMatch(/share scope version mismatch/i)
    expect(warnCalls).toMatch(/react@\^18\.2\.0/)

    // Topic emit con payload
    expect(broker.captured.length).toBe(1)
    expect(broker.captured[0]!.topic).toBe('microfrontend.mf.share.version-mismatch')
    expect(broker.captured[0]!.payload).toMatchObject({
      mfId: 'mf-dashboard',
      sharedKey: 'react',
      required: '^18.2.0',
      provided: '19.0.0',
    })
    expect(typeof (broker.captured[0]!.payload as { timestamp: number }).timestamp).toBe(
      'number',
    )
  })

  it('host react@18.2.0 requires ^18.2 → NO warn + NO emit (happy path satisfies)', () => {
    win.react = { version: '18.2.0' }

    const broker = makeMockBroker()
    compareShareScopes(
      { react: { requiredVersion: '^18.2.0' } },
      broker as never,
      'mf-happy',
    )

    expect(warnSpy).not.toHaveBeenCalled()
    expect(broker.captured.length).toBe(0)
  })

  it('host version unresolvable (Issue #4071) → NO warn NO emit (deliberato)', () => {
    // Nessun setup: niente window.unknownpkg né __webpack_share_scopes__
    const broker = makeMockBroker()
    compareShareScopes(
      { unknownpkg: { requiredVersion: '^3.4.0' } },
      broker as never,
      'mf-vue-app',
    )

    // NO false positive deliberato
    expect(warnSpy).not.toHaveBeenCalled()
    expect(broker.captured.length).toBe(0)
  })

  it('multi-shared scope: react mismatch + vue OK → 1 warn + 1 emit', () => {
    win.react = { version: '19.0.0' }
    win.vue = { version: '3.4.0' }

    const broker = makeMockBroker()
    compareShareScopes(
      {
        react: { requiredVersion: '^18.0.0' },
        vue: { requiredVersion: '^3.4.0' },
      },
      broker as never,
      'mf-multi',
    )

    expect(broker.captured.length).toBe(1)
    expect(broker.captured[0]!.payload).toMatchObject({ sharedKey: 'react' })
  })

  it('shared config senza requiredVersion → skip silently (no governance signal)', () => {
    win.react = { version: '19.0.0' }
    const broker = makeMockBroker()
    compareShareScopes({ react: { singleton: true } }, broker as never, 'mf-loose')

    expect(warnSpy).not.toHaveBeenCalled()
    expect(broker.captured.length).toBe(0)
  })
})
