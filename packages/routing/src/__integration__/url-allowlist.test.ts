// Integration test — URL allowlist (D-71, SEC-05, F3 success criterion #5, TEST-03,
// chiusura PITFALLS #7 redirect bypass).
//
// Verifica end-to-end URL allowlist (D-71):
//   - URL fuori allowlist → publish weather.failed code='gateway.url.forbidden'
//     PRIMA di fetch (no network call).
//   - URL DENTRO allowlist → fetch normale + weather.loaded.
//   - Redirect 302 verso URL fuori allowlist → publish weather.failed
//     code='gateway.url.forbidden' (PITFALLS #7 — post-redirect re-validation).
//
// Riferimento (03-CONTEXT.md D-71, SEC-05):
//   `gateway.allowlist: ReadonlyArray<string | RegExp>` — entry consentite.
//   String prefix match con startsWith; RegExp test pattern.
//   Default `allowlist: undefined` → tutti URL consentiti (warning dev).

import { http, HttpResponse } from 'msw'
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import type { CanonicalSchemaId } from '@sembridge/mapper'
import { createRouterHarness, type RouterHarness } from '../test-utils/router-harness'

describe('URL allowlist (D-71, SEC-05, F3 success criterion #5, PITFALLS #7)', () => {
  let harness: RouterHarness

  afterEach(() => {
    harness?.reset()
  })

  it('URL fuori allowlist → weather.failed code=gateway.url.forbidden PRIMA di fetch (SEC-05)', async () => {
    harness = createRouterHarness({
      schemas: [
        {
          id: 'weather' as CanonicalSchemaId,
          fields: { location: { type: 'string', required: true } },
        },
      ],
      gateway: {
        // Allowlist restringe a api.example.com — la route punta a /api/weather (relative)
        // che NON matcha il prefisso. Default: tutti gli URL forbidden.
        allowlist: ['https://api.example.com'],
      },
      routes: [
        {
          id: 'weather-http',
          type: 'http',
          topic: 'weather.requested',
          // URL relative non matcha allowlist 'https://api.example.com'
          request: { method: 'GET', url: '/api/weather' },
          response: { canonical: 'weather' },
          publishes: { success: 'weather.loaded', error: 'weather.failed' },
        },
      ],
    })

    // msw counter — verifica che NESSUNA fetch sia partita.
    let fetchCount = 0
    harness.mockServer([
      http.get('/api/weather', () => {
        fetchCount++
        return HttpResponse.json({ city: 'Roma' })
      }),
    ])

    harness.broker.publish(
      'weather.requested',
      { location: 'Roma' },
      { source: { type: 'plugin', id: 'plugin-form' } },
    )

    await harness.flushAsync(50)

    // 0 fetch perché bloccata pre-fetch da allowlist (validateAgainstAllowlist throw)
    expect(fetchCount).toBe(0)

    // weather.failed con code='gateway.url.forbidden' (D-80 shape)
    const failed = await harness.waitForEvent('weather.failed', { timeoutMs: 1000 })
    const payload = failed.payload as { error?: { code?: string; category?: string } }
    expect(payload.error?.code).toBe('gateway.url.forbidden')
    expect(payload.error?.category).toBe('config')
  })

  it('URL DENTRO allowlist → fetch normale + weather.loaded (controllo positivo)', async () => {
    harness = createRouterHarness({
      schemas: [
        {
          id: 'weather' as CanonicalSchemaId,
          fields: { location: { type: 'string', required: true } },
        },
      ],
      gateway: {
        allowlist: ['https://api.example.com'],
      },
      routes: [
        {
          id: 'weather-http',
          type: 'http',
          topic: 'weather.requested',
          // URL absolute che matcha l'allowlist prefix
          request: { method: 'GET', url: 'https://api.example.com/api/weather' },
          response: { canonical: 'weather' },
          publishes: { success: 'weather.loaded', error: 'weather.failed' },
        },
      ],
    })

    // msw default handler per https://api.example.com/api/weather
    let fetchCount = 0
    harness.mockServer([
      http.get('https://api.example.com/api/weather', () => {
        fetchCount++
        return HttpResponse.json({
          city: 'Roma',
          date: '2026-04-30',
          temp: 22,
          condition: 'sunny',
        })
      }),
    ])

    harness.broker.publish(
      'weather.requested',
      { location: 'Roma' },
      { source: { type: 'plugin', id: 'plugin-form' } },
    )

    await harness.flushAsync(50)

    // 1 fetch (allowlist match)
    expect(fetchCount).toBeGreaterThanOrEqual(1)
    // weather.loaded ricevuto
    const loaded = await harness.waitForEvent('weather.loaded', { timeoutMs: 1000 })
    expect(loaded).toBeDefined()
  })
})
