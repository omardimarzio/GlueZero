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

import { type BrokerError, isBrokerError } from '@sembridge/core'
import * as Comlink from 'comlink'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MockWorker } from './test-utils/mock-worker'
import type { WorkerDescriptor } from './types/worker-descriptor'
import { type ComlinkAdapter, WorkerBridge } from './worker-bridge'

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

/**
 * Stub `ComlinkAdapter` per DI test: intercetta `wrap` con un Proxy che ritorna
 * task function callable. `proxy` ritorna value as-is + spy callable. `transfer`
 * ritorna value as-is. `releaseProxy` symbol di Comlink reale.
 *
 * Tracking: `callArgs` raccoglie ogni invocazione di task (nome + args).
 * `proxyCalls` raccoglie ogni `proxy(value)` invocato (per Test 7/8).
 */
interface ComlinkStubs {
  readonly adapter: ComlinkAdapter
  readonly callArgs: Array<{ taskName: string; args: unknown[] }>
  readonly proxyCalls: unknown[]
  readonly transferCalls: Array<{ value: unknown; transfers: readonly Transferable[] }>
}

function stubComlinkAdapter(
  replyFn: (taskName: string, ...args: unknown[]) => Promise<unknown>,
): ComlinkStubs {
  const callArgs: Array<{ taskName: string; args: unknown[] }> = []
  const proxyCalls: unknown[] = []
  const transferCalls: Array<{ value: unknown; transfers: readonly Transferable[] }> = []

  const adapter: ComlinkAdapter = {
    wrap: (<T>(_ep: object): Comlink.Remote<T> => {
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
      ) as unknown as Comlink.Remote<T>
    }) as ComlinkAdapter['wrap'],
    proxy: (<T extends object>(value: T): T => {
      proxyCalls.push(value)
      return value
    }) as ComlinkAdapter['proxy'],
    transfer: (<T>(value: T, transfers: readonly Transferable[]): T => {
      transferCalls.push({ value, transfers })
      return value
    }) as ComlinkAdapter['transfer'],
    releaseProxy: Comlink.releaseProxy,
  }

  return { adapter, callArgs, proxyCalls, transferCalls }
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
    const stubs = stubComlinkAdapter(async (_task: string, _payload: unknown) => 'ok-result')
    const bridge = makeBridge(makeDescriptor(), { comlinkAdapter: stubs.adapter })
    await bridge.dispatch('parseCsv', { rows: 10 }, new AbortController().signal)
    expect(MockWorker.instances).toHaveLength(1)
    const firstWorker = MockWorker.instances[0]

    await bridge.dispatch('parseCsv', { rows: 20 }, new AbortController().signal)
    expect(MockWorker.instances).toHaveLength(1) // riuso, no second spawn
    expect(MockWorker.instances[0]).toBe(firstWorker)
    expect(stubs.callArgs.length).toBe(2)
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
    const stubs = stubComlinkAdapter(async () => 'ok')
    const bridge = makeBridge(makeDescriptor(), {
      assertSerializableMode: 'off',
      comlinkAdapter: stubs.adapter,
    })
    const ctrl = new AbortController()
    // Payload con function — normalmente fallirebbe in 'always'/'dev'
    await bridge.dispatch('parseCsv', { fn: () => 'x' }, ctrl.signal)
    // No throw — il bridge ha proseguito al dispatch
    expect(MockWorker.instances).toHaveLength(1)
    expect(stubs.callArgs.length).toBe(1)
  })

  // --------------------------------------------------------------------------
  // Test 6 — D-141 extractTransferables + Comlink.transfer
  // --------------------------------------------------------------------------
  it('Test 6 (D-141): extractTransferables invocato + Comlink.transfer applicato quando paths.length > 0', async () => {
    const stubs = stubComlinkAdapter(async () => 'ok')
    const bridge = makeBridge(makeDescriptor(), {
      assertSerializableMode: 'off',
      comlinkAdapter: stubs.adapter,
    })
    const ctrl = new AbortController()
    const buf = new ArrayBuffer(16)
    await bridge.dispatch('echoBuffer', { audioBuffer: buf, meta: 'x' }, ctrl.signal, undefined, {
      transferable: ['audioBuffer'],
    })
    // Comlink.transfer adapter è stato chiamato 1 volta con buf nella transferList.
    expect(stubs.transferCalls.length).toBe(1)
    expect(stubs.transferCalls[0]?.transfers).toContain(buf)
    // Il payload arrivato al wrap call è la stessa identity (object preservato).
    expect(stubs.callArgs.length).toBe(1)
    expect(stubs.callArgs[0]?.taskName).toBe('echoBuffer')
    const firstArg = stubs.callArgs[0]?.args[0] as { audioBuffer: ArrayBuffer; meta: string }
    expect(firstArg.audioBuffer).toBe(buf)
    expect(firstArg.meta).toBe('x')
  })

  // --------------------------------------------------------------------------
  // Test 7 — D-132 AbortSignal proxied via Comlink.proxy
  // --------------------------------------------------------------------------
  it('Test 7 (D-132): AbortSignal proxied via Comlink.proxy passato come 2° arg al task', async () => {
    const stubs = stubComlinkAdapter(async () => 'ok')
    const bridge = makeBridge(makeDescriptor(), {
      assertSerializableMode: 'off',
      comlinkAdapter: stubs.adapter,
    })
    const ctrl = new AbortController()
    await bridge.dispatch('parseCsv', { x: 1 }, ctrl.signal)
    // Almeno 1 chiamata adapter.proxy(signal) deve essere avvenuta
    const calledWithSignal = stubs.proxyCalls.some((v) => v === ctrl.signal)
    expect(calledWithSignal).toBe(true)
    // Il signalProxy è passato come 2° arg al task
    expect(stubs.callArgs.length).toBe(1)
    expect(stubs.callArgs[0]?.args.length).toBeGreaterThanOrEqual(2)
    // Nel test setup adapter.proxy ritorna il value as-is, quindi args[1] === ctrl.signal
    expect(stubs.callArgs[0]?.args[1]).toBe(ctrl.signal)
  })

  // --------------------------------------------------------------------------
  // Test 8 — D-135 onProgress proxied (quando fornita)
  // --------------------------------------------------------------------------
  it('Test 8 (D-135): onProgress proxied via Comlink.proxy quando fornita; undefined quando assente', async () => {
    const stubs = stubComlinkAdapter(async () => 'ok')
    const bridge = makeBridge(makeDescriptor(), {
      assertSerializableMode: 'off',
      comlinkAdapter: stubs.adapter,
    })
    const ctrl = new AbortController()

    // Caso 1: onProgress fornita → adapter.proxy chiamato con la callback throttled
    const onProgress = vi.fn()
    await bridge.dispatch('parseCsv', { x: 1 }, ctrl.signal, onProgress)
    // proxy chiamato 2x: signal + onProgress (throttled)
    expect(stubs.proxyCalls.length).toBeGreaterThanOrEqual(2)
    // 3° arg al task non undefined
    expect(stubs.callArgs[0]?.args[2]).not.toBeUndefined()
    expect(typeof stubs.callArgs[0]?.args[2]).toBe('function')

    // Caso 2: onProgress undefined → 3° arg è undefined
    stubs.proxyCalls.length = 0
    stubs.callArgs.length = 0
    await bridge.dispatch('parseCsv', { x: 2 }, ctrl.signal)
    expect(stubs.callArgs[0]?.args[2]).toBeUndefined()
    // Solo signal proxied (1 call)
    expect(stubs.proxyCalls.length).toBe(1)
  })

  // --------------------------------------------------------------------------
  // Test 9 — D-137 progress throttling latest-only window
  // --------------------------------------------------------------------------
  it('Test 9 (D-137): progress throttling latest-only window — N onProgress calls in <window collassano in <=2 emit', async () => {
    vi.useFakeTimers()
    try {
      const stubs = stubComlinkAdapter(
        async (_task: string, _payload: unknown, _signal: unknown, onProgressProxy: unknown) => {
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
      const bridge = makeBridge(makeDescriptor(), {
        assertSerializableMode: 'off',
        comlinkAdapter: stubs.adapter,
      })
      const onProgress = vi.fn()
      await bridge.dispatch('parseCsv', { x: 1 }, new AbortController().signal, onProgress, {
        progressThrottleMs: 100,
      })
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
      vi.useRealTimers()
    }
  })

  // --------------------------------------------------------------------------
  // Test 10 — D-131 terminate Comlink.releaseProxy + worker.terminate + re-spawn
  // --------------------------------------------------------------------------
  it('Test 10 (D-131): terminate releases proxy + terminates worker + lazy re-spawn al next dispatch', async () => {
    const stubs = stubComlinkAdapter(async () => 'ok')
    const bridge = makeBridge(makeDescriptor(), {
      assertSerializableMode: 'off',
      comlinkAdapter: stubs.adapter,
    })
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
  })

  // --------------------------------------------------------------------------
  // Test 11 — terminate idempotente
  // --------------------------------------------------------------------------
  it('Test 11: terminate idempotente — chiamato 2x non throw, 2° è no-op', async () => {
    const stubs = stubComlinkAdapter(async () => 'ok')
    const bridge = makeBridge(makeDescriptor(), {
      assertSerializableMode: 'off',
      comlinkAdapter: stubs.adapter,
    })
    await bridge.dispatch('parseCsv', { x: 1 }, new AbortController().signal)
    const w = MockWorker.instances[0]
    expect(() => bridge.terminate()).not.toThrow()
    expect(() => bridge.terminate()).not.toThrow()
    expect(w?.terminated).toBe(true)
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
    const stubs = stubComlinkAdapter(async () => 'ok')
    const bridge = makeBridge(makeDescriptor(), {
      assertSerializableMode: 'off',
      comlinkAdapter: stubs.adapter,
    })
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
  })

  // --------------------------------------------------------------------------
  // Test 14 — Worker 'messageerror' event → store last error
  // --------------------------------------------------------------------------
  it("Test 14: worker 'messageerror' event memorizzato come last error code=worker.messageerror", async () => {
    const stubs = stubComlinkAdapter(async () => 'ok')
    const bridge = makeBridge(makeDescriptor(), {
      assertSerializableMode: 'off',
      comlinkAdapter: stubs.adapter,
    })
    await bridge.dispatch('parseCsv', { x: 1 }, new AbortController().signal)
    const worker = MockWorker.instances[0]
    worker?.__messageError({ corrupted: true })
    const lastErr = bridge.getLastErrorForTesting()
    expect(lastErr).not.toBeNull()
    expect(isBrokerError(lastErr)).toBe(true)
    const err = lastErr as BrokerError
    expect(err.code).toBe('worker.messageerror')
    expect(err.category).toBe('worker')
  })

  // --------------------------------------------------------------------------
  // Test 15 — getDebugSnapshot
  // --------------------------------------------------------------------------
  it('Test 15: getDebugSnapshot ritorna { workerId, spawned, messagesCount, terminated }', async () => {
    const stubs = stubComlinkAdapter(async () => 'ok')
    const bridge = makeBridge(makeDescriptor(), {
      assertSerializableMode: 'off',
      comlinkAdapter: stubs.adapter,
    })

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
  })
})
