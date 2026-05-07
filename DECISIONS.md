---
title: GlueZero Decision Index
version: v1.0
last_updated: 2026-05-06
decisions_total: 170
phases: 6
---

# DECISIONS.md — indice decisioni architetturali GlueZero v1.0

> Indice navigabile delle 170 decisioni `D-01..D-170` accumulate nelle 6 fasi del progetto.
> Le decisioni sono interpretazioni operative dei requisiti di design v1 e dei vincoli architetturali del progetto. Per il "perché" di ogni decisione, il codice e i README per package contengono riferimenti incrociati.

## Distribuzione per fase

| Fase | Goal | PRD § | REQ-IDs | Decisioni | Range D-IDs |
|------|------|-------|---------|-----------|-------------|
| F1 | 1 — Core essenziale (broker, plugin registry, EventTap) | §7-§14 (Broker, BrokerEvent, lifecycle plugin) | CORE-01..12, BUS-01..09, PLG-01..07 | 30 | `D-01..D-30` |
| F2 | 2 — Canonical Model & Mapper bidirezionale | §13.5, §15-§16 (Canonical model, Mapper, Validation) | MAP-01..17, VAL-01..09, ALIAS-01..04 | 29 | `D-31..D-59` |
| F3 | 3 — Routing engine + HTTP Gateway | §17, §22-§23 (Routing, Gateway, Policy chain) | ROUTE-01..16, HTTP-01..10, ERR-01..02 | 41 | `D-60..D-100` |
| F4 | 4 — Realtime inbound (SSE prioritario, WS opzionale) | §18, §31.3 (Realtime SSE/WS) | RT-01..07 | 20 | `D-101..D-120` |
| F5 | 5 — Worker Runtime (registry, pool, task tracking) | §19-§20 (Worker) | WK-01..07 | 34 | `D-121..D-154` |
| F6 | 6 — Cache & Tooling avanzato (Inspector, Metrics, debug) | §21, §27 (Cache, Devtools, Pipeline §28 step 14) | CACHE-01..03, TOOL-01..05, DOC-02/05/06 | 16 | `D-155..D-170` |

**Totale: 170 decisioni · 6 fasi · 91 REQ-IDs · v1.0 milestone CHIUSA.**

---

## Fase 1 — 1 — Core essenziale (broker, plugin registry, EventTap)

- **PRD §:** §7-§14 (Broker, BrokerEvent, lifecycle plugin)
- **REQ-IDs principali:** CORE-01..12, BUS-01..09, PLG-01..07

| ID | Decisione (sintesi) |
|----|---------------------|
| **D-01** | Default `deliveryMode: 'async'`** per gli eventi locali |
| **D-02** | Override `deliveryMode: 'sync'` ammesso a livello di `publish(topic, payload, { deliveryMode: 'sync' })` e a livello di `subscribe` per c... |
| **D-03** | Modi `worker` e `remote`** sono dichiarati nel tipo `BrokerEvent |
| **D-04** | Deep-freeze runtime del payload** prima della consegna ai subscriber, attivato di default in dev mode (`debug: true`) |
| **D-05** | Il freeze è ricorsivo (`Object |
| **D-06** | No `structuredClone` per il payload all'ingresso in F1 — costo proibitivo per eventi piccoli/frequenti |
| **D-07** | Branded immutable types: il payload type pubblicato come `Readonly<TPayload>` deep tramite utility `DeepReadonly<T>` |
| **D-08** | Trie segmentato** come struttura dati per Subscriber Registry |
| **D-09** | Lookup `O(segments_in_topic)` indipendente dal numero di subscriber — scala fino a migliaia di subscriber wildcard senza degradazione |
| **D-10** | Costo `subscribe`/`unsubscribe` `O(segments_in_pattern)` |
| **D-11** | Edge case: subscribe a `weather |
| **D-12** | Console-based logger di default** con namespace prefix `[gluezero]` e mapping livelli → metodi: `silent` no-op, `error` → `console |
| **D-13** | Adapter slot tramite `setLogger(customLogger)`** che accetta un'implementazione conforme a `BrokerLogger` interface |
| **D-14** | `BrokerLogger |
| **D-15** | Sub-package layout monorepo**: confermo i 7 sub-package proposti da STACK |
| **D-16** | Plugin handler error isolation**: handler sync che lancia eccezione → caught con try/catch e pubblicato come `system |
| **D-17** | Plugin id collision**: `registerPlugin({id: existingId})` throw `BrokerError |
| **D-18** | Config validation**: `createBroker(config)` valida fail-fast all'init usando schemi Valibot — config invalida → throw con messaggio speci... |
| **D-19** | `createBroker` API surface**: factory imperativa `createBroker(config) → Broker`; tutte le configurazioni runtime (plugin, route, transfo... |
| **D-20** | `EventTap` surface in F1**: il tap viene chiamato sui seguenti step della pipeline implementati in F1 — `event |
| **D-21** | `BrokerEvent |
| **D-22** | `BrokerEvent |
| **D-23** | `BrokerEvent |
| **D-24** | Topic naming validation** al `publish`: regex `^[a-z][a-z0-9]*(\ |
| **D-25** | Lifecycle execution order**: `registerPlugin` → `onRegister` (sync); successivo `broker |
| **D-26** | Cascade cleanup su `unregisterPlugin`**: rimosse in ordine: (1) tutte le subscription registrate dal plugin, (2) tutte le route registrat... |
| **D-27** | `Subscription` handle**: oggetto `{ unsubscribe(): void; readonly id: string; readonly topic: string; readonly active: boolean }` |
| **D-28** | `getDebugSnapshot()`** ritorna in F1: `{ topics: string[]; subscriberCount: Record<topic, number>; pluginIds: string[]; pendingAsyncDeliv... |
| **D-29** | `enableDebug()` / `disableDebug()` toggle**: in F1 attiva/disattiva il deep-freeze runtime + verbose logging + tap snapshot full payload ... |
| **D-30** | No singleton globale**: `createBroker` ritorna istanze indipendenti |

---

## Fase 2 — 2 — Canonical Model & Mapper bidirezionale

- **PRD §:** §13.5, §15-§16 (Canonical model, Mapper, Validation)
- **REQ-IDs principali:** MAP-01..17, VAL-01..09, ALIAS-01..04

| ID | Decisione (sintesi) |
|----|---------------------|
| **D-31** | Il Broker espone come metodi pubblici: `registerCanonicalSchema(schemaDefinition)`, `registerTransform(name, fn)`, `registerAlias(localNa... |
| **D-32** | I plugin dichiarano `inputMap?: InputMap` e `outputMap?: OutputMap` come campi opzionali del `PluginDescriptor` (estensione tipo via TS d... |
| **D-33** | `MapperConfig` opzionale in `BrokerConfig` (sezione `canonicalModel`, `aliasRegistry`, `transforms` — già placeholder `unknown` da plan 0... |
| **D-34** | Mapping pre-compilato al `registerPlugin`** — al register, il mapper costruisce un dispatch table `Map<localFieldName, CompiledFieldMappi... |
| **D-35** | Cycle detection al register, NON a runtime** — mapper compile usa `visited: Set<(pluginId, fieldName)>` per detectare cicli `A → B → A` |
| **D-36** | Canonical schema versioning** — `CanonicalSchema |
| **D-37** | Valibot 1 |
| **D-38** | Adapter pluggable** — `interface ValidatorAdapter { validate(schema, payload): { ok: true; value } \| { ok: false; issues } }` |
| **D-39** | Validation step injection** — F2 valida 3 volte nella pipeline: |
| **D-40** | Mapping esplicito (`inputMap`/`outputMap` del plugin) prevale SEMPRE sugli alias automatici dell'AliasRegistry |
| **D-41** | Warning runtime su alias ambiguo** — quando un alias automatico viene usato (step 2 della resolution), il mapper emette `mapping |
| **D-42** | Configurabile per campo nel canonical schema** — `CanonicalSchema |
| **D-43** | Default value resolution** — i `default` sono valori statici (no funzioni) |
| **D-44** | Configurabile per transform** — `CanonicalSchema |
| **D-45** | Errore wrapped** — il transform error originale è preservato in `BrokerError |
| **D-46** | Estende `EventTap` di F1, NON un'API separata** — vincolo critico ARCHITECTURE |
| **D-47** | PipelineSnapshot esteso** — i campi opzionali `payloadBefore` e `payloadAfter` (già definiti in plan 03 tap |
| **D-48** | `getDebugSnapshot()` esteso** — F2 aggiunge sezione `mappings: { canonicalSchemas: number, registeredAliases: number, registeredTransform... |
| **D-49** | `bus |
| **D-50** | Ordine pipeline §28 in F2:** |
| **D-51** | Step 11 e 12 invocati per ogni consumer matched** — il `bus |
| **D-52** | Pattern TDD RED→GREEN come F1** — ogni modulo (`canonical-registry |
| **D-53** | Integration test scenario meteo PRD §29 SENZA HTTP** — F2 verifica end-to-end: plugin form pubblica `weather |
| **D-54** | Cycle detection deterministic test** — registerPlugin con descriptor che dichiara mapping circolare → throw `mapping |
| **D-55** | Coverage v8 finale F2** — installare `@vitest/coverage-v8` come devDep root (open item ereditato da F1) e misurare ≥ 90% sui file `@gluez... |
| **D-56** | Type re-export da `@gluezero/mapper` a `@gluezero/core`** — il package `@gluezero/core` (plan 03) ha `BrokerConfig` con sezioni `canonica... |
| **D-57** | `PluginDescriptor` augmentation** — F2 aggiunge `inputMap?: InputMap`, `outputMap?: OutputMap` al `PluginDescriptor` esistente via declar... |
| **D-58** | Eventi standard `mapping |
| **D-59** | NO publish `<topic> |

---

## Fase 3 — 3 — Routing engine + HTTP Gateway

- **PRD §:** §17, §22-§23 (Routing, Gateway, Policy chain)
- **REQ-IDs principali:** ROUTE-01..16, HTTP-01..10, ERR-01..02

| ID | Decisione (sintesi) |
|----|---------------------|
| **D-60** | Il Broker espone come metodi pubblici: `registerRoute(routeDefinition)` e `unregisterRoute(routeId)` — coerente con il pattern `registerP... |
| **D-61** | I plugin dichiarano `routes?: RouteDefinition[]` come campo opzionale del `PluginDescriptor` (estensione tipo via TS declaration merging ... |
| **D-62** | `RoutingConfig` opzionale in `BrokerConfig` (sezione `routes?: RouteDefinition[]`, `gateway?: GatewayConfig` — già placeholder `unknown` ... |
| **D-63** | `createSembridge(config)` aggregato pubblico — DEFERRED** |
| **D-64** | Route resolution pre-compilata al `registerRoute`** — il resolver costruisce un dispatch table `Map<topicPattern, CompiledRoute[]>` per O... |
| **D-65** | Executor ASYNC per route HTTP/cache/composite, SYNC per route local** — la consegna locale (route `local`) usa la pipeline F1 invariata (... |
| **D-66** | `first-match` come default per route resolution (ROUTE-15)** — quando più route matchano lo stesso topic, viene usata la prima registrata |
| **D-67** | `requiresRoute` opt-in per topic schema (ROUTE-16)** — chiusura PRD §39 #5 |
| **D-68** | Strategy Pattern per ogni policy** — coerente con ARCHITECTURE |
| **D-69** | Retry policy default (chiusura PRD §39 #8 / ROUTE-09):** |
| **D-70** | Idempotency token (SEC-03)** — per metodi `POST`/`PATCH`/`PUT`/`DELETE`, default `idempotency: { mode: 'auto', headerName: 'Idempotency-K... |
| **D-71** | URL allowlist obbligatoria (SEC-05)** — `gateway |
| **D-72** | Auth Bearer + token refresh (SEC-01, SEC-02, ROUTE-07)** — `gateway |
| **D-73** | Concurrency policy per route** — `RouteDefinition |
| **D-74** | `dedupeKey` esplicito (ROUTE-11)** — la route può dichiarare `dedupeKey: (event) => string` (funzione pura) |
| **D-75** | Backpressure priority-aware (ROUTE-10)** — `BackpressureStrategy` configurabile per route: `'queue-bounded'` (max N), `'drop'`, `'throttl... |
| **D-76** | AbortController per ogni request HTTP in volo** — il gateway crea `AbortController` per ogni fetch e lo cita su: |
| **D-77** | AbortSignal su `subscribe`** — F1 plan 04/05 ha già esposto `subscribe(handler, options?: { signal?: AbortSignal })` |
| **D-78** | Validazione response opt-in via canonical schema F2** — la route HTTP dichiara `response: { canonical: 'weather' }` (riferimento al `Cano... |
| **D-79** | Server con schema inatteso (TEST-03 subset)** — se la response non matcha lo schema canonico (campo mancante, tipo errato), il comportame... |
| **D-80** | `<topic> |
| **D-81** | `network |
| **D-82** | NO publish doppio** — quando la route HTTP fallisce, `<topic> |
| **D-83** | `bus |
| **D-84** | Ordine pipeline §28 in F3 (full):** |
| **D-85** | `PipelineStep` extension F3** — il package `@gluezero/routing/src/augment |
| **D-86** | `unregisterPlugin` cascada anche le route registrate dal plugin** — D-26 cascade di F1 + F2 viene esteso in F3 a: |
| **D-87** | `unregisterRoute(routeId)` esplicito** — anche senza unregister del plugin owner |
| **D-88** | Pattern TDD RED→GREEN come F1/F2** — ogni modulo (`route-resolver |
| **D-89** | Integration test scenario meteo PRD §29 estendendo F2 con HTTP** — F3 verifica end-to-end: |
| **D-90** | TEST-01 subset F3** — unit test deterministici per: dedupe (2 fetch identiche → 1 sola network call); retry (5xx → 3 retry, 4xx no retry,... |
| **D-91** | TEST-03 subset F3** — robustness: server response con schema inatteso (response Valibot fail → publish failed con `'response |
| **D-92** | Coverage v8 F3** — riusa `@vitest/coverage-v8` installato in F2 plan 02-12; misura ≥ 90% sui file `@gluezero/routing/` e `@gluezero/gatew... |
| **D-93** | Type re-export da `@gluezero/routing` e `@gluezero/gateway` a `@gluezero/core`** — pattern non-breaking F2 D-56 |
| **D-94** | `PluginDescriptor` augmentation F3** — aggiunge `routes?: RouteDefinition[]` al `PluginDescriptor` esistente via declaration merging (F2 ... |
| **D-95** | `CanonicalSchema` augmentation F3** — aggiunge `requiresRoute?: boolean` per chiusura ROUTE-16 (D-67) |
| **D-96** | `request |
| **D-97** | Response parse → canonical schema** — la route dichiara `response: { canonical: 'weather' }` (riferimento al `CanonicalSchema` registrato... |
| **D-98** | Custom serialization request body** — default JSON (`Content-Type: application/json`) |
| **D-99** | Per-route fail counter base** — F3 implementa una versione minima del circuit breaker: |
| **D-100** | RouterBroker isola l'accesso al CanonicalRegistry private di F2** (revision iter 1, BLOCKER 4 fix) |

---

## Fase 4 — 4 — Realtime inbound (SSE prioritario, WS opzionale)

- **PRD §:** §18, §31.3 (Realtime SSE/WS)
- **REQ-IDs principali:** RT-01..07

| ID | Decisione (sintesi) |
|----|---------------------|
| **D-101** | Composition wrapper pattern (estensione D-83 di F3)** — F4 introduce `RealtimeBroker` che compone `RouterBroker` di F3 (composition wrapp... |
| **D-102** | Multi-channel topology con `RealtimeChannelManager`** — `connectRealtime({ name, mode, url, |
| **D-103** | `PluginDescriptor |
| **D-104** | `RealtimeChannelDef |
| **D-105** | NO header custom in V1** — `EventSource` standard non supporta headers (vincolo PRD §31 |
| **D-106** | Default envelope JSON `{ topic, data, id? }`** — il server WebSocket invia frames JSON con shape `{ topic: string; data: unknown; id?: st... |
| **D-107** | Auto-fallback default abilitato V1** — `RealtimeChannelDef |
| **D-108** | Caveat documentati** — il fallback assume che il server espone lo stesso endpoint logico per entrambi i protocolli (es |
| **D-109** | Reconnect policy unificata SSE/WS** — exponential backoff full-jitter `delay = random(0, min(30_000, base * 2^attempt))` con `base = 1_00... |
| **D-110** | Visibility API integration** — al `visibilitychange → hidden`: il timer heartbeat WS continua ma con tolleranza estesa (×3 stale timeout)... |
| **D-111** | Stale detection WS** — ping/pong applicativo via envelope JSON: il client invia `{ topic: '__ping__', data: { ts } }` ogni `heartbeatInte... |
| **D-112** | Cascade cleanup F4 (estensione D-86)** — `unregisterPlugin(pluginId)` chiude tutti i `realtimeChannels` registrati dal plugin: abort dell... |
| **D-113** | Messaggi realtime entrano alla pipeline §28 step 1** — il `RealtimeChannel` invoca `broker |
| **D-114** | Mapper server→canonical riusato da F3** — il payload `data` dell'envelope (o `event |
| **D-115** | BackpressureStrategy riusata da F3 D-75** — i canali realtime accettano `RealtimeChannelDef |
| **D-116** | Validation post-mapping invariata** — VAL-04 (post-mapping) e VAL-03 (canonical) di F2 si applicano automaticamente al payload normalizza... |
| **D-117** | Pattern TDD RED→GREEN** (analogo D-88 F3) — ogni modulo (`sse-adapter |
| **D-118** | Tre livelli di test** — STACK |
| **D-119** | Test scenari obbligatori (TEST-01/TEST-02/TEST-03 subset F4):** |
| **D-120** | Final gate F4 simile a 01-11 / 02-12 / 03-14** — un plan dedicato chiude la fase con: lint, typecheck, build, test, coverage ≥90%, REQ ma... |

---

## Fase 5 — 5 — Worker Runtime (registry, pool, task tracking)

- **PRD §:** §19-§20 (Worker)
- **REQ-IDs principali:** WK-01..07

| ID | Decisione (sintesi) |
|----|---------------------|
| **D-121** | Composition wrapper pattern (estensione D-83 strict / D-101)** — F5 introduce `WorkerBroker` che compone `RouterBroker` di F3 (NON modifi... |
| **D-122** | `createWorkerBroker(config)` factory pubblico** — `@gluezero/worker` espone `createWorkerBroker(config: WorkerBrokerConfig)` con Valibot ... |
| **D-123** | Factory `() => Worker` come canale unico** — `WorkerDescriptor |
| **D-124** | Tasks dichiarate esplicite (fail-fast pattern)** — `WorkerDescriptor |
| **D-125** | Hybrid Comlink expose + dispatcher fallback utility** — Worker primary signature: `Comlink |
| **D-126** | Top-level + PluginDescriptor |
| **D-127** | Pool bounded di default `min(navigator |
| **D-128** | Cap hard 8 + opt-in `allowUnboundedPool`** — Anche se `hardwareConcurrency=16`, default cap a 8 |
| **D-129** | Lazy first dispatch lifecycle** — i worker del pool sono spawnati on-demand al primo task di quella `queue`: 1° task → spawn 1 worker; 2°... |
| **D-130** | F3 BackpressureStrategy riusata 1:1** — `WorkerRouteDescriptor |
| **D-131** | Hybrid per mode: dedicated → terminate, pool → cooperative** — Su timeout/abort: |
| **D-132** | AbortSignal proxied via Comlink** — la task signature lato worker è `async (input: TInput, signal: AbortSignal, onProgress?: ProgressCall... |
| **D-133** | State machine atomico per `taskId` (Pitfall 2C closure)** — `Map<TaskId, TaskState>` con `TaskState = 'pending' \| 'done' \| 'timeout' \|... |
| **D-134** | `correlationId` end-to-end (Pitfall 2A consistency)** — Tutti gli eventi worker (`completed`, `progress`, `failed`, `worker |
| **D-135** | Comlink callback proxy `onProgress(payload)`** — la task signature riceve un terzo argomento opzionale `onProgress: (payload: ProgressPay... |
| **D-136** | Schema progress canonical `{ value, message?, partialResult? }`** — Schema canonico V1: `{ value: number /* 0 |
| **D-137** | Throttling adapter-level con `progressThrottleMs` config** — `WorkerRouteDescriptor |
| **D-138** | Progress events passano per mapper canonical (D-114 carryover)** — Coerente con D-113/D-114 di F4 e PRD §28: ogni evento attraversa la pi... |
| **D-139** | `assertSerializable` dev-mode auto + opt-out (WK-07 closure)** — Default: `process |
| **D-140** | Throw `BrokerError` PRE-postMessage su violation** — `assertSerializable(payload)` deep-walk ricorsivo: su `function`, DOM node, classi c... |
| **D-141** | Transferable opt-in via JSONPath-like array (WK-07 closure)** — `WorkerRouteDescriptor |
| **D-142** | Contratto serializzazione documentato (WK-07 closure PRD §39 #11)** — DOC-04 + DOC-05 esplicitano: structuredClone default supporta `Obje... |
| **D-143** | Subset rilevante delle RoutePolicies F3** — Route `worker` eredita: `timeout` (WK-06 obbligatorio), `concurrency: 'latest-only' \| 'seria... |
| **D-144** | Default `concurrency: 'latest-only'`** — Allineato a F3 default per HTTP UI-driven (Pitfall 2 |
| **D-145** | Default `timeout: 30_000ms`** — Allineato al cap reconnection F4 (D-109 30s) e al pattern "non infinite by default" di F3 D-69 |
| **D-146** | Topic naming hybrid auto-derive + override esplicito** — Default: da `on:'report |
| **D-147** | ESM `{ type: 'module' }` default + classic opt-in** — Default V1: `WorkerDescriptor |
| **D-148** | Pattern bundler-friendly `new URL( |
| **D-149** | Pattern TDD RED→GREEN co-located** (analogo D-88 F3 / D-117 F4) — ogni modulo (`worker-registry |
| **D-150** | Tre livelli di test (riuso D-118 F4)** — coerente con STACK |
| **D-151** | Test scenari obbligatori (TEST-01/02/03 subset F5):** |
| **D-152** | Step 9 dispatch worker (placeholder F3 D-77)** — `RouteExecutor |
| **D-153** | Mapping canonical → output strict** — Il `WorkerResult |
| **D-154** | Final gate F5 simile a 01-11 / 02-12 / 03-14 / 04-09** — un plan dedicato chiude la fase con: lint biome, typecheck tsc --noEmit, build t... |

---

## Fase 6 — 6 — Cache & Tooling avanzato (Inspector, Metrics, debug)

- **PRD §:** §21, §27 (Cache, Devtools, Pipeline §28 step 14)
- **REQ-IDs principali:** CACHE-01..03, TOOL-01..05, DOC-02/05/06

| ID | Decisione (sintesi) |
|----|---------------------|
| **D-155** | Cache key default = `${topic}::${stableHash(canonicalPayload)}`** — derivazione deterministica via stable hash (JSON |
| **D-156** | Scope hybrid: config-level scopeProvider + route-level override** — `BrokerConfig |
| **D-157** | Missing scope su route auth → skip cache + system |
| **D-158** | MemoryCacheAdapter LRU bounded `maxEntries=1000` default** — Default V1: LRU eviction policy con cap entries (NON bytes) `maxEntries: 1000` |
| **D-159** | Tap registry (chain di tap) — `BrokerConfig |
| **D-160** | `enableDebug()/disableDebug()` toggle live-mode** — I tap di devtools sono **sempre registrati** (zero overhead structural) ma operano in... |
| **D-161** | Tap invocato su tutti 14 step §28 + lifecycle events** — Coerenza uniforme: tap invocato per ogni step pipeline (1=ingestion, 2=enrichmen... |
| **D-162** | `getDebugSnapshot()` deep-clone immutable via structuredClone** — Ritorna deep clone (structuredClone nativo, riuso pattern F5 D-141 tran... |
| **D-163** | Naming `gluezero |
| **D-164** | Cumulative-only counters + helper `getMetricsDelta(previousSnapshot)`** — `getMetrics()` ritorna sempre valori cumulativi dal boot del br... |
| **D-165** | Histogram = quantile summary `{ count, sum, p50, p90, p99 }` con ring buffer ~1024 samples** — Per ogni histogram metric: `{ count: numbe... |
| **D-166** | Labels Prometheus-style flatten in name + cap 100 distinct combinations** — Le label sono parte della metric key concatenata in stringa: ... |
| **D-167** | EventInspector + RouteInspector ring buffer 500 eventi default + config** — Ring buffer in-memory degli ultimi 500 eventi (incluse `Pipel... |
| **D-168** | `pauseTopic(topic)` = block publish + queue events FIFO** — Semantica completa "pause": nuove `publish(topic)` vengono accodate in FIFO q... |
| **D-169** | `flushQueue(topic?)` = drop silenzioso + emit `system |
| **D-170** | Pause queue cap `maxQueueSize: 1000` default + drop-oldest FIFO + critical bypass** — Default `maxQueueSize: 1000` per topic in pausa |

---

## Decisioni cross-fase critiche (alta visibilità)

Queste decisioni hanno impatto trasversale e vanno consultate prima di toccare il codice corrispondente.

| ID | Significato | Impatto |
|----|-------------|---------|
| **D-08** | Trie segmentato come struttura subscriber registry | F1+F3 (route resolver riusa lo stesso trie) |
| **D-26** | Cascade `unregisterPlugin` LIFE-02 | F1→F2→F3→F4→F5→F6 (cleanup completo cross-fase) |
| **D-30** | `createBroker(config)` factory pure (no singleton) | Tutti i factory `createXBroker` seguono questo pattern |
| **D-49** | MapperBroker = composition wrapper di Broker F1 (NON subclass) | Carryover D-83: ogni fase F2-F6 è composition wrapper della precedente |
| **D-83** | **Strict carryover**: F3+ NON modifica `packages/{core,mapper}/src/` | Verificato a ogni final gate: `git diff main...HEAD -- packages/{core,mapper,routing,gateway,worker}/src/` exit 0 |
| **D-126** | Cascade ext F6: cache invalidate by ownerId | LIFE-02 esteso fino a F6 (cleanup cache scoped a plugin) |
| **D-159** | Tap registry chain (MultiplexTap) | F1 single-tap deprecato, F6 chain con error isolation |
| **D-161** | Step 14 `event.observed` lifecycle event | Pipeline §28 14 step completa end-to-end (F6 chiude PRD §28) |

---

## PRD §39 open issues — chiusura per fase

Il PRD §39 elencava 11 punti che NON dovevano restare impliciti. Stato finale v1.0:

| # | Open issue | Fase chiusura | REQ-ID | Decisione chiave |
|---|-----------|---------------|--------|------------------|
| 1 | Precedenza alias automatici vs mapping esplicito | F2 | MAP-17 | D-40 (esplicito > automatico, sempre) |
| 2 | Field mancante: errore o default | F2 | VAL-08 | D-43 (policy `required`/`default` per field) |
| 3 | Transform failure: skip/block/fallback | F2 | VAL-09 | D-44 (block default + escalation policy) |
| 4 | Topic senza route | F3 | ROUTE-16 | D-67 (consegna locale di default, opt-in `requiresRoute`) |
| 5 | Più route applicabili allo stesso topic | F3 | ROUTE-15 | D-66 (`first-match` default + `priority-ordered` opt-in) |
| 6 | Retry 4xx vs 5xx | F3 | ROUTE-09 | D-73 (no retry su 4xx, retry su 5xx + Retry-After parser) |
| 7 | Unsubscribe automatico in unregister plugin | F1+F3 | LIFE-02 | D-26 (cascade) + D-86 ext F3 (route cascade) |
| 8 | Reconnection rules realtime | F4 | RT-07 | D-107/D-108 (auto-fallback SSE→WS + cycle cap) |
| 9 | Serializzazione messaggi worker | F5 | WK-07 | D-139..D-141 (assertSerializable + transferable opt-in) |
| 10 | Format metriche | F6 | TOOL-05 | D-163..D-166 (simil-OpenMetrics + reservoir + cardinality cap) |
| 11 | Ordine pipeline mapping/validation cross-fase | **DEFERRED V1.x** | PIPE-01 | _Opt-in quando emergeranno consumer cross-fase reali_ |

**Stato:** 10/11 chiusi v1.0; 1 deferred V1.x (PIPE-01) — tracciato in REQUIREMENTS.md.

---

## Pattern di lettura consigliato

1. **Per debugging un comportamento specifico:** parti dalla fase del package coinvolto (es. routing → F3) e leggi le decisioni della tabella corrispondente.
2. **Per estendere un'API pubblica:** consulta D-83 strict carryover prima di toccare codice di fase precedente.
3. **Per audit di sicurezza:** D-71 (URL allowlist), D-72 (auth + single-flight refresh), D-157 (cache scope fail-secure), D-141 (transferable opt-in).
4. **Per performance tuning:** D-04..D-06 (deep-freeze runtime), D-09..D-10 (trie lookup O(segments)), D-158 (LRU bounded), D-165 (reservoir Algorithm R).

---

*Generated: 2026-05-06 · Source of truth: `<phase>/<phase>-CONTEXT.md` files · Index updated when nuove decisioni vengono lockate post-v1.0.*
