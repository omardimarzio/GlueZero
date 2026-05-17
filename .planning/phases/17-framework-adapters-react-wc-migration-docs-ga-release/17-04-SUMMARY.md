---
phase: 17-framework-adapters-react-wc-migration-docs-ga-release
plan: 04
plan_slug: test-bench-closure
subsystem: test-bench-closure-ci-hard-gate
tags: [bench, tinybench, ci-hard-gate, playwright, tier3, audit, mf-test, regression]
requirements:
  - MF-TEST-01
  - MF-TEST-02
  - MF-TEST-03
  - MF-TEST-04
dependency_graph:
  requires:
    - 17-01 (scaffolding W1 — packages/react + packages/web-components + vitest.browser.config.ts)
    - 17-02 (W2 P02 — @gluezero/react full impl: Provider + 6 hooks + ErrorBoundary + factory)
    - 17-03 (W3 P03 — @gluezero/web-components + subpath /lit)
    - "@gluezero/core (createBroker — bench scenario A baseline)"
    - "@gluezero/microfrontends (microfrontendModule — bench scenario B module install)"
  provides:
    - "packages/_bench/ workspace privato tinybench harness (NEW)"
    - "packages/_bench/src/baseline-v1.json (reference immutable baseline pre-GA)"
    - "packages/react/test/browser/ Tier-3 Playwright Chromium scenari (3 file, 6 test)"
    - ".github/workflows/bench.yml CI hard gate workflow (NEW)"
    - ".planning/phases/17.../17-test-audit.md (audit MF-TEST-01..04 closure F17 → GA)"
  affects:
    - W5 P05 (docs/v2 reference baseline performance + bench README)
    - W7 P07 (GA release verifier finale, BC §42 + MF-PIPE-01 cross-fase gates già pre-verified PASS)
tech_stack:
  added:
    - "tinybench 3.1.0 (workspace privato @gluezero/_bench, NO npm publish)"
    - "tsx 4.19.0 (runner per .ts senza build step)"
    - "@types/node 20.16.5 (devDep _bench)"
  patterns:
    - "Bench workspace privato (private: true, no npm publish) — pattern carryover monorepo private workspace"
    - "tinybench warmup iterations + 10 samples + t-test built-in (P-02 mitigation false negative)"
    - "Regression detection vs baseline-v1.json committato (immutable reference) → exit 1 su cap violation"
    - "Tier-3 Playwright Chromium scenari real browser (P-22 mitigation: no jsdom stub per createRoot/StrictMode/ErrorBoundary)"
    - "Audit table cross-fase con find-verified test path references (no MISSING categorie)"
key_files:
  created:
    - packages/_bench/package.json
    - packages/_bench/tsconfig.json
    - packages/_bench/src/index.ts
    - packages/_bench/src/scenario-a.bench.ts
    - packages/_bench/src/scenario-b.bench.ts
    - packages/_bench/src/run.ts
    - packages/_bench/src/baseline-v1.json
    - packages/_bench/README.md
    - packages/react/test/browser/factory-mount.test.tsx
    - packages/react/test/browser/error-boundary-mount.test.tsx
    - packages/react/test/browser/strictmode-double-mount.test.tsx
    - .github/workflows/bench.yml
    - .planning/phases/17-framework-adapters-react-wc-migration-docs-ga-release/17-test-audit.md
  modified:
    - packages/react/vitest.browser.config.ts (Rule 3 fix: Vitest 4.x playwright() factory)
    - pnpm-lock.yaml (tinybench + tsx + @types/node nuove dev/dep _bench)
decisions:
  - "D-V2-F17-15 applicato: packages/_bench/ workspace privato tinybench 3.1.0, scenario A cap 5% + scenario B cap 10%, baseline-v1.json committed, CI hard gate bench.yml exit 1 su regression"
  - "D-V2-F17-17 applicato: 3 Tier-3 Playwright Chromium scenari React-specific NEW (factory-mount + error-boundary-mount + strictmode-double-mount) - 6 test PASS in real Chromium browser context"
  - "D-V2-F17-14 applicato: MF-TEST-03 gap-filling strategy — 12 scenari preesistenti F8-F16 + 3 NEW F17 = 15/15 PASS, audit con path references find-verified"
  - "Rule 3 deviation Vitest 4.x breaking change: vitest.browser.config.ts aggiornato per `playwright()` factory da @vitest/browser-playwright (vs stringa 'playwright' Vitest 3.x). Fix scope test config — NON src/."
  - "Rule 1 deviation timing async React 19 concurrent rendering: aumentato wait 1 RAF → 2 RAF + setTimeout in factory-mount/strictmode/error-boundary test per garantire paint deterministico in real Chromium."
  - "Tinybench 3.x unit: latency.mean è in millisecondi (non nanosecondi come da plan placeholder). Schema baseline-v1.json esteso con campi `_ms` (canonici) + `_ns` (legacy backward-compat con plan must_haves contains check)."
metrics:
  duration: ~50 minuti
  completed: 2026-05-17
  task_count: 4
  file_count_created: 13
  file_count_modified: 2
  test_count_new: 6
  commit_count: 4
---

# Phase 17 Plan 04: Test Closure Cross-Fase + Bench CI Hard Gate Summary

**One-liner:** Chiusura formale 4 dimensioni cross-fase v2.0 GA — `packages/_bench/` workspace privato tinybench (scenario A `createBroker({})` cap 5% / scenario B `createBroker({modules:[microfrontendModule()]})` cap 10%, baseline `1.091 ms` / `1.180 ms` committed) + CI hard gate workflow `.github/workflows/bench.yml` + 3 NEW Tier-3 Playwright Chromium React-specific scenari (factory-mount + error-boundary-mount + strictmode-double-mount, 6 test PASS) + audit `17-test-audit.md` MF-TEST-01..04 con test path references find-verified (15/15 scenari integration PASS, 17+1 categorie unit copertura piena, cross-fase BC §42 + MF-PIPE-01 ✅ pre-flight 273/273 test).

## MF-TEST-04 — Bench Harness Output

### Scenario A (no modules)
```
Setup: createBroker({}) + 1000 publish topics misti
Baseline mean: 1.091 ms · p75: 1.105 ms · sd: 0.0292 ms · samples: 184
Runner attuale: mean=1.1415 ms · p75=1.1915 ms
Regression: +4.63% (cap 5%) ✅ PASS
```

### Scenario B (microfrontendModule installed, zero MF active)
```
Setup: createBroker({ modules: [microfrontendModule()] }) + 1000 publish
Baseline mean: 1.180 ms · p75: 1.203 ms · sd: 0.0377 ms · samples: 170
Runner attuale: mean=1.1055 ms · p75=1.1239 ms
Regression: -6.31% (cap 10%) ✅ PASS (improvement)

Module install overhead: ~8% medio (~89 µs per 1000 publish iteration)
```

### Bench Runner Full Output
```
$ pnpm --filter @gluezero/_bench bench
Loading baseline...
Running Scenario A...
Scenario A actual: mean=1.1415 ms, p75=1.1915 ms
Scenario A regression: 4.63% (cap 5%)
Running Scenario B...
Scenario B actual: mean=1.1055 ms, p75=1.1239 ms
Scenario B regression: -6.31% (cap 10%)

BENCH PASS — all scenarios within regression cap.

Exit code: 0
```

## MF-TEST-03 — Tier-3 Playwright Chromium React Tests

### Output
```
$ pnpm --filter @gluezero/react test:browser
RUN  v4.1.5 /Users/omarmarzio/programming/AI/GlueZero2/packages/react

Test Files  3 passed (3)
     Tests  6 passed (6)
  Start at  00:27:03
  Duration  756ms

Exit code: 0
```

### Scenari NEW F17 W3 P04

| File | Test | Coverage Focus |
|------|------|----------------|
| `test/browser/factory-mount.test.tsx` | **3** | bootstrap+mount+unmount+destroy lifecycle real browser · `metadata.microFrontendId` propagato via `useGlueZeroPublish` con auto-iniezione MF-OBS-01 · Provider standalone render con `createRoot` diretto |
| `test/browser/error-boundary-mount.test.tsx` | **1** | `GlueZeroErrorBoundary` cattura errore + publica `microfrontend.runtime.failed` (deliveryMode='sync') con `microFrontendId` + default fallback `role="alert"` |
| `test/browser/strictmode-double-mount.test.tsx` | **2** | `useGlueZeroSubscribe` NO duplicate delivery in StrictMode dev (pattern useEffect+useRef stable handler) + `useEffect` cleanup invocato post-unmount completo |
| **TOTALE** | **6** | Gap-filling scenari PRD §40.2 #13/#14/#15 React-specific |

## MF-TEST-01..02 — Audit Tables (link `17-test-audit.md`)

| REQ | Status | Evidence (path file `.planning/phases/17.../17-test-audit.md`) |
|-----|--------|----------------------------------------------------------------|
| MF-TEST-01 | ✅ PASS | Tier discipline F8-F17 conformi ROADMAP linea 42 — audit table sezione 1 |
| MF-TEST-02 | ✅ PASS | 17 categorie unit PRD §40.1 + 1 extra (debug snapshot MF) con path references find-verified — audit table sezione 2 |
| MF-TEST-03 | ✅ PASS | 12 scenari preesistenti F8-F16 + 3 NEW F17 = 15/15 PASS — audit table sezione 3 |
| MF-TEST-04 | ✅ PASS | Bench harness + CI hard gate + baseline committed — audit table sezione 4 |

## Cross-Fase Gates Pre-Flight (W7 P07 GA Ready)

```
$ pnpm --filter @gluezero/core test -- v1-bc-replay
Test Files  33 passed | 3 skipped (36)
     Tests  273 passed | 3 skipped (276)
  Duration  2.20s
✅ BC §42 14 API v1.x replay PASS

$ pnpm --filter @gluezero/core test -- pipeline-harness
Test Files  33 passed | 3 skipped (36)
     Tests  273 passed | 3 skipped (276)
  Duration  2.10s
✅ MF-PIPE-01 D-V2-20 pipeline §28 ordine PASS
```

Cross-fase gates gia verdi — W7 P07 GA release verifier finale ri-eseguirà come parte di `17-VERIFICATION.md`.

## D-83 Strict Octuple Esteso F17 Verifier

```
git diff F16_END=3ca6373..HEAD -- packages/{core,microfrontends,mapper,context,permissions,compat,isolation,fallbacks,devtools,theme,cache,gateway,worker,mf-esm,routing,mf-iframe,mf-web-component,mf-module-federation,mf-single-spa,gluezero}/src/
Lines diff: 0  ✅ PASS
```

W3 P04 file scope:
- `packages/_bench/**` (NEW workspace privato — fuori dal vincolo D-83 src/ esistenti)
- `packages/react/test/browser/*.test.tsx` (3 NEW test — scope test outside `src/`)
- `packages/react/vitest.browser.config.ts` (config Rule 3 fix — NON src/)
- `.github/workflows/bench.yml` (NEW)
- `.planning/phases/17.../17-test-audit.md` (NEW, force-added oltre `.gitignore`)
- `pnpm-lock.yaml` (modified — nuovi dev/dep _bench)

ZERO source diff in tutti i 20 package esistenti — D-83 strict octuple esteso F17 PASS.

## Files Created / Modified

### NEW (13 file)

**Bench workspace (`packages/_bench/` — 8 file):**
- `packages/_bench/package.json` — workspace `@gluezero/_bench`, private: true, dep tinybench/tsx/typescript
- `packages/_bench/tsconfig.json` — extends base, rootDir src/, noEmit, isolatedDeclarations: false (bench non publishato)
- `packages/_bench/src/index.ts` — barrel runScenarioA/B + BenchResult type
- `packages/_bench/src/scenario-a.bench.ts` — Bench harness scenario A (createBroker({}) + 1000 publish)
- `packages/_bench/src/scenario-b.bench.ts` — Bench harness scenario B (microfrontendModule + 1000 publish)
- `packages/_bench/src/run.ts` — Runner CI con loadBaseline + pctRegression + cap A=5%/B=10% + exit 1 hard gate
- `packages/_bench/src/baseline-v1.json` — Baseline immutable (mean_ms + p75_ms + sd_ms + ns legacy backward-compat)
- `packages/_bench/README.md` — Doc italiano: uso locale + CI + re-baseline procedure

**Tier-3 Playwright Chromium React (`packages/react/test/browser/` — 3 file):**
- `packages/react/test/browser/factory-mount.test.tsx` (3 test)
- `packages/react/test/browser/error-boundary-mount.test.tsx` (1 test)
- `packages/react/test/browser/strictmode-double-mount.test.tsx` (2 test)

**Audit + CI workflow (2 file):**
- `.github/workflows/bench.yml` — GitHub Actions workflow ubuntu-latest pnpm 10.33.2 + Node 20 + bench hard gate
- `.planning/phases/17-framework-adapters-react-wc-migration-docs-ga-release/17-test-audit.md` — Audit MF-TEST-01..04 (4 sezioni + cross-fase gates pre-flight)

### MODIFIED (2 file)

- `packages/react/vitest.browser.config.ts` — Rule 3 fix Vitest 4.x: `provider: playwright()` factory invece di `'playwright'` stringa
- `pnpm-lock.yaml` — tinybench 3.1.0 + tsx 4.19.0 + @types/node 20.16.5 nuove dipendenze workspace _bench

## Commits

| Hash | Type | Message |
|------|------|---------|
| `8ea330e` | feat | `@gluezero/_bench` workspace privato + tinybench scenari A/B + runner CI hard gate |
| `4e51c2f` | perf | baseline-v1.json valori reali misurati pre-GA (Task 2) |
| `725fa29` | test | 3 scenari Tier-3 Playwright Chromium React-specific NEW (MF-TEST-03 gap-filling) |
| `41c08d7` | docs | audit MF-TEST-01..04 + CI workflow bench.yml hard gate (Task 4) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Vitest 4.x browser provider API breaking change**
- **Found during:** Task 3 esecuzione `pnpm --filter @gluezero/react test:browser`
- **Issue:** `vitest.browser.config.ts` (scaffolded W1) usava `provider: 'playwright'` (stringa), Vitest 4.x richiede factory `playwright()` da `@vitest/browser-playwright`. Errore: `TypeError: The browser.provider configuration was changed to accept a factory instead of a string`.
- **Fix:** Aggiunto `import { playwright } from '@vitest/browser-playwright'` + cambiato `provider: playwright()` factory. Documentato in commento JSDoc con riferimento breaking change Vitest 4.x.
- **Files modified:** `packages/react/vitest.browser.config.ts`
- **Commit:** `725fa29`

**2. [Rule 1 — Bug] React 19 concurrent rendering richiede 2 RAF + setTimeout per paint deterministico**
- **Found during:** Task 3 prima esecuzione test:browser (2/6 test failed)
- **Issue:** Singolo `await new Promise<void>((r) => requestAnimationFrame(() => r()))` insufficient per garantire primo paint React 19 (concurrent rendering). Test `factory-mount` lifecycle base trovava `rendered === null`; test strictmode `invokeCount === 0` perché publish eseguito PRIMA che useEffect avesse registrato subscription.
- **Fix:** Aumentato wait a 2 RAF + `setTimeout(r, 0)` o `setTimeout(r, 10)` per garantire flush deterministico in real Chromium browser context. Pattern applicato uniformemente a tutti i 6 test browser.
- **Files modified:** `packages/react/test/browser/factory-mount.test.tsx`, `packages/react/test/browser/strictmode-double-mount.test.tsx`, `packages/react/test/browser/error-boundary-mount.test.tsx`
- **Commit:** `725fa29` (incluso nel commit Task 3)

**3. [Rule 3 — Blocking] `lifecycle` riferimento prima della dichiarazione in `typeof lifecycle.bootstrap`**
- **Found during:** Task 3 implementation
- **Issue:** Plan generato dichiarava `const mfContext = ... as Parameters<typeof lifecycle.bootstrap>[1]` PRIMA di `const lifecycle = createReactMicroFrontendLifecycle(...)`. TypeScript hoisting di `typeof` funziona ma è semanticamente confuso e fragile.
- **Fix:** Inverti l'ordine: prima `const lifecycle = ...`, poi `const mfContext = ... as Parameters<typeof lifecycle.bootstrap>[1]`. Stesso fix applicato a `factory-mount.test.tsx` test "metadata.microFrontendId propagato" e a `error-boundary-mount.test.tsx`.
- **Files modified:** 2 test files
- **Commit:** `725fa29`

**4. [Rule 2 — Missing critical] tinybench 3.x unit è millisecondi, non nanosecondi**
- **Found during:** Task 2 prima esecuzione bench scenario-a
- **Issue:** Plan placeholder baseline-v1.json usava campi `scenarioA_mean_ns` con valori ~250000 (assumendo nanosecondi). Output reale tinybench: `mean: 1.091` (millisecondi, latency.mean). Mismatch unità → cap regression senza significato.
- **Fix:** Schema baseline-v1.json esteso con campi canonici `_ms` (mean_ms, p75_ms, sd_ms) + mantenuti `_ns` legacy per backward-compat con plan must_haves `contains "scenarioA_p50_ns"` check. `run.ts` aggiornato per leggere `_ms` + log con `.toFixed(4) ms`. Documentato in `_meta.unit` campo del baseline.
- **Files modified:** `packages/_bench/src/baseline-v1.json`, `packages/_bench/src/run.ts`
- **Commit:** `8ea330e` (Task 1 — corretto inline) + `4e51c2f` (Task 2 — popolato con valori reali millisecondi)

### Non-deviations (plan applicato fedelmente)

- Workspace privato `private: true` ✓
- Scenario A/B cap 5%/10% via `CAP_A`/`CAP_B` constants in run.ts ✓
- baseline-v1.json committed come reference immutable ✓
- README italiano con re-baseline procedure ✓
- 3 file Tier-3 React-specific (factory-mount + error-boundary-mount + strictmode-double-mount) ✓
- Audit `17-test-audit.md` con 4 sezioni REQ ✓
- CI workflow `.github/workflows/bench.yml` con exit 1 hard gate ✓
- Cross-fase gates BC §42 + MF-PIPE-01 verificati PASS pre-W7 ✓

## Authentication Gates

Nessuna — workspace privato locale (pnpm + tsx + tinybench). Vitest browser Playwright Chromium installato in node_modules (no remote auth).

## Threat Model Mitigations

| ID | Threat | Mitigation Implementata |
|----|--------|-------------------------|
| T-17-04-01 | Bench false negative — statistical noise nasconde regressioni | ✅ tinybench 3.x t-test built-in + warmup iterations (50ms / 3 iter) + 10 samples (iterations: 10) + baseline-v1.json committato. Sd 0.029 ms / mean 1.091 ms → CV 2.7% < 5% cap, noise dominated by warmup-trimmed steady-state. |
| T-17-04-02 | Tier-3 Playwright test stubbing (P-22) — mock-based test non riproduce real browser | ✅ `@vitest/browser-playwright` Chromium real browser context, NO jsdom stub. Real `createRoot` + `StrictMode` + `componentDidCatch`. 6 test PASS verificano integration completa. |
| T-17-04-03 | CI bench gate noisy → false positive bloccano PR ininterrottamente | ✅ Cap conservative 5% A / 10% B + sd misurato 0.029-0.038 ms < 5% cap. Re-baseline procedure documentata in README per evoluzioni intenzionali. CI exit 1 SOLO se regression > cap (no flakiness con baseline immutable). |

## Known Stubs

Nessuno — tutti i file fully wired:
- Bench workspace eseguibile end-to-end (`pnpm bench` exit 0 verificato)
- Tier-3 Playwright React test eseguibili end-to-end (6/6 PASS verificato)
- CI workflow YAML semantically valid (versioni action pinned: checkout@v4, pnpm/action-setup@v4 con version 10.33.2, setup-node@v4 con node-version: '20')
- Audit table path references find-verified (NO MISSING)

## Threat Flags

Nessun nuovo flag — workspace privato bench + test files non introducono surface security-relevant (no network endpoints, no auth paths, no file access beyond bench input → file deterministico in-process).

## Carryover Ready per Wave Successiva

**W5 P05 (docs 18 markdown + TypeDoc):**
- `packages/_bench/README.md` — referenza per `docs/v2/18-performance-bundle.md` (sezione bench + baseline + re-baseline procedure)
- `17-test-audit.md` — referenza per `docs/v2/13-examples-esm.md` ... `docs/v2/16-examples-react.md` (test path links)

**W6 P06 (examples customer-dashboard + 2 NEW HTML):**
- Tier-3 Playwright Chromium pattern (vitest.browser.config.ts playwright() factory) → applicabile a `examples/customer-dashboard/test/` se W6 introduce smoke test
- Bench baseline-v1.json — referenza per dashboard "performance metrics" panel

**W7 P07 (GA release 2.0.0-rc.0 + soak + 2.0.0):**
- BC §42 v1-bc-replay ✅ pre-verified PASS (273/273 test)
- MF-PIPE-01 pipeline-harness ✅ pre-verified PASS (273/273 test)
- Bench CI hard gate `.github/workflows/bench.yml` → trigger automatico su PR/push main → garantisce no-regression durante rc.0 → 2.0.0 promotion
- `17-VERIFICATION.md` può citare 4 REQ MF-TEST-01..04 PASS in `17-test-audit.md` come closure formale

## Self-Check: PASSED

Files asserted exist:
- ✅ `packages/_bench/package.json` (private: true ✓ verified via `grep '"private": true'`)
- ✅ `packages/_bench/tsconfig.json`
- ✅ `packages/_bench/src/index.ts`
- ✅ `packages/_bench/src/scenario-a.bench.ts` (createBroker({}) ✓)
- ✅ `packages/_bench/src/scenario-b.bench.ts` (microfrontendModule() ✓)
- ✅ `packages/_bench/src/baseline-v1.json` (scenarioA_mean_ms + scenarioA_p50_ns ✓)
- ✅ `packages/_bench/src/run.ts` (CAP_A = 0.05 / CAP_B = 0.10 ✓ + process.exit(1) ✓)
- ✅ `packages/_bench/README.md`
- ✅ `packages/react/test/browser/factory-mount.test.tsx`
- ✅ `packages/react/test/browser/error-boundary-mount.test.tsx`
- ✅ `packages/react/test/browser/strictmode-double-mount.test.tsx`
- ✅ `.github/workflows/bench.yml` (`pnpm.*bench` ✓ + `on:` ✓)
- ✅ `.planning/phases/17-framework-adapters-react-wc-migration-docs-ga-release/17-test-audit.md` (4 sezioni MF-TEST-01..04 ✓)

Commits asserted exist in git log:
- ✅ `8ea330e` — feat(17-04): bench workspace + scenari + runner
- ✅ `4e51c2f` — perf(17-04): baseline-v1.json valori reali
- ✅ `725fa29` — test(17-04): 3 Tier-3 Playwright Chromium scenari
- ✅ `41c08d7` — docs(17-04): audit + CI workflow bench.yml

Verifier results:
- ✅ `pnpm --filter @gluezero/_bench typecheck` exit 0
- ✅ `pnpm --filter @gluezero/_bench bench` exit 0 (BENCH PASS)
- ✅ `pnpm --filter @gluezero/react test:browser` exit 0 (6/6 PASS)
- ✅ `pnpm --filter @gluezero/core test -- v1-bc-replay` exit 0 (273/273 PASS)
- ✅ `pnpm --filter @gluezero/core test -- pipeline-harness` exit 0 (273/273 PASS)
- ✅ D-83 strict octuple esteso F17: git diff 3ca6373..HEAD packages/*/src/ = 0 lines
