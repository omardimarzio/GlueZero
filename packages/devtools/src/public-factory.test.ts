// public-factory.test.ts — Tier-1 jsdom test deterministici per `createDevtoolsBroker`
// (plan 06-08b — Valibot safeParse + 'Invalid DevtoolsBrokerConfig:' + D-30 anti-singleton).
//
// 6+ test:
//   - happy path default empty config
//   - happy path con devtools.enableByDefault
//   - Valibot fail prefix 'Invalid DevtoolsBrokerConfig:'
//   - D-30 anti-singleton (multi-tenant isolation)
//   - devtools.eventBufferSize shape
//   - devtools.maxLabelCombinations shape strict (>=1)
//
// Pattern carryover ESATTO da `packages/cache/src/public-factory.test.ts` (Wave 4a).

import { describe, expect, it } from 'vitest'
import { DevtoolsBroker } from './devtools-broker'
import { createDevtoolsBroker } from './public-factory'

describe('createDevtoolsBroker — Valibot factory + D-30 anti-singleton', () => {
  it('happy path empty config → istanza DevtoolsBroker', () => {
    const broker = createDevtoolsBroker({})
    expect(broker).toBeInstanceOf(DevtoolsBroker)
  })

  it('happy path con devtools.enableByDefault valid → istanza DevtoolsBroker', () => {
    const broker = createDevtoolsBroker({
      devtools: { enableByDefault: true, eventBufferSize: 200 },
    })
    expect(broker).toBeInstanceOf(DevtoolsBroker)
  })

  it('Valibot fail su devtools.eventBufferSize < 1 → throw con prefix Invalid DevtoolsBrokerConfig', () => {
    expect(() =>
      createDevtoolsBroker({
        devtools: { eventBufferSize: 0 },
      }),
    ).toThrowError(/Invalid DevtoolsBrokerConfig:/)
  })

  it('Valibot fail su devtools.maxLabelCombinations < 1 → throw', () => {
    expect(() =>
      createDevtoolsBroker({
        devtools: { maxLabelCombinations: 0 },
      }),
    ).toThrowError(/Invalid DevtoolsBrokerConfig:/)
  })

  it('Valibot fail su devtools.pauseQueueMaxSize < 1 → throw', () => {
    expect(() =>
      createDevtoolsBroker({
        devtools: { pauseQueueMaxSize: 0 },
      }),
    ).toThrowError(/Invalid DevtoolsBrokerConfig:/)
  })

  it('D-30 anti-singleton — istanze multiple isolate', () => {
    const a = createDevtoolsBroker({ devtools: { eventBufferSize: 100 } })
    const b = createDevtoolsBroker({ devtools: { eventBufferSize: 200 } })
    expect(a).not.toBe(b)
  })

  it('devtools.histogramSamples shape valid → istanza creata', () => {
    const broker = createDevtoolsBroker({ devtools: { histogramSamples: 512 } })
    expect(broker).toBeInstanceOf(DevtoolsBroker)
  })

  it('Valibot fail su devtools.histogramSamples < 1 → throw', () => {
    expect(() => createDevtoolsBroker({ devtools: { histogramSamples: 0 } })).toThrowError(
      /Invalid DevtoolsBrokerConfig:/,
    )
  })
})
