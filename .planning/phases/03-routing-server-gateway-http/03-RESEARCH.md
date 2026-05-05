# Phase 3: Routing & Server Gateway HTTP — Research

**Researched:** 2026-04-30
**Domain:** Routing engine dichiarativo + HTTP Gateway centralizzato (browser-side TypeScript ESM, monorepo pnpm)
**Confidence:** HIGH (decisioni lockate in CONTEXT.md D-60..D-99; stack già verificato in F1/F2; msw 2.13.6 + Valibot 1.3.1 + nanoid 5.1.9 già installati)

## Summary

Fase 3 consegna due package gemelli (`@gluezero/routing` + `@gluezero/gateway`) che insieme estendono il `MapperBroker` di F2 con un **Routing Engine dichiarativo** (4 tipi route — `local`/`http`/`cache`/`composite`) e un **HTTP Gateway** centralizzato che applica policy uniformi a ogni fetch (timeout, retry 4xx/5xx differenziato, dedupe, backpressure, auth Bearer + refresh, idempotency, URL allowlist, cancellazione). La fase chiude 4 open issue PRD §39 (#5 ROUTE-16, #6 ROUTE-15, #7 LIFE-02 ext, #8 ROUTE-09) e introduce 4 nuovi step della pipeline §28 (step 7-full backpressure, step 8 route resolved, step 9 route executed, step 10 outcome collected).

L'architettura segue il **pattern composition wrapper di F2 D-49** (`RouterBroker = wrap(MapperBroker)`): zero modifiche a `packages/core/` runtime e zero a `packages/mapper/` runtime. I tipi pubblici (`RouteDefinition`, `GatewayConfig`, `RouterBroker`, `PluginDescriptor.routes`) si agganciano al core/mapper via TS declaration merging (`augment.ts`). Le policy del gateway sono implementate come **Strategy Pattern** componibili (CONTEXT D-68): ogni policy (`RetryStrategy`, `TimeoutStrategy`, `DedupeStrategy`, `BackpressureStrategy`, `AuthStrategy`, `IdempotencyStrategy`) è un'interfaccia tipizzata con default implementation + slot custom. La pipeline policy `auth → idempotency → dedupe → backpressure → timeout → fetch → response-parse → response-validation` viene composta come **chain of responsibility** funzionale (compose di funzioni async) per minimal allocation per request.

**Primary recommendation:** Spezzare F3 in **12 plan** organizzati in **6 wave** (4 wave fortemente parallelizzabili per file ownership disgiunta), con `@gluezero/gateway` esposto via **subpath exports** (`@gluezero/gateway/http` per F3, `@gluezero/gateway/sse-ws` riservato a F4). Test integration scenario meteo HTTP via `msw` 2.x in mode Node (già installato) con handler-set domain-grouped + per-test overrides. Performance budget: routing < 5 KB gz, gateway/http < 6 KB gz, overhead route HTTP < 50ms (escluso fetch network), zero overhead per topic `'local'` rispetto a F2.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**A. API Surface Routing**
- **D-60:** Broker espone `registerRoute(routeDefinition)` e `unregisterRoute(routeId)` — coerente con pattern F1/F2 (`registerPlugin`, `registerCanonicalSchema`, `registerTransform`, `registerAlias`).
- **D-61:** Plugin dichiarano `routes?: RouteDefinition[]` opzionale nel `PluginDescriptor`. Auto-register al `registerPlugin` con `ownerId = pluginId` (cascade D-26 ext F3).
- **D-62:** `RoutingConfig` opzionale in `BrokerConfig` (sezione `routes?` + `gateway?`). Pattern non-breaking via TS declaration merging in `@gluezero/routing/src/augment.ts` e `@gluezero/gateway/src/augment.ts` (replica F2 D-56).
- **D-63:** `createSembridge(config)` aggregato pubblico **DEFERRED a F6**. F3 estende `createMapperBroker` con un nuovo wrapper `createRouterBroker(config)` (composition wrapper).

**B. Strategia routing engine (resolver + executor)**
- **D-64:** Route resolution **pre-compilata al `registerRoute`** — dispatch table `Map<topicPattern, CompiledRoute[]>` per O(1) lookup. Wildcard via riuso del `TopicTrie` segmentato di F1 (D-08).
- **D-65:** Executor **ASYNC** per route HTTP/cache/composite, **SYNC** (ritorno) per route local. Local riusa la pipeline F1 invariata; HTTP/cache/composite ritornano `Promise<RouteOutcome>`. Local + remote eseguiti in parallelo per default.
- **D-66:** **`first-match` come default** per ROUTE-15. In dev mode emette `routing.ambiguous` BrokerEvent CORE. Override via `RouteDefinition.priority?: number` (resolver applica `'priority-ordered'`). Policy `'all'` (broadcast) opt-in via `RoutingConfig.multipleRoutesPolicy: 'all'`.
- **D-67:** **`requiresRoute` opt-in per topic schema** (chiusura PRD §39 #5 / ROUTE-16). Default: topic senza route → consegna locale. Opt-in: `CanonicalSchema.requiresRoute: true` → throw `BrokerError` `route.required.missing` → publish `<topic>.failed`. Estensione F2 via declaration merging.

**C. HTTP Gateway — policy uniformi**
- **D-68:** **Strategy Pattern** per ogni policy (Retry/Timeout/Dedupe/Backpressure/Auth/Error). Coerente con `ARCHITECTURE.md §2.5`.
- **D-69:** **Retry policy default** (chiusura PRD §39 #8 / ROUTE-09):
  - Network errors (no response) → RETRY
  - 5xx (500-599) → RETRY rispettando `Retry-After`
  - 408 Request Timeout → RETRY
  - 429 Too Many Requests → RETRY rispettando `Retry-After`
  - Altre 4xx → NO RETRY (errore client)
  - `maxAttempts: 3` default; `0` disabilita; `Infinity` con warning dev
  - Backoff full jitter: `min(maxDelay=10000, baseDelay=300 * 2^attempt) * (0.5 + Math.random() * 0.5)`
- **D-70:** **Idempotency token** (SEC-03) — POST/PATCH/PUT/DELETE auto-genera `nanoid()` come `Idempotency-Key` header al first attempt; stesso valore riusato su retry (chiave: `BrokerEvent.id`). Opt-out per route.
- **D-71:** **URL allowlist obbligatoria** (SEC-05) — `gateway.allowlist: string[]` (regex/glob). Tentativo verso URL non in allowlist → throw `BrokerError` `gateway.url.forbidden` PRIMA della fetch. Default `undefined` con warning dev.
- **D-72:** **Auth Bearer + token refresh** (SEC-01/02, ROUTE-07) — `gateway.auth.getToken: () => Promise<string | undefined>` chiamato pre-fetch. Su 401, opzionalmente `gateway.auth.refresh: () => Promise<string>` UNA volta (no loop) → retry con nuovo token. Su fail/stesso token → publish `auth.expired` + propaga 401.

**D. Concurrency, dedupe, backpressure**
- **D-73:** **Concurrency policy per route** — `'latest-only' | 'serial' | 'parallel'`. Auto-detection: topic `*.requested` AND method `GET` → `'latest-only'` default; altrimenti `'parallel'`.
- **D-74:** **`dedupeKey` esplicito** (ROUTE-11) — `dedupeKey: (event) => string` funzione pura. Due request con stesso key in volo → collassano in 1 fetch (Promise condiviso). Default fallback su GET: `routeId + sortedQueryParams`. Per non-GET, no auto-dedup.
- **D-75:** **Backpressure priority-aware** (ROUTE-10) — `'queue-bounded'` (max N), `'drop'`, `'throttle'`, `'debounce'`, `'latest-only'`, `'merge'/'coalesce'`. Eventi `priority: 'critical'` BYPASS qualsiasi policy.

**E. Cancellazione e AbortSignal** (ROUTE-13)
- **D-76:** `AbortController` per ogni request HTTP in volo. Cited su: `'latest-only'` → abort precedente; `unsubscribe`/`unregisterPlugin` → cascade abort; timeout → abort + publish failed; utente → API `broker.cancelInFlight(eventId)` (verifica con planner se serve in F3 o se subscribe `signal` basta).
- **D-77:** **AbortSignal su `subscribe`** (F1 plan 04/05) propagato alla fetch HTTP per topic `*.requested` (PITFALLS #2.B chiusura).

**F. Validazione response server** (VAL-05)
- **D-78:** Validazione opt-in via canonical schema F2. `response: { canonical: 'weather' }` → step 6 (`event.canonical.validated` di F2) sul payload canonico → fail → publish `<topic>.failed` con `code: 'response.validation.failed'`.
- **D-79:** Server con schema inatteso (TEST-03 subset) — comportamento dipende da `onFailure` schema (F2 D-44): `'block'` (default), `'skip'`, `'fallback'`. Riusa logica F2.

**G. Errori standard F3** (ERR-02 ext)
- **D-80:** **`<topic>.failed` automatico** (ROUTE-12, PRD §22.3) con shape:
  ```ts
  {
    code: string,           // 'gateway.timeout' | 'gateway.4xx' | 'gateway.5xx' | 'gateway.network' | 'response.validation.failed' | 'route.required.missing' | 'auth.expired'
    message: string,
    category: 'network' | 'validation' | 'auth' | 'config',
    routeId: string,
    topic: string,
    eventId: string,
    originalError?: Error,
    cause?: Error,           // ES2022 Error.cause chain
    httpStatus?: number,
    retryAttempt?: number,
    retryAfterMs?: number
  }
  ```
- **D-81:** **`network.error` come BrokerEvent CORE separato** (DNS fail, offline, CORS blocked) oltre a `<topic>.failed`. `category: 'network'`.
- **D-82:** **NO publish doppio** durante retry intermedi. `<topic>.failed` UNA volta sola (fine retry + timeout cumulativo). Visibilità retry via Inspector / EventTap.

**H. Estensione Pipeline §28**
- **D-83:** **`bus.ts` di F1 e `mapper-engine.ts` di F2 NON modificati** — composition wrapper identico a F2 D-49. `RouterBroker` compone `MapperBroker`. Step F3 invocati nel posto giusto della sequenza.
- **D-84:** **Ordine pipeline §28 in F3 (full):**
  1. event.received (F1)
  2. event.metadata.enriched (F1)
  3. event.validated (F1)
  4. event.source.resolved (F2)
  5. event.mapped.canonical (F2)
  6. event.canonical.validated (F2)
  7. event.dedupe.checked (F1 base + F3 backpressure full)
  8. **event.route.resolved** (F3 NUOVO)
  9. **event.route.executed** (F3 NUOVO)
  10. **event.outcome.collected** (F3 NUOVO)
  11. event.mapped.consumer (F2)
  12. event.final.validated (F2)
  13. event.delivered (F1)
- **D-85:** **`PipelineStep` extension F3** via TS declaration merging in `@gluezero/routing/src/augment.ts` (replicato pattern F2 D-49). `safeTapStep` di F1 riusato per i tap.

**I. Cascade cleanup** (LIFE-02 ext F3, chiusura PRD §39 #7)
- **D-86:** **`unregisterPlugin` cascada anche route registrate** — D-26 ext F3 + cascade abort `AbortController` di tutte request HTTP in volo bound al `pluginId`.
- **D-87:** **`unregisterRoute(routeId)` esplicito** — anche senza unregister plugin owner. Garbage-collect dispatch table + abort request in volo legate al `routeId`.

**J. Test Strategy F3**
- **D-88:** Pattern TDD RED→GREEN come F1/F2. Plan paralleli con file ownership disgiunta.
- **D-89:** **Integration test scenario meteo PRD §29 esteso con HTTP** via `msw` 2.x come HTTP interceptor. Riusa `createMapperHarness` esteso a `createRouterHarness` con `mockServer` setup.
- **D-90:** **TEST-01 subset F3** — unit deterministici per: dedupe, retry differenziato, timeout, latest-only abort, URL allowlist, idempotency.
- **D-91:** **TEST-03 subset F3** — robustness: server response schema inatteso, retry storm, cascade abort.
- **D-92:** **Coverage v8 F3** ≥ 90% sui file `@gluezero/routing/` e `@gluezero/gateway/http/`.

**K. Type System**
- **D-93:** Type re-export da `@gluezero/routing` e `@gluezero/gateway` a `@gluezero/core` via TS declaration merging (replicato F2 D-56).
- **D-94:** **`PluginDescriptor.routes?: RouteDefinition[]`** augmentation F3 (replicato F2 D-57 pattern).
- **D-95:** **`CanonicalSchema.requiresRoute?: boolean`** augmentation F3 per chiusura ROUTE-16 (D-67).

**L. Mapping HTTP**
- **D-96:** `request.queryMap` e `request.bodyMap` riusano `MapperEngine` di F2. NO codice mapping nuovo.
- **D-97:** `response.canonical: 'schemaId'` riferimento al `CanonicalSchema` F2. Default JSON parser. Custom parser opt-in deferred a V1.x.
- **D-98:** Default JSON serializer body. Custom (form-data, multipart) opt-in via `request.serializer: (canonical) => BodyInit` (function override).

**M. Circuit breaker (avanzato — minimo F3)**
- **D-99:** **Per-route fail counter base**, `circuitBreaker.threshold: 5` consecutivi → `open` per `cooldownMs: 30000`. In `open` → fail-fast `<topic>.failed` con `code: 'circuit.open'`. Default DISABILITATO. Sliding window stats → V1.x.

### Claude's Discretion

Aree dove le scelte specifiche di implementazione sono lasciate alla discrezione dell'agent planner/researcher:
- **Dispatch table storage interno** — Map vs trie integrato vs hybrid (decisione tactical: vedi **Architecture Patterns / Pattern 2**)
- **Strategy registry storage** — Map vs Object literal con namespace per `RetryStrategy`, `DedupeStrategy`, ... (vedi **Architecture Patterns / Pattern 3**)
- **Gateway internals** — decomposizione di `http-gateway.ts` (potrebbe diventare `http-client.ts` + `policy-pipeline.ts`)
- **`@gluezero/gateway/http` vs `@gluezero/gateway`** — questo research **raccomanda subpath exports** (vedi sezione **Subpath Exports Recommendation**)
- **Naming convention** — segui pattern F1/F2 (`*.ts`/`*.test.ts` co-locato)
- **Splitting in plan** — questo research **raccomanda 12 plan in 6 wave** (vedi **Architecture Patterns / Plan Topology**)

### Deferred Ideas (OUT OF SCOPE)

- Realtime SSE/WS adapter — F4
- Cache adapter implementativo (in-memory + IndexedDB) — F6
- Worker route handler — F5
- Route Inspector full snapshot — F6
- Metrics format — F6
- Adapter Zod/Ajv per response validation — V2 (V1 solo Valibot)
- Circuit breaker avanzato cross-route con sliding window — V1.x
- Custom serializer body (form-data/multipart/binary) — V1.x
- Custom response parser (binary/text plain/multipart) — V1.x
- Retry budget globale cross-route — V1.x
- `createSembridge(config)` aggregato — F6
- Server push notification — V2

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ROUTE-01 | `registerRoute`/`unregisterRoute` | API surface D-60 + RouterBroker composition wrapper. Implementazione: `router-engine.ts` (Standard Stack §RouterEngine) |
| ROUTE-02 | Route `local` (consegna subscriber) | D-65 SYNC: delega a `bus.deliver` invariato di F1. `route-handlers/local-handler.ts` (≤ 30 LOC) |
| ROUTE-03 | Route `http` con queryMap/bodyMap | D-96/D-97 riuso MapperEngine F2. `route-handlers/http-handler.ts` invoca `http-gateway` con request build |
| ROUTE-04 | Route `cache` (cache-first/network-first/cache-then-network) | F3 definisce SOLO `RouteDefinition.type === 'cache'`. Adapter F6. Stub no-op pattern come EventTap di F1 |
| ROUTE-05 | Route `composite` (workflow) | F3 implementa workflow orchestration check-cache → server → publish. Cache adapter è F6 (composite ritorna placeholder finché F6 wirea il vero cache) |
| ROUTE-06 | Server Gateway centralizza fetch | `@gluezero/gateway/http` con `HttpGateway` class. Tutte route HTTP DEVONO passare per il gateway (no fetch diretto da plugin) |
| ROUTE-07 | Header auth + token refresh | D-72: `AuthStrategy` con `getToken`+`refresh`. Single-flight refresh — vedi **Common Pitfalls / Pitfall 5** |
| ROUTE-08 | Policy timeout/retry/dedupe/cache/concurrency/error/mapping/auth | D-68 Strategy Pattern. 7 strategy implementations parallelizzabili Wave 4 |
| ROUTE-09 | Retry 4xx vs 5xx differenziato (PRD §39 #8) | D-69. `RetryStrategy` default `ExponentialBackoffWithJitter` con `shouldRetry(response, attempt)` puro |
| ROUTE-10 | Backpressure (queue/drop/throttle/debounce/latest-only/merge) | D-75. `BackpressureStrategy` per route + bypass per `priority: 'critical'` |
| ROUTE-11 | Deduplica via `dedupeKey` | D-74. `DedupeStrategy` `KeyBased` con `Map<key, Promise>` shared |
| ROUTE-12 | Pubblicazione automatica `<topic>.failed` | D-80. Outcome collector step 10 → publish `loaded` o `failed` con shape canonica |
| ROUTE-13 | Cancellazione (AbortSignal) | D-76+D-77. `AbortController` per fetch + propagation subscriber signal — vedi **Common Pitfalls / Pitfall 4** |
| ROUTE-14 | Route Inspector | F3 emette tap step 8/9/10 con metadata mínima. Inspector full → F6 |
| ROUTE-15 | Più route applicabili (PRD §39 #6) | D-66. `'first-match'` default + `'priority-ordered'` + `'all'` |
| ROUTE-16 | Topic senza route (PRD §39 #5) | D-67. `requiresRoute?: boolean` augment F2 schema |
| VAL-05 | Validazione response server | D-78/D-79. Riusa F2 `valibotAdapter` + canonical schema |
| ERR-02 ext | `<topic>.failed` + `network.error` | D-80/D-81/D-82. NO double publish, shape canonica |
| SEC-01 | Header auth centralizzati | D-72 `AuthStrategy.BearerHook` |
| SEC-02 | Token refresh hook | D-72 `gateway.auth.refresh` opt-in. Single-flight mutex |
| SEC-03 | Idempotency token | D-70 `IdempotencyStrategy` con `nanoid()` + header `Idempotency-Key` |
| SEC-04 | Status HTTP uniformi | `<topic>.failed` shape D-80 + `BrokerError.httpStatus` |
| SEC-05 | URL allowlist | D-71. Pre-fetch validation + redirect re-validation |
| TEST-01 (subset) | Unit test route HTTP, dedupe, retry/timeout | D-90. msw 2.13.6 in mode Node, handler-set domain-grouped |
| TEST-02 | Plugin → server → plugin | D-89. Scenario meteo HTTP end-to-end. `createRouterHarness` extends `createMapperHarness` |
| TEST-03 | Server schema inatteso + retry storm | D-91. Verifica full jitter distribution + cascade abort |
| DOC-04 | Documentazione route engine + gateway | README + JSDoc API pubblica completa al final gate plan 03-12 |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Route resolution (topic → RouteDefinition) | Browser / Client (`@gluezero/routing`) | — | Pre-compiled dispatch table (D-64) lives in browser memory; resolution è O(1) hot-path lookup |
| Route execution dispatch | Browser / Client (`@gluezero/routing`) | API / Backend (per route HTTP) | Executor decide il tipo (local/http/cache/composite) e delega; HTTP backend è fuori scope librario |
| Request build (queryMap/bodyMap canonical → server) | Browser / Client (`@gluezero/routing` invoca `@gluezero/mapper`) | — | Riuso MapperEngine F2 — D-96 |
| HTTP fetch + policy chain | Browser / Client (`@gluezero/gateway/http`) | API / Backend (server-side responsibility for retry/idempotency contract) | fetch nativo + Strategy Pattern; backend deve onorare `Idempotency-Key` |
| Response parse + canonical mapping | Browser / Client (`@gluezero/gateway/http` + `@gluezero/mapper`) | — | Default JSON parse + MapperEngine inverso server→canonical (D-97) |
| Response validation (VAL-05) | Browser / Client (`@gluezero/routing` invoca `valibotAdapter` di F2) | — | Riuso pipeline F2 — opt-in via `response: { canonical: 'id' }` |
| AbortController lifecycle | Browser / Client (`@gluezero/routing` + `@gluezero/gateway/http`) | — | Browser AbortSignal API; cascade da unsubscribe → fetch.signal |
| Auth header injection + refresh | Browser / Client (`@gluezero/gateway/http` AuthStrategy) | API / Backend (issues token via 401/refresh endpoint) | Browser legge token via callback config; refresh è browser-orchestrato |
| URL allowlist enforcement | Browser / Client (`@gluezero/gateway/http`) | — | Pre-fetch guard — runtime validation prevention contro client-side mistake |
| Idempotency token generation | Browser / Client (`@gluezero/gateway/http` + nanoid) | API / Backend (server deduplicates by key) | Client-generated `nanoid()`; precondizione documentata DOC-04: server-side dedup obbligatorio per garanzia E2E |
| Pipeline tap step 8/9/10 | Browser / Client (`@gluezero/routing`) | — | EventTap pre-instrumented in F1 — F3 emette no-op snapshot, F6 wirea Inspector reale |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **Native `fetch`** | browser native (ES2022 target) | HTTP request | [VERIFIED: STACK.md] CLAUDE.md vincolo: NO ky/wretch/ofetch esposti. fetch nativo + custom Gateway |
| **Native `AbortController`** | browser native | Request cancellation | [VERIFIED: STACK.md] Built-in browser API; pattern già usato in F1 plugin signal cascade |
| **`nanoid`** | 5.1.9 | Idempotency token generation | [VERIFIED: pnpm-lock.yaml] Già installato in F1 (per BrokerEvent.id). Riuso = zero new dep |
| **`valibot`** | 1.3.1 | Response schema validation (riuso F2) | [VERIFIED: pnpm-lock.yaml] Già installato in F2. Riuso `valibotAdapter` di `@gluezero/mapper` |
| **`@gluezero/core`** | workspace:* | Broker base + EventTap | [VERIFIED: file packages/core/] F1 complete |
| **`@gluezero/mapper`** | workspace:* | MapperEngine + canonical schemas | [VERIFIED: file packages/mapper/] F2 complete |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **`msw`** | 2.13.6 | HTTP mock per integration test | [VERIFIED: package.json:32] Già dev-dep root (F1 plan 01-02). NO new install |
| **`tsup`** | 8.5.1 | Build ESM-only + dts | [VERIFIED: F1/F2 baseline] Replica pattern F1/F2; subpath entry per `gateway/http` |
| **`vitest`** | 4.1.5 | Test runner | [VERIFIED: F1/F2 baseline] |
| **`@vitest/coverage-v8`** | 4.1.5 | Coverage v8 ≥ 90% | [VERIFIED: pnpm-lock.yaml] Già installato in F2 plan 02-01 |
| **`jsdom`** | 29.1.0 | DOM env per integration test | [VERIFIED: package.json:30] Default env vitest config dei package F2 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| fetch nativo + custom Gateway | `ky` 1.x (~3 KB) | [REJECTED: CLAUDE.md vincolo + STACK.md] copre 70-80% policy PRD, richiederebbe wrap → indirezione inutile |
| fetch nativo + custom Gateway | `ofetch` 1.x (~5 KB) | [REJECTED] Lega a UnJS ecosystem; bundle maggiore di custom |
| fetch nativo + custom Gateway | `axios` (~13 KB) | [REJECTED: STACK.md] Pesante, no native fetch, no ESM-first |
| nanoid per Idempotency-Key | `crypto.randomUUID()` nativo | [ACCEPTABLE FALLBACK] Funziona ma 36 char con dash, già sostituito in F1 da nanoid. Mantenere coerenza |
| nanoid per Idempotency-Key | `uuid` v9 (~5 KB) | [REJECTED] 5x più pesante di nanoid, già installato |
| Strategy Pattern in chain of responsibility | RxJS operators | [REJECTED: STACK.md] Paradigma observable estraneo a PRD §16.2; ~25-30 KB |
| msw 2.x | nock (Node-only) | [REJECTED] No browser mode (utile per F4 SSE/WS in browser real); msw 2.x copre Node + browser |

**Installation:**
```bash
# NON serve install — tutte le dep già installate in F1/F2.
# F3 plan 03-01 (scaffold) deve solo:
pnpm add @gluezero/core@workspace:* @gluezero/mapper@workspace:* nanoid@5.1.9 valibot@1.3.1 --filter @gluezero/routing
pnpm add @gluezero/core@workspace:* @gluezero/mapper@workspace:* nanoid@5.1.9 --filter @gluezero/gateway
pnpm add -D tsup@8.5.1 vitest@4.1.5 typescript@6.0.3 jsdom@29.1.0 --filter @gluezero/routing
pnpm add -D tsup@8.5.1 vitest@4.1.5 typescript@6.0.3 jsdom@29.1.0 --filter @gluezero/gateway
```

**Version verification:** Tutte le versioni sono lockate dal pnpm-lock.yaml di F1/F2 e GIÀ INSTALLATE. NO new install necessario per F3, solo wiring delle dep esistenti via pnpm filter.

## Architecture Patterns

### System Architecture Diagram

```
                         ┌──────────────────────┐
                         │    Plugin Publisher  │
                         │ (es. weather-form)   │
                         └──────────┬───────────┘
                                    │ broker.publish('weather.requested', {...}, {source})
                                    ▼
        ┌─────────────────────────────────────────────────────────────────┐
        │                     RouterBroker (F3 wrapper)                    │
        │                                                                  │
        │  ┌───────────────────────── publish() ─────────────────────────┐│
        │  │                                                              ││
        │  │  Step 1-3 (F1) → Step 4-6 (F2) → Step 7 (F1+F3 backpressure)││
        │  │                              │                                ││
        │  │                              ▼                                ││
        │  │              ┌────────────────────────────────┐               ││
        │  │              │  Step 8: route.resolved (F3)   │               ││
        │  │              │  RouteResolver.resolve(topic)  │               ││
        │  │              │  → CompiledRoute[] match      │               ││
        │  │              │  → first-match | priority | all││               ││
        │  │              └─────────────┬──────────────────┘               ││
        │  │                            ▼                                  ││
        │  │              ┌────────────────────────────────┐               ││
        │  │              │  Step 9: route.executed (F3)   │               ││
        │  │              │  RouteExecutor.execute(route)  │               ││
        │  │              └────┬──────────┬─────────┬──────┘               ││
        │  │                   │          │         │                       ││
        │  │           local   │   http   │   cache │   composite          ││
        │  │           ▼       ▼          ▼         ▼                       ││
        │  │     ┌─────────┐ ┌──────┐ ┌─────────┐ ┌─────────────┐         ││
        │  │     │  bus.   │ │ http │ │ stub F6 │ │ workflow    │         ││
        │  │     │ deliver │ │ gate │ │  (F3:   │ │ check-cache │         ││
        │  │     │  (F1)   │ │ way  │ │  no-op) │ │ → http →    │         ││
        │  │     └─────────┘ └──┬───┘ └─────────┘ │ update-cache│         ││
        │  │                    │                  └──────┬──────┘         ││
        │  │                    │                         │                ││
        │  │                    ▼                         ▼                ││
        │  │              [HTTP GATEWAY POLICY CHAIN]  [composite calls    ││
        │  │              (vedi diagramma sotto)        children handlers] ││
        │  │                    │                         │                ││
        │  │                    └──────────┬──────────────┘                ││
        │  │                               ▼                               ││
        │  │              ┌────────────────────────────────┐               ││
        │  │              │ Step 10: outcome.collected(F3) │               ││
        │  │              │ → publish '<topic>.loaded' OR  │               ││
        │  │              │   '<topic>.failed' (D-80/D-82) │               ││
        │  │              └─────────────┬──────────────────┘               ││
        │  │                            ▼                                  ││
        │  │  Step 11-12 (F2 mapper consumer) → Step 13 (F1 deliver)      ││
        │  │                                                                ││
        │  └────────────────────────────────────────────────────────────────┘│
        └─────────────────────────────────────────────────────────────────┘
                                    │ deliver
                                    ▼
                         ┌──────────────────────┐
                         │   Plugin Consumer    │
                         │ (es. weather-widget) │
                         └──────────────────────┘


                       HTTP GATEWAY POLICY CHAIN (D-68 Strategy Pattern)
                       ═══════════════════════════════════════════════
        ┌────────────┐   ┌─────────────┐   ┌────────────┐   ┌──────────────┐
        │  request   │ → │ allowlist   │ → │ auth       │ → │ idempotency  │
        │   build    │   │ guard       │   │ inject     │   │ inject       │
        │ (D-96)     │   │ (D-71/SEC-5)│   │ (D-72/SEC1)│   │ (D-70/SEC-3) │
        └────────────┘   └─────────────┘   └────────────┘   └──────┬───────┘
                                                                    ▼
        ┌────────────┐   ┌─────────────┐   ┌────────────┐   ┌──────────────┐
        │  outcome   │ ← │  response   │ ← │  retry     │ ← │  dedupe +    │
        │  collect   │   │   parse +   │   │  loop      │   │ backpressure │
        │            │   │  validate   │   │ (D-69)     │   │ (D-74/D-75)  │
        └────────────┘   └─────────────┘   └─────┬──────┘   └──────┬───────┘
                                                 │                 │
                                                 ▼                 ▼
                                      ┌──────────────┐    ┌──────────────┐
                                      │   timeout    │    │    fetch     │
                                      │ (AbortCtrl)  │ →  │   native     │
                                      └──────────────┘    └──────────────┘
```

### Subpath Exports Recommendation

**Decisione:** `@gluezero/gateway` USA **subpath exports** per separare HTTP (F3) e SSE/WS (F4):

- `@gluezero/gateway/http` — Phase 3 (questo phase)
- `@gluezero/gateway/sse-ws` — Phase 4

**Pattern `package.json` `exports` field:**
```json
{
  "name": "@gluezero/gateway",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./http": { "types": "./dist/http/index.d.ts", "import": "./dist/http/index.js" },
    "./sse-ws": { "types": "./dist/sse-ws/index.d.ts", "import": "./dist/sse-ws/index.js" }
  },
  "size-limit": [
    { "name": "@gluezero/gateway/http (gzip)", "path": "dist/http/index.js", "limit": "6 KB", "gzip": true }
  ]
}
```

**Rationale (HIGH confidence):**
1. **Tree-shaking esplicito**: consumer F3-only NON paga il bundle di F4 SSE/WS quando arriverà. Pattern coerente con monorepo MyApp+SubApp di tutti i grossi monorepo TS (`@octokit/rest/plugins`, `@aws-sdk/client-s3/credential`).
2. **Dependency boundary chiaro**: il `RouterBroker` di F3 può importare SOLO da `@gluezero/gateway/http` — cross-import F3→F4 sub-module impossibile per costruzione.
3. **Bundle budget separato**: `size-limit` può fissare 6 KB per `gateway/http` indipendente dal totale `gateway` (che includerà F4).
4. **`tsup` supporta multi-entry** via `entry: { 'index': 'src/index.ts', 'http/index': 'src/http/index.ts' }` zero-config.

[CITED: Node.js subpath exports docs https://nodejs.org/api/packages.html#subpath-exports + npm exports field stable from npm v7]

**Alternativa rejected:** package separati (`@gluezero/gateway-http` + `@gluezero/gateway-sse`) — overhead di 2 package.json + 2 build pipeline + 2 changeset entries; subpath exports è il sweet spot.

### Recommended Project Structure

```
packages/routing/src/
├── augment.ts                       # PipelineStep + PluginDescriptor.routes + BrokerConfig.routes + CanonicalSchema.requiresRoute
├── types/
│   ├── route-definition.ts          # RouteDefinition discriminated union (local|http|cache|composite)
│   ├── route-policies.ts            # RetryPolicyConfig, DedupePolicyConfig, BackpressurePolicyConfig, ConcurrencyPolicy
│   ├── route-outcome.ts             # RouteOutcome, RouteResult, RouteError
│   └── routing-config.ts            # RoutingConfig (multipleRoutesPolicy, ecc.)
├── route-resolver.ts                # dispatch table compile + first-match/priority/all (D-64, D-66)
├── route-executor.ts                # execute by type (local|http|cache|composite) (D-65)
├── route-handlers/
│   ├── local-handler.ts             # delega a inner.publish (≤30 LOC)
│   ├── http-handler.ts              # invoca @gluezero/gateway/http
│   ├── cache-handler.ts             # placeholder F6 — emette <topic>.failed `cache.not-implemented` finché F6 wirea
│   └── composite-handler.ts         # workflow check-cache → http → publish (cache stub F3, full F6)
├── router-engine.ts                 # registerRoute/unregisterRoute + dispatch table state
├── router-broker-wrapper.ts         # RouterBroker = wrap(MapperBroker) — composition wrapper (D-83)
├── public-factory.ts                # createRouterBroker(config) Valibot validation
├── outcome-collector.ts             # step 10 — RouteOutcome → publish loaded|failed (D-80/D-82)
├── strategies/
│   ├── first-match.ts               # default ROUTE-15
│   ├── priority-ordered.ts          # priority numeric override
│   └── all-broadcast.ts             # opt-in fan-out
├── test-utils/
│   └── router-harness.ts            # extends createMapperHarness con mockServer msw + defineRoute helper
├── __integration__/
│   ├── scenario-meteo-http.test.ts  # PRD §29 end-to-end con HTTP
│   ├── retry-policy.test.ts         # 4xx/5xx/408/429/network differentiation
│   ├── dedupe.test.ts               # 2 fetch identiche → 1 sola network call
│   ├── concurrency-latest-only.test.ts
│   ├── url-allowlist.test.ts
│   └── route-cascade-cleanup.test.ts # LIFE-02 ext F3
└── index.ts                         # public API barrel

packages/gateway/src/
├── augment.ts                       # BrokerConfig.gateway extension (D-93)
├── http/
│   ├── types/
│   │   ├── gateway-config.ts        # GatewayConfig (auth, allowlist, defaults, circuitBreaker)
│   │   ├── http-strategies.ts       # RetryStrategy, TimeoutStrategy, DedupeStrategy, BackpressureStrategy, AuthStrategy, IdempotencyStrategy interfaces
│   │   └── http-error.ts            # GatewayError shape (D-80 codes)
│   ├── http-gateway.ts              # entry point: fetch + policy chain composition
│   ├── strategies/
│   │   ├── retry-strategy.ts        # ExponentialBackoffWithJitter (D-69, full jitter formula)
│   │   ├── timeout-strategy.ts      # FixedTimeout via AbortSignal.timeout()
│   │   ├── dedupe-strategy.ts       # KeyBased Map<key, Promise> (D-74)
│   │   ├── backpressure-strategy.ts # LatestOnly + queue-bounded + throttle + debounce (D-75)
│   │   ├── auth-strategy.ts         # BearerHook + single-flight refresh (D-72)
│   │   ├── idempotency-strategy.ts  # auto Idempotency-Key via nanoid (D-70)
│   │   └── circuit-breaker.ts       # opt-in (D-99)
│   ├── url-allowlist.ts             # SEC-05 (D-71)
│   ├── retry-after-parser.ts       # parse HTTP-date | delta-seconds | cap a maxBackoff
│   ├── policy-chain.ts              # chain of responsibility composition (auth → idempotency → dedupe → backpressure → timeout → fetch → parse → validation)
│   ├── public-factory.ts            # createHttpGateway(config) Valibot validation
│   └── index.ts                     # http subpath barrel
├── (sse-ws/  — F4 placeholder)
└── index.ts                         # gateway umbrella barrel (re-export http subpath types)
```

### Pattern 1: Composition Wrapper (replicato da F2 D-49)
**What:** `RouterBroker` compone `MapperBroker` come dipendenza interna privata. `RouterBroker.publish` intercetta il flow per inserire step 7-full/8/9/10, poi delega `inner.publish` per il resto.
**When to use:** OBBLIGATORIO. Vincolo D-83. ZERO modifiche a `packages/core/` runtime e `packages/mapper/` runtime.
**Example:**
```typescript
// Source: packages/mapper/src/broker-mapper-wrapper.ts (pattern già provato in F2)
export class RouterBroker {
  private readonly inner: MapperBroker  // composition, NON subclass
  private readonly resolver: RouteResolver
  private readonly executor: RouteExecutor
  private readonly httpGateway: HttpGateway
  private readonly outcomeCollector: OutcomeCollector

  constructor(config: RouterBrokerConfig = {}) {
    this.inner = new MapperBroker(config)
    this.httpGateway = new HttpGateway(config.gateway)
    this.resolver = new RouteResolver(config)
    this.executor = new RouteExecutor({
      httpGateway: this.httpGateway,
      mapper: /* MapperEngine reference for queryMap/bodyMap reuse */,
      bus: /* delegate to inner for local */,
    })
    this.outcomeCollector = new OutcomeCollector(this.inner)

    // Bootstrap routes da config.routes (analogo F2 bootstrapFromConfig)
    if (config.routes) {
      for (const r of config.routes) this.resolver.register(r)
    }
  }

  publish<T>(topic: string, payload: T, options?: PublishOptions): void {
    const matchedRoutes = this.resolver.resolve(topic)
    // Step 8 tap
    this.emitStep('event.route.resolved', topic, { routeIds: matchedRoutes.map(r => r.id) })

    if (matchedRoutes.length === 0) {
      const schema = this.canonicalRegistry.getForTopic(topic) // helper F2
      if (schema?.requiresRoute) {
        this.publishFailed(topic, /* route.required.missing */)
        return
      }
      // ROUTE-16 default: consegna locale → delegate a inner.publish (route='local' implicit)
      return this.inner.publish(topic, payload, options)
    }

    for (const route of matchedRoutes) {
      this.executeRoute(route, topic, payload, options) // async, non blocca
    }
    // Per local route, anche delega in parallelo a inner (D-65 default 'parallel')
    if (matchedRoutes.some(r => r.type !== 'local')) {
      this.inner.publish(topic, payload, options) // local consumer ricevono comunque
    }
  }

  registerRoute(routeDef: RouteDefinition, ownerId?: string): RouteRegistration {
    return this.resolver.register(routeDef, ownerId)
  }
  unregisterRoute(routeId: string): void {
    this.executor.abortInFlight(routeId)
    this.resolver.unregister(routeId)
  }

  // Cascade D-26 ext F3 (LIFE-02) — chiama super + cascade route
  async unregisterPlugin(id: string): Promise<void> {
    await this.inner.unregisterPlugin(id)
    this.resolver.unregisterByOwner(id) // rimuove route bound a pluginId
    this.executor.abortInFlightByOwner(id) // cascade abort fetch
  }
}
```

### Pattern 2: Dispatch Table Pre-compiled (D-64)
**What:** Al `registerRoute`, il resolver costruisce un `Map<topicPattern, CompiledRoute[]>`. Il lookup runtime è O(segments) via riuso del `TopicTrie<CompiledRoute>` di F1 (CORE-09 D-08).
**When to use:** SEMPRE. Vincolo PITFALLS #16 — niente compilation hot-path.
**Example:**
```typescript
// Source: research-internal — pattern derivato da packages/core/src/core/topic-matcher.ts
import { TopicTrie } from '@gluezero/core/internal' // se esposto, altrimenti riuso via composition

interface CompiledRoute {
  readonly id: string
  readonly definition: Readonly<RouteDefinition>
  readonly ownerId?: string
  readonly priority: number  // default 0
  readonly compiledRequestBuilder?: (canonicalPayload: unknown) => HttpRequestSpec
  readonly compiledResponseMapper?: (serverShape: unknown) => unknown
}

export class RouteResolver {
  private readonly trie = new TopicTrie<CompiledRoute>()
  private readonly byId = new Map<string, CompiledRoute>()
  private readonly byOwner = new Map<string, Set<string>>()  // ownerId → routeIds

  register(def: RouteDefinition, ownerId?: string): RouteRegistration {
    const compiled = this.compile(def)  // pre-compile request build + response mapper
    if (this.byId.has(def.id)) throw createBrokerError({ code: 'route.id.duplicate', ... })
    this.byId.set(def.id, compiled)
    this.trie.insert(def.topic, compiled)  // riuso wildcard trie F1
    if (ownerId !== undefined) {
      const set = this.byOwner.get(ownerId) ?? new Set()
      set.add(def.id)
      this.byOwner.set(ownerId, set)
    }
    return { id: def.id, unregister: () => this.unregister(def.id) }
  }

  resolve(topic: string, multipleRoutesPolicy: 'first-match' | 'priority-ordered' | 'all' = 'first-match'): CompiledRoute[] {
    const matches = this.trie.match(topic)  // O(segments) via trie F1
    if (matches.length === 0) return []
    if (multipleRoutesPolicy === 'first-match') return [matches[0]]
    if (multipleRoutesPolicy === 'priority-ordered') return [...matches].sort((a, b) => b.priority - a.priority).slice(0, 1)
    return matches  // 'all' broadcast
  }
}
```

### Pattern 3: Strategy Pattern + Chain of Responsibility (D-68)
**What:** Ogni policy del gateway è interfaccia tipizzata + implementazione default. Le policy sono composte come **funzioni async pure** in chain — no allocation per request, performance ottimale.
**When to use:** Per il policy chain del HttpGateway (auth → idempotency → dedupe → backpressure → timeout → fetch → parse → validation).
**Example:**
```typescript
// Source: research-internal — pattern derivato da Koa/Hono middleware compose
type GatewayContext = {
  readonly request: HttpRequestSpec
  readonly route: CompiledRoute
  readonly event: BrokerEvent
  signal: AbortSignal  // mutable: ogni layer può combinarli
  attempt: number
  // mutabile man mano che la chain procede
  response?: Response
  parsedBody?: unknown
  canonicalResponse?: unknown
  error?: BrokerError
}

type GatewayMiddleware = (
  ctx: GatewayContext,
  next: () => Promise<void>,
) => Promise<void>

// Composition Koa-style (https://github.com/koajs/compose) — minimal allocation
function compose(middlewares: readonly GatewayMiddleware[]): (ctx: GatewayContext) => Promise<void> {
  return async (ctx) => {
    let index = -1
    const dispatch = async (i: number): Promise<void> => {
      if (i <= index) throw new Error('next() called multiple times')
      index = i
      const fn = middlewares[i]
      if (!fn) return
      await fn(ctx, () => dispatch(i + 1))
    }
    return dispatch(0)
  }
}

// Strategy implementations come middleware
const allowlistMiddleware: GatewayMiddleware = async (ctx, next) => {
  if (!isAllowed(ctx.request.url, ctx.route.definition.gateway?.allowlist)) {
    ctx.error = createBrokerError({ code: 'gateway.url.forbidden', category: 'config', ... })
    return  // NO next() — short-circuit
  }
  await next()
}

const authMiddleware = (auth: AuthStrategy): GatewayMiddleware => async (ctx, next) => {
  const token = await auth.getToken()
  if (token !== undefined) {
    ctx.request = { ...ctx.request, headers: { ...ctx.request.headers, Authorization: `Bearer ${token}` } }
  }
  await next()
  if (ctx.response?.status === 401 && auth.refresh && ctx.attempt === 1) {
    const newToken = await auth.refresh()
    if (newToken !== token) {
      // retry with refreshed token (D-72 single shot)
      ctx.request = { ...ctx.request, headers: { ...ctx.request.headers, Authorization: `Bearer ${newToken}` } }
      ctx.attempt++
      await fetchMiddleware(ctx, async () => {})  // direct call
    }
  }
}

const fetchMiddleware: GatewayMiddleware = async (ctx, next) => {
  try {
    ctx.response = await fetch(ctx.request.url, {
      method: ctx.request.method,
      headers: ctx.request.headers,
      body: ctx.request.body,
      signal: ctx.signal,
    })
  } catch (err) {
    ctx.error = createBrokerError({ code: 'gateway.network', category: 'network', originalError: err as Error, ... })
    return
  }
  await next()
}

// Chain composition al gateway level
const policyChain = compose([
  allowlistMiddleware,
  authMiddleware(authStrategy),
  idempotencyMiddleware,
  dedupeMiddleware(dedupeStrategy),
  backpressureMiddleware(backpressureStrategy),
  retryMiddleware(retryStrategy),  // wraps fetchMiddleware internally
  fetchMiddleware,
  responseParseMiddleware,
  validationMiddleware(valibotAdapter),
])
```
**Performance considerations:** chain è composta UNA volta al `createHttpGateway` — runtime è solo invocazione di funzioni. No allocation per request fuori da `GatewayContext` mutabile.

### Pattern 4: AbortSignal propagation cascade (D-76+D-77, PITFALLS #2.B)
**What:** Una request HTTP riceve un `AbortSignal` che combina 3 sorgenti:
1. **Subscriber signal** — propagato dal `subscribe(handler, { signal })` del consumer originario
2. **Concurrency signal** — generato dalla policy `'latest-only'` quando una nuova request arriva
3. **Plugin signal** — `PluginRegistration.abortController.signal` (cascade da `unregisterPlugin`)

Il gateway crea un `AbortController` per la fetch e fa `addEventListener('abort')` su tutti e 3 — il primo che fires aborta la fetch.

**When to use:** Per ogni fetch in `http-handler.ts` / `http-gateway.ts`.

**Example (using `AbortSignal.any()` from ES2024 — verify support):**
```typescript
// Source: research-internal — MDN AbortSignal docs
function combineSignals(...signals: (AbortSignal | undefined)[]): AbortSignal {
  // ES2024 nativo — Chrome 116+, Firefox 124+, Safari 17.4+
  const realSignals = signals.filter((s): s is AbortSignal => s !== undefined)
  if ('any' in AbortSignal && typeof AbortSignal.any === 'function') {
    return AbortSignal.any(realSignals)
  }
  // Fallback per browser older: composite controller
  const composite = new AbortController()
  for (const sig of realSignals) {
    if (sig.aborted) {
      composite.abort(sig.reason)
      break
    }
    sig.addEventListener('abort', () => composite.abort(sig.reason), { once: true })
  }
  return composite.signal
}

// Use in http-handler
const fetchSignal = combineSignals(
  subscriberSignal,            // dal subscribe options
  concurrencyController.signal, // latest-only abort precedente
  pluginRegistration.abortController.signal, // cascade da unregisterPlugin
  AbortSignal.timeout(timeoutMs), // ES2024 nativo timeout
)

await fetch(url, { signal: fetchSignal })
```
[CITED: MDN AbortSignal.any https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/any]

**Verifica supporto:** target ES2022 di GlueZero (PKG-03) NON include `AbortSignal.any()` (ES2024). **Decisione: usare il fallback `combineSignals` polyfill di ~10 LOC sopra**. Documentare in DOC-04 che target ES2022 richiede questa helper interna. F4 quando target sale a ES2024 può rimuovere il polyfill.

### Pattern 5: Single-flight token refresh (D-72 + Common Pitfall 5)
**What:** Quando 5 fetch ricevono 401 contemporaneamente, garantire UN solo `gateway.auth.refresh()` call.

**Example:**
```typescript
// Source: research-internal — pattern Promise singleton
class SingleFlightRefresh {
  private inflightRefresh: Promise<string> | null = null

  async refresh(refreshFn: () => Promise<string>): Promise<string> {
    if (this.inflightRefresh) return this.inflightRefresh
    this.inflightRefresh = refreshFn().finally(() => {
      this.inflightRefresh = null
    })
    return this.inflightRefresh
  }
}

// Use:
const singleFlight = new SingleFlightRefresh()
// 5 chiamate parallele → 1 solo refresh effettivo
const token = await singleFlight.refresh(() => auth.refresh())
```

### Anti-Patterns to Avoid
- **Subclass invece di composition:** Estendere `MapperBroker` (subclass) violerebbe D-83 e D-49. Usare ALWAYS composition (`private readonly inner: MapperBroker`).
- **Compilation di RouteDefinition al publish:** Ricompilare la dispatch table ogni publish è il pitfall #16. Compilare al `registerRoute`.
- **Retry su 4xx senza differenziazione:** PITFALLS #5 BLOCKING. Default retry SOLO su rete + 5xx + 408 + 429.
- **Token in payload event:** PITFALLS #17 + Security Mistakes — auth header al fetch boundary, MAI nel payload.
- **fetch diretto da plugin senza gateway:** Viola ROUTE-06 + SEC-05 (no allowlist). Tutte route HTTP DEVONO passare per `@gluezero/gateway/http`.
- **Backpressure cieco senza priority:** PITFALLS #4. Eventi `priority: 'critical'` (es. `system.error`) non vengono mai droppati.
- **Multiple `<topic>.failed` durante retry:** D-82. Una sola publish a fine ciclo retry+timeout.
- **AbortSignal solo timeout:** Manca propagation subscriber → fetch continua dopo unmount component (PITFALLS #2.B). Usare `combineSignals`.

### Plan Topology — Recommended 12 Plan in 6 Wave

| Wave | Plan | Goal | Files Owned (disgiunta) | Parallelism |
|------|------|------|-------------------------|-------------|
| **1** | **03-01** | Bootstrap `@gluezero/routing` + `@gluezero/gateway` (tsup config, vitest config, tsconfig, deps wiring, size-limit, sideEffects array, README skeleton) | `packages/routing/{tsup.config,vitest.config,tsconfig,package.json,README.md,src/index.ts}` + idem gateway | sequenziale |
| **1** | **03-02** | Public types F3 — `route-definition.ts` (discriminated union local|http|cache|composite), `route-policies.ts`, `route-outcome.ts`, `gateway-config.ts`, `http-strategies.ts`, `http-error.ts` | `packages/routing/src/types/*.ts` + `packages/gateway/src/http/types/*.ts` | parallelo a 03-01 (no conflicts — different files) |
| **2** | **03-03** | `augment.ts` di routing (PipelineStep step 8/9/10 + PluginDescriptor.routes + BrokerConfig.routes + CanonicalSchema.requiresRoute) + barrel re-export | `packages/routing/src/augment.ts`, `packages/routing/src/index.ts` | sequenziale dopo 03-02 |
| **2** | **03-04** | `augment.ts` di gateway (BrokerConfig.gateway) + barrel | `packages/gateway/src/augment.ts`, `packages/gateway/src/http/index.ts`, `packages/gateway/src/index.ts` | parallelo a 03-03 |
| **3** | **03-05** | `RouteResolver` con dispatch table + first-match/priority/all + wildcard via TopicTrie (TDD RED→GREEN) | `packages/routing/src/route-resolver.ts` + test | parallelo a 03-06/03-07 (file ownership disgiunta) |
| **3** | **03-06** | `RouteExecutor` + `route-handlers/{local,cache,composite}.ts` (cache stub F6, composite usa workflow + delegate http) | `packages/routing/src/route-executor.ts`, `packages/routing/src/route-handlers/{local,cache,composite}-handler.ts` + test | parallelo a 03-05/03-07 |
| **3** | **03-07** | `OutcomeCollector` + step 10 publish loaded/failed + shape D-80 errors | `packages/routing/src/outcome-collector.ts` + test | parallelo a 03-05/03-06 |
| **4** | **03-08** | HTTP Gateway core: `http-gateway.ts` + `policy-chain.ts` + `url-allowlist.ts` + `retry-after-parser.ts` + `route-handlers/http-handler.ts` (TDD) | `packages/gateway/src/http/{http-gateway,policy-chain,url-allowlist,retry-after-parser}.ts` + `packages/routing/src/route-handlers/http-handler.ts` + test | parallelo a 03-09/03-10/03-11 |
| **4** | **03-09** | Strategy primitives Wave 4-A — `retry-strategy.ts` + `timeout-strategy.ts` + `idempotency-strategy.ts` (TDD) | `packages/gateway/src/http/strategies/{retry,timeout,idempotency}-strategy.ts` + test | parallelo a 03-08/03-10/03-11 |
| **4** | **03-10** | Strategy primitives Wave 4-B — `dedupe-strategy.ts` + `backpressure-strategy.ts` (TDD) | `packages/gateway/src/http/strategies/{dedupe,backpressure}-strategy.ts` + test | parallelo a 03-08/03-09/03-11 |
| **4** | **03-11** | Strategy primitives Wave 4-C — `auth-strategy.ts` (single-flight refresh) + `circuit-breaker.ts` (opt-in disabled) (TDD) | `packages/gateway/src/http/strategies/{auth,circuit-breaker}-strategy.ts` + test | parallelo a 03-08/03-09/03-10 |
| **5** | **03-12** | `RouterBroker` composition wrapper + `createRouterBroker(config)` Valibot + `router-engine.ts` glue + LIFE-02 ext cascade integration test (TDD) | `packages/routing/src/{router-broker-wrapper,router-engine,public-factory}.ts` + integration cascade test | sequenziale (depends su Wave 3 + 4) |
| **6** | **03-13** | `createRouterHarness` + 6 integration test (scenario meteo HTTP, retry policy, dedupe, concurrency latest-only, URL allowlist, route cascade cleanup) | `packages/routing/src/test-utils/router-harness.ts` + `__integration__/*.test.ts` | sequenziale |
| **6** | **03-14** | Final gate F3 — coverage v8 ≥ 90% + publint/attw/size-limit (routing 5 KB, gateway/http 6 KB) extended + DOC-04 README scenario meteo + JSDoc API pubblica + gsd-verifier | `packages/routing/README.md`, `packages/gateway/README.md`, JSDoc su API pubblica + CI gates extension | sequenziale |

**14 plan totali** in 6 wave. Wave 1 (3-1, 3-2) e Wave 3 (3-5, 3-6, 3-7) e Wave 4 (3-8, 3-9, 3-10, 3-11) sono parallel-safe per file ownership disgiunta.

**Tempo totale stimato (basato su throughput F1/F2):** ~8-12 ore work + ~2 ore final gate. Wave 4 paralleli sono il drag race più grande (4 plan paralleli = ~30-50% riduzione tempo wall-clock vs sequenziale).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP request/response | Custom XHR wrapper | `fetch` nativo | [VERIFIED: STACK.md] CLAUDE.md vincolo. ES2022 supportato evergreen |
| Request cancellation | Custom timeout flag | `AbortController` + `AbortSignal.timeout()` | [CITED: MDN AbortController] Built-in browser API, signal propagation native |
| Multiple signal combination | Boolean flag glue | `AbortSignal.any()` (ES2024) o helper `combineSignals` (~10 LOC) | [CITED: MDN AbortSignal.any] Helper interno per target ES2022 |
| Idempotency token | UUID custom | `nanoid()` 5.x | [VERIFIED: nanoid 5.1.9 installed] 130 B vs 5 KB uuid; URL-safe alphabet |
| Topic wildcard matching | New regex matcher | Riusa `TopicTrie` di F1 (CORE-09) | [VERIFIED: packages/core/src/core/topic-matcher.ts] Pattern già testato O(segments) |
| Schema validation response | Custom validator | `valibotAdapter` di F2 | [VERIFIED: packages/mapper/src/valibot-adapter.ts] Già implementato + tested |
| Canonical mapping (queryMap/bodyMap) | Reimplementare mapper | `MapperEngine` di F2 (`mapToShape`/`mapToCanonical`) | [VERIFIED: packages/mapper/src/mapper-engine.ts] D-96/D-97 |
| ID generation | Math.random | `nanoid()` | [VERIFIED] Pattern F1 createBrokerEvent |
| HTTP test mocking | Stub fetch globale | `msw` 2.13.6 (Node mode `setupServer`) | [VERIFIED: msw installed + WebSearch best practices] |
| Mutex async / single-flight | Custom semaphore | Promise singleton pattern (~5 LOC) | [VERIFIED: industry pattern Tanner Linsley/SWR] Single-flight tramite Promise reuse |
| Backoff jitter | Custom math | `min(maxDelay, base * 2^attempt) * (0.5 + Math.random() * 0.5)` (formula esatta D-69) | [CITED: PITFALLS #5 + AWS Architecture Blog "Exponential Backoff and Jitter"] Full jitter è il pattern canonico |

**Key insight:** F3 estende il monorepo riusando MASSIVAMENTE i building block di F1+F2 (TopicTrie, MapperEngine, valibotAdapter, EventTap, BrokerError, AbortController plumbing). I componenti veramente nuovi sono il `RouteResolver`/`RouteExecutor`/`HttpGateway` + le 7 Strategy primitives. **Niente è "standard library che dovremmo wrappare"** — il dominio del gateway HTTP browser-side ha policy peculiari (idempotency, allowlist, single-flight refresh, retry differenziato 4xx/5xx) che NESSUN wrapper esistente copre al 100%.

## Runtime State Inventory

> **NOT APPLICABLE** — Phase 3 è una phase **greenfield additiva** (aggiunge package, nessun rename/migration). Non ci sono runtime state esistenti da migrare.

Verifica esplicita per categoria (CONTEXT diagnostic):

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — F3 NON modifica dati esistenti, solo aggiunge codice | None |
| Live service config | None — nessuna configurazione esterna esiste ancora | None |
| OS-registered state | None — libreria browser, nessuna registrazione OS | None |
| Secrets/env vars | None — auth token gestiti via `gateway.auth.getToken` callback consumer-provided | None |
| Build artifacts | `packages/routing/dist/*` e `packages/gateway/dist/*` saranno generati ex-novo da 03-01 (placeholder package.json già scaffold-ato) | tsup build genera fresh |

## Common Pitfalls

### Pitfall 1: Compilation di RouteDefinition hot-path
**What goes wrong:** Resolver ricompila `RouteDefinition` (parsing topic pattern, query map, body map) ogni `publish`. CPU spike a ~1000 events/sec, profiler mostra `compileRoute` hot.
**Why it happens:** Implementazione naive: `for (const route of routes) if (matchesTopic(route.topic, eventTopic)) execute(...)` fa parsing del pattern ogni volta.
**How to avoid:** **D-64 enforcement.** Compilare al `registerRoute`: `CompiledRoute` con `requestBuilder` pre-curried (closure su queryMap/bodyMap), inserito nel `TopicTrie<CompiledRoute>` (riuso F1). Runtime: `trie.match(topic)` O(segments).
**Warning signs:** Profiler mostra `compile*` o `parsePattern` nel hot-path. Performance degradation lineare con n. routes.

### Pitfall 2: Retry storm thundering herd (PITFALLS #5.C)
**What goes wrong:** 1000 client perdono connessione simultaneamente. Tutti retry a 1s, 2s, 4s, 8s sincroni. Server martellato a ondate.
**Why it happens:** Backoff puro deterministico senza random component. Client coordinati incidentalmente.
**How to avoid:** **D-69 full jitter formula** OBBLIGATORIA: `min(maxDelay=10000, baseDelay=300 * 2^attempt) * (0.5 + Math.random() * 0.5)`. Test deterministico: in TEST-03 verificare distribuzione 100 retry su 100 client mock — varianza > 0.
**Warning signs:** Server load picco regolare a intervalli `1s, 2s, 4s` post-blackout.

### Pitfall 3: Idempotency token rigenerato sui retry
**What goes wrong:** POST ha `Idempotency-Key: abc123`, riceve 502. Retry rigenera `Idempotency-Key: def456`. Server crea 2 ordini.
**Why it happens:** Token generato dentro `fetchMiddleware` invece che PRIMA della chain retry.
**How to avoid:** **D-70 enforcement.** Token generato in `idempotencyMiddleware` UNA volta al first attempt. Stoccato in `GatewayContext.request.headers['Idempotency-Key']`. Retry middleware riusa lo stesso `request` object — lo header persiste. Test: 5xx → 3 retry → verifica msw handler riceve stesso `Idempotency-Key` su tutti.
**Warning signs:** Server logs mostrano N `Idempotency-Key` distinte per topic singolo `<entity>.created.requested`.

### Pitfall 4: AbortSignal subscriber non propagato (PITFALLS #2.B)
**What goes wrong:** Component unmount → `subscribe(handler, {signal})` aborta → MA fetch continua, response arriva a component morto. `setState on unmounted component` warning.
**Why it happens:** Il subscriber signal è propagato solo al `bus.subscribe`, non al http-gateway. La fetch ha solo `AbortSignal.timeout(timeoutMs)`.
**How to avoid:** **D-77 enforcement** + Pattern 4 `combineSignals`. Per topic `*.requested` con route HTTP, il subscriber signal va passato attraverso il BrokerEvent metadata o accessibile via `correlationId` lookup. Implementazione tactical: il `RouterBroker` mantiene `Map<correlationId, AbortController>` per request bound a subscribe; quando subscriber abort fires, lookup e propagate.
**Warning signs:** Console warning `AbortError` o `setState on unmounted` correlato a request lente.

### Pitfall 5: Token refresh storm — 5 fetch parallele riceve 401
**What goes wrong:** 5 fetch parallele hanno token scaduto. Tutte e 5 ricevono 401 simultaneamente. 5 chiamate separate a `auth.refresh()` → 5 nuovi token (forse) o rate-limit dal server auth → tutti i refresh falliscono → 5 `auth.expired` events.
**Why it happens:** Refresh non coordinato. Ogni middleware esegue indipendente.
**How to avoid:** **Pattern 5 SingleFlightRefresh.** `auth.refresh()` wrapped in Promise singleton — la prima chiamata triggers il refresh effettivo, le altre 4 awaitano la stessa Promise.
**Warning signs:** Server auth logs spike `POST /auth/refresh` correlato a singolo logout/expiration browser-side.

### Pitfall 6: Backpressure storage unbounded
**What goes wrong:** Route con `concurrency: 'serial'` accumula 10000 request in coda. Memory leak.
**Why it happens:** Default `'queue-bounded'` non specificato. Coda cresce illimitata.
**How to avoid:** **D-75** queue-bounded di default `max: 100` per route. Documenta in DOC-04 il default. Per `concurrency: 'serial'` o `'queue-bounded'`, esplicita `max` obbligatorio.
**Warning signs:** `getDebugSnapshot().routes.queueLength` cresce monotonamente.

### Pitfall 7: URL allowlist bypass via redirect (PITFALLS #17.C)
**What goes wrong:** Allowlist `[/api/*]`. Server risponde 302 → `evil.com`. fetch segue redirect. Token allegato finisce su evil.com.
**Why it happens:** fetch default `redirect: 'follow'` senza re-validation post-redirect.
**How to avoid:** **D-71 enforcement.** Default `redirect: 'manual'` per request HTTP route. Su 3xx → re-validate URL contro allowlist → se OK, second fetch manuale; se KO, throw `gateway.url.forbidden`. Documenta in DOC-04 + test esplicito (302 verso evil.com → block).
**Warning signs:** Token leaked nei server log di terze parti che condividono server cluster con allowlisted endpoint.

### Pitfall 8: Network error vs CORS vs DNS — fetch throw shape variabile
**What goes wrong:** `fetch` throw senza response per: CORS block, DNS fail, offline, abort utente, abort latest-only, abort timeout, network unreachable. Discriminare richiede inspection di `error.name`/`error.message` browser-specifico.
**Why it happens:** WHATWG fetch spec lascia error shape implementation-defined.
**How to avoid:** Helper `classifyFetchError(err, signal)` che usa:
- `signal.aborted && signal.reason === 'gateway.timeout'` → timeout
- `signal.aborted && signal.reason === 'concurrency.latest-only'` → abort policy
- `err.name === 'AbortError' && !signal.aborted` → abort esterno (subscriber/plugin)
- `err.message?.includes('CORS') || err.message?.includes('blocked by CORS')` → CORS
- `TypeError: Failed to fetch` → network/offline (Chrome)
- `TypeError: NetworkError` → network/offline (Firefox)
- default → `gateway.network`

**Warning signs:** Tutti gli errori classificati come `gateway.network`; user-facing UI non distingue offline da CORS misconfiguration.

### Pitfall 9: Dispatch table cascade leak
**What goes wrong:** `unregisterPlugin('weather-plugin')` rimuove subscription ma NON le 3 route registrate dal plugin. Route restano nel resolver e continuano a intercept eventi → fetch da plugin morto.
**Why it happens:** Cascade D-26 ext F3 dimenticato.
**How to avoid:** **D-86 enforcement.** Test deterministico: registra plugin con 3 route + 5 subscribe → unregister → verifica `getDebugSnapshot().routes.byOwner['weather-plugin']` empty + `resolver.byOwner.has('weather-plugin') === false`. + cascade abort fetch in volo.
**Warning signs:** `getDebugSnapshot().routes.count` non torna a baseline post-unregister.

## Code Examples

### Routing entry — `createRouterBroker(config)` consumer pattern
```typescript
// Source: research-internal — pattern derivato da packages/mapper/src/public-factory.ts:123
import { createRouterBroker } from '@gluezero/routing'

const broker = createRouterBroker({
  runtime: { logLevel: 'info' },
  canonicalModel: {
    schemas: [{
      id: 'weather',
      fields: {
        location: { type: 'string', required: true },
        forecast_date: { type: 'string', required: true },
        temperature_celsius: { type: 'number', required: false },
        weather_condition: { type: 'string', required: false },
      },
    }],
  },
  gateway: {
    allowlist: [/^\/api\//, 'https://api.example.com/*'],
    auth: {
      getToken: async () => localStorage.getItem('token') ?? undefined, // dev only — prod usa cookie httpOnly
      refresh: async () => {
        const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
        const { token } = await res.json()
        return token
      },
    },
    defaults: {
      timeout: 5000,
      retry: { maxAttempts: 3, baseDelayMs: 300, maxDelayMs: 10000 },
      idempotency: { mode: 'auto', headerName: 'Idempotency-Key' },
    },
  },
  routes: [{
    id: 'weather-http',
    type: 'http',
    topic: 'weather.requested',
    request: {
      method: 'GET',
      url: '/api/weather',
      queryMap: { location: 'city', forecast_date: 'date' }, // canonico → server
    },
    response: { canonical: 'weather' },
    publishes: { success: 'weather.loaded', error: 'weather.failed' },
    policies: {
      timeout: 5000,
      concurrency: 'latest-only', // auto-detected (default per *.requested + GET)
      dedupe: { keyFrom: ['location', 'forecast_date'] },
    },
  }],
})

// Plugin form pubblica
broker.publish('weather.requested', { location: 'Roma', forecast_date: '2026-04-30' }, {
  source: { type: 'plugin', id: 'weather-form' },
})

// Plugin widget consumer
broker.subscribe('weather.loaded', (event) => {
  console.log(event.payload) // { location, forecast_date, temperature_celsius, weather_condition }
}, { ownerId: 'weather-widget' })
```

### HTTP Gateway internals — policy chain compose
```typescript
// Source: research-internal — pattern Koa middleware compose
// File: packages/gateway/src/http/http-gateway.ts
import type { GatewayConfig, HttpRequestSpec, HttpResponseSpec } from './types'
import { compose } from './policy-chain'
import { allowlistMiddleware } from './url-allowlist'
import { authMiddleware } from './strategies/auth-strategy'
import { idempotencyMiddleware } from './strategies/idempotency-strategy'
import { dedupeMiddleware } from './strategies/dedupe-strategy'
import { backpressureMiddleware } from './strategies/backpressure-strategy'
import { retryMiddleware } from './strategies/retry-strategy'
import { fetchMiddleware } from './fetch-middleware'
import { responseParseMiddleware } from './response-parse'
import { validationMiddleware } from './validation'

export class HttpGateway {
  private readonly chain: (ctx: GatewayContext) => Promise<void>
  private readonly inFlight = new Map<string, AbortController>()

  constructor(private readonly config: GatewayConfig = {}) {
    this.chain = compose([
      allowlistMiddleware(config.allowlist),
      authMiddleware(config.auth),
      idempotencyMiddleware(config.defaults?.idempotency),
      dedupeMiddleware(config.defaults?.dedupe),
      backpressureMiddleware(config.defaults?.backpressure),
      retryMiddleware(config.defaults?.retry),
      fetchMiddleware,
      responseParseMiddleware,
      validationMiddleware,
    ])
  }

  async execute(request: HttpRequestSpec, route: CompiledRoute, event: BrokerEvent): Promise<HttpResponseSpec> {
    const controller = new AbortController()
    const ctx: GatewayContext = {
      request,
      route,
      event,
      signal: controller.signal,
      attempt: 0,
    }
    this.inFlight.set(event.id, controller)
    try {
      await this.chain(ctx)
      if (ctx.error) throw ctx.error
      return { ok: true, status: ctx.response!.status, body: ctx.canonicalResponse }
    } finally {
      this.inFlight.delete(event.id)
    }
  }

  abortInFlight(eventId: string): void {
    this.inFlight.get(eventId)?.abort('gateway.aborted')
  }

  abortInFlightByOwner(ownerId: string): void {
    for (const [id, ctrl] of this.inFlight) {
      // ownerId tracking via WeakMap or context lookup
      ctrl.abort('plugin.unregistered')
    }
  }
}
```

### Test setup msw 2.x Node mode (D-89, TEST-02)
```typescript
// Source: research — msw 2.x best practices [CITED: https://mswjs.io/docs/integrations/node/]
// File: packages/routing/src/test-utils/msw-server.ts
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

// Default handlers — happy paths only (msw best practice)
export const defaultHandlers = [
  http.get('/api/weather', ({ request }) => {
    const url = new URL(request.url)
    return HttpResponse.json({
      city: url.searchParams.get('city') ?? 'Unknown',
      date: url.searchParams.get('date') ?? '',
      temp: 22,
      condition: 'sunny',
    })
  }),
]

export const server = setupServer(...defaultHandlers)

// File: packages/routing/vitest.config.ts (extend setupFiles)
//   setupFiles: ['./src/test-utils/vitest.setup.ts']
//
// File: packages/routing/src/test-utils/vitest.setup.ts
import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from './msw-server'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' })) // strict: any unhandled URL throws
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

```typescript
// Per-test override (best practice msw 2.x)
import { http, HttpResponse } from 'msw'
import { server } from '../test-utils/msw-server'

it('publishes weather.failed con code gateway.5xx dopo 3 retry', async () => {
  let attempts = 0
  server.use(
    http.get('/api/weather', () => {
      attempts++
      return HttpResponse.json({ message: 'server error' }, { status: 500 })
    }),
  )

  const broker = createRouterBroker(/* ... */)
  // ... publish + assert weather.failed

  expect(attempts).toBe(3) // maxAttempts default D-69
})
```

### Retry-After header parsing
```typescript
// Source: research-internal — RFC 7231 §7.1.3
// File: packages/gateway/src/http/retry-after-parser.ts

const MAX_BACKOFF_MS = 60_000 // cap a 60s — evita "retry tra 1 ora" attack

/**
 * Parse `Retry-After` header per RFC 7231 §7.1.3.
 * Supporta entrambe le forme: delta-seconds (integer) e HTTP-date.
 * Cap a MAX_BACKOFF_MS per evitare retry tra 1 ora (D-69 ragionevole).
 */
export function parseRetryAfter(headerValue: string | null, now: number = Date.now()): number | undefined {
  if (!headerValue) return undefined
  const trimmed = headerValue.trim()

  // Forma 1: delta-seconds (es. '120')
  const seconds = Number(trimmed)
  if (!Number.isNaN(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, MAX_BACKOFF_MS)
  }

  // Forma 2: HTTP-date (es. 'Wed, 21 Oct 2026 07:28:00 GMT')
  const dateMs = Date.parse(trimmed)
  if (!Number.isNaN(dateMs)) {
    const delta = dateMs - now
    if (delta < 0) return 0  // already past — retry immediately
    return Math.min(delta, MAX_BACKOFF_MS)
  }

  return undefined  // malformed
}
```

### `requiresRoute` declaration merging (D-67/D-95)
```typescript
// File: packages/routing/src/augment.ts
declare module '@gluezero/mapper' {
  interface CanonicalSchema {
    /**
     * F3 augmentation (D-95, ROUTE-16, chiusura PRD §39 #5).
     *
     * Se `true`, un evento pubblicato sul topic mappato richiede una route registrata.
     * Topic senza route → `BrokerError 'route.required.missing'` + publish `<topic>.failed`.
     * Default `false` → consegna locale ai subscriber (PRD §17.3).
     */
    readonly requiresRoute?: boolean
  }
}

declare module '@gluezero/core' {
  interface PluginDescriptor {
    /** F3 augmentation (D-94): route auto-registrate con ownerId=pluginId */
    readonly routes?: readonly RouteDefinition[]
  }
  interface BrokerConfig {
    /** F3 augmentation (D-93/D-62): route registrate al boot */
    routes?: readonly RouteDefinition[]
    /** F3 augmentation: gateway HTTP config (D-71/D-72/D-69) */
    gateway?: GatewayConfig
  }
}

// PipelineStep extension via literal union additive (pattern F2 plan 02-09)
export type F3PipelineStep =
  | 'event.route.resolved'
  | 'event.route.executed'
  | 'event.outcome.collected'

export const __augmentLoaded: true = true
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `setTimeout` per timeout | `AbortSignal.timeout(ms)` | ES2022 (Node 17+, Chrome 103+) | Single-source signal cancellation |
| Manual signal combination | `AbortSignal.any([s1, s2])` | ES2024 (Chrome 116+, FF 124+, Safari 17.4+) | F3 target è ES2022 → usare polyfill helper interno |
| Try/catch per fetch error classification | `error.name === 'AbortError'` discrimination | Stable evergreen | Documenta in `classifyFetchError` |
| `Idempotency-Key` ad-hoc | Standard de-facto stripe/aws/k8s | Pattern industriale | D-70 follow industry standard |
| Custom retry with `setTimeout` | Strategy Pattern + AbortSignal cancellation | Pattern Polly.NET / AWS SDK retry | Implementazione D-69 |
| msw 1.x request handlers (rest.get) | msw 2.x http handlers (`http.get`) | msw 2.0 (2023) | API completamente diversa — già installata 2.13.6, doc ok |
| URL allowlist regex array | Per-route allowlist + post-redirect re-validation | Best practice "secure by default" | D-71 enforcement |
| Token in Authorization header sempre | Token scope-aware per allowlist endpoints only | OWASP best practice | D-72: cross-origin auth opt-in esplicito |

**Deprecated/outdated:**
- **`reconnecting-websocket`**: già deprecated nella research F1 — non usato qui (F4 problem)
- **`axios.interceptors`**: pattern non ESM-clean, sostituito da middleware functional
- **Polling con `setInterval`**: sostituito da SSE/WS (F4) o long-polling tactical
- **`document.cookie` parsing manuale**: preferire `credentials: 'include'` su fetch + cookie httpOnly server-side

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `AbortSignal.any()` non in target ES2022 → fallback polyfill ~10 LOC | Pattern 4 | LOW — polyfill è ben testato; F4 può rimuoverlo. Verifica in plan 03-08 con `npm view typescript@6.0.3` lib check |
| A2 | `nanoid()` 21 char produce entropia sufficiente per `Idempotency-Key` (collision < 1e-10 per 10M ID/h) | D-70 / Pattern 3 | LOW — pattern già usato per BrokerEvent.id senza issue |
| A3 | `fetch` `redirect: 'manual'` blocca redirect cross-origin in tutti gli evergreen | Pitfall 7 | MEDIUM — verificare browser compat in plan 03-08 con test esplicito (302 → block) |
| A4 | `MAX_BACKOFF_MS = 60_000` per `Retry-After` cap è ragionevole | retry-after-parser code example | LOW — assunzione conservativa per UX (1 minuto vs 1 ora attack) |
| A5 | Subpath exports `@gluezero/gateway/http` funziona con tsup multi-entry zero-config | Subpath Exports Recommendation | LOW — pattern consolidato (`@aws-sdk/*`, `@octokit/*`); tsup `entry: { ... }` documentato |
| A6 | `msw` 2.13.6 in mode Node con `setupServer` e `onUnhandledRequest: 'error'` è la best practice | Code Examples msw setup | HIGH confidence [VERIFIED via WebSearch best practices] — pattern documentato ufficialmente |
| A7 | `MAX_BACKOFF_MS` per full jitter `maxDelayMs: 10000` è coerente con AWS SDK retry pattern | D-69 | LOW — formula esatta da PITFALLS #5 + AWS Architecture Blog |
| A8 | Bundle budget `routing < 5 KB gz` raggiungibile con dispatch table + 3 strategies | Plan Topology | MEDIUM — F2 mapper era stimato 5 KB e ha sforato a 9.68 KB (size-limit raised a 12 KB). F3 routing potrebbe richiedere headroom simile. **Raccomandazione planner: budget routing 6 KB gz iniziale, raise se necessario al final gate** |
| A9 | Bundle budget `gateway/http < 6 KB gz` raggiungibile con 7 strategies + middleware compose | Plan Topology | MEDIUM — stesso reasoning di A8. **Raccomandazione: budget gateway/http 8 KB iniziale** |
| A10 | Performance overhead route `local` < 5% rispetto a F2 publish | Implications | LOW — route local delega direttamente a `inner.publish`, overhead solo dispatch table lookup O(segments) |
| A11 | Performance overhead route HTTP < 50ms (esclusa fetch network) | Implications | MEDIUM — chain di 9 middleware async; ogni middleware ~1-5ms. Verificare in TEST-03 storm benchmark |

**Risk mitigation:** Le 11 assumption sono verificabili in CI (size-limit, performance benchmark), in test (`AbortSignal.any` polyfill test, redirect block test) o in code review. NESSUNA assumption è BLOCKING o richiede chiarimento user — tutte ragionevoli con fallback documentato.

## Open Questions

1. **`broker.cancelInFlight(eventId)` — necessario in F3 o sufficiente subscribe(signal)?**
   - What we know: D-76 elenca 4 sorgenti di abort (latest-only, unsubscribe/unregister, timeout, utente esplicito). Le prime 3 sono coperte. La quarta — utente esplicito — può essere coperta dall'AbortSignal del subscriber (`subscribe(handler, {signal: myCtl.signal})`).
   - What's unclear: ci sono use case dove il publisher ha bisogno di abort la request HTTP scatenata MA non è il subscriber? (es. publisher è un plugin che pubblica `weather.requested` ma il subscriber è un altro plugin)
   - Recommendation: **Skip in F3.** L'API `broker.cancelInFlight(eventId)` può essere aggiunta in V1.x se emerge un use case concreto. F3 espone subscribe `{signal}` + unregisterPlugin cascade — copre 95% dei casi. Documentare in DOC-04 come limitazione consapevole.

2. **Retry budget cross-route globale per prevenire DOS auto-inflitto?**
   - What we know: PITFALLS #5 cita "retry budget globale per route" come "avanzato V1.x". CONTEXT D-99 deferred il circuit breaker avanzato a V1.x.
   - What's unclear: in F3 il default `maxAttempts: 3` per route potrebbe sommare a `3 * N_routes` retry concorrenti durante uno storm.
   - Recommendation: **Skip in F3.** Default `maxAttempts: 3` + `circuitBreaker: false` di default è sufficiente per V1. Se uno storm si manifesta, il circuit breaker per-route base (D-99) può essere abilitato dal consumer. Cross-route budget → V1.x.

3. **Composite route — cache F6 stub: che payload publicare?**
   - What we know: D-65 dice "F3 implementa la struttura, l'adapter cache effettivo arriva con F6". `composite` workflow è check-cache → server → update-cache → publish.
   - What's unclear: in F3 senza cache funzionante, il composite handler dovrebbe (a) fallire con `cache.not-implemented`, oppure (b) skip cache check e fare direttamente HTTP, oppure (c) emettere warning?
   - Recommendation: **Opzione (b) skip cache check.** Composite handler in F3 è pratically un alias per `http` route con un warning emesso UNA volta in dev mode (tipo `routing.composite.cache-deferred`). Quando F6 arriva, composite acquista la cache senza breaking change. Documentare in DOC-04.

4. **`gateway.allowlist: undefined` di default in dev — warning sufficient?**
   - What we know: D-71 dice "Default `allowlist: undefined` → tutti gli URL consentiti (dev convenience), ma `createBroker` emette warning `'gateway.allowlist.missing'` in dev mode."
   - What's unclear: in production senza allowlist esplicita, dovrebbe il gateway THROW (più strict) o warn (più permissive)?
   - Recommendation: **In dev: warn una volta al `createRouterBroker`. In production (NODE_ENV !== 'development'): silent accept (assumiamo che l'utente sappia cosa fa).** Documentare in DOC-04 come "raccomandazione hard". Lint rule custom (V1.x) può enforcerla CI-side.

5. **HTTP method default per `RouteDefinition.type === 'http'` senza `request.method`?**
   - What we know: D-96 e PRD §17.4 esempi mostrano `method: 'GET'` esplicito.
   - What's unclear: se l'utente omette `request.method`, default a `'GET'` o throw?
   - Recommendation: **Default `'GET'`.** Coerente con HTTP standard e fetch nativo. Documentare in JSDoc.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node ≥ 20 | dev runtime + test runner | ✓ | engines.node ">=20" enforced | — |
| pnpm 10+ | monorepo workspaces | ✓ | 10.33.2 (root package.json) | — |
| TypeScript 6.0+ | source compilation | ✓ | 6.0.3 | — |
| `tsup` 8.x | build | ✓ | 8.5.1 | — |
| `vitest` 4.x | test runner | ✓ | 4.1.5 | — |
| `@vitest/coverage-v8` | coverage gate | ✓ | 4.1.5 | — |
| `msw` 2.x | HTTP mock | ✓ | 2.13.6 | — |
| `valibot` 1.x | response validation (riuso F2) | ✓ | 1.3.1 | — |
| `nanoid` 5.x | idempotency token | ✓ | 5.1.9 | — |
| `jsdom` 29.x | DOM env vitest | ✓ | 29.1.0 | — |
| `playwright` (per test browser real) | browser mode opzionale F3 | ✓ | 1.59.1 | — (F3 usa Node mode di default; browser mode forse F4) |
| Browser fetch | runtime | ✓ | nativo ES2022 | — |
| Browser `AbortController` | runtime | ✓ | nativo | — |
| `AbortSignal.timeout()` | runtime ES2022 | ✓ | ES2022 | polyfill ~5 LOC se serve |
| `AbortSignal.any()` | runtime ES2024 | ✗ | ES2024 not in target | helper `combineSignals` ~10 LOC |
| `crypto.randomUUID()` | fallback ID | ✓ | nativo (ma usiamo nanoid) | — |

**Missing dependencies with no fallback:** Nessuna.

**Missing dependencies with fallback:**
- `AbortSignal.any()` (ES2024) → helper interno `combineSignals` ~10 LOC. Documentare nel plan 03-08 + JSDoc.

## Validation Architecture

> Skipped. `workflow.nyquist_validation: false` in `.planning/config.json:24`.

## Security Domain

> Required. `security_enforcement` non esplicitamente disabilitato in config.json — applicabile.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | AuthStrategy.BearerHook (D-72) — tokenizzato via callback consumer-provided; NO password handling client-side (PRD §26.3) |
| V3 Session Management | yes | Token refresh single-flight (Pattern 5); session lifetime gestito server-side; documentato che cookie httpOnly è raccomandato (PRD §26.3) |
| V4 Access Control | partial | URL allowlist (D-71/SEC-05) limita endpoint accessibili; auth scope per-route (D-72); cross-origin auth opt-in esplicito |
| V5 Input Validation | yes | Valibot adapter (riuso F2) per response validation (VAL-05/D-78); schema canonico per request build (D-96/D-97) |
| V6 Cryptography | partial | NESSUNA crypto custom — Idempotency-Key è random ID (nanoid), NON crittografato. fetch usa TLS server-side (responsabilità browser). NO crypto custom |
| V8 Data Protection | yes | Token MAI in payload event (PITFALLS #17 + Security Mistakes); auth applicato al fetch boundary, NON nel payload |
| V13 Web Services | yes | RESTful API con `Idempotency-Key` standard (D-70); `Retry-After` parsing RFC 7231 conforme; `redirect: 'manual'` per allowlist enforcement |
| V14 Configuration | yes | URL allowlist (D-71); credentials never hardcoded — `getToken` callback consumer-provided; `redirect: 'manual'` default |

### Known Threat Patterns for Browser HTTP Gateway

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| URL allowlist bypass via redirect (Pitfall 7 / PITFALLS #17.C) | Tampering / Information Disclosure | `redirect: 'manual'` + post-redirect URL re-validation contro allowlist (D-71) |
| Token leak cross-origin (PITFALLS #17.D) | Information Disclosure | Auth scope per route (auth applicato solo a endpoint allowlisted); cross-origin opt-in esplicito |
| CSRF via inadvertent credentials | Tampering | `credentials: 'include'` opt-in per route; default `'same-origin'` |
| Idempotency replay attack | Repudiation | Token random nanoid (entropy 126 bit); server-side dedup per chiave documentato come precondizione |
| Token refresh race (5 fetch parallel 401) | DoS / Spoofing | Single-flight refresh (Pattern 5) — 1 sola call refresh, 5 fetch coordinate |
| Retry storm (PITFALLS #5.C thundering herd) | DoS | Full jitter D-69 obbligatorio (formula esatta); `maxAttempts: 3` default; `Retry-After` rispettato con cap 60s |
| Idempotency-Key rigenerato sui retry (Pitfall 3) | Repudiation / Side-effect duplication | Key generata UNA volta in `idempotencyMiddleware` PRIMA della retry chain; persistente su `request.headers` |
| Auth header su redirect cross-origin | Information Disclosure | `redirect: 'manual'` + manual second-fetch con re-validation; documentato in DOC-04 |
| Plugin malevolo registra route che intercetta `system.error` | Spoofing | F1 already enforces `system.*`/`internal.*` topic prefix riservato; F3 registerRoute valida topic non-system |
| Debug snapshot contiene token | Information Disclosure | Sanitizzazione `Authorization` header da `getDebugSnapshot()` snapshot — F6 task |
| Route handler throw causa cascade collapse | DoS | Handler isolation (try/catch attorno a executor → publish `<topic>.failed` con sanitized error). Pattern F1 D-16 |
| Unbounded backpressure queue → memory exhaustion | DoS | Default `queue-bounded` con `max: 100`; `priority: 'critical'` bypass (D-75) |
| Network error classification leak | Information Disclosure | `BrokerError` non espone stack trace in production; sanitization tactical (deferred a F6 con NODE_ENV guard) |

### Project Constraints (from CLAUDE.md)

Direttive estratte da `./CLAUDE.md` che il planner DEVE rispettare:

- **Modello AI**: tutti i sotto-agenti GSD usano `claude-opus-4-7-1` (alias `opus`). Override esplicito `model: "opus"` in ogni `Agent` call.
- **Lingua**: italiano per descrizioni REQ-ID, success criteria, JSDoc, prompt agenti, risposte utente. Codice/identificatori/file/package/log keywords in inglese.
- **Domande**: minimizzare interazioni utente. Procedere su default ragionevoli quando il PRD/ROADMAP/CONTEXT risolve. Chiedere SOLO per ambiguità reali, scelte irreversibili, valori che solo l'utente può fornire.
- **Agent-swarm**: preferire parallelizzazione — spawn multipli in singolo messaggio con tool calls multipli. ALWAYS `model: "opus"`.
- **Vincoli architetturali (PRD §33.2)**: canonical model, mapper bidirezionale, broker unico gateway server, fetch + ≥1 canale realtime inbound (F4), Web Worker (F5), debug/introspection (F6), lifecycle anti-leak, route dichiarative, validazione minima.
- **EventTap pre-instrumented**: F3 emette tap su step 8/9/10 (no-op default, full F6).
- **Stack lockato**: fetch nativo + Gateway custom (NO `ky`/`wretch`/`ofetch` esposti); `msw` 2.x per test; `Valibot` per response validation (riuso F2 ValidatorAdapter); `nanoid` per idempotency token.
- **Pattern composition wrapper come F2 D-49**: ZERO modifiche a `packages/core/` runtime e `packages/mapper/` runtime.
- **Pipeline §28**: estendere step 7-full + 8/9/10 — niente trasformazioni implicite invisibili al debug layer.
- **Open issues PRD §39 chiusura**: F3 chiude #5 (ROUTE-16), #6 (ROUTE-15), #7 (LIFE-02 ext), #8 (ROUTE-09).

Tutte queste direttive sono coerenti con CONTEXT.md decisioni D-60..D-99. Il planner DEVE:
1. Spawn ogni agent con `model: "opus"`.
2. JSDoc + REQ-ID descriptions in italiano.
3. ZERO modifiche a `packages/core/src/` runtime e `packages/mapper/src/` runtime (verifica strict via `git diff` al final gate plan 03-14).
4. msw 2.13.6 + nanoid 5.1.9 + valibot 1.3.1 + jsdom 29.1.0 GIÀ disponibili (NO new install).

## Sources

### Primary (HIGH confidence)
- **`prd.md`** — fonte autoritativa unica del progetto GlueZero (§17 Routing Engine, §18 Gateway Server, §22.3 Eventi standard di errore, §23 Retry/Timeout/Backpressure/Deduplica, §26 Sicurezza, §28 Pipeline ufficiale, §29 Scenario meteo, §39 #5/#6/#7/#8 open issues)
- **`.planning/phases/03-routing-server-gateway-http/03-CONTEXT.md`** — 37 decisioni lockate D-60..D-99 (auto-mode), domain definition, scope-out
- **`.planning/REQUIREMENTS.md`** — 29 REQ-IDs F3 (ROUTE-01..16, VAL-05, ERR-02 ext, SEC-01..05, TEST-01..03 subset, DOC-04)
- **`.planning/ROADMAP.md`** — Phase 3 goal + 5 success criteria
- **`.planning/research/STACK.md`** — fetch nativo + Gateway custom decision (HTTP §4); msw 2.x setup (§2); nanoid (§9); subpath exports pattern
- **`.planning/research/ARCHITECTURE.md`** — pattern Mediator + Pipes-and-Filters + Adapter + Strategy + Chain-of-Responsibility (§2.4-§2.6, §3.2 EventTap pre-instrumented constraint)
- **`.planning/research/PITFALLS.md`** — Pitfall 2 race condition (§70-108), Pitfall 4 backpressure cieca (§162-208), Pitfall 5 retry tossica (§211-262), Pitfall 16 performance (§744-783), Pitfall 17 sicurezza (§787-835)
- **`packages/core/src/types/{tap,broker-event,error,plugin}.ts`** — F1 type contracts + EventTap surface
- **`packages/core/src/core/{bus,broker,plugin-registry,event-tap}.ts`** — F1 runtime + composition pattern + scoped broker
- **`packages/core/src/public-factory.ts`** — `createBroker(config)` Valibot validation pattern (replica per `createRouterBroker`)
- **`packages/mapper/src/broker-mapper-wrapper.ts`** — F2 D-49 composition wrapper PROVATO (esempio diretto da replicare per `RouterBroker`)
- **`packages/mapper/src/public-factory.ts`** — `createMapperBroker` factory pattern (replica per `createRouterBroker`)
- **`packages/mapper/src/augment.ts`** — TS declaration merging pattern (replica per `@gluezero/routing/src/augment.ts`)
- **`packages/mapper/src/test-utils/mapper-harness.ts`** — `createMapperHarness` pattern (replica per `createRouterHarness`)
- **`packages/mapper/package.json`** — sideEffects array + size-limit pattern (replica per routing/gateway)
- **`CLAUDE.md`** — vincoli operativi non negoziabili (modello opus, italiano, no ky/wretch/ofetch, EventTap pre-instrumented)

### Secondary (MEDIUM confidence — ufficial docs)
- [MSW 2.x — Node.js integration](https://mswjs.io/docs/integrations/node/) — setupServer + listen/resetHandlers/close lifecycle
- [MSW 2.x — Structuring handlers](https://mswjs.io/docs/best-practices/structuring-handlers/) — domain-grouped, happy-path-first
- [MSW 2.x — Network behavior overrides](https://mswjs.io/docs/best-practices/network-behavior-overrides/) — runtime overrides per-test
- [MDN — AbortSignal.any()](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/any) — ES2024 multi-signal combination
- [MDN — AbortSignal.timeout()](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static) — ES2022 timeout signal
- [MDN — fetch redirect](https://developer.mozilla.org/en-US/docs/Web/API/RequestInit#redirect) — `'manual'` mode behavior
- [Node.js — subpath exports](https://nodejs.org/api/packages.html#subpath-exports) — `package.json` exports field
- [RFC 7231 §7.1.3](https://datatracker.ietf.org/doc/html/rfc7231#section-7.1.3) — Retry-After header (delta-seconds | HTTP-date)
- [AWS Architecture Blog — Exponential Backoff and Jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/) — full jitter formula canonica
- [Stripe API — Idempotency Keys](https://stripe.com/docs/api/idempotent_requests) — pattern industriale `Idempotency-Key` header

### Tertiary (LOW confidence — pattern derivati / community)
- Koa middleware compose pattern — Chain of Responsibility async (riferimento concettuale per Pattern 3)
- Promise singleton pattern — single-flight cross multiple callers (Tanner Linsley/SWR)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — tutte le dep già installate in F1/F2; pattern provato in `MapperBroker` di F2
- Architecture: HIGH — composition wrapper pattern già provato in F2 plan 02-10 con verifica strict (`git diff packages/core/` → 0 lines)
- Pitfalls: HIGH — 5 pitfall principali documentati in `.planning/research/PITFALLS.md` con strategie di prevenzione esplicite + 4 pitfall research-derived (single-flight refresh, redirect bypass, fetch error classification, dispatch table cascade leak)
- API surface routing: HIGH — D-60..D-67 lockati in CONTEXT.md auto-mode
- HTTP gateway policies: HIGH — D-68..D-72 lockati; pattern industriale validati (jitter AWS, Idempotency-Key Stripe)
- Test strategy: HIGH — `msw` 2.13.6 già installato; pattern best practice da docs ufficiali; `createRouterHarness` estende `createMapperHarness` (pattern F2 plan 02-11 provato)
- Performance budgets: MEDIUM — bundle 5/6 KB potrebbe richiedere headroom (lesson learned F2: 5 KB stimato → 9.68 KB reale → raised a 12 KB). Raccomandazione planner: budget iniziale 6/8 KB, raise se necessario al final gate
- Subpath exports: HIGH — pattern consolidato monorepo TS (`@aws-sdk/*`, `@octokit/*`); tsup multi-entry zero-config

**Research date:** 2026-04-30
**Valid until:** 2026-05-30 (30 days — stack stabile, F1+F2 closed, dep già installate)
