---
phase: 14-fallback-error-boundary-devtools-mf-inspector
plan: "14-01"
title: "W1 Foundation — Scaffolding @gluezero/fallbacks (15° package monorepo)"
subsystem: "@gluezero/fallbacks"
tags: ["scaffolding", "fallback", "error-boundary", "pattern-s1-augment", "service-locator", "f14-w1"]
requires:
  - "@gluezero/core (SERVICE_FALLBACKS constant + BrokerError/ErrorCategory/BrokerModule types)"
  - "@gluezero/microfrontends (MicroFrontendDescriptor + MF_GOVERNANCE_TOPICS[4] reuse)"
provides:
  - "@gluezero/fallbacks 15° workspace package — ESM-only multi-entry build + Tier-1 jsdom + Tier-3 Playwright Chromium config"
  - "MicroFrontendFallbackPolicy 6 onXError scope interface (frozen REQUIREMENTS.md riga 140 + 2 policy-level retry/circuit)"
  - "FallbackDefinition discriminated union 5-mode (html/component/event/custom/none)"
  - "RetryPolicy 3-backoff + ±20% jitter + CircuitBreakerPolicy 3-state machine signature"
  - "MfFallbackErrorCode 5-literal hint type union (MF_FALLBACK_RENDER_FAILED + MF_RETRY_EXHAUSTED + MF_CIRCUIT_OPEN + MF_FALLBACK_TARGET_NOT_FOUND + MF_FALLBACK_COMPONENT_NO_ADAPTER)"
  - "MicroFrontendErrorLifecyclePhase 7-phase union (load/bootstrap/mount/runtime/update/unmount/destroy)"
  - "MicroFrontendError class extends Error implements BrokerError + toBrokerError helper (body completo W1 per typecheck downstream)"
  - "fallbacksModule({defaultPolicy?, retryDefault?, circuitDefault?}) factory STUB 3-opt (install no-op W1, wire reale W2 P04)"
  - "MF_FALLBACK_TOPICS 3 nuovi literal (microfrontend.recovered + microfrontend.circuit.opened + microfrontend.circuit.closed) + FALLBACK_RENDERED_TOPIC riuso F8 + FALLBACK_EVENT_DEFAULT_TOPIC"
  - "SERVICE_FALLBACKS Service Locator binding (re-export da @gluezero/core) + FallbacksService interface"
  - "FallbackAwareMfDescriptor + getFallback helper accessor (D-V2-F14-19 stretto Pattern S1, NO declare module upstream)"
  - "__fallbacksAugmentLoaded marker audit-grep tree-shake fail detection"
affects:
  - "pnpm-lock.yaml (15° workspace registrato via packages/* glob)"
tech-stack:
  added: []
  patterns:
    - "D-V2-F14-19 Pattern S1 stretto augment side-effect-only (carryover F11/F12/F13)"
    - "D-V2-F14-04 BrokerModule factory 3-opt scaling (vs F13 2-opt — 3 concept indipendenti)"
    - "D-V2-F14-05 class divergente da factory carryover F11/F12/F13 (instanceof + cause ES2022)"
    - "D-V2-F14-19 NO declaration merging upstream — helper accessor getFallback pattern F11/F13"
    - "Riuso F8 MF_GOVERNANCE_TOPICS[4] = 'microfrontend.fallback.rendered' (Pitfall 7 ACK)"
    - "D-V2-02 Service Locator BLOCKING — riuso SERVICE_FALLBACKS constant @gluezero/core/services.ts"
    - "D-83 strict septuple esteso v2.0: 7 protected packages src/ zero diff"
key-files:
  created:
    - "packages/fallbacks/package.json (120 LoC)"
    - "packages/fallbacks/tsup.config.ts (33 LoC)"
    - "packages/fallbacks/tsconfig.json (11 LoC)"
    - "packages/fallbacks/vitest.config.ts (38 LoC)"
    - "packages/fallbacks/vitest.browser.config.ts (33 LoC)"
    - "packages/fallbacks/src/types/errors.ts (53 LoC)"
    - "packages/fallbacks/src/types/policy.ts (117 LoC)"
    - "packages/fallbacks/src/types/descriptor-augment.ts (54 LoC)"
    - "packages/fallbacks/src/topics.ts (75 LoC)"
    - "packages/fallbacks/src/augment.ts (72 LoC)"
    - "packages/fallbacks/src/service-locator.ts (60 LoC)"
    - "packages/fallbacks/src/microfrontend-error.ts (158 LoC)"
    - "packages/fallbacks/src/fallbacks-module.ts (109 LoC)"
    - "packages/fallbacks/src/index.ts (99 LoC)"
    - "packages/fallbacks/README.md (78 LoC)"
  modified:
    - "pnpm-lock.yaml (workspace 15° registrato — autoregenerated via packages/* glob)"
decisions:
  - "D-V2-F14-19 Pattern S1 augment side-effect-only stretto carryover F13 — descriptor-augment.ts type-only narrowing locale, NO declare module upstream (audit marker `__fallbacksAugmentLoaded`)"
  - "D-V2-F14-04 fallbacksModule factory 3-opt (defaultPolicy + retryDefault + circuitDefault) — divergenza ratificata vs F13 2-opt per scope 3 concept indipendenti (fallback + retry + circuit)"
  - "D-V2-F14-05 MicroFrontendError class extends Error (vs F11/F12/F13 factory pattern) — supporto instanceof type narrowing devtools-friendly + cause ES2022 propagation auto-popolato da originalError"
  - "D-V2-F14-02 riuso F8 MF_GOVERNANCE_TOPICS[4] FALLBACK_RENDERED_TOPIC via index access (Pitfall 7 ACK — NO duplica literal)"
  - "D-V2-F14-06 MfFallbackErrorCode hint type literal locale (5 codici) — NO estende MicroFrontendErrorCode union F8 (D-83 strict block)"
  - "MF-FALLBACK-01 6-scope contract REQUIREMENTS.md riga 140 frozen confermato in policy.ts: onLoadError? + onBootstrapError? + onMountError? + onRuntimeError? + onUpdateError? + onUnmountError? (destroy phase via default fallback orchestrator chain W2 P04, NO per-policy field)"
metrics:
  tasks_completed: 3
  files_created: 15
  files_modified: 1
  total_loc: 1110
  bundle_index_gzipped_bytes: 704
  bundle_index_gzipped_cap_bytes: 6144
  bundle_index_pct_of_cap: "11%"
  bundle_augment_gzipped_bytes: 178
  bundle_augment_gzipped_cap_bytes: 1024
  bundle_augment_pct_of_cap: "17%"
  d83_strict_septuple_zero_diff: true
  typecheck_exit: 0
  build_exit: 0
  test_exit: 0
  augment_marker_grep: "match"
  completed: "2026-05-14"
---

# Phase 14 Plan 01: W1 Foundation — Scaffolding `@gluezero/fallbacks` Summary

W1 foundation completata: `@gluezero/fallbacks` (15° package monorepo) registrato come workspace pnpm con build/test/typecheck end-to-end funzionanti, skeleton TS interfaces 5 REQ-IDs (MF-FALLBACK-01..05) pronto a sbloccare esecuzione parallela W2 (P02 + P03 + P04 file ownership disgiunta), bundle gate ampiamente sotto cap (704 B gzipped vs 6 KB allowed, 11% usato) e D-83 strict septuple zero-diff preservato.

## Tasks Completed (3/3)

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 14-01-T01 | Scaffolding manifest + build config + workspace registration | `6659fab` | package.json + tsup.config.ts + tsconfig.json + vitest.config.ts + vitest.browser.config.ts + pnpm-lock.yaml |
| 14-01-T02 | Types skeleton + topics + augment + service-locator | `6ed40b0` | src/types/errors.ts + src/types/policy.ts + src/types/descriptor-augment.ts + src/topics.ts + src/augment.ts + src/service-locator.ts |
| 14-01-T03 | MicroFrontendError class stub + fallbacksModule factory stub + barrel index.ts + README skeleton | `0e33f97` | src/microfrontend-error.ts + src/fallbacks-module.ts + src/index.ts + README.md |

## Coverage REQ-IDs (W1 skeleton parziale)

| REQ-ID | Status | Coperto in W1 | Da chiudere |
|--------|--------|---------------|-------------|
| MF-FALLBACK-01 | partial | `MicroFrontendFallbackPolicy` interface esposta — 6 onXError scope frozen REQUIREMENTS.md riga 140 + 2 policy-level retry/circuit | W2 P04 orchestrator chain + W3 P05 docs |
| MF-FALLBACK-02 | not-started | scope FallbackOrchestrator install + integrazione MF_ERROR_TOPICS subscribe | W2 P02 |
| MF-FALLBACK-03 | partial | 3 topics literal nuovi (microfrontend.recovered + circuit.opened + circuit.closed) + CircuitBreakerPolicy interface + FALLBACK_RENDERED_TOPIC riuso F8 | W2 P03 circuit FSM impl + W3 P05 docs |
| MF-FALLBACK-04 | partial | `MicroFrontendError` class signature definitiva (body completo W1 per typecheck downstream) + `MfFallbackErrorCode` 5-literal hint | W2 P02 throw points reali + W3 P05 docs |
| MF-FALLBACK-05 | not-started | scope `RetryPolicy` + RetryEngine impl + ±20% jitter mitigation | W2 P03 RetryEngine impl |

## Verifiche Gate W1

| Check | Comando | Output atteso | Esito |
|-------|---------|---------------|-------|
| Typecheck | `pnpm -F @gluezero/fallbacks typecheck` | exit 0 | PASS |
| Build | `pnpm -F @gluezero/fallbacks build` | exit 0 + 4 dist artifacts | PASS (dist/index.js 1.40 KB raw + dist/augment.js 195 B raw + dist/index.d.ts 22 KB + dist/augment.d.ts 2.83 KB) |
| Test runner | `pnpm -F @gluezero/fallbacks test` | passWithNoTests OK | PASS |
| Pattern S1 audit | `grep __fallbacksAugmentLoaded packages/fallbacks/dist/augment.js` | match | PASS (`var t=true;export{t as __fallbacksAugmentLoaded}`) |
| Bundle gate index | gzip size ≤ 6144 bytes | 704 bytes (11% of cap) | PASS |
| Bundle gate augment | gzip size ≤ 1024 bytes | 178 bytes (17% of cap) | PASS |
| D-83 strict septuple | `git diff 9fd360c -- packages/{core,microfrontends,mapper,context,permissions,compat,isolation}/src/` | empty output | PASS (zero diff to 7 protected packages) |
| Workspace registration | `pnpm install` | exit 0 + 5 peer symlinks creati | PASS |

## Deviations from Plan

**None — plan executed exactly as written.**

Note minori (non deviation, decisioni di runtime documentate nel PLAN):
1. **pnpm-workspace.yaml**: il file include già `packages/*` glob — nessun diff esplicito necessario (Task 1 Step 6 condizionale). Il workspace 15° fallbacks viene auto-discovered.
2. **.size-limit.json root**: non presente in repo (size-limit gestito per-package via `package.json["size-limit"]` array, carryover F13 stretto). Task 1 Step 7 skipped come previsto.
3. **tsc 6.x flag `override`**: aggiunto `override readonly name = 'MicroFrontendError' as const` in `MicroFrontendError` per soddisfare `noImplicitOverride: true` ereditato da `tsconfig.base.json` (Error.name è ereditato dal prototype) — coerente con TS 6.x strict ratification, no impatto runtime.

## Dependency Graph

**Requires (peer):**
- `@gluezero/core` (required) — SERVICE_FALLBACKS, BrokerError, ErrorCategory, BrokerModule
- `@gluezero/microfrontends` (required) — MicroFrontendDescriptor, MF_GOVERNANCE_TOPICS[4]
- `@gluezero/context` (optional) — MicroFrontendRuntimeContext for custom handler ctx
- `@gluezero/permissions` (optional) — type compat only (OQ-2 risolto, no permission check runtime)
- `@gluezero/isolation` (optional) — SERVICE_ISOLATION lookup for shadow-dom html-renderer target

**Provides downstream (W2/W3 + cross-fase):**
- W2 P02 (14-02): error subscribe — usa MicroFrontendError class + MfFallbackErrorCode + MF_ERROR_TOPICS subscribe pattern
- W2 P03 (14-03): RetryEngine + CircuitBreaker — usa RetryPolicy + CircuitBreakerPolicy + MF_FALLBACK_TOPICS emit
- W2 P04 (14-04): FallbackOrchestrator + 4 renderer — usa FallbackDefinition discriminated union + getFallback + fallbacksModule install wire
- W3 P05 (14-05): bundle gate verifier + check-d83-f14.mjs + Tier-3 Playwright Chromium scenari + README closure 13 sezioni

## Decisions Made

Tutte già documentate nel CONTEXT.md/PLAN.md (D-V2-F14-02..19). Nessuna nuova decisione architettonica introdotta in W1 (scaffolding pure Rule 4 carryover F11/F12/F13).

## Threat Flags

Nessun nuovo trust boundary o surface non documentato nel `<threat_model>` del PLAN. T-14-01-01..04 tutti accept/mitigate come pianificato:
- T-14-01-01 (Tampering — MfFallbackErrorCode espansione consumer): accept via `code: string` aperto + hint type informativo.
- T-14-01-02 (Information Disclosure — toBrokerError espone originalError): accept via helper opt-in + governance P-13 (sanitization consumer responsibility).
- T-14-01-03 (DoS — augment tree-shake): mitigate via sideEffects array 4-entry + audit-grep `__fallbacksAugmentLoaded` (PASS verificato in build output).
- T-14-01-04 (Elevation — D-83 violation): mitigate via git diff septuple gate (PASS verificato — zero diff).

## Known Stubs

| File | Stub | Reason | Resolved by |
|------|------|--------|-------------|
| `src/microfrontend-error.ts` | class body completo (NO stub residuo) | Necessario per typecheck downstream W2 (W2 P02 importa + istanzia) | Già completo W1 |
| `src/fallbacks-module.ts` | `install(_ctx)` no-op body | Pianificato W1 — wire reale W2 P04 | 14-04 P04 (FallbackOrchestrator + ctx.registerService) |
| `README.md` sezioni §3-§13 | placeholder `> TODO W3 P05` | Pianificato W1 — contenuti completi 300+ LoC W3 P05 closure | 14-05 P05 (docs italiano + JSDoc enrichment) |

Tutti gli stub sono intenzionali e documentati nel PLAN. Nessuno blocca il completamento del plan W1.

## Bundle Size Detail

```
dist/index.js   raw: 1441 B → gzipped:  704 B (cap 6144 B → 11% used)
dist/augment.js raw:  195 B → gzipped:  178 B (cap 1024 B → 17% used)
dist/index.d.ts raw: 22646 B (declaration-only, no runtime impact)
dist/augment.d.ts raw: 2913 B
```

Largo margine per W2 (orchestrator + 4 renderer + RetryEngine + CircuitBreaker FSM) e W3 (JSDoc enrichment). Stima target W3 finale: ~4-5 KB gzipped (under 6 KB cap).

## Self-Check: PASSED

Verifica artefatti creati e commit hash via `[ -f ]` + `git log --oneline --all | grep`:

**Files (15 created):**
- packages/fallbacks/package.json — FOUND
- packages/fallbacks/tsup.config.ts — FOUND
- packages/fallbacks/tsconfig.json — FOUND
- packages/fallbacks/vitest.config.ts — FOUND
- packages/fallbacks/vitest.browser.config.ts — FOUND
- packages/fallbacks/src/types/errors.ts — FOUND
- packages/fallbacks/src/types/policy.ts — FOUND
- packages/fallbacks/src/types/descriptor-augment.ts — FOUND
- packages/fallbacks/src/topics.ts — FOUND
- packages/fallbacks/src/augment.ts — FOUND
- packages/fallbacks/src/service-locator.ts — FOUND
- packages/fallbacks/src/microfrontend-error.ts — FOUND
- packages/fallbacks/src/fallbacks-module.ts — FOUND
- packages/fallbacks/src/index.ts — FOUND
- packages/fallbacks/README.md — FOUND

**Commits (3 atomic):**
- `6659fab` (T01 scaffolding) — FOUND
- `6ed40b0` (T02 types + topics + augment + service-locator) — FOUND
- `0e33f97` (T03 class + factory stub + barrel + README) — FOUND

## Next

W2 P02 (14-02) + W2 P03 (14-03) + W2 P04 (14-04) parallelizzabili (file ownership disgiunta):
- W2 P02 → `installErrorSubscribe` + MicroFrontendError throw points + retry storm safety
- W2 P03 → `RetryEngine` (backoff + ±20% jitter) + `CircuitBreaker` FSM 3-state
- W2 P04 → `FallbackOrchestrator` + 4 renderer (html/component/event/custom) + `fallbacksModule.install` wire reale + SERVICE_FALLBACKS register

W3 P05 (14-05) sequenziale post-W2 — bundle gate verifier reale + check-d83-f14.mjs + Tier-3 Playwright Chromium scenari + README closure 13 sezioni + JSDoc enrichment.
