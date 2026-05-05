---
phase: 02-canonical-model-mapper
verified: 2026-04-29T17:30:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 4
re_verification: true
reviewed: 2026-04-29T18:25:00Z
override_rationale: |
  4 caveat human_needed risolti dal developer:
  - SC#2 Mapping Inspector partial → OVERRIDE 'passed': payloadBefore/After deferred coerentemente con
    D-48 + ROADMAP Phase 6 TOOL-01 (Inspector full UI). EventTap composition + 5 step F2 emessi con
    eventId reale = vincolo architetturale critico CLAUDE.md soddisfatto. Limitazione pianificata,
    non bug.
  - VAL-02 deferred F2 V2 → OVERRIDE 'accept': REQUIREMENTS.md già marcato Pending coerente; warn-and-ignore
    su config.topicSchemas è behavior intenzionale (broker-mapper-wrapper.ts:270-276).
  - MAP-11 checkbox stale → FIXED: aggiornato REQUIREMENTS.md riga 41 + 216 a [x]/Complete (commit 401644d).
  - Biome regression iter3 → FIXED: pnpm exec biome check --write applicato (commit 401644d). 0 errori,
    1 warning info-level non-blocking.
human_verification:
  - test: "Verifica che la limitazione esplicita di SC#2 (Mapping Inspector espone counter+lastErrors ma NON payload before/after per evento — deferred a F6/TOOL-01) sia accettabile come chiusura V1 di Phase 2"
    expected: "La ROADMAP success criterion #2 richiede testualmente: 'mostra per ogni evento: payload originale, payload canonicalizzato, payload finale consegnato al consumer, lista trasformazioni applicate, warning di ambiguità su alias risolto automaticamente, errori di trasformazione'. L'implementazione F2 V1 espone counter (canonicalSchemas/registeredAliases/registeredTransforms) + lastMappingErrors (ring buffer 50) + EventTap composition pronta + tap emette 5 step F2 con eventId reale, ma `payloadBefore`/`payloadAfter` sono no-op (recordSnapshot vuoto) — esplicitamente deferred a F6 TOOL-01 (vedi inspector.ts:137 + broker-mapper-wrapper.ts:287). Decidere se: (a) accettare come chiusura parziale V1 con override esplicito, (b) richiedere implementazione full per-event snapshot in F2."
    why_human: "L'implementazione corrisponde esattamente al pattern documentato nella PATTERNS.md/CONTEXT.md/PRD §13.5 (vincolo architetturale 'EventTap pre-instrumentato F2, real impl F6'); il deferral è coerente con la roadmap. Decisione di scope (è una limitation pianificata, non un bug)."
  - test: "Verifica che VAL-02 (validazione payload topic via topicSchemas) sia accettabile come deferred a F2 V2"
    expected: "ROADMAP Phase 2 lista VAL-02 nei requirements (linea 71 ROADMAP.md). L'implementazione attuale (broker-mapper-wrapper.ts:270-276) emette warning quando config.topicSchemas è presente: 'config.topicSchemas è riservato per F2 V2 (deferred); attualmente ignorato'. REQUIREMENTS.md top-list riga 103 ha checkbox `[ ]` (Pending) e traceability table riga 287 dice 'Pending'. Decidere se: (a) accettare deferral V2 con override, (b) richiedere implementazione VAL-02 in F2 V1 prima di chiudere."
    why_human: "Stesso pattern di MAP-15 — deferral pianificato e documentato; il REQUIREMENTS.md è già coerente nel marcarlo Pending; serve decisione di scope per chiusura formale Phase 2."
  - test: "Verifica MAP-11 (validazione post-mapping integrata) — REQUIREMENTS.md riga 41 ha `[ ]` Pending nel top-list ma l'implementazione esiste"
    expected: "MAP-11 è listato `[ ]` Pending nel top-list REQUIREMENTS.md riga 41, MA il codice mostra `mapper-engine.ts:392 validateCanonical()` invocato sia al passo 6 (publisher canonical, broker-mapper-wrapper.ts:411) sia al passo 12 (consumer final, wrapConsumerHandler) — l'implementazione esiste e è coperta da test (mapper-engine.test.ts:688-747 'Test 25/25b/25c/25d validateCanonical'). Decidere se: (a) aggiornare REQUIREMENTS.md riga 41 a `[x]` per consistency (raccomandato), (b) accettare l'inconsistenza."
    why_human: "Discrepanza documentale: il test esiste e passa, l'implementazione è wired, ma il checkbox top-list non è stato aggiornato. Cleanup raccomandato per chiarezza milestone."
  - test: "Verifica regressione biome (6 formatter errors + 1 lint error noNonNullAssertion) introdotta dai 3 iter3 commits post-SUMMARY 02-12"
    expected: "SUMMARY 02-12 riga 84 dichiara 'biome ✅ exit 0'. Esecuzione corrente di `pnpm exec biome check packages/mapper` mostra 6 formatter errors (broker-mapper-wrapper.ts, mapper-engine.ts, mapper-engine.test.ts, valibot-adapter.ts, weather-scenario.integration.test.ts) + 1 lint warning + 1 lint error (mapper-engine.test.ts:782 noNonNullAssertion). Causa: i 3 iter3 commits (3981fe5, 91ddf9a, 467a388) hanno introdotto codice non formattato. Decidere se: (a) richiedere `pnpm exec biome check --write packages/mapper` come final cleanup pre-Phase 3, (b) accettare e fixare in F3."
    why_human: "Il biome check non è formalmente in `package.json` ci:* scripts (solo publint/attw/size sono ci:* scripts), quindi NON è formalmente CI gate breaking. È però standard di progetto e la SUMMARY claim di 'biome ✅' è ora stale. 30 secondi di fix per restore baseline."
---

# Phase 2: Canonical Model & Mapper — Verification Report

**Phase Goal:** Esiste un Canonical Vocabulary Registry con campi tipizzati e alias riconosciuti; il mapper bidirezionale traduce payload locale → canonico → locale per ogni consumer secondo la regola di canonicalizzazione interna completa V1 (PRD §13.5); il Mapping Inspector mostra payload originale, canonico, finale, trasformazioni applicate e warning di ambiguità.

**Verified:** 2026-04-29T17:30:00Z
**Status:** human_needed (5/5 success criteria functionally verified, 4 items richiedono decisione developer)
**Re-verification:** No (initial verification post phase close 2026-04-30)

## Goal Achievement

### Observable Truths (5 ROADMAP Success Criteria)

| #   | Truth (ROADMAP Success Criterion) | Status | Evidence |
| --- | --------------------------------- | ------ | -------- |
| 1   | Scenario meteo PRD §29 E2E (form publish weather.requested con `città/data` italiani → mapper canonicalizza via `parseItalianDate`+`normalizeLocationName` → widget consumer riceve `{location, day-prevision}`) | ✓ VERIFIED | `packages/mapper/src/__integration__/weather-scenario.integration.test.ts:36-150` test "form publishes weather.requested with città/data → widget receives location/day-prevision" PASS. Verifica end-to-end: mappato `città→location` + `data→forecast_date` (con `parseItalianDate` da `30/04/2026` → `2026-04-30`); widget riceve `{location: 'Roma', 'day-prevision': '2026-04-30'}`. Test addizionale "multiple consumers different inputMap" (riga 152-228) verifica TEST-02 (plugin↔plugin con mapping diverso). |
| 2   | Mapping Inspector mostra payload originale + canonical + finale + trasformazioni + warning + errori | ⚠️ PARTIAL — vedi human_needed #1 | **Implementato:** `inspector.ts:103-205` MappingInspector class con `getSnapshot()` ritorna `{canonicalSchemas, registeredAliases, registeredTransforms, lastMappingErrors, droppedErrorsCount}`. `recordError` registra ring buffer bounded 50 (WR-09). `wrapTap` compositor garantisce composition non-breaking col tap utente. EventTap emette 5 step F2 (`event.source.resolved/mapped.canonical/canonical.validated/mapped.consumer/final.validated`) con `eventId` reale (WR-01 iter3) propagato cross-step. Test `inspector-snapshot.integration.test.ts:18-115` (5 test) verifica counter/dynamic-update/snapshot-shape/no-mutation-leak; test `mapping-error-event.integration.test.ts:160-201` verifica errors recorded in inspector. **Limitation:** `recordSnapshot` è no-op runtime in F2 V1 — `payloadBefore`/`payloadAfter` per evento NON popolati (esplicitamente deferred a F6 TOOL-01, vedi `inspector.ts:137` + `broker-mapper-wrapper.ts:287`). La ROADMAP wording richiede "mostra per ogni evento: payload originale, payload canonicalizzato, payload finale" — questo è coperto solo dal contratto EventTap pre-instrumentato (architectural constraint CLAUDE.md), non da API debug consumer-facing in V1. |
| 3   | Mapper supporta tutti casi PRD §14.2 (rename, nested, default, transform, normalize, derive, partial, validation post-mapping) + `registerTransform` | ✓ VERIFIED | `weather-scenario.integration.test.ts:230-298` test "PRD §14.2 cases" verifica end-to-end: rename (`oldName→renamed`), nested (`a.b.c→nested`), transform (`upper`), derive (`concatSpace([x,y])`), partial (`ignored` field omesso da canonical). Test "default applies when source missing" (riga 300-345) verifica MAP-06. `registerTransform` esposta da `broker-mapper-wrapper.ts:635` (test 02-10 + 02-11). Validation post-mapping (MAP-11) wired ai passi 6 + 12 via `validateCanonical` (mapper-engine.ts:392 + broker-mapper-wrapper.ts:411 + 994). |
| 4   | Open issues PRD §39 chiusi: MAP-17 (mapping esplicito vince sugli alias), VAL-08 (required field), VAL-09 (transform onFailure block/skip/fallback) | ✓ VERIFIED | **MAP-17:** `alias-ambiguity.test.ts:82-130` test "explicit outputMap wins over global alias" PASS — verifica D-40 livello 1 (esplicito) prevale su livello 3 (alias globale). Plus `mapper-engine.ts` valuta esplicito PRIMA di chiamare `AliasRegistry.resolve` per costruzione (D-40 ordering). **VAL-08:** `mapper-engine.test.ts:698-756` test 25b/25c/25d/25h `validateCanonical` enforces required:true field missing → ok:false; type mismatch → ok:false; non-object → ok:false; null+required → type mismatch (NOT missing). **VAL-09:** `transform-failure-modes.test.ts:31-356` 6 test deterministic verifica block (publishes mapping.error + skips delivery), skip (omits field, no error), fallback with default (applies default), fallback without default (degrades to skip), canonical validation failure, required+skip orthogonality. |
| 5   | Cycle detection rifiuta mapping circolare al `registerPlugin` (NON runtime) | ✓ VERIFIED | `cycle-detection.integration.test.ts:23-156` 3 test PASS: (1) `mapping.cycle.detected` thrown at registerPlugin con `details.pluginId/cycle` array; (2) determinismo — stesso descriptor → stesso cycle path su 3 harness fresche; (3) cycle thrown at register, NOT at runtime publish (publish post-failure NON throw — rollback completo). |

**Score:** 5/5 truths funzionalmente verificate. SC#2 ha caveat di scope (limitation pianificata, deferred a F6 — richiede decisione developer per chiusura formale).

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `packages/mapper/src/canonical-registry.ts` | CanonicalRegistry class — register/has/get/list/onRegistered/unregister + RESERVED_KEYS guard (WR-03 iter3) | ✓ VERIFIED | 222 LOC. `register` con strict mode + `requires` cycle detection (D-36). 9 unit test in `canonical-registry.test.ts` PASS. Importato da broker-mapper-wrapper.ts:33. |
| `packages/mapper/src/alias-registry.ts` | AliasRegistry class — registerGlobal/registerScoped/resolve (D-40 4-tier resolution) + RESERVED_KEYS guard | ✓ VERIFIED | 272 LOC. resolve ritorna discriminated union `{canonical, ambiguous, source: 'scoped'\|'global'\|'name-match'\|'unresolved'}`. Test `alias-registry.test.ts` (216 LOC) + `alias-ambiguity.test.ts` (10 test integration) PASS. |
| `packages/mapper/src/transform-pipeline.ts` | TransformPipeline class — register/apply con D-44 onFailure policy | ✓ VERIFIED | 187 LOC. apply() supporta block (default, throw mapping.transform.failed)/skip (return undefined)/fallback (defaultValue param). Test `transform-pipeline.test.ts` (185 LOC) + `transform-failure-modes.test.ts` (6 integration test) PASS. |
| `packages/mapper/src/valibot-adapter.ts` | ValidatorAdapter implementation Valibot 1.x | ✓ VERIFIED | 154 LOC. Discriminated union `{ok:true,value}\|{ok:false,issues}` — NO throw (D-38). `~run` Valibot 1.x API (WR-A iter2). Test `valibot-adapter.test.ts` (128 LOC) PASS. |
| `packages/mapper/src/mapper-engine.ts` | MapperEngine — compileMappings, applyOutputMap, applyInputMap, validateCanonical, isCanonicalOnly (BL-01 iter3) | ✓ VERIFIED | 769 LOC. `compileMappings` con cycle detection register-time (D-35). `validateCanonical` (line 392) enforces required + type checks. Test `mapper-engine.test.ts` (867 LOC) PASS. WIRED in `broker-mapper-wrapper.ts:411,994`. |
| `packages/mapper/src/inspector.ts` | MappingInspector + wrapTap helper | ✓ VERIFIED (artifact) / ⚠️ HOLLOW (data flow) | 252 LOC. Counter via 3 registries DI. Ring buffer 50 (WR-09). `recordSnapshot` no-op F2 V1 (deferred F6 — vedi SC#2 caveat). Test `inspector.test.ts` (246 LOC) PASS. WIRED in `broker-mapper-wrapper.ts:268` (wrapTap composition) + `:686` (getMappingInspector exposed). |
| `packages/mapper/src/broker-mapper-wrapper.ts` | MapperBroker class — composition wrapper non modifica F1 (D-49) | ✓ VERIFIED | 1087 LOC. Public surface: registerPlugin/unregisterPlugin/publish/subscribe/registerCanonicalSchema/registerTransform/registerAlias/getMappingInspector/getDebugSnapshot. Emette i 5 step F2 via `emitF2Tap` con eventId pre-allocato via nanoid (WR-01 iter3). Test `broker-mapper-wrapper.test.ts` (698 LOC) + 7 integration test files PASS. |
| `packages/mapper/src/public-factory.ts` | createMapperBroker factory | ✓ VERIFIED | 134 LOC. Valibot config validation con sezioni F2 augmented (canonicalModel/aliasRegistry/transforms). Test `public-factory.test.ts` (85 LOC) PASS. |
| `packages/mapper/src/augment.ts` | TS declaration merging — PluginDescriptor + BrokerConfig estesi F2 | ✓ VERIFIED | 109 LOC. side-effect import nel barrel index.ts (T-02-09-01 mitigation: package.json `sideEffects` array). Test `augment.test.ts` (117 LOC) PASS. |
| `packages/mapper/src/index.ts` | Barrel public API | ✓ VERIFIED | 181 LOC. Esporta 11 simboli runtime + 30+ tipi pubblici. Smoke import `node -e "import('./dist/index.js')"` ritorna `["AliasRegistry","CanonicalRegistry","MapperBroker","MapperEngine","MappingInspector","TransformPipeline","__augmentLoaded","createMapperBroker","isMappingErrorCode","valibotAdapter","wrapTap"]`. |
| `packages/mapper/README.md` | DOC-03 — scenario meteo + API + policy + roadmap | ✓ VERIFIED | 368 LOC (era 30 LOC skeleton). Sezioni: Quickstart §29 / API surface / MAP-17 resolution order / VAL-08 field policy / VAL-09 transform failure / Mapping Inspector / Cycle detection / Validation adapter / Pipeline §28 / Vincoli / Roadmap F3-F6 / Success criteria. WR-02 iter3 corregge `validation.field.missing` → `mapping.field.missing` allineato a MappingErrorCode. |
| `packages/mapper/src/__integration__/*.test.ts` | 7 integration test files (5 success criteria + 2 robustness) | ✓ VERIFIED | 7 file: weather-scenario, alias-ambiguity, cycle-detection, inspector-snapshot, mapping-error-event, plugin-cleanup-mapper, transform-failure-modes. 50+ test integration. Tutti usano `createMapperHarness` reale (NO mock interni F2 — D-49 + plan 02-11 vincolo). |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| MapperBroker.publish | inner Broker.publish | `inner.publish(topic, canonicalPayload, {...options, id: preAllocatedEventId})` | ✓ WIRED | broker-mapper-wrapper.ts:474 — pre-genera eventId (WR-01 iter3) e propaga via options.id; inner.publish riusa via createBrokerEvent F1. |
| MapperBroker.publish | mapper.applyOutputMap | `canonicalPayload = this.mapper.applyOutputMap(sourcePluginId, payload)` | ✓ WIRED | broker-mapper-wrapper.ts:393 — invocato solo se `!isCanonicalOnly` (BL-01 iter3 fix). Errore 'block' → handleMappingError → mapping.error + skip delivery. |
| MapperBroker.publish | mapper.validateCanonical (step 6) | `validateCanonical(compiledSchemaId, canonicalPayload)` | ✓ WIRED | broker-mapper-wrapper.ts:411 — REQ MAP-11 step 6. Fail → handleMappingError 'event.canonical.validated' + skip delivery. |
| MapperBroker.subscribe (consumer-side) | mapper.applyInputMap (step 11) | `wrapConsumerHandler(pluginId, handler)` | ✓ WIRED | broker-mapper-wrapper.ts:927-988. Auto-applicato via Proxy in wrapPluginContext quando ctx.broker.subscribe è chiamato dal plugin. |
| MapperBroker (consumer-side) | mapper.validateCanonical (step 12) | `validateCanonical(consumerSchemaId, mappedPayload)` | ✓ WIRED | broker-mapper-wrapper.ts:994 — REQ MAP-11 step 12. Fail → handleMappingError 'event.final.validated' + skip delivery to this consumer. |
| MapperBroker | EventTap (5 F2 step) | `emitF2Tap(step, topic, {eventId, metadata})` | ✓ WIRED | broker-mapper-wrapper.ts:325-336. 5 invocazioni: 386 (event.source.resolved publish-side) + 396 (event.mapped.canonical) + 424 (event.canonical.validated) + 978 (event.source.resolved consumer-side, WR-04 iter3 doppia semantica) + 988 (event.mapped.consumer) + 996 (event.final.validated). |
| MapperBroker.unregisterPlugin (LIFE-02 ext F2) | mapper/alias/transforms cascade | inner.unregisterPlugin → aliasRegistry.unregisterScopedAll → transforms.unregisterByOwner → mapper.unregisterPluginMappings | ✓ WIRED | broker-mapper-wrapper.ts:518-554. Test plugin-cleanup-mapper.integration.test.ts verifica counter post-unregister == baseline. |
| MapperBroker constructor | wrapTap composition | `this.tap = wrapTap(userTap, this.inspector)` | ✓ WIRED | broker-mapper-wrapper.ts:268. Inspector vede sempre snapshot pristine PRIMA del tap utente (WR-04 fix). |
| Mapper internals | Inspector recordError | broker handleMappingError → inspector.recordError | ✓ WIRED | broker-mapper-wrapper.ts:548 (cascade) + handleMappingError → inspector.recordError. Test mapping-error-event.integration.test.ts:181-201 verifica `inspector.lastErrors()` populated. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| broker-mapper-wrapper.ts (publish) | canonicalPayload | mapper.applyOutputMap (rules + alias resolution) | Sì (transforms/aliases applicati) | ✓ FLOWING |
| broker-mapper-wrapper.ts (subscribe) | mappedPayload | wrapConsumerHandler → mapper.applyInputMap | Sì (canonical → locale via inputMap) | ✓ FLOWING |
| inspector.ts (recordSnapshot) | per-event snapshot.payloadBefore/After | Wrapper passa solo `eventId/topic/step/timestamp/metadata.pluginId` (no payloadBefore/After) | **No (F2 V1 no-op intenzionale)** | ⚠️ HOLLOW (deferred F6 TOOL-01) |
| inspector.ts (getSnapshot) | counter | canonicalRegistry.list().length + aliasRegistry.listGlobal().length + transformPipeline.list().length | Sì (live count via DI) | ✓ FLOWING |
| inspector.ts (lastErrors) | errorBuffer | recordError invocato da broker handleMappingError | Sì (verificato da mapping-error-event.test:181-201) | ✓ FLOWING |
| MapperBroker.getDebugSnapshot | mappings section | inspector.getSnapshot() | Sì (4 counter + lastMappingErrors live) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Test suite mapper completa passa | `pnpm -F @gluezero/mapper test` | 16 file / 183 test PASS in 1.00s | ✓ PASS |
| Test suite core invariata (D-49 strict) | `pnpm -F @gluezero/core test` | 24 file / 248 test PASS in 1.22s | ✓ PASS |
| D-49 vincolo: bus.ts unchanged dal Phase 1 close | `git diff f7faadb..HEAD -- packages/core/src/core/bus.ts` | empty (0 lines, 0 commits) | ✓ PASS |
| Build mapper produce dist/ | `pnpm -F @gluezero/mapper build` | dist/index.js 72.05 KB ESM + dist/index.d.ts 61.84 KB | ✓ PASS |
| TypeScript typecheck mapper | `pnpm -F @gluezero/mapper exec tsc --noEmit` | clean (no errors) | ✓ PASS |
| publint mapper | `pnpm exec publint packages/mapper` | "All good!" | ✓ PASS |
| attw ESM-only mapper | `pnpm exec attw --pack ./packages/mapper --profile=esm-only` | 🟢 node16 (from ESM) + 🟢 bundler | ✓ PASS |
| size-limit mapper budget | `pnpm exec size-limit` | 11662 / 12000 bytes gzip (97%, 338 B headroom) | ✓ PASS |
| Smoke import public API | `node -e "import('./packages/mapper/dist/index.js')"` | 11 simboli esportati: AliasRegistry/CanonicalRegistry/MapperBroker/MapperEngine/MappingInspector/TransformPipeline/__augmentLoaded/createMapperBroker/isMappingErrorCode/valibotAdapter/wrapTap | ✓ PASS |
| **Biome check (project standard)** | `pnpm exec biome check packages/mapper` | 6 formatter errors + 1 lint error (mapper-engine.test.ts:782 noNonNullAssertion) + 1 warning | ✗ FAIL — vedi human_needed #4 |

### Requirements Coverage (27 REQ-IDs Phase 2)

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| MAP-01 | 02-03 | Canonical Vocabulary Registry | ✓ SATISFIED | CanonicalRegistry implementation + tests |
| MAP-02 | 02-03/02-09 | registerCanonicalSchema | ✓ SATISFIED | broker-mapper-wrapper.ts:618 + canonical-registry.ts |
| MAP-03 | 02-09/02-10 | inputMap/outputMap declarations | ✓ SATISFIED | augment.ts PluginDescriptor extension + types/input-output-map.ts |
| MAP-04 | 02-07 | Rename | ✓ SATISFIED | weather-scenario.test.ts:230-298 "PRD §14.2 cases" rename verified |
| MAP-05 | 02-07 | Nested mapping (dot path) | ✓ SATISFIED | Stesso test, nested `a.b.c→nested` |
| MAP-06 | 02-07 | Default values | ✓ SATISFIED | weather-scenario.test.ts:300-345 "default applies" |
| MAP-07 | 02-07 | Transform di formato | ✓ SATISFIED | parseItalianDate `30/04/2026` → `2026-04-30` verified |
| MAP-08 | 02-07 | Normalizzazione unità | ✓ SATISFIED | normalizeLocationName transform registered + test verified |
| MAP-09 | 02-07 | Derive ($derive concat-like) | ✓ SATISFIED | concatSpace test in weather-scenario.test.ts |
| MAP-10 | 02-07 | Partial mapping | ✓ SATISFIED | Test "ignored field NOT in canonical" verified |
| MAP-11 | 02-07/02-10 | Validazione post-mapping integrata | ⚠️ SATISFIED (REQUIREMENTS.md riga 41 stale `[ ]`) | validateCanonical wired step 6 (broker-wrapper:411) + step 12 (subscribe:994). Test 25b/c/d/h verifica. **Cleanup raccomandato**: aggiornare REQUIREMENTS.md riga 41 a `[x]`. Vedi human_needed #3. |
| MAP-12 | 02-05 | registerTransform + fallback | ✓ SATISFIED | TransformPipeline + broker-mapper-wrapper.ts:635 |
| MAP-13 | 02-07/02-10 | Canonicalizzazione interna completa V1 | ✓ SATISFIED | applyOutputMap + applyInputMap dispatch table compilato |
| MAP-14 | 02-10 | Mapping bidirezionale | ✓ SATISFIED | Step 11 wrapConsumerHandler verified |
| MAP-15 | 02-08 | Mapping Inspector | ⚠️ PARTIAL | Counter+lastErrors+EventTap composition verified. Per-event payload before/after deferred F6. Vedi SC#2 + human_needed #1. |
| MAP-16 | 02-04/02-12 | Warning runtime alias ambiguo | ✓ SATISFIED | alias-ambiguity.test.ts (10 test) — `ambiguous: true` discriminated union nel resolve |
| MAP-17 | 02-04/02-07 | Mapping esplicito vince sugli alias (PRD §39 #1) | ✓ SATISFIED + CLOSES PRD §39 #1 | alias-ambiguity.test.ts:82-130 verified D-40 livello 1 > livello 3 |
| VAL-02 | 02-10 | Validazione payload topic (topicSchemas) | ✗ DEFERRED V2 | broker-mapper-wrapper.ts:270-276 emette warn "F2 V2 deferred". REQUIREMENTS.md riga 103 `[ ]`. Vedi human_needed #2. |
| VAL-03 | 02-06/02-07 | Validazione modello canonico | ✓ SATISFIED | validateCanonical step 6 |
| VAL-04 | 02-06/02-07 | Validazione post-mapping | ✓ SATISFIED | validateCanonical step 12 |
| VAL-07 | 02-06/02-10 | Errori validazione registrati in debug | ✓ SATISFIED | mapping.error event + inspector.recordError ring buffer |
| VAL-08 | 02-07 | Required field policy (PRD §39 #3) | ✓ SATISFIED + CLOSES PRD §39 #3 | mapper-engine.test.ts:698-756 (Test 25b/h) |
| VAL-09 | 02-05/02-12 | Transform failure policy (PRD §39 #4) | ✓ SATISFIED + CLOSES PRD §39 #4 | transform-failure-modes.test.ts (6 test) verifica block/skip/fallback |
| ERR-02 (mapping.error) | 02-10 | Eventi standard error | ✓ SATISFIED | mapping-error-event.integration.test.ts (4 test) verifica D-58 |
| TEST-01 (mapping subset) | 02-11 | Unit test mapping/reverse/transforms | ✓ SATISFIED | 16 test file / 183 test (tutti i casi PRD §35.1 mapping subset) |
| TEST-02 (plugin A→plugin B) | 02-11 | plugin↔broker↔plugin con mapping diverso | ✓ SATISFIED | weather-scenario.test.ts:152-228 "multiple consumers different inputMap" |
| DOC-03 | 02-12 | Documentazione canonical model + mapper | ✓ SATISFIED | README 368 LOC con scenario meteo + API + 3 policy table + JSDoc package-level @example |

**Coverage:** 26/27 SATISFIED, 1 DEFERRED V2 (VAL-02), 1 con discrepancy documentale minor (MAP-11 implementato ma top-list `[ ]`).

**Open Issues PRD §39 chiusi in F2:** ✓ #1 (MAP-17), ✓ #3 (VAL-08), ✓ #4 (VAL-09).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| broker-mapper-wrapper.ts | 270-276 | `topicSchemas` config silently ignored con warn | ℹ️ Info | Documenta deferred V2 (VAL-02). Pattern accept con warning visibility. |
| inspector.ts | 137-139 | `recordSnapshot` no-op intenzionale | ⚠️ Warning | F2 V1 limitation rispetto a SC#2 ROADMAP wording. Vedi human_needed #1. JSDoc esplicita. |
| broker-mapper-wrapper.ts | 287-303 | `payloadBefore`/`payloadAfter` esplicitamente deferred F6 | ⚠️ Warning | Stessa limitation. Documentato nel makeF2Snapshot JSDoc + README §Mapping Inspector. |
| mapper-engine.test.ts | 782 | `result.issues[0]!` non-null assertion | ⚠️ Warning | Biome lint error. Test code only. Fix banale: `expect(result.issues[0]).toBeDefined(); const issue = result.issues[0]; if (issue) {...}` |
| 5 files (broker-wrapper, mapper-engine, valibot-adapter, weather-scenario.test, mapper-engine.test) | various | Formatter not applied post iter3 commits | ⚠️ Warning | 6 biome formatter errors. SUMMARY 02-12 claim "biome ✅" stale. Fix banale: `pnpm exec biome check --write packages/mapper`. Vedi human_needed #4. |

### Human Verification Required

#### 1. Accettabilità della limitation SC#2 (Mapping Inspector payload before/after deferred F6)

**Test:** Determinare se l'implementazione F2 V1 del Mapping Inspector copre adeguatamente success criterion #2 della ROADMAP.
**Expected:** ROADMAP testualmente: "il Mapping Inspector mostra per ogni evento: payload originale, payload canonicalizzato, payload finale consegnato al consumer, lista trasformazioni applicate, warning di ambiguità su alias risolto automaticamente, errori di trasformazione". Implementazione corrente:
  - ✓ Counter via getDebugSnapshot().mappings (canonicalSchemas/registeredAliases/registeredTransforms)
  - ✓ Errori di trasformazione via `lastMappingErrors` ring buffer (50, WR-09)
  - ✓ Warning di ambiguità: `AliasRegistry.resolve` ritorna `ambiguous: true` (consumibile via mapper-engine internamente)
  - ✓ EventTap composition pre-instrumentata: 5 step F2 emessi con eventId reale cross-step (preparazione F6)
  - ✗ Per evento: payload originale/canonicalizzato/finale → DEFERRED F6 TOOL-01 (recordSnapshot no-op intenzionale; payloadBefore/After non popolati nei snapshot F2)
  - ✗ Lista trasformazioni applicate per evento → DEFERRED F6

**Why human:** L'architectural constraint CLAUDE.md "EventTap pre-instrumentato F2, real impl F6" autorizza esplicitamente questa partizione. PATTERNS.md (D-46/D-47/D-48) documenta la scelta. Coerente con ROADMAP § "EventTap interface (predisposta in F1, implementata in F6)" Phase 6 success criterion #2. Decisione di scope (è limitation pianificata, non bug).

**Opzioni:**
  - (a) Accettare come chiusura V1 di Phase 2 con override esplicito in VERIFICATION.md frontmatter:
    ```yaml
    overrides:
      - must_have: "Mapping Inspector mostra payload originale + canonical + finale per evento"
        reason: "Deferred a F6 TOOL-01 per architectural constraint EventTap (F1 pre-instrument, F6 real impl). EventTap pre-instrumentato F2 con 5 step + eventId cross-step propagato — pronto per popolazione full snapshot in F6 senza retrofit."
        accepted_by: "<your name>"
        accepted_at: "<ISO timestamp>"
    ```
  - (b) Richiedere implementazione full per-event payload before/after in F2 prima di chiusura → richiederebbe nuovo plan 02-13.

#### 2. Accettabilità del deferral di VAL-02 (validazione payload topic) a F2 V2

**Test:** Determinare se VAL-02 può restare deferred V2 o richiede implementazione in F2 V1.
**Expected:** ROADMAP linea 71-72 lista VAL-02 nei requirements Phase 2. REQUIREMENTS.md riga 103 e 287 dichiarano `Pending`. Implementazione attuale (`broker-mapper-wrapper.ts:270-276`):
```typescript
if ((config as { topicSchemas?: unknown }).topicSchemas !== undefined) {
  this.logger.warn(
    'MapperBroker: config.topicSchemas è riservato per F2 V2 (deferred); attualmente ignorato',
  )
}
```
Coverage attuale: warn visibility OK, ma nessuna validazione effettiva del payload-per-topic. Differente da MAP-11 (validazione canonical, implementata).

**Why human:** Decisione di scope: ROADMAP include VAL-02 ma 12/12 plan non hanno implementato la feature. Probabile sovrastima scope iniziale.

**Opzioni:**
  - (a) Override VERIFICATION.md frontmatter con motivo "VAL-02 topicSchemas validation deferred V2 — F2 V1 valida solo canonical model (post-mapping); validazione topic-specific richiede design separato (es. schema registry per topic) fuori scope V1".
  - (b) Aggiornare ROADMAP.md per rimuovere VAL-02 da Phase 2 requirements (sposta a F2 V2 o F6).
  - (c) Pianificare un plan 02-13 per chiudere VAL-02 prima di Phase 3.

#### 3. Cleanup REQUIREMENTS.md — checkbox stale per MAP-11

**Test:** Aggiornare REQUIREMENTS.md riga 41 da `[ ]` a `[x]` per MAP-11.
**Expected:** MAP-11 (validazione post-mapping integrata) ha implementazione completa (`mapper-engine.ts:392 validateCanonical` invocata ai passi 6 + 12, tests `mapper-engine.test.ts:688-756` Test 25-25h tutti PASS), ma REQUIREMENTS.md riga 41 ha checkbox `[ ]` (non aggiornato). Traceability table riga 216 dice "Pending". Discrepanza documentale.

**Why human:** Documentation cleanup banale (~ 30 secondi). Decisione di proprietà: chi aggiorna REQUIREMENTS.md (orchestrator post-verify? developer? agente cleanup?).

#### 4. Regressione Biome (6 formatter + 1 lint error) post-iter3

**Test:** Eseguire `pnpm exec biome check --write packages/mapper && pnpm exec biome check packages/mapper` per ripristinare biome ✅ baseline.
**Expected:** SUMMARY 02-12 dichiara "biome ✅". Esecuzione corrente mostra 6 formatter errors (broker-mapper-wrapper.ts, mapper-engine.ts, mapper-engine.test.ts, valibot-adapter.ts, weather-scenario.integration.test.ts) + 1 lint error (mapper-engine.test.ts:782 noNonNullAssertion) + 1 warning. Causa: 3 iter3 commits (3981fe5, 91ddf9a, 467a388) hanno introdotto codice non formattato post-final gate.

**Why human:** Biome non è formalmente in `package.json ci:*` scripts (solo publint/attw/size lo sono), quindi NON è formal CI gate breaking. È però standard di progetto e claim SUMMARY ora stale. Decisione: fix immediato pre-Phase 3 vs accettare come regressione minor da fixare in F3.

### Gaps Summary

**Status:** Phase 2 success criteria sono funzionalmente verificati al 100% in ambito implementativo. Tutti i 5 SC ROADMAP hanno test integration dedicati che PASS. Tutti i 27 REQ-IDs F2 sono coperti (26 SATISFIED + 1 DEFERRED V2 noto).

**Caveat critici (richiedono decisione developer):**

1. **SC#2 (Mapping Inspector) — partial vs ROADMAP wording**: l'implementazione copre l'API surface (counter, lastErrors, EventTap composition con eventId cross-step) ma differisce dalla ROADMAP testuale "mostra per ogni evento: payload originale, payload canonicalizzato, payload finale" che è esplicitamente deferred a F6 TOOL-01 per architectural constraint EventTap pre-instrumented. Coerente con la roadmap; richiede override formale o riformulazione SC#2 wording.

2. **VAL-02 — deferred V2**: requirement listato in ROADMAP Phase 2 ma implementazione warn-and-ignore. REQUIREMENTS.md è già coerente nel marcarlo Pending. Decisione scope.

3. **MAP-11 — checkbox stale**: implementazione presente, REQUIREMENTS.md top-list non aggiornato. Cleanup banale.

4. **Biome regression — minor**: 6 formatter + 1 lint error post-iter3 commits. Non è formal CI gate ma standard progetto. SUMMARY 02-12 claim stale.

**No blocker findings.** Tutti i caveat sono "decisione developer" (intentional deferrals + cleanup minor) — nessun bug funzionale.

**Vincoli architetturali confermati:**
- ✓ D-49 strict: `git diff f7faadb..HEAD -- packages/core/src/core/bus.ts` empty + core 248/248 invariati.
- ✓ EventTap pre-instrumentation F2: 5 step F2 emessi con eventId reale (WR-01 iter3) cross-step deterministico — pronto per F6 sostituzione no-op senza retrofit.
- ✓ Italiano: tutti i SUMMARY/CONTEXT/PATTERNS/REVIEW/REVIEW-FIX in italiano. Codice/identifiers in inglese (CLAUDE.md compliance).
- ✓ Modello opus-4-7-1 implicit (REVIEW-FIX iter1/iter2/iter3 con `gsd-code-fixer, opus-4-7-1`).

**Test coverage finale:**
- mapper: 16 file / 183 test PASS in 1.00s
- core: 24 file / 248 test PASS in 1.22s (D-49 invariati)
- TypeScript: clean
- Build: dist/index.js 72.05 KB ESM + dist/index.d.ts 61.84 KB
- size-limit: 11662/12000 bytes gzip (97% budget, 338 B headroom)
- publint + attw esm-only: PASS

---

_Verified: 2026-04-29T17:30:00Z_
_Verifier: Claude (gsd-verifier, opus-4-7-1)_
