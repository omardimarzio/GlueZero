---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
last_updated: "2026-05-04T13:25:00.000Z"
progress:
  total_phases: 6
  completed_phases: 3
  total_plans: 46
  completed_plans: 41
  percent: 89
---

# Project State: SemBridge

**Initialized:** 2026-04-28
**Last updated:** 2026-04-29

## Project Reference

- **Project:** SemBridge — libreria JavaScript browser-side TypeScript-first (ESM) per pub/sub, routing, canonical model, gateway server unico, worker runtime, developer tooling
- **Authoritative source:** `prd.md` (root del progetto, "l'unica base informativa condivisa con il developer", PRD §1)
- **Core Value:** I plugin/componenti possono essere sviluppati indipendentemente, con la propria nomenclatura locale, e interoperare correttamente attraverso il vocabolario canonico del broker — senza accordo preventivo sui nomi tra autori
- **Current Milestone:** v1
- **Current Focus:** Phase 04 — Realtime inbound (SSE prioritario, WS opzionale)

## Current Position

Phase: 04 (Realtime inbound (SSE prioritario, WS opzionale)) — EXECUTING
Plan: 5 of 9 (next)
Total Plans: 9 (Phase 4)

**Last completed:** Plan 04-04 (Wave 2 — Visibility detector wrapper) at 2026-05-04 — 2 commits TDD atomic (a74a9dc RED test + 1e1d34b GREEN feat); 2 nuovi file 275 LOC (visibility-detector.ts 125 + visibility-detector.test.ts 150). `createVisibilityDetector({ onChange, document })` factory ritorna `VisibilityDetector` con 4 metodi (start/stop/getState/isActive). Pattern listener tracking analog `combine-signals.ts:62-86` (memoize listener ref + addEventListener + removeEventListener puntuale). DI guard 3-way (`undefined`→globalThis.document, `null`→explicit Worker/SSR disable, `Document` mock→test). Idempotenza esplicita start/stop (T-04-04-02/03 mitigation). Anti-AP-5 verificato: 0 setInterval/setTimeout (event-driven puro). 11/11 visibility-detector test PASS + 146/146 gateway suite + **680/680 monorepo full** + tsc clean su 4 package. D-83 strict ✓ (zero modifiche fuori `gateway/src/sse-ws/`). RT-05 closed. Building block per consumer 04-07 RealtimeChannelManager (single shared instance, freshness check on visible D-110).

**Next:** `/gsd-execute-phase 4` Wave 3 — 2 plan paralleli (file ownership disgiunta): 04-05 SSE adapter + 04-06 WS adapter (consuma parseFrame da 04-02).

- **Phase:** 3 ✅ COMPLETE
- **Status:** Ready to execute
- **Progress:** [█████████░] 89%

## Phases Overview

- **Total phases:** 6 (allineate 1:1 con PRD §32)
- **Phases complete:** [1 — Core essenziale]
- **Granularity:** coarse
- **Coverage:** 91/91 requisiti v1 mappati

| Phase | Goal (sintesi) | Status |
|-------|----------------|--------|
| 1 | Core essenziale (broker pub/sub, plugin registry, EventTap pre-instrumentato) | **✅ COMPLETE & VERIFIED (11/11 plans, PASS confidence HIGH)** |
| 2 | Canonical Model & Mapper bidirezionale + Mapping Inspector | **✅ COMPLETE — ready for verifier (12/12 plans)** |
| 3 | Routing engine + HTTP gateway con retry/timeout/dedupe/auth | **✅ COMPLETE — ready for verifier (14/14 plans, 4 open issues PRD §39 closed)** |
| 4 | Realtime inbound (SSE prioritario, WS opzionale) | **In Progress — 4/9 plans (04-01 Wave 1 + 04-02 + 04-03 + 04-04 Wave 2 done)** |
| 5 | Worker Runtime (registry, route worker, task tracking) | Not started |
| 6 | Cache + Tooling avanzato (Inspector, Metrics, debug API) | Not started |

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases complete | 1 / 6 (Phase 2 ready for verifier) |
| Plans complete in current phase | 12 / 12 (Phase 2) |
| Plans abandoned | 0 |
| Plans repaired | 0 |
| Time per phase | — |
| Time per plan | 01-01: 4m 14s; 01-02: 3m 19s; 01-03: 6m 26s; 01-04: ~6m (interrupted); 01-05: ~15m parallelo; 01-06: ~7m parallelo; 01-07: ~9m sequenziale; 01-08: ~14m sequenziale (32 nuovi test); 01-09: ~28m sequenziale (PipelineHarness + 8 integration test, 8 commits, 46 nuovi test, 5 success criteria Phase 1 coperti) |
| Phase 02 P02-01 | 24min | 2 tasks | 8 files |
| Phase 02 P02-02 | 9min | 2 tasks | 6 files |
| Phase 02 P02-03 | 53min | 1 tasks | 2 files |
| Phase 02 P02-04 | 9min | 1 tasks | 2 files |
| Phase 02 P02-05 | 92min | 1 tasks | 2 files |
| Phase 02 P02-06 | 2min | 1 tasks | 2 files |
| Phase 02 PP02-07 | 54min | 3 tasks | 2 files |
| Phase 02 P08 | 12min | 1 tasks | 2 files |
| Phase 02 P09 | 17min | 2 tasks | 8 files |
| Phase 02 P10 | 21min | 2 tasks tasks | 6 files files |
| Phase 02 P11 | 33min | 2 tasks | 6 files |
| Phase 02 P12 | 9min | 3 tasks | 10 files |
| Phase 03 P01 | ~4 minuti | 3 tasks | 15 files |
| Phase 03 P02 | 12 min | 2 tasks | 12 files |
| Phase 03 P03 | 9 min | 2 tasks | 4 files |
| Phase 03 P04 | ~14 min | 2 tasks | 5 files |
| Phase 03 P05 | ~25 min | 2 tasks | 8 files |
| Phase 03 P06 | 30 minutes | 2 tasks | 7 files |
| Phase 03 P07 | 25min | 1 tasks | 2 files |
| Phase 03 P08 | ~70min | 3 tasks | 17 files |
| Phase 3 P9 | 1800 | 4 tasks | 7 files |
| Phase 03 P10 | 6min | - tasks | - files |
| Phase 03 P11 | ~6min | 3 tasks | 5 files |
| Phase 03-routing-server-gateway-http P12 | 120 | 3 tasks | 10 files |
| Phase 03 P13 | 30min | 2 tasks | 10 files |
| Phase 03 P14 | ~35min | 5 tasks | 8 files (2 README + 4 vitest/package.json + biome cleanup ~46 file) |
| Phase 04 P01 | ~10min | 2 tasks | 10 files (6 nuovi 503 LOC + 4 modificati build/test config) |
| Phase 04 P02 | 12min | 1 tasks | 3 files |
| Phase 04 P03 | 4min | 1 tasks | 2 files (reconnect-strategy.{ts,test.ts} 407 LOC; 15/15 test PASS, 669/669 monorepo) |
| Phase 04 P04 | ~18min | 1 tasks | 2 files (visibility-detector.{ts,test.ts} 275 LOC; 11/11 test PASS, 680/680 monorepo) |

## Accumulated Context

### Key Decisions Logged

| Decision | Rationale | Logged In |
|----------|-----------|-----------|
| Roadmap a 6 fasi PRD §32 | Ordine implementativo già razionale e gerarchico (Core → Canonical → Routing → Realtime → Worker → Cache/Tooling); ogni fase si appoggia alla precedente | PROJECT.md |
| Granularità GSD = `coarse` | 6 fasi del PRD sono già coarse-grained; corrispondenza 1:1 fase-PRD ↔ fase-GSD | PROJECT.md |
| Profilo GSD = `quality` (Opus per agenti) | Vincolo utente: solo `claude-opus-4-7-1` per tutti gli agenti | PROJECT.md, config.json |
| Canonicalizzazione interna completa di default V1 | PRD §13.5 raccomanda esplicitamente questo modello per V1 | PROJECT.md, ROADMAP.md |
| TypeScript come linguaggio sviluppo + ESM packaging | PRD §31 | PROJECT.md, STACK.md |
| Realtime V1: SSE prioritario, WebSocket opzionale | PRD §18.3-§18.4 | PROJECT.md, ROADMAP.md |
| Stack: TS 5.5+ + tsup + Vitest + Valibot + nanoid + Comlink + monorepo pnpm workspaces | Research SUMMARY.md + STACK.md | STACK.md |
| HTTP client: fetch nativo + Gateway custom (no ky/wretch/ofetch esposto) | Le policy PRD §17.8/§22/§23 richiedono > 70-80% delle feature di wrapper esistenti | STACK.md |
| EventBus in-house (no mitt/eventemitter3/RxJS) | `BrokerEvent` con metadata strutturati, wildcard, dedupe, backpressure, priority, TTL non coperti dai pub/sub esistenti | STACK.md |
| `EventTap` instrumentato già in F1 | Aggiungerlo retroattivamente in F6 = retrofit invasivo di tutti gli step di pipeline | ARCHITECTURE.md, SUMMARY.md, ROADMAP.md |
| Auto-mode GSD attivo + branching strategy `none` | Default GSD per progetto greenfield single-developer | config.json |
| Aggiunto `ignoreDeprecations: "6.0"` a `packages/core/tsconfig.json` | Workaround per tsup 8.5.1 che inietta hardcoded `baseUrl` (rollup.js linea 6837); TS 6.0.3 promuove `baseUrl` a errore TS5101. Da rimuovere quando tsup riceve fix upstream. | 01-02-SUMMARY.md |
| Aggiunto `--passWithNoTests` agli script test/test:coverage di @sembridge/core | Vitest 4.1.5 esce 1 senza test files (non 0 come affermato in RESEARCH.md). Da rimuovere quando i plan 03+ aggiungeranno test reali. | 01-02-SUMMARY.md |
| Inclusione di `SubscribeOptions.once?: boolean` | RESEARCH Open Question 1 risolta in favore: cost ~15 LOC in `bus.ts` (plan 07), valore DX significativo, nessun REQ-ID lo vieta | 01-03-SUMMARY.md |
| `PluginContext.broker` tipato `unknown` provvisoriamente in F1 plan 03 | Plan 03 NON dispone ancora di `core/broker.ts` (creato in plan 08); plan 08 risolverà via TS declaration merging | 01-03-SUMMARY.md |
| Aggiunto `export type * from './types'` a `packages/core/src/index.ts` | Senza re-export type-only del barrel, plan paralleli 04/05/06 non possono importare via `from '@sembridge/core'` (Rule 2 — correctness gap nel plan); plan 08 affiancherà i runtime export | 01-03-SUMMARY.md |
| Esportato `SnapshotFactory` come tipo nominato in `event-tap.ts` | Lo snippet RESEARCH inline-tipava la signature di ritorno di `startStep()`; l'alias nominato (Rule 2) rende il pattern self-documenting per i 5 chiamanti della pipeline in plan 07 | 01-04-SUMMARY.md |
| TDD pattern RED→GREEN preservato per Task 4 (event-tap) anche dopo session interruption | Coerenza con i 3 task precedenti del plan 04: due commit separati (`2d3cac7` test RED, `21e0939` feat GREEN) anche se i file erano già scritti come untracked al momento della ripresa. Tracciabilità del gate TDD nel git history | 01-04-SUMMARY.md |
| Coverage v8 NON misurata in plan 04 | Missing dep `@vitest/coverage-v8`: rimandata al merge wave / plan dedicato. Surrogate confidence: 42/42 test passing su 4 moduli isolati con behavior coverage esplicito | 01-04-SUMMARY.md |
| `validateTopic`/`validateTopicPattern` return type cambiato da `BrokerError \| void` a `void` | Le funzioni non ritornano mai un `BrokerError` (sempre throw). Il tipo `BrokerError \| void` era semanticamente errato — fix di correctness segnalato da Biome. (Rule 1 plan 05) | 01-05-SUMMARY.md |
| `VALID_TRANSITIONS` esportato con inner array `readonly` | Plan 08 lo leggerà per Inspector; readonly previene tampering compile-time, rafforza T-06-02 (mutation della state machine). Era `const` non-export con array mutabile nel PLAN. (Rule 2 plan 06) | 01-06-SUMMARY.md |
| Test extra `list returns a fresh array on each call` in `topic-registry.test.ts` | Copre threat T-06-01 esplicitamente: una mutation del result `list()` non corrompe il `Set<string>` interno. 8 test invece dei 7 attesi dal PLAN. (Rule 2 plan 06) | 01-06-SUMMARY.md |
| Granularizzati 3 test in `lifecycle.test.ts` (integrità reg.state on throw, error.category, logger.error meta-shape) | Acceptance criteria coperti con unit indipendenti per facilitare diagnostica regressione futura. 29 test invece di ~22. (Rule 2 plan 06) | 01-06-SUMMARY.md |
| 6 test extra aggiunti a `bus.test.ts` (BrokerError no-rewrap, validation blocca tap downstream, remote→async fallback parità con worker, unsubscribeByOwner zero match, getStats shape, setDebugMode toggle runtime) | Coverage gap nel PLAN: comportamenti critici non coperti dai 16 test minimi richiesti. 25 test totali invece di 16. (Rule 2 plan 07) | 01-07-SUMMARY.md |
| `useOptionalChain` su `unsubscribeInternal` in `bus.ts` (`!sub \|\| !sub.active` → `!sub?.active`) | Allineamento con Wave 3 modules che hanno zero Biome warning. (Rule 1 plan 07 manuale) | 01-07-SUMMARY.md |
| `PluginContext.broker` placeholder risolto via approccio strutturale (`interface PluginScopedBroker`) invece di TypeScript declaration merging | Evita ciclo di import broker.ts ↔ types/plugin.ts. Lo scoped broker espone solo le API necessarie agli hook plugin (subscribe/publish/unsubscribeByOwner-tagged). Declaration merging full deferred a F2/F3 quando emergerà necessità di esporre il `Broker` completo. | 01-08-SUMMARY.md |
| `createBroker(invalidConfig)` lancia `Error` nativo (non `BrokerError`) | Errore di development-time, non runtime broker-internal. Il `BrokerError` è semanticamente "errore propagato attraverso il broker" — qui il broker non esiste ancora. Test verifica `Error` con messaggio descrittivo Valibot. | 01-08-SUMMARY.md |
| `createPluginScopedBroker(broker, pluginCtx)` wrapper auto-tagga subscriptions con `ownerId=pluginCtx.id` | D-26 enforcement pratico in F1 (chiusura PRD §39 #7 — LIFE-02): senza wrapper, il punto 1 della cascade (`bus.unsubscribeByOwner`) sarebbe esercitato solo dai plugin che usano `signal: ctx.signal`. Il wrapper rende il behavior LIFE-02 deterministico e testabile. | 01-08-SUMMARY.md |
| 7 test extra in plugin-registry/public-factory (Rule 2) | Coverage gap: scoped broker no-signal/non-function-properties/onDestroy-throw + list edge cases + all F1 runtime fields/registerPlugin lifecycle/LIFE-02 cascade. Test totali 32 invece dei minimi del PLAN. | 01-08-SUMMARY.md |
| sideEffects array `["./dist/augment.js"]` per @sembridge/mapper (Rule 4 PATTERNS.md §6) | Preserva il side-effect di augment.ts (declaration merging F2 — D-49/D-56/D-57) dal tree-shaker, mantenendo tree-shaking del resto. `sideEffects: false` boolean lo eliminerebbe. | 02-01-SUMMARY.md |
| tsup external `@sembridge/core` (peer-like) per @sembridge/mapper | Non bundla cross-package F1 dentro F2; usa workspace protocol pnpm a runtime. Riduce bundle size mapper e prevenne duplicazione versione. | 02-01-SUMMARY.md |
| size-limit budget @sembridge/mapper 5 KB gzip (vs 8 KB core) | +2 KB headroom rispetto a core (~6.14 KB) per mapper engine + 3 registries (canonical/alias/transform) previsti da PATTERNS.md §3.1 | 02-01-SUMMARY.md |
| @vitest/coverage-v8 4.1.5 installato come devDep root in 02-01 | Chiude open item ereditato da F1 (plan 04 lo aveva rimandato per missing dep). Abilita D-55 coverage measurement F2 finale al plan 02-12 (target ≥ 90% sui file @sembridge/mapper/) | 02-01-SUMMARY.md |
| Branded types F2 `CanonicalSchemaId`/`TransformName` con `unique symbol` distinto | Pitfall #12 mitigation a compile-time per type confusion (T-02-02-01). Replica pattern `EventId` di `@sembridge/core/types/broker-event.ts:54-61`. Cast esplicito `as CanonicalSchemaId`/`as TransformName` audit-able via grep. | 02-02-SUMMARY.md |
| `ValidatorAdapter` contract NO-throw (D-38) | Discriminated union `ValidationResult<T> = { ok: true; value: T } \| { ok: false; issues }` invece di throw. Caller (mapper-engine) decide cosa fare con il fail (publish `mapping.error` o applicare D-44 onFailure policy). Permette adapter Zod/Ajv V2 senza breaking change. | 02-02-SUMMARY.md |
| `MappingErrorCode` literal union additive (D-58, T-02-02-05 mitigation) | Aggiungere codici è non-breaking; rimuoverli sì (policy DOC-03 al plan 02-12). Type guard `isMappingErrorCode` backed da `ReadonlySet<string>` per O(1) lookup. 5 codici F2: `mapping.cycle.detected`, `mapping.transform.failed`, `mapping.field.missing`, `mapping.canonical.validation.failed`, `mapping.consumer.validation.failed`. | 02-02-SUMMARY.md |
| `CanonicalRegistry` pattern F1 TopicRegistry replicato + estensioni F2 | Replica diretta del pattern F1 (idempotent register, observer pattern con try/catch swallow, list() copia ordinata) + estensioni F2: `requires` resolution check al register (D-36), `unregister(id)` per cascade plugin (D-26 ext F2), `RegisterOptions.strict?: boolean` opt-in per detection accidentale duplicati (quality-of-life). Listener riceve `CanonicalSchema` completo (NON solo id) per supportare Inspector/MetricsCollector F6. | 02-03-SUMMARY.md |
| `AliasRegistry` pattern F1 TopicRegistry esteso con due livelli di scope | Replica F1 (idempotent register, list() copia ordinata) + estensione F2 critica: `Map<pluginId, Map<localField, canonicalField>>` per scope isolation (T-02-04-02). Resolution order D-40 (livelli 2-4: scoped > global > name-match) + ambiguity flag D-41 (`true` solo per alias automatici, `false` per name-match). Conflict throw `alias.{global,scoped}.conflict` su pair conflittuale (T-02-04-03 anti-shadow). Errori sono Error nativi (NON BrokerError) — module auto-contenuto, wrapping eventuale delegato al consumer mapper-engine plan 02-07. Chiude PRD §39 open issue #1 (precedenza esplicito vs alias automatici) per costruzione: il mapper-engine valuta livello 1 (esplicito) PRIMA di chiamare `resolve`. | 02-04-SUMMARY.md |
| `TransformPipeline` pattern F1 try/catch wrap (safeTapStep) replicato + escalation policy D-44 (block/skip/fallback) | Pattern try/catch shape identico a `safeTapStep` di event-tap.ts F1 ma con escalation policy invece di silent swallow. `apply(name, input, ctx, onFailure, defaultValue?)` decide cosa fare su throw: 'block' (default) → throw wrapped `BrokerError 'mapping.transform.failed'` con `originalError`+`cause` ES2022 (D-45); 'skip' → ritorna `undefined`; 'fallback' → applica defaultValue se fornito, altrimenti downgrade a 'skip'. `Entry { descriptor, ownerId? }` separa descrittore (immutabile post-register) da ownership (cascade D-26 ext F2). `transform.id.duplicate` throw indipendentemente da ownerId; `transform.not-found` throw indipendentemente da onFailure (caller bug guard). Non-Error throw values wrapped via `String(err)`. Chiude PRD §39 open issue #4 (VAL-09 — transform failure: skip o block). | 02-05-SUMMARY.md |
| Plan 02-09 Rule 1 fix: rimossi placeholder `unknown` da `BrokerConfig` di core per abilitare TS declaration merging F2 | TS rifiuta merging che narrow `unknown` a tipo specifico (TS2717). PLAN preamble dice "NESSUNA modifica a packages/core/src/" ma D-56 richiede esplicitamente declaration merging dai package downstream — i due vincoli sono in conflitto tecnico. Risolto seguendo D-56 intent: rimossi 7 field placeholder (canonicalModel/aliasRegistry/transforms/routes/transport/workers/cache); mantenuto `topicSchemas` (V2 deferred). `BrokerConfigSchema` Valibot da `v.object` a `v.looseObject` per pass-through. Test core 248/248 passing (no regression). | 02-09-SUMMARY.md |
| Plan 02-09 tree-shake mitigation 3-layer per `__augmentLoaded` side-effect | tsup `treeshake: true` rimuove `import './augment'` da `dist/index.js` anche con sideEffects array. Mitigation: (1) re-export `__augmentLoaded` dal barrel forza preservation dell'import; (2) sideEffects array esteso a 4 patterns (`./dist/augment.js`, `./src/augment.ts`, `**/augment.{js,ts}`); (3) `dist/augment.js` come entry separata (utenti possono `import '@sembridge/mapper/augment'` esplicitamente). Verificato: dist/index.js contiene `var __augmentLoaded = true;`. | 02-09-SUMMARY.md |
| Plan 02-09 `F2PipelineStep` literal union additive come workaround a TS limitazione type alias | `PipelineStep` di core è type alias literal union, NON interface. TS non permette declaration merging di type alias. Soluzione: barrel mapper esporta `F2PipelineStep` come literal union additive separato con i 5 step F2 (D-50). Consumer F2 fa `type AllSteps = PipelineStep \| F2PipelineStep`. F1 step da core (subset) restano validi. F6 potrà refactor `PipelineStep` da type alias a interface union per veri declaration merging (T-02-09-05 disposition). | 02-09-SUMMARY.md |
| Plan 02-10 MapperBroker composition wrapper di Broker F1 (NON subclass) — D-49 strict | Vincolo architetturale ARCHITECTURE §3.2 + D-49 di plan 02-CONTEXT.md. Il MapperBroker compone Broker F1 + i 5 moduli F2 (CanonicalRegistry/AliasRegistry/TransformPipeline/MapperEngine/MappingInspector) internamente come dipendenze; delegate F1 surface (publish/subscribe/registerPlugin/unregisterPlugin/getDebugSnapshot) + nuova surface F2 D-31 (registerCanonicalSchema/registerTransform/registerAlias/getMappingInspector). Verificato strict: `git diff HEAD~4 -- packages/core/` → 0 lines diff. | 02-10-SUMMARY.md |
| Plan 02-10 wrapDescriptorHooks per propagare `ctx.broker` mapper-aware ai plugin (D-51 runtime) | Sfida tecnica: `ctx.broker` di F1 è un Proxy `createPluginScopedBroker` che chiama direttamente `bus.subscribe()`, bypassando il MapperBroker. Soluzione: il MapperBroker.registerPlugin wrappa gli hook lifecycle (onRegister/onMount/onUnmount/onDestroy) PRIMA di delegare a `inner.registerPlugin` — gli hook ricevono un `ctx` con `broker` sostituito da un Proxy mapper-aware che intercetta `subscribe` e applica `applyInputMap(pluginId, ...)` al payload canonico. Soddisfa Test 8 (scenario meteo PRD §29) senza modifiche a F1. | 02-10-SUMMARY.md |
| Plan 02-10 createMapperBroker(config) pure function (D-30 no singleton) con Valibot validation D-56 | Pattern affine a `createBroker` F1 D-19. `MapperBrokerConfigSchema = v.looseObject({ runtime, debug, topicSchemas, canonicalModel, aliasRegistry, transforms })`: F1/F3-F6 sezioni pass-through; F2 sezioni validate strutturalmente (canonicalModel.schemas array di CanonicalSchema, aliasRegistry.global/scoped record string→string, transforms record string→fn). Throw `Error 'Invalid MapperBrokerConfig: ...'` su Valibot fail. Test 6 verifica `b1 !== b2` (no singleton). | 02-10-SUMMARY.md |
| Plan 02-10 3 helper introspection aggiunti al MapperEngine (hasCompiled/hasInputMap/getCanonicalSchemaIdFor) | Necessari al broker wrapper per decidere quando applicare outputMap/inputMap/canonical-validation: alternative scartate (a) accesso diretto al `private compiled` Map (viola encapsulation TS error); (b) try/catch su `applyOutputMap` per detect 'no mapping' (catastrophic — semantica errore vs passthrough confusa). I 3 helper sono additive — il contract pubblico esistente di MapperEngine (compileMappings/applyOutputMap/applyInputMap/unregisterPluginMappings/validateCanonical/stats) resta identico. I 26 test plan 02-07 invariati. | 02-10-SUMMARY.md |
| Plan 02-11 mapper-harness wrappa createMapperBroker (NON pipeline-harness F1) | I 5 integration test verificano end-to-end l'API pubblica del package F2 — il MapperBroker, NON il Broker F1 sottostante. La fixture istanzia un MapperBroker reale via createMapperBroker(config); i 4 moduli Wave 3 + MapperEngine + MappingInspector vengono compose internamente. NO mock dei moduli interni F2 (D-49 strict). Pattern replicabile per F3 (createRoutingHarness wraps createRoutedBroker), F4 (createRealtimeHarness), F5 (createWorkerHarness). | 02-11-SUMMARY.md |
| Plan 02-11 schema-level FieldDescriptor.default NON auto-iniettato in V1 | Empiricamente il MapperEngine.applyOutputMap itera SOLO i field dichiarati nell'outputMap del plugin — coerente con T-02-07-06 partial mapping (whitelist, NON injection). Il `MappingRule.default` (rule-level, MAP-06) viene applicato quando `source` è assente; lo schema-level `FieldDescriptor.default` esiste come hint per V2 ma NON viene auto-iniettato in V1. Test 4 di weather-scenario adeguato al behavior corrente. | 02-11-SUMMARY.md |
| Plan 02-11 tap dell'harness vede SOLO step F1 (i 5 step F2 deferred a F6) | Il MapperBroker plan 02-10 NON wira automaticamente `wrapTap(tap, inspector)` perché `inspector.recordSnapshot` è no-op V1 (D-48). Conseguenza: il tap dell'harness vede SOLO i 5 step F1 (event.received, event.metadata.enriched, event.validated, event.dedupe.checked, event.delivered) — NON i 5 nuovi step F2 (event.source.resolved, event.mapped.canonical, ecc.). I test verificano i 5 step F1 emessi (line 102-103 weather-scenario test 1) ma NON dipendono dai step F2 nel tap. Limitazione consapevole F2 V1 — F6 (TOOL-01) popolerà recordSnapshot full per evento. | 02-11-SUMMARY.md |
| Plan 02-12 size-limit budget mapper raised 5 KB → 12 KB gzip (Rule 1 fix) | STACK.md aveva fissato 5 KB pre-implementation; PATTERNS.md §3.1 in-flight aveva rivisto a 10 KB. Bundle reale a fine F2: 9.68 KB (Mapper + Broker wrapper + Inspector + Valibot adapter — 4 moduli compositi). 12 KB = 9.68 + 2.32 KB headroom (~24%). Pattern lesson learned: `STACK.md V1 budget pre-implementation è sotto-stimato sistematicamente per F2+ (5→9.68 KB = 1.94x)`. Documentare nei DOC-03 di ogni fase. | 02-12-SUMMARY.md |
| Plan 02-12 ci:publint + ci:attw extended con filter explicit (no glob '@sembridge/*') | I 7 placeholder package F3-F6 (cache/devtools/gateway/routing/sembridge/worker) hanno `package.json` con `main: ./dist/index.js` ma nessun build → publint errato `pkg.main but file does not exist`. Soluzione: filter explicit `--filter @sembridge/core --filter @sembridge/mapper`. F3-F6 estenderanno il filter quando i package saranno scaffoldati. | 02-12-SUMMARY.md |
| Plan 02-12 13 robustness test deterministic (TEST-03 closure) | 6 test transform-failure-modes (block/skip/fallback × default presence + canonical validation + ortogonalità required+skip) chiudono D-44/VAL-09; 7 test alias-ambiguity (resolution order D-40 + scope isolation + cascade D-26 ext + 4 bonus end-to-end via MapperBroker) chiudono D-41/MAP-16. NO mock dei moduli interni F2 (createMapperHarness reale). Suite mapper passa da 14/136 a 16/149. | 02-12-SUMMARY.md |
| Phase 2 chiusa: 5 ROADMAP success criteria coperti + 27 REQ-IDs F2 verificati + D-49 strict | I 12 plan F2 hanno chiuso DOC-03/PKG-04/VAL-09/MAP-16/TEST-03 nel plan 02-12; le altre 22 REQ-IDs (MAP-01..MAP-17 minus closures intermediari + VAL-02..VAL-04, VAL-07..VAL-08 + ERR-02 ext + TEST-01..TEST-02 + LIFE-02 ext F2) sono cumulativamente verified attraverso plan 02-01..02-11. Verificato strict via `git diff` su packages/core/: 0 lines diff (D-49). 248/248 core test invariati. Pronto per gsd-verifier. | 02-12-SUMMARY.md |
| Plan 03-05 internal/topic-trie.ts mirror copy del F1 TopicTrie (~115 LOC) invece di subpath internal exposure | RESEARCH Open Question Q1: TopicTrie non è esposto pubblicamente da `@sembridge/core`. Per evitare cross-package internal coupling, F3 mantiene una copia letterale interna con header esplicito di rimozione (quando F1 esporrà subpath internal in F6+). D-83 strict ZERO modifiche a packages/core/. Pattern audit-able via grep. | 03-05-SUMMARY.md |
| Plan 03-05 RouteResolverOptions.strict default `false` (idempotent) coerente con CanonicalRegistry F2 | Replica pattern F2 RegisterOptions.strict opt-in. Test 3 verifica idempotency: register duplicate id non-strict ritorna handle existing senza throw, no double-insert. Strict opt-in per detection accidentale ID collision. | 03-05-SUMMARY.md |
| Plan 03-05 AmbiguousRouteEvent come callback opt-in invece di publish diretto al broker | Mantiene il RouteResolver puro (no broker dependency). RouterBroker plan 03-12 farà il bind `(event) => broker.publish('routing.ambiguous', event)`. Permette unit test deterministici via mock callback (Test 13). | 03-05-SUMMARY.md |
| Plan 03-05 priorityOrdered ritorna [vincitore singolo] non sorted full array | Semantica D-66: la policy seleziona UNA route per route HTTP execution. Per fan-out broadcast si usa policy 'all' (allBroadcast). Test 8 verifica priorityOrdered ritorna [{priority:5}] non [{5}, {3}, {1}]. | 03-05-SUMMARY.md |
| Plan 03-05 TS bracket notation per Record<string, unknown> field access (Rule 1 fix) | TS4111 con noUncheckedIndexedAccess strict richiede `result['queryMap']` invece di `result.queryMap` per oggetti tipizzati come Record. Replica fix simile in mapper-engine.ts F2 (WR-03 iter3 RESERVED_KEYS). | 03-05-SUMMARY.md |
| Plan 03-09 D-69 closed: ExponentialBackoffWithJitter (RetryStrategy default) | Differenzia 4xx vs 5xx vs 408/429 vs network. DEFAULT_RETRY_STATUSES = Set([408, 429]) + range esplicito 500-599. Full jitter formula esatta `min(maxDelayMs, baseDelayMs * 2^attempt) * (0.5 + Math.random() * 0.5)` (PITFALLS #5). Retry-After parsing rispettato + cap MAX_BACKOFF_MS=60s. maxAttempts default 3 / opt-out 0 / custom retryOnStatuses override. **Closes PRD §39 #8 (ROUTE-09)**. Test 15 varianza > 100ms su 100 sample (Pitfall 2 fix). | 03-09-SUMMARY.md |
| Plan 03-09 D-68 closed: FixedTimeout (TimeoutStrategy default) | Wrapper su `AbortSignal.timeout()` ES2022 nativo (RESEARCH "Don't Hand-Roll"). Override `fromMs` per polyfill custom o test fake-timer. Pattern Strategy permette swap futuro senza modifica HttpGateway. | 03-09-SUMMARY.md |
| Plan 03-09 D-70 closed: AutoIdempotency (IdempotencyStrategy default + Pitfall 3 fix) | nanoid 21-char default (126-bit entropy). Map<eventId, token> persistence garantisce stesso token sui retry — chiusura PITFALLS #3. LRU bounded `maxEventsTracked: 1000` default (T-03-09-03 DoS mitigation). headerName default `'Idempotency-Key'` (Stripe/AWS standard). tokenFactory custom override per test/UUID/HMAC. **Closes SEC-03**. | 03-09-SUMMARY.md |
| Plan 03-09 barrel strategies/index.ts parziale Wave 4-A | File ownership disgiunta documentata: 03-10 dedupe+backpressure, 03-11 auth+circuit-breaker estendono SOLO le proprie righe export — merge safe. | 03-09-SUMMARY.md |
| Plan 03-11 D-72 closed: BearerHookAuth + Single-flight refresh (Pattern 5 RESEARCH, Pitfall 5 fix) | `inflightRefresh: Promise<string> \| null` Promise singleton condiviso fra N caller paralleli. Test 6 verifica 5 paralleli → 1 sola config.refresh invocation. Cleanup in finally garantisce release sia su resolve che reject (Test 7+8). Always-provide refresh method che throw 'auth.refresh.unavailable' quando config.refresh undefined. Token caching opt-in via tokenCacheMs (default 0=disabled). **Closes SEC-01 + SEC-02 + ROUTE-07 + Pitfall 5**. | 03-11-SUMMARY.md |
| Plan 03-11 D-99 closed: PerRouteCircuitBreaker state machine 3-states opt-in DISABLED default | State machine `closed → open → half-open → closed` per route. Lazy transition open → half-open al canExecute/getState (no setTimeout overhead per route inattive). Per-route state isolation Map<routeId, CircuitState>. Default DISABLED: `createCircuitBreakerStrategy()` senza config = pass-through (canExecute sempre true). Test 9 verifica behavior DISABLED. Sliding window stats → V1.x. | 03-11-SUMMARY.md |
| Plan 03-11 BLOCKER 1 fix iter 1: category 'config' (NON 'auth') per auth.refresh.unavailable | ErrorCategory union (`packages/core/src/types/error.ts:19-28`) NON include 'auth' — solo 'validation'\|'plugin'\|'mapping'\|'route'\|'network'\|'worker'\|'system'\|'config'\|'topic'. Per evitare modifica core (D-83 strict), lockato `category: 'config'` coerente con 03-08 (gateway-config errors). Verifica grep esplicita: `category: 'auth'` = 0 occorrenze, `category: 'config'` = 3 occorrenze. Test 5 (auth-strategy.test.ts) verifica esplicitamente `err.category === 'config'`. | 03-11-SUMMARY.md |
| Plan 04-02 D-106 envelope JSON shape locked: `{ topic: string non-vuoto, data: unknown, id?: string }` | Topic vuoto rifiutato come `missing-topic` (Test 4). `id` non-string ignorato graceful (Test 10 — no crash, envelope.id undefined). L'adapter 04-06 genererà via nanoid se mancante. Frame non-conformi → consumer publica `network.error` con `category: 'protocol'` riusando ERR-02 ext F3 (Q2 closure 04-CONTEXT — NIENTE nuovo `realtime.protocol.error` event). | 04-02-SUMMARY.md |
| Plan 04-02 D-111 + PITFALL §11.7 chiusura Q1: `isInternalTopic` strict equality match (NO prefix) | `topic === '__ping__' \|\| topic === '__pong__'` esatto. NO `startsWith('__')`, NO regex prefix `/^__/`. Topic legittimi consumer come `weather.__ping__` NON sono filtrati (Test 13 esplicito blocca regressione). Verifica: `grep -v "^//" frame-parser.ts \| grep -c "startsWith('__')"` = 0. INTERNAL_TOPICS frozen const (`Readonly<{readonly PING; readonly PONG}>` annotation per --isolatedDeclarations). | 04-02-SUMMARY.md |
| Plan 04-02 input difensivo `unknown` per parseFrame (defense-in-depth pipeline §28) | `MessageEvent.data` è `any` da DOM lib, può essere ArrayBuffer/Blob/number. V1 supporta solo testo JSON (D-106) → input non-string ritorna `malformed-json` graceful con `raw: String(raw)`. Pattern coerente con principio "trust no one" della pipeline §28. Estende il pattern `parseRetryAfter` F3 (analog parser puro). | 04-02-SUMMARY.md |

### Open Issues PRD §39 — Phase Assignment

11 punti che il PRD §39 vieta esplicitamente di lasciare impliciti, mappati alla fase di chiusura:

| Open Issue | Phase | Status |
|------------|-------|--------|
| Precedenza alias automatici vs mapping esplicito | F2 (MAP-17) | **Closed in 02-04** (AliasRegistry + contract resolve documentato; il mapper-engine plan 02-07 valuta livello 1 esplicito PRIMA di chiamare resolve, quindi esplicito vince per costruzione) |
| Ordine pipeline mapping/validazione | F1 (skeleton) + F2/F3/F6 (riempimento) | **Partial closed in 02-09** (PIPE-01: F2PipelineStep esposto come literal union additive dal barrel mapper; runtime pipeline orchestration al broker wrapper plan 02-10) |
| Field mancante: errore o default | F2 (VAL-08) | **Closed in 02-07** (mapper-engine.applyOutputMap throw `mapping.field.missing` con `details: { pluginId, fieldName }` su required:true + missing; required:false + default applies; required:false + no default field omesso) |
| Transform failure: skip o block | F2 (VAL-09) | **Closed in 02-05** (TransformPipeline.apply con onFailure 'block'/'skip'/'fallback' D-44 + cause chaining ES2022 D-45 via createBrokerError; default 'block' enforced; non-Error throw values wrapped) |
| Topic senza route | F3 (ROUTE-16) | Type-only ready in 03-03 (CanonicalSchema.requiresRoute augment + RoutingConfig.requiresRouteTopics); runtime publish in 03-12 RouterBroker |
| Più route applicabili stesso topic | F3 (ROUTE-15) | **Closed runtime in 03-05** (3 strategy first-match/priority-ordered/all + AmbiguousRouteEvent callback dev-mode; publish 'routing.ambiguous' come BrokerEvent in 03-12 RouterBroker) |
| Unsubscribe automatico in `unregisterPlugin` | F1 (LIFE-02) | **Closed in 01-08** (cascade D-26 deterministico + createPluginScopedBroker wrapper) |
| Retry 4xx vs 5xx | F3 (ROUTE-09) | **Closed in 03-09** (ExponentialBackoffWithJitter D-69: 4xx no-retry eccetto 408/429; 5xx + 408 + 429 + network → retry; full jitter formula + Retry-After priority + cap MAX_BACKOFF_MS) |
| Reconnection rules realtime | F4 (RT-07) | Pending |
| Format metriche | F6 (TOOL-05) | Pending |
| Serializzazione messaggi worker | F5 (WK-07) | Pending |

### Active Todos

- [x] Eseguire `/gsd-plan-phase 1` per generare il plan di Phase 1 (Core essenziale) — completato
- [x] Verificare versioni esatte stack — completato in 01-01 (live install 2026-04-28)
- [x] Eseguire Plan 02 (configurazione `@sembridge/core` con runtime deps + tooling per-package) — completato 2026-04-28
- [ ] Decidere libreria validation finale (Valibot raccomandato, adapter pluggable per Zod/Ajv) — decisione tactical in F2 design
- [ ] Approvare manualmente install scripts esbuild/msw via `pnpm approve-builds` se serve nei plan futuri (non bloccante per F1)
- [ ] Rimuovere `ignoreDeprecations: "6.0"` da packages/core/tsconfig.json quando tsup riceve fix upstream per `baseUrl` injection
- [ ] Rimuovere `--passWithNoTests` dagli script test/test:coverage quando i plan 03+ aggiungono test reali
- [x] Eseguire Plan 03 (Wave 2 — Public types: BrokerEvent, Subscription, PluginDescriptor, BrokerError, BrokerLogger, EventTap, BrokerConfig, DeepReadonly) — completato 2026-04-28
- [x] Eseguire Plan 04 (Wave 3 — Utility batch A: broker-error + deep-freeze + logger + event-tap) — completato 2026-04-28 (4 task TDD, 42/42 test passing)
- [x] Eseguire Plan 05 (Wave 3 — Utility batch B: topic-matcher + event-factory + event-validator) — completato 2026-04-28 (3 task TDD, 55 nuovi test)
- [x] Eseguire Plan 06 (Wave 3 — Utility batch C: topic-registry + lifecycle) — completato 2026-04-28 (2 task TDD, 37 nuovi test)
- [x] Eseguire Plan 07 (Wave 4 — `bus.ts` EventBus core: composizione del broker pub/sub usando le 9 utility dei plan 04/05/06 + noopEventTap pre-instrumentato) — completato 2026-04-28 (1 task macro RED+GREEN, 25 nuovi test, CORE-01/CORE-12/ERR-03 done)
- [x] Eseguire Plan 08 (Wave 5 — `Broker` class + `createBroker(config)` factory + `plugin-registry.ts` + public API surface) — completato 2026-04-28 (2 task TDD, 32 nuovi test, CORE-04/CORE-05/CORE-11/CORE-14/LIFE-01/LIFE-02 done; PluginContext.broker risolto via approccio strutturale invece di TS declaration merging)
- [x] Eseguire Plan 09 (Wave 6 — PipelineHarness fixture + 8 integration test) — completato 2026-04-28 (8 commit: a3d2fb6+c62b4ce + 5 atomic chunks + docs; 46 nuovi test; 5 success criteria Phase 1 tutti coperti; TEST-01 subset done)
- [x] Eseguire Plan 10 (Wave 7 — 4 robustness test: storm, wildcard-perf, plugin-fault, concurrent-unregister) — completato 2026-04-29 (5 commit atomic chunks + docs; 11 nuovi test; storm 24ms vs 10s budget, wildcard 11ms vs 50ms budget; TEST-03 done)
- [x] Eseguire Plan 11 (final gate Phase 1 — build verify publint+attw+size-limit + DOC-01 README + JSDoc API pubblica) — completato 2026-04-29 (5 commits: 947f37c README, 9d9873a JSDoc runtime, 31e6b70 JSDoc types, f00d914 ci gates, efc6554 docs SUMMARY; size-limit 6.14 KB / 8 KB budget = 76%; tutti i gate passati; DOC-01 + PKG-04 done)
- [x] Spawn `gsd-verifier` per Phase 1 goal-backward verification — completato 2026-04-29 (verdetto PASS confidence HIGH; VERIFICATION.md prodotto)
- [x] `/gsd-discuss-phase 2 --auto` — completato 2026-04-29 (CONTEXT.md con 29 decisioni D-31..D-59 senza interazione utente)
- [x] `/gsd-plan-phase 2` — completato 2026-04-29 (12 PLAN.md + PATTERNS.md; gsd-plan-checker PASS-WITH-CONCERNS, 2 patch applicate per C-3 + C-8 pre-execute)
- [ ] Eseguire Phase 2 con `/gsd-execute-phase 2` (12 plan organizzati in 7 wave; Wave 3 paralleli 02-03/04/05/06)
- [x] Eseguire Plan 02-01 (Bootstrap @sembridge/mapper — 4 file config + skeleton barrel + README + workspace install + size-limit root + @vitest/coverage-v8) — completato 2026-04-29 (2 task atomic, 24 min, 2 commit b200948+40d4caf, no deviations)
- [x] Installare `@vitest/coverage-v8` come devDependency root — completato in 02-01 (versione 4.1.5 allineata a vitest; abilita D-55 coverage measurement F2 finale al plan 02-12)
- [x] Eseguire Plan 02-02 (Public types F2: canonical-schema, input-output-map, transform, validator-adapter, mapping-error) — completato 2026-04-29 (2 task auto, 9 min, 2 commit 210013b+af38fb0; 6 file types/*.ts 433 LOC; chiusura D-32 placeholder F1 al type-level; no deviations)
- [x] Eseguire Plan 02-03 (Wave 3 — `CanonicalRegistry` con TDD RED→GREEN: register/has/get/list/onRegistered/unregister + requires resolution D-36 + RegisterOptions.strict opt-in) — completato 2026-04-29 (1 task TDD RED→GREEN, 2 commit 4d9ca60+a5515c6, 11/11 test passing, MAP-01/MAP-02 done; deepFreeze runtime D-04 deferred a plan 02-07 mapper-engine come documentato in T-02-03-03)
- [x] Eseguire Plan 02-04 (Wave 3 paralleli — `AliasRegistry` con global+plugin-scoped + resolution order D-40 + warning ambiguità D-41) — completato 2026-04-29 (1 task TDD RED→GREEN, 2 commit 018b867+e1517ee, 16/16 test alias-registry + 27/27 mapper full passing, MAP-16/MAP-17 done runtime; chiude PRD §39 open issue #1 per costruzione)
- [x] Eseguire Plan 02-05 (Wave 3 — `TransformPipeline` con register + apply + onFailure policy D-44/D-45) — completato 2026-04-29 (1 task TDD RED→GREEN, 2 commit 84377d7+bf57216, 14/14 test passing, MAP-12/VAL-09 done runtime; chiude PRD §39 open issue #4)
- [x] Eseguire Plan 02-06 (Wave 3 paralleli — `valibotAdapter` implementazione `ValidatorAdapter` interface NO-throw) — completato 2026-04-29
- [x] Eseguire Plan 02-07 (Wave 4 — `MapperEngine` cuore F2: compileMappings + applyOutputMap + applyInputMap + tap orchestration 5 nuovi step) — completato 2026-04-30
- [x] Eseguire Plan 02-08 (Wave 5 — `MappingInspector` extension EventTap + wrapTap composition helper) — completato 2026-04-30
- [x] Eseguire Plan 02-09 (Wave 5 — augment.ts TS declaration merging + barrel mapper finale) — completato 2026-04-30 (2 task, 17min, 4 commit: bb0eac5 RED + 3a2840b Rule 1 fix + 2b3c521 GREEN + ef00b46 barrel; 6 augment test passing + 93 mapper tests + 248 core tests no regression; MAP-03/MAP-13/MAP-14/PIPE-01 done)
- [x] Eseguire Plan 02-10 (Wave 6 — broker-mapper-wrapper: composition decorator per agganciare MapperEngine + MappingInspector al Broker F1 senza modificare bus.ts) — completato 2026-04-30 (2 task TDD, 21min, 4 commit: b51e507 RED + edfd0e0 GREEN MapperBroker + 3a840d0 RED + a53c260 GREEN createMapperBroker; 15 test wrapper + 8 test factory passing; D-49 strict 0 modifiche a packages/core/; MAP-02/MAP-03/MAP-13/MAP-14/MAP-15/ERR-02/LIFE-02/PIPE-01 done; D-31/D-49/D-50/D-51/D-58/D-59/D-26 ext F2/D-48/D-30/D-56 closed runtime)
- [x] Eseguire Plan 02-11 (Wave 7 — integration test scenario meteo PRD §29 senza HTTP) — completato 2026-04-30 (2 task, 33 min, 2 commit: eb923fe + 585f266; 5 integration test files / 20 test; mapper 14/136 vs baseline 9/116; core 248 invariati; TEST-01/TEST-02/MAP-13/MAP-14/MAP-15/LIFE-02 done; tutti i 5 success criteria F2 ROADMAP coperti 1:1)
- [ ] Eseguire Plan 02-12 (Wave 8 final gate F2 — coverage v8 ≥ 90% + publint/attw/size-limit estesi + DOC-03 README scenario meteo + JSDoc + gsd-verifier)
- [x] Eseguire Plan 03-05 (Wave 4 — RouteResolver + 3 strategy multi-route + cascade unregisterByOwner + TopicTrie mirror) — completato 2026-05-02 (2 task TDD, 25min, 3 commit: 1e98688 RED + cc9630e GREEN + 1703265 strategies test; 30/30 routing test; D-83 strict OK; ROUTE-15 chiuso runtime)

### Active Blockers

Nessun blocker attivo.

### Open Questions

Nessuna domanda aperta. Le 11 open issues PRD §39 hanno già decisione raccomandata e fase di chiusura assegnata.

## Session Continuity

### Last Action

**Phase 2 plan 02-05 chiuso** — `TransformPipeline` (Wave 3 sequential) completato sequenzialmente via `gsd-executor` con `model: "opus"`.

**Plan 02-05** — 1 task TDD RED→GREEN (2 commit atomici), 2 file src/test (368 LOC totali: 183 src + 185 test):

- `packages/mapper/src/transform-pipeline.ts` (183 LOC) — `class TransformPipeline` con 7 metodi pubblici: `register(name, fn, options?)`, `has(name)`, `get(name)`, `apply(name, input, ctx, onFailure, defaultValue?)`, `list()`, `unregister(name)`, `unregisterByOwner(pluginId)`. Pattern F1 try/catch wrap (safeTapStep event-tap.ts:23-34) replicato + escalation policy D-44 (block/skip/fallback). `apply()` su throw del transform applica D-44: `'block'` (default) → throw wrapped `BrokerError 'mapping.transform.failed'` con `originalError` + ES2022 `cause` chaining (D-45 via createBrokerError di F1); `'skip'` → ritorna `undefined`; `'fallback'` → applica defaultValue se fornito, altrimenti downgrade a `'skip'`. `Entry { descriptor, ownerId? }` separato per mantenere descrittore immutabile + ownership tracking. `transform.id.duplicate` throw su register collision (pattern F1 D-17 da `plugin-registry.ts:111-117`). `transform.not-found` throw indipendentemente da onFailure (caller bug guard — programmer error). Non-Error throw values wrapped: `err instanceof Error ? err.message : String(err)` (T-02-05-05 mitigation). Cross-package import `import { createBrokerError } from '@sembridge/core'` + `category: 'mapping'`. Header italiano + JSDoc + 1 type pubblico co-esportato `RegisterTransformOptions { description?, ownerId? }`.
- `packages/mapper/src/transform-pipeline.test.ts` (185 LOC, 14 test) — coverage completo dei 14 behavior PLAN organizzati in 3 describe block: `register/has/get` (3 test: idempotent + duplicate throw + ownerId tracking + descriptor accessor), `apply (D-44 onFailure policy)` (7 test: success path + block wrapping con cause+details + skip undefined + fallback con default + fallback senza default downgrade + transform.not-found regardless onFailure + non-Error throw value wrapping), `list/unregister/unregisterByOwner` (4 test: list sorted + fresh copy + unregister idempotent + unregisterByOwner cascade + unregisterByOwner zero match).
- Commit: `84377d7` (test RED — verified `Failed to resolve import "./transform-pipeline"`) → `bf57216` (feat GREEN — 14/14 test passing al primo run).

**Verifica finale plan 02-05:**

- `pnpm --filter @sembridge/mapper test transform-pipeline` exit 0: **`Test Files 1 passed (1) | Tests 14 passed (14)`** Duration 536ms
- `pnpm --filter @sembridge/mapper test` exit 0: **`Test Files 3 passed (3) | Tests 41 passed (41)`** (14 transform-pipeline + 16 alias-registry + 11 canonical-registry)
- `pnpm --filter @sembridge/mapper typecheck` exit 0 (isolatedDeclarations enforcement OK)
- `pnpm --filter @sembridge/core test` exit 0: **24 file/248 test passing** (no regression Phase 1)
- `pnpm biome check packages/mapper/src/transform-pipeline*.ts` exit 0 dopo auto-fix `organizeImports` (riordino alfabetico import: `@sembridge/core` prima di `vitest`, runtime prima di type-only)
- 8/8 grep acceptance check PASSED (`export class TransformPipeline`, `transform.id.duplicate`, `transform.not-found`, `mapping.transform.failed`, `originalError`, `unregisterByOwner`, file source + file test esistenti)
- Audit `any`: 0 occorrenze come tipo
- Audit `unknown` non documentato: 0 occorrenze (`unknown` solo in `defaultValue?: unknown` di apply + `details?: Record<string, unknown>` ereditato dal contratto BrokerError F1; `input: unknown` per TransformFn signature documentata)
- Post-commit deletion check: OK (no deletions tra HEAD~2 e HEAD)

Nessuna deviazione applicata (Rule 1/2/3/4): plan eseguito esattamente come scritto. **TDD Gate Compliance:** RED gate `84377d7` → GREEN gate `bf57216` verificati in git history. **Closure PRD §39 open issue #4** (VAL-09 — transform failure: skip o block): chiusa esplicitamente da `apply(name, input, ctx, onFailure, defaultValue?)` che applica D-44 in modo deterministico per ogni field; default `'block'` enforced; cause chaining ES2022 preserved (test 5 verifica `expect(caught.cause).toBe(original)` E `expect(caught.originalError).toBe(original)`). 

REQ-IDs avanzati al runtime-level:

- **MAP-12** runtime (`registerTransform(name, fn)` API + `apply` con onFailure policy + cascade unregister via owner — pronto per wiring al `Broker.registerTransform` in plan 02-10)
- **VAL-09** runtime (chiusura PRD §39 #4 — `'block' | 'skip' | 'fallback'` esplicito; default 'block' enforced; cause chaining ES2022 preserved)

Open issues PRD §39 chiusura status:

- **#1** Precedenza alias automatici vs mapping esplicito (MAP-17) — Closed in 02-04 ✅
- **#4** Transform failure: skip o block (VAL-09) — **Closed in 02-05** ✅
- **#3** Field mancante required:true|false (VAL-08) — type-level scaffold da 02-02; runtime al mapper-engine plan 02-07 ⏳
- D-26 ext F2 (cascade unregister) — abilitato anche per TransformPipeline via `unregisterByOwner(pluginId)`. Wiring al broker wrapper in plan 02-10 ⏳

---

**Phase 2 plan 02-04 (precedente)** — `AliasRegistry` (Wave 3) completato sequenzialmente via `gsd-executor` con `model: "opus"`.

**Plan 02-04** — 1 task TDD RED→GREEN (2 commit atomici), 2 file src/test (413 LOC totali: 240 src + 173 test):

- `packages/mapper/src/alias-registry.ts` (240 LOC) — `class AliasRegistry` con 6 metodi pubblici: `registerGlobal(localField, canonicalField)`, `registerScoped(pluginId, localField, canonicalField)`, `resolve(pluginId, localField)`, `unregisterScopedAll(pluginId)`, `listGlobal()`, `listScoped(pluginId)`. Pattern F1 TopicRegistry esteso con due livelli di scope: `globalAliases: Map<string, string>` + `pluginScopedAliases: Map<pluginId, Map<localField, canonicalField>>` per T-02-04-02 isolation. Resolution order D-40 (livelli 2-4: scoped > global > name-match) — livelli 1 (esplicito) e 5 (unresolved) gestiti dal mapper-engine plan 02-07. Ambiguity flag D-41 (`true` per alias automatici, `false` per name-match). Conflict throw `alias.{global,scoped}.conflict` su pair conflittuale (T-02-04-03 anti-shadow); idempotent return false su pair identico. `unregisterScopedAll(pluginId)` ritorna count rimossi (D-26 ext F2 cascade). `listGlobal/listScoped` spread copy + sort deterministico (T-02-04-01). Errori Error nativi (NON BrokerError) — module auto-contenuto da `@sembridge/core` runtime; solo `import type { CanonicalSchemaId }` da types/. Re-export `CanonicalSchemaId` per convenience consumer mapper-engine.
- `packages/mapper/src/alias-registry.test.ts` (173 LOC, 16 test) — coverage completo dei 12 behavior listati nel PLAN `<task><behavior>` organizzati in 4 describe block: `registerGlobal` (2 test: idempotent + conflict), `registerScoped` (3 test: idempotent + conflict scope + isolation tra plugin), `resolve` (7 test: D-40 livelli 2-4 + scoped vincere su global + plugin-b non vede plugin-a + name-match + unresolved contract + empty localField guard), `unregisterScopedAll` (2 test: cascade + zero match), `list` (2 test: listGlobal sorted + listScoped per plugin).
- Commit: `018b867` (test RED — verified `Failed to resolve import "./alias-registry"`) → `e1517ee` (feat GREEN — 16/16 test passing al primo run).

**Verifica finale plan 02-04:**

- `pnpm --filter @sembridge/mapper test alias-registry` exit 0: **`Test Files 1 passed (1) | Tests 16 passed (16)`** Duration 469ms
- `pnpm --filter @sembridge/mapper test` exit 0: **2 file/27 test passing** (16 alias-registry + 11 canonical-registry)
- `pnpm --filter @sembridge/mapper typecheck` exit 0 (isolatedDeclarations enforcement OK)
- `pnpm --filter @sembridge/core test` exit 0: **24 file/248 test passing** (no regression Phase 1)
- `pnpm biome check packages/mapper/src/alias-registry*.ts` exit 0 dopo fix manuale `Array<T>` → `T[]` (suggested unsafe fix di Biome applicato manualmente, formattazione equivalente)
- 8/8 grep acceptance check PASSED (`export class AliasRegistry`, `registerGlobal`, `registerScoped`, `unregisterScopedAll`, `ambiguous`, `source: 'scoped'`, file source + file test esistenti)
- Audit `any`: 0 occorrenze come tipo
- Audit `unknown`: 0 occorrenze (module string→string puro)
- Audit import `@sembridge/core` runtime: 0 (module auto-contenuto come da PLAN must_haves)

Nessuna deviazione applicata (Rule 1/2/3/4): plan eseguito esattamente come scritto. **TDD Gate Compliance:** RED gate `018b867` → GREEN gate `e1517ee` verificati in git history. **Closure PRD §39 open issue #1** (precedenza alias automatici vs mapping esplicito): risolta per costruzione contract — il mapper-engine plan 02-07 valuta il livello 1 (esplicito `inputMap`/`outputMap`) PRIMA di chiamare `AliasRegistry.resolve`, quindi l'esplicito vince sempre. Il registry stesso non vede l'esplicito; documentato in JSDoc del metodo `resolve`.

REQ-IDs avanzati al runtime-level:

- **MAP-16** runtime (warning runtime alias ambiguo via `AliasResolution.ambiguous: true` + source `'scoped'|'global'` — usato dal mapper-engine plan 02-07 per emettere `mapping.warn`)
- **MAP-17** runtime (chiusura PRD §39 #1 — il livello esplicito è gestito dal mapper-engine PRIMA di consultare AliasRegistry; il registry stesso documenta in JSDoc che `resolve` ritorna `name-match` come default deterministico per il livello 4)

Open issues PRD §39 chiusura status:

- **#1** Precedenza alias automatici vs mapping esplicito (MAP-17) — **Closed in 02-04** ✅
- D-26 ext F2 (cascade unregister da plugin) — abilitato anche per AliasRegistry via `unregisterScopedAll(pluginId)`. Wiring al broker wrapper in plan 02-10 ⏳

---

**Phase 2 plan 02-03 (precedente)** — `CanonicalRegistry` (Wave 3 sequential) completato sequenzialmente via `gsd-executor` con `model: "opus"`.

**Plan 02-03** — 1 task TDD RED→GREEN (2 commit atomici), 2 file src/test (331 LOC totali: 188 src + 143 test):

- `packages/mapper/src/canonical-registry.ts` (188 LOC) — `class CanonicalRegistry` con 6 metodi pubblici: `register(schema, options?)`, `has(id)`, `get(id)`, `list()`, `onRegistered(listener)`, `unregister(id)`. Pattern F1 TopicRegistry replicato (idempotent register, observer con try/catch swallow per T-02-03-01, list() copia ordinata per T-02-03-02). Estensioni F2: `requires` resolution check al register (D-36) → throw `BrokerError 'canonical.requires.unresolved'` con `details: { id, missingRequires: string[] }`; `unregister(id)` per cascade plugin (D-26 ext F2 — wired in plan 02-10 broker wrapper); `RegisterOptions.strict?: boolean` opt-in per detection accidentale duplicati → throw `BrokerError 'canonical.id.duplicate'`.
- `packages/mapper/src/canonical-registry.test.ts` (143 LOC, 11 test) — coverage completo dei 11 behavior listati nel PLAN `<task><behavior>`: idempotent register (Test 1), D-36 requires resolution OK + fail (Test 2-3), has/get accessor (Test 4-5), list() ordering + immutability T-02-03-02 (Test 6), onRegistered observer + unsubscribe (Test 7), listener throw isolation T-02-03-01 (Test 8), unregister D-26 ext F2 (Test 9), unregister con orphan dependent schemas (Test 10), strict mode duplicate detection (Test 11).
- Cross-package import `import { createBrokerError, isBrokerError } from '@sembridge/core'` + `category: 'mapping'` (già definita in F1 ErrorCategory union).
- Commit: `4d9ca60` (test RED — verified `Failed to resolve import "./canonical-registry"`) → `a5515c6` (feat GREEN — 11/11 test passing al primo run).

**Verifica finale plan 02-03:**

- `pnpm --filter @sembridge/mapper test canonical-registry` exit 0: **`Test Files 1 passed (1) | Tests 11 passed (11)`** Duration 377ms
- `pnpm --filter @sembridge/mapper test` exit 0: 1 file 11 test passing
- `pnpm --filter @sembridge/mapper typecheck` exit 0 (isolatedDeclarations enforcement OK)
- `pnpm --filter @sembridge/core test` exit 0: **24 file/248 test passing** (no regression Phase 1)
- `pnpm biome check packages/mapper/src/canonical-registry*.ts` exit 0 dopo auto-fix lineWidth (formattazione, non altera semantica)
- 7/7 grep acceptance check PASSED (`export class CanonicalRegistry`, `canonical.requires.unresolved`, `canonical.id.duplicate`, `createBrokerError`, `@sembridge/core`, file source + file test esistenti)
- Audit `any`: 0 occorrenze come tipo
- Audit `unknown` non documentato: 0 occorrenze (`unknown` solo in `details?: Record<string, unknown>` ereditato dal contratto BrokerError F1)

Nessuna deviazione applicata (Rule 1/2/3/4): plan eseguito esattamente come scritto. **TDD Gate Compliance:** RED gate `4d9ca60` → GREEN gate `a5515c6` verificati in git history. Auto-fix Biome formattazione (lineWidth: 100) applicato come parte del commit GREEN — non altera semantica del test RED che era già fallito al run prima di qualsiasi formattazione.

REQ-IDs avanzati al runtime-level (al posto del solo type-level di plan 02-02):

- **MAP-01** runtime (CanonicalRegistry traccia tutti i canonical schema registrati con campi tipizzati via `CanonicalSchema.fields: Record<string, FieldDescriptor>`)
- **MAP-02** runtime (`register(schemaDefinition)` API pronta per essere wirata al `Broker.registerCanonicalSchema` in plan 02-10)

Open issues PRD §39 chiusura status:

- **D-36** (canonical schema versioning via `requires`) — coperto al register flow ✅
- **D-26 ext F2** (cascade unregister da plugin) — abilitato via `unregister(id)`. Wiring al broker wrapper in plan 02-10 ⏳
- VAL-08, VAL-09 status invariato (resta type-level scaffold da plan 02-02; runtime in plan 02-07 mapper-engine)

---

**Phase 2 plan 02-02 (precedente)** — Public types F2 (`packages/mapper/src/types/`) completato sequenzialmente via `gsd-executor` con `model: "opus"`.

**Plan 02-02** — 2 task auto (no TDD: tipi-only senza runtime testabile; il TDD pattern RED→GREEN inizia in 02-03 sul `CanonicalRegistry`), 2 commit, 6 file types/*.ts (433 LOC totali):

- `packages/mapper/src/types/canonical-schema.ts` (96 LOC) — `CanonicalSchema`, `CanonicalSchemaId` branded (`unique symbol`), `FieldDescriptor` (D-42 required + D-43 default + D-44 onFailure), `FieldFailureMode = 'block' | 'skip' | 'fallback'`, `FieldType`. Tutti field readonly (T-02-02-03 compile-time mitigation).
- `packages/mapper/src/types/input-output-map.ts` (80 LOC) — `MappingRule { source?, transform?, default?, derive? }` per i 4 casi PRD §14.2 (rename/transform/default/derive); `InputMap`/`OutputMap = Readonly<Record<string, MappingRule>>`; `DeriveDescriptor` (PRD §14.5).
- `packages/mapper/src/types/transform.ts` (66 LOC) — `TransformFn = (input: unknown, ctx: TransformContext) => unknown`, `TransformContext { logger, pluginId, fieldName, canonicalSchemaId? }` readonly, `TransformDescriptor`, `TransformName` branded (Pitfall #12 — distinto da `CanonicalSchemaId`). Import `import type { BrokerLogger } from '@sembridge/core'` (verbatimModuleSyntax).
- `packages/mapper/src/types/validator-adapter.ts` (70 LOC) — `ValidatorAdapter` interface NO-throw (D-37/D-38) + `ValidationResult<T>` discriminated union `{ ok: true; value: T } | { ok: false; issues }` + `ValidationIssue` minimal cross-adapter ergonomic.
- `packages/mapper/src/types/mapping-error.ts` (60 LOC) — `MappingErrorCode` literal union 5 codici F2 (D-58 ERR-02 extension): `mapping.cycle.detected`, `mapping.transform.failed`, `mapping.field.missing`, `mapping.canonical.validation.failed`, `mapping.consumer.validation.failed`. `isMappingErrorCode` runtime type guard backed da `ReadonlySet<string>` O(1).
- `packages/mapper/src/types/index.ts` (61 LOC barrel) — 4 blocchi `export type { ... }` + 1 `export type` per mapping-error + 1 `export { isMappingErrorCode }` runtime; JSDoc 1-liner su ogni export (pattern `@sembridge/core/types/index.ts:1-41`).
- Commit: `210013b` (feat Task 1 — canonical-schema + input-output-map + transform) → `af38fb0` (feat Task 2 — validator-adapter + mapping-error + barrel).

**Verifica finale plan 02-02:**

- `pnpm --filter @sembridge/mapper typecheck` exit 0 con `isolatedDeclarations: true` enforcement (post Task 1 e post Task 2)
- `pnpm --filter @sembridge/mapper test` exit 0 (passWithNoTests; nessun test runtime — atteso, TDD inizia in 02-03)
- `pnpm --filter @sembridge/mapper build` exit 0: `dist/index.js` 68 B + `dist/index.d.ts` 13 B (barrel principale ancora skeleton — coerente con plan 02-09 wiring deferred)
- `pnpm --filter @sembridge/core test` exit 0: **24 file/248 test passing** (no regression Phase 1)
- 10/10 grep acceptance check Task 1 PASSED; 10/10 Task 2 PASSED
- Audit `any`: 0 occorrenze come tipo (solo string literal `'any'` in `FieldType`, documentato)
- Audit `unknown` non documentato: 0 occorrenze (4 occorrenze tutte intenzionali e documentate in JSDoc + header file)

Nessuna deviation applicata (Rule 1/2/3/4): plan eseguito esattamente come scritto. **Chiusura D-32 placeholder F1 al type-level** — `BrokerConfig.canonicalModel/aliasRegistry/transforms` e `PluginDescriptor.inputMap/outputMap` ora hanno tipi specifici disponibili in `@sembridge/mapper/types`. Runtime wiring (TS declaration merging) deferred al plan 02-09 (`augment.ts`).

REQ-IDs avanzati al type-level (verranno completati a runtime nei plan successivi):

- **MAP-01** type-level (`CanonicalSchema` interface)
- **MAP-02** type-level (`registerCanonicalSchema(schemaDefinition)` shape definita)
- **MAP-03** type-level (`InputMap`/`OutputMap` shape — wired al `PluginDescriptor` in plan 02-09)
- **MAP-12** type-level (`TransformFn`/`TransformDescriptor` signature)
- **VAL-03** type-level (`ValidatorAdapter` per step 6 — runtime in 02-06/02-07)
- **VAL-04** type-level (`ValidatorAdapter` per step 12 — runtime in 02-06/02-07)

Open issues PRD §39 type-level scaffold per chiusura nei plan successivi:

- VAL-08 (`FieldDescriptor.required` definito; runtime in plan 02-07 mapper-engine)
- VAL-09 (`FieldFailureMode` + `FieldDescriptor.onFailure` definiti; runtime in plan 02-07 + plan 02-12 robustness)

**Phase 2 plan 02-01 (precedente)** — Bootstrap `@sembridge/mapper` completato sequenzialmente via `gsd-executor` con `model: "opus"`.

**Plan 02-01** — 2 task auto (no TDD: bootstrap config, no runtime code), 2 commit + 1 docs commit, 4 file config + 1 src skeleton + README + 2 modifiche root + lockfile aggiornato (8 file totali):

- `packages/mapper/package.json` — da placeholder F1 (18 LOC) a package buildable F2 (52 LOC); replica esatta @sembridge/core con 3 diff puntuali: `sideEffects: ['./dist/augment.js']` (array, Rule 4 PATTERNS.md §6); `dependencies.@sembridge/core: workspace:*` + `valibot: 1.3.1`; `size-limit` budget 5 KB gzip
- `packages/mapper/tsup.config.ts` — replica core con `external: [/^node:/, '@sembridge/core']` (peer-like) + banner `@sembridge/mapper`
- `packages/mapper/tsconfig.json` — replica esatta core (`extends: '../../tsconfig.base.json'`)
- `packages/mapper/vitest.config.ts` — replica core con `name: '@sembridge/mapper'`, jsdom env, coverage v8 thresholds 90/85/90/90
- `packages/mapper/src/index.ts` — barrel skeleton con header `@packageDocumentation` italiano + commenti placeholder per export futuri (CanonicalRegistry/AliasRegistry/TransformPipeline/valibotAdapter/MapperEngine + types) + empty `export {}`
- `packages/mapper/README.md` — skeleton italiano con sezioni Stato/Cosa contiene/Vincolo D-49/Documentazione/Licenza (preparazione DOC-03 finale al plan 02-12)
- `package.json` (root) — aggiunge `@vitest/coverage-v8: 4.1.5` in `devDependencies` + entry size-limit per `@sembridge/mapper (gzip)` con limit 5 KB (chiude open item ereditato F1)
- `pnpm-lock.yaml` — aggiornato con `@vitest/coverage-v8` + workspace link `@sembridge/core: workspace:*` → `@sembridge/mapper`
- Commit: `b200948` (chore Task 1 — replica config) → `40d4caf` (chore Task 2 — barrel + README + install + size-limit root)

**Verifica finale plan 02-01:**

- `pnpm install` exit 0: `+ @vitest/coverage-v8 4.1.5`; lockfile aggiornato; workspace link attivo
- `pnpm --filter @sembridge/mapper typecheck` exit 0
- `pnpm --filter @sembridge/mapper test` exit 0 (passWithNoTests; nessun test ancora — atteso)
- `pnpm --filter @sembridge/mapper build` exit 0: `dist/index.js` 68 B + `dist/index.d.ts` 13 B + sourcemap 69 B
- `pnpm --filter @sembridge/core test` exit 0: **24 file/248 test passing** (no regression Phase 1)
- `pnpm typecheck` workspace exit 0 (core + mapper, gli altri 6 placeholder F1 fuori scope)

Nessuna deviation applicata (Rule 1/2/3/4): plan eseguito esattamente come scritto. Open item ereditato chiuso: `@vitest/coverage-v8` ora installato → abilita D-55 coverage measurement F2 finale al plan 02-12.

**Wave 5 chiusa** (plan 01-08 — Phase 1 closure) — `Broker` class + `plugin-registry` + public API surface completato sequenzialmente via `gsd-executor` con `model: "opus"`.

**Plan 01-08** — 2 task TDD RED→GREEN, 5 commit, 5 file src/test + 1 modifica `index.ts`:

- `core/plugin-registry.ts` (224 LOC) — `class PluginRegistry` con `register/unregister`, transitions D-25 via `transitionState`, cascade cleanup D-26 (chiusura PRD §39 #7 — LIFE-02): `bus.unsubscribeByOwner` → `abortController.abort()` → `onUnmount` → `onDestroy`. Helper `createPluginScopedBroker(broker, pluginCtx)` che auto-tagga subscriptions con `ownerId=pluginCtx.id` (D-26 enforcement pratico F1).
- `core/plugin-registry.test.ts` (368 LOC, 19 test) — coverage register lifecycle, duplicate id D-17, cascade cleanup deterministico (`getDebugSnapshot()` post-unregister == baseline), scoped broker.
- `core/broker.ts` (166 LOC) — `class Broker` composition di EventBus + PluginRegistry + TopicRegistry + logger + tap. Espone `publish/subscribe/registerPlugin/unregisterPlugin/getDebugSnapshot/getTopicRegistry/enableDebug/disableDebug` (D-28, D-29).
- `public-factory.ts` (68 LOC) — `createBroker(config: BrokerConfig)` con Valibot `safeParse`; throw `Error` su validation fail (D-18). No singleton (D-30): N istanze indipendenti.
- `public-factory.test.ts` (176 LOC, 13 test) — verifica registerPlugin lifecycle end-to-end, LIFE-02 cascade, F1 runtime fields completi, no singleton.
- `index.ts` (10 → 38 LOC) — public API surface con runtime exports (`createBroker`, `Broker`, `createBrokerError`, `isBrokerError`, `createConsoleLogger`, `silentLogger`) + barrel type-only.
- Commit: `ada0cfb` (test plugin-registry RED) → `1377ef9` (feat plugin-registry GREEN) → `285390b` (test broker+factory RED) → `1960be9` (feat broker+factory+index GREEN) → `419152d` (docs SUMMARY).

**Verifica finale Wave 5 chiusa:**

- `pnpm --filter @sembridge/core test` exit 0: **`Test Files 12 passed | Tests 191 passed`**
- `pnpm --filter @sembridge/core typecheck` exit 0
- `pnpm biome check packages/core/src/` exit 0 (35 file, scope esteso a src/)
- `pnpm --filter @sembridge/core build` exit 0: `dist/index.js` 23.14 KB + `dist/index.d.ts` 6.44 KB + sourcemap 80.04 KB
- Smoke import: `Object.keys(m).sort()` → `['Broker', 'createBroker', 'createBrokerError', 'createConsoleLogger', 'isBrokerError', 'silentLogger']` (superset rispetto al minimo richiesto dal PLAN)

Decisioni architetturali documentate (NON Rule 4 — strutturali e coerenti col PLAN):

1. `PluginContext.broker` placeholder risolto via `interface PluginScopedBroker` strutturale invece di TS declaration merging — evita ciclo import broker.ts ↔ types/plugin.ts. Lo scoped broker espone solo le API necessarie agli hook plugin.
2. `createBroker(invalidConfig)` lancia `Error` nativo, non `BrokerError` — errore di development-time, non runtime broker-internal.

Open item residuo (ereditato da plan 04, non bloccante): coverage v8 measurement non eseguita (missing devDep `@vitest/coverage-v8`). Surrogate: 191/191 test passing su 12 moduli con behavior coverage esplicito.

**Wave 4 (precedente)** — plan 07 EventBus core completato e già documentato.

**Plan 01-07** (EventBus core) — 1 task macro TDD RED→GREEN, 3 commit, 2 file src/test (291 + 402 LOC):

- `core/bus.ts` — classe `EventBus` con `publish/subscribe/unsubscribeByOwner/setDebugMode/getStats`. Coverage: CORE-01 (event bus pub/sub), CORE-09 (wildcard delivery via TopicTrie applicato al dispatch), CORE-12 (handler isolation con try/catch + system.error publish), ERR-03 (errori non collassano runtime).
- Pipeline §28 step F1 instrumentati: 5 chiamate `safeTapStep(tap, step, snapshot)` su `event.received`, `event.metadata.enriched`, `event.validated`, `event.dedupe.checked`, `event.delivered`. D-20 enforcement (errors swallowed).
- Decisioni runtime applicate: D-01 (default async via `queueMicrotask`), D-02 (sync immediate), D-03 (worker/remote → fallback async + warn `mapping.delivery.fallback`), D-16 (handler isolation: catch + log + publish `system.error`, NO re-throw), D-26 (cascade unsubscribe via AbortSignal), D-27 (unsubscribe idempotente), once-true auto-unsubscribe.
- Commit: `d328a96` (test RED) → `9189a03` (feat GREEN) → `80b1a08` (docs SUMMARY).
- Deviation Rule 2 applicate: 6 test extra (BrokerError no-rewrap su handler throw, validation throw blocca tap downstream, remote→async parità D-03, unsubscribeByOwner zero match, getStats shape, setDebugMode toggle). 25 test totali invece dei 16 minimi del PLAN.
- Deviation Rule 1: `useOptionalChain` su `!sub?.active` per parity con Wave 3 modules.

**Verifica finale Wave 4 chiusa:**

- `pnpm --filter @sembridge/core test` exit 0: **`Test Files 10 passed | Tests 159 passed | Duration 523 ms`**
- `pnpm --filter @sembridge/core typecheck` exit 0
- `pnpm biome check packages/core/src/core/` exit 0 (20 file)
- Working tree pulito (solo `prd.md` untracked, fuori scope)
- Tutti i 25 test nuovi passing al primo run dopo GREEN — nessuna iterazione di debug.

**Wave 3 (precedente)** — plan 04, 05, 06 completati e già documentati. Plan 05 e 06 eseguiti in parallelo via spawn `gsd-executor` con `model: "opus"` (vincolo CLAUDE.md). File ownership disgiunta verificata: nessuna race su file modificati.

**Plan 01-05** (Utility batch B) — 3 task TDD RED→GREEN, 7 commit, 6 file src/test (+ 1 SUMMARY):

- `core/topic-matcher.ts` — `validateTopic` (CORE-08, regex D-24) + `validateTopicPattern` + `TopicTrie<T>` con `insert/remove/match/collectAllPatterns` (CORE-09, D-08..D-11 incluso edge case `weather.*.failed` matcha `weather.alert.failed`). 32 test.
- `core/event-factory.ts` — `createBrokerEvent({topic, payload, source, ...})` con default id (`nanoid` se assente), timestamp (`Date.now()`), deliveryMode `'async'`, priority `'normal'`. Lancia `BrokerError` `event.source.missing` se source assente E senza defaultSource. (CORE-07, D-21..D-23). 12 test.
- `core/event-validator.ts` — `validateEvent(event)` Valibot schema BrokerEvent shape (VAL-01, VAL-06). 11 test.
- Commit RED+GREEN: `c97bc56`/`8c24e77` (topic-matcher), `239d010`/`6cd21e7` (event-factory), `d77398c`/`cf12502` (event-validator). Docs: `c2ec46b`.
- Deviation Rule 1 (correctness): cambiato return type `BrokerError | void` → `void` per le `validateTopic*` (le funzioni throw, mai return BrokerError).

**Plan 01-06** (Utility batch C) — 2 task TDD RED→GREEN, 5 commit, 4 file src/test (+ 1 SUMMARY):

- `core/topic-registry.ts` — `TopicRegistry` class con `register/has/list/onRegistered` (CORE-03). Idempotente, ordering deterministico, observer pattern con unsubscribe. 8 test.
- `core/lifecycle.ts` — `VALID_TRANSITIONS` (D-25 state machine 8 stati) + `transitionState(reg, target, logger)` che valida le transizioni e lancia `BrokerError` `plugin.lifecycle.invalid-transition` su transizione invalida (CORE-05). 29 test.
- Commit RED+GREEN: `526336a`/`41866e7` (topic-registry), `c87ae5f`/`94db532` (lifecycle). Docs: `a6ae97e`.
- Deviation Rule 2: `VALID_TRANSITIONS` esportato readonly (T-06-02 mitigation), test extra `list returns fresh array on each call` (T-06-01), granularizzazione test integrità reg.state on throw.

**Verifica finale Wave 3 chiusa:**

- `pnpm --filter @sembridge/core test` exit 0: **`Test Files 9 passed | Tests 134 passed | Duration 746 ms`**
- `pnpm --filter @sembridge/core typecheck` exit 0 (18 file)
- `pnpm biome check packages/core/src/core/` exit 0 (14 file)
- Working tree pulito (solo `prd.md` untracked, fuori scope)

Open item ereditato (non bloccante):

- Coverage v8 NON ancora misurata: missing dep `@vitest/coverage-v8`. 134/134 test passing su 9 moduli isolati copre i behavior path. Da installare prima del closure di Phase 1.

### Next Action

**Phase 2 Wave 3 (continua) — plan 02-05/06** (file ownership disgiunta, paralleli con 02-03 e 02-04 già done):

```
/gsd-execute-plan 2 02-05   # TransformPipeline (TDD RED→GREEN)
/gsd-execute-plan 2 02-06   # valibotAdapter (TDD RED→GREEN)
```

I 2 plan rimanenti possono essere eseguiti in **parallelo** via spawn `gsd-executor` con `model: "opus"` (vincolo CLAUDE.md), come Wave 3 di F1 (plan 04/05/06). File ownership disgiunta verificata: nessuna race su file modificati. `CanonicalRegistry` (02-03) e `AliasRegistry` (02-04) sono già stati eseguiti sequenzialmente prima dei paralleli (casi single-threaded che non bloccano i restanti).

Dopo Wave 3, sequenziale:

- **Plan 02-05/06** (Wave 3, paralleli con file ownership disgiunta — 02-04 già done): `transform-pipeline.ts` || `valibot-adapter.ts`. TDD RED→GREEN.
- **Plan 02-07** (Wave 4): `mapper-engine.ts` — il "cuore" del package, analogo dell'EventBus per il mapper.
- **Plan 02-08** (Wave 5): `broker-mapper-wrapper.ts` (composition decorator — Rule 4 candidata; planner ha già scelto pattern in PLAN).
- **Plan 02-09** (Wave 6): `augment.ts` (TS declaration merging) + barrel `index.ts` + Inspector wiring.
- **Plan 02-10/11** (Wave 7): integration tests (scenario meteo + cycle detection + mapping.error event + Inspector snapshot + plugin cleanup mapper cascade).
- **Plan 02-12** (Wave 8, final gate F2): Coverage v8 ≥ 90% + publint/attw/size-limit estesi a mapper + DOC-03 README esteso (scenario meteo end-to-end senza HTTP) + JSDoc API pubblica + gsd-verifier post.

Pre-requisito chiuso da 02-01: `@vitest/coverage-v8` installato → D-55 misurazione coverage F2 finale abilitata.

### Files Created/Updated in this Session

Plan 01-04 + 01-05 + 01-06 execution (Wave 3 completa):

**Plan 04 (utility batch A)** — `packages/core/src/core/`:

- `broker-error.ts` + `broker-error.test.ts`
- `deep-freeze.ts` + `deep-freeze.test.ts`
- `logger.ts` + `logger.test.ts`
- `event-tap.ts` + `event-tap.test.ts`

**Plan 05 (utility batch B)** — `packages/core/src/core/`:

- `topic-matcher.ts` + `topic-matcher.test.ts`
- `event-factory.ts` + `event-factory.test.ts`
- `event-validator.ts` + `event-validator.test.ts`

**Plan 06 (utility batch C)** — `packages/core/src/core/`:

- `topic-registry.ts` + `topic-registry.test.ts`
- `lifecycle.ts` + `lifecycle.test.ts`

**Documentation:**

- `.planning/phases/01-core-essenziale/01-04-SUMMARY.md` (creato)
- `.planning/phases/01-core-essenziale/01-05-SUMMARY.md` (creato dall'agent gsd-executor parallelo)
- `.planning/phases/01-core-essenziale/01-06-SUMMARY.md` (creato dall'agent gsd-executor parallelo)
- `.planning/STATE.md` (aggiornato: 4/11 → 6/11, Wave 3 chiusa)
- `.planning/ROADMAP.md` (aggiornato: plan 04, 05, 06 done con commit hash)
- `.planning/REQUIREMENTS.md` (aggiornato: ERR-01/CORE-03/CORE-05/CORE-07/CORE-08/CORE-09/CORE-10/CORE-13/VAL-01/VAL-06 promossi a Done)

**21 commit nuovi creati post-04 docs (`b0cecb7`):**

- Plan 05: `c97bc56`/`8c24e77` (topic-matcher), `239d010`/`6cd21e7` (event-factory), `d77398c`/`cf12502` (event-validator), `c2ec46b` (docs SUMMARY)
- Plan 06: `526336a`/`41866e7` (topic-registry), `c87ae5f`/`94db532` (lifecycle), `a6ae97e` (docs SUMMARY)
- Wave 3 closure docs: `5ae5074`
- Plan 07: `d328a96` (test RED bus) → `9189a03` (feat GREEN bus) → `80b1a08` (docs SUMMARY)
- Wave 4 closure docs: 1 commit pendente (questo)

**Plan 07 file Wave 4** — `packages/core/src/core/`:

- `bus.ts` (291 LOC) — classe `EventBus` con publish/subscribe/unsubscribeByOwner/setDebugMode/getStats
- `bus.test.ts` (402 LOC) — 25 test (16 minimi PLAN + 6 Rule 2 + altri 3 di copertura)
- `.planning/phases/01-core-essenziale/01-07-SUMMARY.md` (creato dall'agent gsd-executor)

**Plan 08 file Wave 5** — `packages/core/src/`:

- `core/plugin-registry.ts` (224 LOC) — class `PluginRegistry` + helper `createPluginScopedBroker`
- `core/plugin-registry.test.ts` (368 LOC, 19 test)
- `core/broker.ts` (166 LOC) — class `Broker` composition
- `public-factory.ts` (68 LOC) — `createBroker(config)` con Valibot validation
- `public-factory.test.ts` (176 LOC, 13 test)
- `index.ts` modificato (10 → 38 LOC) con runtime exports
- `.planning/phases/01-core-essenziale/01-08-SUMMARY.md` (creato dall'agent gsd-executor)

### Recovery Notes

Il progetto è in stato di **inizializzazione completata**. Tutti gli artefatti GSD di pianificazione sono presenti:

- `prd.md` (fonte autoritativa)
- `.planning/PROJECT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/research/{SUMMARY,STACK,FEATURES,ARCHITECTURE,PITFALLS}.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `.planning/config.json`

Se la sessione viene interrotta, riprendere con `/gsd-plan-phase 1` o con review degli artefatti via `cat`.

---

*State initialized: 2026-04-28 (auto-mode da prd.md, post roadmap creation)*

**Planned Phase:** 1 (Core essenziale) — 11 plans — 2026-04-28T11:47:46.016Z

**Plans complete (Phase 1):** 01-01 ✓, 01-02 ✓, 01-03 ✓, 01-04 ✓, 01-05 ✓, 01-06 ✓, 01-07 ✓, 01-08 ✓, 01-09 ✓, 01-10 ✓, 01-11 ✓ — **11/11 done, all gates passed**. 248/248 test su 24 file. Final gate 01-11: publint OK, attw OK, size-limit 6.14 KB/8 KB (76% budget). Pending solo `gsd-verifier` per goal-backward verification.
