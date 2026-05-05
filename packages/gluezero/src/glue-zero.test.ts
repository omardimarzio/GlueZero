// glue-zero.test.ts — Tier-1 jsdom test deterministici per `createGlueZero`
// (plan 06-08b Wave 4b — factory aggregato CHAIN COMPLETA F1+F2+F3+F4+F5+F6 +
// features opt-out + D-30 anti-singleton + Valibot prefix 'Invalid GlueZeroConfig:').
//
// **BLOCKER-2 fix verifica acceptance**: la chain include OBBLIGATORIAMENTE
// createWorkerBroker + createRealtimeBroker quando features li abilita. Test 10
// verifica grep `createWorkerBroker|createRealtimeBroker` nel source file.
//
// 10+ test:
//   - default features chain F1+F2+F3+F4+F5+F6 attivi
//   - features.realtime=false → realtime skip
//   - features.worker=false → worker skip
//   - features.cache=false → cache skip
//   - features.devtools=false → devtools skip
//   - opt-out combinato realtime+worker
//   - D-30 anti-singleton
//   - Valibot fail prefix 'Invalid GlueZeroConfig:'
//   - acceptance grep BLOCKER-2 verifica chain include createWorkerBroker + createRealtimeBroker

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createGlueZero } from './glue-zero'

// Path relativo al cwd del test (root del package @gluezero/gluezero).
const SEM_BRIDGE_PATH = resolve(process.cwd(), 'src/glue-zero.ts')

describe('createGlueZero — chain composition F1+F2+F3+F4+F5+F6 (BLOCKER-2 fix)', () => {
  it('Test 1: createGlueZero({}) ritorna broker con publish/subscribe API (default chain F1..F6 attiva)', () => {
    const broker = createGlueZero({})
    expect(broker).toBeDefined()
    expect(typeof broker.publish).toBe('function')
    expect(typeof broker.subscribe).toBe('function')
  })

  it('Test 2: default features → broker outermost ha API devtools (getDebugSnapshot)', () => {
    const broker = createGlueZero({}) as { getDebugSnapshot?: () => unknown }
    // Devtools è OUTERMOST per default → expose getDebugSnapshot.
    expect(typeof broker.getDebugSnapshot).toBe('function')
  })

  it('Test 3: features.devtools=false → devtools NON outermost (no getDebugSnapshot)', () => {
    const broker = createGlueZero({ features: { devtools: false } }) as {
      getDebugSnapshot?: () => unknown
    }
    expect(typeof broker.getDebugSnapshot).toBe('undefined')
  })

  it('Test 4: features.cache=false → cache NON outermost (no getCacheStats sul wrapper esterno)', () => {
    const broker = createGlueZero({
      features: { cache: false, devtools: false },
    }) as { getCacheStats?: () => unknown }
    expect(typeof broker.getCacheStats).toBe('undefined')
  })

  it('Test 5: features.worker=false → registerWorkerRoute NON sul wrapper esterno', () => {
    const broker = createGlueZero({
      features: { worker: false, cache: false, devtools: false },
    }) as { registerWorkerRoute?: () => unknown }
    expect(typeof broker.registerWorkerRoute).toBe('undefined')
  })

  it('Test 6: features.realtime=false → connectRealtime NON sul wrapper esterno', () => {
    const broker = createGlueZero({
      features: { realtime: false, worker: false, cache: false, devtools: false },
    }) as { connectRealtime?: () => unknown }
    expect(typeof broker.connectRealtime).toBe('undefined')
  })

  it('Test 7: features tutte false → broker minimal F1+F2+F3 (publish/subscribe + registerRoute)', () => {
    const broker = createGlueZero({
      features: { realtime: false, worker: false, cache: false, devtools: false },
    })
    expect(typeof broker.publish).toBe('function')
    expect(typeof broker.subscribe).toBe('function')
    // F3 routing API
    const reg = broker.registerRoute({ id: 'rx', type: 'local', topic: 'test.topic' } as never)
    expect(reg).toBeDefined()
  })

  it('Test 8: D-30 anti-singleton — istanze multiple isolate', () => {
    const a = createGlueZero({})
    const b = createGlueZero({})
    expect(a).not.toBe(b)
  })

  it('Test 9: Valibot fail su features.cache non-boolean → throw con prefix Invalid GlueZeroConfig', () => {
    expect(() =>
      createGlueZero({
        features: {
          // @ts-expect-error invalid type
          cache: 'yes',
        },
      }),
    ).toThrowError(/Invalid GlueZeroConfig:/)
  })

  it('Test 10 (BLOCKER-2 acceptance): glue-zero.ts source contiene createWorkerBroker + createRealtimeBroker', () => {
    const source = readFileSync(SEM_BRIDGE_PATH, 'utf-8')
    const matches = source.match(/createWorkerBroker|createRealtimeBroker/g) ?? []
    // ≥4 hits (2 import + 2 use case if branch — chain completa F1..F6).
    expect(matches.length).toBeGreaterThanOrEqual(4)
  })

  it('Test 11: chain completa default → publish + subscribe end-to-end funziona', async () => {
    const broker = createGlueZero({})
    const received: unknown[] = []
    broker.subscribe('chain.topic', (ev: { payload: unknown }) => received.push(ev.payload))
    broker.publish('chain.topic', { hello: 'F6' }, {
      source: { type: 'plugin', id: 'app' },
    } as never)
    await new Promise((r) => setTimeout(r, 10))
    expect(received).toEqual([{ hello: 'F6' }])
  })

  it('Test 12: features.realtime/worker false ma cache+devtools attivi → broker funziona', async () => {
    const broker = createGlueZero({
      features: { realtime: false, worker: false },
    })
    const received: unknown[] = []
    broker.subscribe('mixed.topic', (ev: { payload: unknown }) => received.push(ev.payload))
    broker.publish('mixed.topic', { v: 1 }, {
      source: { type: 'plugin', id: 'app' },
    } as never)
    await new Promise((r) => setTimeout(r, 10))
    expect(received).toEqual([{ v: 1 }])
  })
})
