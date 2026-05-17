---
phase: 12
plan: "12-01"
subsystem: "@gluezero/compat scaffolding"
tags: [scaffold, wave-1, compat, semver, OQ-5, OQ-6, OQ-7, D-83-strict-triple-esteso]
requires:
  - "@gluezero/core (workspace peer)"
  - "@gluezero/microfrontends (workspace peer)"
  - "@gluezero/theme (workspace peer optional)"
  - "semver@^7.7.4 (hard dep esterna — prima v2.0)"
  - "@types/semver@^7.5 (dev — resolved 7.7.1)"
provides:
  - "Package @gluezero/compat scaffolding W1 (5 config files + 8 src files)"
  - "Types pubblici PRD §20.3/§20.5/§20.6 (MicroFrontendCompatibility, CompatibilityReport, CompatibilityPolicy)"
  - "CompatAwareMfDescriptor type narrowing locale (carryover F11 P4)"
  - "Pattern S1 augment marker __compatAugmentLoaded"
  - "Build-time __GLUEZERO_VERSION__ injection via tsup define (OQ-5 RESOLVED)"
  - "Root size-limit entry 9 KB compat + 1 KB augment + ci:gate:f12 script"
affects:
  - "package.json root (additive: ci:publint/ci:attw filter list extension, ci:gate:f12 script, 2 size-limit entries)"
  - "pnpm-lock.yaml (new deps semver@7.7.4 + @types/semver@7.7.1)"
tech-stack:
  added:
    - "semver@7.7.4 (hard dep esterna, CJS bundled inline via tsup noExternal)"
    - "@types/semver@7.7.1 (dev)"
  patterns:
    - "Pattern S1 augment stretto (carryover D-V2-F11-17 lockato F11): marker side-effect-only, NO declaration merging upstream, NO Broker.prototype patch"
    - "Type narrowing locale via interface extension (D-83 strict carryover F11 P4): CompatAwareMfDescriptor extends MicroFrontendDescriptor con compatibility?, zero diff upstream"
    - "tsup `define` build-time injection (OQ-5 NEW pattern v2.0): esbuild sostituisce letteralmente __GLUEZERO_VERSION__ → JSON.stringify(env ?? '2.0.0')"
    - "tsup `noExternal: ['semver']` (NEW pattern v2.0): CJS lib bundled inline per ESM-only consumer"
key-files:
  created:
    - packages/compat/package.json
    - packages/compat/tsup.config.ts
    - packages/compat/tsconfig.json
    - packages/compat/vitest.config.ts
    - packages/compat/vitest.integration.config.ts
    - packages/compat/src/augment.ts
    - packages/compat/src/index.ts
    - packages/compat/src/types/index.ts
    - packages/compat/src/types/compatibility.ts
    - packages/compat/src/types/report.ts
    - packages/compat/src/types/policy.ts
    - packages/compat/src/types/descriptor-augment.ts
    - packages/compat/src/internal/gluezero-version.ts
  modified:
    - package.json (root: ci scripts append + size-limit array append)
    - pnpm-lock.yaml (auto-updated by pnpm install)
decisions:
  - "OQ-5 RESOLVED via opzione (a) tsup `define` build-time injection — verifica empirica `grep '\"2.0.0\"' dist/index.js` PASS"
  - "OQ-6 RESOLVED via F8 placeholder esistente — `validateDescriptor` accetta `compatibility?: v.optional(v.unknown())` extra key, no `as unknown` cast necessario in W2"
  - "OQ-7 RESOLVED — NO peer @gluezero/permissions in package.json (F12 ortogonale runtime a F11), peer optional @gluezero/theme mantenuto per dim `theme`"
  - "semver versione: hardcoded `^7.7.4` (NON 7.8.0 originariamente anticipato in CONTEXT.md/RESEARCH.md — 7.8.0 non esiste; ^7.7.4 è la versione installata reale verificata in node_modules/.pnpm)"
  - "Rule 1 fix applicato: F11_END grep pattern anchor `^docs\\(11-05-permissions-closure\\):` via `--extended-regexp` (prevenzione self-match nel body dei commit F12+)"
metrics:
  duration_minutes: 18
  completed_date: 2026-05-13
  total_source_loc: 604
  total_commits: 4
  bundle_gzip_baseline:
    "@gluezero/compat (gzip)": "71 B (cap 9000 B — budget W2 inflation = 8929 B)"
    "@gluezero/compat/augment (gzip)": "22 B (cap 1000 B)"
---

# Phase 12 Plan 12-01: @gluezero/compat scaffolding W1 Summary

Scaffolding completo del package `@gluezero/compat` (14° del monorepo GlueZero v2.0): tsup multi-entry index+augment con `noExternal: ['semver']` e `define __GLUEZERO_VERSION__`, types files PRD §20.3/§20.5/§20.6 (MicroFrontendCompatibility 9 dim + Report + Policy 5 valori), CompatAwareMfDescriptor type narrowing locale carryover F11 P4, root `package.json` size-limit append 9 KB gzip + `ci:gate:f12` script con F11_END dinamico, bundle empirical verification PASS.

## Files Created (13 source + 1 modified config)

| File | LoC | Ruolo |
| --- | --- | --- |
| `packages/compat/package.json` | 108 | Manifest ESM-only multi-entry — peerDeps core+microfrontends + peer optional theme, dep hard `semver@^7.7.4`, exports `.`+`./augment`, sideEffects augment.js, size-limit 9 KB + 1 KB |
| `packages/compat/tsup.config.ts` | 36 | Build multi-entry ESM minify es2022 browser + `noExternal: ['semver']` (CJS→ESM bundling) + `define { __GLUEZERO_VERSION__: JSON.stringify(env ?? '2.0.0') }` (OQ-5) |
| `packages/compat/tsconfig.json` | 11 | Estende `../../tsconfig.base.json` + ES2022 + DOM lib |
| `packages/compat/vitest.config.ts` | 30 | Tier-1 jsdom unit suite + coverage thresholds 90/85/90/90 |
| `packages/compat/vitest.integration.config.ts` | 24 | Integration suite separate (timeout 10s) |
| `packages/compat/src/augment.ts` | 56 | Pattern S1 marker `__compatAugmentLoaded: true = true` side-effect-only |
| `packages/compat/src/index.ts` | 86 | Barrel pubblico W1 — side-effect import + types re-export + `GLUEZERO_VERSION` build-time const + W2 placeholders commentati |
| `packages/compat/src/types/index.ts` | 12 | Barrel types-only re-export |
| `packages/compat/src/types/compatibility.ts` | 45 | `MicroFrontendCompatibility` 9 dim interface readonly (PRD §20.3) |
| `packages/compat/src/types/report.ts` | 70 | `CompatibilityIssueType` 9 valori + `CompatibilityIssue` + `CompatibilityReport` (PRD §20.5, D-12-18 checkedAt = Date.now(), D-12-19 context additivo) |
| `packages/compat/src/types/policy.ts` | 35 | `CompatibilityPolicy` 5 valori (PRD §20.6, D-12-02 default `'warn'`) |
| `packages/compat/src/types/descriptor-augment.ts` | 48 | `CompatAwareMfDescriptor` extends `MicroFrontendDescriptor` + `getCompatibility()` helper (carryover F11 P4) |
| `packages/compat/src/internal/gluezero-version.ts` | 43 | Ambient `declare const __GLUEZERO_VERSION__` + named export `GLUEZERO_BUILD_VERSION` (OQ-5 inject) |
| **TOTAL** | **604** | (13 file source) |

| File modified | Tipo modifica |
| --- | --- |
| `package.json` (root) | Additive: `ci:publint`/`ci:attw` filter list +`@gluezero/compat`, `ci:gate:f12` script append (publint+attw+test+test:integration+size+v1-bc-replay+D-83 dynamic check), size-limit 2 entries append |
| `pnpm-lock.yaml` | Auto: nuove deps `semver@7.7.4` + `@types/semver@7.7.1` |

## Commit History

| Hash | Type | Tasks | Files | Description |
| --- | --- | --- | --- | --- |
| `69c016e` | feat | Task 1 | 6 | config files (package.json + tsup + tsconfig + vitest x2) + pnpm-lock |
| `a25a8f0` | feat | Task 2 | 8 | types pubblici PRD §20 + augment marker + barrel + internal version |
| `f703f65` | feat | Task 3 | 3 | root size-limit + ci:gate:f12 + index.ts GLUEZERO_VERSION re-export per OQ-5 empirical verify |
| `64877d7` | fix | Rule 1 | 1 | F11_END grep pattern anchor `^docs(...):` (subject-only, evita self-match nel body F12+) |

## Bundle Empirical W1 Baseline

```
dist/index.js   = 292 B raw / 71 B gzip  (cap 9 KB = 9000 B gzip) — PASS budget W2 inflation = 8929 B
dist/augment.js = 193 B raw / 22 B gzip  (cap 1 KB = 1000 B gzip) — PASS
dist/index.d.ts = 11 KB (types)
```

OQ-5 verifica empirica: `dist/index.js` contiene `var o="2.0.0"` — esbuild ha sostituito letteralmente `__GLUEZERO_VERSION__` con la stringa JSON-escaped `"2.0.0"`. Nessuna occorrenza dell'identifier originale nel bundle. RESOLVED.

## OQ Resolution Outcomes

| OQ | Status | Rationale + Evidence |
| --- | --- | --- |
| OQ-5 (HIGH) | RESOLVED | tsup `define: { __GLUEZERO_VERSION__: JSON.stringify(process.env.GLUEZERO_VERSION ?? '2.0.0') }` — esbuild inline substitution verificata empiricamente via `grep '"2.0.0"' dist/index.js` PASS |
| OQ-6 (LOW) | RESOLVED | F8 `descriptor-validator.ts` ha già `compatibility: v.optional(v.unknown())` come placeholder (linea visibile post-grep). Quindi `validateDescriptor({...compatibility:{...}})` accetta extra key senza throw. W2 NON necessita `as unknown` cast nei test setup |
| OQ-7 (LOW) | RESOLVED | `packages/compat/package.json`: NESSUN peer `@gluezero/permissions` (F12 ortogonale runtime a F11 — non c'è dipendenza cross-modulo). Peer optional `@gluezero/theme` MANTENUTO per dim `theme` resolution fallback |

## D-83 Strict Triple Esteso v2.0 Verification

| Boundary | F10_END / F11_END | Diff lines | Status |
| --- | --- | --- | --- |
| `packages/core/src/` | `27dd7db` (F10_END statico) | 0 | PRESERVED |
| `packages/microfrontends/src/` | `27dd7db` (F10_END statico) | 0 | PRESERVED |
| `packages/mapper/src/` | `27dd7db` (F10_END statico) | 0 | PRESERVED |
| `packages/permissions/src/` | `a4aec0d` (F11_END dynamic via grep `^docs\(11-05-permissions-closure\):` ERE) | 0 | PRESERVED |

Comando dinamico: `F11_END=$(git log --extended-regexp --grep='^docs\(11-05-permissions-closure\):' --format=%H -1)` → resolved correctly al commit closure F11 (REVISIONE WARNING 7 + Rule 1 fix applicato).

## Verification Gates Eseguiti

| Gate | Status | Output |
| --- | --- | --- |
| `pnpm install --filter @gluezero/compat` | PASS | semver@7.7.4 + @types/semver@7.7.1 risolti |
| `pnpm --filter @gluezero/compat typecheck` | PASS clean | `tsc --noEmit` exit 0 zero errori |
| `pnpm --filter @gluezero/compat build` | PASS | ESM + DTS build success in 18-20ms |
| `pnpm --filter @gluezero/compat test` | PASS | `passWithNoTests` (W1 skeleton — test suite W2/W3) |
| `pnpm --filter @gluezero/compat exec publint` | PASS | "All good!" |
| `pnpm --filter @gluezero/compat exec attw --pack --profile=esm-only` | PASS | tutti i target 🟢 ESM |
| `pnpm size-limit` (compat entries) | PASS | 71 B/9000 B (compat index) + 22 B/1000 B (augment) |
| `pnpm --filter @gluezero/core test -- v1-bc-replay` | PASS | 267 PASS preserved (cross-fase BC §42 14 API gate invariato) |

## Deviations from Plan

### Rule 1 - Bug: F11_END grep pattern self-match (commit 64877d7)
- **Found during:** SUMMARY metric gathering post-Task 3 commit
- **Issue:** Pattern originale `git log --grep='docs(11-05-permissions-closure)'` (sostanza-match) matchava anche il body del commit Task 3 di F12 (che cita `docs(11-05-permissions-closure)` nel messaggio body per documentare F11_END dynamic resolution). Risultato: F11_END risolveva al commit F12 invece che al closure F11 — D-83 check sarebbe risultato in falso-PASS (zero diff sempre, perché baseline mai più indietro di HEAD).
- **Fix:** `git log --extended-regexp --grep='^docs\(11-05-permissions-closure\):'` (subject-anchor `^` + ERE paren escape) — match SOLO inizio subject line, non body. Verifica empirica BEFORE=`f703f65` (wrong, F12 Task 3) → AFTER=`a4aec0d` (correct, F11 closure).
- **Files modified:** `package.json` (script `ci:gate:f12` line)
- **Commit:** `64877d7`

### Rule 3 - Blocking: esbuild `__GLUEZERO_VERSION__` ambient import error
- **Found during:** Task 3 first build attempt (post Task 2 commit)
- **Issue:** `internal/gluezero-version.ts` originale aveva solo `declare const __GLUEZERO_VERSION__: string` + `export { __GLUEZERO_VERSION__ }` — ma `declare const` è TS-only (ambient declaration), esbuild non vede un binding runtime importabile. Import in `index.ts` falliva con: `No matching export in "src/internal/gluezero-version.ts" for import "__GLUEZERO_VERSION__"`.
- **Fix:** Aggiunto in `internal/gluezero-version.ts` un named export effettivo `GLUEZERO_BUILD_VERSION: string = __GLUEZERO_VERSION__` (use-site del literal ambient — esbuild sostituisce con define al build-time + crea binding runtime). `index.ts` aggiornato per importare `GLUEZERO_BUILD_VERSION` (non più `__GLUEZERO_VERSION__` direct).
- **Files modified:** `packages/compat/src/internal/gluezero-version.ts`, `packages/compat/src/index.ts`
- **Commit:** `f703f65` (Task 3 — incluso nello stesso commit per coerenza con il bundle empirical verify che dimostra l'OQ-5 resolution attraverso il binding `GLUEZERO_VERSION`)

### Rule 2 - Critical missing: NON applicato
Nessun problema di sicurezza/correttezza pre-esistente trovato che giustificasse intervento Rule 2 in questo plan. Plan W1 = pure scaffolding senza superfici di rete/auth/file/schema. Threat model F12 (T-12-01..04) confermato HIGH-severity-free a W1.

## Next Plan

**12-02:** Engine + Registry + Error + Topics (W2 wave parallelizzabile).
- `packages/compat/src/topics.ts` (MF_COMPAT_TOPICS reuse `MF_GOVERNANCE_TOPICS[1]`)
- `packages/compat/src/compat-error.ts` (factory `createCompatError`)
- `packages/compat/src/semver-checker.ts` (semver wrap try-catch defensive)
- `packages/compat/src/version-registry.ts` (3 Map storage + invalidation)
- `packages/compat/src/check-engine.ts` (9 dim check orchestration)

Successor plans 12-03 (compat-module factory + policy-dispatch + enforcement-points + lifecycle-hooks), 12-04 (Tier-1 jsdom test suite 9 dim), 12-05 (README italiano + JSDoc + closure).

## Self-Check: PASSED

Verifiche post-SUMMARY:

```
File esistono:
[FOUND] packages/compat/package.json
[FOUND] packages/compat/tsup.config.ts
[FOUND] packages/compat/tsconfig.json
[FOUND] packages/compat/vitest.config.ts
[FOUND] packages/compat/vitest.integration.config.ts
[FOUND] packages/compat/src/augment.ts
[FOUND] packages/compat/src/index.ts
[FOUND] packages/compat/src/types/index.ts
[FOUND] packages/compat/src/types/compatibility.ts
[FOUND] packages/compat/src/types/report.ts
[FOUND] packages/compat/src/types/policy.ts
[FOUND] packages/compat/src/types/descriptor-augment.ts
[FOUND] packages/compat/src/internal/gluezero-version.ts
[FOUND] packages/compat/dist/index.js (292 B raw / 71 B gzip)
[FOUND] packages/compat/dist/augment.js (193 B raw / 22 B gzip)

Commits esistono:
[FOUND] 69c016e Task 1 config files
[FOUND] a25a8f0 Task 2 types + augment + barrel
[FOUND] f703f65 Task 3 root append + bundle verify
[FOUND] 64877d7 Rule 1 fix F11_END grep pattern
```
