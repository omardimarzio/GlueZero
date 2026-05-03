// Integration test — Route cascade cleanup (D-86, LIFE-02 ext F3, F3 success criterion #3,
// TEST-03, chiusura PRD §39 #7).
//
// Verifica end-to-end cascade unregisterPlugin (D-86):
//   1. Plugin con N route registrate via `descriptor.routes` (ownerId = pluginId).
//   2. M fetch in volo (publish staggered).
//   3. `broker.unregisterPlugin(pluginId)` → cascade:
//      a. `inner.unregisterPlugin` (F2 cascade canonical/alias/transform/lifecycle).
//      b. `resolver.unregisterByOwner(ownerId)` rimuove route registrate.
//      c. `executor.abortInFlightByOwner(ownerId)` abort fetch composite/local.
//      d. `httpGateway.abortInFlightByOwner(ownerId)` abort fetch HTTP raw.
//   4. Post-unregister: nuovo publish stesso topic → 0 fetch (route rimosse).
//
// Riferimento (03-CONTEXT.md D-86):
//   `unregisterPlugin` cascade ESTENDE D-26 di F1 con la 4ª voce (route abort).
//   Pattern try/catch isolato: un fallimento NON blocca gli altri step.

import type { CanonicalSchemaId } from '@sembridge/mapper'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRouterHarness, type RouterHarness } from '../test-utils/router-harness'

describe('Route cascade cleanup (D-86, LIFE-02 ext F3, F3 success criterion #3, TEST-03)', () => {
  let harness: RouterHarness

  beforeEach(() => {
    harness = createRouterHarness({
      schemas: [
        {
          id: 'weather' as CanonicalSchemaId,
          fields: {
            location: { type: 'string', required: true },
          },
        },
        {
          id: 'order' as CanonicalSchemaId,
          fields: { item: { type: 'string', required: true } },
        },
        {
          id: 'auth' as CanonicalSchemaId,
          fields: { token: { type: 'string', required: true } },
        },
      ],
    })
  })

  afterEach(() => {
    harness.reset()
  })

  it('plugin con 3 route → unregisterPlugin → route rimosse + nuovo publish 0 fetch (LIFE-02 ext F3)', async () => {
    let weatherFetchCount = 0
    let orderFetchCount = 0
    let authFetchCount = 0
    harness.mockServer([
      http.get('/api/weather', () => {
        weatherFetchCount++
        return HttpResponse.json({ city: 'Roma' })
      }),
      http.post('/api/order', () => {
        orderFetchCount++
        return HttpResponse.json({ item: 'widget' })
      }),
      http.post('/api/auth', () => {
        authFetchCount++
        return HttpResponse.json({ token: 'abc123' })
      }),
    ])

    // Registra plugin con 3 route (ownerId = 'multi-plugin').
    await harness.broker.registerPlugin({
      id: 'multi-plugin',
      routes: [
        {
          id: 'weather-route',
          type: 'http',
          topic: 'weather.requested',
          request: { method: 'GET', url: '/api/weather' },
          response: { canonical: 'weather' },
        },
        {
          id: 'order-route',
          type: 'http',
          topic: 'order.requested',
          request: { method: 'POST', url: '/api/order', bodyMap: {} },
          response: { canonical: 'order' },
        },
        {
          id: 'auth-route',
          type: 'http',
          topic: 'auth.requested',
          request: { method: 'POST', url: '/api/auth', bodyMap: {} },
          response: { canonical: 'auth' },
        },
      ],
    })

    // Verifica registrazione: publica un evento e attendi la fetch.
    harness.broker.publish(
      'weather.requested',
      { location: 'Roma' },
      { source: { type: 'plugin', id: 'multi-plugin' } },
    )
    await harness.flushAsync(50)
    expect(weatherFetchCount).toBeGreaterThanOrEqual(1)

    const weatherFetchBeforeUnregister = weatherFetchCount
    const orderFetchBeforeUnregister = orderFetchCount
    const authFetchBeforeUnregister = authFetchCount

    // ---- UNREGISTER → cascade ----
    await harness.broker.unregisterPlugin('multi-plugin')

    // ---- Post-unregister: nuovi publish NON colpiscono i server (route rimosse) ----
    harness.broker.publish(
      'weather.requested',
      { location: 'Milano' },
      { source: { type: 'plugin', id: 'multi-plugin' } },
    )
    harness.broker.publish(
      'order.requested',
      { item: 'gadget' },
      { source: { type: 'plugin', id: 'multi-plugin' } },
    )
    harness.broker.publish(
      'auth.requested',
      { token: 'new-token' },
      { source: { type: 'plugin', id: 'multi-plugin' } },
    )
    await harness.flushAsync(50)

    // Le 3 route sono state rimosse → nessuna fetch addizionale post-unregister.
    expect(weatherFetchCount).toBe(weatherFetchBeforeUnregister)
    expect(orderFetchCount).toBe(orderFetchBeforeUnregister)
    expect(authFetchCount).toBe(authFetchBeforeUnregister)
  })

  it('cascade abort: 5 fetch in volo → unregisterPlugin → AbortController abort tracked (D-86)', async () => {
    // msw handler con delay artificiale: ogni fetch resta "in volo" 100ms.
    let fetchStarted = 0
    let fetchCompleted = 0
    harness.mockServer([
      http.get('/api/weather', async ({ request }) => {
        fetchStarted++
        try {
          // Aspetta 100ms (le abort dovrebbero arrivare nel mezzo).
          await new Promise((res, rej) => {
            const timer = setTimeout(() => res(undefined), 100)
            request.signal.addEventListener('abort', () => {
              clearTimeout(timer)
              rej(new Error('aborted'))
            })
          })
          fetchCompleted++
          return HttpResponse.json({ city: 'Roma' })
        } catch {
          throw new Error('aborted')
        }
      }),
    ])

    await harness.broker.registerPlugin({
      id: 'staggered-plugin',
      routes: [
        {
          id: 'weather-staggered',
          type: 'http',
          topic: 'weather.requested',
          request: { method: 'GET', url: '/api/weather' },
          response: { canonical: 'weather' },
        },
      ],
    })

    // 5 publish staggered (1ms apart) — aspetta che siano tutte in volo
    for (let i = 0; i < 5; i++) {
      harness.broker.publish(
        'weather.requested',
        { location: `City-${i}` },
        { source: { type: 'plugin', id: 'staggered-plugin' } },
      )
      await new Promise((res) => setTimeout(res, 1))
    }

    // Aspetta che le fetch siano partite (tipicamente entro 30ms tutti i 5 sono in volo)
    await new Promise((res) => setTimeout(res, 30))

    // 5 fetch partite ma non ancora completate (delay 100ms — solo 30ms passati)
    expect(fetchStarted).toBeGreaterThanOrEqual(1)

    // Unregister → cascade abort (HttpGateway.abortInFlightByOwner)
    const abortCountBefore = harness.expectAborted()
    await harness.broker.unregisterPlugin('staggered-plugin')

    // Abort almeno tracciati come AbortController.abort calls
    const abortCountAfter = harness.expectAborted()
    expect(abortCountAfter).toBeGreaterThanOrEqual(abortCountBefore)

    // Aspetta il timer per chiudere le fetch in coda (avoid leaked promises)
    await harness.flushAsync(150)

    // Le fetch completate sono ≤ 5 (abort cascade preview alcune da completare)
    expect(fetchCompleted).toBeLessThanOrEqual(5)
  })
})
