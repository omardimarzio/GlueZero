# @sembridge/routing

Routing engine dichiarativo per SemBridge (Phase 3).

## Stato

Phase 3 in sviluppo. API non stabile.

## Cosa contiene

- **`RouteDefinition`** — discriminated union via `type`: `'local'` | `'http'` | `'cache'` | `'composite'` (worker aggiunto in F5 via declaration merging).
- **`RouteResolver`** — dispatch table pre-compilata `Map<topicPattern, CompiledRoute[]>` con O(1) lookup a runtime; pattern matching tramite il `TopicTrie` segmentato di F1 (D-08).
- **`RouteExecutor`** — dispatch by type: handler `local` (sync, riusa pipeline F1), `http` (async via `@sembridge/gateway/http`), `cache`/`composite` (stub F3, adapter cache effettivo a F6).
- **`RouterBroker`** — composition wrapper di `MapperBroker` (F2). Estende l'API pubblica con `registerRoute(routeDefinition)` / `unregisterRoute(routeId)` e cascade su `unregisterPlugin` (LIFE-02 ext F3).
- **Strategie multipleRoutes:** `'first-match'` (default + warning dev), `'priority-ordered'` (numero `priority`), `'all'` (broadcast fan-out).
- **Pipeline §28 step 7-full / 8 / 9 / 10** — dedupe checked, route resolved, route executed, outcome collected.

## Vincolo D-83

Zero modifiche a `packages/core/` runtime e `packages/mapper/` runtime. Estensione tramite composition wrapper + TS declaration merging (`src/augment.ts`, plan 03-03).

## Documentazione

Vedi `prd.md` §17 e §28. DOC-04 completo al plan 03-14.

## Licenza

MIT
