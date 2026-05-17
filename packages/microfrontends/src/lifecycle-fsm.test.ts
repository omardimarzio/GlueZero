/**
 * Test FSM Lifecycle 14×14 matrix coverage + failure semantics + timings (MF-LIFE-02, MF-LIFE-06).
 *
 * Tier-1 jsdom (no DOM dependency — pure state machine).
 *
 * Matrix coverage: 14 stati × 14 = 196 transition pairs verified.
 * D-V2-06 BLOCKING: `destroyed → mounted` REJECTED + `failed → mounted` REJECTED senza recovery.
 *
 * @see RESEARCH §3.6 + PATTERNS §43
 */
import { describe, expect, it } from 'vitest'
import { LifecycleManager } from './lifecycle-fsm'
import type { MicroFrontendRegistration } from './types/descriptor'
import { ALLOWED_TRANSITIONS, type MicroFrontendState } from './types/lifecycle'

/**
 * Helper: assert che `fn` throws un errore con `code === expectedCode`.
 *
 * Replica pattern descriptor-validator.test.ts — `code` è property strutturata
 * del BrokerError, NON parte del `message` human-readable.
 */
function expectThrowWithCode(fn: () => unknown, expectedCode: string): void {
  try {
    fn()
    throw new Error(`expected to throw ${expectedCode}, but did not throw`)
  } catch (err: unknown) {
    const e = err as { code?: string }
    expect(e.code).toBe(expectedCode)
  }
}

/** Helper: costruisce una registrazione minimale con stato dato. */
function makeReg(state: MicroFrontendState): MicroFrontendRegistration {
  return {
    descriptor: { id: 'test-mf', name: 'Test', version: '1.0.0' },
    state,
  }
}

/** Tutti i 14 stati per matrix iteration. */
const ALL_STATES: readonly MicroFrontendState[] = [
  'registered',
  'resolving',
  'loading',
  'loaded',
  'bootstrapping',
  'bootstrapped',
  'mounting',
  'mounted',
  'updating',
  'unmounting',
  'unmounted',
  'destroying',
  'destroyed',
  'failed',
] as const

describe('LifecycleManager — cardinality check (14 stati esatti)', () => {
  it('14 states union ha esattamente 14 members', () => {
    expect(ALL_STATES.length).toBe(14)
    // Cardinality verifica anche da ALLOWED_TRANSITIONS keys
    expect(Object.keys(ALLOWED_TRANSITIONS).length).toBe(14)
  })

  it('ogni stato ha entry in ALLOWED_TRANSITIONS', () => {
    for (const s of ALL_STATES) {
      expect(ALLOWED_TRANSITIONS[s]).toBeDefined()
    }
  })
})

describe('LifecycleManager — 14×14 transitions matrix (MF-LIFE-02)', () => {
  const fsm = new LifecycleManager()

  // Iteriamo 14×14 = 196 combinazioni from→to (~30 allowed + ~166 rejected)
  for (const from of ALL_STATES) {
    for (const to of ALL_STATES) {
      const expected = ALLOWED_TRANSITIONS[from].has(to)

      it(`${from} → ${to} ${expected ? 'ALLOWED' : 'REJECTED'}`, () => {
        const reg = makeReg(from)
        if (expected) {
          // Caso allowed: mutate state, nessuna eccezione
          expect(() => {
            // Per transizioni a 'failed', fornisci failure context (best practice)
            if (to === 'failed') {
              fsm.transition(reg, to, {
                phase: 'runtime',
                error: new Error('test'),
              })
            } else {
              fsm.transition(reg, to)
            }
          }).not.toThrow()
          expect(reg.state).toBe(to)
          expect(reg.previousState).toBe(from)
        } else {
          // Caso rejected: throw MF_STATE_INVALID, stato invariato (atomic check-then-set)
          expectThrowWithCode(() => fsm.transition(reg, to), 'MF_STATE_INVALID')
          expect(reg.state).toBe(from) // stato NON modificato
          expect(reg.previousState).toBeUndefined()
        }
      })
    }
  }
})

describe('LifecycleManager — failure semantics (MF-LIFE-06, D-V2-06)', () => {
  const fsm = new LifecycleManager()

  it('transition → failed popola failureReason con phase fornita', () => {
    const reg = makeReg('loading')
    const before = Date.now()
    fsm.transition(reg, 'failed', {
      phase: 'load',
      error: new Error('network timeout'),
    })
    expect(reg.state).toBe('failed')
    expect(reg.failureReason?.phase).toBe('load')
    expect(reg.failureReason?.error.message).toBe('network timeout')
    expect(reg.failureReason?.timestamp).toBeGreaterThanOrEqual(before)
    expect(reg.failureReason?.recoverable).toBe(false) // F8 stub default
  })

  it('transition → failed senza failure context fallback runtime phase', () => {
    const reg = makeReg('loading')
    fsm.transition(reg, 'failed')
    expect(reg.state).toBe('failed')
    expect(reg.failureReason?.phase).toBe('runtime') // fallback
    expect(reg.failureReason?.error).toBeInstanceOf(Error)
    expect(reg.failureReason?.error.message).toMatch(/Unknown failure cause/)
  })

  it('transition failed → loading (recovery) resetta failureReason', () => {
    const reg = makeReg('failed')
    reg.failureReason = {
      phase: 'mount',
      error: new Error('previous failure'),
      timestamp: Date.now() - 1000,
    }
    fsm.transition(reg, 'loading') // recovery path
    expect(reg.state).toBe('loading')
    // failureReason ora resettato perché to !== 'failed' (recovery cleanup)
    expect(reg.failureReason).toBeUndefined()
  })

  it('transizione vietata destroyed → mounted produces MF_STATE_INVALID', () => {
    const reg = makeReg('destroyed')
    expectThrowWithCode(() => fsm.transition(reg, 'mounted'), 'MF_STATE_INVALID')
    expect(reg.state).toBe('destroyed') // stato non modificato
  })

  it('transizione vietata failed → mounted (senza recovery loading) produces MF_STATE_INVALID', () => {
    const reg = makeReg('failed')
    expectThrowWithCode(() => fsm.transition(reg, 'mounted'), 'MF_STATE_INVALID')
    expect(reg.state).toBe('failed') // stato non modificato
  })

  it('transizione failed → loading (recovery) ammessa', () => {
    const reg = makeReg('failed')
    expect(() => fsm.transition(reg, 'loading')).not.toThrow()
    expect(reg.state).toBe('loading')
  })

  it('transizione failed → destroying (cleanup) ammessa', () => {
    const reg = makeReg('failed')
    expect(() => fsm.transition(reg, 'destroying')).not.toThrow()
    expect(reg.state).toBe('destroying')
  })

  it('destroyed è sink state — solo se stesso (no outgoing transitions)', () => {
    // ALLOWED_TRANSITIONS.destroyed = new Set([])
    expect(ALLOWED_TRANSITIONS.destroyed.size).toBe(0)
  })

  it('MF_STATE_INVALID error contiene details.allowedFromHere array', () => {
    const reg = makeReg('mounted')
    try {
      fsm.transition(reg, 'registered') // vietato
      expect.fail('should have thrown')
    } catch (err: unknown) {
      const e = err as { code?: string; details?: Record<string, unknown> }
      expect(e.code).toBe('MF_STATE_INVALID')
      expect(e.details).toBeDefined()
      expect(e.details?.from).toBe('mounted')
      expect(e.details?.to).toBe('registered')
      expect(Array.isArray(e.details?.allowedFromHere)).toBe(true)
      // mounted può andare a: updating, unmounting, failed
      expect(e.details?.allowedFromHere).toEqual(
        expect.arrayContaining(['updating', 'unmounting', 'failed']),
      )
    }
  })
})

describe('LifecycleManager — timings tracking (PRD §31.4)', () => {
  const fsm = new LifecycleManager()

  it('mounted state aggiorna timings.mountedAt', () => {
    const reg = makeReg('mounting')
    const before = Date.now()
    fsm.transition(reg, 'mounted')
    expect(reg.timings?.mountedAt).toBeGreaterThanOrEqual(before)
  })

  it('loading state aggiorna timings.loadStartedAt', () => {
    const reg = makeReg('resolving')
    const before = Date.now()
    fsm.transition(reg, 'loading')
    expect(reg.timings?.loadStartedAt).toBeGreaterThanOrEqual(before)
  })

  it('loaded state aggiorna timings.loadedAt', () => {
    const reg = makeReg('loading')
    const before = Date.now()
    fsm.transition(reg, 'loaded')
    expect(reg.timings?.loadedAt).toBeGreaterThanOrEqual(before)
  })

  it('bootstrapped state aggiorna timings.bootstrappedAt', () => {
    const reg = makeReg('bootstrapping')
    const before = Date.now()
    fsm.transition(reg, 'bootstrapped')
    expect(reg.timings?.bootstrappedAt).toBeGreaterThanOrEqual(before)
  })

  it('unmounted state aggiorna timings.unmountedAt', () => {
    const reg = makeReg('unmounting')
    const before = Date.now()
    fsm.transition(reg, 'unmounted')
    expect(reg.timings?.unmountedAt).toBeGreaterThanOrEqual(before)
  })

  it('destroyed state aggiorna timings.destroyedAt', () => {
    const reg = makeReg('destroying')
    const before = Date.now()
    fsm.transition(reg, 'destroyed')
    expect(reg.timings?.destroyedAt).toBeGreaterThanOrEqual(before)
  })

  it('timings accumulati attraverso il lifecycle multi-stato', () => {
    const reg = makeReg('registered')
    fsm.transition(reg, 'resolving')
    fsm.transition(reg, 'loading')
    fsm.transition(reg, 'loaded')
    fsm.transition(reg, 'bootstrapping')
    fsm.transition(reg, 'bootstrapped')
    fsm.transition(reg, 'mounting')
    fsm.transition(reg, 'mounted')
    expect(reg.timings?.loadStartedAt).toBeDefined()
    expect(reg.timings?.loadedAt).toBeDefined()
    expect(reg.timings?.bootstrappedAt).toBeDefined()
    expect(reg.timings?.mountedAt).toBeDefined()
  })
})

describe('LifecycleManager.isAllowed — static helper', () => {
  it('ritorna true per transition ammessa', () => {
    expect(LifecycleManager.isAllowed('registered', 'resolving')).toBe(true)
    expect(LifecycleManager.isAllowed('mounted', 'unmounting')).toBe(true)
    expect(LifecycleManager.isAllowed('failed', 'loading')).toBe(true)
  })

  it('ritorna false per transition vietata', () => {
    expect(LifecycleManager.isAllowed('destroyed', 'mounted')).toBe(false)
    expect(LifecycleManager.isAllowed('failed', 'mounted')).toBe(false)
    expect(LifecycleManager.isAllowed('registered', 'mounted')).toBe(false)
  })

  it('static helper coerente con instance enforce', () => {
    const fsm = new LifecycleManager()
    // Se isAllowed dice false, transition deve throw
    expect(LifecycleManager.isAllowed('destroyed', 'mounted')).toBe(false)
    const reg = makeReg('destroyed')
    expectThrowWithCode(() => fsm.transition(reg, 'mounted'), 'MF_STATE_INVALID')
  })
})
