# Roadmap: SemBridge

**Created:** 2026-04-28
**Granularity:** coarse (allineata 1:1 con PRD §32)
**Coverage:** 91/91 requisiti v1 mappati
**Mode:** yolo · Parallelization: enabled · Model profile: quality
**Fonte autoritativa:** `prd.md` (root del progetto)

## Phases

- [ ] **Phase 1: Core essenziale** (in progress, 8/11 plans complete) — Event bus pub/sub in-page, plugin registry con lifecycle anti-leak, struttura `BrokerEvent`, EventTap pre-instrumentato
- [ ] **Phase 2: Canonical Model & Mapper** — Vocabolario canonico + mapper bidirezionale locale ↔ canonico ↔ locale con transform pipeline e Mapping Inspector
- [ ] **Phase 3: Routing & Server Gateway HTTP** — Routing engine dichiarativo (`local`/`http`/`cache`/`composite`) + gateway HTTP unico con retry/timeout/dedupe/auth
- [ ] **Phase 4: Realtime inbound (SSE prioritario, WS opzionale)** — Adapter SSE + WebSocket con reconnection policy, normalizzazione canonica dei messaggi server
- [ ] **Phase 5: Worker Runtime** — Worker registry, route `worker`, task tracking, propagazione errori, timeout e cancellazione
- [ ] **Phase 6: Cache & Tooling avanzato** — In-memory cache con metadata `cache`/`remote`, Event Inspector, metrics, controlli `pauseTopic`/`resumeTopic`/`flushQueue`

## Phase Details

### Phase 1: Core essenziale

**Goal**: Esiste un broker pub/sub in-page testabile che pubblica e consegna `BrokerEvent` strutturati, con plugin registry, lifecycle hooks anti-leak, naming convention validata e infrastruttura di osservabilità (`EventTap`) pre-instrumentata anche se senza implementazione reale.

**Scope (cross-cutting attivati in F1)**: pipeline §28 — implementati skeleton degli step 1 (ricezione), 2 (arricchimento metadata), 3 (validazione sintattica evento), 7 (dedupe/backpressure base via `dedupeKey` + `priority`), 13 (consegna). Validazione: `VAL-01`, `VAL-06`. Errori: `ERR-01`, `ERR-03`. Lifecycle: `LIFE-01`, `LIFE-02` (cascade unsubscribe). Test: `TEST-01` (subset core), `TEST-03` (storm + plugin malconfigurato). Packaging: `PKG-01..PKG-04`. Docs: `DOC-01` (skeleton API).

**Package monorepo**: `@sembridge/core` (broker, event bus, topic registry, subscriber registry, plugin registry, lifecycle manager, EventTap interface)

**Stack chiave**: TypeScript 5.5+, tsup, Vitest + jsdom, Biome, Changesets, nanoid, EventBus in-house (no mitt/eventemitter3/RxJS), AbortSignal-first API

**Depends on**: Nothing (root phase)

**Requirements**:
CORE-01, CORE-02, CORE-03, CORE-04, CORE-05, CORE-06, CORE-07, CORE-08, CORE-09, CORE-10, CORE-11, CORE-12, CORE-13, CORE-14, VAL-01, VAL-06, ERR-01, ERR-03, LIFE-01, LIFE-02, TEST-01 (subset), TEST-03 (subset), PKG-01, PKG-02, PKG-03, PKG-04, DOC-01 (skeleton)

**Success Criteria** (what must be TRUE):
  1. Plugin A pubblica un topic e Plugin B sottoscritto allo stesso topic riceve l'evento attraverso il broker, senza che i due plugin si conoscano direttamente — verificato da integration test (`TEST-02` parziale: pub/sub end-to-end senza mapping ancora attivo).
  2. `subscribe(topic, handler)` ritorna un `Subscription` con `.unsubscribe()` che, una volta invocato, garantisce che successive `publish` non raggiungano l'handler; in parallelo, `unregisterPlugin(id)` rimuove in cascata tutte le subscription, route e risorse del plugin (test deterministico TEST-01: `getDebugSnapshot()` torna ai contatori pre-registrazione).
  3. Ogni evento pubblicato rispetta la struttura `BrokerEvent` (id univoco generato via nanoid se assente, timestamp valorizzato dal broker, source obbligatorio); il naming `<entity>.<action>.<status>` dot-separated minuscolo è validato al `publish` con errore esplicito su input non conforme.
  4. Wildcard subscribe (`weather.*`, `*.failed`, `form.customer.*`) consegna gli eventi ai subscriber generici; logging configurabile rispetta i livelli `silent | error | warn | info | debug | trace`.
  5. L'interfaccia `EventTap` è instrumentata in tutti gli step di pipeline implementati in F1 (con implementazione no-op di default); le fasi successive estendono la pipeline aggiungendo step ma riusando lo stesso contratto Tap senza retrofit (vincolo critico ARCHITECTURE.md §3 + SUMMARY.md).

**Plans**: 11 plans
- [x] 01-01-PLAN.md — Monorepo bootstrap (pnpm + 7 packages + tooling root) — completato 2026-04-28 (3 commits: 3a7d9fd, 3b46294, de3e16b)
- [x] 01-02-PLAN.md — `@sembridge/core` package config (tsup + vitest + tsconfig + deps) — completato 2026-04-28 (2 commits: 6de9f41, d6004c7)
- [x] 01-03-PLAN.md — Public types (BrokerEvent, Subscription, PluginDescriptor, BrokerError, BrokerLogger, EventTap, BrokerConfig, DeepReadonly) — completato 2026-04-28 (3 commits: ebd126a, 7d4ff8a, 7b01f82)
- [x] 01-04-PLAN.md — Utility batch A: broker-error + deep-freeze + logger + event-tap — completato 2026-04-28 (8 commits: a08cca7+e0f2a4e, 13dd13c+06212c7, 323b141+8c0bf5b, 2d3cac7+21e0939; 4 source + 4 test, 42/42 test passing)
- [x] 01-05-PLAN.md — Utility batch B: topic-matcher + event-factory + event-validator — completato 2026-04-28 (6 commits RED+GREEN: c97bc56+8c24e77, 239d010+6cd21e7, d77398c+cf12502; 3 source + 3 test, 55 nuovi test, eseguito in parallelo a plan 06 via gsd-executor)
- [x] 01-06-PLAN.md — Utility batch C: topic-registry + lifecycle state machine — completato 2026-04-28 (4 commits RED+GREEN: 526336a+41866e7, c87ae5f+94db532; 2 source + 2 test, 37 nuovi test, eseguito in parallelo a plan 05 via gsd-executor)
- [x] 01-07-PLAN.md — EventBus (bus.ts) — pub/sub dispatch + handler isolation + 5 step tap — completato 2026-04-28 (2 commits RED+GREEN: d328a96+9189a03; 1 source 291 LOC + 1 test 402 LOC, 25 nuovi test; 6 test extra Rule 2 oltre i 16 minimi del PLAN)
- [x] 01-08-PLAN.md — PluginRegistry + Broker class composition + public-factory + index.ts public API — completato 2026-04-28 (4 commits RED+GREEN: ada0cfb+1377ef9, 285390b+1960be9; 5 source/test + index.ts modificato, 32 nuovi test; build OK con dist/index.js 23.14 KB + dist/index.d.ts 6.44 KB; smoke import 6 entries)
- [ ] 01-09-PLAN.md — PipelineHarness fixture + integration tests (5 success criteria + LIFE-02 deterministico)
- [ ] 01-10-PLAN.md — Robustness tests (storm, wildcard-perf, plugin-fault, concurrent-unregister)
- [ ] 01-11-PLAN.md — Build verification (publint + attw + size-limit) + DOC-01 README + JSDoc
**Needs research**: no
**UI hint**: no

---

### Phase 2: Canonical Model & Mapper

**Goal**: Esiste un Canonical Vocabulary Registry con campi tipizzati e alias riconosciuti; il mapper bidirezionale traduce payload locale → canonico → locale per ogni consumer secondo la regola di canonicalizzazione interna completa V1 (PRD §13.5); il Mapping Inspector mostra payload originale, canonico, finale, trasformazioni applicate e warning di ambiguità.

**Scope (cross-cutting estesi in F2)**: pipeline §28 — implementati gli step 4 (identificazione source), 5 (mapping output→canonico), 6 (validazione canonico), 11 (mapping canonico→consumer per ciascun subscriber), 12 (validazione finale). Validazione: `VAL-02`, `VAL-03`, `VAL-04`, `VAL-07`, `VAL-08`, `VAL-09`. Errori: estensione `ERR-02` per `mapping.error`. Test: `TEST-01` (mapping/reverse mapping/transform), `TEST-02` (plugin A → broker → plugin B con mapping diverso). Docs: `DOC-03`.

**Package monorepo**: `@sembridge/mapper` (Canonical Vocabulary, Alias Registry, Transform Pipeline, Validate adapter); `@sembridge/validation` cross-cutting

**Stack chiave**: Valibot 1.x come default (~1-3 KB per schema usato) con adapter pluggable per Zod/Ajv; mapping pipeline pre-compilata; cycle detection con `visited: Set<(pluginId, fieldName)>`

**Depends on**: Phase 1 (canonical model usa il broker per pubblicare warning di ambiguità via `mapping.error` e `system.warn`; `EventTap` definito in F1 viene esteso con step di mapping)

**Requirements**:
MAP-01, MAP-02, MAP-03, MAP-04, MAP-05, MAP-06, MAP-07, MAP-08, MAP-09, MAP-10, MAP-11, MAP-12, MAP-13, MAP-14, MAP-15, MAP-16, MAP-17, VAL-02, VAL-03, VAL-04, VAL-07, VAL-08, VAL-09, ERR-02 (mapping.error), TEST-01 (mapping subset), TEST-02 (plugin A → plugin B), DOC-03

**Success Criteria** (what must be TRUE):
  1. Lo scenario meteo PRD §29 funziona end-to-end senza HTTP: Plugin form pubblica `weather.requested` con `città: "Roma", data: "30/04/2026"`, il mapper produce internamente `{location: "Roma", forecast_date: "2026-04-30"}` (con `parseItalianDate` + `normalizeLocationName`), e Plugin widget consumer riceve `{location, day-prevision}` tramite `inputMap` bidirezionale.
  2. Il Mapping Inspector (`broker.getDebugSnapshot()` o API dedicata) mostra per ogni evento: payload originale, payload canonicalizzato, payload finale consegnato al consumer, lista trasformazioni applicate, warning di ambiguità su alias risolto automaticamente, errori di trasformazione.
  3. Il mapper supporta tutti i casi PRD §14.2: rename, nested, default, transform di formato, normalizzazione unità, derive (`$derive` con concat e similari), mapping parziale, validazione post-mapping; `registerTransform(name, fn)` registra trasformazioni custom invocabili dai mapping.
  4. Open issue PRD §39 chiusi in F2 sono verificabili da test: MAP-17 (mapping esplicito vince sempre sugli alias automatici → test con plugin che dichiara `inputMap` esplicito conflittuale con un alias globale, vince il mapping); VAL-08 (field mancante: configurabile per campo nel canonical schema — `required: true` errore vs `required: false` default); VAL-09 (transform failure: `onFailure: 'block' | 'skip' | 'fallback'` con default `'block'`).
  5. Cycle detection nel mapping: un descrittore plugin che genera mapping circolare (`A → B → A`) viene rifiutato al `registerPlugin` con errore esplicito "circular mapping detected" — non a runtime ma al register.

**Plans**: TBD
**Needs research**: no
**UI hint**: no

---

### Phase 3: Routing & Server Gateway HTTP

**Goal**: Esiste un routing engine dichiarativo con `RouteDefinition` discriminata via `type` (`local`, `http`, `cache`, `composite`); il Server Gateway centralizza tutte le richieste fetch/AJAX con policy uniformi (timeout, retry differenziato 4xx/5xx, dedupe, backpressure, auth, cancellazione); ogni route HTTP converte un topic `<entity>.<action>.requested` in una chiamata di rete e pubblica `<entity>.<action>.loaded` o `<entity>.<action>.failed` come BrokerEvent canonici.

**Scope (cross-cutting estesi in F3)**: pipeline §28 — implementati step 7 (dedupe/backpressure full), 8 (resolve route), 9 (execute route http/local/cache/composite), 10 (collect outcome). Validazione: `VAL-05` (response server). Errori: `ERR-02` esteso a `<topic>.failed` e `network.error`. Sicurezza: `SEC-01..SEC-05`. Test: `TEST-01` (route HTTP, dedupe, retry/timeout), `TEST-02` (plugin → broker → server → broker → plugin), `TEST-03` (server con schema inatteso). Docs: `DOC-04`.

**Package monorepo**: `@sembridge/routing` (engine, resolver, executor, handlers); `@sembridge/gateway` con sub-modulo `http` (fetch + retry/timeout/dedupe/auth/circuit/idempotency)

**Stack chiave**: `fetch` nativo + Gateway HTTP custom (no `ky`/`wretch`/`ofetch` come dipendenza esposta); `msw` 2.x per integration test; idempotency token auto-generato per POST; full jitter `min(maxDelay, base * 2^attempt) * (0.5 + Math.random() * 0.5)`; default `concurrency: 'latest-only'` per topic UI-driven

**Depends on**: Phase 1 (broker, EventTap, BrokerError), Phase 2 (canonical model: route HTTP usa `queryMap`/`bodyMap` canonico→server e mapper server→canonico per response)

**Requirements**:
ROUTE-01, ROUTE-02, ROUTE-03, ROUTE-04, ROUTE-05, ROUTE-06, ROUTE-07, ROUTE-08, ROUTE-09, ROUTE-10, ROUTE-11, ROUTE-12, ROUTE-13, ROUTE-14, ROUTE-15, ROUTE-16, VAL-05, ERR-02 (extension: `<topic>.failed`, `network.error`), SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, TEST-01 (route HTTP subset), TEST-02 (plugin → server → plugin), TEST-03 (server malconfigurato), DOC-04

**Success Criteria** (what must be TRUE):
  1. Lo scenario meteo PRD §29 estende F2 con HTTP: `weather.requested` (canonico `{location, forecast_date}`) attiva la route `weather-http`, genera `GET /api/weather?location=Roma&date=2026-04-30` (queryMap canonico→server), riceve la response, la mappa server→canonical (`temp→temperature_celsius`, `condition→weather_condition`, `city→location`, `date→forecast_date`), e pubblica `weather.loaded` come BrokerEvent canonico — verificato con `msw`.
  2. Errore HTTP ≥ 400 pubblica automaticamente `weather.failed` con `BrokerError` (`code`, `message`, `category: 'network'`, `routeId`, `topic`, `eventId`, `originalError`); errori 4xx (eccetto 408/429) NON vengono retry, errori 5xx + 408/429 + network errors vengono retry con backoff esponenziale + full jitter fino a `maxAttempts: 3` (default), rispettando `Retry-After` quando presente.
  3. Open issue PRD §39 chiusi in F3 sono verificabili da test: ROUTE-09 (retry 4xx vs 5xx come specificato sopra); ROUTE-15 (più route applicabili: tre policy `'first-match'` default + warning dev mode, `'priority-ordered'`, `'all'`); ROUTE-16 (topic senza route: default consegna locale ai subscriber, opt-in `requiresRoute: true` nel topic schema per forzare errore); LIFE-02 (unregister plugin rimuove anche le route registrate dal plugin in cascata).
  4. Concurrency policy `'latest-only'` su una route HTTP UI-driven: due `weather.requested` consecutivi con location differente → l'AbortController della prima fetch viene chiamato, solo la response della seconda viene pubblicata come `weather.loaded`; `dedupeKey` esplicito su una route collassa due request identiche in una sola fetch.
  5. Server Gateway centralizza header auth (Bearer token via hook adapter, refresh token via hook configurabile); URL allowlist rifiuta endpoint non consentiti; backpressure (`queue bounded`, `drop`, `throttle`, `debounce`, `latest-only`, `merge/coalesce`) configurabile per route — eventi `priority: 'critical'` (es. `system.error`) non vengono mai droppati.

**Plans**: TBD
**Needs research**: yes
**UI hint**: no

---

### Phase 4: Realtime inbound (SSE prioritario, WS opzionale)

**Goal**: Esiste almeno un canale realtime inbound dal server attivabile via `connectRealtime()`/`disconnectRealtime()`; SSE è l'adapter prioritario V1 (più semplice e robusto per server → browser, PRD §18.4), WebSocket è disponibile come adapter alternativo; i messaggi server vengono normalizzati in `BrokerEvent` canonici con `source: { type: 'server', id: 'realtime-channel', name: 'sse' | 'websocket' }`; la reconnection policy gestisce backoff con jitter, heartbeat applicativo, stale detection e visibility-aware behavior.

**Scope (cross-cutting estesi in F4)**: pipeline §28 — i messaggi server entrano alla pipeline al passo 1 (ingress) come fossero pubblicazioni esterne, attraversano canonicalizzazione e validazione regolari. Errori: `ERR-02` esteso a `system.realtime.disconnected`, `system.realtime.reconnecting`, `system.realtime.connected`. Test: `TEST-01` (realtime normalization), `TEST-02` (reconnect realtime), `TEST-03` (riconnessione ripetuta).

**Package monorepo**: `@sembridge/gateway/realtime` (SSE adapter, WebSocket adapter, RealtimeChannelManager)

**Stack chiave**: `EventSource` nativo + `WebSocket` nativo (no `reconnecting-websocket`, no `eventsource-polyfill`); `Last-Event-ID` per replay SSE; ping/pong applicativo per WebSocket + stale detection via timeout; exponential backoff full-jitter con cap 30s; visibility API integration per pausare reconnect aggressivo quando tab è hidden

**Depends on**: Phase 1 (broker, BrokerEvent, EventTap), Phase 2 (mapper server→canonical per normalizzare payload inbound). **Parallelizzabile** con Phase 5 (le due fasi sono ortogonali tra loro).

**Requirements**:
RT-01, RT-02, RT-03, RT-04, RT-05, RT-06, RT-07, ERR-02 (extension: `system.realtime.*`), TEST-01 (realtime subset), TEST-02 (reconnect), TEST-03 (riconnessione ripetuta)

**Success Criteria** (what must be TRUE):
  1. Un messaggio SSE inbound da `/events` (es. `event: weather.update\ndata: {"city": "Roma", "temp": 22}\n`) viene convertito in `BrokerEvent` interno con `topic: "weather.update"`, `source: { type: 'server', id: 'realtime-channel', name: 'sse' }`, payload normalizzato in canonico tramite mapper server→canonical, e consegnato ai subscriber locali del topic.
  2. Disconnessione realtime (server reboot simulato) pubblica `system.realtime.disconnected` con `BrokerError`; il client riconnette automaticamente con exponential backoff full-jitter (cap 30s), invia `Last-Event-ID` per il replay degli eventi mancati su SSE; al successo pubblica `system.realtime.connected` (chiusura PRD §39 punto 9 — RT-07).
  3. WebSocket adapter (se attivato in V1) usa ping/pong applicativo con timeout di stale detection: se non riceve pong entro `staleTimeoutMs`, considera la connessione morta e riconnette — il `readyState=OPEN` non viene assunto come prova di salute.
  4. Tab in background: il timer heartbeat è soggetto a throttling browser; il client riconosce questa condizione via Visibility API e su `visibilitychange → visible` forza un check di freschezza prima di considerare la connessione viva.
  5. `connectRealtime(config)` accetta `{ mode: 'sse' | 'websocket', url, reconnect: { interval, maxAttempts, backoff, jitter, heartbeat, staleDetection } }`; `disconnectRealtime()` chiude il canale e libera tutte le risorse senza memory leak (verificato con `getDebugSnapshot()`).

**Plans**: TBD
**Needs research**: yes
**UI hint**: no

---

### Phase 5: Worker Runtime

**Goal**: Esiste un Worker Registry che gestisce worker dedicati o pool con riuso; la route `worker` delega un task a un worker correlato via `correlationId`; il worker riceve payload canonico, ritorna `success`/`progress`/`error` come BrokerEvent canonici (`<topic>.completed`, `<topic>.progress`, `<topic>.failed`); timeout, cancellazione e propagazione errori sono first-class; la serializzazione messaggi worker è documentata (structuredClone default, transferable opt-in).

**Scope (cross-cutting estesi in F5)**: pipeline §28 — la route worker estende lo step 9 (execute route) con dispatch al worker. Errori: `ERR-02` esteso a `worker.error`. Test: `TEST-01` (route worker, lifecycle cleanup MessageChannel), `TEST-02` (plugin → broker → worker → broker → plugin), `TEST-03` (worker timeout).

**Package monorepo**: `@sembridge/worker` (Worker Registry, Worker Pool, WorkerBridge, task tracker)

**Stack chiave**: `Comlink` 4.4.x per RPC typed (~1.1 KB gzipped) con astrazione `WorkerBridge` interna per swap futuro; `structuredClone` nativo come default serializer; `superjson` opt-in via adapter quando servono Date/Map/Set/BigInt fuori SCA; pool bounded `min(hardwareConcurrency, 4)`; validatore `assertSerializable` pre-postMessage in dev mode; state machine atomico task `{pending → done | timeout | error}` (transizioni esclusive con `taskId` lookup) per chiusura race condition timeout vs success

**Depends on**: Phase 1 (broker, EventTap, BrokerError), Phase 2 (mapper canonicalizza il payload prima del dispatch — PRD §19.4 step 3). **Parallelizzabile** con Phase 4.

**Requirements**:
WK-01, WK-02, WK-03, WK-04, WK-05, WK-06, WK-07, ERR-02 (extension: `worker.error`), TEST-01 (worker subset), TEST-02 (plugin → worker → plugin), TEST-03 (worker timeout)

**Success Criteria** (what must be TRUE):
  1. Una route `worker` (es. `{ type: 'worker', on: 'report.generation.requested', worker: 'report-worker', task: 'generateReport', publishes: { success: 'report.generation.completed', error: 'report.generation.failed' } }`) intercetta il topic, canonicalizza il payload, dispatcha al worker pool correlato, e al completamento pubblica `report.generation.completed` come BrokerEvent canonico.
  2. Errore worker (eccezione, payload non serializzabile, task non registrato) pubblica `worker.error` E `<topic>.failed` con `BrokerError` (`category: 'worker'`, `details` con worker id e task name); race timeout vs success è risolta dallo state machine atomico — solo una delle due transizioni `timeout` o `success` viene pubblicata (chiusura Pitfall 2C).
  3. Open issue PRD §39 chiuso in F5: WK-07 (serializzazione messaggi worker) — structured clone standard documentato come default, `transferable: ['fieldA']` opt-in nel route descriptor, `function` non consentite (usare `transformId` registrato lato worker), validatore `assertSerializable` pre-postMessage in dev mode con error message esplicito su `DataCloneError`.
  4. Worker pool bounded `min(hardwareConcurrency, 4)` con riuso; `MessageChannel` chiusi esplicitamente al termine di ogni task (no leak); cancellazione task via `AbortSignal` propagato fino a `WorkerBridge.cancel(taskId)`; timeout configurabile per task — verificato con `getDebugSnapshot()` post-task: counter `workerTasks` torna a zero.
  5. Eventi `<topic>.progress` opzionali: il worker può emettere progress fraction (0..1) durante l'esecuzione, propagati come BrokerEvent canonici al subscriber.

**Plans**: TBD
**Needs research**: yes
**UI hint**: no

---

### Phase 6: Cache & Tooling avanzato

**Goal**: Esiste una cache layer con `MemoryCacheAdapter` di default, chiave configurabile per route/topic, TTL e invalidazione manuale/automatica, scope user-aware obbligatorio per route auth; il metadata di consegna distingue origine `cache` vs `remote`. Il developer tooling è completo: Event Inspector mostra il ciclo di vita di ogni evento attraverso i 14 step di pipeline (`EventTap` instrumentato in F1 si attiva con implementazione reale), Route Inspector mostra route intercettate + policy + esito, MetricsCollector espone `getMetrics()` con counter/gauge/histogram, controlli `pauseTopic`/`resumeTopic`/`flushQueue`, `enableDebug`/`disableDebug`.

**Scope (cross-cutting estesi in F6)**: pipeline §28 — step 14 (logging/metrics/debug snapshot) attivato come implementazione reale dello `EventTap` predisposto in F1. Test: `TEST-01` (cache hit/miss, lifecycle cleanup), `TEST-02` (cache hit/miss flows). Docs: `DOC-02`, `DOC-05` (esempi end-to-end incluso scenario meteo §29 con cache + tooling), `DOC-06`. Tutti i `DOC-*` consolidati a fine F6 come deliverable PRD §41.

**Package monorepo**: `@sembridge/cache` (MemoryCacheAdapter, policies); `@sembridge/devtools` (Event Inspector, Route Inspector, MetricsCollector, snapshot API). `@sembridge/cache-idb` rimandato a V1.x.

**Stack chiave**: cache LRU + TTL + scope key in-memory; `size-limit` come CI gate (core < 8 KB gz, gateway < 6 KB, mapper < 5 KB); metrics in formato JSON-serializable simil-OpenMetrics (`{ counters, gauges, histograms }`); debug mode auto-off in production con guard `NODE_ENV`

**Depends on**: Phase 1 (EventTap predisposto), Phase 2 (mapper per Inspector che mostra payload originale/canonico/finale), Phase 3 (routing engine: cache route si appoggia al motore di routing per chiave + policy)

**Requirements**:
CACHE-01, CACHE-02, CACHE-03, TOOL-01, TOOL-02, TOOL-03, TOOL-04, TOOL-05, TEST-01 (cache subset, devtools subset), TEST-02 (cache hit/miss), DOC-02, DOC-05, DOC-06 (consolidamento finale di tutti i DOC-*)

**Success Criteria** (what must be TRUE):
  1. Una route `cache-then-network` su `weather.requested` pubblica due eventi `weather.loaded` consecutivi: il primo con `metadata.origin: 'cache'` (servito immediatamente dalla cache se hit), il secondo con `metadata.origin: 'remote'` (dopo che la fetch ha aggiornato la cache); il consumer può discriminare i due tramite metadata.
  2. Event Inspector espone per ogni evento: topic, publisher, timestamp, payload originale, payload canonico, payload finale per ciascun consumer, subscriber raggiunti, route attivate, esito (success/error/skipped/cached), errori, tempi per step di pipeline (14 step PRD §28); il Route Inspector mostra retry effettuati, cache hit/miss, policy applicate.
  3. Open issue PRD §39 chiuso in F6: TOOL-05 (formato metriche) — `getMetrics()` ritorna struttura JSON-serializable simil-OpenMetrics `{ counters: {...}, gauges: {...}, histograms: {...} }` con metriche standard documentate (eventi/sec, eventi scartati, errori per categoria, tempi medi route HTTP/worker, cache hit ratio, subscriber per topic, backlog per topic/queue).
  4. Controlli runtime funzionanti: `pauseTopic('weather.requested')` mette in pausa la route per il topic (gli eventi vengono accodati), `resumeTopic` riprende il flusso, `flushQueue('weather.requested')` svuota la queue; `enableDebug()` attiva tutti gli Inspector e i tap reali, `disableDebug()` torna alle implementazioni no-op (zero overhead in production).
  5. Cache invalidation con scope user-aware: la chiave di cache include scope (es. `userId` o `tenantId`) per route auth, evitando cross-tenant leakage; TTL configurabile per route, invalidazione manuale via API (`broker.cache.invalidate(keyOrPattern)`) e automatica al passare del TTL — verificato da `TEST-02` (cache hit/miss flows) e da test di robustezza.

**Plans**: TBD
**Needs research**: no
**UI hint**: no

---

## Dependencies Graph

```
Phase 1 (root, no deps)
  ├── Phase 2 (canonical model + mapper)
  │     ├── Phase 3 (routing + HTTP gateway)
  │     │     └── Phase 6 (cache + tooling)
  │     ├── Phase 4 (realtime SSE/WS) ─┐ parallelizable
  │     └── Phase 5 (worker runtime)  ─┘
  │
  └── EventTap interface (predisposta in F1, implementata in F6)
```

**Parallelization opportunities** (`parallelization=true` in config):
- Phase 4 e Phase 5 sono ortogonali e possono essere eseguite in parallelo dopo F3
- Documentazione (`DOC-*`) viene scritta progressivamente in ogni fase ma consolidata in F6
- Test cross-cutting (`TEST-01`, `TEST-02`, `TEST-03`) crescono in parallelo con le fasi che testano

**Critical path**: F1 → F2 → F3 → F6 (la cache route in F6 dipende dal routing engine F3 e tutti i DOC consolidano in F6)

## Cross-Cutting Strategy

I requisiti cross-cutting (`VAL-*`, `ERR-*`, `PIPE-*`, `LIFE-*`, `SEC-*`, `TEST-*`, `PKG-*`, `DOC-*`) si distribuiscono su più fasi. La tabella di traceability in `REQUIREMENTS.md` mappa la **prima fase** in cui il requisito appare; le fasi successive estendono lo stesso requisito senza duplicare l'ID.

| Cross-cutting | Fase di prima introduzione | Fasi che estendono |
|---------------|---------------------------|---------------------|
| PIPE-01 (pipeline §28 14 step) | F1 (skeleton step 1, 2, 3, 7-base, 13) | F2 (4, 5, 6, 11, 12), F3 (7-full, 8, 9, 10), F6 (14 reale) |
| VAL-01..VAL-09 | F1 (VAL-01, VAL-06), F2 (VAL-02..VAL-04, VAL-07..VAL-09), F3 (VAL-05) | — |
| ERR-01, ERR-03 | F1 | — |
| ERR-02 (eventi standard) | F2 (`mapping.error`), F3 (`<topic>.failed`, `network.error`), F4 (`system.realtime.*`), F5 (`worker.error`) | — |
| LIFE-01, LIFE-02 | F1 | F4 (cleanup realtime), F5 (cleanup MessageChannel worker) |
| SEC-01..SEC-05 | F3 | — |
| TEST-01 | F1 (subset), F2-F6 estendono | — |
| TEST-02 | F2 (plugin↔plugin), F3 (plugin↔server), F5 (plugin↔worker), F6 (cache flows) | F4 (reconnect) |
| TEST-03 | F1 (storm + plugin malconfigurato), F3 (server malconfigurato), F4 (riconnessione ripetuta), F5 (worker timeout) | — |
| PKG-01..PKG-04 | F1 (setup monorepo, ESM build, .d.ts, target evergreen) | F2-F6 aderiscono |
| DOC-01..DOC-06 | F1 (DOC-01 skeleton), F2 (DOC-03), F3 (DOC-04), F6 (consolidamento DOC-02, DOC-05, DOC-06) | — |

## Open Issues PRD §39 — Map to Phases

I 11 punti che il PRD §39 vieta esplicitamente di lasciare impliciti vengono chiusi nelle fasi indicate (cfr. SUMMARY.md tabella consolidata):

| # | Open Issue PRD §39 | Decisione | Fase di chiusura |
|---|--------------------|-----------|------------------|
| 1 | Precedenza alias automatici vs mapping esplicito | Mapping esplicito vince sempre (MAP-17) | F2 |
| 2 | Ordine pipeline mapping/validazione | Pipeline §28.1 14 step, single-pass testabile | F1 (skeleton) + F2 (mapping) + F3 (route) + F6 (tap reale) |
| 3 | Field mancante: errore o default | Configurabile per campo (`required: true`/`false`) | F2 (VAL-08) |
| 4 | Transform failure: skip o block | `onFailure: 'block' | 'skip' | 'fallback'`, default `'block'` | F2 (VAL-09) |
| 5 | Topic senza route | Default consegna locale, opt-in `requiresRoute: true` | F3 (ROUTE-16) |
| 6 | Più route applicabili | `'first-match'` default + `'priority-ordered'` + `'all'` | F3 (ROUTE-15) |
| 7 | Unsubscribe automatico in `unregisterPlugin` | Cascade obbligatoria, test deterministico | F1 (LIFE-02) — **Closed in 01-08** |
| 8 | Retry 4xx vs 5xx | No retry su 4xx (eccetto 408/429); retry su 5xx + network + 408/429 | F3 (ROUTE-09) |
| 9 | Reconnection rules realtime | Exponential backoff + full jitter, cap 30s, eventi `system.realtime.*`, Last-Event-ID per SSE, ping app-level per WS | F4 (RT-07) |
| 10 | Format metriche | JSON simil-OpenMetrics `{ counters, gauges, histograms }` | F6 (TOOL-05) |
| 11 | Serializzazione messaggi worker | structuredClone default, transferable opt-in, no functions, `assertSerializable` dev mode | F5 (WK-07) |

## Architectural Constraints (vincolanti per la roadmap)

1. **`EventTap` instrumentato in F1**: l'interfaccia `EventTap.onPipelineStep(step, snapshot)` deve esistere già in F1 con implementazione no-op. F2-F5 estendono la pipeline aggiungendo step e chiamate `tap.onPipelineStep` riusando lo stesso contratto. F6 sostituisce il no-op con l'implementazione reale (Inspector + Metrics). **Aggiungere il Tap in F6 retroattivamente significherebbe toccare ogni filtro già implementato → retrofit doloroso, regression risk** (riferimento ARCHITECTURE.md §3.2 + SUMMARY.md "Vincolo critico architetturale").

2. **Canonicalizzazione interna completa V1 (PRD §13.5)**: i dati transitano sempre canonicalizzati internamente tra Broker, Routing, Cache, Worker. La traduzione inversa `canonical → consumer` avviene solo all'ultimo miglio (step 11 della pipeline, una volta per consumer). Conseguenza: la cache (F6) memorizza payload canonici, lo stesso cache hit serve diversi consumer con `inputMap` differenti.

3. **Monorepo `pnpm` workspaces dal giorno 1**: i 7 sotto-pacchetti (`@sembridge/core`, `mapper`, `gateway`, `worker`, `cache`, `devtools`, `routing` + bundle pubblico aggregato `@sembridge/sembridge`) sono già creati come scheletri in F1 e popolati dalle fasi successive. Il consumer importa `@sembridge/sembridge` o sotto-pacchetti specifici per tree-shaking esplicito.

4. **Profile model `claude-opus-4-7-1`**: tutti i sotto-agenti GSD (planner, builder, verifier, code-reviewer) usano questo modello — vincolo utente di sessione.

5. **Lingua italiana**: tutta l'interazione utente (output utente, commenti di alto livello in REQUIREMENTS/PROJECT/ROADMAP/STATE) è in italiano. Codice, identificatori, REQ-ID, nomi di file, nomi di package, log message rimangono in inglese.

## Coverage Summary

- **v1 requirements totali**: 91
- **Mappati a una fase**: 91
- **Orfani**: 0
- **Phase distribution**: F1=27 · F2=23 · F3=23 · F4=10 · F5=10 · F6=12 (cross-cutting `TEST-01..03`, `DOC-01..06`, `PKG-01..04`, `PIPE-01`, `VAL-*`, `ERR-*`, `LIFE-*`, `SEC-*` distribuiti come da tabella sopra; il count primario è quello delle famiglie principali per fase)

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core essenziale | 8/11 | In progress | - |
| 2. Canonical Model & Mapper | 0/0 | Not started | - |
| 3. Routing & Server Gateway HTTP | 0/0 | Not started | - |
| 4. Realtime inbound | 0/0 | Not started | - |
| 5. Worker Runtime | 0/0 | Not started | - |
| 6. Cache & Tooling avanzato | 0/0 | Not started | - |

---

*Roadmap created: 2026-04-28*
*Last updated: 2026-04-28 after Wave 5 closure (Plan 01-08 Broker + plugin-registry + public API done; 12 Test Files / 191 Tests passing; build OK)*
