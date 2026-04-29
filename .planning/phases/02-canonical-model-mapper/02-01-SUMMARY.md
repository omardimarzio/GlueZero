---
phase: 02-canonical-model-mapper
plan: 01
subsystem: build-foundation
tags: [bootstrap, mapper-package, foundation, phase-2-gate, monorepo, pnpm-workspace, valibot, sideEffects]

# Dependency graph
requires:
  - phase: 01-core-essenziale
    provides: "@sembridge/core buildato + workspace pnpm + tsconfig.base.json + biome.json + size-limit + tsup/vitest setup pattern"
provides:
  - "Package @sembridge/mapper buildable + testable + typed-checked (placeholder runtime, dist artifact valido)"
  - "Workspace link @sembridge/core: workspace:* attivo per import cross-package F2 successivi"
  - "Coverage v8 disponibile (chiude open item F1, abilita D-55)"
  - "Size-limit root con 2 entry (core 8 KB + mapper 5 KB)"
  - "README skeleton mapper italiano (preparazione DOC-03 finale al plan 02-12)"
  - "Side-effects array preserva augment.ts dal tree-shaker (Rule 4 PATTERNS.md §6 — abilita declaration merging F2)"
affects: [02-02-types-pubblici, 02-03-canonical-registry, 02-04-alias-registry, 02-05-transform-pipeline, 02-06-valibot-adapter, 02-07-mapper-engine, 02-08-broker-wrapper, 02-09-augment, 02-10-integration-tests, 02-11-cycle-detection, 02-12-final-gate-DOC-03]

# Tech tracking
tech-stack:
  added: ["@vitest/coverage-v8 4.1.5 (devDep root)"]
  patterns: ["sideEffects array per declaration merging file (./dist/augment.js)", "external @sembridge/core nel tsup (peer-like, monorepo workspace protocol)", "scripts/dependencies/devDependencies allineate F1 esattamente per consistency"]

key-files:
  created:
    - "packages/mapper/tsconfig.json (replica esatta core, eredita tsconfig.base.json)"
    - "packages/mapper/tsup.config.ts (replica core con external @sembridge/core)"
    - "packages/mapper/vitest.config.ts (name @sembridge/mapper + coverage v8 thresholds 90/85/90/90)"
    - "packages/mapper/src/index.ts (barrel skeleton con @packageDocumentation header italiano)"
  modified:
    - "packages/mapper/package.json (placeholder F1 → package buildable F2 con deps + scripts + sideEffects array + size-limit)"
    - "packages/mapper/README.md (placeholder F1 → skeleton italiano con sezioni Stato/Cosa contiene/Vincolo D-49/Documentazione)"
    - "package.json root (devDep @vitest/coverage-v8 + size-limit entry mapper 5 KB)"
    - "pnpm-lock.yaml (workspace link + coverage-v8)"

key-decisions:
  - "sideEffects: ['./dist/augment.js'] (array, Rule 4 PATTERNS.md §6) — preserva il side-effect di augment.ts (declaration merging) dal tree-shaker, mantenendo tree-shaking del resto"
  - "tsup external: [/^node:/, '@sembridge/core'] (peer-like) — non bundla @sembridge/core dentro mapper, usa workspace protocol pnpm per il link runtime"
  - "size-limit budget mapper 5 KB gzip (vs 8 KB core) — +2 KB headroom per mapper engine + registries previsti da PATTERNS.md §3.1"
  - "valibot 1.3.1 come dep mapper (versione locked F1, D-37 default validator F2)"
  - "@vitest/coverage-v8 4.1.5 versione allineata a vitest 4.1.5 (vincolo plugin Vitest)"

patterns-established:
  - "Pattern bootstrap nuovo package monorepo: replica esatta dei 4 file config @sembridge/core (package.json, tsup.config.ts, tsconfig.json, vitest.config.ts) con 3 diff puntuali (name, sideEffects, external) — riusabile per @sembridge/{gateway, routing, worker, cache, devtools} in F3-F6"
  - "Pattern barrel index.ts skeleton: header @packageDocumentation italiano + commenti placeholder per export futuri + empty `export {}` per dist valido buildable (chiude open item TS18003 'No inputs found' su src/ vuoto)"
  - "Pattern README skeleton ordinato: Stato → Cosa contiene → Vincolo architetturale → Documentazione → Licenza (preparazione DOC finale al plan finale di fase)"

requirements-completed: [PKG-01, PKG-02, PKG-03, DOC-03]

# Metrics
duration: 24min
completed: 2026-04-29
---

# Phase 2 Plan 01: Bootstrap @sembridge/mapper Summary

**Package @sembridge/mapper passa da placeholder F1 (18 LOC, src vuoto) a package buildable+testable+typed-checked, con workspace link a @sembridge/core, coverage v8 abilitata, e size-limit budget 5 KB gzip — pronto per popolamento moduli da plan 02-02 a 02-12.**

## Performance

- **Duration:** ~24 min
- **Started:** 2026-04-29T08:45:43Z
- **Completed:** 2026-04-29T09:09:40Z
- **Tasks:** 2/2 completed
- **Files modified:** 4 nuovi + 3 modificati + pnpm-lock.yaml = 8 file

## Accomplishments
- 4 file config (`package.json`, `tsup.config.ts`, `tsconfig.json`, `vitest.config.ts`) per `@sembridge/mapper` allineati esattamente a `@sembridge/core` (replica D-15 frozen reference Phase 1)
- Workspace link `@sembridge/core: workspace:*` attivo (verificato da `pnpm install` exit 0)
- `@vitest/coverage-v8: 4.1.5` installato come devDep root → chiude open item F1, abilita D-55 (coverage measurement F2 finale plan 02-12)
- Size-limit root con 2 entry attive (core 8 KB + mapper 5 KB), pronto per `pnpm ci:size` esteso a mapper in plan 02-12
- README mapper skeleton in italiano scritto (preparazione DOC-03 — completamento al plan 02-12 con scenario meteo end-to-end)
- Build/test/typecheck mapper exit 0 con artifact dist (`dist/index.js` 68 B, `dist/index.d.ts` 13 B); core 248/248 test invariati (no regression)

## Task Commits

Each task was committed atomically (no TDD: questo è un bootstrap di config, non implementation):

1. **Task 1: Replica config @sembridge/core in @sembridge/mapper** — `b200948` (chore)
   - 4 file config creati/modificati: package.json, tsup.config.ts, tsconfig.json, vitest.config.ts
2. **Task 2: Skeleton barrel + README + install workspace deps + size-limit root + coverage v8** — `40d4caf` (chore)
   - src/index.ts skeleton + README italiano + package.json root (devDep + size-limit) + pnpm install (lockfile aggiornato)

**Plan metadata commit:** TBD (docs: complete plan — eseguito alla fine del workflow)

## Files Created/Modified

### Created
- `packages/mapper/tsconfig.json` — replica esatta `packages/core/tsconfig.json`; estende `tsconfig.base.json` con `outDir: ./dist`, `rootDir: ./src`, `lib: [ES2022, DOM, DOM.Iterable]`, `ignoreDeprecations: 6.0`
- `packages/mapper/tsup.config.ts` — replica core con 2 diff: `external: [/^node:/, '@sembridge/core']` (peer-like, evita doppio bundle); `banner` con name `@sembridge/mapper`
- `packages/mapper/vitest.config.ts` — replica core con `name: '@sembridge/mapper'`; jsdom env; coverage v8 thresholds 90/85/90/90
- `packages/mapper/src/index.ts` — barrel skeleton con header `@packageDocumentation` italiano (vincolo lingua CLAUDE.md), commenti placeholder per gli export futuri (CanonicalRegistry/AliasRegistry/TransformPipeline/valibotAdapter/MapperEngine + types), empty `export {}` per soddisfare tsc TS18003 con src altrimenti vuoto

### Modified
- `packages/mapper/package.json` — da placeholder 18 LOC a package buildable F2 (52 LOC):
  - `name: '@sembridge/mapper'`, `version: '0.0.0'`
  - `type: 'module'`, `main`/`module`/`types` puntano a dist
  - `exports` con `'./package.json'` per attw compliance
  - `files: ['dist', 'README.md', 'LICENSE']`
  - `sideEffects: ['./dist/augment.js']` (array — Rule 4 documentato in PATTERNS.md §6)
  - `engines.node: '>=20'`, `publishConfig.provenance: true`
  - `scripts`: `build/test/test:watch/test:coverage/typecheck/clean` identici a core
  - `dependencies`: `@sembridge/core: workspace:*` + `valibot: 1.3.1`
  - `devDependencies`: `tsup 8.5.1`, `typescript 6.0.3`, `vitest 4.1.5`, `jsdom 29.1.0`
  - `size-limit`: 1 entry, budget 5 KB gzip
- `packages/mapper/README.md` — da placeholder F1 (333 byte) a skeleton italiano (sezioni Stato, Cosa contiene, Vincolo architetturale D-49, Documentazione, Licenza)
- `package.json` (root) — aggiunge `@vitest/coverage-v8: 4.1.5` in `devDependencies` + entry size-limit per `@sembridge/mapper (gzip)` con limit 5 KB
- `pnpm-lock.yaml` — aggiornato con `@vitest/coverage-v8` (+ deps transitive `@bcoe/v8-coverage`, `c8`, etc.) e workspace link `@sembridge/core: workspace:*` → `@sembridge/mapper`

## Verification

| Comando | Risultato |
|---------|-----------|
| `pnpm install` | Exit 0; `+ @vitest/coverage-v8 4.1.5`; lockfile aggiornato |
| `pnpm --filter @sembridge/mapper typecheck` | Exit 0 (no errori TS) |
| `pnpm --filter @sembridge/mapper test` | Exit 0 (passWithNoTests; no test files yet — atteso) |
| `pnpm --filter @sembridge/mapper build` | Exit 0; `dist/index.js` 68 B + `dist/index.d.ts` 13 B + sourcemap 69 B |
| `pnpm --filter @sembridge/core test` | Exit 0; **24 test files / 248 test passing** (no regression Phase 1) |
| `pnpm typecheck` (workspace) | Exit 0 (8/9 packages: core + mapper, gli altri 6 sono ancora placeholder F1 senza tsconfig.json — fuori scope) |

## Threat Coverage

| Threat ID | Disposition | Mitigation in commit |
|-----------|-------------|----------------------|
| T-02-01-01 (Tampering — `sideEffects: false` boolean eliminerebbe `augment.ts` da tree-shake) | mitigate | `sideEffects: ['./dist/augment.js']` (array) preserva il file specifico, mantenendo tree-shaking del resto. Verificato in PATTERNS.md §6 e §3.1 (Rule 4 documentato). |
| T-02-01-02 (Repudiation — Build out-of-order mapper-prima-di-core → import error) | mitigate | `pnpm -r --filter='./packages/*' --if-present run build` rispetta dipendenze workspace; `tsup external: '@sembridge/core'` non bundla, `dist/index.js` di mapper risolve a runtime via consumer's node_modules |
| T-02-01-03 (DoS — Coverage v8 plugin overhead a runtime) | accept | Coverage attivo solo in `test:coverage` script; `test` standard non lo invoca |
| T-02-01-04 (Information disclosure — `pnpm-lock.yaml` espone snapshot dependency tree) | accept | Comportamento standard pnpm, file committato come da workflow F1; nessun secret |
| T-02-01-05 (Tampering — `valibot: 1.3.1` divergente da F1 → runtime mismatch) | mitigate | Versione locked identica a F1 (`packages/core/package.json:41`); `pnpm install` deduplicherà l'installazione |

## Deviations from Plan

**None — il plan è stato eseguito esattamente come scritto.** Tutti i 4 file config, il barrel skeleton, il README italiano, le 2 modifiche root, e il `pnpm install` sono usciti exit 0 al primo tentativo. Nessuna deviazione Rule 1/2/3 applicata; nessun checkpoint Rule 4 hit.

**Nota tecnica:** il task 1 specifica un check `pnpm --filter @sembridge/mapper typecheck` exit 0 dopo il primo task. Esecuzione strict del task 1 non è possibile perché `src/` è vuoto e tsc lancia TS18003 ("No inputs were found in config file"). Il task 2 risolve aggiungendo `src/index.ts` con `export {}`, dopodiché il typecheck passa pulito. Comportamento atteso e documentato negli acceptance criteria del task 2.

## Auth Gates

Nessun auth gate — task interamente automatico (config files + pnpm install).

## Open Items / Pronto-per

- ✅ **Closed:** open item F1 "@vitest/coverage-v8 da installare" — risolto in questo plan (devDep root, lockfile aggiornato)
- ✅ **Ready:** plan 02-02 (Public types F2) può ora popolare `packages/mapper/src/types/`
- ✅ **Ready:** plan 02-03/04/05/06 paralleli (canonical-registry, alias-registry, transform-pipeline, valibot-adapter) possono importare da `@sembridge/core` via workspace link
- ⏳ **Pending:** plan 02-09 attiverà `import './augment'` nel barrel quando `augment.ts` esisterà
- ⏳ **Pending:** plan 02-12 estenderà CI gates root (publint/attw/size-limit) anche a `@sembridge/mapper`
- ⏳ **Pending:** README finale DOC-03 con scenario meteo end-to-end al plan 02-12

## Self-Check: PASSED

File create:
- packages/mapper/package.json: FOUND
- packages/mapper/tsup.config.ts: FOUND
- packages/mapper/tsconfig.json: FOUND
- packages/mapper/vitest.config.ts: FOUND
- packages/mapper/src/index.ts: FOUND
- packages/mapper/README.md: FOUND (modificato)
- package.json (root): FOUND (modificato)
- pnpm-lock.yaml: FOUND (modificato)

Commit hash:
- b200948: FOUND (Task 1 — replica config)
- 40d4caf: FOUND (Task 2 — barrel + README + install + size-limit root)
