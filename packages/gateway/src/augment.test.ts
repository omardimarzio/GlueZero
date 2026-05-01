// augment.test.ts — verifica TS declaration merging F3 gateway (D-83/D-93/SEC-01..05).
//
// Test prevalentemente compile-time: se `augment.ts` non esegue correttamente il
// declaration merging, il typecheck di questo file fallisce (TS error 2339 "Property X
// does not exist on type Y" o 2322 "Type X is not assignable to Y").
//
// Test runtime minimal: `__augmentGatewayLoaded` const verifica che il side-effect import
// non venga tree-shaken e non lanci errori a load time (T-03-04-01 mitigation).
//
// Pattern F2 / F3-routing replicato (vedi packages/mapper/src/augment.test.ts e
// packages/routing/src/augment.test.ts).

import type { BrokerConfig } from '@sembridge/core'
import type { CanonicalSchemaId } from '@sembridge/mapper'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { __augmentGatewayLoaded } from './augment'
import type { GatewayConfig } from './http/types/gateway-config'

describe('augment.ts (F3 gateway TS declaration merging)', () => {
  it('runtime side-effect import is safe (no throw + tree-shake guard)', () => {
    expect(__augmentGatewayLoaded).toBe(true)
  })

  it('BrokerConfig has typed gateway field (compile-time, D-93)', () => {
    // Type-level assertion: dopo l'augmentation F3 gateway, la sezione `gateway` è
    // tipizzata `GatewayConfig | undefined` (chiude il placeholder F1).
    expectTypeOf<BrokerConfig>().toHaveProperty('gateway')
    expectTypeOf<BrokerConfig['gateway']>().toMatchTypeOf<GatewayConfig | undefined>()

    const cfg: BrokerConfig = {
      gateway: {
        allowlist: [/^\/api\//],
        auth: { getToken: async () => 'token' },
      },
    }

    expect(cfg.gateway).toBeDefined()
    expect(cfg.gateway?.allowlist).toHaveLength(1)
    expect(typeof cfg.gateway?.auth?.getToken).toBe('function')
  })

  it('BrokerConfig.gateway accepts full GatewayConfig shape (defaults + circuitBreaker)', () => {
    // Verifica che TUTTI i field di GatewayConfig (auth/allowlist/defaults/circuitBreaker)
    // siano accettati dal type augmentato, inclusa la variante `circuitBreaker: false`
    // (disabilitato — D-99 default).
    const cfgFull: BrokerConfig = {
      gateway: {
        auth: {
          getToken: async () => 'jwt-token',
          refresh: async () => 'new-jwt-token',
          tokenCacheMs: 30_000,
        },
        allowlist: ['https://api.example.com', /^https:\/\/cdn-[a-z]+\.example\.com\//],
        defaults: {
          timeout: 5000,
          retry: { maxAttempts: 3 },
        },
        circuitBreaker: { threshold: 5, cooldownMs: 30_000, halfOpenMaxRequests: 1 },
      },
    }
    expect(cfgFull.gateway?.auth?.tokenCacheMs).toBe(30_000)
    expect(cfgFull.gateway?.allowlist).toHaveLength(2)
    expect(cfgFull.gateway?.defaults?.timeout).toBe(5000)
    expect(cfgFull.gateway?.circuitBreaker).not.toBe(false)
    if (cfgFull.gateway?.circuitBreaker && cfgFull.gateway.circuitBreaker !== false) {
      expect(cfgFull.gateway.circuitBreaker.threshold).toBe(5)
    }

    // Variante con circuitBreaker: false (disabilitato)
    const cfgNoCb: BrokerConfig = {
      gateway: {
        auth: { getToken: async () => undefined },
        circuitBreaker: false,
      },
    }
    expect(cfgNoCb.gateway?.circuitBreaker).toBe(false)
  })

  it('BrokerConfig without gateway section still valid (backward-compat F1+F2)', () => {
    // La sezione `gateway` è opzionale — F1+F2 BrokerConfig senza gateway continua a
    // essere valido (T-03-04-01 mitigation: augmentation additive non-breaking).
    const cfg: BrokerConfig = {
      runtime: { debug: false },
      canonicalModel: { schemas: [] },
    }
    expect(cfg.gateway).toBeUndefined()
  })

  it('BrokerConfig.gateway coexists with routing/mapper sections (no collision, T-03-04-02)', () => {
    // Verifica che l'augment gateway F3 non collida con l'augment routing F3 (plan 03-03)
    // e con l'augment mapper F2. I tre augment lavorano sulla stessa interface
    // `BrokerConfig` ma su FIELD DISGIUNTI (gateway / routes+routing / canonicalModel+
    // aliasRegistry+transforms) — TS unifica le declaration merging additive.
    const cfgAll: BrokerConfig = {
      runtime: { debug: false },
      canonicalModel: {
        schemas: [
          {
            id: 'weather' as CanonicalSchemaId,
            fields: { location: { type: 'string', required: true } },
            requiresRoute: true,
          },
        ],
      },
      routes: [{ id: 'weather-local', type: 'local', topic: 'weather.requested' }],
      routing: { multipleRoutesPolicy: 'first-match' },
      gateway: {
        auth: { getToken: async () => 'token' },
        allowlist: ['https://api.example.com'],
      },
    }
    expect(cfgAll.canonicalModel?.schemas?.[0]?.id).toBe('weather')
    expect(cfgAll.routes?.[0]?.id).toBe('weather-local')
    expect(cfgAll.routing?.multipleRoutesPolicy).toBe('first-match')
    expect(cfgAll.gateway?.allowlist).toHaveLength(1)
  })
})
