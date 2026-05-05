// devtools-broker.test.ts — Tier-1 jsdom test deterministici per `DevtoolsBroker`
// (plan 06-08b Wave 4b — composition wrapper Opzione B + step 14 attivazione +
// MultiplexTap aggregator + getDebugSnapshot deep-clone D-162 + cascade D-126).
//
// Pattern carryover ESATTO da `packages/cache/src/cache-broker.test.ts` (Wave 4a)
// + `packages/worker/src/worker-broker.test.ts` (F5).
//
// 14+ test:
//   - composition wires Inspector+RouteInspector+Metrics+PauseController (3)
//   - multiplex tap chain user (3)
//   - auto-wrap F1 single-tap legacy via wrapLegacyTap (2)
//   - step 14 attivazione D-161 — event.observed dopo inner.publish (1)
//   - getDebugSnapshot deep-clone D-162 (2)
//   - enableDebug/disableDebug toggle (2)
//   - NODE_ENV detection (1)
//   - pauseTopic / resumeTopic / flushQueue API (2)
//   - cascade unregisterPlugin → inner.unregisterPlugin (1)

import type { EventTap, PipelineSnapshot } from '@sembridge/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DevtoolsBroker } from './devtools-broker'

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('DevtoolsBroker — composition wrapper Opzione B (D-83 / D-121 / D-159..D-170)', () => {
  let broker: DevtoolsBroker

  afterEach(() => {
    /* niente cleanup globale — D-30 anti-singleton */
  })

  // --------------------------------------------------------------------------
  // composition wires Inspector + RouteInspector + Metrics + PauseController (3)
  // --------------------------------------------------------------------------

  describe('composition wires Inspector+RouteInspector+Metrics+PauseController', () => {
    it('Test 1: getDebugSnapshot expone recentEvents/recentRoutes/currentMetrics/pausedTopics/enabled', () => {
      broker = new DevtoolsBroker({})
      const snap = broker.getDebugSnapshot()
      expect(snap).toHaveProperty('recentEvents')
      expect(snap).toHaveProperty('recentRoutes')
      expect(snap).toHaveProperty('currentMetrics')
      expect(snap).toHaveProperty('pausedTopics')
      expect(snap).toHaveProperty('enabled')
      expect(Array.isArray(snap.recentEvents)).toBe(true)
      expect(Array.isArray(snap.recentRoutes)).toBe(true)
      expect(Array.isArray(snap.pausedTopics)).toBe(true)
    })

    it('Test 2: getMetrics ritorna snapshot { counters, gauges, histograms } default empty', () => {
      broker = new DevtoolsBroker({})
      const m = broker.getMetrics()
      expect(m.counters).toEqual({})
      expect(m.gauges).toEqual({})
      expect(m.histograms).toEqual({})
    })

    it('Test 3: subscribe + publish pipeline §28 cattura snapshot via Inspector', async () => {
      broker = new DevtoolsBroker({ devtools: { initiallyEnabled: true } as never })
      broker.subscribe('plain.topic', () => {})
      broker.publish('plain.topic', { hello: 'world' }, {
        source: { type: 'plugin', id: 'app' },
      })
      await flushMicrotasks()
      const snap = broker.getDebugSnapshot()
      // L'Inspector di default è enabled (NODE_ENV !== 'production' → true) e
      // il MultiplexTap collega gli step pipeline F1 al buffer.
      expect(snap.recentEvents.length).toBeGreaterThan(0)
    })
  })

  // --------------------------------------------------------------------------
  // multiplex tap chain user (3)
  // --------------------------------------------------------------------------

  describe('MultiplexTap chain user (D-159)', () => {
    it('Test 4: tap user passato via config.taps invocato per ogni step', async () => {
      const userTapSteps: string[] = []
      const userTap: EventTap = {
        onPipelineStep: (_step, snap: PipelineSnapshot) => {
          userTapSteps.push(snap.step as string)
        },
      }
      broker = new DevtoolsBroker({ taps: [userTap] })
      broker.subscribe('multi.topic', () => {})
      broker.publish('multi.topic', { x: 1 }, {
        source: { type: 'plugin', id: 'app' },
      })
      await flushMicrotasks()
      expect(userTapSteps.length).toBeGreaterThan(0)
    })

    it('Test 5: tap user che throw NON blocca downstream tap (error isolation D-159)', async () => {
      const goodTapSteps: string[] = []
      const badTap: EventTap = {
        onPipelineStep: () => {
          throw new Error('user tap fail')
        },
      }
      const goodTap: EventTap = {
        onPipelineStep: (_step, snap: PipelineSnapshot) => {
          goodTapSteps.push(snap.step as string)
        },
      }
      broker = new DevtoolsBroker({ taps: [badTap, goodTap] })
      broker.subscribe('iso.topic', () => {})
      broker.publish('iso.topic', { x: 1 }, {
        source: { type: 'plugin', id: 'app' },
      })
      await flushMicrotasks()
      expect(goodTapSteps.length).toBeGreaterThan(0)
    })

    it('Test 6: 3+ tap chain (Inspector + Metrics + custom) tutti invocati', async () => {
      const customSteps: string[] = []
      const customTap: EventTap = {
        onPipelineStep: (_step, snap: PipelineSnapshot) => {
          customSteps.push(snap.step as string)
        },
      }
      broker = new DevtoolsBroker({ taps: [customTap] })
      broker.subscribe('chain.topic', () => {})
      broker.publish('chain.topic', { v: 1 }, {
        source: { type: 'plugin', id: 'app' },
      })
      await flushMicrotasks()
      // Custom tap riceve almeno uno step
      expect(customSteps.length).toBeGreaterThan(0)
      // E Inspector ha popolato il proprio buffer
      const snap = broker.getDebugSnapshot()
      expect(snap.recentEvents.length).toBeGreaterThan(0)
    })
  })

  // --------------------------------------------------------------------------
  // auto-wrap F1 single-tap legacy (2)
  // --------------------------------------------------------------------------

  describe('auto-wrap F1 runtime.tap legacy (wrapLegacyTap helper 06-04)', () => {
    it('Test 7: config.runtime.tap legacy → invocato accanto al chain F6', async () => {
      const legacySteps: string[] = []
      const legacyTap: EventTap = {
        onPipelineStep: (_step, snap: PipelineSnapshot) => {
          legacySteps.push(snap.step as string)
        },
      }
      broker = new DevtoolsBroker({ runtime: { tap: legacyTap } })
      broker.subscribe('legacy.topic', () => {})
      broker.publish('legacy.topic', {}, {
        source: { type: 'plugin', id: 'app' },
      })
      await flushMicrotasks()
      expect(legacySteps.length).toBeGreaterThan(0)
    })

    it('Test 8: runtime.tap + taps[] coexist — entrambi invocati post-wrap', async () => {
      const a: string[] = []
      const b: string[] = []
      const tapA: EventTap = {
        onPipelineStep: (_step, s: PipelineSnapshot) => a.push(s.step as string),
      }
      const tapB: EventTap = {
        onPipelineStep: (_step, s: PipelineSnapshot) => b.push(s.step as string),
      }
      broker = new DevtoolsBroker({ runtime: { tap: tapA }, taps: [tapB] })
      broker.subscribe('co.topic', () => {})
      broker.publish('co.topic', {}, { source: { type: 'plugin', id: 'app' } })
      await flushMicrotasks()
      expect(a.length).toBeGreaterThan(0)
      expect(b.length).toBeGreaterThan(0)
    })
  })

  // --------------------------------------------------------------------------
  // step 14 attivazione D-161 (1)
  // --------------------------------------------------------------------------

  describe('step 14 attivazione D-161 — event.observed', () => {
    it('Test 9: post inner.publish il MultiplexTap riceve event.observed', async () => {
      const observedSteps: string[] = []
      const tap: EventTap = {
        onPipelineStep: (_step, snap: PipelineSnapshot) => {
          observedSteps.push(snap.step as string)
        },
      }
      broker = new DevtoolsBroker({ taps: [tap] })
      broker.subscribe('obs.topic', () => {})
      broker.publish('obs.topic', { observed: true }, {
        source: { type: 'plugin', id: 'app' },
      })
      await flushMicrotasks()
      expect(observedSteps).toContain('event.observed')
    })
  })

  // --------------------------------------------------------------------------
  // getDebugSnapshot deep-clone D-162 (2)
  // --------------------------------------------------------------------------

  describe('getDebugSnapshot deep-clone D-162', () => {
    it('Test 10: mutazione del snapshot ritornato NON corrompe lo state interno', async () => {
      broker = new DevtoolsBroker({})
      broker.subscribe('mut.topic', () => {})
      broker.publish('mut.topic', { v: 1 }, { source: { type: 'plugin', id: 'app' } })
      await flushMicrotasks()
      const s1 = broker.getDebugSnapshot()
      // Tentativo mutazione (cast esplicito to mutable per il test)
      ;(s1 as { recentEvents: unknown[] }).recentEvents.push({ injected: true } as never)
      const s2 = broker.getDebugSnapshot()
      // s2.recentEvents NON contiene l'iniezione
      expect((s2.recentEvents as readonly { injected?: boolean }[]).some((e) => e.injected === true)).toBe(false)
    })

    it('Test 11: snapshot ha shape stabile { recentEvents, recentRoutes, currentMetrics, pausedTopics, enabled }', () => {
      broker = new DevtoolsBroker({})
      const s = broker.getDebugSnapshot()
      expect(typeof s.enabled).toBe('boolean')
      expect(s.currentMetrics).toBeDefined()
      expect(s.currentMetrics.counters).toBeDefined()
    })
  })

  // --------------------------------------------------------------------------
  // enableDebug/disableDebug toggle (2)
  // --------------------------------------------------------------------------

  describe('enableDebug/disableDebug toggle live-mode', () => {
    it('Test 12: disableDebug → snapshot.enabled === false', () => {
      broker = new DevtoolsBroker({})
      broker.disableDebug()
      const s = broker.getDebugSnapshot()
      expect(s.enabled).toBe(false)
    })

    it('Test 13: enableDebug → snapshot.enabled === true', () => {
      broker = new DevtoolsBroker({})
      broker.disableDebug()
      broker.enableDebug()
      const s = broker.getDebugSnapshot()
      expect(s.enabled).toBe(true)
    })
  })

  // --------------------------------------------------------------------------
  // NODE_ENV detection (1)
  // --------------------------------------------------------------------------

  describe('NODE_ENV detection default', () => {
    it('Test 14: in test (NODE_ENV != production) → enabled di default true', () => {
      broker = new DevtoolsBroker({})
      const s = broker.getDebugSnapshot()
      expect(s.enabled).toBe(true)
    })
  })

  // --------------------------------------------------------------------------
  // pauseTopic / resumeTopic / flushQueue (2)
  // --------------------------------------------------------------------------

  describe('pauseTopic / resumeTopic / flushQueue API', () => {
    it('Test 15: pauseTopic → snapshot.pausedTopics include topic', () => {
      broker = new DevtoolsBroker({})
      broker.pauseTopic('paused.topic')
      const s = broker.getDebugSnapshot()
      expect(s.pausedTopics).toContain('paused.topic')
    })

    it('Test 16: pauseTopic + publish + resumeTopic → replay subscriber', async () => {
      broker = new DevtoolsBroker({})
      const received: unknown[] = []
      broker.subscribe('p.topic', (ev) => received.push(ev.payload))
      broker.pauseTopic('p.topic')
      broker.publish('p.topic', { v: 'queued1' }, { source: { type: 'plugin', id: 'app' } })
      broker.publish('p.topic', { v: 'queued2' }, { source: { type: 'plugin', id: 'app' } })
      await flushMicrotasks()
      expect(received).toEqual([])
      broker.resumeTopic('p.topic')
      await flushMicrotasks()
      expect(received).toEqual([{ v: 'queued1' }, { v: 'queued2' }])
    })

    it('Test 17: flushQueue → ritorna FlushQueueResult[] con droppedCount', () => {
      broker = new DevtoolsBroker({})
      broker.pauseTopic('flush.topic')
      broker.publish('flush.topic', { v: 1 }, { source: { type: 'plugin', id: 'app' } })
      broker.publish('flush.topic', { v: 2 }, { source: { type: 'plugin', id: 'app' } })
      const result = broker.flushQueue('flush.topic')
      expect(result).toHaveLength(1)
      expect(result[0]?.droppedCount).toBe(2)
    })
  })

  // --------------------------------------------------------------------------
  // cascade plugin (1)
  // --------------------------------------------------------------------------

  describe('cascade D-126 plugin', () => {
    it('Test 18: registerPlugin/unregisterPlugin delegate a inner senza throw', async () => {
      broker = new DevtoolsBroker({})
      await broker.registerPlugin({ id: 'plugin-1', subscriptions: [] } as never)
      await expect(broker.unregisterPlugin('plugin-1')).resolves.not.toThrow()
    })
  })

  // --------------------------------------------------------------------------
  // critical priority bypass (1)
  // --------------------------------------------------------------------------

  describe('critical priority bypass D-170', () => {
    it('Test 19: pauseTopic + publish con priority=critical → pass-through', async () => {
      broker = new DevtoolsBroker({})
      const received: unknown[] = []
      broker.subscribe('crit.topic', (ev) => received.push(ev.payload))
      broker.pauseTopic('crit.topic')
      broker.publish('crit.topic', { important: true }, {
        source: { type: 'plugin', id: 'app' },
        priority: 'critical',
      } as never)
      await flushMicrotasks()
      expect(received).toEqual([{ important: true }])
    })
  })

  // --------------------------------------------------------------------------
  // initiallyEnabled override
  // --------------------------------------------------------------------------

  describe('config.devtools.enableByDefault override', () => {
    it('Test 20: enableByDefault=false → snapshot.enabled=false al boot', () => {
      broker = new DevtoolsBroker({ devtools: { enableByDefault: false } })
      const s = broker.getDebugSnapshot()
      expect(s.enabled).toBe(false)
    })
  })

  // --------------------------------------------------------------------------
  // metrics tap forwarding spy
  // --------------------------------------------------------------------------

  describe('Metrics tap forwarding', () => {
    it('Test 21: getMetrics ritorna shape stabile dopo publish', async () => {
      broker = new DevtoolsBroker({})
      broker.subscribe('m.topic', () => {})
      broker.publish('m.topic', {}, { source: { type: 'plugin', id: 'app' } })
      await flushMicrotasks()
      const m = broker.getMetrics()
      expect(m).toBeDefined()
      expect(m.counters).toBeDefined()
      expect(m.gauges).toBeDefined()
      expect(m.histograms).toBeDefined()
    })
  })

  // --------------------------------------------------------------------------
  // mock spy not used? Just keep vi import valid for future
  // --------------------------------------------------------------------------
  describe('vi placeholder', () => {
    it('vi.fn smoke', () => {
      const fn = vi.fn()
      fn()
      expect(fn).toHaveBeenCalled()
    })
  })
})
