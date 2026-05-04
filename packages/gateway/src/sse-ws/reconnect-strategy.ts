// reconnect-strategy.ts — `createReconnectStrategy` factory (D-107 + D-109 + Q3 §6.2).
//
// State machine per-channel della reconnect: combina tre responsabilità lockate da
// CONTEXT.md F4:
//
// 1. **Full jitter backoff math** (D-109 / RT-05) — formula esatta dal paper AWS
//    Architecture Blog (Marc Brooker, 2015):
//      `delay = floor(random() * min(capMs, baseMs * 2^consecutiveFailures))`
//    Threat T-04-03-01 (thundering herd) mitigato: distribuzione uniforme degli attempt
//    nel tempo, no sincronizzazione tra N client.
//
// 2. **Auto-fallback SSE↔WS** (D-107) — dopo `fallbackThreshold` (default 3) fail
//    consecutivi nel mode corrente, `shouldFallback()` ritorna true; `fallback()`
//    switcha mode e resetta `consecutiveFailures` (counter per-mode). Cap globale di
//    cicli (`globalCycleCap`, default 5) → `isPermanentlyFailed()` true e fallback
//    disabilitato (caller publish `system.realtime.failed`).
//
// 3. **Reset criteria con consolidationMs guard** (Q3 §6.2 — RESEARCH "opzione B"):
//    `recordSuccess()` resetta `consecutiveFailures` e `cycles` SOLO se è trascorso
//    `consolidationMs` (default 5_000ms) dal precedente success — anti-flap detection
//    per evitare reset prematuro su connect-then-instant-fail.
//
// Pattern factory + closure state identico a `circuit-breaker.ts` di F3
// (`packages/gateway/src/http/strategies/circuit-breaker.ts`). Pattern full jitter
// formula riusato da `retry-strategy.ts` (lines 144-156).
//
// Riferimenti:
// - 04-CONTEXT.md D-107 (auto-fallback SSE→WS default V1, threshold 3, cycle cap 5)
// - 04-CONTEXT.md D-109 (full jitter, base 1000ms, cap 30000ms, maxAttempts opzionale)
// - 04-RESEARCH.md §6.1 (full jitter formula AWS), §6.2 (Q3 consolidationMs reset),
//   §6.5 (cycle cap state machine)
// - 04-PATTERNS.md §2.6 (interface ReconnectStrategy lockata)
//
// Threat coverage:
// - T-04-03-01 (DoS thundering herd): mitigate via full jitter random distribution.
// - T-04-03-02 (DoS reconnect storm permanente): mitigate via globalCycleCap +
//   maxAttempts → isPermanentlyFailed() segnala caller di stop.
// - T-04-03-03 (Tampering Math.random predicibile): accept (browser non-cryptographic
//   sufficiente per jitter spread; attacker non guadagna predicendo delay).
// - T-04-03-04 (Repudiation timing reset ambiguo): mitigate via consolidationMs default
//   5_000ms (RESEARCH §6.2) override-abile via options.
//
// Anti-AP-3: NO import di `reconnecting-websocket` library — state-machine 100% custom
// (vincolo PRD §31.3 + STACK.md).

/**
 * Stato interno per-channel della reconnect state machine (D-107 + D-109).
 *
 * Encapsulated nel closure di `createReconnectStrategy` (factory pattern identico
 * a `createCircuitBreakerStrategy` di gateway/http/strategies/circuit-breaker.ts).
 */
interface ReconnectState {
  /** Modalità correntemente attiva (D-107 — SSE-first default). */
  mode: 'sse' | 'websocket'
  /** Counter fail consecutivi nel mode corrente — reset a `recordSuccess()` (con guard) o a `fallback()`. */
  consecutiveFailures: number
  /** Counter cicli SSE↔WS effettuati — cap globale D-107 = 5. */
  cycles: number
  /** Timestamp ultima connessione successful (per consolidationMs reset Q3 §6.2). 0 = nessun success ancora. */
  lastSuccessAt: number
  /** Counter total reconnect attempts (per maxAttempts cap RT-05). */
  totalAttempts: number
}

/**
 * Opzioni override-abili per `createReconnectStrategy` (RT-05 + D-107 + D-109).
 *
 * Tutti i campi opzionali con default sensati per V1 SemBridge realtime.
 */
export interface ReconnectStrategyOptions {
  /** Base delay per full jitter (D-109). Default 1_000ms. */
  readonly baseMs?: number
  /** Cap delay per full jitter (D-109). Default 30_000ms. */
  readonly capMs?: number
  /** Time minimo OPEN per resettare counter al recordSuccess (Q3 §6.2). Default 5_000ms. */
  readonly consolidationMs?: number
  /** Cap totale reconnect attempts (RT-05). Default `Number.POSITIVE_INFINITY`. */
  readonly maxAttempts?: number
  /** Fail consecutivi nel mode corrente prima di fallback (D-107). Default 3. */
  readonly fallbackThreshold?: number
  /** Cap totale cicli SSE↔WS (D-107). Default 5. */
  readonly globalCycleCap?: number
  /** Mode iniziale (D-107 SSE-first). Default `'sse'`. */
  readonly initialMode?: 'sse' | 'websocket'
  /** DI Math.random override per test deterministici (pattern retry-strategy.ts). Default `Math.random`. */
  readonly random?: () => number
  /** DI Date.now override per test deterministici (consolidationMs guard). Default `Date.now`. */
  readonly now?: () => number
}

/**
 * Public interface di `ReconnectStrategy` ritornata dal factory.
 *
 * Tutti i metodi sono sync e fanno mutate dello state interno chiuso (closure).
 * NON è thread-safe — pensato per single-channel single-thread browser context.
 *
 * Vedi `createReconnectStrategy` per il loop d'uso canonico nei consumer
 * (plan 04-05/04-06 SSE/WS adapters, plan 04-07 RealtimeChannelManager).
 */
export interface ReconnectStrategy {
  /**
   * Calcola il prossimo backoff delay (full jitter, D-109 / RESEARCH §6.1):
   *   `delay = floor(random() * min(capMs, baseMs * 2^consecutiveFailures))`
   *
   * Distribuzione uniforme tra [0, exponential] previene thundering herd
   * (T-04-03-01 mitigation).
   */
  nextDelayMs(): number
  /** Registra fail dell'ultimo connect — incrementa counter consecutivi + total. */
  recordFailure(): void
  /**
   * Registra success — reset counter solo se trascorre `consolidationMs` dal
   * precedente success (anti-flap, Q3 §6.2). Aggiorna sempre `lastSuccessAt`.
   */
  recordSuccess(): void
  /** True se threshold fallback raggiunto E cycle cap NON exceeded (D-107). */
  shouldFallback(): boolean
  /** Switcha SSE↔WS mode + reset `consecutiveFailures` + incrementa `cycles`. Ritorna nuovo mode. */
  fallback(): 'sse' | 'websocket'
  /** Mode corrente. */
  getMode(): 'sse' | 'websocket'
  /** True se cap globale raggiunto (D-107 globalCycleCap) o maxAttempts (RT-05) — permanent failure. */
  isPermanentlyFailed(): boolean
  /** Reset completo a configurazione iniziale (per disconnect manuale + reconnect). */
  reset(): void
}

/**
 * Crea una `ReconnectStrategy` con full jitter + auto-fallback (D-107, D-109, Q3 §6.2).
 *
 * **Formula full jitter** (RESEARCH §6.1, AWS Architecture Blog Marc Brooker 2015):
 *   `delay = floor(random() * min(capMs, baseMs * 2^attempt))`
 *
 * **State machine fallback** (D-107):
 *   `sse[0..N fail] → ws[0..N fail] → sse[0..N fail] → ... → permanent (cycles >= 5)`
 *
 * **Reset criteria** (Q3 §6.2 — opzione B): `recordSuccess()` resetta `consecutiveFailures`
 * e `cycles` SOLO se trascorre `consolidationMs` dal precedente success — evita reset
 * prematuro su flap (connect-then-instant-fail).
 *
 * @example
 * ```ts
 * const r = createReconnectStrategy({ initialMode: 'sse' })
 * while (!connected && !r.isPermanentlyFailed()) {
 *   await sleep(r.nextDelayMs())
 *   try {
 *     await connect(r.getMode())
 *     r.recordSuccess()
 *     connected = true
 *   } catch {
 *     r.recordFailure()
 *     if (r.shouldFallback()) r.fallback()
 *   }
 * }
 * if (r.isPermanentlyFailed()) {
 *   broker.publish({ topic: 'system.realtime.failed', data: { ... } })
 * }
 * ```
 *
 * @param options - Configurazione override (vedi `ReconnectStrategyOptions`).
 * @returns Istanza `ReconnectStrategy` con state isolato in closure.
 */
export function createReconnectStrategy(options: ReconnectStrategyOptions = {}): ReconnectStrategy {
  const baseMs = options.baseMs ?? 1_000
  const capMs = options.capMs ?? 30_000
  const consolidationMs = options.consolidationMs ?? 5_000
  const maxAttempts = options.maxAttempts ?? Number.POSITIVE_INFINITY
  const fallbackThreshold = options.fallbackThreshold ?? 3
  const globalCycleCap = options.globalCycleCap ?? 5
  const initialMode: 'sse' | 'websocket' = options.initialMode === 'websocket' ? 'websocket' : 'sse'
  const random = options.random ?? Math.random
  const now = options.now ?? Date.now

  const state: ReconnectState = {
    mode: initialMode,
    consecutiveFailures: 0,
    cycles: 0,
    lastSuccessAt: 0,
    totalAttempts: 0,
  }

  return {
    nextDelayMs(): number {
      // Full jitter formula (D-109 + RESEARCH §6.1 AWS):
      // `delay = floor(random() * min(capMs, baseMs * 2^consecutiveFailures))`
      const exponential = Math.min(capMs, baseMs * 2 ** state.consecutiveFailures)
      return Math.floor(random() * exponential)
    },
    recordFailure(): void {
      state.consecutiveFailures += 1
      state.totalAttempts += 1
    },
    recordSuccess(): void {
      const t = now()
      // Q3 §6.2 consolidationMs guard: reset counter SOLO se la connessione è rimasta
      // up per almeno `consolidationMs` dal precedente success (evita reset prematuro
      // su connect-then-instant-fail / flap detection).
      // - Primo success in assoluto (`lastSuccessAt === 0`) → reset baseline immediato
      //   ma counter già a 0 → no-op funzionale, semplicemente stabilisce il timestamp.
      // - Success successivi entro consolidationMs → NON reset counter (anti-flap).
      // - Success dopo consolidationMs → reset cycles + consecutiveFailures.
      if (state.lastSuccessAt === 0 || t - state.lastSuccessAt >= consolidationMs) {
        state.consecutiveFailures = 0
        state.cycles = 0
      }
      state.lastSuccessAt = t
    },
    shouldFallback(): boolean {
      // Cap globale raggiunto → no più fallback (caller publish system.realtime.failed permanente).
      if (state.cycles >= globalCycleCap) return false
      return state.consecutiveFailures >= fallbackThreshold
    },
    fallback(): 'sse' | 'websocket' {
      // Switcha mode + reset counter consecutivi (counter è per-mode, D-107).
      state.mode = state.mode === 'sse' ? 'websocket' : 'sse'
      state.consecutiveFailures = 0
      state.cycles += 1
      return state.mode
    },
    getMode(): 'sse' | 'websocket' {
      return state.mode
    },
    isPermanentlyFailed(): boolean {
      // Permanent: cap cicli D-107 raggiunto OR cap attempts RT-05 raggiunto.
      return state.cycles >= globalCycleCap || state.totalAttempts >= maxAttempts
    },
    reset(): void {
      state.mode = initialMode
      state.consecutiveFailures = 0
      state.cycles = 0
      state.lastSuccessAt = 0
      state.totalAttempts = 0
    },
  }
}
