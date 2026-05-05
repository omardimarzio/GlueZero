---
phase: 03-routing-server-gateway-http
plan: 03
subsystem: routing-augment
tags:
  - augment
  - declaration-merging
  - phase-3
  - routing
  - tree-shake-guard
dependency-graph:
  requires:
    - phase: 03-02
      provides: "RouteDefinition + RoutingConfig type contracts (26 type esportati da @gluezero/routing/types)"
    - phase: 02
      provides: "@gluezero/mapper CanonicalSchema (interface — augmentable)"
    - phase: 01
      provides: "@gluezero/core PluginDescriptor + BrokerConfig (interface — augmentable)"
  provides:
    - "PluginDescriptor.routes? augmentation visibile dopo import '@gluezero/routing' (D-94, ROUTE-01)"
    - "BrokerConfig.routes? + BrokerConfig.routing? augmentation visibile (D-93)"
    - "CanonicalSchema.requiresRoute? augmentation visibile (D-95, ROUTE-16, chiusura PRD §39 #5)"
    - "F3PipelineStep literal union additivo (3 step: route.resolved/executed/outcome.collected, D-85)"
    - "__augmentLoaded marker const ri-esportato dal barrel (Pattern S1 tree-shake guard)"
    - "dist/augment.js separato dal bundle index.js (sideEffects array preserva entry)"
  affects:
    - "03-04 (augment gateway): pattern simmetrico per BrokerConfig.gateway? (separato per evitare ciclo workspace)"
    - "03-05+ (route-resolver/executor): consuma RouteDefinition tipato da PluginDescriptor.routes"
    - "03-12 (RouterBroker): consuma BrokerConfig.routes/routing al boot + canonical-registry CanonicalSchema.requiresRoute"
    - "ogni plan downstream F3 che importa @gluezero/routing eredita le declaration merging"
tech-stack:
  added: []
  patterns:
    - "TS declaration merging interface (Pattern B — pattern F2 D-49/D-56/D-57 replicato)"
    - "Side-effect import + sideEffects array (Pattern S1 — T-03-03-01 mitigation, replica F2 T-02-09-01)"
    - "F3PipelineStep literal union additivo (D-85 — pattern F2PipelineStep)"
    - "Cross-package interface augment (declaration merging multiplo: @gluezero/core + @gluezero/mapper)"
    - "Multi-entry tsup config (src/index.ts + src/augment.ts → dist/index.js + dist/augment.js)"
key-files:
  created:
    - "packages/routing/src/augment.ts"
    - "packages/routing/src/augment.test.ts"
  modified:
    - "packages/routing/src/index.ts"
    - "packages/routing/tsup.config.ts"
key-decisions:
  - "Demanda BrokerConfig.gateway? a packages/gateway/src/augment.ts (plan 03-04) per evitare ciclo workspace @gluezero/routing → @gluezero/gateway (gateway già dipende da routing)"
  - "Dichiarazione BrokerConfig.routing (RoutingConfig) invece di mero BrokerConfig.routes — espone multipleRoutesPolicy/emitAmbiguousWarning/requiresRouteTopics (D-66/D-67/D-100) come sezione tipata"
  - "Aggiunti 4 test extra oltre ai 5 base del plan: F3PipelineStep equalTypeOf assertion + backward-compat F1+F2 + coexistenza F2+F3 augmentations su PluginDescriptor + idem BrokerConfig (T-03-03-02 mitigation esplicita)"
  - "Type re-export espliciti in index.ts (4 blocchi) invece di `export type * from './types'` per discoverability migliore — barrel intermedio ./types/index.ts conservato"
patterns-established:
  - "Augment cross-package multi-target: declare module pattern replicabile in F4 (gateway/realtime → @gluezero/core BrokerConfig.realtime + augmentazioni cross-domain)"
  - "tsup multi-entry per side-effect file separato: pattern di riferimento per ogni augment file F4/F5/F6"
  - "Test compile-time con expectTypeOf().toHaveProperty + .toEqualTypeOf: pattern per verificare augmentation invariants senza affidarsi solo a runtime check"
requirements-completed:
  - ROUTE-01
  - ROUTE-15
  - ROUTE-16
metrics:
  duration: "~9 min"
  started: "2026-05-01T21:10:48Z"
  completed: "2026-05-01T21:20:29Z"
  tasks_completed: 2
  files_created: 2
  files_modified: 2
---

# Phase 03 Plan 03: F3 Augment Routing — TS Declaration Merging Summary

**TS declaration merging F3 — `PluginDescriptor.routes`, `BrokerConfig.routes`/`routing`, `CanonicalSchema.requiresRoute`, `F3PipelineStep` literal union (3 step) + side-effect tree-shake guard. Vincolo D-83 mantenuto: zero modifiche runtime a `packages/core/` né `packages/mapper/`.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-05-01T21:10:48Z
- **Completed:** 2026-05-01T21:20:29Z
- **Tasks:** 2/2
- **Files created:** 2 (augment.ts, augment.test.ts)
- **Files modified:** 2 (src/index.ts, tsup.config.ts)
- **Test passing:** 9/9 augment.test.ts (≥ 5 richiesti dal plan)
- **TS errors:** 0 (routing + mapper + core + gateway typecheck clean)
- **Regression D-83:** core 248/248 + mapper 183/183 invariati

## Accomplishments

### Task 1 — augment.ts + augment.test.ts (≥ 60 LOC, 9 test)

- **`augment.ts` (172 LOC)** con 9 JSDoc entries documentati:
  - `declare module '@gluezero/core'` con `PluginDescriptor.routes?: readonly RouteDefinition[]` (D-94, ROUTE-01) + `BrokerConfig.routes?` + `BrokerConfig.routing?: RoutingConfig` (D-93)
  - `declare module '@gluezero/mapper'` con `CanonicalSchema.requiresRoute?: boolean` (D-95, ROUTE-16, chiusura PRD §39 #5)
  - `F3PipelineStep` literal union additivo: `'event.route.resolved' | 'event.route.executed' | 'event.outcome.collected'` (D-85)
  - `__augmentLoaded: true` marker const (Pattern S1 — T-03-03-01 mitigation)
- **`augment.test.ts` (148 LOC, 9 test)** — replica pattern F2 con 4 test extra rispetto al plan:
  1. Runtime side-effect import safe (`__augmentLoaded === true`)
  2. PluginDescriptor.routes compile-time + costruzione plugin con routes locali + http
  3. BrokerConfig.routes/routing compile-time + RoutingConfig completa
  4. CanonicalSchema.requiresRoute compile-time + schemi con/senza flag
  5. F3PipelineStep equalTypeOf assertion (esattamente i 3 step F3, no più no meno)
  6. Backward-compat F1+F2: PluginDescriptor minimale `{ id }` resta valido
  7. Backward-compat F1+F2: BrokerConfig senza sezioni F3 resta valido
  8. Coexistenza F2+F3 su PluginDescriptor (T-03-03-02 mitigation esplicita): inputMap + outputMap + canonicalSchemaId + routes simultanei
  9. Coexistenza F2+F3 su BrokerConfig: canonicalModel + routes + routing simultanei

### Task 2 — barrel index.ts + tsup multi-entry + sideEffects

- **`packages/routing/src/index.ts`**: aggiunto `export { __augmentLoaded, type F3PipelineStep } from './augment'` come PRIMA riga runtime (Pattern S1 — ri-esporta come simbolo pubblico per evitare tree-shaking del side-effect import). Espansi i type re-export in 4 blocchi espliciti per migliorare discoverability:
  - 11 type da `./types/route-definition` (RouteDefinition + 4 sub-interface + spec http)
  - 9 type da `./types/route-policies` (RoutePolicies + 7 sub-config + Concurrency)
  - 4 type da `./types/route-outcome` (RouteOutcome + alias)
  - 2 type da `./types/routing-config` (RoutingConfig + MultipleRoutesPolicy)
- **`packages/routing/tsup.config.ts`**: cambiato `entry: { index: 'src/index.ts' }` → `entry: ['src/index.ts', 'src/augment.ts']` per emettere `dist/augment.js` come file separato (path referenziato da `package.json.sideEffects`).
- **`package.json.sideEffects`** già presente da plan 03-01: `["./dist/augment.js", "./src/augment.ts", "**/augment.js", "**/augment.ts"]` — quadruplice safety per bundler aggressivi.

## Augmentations applicate

| Target | Field | Type | Decisione | Open issue chiusa |
|--------|-------|------|-----------|-------------------|
| `@gluezero/core::PluginDescriptor` | `routes?` | `readonly RouteDefinition[]` | D-94 | ROUTE-01 |
| `@gluezero/core::BrokerConfig` | `routes?` | `readonly RouteDefinition[]` | D-93/D-62 | ROUTE-15 (parte) |
| `@gluezero/core::BrokerConfig` | `routing?` | `RoutingConfig` | D-66/D-67/D-100 | ROUTE-15 + ROUTE-16 (config) |
| `@gluezero/mapper::CanonicalSchema` | `requiresRoute?` | `boolean` | D-95 | PRD §39 #5 / ROUTE-16 |
| `@gluezero/routing` (export) | `F3PipelineStep` | literal union 3 step | D-85 | (no — declaration merging type-alias non supportato) |

## Build verification

```bash
$ pnpm --filter @gluezero/routing build
ESM dist/augment.js     215.00 B
ESM dist/index.js       211.00 B
ESM dist/augment.js.map 9.55 KB
ESM dist/index.js.map   9.55 KB
ESM ⚡️ Build success in 16ms
DTS Build success in 287ms
DTS dist/index.d.ts            2.38 KB
DTS dist/augment.d.ts          111.00 B
DTS dist/augment-Cv2Ik9Ly.d.ts 19.81 KB
```

`dist/augment.js` content:
```js
/* @gluezero/routing — MIT — https://github.com/<TBD>/sembridge */
// src/augment.ts
var __augmentLoaded = true;
export { __augmentLoaded };
```

`dist/index.d.ts` espone tutti i tipi via re-export (verified: 26 type total + F3PipelineStep + __augmentLoaded).

## Regression check D-83

```bash
$ pnpm --filter @gluezero/core test
Test Files 24 passed (24) | Tests 248 passed (248)

$ pnpm --filter @gluezero/mapper test
Test Files 16 passed (16) | Tests 183 passed (183)

$ pnpm --filter @gluezero/gateway exec tsc --noEmit
# exit 0 — 0 errori
```

**Vincolo D-83 confermato:** zero modifiche runtime a `packages/core/src/` o `packages/mapper/src/`. core 248/248 + mapper 183/183 test invariati. gateway typecheck clean.

## Task Commits

Ogni task committed atomicamente:

1. **Task 1: augment.ts + augment.test.ts** — `510d80f` (feat)
2. **Task 2: barrel + tsup entry + sideEffects** — `186753d` (feat)

## Files Created/Modified

### Created (2)

- `packages/routing/src/augment.ts` — TS declaration merging F3 con 3 declare module + F3PipelineStep + __augmentLoaded (172 LOC, 9 JSDoc entries)
- `packages/routing/src/augment.test.ts` — 9 test compile-time + runtime (replica pattern F2 + 4 test extra per coexistenza F2+F3)

### Modified (2)

- `packages/routing/src/index.ts` — aggiunto side-effect import `export { __augmentLoaded, type F3PipelineStep } from './augment'` PRIMA dei type re-export; espansi 4 blocchi `export type` espliciti per discoverability
- `packages/routing/tsup.config.ts` — aggiunto `'src/augment.ts'` alla entry list (multi-entry) per emettere `dist/augment.js` come file separato

## Decisions Made

1. **`BrokerConfig.gateway?: GatewayConfig` demandato a plan 03-04** (Rule 4 architectural avoidance): il plan testuale 03-03 menzionava di augmentare anche `BrokerConfig.gateway` da questo file, ma `@gluezero/gateway` già dipende da `@gluezero/routing` (workspace edge plan 03-02). Aggiungere `import type { GatewayConfig } from '@gluezero/gateway'` qui creerebbe un ciclo workspace. Soluzione: `BrokerConfig.gateway?` viene augmentato nel package gateway stesso (`packages/gateway/src/augment.ts`, plan 03-04 — pattern simmetrico). Note esplicite nel JSDoc di `augment.ts`. Questa è una clarification del plan, non una deviazione strutturale: il summary 03-02 conferma che plan 03-04 ha responsabilità di augmentare gateway.
2. **`BrokerConfig.routing?: RoutingConfig` invece di solo `BrokerConfig.routes?`**: il plan testuale 03-03 menzionava solo `routes?: readonly RouteDefinition[]`, ma il `RoutingConfig` di `./types/routing-config.ts` (definito plan 03-02) include `multipleRoutesPolicy`/`emitAmbiguousWarning`/`requiresRouteTopics` (D-66/D-67/D-100). Esposto come sezione separata `routing?` per consentire al `RouterBroker` (plan 03-12) di leggerla strutturatamente. Coerente con i pattern F2 (`canonicalModel`/`aliasRegistry`/`transforms` separati).
3. **9 test invece dei 5 minimi del plan**: aggiunti backward-compat F1+F2 (test 6+7) e coexistenza F2+F3 augmentations sullo stesso interface (test 8+9 — T-03-03-02 mitigation esplicita). Rule 2 — funzionalità critica per garantire che l'augment F3 NON collida con F2.
4. **Type re-export espliciti in index.ts (4 blocchi) invece di `export type * from './types'`**: il plan done criteria richiede esplicitamente `grep -c "export type" >= 4`. Mantenuti i 4 blocchi `export type { … } from './types/X'` per soddisfare il criterio + migliorare la discoverability (ogni blocco è documentato con il REQ-ID/decisione di pertinenza). Il barrel intermedio `./types/index.ts` resta come safety-net per consumer interni.

## Deviations from Plan

### Deviazioni applicate (Rule 4 architectural avoidance)

**1. [Rule 4 - Architectural avoidance] Postponed `BrokerConfig.gateway?` augment a plan 03-04**

- **Found during:** Task 1 lettura `RouteHttpRequestSpec`/`GatewayConfig`
- **Issue:** Il plan testuale 03-03 chiede di augmentare `BrokerConfig.gateway?: GatewayConfig` da `packages/routing/src/augment.ts`. Ma `@gluezero/gateway` ha già `@gluezero/routing` come dependency workspace (plan 03-02 SUMMARY conferma). Importare `GatewayConfig` da `@gluezero/gateway` qui creerebbe un ciclo `routing → gateway → routing`.
- **Decision:** L'augment di `BrokerConfig.gateway?` resta in `packages/gateway/src/augment.ts` (plan 03-04). La sezione viene chiusa simmetricamente dal package gateway, mantenendo il dependency boundary chiaro. Il plan 03-04 doveva comunque coprire questa augment (vedi 03-02-SUMMARY note: "Plan 03-04 augmenta gateway parallelamente").
- **Rationale:** Coerente con il principio di separation-of-concerns dei package + evita anti-pattern dependency cycle workspace. Nessuna funzionalità persa: il consumer che importa `@gluezero/gateway` ottiene comunque `BrokerConfig.gateway?` augmented (coerente con il pattern F2 dove `@gluezero/mapper` augmenta `BrokerConfig.canonicalModel`).
- **Files affected:** `packages/routing/src/augment.ts` (skip gateway import — JSDoc esplicita la decisione)
- **No commit deviation:** è una clarification del plan, scope intatto.

### Auto-applied (no deviation)

Nessun bug fix, missing functionality o blocking issue auto-fix. Plan eseguito con due sole clarification interne (decision #2 e #4 sopra) entrambe nello scope del plan.

---

**Total deviations:** 1 architectural avoidance (Rule 4) per evitare ciclo workspace.
**Impact on plan:** Nessun scope creep. Il `BrokerConfig.gateway?` augment è demandato al plan 03-04 dove naturalmente vive (coerente con SUMMARY 03-02).

## Issues Encountered

Nessuno significativo. La decisione architetturale di non augmentare `BrokerConfig.gateway?` qui è documentata in JSDoc del file e nel summary plan 03-02 ("Plan 03-04 augmenta gateway parallelamente").

## Verification Output

```bash
$ pnpm --filter @gluezero/routing test -- --run src/augment.test.ts
Test Files 1 passed (1) | Tests 9 passed (9) | Duration 363ms

$ pnpm --filter @gluezero/routing build
ESM dist/augment.js 215 B + dist/index.js 211 B + DTS clean

$ pnpm --filter @gluezero/routing exec tsc --noEmit
# exit 0

$ pnpm --filter @gluezero/core test
Tests 248 passed (248)

$ pnpm --filter @gluezero/mapper test
Tests 183 passed (183)

$ pnpm --filter @gluezero/gateway exec tsc --noEmit
# exit 0

$ grep -c "declare module" packages/routing/src/augment.ts
2

$ grep -c "^export type" packages/routing/src/index.ts
4

$ grep -c "/\*\*" packages/routing/src/augment.ts
9
```

## Bundle size impact

- `dist/augment.js`: **215 B** (uncompressed) — solo `var __augmentLoaded = true; export { __augmentLoaded }`. Gzip stimato ~100 B.
- `dist/index.js`: **211 B** (uncompressed) — re-export di `__augmentLoaded`. Gzip stimato ~100 B.
- DTS aggregato `dist/index.d.ts` 2.38 KB + `dist/augment-Cv2Ik9Ly.d.ts` 19.81 KB (interface declarations).

Bundle runtime invariato: zero codice runtime aggiuntivo oltre al marker `__augmentLoaded`. Type-only — zero impact size-limit budget routing.

## Note per i plan downstream

- **Plan 03-04** (augment gateway): replica pattern di questo plan ma augmenta SOLO `BrokerConfig.gateway?: GatewayConfig` (1 declare module). Side-effect import + sideEffects array già configurati da plan 03-01 nel package gateway.
- **Plan 03-05** (route-resolver): può consumare `PluginDescriptor.routes` tipato dopo l'import di `@gluezero/routing` nei file consumer.
- **Plan 03-12** (RouterBroker constructor): legge `BrokerConfig.routes` array per pre-registrare le route al boot (D-93/D-62), `BrokerConfig.routing.multipleRoutesPolicy` per configurare resolver (D-66), `BrokerConfig.routing.requiresRouteTopics` per chiusura BLOCKER 4 (D-100). Cascade: legge `descriptor.routes` di plugin per auto-register on `registerPlugin` (D-94).
- **Plan 03-12** (CanonicalRegistry binding): consuma `CanonicalSchema.requiresRoute` per check ROUTE-16 (D-67/D-95) — topic con schema requiresRoute=true senza route → BrokerError.
- **Plan downstream** (cross-fase): tap consumer F3 dichiarano `step: PipelineStep | F2PipelineStep | F3PipelineStep` per coprire i 13 step (5 F1 + 5 F2 + 3 F3).

## Self-Check: PASSED

**File creati verificati:**
- `packages/routing/src/augment.ts` ✅ (172 LOC, 2 declare module, 9 JSDoc, F3PipelineStep + __augmentLoaded)
- `packages/routing/src/augment.test.ts` ✅ (148 LOC, 9 test)

**Commit verificati in `git log --oneline`:**
- `510d80f` Task 1 — feat(03-03): aggiunge augment.ts F3 + test compile-time (9 test passing) ✅
- `186753d` Task 2 — feat(03-03): cabla side-effect augment in barrel + tsup entry per dist/augment.js ✅

**Build artifacts:**
- `packages/routing/dist/augment.js` ✅ (215 B, contiene `__augmentLoaded`)
- `packages/routing/dist/index.js` ✅ (211 B, ri-esporta `__augmentLoaded`)
- `packages/routing/dist/index.d.ts` ✅ (2.38 KB, F3PipelineStep + 26 type re-export)

**TS/test status:**
- routing test: 9/9 passing ✅
- routing tsc: 0 errori ✅
- routing build: success ✅
- core test: 248/248 invariato ✅
- mapper test: 183/183 invariato ✅
- gateway tsc: 0 errori ✅

**Vincolo D-83 confermato:** zero modifiche runtime a `packages/core/src/` o `packages/mapper/src/`.

**REQ-ID coperti:** ROUTE-01 (PluginDescriptor.routes), ROUTE-15 (RoutingConfig.multipleRoutesPolicy esposto via BrokerConfig.routing), ROUTE-16 (CanonicalSchema.requiresRoute + RoutingConfig.requiresRouteTopics).

---
*Phase: 03-routing-server-gateway-http*
*Completed: 2026-05-01*
