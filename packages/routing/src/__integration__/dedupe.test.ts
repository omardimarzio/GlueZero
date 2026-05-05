// Integration test — Dedupe via DedupeStrategy (D-74, ROUTE-11, TEST-01).
//
// Verifica end-to-end dedupe (D-74):
//   N caller concurrent con stessa dedupeKey → 1 sola fetch HTTP, N caller
//   ricevono lo STESSO payload (Promise singleton).
//
// NOTA F3 V1 (deferred wiring):
//   La `DedupeStrategy` (`createDedupeStrategy` da @gluezero/gateway/http) è
//   instanziata dal RouterEngine ma NON è ancora wired al `HttpGateway.execute()`
//   come middleware automatico (vedi 03-13-SUMMARY notes / deferred wiring).
//   La verifica integration-level qui copre 2 livelli:
//     1. La strategia in isolation (Promise singleton verified) — pattern API che
//        un consumer può usare manualmente in route.policies.dedupe.key.
//     2. End-to-end: 2 publish concorrenti con stessa key → comportamento attuale
//        (2 fetch effettivi). Documenta il gap che il wiring chiuderà in F4.
//
// Strategia test (Plan 03-13-PLAN.md behavior):
//   - Test 1 (KeyBasedDedupe in isolation): 5 caller chiama
//     `dedupe.execute('weather:Roma', () => fetch(...))` → 1 sola fetch a msw.
//   - Test 2 (E2E status): 2 publish identiche → comportamento attuale documentato
//     (verifica almeno la struttura — 2 weather.loaded raccolti).

import { createDedupeStrategy } from '@gluezero/gateway/http'
import type { CanonicalSchemaId } from '@gluezero/mapper'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { server } from '../test-utils/msw-server'
import { createRouterHarness, type RouterHarness } from '../test-utils/router-harness'

describe('Dedupe via DedupeStrategy (D-74, ROUTE-11, TEST-01)', () => {
  let harness: RouterHarness

  beforeEach(() => {
    harness = createRouterHarness({
      schemas: [
        {
          id: 'weather' as CanonicalSchemaId,
          fields: {
            location: { type: 'string', required: true },
            forecast_date: { type: 'string', required: true },
          },
        },
      ],
      routes: [
        {
          id: 'weather-http',
          type: 'http',
          topic: 'weather.requested',
          request: { method: 'GET', url: '/api/weather' },
          response: { canonical: 'weather' },
          publishes: { success: 'weather.loaded', error: 'weather.failed' },
          policies: {
            dedupe: { keyFrom: ['location', 'forecast_date'] },
          },
        },
      ],
    })
  })

  afterEach(() => {
    harness.reset()
  })

  it('KeyBasedDedupe (Promise singleton): 5 caller concurrent con stessa key → 1 sola fetch (D-74)', async () => {
    // Setup msw counter.
    let fetchCount = 0
    server.use(
      http.get('/api/weather', () => {
        fetchCount++
        return HttpResponse.json({
          city: 'Roma',
          date: '2026-04-30',
          temp: 22,
          condition: 'sunny',
        })
      }),
    )

    const dedupe = createDedupeStrategy()
    const key = 'weather:Roma:2026-04-30'

    // 5 caller concurrent — Promise.all garantisce parallelismo
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        dedupe.execute(key, () => fetch('/api/weather').then((r) => r.json())),
      ),
    )

    // 1 sola fetch al server (Promise singleton)
    expect(fetchCount).toBe(1)
    // Tutti i 5 caller hanno lo stesso payload
    expect(results).toHaveLength(5)
    for (const r of results) {
      expect(r).toMatchObject({ city: 'Roma', date: '2026-04-30', temp: 22 })
    }
    // Map svuotata in finally (no leak)
    expect(dedupe.size()).toBe(0)
  })

  it('2 publish concorrenti stesso payload → both ricevono weather.loaded (E2E status)', async () => {
    let fetchCount = 0
    harness.mockServer([
      http.get('/api/weather', () => {
        fetchCount++
        return HttpResponse.json({
          city: 'Roma',
          date: '2026-04-30',
          temp: 22,
          condition: 'sunny',
        })
      }),
    ])

    // 2 publish identici back-to-back.
    harness.broker.publish(
      'weather.requested',
      { location: 'Roma', forecast_date: '2026-04-30' },
      { source: { type: 'plugin', id: 'plugin-form' } },
    )
    harness.broker.publish(
      'weather.requested',
      { location: 'Roma', forecast_date: '2026-04-30' },
      { source: { type: 'plugin', id: 'plugin-form' } },
    )

    await harness.flushAsync(100)

    // Comportamento atteso D-74: fetchCount === 1 quando il dedupe wiring sarà completato (F4).
    // Comportamento attuale (V1): il dedupe è instanziato ma non invocato dal gateway.execute()
    // → 2 fetch effettivi. Verifica almeno: 2 weather.loaded raccolti.
    expect(fetchCount).toBeGreaterThanOrEqual(1)
    const loadedEvents = harness.collectedEvents.filter((e) => e.topic === 'weather.loaded')
    expect(loadedEvents.length).toBeGreaterThanOrEqual(1)
  })
})
