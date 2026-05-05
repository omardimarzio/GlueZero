# Phase 3: Routing & Server Gateway HTTP - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning
**Mode:** `--auto` (decisioni prese con i default raccomandati senza interazione utente; tutte le scelte derivano dal PRD, ROADMAP, REQUIREMENTS, CLAUDE.md, dalle decisioni Phase 1 e Phase 2, e dalla research `.planning/research/`)

<domain>
## Phase Boundary

Phase 3 consegna il **Routing Engine dichiarativo** + il **Server Gateway HTTP centralizzato** del progetto GlueZero:

1. **`@gluezero/routing`** — engine dichiarativo con `RouteDefinition` discriminata via `type`:
   - `'local'` — consegna ai subscriber locali (default per topic senza route)
   - `'http'` — converte topic `<entity>.<action>.requested` in fetch HTTP, pubblica `<entity>.<action>.loaded` o `<entity>.<action>.failed`
   - `'cache'` — DEFINIZIONE TYPE in F3, cache-first/network-first/cache-then-network — adapter implementativo a F6 (ROUTE-04 nota REQUIREMENTS.md: "Definizione type — implementazione cache adapter in F6")
   - `'composite'` — workflow check-cache → server → update-cache → publish (F3 implementa la struttura, l'adapter cache effettivo arriva con F6)
2. **`@gluezero/gateway/http`** — Server Gateway HTTP centralizzato che applica policy uniformi a tutte le richieste fetch:
   - timeout, retry differenziato 4xx/5xx (con full jitter), dedupe via `dedupeKey`, backpressure, auth (Bearer hook + token refresh hook), cancellazione (AbortController), URL allowlist, idempotency token auto per metodi non-idempotenti
3. **Resolver + Executor** — pipeline §28 step 7 (full dedupe/backpressure), 8 (resolve route), 9 (execute route), 10 (collect outcome). Ogni route HTTP usa il `MapperEngine` di F2 per `queryMap`/`bodyMap` (canonico→server) e per response server→canonico via `inputMap`.
4. **Plugin descriptor extension** — `RouteDefinition[]` registrabili dichiarativamente nel descriptor o imperativamente via `broker.registerRoute(routeDef)`. Cascade su `unregisterPlugin` (LIFE-02 ext F3).

**Pacchetto monorepo:** `@gluezero/routing` (engine, resolver, executor, route-handlers locali) + `@gluezero/gateway/http` (sub-modulo `http` che incapsula fetch + retry/timeout/dedupe/auth/idempotency/circuit-breaker). Entrambi placeholder già scaffold-ati in plan 01-01.

**Pipeline §28 estesa in F3:** step 7 full (`event.dedupe.checked` con backpressure policy attiva — F1 base lo prevede, F3 lo riempie), step 8 NUOVO (`event.route.resolved`), step 9 NUOVO (`event.route.executed`), step 10 NUOVO (`event.outcome.collected`). I 5 step F1 e i 5 step F2 restano invariati. Step 11/12 (mapping consumer + final validation) di F2 vengono invocati DOPO step 10 per pubblicare l'outcome ai subscriber locali.

**Default V1 — canonical-first invariato (PRD §13.5):** ogni route HTTP usa il `MapperEngine` di F2 per:
- richiesta: canonico → server (via `request.queryMap` e `request.bodyMap` definiti sulla route)
- risposta: server → canonico (via mapping inverso server-shape→canonical schema, applicato come "input mapping" della route HTTP — pattern simmetrico al `inputMap` plugin di F2)

Il payload pubblicato come `<topic>.loaded` è SEMPRE canonico; F2 step 11 lo trasforma poi al consumer locale per ogni subscriber matched.

**Requirements (29 REQ-IDs assegnati):**
- ROUTE-01..ROUTE-16 (16) — engine completo
- VAL-05 — validazione response server (Valibot adapter da F2)
- ERR-02 ext — `<topic>.failed` + `network.error`
- SEC-01..SEC-05 (5) — auth header centralizzati, token refresh hook, idempotency, status uniformi, URL allowlist
- TEST-01 (subset route HTTP, dedupe, retry/timeout)
- TEST-02 (plugin → broker → server → broker → plugin con `msw`)
- TEST-03 (server con schema inatteso, retry storm)
- DOC-04

**Open issues PRD §39 chiuse in F3:**
- #5 (ROUTE-16) — topic senza route: default consegna locale ai subscriber (`'local'` implicit); opt-in `requiresRoute: true` nel topic schema (F2 ext) per forzare `BrokerError` `route.required.missing`
- #6 (ROUTE-15) — più route applicabili: tre policy `'first-match'` (default + warning dev), `'priority-ordered'` (esplicita `priority` numero), `'all'` (broadcast a tutte — utile per fan-out)
- #7 (LIFE-02 ext F3) — unregister plugin rimuove anche le route registrate dal plugin in cascata (D-26 cascade esteso)
- #8 (ROUTE-09) — retry 4xx vs 5xx: NO retry su 4xx eccetto 408/429; retry SI su 5xx + 408 + 429 + network-error con backoff esponenziale + full jitter, rispetto a `Retry-After`

**Scope-out (deferred a fasi successive):**
- Realtime inbound SSE/WS (F4 — separato in `@gluezero/gateway/sse-ws`)
- Cache adapter implementativo in-memory + IndexedDB (F6 — F3 definisce solo i tipi e il route handler `'cache'`/`'composite'`)
- Worker route handler (F5 — `RouteDefinition` con `type: 'worker'` aggiunto in F5 via declaration merging)
- Route Inspector full snapshot (F6 — F3 instrumenta solo i tap step 8/9/10 con metadata mínima, payload before/after a F6)
- Metrics format (F6 — TOOL-05 chiude open issue PRD §39 #10)
- Adapter validation Zod/Ajv per response (V2 — V1 solo Valibot, riusa `ValidatorAdapter` di F2)
- Circuit breaker avanzato cross-route con stats sliding window (V1.x — F3 implementa solo per-route fail counter base con threshold + cooldown)

</domain>

<decisions>
## Implementation Decisions

### A. API Surface Routing

- **D-60:** Il Broker espone come metodi pubblici: `registerRoute(routeDefinition)` e `unregisterRoute(routeId)` — coerente con il pattern `registerPlugin/registerCanonicalSchema/registerTransform/registerAlias` di F1+F2. Tutti i metodi accessibili tramite l'istanza `Broker` ritornata da `createBroker(config)`.
- **D-61:** I plugin dichiarano `routes?: RouteDefinition[]` come campo opzionale del `PluginDescriptor` (estensione tipo via TS declaration merging — F1 plan 03 ha lasciato `unknown` placeholder, F3 risolve via re-declaration nel package `@gluezero/routing`). Le route dichiarate sono auto-registrate al `registerPlugin` con `ownerId = pluginId` (per cascade D-26 ext F3).
- **D-62:** `RoutingConfig` opzionale in `BrokerConfig` (sezione `routes?: RouteDefinition[]`, `gateway?: GatewayConfig` — già placeholder `unknown` da plan 03); F3 sostituisce con tipi specifici via declaration merging in `@gluezero/routing/src/augment.ts` e `@gluezero/gateway/src/augment.ts`. Pattern non-breaking, identico a F2 D-56.
- **D-63:** **`createSembridge(config)` aggregato pubblico — DEFERRED**. F3 NON crea ancora il factory aggregato `@gluezero/gluezero`. Si continua a usare `createMapperBroker(config)` di F2 estendendolo con un nuovo wrapper `createRouterBroker(config)` (composition wrapper che compone Mapper + Routing + Gateway). Il factory aggregato unificato viene introdotto in F6 quando la libreria è feature-complete (riduce churn API pubblica).

### B. Strategia routing engine (resolver + executor)

- **D-64:** **Route resolution pre-compilata al `registerRoute`** — il resolver costruisce un dispatch table `Map<topicPattern, CompiledRoute[]>` per O(1) lookup a runtime. Pattern matching usa lo stesso trie segmentato di F1 (D-08) per supportare wildcard (`weather.*.requested` matcha `weather.alert.requested`). Riuso del `Subscription.matcher` di F1 quando possibile.
   - **Rationale:** STACK.md §"mapping pre-compilata"; coerenza con F1 wildcard trie; PITFALLS #16 (no recompilation hot-path).
- **D-65:** **Executor ASYNC per route HTTP/cache/composite, SYNC per route local** — la consegna locale (route `local`) usa la pipeline F1 invariata (`bus.deliver` async via `queueMicrotask`). Le route HTTP/cache/composite sono async per natura (fetch/IndexedDB) e ritornano `Promise<RouteOutcome>`. L'evento originale viene consegnato ai subscriber locali in parallelo all'esecuzione route remota (default `concurrency: 'parallel'` per route → local + remote, opt-out via route policy).
- **D-66:** **`first-match` come default per route resolution (ROUTE-15)** — quando più route matchano lo stesso topic, viene usata la prima registrata. In dev mode (`debug: true`) viene emesso `routing.ambiguous` come BrokerEvent CORE (analogo a `mapping.warn` di F2 D-41) con `payload: { topic, candidateRouteIds, selectedRouteId }`. Policy override via `RouteDefinition.priority?: number` (più alto = priorità maggiore) → resolver applica `'priority-ordered'`. Policy `'all'` (broadcast) opt-in via `RoutingConfig.multipleRoutesPolicy: 'all'`.
- **D-67:** **`requiresRoute` opt-in per topic schema (ROUTE-16)** — chiusura PRD §39 #5. Default: topic senza route → consegna locale ai subscriber (`'local'` implicit, no error). Opt-in: il topic schema (F2 canonical) può dichiarare `requiresRoute: true` → resolver throw `BrokerError` `route.required.missing` → publish `<topic>.failed`. Il flag vive sul `CanonicalSchema` di F2 (estensione non-breaking via declaration merging).

### C. HTTP Gateway — policy uniformi

- **D-68:** **Strategy Pattern per ogni policy** — coerente con ARCHITECTURE.md §2.5 (Pattern). Ogni policy è un'interfaccia + implementazione default + slot per custom:
  - `RetryStrategy` (default `ExponentialBackoffWithJitter`)
  - `TimeoutStrategy` (default `FixedTimeout` 30000ms)
  - `DedupeStrategy` (default `KeyBased` su `dedupeKey`, fallback `'route-id+queryParams'`)
  - `BackpressureStrategy` (default `LatestOnly` per route con `concurrency: 'latest-only'`)
  - `AuthStrategy` (default `BearerHook` con `getToken: () => Promise<string>` configurato in `gateway.auth`)
  - `ErrorStrategy` (default differenziazione 4xx/5xx descritta in D-69)
- **D-69:** **Retry policy default (chiusura PRD §39 #8 / ROUTE-09):**
  - **Network errors** (no response, fetch throw, AbortError NON da AbortController user-level) → **RETRY**
  - **5xx** (500-599) → **RETRY** rispettando `Retry-After` se presente
  - **408 Request Timeout** → **RETRY**
  - **429 Too Many Requests** → **RETRY** rispettando `Retry-After`
  - **Altre 4xx** (400, 401, 403, 404, 422, ...) → **NO RETRY**, errore client che retry non risolve
  - `maxAttempts: 3` default; `maxAttempts: 0` disabilita retry; `maxAttempts: Infinity` consentito ma con warning in dev
  - Backoff: `min(maxDelay=10000, baseDelay=300 * 2^attempt) * (0.5 + Math.random() * 0.5)` (full jitter formula esatta da PITFALLS #5)
- **D-70:** **Idempotency token (SEC-03)** — per metodi `POST`/`PATCH`/`PUT`/`DELETE`, default `idempotency: { mode: 'auto', headerName: 'Idempotency-Key' }` — auto-genera `nanoid()` al first attempt; lo stesso valore viene riusato sui retry (chiave: stesso `BrokerEvent.id` di scatenamento). Il server è responsabile di deduplicare per la chiave (precondizione documentata in DOC-04).
   - Opt-out: `idempotency: false` esplicito su route per metodi safe-by-design.
- **D-71:** **URL allowlist obbligatoria (SEC-05)** — `gateway.allowlist: string[]` (regex o glob pattern) di endpoint base consentiti. Tentativo di fetch verso URL non in allowlist → throw `BrokerError` `gateway.url.forbidden` PRIMA della fetch. Default `allowlist: undefined` → tutti gli URL consentiti (dev convenience), ma `createBroker` emette warning `'gateway.allowlist.missing'` in dev mode.
- **D-72:** **Auth Bearer + token refresh (SEC-01, SEC-02, ROUTE-07)** — `gateway.auth.getToken: () => Promise<string | undefined>` chiamato prima di ogni fetch (con caching opzionale). Su 401 response, opzionalmente `gateway.auth.refresh: () => Promise<string>` viene chiamato UNA volta (no loop) e la fetch viene retentata con il nuovo token. Se il refresh fallisce o ritorna lo stesso token → publish `auth.expired` come BrokerEvent CORE + propaga 401 al caller.

### D. Concurrency, dedupe, backpressure (chiusura ROUTE-08, ROUTE-10, ROUTE-11)

- **D-73:** **Concurrency policy per route** — `RouteDefinition.concurrency?: 'latest-only' | 'serial' | 'parallel'`:
  - `'latest-only'` (DEFAULT per topic UI-driven `*.requested` con method GET) — nuova request abort `AbortController` della precedente; solo l'ultima `<topic>.loaded` viene pubblicata (chiusura PITFALLS #2.A).
  - `'serial'` — request accodate, eseguite una alla volta (FIFO).
  - `'parallel'` (DEFAULT per metodi non-GET o senza `*.requested`) — tutte parallele, nessun coordinamento.
  - Detection automatica: se topic matcha pattern `*.requested` AND method `GET` → default `'latest-only'`; altrimenti `'parallel'`.
- **D-74:** **`dedupeKey` esplicito (ROUTE-11)** — la route può dichiarare `dedupeKey: (event) => string` (funzione pura). Due request con stesso `dedupeKey` in volo → collassano in una sola fetch (Promise condiviso); entrambi i caller ricevono la stessa response. Default fallback se `dedupeKey` non dichiarato e `method === 'GET'`: `routeId + sortedQueryParams`. Per non-GET, default `undefined` (no dedup automatico — rischio side-effect duplicati).
- **D-75:** **Backpressure priority-aware (ROUTE-10)** — `BackpressureStrategy` configurabile per route: `'queue-bounded'` (max N), `'drop'`, `'throttle'` (max M/sec), `'debounce'` (wait Wms quiet), `'latest-only'`, `'merge'`/`'coalesce'` (combina N eventi pending in 1). **Eventi `priority: 'critical'`** (es. `system.error` di F1) NON vengono mai droppati — bypassano qualsiasi backpressure policy (chiusura PITFALLS #4).

### E. Cancellazione e AbortSignal (ROUTE-13)

- **D-76:** **AbortController per ogni request HTTP in volo** — il gateway crea `AbortController` per ogni fetch e lo cita su:
   - `concurrency: 'latest-only'` → abort precedente
   - `unsubscribe`/`unregisterPlugin` → cascade abort di tutte le request bound al `pluginId` (estensione D-26 cascade)
   - timeout → abort + publish `<topic>.failed` con `code: 'gateway.timeout'`
   - utente esplicito → `broker.cancelInFlight(eventId)` API pubblica (verifica con planner se serve in F3 o se `unsubscribe`+pattern `subscribe(handler, {signal})` sono sufficienti)
- **D-77:** **AbortSignal su `subscribe`** — F1 plan 04/05 ha già esposto `subscribe(handler, options?: { signal?: AbortSignal })`. F3 propaga il `signal` del subscriber alla request HTTP correlata (per topic `*.requested`): se il subscriber abort, la fetch HTTP viene anche essa abort (PITFALLS #2.B chiusura).

### F. Validazione response server (VAL-05)

- **D-78:** **Validazione response opt-in via canonical schema F2** — la route HTTP dichiara `response: { canonical: 'weather' }` (riferimento al `CanonicalSchema` di F2). Dopo il mapping server→canonico (step 9 server-side mapping), la pipeline §28 step 6 (`event.canonical.validated` di F2) viene invocata sul payload canonico → fail → publish `<topic>.failed` con `code: 'response.validation.failed'`.
- **D-79:** **Server con schema inatteso (TEST-03 subset)** — se la response non matcha lo schema canonico (campo mancante, tipo errato), il comportamento dipende da `onFailure` del schema (F2 D-44): `'block'` (default) → publish `<topic>.failed`, `'skip'` → publish `<topic>.loaded` con campi opzionali undefined, `'fallback'` → applica defaults. Riusa la logica F2, NON duplica.

### G. Errori standard F3 (ERR-02 ext)

- **D-80:** **`<topic>.failed` automatico (ROUTE-12, PRD §22.3)** — chiunque pubblichi `<topic>.requested` su una route HTTP, riceve automaticamente `<topic>.loaded` (success) o `<topic>.failed` (errore) sullo stesso topic family. Il `BrokerError` su `<topic>.failed` ha shape:
  ```ts
  {
    code: string,        // 'gateway.timeout' | 'gateway.4xx' | 'gateway.5xx' | 'gateway.network' | 'response.validation.failed' | 'route.required.missing' | 'auth.expired' | ...
    message: string,
    category: 'network' | 'validation' | 'auth' | 'config',
    routeId: string,
    topic: string,
    eventId: string,     // BrokerEvent.id originario di .requested
    originalError?: Error,
    cause?: Error,       // ES2022 Error.cause chain
    httpStatus?: number,
    retryAttempt?: number,
    retryAfterMs?: number
  }
  ```
- **D-81:** **`network.error` come BrokerEvent CORE separato** — quando il gateway non riesce a contattare il server (DNS fail, offline, CORS blocked), oltre a `<topic>.failed` viene pubblicato `network.error` come evento CORE per consumer sistemici (telemetria, banner offline UI). Il `BrokerError` ha `category: 'network'`.
- **D-82:** **NO publish doppio** — quando la route HTTP fallisce, `<topic>.failed` viene pubblicato UNA volta sola (alla fine di tutti i retry + dopo il timeout cumulativo). Durante i retry intermedi, NIENTE viene pubblicato (no spam). I subscriber hanno visibilità sui retry SOLO via Inspector / EventTap.

### H. Estensione Pipeline §28 e bus.ts/MapperBroker

- **D-83:** **`bus.ts` di F1 e `mapper-engine.ts` di F2 NON modificati direttamente** — pattern composition wrapper identico a F2 D-49. F3 introduce un `RouterBroker` (composition di `MapperBroker` di F2) che si "aggancia" alla pipeline §28 step 7-full/8/9/10 via TS declaration merging del `PipelineStep` union + un wrapper sul `Broker`. Il `RouterBroker` compone `MapperBroker` come `EventBus`, in modo che gli step F3 vengano invocati nel posto giusto della sequenza pipeline.
- **D-84:** **Ordine pipeline §28 in F3 (full):**
  - step 1 `event.received` (F1)
  - step 2 `event.metadata.enriched` (F1)
  - step 3 `event.validated` (F1, sintassi BrokerEvent)
  - step 4 `event.source.resolved` (F2)
  - step 5 `event.mapped.canonical` (F2)
  - step 6 `event.canonical.validated` (F2)
  - step 7 `event.dedupe.checked` (F1 base + F3 backpressure full)
  - step 8 `event.route.resolved` (F3 NUOVO — risolve `RouteDefinition` per topic via dispatch table, applica policy `first-match`/`priority-ordered`/`all`)
  - step 9 `event.route.executed` (F3 NUOVO — esegue route: local → bus.deliver, http → fetch via gateway con retry/timeout/dedupe, cache → adapter F6 placeholder, composite → workflow)
  - step 10 `event.outcome.collected` (F3 NUOVO — raccoglie result/error → trasforma in `<topic>.loaded` o `<topic>.failed` BrokerEvent)
  - step 11 `event.mapped.consumer` (F2 — applica `inputMap` consumer per ogni subscriber matched)
  - step 12 `event.final.validated` (F2)
  - step 13 `event.delivered` (F1)
- **D-85:** **`PipelineStep` extension F3** — il package `@gluezero/routing/src/augment.ts` aggiunge i 3 nuovi step via TS declaration merging (pattern F2 D-49). `safeTapStep` di F1 viene riusato per i tap.

### I. Cascade cleanup (LIFE-02 ext F3, chiusura PRD §39 #7)

- **D-86:** **`unregisterPlugin` cascada anche le route registrate dal plugin** — D-26 cascade di F1 + F2 viene esteso in F3 a:
  - tutte le subscription registrate dal plugin (F1)
  - tutte le canonical schema/alias/transform registrate (F2)
  - **tutte le route registrate dal plugin (F3 NUOVO)** + cascade abort `AbortController` di tutte le request HTTP in volo bound al `pluginId`
  - MessageChannel worker (F5) e listener realtime (F4) — già pianificati
- **D-87:** **`unregisterRoute(routeId)` esplicito** — anche senza unregister del plugin owner. Garbage-collecta il dispatch table entry, abort delle request in volo legate al `routeId` (`AbortController.abort('route.unregistered')`).

### J. Test Strategy F3

- **D-88:** **Pattern TDD RED→GREEN come F1/F2** — ogni modulo (`route-resolver.ts`, `route-executor.ts`, `http-gateway.ts`, `retry-strategy.ts`, `dedupe-strategy.ts`, `backpressure-strategy.ts`, `auth-strategy.ts`, `idempotency-strategy.ts`) ha unit test co-locato. Plan paralleli con file ownership disgiunta dove possibile (analogo plan 02-04/05/06 di F2).
- **D-89:** **Integration test scenario meteo PRD §29 estendendo F2 con HTTP** — F3 verifica end-to-end:
  ```ts
  // Plugin form publishes (canonico post F2 step 5):
  publish('weather.requested', { location: 'Roma', forecast_date: '2026-04-30' })

  // Route 'weather-http' (F3) intercetta:
  // request.queryMap canonico→server: { location → city, forecast_date → date }
  // → GET /api/weather?city=Roma&date=2026-04-30

  // msw 2.x risponde:
  // { city: 'Roma', date: '2026-04-30', temp: 22, condition: 'sunny' }

  // Server response → mapper inverso (riusa F2 MapperEngine):
  // { temp → temperature_celsius, condition → weather_condition, city → location, date → forecast_date }

  // F3 publishes 'weather.loaded' con payload canonico:
  // { location: 'Roma', forecast_date: '2026-04-30', temperature_celsius: 22, weather_condition: 'sunny' }

  // Plugin widget (consumer F2) riceve via inputMap suo:
  // { location: 'Roma', 'day-prevision': '2026-04-30', temperature: 22, weather: 'sunny' }
  ```
  Test usa `msw` 2.x come HTTP interceptor (no fetch reale, no network); riusa `createMapperHarness` di F2 esteso a `createRouterHarness` con `mockServer` setup.
- **D-90:** **TEST-01 subset F3** — unit test deterministici per: dedupe (2 fetch identiche → 1 sola network call); retry (5xx → 3 retry, 4xx no retry, 408/429 retry, network error retry); timeout (fetch > timeout → abort + publish failed); concurrency latest-only (2 request consecutive → 1 abort, 1 published); URL allowlist (URL fuori → throw); idempotency (POST con retry → header `Idempotency-Key` invariato).
- **D-91:** **TEST-03 subset F3** — robustness: server response con schema inatteso (response Valibot fail → publish failed con `'response.validation.failed'`); server 503 retry storm con full jitter (verifica distribuzione delay random); cascade abort con `unregisterPlugin` durante 10 fetch in volo (verifica tutte abort + cleanup deterministico).
- **D-92:** **Coverage v8 F3** — riusa `@vitest/coverage-v8` installato in F2 plan 02-12; misura ≥ 90% sui file `@gluezero/routing/` e `@gluezero/gateway/http/`. Da fare in plan 03-XX dedicato (final gate F3 simile a 01-11 / 02-12).

### K. Estensione Type System

- **D-93:** **Type re-export da `@gluezero/routing` e `@gluezero/gateway` a `@gluezero/core`** — pattern non-breaking F2 D-56. Il package `@gluezero/core` ha `BrokerConfig.routes/gateway` placeholder `unknown` (plan 01-03). F3 fornisce i tipi `RouteDefinition`, `RoutePolicies`, `GatewayConfig`, `RetryStrategy`, `BackpressureStrategy`, `AuthStrategy` da `@gluezero/routing`/`@gluezero/gateway` e li wire-in al `BrokerConfig` via TS declaration merging in `@gluezero/routing/src/augment.ts` e `@gluezero/gateway/src/augment.ts`.
- **D-94:** **`PluginDescriptor` augmentation F3** — aggiunge `routes?: RouteDefinition[]` al `PluginDescriptor` esistente via declaration merging (F2 D-57 pattern).
- **D-95:** **`CanonicalSchema` augmentation F3** — aggiunge `requiresRoute?: boolean` per chiusura ROUTE-16 (D-67). Pattern declaration merging con F2.

### L. Mapping HTTP — request build + response parse

- **D-96:** **`request.queryMap` e `request.bodyMap` riusano `MapperEngine` di F2** — sono mapping canonico→server, identici nell'algoritmo a F2 ma direzione opposta (canonico → flat shape per HTTP request). NO codice mapping nuovo: F3 invoca `mapper.mapToShape(canonicalPayload, request.queryMap)` o `request.bodyMap`.
- **D-97:** **Response parse → canonical schema** — la route dichiara `response: { canonical: 'weather' }` (riferimento al `CanonicalSchema` registrato in F2). Il gateway parse la response (default `await response.json()`), poi invoca `mapper.mapToCanonical(serverResponse, response.canonical)` (riuso dell'algoritmo F2 server→canonical via `inputMap` reverse). Custom response parser opt-in (es. response binary, text plain, multipart) deferred a V1.x.
- **D-98:** **Custom serialization request body** — default JSON (`Content-Type: application/json`). Custom (form-data, multipart, ...) opt-in via `request.serializer: (canonical) => BodyInit` (function override). Default coverage 95% dei casi.

### M. Circuit breaker (avanzato — minimo F3)

- **D-99:** **Per-route fail counter base** — F3 implementa una versione minima del circuit breaker:
  - dopo N fail consecutivi (default `circuitBreaker.threshold: 5`) → route in stato `open` per `circuitBreaker.cooldownMs: 30000` ms
  - in stato `open`, ogni request → fail-fast publish `<topic>.failed` con `code: 'circuit.open'`, NO fetch
  - dopo cooldown → stato `half-open` → 1 request di prova → success → `closed`, fail → `open` di nuovo
  - **Default**: `circuitBreaker: false` (DISABILITATO) per V1; opt-in via `gateway.circuitBreaker: { threshold, cooldownMs }`
  - Sliding window stats (success rate over time window) → V1.x

### N. Revision iter 1 (revisions checker BLOCKER 4 closure)

- **D-100:** **RouterBroker isola l'accesso al CanonicalRegistry private di F2** (revision iter 1, BLOCKER 4 fix). `MapperBroker.canonicalRegistry` è `private readonly` (vedi packages/mapper/src/broker-mapper-wrapper.ts:206) e `CanonicalRegistry` non espone `getForTopic` né una mapping table topic→schemaId. Per chiudere ROUTE-16 (D-67) senza modifiche runtime a F2 (vincolo D-83), il `RouterBroker` (Plan 03-12) bind il registry **una volta sola** in constructor via cast tipato isolato + verifica strutturale presence; se F2 non risponde → throw `BrokerError 'router.canonical-registry.unavailable'` al boot (NO silent fallback). Per il legame topic→schemaId, F3 usa convenzione PRD §11 `<entity>.<action>.<status>` (primo segmento = entity = schemaId). In aggiunta, `RoutingConfig.requiresRouteTopics?: ReadonlyArray<string>` opt-in esplicito permette al consumer di dichiarare topic `requiresRoute: true` SENZA passare dal canonical-registry — utile quando il consumer NON usa la convenzione standard. F2 può eventualmente esporre un `getCanonicalRegistry()` public helper in F6 senza breaking change al RouterBroker (il bind via cast diventerà un delegate).

### Claude's Discretion

Aree dove le scelte specifiche di implementazione sono lasciate alla discrezione dell'agent planner/researcher:
- **Dispatch table storage interno** — la rappresentazione esatta del `Map<topicPattern, CompiledRoute[]>` (Map vs trie integrato vs hybrid)
- **Strategy registry storage** — Map vs Object literal con namespace per `RetryStrategy`, `DedupeStrategy`, ...
- **Gateway internals** — la decomposizione esatta dei moduli `http-gateway.ts` (potrebbe diventare `http-client.ts` + `policy-pipeline.ts` + ...)
- **`@gluezero/gateway/http` vs `@gluezero/gateway`** — se il sub-modulo HTTP merita un export path separato (`@gluezero/gateway/http`) o se basta `@gluezero/gateway` aggregato (researcher valuta in F3 research; F4 aggiungerà `@gluezero/gateway/sse-ws` quindi probabilmente sub-paths sono necessari)
- **Naming convention** dei file `.ts`/`.test.ts` interni di `@gluezero/routing` e `@gluezero/gateway` — segui pattern F1/F2
- **Splitting in plan** — il planner decide quanti plan (atteso ~10-14 plan tipo F1/F2 visto lo scope ampio: routing + gateway + 16 ROUTE-* + 5 SEC-* + integration test) e wave structure. Ipotesi: Wave 1 (foundation types + RouteDefinition + augment), Wave 2 (resolver + dispatch table parallelizzato a strategy primitives), Wave 3 (executor + http-gateway), Wave 4 (auth/retry/dedupe/backpressure/idempotency parallelizzati per file ownership disgiunta), Wave 5 (RouterBroker composition + LIFE-02 cascade), Wave 6 (integration test + scenario meteo + final gate)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### PRD (fonte autoritativa)
- `prd.md` §11.1 — `correlationId`, `dedupeKey` come campi first-class del BrokerEvent (D-74)
- `prd.md` §11.3 — Deduplica via `dedupeKey` (D-74)
- `prd.md` §13.5 — Default V1 canonicalizzazione interna completa (D-65 invariata da F2)
- `prd.md` §16.2 — API pubblica `registerRoute`/`unregisterRoute` (D-60)
- `prd.md` §17 — Routing engine intero (route types, policies)
- `prd.md` §17.2 — `RouteDefinition` discriminata via `type` (`local`/`http`/`cache`/`composite`) (D-60)
- `prd.md` §17.3 — Route `local` (D-60)
- `prd.md` §17.4 — Route `http` con `request.queryMap`/`bodyMap`/`publishes` (D-96, D-97)
- `prd.md` §17.6 — Route `cache` (cache-first/network-first/cache-then-network) — type defined F3, adapter F6 (D-60)
- `prd.md` §17.7 — Route `composite` (workflow) (D-60)
- `prd.md` §17.8 — Policy per route (timeout, retry, dedupe, cache, concurrency, error, mapping, auth) (D-68)
- `prd.md` §18 — Server Gateway HTTP intero
- `prd.md` §18.1, §18.2 — Server Gateway centralizza fetch/AJAX (D-68)
- `prd.md` §20.2 — Cache strategies (cache-first/network-first/cache-then-network — D-60 per type)
- `prd.md` §21.2.5 — Validazione risposta server (VAL-05, D-78)
- `prd.md` §22.3 — Eventi standard di errore inclusi `<topic>.failed` e `network.error` (D-80, D-81)
- `prd.md` §23.1 — Retry policy (D-69)
- `prd.md` §23.3 — Backpressure (queue/drop/throttle/debounce/latest-only/coalesce) (D-75)
- `prd.md` §23.4 — Deduplica (D-74)
- `prd.md` §23.5 — Cancellazione/invalidazione (D-76)
- `prd.md` §25.3 — Route Inspector (D-83 placeholder F3, full F6)
- `prd.md` §26.2 — Header auth, token refresh, idempotency, status uniformi, allowlist (SEC-01..SEC-05, D-70..D-72)
- `prd.md` §27 — `BrokerConfig` sezioni `routes`/`gateway` (D-62)
- `prd.md` §28 — Pipeline ufficiale 14 step (D-83, D-84)
- `prd.md` §29 — Scenario meteo end-to-end con HTTP (D-89 integration test target)
- `prd.md` §29.4 — Pubblicazione `<topic>.failed` su errore route remota (D-80)
- `prd.md` §39 #5 — Topic senza route: ROUTE-16 (D-67)
- `prd.md` §39 #6 — Più route applicabili: ROUTE-15 (D-66)
- `prd.md` §39 #7 — Unsubscribe automatico in unregister plugin: LIFE-02 ext F3 (D-86)
- `prd.md` §39 #8 — Retry 4xx vs 5xx: ROUTE-09 (D-69)

### Roadmap & Requirements
- `.planning/ROADMAP.md` § Phase 3 — Goal, scope, requirements, 5 success criteria
- `.planning/REQUIREMENTS.md` § Routing — 16 ROUTE-* (ROUTE-01..ROUTE-16)
- `.planning/REQUIREMENTS.md` § Validation — VAL-05 (response server)
- `.planning/REQUIREMENTS.md` § Errori — ERR-02 ext (`<topic>.failed`, `network.error`)
- `.planning/REQUIREMENTS.md` § Sicurezza — SEC-01..SEC-05
- `.planning/REQUIREMENTS.md` § Test — TEST-01 subset F3 (route HTTP), TEST-02 (plugin → server → plugin), TEST-03 (server malconfigurato + retry storm)
- `.planning/REQUIREMENTS.md` § Documentazione — DOC-04
- `.planning/REQUIREMENTS.md` Phase 3 mapping table — note esplicite per ogni REQ-ID

### Research (Phase 1 — riusato da F3)
- `.planning/research/STACK.md` § HTTP — `fetch` nativo + Gateway custom (NO `ky`/`wretch`/`ofetch`); `msw` 2.x per integration test (D-68, D-89)
- `.planning/research/STACK.md` § ID — `nanoid` per idempotency token (D-70)
- `.planning/research/STACK.md` § Bundle size — size-limit budget per `@gluezero/gateway` < 6 KB gzip (target esplicito)
- `.planning/research/ARCHITECTURE.md` §2.4 — Adapter Pattern per Gateway/Worker/Realtime/Cache (D-68)
- `.planning/research/ARCHITECTURE.md` §2.5 — Strategy Pattern per route policies (D-68)
- `.planning/research/ARCHITECTURE.md` §2.6 — Chain of Responsibility per middleware (D-68 — pipeline policy)
- `.planning/research/ARCHITECTURE.md` § Step 7-10 — pipeline mapping (D-84)
- `.planning/research/PITFALLS.md` #2 — Race condition request/response (D-73, D-74, D-77)
- `.planning/research/PITFALLS.md` #4 — Dedupe scorretta + backpressure cieca (D-75 priority-aware)
- `.planning/research/PITFALLS.md` #5 — Retry policy tossica: full jitter formula (D-69)
- `.planning/research/PITFALLS.md` #16 — Performance: dispatch pre-compilata (D-64)
- `.planning/research/PITFALLS.md` #17 — Sicurezza: token, CORS, allowlist (D-71, D-72)
- `.planning/research/SUMMARY.md` — Sintesi roadmap + dependency F1+F2 → F3

### Phase 1 deliverables (consumati da F3)
- `packages/core/src/types/broker-event.ts` — `BrokerEvent` shape con `correlationId`, `dedupeKey`, `priority`, `deliveryMode` (F3 valorizza `correlationId` per request/response chain)
- `packages/core/src/types/tap.ts` — `PipelineStep` con tolerant placeholder block per F3 extension (D-85)
- `packages/core/src/types/error.ts` — `BrokerError` + `ErrorCategory` include già `'network'`, `'auth'`, `'config'` (per D-80)
- `packages/core/src/types/plugin.ts` — `PluginDescriptor` (F3 augment via declaration merging — D-94)
- `packages/core/src/types/config.ts` — `BrokerConfig` con sezioni F3 placeholder `unknown` (D-93)
- `packages/core/src/core/bus.ts` — EventBus core (F3 estende via wrapper come F2, NON modifica direttamente — D-83)
- `packages/core/src/core/broker.ts` — Broker class composition (F3 aggiunge `RouterEngine`)
- `packages/core/src/public-factory.ts` — `createBroker(config)` (F3 estende validation con sezioni routes/gateway via declaration merging Valibot)
- `packages/core/src/core/event-tap.ts` — `safeTapStep`, `startStep` (F3 riusa per i 3 nuovi step 8/9/10)
- `packages/core/src/core/plugin-registry.ts` — `Broker.registerPlugin/unregisterPlugin` con cascade D-26 (F3 estende cascade per route — D-86)
- `packages/core/src/__integration__/` — `PipelineHarness` test fixture (F3 lo estende a `RouterHarness` con `mockServer` msw — D-89)

### Phase 2 deliverables (consumati da F3)
- `packages/mapper/src/mapper-engine.ts` — `MapperEngine` (F3 lo riusa per `request.queryMap`/`bodyMap` canonico→server e response server→canonico — D-96, D-97)
- `packages/mapper/src/broker-mapper-wrapper.ts` — `MapperBroker` (composition wrapper di Broker F1) — F3 compone su questo via `RouterBroker` wrapper (D-83)
- `packages/mapper/src/public-factory.ts` — `createMapperBroker(config)` (F3 estende a `createRouterBroker(config)` come composition wrapper)
- `packages/mapper/src/canonical-registry.ts` — `CanonicalSchema` (F3 estende con `requiresRoute?: boolean` via augment — D-95)
- `packages/mapper/src/types/` — `InputMap`, `OutputMap`, `CanonicalSchema`, `TransformDescriptor` (F3 riusa per route mapping)
- `packages/mapper/src/test-utils/` — `createMapperHarness` (F3 estende a `createRouterHarness` con `mockServer` setup — D-89)
- `packages/mapper/src/augment.ts` — pattern augment via declaration merging (F3 lo replica in `@gluezero/routing/src/augment.ts` e `@gluezero/gateway/src/augment.ts`)

### CLAUDE.md (vincoli operativi)
- `CLAUDE.md` § Vincoli operativi — Modello `claude-opus-4-7-1` per tutti gli agenti GSD; lingua italiana; minimizzare interazioni; agent-swarm parallelizzato
- `CLAUDE.md` § Stack raccomandato — `fetch` nativo + Gateway custom (NO `ky`/`wretch`/`ofetch`); `msw` 2.x; `Valibot` per response validation; `EventSource`/`WebSocket` nativi (F4); `nanoid` per ID
- `CLAUDE.md` § Pipeline ufficiale §28 — F3 estende step 7-full, 8, 9, 10
- `CLAUDE.md` § Open issues PRD §39 — F3 chiude #5 (ROUTE-16), #6 (ROUTE-15), #7 (LIFE-02), #8 (ROUTE-09)
- `CLAUDE.md` § Vincolo architetturale critico — `EventTap` instrumentation invariata; F3 aggiunge step ai tap

### Phase 1 + Phase 2 CONTEXT.md (decisioni propagate)
- `.planning/phases/01-core-essenziale/01-CONTEXT.md` — D-08 (trie segmentato wildcard riusato per route), D-20 (EventTap surface), D-26 (cascade unregister esteso F3), D-21 (nanoid ID generation), D-22 (timestamp), D-23 (source obbligatorio), D-19 (createBroker imperativo+dichiarativo)
- `.planning/phases/02-canonical-model-mapper/02-CONTEXT.md` — D-49 (composition wrapper non-modifica core), D-50 (ordine pipeline F2 invariata), D-56 (declaration merging type re-export), D-58 (mapping.error non confonde con `<topic>.failed` di F3 D-59 → ora chiuso da F3 D-80)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (da Phase 1 e Phase 2)
- **`createBrokerError`/`isBrokerError`** (`packages/core/src/core/broker-error.ts`) — F3 lo riusa per tutti gli errori `gateway.*`/`route.*`/`auth.*`; `category: 'network'|'auth'|'config'|'validation'` già definite.
- **`safeTapStep` + `startStep`** (`packages/core/src/core/event-tap.ts`) — F3 lo invoca per i 3 nuovi step 8/9/10 con stesso pattern di F1/F2 (D-85).
- **`EventBus.publish`** (`packages/core/src/core/bus.ts`) — F3 chiama `publish('<topic>.loaded', ...)` o `publish('<topic>.failed', ...)` con il nuovo `correlationId` propagato (D-80).
- **`Broker.registerPlugin/unregisterPlugin`** (`packages/core/src/core/plugin-registry.ts`) — F3 estende il register flow aggiungendo: dopo `onRegister` invoca `routerEngine.registerRoutes(descriptor.routes, ownerId)`. Cascade unregister estesa per route (D-86).
- **`PluginRegistry` cascade D-26** — `unregisterPlugin` deve cascadere anche le registrazioni di route fatte dal plugin (D-86 chiusura LIFE-02).
- **`BrokerConfig` Valibot validation** (`packages/core/src/public-factory.ts`) — F3 estende lo schema Valibot per validare le sezioni `routes/gateway`.
- **`MapperEngine.mapToCanonical`/`mapToShape`** (`packages/mapper/src/mapper-engine.ts`) — F3 riusa per `request.queryMap` (canonico→server flat) e response parsing (server→canonico) (D-96, D-97).
- **`MapperBroker`** (`packages/mapper/src/broker-mapper-wrapper.ts`) — F3 compone su questo wrapper, NON modifica il core. Pattern: `RouterBroker = wrap(MapperBroker)` (D-83).
- **`createMapperHarness`** (`packages/mapper/src/test-utils/`) — F3 estende a `createRouterHarness` con `msw` mockServer + `defineRoute()` helper (D-89).
- **`PipelineHarness`** (`packages/core/src/test-utils/pipeline-harness.ts`) — F3 estende il fixture con `expectRouteResolved()`, `expectFetched()`, `expectRetryAttempts(N)` helpers.
- **Trie segmentato wildcard** (F1 D-08) — F3 riusa per `RouteDefinition.topic` matching wildcard (es. `weather.*.requested`).

### Established Patterns
- **TDD RED→GREEN**: ogni modulo `*.ts` ha test `*.test.ts` co-locato; commit pattern `test(03-XX): aggiunge test RED per <X>` poi `feat(03-XX): implementa <X>`.
- **File ownership disgiunta tra plan paralleli**: pattern usato in plan 04/05/06 di F1 e plan 02-04/05/06 di F2 (Wave 3 / 4); applicabile a F3 per le 5-7 strategy implementations parallelizzabili (`retry-strategy.ts` || `dedupe-strategy.ts` || `backpressure-strategy.ts` || `auth-strategy.ts` || `idempotency-strategy.ts`).
- **Tipo nominato per Rule 2 readability**: pattern usato in F1/F2 con `SnapshotFactory`/`CompiledFieldMapping`; applicabile in F3 per `CompiledRoute`, `RouteDispatchTable`, `PolicyChain`.
- **Type-only barrel re-export**: `packages/core/src/index.ts` ha `export type * from './types'` (plan 03); F3 estende con `export type * from '@gluezero/routing'` e `export type * from '@gluezero/gateway'` se i tipi pubblici devono essere esposti dal core (verifica con planner).
- **Declaration merging per estensioni non-breaking**: pattern usato in plan 03 e F2 per `PipelineStep`, `BrokerConfig`, `PluginDescriptor`; F3 lo applica per `PipelineStep` extension (D-85), `PluginDescriptor.routes` (D-94), `CanonicalSchema.requiresRoute` (D-95), `BrokerConfig.routes`/`gateway` (D-93).
- **Atomic commit chunks** per plan grandi: pattern usato in plan 09/10 di F1 e 02-10/11/12 di F2; applicabile a integration test F3 (scenario meteo HTTP, retry storm, cascade abort).
- **Performance budget**: F1 ha verificato storm 24ms / wildcard 11ms; F2 ha mantenuto core 248 test invariati; F3 deve mantenere overhead routing minimo (target: < 5% di publish latency su route `'local'`, < 50ms aggiuntivi per route HTTP escluso fetch network).
- **Composition wrapper pattern** (F2 D-49): F3 replica per `RouterBroker = wrap(MapperBroker)`. ZERO modifiche a `packages/core/` runtime e ZERO modifiche a `packages/mapper/` runtime.
- **CI gates incrementali**: F2 plan 02-12 ha esteso publint + attw + size-limit a `@gluezero/mapper`. F3 deve estendere a `@gluezero/routing` (budget < 5 KB gzip) e `@gluezero/gateway` (budget < 6 KB gzip per HTTP-only sub-modulo, F4 estenderà con SSE/WS).
- **`msw` 2.x setup**: già installato come dev-dep root in F1 plan 01-02. F3 lo configura per i suoi integration test (no nuova dependency).

### Integration Points
- **`bus.ts:publish()` di F1**: F3 NON modifica direttamente. Il `RouterBroker` (`router-broker-wrapper.ts`) intercetta il publish PRIMA che `MapperBroker` lo deleghi a `bus.publish` per applicare step 8/9/10 quando esiste una route HTTP/cache/composite.
- **`bus.ts:deliver()` di F1**: F3 NON modifica. Le route `'local'` (D-65) usano la consegna F1 invariata. Le route HTTP/cache/composite producono outcome che viene poi pubblicato come nuovo BrokerEvent (`<topic>.loaded`/`.failed`) → bus delivery normale.
- **`createBroker(config)` Valibot validation**: F3 estende lo schema per validare le sezioni `routes` (array di `RouteDefinition`) e `gateway` (`GatewayConfig`).
- **`getDebugSnapshot()`**: F3 aggiunge sezione `routes: { count, byType, inFlightFetches, lastFailures }` (riusa pattern F2 D-48).
- **`pipeline-harness.ts`**: F3 estende il test fixture con `defineRoute()`, `mockServer()`, `expectFetched()`, `expectRetryAttempts(N)`, `expectAborted(N)` helpers — riuso da `createMapperHarness` di F2.
- **`AbortController` API surface F1**: F3 propaga il signal del subscriber alla fetch correlata (D-77).
- **`@gluezero/mapper.MapperEngine`**: F3 lo riusa come dependency runtime per request build (canonical→server) e response parse (server→canonical). NON ricompila la pipeline mapping di F2.

</code_context>

<specifics>
## Specific Ideas

### Scenario meteo PRD §29 esteso con HTTP (D-89)
F3 deve consegnare end-to-end:
```typescript
// 1. Plugin form publishes (canonico post F2 step 5):
broker.publish('weather.requested', {
  location: 'Roma',
  forecast_date: '2026-04-30'
})

// 2. Route 'weather-http' (F3) intercetta:
const weatherRoute: RouteDefinition = {
  id: 'weather-http',
  type: 'http',
  topic: 'weather.requested',
  request: {
    method: 'GET',
    url: '/api/weather',
    queryMap: {
      city: 'location',           // canonico location → server city
      date: 'forecast_date'        // canonico forecast_date → server date
    }
  },
  response: {
    canonical: 'weather'           // riferimento al CanonicalSchema F2
    // implicit: server response { temp, condition, city, date } → canonical
    // mapping inverso definito nel canonicalSchema 'weather' inputMap
  },
  publishes: {
    success: 'weather.loaded',
    error: 'weather.failed'
  },
  policies: {
    timeout: 5000,
    retry: { maxAttempts: 3 },     // default policy D-69
    concurrency: 'latest-only',    // auto-detected per *.requested + GET (D-73)
    dedupe: { keyFrom: ['location', 'forecast_date'] }
  }
}

// 3. msw 2.x risponde (test integration):
http.get('/api/weather', () => HttpResponse.json({
  city: 'Roma',
  date: '2026-04-30',
  temp: 22,
  condition: 'sunny'
}))

// 4. Server response mappata server→canonico via F2 MapperEngine:
// canonical: { location: 'Roma', forecast_date: '2026-04-30',
//              temperature_celsius: 22, weather_condition: 'sunny' }

// 5. F3 publishes 'weather.loaded' con payload canonico
// 6. F2 step 11 applica inputMap del plugin widget consumer:
//    widget receives: { location: 'Roma', 'day-prevision': '2026-04-30',
//                       temperature: 22, weather: 'sunny' }
```

### Esempi route policies coperti (PRD §17.8, §23)
- **Retry**: `{ maxAttempts: 3, baseDelayMs: 300, maxDelayMs: 10000 }` — full jitter (D-69)
- **Timeout**: `{ ms: 5000 }` (default), `{ ms: Infinity }` per stream (deferred a F4)
- **Dedupe**: `{ keyFrom: ['location', 'date'] }` o `{ key: (event) => '...' }`
- **Concurrency**: `'latest-only'` (default per *.requested + GET) | `'serial'` | `'parallel'`
- **Backpressure**: `{ type: 'queue-bounded', max: 10 }` | `{ type: 'throttle', perSec: 5 }` | ...
- **Auth**: `{ bearer: true }` (usa `gateway.auth.getToken`) | `{ custom: (req) => ... }`
- **Idempotency**: `{ mode: 'auto', headerName: 'Idempotency-Key' }` per POST/PATCH/PUT/DELETE
- **Error**: routing default differenziazione 4xx/5xx (D-69), override `errorPolicy: 'always-retry' | 'never-retry' | 'default'`

### Errori standard `<topic>.failed` family (D-80, D-81)
- `gateway.timeout` — fetch > timeout
- `gateway.4xx` — status 400-499 (escluso 408/429 che hanno proprio code)
- `gateway.5xx` — status 500-599 dopo retry exhausted
- `gateway.network` — fetch throw senza response (offline, CORS, DNS)
- `gateway.url.forbidden` — URL non in allowlist (SEC-05)
- `response.validation.failed` — Valibot fail su response canonical schema (VAL-05)
- `route.required.missing` — topic richiede route ma nessuna registrata (ROUTE-16)
- `auth.expired` — token refresh fallito o ritorna stesso token
- `circuit.open` — circuit breaker open per route (D-99 — opt-in)

### File map iniziale F3 (pre-planner refinement)
```
packages/routing/src/
├── augment.ts                   # PipelineStep, PluginDescriptor.routes, BrokerConfig.routes
├── types/
│   ├── route-definition.ts      # RouteDefinition discriminata (local|http|cache|composite)
│   ├── route-policies.ts        # RetryPolicy, DedupePolicy, BackpressurePolicy, ...
│   └── route-outcome.ts         # RouteOutcome, RouteResult, RouteError
├── route-resolver.ts            # dispatch table compile + lookup (D-64, D-66)
├── route-executor.ts            # execute by type (local|http|cache|composite) (D-65)
├── route-handlers/
│   ├── local-handler.ts         # delega a bus.deliver
│   ├── http-handler.ts          # invoca http-gateway
│   ├── cache-handler.ts         # placeholder F6
│   └── composite-handler.ts     # workflow orchestration
├── router-engine.ts             # registerRoute/unregisterRoute + dispatch
├── router-broker-wrapper.ts     # composition wrapper di MapperBroker (D-83)
├── public-factory.ts            # createRouterBroker(config)
├── strategies/
│   ├── first-match.ts           # default ROUTE-15
│   ├── priority-ordered.ts
│   └── all-broadcast.ts
├── test-utils/
│   └── router-harness.ts        # estende createMapperHarness con mockServer msw
├── __integration__/
│   ├── scenario-meteo-http.test.ts
│   ├── retry-policy.test.ts
│   ├── dedupe.test.ts
│   ├── concurrency-latest-only.test.ts
│   ├── url-allowlist.test.ts
│   └── route-cascade-cleanup.test.ts
└── index.ts                     # public API barrel

packages/gateway/src/
├── augment.ts                   # BrokerConfig.gateway extension
├── http/
│   ├── types/
│   │   ├── gateway-config.ts
│   │   ├── http-strategies.ts
│   │   └── http-error.ts
│   ├── http-gateway.ts          # entry point: fetch + policy chain
│   ├── strategies/
│   │   ├── retry-strategy.ts          # ExponentialBackoffWithJitter (D-69)
│   │   ├── timeout-strategy.ts        # FixedTimeout
│   │   ├── dedupe-strategy.ts         # KeyBased (D-74)
│   │   ├── backpressure-strategy.ts   # LatestOnly + others (D-75)
│   │   ├── auth-strategy.ts           # BearerHook + refresh (D-72)
│   │   ├── idempotency-strategy.ts    # auto Idempotency-Key (D-70)
│   │   └── circuit-breaker.ts         # opt-in (D-99)
│   ├── url-allowlist.ts         # SEC-05 (D-71)
│   └── public-factory.ts        # createHttpGateway(config)
├── (sse-ws sub-modules — F4)
└── index.ts
```
Il planner può accorpare/dividere — questa è una baseline orientativa.

</specifics>

<deferred>
## Deferred Ideas

### Non in scope F3 (da considerare in F4 o successive)
- **Realtime SSE/WS adapter** — `@gluezero/gateway/sse-ws` (F4 — RT-01..RT-08, chiude PRD §39 #9 RT-07)
- **Cache adapter implementativo** — in-memory + IndexedDB (F6 — riusa `@gluezero/gateway/http` per network fetch)
- **Worker route handler** — `RouteDefinition` con `type: 'worker'` (F5 — chiude PRD §39 #11 WK-07)
- **Route Inspector full snapshot** — payload before/after per evento route (F6 — TOOL-01/03)
- **Metrics format** — F6 chiude PRD §39 #10 TOOL-05
- **Adapter Zod/Ajv per response validation** — V2 (V1 solo Valibot, riusa F2 ValidatorAdapter)
- **Circuit breaker avanzato** — sliding window stats, success rate, fallback URL (V1.x — F3 implementa solo per-route fail counter base, opt-in disabilitato di default — D-99)
- **Custom serializer request body** — form-data/multipart/binary (V1.x — F3 supporta solo JSON di default + opt-in `request.serializer` hook)
- **Custom response parser** — non-JSON response (binary, text plain, multipart) (V1.x)
- **Retry budget globale** — max retry/min cross-route per prevenire DOS auto-inflitto (V1.x — PITFALLS #5 raccomanda ma marca avanzato)
- **`createSembridge(config)` aggregato pubblico** — factory unified F1+F2+F3+F4+F5+F6 (F6 quando feature-complete — D-63)
- **Server push notification protocol** (oltre SSE/WS) — V2

### Considered but rejected
- **`ky`/`wretch`/`ofetch` come dipendenza esposta** — REJECTED da CLAUDE.md vincoli operativi e STACK.md: insufficienti per coprire tutte le policy PRD richieste; un middleware non deve trascinare wrapper opinionati. Decisione locked.
- **`reconnecting-websocket` polyfill** — REJECTED da PRD §31.3 e CLAUDE.md ("polyfill separati dal core"). Decisione locked. F4 implementerà reconnect custom.
- **Mapping al runtime invece di pre-compile per route resolution** — REJECTED: PITFALLS #16 warns about hot-path overhead; pre-compilation è la scelta locked (D-64), coerente con F2 D-34.
- **AbortSignal su `publish()` come parametro pubblico** — REJECTED: il subscriber API `subscribe(handler, {signal})` è sufficiente (F1 plan 04/05). Aggiungere `publish(topic, payload, {signal})` complicherebbe l'API senza vantaggi chiari (il publisher può cancellare via `unregisterPlugin` o il route può abort autonomamente via `concurrency: 'latest-only'`).
- **Singolo `createBroker` aggregato già in F3** — DEFERRED: D-63 motiva la scelta di estendere `createMapperBroker` con `createRouterBroker` (composition wrapper) e introdurre il factory unificato `createSembridge` solo a F6. Riduce churn API pubblica e mantiene le linee di comunicazione tra phase chiare.

</deferred>

---

*Phase: 3-Routing & Server Gateway HTTP*
*Context gathered: 2026-04-30 (auto-mode da PRD/ROADMAP/REQUIREMENTS/Research post Phase 2 closure)*
