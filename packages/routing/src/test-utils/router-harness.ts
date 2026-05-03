// router-harness.ts — fixture condivisa per integration test del package
// `@sembridge/routing` (PRD §29 D-89 scenario meteo HTTP, REQ TEST-01/02/03).
//
// Razionale (03-13-PLAN.md, 03-PATTERNS.md §G):
// Estende `createMapperHarness` di F2 (template autoritativo) con:
//   - `routes?: readonly RouteDefinition[]` — pre-registrate al boot
//   - `gateway?: GatewayConfig` — config gateway test-friendly
//   - `mockServer(handlers)` — wrapper di `server.use(...)` (msw 2.13.6 Node mode)
//   - `collect(topic)` — subscribe esplicito + accumulate in `collectedEvents`
//   - `expectFetched(matcher)` — count delle fetch effettuate (msw `request:start`)
//   - `expectRetryAttempts(routeId)` — count degli step `event.route.executed` per routeId
//   - `expectAborted(eventId?)` — count degli AbortController.aborted nelle fetch
//
// Vincolo D-83: il harness USA `createRouterBroker` (F3 plan 03-12) — NON modifica
// né F1 né F2 runtime. Il broker compone MapperBroker privato + RouterEngine.
//
// Pattern subscribe BLOCKER 3 fix (Plan 03-12 SUMMARY):
//   `RouterBroker.subscribe<T>(...args)` è delegate esplicito a `inner.subscribe`.
//   NIENTE optional chaining `?.subscribe` — il delegate è sempre presente.
//
// Pattern collect:
//   I test dichiarano i topic di interesse via `harness.collect('weather.loaded')`.
//   Ogni evento pubblicato sul topic finisce in `harness.collectedEvents` con
//   `{ topic, payload }`. Pattern coerente con F2 weather-scenario test (subscribe
//   esplicito con array push).
//
// Threat coverage:
// - T-03-13-01 (Tampering — handler leakage): mitigated da `vitest.setup.ts` che
//   chiama `server.resetHandlers()` in afterEach.
// - T-03-13-02 (DoS — timer real flake): test che usano timer fake (`vi.useFakeTimers()`)
//   sono responsabili di chiamare `vi.useRealTimers()` nel teardown. Il harness NON
//   forza timer mode.

import type { EventTap, PipelineSnapshot, PipelineStep } from '@sembridge/core'
import type { GatewayConfig } from '@sembridge/gateway/http'
import type { CanonicalSchema, TransformFn } from '@sembridge/mapper'
import type { RequestHandler } from 'msw'
import { vi } from 'vitest'
import { createRouterBroker, type RouterBroker } from '../public-factory'
import type { RouteDefinition } from '../types/route-definition'
import { server } from './msw-server'

/**
 * Opzioni accettate da `createRouterHarness({ ... })`.
 *
 * Tutti i campi opzionali — la harness genera default ragionevoli per riprodurre
 * il behavior di production con tap osservabile.
 */
export interface RouterHarnessOptions {
  /** Abilita debug mode del Broker (`payloadAfter` snapshots). */
  readonly debug?: boolean
  /** Schemas canonici registrati al boot via `canonicalModel.schemas`. */
  readonly schemas?: readonly CanonicalSchema[]
  /** Transforms registrati al boot via `transforms`. */
  readonly transforms?: Readonly<Record<string, TransformFn>>
  /** Alias globali registrati al boot via `aliasRegistry.global`. */
  readonly aliases?: Readonly<Record<string, string>>
  /** RouteDefinition pre-registrate al boot. */
  readonly routes?: readonly RouteDefinition[]
  /** GatewayConfig (auth/allowlist/defaults/circuitBreaker). */
  readonly gateway?: GatewayConfig
  /** RoutingConfig (multipleRoutesPolicy / requiresRouteTopics). */
  readonly routing?: {
    readonly multipleRoutesPolicy?: 'first-match' | 'priority-ordered' | 'all'
    readonly emitAmbiguousWarning?: boolean
    readonly requiresRouteTopics?: readonly string[]
  }
  /**
   * Topic da pre-collezionare automaticamente al boot del harness. Ogni evento
   * pubblicato sui topic dichiarati finisce in `harness.collectedEvents`. Equivale
   * a chiamare `harness.collect(topic)` per ogni topic dopo il boot.
   *
   * Default: `['weather.loaded', 'weather.failed', 'routing.ambiguous',
   * 'routing.composite.deferred']` (i topic standard F3 emessi dal RouterBroker
   * + outcome collector per scenari weather).
   */
  readonly collectTopics?: readonly string[]
}

/**
 * Evento raccolto dal harness via subscribe esplicito.
 */
export interface CollectedEvent {
  readonly topic: string
  readonly payload: unknown
}

/**
 * Harness ritornata da `createRouterHarness`.
 */
export interface RouterHarness {
  readonly broker: RouterBroker
  readonly steps: Array<{ step: PipelineStep; snapshot: PipelineSnapshot }>
  readonly collectedEvents: CollectedEvent[]
  reset(): void
  byStep(step: PipelineStep): PipelineSnapshot[]
  /**
   * Sottoscrive un topic per accumulare gli eventi in `collectedEvents`.
   * Pattern usato dai test per capture esplicito (NO wildcard automatic).
   */
  collect(topic: string): void
  /**
   * Wrapper di `server.use(...)` per override per-test degli handlers msw.
   * Stato precedente ripristinato da `afterEach` (vedi `vitest.setup.ts`).
   */
  mockServer(handlers: RequestHandler[]): void
  /**
   * Conta le fetch HTTP che matchano `matcher` (string includes oppure RegExp.test
   * sull'URL). Riusato da retry/dedupe/concurrency test.
   */
  expectFetched(matcher: string | RegExp): number
  /**
   * Conta gli step `event.route.executed` emessi per il `routeId` indicato.
   * Riusato da retry-policy test per asserire attemptCount.
   */
  expectRetryAttempts(routeId: string): number
  /**
   * Conta gli AbortController.signal.aborted=true tracciati dal harness.
   * Riusato da concurrency-latest-only e route-cascade-cleanup test.
   */
  expectAborted(): number
  /**
   * Aspetta un microtask + N ms (default 0) per consentire il flush delle Promise
   * pending del routing async. Pattern coerente con F2 D-01 (deliveryMode 'async').
   */
  flushAsync(ms?: number): Promise<void>
  /** Aspetta finché un evento sul topic dato è collezionato (con timeout). */
  waitForEvent(topic: string, opts?: { timeoutMs?: number }): Promise<CollectedEvent>
}

const DEFAULT_COLLECT_TOPICS: readonly string[] = [
  'weather.loaded',
  'weather.failed',
  'routing.ambiguous',
  'routing.composite.deferred',
]

/**
 * Crea un `RouterHarness` per integration test F3.
 *
 * @example
 * ```ts
 * const h = createRouterHarness({
 *   schemas: [{ id: 'weather' as never, fields: { location: { type: 'string' } } }],
 *   routes: [{
 *     id: 'weather-http', type: 'http', topic: 'weather.requested',
 *     request: { method: 'GET', url: '/api/weather' },
 *     response: { canonical: 'weather' },
 *   }],
 * })
 * h.broker.publish('weather.requested', { location: 'Roma' })
 * await h.flushAsync(50)
 * expect(h.expectFetched('/api/weather')).toBe(1)
 * const loaded = h.collectedEvents.find((e) => e.topic === 'weather.loaded')
 * expect(loaded).toBeDefined()
 * ```
 */
export function createRouterHarness(options: RouterHarnessOptions = {}): RouterHarness {
  const steps: RouterHarness['steps'] = []
  const collectedEvents: CollectedEvent[] = []
  const tap: EventTap = {
    onPipelineStep(step, snapshot): void {
      steps.push({ step, snapshot })
    },
  }

  // Tracker delle fetch eseguite verso msw — `server.events.on('request:start', ...)`
  // notifica per ogni request che arriva al mock server (incluse retry interne).
  const fetchTracker: Array<{ url: string; method: string }> = []
  const fetchListener = ({ request }: { request: Request }): void => {
    fetchTracker.push({ url: request.url, method: request.method })
  }
  server.events.on('request:start', fetchListener)

  // Tracker degli AbortController abort — sostituiamo `globalThis.AbortController`
  // con un wrapper che intercetta `abort()` per contarli. Pattern non invasivo:
  // estendiamo la classe e contiamo le abort verso il counter del harness.
  const abortTracker = { count: 0 }
  const OriginalAbortController = globalThis.AbortController
  class TrackingAbortController extends OriginalAbortController {
    override abort(reason?: unknown): void {
      abortTracker.count++
      super.abort(reason)
    }
  }
  // Spia non-distruttiva via vi.spyOn: la sostituzione è automaticamente reset
  // tra test grazie al setup vitest. Ma `globalThis.AbortController` non è
  // un metodo, quindi usiamo l'assegnazione diretta + reset in `reset()`.
  globalThis.AbortController = TrackingAbortController as unknown as typeof AbortController

  const broker = createRouterBroker({
    runtime: {
      tap,
      logLevel: 'silent',
      ...(options.debug !== undefined && { debug: options.debug }),
    },
    ...(options.schemas && { canonicalModel: { schemas: [...options.schemas] } }),
    ...(options.transforms && { transforms: { ...options.transforms } }),
    ...(options.aliases && { aliasRegistry: { global: { ...options.aliases } } }),
    ...(options.routes && { routes: [...options.routes] }),
    ...(options.gateway && { gateway: options.gateway }),
    ...(options.routing && { routing: { ...options.routing } }),
  })

  // Pre-collect topic standard F3 — il consumer può aggiungere altri topic via
  // `harness.collect(topic)`. BLOCKER 3 fix Plan 03-12: `subscribe` è delegate
  // esplicito (NON usiamo optional chaining `?.`).
  const topicsToCollect = options.collectTopics ?? DEFAULT_COLLECT_TOPICS
  for (const t of topicsToCollect) {
    broker.subscribe(t, (e) => {
      collectedEvents.push({ topic: e.topic, payload: e.payload })
    })
  }

  return {
    broker,
    steps,
    collectedEvents,
    reset(): void {
      steps.length = 0
      collectedEvents.length = 0
      fetchTracker.length = 0
      abortTracker.count = 0
      // Ripristina AbortController originale per evitare leak fra test.
      globalThis.AbortController = OriginalAbortController
      // Re-installa il tracker (in caso di test che chiamano `reset` prima del teardown).
      globalThis.AbortController = TrackingAbortController as unknown as typeof AbortController
      // Detach listener msw per evitare double-count tra harness instances.
      server.events.removeListener('request:start', fetchListener)
      server.events.on('request:start', fetchListener)
    },
    byStep(step): PipelineSnapshot[] {
      return steps.filter((s) => s.step === step).map((s) => s.snapshot)
    },
    collect(topic): void {
      broker.subscribe(topic, (e) => {
        collectedEvents.push({ topic: e.topic, payload: e.payload })
      })
    },
    mockServer(handlers): void {
      server.use(...handlers)
    },
    expectFetched(matcher): number {
      return fetchTracker.filter((c) =>
        typeof matcher === 'string' ? c.url.includes(matcher) : matcher.test(c.url),
      ).length
    },
    expectRetryAttempts(routeId): number {
      return steps.filter(
        (s) =>
          s.step === ('event.route.executed' as PipelineStep) &&
          ((s.snapshot.metadata as { routeId?: string } | undefined)?.routeId === routeId ||
            JSON.stringify(s.snapshot).includes(`"${routeId}"`)),
      ).length
    },
    expectAborted(): number {
      return abortTracker.count
    },
    async flushAsync(ms = 0): Promise<void> {
      // Microtask flush + macrotask delay (per il fetch path async via msw).
      await Promise.resolve()
      if (ms > 0) {
        // Se i fake timers sono attivi, `vi.advanceTimersByTimeAsync` flusha i timer
        // virtuali; altrimenti `setTimeout` reale.
        const timersInfo = vi.isFakeTimers?.()
        if (timersInfo) {
          await vi.advanceTimersByTimeAsync(ms)
        } else {
          await new Promise<void>((res) => setTimeout(res, ms))
        }
      } else {
        // Anche senza ms, esegui qualche microtask round per far girare le Promise.
        await new Promise<void>((res) => setTimeout(res, 0))
      }
    },
    async waitForEvent(topic, opts = {}): Promise<CollectedEvent> {
      const timeoutMs = opts.timeoutMs ?? 1000
      const start = Date.now()
      while (Date.now() - start < timeoutMs) {
        const found = collectedEvents.find((e) => e.topic === topic)
        if (found) return found
        await new Promise<void>((res) => setTimeout(res, 5))
      }
      throw new Error(
        `waitForEvent: topic "${topic}" not received within ${timeoutMs}ms (collected: ${collectedEvents
          .map((e) => e.topic)
          .join(', ')})`,
      )
    },
  }
}
