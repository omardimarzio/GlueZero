// idempotency-strategy.ts — AutoIdempotency (D-70 default + chiusura SEC-03 + Pitfall 3 fix).
//
// Riferimento decisioni (03-CONTEXT.md):
// - D-70: Idempotency token (SEC-03) — per metodi POST/PATCH/PUT/DELETE, default
//   `idempotency: { mode: 'auto', headerName: 'Idempotency-Key' }` — auto-genera
//   nanoid() al first attempt; lo STESSO valore viene riusato sui retry (chiave:
//   stesso `BrokerEvent.id` di scatenamento). Il server è responsabile di
//   deduplicare per la chiave (precondizione documentata in DOC-04).
// - PRD §26.2: idempotency token uniformi.
// - PITFALLS #3: rotazione del token su retry causa server crea N risorse duplicate.
//   Mitigation: persistenza per eventId — la chiave generata al primo attempt è la
//   STESSA su tutti i retry.
//
// Pattern Strategy DI (D-68): default implementation di IdempotencyStrategy iniettata
// dal RouterBroker plan 03-12 nel HttpGateway.execute() via HttpGatewayStrategies bundle.
// Il gateway invoca `strategies.idempotency.generate(event.id)` UNA volta prima del
// retry loop — il header viene preservato sui retry attraverso lo stesso `init` object.
//
// Threat coverage:
// - T-03-09-01 (Repudiation — retry rigenera Idempotency-Key → server crea N ordini):
//   `Map<eventId, token>` persistenza garantita; Test 3 verifica 3 chiamate consecutive
//   con stesso eventId ritornano lo stesso token.
// - T-03-09-03 (DoS — Map cresce illimitato): FIFO bounded `maxEventsTracked: 1000`
//   default; quando il Map supera la soglia, drop oldest insertion (Map preserva
//   insertion order — eviction è FIFO, NON true-LRU. Vedi WR-04 fix iter 2:
//   per retry budget tipico ≤ 30s e maxTracked=1000, FIFO è sufficiente; true-LRU
//   richiederebbe touch-on-get che è overhead non motivato per V1).
// - T-03-08-04 RESEARCH (Spoofing — Idempotency-Key replay): nanoid 21-char ha
//   126-bit entropy → collision probability ~10^-19 anche su 10^9 chiavi. La chiave
//   è bound al BrokerEvent.id (a sua volta nanoid) — replay protection delegata al
//   server per design.

import { nanoid } from 'nanoid'
import type { IdempotencyStrategy } from '../types/http-strategies'

/**
 * Opzioni di configurazione per `createIdempotencyStrategy`.
 */
export interface IdempotencyStrategyOptions {
  /**
   * Nome del header HTTP per il token idempotency. Default: `'Idempotency-Key'`
   * (standard Stripe/AWS — supportato dalla maggior parte dei server idempotent).
   *
   * Override comuni:
   * - `'X-Idempotency-Key'` — preferito da alcune API legacy.
   * - `'Request-Id'` — alternativa semantica di alcune API REST.
   */
  readonly headerName?: string
  /**
   * Factory per generare un nuovo token (chiamata SOLO al first attempt per ogni
   * eventId). Default: `() => nanoid()` (21-char URL-safe, 126-bit entropy).
   *
   * Override usato per:
   * - Test determinismo (es. fixed token per assertion)
   * - UUID v4 invece di nanoid se policy stringente
   * - HMAC su payload se vincoli server lo richiedono
   */
  readonly tokenFactory?: () => string
  /**
   * Cap FIFO bounded della Map `eventId → token` per prevenire memory leak in
   * long-running client (T-03-09-03 mitigation). Default: `1000`.
   *
   * Quando il Map supera la soglia, viene rimosso l'entry più vecchio per
   * insertion order (`Map` JS preserva insertion order — eviction è FIFO, NON
   * true-LRU). WR-04 fix iter 2: rinominato da "LRU bounded" → "FIFO bounded"
   * per coerenza con il behavior reale. Cap appropriato perché il retry budget
   * tipico è di pochi secondi: non ha senso tracciare token molto vecchi.
   */
  readonly maxEventsTracked?: number
}

/**
 * Crea una `IdempotencyStrategy` con policy `AutoIdempotency` (D-70 default).
 *
 * Genera un Idempotency-Key (nanoid) **PERSISTENTE PER eventId** — riusato sui retry
 * (chiusura PITFALLS #3). Il server è responsabile di deduplicare per la chiave
 * (precondizione DOC-04).
 *
 * @example
 * ```ts
 * const idempotency = createIdempotencyStrategy()
 * const eventId = 'evt-123'
 * const t1 = idempotency.generate(eventId)  // genera nanoid
 * const t2 = idempotency.generate(eventId)  // STESSO token (Pitfall 3)
 * console.log(t1 === t2) // true
 * console.log(idempotency.headerName()) // 'Idempotency-Key'
 * ```
 *
 * @param options - Configurazione opzionale (vedi `IdempotencyStrategyOptions`).
 * @returns Istanza `IdempotencyStrategy` con `generate(eventId)` + `headerName()`.
 */
export function createIdempotencyStrategy(
  options: IdempotencyStrategyOptions = {},
): IdempotencyStrategy {
  const headerName = options.headerName ?? 'Idempotency-Key'
  const tokenFactory = options.tokenFactory ?? ((): string => nanoid())
  const maxTracked = options.maxEventsTracked ?? 1000
  // Map<eventId, token> — JS Map preserva insertion order per FIFO eviction.
  const tokenByEventId = new Map<string, string>()

  return {
    generate(eventId: string): string {
      // Persistence (Pitfall 3): se l'eventId ha già un token, ritorna quello esistente.
      const existing = tokenByEventId.get(eventId)
      if (existing !== undefined) return existing
      // First attempt: genera nuovo token.
      const token = tokenFactory()
      tokenByEventId.set(eventId, token)
      // FIFO bounded (T-03-09-03 mitigation, WR-04 doc-rename iter 2): drop oldest
      // se supera maxTracked. `Map.keys().next().value` ritorna il primo entry
      // (oldest insertion). NB: NON true-LRU (no touch-on-get) — sufficient per V1
      // dato il retry budget tipico ≤ 30s.
      if (tokenByEventId.size > maxTracked) {
        const firstKey = tokenByEventId.keys().next().value
        if (firstKey !== undefined) tokenByEventId.delete(firstKey)
      }
      return token
    },
    headerName(): string {
      return headerName
    },
  }
}
