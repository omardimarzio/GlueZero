---
phase: 01-core-essenziale
plan: 01
subsystem: monorepo-bootstrap
tags:
  - monorepo
  - bootstrap
  - tooling
  - pnpm
  - biome
  - changesets
dependency-graph:
  requires: []
  provides:
    - workspace-root
    - tooling-base-config
    - placeholder-packages
  affects:
    - all-future-phases
tech-stack:
  added:
    - pnpm@10.33.2 (via corepack)
    - typescript@6.0.3
    - "@biomejs/biome@2.4.13"
    - "@changesets/cli@2.31.0"
    - vitest@4.1.5
    - "@vitest/browser@4.1.5"
    - playwright@1.59.1
    - jsdom@29.1.0
    - happy-dom@20.9.0
    - msw@2.13.6
    - tsup@8.5.1
    - typedoc@0.28.19
    - publint@0.3.18
    - "@arethetypeswrong/cli@0.18.2"
    - size-limit@12.1.0
    - "@size-limit/preset-small-lib@12.1.0"
  patterns:
    - monorepo-pnpm-workspaces
    - placeholder-private-packages
    - root-orchestrator-scripts
key-files:
  created:
    - package.json
    - pnpm-workspace.yaml
    - .npmrc
    - .gitignore
    - tsconfig.base.json
    - biome.json
    - .changeset/config.json
    - .changeset/README.md
    - pnpm-lock.yaml
    - packages/mapper/package.json
    - packages/mapper/README.md
    - packages/gateway/package.json
    - packages/gateway/README.md
    - packages/routing/package.json
    - packages/routing/README.md
    - packages/worker/package.json
    - packages/worker/README.md
    - packages/cache/package.json
    - packages/cache/README.md
    - packages/devtools/package.json
    - packages/devtools/README.md
    - packages/gluezero/package.json
    - packages/gluezero/README.md
  modified: []
decisions:
  - "Aggiunto flag `--if-present` agli script root build/test/test:watch/typecheck per evitare ERR_PNPM_RECURSIVE_RUN_NO_SCRIPT su placeholder senza scripts (pnpm 10.x è più strict del comportamento documentato in RESEARCH)."
  - "Pattern Biome `ignore` semplificati a `!**/dist`/`!**/node_modules`/`!**/coverage` (rimosso trailing `/**`) per conformità a regola useBiomeIgnoreFolder introdotta in Biome 2.2.0."
metrics:
  duration: "4m 14s"
  completed: "2026-04-28T12:06:53Z"
  tasks_completed: 3
  files_created: 23
  files_modified: 0
  commits: 3
---

# Phase 1 Plan 01: Bootstrap monorepo + tooling root Summary

Bootstrap del monorepo `pnpm` workspaces con TypeScript 6.0.3 strict + isolatedDeclarations, Biome 2.4.13 lint/format, Changesets 2.31.0 versioning; 8 directory di package create (core + 7 placeholder privati); 355 dipendenze installate via corepack-managed pnpm.

## Objective Achieved

L'obiettivo del plan 01-01 è stato raggiunto integralmente: il workspace `pnpm` è inizializzato, i 7 sotto-pacchetti `@gluezero/{mapper, gateway, routing, worker, cache, devtools}` + aggregato `@gluezero/gluezero` esistono come placeholder privati, `packages/core/` è scaffoldato (riservato a Plan 02 per la configurazione completa), il tooling root (TS, Biome, Changesets, Vitest, tsup, ecc.) è installato con versioni esatte, `pnpm biome check .` esce 0 e `pnpm typecheck` esce 0.

## Tasks Executed

| # | Name | Commit | Status |
|---|------|--------|--------|
| 1 | Bootstrap pnpm + monorepo root files | `3a7d9fd` | done |
| 2 | Scaffold dei 7 sub-package + aggregato | `3b46294` | done |
| 3 | Configurare Biome 2.4.13, Changesets 2.31.0 e installare devDeps root | `de3e16b` | done |

## Files Created

**Root (5 file):**
- `package.json` — workspace orchestrator con 15 devDeps lockate (TypeScript 6.0.3, tsup 8.5.1, Vitest 4.1.5, @vitest/browser 4.1.5, Playwright 1.59.1, jsdom 29.1.0, happy-dom 20.9.0, msw 2.13.6, typedoc 0.28.19, publint 0.3.18, @arethetypeswrong/cli 0.18.2, size-limit 12.1.0, @size-limit/preset-small-lib 12.1.0, @biomejs/biome 2.4.13, @changesets/cli 2.31.0)
- `pnpm-workspace.yaml` — workspace declaration `packages/*`
- `.npmrc` — `auto-install-peers=true`, `prefer-workspace-packages=true`, `shared-workspace-lockfile=true`, `save-exact=true`
- `.gitignore` — `node_modules`, `dist`, `coverage`, `.DS_Store`, log patterns
- `tsconfig.base.json` — target ES2022, strict, isolatedDeclarations, verbatimModuleSyntax, noUncheckedIndexedAccess, exactOptionalPropertyTypes, moduleResolution Bundler

**Tooling config (3 file):**
- `biome.json` — schema 2.4.13, `noExplicitAny: error`, `useImportType: error`, `useConsistentArrayType: shorthand`, formatter (single quote, semicolons asNeeded, trailing commas all), `vcs.useIgnoreFile: true`, `assist.actions.source.organizeImports`
- `.changeset/config.json` — `access: public`, `baseBranch: main`, `ignore` list con i 7 placeholder
- `.changeset/README.md` — standard greeter

**Lockfile (1 file):**
- `pnpm-lock.yaml` — 4256 righe, 355 pacchetti risolti (root + workspace placeholder)

**Placeholder packages (14 file):**
- `packages/mapper/{package.json, README.md}` (Phase 2)
- `packages/gateway/{package.json, README.md}` (Phase 3/4)
- `packages/routing/{package.json, README.md}` (Phase 3)
- `packages/worker/{package.json, README.md}` (Phase 5)
- `packages/cache/{package.json, README.md}` (Phase 6)
- `packages/devtools/{package.json, README.md}` (Phase 6)
- `packages/gluezero/{package.json, README.md}` (Phase 2 — aggregato pubblico)

**Directory create:**
- `packages/core/`, `packages/core/src/` (vuote, riservate a Plan 02)
- `packages/{mapper,gateway,routing,worker,cache,devtools,sembridge}/src/` (vuote)

Totale: **23 file committati**, **9 directory** create.

## Versions Installed (verified live 2026-04-28)

| Tool | Atteso | Installato | Verifica |
|------|--------|------------|----------|
| pnpm | 10.33.2 | 10.33.2 | `pnpm --version` |
| TypeScript | 6.0.3 | 6.0.3 | `pnpm tsc --version` → "Version 6.0.3" |
| Biome | 2.4.13 | 2.4.13 | `pnpm biome --version` → "Version: 2.4.13" |
| Changesets | 2.31.0 | 2.31.0 | `pnpm changeset --version` → "2.31.0" |
| Vitest | 4.1.5 | 4.1.5 | `pnpm vitest --version` → "vitest/4.1.5 darwin-arm64 node-v24.1.0" |

## Verification Results

- [x] `pnpm install` completa senza errori bloccanti (7.4s, 355 pacchetti, +15 devDeps root)
- [x] `pnpm biome check .` exit 0 (13 file controllati, 0 errori)
- [x] `pnpm typecheck` exit 0 (con `--if-present`, scope 7/8 workspace projects, nessuno script trovato → skip silenzioso)
- [x] `pnpm --version` stampa esattamente `10.33.2`
- [x] `pnpm biome --version` stampa esattamente `2.4.13`
- [x] `pnpm tsc --version` inizia con `Version 6.0.3`
- [x] `pnpm vitest --version` inizia con `vitest/4.1.5`
- [x] 8 directory `packages/<pkg>/` esistono (core, mapper, gateway, routing, worker, cache, devtools, sembridge)
- [x] 7 placeholder package hanno `package.json` privati e README; nessun `packages/core/package.json` (Plan 02)
- [x] `tsconfig.base.json` contiene `isolatedDeclarations`, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- [x] `biome.json` riferisce schema 2.4.13 (NON 1.9.4 — anti-regressione)
- [x] `.changeset/config.json` ignora i 7 placeholder (`@gluezero/{mapper,gateway,routing,worker,cache,devtools,sembridge}`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Biome auto-format applicato a 8 file**

- **Found during:** Task 3 — `pnpm biome check .`
- **Issue:** Configurazioni esatte copiate da `01-RESEARCH.md` non rispettavano alcune regole runtime di Biome 2.4.13:
  - `biome.json`: pattern ignore con trailing `/**` (`!**/dist/**`, `!**/node_modules/**`, `!**/coverage/**`) generavano lint error `useBiomeIgnoreFolder` (regola introdotta in Biome 2.2.0).
  - 7 placeholder `package.json`: array `"files": ["dist", "README.md"]` su una riga generava format error (regola JSON formatter Biome che richiede array multi-elemento su righe separate quando supera la lineWidth interna o per coerenza estetica).
- **Fix:** Eseguito `pnpm biome check --write .` che ha auto-fixato tutti gli 8 file:
  - `biome.json`: `!**/dist/**` → `!**/dist`, `!**/node_modules/**` → `!**/node_modules`, `!**/coverage/**` → `!**/coverage`.
  - 7 `package.json`: array `files` riformattato su righe multiple.
- **Files modified:** `biome.json`, `packages/{mapper,gateway,routing,worker,cache,devtools,sembridge}/package.json`
- **Commit:** `de3e16b`

**2. [Rule 3 - Blocking] Aggiunto `--if-present` agli script workspace root**

- **Found during:** Task 3 — `pnpm typecheck` post-install
- **Issue:** `pnpm -r --filter='./packages/*' run typecheck` falliva con `ERR_PNPM_RECURSIVE_RUN_NO_SCRIPT` (exit 1) perché nessuno dei 7 placeholder ha uno script `typecheck`. RESEARCH.md affermava "atteso, non un errore — pnpm salta con warning", ma pnpm 10.33.2 in modalità `run` (non `exec`) considera lo script-missing come errore bloccante.
- **Fix:** Aggiunto flag `--if-present` agli script root `build`, `test`, `test:watch`, `typecheck` in `package.json`. Il flag fa sì che pnpm salti silenziosamente i package senza lo script, exit 0.
- **Files modified:** `package.json`
- **Commit:** `de3e16b`
- **Note:** `lint` / `format` / `ci:*` non richiedono `--if-present` perché `lint` e `format` invocano Biome direttamente alla root; `ci:publint` / `ci:attw` usano `exec` (non `run`) che non triggera l'errore.

### Auto-added Critical Functionality

Nessuna — il plan era completo come specificato.

### Architectural Decisions

Nessuna — nessun deviation Rule 4 incontrata.

## Authentication Gates

Nessun auth gate incontrato durante l'esecuzione (nessuna interazione con npm/git remote/cloud richiesta).

## Warning Non-Bloccanti durante `pnpm install`

```
Ignored build scripts: esbuild@0.27.7, esbuild@0.28.0, msw@2.13.6.
Run "pnpm approve-builds" to pick which dependencies should be allowed to run scripts.
```

Comportamento atteso di pnpm 10.x (default secure-by-default che richiede explicit approval per gli install scripts). Non bloccante in questa fase — esbuild è usato come dipendenza di tsup (build tool, non runtime), msw è usato per test mocking. La approvazione esplicita può essere fatta in Plan 02 quando `@gluezero/core` configura `tsup.config.ts` se serve runtime esbuild.

## Threat Surface Scan

Nessuna nuova trust boundary o surface security-relevant introdotta oltre a quelle già documentate nel `<threat_model>` del plan (T-01-01 supply chain, T-01-02 phantom deps, T-01-03 accidental publish, T-01-04 tsconfig misconfig, T-01-05 import path spoofing). Mitigazioni applicate:
- T-01-01: `save-exact=true` in `.npmrc` ✓; `pnpm-lock.yaml` committato ✓
- T-01-02: pnpm strict hoisting attivo (default pnpm 10) ✓; `prefer-workspace-packages=true` ✓
- T-01-03: tutti i 7 placeholder hanno `"private": true` ✓; ignore list in `.changeset/config.json` ✓
- T-01-05: `pnpm-workspace.yaml` definisce `packages/*` come unica scope ✓

## Ready For

**Plan 02** (`@gluezero/core` package config): configurazione completa di `packages/core/` con `package.json` (runtime deps: nanoid, valibot), `tsconfig.json` (extends `../../tsconfig.base.json`), `tsup.config.ts`, `vitest.config.ts`, `.size-limit.json`. Stub iniziale di `src/index.ts` per validare il pipeline build/test/lint sul primo package reale.

## Self-Check: PASSED

**Files verified:**
- FOUND: `package.json`
- FOUND: `pnpm-workspace.yaml`
- FOUND: `.npmrc`
- FOUND: `.gitignore`
- FOUND: `tsconfig.base.json`
- FOUND: `biome.json`
- FOUND: `.changeset/config.json`
- FOUND: `.changeset/README.md`
- FOUND: `pnpm-lock.yaml`
- FOUND: `packages/mapper/package.json`, `packages/mapper/README.md`
- FOUND: `packages/gateway/package.json`, `packages/gateway/README.md`
- FOUND: `packages/routing/package.json`, `packages/routing/README.md`
- FOUND: `packages/worker/package.json`, `packages/worker/README.md`
- FOUND: `packages/cache/package.json`, `packages/cache/README.md`
- FOUND: `packages/devtools/package.json`, `packages/devtools/README.md`
- FOUND: `packages/gluezero/package.json`, `packages/gluezero/README.md`

**Commits verified:**
- FOUND: `3a7d9fd` (feat(01-01): bootstrap pnpm 10.33.2 + monorepo root files)
- FOUND: `3b46294` (feat(01-01): scaffold 7 sub-package placeholder + aggregato)
- FOUND: `de3e16b` (chore(01-01): configura Biome 2.4.13 + Changesets 2.31.0 e installa devDeps root)
