---
phase: 01-core-essenziale
plan: 03
subsystem: core-public-types
tags:
  - types
  - public-api
  - contracts
  - interface-first
dependency-graph:
  requires:
    - core-package-build-pipeline
    - core-package-typecheck-pipeline
  provides:
    - core-public-types-barrel
    - broker-event-type
    - subscription-type
    - plugin-descriptor-type
    - broker-error-type
    - broker-logger-type
    - event-tap-type
    - broker-config-type
    - deep-readonly-utility
    - pipeline-step-discriminated-union
  affects:
    - all-future-f1-plans
    - "@sembridge/core-public-api"
    - phase-2-canonical-model
    - phase-3-routing
    - phase-6-tooling
tech-stack:
  added: []
  patterns:
    - interface-first-contracts
    - barrel-re-export-type-only
    - deep-readonly-recursive-utility
    - branded-types-via-unique-symbol
    - declaration-merging-tolerant-placeholders
key-files:
  created:
    - packages/core/src/types/broker-event.ts
    - packages/core/src/types/deep-readonly.ts
    - packages/core/src/types/subscription.ts
    - packages/core/src/types/plugin.ts
    - packages/core/src/types/error.ts
    - packages/core/src/types/logger.ts
    - packages/core/src/types/tap.ts
    - packages/core/src/types/config.ts
    - packages/core/src/types/index.ts
  modified:
    - packages/core/src/index.ts
decisions:
  - "Inclusione di SubscribeOptions.once?: boolean — RESEARCH Open Question 1 risolta in favore: cost ~15 LOC in bus.ts (plan 07), valore DX significativo, nessun REQ-ID lo vieta."
  - "PluginContext.broker tipato unknown provvisoriamente in F1 plan 03 — RESEARCH usava import('../core/broker').Broker ma core/broker.ts NON esiste in plan 03 (creato in plan 08). Plan 08 risolverà via TypeScript declaration merging o re-typing per esporre la firma reale di Broker."
  - "Aggiunto export type * from './types' a packages/core/src/index.ts — Rule 2 (auto-add missing critical functionality). Senza questo re-export i plan paralleli 04/05/06 non potrebbero importare i tipi via 'from @sembridge/core' e il dist/index.d.ts resterebbe vuoto (success criterion utente fallirebbe). Plan 08 aggiungerà i runtime export (createBroker, Broker, ConsoleLogger, ecc.) accanto a questo barrel di tipi."
  - "PipelineStep — riformattato il blocco future-step da union-trailing-comments (rifiutato da Biome formatter) a comment-block pre-type. Stessa informazione, formato Biome-compliant. Sostanza F2/F3/F6 invariata: declaration merging ad-hoc per aggiungere 'event.source.resolved', 'event.mapped.canonical', 'event.canonical.validated', 'event.route.resolved', 'event.route.executed', 'event.outcome.collected', 'event.mapped.consumer', 'event.final.validated' (F2/F3) e 'event.observed' (F6)."
  - "DeepReadonly<T>: rama Array<T> usa shorthand `readonly DeepReadonly<U>[]` invece di `ReadonlyArray<DeepReadonly<U>>` per soddisfare Biome useConsistentArrayType (errore lint). Semantica identica."
metrics:
  duration: "6m 26s"
  completed: "2026-04-28T12:28:00Z"
  tasks_completed: 3
  files_created: 9
  files_modified: 1
  commits: 3
---

# Phase 1 Plan 03: Public Types Summary

Definiti tutti i tipi pubblici di `@sembridge/core` come interfacce TypeScript strict in `packages/core/src/types/` (9 file: broker-event, deep-readonly, subscription, plugin, error, logger, tap, config, index barrel). Il plan è **interface-first**: stabilisce i contratti che i moduli runtime dei plan 04-08 implementano. Nessun codice runtime — solo type definitions. Coverage REQ-IDs: CORE-06 ✓, CORE-07 (type-level) ✓, CORE-13 ✓, CORE-14 ✓, ERR-01 ✓, VAL-06 ✓.

## Objective Achieved

L'obiettivo del plan 01-03 è raggiunto integralmente:

- **9 file types/** creati in `packages/core/src/types/` con tutti i 20 tipi pubblici (`BrokerEvent`, `EventSource`, `DeliveryMode`, `Priority`, `EventId`, `DeepReadonly`, `Subscription`, `SubscribeOptions`, `PluginDescriptor`, `PluginContext`, `PluginState`, `BrokerError`, `ErrorCategory`, `CreateBrokerErrorParams`, `BrokerLogger`, `LogLevel`, `EventTap`, `PipelineStep`, `PipelineSnapshot`, `BrokerConfig`) + 1 tipo interno non re-esportato (registration record del plugin registry).
- **`pnpm --filter @sembridge/core typecheck`** esce 0 (no TS errors).
- **`pnpm biome check packages/core/src/types/`** esce 0 (no lint/format warnings).
- **`pnpm --filter @sembridge/core build`** produce `dist/index.d.ts` (4.53 KB) con i 20 tipi pubblici esposti via `export type` consolidato; il tipo interno NON è leakato a `dist`.
- **Tutti i campi readonly** dove richiesto dalla decisione D-04/D-07 (CORE-07 enforcement type-level).
- **`DeepReadonly<T>`** è ricorsiva su Date/RegExp/Error (passthrough), Map/Set (Readonly varianti), Array (`readonly T[]`), object (mapped readonly).
- **`PipelineStep`** enumera esattamente i 5 step F1 (`event.received`, `event.metadata.enriched`, `event.validated`, `event.dedupe.checked`, `event.delivered`) — D-20.
- **`BrokerConfig`** ha tutte le 10 sezioni del PRD §27 (`runtime`, `debug` strutturate F1; `topicSchemas`, `canonicalModel`, `aliasRegistry`, `transforms`, `routes`, `transport`, `workers`, `cache` placeholder F2-F6 tipate `unknown` per declaration merging non-breaking) — CORE-14.

## Tasks Executed

| #   | Name                                                                | Commit    | Status |
| --- | ------------------------------------------------------------------- | --------- | ------ |
| 1   | Tipi event/payload — broker-event.ts, deep-readonly.ts, subscription.ts | `ebd126a` | done   |
| 2   | Tipi plugin/error/logger — plugin.ts, error.ts, logger.ts           | `7d4ff8a` | done   |
| 3   | Tipi tap/config + index.ts re-export hub                            | `7b01f82` | done   |

## Files Created

**Types (9 file, 357 righe totali):**

- `packages/core/src/types/deep-readonly.ts` — `DeepReadonly<T>` utility ricorsiva. Conditional su Date/RegExp/Error (passthrough no-recursion), Map/Set (Readonly varianti con chiavi/valori ricorsivamente readonly), Array (`readonly DeepReadonly<U>[]` shorthand), object (mapped `{ readonly [K]: DeepReadonly<T[K]> }`), primitivi (passthrough).
- `packages/core/src/types/broker-event.ts` — `BrokerEvent<TPayload>`, `EventSource`, `DeliveryMode` (`sync | async | worker | remote` — D-03), `Priority` (`low | normal | high | critical`), branded `EventId` con `unique symbol __eventIdBrand`. Tutti i campi `readonly`. `payload: DeepReadonly<TPayload>`. `source` non-optional (CORE-07 type-level). `metadata` opzionale ma deep-readonly se presente.
- `packages/core/src/types/subscription.ts` — `Subscription` handle (`id`, `topic`, `active` readonly + `unsubscribe(): void`) idempotente (D-27). `SubscribeOptions` con `signal?: AbortSignal`, `priority?: 'low' | 'normal' | 'high'` (NO `'critical'` — è event-level), `deliveryMode?: 'sync' | 'async'`, `once?: boolean` (decisione planner — vedi sotto).
- `packages/core/src/types/plugin.ts` — `PluginState` 8 stati (`unregistered | registered | mounting | mounted | unmounting | unmounted | failed | destroyed`), `PluginDescriptor` con `id` readonly + 4 hook lifecycle opzionali (`onRegister`, `onMount`, `onUnmount`, `onDestroy`) — D-25/CORE-05. `PluginContext` con `id`, `logger: BrokerLogger`, `broker: unknown` (placeholder, vedi decisione), `signal: AbortSignal` (D-26 cascade fire). Registration record interno (NON re-esportato).
- `packages/core/src/types/error.ts` — `BrokerError extends Error` con 8 campi readonly (`code`, `category`, `details?`, `originalError?`, `routeId?`, `topic?`, `eventId?` + `message` ereditato) — ERR-01. `ErrorCategory` 9 union members (pre-include `mapping`/`route`/`network`/`worker` per F2-F5 non-breaking). `CreateBrokerErrorParams` per factory plan 04.
- `packages/core/src/types/logger.ts` — `LogLevel` 6 valori (`silent | error | warn | info | debug | trace`) — CORE-10/D-12. `BrokerLogger` interface 5 metodi (`error/warn/info/debug/trace`) con firma `(message: string, meta?: Record<string, unknown>): void` — D-14. `silent` NON è metodo, è livello che rende no-op tutto (ConsoleLogger plan 04).
- `packages/core/src/types/tap.ts` — `PipelineStep` union 5 step F1 (D-20). `PipelineSnapshot` con `eventId`, `topic`, `step`, `timestamp`, `durationMs` readonly + `payloadBefore?`, `payloadAfter?`, `metadata?` opzionali. `EventTap.onPipelineStep(step, snapshot): void` — sync, no return, errors swallowed. Pre-instrumentato F1 (vincolo critico ARCHITECTURE.md §3.2).
- `packages/core/src/types/config.ts` — `BrokerConfig` con sezioni F1 strutturate (`runtime?: { debug?, deepFreezeInDev?, logLevel?, logger?, tap? }`, `debug?: { enabled?, snapshotPayloadsFull? }`) + 8 sezioni placeholder F2-F6 tipate `unknown` (CORE-14).
- `packages/core/src/types/index.ts` — barrel `export type` di tutti i 20 tipi pubblici. Tipi interni esclusi.

## Files Modified

- `packages/core/src/index.ts` — sostituito `export {}` placeholder con `export type * from './types'`. Decisione Rule 2: senza questa modifica i plan paralleli 04/05/06 non possono importare via `from '@sembridge/core'` e il `dist/index.d.ts` resta a 13B (placeholder). Plan 08 aggiungerà i runtime export (`createBroker`, `Broker`, ecc.) accanto a questo barrel di tipi.

## Verification Results

### Acceptance criteria Task 1
- [x] `packages/core/src/types/deep-readonly.ts` esporta `type DeepReadonly<T>` con conditional su Date/Map/Set/Array/object
- [x] `packages/core/src/types/broker-event.ts` esporta `BrokerEvent<TPayload = unknown>`, `EventSource`, `DeliveryMode`, `Priority`, `EventId`
- [x] `BrokerEvent.id`, `topic`, `timestamp`, `source` sono `readonly` non-optional (CORE-07 enforcement type-level)
- [x] `BrokerEvent.payload` ha tipo `DeepReadonly<TPayload>`
- [x] `EventSource.type` union `'plugin' | 'component' | 'server' | 'worker' | 'system'`
- [x] `EventSource.id` readonly string non-optional
- [x] `DeliveryMode` esattamente 4 valori `'sync' | 'async' | 'worker' | 'remote'`
- [x] `Priority` esattamente 4 valori `'low' | 'normal' | 'high' | 'critical'`
- [x] `EventId` branded type (`string & { readonly [unique symbol]: true }`)
- [x] `Subscription` con `unsubscribe(): void`, `readonly id`, `readonly topic`, `readonly active`
- [x] `SubscribeOptions` include `signal?: AbortSignal`, `priority?: 'low' | 'normal' | 'high'`, `deliveryMode?: 'sync' | 'async'`, `once?: boolean`
- [x] `pnpm --filter @sembridge/core typecheck` esce 0

### Acceptance criteria Task 2
- [x] `BrokerError extends Error` con 8 campi readonly (`code`, `category`, `details?`, `originalError?`, `routeId?`, `topic?`, `eventId?` + `message` ereditato)
- [x] `ErrorCategory` 9 union members (`validation | plugin | mapping | route | network | worker | system | config | topic`)
- [x] `CreateBrokerErrorParams` con `code`, `category`, `message` (richiesti) + `details?`, `originalError?`, `routeId?`, `topic?`, `eventId?` (opzionali)
- [x] `LogLevel` esattamente 6 valori `silent | error | warn | info | debug | trace`
- [x] `BrokerLogger` 5 metodi `error/warn/info/debug/trace` con firma `(message: string, meta?: Record<string, unknown>): void`
- [x] `PluginState` 8 stati (`unregistered | registered | mounting | mounted | unmounting | unmounted | failed | destroyed`)
- [x] `PluginDescriptor` con `id: string` readonly + 4 hook opzionali (CORE-05)
- [x] `PluginContext` con `id`, `logger: BrokerLogger`, `broker: unknown` (placeholder), `signal: AbortSignal`
- [x] Registration record exported da `plugin.ts` MA NON re-exported da `types/index.ts`
- [x] `pnpm --filter @sembridge/core typecheck` esce 0

### Acceptance criteria Task 3
- [x] `PipelineStep` esattamente 5 valori F1 (`event.received | event.metadata.enriched | event.validated | event.dedupe.checked | event.delivered`)
- [x] `PipelineSnapshot` con `eventId`, `topic`, `step`, `timestamp`, `durationMs` readonly + `payloadBefore?`, `payloadAfter?`, `metadata?` opzionali
- [x] `EventTap.onPipelineStep(step: PipelineStep, snapshot: PipelineSnapshot): void`
- [x] `BrokerConfig` con `runtime?`, `debug?` strutturate + 8 sezioni placeholder `unknown` (CORE-14 — `topicSchemas`, `canonicalModel`, `aliasRegistry`, `transforms`, `routes`, `transport`, `workers`, `cache`)
- [x] `BrokerConfig.runtime` ha `debug?`, `deepFreezeInDev?`, `logLevel?: LogLevel`, `logger?: BrokerLogger`, `tap?: EventTap`
- [x] `types/index.ts` re-esporta TUTTI i 20 tipi pubblici via `export type`
- [x] `types/index.ts` NON re-esporta il registration record interno
- [x] Tutti gli export usano `export type` (compatibile con `verbatimModuleSyntax: true`)
- [x] `pnpm --filter @sembridge/core typecheck` esce 0
- [x] `pnpm biome check packages/core/src/types/` esce 0

### Build verification (success criterion utente)
- [x] `pnpm --filter @sembridge/core build` esce 0
- [x] `dist/index.d.ts` 4.53 KB (cresciuto da 13 B placeholder)
- [x] `dist/index.d.ts` esporta i 20 tipi pubblici via `export type {...}` consolidato
- [x] `dist/index.d.ts` NON contiene il registration record interno (verificato via `grep -L`)

## Output finale `pnpm --filter @sembridge/core build`

```
CLI Building entry: src/index.ts
CLI Using tsconfig: tsconfig.json
CLI tsup v8.5.1
CLI Target: es2022
ESM dist/index.js     68.00 B
ESM dist/index.js.map 69.00 B
ESM ⚡️ Build success in 12ms
DTS Build start
DTS ⚡️ Build success in 198ms
DTS dist/index.d.ts 4.53 KB
```

`dist/index.d.ts` (footer):
```ts
export type { BrokerConfig, BrokerError, BrokerEvent, BrokerLogger, CreateBrokerErrorParams,
  DeepReadonly, DeliveryMode, ErrorCategory, EventId, EventSource, EventTap, LogLevel,
  PipelineSnapshot, PipelineStep, PluginContext, PluginDescriptor, PluginState, Priority,
  SubscribeOptions, Subscription }
```

20 tipi pubblici esposti. Registration record interno correttamente assente.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Cambio `ReadonlyArray<DeepReadonly<U>>` in `readonly DeepReadonly<U>[]`**

- **Found during:** Task 3 — `pnpm biome check packages/core/src/types/`
- **Issue:** Biome lint rule `style/useConsistentArrayType` (configurata `"syntax": "shorthand"` in `biome.json`) richiede shorthand `readonly T[]` invece di `ReadonlyArray<T>`. Il codice verbatim della RESEARCH usava la forma `ReadonlyArray<DeepReadonly<U>>` che falliva il lint check (errore non-fixable automaticamente perché Biome lo segnala come "Unsafe fix").
- **Fix:** Cambiato `: T extends Array<infer U> ? ReadonlyArray<DeepReadonly<U>> : ...` in `: T extends Array<infer U> ? readonly DeepReadonly<U>[] : ...`. Semantica TypeScript identica.
- **Files modified:** `packages/core/src/types/deep-readonly.ts`
- **Commit:** `7b01f82`

**2. [Rule 1 - Bug] Riformattato blocco future-step in `tap.ts` da union-trailing-comments a comment-block pre-type**

- **Found during:** Task 3 — `pnpm biome check packages/core/src/types/`
- **Issue:** Biome formatter rifiutava i commenti trailing all'interno dell'union type expression (snippet RESEARCH originale aveva `// F2/F3 will add: ...` indentati a 2 spaces dopo `| 'event.delivered'`). Biome voleva il commento-block a column 0 perché tecnicamente il `=` block termina con l'ultima `|`. Errore di format check (non lint).
- **Fix:** Spostato il blocco future-step come comment header sopra `export type PipelineStep = ...`. Stessa informazione preservata: F2/F3 aggiungono 8 step (steps 4, 5, 6, 8, 9, 10, 11, 12), F6 aggiunge 1 step (step 14). Le union iniziano direttamente con `| 'event.received'` senza commento intra-expression.
- **Files modified:** `packages/core/src/types/tap.ts`
- **Commit:** `7b01f82`

### Auto-added Critical Functionality

**3. [Rule 2 - Missing critical] Aggiunto `export type * from './types'` a `packages/core/src/index.ts`**

- **Found during:** Task 3 — verifica build artifacts
- **Issue:** Il plan 03 dichiarava `files_modified` solo i 9 file `types/*.ts`. Senza modificare `src/index.ts`, il `dist/index.d.ts` restava a 13 B placeholder (`export {}`) e i 20 tipi pubblici NON erano accessibili tramite `from '@sembridge/core'`. I plan paralleli 04/05/06 (Wave 3) NON potrebbero importare i tipi via package name come previsto da PROJECT.md / RESEARCH. Inoltre il success criterion utente "build produce dist/index.d.ts con i nuovi types esportati" non sarebbe stato soddisfatto.
- **Fix:** Sostituito `export {}` con `export type * from './types'` in `packages/core/src/index.ts`. Re-export type-only del barrel. Plan 08 aggiungerà i runtime export (`createBroker`, `Broker`, `createBrokerError`, `ConsoleLogger`, ecc.) accanto a questo barrel di tipi senza breaking change.
- **Rationale:** correctness requirement — il package non sarebbe utilizzabile dai plan paralleli senza questo re-export. Il plan 08 (Wave 4) era previsto per "espone l'API pubblica completa" — questa modifica espone solo i tipi (con un commento esplicito `Plan 08 aggiungerà i runtime export`), non tocca runtime.
- **Files modified:** `packages/core/src/index.ts`
- **Commit:** `7b01f82`

### Architectural Decisions

Nessuna — nessuna deviation Rule 4 incontrata. Le tre deviations sopra sono Rule 1 (lint/format bug determinabili) e Rule 2 (correctness gap nel plan).

## Authentication Gates

Nessun auth gate incontrato durante l'esecuzione (operazioni esclusivamente locali: edit file, lint, typecheck, build, git commit).

## Threat Surface Scan

Nessuna nuova trust boundary o surface security-relevant introdotta oltre a quelle già documentate nel `<threat_model>` del plan (T-03-01..T-03-04). Mitigazioni applicate:

- **T-03-01** (registration record esposto come public API): `types/index.ts` esclude esplicitamente il tipo interno; verificato via `! grep -q "PluginRegistration" packages/core/src/types/index.ts` e `! grep -q "PluginRegistration" packages/core/dist/index.d.ts` ✓
- **T-03-02** (type contracts cambiati silenziosamente in F2-F6): `BrokerConfig` sezioni F2-F6 dichiarate come `unknown` (tolerant placeholder) — extension via declaration merging non-breaking ✓
- **T-03-03** (payload mutation type-bypass): `BrokerEvent.payload: DeepReadonly<TPayload>` propaga readonly a tutti i livelli (compile-time enforcement); runtime enforcement via deep-freeze in plan 04 ✓
- **T-03-04** (branded types bypass): `EventId` branded con `unique symbol __eventIdBrand` non instanziabile esternamente — solo cast esplicito `as EventId` (intenzionale, audit-able via grep) ✓

## Planner Decisions Confermate

- **SubscribeOptions.once incluso** (RESEARCH Open Question 1) — costo runtime ~15 LOC in `bus.ts` (decremento `active` dopo prima delivery), valore DX significativo, nessun REQ-ID lo vieta. Plan 07 lo implementerà.
- **PluginContext.broker tipato `unknown` provvisoriamente** — Plan 03 NON dispone ancora di `core/broker.ts` (creato in plan 08). Plan 08 risolverà via TypeScript declaration merging o re-typing per esporre la firma reale di `Broker`.

## Ready For

**Wave 3 — plan 04, 05, 06 paralleli** (utility moduli senza file overlap):

- **Plan 04** (Utility batch A): `broker-error.ts` (factory + costanti `ERR_CODES`), `deep-freeze.ts`, `console-logger.ts`, `event-tap.ts` (NoopEventTap)
- **Plan 05** (Utility batch B): `topic-matcher.ts` (Trie segmentato D-08/09/10/11), `event-factory.ts`, `event-validator.ts`
- **Plan 06** (Utility batch C): `topic-registry.ts`, `subscriber-registry.ts`, `lifecycle.ts` (state machine D-25/26)

Tutti i plan paralleli importeranno i tipi da `@sembridge/core/types` (via path interno) o `from '@sembridge/core'` (via barrel — funzionante post-plan-03 grazie a Rule 2 deviation).

## Self-Check: PASSED

**Files verified (created):**
- FOUND: `packages/core/src/types/broker-event.ts`
- FOUND: `packages/core/src/types/deep-readonly.ts`
- FOUND: `packages/core/src/types/subscription.ts`
- FOUND: `packages/core/src/types/plugin.ts`
- FOUND: `packages/core/src/types/error.ts`
- FOUND: `packages/core/src/types/logger.ts`
- FOUND: `packages/core/src/types/tap.ts`
- FOUND: `packages/core/src/types/config.ts`
- FOUND: `packages/core/src/types/index.ts`

**Files verified (modified):**
- FOUND: `packages/core/src/index.ts` (sostituito `export {}` con `export type * from './types'`)

**Build artifacts verified (gitignored, regenerable):**
- FOUND: `packages/core/dist/index.d.ts` 4.53 KB con i 20 tipi pubblici
- FOUND: `packages/core/dist/index.js` 68 B (placeholder runtime, plan 08 lo popolerà)

**Commits verified:**
- FOUND: `ebd126a` (feat(01-03): aggiunge tipi event/payload — BrokerEvent + DeepReadonly + Subscription)
- FOUND: `7d4ff8a` (feat(01-03): aggiunge tipi plugin/error/logger — BrokerError + BrokerLogger + PluginDescriptor)
- FOUND: `7b01f82` (feat(01-03): aggiunge tipi tap/config + barrel re-export hub)
