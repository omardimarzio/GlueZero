// vitest.setup.ts — lifecycle msw setupServer per integration test F3.
//
// Riferimento (03-13-PLAN.md):
// - listen `onUnhandledRequest: 'error'` — fallisce esplicitamente se un test
//   chiama un endpoint senza handler registrato (no fetch silente che colpisce la rete).
// - resetHandlers in afterEach — ripristina `defaultHandlers` (no leak fra test).
// - close in afterAll — cleanup MSW.
//
// Pattern ufficiale msw 2.x docs (research 03-RESEARCH.md lines 956-989).

import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from './msw-server'

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(() => {
  server.resetHandlers()
})

afterAll(() => {
  server.close()
})
