---
phase: 03-routing-server-gateway-http
plan: 04
subsystem: gateway-augment
tags:
  - augment
  - declaration-merging
  - phase-3
  - gateway
  - subpath-exports
  - tree-shake-guard
dependency-graph:
  requires:
    - phase: 03-02
      provides: "@gluezero/gateway/http types — GatewayConfig + 7 Strategy interfaces + GatewayErrorCode + isGatewayErrorCode"
    - phase: 03-03
      provides: "@gluezero/routing augment per BrokerConfig.routes/routing (parallelo simmetrico)"
    - phase: 02
      provides: "@gluezero/mapper barrel (CanonicalSchema/CanonicalSchemaId per test coexistenza)"
    - phase: 01
      provides: "@gluezero/core BrokerConfig (interface — augmentable D-93)"
  provides:
    - "BrokerConfig.gateway? augmentation visibile dopo import '@gluezero/gateway' (D-93)"
    - "@gluezero/gateway/http subpath barrel con 18 type re-export pubblici (GatewayConfig + 4 sub-types + 7 Strategy + 2 spec + 1 context + 1 middleware + 1 error code) + isGatewayErrorCode runtime"
    - "@gluezero/gateway umbrella barrel con `export * from './http'` + side-effect __augmentGatewayLoaded"
    - "dist/augment.js separato dal bundle index.js (sideEffects array preserva entry — Pattern S1)"
    - "dist/http/index.js entry separato (subpath exports — bundle budget 8 KB gzip dedicato)"
  affects:
    - "03-08+ (HttpGateway runtime): consuma BrokerConfig.gateway tipato per istanziare gateway al boot"
    - "03-12 (RouterBroker): legge BrokerConfig.gateway per dependency injection in HttpGateway"
    - "ogni plan downstream F3 che importa @gluezero/gateway eredita la declaration merging di BrokerConfig.gateway"
    - "Phase 4 SSE/WS (riservato): aggiunger un terzo entry `sse-ws/index` alla tsup config + export `./sse-ws` al package.json"
tech-stack:
  added: []
  patterns:
    - "TS declaration merging interface (Pattern B — replica F2 D-49/D-56/D-57 + F3 routing 03-03)"
    - "Side-effect import + sideEffects array (Pattern S1 — T-03-04-01 mitigation, replica T-02-09-01 di F2 e T-03-03-01 di routing)"
    - "Multi-entry tsup config con 3 entry (index + http/index + augment) — pattern di riferimento per F4 sse-ws"
    - "Subpath exports per dependency boundary chiaro (RESEARCH §Subpath Exports Recommendation)"
    - "Cross-package interface augment additive non-collision (BrokerConfig augmentato da 3 fonti: mapper F2 + routing F3 + gateway F3 su campi DISGIUNTI — T-03-04-02 accept)"
key-files:
  created:
    - "packages/gateway/src/augment.ts"
    - "packages/gateway/src/augment.test.ts"
  modified:
    - "packages/gateway/src/http/index.ts"
    - "packages/gateway/src/index.ts"
    - "packages/gateway/tsup.config.ts"
key-decisions:
  - "Augment minimale gateway: SOLO BrokerConfig.gateway? (1 declare module, 1 field) — coerente con 03-03 routing che augmenta routes/routing/gateway su `@gluezero/core` e requiresRoute su `@gluezero/mapper` da package routing. Niente cross-augment di interface non-pertinenti al package."
  - "Marker const con nome distinto __augmentGatewayLoaded (non __augmentLoaded come mapper/routing) per consentire ai consumer di distinguere i 3 augment durante debug. Pattern S1 invariato."
  - "tsup entry list passata a object form (`entry: { index: ..., 'http/index': ..., augment: ... }`) anziché array per emettere `dist/augment.js` come file dedicato (path referenziato da package.json sideEffects)."
  - "package.json già aveva sideEffects array completo da plan 03-01 (`./dist/augment.js`, `./src/augment.ts`, `**/augment.js`, `**/augment.ts` — quadruplice safety) e exports `./http` corretti — niente modifiche al package.json necessarie."
  - "Test 5 (non 3 minimi del plan): aggiunti backward-compat F1+F2 (test 4) + coexistenza con sezioni mapper F2 + routing F3 (test 5 — T-03-04-02 mitigation esplicita)."
patterns-established:
  - "Multi-package augment additivo coordinato: F2 augmenta canonicalModel/aliasRegistry/transforms; F3-routing augmenta routes/routing + CanonicalSchema.requiresRoute; F3-gateway augmenta gateway. Tutti coesistono su BrokerConfig senza collisione di nomi (campi disgiunti per costruzione)."
  - "Pattern simmetrico tra package F3 sibling: routing e gateway usano lo stesso template augment.ts (replica F2) con scope minimale e marker const distinto. Il pattern è replicabile per F4 (gateway/sse-ws → BrokerConfig.realtime?), F5 (worker → BrokerConfig.workers?), F6 (cache → BrokerConfig.cache?, devtools → BrokerConfig.tooling?)."
  - "Subpath barrel ./http espone tipo-coverage completo PRIMA del runtime (plan 03-08+). Pattern di pre-pubblicazione type-first già usato in F2 (broker-mapper-wrapper.ts type-only firma prima dell'integrazione runtime)."
requirements-completed: []
metrics:
  duration: "~14 min"
  started: "2026-05-01T21:32:49Z"
  completed: "2026-05-01T21:46:54Z"
  tasks_completed: 2
  files_created: 2
  files_modified: 3
---

# Phase 03 Plan 04: F3 Augment Gateway — TS Declaration Merging Summary

**TS declaration merging F3 gateway — `BrokerConfig.gateway?: GatewayConfig` (D-93) + barrel HTTP subpath con 18 type re-export pubblici (GatewayConfig + Strategy interfaces + GatewayErrorCode) + umbrella `export * from './http'` con side-effect `__augmentGatewayLoaded` + tsup entry separata per `dist/augment.js`. Vincolo D-83 mantenuto: zero modifiche runtime a `packages/core/` né `packages/mapper/`.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-05-01T21:32:49Z
- **Completed:** 2026-05-01T21:46:54Z
- **Tasks:** 2/2
- **Files created:** 2 (augment.ts, augment.test.ts)
- **Files modified:** 3 (src/http/index.ts, src/index.ts, tsup.config.ts)
- **Test passing:** 5/5 augment.test.ts (≥ 3 richiesti dal plan)
- **TS errors:** 0 (gateway typecheck clean)
- **Regression D-83:** core 248/248 + mapper 183/183 + routing 9/9 invariati

## Accomplishments

### Task 1 — augment.ts + augment.test.ts (5 test)

- **`augment.ts` (~95 LOC)** con 3 JSDoc entries documentati:
  - Header file con riferimenti completi a D-83/D-93, motivazione separazione da `@gluezero/routing` (ciclo workspace), threat coverage T-03-04-01/T-03-04-02.
  - `declare module '@gluezero/core'` con `BrokerConfig.gateway?: GatewayConfig` (D-93, SEC-01..05) + JSDoc che cita coexistenza con plan 03-03 routing augment.
  - `__augmentGatewayLoaded: true` marker const (Pattern S1 — T-03-04-01 mitigation diretta) con nome distinto da `__augmentLoaded` di mapper/routing per debug-friendliness.
- **`augment.test.ts` (~95 LOC, 5 test)** — replica pattern F2/F3-routing:
  1. Runtime side-effect import safe (`__augmentGatewayLoaded === true`)
  2. BrokerConfig.gateway compile-time + matchTypeOf<GatewayConfig | undefined> + costruzione config con allowlist + auth
  3. Full GatewayConfig shape: tutti i campi (auth con tokenCacheMs, allowlist string + RegExp, defaults timeout+retry, circuitBreaker oggetto + variante `false`)
  4. Backward-compat F1+F2: BrokerConfig senza gateway resta valido
  5. Coexistenza mapper F2 + routing F3 + gateway F3 augmentations (T-03-04-02 mitigation esplicita): canonicalModel + routes + routing + gateway tutti simultanei

### Task 2 — barrel http subpath + umbrella + tsup augment entry

- **`packages/gateway/src/http/index.ts`** (subpath HTTP barrel, ~95 LOC):
  - 5 type da `./types/gateway-config` (GatewayConfig + AllowlistEntry + AuthStrategyConfig + DefaultsConfig + CircuitBreakerConfig)
  - 11 type da `./types/http-strategies` (7 Strategy interfaces + GatewayContext + GatewayMiddleware + HttpRequestSpec + HttpResponseSpec)
  - 1 type da `./types/http-error` (GatewayErrorCode)
  - 1 runtime export da `./types/http-error` (isGatewayErrorCode type guard)
  - **Totale: 17 type re-export + 1 runtime function** = 18 simboli pubblici dal subpath `./http`
  - 3 blocchi `export type` per discoverability (≥ 3 richiesti dal done criteria)
- **`packages/gateway/src/index.ts`** (umbrella barrel):
  - `export { __augmentGatewayLoaded } from './augment'` come PRIMA riga runtime (Pattern S1 — ri-esporta come simbolo pubblico per evitare tree-shaking)
  - `export * from './http'` per consumer aggregati (forwarda i 18 simboli del subpath)
- **`packages/gateway/tsup.config.ts`**: aggiornato `entry` da 2 entry a 3 (`index: 'src/index.ts'` + `'http/index': 'src/http/index.ts'` + `augment: 'src/augment.ts'`) per emettere `dist/augment.js` come file separato (path referenziato dal `package.json.sideEffects`).
- **`packages/gateway/package.json`**: già completo da plan 03-01 — `sideEffects: ["./dist/augment.js", "./src/augment.ts", "**/augment.js", "**/augment.ts"]` (quadruplice safety) + `exports['./http']` valido. Nessuna modifica richiesta.

## Augmentations applicate

| Target | Field | Type | Decisione | REQ-ID coperti (a livello tipo) |
|--------|-------|------|-----------|-------------------------------|
| `@gluezero/core::BrokerConfig` | `gateway?` | `GatewayConfig` | D-93 | SEC-01..05 (auth/refresh/idempotency/url-allowlist a livello config), ROUTE-06 (gateway centralizzato — type contract), ROUTE-07 (auth headers — type contract) |

NB: i REQ-ID restano `[ ]` in `REQUIREMENTS.md` (non marcati `[x]` qui) perché l'implementazione runtime arriva nei plan 03-08+ (`HttpGateway`/auth-strategy/idempotency-strategy/url-allowlist). Questo plan offre soltanto la **type surface** sopra cui i plan downstream costruiscono.

## Build verification

```bash
$ pnpm --filter @gluezero/gateway build
ESM dist/augment.js        229.00 B
ESM dist/http/index.js     583.00 B
ESM dist/index.js          661.00 B
ESM dist/http/index.js.map 4.08 KB
ESM dist/augment.js.map    5.55 KB
ESM dist/index.js.map      9.54 KB
ESM ⚡️ Build success in 21ms
DTS Build start
DTS ⚡️ Build success in 331ms
DTS dist/index.d.ts                   542.00 B
DTS dist/augment.d.ts                 2.04 KB
DTS dist/http/index.d.ts              8.15 KB
DTS dist/gateway-config-CmwbOUe6.d.ts 3.67 KB
```

`dist/augment.js` content (post-tree-shake-guard verification):
```js
/* @gluezero/gateway — MIT — https://github.com/<TBD>/sembridge */
// src/augment.ts
var __augmentGatewayLoaded = true;
export { __augmentGatewayLoaded };
```

`dist/index.js` ri-esporta correttamente il marker (umbrella barrel verified):
```js
/* @gluezero/gateway — MIT — https://github.com/<TBD>/sembridge */
// src/augment.ts
var __augmentGatewayLoaded = true;
// src/http/types/http-error.ts
var GATEWAY_ERROR_CODES = /* @__PURE__ */ new Set([ ... 11 codici ... ]);
function isGatewayErrorCode(code) { ... }
export { __augmentGatewayLoaded, isGatewayErrorCode };
```

## Regression check D-83

```bash
$ pnpm --filter @gluezero/core test
Test Files 24 passed (24) | Tests 248 passed (248)

$ pnpm --filter @gluezero/mapper test
Test Files 16 passed (16) | Tests 183 passed (183)

$ pnpm --filter @gluezero/routing test
Test Files 1 passed (1) | Tests 9 passed (9)

$ pnpm --filter @gluezero/gateway test
Test Files 1 passed (1) | Tests 5 passed (5)

$ pnpm --filter @gluezero/gateway exec tsc --noEmit
# exit 0 — 0 errori
```

**Vincolo D-83 confermato:** zero modifiche runtime a `packages/core/src/` o `packages/mapper/src/`. core 248/248 + mapper 183/183 + routing 9/9 test invariati. gateway typecheck clean + 5/5 test passing.

## Task Commits

Ogni task committed atomicamente:

1. **Task 1: augment.ts + augment.test.ts** — `34af7a2` (feat)
2. **Task 2: barrel http + umbrella + tsup augment entry** — `47f13fc` (feat)

## Files Created/Modified

### Created (2)

- `packages/gateway/src/augment.ts` — TS declaration merging F3 gateway con 1 declare module per BrokerConfig.gateway + __augmentGatewayLoaded marker (~95 LOC, 3 JSDoc entries)
- `packages/gateway/src/augment.test.ts` — 5 test compile-time + runtime (replica pattern F2/F3-routing + 1 test extra coexistenza T-03-04-02)

### Modified (3)

- `packages/gateway/src/http/index.ts` — subpath barrel HTTP popolato con 17 type re-export (3 blocchi) + 1 runtime function (`isGatewayErrorCode`); precedente placeholder `export {}` rimosso
- `packages/gateway/src/index.ts` — umbrella barrel: `export { __augmentGatewayLoaded } from './augment'` (Pattern S1) + `export * from './http'` (forwarding subpath)
- `packages/gateway/tsup.config.ts` — entry list espansa da 2 a 3 entry (aggiunto `augment: 'src/augment.ts'`) per emettere `dist/augment.js` come file separato

## Decisions Made

1. **Marker const con nome distinto `__augmentGatewayLoaded`** (non `__augmentLoaded` come mapper e routing): permette al consumer/debugger di distinguere i 3 augment quando ispezionano simultaneamente `import.meta`/`globalThis`/snapshot Inspector. Pattern S1 invariato: ri-esportato dal barrel `src/index.ts` per anti-tree-shaking.

2. **`tsup.config.ts` entry come object form**: `entry: { index: 'src/index.ts', 'http/index': 'src/http/index.ts', augment: 'src/augment.ts' }`. La forma object permette di controllare il filename di output (`dist/augment.js` vs default array `dist/src/augment.js`) — necessaria per allineare al pattern `package.json.sideEffects: ["./dist/augment.js"]`.

3. **5 test invece dei 3 minimi del plan**: aggiunti test 4 (backward-compat F1+F2) e test 5 (coexistenza mapper F2 + routing F3 + gateway F3 augmentations su BrokerConfig). Rule 2 — funzionalità critica per garantire che l'augment gateway NON collida con gli augment di mapper/routing già committati (T-03-04-02 mitigation esplicita).

4. **`package.json` non modificato**: il plan menziona di "aggiungere/confermare `sideEffects` array + `exports['./http']`". Verifica conferma che entrambi sono già presenti e corretti dal plan 03-01 (`sideEffects` con quadruplice safety + `exports['./http']` con types+import). Nessuna modifica necessaria al package.json — economia rispetto al plan testuale (deviation Rule 3 non applicabile, scope intatto).

## Deviations from Plan

### Auto-fixed (Rule 1 — Bug)

**1. [Rule 1 - Bug] JSDoc breaking syntax con `*/` interno**

- **Found during:** Task 2 build esecuzione (`pnpm --filter @gluezero/gateway build` exit 1)
- **Issue:** Il JSDoc `/** Literal union dei 11 codici errore HTTP Gateway F3 (D-80, D-87) — gateway.*/auth.*/circuit.*/etc. */` aveva `*/` interno (gateway.**/auth**) che chiudeva prematuramente il commento, causando syntax error esbuild + TS errors propagati (TS1005, TS1003, TS1161, TS1109, TS1434, TS2304).
- **Fix:** sostituito il pattern abbreviato con elenco esplicito dei codici letterali, evitando `*/` interno.
- **Files modified:** `packages/gateway/src/http/index.ts` (1 riga JSDoc)
- **Commit:** incluso nel commit di Task 2 (`47f13fc`).
- **Rationale:** issue bloccante, scope-internal — Rule 1 auto-fix senza ritardare il task.

### Auto-applied (no deviation)

Nessun missing critical functionality o blocking issue auto-fix oltre al bug JSDoc sopra. Plan eseguito secondo specifica con 2 sole clarification interne (decision #4 no-op su package.json + decision #2 entry object form invece di array — entrambe nello scope del plan).

### Summary

**Total deviations:** 1 bug fix Rule 1 (JSDoc syntax) — corretto inline e committed con il task 2.
**Impact on plan:** Nessun scope creep. Scope intatto, nessun extra commit, nessun architectural change.

## Issues Encountered

Solo il bug JSDoc auto-fixed (vedi Deviations Rule 1 sopra). Nessun altro issue significativo.

## Verification Output

```bash
$ pnpm --filter @gluezero/gateway test -- --run augment.test.ts
Test Files 1 passed (1) | Tests 5 passed (5) | Duration 734ms

$ pnpm --filter @gluezero/gateway build
ESM dist/augment.js 229 B + dist/http/index.js 583 B + dist/index.js 661 B + DTS clean

$ pnpm --filter @gluezero/gateway exec tsc --noEmit
# exit 0

$ pnpm --filter @gluezero/core test
Tests 248 passed (248)

$ pnpm --filter @gluezero/mapper test
Tests 183 passed (183)

$ pnpm --filter @gluezero/routing test
Tests 9 passed (9)

$ test -f packages/gateway/dist/index.js && test -f packages/gateway/dist/http/index.js && test -f packages/gateway/dist/augment.js
# all 3 dist files present

$ grep "declare module '@gluezero/core'" packages/gateway/src/augment.ts
declare module '@gluezero/core' {

$ grep "__augmentGatewayLoaded" packages/gateway/src/augment.ts | wc -l
6 (header doc references + export const literal)

$ grep -c "^export type" packages/gateway/src/http/index.ts
3

$ grep "GatewayConfig" packages/gateway/src/http/index.ts | wc -l
3

$ grep "isGatewayErrorCode" packages/gateway/src/http/index.ts | wc -l
2 (runtime export + JSDoc reference)

$ grep "export \* from './http'" packages/gateway/src/index.ts
export * from './http'

$ grep '"sideEffects"' packages/gateway/package.json
  "sideEffects": [...4 entries...]

$ grep '"./http"' packages/gateway/package.json
    "./http": {
```

## Bundle size impact

- `dist/augment.js`: **229 B** (uncompressed) — solo `var __augmentGatewayLoaded = true; export { __augmentGatewayLoaded }` + banner. Gzip stimato ~110 B.
- `dist/index.js`: **661 B** (uncompressed) — ri-esporta `__augmentGatewayLoaded` + 11-element Set `GATEWAY_ERROR_CODES` + `isGatewayErrorCode` function. Gzip stimato ~280 B.
- `dist/http/index.js`: **583 B** (uncompressed) — solo `GATEWAY_ERROR_CODES` Set + `isGatewayErrorCode`. Gzip stimato ~250 B.
- DTS aggregati: 14.4 KB total (`index.d.ts` 542 B + `augment.d.ts` 2.04 KB + `http/index.d.ts` 8.15 KB + `gateway-config-*.d.ts` 3.67 KB).

Bundle runtime quasi-zero: l'unico runtime è `isGatewayErrorCode` (~150 B) + Set di 11 stringhe + marker boolean. Type-only — entro il budget 8 KB gzip target del subpath `./http` (RESEARCH §"Bundle Size Targets" line 13). Plan 03-08+ aggiungerà i 7 Strategy default implementation che porteranno il subpath verso ~5-6 KB gzip.

## Note per i plan downstream

- **Plan 03-08** (HttpGateway runtime + public-factory): consuma `BrokerConfig.gateway?: GatewayConfig` da questo augment per leggere config al boot. Importa `GatewayConfig`, `AuthStrategyConfig`, `AllowlistEntry`, `DefaultsConfig`, `CircuitBreakerConfig` direttamente da `@gluezero/gateway/http` (subpath dedicato). Implementa `createHttpGateway(config: GatewayConfig)` factory + `HttpGateway` class.
- **Plan 03-09..03-12** (Strategy default implementations): implementano le 7 Strategy interfaces esposte dal `./http` barrel. Pattern import: `import type { RetryStrategy } from '@gluezero/gateway/http'` + `export class ExponentialBackoffWithJitter implements RetryStrategy { ... }`.
- **Plan 03-12** (RouterBroker constructor): legge `config.gateway` (typed via questo augment) per dependency injection in `HttpGateway` istanza. Cascade: `RouterBroker.unregisterPlugin` invoca `this.gateway.cancelInFlightByOwner(pluginId)` (D-86 LIFE-02 ext).
- **Plan 03-14** (size-limit gate): aggiungere config `size-limit` per `dist/http/index.js` (budget 8 KB gzip — RESEARCH line 13) + `dist/augment.js` (budget 1 KB gzip).
- **Phase 4** (SSE/WS adapter): aggiungerà entry `'sse-ws/index': 'src/sse-ws/index.ts'` al `tsup.config.ts` + nuovo augment `BrokerConfig.realtime?` da `packages/gateway/src/sse-ws/augment.ts` (pattern simmetrico a questo plan). Side-effect import + sideEffects array già configurati per `**/augment.js` glob (quadruplice safety) — coprirà automaticamente anche `dist/sse-ws/augment.js`.

## Self-Check: PASSED

**File creati verificati:**
- `packages/gateway/src/augment.ts` ✅ (~95 LOC, 1 declare module, 3 JSDoc entries, __augmentGatewayLoaded export)
- `packages/gateway/src/augment.test.ts` ✅ (~95 LOC, 5 test passing)

**File modificati verificati:**
- `packages/gateway/src/http/index.ts` ✅ (3 export type blocks, 17 type + 1 runtime symbols)
- `packages/gateway/src/index.ts` ✅ (export `__augmentGatewayLoaded` + `export * from './http'`)
- `packages/gateway/tsup.config.ts` ✅ (3-entry object form con `augment: 'src/augment.ts'`)

**Commit verificati in `git log --oneline`:**
- `34af7a2` Task 1 — feat(03-04): aggiunge augment.ts F3 gateway + test compile-time (5 test passing) ✅
- `47f13fc` Task 2 — feat(03-04): cabla side-effect augment in barrel + tsup entry per dist/augment.js ✅

**Build artifacts:**
- `packages/gateway/dist/augment.js` ✅ (229 B, contiene `__augmentGatewayLoaded`)
- `packages/gateway/dist/index.js` ✅ (661 B, ri-esporta `__augmentGatewayLoaded` + isGatewayErrorCode)
- `packages/gateway/dist/http/index.js` ✅ (583 B, isGatewayErrorCode + GATEWAY_ERROR_CODES Set)
- `packages/gateway/dist/index.d.ts` ✅ (542 B)
- `packages/gateway/dist/http/index.d.ts` ✅ (8.15 KB — 17 type re-export DTS)
- `packages/gateway/dist/augment.d.ts` ✅ (2.04 KB — declare module DTS)

**TS/test status:**
- gateway test: 5/5 passing ✅
- gateway tsc: 0 errori ✅
- gateway build: success ✅
- core test: 248/248 invariato ✅
- mapper test: 183/183 invariato ✅
- routing test: 9/9 invariato ✅

**Vincolo D-83 confermato:** zero modifiche runtime a `packages/core/src/` o `packages/mapper/src/`.

**REQ-ID coperti a livello tipo (NO mark `[x]` in REQUIREMENTS.md — runtime in plan 03-08+):** SEC-01 (auth.getToken), SEC-02 (auth.refresh), SEC-03 (idempotency type slot), SEC-04 (HTTP status — type via GatewayErrorCode 11 codici), SEC-05 (allowlist type), ROUTE-06 (Gateway type contract), ROUTE-07 (auth header type slot).

---
*Phase: 03-routing-server-gateway-http*
*Completed: 2026-05-01*
