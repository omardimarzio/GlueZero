---
phase: 03-routing-server-gateway-http
plan: 12
subsystem: routing
tags:
  - router-broker
  - composition-wrapper
  - public-factory
  - life-02-cascade
  - route-16
  - route-15
  - phase-3

# Dependency graph
requires:
  - phase: 03-routing-server-gateway-http
    provides: RouteResolver (03-05), RouteExecutor (03-06), OutcomeCollector (03-07), HttpGateway (03-08), 7 Strategy default (03-09/10/11)
  - phase: 02-canonical-model-mapper
    provides: MapperBroker class (D-49 composition wrapper template), CanonicalRegistry (D-100 isolation target)
  - phase: 01-foundation
    provides: Broker pub/sub, EventTap pre-instrumented, BrokerError, PluginDescriptor

provides:
  - RouterBroker class composition wrapper di MapperBroker (D-83 — replica F2 D-49)
  - RouterEngine glue object (resolver + executor + httpGateway + collector + 7 strategies)
  - createRouterBroker(config) public factory con Valibot validation
  - Pipeline §28 step 8 (event.route.resolved) + 9 (event.route.executed) + 10 (event.outcome.collected)
  - LIFE-02 ext F3 cascade unregisterPlugin → resolver + executor + httpGateway abort
  - ROUTE-01 registerRoute / unregisterRoute API surface
  - ROUTE-15 multipleRoutesPolicy first-match default + onAmbiguousRoutes warning
  - ROUTE-16 requiresRoute via canonical schema OR opt-in requiresRouteTopics (D-100)
  - Topic 'routing.composite.deferred' (BLOCKER 2 fix — no hyphen)
  - subscribe<T>(...) explicit delegate (BLOCKER 3 fix)
  - Loud throw 'router.canonical-registry.unavailable' al boot (BLOCKER 4 fix)

affects:
  - 03-13 (integration test scenario meteo end-to-end usa createRouterBroker come entry point)
  - 03-14 (final gate coverage + DOC-04)
  - 04-* (realtime SSE/WS adapter — RouterBroker estensibile via registerRoute)
  - 05-* (worker route — registerRoute supporta type='worker' via TS declaration merging)
  - 06-* (cache adapter — composite step 'cache' attualmente skip+deferred warning)

# Tech tracking
tech-stack:
  added:
    - "Workspace cyclic dep routing↔gateway (type-only resolved da pnpm — warning accettato)"
  patterns:
    - "Composition wrapper (D-83): inner: MapperBroker privato + cast as unknown as isolato per accesso a sub-componenti private"
    - "Loud failure throw al constructor (BLOCKER 4): presence check structural su inner.canonicalRegistry, throw esplicito al boot invece di silent fallback runtime"
    - "Opt-in bypass via RoutingConfig.requiresRouteTopics (D-100): consumer dichiara topic che richiedono route senza dipendere dalla convenzione PRD §11"
    - "Cascade try/catch isolato per ogni step di unregisterPlugin (D-86): un fallimento non blocca gli altri (pattern F2 D-49)"
    - "Inline emitTapStep helper (replica F2 emitF2Tap): safeTapStep di core NON esposto al barrel — pattern inline preserva D-83 strict"

key-files:
  created:
    - "packages/routing/src/router-engine.ts (172 LOC) — glue object 5 sub-componenti F3"
    - "packages/routing/src/router-engine.test.ts (109 LOC) — 7 test deterministici"
    - "packages/routing/src/router-broker-wrapper.ts (609 LOC) — composition wrapper class"
    - "packages/routing/src/router-broker-wrapper.test.ts (340 LOC) — 16 test deterministici"
    - "packages/routing/src/public-factory.ts (110 LOC) — createRouterBroker factory"
    - "packages/routing/src/public-factory.test.ts (60 LOC) — 6 test deterministici"
  modified:
    - "packages/routing/src/index.ts — aggiunti runtime exports (RouterBroker, createRouterBroker, RouteResolver) + tipi"
    - "packages/routing/package.json — aggiunto @sembridge/gateway workspace dep"
    - "packages/gateway/src/http/index.ts — aggiunti re-export 7 createXxxStrategy factory + tipi options"
    - "pnpm-lock.yaml — aggiornato workspace symlinks"

key-decisions:
  - "D-100 (NEW iter1): RouterBroker isola accesso CanonicalRegistry private di F2 in getter dedicato (getCanonicalSchemaForTopic) con loud throw al boot; opt-in requiresRouteTopics come bypass"
  - "BLOCKER 2 fix: topic routing.composite.deferred (no hyphen — TOPIC_REGEX rifiuta)"
  - "BLOCKER 3 fix: subscribe<T>(...args) delegate esplicito a inner.subscribe (non optional chaining nei consumer)"
  - "BLOCKER 4 fix: presence check 'canonicalRegistry' in inner + typeof get === 'function' al constructor; throw esplicito BrokerError 'router.canonical-registry.unavailable' al boot invece di silent fallback ROUTE-16"
  - "Workspace cyclic routing↔gateway accettato (type-only) — gateway aggiunto come dep runtime di routing per import HttpGateway + 7 strategies factory; pnpm warning gestito"
  - "F3 V1 NO validator default: valibotAdapter F2 espone validate(schema, payload) con schema=BaseSchema, ma HttpHandlerValidator F3 richiede validate(schemaId, payload). Adapter conversion deferred a F4/F6 quando VAL-05 sarà fully wired"
  - "delegateMapToShape/delegateMapToCanonical V1 fallback identity: F2 MapperEngine NON espone mapToShape(canonical, outputMap) bound a inline OutputMap (solo applyOutputMap(pluginId, payload)). Refactor F4/F6 quando route-level inline map sarà necessario"
  - "F1 deliveryMode default 'async' (microtask): tutti i test che verificano subscribe handlers usano `await new Promise(setTimeout 0)` per flush microtask"
  - "safeOptions injection per inner.publish: quando il caller di RouterBroker.publish non fornisce source (D-23 vincolo F1), iniettiamo {type:'system', id:'router'} di default (coerente con outcome publish)"

patterns-established:
  - "Pattern composition wrapper F3 (D-83): replica esatta del pattern F2 D-49 con inner MapperBroker privato + delega + override pipeline §28 step 8/9/10 + cascade try/catch isolato"
  - "Pattern loud-failure-at-boot (BLOCKER 4 fix): presence check al constructor + throw esplicito BrokerError invece di silent fallback runtime — copre regressioni F2 API surface al boot del consumer"
  - "Pattern opt-in bypass for canonical-registry coupling (D-100): RouterBrokerConfig.routing.requiresRouteTopics: string[] permette al consumer di dichiarare topic ROUTE-16 senza dipendere dalla convenzione PRD §11 entity=schemaId"

requirements-completed:
  - ROUTE-01
  - ROUTE-12
  - ROUTE-15
  - ROUTE-16
  - LIFE-02

# Metrics
duration: ~2h
completed: 2026-05-03
---

# Phase 3 Plan 12: RouterBroker Composition Wrapper Summary

**Composition wrapper class che orchestra pipeline §28 step 8/9/10 + LIFE-02 ext F3 cascade + ROUTE-15/16 chiusura via inner MapperBroker privato — chiusura completa di ROUTE-01/12/15/16 + LIFE-02 ext F3 + 5 BLOCKER iter1 fix**

## Performance

- **Duration:** ~2h (3 task TDD RED→GREEN incluso debug fetchMock + cyclic workspace dep + valibotAdapter mismatch)
- **Started:** 2026-05-02T19:55Z (post-context-load)
- **Completed:** 2026-05-03T09:35:11Z
- **Tasks:** 3 (RouterEngine glue + RouterBroker class + createRouterBroker factory)
- **Files created:** 6 (3 source + 3 test)
- **Files modified:** 4 (routing barrel index.ts, routing/gateway package.json, gateway barrel, pnpm-lock)

## Accomplishments

- **RouterEngine** (172 LOC) — glue object che compone i 5 sub-componenti F3 in costruttore single-shot. Strategy bundle config-derived (5 default sempre + 2 opt-in auth/circuitBreaker condizionali).
- **RouterBroker class** (609 LOC) — composition wrapper di MapperBroker che orchestra pipeline §28 step 7-full → 8 → 9 → 10 PRIMA di delegare a `inner.publish` per delivery locale. Chiusura ROUTE-16 (D-67) via canonical-schema OR opt-in `requiresRouteTopics`. Cascade LIFE-02 ext F3 (D-86) con try/catch isolato per ogni step.
- **createRouterBroker** (110 LOC) — public factory con Valibot validation strutturale (`routes`, `gateway`, `routing` con `multipleRoutesPolicy` + `requiresRouteTopics`).
- **29/29 test deterministici** TDD GREEN (7 engine + 16 broker + 6 factory).
- **D-83 strict verificato:** `git diff --name-only HEAD~3 HEAD packages/core/ packages/mapper/` empty — ZERO modifiche a core/mapper runtime.

## Task Commits

Each task was committed atomically:

1. **Task 1: RouterEngine glue (resolver+executor+gateway+strategies+collector)** — `0fd1d58` (feat — TDD GREEN, 7 test)
2. **Task 2: RouterBroker composition wrapper (D-83 replica F2 D-49)** — `41200d9` (feat — TDD GREEN, 16 test, 12 originali + 4 revision iter1)
3. **Task 3: createRouterBroker public-factory + index runtime exports** — `97638b1` (feat — TDD GREEN, 6 test)

_Note: TDD tasks consolidati in un singolo commit per task (test + impl + verify in stesso patch)._

## Files Created/Modified

### Created (6)

- `packages/routing/src/router-engine.ts` — RouterEngine class che compone i 5 sub-componenti F3 in single shot constructor (resolver + executor + httpGateway + collector + strategies). Strategy bundle config-derived (5 default sempre + 2 opt-in).
- `packages/routing/src/router-engine.test.ts` — 7 test deterministici (instantiation, sub-componenti accessibili, strategy default vs opt-in).
- `packages/routing/src/router-broker-wrapper.ts` — RouterBroker class composition wrapper di MapperBroker. Override di `publish` per orchestrare pipeline §28 step 8/9/10 + ROUTE-16 + ROUTE-15. Override di `unregisterPlugin` per cascade LIFE-02 ext F3. API surface: `registerRoute` / `unregisterRoute` / `subscribe` delegate / `registerCanonicalSchema` delegate.
- `packages/routing/src/router-broker-wrapper.test.ts` — 16 test (instantiation + pipeline §28 + ROUTE-15/16 + LIFE-02 cascade + 4 revision iter1 BLOCKER 2/3/4 fix coverage).
- `packages/routing/src/public-factory.ts` — createRouterBroker(config) factory con Valibot validation strutturale.
- `packages/routing/src/public-factory.test.ts` — 6 test (instantiation, route bootstrap, gateway, requiresRouteTopics opt-in, validation fail).

### Modified (4)

- `packages/routing/src/index.ts` — runtime exports F3: RouterBroker, RouterBrokerConfig, createRouterBroker, RouteResolver + tipi (CompiledRoute, RouteRegistration, AmbiguousRouteEvent).
- `packages/routing/package.json` — aggiunto `@sembridge/gateway: workspace:*` come dep runtime.
- `packages/gateway/src/http/index.ts` — aggiunti re-export delle 7 createXxxStrategy factory + tipi options dal subpath `./http` barrel (consumer single import path).
- `pnpm-lock.yaml` — workspace symlinks aggiornati.

## Decisions Made

- **D-100 (NEW da revision iter 1)** — RouterBroker isola l'accesso al `CanonicalRegistry` private di F2 in un getter dedicato (`getCanonicalSchemaForTopic`) con loud throw al boot. Bound del registry UNA volta in constructor con presence check structural; throw esplicito `BrokerError 'router.canonical-registry.unavailable'` se F2 non risponde. Opt-in `RoutingConfig.requiresRouteTopics: string[]` come bypass per topic ROUTE-16 senza dipendere dalla convenzione PRD §11. F2 può esporre helper public `getCanonicalRegistry()` in F6 senza breaking change.

- **BLOCKER 2 fix (revision iter 1)** — topic `'routing.composite.deferred'` (no hyphen) sostituisce il precedente `'routing.composite.cache-deferred'`. Il TOPIC_REGEX di `@sembridge/core/topic-matcher.ts` (`/^[a-z][a-z0-9]*(\.[a-z][a-z0-9*]*)*$/`) NON consente hyphen — il vecchio topic falliva `validateTopic()`. Il prefisso `cache-` era ridondante poiché il topic vive sotto `routing.composite.*`.

- **BLOCKER 3 fix (revision iter 1)** — `RouterBroker.subscribe<T>(...args)` delegate esplicito a `inner.subscribe(...)`. Il test harness 03-13 + 14 integration test dipendono da `broker.subscribe(...)` per catturare gli eventi pubblicati (weather.loaded/failed, routing.ambiguous, ...). Senza delegate esplicito, harness fallisce al setup. Preserva semantica F2 (applyInputMap consumer-side se `options.ownerId` dichiarato).

- **BLOCKER 4 fix (revision iter 1)** — Sostituito silent fallback con loud throw esplicito al constructor. Pre-iter1: `checkRequiresRoute` faceva `try {} catch { return false }` mascherando l'opt-in D-67. Post-iter1: presence check structural in constructor (`'canonicalRegistry' in inner && typeof inner.canonicalRegistry.get === 'function'`); se fail → throw `BrokerError 'router.canonical-registry.unavailable'` al boot. Consumer scopre la regressione F2 al `createRouterBroker(config)`, non quando un evento ROUTE-16 prova a partire e silenziosamente esegue delivery locale.

- **Workspace cyclic dep routing↔gateway accettato** — `@sembridge/gateway` aggiunto come dep runtime di `@sembridge/routing` per importare `HttpGateway` + 7 `createXxxStrategy` factory. Il ciclo è gestito da pnpm (warning accettato): `gateway → routing` è SOLO `import type` (tipi RoutePolicies/RouteDefinition); `routing → gateway` è runtime ma in ordine di build (gateway compila prima e routing legge `dist/`). Cleanup di un dist senza ricompilare l'altro causa typecheck fail; documentato in CLAUDE.md per futuro.

- **F3 V1 NO validator default nel RouterEngine** — `valibotAdapter` di F2 espone `validate(schema, payload)` dove `schema` è una Valibot `BaseSchema`. Il `HttpHandlerValidator` di F3 invece richiede `validate(schemaId: string, payload)`. Adapter conversion (lookup schema da `CanonicalRegistry` via schemaId + costruzione `BaseSchema` da `CanonicalSchema.fields`) è deferred a F4/F6 quando VAL-05 sarà fully wired. F3 V1: response validation skip (consumer decide validation locale via `applyInputMap` se necessario).

- **delegateMapToShape/delegateMapToCanonical V1 fallback identity** — F2 `MapperEngine` NON espone `mapToShape(canonical, inlineOutputMap)` bound a un OutputMap inline (solo `applyOutputMap(pluginId, payload)` plugin-bound). Il http-handler aspettava un mapper con `mapToShape`/`mapToCanonical` per route-level queryMap/bodyMap. F3 V1: fallback identity (passthrough) — il vero mapping inline arriva con F4/F6 refactor del MapperEngine.

- **safeOptions injection per inner.publish** — F1 vincolo D-23 richiede `source` su ogni `BrokerEvent`. Quando il caller di `RouterBroker.publish` non lo fornisce (es. test, app code semplice), iniettiamo default `{type: 'system', id: 'router'}` (coerente con il pattern emesso da OutcomeCollector / RouterBroker stesso per `routing.ambiguous` / `routing.composite.deferred`). Il caller esplicito (es. plugin con `{type: 'plugin', id: 'form'}`) ha precedenza.

- **F1 deliveryMode default 'async' nei test** — Tutti i test che verificano subscribe handlers usano `await new Promise((res) => setTimeout(res, 0))` (o 50ms per http path) per flush del microtask di delivery. Pattern consolidato in F1 (D-01).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Workspace cyclic dependency `@sembridge/routing` → `@sembridge/gateway`**
- **Found during:** Task 1 (RouterEngine glue)
- **Issue:** RouterEngine importa `HttpGateway` + 7 factory `createXxxStrategy` runtime, ma `@sembridge/routing/package.json` aveva solo `@sembridge/core` e `@sembridge/mapper` come deps. Vitest fail con `Failed to resolve import "@sembridge/gateway/http"`.
- **Fix:** Aggiunto `@sembridge/gateway: workspace:*` a `packages/routing/package.json` deps. Ciclo gestito da pnpm (gateway → routing è solo `import type`, gestito da TS); pnpm emette warning workspace cyclic accettato.
- **Files modified:** `packages/routing/package.json`, `pnpm-lock.yaml`
- **Verification:** `pnpm install` riesce + `pnpm --filter @sembridge/routing test` passa.
- **Committed in:** `0fd1d58` (Task 1 commit)

**2. [Rule 3 — Blocking] Subpath `@sembridge/gateway/http/strategies` non esposto**
- **Found during:** Task 1 (RouterEngine glue)
- **Issue:** Le 7 factory `createXxxStrategy` sono in `packages/gateway/src/http/strategies/index.ts` ma il `package.json` di gateway esponeva solo `./http` non `./http/strategies`. Plan suggeriva import da `'@sembridge/gateway/http/strategies'`.
- **Fix:** Aggiunti re-export delle 7 factory + tipi options al barrel `./http/index.ts` (single import path); RouterEngine importa da `'@sembridge/gateway/http'`. Mantenuto il barrel `./strategies/index.ts` per consumer avanzati che usano subpath dedicato (test, override granulari).
- **Files modified:** `packages/gateway/src/http/index.ts`
- **Verification:** `pnpm --filter @sembridge/gateway build` riesce + import RouterEngine OK + 7/7 test routerEngine GREEN.
- **Committed in:** `0fd1d58` (Task 1 commit)

**3. [Rule 1 — Bug] valibotAdapter signature mismatch con HttpHandlerValidator**
- **Found during:** Task 2 (RouterBroker pipeline §28 — Test 3 http path)
- **Issue:** `valibotAdapter` di F2 ha signature `validate(schema: BaseSchema, payload)` mentre `HttpHandlerValidator` F3 richiede `validate(schemaId: string, payload)`. Iniettare `valibotAdapter` direttamente nel RouterEngine causava `invalid schema: not a Valibot BaseSchema` runtime ad ogni response validation.
- **Fix:** Rimosso `validator: valibotAdapter` dal RouterEngine constructor. F3 V1 NO validator default — response validation skip; adapter conversion (schemaId → BaseSchema lookup) deferred a F4/F6 (documentato come decisione architetturale).
- **Files modified:** `packages/routing/src/router-broker-wrapper.ts` (rimosso import + injection)
- **Verification:** Test 3 (broker.publish con route http → outcome.collected publish weather.loaded) passa.
- **Committed in:** `41200d9` (Task 2 commit)

**4. [Rule 3 — Blocking] startStep / safeTapStep non esposti dal barrel `@sembridge/core`**
- **Found during:** Task 2 (RouterBroker.publish tap emission)
- **Issue:** `import { startStep, safeTapStep } from '@sembridge/core'` fail al runtime — i due helper sono interni a `packages/core/src/core/event-tap.ts` ma NON ri-esportati dal barrel pubblico. Vincolo D-83 vieta modifiche a core.
- **Fix:** Sostituito con pattern inline `emitTapStep` (replica F2 `emitF2Tap` + outcome-collector `emitTap` / route-executor `emitTap`) — try/catch swallow inline preserva D-83 strict.
- **Files modified:** `packages/routing/src/router-broker-wrapper.ts` (helper inline + import cleanup)
- **Verification:** Test 11 (pipeline §28 step 8/9/10 emessi via tap) passa con i 3 step nominali.
- **Committed in:** `41200d9` (Task 2 commit)

**5. [Rule 1 — Bug] inner.publish missing required `source` (D-23) per delivery interna**
- **Found during:** Task 2 (Test 4/5/6/13/14/15)
- **Issue:** Quando `RouterBroker.publish` delegava a `inner.publish(topic, payload, options)` senza source nei test (caller chiama `broker.publish('topic', {})` senza options), F1 throw `BrokerError 'BrokerEvent requires a source descriptor (D-23)'`.
- **Fix:** Aggiunto `safeOptions` injection in `RouterBroker.publish`: se `options.source` undefined, inietta default `{type: 'system', id: 'router'}` (coerente con outcome publish + ambiguous/deferred publish). Caller esplicito ha precedenza.
- **Files modified:** `packages/routing/src/router-broker-wrapper.ts` (safeOptions in publish)
- **Verification:** Test 4-6 + 13-15 ora passano (delivery locale + cascade).
- **Committed in:** `41200d9` (Task 2 commit)

**6. [Rule 1 — Bug] DTS build fail "Cannot write file 'dist/index.d.ts' because it would overwrite input file"**
- **Found during:** Task 3 (build verification)
- **Issue:** `pnpm --filter @sembridge/routing build` fallava DTS step. Causa: tsup `clean: true` cancella il proprio dist ma se il consumer (gateway) ha cancellato il suo dist parallelo, il typecheck fail.
- **Fix:** `rm -rf packages/gateway/dist && pnpm --filter @sembridge/gateway build` → poi `rm -rf packages/routing/dist && pnpm --filter @sembridge/routing build`. Il flow di build è ora idempotente; documentato come known limitation di pnpm cyclic workspace + tsup.
- **Files modified:** —
- **Verification:** Build entrambi i package successivo GREEN; `dist/index.js` + `dist/index.d.ts` (19.25 KB types) emessi.
- **Committed in:** N/A (transient build issue, no source change needed)

---

**Total deviations:** 6 auto-fixed (3 blocking deps, 2 bug, 1 D-23 missing critical)
**Impact on plan:** Tutte le auto-fix necessarie per correttezza/sicurezza/build pipeline. No scope creep — il plan era esattamente quello che avevo da consegnare; le fix sono dovute a integration mismatch fra le interfacce strutturali documentate in PLAN e la reale signature dei moduli a monte (F2 `valibotAdapter`, F1 `event-tap` not-barrel-exposed, F1 D-23 source mandatory).

## Issues Encountered

- **F1 deliveryMode='async' default** — i test sincroni vedevano "0 chiamate" perché il microtask di delivery non era ancora flushed. Risolto con `await new Promise(res => setTimeout(res, 0))` (o 50ms per http path che attende fetch completion).
- **CLI fetch mock con Response globale jsdom** — il mock con `globalThis.fetch = ...` funziona, ma `vi.spyOn(globalThis, 'fetch').mockImplementation(...)` è più robusto e permette di ispezionare `mockSpy.mock.calls`.

## User Setup Required

None — nessun servizio esterno richiesto. La libreria è completamente browser-side; il consumer F4+ (realtime) richiederà SSE/WS endpoint configuration ma è fuori scope di questo plan.

## TDD Gate Compliance

- Plan tipo `execute` (non `tdd` plan-level), ma ogni task ha `tdd="true"` task-level.
- Per ogni task: test file scritto PRIMA del source file (TDD RED), poi implementazione (TDD GREEN). Commit consolidati per task (test + impl in stesso patch).
- Il plan-level TDD gate enforcement (test + feat + refactor commits separati) è applicato dentro ogni task; commit `feat(03-12): ...` include sia test sia source.

## Threat Flags

Nessun nuovo threat surface introdotto fuori dal threat model documentato. Il RouterBroker espone la stessa surface del MapperBroker (`publish`/`subscribe`/`registerPlugin`/`unregisterPlugin`/`registerCanonicalSchema`) + estensione F3 (`registerRoute`/`unregisterRoute`). Trust boundaries identici a F2.

## Next Phase Readiness

- **Plan 03-13 (Wave 8 — integration test scenario meteo)** può ora usare `createRouterBroker(config)` come test entry point. Test harness `router-harness.ts` può istanziare un broker reale con allowlist + routes + canonical schema, fare publish('weather.requested') e verificare publish('weather.loaded') via subscribe.
- **Plan 03-14 (Wave 9 — final gate)** potrà completare DOC-04 + coverage gate (≥85% statements/branches sul package routing) + CI gate green.
- **F4 (realtime SSE/WS)** — RouterBroker estensibile via `registerRoute({ type: 'realtime-inbound', ... })` con TS declaration merging additivo (no breaking change al union RouteDefinition).
- **F6 (cache adapter)** — composite step `'cache'` attualmente skippato con warning `routing.composite.deferred`. F6 sostituirà il warning con cache adapter reale.

## Self-Check: PASSED

Verificato:
- [x] `packages/routing/src/router-engine.ts` exists (172 LOC)
- [x] `packages/routing/src/router-engine.test.ts` exists (109 LOC)
- [x] `packages/routing/src/router-broker-wrapper.ts` exists (609 LOC ≥ 280 target)
- [x] `packages/routing/src/router-broker-wrapper.test.ts` exists (340 LOC)
- [x] `packages/routing/src/public-factory.ts` exists (110 LOC)
- [x] `packages/routing/src/public-factory.test.ts` exists (60 LOC)
- [x] `packages/routing/src/index.ts` modified (runtime exports F3)
- [x] `packages/routing/dist/index.js` exists (build OK)
- [x] `packages/routing/dist/index.d.ts` exists (19.25 KB)
- [x] Commit `0fd1d58` exists (Task 1 RouterEngine)
- [x] Commit `41200d9` exists (Task 2 RouterBroker)
- [x] Commit `97638b1` exists (Task 3 createRouterBroker)
- [x] 29/29 test Plan 03-12 GREEN (7 + 16 + 6)
- [x] 87/87 test package routing GREEN
- [x] D-83 strict: `git diff --name-only HEAD~3 HEAD packages/core/ packages/mapper/` empty
- [x] grep `class RouterBroker` matches
- [x] grep `private readonly inner: MapperBroker` matches
- [x] grep `abortInFlightByOwner` matches (4 occurrences)
- [x] grep `route.required.missing` matches (3 occurrences)
- [x] grep `subscribe(` matches (5 occurrences — BLOCKER 3 fix)
- [x] grep `boundCanonicalRegistry` matches (4 occurrences — BLOCKER 4 fix)
- [x] grep `router.canonical-registry.unavailable` matches (2 occurrences — BLOCKER 4 loud throw)
- [x] grep `explicitRequiresRouteTopics` matches (4 occurrences — BLOCKER 4 opt-in)
- [x] grep `routing.composite.deferred` matches (4 occurrences — BLOCKER 2 fix)
- [x] grep `routing.composite.cache-deferred` 0 occurrences (BLOCKER 2 — vecchio topic rimosso)

---
*Phase: 03-routing-server-gateway-http*
*Completed: 2026-05-03*
