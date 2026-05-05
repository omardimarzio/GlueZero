---
phase: 06-cache-tooling-avanzato
plan: 06
subsystem: devtools
tags:
  - metrics
  - reservoir-sampling
  - cardinality-cap
  - prometheus
  - tdd
  - phase-6-w3
requires:
  - "@sembridge/devtools (06-01 bootstrap + types)"
  - "@sembridge/core (EventTap interface)"
provides:
  - "createMetricsCollector — counters/gauges/histograms simil-OpenMetrics"
  - "createReservoir / reservoirAdd / computeSummary — Algorithm R Vitter 1985 inline"
  - "createCardinalityTracker / flatLabels — cap distinct combinations + audit"
affects:
  - "Closes PRD §39 #10 (TOOL-05 metrics format) — schema { counters, gauges, histograms } + naming sembridge.<package>.<metric>{<labels>}"
  - "Threat T-06-06-01 (cardinality explosion) mitigated"
  - "Threat T-06-06-02 (histogram unbounded growth) mitigated"
  - "Threat T-06-06-05 (Math.random predictability in test) mitigated"
tech-stack:
  added: []
  patterns:
    - "Counter atomic JS event loop carryover F5 worker-pool.ts:113-160 (D-133 single-threaded safe)"
    - "Map<key, state> aggregator carryover F5 task-tracker.ts:140-220"
    - "Cap + audit emit carryover F5 worker-registry.ts:39+104-180 (D-128)"
    - "Reservoir Algorithm R inline NEW pattern (Vitter 1985 cited C2 RESEARCH §8.2)"
    - "Prometheus-style flatten labels alphabetical sort + JSON-escape values"
key-files:
  created:
    - packages/devtools/src/reservoir-sampling.ts
    - packages/devtools/src/reservoir-sampling.test.ts
    - packages/devtools/src/cardinality-cap.ts
    - packages/devtools/src/cardinality-cap.test.ts
    - packages/devtools/src/metrics-collector.ts
    - packages/devtools/src/metrics-collector.test.ts
  modified: []
decisions:
  - "D-163 applied: naming dot.case sembridge.<package>.<metric>{<labels>} Prometheus-friendly"
  - "D-164 applied: cumulative-only counters + getMetricsDelta(prev) helper opzionale"
  - "D-165 applied: histograms via reservoir Algorithm R Vitter 1985 inline (~50 LOC zero deps), default 1024 samples per metric — t-digest 0.1.2 RIGETTATO (RESEARCH §8.1)"
  - "D-166 applied: cap default 100 distinct label combinations per base name + onCardinalityOverflow audit hook"
  - "D-83 strict carryover: zero modifiche fuori packages/devtools/src/"
  - "BLOCKER-1 fix rispettato: index.ts barrel NON modificato (append cumulativo gestito da 06-08b Wave 4b sequential gate)"
metrics:
  duration: ~25min
  completed: 2026-05-05
requirements:
  - TOOL-02
  - TOOL-03
  - TOOL-05
---

# Phase 6 Plan 06: Metrics + Reservoir + Cardinality Cap Summary

**One-liner:** MetricsCollector simil-OpenMetrics (counters/gauges/histograms) con reservoir Algorithm R Vitter 1985 inline + cardinality cap 100 + audit emit — chiude PRD §39 #10 (TOOL-05).

## Cosa è stato fatto

Plan 06-06 (Wave 3 building block B, parallel con 06-05 ∥ 06-07 file ownership disgiunta) ha implementato il MetricsCollector di SemBridge in TDD strict, con 3 file source production-ready (~370 LOC totali con JSDoc) + 3 file test (45 test deterministici Tier-1 jsdom).

### Componenti

1. **`reservoir-sampling.ts`** (~107 LOC) — Algorithm R Vitter 1985 inline:
   - `createReservoir(capacity)` — factory state `{ samples, capacity, count, sum }`
   - `reservoirAdd(state, value)` — fase fill (count<capacity assignment diretto) → fase replace (Math.random*((count+1)) → if j<capacity sostituisce)
   - `computeSummary(state)` — calcola `HistogramSummary { count, sum, p50, p90, p99 }` on-demand via `slice + sort + pickIdx(p)` clamped
   - Trade-off ~5% errore p50/p90/p99 vs t-digest ~1%, MA zero deps prioritario per budget bundle stretto (RESEARCH §8.1)

2. **`cardinality-cap.ts`** (~117 LOC) — guard contro metric explosion:
   - `flatLabels(labels)` — Prometheus-style flatten alphabetical sort + `JSON.stringify` escape (sicurezza: prevenire label injection downstream)
   - `createCardinalityTracker({ cap, onOverflow })` — Map<baseName, Set<labelSig>> idempotent insert-or-skip
   - Cap default 100, overflow → drop + onOverflow callback con `{ baseName, droppedLabels }`

3. **`metrics-collector.ts`** (~202 LOC) — aggregator simil-OpenMetrics:
   - `createMetricsCollector({ histogramSamples, maxLabelCombinations, onCardinalityOverflow })` ritorna `{ increment, setGauge, observe, getMetrics, getMetricsDelta, tap }`
   - Counter atomic single-threaded JS event loop carryover F5 worker-pool
   - Lazy-create reservoir per histogram metric key
   - `getMetrics()` snapshot defensive copy via `Object.fromEntries`
   - `getMetricsDelta(prev)` calcola `current - prev` per counters (gauges + histograms = current snapshot)
   - `tap` no-op default (D-161 lazy) — wiring in 06-08 step 14 `event.observed`

## Commit list

| # | Hash | Type | Descrizione |
|---|------|------|-------------|
| 1 | `755ac7d` | test | RED reservoir-sampling — 13 test (Algorithm R fill/replace/p50/p90/p99/determinism/distribution) |
| 2 | `05eb36c` | feat | GREEN reservoir-sampling — Algorithm R Vitter 1985 inline ~50 LOC zero deps |
| 3 | `bc8019a` | test | RED cardinality-cap — 12 test (flatLabels alphabetical + JSON-escape + cap + audit + per-base-name) |
| 4 | `125cbfd` | feat | GREEN cardinality-cap — flatLabels + createCardinalityTracker D-166 |
| 5 | `8d9bebe` | test | RED metrics-collector — 20 test (interface + counters + gauges + histograms + cardinality + naming) |
| 6 | `8322fe7` | feat | GREEN metrics-collector — D-163/D-164/D-165/D-166 + closes PRD §39 #10 TOOL-05 |

**6 commit atomic TDD** (3 RED + 3 GREEN). Lingua italiano CLAUDE.md ✓.

## Test count + Coverage

| File | Test | Coverage v8 (stmts/branch/funcs/lines) |
|------|------|------------------------------------------|
| `reservoir-sampling.ts` | **13** | 100 / 75 / 100 / 100 |
| `cardinality-cap.ts` | **12** | 100 / 94.11 / 100 / 100 |
| `metrics-collector.ts` | **20** | 96.96 / 90.9 / 100 / 100 |
| **Totale 06-06** | **45** | (sopra target ≥90/80/90/90 globale devtools) |

**Devtools globale post-06-06:** 102/102 test passing — coverage 98.7 stmts / 89.71 branch / 100 funcs / 99.29 lines.

> Note branches reservoir-sampling 75%: deriva dai guard `?? 0` in `computeSummary` su `sorted[pickIdx]` non triggerable a runtime (sorted ha length n>0). La threshold globale ≥80% branches è rispettata (89.71% suite-wide).

## REQ-IDs chiusi

- **TOOL-02** — runtime helper `getMetrics()` snapshot ✓
- **TOOL-03** — `getMetricsDelta(prev)` helper opzionale ✓
- **TOOL-05** — Format metriche standard simil-OpenMetrics ✓ → **chiude PRD §39 #10**

## Threat coverage

| Threat | Disposition | Evidence |
|--------|-------------|----------|
| T-06-06-01 (DoS cardinality explosion) | mitigate | cardinality-cap D-166 + Test 9-10 metrics-collector + Test 6-12 cardinality-cap |
| T-06-06-02 (histogram unbounded) | mitigate | reservoir cap 1024 + Test 5 reservoir (5000 add → samples.length === 1024) |
| T-06-06-03 (counter overflow MAX_SAFE_INTEGER) | accept | Pattern Prometheus standard — JS 53-bit ~9e15 sufficiente |
| T-06-06-04 (PII in labels) | accept | Consumer responsibility, DOC-06 anti-pattern userId |
| T-06-06-05 (Math.random predictability test) | mitigate | `vi.spyOn(Math, 'random')` deterministic + Test 11 reservoir |

## Acceptance gates

- [x] `must_haves.truths` (12) — verificate da test passing
- [x] Coverage v8 sui 3 file ≥90/80/90/90 (eccetto branches reservoir 75% non triggerable, threshold globale rispettata 89.71%)
- [x] Test 100% deterministici (Math.random mocked)
- [x] D-83 strict — `git diff packages/{core,mapper,routing,gateway,worker}/` empty ✓
- [x] **`packages/devtools/src/index.ts` INVARIATO** — BLOCKER-1 fix, barrel append in 06-08b Wave 4b ✓
- [x] File ownership disgiunta da 06-05 (event/route inspector) e 06-07 (pause-controller) ✓
- [x] Build `pnpm -F @sembridge/devtools build` ✅ (1.13 KB ESM)
- [x] Typecheck `pnpm -F @sembridge/devtools typecheck` ✅
- [x] Closes PRD §39 #10 (TOOL-05) annotation in commit message ✓

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fix `exactOptionalPropertyTypes` in metrics-collector.ts**
- **Found during:** Task 3 typecheck post-GREEN
- **Issue:** `createCardinalityTracker({ cap, onOverflow: opts.onCardinalityOverflow })` falliva perché `opts.onCardinalityOverflow` può essere `undefined` ma `CardinalityTrackerOptions.onOverflow` non accetta `undefined` con `exactOptionalPropertyTypes: true`.
- **Fix:** Conditional spread — passa `onOverflow` solo se definito.
- **Files modified:** `packages/devtools/src/metrics-collector.ts` (linee 128-135)
- **Commit:** incluso in `8322fe7` (GREEN metrics-collector)

### Deferred Issues

- **Pre-existing typecheck failure** in `@sembridge/gateway` per missing `@sembridge/routing/dist` build → out-of-scope (NOT caused by 06-06). Logged in `.planning/phases/06-cache-tooling-avanzato/deferred-items.md` per 06-09a final gate.

## Note per il consumer (06-08 wiring)

Il MetricsCollector creato in questo plan è **standalone**: NON dipende dal broker. Il plan 06-08b (Wave 4b) wirerà:

1. `tap.onPipelineStep` → auto-increment lifecycle counters (route.dispatched, cache.hit, http.duration_ms) su step 14 `event.observed`
2. `onCardinalityOverflow` → `broker.publish('system.metrics.cardinality-overflow', info)` per uniformità audit channel
3. Esposizione `getMetrics()` via `DevtoolsBroker.getMetrics()` API pubblica

Esempio uso atteso post-06-08:
```ts
const broker = createSemBridge({
  devtools: { histogramSamples: 1024, maxLabelCombinations: 100 }
})
// ... use broker ...
const snap = broker.getMetrics()
// snap.counters['sembridge.cache.hits_total{route_id="weather"}']: 42
// snap.histograms['sembridge.http.duration_ms{route_id="weather"}']: { count, sum, p50, p90, p99 }
```

## Self-Check: PASSED

Files verificati:
- ✅ `packages/devtools/src/reservoir-sampling.ts` (FOUND)
- ✅ `packages/devtools/src/reservoir-sampling.test.ts` (FOUND)
- ✅ `packages/devtools/src/cardinality-cap.ts` (FOUND)
- ✅ `packages/devtools/src/cardinality-cap.test.ts` (FOUND)
- ✅ `packages/devtools/src/metrics-collector.ts` (FOUND)
- ✅ `packages/devtools/src/metrics-collector.test.ts` (FOUND)

Commits verificati:
- ✅ `755ac7d` (RED reservoir-sampling)
- ✅ `05eb36c` (GREEN reservoir-sampling)
- ✅ `bc8019a` (RED cardinality-cap)
- ✅ `125cbfd` (GREEN cardinality-cap)
- ✅ `8d9bebe` (RED metrics-collector)
- ✅ `8322fe7` (GREEN metrics-collector)
