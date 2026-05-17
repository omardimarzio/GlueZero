# @gluezero/mapper

> Canonical model + bidirectional mapper per GlueZero — Phase 2.

> 🎉 **v2.0.0 GA (2026-05-17)** — Mapping per-MF disponibile via `@gluezero/context` (Phase F10). Vedi [root README](../../README.md#microfrontend-governance-layer-v20-opt-in) · [docs/v2/](../../docs/v2/index.md) · [migration guide A/B/C](../../docs/v2/17-migration-guide.md).

ESM-only TypeScript library. Browser evergreen target (ES2022). Estende [`@gluezero/core`](../core/README.md) con vocabolario canonico tipizzato, mapper bidirezionale pre-compilato, transform pipeline, validation adapter pluggable e Mapping Inspector.

Tre dipendenze runtime: [`@gluezero/core`](../core/README.md) (broker base, workspace), [`valibot`](https://valibot.dev) (validation), [`nanoid`](https://github.com/ai/nanoid) (transitivo via core).

## Indice

1. [Installazione](#installazione)
2. [Quick start — scenario meteo PRD §29](#quick-start--scenario-meteo-prd-29)
3. [API pubblica](#api-pubblica)
4. [Mapping resolution order (MAP-17)](#mapping-resolution-order-map-17--chiusura-prd-39-1)
5. [Field policy (VAL-08)](#field-policy-val-08--chiusura-prd-39-3)
6. [Transform failure policy (VAL-09)](#transform-failure-policy-val-09--chiusura-prd-39-4)
7. [Mapping Inspector (D-46..D-48)](#mapping-inspector-d-46d-48)
8. [Cycle detection (D-35)](#cycle-detection-d-35)
9. [Validation adapter (D-37, D-38)](#validation-adapter-d-37-d-38)
10. [Pipeline §28 estesa F2](#pipeline-28-estesa-f2)
11. [Vincoli architetturali](#vincoli-architetturali)
12. [Roadmap (deferred a F3-F6)](#roadmap-deferred-a-f3-f6)
13. [Phase 2 — success criteria](#phase-2--success-criteria)
14. [Licenza](#licenza)

## Installazione

```sh
pnpm add @gluezero/core @gluezero/mapper
# oppure
npm install @gluezero/core @gluezero/mapper
# oppure
yarn add @gluezero/core @gluezero/mapper
```

`@gluezero/mapper` dipende da `@gluezero/core` (workspace protocol). Entrambi i package devono essere installati insieme — il mapper estende il `BrokerConfig` e `PluginDescriptor` di `core` via TS declaration merging.

## Quick start — scenario meteo PRD §29

End-to-end senza HTTP (HTTP routing è F3): un plugin form pubblica `weather.requested` con field locali italiani; il mapper produce un payload canonico inglese; un plugin widget consumer riceve la sua nomenclatura locale via `inputMap` inverso.

```ts
import { createMapperBroker, type CanonicalSchemaId } from '@gluezero/mapper'

// 1. Configura il broker con canonical schemas + transforms registrati al boot
const broker = createMapperBroker({
  runtime: { logLevel: 'info' },
  canonicalModel: {
    schemas: [
      {
        id: 'weather' as CanonicalSchemaId,
        fields: {
          location: { type: 'string', required: true },
          forecast_date: { type: 'string', required: true, onFailure: 'block' },
        },
      },
    ],
  },
  transforms: {
    parseItalianDate: (input) => {
      const [d, m, y] = String(input).split('/')
      return `${y}-${m}-${d}`
    },
  },
})

// 2. Plugin form (publisher) — outputMap: locale "città/data" → canonico "location/forecast_date"
await broker.registerPlugin({
  id: 'weather-form',
  canonicalSchemaId: 'weather' as CanonicalSchemaId,
  outputMap: {
    location: { source: 'città' },
    forecast_date: { source: 'data', transform: 'parseItalianDate' },
  },
  onMount: (ctx) => {
    document.getElementById('btn-search')?.addEventListener('click', () => {
      const città = (document.getElementById('city') as HTMLInputElement).value
      const data = (document.getElementById('date') as HTMLInputElement).value
      ctx.broker.publish('weather.requested', { città, data }, {
        source: { type: 'plugin', id: 'weather-form' },
      })
    })
  },
})

// 3. Plugin widget (consumer) — inputMap: canonico "location/forecast_date" → locale "location/day-prevision"
await broker.registerPlugin({
  id: 'weather-widget',
  inputMap: {
    location: { source: 'location' },
    'day-prevision': { source: 'forecast_date' },
  },
  onMount: (ctx) => {
    ctx.broker.subscribe('weather.requested', (event) => {
      const { location, 'day-prevision': day } = event.payload as {
        location: string
        'day-prevision': string
      }
      console.log(`Forecast for ${location} on ${day}`)
    })
  },
})

// 4. L'utente clicca "search" — il widget riceve la nomenclatura locale via mapping inverso
// Form publica: { città: 'Roma', data: '30/04/2026' }
// Canonico (post step 5): { location: 'Roma', forecast_date: '2026-04-30' }
// Widget riceve (post step 11): { location: 'Roma', 'day-prevision': '2026-04-30' }
```

Vedi `packages/mapper/src/__integration__/weather-scenario.integration.test.ts` per il test end-to-end runtime.

## API pubblica

### `createMapperBroker(config?: MapperBrokerConfig): MapperBroker`

Crea una nuova istanza `MapperBroker` validando le sezioni F2 del config (`canonicalModel`, `aliasRegistry`, `transforms`) via Valibot (D-56). No singleton (D-30): ogni call ritorna un'istanza indipendente.

Sezioni di `config` riconosciute in F2:

- `runtime.*` — eredita da `BrokerConfig` di F1 (`logLevel`, `debug`, `logger`, `tap`, ecc.)
- `canonicalModel.schemas: CanonicalSchema[]` — schemi canonici registrati al boot
- `aliasRegistry.global: Record<localField, canonicalField>` — alias globali al boot
- `aliasRegistry.scoped: Record<pluginId, Record<localField, canonicalField>>` — alias plugin-scoped
- `transforms: Record<name, TransformFn>` — transform registrati al boot

Su `config` non valido, throw `Error('Invalid MapperBrokerConfig: ...')`.

### `class MapperBroker`

Composition wrapper di `Broker` (F1) + `MapperEngine` + `MappingInspector`. Surface pubblica:

#### Surface F1 (delegata + wrapped)

| Metodo | Descrizione | Step F2 wired |
|--------|-------------|---------------|
| `publish<T>(topic, payload, options?)` | Applica `outputMap` del plugin source + canonical validation prima di delegare a `bus.publish` | 5, 6 |
| `subscribe(pattern, handler, options?)` | Wrappa l'handler con `applyInputMap` del consumer (se `options.ownerId` set) | 11, 12 |
| `registerPlugin(descriptor)` | Pre-compile mapping (cycle detection D-35) + wrappa hook lifecycle (D-51) | — |
| `unregisterPlugin(id)` | Cascade cleanup F2 ext: alias scoped + transforms ownerId + mapper compiled + canonical schemas owned | — |
| `getTopicRegistry()` | Delega a `Broker.getTopicRegistry()` | — |
| `setLogger(logger)` | Delega a `Broker.setLogger(logger)` | — |
| `enableDebug()` / `disableDebug()` | Delega al `Broker` | — |
| `getDebugSnapshot()` | Snapshot esteso F2 con sezione `mappings` (D-48) | — |

#### Surface F2 nuova (D-31)

| Metodo | Descrizione | REQ |
|--------|-------------|-----|
| `registerCanonicalSchema(schema, options?)` | Registra uno schema canonico. Ritorna `true` se nuovo, `false` se duplicato. Throw `BrokerError 'canonical.requires.unresolved'` se `requires` non risolti (D-36). | MAP-02 |
| `registerTransform(name, fn, options?)` | Registra un transform globale. Throw `BrokerError 'transform.id.duplicate'` se `name` già usato. | MAP-12 |
| `registerAlias(local, canonical, options?)` | Registra un alias global o scoped. `options.scope: 'global'` (default) o `pluginId`. | MAP-16, MAP-17 |
| `getMappingInspector()` | Ritorna l'istanza `MappingInspector` per debug consumer-side. | MAP-15 |

### Tipi pubblici

Tutti esposti dal barrel `@gluezero/mapper`:

| Tipo | Descrizione |
|------|-------------|
| `CanonicalSchema` | Schema canonico (`id`, `fields`, `requires?`, `description?`) |
| `CanonicalSchemaId` | Branded id schema canonico (Pitfall #12 — type confusion prevention) |
| `FieldDescriptor` | Descrittore field (`type`, `required?`, `default?`, `onFailure?`, `description?`) |
| `FieldType` | `'string' \| 'number' \| 'boolean' \| 'object' \| 'array' \| 'any'` |
| `FieldFailureMode` | `'block' \| 'skip' \| 'fallback'` (D-44) |
| `InputMap` / `OutputMap` | Mappa locale ↔ canonico per plugin |
| `MappingRule` | Regola per singolo field (`source?`, `transform?`, `default?`, `derive?`) |
| `DeriveDescriptor` | Combina più source via transform (PRD §14.5) |
| `TransformFn` | `(input: unknown, ctx: TransformContext) => unknown` |
| `TransformContext` | Context readonly passato al transform a runtime |
| `TransformDescriptor` | `{ name, fn, description? }` |
| `TransformName` | Branded type per nome transform |
| `ValidatorAdapter` | `validate<T>(schema, payload): ValidationResult<T>` |
| `ValidationIssue` | Issue di validazione (subset di Valibot.Issue) |
| `ValidationResult<T>` | `{ ok: true; value: T } \| { ok: false; issues: ValidationIssue[] }` |
| `MappingErrorCode` | Literal union dei 5 codici errore F2 (D-58) |
| `MapperPluginDescriptor` | Plugin descriptor F2 con `inputMap`/`outputMap`/`canonicalSchemaId` |
| `MapperEngineOptions` | Options del MapperEngine (DI dei moduli Wave 3) |
| `MappingInspectorOptions` / `MappingInspectorSnapshot` | Inspector |
| `RegisterAliasOptions` / `RegisterCanonicalSchemaOptions` / `RegisterTransformWrapperOptions` | Options per i 3 register API |
| `MapperSubscribeOptions` | Subscribe options esteso F2 (`ownerId`) |
| `MapperBrokerDebugSnapshot` | Snapshot debug esteso F2 |
| `F2PipelineStep` | Literal union dei 5 nuovi step pipeline §28 (D-50) |

### Helpers runtime

- `valibotAdapter` — `ValidatorAdapter` default (Valibot 1.x)
- `isMappingErrorCode(code: string): code is MappingErrorCode` — type guard runtime
- `wrapTap(tap, inspector)` — composition helper Inspector + tap utente
- Le 4 classi runtime `AliasRegistry`, `CanonicalRegistry`, `TransformPipeline`, `MapperEngine`, `MappingInspector` sono esportate per advanced use cases (di norma usa `MapperBroker` che le compone)

## Mapping resolution order (MAP-17 — chiusura PRD §39 #1)

Quando il mapper deve risolvere `localField → canonicalField`, applica l'ordine di precedenza:

```
1. Mapping esplicito (inputMap/outputMap del plugin) — SEMPRE prevalente (D-40)
2. Alias plugin-scoped (registerAlias({ scope: pluginId }))
3. Alias globali (registerAlias({ scope: 'global' }))
4. Name match diretto (localField === canonicalField)
5. Field non risolto → applica required:true|false policy (D-42 — VAL-08)
```

Il **mapping esplicito prevale sempre** sugli alias automatici. Quando un alias automatico risolve un'ambiguità (più candidati globali), il mapper publica un evento `mapping.warn` come BrokerEvent (CORE category `mapping`) per debug — **NON** un'eccezione (D-41).

## Field policy (VAL-08 — chiusura PRD §39 #3)

Configurabile per campo nello schema canonico (`FieldDescriptor.required: boolean`, default `false`):

| Configurazione | Field presente | Field assente |
|---------------|---------------|---------------|
| `required: true` | usa il valore | throw `BrokerError 'mapping.field.missing'` → publish `mapping.error` (D-58) → no delivery |
| `required: false` + `default: T` | usa il valore | applica `default` |
| `required: false` (no default) | usa il valore | field assente nella canonical payload (NO `undefined` esplicito per `exactOptionalPropertyTypes`) |

I `default` sono valori statici (no funzioni). Per default dinamici (timestamp, UUID, ecc.) usa `derive` con un transform registrato (D-43).

> **WR-D iter2 — Semantica `null` su required field:** un field con `required: true` e valore `null` esplicito nel payload genera un type mismatch (`mapping.canonical.validation.failed` con `expected: 'string'`, `received: 'null'`), **NON** `mapping.field.missing`. "Missing" qui significa "key non presente nel payload object" (`!(name in obj)`). Per un comportamento "required-and-not-null" SQL-like, usa un transform pre-step che valida `null` esplicitamente, oppure dichiara il field con `type: 'any'` se il consumer accetta `null` come valore valido.

## Transform failure policy (VAL-09 — chiusura PRD §39 #4)

Configurabile per campo (`FieldDescriptor.onFailure: 'block' | 'skip' | 'fallback'`, default `'block'`):

| `onFailure` | Comportamento al transform throw |
|-------------|-----------------------------------|
| `'block'` (default) | Mapping intero fallisce → publish `mapping.error` (D-58) → no delivery (D-59) |
| `'skip'` | Field lasciato non valorizzato (come `required: false` + no default) |
| `'fallback'` | Applica `default: T` se definito; senza default, comportamento `'skip'` |

Il transform error originale è preservato in `BrokerError.originalError` e `BrokerError.cause` (ES2022). Il `BrokerError` ha `category: 'mapping'`, `code: 'mapping.transform.failed'`, e `details: { pluginId, fieldName, transformName }` (D-45).

```ts
broker.subscribe('mapping.error', (event) => {
  const { error, sourceEvent, step } = event.payload as {
    error: BrokerError
    sourceEvent: string
    step: string
  }
  console.error(`[${step}] mapping failed for ${sourceEvent}:`, error.code, error.details)
})
```

## Mapping Inspector (D-46..D-48)

L'Inspector estende `EventTap` di F1 (vincolo critico ARCHITECTURE §3.2 — pre-instrumentato). I 5 nuovi step pipeline §28 invocano il tap esistente:

- `event.source.resolved` (passo 4) — identificazione plugin sender + outputMap
- `event.mapped.canonical` (passo 5) — output → canonical mapping applicato
- `event.canonical.validated` (passo 6) — Valibot canonical schema validation
- `event.mapped.consumer` (passo 11) — canonical → consumer mapping per ogni subscriber
- `event.final.validated` (passo 12) — post-mapping consumer validation

`broker.getMappingInspector()` ritorna l'istanza `MappingInspector` con surface:

- `lastErrors(): readonly BrokerError[]` — ring buffer (default 10) degli ultimi `mapping.error`
- `getSnapshot()` — `{ canonicalSchemas, registeredAliases, registeredTransforms, lastMappingErrors }`
- `recordError(err)` — usato internamente dal MapperBroker per popolare il ring buffer
- `clearErrors()` — svuota il ring buffer (utile per test)

`broker.getDebugSnapshot()` ritorna lo snapshot esteso F2 con sezione `mappings`:

```ts
const snap = broker.getDebugSnapshot()
console.log(snap.mappings)
// {
//   canonicalSchemas: 1,
//   registeredAliases: 0,
//   registeredTransforms: 1,
//   lastMappingErrors: [BrokerError, ...]
// }
```

> **F2 V1 scope:** Inspector espone counter + lastErrors. Il full snapshot per evento (payload before/after, transforms applied per evento, ambiguity warnings) è deferred a F6 (TOOL-01) — l'Inspector reale sostituirà il no-op tap di F1 senza retrofit.

## Cycle detection (D-35)

Il mapping circolare (es. `inputMap A → B → A`) è detected al `registerPlugin`, **NON a runtime publish**. Il mapper scansiona il dispatch table compilato con `visited: Set<(pluginId, fieldName)>` e — se trova un ciclo — throw `BrokerError 'mapping.cycle.detected'` immediatamente:

```ts
try {
  await broker.registerPlugin({
    id: 'cyclic',
    outputMap: {
      a: { source: 'b' },
      b: { source: 'a' }, // CYCLE!
    },
  })
} catch (err) {
  if (err.code === 'mapping.cycle.detected') {
    console.error(err.details) // { pluginId: 'cyclic', cycle: ['a', 'b', 'a'] }
  }
}
```

Il plugin **NON viene registrato** in caso di throw (rollback automatico, coerente con `plugin.id.duplicate` di F1).

## Validation adapter (D-37, D-38)

Default `valibotAdapter` esportato dal barrel. Pluggable via `ValidatorAdapter` interface — Zod/Ajv adapter sono deferred a V2 (out of scope V1 per minimizzare bundle size).

```ts
import { valibotAdapter, type ValidatorAdapter } from '@gluezero/mapper'

// Custom adapter (es. AJV in V2)
const customAdapter: ValidatorAdapter = {
  validate(schema, payload) {
    // Wrap della tua libreria validation preferita
    try {
      const value = mySchemaLib.parse(schema, payload)
      return { ok: true, value }
    } catch (err) {
      return { ok: false, issues: [{ message: err.message }] }
    }
  },
}
```

L'adapter **non deve mai throw** — il contract è `{ ok: false, issues }` su fail. Il caller (mapper-engine ai passi 6/12) decide cosa fare con il fail (publish `mapping.error` o applicare D-44 onFailure).

## Pipeline §28 estesa F2

I 14 step della pipeline §28 (PRD §28) sono implementati incrementalmente. F1 implementa lo skeleton (passi 1, 2, 3, 7-base, 13). F2 estende con:

| Passo | Step ID | Implementato in |
|-------|---------|------------------|
| 4 | `event.source.resolved` | mapper-engine + broker wrapper plan 02-10 |
| 5 | `event.mapped.canonical` | broker wrapper publish (`applyOutputMap`) |
| 6 | `event.canonical.validated` | broker wrapper publish (`validateCanonical`) |
| 11 | `event.mapped.consumer` | broker wrapper subscribe (`applyInputMap`) |
| 12 | `event.final.validated` | broker wrapper subscribe (`validateCanonical`) |

L'ordine è coerente con CONTEXT D-50. Niente trasformazioni implicite invisibili al debug layer (PRD §28.2).

## Vincoli architetturali

1. **`bus.ts` di F1 non è modificato** (D-49) — il MapperBroker compone Broker F1 senza touchare il sorgente. Estensione via composition wrapper + TS declaration merging.
2. **EventTap pre-instrumentato in F1** (vincolo critico ARCHITECTURE §3.2) — l'Inspector reale di F6 sostituirà il no-op senza retrofit della pipeline.
3. **Canonicalizzazione interna completa V1** (PRD §13.5) — i dati transitano canonicalizzati internamente; la traduzione inversa avviene solo all'ultimo miglio (passo 11).
4. **Mapping pre-compilato al `registerPlugin`** (D-34) — runtime overhead minimo, lookup O(1) sul dispatch table.
5. **Niente singleton globale** — `createMapperBroker` ritorna istanze indipendenti (D-30).
6. **ESM-only V1** — niente CJS (no dual-package hazard).
7. **No mapping ambiguo automatico senza configurazione esplicita** (PRD §5) — gli alias risolvono solo casi noti; ambiguità multiple producono `mapping.warn` (D-41).

## Roadmap (deferred a F3-F6)

`@gluezero/mapper` consegna F2 V1. Le 4 fasi successive estendono il mapping a domini specifici:

- **Phase 3 — Routing & HTTP gateway** (`@gluezero/routing` + `@gluezero/gateway`): route HTTP dichiarative; il mapper riusa `MapperEngine` F2 per server response mapping (`temperatureCelsius → temperature` ecc.).
- **Phase 4 — Realtime inbound** (SSE + WS adapter): il mapper riusa `MapperEngine` F2 per normalizzare i payload server.
- **Phase 5 — Worker runtime** (`@gluezero/worker`): canonicalizzazione del payload prima del dispatch al worker.
- **Phase 6 — Cache + Tooling** (`@gluezero/cache` + `@gluezero/devtools`): Inspector reale (full payload before/after per evento) sostituisce il no-op di F1.

Vedi [`DECISIONS.md`](../../DECISIONS.md) per le 170 decisioni architetturali con i success criteria di ogni fase.

## Phase 2 — success criteria

I 5 criteri di accettazione di Phase 2, tutti coperti dalla suite di test del package:

1. **Scenario meteo PRD §29 end-to-end senza HTTP** — `__integration__/weather-scenario.integration.test.ts`
2. **Mapping Inspector espone counter + errori** — `__integration__/inspector-snapshot.integration.test.ts` (full payload before/after deferred F6)
3. **Mapper supporta i casi PRD §14.2** (rename, nested, default, transform, derive, partial, post-mapping validation) — `__integration__/weather-scenario.integration.test.ts` Test 3
4. **Open issues PRD §39 chiusi** — `mapper-engine.test.ts` (MAP-17 D-40, VAL-08 D-42) + `transform-pipeline.test.ts` (VAL-09 D-44) + `__integration__/mapping-error-event.integration.test.ts` (D-58)
5. **Cycle detection register-time** — `__integration__/cycle-detection.integration.test.ts`

Coverage 27 REQ-IDs F2 (MAP-01..MAP-17 + VAL-02..VAL-04, VAL-07..VAL-09 + ERR-02 ext + TEST-01..TEST-02 + DOC-03 + LIFE-02 ext F2).

## Licenza

MIT.
