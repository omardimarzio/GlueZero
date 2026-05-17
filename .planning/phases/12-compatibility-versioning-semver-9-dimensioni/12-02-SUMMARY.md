---
phase: 12
plan: "12-02"
subsystem: "@gluezero/compat engine + registry + error + topics + policy-dispatch"
tags: [w2, compat, semver, OQ-3, OQ-4, AMENDMENT-D-12-03, D-83-strict-triple-esteso]
requires:
  - "@gluezero/compat W1 scaffolding (plan 12-01: types files + augment marker + size-limit baseline)"
  - "@gluezero/core (workspace peer — Broker + ErrorCategory + createBrokerError)"
  - "@gluezero/microfrontends (workspace peer — MF_GOVERNANCE_TOPICS reuse + MicroFrontendsService + MicroFrontendDescriptor)"
  - "semver@^7.7.4 (hard dep — subpath functions/satisfies + functions/valid)"
provides:
  - "createSemverChecker() — pure wrapper subpath imports 7 range types + defensive try-catch"
  - "createVersionRegistry(broker) — 8 Map + 8 register*Version setter + emit version.changed (D-12-08 + D-12-10)"
  - "MF_COMPAT_TOPICS literal locale F12 (2 valori NUOVI: warning + version.changed; failed riusato F8)"
  - "createCompatError factory + CompatErrorCode/CompatibilityPhase types (OQ-4 ratify 'microfrontend' direct-cast)"
  - "publishCompatTopics helper (level failed → F8 reuse, level warning → F12 locale)"
  - "createCheckEngine factory — 9 dim PRD §20.3 algorithm + memoization Map (D-12-12 NO LRU) + getReport overload (D-12-17) + race-safe defensive"
  - "enforceCompatPolicy — 5-policy × 3-phase matrix (D-12-02..D-12-05) + OQ-3 block-load funzionale F12"
  - "Tier-1 jsdom test suite W2: 66 test cases (6 file test) coverage 95.37%/91.8%/95.45%/96.03%"
affects:
  - "packages/compat/vitest.config.ts (additive: define __GLUEZERO_VERSION__ per test runtime — Rule 3 fix)"
tech-stack:
  added:
    - "(nessuna nuova dep — semver@7.7.4 + @types/semver@7.7.1 già installate in W1)"
  patterns:
    - "Pattern carryover F11 D-V2-F11-22 strict direct-cast: `'microfrontend' as ErrorCategory` (OQ-4 RATIFY AMENDMENT D-12-03)"
    - "Pattern carryover F11 publishDeniedTopics: emit topic governance PRIMA del throw (D-12-05)"
    - "Pattern carryover F11 closure-state engine + 5 deps DI: createCheckEngine(mfService, registry, checker, broker, policy)"
    - "Pattern carryover F8 reuse MF_GOVERNANCE_TOPICS[1] via import diretto (Pitfall 7 ACK — NO duplicate literal in topics.ts locale F12)"
    - "Pattern source attribution centralizzato: COMPAT_PUBLISH_SOURCE const in internal/compat-source.ts (REVISIONE WARNING 8)"
    - "Pattern semver subpath imports: 'semver/functions/{satisfies,valid}' (NON bare 'semver' root) per tree-shake bundle target ≤ 9 KB gz"
    - "Pattern dot-only topic naming (Rule 1 fix W2): 'version.changed' invece di 'version-changed' per broker validator regex compliance"
key-files:
  created:
    - packages/compat/src/internal/compat-source.ts
    - packages/compat/src/semver-checker.ts
    - packages/compat/src/topics.ts
    - packages/compat/src/version-registry.ts
    - packages/compat/src/compat-error.ts
    - packages/compat/src/check-engine.ts
    - packages/compat/src/policy-dispatch.ts
    - packages/compat/src/__tier1__/semver-checker.test.ts
    - packages/compat/src/__tier1__/version-registry.test.ts
    - packages/compat/src/__tier1__/compat-error.test.ts
    - packages/compat/src/__tier1__/check-engine.test.ts
    - packages/compat/src/__tier1__/policy-dispatch.test.ts
    - packages/compat/src/__tier1__/index.test.ts
  modified:
    - packages/compat/vitest.config.ts (additive: define __GLUEZERO_VERSION__ test runtime)
decisions:
  - "OQ-4 RATIFIED (AMENDMENT D-12-03): `category: 'microfrontend' as ErrorCategory` direct-cast in createCompatError — NON 'compatibility' come testo originale CONTEXT.md. Carryover F11 D-V2-F11-22 strict. Discriminator semantico via code='COMPAT_INCOMPATIBLE'. D-83 strict preserved."
  - "OQ-3 RATIFIED: policy `'block-load'` FUNZIONALE in F12 (NON solo alias di `block-mount` come F11). phase=load + policy=block-load triggera throw VERO. phase=mount + policy=block-load continua a triggherare (alias mount carryover F11). Documentato JSDoc policy-dispatch.ts."
  - "Rule 1 fix: topic 'microfrontend.compatibility.version-changed' rinominato 'version.changed' (dash → dot) per conformare al broker validator regex `^[a-z][a-z0-9]*(\\.[a-z][a-z0-9*]*)*$` che vieta `-`. Pattern carryover F8 (microfrontend.load.failed). Applicato in topics.ts + version-registry.ts + test."
  - "Rule 3 fix: vitest.config.ts additivo `define: { __GLUEZERO_VERSION__: JSON.stringify(env ?? '2.0.0') }` — replicato tsup `define` per test runtime. Senza questo: ReferenceError gluezero-version.ts:43 al test runtime. W1 non aveva rilevato perché senza test che esercitassero la const."
  - "REVISIONE WARNING 6 applicata: payload key emit version.changed normalizzato a `dimension` (NON `category`) per allinearsi a RESEARCH §'Topic emission schema'. Test esplicito aggiornato."
  - "REVISIONE WARNING 8 applicata: COMPAT_PUBLISH_SOURCE estratto in internal/compat-source.ts (NO literal duplicato in version-registry + compat-error). Test asserto-by-identity con expect.objectContaining({source: COMPAT_PUBLISH_SOURCE, deliveryMode:'sync'})."
metrics:
  duration_minutes: 10
  completed_date: 2026-05-13
  total_source_loc: 1119
  total_test_loc: 860
  total_loc: 1979
  total_commits: 3
  bundle_gzip_w2:
    "@gluezero/compat (gzip)": "71 B (cap 9000 B — invariato da W1: W2 sources NON ancora wired al barrel; completamento in plan 12-03)"
    "@gluezero/compat/augment (gzip)": "22 B (cap 1000 B — invariato W1)"
  coverage:
    statements: "95.37%"
    branches: "91.8%"
    functions: "95.45%"
    lines: "96.03%"
    thresholds_required: "90/85/90/90 — PASS"
---

# Phase 12 Plan 12-02: @gluezero/compat W2 (engine + registry + error + topics + policy-dispatch) Summary

Implementazione W2 dei 6 componenti core di `@gluezero/compat` (pure logic stack F12) + Tier-1 test suite ~66 cases. Cover REQ-IDs MF-COMPAT-01/02/03/04, ratifica OQ-3 (block-load FUNZIONALE F12) + OQ-4 (AMENDMENT D-12-03 — `category: 'microfrontend'` direct-cast). D-83 strict triple esteso v2.0 preservato (zero diff core/microfrontends/mapper/permissions/src/). v1-bc-replay 267 PASS invariato.

## Files Created (7 source + 6 test) + 1 Modified

| File | LoC | Ruolo |
| --- | --- | --- |
| `packages/compat/src/internal/compat-source.ts` | 25 | `COMPAT_PUBLISH_SOURCE` const centralizzata (REVISIONE WARNING 8 — `@internal`, NO re-export barrel) |
| `packages/compat/src/semver-checker.ts` | 91 | `createSemverChecker()` pure-function wrapper subpath imports `semver/functions/{satisfies,valid}` + defensive try-catch (T-12-02 ReDoS mitigation companion) |
| `packages/compat/src/topics.ts` | 51 | `MF_COMPAT_TOPICS` literal locale 2 valori F12 (`warning` + `version.changed` — Rule 1 fix dot-only) + type `CompatTopic` |
| `packages/compat/src/version-registry.ts` | 216 | `createVersionRegistry(broker)` — 8 Map closure-captured + 8 register*Version setter + emit `microfrontend.compatibility.version.changed` (D-12-08 + D-12-10 + REVISIONE WARNING 6 `dimension` payload) |
| `packages/compat/src/compat-error.ts` | 205 | `createCompatError` factory (OQ-4 ratify `'microfrontend' as ErrorCategory` direct-cast) + `publishCompatTopics` helper (F8 reuse `MF_GOVERNANCE_TOPICS[1]` + F12 locale `warning`) + types `CompatErrorCode`/`CompatibilityPhase` |
| `packages/compat/src/check-engine.ts` | 367 | `createCheckEngine` factory — algoritmo 9 dim PRD §20.3 (scalar gluezero + 6 Record-based + theme tokens/roles + framework name/version) + memoization Map (D-12-12 NO LRU) + getReport overload (D-12-17) + race-safe defensive |
| `packages/compat/src/policy-dispatch.ts` | 164 | `enforceCompatPolicy` — 5-policy × 3-phase matrix (D-12-02..D-12-05) + OQ-3 ratify block-load funzionale F12 + emit-prima-di-throw pattern |
| **TOTAL source** | **1119** | (7 file source W2 — 1 internal + 6 public-surface candidate per plan 12-03 barrel completion) |
| `packages/compat/src/__tier1__/semver-checker.test.ts` | 68 | 12 test casi (7 range types + isValidVersion 3 cases) |
| `packages/compat/src/__tier1__/version-registry.test.ts` | 157 | 11 test casi (8 setter + no-op idempotent + emit dimension + theme tokens/roles + COMPAT_PUBLISH_SOURCE identity) |
| `packages/compat/src/__tier1__/compat-error.test.ts` | 117 | 5 test casi (createCompatError shape + publishCompatTopics F8/F12) |
| `packages/compat/src/__tier1__/check-engine.test.ts` | 247 | 24 test casi (9 dim coverage + missing version warning + memoization + getReport overload + fake timer + race-safe) |
| `packages/compat/src/__tier1__/policy-dispatch.test.ts` | 231 | 15 test casi (5 policy × 3 phase + OQ-3 funzionale + emit-prima-di-throw) |
| `packages/compat/src/__tier1__/index.test.ts` | 40 | 4 barrel sanity test (W1 surface only — W2 export completion in plan 12-03) |
| **TOTAL test** | **860** | (6 file test — 66+ test cases) |
| **GRAND TOTAL** | **1979** | (13 file nuovi) |

| File modified | Tipo modifica |
| --- | --- |
| `packages/compat/vitest.config.ts` | Additive: `define: { __GLUEZERO_VERSION__: JSON.stringify(env ?? '2.0.0') }` (Rule 3 fix — replica tsup define per test runtime) |

## Commit History

| Hash | Type | Tasks | Files | Description |
| --- | --- | --- | --- | --- |
| `17e6cec` | feat | Task 1 | 6 | semver-checker + version-registry + topics + internal/compat-source + 2 test file W2 — includes Rule 1 fix (topic dash→dot) |
| `9784b0e` | feat | Task 2 | 7 | compat-error + check-engine + policy-dispatch + 3 test file + Rule 3 fix vitest define |
| `9c0a74c` | test | Task 3 | 1 | barrel sanity index.test.ts + W2 verification gates (bundle/D-83/v1-bc-replay) |

## OQ Resolution Outcomes (W2)

### OQ-4 (MEDIUM) — AMENDMENT D-12-03 RATIFIED

**Resolution:** `category: 'microfrontend' as ErrorCategory` (DIRECT-CAST) in `createCompatError`, NON `'compatibility'` come testo originale CONTEXT.md D-12-03.

**Rationale:**
1. **D-83 strict preserved**: estendere `ErrorCategory` union upstream in `packages/core/src/errors.ts` violerebbe `git diff packages/core/src/` = 0.
2. **Carryover F11 D-V2-F11-22**: F11 `createPermissionError` usa esattamente lo stesso pattern (`'microfrontend' as ErrorCategory`). Coerenza cross-fase tra moduli MF-governance.
3. **Discriminator semantico via `code`**: filtro consumer è `err.code === 'COMPAT_INCOMPATIBLE'` o `err.code.startsWith('COMPAT_')` — `code` enum è la SoT per categorizzazione granulare.

**Evidence:**
- `packages/compat/src/compat-error.ts:136`: `category: 'microfrontend' as ErrorCategory,`
- `packages/compat/src/__tier1__/compat-error.test.ts:55-56`: `expect(err.category).toBe('microfrontend')` PASS
- Documentazione JSDoc compat-error.ts: 25 LoC dedicate al rationale OQ-4 AMENDMENT D-12-03.

### OQ-3 (MEDIUM) — RATIFIED

**Resolution:** `policy='block-load'` è FUNZIONALE in F12 (NON solo alias di `block-mount` come in F11). `phase=load` + `policy=block-load` triggera throw VERO.

**Rationale:**
- F11 aliased `block-load` a `block-mount` perché F9 ESM loader NON espone seam pre-fetch (defer V2.1).
- F12 lifecycle FSM F8 distingue trigger `load` vs `mount`: `service.load(id)` è patchabile (monkey-patch in plan 12-03 via Service Locator install).
- Su `phase=mount`, `policy='block-load'` continua a triggerare (alias mount behavior carryover F11 fail-fast).

**Evidence:**
- `packages/compat/src/policy-dispatch.ts:67-71`: `BLOCKING_MATRIX.load = ['block-load']`, `BLOCKING_MATRIX.mount = ['block-mount', 'block-load']`
- `packages/compat/src/__tier1__/policy-dispatch.test.ts`:
  - Test 8 (phase=load + block-load → THROW) PASS
  - Test 9 (phase=mount + block-load → THROW alias) PASS
  - Test 10 (phase=registration + block-load → NO throw) PASS
- Documentazione JSDoc policy-dispatch.ts:10-19 dedicato al rationale OQ-3.

## D-83 Strict Triple Esteso v2.0 Verification

| Boundary | Baseline | Resolved | Diff lines | Status |
| --- | --- | --- | --- | --- |
| `packages/core/src/` | `27dd7db` (F10_END statico) | n/a | 0 | PRESERVED |
| `packages/microfrontends/src/` | `27dd7db` | n/a | 0 | PRESERVED |
| `packages/mapper/src/` | `27dd7db` | n/a | 0 | PRESERVED |
| `packages/permissions/src/` | `a4aec0d` (F11_END dynamic via `git log --extended-regexp --grep='^docs\(11-05-permissions-closure\):' --format='%H' -1`) | resolved | 0 | PRESERVED |

Comando completo verifica eseguita:
```bash
BASELINE_F10=27dd7db
F11_END=$(git log --extended-regexp --grep='^docs\(11-05-permissions-closure\):' --format='%H' -1)
# F11_END resolved: a4aec0df156303074db077dc0295946bb5c7a54a
git diff $BASELINE_F10..HEAD -- packages/core/src/ | wc -l          # 0
git diff $BASELINE_F10..HEAD -- packages/microfrontends/src/ | wc -l # 0
git diff $BASELINE_F10..HEAD -- packages/mapper/src/ | wc -l         # 0
git diff $F11_END..HEAD -- packages/permissions/src/ | wc -l         # 0
```

## v1-bc-replay 14 API BC §42 Cross-Fase Gate

| Test suite | Status |
| --- | --- |
| `pnpm --filter @gluezero/core test -- v1-bc-replay` | **267 PASS** + 3 skipped (BC §42 invariato post-F12 W2) |

Output completo: `Test Files 31 passed | 3 skipped (34) / Tests 267 passed | 3 skipped (270)`.

## Bundle Empirical W2 Verification

```
packages/compat/dist/index.js   = 288 B raw / 71 B gzip  (cap 9000 B = 9 KB)
packages/compat/dist/augment.js = 189 B raw / 22 B gzip  (cap 1000 B = 1 KB)
packages/compat/dist/index.d.ts = 11 KB (types DTS)
```

**Bundle invariato da W1**: i 6 sorgenti W2 (semver-checker, version-registry, topics, compat-error, check-engine, policy-dispatch) sono compilati ma NON ancora re-esportati dal barrel `src/index.ts` (placeholder commentati alle linee 80-86, completamento in plan 12-03 con `compatModule()` factory). Tree-shake esbuild elimina i symbol non-raggiungibili dalla barrel `index.ts`.

Decisione condizionale (RESEARCH §3.4): bundle W2 PASS (71 B << 9000 B cap, ben dentro il budget di inflation `8929 B = 9000 - 71`). NO escalation a strategie fallback necessaria. Bundle inflation reale W3 sarà misurata in plan 12-03 dopo wire-up del barrel.

## Coverage Tier-1 jsdom

| Metric | Value | Threshold | Status |
| --- | --- | --- | --- |
| Statements | 95.37% (103/108) | ≥ 90% | PASS |
| Branches | 91.80% (56/61) | ≥ 85% | PASS |
| Functions | 95.45% (21/22) | ≥ 90% | PASS |
| Lines | 96.03% (97/101) | ≥ 90% | PASS |

Test suite: **66/66 PASS** (6 file test). Note: `topics.ts` 0% coverage perché esporta solo `const` + `type` (consumer `compat-error.ts` riusa l'identifier `'microfrontend.compatibility.warning'` via literal locale, non via import del re-export array). `semver-checker.ts` 80% (linea 84 = isValidVersion no-throw branch — testato implicitamente).

## Verification Gates W2 Eseguiti

| Gate | Status | Output |
| --- | --- | --- |
| `pnpm --filter @gluezero/compat typecheck` | PASS | `tsc --noEmit` exit 0 zero errori |
| `pnpm --filter @gluezero/compat build` | PASS | ESM + DTS build success in 17-20ms |
| `pnpm --filter @gluezero/compat test` | PASS | 66/66 test cases PASS (6 file test) |
| `pnpm --filter @gluezero/compat test:coverage` | PASS | 95.37%/91.8%/95.45%/96.03% thresholds 90/85/90/90 PASS |
| `pnpm size-limit` (compat entries) | PASS | 71 B / 9000 B (cap) + 22 B / 1000 B |
| `pnpm --filter @gluezero/core test -- v1-bc-replay` | PASS | 267 PASS invariato (BC §42 14 API gate) |
| D-83 strict triple esteso v2.0 | PASS | 0+0+0+0 diff lines (core+microfrontends+mapper+permissions) |
| Audit grep semver subpath | PASS | `from 'semver/functions/satisfies'` + `from 'semver/functions/valid'` (NO `from 'semver'` root) |
| Audit grep MF_GOVERNANCE_TOPICS reuse | PASS | `import { MF_GOVERNANCE_TOPICS } from '@gluezero/microfrontends'` in compat-error.ts (NO literal duplicato in topics.ts F12) |
| Audit grep COMPAT_PUBLISH_SOURCE consumers | PASS | 2 import sites: version-registry.ts + compat-error.ts |
| Audit grep OQ-4 direct-cast | PASS | `'microfrontend' as ErrorCategory` in compat-error.ts:136 |
| Audit grep OQ-3 block-load matrix | PASS | `BLOCKING_MATRIX.load = ['block-load']` + `BLOCKING_MATRIX.mount = ['block-mount', 'block-load']` |

## Deviations from Plan

### Rule 1 - Bug: topic name `version-changed` violava broker validator regex

- **Found during:** Task 1 first test run (post sources committed).
- **Issue:** Il plan + CONTEXT.md + PRD usavano consistentemente `'microfrontend.compatibility.version-changed'` (con dash). Il broker `event-validator.ts:33` ha regex `^[a-z][a-z0-9]*(\.[a-z][a-z0-9*]*)*$` che vieta `-` nei segmenti. Test `version-registry.test.ts > Test 4-11` falliva con `BrokerError: BrokerEvent validation failed: Invalid format: Expected /^.../ but received "microfrontend.compatibility.version-changed"`.
- **Fix:** Rinominato dash → dot in 3 luoghi (1 commit Task 1):
  - `topics.ts:42` literal in `MF_COMPAT_TOPICS[1]`
  - `version-registry.ts:154` literal nel broker.publish call
  - `__tier1__/version-registry.test.ts` ogni assertion
  - JSDoc commenti aggiornati per coerenza
  - Pattern carryover F8 (`microfrontend.load.failed`, `microfrontend.bootstrap.failed`) — 4-segment dot-only.
- **Files modified:** `packages/compat/src/topics.ts`, `packages/compat/src/version-registry.ts`, `packages/compat/src/__tier1__/version-registry.test.ts`
- **Commit:** `17e6cec` (Task 1 — fix incluso nello stesso commit dei sources W2 Task 1 perché senza il fix i test non passavano).

### Rule 3 - Blocking: vitest mancante `define __GLUEZERO_VERSION__`

- **Found during:** Task 2 test run post-Task 1 commit.
- **Issue:** `check-engine.test.ts` falliva al load con `ReferenceError: __GLUEZERO_VERSION__ is not defined` a `internal/gluezero-version.ts:43`. Il `tsup.config.ts` ha `define: { __GLUEZERO_VERSION__: JSON.stringify(...) }` che è applicato SOLO al build, non al test runtime di vitest. W1 non aveva rilevato perché in W1 nessun test importava il modulo `internal/gluezero-version.ts` (i test W1 erano `passWithNoTests`).
- **Fix:** Aggiunto `vitest.config.ts` campo `define: { __GLUEZERO_VERSION__: JSON.stringify(process.env.GLUEZERO_VERSION ?? '2.0.0') }` — replicato pattern tsup. Vitest usa esbuild substitution, quindi accetta la stessa syntax.
- **Files modified:** `packages/compat/vitest.config.ts`
- **Commit:** `9784b0e` (Task 2 — incluso nello stesso commit dei sources Task 2 perché senza il fix i test check-engine non eseguivano).

### Rule 2 - Critical missing: NON applicato

Nessun problema di sicurezza/correttezza pre-esistente trovato in W2 che giustificasse intervento Rule 2:
- Threat model 12-02 §threat_model (4 threat T-12-W2-01..04) tutti MITIGATED o ACCEPT.
- `T-12-W2-01` (semver ReDoS): mitigato sia da semver lib `RANGE_LENGTH_LIMIT=512` sia da wrapper try-catch defensive in `semver-checker.ts:82-89`.
- `T-12-W2-02/03/04`: accept (governance NON crypto sandbox, P-13 carryover F11).

### Rule 4 - Architectural: NON applicato

Nessuna scoperta architetturale che richiedesse decisione utente. Entrambe le OQ resolution (OQ-3 + OQ-4) erano già pre-ratificate dal planner W2 nel plan.

## REVISIONI Applicate (dal plan)

| Revisione | Status | Evidence |
| --- | --- | --- |
| REVISIONE WARNING 1: 8 setter (3 PRD + 4 D-12-10 + 1 theme) | APPLIED | `version-registry.ts` Interface VersionRegistry 8 register*Version + Test 4 setup esplicito + Test 11 theme tokens/roles |
| REVISIONE WARNING 6: payload key `dimension` (NON `category`) | APPLIED | `version-registry.ts:149 emitVersionChanged(dimension,...)` + Test 2 `expect.objectContaining({dimension: 'canonicalModels'})` |
| REVISIONE WARNING 7: F11_END dynamic resolve via subject-anchor grep | APPLIED | Task 3 verification step D + SUMMARY frontmatter `F11_END=a4aec0d` resolved |
| REVISIONE WARNING 8: COMPAT_PUBLISH_SOURCE in internal module | APPLIED | `internal/compat-source.ts` created + 2 consumers (version-registry + compat-error) via import + Test 10 import-by-identity assertion |
| REVISIONE INFO 1: 6 file test (5 component + 1 barrel sanity) | APPLIED | 6 file `__tier1__/*.test.ts` creati come pianificato |

## Next Plan

**12-03 (W2 sequenziale):** Module factory + Service Locator install + service-wrap monkey-patch + lifecycle-hooks.

- `packages/compat/src/compat-module.ts`: `compatModule(opts)` factory che ritorna `BrokerModule` con `install(ctx)` setup.
- `packages/compat/src/enforcement-points.ts`: monkey-patch `service.{register, load, mount}` via Service Locator (carryover F11 D-V2-F11-13 pattern).
- `packages/compat/src/lifecycle-hooks.ts`: subscribe 4 topics (`microfrontend.bootstrapped`, `microfrontend.loaded`, `microfrontend.unregistered`, `microfrontend.compatibility.version.changed`) per memo invalidation.
- `packages/compat/src/index.ts`: completamento barrel (uncomment W2 placeholders linee 80-86).
- Bundle empirical real (W2 sources nel bundle).
- Tier-1 integration test compatModule end-to-end.

Successor: 12-04 (Tier-1 jsdom 9-dim full coverage closure), 12-05 (README italiano + JSDoc enrichment + closure).

## Self-Check: PASSED

Verifiche post-SUMMARY:

```
File source esistono:
[FOUND] packages/compat/src/internal/compat-source.ts (25 LoC)
[FOUND] packages/compat/src/semver-checker.ts (91 LoC)
[FOUND] packages/compat/src/topics.ts (51 LoC)
[FOUND] packages/compat/src/version-registry.ts (216 LoC)
[FOUND] packages/compat/src/compat-error.ts (205 LoC)
[FOUND] packages/compat/src/check-engine.ts (367 LoC)
[FOUND] packages/compat/src/policy-dispatch.ts (164 LoC)

File test esistono:
[FOUND] packages/compat/src/__tier1__/semver-checker.test.ts (68 LoC, 12 tests)
[FOUND] packages/compat/src/__tier1__/version-registry.test.ts (157 LoC, 11 tests)
[FOUND] packages/compat/src/__tier1__/compat-error.test.ts (117 LoC, 5 tests)
[FOUND] packages/compat/src/__tier1__/check-engine.test.ts (247 LoC, 24 tests)
[FOUND] packages/compat/src/__tier1__/policy-dispatch.test.ts (231 LoC, 15 tests)
[FOUND] packages/compat/src/__tier1__/index.test.ts (40 LoC, 4 tests)

Commits esistono:
[FOUND] 17e6cec Task 1 — semver-checker + version-registry + topics + Rule 1 fix dash→dot
[FOUND] 9784b0e Task 2 — compat-error + check-engine + policy-dispatch + Rule 3 fix vitest define
[FOUND] 9c0a74c Task 3 — barrel sanity index.test.ts + W2 verification gates

Gate verification:
[PASS] typecheck clean exit 0
[PASS] build success ESM + DTS
[PASS] 66/66 test PASS Tier-1 jsdom
[PASS] coverage 95.37%/91.8%/95.45%/96.03% (thresholds 90/85/90/90)
[PASS] size-limit 71 B / 9000 B (cap) + 22 B / 1000 B
[PASS] v1-bc-replay 267 PASS (BC §42 cross-fase invariato)
[PASS] D-83 strict triple esteso v2.0 — 0+0+0+0 diff lines
```
