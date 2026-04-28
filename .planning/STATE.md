---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_plan: 7 of 11
status: executing
last_updated: "2026-04-28T16:33:13+02:00"
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 11
  completed_plans: 6
  percent: 54
---

# Project State: SemBridge

**Initialized:** 2026-04-28
**Last updated:** 2026-04-28

## Project Reference

- **Project:** SemBridge — libreria JavaScript browser-side TypeScript-first (ESM) per pub/sub, routing, canonical model, gateway server unico, worker runtime, developer tooling
- **Authoritative source:** `prd.md` (root del progetto, "l'unica base informativa condivisa con il developer", PRD §1)
- **Core Value:** I plugin/componenti possono essere sviluppati indipendentemente, con la propria nomenclatura locale, e interoperare correttamente attraverso il vocabolario canonico del broker — senza accordo preventivo sui nomi tra autori
- **Current Milestone:** v1
- **Current Focus:** Phase 1 — Core essenziale

## Current Position

Phase: 01-core-essenziale (1) — EXECUTING
Current Plan: 7 of 11
Total Plans: 11

- **Phase:** 1 — Core essenziale
- **Plan:** Wave 3 chiusa — 01-04 ✓ + 01-05 ✓ + 01-06 ✓ (utility batch A/B/C)
- **Status:** Executing Phase 01-core-essenziale
- **Progress:** [█████░░░░░] 54%

## Phases Overview

- **Total phases:** 6 (allineate 1:1 con PRD §32)
- **Phases complete:** []
- **Granularity:** coarse
- **Coverage:** 91/91 requisiti v1 mappati

| Phase | Goal (sintesi) | Status |
|-------|----------------|--------|
| 1 | Core essenziale (broker pub/sub, plugin registry, EventTap pre-instrumentato) | In progress (6/11 plans) |
| 2 | Canonical Model & Mapper bidirezionale + Mapping Inspector | Not started |
| 3 | Routing engine + HTTP gateway con retry/timeout/dedupe/auth | Not started |
| 4 | Realtime inbound (SSE prioritario, WS opzionale) | Not started |
| 5 | Worker Runtime (registry, route worker, task tracking) | Not started |
| 6 | Cache + Tooling avanzato (Inspector, Metrics, debug API) | Not started |

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases complete | 0 / 6 |
| Plans complete in current phase | 6 / 11 (Phase 1) |
| Plans abandoned | 0 |
| Plans repaired | 0 |
| Time per phase | — |
| Time per plan | 01-01: 4m 14s (3 tasks, 23 files); 01-02: 3m 19s (2 tasks, 7 files); 01-03: 6m 26s (3 tasks, 10 files); 01-04: ~6m wall-clock effective (4 tasks, 8 files, 8 commits — interrupted session); 01-05: ~15m parallelo (3 tasks TDD, 6 files src/test + SUMMARY, 7 commits, 55 nuovi test); 01-06: ~7m parallelo (2 tasks TDD, 4 files src/test + SUMMARY, 5 commits, 37 nuovi test) |

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

### Open Issues PRD §39 — Phase Assignment

11 punti che il PRD §39 vieta esplicitamente di lasciare impliciti, mappati alla fase di chiusura:

| Open Issue | Phase | Status |
|------------|-------|--------|
| Precedenza alias automatici vs mapping esplicito | F2 (MAP-17) | Pending |
| Ordine pipeline mapping/validazione | F1 (skeleton) + F2/F3/F6 (riempimento) | Pending |
| Field mancante: errore o default | F2 (VAL-08) | Pending |
| Transform failure: skip o block | F2 (VAL-09) | Pending |
| Topic senza route | F3 (ROUTE-16) | Pending |
| Più route applicabili stesso topic | F3 (ROUTE-15) | Pending |
| Unsubscribe automatico in `unregisterPlugin` | F1 (LIFE-02) | Pending |
| Retry 4xx vs 5xx | F3 (ROUTE-09) | Pending |
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
- [ ] Installare `@vitest/coverage-v8` come devDependency root e ri-eseguire `pnpm --filter @sembridge/core test:coverage` post-Wave 3 per verificare target ≥ 90% sui file `core/`
- [ ] Eseguire Plan 07 (Wave 4 — `bus.ts` EventBus core: composizione del broker pub/sub usando le 9 utility dei plan 04/05/06 + noopEventTap pre-instrumentato)

### Active Blockers

Nessun blocker attivo.

### Open Questions

Nessuna domanda aperta. Le 11 open issues PRD §39 hanno già decisione raccomandata e fase di chiusura assegnata.

## Session Continuity

### Last Action

**Wave 3 chiusa** — plan 04, 05, 06 tutti completati. Plan 05 e 06 eseguiti in parallelo via spawn `gsd-executor` con `model: "opus"` (vincolo CLAUDE.md). File ownership disgiunta verificata: nessuna race su file modificati.

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

**Wave 4 — plan 07** (sequenziale, depende dall'intera Wave 3):

```
/gsd-execute-plan 1 07
```

Plan 07 (`bus.ts` EventBus core): composizione del broker pub/sub usando le 9 utility moduli dei plan 04/05/06:
- Pubblicazione: `createBrokerEvent` (event-factory) → `validateEvent` (event-validator) → step pipeline `event.received/metadata.enriched/validated/dedupe.checked/delivered` con `safeTapStep(noopEventTap, ...)` (event-tap).
- Subscribe wildcard via `TopicTrie<Subscription>` (topic-matcher).
- Topic discovery via `TopicRegistry` (topic-registry, plan 06).
- Validazione naming via `validateTopic` al `publish` (topic-matcher).
- Error wrapping via `createBrokerError` (broker-error) per errori validation/topic invalid.
- Deep-freeze payload pre-delivery via `deepFreeze` (deep-freeze) — opt-in dev mode CORE-12.
- Logging configurabile via `BrokerLogger` (logger).

Dopo plan 07 (bus.ts) seguono Wave 5+: 08 (Broker class composition + public API + plugin-registry), 09 (PipelineHarness fixture + integration tests), 10 (Robustness tests), 11 (Build verification + DOC-01).

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

**18 commit nuovi creati post-04 docs (`b0cecb7`):**
- Plan 05: `c97bc56`/`8c24e77` (topic-matcher), `239d010`/`6cd21e7` (event-factory), `d77398c`/`cf12502` (event-validator), `c2ec46b` (docs SUMMARY)
- Plan 06: `526336a`/`41866e7` (topic-registry), `c87ae5f`/`94db532` (lifecycle), `a6ae97e` (docs SUMMARY)
- Wave 3 closure docs: 1 commit pendente (questo)

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

**Plans complete (Phase 1):** 01-01 ✓, 01-02 ✓, 01-03 ✓, 01-04 ✓, 01-05 ✓, 01-06 ✓ — Wave 1 + Wave 2 + Wave 3 done. Wave 4 (plan 07 — `bus.ts` EventBus core) sbloccata, sequenziale.
