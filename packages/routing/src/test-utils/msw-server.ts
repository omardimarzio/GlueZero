// msw-server.ts — `setupServer` (msw 2.13.6 Node mode) per integration test F3.
//
// Riferimento (03-13-PLAN.md, 03-CONTEXT.md D-89):
// - msw è hoisted a livello root devDependencies (`/Users/omarmarzio/programming/prova AI/GlueZero/package.json`).
// - `defaultHandlers` copre il PRD §29 happy-path (`GET /api/weather` → 200 JSON con
//   `{city, date, temp, condition}`). Ogni integration test override-a via `server.use(...)`
//   in beforeEach/it per scenari 5xx/4xx/408/429/network-error/redirect/etc.
// - `vitest.setup.ts` (sibling) configura il lifecycle listen/resetHandlers/close.
//
// Vincolo D-83: nessuna modifica a packages/core/ né packages/mapper/.
//
// Threat coverage:
// - T-03-13-01 (Tampering — handler leakage tra test): mitigate via `server.resetHandlers()`
//   in `afterEach` del setup (vedi `vitest.setup.ts`).

import { HttpResponse, http, type RequestHandler } from 'msw'
import { setupServer } from 'msw/node'

/**
 * Default handlers MSW per il PRD §29 weather happy-path.
 *
 * Ogni integration test può override-are via `server.use(...newHandlers)` per scenari
 * 5xx/4xx/408/429/network-error/redirect/etc. Il `resetHandlers` in `afterEach` riporta
 * lo stato a `defaultHandlers` puro (no leak fra test).
 */
export const defaultHandlers: readonly RequestHandler[] = [
  http.get('/api/weather', ({ request }) => {
    const url = new URL(request.url, 'http://localhost')
    return HttpResponse.json({
      city: url.searchParams.get('city') ?? 'Unknown',
      date: url.searchParams.get('date') ?? '',
      temp: 22,
      condition: 'sunny',
    })
  }),
  // Pattern allowed/forbidden URL: l'allowlist test usa entrambi i prefissi.
  http.get('https://api.example.com/api/weather', ({ request }) => {
    const url = new URL(request.url)
    return HttpResponse.json({
      city: url.searchParams.get('city') ?? 'Unknown',
      date: url.searchParams.get('date') ?? '',
      temp: 22,
      condition: 'sunny',
    })
  }),
]

/**
 * `setupServer` instance condivisa fra integration test del package routing.
 *
 * Configurato con `defaultHandlers`. Lifecycle gestito da `vitest.setup.ts`.
 *
 * Type inferito (`ReturnType<typeof setupServer>`) per evitare conflitto fra
 * `SetupServerApi` esposto al barrel `msw/node` (con #private + network) e il
 * runtime `SetupServer` ritornato dalla factory.
 */
export const server: ReturnType<typeof setupServer> = setupServer(...defaultHandlers)
