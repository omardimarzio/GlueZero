---
phase: 01-core-essenziale
plan: 02
subsystem: core-package-config
tags:
  - core-package
  - build-config
  - test-config
  - tsup
  - vitest
dependency-graph:
  requires:
    - workspace-root
    - tooling-base-config
  provides:
    - core-package-build-pipeline
    - core-package-test-pipeline
    - core-package-typecheck-pipeline
    - core-runtime-deps-installed
  affects:
    - all-future-f1-plans
    - "@gluezero/core-public-api"
tech-stack:
  added:
    - nanoid@5.1.9 (runtime dep, packages/core)
    - valibot@1.3.1 (runtime dep, packages/core)
    - tsup@8.5.1 (devDep locale)
    - typescript@6.0.3 (devDep locale)
    - vitest@4.1.5 (devDep locale)
    - jsdom@29.1.0 (devDep locale)
  patterns:
    - esm-only-distribution
    - per-package-tooling-config
    - tsup-rollup-dts-bundle
    - vitest-jsdom-environment
    - v8-coverage-thresholds
key-files:
  created:
    - packages/core/package.json
    - packages/core/tsconfig.json
    - packages/core/tsup.config.ts
    - packages/core/vitest.config.ts
    - packages/core/README.md
    - packages/core/src/index.ts
  modified:
    - pnpm-lock.yaml
decisions:
  - "Aggiunto `\"ignoreDeprecations\": \"6.0\"` a packages/core/tsconfig.json: tsup 8.5.1 (via rollup.js linea 6837) inietta hardcoded `baseUrl: compilerOptions.baseUrl || \".\"` nel DTS rollup. TypeScript 6.0.3 promuove `baseUrl` da deprecation warning ad errore TS5101 hard. La fix consigliata da TS è `ignoreDeprecations: \"6.0\"`. Da rimuovere quando tsup riceverà fix upstream o si migrerà a `unbuild`/`tshy`."
  - "Aggiunto `--passWithNoTests` agli script test/test:coverage del package: Vitest 4.1.5 esce con codice 1 (non 0 come affermato in plan da RESEARCH.md) quando non trova test files. Il flag è la convenzione Vitest standard per CI in fase early-bootstrap. Da rimuovere quando i plan 03+ aggiungeranno test reali (a quel punto fail su zero file diventa garanzia di robustezza)."
metrics:
  duration: "3m 19s"
  completed: "2026-04-28T12:15:03Z"
  tasks_completed: 2
  files_created: 6
  files_modified: 1
  commits: 2
---

# Phase 1 Plan 02: Configurazione @gluezero/core Summary

Configurazione completa del package `@gluezero/core` come UNICO sub-package con codice attivo in F1: package.json con runtime deps lockate (`nanoid@5.1.9`, `valibot@1.3.1`) + devDeps locali (`tsup@8.5.1`, `typescript@6.0.3`, `vitest@4.1.5`, `jsdom@29.1.0`), tsconfig esteso da base con `ignoreDeprecations: "6.0"`, tsup ESM-only con dts rollup, vitest jsdom + coverage v8 90/85/90/90, README skeleton DOC-01, `src/index.ts` placeholder ESM (`export {}`); pipeline build+test+typecheck verde.

## Objective Achieved

L'obiettivo del plan 01-02 è raggiunto integralmente: `pnpm --filter @gluezero/core build` produce `dist/index.js` (68 B ESM) + `dist/index.d.ts` (13 B declaration), `pnpm --filter @gluezero/core typecheck` esce 0, `pnpm --filter @gluezero/core test` esce 0 (no test files atteso), `node -e "import('./dist/index.js')"` ritorna `[]` (placeholder ESM valido). Tutte e 5 le verifiche packaging baseline (PKG-01 ESM, PKG-02 TS source, PKG-03 ES2022 target, PKG-04 .d.ts, exports field con types-prima-di-import) sono in atto.

## Tasks Executed

| # | Name | Commit | Status |
|---|------|--------|--------|
| 1 | Creare package.json + tsconfig + tsup config + README per @gluezero/core | `6de9f41` | done |
| 2 | vitest.config.ts + src/index.ts placeholder + install runtime deps | `d6004c7` | done |

## Files Created

**Package config (4 file):**
- `packages/core/package.json` — config completa: `"type": "module"`, `"sideEffects": false`, `exports` con `types` PRIMA di `import` (ordine TS resolver), runtime deps `nanoid@5.1.9` + `valibot@1.3.1`, devDeps `tsup@8.5.1` + `typescript@6.0.3` + `vitest@4.1.5` + `jsdom@29.1.0`, scripts `build/test/test:watch/test:coverage/typecheck/clean`, `publishConfig.provenance: true` (npm provenance attestations), size-limit budget 8 KB gzip, engines node ≥20
- `packages/core/tsconfig.json` — extends `../../tsconfig.base.json`, `outDir: "./dist"`, `rootDir: "./src"`, `lib: ["ES2022", "DOM", "DOM.Iterable"]`, `ignoreDeprecations: "6.0"` (deviation Rule 3, vedi sotto)
- `packages/core/tsup.config.ts` — `format: ['esm']` (no CJS, evita dual-package hazard letale per broker con state singleton, RESEARCH.md §"Decisione su CJS dual-package"), `dts: true` (declaration rollup integrato), `target: 'es2022'`, `platform: 'browser'`, `external: [/^node:/]`, `treeshake: true`, `splitting: false`, `clean: true`, banner MIT
- `packages/core/README.md` — skeleton DOC-01 con installazione pnpm, API surface attesa (createBroker, Broker, BrokerEvent, BrokerError, EventTap, ecc.), vincolo architetturale EventTap pre-instrumentato F1, stato Phase 1 plan-by-plan, riferimenti PRD/CONTEXT/RESEARCH

**Test config (1 file):**
- `packages/core/vitest.config.ts` — `name: '@gluezero/core'`, `environment: 'jsdom'` (browser-like DOM per integration mid-level, 3-livelli strategy), `globals: false` (`import { describe, it, expect } from 'vitest'` esplicito, DX migliore in libreria pubblicata), `include: ['src/**/*.test.ts']`, coverage v8 con thresholds `90/85/90/90`, `typecheck.enabled: false`

**Source (1 file):**
- `packages/core/src/index.ts` — modulo ESM placeholder valido (`export {}`); plan 08 (Wave 4) sostituirà con re-export pubblici (`createBroker`, `Broker`, types, errori)

## Files Modified

- `pnpm-lock.yaml` — aggiunte 5 dipendenze risolte: `nanoid@5.1.9`, `valibot@1.3.1` (più 3 transitive). Sezione `packages/core` ora popolata con `dependencies` (nanoid + valibot) e `devDependencies` (tsup + typescript + vitest + jsdom)

## Versions Installed (verified live 2026-04-28)

| Package | Atteso | Installato (lockfile) | Tipo |
|---------|--------|----------------------|------|
| nanoid | 5.1.9 | 5.1.9 | runtime dep |
| valibot | 1.3.1 | 1.3.1 (con peer typescript@6.0.3) | runtime dep |
| tsup | 8.5.1 | 8.5.1 (postcss@8.5.12, typescript@6.0.3, yaml@2.8.3) | devDep locale |
| typescript | 6.0.3 | 6.0.3 | devDep locale |
| vitest | 4.1.5 | 4.1.5 (jsdom@29.1.0, msw@2.13.6, vite@8.0.10) | devDep locale |
| jsdom | 29.1.0 | 29.1.0 | devDep locale |

## Verification Results

### Acceptance criteria Task 1
- [x] `packages/core/package.json` esiste e contiene `"name": "@gluezero/core"`, `"type": "module"`, `"sideEffects": false`
- [x] Runtime deps `nanoid@5.1.9` e `valibot@1.3.1` in `dependencies`
- [x] devDeps `tsup@8.5.1`, `typescript@6.0.3`, `vitest@4.1.5`, `jsdom@29.1.0`
- [x] `exports.["."]` con `types` (chiave) PRIMA di `import` (chiave) — verificato visivamente nel JSON
- [x] `publishConfig.provenance: true`
- [x] `scripts.build: "tsup"`, `scripts.test: "vitest run --passWithNoTests"`, `scripts.typecheck: "tsc --noEmit"`
- [x] `size-limit` con budget `8 KB` gzip
- [x] `tsconfig.json` extends `../../tsconfig.base.json`, `outDir: "./dist"`, `rootDir: "./src"`
- [x] `tsup.config.ts` ha `format: ['esm']`, `dts: true`, `target: 'es2022'`, `platform: 'browser'`, `splitting: false`, `treeshake: true`, `clean: true`
- [x] `README.md` esiste, contiene `# @gluezero/core`, menziona `EventTap` come vincolo architetturale F1, elenca API surface skeleton
- [x] Tutti i JSON parsano senza errori (`node -e "JSON.parse(...)"` esce 0)

### Acceptance criteria Task 2
- [x] `vitest.config.ts` contiene `environment: 'jsdom'`, `globals: false`, `provider: 'v8'`, `statements: 90`, `branches: 85`
- [x] `src/index.ts` contiene `export {}` (modulo ESM valido placeholder)
- [x] `pnpm install` ha aggiornato `pnpm-lock.yaml` con `nanoid@5.1.9` e `valibot@1.3.1`
- [x] `pnpm --filter @gluezero/core build` esce 0; ESM `dist/index.js` 68 B, DTS `dist/index.d.ts` 13 B, sourcemap 69 B
- [x] `packages/core/dist/index.js` esiste post-build
- [x] `packages/core/dist/index.d.ts` esiste post-build (PKG-04 baseline)
- [x] `pnpm --filter @gluezero/core typecheck` esce 0
- [x] `pnpm --filter @gluezero/core test` esce 0 ("No test files found, exiting with code 0")
- [x] `cd packages/core && node -e "import('./dist/index.js').then(m => console.log(Object.keys(m)))"` esce 0 e stampa `[]`

### Output finale `pnpm --filter @gluezero/core build`

```
CLI Building entry: src/index.ts
CLI Using tsconfig: tsconfig.json
CLI tsup v8.5.1
CLI Using tsup config: packages/core/tsup.config.ts
CLI Target: es2022
CLI Cleaning output folder
ESM Build start
Generated an empty chunk: "index".
ESM dist/index.js     68.00 B
ESM dist/index.js.map 69.00 B
ESM ⚡️ Build success in 11ms
DTS Build start
DTS ⚡️ Build success in 178ms
DTS dist/index.d.ts 13.00 B
```

### Generated dist files

```
packages/core/dist/
├── index.d.ts       13 B   "export {  }"
├── index.js         68 B   ESM con banner /* @gluezero/core — MIT — ... */
└── index.js.map     69 B   sourcemap
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Aggiunto `"ignoreDeprecations": "6.0"` a packages/core/tsconfig.json**

- **Found during:** Task 2 — `pnpm --filter @gluezero/core build` (DTS phase)
- **Issue:** `pnpm --filter @gluezero/core build` falliva nella fase DTS con `error TS5101: Option 'baseUrl' is deprecated and will stop functioning in TypeScript 7.0`. La fonte non è la nostra `tsconfig.json` (che NON contiene `baseUrl`), ma `tsup@8.5.1`: il file `node_modules/.pnpm/tsup@8.5.1.../tsup/dist/rollup.js` linea 6837 hardcoda `baseUrl: compilerOptions.baseUrl || "."` quando configura il rollup-plugin-dts internamente. TypeScript 6.0.3 promuove `baseUrl` da deprecation warning ad errore hard quando processa il config rollup.
- **Fix:** Aggiunto `"ignoreDeprecations": "6.0"` a `packages/core/tsconfig.json#compilerOptions`. È la fix raccomandata dal compiler stesso (vedi messaggio TS6101 e https://aka.ms/ts6). Comportamento atteso: silenziare il deprecation per tutto il sub-tree TS finché tsup non riceve fix upstream.
- **Files modified:** `packages/core/tsconfig.json`
- **Commit:** `d6004c7`
- **Note:** Da rimuovere quando una di queste tre condizioni si avvera: (a) tsup pubblica fix upstream (rimuove l'iniezione automatica di baseUrl); (b) si migra a `unbuild`/`tshy`/altro builder; (c) si scende a TypeScript 5.9 (sconsigliato — perderemmo `isolatedDeclarations` migliorato di 6.0).

**2. [Rule 3 - Blocking] Aggiunto `--passWithNoTests` agli script test/test:coverage**

- **Found during:** Task 2 — `pnpm --filter @gluezero/core test`
- **Issue:** Vitest 4.1.5 esce con codice 1 (NON 0 come affermato in `01-RESEARCH.md` e nel plan) quando `include: ['src/**/*.test.ts']` non matcha alcun file. Output: `No test files found, exiting with code 1` → `ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL`. L'acceptance criterion del Task 2 dichiara esplicitamente "Comando `pnpm --filter @gluezero/core test` esce 0".
- **Fix:** Aggiornati `scripts.test` da `vitest run` a `vitest run --passWithNoTests` e `scripts.test:coverage` da `vitest run --coverage` a `vitest run --coverage --passWithNoTests`. È il flag Vitest standard per consentire CI verde durante early bootstrap (zero test files = OK). Convenzione documentata su https://vitest.dev/guide/cli.html.
- **Files modified:** `packages/core/package.json`
- **Commit:** `d6004c7`
- **Note:** Da rimuovere quando i plan 03+ aggiungeranno test reali. A quel punto, mantenere `--passWithNoTests` mascherrebbe regressioni dove i pattern di include non matchano i file test (es. errori di refactor che spostano `*.test.ts` fuori da `src/`). Senza il flag, zero test files = exit 1 = CI rosso = catch immediato.

### Auto-added Critical Functionality

Nessuna — il plan era completo come specificato, le 2 deviazioni sopra sono Rule 3 (blocking) non Rule 2 (missing functionality).

### Architectural Decisions

Nessuna — nessuna deviation Rule 4 incontrata.

## Authentication Gates

Nessun auth gate incontrato durante l'esecuzione (nessuna interazione npm/git remote/cloud richiesta in Task 1 o Task 2).

## Warning Non-Bloccanti

```
Ignored build scripts: esbuild@0.27.7, esbuild@0.28.0, msw@2.13.6.
Run "pnpm approve-builds" to pick which dependencies should be allowed to run scripts.
```

Comportamento atteso pnpm 10.x default secure-by-default. Non bloccante: tsup ha funzionato correttamente nonostante esbuild non abbia eseguito il post-install (esbuild include i binari pre-compilati). Approvazione esplicita rimandata se serve in plan futuri (CACHE-01 o WK-01 potrebbero richiederla).

```
Generated an empty chunk: "index".
```

Atteso: `src/index.ts` contiene solo `export {}` placeholder, quindi tsup genera chunk vuoto. Plan 08 popolerà `index.ts` con i re-export pubblici e questo warning sparirà.

## Threat Surface Scan

Nessuna nuova trust boundary o surface security-relevant introdotta oltre a quelle già documentate nel `<threat_model>` del plan (T-02-01..T-02-06). Mitigazioni applicate:

- **T-02-01** (dual-package hazard ESM+CJS): `format: ['esm']` solo in `tsup.config.ts` ✓; nessun output CJS
- **T-02-02** (`dist/` espone file non destinati al pubblico): `files: ["dist", "README.md", "LICENSE"]` in `package.json` ✓; `tsup entry: ['src/index.ts']` solo (no glob) ✓
- **T-02-03** (bundle ingrassa con polyfill Node): `external: [/^node:/]` in `tsup.config.ts` ✓; `platform: 'browser'` ✓
- **T-02-04** (versione runtime dep diversa al consumer): `save-exact=true` in `.npmrc` (ereditato da plan 01) ✓; `pnpm-lock.yaml` committato ✓; `nanoid: "5.1.9"` esatto (no caret/tilde) ✓; `valibot: "1.3.1"` esatto ✓
- **T-02-05** (TypeScript declarations leak `any`): `noExplicitAny: error` in `biome.json` (plan 01) ✓; tsconfig strict completo ereditato da `tsconfig.base.json` (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noImplicitReturns`, `noPropertyAccessFromIndexSignature`) ✓
- **T-02-06** (coverage threshold troppo alto blocca CI): 90/85/90/90 sane default applicati in `vitest.config.ts` ✓; rilassabile in plan 09/10 se misurazione mostra over-engineering — accept disposition mantenuta

## Ready For

**Plan 03** (Wave 2 — types pubblici): definizione di `src/types/` con `BrokerEvent`, `EventSource`, `Subscription`, `BrokerError`, `BrokerLogger`, `EventTap`, `PipelineStep`, `PipelineSnapshot`, `BrokerConfig`, `LogLevel`, `DeliveryMode`, `Priority`, `EventId`, `DeepReadonly`, `ErrorCategory`, `PluginContext`, `PluginState`, `PluginDescriptor`. La pipeline build/test/typecheck è verde — qualunque type definito in plan 03 verrà compilato da `tsup` e generato come `dist/index.d.ts` rollupato (PKG-04 confermato funzionante).

## Self-Check: PASSED

**Files verified (created):**
- FOUND: `packages/core/package.json`
- FOUND: `packages/core/tsconfig.json`
- FOUND: `packages/core/tsup.config.ts`
- FOUND: `packages/core/vitest.config.ts`
- FOUND: `packages/core/README.md`
- FOUND: `packages/core/src/index.ts`

**Files verified (modified):**
- FOUND: `pnpm-lock.yaml` (sezione `packages/core` con nanoid@5.1.9 + valibot@1.3.1 + devDeps)

**Build artifacts verified (gitignored, regenerable):**
- FOUND: `packages/core/dist/index.js` (68 B ESM)
- FOUND: `packages/core/dist/index.d.ts` (13 B declaration)
- FOUND: `packages/core/dist/index.js.map` (69 B sourcemap)

**Commits verified:**
- FOUND: `6de9f41` (feat(01-02): configura @gluezero/core con package.json + tsconfig + tsup + README)
- FOUND: `d6004c7` (feat(01-02): aggiunge vitest config + src/index.ts placeholder + installa runtime deps)
