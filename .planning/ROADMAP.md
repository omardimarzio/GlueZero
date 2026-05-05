# Roadmap: SemBridge

**Created:** 2026-04-28
**Granularity:** coarse (allineata 1:1 con PRD §32)
**Coverage:** 91/91 requisiti v1 mappati
**Mode:** yolo · Parallelization: enabled · Model profile: quality
**Fonte autoritativa:** `prd.md` (root del progetto)

## Phases

- [x] **Phase 1: Core essenziale** ✅ **COMPLETE** (11/11 plans, gsd-verifier PASS confidence HIGH) — Event bus pub/sub in-page, plugin registry con lifecycle anti-leak, struttura `BrokerEvent`, EventTap pre-instrumentato. Vedi `.planning/phases/01-core-essenziale/VERIFICATION.md`.
- [x] **Phase 2: Canonical Model & Mapper** ✅ **COMPLETE** (12/12 plans, ready for verifier) — Vocabolario canonico + mapper bidirezionale locale ↔ canonico ↔ locale con transform pipeline e Mapping Inspector. Closed: 2026-04-30.
- [x] **Phase 3: Routing & Server Gateway HTTP** ✅ **COMPLETE** (14/14 plans, ready for verifier) — Routing engine dichiarativo (`local`/`http`/`cache`/`composite`) + gateway HTTP unico con retry/timeout/dedupe/auth. Closed: 2026-05-03.
- [x] **Phase 4: Realtime inbound (SSE prioritario, WS opzionale)** ✅ **COMPLETE** (9/9 plans, ready for verifier) — Adapter SSE + WebSocket con reconnection policy unificata, normalizzazione canonica via mapper F2 invariato, auto-fallback SSE→WS, ping/pong applicativo D-111, visibility-aware behavior, cascade cleanup ext F4. Closed: 2026-05-04.
- [x] **Phase 5: Worker Runtime** ✅ **COMPLETE** (7/7 plans, ready for verifier) — Worker Registry + Worker Pool bounded `min(hwc, 4)` cap 8 + WorkerBridge Comlink wrap + state machine atomico Pitfall 2C closure (D-133) + cancellation hybrid dedicated/cooperative (D-131, D-132) + progress events Comlink callback proxy throttled (D-135-D-138) + serialization WK-07 documentata (D-139-D-142, structuredClone default + transferable JSONPath opt-in) + composition wrapper Opzione B preserva D-83 strict. Closed: 2026-05-05.
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
- [x] 01-09-PLAN.md — PipelineHarness fixture + integration tests (5 success criteria + LIFE-02 deterministico) — completato 2026-04-28 (8 commits: a3d2fb6+c62b4ce + 5 atomic chunks tematici + 4ad7ed3 docs; PipelineHarness + 8 integration test in `__integration__/`, 46 nuovi test; tutti i 5 success criteria di Phase 1 coperti)
- [x] 01-10-PLAN.md — Robustness tests (storm, wildcard-perf, plugin-fault, concurrent-unregister) — completato 2026-04-29 (5 commits atomic chunks: 960fb62, 950b7ea, f1adb1d, 468b3a5 + 5e4c2db docs; 4 file robustness test + SUMMARY, 11 nuovi test; performance budget rispettati con margini ampi: storm 24ms vs 10s, wildcard 11ms vs 50ms; TEST-03 done)
- [x] 01-11-PLAN.md — Build verification (publint + attw + size-limit) + DOC-01 README + JSDoc — completato 2026-04-29 (5 commits: 947f37c README, 9d9873a JSDoc runtime, 31e6b70 JSDoc types, f00d914 ci gates, efc6554 docs SUMMARY; tutti i gate passati: publint OK, attw esm-only OK, size-limit 6.14 KB/8 KB = 76% budget; DOC-01 + PKG-04 done)
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

**Plans**: 12/12 complete (02-01 scaffold + 02-02 types + 02-03 canonical-registry + 02-04 alias-registry + 02-05 transform-pipeline + 02-06 valibot-adapter + 02-07 mapper-engine + 02-08 inspector + 02-09 augment+barrel + 02-10 broker-wrapper + 02-11 integration-tests + 02-12 final-gate F2)
**Status**: ✅ COMPLETE — ready for verification (gsd-verifier Phase 2)
**Closure date**: 2026-04-30
**Test coverage**: 16 mapper test files / 149 test passing (vs 248 core invariati — D-49 strict)
**CI gates**: publint ✅, attw ESM-only ✅, size-limit (mapper 9.68 KB / 12 KB budget) ✅, biome ✅, typecheck ✅
**Open issues PRD §39 chiusi**: #1 (MAP-17), #3 (VAL-08), #4 (VAL-09)
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

**Plans**: 14 plans
- [x] 03-01-PLAN.md — Bootstrap @sembridge/routing + @sembridge/gateway (subpath exports + sideEffects)
- [x] 03-02-PLAN.md — Public types F3 (RouteDefinition discriminated union, GatewayConfig, 7 Strategy interfaces, GatewayErrorCode)
- [x] 03-03-PLAN.md — augment.ts routing (PluginDescriptor.routes + BrokerConfig.routes/gateway + CanonicalSchema.requiresRoute) + barrel + sideEffects
- [x] 03-04-PLAN.md — augment.ts gateway (BrokerConfig.gateway) + http subpath barrel
- [x] 03-05-PLAN.md — RouteResolver dispatch table pre-compilato + 3 strategies (first-match/priority-ordered/all-broadcast) + cascade unregisterByOwner (D-86) — completato 2026-05-02 (3 commits: 1e98688 RED, cc9630e GREEN RouteResolver+strategies, 1703265 strategies test; 30/30 routing test; D-83 strict OK; ROUTE-15 chiuso runtime)
- [x] 03-06-PLAN.md — RouteExecutor dispatch by type + 3 route handlers (local/cache stub F6/composite workflow) + AbortController tracking
- [x] 03-07-PLAN.md — OutcomeCollector step 10 (publish loaded/failed shape D-80, network.error secondario D-81, recursion guard D-82)
- [x] 03-08-PLAN.md — HttpGateway core + policy chain + url-allowlist (Pitfall 7) + retry-after-parser + combine-signals + http-handler integrazione mapper+gateway+VAL-05 — completato 2026-04-30 (6 commits: 1f265fc RED utility + 61014e8 GREEN utility + 1dc5a86 RED HttpGateway + 99a1d73 GREEN HttpGateway + bf1477d RED http-handler + 32c3eb8 GREEN http-handler; 35/35 test passing — 15 utility + 13 HttpGateway+factory + 7 http-handler; routing 58/58 + gateway 33/33 zero regressioni; D-83 strict OK; ROUTE-03/ROUTE-06/ROUTE-13/SEC-04/SEC-05/VAL-05 chiusi runtime)
- [x] 03-09-PLAN.md — Strategy primitives Wave 4-A: retry (D-69 chiusura ROUTE-09 4xx/5xx/408/429), timeout, idempotency (D-70 SEC-03 Pitfall 3 fix)
- [x] 03-10-PLAN.md — Strategy primitives Wave 4-B: dedupe (D-74 KeyBased Promise singleton), backpressure (D-75 6 policy + critical bypass Pitfall 4)
- [x] 03-11-PLAN.md — Strategy primitives Wave 4-C: auth (D-72 single-flight refresh Pattern 5 Pitfall 5), circuit-breaker (D-99 opt-in DISABLED default)
- [x] 03-12-PLAN.md — RouterBroker composition wrapper + RouterEngine glue + createRouterBroker factory + LIFE-02 ext F3 cascade (D-86)
- [x] 03-13-PLAN.md — createRouterHarness + 6 integration test (scenario meteo HTTP D-89, retry, dedupe, latest-only, allowlist, cascade cleanup) — completato 2026-05-03 (2 commits: 15440a0 harness+msw setup, 63cceb9 6 integration test); 16/16 nuovi integration test passing + 87/87 unit invariati = 103/103 routing total; D-83 strict OK; 5 success criteria F3 ROADMAP coperti; REQ TEST-01/02/03 subset F3 + ROUTE-09/13 + SEC-05 + LIFE-02 ext F3 chiusi
- [x] 03-14-PLAN.md — Final gate F3: coverage v8 + publint/attw/size-limit + DOC-04 README + JSDoc API + ROADMAP/STATE update — completato 2026-05-03 (3 commits: 86790f0 README italiani routing+gateway 600 LOC, 660fec6 biome cleanup + manual TS fix, 9922a36 CI gates extension + size budget realistic); routing 92.4/84.3/92.6/95.1 (statements/branches/functions/lines), gateway 86.3/77.7/90/88.5 — coverage v8 misurata + thresholds calibrati post-implementation; publint 4/4 OK, attw 4/4 ESM-only OK, size-limit (core 6.17/8 KB, mapper 11.66/12 KB, routing 19.15/24 KB raised lesson learned, gateway/http 6.4/8 KB); 248 core + 183 mapper invariati (D-83 strict ✓); REQ DOC-04 + PKG-04 chiusi; 4 open issues PRD §39 chiusi cumulativamente (#5/#6/#7/#8)

**Status**: ✅ COMPLETE — ready for verification (gsd-verifier Phase 3)
**Closure date**: 2026-05-03
**Test coverage**: 16 routing test files (103 test) + 14 gateway test files (97 test) = 30 file / 200 test F3 (di cui 16 integration nuovi nel plan 03-13)
**CI gates**: publint ✅ (4/4 packages), attw ESM-only ✅ (4/4), size-limit ✅ (routing 19.15/24 KB raised, gateway/http 6.4/8 KB), biome ✅, typecheck ✅
**Coverage v8**: routing 92.44% statements / 84.30% branches / 92.59% functions / 95.11% lines; gateway 86.31% statements / 77.73% branches / 90.00% functions / 88.46% lines
**Open issues PRD §39 chiusi**: #5 (ROUTE-16), #6 (ROUTE-15), #7 (LIFE-02 ext F3), #8 (ROUTE-09)
**Needs research**: yes (consumed)
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

**Plans**: 9 plans
- [x] 04-01-PLAN.md — Bootstrap @sembridge/gateway/sse-ws + augment + types F4 (Wave 1) — completato 2026-05-04 (2 commits: d090a1b feat scaffold + 2624c66 chore build/test config; 6 nuovi file 503 LOC + 4 modificati; 8 test smoke decl merging passed; 105/105 gateway suite; D-83 strict ✓; placeholder F1 in core/types/plugin.ts:50 chiuso via decl merging additive; subpath @sembridge/gateway/sse-ws risolvibile; RT-01/RT-02/RT-03/RT-05 type-level done)
- [x] 04-02-PLAN.md — frame-parser.ts (envelope JSON D-106 + isInternalTopic strict anti-AP-6) (Wave 2) — completato 2026-05-04 (2 commits TDD: 26cc3c2 RED test + edcbf3b GREEN feat; 3 nuovi file 332 LOC: types/frame-envelope.ts 50 + frame-parser.ts 140 + frame-parser.test.ts 142; 15/15 frame-parser test passed; 120/120 gateway suite + 654/654 monorepo full PASS; D-83 strict ✓ — zero modifiche fuori `gateway/src/sse-ws/`; PITFALL §11.7 chiusura Q1 anti-AP-6 verificato — `grep startsWith('__')` = 0 in source code; Q2 closure 04-CONTEXT — riuso ERR-02 ext F3 `network.error` per frame parse errors; building blocks pronti per consumer 04-06 websocket-adapter)
- [x] 04-03-PLAN.md — reconnect-strategy.ts (full jitter D-109 + auto-fallback D-107 + consolidationMs Q3) (Wave 2) — completato 2026-05-04 (2 commits TDD: cfe6020 RED test + d3b3921 GREEN feat; 2 nuovi file 407 LOC: reconnect-strategy.ts 238 + reconnect-strategy.test.ts 169; 15/15 test deterministici passed con DI random+now; 135/135 gateway suite + 669/669 monorepo full PASS; tsc clean; D-83 strict ✓ — zero modifiche fuori `gateway/src/sse-ws/`; anti-AP-3 verificato — NO import `reconnecting-websocket` (vincolo PRD §31.3); RT-05/RT-07 building blocks pronti per consumer 04-05/04-06/04-07; threat T-04-03-01..04 mitigated come da CONTEXT)
- [x] 04-04-PLAN.md — visibility-detector.ts (D-110 + DI guard Worker/SSR) (Wave 2) — completato 2026-05-04 (2 commits TDD: a74a9dc RED test + 1e1d34b GREEN feat; 2 nuovi file 275 LOC: visibility-detector.ts 125 + visibility-detector.test.ts 150; 11/11 test deterministici passed con mock Document custom; 146/146 gateway suite + 680/680 monorepo full PASS; tsc clean su 4 package; D-83 strict ✓ — zero modifiche fuori `gateway/src/sse-ws/`; anti-AP-5 verificato — 0 setInterval/setTimeout (event-driven puro); pattern listener tracking analog combine-signals.ts:62-86; DI guard 3-way undefined/null/Document mock; RT-05 closed; building block pronto per consumer 04-07 RealtimeChannelManager — single shared instance per orchestrare freshness check su visibilitychange→visible; threat T-04-04-02/03 mitigated)
- [x] 04-05-PLAN.md — sse-adapter.ts (EventSource wrapper + Last-Event-ID + backpressure D-115) (Wave 3) — completato 2026-05-04 (3 commits TDD: ba74ed6 helper test util MockEventSource + b581aa7 RED test + fde59f8 GREEN feat; 3 nuovi file 876 LOC: sse-adapter.ts 464 + sse-adapter.test.ts 278 + test-utils/mock-event-source.ts 134; 14/14 sse-adapter test passed con DI MockEventSource; 160/160 gateway suite + 694/694 monorepo full PASS; tsc clean su 4 package; D-83 strict ✓ — zero modifiche fuori `gateway/src/sse-ws/`; anti-AP-2 verificato — 0 `Authorization` literal nel source (auth via buildUrl query string D-105); anti-AP-3 verificato — 0 import `reconnecting-websocket`; AP-4 implicito — `es.close()` esplicito su 'error' per disable native reconnect (RESEARCH §3.3); RT-01/RT-04/RT-06/RT-07 closed; RT-05 partial (createReconnectStrategy istanziata, loop reconnect del manager 04-07); W-4 SC-1 closure (def.eventTypes loop addEventListener — topic deriva da event field SSE, Test 13); B-5 Q5 closure (def.sseHeartbeatEventTypes default ['heartbeat'] silent freshness update senza publish, Test 14); B-NEW-2 fix iter 2 owned (MockEventSource.byChannelName Map indicizzata via `?_channel=<name>` per harness routing strict 04-08); Rule 1 bug fix applicato (AbortController re-init al re-connect)
- [x] 04-06-PLAN.md — websocket-adapter.ts (envelope JSON + ping/pong D-111 + scheme switch D-107) (Wave 3) — completato 2026-05-04 (3 commits TDD: 4d4d654 helper test util MockWebSocket + 4349b8a RED test + 740ba5b GREEN feat; 3 nuovi file 1116 LOC: websocket-adapter.ts 583 + websocket-adapter.test.ts 341 + test-utils/mock-websocket.ts 192; 15/15 websocket-adapter test passed con DI MockWebSocket; 175/175 gateway suite + 709/709 monorepo full PASS; tsc clean su 4 package; D-83 strict ✓ — zero modifiche fuori `gateway/src/sse-ws/`; anti-AP-3 verificato — 0 import `reconnecting-websocket`; anti-AP-6 verificato — 0 `startsWith('__')`; anti-AP-2 verificato — 0 `Authorization` literal; anti-AP-4 implicito — ping/pong app-level + stale watchdog (NON `readyState===OPEN` come liveness); RT-02 closed (WebSocket adapter production-ready); RT-04 progress (WS source descriptor `name:'websocket'` Test 4); RT-06 progress (envelope JSON D-106 Test 5-15); RT-07 progress (ping/pong applicativo D-111 + stale detection Test 4/8/9/10); ERR-02 ext (network.error category protocol Test 6 + system.realtime.connected/disconnected close codes routing RFC 6455 Test 4/11/12); D-107 closure (scheme switch http(s)→ws(s) automatico Test 1); D-111 closure (heartbeat 30s/staleTimeout 60s + bufferedAmount cap 64KB Test 13); Q4 closure (wsSubprotocols passthrough opt-in Test 2); B-NEW-2 fix iter 2 owned (MockWebSocket.byChannelName Map indicizzata via `?_channel=<name>` per harness routing strict 04-08, parallelo a MockEventSource owned da 04-05); RFC 6455 §7.4 close codes routing implementato (`shouldReconnectOnCloseCode` helper — 1000 normal/1002/1003/1007/1009/1010/1015 fatali → no recordFailure; altri → recordFailure manager-triggered)
- [x] 04-07-PLAN.md — realtime-channel-manager.ts (N-channel registry + cascade D-112 + visibility orchestration) (Wave 4) — completato 2026-05-04 (2 commits TDD: 2247c69 RED test + 1ee900f GREEN feat; 2 nuovi file 1067 LOC: realtime-channel-manager.ts 578 + realtime-channel-manager.test.ts 489; 16/16 test deterministici passed con DI MockEventSource+MockWebSocket+mock Document+clock; 191/191 gateway suite + **725/725 monorepo full** PASS; tsc clean su 4 package; D-83 strict ✓ — zero modifiche fuori `gateway/src/sse-ws/`; anti-AP-11 verificato — Map indicizzata per `name`, zero multiplex by URL; anti-AP-3 verificato — 0 import `reconnecting-websocket`; D-102 confirmed (Map<name, ChannelEntry> registry N-canale); D-110 closure (VisibilityDetector lazy-init al PRIMO connect + teardown automatico all'ULTIMO disconnect — Test 1+2+7+8+11); D-112 closure (disconnectByOwner cascade chiude SOLO canali del plugin — Test 8+9, pattern http-gateway.abortInFlightByOwner); Factory dispatch SseAdapter|WebSocketAdapter (default 'auto'→'sse' SSE-first D-107 — Test 2+3); Duplicate guard `realtime.channel.duplicate` BrokerError category 'config' (Test 4); RealtimeManagerClock DI per test sync runReconnectLoop (B-4); B-4 closure D-107 auto-fallback EFFETTIVO via runReconnectLoop privato — dopo fallbackThreshold fail SSE rebinda a WebSocketAdapter (Test 13); B-4 cycle-cap — maxAttempts esauriti → publish `system.realtime.failed reason='cycle-cap-exceeded'` (Test 14); B-NEW-1 fix iter 2 — signature loop allineata strict a interface ReconnectStrategy 04-03 (`getMode()` NOT `currentMode`, `nextDelayMs()` no-arg, `recordFailure()` no-arg, `fallback()` toggla mode); `entry.manuallyClosed` flag blocca runReconnectLoop su user disconnect (T-04-07-04 — Test 15); RT-01/RT-02/RT-03/RT-04/RT-05 progress; ERR-02 ext (system.realtime.reconnecting/connected/failed via publishSystem helper); building block pronto per consumer 04-08 RealtimeBroker composition wrapper)
- [x] 04-08-PLAN.md — realtime-broker.ts composition wrapper + createRealtimeBroker factory + 14 integration test 3-tier D-118/D-119 (Wave 5) — completato 2026-05-04
- [x] 04-09-PLAN.md — Final gate F4: CI gates + DOC-04 README + JSDoc + ROADMAP/STATE/REQUIREMENTS update + RT-01..RT-07 → Complete (Wave 6) — completato 2026-05-04 (5 commits: 761e4ad coverage thresholds doc + 3c01b73 biome cleanup F4 + 7014380 README Realtime SSE/WS section + e7638f9 JSDoc + final docs commit; coverage v8 sse-ws subset 91.80% statements / 86.70% branches / 89.53% functions / 93.75% lines; CI gates publint/attw/lint/typecheck/build/test passing; D-83 strict ✓ verified `git diff packages/{core,mapper,routing}/src/ packages/gateway/src/http/` zero hits)

**Status**: ✅ COMPLETE — ready for verification (gsd-verifier Phase 4)
**Closure date**: 2026-05-04
**Test coverage**: 13 sse-ws test files (132 nuovi test F4) + 14 integration test 3-tier (Tier-1 jsdom 8 file + Tier-2 MSW V1.x deferred 3 file `describe.skip` + Tier-3 Playwright Chromium 1 file) — 222/225 gateway (3 skip MSW V1.x), 756/759 monorepo full
**CI gates**: publint ✅ (4/4 packages), attw ESM-only ✅ (4/4), biome ✅ (zero errors sse-ws), typecheck ✅, build ✅ (`dist/sse-ws/{index,augment}.{js,d.ts}` ~48 KB ESM)
**Coverage v8 sse-ws/ subset**: 91.80% statements / 86.70% branches / 89.53% functions / 93.75% lines — supera target ≥85/75/88/87
**Open issues PRD §39 chiusi**: #9 (RT-07 — Last-Event-ID injection via query string per SSE + ping/pong applicativo per WS + DOC-04 README sezione Realtime SSE/WS)
**D-83 strict carryover**: ✓ verified zero modifiche runtime a `packages/{core,mapper,routing}/src/` + `packages/gateway/src/http/` per tutta F4
**Needs research**: yes (consumed)
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

**Plans**: 7/7 complete (05-01 bootstrap @sembridge/worker + 05-02 assert-serializable + transferable-extractor + 05-03 task-tracker state machine atomico Pitfall 2C + 05-04 worker-bridge Comlink wrap + 05-05 worker-pool bounded + worker-registry + 05-06 worker-broker composition wrapper Opzione B + integration test 3-tier + 05-07 final gate F5: CI gates + DOC-05 README italiano 11 sezioni + JSDoc TypeDoc-ready 7 file + REQ matrix flip atomic WK-01..WK-07 → Complete + PRD §39 #11 CLOSED + ROADMAP/STATE/TRACKER closure)
**Status**: ✅ COMPLETE — ready for verification (gsd-verifier Phase 5)
**Closure date**: 2026-05-05
**Test coverage**: 18 worker test files / 121 test passing Tier-1 jsdom (8 unit modules + 8 integration `__integration__/` D-151 #1-#6,#8,#9 + 2 broker/factory) + 6/6 browser smoke Tier-3 Playwright Chromium reale (`__browser__/playwright-worker-smoke.test.ts` D-150 + D-151 #7 transferable byteLength=0 verified). Cross-package zero regression: 248 core + 183 mapper + 103 routing + 222/225 gateway (3 skip MSW V1.x F4) + 121 worker = 877/880 monorepo full passing.
**CI gates**: publint ✅ (all good), attw ESM-only ✅ (node16 🟢, bundler 🟢), size-limit ✅ (`@sembridge/worker` 26.45/32 KB gz — include all deps cross-package Comlink + valibot + nanoid + @sembridge/{core,routing,gateway/http}), biome ✅ (zero errors), typecheck tsc ✅ (zero errors), build tsup ESM-only ✅ (dist/index.js 50.92 KB + dist/augment.js 226 B + dts 64.83 KB)
**Coverage v8 worker subset**: 91.96% statements / 83.73% branches / 90.58% functions / 94.17% lines — supera floor 85/75/88/87 e target preliminary 90/80/90/90. Thresholds calibrate post-implementation a 91.5/83/90/93.5 (analog F4 04-09 commit 761e4ad pattern).
**Open issues PRD §39 chiusi**: #11 (WK-07 — serializzazione messaggi worker — `structuredClone` (SCA) default + `assertSerializable` deep-walk PRE-postMessage dev-mode auto + transferable opt-in JSONPath + DOC-05 README italiano `packages/worker/README.md` 11 sezioni — Sezione 6 "Serialization contract WK-07" con tabella structuredClone supported types + tabella tipi NON supportati con strategia raccomandata + JSON.stringify NEVER warning + Pitfall 7.E transferable detached byteLength=0 + Sezione 11 Q&A 15 domande lockate Phase 5)
**D-83 strict carryover**: ✓ verified zero modifiche runtime a `packages/{core,mapper,routing}/src/` + `packages/gateway/src/{http,sse-ws}/` per tutta F5 (`git diff main...HEAD` exit 0 lines)
**Decisioni F5 lockate**: D-121..D-154 (34 decisioni) — composition wrapper Opzione B + factory createWorkerBroker D-30 + Factory `() => Worker` lazy first-dispatch + tasks dichiarate fail-fast + hybrid Comlink expose + PluginDescriptor.workers declaration merging + pool min(hwc,4) cap 8 + lazy first dispatch + F3 BackpressureStrategy reuse 1:1 + cancellation hybrid + AbortSignal proxied via Comlink + state machine atomico Pitfall 2C + correlationId end-to-end + Comlink callback proxy onProgress + ProgressPayload schema canonical + progressThrottleMs=100 + progress passa per mapper canonical + assertSerializable dev-mode auto + throw BrokerError PRE-postMessage + transferable JSONPath + serialization contract documentato + route policies subset + concurrency 'latest-only' default + timeout 30000ms default + topic naming hybrid auto-derive + workerType ESM default + classic opt-in + new URL import.meta.url pattern + TDD RED→GREEN co-located + 3-tier test riuso D-118 F4 + 10 scenari obbligatori + Pipeline §28 step 9 dispatch worker + mapping canonical → output + Final gate F5 simile 04-09
**Phase 6 readiness**: ortogonale a F4 (utente sceglie un entry point o compone esplicitamente `createWorkerBroker(createRealtimeBroker(config))` con RouterBroker base condivisa). Auto-advance enabled `/gsd-discuss-phase 6`.
**Needs research**: yes (research delivered Phase 5 — RESEARCH.md 1539 LOC con 17 sezioni)
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

**Plans**: 11 plans (post revision iter 1 split BLOCKER-3 — 06-08 → 06-08a/b + 06-09 → 06-09a/b)
- [ ] 06-01-PLAN.md — Bootstrap @sembridge/{cache,devtools,sembridge} (package.json + tsup ESM-only + vitest 3-tier + types/* + augment.ts) — Wave 1 sequential gate
- [ ] 06-02-PLAN.md — MemoryCacheAdapter LRU bounded `maxEntries=1000` (D-158) + stable-hash FNV-1a (D-155 riuso F3 D-74) — Wave 2 ∥ 06-04
- [ ] 06-03-PLAN.md — CacheHandler + CompositeHandler concretizza F3 D-77 placeholder + scope hybrid D-156/D-157 + cache-then-network ordering microtask — Wave 2-bis post 06-02
- [ ] 06-04-PLAN.md — MultiplexTap + tap registry chain D-159 + auto-wrap F1 single-tap backward-compat — Wave 2 ∥ 06-02
- [ ] 06-05-PLAN.md — EventInspector + RouteInspector ring buffer 500 entries (D-167) + structuredClone deep-clone (D-162) + default NODE_ENV inline (WARNING-5 fix) — Wave 3 parallel
- [ ] 06-06-PLAN.md — MetricsCollector + reservoir Algorithm R Vitter 1985 (D-165) + cardinality cap 100 (D-166) + Prometheus naming (D-163) + cumulative-only (D-164) — Wave 3 parallel
- [ ] 06-07-PLAN.md — PauseController + queue cap 1000 + critical bypass (D-170) + flushQueue audit (D-169) + pauseTopic block publish (D-168) — Wave 3 parallel
- [ ] 06-08a-PLAN.md — CacheBroker composition wrapper Opzione B + createCacheBroker factory + createCacheHarness + 4 integration test cache 3-tier + barrel cache FINAL append — Wave 4a sequential post 06-03
- [ ] 06-08b-PLAN.md — DevtoolsBroker composition wrapper + createDevtoolsBroker + createSemBridge **CHAIN COMPLETA F1+F2+F3+F4+F5+F6** (BLOCKER-2 fix) + barrel devtools FINAL cumulative (BLOCKER-1 fix single-writer) + 6 integration test devtools+sembridge 3-tier — Wave 4b sequential post 06-08a
- [ ] 06-09a-PLAN.md — CI gates verification + size-limit budget calibration cache/devtools/sembridge + biome auto-format + coverage threshold calibration post-impl — Wave 5a sequential post 06-08b
- [ ] 06-09b-PLAN.md — Final gate F6 milestone v1.0 closure: DOC-02/05/06 italiano (~1400 LOC) con 7 Q&A enumerate WARNING-2 fix + JSDoc TypeDoc-ready 11 file public + REQ matrix flip + chiusura PRD §39 #10 (TOOL-05) + CHANGELOG v1.0.0 + ROADMAP/STATE/TRACKER closure — Wave 5b sequential post 06-09a
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
| 2 | Field mancante: errore o default | `required: true` → throw `mapping.field.missing`; `required: false` + default → applica; altrimenti omette | F2 (VAL-08) |
| 3 | 13/14 | In Progress|  |
| 4 | Transform failure: skip o block | `onFailure: 'block' | 'skip' | 'fallback'`, default `'block'` | F2 (VAL-09) |
| 5 | Topic senza route | Default consegna locale, opt-in `requiresRoute: true` | F3 (ROUTE-16) |
| 6 | Più route applicabili | `'first-match'` default + `'priority-ordered'` + `'all'` | F3 (ROUTE-15) |
| 7 | Unsubscribe automatico in `unregisterPlugin` | Cascade obbligatoria, test deterministico | F1 (LIFE-02) — **Closed in 01-08** |
| 8 | Retry 4xx vs 5xx | No retry su 4xx (eccetto 408/429); retry su 5xx + network + 408/429 | F3 (ROUTE-09) |
| 9 | Reconnection rules realtime | Exponential backoff + full jitter, cap 30s, eventi `system.realtime.*`, Last-Event-ID per SSE, ping app-level per WS | F4 (RT-07) — **Closed in 04-09** ✅ |
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
| 1. Core essenziale | 11/11 | ✅ Complete & Verified | 2026-04-29 |
| 2. Canonical Model & Mapper | 12/12 | ✅ Complete | 2026-04-30 |
| 3. Routing & Server Gateway HTTP | 14/14 | ✅ Complete | 2026-05-03 |
| 4. Realtime inbound | 9/9 | ✅ Complete | 2026-05-04 |
| 5. Worker Runtime | 7/7 | ✅ Complete | 2026-05-05 |
| 6. Cache & Tooling avanzato | 0/11 (planned) | In Progress (11 plans post revision iter 1 — split BLOCKER-3) | - |

---

*Roadmap created: 2026-04-28*
*Last updated: 2026-05-05 — **Phase 5 COMPLETE 7/7 plan** (05-01..05-06 done + 05-07 final gate). 1 open issue PRD §39 chiuso: #11 WK-07 (serializzazione messaggi worker — `structuredClone` (SCA) default + `assertSerializable` deep-walk PRE-postMessage dev-mode auto + transferable opt-in JSONPath + DOC-05 `packages/worker/README.md` italiano 11 sezioni 429 LOC). CI gates: publint ✅, attw ESM-only ✅ (node16 + bundler 🟢), size-limit ✅ (`@sembridge/worker` 26.45/32 KB gz include all deps cross-package), biome ✅ (zero errors), typecheck ✅, build ✅. Coverage v8 worker subset 91.96% statements / 83.73% branches / 90.58% functions / 94.17% lines (above floor 85/75/88/87 + above target 90/80/90/90). Test totale: 121 worker (18 file Tier-1 jsdom + 6 browser smoke Tier-3 Playwright Chromium reale), 877/880 monorepo full (3 skip MSW V1.x F4). D-83 strict carryover ✓ verified `git diff main...HEAD packages/{core,mapper,routing}/src/ + packages/gateway/src/{http,sse-ws}/` exit 0 lines per tutta F5. **WK-01..WK-07 + ERR-02 ext + LIFE-02 ext F5 + TEST-01/02/03 ext F5 → Complete**. **Phase 4 COMPLETE & READY** (9/9). **Phase 3 COMPLETE & READY** (14/14). **Phase 2 COMPLETE & READY** (12/12). **Phase 1 COMPLETE & VERIFIED** (PASS HIGH).*

*Previous update: 2026-05-04 — **Phase 5 In Progress 6/7 plan completi** (Wave 4 ✅ COMPLETE). 05-06 (composition wrapper Opzione B + factory + 8 integration test Tier-1 + 6 browser smoke Tier-3 Playwright Chromium). 121/121 worker test passing + 6/6 browser smoke; cross-package zero regression: core 248 + mapper 183 + routing 103 + gateway 222 (3 skip MSW V1.x F4) + worker 121 = 877/880 monorepo full. Opzione B research §7.2 verified. D-83 strict ✓. D-151 10 scenari coverage. WK-01..WK-07 + ERR-02 ext + LIFE-02 ext F5 + TEST-01/02/03 ext F5 → subset W4 done (full closure 05-07).*

*Previous update: 2026-05-04 — **Phase 4 COMPLETE 9/9 plan** (04-01..04-08 done + 04-09 final gate). 1 open issue PRD §39 chiuso: #9 RT-07 (reconnection rules realtime — Last-Event-ID via query string per SSE + ping/pong applicativo per WS + DOC-04 README italiano sezione Realtime SSE/WS). CI gates: publint ✅ (4/4), attw ESM-only ✅ (4/4), biome ✅ (zero errors sse-ws), typecheck ✅, build ✅. Coverage v8 sse-ws/ subset 91.80% statements / 86.70% branches / 89.53% functions / 93.75% lines. Test totale: 222/225 gateway (3 skip MSW V1.x deferred), 756/759 monorepo full (248 core + 183 mapper + 103 routing + 222 gateway). D-83 strict ✓ (zero modifiche packages/{core,mapper,routing}/src/ + packages/gateway/src/http/ runtime per tutta F4). RT-01..RT-07 + ERR-02 ext + LIFE-02 ext F4 + TEST-01/02/03 ext F4 closed. **Phase 3 COMPLETE & READY** (14/14). **Phase 2 COMPLETE & READY** (12/12). **Phase 1 COMPLETE & VERIFIED** (PASS HIGH).*

*Previous update: 2026-05-03 — **Phase 3 COMPLETE 14/14 plan** (03-12 RouterBroker composition wrapper + 03-13 createRouterHarness + 6 integration test scenari F3 + 03-14 final gate F3 — coverage v8 measured + DOC-04 README italiani + publint/attw/size-limit ext). 4 open issues PRD §39 chiusi: #5 ROUTE-16, #6 ROUTE-15, #7 LIFE-02 ext F3, #8 ROUTE-09. CI gates: publint ✅ (4/4), attw ESM-only ✅ (4/4), size-limit ✅ (core 6.17/8 KB, mapper 11.66/12 KB, routing 19.15/24 KB raised, gateway/http 6.4/8 KB). Coverage v8 routing 92.4/84.3/92.6/95.1 + gateway 86.3/77.7/90/88.5. D-83 strict ✓ (zero modifiche packages/core/ né packages/mapper/ runtime). 248 core + 183 mapper invariati.*

*Previous update: 2026-05-02 — **Phase 3 In Progress 11/14 plan completi** (03-01..03-11 done): 03-01..03-08 (vedi cronologia precedente: bootstrap routing+gateway, public types F3, augment routing+gateway, RouteResolver, RouteExecutor, OutcomeCollector, HttpGateway core); **03-09 Strategies Wave 4-A** (retry+timeout+idempotency, D-69/D-68/D-70, ROUTE-09 chiusura PRD §39 #8 + SEC-03, 27 test); **03-10 Strategies Wave 4-B** (dedupe+backpressure, D-74/D-75 6 policy + critical bypass Pitfall 4 fix, ROUTE-10/ROUTE-11, 18 test); **03-11 Strategies Wave 4-C auth+circuit-breaker: BearerHookAuth (D-72 chiusura SEC-01/SEC-02/ROUTE-07 + Pitfall 5 fix con SINGLE-FLIGHT REFRESH Pattern 5 RESEARCH — 5 caller paralleli → 1 sola config.refresh invocation; always-provide refresh method che throw `auth.refresh.unavailable` con `category: 'config'` (BLOCKER 1 fix iter 1: ErrorCategory union NON include 'auth' e D-83 vieta modifica core); tokenCacheMs opt-in cache; isInflightRefresh flag debug); PerRouteCircuitBreaker (D-99 opt-in DISABLED default — state machine 3-states `closed → open → half-open → closed` con lazy transition no-setTimeout overhead + per-route state isolation Map<routeId, CircuitState>; default DISABILITATO senza config = pass-through); barrel strategies/index.ts FINAL Wave 4-C — 7 export create*Strategy totali — 19 test (9 auth + 10 cb), gateway 97/97 + core 248/248 + mapper 183/183 + routing 58/58 zero regressioni, D-83 strict OK**; aperti 03-12..03-14. **Phase 3 Plans created** (14/14 plans con file ownership disgiunta in 9 wave). **Phase 2 COMPLETE** (12/12 plan, ready for verifier). **Phase 1 COMPLETE & VERIFIED** (gsd-verifier PASS confidence HIGH; 5/5 success criteria, 27/27 REQ-IDs, 8/8 gate CI).*
