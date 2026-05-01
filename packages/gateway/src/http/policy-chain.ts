// policy-chain.ts — Koa-style compose async middleware (RESEARCH §Pattern 3).
//
// Riferimento decisioni (03-CONTEXT.md):
// - D-68: Strategy Pattern + Chain of Responsibility per le 6 policy del gateway HTTP.
//   Il `HttpGateway` (plan 03-08 Task 2) compone le strategie come middleware Koa-style.
// - RESEARCH §Pattern 3 (lines 555-568): minimal allocation per request — closures bound
//   al construct, ctx mutabile in-place, no array allocation per attempt.
//
// Pattern: ogni middleware riceve `(ctx, next)`. Il middleware:
//   1. Pre-process (es. inject `Authorization` header, generate `Idempotency-Key`).
//   2. `await next()` per delegare alla chain downstream.
//   3. Post-process (es. parse response, recordSuccess su circuit breaker).
//
// Invariants:
// - `next()` può essere chiamato AL MASSIMO una volta per middleware (throw altrimenti).
// - Un middleware che NON chiama `next()` short-circuita la chain: i middleware downstream
//   non eseguono, ma i post-process degli upstream sì (LIFO).
// - Empty array → resolve immediato senza errori.
//
// Threat coverage:
// - T-03-08-04 (DoS — middleware ricorsivo via next() multiple): mitigate via index check
//   `if (i <= index) throw` — semantic Koa ufficiale.

import type { GatewayContext, GatewayMiddleware } from './types/http-strategies'

/**
 * Compone N `GatewayMiddleware` in un singolo invocabile `(ctx) => Promise<void>`
 * (Koa-style — RESEARCH §Pattern 3).
 *
 * Allocation budget: la `dispatch` closure è creata UNA volta per request (factory
 * `compose` ritorna la closure all'invocazione). Il `index` mutabile evita array
 * allocation per attempt.
 *
 * @param middlewares - Array readonly di middleware. Empty array → no-op chain.
 * @returns Funzione `(ctx) => Promise<void>` che esegue la chain in ordine.
 * @throws `Error('next() called multiple times')` se un middleware viola il contract Koa.
 *
 * @example
 * ```ts
 * const chain = compose([allowlistMw, authMw, idempotencyMw, retryMw, fetchMw])
 * await chain(ctx)
 * ```
 */
export function compose(
  middlewares: readonly GatewayMiddleware[],
): (ctx: GatewayContext) => Promise<void> {
  return async (ctx) => {
    let index = -1
    const dispatch = async (i: number): Promise<void> => {
      if (i <= index) throw new Error('next() called multiple times')
      index = i
      const fn = middlewares[i]
      if (!fn) return
      await fn(ctx, () => dispatch(i + 1))
    }
    return dispatch(0)
  }
}
