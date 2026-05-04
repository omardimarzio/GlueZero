// worker-pool.test.ts — Tier-1 jsdom unit test per WorkerPool
// (Wave 3-B plan 05-05 — RED phase).
//
// Decisioni testate:
// - D-127 default pool size = min(navigator.hardwareConcurrency, 4)
// - D-128 cap hard 8 + allowUnboundedPool warn
// - D-129 lazy first dispatch — spawn on demand
// - D-130 F3 BackpressureStrategy riusato 1:1 (import @sembridge/gateway/http)
//   + critical bypass (Pitfall 4.C)
// - D-131 cancellation hybrid: dedicated terminate vs pool cooperative
// - LIFE-02 ext F5: terminateByOwner cascade
//
// File ownership disgiunta: NON usa `MockWorker` di test-utils (owned da 05-04
// in parallel). Usa `MockBridge` locale che implementa `WorkerBridgeLike`
// minimal interface — DI pattern evita dipendenza forte da 05-04.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  WorkerPool,
  defaultPoolSize,
  type WorkerBridgeLike,
} from './worker-pool'
import { WorkerRegistry } from './worker-registry'
import type { WorkerDescriptor, ProgressPayload } from './types'

/** Mock minimal del bridge — implementa l'interfaccia consumed dal pool. */
class MockBridge implements WorkerBridgeLike {
  static instances: MockBridge[] = []
  static reset(): void {
    MockBridge.instances = []
  }

  public terminated = false
  public dispatchCalls = 0
  public lastTaskName?: string

  constructor(public readonly desc: WorkerDescriptor) {
    MockBridge.instances.push(this)
  }

  async dispatch(
    taskName: string,
    _payload: unknown,
    _signal: AbortSignal,
    _onProgress?: (p: ProgressPayload) => void,
  ): Promise<unknown> {
    this.dispatchCalls += 1
    this.lastTaskName = taskName
    return { ok: true, taskName }
  }

  terminate(): void {
    this.terminated = true
  }

  getDebugSnapshot(): { readonly terminated: boolean; readonly dispatchCalls: number } {
    return { terminated: this.terminated, dispatchCalls: this.dispatchCalls }
  }
}

function makeDesc(
  id: string = 'w1',
  overrides: Partial<WorkerDescriptor> = {},
): WorkerDescriptor {
  return {
    id,
    factory: () => ({}) as unknown as Worker,
    tasks: ['task-a', 'task-b'] as const,
    mode: 'dedicated',
    ...overrides,
  }
}

describe('WorkerPool — bounded + lazy + queue + respawn (D-127/128/129/130/131)', () => {
  let registry: WorkerRegistry
  let pool: WorkerPool

  beforeEach(() => {
    MockBridge.reset()
    registry = new WorkerRegistry()
    pool = new WorkerPool({
      registry,
      bridgeFactory: (desc) => new MockBridge(desc),
    })
  })

  it('Test 1: defaultPoolSize() = min(navigator.hardwareConcurrency, 4) (D-127)', () => {
    const original = (globalThis as { navigator?: Navigator }).navigator
    // Mock navigator.hardwareConcurrency = 16 → expected min(16,4) = 4
    Object.defineProperty(globalThis, 'navigator', {
      value: { hardwareConcurrency: 16 },
      configurable: true,
      writable: true,
    })
    try {
      expect(defaultPoolSize()).toBe(4)
    } finally {
      Object.defineProperty(globalThis, 'navigator', {
        value: original,
        configurable: true,
        writable: true,
      })
    }

    // Mock navigator.hardwareConcurrency = 2 → expected min(2,4) = 2
    Object.defineProperty(globalThis, 'navigator', {
      value: { hardwareConcurrency: 2 },
      configurable: true,
      writable: true,
    })
    try {
      expect(defaultPoolSize()).toBe(2)
    } finally {
      Object.defineProperty(globalThis, 'navigator', {
        value: original,
        configurable: true,
        writable: true,
      })
    }
  })

  it('Test 2: lazy spawn — primo acquireSlot invoca bridgeFactory 1 volta; subsequent riusa stesso slot se libero (D-129)', async () => {
    registry.register(makeDesc('w1', { mode: 'dedicated' }), 'plugin-a')
    expect(MockBridge.instances).toHaveLength(0) // lazy: niente spawn al register

    // Primo dispatch → 1 spawn
    await pool.dispatchOnSlot('w1', 'task-a', {}, new AbortController().signal)
    expect(MockBridge.instances).toHaveLength(1)

    // Secondo dispatch sequenziale → riusa stesso slot (no nuovo spawn)
    await pool.dispatchOnSlot('w1', 'task-a', {}, new AbortController().signal)
    expect(MockBridge.instances).toHaveLength(1) // ancora 1
    expect(MockBridge.instances[0]?.dispatchCalls).toBe(2)
  })

  it('Test 3: 4 acquireSlot concorrenti su pool size=2 → 2 spawn + 2 attendono in queue (FIFO)', async () => {
    registry.register(
      makeDesc('w1', { mode: 'pool', size: 2 }),
      'plugin-a',
    )

    // Trattieni i task con barriera manuale
    let resolveBarrier: (() => void) | undefined
    const barrier = new Promise<void>((res) => {
      resolveBarrier = res
    })
    let taskRunCount = 0

    const slowTask = async (): Promise<{ readonly ok: boolean }> => {
      taskRunCount += 1
      await barrier
      return { ok: true }
    }

    // 4 dispatch concorrenti — 2 partono subito (spawn), 2 in waitForFreeSlot
    const p1 = pool.dispatchOnSlotWithTask('w1', slowTask)
    const p2 = pool.dispatchOnSlotWithTask('w1', slowTask)
    const p3 = pool.dispatchOnSlotWithTask('w1', slowTask)
    const p4 = pool.dispatchOnSlotWithTask('w1', slowTask)

    // Yield per microtask — i primi 2 hanno acquisito slot, terzo+quarto in attesa
    await new Promise<void>((r) => setTimeout(r, 10))
    expect(MockBridge.instances.length).toBe(2) // pool size cap rispettato (D-129)
    expect(taskRunCount).toBe(2) // solo 2 task attivi (gli altri 2 in waitForFreeSlot)

    // Risolvi barriera → tutti completano
    resolveBarrier?.()
    await Promise.all([p1, p2, p3, p4])
    // Verifica che siano stati 4 task totali eseguiti (2 slot riusati per 4 task)
    expect(taskRunCount).toBe(4)
    // Pool ancora bounded: 2 bridge totali (no over-spawn)
    expect(MockBridge.instances.length).toBe(2)
  })

  it('Test 4: releaseSlot libera lo slot; acquireSlot successivo riusa', async () => {
    registry.register(makeDesc('w1', { mode: 'dedicated' }), 'plugin-a')
    const slot = await pool.acquireSlot('w1')
    expect(slot.busy).toBe(true)
    pool.releaseSlot('w1', slot)
    expect(slot.busy).toBe(false)
    // acquire successivo riusa lo stesso slot
    const slot2 = await pool.acquireSlot('w1')
    expect(slot2).toBe(slot) // stessa reference
    expect(slot2.busy).toBe(true)
  })

  it('Test 5: respawn termina old bridge + crea nuovo bridge per slot (D-131 fault recovery)', async () => {
    registry.register(makeDesc('w1', { mode: 'dedicated' }), 'plugin-a')
    const slot = await pool.acquireSlot('w1')
    pool.releaseSlot('w1', slot)
    const oldBridge = MockBridge.instances[0]
    expect(oldBridge?.terminated).toBe(false)

    pool.respawn('w1', 0)

    // Old terminated, nuovo bridge instance creato
    expect(oldBridge?.terminated).toBe(true)
    expect(MockBridge.instances).toHaveLength(2)
    const newSlot = pool.getDebugSnapshot().byWorkerId['w1']
    expect(newSlot?.spawned).toBe(1)
    expect(newSlot?.busy).toBe(0)
  })

  it('Test 6: terminateByOwner cascade chiude SOLO worker del plugin (LIFE-02 ext F5)', async () => {
    registry.register(makeDesc('w-a', { mode: 'dedicated' }), 'plugin-a')
    registry.register(makeDesc('w-b', { mode: 'dedicated' }), 'plugin-b')
    pool.spawnEager('w-a')
    pool.spawnEager('w-b')

    expect(MockBridge.instances).toHaveLength(2)
    expect(MockBridge.instances[0]?.terminated).toBe(false)
    expect(MockBridge.instances[1]?.terminated).toBe(false)

    pool.terminateByOwner('plugin-a')

    // Solo w-a (instances[0]) terminata; w-b (instances[1]) viva
    expect(MockBridge.instances[0]?.terminated).toBe(true)
    expect(MockBridge.instances[1]?.terminated).toBe(false)

    // Pool snapshot riflette w-b solo
    const snap = pool.getDebugSnapshot()
    expect(snap.byWorkerId['w-a']).toBeUndefined()
    expect(snap.byWorkerId['w-b']?.spawned).toBe(1)
  })

  it('Test 7: terminateByOwner idempotente — chiamato 2x non throw', () => {
    registry.register(makeDesc('w-a', { mode: 'dedicated' }), 'plugin-a')
    pool.spawnEager('w-a')

    expect(() => pool.terminateByOwner('plugin-a')).not.toThrow()
    expect(() => pool.terminateByOwner('plugin-a')).not.toThrow()
    expect(() => pool.terminateByOwner('plugin-ghost')).not.toThrow()
  })

  it('Test 8: critical priority bypass backpressure (D-130 Pitfall 4.C)', async () => {
    // Pool con backpressure custom che TRACCIA le invocazioni schedule
    let scheduleCalls = 0
    const trackingBackpressure = {
      schedule: vi.fn(
        async <T>(
          _routeId: string,
          _priority: 'critical' | 'high' | 'normal' | 'low',
          task: () => Promise<T>,
        ): Promise<T> => {
          scheduleCalls += 1
          return await task()
        },
      ),
      queueLength: () => 0,
    }

    const poolWithBp = new WorkerPool({
      registry,
      bridgeFactory: (desc) => new MockBridge(desc),
      backpressure: trackingBackpressure,
    })

    // priority='critical' → BYPASS backpressure (schedule NON invocato)
    const result = await poolWithBp.schedule('route-1', 'critical', async () => 'fast-result')
    expect(result).toBe('fast-result')
    expect(scheduleCalls).toBe(0) // bypass!

    // priority='normal' → DELEGA a backpressure
    await poolWithBp.schedule('route-1', 'normal', async () => 'normal-result')
    expect(scheduleCalls).toBe(1)
  })

  it('Test 9: dedicated mode — acquireSlot ritorna sempre lo stesso slot (size=1 implicito)', async () => {
    registry.register(makeDesc('w1', { mode: 'dedicated' }), 'plugin-a')
    const slot1 = await pool.acquireSlot('w1')
    pool.releaseSlot('w1', slot1)
    const slot2 = await pool.acquireSlot('w1')
    pool.releaseSlot('w1', slot2)
    const slot3 = await pool.acquireSlot('w1')

    expect(slot1).toBe(slot2)
    expect(slot2).toBe(slot3)
    // Solo 1 spawn (dedicated cap implicit 1)
    expect(MockBridge.instances).toHaveLength(1)
  })

  it('Test 10: schedule(routeId, priority, task) delega a F3 BackpressureStrategy (D-130 import)', async () => {
    let bpInvoked = false
    const probe = {
      schedule: async <T>(
        _routeId: string,
        _priority: 'critical' | 'high' | 'normal' | 'low',
        task: () => Promise<T>,
      ): Promise<T> => {
        bpInvoked = true
        return await task()
      },
      queueLength: () => 0,
    }
    const poolDelegate = new WorkerPool({
      registry,
      bridgeFactory: (desc) => new MockBridge(desc),
      backpressure: probe,
    })

    const result = await poolDelegate.schedule('route-x', 'normal', async () => 42)
    expect(result).toBe(42)
    expect(bpInvoked).toBe(true)
  })

  it('Test 11: getDebugSnapshot ritorna { activeBridges, byWorkerId: { spawned, busy } }', async () => {
    registry.register(makeDesc('w1', { mode: 'pool', size: 2 }), 'plugin-a')
    registry.register(makeDesc('w2', { mode: 'dedicated' }), 'plugin-b')

    pool.spawnEager('w1')
    pool.spawnEager('w1')
    pool.spawnEager('w2')

    const snap = pool.getDebugSnapshot()
    expect(snap.activeBridges).toBe(3)
    expect(snap.byWorkerId['w1']?.spawned).toBe(2)
    expect(snap.byWorkerId['w1']?.busy).toBe(0)
    expect(snap.byWorkerId['w2']?.spawned).toBe(1)
    expect(snap.byWorkerId['w2']?.busy).toBe(0)
  })

  it('Test 12: allowUnboundedPool=true + size=16 spawnabile + console.warn 1 volta (Pitfall 7.D)', async () => {
    registry.register(
      makeDesc('w-big', {
        mode: 'pool',
        size: 16,
        allowUnboundedPool: true,
      }),
      'plugin-a',
    )

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      // Forza la resolveSize sul descriptor → emette warn la prima volta
      const slot = await pool.acquireSlot('w-big')
      pool.releaseSlot('w-big', slot)
      // Seconda acquire — niente warn duplicato
      const slot2 = await pool.acquireSlot('w-big')
      pool.releaseSlot('w-big', slot2)

      expect(warnSpy).toHaveBeenCalledTimes(1)
      const warnArg = warnSpy.mock.calls[0]?.[0]
      expect(warnArg).toContain('w-big')
      expect(warnArg).toContain('16')
    } finally {
      warnSpy.mockRestore()
    }
  })
})
