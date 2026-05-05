---
phase: 03-routing-server-gateway-http
plan: 06
subsystem: route-executor-handlers
tags:
  - executor
  - route-handlers
  - phase-3
  - routing
  - abort-controller
  - dispatch-by-type
  - cascade-life-02
dependency-graph:
  requires:
    - phase: 03-02
      provides: "@gluezero/routing types (RouteDefinition discriminated, RouteOutcome ok|error, CompiledRoute)"
    - phase: 03-05
      provides: "RouteResolver + CompiledRoute interface (definition, ownerId, priority, requestBuilder)"
    - phase: 01
      provides: "@gluezero/core (createBrokerError factory, BrokerEvent, EventTap, PipelineStep, PipelineSnapshot)"
  provides:
    - "RouteExecutor class con execute/abortInFlight/abortInFlightByOwner/inFlightCount (D-65 dispatch by type)"
    - "RouteExecutorDeps interface (httpHandler DI + resolveSubRoute + tap + onCacheDeferred)"
    - "localHandler (passthrough sync RouteOutcome.ok — ROUTE-02)"
    - "cacheHandler (stub F6 — 'cache.not-implemented' RouteOutcome.error)"
    - "createCompositeHandler (factory async con cache-deferred warning una volta — Q3 opzione b)"
    - "CompositeHandlerDeps interface (httpHandler + resolveSubRoute + onCacheDeferred)"
    - "Map<eventId, InFlightEntry> registry per AbortController tracking per cascade D-86"
    - "EventTap step 9 'event.route.executed' emit con metadata strutturata (try/catch swallow inline)"
  affects:
    - "03-07 (outcome-collector): consuma RouteOutcome ritornato da executor.execute() per step 10"
    - "03-08 (http-handler): fornirà l'implementazione effettiva di httpHandler (qui DI placeholder)"
    - "03-12 (RouterBroker wrapper): istanzia RouteExecutor; bind onCacheDeferred a publish('routing.composite.cache-deferred', ...)"
    - "03-13 (LIFE-02 cascade ext): RouterBroker.unregisterPlugin invocherà executor.abortInFlightByOwner(pluginId)"
tech-stack:
  added: []
  patterns:
    - "Dispatch by type (D-65 / RESEARCH §E): switch su route.definition.type; default branch → RouteOutcome.error 'route.type.unknown' (no throw)"
    - "Dependency Injection per httpHandler (file ownership separato Wave 4): plan 03-06 dichiara la firma; plan 03-08 fornisce la vera implementazione del gateway HTTP. Permette test isolati con mock"
    - "AbortController registry: Map<eventId, {controller, ownerId, routeId}> con finally cleanup per O(1) lookup + cascade abort by ownerId"
    - "Composite handler factory closure pattern: cacheWarnEmitted flag chiuso nella closure → warning UNA SOLA volta per istanza handler (Q3 opzione b — alias HTTP-only finché F6 non collega cache adapter)"
    - "EventTap emit inline con try/catch swallow (replica pattern F2 emitF2Tap di broker-mapper-wrapper.ts:325): safeTapStep di @gluezero/core NON è esposto al barrel pubblico, quindi inline pattern preserva D-83 strict (no cross-package internal coupling)"
    - "Conditional spread `...(deps.onCacheDeferred !== undefined && { onCacheDeferred })` per exactOptionalPropertyTypes: true (mai undefined assignment esplicito)"
    - "Sub-route resolve via DI (resolveSubRoute callback): il composite handler non ha riferimento diretto al RouteResolver; il RouterBroker wrapper plan 03-12 fa il binding"
key-files:
  created:
    - "packages/routing/src/route-executor.ts"
    - "packages/routing/src/route-executor.test.ts"
    - "packages/routing/src/route-handlers/local-handler.ts"
    - "packages/routing/src/route-handlers/cache-handler.ts"
    - "packages/routing/src/route-handlers/composite-handler.ts"
    - "packages/routing/src/route-handlers/index.ts"
    - "packages/routing/src/route-handlers/handlers.test.ts"
  modified: []
key-decisions:
  - "**httpHandler via Dependency Injection** (file ownership separato Wave 4): plan 03-06 dichiara la firma `(event, route, signal) => Promise<RouteOutcome>`; plan 03-08 fornirà la vera implementazione del gateway HTTP nel route-handlers/http-handler.ts. Permette plan 03-06/07/08 di parallelizzarsi su file disgiunti senza dipendenza forte di build order."
  - "**Composite handler factory closure** invece di class: createCompositeHandler ritorna una funzione con `cacheWarnEmitted` chiuso nella closure. Test 5 verifica esplicitamente warn=1 dopo 3 invocazioni successive → semantica `una sola volta per istanza handler`."
  - "**EventTap emit inline** (try/catch swallow) invece di import da `safeTapStep` di core: `safeTapStep` non è esposto al barrel `@gluezero/core` (`packages/core/src/index.ts`). Esportarlo violerebbe D-83 strict (modifica a packages/core/). Replica del pattern F2 `emitF2Tap` (broker-mapper-wrapper.ts:325) — try/catch swallow inline. Auditabile via grep nel package routing."
  - "**Test 8 default branch via cast** invece di estensione tipo: route.type='worker' è F5 future. Il test usa `as unknown as CompiledRoute` per forzare un type literale non coperto dal switch — verifica difensiva del default branch (T-03-06-03 mitigation)."
  - "**`finally` cleanup inFlight** garantisce che ogni `execute()` rimuova l'entry indipendentemente dal branch (success/error/throw). Mitiga T-03-06-02 (DoS — Map unbounded). Cleanup avviene PRIMA dell'emitTap perché lo step 9 cattura outcome già nel local snapshot."
  - "**Sub-route signal sharing nel composite**: il composite delega l'http step via `httpHandler(e, subRoute, signal)` dove `signal = getOrCreateController(e.id, subRoute).signal`. Lo stesso eventId del composite condivide il controller con il sub-step → abortInFlight(compositeEventId) cancella anche il sub-http (no doppia entry)."
  - "**RouteExecutor mantiene ZERO dipendenza dal RouteResolver runtime**: `resolveSubRoute` è iniettato come callback. Plan 03-12 RouterBroker fa il binding `(id) => resolver.list().find((r) => r.id === id)`. Coerente con composition wrapper pattern D-83."
  - "**Handler `local` (23 LOC inclusi header)** rispetta vincolo plan ≤30 LOC: pure passthrough con conditional outcome literal."
patterns-established:
  - "**Dispatch by type via switch + default error literal**: pattern replicabile per FUTURI executor F5 (worker route type) — switch case extension via TS declaration merging del RouteDefinition discriminated union; default branch cattura type sconosciuti senza throw."
  - "**AbortController registry by eventId con cascade by ownerId**: pattern replicabile per future aggregazioni (HttpGateway in-flight requests, plan 03-08+; SSE/WS connection registry, F4; Worker task tracking, F5). Same shape: Map<id, {controller, ownerId, ...}> + abortInFlight(id) + abortInFlightByOwner(ownerId)."
  - "**Composite handler factory closure con flag emit-once**: pattern replicabile per warning dev-mode che devono essere idempotenti (es. allowlist-missing F3 plan 03-09, gateway.timeout-exceeded warning F3 plan 03-09)."
  - "**Tap emit inline (try/catch swallow) invece di import safeTapStep**: pattern strict D-83 per qualsiasi package non-core che emette PipelineStep. Replica F2 emitF2Tap. Da centralizzare in F6 quando core esporrà subpath internal o helper."
  - "**Dependency Injection per cross-plan parallelization**: plan A dichiara firma DI; plan B fornisce implementazione. Permette wave parallelizzata senza dipendenza di build order. Plan 03-06 (executor) ↔ plan 03-08 (http-handler)."
requirements-completed:
  - "ROUTE-02 (parziale): localHandler implementato — il delivery a subscriber locali via inner.publish è plan 03-12 RouterBroker"
  - "ROUTE-04 (parziale type-only): cacheHandler stub F6 con 'cache.not-implemented'. Adapter cache reale arriva con F6"
  - "ROUTE-05 (parziale workflow): compositeHandler con skip-cache + delega http (Q3 opzione b RESEARCH). Workflow completo check-cache → http → update-cache arriva con F6"
  - "ROUTE-13 (parziale): abortInFlight(eventId) implementato. broker.cancelInFlight(eventId) public API è plan 03-12+"
  - "LIFE-02 ext F3 (parziale): abortInFlightByOwner(ownerId) implementato a livello modulo. Bind RouterBroker.unregisterPlugin → executor.abortInFlightByOwner(pluginId) è plan 03-12+ (D-86)"
metrics:
  duration: "~30 minuti"
  completed_date: "2026-04-30T22:30:00Z"
  commits: 4
  tasks: 2
  files_created: 7
  files_modified: 0
  test_results:
    routing: "43/43 (5 file: handlers.test.ts 5 + route-executor.test.ts 8 + 30 esistenti)"
    core: "248/248 (D-83 strict — invariato)"
    mapper: "183/183 (D-83 strict — invariato)"
  loc:
    route-executor.ts: 261
    local-handler.ts: 23
    cache-handler.ts: 45
    composite-handler.ts: 118
    handlers-index.ts: 15
    handlers.test.ts: 195
    route-executor.test.ts: 295
---

# Phase 3 Plan 06: RouteExecutor + 3 Route Handlers Summary

**One-liner:** RouteExecutor con dispatch-by-type (local/http/cache/composite) + AbortController registry per cascade abort by ownerId (LIFE-02 ext F3, D-86) + 3 route handler (localHandler passthrough, cacheHandler stub F6, createCompositeHandler factory con cache-deferred warning UNA volta — Q3 opzione b RESEARCH).

## Goal

Implementare il dispatch by type del routing engine F3 (D-65, ROUTE-02..05) post-resolver: `RouteExecutor.execute(compiledRoute, event)` switcha sui 4 type della discriminated union RouteDefinition. AbortController tracking per ROUTE-13 (cancellazione user-level) + LIFE-02 ext F3 (cascade abort plugin-scoped, chiusura PRD §39 #7 a livello modulo). 3 handler diretti (`local`/`cache`/`composite`); il 4° handler `http` è declaration-only qui — l'implementazione effettiva è plan 03-08 (parallelizzazione Wave 4 con file ownership disgiunta).

## What Was Built

### Task 1 — Route handlers local/cache/composite (commit `0a690bd` RED + `63e97b9` GREEN)

**`packages/routing/src/route-handlers/local-handler.ts` (23 LOC):**
- `localHandler(event, route)` — pura passthrough sync. Ritorna `RouteOutcome.ok` con `canonicalPayload === event.payload`.
- Vincolo plan ≤30 LOC rispettato (header docs minimal).

**`packages/routing/src/route-handlers/cache-handler.ts` (45 LOC):**
- `cacheHandler(event, route)` stub F6 (D-60, ROUTE-04). Ritorna sempre `RouteOutcome.error` con `code='cache.not-implemented'`, `category='config'`, message esplicito "Cache adapter is implemented in Phase 6 (F6)", `details: { phase: 'F6-pending' }`.
- Threat T-03-06-04 (Information Disclosure) mitigated: details NON include payload.

**`packages/routing/src/route-handlers/composite-handler.ts` (118 LOC):**
- `createCompositeHandler(deps)` factory che ritorna handler async con closure su `cacheWarnEmitted`.
- `CompositeHandlerDeps` interface: `httpHandler` (DI) + `resolveSubRoute` (DI) + `onCacheDeferred` (opt-in callback).
- Workflow F3 (Q3 opzione b RESEARCH):
  1. Trova primo step `'http'` nelle steps. Se assente → `route.composite.no-http`.
  2. Se presente cache step → emit `onCacheDeferred(...)` UNA SOLA VOLTA per istanza handler.
  3. Risolve sub-route via callback → se manca → `route.composite.subroute-missing`.
  4. Delega all'`httpHandler` con il sub-route.
- Cache deferred deferred a F6 (PRD §39 #11 chiusura via Q3 opzione b RESEARCH).

**`packages/routing/src/route-handlers/index.ts` (15 LOC):**
- Barrel: `localHandler`, `cacheHandler`, `createCompositeHandler` + `CompositeHandlerDeps` type.
- `httpHandler` declaration-only: il plan 03-08 fornirà l'implementazione effettiva.

**`packages/routing/src/route-handlers/handlers.test.ts` (195 LOC, 5 test):**
- Test 1: localHandler passthrough → `canonicalPayload === event.payload`.
- Test 2: cacheHandler → `code='cache.not-implemented'`, `category='config'`, shape D-80 (routeId+topic+eventId).
- Test 3: compositeHandler con steps `[{cache},{http,route:'weather-http'}]` → skip cache, invoca httpHandler con sub-route.
- Test 4: compositeHandler senza step http → `code='route.composite.no-http'`.
- Test 5: compositeHandler emit callback `cache-deferred` UNA SOLA volta su 3 invocazioni successive (verifica via spy).

### Task 2 — RouteExecutor dispatch + AbortController registry (commit `3f390e0` RED + `520a93f` GREEN)

**`packages/routing/src/route-executor.ts` (261 LOC):**
- `RouteExecutor` class con:
  - `execute(route, event): Promise<RouteOutcome>` — switch su `route.definition.type`:
    - `'local'`     → `localHandler(event, route)` sync
    - `'http'`      → `await httpHandler(event, route, signal)` async (DI plan 03-08)
    - `'cache'`     → `cacheHandler(event, route)` sync stub F6
    - `'composite'` → `await this.composite(event, route)` async workflow
    - default       → `RouteOutcome.error 'route.type.unknown'` (config, no throw)
  - `abortInFlight(eventId, reason?='gateway.aborted')` → `controller.abort(reason)` puntuale
  - `abortInFlightByOwner(ownerId, reason?='plugin.unregistered')` → cascade D-86 ritorna count
  - `inFlightCount()` debug helper
  - `getOrCreateController(eventId, route)` private — riuso controller per composite (stesso eventId condiviso tra composite e sub-http step)
- `RouteExecutorDeps` interface: `httpHandler` (DI plan 03-08) + `resolveSubRoute` (DI per composite) + `tap?` + `onCacheDeferred?`
- `InFlightEntry` interface privata: `{controller, ownerId, routeId}`
- `Map<eventId, InFlightEntry>` registry per O(1) abort lookup + cascade by ownerId
- `finally { this.inFlight.delete(event.id) }` cleanup garantito (T-03-06-02 mitigation)
- EventTap step 9 `event.route.executed` emit inline con `metadata: { routeId, routeType, ok }` + try/catch swallow (replica pattern F2 emitF2Tap)
- Composite handler creato in constructor con wrapper su httpHandler che inietta il signal corretto del eventId condiviso

**`packages/routing/src/route-executor.test.ts` (295 LOC, 8 test):**
- Test 1-4: dispatch by type (local/cache/http/composite). Test 4 verifica delega a httpHandler con sub-route resolved correttamente.
- Test 5: abortInFlight durante http in volo → `signal.aborted === true`. Test pattern: httpHandler mock cattura signal e Promise pendente; abort esterno chiude la Promise con outcome error.
- Test 6: abortInFlightByOwner('plugin-A') con 3 inflight (2 plugin-A + 1 plugin-B) → count=2, signali plugin-A aborted, signal plugin-B intatto. Cleanup: abort esplicito plugin-B per non leak.
- Test 7: tap step `event.route.executed` con `metadata.routeId/routeType/ok` verificato via spy. eventId/topic propagati nel snapshot.
- Test 8: route.type='worker' (F5 future, non in F3) → default branch → `code='route.type.unknown'`.

## Key Decisions

Vedi frontmatter `key-decisions`. Highlights:
1. **httpHandler via Dependency Injection** — plan 03-06 dichiara la firma `(event, route, signal) => Promise<RouteOutcome>`; plan 03-08 fornirà l'implementazione vera nel route-handlers/http-handler.ts. Permette parallelizzazione Wave 4 con file ownership disgiunta.
2. **EventTap emit inline (try/catch swallow)** invece di import `safeTapStep` da `@gluezero/core`: `safeTapStep` NON è esposto al barrel pubblico (esporlo modificherebbe core, violando D-83). Replica pattern F2 `emitF2Tap` (broker-mapper-wrapper.ts:325).
3. **Composite handler factory closure** con `cacheWarnEmitted` flag chiuso nella closure: warning emit-once per istanza handler. Test 5 verifica spy chiamato 1 volta su 3 invocazioni successive.
4. **Sub-route signal sharing nel composite**: il composite condivide il controller con il sub-http step (stesso eventId via `getOrCreateController`). `abortInFlight(compositeEventId)` cancella anche il sub-http senza doppia entry.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan importava `safeTapStep`/`startStep` da `@gluezero/core` ma sono interni**

- **Found during:** Task 2 GREEN (route-executor.ts).
- **Issue:** Il plan task ction istruisce `import { ... safeTapStep, startStep } from '@gluezero/core'`. Verificato: `packages/core/src/index.ts` NON esporta queste funzioni — sono solo in `packages/core/src/core/event-tap.ts`. Esporle modificherebbe `packages/core/`, violando vincolo D-83 strict.
- **Fix:** Replicato il pattern try/catch swallow inline nel metodo privato `emitTap()` di RouteExecutor — pattern identico a F2 `emitF2Tap` (broker-mapper-wrapper.ts:325). Costruzione PipelineSnapshot inline con `performance.now() - startTime` per `durationMs`. Auditabile via grep `safeTapStep` (zero match nel package routing).
- **Files modified:** `packages/routing/src/route-executor.ts` (metodo privato `emitTap` + import lista pulita).
- **Commit:** `520a93f` (GREEN executor).

**2. [Rule 2 - Coverage] Test 5 cleanup esplicito `executor.abortInFlightByOwner('plugin-B')` per evitare promise leak**

- Plan Test 6 verifica solo cascade selettiva. Test 6 nel codice include cleanup post-assertion (`executor.abortInFlightByOwner('plugin-B')`) per garantire che le 3 Promise pending vengano risolte (signal.aborted listener resolve con error outcome). Senza cleanup, vitest segnalerebbe leak handle. Pattern coerente con LIFE-02 ext F3.

### Adattamento template plan azioni `local-handler.ts` (Rule 1 — bug ridondanza vincolo LOC)

- Plan template prevedeva header doc lungo (~14 righe) + body. wc -l → 34 LOC. Vincolo done criterion ≤30 LOC. Header doc compresso a 2 righe + JSDoc minimal sulla function → 23 LOC, vincolo rispettato.

## Self-Check: PASSED

- packages/routing/src/route-executor.ts: FOUND (261 LOC)
- packages/routing/src/route-executor.test.ts: FOUND (8 test passing)
- packages/routing/src/route-handlers/local-handler.ts: FOUND (23 LOC ≤30 ✓)
- packages/routing/src/route-handlers/cache-handler.ts: FOUND (45 LOC)
- packages/routing/src/route-handlers/composite-handler.ts: FOUND (118 LOC)
- packages/routing/src/route-handlers/index.ts: FOUND
- packages/routing/src/route-handlers/handlers.test.ts: FOUND (5 test passing)
- Commit `0a690bd` (RED handlers): FOUND in git log
- Commit `63e97b9` (GREEN handlers): FOUND in git log
- Commit `3f390e0` (RED executor): FOUND in git log
- Commit `520a93f` (GREEN executor): FOUND in git log
- routing test: 43/43 passing (8 executor + 5 handlers + 30 esistenti)
- routing typecheck: clean
- core test: 248/248 invariati (D-83 strict)
- mapper test: 183/183 invariati (D-83 strict)
- `git diff HEAD~4 -- packages/core/ packages/mapper/`: empty (D-83 strict verified)
- grep `class RouteExecutor`: matched
- grep `abortInFlightByOwner`: matched
- grep `event.route.executed`: matched (2 occorrenze — step + onPipelineStep call)
- grep `AbortController`: matched (in costruttore + JSDoc)
- grep `cache.not-implemented`: matched in cache-handler.ts
- grep `compositeHandler`: matched in composite-handler.ts
- grep `localHandler`: matched in local-handler.ts

## Notes for Next Plan (03-07 OutcomeCollector)

- **Reuse target:** `executor.execute(compiledRoute, event)` ritorna `RouteOutcome` (ok|error). Plan 03-07 implementerà `OutcomeCollector.collect(outcome, event, route)` che pubblica `<topic>.loaded` o `<topic>.failed` (D-80, D-82) — recursion guard analogo a F2 `handleMappingError`.
- **httpHandler DI placeholder:** plan 03-08 fornisce l'implementazione. RouterBroker plan 03-12 farà il bind `httpHandler: (e, r, signal) => httpGateway.fetch(e, r, signal)`.
- **`onCacheDeferred` wiring** (Q3 opzione b chiusura): plan 03-12 RouterBroker farà bind a `(ev) => broker.publish('routing.composite.cache-deferred', ev, { source: { type: 'system', id: 'routing' } })`.
- **`tap` wiring**: plan 03-12 RouterBroker passerà il tap configurato in `BrokerConfig.runtime.tap` (pattern F2 `mapper-broker-wrapper.ts` constructor).
- **`abortInFlightByOwner` wiring cascade**: plan 03-12 LIFE-02 ext F3 chiamerà `executor.abortInFlightByOwner(pluginId, 'plugin.unregistered')` dentro `RouterBroker.unregisterPlugin` (cascade D-26 ext F3, chiusura PRD §39 #7).
- **httpHandler via DI in test**: i test integration plan 03-12+ useranno `vi.fn()` o `msw` mock-server per il httpHandler, mantenendo file ownership disgiunta del plan 03-08.

## API Surface Esposta

Nuovi export pubblici (saranno aggiunti al barrel `@gluezero/routing/src/index.ts` in plan 03-12+ insieme al RouterBroker):

- **Class:** `RouteExecutor`
- **Interfaces:** `RouteExecutorDeps`, `CompositeHandlerDeps`
- **Functions:** `localHandler`, `cacheHandler`, `createCompositeHandler`
- **Internal (no public export):** `InFlightEntry` (privata route-executor.ts)

## REQ-ID Coverage

- **ROUTE-02** (parziale): `localHandler` implementato — il delivery a subscriber locali via `inner.publish` è plan 03-12 RouterBroker.
- **ROUTE-04** (type-only): `cacheHandler` stub F6 — `'cache.not-implemented'` BrokerError. L'adapter cache implementativo arriva con F6.
- **ROUTE-05** (workflow F3): `compositeHandler` con skip-cache + delega http (Q3 opzione b). Workflow completo check-cache → http → update-cache arriva con F6.
- **ROUTE-13** (parziale): `abortInFlight(eventId)` implementato. `broker.cancelInFlight(eventId)` public API è plan 03-12+ (RouterBroker wrapper).
- **ROUTE-14** (correlato D-65 dispatch): switch by type implementato — copre tutti i 4 type della RouteDefinition discriminated union F3.
- **LIFE-02 ext F3** (D-86, chiusura PRD §39 #7): `abortInFlightByOwner(ownerId)` implementato a livello modulo. Il bind in `RouterBroker.unregisterPlugin` è plan 03-12+.

---

*Phase 3 Plan 06 completed: 2026-04-30 (4 commits, 7 file creati, 43/43 routing test, D-83 strict OK, 1 Rule 1 auto-fix safeTapStep import deviation, 0 architectural changes — Rule 4 not triggered)*
