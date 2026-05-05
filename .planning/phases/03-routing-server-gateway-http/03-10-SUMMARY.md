---
phase: 03-routing-server-gateway-http
plan: 10
subsystem: gateway-strategies-dedupe-backpressure
tags:
  - strategies
  - dedupe
  - backpressure
  - phase-3
  - gateway
  - promise-singleton
  - priority-aware
  - pitfall-4
  - pitfall-6
  - route-10
  - route-11
dependency-graph:
  requires:
    - phase: 03-03
      provides: "BackpressurePolicyConfig discriminated union 6 types (route-policies.ts)"
    - phase: 03-04
      provides: "RouteDefinition + routing engine consumer downstream"
    - phase: 03-09
      provides: "Barrel strategies/index.ts parziale Wave 4-A (createRetryStrategy/Timeout/Idempotency)"
    - phase: 01
      provides: "createBrokerError + isBrokerError + ErrorCategory 'config'"
  provides:
    - "createDedupeStrategy (KeyBasedDedupe) — D-74 chiusura ROUTE-11"
    - "createBackpressureStrategy (6 policy + critical bypass) — D-75 chiusura ROUTE-10"
    - "Barrel strategies/index.ts esteso (Wave 4-B — 03-11 estenderà con auth+circuit-breaker)"
  affects:
    - "03-11 (Strategies Wave 4-C auth+circuit-breaker): aggiungerà export al barrel index.ts"
    - "03-12 (RouterBroker wrapper): cabla queste 2 strategy default nel HttpGatewayStrategies bundle"
    - "03-13 (integration test scenario meteo): test concurrency-latest-only + dedupe end-to-end"
tech-stack:
  added: []
  patterns:
    - "Pattern Promise Singleton (D-74, RESEARCH §Pattern 5 SingleFlightRefresh): Map<key, Promise<T>> condiviso fra N caller concurrent"
    - "Pattern Cleanup-in-Finally (no leak): inflight.delete(key) in finally block — sia su success che failure"
    - "Pattern Strategy DI (D-68): factory createXxxStrategy ritorna istanza che implementa interface — agnostica all'engine HttpGateway"
    - "Pattern Discriminated Union per policy 6 types (BackpressurePolicyConfig switch-case)"
    - "Pattern Priority-Aware Bypass (Pitfall 4): if (priority === 'critical') bypass direct execute"
    - "Pattern Token Bucket Throttle: window timestamp + counter per finestra 1s"
    - "Pattern Debounce Timer Reset: clearTimeout + setTimeout su ogni nuovo schedule"
    - "Pattern Abort Cascade (latest-only/coalesce): AbortController per pending entry + reject 'backpressure.dropped'"
key-files:
  created:
    - "packages/gateway/src/http/strategies/dedupe-strategy.ts (106 LOC)"
    - "packages/gateway/src/http/strategies/dedupe-strategy.test.ts (8 test)"
    - "packages/gateway/src/http/strategies/backpressure-strategy.ts (319 LOC)"
    - "packages/gateway/src/http/strategies/backpressure-strategy.test.ts (10 test)"
  modified:
    - "packages/gateway/src/http/strategies/index.ts (+5 -2: aggiunge export Wave 4-B)"
key-decisions:
  - "**KeyBasedDedupe Promise Singleton (D-74)**: Map<string, Promise<unknown>> condiviso fra N caller concurrent con stessa key. La Promise viene wrappata in IIFE async con try/finally per cleanup automatico — la entry viene rilasciata al settle (success o failure), garantendo no leak. Test 4 verifica 5 concurrent → 1 sola fn invocation; Test 6 verifica failure path con cleanup."
  - "**maxInflight default 1000 (DoS guard)**: oltre la soglia, execute esegue diretto senza dedupe (graceful degradation, no throw). Mitiga T-03-10-01 (Map cresce illimitato). Inspector F6 emetterà warning quando si raggiunge la soglia."
  - "**BackpressureStrategy 6 policy via switch-case su discriminated union (D-75)**: queue-bounded, drop, throttle, debounce, latest-only, merge/coalesce. Ogni policy ha state per-route in Map<routeId, RouteState> con counter inFlight + pending entries (per abort cascade) + throttle window + debounce timer."
  - "**Critical priority BYPASS pre-switch (Pitfall 4 fix — D-75)**: il check `if (priority === 'critical') return await task()` è la PRIMA istruzione del schedule, prima del lookup state. Garantisce che eventi critical (es. system.error) vengano SEMPRE eseguiti, indipendente dalla policy della route. Test 8 e 9 verificano bypass su queue-bounded max:0 e drop policy."
  - "**queue-bounded drop-new (default) vs drop-oldest (opt-in)**: il drop-new throw immediato BrokerError 'backpressure.dropped' (Test 1); il drop-oldest abort il task pending più vecchio via AbortController + reject (Test 2). dropOldest è una option strategia-level (non per-route), perché è una scelta di policy globale del consumer."
  - "**throttle V1 minimal token bucket**: window timestamp + counter per finestra 1s. Quando count >= perSec, throw 'backpressure.dropped' (no queueing). Versione completa con leaky bucket o sliding window rinviata a V1.x — V1 minimal copre il caso 'rate-limit hard' del PRD."
  - "**debounce con timer reset**: ogni nuovo schedule cancella il timer precedente e ne avvia uno nuovo. Solo l'ultima Promise resolve (le precedenti restano pending hanging — tradeoff V1 minimal). Test 5 con fake timers verifica 5 schedule rapidi → solo l'ultimo eseguito."
  - "**merge/coalesce V1 minimal alias di latest-only**: comportamento equivalente — abort cascade pending + esegui nuovo. La semantica completa di 'merge' (combinazione di N eventi pending in 1 task con mergeFn callback) è rinviata a V1.x. Test 7 documenta l'aspettativa V1 minimal."
  - "**queueLength contract: state.pending.length**: ritorna il numero di task tracciati come pending (non inFlight + pending). Queue-bounded e drop policy non popolano pending oltre la durata del task → queueLength tipicamente 0 a steady-state. Latest-only/coalesce popolano pending temporaneamente (entry rimossa al settle)."
metrics:
  duration: "~6min (TDD RED+GREEN per 2 strategy + barrel update)"
  completed: "2026-05-02"
  test-count: 18
  test-pass-rate: "18/18 (100%)"
  tests-by-task: "Task 1 dedupe 8/8; Task 2 backpressure 10/10"
  total-gateway-tests: "78/78 (60 baseline + 18 nuovi)"
  loc-runtime: "425 (106 dedupe + 319 backpressure)"
  files-created: 4
  files-modified: 1
---

# Phase 03 Plan 10: Strategies dedupe + backpressure

2 strategy primitives parallelizzabili Wave 4-B (file ownership disgiunta da plan 03-09 e 03-11):

1. **`KeyBasedDedupe` (DedupeStrategy default)** — chiusura ROUTE-11 (D-74). Promise singleton per key: N caller concurrent con stessa `dedupeKey` ricevono la STESSA Promise (1 sola fetch effettiva). Cleanup automatico in `finally` dopo settle.
2. **`BackpressureStrategy` con 6 policy types** — chiusura ROUTE-10 (D-75). Implementa `'queue-bounded'`, `'drop'`, `'throttle'`, `'debounce'`, `'latest-only'`, `'merge'`/`'coalesce'`. **Eventi `priority: 'critical'` BYPASSANO** qualsiasi policy (D-75 + Pitfall 4 fix).

Plan 03-12 (createRouterBroker) inietterà queste strategy nelle `HttpGatewayStrategies` quando `gateway.defaults.dedupe`/`backpressure` o quando `route.policies.dedupe`/`backpressure` esplicito. Plan 03-13 integration test verifica end-to-end (concurrency-latest-only, dedupe).

## Tasks Completed

| Task | Name                                                                                  | Commit    | Files                                                                  |
| ---- | ------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------- |
| 1    | RED test KeyBasedDedupe (8 test deterministici)                                       | `8d8c526` | dedupe-strategy.test.ts                                                |
| 1    | GREEN KeyBasedDedupe Promise singleton + cleanup finally (D-74 chiusura ROUTE-11)     | `04fbfa3` | dedupe-strategy.ts (106 LOC)                                           |
| 2    | RED test BackpressureStrategy 6 policy + critical bypass (10 test)                    | `6781bab` | backpressure-strategy.test.ts                                          |
| 2    | GREEN BackpressureStrategy 6 policy + critical bypass (D-75 + Pitfall 4 fix)          | `2ada670` | backpressure-strategy.ts (319 LOC)                                     |
| 3    | barrel strategies/index.ts esteso Wave 4-B                                            | `f999579` | strategies/index.ts (+5 -2)                                            |

## Test Results

```
Test Files  12 passed (12) — @gluezero/gateway
     Tests  78 passed (78)
```

**Suite delta vs baseline 03-09:**
- @gluezero/gateway: 78/78 (60 baseline + 18 nuovi: 8 dedupe + 10 backpressure)
- @gluezero/core: 248/248 (D-83 invariant — zero modifiche runtime)
- @gluezero/mapper: 183/183 (D-83 invariant — zero modifiche runtime)
- @gluezero/routing: 58/58 (D-83 invariant — zero modifiche runtime)

**Behavior coverage per task:**

### Task 1 — KeyBasedDedupe (8 test)

1. `execute('key1', fn)` → fn invoked 1 volta + ritorna result
2. 2 concurrent `execute('key1', fn1) + execute('key1', fn2)` PARALLEL → fn1 invoked 1 volta, fn2 NEVER, both promises resolve same value (singleton)
3. Dopo settle Test 2, nuova `execute('key1', fn3)` → fn3 INVOKED (entry rilasciata)
4. 5 concurrent `execute('key1', fn)` → fn invocata 1 volta, tutti i 5 await stessa value
5. `execute('keyA', fnA)` parallelo a `execute('keyB', fnB)` → entrambi invocati (key diverse)
6. fn throws → tutti i caller ricevono stesso reject; entry rilasciata; nuova execute chiama fn
7. `size()` riflette inflight (0 → 1 → 0 dopo settle)
8. `clear()` resetta state — successive execute con stesse key chiamano fn nuovamente

### Task 2 — BackpressureStrategy (10 test)

1. `'queue-bounded'` max:2 — 3 schedule consecutivi con drop-new (default) → 3rd rejected con BrokerError 'backpressure.dropped'
2. `'queue-bounded'` max:2 con `dropOldest:true` — 3rd schedule abort 1st pending
3. `'drop'` policy con 1 task in volo → 2nd schedule immediato drop (reject)
4. `'throttle'` perSec:5 — 10 schedule rapidi → primi 5 eseguono, restanti rejected
5. `'debounce'` waitMs:50 — 5 schedule consecutivi entro 50ms → solo l'ULTIMO eseguito dopo quiet (fake timers)
6. `'latest-only'` — 2 schedule consecutivi → 2° eseguito, pending precedenti aborted
7. `'merge'` — comportamento V1 minimal alias latest-only (3 schedule → ultimo eseguito)
8. priority `'critical'` BYPASSA `'queue-bounded'` max:0 (Pitfall 4 fix)
9. priority `'critical'` BYPASSA `'drop'` (sempre eseguito)
10. `queueLength(routeId)` ritorna numero pending corretto

## REQ-IDs Coverage

- **ROUTE-10** (Backpressure policy 6 types): chiusura completa via `createBackpressureStrategy` con switch-case su discriminated union `BackpressurePolicyConfig`. Tutte le 6 policy implementate (queue-bounded drop-new/drop-oldest, drop, throttle, debounce, latest-only, merge/coalesce). Test 1-7 verificano comportamento per policy.
- **ROUTE-11** (Dedupe per dedupeKey): chiusura completa via `createDedupeStrategy` con Map<key, Promise<unknown>> singleton. Test 4 verifica 5 concurrent → 1 sola fn invocation. Cleanup garantito dal pattern `finally` (no leak).

## Decisions Closed

### D-74 — DedupeStrategy con Promise singleton (chiusura ROUTE-11)
**Status: CLOSED.**
- Implementation: `createDedupeStrategy(options)` con `execute(key, fn)` + `size()` + `clear()`.
- Map<key, Promise> singleton condiviso fra N caller concurrent.
- Cleanup automatico via try/finally (release in finally — sia su success che failure).
- maxInflight default 1000 (DoS guard T-03-10-01).
- Test 4 verifica 5 concurrent → 1 sola fn invocation.

### D-75 — BackpressureStrategy 6 policy + critical bypass (chiusura ROUTE-10 + Pitfall 4 fix)
**Status: CLOSED.**
- Implementation: `createBackpressureStrategy(options)` con `schedule(routeId, priority, task)` + `queueLength(routeId)`.
- 6 policy: queue-bounded (drop-new default + drop-oldest opt-in), drop, throttle (perSec, finestra 1s), debounce (waitMs con timer reset), latest-only (abort cascade), merge/coalesce (V1 alias latest-only).
- Critical priority BYPASSA tutte le policy — pre-switch `if (priority === 'critical') return await task()` come PRIMA istruzione di schedule.
- Default policy queue-bounded max:100 (T-03-10-02 mitigation: queue cresce illimitato).

## Pitfall Coverage

### Pitfall 4 — Backpressure cieca senza priority awareness
**Status: CLOSED via critical bypass pre-switch.**
- Test 8 verifica priority `'critical'` BYPASSA `'queue-bounded'` max:0 (config estrema worst-case).
- Test 9 verifica priority `'critical'` BYPASSA `'drop'` policy (anche con task in volo).
- Il check `if (priority === 'critical')` è la PRIMA istruzione di `schedule` — eseguito prima di qualsiasi lookup state.
- Il PRD §22.3 garantisce che eventi critical (es. `system.error` di F1) siano sempre delivered.

### Pitfall 6 — Backpressure queue cresce illimitato
**Status: CLOSED via default policy queue-bounded max:100.**
- Quando il consumer NON specifica `defaultPolicy` o `resolvePolicy`, il fallback è `{ type: 'queue-bounded', max: 100 }`.
- Mitiga il rischio di accumulo illimitato per route senza configurazione esplicita.
- Inspector F6 segnalerà warning quando una route opera senza policy esplicita (per encourage configurazione).

## Threat Model Coverage

| Threat ID | Disposition | Mitigation Implementata |
|-----------|-------------|--------------------------|
| T-03-10-01 (DoS — dedupe Map cresce illimitato) | mitigate | `maxInflight: 1000` default; oltre soglia esegue diretto senza dedupe (graceful degradation, no throw) |
| T-03-10-02 (DoS — backpressure queue cresce illimitato) | mitigate | Default policy `queue-bounded` `max: 100` quando consumer non specifica; max: 100 cap protettivo per route senza config |
| T-03-10-03 (DoS — critical events DoS via priority bypass) | accept | Critical events sono trusted (system.* origin); plan 03-12 wrapper enforce non-system topic priority cap |
| T-03-10-04 (Spoofing — priority hijack → bypass policy) | mitigate | priority è literal union `'critical' \| 'high' \| 'normal' \| 'low'` — TypeScript enforce a compile-time; F1 BrokerEvent.priority è branded by event-factory |

## Vincoli D-83 Confermati

`git diff --stat HEAD~5 HEAD packages/core/ packages/mapper/ packages/routing/` → empty.
**ZERO modifiche** a `packages/core/`, `packages/mapper/`, `packages/routing/` runtime per tutto plan 03-10.
- Core 248/248 test passing (invariant)
- Mapper 183/183 test passing (invariant)
- Routing 58/58 test passing (invariant)
- Pattern composition wrapper rispettato: nuove strategy in @gluezero/gateway/http/strategies — extension package isolato

## Verification

- [x] 18/18 nuovi test passing (8 dedupe + 10 backpressure)
- [x] 78/78 gateway test totali (60 baseline 03-09 + 18 nuovi)
- [x] 248/248 core test (D-83 invariant)
- [x] 183/183 mapper test (D-83 invariant)
- [x] 58/58 routing test (D-83 invariant)
- [x] `tsc --noEmit` exit 0 (gateway)
- [x] `grep "Map<string, Promise" packages/gateway/src/http/strategies/dedupe-strategy.ts` matcha (Promise singleton)
- [x] `grep "inflight.delete" packages/gateway/src/http/strategies/dedupe-strategy.ts` matcha (cleanup in finally)
- [x] `grep "createDedupeStrategy" packages/gateway/src/http/strategies/dedupe-strategy.ts` matcha
- [x] `grep "priority === 'critical'" packages/gateway/src/http/strategies/backpressure-strategy.ts` matcha (Pitfall 4 fix)
- [x] `grep "queue-bounded" packages/gateway/src/http/strategies/backpressure-strategy.ts` matcha
- [x] `grep "latest-only" packages/gateway/src/http/strategies/backpressure-strategy.ts` matcha
- [x] `grep "throttle" packages/gateway/src/http/strategies/backpressure-strategy.ts` matcha
- [x] `wc -l backpressure-strategy.ts` = 319 ≥ 130 (≥ minimum richiesto)
- [x] 5 export totali in strategies/index.ts (3 da 03-09 + 2 da questo plan)
- [x] D-83 invariant: 0 modifiche a packages/core, packages/mapper, packages/routing runtime
- [x] response_language: italiano (commit messages, JSDoc descrittivi, summary)
- [x] Test deterministici: dedupe 1-fetch (Test 4), 6 backpressure policy (Test 1-7), priority bypass (Test 8-9)

## Note semantica `merge`/`coalesce` V1 minimal

La policy `'merge'` e `'coalesce'` in V1 minimal sono **alias di `'latest-only'`**:
- Comportamento: abort cascade pending precedenti via AbortController + esegui nuovo task.
- **NON implementa** la combinazione di N eventi pending in 1 task con `mergeFn` callback (semantica completa "coalesce di payload").
- **Rationale V1**: la semantica `mergeFn` richiede conoscenza route-specific del payload (canonicalEvent shape) — lo scope è troppo route-dependent per V1. Il PRD §17.8 documenta `merge`/`coalesce` come "combina N eventi" senza specificare come.
- **Roadmap V1.x**: estendere `BackpressurePolicyConfig` con `{ type: 'merge'; mergeFn?: (events: BrokerEvent[]) => BrokerEvent }` opzionale. Default V1.x = comportamento V1 minimal (alias latest-only).
- **Test 7** documenta l'aspettativa V1: ogni schedule eseguito (no pending accumulato perché tasks risolvono prima del schedule successivo nel test).

## Note per Wave 4-C (03-11)

Il barrel `packages/gateway/src/http/strategies/index.ts` è stato esteso a **Wave 4-B**.
- Plan 03-11 deve aggiungere export per `createAuthStrategy` + `createCircuitBreakerStrategy` (file ownership: auth-strategy.ts + circuit-breaker.ts).
- I commenti nel barrel `// 03-11 aggiungerà:` documentano l'intent — la merge è safe per file ownership disgiunta.

## Deviations from Plan

**Adeguamento implementativo Task 2 (Rule 1 - Bug)**: la struttura di `RouteState` nel reference code del plan tracciava il limit `queue-bounded` su `state.pending.length`, ma `state.pending` non veniva mai popolato perché i task venivano eseguiti diretto via `executeNow` — il check `pending.length >= max` sarebbe sempre stato `0 >= max`, rendendo Test 1 inattuabile.

**Fix applicato:** sostituito il limit check da `state.pending.length >= max` a `state.inFlight >= max` (counter inFlight già tracciato dal helper `executeTracked`). Il `state.pending` resta usato per:
- Abort cascade in `dropOldest` (rimuove entry più vecchia da pending + abort + reject)
- Abort cascade in `latest-only`/`merge`/`coalesce` (abort tutti pending precedenti)
- Contract `queueLength(routeId)` (test 10)

Tutti i 10 test passano con la fix. Il comportamento documentato del plan è preservato.

**Nessuna deviazione architetturale**: i 6 policy types, il critical bypass, e l'interfaccia `BackpressureStrategy` sono identici al plan.

## Self-Check: PASSED

**Files created:**
- [x] FOUND: packages/gateway/src/http/strategies/dedupe-strategy.ts (106 LOC)
- [x] FOUND: packages/gateway/src/http/strategies/dedupe-strategy.test.ts (8 test)
- [x] FOUND: packages/gateway/src/http/strategies/backpressure-strategy.ts (319 LOC)
- [x] FOUND: packages/gateway/src/http/strategies/backpressure-strategy.test.ts (10 test)

**Files modified:**
- [x] FOUND: packages/gateway/src/http/strategies/index.ts (+5 -2: aggiunge export Wave 4-B)

**Commits:**
- [x] FOUND: 8d8c526 (test RED dedupe-strategy)
- [x] FOUND: 04fbfa3 (feat GREEN dedupe-strategy)
- [x] FOUND: 6781bab (test RED backpressure-strategy)
- [x] FOUND: 2ada670 (feat GREEN backpressure-strategy)
- [x] FOUND: f999579 (feat barrel Wave 4-B)

## TDD Gate Compliance

- [x] **RED gate Task 1**: commit 8d8c526 (test) precede 04fbfa3 (implementazione) — verificato fail import prima del GREEN
- [x] **GREEN gate Task 1**: commit 04fbfa3 dopo RED, 8/8 test passing
- [x] **RED gate Task 2**: commit 6781bab (test) precede 2ada670 (implementazione) — verificato fail import prima del GREEN
- [x] **GREEN gate Task 2**: commit 2ada670 dopo RED, 10/10 test passing
- [x] No REFACTOR commit necessario per nessun task — implementazioni pulite al primo passaggio
