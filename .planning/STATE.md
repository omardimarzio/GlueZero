---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_plan: 5 of 11
status: executing
last_updated: "2026-04-28T15:47:16+02:00"
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 11
  completed_plans: 4
  percent: 36
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
Current Plan: 5 of 11
Total Plans: 11

- **Phase:** 1 — Core essenziale
- **Plan:** 01-04 — Utility batch A (broker-error + deep-freeze + logger + event-tap) (COMPLETE)
- **Status:** Executing Phase 01-core-essenziale
- **Progress:** [████░░░░░░] 36%

## Phases Overview

- **Total phases:** 6 (allineate 1:1 con PRD §32)
- **Phases complete:** []
- **Granularity:** coarse
- **Coverage:** 91/91 requisiti v1 mappati

| Phase | Goal (sintesi) | Status |
|-------|----------------|--------|
| 1 | Core essenziale (broker pub/sub, plugin registry, EventTap pre-instrumentato) | In progress (4/11 plans) |
| 2 | Canonical Model & Mapper bidirezionale + Mapping Inspector | Not started |
| 3 | Routing engine + HTTP gateway con retry/timeout/dedupe/auth | Not started |
| 4 | Realtime inbound (SSE prioritario, WS opzionale) | Not started |
| 5 | Worker Runtime (registry, route worker, task tracking) | Not started |
| 6 | Cache + Tooling avanzato (Inspector, Metrics, debug API) | Not started |

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases complete | 0 / 6 |
| Plans complete in current phase | 4 / 11 (Phase 1) |
| Plans abandoned | 0 |
| Plans repaired | 0 |
| Time per phase | — |
| Time per plan | 01-01: 4m 14s (3 tasks, 23 files); 01-02: 3m 19s (2 tasks, 7 files); 01-03: 6m 26s (3 tasks, 10 files); 01-04: ~6m wall-clock effective (4 tasks, 8 files, 8 commits — interrupted session) |

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
- [ ] Eseguire Wave 3 restanti (plan 05, 06 paralleli — utility moduli batch B/C)
- [ ] Installare `@vitest/coverage-v8` come devDependency root e ri-eseguire `pnpm --filter @sembridge/core test:coverage` post-Wave 3 per verificare target ≥ 90% sui file `core/`

### Active Blockers

Nessun blocker attivo.

### Open Questions

Nessuna domanda aperta. Le 11 open issues PRD §39 hanno già decisione raccomandata e fase di chiusura assegnata.

## Session Continuity

### Last Action

Plan 01-04 (Wave 3 — Utility batch A) eseguito e committato (4 task TDD RED→GREEN, 8 commit, 8 file):

- 4 source module creati in `packages/core/src/core/`: `broker-error.ts` (45 LOC — `createBrokerError` factory + `isBrokerError` type guard, ES2022 cause, conditional assignment per `exactOptionalPropertyTypes`), `deep-freeze.ts` (84 LOC — `deepFreeze<T>` + `DeepFreezeOptions`, WeakSet cycle protection, default skip Date/Promise/TypedArray, freeze Map/Set ricorsivi), `logger.ts` (64 LOC — `createConsoleLogger(level)` + `silentLogger`, LEVEL_ORDER 6 livelli, namespace `[sembridge]`, D-12 mapping con `trace→console.debug` + label TRACE), `event-tap.ts` (53 LOC — `noopEventTap`, `safeTapStep` con try/catch swallow D-20, `startStep` factory + `SnapshotFactory` type alias)
- 4 test suite create co-locate (391 LOC, 42 test totali): broker-error 9 test, deep-freeze 12 test, logger 11 test, event-tap 10 test
- TDD pattern RED→GREEN preservato per ognuno dei 4 task: 4 commit `test(01-04): aggiunge test RED ...` precedono i 4 commit `feat(01-04): implementa ...`
- Per Task 4 (event-tap) il pattern è stato ricostruito post-recovery: file presenti come untracked al momento della ripresa, due commit separati (`2d3cac7` test, `21e0939` feat) per coerenza con i task 1-3
- `pnpm --filter @sembridge/core test` exit 0: `Test Files 4 passed | Tests 42 passed | Duration 449 ms`
- `pnpm --filter @sembridge/core typecheck` exit 0
- `pnpm biome check packages/core/src/core/` exit 0 (8 file checked)

Deviation Rule applicate:
1. **Rule 2** — `SnapshotFactory` esportato come tipo nominato in `event-tap.ts` (RESEARCH inline-tipava la signature; alias nominato self-documenting per 5 chiamanti pipeline plan 07)
2. **Recovery (no rule)** — TDD RED/GREEN ricostruito per Task 4 dopo session interruption: `event-tap.ts` + `event-tap.test.ts` erano untracked, committati separatamente per preservare il git history del gate TDD

Open item (non bloccante):
- Coverage v8 NON misurata: missing dep `@vitest/coverage-v8`. 42/42 test passing su 4 moduli isolati copre i behavior path. Verificare al merge wave (post plan 06).

### Next Action

Continuare Wave 3 con i due plan paralleli rimanenti (file ownership disgiunta da plan 04 e tra loro):

```
/gsd-execute-plan 1 05
/gsd-execute-plan 1 06
```

Plan 05 (Utility batch B): `packages/core/src/core/topic-matcher.ts` (Trie segmentato D-08/09/10/11), `event-factory.ts`, `event-validator.ts`.
Plan 06 (Utility batch C): `packages/core/src/core/topic-registry.ts`, `subscriber-registry.ts`, `lifecycle.ts` (state machine D-25/26).

Plan 05 importerà `createBrokerError` da `./broker-error` (plan 04). Plan 06 importerà `createBrokerError` + `BrokerLogger` (logger.ts).

Dopo Wave 3 completa, Wave 4 (plan 07 — `bus.ts` EventBus) sarà sbloccata. Il bus consumerà tutti gli 8-9 moduli utility dei plan 04/05/06 + il `noopEventTap` per pre-instrumentare i 5 step F1.

### Files Created/Updated in this Session

Plan 01-04 execution:

- `packages/core/src/core/broker-error.ts` (creato)
- `packages/core/src/core/broker-error.test.ts` (creato)
- `packages/core/src/core/deep-freeze.ts` (creato)
- `packages/core/src/core/deep-freeze.test.ts` (creato)
- `packages/core/src/core/logger.ts` (creato)
- `packages/core/src/core/logger.test.ts` (creato)
- `packages/core/src/core/event-tap.ts` (creato)
- `packages/core/src/core/event-tap.test.ts` (creato)
- `.planning/phases/01-core-essenziale/01-04-SUMMARY.md` (creato)
- `.planning/STATE.md` (aggiornato con nuova posizione 5/11)
- `.planning/ROADMAP.md` (aggiornato con plan 01-04 completion)
- `.planning/REQUIREMENTS.md` (aggiornato con ERR-01/CORE-10/CORE-13 in stato `Done — runtime delivered in 01-04`)

8 commit creati (4 RED + 4 GREEN):
`a08cca7` test broker-error → `e0f2a4e` feat broker-error
`13dd13c` test deep-freeze → `06212c7` feat deep-freeze
`323b141` test logger → `8c0bf5b` feat logger
`2d3cac7` test event-tap → `21e0939` feat event-tap

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

**Plans complete (Phase 1):** 01-01 ✓, 01-02 ✓, 01-03 ✓, 01-04 ✓ — Wave 1 + Wave 2 done; Wave 3 in progress (1/3 — plan 04 done, plan 05/06 paralleli next).
