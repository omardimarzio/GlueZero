# @sembridge/gateway

> HTTP Gateway centralizzato per SemBridge — Phase 3 (HTTP). Phase 4 estende con SSE/WebSocket.

ESM-only TypeScript library. Browser evergreen target (ES2022). Implementa il **Server Gateway HTTP centralizzato** (PRD §18) con policy uniformi: auth Bearer + token refresh single-flight, retry differenziato 4xx/5xx con full jitter, timeout via `AbortSignal.timeout()`, dedupe via Promise singleton, backpressure (queue/drop/throttle/debounce/latest-only/coalesce), idempotency token auto su POST/PATCH/PUT/DELETE, URL allowlist pre-fetch, circuit breaker per-route opt-in.

Quattro dipendenze runtime: [`@sembridge/core`](../core/README.md) (BrokerError + tipi base, F1), [`@sembridge/mapper`](../mapper/README.md) (response mapping server→canonical, F2), [`@sembridge/routing`](../routing/README.md) (consumer principale del gateway, F3), [`nanoid`](https://github.com/ai/nanoid) (Idempotency-Key generation), [`valibot`](https://valibot.dev) (config validation).

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
15. [Roadmap (deferred F4-F6)](#roadmap-deferred-f4-f6)
16. [Licenza](#licenza)

## Stato

Phase 3 **complete** sub-modulo HTTP (`/http`). Phase 4 (sub-modulo `/sse-ws` per realtime inbound) successiva, già riservato come placeholder nel `package.json` exports.

REQ-ID coperti F3 dal sub-modulo HTTP: SEC-01..SEC-05, ROUTE-06, ROUTE-07, ROUTE-09, ROUTE-13, ROUTE-08 (timeout/retry/dedupe/auth), VAL-05, ERR-02 ext (`network.error`).

## Subpath exports

Il package è organizzato in subpath per separare le capability F3 (HTTP) da F4 (realtime). Il consumer importa il sub-modulo necessario:

```ts
import { createHttpGateway, HttpGateway } from '@sembridge/gateway/http'
import {
  createRetryStrategy,
  createTimeoutStrategy,
  createDedupeStrategy,
  createBackpressureStrategy,
  createAuthStrategy,
  createIdempotencyStrategy,
  createCircuitBreakerStrategy,
} from '@sembridge/gateway/http'

// import { createSseAdapter } from '@sembridge/gateway/sse-ws'  // Phase 4
```

Il subpath `./http` ha bundle budget separato (8 KB gzip) rispetto al package umbrella, garantendo che chi non usa SSE/WS non paghi il costo di F4. Vedi `package.json` `exports`.

## Installazione

```sh
pnpm add @sembridge/core @sembridge/mapper @sembridge/routing @sembridge/gateway
```

Il package si installa insieme agli altri tre — è il consumer principale di `@sembridge/routing` per le route HTTP.

## Quick start — config gateway

```ts
import { createHttpGateway } from '@sembridge/gateway/http'
import {
  createRetryStrategy,
  createTimeoutStrategy,
  createIdempotencyStrategy,
  createAuthStrategy,
  createDedupeStrategy,
  createBackpressureStrategy,
  createCircuitBreakerStrategy,
} from '@sembridge/gateway/http'

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

In produzione, `createRouterBroker` di `@sembridge/routing` istanzia il gateway internamente — il consumer tipico passa solo `gateway: GatewayConfig` al `createRouterBroker(config)` e non istanzia direttamente `HttpGateway`.

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

Zero modifiche a `packages/core/` runtime e `packages/mapper/` runtime. Estensione tramite **composition** (`HttpGateway` chiamato dal `RouteExecutor` di `@sembridge/routing`) + TS declaration merging (`src/augment.ts` — `BrokerConfig.gateway`).

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

## Roadmap (deferred F4-F6)

- **Phase 4 — `/sse-ws` sub-modulo** (RT-01..RT-08): adapter SSE prioritario + WebSocket opzionale; reconnection policy (Last-Event-ID per SSE, ping app-level per WS, exponential backoff full-jitter cap 30s, Visibility API integration). Chiude PRD §39 #9 (RT-07).
- **Phase 6 — wiring `DedupeStrategy`/`BackpressureStrategy`** nel `gateway.execute()` flow (V1 verificate in isolation, deferred wiring middleware automatico).
- **V1.x — circuit breaker avanzato** sliding window stats + success rate + fallback URL.
- **V1.x — custom serializer/parser** (form-data/multipart/binary, response non-JSON).
- **V2 — adapter Zod/Ajv** per response validation (V1 solo Valibot, riusa F2 ValidatorAdapter).

## Licenza

MIT.
