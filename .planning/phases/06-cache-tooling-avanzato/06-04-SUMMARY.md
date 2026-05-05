---
phase: 06-cache-tooling-avanzato
plan: 04
subsystem: devtools-tap-chain
tags:
  - tdd
  - devtools
  - tap-chain
  - error-isolation
  - F6-W2
requires:
  - 06-01-SUMMARY.md (DevtoolsConfig type-level + augment.ts taps registry decl merging)
  - F1 packages/core/src/types/tap.ts (EventTap interface — D-83 strict, NON modificato)
  - F1 packages/core/src/core/event-tap.ts safeTapStep (D-20 — pattern replicato inline)
provides:
  - createMultiplexTap(taps[]): EventTap aggregator chain con error isolation try/catch isolato (D-159 + D-20 carryover)
  - createTapRegistry(): { add, remove, list, getMultiplexed } runtime tap management (Map registry analog F5 worker-registry)
  - wrapLegacyTap(config): auto-wrap F1 single-tap legacy in array F6 backward-compat zero breaking
  - TapHandle / TapRegistry public types
affects:
  - packages/devtools/src/index.ts (barrel append W2 — exports runtime)
  - 06-05/06-06/06-07 (Inspector / Metrics / PauseController consumeranno registry.add())
  - 06-08b (createDevtoolsBroker comporrà MultiplexTap + wrapLegacyTap → runtime.tap)
tech-stack:
  added: []
  patterns:
    - F1 D-20 safeTapStep replica inline (try/catch swallow per-tap)
    - F5 worker-registry.ts:104-110 Map<string, T> + nextId auto-increment
    - F3 outcome-collector.ts:75-90 try/catch swallow analog (lifecycle events)
    - Adapter pattern (pipeline F1 vede 1 tap → delega a N tap interni F6)
key-files:
  created:
    - packages/devtools/src/multiplex-tap.ts
    - packages/devtools/src/multiplex-tap.test.ts
    - packages/devtools/src/tap-registry.ts
    - packages/devtools/src/tap-registry.test.ts
  modified:
    - packages/devtools/src/index.ts
decisions:
  - D-159 carryover (tap registry chain con error isolation, sostituisce F1 single-tap)
  - D-20 carryover (try/catch swallow inline — non importato da @sembridge/core per preservare boundary D-83)
  - Ordering F6 first + F1 last in wrapLegacyTap (consistency con additive semantica decl merging)
  - Snapshot semantics su getMultiplexed: cattura stato registry alla chiamata (no overhead per-step list rebuild — perf trade-off)
  - Identity preservation step+snapshot (no clone fra tap — Pitfall 7B perf)
metrics:
  duration: ~10 min
  completed: 2026-05-05
  tasks: 2
  test_count: 20
  test_files: 2
  source_files: 2
  loc_source_estimated: ~80 (multiplex 30 + registry 50)
  coverage_v8:
    statements: 100
    branches: 100
    functions: 100
    lines: 100
  build_size_devtools_esm: 1.13 KB (index.js) + 232 B (augment.js)
  d83_strict_diff_lines: 0
---

# Phase 6 Plan 04: MultiplexTap + TapRegistry Summary

**One-liner:** `createMultiplexTap(taps)` aggregator chain con error isolation try/catch isolato per tap (D-159 + D-20 carryover) + `createTapRegistry()` runtime add/remove/list + `wrapLegacyTap` auto-wrap F1 single-tap → array F6 (zero breaking).

## Wave 2 Building Block B — parallel-safe con 06-02

File ownership disgiunta verificata: 06-02 owns `packages/cache/src/{memory-cache,stable-hash}*`; 06-04 owns SOLO `packages/devtools/src/{multiplex-tap,tap-registry}*` + barrel `index.ts` append. Zero overlap (`git diff 78ee413..HEAD -- packages/cache/` → 0 lines).

## Decisioni Architetturali Carryover

### D-159 — Tap registry chain (multiplex)
- **Problem F1**: `runtime.tap` single-tap. F6 ha 4+ tap (EventInspector + RouteInspector + MetricsCollector + PauseController + custom user). Single value = collisione.
- **Solution F6**: `BrokerConfig.taps?: readonly EventTap[]` (declaration merging in `augment.ts` 06-01) consumato da `createMultiplexTap` che produce un single tap aggregator delegando a N tap interni con error isolation.
- **Pattern**: Adapter classico — pipeline F1 vede 1 tap (no breaking), F6 internamente chain N.

### D-20 carryover — safeTapStep replica inline
- **Vincolo D-83 strict**: `safeTapStep` di F1 (`packages/core/src/core/event-tap.ts:23-34`) NON è esportato dal barrel `@sembridge/core` runtime. Importarlo via deep path violerebbe il package boundary F1.
- **Soluzione**: pattern replicato inline in `multiplex-tap.ts` (try/catch swallow per-tap, ~6 LOC). Comment `// swallow — pattern F1 D-20 carryover` documenta la duplicazione intenzionale.
- **Verifica D-83**: `git diff 78ee413..HEAD -- packages/{core,mapper,routing,gateway,worker}/src/` → 0 lines.

### Auto-wrap legacy F1 (D-159 backward-compat)
- **Pattern**: `wrapLegacyTap({ runtime: { tap: legacy }, taps: [t1, t2] })` → `[t1, t2, legacy]`.
- **Ordering F6 first + F1 last**: i tap espliciti F6 hanno priorità d'ordine FIFO, il legacy F1 è appended (consistency con additive semantica decl merging, replicabile mentalmente).
- **Threat T-06-04-03 mitigation**: Test 7 + Test 6 verificano coexistence (legacy NON perso).

## File Creati

### `packages/devtools/src/multiplex-tap.ts` (~30 LOC source)
- Export pubblico: `createMultiplexTap(taps: readonly EventTap[]): EventTap`.
- Edge case `taps = []` → loop early-exit naturale (no overhead).
- Identity preservation `step` + `snapshot` (no clone — perf Pitfall 7B).

### `packages/devtools/src/tap-registry.ts` (~50 LOC source)
- Export pubblici: `createTapRegistry(): TapRegistry`, `wrapLegacyTap(config): readonly EventTap[]`.
- Type exports: `TapHandle { id }`, `TapRegistry { add, remove, list, getMultiplexed }`.
- Map registry pattern analog F5 worker-registry (id auto-increment `tap-1`, `tap-2`, ...).
- `getMultiplexed()` snapshot semantics: cattura stato a chiamata (no overhead per-step rebuild).

## File Modificati

### `packages/devtools/src/index.ts` (barrel)
- Append W2: `export { createMultiplexTap }` + `export { createTapRegistry, wrapLegacyTap, type TapHandle, type TapRegistry }`.
- Comment placeholder W3/W4 mantenuto per plan successivi.

## Test (20 deterministici Tier-1 jsdom)

### `multiplex-tap.test.ts` — 10 test
1. `createMultiplexTap([])` → no-op (early return)
2. Single tap path (call-through inalterato)
3. Error isolation: tap2 throw → tap1 + tap3 chiamati ✓ (T-06-04-01)
4. All taps throw → tutti caught, no escalation
5. Ordering FIFO via `mock.invocationCallOrder`
6. Step argument identity (no mutation)
7. Snapshot reference identity (no clone)
8. N=10 tap counter assertion
9. Pipeline step F1 `event.received` propagation
10. Pipeline step F6 `event.observed` forward-compat (R4 super-set additive)

### `tap-registry.test.ts` — 10 test
1. API base shape (add/remove/list/getMultiplexed + empty list)
2. `add(tap)` → handle + list contiene tap
3. `remove(handle)` → idempotent (true/false)
4. `getMultiplexed()` invoca tutti i tap registrati (consume `createMultiplexTap`)
5. handle.id univoco fra 20 add (Set collision check)
6. `wrapLegacyTap({ runtime: { tap: legacy } })` → `[legacy]`
7. `wrapLegacyTap({ runtime: { tap }, taps: [t1, t2] })` → `[t1, t2, legacy]` (T-06-04-03 ✓)
8. `wrapLegacyTap({ taps: [tap1] })` → `[tap1]`
9. `wrapLegacyTap({})` → `[]`
10. `wrapLegacyTap({ runtime: {} })` → `[]`

**Totale package devtools post-06-04**: 28 test (8 augment + 10 multiplex + 10 registry).

## Coverage v8

```
File              | % Stmts | % Branch | % Funcs | % Lines
multiplex-tap.ts  | 100     | 100      | 100     | 100
tap-registry.ts   | 100     | 100      | 100     | 100
```

Supera target plan ≥90/80/90/90 (margine ampio per future estensioni 06-05/06-06).

## Threat Coverage

| Threat ID | Verifica | Esito |
|-----------|----------|-------|
| T-06-04-01 (DoS tap throw blocca pipeline) | multiplex-tap Test 3 + Test 4 | ✓ mitigated |
| T-06-04-02 (Information disclosure tap legge payload) | accept boundary | accept (DOC-06 anti-pattern doc in 06-09b) |
| T-06-04-03 (Logic flaw auto-wrap perde tap legacy) | tap-registry Test 6 + Test 7 | ✓ mitigated |
| T-06-04-04 (DoS tap loop infinito ricorsivo) | accept boundary | accept (consumer responsibility, recursion guard NON V1) |

## Acceptance Gates

- [x] 20 test Tier-1 jsdom passing (target ≥18) ✓
- [x] Coverage v8 100/100/100/100 (target ≥90/80/90/90) ✓
- [x] File ownership disgiunta da 06-02 (cache/) — `git diff cache/` 0 lines ✓
- [x] D-83 strict: 0 lines diff packages/{core,mapper,routing,gateway,worker}/src/ ✓
- [x] Build ESM pulito (1.13 KB index + 232 B augment) ✓
- [x] Typecheck pulito (`tsc --noEmit`) ✓
- [x] Pattern carryover documentato (F1 D-20 + F5 worker-registry) ✓

## Commit (4 atomic TDD)

| Hash | Tipo | Messaggio |
|------|------|-----------|
| `e2e52fd` | RED | `test(06-04): add RED test for multiplex-tap (D-159 chain + error isolation)` |
| `522812d` | GREEN | `feat(06-04): GREEN multiplex-tap chain N EventTap con error isolation (D-159)` |
| `89bbb0a` | RED | `test(06-04): add RED test for tap-registry (D-159 add/remove/list + auto-wrap F1)` |
| `97379d4` | GREEN | `feat(06-04): GREEN tap-registry runtime + auto-wrap F1 backward-compat (D-159)` |

## REQ-IDs Coperti (parziale — Inspector/Metrics chiuderanno in 06-05/06-06/06-07)

- **TOOL-01** (Event Inspector infrastructure): tap chain pronto, Inspector consumerà via `registry.add()` in 06-05.
- **TOOL-02** (Mapping/Route Inspector infrastructure): pari a TOOL-01.
- **TOOL-04** (Custom user tap support): MultiplexTap permette al consumer di registrare taps custom side-by-side con Inspector built-in.
- **PIPE-01** (Pipeline observability ext F6): tap chain pronto per step 14 attivazione (06-08b composizione `runtime.tap` final).

REQ-IDs verranno marcati `Complete` in 06-09b (final gate plan).

## Building Blocks Pronti per Plan Successivi

| Consumer | Plan | Uso |
|----------|------|-----|
| EventInspector | 06-05 | `registry.add(eventInspector.tap)` registra tap che pusha snapshot a ring buffer |
| RouteInspector | 06-05 | `registry.add(routeInspector.tap)` |
| MetricsCollector | 06-06 | `registry.add(metricsCollector.tap)` accumula counters/gauges/histograms |
| PauseController | 06-07 | `registry.add(pauseController.tap)` (modalità observe-only — pause inietta a livello dispatcher non tap) |
| createDevtoolsBroker | 06-08b | `createMultiplexTap(wrapLegacyTap(config))` → `runtime.tap` final, single value backward-compat F1 |

## Deviazioni dal Plan

Nessuna deviazione. Plan eseguito esattamente come scritto:
- 2 task TDD atomic (RED + GREEN ciascuno) → 4 commit.
- Test count 20/20 (vs target ≥18 nel plan, +2 extra: handle id collision + wrapLegacyTap runtime undefined edge case).
- Coverage 100% supera ampiamente 90/80/90/90.
- Zero auto-fix Rule 1/2/3 necessari (test passano al primo run dopo GREEN).

## Self-Check: PASSED

- File creati esistono: `multiplex-tap.{ts,test.ts}` ✓ + `tap-registry.{ts,test.ts}` ✓
- File modificato: `packages/devtools/src/index.ts` (barrel append W2) ✓
- Commit verificati in `git log`: `e2e52fd`, `522812d`, `89bbb0a`, `97379d4` ✓
- Build ESM dist/ regenerato success ✓
- D-83 strict ✓ (0 lines diff packages F1-F5)
- Coverage v8 100/100/100/100 ✓
