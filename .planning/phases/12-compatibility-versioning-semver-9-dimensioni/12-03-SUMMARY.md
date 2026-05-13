---
phase: 12
plan: "12-03"
subsystem: "@gluezero/compat W3 — factory compatModule + Service Locator install + service-wrap monkey-patch + lifecycle-hooks runtime wiring"
tags: [w3, compat, broker-module, OQ-1, OQ-2, service-locator, lifecycle-hooks, D-83-strict-triple-esteso]
requires:
  - "@gluezero/compat W2 (plan 12-02): semver-checker + version-registry + check-engine + compat-error + topics + policy-dispatch"
  - "@gluezero/core (workspace peer — Broker + BrokerModule + SERVICE_COMPAT/SERVICE_MICROFRONTENDS + createBroker)"
  - "@gluezero/microfrontends (workspace peer — MicroFrontendsService.{register,load,mount} + MicroFrontendDescriptor + microfrontendModule factory)"
provides:
  - "compatModule({compatibilityPolicy?}) BrokerModule factory — D-12-11 minimal single-option + anti-singleton D-30"
  - "Service Locator install: lookup SERVICE_MICROFRONTENDS → create stack W2 → registerService SERVICE_COMPAT → wrap + wire (D-12-13 carryover F11)"
  - "wrapServiceWithCompat(mfService, engine, broker, policy) — OQ-1 service-wrap monkey-patch register/load/mount + idempotent marker __compatServicePatched"
  - "wireLifecycleHooks(broker, mfService, engine, registry, policy) — OQ-2 dual subscribe bootstrapped+loaded + version.changed invalidate + unregistered cleanup"
  - "CompatService interface 10 API + read-only compatibilityPolicy getter (5 PRD §20.4 + 4 D-12-10 + 1 theme peer-conditional)"
  - "Barrel index.ts completo W3 — compatModule factory + types + engine + registry + error + topics; internal helpers NOT exported"
  - "Tier-1 jsdom test suite W3: 42 nuovi test cases (compat-module 17 + enforcement-points 11 + lifecycle-hooks 12 + index update 6) coverage 96.96%/88.63%/97.05%/98.01%"
affects:
  - "packages/compat/src/__tier1__/index.test.ts (aggiornato W3 — barrel sanity suite estesa: NO Engine/Registry → SI Engine/Registry)"
tech-stack:
  added:
    - "(nessuna nuova dep — solo wiring W2 in BrokerModule)"
  patterns:
    - "Pattern carryover F11 D-V2-F11-13 Service Locator install: lookup SERVICE_MICROFRONTENDS + non-null capture closure + create stack + registerService"
    - "Pattern carryover F11 D-V2-F11-22 strict service-wrap monkey-patch idempotent marker (audit-grep clean + tampering-resistant Object.defineProperty config=false)"
    - "Pattern carryover F11 OQ-2 dual subscribe: bootstrapped+loaded coppia (defensive fallback auto-bootstrap D-V2-07 inline scenario)"
    - "Pattern carryover F11 D-V2-16 cleanup cascade subscribe microfrontend.unregistered → engine.deleteReport"
    - "Pattern anti-singleton D-30 (carryover F1): factory ritorna NUOVO BrokerModule per ogni call (multi-broker support)"
    - "Pattern async value wrapper (#issue F12 new vs F11 sync wrap): wrap async-method service-wrap usa async keyword → throw sync diventa Promise rejection coerente con D-12-03"
    - "Pattern dual marker disjoint coesistenza: __compatServicePatched (F12) + __permissionsServicePatched (F11) coesistono naturalmente — chain ordering via install order"
key-files:
  created:
    - packages/compat/src/enforcement-points.ts
    - packages/compat/src/lifecycle-hooks.ts
    - packages/compat/src/compat-module.ts
    - packages/compat/src/__tier1__/enforcement-points.test.ts
    - packages/compat/src/__tier1__/lifecycle-hooks.test.ts
    - packages/compat/src/__tier1__/compat-module.test.ts
  modified:
    - packages/compat/src/index.ts (barrel update W3 — uncomment placeholder W2 + add compatModule + types)
    - packages/compat/src/__tier1__/index.test.ts (W3 update — barrel sanity suite estesa, NO/SI Engine + Registry export + compatModule check)
decisions:
  - "OQ-1 RESOLUTION (HIGH): service-wrap monkey-patch su register/load/mount con marker idempotente __compatServicePatched — carryover F11 D-V2-F11-XX strict + scope esteso 3 metodi F12 vs 4 F11. F8 NON espone hook API pre-register/pre-load/pre-mount → service-wrap è l'unico path."
  - "OQ-2 RESOLUTION (HIGH): ordering F11+F12 documentato in JSDoc enforcement-points.ts e compat-module.ts. F12 wrap ESTERNO via install order array — su `mfService.mount(id)` esegue F12 compat check PRIMA di F11 permission check (incompatibilità categorica precede permission denial). Cross-fase test SC5 in plan 12-05 verifica empiricamente."
  - "Wrapper async keyword (deviazione F12 vs F11 pattern): i 3 metodi service-wrappati `register/load/mount` ritornano Promise → wrap usa `async value(...)` per propagare throw sync di enforceCompatPolicy come Promise rejection coerente con D-12-03. F11 wrap (bootstrap/mount/unmount/destroy) usava wrap sync poiché la sua logica era markeronly senza throw concreto."
  - "Barrel hygiene W3 strict (carryover F11): internal helpers (wrapServiceWithCompat, wireLifecycleHooks, enforceCompatPolicy, createSemverChecker) NON re-esportati dal barrel — test audit-grep verifica Object.keys(compatBarrel) assenza."
  - "Test 12 deviation: pianificato uso di module intermedio `spy-hook` per spy subscribe broker — fallito perché topic literal `spy-hook.installed` viola broker validator regex (dash forbidden). Riscritto come verifica behavior: emit version.changed via register*Version → memo invalidata → getCompatibilityReport().size === 0."
  - "registerThemeVersion peer-conditional (REVISIONE WARNING 1): setter sempre callable senza throw, indipendentemente da presenza @gluezero/theme peer. version-registry.ts già implementato W2 con Map dedicata 'theme' usando discriminator kind: 'tokens'|'roles'. compat-module.ts wira direttamente versionRegistry.registerThemeVersion al service field."
metrics:
  duration_minutes: 11
  completed_date: 2026-05-13
  total_source_loc_new: 602
  total_test_loc_new: 685
  total_source_loc_modified: 114
  total_test_loc_modified: 49
  total_loc: 1450
  total_commits: 3
  bundle_gzip_w3:
    "@gluezero/compat (gzip)": "7.9 KB (cap 9 KB — headroom 1.1 KB)"
    "@gluezero/compat/augment (gzip)": "22 B (cap 1 KB)"
  coverage:
    statements: "96.96%"
    branches: "88.63%"
    functions: "97.05%"
    lines: "98.01%"
    thresholds_required: "90/85/90/90 — PASS"
  test_count:
    w1: 4
    w2: 66
    w3_new: 38
    total: 108
---

# Phase 12 Plan 12-03: @gluezero/compat W3 (factory + Service Locator install + service-wrap + lifecycle-hooks) Summary

Implementazione W3 del wiring runtime di `@gluezero/compat`: factory `compatModule({compatibilityPolicy?})` BrokerModule con install pattern Service Locator F8 (D-12-13 carryover F11), service-wrap monkey-patch su `register/load/mount` con marker idempotente `__compatServicePatched` (OQ-1), e lifecycle hooks subscribe 4 topic (OQ-2 dual subscribe + cache invalidation + cleanup cascade). Connette la pure logic stack W2 (engine + registry + checker + dispatch) al broker via BrokerModule interface F8 → modulo `compatModule` invocabile da host app via `createBroker({modules:[microfrontendModule(), compatModule({compatibilityPolicy:'block-mount'})]})`.

Cover REQ-IDs MF-COMPAT-01 (lifecycle integration) + MF-COMPAT-02 (10 metodi service installed) + MF-COMPAT-04 (5 policy dispatch wired into 3 lifecycle trigger points). OQ-1 resolved (service-wrap pattern carryover F11 con scope esteso 3 metodi F12 vs 4 F11). OQ-2 resolved (ordering F11+F12 documentato — F12 wrap ESTERNO via install order). D-83 strict triple esteso v2.0 preservato (zero diff core/microfrontends/mapper/permissions/src/). v1-bc-replay 267 PASS invariato.

## Files Created (3 source NEW + 3 test NEW) + 2 Modified

| File | LoC | Ruolo |
| --- | --- | --- |
| `packages/compat/src/enforcement-points.ts` | 193 | `wrapServiceWithCompat(mfService, engine, broker, installPolicy)` — OQ-1 monkey-patch register/load/mount + marker idempotent + scope esteso F12 vs F11 |
| `packages/compat/src/lifecycle-hooks.ts` | 167 | `wireLifecycleHooks(broker, mfService, engine, registry, installPolicy)` — OQ-2 dual subscribe (bootstrapped+loaded) + version.changed invalidate + unregistered cleanup D-V2-16 |
| `packages/compat/src/compat-module.ts` | 242 | `compatModule({compatibilityPolicy?})` BrokerModule factory + CompatService interface 10 API + read-only policy getter (REVISIONE WARNING 1 — 5 PRD + 4 D-12-10 + 1 theme peer-conditional) |
| **TOTAL source NEW** | **602** | (3 file source W3) |
| `packages/compat/src/__tier1__/enforcement-points.test.ts` | 241 | 11 test cases (marker idempotent + register/load/mount throw + warn no-throw + audit-grep separation F11+F12) |
| `packages/compat/src/__tier1__/lifecycle-hooks.test.ts` | 212 | 12 test cases (4 subscribe register + emit runCheck + invalidate + cleanup + 4 defensive) |
| `packages/compat/src/__tier1__/compat-module.test.ts` | 232 | 17 test cases (BrokerModule shape + 10 API + Service Locator + OQ-1 marker + OQ-2 subscribe + barrel re-export) |
| **TOTAL test NEW** | **685** | (3 file test W3) |
| `packages/compat/src/index.ts` (MODIFIED) | 114 | Barrel completo W3: uncomment placeholder W2 (topics + error + engine + registry) + add W3 compatModule + types pubblici (CompatModuleOptions, CompatService). Internal helpers NON re-esposti. |
| `packages/compat/src/__tier1__/index.test.ts` (MODIFIED) | 49 | Test 4 invertito W3: NO Engine/Registry/createCompatError → SI Engine/Registry/createCompatError + 2 nuovi test (W2 surface + W3 compatModule) |
| **GRAND TOTAL** | **1450** | (6 file nuovi + 2 file aggiornati) |

## Commit History

| Hash | Type | Tasks | Files | Description |
| --- | --- | --- | --- | --- |
| `9e2d621` | feat | Task 1 | 2 | enforcement-points service-wrap monkey-patch register/load/mount + idempotent marker (OQ-1 carryover F11) — 11 test cases |
| `44ee89b` | feat | Task 2 | 2 | lifecycle-hooks 4 topic subscribe (OQ-2 dual bootstrapped/loaded + invalidate + cleanup) — 12 test cases |
| `29a57fb` | feat | Task 3 | 4 | compatModule factory + Service Locator install + 10 API + barrel completion W3 — 17 test cases compat-module + 6 test cases index.test update |

## OQ Resolution Outcomes (W3)

### OQ-1 (HIGH) — RESOLVED service-wrap monkey-patch carryover F11

**Resolution:** `wrapServiceWithCompat` applica `Object.defineProperty` con marker `__compatServicePatched` (non-enumerable + non-writable + non-configurable) + monkey-patch 3 metodi `register/load/mount` con `async value(...)` wrapper che invoca `enforceCompatPolicy` PRIMA di `originalFn(...args)`.

**Rationale:**
1. **F8 NON espone hook API pre-register/pre-load/pre-mount**: verified `packages/microfrontends/src/registry.ts:83-104` interface `MicroFrontendsService` — i 3 metodi tornano `Promise<void>` e sono terminali (no pre-hook). Service-wrap è l'UNICO path per implementare "check BEFORE invocation".
2. **Pattern carryover F11**: `wrapServiceWithPermissions` (packages/permissions/src/enforcement-points.ts:197-233) usa esattamente lo stesso meccanismo con marker disjoint `__permissionsServicePatched`. Coerenza cross-fase tra moduli MF-governance.
3. **Scope esteso F12 vs F11**: F11 patches 4 metodi (`bootstrap/mount/unmount/destroy`), F12 patches 3 metodi (`register/load/mount`). Intersezione `mount` ammette chain naturale via install order.
4. **Async wrapper deviation**: F12 wrap usa `async value(...)` (vs sync F11 wrap che era marker-only senza throw concreto). Necessario perché `register/load/mount` ritornano Promise<void> → throw sync di `enforceCompatPolicy` deve propagare come Promise rejection coerente con D-12-03.

**Evidence:**
- `packages/compat/src/enforcement-points.ts:75` `type PatchableService = MicroFrontendsService & { readonly __compatServicePatched?: true }`
- `packages/compat/src/enforcement-points.ts:128-138` `Object.defineProperty(tagged, '__compatServicePatched', { value: true, writable: false, enumerable: false, configurable: false })`
- `packages/compat/src/enforcement-points.ts:160-186` Async wrapper con `enforceCompatPolicy(...)` chiamato PRIMA di `originalFn(...args)`
- `packages/compat/src/__tier1__/enforcement-points.test.ts` Test 1-3 (marker + idempotent + non-configurable) + Test 4/5/6 (register/load/mount throw COMPAT_INCOMPATIBLE phase corretto) + Test 12 (2 marker coesistono F11+F12)
- Audit grep post-build: `grep -c "__compatServicePatched" packages/compat/dist/index.js` = 1 match; `grep -c "__permissionsServicePatched" packages/compat/dist/index.js` = 0 (NO leak F11)

### OQ-2 (HIGH) — RESOLVED ordering F11+F12 layered install

**Resolution:** F12 wrap è layer ESTERNO via install order in `createBroker({ modules: [microfrontendModule(), permissionsModule(), compatModule()] })` — F12 patcha PER ULTIMO → wrap esterno sul method `mount` (intersezione con F11). Documentato in JSDoc `enforcement-points.ts` modulo header + JSDoc `compat-module.ts` `@example OQ-2 ordering`.

**Rationale:**
1. **Install order host-controlled**: in `modules: [...]` array. Convenzione documentata: `microfrontendModule()` PRIMA → `permissionsModule()` → `compatModule()` ULTIMO.
2. **F12 patcha DOPO F11 sui metodi intersezione (`mount`)**: wrap esterno F12 contiene wrap F11 contiene original FSM.
3. **Sul call `mfService.mount(id)`** la chain è:
   - F12 compat check FIRST → if `block-mount` + `report fail` → throw `COMPAT_INCOMPATIBLE` → F11 + original NON eseguiti.
   - Se F12 OK → invoca `originalFn` (= F11 wrap) → permission check.
   - Se F11 OK → invoca registry FSM transitions.
4. **Coerente**: incompatibilità categorica precede permission denial. Un MF incompatibile non dovrebbe nemmeno essere considerato per permission resolution.
5. **Cross-fase test SC5 in plan 12-05**: verifica empiricamente che `compat throws → permission NEVER reached`.

**Evidence:**
- `packages/compat/src/enforcement-points.ts:27-44` JSDoc `## OQ-2 RESOLUTION (HIGH) — Ordering F11+F12`
- `packages/compat/src/compat-module.ts:153-165` JSDoc `@example OQ-2 ordering F11+F12 (cross-fase doc)`
- `packages/compat/src/__tier1__/enforcement-points.test.ts` Test 12 (2 marker coesistono disjoint — preparazione cross-fase test SC5)

## D-83 Strict Triple Esteso v2.0 Verification

| Boundary | Baseline | Resolved | Diff lines | Status |
| --- | --- | --- | --- | --- |
| `packages/core/src/` | `27dd7db` (F10_END statico) | n/a | 0 | PRESERVED |
| `packages/microfrontends/src/` | `27dd7db` | n/a | 0 | PRESERVED |
| `packages/mapper/src/` | `27dd7db` | n/a | 0 | PRESERVED |
| `packages/permissions/src/` | `a4aec0d` (F11_END dynamic — subject-anchor grep) | resolved | 0 | PRESERVED |

Comando verifica eseguita:
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
| `pnpm --filter @gluezero/core test -- v1-bc-replay` | **267 PASS** + 3 skipped (BC §42 invariato post-F12 W3) |

Output: `Test Files 31 passed | 3 skipped (34) / Tests 267 passed | 3 skipped (270)`.

## Bundle Empirical W3 Verification

```
packages/compat/dist/index.js   = 24.5 KB raw / 7.9 KB gzip  (cap 9 KB = 9000 B)
packages/compat/dist/augment.js = 189 B raw / 22 B gzip      (cap 1 KB = 1000 B)
packages/compat/dist/index.d.ts = 40.97 KB (types DTS)
```

**Headroom bundle W3:** 1.1 KB gzip residuo (12% margine sul cap 9 KB). Bundle salito da 71 B W2 (placeholder commentati) a 7.9 KB W3 (wiring completo incluso semver tree-shaken). Crescita attesa: i 6 sources W2 + 3 sources W3 sono ora tutti reachable via barrel `compatModule()` export.

W2 SUMMARY aveva calcolato budget di inflation `8929 B = 9000 - 71`. Inflation reale W3 = 7.9 KB - 71 B = ~7.8 KB → ENTRO budget previsto. Bundle PASS senza necessità di escalation (RESEARCH §3.4 strategie fallback NON necessarie).

## Coverage Tier-1 jsdom

| Metric | Value | Threshold | Status |
| --- | --- | --- | --- |
| Statements | 96.96% (160/165) | ≥ 90% | PASS |
| Branches | 88.63% (78/88) | ≥ 85% | PASS |
| Functions | 97.05% (33/34) | ≥ 90% | PASS |
| Lines | 98.01% (148/151) | ≥ 90% | PASS |

Test suite: **108/108 PASS** (9 file test). Breakdown:
- W1 carryover: 4 (index sanity W1 — ora estesi W3)
- W2 carryover: 66 (6 file test pure logic stack)
- W3 NEW: 38 (3 file test wiring + index update)

Per-file coverage W3:
- `enforcement-points.ts` 94.44% / 90% / 100% / 100% (linea 161 = wrap method skip se descriptor undefined — test 9b copre indirettamente)
- `lifecycle-hooks.ts` 100% / 66.66% / 100% / 100% (branch missing = `mfId === undefined` defensive in subscribe callbacks)
- `compat-module.ts` 100% / 100% / 100% / 100% (full coverage via 17 test cases)
- `check-engine.ts` 95.16% / 88.09% / 88.88% / 96.55% (W2 carryover — linee 276/356 minor edge case)
- `semver-checker.ts` 80% / 100% / 100% / 80% (W2 carryover — linea 84 = isValidVersion no-throw branch)

## Verification Gates W3 Eseguiti

| Gate | Status | Output |
| --- | --- | --- |
| `pnpm --filter @gluezero/compat typecheck` | PASS | `tsc --noEmit` exit 0 zero errori |
| `pnpm --filter @gluezero/compat build` | PASS | ESM + DTS build success in 68ms + 330ms |
| `pnpm --filter @gluezero/compat test` | PASS | 108/108 test cases PASS (9 file test) |
| `pnpm --filter @gluezero/compat test:coverage` | PASS | 96.96%/88.63%/97.05%/98.01% thresholds 90/85/90/90 PASS |
| `pnpm exec size-limit` (compat entries) | PASS | 7.9 KB / 9 KB cap + 22 B / 1 KB cap |
| `pnpm --filter @gluezero/core test -- v1-bc-replay` | PASS | 267 PASS invariato (BC §42 14 API gate cross-fase) |
| D-83 strict triple esteso v2.0 | PASS | 0+0+0+0 diff lines (core+microfrontends+mapper+permissions) |
| Audit grep `__compatServicePatched` presente in dist | PASS | 1 match in `packages/compat/dist/index.js` (minified) |
| Audit grep `__permissionsServicePatched` NON presente in dist compat | PASS | 0 match (NO leak F11 marker) |
| Audit grep barrel hygiene: internal helpers NOT re-exported | PASS | `wrapServiceWithCompat`/`wireLifecycleHooks`/`enforceCompatPolicy`/`createSemverChecker` non in `Object.keys(barrel)` (Test 17) |
| Audit grep barrel completion: W2/W3 public surface presente | PASS | `compatModule`/`createCheckEngine`/`createVersionRegistry`/`createCompatError`/`publishCompatTopics`/`MF_COMPAT_TOPICS` in barrel (Test 14-16) |

## Deviations from Plan

### Rule 3 - Blocking: build core+microfrontends+theme+permissions required prima dei test

- **Found during:** Initial baseline test run after worktree branch switch.
- **Issue:** Worktree branch creato da main aveva HEAD pre-F11 e pre-F12-W1/W2. Eseguito `git reset --hard gsd/v2.0.0-microfrontend-governance` per fast-forward al SUMMARY 12-02 HEAD. Inoltre `pnpm install` ha installato vitest ma i package `core/microfrontends/theme/permissions` non avevano `dist/` (workspace dependency necessita compilazione preliminare per i test che importano via `@gluezero/core`).
- **Fix:** `pnpm --filter @gluezero/core --filter @gluezero/microfrontends --filter @gluezero/theme --filter @gluezero/permissions build` PRIMA dei test compat — workspace dependency resolution risolta.
- **Files modified:** Nessuno (operazione one-shot build).
- **Commit:** N/A (operazione di setup, non commit).

### Rule 1 - Bug: async wrapper required per service-wrap throw → Promise rejection coerente

- **Found during:** Task 1 GREEN gate run (test 4/5/6/9b falliti con `Test 4: register policy=block-registration → throw COMPAT_INCOMPATIBLE` — il throw sync nel wrapper NON era catturato da `expect(...).rejects.toMatchObject(...)` perché il wrapper non era async).
- **Issue:** Il pattern F11 `wrapServiceWithPermissions` usa sync wrapper (`value(...)`) perché la sua logica era marker-only senza throw concreto. F12 invece DEVE chiamare `enforceCompatPolicy` (che throwa CompatError sync) PRIMA dell'invocazione `originalFn` (Promise async). Vitest `rejects.toMatchObject` necessita Promise rejection, non sync throw.
- **Fix:** Aggiunto `async` keyword al wrapper value: `async value(...args: unknown[]): Promise<unknown>`. Async function converte sync throw in Promise rejection nativamente. Consumer pattern `await mfService.register(...)` vede rejection coerente con D-12-03 "Promise rejection async path".
- **Files modified:** `packages/compat/src/enforcement-points.ts` (linee 160-186).
- **Commit:** `9e2d621` (Task 1 — fix incluso nello stesso commit dei sources Task 1 perché senza il fix i test non passavano).

### Rule 1 - Bug: Test 12 compat-module spy-hook topic literal violava broker validator regex

- **Found during:** Task 3 GREEN gate run (Test 12 falliva con `BrokerError: Invalid format: Expected /^[a-z][a-z0-9]*(\.[a-z][a-z0-9*]*)*$/ but received "spy-hook.installed"`).
- **Issue:** Pianificato uso di module intermedio chiamato `spy-hook` che emette topic `spy-hook.installed` PRIMA dell'install di compat per intercettare i 4 subscribe via spy. Topic literal `spy-hook.installed` viola broker validator regex (dash forbidden nei segmenti). Stesso problema della Rule 1 fix W2 (topic `version-changed` → `version.changed`).
- **Fix:** Riscritto Test 12 come verifica indiretta del behavior: emit `version.changed` via `registerCanonicalModelVersion` (interno usa `microfrontend.compatibility.version.changed` dot-only) → il subscribe handler in lifecycle-hooks chiama `engine.invalidateReportCache()` → `getCompatibilityReport().size === 0` post-emit. Pattern coerente con W2 SUMMARY Rule 1 fix.
- **Files modified:** `packages/compat/src/__tier1__/compat-module.test.ts` (Test 12 rewritten).
- **Commit:** `29a57fb` (Task 3 — fix incluso nello stesso commit del Task 3 perché senza il fix il test non passava).

### Rule 2 - Critical missing: NON applicato

Nessun problema di sicurezza/correttezza pre-esistente trovato in W3 che giustificasse intervento Rule 2:
- Threat model 12-03 §threat_model (4 threat T-12-W3-01..04) tutti MITIGATED o ACCEPT.
- `T-12-W3-01` (Tampering marker override): mitigated da `Object.defineProperty` config=false (non-configurable).
- `T-12-W3-02` (DoS re-install loop): mitigated da idempotent guard + F8 module registry duplicate ID detection.
- `T-12-W3-03` (Elevation of Privilege ordering bypass): accept come trust model (host controlla install order).
- `T-12-W3-04` (Info Disclosure all-reports): accept come governance NOT crypto (P-13 carryover F11).

### Rule 4 - Architectural: NON applicato

Nessuna scoperta architetturale che richiedesse decisione utente. Entrambe le OQ resolution (OQ-1 + OQ-2) erano già pre-ratificate dal planner W3 nel plan con cross-ref ai TEMPLATE F11 + RESEARCH.md §6.

## REVISIONI Applicate (dal plan)

| Revisione | Status | Evidence |
| --- | --- | --- |
| REVISIONE WARNING 1: 10 metodi service (5 PRD + 4 D-12-10 + 1 theme peer-conditional) | APPLIED | `CompatService` interface compat-module.ts:91-114 con `registerThemeVersion(kind, version)` peer-conditional + Test 7 verifica 10 metodi presenti + Test 13 verifica registerThemeVersion callable senza throw |
| REVISIONE WARNING 7: F11_END dynamic resolve via subject-anchor grep | APPLIED | SUMMARY frontmatter `F11_END=a4aec0d` resolved via `git log --extended-regexp --grep='^docs\(11-05-permissions-closure\):' --format='%H' -1` |

## Next Plan

**12-04 (W2 sequenziale):** Integration test snapshot stub + memoization integration + Tier-1 jsdom SC1-SC4.

- Tier-1 jsdom integration test end-to-end scenarios (SC1-SC4).
- Memoization integration cross-flow (register → check → emit version.changed → re-check).
- Snapshot stub per devtools introspection.
- Bundle gate finale W4 (post-Tier-1 closure).

Successor: 12-05 (README italiano + JSDoc enrichment + cross-fase SC5 ordering F11+F12 + final closure).

## Self-Check: PASSED

Verifiche post-SUMMARY:

```
File source esistono:
[FOUND] packages/compat/src/enforcement-points.ts (193 LoC)
[FOUND] packages/compat/src/lifecycle-hooks.ts (167 LoC)
[FOUND] packages/compat/src/compat-module.ts (242 LoC)
[FOUND] packages/compat/src/index.ts (114 LoC — modified W3)

File test esistono:
[FOUND] packages/compat/src/__tier1__/enforcement-points.test.ts (241 LoC, 11 tests)
[FOUND] packages/compat/src/__tier1__/lifecycle-hooks.test.ts (212 LoC, 12 tests)
[FOUND] packages/compat/src/__tier1__/compat-module.test.ts (232 LoC, 17 tests)
[FOUND] packages/compat/src/__tier1__/index.test.ts (49 LoC, 6 tests — modified W3)

Commits esistono:
[FOUND] 9e2d621 Task 1 — enforcement-points service-wrap monkey-patch register/load/mount (OQ-1)
[FOUND] 44ee89b Task 2 — lifecycle-hooks 4 topic subscribe (OQ-2 dual + invalidate + cleanup)
[FOUND] 29a57fb Task 3 — compatModule factory + Service Locator install + 10 API + barrel completion

Gate verification:
[PASS] typecheck clean exit 0
[PASS] build success ESM + DTS (68ms + 330ms)
[PASS] 108/108 test PASS Tier-1 jsdom (W1=4 + W2=66 + W3=38)
[PASS] coverage 96.96%/88.63%/97.05%/98.01% (thresholds 90/85/90/90)
[PASS] size-limit 7.9 KB / 9 KB cap (headroom 1.1 KB) + 22 B / 1 KB cap
[PASS] v1-bc-replay 267 PASS (BC §42 cross-fase invariato)
[PASS] D-83 strict triple esteso v2.0 — 0+0+0+0 diff lines
[PASS] Audit grep __compatServicePatched present in dist (1 match)
[PASS] Audit grep __permissionsServicePatched NOT in compat dist (0 leak F11)
[PASS] Barrel hygiene W3: internal helpers NOT re-exported (wrapServiceWithCompat, wireLifecycleHooks, enforceCompatPolicy, createSemverChecker)
[PASS] Barrel completion W3: compatModule + types + W2 surface exported (verified Test 14-17)
```
