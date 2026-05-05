---
phase: 03-routing-server-gateway-http
plan: 11
subsystem: gateway-strategies-auth-circuit-breaker
tags:
  - strategies
  - auth
  - single-flight
  - circuit-breaker
  - phase-3
  - gateway
  - pitfall-5
  - sec-01
  - sec-02
  - route-07
  - d-99
dependency-graph:
  requires:
    - phase: 03-03
      provides: "AuthStrategyConfig + CircuitBreakerConfig (gateway-config.ts)"
    - phase: 03-04
      provides: "RouteDefinition + routing engine consumer downstream"
    - phase: 03-10
      provides: "Barrel strategies/index.ts esteso Wave 4-B (createDedupeStrategy + createBackpressureStrategy)"
    - phase: 01
      provides: "createBrokerError + isBrokerError + ErrorCategory union ('config' usato per auth.refresh.unavailable)"
  provides:
    - "createAuthStrategy (BearerHookAuth + single-flight refresh) — D-72 chiusura SEC-01/SEC-02/ROUTE-07"
    - "createCircuitBreakerStrategy (PerRouteCircuitBreaker state machine) — D-99 opt-in DISABLED default"
    - "Barrel strategies/index.ts FINAL Wave 4-C — 7 export create*Strategy totali"
  affects:
    - "03-12 (RouterBroker wrapper): cabla auth + circuit-breaker quando gateway.auth/circuitBreaker definiti"
    - "03-13 (integration test scenario meteo): test auth flow end-to-end + retry su 401"
tech-stack:
  added: []
  patterns:
    - "Pattern Single-Flight Promise (Pattern 5 RESEARCH lines 671-694, Pitfall 5 fix): inflightRefresh Promise singleton fra N caller paralleli — 1 sola config.refresh invocation"
    - "Pattern Always-Provide refresh: method sempre presente, throw 'auth.refresh.unavailable' con category 'config' (BLOCKER 1 fix iter 1) quando config.refresh undefined"
    - "Pattern Cleanup-in-Finally: inflightRefresh = null in finally — release sia su success che failure (Test 7 + Test 8 verificano)"
    - "Pattern State Machine 3-states (analogo lifecycle.ts F1): closed → open → half-open → closed; transitionState atomico race-free in single-threaded JS"
    - "Pattern Lazy Transition: open → half-open valutato al canExecute/getState (no setTimeout overhead per route inattive)"
    - "Pattern Default DISABLED (consumer opt-in): createCircuitBreakerStrategy() senza config = pass-through per ridurre cognitive load V1"
    - "Pattern Per-route State Isolation: Map<routeId, CircuitState> — recordFailure('r1') NON influenza 'r2' (Test 8)"
key-files:
  created:
    - "packages/gateway/src/http/strategies/auth-strategy.ts (142 LOC)"
    - "packages/gateway/src/http/strategies/auth-strategy.test.ts (185 LOC, 9 test)"
    - "packages/gateway/src/http/strategies/circuit-breaker.ts (180 LOC)"
    - "packages/gateway/src/http/strategies/circuit-breaker.test.ts (194 LOC, 10 test)"
  modified:
    - "packages/gateway/src/http/strategies/index.ts (+7 -3: aggiunge auth + circuit-breaker, rimuove placeholder // 03-11 aggiungerà)"
key-decisions:
  - "**BLOCKER 1 fix iter 1 — category 'config' (NON 'auth') per auth.refresh.unavailable**: ErrorCategory union (`packages/core/src/types/error.ts:19-28`) include 'validation'|'plugin'|'mapping'|'route'|'network'|'worker'|'system'|'config'|'topic' — NON 'auth'. Per evitare modifica core (D-83 strict), usiamo `category: 'config'` coerente con plan 03-08 (gateway-config errors). Test 5 verifica esplicitamente. grep `category: 'auth'` nel file = 0 occorrenze."
  - "**Single-flight refresh via Promise singleton (Pattern 5 RESEARCH, Pitfall 5 fix)**: `let inflightRefresh: Promise<string> | null` shared fra N caller. Quando non-null, refresh in volo: nuovi caller ricevono la STESSA Promise. IIFE async con try/finally: `inflightRefresh = null` in finally garantisce release sia su resolve che reject. Test 6 verifica 5 caller paralleli → 1 sola config.refresh invocation. Test 8 verifica failure path con cleanup. Test 7 verifica re-invocation dopo settle."
  - "**Always-provide refresh method pattern**: l'interface AuthStrategy.refresh? è opzionale, ma adottiamo always-provide per uniformità — il method è sempre presente nell'oggetto ritornato; throw createBrokerError 'auth.refresh.unavailable' quando config.refresh è undefined. Riduce ambiguità API (consumer non deve fare optional-chaining check)."
  - "**Token caching opt-in via tokenCacheMs (default 0 = disabled)**: cache popolata solo se tokenCacheMs > 0 e token definito. Cache miss / disabled → invoca config.getToken consumer-provided. Test 2 verifica caching, Test 3 verifica disabled default."
  - "**State machine 3-states con lazy transition**: `closed → open → half-open → closed`. Transition open → half-open valutata lazy al canExecute/getState (`Date.now() - openedAt >= cooldownMs`) — evita setTimeout overhead per route inattive. Pattern analogo a `lifecycle.ts` di F1 (state machine atomico race-free in single-threaded JS event loop)."
  - "**Default DISABLED — opt-in via gateway.circuitBreaker config**: createCircuitBreakerStrategy() senza config ritorna pass-through (canExecute sempre true). recordFailure/recordSuccess no-op. getState ritorna 'closed' (semantica reportistica coerente). Riduce cognitive load V1 — il consumer attiva solo se necessario. Test 9 verifica behavior."
  - "**Per-route state isolation via Map<routeId, CircuitState>**: lazy init al primo accesso (getOrCreateState). Test 8 verifica recordFailure('r1') N=3 → r1 'open', r2 ancora 'closed' (zero leak cross-route)."
  - "**half-open + recordFailure → open ricaricato (cooldown reset)**: il timer cooldownMs viene riavviato a Date.now() — la prova di recovery fallita penalizza nuovamente la route. Test 7 verifica con avanzo parziale (50ms su 100ms) ancora 'open', avanzo completo → 'half-open' di nuovo."
metrics:
  duration: "~6min (TDD RED+GREEN per 2 strategy + barrel + biome cleanup)"
  completed: "2026-05-02"
  test-count: 19
  test-pass-rate: "19/19 (100%)"
  tests-by-task: "Task 1 auth 9/9; Task 2 circuit-breaker 10/10"
  total-gateway-tests: "97/97 (78 baseline + 19 nuovi)"
  loc-runtime: "322 (142 auth + 180 circuit-breaker)"
  loc-test: "379 (185 auth + 194 circuit-breaker)"
  files-created: 4
  files-modified: 1
---

# Phase 03 Plan 11: Strategies auth + circuit-breaker

2 strategy primitives parallelizzabili Wave 4-C (file ownership disgiunta da plan 03-09 e 03-10):

1. **`BearerHookAuth` (AuthStrategy default)** — chiusura SEC-01/SEC-02/ROUTE-07 (D-72) + Pitfall 5 fix. Wrapper su `gateway.auth.getToken`/`gateway.auth.refresh` consumer-provided con **single-flight refresh** (Pattern 5 RESEARCH lines 671-694): N caller paralleli → 1 sola `config.refresh()` invocation. Token caching opt-in via `tokenCacheMs`. Always-provide `refresh` method che throw `createBrokerError 'auth.refresh.unavailable'` con `category: 'config'` quando `config.refresh` undefined (BLOCKER 1 fix iter 1 — ErrorCategory union NON include `'auth'` e D-83 vieta modifica core).

2. **`PerRouteCircuitBreaker` (CircuitBreakerStrategy default — DISABLED)** — chiusura D-99. State machine `closed → open → half-open → closed` per route. Default DISABILITATO: `createCircuitBreakerStrategy()` senza config ritorna pass-through (consumer opt-in via `gateway.circuitBreaker`). Lazy transition `open → half-open` (no `setTimeout` overhead per route inattive).

Plan 03-12 (createRouterBroker) inietterà queste strategy nelle `HttpGatewayStrategies` quando `gateway.auth` definito (auth) o `gateway.circuitBreaker !== false` (circuit). Plan 03-13 integration test verifica scenario meteo + auth flow end-to-end.

## Tasks Completed

| Task | Name                                                                                    | Commit    | Files                                                          |
| ---- | --------------------------------------------------------------------------------------- | --------- | -------------------------------------------------------------- |
| 1    | RED test BearerHookAuth single-flight + category 'config' fix (9 test)                  | `181247e` | auth-strategy.test.ts                                          |
| 1    | GREEN BearerHookAuth + single-flight Pattern 5 + BLOCKER 1 fix (D-72 SEC-01/SEC-02)     | `3e48e5e` | auth-strategy.ts (142 LOC)                                     |
| 2    | RED test PerRouteCircuitBreaker state machine 3-states (10 test)                        | `12f5a2f` | circuit-breaker.test.ts                                        |
| 2    | GREEN PerRouteCircuitBreaker state machine + opt-in DISABLED default (D-99)             | `6c00e7f` | circuit-breaker.ts (180 LOC)                                   |
| 3    | barrel strategies/index.ts FINAL Wave 4-C (7 export create*Strategy totali)             | `188a356` | strategies/index.ts (+7 -3)                                    |
| —    | Biome formatter cleanup (organizeImports + line-wrap unifications)                      | `b7b092c` | auth-strategy.ts/.test.ts + circuit-breaker.ts + index.ts      |

## Test Results

```
Test Files  14 passed (14) — @gluezero/gateway
     Tests  97 passed (97)
```

**Suite delta vs baseline 03-10:**
- @gluezero/gateway: 97/97 (78 baseline + 19 nuovi: 9 auth + 10 circuit-breaker)
- @gluezero/core: 248/248 (D-83 invariant — zero modifiche runtime)
- @gluezero/mapper: 183/183 (D-83 invariant — zero modifiche runtime)
- @gluezero/routing: 58/58 (D-83 invariant — zero modifiche runtime)

**Behavior coverage per task:**

### Task 1 — BearerHookAuth (9 test)

1. `getToken()` invoca config.getToken e ritorna value (Test 1)
2. `getToken()` con `tokenCacheMs:1000` → 2 chiamate consecutive ritornano stesso token (1 sola config.getToken) (Test 2)
3. `getToken()` con `tokenCacheMs:0` (default) → ogni chiamata invoca config.getToken (Test 3)
4. `refresh()` con config.refresh definito → invoca e ritorna nuovo token (Test 4)
5. `refresh()` con config.refresh undefined → throw `BrokerError 'auth.refresh.unavailable' category 'config'` (BLOCKER 1 fix verified) (Test 5)
6. **5 `refresh()` PARALLELI → config.refresh invocato 1 SOLA volta** (Pattern 5 single-flight, Pitfall 5 fix) (Test 6)
7. Dopo settle, nuovo `refresh()` → config.refresh invocato (release flag in finally) (Test 7)
8. config.refresh throws → tutti i 5 caller rejected con stesso error; nuovo refresh chiama config.refresh (Test 8)
9. `isInflightRefresh()` true durante refresh, false altrimenti (Test 9)

### Task 2 — PerRouteCircuitBreaker (10 test)

1. `canExecute('r1')` con state default 'closed' → true (Test 1)
2. recordFailure 4 volte (threshold:5) → state still 'closed' (Test 2)
3. recordFailure 5° volta (threshold) → state 'open' (canExecute false) (Test 3)
4. recordSuccess in 'closed' → reset counter (4 fail + success + 4 fail = ancora closed) (Test 4)
5. state 'open' + cooldownMs:100ms passati → canExecute true (transition automatica → 'half-open') (Test 5)
6. state 'half-open' + recordSuccess → 'closed' counter reset (Test 6)
7. state 'half-open' + recordFailure → 'open' ricaricato (cooldown reset, verificato con avanzo parziale 50ms) (Test 7)
8. route diversi indipendenti — recordFailure('r1') NON influenza 'r2' (Test 8)
9. **DEFAULT DISABLED**: createCircuitBreakerStrategy() SENZA config → canExecute sempre true (anche dopo 100 fail + 60s) (Test 9)
10. getState ritorna stato corrente (closed/open/half-open) (Test 10)

## REQ-IDs Coverage

- **SEC-01** (Header auth gestiti centralmente): chiusura via `createAuthStrategy` con `getToken` consumer-provided. Plan 03-12 (RouterBroker) inietterà la strategy nel HttpGateway middleware chain.
- **SEC-02** (Token refresh tramite hook/adapter): chiusura via `refresh` method single-flight (Pattern 5 RESEARCH). Test 6 verifica deterministicamente 5 paralleli → 1 sola invocation.
- **ROUTE-07** (Header auth + token refresh): chiusura via D-72 — l'AuthStrategy expose `getToken`/`refresh`/`isInflightRefresh` per il middleware chain di plan 03-12.

## Decisions Closed

### D-72 — AuthStrategy + Single-flight refresh (chiusura SEC-01/SEC-02/ROUTE-07)
**Status: CLOSED.**
- Implementation: `createAuthStrategy({ config })` ritorna istanza con `getToken`/`refresh`/`isInflightRefresh`.
- Single-flight via `inflightRefresh: Promise<string> | null` Promise singleton — N caller paralleli ricevono la stessa Promise.
- Cleanup garantito da try/finally — flag rilasciato sia su resolve che reject.
- Token caching opt-in via tokenCacheMs (default 0 = disabled).
- Always-provide pattern: refresh method sempre presente, throw quando config.refresh undefined.
- Test 6 verifica 5 paralleli → 1 sola invocation.

### D-99 — PerRouteCircuitBreaker state machine (opt-in DISABLED default)
**Status: CLOSED.**
- Implementation: `createCircuitBreakerStrategy(options)` ritorna istanza con `canExecute`/`recordSuccess`/`recordFailure`/`getState`.
- State machine 3-states: closed → open → half-open → closed.
- Lazy transition open → half-open valutata al canExecute/getState (no setTimeout overhead).
- Per-route state isolation via Map<routeId, CircuitState> — lazy init.
- Default DISABLED: senza config ritorna pass-through (canExecute sempre true).
- Sliding window stats (success rate over time window) → V1.x.

## Pitfall Coverage

### Pitfall 5 — Token refresh storm (PITFALLS RESEARCH lines 786-790)
**Status: CLOSED via single-flight Promise singleton.**
- Test 6 verifica 5 caller paralleli → 1 sola config.refresh invocation.
- Test 8 verifica failure path: tutti i caller rejected con stesso error; nuovo refresh chiama config.refresh.
- Test 7 verifica re-invocation dopo settle (flag rilasciato in finally).
- IIFE async con try/finally garantisce cleanup atomico.

## BLOCKER 1 fix iter 1 — Verification

**Issue:** Plan iniziale specificava `category: 'auth'` per `auth.refresh.unavailable`, ma `ErrorCategory` union (`packages/core/src/types/error.ts:19-28`) NON include `'auth'`:
```ts
export type ErrorCategory =
  | 'validation' | 'plugin' | 'mapping' | 'route' | 'network'
  | 'worker' | 'system' | 'config' | 'topic'
```

**Fix iter 1 (pre-execute):** Plan revision lockata su `category: 'config'` coerente con plan 03-08 (gateway-config errors). D-83 vieta modifica `packages/core/` runtime — non si aggiunge `'auth'` all'union.

**Verification post-execute:**
- `grep -c "category: 'config'" packages/gateway/src/http/strategies/auth-strategy.ts` → **3** (≥1 richiesto)
- `grep -c "category: 'auth'" packages/gateway/src/http/strategies/auth-strategy.ts` → **0** (esatto)
- Test 5 (`auth-strategy.test.ts`) verifica esplicitamente: `err.category === 'config'`
- 9/9 auth test passing — semantica preservata, only label corretta.

## Threat Model Coverage

| Threat ID | Disposition | Mitigation Implementata |
|-----------|-------------|--------------------------|
| T-03-11-01 (DoS — Token refresh storm Pitfall 5) | mitigate | Single-flight via inflightRefresh Promise singleton — N caller → 1 invocation |
| T-03-11-02 (Spoofing — refresh ritorna stesso token) | accept | Plan 03-12 wrapper publicherà `auth.expired` se newToken === oldToken (D-72 enforcement; questo plan ritorna solo new/throw) |
| T-03-11-03 (Information Disclosure — token in error) | mitigate | createBrokerError NON include token nel message (solo code+message generico) |
| T-03-11-04 (DoS — circuit breaker cooldownMs:Infinity) | accept | Consumer-provided config — responsabilità documentata in DOC-04 |

## Vincoli D-83 Confermati

`git diff --stat HEAD~6 HEAD packages/core/ packages/mapper/ packages/routing/` → empty.
**ZERO modifiche** a `packages/core/`, `packages/mapper/`, `packages/routing/` runtime per tutto plan 03-11.
- Core 248/248 test passing (invariant)
- Mapper 183/183 test passing (invariant)
- Routing 58/58 test passing (invariant)
- Pattern composition wrapper rispettato: nuove strategy in @gluezero/gateway/http/strategies — extension package isolato.
- BLOCKER 1 fix iter 1 (category 'config' invece di 'auth') rispetta D-83 — non modifica `packages/core/src/types/error.ts`.

## Verification

- [x] 19/19 nuovi test passing (9 auth + 10 circuit-breaker)
- [x] 97/97 gateway test totali (78 baseline 03-10 + 19 nuovi)
- [x] 248/248 core test (D-83 invariant)
- [x] 183/183 mapper test (D-83 invariant)
- [x] 58/58 routing test (D-83 invariant)
- [x] `tsc --noEmit` exit 0 (gateway)
- [x] `grep "inflightRefresh" packages/gateway/src/http/strategies/auth-strategy.ts` matcha (7 occurrences)
- [x] `grep "createAuthStrategy" packages/gateway/src/http/strategies/auth-strategy.ts` matcha (3 occurrences)
- [x] `grep "auth.refresh.unavailable" packages/gateway/src/http/strategies/auth-strategy.ts` matcha (3 occurrences)
- [x] **`grep -c "category: 'config'" packages/gateway/src/http/strategies/auth-strategy.ts` → 3 ≥ 1** (BLOCKER 1 fix verified)
- [x] **`grep -c "category: 'auth'" packages/gateway/src/http/strategies/auth-strategy.ts` → 0** (zero occorrenze residue del valore non-valido)
- [x] `grep "half-open" packages/gateway/src/http/strategies/circuit-breaker.ts` matcha (20 occurrences)
- [x] `grep "consecutiveFailures" packages/gateway/src/http/strategies/circuit-breaker.ts` matcha (7 occurrences)
- [x] `grep "createCircuitBreakerStrategy" packages/gateway/src/http/strategies/circuit-breaker.ts` matcha (6 occurrences)
- [x] 7 export `create*Strategy` totali nel barrel index.ts (3 da 03-09 + 2 da 03-10 + 2 da questo plan)
- [x] D-83 invariant: 0 modifiche a packages/core, packages/mapper, packages/routing runtime
- [x] response_language: italiano (commit messages, JSDoc descrittivi, summary)
- [x] Test deterministici: single-flight 5 concurrent (Test 6 auth), state machine transitions (Test 1-7 cb)
- [x] Biome check: clean (no errors after auto-fix run)

## Note per Wave 5+ (03-12 RouterBroker)

Il barrel `packages/gateway/src/http/strategies/index.ts` è ora **FINAL Wave 4-C** con 7 export create*Strategy:
- 03-09: createRetryStrategy + createTimeoutStrategy + createIdempotencyStrategy
- 03-10: createDedupeStrategy + createBackpressureStrategy
- 03-11: **createAuthStrategy + createCircuitBreakerStrategy** (questo plan)

Plan 03-12 RouterBroker importerà queste strategy via:
```ts
import {
  createRetryStrategy,
  createTimeoutStrategy,
  createIdempotencyStrategy,
  createDedupeStrategy,
  createBackpressureStrategy,
  createAuthStrategy,
  createCircuitBreakerStrategy,
} from '@gluezero/gateway/http'
```

E le caverà come `HttpGatewayStrategies` bundle iniettato nel HttpGateway middleware chain quando le rispettive sezioni di `gateway.*` config sono definite (auth quando `gateway.auth` non-undefined, circuit-breaker quando `gateway.circuitBreaker !== false`).

## Deviations from Plan

**Adeguamento implementativo (Rule 1 - Type alias)**: il plan suggeriva `function getState(routeId)` come helper interno (line 308 plan). Ridenominato in `getOrCreateState(routeId)` per evitare shadowing con il method pubblico `getState(routeId)` dell'interface CircuitBreakerStrategy — il TypeScript compiler avrebbe dato errore di scope visibility. Comportamento identico, solo naming locale ineccepibile.

**Style cleanup (Biome auto-fix)**: dopo i 5 commit funzionali, Biome ha riorganizzato:
- `organizeImports` alphabetical (assist/source/organizeImports)
- Line-wrap consistency (formatter)
- Riordino export nel barrel (alphabetical) — 7 export create*Strategy preservati

Commit `b7b092c style(03-11): biome formatter cleanup`. Zero modifiche funzionali (97/97 test invariati).

**Nessuna deviazione architetturale**: BLOCKER 1 fix iter 1 (category 'config' invece di 'auth') era già lockato nel plan revision pre-execute. La verifica grep esplicita conferma `category: 'auth'` = 0 occurrences.

## Self-Check: PASSED

**Files created:**
- [x] FOUND: packages/gateway/src/http/strategies/auth-strategy.ts (142 LOC)
- [x] FOUND: packages/gateway/src/http/strategies/auth-strategy.test.ts (185 LOC, 9 test)
- [x] FOUND: packages/gateway/src/http/strategies/circuit-breaker.ts (180 LOC)
- [x] FOUND: packages/gateway/src/http/strategies/circuit-breaker.test.ts (194 LOC, 10 test)

**Files modified:**
- [x] FOUND: packages/gateway/src/http/strategies/index.ts (+7 -3: aggiunge auth + circuit-breaker)

**Commits:**
- [x] FOUND: 181247e (test RED auth-strategy)
- [x] FOUND: 3e48e5e (feat GREEN auth-strategy)
- [x] FOUND: 12f5a2f (test RED circuit-breaker)
- [x] FOUND: 6c00e7f (feat GREEN circuit-breaker)
- [x] FOUND: 188a356 (feat barrel Wave 4-C final)
- [x] FOUND: b7b092c (style biome cleanup)

## TDD Gate Compliance

- [x] **RED gate Task 1**: commit 181247e (test) precede 3e48e5e (implementazione) — verificato fail import prima del GREEN
- [x] **GREEN gate Task 1**: commit 3e48e5e dopo RED, 9/9 test passing
- [x] **RED gate Task 2**: commit 12f5a2f (test) precede 6c00e7f (implementazione) — verificato fail import prima del GREEN
- [x] **GREEN gate Task 2**: commit 6c00e7f dopo RED, 10/10 test passing
- [x] No REFACTOR commit funzionale necessario — implementazioni pulite al primo passaggio. Solo style cleanup post-implementation (b7b092c) per Biome auto-fix.
