/**
 * Tier-3 Playwright Chromium — scenario 3 lockato D-V2-F9-13: race load/mount
 * concurrent + strict identity Promise + 1 network round-trip osservato.
 *
 * Copre Success Criterion F9:
 * - SC4: Tier-3 Playwright Chromium ESM race load/mount concurrent (P-04 carryover).
 *
 * Pattern P-04 (F8 carryover):
 * - `inFlight: Map<id, Promise>` garantisce strict identity per stesso op.
 * - 2 chiamate `service.mount(id)` concurrent → `p1 === p2` (strict identity).
 * - mount hook fixture chiamato esattamente 1 volta (verificato via marker count
 *   deterministic — m-1 iter 2 plan-checker default preferred vs `page.on('request')`
 *   spy che è flaky cross-test-infra).
 *
 * URL pattern: runtime URL build (spike outcome PASS — vedi end-to-end-scenario.test.ts).
 *
 * @see D-V2-F9-13 scenario 3 + P-04 carryover F8 + PRD §10.5
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

function sampleMfUrl(): string {
  return new URL('/sample-mf.js', window.location.origin).href
}

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

describe('Tier-3 scenario 3 — race load/mount concurrent strict identity + 1 round-trip', () => {
  beforeEach(() => {
    globalThis.__mfEsmFixtureMarker = []
  })

  afterEach(() => {
    globalThis.__mfEsmFixtureMarker = []
  })

  test('concurrent mount(id) → strict identity Promise p1 === p2 (P-04)', async () => {
    const { service } = makeHarness()
    const url = sampleMfUrl()

    await service.register({
      id: 'race-mf',
      name: 'Race MF',
      version: '1.0.0',
      loader: { type: 'esm', url },
    })
    await service.load('race-mf')
    expect(service.getState('race-mf')).toBe('loaded')

    // Capture promises PRIMA dell'await — la strict identity richiede che la
    // seconda chiamata service.mount() rilevi la prima in inFlight Map e ritorni
    // la stessa Promise reference (P-04 D-V2-F8-04 carryover).
    const p1 = service.mount('race-mf')
    const p2 = service.mount('race-mf')

    // Strict identity (D-V2-F8-04 #2 carryover): p1 === p2 reference uguale.
    expect(p1).toBe(p2)

    await Promise.all([p1, p2])

    // 1 sola "network round-trip" osservata via marker count deterministic:
    // fixture sample-mf.js push 1 marker per mount() hook invocation. Se P-04
    // funziona → mount() chiamato 1 sola volta nonostante 2 mount(id) concurrent.
    expect(globalThis.__mfEsmFixtureMarker?.length).toBe(1)
    expect(globalThis.__mfEsmFixtureMarker?.[0]?.id).toBe('race-mf')

    expect(service.getState('race-mf')).toBe('mounted')
  })

  test('concurrent mount + post-resolve mount → no IN_FLIGHT leak (idempotent)', async () => {
    const { service } = makeHarness()
    const url = sampleMfUrl()

    await service.register({
      id: 'race-mf-2',
      name: 'Race MF 2',
      version: '1.0.0',
      loader: { type: 'esm', url },
    })
    await service.load('race-mf-2')

    // 5 chiamate concurrent — tutte stessa Promise (strict identity).
    const promises = Array.from({ length: 5 }, () => service.mount('race-mf-2'))
    const first = promises[0]
    for (const p of promises) {
      expect(p).toBe(first)
    }
    await Promise.all(promises)

    // mount hook fixture chiamato 1 sola volta nonostante 5 chiamate concurrent.
    expect(globalThis.__mfEsmFixtureMarker?.length).toBe(1)

    // Post-resolve idempotency check: nuova chiamata mount() su MF già mounted
    // = no-op (NON throw MF_LIFECYCLE_IN_FLIGHT — inFlight Map già pulita).
    await service.mount('race-mf-2')
    expect(service.getState('race-mf-2')).toBe('mounted')
    // mount hook chiamato sempre 1 sola volta (idempotent no-op non re-invoca hook).
    expect(globalThis.__mfEsmFixtureMarker?.length).toBe(1)
  })
})
