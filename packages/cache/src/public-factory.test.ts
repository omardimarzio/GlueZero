// public-factory.test.ts — Tier-1 jsdom test deterministici per `createCacheBroker`
// (plan 06-08a — Valibot safeParse + 'Invalid CacheBrokerConfig:' + D-30 anti-singleton).
//
// 6+ test:
//   - happy path default empty config
//   - happy path con cacheRoutes
//   - Valibot fail prefix 'Invalid CacheBrokerConfig:'
//   - D-30 anti-singleton (multi-tenant isolation)
//   - cache.maxEntries shape
//   - cacheRoutes shape strict (strategy literal)
//
// Pattern carryover ESATTO da `packages/worker/src/public-factory.test.ts`.

import { describe, expect, it } from 'vitest'
import { CacheBroker } from './cache-broker'
import { createCacheBroker } from './public-factory'

describe('createCacheBroker — Valibot factory + D-30 anti-singleton', () => {
  it('happy path empty config → istanza CacheBroker', () => {
    const broker = createCacheBroker({})
    expect(broker).toBeInstanceOf(CacheBroker)
  })

  it('happy path con cacheRoutes valid → istanza CacheBroker', () => {
    const broker = createCacheBroker({
      cacheRoutes: [
        {
          type: 'cache',
          id: 'r1',
          topic: 'weather.requested',
          strategy: 'cache-first',
          ttl: 60_000,
        },
      ],
    })
    expect(broker).toBeInstanceOf(CacheBroker)
  })

  it('Valibot fail su strategy invalida → throw con prefix Invalid CacheBrokerConfig', () => {
    expect(() =>
      createCacheBroker({
        cacheRoutes: [
          {
            type: 'cache',
            id: 'r-bad',
            topic: 'bad.topic',
            // @ts-expect-error invalid literal
            strategy: 'unknown-strategy',
          },
        ],
      }),
    ).toThrowError(/Invalid CacheBrokerConfig:/)
  })

  it('Valibot fail su id empty → throw con prefix Invalid CacheBrokerConfig', () => {
    expect(() =>
      createCacheBroker({
        cacheRoutes: [
          {
            type: 'cache',
            id: '',
            topic: 'foo.bar',
            strategy: 'cache-first',
          },
        ],
      }),
    ).toThrowError(/Invalid CacheBrokerConfig:/)
  })

  it('D-30 anti-singleton — istanze multiple isolate', () => {
    const a = createCacheBroker({ cache: { maxEntries: 10 } })
    const b = createCacheBroker({ cache: { maxEntries: 20 } })
    expect(a).not.toBe(b)
    // Stats indipendenti
    expect(a.getCacheStats().entries).toBe(0)
    expect(b.getCacheStats().entries).toBe(0)
  })

  it('cache.maxEntries shape valid → istanza creata', () => {
    const broker = createCacheBroker({ cache: { maxEntries: 250 } })
    expect(broker).toBeInstanceOf(CacheBroker)
  })

  it('Valibot fail cache.maxEntries < 1 → throw', () => {
    expect(() => createCacheBroker({ cache: { maxEntries: 0 } })).toThrowError(
      /Invalid CacheBrokerConfig:/,
    )
  })
})
