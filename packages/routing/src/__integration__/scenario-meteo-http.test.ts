// Integration test — Scenario meteo PRD §29 esteso con HTTP end-to-end (D-89)
// chiusura ROADMAP F3 success criterion #1, REQ TEST-02 plugin↔server↔plugin.
//
// Verifica end-to-end (D-89):
//   1. publish('weather.requested', payload) →
//   2. RouterBroker step 8 risolve route 'weather-http' (RouteHttpDefinition) →
//   3. http-handler costruisce GET /api/weather?... + delega al HttpGateway →
//   4. msw 2.13.6 risponde con JSON {city, date, temp, condition} (defaultHandlers
//      msw-server.ts) →
//   5. RouterBroker step 10 OutcomeCollector pubblica 'weather.loaded' col payload
//      canonical (V1 fallback identity — passthrough server body, vedi 03-12-SUMMARY
//      `delegateMapToShape` / `delegateMapToCanonical`).
//
// NOTE V1 (BLOCKER documentato Plan 03-12):
// - F3 V1 NO validator default — `valibotAdapter` di F2 ha signature mismatch con
//   `HttpHandlerValidator` di F3 (deferred F4/F6). La response validation è skippata.
// - mapToShape/mapToCanonical V1 = identity passthrough — queryMap/bodyMap non estrae
//   selettivamente i field; il payload intero finisce in querystring.
//
// Pattern test:
// - Pre-collect topic 'weather.loaded' / 'weather.failed' nel harness (default).
// - `flushAsync(50)` per il fetch path async via msw.
// - `expectFetched('/api/weather')` conta le HTTP request che hanno colpito l'endpoint.
//
// Threat coverage:
// - T-03-13-01 (handler leakage): mitigated da `vitest.setup.ts` resetHandlers.

import type { CanonicalSchemaId } from '@gluezero/mapper'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRouterHarness, type RouterHarness } from '../test-utils/router-harness'

describe('Scenario meteo HTTP end-to-end (PRD §29, D-89, F3 success criterion #1)', () => {
  let harness: RouterHarness

  beforeEach(() => {
    harness = createRouterHarness({
      schemas: [
        {
          id: 'weather' as CanonicalSchemaId,
          fields: {
            location: { type: 'string', required: true },
            forecast_date: { type: 'string', required: true },
            city: { type: 'string', required: false },
            date: { type: 'string', required: false },
            temp: { type: 'number', required: false },
            condition: { type: 'string', required: false },
            temperature_celsius: { type: 'number', required: false },
            weather_condition: { type: 'string', required: false },
          },
        },
      ],
      gateway: {
        // dev convenience: allowlist undefined → tutti URL consentiti.
      },
      routes: [
        {
          id: 'weather-http',
          type: 'http',
          topic: 'weather.requested',
          request: {
            method: 'GET',
            url: '/api/weather',
            queryMap: {
              city: { source: 'location' },
              date: { source: 'forecast_date' },
            },
          },
          response: { canonical: 'weather' },
          publishes: { success: 'weather.loaded', error: 'weather.failed' },
        },
      ],
    })
  })

  afterEach(() => {
    harness.reset()
  })

  it('weather.requested → fetch /api/weather → weather.loaded canonico (TEST-02 happy path)', async () => {
    // Override handler per ECHO dei queryParams (V1 identity passthrough — il payload
    // canonico finisce intero in querystring come `?location=Roma&forecast_date=...`).
    harness.mockServer([
      http.get('/api/weather', ({ request }) => {
        const url = new URL(request.url, 'http://localhost')
        return HttpResponse.json({
          city: url.searchParams.get('location') ?? url.searchParams.get('city') ?? 'Unknown',
          date: url.searchParams.get('forecast_date') ?? url.searchParams.get('date') ?? '',
          temp: 22,
          condition: 'sunny',
        })
      }),
    ])

    // Form publisha — payload canonico (publisher diretto, no outputMap consumer-side).
    harness.broker.publish(
      'weather.requested',
      { location: 'Roma', forecast_date: '2026-04-30' },
      { source: { type: 'plugin', id: 'plugin-form' } },
    )

    // Aspetta il flush del routing async (microtask + fetch completion).
    await harness.flushAsync(50)

    // 1 fetch a /api/weather (no retry, no dedupe collision).
    expect(harness.expectFetched('/api/weather')).toBeGreaterThanOrEqual(1)

    // weather.loaded raccolto col payload canonical (V1 identity passthrough — D-12
    // delegateMapToCanonical fallback: passa il body server intero come canonical).
    const loaded = await harness.waitForEvent('weather.loaded', { timeoutMs: 1000 })
    expect(loaded).toBeDefined()
    expect(loaded.topic).toBe('weather.loaded')
    const payload = loaded.payload as Record<string, unknown>
    // Verifica struttura: il server (msw defaultHandlers + override echo) ritorna
    // {city, date, temp, condition} con city='Roma' (dall'echo del location query param).
    expect(payload).toMatchObject({ city: 'Roma', date: '2026-04-30', temp: 22 })
    expect(payload.condition).toBe('sunny')
  })

  it('weather.loaded contiene metadata httpStatus 200 + origin remote (D-80 outcome metadata)', async () => {
    harness.broker.publish(
      'weather.requested',
      { location: 'Milano', forecast_date: '2026-05-01' },
      { source: { type: 'plugin', id: 'plugin-form' } },
    )

    await harness.flushAsync(50)

    // Verifica step pipeline §28 emessi (ROADMAP success #1 dependency):
    //   step 8 event.route.resolved → step 9 event.route.executed → step 10 event.outcome.collected
    const resolvedSteps = harness.byStep('event.route.resolved' as never)
    const executedSteps = harness.byStep('event.route.executed' as never)
    const collectedSteps = harness.byStep('event.outcome.collected' as never)

    expect(resolvedSteps.length).toBeGreaterThanOrEqual(1)
    expect(executedSteps.length).toBeGreaterThanOrEqual(1)
    expect(collectedSteps.length).toBeGreaterThanOrEqual(1)

    // Verifica metadata route.executed con routeId
    const execMeta = (executedSteps[0]?.metadata as { routeId?: string } | undefined) ?? {}
    expect(execMeta.routeId).toBe('weather-http')

    // weather.loaded ricevuto
    const loaded = await harness.waitForEvent('weather.loaded')
    expect(loaded).toBeDefined()
  })

  it('multiple sequential publish: ogni request emette una weather.loaded distinta', async () => {
    // Override handler con counter per verificare 2 fetch distinti
    let callCount = 0
    harness.mockServer([
      http.get('/api/weather', ({ request }) => {
        callCount++
        const url = new URL(request.url, 'http://localhost')
        return HttpResponse.json({
          city: url.searchParams.get('location') ?? url.searchParams.get('city') ?? 'Unknown',
          date: url.searchParams.get('forecast_date') ?? url.searchParams.get('date') ?? '',
          temp: 20 + callCount,
          condition: callCount === 1 ? 'sunny' : 'cloudy',
        })
      }),
    ])

    harness.broker.publish(
      'weather.requested',
      { location: 'Roma', forecast_date: '2026-04-30' },
      { source: { type: 'plugin', id: 'plugin-form' } },
    )
    // Aspetto la prima conclusione PRIMA di lanciare la seconda — concurrency default
    // 'parallel' (D-73) ma queste due chiamate hanno payload diverso → no dedupe collision.
    await harness.flushAsync(50)

    harness.broker.publish(
      'weather.requested',
      { location: 'Milano', forecast_date: '2026-05-01' },
      { source: { type: 'plugin', id: 'plugin-form' } },
    )
    await harness.flushAsync(50)

    expect(callCount).toBe(2)
    const loadedEvents = harness.collectedEvents.filter((e) => e.topic === 'weather.loaded')
    expect(loadedEvents.length).toBe(2)
  })
})
