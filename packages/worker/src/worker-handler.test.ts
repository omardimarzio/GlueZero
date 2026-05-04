// worker-handler.test.ts — 8 unit test Tier-1 jsdom per `createWorkerHandler`
// (D-152 step 9 dispatch + D-146 topic auto-derive + D-133 atomic state machine
// + D-134 correlationId + ERR-02 ext F5 sanitized + Pitfall 2C closure).

import { describe, it, expect, beforeEach } from 'vitest'
import { createWorkerHandler, deriveTopic, type WorkerPublishFn } from './worker-handler'
import { WorkerRegistry } from './worker-registry'
import { WorkerPool, type WorkerBridgeLike } from './worker-pool'
import { createTaskTracker } from './task-tracker'
import type { BrokerEvent } from '@sembridge/core'
import type { ProgressPayload, RouteWorkerDefinition, WorkerDescriptor } from './types'

// ============================================================================
// Test utilities
// ============================================================================

interface CapturedPublish {
  readonly topic: string
  readonly payload: unknown
  readonly options: Parameters<WorkerPublishFn>[2]
}

function makePublishFn(): {
  readonly publishFn: WorkerPublishFn
  readonly captured: CapturedPublish[]
} {
  const captured: CapturedPublish[] = []
  const publishFn: WorkerPublishFn = (topic, payload, options) => {
    captured.push({ topic, payload, options })
  }
  return { publishFn, captured }
}

function makeBrokerEvent(overrides: Partial<BrokerEvent> = {}): BrokerEvent {
  return {
    id: overrides.id ?? 'evt-1',
    topic: overrides.topic ?? 'weather.requested',
    payload: overrides.payload ?? { city: 'Roma' },
    timestamp: overrides.timestamp ?? Date.now(),
    source: overrides.source ?? { type: 'plugin', id: 'test-plugin' },
    ...(overrides.correlationId !== undefined && { correlationId: overrides.correlationId }),
    ...(overrides.priority !== undefined && { priority: overrides.priority }),
  } as BrokerEvent
}

function makeRoute(overrides: Partial<RouteWorkerDefinition> = {}): RouteWorkerDefinition {
  return {
    type: 'worker',
    id: overrides.id ?? 'r1',
    topic: overrides.topic ?? 'weather.requested',
    worker: overrides.worker ?? 'w1',
    task: overrides.task ?? 'fetch',
    ...(overrides.publishes !== undefined && { publishes: overrides.publishes }),
    ...(overrides.transferable !== undefined && { transferable: overrides.transferable }),
    ...(overrides.policies !== undefined && { policies: overrides.policies }),
  }
}

/** MockBridge che ritorna un risultato fisso al dispatch + supporta progress. */
class MockBridge implements WorkerBridgeLike {
  terminated = false
  dispatchCalls = 0
  lastSignal?: AbortSignal
  lastTransferable?: readonly string[]

  constructor(
    private readonly behavior: {
      readonly result?: unknown
      readonly delayMs?: number
      readonly throwError?: Error
      readonly emitProgress?: ProgressPayload
    } = {},
  ) {}

  async dispatch(
    _taskName: string,
    _payload: unknown,
    signal: AbortSignal,
    onProgress?: (p: ProgressPayload) => void,
    options?: { readonly transferable?: readonly string[] },
  ): Promise<unknown> {
    this.dispatchCalls++
    this.lastSignal = signal
    this.lastTransferable = options?.transferable
    if (this.behavior.emitProgress !== undefined && onProgress !== undefined) {
      onProgress(this.behavior.emitProgress)
    }
    if (this.behavior.delayMs !== undefined) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          if (this.behavior.throwError !== undefined) {
            reject(this.behavior.throwError)
          } else {
            resolve()
          }
        }, this.behavior.delayMs)
        signal.addEventListener('abort', () => {
          clearTimeout(timer)
          reject(
            new DOMException(`Aborted: ${String(signal.reason ?? 'aborted')}`, 'AbortError'),
          )
        })
      })
    }
    if (this.behavior.throwError !== undefined && this.behavior.delayMs === undefined) {
      throw this.behavior.throwError
    }
    return this.behavior.result ?? { ok: true }
  }

  terminate(): void {
    this.terminated = true
  }
}

function setupRegistryWithWorker(
  registry: WorkerRegistry,
  workerId = 'w1',
  tasks: readonly string[] = ['fetch'],
): WorkerDescriptor {
  const desc: WorkerDescriptor = {
    id: workerId,
    factory: () => null as unknown as Worker, // unused — bridgeFactory bypassa
    tasks,
    mode: 'dedicated',
  }
  registry.register(desc, 'system')
  return desc
}

// ============================================================================
// Tests
// ============================================================================

describe('worker-handler — createWorkerHandler (D-152, D-146, D-133, D-134)', () => {
  let registry: WorkerRegistry
  let tracker: ReturnType<typeof createTaskTracker>
  let bridge: MockBridge
  let pool: WorkerPool
  let publish: ReturnType<typeof makePublishFn>

  beforeEach(() => {
    registry = new WorkerRegistry()
    tracker = createTaskTracker()
    bridge = new MockBridge({ result: { city: 'Roma', temp: 20 } })
    pool = new WorkerPool({ registry, bridgeFactory: () => bridge })
    publish = makePublishFn()
  })

  it('Test 1 (D-146 + D-134): dispatch happy path — publica `<topic>.completed` + correlationId propagato', async () => {
    setupRegistryWithWorker(registry)
    const handler = createWorkerHandler({
      registry,
      pool,
      tracker,
      publishFn: publish.publishFn,
    })
    const event = makeBrokerEvent({
      id: 'evt-42',
      topic: 'weather.requested',
      payload: { city: 'Roma' },
      correlationId: 'corr-xyz',
    })
    const route = makeRoute()
    const ctrl = new AbortController()

    await handler.execute(event, route, ctrl.signal)

    expect(bridge.dispatchCalls).toBe(1)
    expect(publish.captured.length).toBe(1)
    const evt = publish.captured[0]!
    expect(evt.topic).toBe('weather.completed')
    expect(evt.payload).toEqual({ city: 'Roma', temp: 20 })
    expect(evt.options?.correlationId).toBe('corr-xyz')
    expect(evt.options?.source).toEqual({ type: 'worker', id: 'w1', name: 'fetch' })
  })

  it('Test 2 (worker.unknown): worker non registrato → publica `<topic>.failed` + `worker.error`', async () => {
    // NB: registry vuoto — worker w1 NON registrato
    const handler = createWorkerHandler({
      registry,
      pool,
      tracker,
      publishFn: publish.publishFn,
    })
    const event = makeBrokerEvent({ topic: 'weather.requested' })
    const route = makeRoute()
    const ctrl = new AbortController()

    await handler.execute(event, route, ctrl.signal)

    expect(bridge.dispatchCalls).toBe(0)
    expect(publish.captured.length).toBe(2)
    expect(publish.captured[0]!.topic).toBe('weather.failed')
    expect(publish.captured[1]!.topic).toBe('worker.error')
    const sanitized = publish.captured[0]!.payload as { code: string; category: string }
    expect(sanitized.code).toBe('worker.unknown')
    expect(sanitized.category).toBe('config')
    // Sanitization audit — niente originalError/stack
    expect(sanitized).not.toHaveProperty('originalError')
    expect(sanitized).not.toHaveProperty('stack')
  })

  it('Test 3 (worker.task.unknown): task non dichiarato → publica `<topic>.failed` con code task.unknown', async () => {
    setupRegistryWithWorker(registry, 'w1', ['fetch']) // task NON include 'unknown'
    const handler = createWorkerHandler({
      registry,
      pool,
      tracker,
      publishFn: publish.publishFn,
    })
    const event = makeBrokerEvent()
    const route = makeRoute({ task: 'unknownTask' })
    const ctrl = new AbortController()

    await handler.execute(event, route, ctrl.signal)

    expect(publish.captured.length).toBe(2)
    expect(publish.captured[0]!.topic).toBe('weather.failed')
    expect(publish.captured[1]!.topic).toBe('worker.error')
    const sanitized = publish.captured[0]!.payload as { code: string }
    expect(sanitized.code).toBe('worker.task.unknown')
  })

  it('Test 4 (D-145 timeout): policies.timeout=50ms su worker lento → markTimeout + publica `worker.timeout`', async () => {
    setupRegistryWithWorker(registry)
    bridge = new MockBridge({ result: { ok: true }, delayMs: 200 })
    pool = new WorkerPool({ registry, bridgeFactory: () => bridge })
    const handler = createWorkerHandler({
      registry,
      pool,
      tracker,
      publishFn: publish.publishFn,
    })
    const event = makeBrokerEvent()
    const route = makeRoute({ policies: { timeout: 50 } })
    const ctrl = new AbortController()

    await handler.execute(event, route, ctrl.signal)

    expect(publish.captured.length).toBe(2) // failed + worker.error
    expect(publish.captured[0]!.topic).toBe('weather.failed')
    expect((publish.captured[0]!.payload as { code: string }).code).toBe('worker.timeout')
    expect(tracker.getDebugSnapshot().tasksCompleted).toBe(1) // markTimeout ha transitionato
  })

  it('Test 5 (cancellation): external signal abort → markCancelled + publica `worker.cancelled`', async () => {
    setupRegistryWithWorker(registry)
    bridge = new MockBridge({ result: { ok: true }, delayMs: 500 })
    pool = new WorkerPool({ registry, bridgeFactory: () => bridge })
    const handler = createWorkerHandler({
      registry,
      pool,
      tracker,
      publishFn: publish.publishFn,
    })
    const event = makeBrokerEvent()
    const route = makeRoute({ policies: { timeout: 5_000 } })
    const ctrl = new AbortController()

    // Trigger cancellation dopo 20ms
    setTimeout(() => ctrl.abort('external'), 20)
    await handler.execute(event, route, ctrl.signal)

    expect(publish.captured.length).toBe(2)
    expect(publish.captured[0]!.topic).toBe('weather.failed')
    expect((publish.captured[0]!.payload as { code: string }).code).toBe('worker.cancelled')
  })

  it('Test 6 (Pitfall 2C closure): late response post-timeout SCARTATA — `<topic>.completed` NON pubblicato', async () => {
    setupRegistryWithWorker(registry)
    // Bridge che onora il signal (cooperative): se il signal abort scatta (timeout
    // del handler invoca internalCtrl.abort('timeout')), il dispatch rejecta. Il
    // path catch nel handler entra nel branch reason==='timeout' e pubblica failed
    // (markTimeout ha già transizionato lo state).
    const lateBridge: WorkerBridgeLike = {
      dispatch: (_t, _p, signal) =>
        new Promise<unknown>((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            reject(
              new DOMException(`Aborted: ${String(signal.reason ?? 'aborted')}`, 'AbortError'),
            )
          })
        }),
      terminate: () => {},
    }
    pool = new WorkerPool({ registry, bridgeFactory: () => lateBridge })
    const handler = createWorkerHandler({
      registry,
      pool,
      tracker,
      publishFn: publish.publishFn,
    })
    const event = makeBrokerEvent()
    const route = makeRoute({ policies: { timeout: 30 } })
    const ctrl = new AbortController()

    await handler.execute(event, route, ctrl.signal)

    // markTimeout ha pubblicato `<topic>.failed` + `worker.error` (2 events).
    // NESSUN `<topic>.completed` deve esistere (atomic state ha scartato qualunque
    // late markDone).
    const completedEvents = publish.captured.filter((e) => e.topic === 'weather.completed')
    expect(completedEvents.length).toBe(0)
    const failedEvents = publish.captured.filter((e) => e.topic === 'weather.failed')
    expect(failedEvents.length).toBe(1)
    expect((failedEvents[0]!.payload as { code: string }).code).toBe('worker.timeout')
    // Tracker snapshot: 1 task transitionato (markTimeout). Verifica state machine
    // atomico: tasksCompleted===1, lateResponses===0 (il dispatch rejecta PRIMA
    // di tentare markError perché reason==='timeout' branch non chiama markError).
    expect(tracker.getDebugSnapshot().tasksCompleted).toBe(1)
  })

  it('Test 7 (D-138 progress): onProgress callback → publica `<topic>.progress` con source worker', async () => {
    setupRegistryWithWorker(registry)
    bridge = new MockBridge({
      result: { ok: true },
      emitProgress: { value: 0.5, message: 'halfway' },
    })
    pool = new WorkerPool({ registry, bridgeFactory: () => bridge })
    const handler = createWorkerHandler({
      registry,
      pool,
      tracker,
      publishFn: publish.publishFn,
    })
    const event = makeBrokerEvent()
    const route = makeRoute()
    const ctrl = new AbortController()

    await handler.execute(event, route, ctrl.signal)

    const progressEvents = publish.captured.filter((e) => e.topic === 'weather.progress')
    expect(progressEvents.length).toBe(1)
    expect(progressEvents[0]!.payload).toEqual({ value: 0.5, message: 'halfway' })
    expect(progressEvents[0]!.options?.source).toEqual({
      type: 'worker',
      id: 'w1',
      name: 'fetch',
    })
  })

  it('Test 8 (D-146 deriveTopic): suffix replace + fallback append', () => {
    expect(deriveTopic('weather.requested', 'completed')).toBe('weather.completed')
    expect(deriveTopic('weather.requested', 'progress')).toBe('weather.progress')
    expect(deriveTopic('weather.requested', 'failed')).toBe('weather.failed')
    // Prefix multi-segmento
    expect(deriveTopic('report.generation.requested', 'completed')).toBe(
      'report.generation.completed',
    )
    // Fallback append (no `.requested` suffix)
    expect(deriveTopic('nonstandard', 'completed')).toBe('nonstandard.completed')
    expect(deriveTopic('nonstandard.foo', 'failed')).toBe('nonstandard.foo.failed')
  })
})
