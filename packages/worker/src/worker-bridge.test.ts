// worker-bridge.test.ts — Tier-1 jsdom unit (D-150) per `WorkerBridge` plan 05-04
// (D-124, D-129, D-131, D-132, D-135, D-137, D-139, D-140, D-141).
//
// 15 test deterministici TDD RED→GREEN co-located. Pattern DI MockWorker analog F4
// `sse-adapter.test.ts` con `EventSourceCtor: MockEventSource as unknown as typeof EventSource`.
//
// Coverage decisioni:
// - Test 1 — D-129 lazy first dispatch
// - Test 2 — Comlink.wrap eseguito al primo dispatch + worker riusato
// - Test 3 — D-124 fail-fast `worker.task.unknown` (taskName non in desc.tasks)
// - Test 4 — D-139/D-140 assertSerializable PRE-postMessage (function field)
// - Test 5 — D-139 mode='off' bypassa validazione
// - Test 6 — D-141 extractTransferables + Comlink.transfer
// - Test 7 — D-132 AbortSignal proxied via Comlink.proxy
// - Test 8 — D-135 onProgress proxied via Comlink.proxy quando fornita
// - Test 9 — D-137 progress throttling latest-only window
// - Test 10 — D-131 terminate Comlink.releaseProxy + worker.terminate + re-spawn
// - Test 11 — terminate idempotente
// - Test 12 — BrokerError da assertSerializable propagato senza wrapping
// - Test 13 — Worker 'error' event memorizzato come last error
// - Test 14 — Worker 'messageerror' event memorizzato come last error
// - Test 15 — getDebugSnapshot ritorna shape strutturata

import * as Comlink from 'comlink'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isBrokerError, type BrokerError } from '@sembridge/core'

import { MockWorker } from './test-utils/mock-worker'
import { WorkerBridge } from './worker-bridge'
import type { WorkerDescriptor } from './types/worker-descriptor'

// ============================================================================
// Helpers
// ============================================================================

function makeDescriptor(overrides: Partial<WorkerDescriptor> = {}): WorkerDescriptor {
  return {
    id: 'test-worker',
    factory: () => new MockWorker('about:blank') as unknown as Worker,
    tasks: ['parseCsv', 'echoBuffer'] as const,
    mode: 'dedicated',
    ...overrides,
  }
}

function makeBridge(
  desc: WorkerDescriptor = makeDescriptor(),
  deps: ConstructorParameters<typeof WorkerBridge>[1] = {},
): WorkerBridge {
  return new WorkerBridge(desc, deps)
}

/** Auto-reply pattern: stub `Comlink.wrap` per evitare dipendenza da MessageChannel. */
function stubComlinkWrap<T>(replyFn: (taskName: string, ...args: unknown[]) => Promise<T>): {
  restore: () => void
  callArgs: Array<{ taskName: string; args: unknown[] }>
} {
  const callArgs: Array<{ taskName: string; args: unknown[] }> = []
  const original = Comlink.wrap
  // biome-ignore lint/suspicious/noExplicitAny: stub di Comlink.wrap richiede any per match signature
  ;(Comlink as { wrap: typeof Comlink.wrap }).wrap = ((_ep: unknown) => {
    // Proxy che intercetta property access come task function
    return new Proxy(
      {},
      {
        get(_t, prop: string | symbol) {
          if (prop === Comlink.releaseProxy) {
            return () => {
              /* noop release */
            }
          }
          if (typeof prop !== 'string') return undefined
          return (...args: unknown[]) => {
            callArgs.push({ taskName: prop, args })
            return replyFn(prop, ...args)
          }
        },
      },
    )
  }) as unknown as typeof Comlink.wrap
  return {
    callArgs,
    restore: () => {
      ;(Comlink as { wrap: typeof Comlink.wrap }).wrap = original
    },
  }
}

// ============================================================================
// Suite
// ============================================================================

describe('WorkerBridge — Comlink wrap + lifecycle (D-124/129/131/132/135/137/139/140/141)', () => {
  beforeEach(() => MockWorker.reset())

  // --------------------------------------------------------------------------
  // Test 1 — D-129 lazy first dispatch
  // --------------------------------------------------------------------------
  it('Test 1 (D-129): construction NON spawna Worker (lazy first-dispatch)', () => {
    const bridge = makeBridge()
    expect(bridge).toBeDefined()
    expect(MockWorker.instances).toHaveLength(0)
  })

  // --------------------------------------------------------------------------
  // Test 2 — first dispatch spawna + subsequent dispatch riusa
  // --------------------------------------------------------------------------
  it('Test 2 (D-129): first dispatch invoca factory + Comlink.wrap; subsequent riusa stesso worker', async () => {
    const stub = stubComlinkWrap(async (_task: string, _payload: unknown) => 'ok-result')
    try {
      const bridge = makeBridge()
      await bridge.dispatch('parseCsv', { rows: 10 }, new AbortController().signal)
      expect(MockWorker.instances).toHaveLength(1)
      const firstWorker = MockWorker.instances[0]

      await bridge.dispatch('parseCsv', { rows: 20 }, new AbortController().signal)
      expect(MockWorker.instances).toHaveLength(1) // riuso, no second spawn
      expect(MockWorker.instances[0]).toBe(firstWorker)
      expect(stub.callArgs.length).toBe(2)
    } finally {
      stub.restore()
    }
  })

  // --------------------------------------------------------------------------
  // Test 3 — D-124 fail-fast unknown task
  // --------------------------------------------------------------------------
  it('Test 3 (D-124): unknown task throws BrokerError code=worker.task.unknown category=config', async () => {
    const bridge = makeBridge()
    const ctrl = new AbortController()
    let caught: unknown = null
    try {
      await bridge.dispatch('not-a-task', { x: 1 }, ctrl.signal)
    } catch (e) {
      caught = e
    }
    expect(caught).not.toBeNull()
    expect(isBrokerError(caught)).toBe(true)
    const err = caught as BrokerError
    expect(err.code).toBe('worker.task.unknown')
    expect(err.category).toBe('config')
    expect(err.details?.['workerId']).toBe('test-worker')
    expect(err.details?.['taskName']).toBe('not-a-task')
    // Fail-fast: no spawn (Comlink.wrap mai invocato)
    expect(MockWorker.instances).toHaveLength(0)
  })

  // --------------------------------------------------------------------------
  // Test 4 — D-139/D-140 assertSerializable PRE-postMessage (mode='always')
  // --------------------------------------------------------------------------
  it('Test 4 (D-139/D-140): assertSerializable PRE-postMessage throw worker.serialization.failed.function (mode=always) + NO spawn', async () => {
    const bridge = makeBridge(makeDescriptor(), { assertSerializableMode: 'always' })
    const ctrl = new AbortController()
    let caught: unknown = null
    try {
      await bridge.dispatch('parseCsv', { fn: () => 'x' }, ctrl.signal)
    } catch (e) {
      caught = e
    }
    expect(isBrokerError(caught)).toBe(true)
    const err = caught as BrokerError
    expect(err.code).toBe('worker.serialization.failed.function')
    expect(err.category).toBe('worker')
    expect(err.details?.['fieldPath']).toBe('fn')
    // CRITICAL: NO spawn. Throw avviene PRIMA di ensureSpawned.
    expect(MockWorker.instances).toHaveLength(0)
  })

  // --------------------------------------------------------------------------
  // Test 5 — D-139 mode='off' bypassa validazione
  // --------------------------------------------------------------------------
  it("Test 5 (D-139): assertSerializable mode='off' bypassa validazione (zero overhead)", async () => {
    const stub = stubComlinkWrap(async () => 'ok')
    try {
      const bridge = makeBridge(makeDescriptor(), { assertSerializableMode: 'off' })
      const ctrl = new AbortController()
      // Payload con function — normalmente fallirebbe in 'always'/'dev'
      await bridge.dispatch('parseCsv', { fn: () => 'x' }, ctrl.signal)
      // No throw — il bridge ha proseguito al dispatch
      expect(MockWorker.instances).toHaveLength(1)
      expect(stub.callArgs.length).toBe(1)
    } finally {
      stub.restore()
    }
  })

  // --------------------------------------------------------------------------
  // Test 6 — D-141 extractTransferables + Comlink.transfer
  // --------------------------------------------------------------------------
  it('Test 6 (D-141): extractTransferables invocato + Comlink.transfer applicato quando paths.length > 0', async () => {
    const stub = stubComlinkWrap(async () => 'ok')
    try {
      const bridge = makeBridge(makeDescriptor(), { assertSerializableMode: 'off' })
      const ctrl = new AbortController()
      const buf = new ArrayBuffer(16)
      await bridge.dispatch('echoBuffer', { audioBuffer: buf, meta: 'x' }, ctrl.signal, undefined, {
        transferable: ['audioBuffer'],
      })
      // Verifica callArgs[0] — Comlink.transfer marca il payload con `Comlink.transfer`
      // metadata. Il primo arg è il payload, qui controlliamo che sia stato chiamato 1 volta.
      expect(stub.callArgs.length).toBe(1)
      expect(stub.callArgs[0]?.taskName).toBe('echoBuffer')
      // Il payload arrivato al wrap call è marcato da Comlink.transfer (object identity preserved).
      const firstArg = stub.callArgs[0]?.args[0] as { audioBuffer: ArrayBuffer; meta: string }
      expect(firstArg.audioBuffer).toBe(buf)
      expect(firstArg.meta).toBe('x')
    } finally {
      stub.restore()
    }
  })

  // --------------------------------------------------------------------------
  // Test 7 — D-132 AbortSignal proxied via Comlink.proxy
  // --------------------------------------------------------------------------
  it('Test 7 (D-132): AbortSignal proxied via Comlink.proxy passato come 2° arg al task', async () => {
    const stub = stubComlinkWrap(async () => 'ok')
    const proxySpy = vi.spyOn(Comlink, 'proxy')
    try {
      const bridge = makeBridge(makeDescriptor(), { assertSerializableMode: 'off' })
      const ctrl = new AbortController()
      await bridge.dispatch('parseCsv', { x: 1 }, ctrl.signal)
      // Almeno 1 chiamata Comlink.proxy(signal) deve essere avvenuta
      const calledWithSignal = proxySpy.mock.calls.some((args) => args[0] === ctrl.signal)
      expect(calledWithSignal).toBe(true)
      // Il signalProxy è passato come 2° arg al task
      expect(stub.callArgs.length).toBe(1)
      expect(stub.callArgs[0]?.args.length).toBeGreaterThanOrEqual(2)
    } finally {
      proxySpy.mockRestore()
      stub.restore()
    }
  })

  // --------------------------------------------------------------------------
  // Test 8 — D-135 onProgress proxied (quando fornita)
  // --------------------------------------------------------------------------
  it('Test 8 (D-135): onProgress proxied via Comlink.proxy quando fornita; undefined quando assente', async () => {
    const stub = stubComlinkWrap(async () => 'ok')
    const proxySpy = vi.spyOn(Comlink, 'proxy')
    try {
      const bridge = makeBridge(makeDescriptor(), { assertSerializableMode: 'off' })
      const ctrl = new AbortController()

      // Caso 1: onProgress fornita → Comlink.proxy chiamato con la callback
      const onProgress = vi.fn()
      await bridge.dispatch('parseCsv', { x: 1 }, ctrl.signal, onProgress)
      // signal proxied + onProgress proxied
      expect(proxySpy.mock.calls.length).toBeGreaterThanOrEqual(2)
      // 3° arg al task non undefined
      expect(stub.callArgs[0]?.args[2]).not.toBeUndefined()

      // Caso 2: onProgress undefined → 3° arg è undefined
      proxySpy.mockClear()
      stub.callArgs.length = 0
      await bridge.dispatch('parseCsv', { x: 2 }, ctrl.signal)
      expect(stub.callArgs[0]?.args[2]).toBeUndefined()
    } finally {
      proxySpy.mockRestore()
      stub.restore()
    }
  })

  // --------------------------------------------------------------------------
  // Test 9 — D-137 progress throttling latest-only window
  // --------------------------------------------------------------------------
  it('Test 9 (D-137): progress throttling latest-only window — N onProgress calls in <window collassano in <=2 emit', async () => {
    vi.useFakeTimers()
    try {
      const stub = stubComlinkWrap(
        async (
          _task: string,
          _payload: unknown,
          _signal: unknown,
          onProgressProxy: unknown,
        ) => {
          // Il proxy è una function-callable (Comlink.proxy on funzioni). Simuliamo
          // 100 chiamate sincrone in `0ms` — la finestra throttle deve collassare.
          if (typeof onProgressProxy === 'function') {
            for (let i = 0; i < 100; i++) {
              ;(onProgressProxy as (p: { value: number }) => void)({ value: i / 100 })
            }
          }
          return 'ok'
        },
      )
      try {
        const bridge = makeBridge(makeDescriptor(), { assertSerializableMode: 'off' })
        const onProgress = vi.fn()
        await bridge.dispatch(
          'parseCsv',
          { x: 1 },
          new AbortController().signal,
          onProgress,
          { progressThrottleMs: 100 },
        )
        // Prima chiamata sincrona passa subito (window aperta).
        // Le 99 successive in <100ms vengono collassate. Trailing flush schedule.
        const callsBeforeFlush = onProgress.mock.calls.length
        expect(callsBeforeFlush).toBe(1) // solo la prima leading chiamata
        // Avanza i timer per il trailing flush
        await vi.advanceTimersByTimeAsync(150)
        const callsAfterFlush = onProgress.mock.calls.length
        // Latest-only: 1 leading + 1 trailing = max 2
        expect(callsAfterFlush).toBeGreaterThanOrEqual(1)
        expect(callsAfterFlush).toBeLessThanOrEqual(2)
        // L'ultima chiamata deve essere il valore finale (latest-only)
        const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1]
        expect((lastCall?.[0] as { value: number }).value).toBeCloseTo(99 / 100, 5)
      } finally {
        stub.restore()
      }
    } finally {
      vi.useRealTimers()
    }
  })

  // --------------------------------------------------------------------------
  // Test 10 — D-131 terminate Comlink.releaseProxy + worker.terminate + re-spawn
  // --------------------------------------------------------------------------
  it('Test 10 (D-131): terminate releases proxy + terminates worker + lazy re-spawn al next dispatch', async () => {
    const stub = stubComlinkWrap(async () => 'ok')
    try {
      const bridge = makeBridge(makeDescriptor(), { assertSerializableMode: 'off' })
      const ctrl = new AbortController()
      await bridge.dispatch('parseCsv', { x: 1 }, ctrl.signal)
      expect(MockWorker.instances).toHaveLength(1)
      const firstWorker = MockWorker.instances[0]
      expect(firstWorker?.terminated).toBe(false)

      bridge.terminate()
      expect(firstWorker?.terminated).toBe(true)

      // Subsequent dispatch deve re-spawnare nuovo worker
      await bridge.dispatch('parseCsv', { x: 2 }, ctrl.signal)
      expect(MockWorker.instances).toHaveLength(2)
      expect(MockWorker.instances[1]).not.toBe(firstWorker)
    } finally {
      stub.restore()
    }
  })

  // --------------------------------------------------------------------------
  // Test 11 — terminate idempotente
  // --------------------------------------------------------------------------
  it('Test 11: terminate idempotente — chiamato 2x non throw, 2° è no-op', async () => {
    const stub = stubComlinkWrap(async () => 'ok')
    try {
      const bridge = makeBridge(makeDescriptor(), { assertSerializableMode: 'off' })
      await bridge.dispatch('parseCsv', { x: 1 }, new AbortController().signal)
      const w = MockWorker.instances[0]
      expect(() => bridge.terminate()).not.toThrow()
      expect(() => bridge.terminate()).not.toThrow()
      expect(w?.terminated).toBe(true)
    } finally {
      stub.restore()
    }
  })

  // --------------------------------------------------------------------------
  // Test 12 — BrokerError da assertSerializable propagato senza wrapping
  // --------------------------------------------------------------------------
  it('Test 12: BrokerError da assertSerializable rethrown senza wrapping (preserva code/category/details)', async () => {
    const bridge = makeBridge(makeDescriptor(), { assertSerializableMode: 'always' })
    let caught: unknown = null
    try {
      await bridge.dispatch(
        'parseCsv',
        { deep: { nested: { transform: (x: number) => x * 2 } } },
        new AbortController().signal,
      )
    } catch (e) {
      caught = e
    }
    expect(isBrokerError(caught)).toBe(true)
    const err = caught as BrokerError
    expect(err.code).toBe('worker.serialization.failed.function')
    expect(err.category).toBe('worker')
    expect(err.details?.['fieldPath']).toBe('deep.nested.transform')
    expect(err.details?.['fieldType']).toBe('function')
  })

  // --------------------------------------------------------------------------
  // Test 13 — Worker 'error' event → store last error
  // --------------------------------------------------------------------------
  it("Test 13: worker 'error' event memorizzato come last error code=worker.error category=worker", async () => {
    const stub = stubComlinkWrap(async () => 'ok')
    try {
      const bridge = makeBridge(makeDescriptor(), { assertSerializableMode: 'off' })
      await bridge.dispatch('parseCsv', { x: 1 }, new AbortController().signal)
      const worker = MockWorker.instances[0]
      worker?.__error('boom', 'worker.js', 42)
      const lastErr = bridge.getLastErrorForTesting()
      expect(lastErr).not.toBeNull()
      expect(isBrokerError(lastErr)).toBe(true)
      const err = lastErr as BrokerError
      expect(err.code).toBe('worker.error')
      expect(err.category).toBe('worker')
      expect(err.details?.['filename']).toBe('worker.js')
      expect(err.details?.['lineno']).toBe(42)
    } finally {
      stub.restore()
    }
  })

  // --------------------------------------------------------------------------
  // Test 14 — Worker 'messageerror' event → store last error
  // --------------------------------------------------------------------------
  it("Test 14: worker 'messageerror' event memorizzato come last error code=worker.messageerror", async () => {
    const stub = stubComlinkWrap(async () => 'ok')
    try {
      const bridge = makeBridge(makeDescriptor(), { assertSerializableMode: 'off' })
      await bridge.dispatch('parseCsv', { x: 1 }, new AbortController().signal)
      const worker = MockWorker.instances[0]
      worker?.__messageError({ corrupted: true })
      const lastErr = bridge.getLastErrorForTesting()
      expect(lastErr).not.toBeNull()
      expect(isBrokerError(lastErr)).toBe(true)
      const err = lastErr as BrokerError
      expect(err.code).toBe('worker.messageerror')
      expect(err.category).toBe('worker')
    } finally {
      stub.restore()
    }
  })

  // --------------------------------------------------------------------------
  // Test 15 — getDebugSnapshot
  // --------------------------------------------------------------------------
  it('Test 15: getDebugSnapshot ritorna { workerId, spawned, messagesCount, terminated }', async () => {
    const stub = stubComlinkWrap(async () => 'ok')
    try {
      const bridge = makeBridge(makeDescriptor(), { assertSerializableMode: 'off' })

      // Pre-spawn snapshot
      const s1 = bridge.getDebugSnapshot()
      expect(s1.workerId).toBe('test-worker')
      expect(s1.spawned).toBe(false)
      expect(s1.messagesCount).toBe(0)
      expect(s1.terminated).toBe(false)

      // Post-first dispatch
      await bridge.dispatch('parseCsv', { x: 1 }, new AbortController().signal)
      const s2 = bridge.getDebugSnapshot()
      expect(s2.spawned).toBe(true)
      expect(s2.messagesCount).toBe(1)
      expect(s2.terminated).toBe(false)

      // Post-terminate
      bridge.terminate()
      const s3 = bridge.getDebugSnapshot()
      expect(s3.spawned).toBe(false)
      expect(s3.terminated).toBe(true)
    } finally {
      stub.restore()
    }
  })
})
