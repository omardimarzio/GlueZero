# @sembridge/routing

> Routing engine dichiarativo per SemBridge — Phase 3.

ESM-only TypeScript library. Browser evergreen target (ES2022). Estende [`@sembridge/mapper`](../mapper/README.md) (F2) con `RouteDefinition` discriminata, `RouteResolver` pre-compilato, `RouteExecutor` dispatch by type e `RouterBroker` composition wrapper. Le route HTTP delegano a [`@sembridge/gateway/http`](../gateway/README.md) per le policy uniformi (auth/retry/timeout/dedupe/idempotency/circuit).

Quattro dipendenze runtime: [`@sembridge/core`](../core/README.md) (broker base, F1), [`@sembridge/mapper`](../mapper/README.md) (canonical model + mapper bidirezionale, F2), [`@sembridge/gateway`](../gateway/README.md) (HTTP gateway, F3), [`nanoid`](https://github.com/ai/nanoid) (ID generation), [`valibot`](https://valibot.dev) (config validation).

## Indice

1. [Stato](#stato)
2. [Installazione](#installazione)
3. [Quick start — scenario meteo PRD §29 con HTTP](#quick-start--scenario-meteo-prd-29-con-http)
4. [Cosa contiene](#cosa-contiene)
5. [Vincolo D-83 — composition wrapper](#vincolo-d-83--composition-wrapper)
6. [API pubblica](#api-pubblica)
7. [Open issues PRD §39 chiusi in F3](#open-issues-prd-39-chiusi-in-f3)
8. [Pipeline §28 — step F3 estesi](#pipeline-28--step-f3-estesi)
9. [Policy multipleRoutes (ROUTE-15)](#policy-multipleroutes-route-15)
10. [Topic senza route (ROUTE-16)](#topic-senza-route-route-16)
11. [Cascade unregisterPlugin (LIFE-02 ext F3)](#cascade-unregisterplugin-life-02-ext-f3)
12. [Roadmap (deferred F4-F6)](#roadmap-deferred-f4-f6)
13. [Phase 3 — success criteria](#phase-3--success-criteria)
14. [Licenza](#licenza)

## Stato

Phase 3 **complete** (14/14 plan). `@sembridge/routing` consegna F3 V1: routing engine dichiarativo + composition wrapper di `MapperBroker`.

REQ-ID coperti F3 (29 totali tra `routing` e `gateway`): ROUTE-01..ROUTE-16, VAL-05, ERR-02 ext (`<topic>.failed`, `network.error`), SEC-01..SEC-05, TEST-01 (subset HTTP), TEST-02 (plugin → server → plugin), TEST-03 (server malconfigurato), DOC-04, LIFE-02 ext F3.

## Installazione

```sh
pnpm add @sembridge/core @sembridge/mapper @sembridge/routing @sembridge/gateway
# oppure
npm install @sembridge/core @sembridge/mapper @sembridge/routing @sembridge/gateway
```

I quattro package devono essere installati insieme — `@sembridge/routing` estende `BrokerConfig` e `PluginDescriptor` di `core` via TS declaration merging (`augment.ts`) e dipende da `@sembridge/mapper` come composition wrapper, `@sembridge/gateway/http` per le policy HTTP.

## Quick start — scenario meteo PRD §29 con HTTP

End-to-end con HTTP: un plugin form pubblica `weather.requested`; il `RouterBroker` risolve la route HTTP, il gateway esegue la fetch (auth/retry/timeout/idempotency/allowlist), il mapper inverso trasforma la response in canonico, e `weather.loaded` viene pubblicato come `BrokerEvent`. Un plugin widget consumer riceve la nomenclatura locale via `inputMap`.

```ts
import { createRouterBroker } from '@sembridge/routing'
import type { CanonicalSchemaId } from '@sembridge/mapper'

const broker = createRouterBroker({
  // Sezioni F1 (delegate al Broker via MapperBroker)
  runtime: { logLevel: 'info' },
  // Sezioni F2 (canonical schema + transforms)
  canonicalModel: {
    schemas: [
      {
        id: 'weather' as CanonicalSchemaId,
        fields: {
          location: { type: 'string', required: true },
          forecast_date: { type: 'string', required: true },
          temperature_celsius: { type: 'number' },
          weather_condition: { type: 'string' },
        },
      },
    ],
  },
  // Sezioni F3 (gateway + routing + routes)
  gateway: {
    allowlist: ['https://api.example.com'],
    auth: {
      getToken: async () => storage.get('jwt') ?? undefined,
      refresh: async () => fetch('/auth/refresh').then((r) => r.text()),
    },
    defaults: { timeout: 5000 },
  },
  routing: {
    multipleRoutesPolicy: 'first-match',
    requiresRouteTopics: ['weather.requested'],
  },
  routes: [
    {
      id: 'weather-http',
      type: 'http',
      topic: 'weather.requested',
      request: {
        method: 'GET',
        url: 'https://api.example.com/weather',
        queryMap: {
          city: { source: 'location' },
          date: { source: 'forecast_date' },
        },
      },
      response: { canonical: 'weather' },
      publishes: { success: 'weather.loaded', error: 'weather.failed' },
      policies: {
        timeout: 5000,
        retry: { maxAttempts: 3 },
        concurrency: 'latest-only',
      },
    },
  ],
})

// Plugin form (publisher) — outputMap: locale "città/data" → canonico "location/forecast_date"
await broker.registerPlugin({
  id: 'weather-form',
  outputMap: {
    location: { source: 'città' },
    forecast_date: { source: 'data', transform: 'parseItalianDate' },
  },
  onMount: (ctx) => {
    document.getElementById('btn-search')?.addEventListener('click', () => {
      ctx.broker.publish('weather.requested', {
        città: 'Roma',
        data: '30/04/2026',
      }, { source: { type: 'plugin', id: 'weather-form' } })
    })
  },
})

// Plugin widget (consumer) — inputMap: canonico "location/forecast_date" → locale "location/day-prevision"
await broker.registerPlugin({
  id: 'weather-widget',
  inputMap: {
    location: { source: 'location' },
    'day-prevision': { source: 'forecast_date' },
    temperature: { source: 'temperature_celsius' },
    weather: { source: 'weather_condition' },
  },
  onMount: (ctx) => {
    ctx.broker.subscribe('weather.loaded', (event) => {
      const { location, 'day-prevision': day, temperature, weather } = event.payload as {
        location: string
        'day-prevision': string
        temperature: number
        weather: string
      }
      console.log(`Forecast for ${location} on ${day}: ${temperature}°C, ${weather}`)
    })
  },
})

// Click sul bottone:
// 1. Form publica: { città: 'Roma', data: '30/04/2026' }
// 2. F2 step 5: canonico { location: 'Roma', forecast_date: '2026-04-30' }
// 3. F3 step 8: route 'weather-http' resolved (first-match)
// 4. F3 step 9: GET https://api.example.com/weather?city=Roma&date=2026-04-30
//    + Authorization: Bearer <token>
//    + retry full-jitter su 5xx/408/429 (no retry su 4xx altri)
// 5. F3 step 10: outcome → publish 'weather.loaded' con payload canonico
// 6. F2 step 11: widget riceve { location, 'day-prevision', temperature, weather }
```

Vedi `packages/routing/src/__integration__/scenario-meteo-http.test.ts` per il test end-to-end runtime con `msw` 2.x.

## Cosa contiene

- **`RouterBroker`** — composition wrapper di `MapperBroker` (F2) che orchestra la pipeline §28 step 8/9/10 PRIMA di delegare al `MapperBroker.publish` (D-83 / D-84).
- **`createRouterBroker(config)`** — factory pure function (no singleton, D-30) con Valibot config validation.
- **`RouteDefinition`** — discriminated union via `type`: `'local'` | `'http'` | `'cache'` (stub F6) | `'composite'` (workflow). Worker route aggiunto in F5 via declaration merging.
- **`RouteResolver`** — dispatch table pre-compilata `Map<routeId, CompiledRoute>` + `TopicTrie<CompiledRoute>` per O(segments) lookup runtime. Tre policy multi-route (D-66): `'first-match'` (default + warn dev), `'priority-ordered'`, `'all'` (broadcast).
- **`RouteExecutor`** — dispatch by type: handler `local` (sync, riusa pipeline F1+F2), `http` (async via `@sembridge/gateway/http`), `cache`/`composite` (stub F3 — adapter cache effettivo a F6).
- **`OutcomeCollector`** — step 10 publisher con recursion guard (D-82): publish `<topic>.loaded` o `<topic>.failed` UNA volta sola dopo retry exhausted; secondario `network.error` per consumer sistemici (D-81).
- **3 strategy multi-route** — `'first-match'`, `'priority-ordered'`, `'all'` (vedi `strategies/`).
- **Cascade unregisterPlugin** — D-86 (LIFE-02 ext F3): rimuove subscription F1+F2 + route registrate dal plugin + abort fetch in volo bound al `pluginId`.
- **`requiresRouteTopics`** — opt-in esplicito per topic che richiedono route (D-100, ROUTE-16).
- **Pipeline §28 step 7-full / 8 / 9 / 10** — dedupe checked, route resolved, route executed, outcome collected.

## Vincolo D-83 — composition wrapper

Zero modifiche a `packages/core/` runtime e `packages/mapper/` runtime. Estensione tramite **composition wrapper** (`RouterBroker = wrap(MapperBroker)`) + TS declaration merging (`src/augment.ts`).

Verificato strict via `git diff main -- packages/core/ packages/mapper/` = 0 lines diff a fine F3. I 248 test core e 149 test mapper sono invariati rispetto alla chiusura F2.

## API pubblica

### `createRouterBroker(config?: RouterBrokerConfig): RouterBroker`

Factory pure function (D-30 no singleton). Valida le sezioni F3 del config (`routes`, `gateway`, `routing`) via Valibot e ritorna una nuova istanza `RouterBroker`. Su config non valido, throw `Error('Invalid RouterBrokerConfig: ...')`.

### `class RouterBroker`

Composition wrapper di `MapperBroker` (F2) + `RouterEngine` (resolver + executor + gateway + collector + strategies).

#### Surface delegata F1 + F2 (passthrough a `MapperBroker`)

| Metodo | Descrizione |
|--------|-------------|
| `publish<T>(topic, payload, options?)` | Orchestra pipeline §28 step 8/9/10 prima di delegare a `inner.publish`. Per route `'http'`/`'cache'`/`'composite'` esegue async parallel + local delivery (D-65). |
| `subscribe(pattern, handler, options?)` | Delegate esplicito a `MapperBroker.subscribe` (preserva `applyInputMap` consumer-side se `options.ownerId` set). |
| `registerPlugin(descriptor)` | Delegate + auto-register `descriptor.routes` con `ownerId = descriptor.id` (D-94). |
| `unregisterPlugin(id)` | Cascade D-86: F1+F2 cleanup + `resolver.unregisterByOwner` + `executor.abortInFlightByOwner` + `httpGateway.abortInFlightByOwner`. |
| `registerCanonicalSchema(schema, options?)` | Delegate a `MapperBroker.registerCanonicalSchema`. |

#### Surface F3 nuova

| Metodo | Descrizione | REQ |
|--------|-------------|-----|
| `registerRoute(def, options?)` | Registra una `RouteDefinition`. Ritorna `RouteRegistration { id, unregister() }`. | ROUTE-01 |
| `unregisterRoute(routeId)` | Rimuove la route dal dispatch table. Ritorna `true` se rimossa. | ROUTE-01 |

### Tipi pubblici

Tutti esposti dal barrel `@sembridge/routing`:

| Tipo | Descrizione |
|------|-------------|
| `RouteDefinition` | Discriminated union `local \| http \| cache \| composite` (D-60) |
| `RouteLocalDefinition` / `RouteHttpDefinition` / `RouteCacheDefinition` / `RouteCompositeDefinition` | Varianti specifiche |
| `RouteHttpRequestSpec` | `{ method, url, queryMap?, bodyMap?, serializer? }` |
| `RouteHttpResponseSpec` | `{ canonical: CanonicalSchemaId \| string }` |
| `RouteHttpPublishesSpec` | `{ success?, error? }` |
| `RouteOutcome` | Discriminated `{ ok: true; canonicalPayload } \| { ok: false; error: BrokerError }` |
| `RoutePolicies` | `{ timeout?, retry?, dedupe?, concurrency?, backpressure?, auth?, idempotency? }` |
| `RoutingConfig` | `{ multipleRoutesPolicy?, emitAmbiguousWarning?, requiresRouteTopics? }` |
| `MultipleRoutesPolicy` | `'first-match' \| 'priority-ordered' \| 'all'` |
| `RouterBrokerConfig` | Config completo del `RouterBroker` (sezioni F1+F2+F3) |
| `RouteRegistration` | Handle ritornato da `registerRoute` |
| `CompiledRoute` | Output di `compile(def)` (debug helper) |
| `F3PipelineStep` | Literal union additive dei 3 nuovi step F3 (`event.route.resolved` / `event.route.executed` / `event.outcome.collected`) |

## Open issues PRD §39 chiusi in F3

| # PRD §39 | REQ | Closure F3 |
|-----------|-----|-----------|
| #5 | ROUTE-16 | Topic senza route → default consegna locale; opt-in `requiresRoute: true` su canonical schema (D-95) o `routing.requiresRouteTopics` (D-100) → publish `<topic>.failed` con `code: 'route.required.missing'`. |
| #6 | ROUTE-15 | Tre policy `'first-match'` (default + warning dev via `routing.ambiguous` BrokerEvent) / `'priority-ordered'` (campo `priority` numero) / `'all'` (broadcast fan-out). |
| #7 | LIFE-02 ext F3 | `unregisterPlugin` cascade rimuove anche le route registrate dal plugin + abort cascade `AbortController` di tutte le request HTTP in volo bound al `pluginId` (D-86). |
| #8 | ROUTE-09 | NO retry su 4xx eccetto 408/429; retry SI su 5xx + 408 + 429 + network errors con backoff esponenziale + full jitter (formula PITFALLS #5), rispetto a `Retry-After` (D-69). |

## Pipeline §28 — step F3 estesi

I 14 step della pipeline §28 (PRD §28) sono implementati incrementalmente. F1 implementa lo skeleton (1, 2, 3, 7-base, 13). F2 estende (4, 5, 6, 11, 12). F3 estende:

| Passo | Step ID | Implementato in |
|-------|---------|------------------|
| 7 (full) | `event.dedupe.checked` | F1 base + F3 backpressure full quando dedupe-strategy attiva |
| 8 | `event.route.resolved` | `RouteResolver.resolve` invocato da `RouterBroker.publish` |
| 9 | `event.route.executed` | `RouteExecutor.execute` per ogni route matched (async per http/cache/composite) |
| 10 | `event.outcome.collected` | `OutcomeCollector.collect` → publish `<topic>.loaded` o `<topic>.failed` |

Il tap (`EventTap` di F1) viene invocato a ogni step con `safeTapStep` pattern (try/catch swallow). F6 sostituirà il no-op tap di F1 con l'Inspector reale **senza retrofit** (vincolo architetturale ARCHITECTURE §3.2).

## Policy multipleRoutes (ROUTE-15)

Quando più route matchano lo stesso topic, `RouteResolver.resolve(topic, policy)` applica:

| Policy | Comportamento |
|--------|---------------|
| `'first-match'` (default) | Seleziona la prima registrata. In dev mode emette `routing.ambiguous` come BrokerEvent CORE con `payload: { topic, candidateRouteIds, selectedRouteId }`. |
| `'priority-ordered'` | Seleziona la route con `priority` più alta (campo opzionale, default 0). |
| `'all'` | Broadcast fan-out — TUTTE le route vengono eseguite (utile per logging + side-effects). |

Configurazione globale via `RoutingConfig.multipleRoutesPolicy`. Override per-route via `RouteDefinition.priority`.

## Topic senza route (ROUTE-16)

Default (back-compat F1+F2): topic senza route → consegna locale ai subscriber via `MapperBroker.publish` invariato.

Opt-in per richiedere obbligatoriamente una route:

1. **Via canonical schema** (D-95, augment F3):
   ```ts
   broker.registerCanonicalSchema({
     id: 'auth',
     fields: { token: { type: 'string', required: true } },
     requiresRoute: true,
   })
   ```
2. **Via `routing.requiresRouteTopics`** (D-100, BLOCKER 4 fix — bypass canonical lookup):
   ```ts
   createRouterBroker({
     routing: { requiresRouteTopics: ['auth.requested', 'payment.requested'] },
   })
   ```

Quando `requiresRoute: true` e nessuna route matcha, `RouterBroker` publica `<topic>.failed` con `BrokerError 'route.required.missing'` (`category: 'config'`).

## Cascade unregisterPlugin (LIFE-02 ext F3)

`broker.unregisterPlugin(id)` esegue cascade isolata (try/catch per ogni step — un fallimento NON blocca gli altri):

1. `inner.unregisterPlugin(id)` — cascade F1 (subscription) + F2 (canonical schema/alias/transform/lifecycle).
2. `resolver.unregisterByOwner(id)` — rimuove TUTTE le route registrate dal plugin.
3. `executor.abortInFlightByOwner(id)` — cascade abort `AbortController` per ogni route composite/http in volo.
4. `httpGateway.abortInFlightByOwner(id)` — cascade abort raw fetch in volo bound al `pluginId`.

Pattern coerente con F2 D-49 (cascade isolation T-02-10-03).

## Roadmap (deferred F4-F6)

`@sembridge/routing` consegna F3 V1. Le 3 fasi successive estendono:

- **Phase 4 — Realtime inbound** (`@sembridge/gateway/sse-ws`): adapter SSE/WebSocket; il `RouterBroker` riusa il pattern composition.
- **Phase 5 — Worker runtime** (`@sembridge/worker`): aggiunge `type: 'worker'` al `RouteDefinition` via TS declaration merging; cascade D-86 esteso ai worker MessageChannel.
- **Phase 6 — Cache + Tooling** (`@sembridge/cache` + `@sembridge/devtools`): adapter cache reale (in-memory + IndexedDB) sostituisce lo stub `cache-handler.ts` F3; Route Inspector full snapshot; Metrics format (chiude PRD §39 #10 / TOOL-05).

Vedi `prd.md` (project root) per la specifica V1 completa e `.planning/ROADMAP.md` per i success criteria di ogni fase.

Wiring ancora deferred F4 (documentati in 03-13-SUMMARY):
- `DedupeStrategy.execute()` invocata da `gateway.execute()` come middleware (V1 verificata in isolation).
- `BackpressureStrategy` (latest-only abort) applicata al route-executor flow (V1 dichiarata ma non applicata).
- `delegateMapToShape`/`delegateMapToCanonical` sostituite da `MapperEngine.mapToShape(canonical, inlineOutputMap)` reale (V1 fallback identity).

## Phase 3 — success criteria

I 5 criteri di accettazione di Phase 3, tutti coperti dalla suite di test del package:

1. **Scenario meteo PRD §29 esteso con HTTP** — `__integration__/scenario-meteo-http.test.ts` (3 test): publish `weather.requested` → fetch `/api/weather` (msw) → response mapping → publish `weather.loaded` con payload canonico.
2. **Errore HTTP ≥ 400 + retry differenziato** — `__integration__/retry-policy.test.ts` (6 test): 5xx → 3 retry, 4xx no retry, 408/429/network retry, Idempotency-Key invariato sui retry POST.
3. **Open issues PRD §39 chiusi** — `__integration__/route-cascade-cleanup.test.ts` (LIFE-02 ext F3) + `retry-policy.test.ts` (ROUTE-09) + plan 03-12 router-broker test (ROUTE-15/ROUTE-16).
4. **Concurrency `'latest-only'` + dedupeKey** — `__integration__/concurrency-latest-only.test.ts` + `dedupe.test.ts`.
5. **Server Gateway centralizza auth + allowlist + backpressure** — `__integration__/url-allowlist.test.ts` (SEC-05 con 0 fetch PRE-fetch su URL forbidden + control positivo).

Coverage: 145+ unit test + 16 integration test = 161+ test routing totali. Coverage v8 ≥ 90% lines/functions/statements + ≥ 85% branches sui file `src/` (esclusi `index.ts` + `*.test.ts` + `__integration__/`).

## Licenza

MIT.
