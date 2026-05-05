// route-inspector.test.ts — Tier-1 jsdom RED → GREEN test plan 06-05 Task 2.
//
// Verifica `createRouteInspector(opts)`: cattura step 9 (`event.route.executed`)
// + step 10 (`event.outcome.collected`) F3, aggrega per (eventId, routeId) in
// RouteInspectorEntry. Pending Map cleanup post-completion. Default NODE_ENV
// inline coerente con event-inspector (D-160).
//
// Threat coverage:
// - T-06-05-01 (DoS buffer cresce illimitato): mitigated via D-167 cap +
//   drop-oldest FIFO. Test 5.
// - T-06-05-02 (Information disclosure leak via mutation): mitigated via D-162
//   structuredClone in getBuffer(). Test 6.

import type { PipelineSnapshot, PipelineStep } from '@sembridge/core'
import { describe, expect, it } from 'vitest'
import { createRouteInspector } from './route-inspector'
import type { RouteInspectorEntry } from './types/inspector-entry'

const STEP_ROUTE_EXECUTED = 'event.route.executed' as PipelineStep
const STEP_OUTCOME_COLLECTED = 'event.outcome.collected' as PipelineStep

function makeSnapshot(
  step: PipelineStep,
  eventId = 'evt-1',
  metadata: Record<string, unknown> = {},
  topic = 'topic.test',
  durationMs = 1.5,
): PipelineSnapshot {
  return {
    eventId,
    topic,
    step,
    timestamp: 1700000000000,
    durationMs,
    metadata,
  }
}

describe('createRouteInspector (D-167 ring buffer 500 + capture step 9+10 + aggregate eventId+routeId)', () => {
  it('Test 1: createRouteInspector({}) ritorna API attesa con bufferSize default 500', () => {
    const inspector = createRouteInspector({})
    expect(inspector).toBeDefined()
    expect(typeof inspector.tap.onPipelineStep).toBe('function')
    expect(typeof inspector.enable).toBe('function')
    expect(typeof inspector.disable).toBe('function')
    expect(typeof inspector.getBuffer).toBe('function')
    expect(typeof inspector.clear).toBe('function')
    expect(typeof inspector.getSnapshot).toBe('function')
    expect(inspector.getSnapshot().bufferSize).toBe(500)
  })

  it('Test 2: step 9 (event.route.executed) con metadata.routeId + metadata.type → entry pending creata, NON ancora in buffer (aspetta step 10)', () => {
    const inspector = createRouteInspector({ initiallyEnabled: true })
    inspector.tap.onPipelineStep(
      STEP_ROUTE_EXECUTED,
      makeSnapshot(STEP_ROUTE_EXECUTED, 'evt-1', { routeId: 'r1', type: 'http' }),
    )
    // Step 9 alone — entry pending, NON in buffer (in attesa di step 10 outcome)
    expect(inspector.getSnapshot().bufferEntries).toBe(0)
  })

  it("Test 3: step 10 (event.outcome.collected) con outcome=success aggrega all'entry pending → entry finale in buffer", () => {
    const inspector = createRouteInspector({ initiallyEnabled: true })
    inspector.tap.onPipelineStep(
      STEP_ROUTE_EXECUTED,
      makeSnapshot(STEP_ROUTE_EXECUTED, 'evt-1', { routeId: 'r1', type: 'http' }, 'topic.x', 1.5),
    )
    inspector.tap.onPipelineStep(
      STEP_OUTCOME_COLLECTED,
      makeSnapshot(
        STEP_OUTCOME_COLLECTED,
        'evt-1',
        { routeId: 'r1', outcome: 'success' },
        'topic.x',
        12,
      ),
    )
    const buffer = inspector.getBuffer()
    expect(buffer.length).toBe(1)
    const entry = buffer[0]!
    expect(entry.eventId).toBe('evt-1')
    expect(entry.routeId).toBe('r1')
    expect(entry.type).toBe('http')
    expect(entry.outcome).toBe('success')
    expect(entry.topic).toBe('topic.x')
  })

  it('Test 4: Step diversi da 9+10 (event.received) → IGNORATI (no entry creata)', () => {
    const inspector = createRouteInspector({ initiallyEnabled: true })
    inspector.tap.onPipelineStep(
      'event.received',
      makeSnapshot('event.received', 'evt-1', { routeId: 'r1', type: 'http' }),
    )
    inspector.tap.onPipelineStep(
      'event.delivered',
      makeSnapshot('event.delivered', 'evt-1', { routeId: 'r1' }),
    )
    expect(inspector.getSnapshot().bufferEntries).toBe(0)
  })

  it('Test 5: cap rispettato — bufferSize=5, 7 distinct routes complete → 5 entry + 2 evicted FIFO', () => {
    const inspector = createRouteInspector({ bufferSize: 5, initiallyEnabled: true })
    for (let i = 0; i < 7; i++) {
      inspector.tap.onPipelineStep(
        STEP_ROUTE_EXECUTED,
        makeSnapshot(STEP_ROUTE_EXECUTED, `evt-${i}`, { routeId: `r${i}`, type: 'http' }),
      )
      inspector.tap.onPipelineStep(
        STEP_OUTCOME_COLLECTED,
        makeSnapshot(STEP_OUTCOME_COLLECTED, `evt-${i}`, { routeId: `r${i}`, outcome: 'success' }),
      )
    }
    const buffer = inspector.getBuffer()
    expect(buffer.length).toBe(5)
    // First two evicted FIFO
    expect(buffer[0]?.eventId).toBe('evt-2')
    expect(buffer[4]?.eventId).toBe('evt-6')
  })

  it('Test 6: getBuffer() ritorna deep-clone via structuredClone (D-162) — clone !== original (mutation safety)', () => {
    const inspector = createRouteInspector({ initiallyEnabled: true })
    inspector.tap.onPipelineStep(
      STEP_ROUTE_EXECUTED,
      makeSnapshot(STEP_ROUTE_EXECUTED, 'evt-1', { routeId: 'r1', type: 'http' }),
    )
    inspector.tap.onPipelineStep(
      STEP_OUTCOME_COLLECTED,
      makeSnapshot(STEP_OUTCOME_COLLECTED, 'evt-1', { routeId: 'r1', outcome: 'success' }),
    )
    const clone1 = inspector.getBuffer() as RouteInspectorEntry[]
    const clone2 = inspector.getBuffer()
    expect(clone1).not.toBe(clone2)
    // Mutate clone — internal state preserved
    clone1.push({
      eventId: 'fake',
      routeId: 'fake',
      topic: 'fake',
      type: 'local',
      outcome: 'success',
      durationMs: 0,
      timestamp: 0,
    })
    expect(inspector.getSnapshot().bufferEntries).toBe(1)
  })

  it('Test 7: retryCount aggregato da metadata se presente (analog F3 03-09 retry)', () => {
    const inspector = createRouteInspector({ initiallyEnabled: true })
    inspector.tap.onPipelineStep(
      STEP_ROUTE_EXECUTED,
      makeSnapshot(STEP_ROUTE_EXECUTED, 'evt-1', { routeId: 'r1', type: 'http', retryCount: 3 }),
    )
    inspector.tap.onPipelineStep(
      STEP_OUTCOME_COLLECTED,
      makeSnapshot(STEP_OUTCOME_COLLECTED, 'evt-1', { routeId: 'r1', outcome: 'success' }),
    )
    const buffer = inspector.getBuffer()
    expect(buffer[0]?.retryCount).toBe(3)
  })

  it('Test 8: cacheHit aggregato da metadata.origin === "cache"', () => {
    const inspector = createRouteInspector({ initiallyEnabled: true })
    inspector.tap.onPipelineStep(
      STEP_ROUTE_EXECUTED,
      makeSnapshot(STEP_ROUTE_EXECUTED, 'evt-1', { routeId: 'r1', type: 'cache' }),
    )
    inspector.tap.onPipelineStep(
      STEP_OUTCOME_COLLECTED,
      makeSnapshot(STEP_OUTCOME_COLLECTED, 'evt-1', {
        routeId: 'r1',
        outcome: 'cached',
        origin: 'cache',
      }),
    )
    const buffer = inspector.getBuffer()
    expect(buffer[0]?.cacheHit).toBe(true)
    expect(buffer[0]?.outcome).toBe('cached')
  })

  it('Test 9: policiesApplied aggregato da metadata.policies array', () => {
    const inspector = createRouteInspector({ initiallyEnabled: true })
    inspector.tap.onPipelineStep(
      STEP_ROUTE_EXECUTED,
      makeSnapshot(STEP_ROUTE_EXECUTED, 'evt-1', {
        routeId: 'r1',
        type: 'http',
        policies: ['retry', 'circuit-breaker', 'timeout'],
      }),
    )
    inspector.tap.onPipelineStep(
      STEP_OUTCOME_COLLECTED,
      makeSnapshot(STEP_OUTCOME_COLLECTED, 'evt-1', { routeId: 'r1', outcome: 'success' }),
    )
    const buffer = inspector.getBuffer()
    expect(buffer[0]?.policiesApplied).toEqual(['retry', 'circuit-breaker', 'timeout'])
  })

  it('Test 10: errorCode catturato per outcome=error', () => {
    const inspector = createRouteInspector({ initiallyEnabled: true })
    inspector.tap.onPipelineStep(
      STEP_ROUTE_EXECUTED,
      makeSnapshot(STEP_ROUTE_EXECUTED, 'evt-1', { routeId: 'r1', type: 'http' }),
    )
    inspector.tap.onPipelineStep(
      STEP_OUTCOME_COLLECTED,
      makeSnapshot(STEP_OUTCOME_COLLECTED, 'evt-1', {
        routeId: 'r1',
        outcome: 'error',
        errorCode: 'http.timeout',
      }),
    )
    const buffer = inspector.getBuffer()
    expect(buffer[0]?.outcome).toBe('error')
    expect(buffer[0]?.errorCode).toBe('http.timeout')
  })

  it('Test 11: Lazy-mode early-return — initiallyEnabled=false → step 9+10 ignorati', () => {
    const inspector = createRouteInspector({ initiallyEnabled: false })
    inspector.tap.onPipelineStep(
      STEP_ROUTE_EXECUTED,
      makeSnapshot(STEP_ROUTE_EXECUTED, 'evt-1', { routeId: 'r1', type: 'http' }),
    )
    inspector.tap.onPipelineStep(
      STEP_OUTCOME_COLLECTED,
      makeSnapshot(STEP_OUTCOME_COLLECTED, 'evt-1', { routeId: 'r1', outcome: 'success' }),
    )
    expect(inspector.getSnapshot().bufferEntries).toBe(0)
  })

  it('Test 12: disable() clear-buffer + pending Map cleared (memory hygiene)', () => {
    const inspector = createRouteInspector({ initiallyEnabled: true })
    inspector.tap.onPipelineStep(
      STEP_ROUTE_EXECUTED,
      makeSnapshot(STEP_ROUTE_EXECUTED, 'evt-1', { routeId: 'r1', type: 'http' }),
    )
    inspector.tap.onPipelineStep(
      STEP_OUTCOME_COLLECTED,
      makeSnapshot(STEP_OUTCOME_COLLECTED, 'evt-1', { routeId: 'r1', outcome: 'success' }),
    )
    expect(inspector.getSnapshot().bufferEntries).toBe(1)
    inspector.disable()
    expect(inspector.getSnapshot().enabled).toBe(false)
    expect(inspector.getSnapshot().bufferEntries).toBe(0)
  })

  it('Test 13: Step con metadata mancante routeId → IGNORATO (no entry, defensive)', () => {
    const inspector = createRouteInspector({ initiallyEnabled: true })
    inspector.tap.onPipelineStep(
      STEP_ROUTE_EXECUTED,
      makeSnapshot(STEP_ROUTE_EXECUTED, 'evt-1', { type: 'http' }), // no routeId
    )
    expect(inspector.getSnapshot().bufferEntries).toBe(0)
  })

  it('Test 14: clear() svuota buffer ma non disabilita', () => {
    const inspector = createRouteInspector({ initiallyEnabled: true })
    inspector.tap.onPipelineStep(
      STEP_ROUTE_EXECUTED,
      makeSnapshot(STEP_ROUTE_EXECUTED, 'evt-1', { routeId: 'r1', type: 'http' }),
    )
    inspector.tap.onPipelineStep(
      STEP_OUTCOME_COLLECTED,
      makeSnapshot(STEP_OUTCOME_COLLECTED, 'evt-1', { routeId: 'r1', outcome: 'success' }),
    )
    inspector.clear()
    expect(inspector.getSnapshot().bufferEntries).toBe(0)
    expect(inspector.getSnapshot().enabled).toBe(true)
  })

  it('Test 15: enable() riattiva tap dopo disable()', () => {
    const inspector = createRouteInspector({ initiallyEnabled: false })
    inspector.tap.onPipelineStep(
      STEP_ROUTE_EXECUTED,
      makeSnapshot(STEP_ROUTE_EXECUTED, 'evt-1', { routeId: 'r1', type: 'http' }),
    )
    expect(inspector.getSnapshot().bufferEntries).toBe(0)
    inspector.enable()
    inspector.tap.onPipelineStep(
      STEP_ROUTE_EXECUTED,
      makeSnapshot(STEP_ROUTE_EXECUTED, 'evt-2', { routeId: 'r2', type: 'local' }),
    )
    inspector.tap.onPipelineStep(
      STEP_OUTCOME_COLLECTED,
      makeSnapshot(STEP_OUTCOME_COLLECTED, 'evt-2', { routeId: 'r2', outcome: 'success' }),
    )
    expect(inspector.getSnapshot().bufferEntries).toBe(1)
  })
})
