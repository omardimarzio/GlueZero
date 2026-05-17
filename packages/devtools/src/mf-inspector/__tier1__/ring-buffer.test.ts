/**
 * Tier-1 jsdom unit test per `createMfRingBuffer` (D-V2-F16-09).
 *
 * Copre: push singolo, FIFO drop-oldest, snapshot deep-clone, clear, capacity,
 * size, default 500, generic type T.
 */
import { describe, expect, it } from 'vitest'
import { createMfRingBuffer } from '../ring-buffer'

describe('createMfRingBuffer (D-V2-F16-09)', () => {
  it('push singolo incrementa size e popola snapshot', () => {
    const buf = createMfRingBuffer<{ topic: string }>(10)
    buf.push({ topic: 'a' })
    expect(buf.size()).toBe(1)
    expect(buf.snapshot()).toEqual([{ topic: 'a' }])
  })

  it('push oltre capacity applica FIFO drop-oldest via shift', () => {
    const buf = createMfRingBuffer<number>(3)
    buf.push(1)
    buf.push(2)
    buf.push(3)
    buf.push(4)
    expect(buf.size()).toBe(3)
    expect(buf.snapshot()).toEqual([2, 3, 4]) // '1' shifted
  })

  it('snapshot ritorna deep-clone (mutare return NON corrompe state interno)', () => {
    const buf = createMfRingBuffer<{ x: number }>(5)
    buf.push({ x: 1 })
    buf.push({ x: 2 })
    const snap = buf.snapshot() as Array<{ x: number }>
    snap[0]!.x = 999
    expect(buf.snapshot()[0]?.x).toBe(1) // unchanged
  })

  it('clear svuota completamente il buffer', () => {
    const buf = createMfRingBuffer<number>(10)
    buf.push(1)
    buf.push(2)
    buf.clear()
    expect(buf.size()).toBe(0)
    expect(buf.snapshot()).toEqual([])
  })

  it('capacity ritorna il valore passato al costruttore', () => {
    const buf = createMfRingBuffer<number>(42)
    expect(buf.capacity()).toBe(42)
  })

  it('size incrementa correttamente fino a capacity', () => {
    const buf = createMfRingBuffer<number>(3)
    expect(buf.size()).toBe(0)
    buf.push(1)
    expect(buf.size()).toBe(1)
    buf.push(2)
    expect(buf.size()).toBe(2)
    buf.push(3)
    expect(buf.size()).toBe(3)
    buf.push(4) // FIFO drop
    expect(buf.size()).toBe(3)
  })

  it('capacity default 500 quando arg omesso', () => {
    const buf = createMfRingBuffer<number>()
    expect(buf.capacity()).toBe(500)
  })

  it('generic type T inferito + preservato in snapshot', () => {
    interface E {
      readonly topic: string
      readonly mfId: string
    }
    const buf = createMfRingBuffer<E>(5)
    buf.push({ topic: 'a', mfId: 'mf1' })
    const snap = buf.snapshot()
    expect(snap.length).toBe(1)
    expect(snap[0]?.topic).toBe('a')
    expect(snap[0]?.mfId).toBe('mf1')
  })
})
