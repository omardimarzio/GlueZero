# Ricerca Feature

**Dominio:** Libreria JavaScript browser-side per middleware client-side event-driven con canonical model + mapper bidirezionale + gateway server unificato + worker runtime + developer tooling
**Data ricerca:** 2026-04-28
**Confidenza complessiva:** ALTA per le sezioni vincolate dal PRD (table stakes, anti-feature); MEDIA per il confronto con librerie comparabili (basato su conoscenza consolidata, non verificato live causa restrizioni di tooling in questa sessione); MEDIA per i casi d'uso reali (estrapolati da pattern noti del dominio).

> **Nota sulle fonti:** Durante questa sessione WebSearch, gsd-sdk (BRAVE_API_KEY non impostato) e i fallback ctx7 CLI non sono stati eseguibili. Le caratteristiche delle librerie comparabili sono descritte sulla base di conoscenza pregressa stabile (API pubbliche di librerie maggiori, pattern documentati dei progetti elencati nelle istruzioni). I dettagli specifici di versione vanno verificati durante la fase di scelta tecnologica.

---

## 1. Sintesi esecutiva

SemBridge non è un event emitter, non è un client HTTP, non è un wrapper di Web Worker, non è un client GraphQL e non è uno state manager. È un **runtime di orchestrazione** che combina sei capacità in un unico runtime coerente: pub/sub locale, routing dichiarativo (local/http/realtime/worker/cache/composite), gateway server unico, worker runtime, canonical model + mapper bidirezionale, developer tooling.

Il valore differenziante centrale, articolato in PRD §13 e §40 e ribadito in `PROJECT.md` (Core Value), è il **canonical model con mapping bidirezionale**: due plugin sviluppati indipendentemente — con vocabolari locali eterogenei (`città`/`data` vs `location`/`day-prevision`) — devono interoperare senza accordo preventivo sui nomi dei campi. Tutte le altre capacità (routing, gateway, worker, cache, tooling) servono a sostenere questo valore o a costituire le precondizioni perché abbia senso.

Le table stakes sono i 9 vincoli non-negoziabili di PRD §33.2 più la checklist di PRD §42 (15 item). I differenziatori veri sono cinque: (1) canonical model + mapper bidirezionale come hero feature, (2) routing dichiarativo cross-trasporto omogeneo, (3) gateway server unificato per fetch + realtime, (4) worker integration come route type, (5) tre Inspector (Event/Mapping/Route) come tooling integrato. Le anti-feature sono esplicite in PRD §5.

---

## 2. Feature Landscape

### 2.1 Table Stakes (Vincoli non-negoziabili)

Feature che la libreria DEVE avere o non è conforme al PRD. Estratte da §4.1, §9, §16, §33.2, §36, §42.

#### Categoria A — Vincoli "duri" da PRD §33.2

| ID | Feature | Fonte PRD | Fase PRD §32 | Complessità | Note |
|----|---------|-----------|--------------|-------------|------|
| TS-01 | Canonical model interno (vocabolario, alias, tipi) | §13, §33.2, §42 | Fase 2 | ALTA | Hero feature; senza questa la libreria fallisce il valore centrale |
| TS-02 | Mapper bidirezionale locale ↔ canonico ↔ locale | §14, §33.2, §42 | Fase 2 | ALTA | Pipeline di trasformazioni con rename, nested, default, derive, format, units |
| TS-03 | Broker come unico gateway server per i flussi coperti | §18, §33.2, §42 | Fase 3 | ALTA | Centralizza fetch/AJAX, realtime, auth, retry, timeout |
| TS-04 | Supporto a fetch + ≥1 canale realtime inbound (SSE o WS) | §18.2, §33.2, §42 | Fase 3 + 4 | ALTA | SSE prioritario per V1 (PRD §18.3) |
| TS-05 | Supporto a Web Worker | §19, §33.2, §42 | Fase 5 | MEDIA | Registry, pool, task tracking, timeout, cancellazione |
| TS-06 | Debug e introspezione (Event/Mapping/Route Inspector) | §25, §33.2, §42 | Fase 1 base + Fase 6 avanzato | MEDIA | Necessari snapshot, log, metriche |
| TS-07 | Gestione lifecycle e cleanup anti memory-leak | §15.5, §24, §33.2, §42 | Fase 1 | MEDIA | Unsubscribe automatico al `unregisterPlugin` |
| TS-08 | Route dichiarative (config-driven, non hardcoded) | §17, §33.2, §42 | Fase 3 | ALTA | Tutti i route types: local, http, realtime-inbound, worker, cache, composite |
| TS-09 | Validazione minima dei payload | §21, §33.2, §42 | Fase 2/3 | MEDIA | Validazione sintattica evento, payload topic, canonico, post-mapping, response server |

#### Categoria B — Capacità API minima da PRD §16

| ID | Feature | Fonte PRD | Fase PRD §32 | Complessità | Note |
|----|---------|-----------|--------------|-------------|------|
| TS-10 | `createBroker(config)` factory | §16.1 | Fase 1 | BASSA | Entry point unico configurabile |
| TS-11 | `publish(topic, payload, options?)` | §16.2 | Fase 1 | BASSA | Pubblicazione evento sincrono o async |
| TS-12 | `subscribe(topic, handler, options?)` con handle restituito | §16.2, §24.2 | Fase 1 | BASSA | Restituisce subscription id / unsubscribe function |
| TS-13 | `unsubscribe(subscriptionId)` deterministico | §16.2, §36.1 | Fase 1 | BASSA | Senza effetti residui; obbligatorio |
| TS-14 | `registerPlugin` / `unregisterPlugin` | §15, §16.2 | Fase 1 | MEDIA | Lifecycle: onRegister/onMount/onUnmount/onDestroy |
| TS-15 | `registerRoute` / `unregisterRoute` | §16.2, §17.1 | Fase 3 | MEDIA | Definizione dichiarativa di routing |
| TS-16 | `registerCanonicalSchema` / `registerTransform` | §16.2, §13, §14 | Fase 2 | MEDIA | Registrazione schemi e trasformazioni custom |
| TS-17 | `connectRealtime` / `disconnectRealtime` | §16.2, §18 | Fase 4 | MEDIA | Controllo esplicito del canale inbound |
| TS-18 | `getDebugSnapshot` | §16.2, §25 | Fase 1 base + Fase 6 | MEDIA | Stato runtime ispezionabile |

#### Categoria C — Modello evento e topic da PRD §11, §12

| ID | Feature | Fonte PRD | Fase PRD §32 | Complessità | Note |
|----|---------|-----------|--------------|-------------|------|
| TS-19 | Struttura `BrokerEvent` standard (id, topic, timestamp, source, payload, metadata, correlationId, traceId, deliveryMode, priority, ttlMs, dedupeKey) | §11.1 | Fase 1 | BASSA | Base di tutto il sistema |
| TS-20 | `EventSourceDescriptor` (type: plugin/component/worker/server/system/cache + id) | §11.2 | Fase 1 | BASSA | Necessario per debug e routing |
| TS-21 | Naming convention dot-separated minuscolo (`<entity>.<action>.<status>`) | §12.1, §12.2 | Fase 1 | BASSA | Convenzione documentata e validabile |
| TS-22 | Wildcard subscribe (`weather.*`, `*.failed`) | §12.3 | Fase 1 | MEDIA | Opzionale per PRD ma fortemente consigliato |
| TS-23 | Trittico request/succeeded/failed come pattern raccomandato | §12.2 | Fase 1 (convenzione) + Fase 3 (auto-publish) | BASSA | Convenzione, non vincolo runtime |

#### Categoria D — Robustezza runtime da PRD §22, §23

| ID | Feature | Fonte PRD | Fase PRD §32 | Complessità | Note |
|----|---------|-----------|--------------|-------------|------|
| TS-24 | `BrokerError` standardizzato (code, message, category, details, originalError, routeId, topic, eventId) | §22.4 | Fase 3 | BASSA | Contratto errore unico |
| TS-25 | Eventi standard di errore: `<topic>.failed`, `system.error`, `mapping.error`, `worker.error`, `network.error` | §22.3 | Fase 3 | BASSA | Convenzioni emette dal runtime |
| TS-26 | Retry policy (errori 4xx vs 5xx differenziati) | §23.1, §39 | Fase 3 | MEDIA | PRD §39 vieta esplicitamente di lasciare implicita la politica |
| TS-27 | Timeout policy per route I/O e worker | §23.2 | Fase 3 + 5 | BASSA | Configurabile per route |
| TS-28 | Backpressure: queue bounded, drop, throttle, debounce, latest-only, merge/coalesce | §23.3 | Fase 3 | ALTA | Sei strategie da implementare; tipico punto di sotto-stima |
| TS-29 | Deduplica via `dedupeKey` o logica route-specific | §23.4 | Fase 3 | MEDIA | Cache di dedupe con TTL |
| TS-30 | Cancellazione task lunghi / richieste obsolete | §23.5 | Fase 3/5 | MEDIA | AbortSignal-style API |
| TS-31 | Isolation degli errori (no collasso runtime salvo guasti critici) | §22.2 | Tutte le fasi | MEDIA | Sandboxing handler con try/catch + reporting |

#### Categoria E — Tooling minimo da PRD §25

| ID | Feature | Fonte PRD | Fase PRD §32 | Complessità | Note |
|----|---------|-----------|--------------|-------------|------|
| TS-32 | Event Inspector (topic, publisher, timestamp, payload originale/canonico, subscriber, route, esito, errori, tempi) | §25.1 | Fase 1 base + Fase 6 | MEDIA | Snapshot strutturato per debug |
| TS-33 | Mapping Inspector (input locale, regole, canonico, output remapped, warning, errori) | §25.2, §14.8 | Fase 2 + 6 | MEDIA | Trace di ciascun passaggio mapping |
| TS-34 | Route Inspector (route intercettata, policy, esito remote/worker, retry, cache hit/miss) | §25.3 | Fase 6 | MEDIA | Composizione esiti route |
| TS-35 | Log levels: silent, error, warn, info, debug, trace | §25.4 | Fase 1 | BASSA | Convenzione standard |
| TS-36 | Metriche: eventi/sec, scartati, errori per categoria, tempi medi route HTTP/worker, cache hit ratio, subscriber per topic, backlog | §25.5 | Fase 6 | MEDIA | Counter + gauge in-memory; export opzionale |

#### Categoria F — Schema management da PRD §21

| ID | Feature | Fonte PRD | Fase PRD §32 | Complessità | Note |
|----|---------|-----------|--------------|-------------|------|
| TS-37 | Validazione evento sintattica | §21.2 | Fase 1 | BASSA | Required: id, topic, source |
| TS-38 | Validazione payload topic | §21.2 | Fase 2 | MEDIA | Schema-driven |
| TS-39 | Validazione modello canonico | §21.2 | Fase 2 | MEDIA | Type checking del payload canonicalizzato |
| TS-40 | Validazione post-mapping | §21.2 | Fase 2 | MEDIA | Garantisce integrità output ai consumer |
| TS-41 | Validazione risposta server | §21.2 | Fase 3 | MEDIA | Prima di canonicalization |

**Conteggio totale table stakes:** 41 feature/capacità vincolanti. Nessuna eliminabile senza violare il PRD.

---

### 2.2 Differenziatori (Vantaggio competitivo vs alternative)

Feature che distinguono SemBridge da event emitter generici, librerie HTTP, observable streams, worker bridges. Confronto sintetico in §3.

| ID | Feature | Value Proposition | Complessità | Fase | Perché differenzia |
|----|---------|-------------------|-------------|------|--------------------|
| DIFF-01 | **Canonical model + mapper bidirezionale** (hero feature) | Plugin di terze parti con nomenclatura eterogenea interoperano senza accordo preventivo. Il broker possiede il vocabolario; i plugin dichiarano traduzioni. | ALTA | 2 | Nessuna libreria mainstream JS lo offre come feature core. Pattern noto in EAI server-side (Apache Camel, Spring Integration EIP "Message Translator") ma assente client-side. |
| DIFF-02 | **Routing dichiarativo unificato** (local/http/realtime/worker/cache/composite) | Una sola sintassi e un solo motore decidono dove va l'evento. L'autore del plugin non scrive `fetch`, non istanzia worker, non gestisce SSE: dichiara il topic. | ALTA | 3 | RxJS, Redux Saga e altri offrono "operators" generici, non un motore di route con tipi predefiniti e semantica trasporto-specifica. |
| DIFF-03 | **Gateway server unico** (fetch + realtime in un punto) | Auth, retry, timeout, dedupe, header, refresh token, error handling: configurati una volta, applicati a tutto. La superficie di attacco e il punto di osservabilità sono unici. | ALTA | 3 + 4 | TanStack Query / urql / Apollo coprono parte HTTP; nessuno copre HTTP + realtime + worker dietro un'unica governance. |
| DIFF-04 | **Worker integration come route type** | Eseguire un task pesante è dichiarativo: `type: 'worker'`, `task: 'generateReport'`. Il task correlation, timeout, error propagation, progress events sono nativi. | MEDIA | 5 | Comlink offre RPC con worker ma non integrazione con event bus, mapping canonico, retry, cache. |
| DIFF-05 | **Multi-channel realtime astratto** (SSE / WebSocket) | Inbound server messages diventano eventi interni con `source: { type: 'server' }`, normalizzati attraverso il canonical model. Il consumer non sa se il dato è arrivato via SSE, WebSocket o fetch response. | MEDIA | 4 | Socket.IO / EventSource / `ws` sono tutti single-channel e senza semantica unificata col resto del sistema. |
| DIFF-06 | **Tre Inspector integrati** (Event/Mapping/Route) | Debug è first-class, non un add-on. Ogni evento è ispezionabile lungo la pipeline §28.1 (14 step). | MEDIA | 1 base + 6 | Redux DevTools sono limitati allo state. RxJS marble debugging è offline. SemBridge offre runtime introspection cross-trasporto. |
| DIFF-07 | **Pipeline evento documentata e deterministica** (PRD §28.1) | 14 step ordinati e ispezionabili: arricchimento metadata → validazione → identificazione source → mapping → dedupe → route resolution → consegna → mapping reverse → consegna consumer → log/metrics. Niente trasformazioni "magiche". | MEDIA | 1-3 | RxJS è imperativo lazy; Saga è generator-based; nessuno garantisce un ordine di pipeline standard documentato. |
| DIFF-08 | **Plugin contract standard** (`BrokerPluginDescriptor` con subscribes/publishes/inputMap/outputMap/handlers/lifecycle) | Plugin di terzi pubblicabili con un manifest dichiarativo. Versionabili, smontabili, ispezionabili. | MEDIA | 1 base + 2 mapping | Nessun event emitter offre un plugin contract di questo livello. Effector "domains" sono affini ma legati allo stato, non agli eventi. |
| DIFF-09 | **Composite route con cache-then-network** | Workflow check-cache → server → update-cache → publish è dichiarativo. Sostituisce codice imperativo che è la principale fonte di bug nelle SPA. | ALTA | 3 + 6 | TanStack Query offre stale-while-revalidate ma per dati, non per generic pubsub events. |
| DIFF-10 | **Source descriptor strutturato** (type: plugin/component/worker/server/system/cache + id + instanceId) | Provenance tracciabile per ogni evento. Permette policy auth/security, debug e tooling che reagiscono al tipo di sorgente. | BASSA | 1 | Event emitter mainstream non hanno un concetto di "source" esplicito. |

**Hero feature ribadita:** DIFF-01 è il differenziatore narrativo e tecnico centrale. Tutto il resto deve essere giustificato come "abilita" o "amplifica" il valore di DIFF-01.

---

### 2.3 Anti-Features (Esplicitamente fuori scope)

Estratte da PRD §5 e ribadite in `PROJECT.md` (Out of Scope). Queste **non vanno costruite** in V1 e qualsiasi richiesta in tal senso va respinta o rimandata a release future.

| Anti-Feature | Perché viene chiesta | Perché è problematica | Cosa fare invece |
|--------------|----------------------|------------------------|------------------|
| **Framework UI completo** (sostituire React/Vue/Svelte/Angular) | Sembra naturale "se si gestiscono eventi e dati, perché non anche il rendering?" | Esce completamente dal dominio (orchestrazione → rendering = scope creep di 10×). Il PRD §5 lo esclude esplicitamente e §2 raccomanda "concettualmente indipendente da framework UI". | Integrazione plugin per framework esistenti: hook React/Vue/Svelte che wrappano `subscribe` con cleanup automatico. Non rendering proprio. |
| **State manager globale stile Redux come unica via** | "Se ho il broker già centralizzato, lo uso anche come store" | Forzerebbe un pattern (single source of truth, reducer, immutability) sui consumer. Il PRD §5 lo esclude come "unica via". | I plugin gestiscono il proprio stato locale. La libreria offre cache opzionale (Fase 6). Un eventuale adapter Redux/Zustand è plugin di terze parti. |
| **Esecuzione logica server-side** | "Il broker è anche server, no?" | La libreria è browser-side per definizione (PRD §1, §5). Mescolarla con backend = ambiguità di sicurezza, deployment, threading. | Server expone API HTTP/SSE/WS standard. SemBridge è solo client. Eventuali pacchetti companion server-side sono progetto separato. |
| **Motore BPMN / workflow visual designer** | "Visualizzare i flussi sarebbe figo" | Scope esplosivo. Modellazione workflow visiva è dominio per Camunda, n8n, etc. Il PRD §5 lo esclude. | Route dichiarative sono già una forma testuale di workflow. Eventualmente un visualizzatore read-only delle route registrate (Fase 6 tooling), non un editor. |
| **Mapping semantico ambiguo automatico** (auto-resolve di alias senza configurazione) | "Se il broker conosce 'data' come alias di 'forecast_date', perché chiede al plugin di dichiararlo?" | PRD §14.7 spiega: `data` in italiano può significare `date` o "dati" generici. Resolve automatico = bug runtime nascosti. Il PRD §5 lo esclude. | Alias come "aiuto" + warning runtime in caso di ambiguità (TS-33 mapping inspector). Mapping esplicito del plugin prevale sempre (MAP-17). |
| **Accesso DOM dai worker** | "Vorrei che il worker aggiornasse direttamente la UI" | Vincolo del browser, non aggirabile. PRD §5 e §19.5 lo escludono. | Worker emette eventi via message bridge; main thread sottoscrive e aggiorna DOM. Pattern già supportato dal route worker. |
| **Service Worker / Push notification bridge** | "Voglio notifiche oltre la vita della pagina" | Aggiunge complessità (registration, scope, message channel). PRD §18.3 lo rimanda a release successive. | Roadmap futura post-V1. Per ora: realtime via SSE/WS attivo finché la pagina è viva. |
| **IndexedDB persistence** | "La cache deve sopravvivere al refresh" | Aggiunge async I/O, schema migration, quota management. PRD §20.3 lo lascia opzionale. | V1: in-memory cache (CACHE-01). IndexedDB come adapter opzionale post-V1. |
| **Mapping di trasformazioni non-puro / con side effect** (es. `transform` che fa fetch) | "Ho bisogno di arricchire un campo da un endpoint durante il mapping" | Romperebbe la pipeline §28.1 deterministica. Side effect nel mapping = debug impossibile. | Modellare come route composite: emette evento canonico → route http → arricchisce → ripubblica. |
| **Benchmark numerici rigidi imposti** | "Ci serve un SLO scritto" | PRD §34.2 lo esclude esplicitamente per V1. | Metriche TS-36 + monitoraggio interno; SLO da definire dopo dati reali. |
| **Schema-less "best effort" mapping** (mapping fuzzy basato su heuristics) | "Sarebbe magico se il sistema indovinasse i nomi" | PRD §13.5 e §14.7 sono espliciti: niente magic. | Vocabolario canonico + alias dichiarati. Il developer è responsabile della dichiarazione. |
| **Trasformazioni implicite invisibili al debug layer** | "Non voglio loggare ogni step, è verboso" | PRD §28.2 lo vieta esplicitamente. Senza visibilità il sistema diventa un mistero in produzione. | Log livelli (TS-35) controllati da `enableDebug`/`disableDebug`. In production debug off, ma le trasformazioni restano ispezionabili tramite `getDebugSnapshot` on-demand. |

---

## 3. Confronto con librerie comparabili

Ogni libreria copre **parzialmente** lo spazio di SemBridge. Nessuna copre l'unione delle 6 capacità.

> **Confidenza:** MEDIA. Conoscenza basata su API pubbliche stabili e pattern documentati. Versioni e dettagli specifici da verificare prima di decisioni di adozione (non rilevante per scelte di SemBridge stesso, è scelta di posizionamento).

### 3.1 Event emitter "puri"

| Libreria | Cosa fa bene | Cosa manca rispetto a SemBridge |
|----------|--------------|-----------------------------------|
| **mitt** | Minimale (~200 byte), API `on/off/emit`, zero dipendenze. Ottimo per pubsub interno semplicissimo. | No mapping, no route, no worker, no realtime, no validation, no debug tooling, no plugin contract, no lifecycle. È un componente che SemBridge potrebbe internamente *contenere*. |
| **EventEmitter3** | API Node.js-compat, performance buona, listener once, namespace via separatore. Diffuso. | Stessi gap di mitt. Non ha source descriptor, metadata, traceId, payload schema. |
| **nanoevents** | Ancora più piccolo, type-safe in TS. | Stessi gap di mitt. |
| **Postal.js** (storico) | Channels/topics gerarchici, wildcard, federation tra finestre. Inspirazione storica per pubsub-in-page. | Inattivo da anni; no realtime, no worker, no canonical model. |

**Posizionamento SemBridge:** SemBridge non sostituisce mitt — l'event bus core (Fase 1, CORE-01..CORE-11 in PROJECT.md) è solo una piccola parte. Chi vuole "solo emit/subscribe" usa mitt; chi ha plugin di terze parti e backend reale sceglie SemBridge.

### 3.2 Stream/Reactive libraries

| Libreria | Cosa fa bene | Cosa manca rispetto a SemBridge |
|----------|--------------|-----------------------------------|
| **RxJS** | Operatori potenti (map/filter/throttle/debounce/retry/timeout/dedupe), schedulers, multicasting, async coordination. È il "coltellino svizzero" del flusso dati JS. Copre TS-26..TS-30 in modo elegante. | È una libreria di **primitive**, non un runtime di orchestrazione. Non offre canonical model, plugin contract, route registry, server gateway unico, worker integration, source descriptor. Costruire SemBridge sopra RxJS è possibile come implementation detail ma RxJS *non sostituisce* SemBridge. |
| **most.js / xstream** | Stream più piccoli e veloci di RxJS in alcuni casi. | Stessi gap di RxJS rispetto al dominio SemBridge. |
| **Effector** | State manager event-driven con domains, stores, effects. Eventi tipati, devtools ottimi, plugin pattern. | Focus stato, non integrazione backend. No canonical model semantic. No route http/worker/realtime nativi. Effector è complementare: SemBridge potrebbe avere un adapter Effector per chi lo usa come store. |
| **redux-saga** | Generator-based side-effect orchestration, take/put/call/race. Pattern noto per coordinare async in app Redux. | Vincolato a Redux. Non è un broker. No canonical model. No worker route nativi. Curva di apprendimento ripida. |
| **redux-observable** | RxJS+Redux: epics intercettano action e producono nuove action (analoghe a route). | Stesso vincolo Redux + same gap RxJS. |

**Posizionamento SemBridge:** RxJS è una *primitiva* tecnologica; SemBridge è un *framework di orchestrazione*. SemBridge potrebbe usare RxJS internamente per backpressure (TS-28) — è un dettaglio implementativo. RxJS+ky+mitt assemblati richiedono ad ogni team di reinventare canonical model, plugin contract, debug pipeline, gateway, route registry. SemBridge li offre out of the box.

### 3.3 Worker bridges

| Libreria | Cosa fa bene | Cosa manca rispetto a SemBridge |
|----------|--------------|-----------------------------------|
| **Comlink** (Google) | RPC-style bridge tra main thread e worker, proxy trasparente, transferable object support. Standard de facto per worker JS moderni. | Solo worker. No event bus, no canonical model, no route, no realtime, no debug pipeline. SemBridge potrebbe internamente usare Comlink come adapter per worker route (Fase 5). |
| **threads.js** | Worker pool, type-safe. Simile a Comlink. | Stesso gap Comlink. |
| **workerpool** | Pool con autoscaling. | Stesso gap. |

**Posizionamento SemBridge:** SemBridge integra il worker come *route type* (DIFF-04) col canonicalization e il debug. L'utente non istanzia worker manualmente — pubblica un topic e il broker gestisce instradamento, timeout, retry, error propagation, progress.

### 3.4 HTTP / Data fetching

| Libreria | Cosa fa bene | Cosa manca rispetto a SemBridge |
|----------|--------------|-----------------------------------|
| **TanStack Query** (React Query / Solid Query / Vue Query) | Caching, stale-while-revalidate, dedupe, retry, query invalidation, devtools eccellenti. Gold standard per data fetching declarativo. | Focus su query/mutation HTTP. Niente pubsub generico, niente realtime nativo (richiede subscribe esterna), niente worker, niente canonical model, niente plugin contract di terzi. Coerente con un framework UI. |
| **urql** | Client GraphQL leggero con exchanges (analoghi a middleware route). | GraphQL-specific. No worker, no canonical model. |
| **Apollo Client** | GraphQL completo, cache normalizzata, link chain (somiglianza con route composite di SemBridge). | GraphQL-specific. La cache normalizzata è interna ad Apollo, non un canonical model esposto ai plugin. Apollo Link è l'idea più vicina ai routing engines, limitata però al trasporto GraphQL. |
| **ky / wretch / ofetch** | Wrapper HTTP migliori di `fetch`, retry, timeout, hooks. | Non sono broker. SemBridge potrebbe usare uno di questi *internamente* per il fetch client del gateway (Fase 3). |

**Posizionamento SemBridge:** TanStack Query è la migliore combinazione "cache + dedupe + retry + devtools" per HTTP. SemBridge offre l'equivalente DICHIARATIVO via route HTTP/cache/composite (TS-08, ROUTE-04, ROUTE-05) **e** copre realtime e worker. Sono complementari: un team React può usare entrambi (TanStack per dati, SemBridge per orchestrazione + plugin di terze parti) o adottare solo SemBridge.

### 3.5 State managers

| Libreria | Cosa fa bene | Cosa manca rispetto a SemBridge |
|----------|--------------|-----------------------------------|
| **Zustand** | Store minimale, hook-based, slices. | Focus stato locale; no broker pubsub, no integrazione backend, no canonical mapping. |
| **Jotai** | Stato atomico, derivati. | Stesso gap. |
| **Redux** (con toolkit) | Action/reducer/store, ecosystem maturo. | Stato single-source-of-truth, non pubsub aperto. PRD §5 lo esclude come "unica via". |

**Posizionamento SemBridge:** Stato locale è scope dei plugin/componenti. Cache opzionale (Fase 6) è per dati persistenti tra event flow. SemBridge non compete con state managers — può integrarsi tramite plugin che bridge events → store updates.

### 3.6 Pattern server-side che hanno influenzato il design

Le idee centrali di SemBridge non sono nuove: sono pattern di **Enterprise Application Integration** (EAI) noti da decenni in sistemi server-side.

| Sistema | Pattern correlato | Influenza su SemBridge |
|---------|-------------------|------------------------|
| **Apache Camel** | Enterprise Integration Patterns: Message Channel, Message Translator, Content-Based Router, Splitter, Aggregator. DSL Java/XML/YAML per dichiarare route. | DIFF-02 (routing dichiarativo) e DIFF-01 (canonical model + translator) sono direttamente l'EIP "Canonical Data Model" e "Message Translator" di Camel, portati nel browser. |
| **Spring Integration** | EIP framework Spring: channels, gateways, transformers, service activators. | Stessa influenza di Camel; Spring Integration formalizza il "Gateway" e il "Channel Adapter" che corrispondono a TS-03 (gateway server) e ai route adapter. |
| **NestJS CQRS** | Command/Query/Event bus separati, handler dichiarativi, sagas. | Influenza terminologica: Command Bus ≈ topic.requested; Event Bus ≈ topic.completed; Saga ≈ composite route. |
| **MuleSoft** | Integration platform con flow + canonical data model. | Conferma del valore del canonical model in dominio EAI. |
| **MQTT brokers (Mosquitto, EMQ)** | Topic con wildcard, QoS, retained messages. | Naming convention dot-separated + wildcard (TS-21, TS-22) si ispira a MQTT (anche se MQTT usa `/`). |
| **AsyncAPI** | Specifica per API event-driven analoga a OpenAPI per REST. | Riferimento per topic schema e payload schema (TS-37..TS-41). Eventualmente in roadmap futura: export AsyncAPI dei topic registrati. |
| **CloudEvents (CNCF)** | Spec di event envelope con id, source, type, time, datacontenttype, subject, data. | `BrokerEvent` (TS-19) è ispirato concettualmente a CloudEvents. SemBridge potrebbe esportare/importare CloudEvents come format option. |

**Posizionamento SemBridge:** Porta i pattern EAI maturi (canonical data model, message translator, content-based router, gateway) **nel browser**, in JavaScript, con TypeScript types e developer tooling moderni. Non c'è equivalente client-side maturo nello spazio JS.

---

## 4. Casi d'uso reali

Tipi di applicazioni che traggono **valore concreto** da SemBridge. Casi astratti ("event-driven app generica") sono esclusi.

### 4.1 Casi d'uso ad ALTA affinità (ROI alto)

| Caso d'uso | Perché SemBridge è la scelta giusta | Feature chiave usate |
|------------|--------------------------------------|----------------------|
| **Dashboard modulari con plugin di terze parti** (es. monitoring/observability dashboards, BI tools tipo Grafana plugin model) | Plugin sviluppati da team/vendor diversi devono mostrare dati con vocabolari diversi (CPU, cpu_pct, cpuLoad). Canonical model garantisce interoperabilità. Realtime per metriche. | DIFF-01, DIFF-02, DIFF-05, DIFF-06 |
| **CMS modulari / Page builder con widget di terzi** (es. headless CMS con marketplace di plugin) | Widget content-aware (form, gallery, mappa, prodotto) con propri schemi. Canonical model = vocabolario condiviso del sito (location, customer, product). Plugin contract standardizzato. | DIFF-01, DIFF-08, TS-14 |
| **Digital twin / SCADA browser-side** (interfacce industriali con stream di sensori e attuatori) | Migliaia di eventi/sec via WebSocket; nomenclature di sensori vendor-specifiche; backpressure obbligatoria. | DIFF-03, DIFF-05, TS-28 (backpressure), DIFF-04 (worker per aggregazioni) |
| **IoT control panels** (smart home, fleet management, energia) | Devices con vocabolari proprietari, comandi via REST + telemetria via MQTT/SSE/WS. Mapping fra payload device e modello canonico dell'app. | DIFF-01, DIFF-03, DIFF-05 |
| **Low-code platforms client-side** (form builder, automation con regole utente) | Configurazione runtime delle route (utente disegna flusso → genera definizione route SemBridge). Canonical model permette di sostituire un nodo con un altro. | DIFF-02, DIFF-08 |
| **Applicazioni white-label con integrazioni multiple** (un'app rebranded venduta a clienti diversi con backend diversi) | Stesso UI, backend diverso per cliente: il canonical model + adapter route astrae le differenze API. | DIFF-01, DIFF-03 |
| **Editor collaborativi browser-side** (con worker per parsing/diff e realtime per sync) | Worker per CRDT/diff; realtime per presence; broker per coordinare componenti UI (sidebar, editor, comments). | DIFF-04, DIFF-05, DIFF-02 |
| **Marketplace integration apps** (app che orchestrano API multiple: Shopify + Stripe + Mailchimp + …) | Vocabolari API enormemente eterogenei (customer/buyer/contact/recipient = stessa entità). Canonical model è il salvatore. | DIFF-01, DIFF-03 |
| **Embeddable SDK / Widget enterprise** (chat, support, analytics widget integrati in siti host) | Widget devono coesistere con l'host page senza accoppiamento; eventi del widget dichiarativi; backend gateway unico per autenticazione. | TS-03, TS-08, DIFF-08 |

### 4.2 Casi d'uso a MEDIA affinità (ROI dipende dalla scala)

| Caso d'uso | Quando ha senso | Quando NO |
|------------|-----------------|-----------|
| **SPA con backend REST + qualche WebSocket** | Quando il numero di componenti e di endpoint cresce abbastanza che il canonical model paga il costo di setup | Per app piccole basta `fetch` + Zustand + un event emitter |
| **PWA offline-first** | Quando si combina cache + realtime + worker | Service Worker stand-alone basta in casi semplici |
| **Multi-tenant SaaS con feature flags** | Se le feature flag attivano plugin diversi con vocabolari diversi | Se i flag sono solo UI toggles |

### 4.3 Casi d'uso a BASSA affinità (anti-fit)

- **Landing page statiche / siti vetrina** — overkill assoluto.
- **App single-page senza plugin di terze parti, con ≤3 endpoint REST** — `fetch` + un event emitter è sufficiente.
- **Mobile-only apps** — SemBridge è browser-side; per React Native o Capacitor i moduli realtime/worker hanno semantica diversa (rivalutare).

---

## 5. Mappa Fase → Feature (Roadmap Hint)

Sintesi per il consumer downstream (roadmap definition). Ogni fase del PRD §32 ha un set di feature dominante.

### Fase 1 — Core essenziale (PRD §32.1)
- TS-10 `createBroker(config)`
- TS-11..TS-13 publish/subscribe/unsubscribe + handle
- TS-14 plugin registry + lifecycle hooks
- TS-19 BrokerEvent struct
- TS-20 EventSourceDescriptor
- TS-21 naming convention
- TS-22 wildcard subscribe (consigliato)
- TS-23 trittico topic (convenzione)
- TS-32 Event Inspector (versione base)
- TS-35 log levels
- TS-37 validazione evento sintattica
- TS-31 isolation errori (base)

### Fase 2 — Canonical model + Mapper (PRD §32.2)
- TS-01 canonical model
- TS-02 mapper bidirezionale
- TS-16 registerCanonicalSchema / registerTransform
- TS-33 Mapping Inspector
- TS-38..TS-40 validazione payload/canonico/post-mapping
- DIFF-01 hero feature finalizzata

### Fase 3 — Routing + HTTP gateway (PRD §32.3)
- TS-03 gateway server unico
- TS-08 route dichiarative (local, http, cache, composite)
- TS-15 registerRoute / unregisterRoute
- TS-24 BrokerError standardizzato
- TS-25 eventi di errore standard
- TS-26..TS-30 retry, timeout, backpressure, dedupe, cancellazione
- TS-41 validazione response server
- DIFF-02, DIFF-03, DIFF-09 finalizzate

### Fase 4 — Realtime inbound (PRD §32.4)
- TS-04 ≥1 canale realtime (SSE prioritario)
- TS-17 connectRealtime / disconnectRealtime
- DIFF-05 finalizzata

### Fase 5 — Worker runtime (PRD §32.5)
- TS-05 Web Worker support (registry, pool, task tracking)
- DIFF-04 finalizzata

### Fase 6 — Cache + Tooling avanzato (PRD §32.6)
- Cache layer completo (in-memory + adapter IndexedDB opzionale)
- TS-34 Route Inspector
- TS-36 metriche complete
- TS-32 Event Inspector versione avanzata
- TS-18 getDebugSnapshot completo
- DIFF-06 finalizzato

---

## 6. Feature Dependencies

```
TS-19 BrokerEvent struct
   └──requires──> TS-20 EventSourceDescriptor
TS-11 publish + TS-12 subscribe
   └──require──> TS-19 BrokerEvent
TS-14 plugin registry
   └──requires──> TS-12 subscribe + TS-11 publish
TS-22 wildcard subscribe
   └──enhances──> TS-12 subscribe

TS-01 canonical model
   └──requires──> TS-19 BrokerEvent (per propagare metadata)
TS-02 mapper bidirezionale
   └──requires──> TS-01 canonical model
TS-16 registerCanonicalSchema
   └──requires──> TS-01 canonical model
TS-33 Mapping Inspector
   └──requires──> TS-02 mapper (per tracciare passaggi)
TS-38..TS-40 validazioni canonico
   └──require──> TS-01 canonical model

TS-08 route dichiarative
   └──requires──> TS-02 mapper (per canonicalizzare payload)
TS-03 gateway server
   └──requires──> TS-08 route http
TS-04 realtime inbound
   └──requires──> TS-03 gateway (per centralizzazione) + TS-02 mapper (per normalize)
TS-05 web worker support
   └──requires──> TS-08 route worker + TS-02 mapper (per serializzare canonical payload)

TS-32 Event Inspector
   └──enhances──> tutta la pipeline (PRD §28.1)
TS-34 Route Inspector
   └──requires──> TS-08 route + TS-32 event inspector
TS-36 metriche
   └──requires──> TS-32 event inspector

TS-26 retry policy
   └──conflicts──> idempotenza non garantita lato server (mitigare con TS-29 dedupeKey)
TS-28 backpressure (drop policy)
   └──conflicts──> guarantee-of-delivery (PRD non lo richiede, ma è un trade-off da documentare)
```

**Note dipendenze critiche:**
- **TS-02 (mapper) → TS-08 (route) → TS-03/TS-04/TS-05 (gateway/realtime/worker):** la canonicalizzazione interna completa di V1 (PRD §13.5) richiede che il mapper sia stabile prima di aggiungere route remote/worker. Fase 2 deve precedere fase 3.
- **TS-32 (Event Inspector) trasversale:** una versione base è necessaria già da Fase 1 per debugging della pipeline; la versione completa (con cache hit/miss e metriche) chiude in Fase 6.
- **TS-37..TS-41 validazioni:** introdotte gradualmente fase per fase. Validazione canonico (TS-39) richiede TS-01.

---

## 7. MVP Definition

### 7.1 Launch With (V1) — definizione PRD-conforme

V1 è il **superset minimo che soddisfa la checklist di conformità PRD §42**. Tutte le 15 voci della checklist devono essere positive.

- [ ] **Fase 1 completa** (TS-10..TS-23, TS-31, TS-32 base, TS-35, TS-37) — Core pubsub funzionante
- [ ] **Fase 2 completa** (TS-01, TS-02, TS-16, TS-33, TS-38..TS-40) — DIFF-01 hero feature finalizzata
- [ ] **Fase 3 completa** (TS-03, TS-08 route local/http/cache/composite, TS-15, TS-24..TS-30, TS-41) — gateway server unico operativo
- [ ] **Fase 4 minimo** (TS-04 con SSE almeno; WebSocket opzionale; TS-17) — ≥1 canale realtime inbound
- [ ] **Fase 5 minimo** (TS-05 con worker dedicato base; pool opzionale) — supporto worker
- [ ] **Fase 6 minimo** (cache in-memory CACHE-01..CACHE-03; TS-34 Route Inspector base; TS-36 metriche base) — tooling avanzato

### 7.2 Add After Validation (V1.x)

- [ ] WebSocket adapter completo (se V1 ha solo SSE)
- [ ] Worker pool con autoscaling
- [ ] Metriche export (Prometheus / OpenTelemetry)
- [ ] AsyncAPI export dei topic registrati
- [ ] Adapter framework UI (React hooks `useSubscribe`, `usePublish`)

### 7.3 Future Consideration (V2+)

- [ ] IndexedDB persistence adapter (PRD §20.3 lascia opzionale)
- [ ] Service Worker / Push notification bridge (PRD §18.7)
- [ ] CloudEvents format support (input/output)
- [ ] Visual route inspector UI (browser extension)
- [ ] Multi-broker federation (più broker collegati con canonical model condiviso)
- [ ] Adapter Effector / Redux / Zustand
- [ ] gRPC-Web adapter per il gateway

---

## 8. Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| TS-01 canonical model | ALTO | ALTO | P1 |
| TS-02 mapper bidirezionale | ALTO | ALTO | P1 |
| TS-03 gateway server unico | ALTO | ALTO | P1 |
| TS-04 realtime SSE | ALTO | MEDIO | P1 |
| TS-05 worker support | ALTO | MEDIO | P1 |
| TS-06 debug/introspection | ALTO | MEDIO | P1 |
| TS-07 lifecycle anti-leak | ALTO | MEDIO | P1 |
| TS-08 route dichiarative | ALTO | ALTO | P1 |
| TS-09 validazione minima | MEDIO | MEDIO | P1 |
| TS-10..TS-13 API publish/subscribe/unsubscribe | ALTO | BASSO | P1 |
| TS-14 plugin registry + lifecycle | ALTO | MEDIO | P1 |
| TS-19..TS-20 BrokerEvent + Source | ALTO | BASSO | P1 |
| TS-21 naming convention | MEDIO | BASSO | P1 |
| TS-22 wildcard subscribe | ALTO | MEDIO | P1 (consigliato dal PRD) |
| TS-24..TS-25 BrokerError + eventi std | ALTO | BASSO | P1 |
| TS-26..TS-30 robustness policies | ALTO | ALTO | P1 |
| TS-32..TS-34 Inspector | ALTO | MEDIO | P1 (Event/Mapping); P2 (Route avanzato) |
| TS-35 log levels | MEDIO | BASSO | P1 |
| TS-36 metriche | MEDIO | MEDIO | P2 (base) / P3 (export) |
| TS-37..TS-41 validation layers | ALTO | MEDIO | P1 |
| WebSocket adapter (oltre SSE) | MEDIO | MEDIO | P2 |
| Worker pool autoscaling | MEDIO | MEDIO | P2 |
| IndexedDB cache adapter | BASSO | MEDIO | P3 |
| Service Worker bridge | BASSO | ALTO | P3 |
| CloudEvents support | BASSO | BASSO | P3 |

**Legenda priorità:**
- P1 = Must-have per V1 (PRD vincola)
- P2 = Should-have post-V1 (V1.x)
- P3 = Future consideration (V2+)

---

## 9. Naming conventions e API surface

Convenzioni che emergono dalle librerie comparabili e dovrebbero ispirare l'API design.

### 9.1 Topic naming

- **Standard PRD §12.1:** dot-separated, minuscolo, semantico — `weather.requested`, `form.customer.submitted`
- **Trittico PRD §12.2:** `<entity>.<action>.requested` / `.succeeded` / `.failed` (consigliato; non vincolato)
- **Wildcard (PRD §12.3):** `*` come segment matcher (`weather.*`, `*.failed`, `form.customer.*`)

**Convenzione raccomandata:** allineata MQTT-style (segment-based wildcard) ma con `.` invece di `/`. Più leggibile in JS strings.

### 9.2 API ergonomics — pattern da librerie mainstream

| Pattern | Esempio in libreria nota | Applicazione SemBridge |
|---------|--------------------------|------------------------|
| **`subscribe` restituisce funzione unsubscribe** | RxJS `Subscription`, mitt `off`, browser `addEventListener` con AbortController | `const unsub = broker.subscribe(...); unsub();` + handle id alternativo |
| **Opzioni `{ once: true }`** | EventEmitter, RxJS `take(1)`, addEventListener `{ once: true }` | `broker.subscribe(topic, h, { once: true })` |
| **AbortSignal per cancellazione** | fetch, addEventListener (moderni), AbortController standard | `broker.subscribe(topic, h, { signal })` + `broker.publish(topic, p, { signal })` per request → response patterns |
| **Promise-based request/response** | `comlink`, `axios`, `ky` | `await broker.request('weather.requested', payload, { timeout, signal })` come zucchero sintattico sopra publish + subscribe-once |
| **`config` immutabile passata a factory** | TanStack Query `QueryClient`, Apollo `ApolloClient` | `createBroker(config)` come da PRD §16.1 |
| **Lifecycle hooks su plugin** | NestJS modules, Vue lifecycle, React hooks | `onRegister`, `onMount`, `onUnmount`, `onDestroy` come da PRD §15.5 |
| **Schema-first con type inference** | Zod, Valibot, Yup | Possibile adapter per validation, lasciato libero a developer (PRD §21.3) |

### 9.3 API surface raccomandata (sintesi)

Già fissata da PRD §16.2 e §16.3:

```ts
// Core (Fase 1)
broker.publish(topic, payload, options?)
broker.subscribe(topic, handler, options?)
broker.unsubscribe(subscriptionId)
broker.registerPlugin(pluginDescriptor)
broker.unregisterPlugin(pluginId)

// Routing + Mapper (Fase 2-3)
broker.registerRoute(routeDefinition)
broker.unregisterRoute(routeId)
broker.registerCanonicalSchema(schemaDefinition)
broker.registerTransform(name, fn)

// Realtime (Fase 4)
broker.connectRealtime()
broker.disconnectRealtime()

// Tooling (Fase 1 base + Fase 6)
broker.getDebugSnapshot()
broker.enableDebug()
broker.disableDebug()
broker.getMetrics()
broker.getTopicRegistry()
broker.getPluginRegistry()
broker.getRouteRegistry()
broker.pauseTopic(topic)
broker.resumeTopic(topic)
broker.flushQueue(topic?)
```

### 9.4 Naming canonical fields

- **snake_case raccomandato per campi canonici** (es. `forecast_date`, `temperature_celsius`, `weather_condition`) — coerente con esempi PRD §13.4, §29.
- **Plugin liberi di usare camelCase / kebab-case / italian / qualsiasi convenzione locale** purché dichiarino mapping (es. `data` → `forecast_date`).
- **Tipi canonici espliciti:** `string`, `number`, `boolean`, `date`, `enum`, `object`, `array` con eventuali constraint (min/max/regex). Allineato a JSON Schema / Zod.

---

## 10. Confronto: perché SemBridge e non "RxJS+ky+mitt assemblati"

Domanda esplicita del downstream consumer: cosa giustifica una libreria nuova vs comporre primitive esistenti?

| Dimensione | Stack composto (RxJS + ky + mitt + Comlink + EventSource) | SemBridge |
|------------|------------------------------------------------------------|-----------|
| **Canonical model + mapping bidirezionale** | Da implementare a mano per ogni progetto. ~1000-3000 LOC + tooling debug. | Built-in (DIFF-01). |
| **Plugin contract standard** | Da definire ad-hoc. Ogni progetto reinventa subscribes/publishes/inputMap. | Built-in (TS-14, DIFF-08). |
| **Routing dichiarativo cross-trasporto** | Da costruire orchestrando RxJS operators + custom dispatcher. | Built-in (TS-08, DIFF-02). |
| **Gateway server unico** | Da costruire wrappando ky + EventSource + WS + auth + retry. | Built-in (TS-03, DIFF-03). |
| **Worker integration come route** | Da costruire wrappando Comlink + correlation + timeout. | Built-in (TS-05, DIFF-04). |
| **Pipeline evento documentata** | Implicita, distribuita tra le librerie. Debug = N strumenti separati. | Esplicita PRD §28.1, ispezionabile uniformemente. |
| **Debug tooling integrato** | Redux DevTools per parte stato; nessun tool unificato per pipeline mapping → route → consegna. | Tre Inspector (TS-32..TS-34) con vista uniforme. |
| **Costo iniziale** | Setup veloce di librerie singole. | Maggiore (configurazione canonical model + routes). |
| **Costo a regime con N plugin di terzi** | Cresce N². Ogni plugin nuovo richiede contract bespoke con gli altri. | Cresce N. Plugin nuovi dichiarano mapping verso canonico, una volta. |
| **Debugging in produzione** | Distribuito tra N tool. | Centralizzato con `getDebugSnapshot`. |
| **Lifecycle leak prevention** | Da gestire manualmente per ogni libreria. | Built-in (TS-07). |

**Conclusione:** lo stack composto vince per progetti piccoli o senza plugin di terzi. SemBridge vince quando: (a) plugin di terze parti con vocabolari eterogenei, (b) dashboard/IoT/digital twin con realtime + worker + cache, (c) team multipli che devono interoperare senza accordi sui nomi dei campi, (d) richiesta esplicita di osservabilità centralizzata.

---

## 11. Gaps aperti (da risolvere in fase di design / implementation)

Non bloccanti per la roadmap ma da chiudere durante l'esecuzione delle fasi:

- **Libreria di validazione concreta** (PRD §21.3 lascia libero scegliere): scelta tipica tra Zod, Valibot, Ajv (JSON Schema). Decisione in Fase 2 design.
- **Algoritmo dedupe** (TS-29): semplice cache LRU in-memory con TTL, oppure bloom filter per scale alto. Decisione in Fase 3 design.
- **Worker pool strategy** (PRD §33.1 libera): dedicated vs pool con autoscaling. Decisione in Fase 5 design.
- **Schema topic registry persistence**: in-memory only o serializzabile (per AsyncAPI export futuro). Decisione opzionale in Fase 1.
- **Backpressure default policy**: drop oldest vs latest-only vs queue bounded. Decisione in Fase 3 design (può essere config-default `latest-only` con override per route).
- **Strategia di trasferimento worker payload**: structured clone vs transferable objects vs SharedArrayBuffer. Decisione in Fase 5 design (dipende dalle dimensioni payload tipiche).

---

## 12. Sources

### Fonti autoritative consultate

- `prd.md` (root del progetto SemBridge) — documento di prodotto integrale, §1-§42. Fonte primaria.
- `.planning/PROJECT.md` — sintesi GSD del progetto, sezione "Active requirements" e "Out of Scope".

### Conoscenza pregressa applicata (confidenza MEDIA, non riverificata in questa sessione causa restrizioni di tooling)

- API e pattern noti di: RxJS, redux-saga, redux-observable, Effector, mitt, EventEmitter3, nanoevents, Postal.js, Zustand, Jotai, Redux Toolkit, TanStack Query, urql, Apollo Client, ky, wretch, ofetch, Comlink, threads.js, workerpool.
- Pattern EAI di: Apache Camel (Enterprise Integration Patterns book di Hohpe & Woolf), Spring Integration, MuleSoft, NestJS CQRS module.
- Spec: AsyncAPI, CloudEvents (CNCF), MQTT topic naming, JSON Schema.

### Fonti che NON è stato possibile consultare in questa sessione

- WebSearch (denied)
- gsd-sdk websearch (BRAVE_API_KEY mancante)
- Context7 / ctx7 CLI (Bash su `npx` denied)

**Mitigazione:** Le affermazioni sulle librerie comparabili sono limitate a feature stabili e ampiamente documentate. Versioni specifiche, dettagli minori e novità recenti dovrebbero essere verificati durante la fase di design/implementation, in particolare per scegliere dipendenze interne (es. validation library, fetch wrapper). Non impatta la struttura della roadmap né la categorizzazione delle feature, che è ancorata al PRD.

---

*Ricerca feature per: SemBridge — middleware client-side event-driven con canonical model + gateway unificato*
*Data ricerca: 2026-04-28*
