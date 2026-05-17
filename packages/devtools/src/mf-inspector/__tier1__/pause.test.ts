/**
 * Tier-1 jsdom unit test per `createMfPause` (D-V2-F16-10).
 *
 * Copre: pause/resume toggle, intercept passthrough/queue, flush drain,
 * flush idempotent, isPaused reflect.
 */
import { describe, expect, it } from 'vitest'
import { createMfPause } from '../pause'

describe('createMfPause (D-V2-F16-10)', () => {
  it('isPaused default false (state iniziale non-paused)', () => {
    const ctrl = createMfPause()
    expect(ctrl.isPaused()).toBe(false)
  })

  it('pause() + isPaused() reflect → true', () => {
    const ctrl = createMfPause()
    ctrl.pause()
    expect(ctrl.isPaused()).toBe(true)
  })

  it('resume() torna a isPaused() === false', () => {
    const ctrl = createMfPause()
    ctrl.pause()
    ctrl.resume()
    expect(ctrl.isPaused()).toBe(false)
  })

  it('intercept(event) ritorna true quando !paused (passthrough)', () => {
    const ctrl = createMfPause()
    expect(ctrl.intercept({ topic: 'a' })).toBe(true)
    expect(ctrl.intercept({ topic: 'b' })).toBe(true)
  })

  it('intercept(event) ritorna false quando paused (queue)', () => {
    const ctrl = createMfPause()
    ctrl.pause()
    expect(ctrl.intercept({ topic: 'a' })).toBe(false)
    expect(ctrl.intercept({ topic: 'b' })).toBe(false)
  })

  it('flush() drena la queue accumulata e ritorna gli eventi', () => {
    const ctrl = createMfPause()
    ctrl.pause()
    ctrl.intercept({ topic: 'a' })
    ctrl.intercept({ topic: 'b' })
    const drained = ctrl.flush()
    expect(drained).toEqual([{ topic: 'a' }, { topic: 'b' }])
  })

  it('flush() svuota atomicamente (chiamate successive ritornano [])', () => {
    const ctrl = createMfPause()
    ctrl.pause()
    ctrl.intercept({ topic: 'a' })
    ctrl.flush()
    expect(ctrl.flush()).toEqual([])
  })

  it('flush() su queue vuota ritorna [] (no throw)', () => {
    const ctrl = createMfPause()
    expect(ctrl.flush()).toEqual([])
  })

  it('resume non re-emette eventi (semantica F16 ≠ F6 replay-broker — Pitfall §3.4)', () => {
    const ctrl = createMfPause()
    ctrl.pause()
    ctrl.intercept({ topic: 'a' })
    ctrl.resume()
    // Resume NON drena automaticamente — gli eventi restano in queue
    // (semantica F16 snapshot-retention vs F6 replay-broker)
    expect(ctrl.flush()).toEqual([{ topic: 'a' }])
  })
})
