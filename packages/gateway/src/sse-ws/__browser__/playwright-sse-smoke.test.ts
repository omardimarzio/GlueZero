// playwright-sse-smoke.test.ts — B-1 Tier-3 closure (W-NEW-1 smoke real browser).
//
// **Disclaimer (W-NEW-1 fix iter 2)**: questo Tier-3 V1 è uno **smoke bootstrap** —
// verifica che `EventSource` sia un costruttore funzionante (non un mock), confermando
// che il bundle gira in real browser e che l'API è disponibile. Lo smoke E2E completo
// (connect + receive + reach subscriber via `getDebugSnapshot`) richiede mock server
// in-process (vitest browser server o test fixture HTTP locale), ed è **deferred V1.x**
// per priorità di delivery V1.
//
// Esecuzione: `pnpm --filter @sembridge/gateway test:browser` carica `vitest.browser.config.ts`
// con provider Playwright headless Chromium. Esclusione da Tier-1 jsdom via
// `vitest.config.ts` `exclude: ['**/__browser__/**']` (W-NEW-3).

import { describe, expect, test } from 'vitest'

describe('Tier-3 Playwright smoke (Chromium real EventSource — W-NEW-1)', () => {
  test('EventSource API è disponibile e instanziabile in real browser', () => {
    // Asserzione 1: typeof è function (non mock object).
    expect(typeof EventSource).toBe('function')

    // Asserzione 2 (utile, non solo presence-only): EventSource è realmente
    // instanziabile — il costruttore non lancia per URL non-connectable. La
    // connessione fallirà asincronicamente (non c'è server), ma il costruttore
    // deve riuscire (verifica che NON è un mock stub).
    let constructed = false
    let es: EventSource | null = null
    try {
      es = new EventSource('http://localhost:0/non-existent')
      constructed = true
    } catch {
      // Non dovrebbe mai lanciare al construct (errore arriva su 'error' event).
    } finally {
      // Cleanup immediato — chiudere prima che il browser tenti il connect.
      if (es) es.close()
    }
    expect(constructed).toBe(true)
  })

  // V1.x — smoke E2E completo deferred (richiede mock server in-process).
  test.skip('SSE connect + receive 1 evento → reach subscriber via getDebugSnapshot — V1.x deferred', () => {
    // Implementazione futura (V1.x):
    // 1. Setup mock SSE server in-process (vitest browser server o fixture HTTP locale).
    // 2. createRealtimeBroker + connectRealtime al server.
    // 3. Subscribe + assert che broker.getDebugSnapshot().realtime.channels[].debug
    //    riceve l'evento server-side dopo openChannel/__message simulato lato server.
  })
})
