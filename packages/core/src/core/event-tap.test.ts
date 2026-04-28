import { describe, expect, it, vi } from 'vitest'
import type { PipelineSnapshot, PipelineStep } from '../types/tap'
import { noopEventTap, safeTapStep, startStep } from './event-tap'

const makeSnapshot = (step: PipelineStep): PipelineSnapshot => ({
  eventId: 'evt-1',
  topic: 'test.topic',
  step,
  timestamp: Date.now(),
  durationMs: 0,
})

describe('noopEventTap', () => {
  it('onPipelineStep is a no-op that does not throw', () => {
    const snap = makeSnapshot('event.received')
    expect(() => noopEventTap.onPipelineStep('event.received', snap)).not.toThrow()
  })

  it('returns undefined (no return value)', () => {
    const snap = makeSnapshot('event.delivered')
    const ret = noopEventTap.onPipelineStep('event.delivered', snap)
    expect(ret).toBeUndefined()
  })
})

describe('safeTapStep', () => {
  it('invokes tap.onPipelineStep with provided step and snapshot', () => {
    const tap = { onPipelineStep: vi.fn() }
    const snap = makeSnapshot('event.received')
    safeTapStep(tap, 'event.received', snap)
    expect(tap.onPipelineStep).toHaveBeenCalledWith('event.received', snap)
  })

  it('swallows errors thrown by the tap (D-20)', () => {
    const tap = {
      onPipelineStep: vi.fn(() => {
        throw new Error('tap blew up')
      }),
    }
    const snap = makeSnapshot('event.validated')
    expect(() => safeTapStep(tap, 'event.validated', snap)).not.toThrow()
  })

  it('invokes onError callback when tap throws', () => {
    const onError = vi.fn()
    const err = new Error('boom')
    const tap = {
      onPipelineStep: vi.fn(() => {
        throw err
      }),
    }
    safeTapStep(tap, 'event.delivered', makeSnapshot('event.delivered'), onError)
    expect(onError).toHaveBeenCalledWith(err)
  })

  it('silently swallows when onError absent', () => {
    const tap = {
      onPipelineStep: vi.fn(() => {
        throw new Error('silent')
      }),
    }
    expect(() =>
      safeTapStep(tap, 'event.dedupe.checked', makeSnapshot('event.dedupe.checked')),
    ).not.toThrow()
  })
})

describe('startStep', () => {
  it('returns a factory that produces PipelineSnapshot', () => {
    const factory = startStep()
    const snap = factory('event.received', 'evt-1', 'test.topic')
    expect(snap.step).toBe('event.received')
    expect(snap.eventId).toBe('evt-1')
    expect(snap.topic).toBe('test.topic')
    expect(typeof snap.timestamp).toBe('number')
    expect(typeof snap.durationMs).toBe('number')
  })

  it('durationMs >= 0', () => {
    const factory = startStep()
    const snap = factory('event.delivered', 'evt-2', 'foo.bar')
    expect(snap.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('factory accepts extras to merge into snapshot', () => {
    const factory = startStep()
    const snap = factory('event.metadata.enriched', 'evt-3', 'x.y', {
      metadata: { subscriberCount: 5 },
    })
    expect(snap.metadata).toEqual({ subscriberCount: 5 })
  })
})
