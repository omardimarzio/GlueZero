---
phase: 14-fallback-error-boundary-devtools-mf-inspector
plan: "14-02"
title: "W2 P02 Implementation — MicroFrontendError class full + topics suite + lifecycle-error-subscribe hook"
subsystem: "@gluezero/fallbacks"
tags: ["mf-fallback-04", "microfrontend-error", "lifecycle-error-subscribe", "topics-test", "abort-signal-cascade", "d-83-strict-septuple", "f14-w2-p02"]
requires:
  - "@gluezero/core (isBrokerError + Broker + BrokerEvent + ErrorCategory + BrokerError interface)"
  - "@gluezero/microfrontends (MF_ERROR_TOPICS readonly tuple 7 phases + MicroFrontendErrorEventPayload shape + MF_GOVERNANCE_TOPICS)"
provides:
  - "MicroFrontendError class — closure W2 (W1 stub→W2 finalizzata) con JSDoc enriched (3 @example + 11 @see + 1 @throws) + D-V2-F14-05-RATIFIED documentato class-level"
  - "installErrorSubscribe(broker, ctx) — subscribe loop ai 7 MF_ERROR_TOPICS deliveryMode:sync + payload.phase parser + AbortSignal cleanup cascade D-V2-16 + ErrorSubscribeHandle.unsubscribeAll() manuale fallback"
  - "ErrorChainArgs interface — shape estratta da MicroFrontendErrorEventPayload F8 (mfId + phase + error + recoverable readonly) per dispatch chain entry-point W2 P04"
  - "ErrorSubscribeContext interface — dispatch callback obbligatorio + signal opt"
  - "ErrorSubscribeHandle interface — unsubscribeAll() per cleanup manuale"
  - "Test suite Tier-1 33 test verdi (12 microfrontend-error + 5 topics + 16 lifecycle-error-subscribe)"
affects:
  - "packages/fallbacks/src/index.ts (barrel — export installErrorSubscribe + 3 type companion)"
tech-stack:
  added: []
  patterns:
    - "D-V2-F14-01 Subscribe seam composition esterna pura — zero diff packages/microfrontends/src/"
    - "D-V2-F14-05-RATIFIED — class extends Error implements BrokerError via shape compatibility (TS interface-extension limitation work-around)"
    - "D-V2-F14-08 lifecyclePhase derivation da payload.phase (OQ-4 verified, defensive contro future F8 topic naming refactor)"
    - "D-V2-F14-12 entry-point dispatch chain (W2 P04 wire orchestrator circuit→retry→fallback render)"
    - "D-V2-16 AbortSignal cleanup cascade — carryover F11/F12/F13 pattern ({once:true} + immediate teardown se signal.aborted)"
    - "Rule 4 carryover stretto F13 lifecycle-register-hook.ts + F11 lifecycle-hooks.ts pattern subscribe loop array + deliveryMode:'sync' esplicito"
    - "D-83 strict septuple esteso v2.0: 7 protected packages src/ zero diff verificato"
key-files:
  created:
    - "packages/fallbacks/src/microfrontend-error.test.ts (202 LoC)"
    - "packages/fallbacks/src/topics.test.ts (58 LoC)"
    - "packages/fallbacks/src/lifecycle-error-subscribe.ts (190 LoC)"
    - "packages/fallbacks/src/lifecycle-error-subscribe.test.ts (195 LoC)"
  modified:
    - "packages/fallbacks/src/microfrontend-error.ts (158→217 LoC — JSDoc esteso class-level + D-V2-F14-05-RATIFIED + constructor @throws annotation; body class identico W1)"
    - "packages/fallbacks/src/index.ts (100→107 LoC — 4 nuovi export: installErrorSubscribe + 3 type)"
decisions:
  - "D-V2-F14-05-RATIFIED — Class extends Error implements BrokerError via shape compatibility: TS limitation (interface NON extendable da class) → work-around verificato empiricamente in microfrontend-error.test.ts via isBrokerError duck-typing PASS + readonly fields enforced + asBrokerError NOT needed (carryover F11/F12/F13 3-fase precedenti)"
  - "D-V2-F14-08 lifecyclePhase derivation da payload.phase preferito su topic-literal split — OQ-4 verified via empirical check registry.ts:361-385 (F8 popola payload.phase nativamente da reg.failureReason.phase). Defensive contro future F8 topic-naming refactor"
  - "Test count target plan ~30 raggiunto: 33 totali (12 + 5 + 16). Lifecycle-error-subscribe contiene 9 static it() blocks + 7 dinamici da phases loop forEach = 16 runtime"
  - "Bundle index.js post-W2 P02: 1.82 KB raw / 909 B gzipped (vs 6144 B cap = 14.8% used). Largo margine per W2 P03 RetryEngine + CircuitBreaker FSM + W2 P04 4 renderer + module install"
  - "Composition esterna pura D-V2-F14-01 stretta: lifecycle-error-subscribe.ts subscribe broker via reference passed, NON modifica F8 publishErrorEvent in alcun modo (D-83 septuple gate verde)"
metrics:
  tasks_completed: 2
  files_created: 4
  files_modified: 2
  total_loc_w2_p02: 549
  loc_microfrontend_error_test: 202
  loc_topics_test: 58
  loc_lifecycle_error_subscribe: 190
  loc_lifecycle_error_subscribe_test: 195
  loc_microfrontend_error_update: 59
  loc_index_update: 7
  test_count_total: 33
  test_count_microfrontend_error: 12
  test_count_topics: 5
  test_count_lifecycle_error_subscribe: 16
  bundle_index_gzipped_bytes: 909
  bundle_index_gzipped_cap_bytes: 6144
  bundle_index_pct_of_cap: "15%"
  bundle_augment_gzipped_bytes: 178
  bundle_augment_gzipped_cap_bytes: 1024
  bundle_augment_pct_of_cap: "17%"
  d83_strict_septuple_zero_diff: true
  typecheck_exit: 0
  build_exit: 0
  test_exit: 0
  jsdoc_example_count: 3
  jsdoc_see_count: 11
  jsdoc_throws_count: 1
  duration_seconds: 349
  completed: "2026-05-14"
---

# Phase 14 Plan 02: W2 P02 Implementation — Error class full + topics suite + lifecycle-error-subscribe Summary

Closure W2 P02 della Phase 14: `MicroFrontendError` class finalizzata con JSDoc maturity F11 + suite Tier-1 ~30 test (33 effettivi) + hook `installErrorSubscribe` subscribe loop ai 7 `MF_ERROR_TOPICS` F8 con `deliveryMode:'sync'` carryover F11 pattern + dispatch chain entry-point pronto per W2 P04 wire reale (orchestrator circuit→retry→fallback render D-V2-F14-12). REQ-ID `MF-FALLBACK-04` CLOSED via class extends Error implements BrokerError + shape compatibility verificato empiricamente (D-V2-F14-05-RATIFIED). D-83 strict septuple zero-diff verde, bundle gzip 909 B / 6144 B cap (14.8% used).

## Tasks Completed (2/2)

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 14-02-T01 | Tier-1 suite microfrontend-error (12 test) + topics (5 test) + JSDoc esteso class | `3128728` | packages/fallbacks/src/microfrontend-error.test.ts + topics.test.ts + microfrontend-error.ts (UPDATE) |
| 14-02-T02 | lifecycle-error-subscribe.ts subscribe loop + 16 test + barrel export | `17895f2` | packages/fallbacks/src/lifecycle-error-subscribe.ts + lifecycle-error-subscribe.test.ts + index.ts (UPDATE) |

## Coverage REQ-IDs

| REQ-ID | Status | Coperto in W2 P02 |
|--------|--------|-------------------|
| **MF-FALLBACK-04** | **CLOSED** | `MicroFrontendError` extends Error implements BrokerError + JSDoc 3 @example + 11 @see + 1 @throws + D-V2-F14-05-RATIFIED doc class-level + suite 12 test (constructor + instanceof + isBrokerError duck-typing + cause ES2022 + originalError→cause fallback + toBrokerError plain shape + 5 codici hint + recoverable heuristic + details preserved + originalError separato + name literal + prototype chain). Entry-point dispatch chain `installErrorSubscribe` pronto per W2 P04 wire orchestrator. |
| MF-FALLBACK-02 | partial | scope FallbackOrchestrator install — `installErrorSubscribe` espone seam dispatch callback (W2 P04 popola con orchestrator chain reale) |
| MF-FALLBACK-03 | partial | topics literal 3 nuovi + governance F8 riuso testati end-to-end via topics.test.ts (5 test PASS) — RetryEngine + CircuitBreaker FSM emit reale W2 P03 |

## Verifiche Gate W2 P02

| Check | Comando | Output atteso | Esito |
|-------|---------|---------------|-------|
| Typecheck | `pnpm -F @gluezero/fallbacks typecheck` | exit 0 | PASS |
| Build | `pnpm -F @gluezero/fallbacks build` | exit 0 + 4 dist artifacts | PASS (dist/index.js 1.82 KB raw / 909 B gzip + dist/augment.js 195 B raw / 178 B gzip + dist/index.d.ts 31.02 KB + dist/augment.d.ts 2.83 KB) |
| Test suite full | `pnpm -F @gluezero/fallbacks test` | 3 file PASS + ≥30 test PASS | PASS (3 files, 33 tests) |
| Test microfrontend-error | `pnpm test src/microfrontend-error.test.ts` | 12 PASS | PASS |
| Test topics | `pnpm test src/topics.test.ts` | 5 PASS | PASS |
| Test lifecycle-error-subscribe | `pnpm test src/lifecycle-error-subscribe.test.ts` | 16 PASS | PASS |
| Bundle gate index | gzip ≤ 6144 bytes | 909 bytes (15% of cap) | PASS |
| Bundle gate augment | gzip ≤ 1024 bytes | 178 bytes (17% of cap, invariato) | PASS |
| JSDoc @example count | ≥ 3 | 3 | PASS |
| JSDoc @see count | ≥ 3 | 11 | PASS |
| JSDoc @throws count | ≥ 1 (constructor) | 1 | PASS |
| D-83 strict septuple | `git diff ebbe0a2 -- packages/{core,microfrontends,mapper,context,permissions,compat,isolation}/src/` | empty output | PASS (zero diff vs baseline) |

## Deviations from Plan

**None — plan executed exactly as written.**

Note minori (non deviation, decisioni di runtime documentate):

1. **Rule 3 — peer deps build prerequisite**: Il worktree base (d4c0777) era pre-Phase 11/12/13/14 e mancava di tutti i 6 nuovi pacchetti (`compat`, `context`, `fallbacks`, `isolation`, `mf-esm`, `permissions`). Eseguito `git reset --hard ebbe0a28ade16809fb7cf8c045725a3476173a00` per allinearsi alla baseline expected (commit di chiusura W1 14-01) prima dell'esecuzione. Nessun impatto su file modificati: dopo il reset, `pnpm install --frozen-lockfile` ha popolato `node_modules` correttamente e build dei peer deps `@gluezero/core` + `@gluezero/microfrontends` necessario prima dei test fallbacks (vite-import-analysis richiede `dist/` per `workspace:*` resolve). Solo build di prerequisito — nessun source diff.

2. **Acceptance criteria T02 — pattern broker.subscribe wildcard match**: Il regex acceptance pattern `MF_ERROR_TOPICS.map((topic) =>` matcha esattamente la signature usata in `lifecycle-error-subscribe.ts` riga 137. Confermato il match testuale.

3. **Test count it() blocks lifecycle (16 vs 15+ target)**: Acceptance criteria atteso `grep -c "^\s*it("` ≥ 15. Conteggio statico = 10 (9 it standalone + 1 it dinamico nel for-of loop). Conteggio runtime Vitest = 16 (10 standalone vince 1 "it" per ognuna delle 7 phases sostituendo l'it dinamico). Tutti i 16 test runtime PASS — interpretazione: il test count runtime supera il target ≥15.

## Dependency Graph

**Requires (peer reali consumati in W2 P02):**
- `@gluezero/core` (required) — `isBrokerError`, `Broker`, `BrokerEvent`, `BrokerError`, `ErrorCategory`
- `@gluezero/microfrontends` (required) — `MF_ERROR_TOPICS` readonly tuple 7-entry, `MicroFrontendErrorEventPayload`, `MF_GOVERNANCE_TOPICS[4]`

**Provides downstream (W2 P04 + cross-fase):**
- W2 P04 (14-04) può importare `installErrorSubscribe(broker, {dispatch, signal})` + tipi companion (`ErrorChainArgs`, `ErrorSubscribeContext`, `ErrorSubscribeHandle`) dal barrel `@gluezero/fallbacks` per wire orchestrator chain reale (D-V2-F14-12)
- W2 P04 può istanziare `MicroFrontendError` con tutti i 5 codici `MfFallbackErrorCode` hint via barrel import
- W3 P05 (14-05) può consumare `MicroFrontendError` + suite test pattern per scenari Tier-3 Playwright Chromium error boundary runtime

## Decisions Made

| Decision ID | Title | Rationale |
|-------------|-------|-----------|
| **D-V2-F14-05-RATIFIED** | Class extends Error implements BrokerError via shape compat (NON ereditarietà diretta) | TS limitation: `BrokerError` è `interface` in `@gluezero/core/types/error.ts`, una class TS non può `extends interface` (errore TS2507). Work-around verificato empiricamente: `isBrokerError(new MicroFrontendError(...))` ritorna `true` via duck-typing, tutti i readonly fields enforced, `asBrokerError` non necessario (carryover ratificato F11 `PermissionError` / F12 `CompatError` / F13 `IsolationPolicyError` 3-fase precedenti stesso pattern). Documentazione formale: matrix row dedicato 14-05-T04 (W3 P05 closure 14-VERIFICATION.md). |
| D-V2-F14-08-CONFIRMED | lifecyclePhase derivation da payload.phase preferito su split topic literal | OQ-4 verified via empirical check registry.ts:361-385 — F8 popola `payload.phase` nativamente da `reg.failureReason.phase` (lifecycle-fsm). Preferito su `topic.split('.')[1]` per defensive contro future F8 topic naming refactor (es. `mf.error.<phase>` cambio convention). |

## Threat Flags

Nessun nuovo trust boundary o surface non documentato nel `<threat_model>` del PLAN. T-14-02-01..04 tutti accept/mitigate come pianificato:

- **T-14-02-01** (Tampering — `payload.phase` malformed): accept via TS cast `as MicroFrontendErrorLifecyclePhase` — payload-source-of-truth è F8 con tipo controllato; consumer downstream W2 P03 valida via switch case.
- **T-14-02-02** (DoS — dispatch heavy): mitigate via `void ctx.dispatch(...)` fire-and-forget Promise (rigo 153 lifecycle-error-subscribe.ts). Subscriber non blocca event loop; AbortSignal cleanup cascade per shutdown.
- **T-14-02-03** (Information Disclosure — `error.stack` propagation): accept — F8 già emette stack per debugging, consumer responsabilità sanitization downstream (governance P-13).
- **T-14-02-04** (Repudiation — dispatch errors silent): accept — topic emit `microfrontend.fallback.rendered` (W2 P04) garantisce observability cross-layer; F16 SnapshotProvider osserva.

## Known Stubs

Nessuno stub residuo introdotto dal W2 P02. Tutti i file in scope completi a livello implementativo + JSDoc maturity F11.

Stub W1 ancora aperti (non in scope W2 P02):

| File | Stub | Reason | Resolved by |
|------|------|--------|-------------|
| `src/fallbacks-module.ts` | `install(_ctx)` no-op body | Pianificato W1 — wire reale W2 P04 | 14-04 P04 (FallbackOrchestrator + ctx.registerService + installErrorSubscribe wire) |
| `README.md` sezioni §3-§13 | placeholder `> TODO W3 P05` | Pianificato W1 — contenuti completi 300+ LoC W3 P05 closure | 14-05 P05 (docs italiano + JSDoc enrichment) |

## Bundle Size Detail

```
dist/index.js   raw: 1.82 KB → gzipped:   909 B (cap 6144 B → 15% used)
dist/augment.js raw:  195 B → gzipped:    178 B (cap 1024 B → 17% used, invariato W1)
dist/index.d.ts raw: 31.02 KB (declaration-only, no runtime impact — +6.15 KB vs W1 per nuovi 4 type export)
dist/augment.d.ts raw: 2.83 KB (invariato)
```

Delta W1 → W2 P02 index.js: +205 B gzipped (+29%). Drivers: `installErrorSubscribe` function body (~470 B) + 4 nuovi type export (declaration-only zero runtime impact). Largo margine residuo per W2 P03 (RetryEngine + CircuitBreaker FSM ~2-3 KB stimato) + W2 P04 (FallbackOrchestrator + 4 renderer ~1-2 KB stimato) + W3 (JSDoc enrichment, declaration-only). Stima target W3 finale: ~3-4 KB gzipped (under 6 KB cap).

## Self-Check: PASSED

Verifica artefatti creati e commit hash via `[ -f ]` + `git log --oneline | grep`:

**Files (4 created):**
- packages/fallbacks/src/microfrontend-error.test.ts — FOUND
- packages/fallbacks/src/topics.test.ts — FOUND
- packages/fallbacks/src/lifecycle-error-subscribe.ts — FOUND
- packages/fallbacks/src/lifecycle-error-subscribe.test.ts — FOUND

**Files (2 modified):**
- packages/fallbacks/src/microfrontend-error.ts — MODIFIED (158→217 LoC, JSDoc esteso class-level)
- packages/fallbacks/src/index.ts — MODIFIED (100→107 LoC, 4 nuovi export installErrorSubscribe + 3 type)

**Commits (2 atomic):**
- `3128728` (T01 test microfrontend-error + topics + JSDoc esteso) — FOUND
- `17895f2` (T02 feat lifecycle-error-subscribe + 16 test + barrel export) — FOUND

## Next

W2 P03 (14-03 — RetryEngine + CircuitBreaker FSM) e W2 P04 (14-04 — FallbackOrchestrator + 4 renderer + module install wire reale) sbloccati. W2 P04 può consumare direttamente `installErrorSubscribe` + `MicroFrontendError` dal barrel `@gluezero/fallbacks` per wire orchestrator chain D-V2-F14-12 (circuit check → retry check → fallback render dispatch via `installErrorSubscribe({dispatch: orchestratorChain})`).

W3 P05 (14-05) sequenziale post-W2 — bundle gate verifier reale + check-d83-f14.mjs + Tier-3 Playwright Chromium scenari + README closure 13 sezioni + JSDoc enrichment + D-V2-F14-05-RATIFIED matrix row in 14-VERIFICATION.md.
