// multiplex-tap.test.ts — Tier-1 jsdom RED → GREEN test plan 06-04 Task 1.
//
// Verifica `createMultiplexTap(taps)`: aggregator chain N EventTap con error
// isolation try/catch isolato per tap (D-159 + D-20 carryover safeTapStep F1).
//
// Pattern role-match con F1 `bus.ts:79-110` `safeTapStep` (NON modificare —
// vincolo D-83 strict: replica inline il pattern in `multiplex-tap.ts`).
//
// Threat coverage:
// - T-06-04-01 (DoS tap throw blocca pipeline): Test 3 + Test 4 — un tap che
//   throw NON blocca downstream taps.
// - T-06-04-04 (DoS tap loop infinito): accept boundary — Documented anti-pattern
//   in DOC-06.

import type { EventTap, PipelineSnapshot, PipelineStep } from '@sembridge/core'
import { describe, expect, it, vi } from 'vitest'
import { createMultiplexTap } from './multiplex-tap'

function makeSnapshot(step: PipelineStep, eventId = 'evt-1'): PipelineSnapshot {
  return {
    eventId,
    topic: 'topic.test',
    step,
    timestamp: 1700000000000,
    durationMs: 0.5,
  }
}

describe('createMultiplexTap (D-159 chain N tap + error isolation D-20 carryover)', () => {
  it('Test 1: createMultiplexTap([]) ritorna EventTap valido con onPipelineStep no-op (early return)', () => {
    const tap = createMultiplexTap([])
    expect(tap).toBeDefined()
    expect(typeof tap.onPipelineStep).toBe('function')
    // No throw — chiamare onPipelineStep su 0 tap = no-op
    expect(() => {
      tap.onPipelineStep('event.received', makeSnapshot('event.received'))
    }).not.toThrow()
  })

  it('Test 2: createMultiplexTap([tap1]) chiama tap1.onPipelineStep con step + snapshot inalterati', () => {
    const tap1: EventTap = { onPipelineStep: vi.fn() }
    const aggregated = createMultiplexTap([tap1])
    const snap = makeSnapshot('event.received')
    aggregated.onPipelineStep('event.received', snap)
    expect(tap1.onPipelineStep).toHaveBeenCalledTimes(1)
    expect(tap1.onPipelineStep).toHaveBeenCalledWith('event.received', snap)
  })

  it('Test 3: tap2 throw → tap1 chiamato + tap3 chiamato (downstream non bloccato — error isolation D-159)', () => {
    const tap1: EventTap = { onPipelineStep: vi.fn() }
    const tap2: EventTap = {
      onPipelineStep: vi.fn(() => {
        throw new Error('tap2 boom')
      }),
    }
    const tap3: EventTap = { onPipelineStep: vi.fn() }
    const aggregated = createMultiplexTap([tap1, tap2, tap3])
    const snap = makeSnapshot('event.received')
    expect(() => {
      aggregated.onPipelineStep('event.received', snap)
    }).not.toThrow()
    expect(tap1.onPipelineStep).toHaveBeenCalledTimes(1)
    expect(tap2.onPipelineStep).toHaveBeenCalledTimes(1)
    expect(tap3.onPipelineStep).toHaveBeenCalledTimes(1)
  })

  it('Test 4: tutti i tap throw → tutti caught, no escalation', () => {
    const tap1: EventTap = {
      onPipelineStep: vi.fn(() => {
        throw new Error('boom1')
      }),
    }
    const tap2: EventTap = {
      onPipelineStep: vi.fn(() => {
        throw new Error('boom2')
      }),
    }
    const aggregated = createMultiplexTap([tap1, tap2])
    expect(() => {
      aggregated.onPipelineStep('event.received', makeSnapshot('event.received'))
    }).not.toThrow()
    expect(tap1.onPipelineStep).toHaveBeenCalledTimes(1)
    expect(tap2.onPipelineStep).toHaveBeenCalledTimes(1)
  })

  it('Test 5: ordering FIFO — tap1 chiamato PRIMA di tap2 (verifica via mock.invocationCallOrder)', () => {
    const spy1 = vi.fn()
    const spy2 = vi.fn()
    const tap1: EventTap = { onPipelineStep: spy1 }
    const tap2: EventTap = { onPipelineStep: spy2 }
    const aggregated = createMultiplexTap([tap1, tap2])
    aggregated.onPipelineStep('event.received', makeSnapshot('event.received'))
    expect(spy1.mock.invocationCallOrder[0]).toBeLessThan(spy2.mock.invocationCallOrder[0]!)
  })

  it('Test 6: step argument inalterato — multiplex passa stesso step literal a tutti i tap', () => {
    const calls1: PipelineStep[] = []
    const calls2: PipelineStep[] = []
    const tap1: EventTap = { onPipelineStep: (s) => calls1.push(s) }
    const tap2: EventTap = { onPipelineStep: (s) => calls2.push(s) }
    const aggregated = createMultiplexTap([tap1, tap2])
    aggregated.onPipelineStep('event.validated', makeSnapshot('event.validated'))
    expect(calls1).toEqual(['event.validated'])
    expect(calls2).toEqual(['event.validated'])
  })

  it('Test 7: snapshot argument inalterato — stessa reference passata a tutti i tap (no clone overhead)', () => {
    const refs: PipelineSnapshot[] = []
    const tap1: EventTap = {
      onPipelineStep: (_s, snap) => refs.push(snap),
    }
    const tap2: EventTap = {
      onPipelineStep: (_s, snap) => refs.push(snap),
    }
    const aggregated = createMultiplexTap([tap1, tap2])
    const snap = makeSnapshot('event.delivered')
    aggregated.onPipelineStep('event.delivered', snap)
    expect(refs[0]).toBe(snap) // identity check (no clone)
    expect(refs[1]).toBe(snap)
    expect(refs[0]).toBe(refs[1])
  })

  it('Test 8: N=10 tap tutti chiamati per ogni step §28 — counter assertion', () => {
    const taps: EventTap[] = Array.from({ length: 10 }, () => ({
      onPipelineStep: vi.fn(),
    }))
    const aggregated = createMultiplexTap(taps)
    aggregated.onPipelineStep('event.received', makeSnapshot('event.received'))
    for (const t of taps) {
      expect(t.onPipelineStep).toHaveBeenCalledTimes(1)
    }
  })

  it('Test 9: Pipeline step F1 (event.received) invocato → tutti i tap registrati ricevono il callback', () => {
    const tap1: EventTap = { onPipelineStep: vi.fn() }
    const tap2: EventTap = { onPipelineStep: vi.fn() }
    const aggregated = createMultiplexTap([tap1, tap2])
    aggregated.onPipelineStep('event.received', makeSnapshot('event.received'))
    expect(tap1.onPipelineStep).toHaveBeenCalledWith(
      'event.received',
      expect.objectContaining({ step: 'event.received' }),
    )
    expect(tap2.onPipelineStep).toHaveBeenCalledWith(
      'event.received',
      expect.objectContaining({ step: 'event.received' }),
    )
  })

  it('Test 10: Pipeline step F6 (event.observed) forward-compat con augment 06-01 step 14', () => {
    const tap1: EventTap = { onPipelineStep: vi.fn() }
    const tap2: EventTap = { onPipelineStep: vi.fn() }
    const aggregated = createMultiplexTap([tap1, tap2])
    // Cast: F6PipelineStep super-set additive (R4 augment.ts) — passato dal
    // consumer al tap che accetta `PipelineStep` core.
    const f6Step = 'event.observed' as PipelineStep
    aggregated.onPipelineStep(f6Step, makeSnapshot(f6Step))
    expect(tap1.onPipelineStep).toHaveBeenCalledWith(
      f6Step,
      expect.objectContaining({ step: f6Step }),
    )
    expect(tap2.onPipelineStep).toHaveBeenCalledWith(
      f6Step,
      expect.objectContaining({ step: f6Step }),
    )
  })
})
