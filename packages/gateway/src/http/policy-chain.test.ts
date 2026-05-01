// policy-chain.test.ts — copre Koa-compose helper async middleware (RESEARCH §Pattern 3).
//
// Behavior coperti (4 test):
// 1. 3 middleware async chained: pre-process → next → post-process in ordine corretto.
// 2. next() chiamato due volte → throw 'next() called multiple times'.
// 3. Middleware short-circuit (no next): downstream NON eseguito.
// 4. Empty array: chain risolve subito senza errori.

import { describe, expect, it } from 'vitest'
import { compose } from './policy-chain'
import type { GatewayContext, GatewayMiddleware } from './types/http-strategies'

function makeCtx(): GatewayContext {
  // Helper minimale per i test: solo i field richiesti dalla type, runtime opaco.
  return {
    request: { method: 'GET', url: '/x', headers: {} },
    route: { id: 'r-1', type: 'local', topic: 't.requested' },
    event: {
      id: 'e-1',
      topic: 't.requested',
      timestamp: 0,
      payload: {},
      source: { type: 'plugin', id: 'p1' },
      metadata: {},
    },
    signal: new AbortController().signal,
    attempt: 1,
  } as GatewayContext
}

describe('policy-chain.ts (Koa-compose — RESEARCH §Pattern 3)', () => {
  it('runs 3 async middlewares in order with pre/post phases around next()', async () => {
    const trace: string[] = []
    const m1: GatewayMiddleware = async (_ctx, next) => {
      trace.push('m1-pre')
      await next()
      trace.push('m1-post')
    }
    const m2: GatewayMiddleware = async (_ctx, next) => {
      trace.push('m2-pre')
      await next()
      trace.push('m2-post')
    }
    const m3: GatewayMiddleware = async (_ctx, next) => {
      trace.push('m3-pre')
      await next()
      trace.push('m3-post')
    }
    await compose([m1, m2, m3])(makeCtx())
    expect(trace).toEqual(['m1-pre', 'm2-pre', 'm3-pre', 'm3-post', 'm2-post', 'm1-post'])
  })

  it('throws when next() is called multiple times in a single middleware', async () => {
    const evil: GatewayMiddleware = async (_ctx, next) => {
      await next()
      await next() // illegal — viola contract Koa-compose
    }
    await expect(compose([evil])(makeCtx())).rejects.toThrow(/next\(\) called multiple times/)
  })

  it('short-circuits when middleware does not invoke next()', async () => {
    const trace: string[] = []
    const m1: GatewayMiddleware = async (_ctx, next) => {
      trace.push('m1-pre')
      await next()
      trace.push('m1-post')
    }
    const m2: GatewayMiddleware = async (_ctx, _next) => {
      trace.push('m2-stop')
      // intenzionale NO next() — chain interrotta
    }
    const m3: GatewayMiddleware = async (_ctx, next) => {
      trace.push('m3-pre')
      await next()
      trace.push('m3-post')
    }
    await compose([m1, m2, m3])(makeCtx())
    expect(trace).toEqual(['m1-pre', 'm2-stop', 'm1-post'])
    expect(trace).not.toContain('m3-pre')
  })

  it('handles empty middleware array without error', async () => {
    await expect(compose([])(makeCtx())).resolves.toBeUndefined()
  })
})
