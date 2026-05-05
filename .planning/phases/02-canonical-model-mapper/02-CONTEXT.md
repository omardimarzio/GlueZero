# Phase 2: Canonical Model & Mapper - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning
**Mode:** `--auto` (decisioni prese con i default raccomandati senza interazione utente; tutte le scelte derivano dal PRD, ROADMAP, REQUIREMENTS, CLAUDE.md, e dalle decisioni Phase 1)

<domain>
## Phase Boundary

Phase 2 consegna il **Canonical Model + Mapper bidirezionale** del progetto GlueZero:

1. **Canonical Vocabulary Registry** — registry tipizzato con campi canonici, alias riconosciuti, schema versioning (`requires`).
2. **Mapper bidirezionale** — pipeline pre-compilata locale → canonico (input) e canonico → consumer (output) per ogni plugin sottoscritto.
3. **Transform Pipeline** — supporto a rename, nested, default, format transform, unit normalization, derive (`$derive`), partial mapping, validazione post-mapping; `registerTransform(name, fn)` per trasformazioni custom.
4. **Mapping Inspector** — estensione di `EventTap` (pre-instrumentato in F1) ai 5 nuovi step di pipeline §28 (step 4, 5, 6, 11, 12). Espone payload originale, canonico, finale, trasformazioni, warning, errori.
5. **Validation adapter** — Valibot 1.x come default; adapter pluggable per Zod/Ajv (deferred a V2).

**Pacchetto monorepo:** `@gluezero/mapper` (placeholder già scaffold-ato in plan 01-01).

**Pipeline §28 estesa in F2:** step 4 (identificazione source), 5 (mapping output→canonico), 6 (validazione canonico), 11 (mapping canonico→consumer), 12 (validazione finale). I 5 step F1 (`event.received`, `event.metadata.enriched`, `event.validated`, `event.dedupe.checked`, `event.delivered`) restano invariati.

**Default V1 — canonicalizzazione interna completa (PRD §13.5):** i dati transitano sempre canonicalizzati internamente tra Broker, (futuro) Routing, Cache, Worker. La traduzione inversa `canonical → consumer` avviene solo all'ultimo miglio (step 11), una volta per consumer.

**Requirements (27 REQ-IDs assegnati):** MAP-01..MAP-17, VAL-02, VAL-03, VAL-04, VAL-07, VAL-08, VAL-09, ERR-02 (extension `mapping.error`), TEST-01 mapping subset, TEST-02 plugin↔plugin con mapping diverso, DOC-03.

**Open issues PRD §39 chiuse in F2:** #1 (MAP-17 mapping esplicito vs alias automatici), #3 (VAL-08 field mancante), #4 (VAL-09 transform failure).

**Scope-out (deferred a fasi successive):**
- Server gateway HTTP / fetch reverse mapping (F3)
- Realtime inbound normalization (F4 — riusa F2 mapper)
- Worker payload canonicalization (F5 — riusa F2 mapper)
- Cache adapter con metadata `cache`/`remote` (F6)
- Adapter validation Zod/Ajv (V2 — solo Valibot in V1)
- IndexedDB per canonical schema persistence (V2)

</domain>

<decisions>
## Implementation Decisions

### A. API Surface Mapper

- **D-31:** Il Broker espone come metodi pubblici: `registerCanonicalSchema(schemaDefinition)`, `registerTransform(name, fn)`, `registerAlias(localName, canonicalName, opts?)` — coerente con il pattern `registerPlugin/registerRoute` di F1. Tutti i metodi accessibili tramite l'istanza `Broker` ritornata da `createBroker(config)`.
- **D-32:** I plugin dichiarano `inputMap?: InputMap` e `outputMap?: OutputMap` come campi opzionali del `PluginDescriptor` (estensione tipo via TS declaration merging — F1 plan 03 ha lasciato i tipi tolerant placeholder; F2 risolve via re-declaration nel package `@gluezero/mapper`).
- **D-33:** `MapperConfig` opzionale in `BrokerConfig` (sezione `canonicalModel`, `aliasRegistry`, `transforms` — già placeholder `unknown` da plan 03); F2 sostituisce con tipi specifici.

### B. Strategia Canonicalizzazione

- **D-34:** **Mapping pre-compilato al `registerPlugin`** — al register, il mapper costruisce un dispatch table `Map<localFieldName, CompiledFieldMapping>` per ogni plugin con `transform: () => any`, `derive: ($source) => any`, `default: T`. Pre-compilazione una volta sola, lookup O(1) a runtime per ogni publish/delivery.
  - **Rationale:** STACK.md §"mapping pipeline pre-compilata"; PITFALLS coverage (no recompilation hot-path).
  - **Cost:** ~50-100 LOC di compile logic in F2. Cycle detection inclusa.
- **D-35:** **Cycle detection al register, NON a runtime** — mapper compile usa `visited: Set<(pluginId, fieldName)>` per detectare cicli `A → B → A`. Throw `BrokerError` `mapping.cycle.detected` con `details: { pluginId, cycle: [field1, field2, field1] }` immediatamente al `registerPlugin`. (PITFALLS).
- **D-36:** **Canonical schema versioning** — `CanonicalSchema.requires?: string[]` lista di altri canonical schema su cui dipende; verificato al `registerCanonicalSchema` (throw se requires non risolti). Plain string version (no SemVer parsing in F2).

### C. Validation Library

- **D-37:** **Valibot 1.x come default** — già installato in F1 plan 02. Il MapperEngine riceve un `ValidatorAdapter` injectabile via config; default `valibotAdapter` esportato dal package `@gluezero/mapper`.
- **D-38:** **Adapter pluggable** — `interface ValidatorAdapter { validate(schema, payload): { ok: true; value } | { ok: false; issues } }`. Adapter Zod/Ajv deferred a V2 (out of scope F2).
- **D-39:** **Validation step injection** — F2 valida 3 volte nella pipeline:
  - step 3 `event.validated` (già F1) — validazione sintattica BrokerEvent shape
  - step 6 `event.canonical.validated` (NUOVO F2) — validazione canonical schema
  - step 12 `event.final.validated` (NUOVO F2) — validazione post-mapping per consumer

### D. MAP-17 — Alias automatici vs mapping esplicito (chiusura PRD §39 #1)

- **D-40:** **Mapping esplicito (`inputMap`/`outputMap` del plugin) prevale SEMPRE sugli alias automatici dell'AliasRegistry.** Resolution order documentato:
  1. Mapping esplicito `inputMap[localField] → canonicalField`
  2. Alias canonici registrati `aliasRegistry.resolve(localField)`
  3. Name match diretto `localField === canonicalField`
  4. Field non risolto → applica `required: true|false` policy (D-42)
- **D-41:** **Warning runtime su alias ambiguo** — quando un alias automatico viene usato (step 2 della resolution), il mapper emette `mapping.warn` come BrokerEvent (CORE category `mapping`) per debug; **NON** un'eccezione (errors solo se field required + non risolvibile).

### E. VAL-08 — Field mancante (chiusura PRD §39 #3)

- **D-42:** **Configurabile per campo nel canonical schema** — `CanonicalSchema.fields[name].required: boolean` (default `false`). Comportamento:
  - `required: true` + field mancante → throw `BrokerError` `validation.field.missing` → publish `mapping.error`
  - `required: false` + field mancante:
    - se `default: T` definito → applica default
    - se no default → field rimane `undefined` (non aggiunto alla payload canonica per `exactOptionalPropertyTypes` cleanliness)
- **D-43:** **Default value resolution** — i `default` sono valori statici (no funzioni). Per default dinamici si usa `$derive` con transform.

### F. VAL-09 — Transform failure (chiusura PRD §39 #4)

- **D-44:** **Configurabile per transform** — `CanonicalSchema.fields[name].onFailure: 'block' | 'skip' | 'fallback'` (default `'block'`). Comportamento:
  - `'block'` (default) — transform throw → mapping fallisce intero → publish `mapping.error` (no delivery)
  - `'skip'` — transform throw → field lasciato non valorizzato (come `required: false` + no default)
  - `'fallback'` — transform throw → applica `default: T` se definito; se no default, comportamento `'skip'`
- **D-45:** **Errore wrapped** — il transform error originale è preservato in `BrokerError.originalError` e `BrokerError.cause` (ES2022); category `mapping`, code `mapping.transform.failed`, details include `{ pluginId, fieldName, transformName }`.

### G. Mapping Inspector

- **D-46:** **Estende `EventTap` di F1, NON un'API separata** — vincolo critico ARCHITECTURE.md §3.2. F2 estende il tipo `PipelineStep` (plan 03 ha lasciato tolerant placeholder via comment block) aggiungendo `'event.source.resolved'`, `'event.mapped.canonical'`, `'event.canonical.validated'`, `'event.mapped.consumer'`, `'event.final.validated'`.
- **D-47:** **PipelineSnapshot esteso** — i campi opzionali `payloadBefore` e `payloadAfter` (già definiti in plan 03 tap.ts) sono valorizzati nei nuovi 5 step per esporre la trasformazione applicata. F2 aggiunge `metadata.transformsApplied: string[]` e `metadata.ambiguityWarnings: string[]` all'oggetto snapshot quando rilevanti.
- **D-48:** **`getDebugSnapshot()` esteso** — F2 aggiunge sezione `mappings: { canonicalSchemas: number, registeredAliases: number, registeredTransforms: number, lastMappingErrors: BrokerError[] }`. Inspector reale (full payload before/after per evento) deferred a F6 (TOOL-01).

### H. Estensione Pipeline §28 e bus.ts

- **D-49:** **`bus.ts` di F1 NON modificato direttamente** — F2 introduce un `MapperEngine` che si "aggancia" alla pipeline via TS declaration merging del `PipelineStep` union + un wrapper sul `Broker` (decorator pattern). Il Broker compone `MapperEngine` come `EventBus`, in modo che gli step F2 vengono invocati prima/dopo gli step F1 senza cambi al sorgente F1.
- **D-50:** **Ordine pipeline §28 in F2:**
  - step 1 `event.received` (F1)
  - step 2 `event.metadata.enriched` (F1)
  - step 3 `event.validated` (F1, sintassi BrokerEvent)
  - step 4 `event.source.resolved` (F2 NUOVO — identifica plugin sender + outputMap)
  - step 5 `event.mapped.canonical` (F2 NUOVO — output→canonical mapping)
  - step 6 `event.canonical.validated` (F2 NUOVO — Valibot canonical schema)
  - step 7 `event.dedupe.checked` (F1, base — F3 estende a route)
  - step 11 `event.mapped.consumer` (F2 NUOVO — canonical→consumer mapping per ogni subscriber)
  - step 12 `event.final.validated` (F2 NUOVO — post-mapping per consumer)
  - step 13 `event.delivered` (F1)
- **D-51:** **Step 11 e 12 invocati per ogni consumer matched** — il `bus.deliver()` di F1 itera già per ogni subscription matched; F2 estende l'iterazione applicando il mapping inverso (canonical → consumer locale via `inputMap` del consumer plugin). Costo: O(matched_subscribers × mapping_compile_size).

### I. Test Strategy F2

- **D-52:** **Pattern TDD RED→GREEN come F1** — ogni modulo (`canonical-registry.ts`, `alias-registry.ts`, `transform-pipeline.ts`, `mapper-engine.ts`, `valibot-adapter.ts`) ha unit test co-locato. Plan paralleli con file ownership disgiunta dove possibile (analogo plan 04/05/06).
- **D-53:** **Integration test scenario meteo PRD §29 SENZA HTTP** — F2 verifica end-to-end: plugin form pubblica `weather.requested` con `città: "Roma", data: "30/04/2026"`, mapper produce internamente `{location: "Roma", forecast_date: "2026-04-30"}` (transforms `parseItalianDate` + `normalizeLocationName` registrati al boot), plugin widget consumer riceve `{location, day-prevision}` via `inputMap` bidirezionale. HTTP route deferred a F3.
- **D-54:** **Cycle detection deterministic test** — registerPlugin con descriptor che dichiara mapping circolare → throw `mapping.cycle.detected` SUL register (NON a runtime publish), test assert exact error code + cycle path.
- **D-55:** **Coverage v8 finale F2** — installare `@vitest/coverage-v8` come devDep root (open item ereditato da F1) e misurare ≥ 90% sui file `@gluezero/mapper/`. Da fare in plan 02-XX dedicato (final gate F2 simile a 01-11).

### J. Estensione Type System

- **D-56:** **Type re-export da `@gluezero/mapper` a `@gluezero/core`** — il package `@gluezero/core` (plan 03) ha `BrokerConfig` con sezioni `canonicalModel/aliasRegistry/transforms` tipate `unknown`. F2 fornisce i tipi `CanonicalSchema`, `AliasRegistration`, `TransformDescriptor`, `InputMap`, `OutputMap` da `@gluezero/mapper` e li wire-in al `BrokerConfig` via TS declaration merging (in `@gluezero/mapper/src/augment.ts`). Pattern non-breaking.
- **D-57:** **`PluginDescriptor` augmentation** — F2 aggiunge `inputMap?: InputMap`, `outputMap?: OutputMap` al `PluginDescriptor` esistente via declaration merging.

### K. Errori standard F2

- **D-58:** **Eventi standard `mapping.error`** (estensione ERR-02 PRD §22.3) — il mapper publishes `mapping.error` come BrokerEvent con `payload: { error: BrokerError, sourceEvent: BrokerEventId, step: PipelineStep }` quando:
  - field required mancante (D-42)
  - transform failure con `onFailure: 'block'` (D-44)
  - canonical validation failure (step 6)
  - final validation failure per un consumer (step 12)
  - cycle detected al register (D-35) — qui throw E pubblica
- **D-59:** **NO publish `<topic>.failed`** — quello è F3 (route HTTP failure). F2 emette solo `mapping.error` e l'evento originale viene **NON consegnato** ai subscriber (delivery skipped per il consumer affetto se l'errore è in step 11/12 specifici di quel consumer; per step 5/6 l'evento non viene consegnato a nessuno).

### Claude's Discretion

Aree dove le scelte specifiche di implementazione sono lasciate alla discrezione dell'agent planner/researcher:
- **Compile output structure** — la rappresentazione interna esatta del `CompiledFieldMapping` (Map vs Record vs object array)
- **Transform registry storage** — Map vs Object literal con namespace (`{ name: 'parseItalianDate', fn: ... }`)
- **Inspector data shape interno** — può evolvere; F6 lo definirà finalmente
- **Naming convention** dei file `.ts`/`.test.ts` interni di `@gluezero/mapper` — segui pattern F1
- **Splitting in plan** — il planner decide quanti plan (atteso ~6-10 plan tipo F1) e wave structure

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### PRD (fonte autoritativa)
- `prd.md` §13 — Canonical model + alias registry overview
- `prd.md` §13.5 — **Default V1 canonicalizzazione interna completa** (D-34)
- `prd.md` §14 — Mapper rules: rename, nested, default, transform, derive, partial, post-mapping validation
- `prd.md` §14.2 — Esempi mapping (rename, nested, default, transform di formato, normalizzazione unità, derive, partial)
- `prd.md` §14.4 — Esempio `parseItalianDate`
- `prd.md` §14.5 — `$derive` con concat
- `prd.md` §14.6 — `registerTransform(name, fn)` + fallback policy
- `prd.md` §14.7 — Warning runtime alias ambiguo (D-41)
- `prd.md` §14.8 — Mapping Inspector (D-46..D-48)
- `prd.md` §15.2 — Plugin descrive `inputMap`/`outputMap` (D-32, D-57)
- `prd.md` §16.2 — API pubblica `registerCanonicalSchema`, `registerTransform`, `registerAlias` (D-31)
- `prd.md` §21.2.2-21.2.4 — Validazione payload topic / canonical / post-mapping (D-39)
- `prd.md` §22.3 — Eventi standard di errore inclusi `mapping.error` (D-58)
- `prd.md` §27 — `BrokerConfig` sezioni `canonicalModel/aliasRegistry/transforms` (D-56)
- `prd.md` §28 — Pipeline ufficiale 14 step (D-50)
- `prd.md` §29 — Scenario meteo end-to-end (D-53 integration test target)
- `prd.md` §39 #1 — Mapping esplicito vs alias automatici (D-40)
- `prd.md` §39 #3 — Field mancante required:true|false (D-42)
- `prd.md` §39 #4 — Transform failure block|skip|fallback (D-44)

### Roadmap & Requirements
- `.planning/ROADMAP.md` § Phase 2 — Goal, scope, requirements, 5 success criteria
- `.planning/REQUIREMENTS.md` § Canonical Model + Mapper — 17 MAP-* + 7 VAL-* + ERR-02 extension + DOC-03
- `.planning/REQUIREMENTS.md` § Cross-cutting — VAL-02..VAL-04, VAL-07..VAL-09, ERR-02 (mapping.error), TEST-01 mapping subset, TEST-02

### Research (Phase 1)
- `.planning/research/STACK.md` § Validation — Valibot 1.x default, adapter pluggable (D-37, D-38)
- `.planning/research/STACK.md` § Mapper — pipeline pre-compilata (D-34)
- `.planning/research/ARCHITECTURE.md` §3.2 — **EventTap pre-instrumented vincolo critico** (D-46, D-49)
- `.planning/research/PITFALLS.md` — Cycle detection, mapping pre-compilation hazards (D-34, D-35)
- `.planning/research/SUMMARY.md` — Sintesi roadmap + canonicalizzazione interna completa V1

### Phase 1 deliverables (consumati da F2)
- `packages/core/src/types/broker-event.ts` — BrokerEvent shape (F2 estende `metadata`)
- `packages/core/src/types/tap.ts` — `PipelineStep` con tolerant placeholder block per F2 extension (D-49)
- `packages/core/src/types/error.ts` — `BrokerError` + `ErrorCategory` include già `'mapping'` (plan 03)
- `packages/core/src/types/plugin.ts` — `PluginDescriptor` (F2 augment via declaration merging — D-57)
- `packages/core/src/types/config.ts` — `BrokerConfig` con sezioni F2 placeholder `unknown` (D-56)
- `packages/core/src/core/bus.ts` — EventBus core (F2 estende via wrapper, NON modifica direttamente — D-49)
- `packages/core/src/core/broker.ts` — Broker class composition (F2 aggiunge `MapperEngine`)
- `packages/core/src/public-factory.ts` — `createBroker(config)` (F2 estende validation con sezioni mapper)
- `packages/core/src/core/event-tap.ts` — `safeTapStep`, `startStep` (F2 riusa per i 5 nuovi step)

### CLAUDE.md (vincoli operativi)
- `CLAUDE.md` § Vincoli operativi — Modello `claude-opus-4-7-1` per tutti gli agenti GSD; lingua italiana; minimizzare interazioni; agent-swarm parallelizzato
- `CLAUDE.md` § Stack raccomandato — Valibot, monorepo pnpm, in-house EventBus
- `CLAUDE.md` § Pipeline ufficiale §28 — F2 estende step 4, 5, 6, 11, 12

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (da Phase 1)
- **`createBrokerError`/`isBrokerError`** (`packages/core/src/core/broker-error.ts`) — F2 lo riusa per tutti gli errori `mapping.*`; `category: 'mapping'` già definita in plan 03.
- **`safeTapStep` + `startStep`** (`packages/core/src/core/event-tap.ts`) — F2 lo invoca per i 5 nuovi step con stesso pattern di F1 (D-46).
- **`EventBus.publish`** (`packages/core/src/core/bus.ts`) — F2 chiama `publish('mapping.error', ...)` per gli errori; il bus si occupa di delivery (D-58).
- **`Broker.registerPlugin/unregisterPlugin`** (`packages/core/src/core/plugin-registry.ts`) — F2 estende il register flow aggiungendo: dopo `onRegister` invoca `mapper.compileMappings(descriptor)` con cycle detection (D-35).
- **`createPluginScopedBroker`** (`packages/core/src/core/plugin-registry.ts`) — F2 può estendere il proxy per esporre `registerCanonicalSchema/registerAlias/registerTransform` agli hook plugin (verifica con planner se serve).
- **`PluginRegistry` cascade D-26** — `unregisterPlugin` deve cascadere anche le registrazioni di canonical schema/alias/transform fatte dal plugin (LIFE-02 extension F2).
- **`BrokerConfig` Valibot validation** (`packages/core/src/public-factory.ts`) — F2 estende lo schema Valibot per validare le sezioni `canonicalModel/aliasRegistry/transforms`.
- **`PipelineHarness` test fixture** (`packages/core/src/test-utils/pipeline-harness.ts`) — F2 lo riusa per gli integration test del scenario meteo (D-53).

### Established Patterns
- **TDD RED→GREEN**: ogni modulo `*.ts` ha test `*.test.ts` co-locato; commit pattern `test(02-XX): aggiunge test RED per <X>` poi `feat(02-XX): implementa <X>`.
- **File ownership disgiunta tra plan paralleli**: pattern usato in plan 04/05/06 di F1 (Wave 3); applicabile a F2 per `canonical-registry.ts` || `alias-registry.ts` || `transform-pipeline.ts`.
- **Tipo nominato per Rule 2 readability**: pattern usato in F1 con `SnapshotFactory`; applicabile in F2 per tipi mapper interni.
- **Type-only barrel re-export**: `packages/core/src/index.ts` ha `export type * from './types'` (plan 03); F2 estende con `export type * from '@gluezero/mapper'` se i tipi pubblici devono essere esposti dal core (verifica con planner).
- **Declaration merging per estensioni non-breaking**: pattern usato in plan 03 per `PipelineStep` e `BrokerConfig`; F2 lo applica per `PipelineStep` extension (D-49) e `PluginDescriptor` extension (D-57).
- **Atomic commit chunks** per plan grandi: pattern usato in plan 09/10 di F1; applicabile a integration test F2.
- **Performance budget**: F1 ha verificato storm 24ms / wildcard 11ms; F2 deve mantenere overhead mapping minimo (target: < 10% di publish latency su payload medio).

### Integration Points
- **`bus.ts:publish()` di F1**: F2 NON modifica direttamente. Il `Broker` (`broker.ts`) compone `MapperEngine` PRIMA di delegare a `bus.publish()` per i nuovi step F2.
- **`bus.ts:deliver()` di F1**: F2 estende il loop di delivery per applicare `inputMap` per consumer (step 11/12). Decisione architetturale (Rule 4 candidato): si fa via composition pattern nel Broker, NON modificando `bus.deliver`. Il planner valuterà la trade-off.
- **`createBroker(config)` Valibot validation**: F2 estende lo schema per validare le sezioni `canonicalModel/aliasRegistry/transforms`.
- **`getDebugSnapshot()`**: F2 aggiunge sezione `mappings: {...}` (D-48).
- **`pipeline-harness.ts`**: F2 estende il test fixture con `defineCanonicalSchema()`, `defineTransform()`, `expectMappingApplied()` helpers.

</code_context>

<specifics>
## Specific Ideas

### Scenario meteo PRD §29 (D-53)
F2 deve consegnare end-to-end (senza HTTP):
```typescript
// Plugin form
plugin.publish('weather.requested', {
  città: 'Roma',
  data: '30/04/2026'
})

// Internal canonical (post step 5):
{
  location: 'Roma',
  forecast_date: '2026-04-30'  // parseItalianDate transform
}

// Plugin widget riceve (post step 11 con suo inputMap):
{
  location: 'Roma',
  'day-prevision': '2026-04-30'  // alias inverse
}
```

Transforms registrate al boot del Broker (config: `transforms: { parseItalianDate: ..., normalizeLocationName: ... }`).

### Esempi mapping coperti (PRD §14.2)
- Rename: `città → location`
- Nested: `address.city → location` (via dot path)
- Default: `urgency → 'normal'` se assente
- Format transform: `data: '30/04/2026' → forecast_date: '2026-04-30'`
- Normalizzazione unità: `temp: '22°C' → temperature: 22` (numeric celsius)
- Derive: `fullName: $derive(['firstName', 'lastName'], (a, b) => `${a} ${b}`)`
- Partial mapping: solo i campi presenti vengono mappati; altri restano sul descriptor
- Validazione post-mapping: Valibot schema sul canonico

### Mapping Inspector come API pubblica
F2 espone `Broker.getMappingInspector()` che ritorna oggetto con `{ schemas, aliases, transforms, lastErrors }` — utile per debug. Inspector reale full-snapshot (payload before/after per ogni evento) deferred a F6.

</specifics>

<deferred>
## Deferred Ideas

### Non in scope F2 (da considerare in F3 o successive)
- **HTTP route `weather-http`** — `weather.requested` → `GET /api/weather` (F3)
- **Server response mapping** — `temp/condition/city → temperature_celsius/weather_condition/location` (F3 — riusa il MapperEngine F2 con inputMap server)
- **Cache key con scope user-aware** — chiave include `userId` per route auth (F6)
- **Worker payload canonicalization** — il route worker chiama `mapper.toCanonical(payload)` prima del dispatch (F5)
- **Event Inspector con full payload before/after per evento** — F6 (TOOL-01)
- **Adapter validation Zod/Ajv** — V2 (out of scope V1 per minimizzare bundle size)
- **IndexedDB persistence dei canonical schema** — V2 (in-memory only V1)
- **Hot-reload canonical schema** — V2; in V1 i schema sono immutabili dopo `registerCanonicalSchema`

### Considered but rejected
- **Auto-derive alias da name similarity (Levenshtein)** — rejected: PRD §5 esclude esplicitamente "mapping semantico ambiguo automatico senza configurazione esplicita"; il mapping esplicito + alias registry coprono i casi noti.
- **Mapping al runtime invece di pre-compile** — rejected: PITFALLS warns about hot-path overhead; pre-compilation è la scelta locked (D-34).

</deferred>

---

*Phase: 2-Canonical Model & Mapper*
*Context gathered: 2026-04-29 (auto-mode da PRD/ROADMAP/REQUIREMENTS post Phase 1 closure)*
