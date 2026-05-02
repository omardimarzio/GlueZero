// dedupe-strategy.test.ts — Test deterministici per KeyBasedDedupe (D-74, ROUTE-11).
//
// Coverage:
// - Single execute → fn invoked 1 volta + ritorna result
// - 2 concurrent execute con stessa key → 1 sola fn call (Promise singleton)
// - Settle → entry rilasciata → nuova execute chiama fn nuovamente
// - 5 concurrent execute → 1 sola fn invocation
// - Diverse key → fn diversi entrambi invocati
// - Failure path: fn throws → tutti i caller ricevono stesso reject + cleanup
// - size() riflette inflight
// - clear() resetta state
//
// Riferimento PITFALLS: Pattern 5 RESEARCH "SingleFlightRefresh" Promise singleton.
// Pattern Map<string, Promise<T>> con cleanup in finally.

import { describe, expect, it, vi } from 'vitest'
import { createDedupeStrategy } from './dedupe-strategy'

describe('createDedupeStrategy — KeyBasedDedupe (D-74, ROUTE-11)', () => {
  it("Test 1: execute('key1', fn) → fn invoked 1 volta + ritorna result", async () => {
    const dedupe = createDedupeStrategy()
    const fn = vi.fn().mockResolvedValue('result-1')

    const result = await dedupe.execute('key1', fn)

    expect(result).toBe('result-1')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("Test 2: 2 concurrent execute('key1', fn1) + execute('key1', fn2) PARALLEL → fn1 called 1 volta, fn2 NEVER, both resolve same value (singleton)", async () => {
    const dedupe = createDedupeStrategy()
    let resolveFn1: (v: string) => void = () => {}
    const fn1 = vi.fn().mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveFn1 = resolve
        }),
    )
    const fn2 = vi.fn().mockResolvedValue('result-2')

    const p1 = dedupe.execute('key1', fn1)
    const p2 = dedupe.execute('key1', fn2)

    resolveFn1('result-1')

    const [r1, r2] = await Promise.all([p1, p2])

    expect(r1).toBe('result-1')
    expect(r2).toBe('result-1') // singleton — entrambi ricevono lo stesso valore
    expect(fn1).toHaveBeenCalledTimes(1)
    expect(fn2).not.toHaveBeenCalled()
  })

  it("Test 3: dopo settle Test 2, nuova execute('key1', fn3) → fn3 INVOKED (entry rilasciata)", async () => {
    const dedupe = createDedupeStrategy()
    const fn1 = vi.fn().mockResolvedValue('first')
    const fn3 = vi.fn().mockResolvedValue('second')

    await dedupe.execute('key1', fn1) // settle
    const result = await dedupe.execute('key1', fn3) // nuova chiamata post-settle

    expect(result).toBe('second')
    expect(fn3).toHaveBeenCalledTimes(1)
  })

  it("Test 4: 5 concurrent execute('key1', fn) → fn invocata 1 volta, tutti i 5 await stessa value", async () => {
    const dedupe = createDedupeStrategy()
    let resolveFn: (v: string) => void = () => {}
    const fn = vi.fn().mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveFn = resolve
        }),
    )

    const promises = Array.from({ length: 5 }, () => dedupe.execute('key1', fn))
    resolveFn('shared-result')
    const results = await Promise.all(promises)

    expect(fn).toHaveBeenCalledTimes(1)
    expect(results).toEqual([
      'shared-result',
      'shared-result',
      'shared-result',
      'shared-result',
      'shared-result',
    ])
  })

  it("Test 5: execute('keyA', fnA) parallelo a execute('keyB', fnB) → entrambi invocati (key diverse)", async () => {
    const dedupe = createDedupeStrategy()
    const fnA = vi.fn().mockResolvedValue('result-A')
    const fnB = vi.fn().mockResolvedValue('result-B')

    const [rA, rB] = await Promise.all([
      dedupe.execute('keyA', fnA),
      dedupe.execute('keyB', fnB),
    ])

    expect(rA).toBe('result-A')
    expect(rB).toBe('result-B')
    expect(fnA).toHaveBeenCalledTimes(1)
    expect(fnB).toHaveBeenCalledTimes(1)
  })

  it('Test 6: fn throws → tutti i caller ricevono stesso reject; entry rilasciata; nuova execute chiama fn', async () => {
    const dedupe = createDedupeStrategy()
    const errorPayload = new Error('boom')
    const fn1 = vi.fn().mockRejectedValue(errorPayload)
    const fn2 = vi.fn().mockResolvedValue('post-failure')

    const p1 = dedupe.execute('key1', fn1)
    const p2 = dedupe.execute('key1', fn1) // concurrent

    await expect(p1).rejects.toThrow('boom')
    await expect(p2).rejects.toThrow('boom')
    expect(fn1).toHaveBeenCalledTimes(1) // singleton anche su rejection

    // Entry rilasciata → nuova execute chiama fn2
    const result = await dedupe.execute('key1', fn2)
    expect(result).toBe('post-failure')
    expect(fn2).toHaveBeenCalledTimes(1)
  })

  it('Test 7: size() riflette inflight (0 → 1 → 0 dopo settle)', async () => {
    const dedupe = createDedupeStrategy()
    expect(dedupe.size()).toBe(0)

    let resolveFn: (v: string) => void = () => {}
    const fn = vi.fn().mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveFn = resolve
        }),
    )

    const promise = dedupe.execute('key1', fn)
    expect(dedupe.size()).toBe(1) // inflight

    resolveFn('done')
    await promise
    expect(dedupe.size()).toBe(0) // post-settle
  })

  it('Test 8: clear() resetta state — successive execute con stesse key chiamano fn nuovamente', async () => {
    const dedupe = createDedupeStrategy()
    let resolveFn1: (v: string) => void = () => {}
    const fn1 = vi.fn().mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveFn1 = resolve
        }),
    )
    const fn2 = vi.fn().mockResolvedValue('post-clear')

    // first execute pending
    const p1 = dedupe.execute('key1', fn1)
    expect(dedupe.size()).toBe(1)

    // clear before settle
    dedupe.clear()
    expect(dedupe.size()).toBe(0)

    // second execute con stessa key → fn2 invoked (entry rimossa)
    const p2 = dedupe.execute('key1', fn2)
    expect(fn2).toHaveBeenCalledTimes(1)

    // settle p1 (per non lasciare hanging promise)
    resolveFn1('first-late')
    await p1
    await p2
  })
})
