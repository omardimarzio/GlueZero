---
phase: 03-routing-server-gateway-http
plan: 08
subsystem: http-gateway-core
tags:
  - http-gateway
  - policy-chain
  - http-handler
  - phase-3
  - gateway
  - routing
  - allowlist
  - redirect-revalidation
  - structural-typing
dependency-graph:
  requires:
    - phase: 03-02
      provides: "@sembridge/gateway/http types (GatewayConfig, HttpStrategies bundle interfaces, HttpRequestSpec/HttpResponseSpec, GatewayErrorCode)"
    - phase: 03-04
      provides: "@sembridge/gateway/http barrel + augment.ts (BrokerConfig.gateway type-only)"
    - phase: 03-05
      provides: "RouteResolver + CompiledRoute interface (consumato dal http-handler)"
    - phase: 03-06
      provides: "RouteExecutor dispatch by type (consumer downstream del httpHandler)"
    - phase: 03-07
      provides: "OutcomeCollector consumer downstream del RouteOutcome"
    - phase: 02
      provides: "MapperEngine (mapToShape D-96 + mapToCanonical D-97 — wired via adapter dal RouterBroker plan 03-12) + valibotAdapter (validate VAL-05)"
    - phase: 01
      provides: "@sembridge/core (BrokerError factory, BrokerEvent, isBrokerError type guard)"
  provides:
    - "HttpGateway class (373 LOC): execute(request, route, event, signal, strategies) → policy chain end-to-end + abortInFlight + abortInFlightByOwner + Pitfall 7 redirect re-validation"
    - "createHttpGateway factory con Valibot validation della GatewayConfig (allowlist string|RegExp, auth function shape, circuitBreaker false|object — D-71/D-72/D-99)"
    - "createHttpHandler factory (300 LOC) in @sembridge/routing — integra mapper.mapToShape + gateway.execute + mapper.mapToCanonical + validator.validate → wrappa in RouteOutcome (D-80 shape)"
    - "4 utility gateway primitives: combineSignals (polyfill AbortSignal.any per ES2022 — Pitfall 4), parseRetryAfter (RFC 7231 §7.1.3 + cap MAX_BACKOFF_MS=60_000ms), validateAgainstAllowlist (SEC-05 / D-71), compose (Koa-style policy chain — RESEARCH §Pattern 3)"
    - "Structural-typed deps interface (HttpHandlerGateway, HttpHandlerMapper, HttpHandlerValidator, HttpHandlerStrategies) per evitare cyclic dependency @sembridge/routing ↔ @sembridge/gateway"
  affects:
    - "03-09 (Strategies Wave 4-A retry+timeout+idempotency): forniranno default implementation di RetryStrategy/TimeoutStrategy/IdempotencyStrategy iniettate via HttpGatewayStrategies bundle al gateway.execute"
    - "03-10 (Strategies Wave 4-B dedupe+backpressure): default DedupeStrategy/BackpressureStrategy"
    - "03-11 (Strategies Wave 4-C auth+circuit-breaker): default AuthStrategy (single-flight refresh) + CircuitBreakerStrategy"
    - "03-12 (RouterBroker wrapper): istanzia HttpGateway via createHttpGateway + wires httpHandler creato via createHttpHandler con MapperEngine adapter + valibotAdapter; cabla strategies bundle a runtime"
    - "03-13 (integration test scenario meteo): msw 2.13.6 setupServer Node mode già funzionante (test gateway lo usa)"
    - "03-14 (final gate): coverage v8 ≥ 90% richiede test deterministici qui presenti + size-limit (gateway/http target 8KB gz)"
tech-stack:
  added:
    - "msw 2.13.6 setupServer Node mode (test deterministici fetch — già presente come devDependency in @sembridge/gateway)"
  patterns:
    - "Pattern 3 (Koa-compose policy chain): minimal allocation per request — closures bound al construct, ctx mutabile in-place. Implementato in policy-chain.ts/compose; RESEARCH lines 555-568"
    - "Pattern 5 (single-flight refresh): delegato a AuthStrategy plan 03-11 — il gateway si limita a chiamare strategies.auth.getToken()"
    - "Pattern Strategy DI (D-68): tutte le 6+1 Strategy iniettate al gateway.execute() via HttpGatewayStrategies bundle — il gateway è agnostico all'implementazione concreta"
    - "Pattern Structural protocol (in http-handler): HttpHandlerGateway/Mapper/Validator definiti come duck-typed interfaces invece di import diretto dalle classi concrete — evita cyclic dependency monorepo"
    - "Pattern Conditional spread per exactOptionalPropertyTypes: routeInfo, finalRequest.body, error.originalError tutti spread condizionali con `...(field !== undefined && { field })`"
    - "Pattern Cleanup garantito (T-03-08-06): inFlight.delete(eventId) in finally block — coverage anche su throw inattesi"
    - "Pattern Pitfall 7 redirect re-validation: redirect:'manual' in fetch + check status 3xx + new URL(location, base) per resolve relative + validateAgainstAllowlist su Location header"
key-files:
  created:
    - "packages/gateway/src/http/http-gateway.ts (373 LOC)"
    - "packages/gateway/src/http/http-gateway.test.ts (10 test)"
    - "packages/gateway/src/http/public-factory.ts (86 LOC)"
    - "packages/gateway/src/http/public-factory.test.ts (3 test)"
    - "packages/gateway/src/http/policy-chain.ts"
    - "packages/gateway/src/http/policy-chain.test.ts (4 test)"
    - "packages/gateway/src/http/url-allowlist.ts"
    - "packages/gateway/src/http/url-allowlist.test.ts (4 test)"
    - "packages/gateway/src/http/retry-after-parser.ts"
    - "packages/gateway/src/http/retry-after-parser.test.ts (4 test)"
    - "packages/gateway/src/http/combine-signals.ts"
    - "packages/gateway/src/http/combine-signals.test.ts (3 test)"
    - "packages/routing/src/route-handlers/http-handler.ts (300 LOC)"
    - "packages/routing/src/route-handlers/http-handler.test.ts (7 test)"
  modified:
    - "packages/gateway/src/http/index.ts (aggiunge runtime export HttpGateway/createHttpGateway/utility)"
    - "packages/routing/src/route-handlers/index.ts (aggiunge createHttpHandler + 9 type aliases)"
key-decisions:
  - "**Structural-typed deps in http-handler** invece di import diretto da @sembridge/gateway/http: definite HttpHandlerGateway, HttpHandlerMapper, HttpHandlerValidator, HttpHandlerStrategies, HttpHandlerRequestSpec, HttpHandlerResponseSpec come duck-typed interfaces nel file http-handler.ts. Motivazione: @sembridge/gateway dipende da @sembridge/routing per RouteDefinition (vedi gateway-config.ts), e aggiungere @sembridge/gateway come dep runtime di @sembridge/routing creerebbe cyclic dependency in pnpm workspace (warning emesso in primo install, dependency graph mal definito). Il RouterBroker plan 03-12 cabla istanze concrete (HttpGateway → HttpHandlerGateway compatible structural)."
  - "**HttpGateway.execute NON throw su 4xx/5xx**: ritorna HttpResponseSpec.ok=false con httpStatus preservato. Il caller (http-handler) decide come trasformarli in RouteOutcome.error. Throw riservato a errori unrecoverable: gateway.url.forbidden (allowlist), gateway.timeout/aborted/network (signal abort + fetch error), circuit.open. Pattern coerente con NodeFetch + ben con il retry loop interno (lastResponse usato dopo retry exhausted)."
  - "**redirect:'manual' + post-redirect re-validation** invece di redirect:'follow' nativo (T-03-08-01 mitigation Pitfall 7): fetch nativo con `redirect:'follow'` rifa fetch al Location header SENZA opportunità per il gateway di applicare allowlist al nuovo URL. Con `redirect:'manual'`, la response è pass-through con status 302/Location header, e il gateway può rivalidare prima del refetch. Refetch manuale con stessi headers preserva Idempotency-Key e Authorization."
  - "**inFlight Map cleanup garantito via finally** (T-03-08-06): pattern try/finally nel execute() garantisce delete(eventId) anche su throw inatteso o early return. Verifica via test 8 (`abortInFlight`): post-promise settle, `inFlightCount() === 0`."
  - "**Idempotency-Key auto-generata SOLO al first attempt + persistente sui retry** (D-70 — chiusura PITFALLS #3): la nanoid generata al primo attempt viene STESSA usata sui retry — chiave: BrokerEvent.id originario. Implementato delegando a strategies.idempotency.generate(event.id) prima del retry loop (chiamata UNA volta in fase auth header injection). Il refetch interno (post-redirect) usa lo stesso `init` object con headers già popolato — preserva Idempotency-Key + Authorization."
  - "**combineSignals polyfill ES2022 per AbortSignal.any** (Pitfall 4 fix): TS target ES2022 non include `AbortSignal.any()` (ES2024). Il polyfill detect runtime tramite `(AbortSignal as any).any` e fallback a AbortController che ascolta tutti i signal. Browser moderni evergreen forniscono nativo, polyfill solo per Node test runtime."
  - "**HttpGatewayRouteInfo plain {id, ownerId?}** invece di import CompiledRoute da @sembridge/routing: gateway agnostico al routing engine (T-03-08-02 mitigation). Coerente con la separazione di concern — il RouteExecutor passa al gateway solo i field necessari."
  - "**msw 2.13.6 setupServer Node mode** invece di vi.fn() per fetch mock: maggiore fedeltà a network behavior (real Response object con headers, status, redirect, body parsing). Già usato in 03-04 augment test, no nuovo deps. Test 7 (timeout via abort) e test 9 (cascade abort) richiedono server reale per simulare slow response."
  - "**Validation della GatewayConfig at the public boundary** (createHttpGateway factory): Valibot looseObject preserva future fields (forward-compat) ma valida shape strutturale di auth.getToken (function), allowlist (array string|RegExp), circuitBreaker (false|object). Pattern coerente con createMapperBroker F2."
metrics:
  duration: "~70min (TDD RED+GREEN per 3 task — utility 4 file + HttpGateway+factory + http-handler)"
  completed: "2026-04-30"
  test-count: 35
  test-pass-rate: "35/35 (100%)"
  tests-by-task: "Task 1 utility 15/15 (3 combine-signals + 4 retry-after + 4 url-allowlist + 4 policy-chain); Task 2 HttpGateway 13/13 (10 gateway + 3 factory); Task 3 http-handler 7/7"
  total-routing-tests: "58/58 (51 baseline + 7 nuovi)"
  total-gateway-tests: "33/33 (5 baseline 03-04 augment + 15 utility + 13 HttpGateway+factory)"
  loc-runtime: "759 (373 http-gateway + 86 public-factory + 100 url-allowlist/retry-after/combine-signals/policy-chain stimati + 300 http-handler)"
  files-created: 14
  files-modified: 2
---

# Phase 03 Plan 08: HttpGateway core + policy chain + http-handler integrazione mapper+gateway+VAL-05

`HttpGateway` class compone le 6+1 Strategy primitives come dependency injection nella `execute()` (D-68 Strategy Pattern + Pattern 3 Koa-compose policy chain), applica URL allowlist pre-fetch (SEC-05/D-71) + post-redirect Location re-validation (Pitfall 7), inietta Authorization Bearer header (D-72) + Idempotency-Key persistente sui retry (D-70/SEC-03), coordina N AbortSignal via `combineSignals` polyfill ES2022 (D-77/Pitfall 4); `createHttpHandler` factory in `@sembridge/routing` integra `mapper.mapToShape` (D-96 request build) + `httpGateway.execute` + `mapper.mapToCanonical` (D-97 response parse) + `validator.validate` (VAL-05/D-78 response validation) e wrappa in `RouteOutcome` discriminato (D-80 shape) — il route handler "ponte" tra `RouteExecutor` e `HttpGateway`.

## Tasks Completed

| Task | Name                                                                                              | Commit    | Files                                                                                                   |
| ---- | ------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------- |
| 1    | utility — combine-signals + retry-after-parser + url-allowlist + policy-chain (RED)                | `1f265fc` | 4 test files (15 test totali)                                                                           |
| 1    | utility — GREEN gateway primitives                                                                 | `61014e8` | 4 source files (combine-signals.ts, retry-after-parser.ts, url-allowlist.ts, policy-chain.ts)           |
| 2    | HttpGateway class + createHttpGateway factory (RED)                                                | `1dc5a86` | http-gateway.test.ts (10 test) + public-factory.test.ts (3 test)                                        |
| 2    | GREEN HttpGateway core + createHttpGateway factory                                                 | `99a1d73` | http-gateway.ts (373 LOC) + public-factory.ts (86 LOC) + index.ts (runtime exports)                     |
| 3    | route-handlers/http-handler.ts integrazione mapper+gateway+valibot validation (RED)                | `bf1477d` | http-handler.test.ts (7 test mockati con vi.fn() per gateway/mapper/validator)                          |
| 3    | GREEN createHttpHandler in @sembridge/routing                                                      | `32c3eb8` | http-handler.ts (300 LOC) + route-handlers/index.ts (barrel update con 9 type aliases)                  |

## Test Results

```
Test Files  7 passed (7) — @sembridge/gateway
     Tests  33 passed (33)

Test Files  7 passed (7) — @sembridge/routing
     Tests  58 passed (58)
```

**Suite delta vs baseline:**
- @sembridge/gateway: 33/33 (5 baseline 03-04 augment + 15 utility nuovi + 13 HttpGateway+factory nuovi)
- @sembridge/routing: 58/58 (51 baseline + 7 http-handler nuovi)
- @sembridge/core: 248/248 (D-83 invariant — zero modifiche runtime)
- @sembridge/mapper: 183/183 (D-83 invariant — zero modifiche runtime)

**Behavior coverage per task:**

### Task 1 — utility (15 test)
1. **combine-signals (3)**: 3 signal coordinati abort-on-first; pre-aborted propagates immediately; undefined filtrate
2. **retry-after-parser (4)**: '120' → 120000; HTTP-date future → ms delta clamped MAX_BACKOFF_MS; HTTP-date past → 0; malformed → undefined
3. **url-allowlist (4)**: undefined allowlist → pass; URL match regex → pass; URL prefix match → pass; URL fuori → throw BrokerError 'gateway.url.forbidden'
4. **policy-chain (4)**: 3 middleware async chained; next() multiple call → throw; short-circuit no next → resto non eseguito; empty array

### Task 2 — HttpGateway + factory (13 test)
1. `createHttpGateway` con valid config → ritorna HttpGateway instance
2. `createHttpGateway` con invalid config → throw 'Invalid GatewayConfig'
3. execute con auth.getToken → fetch con header `Authorization: Bearer tok` (msw verify)
4. execute con URL fuori allowlist → throw `gateway.url.forbidden` PRIMA di fetch (no msw call)
5. execute 200 OK → ritorna `HttpResponseSpec.ok=true` con body parsato JSON
6. execute 500 → ritorna `HttpResponseSpec.ok=false` con httpStatus=500 (no automatic throw)
7. execute con `signal.abort('gateway.timeout')` durante fetch → throw `BrokerError 'gateway.timeout'`
8. `abortInFlight(eventId)` abort `AbortController` correlato (verify signal.aborted=true)
9. `abortInFlightByOwner(ownerId)` cascade abort (verify N controller aborted)
10. execute con redirect 302 verso URL fuori allowlist → throw `gateway.url.forbidden` (Pitfall 7)
11-13. Factory tests: valid config → instance; config con auth function → instance; config invalida → throw

### Task 3 — http-handler (7 test)
1. `createHttpHandler` ritorna async handler function
2. handler costruisce HttpRequestSpec via mapper.mapToShape (queryMap → URL search params)
3. success path 200 → RouteOutcome.ok con `metadata: {httpStatus:200, attemptCount:1, origin:'remote'}`
4. 500 response → RouteOutcome.error code='gateway.5xx' category='network' con httpStatus=500
5. gateway throw 'gateway.url.forbidden' → preserve code+category nel RouteOutcome.error
6. response validation fail → code='response.validation.failed' category='validation' con dettagli {schemaId, issues} (VAL-05)
7. gateway throw 'gateway.aborted' → preserve code

## REQ-IDs Coverage

- **ROUTE-03** (Tipo route `http` con request/response/publishes): http-handler costruisce HttpRequestSpec da queryMap/bodyMap canonico→server e ritorna RouteOutcome con canonicalPayload mapped server→canonical (Test 2, 3 task 3)
- **ROUTE-06** (Server Gateway centralizza fetch): HttpGateway.execute è l'entry singolo per route HTTP — nessun fetch diretto. Plan 03-12 RouterBroker forza l'uso wiring l'httpHandler nel RouteExecutor (Test 3, 5 task 2)
- **ROUTE-13** (Cancellazione AbortSignal): execute combina externalSignal + ownController.signal + timeoutSignal via combineSignals; abortInFlight(eventId) per cancel puntuale; abortInFlightByOwner(ownerId) per cascade plugin unregister LIFE-02 ext F3 (Test 7, 8, 9 task 2)
- **SEC-04** (Status HTTP uniformi): http-handler mappa response.status → BrokerError code='gateway.4xx' (status<500) o 'gateway.5xx' (status≥500) con shape D-80 uniforme indipendentemente dal status code specifico (Test 4 task 3)
- **SEC-05** (URL allowlist): validateAgainstAllowlist invocato pre-fetch + post-redirect re-validation Pitfall 7. Throw `gateway.url.forbidden` BEFORE network call (Test 4, 10 task 2)
- **VAL-05** (Validazione risposta server): http-handler invoca validator.validate(canonicalSchemaId, mappedResponse) opt-in; fail → BrokerError code='response.validation.failed' category='validation' con dettagli {schemaId, issues} (Test 6 task 3)

## Decisions Closed

### D-68 — Strategy Pattern (6+1 Strategy interfaces)
**Status: PARTIALLY CLOSED**. HttpGateway accetta HttpGatewayStrategies bundle con 7 field opzionali (retry/timeout/dedupe/backpressure/auth/idempotency/circuitBreaker). Default implementation arriva ai plan 03-09/10/11 (Wave 4-A/B/C). Il gateway funziona anche senza strategy (plain fetch + 30s timeout default).

### D-69 — Retry strategy (chiusura PRD §39 #8 + ROUTE-09)
**Status: TYPE-LEVEL READY**. Il retry loop nel gateway delega a `strategies.retry.shouldRetry(response, error, attempt)` + `delayMs(attempt, retryAfter?)`. La default `ExponentialBackoffWithJitter` arriva al plan 03-09. retry-after-parser cap MAX_BACKOFF_MS=60000ms già implementato.

### D-70 — Idempotency token persistente sui retry (chiusura PITFALLS #3)
**Status: CLOSED**. La generazione avviene UNA volta tramite `strategies.idempotency.generate(event.id)` prima del retry loop; il finalRequest.headers contiene la chiave nel `init` riusato per ogni attempt. Verifica grep: `headers[strategies.idempotency.headerName()] = strategies.idempotency.generate(event.id)` — chiamata fuori dal `while (attempt < maxAttempts)` loop.

### D-71 — URL allowlist + redirect re-validation (chiusura T-03-08-01/T-03-08-02)
**Status: CLOSED**. Pre-fetch validateAgainstAllowlist(request.url, ...) all'inizio di execute(). Post-redirect re-validation in fetchOnce() con `redirect:'manual'` + check status 3xx + `new URL(location, req.url).href` per resolve relative + validateAgainstAllowlist sul Location header. Test 4 e 10 verificano entrambi i path.

### D-72 — Authorization Bearer + single-flight refresh
**Status: CLOSED (gateway side)**. Il gateway invoca `strategies.auth.getToken()` UNA volta per request, inietta `Authorization: Bearer ${token}` nel finalRequest.headers. La default AuthStrategy con single-flight refresh arriva al plan 03-11. Test 3 verifica iniezione header via msw capture.

### D-77 — AbortSignal coordinato (chiusura PITFALLS #2.B)
**Status: CLOSED**. combineSignals(externalSignal, ownController.signal, timeoutSignal) propaga abort-on-first ai 3 signal. Il fetch riceve il signal coordinato. classifyError discrimina timeout vs aborted vs network basandosi sullo stato di `timeoutSignal.aborted` / `externalSignal.aborted` / `ownSignal.aborted` + reason string. Test 7 verifica timeout classification.

### D-78 — Response validation opt-in (VAL-05)
**Status: CLOSED**. http-handler invoca validator.validate(canonicalSchemaId, mappedResponse) SOLO se `deps.validator !== undefined`. Validation fail → BrokerError code='response.validation.failed' category='validation' con details {schemaId, issues}. Coerente con pattern F2 valibotAdapter.validate ritorna `{ ok: true } | { ok: false, issues: [...] }`. Test 6 task 3 verifica.

### D-80 — RouteOutcome shape standard
**Status: CLOSED su tutti i path**: success branch (Test 3 metadata httpStatus/attemptCount/origin); error branch 4xx/5xx (Test 4); error branch da gateway throw url.forbidden (Test 5); error branch validation fail (Test 6); error branch gateway aborted (Test 7).

### D-96 — request build via mapper.mapToShape
**Status: CLOSED**. http-handler invoca `deps.mapper.mapToShape(event.payload, def.request.queryMap)` per build query params + `deps.mapper.mapToShape(event.payload, def.request.bodyMap)` per body. Verifica grep: `mapToShape` matcha 2 volte nel http-handler.ts.

### D-97 — response parse via mapper.mapToCanonical
**Status: CLOSED**. http-handler invoca `deps.mapper.mapToCanonical(response.body, def.response.canonical)` post-fetch success. Verifica grep: `mapToCanonical` matcha 1 volta nel http-handler.ts.

### D-99 — Circuit breaker per-route opt-in
**Status: TYPE-LEVEL READY**. HttpGateway invoca `strategies.circuitBreaker.canExecute(route.id)` pre-fetch (throw 'circuit.open' se false) + `recordSuccess(route.id)` su 2xx + `recordFailure(route.id)` post-retry-exhausted. Default DISABLED implementation al plan 03-11.

## Pitfall Coverage

### Pitfall 4 — AbortSignal.any non disponibile su ES2022 target
**Status: CLOSED via combineSignals polyfill**. `combine-signals.ts` detect runtime `(AbortSignal as any).any` e fallback a AbortController che ascolta tutti i signal con `addEventListener('abort', ..., { once: true })`. Test 1 verifica 3 signal coordinated abort-on-first.

### Pitfall 7 — Redirect 3xx bypass allowlist
**Status: CLOSED via redirect:'manual' + Location re-validation**. fetchOnce() in http-gateway.ts:298-318 verifica response.status 3xx, parse Location header, resolve relative via `new URL(location, baseUrl)`, e re-invoca validateAgainstAllowlist sul URL resolved. Test 10 task 2 verifica esplicitamente: redirect da api.example.com/v1/redirect → evil.com/exfil → throw 'gateway.url.forbidden'.

## Threat Model Coverage

| Threat ID | Disposition | Mitigation Implementata |
|-----------|-------------|--------------------------|
| T-03-08-01 (Information Disclosure — redirect leak Authorization) | mitigate | `redirect:'manual'` + `validateAgainstAllowlist(Location)` Test 10 task 2 |
| T-03-08-02 (Tampering — URL injection bypass allowlist) | mitigate | URL parsed via `new URL(location, base)` per resolve relative; allowlist regex/prefix match |
| T-03-08-03 (DoS — retry storm thundering herd) | mitigate | full jitter delegata a RetryStrategy plan 03-09; gateway rispetta `Retry-After` cap MAX_BACKOFF_MS=60000ms |
| T-03-08-04 (Spoofing — Idempotency-Key replay) | mitigate | nanoid 21-char entropy 126-bit (delegato a IdempotencyStrategy plan 03-09) — A2 RESEARCH |
| T-03-08-05 (Information Disclosure — error stack trace) | accept | originalError preservato in BrokerError; OutcomeCollector plan 03-07 sanitizza prima del publish |
| T-03-08-06 (DoS — inFlight Map cresce illimitato) | mitigate | `finally { this.inFlight.delete(eventId) }` Test 8 task 2 verifica `inFlightCount() === 0` post-promise settle |

## Vincoli D-83 Confermati

`git diff --name-only HEAD~6 HEAD packages/core/ packages/mapper/` → empty.
**ZERO modifiche** a `packages/core/` e `packages/mapper/` runtime per tutto plan 03-08.
- Core 248/248 test passing (invariant)
- Mapper 183/183 test passing (invariant)
- Pattern composition wrapper rispettato: HttpGateway in @sembridge/gateway/http è invocato dal http-handler in @sembridge/routing — entrambi extension package senza accesso diretto a inner di core/mapper

## Verification

- [x] 35/35 test passing (15 utility + 13 HttpGateway+factory + 7 http-handler)
- [x] 58/58 routing test totale (51 baseline + 7 nuovi, zero regressioni)
- [x] 33/33 gateway test totale (5 baseline 03-04 + 28 nuovi)
- [x] 248/248 core test (D-83 invariant)
- [x] 183/183 mapper test (D-83 invariant)
- [x] `tsc --noEmit` exit 0 entrambi i package (gateway + routing)
- [x] 0 changes a `packages/core/` e `packages/mapper/` runtime (`git diff HEAD~6 -- packages/core/ packages/mapper/` empty)
- [x] msw 2.13.6 setupServer Node mode funzionante (test gateway 3, 4, 5, 6, 7, 8, 9, 10 lo usano)
- [x] `class HttpGateway` presente in http-gateway.ts (grep ok)
- [x] `redirect: 'manual'` presente in http-gateway.ts (Pitfall 7 confermato)
- [x] `abortInFlightByOwner` presente in http-gateway.ts (LIFE-02 ext F3 confermato)
- [x] `createHttpGateway` presente in public-factory.ts
- [x] `wc -l packages/gateway/src/http/http-gateway.ts` = 373 ≥ 130 minimum richiesto
- [x] `wc -l packages/routing/src/route-handlers/http-handler.ts` = 300 ≥ 100 minimum richiesto
- [x] `createHttpHandler` presente in http-handler.ts
- [x] `mapToShape` presente in http-handler.ts (D-96 confermato)
- [x] `mapToCanonical` presente in http-handler.ts (D-97 confermato)
- [x] `response.validation.failed` presente in http-handler.ts (VAL-05 confermato)
- [x] `MAX_BACKOFF_MS = 60_000` presente in retry-after-parser.ts
- [x] `gateway.url.forbidden` presente in url-allowlist.ts
- [x] `function compose` presente in policy-chain.ts
- [x] `combineSignals` presente in combine-signals.ts

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Cyclic dependency tra @sembridge/routing e @sembridge/gateway**
- **Found during:** Task 3 (initial implementation con `import type { HttpGateway } from '@sembridge/gateway/http'`)
- **Issue:** Il piano originale prescriveva `import type { HttpGateway, HttpGatewayStrategies } from '@sembridge/gateway/http'` nel http-handler. Aggiungere @sembridge/gateway come dependency di @sembridge/routing crea ciclo (gateway già dipende da routing per `RouteDefinition` import nei type files). pnpm emette warning `cyclic workspace dependencies`.
- **Fix:** Definite interfaces strutturali (HttpHandlerGateway, HttpHandlerMapper, HttpHandlerValidator, HttpHandlerStrategies, HttpHandlerRequestSpec, HttpHandlerResponseSpec) duck-typed nel file http-handler.ts. Pattern coerente con la deps interface già usata per `mapper` (structural protocol). Il RouterBroker plan 03-12 fornisce le istanze concrete (HttpGateway → HttpHandlerGateway compatible).
- **Files modified:** packages/routing/src/route-handlers/http-handler.ts (interfaces strutturali invece di import dal package gateway), packages/routing/package.json (NESSUNA modifica — dep gateway NON aggiunta)
- **Commit:** 32c3eb8 (incluso nel commit GREEN)

## Self-Check: PASSED

**Files created:**
- [x] FOUND: packages/gateway/src/http/http-gateway.ts (373 LOC)
- [x] FOUND: packages/gateway/src/http/http-gateway.test.ts
- [x] FOUND: packages/gateway/src/http/public-factory.ts (86 LOC)
- [x] FOUND: packages/gateway/src/http/public-factory.test.ts
- [x] FOUND: packages/gateway/src/http/policy-chain.ts
- [x] FOUND: packages/gateway/src/http/policy-chain.test.ts
- [x] FOUND: packages/gateway/src/http/url-allowlist.ts
- [x] FOUND: packages/gateway/src/http/url-allowlist.test.ts
- [x] FOUND: packages/gateway/src/http/retry-after-parser.ts
- [x] FOUND: packages/gateway/src/http/retry-after-parser.test.ts
- [x] FOUND: packages/gateway/src/http/combine-signals.ts
- [x] FOUND: packages/gateway/src/http/combine-signals.test.ts
- [x] FOUND: packages/routing/src/route-handlers/http-handler.ts (300 LOC)
- [x] FOUND: packages/routing/src/route-handlers/http-handler.test.ts

**Commits:**
- [x] FOUND: 1f265fc (test RED utility)
- [x] FOUND: 61014e8 (feat GREEN utility)
- [x] FOUND: 1dc5a86 (test RED HttpGateway)
- [x] FOUND: 99a1d73 (feat GREEN HttpGateway)
- [x] FOUND: bf1477d (test RED http-handler)
- [x] FOUND: 32c3eb8 (feat GREEN http-handler)

## TDD Gate Compliance

- [x] **RED gate Task 1**: commit `test(03-08): aggiunge test RED per gateway primitives` (1f265fc) precede l'implementazione
- [x] **GREEN gate Task 1**: commit `feat(03-08): implementa gateway primitives` (61014e8) successivo
- [x] **RED gate Task 2**: commit `test(03-08): aggiunge test RED per HttpGateway class + createHttpGateway factory` (1dc5a86)
- [x] **GREEN gate Task 2**: commit `feat(03-08): GREEN HttpGateway core + createHttpGateway factory` (99a1d73)
- [x] **RED gate Task 3**: commit `test(03-08): RED test per http-handler in @sembridge/routing` (bf1477d) verificato fail (test fallisce perché http-handler.ts non esiste)
- [x] **GREEN gate Task 3**: commit `feat(03-08): GREEN createHttpHandler in @sembridge/routing` (32c3eb8) test che prima fallivano ora passano
- [x] No REFACTOR commit necessario per nessun task — implementazioni pulite al primo passaggio
