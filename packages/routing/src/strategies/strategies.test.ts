// strategies.test.ts — Test deterministici per le 3 multi-route policy strategy (D-66).
//
// Coverage: 4 test isolati che esercitano le pure functions firstMatch / priorityOrdered /
// allBroadcast indipendentemente dal RouteResolver. Test integration (resolver invoca le
// strategy) sono in route-resolver.test.ts.

import { describe, expect, it } from 'vitest'
import type { CompiledRoute } from '../route-resolver'
import { allBroadcast, firstMatch, priorityOrdered } from './index'

// Helper factory: minimal CompiledRoute con id + priority configurabili. `definition`
// è readonly unknown — il test non lo legge.
function compiled(id: string, priority = 0): CompiledRoute {
  return {
    id,
    definition: { id, type: 'local', topic: 'test.topic' } as never,
    ownerId: undefined,
    priority,
  }
}

describe('strategies', () => {
  describe('firstMatch', () => {
    it('Test 1: firstMatch([r1, r2, r3]) → [r1]', () => {
      const r1 = compiled('r1')
      const r2 = compiled('r2')
      const r3 = compiled('r3')
      const result = firstMatch([r1, r2, r3])
      expect(result.length).toBe(1)
      expect(result[0]?.id).toBe('r1')
    })

    it('firstMatch([]) → [] (input vuoto)', () => {
      expect(firstMatch([])).toEqual([])
    })
  })

  describe('priorityOrdered', () => {
    it('Test 2: priorityOrdered([{priority:1}, {priority:5}, {priority:2}]) → [{priority:5}]', () => {
      const low = compiled('low', 1)
      const high = compiled('high', 5)
      const mid = compiled('mid', 2)
      const result = priorityOrdered([low, high, mid])
      expect(result.length).toBe(1)
      expect(result[0]?.id).toBe('high')
      expect(result[0]?.priority).toBe(5)
    })

    it('Test 3: priorityOrdered([{priority:0}, {priority:0}]) → [primo] (tie-breaker insertion order)', () => {
      const a = compiled('a', 0)
      const b = compiled('b', 0)
      const result = priorityOrdered([a, b])
      expect(result.length).toBe(1)
      // sort stable JS ≥ 2019 — primo elemento (insertion order) vince in caso di tie
      expect(result[0]?.id).toBe('a')
    })

    it('priorityOrdered([]) → [] (input vuoto)', () => {
      expect(priorityOrdered([])).toEqual([])
    })
  })

  describe('allBroadcast', () => {
    it('Test 4: allBroadcast([r1, r2, r3]) → [r1, r2, r3] (passthrough)', () => {
      const r1 = compiled('r1')
      const r2 = compiled('r2')
      const r3 = compiled('r3')
      const result = allBroadcast([r1, r2, r3])
      expect(result.length).toBe(3)
      expect(result.map((r) => r.id)).toEqual(['r1', 'r2', 'r3'])
    })

    it('allBroadcast([]) → [] (input vuoto)', () => {
      expect(allBroadcast([])).toEqual([])
    })
  })
})
