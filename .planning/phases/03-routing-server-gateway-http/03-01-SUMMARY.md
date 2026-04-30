---
phase: 03-routing-server-gateway-http
plan: 01
subsystem: bootstrap
tags:
  - bootstrap
  - routing-package
  - gateway-package
  - foundation
  - phase-3-gate
  - subpath-exports
dependency-graph:
  requires:
    - "@sembridge/core@workspace (Phase 1)"
    - "@sembridge/mapper@workspace (Phase 2)"
    - "tsconfig.base.json (root)"
    - "pnpm-workspace.yaml (packages/*)"
  provides:
    - "@sembridge/routing buildable + linkato workspace (placeholder skeleton)"
    - "@sembridge/gateway buildable con SUBPATH EXPORTS (./http) multi-entry"
    - "Bundle budget 6 KB / 8 KB gzip configurati per CI gate plan 03-14"
    - "sideEffects array per anti tree-shaking di future augment.ts (plan 03-03 / 03-04)"
  affects:
    - "package.json root (size-limit array esteso da 2 a 4 entries)"
    - "pnpm-lock.yaml (workspace deps risolte)"
tech-stack:
  added:
    - "valibot 1.3.1 (transitivamente già presente da F2)"
    - "nanoid 5.1.9 (transitivamente già presente da F2)"
  patterns:
    - "Subpath exports (./http vs ./sse-ws Phase 4)"
    - "Multi-entry tsup (index + http/index)"
    - "sideEffects array pattern S1 (PATTERNS.md) — anti tree-shaking augment.ts"
    - "Workspace pnpm symlink @sembridge/core + @sembridge/mapper"
key-files:
  created:
    - "packages/routing/tsup.config.ts"
    - "packages/routing/tsconfig.json"
    - "packages/routing/vitest.config.ts"
    - "packages/routing/src/index.ts"
    - "packages/gateway/tsup.config.ts"
    - "packages/gateway/tsconfig.json"
    - "packages/gateway/vitest.config.ts"
    - "packages/gateway/src/index.ts"
    - "packages/gateway/src/http/index.ts"
  modified:
    - "packages/routing/package.json (placeholder F1 → bootstrap F3 completo)"
    - "packages/routing/README.md (placeholder F1 → README italiano F3)"
    - "packages/gateway/package.json (placeholder F1 → bootstrap F3 con subpath exports)"
    - "packages/gateway/README.md (placeholder F1 → README italiano F3)"
    - "package.json (size-limit esteso con 2 nuove entries F3)"
    - "pnpm-lock.yaml (workspace risoluzione aggiornata)"
decisions:
  - "Replica precisa struttura @sembridge/mapper per @sembridge/routing (D-93 augment pattern)"
  - "Multi-entry tsup per @sembridge/gateway: separazione dist/index.js (umbrella) + dist/http/index.js (subpath F3) per dependency boundary chiaro F3 vs F4"
  - "Bundle budget RAISED da 5/6 KB iniziale a 6/8 KB per F2 lesson learned (mapper 5 KB stimato → 9.68 KB reale → raised 12 KB)"
  - "sideEffects array a 4 path (./dist/augment.js + ./src/augment.ts + glob **/) per double-safety anti tree-shaking in tutti i bundler consumer"
  - "Versioni dep 1:1 con @sembridge/mapper: nanoid 5.1.9, valibot 1.3.1, tsup 8.5.1, vitest 4.1.5, typescript 6.0.3, jsdom 29.1.0"
metrics:
  duration: "~4 minuti"
  tasks_completed: 3
  files_created: 9
  files_modified: 6
  completed_date: "2026-04-30"
---

# Phase 03 Plan 01: Bootstrap Routing + Gateway Packages Summary

Bootstrap dei package `@sembridge/routing` e `@sembridge/gateway` come fondazione di Phase 3: replica della struttura proven `@sembridge/mapper` (F2) con `sideEffects` array per i futuri `augment.ts`, dipendenze workspace su `@sembridge/core` E `@sembridge/mapper`, e SUBPATH EXPORTS multi-entry per separare HTTP (F3) da SSE/WebSocket (F4).

## Cosa è stato fatto

### Task 1: `@sembridge/routing` config + README + index skeleton

Sostituito il placeholder F1 plan 01-01 con il bootstrap F3 completo:

- **`packages/routing/package.json`** — `@sembridge/routing@0.0.0`, `type: module`, exports `.` con `types`+`import`, `sideEffects` array a 4 path per anti tree-shaking, deps workspace `@sembridge/core` + `@sembridge/mapper`, scripts (build/test/test:watch/test:coverage/typecheck/clean) allineati 1:1 al mapper.
- **`packages/routing/tsup.config.ts`** — single-entry `{ index: 'src/index.ts' }`, format `esm`, `dts: true`, `sourcemap: true`, `clean: true`, `target: 'es2022'`, `platform: 'browser'`, `treeshake: true`, `external: [/^node:/, '@sembridge/core', '@sembridge/mapper']`, banner MIT.
- **`packages/routing/tsconfig.json`** — `extends: '../../tsconfig.base.json'`, `outDir: './dist'`, `rootDir: './src'`, `lib: ["ES2022", "DOM", "DOM.Iterable"]`, `ignoreDeprecations: '6.0'`.
- **`packages/routing/vitest.config.ts`** — `name: '@sembridge/routing'`, `environment: 'jsdom'`, coverage v8 con thresholds 90/85/90/90, exclude `src/index.ts`.
- **`packages/routing/README.md`** italiano — sezioni: titolo + tagline, Stato, Cosa contiene (RouteDefinition discriminata + RouteResolver + RouteExecutor + RouterBroker + multipleRoutes policies + pipeline §28 step 7-full/8/9/10), Vincolo D-83 (zero modifiche a F1/F2 runtime), Documentazione (PRD §17/§28), Licenza MIT.
- **`packages/routing/src/index.ts`** — `@packageDocumentation` con header completo (PRD §17, D-83, D-93/D-94/D-95), commenti che indicano cosa popoleranno i plan 03-02/03-03/03-12, `export {}` per modularità ESM.

**Verification:**
- `pnpm --filter @sembridge/routing build` → `dist/index.js` (68 B) + `dist/index.d.ts` (13 B) ✅
- `pnpm --filter @sembridge/routing typecheck` → 0 errori ✅
- `pnpm --filter @sembridge/routing test --passWithNoTests` → exit 0 ✅

**Commit:** `0e03e88` — `feat(03-01): bootstrap @sembridge/routing package config + skeleton`

### Task 2: `@sembridge/gateway` con SUBPATH EXPORTS multi-entry

Sostituito il placeholder F1 con il bootstrap F3+F4-ready:

- **`packages/gateway/package.json`** — `@sembridge/gateway@0.0.0`, exports estesi:
  ```json
  {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./http": { "types": "./dist/http/index.d.ts", "import": "./dist/http/index.js" },
    "./package.json": "./package.json"
  }
  ```
  Stesso `sideEffects` array di routing, deps workspace `@sembridge/core` + `@sembridge/mapper`, scripts identici.
- **`packages/gateway/tsup.config.ts`** — **MULTI-ENTRY** `{ index: 'src/index.ts', 'http/index': 'src/http/index.ts' }`, stessi setting di routing (esm + dts + treeshake + esterni).
- **`packages/gateway/tsconfig.json` + `vitest.config.ts`** — replica struttura mapper (`name: '@sembridge/gateway'`, exclude `src/index.ts` + `src/http/index.ts` da coverage perché barrel).
- **`packages/gateway/README.md`** italiano — sezioni: Stato F3+F4, Subpath exports con esempio `import from '@sembridge/gateway/http'`, Cosa contiene F3 (HttpGateway policy chain + 7 Strategy primitives + URL allowlist + Retry-After parser), Vincolo D-83, Documentazione (PRD §18/§23/§26), Licenza MIT.
- **`packages/gateway/src/index.ts`** umbrella + **`packages/gateway/src/http/index.ts`** subpath HTTP, entrambi con `@packageDocumentation` italiano dettagliato che cita PRD §18/§23/§26, D-68/D-69/D-70/D-71/D-72/D-83 e indica cosa popoleranno i plan 03-04 e 03-08+.

**Verification:**
- `pnpm --filter @sembridge/gateway build` → `dist/index.js` (68 B) + `dist/http/index.js` (68 B) + `.d.ts` (13 B ciascuno) ✅
- `pnpm --filter @sembridge/gateway typecheck` → 0 errori ✅
- `pnpm --filter @sembridge/gateway test --passWithNoTests` → exit 0 ✅
- Workspace symlinks verificati: `packages/{routing,gateway}/node_modules/@sembridge/{core,mapper}` → `../../../core` / `../../../mapper` ✅

**Commit:** `eafab8a` — `feat(03-01): bootstrap @sembridge/gateway con SUBPATH EXPORTS (./http) multi-entry`

### Task 3: size-limit entries root per F3

Esteso `package.json` root da 2 a 4 entries:

```json
{ "name": "@sembridge/routing (gzip)",       "path": "packages/routing/dist/index.js",       "limit": "6 KB", "gzip": true },
{ "name": "@sembridge/gateway/http (gzip)",  "path": "packages/gateway/dist/http/index.js",  "limit": "8 KB", "gzip": true }
```

Entries F1/F2 (`@sembridge/core` 8 KB, `@sembridge/mapper` 12 KB) invariate. Budget RAISED rispetto alla stima iniziale RESEARCH (5/6 KB) per F2 lesson learned (mapper stimato 5 KB → reale 9.68 KB → raised 12 KB). Plan 03-14 verifica e raise se serve.

**Verification:**
- `node -e "..."` programmatic check entries presenti con limiti corretti ✅
- `pnpm exec size-limit` smoke test verde:
  - `@sembridge/core (gzip)`: 6.17 kB / 8 kB
  - `@sembridge/mapper (gzip)`: 11.66 kB / 12 kB
  - `@sembridge/routing (gzip)`: 13 B / 6 kB (skeleton vuoto)
  - `@sembridge/gateway/http (gzip)`: 13 B / 8 kB (skeleton vuoto)

**Commit:** `cefcb9e` — `chore(03-01): aggiunge size-limit entries root per @sembridge/routing (6 KB) e @sembridge/gateway/http (8 KB)`

## Comandi verificati

| Comando | Esito |
|---------|-------|
| `pnpm install` | ✅ 481 pkg risolti, 9 workspace |
| `pnpm --filter @sembridge/routing build` | ✅ dist/index.js + dist/index.d.ts |
| `pnpm --filter @sembridge/routing typecheck` | ✅ 0 errori |
| `pnpm --filter @sembridge/routing test --passWithNoTests` | ✅ no test files, exit 0 |
| `pnpm --filter @sembridge/gateway build` | ✅ multi-entry dist/{index,http/index}.js |
| `pnpm --filter @sembridge/gateway typecheck` | ✅ 0 errori |
| `pnpm --filter @sembridge/gateway test --passWithNoTests` | ✅ no test files, exit 0 |
| `pnpm test` (full repo) | ✅ 248/248 core + 183/183 mapper invariati (D-83 confermato), routing/gateway pass-with-no-tests |
| `pnpm exec size-limit` | ✅ 4 entries verdi |

## Versioni dep installate

Tutte allineate 1:1 con `@sembridge/mapper` (F2 reference):

| Package | Versione |
|---------|----------|
| `@sembridge/core` | `workspace:*` |
| `@sembridge/mapper` | `workspace:*` |
| `nanoid` | `5.1.9` |
| `valibot` | `1.3.1` |
| `tsup` (devDep) | `8.5.1` |
| `typescript` (devDep) | `6.0.3` |
| `vitest` (devDep) | `4.1.5` |
| `jsdom` (devDep) | `29.1.0` |

## Bundle size baseline (per confronto plan 03-14)

| Package | Path | Size attuale | Limit |
|---------|------|--------------|-------|
| `@sembridge/routing` | `packages/routing/dist/index.js` | **13 B** (skeleton vuoto) | 6 KB |
| `@sembridge/gateway/http` | `packages/gateway/dist/http/index.js` | **13 B** (skeleton vuoto) | 8 KB |

Il valore 13 B equivale al banner MIT comment + `export {}`. Cresceranno progressivamente con i plan 03-02..03-13.

## Subpath exports configurati e verificati

`@sembridge/gateway` esposto via 2 subpath:

| Subpath | Path import | Path runtime | Path types | Phase |
|---------|-------------|--------------|------------|-------|
| `.` (umbrella) | `import from '@sembridge/gateway'` | `dist/index.js` | `dist/index.d.ts` | F3+F4 aggregato |
| `./http` | `import from '@sembridge/gateway/http'` | `dist/http/index.js` | `dist/http/index.d.ts` | F3 only |

Verificato:
- File `dist/http/index.js` + `dist/http/index.d.ts` esistono dopo build ✅
- `package.json` exports key `./http` configurato con `types`+`import` ✅
- `tsup.config.ts` entry `'http/index': 'src/http/index.ts'` configurata ✅
- README documenta subpath con esempio `import { createHttpGateway } from '@sembridge/gateway/http'` ✅

Phase 4 aggiungerà subpath `./sse-ws` con stesso pattern (placeholder già documentato in `tsup.config.ts` comment).

## Deviations from Plan

None — plan eseguito esattamente come scritto. Tutti gli acceptance criteria soddisfatti, nessun rule 1/2/3 attivato, nessun rule 4 hit.

## Self-Check: PASSED

**File creati verificati:**
- `packages/routing/tsup.config.ts` ✅
- `packages/routing/tsconfig.json` ✅
- `packages/routing/vitest.config.ts` ✅
- `packages/routing/src/index.ts` ✅
- `packages/gateway/tsup.config.ts` ✅
- `packages/gateway/tsconfig.json` ✅
- `packages/gateway/vitest.config.ts` ✅
- `packages/gateway/src/index.ts` ✅
- `packages/gateway/src/http/index.ts` ✅

**File modificati verificati:**
- `packages/routing/package.json` ✅
- `packages/routing/README.md` ✅
- `packages/gateway/package.json` ✅
- `packages/gateway/README.md` ✅
- `package.json` ✅
- `pnpm-lock.yaml` ✅

**Commit verificati in `git log --oneline`:**
- `0e03e88` Task 1 ✅
- `eafab8a` Task 2 ✅
- `cefcb9e` Task 3 ✅

**Build artifacts verificati:**
- `packages/routing/dist/index.js` + `index.d.ts` ✅
- `packages/gateway/dist/index.js` + `index.d.ts` ✅
- `packages/gateway/dist/http/index.js` + `index.d.ts` ✅

**No regressions:** core 248/248 + mapper 183/183 test invariati (D-83 confermato).
