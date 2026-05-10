# @gluezero/core

> Core event broker for GlueZero — pub/sub in-page, plugin registry with anti-leak lifecycle, structured `BrokerEvent` model, `EventTap` pre-instrumented for Phase 6 Inspector.

ESM-only TypeScript library. Browser evergreen target (ES2022). Due runtime dependencies: [`nanoid`](https://github.com/ai/nanoid) (event IDs) e [`valibot`](https://valibot.dev) (config + event shape validation).

## Installazione

```sh
pnpm add @gluezero/core
# oppure
npm install @gluezero/core
# oppure
yarn add @gluezero/core
```

## Quick start

```ts
import { createBroker } from '@gluezero/core'

const broker = createBroker({
  runtime: { logLevel: 'info' },
})

// Subscribe — wildcard supportato
const sub = broker.subscribe('weather.*', (event) => {
  console.log(`Received ${event.topic}:`, event.payload)
})

// Publish (default: deliveryMode='async' via queueMicrotask)
broker.publish('weather.requested', { city: 'Roma' }, {
  source: { type: 'plugin', id: 'weather-form' },
})

// Cleanup
sub.unsubscribe()
```

## API pubblica

### `createBroker(config?: BrokerConfig): Broker`

Crea una nuova istanza del broker. Niente singleton globale (D-30); ogni chiamata ritorna un'istanza indipendente.

Sezioni di `config` riconosciute in F1:

- `config.runtime.logLevel`: `'silent' | 'error' | 'warn' | 'info' | 'debug' | 'trace'` (default `'info'`)
- `config.runtime.debug`: boolean (default `import.meta.env.DEV` se disponibile, altrimenti `false`) — abilita deep-freeze runtime del payload
- `config.runtime.deepFreezeInDev`: boolean opzionale (default `true` quando `debug=true`)
- `config.runtime.logger`: `BrokerLogger` custom (default `createConsoleLogger(level)`)
- `config.runtime.tap`: `EventTap` custom (default `noopEventTap`; F6 sostituirà con Inspector reale)
- `config.debug.enabled` / `config.debug.snapshotPayloadsFull`: toggle dettagli snapshot tap

Sezioni `config.topicSchemas`, `config.canonicalModel`, `config.aliasRegistry`, `config.transforms`, `config.routes`, `config.transport`, `config.workers`, `config.cache` sono placeholder per Phase 2-6 (accettati come `unknown` in F1, ignorati a runtime).

`createBroker` valida `config` con Valibot (D-18). Su fallimento lancia `Error` con messaggio prefissato `Invalid BrokerConfig: ...`.

### `Broker`

Classe principale. Metodi pubblici:

- `publish<T>(topic, payload, options?)` — pubblica un evento. `options.source` deve essere fornito o l'evento ha `event.source.missing`.
- `subscribe(pattern, handler, options?)` — sottoscrive un pattern (wildcard supportati: `weather.*`, `*.failed`, `weather.*.failed`). Ritorna `Subscription` con `.unsubscribe()` idempotente.
- `registerPlugin(descriptor)` — registra un plugin con lifecycle hooks (`onRegister`, `onMount`, `onUnmount`, `onDestroy`). Cascade cleanup automatico al `unregisterPlugin`.
- `unregisterPlugin(id)` — rimuove plugin + tutte le subscription registrate con `signal: ctx.signal` (cascade D-26 — chiusura PRD §39 #7).
- `getTopicRegistry(): readonly string[]` — elenco dei topic noti.
- `getDebugSnapshot()` — snapshot dello stato corrente (topics, subscriberCount, pluginIds, pendingAsyncDelivery, logLevel, pipelineSteps).
- `enableDebug()` / `disableDebug()` — toggle deep-freeze runtime e verbose tap snapshot.
- `setLogger(logger)` — sostituisce logger runtime.

### Helpers

- `createBrokerError(params)` — factory per `BrokerError` strutturati.
- `isBrokerError(value)` — type guard runtime.
- `createConsoleLogger(level?)` — logger console-based con namespace `[gluezero]`.
- `silentLogger` — `BrokerLogger` no-op.

## Naming convention dei topic (CORE-08)

I topic devono rispettare il pattern `<entity>.<action>.<status>` lowercase dot-separated. Regex enforcement: `/^[a-z][a-z0-9]*(\.[a-z][a-z0-9*]*)*$/`.

Esempi validi: `weather.requested`, `auth.user.login`, `form.customer.submitted`.
Esempi invalidi: `Weather.Requested` (uppercase), `weather/requested` (slash), `weather..requested` (segmento vuoto).

Wildcard supportati nei pattern di subscribe (single-segment match):

- `weather.*` matcha `weather.requested`, `weather.loaded`
- `*.failed` matcha `weather.failed`, `auth.failed`
- `weather.*.failed` matcha `weather.alert.failed`, `weather.danger.failed`

## Plugin lifecycle (CORE-04, CORE-05)

```ts
await broker.registerPlugin({
  id: 'weather-plugin',
  onRegister: (ctx) => {
    // sync, runs first
  },
  onMount: async (ctx) => {
    // async, runs after onRegister
    ctx.broker.subscribe('weather.requested', handler)
    // subscribe via ctx.broker auto-tagga ownerId=pluginId — cascade unsubscribe
    // automatica su unregisterPlugin.
  },
  onUnmount: async (ctx) => {
    // async, runs on unregisterPlugin
    // ctx.signal.aborted === false here
  },
  onDestroy: (ctx) => {
    // sync, last step
    // ctx.signal.aborted === true here (cascade fired)
  },
})
```

**Cascade cleanup (D-26, LIFE-02 — chiusura PRD §39 #7):** `unregisterPlugin(id)` invoca `onUnmount`, poi rimuove tutte le subscription registrate via `ctx.broker.subscribe(...)`, fires `AbortController.abort()`, e infine `onDestroy`. Anche se `onUnmount` lancia eccezione, la cascade procede comunque (D-26 must always run). Dopo `unregisterPlugin`, `getDebugSnapshot()` mostra contatori al baseline pre-registrazione.

**Auto-inject `source` su scoped broker (v1.0.1, patch — fix simmetria D-23):** quando un plugin pubblica via lo scoped broker fornito a `ctx.broker.publish(...)`, il campo `source.type === 'plugin'` e `source.id === <pluginId>` viene **iniettato automaticamente** se `options.source` è omesso. Backward-compatible: se il chiamante fornisce `options.source` esplicito, quello vince e nessun cast forzato avviene. La modifica vale solo per il broker scoped — il broker root (`createBroker(...)`) continua a richiedere `options.source` come prima. Replica il pattern lifecycle ownership di `subscribe(ctx.signal)` al canale di publish.

## Handler isolation (CORE-12, ERR-03)

Un handler che lancia eccezione (sync o async via Promise rejected) è catturato dal broker:

1. L'errore viene loggato via `logger.error`.
2. Il broker pubblica `system.error` come `BrokerEvent` con `BrokerError.category: 'plugin'`, `code: 'plugin.handler.failed'`, includendo `originalEventId` e `originalTopic`.
3. Altri handler iscritti allo stesso topic continuano a essere invocati.
4. Il broker rimane funzionante per publish successivi.

```ts
broker.subscribe('system.error', (event) => {
  console.error('Plugin error:', event.payload)
})
```

## EventTap pre-instrumented (CORE-13, vincolo critico)

`EventTap` è instrumentato sui 5 step pipeline F1:

1. `event.received`
2. `event.metadata.enriched`
3. `event.validated`
4. `event.dedupe.checked` (placeholder F1, dedupe completo in F3)
5. `event.delivered`

Implementazione default: no-op (zero overhead). F2-F5 estendono la pipeline con step aggiuntivi. F6 sostituisce il no-op con Event/Mapping/Route Inspector reali — senza retrofit (vincolo architetturale ARCHITECTURE.md §3.2).

```ts
const broker = createBroker({
  runtime: {
    tap: {
      onPipelineStep: (step, snapshot) => {
        console.log(`[${step}]`, snapshot.eventId, snapshot.topic)
      },
    },
  },
})
```

Errori dal tap sono swallowed (D-20) — un tap che fallisce non rompe la pipeline.

## Delivery semantics (D-01..D-03)

- **`async` (default)** — consegna via `queueMicrotask`. Garantisce FIFO, previene re-entrancy stack overflow, isola publisher/subscriber.
- **`sync` (opt-in)** — consegna immediata. Use case: `system.error` per fail-fast.
- **`worker` / `remote`** — dichiarati nel tipo ma no-op in F1. Mappati su `async` con warn `mapping.delivery.fallback`. Implementazione completa in F3 (route HTTP) e F5 (worker).

## Deep-freeze runtime (D-04, D-05)

Quando `runtime.debug: true` (default in dev), il payload viene `Object.freeze` ricorsivamente prima della consegna ai subscriber. Tentativi di mutation lanciano `TypeError` in strict mode.

In produzione (`runtime.debug: false`), il freeze è skippato per performance — il contratto type-level `DeepReadonly<TPayload>` resta enforce-d a compile-time.

`Date`, `Promise`, `TypedArray` sono skippati per default (Date è freezable ma non immutabile; TypedArray view freeze rompe iteration). Cycle detection via `WeakSet` (D-05).

## BrokerError (ERR-01)

```ts
import { isBrokerError } from '@gluezero/core'

try {
  broker.publish('Invalid.Topic', {}, { source: { type: 'plugin', id: 'p' } })
} catch (err) {
  if (isBrokerError(err)) {
    console.log(err.code)        // 'topic.invalid'
    console.log(err.category)    // 'topic'
    console.log(err.details)     // { topic: 'Invalid.Topic', regex: ... }
  }
}
```

Categorie disponibili: `validation | plugin | mapping | route | network | worker | system | config | topic`.

## Scenario meteo (PRD §29) — esempio end-to-end F1

```ts
import { createBroker } from '@gluezero/core'

const broker = createBroker({ runtime: { logLevel: 'info' } })

await broker.registerPlugin({
  id: 'weather-form',
  onMount: (ctx) => {
    // L'utente compila un form e clicca "search"
    document.getElementById('btn-search')?.addEventListener('click', () => {
      const city = (document.getElementById('city') as HTMLInputElement).value
      ctx.broker.publish('weather.requested', { city }, {
        source: { type: 'plugin', id: 'weather-form' },
      })
    })
  },
})

await broker.registerPlugin({
  id: 'weather-card',
  onMount: (ctx) => {
    ctx.broker.subscribe('weather.loaded', (event) => {
      const { city, temp } = event.payload as { city: string; temp: number }
      document.getElementById('card-temp')!.textContent = `${city}: ${temp}°C`
    })
  },
})

await broker.registerPlugin({
  id: 'weather-fetcher',
  onMount: (ctx) => {
    ctx.broker.subscribe('weather.requested', async (event) => {
      const { city } = event.payload as { city: string }
      // F1: il fetch è responsabilità del plugin. F3 introdurrà routing dichiarativo.
      const res = await fetch(`https://api.example.com/weather?city=${city}`)
      const data = await res.json()
      ctx.broker.publish('weather.loaded', { city, temp: data.temp }, {
        source: { type: 'plugin', id: 'weather-fetcher' },
        correlationId: event.id,
      })
    })
  },
})
```

In F1 i plugin orchestrano fetch HTTP manualmente. F3 (`@gluezero/routing` + `@gluezero/gateway`) sostituirà il fetch hard-coded con route dichiarative tipo `{ topic: 'weather.requested', kind: 'http', url: '...' }`.

## Roadmap

- **Phase 1 (questa fase):** Core broker + EventTap pre-instrumented.
- **Phase 2:** Canonical Model + Mapper bidirezionale (`@gluezero/mapper`).
- **Phase 3:** Routing engine + HTTP gateway (`@gluezero/routing`, `@gluezero/gateway`).
- **Phase 4:** Realtime SSE/WS adapter.
- **Phase 5:** Worker runtime (`@gluezero/worker`).
- **Phase 6:** Cache + Tooling avanzato (`@gluezero/cache`, `@gluezero/devtools`) — Inspector reale sostituisce no-op tap di F1.

Vedi [`DECISIONS.md`](../../DECISIONS.md) per le 170 decisioni architetturali.

## Vincoli architetturali

1. **`EventTap` instrumentato in F1** (no retrofit in F6).
2. **Canonicalizzazione interna completa V1** (PRD §13.5) — implementata in F2.
3. **Niente singleton globale** — `createBroker` ritorna istanze indipendenti.
4. **ESM-only V1** — niente CJS (no dual-package hazard).

## Phase 1 — success criteria

I 5 criteri di accettazione di Phase 1, tutti coperti dalla suite di test del package:

1. **Pub/sub end-to-end** con `publish` + `subscribe` (wildcard).
2. **Cascade `unregisterPlugin`**: rimozione plugin = rimozione subscription + abort signal + onDestroy.
3. **Topic naming validation** via regex.
4. **Wildcard pattern matching** (`weather.*`, `*.failed`, `weather.*.failed`).
5. **EventTap pre-instrumented** sui 5 step pipeline F1.

## Licenza

MIT
