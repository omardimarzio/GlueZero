---
phase: 03-routing-server-gateway-http
plan: 09
subsystem: gateway-strategies-retry-timeout-idempotency
tags:
  - strategies
  - retry
  - timeout
  - idempotency
  - phase-3
  - gateway
  - full-jitter
  - retry-after
  - nanoid
  - pitfall-2
  - pitfall-3
dependency-graph:
  requires:
    - phase: 03-02
      provides: "RetryStrategy/TimeoutStrategy/IdempotencyStrategy interfaces (http-strategies.ts)"
    - phase: 03-08
      provides: "parseRetryAfter + MAX_BACKOFF_MS (retry-after-parser.ts) + HttpGateway consumer downstream"
    - phase: 01
      provides: "nanoid 5.1.9 (re-export indiretto via @gluezero/core/event-factory.ts pattern)"
  provides:
    - "createRetryStrategy (ExponentialBackoffWithJitter) — D-69 chiusura ROUTE-09 / PRD §39 #8"
    - "createTimeoutStrategy (FixedTimeout) — D-68 wrapper su AbortSignal.timeout()"
    - "createIdempotencyStrategy (AutoIdempotency) — D-70 chiusura SEC-03 + Pitfall 3 fix"
    - "Barrel parziale strategies/index.ts (Wave 4-A — 03-10/11 estendono)"
  affects:
    - "03-10 (Strategies Wave 4-B dedupe+backpressure): aggiungerà export al barrel index.ts"
    - "03-11 (Strategies Wave 4-C auth+circuit-breaker): aggiungerà export al barrel index.ts"
    - "03-12 (RouterBroker wrapper): cabla queste 3 strategy default nel HttpGatewayStrategies bundle"
    - "03-13 (integration test scenario meteo): retry storm test usa createRetryStrategy default"
tech-stack:
  added: []
  patterns:
    - "Pattern Strategy DI (D-68): factory create*Strategy ritorna istanza che implementa interface — agnostica all'engine HttpGateway"
    - "Pattern Pure Function Closure: factory cattura options in closure (no class state) — testabile + tree-shakable"
    - "Pattern Persistence-by-Map (D-70 / Pitfall 3): Map<eventId, token> per garantire stesso token sui retry attempt"
    - "Pattern LRU bounded (T-03-09-03 mitigation): Map size cap + drop oldest via insertion-order"
    - "Pattern Conditional spread per exactOptionalPropertyTypes: nessun campo undefined esplicito"
    - "Pattern Custom override factory (tokenFactory, fromMs): testabilità + polyfill futuro senza modifica HttpGateway"
key-files:
  created:
    - "packages/gateway/src/http/strategies/retry-strategy.ts (150 LOC)"
    - "packages/gateway/src/http/strategies/retry-strategy.test.ts (15 test)"
    - "packages/gateway/src/http/strategies/timeout-strategy.ts (60 LOC)"
    - "packages/gateway/src/http/strategies/timeout-strategy.test.ts (4 test)"
    - "packages/gateway/src/http/strategies/idempotency-strategy.ts (116 LOC)"
    - "packages/gateway/src/http/strategies/idempotency-strategy.test.ts (8 test)"
    - "packages/gateway/src/http/strategies/index.ts (barrel parziale Wave 4-A)"
  modified: []
key-decisions:
  - "**RetryStrategy default `ExponentialBackoffWithJitter` con full jitter formula esatta** (D-69 + PITFALLS #5): `min(maxDelayMs, baseDelayMs * 2^attempt) * (0.5 + Math.random() * 0.5)`. Differenzia 4xx (no-retry) vs 5xx/408/429/network (retry). DEFAULT_RETRY_STATUSES = Set([408, 429]) + range esplicito 500-599. Test 15 verifica varianza > 100ms su 100 sample (no thundering herd)."
  - "**Retry-After priority over jitter**: `delayMs(attempt, retryAfterHeader?)` se header presente parsa via `parseRetryAfter` di 03-08 + cap MAX_BACKOFF_MS=60s — il jitter NON viene applicato sopra Retry-After (rispetto del server)."
  - "**TimeoutStrategy default `FixedTimeout` wrapper su AbortSignal.timeout()**: ES2022 nativo (Chrome 103+, Node 17+, Firefox 100+, Safari 15.4+). Override `fromMs` per polyfill custom o test fake-timer. Pattern Strategy permette swap futuro senza modifica HttpGateway."
  - "**IdempotencyStrategy default `AutoIdempotency` con Map<eventId, token> persistence**: chiusura PITFALLS #3. La nanoid generata al first attempt è la STESSA su tutti i retry — chiave: BrokerEvent.id originario. Il server riceve lo stesso Idempotency-Key e deduplica (precondizione DOC-04)."
  - "**LRU bounded `maxEventsTracked: 1000` default** (T-03-09-03 DoS mitigation): Map JS preserva insertion order → drop oldest tramite `keys().next().value` quando size supera la soglia. Cap appropriato: il retry budget tipico è secondi, no senso tracciare token vecchi."
  - "**headerName default `'Idempotency-Key'`**: standard de-facto Stripe/AWS/molti API REST. Override via `IdempotencyStrategyOptions.headerName` per API legacy con `X-Idempotency-Key` o `Request-Id`."
  - "**tokenFactory custom override**: testabilità (fixed token per assertion) + future-proof (UUID v4, HMAC su payload se vincoli stringenti). Default `() => nanoid()` 21-char URL-safe = 126-bit entropy."
  - "**Barrel index.ts parziale documentato**: ownership disgiunta (03-10 dedupe+backpressure, 03-11 auth+circuit-breaker). Plan paralleli aggiungeranno SOLO le proprie righe export — merge safe."
metrics:
  duration: "~30min (TDD RED+GREEN per 3 strategy + barrel)"
  completed: "2026-04-30"
  test-count: 27
  test-pass-rate: "27/27 (100%)"
  tests-by-task: "Task 1 retry 15/15; Task 2 timeout 4/4; Task 3 idempotency 8/8"
  total-gateway-tests: "60/60 (33 baseline 03-08 + 27 nuovi)"
  loc-runtime: "326 (150 retry + 60 timeout + 116 idempotency)"
  files-created: 7
  files-modified: 0
---

# Phase 03 Plan 09: Strategies retry + timeout + idempotency

3 strategy primitives default (Wave 4-A): `ExponentialBackoffWithJitter` (RetryStrategy — chiusura ROUTE-09 / PRD §39 #8 / D-69), `FixedTimeout` (TimeoutStrategy — D-68), `AutoIdempotency` (IdempotencyStrategy — chiusura SEC-03 / D-70 / Pitfall 3 fix). Plan 03-12 le inietterà nel `HttpGatewayStrategies` bundle del `RouterBroker`. File ownership disgiunta da plan 03-10 (dedupe+backpressure) e 03-11 (auth+circuit-breaker).

## Tasks Completed

| Task | Name                                                              | Commit    | Files                                                                |
| ---- | ----------------------------------------------------------------- | --------- | -------------------------------------------------------------------- |
| 1    | RED test ExponentialBackoffWithJitter (15 test deterministici)    | `882fb3d` | retry-strategy.test.ts                                               |
| 1    | GREEN ExponentialBackoffWithJitter (D-69 chiusura ROUTE-09)       | `c9add02` | retry-strategy.ts (150 LOC)                                          |
| 2    | RED test FixedTimeout (4 test)                                    | `43835cb` | timeout-strategy.test.ts                                             |
| 2    | GREEN FixedTimeout wrapper AbortSignal.timeout() (D-68)           | `26bd8bc` | timeout-strategy.ts (60 LOC)                                         |
| 3    | RED test AutoIdempotency (8 test — Pitfall 3 persistence)         | `3853adc` | idempotency-strategy.test.ts                                         |
| 3    | GREEN AutoIdempotency con Map persistence + LRU (D-70 + Pitfall 3) | `d5a4d5e` | idempotency-strategy.ts (116 LOC)                                    |
| 4    | barrel strategies/index.ts (parziale Wave 4-A)                     | `483017c` | strategies/index.ts                                                  |

## Test Results

```
Test Files  10 passed (10) — @gluezero/gateway
     Tests  60 passed (60)
```

**Suite delta vs baseline:**
- @gluezero/gateway: 60/60 (33 baseline 03-08 + 27 nuovi: 15 retry + 4 timeout + 8 idempotency)
- @gluezero/core: 248/248 (D-83 invariant — zero modifiche runtime)
- @gluezero/mapper: 183/183 (D-83 invariant — zero modifiche runtime)
- @gluezero/routing: 58/58 (D-83 invariant — zero modifiche runtime)

**Behavior coverage per task:**

### Task 1 — ExponentialBackoffWithJitter (15 test)

1. `shouldRetry(undefined, networkError, 1)` → true (network retry)
2. `shouldRetry(500, undefined, 1)` → true (5xx retry)
3. `shouldRetry(408, undefined, 1)` → true (408 retry)
4. `shouldRetry(429, undefined, 1)` → true (429 retry)
5. `shouldRetry(400, undefined, 1)` → false (400 NO retry)
6. `shouldRetry(401, undefined, 1)` → false (401 NO retry)
7. `shouldRetry(404, undefined, 1)` → false (404 NO retry)
8. `shouldRetry(500, undefined, 3)` con maxAttempts:3 → false (max raggiunto)
9. `shouldRetry(500, undefined, 1)` con maxAttempts:0 → false (retry disabilitato)
10. `delayMs(1)` con base:300/max:10000 → in [300, 600] (full jitter)
11. `delayMs(2)` → in [600, 1200] (full jitter)
12. `delayMs(10)` → cap a [5000, 10000] (max 10s)
13. `delayMs(1, '5')` (Retry-After 5s) → 5000 (priority over jitter)
14. `delayMs(1, HTTP-date future)` → ms delta clamped MAX_BACKOFF_MS (60000)
15. 100 chiamate `delayMs(2)` → varianza > 100ms (no thundering herd)

### Task 2 — FixedTimeout (4 test)

1. `createTimeoutStrategy()` ritorna istanza con `signal(ms)` method
2. `signal(100)` ritorna AbortSignal valido (instanceof check)
3. `signal(50)` aborts dopo ~50ms (verify async)
4. `signal(0)` aborts entro 1 macrotask

### Task 3 — AutoIdempotency (8 test)

1. `createIdempotencyStrategy()` factory shape (generate + headerName)
2. `generate(eventId)` ritorna nanoid 21-char default
3. `generate('event-1')` 3 volte → STESSO token (Pitfall 3 persistence)
4. `generate('event-1')` ≠ `generate('event-2')` (diversi eventId → diversi token)
5. `headerName()` default `'Idempotency-Key'`
6. `headerName: 'X-Idempotency'` custom → ritorna custom
7. `tokenFactory: () => 'fixed-test-token'` → generate ritorna fixed (test determinismo)
8. 1000 generate distinti con `maxEventsTracked: 100` → evicted oldest (LRU bounded)

## REQ-IDs Coverage

- **ROUTE-09** (Differenziazione retry su errori 4xx vs 5xx): chiusura completa via `ExponentialBackoffWithJitter.shouldRetry` con DEFAULT_RETRY_STATUSES = Set([408, 429]) + range esplicito 500-599. Test 1-9 verificano tutti i percorsi della tabella di decisione D-69. **Closes PRD §39 #8.**
- **ROUTE-13** (Cancellazione AbortSignal): `FixedTimeout.signal(ms)` produce AbortSignal coordinato con `combineSignals` di 03-08. Il `HttpGateway.execute()` di 03-08 già combina externalSignal + ownController + timeoutSignal. Test 3 verifica abort timing.
- **SEC-03** (Idempotency token): chiusura completa via `AutoIdempotency.generate(eventId)` con Map<eventId, token> persistence. Pitfall 3 fix: stesso token su retry attempt, server deduplica per chiave (precondizione DOC-04).

## Decisions Closed

### D-69 — Retry policy default (chiusura PRD §39 #8 + ROUTE-09)
**Status: CLOSED.**
- Implementation: `createRetryStrategy` con `shouldRetry(response, error, attempt)` + `delayMs(attempt, retryAfterHeader?)`.
- Differenzia 4xx vs 5xx: DEFAULT_RETRY_STATUSES = `new Set([408, 429])`; range 500-599 esplicito; altri 4xx (400, 401, 403, 404, 422) → return false.
- Full jitter formula esatta: `min(maxDelayMs, baseDelayMs * 2^attempt) * (0.5 + Math.random() * 0.5)`.
- maxAttempts default 3; opt-out 0; custom retryOnStatuses override.
- Test 15 verifica varianza > 100ms su 100 sample (no thundering herd).

### D-68 — TimeoutStrategy default
**Status: CLOSED.**
- Implementation: `createTimeoutStrategy` con `signal(timeoutMs)`.
- Wrapper su `AbortSignal.timeout()` ES2022 nativo (RESEARCH §"Don't Hand-Roll").
- Override `fromMs` per polyfill custom o test fake-timer.

### D-70 — Idempotency token persistente sui retry (SEC-03 chiusura + Pitfall 3 fix)
**Status: CLOSED.**
- Implementation: `createIdempotencyStrategy` con `generate(eventId)` + `headerName()`.
- nanoid 21-char default (126-bit entropy); Map<eventId, token> persistence garantisce stesso token sui retry.
- LRU bounded `maxEventsTracked: 1000` default (T-03-09-03 DoS mitigation).
- headerName default `'Idempotency-Key'` (Stripe/AWS standard); custom override possibile.
- Test 3 verifica 3 chiamate consecutive con stesso eventId ritornano stesso token.

## Pitfall Coverage

### Pitfall 2 — Retry storm thundering herd (PITFALLS #5)
**Status: CLOSED via full jitter formula esatta + cap MAX_BACKOFF_MS.**
- Formula AWS Architecture Blog: `min(maxDelay, base * 2^attempt) * (0.5 + Math.random() * 0.5)`.
- Test 15 verifica varianza > 100ms su 100 sample con `delayMs(2)` — randomization reale, no sync.
- Cap MAX_BACKOFF_MS=60s da retry-after-parser di 03-08 protegge anche da Retry-After malevoli.

### Pitfall 3 — Idempotency-Key rotazione su retry crea N risorse duplicate
**Status: CLOSED via Map<eventId, token> persistence.**
- `AutoIdempotency.generate(eventId)` ritorna SEMPRE lo stesso token per stesso eventId (Test 3).
- HttpGateway di 03-08 invoca `strategies.idempotency.generate(event.id)` UNA volta prima del retry loop, header preservato sui retry attraverso lo stesso `init` object.
- Server riceve stesso Idempotency-Key e deduplica (precondizione DOC-04).

## Threat Model Coverage

| Threat ID | Disposition | Mitigation Implementata |
|-----------|-------------|--------------------------|
| T-03-09-01 (Repudiation — retry rigenera Idempotency-Key) | mitigate | Map<eventId, token> persistence + Test 3 verifica 3 chiamate stesso eventId → stesso token |
| T-03-09-02 (DoS — retry storm thundering herd) | mitigate | Full jitter formula esatta + Test 15 varianza > 100ms su 100 sample |
| T-03-09-03 (DoS — Map<eventId, token> cresce illimitato) | mitigate | LRU bounded `maxEventsTracked: 1000` default; drop oldest via insertion-order |
| T-03-09-04 (Tampering — retry su 4xx errato porta a server abuse) | mitigate | DEFAULT_RETRY_STATUSES strict Set([408, 429]) + range 500-599 esplicito; altri 4xx return false |

## Vincoli D-83 Confermati

`git diff --stat HEAD~7 HEAD packages/core/ packages/mapper/ packages/routing/` → empty.
**ZERO modifiche** a `packages/core/`, `packages/mapper/`, `packages/routing/` runtime per tutto plan 03-09.
- Core 248/248 test passing (invariant)
- Mapper 183/183 test passing (invariant)
- Routing 58/58 test passing (invariant)
- Pattern composition wrapper rispettato: nuove strategy in @gluezero/gateway/http/strategies — extension package isolato

## Verification

- [x] 27/27 nuovi test passing (15 retry + 4 timeout + 8 idempotency)
- [x] 60/60 gateway test totali (zero regressioni vs 33 baseline)
- [x] 248/248 core test (D-83 invariant)
- [x] 183/183 mapper test (D-83 invariant)
- [x] 58/58 routing test (D-83 invariant)
- [x] `tsc --noEmit` exit 0 (gateway + core + mapper + routing)
- [x] `grep "Math.random" retry-strategy.ts` matcha (full jitter formula)
- [x] `grep "DEFAULT_RETRY_STATUSES" retry-strategy.ts` matcha (408/429 set)
- [x] `grep "createRetryStrategy" retry-strategy.ts` matcha
- [x] `wc -l retry-strategy.ts` = 150 ≥ 80 (≥ minimum richiesto)
- [x] `grep "AbortSignal.timeout" timeout-strategy.ts` matcha
- [x] `grep "createTimeoutStrategy" timeout-strategy.ts` matcha
- [x] `grep "nanoid" idempotency-strategy.ts` matcha (token generation)
- [x] `grep "Map<string, string>" idempotency-strategy.ts` matcha (persistence)
- [x] `grep "Idempotency-Key" idempotency-strategy.ts` matcha (default header)
- [x] `grep "maxEventsTracked" idempotency-strategy.ts` matcha (LRU bounded)
- [x] `grep -E "(createRetryStrategy|createTimeoutStrategy|createIdempotencyStrategy)" strategies/index.ts | wc -l` = 3
- [x] D-83 invariant: 0 modifiche a packages/core, packages/mapper, packages/routing runtime
- [x] response_language: italiano (commit messages, JSDoc descrittivi, summary)

## Note per Wave 4-B (03-10) e Wave 4-C (03-11)

Il barrel `packages/gateway/src/http/strategies/index.ts` è stato creato come **parziale Wave 4-A**.
- Plan 03-10 deve aggiungere export per `createDedupeStrategy` + `createBackpressureStrategy` (file ownership: dedupe-strategy.ts + backpressure-strategy.ts).
- Plan 03-11 deve aggiungere export per `createAuthStrategy` + `createCircuitBreakerStrategy` (file ownership: auth-strategy.ts + circuit-breaker.ts).

I commenti nel barrel `// 03-10 aggiungerà:` e `// 03-11 aggiungerà:` documentano l'intent — la merge è safe per file ownership disgiunta.

## Deviations from Plan

**None — plan executed exactly as written.** Tutti i 3 task TDD RED+GREEN + barrel completati senza deviazioni. Auto-fix non necessari.

## Self-Check: PASSED

**Files created:**
- [x] FOUND: packages/gateway/src/http/strategies/retry-strategy.ts (150 LOC)
- [x] FOUND: packages/gateway/src/http/strategies/retry-strategy.test.ts
- [x] FOUND: packages/gateway/src/http/strategies/timeout-strategy.ts (60 LOC)
- [x] FOUND: packages/gateway/src/http/strategies/timeout-strategy.test.ts
- [x] FOUND: packages/gateway/src/http/strategies/idempotency-strategy.ts (116 LOC)
- [x] FOUND: packages/gateway/src/http/strategies/idempotency-strategy.test.ts
- [x] FOUND: packages/gateway/src/http/strategies/index.ts (barrel)

**Commits:**
- [x] FOUND: 882fb3d (test RED retry-strategy)
- [x] FOUND: c9add02 (feat GREEN retry-strategy)
- [x] FOUND: 43835cb (test RED timeout-strategy)
- [x] FOUND: 26bd8bc (feat GREEN timeout-strategy)
- [x] FOUND: 3853adc (test RED idempotency-strategy)
- [x] FOUND: d5a4d5e (feat GREEN idempotency-strategy)
- [x] FOUND: 483017c (feat barrel)

## TDD Gate Compliance

- [x] **RED gate Task 1**: commit 882fb3d (test) precede c9add02 (implementazione) — verificato fail prima del GREEN
- [x] **GREEN gate Task 1**: commit c9add02 dopo RED, 15/15 test passing
- [x] **RED gate Task 2**: commit 43835cb (test) precede 26bd8bc (implementazione)
- [x] **GREEN gate Task 2**: commit 26bd8bc dopo RED, 4/4 test passing
- [x] **RED gate Task 3**: commit 3853adc (test) precede d5a4d5e (implementazione)
- [x] **GREEN gate Task 3**: commit d5a4d5e dopo RED, 8/8 test passing
- [x] No REFACTOR commit necessario per nessun task — implementazioni pulite al primo passaggio
