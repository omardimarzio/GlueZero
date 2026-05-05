/**
 * F6 ReservoirSampling — Algorithm R (Vitter 1985) inline ~30 LOC.
 *
 * Reservoir mantiene cap N samples uniform-random da uno stream illimitato.
 * Trade-off vs t-digest: ~5% errore p50/p90/p99 vs ~1% (RESEARCH §8.1) ma
 * zero deps + ~30 LOC vs +3-5 KB minified. V1.x se profiling richiede p999.
 *
 * **Alternative valutate (RESEARCH §8.1):**
 * - `t-digest` 0.1.2 → RIGETTATO (deps overhead non giustificato per V1)
 * - Fixed array drop-oldest → RIGETTATO (bias verso recenti, distorce quantili)
 * - Reservoir Algorithm R → ADOPTED (D-165: ~30 LOC inline, math sound, no deps)
 *
 * **Naming convention plan 06-06:**
 * - `createReservoir(capacity)` — factory state
 * - `reservoirAdd(state, value)` — accumula sample
 * - `computeSummary(state)` — calcola HistogramSummary on-demand
 *
 * @see [Vitter 1985 ACM Trans. Math. Software 11(1)] (cite C2)
 * @see RESEARCH §8 reservoir sampling Algorithm R vs t-digest
 * @see CONTEXT D-165
 */

import type { HistogramSummary } from './types/metrics'

/**
 * Stato mutabile del reservoir.
 *
 * - `samples`: array `length === capacity`, indici `[0, min(count, capacity))` validi.
 * - `capacity`: cap massima samples retenuti (default 1024 in MetricsCollector).
 * - `count`: total observations dal boot (NON capped — usato per algorithm + summary).
 * - `sum`: somma cumulativa per `HistogramSummary.sum`.
 */
export interface ReservoirState {
  readonly samples: number[]
  readonly capacity: number
  count: number
  sum: number
}

/**
 * Inizializza un reservoir vuoto con `capacity` slots pre-allocati.
 *
 * @param capacity numero massimo di samples retenuti (D-165 default consumer 1024).
 * @returns `ReservoirState` mutable, count=0, sum=0.
 */
export function createReservoir(capacity: number): ReservoirState {
  return { samples: new Array(capacity), capacity, count: 0, sum: 0 }
}

/**
 * Aggiunge un sample al reservoir secondo Algorithm R.
 *
 * **Algoritmo:**
 * 1. Incrementa `sum` (sempre, regardless of fase).
 * 2. Se `count < capacity` (fase **fill**): assegna `samples[count] = value` direttamente.
 * 3. Altrimenti (fase **replace**): genera `j = floor(random * (count+1))`. Se `j < capacity`,
 *    sostituisce `samples[j] = value`. Altrimenti scarta.
 * 4. Incrementa `count` (cumulative, NON capped).
 *
 * Probabilità che il valore corrente sia trattenuto = `capacity / (count+1)` →
 * distribuzione uniforme su tutto lo stream (proprietà fondamentale Algorithm R).
 *
 * **Note T-06-06-05:** `Math.random()` non-cryptographic, ma cache-reservoir non
 * sensibile a entropia. Test usa `vi.spyOn(Math, 'random')` per determinismo.
 */
export function reservoirAdd(state: ReservoirState, value: number): void {
  state.sum += value
  if (state.count < state.capacity) {
    // Fase fill — riempi gli slots in ordine
    state.samples[state.count] = value
    state.count++
  } else {
    // Fase replace — Algorithm R Vitter 1985
    const j = Math.floor(Math.random() * (state.count + 1))
    if (j < state.capacity) {
      state.samples[j] = value
    }
    state.count++
  }
}

/**
 * Calcola `HistogramSummary { count, sum, p50, p90, p99 }` on-demand dallo state.
 *
 * **Note quantile pick:**
 * - `n = min(count, capacity)` — solo i samples effettivamente in `samples[]`.
 * - `pickIdx(p) = min(n-1, floor(n*p))` — clamp evita out-of-bounds quando `p=1.0`.
 * - `count` ritornato = total observations (NON `n`!), per esposizione cumulative
 *   accurata simil-Prometheus `<metric>_count`.
 * - `sum` ritornato = sum di TUTTI i sample osservati (non solo i retenuti),
 *   per `<metric>_sum` Prometheus accurate average computation.
 *
 * @returns `HistogramSummary { count, sum, p50, p90, p99 }`. Edge case n=0 → tutti 0.
 */
export function computeSummary(state: ReservoirState): HistogramSummary {
  const n = Math.min(state.count, state.capacity)
  if (n === 0) return { count: 0, sum: 0, p50: 0, p90: 0, p99: 0 }
  const sorted = state.samples.slice(0, n).sort((a, b) => a - b)
  const pickIdx = (p: number): number => Math.min(n - 1, Math.floor(n * p))
  return {
    count: state.count,
    sum: state.sum,
    p50: sorted[pickIdx(0.5)] ?? 0,
    p90: sorted[pickIdx(0.9)] ?? 0,
    p99: sorted[pickIdx(0.99)] ?? 0,
  }
}
