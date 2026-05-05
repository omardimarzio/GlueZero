// auth-strategy.ts — BearerHookAuth (D-72 default + chiusura SEC-01/SEC-02/ROUTE-07 + Pitfall 5).
//
// Wrapper su gateway.auth.getToken/refresh consumer-provided con SINGLE-FLIGHT REFRESH
// (Pattern 5 RESEARCH lines 671-694, Pitfall 5 fix): N caller concurrent ricevono UNA SOLA
// config.refresh invocation. Use case canonico:
//   5 fetch parallele → 5 risposte 401 → 5 chiamate auth.refresh() in parallelo
//   → SOLO 1 invocazione effettiva di config.refresh, tutte coordinano sulla stessa Promise
//
// Riferimento decisioni (03-CONTEXT.md):
// - D-72: Auth Bearer + token refresh (SEC-01/SEC-02/ROUTE-07). gateway.auth.getToken
//         chiamato prima di ogni fetch (cache opzionale via tokenCacheMs). Su 401,
//         opzionalmente gateway.auth.refresh chiamato UNA VOLTA via single-flight.
// - D-83: ZERO modifiche a packages/core/ runtime — usiamo solo l'API pubblica
//         createBrokerError + ErrorCategory esistente ('config').
// - PITFALLS #5 (RESEARCH lines 786-790): "Token refresh storm — 401 cluster causes
//         N parallel refresh, each invalidating others". Single-flight Promise singleton
//         risolve.
//
// BLOCKER 1 fix iter 1 (revision pre-execute):
// - ErrorCategory union (`packages/core/src/types/error.ts`) NON include 'auth':
//   `'validation' | 'plugin' | 'mapping' | 'route' | 'network' | 'worker' | 'system' | 'config' | 'topic'`.
// - Per evitare modifica core (D-83 strict), usiamo `category: 'config'` per
//   `auth.refresh.unavailable` — coerente con plan 03-08 (gateway-config errors).
//
// Threat coverage:
// - T-03-11-01 (DoS Token refresh storm): single-flight via inflightRefresh Promise
//   singleton — N caller → 1 sola invocazione config.refresh.
// - T-03-11-03 (Information Disclosure): createBrokerError NON include token nel
//   message (solo code+message generico).

import { createBrokerError } from '@gluezero/core'
import type { AuthStrategyConfig } from '../types/gateway-config'
import type { AuthStrategy } from '../types/http-strategies'

/**
 * Opzioni di configurazione per `createAuthStrategy`.
 */
export interface AuthStrategyOptions {
  /**
   * Configurazione dell'auth (D-72) — `getToken` + `refresh?` + `tokenCacheMs?`.
   * Vedi `AuthStrategyConfig` in `gateway-config.ts`.
   */
  readonly config: AuthStrategyConfig
}

/**
 * Crea una `AuthStrategy` con policy `BearerHook` (D-72 default).
 *
 * Wrapper su `config.getToken`/`config.refresh` consumer-provided. Il refresh implementa
 * single-flight (Pattern 5 RESEARCH, Pitfall 5 fix): N caller concurrent ricevono UNA SOLA
 * `config.refresh()` invocation, tutti coordinano via Promise singleton condivisa.
 *
 * Quando `config.refresh` è undefined, il method `refresh()` throw `BrokerError`
 * `auth.refresh.unavailable` con `category: 'config'` (NON 'auth' — l'union non lo include
 * e D-83 vieta modifica core; vedi BLOCKER 1 fix iter 1).
 *
 * @example
 * ```ts
 * const auth = createAuthStrategy({
 *   config: {
 *     getToken: async () => storage.get('jwt') ?? undefined,
 *     refresh: async () => fetch('/auth/refresh').then((r) => r.text()),
 *     tokenCacheMs: 30_000,
 *   },
 * })
 *
 * // 5 fetch su 401 chiamano auth.refresh() in parallelo
 * // → 1 sola config.refresh invocata, tutti ricevono lo stesso nuovo token
 * const tokens = await Promise.all([
 *   auth.refresh(), auth.refresh(), auth.refresh(), auth.refresh(), auth.refresh(),
 * ])
 * ```
 *
 * @param options - Configurazione (vedi `AuthStrategyOptions`).
 * @returns Istanza `AuthStrategy` con `getToken`, `refresh` (always-provide), `isInflightRefresh`.
 */
export function createAuthStrategy(options: AuthStrategyOptions): AuthStrategy {
  const { config } = options
  const tokenCacheMs = config.tokenCacheMs ?? 0
  let cachedToken: string | undefined
  let cachedAt = 0
  // Single-flight Promise singleton (Pattern 5 RESEARCH).
  // Quando non-null, una refresh è in volo — i caller successivi ricevono questa Promise.
  let inflightRefresh: Promise<string> | null = null

  return {
    async getToken(): Promise<string | undefined> {
      // Cache hit: ritorna token cached se entro la finestra tokenCacheMs.
      if (tokenCacheMs > 0 && cachedToken !== undefined && Date.now() - cachedAt < tokenCacheMs) {
        return cachedToken
      }
      // Cache miss / disabled: invoca config.getToken consumer-provided.
      const token = await config.getToken()
      // Popola cache solo se tokenCacheMs > 0 e token definito.
      if (token !== undefined && tokenCacheMs > 0) {
        cachedToken = token
        cachedAt = Date.now()
      }
      return token
    },

    async refresh(): Promise<string> {
      // Always-provide pattern (vedi action plan): refresh method sempre presente,
      // throw se config.refresh undefined. Coerente con interface AuthStrategy.refresh?.
      if (!config.refresh) {
        throw createBrokerError({
          code: 'auth.refresh.unavailable',
          // BLOCKER 1 fix iter 1: ErrorCategory union NON include 'auth' — usiamo 'config'
          // coerente con plan 03-08 (gateway-config errors). D-83 vieta modifica core.
          category: 'config',
          message: 'config.auth.refresh is not configured',
        })
      }
      // Single-flight: caller con refresh in volo ricevono la Promise singleton.
      // (Pattern 5 RESEARCH: SingleFlightRefresh — N → 1.)
      if (inflightRefresh !== null) return inflightRefresh
      // Avvolgi refresh in IIFE async con cleanup in finally — sia su success che failure.
      // Cleanup garantisce che i caller successivi al settle invochino di nuovo config.refresh.
      inflightRefresh = (async (): Promise<string> => {
        try {
          // Non-null assertion safe: il guard sopra ha già verificato config.refresh definito.
          // biome-ignore lint/style/noNonNullAssertion: guarded by `if (!config.refresh) throw` above
          const newToken = await config.refresh!()
          // Aggiorna cache con il nuovo token (i fetch successivi useranno questo).
          cachedToken = newToken
          cachedAt = Date.now()
          return newToken
        } finally {
          // Release flag — sia su resolve che reject. Garantisce che caller successivi
          // chiamino config.refresh nuovamente (Test 7 + Test 8 verificano).
          inflightRefresh = null
        }
      })()
      return inflightRefresh
    },

    isInflightRefresh(): boolean {
      // Flag per Inspector debug (F6) e per skip refresh ricorsivo da middleware.
      return inflightRefresh !== null
    },
  }
}
