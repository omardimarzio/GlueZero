# Phase 3: Routing & Server Gateway HTTP - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-30
**Phase:** 03-routing-server-gateway-http
**Mode:** `--auto` (no interactive questions; recommended defaults selected from PRD / ROADMAP / REQUIREMENTS / research / CLAUDE.md)
**Areas discussed:** API surface routing, routing engine strategy, HTTP gateway policies, concurrency/dedupe/backpressure, cancellation/AbortSignal, response validation, error standards, pipeline §28 extension, lifecycle cascade, test strategy, type system extension, HTTP request/response mapping, circuit breaker

---

## Mode rationale

`--auto` selected because:
- PRD `prd.md` covers F3 scope explicitly (§17, §18, §22.3, §23, §26.2, §28, §29, §39 #5/#6/#7/#8)
- ROADMAP.md Phase 3 has 5 explicit success criteria + 29 REQ-IDs assigned
- REQUIREMENTS.md Phase 3 mapping table has notes per REQ-ID (e.g., "no retry su 4xx eccetto 408/429" for ROUTE-09)
- Research artifacts (.planning/research/STACK.md, ARCHITECTURE.md, PITFALLS.md, SUMMARY.md) prescribe specific technical choices (full jitter formula, msw 2.x, dispatch pre-compilato, Strategy Pattern)
- CLAUDE.md vincoli operativi (no `ky`/`wretch`/`ofetch`, no polyfill, EventTap pre-instrumented) are non-negotiable
- Phase 1 + Phase 2 CONTEXT.md established locked patterns (composition wrapper D-49, declaration merging D-56, trie segmentato D-08, cascade D-26)

No genuinely ambiguous decisions remained that required user input. All choices are "default raccomandato" selected from documented sources.

---

## A. API Surface Routing (D-60..D-63)

| Option | Description | Selected |
|--------|-------------|----------|
| Single API surface (registerRoute coerente con registerPlugin) | Coerente F1/F2 pattern; Broker centralizzato | ✓ |
| Functional API (createRoute factory + broker.use(route)) | Più funzionale ma rompe coerenza | |

**Recommended default:** D-60 — `registerRoute(routeDefinition)` + `unregisterRoute(routeId)`. Coerente con `registerPlugin` (F1) e `registerCanonicalSchema/registerTransform/registerAlias` (F2). PRD §16.2 esplicito sui metodi imperativi.

**Sub-decision D-63 (`createSembridge` aggregato):**
| Option | Description | Selected |
|--------|-------------|----------|
| Defer aggregato pubblico a F6 (composition wrapper `createRouterBroker`) | Riduce churn API; pattern consolidato F2 D-49 | ✓ |
| Introduce `createSembridge` già in F3 | Più clean ma richiede ancora refactor F4/F5 | |

**Rationale:** F6 quando feature-complete è il momento giusto per il factory unificato.

---

## B. Routing Engine Strategy (D-64..D-67)

| Option | Description | Selected |
|--------|-------------|----------|
| Dispatch table pre-compilata al register | O(1) lookup, riusa trie F1; STACK.md + PITFALLS #16 raccomandano | ✓ |
| Resolution at runtime (loop su route registrate) | Più semplice ma overhead hot-path |  |

**Recommended default:** D-64 — pre-compile + trie segmentato F1 D-08.

**Sub-decision D-66 (multiple routes policy ROUTE-15):**
| Option | Description | Selected |
|--------|-------------|----------|
| `'first-match'` default + `'priority-ordered'` opt-in + `'all'` opt-in | PRD §39 #6 + REQUIREMENTS table note "first-match default + warning" | ✓ |
| `'priority-ordered'` default | Più esplicito ma rompe convenzione "registration order = priority" |  |

**Sub-decision D-67 (topic without route ROUTE-16):**
| Option | Description | Selected |
|--------|-------------|----------|
| Default consegna locale + `requiresRoute: true` opt-in | PRD §39 #5 + REQUIREMENTS table note "default consegna locale" | ✓ |
| Default throw error | Breaking; molti topic locali non hanno route |  |

---

## C. HTTP Gateway Policies (D-68..D-72)

| Option | Description | Selected |
|--------|-------------|----------|
| Strategy Pattern per ogni policy | ARCHITECTURE.md §2.5 esplicito; testabile, intercambiabile | ✓ |
| Single monolithic GatewayClient con flag config | Più semplice ma meno estensibile |  |

**Recommended default:** D-68 — Strategy Pattern per retry, timeout, dedupe, backpressure, auth, error, idempotency.

**Sub-decision D-69 (retry policy ROUTE-09 chiusura PRD §39 #8):**
- Network errors: RETRY
- 5xx: RETRY rispettando `Retry-After`
- 408 / 429: RETRY rispettando `Retry-After`
- Altre 4xx: NO RETRY

Backoff full jitter: `min(maxDelay=10000, baseDelay=300 * 2^attempt) * (0.5 + Math.random() * 0.5)` — formula esatta da PITFALLS #5.

**Sub-decision D-71 (URL allowlist SEC-05):**
- `gateway.allowlist?: string[]` (regex/glob); `undefined` → tutti consentiti (dev convenience) ma warning in dev mode

**Sub-decision D-72 (auth Bearer + token refresh SEC-01/02):**
- `gateway.auth.getToken: () => Promise<string | undefined>` chiamato pre-fetch
- `gateway.auth.refresh: () => Promise<string>` chiamato UNA volta su 401 (no loop)

---

## D. Concurrency / Dedupe / Backpressure (D-73..D-75)

**Sub-decision D-73 (concurrency policy):**
| Option | Description | Selected |
|--------|-------------|----------|
| Auto-detection: `'latest-only'` per `*.requested` + GET, `'parallel'` altrimenti | Coerente PITFALLS #2.A; default safe per UI | ✓ |
| Sempre `'parallel'` default | Rischio race condition response order |  |
| Sempre `'serial'` default | Latency cumulativa inaccettabile |  |

**Sub-decision D-74 (dedupeKey ROUTE-11):**
- Esplicito via `dedupeKey: (event) => string` su route
- Fallback automatico per GET: `routeId + sortedQueryParams`
- Per non-GET: NO dedup automatico (rischio side-effect duplicati documentato)

**Sub-decision D-75 (backpressure ROUTE-10):**
- Priority-aware: eventi `priority: 'critical'` (es. `system.error`) MAI droppati (PITFALLS #4)

---

## E. Cancellation / AbortSignal (D-76, D-77)

**Recommended defaults:**
- `AbortController` per ogni request HTTP in volo (D-76)
- AbortSignal del subscriber propagato alla fetch correlata per `*.requested` (D-77, chiusura PITFALLS #2.B)

---

## F. Response Validation (D-78, D-79)

**Sub-decision D-78 (validation policy VAL-05):**
- Opt-in via `route.response.canonical: 'schemaName'` → riusa F2 step 6 (`event.canonical.validated`)
- Default: senza `response.canonical` → no validation (developer responsibility)

**Sub-decision D-79 (server schema mismatch — TEST-03):**
- Riusa F2 D-44 onFailure policy (`block`/`skip`/`fallback`)
- NO codice nuovo, riuso pieno F2

---

## G. Error Standards F3 (D-80..D-82)

**Sub-decision D-80 (`<topic>.failed` shape):**
- BrokerError shape standardizzata con `code`, `category: 'network'|'validation'|'auth'|'config'`, `routeId`, `topic`, `eventId`, `httpStatus?`, `retryAttempt?`, `retryAfterMs?`

**Sub-decision D-82 (no double publish):**
- `<topic>.failed` UNA volta sola (alla fine retry + timeout)
- Retry intermedi visibili SOLO via Inspector / EventTap (D-83 placeholder F3, full F6)

---

## H. Pipeline §28 Extension (D-83, D-84, D-85)

**Sub-decision D-83 (NO modifica a `bus.ts`/`mapper-engine.ts`):**
- Composition wrapper pattern (F2 D-49) replicato: `RouterBroker = wrap(MapperBroker)`
- ZERO modifiche a `packages/core/` runtime; ZERO modifiche a `packages/mapper/` runtime

**Sub-decision D-84 (ordine pipeline):**
- Step 7 base (F1) + backpressure full (F3) → step 8 NUOVO `event.route.resolved` → step 9 NUOVO `event.route.executed` → step 10 NUOVO `event.outcome.collected` → step 11/12 (F2) → step 13 (F1)

**Sub-decision D-85 (PipelineStep extension):**
- TS declaration merging via `@gluezero/routing/src/augment.ts` (pattern F2)

---

## I. Lifecycle Cascade (D-86, D-87) — chiusura PRD §39 #7

| Option | Description | Selected |
|--------|-------------|----------|
| Cascade route + abort AbortController + cleanup completo (LIFE-02 ext F3) | PRD §39 #7 esplicito; PITFALLS #1 BLOCKING | ✓ |
| Cleanup parziale (solo dispatch table) | Memory leak rischio |  |

**Recommended default:** D-86 — cascade D-26 esteso a route + abort di tutte le fetch in volo bound al `pluginId`. `unregisterRoute(routeId)` esplicito anche disponibile (D-87).

---

## J. Test Strategy F3 (D-88..D-92)

**Sub-decision D-88 (TDD pattern):**
- TDD RED→GREEN come F1/F2; file ownership disgiunta tra plan paralleli (atteso 5-7 strategy implementations parallelizzabili in Wave 4)

**Sub-decision D-89 (integration test scenario meteo):**
- Scenario meteo PRD §29 esteso con HTTP via `msw` 2.x
- `createRouterHarness` estende `createMapperHarness` di F2 con `mockServer` setup

**Sub-decision D-92 (coverage):**
- Riusa `@vitest/coverage-v8` installato in F2 plan 02-12
- ≥ 90% su `@gluezero/routing/` e `@gluezero/gateway/http/`
- Final gate F3 in plan 03-XX dedicato (analogo 01-11 / 02-12)

---

## K. Type System Extension (D-93..D-95)

**Recommended defaults:**
- D-93: declaration merging `BrokerConfig.routes/gateway` (pattern F2 D-56)
- D-94: declaration merging `PluginDescriptor.routes` (pattern F2 D-57)
- D-95: declaration merging `CanonicalSchema.requiresRoute` (chiusura ROUTE-16)

---

## L. HTTP Request/Response Mapping (D-96..D-98)

**Sub-decision D-96 (request mapping canonico→server):**
- Riuso pieno `MapperEngine` di F2 (NO codice mapping nuovo)
- `request.queryMap` invoca `mapper.mapToShape(canonicalPayload, queryMap)`

**Sub-decision D-97 (response mapping server→canonico):**
- `route.response.canonical: 'schemaName'` riferimento al `CanonicalSchema` F2
- Mapper invoca `mapper.mapToCanonical(serverResponse, canonicalSchema)`

**Sub-decision D-98 (request body serialization):**
- Default JSON (`Content-Type: application/json`)
- Opt-in `request.serializer: (canonical) => BodyInit` per form-data/multipart/binary

---

## M. Circuit Breaker (D-99)

| Option | Description | Selected |
|--------|-------------|----------|
| Per-route fail counter base, opt-in disabilitato di default | Minimo F3 senza overhead; PITFALLS suggerisce ma non BLOCKING | ✓ |
| Sliding window stats avanzato (V1.x) | Overkill V1 |  |
| Nessun circuit breaker | Rischio cascading failure su servizi degraded |  |

**Recommended default:** D-99 — opt-in via `gateway.circuitBreaker: { threshold: 5, cooldownMs: 30000 }`. Default `circuitBreaker: false`. Sliding window stats avanzato → V1.x.

---

## Claude's Discretion

Aree dove le scelte di implementazione sono lasciate al planner/researcher:
- Dispatch table storage interno (Map vs trie integrato vs hybrid)
- Strategy registry storage (Map vs Object literal namespace)
- Gateway internals decomposition (`http-gateway.ts` vs `http-client.ts` + `policy-pipeline.ts`)
- `@gluezero/gateway/http` vs `@gluezero/gateway` export path (researcher valuterà in F3 research)
- Naming convention file `.ts`/`.test.ts` interni (segui pattern F1/F2)
- Splitting in plan (atteso ~10-14 plan, wave structure planner-defined)

---

## Deferred Ideas

- Realtime SSE/WS adapter → F4 (`@gluezero/gateway/sse-ws`)
- Cache adapter implementativo (in-memory + IndexedDB) → F6
- Worker route handler (`type: 'worker'`) → F5 (chiude PRD §39 #11 WK-07)
- Route Inspector full snapshot (payload before/after per evento) → F6 (TOOL-01/03)
- Metrics format (TOOL-05 chiude PRD §39 #10) → F6
- Adapter Zod/Ajv per response validation → V2 (V1 solo Valibot)
- Circuit breaker avanzato (sliding window, success rate, fallback URL) → V1.x
- Custom serializer request body (form-data/multipart/binary) → V1.x
- Custom response parser (binary, text plain, multipart) → V1.x
- Retry budget globale cross-route → V1.x
- `createSembridge(config)` factory unificato → F6 (D-63)
- Server push notification protocol oltre SSE/WS → V2

---

## Considered but rejected

- **`ky`/`wretch`/`ofetch`** come dipendenza esposta — REJECTED (CLAUDE.md + STACK.md, decisione locked)
- **`reconnecting-websocket`** polyfill — REJECTED (PRD §31.3 + CLAUDE.md, decisione locked F4)
- **Mapping al runtime** invece di pre-compile per route resolution — REJECTED (PITFALLS #16 hot-path overhead, coerenza F2 D-34)
- **AbortSignal su `publish()`** come parametro pubblico — REJECTED (subscriber API `subscribe(handler, {signal})` sufficiente)
- **`createBroker` aggregato già in F3** — DEFERRED (D-63, churn API pubblica fino a F6)
