// visibility-detector.test.ts — RED phase tests for createVisibilityDetector (D-110, RESEARCH §5).
//
// Pattern TDD RED→GREEN (D-117):
// - Questo file è scritto PRIMA di `visibility-detector.ts` per dimostrare RED gate.
// - 11 test deterministici (jsdom tier-1) coprono: idempotency, cleanup, DI guard, dispatch.
//
// Threat coverage (PLAN <threat_model>):
// - T-04-04-02 (Memory leak start ripetuto): Test 3 — addEventListener invocato UNA volta.
// - T-04-04-03 (Memory leak no stop): Test 4+10 — removeEventListener cleanup verificato.
// - T-04-04-01 (Tampering Document mock): Test 11 — DI usa mockDoc, non globalThis.document.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createVisibilityDetector, type VisibilityState } from './visibility-detector'

/**
 * Helper: crea un mock Document con `visibilityState` mutabile + dispatchEvent.
 * jsdom default ha già `document.addEventListener` funzionante, ma usiamo mock
 * per testare il DI path E il count delle invocazioni `addEventListener`.
 */
function createMockDocument(): Document & {
  __setState: (s: VisibilityState) => void
  __dispatch: () => void
} {
  const listeners = new Set<EventListener>()
  let state: VisibilityState = 'visible'
  const mock = {
    get visibilityState() {
      return state
    },
    addEventListener: vi.fn((type: string, fn: EventListener) => {
      if (type === 'visibilitychange') listeners.add(fn)
    }),
    removeEventListener: vi.fn((type: string, fn: EventListener) => {
      if (type === 'visibilitychange') listeners.delete(fn)
    }),
    __setState(s: VisibilityState): void {
      state = s
    },
    __dispatch(): void {
      const ev = new Event('visibilitychange')
      listeners.forEach((fn) => {
        fn(ev)
      })
    },
  } as unknown as Document & {
    __setState: (s: VisibilityState) => void
    __dispatch: () => void
  }
  return mock
}

describe('createVisibilityDetector (D-110, RESEARCH §5)', () => {
  let onChange: ReturnType<typeof vi.fn>
  let mockDoc: ReturnType<typeof createMockDocument>

  beforeEach(() => {
    onChange = vi.fn()
    mockDoc = createMockDocument()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('Test 1: prima di start() isActive() === false', () => {
    const v = createVisibilityDetector({ onChange, document: mockDoc })
    expect(v.isActive()).toBe(false)
  })

  it('Test 2: start() rende isActive() true; stop() torna a false', () => {
    const v = createVisibilityDetector({ onChange, document: mockDoc })
    v.start()
    expect(v.isActive()).toBe(true)
    v.stop()
    expect(v.isActive()).toBe(false)
  })

  it('Test 3: start() idempotente — registra UNA listener anche su 2 chiamate', () => {
    const v = createVisibilityDetector({ onChange, document: mockDoc })
    v.start()
    v.start()
    expect(mockDoc.addEventListener).toHaveBeenCalledTimes(1)
  })

  it('Test 4: stop() idempotente — removeEventListener chiamata UNA SOLA volta', () => {
    const v = createVisibilityDetector({ onChange, document: mockDoc })
    v.start()
    v.stop()
    v.stop()
    expect(mockDoc.removeEventListener).toHaveBeenCalledTimes(1)
  })

  it('Test 5: dispatch visibilitychange con state=hidden → onChange("hidden")', () => {
    const v = createVisibilityDetector({ onChange, document: mockDoc })
    v.start()
    mockDoc.__setState('hidden')
    mockDoc.__dispatch()
    expect(onChange).toHaveBeenCalledWith('hidden')
  })

  it('Test 6: dispatch visibilitychange con state=visible → onChange("visible")', () => {
    const v = createVisibilityDetector({ onChange, document: mockDoc })
    v.start()
    mockDoc.__setState('visible')
    mockDoc.__dispatch()
    expect(onChange).toHaveBeenCalledWith('visible')
  })

  it('Test 7: getState() coerente con mockDoc.visibilityState', () => {
    const v = createVisibilityDetector({ onChange, document: mockDoc })
    mockDoc.__setState('hidden')
    expect(v.getState()).toBe('hidden')
    mockDoc.__setState('visible')
    expect(v.getState()).toBe('visible')
  })

  it('Test 8: DI guard — document=null → start() no-op, getState() default "visible"', () => {
    const v = createVisibilityDetector({ onChange, document: null })
    v.start()
    expect(v.isActive()).toBe(false)
    expect(v.getState()).toBe('visible')
  })

  it('Test 9: DI guard — document=null → isActive() false anche post start()', () => {
    const v = createVisibilityDetector({ onChange, document: null })
    v.start()
    expect(v.isActive()).toBe(false)
  })

  it('Test 10: dispatch DOPO stop() NON invoca onChange', () => {
    const v = createVisibilityDetector({ onChange, document: mockDoc })
    v.start()
    v.stop()
    mockDoc.__setState('hidden')
    mockDoc.__dispatch()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('Test 11: addEventListener invocato sul Document iniettato, NON sul globalThis.document', () => {
    const globalSpy = vi.spyOn(globalThis.document, 'addEventListener')
    const v = createVisibilityDetector({ onChange, document: mockDoc })
    v.start()
    expect(mockDoc.addEventListener).toHaveBeenCalled()
    expect(globalSpy).not.toHaveBeenCalledWith('visibilitychange', expect.anything())
  })
})
