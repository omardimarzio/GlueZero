// PipelineHarness — fixture condivisa per integration test del package
// `@gluezero/core` (plan 01-09, REQ TEST-01 subset).
//
// Razionale (RESEARCH "PipelineHarness — fixture condivisa"):
// I test integration di Phase 1 verificano end-to-end i 5 success criteria del
// ROADMAP attraverso il `Broker` reale (composition root) — NON via mock dei
// moduli interni. La fixture istanzia un `Broker` con un `EventTap` custom che
// cattura ogni `(step, snapshot)` invocazione in un array `steps`, esponendo:
//   - `broker`     — istanza reale `new Broker({ runtime: { tap, ... } })`
//   - `steps`      — array `Array<{ step, snapshot }>` accumulato per ogni publish
//   - `reset()`    — svuota `steps` (utile in beforeEach pattern)
//   - `byStep(s)`  — filtra `steps` per uno step specifico, ritornando solo gli snapshot
//
// `createPipelineHarness({ debug? })` — `debug: false` di default per riprodurre
// il behavior di production (snapshot non includono `payloadAfter`). Test che
// verificano contenuto payload nel tap o deep-freeze runtime devono passare
// `debug: true`.
//
// `brokerEvent<T>(overrides?)` — helper minimale per costruire un `BrokerEvent`
// con default ragionevoli. NON è la factory canonica `createBrokerEvent` (che vive
// in `core/event-factory.ts` e applica D-21..D-23 default + validazione source).
// Questa variante test-only permette di passare event "raw" al `bus.publish` o di
// confrontare snapshot in test.
//
// Ownership: file vive sotto `src/test-utils/` (NON sotto `__integration__/`)
// perché può essere riusato dai future plan (10 robustness tests, F2+ mapper test
// che vogliono un broker reale come dipendenza). Esclusione dal bundle pubblico
// è garantita dal tsup entry `src/index.ts` (vedi tsup.config.ts) che re-esporta
// solo i simboli del public surface.

import { Broker } from '../core/broker'
import type { BrokerEvent } from '../types/broker-event'
import type { EventTap, PipelineSnapshot, PipelineStep } from '../types/tap'

export interface PipelineHarness {
  broker: Broker
  steps: Array<{ step: PipelineStep; snapshot: PipelineSnapshot }>
  reset(): void
  byStep(step: PipelineStep): PipelineSnapshot[]
}

export function createPipelineHarness(options: { debug?: boolean } = {}): PipelineHarness {
  const steps: PipelineHarness['steps'] = []
  const tap: EventTap = {
    onPipelineStep: (step, snapshot): void => {
      steps.push({ step, snapshot })
    },
  }
  const broker = new Broker({
    runtime: { tap, logLevel: 'silent', debug: options.debug ?? false },
  })
  return {
    broker,
    steps,
    reset(): void {
      steps.length = 0
    },
    byStep(step): PipelineSnapshot[] {
      return steps.filter((s) => s.step === step).map((s) => s.snapshot)
    },
  }
}

export function brokerEvent<T>(overrides: Partial<BrokerEvent<T>> = {}): BrokerEvent<T> {
  const base: BrokerEvent<T> = {
    id: overrides.id ?? 'test-id',
    topic: overrides.topic ?? 'test.topic',
    timestamp: overrides.timestamp ?? Date.now(),
    source: overrides.source ?? { type: 'plugin', id: 'test-plugin' },
    payload: overrides.payload as never,
    deliveryMode: overrides.deliveryMode ?? 'sync',
    priority: overrides.priority ?? 'normal',
  }
  return { ...base, ...overrides } as BrokerEvent<T>
}
