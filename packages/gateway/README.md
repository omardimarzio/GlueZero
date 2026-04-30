# @sembridge/gateway

HTTP Gateway centralizzato + adapter realtime per SemBridge (Phase 3 + Phase 4).

## Stato

Phase 3 in sviluppo (HTTP). Phase 4 (SSE/WebSocket) successiva. API non stabile.

## Subpath exports

Il package è organizzato in subpath per separare le capability F3 (HTTP) da F4 (realtime). Il consumer importa il sub-modulo necessario:

```ts
import { createHttpGateway } from '@sembridge/gateway/http'
// import { createSseAdapter } from '@sembridge/gateway/sse-ws'  // Phase 4
```

Il subpath `./http` ha bundle budget separato (8 KB gzip) rispetto al package umbrella, garantendo che chi non usa SSE/WS non paghi il costo di F4. Vedi `package.json` `exports`.

## Cosa contiene (F3 — `/http`)

- **`HttpGateway`** — entry centralizzato che applica una **policy chain** di middleware uniforme a tutte le richieste fetch generate dalle route HTTP.
- **7 Strategy primitives** (Strategy Pattern, D-68):
  - `RetryStrategy` (default `ExponentialBackoffWithJitter`, formula da PITFALLS #5; 4xx vs 5xx differenziato — D-69 / ROUTE-09)
  - `TimeoutStrategy` (default `FixedTimeout` 30000 ms)
  - `DedupeStrategy` (default `KeyBased` su `dedupeKey`, fallback `'route-id+queryParams'`)
  - `BackpressureStrategy` (default `LatestOnly`; queue/drop/throttle/debounce supportati)
  - `AuthStrategy` (default `BearerHook` + single-flight `refresh` su 401 — D-72)
  - `IdempotencyStrategy` (auto `Idempotency-Key` su POST/PATCH/PUT/DELETE riusato sui retry — D-70 / SEC-03)
  - `CircuitBreakerStrategy` (per-route fail counter + cooldown, opt-in)
- **URL allowlist** (D-71 / SEC-05) — guard pre-fetch che blocca URL non in `gateway.allowlist`.
- **Retry-After parser** — gestione header `Retry-After` (delta-seconds e HTTP-date).

## Vincolo D-83

Zero modifiche a `packages/core/` runtime e `packages/mapper/` runtime. Estensione tramite composition (`HttpGateway` chiamato dal `RouteExecutor` di `@sembridge/routing`) + TS declaration merging (`src/augment.ts`, plan 03-04).

## Documentazione

Vedi `prd.md` §18, §23, §26. DOC-04 completo al plan 03-14.

## Licenza

MIT
