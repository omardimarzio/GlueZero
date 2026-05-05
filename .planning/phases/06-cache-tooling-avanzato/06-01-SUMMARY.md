---
phase: 06-cache-tooling-avanzato
plan: 01
subsystem: cache+devtools+aggregate-bootstrap
tags:
  - bootstrap
  - decl-merging
  - augment.ts
  - pattern-s1
  - tdd-smoke
  - esm-only
  - tsup
  - vitest-3-tier
  - d-83-strict
requires:
  - "@sembridge/core (BrokerConfig, EventTap, BrokerEvent, PipelineSnapshot, PipelineStep) — F1"
  - "@sembridge/mapper (augment.ts F2) — F2"
  - "@sembridge/routing (RouteDefinition union F3) — F3"
  - "@sembridge/gateway (HTTP gateway F3 + sse-ws F4) — F3+F4"
  - "@sembridge/worker (augment.ts F5 pattern model) — F5"
provides:
  - "@sembridge/cache scaffold compilabile ESM-only (BrokerConfig.cache via decl merging + F6CachePipelineStep + CacheAdapter contract + CacheConfig + CacheEntry + CacheStats type-level)"
  - "@sembridge/devtools scaffold compilabile ESM-only (BrokerConfig.taps + BrokerConfig.devtools via decl merging + F6PipelineStep step 14 reale 'event.observed' + system audit + MetricsSnapshot + HistogramSummary + PauseAction + RouteInspectorEntry + DevtoolsConfig type-level)"
  - "@sembridge/sembridge aggregato pubblico scaffold (SemBridgeConfig + SemBridgeFeatures opt-out + placeholder Wave 4 06-08)"
  - "16 test smoke decl merging passing (8 cache + 8 devtools)"
  - "Pattern S1 anti tree-shake verified (__augmentCacheLoaded + __augmentDevtoolsLoaded preservati nel dist)"
  - "D-83 strict carryover acceptance gate passed (zero modifiche runtime F1-F5)"
affects:
  - "Wave 2 plan 06-02 (MemoryCacheAdapter + stable-hash) può importare CacheAdapter / CacheEntry / CacheStats / CacheConfig"
  - "Wave 2 plan 06-04 (MultiplexTap + tap-registry) può importare F6PipelineStep + DevtoolsConfig"
  - "Wave 3 plan 06-05/06/07 (Inspector + Metrics + PauseController) può importare relativi types"
  - "Wave 4 plan 06-08 (CacheBroker + DevtoolsBroker composition wrapper) ha augment già caricato side-effect"
tech-stack:
  added:
    - "tsup 8.5.1 ESM-only (cache + devtools 2 entries: index + augment; sembridge single entry index)"
    - "vitest 4.1.5 jsdom Tier-1 + @vitest/browser-playwright 4.1.5 Tier-3 (cache + devtools)"
    - "valibot 1.3.1 lockata (cache + devtools + sembridge)"
    - "nanoid 5.1.11 lockata (cache + devtools per Inspector entry id futuri)"
  patterns:
    - "Pattern S1 anti tree-shake (__augmentCacheLoaded + __augmentDevtoolsLoaded const literal + sideEffects glob in package.json)"
    - "TS declaration merging via augment.ts (declare module '@sembridge/core' BrokerConfig.cache / BrokerConfig.taps / BrokerConfig.devtools — campi disgiunti F2-F5)"
    - "F6CachePipelineStep + F6PipelineStep super-set additive literal union (workaround R4 type alias non merge-abile)"
    - "Coverage v8 thresholds 90/80/90/90 placeholder Wave 1 (calibration finale 06-09a — lesson learned F4-F5)"
    - "D-83 strict carryover acceptance gate (zero modifiche runtime F1-F5)"
key-files:
  created:
    - "packages/cache/package.json (manifest @sembridge/cache + workspace deps + sideEffects glob)"
    - "packages/cache/tsconfig.json (extends base + lib WebWorker)"
    - "packages/cache/tsup.config.ts (ESM-only 2 entries)"
    - "packages/cache/vitest.config.ts (Tier-1 jsdom + coverage v8)"
    - "packages/cache/vitest.browser.config.ts (Tier-3 Playwright Chromium)"
    - "packages/cache/src/types/cache-adapter.ts (CacheAdapter interface + CacheStats cumulative)"
    - "packages/cache/src/types/cache-config.ts (CacheConfig D-155/D-156/D-158)"
    - "packages/cache/src/types/cache-entry.ts (CacheEntry readonly)"
    - "packages/cache/src/types/index.ts (barrel types)"
    - "packages/cache/src/augment.ts (declare module BrokerConfig.cache + F6CachePipelineStep + __augmentCacheLoaded)"
    - "packages/cache/src/augment.test.ts (8 smoke decl merging)"
    - "packages/cache/src/index.ts (barrel S1 + type re-export)"
    - "packages/devtools/package.json (manifest @sembridge/devtools + workspace deps senza gateway)"
    - "packages/devtools/tsconfig.json"
    - "packages/devtools/tsup.config.ts"
    - "packages/devtools/vitest.config.ts"
    - "packages/devtools/vitest.browser.config.ts"
    - "packages/devtools/src/types/metrics.ts (MetricsSnapshot + HistogramSummary + MetricsDelta D-163/D-165)"
    - "packages/devtools/src/types/inspector-entry.ts (RouteInspectorEntry + EventInspectorSnapshot + PipelineSnapshot re-export D-167)"
    - "packages/devtools/src/types/pause-state.ts (PauseAction + PauseControllerSnapshot + FlushQueueResult D-168/D-169/D-170)"
    - "packages/devtools/src/types/devtools-config.ts (DevtoolsConfig D-160/D-167/D-170)"
    - "packages/devtools/src/types/index.ts (barrel types)"
    - "packages/devtools/src/augment.ts (declare module BrokerConfig.taps + BrokerConfig.devtools + F6PipelineStep step 14 + __augmentDevtoolsLoaded)"
    - "packages/devtools/src/augment.test.ts (8 smoke decl merging)"
    - "packages/devtools/src/index.ts (barrel S1 + type re-export completo)"
    - "packages/sembridge/package.json (aggregato deps su 7 sub-package workspace:*)"
    - "packages/sembridge/tsconfig.json"
    - "packages/sembridge/tsup.config.ts (single entry + external all sub-package)"
    - "packages/sembridge/vitest.config.ts (placeholder Wave 4)"
    - "packages/sembridge/src/types/sembridge-config.ts (SemBridgeConfig + SemBridgeFeatures opt-out)"
    - "packages/sembridge/src/index.ts (Wave 1 placeholder + commented runtime exports per Wave 4)"
  modified:
    - "pnpm-lock.yaml (workspace deps cache + devtools + sembridge)"
decisions:
  - "D-155/D-156/D-158 cache key + scope hybrid + LRU bounded: definiti type-level (CacheConfig + CacheAdapter); runtime in plan 06-02"
  - "D-159 tap registry chain: BrokerConfig.taps?: readonly EventTap[] declarato via augment devtools; runtime MultiplexTap in plan 06-04"
  - "D-160 enableDebug toggle lazy-mode: DevtoolsConfig.enableByDefault declarato; runtime PauseController + Inspector in plan 06-05/07"
  - "D-161 step 14 'event.observed' + lifecycle events: F6PipelineStep dichiarato come literal union additive (workaround R4 PipelineStep type alias non merge-abile)"
  - "D-163/D-165 metrics naming + reservoir: MetricsSnapshot {counters, gauges, histograms} + HistogramSummary {count, sum, p50, p90, p99} declarati type-level"
  - "D-167 ring buffer 500 default: DevtoolsConfig.eventBufferSize/routeBufferSize declarati"
  - "D-168/D-170 pauseTopic queue cap 1000 + critical bypass: PauseAction discriminated union declarata + DevtoolsConfig.pauseQueueMaxSize"
  - "D-83 strict carryover (CRITICO acceptance gate): F6 vive solo in packages/{cache,devtools,sembridge}/src/ + augment.ts; zero modifiche runtime F1-F5 verificato git diff exit 0 lines"
  - "Decisione minore autonoma: lib WebWorker aggiunto ai tsconfig di cache + devtools + sembridge per coerenza F5 (browser API surface; CacheAdapter potrebbe usare web standard API)"
  - "Decisione minore autonoma: biome.json omesso per cache/devtools/sembridge (workspace root inherit OK, analog F5 worker)"
  - "Decisione minore autonoma: nanoid 5.1.11 incluso anche in devtools/cache come precaution per Inspector entry id futuri (researcher §1 dice 'probabilmente non necessario — riuso event.id', ma include per compat con W4 senza modifiche package.json)"
  - "Decisione minore autonoma: external in tsup config sembridge include TUTTI i 7 workspace dep + valibot per garantire bundle aggregato consumer tree-shake friendly"
metrics:
  duration: "Wave 1 atomica — durata ~6 min (3 task auto bootstrap)"
  completed: "2026-05-05T17:13:21Z"
  tasks_completed: 3
  files_created: 33
  files_modified: 4
---

# Phase 6 Plan 01: Cache & Devtools Bootstrap Summary

Bootstrap dei 3 pacchetti F6 (`@sembridge/cache`, `@sembridge/devtools`, `@sembridge/sembridge`) come scaffold compilabile ESM-only via tsup, con augment.ts decl merging additive disgiunta su `BrokerConfig.cache` (D-155/D-156/D-158), `BrokerConfig.taps` (D-159 multiplex registry), `BrokerConfig.devtools` (D-160/D-167/D-170), super-set literal union `F6CachePipelineStep` (4 lifecycle events D-161) + `F6PipelineStep` (step 14 reale 'event.observed' + 4 system audit), Pattern S1 anti tree-shake verificato (`__augmentCacheLoaded` + `__augmentDevtoolsLoaded` preservati nel dist) e D-83 strict carryover acceptance gate passato (`git diff main...HEAD packages/{core,mapper,routing,gateway,worker}/src/` exit 0 lines — zero modifiche runtime F1-F5).

## Task Completati

| Task | Nome                                                                                                  | Commit  | Files |
|------|-------------------------------------------------------------------------------------------------------|---------|-------|
| 1    | Bootstrap @sembridge/cache — package.json + build/test config + augment + 4 type files                | 47eafb6 | 13    |
| 2    | Bootstrap @sembridge/devtools — package.json + build/test config + augment + 5 type files             | 249e7b1 | 14    |
| 3    | Bootstrap @sembridge/sembridge (aggregato) + cross-package typecheck full monorepo + audit acceptance | c45b20f | 7     |

**Totale:** 3 task, 33 file creati, 4 file modificati (placeholder F1 → F6 popolati: 3 package.json + pnpm-lock.yaml).

## Cross-Package Gate Full Monorepo

### Typecheck
```
pnpm -r typecheck
✓ 8 of 9 workspace projects (sembridge non lo skippa, lo include)
  - packages/core typecheck: Done
  - packages/mapper typecheck: Done
  - packages/routing typecheck: Done
  - packages/gateway typecheck: Done
  - packages/worker typecheck: Done
  - packages/cache typecheck: Done
  - packages/devtools typecheck: Done
  - packages/sembridge typecheck: Done
```
**Zero errori TS** su tutti gli 8 pacchetti.

### Test full monorepo
```
pnpm -r test
- core:      248 passing
- mapper:    183 passing
- routing:   103 passing
- gateway:   222 passing | 3 skipped (MSW V1.x F4)
- worker:    121 passing
- cache:       8 passing  ← NEW
- devtools:    8 passing  ← NEW
- sembridge:   0 passing (passWithNoTests, runtime in Wave 4 plan 06-08)
TOTAL:       893 passing + 3 skipped (atteso dal plan: 893+/896 ✓)
```

### Build ESM-only
```
pnpm -F @sembridge/cache build
  ESM dist/index.js     219 B   + dist/index.d.ts   171 B
  ESM dist/augment.js   223 B   + dist/augment.d.ts 6.15 KB

pnpm -F @sembridge/devtools build
  ESM dist/index.js     228 B   + dist/index.d.ts   4.24 KB
  ESM dist/augment.js   232 B   + dist/augment.d.ts 117 B (+ chunk 3.66 KB)

pnpm -F @sembridge/sembridge build
  ESM dist/index.js      68 B   + dist/index.d.ts   1.14 KB
```

## D-83 Strict Carryover Verification (CRITICO)

```
git diff main...HEAD -- packages/core/src/ packages/mapper/src/ packages/routing/src/ packages/gateway/src/ packages/worker/src/ | wc -l
0
```

**Acceptance gate ✓ PASSED.** F6 plan 06-01 vive esclusivamente in `packages/{cache,devtools,sembridge}/`, zero modifiche runtime ai 5 sub-package F1-F5. Pattern coerente con D-83 strict carryover F2 → F3 → F4 → F5 → F6.

## Pattern S1 Audit Anti Tree-Shake

```
grep "__augmentCacheLoaded" packages/cache/dist/index.js
  var __augmentCacheLoaded = true;
  export { __augmentCacheLoaded };          ✓ preservato

grep "__augmentDevtoolsLoaded" packages/devtools/dist/index.js
  var __augmentDevtoolsLoaded = true;
  export { __augmentDevtoolsLoaded };       ✓ preservato

grep "F6CachePipelineStep" packages/cache/dist/index.d.ts        ✓ in dts
grep "F6PipelineStep"      packages/devtools/dist/index.d.ts     ✓ in dts
```

`sideEffects` glob `["./dist/augment.js", "./src/augment.ts", "**/augment.js", "**/augment.ts"]` in entrambi i package.json garantisce che il bundler consumer NON tree-shaki l'import side-effect dell'augment.ts (T-06-01-01 mitigation). Verifica audit superata.

## REQ Progress (type-level scaffold Wave 1)

| REQ-ID    | Stato Wave 1 | Note                                                                                  |
|-----------|--------------|---------------------------------------------------------------------------------------|
| CACHE-01  | scaffold ✓   | CacheAdapter contract + CacheEntry + CacheStats declarati type-level                  |
| CACHE-02  | scaffold ✓   | invalidate(pattern: string \| RegExp \| {prefix}) signature in CacheAdapter           |
| CACHE-03  | scaffold ✓   | CacheConfig.scopeProvider + maxEntries declarati                                       |
| TOOL-01   | scaffold ✓   | EventInspectorSnapshot + PipelineSnapshot re-export                                   |
| TOOL-02   | scaffold ✓   | RouteInspectorEntry declarata                                                          |
| TOOL-03   | scaffold ✓   | MetricsSnapshot + HistogramSummary + MetricsDelta declarati                           |
| TOOL-04   | scaffold ✓   | DevtoolsConfig.enableByDefault + lazy-mode hot-path field declarato                   |
| TOOL-05   | scaffold ✓   | MetricsSnapshot {counters, gauges, histograms} chiude PRD §39 #10 type-level         |
| PIPE-01   | scaffold ✓   | F6PipelineStep declara 'event.observed' step 14 reale (D-161)                        |
| PKG-01    | done ✓       | Build ESM-only via tsup (3 pacchetti)                                                 |
| PKG-02    | done ✓       | dts integrato (3 pacchetti)                                                           |
| PKG-03    | done ✓       | Target ES2022 + browser evergreen (3 pacchetti)                                       |
| PKG-04    | done ✓       | Monorepo pnpm workspace + workspace:* protocol (8 pacchetti)                          |

I REQ CACHE-01..03 + TOOL-01..05 sono **type-level scaffold**: i type sono dichiarati ma il runtime arriva nelle wave successive (06-02..06-08). Plan 06-09 final gate verifica chiusura completa.

## Building Blocks Pronti per Wave 2 Parallel

Wave 2 plan 06-02 (MemoryCacheAdapter + stable-hash) ∥ plan 06-04 (MultiplexTap + tap-registry) può procedere in **parallel** con file ownership disgiunta:

- **06-02 owns:** `packages/cache/src/{memory-cache-adapter,memory-cache-adapter.test,stable-hash,stable-hash.test}.ts`
- **06-04 owns:** `packages/devtools/src/{multiplex-tap,multiplex-tap.test,tap-registry,tap-registry.test}.ts`

Entrambi possono importare i type creati in 06-01 senza conflitti git index. RouterBroker (F3) + WorkerBroker (F5) NON sono toccati (D-83 strict).

## Deviations from Plan

**Nessuna deviazione runtime.** Tutte le decisioni minori autonome erano già coperte dal `<action>` del plan come "Decisioni minori autonome (precedente F5)":
1. `lib WebWorker` aggiunto ai 3 tsconfig.json — coperto plan §3.2/3.4 (cache/devtools/sembridge)
2. `biome.json` omesso (workspace root inherit) — coperto plan §1.6/2.6
3. `nanoid 5.1.11` incluso in devtools come precaution Inspector entry id — coperto plan §1.1 nota
4. `external` tsup sembridge include TUTTI i workspace dep + valibot — coperto plan §3.3
5. Vitest CLI run senza flag `--passWithNoTests` aggiunto manuale (script package.json già lo ha; pnpm -r test doppio-aggiunge → errore CLI vitest 4.x). Risolto eseguendo `pnpm -r test` senza extra flag — issue minore di run, non di scaffold.

**CLAUDE.md compliance:** Lingua italiano nei commit message + descrizioni; codice/identificatori/path inglese. Modello opus inferito (esecuzione orchestrator). Boundary di sicurezza rispettato (lavoro solo dentro `/Users/omarmarzio/programming/prova AI/SemBridge/`).

## Self-Check: PASSED

**Files created (sample audit):**
- `[ -f packages/cache/src/augment.ts ]` ✓ FOUND
- `[ -f packages/cache/src/augment.test.ts ]` ✓ FOUND
- `[ -f packages/cache/src/types/cache-adapter.ts ]` ✓ FOUND
- `[ -f packages/devtools/src/augment.ts ]` ✓ FOUND
- `[ -f packages/devtools/src/types/metrics.ts ]` ✓ FOUND
- `[ -f packages/sembridge/src/index.ts ]` ✓ FOUND
- `[ -f packages/sembridge/src/types/sembridge-config.ts ]` ✓ FOUND

**Commits exist:**
- `git log --oneline | grep 47eafb6` ✓ FOUND (Task 1 cache)
- `git log --oneline | grep 249e7b1` ✓ FOUND (Task 2 devtools)
- `git log --oneline | grep c45b20f` ✓ FOUND (Task 3 sembridge + cross-package gate)

**D-83 strict gate:** ✓ PASSED (0 lines diff)
**Pattern S1 audit:** ✓ PASSED (markers preservati nel dist)
**Cross-package typecheck:** ✓ PASSED (zero errori 8 package)
**Cross-package test:** ✓ PASSED (893/896 passing + 3 skipped MSW V1.x)
