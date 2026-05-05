---
phase: 03-routing-server-gateway-http
plan: 05
subsystem: route-resolver-strategies
tags:
  - resolver
  - dispatch-table
  - phase-3
  - routing
  - multi-route-policy
  - cascade-unregister
  - topic-trie-mirror
dependency-graph:
  requires:
    - phase: 03-02
      provides: "@gluezero/routing types (RouteDefinition discriminated, RoutePolicies, RoutingConfig, MultipleRoutesPolicy)"
    - phase: 03-03
      provides: "@gluezero/routing augment.ts (declaration merging BrokerConfig.routes/routing + PluginDescriptor.routes + CanonicalSchema.requiresRoute)"
    - phase: 01
      provides: "@gluezero/core (createBrokerError factory, isBrokerError type guard, TopicTrie pattern di F1 D-08 — copiato come internal mirror)"
  provides:
    - "RouteResolver class con register/unregister/unregisterByOwner/resolve/compile/countByOwner/list (D-64 dispatch table pre-compilata)"
    - "CompiledRoute interface (id + readonly definition + ownerId + priority + requestBuilder pre-curried per http D-96)"
    - "RouteRegistration handle ritornato da register (id + unregister callback)"
    - "AmbiguousRouteEvent + RouteResolverOptions (onAmbiguousRoutes callback opt-in D-66 dev-mode warning)"
    - "3 strategy multi-route: firstMatch / priorityOrdered / allBroadcast (D-66, ROUTE-15)"
    - "internal/topic-trie.ts mirror copy del F1 TopicTrie (~115 LOC, D-83 strict no cross-package internal coupling)"
  affects:
    - "03-06+ (route-executor): consuma RouteResolver.resolve(topic, policy) come primo step del flow execute"
    - "03-12 (RouterBroker wrapper): istanzia RouteResolver come dipendenza interna; compone con MapperBroker F2; bind onAmbiguousRoutes a publish('routing.ambiguous')"
    - "03-13 (LIFE-02 cascade): RouterBroker.unregisterPlugin invocherà unregisterByOwner(pluginId)"
tech-stack:
  added: []
  patterns:
    - "Dispatch Table Pre-compiled (D-64 / RESEARCH Pattern 2): Map<routeId, CompiledRoute> + TopicTrie<CompiledRoute> O(segments) lookup"
    - "Strategy Pattern (D-66): 3 pure functions parametrizzate dal policy argument di resolve()"
    - "Cascade by ownerId (D-86 / LIFE-02 ext F3): Map<ownerId, Set<routeId>> per O(1) cascade unregister"
    - "Pre-curry pattern per requestBuilder route http (D-96 / Pitfall #16): closure su queryMap/bodyMap definita UNA volta al register"
    - "Mirror copy pattern (D-83 strict): copia interna ≤120 LOC del F1 TopicTrie per evitare cross-package internal coupling"
    - "Conditional spread per exactOptionalPropertyTypes: requestBuilder field omesso quando undefined (replica pattern F1 createBrokerError)"
    - "Idempotent register default (D-87 invertito): non-strict default ritorna handle existing su id duplicato; opt-in strict throw"
key-files:
  created:
    - "packages/routing/src/internal/topic-trie.ts"
    - "packages/routing/src/route-resolver.ts"
    - "packages/routing/src/route-resolver.test.ts"
    - "packages/routing/src/strategies/first-match.ts"
    - "packages/routing/src/strategies/priority-ordered.ts"
    - "packages/routing/src/strategies/all-broadcast.ts"
    - "packages/routing/src/strategies/index.ts"
    - "packages/routing/src/strategies/strategies.test.ts"
  modified: []
key-decisions:
  - "Mirror copy del TopicTrie F1 in packages/routing/src/internal/topic-trie.ts (~115 LOC) invece di esporre @gluezero/core/internal — evita cross-package internal coupling (RESEARCH Open Question Q1). Da rimuovere quando F1 esporrà subpath internal."
  - "RouteResolverOptions.strict default `false` (idempotent return existing su id duplicato) invece di `true` (throw): coerente con CanonicalRegistry F2 (strict opt-in tramite RegisterOptions.strict). Test 3 verifica idempotency."
  - "Conditional spread `...(requestBuilder !== undefined && { requestBuilder })` per il field opzionale — necessario con exactOptionalPropertyTypes: true (mai assegnare `requestBuilder: undefined`)."
  - "TS Index signature fix (Rule 1): `result['queryMap']` invece di `result.queryMap` per Record<string, unknown> con strict + noUncheckedIndexedAccess. Replica fix simile in mapper-engine.ts F2."
  - "validateTopicPattern riusato dal mirror trie (T-03-05-04 mitigation): Test 14 verifica che pattern uppercase malformato → throw `topic.pattern.invalid`."
  - "Test 14 aggiunto oltre i 13 del plan (Rule 2 — copertura esplicita di T-03-05-04 trust boundary)."
  - "AmbiguousRouteEvent emesso SOLO con policy='first-match' AND matches.length > 1 (D-66 dev-mode-only): NON è un BrokerEvent CORE qui — la pubblicazione 'routing.ambiguous' è responsabilità del RouterBroker plan 03-12 che consuma il callback."
  - "priorityOrdered ritorna [vincitore singolo] non l'intero array ordinato — semantica D-66: la policy seleziona UNA route. Per fan-out usare 'all'."
  - "Strategie create insieme al RouteResolver in commit GREEN Task 1 (dipendenza diretta), test isolati strategies.test.ts in commit Task 2 separato (TDD pattern adattato — implementation prima per dipendenza topologica, test isolati come spec esplicita pure-function)."
patterns-established:
  - "Internal mirror copy pattern (T-03-05 D-83 strict): quando il package A ha bisogno di internal del package B che NON è esposto, fare copia letterale ≤120 LOC nel package A con header esplicito `RIMUOVERE quando B esporrà internal subpath`. Audit-able via grep."
  - "Multi-route policy via Strategy Pattern: 3 pure functions consumate dal RouteResolver.resolve() — pattern replicabile per F4 (RealtimeStrategy reconnect), F5 (WorkerSelectionStrategy pool/dedicated), F6 (CacheStrategy cache-first/network-first/cache-then-network già nei tipi F3)."
  - "Dispatch table pre-compile + cascade by ownerId: pattern replicabile per FUTURI registry F3 (HttpGateway in-flight requests by routeId / by pluginId — plan 03-08+, cascade abort on unregisterPlugin). Same shape: Map<id, X> + Map<ownerId, Set<id>>."
  - "Test idempotency vs strict: ogni registry F3+ deve avere Test 2 (strict throw) + Test 3 (non-strict idempotent). Replica pattern CanonicalRegistry F2."
  - "Test cascade by ownerId: setup N entries con ownerId=A, M entries con ownerId=B, unregisterByOwner('A') → tutte A rimosse + B intatte. Replica pattern AliasRegistry F2 + plan 03-12 RouterBroker."
requirements-completed:
  - "ROUTE-01 (parziale — register/unregister API surface tipologicamente coperta; il broker.registerRoute pubblico arriva in plan 03-12)"
  - "ROUTE-15 (PRD §39 #6 — chiusura runtime per construction): 3 strategy first-match/priority-ordered/all implementate; il default 'first-match' + dev-mode warning ambiguous configurato (effective publish in 03-12)"
metrics:
  duration: "~25 minuti"
  completed_date: "2026-05-02T00:15:30Z"
  commits: 3
  tasks: 2
  files_created: 8
  files_modified: 0
  test_results:
    routing: "30/30 (3 file: route-resolver.test.ts 14 + augment.test.ts 9 + strategies.test.ts 7)"
    core: "248/248 (D-83 strict — invariato)"
    mapper: "183/183 (D-83 strict — invariato)"
  loc:
    route-resolver.ts: 281
    internal-topic-trie.ts: 116
    strategies-total: 91
    test-files-total: 287
---

# Phase 3 Plan 05: RouteResolver + Multi-route Strategies + Cascade unregisterByOwner Summary

**One-liner:** Dispatch table pre-compilata `Map<routeId, CompiledRoute>` + `TopicTrie<CompiledRoute>` mirror per O(segments) wildcard lookup + 3 multi-route policy (`first-match`/`priority-ordered`/`all`) + cascade `unregisterByOwner` per LIFE-02 ext F3, integralmente nel package `@gluezero/routing` senza modifiche a `core`/`mapper` runtime (D-83 strict).

## Goal

Implementare il primo modulo runtime di `@gluezero/routing` post-types/augment: `RouteResolver` come dispatch table pre-compilata D-64 (Pitfall #16 mitigation — niente compilation hot-path), 3 strategy D-66 per multi-route policy (chiusura PRD §39 #6 ROUTE-15), `unregisterByOwner` cascade D-86 per LIFE-02 ext F3 (chiusura PRD §39 #7 a livello modulo — il publish runtime al broker è plan 03-12).

## What Was Built

### Task 1 — internal topic-trie mirror + RouteResolver (commit `1e98688` RED + `cc9630e` GREEN)

**`packages/routing/src/internal/topic-trie.ts` (116 LOC):**
- Mirror copy letterale di `packages/core/src/core/topic-matcher.ts` (TopicTrie<T> + validateTopic + validateTopicPattern).
- Header esplicito documenta la motivazione (cross-package internal coupling avoid) e la condizione di rimozione (quando F1 esporrà subpath internal).
- D-83 strict: ZERO modifiche a `packages/core/`. Audit verificato via `git diff HEAD~3 -- packages/core/`.

**`packages/routing/src/route-resolver.ts` (281 LOC):**
- `RouteResolver` class con: `register(def, options?)` / `unregister(routeId)` / `unregisterByOwner(ownerId)` / `resolve(topic, policy?)` / `countByOwner` / `list` / `compile(def)` private.
- 3 storage strutture: `Map<routeId, CompiledRoute>` (lookup by id) + `TopicTrie<CompiledRoute>` (O(segments) wildcard match) + `Map<ownerId, Set<routeId>>` (cascade D-86).
- `RouteResolverOptions.strict` default `false` (idempotent return existing) + `onAmbiguousRoutes` callback opt-in (D-66 dev-mode warning).
- `compile(def)` pre-curria `requestBuilder` per route `type: 'http'` (closure su queryMap/bodyMap — D-96 Pitfall #16).
- `resolve(topic, policy)` con 3 branch policy: `'first-match'` (default + warning ambiguous se matches > 1), `'priority-ordered'` (delega `priorityOrdered`), `'all'` (delega `allBroadcast`).
- `BrokerError 'route.id.duplicate'` con `details: { routeId, topic }` (T-03-05-05 mitigation: no payload disclosure).

**`packages/routing/src/route-resolver.test.ts` (203 LOC, 14 test):**
- Test 1: register univoco → RouteRegistration valida.
- Test 2: register strict + duplicate id → throw `route.id.duplicate`.
- Test 3: register non-strict + duplicate id → idempotent (no throw, no double insert).
- Test 4: resolve con 1 route → ritorna [CompiledRoute].
- Test 5: resolve con 0 route → `[]`.
- Test 6: resolve wildcard match (`weather.alert.failed` matcha `weather.*.failed`).
- Test 7-9: resolve con N=3 + first-match/priority-ordered/all (3 test).
- Test 10: unregister + double-unregister returns false.
- Test 11: unregisterByOwner cascade (3 route plugin-A + 1 plugin-B → unregister A rimuove tutte A, B intatto).
- Test 12: compile pre-curria requestBuilder per http; route locale → requestBuilder undefined.
- Test 13: dev-mode `onAmbiguousRoutes` callback emesso con N>1 + first-match (verify topic + candidateRouteIds + selectedRouteId).
- Test 14: register + topic pattern malformato → throw `topic.pattern.invalid` (T-03-05-04 explicit coverage).

### Task 2 — strategies isolate test (commit `1703265`)

**`packages/routing/src/strategies/{first-match,priority-ordered,all-broadcast,index}.ts` (91 LOC totali):**
- `firstMatch(matches)` → `[matches[0]]` o `[]` (D-66 default).
- `priorityOrdered(matches)` → `[winner]` con sort priority desc + tie-breaker insertion order (sort stable JS ≥ 2019).
- `allBroadcast(matches)` → passthrough (D-66 fan-out opt-in).
- Barrel `index.ts` con 3 named exports.

**`packages/routing/src/strategies/strategies.test.ts` (84 LOC, 7 test):**
- 4 test deterministici dal plan (firstMatch / priorityOrdered priority + tie / allBroadcast passthrough).
- 3 edge cases input vuoto (`[]`) per ogni strategy.

NB: Le 3 strategy sono state create in commit GREEN Task 1 perché dipendenza diretta del RouteResolver (`import { allBroadcast } from './strategies/all-broadcast'`). Il commit di Task 2 aggiunge SOLO `strategies.test.ts` come spec isolata pure-function. Pattern TDD adattato per dipendenza topologica — il behavior delle strategy è già verificato indirettamente dai Test 7-9 di route-resolver.test.ts (commit RED separato per quei comportamenti).

## Key Decisions

Vedi frontmatter `key-decisions`. Highlights:
1. **Mirror copy del TopicTrie F1** invece di subpath internal exposure (RESEARCH Q1 risolta lato consumer routing). Da rimuovere in F6+ se F1 esporrà `@gluezero/core/internal`.
2. **`strict` default `false`** (idempotent) coerente con CanonicalRegistry F2 — opt-in del throw via `{ strict: true }`.
3. **`AmbiguousRouteEvent` come callback opt-in** anziché publish diretto al broker — il RouterBroker plan 03-12 farà il bind effettivo a `publish('routing.ambiguous', ...)`. Mantiene il RouteResolver puro (no broker dependency).
4. **`priorityOrdered` ritorna [vincitore]** non sorted full array — semantica D-66: policy seleziona UNA route per route HTTP execution.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TS index signature error per `result.queryMap`/`bodyMap`**
- **Found during:** Task 1 GREEN typecheck post-test.
- **Issue:** `Record<string, unknown>` field access via dot-notation triggera TS4111 con `noUncheckedIndexedAccess` strict — same constraint hit in mapper-engine.ts F2.
- **Fix:** Bracket notation `result['queryMap']` / `result['bodyMap']`.
- **Files modified:** `packages/routing/src/route-resolver.ts:269-270`.
- **Commit:** `cc9630e` (post-fix typecheck verde).

### Rule 2 - Auto-add (cumulative test extras)

**2. [Rule 2 - Coverage] Test 14 aggiunto oltre i 13 minimi del plan**
- Plan richiedeva 13 test (Test 1-13 del behavior section). Aggiunto Test 14 per coprire esplicitamente T-03-05-04 (topic pattern injection) — `validateTopicPattern` riuso del F1 mirror è un threat boundary chiave.
- 4 test extras per le strategies (input vuoto edge cases) oltre i 4 minimi del plan strategies.

## Self-Check: PASSED

- packages/routing/src/internal/topic-trie.ts: FOUND
- packages/routing/src/route-resolver.ts: FOUND (281 LOC)
- packages/routing/src/route-resolver.test.ts: FOUND (14 test passing)
- packages/routing/src/strategies/first-match.ts: FOUND
- packages/routing/src/strategies/priority-ordered.ts: FOUND
- packages/routing/src/strategies/all-broadcast.ts: FOUND
- packages/routing/src/strategies/index.ts: FOUND
- packages/routing/src/strategies/strategies.test.ts: FOUND (7 test passing)
- Commit `1e98688` (RED Task 1): FOUND in git log
- Commit `cc9630e` (GREEN Task 1): FOUND in git log
- Commit `1703265` (Task 2 strategies test): FOUND in git log
- routing test: 30/30 passing
- routing typecheck: clean
- core test: 248/248 invariati (D-83 strict)
- mapper test: 183/183 invariati (D-83 strict)
- `git diff HEAD~3 -- packages/core/ packages/mapper/`: empty (D-83 strict verified)

## Notes for Next Plan (03-06)

- **Reuse target:** `RouteResolver.resolve(topic, policy)` è il primo step del flow `route-executor` — 03-06 implementerà `route-executor.ts` che consuma le `CompiledRoute` ritornate.
- **`requestBuilder` pre-curried**: il http-handler di plan 03-08+ riceverà `compiledRoute.requestBuilder` come closure pronta — dovrà invocare il `MapperEngine.mapToShape(canonicalPayload, compiledRoute.definition.request.queryMap)` di F2 per il vero mapping. Il thunk attuale serve solo come placeholder dimostrativo del pre-curry pattern.
- **`onAmbiguousRoutes` wiring**: plan 03-12 RouterBroker wrapper farà il bind effettivo `(event) => broker.publish('routing.ambiguous', event)`.
- **`unregisterByOwner` wiring cascade**: plan 03-12 LIFE-02 ext F3 chiamerà `routeResolver.unregisterByOwner(pluginId)` dentro `RouterBroker.unregisterPlugin` (cascade D-26 ext F3).
- **`internal/topic-trie.ts` TODO**: rimuovere quando F1 esporrà subpath `@gluezero/core/internal` (Phase 6 candidate).

## API Surface Esposta

Nuovi export pubblici (saranno aggiunti al barrel `@gluezero/routing/src/index.ts` in plan 03-06+ insieme al RouteExecutor):
- **Class:** `RouteResolver`
- **Interfaces:** `CompiledRoute`, `RouteRegistration`, `AmbiguousRouteEvent`, `RouteResolverOptions`
- **Functions (strategies):** `firstMatch`, `priorityOrdered`, `allBroadcast`
- **Internal (no export):** `TopicTrie` (mirror), `validateTopic`, `validateTopicPattern` — uso interno al package routing.

## REQ-ID Coverage

- **ROUTE-01**: parzialmente coperto (register/unregister API tipologicamente; il broker pubblico arriva in 03-12).
- **ROUTE-15** (chiusura PRD §39 #6): per costruzione runtime — 3 strategy implementate; default `first-match` + dev-mode `routing.ambiguous` callback. Il publish effettivo come BrokerEvent è plan 03-12.
- **ROUTE-16** (chiusura PRD §39 #5): tipologicamente preparato (D-67/D-95 augment già fatto in 03-03); il check runtime `requiresRoute: true` → throw `route.required.missing` è plan 03-12 RouterBroker (D-100 BLOCKER 4).
- **LIFE-02 ext F3** (chiusura PRD §39 #7): `unregisterByOwner` cascade implementato a livello modulo. Il bind in `RouterBroker.unregisterPlugin` è plan 03-12.

---

*Phase 3 Plan 05 completed: 2026-05-02 (3 commits, 8 file creati, 30/30 routing test, D-83 strict OK, 0 deviations bloccanti, 1 Rule 1 auto-fix typecheck)*
