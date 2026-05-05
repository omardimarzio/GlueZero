---
phase: 06-cache-tooling-avanzato
plan: 03
subsystem: cache-handler-runtime
tags: [cache, strategy, scope-hybrid, microtask-ordering, d-83-strict, sanitized-error]
requires: [06-01, 06-02]
provides:
  - createCacheHandlerF6
  - createCompositeHandlerF6
  - deriveTopicFromCache
  - RouteCacheCompiled
  - RouteCompositeCompiled
  - CacheHandlerF6Deps
  - CompositeHandlerF6Deps
  - CacheHandlerOutcome
  - CompositeHandlerOutcome
affects: []
tech-stack:
  added: []
  patterns:
    - Strategy F3 dispatch (D-152 analog F5 worker-handler.ts)
    - Factory + DI deps (publishFn + httpHandler + cache + tap)
    - queueMicrotask SYNC ordering (RESEARCH §15.6 cache-then-network)
    - Scope hybrid route>config (D-156 — coerente F3 D-69/D-79 hierarchy)
    - Sanitized error D-80 carryover (no originalError/stack/cause)
    - Closure flag warn-once carryover F3 composite-handler.ts:67-130 (eliminato F6)
    - Graceful fallback cache adapter failure → http delegate (T-06-03-XX)
key-files:
  created:
    - packages/cache/src/cache-handler.ts
    - packages/cache/src/cache-handler.test.ts
    - packages/cache/src/composite-handler.ts
    - packages/cache/src/composite-handler.test.ts
  modified:
    - packages/cache/src/index.ts
decisions:
  - D-77 concretizzazione (F3 cache.not-implemented stub) — runtime via createCacheHandlerF6 + createCompositeHandlerF6
  - D-83 strict carryover — zero modifiche packages/{core,mapper,routing,gateway,worker}/src/
  - D-155 cacheKey default + D-156 scope hybrid + D-157 missing scope auth bypass + audit
  - D-161 lifecycle events via tap injected (event.cache.lookup/hit/miss)
  - Sanitized error category 'route' (NON 'cache' — F1 ErrorCategory non include 'cache', accept fallback coerente con F3 03-11 BLOCKER)
metrics:
  duration: ~25 min
  completed: 2026-05-05
---

# Phase 6 Plan 03: CacheHandler + CompositeHandler F6 Concretizzazione D-77 Summary

**One-liner:** `createCacheHandlerF6` 3-strategy dispatch (cache-first / network-first / cache-then-network) con scope hybrid D-156 + microtask ordering RESEARCH §15.6 + `createCompositeHandlerF6` orchestrator workflow cache→http che concretizza il placeholder F3 D-77 `cache.not-implemented` senza modificare F1-F5 (D-83 strict).

---

## Cosa è stato creato

| File | LOC | Descrizione |
|------|-----|-------------|
| `packages/cache/src/cache-handler.ts` | 452 | `createCacheHandlerF6` factory Strategy F3 dispatch — 3 strategy mode (cache-first/network-first/cache-then-network) + scope hybrid D-156 + D-157 missing scope auth bypass + sanitized error D-80 + lifecycle events tap D-161 + `deriveTopicFromCache` helper analog F5 D-146. |
| `packages/cache/src/cache-handler.test.ts` | 597 | 23 test deterministici Tier-1 jsdom: factory shape (1) + 3-strategy × HIT/MISS/error (8) + scope hybrid (3) + missing scope auth (1) + cache-then-network ordering replaces (2) + custom key callback override + throw fallback (2) + TTL fake-timers (1) + sanitized error D-80 shape (1) + tap lifecycle events D-161 (1) + deriveTopicFromCache helper (1) + error path coverage per strategy (4). |
| `packages/cache/src/composite-handler.ts` | 181 | `createCompositeHandlerF6` orchestrator workflow cache→http: cache step HIT short-circuit | MISS/error fallback http step | edge case solo cache MISS → `composite.no-fallback`. Pattern factory analog F3 composite-handler.ts:67-130 — F6 elimina warning `cache-deferred` F3. Graceful fallback cache adapter failure → http delegate. |
| `packages/cache/src/composite-handler.test.ts` | 264 | 10 test deterministici Tier-1 jsdom: factory (1) + workflow HIT/MISS (2) + edge cases solo http / solo cache MISS (2) + closure flag warn-once F6 elimina warning F3 (1) + graceful fallback cacheHandler throw (1) + http step error → outcome error (1) + integration cacheRoute invariato (1) + barrel export (1). |
| `packages/cache/src/index.ts` | +18 | Append runtime exports W2-bis: `createCacheHandlerF6` + `createCompositeHandlerF6` + types pubblici (`RouteCacheCompiled`, `RouteCompositeCompiled`, `CacheHandlerF6Deps`, `CompositeHandlerF6Deps`, `CacheHandlerOutcome`, `CompositeHandlerOutcome`, `CacheHttpDelegate`, `CompositeHttpDelegate`, `CachePublishFn`, `RouteCompositeStep`). |

**Totale:** 4 file creati (~1494 LOC src+test) + 1 modificato.

---

## Commit list (4 atomic TDD)

| # | Hash    | Type | Subject |
|---|---------|------|---------|
| 1 | 7e7928f | test | RED test cache-handler (D-77 concretizzazione + 3-strategy + scope hybrid) — 19 test |
| 2 | 4b9b05d | feat | GREEN cache-handler 3-strategy + scope hybrid + D-77 concretizzazione — +4 test coverage gate (23 tot) |
| 3 | 488e770 | test | RED test composite-handler F6 concretizzazione (D-77) — 10 test |
| 4 | a9993cc | feat | GREEN composite-handler F6 concretizza F3 stub D-77 — workflow orchestrator |

Pattern TDD strict: ogni feat preceduto da RED test failing.

---

## Test count + coverage

**Test:** 33 nuovi test (23 cache-handler + 10 composite-handler) — tutti deterministici Tier-1 jsdom.

**Cache package totale:** 71 test passing (38 baseline + 33 nuovi). Zero flaky, zero skipped.

**Coverage v8 sui 4 file F6 (target ≥90/80/90/90):**

| File | Stmt | Branch | Func | Lines | Status |
|------|------|--------|------|-------|--------|
| `cache-handler.ts` | 100% | 92.5% | 100% | 100% | ✅ sopra soglia |
| `composite-handler.ts` | 100% | 100% | 100% | 100% | ✅ sopra soglia |
| `memory-cache-adapter.ts` (06-02) | 100% | 96.29% | 100% | 100% | ✅ |
| `stable-hash.ts` (06-02) | 100% | 100% | 100% | 100% | ✅ |

**Aggregate package:** 100% / 95.4% / 100% / 100%.

**Cross-package full monorepo zero regression:**

| Package | Test | Status |
|---------|------|--------|
| core | 248 | ✅ |
| mapper | 183 | ✅ |
| gateway | 222 + 3 skipped | ✅ |
| routing | 103 | ✅ |
| cache | 71 | ✅ |
| devtools | 28 | ✅ |
| worker | 121 | ✅ |
| **TOTALE** | **976 passing** | ✅ |

---

## Pattern carryover

**Pattern primario** (F5 worker-handler.ts Strategy F3 dispatch — D-152 analog):
- `WorkerHandlerDeps` → `CacheHandlerF6Deps` (publishFn + cache + scopeProvider + httpHandler)
- `worker.execute(event, route)` → `cacheHandler.execute(event, route)` 3-strategy dispatch
- Sanitized error shape D-80 esatta (cache errors `category: 'route'` — F1 `ErrorCategory` non include `'cache'`, fallback coerente con F3 03-11 BLOCKER 1 fix `'auth'` → `'config'`)
- Topic auto-derive helper `deriveTopicFromCache` analog F5 `deriveTopic` (suffix-replace su `<topic>.requested`)

**Pattern secondario** (F3 composite-handler.ts:67-130 factory + closure flag):
- F6 NON usa più `cacheWarnEmitted` flag (cache step concretizzato — regression guard T-06-03-05)
- F6 elimina il warning `routing.composite.cache-deferred` F3 — workflow cache→http reale ora funziona
- Test 6 verifica via `console.warn` spy che NON viene chiamato

---

## Decisione Opzione B vs B' (verifica per 06-08)

**Opzione B preferred** (RouteExecutorDeps DI extension):
- Verifica `packages/routing/src/route-executor.ts` `RouteExecutorDeps` interface F3 — accetta extension via DI? Pattern già presente per `httpHandler` + `resolveSubRoute` (D-65). Aggiungere `cacheHandler?: CacheHandlerF6` + `compositeCacheStep?: CompositeHandlerF6` come field opzionali è extension naturale.
- **Vincolo D-83 strict per 06-08:** se l'aggiunta richiede modifica a `RouteExecutorDeps` interface in `packages/routing/src/`, allora si viola D-83. Soluzione: dichiarazione del field via TS declaration merging in `packages/cache/src/augment.ts` (analog `BrokerConfig.cache` plan 06-01).
- **Limitazione TS R4 (RESEARCH §17):** `RouteExecutorDeps` è interface → declaration merging supportato. Field aggiuntivi `cacheHandler?` e `compositeCacheStep?` in modulo `'@sembridge/routing/route-executor'` o re-export tramite `@sembridge/routing` package augmentation.

**Opzione B' fallback** (composition wrapper PRE-RouterBroker intercept publish):
- `CacheBroker` plan 06-08 intercetta `publish()` PRE-delegate a `inner.publish` (RouterBroker F3) — pattern coerente con `WorkerBroker.publish` intercept Opzione B research §7.2 (F5 D-152 carryover).
- Per topic con route `type: 'cache' | 'composite'` registrate, gestisce dispatch direttamente al `cacheHandler` / `compositeHandler` bypassando F3 RouteExecutor per quei type.
- Pattern coerente con F4 `RealtimeBroker` istanzia internamente `RealtimeChannelManager` (plan 04-08).

**Decisione raccomandata per 06-08:** valutare Opzione B come prima scelta; se fallisce per limitazione decl merging interface `RouteExecutorDeps`, fallback a Opzione B'. Entrambe le opzioni preservano D-83 strict.

---

## Threat coverage T-06-03-01..06

| Threat | Mitigation | Verifica test |
|--------|------------|---------------|
| **T-06-03-01** Information Disclosure cross-tenant cache leakage | D-156 scope hybrid `route.cache.scope?.(event) ?? deps.scopeProvider?.(event) ?? null`. Cache key prefix `${scope}::${baseKey}` (06-02 cacheKey). D-157 missing scope auth bypass cache + audit. | Test 9-12 (scope hybrid 3 + missing scope D-157 1) |
| **T-06-03-02** Logic flaw cache-then-network ordering inverted | RESEARCH §15.6: cache hit publish via `queueMicrotask()` SYNC subito, prima di `await fetch`. Remote publish include `replaces: event.id` puntante al cache event. | Test 7 + 13 ordering deterministico |
| **T-06-03-03** DoS cache stampede su MISS | DELEGATO a F3 D-74 KeyBased gateway dedupe (`packages/gateway/src/http/strategies/dedupe-strategy.ts`). F6 cache layer non implementa dedupe — composition wrapper 06-08 garantisce passaggio MISS → http handler → dedupe wrapper → 1 sola fetch. | Deferred a 06-08 wiring (cache layer non-blocking) |
| **T-06-03-04** Tampering route.cache.key callback throw | try/catch wrap su `route.key?.(event)` — fallback a `cacheKey()` default 06-02 + emit `system.cache.key-callback-failed` audit. | Test 15 callback throw → fallback + audit |
| **T-06-03-05** Logic flaw composite-handler skipped F3 silently | F6 elimina warning `cache-deferred` (cache step concretizzato — chiama cacheHandler reale). Closure flag F3 NON più necessaria. | Test 6 verifica `console.warn` NON chiamato (regression guard) |
| **T-06-03-06** Information Disclosure originalError leak in publishFailure | Sanitized error shape D-80 carryover: payload `{ code, category, message, routeId, topic, eventId }` — NO `originalError`/`stack`/`cause`. | Test 17 verifica payload shape — `expect(payload.error?.originalError).toBeUndefined()` |

---

## D-83 strict acceptance verified

```bash
$ git diff main packages/core/src packages/mapper/src packages/routing/src packages/gateway/src packages/worker/src
# (output vuoto — zero diff)
```

✅ Acceptance verified: zero modifiche fuori da `packages/cache/src/`. F6 vive solo nel suo package.

---

## Building blocks pronti per 06-08

| Building block | Status | Consumer 06-08 |
|----------------|--------|----------------|
| `createCacheHandlerF6` | ✅ ready | `CacheBroker` istanzia + inietta in RouterBroker (Opzione B) o intercept publish (Opzione B') |
| `createCompositeHandlerF6` | ✅ ready | `CacheBroker` orchestrator workflow cache→http per type='composite' route |
| `deriveTopicFromCache` | ✅ ready | Helper consumer per topic outcome derivation `<topic>.loaded`/`.failed` |
| `RouteCacheCompiled` + `RouteCompositeCompiled` | ✅ types | Compiled route shape consumata dal CacheBroker dopo route resolution F3 |
| `CacheHandlerF6Deps` + `CompositeHandlerF6Deps` | ✅ types | Dependency injection signature per CacheBroker construction |
| `CacheHttpDelegate` + `CompositeHttpDelegate` | ✅ types | Httphandler delegate signature — CacheBroker binda al gateway F3 fetch |
| `CachePublishFn` | ✅ types | publishFn signature — CacheBroker binda a `inner.publish` RouterBroker |

---

## Deviazioni da plan

**Auto-fix Rule 1/2/3:** Zero deviazioni invasive. Nessun fix architetturale richiesto.

**Adattamento minor 1 (Rule 1):** Nel plan task 1 il codice di esempio usava `tap.onPipelineStep('event.cache.lookup' as 'event.observed', ...)` con doppio cast. Implementato con cast singolo `as unknown as 'event.received'` + helper `emitTap()` interno con try/catch (errori del tap swallowed coerente con D-20 carryover F1). Funzionalità identica al plan, codice più robusto.

**Adattamento minor 2 (Rule 1):** Nel plan task 1 usavo `createBrokerError({...})` direttamente per il payload pubblicato. Realizzato che `createBrokerError` produce shape con potenziali field internal — introdotto helper `buildSanitizedError()` interno che strip esplicitamente a `{ code, category, message, routeId, topic, eventId }`. Garantisce sanitization D-80 by construction (T-06-03-06 mitigation più robusta).

**Estensione test (Rule 2):** Aggiunti 4 test extra (Test 20-23) per coverage gate ≥90/90 statements/lines su `cache-handler.ts`. Senza questi test la baseline era 86.04 stmt / 85.71 lines (sotto soglia). Dopo i test extra: 100/92.5/100/100 ✅.

**Test count finale:** 23 cache-handler (vs 18 plan) + 10 composite-handler = 33 total (plan diceva ≥28 ⇒ supera).

**Auth gates:** Nessun auth gate. Esecuzione interamente autonoma in working tree locale.

---

## REQ-IDs marcati complete

- **CACHE-01** Cache adapter swappable — runtime done (composition wrapper 06-08 finalizzerà wiring).
- **CACHE-02** Strategy 3-mode dispatch — implementato (cache-first / network-first / cache-then-network).
- **CACHE-03** Cache metadata `origin: 'cache' | 'remote'` + `replaces` field — implementato in publish options.
- **PIPE-01** Pipeline §28 step ext F6 — lifecycle events `event.cache.{lookup,hit,miss,evicted}` emessi via tap injected (D-161). Step 14 attivo verrà finalizzato in 06-09a final gate.

---

## Self-Check: PASSED

**Files exist:**
- ✅ `packages/cache/src/cache-handler.ts` (FOUND)
- ✅ `packages/cache/src/cache-handler.test.ts` (FOUND)
- ✅ `packages/cache/src/composite-handler.ts` (FOUND)
- ✅ `packages/cache/src/composite-handler.test.ts` (FOUND)

**Commits exist (verified via git log):**
- ✅ 7e7928f (RED cache-handler)
- ✅ 4b9b05d (GREEN cache-handler)
- ✅ 488e770 (RED composite-handler)
- ✅ a9993cc (GREEN composite-handler)

**D-83 strict:** ✅ verified `git diff main packages/{core,mapper,routing,gateway,worker}/src/` = 0 lines.

**Build + Typecheck:** ✅ `pnpm -F @sembridge/cache build && typecheck` exit 0.

**Coverage gate ≥90/80/90/90:** ✅ cache-handler.ts 100/92.5/100/100, composite-handler.ts 100/100/100/100.

**Cross-package zero regression:** ✅ 976 test passing across full monorepo.
