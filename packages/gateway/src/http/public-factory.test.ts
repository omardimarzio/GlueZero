// public-factory.test.ts — copre createHttpGateway Valibot validation (D-72/D-99).
//
// 3 test:
// 1. config valida con allowlist + auth → ritorna HttpGateway.
// 2. config con auth function getToken/refresh + tokenCacheMs → accettata.
// 3. config invalida (allowlist tipo errato) → throw 'Invalid GatewayConfig'.

import { describe, expect, it } from 'vitest'
import { HttpGateway } from './http-gateway'
import { createHttpGateway } from './public-factory'

describe('createHttpGateway (Valibot validation — D-72/D-99)', () => {
  it('returns HttpGateway instance with valid allowlist + auth config', () => {
    const gw = createHttpGateway({
      allowlist: [/^\/api\//, 'https://api.example.com'],
      auth: { getToken: async () => 'tok' },
    })
    expect(gw).toBeInstanceOf(HttpGateway)
  })

  it('accepts full auth config with refresh + tokenCacheMs', () => {
    const gw = createHttpGateway({
      auth: {
        getToken: async () => 'jwt',
        refresh: async () => 'new-jwt',
        tokenCacheMs: 30_000,
      },
      defaults: { timeout: 5000 },
      circuitBreaker: { threshold: 5, cooldownMs: 30_000 },
    })
    expect(gw).toBeInstanceOf(HttpGateway)
  })

  it('throws Invalid GatewayConfig on schema validation fail', () => {
    expect(() => createHttpGateway({ allowlist: 'not-an-array' as unknown as undefined })).toThrow(
      /Invalid GatewayConfig/,
    )
  })
})
