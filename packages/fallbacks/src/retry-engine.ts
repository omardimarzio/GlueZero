/**
 * `RetryEngine` — Counter `Map<{mfId,phase}, attempts>` + 3-mode backoff
 * (none/linear/exponential PRD §29.3 verbatim) + ±20% jitter (D-V2-F14-09).
 *
 * Pattern Rule 2 stretto carryover da
 * `packages/gateway/src/http/strategies/retry-strategy.ts` (F3 AWS full jitter
 * formula). F14 adatta a ±20% conservativo per browser context.
 *
 * **Diff F3 → F14 (key axis):**
 * - **Key**: `mfId+phase` (composto template `${mfId}::${phase}`) invece di `routeId`
 *   single key F3. Isolation per-MF + per-phase: mfA mount-counter NON interferisce
 *   con mfB load-counter (verified in test).
 * - **Backoff**: `none`/`linear`/`exponential` PRD §29.3 verbatim vs F3 exponential
 *   locked. `'none'` = costante (delayMs), `'linear'` = `base*(attempt+1)`,
 *   `'exponential'` = `base*2^attempt`.
 * - **Jitter**: ±20% conservativo (`factor = 0.8 + Math.random() * 0.4`) vs F3 ±50%
 *   AWS full. Range `[base*0.8, base*1.2)` perché `Math.random() ∈ [0, 1)`.
 *   Distribuzione uniforme — mitigation P-01 retry storm thundering herd.
 * - **Trigger**: caller invoca `mfService.<op>(mfId)` (W2 P04 wire reale) — engine
 *   è puro counter + computation, NO direct I/O.
 *
 * **D-V2-F14-09**: applicabile a tutti i 6 `FallbackPolicy.onXError` scope; default
 * `{attempts:1}` (no retry) globalmente; per-phase override via
 * `FallbackDefinition.retry?`. Skip retry per `runtime`/`update` heuristica
 * D-V2-F14-08 (recoverable:false default — F8 NON espone trigger API per quelle 2
 * phase, OQ-1 verified 5 ops: `load/bootstrap/mount/unmount/destroy`).
 *
 * **D-V2-F14-10**: retry trigger via `mfService.<op>(mfId)` API pubblica F8
 * (NO `attemptX(mfId, X)` con counter esposto pubblicamente — counter è privato
 * a engine).
 *
 * **Anti-singleton D-30**: ogni `createRetryEngine()` ritorna istanza isolata.
 *
 * @see prd_2.0.0.md §29.3 — RetryPolicy spec
 * @see D-V2-F14-09 — Retry scope + ±20% jitter
 * @see D-V2-F14-10 — Retry trigger via mfService.<op> API pubblica (5 ops)
 * @see packages/gateway/src/http/strategies/retry-strategy.ts (F3 reference template)
 */
import type { MicroFrontendErrorLifecyclePhase } from './types/errors.js'
import type { RetryPolicy } from './types/policy.js'

/**
 * Key composta `${mfId}::${phase}` per Map counter — template literal type
 * preserva type-safety su lookup (no `string` opaco).
 */
type RetryKey = `${string}::${MicroFrontendErrorLifecyclePhase}`

/**
 * Helper composizione key: `${mfId}::${phase}`.
 *
 * Separator `::` (doppio colon) scelto perché:
 * 1. Non puo apparire in `mfId` valido (PRD vincola a `[a-z0-9-]`).
 * 2. Non puo apparire in `MicroFrontendErrorLifecyclePhase` (union 7 literal letterali).
 * 3. Visivamente distinguibile in test failure / debug logs.
 */
function makeKey(
  mfId: string,
  phase: MicroFrontendErrorLifecyclePhase,
): RetryKey {
  return `${mfId}::${phase}` as RetryKey
}

/**
 * API stabile `RetryEngine` per consumer W2 P04 (factory `fallbacksModule.install` wire).
 *
 * 5 methods (no public counter access — encapsulation):
 * - `computeDelay`: calcolo puro (no side effect).
 * - `incrementAttempt` / `getAttempts` / `resetCounter` / `shouldRetry`: counter ops.
 *
 * @example Usage da error subscriber callback (W2 P04 pseudo-code)
 * ```ts
 * const engine = createRetryEngine()
 * // Da error subscriber:
 * if (engine.shouldRetry(mfId, phase, policy)) {
 *   const attempt = engine.getAttempts(mfId, phase)
 *   const delay = engine.computeDelay(attempt, policy)
 *   await new Promise(r => setTimeout(r, delay))
 *   engine.incrementAttempt(mfId, phase)
 *   await mfService[phase](mfId)  // OQ-1 verified: 5 ops
 * }
 * // On success (post microfrontend.recovered emit):
 * engine.resetCounter(mfId, phase)
 * ```
 */
export interface RetryEngine {
  /**
   * Calcola delay (ms) per `attempt` corrente secondo `policy.backoff` + opzionale jitter.
   *
   * Formula:
   * - `'none'`: `delay = delayMs ?? 0` (costante).
   * - `'linear'`: `delay = base * (attempt + 1)` — crescita lineare.
   * - `'exponential'`: `delay = base * 2^attempt` — crescita esponenziale.
   *
   * Jitter applicato post-backoff se `policy.jitter === true`:
   * `factor = 0.8 + Math.random() * 0.4`, `delay = delay * factor` (range ±20%).
   *
   * Output sempre intero (`Math.floor` applicato per coerenza setTimeout API).
   *
   * @param attempt Indice tentativo 0-based (0 = primo retry post-fail).
   * @param policy Politica retry da consumer (`descriptor.fallback.retry` o module default).
   * @returns Delay in ms (intero ≥ 0).
   */
  readonly computeDelay: (attempt: number, policy: RetryPolicy) => number

  /**
   * Incrementa contatore per `(mfId, phase)`. Ritorna il nuovo valore.
   *
   * Counter è privato (`Map<RetryKey, number>` interno) — accesso solo via questa API.
   *
   * @param mfId MicroFrontend ID target (matching `microFrontendId` descriptor).
   * @param phase Lifecycle phase su cui retry è triggerato.
   * @returns Nuovo count (1 al primo increment, 2 al secondo, ecc.).
   */
  readonly incrementAttempt: (
    mfId: string,
    phase: MicroFrontendErrorLifecyclePhase,
  ) => number

  /**
   * Legge contatore corrente per `(mfId, phase)`. Default `0` se mai incrementato.
   *
   * @param mfId MicroFrontend ID target.
   * @param phase Lifecycle phase.
   * @returns Count corrente (0 se key non in Map).
   */
  readonly getAttempts: (
    mfId: string,
    phase: MicroFrontendErrorLifecyclePhase,
  ) => number

  /**
   * Reset contatore per `(mfId, phase)`. No-op se key inesistente.
   *
   * Chiamato da W2 P04 dispatch chain post `microfrontend.recovered` emit
   * (success path — retry esaurito o lifecycle phase completata).
   *
   * @param mfId MicroFrontend ID target.
   * @param phase Lifecycle phase.
   */
  readonly resetCounter: (
    mfId: string,
    phase: MicroFrontendErrorLifecyclePhase,
  ) => void

  /**
   * Predicato: retry ammesso? `true` se `counter < policy.attempts`.
   *
   * - `attempts:1` → 0 retry (default no-retry: counter parte da 0, primo
   *   increment lo porta a 1 → exhausted).
   * - `attempts:3` → 2 retry (counter 0/1/2 OK, 3 exhausted).
   *
   * @param mfId MicroFrontend ID.
   * @param phase Lifecycle phase.
   * @param policy Politica retry (per `attempts` field).
   * @returns `true` se retry possibile, `false` se exhausted.
   */
  readonly shouldRetry: (
    mfId: string,
    phase: MicroFrontendErrorLifecyclePhase,
    policy: RetryPolicy,
  ) => boolean
}

/**
 * Factory `RetryEngine` — Crea istanza isolata con `Map<RetryKey, number>` counter privato.
 *
 * Anti-singleton D-30 carryover F1: ogni call crea nuovo engine indipendente
 * (supporta scenario multi-broker test fixture isolato, ogni broker ha proprio engine).
 *
 * @returns Nuovo `RetryEngine` con counter Map vuoto.
 *
 * @throws Mai. La factory è pure — costruisce solo state interno e ritorna l'API.
 *   Eventuali errori di policy invalida (es. `attempts < 0`) sono governance-time
 *   responsability del descriptor consumer (NON enforced runtime per micro-perf).
 */
export function createRetryEngine(): RetryEngine {
  const counters = new Map<RetryKey, number>()

  function computeDelay(attempt: number, policy: RetryPolicy): number {
    const base = policy.delayMs ?? 0
    const mode = policy.backoff ?? 'none'
    let delay: number
    switch (mode) {
      case 'exponential':
        delay = base * 2 ** attempt
        break
      case 'linear':
        delay = base * (attempt + 1)
        break
      default:
        // 'none' — costante
        delay = base
    }
    if (policy.jitter === true) {
      // ±20% conservativo D-V2-F14-09 (vs F3 ±50% AWS full).
      // Range [base*0.8, base*1.2) perché Math.random() ∈ [0, 1).
      // Distribuzione uniforme — mitigation P-01 retry storm thundering herd.
      const factor = 0.8 + Math.random() * 0.4
      delay = delay * factor
    }
    return Math.floor(delay)
  }

  function incrementAttempt(
    mfId: string,
    phase: MicroFrontendErrorLifecyclePhase,
  ): number {
    const key = makeKey(mfId, phase)
    const next = (counters.get(key) ?? 0) + 1
    counters.set(key, next)
    return next
  }

  function getAttempts(
    mfId: string,
    phase: MicroFrontendErrorLifecyclePhase,
  ): number {
    return counters.get(makeKey(mfId, phase)) ?? 0
  }

  function resetCounter(
    mfId: string,
    phase: MicroFrontendErrorLifecyclePhase,
  ): void {
    counters.delete(makeKey(mfId, phase))
  }

  function shouldRetry(
    mfId: string,
    phase: MicroFrontendErrorLifecyclePhase,
    policy: RetryPolicy,
  ): boolean {
    return getAttempts(mfId, phase) < policy.attempts
  }

  return {
    computeDelay,
    incrementAttempt,
    getAttempts,
    resetCounter,
    shouldRetry,
  }
}
