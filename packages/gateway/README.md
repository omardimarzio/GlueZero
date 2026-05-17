# @gluezero/gateway

> Gateway centralizzato per GlueZero — Phase 3 (HTTP) + Phase 4 (Realtime SSE/WS).

> 🎉 **v2.0.0 GA (2026-05-17)** — Gateway attribution per-MF disponibile via `microFrontendModule()` opt-in (route calls per-MF tracked nel mfInspectorModule). Vedi [root README](../../README.md#microfrontend-governance-layer-v20-opt-in) · [docs/v2/](../../docs/v2/index.md) · [migration guide A/B/C](../../docs/v2/17-migration-guide.md).

ESM-only TypeScript library. Browser evergreen target (ES2022). Implementa due sub-moduli:

- **`/http`** (F3) — **Server Gateway HTTP** centralizzato (PRD §18) con policy uniformi: auth Bearer + token refresh single-flight, retry differenziato 4xx/5xx con full jitter, timeout via `AbortSignal.timeout()`, dedupe via Promise singleton, backpressure (queue/drop/throttle/debounce/latest-only/coalesce), idempotency token auto su POST/PATCH/PUT/DELETE, URL allowlist pre-fetch, circuit breaker per-route opt-in.
- **`/sse-ws`** (F4) — **Realtime inbound** (SSE prioritario, WebSocket opzionale): `RealtimeBroker` composition wrapper di `RouterBroker` (D-101), `RealtimeChannelManager` (registry N-canale D-102), `SseAdapter` + `WebSocketAdapter` con reconnection policy unificata (full jitter D-109 + auto-fallback SSE→WS D-107), Last-Event-ID injection (D-105 — chiude PRD §39 #9), envelope JSON `{topic, data, id?}` per WS (D-106), ping/pong applicativo D-111, visibility-aware behavior (D-110), cascade cleanup `disconnectByOwner` (D-112).

Cinque dipendenze runtime: [`@gluezero/core`](../core/README.md) (BrokerError + tipi base, F1), [`@gluezero/mapper`](../mapper/README.md) (response mapping server→canonical, F2), [`@gluezero/routing`](../routing/README.md) (consumer principale del gateway, F3), [`nanoid`](https://github.com/ai/nanoid) (Idempotency-Key generation), [`valibot`](https://valibot.dev) (config validation).

## Indice

1. [Stato](#stato)
2. [Subpath exports](#subpath-exports)
3. [Installazione](#installazione)
4. [Quick start — config gateway](#quick-start--config-gateway)
5. [Cosa contiene (`/http`)](#cosa-contiene-http)
6. [Vincolo D-83 — composition](#vincolo-d-83--composition)
7. [API pubblica](#api-pubblica)
8. [Policy chain order](#policy-chain-order)
9. [Retry policy (D-69 — chiusura PRD §39 #8 / ROUTE-09)](#retry-policy-d-69--chiusura-prd-39-8--route-09)
10. [Idempotency token (D-70 / SEC-03)](#idempotency-token-d-70--sec-03)
11. [Auth Bearer + single-flight refresh (D-72 / SEC-01 / SEC-02 / ROUTE-07)](#auth-bearer--single-flight-refresh-d-72--sec-01--sec-02--route-07)
12. [URL allowlist (D-71 / SEC-05)](#url-allowlist-d-71--sec-05)
13. [Circuit breaker (D-99 — opt-in)](#circuit-breaker-d-99--opt-in)
14. [Errori standard](#errori-standard)
15. [Realtime SSE/WS (Phase 4)](#realtime-ssews-phase-4)
16. [Roadmap (deferred F5-F6)](#roadmap-deferred-f5-f6)
17. [Licenza](#licenza)

## Stato

Phase 3 **complete** sub-modulo HTTP (`/http`) + **Phase 4 complete** sub-modulo realtime (`/sse-ws`). Phase 5 (Worker Runtime) e Phase 6 (Cache + Tooling) deferred.

REQ-ID coperti F3 dal sub-modulo HTTP: SEC-01..SEC-05, ROUTE-06, ROUTE-07, ROUTE-09, ROUTE-13, ROUTE-08 (timeout/retry/dedupe/auth), VAL-05, ERR-02 ext (`network.error`).

## Subpath exports

Il package è organizzato in subpath per separare le capability F3 (HTTP) da F4 (realtime). Il consumer importa il sub-modulo necessario:

```ts
import { createHttpGateway, HttpGateway } from '@gluezero/gateway/http'
import {
  createRetryStrategy,
  createTimeoutStrategy,
  createDedupeStrategy,
  createBackpressureStrategy,
  createAuthStrategy,
  createIdempotencyStrategy,
  createCircuitBreakerStrategy,
} from '@gluezero/gateway/http'

// import { createSseAdapter } from '@gluezero/gateway/sse-ws'  // Phase 4
```

Il subpath `./http` ha bundle budget separato (8 KB gzip) rispetto al package umbrella, garantendo che chi non usa SSE/WS non paghi il costo di F4. Vedi `package.json` `exports`.

## Installazione

```sh
pnpm add @gluezero/core @gluezero/mapper @gluezero/routing @gluezero/gateway
```

Il package si installa insieme agli altri tre — è il consumer principale di `@gluezero/routing` per le route HTTP.

## Quick start — config gateway

```ts
import { createHttpGateway } from '@gluezero/gateway/http'
import {
  createRetryStrategy,
  createTimeoutStrategy,
  createIdempotencyStrategy,
  createAuthStrategy,
  createDedupeStrategy,
  createBackpressureStrategy,
  createCircuitBreakerStrategy,
} from '@gluezero/gateway/http'

const gateway = createHttpGateway({
  // SEC-05 (D-71): URL allowlist (string prefix o RegExp)
  allowlist: [
    'https://api.example.com',
    /^https:\/\/cdn-[a-z]+\.example\.com\//,
  ],
  // SEC-01/SEC-02 (D-72): auth Bearer + single-flight refresh
  auth: {
    getToken: async () => storage.get('jwt') ?? undefined,
    refresh: async () => fetch('/auth/refresh').then((r) => r.text()),
    tokenCacheMs: 30_000, // cache opzionale del token
  },
  // Default policy applicate a tutte le route HTTP (override per-route via RoutePolicies)
  defaults: {
    timeout: 5000,
    retry: { maxAttempts: 3, baseDelayMs: 300, maxDelayMs: 10_000 },
    idempotency: { mode: 'auto', headerName: 'Idempotency-Key' },
  },
  // D-99: circuit breaker per-route — DISABLED di default (opt-in)
  circuitBreaker: { threshold: 5, cooldownMs: 30_000 },
})

// Inietta le strategy a `gateway.execute()` (di norma fatto dal RouterBroker plan 03-12)
const strategies = {
  retry: createRetryStrategy({ maxAttempts: 3 }),
  timeout: createTimeoutStrategy(),
  dedupe: createDedupeStrategy({ keyFrom: ['location', 'date'] }),
  backpressure: createBackpressureStrategy({ type: 'latest-only' }),
  auth: createAuthStrategy({ config: gateway.config.auth }),
  idempotency: createIdempotencyStrategy(),
  circuitBreaker: createCircuitBreakerStrategy({ threshold: 5, cooldownMs: 30_000 }),
}

const response = await gateway.execute(httpRequest, route, event, externalSignal, strategies)
if (response.ok) console.log(response.body)
```

In produzione, `createRouterBroker` di `@gluezero/routing` istanzia il gateway internamente — il consumer tipico passa solo `gateway: GatewayConfig` al `createRouterBroker(config)` e non istanzia direttamente `HttpGateway`.

## Cosa contiene (`/http`)

- **`HttpGateway`** — entry centralizzato che applica la **policy chain** di middleware uniforme a tutte le richieste fetch generate dalle route HTTP. Garantisce: 0 fetch dirette dai plugin (ROUTE-06), policy uniformi cross-route (DRY), centralizzazione auth/security (SEC-01..SEC-05).
- **`createHttpGateway(config)`** — factory pure function (no singleton, D-30) con Valibot config validation.
- **7 Strategy primitives** (Strategy Pattern, D-68):
  - `RetryStrategy` (default `ExponentialBackoffWithJitter` — D-69 / ROUTE-09; chiusura PRD §39 #8)
  - `TimeoutStrategy` (default `FixedTimeout` 30 000 ms via `AbortSignal.timeout`)
  - `DedupeStrategy` (default `KeyBased` Promise singleton; chiave da `dedupeKey` o `routeId+queryParams` — D-74)
  - `BackpressureStrategy` (default `LatestOnly`; queue/drop/throttle/debounce/coalesce supportati — D-75)
  - `AuthStrategy` (default `BearerHook` + single-flight `refresh` su 401 — D-72)
  - `IdempotencyStrategy` (auto `Idempotency-Key` su POST/PATCH/PUT/DELETE riusato sui retry — D-70 / SEC-03)
  - `CircuitBreakerStrategy` (per-route fail counter + cooldown, opt-in DISABLED — D-99)
- **URL allowlist** (D-71 / SEC-05) — guard pre-fetch + post-redirect re-validation (Pitfall 7) che blocca URL non in `gateway.allowlist`.
- **Retry-After parser** — gestione header `Retry-After` (delta-seconds e HTTP-date), cap a 60 s.
- **`combineSignals(...)`** — utility per combinare N `AbortSignal` in uno (D-77 — esterno + own + timeout).
- **AbortController in-flight tracking** — `inFlight: Map<eventId, { controller, ownerId, routeId }>` per `abortInFlight(eventId)` puntuale e `abortInFlightByOwner(ownerId)` cascade (LIFE-02 ext F3).

## Vincolo D-83 — composition

Zero modifiche a `packages/core/` runtime e `packages/mapper/` runtime. Estensione tramite **composition** (`HttpGateway` chiamato dal `RouteExecutor` di `@gluezero/routing`) + TS declaration merging (`src/augment.ts` — `BrokerConfig.gateway`).

## API pubblica

### `createHttpGateway(config?: GatewayConfig): HttpGateway`

Factory pure function (D-30 no singleton). Valida `config` via Valibot e ritorna una nuova istanza `HttpGateway`. Su config non valido, throw `Error('Invalid GatewayConfig: ...')`.

### `class HttpGateway`

| Metodo | Descrizione |
|--------|-------------|
| `execute(request, route, event, externalSignal, strategies)` | Esegue la fetch attraverso la policy chain; ritorna `HttpResponseSpec` (NON throw su 4xx/5xx — il caller decide). |
| `abortInFlight(eventId, reason?)` | Abort puntuale di una request in volo. |
| `abortInFlightByOwner(ownerId, reason?)` | Cascade abort di tutte le request bound al ownerId (LIFE-02 ext F3, D-86). |
| `inFlightCount()` | Numero di request in volo (debug helper). |

### Strategy factories

| Factory | Descrizione |
|---------|-------------|
| `createRetryStrategy(options?)` | `ExponentialBackoffWithJitter` (D-69) |
| `createTimeoutStrategy(options?)` | `FixedTimeout` via `AbortSignal.timeout()` |
| `createDedupeStrategy(options?)` | `KeyBasedDedupe` Promise singleton (D-74) |
| `createBackpressureStrategy(options?)` | 6 policy + critical bypass Pitfall 4 (D-75) |
| `createAuthStrategy(options)` | `BearerHook` + single-flight `refresh` (D-72) |
| `createIdempotencyStrategy(options?)` | Auto `Idempotency-Key` via nanoid (D-70) |
| `createCircuitBreakerStrategy(options?)` | Per-route fail counter (D-99 opt-in DISABLED default) |

### Tipi pubblici

| Tipo | Descrizione |
|------|-------------|
| `GatewayConfig` | `{ auth?, allowlist?, defaults?, circuitBreaker? }` |
| `AuthStrategyConfig` | `{ getToken, refresh?, tokenCacheMs? }` |
| `CircuitBreakerConfig` | `{ threshold, cooldownMs, halfOpenMaxRequests? }` |
| `HttpRequestSpec` | `{ method, url, headers?, body? }` |
| `HttpResponseSpec` | `{ ok, status, headers, body }` |
| `RetryStrategy` / `TimeoutStrategy` / `DedupeStrategy` / `BackpressureStrategy` / `AuthStrategy` / `IdempotencyStrategy` / `CircuitBreakerStrategy` | Interfacce pluggable |
| `HttpGatewayStrategies` | Bundle iniettato a `execute()` |
| `GatewayErrorCode` | Literal union dei 9 codici errore F3 (`gateway.timeout`/`gateway.4xx`/`gateway.5xx`/`gateway.network`/`gateway.url.forbidden`/`gateway.aborted`/`response.validation.failed`/`auth.refresh.unavailable`/`circuit.open`) |

## Policy chain order

L'`HttpGateway.execute()` applica le policy in ordine deterministico:

```
allowlist (pre-fetch validation)
  → auth (Bearer header injection via getToken)
  → idempotency (Idempotency-Key generation per POST/PATCH/PUT/DELETE)
  → combine signals (external + own + timeout)
  → circuit breaker check (skip fetch se open)
  → retry loop:
      → fetch (con redirect: 'manual')
      → post-redirect Location re-validation (Pitfall 7)
      → shouldRetry(response, error, attempt)
      → delayMs(attempt, Retry-After header)
  → parseResponse (JSON, fallback null)
  → record success/failure (circuit breaker)
  → cleanup inFlight Map (finally)
```

Le strategy `dedupe`/`backpressure` (V1 in isolation) sono dichiarate ma il wiring nel flow `execute()` è **deferred F4** — vedi 03-13-SUMMARY per il dettaglio.

## Retry policy (D-69 — chiusura PRD §39 #8 / ROUTE-09)

| Caso | Comportamento |
|------|---------------|
| Network error (fetch throw senza response) | **RETRY** |
| 5xx (500-599) | **RETRY**, rispetta `Retry-After` se presente |
| 408 Request Timeout | **RETRY** |
| 429 Too Many Requests | **RETRY**, rispetta `Retry-After` |
| Altre 4xx (400, 401, 403, 404, 422, ...) | **NO RETRY** (errore client che retry non risolve) |

`maxAttempts: 3` di default; `maxAttempts: 0` disabilita; `maxAttempts: Infinity` consentito ma sconsigliato.

Backoff full jitter (formula esatta da AWS Architecture Blog, PITFALLS #5):

```
delay = min(maxDelay, baseDelay * 2^attempt) * (0.5 + Math.random() * 0.5)
```

Cap a `MAX_BACKOFF_MS = 60_000` ms anche con `Retry-After` esplicito (protezione DoS auto-inflitto). Default `baseDelayMs: 300`, `maxDelayMs: 10_000`. Override esplicito degli status retriabili via `retryOnStatuses: [503]`.

## Idempotency token (D-70 / SEC-03)

Per metodi `POST`/`PATCH`/`PUT`/`DELETE`, default `idempotency: { mode: 'auto', headerName: 'Idempotency-Key' }` — auto-genera `nanoid()` (21 char, 126 bit entropy) al first attempt; lo stesso valore viene **riusato sui retry** (chiave: `BrokerEvent.id` originario di scatenamento). Il server è responsabile di deduplicare per la chiave (precondizione documentata).

LRU bounded `maxEventsTracked: 1000` (T-03-09-03 DoS mitigation). Opt-out: `idempotency: false` esplicito su route per metodi safe-by-design.

## Auth Bearer + single-flight refresh (D-72 / SEC-01 / SEC-02 / ROUTE-07)

`gateway.auth.getToken: () => Promise<string | undefined>` viene chiamato prima di ogni fetch (con caching opzionale via `tokenCacheMs`). Su 401 response, opzionalmente `gateway.auth.refresh: () => Promise<string>` viene chiamato **una sola volta in concurrent** (single-flight Promise singleton — Pattern 5 RESEARCH, Pitfall 5 fix).

Use case canonico: 5 fetch parallele → 5 risposte 401 → 5 chiamate `auth.refresh()` in parallelo → SOLO 1 invocazione effettiva di `config.refresh`, tutti i caller coordinano sulla stessa Promise.

Se `config.refresh` è `undefined`, il method `refresh()` throw `BrokerError 'auth.refresh.unavailable'` (`category: 'config'` — non `'auth'`, l'union non lo include e D-83 vieta modifica core).

## URL allowlist (D-71 / SEC-05)

`gateway.allowlist: ReadonlyArray<string | RegExp>` — endpoint base consentiti (string prefix match o RegExp test). Tentativo di fetch verso URL non in allowlist → throw `BrokerError 'gateway.url.forbidden'` (`category: 'config'`) **PRIMA della fetch** (zero network call).

**Post-redirect re-validation (Pitfall 7):** ogni response 3xx con `Location` header viene re-validata contro l'allowlist. Default `redirect: 'manual'` per fetch — il refetch manuale preserva headers (`Idempotency-Key` + `Authorization`).

Default `allowlist: undefined` → tutti gli URL consentiti (dev convenience).

## Circuit breaker (D-99 — opt-in)

Per-route fail counter state machine `closed → open → half-open → closed`:

- Dopo N fail consecutivi (default `threshold: 5`) → route in stato `open` per `cooldownMs: 30_000` ms.
- In stato `open`, ogni request → fail-fast publish `<topic>.failed` con `code: 'circuit.open'`, NO fetch.
- Dopo cooldown → stato `half-open` → 1 request di prova → success → `closed`, fail → `open` di nuovo.

**Default `circuitBreaker: false` (DISABILITATO)** per V1; opt-in via `gateway.circuitBreaker: { threshold, cooldownMs }`. Sliding window stats → V1.x.

Per-route state isolation: `Map<routeId, CircuitState>`. Lazy transition `open → half-open` al `canExecute`/`getState` (no setTimeout overhead per route inattive).

## Errori standard

I codici errore `GatewayErrorCode` esposti:

| Code | `category` | Quando |
|------|-----------|--------|
| `gateway.timeout` | `network` | fetch supera `timeout` |
| `gateway.4xx` | `network` | status 400-499 (escluso 408/429 che hanno proprio code) |
| `gateway.5xx` | `network` | status 500-599 dopo retry exhausted |
| `gateway.network` | `network` | fetch throw senza response (offline, CORS, DNS) |
| `gateway.aborted` | `network` | abort esplicito (NON timeout) |
| `gateway.url.forbidden` | `config` | URL non in allowlist (SEC-05) |
| `response.validation.failed` | `validation` | Valibot fail su response canonical schema (VAL-05 — wiring V1 deferred F4/F6) |
| `auth.refresh.unavailable` | `config` | `config.refresh` undefined ma method invocato |
| `circuit.open` | `network` | circuit breaker open per route (D-99 opt-in) |

Oltre a `<topic>.failed`, il gateway publica `network.error` come BrokerEvent CORE separato per consumer sistemici (telemetria, banner offline UI). Pattern: `category: 'network'` → secondario `network.error` (D-81).

## Realtime SSE/WS (Phase 4)

Il sub-modulo `/sse-ws` estende il gateway con un **canale realtime inbound** dal server. SSE è l'adapter prioritario V1 (più semplice e robusto per server → browser, PRD §18.4); WebSocket è disponibile come adapter alternativo.

L'API consumer-facing è il `RealtimeBroker` — composition wrapper di `RouterBroker` (D-101 + vincolo D-83 strict) — che espone `connectRealtime(def, ownerId?)` e `disconnectRealtime(name?)` accanto a tutta la surface F1+F2+F3 (publish/subscribe/registerPlugin/registerRoute/registerCanonicalSchema, eccetera).

### Quick start

```ts
import { createRealtimeBroker } from '@gluezero/gateway/sse-ws'

const broker = createRealtimeBroker({
  // Tutta la config F3 (RouterBroker) è valida + sezione realtime opzionale
  routes: [/* ... */],
  gateway: { /* ... */ },
  canonicalModel: { schemas: [/* ... */] },
  realtime: {
    defaults: { reconnect: { baseMs: 1_000, capMs: 30_000 } },
  },
})

// Subscriber locale al topic canonico (NO conoscenza del trasporto SSE/WS)
broker.subscribe('weather.update', (event) => {
  console.log(event.payload, event.source) // source.name === 'sse'
})

// Apri canale SSE inbound (mode default 'auto' → SSE-first con fallback WS)
broker.connectRealtime({
  name: 'weather-stream',
  buildUrl: () => 'https://api.example.com/events/weather',
  // mode: 'auto', // default
  // eventTypes: ['weather.update'],  // SSE custom event types (W-4 SC-1)
})

// Cleanup: chiude tutti i canali, libera resources, teardown VisibilityDetector
broker.disconnectRealtime()
```

### Auth patterns (D-104 / D-105)

EventSource standard NON supporta header custom (vincolo PRD §31.3). Quattro strategie auth supportate, tutte agnostiche all'adapter:

| Strategia | Quando usarla | Pattern |
|-----------|---------------|---------|
| Cookie HttpOnly **same-origin** | Default raccomandato | Browser invia cookie automaticamente. Nessuna config app-side. |
| Cookie HttpOnly **cross-origin** | API su dominio dedicato | `withCredentials: true` opt-in nel `def.eventSourceInit?.withCredentials` per SSE. |
| Token in **query string** | Quando il server non supporta cookie | `buildUrl: () => \`/events?token=${shortLivedJwt}\`` — best practice: ≤5 min, single-use, server invalida al disconnect. |
| WebSocket **subprotocol** | WS only, server custom handshake | `def.wsSubprotocols: ['gluezero-v1', token]` (Q4 closure). |

**Best practice security:** token in URL ≤5 min, single-use server-side. Cookie HttpOnly è la scelta preferita quando l'origin è controllato.

### Frame envelope contract (D-106)

I messaggi WebSocket inbound rispettano l'envelope JSON `{ topic: string, data: unknown, id?: string }`:

```json
{ "topic": "weather.update", "data": { "city": "Roma", "temp": 22 }, "id": "evt-123" }
```

Per SSE l'envelope è il payload `data:` deserializzato da JSON; il `topic` deriva dal field `event:` SSE (o fallback `def.name`).

**Invariante anti-AP-6** (PITFALL §11.7 — Q1 closure): `isInternalTopic` strict equality match (NO prefix). Topic legittimi consumer come `weather.__ping__` NON vengono filtrati come internal — solo `__ping__`/`__pong__` esatti sono riservati al protocollo (D-111).

**Frame parse error → `network.error`** (Q2 closure): un envelope malformato (JSON invalido, topic mancante, struttura non-object) viene pubblicato come `BrokerEvent { topic: 'network.error', payload: { category: 'protocol', code: 'realtime.frame.malformed', channel, reason, raw } }` — riusa ERR-02 ext F3, NIENTE nuovo evento `realtime.protocol.error`. La category 'protocol' viaggia nel **payload** (NON in `BrokerError.category` — l'union F1 NON include `'protocol'` e D-83 vieta modifica core).

### SSE custom event types (W-4 SC-1 closure)

Il field SSE `event:` permette al server di emettere eventi nominati (PRD §29 scenario meteo SC-1). L'adapter supporta topic dinamici via `def.eventTypes`:

```ts
broker.connectRealtime({
  name: 'weather',
  buildUrl: () => '/events',
  eventTypes: ['weather.update', 'weather.alert'],  // listener per ogni event type
})
```

Server emette:
```
event: weather.update
data: {"city":"Roma","temp":22}

event: weather.alert
data: {"severity":"high"}
```

→ Subscriber riceve `BrokerEvent` con `topic === 'weather.update'` (NON `def.name`) — il `topic` deriva dal field `event:` SSE.

Default fallback: `eventTypes: ['message']` con `topic = def.name` se omesso.

### SSE heartbeat hook (B-5 + Q5 closure)

Il server può inviare heartbeat per mantenere la freshness senza spam topic:

```ts
broker.connectRealtime({
  name: 'orders',
  buildUrl: () => '/events/orders',
  sseHeartbeatEventTypes: ['heartbeat'],  // default
})
```

Server invia ogni ≤60s:
```
event: heartbeat
data:

```

→ L'adapter aggiorna `lastEventReceivedAt = Date.now()` SENZA pubblicare `BrokerEvent`. `staleTimeoutMs` uniforme con WS = `60_000` (Q5 closure).

### Reconnect contract (RT-05 + D-109 + RT-07 — chiude PRD §39 #9)

**Full jitter** (RESEARCH §3.2 / D-109):

```
delay = min(capMs, baseMs * 2^attempt) * (0.5 + Math.random() * 0.5)
```

Default: `baseMs: 1_000`, `capMs: 30_000`, `maxAttempts: Infinity` (mai dare up — il consumer chiama `disconnectRealtime` per fermare).

**Last-Event-ID injection per SSE** (D-105 — chiude PRD §39 #9 / RT-07):

L'adapter memorizza `event.lastEventId` su ogni messaggio e lo inietta come **query string** `?lastEventId=` al re-connect (NO header custom — vincolo EventSource standard):

```ts
// Server middleware example (Express)
app.get('/events', (req, res) => {
  const lastEventId = req.query.lastEventId ?? req.headers['last-event-id']
  // ...replay events da lastEventId in poi
})
```

**Eventi standard `system.realtime.*`** (ERR-02 ext F4):

| Evento | Quando | Payload |
|--------|--------|---------|
| `system.realtime.connected` | Connessione stabilita | `{ channel, mode, attempt }` |
| `system.realtime.disconnected` | Connessione persa | `{ channel, reason, code? }` |
| `system.realtime.reconnecting` | Tentativo retry in corso | `{ channel, attempt, delayMs }` |
| `system.realtime.failed` | Cycle-cap superato | `{ channel, reason: 'cycle-cap-exceeded' }` |

**Consolidation anti-flap** (Q3 closure): reconnect events ravvicinati (entro `consolidationMs: 5_000` default) NON triggherano nuovo cycle del strategy — `attempt` resta invariato. Pattern coerente con D-109.

### Ping/pong contract WebSocket (D-111)

Heartbeat applicativo (NON i frame ping/pong WebSocket nativi che il browser non espone):

- Client invia `{topic:'__ping__',data:{ts}}` ogni 30s (default `heartbeatIntervalMs`)
- Server risponde con `{topic:'__pong__'}` → adapter `lastPongAt = Date.now()`
- Stale watchdog: se `Date.now() - lastPongAt > staleTimeoutMs` (default `60_000`, **uniforme con SSE Q5**) → close + recordFailure

**Strict-match anti-AP-6** (Q1 closure): solo `__ping__`/`__pong__` esatti sono filtrati. `weather.__ping__` (raro ma legittimo) passa through al subscriber. Verifica grep runtime: `grep -c "startsWith('__')"` ritorna 0 nei file `sse-ws/*.ts`.

**bufferedAmount cap 64 KB** (RESEARCH §4.4): se `ws.bufferedAmount > 64_000` il ping è skipped — il TCP send buffer è saturo (tab background, network slow), inviare ulteriori frame aggraverebbe la pressione memoria.

### Auto-fallback SSE→WS (D-107 + D-108 + B-4 closure)

Mode `'auto'` (default) attiva auto-fallback SSE→WS dopo `fallbackThreshold: 3` fail consecutivi (default), con cap `globalCycleCap: 5` cicli totali. Il `runReconnectLoop` privato del `RealtimeChannelManager` orchestra il rebind effettivo:

| Scheme input | Mode iniziale | Su fail → fallback |
|--------------|---------------|---------------------|
| `https://api.example.com/events` | `sse` | `wss://api.example.com/events` (scheme switch automatico via `URL` API) |
| `http://api.example.com/events` | `sse` | `ws://api.example.com/events` |

**D-108 caveat — path differenti (V1 caveat documentato):**

SSE e WS NON sono necessariamente sullo stesso URL/path. In V1 il consumer ha due opzioni:

1. **Endpoint unificato** che gestisce upgrade (server distingue `Accept: text/event-stream` vs `Upgrade: websocket`):
   ```ts
   buildUrl: () => 'https://api.example.com/events'  // gestisce SSE + WS
   ```
2. **Endpoint separati** — l'API V1 NON supporta out-of-the-box il rebind a un path diverso. Workaround: il consumer disabilita auto-fallback (`mode: 'sse'` strict) e gestisce manualmente il fallback al `system.realtime.failed` reconnettendo a un canale diverso. Endpoint separati out-of-the-box → V1.x backlog.

**B-4 closure** — il rebind effettivo è verificato in `__integration__/auto-fallback.test.ts` Test 1: `FailingMockEventSource` constructor throw → forza `manager.connect → catch → runReconnectLoop` → dopo `fallbackThreshold:1` rebind a `MockWebSocket` (Test verifica `MockWebSocket.instances.length >= 1` e `entry.mode === 'websocket'`).

### Visibility-aware behavior (D-110)

Tab in background subisce throttling browser su `setTimeout`/`setInterval`. L'adapter integra `Visibility API` via `VisibilityDetector` lazy-init (singleton al primo connect, teardown all'ultimo disconnect):

- Su `visibilitychange → visible`: `manager.checkFreshnessAll()` forza un check di freschezza prima di considerare le connessioni vive.
- Su `visibilitychange → hidden`: tolleranza ×3 sui timeout heartbeat per evitare reconnect aggressivi quando la tab è in background.
- **Mobile caveat**: iOS Safari sospende totalmente i timer su tab inattivi — al `visible` si aspetta il prossimo heartbeat invece di assumere stale.

### Cascade cleanup (D-112 + LIFE-02 ext F4)

Lifecycle ownerId-based — `unregisterPlugin(pluginId)` propaga il cleanup ai canali realtime registrati dal plugin:

```ts
broker.registerPlugin({
  id: 'weather-widget',
  realtimeChannels: [
    { name: 'weather-stream', buildUrl: () => '/events/weather' },
  ],
  // ...
})

// Più tardi:
broker.unregisterPlugin('weather-widget')
// → manager.disconnectByOwner('weather-widget', 'plugin.unregistered')
// → chiude TUTTI i canali con ownerId = 'weather-widget' (NON quelli di altri plugin)
// → teardown VisibilityDetector se nessun canale resta
```

Pattern coerente con `HttpGateway.abortInFlightByOwner` di F3 (D-86). Verificato in `__integration__/cascade-cleanup.test.ts`.

### Backpressure adapter-level (D-115)

Riuso 1:1 della `BackpressureStrategy` di F3 — default `queue-bounded` con `maxSize: 1000` (T-04-09-04 mitigation, anti-DoS auto-inflitto). Eventi `priority: 'critical'` (es. `system.realtime.failed`, `system.error`) bypassano la queue (Pitfall 4 fix F3 portato in F4 invariato).

### Mapper + validation invariati (D-114 + D-116 — W-2 closure)

Gli adapter SSE/WS pubblicano i frame ricevuti via `inner.publish(topic, payload, options)` del `RouterBroker` interno. La pipeline §28 step 4 (canonical mapping) e step 5/6 (canonical validation + final mapping) si applicano automaticamente — **NIENTE logica F4 specifica**.

**Esempio scenario meteo:**

```ts
// Server invia (frame SSE):
// event: weather.update
// data: {"city":"Roma","temp":22,"condition":"sunny"}

// CanonicalSchema F2 + RouterEngine F3 inputMap registrato:
broker.registerCanonicalSchema({
  id: 'weather.update@1',
  fields: [
    { name: 'location', type: 'string', required: true },
    { name: 'temperature_celsius', type: 'number' },
    { name: 'weather_condition', type: 'string' },
  ],
})

broker.registerPlugin({
  id: 'widget',
  inputMap: {
    'weather.update': {
      location: 'city',
      temperature_celsius: 'temp',
      weather_condition: 'condition',
    },
  },
  // ...
})

// Subscriber riceve { location: 'Roma', temperature_celsius: 22, weather_condition: 'sunny' }
broker.subscribe('weather.update', (event) => {
  console.log(event.payload.location)  // 'Roma'
  console.log(event.source.name)       // 'sse' (D-113)
})
```

**Verificato in `__integration__/mapper-canonicalization.test.ts`** (W-2 closure).

### Test contract D-118 3-tier (B-1 closure)

Strategia testing 3-livelli:

| Tier | Environment | Cosa testa | Comando |
|------|-------------|------------|---------|
| **Tier-1 jsdom** | `vitest run` (default) | Unit + integration con `MockEventSource`/`MockWebSocket` DI | `pnpm --filter @gluezero/gateway test` |
| **Tier-2 MSW V1.x** | jsdom + msw 2.x | Server contract: SSE replay (riconosce header `Last-Event-ID` E query `?lastEventId=`), ws.link compat | `pnpm test:msw` (deferred V1.x — `describe.skip`) |
| **Tier-3 Playwright Chromium** | Real browser headless | Smoke `EventSource` API non-mocked, real-browser semantics | `pnpm test:browser` (opt-in) |

**Q6 closure**: V1 è **Chromium-only** (CI smoke). Firefox/Safari deferred a release pre-V1 (smoke manuale). `vitest.config.ts` esclude `**/__browser__/**` dal Tier-1 jsdom run (W-NEW-3 fix).

### Limitazioni V1 documentate

| Limitazione | Workaround V1 / Roadmap |
|-------------|--------------------------|
| EventSource non supporta header custom | `buildUrl` con query string token (D-105) |
| Gap recovery oltre Last-Event-ID | Server è responsabile del replay; client invia il last id e rispetta la finestra |
| Frame binary (Blob/ArrayBuffer) | V1 supporta solo testo JSON (D-106) — frame binary deferred V2 |
| WS outbound `broker.publish → server` | V1 inbound-only — outbound via HTTP route F3. WS bidirezionale → V1.x |
| Multiplex N topic su 1 connessione | V1 default è 1 canale = 1 connessione (D-102, anti-AP-11). Multiplex opt-in V1.x |
| Browser test cross-engine | V1 Chromium-only; FF/WK smoke manuale pre-release (Q6) |

### Open questions risolte (rationale + reference)

| Q | Question | Decision | Where |
|---|----------|----------|-------|
| Q1 | Topic prefix interno vs strict-match | **Strict equality** `__ping__`/`__pong__` esatti (NO prefix `__`) | D-111, anti-AP-6 PITFALL §11.7 |
| Q2 | Frame parse error → nuovo event vs riuso ERR-02 | **Riuso `network.error` con `category: 'protocol'` nel payload** (l'union F1 non include 'protocol'; D-83 vieta modifica core) | D-106, ERR-02 ext F3 |
| Q3 | Reset `attempt=0` post-success vs guard | `consolidationMs: 5_000` default — reconnect ravvicinati NON triggherano nuovo cycle | D-109, anti-flap |
| Q4 | WS subprotocols opt-in vs hardcoded | **Opt-in `wsSubprotocols`** (additivo, non breaking) | D-111 |
| Q5 | SSE staleTimeoutMs uniforme con WS | **60s uniforme** + `sseHeartbeatEventTypes` hook silent (default `['heartbeat']`) | B-5 closure |
| Q6 | Browser test cross-engine V1 | **Chromium-only CI**, smoke FF/WK manuale pre-release | D-118 Tier-3 |

Vedi [`DECISIONS.md`](../../DECISIONS.md) (D-104..D-120) per il rationale completo delle decisioni F4 realtime.

## Roadmap (deferred F5-F6)

- **Phase 5 — Worker Runtime** (`@gluezero/worker`): Worker registry + WorkerBridge + structuredClone default (chiude PRD §39 #11 / WK-07).
- **Phase 6 — wiring `DedupeStrategy`/`BackpressureStrategy`** nel `gateway.execute()` flow (V1 verificate in isolation, deferred wiring middleware automatico).
- **V1.x — circuit breaker avanzato** sliding window stats + success rate + fallback URL.
- **V1.x — custom serializer/parser** (form-data/multipart/binary, response non-JSON).
- **V1.x — realtime path differenti SSE vs WS** (D-108 caveat) — V1 richiede endpoint unificato o disable auto-fallback.
- **V1.x — multiplex N topic su 1 connessione realtime** (D-102 ext, anti-AP-11 baseline V1).
- **V1.x — WebSocket outbound** (`broker.publish → server` via WS bidirezionale).
- **V1.x — browser test cross-engine** (Firefox + Safari oltre Chromium V1).
- **V2 — adapter Zod/Ajv** per response validation (V1 solo Valibot, riusa F2 ValidatorAdapter).
- **V2 — frame binary realtime** (Blob/ArrayBuffer su WS, binary SSE non standard).

## Licenza

MIT.
