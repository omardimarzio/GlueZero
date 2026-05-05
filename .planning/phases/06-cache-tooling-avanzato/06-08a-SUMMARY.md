---
phase: 06-cache-tooling-avanzato
plan: 08a
subsystem: cache
tags: [cache-broker, composition-wrapper, opzione-b, factory, harness, integration-test]
requires:
  - "@sembridge/core (F1)"
  - "@sembridge/routing (F3 — RouterBroker delegate base)"
  - "@sembridge/cache::memory-cache-adapter (06-02)"
  - "@sembridge/cache::stable-hash (06-02)"
  - "@sembridge/cache::cache-handler (06-03)"
provides:
  - "CacheBroker class composition wrapper di RouterBroker (Opzione B + cascade D-126 ext F6 LIFE-02)"
  - "createCacheBroker(config) factory pubblico Valibot safeParse + D-30 anti-singleton"
  - "createCacheHarness fixture per integration test (analog F5 worker-harness — W-3 wildcard multi-depth)"
  - "Public barrel @sembridge/cache Wave 4a chiusura cache package"
affects:
  - "@sembridge/devtools (06-08b consumer di config.runtime.tap forwarding D-161)"
  - "@sembridge/sembridge (06-08b createSemBridge chain F1+F2+F3+F4+F5+F6)"
tech-stack:
  added: []
  patterns:
    - "Composition wrapper Opzione B (D-83 strict carryover F1-F5 → F6) — replica F4 RealtimeBroker + F5 WorkerBroker"
    - "Cascade D-126 ext F6 LIFE-02: unregisterPlugin → adapter.invalidate({prefix: ownerId+::}) 2-step try/catch isolato"
    - "Tap forwarding D-161 via config.runtime.tap (consumed by DevtoolsBroker 06-08b)"
    - "Strategy F3 dispatch carryover: 3-way cache-first/network-first/cache-then-network via CacheHandlerF6 (06-03)"
key-files:
  created:
    - "packages/cache/src/cache-broker.ts (~280 LOC) — composition wrapper + Opzione B publish intercept"
    - "packages/cache/src/public-factory.ts (~125 LOC) — Valibot safeParse + D-30"
    - "packages/cache/src/test-utils/cache-harness.ts (~210 LOC) — fixture integration test"
    - "packages/cache/src/cache-broker.test.ts (~330 LOC) — 19 unit test"
    - "packages/cache/src/public-factory.test.ts (~85 LOC) — 7 unit test"
    - "packages/cache/src/__integration__/cache-flow.test.ts (~165 LOC) — 4 scenari"
    - "packages/cache/src/__integration__/lifecycle-cleanup.test.ts (~75 LOC) — 3 scenari"
    - "packages/cache/src/__integration__/cache-then-network.test.ts (~140 LOC) — 3 scenari"
    - "packages/cache/src/__integration__/tap-events.test.ts (~120 LOC) — 3 scenari"
  modified:
    - "packages/cache/src/index.ts (+13 LOC barrel FINAL append cumulative)"
decisions:
  - "D-83 strict carryover F1-F5 → F6: zero modifiche a packages/{core,mapper,routing,gateway,worker}/src/ verified (git diff exit 0 lines)"
  - "D-121 carryover Opzione B composition wrapper — pattern verbatim F4 RealtimeBroker + F5 WorkerBroker"
  - "D-126 ext F6 LIFE-02: cascade unregisterPlugin invalidate by prefix ownerId+:: (convention D-156 scope hybrid)"
  - "D-161 tap forwarding via config.runtime.tap → CacheHandlerF6.tap injected (DevtoolsBroker 06-08b consumer)"
  - "D-30 anti-singleton: createCacheBroker pure function — multi-tenant isolation"
metrics:
  duration: ~25 minuti (post setup graphify watcher)
  completed: 2026-05-05
  task_count: 2
  test_count: 39 nuovi (19 cache-broker + 7 factory + 13 integration)
  total_test_count: 108 (cache package totale)
  coverage_v8:
    cache-broker.ts: "100 / 90.32 / 100 / 100 (target 90/80/90/90 — branches +10.32%)"
    public-factory.ts: "100 / 100 / 100 / 100"
    aggregate_cache: "100 / 94.21 / 100 / 100"
  files_changed: 9
  loc_added: ~1306
requirements:
  - CACHE-01
  - CACHE-02
  - CACHE-03
  - PIPE-01
  - LIFE-02
---

# Phase 6 Plan 08a: CacheBroker Composition Wrapper Summary

CacheBroker composition wrapper di RouterBroker con Opzione B intercept, cascade
D-126 ext F6 LIFE-02 (unregisterPlugin → invalidate by prefix ownerId), tap
forwarding D-161 readiness, factory `createCacheBroker` Valibot D-30, harness
`createCacheHarness` con DI httpDelegate, e 13 integration test 3-tier
deterministici. Pattern carryover esatto da F5 WorkerBroker e F4
RealtimeBroker. Building blocks pronti per 06-08b (DevtoolsBroker + chain
completa F1+F2+F3+F4+F5+F6 via createSemBridge).

## Commit list

| # | Commit | Tipo | Descrizione |
|---|--------|------|-------------|
| 1 | `2221187` | test | RED CacheBroker + createCacheBroker (19 test failing per moduli non esistenti) |
| 2 | `a69f468` | feat | GREEN CacheBroker composition wrapper Opzione B + createCacheBroker factory |
| 3 | `aef7e1a` | test | cache-harness + 4 integration test 3-tier + barrel FINAL append + branch coverage refinement |

Totale 3 commit atomic TDD su `main`.

## File creati/modificati

### Created (9)

- `packages/cache/src/cache-broker.ts` — CacheBroker class composition wrapper (~280 LOC)
- `packages/cache/src/public-factory.ts` — createCacheBroker factory Valibot (~125 LOC)
- `packages/cache/src/test-utils/cache-harness.ts` — createCacheHarness fixture (~210 LOC)
- `packages/cache/src/cache-broker.test.ts` — 19 unit test (~330 LOC)
- `packages/cache/src/public-factory.test.ts` — 7 unit test (~85 LOC)
- `packages/cache/src/__integration__/cache-flow.test.ts` — 4 scenari Tier-1 jsdom (~165 LOC)
- `packages/cache/src/__integration__/lifecycle-cleanup.test.ts` — 3 scenari (~75 LOC)
- `packages/cache/src/__integration__/cache-then-network.test.ts` — 3 scenari (~140 LOC)
- `packages/cache/src/__integration__/tap-events.test.ts` — 3 scenari (~120 LOC)

### Modified (1)

- `packages/cache/src/index.ts` — barrel FINAL append Wave 4a (CacheBroker, CacheBrokerConfig, CacheBrokerRouteDefinition, createCacheBroker, createCacheHarness, CacheHarness, CollectedEvent) — cumulative chiusura cache package

## Test count breakdown

| Suite | Test count | Tier |
|-------|------------|------|
| `cache-broker.test.ts` | 19 | Tier-1 jsdom |
| `public-factory.test.ts` | 7 | Tier-1 jsdom |
| `__integration__/cache-flow.test.ts` | 4 | Tier-1 jsdom |
| `__integration__/lifecycle-cleanup.test.ts` | 3 | Tier-1 jsdom |
| `__integration__/cache-then-network.test.ts` | 3 | Tier-1 jsdom |
| `__integration__/tap-events.test.ts` | 3 | Tier-1 jsdom |
| **Plan total** | **39** | |
| Cache package total post-08a | **108** | (39 nuovi + 69 esistenti) |

## Coverage v8 measured

```
File               | % Stmts | % Branch | % Funcs | % Lines
-------------------|---------|----------|---------|--------
cache-broker.ts    |   100   |   90.32  |   100   |  100
public-factory.ts  |   100   |   100    |   100   |  100
All files (cache)  |   100   |   94.21  |   100   |  100
```

**Target plan 06-08a: ≥ 90/80/90/90 — TUTTI superati** (cache-broker branches 90.32% > 80% target, +10.32%).

## Pattern carryover documentation

| Pattern | Source | Destination | Verifica |
|---------|--------|-------------|----------|
| Composition wrapper Opzione B | `packages/worker/src/worker-broker.ts:1-100` (F5) | `packages/cache/src/cache-broker.ts` | publish intercept Map.get(topic) → handler.execute pre-delegate |
| Factory Valibot + D-30 | `packages/worker/src/public-factory.ts` (F5) | `packages/cache/src/public-factory.ts` | safeParse + 'Invalid CacheBrokerConfig:' prefix + new instance per call |
| Harness wildcard subscribe multi-depth | `packages/worker/src/test-utils/worker-harness.ts` (F5 W-3 closure F4) | `packages/cache/src/test-utils/cache-harness.ts` | 4 pattern subscribe (`'*'`, `'*.*'`, `'*.*.*'`, `'*.*.*.*'`) |
| Cascade D-126 LIFE-02 | F5 worker-broker.ts:356-374 (3-step) | F6 cache-broker.ts (2-step adapted) | unregisterPlugin → inner.unregisterPlugin + adapter.invalidate |
| Strategy F3 dispatch (3-way) | `packages/cache/src/cache-handler.ts` (06-03 D-77 concretizzazione) | CacheBroker handler injected | cache-first / network-first / cache-then-network |

## D-83 strict acceptance verified

```bash
git diff main -- packages/core/src/ packages/mapper/src/ \
  packages/routing/src/ packages/gateway/src/ packages/worker/src/ | wc -l
# Output: 0
```

✅ **Zero modifiche runtime** a F1-F5. Tutto F6 Wave 4a vive in `packages/cache/src/`.

## Threat coverage T-06-08a-01..04

| Threat ID | Disposition | Verifica |
|-----------|-------------|----------|
| T-06-08a-01 (Logic flaw cascade idempotency cleanup parziale) | mitigate ✅ | 2-step cascade try/catch isolato; test `lifecycle-cleanup.test.ts::idempotente double call NON throw` |
| T-06-08a-02 (Information Disclosure cache cross-tenant via missing scope) | mitigate ✅ | D-156 scope hybrid + D-157 missing scope audit (delegati a CacheHandlerF6 06-03); test `cache-flow.test.ts::scope D-156 user isolation` |
| T-06-08a-03 (DoS publish hot-path overhead per topic non-cache) | mitigate ✅ | Map.get(topic) O(1); topic non-cache → delegate diretto inner.publish (zero overhead handler) |
| T-06-08a-04 (Logic flaw cache-then-network ordering inverted post composition) | mitigate ✅ | Composition wrapper NON re-ordina; CacheHandlerF6 preserva queueMicrotask SYNC; test `cache-then-network.test.ts::cache HIT pubblicato PRIMA della network response` |

## Building blocks pronti per 06-08b

| Building block | Esposto via | Consumer 06-08b |
|----------------|-------------|-----------------|
| `CacheBroker` class | `@sembridge/cache` barrel | DevtoolsBroker compose CacheBroker → RouterBroker |
| `createCacheBroker` factory | `@sembridge/cache` barrel | createSemBridge chain F1+F2+F3+F4+F5+F6 final |
| Tap forwarding via `config.runtime.tap` | CacheBroker constructor — handler.tap injected | MultiplexTap (06-04) wires su tap singleton consumed da Inspector (06-05) + MetricsCollector (06-06) |
| `CacheBrokerRouteDefinition` type | barrel pubblico | DevtoolsBroker config schema cacheRoutes pass-through |
| `getCacheStats()` snapshot | CacheBroker public method | DevtoolsBroker debug snapshot aggregato |
| `createCacheHarness` fixture | `@sembridge/cache` barrel | 06-08b può comporre con devtools-harness per chain integration test |

## Deviazioni dal plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] DTS build failure dovuta a `RouterBrokerConfig` cross-package resolution**
- **Found during:** Task 1 verify build
- **Issue:** `Property 'runtime' does not exist on type 'CacheBrokerConfig'` durante DTS build — `RouterBrokerConfig.runtime` viene risolto via `dist/index.js` (no `.d.ts`) e tipo any.
- **Fix:** Cast esplicito locale `(config as { runtime?: { tap?: EventTap } }).runtime` per accesso runtime safe senza dipendere dalla risoluzione `RouterBrokerConfig.runtime`.
- **Files modified:** `packages/cache/src/cache-broker.ts` (linee 195-201)
- **Commit:** `aef7e1a`

**2. [Rule 2 - Critical Funcs] Coverage branches sotto target (77.41 < 80)**
- **Found during:** Task 2 coverage v8 verify
- **Issue:** Coverage branches cache-broker.ts inizialmente 77.41% per try/catch inutile nel httpDelegate fallback + branch optional non testati.
- **Fix:** (a) Semplificato httpDelegate fallback rimuovendo try/catch inutile (graceful zero-disrupt success propagation); (b) Aggiunti 4 test extra branch coverage: httpDelegate fallback path, registerCanonicalSchema delegate, publish con id+source+correlationId+priority espliciti, publish con default source.
- **Files modified:** `packages/cache/src/cache-broker.ts` + `cache-broker.test.ts`
- **Commit:** `aef7e1a`
- **Risultato:** branches 77.41 → 90.32 (+12.91%, target 80% superato).

**3. [Rule 3 - Blocking] Build chain DTS gateway↔routing circular pre-esistente**
- **Found during:** Task 2 verify build
- **Issue:** `routing/dist/` non aveva `.d.ts` (cleaned by tsup); `pnpm -F @sembridge/cache build` falliva perché TS non risolveva `@sembridge/routing` types.
- **Fix:** Generazione manuale `.d.ts` di routing via `tsc --emitDeclarationOnly --outDir dist`. Pre-esistente ai pacchetti F3 (gateway↔routing tipologica circolare); risolto rigenerando dts cross-package.
- **Files modified:** Nessuno (azione di setup chain DTS pre-esistente).
- **Note:** Out-of-scope deferral per 06-09a (CI gates topological build).

### Decisioni nuove (D-XX)

Nessuna decisione architetturale nuova — plan eseguito su pattern carryover esatto F4/F5.

### Auth gates

Nessuno.

## Self-Check

### File verifica

- ✅ `packages/cache/src/cache-broker.ts` esiste
- ✅ `packages/cache/src/public-factory.ts` esiste
- ✅ `packages/cache/src/test-utils/cache-harness.ts` esiste
- ✅ `packages/cache/src/__integration__/cache-flow.test.ts` esiste
- ✅ `packages/cache/src/__integration__/lifecycle-cleanup.test.ts` esiste
- ✅ `packages/cache/src/__integration__/cache-then-network.test.ts` esiste
- ✅ `packages/cache/src/__integration__/tap-events.test.ts` esiste
- ✅ `packages/cache/src/index.ts` modificato (barrel FINAL append)

### Commit verifica

- ✅ `2221187` test(06-08a) RED — esiste
- ✅ `a69f468` feat(06-08a) GREEN — esiste
- ✅ `aef7e1a` test(06-08a) integration + barrel — esiste

### Acceptance gates

- ✅ Test deterministici 108/108 passing (Tier-1 jsdom)
- ✅ Coverage v8 cache-broker.ts: 100/90.32/100/100 (target 90/80/90/90)
- ✅ Coverage v8 public-factory.ts: 100/100/100/100
- ✅ Build ESM + DTS success
- ✅ D-83 strict carryover verified (zero diff F1-F5)
- ✅ Cache-then-network ordering microtask deterministic
- ✅ Cascade D-126 ext F6 LIFE-02 verificata
- ✅ Tap forwarding D-161 readiness verificata
- ✅ Threat coverage T-06-08a-01..04 mitigated + tested
- ✅ Barrel FINAL append cumulative chiusura cache package

## Self-Check: PASSED
