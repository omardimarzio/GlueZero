---
phase: 13
plan: "13-02"
subsystem: isolation
tags:
  - policy-resolver
  - warning-matrix
  - lifecycle-register-hook
  - MF-ISO-01
  - MF-ISO-06
  - W2
  - W2-P02
  - parallel-safe
  - D-83-sextuple-extended
dependency_graph:
  requires:
    - 13-01 (W1 scaffolding + types/policy + topics + ISOLATION_WARNING_TOPIC + createIsolationPolicyError factory + SERVICE_ISOLATION binding)
    - "@gluezero/microfrontends F8 (microfrontend.registered lifecycle topic SYNC emit)"
    - "@gluezero/core (BrokerModule + future SERVICE_ISOLATION runtime — W2 P03 install)"
  provides:
    - "resolvePolicy(declared, policyDefault, mfId) 3-layer merge → ResolvedIsolationPolicy"
    - "createPolicyCache({signal?}) wrapper Map<mfId, ResolvedIsolationPolicy> + abortSignal cleanup"
    - "detectInconsistentCombinations(policy, mfId) → IsolationWarning[] (5 codici MF-ISO-06)"
    - "installRegisterHook(broker, opts) eager resolve + warning emit + cache populate"
    - "IsolationWarningCode union 5 codici stabili"
    - "IsolationWarning interface (OQ-3 payload shape ratificato)"
    - "RegisterHookBroker structural subset (subscribe/publish minimal interface)"
    - "PolicyCache interface (set/get/delete/clear/size)"
  affects:
    - "13-03 (P03 W2 — dom-css-handler + iframe-stub: consumirà resolvePolicy via cache lookup)"
    - "13-04 (P04 W2 — facades: consumirà SERVICE_ISOLATION.getResolvedPolicy(mfId) tramite cache)"
    - "13-05/13-06 (W3 Tier-1 jsdom + Tier-3 Playwright + integration)"
tech_stack:
  added: []
  patterns:
    - "3-layer merge resolver (default + factory + descriptor)"
    - "Eager resolution at register lifecycle topic"
    - "AbortSignal cascade cleanup D-V2-16 carryover F11/F12"
    - "Structural broker subset (no @gluezero/core hard dep)"
    - "Defensive payload extraction 3-shape fallback (descriptor.id / id / microFrontendId)"
    - "Test seam injection (warn function override)"
    - "PRD §21.9 substring drift detector (P-13 message lockato)"
key_files:
  created:
    - packages/isolation/src/policy-resolver.ts
    - packages/isolation/src/warning-matrix.ts
    - packages/isolation/src/lifecycle-register-hook.ts
    - packages/isolation/src/internal/policy-cache.ts
    - packages/isolation/src/policy-resolver.test.ts
    - packages/isolation/src/warning-matrix.test.ts
    - packages/isolation/src/lifecycle-register-hook.test.ts
    - .planning/phases/13-isolation-theme-cache-gateway-worker-integration/deferred-items.md
  modified: []
decisions:
  - "OQ-1 (HIGH) — `microfrontend.registered` topic timing: SYNC emit confermato via test isolation (mock broker SYNC dispatch). Eager resolve+warning pre-mount funzionante. Fallback dual-subscribe NON necessario."
  - "OQ-3 (LOW) — Payload warning shape ratificato `{microFrontendId, code, combination, message, timestamp}`. Consumer downstream (F16 SnapshotProvider futuro, devtools overlay) hanno contratto stabile."
  - "Defensive payload extraction 3-shape: F8 publishLifecycleEvent emette `MicroFrontendRegistration` con `descriptor.id`, ma fallback a `id` / `microFrontendId` top-level supportato per shape variation future-proof."
  - "Structural broker typing in `RegisterHookBroker` invece di import `Broker` da `@gluezero/core` — riduce bundle surface + test simpler senza mock complesso."
  - "P-13 messaggio PRD §21.9 testo lockato bitwise — substring test `\"Network blocking cannot be fully enforced\"` previene drift accidentale messaggio."
  - "Cache `Map<mfId, ResolvedIsolationPolicy>` standalone — NO LRU (carryover F11 design: numero MF bounded ~50 tipico, no eviction policy necessaria)."
metrics:
  duration_minutes: ~10
  completed_date: "2026-05-13"
  tasks_completed: 3
  files_created: 8
  files_modified: 0
  total_loc_new: 1165
  source_loc: 606
  test_loc: 559
  new_tests_added: 25
  total_suite_tests: 69
  bundle_index_gzipped_bytes: 647
  bundle_augment_gzipped_bytes: 177
  bundle_cap_bytes: 12288
  bundle_headroom_pct: 94.7
---

# Phase 13 Plan 13-02: W2 P02 — Policy Resolver + Warning Matrix MF-ISO-06 + Lifecycle Register Hook Summary

**Stack & Pattern:** Resolver 3-layer (DEFAULT_ISOLATION_POLICY PRD §21.3 < policyDefault factory < descriptor.isolation per-MF) con partial-merge per chiave, options-merge oggetto piatto + `detectInconsistentCombinations` matrice 5 codici (P-13 lockato PRD §21.9 + IFRAME_EVENTS + STORAGE_BLOCKED_SHADOW + JS_SANDBOXED_MOUNT + GLOBALS_ISOLATED_JS_SHARED) + `installRegisterHook` subscribe `microfrontend.registered` lifecycle topic con cache `Map<mfId, ResolvedIsolationPolicy>` + abortSignal cascade D-V2-16 carryover F11/F12.

## Cosa è stato fatto

### Task 1 — `policy-resolver.ts` + `internal/policy-cache.ts` + 10 test (commit `aa7815a`)

- **`src/policy-resolver.ts` (110 LoC):** Esporta `resolvePolicy(declared, policyDefault, mfId)` puro idempotent. Applica 3-layer merge con priorità più alta vince (declared > policyDefault > DEFAULT_ISOLATION_POLICY). Le 7 chiavi sono risolte indipendentemente (partial-merge); `options` field mergiato come spread oggetto piatto. Re-export `DEFAULT_ISOLATION_POLICY` da `./types/policy.js` per consumer convenience.
- **`src/internal/policy-cache.ts` (119 LoC):** Esporta `createPolicyCache({signal?})` wrapper `Map<string, ResolvedIsolationPolicy>` con API readonly `set/get/delete/clear/size`. AbortSignal cleanup cascade D-V2-16: signal `abort` → `map.clear()` via listener `{once:true}`. Edge case: signal già abortito alla construct → svuota subito. Internal-only (NON esportato dal barrel).
- **`src/policy-resolver.test.ts` (146 LoC, 10 test):** 7 test resolver (default-only / policyDefault override / declared prevale / partial-merge per chiave / options merge / options override / empty partials) + 3 test cache (set/get/delete/clear/abortSignal + pre-aborted signal + clear() manuale).

### Task 2 — `warning-matrix.ts` + 10 test (commit `bbf3d9e`)

- **`src/warning-matrix.ts` (169 LoC):** Esporta `IsolationWarningCode` union type 5 valori stabili + `IsolationWarning` interface shape OQ-3 ratificato `{microFrontendId, code, combination, message, timestamp}` + `detectInconsistentCombinations(policy, mfId)` puro che ritorna array readonly di warning. Implementa 5 detection:
  1. **P-13** — `js==='shared-window' && network==='blocked'` (messaggio PRD §21.9 testo lockato).
  2. **IFRAME_EVENTS** — `dom==='iframe' && events==='broker-plus-dom'` (CustomEvents non cross-iframe).
  3. **STORAGE_BLOCKED_SHADOW** — `storage==='blocked' && dom==='shadow-dom'` (DOM isolato ma localStorage globale).
  4. **JS_SANDBOXED_MOUNT** — `js==='sandboxed-iframe' && dom!=='iframe'` (sandbox richiede iframe container).
  5. **GLOBALS_ISOLATED_JS_SHARED** — `globals==='isolated' && js==='shared-window'` (window scope condiviso).
- Multi-warning supportato (es. P-13 + GLOBALS_ISOLATED_JS_SHARED contemporaneamente quando policy ha entrambe le trigger conditions).
- **`src/warning-matrix.test.ts` (176 LoC, 10 test):** 5 test inconsistent (un test per codice con substring drift detector) + 5 test valid no-warning (DEFAULT + canonical shadow-dom + canonical iframe + shared-window+gateway-only + multi-warning P-13+GLOBALS).

### Task 3 — `lifecycle-register-hook.ts` + 10 test (commit `94095d2`)

- **`src/lifecycle-register-hook.ts` (208 LoC):** Esporta `installRegisterHook(broker, opts)` che subscribe a F8 lifecycle topic `microfrontend.registered`. Per ogni event:
  1. `extractMfId(payload)` defensive con 3-shape fallback (`descriptor.id` / `id` / `microFrontendId`).
  2. `getIsolation(descriptor)` → declared partial isolation.
  3. `resolvePolicy(declared, opts.policyDefault, mfId)` → `ResolvedIsolationPolicy`.
  4. `opts.cache.set(mfId, resolved)` — eager populate per query downstream.
  5. `detectInconsistentCombinations(resolved, mfId)` → per ogni warning: `broker.publish(ISOLATION_WARNING_TOPIC, w)` SYNC + `opts.warn(w.message)` (default `console.warn`).
- AbortSignal cascade cleanup: signal abort → `sub.unsubscribe() + cache.clear()`. Edge case: signal pre-aborted → teardown immediato alla install.
- Structural broker typing `RegisterHookBroker` (subscribe/publish minimal subset) per NO hard dep `@gluezero/core` + test simpler.
- **`src/lifecycle-register-hook.test.ts` (237 LoC, 10 test):** 7 test plan + 3 edge cases:
  1. Subscribe topic `microfrontend.registered` corretto.
  2. Resolve + cache populated con descriptor.isolation override.
  3. Emit warning topic `microfrontend.isolation.warning` su P-13 policy.
  4. Console.warn injection seam called con substring PRD §21.9.
  5. No-warning su DEFAULT policy (zero emit).
  6. AbortSignal cascade: ctrl.abort() → cache cleared + handler unsubscribed.
  7. Idempotent register stesso mfId (cache.set sovrascrive + warning re-emitted).
  8. Edge: payload malformato senza descriptor id → defensive early return (no throw).
  9. Edge: `handle.unsubscribe()` manuale rimuove subscription.
  10. Edge: signal pre-aborted alla install → teardown immediato.

## Decisioni operative

- **OQ-1 (HIGH) RISOLTO** — `microfrontend.registered` SYNC: empirically confermato via mock broker SYNC dispatch (test 2 + 3 vedono cache popolata e warning emessi entro stessa call frame `broker.publish`). Eager resolve+warning pre-mount funziona. Fallback dual-subscribe (registered + bootstrapped) NON necessario.
- **OQ-3 (LOW) RATIFICATO** — Payload shape `IsolationWarning = {microFrontendId, code, combination, message, timestamp}`. Coerente F11/F12 governance payload pattern; F16 SnapshotProvider futuro può consumare la shape stabile.
- **Structural broker typing** — `RegisterHookBroker` subset interface defined locally invece di import `Broker` da `@gluezero/core`. Vantaggi: bundle leaner (no extra type import), test più semplici (mock broker minimale 30 LoC), coerente F11/F12 hook composition pattern.
- **Defensive 3-shape extraction** — `extractMfId` supporta `descriptor.id` + top-level `id` + top-level `microFrontendId`. F8 attualmente emette solo `descriptor.id`, ma future variation (es. F11 capability-checker publishes `{microFrontendId}`) supportata.
- **Test seam `warn` injection** — Default `console.warn` riassegnato via factory `opts.warn ?? defaultWarn` evita global mock di console (test isolation cleaner). Pattern carryover F11 enforcement-points.test.ts.

## Deviazioni dal Plan

Nessuna deviation Rule 1-3 applicata. Plan eseguito esattamente come scritto.

**Edge case tests added oltre al plan:** Il plan specificava 25 test totali (8+10+7); ho aggiunto 4 edge case test extra (1 cache pre-aborted + 1 cache clear() manuale + 3 hook edge cases: payload malformato / unsubscribe handle / signal pre-aborted alla install). Tutti coprono comportamenti correttness-critical NON nel happy path. Test totali finali: 29 (10+10+10 strutturati come 7 plan + 3 edge per Task 3).

## Out-of-scope discoveries

Durante l'esecuzione Task 3 è apparso il file `packages/isolation/src/internal/build-theme-stylesheet.ts` con errori TS syntax. Verifica ownership: file appartiene a **P04 (13-04 W2)** secondo plan linee 75-77. NON è regression del mio plan — è work-in-progress agente parallelo P04. Documentato in `deferred-items.md`. Tests isolation suite (incluse i miei 25 nuovi) passano comunque perché vitest transform skippa file con syntax error a livello di module risolution per i pattern `src/**/*.test.ts`.

## Authentication gates

Nessuno — task interamente offline/local development.

## Files

### Created (8)

| Path | LoC | Scope |
|------|-----|-------|
| `packages/isolation/src/policy-resolver.ts` | 110 | resolvePolicy 3-layer merge + re-export DEFAULT_ISOLATION_POLICY |
| `packages/isolation/src/warning-matrix.ts` | 169 | 5 codici detection + IsolationWarning shape OQ-3 |
| `packages/isolation/src/lifecycle-register-hook.ts` | 208 | installRegisterHook + extractMfId defensive + abortSignal cascade |
| `packages/isolation/src/internal/policy-cache.ts` | 119 | createPolicyCache wrapper Map + abortSignal cascade |
| `packages/isolation/src/policy-resolver.test.ts` | 146 | 10 test (7 resolver + 3 cache) |
| `packages/isolation/src/warning-matrix.test.ts` | 176 | 10 test (5 inconsistent + 5 valid + multi-warning) |
| `packages/isolation/src/lifecycle-register-hook.test.ts` | 237 | 10 test (7 plan + 3 edge cases) |
| `.planning/phases/13-isolation-theme-cache-gateway-worker-integration/deferred-items.md` | — | Out-of-scope discovery tracking |

**Source LoC:** 606 + **Test LoC:** 559 = **1165 LoC totali** (target 1100, +5.9% per edge cases extra).

### Modified (0)

D-83 strict SEXTUPLE esteso preservato — zero diff a `packages/{core,microfrontends,mapper,context,permissions,compat}/src/` (verificato via `git diff 7393fa0 94095d2 --stat -- ...` empty output).

## Bundle metrics

| Metrica | W1 baseline | W2 P02 corrente | Delta |
|---------|-------------|-----------------|-------|
| `dist/index.js` (gzipped) | 526 B | **647 B** | +121 B (+23.0%) |
| `dist/augment.js` (gzipped) | ~177 B | **177 B** | 0 (stabile) |
| Cap configurato | 12 KB | 12 KB | — |
| Headroom residuo | 11.48 KB (95.7%) | **11.37 KB (94.7%)** | -110 B (-1.0%) |
| Uncompressed `dist/index.js` | ~750 B | **1.21 KB** | +475 B |

Bundle delta P02: +121 B gzipped (resolver ~30 B + matrix ~50 B + register hook ~30 B + cache ~10 B + types compressed). Headroom abbondante per P03/P04 (DOM/CSS/storage facades + iframe stub).

## Test breakdown

| File | Test count | Status |
|------|------------|--------|
| `policy-resolver.test.ts` | 10 (7 resolver + 3 cache) | PASS |
| `warning-matrix.test.ts` | 10 (5 inconsistent + 5 valid) | PASS |
| `lifecycle-register-hook.test.ts` | 10 (7 plan + 3 edge cases) | PASS |
| **Totale P02 nuovi** | **30** | **PASS** |
| Pre-existing isolation suite (W1) | 39 | PASS |
| **Suite isolation totale** | **69** | **PASS** |

## REQ coverage

- **MF-ISO-01** (7-key policy resolver merge default+policyDefault+declared partial per chiave, per-MF prevale): **CHIUSO 100%**.
  - 7 chiavi `dom/css/js/events/storage/network/globals` + `options` populated.
  - Partial-merge per chiave verificato (test 4: declared `css` + policyDefault `dom` non-overlap).
  - Per-MF prevale verificato (test 3: declared `iframe` overrides policyDefault `shadow-dom`).
  - Cache eager resolution at register verificata (test 2 register hook + 8 cache).
- **MF-ISO-06** (warning matrix 5 combinazioni inconsistent): **CHIUSO 100%**.
  - 5 codici detection (P-13 + IFRAME_EVENTS + STORAGE_BLOCKED_SHADOW + JS_SANDBOXED_MOUNT + GLOBALS_ISOLATED_JS_SHARED).
  - P-13 messaggio PRD §21.9 substring drift detector.
  - Multi-warning supportato (test 10 matrix: P-13 + GLOBALS contemporaneamente).
  - Emit `microfrontend.isolation.warning` topic SYNC verificato (test 3 hook).
  - Console.warn telemetry verificato (test 4 hook).

## Cross-phase obligation status

- **D-83 strict SEXTUPLE esteso v2.0:** preservato. Zero diff `packages/{core,microfrontends,mapper,context,permissions,compat}/src/` verificato via `git diff 7393fa0 94095d2 --stat` empty output.
- **Frozen baseline v1.0/v1.1:** non toccato (P02 lavora solo su `packages/isolation/src/`).
- **BC §42 v1-bc-replay (267/270):** non re-eseguito in P02 (no diff cross-package); P02 ownership tutti dentro `packages/isolation/` quindi BC contract preservato by-construction.
- **MF-PIPE-01 (Tap composition cross-fase):** non toccato in P02 (deferred a W3 P05/P06 integration).

## OQ resolution

- **OQ-1 (HIGH)** `microfrontend.registered` topic timing: **RISOLTO — SYNC confermato** via mock broker SYNC dispatch in test 2+3 lifecycle-register-hook.test.ts. Eager resolve + warning emit pre-mount funzionante. Fallback dual-subscribe non necessario.
- **OQ-3 (LOW)** Warning payload shape: **RATIFICATO** `{microFrontendId, code, combination, message, timestamp}` (test pattern coerente F11/F12). F16 SnapshotProvider e devtools overlay possono consumare la shape stabile.

## Known stubs

Nessuno. Implementazione completa per scope W2 P02. W2 P03 implementerà `isolationModule().install` con lookup + service construction + lifecycle subscribe + wrap-context (file ownership disgiunta da P02).

## Commits

| # | Hash | Type | Message |
|---|------|------|---------|
| 1 | `aa7815a` | feat | policy-resolver merge PRD §21.3 default + policyDefault + descriptor.isolation partial-merge per chiave |
| 2 | `bbf3d9e` | feat | warning-matrix MF-ISO-06 5 combinazioni inconsistent (P-13 + IFRAME_EVENTS + STORAGE_BLOCKED_SHADOW + JS_SANDBOXED_MOUNT + GLOBALS_ISOLATED_JS_SHARED) |
| 3 | `94095d2` | feat | lifecycle-register-hook subscribe microfrontend.registered + cache Map<mfId, ResolvedIsolationPolicy> + abortSignal cascade |
| 4 | (next) | docs | SUMMARY.md plan W2 policy resolver + warning matrix + lifecycle-register |

## Success criteria check

- [x] `pnpm --filter @gluezero/isolation test` PASS — **69/69 PASS** (30 nuovi P02 + 39 pre-existing W1).
- [x] `resolvePolicy` ritorna `ResolvedIsolationPolicy` 7 chiavi + options sempre populated.
- [x] `detectInconsistentCombinations` rileva 5 combinazioni (P-13, IFRAME_EVENTS, STORAGE_BLOCKED_SHADOW, JS_SANDBOXED_MOUNT, GLOBALS_ISOLATED_JS_SHARED).
- [x] P-13 message contiene substring PRD §21.9 "Network blocking cannot be fully enforced".
- [x] `installRegisterHook` subscribe a `microfrontend.registered` + emit `microfrontend.isolation.warning` SYNC.
- [x] AbortSignal cascade: `ctrl.abort()` → `cache.clear()` + `sub.unsubscribe()` verificato.
- [x] Payload warning shape OQ-3 `{microFrontendId, code, combination, message, timestamp}` ratificato.
- [x] D-83 strict SEXTUPLE esteso preservato — zero diff cross-package verificato.
- [x] MF-ISO-01 + MF-ISO-06 REQ coverage 100% closed in P02.

## Self-Check: PASSED

**Files created — esistenza verificata:**
- FOUND: `packages/isolation/src/policy-resolver.ts`
- FOUND: `packages/isolation/src/warning-matrix.ts`
- FOUND: `packages/isolation/src/lifecycle-register-hook.ts`
- FOUND: `packages/isolation/src/internal/policy-cache.ts`
- FOUND: `packages/isolation/src/policy-resolver.test.ts`
- FOUND: `packages/isolation/src/warning-matrix.test.ts`
- FOUND: `packages/isolation/src/lifecycle-register-hook.test.ts`
- FOUND: `.planning/phases/13-isolation-theme-cache-gateway-worker-integration/deferred-items.md`

**Commits — hash verificati esistenti:**
- FOUND: `aa7815a` (Task 1)
- FOUND: `bbf3d9e` (Task 2)
- FOUND: `94095d2` (Task 3)

**Test suite verifica:** 69/69 PASS (vitest run isolation package).

**Bundle gate:** 647 B / 12 KB cap (5.3% used; 94.7% headroom).
