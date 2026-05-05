# Sintesi Ricerca di Progetto — GlueZero

**Progetto:** GlueZero
**Dominio:** Libreria browser-side TypeScript-first (ESM) — middleware client-side event-driven con canonical model + mapper bidirezionale + gateway server unificato + worker runtime + developer tooling
**Researched:** 2026-04-28
**Confidenza complessiva:** MEDIO-ALTA (rationale architetturale ALTO; versioni esatte stack MEDIE per indisponibilità tool live)

---

## Executive Summary

GlueZero è un **runtime di orchestrazione client-side**, non un event emitter né un client HTTP. Combina sei capacità in un unico runtime coerente: pub/sub locale, routing dichiarativo cross-trasporto (`local`/`http`/`realtime`/`worker`/`cache`/`composite`), gateway server unico, worker integration come route type, canonical model con mapper bidirezionale, tre Inspector integrati (Event/Mapping/Route). Il valore differenziante centrale (PRD §13, PROJECT.md "Core Value") è il **canonical model con mapping bidirezionale**: plugin di terze parti con vocabolari eterogenei (`città`/`data` vs `location`/`day-prevision`) interoperano senza accordo preventivo sui nomi dei campi. Tutte le altre capacità sostengono o amplificano questo valore.

L'approccio raccomandato dalle ricerche è chiaro: **monorepo `pnpm` workspaces** con i sotto-sistemi del PRD §10 come package separati (`@gluezero/core`, `mapper`, `gateway`, `worker`, `cache`, `devtools`, `routing` + bundle aggregato `@gluezero/gluezero`); stack TypeScript 5.5+ → `tsup` → `Vitest` (con `@vitest/browser` per Worker/SSE/WS reali) → `Valibot` per validation tree-shakable; **niente wrapper esterni** per HTTP/EventBus/realtime — tutto in casa per fit perfetto col modello evento PRD §11; `Comlink` per RPC worker; `nanoid` per gli ID. Architetturalmente, il sistema è una trasposizione client-side dei pattern EAI (Hohpe & Woolf): Mediator + Pipes-and-Filters (14 step PRD §28) + Canonical Data Model + Channel Adapter + Strategy + Wire Tap. Il Core Broker non sa nulla di trasporto, il Routing Engine non sa nulla del trasporto specifico, il Gateway/Worker non sa nulla del modello canonico — separazione netta tra trasporto, semantica e governance.

I rischi principali da mitigare sono concentrati in tre aree: (1) **memory leak da subscribe persistenti** — risolto con API `subscribe → Subscription handle`, owner-based registry, `unregisterPlugin` con cascata obbligatoria; (2) **canonical model drift e ambiguità di alias** — risolto con MAP-17 ("mapping esplicito vince sempre"), schema canonico versionato, cycle detection; (3) **API design tranelli** — risolti in Fase 1 perché irrecuperabili dopo: handle obbligatorio, deep-freeze del payload, topic naming validato, niente singleton globale. Tutti gli 11 punti PRD §39 ("open issues da NON lasciare aperte") hanno una decisione raccomandata (vedi tabella §6 sotto). Vincolo cruciale identificato dall'architettura: l'**`EventTap` (Wire Tap pattern) deve essere instrumentato già in F1** — anche se l'implementazione completa è in F6 — altrimenti aggiungerlo in F6 richiede retrofit invasivo di tutti gli step di pipeline.

---

## Key Findings

### Recommended Stack

Stack opinionato e moderno, pensato per minimizzare bundle browser-side e massimizzare DX TypeScript. Riferimento dettagliato: `STACK.md`.

**Le 5 decisioni stack chiave:**

| # | Decisione | Versione (ultima nota) | Rationale | Confidenza |
|---|-----------|------------------------|-----------|------------|
| 1 | **TypeScript 5.5+ + `tsup` + ESM-only** primario, target ES2022, `moduleResolution: Bundler`, `verbatimModuleSyntax`, `isolatedDeclarations` | TS 5.5.x → 5.6.x; tsup 8.x | PRD §31 lo impone; ES2022 supportato da tutti gli evergreen; tsup zero-config su esbuild + dts integrato; CJS opt-in solo se richiesto | ALTO |
| 2 | **`Valibot` 1.x** per validation pubblica + canonical schemas, con adapter pluggable per Zod/Ajv | Valibot 1.x | API pipe tree-shakable: paghi solo gli schema importati (~1-3 KB per schema vs Zod ~12-13 KB intero). Inference TS al pari di Zod. Ottimo per libreria browser | MEDIO-ALTO |
| 3 | **EventBus, Gateway HTTP e adapter realtime in-house** sopra `fetch`/`EventSource`/`WebSocket` nativi | Niente deps | mitt/eventemitter3 troppo poveri per `BrokerEvent` con metadata/dedupe/backpressure/wildcard. RxJS overkill (~25-30 KB) e paradigma observable estraneo a PRD §16.2. ky/wretch/ofetch coprono solo 70-80% delle policy (retry/timeout/dedupe/auth/circuit) | ALTO |
| 4 | **`Comlink` 4.4.x** per RPC worker (Fase 5) + `structuredClone` nativo come default serializer | Comlink 4.4.x | API typed, ~1.1 KB gzipped, supporta transferable. Fit non perfetto col modello evento → mantenere astrazione `WorkerBridge` interna per swap futuro a RPC custom | MEDIO-ALTO |
| 5 | **Monorepo `pnpm` workspaces** (no Turbo/Nx in V1) con package per sotto-sistema PRD §10 + `nanoid` per ID, `Vitest` (jsdom + browser mode Playwright + msw) per test, `Biome` per lint/format, `Changesets` per versioning | pnpm 9.x; nanoid 5.x; Vitest 2.x | Sotto-sistemi PRD §10 naturalmente separabili → tree-shaking esplicito + versioning indipendente. nanoid 130 B vs uuid 5-6 KB. Vitest browser mode è state-of-the-art per Worker/SSE/WS reali | ALTO (monorepo) / MEDIO (granularità esatta) |

**Cosa NON usare** (motivazione esplicita):

- **`ky`/`wretch`/`ofetch`:** coprono 70-80% delle policy PRD §17.8/§22/§23 ma richiederebbero wrapping → indirezione inutile. Eventualmente `ofetch` come *implementation detail* mai esposto se ricostruire dedupe+retry+timeout supera 2 settimane in F3.
- **`reconnecting-websocket`:** copre ~30% delle policy PRD §18.6, impone API che andrebbe wrappata.
- **`eventsource-polyfill`:** inutile per browser evergreen, ~10 KB di carico.
- **`RxJS` nell'API pubblica:** ~25-30 KB, paradigma observable estraneo al PRD §16.2 (`broker.subscribe(topic, handler)` è callback-based, non `Observable<T>`). Eventuale uso interno per backpressure è dettaglio implementativo.
- **`mitt`/`eventemitter3` come base:** troppo magri rispetto al modello evento PRD §11 (no metadata strutturati, no wildcard, no dedupe, no backpressure, no priority, no TTL, no source descriptor). Costruirci sopra = reimplementare la maggior parte del broker.
- **`axios`** (~13 KB, no native fetch), **`Webpack`/`Parcel`** come bundler libreria, **`Jest`** (slow su ESM-only TS), **`uuid` v9** (5x più pesante di nanoid), **`Lerna`** (deprecato), **`socket.io-client`** (full-stack opinionato), **`reconnecting-websocket`/`eventsource-polyfill`** (sopra), **singleton globale `defaultBroker`** (rompe test isolation, dual-package hazard).

### Expected Features

41 capacità vincolanti estratte dal PRD §33.2 (9 hard) + PRD §42 (15 item checklist V1) + PRD §16/§11/§12/§22/§23/§25/§21. Riferimento dettagliato: `FEATURES.md`.

**Must-have (table stakes — non negoziabili dal PRD):**

Vincoli PRD §33.2:
- **TS-01** Canonical model interno (vocabolario, alias, tipi tipizzati) — Fase 2
- **TS-02** Mapper bidirezionale locale ↔ canonico ↔ locale con rename, nested, default, derive, format, units — Fase 2
- **TS-03** Broker come unico gateway server per fetch + realtime — Fase 3
- **TS-04** Fetch + ≥1 canale realtime inbound (SSE prioritario, WS opzionale ma in V1 almeno uno) — Fase 3+4
- **TS-05** Web Worker support (registry, pool, task tracking, timeout, cancellazione) — Fase 5
- **TS-06** Debug e introspezione (Event/Mapping/Route Inspector) — Fase 1 base + Fase 6 avanzato
- **TS-07** Lifecycle e cleanup anti memory-leak (cascade da `unregisterPlugin`) — Fase 1
- **TS-08** Route dichiarative (config-driven, mai hardcoded) per tutti i tipi — Fase 3
- **TS-09** Validazione minima dei payload (5 livelli PRD §21.2) — Fase 2/3

Checklist V1 PRD §42 (15 item) include sopra + struttura `BrokerEvent` (id/topic/timestamp/source/payload/metadata/correlationId/traceId/deliveryMode/priority/ttlMs/dedupeKey), naming convention dot-separated, wildcard subscribe, plugin registry con lifecycle hooks, `BrokerError` standardizzato, eventi standard di errore (`<topic>.failed`, `system.error`, `mapping.error`, `worker.error`, `network.error`), retry/timeout/backpressure/dedupe/cancellazione policies, log levels, metriche standard, ESM packaging, test su pub/sub+mapping+route+worker.

**Should-have (i 3-5 differenziatori principali di GlueZero):**

1. **Canonical model + mapper bidirezionale (DIFF-01, hero feature)** — nessuna libreria mainstream JS lo offre come feature core. Pattern noto in EAI server-side (Apache Camel "Message Translator", Spring Integration), assente client-side. Plugin di terzi con nomenclatura eterogenea interoperano senza accordo.
2. **Routing dichiarativo unificato cross-trasporto (DIFF-02)** — local/http/realtime/worker/cache/composite con stessa sintassi e stesso motore. RxJS, Redux Saga offrono operators generici, non un motore di route con tipi predefiniti.
3. **Gateway server unico (DIFF-03)** — auth, retry, timeout, dedupe, header, refresh token configurati una volta, applicati a tutto. TanStack Query/urql/Apollo coprono parte HTTP; nessuno copre HTTP+realtime+worker dietro un'unica governance.
4. **Worker integration come route type (DIFF-04)** — `type: 'worker', task: 'generateReport'`. Comlink offre RPC, ma GlueZero integra worker col canonical model + retry + cache + debug pipeline.
5. **Tre Inspector + pipeline deterministica (DIFF-06/DIFF-07)** — debug è first-class. Ogni evento ispezionabile lungo i 14 step PRD §28.1. Redux DevTools sono limitati allo state.

**Defer (post-V1):**
- WebSocket adapter completo (V1 OK con solo SSE)
- Worker pool con autoscaling
- Metriche export (Prometheus/OpenTelemetry/AsyncAPI)
- Adapter framework UI (`@gluezero/react`, `@gluezero/vue` con `useSubscribe`/`usePublish`)
- IndexedDB persistence (PRD §20.3 lascia opzionale; iniziare con `@gluezero/cache-idb` package separato in V1.x)
- Service Worker / Push notification bridge (V2+, PRD §18.7)
- CloudEvents / AsyncAPI export
- Visual route inspector UI (browser extension)
- Multi-broker federation
- Adapter Effector / Redux / Zustand

**Anti-features (esplicitamente fuori scope, PRD §5):** framework UI sostitutivo, state manager Redux-like come unica via, esecuzione server-side, motore BPMN/visual designer, mapping ambiguo automatico, accesso DOM da worker, mapping con side effect (es. fetch durante mapping → modellare come composite route).

### Architecture Approach

GlueZero è un **runtime di messaggistica in-process** che vive nel browser, trasposizione client-side dei pattern EAI di Hohpe & Woolf. Sei pattern combinati: **Mediator** (Core Broker), **Pipes-and-Filters** (pipeline 14 step PRD §28.1), **Canonical Data Model + Message Translator** (Mapping Engine), **Channel Adapter** (Gateway HTTP/SSE/WS, Worker, Cache), **Strategy** (RoutePolicies: retry/dedupe/backpressure/cache/error/auth), **Chain of Responsibility / Wire Tap** (osservabilità non intrusiva). Principio guida: **separazione netta tra trasporto, semantica e governance**. Riferimento dettagliato: `ARCHITECTURE.md`.

**Componenti principali e responsabilità:**

1. **Core Broker (Mediator)** — Event Bus + Topic Registry + Subscriber Registry + Plugin Registry + Lifecycle Manager + Pipeline orchestrator. Il Broker invia al Routing Engine **solo eventi canonici e validati** (step 5-6 della pipeline già completati).
2. **Mapping Engine (Translator)** — Canonical Vocabulary Registry + Alias Registry + Schema Registry + transform pipeline + mapping inspector. Il Mapper **non valida** (validation è ortogonale), produce solo MappingResult.
3. **Routing Engine (Strategy hub)** — Route Registry + Resolver + Executor con handlers `local`/`http`/`worker`/`cache`/`composite`. Routing Engine non chiama mai direttamente i subscriber locali — ritorna `RouteOutcome[]` al Broker che orchestra la consegna.
4. **Server Gateway (Adapters)** — `HttpClient` (fetch + retry/timeout/dedupe/auth/circuit) + `RealtimeChannelManager` (SSE adapter, WS adapter, reconnect policy con jitter, heartbeat/stale detection). Riceve `HttpRequest` già risolto dal Routing Engine.
5. **Worker Runtime (Adapters)** — `WorkerRegistry` + pool + `WorkerBridge` (Comlink wrapper) + task tracker + timeout driver. Canonicalizzazione **prima** del dispatch (PRD §19.4 step 3).
6. **Cache Layer (Adapters)** — `CacheStore` interface + `MemoryCacheAdapter` (default V1) + `IndexedDBAdapter` (opt-in V1.x). Chiave calcolata dal Routing Engine (canonicalization), non dal Cache Layer.
7. **Developer Tooling (Wire Tap, READ-ONLY)** — `EventTap` con `onPipelineStep(step, snapshot)` + Event/Mapping/Route Inspector + MetricsCollector + Logger. Passivo: riceve snapshot ma non può alterare la pipeline.

**Pipeline ufficiale 14 step (PRD §28.1):** Ingress → Enrich metadata → Validate event → Resolve source → Map output→canonical → Validate canonical → FlowController (dedupe + backpressure) → Resolve route → Execute route (Local/Http/Worker/Cache/Composite) → Collect outcome → Map canonical→consumer (per ciascun subscriber) → Validate post-mapping → Deliver → ObservabilityTap (cross-cutting su ogni step).

**Canonicalizzazione interna completa (PRD §13.5 default V1):** tutto entra nel Broker viene immediatamente canonicalizzato (step 5); internamente i dati transitano sempre canonici tra Broker/Routing/Cache/Worker; traduzione inversa solo all'ultimo miglio (step 11), una per consumer. Conseguenza: cache memorizza payload canonici → cache hit serve diversi consumer con `inputMap` differenti.

### Critical Pitfalls

17 pitfall categorizzati: 4 BLOCKING, 8 HIGH, 5 MEDIUM. Riferimento dettagliato: `PITFALLS.md`. I 5 più critici:

1. **Memory leak da subscribe persistenti (BLOCKING, Fase 1)** — Subscribe registrati al mount non rilasciati all'unmount; Subscriber Registry con strong references; `unregisterPlugin` non cascata. **Prevenzione:** API `subscribe(): Subscription` con `.unsubscribe()`; AbortSignal-first su tutti i metodi async; owner-based registry con `ownerId = pluginId`; `unregisterPlugin` enumera e cancella in cascata subscription, route, AbortController, MessageChannel worker, listener realtime; test deterministico TEST-01 obbligatorio (post `unregisterPlugin` tutti i counter di `getDebugSnapshot()` devono tornare a zero, tolleranza zero).

2. **Canonical model drift e ambiguità di alias (BLOCKING, Fase 2)** — `data` italiano = `date` o `dataset`? Shadowing tra plugin con stesso alias globale; schema canonico evolve senza versioning; mapping circolare. **Prevenzione:** MAP-17 "mapping esplicito dichiarato dal plugin vince SEMPRE sugli alias automatici" (alias = "suggerimenti" usati solo se nessun mapping esplicito); alias plugin-scoped vs globali; warning runtime obbligatorio (MAP-16) quando alias risolto; schema canonico versionato con `requires: { canonicalSchemas: { weather: '^1.0' } }`; cycle detection con `visited: Set<(pluginId, fieldName)>`; lint rule per descriptor plugin.

3. **API design tranelli — handle/naming/mutazione condivisa (BLOCKING, Fase 1)** — `subscribe` ritorna `void` (DX-killer); topic naming inconsistente (`weather.requested` vs `weather:requested` vs `weather/loaded`); mutazione condivisa del payload (Subscriber A muta payload, Subscriber B vede dati corrotti). **Prevenzione:** firma obbligatoria `subscribe(topic, handler, opts?): Subscription` con `id` + `unsubscribe()`; naming convention scolpita (CORE-08, dot-separated lowercase) validata al register con errore esplicito; **deep freeze del payload prima della consegna (immutability contract V1, decisione critica)** — alternative scartate: deep clone (overhead) e trust contract (impossibile far rispettare); tipi TS espliciti per `PublishOptions`/`SubscribeOptions` con JSDoc.

4. **Race condition request/response (HIGH, Fase 1+3+5)** — Doppia richiesta in volo (la più lenta sovrascrive la più recente); risposta arriva dopo cambio vista (`setState on unmounted`); worker timeout vs success (doppia pubblicazione contraddittoria a 5.001s `failed`, 5.050s `success`). **Prevenzione:** `correlationId` propagato end-to-end (CORE-05 lo prevede); policy `concurrency: 'latest-only' | 'serial' | 'parallel'` su route HTTP/worker (default consigliato `latest-only` per topic UI-driven con AbortController della precedente); `dedupeKey` esplicito; AbortSignal su `subscribe`; state machine atomico worker `{pending → done | timeout | error}` (transizioni esclusive con `taskId` lookup).

5. **Retry policy tossica (HIGH, Fase 3)** — Retry su 4xx (bug client, retry inutile + log spam server); retry senza idempotency token (POST duplicato → utente paga due volte); backoff senza jitter (thundering herd); retry infinito. **Prevenzione:** **default retry SOLO su errori di rete + 5xx + 408/429 (rispettando `Retry-After`); MAI su 4xx eccetto 408/429** (chiusura PRD §39 punto 8); idempotency token auto-generato per POST con `idempotency: { mode: 'auto', headerName: 'Idempotency-Key' }`; **jitter obbligatorio** `min(maxDelay, base * 2^attempt) * (0.5 + Math.random() * 0.5)` (full jitter); `maxAttempts` default 3 (Infinity con warning).

**Altri pitfall HIGH da considerare:** Realtime reconnect senza disciplina (SSE Last-Event-ID, WS heartbeat applicativo, reconnect storm, tab in background), Worker serializzazione (`DataCloneError` senza hint, MessageChannel non chiusi, pool senza limite, transferable detached), Cache invalidation (cache-then-network flicker, scope user-aware obbligatorio per security, immutability), Plugin isolation (try/catch obbligatorio attorno ad ogni handler, deep freeze payload, circuit breaker su plugin tossici), Sicurezza (token in localStorage, auth header su redirect cross-origin, URL allowlist bypass, scope auth per endpoint).

---

## Implications for Roadmap

Le 6 fasi PRD §32 sono già razionalmente ordinate (Core → Canonical → Routing → Realtime → Worker → Cache/Tooling) e mappate 1:1 sui sotto-sistemi PRD §10. La granularità è già `coarse-grained` come richiesto da PROJECT.md. La ricerca **conferma** la mappatura PRD e fornisce dettaglio operativo per ogni fase.

### Mappa Fase → Package monorepo → Stack → Pitfall → Decisioni architetturali

| Fase PRD §32 | Package monorepo (PRD §10) | Stack chiave | Pitfall principali da evitare | Decisioni architetturali da chiudere |
|---|---|---|---|---|
| **F1 — Core essenziale** | `@gluezero/core` | TS 5.5+, tsup, Vitest+jsdom, Biome, Changesets, nanoid, in-house EventBus, AbortSignal API | P1 memory leak (BLOCKING), P9 plugin isolation (HIGH), P11 API design (BLOCKING), P12 TypeScript pitfalls, P13 build/distribution, P16 wildcard scan (trie) | API `subscribe → Subscription`, owner-based registry, deep-freeze payload, naming validation, **`EventTap` interface + no-op (Wire Tap pre-instrumentato)**, no singleton globale, branded types per ID, trie per Subscriber Registry |
| **F2 — Canonical Model + Mapper** | `@gluezero/mapper` (Canonical Vocabulary, Alias, Transform, Validate) | Valibot 1.x + adapter pluggable; `@gluezero/validation` cross-cutting | P3 canonical model drift (BLOCKING), P10 validation noise/silenzi (MEDIUM), P12 TypeScript estendibilità canonical fields | MAP-17 priorità mapping esplicito, alias plugin-scoped, schema versioning con `requires`, cycle detection, mapping pipeline pre-compilata, scelta libreria validation (Valibot raccomandato) |
| **F3 — Routing + HTTP gateway** | `@gluezero/routing` + `@gluezero/gateway` (http) | fetch nativo + custom Gateway, msw per test | P2 race condition request/response (HIGH), P4 dedupe/backpressure (HIGH), P5 retry policy tossica (HIGH), P14 open issues §39 (#5 topic senza route, #6 più route, #8 retry), P17 sicurezza (auth scope, URL allowlist) | `RouteDefinition` discriminata via `type`, `RoutePolicies` (timeout/retry/dedupe/error/backpressure/auth), default `concurrency: 'latest-only'`, retry no-4xx + jitter, idempotency token, default policy multi-route `'first-match'`, default topic senza route = solo locale |
| **F4 — Realtime inbound** | `@gluezero/gateway/realtime` (SSE + WS adapter) | EventSource + WebSocket nativi + adapter custom | P6 realtime reconnect senza disciplina (HIGH), P14 #9 reconnection rules, P17 realtime authentication | SSE prioritario V1 (WS opzionale), `Last-Event-ID` per replay, ping/pong applicativo per WS + stale detection, exponential backoff full-jitter con cap 30s, `system.realtime.disconnected/reconnecting/connected` events, visibility-aware behavior |
| **F5 — Worker runtime** | `@gluezero/worker` (Bridge, Pool, Registry) | Comlink 4.4.x + structuredClone nativo + superjson opt-in | P7 worker pitfalls (HIGH — serializzazione/ownership), P14 #11 serializzazione messaggi worker | Pool bounded `min(hardwareConcurrency, 4)`, validatore `assertSerializable` pre-postMessage in dev mode, MessageChannel close esplicito su task end, transferable opt-in via `transferable: ['fieldA']`, state machine atomico `{pending → done | timeout | error}` per task, `WorkerBridge` astratto per swap futuro |
| **F6 — Cache + Tooling avanzato** | `@gluezero/cache` + `@gluezero/devtools` | Memory cache default; idb 8.x in `@gluezero/cache-idb` (V1.x); size-limit per CI gate | P8 cache invalidation (HIGH — scope user, ETag, immutability), P14 #10 formato metriche, P16 debug mode in production | Cache key scope-aware obbligatoria per route auth, deep clone (o structuredClone) su return, ETag/Last-Modified come V1.x, EventTap reali (Inspector/Metrics) si agganciano alle hook predisposte in F1-F5, debug mode auto-off in production con guard NODE_ENV |

### Vincolo critico architetturale: `EventTap` instrumentato in F1

Decisione architetturale forte (ARCHITECTURE.md §5.3): **F1 deve già emettere `EventTap` chiamate a ogni step di pipeline**, anche se ne esiste solo l'interfaccia + un'implementazione no-op. F2-F5 estendono via aggiunta di chiamate `tap.onPipelineStep` ai propri step. F6 si aggancia con implementazioni reali (Event/Mapping/Route Inspector + MetricsCollector).

**Perché:** il Tooling F6 si nutre di hook su tutta la pipeline. Aggiungerli in F6 retroattivamente significa toccare ogni filtro già implementato → retrofit doloroso, rischio di regression, ritardo F6. Pre-instrumentazione = costo marginale in F1 (interfaccia + no-op + chiamate puntuali) ma elimina debito tecnico ereditato.

### Phase Ordering Rationale

L'ordine 6 fasi PRD §32 è confermato dalla ricerca per le seguenti ragioni:

- **F1 prima di tutto** — le decisioni API (handle obbligatorio, deep-freeze, naming, no singleton, branded types) sono irrecuperabili: cambiarle dopo è breaking. `BrokerEvent`, plugin descriptor, `Logger`, `BrokerError` factory devono essere stabili.
- **F2 prima di F3-F5** — la canonicalizzazione interna completa (PRD §13.5) richiede Mapper stabile prima di aggiungere route remote/worker. F3 (HTTP) usa il Mapper per `queryMap`/`bodyMap`; F4 lo usa per server→canonical; F5 lo usa per worker payload canonici.
- **F3 prima di F4 e F5** — `RouteDefinition` con discriminator `type`, `RoutePolicies` (timeout/retry/auth) sono riusati da F4 e F5. F3 deve uscire considerando le policy comuni o F4/F5 dovrebbero retrofittare.
- **F4 e F5 parallelizzabili dopo F3** — sono ortogonali tra loro. Se le risorse lo permettono, possono procedere in parallelo.
- **F6 ultima ma con interfacce predefinite in F1** — Tooling consuma hook su tutta la pipeline. Cache layer ha dipendenze dichiarative su route handler già definiti in F3.

**Strategia di rilascio progressivo F2:** la fase può uscire prima con solo rename + transform, e aggiungere `$derive` + nested in iterazione successiva, **purché le firme delle funzioni siano stabili dal giorno 1** (TypeScript declaration merging permette estensione senza breaking).

### Research Flags

Phasi che meritano `gsd-research-phase` aggiuntivo durante planning (per dettaglio operativo):

- **Fase 3 (Routing + HTTP gateway):** la più rischiosa per varietà di pattern (retry/dedupe/backpressure/auth/circuit breaker), confidence MEDIO sul "fetch nativo + custom" — verificare se `ofetch` come implementation detail accelera l'implementazione. Dependency tree complesso (route handlers × policies × adapters). Aree da approfondire: idempotency key patterns, AbortController + dedupe race conditions, multi-route resolution.
- **Fase 4 (Realtime):** dettagli SSE+WS (Last-Event-ID, heartbeat applicativo, visibility API, fetch+ReadableStream per SSE con custom headers) richiedono ricerca specifica. Confidence MEDIO sul fit `EventSource` puro (no auth header standard).
- **Fase 5 (Worker):** trade-off Comlink vs RPC custom; pattern per cancellation Promise-aware; transferable best practices; worker pool autoscaling vs bounded; structured clone edge cases. Confidence MEDIO-ALTO ma sufficiente complessità da richiedere ricerca.

Phasi con pattern ben documentati (skip `gsd-research-phase`):

- **Fase 1 (Core):** EventBus in-house è codice ben noto (~300-500 LoC); pattern Mediator + Pipes-and-Filters ampiamente documentati; trie per topic matching ha riferimenti consolidati (MQTT brokers).
- **Fase 2 (Canonical + Mapper):** pattern EAI Hohpe & Woolf è la fonte autoritativa diretta; Valibot ha docs eccellenti; mapping pipeline pre-compilata è pattern noto (AJV `compile`).
- **Fase 6 (Cache + Tooling):** cache patterns standard (LRU + TTL + scope key); Wire Tap pattern già definito in F1; metrics OpenMetrics-like sono tassonomia consolidata.

### Tabella consolidata: 11 open issues PRD §39 con decisioni raccomandate

Il PRD §39 vieta esplicitamente di lasciare questi punti impliciti. Decisioni raccomandate da PITFALLS.md (sezione Pitfall 14):

| # | Open Issue PRD §39 | Decisione raccomandata | Fase | Severità |
|---|---|---|---|---|
| 1 | Precedenza alias automatici vs mapping esplicito | **Mapping esplicito vince SEMPRE** (MAP-17). Alias = suggerimenti solo se nessun mapping esplicito. Warning runtime quando alias risolto (MAP-16) | F2 | BLOCKING |
| 2 | Ordine pipeline mapping/validazione | **Pipeline ufficiale PRD §28.1 (14 step)** già definita. Implementata come `processEvent()` single-pass testabile, ogni step isolato | F1 (skeleton) + F2-F6 (riempimento) | BLOCKING |
| 3 | Field mancante: errore o default? | **Configurabile per campo nel canonical schema:** `required: true` (errore), `required: false` (default value se dichiarato, `undefined` altrimenti) | F2 | MEDIUM |
| 4 | Transform failure: skip o block? | **Configurabile per transform:** `onFailure: 'block' \| 'skip' \| 'fallback'`. Default `'block'` (drop event + error) | F2 | MEDIUM |
| 5 | Topic senza route | **Default: solo locale** (consegnato a subscriber). Non è errore. Opt-in `requiresRoute: true` nel topic schema per forzare | F3 | MEDIUM |
| 6 | Più route applicabili stesso topic | **Tre policy:** `'first-match'` (default + warning dev mode se altre matchano), `'priority-ordered'`, `'all'` | F3 | HIGH |
| 7 | Unsubscribe automatico in `unregisterPlugin` | **Cascade obbligatoria.** Verifica con `getDebugSnapshot()` zero post-unregister. Test deterministico TEST-01 | F1 | BLOCKING |
| 8 | Retry su 4xx vs 5xx | **NO retry su 4xx (eccetto 408, 429); SÌ retry su 5xx, network errors, timeout.** Configurabile per route. Idempotency token per POST | F3 | HIGH |
| 9 | Reconnection rules realtime | **Exponential backoff + full jitter, maxAttempts default Infinity con cap 30s, eventi `system.realtime.*` per stato.** Heartbeat applicativo WS, `Last-Event-ID` SSE | F4 | HIGH |
| 10 | Formato metriche | **JSON-serializable, semantica simil-OpenMetrics senza dipendenze esterne.** Schema `{ counters, gauges, histograms }` esposto da `getMetrics()`. Plugin Prometheus opzionale | F6 | MEDIUM |
| 11 | Serializzazione messaggi worker | **structured clone standard, transferable opt-in via `transferable: ['fieldA']`. Function NON consentite — usare `transformId` registrato.** Validatore `assertSerializable` pre-postMessage in dev mode | F5 | HIGH |

Strategia generale: ogni decisione documentata in (1) codice come constant + JSDoc, (2) docs `DOC-03/DOC-04`, (3) test che verifica il comportamento (test-as-spec).

---

## Confidence Assessment

| Area | Confidenza | Note |
|------|-----------|------|
| Stack | MEDIO-ALTO | Rationale architetturale ALTO (decisioni indipendenti dalle versioni esatte); versioni precise MEDIO causa indisponibilità tool live (WebSearch/Brave/Context7). Verifica `npm view <pkg> version` prima dell'install consigliata |
| Features | ALTO (table stakes / anti-feature) / MEDIO (comparazione librerie) | Vincoli PRD §33.2 + §42 ben definiti e tracciabili. Confronto con librerie comparabili basato su API pubbliche stabili e pattern documentati (ecosystem 2024-2025) |
| Architecture | ALTO | Pattern EAI Hohpe & Woolf consolidati; PRD §28 prescrittivo (14 step); contratti tipizzati derivabili direttamente dai requisiti PRD |
| Pitfalls | ALTO | La maggior parte documentata in PRD §22-§26, §39 o folklore consolidato del dominio event-driven middleware browser. 11 open issues §39 hanno decisioni esplicite |

**Confidenza complessiva:** MEDIO-ALTO

### Gaps to Address

Gap residui da chiudere durante planning/implementation (non bloccano la roadmap):

1. **Versioni esatte stack** — verificare `npm view <pkg> version` prima dell'install per: tsup, Vitest, Valibot, Comlink, nanoid, idb, TypeDoc, Biome, Changesets, TypeScript. Se una versione consigliata è > 1 anno indietro rispetto alla latest, leggere changelog per breaking changes.
2. **Libreria validation concreta finale** (PRD §21.3 lascia libero) — Valibot è la raccomandazione ma esporre adapter `Schema` interno con narrow `parse(input): Result<T>` permette swap futuro Zod/Ajv. Decisione finale in F2 design.
3. **HTTP client implementation detail** — F3 può usare `ofetch` come implementation detail mai esposto se ricostruire dedupe+retry+timeout supera 2 settimane. Decisione tactical in F3.
4. **Worker pool strategy** — dedicated vs pool con autoscaling. PRD §33.1 lascia libero. Decisione in F5 design (default `min(hardwareConcurrency, 4)` raccomandato).
5. **Algoritmo dedupe scale** — semplice cache LRU in-memory con TTL (sufficiente per V1) vs bloom filter per scale alto. Decisione in F3 design.
6. **Backpressure default policy** — drop oldest vs latest-only vs queue bounded. Decisione in F3 design (raccomandato `latest-only` per topic UI-driven con override per route).
7. **Strategia transfer worker payload** — structured clone vs transferable vs SharedArrayBuffer. Decisione in F5 design (dipende dalle dimensioni payload tipiche).
8. **Granularità monorepo finale** — 7 package proposti potrebbero consolidarsi in 4-5 se la separazione si rivelasse over-engineering. Verifica dopo F1+F2.
9. **Rolldown adoption** — Q3 2026+ Rolldown può sostituire tsup. Watch list: aggiornare la scelta se Rolldown raggiunge stabilità durante lo sviluppo V1.x.

---

## Sources

### Primarie (HIGH confidence)

- **`prd.md`** (root del progetto) — documento di prodotto integrale §1-§42, fonte autoritativa unica
- **`.planning/PROJECT.md`** — sintesi GSD del progetto (Active requirements CORE-*/MAP-*/ROUTE-*/RT-*/WK-*/CACHE-*/TOOL-*/VAL-*/ERR-*/TEST-*/PKG-*, Out of Scope, Constraints, Key Decisions)
- **TypeScript handbook** (Microsoft) — `isolatedDeclarations`, `verbatimModuleSyntax`, `moduleResolution: Bundler`
- **MDN** — `EventSource`, `WebSocket`, `Worker`, `structuredClone`, `postMessage`, Visibility API
- **Hohpe & Woolf — Enterprise Integration Patterns** (2003) — Mediator, Pipes-and-Filters, Canonical Data Model, Message Translator, Channel Adapter, Wire Tap (capp. 3, 4, 7, 8)

### Secondarie (MEDIUM confidence)

- **tsup, Vitest, Valibot, Biome, Changesets, TypeDoc** docs — feature, configurazione, best practice (knowledge cutoff Q4 2025)
- **Comlink GitHub README** (Google Chrome team) — RPC API, transferable, bundle size
- **Sindre Sorhus libraries** (ky/nanoid READMEs) — bundle size, API
- **pnpm workspaces docs** — `workspace:^` protocol, hoisting model
- **Caniuse.com** (training snapshot) — supporto browser ES2022, WebSocket, EventSource
- **Best practice consolidate del dominio:**
  - Pub/sub library design (mitt, eventemitter3, RxJS Subject patterns)
  - HTTP retry policies (Polly .NET, AWS SDK retry, Stripe idempotency, Google API client design)
  - WebSocket / SSE reconnect (Socket.IO, SSE WHATWG, reconnecting EventSource)
  - Web Worker structured clone (MDN, Chrome platform docs)
  - Node.js dual-package hazard (Node.js docs)
  - Cache key design (HTTP cache RFC 9111, SWR libraries patterns)
  - Browser background tab throttling (Chrome platform docs, MDN visibility API)
- **Pattern server-side che hanno influenzato il design:** Apache Camel (EIP DSL), Spring Integration (channels/gateways), NestJS CQRS (Command/Event bus), MuleSoft (integration platform), MQTT brokers (topic naming + wildcard)

### Terziarie (LOW confidence — da validare)

- **Versioni esatte stack (npm latest)** — non riverificate live in questa sessione (tool WebSearch/Brave/Context7 disabilitati). Verificare con `npm view` prima dell'install.
- **AsyncAPI / CloudEvents (CNCF)** — formato spec per event envelope; rilevante per eventuale roadmap futura V2+ (export AsyncAPI dei topic registrati)

### Fonti che NON è stato possibile consultare in questa sessione

- WebSearch (denied), gsd-sdk websearch (BRAVE_API_KEY mancante), Context7 / ctx7 CLI (Bash su `npx` denied)

**Mitigazione:** affermazioni su librerie comparabili limitate a feature stabili e ampiamente documentate. Versioni specifiche e novità recenti da verificare durante design/implementation, in particolare per scegliere dipendenze interne. Non impatta la struttura della roadmap né la categorizzazione delle feature, ancorate al PRD.

---

*Research completed: 2026-04-28*
*Ready for roadmap: yes*
