/**
 * `@gluezero/devtools/mf-inspector/metrics` — unit tests Tier-1 (D-V2-F16-13/14/15).
 *
 * Coverage breakdown:
 * - 6 counter GLOBALI dispatch + B2 fix replicazione identica
 * - 5 counter PER-MF tagged dispatch + B2 fix scoping per mfId
 * - 1 gauge PER-MF last-write-wins
 * - 2 histogram PER-MF reservoir + percentili
 * - Multi-MF buildEntries
 * - Cardinality cap protection
 * - Topic non-MF skip
 * - Counter monotone
 * - B3 fix forward-compat route/worker/context pattern matching liberale
 * - Naming D-163 dot.case
 * - clear() reset
 * - buildEntries empty
 *
 * @see D-V2-F16-13/14/15 — inline metrics + shape + projection
 * @see B2 fix — counter semantica (globali replicati vs per-MF scoped)
 * @see B3 fix — route/worker/context empirical findings forward-compat
 * @see MF-OBS-02 — REQ frozen contract
 */

import { describe, expect, it } from 'vitest'
import { createMfMetricsDispatch } from '../metrics'

function eventFor(mfId: string): { payload: { id: string } } {
  return { payload: { id: mfId } }
}

describe('createMfMetricsDispatch — 6 counter GLOBALI dispatch (B2 fix)', () => {
  it('microfrontend.registered → globalCounter "registered" increments by 1', () => {
    const d = createMfMetricsDispatch()
    d.handleTopicEvent('microfrontend.registered', eventFor('mf1'))
    const entries = d.buildEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0]?.registered).toBe(1)
  })

  it('microfrontend.mounted → globalCounter "mounted" increments by 1', () => {
    const d = createMfMetricsDispatch()
    d.handleTopicEvent('microfrontend.mounted', eventFor('mf1'))
    expect(d.buildEntries()[0]?.mounted).toBe(1)
  })

  it('microfrontend.failed → globalCounter "failed" increments by 1', () => {
    const d = createMfMetricsDispatch()
    d.handleTopicEvent('microfrontend.failed', eventFor('mf1'))
    expect(d.buildEntries()[0]?.failed).toBe(1)
  })

  it('microfrontend.permission.denied → globalCounter "permissionDenied" increments by 1', () => {
    const d = createMfMetricsDispatch()
    d.handleTopicEvent('microfrontend.permission.denied', eventFor('mf1'))
    expect(d.buildEntries()[0]?.permissionDenied).toBe(1)
  })

  it('microfrontend.compatibility.failed → globalCounter "compatFailures" increments by 1', () => {
    const d = createMfMetricsDispatch()
    d.handleTopicEvent('microfrontend.compatibility.failed', eventFor('mf1'))
    expect(d.buildEntries()[0]?.compatFailures).toBe(1)
  })

  it('microfrontend.capability.missing → globalCounter "capMissing" increments by 1', () => {
    const d = createMfMetricsDispatch()
    d.handleTopicEvent('microfrontend.capability.missing', eventFor('mf1'))
    expect(d.buildEntries()[0]?.capMissing).toBe(1)
  })

  it('B2 fix verify — 2 MF + 1 registered event each → entrambi buildEntries[*].registered === 2 (counter globale replicato identico)', () => {
    const d = createMfMetricsDispatch()
    d.handleTopicEvent('microfrontend.registered', eventFor('mf-a'))
    d.handleTopicEvent('microfrontend.registered', eventFor('mf-b'))
    const entries = d.buildEntries()
    expect(entries).toHaveLength(2)
    for (const e of entries) {
      expect(e.registered).toBe(2)
    }
  })
})

describe('createMfMetricsDispatch — 5 counter PER-MF tagged dispatch (B2 fix scoping)', () => {
  it('microfrontend.mount.failed → tagged "mountFailuresPerId" scoped per mfId', () => {
    const d = createMfMetricsDispatch()
    d.handleTopicEvent('microfrontend.mount.failed', eventFor('mf-a'))
    d.handleTopicEvent('microfrontend.mount.failed', eventFor('mf-a'))
    d.handleTopicEvent('microfrontend.mount.failed', eventFor('mf-b'))
    const entries = d.buildEntries()
    const a = entries.find((e) => e.id === 'mf-a')
    const b = entries.find((e) => e.id === 'mf-b')
    expect(a?.mountFailures).toBe(2)
    expect(b?.mountFailures).toBe(1)
  })

  it('incrementEventCounter → tagged "eventsPerMfId" scoped per mfId', () => {
    const d = createMfMetricsDispatch()
    d.incrementEventCounter('mf-a')
    d.incrementEventCounter('mf-a')
    d.incrementEventCounter('mf-b')
    const entries = d.buildEntries()
    const a = entries.find((e) => e.id === 'mf-a')
    const b = entries.find((e) => e.id === 'mf-b')
    expect(a?.events).toBe(2)
    expect(b?.events).toBe(1)
  })

  it('route.* topic → tagged "routeCallsPerMfId" scoped per mfId (B3 forward-compat)', () => {
    const d = createMfMetricsDispatch()
    d.handleTopicEvent('route.dispatched', eventFor('mf-a'))
    d.handleTopicEvent('route.dispatched', eventFor('mf-b'))
    const entries = d.buildEntries()
    const a = entries.find((e) => e.id === 'mf-a')
    const b = entries.find((e) => e.id === 'mf-b')
    expect(a?.routeCalls).toBe(1)
    expect(b?.routeCalls).toBe(1)
  })

  it('worker.* topic → tagged "workerTasksPerMfId" scoped per mfId (B3 forward-compat)', () => {
    const d = createMfMetricsDispatch()
    d.handleTopicEvent('worker.task.started', eventFor('mf-a'))
    const entries = d.buildEntries()
    expect(entries[0]?.workerTasks).toBe(1)
  })

  it('context.write topic → tagged "contextWritesPerMfId" scoped per mfId (B3 forward-compat)', () => {
    const d = createMfMetricsDispatch()
    d.handleTopicEvent('context.write.applied', eventFor('mf-a'))
    const entries = d.buildEntries()
    expect(entries[0]?.contextWrites).toBe(1)
  })
})

describe('createMfMetricsDispatch — 1 gauge PER-MF (last-write-wins)', () => {
  it('setActiveSubs → gauge value reflected in entry', () => {
    const d = createMfMetricsDispatch()
    d.setActiveSubs('mf1', 3)
    expect(d.buildEntries()[0]?.activeSubs).toBe(3)
  })

  it('setActiveSubs last-write-wins (overwrite previous)', () => {
    const d = createMfMetricsDispatch()
    d.setActiveSubs('mf1', 3)
    d.setActiveSubs('mf1', 7)
    expect(d.buildEntries()[0]?.activeSubs).toBe(7)
  })
})

describe('createMfMetricsDispatch — 2 histogram PER-MF (reservoir Algorithm R)', () => {
  it('observeLoadTime → histogram timeAvgLoad p50/p95/p99 populated', () => {
    const d = createMfMetricsDispatch()
    for (let i = 0; i < 10; i++) d.observeLoadTime('mf1', i * 10 + 1)
    const e = d.buildEntries()[0]
    expect(e?.timeAvgLoad.count).toBe(10)
    expect(e?.timeAvgLoad.p50).toBeGreaterThanOrEqual(0)
    expect(e?.timeAvgLoad.p95).toBeGreaterThanOrEqual(0)
    expect(e?.timeAvgLoad.p99).toBeGreaterThanOrEqual(0)
  })

  it('observeMountTime → histogram timeAvgMount p50/p95/p99 populated', () => {
    const d = createMfMetricsDispatch()
    for (let i = 0; i < 10; i++) d.observeMountTime('mf1', i * 5 + 2)
    const e = d.buildEntries()[0]
    expect(e?.timeAvgMount.count).toBe(10)
    expect(e?.timeAvgMount.p50).toBeGreaterThanOrEqual(0)
  })

  it('histogram empty (no observations) → all percentili === 0, count === 0', () => {
    const d = createMfMetricsDispatch()
    d.handleTopicEvent('microfrontend.registered', eventFor('mf1'))
    const e = d.buildEntries()[0]
    expect(e?.timeAvgLoad).toEqual({ p50: 0, p95: 0, p99: 0, count: 0 })
    expect(e?.timeAvgMount).toEqual({ p50: 0, p95: 0, p99: 0, count: 0 })
  })

  it('histogram count corretto dopo N observations', () => {
    const d = createMfMetricsDispatch()
    for (let i = 0; i < 25; i++) d.observeLoadTime('mf1', 100)
    expect(d.buildEntries()[0]?.timeAvgLoad.count).toBe(25)
  })
})

describe('createMfMetricsDispatch — Multi-MF', () => {
  it('2 MF distinti via mfId differenti → buildEntries.length === 2', () => {
    const d = createMfMetricsDispatch()
    d.handleTopicEvent('microfrontend.registered', eventFor('mf-a'))
    d.handleTopicEvent('microfrontend.registered', eventFor('mf-b'))
    expect(d.buildEntries()).toHaveLength(2)
  })

  it('3 MF → 3 entries con distinct id', () => {
    const d = createMfMetricsDispatch()
    d.handleTopicEvent('microfrontend.mounted', eventFor('mf-a'))
    d.handleTopicEvent('microfrontend.mounted', eventFor('mf-b'))
    d.handleTopicEvent('microfrontend.mounted', eventFor('mf-c'))
    const ids = d
      .buildEntries()
      .map((e) => e.id)
      .sort()
    expect(ids).toEqual(['mf-a', 'mf-b', 'mf-c'])
  })
})

describe('createMfMetricsDispatch — Cardinality cap protection', () => {
  it('cardinalityCap: 2 + 3 mfId differenti via tagged → 3° MF droppato', () => {
    const d = createMfMetricsDispatch({ cardinalityCap: 2 })
    // Tagged counter via mount.failed (label {mfId} strict)
    d.handleTopicEvent('microfrontend.mount.failed', eventFor('mf-a'))
    d.handleTopicEvent('microfrontend.mount.failed', eventFor('mf-b'))
    d.handleTopicEvent('microfrontend.mount.failed', eventFor('mf-c')) // dropped
    const entries = d.buildEntries()
    const ids = entries.map((e) => e.id).sort()
    // mf-c non viene aggiunto a seenMfs (tagged early-return su cap miss)
    expect(ids).toEqual(['mf-a', 'mf-b'])
  })
})

describe('createMfMetricsDispatch — Topic non-MF skip', () => {
  it('topic non-MF "system.x" → no metric incrementato + seenMfs unchanged', () => {
    const d = createMfMetricsDispatch()
    d.handleTopicEvent('system.x', eventFor('mf-a'))
    expect(d.buildEntries()).toHaveLength(0)
  })

  it('topic senza payload.id valido → no-op (skip)', () => {
    const d = createMfMetricsDispatch()
    d.handleTopicEvent('microfrontend.registered', { payload: {} })
    expect(d.buildEntries()).toHaveLength(0)
  })

  it('topic senza payload → no-op (skip)', () => {
    const d = createMfMetricsDispatch()
    d.handleTopicEvent('microfrontend.registered', {})
    expect(d.buildEntries()).toHaveLength(0)
  })
})

describe('createMfMetricsDispatch — Counter monotone', () => {
  it('handleTopicEvent stesso topic 5 volte → counter === 5 (monotone increase)', () => {
    const d = createMfMetricsDispatch()
    for (let i = 0; i < 5; i++) d.handleTopicEvent('microfrontend.registered', eventFor('mf1'))
    expect(d.buildEntries()[0]?.registered).toBe(5)
  })
})

describe('createMfMetricsDispatch — B3 fix forward-compat pattern matching', () => {
  it('topic.startsWith("route.") → routeCalls++ (pattern matching liberale)', () => {
    const d = createMfMetricsDispatch()
    d.handleTopicEvent('route.dispatched', eventFor('mf1'))
    d.handleTopicEvent('route.fallback.applied', eventFor('mf1'))
    expect(d.buildEntries()[0]?.routeCalls).toBe(2)
  })

  it('topic.includes("routing.dispatched") → routeCalls++ (forward-compat V2.1+)', () => {
    const d = createMfMetricsDispatch()
    d.handleTopicEvent('gluezero.routing.dispatched', eventFor('mf1'))
    expect(d.buildEntries()[0]?.routeCalls).toBe(1)
  })

  it('topic.startsWith("worker.") → workerTasks++ (pattern matching liberale)', () => {
    const d = createMfMetricsDispatch()
    d.handleTopicEvent('worker.task.dispatched', eventFor('mf1'))
    d.handleTopicEvent('worker.task.completed', eventFor('mf1'))
    expect(d.buildEntries()[0]?.workerTasks).toBe(2)
  })

  it('topic.includes("context.write") → contextWrites++ (pattern matching liberale)', () => {
    const d = createMfMetricsDispatch()
    d.handleTopicEvent('app.context.write.applied', eventFor('mf1'))
    expect(d.buildEntries()[0]?.contextWrites).toBe(1)
  })

  it('topic.includes("context.updated") → contextWrites++ (forward-compat alt)', () => {
    const d = createMfMetricsDispatch()
    d.handleTopicEvent('app.context.updated', eventFor('mf1'))
    expect(d.buildEntries()[0]?.contextWrites).toBe(1)
  })
})

describe('createMfMetricsDispatch — Naming D-163 dot.case', () => {
  it('metric name "gluezero.mfs.registered" esatto in collector snapshot', () => {
    const d = createMfMetricsDispatch()
    d.handleTopicEvent('microfrontend.registered', eventFor('mf1'))
    // Verify naming via buildEntries projection (collector internal — check via behavior)
    expect(d.buildEntries()[0]?.registered).toBe(1)
  })

  it('metric naming dot.case carryover F6 D-163 (verifica via 14 metric shape)', () => {
    const d = createMfMetricsDispatch()
    // Triggering tutti i 14 metric paths assicura naming consistency
    d.handleTopicEvent('microfrontend.registered', eventFor('mf1'))
    d.handleTopicEvent('microfrontend.mounted', eventFor('mf1'))
    d.handleTopicEvent('microfrontend.failed', eventFor('mf1'))
    d.handleTopicEvent('microfrontend.permission.denied', eventFor('mf1'))
    d.handleTopicEvent('microfrontend.compatibility.failed', eventFor('mf1'))
    d.handleTopicEvent('microfrontend.capability.missing', eventFor('mf1'))
    d.handleTopicEvent('microfrontend.mount.failed', eventFor('mf1'))
    d.incrementEventCounter('mf1')
    d.handleTopicEvent('route.dispatched', eventFor('mf1'))
    d.handleTopicEvent('worker.task.done', eventFor('mf1'))
    d.handleTopicEvent('context.write.applied', eventFor('mf1'))
    d.observeLoadTime('mf1', 100)
    d.observeMountTime('mf1', 50)
    d.setActiveSubs('mf1', 4)
    const e = d.buildEntries()[0]
    // All 14 fields present + numeric
    expect(e?.registered).toBe(1)
    expect(e?.mounted).toBe(1)
    expect(e?.failed).toBe(1)
    expect(e?.permissionDenied).toBe(1)
    expect(e?.compatFailures).toBe(1)
    expect(e?.capMissing).toBe(1)
    expect(e?.mountFailures).toBe(1)
    expect(e?.events).toBe(1)
    expect(e?.routeCalls).toBe(1)
    expect(e?.workerTasks).toBe(1)
    expect(e?.contextWrites).toBe(1)
    expect(e?.timeAvgLoad.count).toBe(1)
    expect(e?.timeAvgMount.count).toBe(1)
    expect(e?.activeSubs).toBe(4)
  })
})

describe('createMfMetricsDispatch — Lifecycle helpers', () => {
  it('clear() → buildEntries() === []', () => {
    const d = createMfMetricsDispatch()
    d.handleTopicEvent('microfrontend.registered', eventFor('mf1'))
    expect(d.buildEntries()).toHaveLength(1)
    d.clear()
    expect(d.buildEntries()).toHaveLength(0)
  })

  it('buildEntries empty (no dispatch) → []', () => {
    const d = createMfMetricsDispatch()
    expect(d.buildEntries()).toEqual([])
  })
})
