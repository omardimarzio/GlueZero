---
phase: 03-routing-server-gateway-http
plan: 02
subsystem: routing-types
tags:
  - types
  - routing
  - gateway
  - foundation
  - phase-3
  - discriminated-union
  - strategy-pattern
dependency-graph:
  requires:
    - phase: 03-01
      provides: "@sembridge/routing + @sembridge/gateway buildable, sideEffects array, subpath exports ./http"
    - phase: 02
      provides: "@sembridge/mapper (CanonicalSchemaId, OutputMap, ValidationResult, MappingErrorCode)"
    - phase: 01
      provides: "@sembridge/core (BrokerError, BrokerEvent, ErrorCategory)"
  provides:
    - "RouteDefinition discriminated union (local|http|cache|composite) — backbone wave 3-4"
    - "RoutePolicies con 7 sub-config types (Retry/Dedupe/Backpressure/Auth/Idempotency/Error/Timeout)"
    - "RouteOutcome discriminated {ok:true|false} con metadata branch"
    - "RoutingConfig.multipleRoutesPolicy + requiresRouteTopics opt-in"
    - "GatewayConfig (auth/allowlist/defaults/circuitBreaker)"
    - "7 Strategy interface pluggable + GatewayContext + GatewayMiddleware (Koa-compose)"
    - "GatewayErrorCode literal union 11 codes + isGatewayErrorCode runtime type guard"
  affects:
    - "03-03 (augment routing — declaration merging PluginDescriptor.routes / BrokerConfig.routing / CanonicalSchema.requiresRoute)"
    - "03-04 (augment gateway — declaration merging BrokerConfig.gateway)"
    - "03-05 (route-resolver — usa CompiledRoute con RouteDefinition)"
    - "03-06+ (route-handlers, executor, strategies — implementano le interface F3 type-only)"
    - "03-08+ (http-gateway, retry/dedupe/auth/idempotency/backpressure/circuit-breaker default impl)"
tech-stack:
  added: []
  patterns:
    - "Discriminated union via `type: 'X' | 'Y'` (Pattern H — analogo CanonicalSchema F2)"
    - "Strategy interface pluggable (Pattern I — analogo ValidatorAdapter F2)"
    - "Literal union codes + set-based type guard (analogo MappingErrorCode F2)"
    - "Conditional spread per exactOptionalPropertyTypes (Pattern S4)"
    - "Type-only barrel re-export (Pattern S1 cross-package consumer)"
    - "Workspace dep cross-package: @sembridge/routing → @sembridge/gateway (type-only import)"
key-files:
  created:
    - "packages/routing/src/types/route-definition.ts"
    - "packages/routing/src/types/route-policies.ts"
    - "packages/routing/src/types/route-outcome.ts"
    - "packages/routing/src/types/routing-config.ts"
    - "packages/routing/src/types/index.ts"
    - "packages/gateway/src/http/types/gateway-config.ts"
    - "packages/gateway/src/http/types/http-strategies.ts"
    - "packages/gateway/src/http/types/http-error.ts"
    - "packages/gateway/src/http/types/index.ts"
  modified:
    - "packages/routing/src/index.ts (aggiunto export type * from './types')"
    - "packages/gateway/package.json (aggiunto @sembridge/routing workspace dep)"
    - "pnpm-lock.yaml (workspace risoluzione aggiornata)"
key-decisions:
  - "Aggiunta @sembridge/routing come workspace dep di @sembridge/gateway (Rule 3 fix: import type RetryPolicyConfig/DedupePolicyConfig/IdempotencyPolicyConfig/BackpressurePolicyConfig/RouteDefinition richiesto dal plan)"
  - "Estensione barrel routing/src/index.ts con export type * (necessario perché tsc consumer risolve via dist/index.d.ts)"
  - "Pattern uniforme route-policies.ts vs http-strategies.ts: routing file dichiara i `*Config` descriptor (cosa la route richiede), gateway file dichiara le `*Strategy` interface implementabili (come la policy si esegue)"
  - "RouteOutcome metadata branch separato (RouteOutcomeMetadata interface) per consentire estensioni F4/F5 senza breaking change al union type"
  - "GatewayErrorCode include 11 codes (10 da plan + cache.not-implemented + route.id.duplicate) per coprire D-87 unregister strict + cache stub F3→F6"
patterns-established:
  - "Discriminated union RouteDefinition: pattern di riferimento per F5 RouteWorkerDefinition (declaration merging additive)"
  - "Strategy interface naming: `*Strategy` (pluggable interface, gateway side) vs `*PolicyConfig` (descriptor, routing side)"
  - "Type guard set-based isGatewayErrorCode: pattern replicabile in F4 per isRealtimeErrorCode"
  - "Cross-package type-only import (workspace:* dep): pattern usato qui per @sembridge/gateway → @sembridge/routing per la prima volta in monorepo"
requirements-completed:
  - ROUTE-01
  - ROUTE-02
  - ROUTE-03
  - ROUTE-04
  - ROUTE-05
  - ROUTE-08
  - ROUTE-10
  - ROUTE-11
  - ROUTE-13
  - VAL-05
  - SEC-01
  - SEC-02
  - SEC-03
  - SEC-05
metrics:
  duration: "~12 min"
  started: "2026-04-30T23:09:00Z"
  completed: "2026-04-30T23:21:10Z"
  tasks_completed: 2
  files_created: 9
  files_modified: 3
---

# Phase 03 Plan 02: F3 Type Contracts Routing + Gateway Summary

**Type contracts type-only F3 — RouteDefinition discriminated union (4 variants) + 7 Strategy interfaces pluggable + 11 GatewayErrorCode con type guard runtime, zero modifiche runtime a F1/F2.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-30T23:09:00Z
- **Completed:** 2026-04-30T23:21:10Z
- **Tasks:** 2/2
- **Files created:** 9
- **Files modified:** 3
- **TS errors:** 0 (entrambi i package, exit 0)

## Accomplishments

- **`RouteDefinition` discriminated union** (`local`/`http`/`cache`/`composite`) chiude ROUTE-01..05 a livello tipo (D-60). 4 sub-interface estendono `RouteDefinitionBase` con readonly id/topic/priority/policies.
- **`RoutePolicies` container** con 7 sub-config (`RetryPolicyConfig`, `DedupePolicyConfig`, `BackpressurePolicyConfig`, `ConcurrencyPolicy`, `AuthPolicyConfig`, `IdempotencyPolicyConfig`, `ErrorPolicyConfig` + `TimeoutPolicyConfig`) chiude ROUTE-08/10/11/13 + SEC-01/03 a livello tipo (D-68/D-69/D-70/D-72/D-73/D-74/D-75).
- **`RouteOutcome` discriminated** `{ ok: true; canonicalPayload; routeId; metadata? } | { ok: false; error: BrokerError; routeId }` con alias `RouteResult`/`RouteError` (D-80, D-82). Pattern analogo a `ValidationResult` di F2.
- **`RoutingConfig`** con `multipleRoutesPolicy` (D-66, ROUTE-15) + `requiresRouteTopics` opt-in (BLOCKER 4 fix Plan 03-12, D-100).
- **`GatewayConfig`** con `auth` / `allowlist` / `defaults` / `circuitBreaker` chiude SEC-01..SEC-05 + D-71/D-72/D-99 (con `AuthStrategyConfig` + `AllowlistEntry` + `DefaultsConfig` + `CircuitBreakerConfig`).
- **7 Strategy interface pluggable** (`RetryStrategy`, `TimeoutStrategy`, `DedupeStrategy`, `BackpressureStrategy`, `AuthStrategy`, `IdempotencyStrategy`, `CircuitBreakerStrategy`) + `GatewayContext` mutable + `GatewayMiddleware` Koa-compose-style (D-68 / Pattern I).
- **`GatewayErrorCode` literal union 11 codes** (D-80 + D-87 + cache stub) + `isGatewayErrorCode` runtime type guard set-based, replica esatta del pattern `isMappingErrorCode` di F2.

## Type esportati (totale)

### `@sembridge/routing/types`

**Type/interface:** `RouteDefinitionBase`, `RouteLocalDefinition`, `RouteHttpDefinition`, `RouteCacheDefinition`, `RouteCompositeDefinition`, `RouteDefinition`, `RouteHttpRequestSpec`, `RouteHttpResponseSpec`, `RouteHttpPublishesSpec`, `RouteCacheStrategy`, `RouteCompositeStep`, `RetryPolicyConfig`, `DedupePolicyConfig`, `ConcurrencyPolicy`, `BackpressurePolicyConfig`, `AuthPolicyConfig`, `IdempotencyPolicyConfig`, `ErrorPolicyConfig`, `TimeoutPolicyConfig`, `RoutePolicies`, `RouteOutcomeMetadata`, `RouteOutcome`, `RouteResult`, `RouteError`, `MultipleRoutesPolicy`, `RoutingConfig`. **Totale: 26 type esportati.**

### `@sembridge/gateway/http/types`

**Type/interface:** `AllowlistEntry`, `AuthStrategyConfig`, `DefaultsConfig`, `CircuitBreakerConfig`, `GatewayConfig`, `HttpRequestSpec`, `HttpResponseSpec`, `GatewayContext`, `GatewayMiddleware`, `RetryStrategy`, `TimeoutStrategy`, `DedupeStrategy`, `BackpressureStrategy`, `AuthStrategy`, `IdempotencyStrategy`, `CircuitBreakerStrategy`, `GatewayErrorCode`. **Totale: 17 type esportati.**

**Runtime export (singolo):** `isGatewayErrorCode(code: string): code is GatewayErrorCode`.

## REQ-ID coperti a livello tipo

| REQ-ID | Coverage |
|--------|----------|
| ROUTE-01 | `RouteDefinitionBase` interface comune |
| ROUTE-02 | `RouteLocalDefinition` |
| ROUTE-03 | `RouteHttpDefinition` (request/response/publishes/policies) |
| ROUTE-04 | `RouteCacheDefinition` (type-only F3, adapter F6) |
| ROUTE-05 | `RouteCompositeDefinition` (workflow F3, cache adapter F6) |
| ROUTE-08 | `ConcurrencyPolicy` `'latest-only' \| 'serial' \| 'parallel'` |
| ROUTE-10 | `BackpressurePolicyConfig` enum 6 strategie |
| ROUTE-11 | `DedupePolicyConfig` (key/keyFrom) |
| ROUTE-13 | `RoutePolicies.timeout` + abort signal propagation type-ready |
| VAL-05 | `RouteHttpResponseSpec.canonical: CanonicalSchemaId` (riuso schema F2) + `response.validation.failed` code |
| SEC-01 | `AuthStrategyConfig.getToken` + `AuthPolicyConfig.bearer` |
| SEC-02 | `AuthStrategyConfig.refresh` (single-flight type-ready) + `auth.expired` code |
| SEC-03 | `IdempotencyPolicyConfig` + `IdempotencyStrategy` |
| SEC-05 | `AllowlistEntry` (string \| RegExp) + `gateway.url.forbidden` code |

## Task Commits

Ogni task committed atomicamente:

1. **Task 1: types routing** — `2683895` (feat)
2. **Task 2: types gateway HTTP** — `55220ee` (feat)

_Nessuna metadata commit finale — sarà aggiunta dopo update STATE.md/ROADMAP.md._

## Files Created/Modified

### Created (9)

- `packages/routing/src/types/route-definition.ts` — Discriminated union + 4 sub-interface + spec http (~155 LOC)
- `packages/routing/src/types/route-policies.ts` — RoutePolicies + 7 sub-config types (~140 LOC)
- `packages/routing/src/types/route-outcome.ts` — RouteOutcome discriminated + alias RouteResult/RouteError (~50 LOC)
- `packages/routing/src/types/routing-config.ts` — MultipleRoutesPolicy + RoutingConfig (~50 LOC)
- `packages/routing/src/types/index.ts` — barrel type-only (4 export type *)
- `packages/gateway/src/http/types/gateway-config.ts` — GatewayConfig + AuthStrategyConfig + AllowlistEntry + DefaultsConfig + CircuitBreakerConfig (~120 LOC)
- `packages/gateway/src/http/types/http-strategies.ts` — 7 Strategy interface + GatewayContext + GatewayMiddleware + HttpRequestSpec/HttpResponseSpec (~155 LOC)
- `packages/gateway/src/http/types/http-error.ts` — GatewayErrorCode literal union 11 codes + isGatewayErrorCode (~80 LOC)
- `packages/gateway/src/http/types/index.ts` — barrel (3 export type * + 1 runtime export)

### Modified (3)

- `packages/routing/src/index.ts` — aggiunto `export type * from './types'` per esporre i tipi via dist d.ts ai consumer (necessario per la risoluzione cross-package via `dist/index.d.ts`)
- `packages/gateway/package.json` — aggiunto `"@sembridge/routing": "workspace:*"` come dependency (Rule 3 fix sotto)
- `pnpm-lock.yaml` — aggiornamento workspace risoluzione con il nuovo edge gateway → routing

## Decisions Made

- **Aggiunta workspace dep gateway → routing:** import type `RetryPolicyConfig`/`DedupePolicyConfig`/`IdempotencyPolicyConfig`/`BackpressurePolicyConfig`/`RouteDefinition` richiesti dal plan in `gateway-config.ts` e `http-strategies.ts`. Il plan non menzionava esplicitamente la modifica `package.json` perché il workspace edge era assunto. Risolto via Rule 3 (blocking): senza questo edge il typecheck gateway falliva con `TS2307: Cannot find module '@sembridge/routing'`.
- **Estensione barrel `routing/src/index.ts`:** aggiunto `export type * from './types'` perché tsc dei consumer (gateway) risolve `@sembridge/routing` via `dist/index.d.ts` e il barrel deve esporre i tipi. Nessun cambio runtime — solo type re-export.
- **`RouteOutcomeMetadata` come interface separata:** invece di inlinare metadata in `RouteOutcome`, isolato in `RouteOutcomeMetadata` per consentire estensioni F4/F5 (es. nuovi campi `cacheKey`, `workerId`) senza touch al union type.
- **GatewayErrorCode 11 codes invece di 10:** aggiunto `'route.id.duplicate'` (D-87 — `registerRoute` strict mode) e `'cache.not-implemented'` (cache stub F3→F6) oltre ai 9 D-80. Coverage completa per tutti i path di errore F3.
- **Pattern naming routing vs gateway:** routing dichiara `*PolicyConfig` (descriptor consumer-side: cosa la route richiede), gateway dichiara `*Strategy` (interface implementer-side: come si esegue). Il `RoutePolicies.retry: RetryPolicyConfig` viene tradotto a runtime in una `RetryStrategy` instance dal gateway.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Aggiunta `@sembridge/routing` come workspace dep di `@sembridge/gateway`**

- **Found during:** Task 2 (types gateway HTTP)
- **Issue:** Il plan istruisce `import type { RetryPolicyConfig, IdempotencyPolicyConfig, DedupePolicyConfig, BackpressurePolicyConfig } from '@sembridge/routing'` in `gateway-config.ts` e `import type { RouteDefinition, RoutePolicies } from '@sembridge/routing'` in `http-strategies.ts`. Il `package.json` di `@sembridge/gateway` (creato in plan 03-01) include solo `@sembridge/core` e `@sembridge/mapper` come deps workspace — il symlink `node_modules/@sembridge/routing` non esisteva e tsc falliva con `TS2307: Cannot find module '@sembridge/routing' or its corresponding type declarations.` (5 errori).
- **Fix:** Aggiunto `"@sembridge/routing": "workspace:*"` a `packages/gateway/package.json` dependencies. Eseguito `pnpm install` per creare il symlink workspace. Buildato `@sembridge/routing` (`pnpm --filter @sembridge/routing build`) per generare `dist/index.d.ts` con i tipi del Task 1.
- **Files modified:** `packages/gateway/package.json`, `pnpm-lock.yaml`
- **Verification:** `pnpm --filter @sembridge/gateway exec tsc --noEmit` exit 0 dopo il fix.
- **Committed in:** `55220ee` (Task 2 commit)

**2. [Rule 3 - Blocking] Estensione barrel `routing/src/index.ts` con `export type * from './types'`**

- **Found during:** Task 2 (types gateway HTTP)
- **Issue:** Anche dopo l'aggiunta della workspace dep, tsc del gateway falliva con `TS2305: Module '"@sembridge/routing"' has no exported member 'BackpressurePolicyConfig'` (e altri 4). Il barrel `packages/routing/src/index.ts` (post plan 03-01) era ancora `export {}` placeholder — il `dist/index.d.ts` generato non includeva i tipi di `./types/`.
- **Fix:** Sostituito `export {}` con `export type * from './types'` in `packages/routing/src/index.ts`. Ribuildato `@sembridge/routing` (dts ora 16.09 KB con tutti i tipi). Modifica documentata anche dal plan stesso ("Plan 03-02 popola i type exports") quindi era nello scope.
- **Files modified:** `packages/routing/src/index.ts`
- **Verification:** `pnpm --filter @sembridge/gateway exec tsc --noEmit` exit 0 + `pnpm --filter @sembridge/routing exec tsc --noEmit` exit 0 (no regression).
- **Committed in:** `55220ee` (Task 2 commit, insieme al primo fix)

---

**Total deviations:** 2 auto-fixed (entrambi Rule 3 - Blocking)
**Impact on plan:** Entrambi i fix necessari per la risoluzione dei tipi cross-package; nessuno scope creep — l'edge `gateway → routing` è inevitabile dato il design D-83 (composition wrapper) + Strategy Pattern (D-68) dove il gateway implementa interface basate sui descriptor del routing. La modifica al barrel routing era già anticipata dal plan stesso ("Plan 03-02 popola i type exports").

## Issues Encountered

Nessuno significativo. I 2 errori di typecheck riscontrati durante Task 2 erano blockers prevedibili (workspace edge + barrel export), risolti immediatamente via Rule 3.

## Verification Output

```bash
$ pnpm --filter @sembridge/routing exec tsc --noEmit
# exit 0 — 0 errori

$ pnpm --filter @sembridge/gateway exec tsc --noEmit
# exit 0 — 0 errori

$ pnpm --filter @sembridge/core test
# Test Files  24 passed (24) | Tests  248 passed (248)

$ pnpm --filter @sembridge/mapper test
# Test Files  16 passed (16) | Tests  183 passed (183)
```

**Vincolo D-83 confermato:** core 248/248 + mapper 183/183 invariati. Zero modifiche runtime a `packages/core/src/` né `packages/mapper/src/`.

## Bundle size impact

I tipi sono `export type *` — zero runtime emesso. L'unica runtime export è `isGatewayErrorCode` (~150 B gzip stimati con Set + funzione + string codes). Bundle budget routing/gateway invariato rispetto a baseline plan 03-01 (13 B skeleton); il prossimo build effettivo (plan 03-04+) misurerà il delta.

## Note per i plan downstream

- **Plan 03-03** (augment routing — declaration merging): riusa `RouteDefinition` per estendere `PluginDescriptor.routes?: readonly RouteDefinition[]`; `RoutingConfig` per estendere `BrokerConfig.routing?`; `CanonicalSchema.requiresRoute?: boolean` (D-95).
- **Plan 03-04** (augment gateway — declaration merging): riusa `GatewayConfig` per estendere `BrokerConfig.gateway?`. Side-effect import + `sideEffects` array già configurati da plan 03-01.
- **Plan 03-05** (route-resolver): consuma `RouteDefinition` (compile via discriminator switch) + `RoutingConfig.multipleRoutesPolicy` (strategy resolution).
- **Plan 03-08+** (http-gateway + strategies): implementa le 7 `*Strategy` interface come default classes (`ExponentialBackoffWithJitter`, `FixedTimeout`, `KeyBased`, `LatestOnly`, `BearerHook`, `AutoIdempotency`, `PerRouteCircuitBreaker`).
- **Plan 03-12** (RouterBroker): consuma `RoutingConfig.requiresRouteTopics` per chiusura BLOCKER 4 (D-100).
- **F4** (realtime SSE/WS): potrà aggiungere `RouteRealtimeDefinition` al union via TS declaration merging additive senza breaking change.
- **F5** (worker): idem per `RouteWorkerDefinition`.

## Self-Check: PASSED

**File creati verificati:**
- `packages/routing/src/types/route-definition.ts` ✅
- `packages/routing/src/types/route-policies.ts` ✅
- `packages/routing/src/types/route-outcome.ts` ✅
- `packages/routing/src/types/routing-config.ts` ✅
- `packages/routing/src/types/index.ts` ✅
- `packages/gateway/src/http/types/gateway-config.ts` ✅
- `packages/gateway/src/http/types/http-strategies.ts` ✅
- `packages/gateway/src/http/types/http-error.ts` ✅
- `packages/gateway/src/http/types/index.ts` ✅

**Commit verificati in `git log --oneline`:**
- `2683895` Task 1 — feat(03-02): pubblica type contracts F3 routing ✅
- `55220ee` Task 2 — feat(03-02): pubblica type contracts F3 gateway/http ✅

**TS errors:** 0 entrambi i package, exit 0.

**No regressions D-83:** core 248/248 + mapper 183/183 test invariati.

---
*Phase: 03-routing-server-gateway-http*
*Completed: 2026-04-30*
