// __browser__/playwright-worker-smoke.test.ts — Tier-3 Playwright Chromium real
// Worker smoke test (Wave 4 plan 05-06 — D-151 #7 transferable byteLength=0 +
// D-150 3-tier strategy + Pitfall 7.B + Pitfall 7.E + PRD §31.3 module worker
// evergreen).
//
// Esecuzione: `pnpm -F @sembridge/worker test:browser` con Vitest 4.x browser
// provider Playwright Chromium headless. Verifica che le API browser native
// (Worker module, structuredClone Date/Map, transferable ownership) funzionino
// in real-browser (non MockWorker).
//
// Differenze vs Tier-1 jsdom:
// - Worker constructor reale (Chromium nativo, no MockWorker)
// - structuredClone preserves Date/Map types (jsdom non lo supporta sempre)
// - Transferable byteLength=0 post-transfer (jsdom buffer non transferred)
// - module type Worker loading (Vite/esbuild dev server resolve)

import * as Comlink from 'comlink'
import { describe, expect, it } from 'vitest'

describe('Tier-3 Playwright real Worker — D-151 #7 + smoke (D-150)', () => {
  it('Test 1: structuredClone Date round-trip preservato (Pitfall 7.B)', async () => {
    const w = new Worker(new URL('./test-worker.ts', import.meta.url), { type: 'module' })
    const api = Comlink.wrap<{ echoDate: (d: Date) => Promise<Date> }>(w)
    const original = new Date('2026-01-01T00:00:00Z')
    const echoed = await api.echoDate(original)
    expect(echoed).toBeInstanceOf(Date)
    expect(echoed.toISOString()).toBe(original.toISOString())
    w.terminate()
  })

  it('Test 2: structuredClone Map round-trip preservato (Pitfall 7.B)', async () => {
    const w = new Worker(new URL('./test-worker.ts', import.meta.url), { type: 'module' })
    const api = Comlink.wrap<{ echoMap: (m: Map<string, number>) => Promise<Map<string, number>> }>(
      w,
    )
    const original = new Map([
      ['a', 1],
      ['b', 2],
    ])
    const echoed = await api.echoMap(original)
    expect(echoed).toBeInstanceOf(Map)
    expect(echoed.get('a')).toBe(1)
    expect(echoed.get('b')).toBe(2)
    w.terminate()
  })

  it('Test 3 (D-151 #7): transferable byteLength=0 post-transfer (Pitfall 7.E)', async () => {
    const w = new Worker(new URL('./test-worker.ts', import.meta.url), { type: 'module' })
    const api = Comlink.wrap<{ echoBuffer: (b: ArrayBuffer) => Promise<number> }>(w)
    const buf = new ArrayBuffer(1024)
    expect(buf.byteLength).toBe(1024)
    const sizeInWorker = await api.echoBuffer(Comlink.transfer(buf, [buf]))
    expect(sizeInWorker).toBe(1024) // worker received full buffer
    expect(buf.byteLength).toBe(0) // main thread byteLength=0 post-transfer (D-141 Pitfall 7.E)
    w.terminate()
  })

  it('Test 4: navigator.hardwareConcurrency real value (D-127 default pool size)', () => {
    expect(navigator.hardwareConcurrency).toBeGreaterThan(0)
    expect(navigator.hardwareConcurrency).toBeLessThan(256) // sanity
  })

  it('Test 5: postMessage real round-trip via Comlink (smoke RPC)', async () => {
    const w = new Worker(new URL('./test-worker.ts', import.meta.url), { type: 'module' })
    const api = Comlink.wrap<{ fastTask: (n: number) => Promise<number> }>(w)
    expect(await api.fastTask(21)).toBe(42)
    w.terminate()
  })

  it('Test 6: Worker module type loaded (PRD §31.3 evergreen)', async () => {
    const w = new Worker(new URL('./test-worker.ts', import.meta.url), { type: 'module' })
    const api = Comlink.wrap<{ fastTask: (n: number) => Promise<number> }>(w)
    expect(await api.fastTask(7)).toBe(14)
    w.terminate()
  })
})
