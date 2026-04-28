# Pattern Architetturali — SemBridge

**Dominio:** middleware client-side orientato agli eventi (event-driven broker, routing, gateway, worker, canonical mapping)
**Progetto:** SemBridge (greenfield, V1)
**Researched:** 2026-04-28
**Modalità:** Project Research — dimensione Architecture
**Confidenza complessiva:** HIGH (pattern ben consolidati nella letteratura EIP, requisiti del PRD chiari e prescrittivi)

---

## 1. Sintesi architetturale

SemBridge è un **runtime di messaggistica in-process** che vive nel browser. Concettualmente è la trasposizione lato client dei pattern di Enterprise Integration (Hohpe & Woolf, 2003), adattati a un singolo processo JavaScript con estensioni verso Web Worker e canali realtime.

L'architettura logica si fonda su **sei pattern combinati**, ciascuno applicato a un'area precisa del runtime, integrati attraverso una pipeline ufficiale a 14 step (PRD §28). Il principio guida è la **separazione tra trasporto, semantica e governance**: il Core Broker non sa nulla di HTTP o worker, il Routing Engine non sa nulla del trasporto, il Gateway/Worker non sa nulla del modello canonico.

La metafora più precisa è quella di un **Message Bus locale con Canonical Data Model**, dove ogni evento attraversa una `Pipes-and-Filters` strutturata (validate → map → route → execute → map back → deliver), e dove il Mediator centrale (Broker) non implementa logica di dominio ma orchestra Filter componibili tramite Adapter intercambiabili.

---

## 2. Pattern architetturali applicabili

### 2.1 Mediator Pattern → Core Broker (centro logico)

**Cosa.** Il `Broker` è il Mediator: i plugin/componenti non si conoscono e non si chiamano direttamente, dialogano solo via broker.

**Perché qui.** Risolve direttamente il problema PRD §3.1 (accoppiamento forte) e §8.1 (disaccoppiamento). Senza Mediator, i plugin avrebbero bisogno di reference incrociati e l'interoperabilità tramite naming locale eterogenei (PRD §13) sarebbe impossibile.

**Riferimento EIP.** Hohpe — *Message Bus* (cap. 7): "a common communication infrastructure that allows separate applications to work together […] without having to know about each other". Il Broker SemBridge è la versione in-process del Message Bus.

**Confidenza:** HIGH (pattern canonico).

### 2.2 Pipes-and-Filters → Pipeline di elaborazione evento (PRD §28)

**Cosa.** I 14 step del PRD §28.1 sono filtri sequenziali con un canale tipizzato (`BrokerEvent`) che li attraversa. Ogni filtro ha una responsabilità unica e produce un evento (eventualmente arricchito) per il filtro successivo.

**Perché qui.** Il PRD §28.2 richiede esplicitamente "ordine coerente e documentato" e "no trasformazioni implicite invisibili al debug layer". Pipes-and-Filters dà esattamente questo: ogni step è osservabile, sostituibile, testabile in isolamento.

**Mappatura sui filtri:**

| Step PRD §28 | Filtro | Tipologia |
|---|---|---|
| 1. Ricezione | `IngressFilter` | strutturale |
| 2. Arricchimento metadata | `MetadataEnricher` | enricher |
| 3. Validazione sintattica evento | `EventValidator` | validator |
| 4. Identificazione source | `SourceResolver` | resolver |
| 5. Mapping output→canonico | `OutputMapper` | translator |
| 6. Validazione canonico | `CanonicalValidator` | validator |
| 7. Dedupe / backpressure | `FlowController` | filter (drop/throttle) |
| 8. Risoluzione route | `RouteResolver` | router |
| 9. Esecuzione route | `RouteExecutor` (delega ad Adapter) | dispatcher |
| 10. Raccolta esiti | `OutcomeCollector` | aggregator |
| 11. Mapping canonico→consumer | `InputMapper` | translator |
| 12. Validazione finale | `DeliveryValidator` | validator |
| 13. Consegna | `DeliveryDispatcher` | sink |
| 14. Logging / metrics | `ObservabilityTap` | tap (cross-cutting) |

**Riferimento EIP.** Hohpe — *Pipes and Filters* (cap. 3): pattern di base dell'integrazione message-driven. Lo step 14 (`ObservabilityTap`) è il pattern *Wire Tap* di Hohpe.

**Confidenza:** HIGH.

### 2.3 Canonical Data Model + Message Translator → Mapping Engine

**Cosa.** Il vocabolario canonico (PRD §13) è il Canonical Data Model. Il `Mapper` è il Message Translator (locale ↔ canonico ↔ locale).

**Perché qui.** Pattern obbligato dal requisito centrale (PRD §13, §14). I plugin di terze parti usano nomenclature differenti per concetti identici: senza un Canonical Data Model l'interoperabilità richiederebbe un mapper N×N tra plugin (esplosione combinatoriale).

**Riferimento EIP.** Hohpe — *Canonical Data Model* (cap. 8) e *Message Translator* (cap. 8): il CDM riduce le traduzioni da O(N²) a O(2N). SemBridge segue questa identica logica.

**Confidenza:** HIGH.

### 2.4 Adapter Pattern → Gateway, Worker, Realtime, Cache

**Cosa.** Ogni trasporto esterno è un Adapter:

- `FetchAdapter` (HTTP request/response)
- `SseAdapter` (server-sent events)
- `WebSocketAdapter` (bidirezionale)
- `WorkerAdapter` (postMessage/onmessage bridge)
- `MemoryCacheAdapter`, `IndexedDBAdapter`

Tutti implementano interfacce uniformi (`HttpClient`, `RealtimeChannel`, `WorkerBridge`, `CacheStore`).

**Perché qui.** Il Routing Engine deve essere agnostico rispetto al trasporto. L'Adapter Pattern permette di sostituire `fetch` con un mock per i test (PRD §35) e di aggiungere WebSocket o IndexedDB senza modificare il Routing Engine (PRD §32.4, §32.6, §31).

**Riferimento EIP.** Hohpe — *Channel Adapter* (cap. 4): "connects an application to the messaging system […] without modifying the application". Equivalente al GoF Adapter applicato a canali messaggio.

**Confidenza:** HIGH.

### 2.5 Strategy Pattern → Policy di route

**Cosa.** Ogni policy configurabile su una route (retry, dedupe, backpressure, cache, auth, error) è una Strategy intercambiabile.

```
RoutePolicies = {
  retry: RetryStrategy,        // ExponentialBackoff | LinearBackoff | None
  dedupe: DedupeStrategy,      // KeyBased | PayloadHash | None
  backpressure: BackpressureStrategy, // Throttle | Debounce | LatestOnly | DropOldest | Bounded
  cache: CacheStrategy,        // CacheFirst | NetworkFirst | CacheThenNetwork
  error: ErrorStrategy,        // Retry4xx | Retry5xxOnly | FailFast
  auth: AuthStrategy           // Bearer | Custom hook
}
```

**Perché qui.** PRD §17.8 e §23 elencano policy multiple e il PRD §39 richiede esplicitamente che il comportamento di retry su 4xx vs 5xx sia non implicito. Strategy Pattern rende ogni policy un oggetto sostituibile e testabile.

**Riferimento.** GoF *Strategy* + Hohpe *Reliable Delivery* / *Dead Letter Channel*.

**Confidenza:** HIGH.

### 2.6 Chain of Responsibility → Middleware/Interceptor chain (cross-cutting)

**Cosa.** Logging, metrics, validation tap, debug snapshot sono interceptor incatenati che attraversano la pipeline `Pipes-and-Filters` senza modificarne la logica.

**Perché qui.** Le preoccupazioni cross-cutting (PRD §25 osservabilità, §21 validation) non devono essere hardcoded in ogni filtro. La Chain permette di registrarle/disattivarle (es. `enableDebug()`/`disableDebug()` PRD §16.3) senza riscrivere il core.

**Riferimento.** GoF *Chain of Responsibility* + Hohpe *Wire Tap* per il branch non intrusivo.

**Confidenza:** HIGH.

### 2.7 CQRS-lite → Separazione comandi (publish) ed eventi (subscribe)

**Cosa.** I metodi `publish(topic, payload)` rappresentano comandi/intenti che innescano routing, mentre i `subscribe()` ricevono eventi (notifiche). L'API è asimmetrica per riflettere ruoli distinti.

**Perché qui.** Convenzione PRD §12.2 sui topic (`<entity>.<action>.requested` vs `.completed`/`.failed`) è già una separazione concettuale tra comandi e eventi. Mantenere l'asimmetria a livello di API previene "publish-then-await-response" che farebbe collassare il broker in un RPC sincrono.

**Riferimento.** Greg Young — CQRS (semplificato): qui non c'è separazione di store ma di intent (request) vs notification (event).

**Nota di precisione:** è "CQRS-lite" perché manca la separazione di modelli di lettura/scrittura — ne prendiamo solo la disciplina concettuale di intent vs event.

**Confidenza:** MEDIUM (è più una disciplina di naming/API che un vero CQRS).

### 2.8 Sintesi pattern → applicazione

| Pattern | Applicato a | Beneficio |
|---|---|---|
| Mediator (Message Bus) | Core Broker | Disaccoppiamento totale tra plugin |
| Pipes-and-Filters | Pipeline §28 (14 step) | Tracciabilità, testabilità, ordine esplicito |
| Canonical Data Model + Translator | Canonical/Mapper | Interoperabilità senza accordo a priori |
| Adapter | Gateway/Worker/Realtime/Cache | Trasporti sostituibili e mockabili |
| Strategy | Route policies | Comportamenti configurabili dichiarativamente |
| Chain of Responsibility | Tap/Middleware cross-cutting | Osservabilità non intrusiva |
| CQRS-lite (disciplina) | API publish vs subscribe | Naming chiaro intent vs evento |

---

## 3. Component Boundaries (confini e contratti)

### 3.1 Diagramma logico dei confini

```
┌──────────────────────────────────────────────────────────────────────┐
│                          SemBridge Runtime                           │
│                                                                      │
│   ┌─────────────────┐   publish/deliver   ┌────────────────────┐     │
│   │   Plugin API    │ ──────────────────► │   Core Broker      │     │
│   │ (3rd party)     │ ◄────────────────── │   (Mediator)       │     │
│   └─────────────────┘                     │ ┌────────────────┐ │     │
│                                           │ │ Event Bus      │ │     │
│                                           │ │ Topic Registry │ │     │
│                                           │ │ Sub Registry   │ │     │
│                                           │ │ Lifecycle Mgr  │ │     │
│                                           │ └────────┬───────┘ │     │
│                                           └──────────┼─────────┘     │
│                                                      │ canonical evt │
│                                                      ▼               │
│                                           ┌────────────────────┐     │
│                                           │  Mapping Engine    │     │
│                                           │  (Translator)      │     │
│                                           │  + Validation      │     │
│                                           └──────────┬─────────┘     │
│                                                      │ canonical evt │
│                                                      ▼               │
│                                           ┌────────────────────┐     │
│                                           │  Routing Engine    │     │
│                                           │  (Strategy hub)    │     │
│                                           └──┬─────┬─────┬─────┘     │
│                                              │     │     │           │
│                          ┌───────────────────┘     │     └──────┐    │
│                          ▼                         ▼            ▼    │
│                  ┌──────────────┐   ┌──────────────┐   ┌─────────────┐
│                  │Server Gateway│   │Worker Runtime│   │ Cache Layer │
│                  │ (Adapters)   │   │ (Adapters)   │   │ (Adapters)  │
│                  │ Fetch/SSE/WS │   │ Pool/Bridge  │   │ Mem/IDB     │
│                  └──────────────┘   └──────────────┘   └─────────────┘
│                          │                  │                │
│                          ▼                  ▼                ▼
│                       Network            Web Worker       Storage
│                                                                      │
│   ╔══════════════════════════════════════════════════════════════╗   │
│   ║  Developer Tooling (Wire Tap)                                ║   │
│   ║  Event/Mapping/Route Inspector — Metrics — Logger            ║   │
│   ║  ◄── osserva ogni step della pipeline (read-only)            ║   │
│   ╚══════════════════════════════════════════════════════════════╝   │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.2 Contratti tipizzati tra sottosistemi

#### Core Broker ↔ Routing Engine

```ts
// Il Broker invoca il Routing Engine con un evento già canonico e validato
interface RoutingEngine {
  resolve(event: CanonicalEvent): RouteMatch[];
  execute(event: CanonicalEvent, matches: RouteMatch[]): Promise<RouteOutcome[]>;
}

interface CanonicalEvent extends BrokerEvent {
  payload: CanonicalPayload;       // garantito canonicalizzato
  schemaVersion: string;            // garantito presente dopo step 5-6
}

interface RouteOutcome {
  routeId: string;
  status: 'success' | 'error' | 'skipped' | 'cached';
  emittedTopic?: string;
  payload?: CanonicalPayload;
  error?: BrokerError;
  origin?: 'cache' | 'remote' | 'worker' | 'local';  // per metadata di consegna
  durationMs: number;
}
```

**Invariante:** il Broker invia al Routing Engine **solo eventi canonici e validati** (step 5-6 della pipeline già completati). Il Routing Engine **non** chiama mai direttamente i subscriber locali — ritorna `RouteOutcome[]` al Broker che orchestra la consegna.

#### Routing Engine ↔ Server Gateway

```ts
interface ServerGateway {
  http: HttpClient;
  realtime: RealtimeChannelManager;
}

interface HttpClient {
  request(req: HttpRequest, policies: RoutePolicies): Promise<HttpResponse>;
}

interface RealtimeChannelManager {
  connect(config: RealtimeConfig): Promise<RealtimeConnection>;
  disconnect(connectionId: string): Promise<void>;
  // emette eventi RAW al Broker via callback inbound
  onMessage(handler: (raw: RawServerMessage) => void): void;
}
```

**Invariante:** il Gateway riceve `HttpRequest` già *risolto* dal Routing Engine (URL espanso, query/body costruiti via mapping). Il Gateway **non** sa nulla di topic, eventi o canonical model — gestisce solo trasporto. Le policy (retry/timeout/auth) sono passate come parametro Strategy.

#### Routing Engine ↔ Worker Runtime

```ts
interface WorkerRuntime {
  registry: WorkerRegistry;
  dispatch(task: WorkerTask): Promise<WorkerResult>;
}

interface WorkerTask {
  workerId: string;          // ID worker registrato
  taskName: string;          // nome del task da invocare
  payload: CanonicalPayload; // serializzabile o transferable
  correlationId: string;     // per task tracking
  timeoutMs?: number;
}

interface WorkerResult {
  status: 'completed' | 'progress' | 'failed' | 'cancelled';
  payload?: CanonicalPayload;
  error?: BrokerError;
  progressFraction?: number;
}
```

**Invariante:** la canonicalizzazione avviene *prima* del dispatch al worker (PRD §19.4 step 3). Il worker riceve sempre payload canonico. Il `correlationId` lega task ↔ evento risultante per il task tracking (PRD §19.3, WK-03).

#### Routing Engine ↔ Cache Layer

```ts
interface CacheStore {
  get(key: CacheKey): Promise<CacheEntry | null>;
  set(key: CacheKey, value: CanonicalPayload, ttlMs?: number): Promise<void>;
  invalidate(keyOrPattern: CacheKey | string): Promise<void>;
  has(key: CacheKey): Promise<boolean>;
}

interface CacheEntry {
  payload: CanonicalPayload;
  storedAt: number;
  expiresAt?: number;
  origin: 'cache';
}

type CacheKey = string;  // costruita dal RouteResolver in base a topic + payload
```

**Invariante:** la chiave di cache è **calcolata dal Routing Engine** (non dal Cache Layer) sulla base del payload canonico — ciò garantisce determinismo. Il Cache Layer è puro storage.

#### Mapping Engine ↔ Validation Layer

```ts
interface MappingEngine {
  toCanonical(localPayload: unknown, map: FieldMapDefinition, source: EventSourceDescriptor): MappingResult;
  fromCanonical(canonicalPayload: CanonicalPayload, map: FieldMapDefinition, target: EventSourceDescriptor): MappingResult;
}

interface ValidationLayer {
  validateEvent(event: BrokerEvent): ValidationResult;        // step 3 (sintattica)
  validateTopicPayload(topic: string, payload: unknown): ValidationResult; // step 6/12
  validateCanonical(payload: CanonicalPayload, schema: string): ValidationResult; // step 6
  validatePostMapping(payload: unknown, schema: string): ValidationResult; // step 12
  validateServerResponse(response: unknown, schema: string): ValidationResult; // pre step 5 server-side mapping
}

interface ValidationResult {
  ok: boolean;
  errors?: ValidationError[];
  warnings?: ValidationWarning[];
}
```

**Invariante:** il Mapping Engine **non valida**. Validazione e mapping sono ortogonali. Il Broker chiama `validateEvent` → `mapper.toCanonical` → `validateCanonical`. Stesso pattern in uscita: `validatePostMapping` dopo `mapper.fromCanonical`.

#### Tutti i sottosistemi ↔ Developer Tooling (Event Tap)

```ts
interface EventTap {
  onPipelineStep(step: PipelineStep, snapshot: PipelineSnapshot): void;
}

type PipelineStep =
  | 'ingress' | 'enrich' | 'validate-event' | 'resolve-source'
  | 'map-out' | 'validate-canonical' | 'flow-control' | 'resolve-route'
  | 'execute-route' | 'collect-outcome' | 'map-in' | 'validate-final'
  | 'deliver' | 'observe';

interface PipelineSnapshot {
  eventId: string;
  topic: string;
  step: PipelineStep;
  durationMs: number;
  payloadBefore?: unknown;
  payloadAfter?: unknown;
  metadata: Record<string, unknown>;
}
```

**Invariante:** il Tooling è **passivo (read-only)**. Riceve snapshot ma non può alterarli. Implementato come Chain of Responsibility/Wire Tap che si registra al Broker e al Routing Engine. Disattivabile in produzione (PRD §34.1).

### 3.3 Confini di lettura/scrittura

| Componente | Può **scrivere** in | Può **leggere** da | Non deve toccare |
|---|---|---|---|
| Plugin (3rd party) | proprio stato locale | API pubblica del Broker | Topic Registry, Server Gateway |
| Core Broker | Topic Registry, Subscriber Registry, Event log | tutti i registry interni | trasporti (delegati al Gateway) |
| Mapping Engine | nessuno (puro) | Canonical Vocabulary, Alias Registry, transforms | route registry, network |
| Routing Engine | log route, stats route | Route Registry, policies | payload (delega al Mapper) |
| Server Gateway | network outbound, snapshot connessione | header config, auth tokens | Topic Registry, plugin |
| Worker Runtime | worker pool state | Worker Registry | DOM, plugin internals |
| Cache Layer | proprio storage | nessuno (sink puro) | logica di routing |
| Tooling | proprio buffer | snapshot di tutta la pipeline | nessuna mutazione |

---

## 4. Data Flow

### 4.1 Direzione della canonicalizzazione

**Senso unico ad ogni confine, doppia traduzione end-to-end.**

```
┌────────┐  output map  ┌─────────────┐  input map   ┌────────┐
│Plugin A│ ───────────► │  CANONICAL  │ ───────────► │Plugin B│
│ locale │              │   broker    │              │ locale │
└────────┘              │   internal  │              └────────┘
                        └─────────────┘
                              ▲
                              │ server→canonical map
                              │
                        ┌─────────────┐
                        │  Server raw │
                        └─────────────┘
                              ▲
                              │ canonical→server map (per richieste outbound)
                              │
                        ┌─────────────┐
                        │  CANONICAL  │
                        └─────────────┘
```

**Regole (PRD §13.5 default V1 — canonicalizzazione interna completa):**
1. Tutto ciò che entra nel Broker viene **immediatamente canonicalizzato** (step 5).
2. Internamente i dati transitano **sempre canonici** tra Broker, Routing Engine, Cache, Worker.
3. La traduzione inversa avviene **solo all'ultimo miglio** (step 11), una per ciascun consumer, con la sua `inputMap`.

**Conseguenze:**
- La cache memorizza payload canonici → cache hit serve diversi consumer con `inputMap` differenti.
- I worker ricevono e ritornano canonico → testabili in isolamento conoscendo solo il vocabolario canonico.
- I log/inspector mostrano un formato uniforme.

### 4.2 Quando avviene la validazione (5 livelli, PRD §21.2)

```
┌─────────────┐
│ Pub event   │
└──────┬──────┘
       │
       ▼
[1] validateEvent (sintattica BrokerEvent)         ← step 3 pipeline
       │
       ▼
[2] validateTopicPayload (schema topic locale)     ← step 3+ (opzionale, post enrich)
       │
       ▼ output map
       ▼
[3] validateCanonical (schema canonico)            ← step 6 pipeline
       │
       ▼ route resolution + execution
       ▼ (se route HTTP outbound: server response arriva)
       ▼
[5] validateServerResponse (schema risposta server) ← prima di rimappare server→canonical
       │
       ▼ server→canonical map
       ▼ input map verso consumer
       ▼
[4] validatePostMapping (schema input consumer)    ← step 12 pipeline
       │
       ▼
[deliver]
```

**Regola operativa:**
- Validazione **fail-fast**: payload invalidi non procedono (PRD §21.4).
- Su fallimento: pubblicazione di `mapping.error` o `<topic>.failed` (ERR-02).
- Eccezione esplicita: solo se la route ha policy `error: 'lenient'` un payload con warning può procedere.

### 4.3 Dove si applica dedupe e backpressure

**Posizionamento: dopo canonicalizzazione + validazione canonica, prima della route resolution.** (Step 7 della pipeline.)

**Rationale:**
- **Dopo** canonicalizzazione → la `dedupeKey` può essere calcolata su campi canonici stabili (non su nomi locali variabili).
- **Prima** della route resolution → eventi scartati non innescano lavoro inutile (rete/worker).
- **Dopo** validazione canonica → garantiamo che eventi malformati non popolino la dedupe cache con chiavi spurie.

```
┌──────────────────────────────────────────────────────┐
│  Step 5: map → canonical                             │
│  Step 6: validate canonical    ✓ payload pulito      │
│  Step 7: FlowController                              │
│         ├── DedupeStrategy (dedupeKey)               │
│         ├── BackpressureStrategy (throttle/debounce/ │
│         │    latest-only/bounded-queue/coalesce)     │
│         └── decisione: PROCEED | DROP | DEFER        │
│  Step 8: route resolution                            │
└──────────────────────────────────────────────────────┘
```

**Eccezione:** una route può sovrascrivere policy di dedupe locale (PRD §17.8 `dedupe`) — opera però come *secondo livello* sui RouteOutcome (es. dedupe di richieste HTTP in volo già fatte), non sostituisce il flow controller globale.

### 4.4 Propagazione di correlationId, causationId, traceId

```
┌─────────────────────────────────────────────────────────────────┐
│ Plugin pubblica   weather.requested                             │
│   correlationId: "user-action-123"  (utente o auto-gen)         │
│   causationId:   undefined          (è l'origine)               │
│   traceId:       "trace-abc"        (auto-gen se assente)       │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
                   route HTTP /api/weather
                     X-Correlation-Id: user-action-123
                     X-Trace-Id: trace-abc
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ Server response → Broker pubblica   weather.loaded              │
│   correlationId: "user-action-123"  (PROPAGATO dall'evento orig)│
│   causationId:   <id di weather.requested>  (NUOVO link causale)│
│   traceId:       "trace-abc"        (PROPAGATO)                 │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
            Subscriber riceve weather.loaded e ne deriva
            altri eventi con stesso traceId + chain di causation
```

**Regole:**
- `traceId`: invariante per tutta la catena di eventi correlati. Se assente, generato dal Broker al primo step. Stato globale del "trace".
- `correlationId`: ID di un'operazione logica utente. Propagato 1:1 attraverso tutti gli eventi figli. Stato di una "richiesta logica".
- `causationId`: ID dell'evento *che ha causato* questo evento. Si aggiorna a ogni hop. Stato di "padre immediato".
- Lo stesso pattern si propaga in headers HTTP (`X-Correlation-Id`, `X-Trace-Id`) e nei messaggi worker (`message.correlationId`, `message.traceId`).

**Implementazione:** un componente `ContextPropagator` (interceptor in pipeline + middleware in Adapter) gestisce centralmente queste regole.

### 4.5 Pipeline ufficiale completa (PRD §28) — testuale

```
[Publisher]
    │ broker.publish(topic, payload, options?)
    ▼
[1] IngressFilter ──────────────────────► event creation, pre-checks
    │
    ▼
[2] MetadataEnricher ────────────────────► id, timestamp, traceId, source
    │
    ▼
[3] EventValidator ──────────────────────► validate BrokerEvent shape
    │   (fail → mapping.error / drop)
    ▼
[4] SourceResolver ──────────────────────► verify source ∈ Plugin Registry
    │
    ▼
[5] OutputMapper ────────────────────────► local → canonical (Mapper)
    │
    ▼
[6] CanonicalValidator ──────────────────► validate against canonical schema
    │   (fail → mapping.error / drop)
    ▼
[7] FlowController ──────────────────────► dedupe + backpressure
    │   (drop / defer / proceed)
    ▼
[8] RouteResolver ───────────────────────► find matching routes
    │
    ▼
[9] RouteExecutor ───────────────────────► dispatch a:
    │    │
    │    ├── LocalAdapter      (subscriber locali)
    │    ├── HttpClient        (Server Gateway)
    │    ├── WorkerBridge      (Worker Runtime)
    │    ├── CacheStore        (Cache Layer)
    │    └── Composite         (chain di route)
    │
    ▼
[10] OutcomeCollector ───────────────────► raccoglie RouteOutcome[]
    │
    ▼
[11] InputMapper (per ciascun subscriber) → canonical → consumer-local
    │
    ▼
[12] DeliveryValidator ──────────────────► validate post-map
    │
    ▼
[13] DeliveryDispatcher ─────────────────► invoca handler subscriber
    │
    ▼
[14] ObservabilityTap (cross-cutting) ───► logger, metrics, inspector buffer
```

**Step 14 è cross-cutting**: viene invocato a *ogni* transizione di step, non solo alla fine. È il `Wire Tap` di Hohpe.

---

## 5. Build Order — mappatura sulle 6 fasi PRD §32

### 5.1 Tabella riassuntiva

| Fase PRD | Capability | Dipende da | Interfacce stabili da congelare |
|---|---|---|---|
| **F1 Core** | Event bus, registry, plugin lifecycle, logger | — | `BrokerEvent`, `Plugin descriptor`, `Logger`, `Subscription handle` |
| **F2 Canonical/Mapper** | Vocabolario, mapper bidirezionale, transforms, mapping inspector | F1 | `FieldMapDefinition`, `MappingEngine`, `TransformFunction`, `CanonicalPayload` |
| **F3 Routing/HTTP** | Route engine, fetch route, retry/timeout, error events | F1 + F2 | `RouteDefinition`, `HttpClient`, `RoutePolicies`, `RouteOutcome` |
| **F4 Realtime** | SSE adapter, reconnect policy, server message normalization | F1 + F2 + F3 | `RealtimeChannel`, `ReconnectPolicy`, server-side mapping |
| **F5 Worker** | Worker registry, worker route, task tracking, errors | F1 + F2 + F3 | `WorkerTask`, `WorkerResult`, `WorkerBridge` |
| **F6 Cache + Tooling** | Cache layer, route inspector, metrics, advanced debug | F1-F5 | `CacheStore`, `EventTap`, `MetricsCollector`, `DebugSnapshot` |

### 5.2 Dipendenze "hard" e interfacce stabili

#### Fase 1 → Core essenziale

**Dipendenze:** nessuna (greenfield).

**Output stabile (non si tocca più dalle fasi successive):**
- Tipo `BrokerEvent<T>` finale e congelato.
- API `publish` / `subscribe` / `unsubscribe`.
- API `registerPlugin` / `unregisterPlugin` con lifecycle hooks.
- `Logger` con livelli `silent/error/warn/info/debug/trace`.
- `BrokerError` factory.

**Razionale:** se F1 cambia, F2-F6 si rompono. Va specificata e testata fino in fondo (TEST-01 lifecycle, dedupe handle).

**Note:** `priority`, `ttlMs`, `dedupeKey` su `BrokerEvent` esistono come campi ma il **comportamento** (dedupe attivo, backpressure, ttl) è implementato in F3+. È volutamente possibile dichiarare l'intenzione in F1 e implementarla dopo.

#### Fase 2 → Canonical Model & Mapper

**Dipendenze hard su F1:**
- `BrokerEvent.payload` come slot tipato dove inserire `CanonicalPayload`.
- `Plugin descriptor` deve avere campi `inputMap` / `outputMap`.
- Pipeline step 5/11/12 invocano il Mapper.

**Output stabile:**
- `FieldMapDefinition` finale (rename, nested, default, transform, derive).
- `MappingEngine.toCanonical` / `.fromCanonical`.
- `Canonical Vocabulary Registry` API.
- Convenzione `$derive`.

**Razionale:** F3 (routing HTTP) usa il Mapper per `queryMap`/`bodyMap`; F4 lo usa per server→canonical; F5 lo usa per worker payload canonici. Cambiare F2 dopo significa toccare tutti questi.

**Strategia di rilascio progressivo:** F2 può uscire prima con solo rename + transform, e aggiungere `$derive` + nested in iterazione successiva, **purché le firme delle funzioni siano stabili dal giorno 1**.

#### Fase 3 → Routing e HTTP gateway

**Dipendenze hard su F1+F2:**
- Pipeline §28 step 8/9 esiste.
- Mapper canonicalizza prima di costruire `HttpRequest`.
- `BrokerError` per propagare network errors.

**Output stabile:**
- `RouteDefinition` (con `on`, `type`, `request`, `publishes`, `policies`).
- `RoutePolicies` (timeout, retry, dedupe, error, backpressure, auth).
- `HttpClient` interface.
- Eventi standard `<topic>.failed`, `network.error`.
- `RouteOutcome`.

**Razionale:** F4 e F5 introducono nuovi tipi di route ma non devono ridisegnare il `RouteDefinition`. Se F3 uscisse senza considerare le policy comuni, in F4/F5 si dovrebbero retrofittare.

**Trade-off architetturale F3:** scegliere fra (a) `RouteDefinition` discriminata via campo `type` con tutte le varianti, oppure (b) interfaccia base + estensioni. **Raccomandazione:** discriminata via `type` con `RouteHandler` registry estensibile — più semplice da typecheckare e da estendere.

#### Fase 4 → Realtime inbound

**Dipendenze hard su F3:**
- Pattern di error event riusato (`<topic>.failed`).
- Server-side mapping (server→canonical) usa lo stesso `MappingEngine`.
- Le policy `auth` e `retry` sono riutilizzabili.

**Output stabile:**
- `RealtimeChannel` interface (SSE come prima implementazione, WS plug-in).
- `ReconnectPolicy` (interval, exponential backoff, max retry, heartbeat, jitter — PRD §18.6).
- `RawServerMessage` → `BrokerEvent` normalization function.

**Razionale:** F4 è quasi indipendente da F5. Può essere parallelizzato a F5 dopo aver chiuso F3.

#### Fase 5 → Worker runtime

**Dipendenze hard su F3:**
- `RouteDefinition` con `type: 'worker'`.
- Pipeline canonicalizza prima del dispatch.
- Eventi standard `<topic>.completed`, `<topic>.failed`.

**Output stabile:**
- `WorkerRegistry` API.
- `WorkerTask` / `WorkerResult` schema (serializzato cross-thread).
- `WorkerBridge` con messaging contract documentato (PRD §39, "serializzazione messaggi worker").

**Razionale:** F5 è ortogonale a F4 — entrambi possono essere sviluppati in parallelo dopo F3.

#### Fase 6 → Cache + Tooling avanzato

**Dipendenze hard su F1-F5:**
- Cache: route `cache` e `composite` (F3) la usano.
- Tooling: `EventTap` registra hook a *ogni* fase.

**Output stabile:**
- `CacheStore` API.
- `EventTap` / `PipelineSnapshot` (interfaccia che i tooling consumano).
- `MetricsCollector` con metriche standard PRD §25.5.

**Razionale:** posporre F6 a fine percorso significa che le interfacce di cui si nutre (Tap su pipeline) devono essere progettate fin dalle fasi precedenti, anche se non implementate. **Decisione architetturale forte:** F1 deve già emettere `EventTap` (anche se ne esiste solo l'interfaccia + un no-op). Altrimenti aggiungerla in F6 è invasivo.

### 5.3 Vincolo trasversale: il "Tap" va dichiarato in F1

Per evitare retrofit doloroso del Tooling in F6:

- **In F1**: definire l'interfaccia `EventTap` e instrumentare la pipeline con chiamate `tap.onPipelineStep(step, snapshot)`. Esiste un'unica implementazione no-op.
- **In F2-F5**: ogni fase aggiunge chiamate `tap.onPipelineStep` ai propri step.
- **In F6**: il Tooling si aggancia con implementazioni reali (Inspector, Metrics, Logger avanzato).

Questo è il pattern *Wire Tap* di Hohpe applicato preventivamente.

---

## 6. API surface stratificata

### 6.1 Strato 1 — API pubblica utente (consumatore della libreria)

```ts
// File: src/index.ts
export function createBroker(config: BrokerConfig): Broker;

export interface Broker {
  // Pub/Sub core
  publish<T>(topic: string, payload: T, options?: PublishOptions): Promise<void>;
  subscribe<T>(topic: string, handler: SubscribeHandler<T>, options?: SubscribeOptions): Subscription;
  unsubscribe(subscriptionId: string): void;

  // Plugin
  registerPlugin(descriptor: BrokerPluginDescriptor): PluginHandle;
  unregisterPlugin(pluginId: string): void;

  // Routing
  registerRoute(routeDefinition: RouteDefinition): RouteHandle;
  unregisterRoute(routeId: string): void;

  // Canonical
  registerCanonicalSchema(schemaDefinition: CanonicalSchemaDefinition): void;
  registerTransform(name: string, fn: TransformFunction): void;

  // Realtime
  connectRealtime(): Promise<void>;
  disconnectRealtime(): Promise<void>;

  // Debug & metrics
  enableDebug(): void;
  disableDebug(): void;
  getDebugSnapshot(): DebugSnapshot;
  getMetrics(): Metrics;

  // Topic & queue control
  pauseTopic(topic: string): void;
  resumeTopic(topic: string): void;
  flushQueue(topic?: string): Promise<void>;

  // Registry getters (read-only)
  getTopicRegistry(): ReadonlyTopicRegistry;
  getPluginRegistry(): ReadonlyPluginRegistry;
  getRouteRegistry(): ReadonlyRouteRegistry;
}
```

**Caratteristiche:** API stabile, documentata, retro-compatibile. Tutti i metodi PRD §16.2 e §16.3.

### 6.2 Strato 2 — API plugin (autori di plugin)

```ts
// File: src/types/plugin.ts
export interface BrokerPluginDescriptor {
  id: string;
  name: string;
  version: string;
  subscribes?: PluginSubscriptionDescriptor[];
  publishes?: PluginPublicationDescriptor[];
  inputMap?: FieldMapDefinition;
  outputMap?: FieldMapDefinition;
  handlers?: Record<string, PluginEventHandler>;
  lifecycle?: PluginLifecycleHooks;
  capabilities?: PluginCapabilities;
}

export interface PluginLifecycleHooks {
  onRegister?: (ctx: PluginContext) => void | Promise<void>;
  onMount?: (ctx: PluginContext) => void | Promise<void>;
  onUnmount?: () => void | Promise<void>;
  onDestroy?: () => void | Promise<void>;
}

export interface PluginContext {
  // Read-only: il plugin può conoscere il proprio runtime ma non altri plugin
  pluginId: string;
  log: Logger;
  publish: <T>(topic: string, payload: T, options?: PublishOptions) => Promise<void>;
  // Importante: NO accesso diretto ad altri plugin né al broker completo
}
```

**Caratteristiche:** contratto chiaro, isolato. Il plugin non ha riferimenti ad altri plugin né al broker globale (PRD §15.6 "il plugin non deve assumere che il publisher originario sia noto").

### 6.3 Strato 3 — API interna (componenti del broker)

```ts
// File: src/core/topic-registry.ts
export interface TopicRegistry {
  register(topic: string, schema?: TopicSchema): void;
  unregister(topic: string): void;
  has(topic: string): boolean;
  match(topicPattern: string): string[];  // wildcard support
  list(): TopicEntry[];
}

// File: src/core/subscriber-registry.ts
export interface SubscriberRegistry {
  add(topicPattern: string, sub: SubscriberEntry): string;  // returns id
  remove(id: string): void;
  findFor(topic: string): SubscriberEntry[];
  removeByPlugin(pluginId: string): void;
}

// Internal mapping engine
export interface MappingEngineInternal {
  toCanonical(payload: unknown, map: FieldMapDefinition, source: EventSourceDescriptor): MappingResult;
  fromCanonical(payload: CanonicalPayload, map: FieldMapDefinition, target: EventSourceDescriptor): MappingResult;
  resolveTransform(name: string): TransformFunction | undefined;
}
```

**Caratteristiche:** non esportata fuori dal package (no `export` da `src/index.ts`). Cambiabile internamente senza breaking changes esterni.

### 6.4 Strato 4 — Extension points

```ts
// File: src/types/extensions.ts

// Trasformazioni custom
export type TransformFunction = (input: unknown, ctx: TransformContext) => unknown;

// Adapter custom (per chi vuole aggiungere trasporti)
export interface AdapterRegistry {
  registerHttpAdapter(name: string, adapter: HttpClient): void;
  registerRealtimeAdapter(name: string, adapter: RealtimeChannelManager): void;
  registerCacheAdapter(name: string, adapter: CacheStore): void;
}

// Custom route handler
export interface RouteHandlerRegistry {
  registerHandler<TConfig>(routeType: string, handler: RouteHandler<TConfig>): void;
}
```

**Caratteristiche:** punti documentati per estendibilità senza fork. Permettono adapter alternativi (es. fetch custom con interceptor, IndexedDB persistente, route con tipo nuovo).

### 6.5 Riassunto stratificazione

```
┌─────────────────────────────────────────────────────┐
│ Strato 1 — API pubblica utente                      │
│ src/index.ts → Broker, createBroker                 │
├─────────────────────────────────────────────────────┤
│ Strato 2 — API plugin                               │
│ src/types/plugin.ts → BrokerPluginDescriptor        │
├─────────────────────────────────────────────────────┤
│ Strato 4 — Extension points                         │
│ TransformFunction, AdapterRegistry, RouteHandler    │
├─────────────────────────────────────────────────────┤
│ Strato 3 — API interna (NON esportata)              │
│ TopicRegistry, SubscriberRegistry, MappingEngine    │
└─────────────────────────────────────────────────────┘
```

---

## 7. Module Structure consigliata (file system)

### 7.1 Struttura proposta

```
src/
├── index.ts                          # Strato 1 — API pubblica (export createBroker)
│
├── core/                             # Fase 1 — Core Broker
│   ├── broker.ts                     # Mediator centrale, orchestra pipeline
│   ├── event-bus.ts                  # Publish/subscribe core
│   ├── topic-registry.ts             # Registro topic (con schema)
│   ├── subscriber-registry.ts        # Registro sottoscrittori
│   ├── plugin-registry.ts            # Registro plugin + lifecycle
│   ├── lifecycle-manager.ts          # Gestione mount/unmount/destroy
│   ├── pipeline.ts                   # Pipes-and-Filters orchestrator (14 step)
│   ├── id-generator.ts               # ID univoci eventi (uuid v4 o nanoid)
│   ├── topic-matcher.ts              # Wildcard matching (weather.* / *.failed)
│   └── lifecycle-tracker.ts          # Anti-leak + auto-unsubscribe
│
├── canonical/                        # Fase 2 — Canonical Model
│   ├── vocabulary-registry.ts        # Registro campi canonici
│   ├── alias-registry.ts             # Alias → canonical (con warning ambiguità)
│   ├── schema-registry.ts            # Schemi canonici (JSON Schema o Zod)
│   └── canonical-types.ts            # CanonicalField, CanonicalSchema types
│
├── mapper/                           # Fase 2 — Mapper engine
│   ├── mapping-engine.ts             # toCanonical + fromCanonical
│   ├── transformations.ts            # Pipeline di trasformazioni
│   ├── transform-registry.ts         # Built-in + custom transforms
│   ├── derive.ts                     # $derive logic per campi derivati
│   ├── nested-mapping.ts             # Helpers per mapping nested
│   ├── default-values.ts             # Gestione default
│   └── mapping-inspector.ts          # Hook per Mapping Inspector (output a Tooling)
│
├── routing/                          # Fase 3-5 — Routing engine
│   ├── route-engine.ts               # Orchestratore step 8-9 pipeline
│   ├── route-registry.ts             # Registro route
│   ├── route-resolver.ts             # Match topic → route(s) con priorità
│   ├── route-executor.ts             # Esegue route via Adapter
│   ├── handlers/
│   │   ├── local-route.ts            # Consegna locale (subscriber)
│   │   ├── http-route.ts             # Fase 3 — fetch outbound
│   │   ├── worker-route.ts           # Fase 5 — dispatch worker
│   │   ├── cache-route.ts            # Fase 6 — cache-first/network-first/etc
│   │   └── composite-route.ts        # Workflow chain di route
│   └── policies/
│       ├── retry.ts                  # ExponentialBackoff, Linear, None
│       ├── timeout.ts                # Timeout per route
│       ├── dedupe.ts                 # Dedupe by key
│       ├── backpressure.ts           # Throttle, debounce, latest-only, bounded
│       ├── error.ts                  # Retry4xx vs 5xx policy
│       └── auth.ts                   # Bearer / custom hook
│
├── gateway/                          # Fase 3-4 — Server Gateway
│   ├── http-client.ts                # Wrapper fetch con interceptor
│   ├── auth-manager.ts               # Header auth + token refresh
│   ├── circuit-breaker.ts            # (futuro, opzionale)
│   ├── retry-driver.ts               # Esegue retry strategy sopra fetch
│   ├── realtime/
│   │   ├── realtime-manager.ts       # Manager comune SSE/WS
│   │   ├── sse-client.ts             # Fase 4 — SSE adapter
│   │   ├── websocket-client.ts       # Fase 4 — WS adapter (opzionale V1)
│   │   ├── reconnect-policy.ts       # Reconnect interval + backoff + jitter
│   │   ├── heartbeat.ts              # Heartbeat + stale detection
│   │   └── server-message-normalizer.ts  # Server raw → BrokerEvent
│   └── server-mapping.ts             # Server response ↔ canonical mapping
│
├── worker/                           # Fase 5 — Worker Runtime
│   ├── worker-registry.ts            # Registro worker (id → factory)
│   ├── worker-pool.ts                # Pool/dedicated worker
│   ├── message-bridge.ts             # postMessage ↔ event bridge
│   ├── task-tracker.ts               # Task correlation + cancellation
│   ├── worker-protocol.ts            # Schema messaggi worker (PRD §39)
│   └── timeout-driver.ts             # Timeout task
│
├── cache/                            # Fase 6 — State/Cache Layer
│   ├── cache-store.ts                # Interfaccia comune
│   ├── memory-store.ts               # In-memory (Map + TTL)
│   ├── indexeddb-store.ts            # IndexedDB adapter (opzionale)
│   ├── cache-policies.ts             # cache-first/network-first/cache-then-network
│   └── invalidation.ts               # Manuale + automatica (TTL, pattern)
│
├── validation/                       # Cross-cutting — Validation Layer
│   ├── validator.ts                  # Interface comune
│   ├── event-validator.ts            # Step 3: BrokerEvent shape
│   ├── canonical-validator.ts        # Step 6: schema canonico
│   ├── post-mapping-validator.ts     # Step 12: schema input consumer
│   ├── server-response-validator.ts  # Pre-mapping server response
│   └── schema-adapters/
│       ├── json-schema-adapter.ts    # Adapter per JSON Schema
│       └── zod-adapter.ts            # Adapter per Zod (consigliato — TS-first)
│
├── tooling/                          # Fase 6 — Developer Tooling
│   ├── event-tap.ts                  # Wire Tap interface (definita in F1, usata in F6)
│   ├── event-inspector.ts            # Buffer eventi + query
│   ├── mapping-inspector.ts          # Buffer mapping + warning
│   ├── route-inspector.ts            # Buffer route execution
│   ├── metrics-collector.ts          # Counters, timers, gauges
│   ├── debug-snapshot.ts             # Stato runtime serializzabile
│   └── logger.ts                     # silent/error/warn/info/debug/trace
│
├── errors/                           # Cross-cutting — Error handling
│   ├── broker-error.ts               # BrokerError class + factory
│   ├── error-codes.ts                # Codici standard (MAP-FAIL, NET-TIMEOUT, …)
│   ├── error-categories.ts           # mapping/network/worker/validation/…
│   └── error-events.ts               # Pubblicazione standard <topic>.failed, system.error
│
├── context/                          # Cross-cutting — Context propagation
│   ├── trace-context.ts              # traceId / correlationId / causationId
│   └── context-propagator.ts         # Middleware che propaga contesto in HTTP/worker
│
├── config/                           # Configurazione
│   ├── broker-config.ts              # BrokerConfig type + defaults
│   ├── runtime-options.ts            # Opzioni runtime
│   └── config-validator.ts           # Validazione config in startup
│
├── types/                            # Tipi condivisi (esportati o interni)
│   ├── event.ts                      # BrokerEvent, EventSourceDescriptor
│   ├── plugin.ts                     # BrokerPluginDescriptor + Lifecycle
│   ├── route.ts                      # RouteDefinition + RoutePolicies
│   ├── canonical.ts                  # CanonicalPayload, CanonicalField
│   ├── mapping.ts                    # FieldMapDefinition
│   ├── error.ts                      # BrokerError
│   ├── tooling.ts                    # PipelineSnapshot, EventTap
│   └── extensions.ts                 # TransformFunction, AdapterRegistry
│
└── utils/                            # Utility puri
    ├── async-queue.ts
    ├── deep-clone.ts
    ├── deep-merge.ts
    ├── path-access.ts                # Get/set per path nested ("a.b.c")
    └── time.ts                       # now(), ttl helpers
```

### 7.2 Trade-off rispetto alla struttura indicata in input

La struttura proposta nel prompt è **largamente confermata**, con alcuni aggiustamenti motivati:

**Aggiunte rispetto al prompt:**

1. **`src/validation/`** come modulo separato (non solo dentro `mapper/`). Razionale: la validazione è cross-cutting (PRD §21.2 ha 5 livelli, tre dei quali fuori dal mapper). Tenerla in `mapper/` la confonde con la logica di traduzione.
2. **`src/errors/`** dedicato. Razionale: PRD §22.4 specifica `BrokerError` ed eventi standard di errore (PRD §22.3). Centralizzare permette factory consistenti e cataloghi di codici. Anti-pattern: error logic sparsa in ogni modulo.
3. **`src/context/`** per propagazione `traceId/correlationId/causationId`. Razionale: trasversale a Broker, Routing, Gateway, Worker. Dedicarci un modulo evita duplicazione.
4. **`src/config/`** dedicato. Razionale: la config (PRD §27) è composita e va validata in startup; tenerla a parte aiuta la lettura.
5. **`src/routing/policies/`** sottocartella. Razionale: ogni policy è una Strategy autonoma — molti file piccoli vs un singolo `policies.ts` enorme.
6. **`src/gateway/realtime/`** sottocartella anziché `src/gateway/sse-client.ts` flat. Razionale: SSE + WebSocket + reconnect + heartbeat sono coesi.

**Conferme rispetto al prompt:**
- `src/core/`, `src/canonical/`, `src/mapper/`, `src/routing/`, `src/gateway/`, `src/worker/`, `src/cache/`, `src/tooling/`, `src/types/`, `src/index.ts` — tutti presenti come da prompt.

**Trade-off discusso:**
- **Routing in un solo file vs cartella?** → Cartella `routing/handlers/` + `policies/`. Motivo: ogni handler (local/http/worker/cache/composite) ha logica ricca; metterli in un unico file genera 1500+ righe difficili da mantenere.
- **Gateway HTTP separato dal Routing?** → SÌ. PRD §10 li separa concettualmente (Routing Engine vs Server Gateway). HttpClient è un Adapter, RouteEngine è la Strategy hub.
- **`src/utils/` minimale.** Solo helper veramente generici; non riempirla con logica di dominio.

### 7.3 Convenzione di import

```
- src/index.ts importa solo da: src/core, src/types, src/config
- src/core/* può importare da: src/types, src/utils, src/errors, src/tooling/event-tap
- src/canonical/* + src/mapper/* importano da: src/types, src/errors, src/utils, src/validation
- src/routing/* importa da: src/core/* (limitato), src/canonical, src/mapper, src/types, src/gateway, src/worker, src/cache, src/errors
- src/gateway/* importa da: src/types, src/errors, src/context
- src/worker/* importa da: src/types, src/errors, src/context
- src/cache/* importa da: src/types, src/errors
- src/tooling/* importa da: src/types (solo lettura: NIENTE mutazione su core)
- src/validation/* importa da: src/types, src/errors
- src/errors/* importa da: src/types
- src/context/* importa da: src/types
- src/config/* importa da: src/types
- src/utils/* è puro (non importa altri moduli del progetto)
```

**Anti-pattern da evitare:** dipendenze circolari fra `routing/` e `core/` (entrambi possono richiamarsi). Soluzione: il Core invoca il RoutingEngine via interfaccia iniettata in costruzione (Dependency Injection minima).

---

## 8. Cross-cutting concerns

### 8.1 Logging (come attraversa tutti i moduli)

**Pattern:** Strategy + Wire Tap + DI minima.

```
┌────────────────────┐
│ src/tooling/logger │ ◄──── unica implementazione condivisa
└────────┬───────────┘
         │
         │ iniettato in:
         ▼
┌──────────────────────────────────────────────────────────┐
│ Broker, RouteEngine, Gateway, WorkerRuntime, Mapper, …   │
│ → ognuno riceve un Logger nominalizzato (child logger)   │
│ → es. logger.child({ component: 'gateway.http' })        │
└──────────────────────────────────────────────────────────┘
```

**Regole:**
- Ogni modulo ottiene un `Logger` nel costruttore (no singleton globale che maschera dipendenze).
- I livelli sono `silent | error | warn | info | debug | trace`.
- `debug` e `trace` no-op in produzione (PRD §34.1 — debug deve poter essere disattivato).
- Niente `console.log` sparsi: tutto via `logger`.

### 8.2 Validation (singolo punto di chiamata vs distribuito)

**Pattern:** distribuito ma orchestrato.

- Il `ValidationLayer` espone funzioni pure (`validateEvent`, `validateCanonical`, …).
- La **pipeline** (`src/core/pipeline.ts`) è l'unico chiamante orchestratore: invoca i validator agli step 3, 6, 12 + step pre-server-mapping.
- Il `RouteExecutor` non valida — delega alla pipeline.

**Anti-pattern evitato:** un plugin invoca direttamente il validator. Questo è proibito: i plugin pubblicano e basta, la pipeline si occupa di validare.

**Schema adapter (architetturalmente):** `src/validation/schema-adapters/` con due implementazioni — JSON Schema (interoperabile) e Zod (TypeScript-first, raccomandato per V1). L'utente sceglie via config.

### 8.3 Metrics collection

**Pattern:** Tap (Wire Tap di Hohpe).

```
Pipeline ──tap.onPipelineStep()──► EventTap (no-op default)
                                   │
                                   ├──► EventInspector buffer
                                   ├──► MetricsCollector counters/timers
                                   └──► RouteInspector buffer
```

- **Non** middleware bloccante (mai sulla path critica).
- Implementato come callback registrate, eseguite in `setTimeout(0)` o microtask se devono essere async.
- Disattivabile con `disableDebug()` → l'EventTap diventa no-op (zero overhead).

**Metriche standard PRD §25.5:**
- `events_published_per_sec` (counter rate)
- `events_dropped_total` (counter)
- `errors_by_category_total` (counter, label=category)
- `route_http_duration_ms` (histogram, label=routeId)
- `route_worker_duration_ms` (histogram, label=routeId)
- `cache_hit_ratio` (gauge)
- `subscribers_per_topic` (gauge)
- `topic_backlog_size` (gauge)

### 8.4 Error handling uniforme (BrokerError factory)

**Pattern:** factory + catalogo codici.

```ts
// src/errors/broker-error.ts
export class BrokerError extends Error {
  code: string;
  category: ErrorCategory;
  details?: unknown;
  originalError?: unknown;
  routeId?: string;
  topic?: string;
  eventId?: string;

  static mappingError(opts): BrokerError { ... }
  static networkError(opts): BrokerError { ... }
  static workerError(opts): BrokerError { ... }
  static validationError(opts): BrokerError { ... }
  static timeoutError(opts): BrokerError { ... }
  // ...
}
```

**Pubblicazione automatica (ERR-02):**
- `mapping.error` → quando il Mapper fallisce.
- `<topic>.failed` → quando una route HTTP/worker fallisce.
- `network.error` → errore trasporto.
- `worker.error` → errore runtime worker.
- `system.error` → errore non categorizzato (catch-all).

**Isolamento (PRD §22.2, ERR-03):**
- Un errore in un handler subscriber non deve far crashare il broker.
- I subscriber sono invocati in try/catch; in caso di throw → publish `system.error` + log.

---

## 9. Plugin contract

### 9.1 Dichiarazione (PRD §15.2 + estensioni)

```ts
broker.registerPlugin({
  id: 'weather-form',                  // univoco runtime-wide (PRD §30.1)
  name: 'Weather Form',
  version: '1.0.0',
  subscribes: [                         // topic in input
    { topic: 'weather.loaded', schema: 'weatherDataSchema' }
  ],
  publishes: [                          // topic in output
    { topic: 'weather.requested', schema: 'weatherRequestSchema' }
  ],
  inputMap: { ... },                   // canonico → locale plugin
  outputMap: { ... },                  // locale plugin → canonico
  handlers: {
    'weather.loaded': (payload, ctx) => { /* ... */ }
  },
  lifecycle: {
    onMount: async (ctx) => { /* ... */ },
    onUnmount: async () => { /* ... */ },
  },
  capabilities: {
    requiresRealtime: false,
    requiresWorker: false,
  }
});
```

### 9.2 Isolamento plugin (per evitare blocco reciproco)

**Strategie applicate:**

1. **Handler in try/catch.** Ogni invocazione di handler avvolta in try/catch nel `DeliveryDispatcher`. Throw → `BrokerError.handlerError()` + log + publish `<topic>.failed`. Gli altri handler sullo stesso topic procedono comunque.

2. **Async-first.** Gli handler ritornano `Promise<void>`. Eseguiti con `Promise.allSettled` per non bloccarsi tra loro.

3. **Timeout opzionale per handler.** Configurabile su subscribe — se il plugin specifica `mode: 'sync'` con timeout, oltre il limite si logga warning ma non si crasha.

4. **No accesso reciproco diretto.** Il `PluginContext` esposto a un plugin (vedi §6.2) non contiene reference ad altri plugin né al broker globale — solo `pluginId`, `log`, `publish`. Chi vuole reagire ad altri plugin lo fa via topic.

5. **Plugin in worker (opzionale, futuro).** Per plugin pesanti, si può prevedere un'esecuzione in Web Worker (PRD §19) — ma è una feature opzionale, non per V1.

### 9.3 Collisioni di plugin id (PRD §30.3)

**Regola operativa:**

```ts
broker.registerPlugin({ id: 'foo', ... });
broker.registerPlugin({ id: 'foo', ... });  // ← cosa succede?
```

**Comportamento prescritto:**
- **Default**: throw `BrokerError.pluginCollision({ id: 'foo' })`. Il primo registrato vince, il secondo fallisce.
- **Override esplicito**: configurazione `runtime.allowPluginOverride: true` permette il replace (con `unregisterPlugin('foo')` automatico del precedente, inclusi unsubscribe e cleanup lifecycle).
- **Versioning**: se due plugin con stesso `id` ma `version` diversa → log warning e default fail; se `allowPluginOverride: true` + versione più alta → replace; versione più bassa → fail.

**Auditabilità:** ogni collisione genera evento `system.error` con `code: 'PLUGIN_COLLISION'` e dettagli (id, versione esistente, versione tentata).

---

## 10. Testabilità

### 10.1 Strategie per testare in isolamento

**Mock Server Gateway (per integration test plugin → broker → server):**

```ts
import { createBroker, MockHttpClient } from 'sembridge';

const mockHttp = new MockHttpClient();
mockHttp.on('GET /api/weather').respond({ status: 200, body: { temp: 21, ... } });

const broker = createBroker({
  gateway: { http: mockHttp }   // ← iniezione esplicita
});

await broker.publish('weather.requested', { city: 'Roma' });
expect(await waitForEvent(broker, 'weather.loaded')).toMatchObject({ temperature: 21 });
```

**Mock Worker Runtime:**

```ts
import { FakeWorkerBridge } from 'sembridge/test';

const fakeWorker = new FakeWorkerBridge('report-worker');
fakeWorker.handle('generateReport', async (payload) => {
  return { report: 'fake-report-data' };
});

const broker = createBroker({
  workers: { 'report-worker': fakeWorker }
});
```

**Test harness pipeline §28 step-by-step:**

```ts
import { PipelineHarness } from 'sembridge/test';

const harness = new PipelineHarness(broker);
const trace = await harness.publish('weather.requested', { city: 'Roma' });

expect(trace.steps).toEqual([
  { step: 'ingress', durationMs: expect.any(Number) },
  { step: 'enrich', payloadAfter: expect.objectContaining({ id: expect.any(String) }) },
  { step: 'validate-event', ok: true },
  { step: 'map-out', payloadAfter: { location: 'Roma', forecast_date: ... } },
  // ...
]);
```

L'harness sfrutta il `EventTap` interno per registrare ogni snapshot.

### 10.2 Granularità di test

| Livello | Scope | Tooling |
|---|---|---|
| **Unit** | singolo file/modulo | Vitest/Jest, no broker reale, mock dipendenze |
| **Integration** | Broker + 2-3 moduli reali | broker reale + mock di Gateway/Worker |
| **End-to-end** | broker reale + adapter reali (fetch mockato a livello network, MSW) | Playwright o jsdom + MSW |

**TEST-01 (unit) PRD §35.1**: copertura minima documentata.
**TEST-02 (integration) PRD §35.2**: i 6 scenari obbligatori.
**TEST-03 (robustness) PRD §35.3**: storm di eventi, mal-config, schema inatteso, timeout, reconnect, molti subscriber.

### 10.3 Determinismo

Per test riproducibili:

- **Tempo controllabile**: `Logger`, `IdGenerator`, `Clock` iniettabili (DI) — in test si usa un fake clock.
- **ID deterministici**: in modalità test, il `IdGenerator` genera ID sequenziali (`evt-001`, `evt-002`).
- **No shared global state**: ogni test crea un `Broker` isolato.
- **Worker fakeable**: il `WorkerBridge` è un'interfaccia, in test si usa un'implementazione sincrona in-process.

---

## 11. Pattern e Anti-Pattern

### 11.1 Pattern da seguire

#### Pattern: Canonical Data Model centralizzato

**Cosa.** Tutti i payload interni transitano canonicalizzati.

**Quando.** Sempre, in V1 (default PRD §13.5).

**Esempio:**
```ts
// Plugin emette { città: 'Roma', data: '30/04/2026' }
// Broker canonicalizza a { location: 'Roma', forecast_date: '2026-04-30' }
// Tutti i subscriber, route, cache, worker vedono la forma canonica
// Solo all'ultimo miglio si rimappa per il consumer
```

#### Pattern: Wire Tap per osservabilità

**Cosa.** Pipeline emette snapshot a ogni step a un Tap registrabile.

**Quando.** Sempre — anche se il Tooling è disattivato (l'interfaccia esiste con no-op).

#### Pattern: Strategy injection per policy

**Cosa.** Ogni policy (retry, dedupe, …) è un oggetto sostituibile.

**Esempio:**
```ts
broker.registerRoute({
  id: 'weather-http',
  on: 'weather.requested',
  type: 'http',
  policies: {
    retry: new ExponentialBackoffStrategy({ maxAttempts: 3, baseMs: 100 }),
    dedupe: new KeyBasedDedupeStrategy({ keyFrom: 'location' }),
    error: new Retry5xxOnlyPolicy(),
  }
});
```

#### Pattern: Adapter per ogni trasporto

**Cosa.** Mai chiamare `fetch` direttamente nel core. Solo via `HttpClient`.

#### Pattern: Auto-unsubscribe via lifecycle

**Cosa.** L'unregister di un plugin rimuove tutte le sue subscription, handler, route registrate.

**Implementazione:** il `LifecycleManager` tiene un grafo plugin → subscription/route/worker; su unregister rimuove a cascata.

### 11.2 Anti-pattern da evitare

#### Anti-pattern: Trasformazioni implicite

**Cosa.** Modificare il payload senza esporlo al debug layer (PRD §28.2 lo vieta).

**Perché male.** Rompe la promessa di "ogni evento osservabile". Bug invisibili.

**Invece.** Ogni trasformazione passa per il Mapper o un transform registrato; lo step è loggato.

#### Anti-pattern: Plugin che chiama `fetch` direttamente

**Cosa.** Un plugin bypassa il Broker per chiamare il server.

**Perché male.** Viola PRD §15.6 e §18.1. Perdita di centralizzazione, retry, auth, observability.

**Invece.** Il plugin pubblica `<topic>.requested` e il Broker via route HTTP fa la chiamata.

#### Anti-pattern: Mapping ambiguo automatico

**Cosa.** Affidarsi a "data" → "date" perché alias riconosciuto, senza dichiarazione esplicita.

**Perché male.** PRD §14.7 lo vieta — `data` può significare "dati". Bug semantici.

**Invece.** Mapping esplicito dichiarato dal plugin prevale (MAP-17). Alias solo come hint con warning.

#### Anti-pattern: Stato globale condiviso fra plugin

**Cosa.** Plugin che leggono/scrivono uno stato globale del broker.

**Perché male.** Ricrea l'accoppiamento che il broker dovrebbe eliminare.

**Invece.** Comunicazione solo via topic. Lo stato condiviso passa per cache route (esplicita).

#### Anti-pattern: Logger globale singleton

**Cosa.** `import { logger } from './logger'` ovunque.

**Perché male.** Difficile da mockare, dipendenze nascoste, no child logger nominalizzati.

**Invece.** Logger iniettato nel costruttore di ogni componente.

---

## 12. Considerazioni di scalabilità

| Concern | A 100 eventi/sec | A 10k eventi/sec | A 1M eventi/sec |
|---|---|---|---|
| Pipeline overhead | trascurabile | misurato (target <1ms p99) | richiede pooling, batching |
| Subscriber dispatch | foreach sync | Promise.allSettled | partizionamento per topic |
| Mapping cost | trascurabile (cacheable) | mapper compilato (no AST runtime) | mapper precompilato in worker |
| Cache lookup | Map in-memory | Map + LRU eviction | IndexedDB + memory L1 |
| Backlog topic | unbounded ok | bounded queue + drop oldest | partizionamento + paging |

Per V1 (PRD §34) niente target numerici rigidi. L'architettura comunque è preparata: pipeline a fasi pure, mapper cacheable, queue bounded con backpressure, tap disattivabile.

---

## 13. Sintesi per il Roadmap

### 13.1 Cosa il Roadmap deve garantire

Per ogni fase PRD §32 → fase GSD:

1. **F1 (Core)**: chiudere `BrokerEvent`, API publish/subscribe, plugin lifecycle, `EventTap` interface (anche no-op), `BrokerError`, `Logger`. Validazione step 3 (sintattica). **Pattern:** Mediator + Pipes-and-Filters skeleton + Wire Tap interface.

2. **F2 (Canonical/Mapper)**: `FieldMapDefinition`, `MappingEngine`, `Canonical Vocabulary`, transforms, derive, mapping inspector hook. Step 5/6/11/12 della pipeline operativi. **Pattern:** Canonical Data Model + Message Translator.

3. **F3 (Routing/HTTP)**: `RouteDefinition`, `RouteEngine`, `HttpClient`, policies (retry, timeout, dedupe, backpressure, error 4xx vs 5xx, auth). Step 7/8/9 operativi. Eventi `<topic>.failed`, `network.error`. **Pattern:** Strategy + Adapter.

4. **F4 (Realtime)**: `SseAdapter` (priorità 1), `WebSocketAdapter` (opzionale), `ReconnectPolicy`, server-side mapping. **Pattern:** Adapter (variante realtime).

5. **F5 (Worker)**: `WorkerRegistry`, `WorkerBridge`, route worker, task tracking, cancellation. **Pattern:** Adapter + Strategy (worker pool vs dedicated).

6. **F6 (Cache + Tooling)**: `CacheStore` (memory + opzionale IndexedDB), `EventInspector`, `RouteInspector`, `MetricsCollector`, debug snapshot. **Pattern:** Wire Tap completo.

### 13.2 Vincoli di ordinamento (hard)

```
F1 ──► F2 ──► F3 ──┬──► F4
                   └──► F5
                         │
                         ▼
                        F6 (richiede F1-F5)
```

- F1 → F2: il Mapper opera su `BrokerEvent`.
- F2 → F3: il Routing usa il Mapper per `queryMap`/`bodyMap`.
- F3 → F4 e F3 → F5 in parallelo (entrambi indipendenti tra loro).
- F6 dopo tutto perché tooling avanzato deve coprire tutta la pipeline.

### 13.3 Interfacce stabili da congelare prima

- **Prima di F1 chiusa**: `BrokerEvent`, `Logger`, `BrokerError`, `EventTap` (anche no-op).
- **Prima di F2 chiusa**: `FieldMapDefinition`, `CanonicalPayload`, `MappingEngine`.
- **Prima di F3 chiusa**: `RouteDefinition`, `RoutePolicies`, `HttpClient`, `RouteOutcome`.
- **Prima di F4/F5**: `RealtimeChannel`, `WorkerBridge`.
- **Prima di F6**: nessun freeze nuovo — F6 consuma interfacce già stabili.

---

## 14. Sources

### Riferimenti primari

- **PRD del progetto** (`/Users/omarmarzio/programming/prova AI/SemBridge/prd.md`)
  - §10 architettura logica
  - §11-22 specifiche di sottosistema
  - §28 pipeline ufficiale
  - §32 strategia di implementazione 6 fasi
  - §39 open issues da chiudere
- **PROJECT.md** (`.planning/PROJECT.md`) — vincoli, decisioni chiave, requirements

### Riferimenti architetturali (training data, HIGH confidence — pattern canonici)

- Hohpe, G. & Woolf, B. — *Enterprise Integration Patterns: Designing, Building, and Deploying Messaging Solutions* (2003). Pattern citati: *Message Bus*, *Canonical Data Model*, *Message Translator*, *Pipes and Filters*, *Channel Adapter*, *Wire Tap*, *Reliable Delivery*, *Dead Letter Channel*.
- Gamma, E. et al. — *Design Patterns: Elements of Reusable Object-Oriented Software* (1994). Pattern citati: *Mediator*, *Adapter*, *Strategy*, *Chain of Responsibility*, *Observer*.
- Young, G. — CQRS overview (2010, multiple sources). Applicato qui in forma "lite" (disciplina API).

### Pattern web/JS (training data + general industry knowledge — MEDIUM confidence)

- *Web Workers Specification* (W3C/WHATWG) — vincoli di serializzazione e absence of DOM nei worker.
- *Server-Sent Events (HTML Living Standard)* — modello inbound preferito per V1.
- *Fetch API* — base per `HttpClient` adapter.
- *IndexedDB API* — base per cache persistente opzionale.

**Confidenza per area:**
- Pattern architetturali → HIGH (canonici, applicabilità ovvia ai requisiti PRD).
- Module structure → HIGH (allineata 1:1 a PRD §10 + best practice TS).
- Build order → HIGH (PRD §32 esplicito, dipendenze logicamente chiare).
- Cross-cutting → HIGH (Wire Tap + DI sono soluzioni standard).
- Testability → MEDIUM (le interfacce qui proposte sono solide, ma il dettaglio di implementazione del PipelineHarness si chiarirà in F1).

---

*Documento prodotto in modalità Project Research per la dimensione Architecture. Output esclusivamente in italiano per le parti narrative; identificatori, nomi di pattern (CQRS, Mediator, Pipes-and-Filters, Adapter, Strategy, Wire Tap), e nomi di file in inglese come da vincolo linguistico.*
