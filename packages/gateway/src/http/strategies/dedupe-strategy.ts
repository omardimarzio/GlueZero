// dedupe-strategy.ts — KeyBasedDedupe (D-74, ROUTE-11 chiusura).
//
// Promise singleton per key: N caller concurrent con stessa key ricevono la STESSA
// Promise. Pattern: Map<key, Promise>. Entry rilasciata in finally — sia su success
// che failure (no leak).
//
// Use case canonico (PRD §39 #11 / RESEARCH §"Pattern 5 SingleFlightRefresh"):
//   GET /api/weather?city=Roma con dedupeKey 'weather:Roma' chiamato 5 volte
//   contemporaneamente → 1 sola fetch HTTP, 5 caller ricevono stesso payload.
//
// Riferimento decisioni (03-CONTEXT.md):
// - D-74: DedupeStrategy con Promise singleton condiviso (RESEARCH "Code Examples").
//         Default implementation `KeyBased` su `Map<key, Promise<T>>`. `clear()`
//         invocato al cascade unregister (D-86).
// - Pattern Strategy DI (D-68): factory `createDedupeStrategy` ritorna istanza che
//         implementa interface `DedupeStrategy` — agnostica all'engine HttpGateway.
//
// Threat coverage:
// - T-03-10-01 (DoS — Map cresce illimitato): cap `maxInflight` default 1000, su
//   overflow esegue diretto senza dedupe (graceful degradation, no throw).

import type { DedupeStrategy } from '../types/http-strategies'

/**
 * Opzioni di configurazione per `createDedupeStrategy`.
 *
 * Tutti i campi opzionali con default sensati per V1 GlueZero.
 */
export interface DedupeStrategyOptions {
  /**
   * Cap massimo di entries inflight contemporanee. Default: 1000.
   *
   * Quando il Map raggiunge `maxInflight`, le nuove `execute` chiamano `fn` direttamente
   * senza dedupe (graceful degradation — no throw, no DoS auto-inflitto).
   *
   * Threat coverage: T-03-10-01 (DoS — Map cresce illimitato).
   */
  readonly maxInflight?: number
}

/**
 * Crea una `DedupeStrategy` con policy `KeyBased` (D-74 default).
 *
 * Promise singleton: due caller con stessa `key` in volo collassano in una sola
 * invocazione di `fn`; entrambi ricevono la stessa Promise. La entry viene rilasciata
 * in `finally` — sia su success che failure — garantendo no leak.
 *
 * @example
 * ```ts
 * const dedupe = createDedupeStrategy({ maxInflight: 1000 })
 *
 * // 5 caller concurrent con stessa key → 1 sola fn invocation
 * const promises = Array.from({ length: 5 }, () =>
 *   dedupe.execute('weather:Roma', () => fetch('/api/weather?city=Roma').then(r => r.json()))
 * )
 * const results = await Promise.all(promises) // tutti ricevono stesso payload
 * ```
 *
 * @param options - Configurazione (vedi `DedupeStrategyOptions`).
 * @returns Istanza `DedupeStrategy` con `execute` + `size` + `clear`.
 */
export function createDedupeStrategy(options: DedupeStrategyOptions = {}): DedupeStrategy {
  const maxInflight = options.maxInflight ?? 1000
  // Map<string, Promise<unknown>> — Promise singleton condiviso per key.
  // Pattern Pitfall 5 RESEARCH: SingleFlightRefresh.
  const inflight = new Map<string, Promise<unknown>>()

  return {
    async execute<T>(key: string, fn: () => Promise<T>): Promise<T> {
      // Singleton hit: caller con stessa key riceve la Promise già in volo.
      const existing = inflight.get(key)
      if (existing !== undefined) {
        return existing as Promise<T>
      }
      // Cap di sicurezza: oltre il limite, esegui diretto senza dedupe.
      // Graceful degradation (no throw) — il caller riceve comunque il risultato.
      // Threat T-03-10-01 mitigation.
      if (inflight.size >= maxInflight) {
        return await fn()
      }
      // Avvolgi `fn` in una Promise che rilascia la entry in `finally` (success o failure).
      // L'IIFE async garantisce che la cleanup avvenga PRIMA che la Promise risolva al caller,
      // ma è anche fondamentale che la rejection NON sia swallowed: rethrow implicito via
      // try/finally (no catch).
      const promise = (async () => {
        try {
          return await fn()
        } finally {
          inflight.delete(key)
        }
      })()
      inflight.set(key, promise)
      return promise as Promise<T>
    },
    size(): number {
      return inflight.size
    },
    clear(): void {
      // Reset esplicito — utile su cascade unregister plugin (D-86) o su test cleanup.
      // Le Promise inflight non vengono cancellate (non c'è AbortController nel contratto
      // DedupeStrategy), ma le entry vengono rimosse dal Map: caller successivi con
      // stesse key invocheranno fn nuovamente.
      inflight.clear()
    },
  }
}
