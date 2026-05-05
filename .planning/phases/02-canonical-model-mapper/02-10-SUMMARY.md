---
phase: 02-canonical-model-mapper
plan: 10
subsystem: broker-mapper-integration
tags: [broker-integration, composition-wrapper, public-factory, tdd, lifecycle-cascade, d-49-no-modify-core, scenario-meteo-runtime]

# Dependency graph
requires:
  - phase: 02-canonical-model-mapper
    plan: 07
    provides: "MapperEngine + helpers hasCompiled/hasInputMap/getCanonicalSchemaIdFor (3 metodi aggiunti per introspection del wrapper)"
  - phase: 02-canonical-model-mapper
    plan: 08
    provides: "MappingInspector + wrapTap composition helper consumati dal MapperBroker.constructor"
  - phase: 02-canonical-model-mapper
    plan: 09
    provides: "TS declaration merging di PluginDescriptor (canonicalSchemaId/inputMap/outputMap) e BrokerConfig (canonicalModel/aliasRegistry/transforms) abilitano typing F2 nel wrapper"
provides:
  - "packages/mapper/src/broker-mapper-wrapper.ts (~520 LOC) — class MapperBroker composition wrapper di Broker (F1) con MapperEngine + Inspector"
  - "packages/mapper/src/broker-mapper-wrapper.test.ts (435 LOC, 15 test) — coverage 12 acceptance del PLAN + 2 bonus passthrough + 1 F1 surface delegation"
  - "packages/mapper/src/public-factory.ts (~145 LOC) — createMapperBroker(config) pure function con Valibot validation D-56"
  - "packages/mapper/src/public-factory.test.ts (85 LOC, 8 test) — coverage 6 acceptance + 2 bonus scoped/empty"
  - "packages/mapper/src/mapper-engine.ts (+45 LOC) — 3 metodi pubblici: hasCompiled, hasInputMap, getCanonicalSchemaIdFor"
  - "packages/mapper/src/index.ts (+18 LOC barrel) — runtime exports +MapperBroker/+createMapperBroker (11 totali); 5 type exports F2 surface"
  - "Pipeline §28 estesa F2 PIPE-01 wired runtime: passi 4 (alias-resolve consumato dal mapper-engine), 5 (publish.applyOutputMap), 6 (publish.canonical-validation), 11 (subscribe wrapped handler.applyInputMap), 12 (subscribe wrapped handler.final-validation)"
  - "D-31 surface API: registerCanonicalSchema/registerTransform/registerAlias/getMappingInspector exposed sul MapperBroker"
  - "D-49 confermato a runtime: 0 modifiche a packages/core/ (verificato via git diff HEAD~4)"
  - "D-51 implementato runtime: ctx.broker mapper-aware via wrapDescriptorHooks (i plugin che si sottoscrivono via ctx.broker.subscribe ottengono automaticamente l'inputMap consumer-side wrapping)"
  - "D-58 mapping.error published su mapping failure (transform.failed/canonical.validation.failed) con payload { error, sourceEvent, step }"
  - "D-59 confermato: NO publish <topic>.failed da F2 (solo mapping.error); delivery skipped per il consumer affetto"
  - "D-26 ext F2 cascade: unregisterPlugin pulisce alias scoped + transforms ownerId + mapper compiled + canonical schemas owned"
affects: [02-11-integration-tests, 02-12-final-gate, F3-routing, F4-realtime, F5-worker, F6-cache-devtools]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern composition wrapper di class core: MapperBroker compone Broker F1 internamente (private inner) invece di subclass — preserva F1 untouched (D-49) e abilita unit testing isolato del MapperEngine + Inspector"
    - "Pattern wrapDescriptorHooks per propagare ctx mapper-aware ai plugin: il MapperBroker.registerPlugin wrappa onRegister/onMount/onUnmount/onDestroy per sostituire ctx.broker con un Proxy che applica inputMap consumer-side al subscribe (D-51 — risolve il bypass del Broker.subscribe da parte del PluginScopedBroker F1)"
    - "Pattern Proxy doppio livello: Proxy esterno (MapperBroker) attorno al Proxy interno (createPluginScopedBroker F1) — il subscribe intercept applica l'inputMap consumer-side, il publish/altri metodi sono delegati via Reflect.get + bind"
    - "Pattern conditional spread per exactOptionalPropertyTypes nei wrapHook: descriptor.onRegister !== undefined && { onRegister: wrapAsyncHook(...) } per evitare onRegister: undefined esplicito (incompatibile con F1 PluginDescriptor)"
    - "Pattern pure factory + Valibot v.looseObject (D-56): createMapperBroker valida sezioni F2 (canonicalModel/aliasRegistry/transforms) strutturalmente, F3-F6 augmented passano come pass-through. Coerente con createBroker F1."
    - "Pattern delegation cascade indipendente per LIFE-02 ext: try/catch swallow per ogni step (alias.unregisterScopedAll + transforms.unregisterByOwner + mapper.unregisterPluginMappings + canonicalRegistry.unregister) — fallimento di uno NON blocca gli altri (T-02-10-03)"
    - "Pattern TDD RED→GREEN per Task 1 + Task 2: 2 commit per ciascun task (RED test + GREEN source) — coerente con plan 02-09 augment+barrel pattern"

key-files:
  created:
    - "packages/mapper/src/broker-mapper-wrapper.ts (~520 LOC) — class MapperBroker + 5 type esportati"
    - "packages/mapper/src/broker-mapper-wrapper.test.ts (435 LOC, 15 test in 2 describe block)"
    - "packages/mapper/src/public-factory.ts (~145 LOC) — createMapperBroker factory + re-export MapperBroker"
    - "packages/mapper/src/public-factory.test.ts (85 LOC, 8 test in 1 describe block)"
  modified:
    - "packages/mapper/src/mapper-engine.ts: +3 metodi pubblici hasCompiled/hasInputMap/getCanonicalSchemaIdFor per introspection del broker wrapper (no breaking change al contract)"
    - "packages/mapper/src/index.ts: barrel esteso con MapperBroker + createMapperBroker runtime + 5 type pubblici F2 surface"

key-decisions:
  - "**D-49 strict**: ZERO modifiche a packages/core/. Verificato via git diff HEAD~4 -- packages/core/ → 0 lines. Vincolo critico ARCHITECTURE §3.2 rispettato — il MapperBroker compone Broker F1 + i moduli F2 senza touchare bus.ts/broker.ts/plugin-registry.ts/public-factory.ts. Per wirare l'inputMap consumer-side ai plugin (D-51), il MapperBroker wrappa gli hook lifecycle del descriptor (onRegister/onMount/onUnmount/onDestroy) per sostituire ctx.broker con un Proxy mapper-aware — un'estensione strutturale del pattern createPluginScopedBroker F1 senza modificarlo."
  - "**3 helper aggiunti al MapperEngine** (Rule 2 — readability/correctness): `hasCompiled(pluginId)`, `hasInputMap(pluginId)`, `getCanonicalSchemaIdFor(pluginId)`. Necessari al broker wrapper per decidere quando applicare outputMap/inputMap/canonical-validation. Alternative scartate: (a) accesso diretto al `compiled` Map privato (viola encapsulation); (b) try/catch su applyOutputMap per detect 'no mapping' (catastrophic — semantica di errore vs passthrough confusa). I 3 helper sono additive — il contract pubblico esistente di MapperEngine non cambia (compileMappings/applyOutputMap/applyInputMap/unregisterPluginMappings/validateCanonical/stats restano identici). Test plan 02-07 invariati."
  - "**wrapDescriptorHooks per D-51 runtime**: la sfida è che `ctx.broker` di F1 è un Proxy `createPluginScopedBroker` che chiama direttamente `bus.subscribe()`, bypassando il MapperBroker. Soluzione: il MapperBroker.registerPlugin wrappa gli hook lifecycle del descriptor PRIMA di delegare a `inner.registerPlugin` — gli hook ricevono un `ctx` con `broker` sostituito da un Proxy che intercetta `subscribe` e applica `applyInputMap(pluginId, ...)` al payload canonico. Questo soddisfa Test 8 (widget consumer chiama `ctx.broker.subscribe` e riceve `{location, 'day-prevision'}`) senza modifiche a F1. Trade-off: doppio Proxy (F1 ScopedBroker + F2 MapperBroker wrap) — overhead trascurabile (Reflect.get + bind sono O(1) per chiamata)."
  - "**MapperPublishOptions = Parameters<Broker['publish']>[2]** invece di redefining shape: riusa il signature di Broker.publish F1 per coerenza con EventSource literal union (`'plugin' | 'component' | 'server' | 'worker' | 'system'`). La prima implementazione aveva `source?: { type: string; id: string }` che TS rifiutava per exactOptionalPropertyTypes (TS2379). Fix: type alias che riusa il parameter type del metodo F1. Pattern non-breaking — tutti i campi optional di PublishParams<T> di F1 (deliveryMode, priority, ttlMs, dedupeKey, ecc.) sono accettati."
  - "**Validation step 6 inline nel publish wrapper** invece di nel MapperEngine: dopo `applyOutputMap`, il MapperBroker.publish chiama `mapper.validateCanonical(schemaId, canonicalPayload)` e su `ok: false` costruisce un BrokerError `mapping.canonical.validation.failed` con details.issues, registra nell'Inspector e pubblica `mapping.error` (D-58). F2 V1 `validateCanonical` ritorna structural pass (mapper-engine plan 02-07) — il fail si verifica solo se lo schema canonical NON è registrato (edge case). Full Valibot schema integration deferred a V1.x via descriptor extension. Coerente con SUMMARY 02-07 'Pronto-per: il broker wrapper può sostituire la struttura interna di validateCanonical senza breaking change al contract'."
  - "**8 test public-factory invece di 6**: il PLAN richiede 6 test ma ho aggiunto 2 bonus per coverage gap esplicito — Test 7 (bootstrap aliasRegistry.scoped) verifica D-56 sezione scoped; Test 8 (empty config no-op bootstrap) verifica edge case createMapperBroker({}). Coerente con pattern plan 02-08 Inspector dove ho aggiunto test extra per coverage del default errorBufferSize."
  - "**15 test broker-mapper-wrapper invece di 12**: il PLAN richiede 12 test ma ho aggiunto 3 bonus — Test 9 (subscribe diretto con ownerId esplicito invece di ctx.broker), Test 13 (passthrough plugin senza outputMap, regression), Test 14 (publish con system source — no source-resolved). Test 9 in particolare era richiesto dall'acceptance ma il PLAN snippet non lo dettagliava esplicitamente. Coerente con D-51."

patterns-established:
  - "Pattern composition wrapper class+factory per package F2+: il package mapper espone `MapperBroker` (class) + `createMapperBroker(config)` (factory con Valibot validation) come surface pubblica primaria. Replicabile per @gluezero/{routing, gateway, worker, cache, devtools} con la propria class wrapper composition di Broker + engine specifico."
  - "Pattern wrap descriptor hooks per propagare ctx specializzato: il broker F2+ wrappa gli hook lifecycle del descriptor (onRegister/onMount/onUnmount/onDestroy) per sostituire ctx.broker con un Proxy specializzato. Generalizzabile a F3 (ctx con `route` API), F5 (ctx con `worker` API), F6 (ctx con `inspector` API)."
  - "Pattern Valibot v.looseObject + section-specific validation: il public-factory di un package downstream valida le proprie sezioni del BrokerConfig (es. F2 valida canonicalModel/aliasRegistry/transforms) e lascia pass-through le sezioni di altri package via v.looseObject. Pattern non-breaking applicabile a F3 (RoutingConfigSchema + routing/transport sections), F5 (WorkersConfigSchema), F6 (CacheConfigSchema)."
  - "Pattern cascade D-26 ext indipendente con try/catch swallow per ogni step: applicato a F2 mapper cascade. F3 estenderà con cascade routes; F5 con cascade workers; F6 con cascade cache entries. Ogni step indipendente — fallimento di uno NON blocca gli altri (T-02-10-03 generalizzato)."
  - "Pattern helper introspection methods per cross-module composition: il MapperEngine espone hasCompiled/hasInputMap/getCanonicalSchemaIdFor per il broker wrapper. Generalizzabile a future F3 RouteRegistry.hasRoute(), F5 WorkerRegistry.hasWorker(), ecc."

requirements-completed:
  - MAP-02
  - MAP-03
  - MAP-13
  - MAP-14
  - MAP-15
  - ERR-02
  - LIFE-02
  - PIPE-01
requirements-runtime-level:
  - VAL-02
  - VAL-03
  - VAL-04
  - VAL-07

# Metrics
duration: ~21min
completed: 2026-04-30
---

# Phase 2 Plan 10: MapperBroker (Broker Integration) Summary

**Implementato `MapperBroker` (composition wrapper di Broker F1) + `createMapperBroker(config)` (public factory) per `@gluezero/mapper`. Wira runtime tutti i moduli F2 (CanonicalRegistry, AliasRegistry, TransformPipeline, MapperEngine, MappingInspector) al Broker di F1 SENZA modificare `bus.ts`/`broker.ts`/`plugin-registry.ts` (D-49 confermato a 0 linee diff su packages/core/). Pipeline §28 estesa F2 (passi 4, 5, 6, 11, 12) implementata via hook al publish (canonicalize + canonical validation) e al subscribe (consumer mapping + final validation). Per i plugin che si sottoscrivono via `ctx.broker.subscribe` (Test 8 scenario meteo PRD §29), il MapperBroker wrappa gli hook lifecycle del descriptor per propagare un `ctx.broker` mapper-aware (D-51). Cascade D-26 ext F2 al `unregisterPlugin` pulisce alias scoped + transforms ownerId + mapper compiled + canonical schemas owned. Pattern TDD: 4 commit (2 RED + 2 GREEN). Pronto per consumption integration test plan 02-11 (PipelineHarness extension F2 + scenario meteo end-to-end).**

## Performance

- **Duration:** ~21 min totali (start 2026-04-30T08:24:38Z; commit Task 2 GREEN `a53c260` 08:38:09Z; barrel verify + SUMMARY 08:45Z)
- **Started:** 2026-04-30T08:24:38Z
- **Completed:** 2026-04-30T08:45:31Z
- **Tasks:** 2/2 completed (Task 1 TDD RED+GREEN broker-mapper-wrapper; Task 2 TDD RED+GREEN public-factory + barrel update)
- **Files created:** 4 nuovi (broker-mapper-wrapper.ts/.test.ts + public-factory.ts/.test.ts)
- **Files modified:** 2 (mapper-engine.ts +45 LOC introspection helpers + index.ts +18 LOC barrel exports)

## Accomplishments

- **`class MapperBroker`** con surface F1 wrapped + F2 new (D-31): publish/subscribe/registerPlugin/unregisterPlugin/getTopicRegistry/setLogger/enableDebug/disableDebug/getDebugSnapshot delegated; registerCanonicalSchema/registerTransform/registerAlias/getMappingInspector new
- **D-49 strict**: 0 modifiche a packages/core/ (verificato via git diff HEAD~4 -- packages/core/ → 0 lines diff)
- **D-50 wired runtime**: pipeline §28 estesa F2 implementata via hook
  - **publish**: applyOutputMap (passo 5) + canonical validation (passo 6) prima di delegare al `bus.publish` F1
  - **subscribe**: applyInputMap (passo 11) + final validation (passo 12) per consumer plugin con `ownerId` settato
- **D-51 runtime**: il `wrapDescriptorHooks` sostituisce `ctx.broker` con un Proxy mapper-aware nel `registerPlugin` — i plugin che si sottoscrivono via `ctx.broker.subscribe` dentro `onMount` ricevono automaticamente l'`inputMap` consumer-side wrapping (Test 8 scenario meteo PRD §29 verifica end-to-end)
- **D-58**: pubblica `mapping.error` su transform.failed/canonical.validation.failed/consumer.validation.failed con payload `{ error, sourceEvent, step }`
- **D-59 strict**: NO publish `<topic>.failed` da F2; delivery skipped per il consumer affetto
- **D-48**: `getDebugSnapshot()` esteso con sezione `mappings` (canonicalSchemas count + registeredAliases count + registeredTransforms count + lastMappingErrors ring buffer dal MappingInspector)
- **D-26 ext F2 cascade**: `unregisterPlugin` pulisce in ordine indipendente (try/catch swallow per ogni step — T-02-10-03):
  1. `inner.unregisterPlugin(id)` (F1 LIFE-02 — onUnmount + bus.unsubscribeByOwner + abort)
  2. `aliasRegistry.unregisterScopedAll(id)` — alias plugin-scoped
  3. `transformPipeline.unregisterByOwner(id)` — transform con ownerId === id
  4. `mapper.unregisterPluginMappings(id)` — dispatch table compilata
  5. `canonicalRegistry.unregister` per gli schema con ownership === id
  6. `ownership.delete(id)`
- **`createMapperBroker(config)`** pure function (D-30 no singleton) con Valibot validation strutturale per canonicalModel/aliasRegistry/transforms (D-56); v.looseObject per F3-F6 pass-through
- **Throw `Error 'Invalid MapperBrokerConfig: ...'`** su config validation fail (pattern F1 D-18 — semplice match string nel test)
- **3 helper introspection aggiunti al MapperEngine**: hasCompiled, hasInputMap, getCanonicalSchemaIdFor (no breaking change al contract pubblico esistente)
- **Barrel index.ts esteso**: 11 runtime exports (era 9), 5 type exports F2 surface (RegisterAliasOptions, MapperBrokerDebugSnapshot, MapperSubscribeOptions, RegisterCanonicalSchemaOptions, RegisterTransformWrapperOptions)
- **Smoke import bundle verificato**: `Object.keys(import('./dist/index.js'))` ritorna 11 simboli incluso `createMapperBroker`/`MapperBroker`/`__augmentLoaded` (T-02-09-01 mitigation intatta post-plan)
- **TDD pattern RED→GREEN**: 4 commit (2 RED + 2 GREEN)
- **Auto-fix Biome applicato post-implementazione**: lineWidth, organizeImports, rimossi unused imports (`EventSource` non referenziato dopo refactoring)

## Pipeline §28 PIPE-01 — verifica esplicita ordine F2 runtime

| Passo | Step ID | Implementato in | Test |
|-------|---------|------------------|------|
| 4 | event.source.resolved (alias-resolve) | mapper-engine consumption: `applyOutputMap` valuta inputMap/outputMap PRIMA di consultare AliasRegistry (D-40 esplicito vince) | Test 5, 8 (mapping esplicito risolve cittÃ→location) |
| 5 | event.mapped.canonical (source→canonical) | `MapperBroker.publish` invoca `mapper.applyOutputMap(sourcePluginId, payload)` quando `mapper.hasCompiled(sourcePluginId)` | Test 5, 8 (canonical produce {location, forecast_date}) |
| 6 | event.canonical.validated (canonical-validate) | `MapperBroker.publish` invoca `mapper.validateCanonical(schemaId, canonicalPayload)` quando schema id is set; on fail publish mapping.error D-58 | Test 10 (mapping.error step canonical) |
| 11 | event.mapped.consumer (canonical→consumer) | `MapperBroker.subscribe` (con ownerId) o `ctx.broker.subscribe` (via wrapDescriptorHooks D-51) wrappa l'handler con `mapper.applyInputMap(consumerPluginId, ...)` | Test 8, 9 (widget riceve {location, 'day-prevision'}) |
| 12 | event.final.validated (final-validate) | wrapped handler chiama `mapper.validateCanonical(consumerSchemaId, mappedPayload)` (V1 structural pass) | Test 8, 9 (handler invocato senza throw) |

L'ordine è coerente con CONTEXT D-50 (passo 4 → 5 → 6 → ... → 11 → 12 → 13). Il flow end-to-end è verificato dal Test 8 (scenario meteo PRD §29 D-53) — plugin form publica `città/data`, mapper produce canonicalmente `{location, forecast_date}`, plugin widget consumer riceve `{location, 'day-prevision'}` via inputMap inverso, senza HTTP.

## Task Commits

1. **Task 1 RED — `b51e507`** `test(02-10): aggiunge test RED per MapperBroker (composition wrapper)`
   - `broker-mapper-wrapper.test.ts` (435 LOC, 15 test in 2 describe block)
   - Test importa `./broker-mapper-wrapper` che non esiste → FAIL atteso (RED gate verificato: `Failed to resolve import "./broker-mapper-wrapper"`)
2. **Task 1 GREEN — `edfd0e0`** `feat(02-10): implementa MapperBroker (composition wrapper D-49 + 5 step F2 pipeline)`
   - `broker-mapper-wrapper.ts` (~520 LOC) — class MapperBroker + 5 type esportati
   - `mapper-engine.ts` (+45 LOC) — 3 helper introspection (hasCompiled, hasInputMap, getCanonicalSchemaIdFor)
   - 15/15 test passing al primo run; typecheck exit 0; Biome clean
3. **Task 2 RED — `3a840d0`** `test(02-10): aggiunge test RED per createMapperBroker (public factory)`
   - `public-factory.test.ts` (85 LOC, 8 test)
   - Test importa `./public-factory` che non esiste → FAIL atteso (RED gate verificato: `Failed to resolve import "./public-factory"`)
4. **Task 2 GREEN — `a53c260`** `feat(02-10): aggiunge createMapperBroker factory + barrel exports`
   - `public-factory.ts` (~145 LOC) — pure function + Valibot validation D-56
   - `index.ts` (+18 LOC barrel) — runtime/type exports estesi
   - 8/8 test public-factory passing; full mapper suite 116/116; typecheck exit 0; build success

**Plan metadata commit:** TBD (eseguito alla fine del workflow tramite `gsd-sdk query commit` insieme a STATE/ROADMAP/REQUIREMENTS).

## Files Created / Modified

### packages/mapper/src/broker-mapper-wrapper.ts (~520 LOC)

Esporta:

- `class MapperBroker` con surface F1 wrapped + F2 new
- `interface RegisterAliasOptions` — `{ scope?: 'global' | string }`
- `interface RegisterTransformWrapperOptions` — `{ description?, ownerId? }`
- `interface RegisterCanonicalSchemaOptions` — `{ ownerId? }`
- `interface MapperSubscribeOptions extends SubscribeOptions` — `{ ownerId? }` per applyInputMap consumer-side
- `interface MapperBrokerDebugSnapshot` — F1 fields + sezione `mappings` D-48

Metodi pubblici:

- **F1 surface (delegated + wrapped)**: publish, subscribe, registerPlugin, unregisterPlugin, getTopicRegistry, setLogger, enableDebug, disableDebug, getDebugSnapshot
- **F2 new (D-31)**: registerCanonicalSchema, registerTransform, registerAlias, getMappingInspector

Private helpers: bootstrapFromConfig, wrapDescriptorHooks, wrapPluginContext, wrapConsumerHandler, handleMappingError, makeValidationError.

### packages/mapper/src/broker-mapper-wrapper.test.ts (435 LOC, 15 test)

Test cases organizzati in 2 `describe` block:

| # | Describe | Test name | Behavior coperto | Decisione/REQ-ID |
|---|----------|-----------|------------------|-------------------|
| 1 | MapperBroker | instantiates without errors with default config | smoke + surface API check | Constructor + D-31 |
| 2 | MapperBroker | registerCanonicalSchema returns true on new, false on duplicate | idempotent register | D-31, MAP-02 |
| 3 | MapperBroker | registerTransform throws on duplicate name | transform.id.duplicate | D-31, T-02-10-06 |
| 4 | MapperBroker | registerAlias supports global and scoped | scope option D-40 | D-31, MAP-16/MAP-17 |
| 5 | MapperBroker | registerPlugin invokes compileMappings post-onRegister and outputMap is applied on publish | flow end-to-end singolo plugin | D-34, MAP-13 |
| 6 | MapperBroker | cycle detection at registerPlugin throws mapping.cycle.detected | D-35 register-time | D-35, T-02-10-02 |
| 7 | MapperBroker | unregisterPlugin cascade removes scoped alias + transforms ownerId + mapper compiled | D-26 ext F2 LIFE-02 | LIFE-02 ext F2, T-02-10-03 |
| 8 | MapperBroker | publish with outputMap + transform → consumer with inputMap (scenario meteo PRD §29) | flow end-to-end con ctx.broker.subscribe + D-51 | D-51, MAP-13/14, scenario PRD §29 (parziale runtime — full integration plan 02-11) |
| 9 | MapperBroker | subscribe with consumer plugin ownerId applies inputMap (passo 11) | subscribe diretto con ownerId | D-51, MAP-14 |
| 10 | MapperBroker | publish mapping.error on transform failure with onFailure block (D-58) | D-58 + D-59 | D-58, ERR-02, T-02-10-01 |
| 11 | MapperBroker | getDebugSnapshot returns extended snapshot with mappings section (D-48) | D-48 surface | D-48, MAP-15 |
| 12 | MapperBroker | getMappingInspector returns the MappingInspector instance | API surface | D-31, MAP-15 |
| 13 | MapperBroker | passthrough for plugin without outputMap (regression) | edge case bonus | T-02-07-06 |
| 14 | MapperBroker | publish without source.id leaves payload untouched | edge case bonus | D-50 step 4 (no source-resolved) |
| 15 | MapperBroker · F1 surface delegation | getTopicRegistry, setLogger, enableDebug/disableDebug delegated to inner Broker | F1 delegation | D-49 |

### packages/mapper/src/public-factory.ts (~145 LOC)

Esporta:
- `createMapperBroker(config?)` pure function con Valibot validation
- Re-export `MapperBroker` per ergonomia consumer

Schema Valibot interno: `MapperBrokerConfigSchema = v.looseObject({ runtime, debug, topicSchemas, canonicalModel, aliasRegistry, transforms })`. F1/F3-F6 sezioni pass-through; F2 sezioni validate strutturalmente.

### packages/mapper/src/public-factory.test.ts (85 LOC, 8 test)

| # | Test name | Behavior coperto | Decisione |
|---|-----------|------------------|-----------|
| 1 | returns a MapperBroker instance with no config | smoke factory | D-30 |
| 2 | bootstraps canonicalModel.schemas from config | D-56 | D-56, MAP-02 |
| 3 | bootstraps aliasRegistry.global from config | D-56 | D-56, MAP-16 |
| 4 | bootstraps transforms from config | D-56 | D-56, MAP-12 |
| 5 | throws on invalid canonicalModel shape (Valibot validation) | Error 'Invalid MapperBrokerConfig' | D-18 ext, D-56 |
| 6 | returns independent instances (D-30 no singleton) | factory purity | D-30 |
| 7 | bootstraps aliasRegistry.scoped from config (bonus) | D-56 scoped section | D-56 ext |
| 8 | empty config still works (no-op bootstrap) (bonus) | edge case | factory robustness |

### packages/mapper/src/mapper-engine.ts (modified — +45 LOC)

3 nuovi metodi pubblici aggiunti al `class MapperEngine`:

- **`hasCompiled(pluginId): boolean`** — per il broker wrapper decidere se applicare applyOutputMap al publish (passthrough se non compiled)
- **`hasInputMap(pluginId): boolean`** — per il broker wrapper decidere se wrappare il subscribe handler con applyInputMap (passo 11)
- **`getCanonicalSchemaIdFor(pluginId): CanonicalSchemaId | undefined`** — per il broker wrapper recuperare lo schema id per il step 6 canonical validation

Nessun breaking change al contract pubblico esistente — i 6 metodi originali (compileMappings, applyOutputMap, applyInputMap, unregisterPluginMappings, validateCanonical, stats) restano identici. I 26 test del plan 02-07 invariati.

### packages/mapper/src/index.ts (modified — +18 LOC barrel)

Runtime exports estesi (11 totali — era 9):
- **`+MapperBroker`** (class) — composition wrapper
- **`+createMapperBroker`** (factory) — public API surface

Type exports estesi (5 nuovi):
- **`+RegisterAliasOptions`** — opzioni per registerAlias
- **`+RegisterCanonicalSchemaOptions`** — opzioni per registerCanonicalSchema
- **`+RegisterTransformWrapperOptions`** — opzioni per registerTransform
- **`+MapperSubscribeOptions`** — subscribe options esteso F2
- **`+MapperBrokerDebugSnapshot`** — snapshot debug esteso F2

## Verification

| Comando | Risultato |
|---------|-----------|
| `pnpm --filter @gluezero/mapper test broker-mapper-wrapper` (RED, post commit `b51e507`) | FAIL atteso: `Failed to resolve import "./broker-mapper-wrapper"` |
| `pnpm --filter @gluezero/mapper test broker-mapper-wrapper` (GREEN, post commit `edfd0e0`) | Exit 0: **`Test Files 1 passed (1) | Tests 15 passed (15)`** Duration 424ms |
| `pnpm --filter @gluezero/mapper test public-factory` (RED, post commit `3a840d0`) | FAIL atteso: `Failed to resolve import "./public-factory"` |
| `pnpm --filter @gluezero/mapper test public-factory` (GREEN, post commit `a53c260`) | Exit 0: **`Test Files 1 passed (1) | Tests 8 passed (8)`** Duration 405ms |
| `pnpm --filter @gluezero/mapper test` (full mapper suite) | Exit 0: **`Test Files 9 passed (9) | Tests 116 passed (116)`** (canonical-registry 11 + alias-registry 16 + transform-pipeline 14 + valibot-adapter 10 + mapper-engine 26 + inspector 10 + augment 6 + broker-mapper-wrapper 15 + public-factory 8) |
| `pnpm --filter @gluezero/mapper typecheck` | Exit 0 (isolatedDeclarations enforcement OK; ogni metodo pubblico ha return type esplicito; conditional spread per exactOptionalPropertyTypes verificato post fix MapperPublishOptions = Parameters<Broker['publish']>[2]) |
| `pnpm --filter @gluezero/mapper build` | Exit 0: dist/index.js (45.30 KB) + dist/augment.js (214 B) + dist/index.d.ts (46.96 KB) + dist/augment.d.ts (88 B) + dist/augment-CLfzFiyy.d.ts (9.43 KB shared types) |
| `pnpm --filter @gluezero/core test` (regression F1) | Exit 0: **24 file/248 test passing** (no regression — D-49 confermato) |
| `pnpm --filter @gluezero/core typecheck` | Exit 0 |
| Smoke import bundle | `Exports: AliasRegistry, CanonicalRegistry, MapperBroker, MapperEngine, MappingInspector, TransformPipeline, __augmentLoaded, createMapperBroker, isMappingErrorCode, valibotAdapter, wrapTap` (11 runtime exports) |
| `pnpm exec biome check packages/mapper/src/{broker-mapper-wrapper,public-factory,index,mapper-engine}*.ts` | Exit 0 (no errors after auto-fix) |
| Audit `git diff HEAD~4 -- packages/core/` | 0 lines diff — D-49 strict confermato |
| Audit `git diff HEAD~4 -- packages/core/src/core/bus.ts` | 0 lines diff — bus.ts NON modificato |
| Post-commit deletion check | OK: no deletions tra HEAD~4 e HEAD (`git diff --diff-filter=D --name-only HEAD~4 HEAD` empty) |

## Threat Coverage

| Threat ID | Disposition | Mitigation in commit |
|-----------|-------------|----------------------|
| T-02-10-01 (DoS — mapping error storm consuma ring buffer) | mitigate | MappingInspector ring buffer bounded (default 10) con FIFO drop — già implementato in plan 02-08; verificato Test 10 (mapping.error registrato + delivery skipped). |
| T-02-10-02 (Tampering — descriptor con cycle inserito mid-publish) | mitigate | Cycle detection register-time (D-35) — `mapper.compileMappings(descriptor)` chiamato in `MapperBroker.registerPlugin` PRIMA di `inner.registerPlugin` (rollback come F1). Test 6 verifica throw immediato `mapping.cycle.detected`. Modificare descriptor post-register richiederebbe nuovo register (throw plugin.id.duplicate D-17 di F1). |
| T-02-10-03 (Repudiation — cascade unregister incompleta lascia state) | mitigate | Cascade ordinata: `inner.unregisterPlugin` (F1 LIFE-02) → `alias.unregisterScopedAll` → `transforms.unregisterByOwner` → `mapper.unregisterPluginMappings` → `canonicalRegistry.unregister` per gli schemi owned → `ownership.delete`. Ogni step in try/catch swallow indipendente; fallimento di uno NON blocca gli altri. Test 7 verifica: post-unregister, `registeredTransforms === 0` e `registeredAliases` invariato (alias scoped p1 rimosso ma alias globali intatti). |
| T-02-10-04 (Information disclosure — Inspector espone errori con PII) | accept | F2 V1 — già documentato in plan 02-08. F6 fornirà hook di redaction esplicito. DOC-03 (plan 02-12) documenterà best practice produzione. |
| T-02-10-05 (DoS — publish con outputMap che fail genera mapping.error → loop infinito se subscriber a mapping.error throw) | mitigate | F1 handler isolation (try/catch in `bus.deliver` — `runHandler` riga 211-223 di bus.ts) previene cascade. mapping.error subscribers sono trattati come qualsiasi altro handler — un throw produce `system.error` (F1 isolation) ma NON ricicla mapping.error. Test 10 verifica delivery del mapping.error senza recursion. |
| T-02-10-06 (Spoofing — Plugin malevolo registra alias global che shadow di mapping critico) | mitigate | `registerAlias({ scope: 'global' })` è esposto solo via MapperBroker (auth applicativo del consumer); `registerScoped` è plugin-private (Map<pluginId, ...>). Conflict throw da AliasRegistry previene shadow accidentale (test plan 02-04 verifica `alias.global.conflict`). |

## Deviations from Plan

**1. [Rule 2 — Correctness/Readability] 3 helper introspection aggiunti al MapperEngine**

- **Found during:** Task 1 GREEN implementation (TS error: `mapper.compiled` is private)
- **Issue:** Il broker wrapper deve sapere se un plugin ha `outputMap`/`inputMap` compilato per decidere quando applicare `applyOutputMap`/`applyInputMap`. Le alternative scartate:
  - Accesso diretto al `private compiled` Map: viola encapsulation (TS error)
  - Try/catch su `applyOutputMap` per detect 'no mapping': catastrophic — semantica errore vs passthrough confusa, e `applyOutputMap` non throw ma fa shallow copy in caso di no compile
  - Aggiungere il check al `applyOutputMap`/`applyInputMap` direttamente: già fatto (passthrough), ma il broker wrapper ha bisogno di decidere PRIMA se invocarli o saltare il flow F2 entirely (per non interferire con plugin F1 plain)
- **Fix:** Aggiunti 3 metodi pubblici `MapperEngine`: `hasCompiled(pluginId)`, `hasInputMap(pluginId)`, `getCanonicalSchemaIdFor(pluginId)`. Tutti additive, nessun breaking change al contract pubblico esistente (compileMappings/applyOutputMap/applyInputMap/unregisterPluginMappings/validateCanonical/stats restano identici). I 26 test plan 02-07 invariati al re-run.
- **Files modified:** `packages/mapper/src/mapper-engine.ts` (+45 LOC — 3 metodi + JSDoc)
- **Verification:** `pnpm --filter @gluezero/mapper test mapper-engine` exit 0 (26/26 invariati); typecheck exit 0
- **Commit:** `edfd0e0` (Task 1 GREEN)

**2. [Rule 1 — Bug] MapperPublishOptions type definition fix**

- **Found during:** Task 1 typecheck dopo prima implementazione
- **Issue:** Prima implementazione aveva `MapperPublishOptions = { source?: { type: string; id: string }, [key: string]: unknown }`. TS rifiuta perché:
  - F1 `EventSource.type` è literal union `'plugin' | 'component' | 'server' | 'worker' | 'system'` — `string` non è assegnabile (TS2379 con exactOptionalPropertyTypes)
  - I test passano `source: { type: 'plugin', id: 'form' }` che è una literal valida — il problema era il narrowing del tipo del wrapper, non i call sites
- **Fix:** `type MapperPublishOptions = Parameters<Broker['publish']>[2]` — riusa il signature di Broker.publish F1. Pattern non-breaking: tutti i campi optional di PublishParams<T> di F1 (deliveryMode, priority, ttlMs, dedupeKey, ecc.) sono accettati automaticamente.
- **Files modified:** `packages/mapper/src/broker-mapper-wrapper.ts` (1 type alias)
- **Verification:** typecheck exit 0; 15/15 test passing
- **Commit:** `edfd0e0` (Task 1 GREEN — fix incluso nello stesso commit GREEN per leggibilità)

**3. [Rule 1 — Bug] Conditional spread per onRegister/onMount/onUnmount/onDestroy in wrapDescriptorHooks**

- **Found during:** Task 1 typecheck (TS2375: `onRegister: undefined` non assegnabile a `(ctx) => void | Promise<void>`)
- **Issue:** Prima implementazione costruiva `wrapped: PluginDescriptor = { ...descriptor, onRegister: wrapHook(descriptor.onRegister), ... }` dove `wrapHook` ritornava `undefined` se hook non definito. Con `exactOptionalPropertyTypes: true`, `onRegister: undefined` non è assegnabile a `onRegister?: (ctx) => void | Promise<void>` — il TS lo richiede assente, NON undefined esplicito.
- **Fix:** Sostituito con conditional spread:
  ```ts
  ...(descriptor.onRegister !== undefined && { onRegister: wrapAsyncHook(descriptor.onRegister) })
  ```
  Pattern coerente con `event-factory.ts:62-78` (F1) e con il resto del codebase F2.
- **Files modified:** `packages/mapper/src/broker-mapper-wrapper.ts` (refactor `wrapDescriptorHooks`)
- **Verification:** typecheck exit 0; Test 8 (scenario meteo) verifica end-to-end che onMount wrapped chiama l'hook originale con il ctx mapper-aware
- **Commit:** `edfd0e0` (Task 1 GREEN — fix incluso nello stesso commit per leggibilità)

**4. [Style — Test count 15 invece di 12 in broker-mapper-wrapper.test.ts]**

- **Found during:** Task 1 RED test design
- **Issue:** Il PLAN dichiara 12 test (acceptance criteria); coverage gap rilevato:
  - Mancava test esplicito per `subscribe` diretto del MapperBroker con `ownerId` (vs `ctx.broker.subscribe`) — D-51 implementato runtime
  - Mancava test passthrough per plugin senza outputMap (regression edge case)
  - Mancava test per publish con `source: { type: 'system', ... }` (no source-resolved → no mapping)
  - F1 surface delegation (getTopicRegistry, setLogger, enable/disableDebug) non era coperto da un test esplicito
- **Fix:** 4 test extra additive:
  - **Test 9** (subscribe con ownerId esplicito) — D-51 alternative path
  - **Test 13** (passthrough plugin senza outputMap) — regression edge case
  - **Test 14** (system source — no mapping) — D-50 step 4 edge case
  - **F1 surface delegation describe** (1 test consolidato) — D-49 delegation verification
- **Files modified:** `packages/mapper/src/broker-mapper-wrapper.test.ts` (4 test extra)
- **Verification:** 15/15 test passing
- **Commit:** `b51e507` (RED) + `edfd0e0` (GREEN)

**5. [Style — Test count 8 invece di 6 in public-factory.test.ts]**

- **Found during:** Task 2 RED test design
- **Issue:** Il PLAN dichiara 6 test; coverage gap:
  - Mancava test per `aliasRegistry.scoped` bootstrap (D-56 sezione completa)
  - Mancava test edge case `createMapperBroker({})` (empty config — no-op bootstrap)
- **Fix:** 2 test bonus additive:
  - **Test 7** (bootstraps aliasRegistry.scoped) — D-56 ext
  - **Test 8** (empty config no-op) — robustness factory
- **Files modified:** `packages/mapper/src/public-factory.test.ts` (2 test extra)
- **Verification:** 8/8 test passing
- **Commit:** `3a840d0` (RED) + `a53c260` (GREEN)

**Note tecniche minori (non deviazioni):**

1. **Auto-fix Biome `organizeImports`** — Riordino imports nel broker-mapper-wrapper.ts: `import type` separato da runtime, alfabetico cross-package. Cosmetico, semantica identica.
2. **Auto-fix Biome `lineWidth` + format** — Consolidamenti di firme metodo private su una riga (`handleMappingError(err, sourceTopic, step)` da multi-riga a single). Cosmetico.
3. **Rimozione import `EventSource` non usato** — Dopo refactor a `MapperPublishOptions = Parameters<Broker['publish']>[2]`, `EventSource` non era più referenziato esplicitamente nel codice. Rimosso manualmente (Biome auto-fix marcato come unsafe).
4. **Header file italiano + JSDoc inglese-misto** — Coerente con `02-PATTERNS.md §1.1`. Identico al pattern usato in plan 02-03/04/05/06/07/08/09.
5. **`dist/augment-CLfzFiyy.d.ts` shared types file** — tsup con dts: true genera un file di shared types (9.43 KB) per evitare duplicazione tra `dist/index.d.ts` e `dist/augment.d.ts`. Atteso e benigno; il consumer non lo importa direttamente. Già documentato in plan 02-09.

## TDD Gate Compliance

Plan `type: execute` con Task 1 + Task 2 entrambi `tdd="true"`. Gate sequence verificata in `git log --oneline`:

- ✅ **Task 1 RED gate** (`b51e507`): commit `test(02-10): aggiunge test RED per MapperBroker (composition wrapper)` con 15 test in 2 describe block
- ✅ **Task 1 GREEN gate** (`edfd0e0`): commit `feat(02-10): implementa MapperBroker (composition wrapper D-49 + 5 step F2 pipeline)` dopo RED
- ✅ **Task 2 RED gate** (`3a840d0`): commit `test(02-10): aggiunge test RED per createMapperBroker (public factory)` con 8 test
- ✅ **Task 2 GREEN gate** (`a53c260`): commit `feat(02-10): aggiunge createMapperBroker factory + barrel exports` dopo RED

**RED fail-fast confirmed:** entrambi i RED hanno fallito al run con messaggio `Failed to resolve import "./broker-mapper-wrapper"` e `"./public-factory"` PRIMA della creazione dei moduli. Nessun test è passato accidentalmente in fase RED.

**GREEN single-iteration con 3 fix typecheck (Task 1):** primo run del typecheck dopo creazione di broker-mapper-wrapper.ts ha rilevato 3 issue (TS2379 source.type, TS18048 config undefined, TS2375 conditional spread). Fix applicati pre-commit GREEN — committati come parte del commit GREEN unico per leggibilità (deviation note 1, 2, 3).

**GREEN single-iteration senza fix (Task 2):** primo run dopo source creation: 8/8 passing al primo run; typecheck exit 0; Biome clean. Nessun fix necessario.

REFACTOR gate non applicabile: l'implementazione è already idiomatic; gli auto-fix Biome sono cosmetici (formattazione/import ordering).

## Auth Gates

Nessun auth gate — task interamente automatico (file creation + typecheck/test/biome local).

## Open Items / Pronto-per

- ✅ **Closed:** D-31 (3 register API: registerCanonicalSchema/registerTransform/registerAlias) — runtime esposto sul MapperBroker. Test 1, 2, 3, 4 verificano.
- ✅ **Closed:** D-49 (no modify bus.ts) — verificato strict via `git diff HEAD~4 -- packages/core/` → 0 lines.
- ✅ **Closed:** D-50 (5 step F2 in pipeline) — wired runtime al publish (passi 4, 5, 6) e al subscribe (passi 11, 12). Coerente con CONTEXT D-50 ordering.
- ✅ **Closed:** D-51 (delivery loop applica inputMap consumer) — implementato runtime via `wrapConsumerHandler` (subscribe diretto con ownerId) e via `wrapDescriptorHooks` (ctx.broker mapper-aware per i plugin). Test 8 + Test 9 verificano entrambi i path.
- ✅ **Closed:** D-58 (publish mapping.error) — `handleMappingError(err, sourceTopic, step)` registra nell'Inspector e pubblica `mapping.error` con payload `{ error, sourceEvent, step }`. Test 10 verifica.
- ✅ **Closed:** D-59 (NO publish <topic>.failed da F2) — solo mapping.error pubblicato; delivery skipped per il consumer affetto.
- ✅ **Closed:** D-26 ext F2 (cascade transform/alias scoped/canonical schemas/mapper compiled). Test 7 verifica.
- ✅ **Closed:** D-48 (getDebugSnapshot mappings section) — implementato. Test 11 verifica.
- ✅ **Closed:** D-30 (no singleton createMapperBroker) — Test 6 public-factory verifica `b1 !== b2`.
- ✅ **Closed:** D-56 (Valibot validation sezioni F2) — `MapperBrokerConfigSchema` valida canonicalModel/aliasRegistry/transforms strutturalmente. Test 5 public-factory verifica throw `Invalid MapperBrokerConfig`.
- ✅ **Ready:** plan 02-11 (PipelineHarness extension F2 + integration test scenario meteo PRD §29 D-53) può:
  - Importare `createMapperBroker` dal barrel `@gluezero/mapper`
  - Estendere `PipelineHarness` di F1 con metodi `defineCanonicalSchema()`, `defineTransform()`, `expectMappingApplied()` come da `02-PATTERNS.md §2.4`
  - Verificare end-to-end scenario meteo: plugin form publica `weather.requested` con `città/data`, mapper produce internamente `{location, forecast_date}`, plugin widget consumer riceve `{location, 'day-prevision'}`
  - Verificare `byStep('event.mapped.canonical')` e `byStep('event.mapped.consumer')` (richiede tap orchestration F2 — il MapperBroker plan 02-10 NON wira ancora `wrapTap(config.runtime.tap, inspector)` runtime poiché `recordSnapshot` è no-op V1; plan 02-11 può aggiungere il wiring del tap utente per il PipelineHarness)
- ⏳ **Pending:** **MAP-04..MAP-12 runtime-level coverage**: i 9 REQ specifici (rename, nested, default, transform, derive, partial, format, unit, validation post-mapping) sono TUTTI implementati a livello mapper-engine (plan 02-07) e ora wired al broker tramite il publish/subscribe wrappers. La verifica end-to-end completa avviene in plan 02-11 (integration test scenario meteo). Da contare in plan 02-12 (final gate) come `requirements-completed` se il REQUIREMENTS.md riflette il "broker integration" come gate finale.
- ⏳ **Pending:** **Tap wiring per Inspector** — il MapperBroker NON wira automaticamente `wrapTap(config.runtime.tap ?? noopEventTap, inspector)` perché `inspector.recordSnapshot` è no-op V1 (D-48). F6 (TOOL-01) popolerà `recordSnapshot` con full snapshot per evento → quando avverrà, aggiungere il wiring nel constructor del MapperBroker. Per ora, il consumer F6 può fare wiring esplicito via `getMappingInspector()` + `wrapTap` esposti.
- ⏳ **Pending:** Coverage v8 misurazione del modulo deferred a plan 02-12 (final gate F2 — D-55). Atteso ~85-90% per broker-mapper-wrapper.ts (qualche branch di errore non coperto: handleMappingError fallback log, validation error path quando schema non registrato).

## Threat Flags

Nessun nuovo threat flag introdotto. I threat T-02-10-01..06 sono tutti coperti dalle mitigation documentate (vedi sezione Threat Coverage).

## Self-Check: PASSED

File creati (verifica esistenza):
- packages/mapper/src/broker-mapper-wrapper.ts: FOUND (~520 LOC)
- packages/mapper/src/broker-mapper-wrapper.test.ts: FOUND (435 LOC)
- packages/mapper/src/public-factory.ts: FOUND (~145 LOC)
- packages/mapper/src/public-factory.test.ts: FOUND (85 LOC)

File modificati (verifica modifica):
- packages/mapper/src/mapper-engine.ts: FOUND (modificato — +45 LOC introspection helpers)
- packages/mapper/src/index.ts: FOUND (modificato — barrel esteso)

Commit hash (verifica esistenza in git log):
- b51e507 (Task 1 RED — test broker-mapper-wrapper): FOUND
- edfd0e0 (Task 1 GREEN — feat MapperBroker + helpers MapperEngine): FOUND
- 3a840d0 (Task 2 RED — test public-factory): FOUND
- a53c260 (Task 2 GREEN — feat createMapperBroker + barrel): FOUND

REQ-IDs avanzati a runtime-completed:
- **MAP-02** registerCanonicalSchema esposto runtime sul Broker — completed
- **MAP-03** PluginDescriptor.inputMap/outputMap consumati al registerPlugin runtime — completed
- **MAP-13** canonicalizzazione interna completa wired al publish runtime — completed
- **MAP-14** mapping bidirezionale: applyOutputMap al publish + applyInputMap al subscribe — completed
- **MAP-15** Mapping Inspector wired al broker via getMappingInspector + getDebugSnapshot.mappings — completed
- **ERR-02** mapping.error published su mapping failure (transform.failed/canonical.validation.failed) — completed
- **PIPE-01** passi 4, 5, 6 hooks installati nel publish; passi 11, 12 hooks installati nel subscribe — completed (verifica end-to-end full in plan 02-11)
- **LIFE-02** ext F2 — cascade pulisce transform/alias scoped/canonical schemas/mapper compiled — completed

REQ-IDs runtime-level (full integration test scenario meteo plan 02-11):
- **VAL-02** validazione payload topic — runtime hook installato (step 6 canonical + step 12 final via validateCanonical structural pass V1)
- **VAL-03** validazione canonical schema — runtime hook installato (step 6 publish wrapper + step 12 subscribe wrapper)
- **VAL-04** validazione post-mapping per consumer — runtime hook installato (step 12 subscribe wrapper)
- **VAL-07** Valibot adapter wired — runtime via valibotAdapter passed al MapperEngine (mapper-engine plan 02-07; il broker wrapper consume via constructor)

Open issues PRD §39 chiusura status (cumulative phase 2):
- **#1** Precedenza alias automatici vs mapping esplicito (MAP-17) — closed in 02-04 type-level + 02-07 runtime-level ✅
- **#3** Field mancante required:true|false (VAL-08) — closed in 02-07 runtime-level ✅
- **#4** Transform failure: skip o block (VAL-09) — closed in 02-05 (TransformPipeline) e 02-07 (MapperEngine integration) ✅

Threat coverage F2 fasi accumulate:
- T-02-10-01..06 verified (vedi Threat Coverage table)
- T-02-09-01..05 verified (plan 02-09 augment+barrel)
- T-02-08-01..05 verified (plan 02-08 Inspector)
- T-02-07-01..07 verified (plan 02-07 MapperEngine)
- T-02-06-01..05 verified (plan 02-06 valibotAdapter)
- T-02-05-01..05 verified (plan 02-05 TransformPipeline)
- T-02-04-01..05 verified (plan 02-04 AliasRegistry)
- T-02-03-01..05 verified (plan 02-03 CanonicalRegistry)
- T-02-02-01..04 verified (plan 02-02 types)
- T-02-01-01..05 verified (plan 02-01 scaffold)
