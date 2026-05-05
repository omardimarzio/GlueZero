// event-inspector.test.ts — Tier-1 jsdom RED → GREEN test plan 06-05 Task 1.
//
// Verifica `createEventInspector(opts)`: ring buffer 500 PipelineSnapshot default
// + lazy-mode toggle (D-160 + D-167) + deep-clone via structuredClone (D-162) +
// disable() clear-buffer (memory hygiene RESEARCH §6.3) + default NODE_ENV inline
// detection (uniformità cross-component WARNING-5 fix).
//
// Pattern role-match: F5 `task-tracker.ts:46-220` (state closure factory).
//
// Threat coverage:
// - T-06-05-01 (DoS buffer cresce illimitato): mitigated via D-167 cap + drop-oldest
//   FIFO. Test 5 verifica cap rispettato.
// - T-06-05-02 (Information disclosure leak via mutation): mitigated via D-162
//   structuredClone. Test 7 verifica mutation safety.
// - T-06-05-03 (Logic flaw disable non clear-buffer): mitigated. Test 4 verifica
//   buffer clear post-disable.
// - T-06-05-05 (Logic flaw production debug accidentale): mitigated via default
//   NODE_ENV inline. Test 12 verifica fallback detection.

import type { PipelineSnapshot, PipelineStep } from '@gluezero/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createEventInspector } from './event-inspector'

function makeSnapshot(
  step: PipelineStep,
  eventId = 'evt-1',
  payloadBefore?: unknown,
  payloadAfter?: unknown,
): PipelineSnapshot {
  return {
    eventId,
    topic: 'topic.test',
    step,
    timestamp: 1700000000000,
    durationMs: 0.5,
    payloadBefore,
    payloadAfter,
  }
}

describe('createEventInspector (D-160 lazy + D-162 deep-clone + D-167 ring buffer 500)', () => {
  it('Test 1: createEventInspector({}) ritorna API attesa con bufferSize default 500', () => {
    const inspector = createEventInspector({})
    expect(inspector).toBeDefined()
    expect(typeof inspector.tap.onPipelineStep).toBe('function')
    expect(typeof inspector.enable).toBe('function')
    expect(typeof inspector.disable).toBe('function')
    expect(typeof inspector.getBuffer).toBe('function')
    expect(typeof inspector.clear).toBe('function')
    expect(typeof inspector.getSnapshot).toBe('function')
    const snap = inspector.getSnapshot()
    expect(snap.bufferSize).toBe(500)
    expect(snap.bufferEntries).toBe(0)
  })

  it('Test 2: lazy-mode early-return — initiallyEnabled=false → 100 onPipelineStep no-op (buffer.length === 0)', () => {
    const inspector = createEventInspector({ initiallyEnabled: false })
    for (let i = 0; i < 100; i++) {
      inspector.tap.onPipelineStep('event.received', makeSnapshot('event.received', `evt-${i}`))
    }
    expect(inspector.getSnapshot().bufferEntries).toBe(0)
    expect(inspector.getBuffer()).toEqual([])
  })

  it('Test 3: enable() + 5 onPipelineStep → buffer.length === 5', () => {
    const inspector = createEventInspector({ initiallyEnabled: false })
    inspector.enable()
    for (let i = 0; i < 5; i++) {
      inspector.tap.onPipelineStep('event.received', makeSnapshot('event.received', `evt-${i}`))
    }
    expect(inspector.getSnapshot().bufferEntries).toBe(5)
  })

  it('Test 4: disable() → state.enabled === false + state.buffer === [] (memory hygiene)', () => {
    const inspector = createEventInspector({ initiallyEnabled: true })
    for (let i = 0; i < 10; i++) {
      inspector.tap.onPipelineStep('event.received', makeSnapshot('event.received', `evt-${i}`))
    }
    expect(inspector.getSnapshot().bufferEntries).toBe(10)
    inspector.disable()
    expect(inspector.getSnapshot().enabled).toBe(false)
    expect(inspector.getSnapshot().bufferEntries).toBe(0)
    expect(inspector.getBuffer()).toEqual([])
  })

  it('Test 5: cap rispettato — bufferSize=10, 15 onPipelineStep → buffer.length === 10 + first 5 evicted FIFO (drop-oldest)', () => {
    const inspector = createEventInspector({ bufferSize: 10, initiallyEnabled: true })
    for (let i = 0; i < 15; i++) {
      inspector.tap.onPipelineStep('event.received', makeSnapshot('event.received', `evt-${i}`))
    }
    const buffer = inspector.getBuffer()
    expect(buffer.length).toBe(10)
    // First entry should be evt-5 (evt-0..evt-4 evicted FIFO)
    expect(buffer[0]?.eventId).toBe('evt-5')
    expect(buffer[9]?.eventId).toBe('evt-14')
  })

  it('Test 6: getBuffer() ritorna deep-clone via structuredClone (D-162) — clone !== original reference', () => {
    const inspector = createEventInspector({ initiallyEnabled: true })
    inspector.tap.onPipelineStep('event.received', makeSnapshot('event.received', 'evt-1'))
    const clone1 = inspector.getBuffer()
    const clone2 = inspector.getBuffer()
    // Two distinct deep clones
    expect(clone1).not.toBe(clone2)
    // But content equal
    expect(clone1).toEqual(clone2)
  })

  it('Test 7: Mutation safety — getBuffer() = clone; clone mutation NON corrompe state.buffer (T-06-05-02)', () => {
    const inspector = createEventInspector({ initiallyEnabled: true })
    inspector.tap.onPipelineStep('event.received', makeSnapshot('event.received', 'evt-1'))
    const clone = inspector.getBuffer() as PipelineSnapshot[]
    // Mutate the clone (cast: structuredClone returns mutable array)
    clone.push(makeSnapshot('event.delivered', 'evt-fake'))
    // Internal state preserved
    expect(inspector.getSnapshot().bufferEntries).toBe(1)
    const fresh = inspector.getBuffer()
    expect(fresh.length).toBe(1)
    expect(fresh[0]?.eventId).toBe('evt-1')
  })

  it('Test 8: clear() → state.buffer === [] ma state.enabled inalterato', () => {
    const inspector = createEventInspector({ initiallyEnabled: true })
    inspector.tap.onPipelineStep('event.received', makeSnapshot('event.received', 'evt-1'))
    inspector.tap.onPipelineStep('event.received', makeSnapshot('event.received', 'evt-2'))
    expect(inspector.getSnapshot().bufferEntries).toBe(2)
    inspector.clear()
    expect(inspector.getSnapshot().bufferEntries).toBe(0)
    expect(inspector.getSnapshot().enabled).toBe(true) // enable inalterato
  })

  it('Test 9: Multiple PipelineStep types F1 (event.received, event.delivered) + F6 (event.observed) tutti catturati', () => {
    const inspector = createEventInspector({ initiallyEnabled: true })
    inspector.tap.onPipelineStep('event.received', makeSnapshot('event.received', 'evt-1'))
    inspector.tap.onPipelineStep('event.delivered', makeSnapshot('event.delivered', 'evt-1'))
    // F6 step 14 augment via cast (R4 super-set additive)
    const f6Step = 'event.observed' as PipelineStep
    inspector.tap.onPipelineStep(f6Step, makeSnapshot(f6Step, 'evt-1'))
    const buffer = inspector.getBuffer()
    expect(buffer.length).toBe(3)
    expect(buffer.map((b) => b.step)).toEqual([
      'event.received',
      'event.delivered',
      'event.observed',
    ])
  })

  it('Test 10: PipelineSnapshot con payloadBefore/After preservato in buffer (deep equal)', () => {
    const inspector = createEventInspector({ initiallyEnabled: true })
    const before = { foo: 'bar', nested: { x: 1 } }
    const after = { foo: 'baz', nested: { x: 2 } }
    inspector.tap.onPipelineStep(
      'event.received',
      makeSnapshot('event.received', 'evt-1', before, after),
    )
    const buffer = inspector.getBuffer()
    expect(buffer.length).toBe(1)
    expect(buffer[0]?.payloadBefore).toEqual(before)
    expect(buffer[0]?.payloadAfter).toEqual(after)
    // structuredClone — deep-clone, not same ref
    expect(buffer[0]?.payloadBefore).not.toBe(before)
  })

  it('Test 11: initiallyEnabled=true esplicito → state.enabled === true al boot', () => {
    const inspector = createEventInspector({ initiallyEnabled: true })
    expect(inspector.getSnapshot().enabled).toBe(true)
  })

  describe('Test 12: Default NODE_ENV inline detection (D-160 uniformità cross-component)', () => {
    let originalEnv: string | undefined
    let originalProcess: typeof globalThis.process | undefined

    beforeEach(() => {
      originalProcess = globalThis.process
      originalEnv = globalThis.process?.env?.NODE_ENV
    })

    afterEach(() => {
      // restore
      if (originalProcess) {
        globalThis.process = originalProcess
        if (globalThis.process.env) {
          if (originalEnv === undefined) {
            delete globalThis.process.env.NODE_ENV
          } else {
            globalThis.process.env.NODE_ENV = originalEnv
          }
        }
      }
    })

    it('NODE_ENV=production + opts={} → state.enabled === false', () => {
      globalThis.process.env.NODE_ENV = 'production'
      const inspector = createEventInspector({})
      expect(inspector.getSnapshot().enabled).toBe(false)
    })

    it('NODE_ENV=development + opts={} → state.enabled === true', () => {
      globalThis.process.env.NODE_ENV = 'development'
      const inspector = createEventInspector({})
      expect(inspector.getSnapshot().enabled).toBe(true)
    })

    it('Missing process global (browser sim) → state.enabled === true (DX dev-friendly fallback)', () => {
      // Simulate browser: process undefined
      // @ts-expect-error -- intentional global override for browser sim
      globalThis.process = undefined
      const inspector = createEventInspector({})
      expect(inspector.getSnapshot().enabled).toBe(true)
    })
  })
})
