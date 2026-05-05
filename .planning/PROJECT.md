# GlueZero

## What This Is

GlueZero è una **libreria JavaScript browser-side** (TypeScript-first, distribuita ESM) che funge da middleware client-side orientato agli eventi. Combina sei capacità in un unico runtime: broker pub/sub interno alla pagina, routing dichiarativo verso locale/HTTP/realtime/worker/cache, gateway unico verso il server, runtime multitasking via Web Worker, modello dati canonico con mapper bidirezionale tra nomi locali dei plugin e vocabolario canonico, e developer tooling (Event/Mapping/Route Inspector). È pensata per sviluppatori che costruiscono pagine/SPA modulari con plugin di terze parti che usano nomenclature locali eterogenee e devono interoperare senza accoppiamento diretto.

## Core Value

**I plugin/componenti possono essere sviluppati indipendentemente, con la propria nomenclatura locale, e interoperare correttamente attraverso il vocabolario canonico del broker** — senza che gli autori debbano mettersi d'accordo sui nomi dei campi prima dello sviluppo. Tutto il resto (routing, gateway, worker, cache, tooling) serve a sostenere questo valore.

## Requirements

### Validated

**Phase 1 (Core essenziale)** — chiusa 2026-04-29 con gsd-verifier PASS confidence HIGH. 11/11 plans, 5/5 success criteria, 27 REQ-IDs CORE/VAL/ERR/LIFE/PKG/DOC validati (vedi `.planning/phases/01-core-essenziale/VERIFICATION.md`).

**Phase 2 (Canonical Model & Mapper)** — chiusa 2026-04-30, ready for verifier. 12/12 plans, 5/5 success criteria, 27 REQ-IDs F2 (MAP-01..MAP-17 + VAL-02..VAL-09 + ERR-02 ext + TEST-01..TEST-02 + DOC-03 + LIFE-02 ext F2 + PKG-04 ext F2). Open issues PRD §39 #1/#3/#4 chiusi (MAP-17/VAL-08/VAL-09).

**Phase 3 (Routing & Server Gateway HTTP)** — chiusa 2026-05-03, ready for verifier. 14/14 plans, 5/5 success criteria, 29 REQ-IDs F3 (ROUTE-01..ROUTE-16 + VAL-05 + ERR-02 ext + SEC-01..SEC-05 + TEST-01..TEST-03 + DOC-04 + LIFE-02 ext F3). Open issues PRD §39 #5/#6/#7/#8 chiusi (ROUTE-16/ROUTE-15/LIFE-02 ext F3/ROUTE-09).

### Active

#### Core broker (Fase 1)
- [ ] **CORE-01**: Esiste un event bus pub/sub in-page con `publish(topic, payload, options?)` e `subscribe(topic, handler, options?)`
- [ ] **CORE-02**: `subscribe` restituisce un handle che permette `unsubscribe(subscriptionId)` senza effetti residui
- [ ] **CORE-03**: Topic Registry tiene traccia di tutti i topic noti
- [ ] **CORE-04**: Subscriber Registry consente lookup dei subscriber per topic
- [ ] **CORE-05**: Ogni evento rispetta la struttura `BrokerEvent` (id, topic, timestamp, source, payload, metadata, correlationId, traceId, deliveryMode, priority, ttlMs, dedupeKey)
- [ ] **CORE-06**: `id` evento è univoco; `timestamp` valorizzato dal broker se assente; `source` obbligatorio
- [ ] **CORE-07**: Plugin registry: `registerPlugin(descriptor)` / `unregisterPlugin(id)` con lifecycle hooks (`onRegister`, `onMount`, `onUnmount`, `onDestroy`)
- [ ] **CORE-08**: Naming convention dei topic dot-separated minuscolo (es. `weather.requested`, `<entity>.<action>.<status>`)
- [ ] **CORE-09**: Wildcard subscribe (`weather.*`, `*.failed`)
- [ ] **CORE-10**: Logging base con livelli `silent | error | warn | info | debug | trace`
- [ ] **CORE-11**: Unsubscribe automatico quando un plugin è unregistered (no memory leak)

#### Canonical Model & Mapper (Fase 2)
- [ ] **MAP-01**: Esiste un Canonical Vocabulary Registry con campi canonici tipizzati e alias riconosciuti
- [ ] **MAP-02**: `registerCanonicalSchema(schemaDefinition)` per registrare schemi canonici
- [ ] **MAP-03**: Plugin dichiarano `inputMap` / `outputMap` per mapping locale ↔ canonico
- [ ] **MAP-04**: Mapper supporta rename semplice
- [ ] **MAP-05**: Mapper supporta mapping nested
- [ ] **MAP-06**: Mapper supporta default values
- [ ] **MAP-07**: Mapper supporta trasformazioni di formato (es. `parseItalianDate`)
- [ ] **MAP-08**: Mapper supporta normalizzazione unità di misura
- [ ] **MAP-09**: Mapper supporta derivazione di campo (`$derive` da campi multipli)
- [ ] **MAP-10**: Mapper supporta mapping parziale e validazione post-mapping
- [ ] **MAP-11**: `registerTransform(name, fn)` per registrare trasformazioni custom
- [ ] **MAP-12**: Pipeline di trasformazioni con gestione errori e fallback
- [ ] **MAP-13**: Default V1: canonicalizzazione interna completa (i dati transitano canonicalizzati)
- [ ] **MAP-14**: Mapping bidirezionale: canonico → locale plugin in consegna ai consumer
- [ ] **MAP-15**: Mapping inspector: mostra payload originale, canonico, finale, trasformazioni applicate, warning di ambiguità
- [ ] **MAP-16**: Warning runtime quando un alias è potenzialmente ambiguo
- [ ] **MAP-17**: Mapping esplicito dichiarato dal plugin prevale sempre sugli alias automatici

#### Routing engine + HTTP gateway (Fase 3)
- [ ] **ROUTE-01**: `registerRoute(routeDefinition)` / `unregisterRoute(routeId)`
- [ ] **ROUTE-02**: Tipo route `local` (consegna a subscriber interni)
- [ ] **ROUTE-03**: Tipo route `http` con `request` (method, url, queryMap, bodyMap), `publishes.success`, `publishes.error`
- [ ] **ROUTE-04**: Tipo route `cache` (cache-first/network-first/cache-then-network)
- [ ] **ROUTE-05**: Tipo route `composite` (workflow check-cache → server → update-cache → publish)
- [ ] **ROUTE-06**: Server Gateway centralizza tutte le richieste fetch/AJAX
- [ ] **ROUTE-07**: Header auth gestiti centralmente; supporto a token refresh tramite hook/adapter
- [ ] **ROUTE-08**: Policy per route: timeout, retry (con backoff esponenziale opzionale), dedupe, error policy, mapping policy, auth policy
- [ ] **ROUTE-09**: Differenziazione retry su errori 4xx vs 5xx (non lasciata implicita)
- [ ] **ROUTE-10**: Backpressure: queue bounded, drop policy, throttle, debounce, latest-only, merge/coalesce
- [ ] **ROUTE-11**: Deduplica via `dedupeKey` o logica route-specific
- [ ] **ROUTE-12**: Pubblicazione automatica eventi `<topic>.failed` su errore route remota
- [ ] **ROUTE-13**: Comportamento esplicito con più route applicabili allo stesso topic (priorità o policy documentata)
- [ ] **ROUTE-14**: Comportamento esplicito con topic senza route (es. solo locale o errore)

#### Realtime inbound (Fase 4)
- [ ] **RT-01**: SSE adapter (`Server-Sent Events`) per inbound server → browser
- [ ] **RT-02**: WebSocket adapter (opzionale ma in V1 almeno uno tra SSE e WS deve essere disponibile)
- [ ] **RT-03**: `connectRealtime()` / `disconnectRealtime()` per gestione canale
- [ ] **RT-04**: Messaggi server convertiti in eventi interni con `source: { type: 'server', id: 'realtime-channel', name: 'sse'|'websocket' }`
- [ ] **RT-05**: Reconnection policy configurabile (retry interval, exponential backoff, max retry, heartbeats, stale connection detection, jitter)
- [ ] **RT-06**: Normalizzazione payload inbound dal server verso il modello canonico

#### Worker runtime (Fase 5)
- [ ] **WK-01**: Worker registry con creazione/riuso di worker dedicati o pool
- [ ] **WK-02**: Tipo route `worker` con `worker`, `task`, `publishes.success`, `publishes.error`
- [ ] **WK-03**: Task correlation (correlazione task ↔ evento risultante)
- [ ] **WK-04**: Propagazione errori worker → broker
- [ ] **WK-05**: Pubblicazione eventi `<topic>.completed`, `<topic>.progress`, `<topic>.failed`
- [ ] **WK-06**: Timeout task configurabile e cancellazione task
- [ ] **WK-07**: Serializzazione messaggi worker (formato e contratto documentati)

#### Cache + tooling avanzato (Fase 6)
- [ ] **CACHE-01**: In-memory cache con chiave configurabile per route/topic
- [ ] **CACHE-02**: TTL configurabile e invalidazione manuale/automatica
- [ ] **CACHE-03**: Metadata di consegna distingue origine `cache` vs `remote`
- [ ] **TOOL-01**: Event Inspector: topic, publisher, timestamp, payload originale/canonico, subscriber raggiunti, route attivate, esito, errori, tempi
- [ ] **TOOL-02**: Route Inspector: route intercettata, policy applicate, esito remote/worker, retry, cache hit/miss
- [ ] **TOOL-03**: Metrics: eventi/sec, eventi scartati, errori per categoria, tempi medi route HTTP/worker, cache hit ratio, subscriber per topic, backlog
- [ ] **TOOL-04**: `enableDebug()` / `disableDebug()` e `getDebugSnapshot()`
- [ ] **TOOL-05**: `pauseTopic(topic)` / `resumeTopic(topic)` / `flushQueue(topic?)`

#### Cross-cutting (tutte le fasi)
- [ ] **VAL-01**: Validazione evento (sintattica)
- [ ] **VAL-02**: Validazione payload topic
- [ ] **VAL-03**: Validazione modello canonico
- [ ] **VAL-04**: Validazione post-mapping
- [ ] **VAL-05**: Validazione risposta server
- [ ] **VAL-06**: Schema definitions chiare (JSON Schema o equivalente tipizzato)
- [ ] **ERR-01**: `BrokerError` con `code`, `message`, `category`, `details`, `originalError`, `routeId`, `topic`, `eventId`
- [ ] **ERR-02**: Eventi standard: `<topic>.failed`, `system.error`, `mapping.error`, `worker.error`, `network.error`
- [ ] **ERR-03**: Errori isolati: il runtime non collassa salvo guasto critico
- [ ] **TEST-01**: Unit test su pub/sub, unsubscribe, wildcard, mapping, reverse mapping, trasformazioni, dedupe, retry/timeout, route HTTP, route worker, realtime normalization, lifecycle cleanup
- [ ] **TEST-02**: Integration test: plugin A → broker → plugin B con mapping diverso; plugin → broker → server → broker → plugin; plugin → broker → worker → broker → plugin; cache hit/miss; reconnect realtime; error propagation
- [ ] **TEST-03**: Test di robustezza: storm di eventi, plugin mal configurato, server con schema inatteso, worker timeout, riconnessione ripetuta, topic con molti subscriber
- [ ] **PKG-01**: Distribuzione ESM (UMD/IIFE opzionale per pagine legacy)
- [ ] **PKG-02**: TypeScript come linguaggio di sviluppo
- [ ] **PKG-03**: Target browser moderni evergreen; polyfill separati dal core
- [ ] **DOC-01**: Documentazione API pubblica
- [ ] **DOC-02**: Guida integrazione plugin
- [ ] **DOC-03**: Documentazione canonical model + mapper
- [ ] **DOC-04**: Documentazione route engine + server gateway
- [ ] **DOC-05**: Esempi end-to-end (incluso scenario meteo PRD §29)
- [ ] **DOC-06**: Documentazione debug tooling

### Out of Scope

- **Framework UI completo (React/Vue/Angular sostitutivo)** — il PRD §5 lo esclude esplicitamente: la libreria può integrarsi con framework UI ma non li sostituisce
- **State manager globale stile Redux come unica via** — esplicitamente escluso (PRD §5)
- **Esecuzione logica server-side** — fuori scope (PRD §5)
- **Motore BPMN / workflow visual designer** — fuori scope (PRD §5)
- **Mapping semantico ambiguo automatico senza configurazione esplicita** — esplicitamente escluso: il mapping esplicito dichiarato dal plugin prevale sempre (PRD §14.7)
- **Accesso DOM dai worker** — vincolo browser, non aggirabile (PRD §5, §19.5)
- **Service Worker / Push notification bridge** — V1 non lo include; rimandato a release successive (PRD §18.3, §18.7)
- **IndexedDB persistence** — opzionale, non obbligatorio per V1 (PRD §20.3)
- **Benchmark numerici rigidi** — il PRD §34.2 lascia obiettivi qualitativi senza soglie numeriche

## Context

- **Fonte autoritativa unica**: `prd.md` nella root del progetto. Il PRD è esplicitamente "l'unica base informativa condivisa con il developer" (sezione 1) e deve essere sufficiente per progettare e implementare senza assumere dettagli non espressi.
- **Problema risolto**: applicazioni browser complesse soffrono di accoppiamento forte, fetch sparsi, duplicazione integrazione backend, eterogeneità dei nomi dei campi tra autori diversi, assenza di parallelismo reale, scarsa osservabilità (PRD §3).
- **Pattern centrale**: middleware client-side orientato agli eventi con orchestrazione, routing e adattamento semantico — non un semplice event emitter.
- **Esempio di riferimento end-to-end**: scenario "previsione meteo" (PRD §29) — plugin form emette `città`/`data`, plugin widget consuma `location`/`day-prevision`, server espone `/api/weather`. Tutto orchestrato da broker + canonical model + mapper bidirezionale + route HTTP.
- **Pipeline ufficiale evento** (PRD §28.1): ricezione → arricchimento metadata → validazione sintattica → identificazione source → mapping output→canonico → validazione canonico → dedupe/backpressure → resolve route → cache/http/worker/realtime/local → raccolta esiti → mapping canonico→input consumer → validazione finale → consegna → logging/metrics.

## Constraints

- **Tech stack**: TypeScript per il sorgente; build distribuibile in JavaScript compilato — solidità del contratto interno (PRD §31.2)
- **Packaging**: ESM come modulo moderno; UMD/IIFE opzionale per pagine legacy (PRD §31.1)
- **Browser target**: evergreen moderni; polyfill separati dal core (PRD §31.3)
- **Vincoli architetturali NON negoziabili** (PRD §33.2): canonical model, mapper bidirezionale, broker come unico gateway server per i flussi coperti, fetch + ≥1 canale realtime inbound, supporto Web Worker, debug e introspection, gestione lifecycle anti-leak, route dichiarative, validazione minima dei payload
- **Sicurezza**: la libreria è strato di governance client, non sostituto di sicurezza server-side (PRD §26.3)
- **Worker constraints**: dati trasferiti devono essere serializzabili o transferable; no DOM access da worker (PRD §19.5)
- **Modello AI per agenti GSD**: tutti i sotto-agenti devono usare `claude-opus-4-7-1` (alias `opus` per Claude Code; profilo GSD `quality`)
- **Lingua**: tutta l'interazione utente in italiano (vincolo di sessione)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Roadmap a 6 fasi PRD §32 | Ordine implementativo già razionale e gerarchico (Core → Canonical → Routing → Realtime → Worker → Cache/Tooling); ogni fase si appoggia alla precedente | — Pending |
| Granularità GSD = `coarse` | 6 fasi del PRD sono già coarse-grained; mantenere la corrispondenza 1:1 fase-PRD ↔ fase-GSD | — Pending |
| Profilo GSD = `quality` (Opus per agenti) | Vincolo utente: solo `claude-opus-4-7-1` per tutti gli agenti; profilo `quality` è il più allineato | — Pending |
| Canonicalizzazione interna completa di default (V1) | PRD §13.5 raccomanda esplicitamente questo modello per V1 — semplifica debug, route, logging, interoperabilità | — Pending |
| TypeScript come linguaggio sviluppo | PRD §31.2 lo raccomanda fortemente per solidità contratto interno | — Pending |
| ESM packaging primario | PRD §31.1 — modulo moderno standard | — Pending |
| Realtime V1: SSE prioritario, WebSocket opzionale | PRD §18.3-§18.4: SSE più semplice e robusto quando serve solo server → browser; WS se necessaria bidirezionalità | — Pending |
| Auto-mode GSD attivo | Documentazione (PRD) sufficiente come autorità; minimizzazione domande utente già esplicita nelle istruzioni di sessione | — Pending |
| Branching strategy = `none` | Default GSD; valuteremo se introdurla quando partirà l'esecuzione di phase | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-03 after Phase 3 (routing-server-gateway-http) closure — 14/14 plans, 5/5 success criteria, 29/29 REQ-IDs F3 verificati, 200 test F3 (103 routing + 97 gateway), 248/248 core + 183/183 mapper invariati (D-83 strict ✓). Open issues PRD §39 #5/#6/#7/#8 chiusi (ROUTE-16/ROUTE-15/LIFE-02 ext F3/ROUTE-09). Pattern composition wrapper (RouterBroker = wrap(MapperBroker)) replicato da F2 D-49 → D-83. Cyclic dep routing↔gateway (type-only) gestito via 4-pass build (build:f3 root script). Lesson learned: bundle size budget pre-implementation sotto-stimato sistematicamente per F3+ (mapper 5→9.68 KB = 1.94x F2; routing 6→19.15 KB = 3.2x F3 — pattern raised post-implementation con +20-30% headroom). BLOCKER 4 fix iter 1 in plan 03-12: type-isolated bind del CanonicalRegistry private F2 con loud throw + opt-in `requiresRouteTopics` bypass (D-100). PostToolUse hook efficacia confermata: TRACKER.md auto-update post-commit per persistence anti-clear/crash.*
