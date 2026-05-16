/**
 * v1-bc-replay — PRD §42.2 API #14 freeze: getMetrics shape D-V2-19 preservation.
 *
 * MF-OBS-03 (D-V2-19 BLOCKING): il campo `microFrontends?` opzionale DEVE essere
 * ASSENTE quando nessun MetricsProvider registrato (shape v1.x bit-exact) +
 * presente come `[]` (empty array) quando provider registrato ritorna empty +
 * popolato con `MfMetricsEntry[]` quando registrati MF lifecycle events.
 *
 * Verifica via `DevtoolsBroker.getMetrics()` perché `Broker.getMetrics()` (core)
 * NON esiste in v1.x (verificato in `metrics-shape.test.ts` esistente F8
 * graceful-skip pattern). MetricsProvider Registry vive su DevtoolsBroker
 * (W3 P03 F16 — analog SnapshotProvider Registry W1 P01).
 *
 * **Pattern carryover diretto F8 `debug-snapshot-shape.test.ts` + W1 P01
 * `devtools-snapshot-shape.test.ts`:** i 3 scenari verificano direttamente
 * lo shape contract `DevtoolsBroker.getMetrics()` ↔ `registerMetricsProvider()`
 * pluggability, NON l'integrazione end-to-end via `modules: [microfrontendModule()]`
 * (limit by design: modules vedono solo `ctx.broker` core, graceful-skip su
 * `registerMetricsProvider` undefined — coerente con plain Broker D-V2-F16-06).
 *
 * **NOTA `__bc_replay__/` directory:** convention F8 — i file in
 * `packages/core/src/__bc_replay__/` sono test layer per BC §42 14 API
 * verification e NON source code core. F16 estende con NUOVI test per BC §42
 * API #13 (devtools-snapshot W1 P01) + API #14 (get-metrics W3 P03) D-V2-19
 * shape preservation. Eccezione esplicita su check-d83-f16.mjs verifier
 * (W3 P03 commit 241f2d2 esclude `__bc_replay__/` dal check `packages/core/src/`).
 *
 * @see D-V2-F16-13 — inline metrics single module
 * @see D-V2-F16-14 — shape preservation 2 scenari (absent / empty array)
 * @see D-V2-19 BLOCKING — chiusura F16 (microFrontends field in getMetrics)
 * @see MF-OBS-03 — REQ frozen contract (getMetrics shape extension)
 * @see packages/core/src/__bc_replay__/debug-snapshot-shape.test.ts (F8 analog)
 * @see packages/core/src/__bc_replay__/devtools-snapshot-shape.test.ts (W1 P01 analog API #13)
 */

import { createDevtoolsBroker } from '@gluezero/devtools'
import { describe, expect, it } from 'vitest'

describe('v1-bc-replay: DevtoolsBroker.getMetrics shape D-V2-19 (API #14, MF-OBS-03)', () => {
  it('Scenario A — DevtoolsBroker WITHOUT MetricsProvider registered → microFrontends field ABSENT (shape v1.x bit-exact)', () => {
    const broker = createDevtoolsBroker({})
    const metrics = broker.getMetrics()
    // BC §42 API #14 preserve bit-exact: nessun provider registrato → field assente
    expect(metrics).not.toHaveProperty('microFrontends')
    // Shape base 3 fields MetricsSnapshot v1.x preservata (counters/gauges/histograms)
    expect(metrics).toHaveProperty('counters')
    expect(metrics).toHaveProperty('gauges')
    expect(metrics).toHaveProperty('histograms')
  })

  it('Scenario B — DevtoolsBroker + MetricsProvider "mf" che ritorna empty → microFrontends === [] (D-V2-F16-14 empty lifecycle)', () => {
    const broker = createDevtoolsBroker({})
    // Provider 'mf' simula `mfInspectorModule` installato con 0 MF attivi
    // (anticipo del wire-up reale W2/W3 — graceful skip su plain Broker D-V2-F16-06).
    broker.registerMetricsProvider('mf', () => ({ microFrontends: [] }))
    const metrics = broker.getMetrics() as { microFrontends?: unknown[] }
    expect(metrics).toHaveProperty('microFrontends')
    expect(Array.isArray(metrics.microFrontends)).toBe(true)
    expect(metrics.microFrontends).toEqual([])
  })

  it('Scenario C — DevtoolsBroker + MetricsProvider "mf" con 2 entries → microFrontends.length === 2 (smoke shape projection)', () => {
    const broker = createDevtoolsBroker({})
    // Provider 'mf' simula `mfInspectorModule` con 2 MF registrati (counter
    // globale 'registered' = 2 replicato in entrambe le entries — B2 fix semantica).
    broker.registerMetricsProvider('mf', () => ({
      microFrontends: [
        {
          id: 'mf-a',
          registered: 2,
          mounted: 0,
          failed: 0,
          permissionDenied: 0,
          compatFailures: 0,
          capMissing: 0,
          timeAvgLoad: { p50: 0, p95: 0, p99: 0, count: 0 },
          timeAvgMount: { p50: 0, p95: 0, p99: 0, count: 0 },
          mountFailures: 0,
          events: 0,
          routeCalls: 0,
          workerTasks: 0,
          contextWrites: 0,
          activeSubs: 0,
        },
        {
          id: 'mf-b',
          registered: 2,
          mounted: 0,
          failed: 0,
          permissionDenied: 0,
          compatFailures: 0,
          capMissing: 0,
          timeAvgLoad: { p50: 0, p95: 0, p99: 0, count: 0 },
          timeAvgMount: { p50: 0, p95: 0, p99: 0, count: 0 },
          mountFailures: 0,
          events: 0,
          routeCalls: 0,
          workerTasks: 0,
          contextWrites: 0,
          activeSubs: 0,
        },
      ],
    }))
    const metrics = broker.getMetrics() as {
      microFrontends?: ReadonlyArray<{ readonly id: string; readonly registered: number }>
    }
    expect(metrics.microFrontends).toBeDefined()
    expect(metrics.microFrontends!.length).toBe(2)
    const ids = metrics.microFrontends!.map((e) => e.id).sort()
    expect(ids).toEqual(['mf-a', 'mf-b'])
    // B2 fix verify — counter globale 'registered' replicato identico in entrambe le entries
    for (const e of metrics.microFrontends!) {
      expect(e.registered).toBe(2)
    }
  })
})
