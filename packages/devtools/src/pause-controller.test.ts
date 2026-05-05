// pause-controller.test.ts — Tier-1 jsdom RED → GREEN test plan 06-07 Task 1.
//
// Verifica `createPauseController({ maxQueueSize, publishFn })`: pauseTopic
// block + queue FIFO (D-168) + resumeTopic replay (D-168) + flushQueue audit
// emit (D-169) + cap drop-oldest FIFO + critical bypass (D-170, Pitfall 4.C
// carryover F3 D-75 + F5 D-130).
//
// Pattern role-match: F3 `backpressure-strategy.ts:127-160` (D-75 cap +
// drop-oldest + critical bypass) + F5 `worker-pool.ts` (D-130 critical bypass).
// Replica algoritmica inline (semantica diversa F6 = explicit user pause).
//
// Threat coverage:
// - T-06-07-01 (DoS queue cresce illimitato): mitigated via D-170 cap + drop-oldest.
//   Test 11/12 verificano cap rispettato.
// - T-06-07-03 (Logic flaw critical bypass): mitigated via D-170 critical pass.
//   Test 13/14 verificano bypass anche con cap raggiunto.
// - T-06-07-04 (Logic flaw resumeTopic infinite loop): mitigated via
//   delete-before-replay. Test 6 verifica no infinite loop.
// - T-06-07-05 (Logic flaw flushQueue topic non-paused): accept silenzioso.
//   Test 10 verifica no-op.

import type { BrokerEvent } from '@sembridge/core'
import { describe, expect, it, vi } from 'vitest'
import { createPauseController } from './pause-controller'

function makeEvent(
  topic: string,
  id = 'evt-1',
  priority?: BrokerEvent['priority'],
): BrokerEvent {
  return {
    id,
    topic,
    timestamp: 1700000000000,
    source: { type: 'plugin', id: 'test-plugin' },
    payload: { value: id },
    priority,
  } as BrokerEvent
}

describe('createPauseController (D-168 + D-169 + D-170 + critical bypass)', () => {
  it('Test 1: createPauseController({ publishFn }) ritorna API attesa', () => {
    const publishFn = vi.fn()
    const ctrl = createPauseController({ publishFn })
    expect(ctrl).toBeDefined()
    expect(typeof ctrl.pauseTopic).toBe('function')
    expect(typeof ctrl.resumeTopic).toBe('function')
    expect(typeof ctrl.flushQueue).toBe('function')
    expect(typeof ctrl.isPaused).toBe('function')
    expect(typeof ctrl.intercept).toBe('function')
    expect(typeof ctrl.getSnapshot).toBe('function')
  })

  it('Test 2: pauseTopic("weather.requested") → isPaused=true + queue empty initialized', () => {
    const ctrl = createPauseController({ publishFn: vi.fn() })
    expect(ctrl.isPaused('weather.requested')).toBe(false)
    ctrl.pauseTopic('weather.requested')
    expect(ctrl.isPaused('weather.requested')).toBe(true)
    const snap = ctrl.getSnapshot()
    expect(snap.pausedTopics).toContain('weather.requested')
    expect(snap.queueSizes['weather.requested']).toBe(0)
  })

  it('Test 3: intercept(event topic non-paused) → "pass" (D-168 default)', () => {
    const ctrl = createPauseController({ publishFn: vi.fn() })
    const action = ctrl.intercept(makeEvent('news.requested', 'evt-news-1'))
    expect(action).toBe('pass')
  })

  it('Test 4: pauseTopic + intercept(event same topic) → "queued" + queue.length=1 (D-168)', () => {
    const ctrl = createPauseController({ publishFn: vi.fn() })
    ctrl.pauseTopic('weather.requested')
    const action = ctrl.intercept(makeEvent('weather.requested', 'evt-w-1'))
    expect(action).toBe('queued')
    expect(ctrl.getSnapshot().queueSizes['weather.requested']).toBe(1)
  })

  it('Test 5: resumeTopic → publishFn called N times FIFO order + isPaused=false (D-168 replay)', () => {
    const publishFn = vi.fn()
    const ctrl = createPauseController({ publishFn })
    ctrl.pauseTopic('weather.requested')
    ctrl.intercept(makeEvent('weather.requested', 'evt-1'))
    ctrl.intercept(makeEvent('weather.requested', 'evt-2'))
    ctrl.intercept(makeEvent('weather.requested', 'evt-3'))
    expect(ctrl.getSnapshot().queueSizes['weather.requested']).toBe(3)

    ctrl.resumeTopic('weather.requested')
    expect(ctrl.isPaused('weather.requested')).toBe(false)
    expect(publishFn).toHaveBeenCalledTimes(3)
    // FIFO order
    expect(publishFn.mock.calls[0]?.[0]).toBe('weather.requested')
    expect((publishFn.mock.calls[0]?.[1] as { value: string }).value).toBe('evt-1')
    expect((publishFn.mock.calls[1]?.[1] as { value: string }).value).toBe('evt-2')
    expect((publishFn.mock.calls[2]?.[1] as { value: string }).value).toBe('evt-3')
  })

  it('Test 6: resumeTopic NO infinite loop — replay events vedono topic non-paused (T-06-07-04)', () => {
    const publishFn = vi.fn()
    const ctrl = createPauseController({ publishFn })
    ctrl.pauseTopic('weather.requested')
    ctrl.intercept(makeEvent('weather.requested', 'evt-1'))
    ctrl.intercept(makeEvent('weather.requested', 'evt-2'))

    // Mock publishFn che simula re-intercept (replay events tornano nel pause controller)
    publishFn.mockImplementation((topic: string) => {
      // Anti-loop guard: durante resume, topic deve essere già unpaused
      expect(ctrl.isPaused(topic)).toBe(false)
    })

    ctrl.resumeTopic('weather.requested')
    expect(publishFn).toHaveBeenCalledTimes(2) // no infinite loop
    expect(ctrl.isPaused('weather.requested')).toBe(false)
  })

  it('Test 7: flushQueue("topic") con 5 event → audit `system.queue.flushed` con droppedCount=5 + droppedEventIds (D-169)', () => {
    const publishFn = vi.fn()
    const ctrl = createPauseController({ publishFn })
    ctrl.pauseTopic('weather.requested')
    for (let i = 1; i <= 5; i++) {
      ctrl.intercept(makeEvent('weather.requested', `evt-${i}`))
    }
    expect(ctrl.getSnapshot().queueSizes['weather.requested']).toBe(5)

    const result = ctrl.flushQueue('weather.requested')
    expect(result).toHaveLength(1)
    expect(result[0]?.topic).toBe('weather.requested')
    expect(result[0]?.droppedCount).toBe(5)
    expect(result[0]?.droppedEventIds).toEqual(['evt-1', 'evt-2', 'evt-3', 'evt-4', 'evt-5'])

    expect(publishFn).toHaveBeenCalledTimes(1)
    expect(publishFn.mock.calls[0]?.[0]).toBe('system.queue.flushed')
    const auditPayload = publishFn.mock.calls[0]?.[1] as {
      topic: string
      droppedCount: number
      droppedEventIds: readonly string[]
    }
    expect(auditPayload.topic).toBe('weather.requested')
    expect(auditPayload.droppedCount).toBe(5)
    expect(auditPayload.droppedEventIds).toEqual([
      'evt-1',
      'evt-2',
      'evt-3',
      'evt-4',
      'evt-5',
    ])
  })

  it('Test 8: flushQueue("topic") → topic ancora paused (queue empty ma isPaused=true) (D-169 retain state)', () => {
    const ctrl = createPauseController({ publishFn: vi.fn() })
    ctrl.pauseTopic('weather.requested')
    ctrl.intercept(makeEvent('weather.requested', 'evt-1'))
    ctrl.flushQueue('weather.requested')
    expect(ctrl.isPaused('weather.requested')).toBe(true)
    expect(ctrl.getSnapshot().queueSizes['weather.requested']).toBe(0)
  })

  it('Test 9: flushQueue() (no arg) → tutte le queue paused flushed + N audit events', () => {
    const publishFn = vi.fn()
    const ctrl = createPauseController({ publishFn })
    ctrl.pauseTopic('topic.a')
    ctrl.pauseTopic('topic.b')
    ctrl.intercept(makeEvent('topic.a', 'evt-a-1'))
    ctrl.intercept(makeEvent('topic.b', 'evt-b-1'))
    ctrl.intercept(makeEvent('topic.b', 'evt-b-2'))

    const result = ctrl.flushQueue()
    expect(result).toHaveLength(2)
    expect(publishFn).toHaveBeenCalledTimes(2)
    const topics = publishFn.mock.calls.map(
      (c) => (c[1] as { topic: string }).topic,
    )
    expect(topics).toContain('topic.a')
    expect(topics).toContain('topic.b')
  })

  it('Test 10: flushQueue su topic non-paused → no-op silente, zero audit (T-06-07-05)', () => {
    const publishFn = vi.fn()
    const ctrl = createPauseController({ publishFn })
    const result = ctrl.flushQueue('never.paused')
    expect(result).toEqual([])
    expect(publishFn).not.toHaveBeenCalled()
  })

  it('Test 11: cap drop-oldest D-170 — maxQueueSize=3, intercept 4 sequential → 1° dropped + audit `system.queue.overflow`', () => {
    const publishFn = vi.fn()
    const ctrl = createPauseController({ publishFn, maxQueueSize: 3 })
    ctrl.pauseTopic('weather.requested')
    expect(ctrl.intercept(makeEvent('weather.requested', 'evt-1'))).toBe('queued')
    expect(ctrl.intercept(makeEvent('weather.requested', 'evt-2'))).toBe('queued')
    expect(ctrl.intercept(makeEvent('weather.requested', 'evt-3'))).toBe('queued')
    // 4° → drop-oldest (evt-1)
    expect(ctrl.intercept(makeEvent('weather.requested', 'evt-4'))).toBe('dropped')

    expect(ctrl.getSnapshot().queueSizes['weather.requested']).toBe(3)
    expect(publishFn).toHaveBeenCalledTimes(1)
    expect(publishFn.mock.calls[0]?.[0]).toBe('system.queue.overflow')
    expect(publishFn.mock.calls[0]?.[1]).toEqual({
      topic: 'weather.requested',
      droppedEventId: 'evt-1',
    })

    // Verifica replay FIFO post-drop: queue dovrebbe contenere [evt-2, evt-3, evt-4]
    publishFn.mockClear()
    ctrl.resumeTopic('weather.requested')
    expect(publishFn).toHaveBeenCalledTimes(3)
    expect((publishFn.mock.calls[0]?.[1] as { value: string }).value).toBe('evt-2')
    expect((publishFn.mock.calls[1]?.[1] as { value: string }).value).toBe('evt-3')
    expect((publishFn.mock.calls[2]?.[1] as { value: string }).value).toBe('evt-4')
  })

  it('Test 12: cap drop multiple times — 10 events con cap=3 → ultimi 3 in queue + 7 audit overflow', () => {
    const publishFn = vi.fn()
    const ctrl = createPauseController({ publishFn, maxQueueSize: 3 })
    ctrl.pauseTopic('weather.requested')
    for (let i = 1; i <= 10; i++) {
      ctrl.intercept(makeEvent('weather.requested', `evt-${i}`))
    }
    expect(ctrl.getSnapshot().queueSizes['weather.requested']).toBe(3)
    // 7 overflow events emitted
    const overflowCalls = publishFn.mock.calls.filter(
      (c) => c[0] === 'system.queue.overflow',
    )
    expect(overflowCalls).toHaveLength(7)
    // Ultimi 3 in queue: evt-8, evt-9, evt-10
    publishFn.mockClear()
    ctrl.resumeTopic('weather.requested')
    expect(publishFn).toHaveBeenCalledTimes(3)
    expect((publishFn.mock.calls[0]?.[1] as { value: string }).value).toBe('evt-8')
    expect((publishFn.mock.calls[1]?.[1] as { value: string }).value).toBe('evt-9')
    expect((publishFn.mock.calls[2]?.[1] as { value: string }).value).toBe('evt-10')
  })

  it('Test 13: critical bypass D-170 — pauseTopic + intercept(priority="critical") → "pass" (NO queue, NO drop)', () => {
    const publishFn = vi.fn()
    const ctrl = createPauseController({ publishFn })
    ctrl.pauseTopic('weather.requested')
    const action = ctrl.intercept(
      makeEvent('weather.requested', 'evt-crit', 'critical'),
    )
    expect(action).toBe('pass')
    // Critical NON deve essere accodato
    expect(ctrl.getSnapshot().queueSizes['weather.requested']).toBe(0)
    // Nessun audit emit
    expect(publishFn).not.toHaveBeenCalled()
  })

  it('Test 14: critical bypass + cap saturato — 1000 normal + 1 critical → critical passes through (NO drop)', () => {
    const publishFn = vi.fn()
    const ctrl = createPauseController({ publishFn, maxQueueSize: 5 })
    ctrl.pauseTopic('weather.requested')
    // Saturate cap
    for (let i = 1; i <= 5; i++) {
      ctrl.intercept(makeEvent('weather.requested', `evt-${i}`))
    }
    publishFn.mockClear()
    // Critical event → pass through (no queue mutation, no overflow audit)
    const action = ctrl.intercept(
      makeEvent('weather.requested', 'evt-crit', 'critical'),
    )
    expect(action).toBe('pass')
    expect(ctrl.getSnapshot().queueSizes['weather.requested']).toBe(5)
    expect(publishFn).not.toHaveBeenCalled()
  })

  it('Test 15: getSnapshot() ritorna { pausedTopics, queueSizes, maxQueueSize }', () => {
    const ctrl = createPauseController({ publishFn: vi.fn(), maxQueueSize: 42 })
    ctrl.pauseTopic('topic.a')
    ctrl.pauseTopic('topic.b')
    ctrl.intercept(makeEvent('topic.a', 'evt-a-1'))
    ctrl.intercept(makeEvent('topic.a', 'evt-a-2'))
    ctrl.intercept(makeEvent('topic.b', 'evt-b-1'))

    const snap = ctrl.getSnapshot()
    expect(snap.maxQueueSize).toBe(42)
    expect(snap.pausedTopics).toEqual(expect.arrayContaining(['topic.a', 'topic.b']))
    expect(snap.queueSizes['topic.a']).toBe(2)
    expect(snap.queueSizes['topic.b']).toBe(1)
  })

  it('Test 16: default maxQueueSize=1000 quando non specificato (D-170 default)', () => {
    const ctrl = createPauseController({ publishFn: vi.fn() })
    expect(ctrl.getSnapshot().maxQueueSize).toBe(1000)
  })
})
