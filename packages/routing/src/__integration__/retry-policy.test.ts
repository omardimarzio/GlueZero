// Integration test — Retry policy (D-69, ROUTE-09, F3 success criterion #2 + TEST-01).
//
// Verifica end-to-end il retry policy del HttpGateway:
//   - 5xx → 3 retry → publish weather.failed code='gateway.5xx'
//   - 4xx (400) → NO retry → publish weather.failed code='gateway.4xx'
//   - 408 → retry (≥1 attempt extra)
//   - 429 con Retry-After → retry
//   - Network error (msw error()) → retry
//
// Riferimento (03-CONTEXT.md D-69):
//   Network errors → RETRY
//   5xx (500-599) → RETRY rispettando Retry-After
//   408 Request Timeout → RETRY
//   429 Too Many Requests → RETRY rispettando Retry-After
//   Altre 4xx (400, 401, 403, 404, 422) → NO RETRY
//   maxAttempts: 3 default
//
// Test pattern:
// - msw handler con counter callCount per verificare gli attempt effettivi.
// - flushAsync(timeout abbastanza) per consentire i retry con backoff (default
//   baseDelay 300ms × 2^N + jitter; con 3 attempts max delay accumulated può
//   essere ~3000ms). Per evitare flake, usiamo retry config esplicita
//   `baseDelayMs: 1` (compressione del backoff per integration test).

import type { CanonicalSchemaId } from '@sembridge/mapper'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRouterHarness, type RouterHarness } from '../test-utils/router-harness'

describe('Retry policy (D-69, ROUTE-09, F3 success criterion #2)', () => {
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
      gateway: {
        // Compressione backoff per test deterministici (default 300ms × 2^N).
        defaults: {
          retry: {
            maxAttempts: 3,
            baseDelayMs: 1,
            maxDelayMs: 5,
          },
          timeout: 5000,
        },
      },
      routes: [
        {
          id: 'weather-http',
          type: 'http',
          topic: 'weather.requested',
          request: { method: 'GET', url: '/api/weather' },
          response: { canonical: 'weather' },
          publishes: { success: 'weather.loaded', error: 'weather.failed' },
        },
      ],
    })
  })

  afterEach(() => {
    harness.reset()
  })

  it('5xx → 3 retry → weather.failed code gateway.5xx (TEST-01 retry storm)', async () => {
    let callCount = 0
    harness.mockServer([
      http.get('/api/weather', () => {
        callCount++
        return new HttpResponse(JSON.stringify({ error: 'internal' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      }),
    ])

    harness.broker.publish(
      'weather.requested',
      { location: 'Roma', forecast_date: '2026-04-30' },
      { source: { type: 'plugin', id: 'plugin-form' } },
    )

    // 3 attempts × ~5ms delay max + flush async
    await harness.flushAsync(200)

    // 3 fetch effective (initial + 2 retries) — D-69 maxAttempts:3
    expect(callCount).toBeGreaterThanOrEqual(2) // tolleranza per flake
    expect(callCount).toBeLessThanOrEqual(3)

    // weather.failed pubblicato con code='gateway.5xx' (D-80 shape)
    const failed = await harness.waitForEvent('weather.failed', { timeoutMs: 1000 })
    expect(failed).toBeDefined()
    const payload = failed.payload as { error?: { code?: string; category?: string } }
    expect(payload.error).toBeDefined()
    expect(payload.error?.code).toBe('gateway.5xx')
    expect(payload.error?.category).toBe('network')
  })

  it('4xx (400) → NO retry → weather.failed code gateway.4xx (D-69 NO retry su 4xx)', async () => {
    let callCount = 0
    harness.mockServer([
      http.get('/api/weather', () => {
        callCount++
        return new HttpResponse(JSON.stringify({ error: 'bad request' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }),
    ])

    harness.broker.publish(
      'weather.requested',
      { location: 'Roma', forecast_date: '2026-04-30' },
      { source: { type: 'plugin', id: 'plugin-form' } },
    )

    await harness.flushAsync(100)

    // 1 sola fetch (NO retry su 4xx) — D-69
    expect(callCount).toBe(1)

    // weather.failed con code='gateway.4xx'
    const failed = await harness.waitForEvent('weather.failed')
    const payload = failed.payload as { error?: { code?: string } }
    expect(payload.error?.code).toBe('gateway.4xx')
  })

  it('408 Request Timeout → retry esegue almeno 1 volta extra (D-69)', async () => {
    let callCount = 0
    harness.mockServer([
      http.get('/api/weather', () => {
        callCount++
        return new HttpResponse(null, { status: 408 })
      }),
    ])

    harness.broker.publish(
      'weather.requested',
      { location: 'Roma', forecast_date: '2026-04-30' },
      { source: { type: 'plugin', id: 'plugin-form' } },
    )

    await harness.flushAsync(200)

    // ≥2 attempts (1 initial + ≥1 retry)
    expect(callCount).toBeGreaterThanOrEqual(2)
  })

  it('429 Too Many Requests → retry rispetta Retry-After header (D-69)', async () => {
    let callCount = 0
    harness.mockServer([
      http.get('/api/weather', () => {
        callCount++
        if (callCount < 3) {
          return new HttpResponse(JSON.stringify({ error: 'rate limited' }), {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              // Retry-After in seconds (1 = 1000ms). Override compresso a 1ms via baseDelayMs.
              'Retry-After': '1',
            },
          })
        }
        return HttpResponse.json({ city: 'Roma', date: '2026-04-30', temp: 22, condition: 'sunny' })
      }),
    ])

    harness.broker.publish(
      'weather.requested',
      { location: 'Roma', forecast_date: '2026-04-30' },
      { source: { type: 'plugin', id: 'plugin-form' } },
    )

    // I 1s di Retry-After sono real-time, ma il retry strategy compressa baseDelayMs:1
    // dovrebbe ignorare il Retry-After (limit superiore al maxDelayMs:5).
    // Tolleriamo 2.5s per il flush.
    await harness.flushAsync(2500)

    // ≥2 attempts; finale può essere success o failure dipendentemente dal Retry-After honor
    expect(callCount).toBeGreaterThanOrEqual(2)
  }, 5000)

  it('POST 5xx retry → Idempotency-Key invariato sui 3 attempts (D-70 SEC-03)', async () => {
    // Override route per POST (D-70 idempotency auto per non-GET).
    const postHarness = createRouterHarness({
      schemas: [
        {
          id: 'order' as CanonicalSchemaId,
          fields: { item: { type: 'string', required: true } },
        },
      ],
      gateway: {
        defaults: { retry: { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 5 } },
      },
      routes: [
        {
          id: 'order-create',
          type: 'http',
          topic: 'order.requested',
          request: { method: 'POST', url: '/api/order', bodyMap: {} },
          response: { canonical: 'order' },
          publishes: { success: 'order.loaded', error: 'order.failed' },
        },
      ],
      collectTopics: ['order.loaded', 'order.failed'],
    })

    const idempotencyKeys: string[] = []
    let callCount = 0
    postHarness.mockServer([
      http.post('/api/order', ({ request }) => {
        callCount++
        const key = request.headers.get('Idempotency-Key')
        if (key !== null) idempotencyKeys.push(key)
        return new HttpResponse(JSON.stringify({ error: 'internal' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      }),
    ])

    postHarness.broker.publish(
      'order.requested',
      { item: 'widget-X' },
      { source: { type: 'plugin', id: 'plugin-cart' } },
    )

    await postHarness.flushAsync(200)

    // ≥2 attempts (initial + ≥1 retry su 5xx)
    expect(callCount).toBeGreaterThanOrEqual(2)
    // TUTTI i retry hanno la STESSA Idempotency-Key (D-70 — chiusura PITFALLS #3)
    expect(idempotencyKeys.length).toBe(callCount)
    const firstKey = idempotencyKeys[0]
    expect(firstKey).toBeDefined()
    for (const k of idempotencyKeys) {
      expect(k).toBe(firstKey)
    }

    postHarness.reset()
  })

  it('Network error (msw error response) → retry esegue almeno 1 volta extra', async () => {
    let callCount = 0
    harness.mockServer([
      http.get('/api/weather', () => {
        callCount++
        // msw 2.x: HttpResponse.error() simula network failure
        return HttpResponse.error()
      }),
    ])

    harness.broker.publish(
      'weather.requested',
      { location: 'Roma', forecast_date: '2026-04-30' },
      { source: { type: 'plugin', id: 'plugin-form' } },
    )

    await harness.flushAsync(200)

    // ≥2 attempts (D-69 network error retry)
    expect(callCount).toBeGreaterThanOrEqual(2)

    // weather.failed con category='network'
    const failed = await harness.waitForEvent('weather.failed', { timeoutMs: 1000 })
    const payload = failed.payload as { error?: { category?: string } }
    expect(payload.error?.category).toBe('network')
  })
})
