// worker-registry.test.ts — Tier-1 jsdom unit test per WorkerRegistry
// (Wave 3-B plan 05-05 — RED phase).
//
// Decisioni testate:
// - D-124 fail-fast: tasks vuote → throw `worker.descriptor.invalid`
// - D-126 cascade: `unregisterByOwner` rimuove SOLO worker dell'owner
// - D-128 pool size cap hard 8: `size > 8` senza `allowUnboundedPool` → throw
//   `worker.pool.size.exceeded`
// - Duplicate guard: stesso `id` 2x → throw `worker.id.duplicate` con
//   `existingOwner` in details (T-05-05-03 mitigation)
//
// Pattern role-match con `realtime-channel-manager.test.ts` di F4
// (registry + cascade + duplicate guard).

import { beforeEach, describe, expect, it } from 'vitest'
import type { BrokerError } from '@sembridge/core'
import { WorkerRegistry } from './worker-registry'
import type { WorkerDescriptor } from './types'

/** Builder helper per descriptor minimi — riduce boilerplate nei test. */
function makeDesc(
  id: string = 'w1',
  overrides: Partial<WorkerDescriptor> = {},
): WorkerDescriptor {
  const base: WorkerDescriptor = {
    id,
    factory: () => ({}) as unknown as Worker,
    tasks: ['task-a', 'task-b'] as const,
    mode: 'dedicated',
    ...overrides,
  }
  return base
}

describe('WorkerRegistry — Map registry + cascade D-126 + validation D-124/128', () => {
  let registry: WorkerRegistry

  beforeEach(() => {
    registry = new WorkerRegistry()
  })

  it('Test 1: register + get ritorna entry con desc + ownerId', () => {
    const desc = makeDesc('test-worker')
    registry.register(desc, 'plugin-a')
    const entry = registry.get('test-worker')
    expect(entry).toBeDefined()
    expect(entry?.desc.id).toBe('test-worker')
    expect(entry?.ownerId).toBe('plugin-a')
    expect(typeof entry?.registeredAt).toBe('number')
  })

  it('Test 2: register stesso id 2x → throw worker.id.duplicate category=config', () => {
    registry.register(makeDesc('w1'), 'plugin-a')
    let caught: BrokerError | undefined
    try {
      registry.register(makeDesc('w1'), 'plugin-b')
    } catch (e) {
      caught = e as BrokerError
    }
    expect(caught).toBeDefined()
    expect(caught?.code).toBe('worker.id.duplicate')
    expect(caught?.category).toBe('config')
    expect(caught?.details).toMatchObject({
      workerId: 'w1',
      existingOwner: 'plugin-a',
      requestedOwner: 'plugin-b',
    })
  })

  it('Test 3: register con tasks vuote → throw worker.descriptor.invalid (D-124 fail-fast)', () => {
    const badDesc = makeDesc('w1', { tasks: [] as const })
    let caught: BrokerError | undefined
    try {
      registry.register(badDesc, 'plugin-a')
    } catch (e) {
      caught = e as BrokerError
    }
    expect(caught).toBeDefined()
    expect(caught?.code).toBe('worker.descriptor.invalid')
    expect(caught?.category).toBe('config')
  })

  it('Test 4: validateTask ritorna true se taskName ∈ desc.tasks (D-124 lookup)', () => {
    registry.register(makeDesc('w1', { tasks: ['parse', 'render'] as const }), 'plugin-a')
    expect(registry.validateTask('w1', 'parse')).toBe(true)
    expect(registry.validateTask('w1', 'render')).toBe(true)
    expect(registry.validateTask('w1', 'unknown-task')).toBe(false)
  })

  it('Test 5: validateTask su workerId mai registrato → throw worker.unknown', () => {
    let caught: BrokerError | undefined
    try {
      registry.validateTask('ghost-worker', 'task-a')
    } catch (e) {
      caught = e as BrokerError
    }
    expect(caught).toBeDefined()
    expect(caught?.code).toBe('worker.unknown')
    expect(caught?.category).toBe('config')
  })

  it('Test 6: listByOwner filtra entry per ownerId', () => {
    registry.register(makeDesc('w1'), 'plugin-a')
    registry.register(makeDesc('w2'), 'plugin-a')
    registry.register(makeDesc('w3'), 'plugin-b')
    const ownedByA = registry.listByOwner('plugin-a')
    expect(ownedByA).toHaveLength(2)
    const ids = ownedByA.map((e) => e.desc.id).sort()
    expect(ids).toEqual(['w1', 'w2'])
    const ownedByB = registry.listByOwner('plugin-b')
    expect(ownedByB).toHaveLength(1)
    expect(ownedByB[0]?.desc.id).toBe('w3')
    expect(registry.listByOwner('plugin-ghost')).toEqual([])
  })

  it('Test 7: unregister rimuove entry; subsequent get → undefined', () => {
    registry.register(makeDesc('w1'), 'plugin-a')
    expect(registry.get('w1')).toBeDefined()
    const removed = registry.unregister('w1')
    expect(removed).toBe(true)
    expect(registry.get('w1')).toBeUndefined()
    // unregister id inesistente → false (idempotent-friendly)
    expect(registry.unregister('w1')).toBe(false)
  })

  it('Test 8: unregisterByOwner cascade rimuove SOLO worker del plugin (D-126 LIFE-02 ext F5)', () => {
    registry.register(makeDesc('w1'), 'plugin-a')
    registry.register(makeDesc('w2'), 'plugin-a')
    registry.register(makeDesc('w3'), 'plugin-b')
    const removed = registry.unregisterByOwner('plugin-a')
    expect(removed).toEqual(expect.arrayContaining(['w1', 'w2']))
    expect(removed).toHaveLength(2)
    expect(registry.get('w1')).toBeUndefined()
    expect(registry.get('w2')).toBeUndefined()
    expect(registry.get('w3')?.desc.id).toBe('w3')
    // T-05-05-04 mitigation: Plugin A non può cleanup worker di Plugin B
    expect(registry.unregisterByOwner('plugin-ghost')).toEqual([])
  })

  it('Test 9: getDebugSnapshot ritorna { workerCount, byOwner }', () => {
    registry.register(makeDesc('w1'), 'plugin-a')
    registry.register(makeDesc('w2'), 'plugin-a')
    registry.register(makeDesc('w3'), 'plugin-b')
    const snap = registry.getDebugSnapshot()
    expect(snap.workerCount).toBe(3)
    expect(snap.byOwner).toMatchObject({
      'plugin-a': 2,
      'plugin-b': 1,
    })
  })

  it('Test 10: register pool size > 8 senza allowUnboundedPool → throw worker.pool.size.exceeded (D-128)', () => {
    const desc = makeDesc('w1', { mode: 'pool', size: 16 })
    let caught: BrokerError | undefined
    try {
      registry.register(desc, 'plugin-a')
    } catch (e) {
      caught = e as BrokerError
    }
    expect(caught).toBeDefined()
    expect(caught?.code).toBe('worker.pool.size.exceeded')
    expect(caught?.category).toBe('config')
    expect(caught?.details).toMatchObject({
      workerId: 'w1',
      requestedSize: 16,
      maxSize: 8,
    })

    // Bypass via allowUnboundedPool: true → register OK
    const desc2 = makeDesc('w2', { mode: 'pool', size: 16, allowUnboundedPool: true })
    expect(() => registry.register(desc2, 'plugin-a')).not.toThrow()
    expect(registry.get('w2')?.desc.size).toBe(16)
  })
})
