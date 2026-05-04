# Requirements: SemBridge

**Defined:** 2026-04-28
**Core Value:** I plugin/componenti possono essere sviluppati indipendentemente, con la propria nomenclatura locale, e interoperare correttamente attraverso il vocabolario canonico del broker — senza accordo preventivo sui nomi tra autori.

**Fonte autoritativa:** `prd.md` (root). Tutti i REQ-ID hanno riferimento esplicito alle sezioni del PRD.

## v1 Requirements

Tutti i requisiti elencati sono table stakes (vincolanti dalla checklist PRD §42 + sezione §33.2 "non lasciate alla discrezione del developer"). Nessun differenziatore opzionale è incluso in v1: il PRD descrive una sola release base con i comportamenti richiesti.

### Core Broker (Fase 1)

- [x] **CORE-01**: Esiste un event bus pub/sub in-page con `publish(topic, payload, options?)` e `subscribe(topic, handler, options?)` *(PRD §16.2, §42)*
- [x] **CORE-02**: `subscribe` restituisce un handle/subscriptionId che permette `unsubscribe(subscriptionId)` senza effetti residui *(PRD §24.2, §36.1)*
- [x] **CORE-03**: Topic Registry pubblica/traccia tutti i topic noti via `getTopicRegistry()` *(PRD §10, §16.3)*
- [x] **CORE-04**: Plugin Registry: `registerPlugin(descriptor)` e `unregisterPlugin(id)` *(PRD §15, §16.2)*
- [x] **CORE-05**: Lifecycle hooks plugin: `onRegister`, `onMount`, `onUnmount`, `onDestroy` *(PRD §15.5)*
- [x] **CORE-06**: Ogni evento rispetta la struttura `BrokerEvent` (id, topic, timestamp, source, payload, metadata, correlationId, causationId, traceId, schemaVersion, deliveryMode, priority, ttlMs, dedupeKey) *(PRD §11.1)*
- [x] **CORE-07**: `id` evento univoco; `timestamp` valorizzato dal broker se assente; `source` obbligatorio e noto al runtime *(PRD §11.3)*
- [x] **CORE-08**: Naming convention dot-separated minuscolo per topic; pattern `<entity>.<action>.<status>` documentato *(PRD §12.1, §12.2)*
- [x] **CORE-09**: Wildcard subscribe (`weather.*`, `*.failed`, `form.customer.*`) *(PRD §12.3)*
- [x] **CORE-10**: Logging configurabile con livelli `silent | error | warn | info | debug | trace` *(PRD §25.4)*
- [x] **CORE-11**: Unsubscribe automatico quando un plugin viene unregistered (no memory leak) *(PRD §15.6, §24.2)*
- [x] **CORE-12**: Plugin handler isolato: eccezione in un plugin non collassa il broker *(PRD §22.2)*
- [x] **CORE-13**: `EventTap` interface instrumentata già in F1 (anche con implementazione no-op) per consentire Inspector in F6 senza retrofit *(decisione architetturale ARCHITECTURE.md §3.2)*
- [x] **CORE-14**: Configurazione globale via `createBroker(config)` con sezioni `runtime`, `topicSchemas`, `canonicalModel`, `aliasRegistry`, `transforms`, `routes`, `transport`, `workers`, `debug`, `cache` *(PRD §27)*

### Canonical Model + Mapper (Fase 2)

- [x] **MAP-01**: Canonical Vocabulary Registry con campi canonici tipizzati e alias riconosciuti *(PRD §13.3)*
- [x] **MAP-02**: `registerCanonicalSchema(schemaDefinition)` per registrare schemi canonici *(PRD §16.2)*
- [x] **MAP-03**: Plugin dichiarano `inputMap` e `outputMap` per mapping locale ↔ canonico *(PRD §15.2)*
- [x] **MAP-04**: Mapper supporta rename semplice *(PRD §14.2.1)*
- [x] **MAP-05**: Mapper supporta mapping nested *(PRD §14.2.2)*
- [x] **MAP-06**: Mapper supporta default values *(PRD §14.2.3)*
- [x] **MAP-07**: Mapper supporta trasformazioni di formato (es. `parseItalianDate`) *(PRD §14.2.4, §14.4)*
- [x] **MAP-08**: Mapper supporta normalizzazione unità di misura *(PRD §14.2.5)*
- [x] **MAP-09**: Mapper supporta derivazione di campo (`$derive` da campi multipli con transform) *(PRD §14.2.6, §14.5)*
- [x] **MAP-10**: Mapper supporta mapping parziale *(PRD §14.2.7)*
- [x] **MAP-11**: Validazione post-mapping integrata *(PRD §14.2.8, §21.2.4)*
- [x] **MAP-12**: `registerTransform(name, fn)` per trasformazioni custom; pipeline con gestione errori e fallback *(PRD §14.6, §16.2)*
- [x] **MAP-13**: Default V1 — canonicalizzazione interna completa: i dati transitano canonicalizzati internamente *(PRD §13.5)*
- [x] **MAP-14**: Mapping bidirezionale canonico → locale plugin in consegna ai consumer *(PRD §14.1)*
- [x] **MAP-15**: Mapping Inspector: payload originale, canonico, finale, trasformazioni applicate, warning di ambiguità, errori *(PRD §14.8, §25.2)*
- [x] **MAP-16**: Warning runtime quando un alias è potenzialmente ambiguo *(PRD §14.7)*
- [x] **MAP-17**: Il mapping esplicito dichiarato dal plugin prevale sempre sugli alias automatici *(PRD §14.7, §39 — open issue da chiudere)*

### Routing Engine + Server Gateway HTTP (Fase 3)

- [x] **ROUTE-01**: `registerRoute(routeDefinition)` e `unregisterRoute(routeId)` *(PRD §16.2)*
- [x] **ROUTE-02**: Tipo route `local` (consegna a subscriber interni) *(PRD §17.2, §17.3)*
- [x] **ROUTE-03**: Tipo route `http` con `request` (method, url, queryMap, bodyMap), `publishes.success`, `publishes.error` *(PRD §17.2, §17.4)*
- [x] **ROUTE-04**: Tipo route `cache` (cache-first/network-first/cache-then-network) *(PRD §17.2, §17.6, §20.2)*
- [x] **ROUTE-05**: Tipo route `composite` (workflow check-cache → server → update-cache → publish) *(PRD §17.2, §17.7)*
- [x] **ROUTE-06**: Server Gateway centralizza tutte le richieste fetch/AJAX *(PRD §18.1, §18.2)*
- [x] **ROUTE-07**: Header auth gestiti centralmente; supporto a token refresh tramite hook/adapter *(PRD §26.2)*
- [x] **ROUTE-08**: Policy per route: timeout, retry con backoff esponenziale opzionale, dedupe, cache, concurrency, error, mapping, auth *(PRD §17.8)*
- [x] **ROUTE-09**: Differenziazione retry su errori 4xx (no retry default) vs 5xx (retry con backoff) — comportamento esplicito *(PRD §39 — open issue da chiudere)*
- [x] **ROUTE-10**: Backpressure: queue bounded, drop policy, throttle, debounce, latest-only, merge/coalesce *(PRD §23.3)*
- [x] **ROUTE-11**: Deduplica via `dedupeKey` o logica route-specific *(PRD §11.3, §23.4)*
- [x] **ROUTE-12**: Pubblicazione automatica eventi `<topic>.failed` su errore route remota *(PRD §22.3, §29.4)*
- [x] **ROUTE-13**: Cancellazione/invalidazione semantica per task lunghi o richieste obsolete *(PRD §23.5)*
- [x] **ROUTE-14**: Route Inspector: route intercettata, policy applicate, esito remote/worker, retry, cache hit/miss *(PRD §25.3)*
- [x] **ROUTE-15**: Comportamento esplicito con più route applicabili allo stesso topic (priorità documentata) *(PRD §39 — open issue da chiudere)*
- [x] **ROUTE-16**: Comportamento esplicito con topic senza route (consegna locale o errore esplicito) *(PRD §39 — open issue da chiudere)*

### Realtime Inbound (Fase 4)

- [ ] **RT-01**: Adapter SSE (`Server-Sent Events`) per inbound server → browser *(PRD §18.2, §18.3)*
- [ ] **RT-02**: Adapter WebSocket (in V1 almeno uno tra SSE e WS deve essere disponibile e funzionante) *(PRD §18.2)*
- [ ] **RT-03**: `connectRealtime()` e `disconnectRealtime()` API pubbliche *(PRD §16.2)*
- [ ] **RT-04**: Messaggi server convertiti in eventi interni con `source: { type: 'server', id: 'realtime-channel', name: 'sse'|'websocket' }` *(PRD §18.5)*
- [ ] **RT-05**: Reconnection policy configurabile: retry interval, exponential backoff, max retry, heartbeats, stale connection detection, jitter *(PRD §18.6)*
- [ ] **RT-06**: Normalizzazione payload inbound dal server verso il modello canonico *(PRD §18.1)*
- [ ] **RT-07**: Regole di riconnessione realtime documentate (Last-Event-ID per SSE, ping app-level per WS) *(PRD §39 — open issue da chiudere)*

### Worker Runtime (Fase 5)

- [ ] **WK-01**: Worker Registry con creazione/riuso di worker dedicati o pool *(PRD §19.3)*
- [ ] **WK-02**: Tipo route `worker` con `worker`, `task`, `publishes.success`, `publishes.error` *(PRD §17.2, §17.5)*
- [ ] **WK-03**: Task correlation (correlazione task ↔ evento risultante) *(PRD §19.3)*
- [ ] **WK-04**: Propagazione errori worker → broker tramite eventi *(PRD §19.3, §22.3)*
- [ ] **WK-05**: Pubblicazione eventi `<topic>.completed`, `<topic>.progress`, `<topic>.failed` *(PRD §12.2, §19.4)*
- [ ] **WK-06**: Timeout task configurabile e cancellazione task *(PRD §19.3)*
- [ ] **WK-07**: Serializzazione messaggi worker documentata (formato + contratto, structuredClone vs transferable) *(PRD §39 — open issue da chiudere)*

### Cache + Tooling Avanzato (Fase 6)

- [ ] **CACHE-01**: Cache in-memory con chiave configurabile per route/topic *(PRD §20.2)*
- [ ] **CACHE-02**: TTL configurabile e invalidazione manuale/automatica *(PRD §20.2)*
- [ ] **CACHE-03**: Metadata di consegna distingue origine `cache` vs `remote` *(PRD §20.2, §20.4)*
- [ ] **TOOL-01**: Event Inspector completo: topic, publisher, timestamp, payload originale/canonico, subscriber raggiunti, route attivate, esito, errori, tempi *(PRD §25.1)*
- [ ] **TOOL-02**: Metrics: eventi/sec, eventi scartati, errori per categoria, tempi medi route HTTP/worker, cache hit ratio, subscriber per topic, backlog *(PRD §25.5)*
- [ ] **TOOL-03**: `enableDebug()` / `disableDebug()` / `getDebugSnapshot()` *(PRD §16.2, §16.3)*
- [ ] **TOOL-04**: `pauseTopic(topic)` / `resumeTopic(topic)` / `flushQueue(topic?)` *(PRD §16.3)*
- [ ] **TOOL-05**: Format delle metriche documentato esplicitamente *(PRD §39 — open issue da chiudere)*

### Cross-cutting (vincoli applicati su tutte le fasi)

#### Validazione & Schema
- [x] **VAL-01**: Validazione sintattica dell'evento (struttura `BrokerEvent`) *(PRD §21.2.1)*
- [ ] **VAL-02**: Validazione payload topic *(PRD §21.2.2)*
- [x] **VAL-03**: Validazione modello canonico *(PRD §21.2.3)*
- [x] **VAL-04**: Validazione post-mapping *(PRD §21.2.4)*
- [x] **VAL-05**: Validazione risposta server *(PRD §21.2.5)*
- [x] **VAL-06**: Schema definitions JSON Schema o equivalente tipizzato *(PRD §21.3)*
- [x] **VAL-07**: Errori di validazione registrati in debug/log; payload invalidi non consegnati salvo configurazione esplicita *(PRD §21.4)*
- [x] **VAL-08**: Comportamento esplicito su field mancante (errore vs default) *(PRD §39 — open issue da chiudere)*
- [x] **VAL-09**: Comportamento esplicito su transform failure (skip vs block) *(PRD §39 — open issue da chiudere)*

#### Errori
- [x] **ERR-01**: Tipo `BrokerError` con `code`, `message`, `category`, `details`, `originalError`, `routeId`, `topic`, `eventId` *(PRD §22.4)*
- [x] **ERR-02**: Eventi standard di errore: `<topic>.failed`, `system.error`, `mapping.error`, `worker.error`, `network.error` *(PRD §22.3)*
- [x] **ERR-03**: Errori isolati: il runtime non collassa salvo guasto critico non recuperabile *(PRD §22.2)*

#### Pipeline & Lifecycle
- [x] **PIPE-01**: Pipeline ufficiale §28.1 implementata coerentemente in tutte le fasi (14 step documentati) *(PRD §28)*
- [x] **LIFE-01**: Subscribe ritorna handle; plugin registrati possono essere smontati senza leak; listener realtime/worker chiudibili *(PRD §24.2)*
- [x] **LIFE-02**: Unregister plugin rimuove subscription, handler e risorse collegate *(PRD §24.2, §39 — open issue da chiudere)*

#### Sicurezza
- [x] **SEC-01**: Header auth centralizzati nel gateway *(PRD §26.2)*
- [x] **SEC-02**: Token refresh via hook/adapter configurabile *(PRD §26.2)*
- [x] **SEC-03**: Protezione da duplicazioni accidentali di chiamate *(PRD §26.2)*
- [x] **SEC-04**: Gestione uniforme di status HTTP non validi *(PRD §26.2)*
- [x] **SEC-05**: Controllo sugli endpoint consentiti (URL allowlist) *(PRD §26.2)*

#### Test
- [x] **TEST-01**: Unit test su pub/sub, unsubscribe, wildcard, mapping, reverse mapping, trasformazioni, dedupe, retry/timeout, route HTTP, route worker, realtime normalization, lifecycle cleanup *(PRD §35.1)*
- [x] **TEST-02**: Integration test: plugin A → broker → plugin B con mapping diverso; plugin → broker → server → broker → plugin; plugin → broker → worker → broker → plugin; cache hit/miss; reconnect realtime; error propagation completa *(PRD §35.2)*
- [x] **TEST-03**: Test di robustezza: storm di eventi, plugin mal configurato, server con schema inatteso, worker timeout, riconnessione ripetuta, topic con molti subscriber *(PRD §35.3)*

#### Packaging & Documentazione
- [x] **PKG-01**: Distribuzione ESM (UMD/IIFE opzionale per pagine legacy) *(PRD §31.1)*
- [x] **PKG-02**: TypeScript come linguaggio di sviluppo, build distribuibile in JavaScript compilato *(PRD §31.2)*
- [x] **PKG-03**: Target browser moderni evergreen; polyfill separati dal core *(PRD §31.3)*
- [x] **PKG-04**: Type declarations (.d.ts) generate per API pubblica *(implicito PRD §31.2)*
- [x] **DOC-01**: Documentazione API pubblica *(PRD §41.3)*
- [ ] **DOC-02**: Guida integrazione plugin *(PRD §41.4)*
- [x] **DOC-03**: Documentazione canonical model + mapper *(PRD §41.5)* — skeleton README iniziale in 02-01; completamento finale al plan 02-12 (scenario meteo end-to-end, JSDoc API pubblica)
- [x] **DOC-04**: Documentazione route engine + server gateway *(PRD §41.6)*
- [ ] **DOC-05**: Esempi end-to-end (incluso scenario meteo PRD §29) *(PRD §41.8)*
- [ ] **DOC-06**: Documentazione debug tooling *(PRD §41.9)*

## v2 Requirements

Funzionalità non vincolanti dal PRD, candidate a release successive:

### Realtime esteso
- **RT2-01**: Bridge Service Worker / Push notification per use case oltre la vita della singola pagina *(PRD §18.3, §18.7)*

### Cache esteso
- **CACHE2-01**: Adapter IndexedDB per persistenza browser-side *(PRD §20.3)*

### Composite & Worker avanzati
- **WK2-01**: Worker pool autoscaling con strategia configurabile (dedicato vs pool dinamico) *(STACK.md gap)*
- **MAP2-01**: Adapter validation alternativi (Zod, Ajv) oltre a Valibot di default *(STACK.md gap)*

## Out of Scope

Esclusioni esplicite. Documentate per prevenire scope creep.

| Feature | Motivazione |
|---------|-------------|
| Framework UI completo (React/Vue/Angular sostitutivo) | Esplicitamente escluso PRD §5: la libreria si integra con framework UI ma non li sostituisce |
| State manager globale stile Redux come unica via | Esplicitamente escluso PRD §5 |
| Esecuzione logica server-side | Esplicitamente escluso PRD §5: la libreria è browser-side |
| Motore BPMN / workflow visual designer | Esplicitamente escluso PRD §5 |
| Mapping semantico ambiguo automatico senza configurazione esplicita | Esplicitamente escluso PRD §5, §14.7: il mapping esplicito del plugin prevale sempre |
| Accesso DOM dai worker | Vincolo browser, non aggirabile (PRD §5, §19.5) |
| Service Worker / Push V1 | Rimandato a release successive (PRD §18.3, §18.7) — vedi RT2-01 |
| IndexedDB persistence V1 | Opzionale per V1 (PRD §20.3) — vedi CACHE2-01 |
| Benchmark numerici rigidi | PRD §34.2: obiettivi qualitativi, non soglie numeriche |
| Autenticazione/Authorization come responsabilità della libreria | PRD §26.3: la libreria browser-side non è sostituto di sicurezza server-side; gestisce solo header auth e token refresh, non genera credenziali |
| Sostituzione di EventEmitter generici (mitt, eventemitter3) | SemBridge è middleware con canonical model + gateway, non un emitter |
| Polyfill EventSource/WebSocket per browser legacy | PRD §31.3: target evergreen, polyfill separati dal core |

## Traceability

Mappatura definitiva REQ-ID → fase. Ogni requisito è assegnato alla **prima fase** in cui appare nel ciclo di vita; le fasi successive che lo estendono sono indicate fra parentesi nella colonna "Note". I cross-cutting (`VAL-*`, `ERR-*`, `LIFE-*`, `TEST-*`, `DOC-*`) sono distribuiti come da tabella in `ROADMAP.md` § "Cross-Cutting Strategy".

### Core Broker — Fase 1

| Requirement | Phase | Status | Note |
|-------------|-------|--------|------|
| CORE-01 | Phase 1 | Done (plan 01-07) | `EventBus` class in `core/bus.ts` con `publish(topic, payload, options?)` e `subscribe(pattern, handler, options?)`. 25 test passing. |
| CORE-02 | Phase 1 | Done (plan 01-07) | `Subscription` handle ritornato da `subscribe()` con `.unsubscribe()` idempotente (D-27 verificato). `unsubscribeByOwner(pluginId)` per LIFE-02 cascade in plan 08. |
| CORE-03 | Phase 1 | Done (plan 01-06) | `TopicRegistry` class in `core/topic-registry.ts` con `register/has/list/onRegistered`, idempotente, ordering deterministico, observer pattern, 8 test passing. `getTopicRegistry()` API pubblica esposta in plan 08. |
| CORE-04 | Phase 1 | Done (plan 01-08) | `Broker.registerPlugin(descriptor)` e `Broker.unregisterPlugin(id)` esposti via `core/broker.ts`. `PluginRegistry` interno con register (auto-mount D-25) + unregister cascade D-26. Throw `BrokerError` `plugin.id.duplicate` su id duplicato (D-17). |
| CORE-05 | Phase 1 | Done (plan 01-08) | Hook invocation completata in `plugin-registry.ts`: `onRegister` sync → auto-mount con `onMount` async → `onUnmount` async → `onDestroy` async (D-25 transitions). 19 test in plugin-registry.test.ts coprono lifecycle ordering, hook errors propagation, cascade D-26. |
| CORE-06 | Phase 1 | Done (plan 01-05) | `createBrokerEvent` factory in `core/event-factory.ts` produce eventi conformi a struttura `BrokerEvent` (id branded, topic, timestamp, source obbligatorio, payload, metadata, correlationId, deliveryMode default 'async', priority default 'normal'). 12 test passing. |
| CORE-07 | Phase 1 | Done (plan 01-05) | `createBrokerEvent` setta id via `nanoid` se assente, timestamp via `Date.now()` se assente, lancia `BrokerError` `event.source.missing` se source assente E senza defaultSource. (D-21..D-23) |
| CORE-08 | Phase 1 | Done (plan 01-05) | `validateTopic(topic)` in `core/topic-matcher.ts` con regex D-24 (`/^[a-z0-9]+(\.[a-z0-9]+)*$/`); naming dot-separated minuscolo enforced via throw `BrokerError` `topic.invalid`. 32 test (insieme a TopicTrie). |
| CORE-09 | Phase 1 | Done (plan 01-05) | `TopicTrie<T>` segmentato D-08..D-11 in `core/topic-matcher.ts` con `insert/remove/match/collectAllPatterns`. Edge case D-11 verificato: `weather.*.failed` matcha `weather.alert.failed`. |
| CORE-10 | Phase 1 | Done (plan 01-04) | `createConsoleLogger(level)` + `silentLogger` in `core/logger.ts` — 6 livelli, namespace `[sembridge]`, D-12 mapping completo, 11/11 test passing |
| CORE-11 | Phase 1 | Done (plan 01-08) | `unregisterPlugin(id)` invoca cascade D-26: `bus.unsubscribeByOwner(pluginId)` + `abortController.abort()` + `onUnmount` + `onDestroy`. `createPluginScopedBroker` wrapper auto-tagga subscriptions con `ownerId=pluginId` per garantire LIFE-02 deterministico. |
| CORE-12 | Phase 1 | Done (plan 01-07) | Handler isolation in `EventBus.deliver()`: try/catch attorno a ogni handler invocation + handler async rejected promise via `.catch()` (D-16). Errore catturato → log via `logger.error` → publish `system.error` come BrokerEvent (NO re-throw). Deep-freeze payload opt-in via `setDebugMode(true)` per anti-tampering. |
| CORE-13 | Phase 1 | Done (plan 01-04) | `noopEventTap` + `safeTapStep` (try/catch D-20 swallow) + `startStep` factory + `SnapshotFactory` type alias in `core/event-tap.ts` — pre-instrumentazione F1 garantita, 10/10 test passing |
| CORE-14 | Phase 1 | Done (plan 01-08) | `createBroker(config: BrokerConfig)` in `public-factory.ts` con Valibot `safeParse` validation. F1 sections (`runtime`, `debug`) validate strutturalmente; F2-F6 sections (`topicSchemas`, `canonicalModel`, `aliasRegistry`, `transforms`, `routes`, `transport`, `workers`, `cache`) accettate come placeholder `unknown` (extension non-breaking). Throw `Error` con messaggio Valibot descrittivo su validation fail (D-18). No singleton (D-30): N istanze indipendenti. |

### Canonical Model + Mapper — Fase 2

| Requirement | Phase | Status | Note |
|-------------|-------|--------|------|
| MAP-01 | Phase 2 | Complete | — |
| MAP-02 | Phase 2 | Complete | Versioning canonical schema (`requires`) |
| MAP-03 | Phase 2 | Complete | — |
| MAP-04 | Phase 2 | Complete | — |
| MAP-05 | Phase 2 | Complete | — |
| MAP-06 | Phase 2 | Complete | — |
| MAP-07 | Phase 2 | Complete | Esempio: `parseItalianDate` |
| MAP-08 | Phase 2 | Complete | — |
| MAP-09 | Phase 2 | Complete | `$derive` con concat e similari |
| MAP-10 | Phase 2 | Complete | — |
| MAP-11 | Phase 2 | Complete | Pipeline post-mapping (validateCanonical ai passi 6+12) |
| MAP-12 | Phase 2 | Complete | `registerTransform(name, fn)` + fallback policy |
| MAP-13 | Phase 2 | Complete | Default V1 — canonicalizzazione interna completa |
| MAP-14 | Phase 2 | Complete | Step 11 della pipeline §28 |
| MAP-15 | Phase 2 | Complete | Mapping Inspector (estende EventTap) |
| MAP-16 | Phase 2 | Complete | Warning runtime alias ambiguo |
| MAP-17 | Phase 2 | Complete | **Closes PRD §39 #1**: mapping esplicito vince sempre |

### Routing Engine + HTTP Gateway — Fase 3

| Requirement | Phase | Status | Note |
|-------------|-------|--------|------|
| ROUTE-01 | Phase 3 | Complete | — |
| ROUTE-02 | Phase 3 | Complete | — |
| ROUTE-03 | Phase 3 | Complete | queryMap + bodyMap canonico→server |
| ROUTE-04 | Phase 3 | Complete | Definizione type — implementazione cache adapter in F6 |
| ROUTE-05 | Phase 3 | Complete | — |
| ROUTE-06 | Phase 3 | Complete | HttpGateway centralizzato (PRD §18 / 03-08); RouterBroker plan 03-12 ne forza l'uso |
| ROUTE-07 | Phase 3 | Complete | Hook adapter pluggable |
| ROUTE-08 | Phase 3 | Complete | Strategy Pattern per ogni policy |
| ROUTE-09 | Phase 3 | Complete | **Closes PRD §39 #8**: no retry su 4xx eccetto 408/429 |
| ROUTE-10 | Phase 3 | Complete | Backpressure priority-aware |
| ROUTE-11 | Phase 3 | Complete | `dedupeKey` esplicito |
| ROUTE-12 | Phase 3 | Complete | — |
| ROUTE-13 | Phase 3 | Complete | AbortSignal propagato |
| ROUTE-14 | Phase 3 | Complete | Route Inspector (estende EventTap) |
| ROUTE-15 | Phase 3 | Complete | **Closes PRD §39 #6**: `'first-match'` default + warning |
| ROUTE-16 | Phase 3 | Complete | **Closes PRD §39 #5**: default consegna locale |

### Realtime Inbound — Fase 4

| Requirement | Phase | Status | Note |
|-------------|-------|--------|------|
| RT-01 | Phase 4 | Pending | SSE prioritario V1 |
| RT-02 | Phase 4 | Pending | WebSocket opzionale ma in V1 almeno uno disponibile |
| RT-03 | Phase 4 | Pending | — |
| RT-04 | Phase 4 | Pending | — |
| RT-05 | Phase 4 | In Progress (04-03 reconnect-strategy ✓ + 04-04 visibility-detector ✓; 04-05/06 heartbeat + 04-07 manager pending) | Full jitter + cap 30s + heartbeat + stale detection (D-110 visibility wrapper done) |
| RT-06 | Phase 4 | Pending | Mapper server→canonical (riusa F2) |
| RT-07 | Phase 4 | Pending | **Closes PRD §39 #9**: Last-Event-ID + ping app-level |

### Worker Runtime — Fase 5

| Requirement | Phase | Status | Note |
|-------------|-------|--------|------|
| WK-01 | Phase 5 | Pending | Pool bounded `min(hardwareConcurrency, 4)` |
| WK-02 | Phase 5 | Pending | — |
| WK-03 | Phase 5 | Pending | `correlationId` end-to-end |
| WK-04 | Phase 5 | Pending | — |
| WK-05 | Phase 5 | Pending | — |
| WK-06 | Phase 5 | Pending | State machine atomico timeout vs success |
| WK-07 | Phase 5 | Pending | **Closes PRD §39 #11**: structuredClone default + transferable opt-in |

### Cache + Tooling Avanzato — Fase 6

| Requirement | Phase | Status | Note |
|-------------|-------|--------|------|
| CACHE-01 | Phase 6 | Pending | MemoryCacheAdapter default; IDB rinviato a V1.x |
| CACHE-02 | Phase 6 | Pending | TTL + invalidate per key/pattern |
| CACHE-03 | Phase 6 | Pending | metadata `cache` vs `remote` |
| TOOL-01 | Phase 6 | Pending | Event Inspector — implementazione reale di `EventTap` predisposto in F1 |
| TOOL-02 | Phase 6 | Pending | Metrics simil-OpenMetrics |
| TOOL-03 | Phase 6 | Pending | `enableDebug` / `disableDebug` / `getDebugSnapshot` |
| TOOL-04 | Phase 6 | Pending | `pauseTopic` / `resumeTopic` / `flushQueue` |
| TOOL-05 | Phase 6 | Pending | **Closes PRD §39 #10**: format JSON `{ counters, gauges, histograms }` |

### Cross-cutting

| Requirement | Phase (prima introduzione) | Status | Note (fasi che estendono) |
|-------------|---------------------------|--------|----------------------------|
| VAL-01 | Phase 1 | Done (plan 01-05) | `validateEvent(event)` in `core/event-validator.ts` con Valibot schema BrokerEvent shape; lancia `BrokerError` `event.validation.failed` su payload invalido. 11 test passing. |
| VAL-02 | Phase 2 | Pending | — |
| VAL-03 | Phase 2 | Complete | — |
| VAL-04 | Phase 2 | Complete | — |
| VAL-05 | Phase 3 | Complete | — |
| VAL-06 | Phase 1 | Done (plan 01-05) | Valibot schema runtime per BrokerEvent in `core/event-validator.ts`. TS interfaces tipizzate restano in `types/` (plan 03). |
| VAL-07 | Phase 2 | Complete | — |
| VAL-08 | Phase 2 | Complete | **Closes PRD §39 #3**: `required: true|false` per campo |
| VAL-09 | Phase 2 | Complete | **Closes PRD §39 #4**: `onFailure: 'block' | 'skip' | 'fallback'` |
| ERR-01 | Phase 1 | Done (plan 01-04) | `createBrokerError(params)` factory + `isBrokerError(value)` type guard in `core/broker-error.ts` — ES2022 cause, conditional assignment per `exactOptionalPropertyTypes`, 9/9 test passing |
| ERR-02 | Phase 2 | Complete | F2: `mapping.error`, F3: `<topic>.failed`+`network.error`, F4: `system.realtime.*`, F5: `worker.error` |
| ERR-03 | Phase 1 | Done (plan 01-07) | Errori isolati nel dispatch loop di `EventBus.deliver()`: ogni handler ha il suo try/catch indipendente; eccezione di un handler NON propaga al loop (gli altri handler ricevono comunque l'evento). 25 test verificano l'invariant. |
| PIPE-01 | Phase 1 (skeleton) | Complete | Estesa da F2 (step 4-6, 11-12), F3 (step 7-10), F6 (step 14 reale) |
| LIFE-01 | Phase 1 | Done (plan 01-08) | `Broker.subscribe()` ritorna `Subscription` con `.unsubscribe()` idempotente. Plugin smontabili senza leak via `unregisterPlugin(id)` cascade D-26. F4 estenderà a listener realtime; F5 a MessageChannel worker. |
| LIFE-02 | Phase 1 | Done (plan 01-08) | **Closes PRD §39 #7**: cascade D-26 deterministico in `unregister(id)` — `bus.unsubscribeByOwner` → `abortController.abort()` → `onUnmount` → `onDestroy`. `createPluginScopedBroker` wrapper auto-tagga subscriptions per garantire enforcement F1. Test `getDebugSnapshot()` post-unregister == baseline pre-registrazione. F3 estenderà a route, F4 a realtime, F5 a worker tasks. |
| SEC-01 | Phase 3 | Complete | — |
| SEC-02 | Phase 3 | Complete | — |
| SEC-03 | Phase 3 | Complete | Idempotency token |
| SEC-04 | Phase 3 | Complete | http-handler emette BrokerError 'gateway.4xx'/'gateway.5xx' uniformi via response.status (D-80 shape) — plan 03-08 |
| SEC-05 | Phase 3 | Complete | URL allowlist |
| TEST-01 | Phase 1 (subset) | Done subset (plan 01-09) | PipelineHarness fixture + 8 integration test in `packages/core/src/__integration__/` coprono pub/sub, unsubscribe, wildcard, dedupe (skeleton), lifecycle cleanup deterministico (LIFE-02), event-tap 5 step F1, handler isolation, deep-freeze. 46 nuovi test passing. Estesa progressivamente F2-F6. |
| TEST-02 | Phase 2 (subset) | Complete | F3 (server), F4 (reconnect), F5 (worker), F6 (cache) |
| TEST-03 | Phase 1 (subset) | Done subset (plan 01-10) | 4 robustness test in `__integration__/`: storm.test (10000 publish FIFO + pendingAsyncDelivery=0), wildcard-perf.test (10000 sub matched < 50ms), plugin-fault.test (onMount throw → state failed, broker continua), concurrent-unregister.test (AbortSignal vs unregister race). Performance budget rispettati con ampi margini (storm 24ms / wildcard 11ms misurati). F3 estenderà a server malconfigurato, F4 a riconnessione ripetuta, F5 a worker timeout. |
| PKG-01 | Phase 1 (01-01 foundation, 01-02 build, 01-11 verify) | Baseline (tsup ESM-only configurato in 01-02; dist/index.js generato; full verify in 01-11) | tsup ESM-only (no CJS — dual-package hazard) |
| PKG-02 | Phase 1 (01-01, 01-02) | Baseline (tsconfig.base.json strict + TS 6.0.3 in 01-01; tsconfig package extends in 01-02; tsc --noEmit exit 0) | TypeScript 6.0.3 (super-set di 5.5+) |
| PKG-03 | Phase 1 (01-01, 01-02) | Baseline (target ES2022 in tsconfig.base.json; tsup target es2022 + platform browser in 01-02) | target ES2022 |
| PKG-04 | Phase 1 (01-02 baseline, 01-11 verify) | Done (plan 01-11) | `dist/index.d.ts` 19.43 KB con JSDoc preservato. `attw --profile=esm-only` 🟢 (node16, bundler). |
| DOC-01 | Phase 1 (01-02 skeleton, 01-11 finalizzato) | Done (plan 01-11) | README espanso (271 righe) + JSDoc su 16 runtime export + 19 type pubblici. Bundle TypeDoc-ready. Consolidato in F6 con TypeDoc. |
| DOC-02 | Phase 6 | Pending | Guida integrazione plugin |
| DOC-03 | Phase 2 (02-01 skeleton, 02-12 final) | In Progress | README skeleton italiano in 02-01 (sezioni Stato/Cosa contiene/Vincolo D-49/Documentazione/Licenza); completamento al plan 02-12 con scenario meteo end-to-end + JSDoc API pubblica + esempi PRD §14.2 |
| DOC-04 | Phase 3 | Complete | Documentazione route engine + gateway |
| DOC-05 | Phase 6 | Pending | Esempi end-to-end (scenario meteo §29 con cache + tooling) |
| DOC-06 | Phase 6 | Pending | Documentazione debug tooling |

**Coverage:**
- v1 requirements: 91 totali
- Mapped to phases: 91
- Unmapped: 0

**Open Issues PRD §39 chiusura:**
- 11/11 mappate a fasi (#1 → F2, #2 → F1+F2+F3+F6, #3 → F2, #4 → F2, #5 → F3, #6 → F3, #7 → F1, #8 → F3, #9 → F4, #10 → F6, #11 → F5)
- **Closed:** #7 (LIFE-02 — Phase 1 plan 01-08); **#1 (MAP-17 — Phase 2 plan 02-04 AliasRegistry: mapping esplicito vince sempre per costruzione contract; il mapper-engine plan 02-07 valuta livello 1 PRIMA di chiamare AliasRegistry.resolve)**

---
*Requirements defined: 2026-04-28*
*Last updated: 2026-04-28 after Plan 01-03 completion (CORE-05/06/07/10/13/14, ERR-01, VAL-06 → Type-defined)*
