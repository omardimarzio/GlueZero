/**
 * Tier-3 Playwright Chromium — scenario 1 lockato D-V2-F9-13: full lifecycle ESM
 * end-to-end + heap snapshot post 100 mount/destroy cycle (P-06 mitigation).
 *
 * Copre Success Criteria F9:
 * - SC1: MF reale caricato da URL via ESM dynamic import + cleanup (heap snapshot).
 * - SC2 (parziale): end-to-end include publish/subscribe + cascade unsubscribe D-V2-16.
 *
 * URL pattern (spike outcome PASS Task 1 sub-step 1.5):
 *   `new URL('/sample-mf.js', window.location.origin).href` + `/* @vite-ignore *\/`
 * per bypassare il plugin `vite:import-analysis` (publicDir static asset rule). Il fixture
 * è servito da Vite dev server come asset statico (vedi `vitest.browser.config.ts`).
 *
 * Heap marker P-06 mitigation deterministic:
 *   `globalThis.__mfEsmFixtureMarker` array popolato in `mount()` hook fixture +
 *   svuotato in `unmount()`. Post 100 cycle marker.length DEVE essere 0 (zero-leak).
 *
 * Eseguito da: `pnpm --filter @gluezero/mf-esm test:browser`
 * (richiede `pnpm exec playwright install chromium` — automation in `ci:gate:f9` Task 5b).
 *
 * @see D-V2-F9-13 scenario 1 + RESEARCH §5 Tier-3 + P-06 mitigation
 */
import { createBroker, SERVICE_MICROFRONTENDS } from '@gluezero/core'
import {
  microfrontendModule,
  type MicroFrontendsService,
} from '@gluezero/microfrontends'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { mfEsmModule } from '../mf-esm-module'

declare global {
  // eslint-disable-next-line no-var
  var __mfEsmFixtureMarker: Array<{ id: string; mountedAt: number }> | undefined
}

/**
 * URL del fixture `sample-mf.js` costruito a runtime — bypass `vite:import-analysis`
 * static check (publicDir static asset rule). Verificato in spike Task 1.5 (PASS).
 */
function sampleMfUrl(): string {
  return new URL('/sample-mf.js', window.location.origin).href
}

/**
 * Crea harness broker + service (riusa pattern F8 `race-idempotency.test.ts`).
 *
 * Service Locator typed lookup + `mfEsmModule()` install che registra `esmLoader`
 * con `type: 'esm'` via `LoaderRegistry.register` (D-V2-F9-03 cascade).
 */
function makeHarness(): {
  broker: ReturnType<typeof createBroker>
  service: MicroFrontendsService
} {
  const broker = createBroker({
    modules: [microfrontendModule(), mfEsmModule()],
  })
  const service = broker.getService<MicroFrontendsService>(SERVICE_MICROFRONTENDS)
  if (!service) throw new Error('SERVICE_MICROFRONTENDS not registered')
  return { broker, service }
}

describe('Tier-3 scenario 1 — full ESM lifecycle + heap snapshot post 100 mount/destroy cycle', () => {
  beforeEach(() => {
    // Reset marker globale tra test (test isolation deterministic).
    globalThis.__mfEsmFixtureMarker = []
  })

  afterEach(() => {
    globalThis.__mfEsmFixtureMarker = []
  })

  test('full lifecycle: register → load → bootstrap → mount → publish → unmount → destroy', async () => {
    const { broker, service } = makeHarness()
    const url = sampleMfUrl()

    // Subscribe BEFORE mount per catturare il publish dal fixture mount() hook.
    const publishedEvents: Array<{ id?: string }> = []
    broker.subscribe('samplemf.mounted', (evt) => {
      publishedEvents.push(evt.payload as { id?: string })
    })

    await service.register({
      id: 'e2e-esm',
      name: 'E2E ESM Test',
      version: '1.0.0',
      loader: { type: 'esm', url },
    })
    expect(service.getState('e2e-esm')).toBe('registered')

    await service.load('e2e-esm')
    expect(service.getState('e2e-esm')).toBe('loaded')

    // mount D-V2-07 auto-bootstrap: stato → 'bootstrapped' → 'mounted'.
    await service.mount('e2e-esm')
    expect(service.getState('e2e-esm')).toBe('mounted')

    // Heap marker verifies mount() hook eseguito (fixture popola array).
    expect(globalThis.__mfEsmFixtureMarker?.length).toBe(1)
    expect(globalThis.__mfEsmFixtureMarker?.[0]?.id).toBe('e2e-esm')

    // Publish dal fixture mount() hook deve essere arrivato.
    expect(publishedEvents.length).toBeGreaterThanOrEqual(1)
    expect(publishedEvents[0]?.id).toBe('e2e-esm')

    await service.unmount('e2e-esm')
    expect(service.getState('e2e-esm')).toBe('unmounted')
    // Fixture unmount() rimuove marker (zero post unmount).
    expect(globalThis.__mfEsmFixtureMarker?.length).toBe(0)

    await service.destroy('e2e-esm')
    expect(service.getState('e2e-esm')).toBe('destroyed')

    await service.unregister('e2e-esm', { force: true })
    expect(service.list()).toHaveLength(0)
  })

  test('heap snapshot post 100 mount/destroy cycle (P-06 mitigation deterministic)', async () => {
    const { service } = makeHarness()
    const url = sampleMfUrl()

    // 100 cycle con id distinte — simula workload reale (NON id riusata).
    for (let i = 0; i < 100; i++) {
      const id = `heap-mf-${i}`
      await service.register({
        id,
        name: `Heap MF ${i}`,
        version: '1.0.0',
        loader: { type: 'esm', url },
      })
      await service.load(id)
      await service.mount(id)
      await service.unmount(id)
      await service.destroy(id)
      await service.unregister(id, { force: true })
    }

    // P-06 mitigation deterministic: marker.length === 0 post 100 cycle.
    // Fixture mount() push + unmount() splice — se cascade D-V2-16 OK ed unmount
    // viene chiamato → array vuoto.
    expect(globalThis.__mfEsmFixtureMarker?.length).toBe(0)

    // Registry empty (cascade unregister cleanup verified).
    expect(service.list()).toHaveLength(0)

    // Force GC se disponibile (Chrome --expose-gc da vitest.browser.config.ts) +
    // optional performance.measureUserAgentSpecificMemory() per validazione heap aggiuntiva.
    ;(globalThis as unknown as { gc?: () => void }).gc?.()

    const measureMemory = (
      performance as unknown as {
        measureUserAgentSpecificMemory?: () => Promise<{ bytes: number }>
      }
    ).measureUserAgentSpecificMemory
    if (measureMemory) {
      const heap = await measureMemory.call(performance)
      // Sanity: heap bytes presente + non-negativo (full assertion delta richiede baseline
      // pre-cycle che potrebbe variare cross-runner — la deterministic check è marker.length).
      expect(heap.bytes).toBeGreaterThan(0)
    }
  })
})
