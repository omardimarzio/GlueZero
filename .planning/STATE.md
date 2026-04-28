---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_plan: 4 of 11
status: executing
last_updated: "2026-04-28T12:28:00Z"
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 11
  completed_plans: 3
  percent: 27
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
Current Plan: 4 of 11
Total Plans: 11

- **Phase:** 1 — Core essenziale
- **Plan:** 01-03 — Public types (BrokerEvent, Subscription, PluginDescriptor, BrokerError, BrokerLogger, EventTap, BrokerConfig, DeepReadonly) (COMPLETE)
- **Status:** Executing Phase 01-core-essenziale
- **Progress:** [███░░░░░░░] 27%

## Phases Overview

- **Total phases:** 6 (allineate 1:1 con PRD §32)
- **Phases complete:** []
- **Granularity:** coarse
- **Coverage:** 91/91 requisiti v1 mappati

| Phase | Goal (sintesi) | Status |
|-------|----------------|--------|
| 1 | Core essenziale (broker pub/sub, plugin registry, EventTap pre-instrumentato) | In progress (3/11 plans) |
| 2 | Canonical Model & Mapper bidirezionale + Mapping Inspector | Not started |
| 3 | Routing engine + HTTP gateway con retry/timeout/dedupe/auth | Not started |
| 4 | Realtime inbound (SSE prioritario, WS opzionale) | Not started |
| 5 | Worker Runtime (registry, route worker, task tracking) | Not started |
| 6 | Cache + Tooling avanzato (Inspector, Metrics, debug API) | Not started |

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases complete | 0 / 6 |
| Plans complete in current phase | 3 / 11 (Phase 1) |
| Plans abandoned | 0 |
| Plans repaired | 0 |
| Time per phase | — |
| Time per plan | 01-01: 4m 14s (3 tasks, 23 files); 01-02: 3m 19s (2 tasks, 7 files); 01-03: 6m 26s (3 tasks, 10 files) |

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
- [ ] Eseguire Wave 3 (plan 04, 05, 06 paralleli — utility moduli batch A/B/C)

### Active Blockers

Nessun blocker attivo.

### Open Questions

Nessuna domanda aperta. Le 11 open issues PRD §39 hanno già decisione raccomandata e fase di chiusura assegnata.

## Session Continuity

### Last Action

Plan 01-03 (Wave 2 — Public types) eseguito e committato (3 task, 3 commit, 10 file):

- 9 file types/ creati in `packages/core/src/types/`: `broker-event.ts` (BrokerEvent + EventSource + DeliveryMode + Priority + EventId branded), `deep-readonly.ts` (DeepReadonly<T> ricorsiva su Date/RegExp/Error/Map/Set/Array/object), `subscription.ts` (Subscription handle + SubscribeOptions con once?: boolean), `plugin.ts` (PluginDescriptor + PluginContext + PluginState + PluginRegistration interno), `error.ts` (BrokerError extends Error + 9 ErrorCategory + CreateBrokerErrorParams), `logger.ts` (LogLevel + BrokerLogger), `tap.ts` (PipelineStep 5 step F1 + PipelineSnapshot + EventTap), `config.ts` (BrokerConfig 10 sezioni — runtime/debug F1 + 8 placeholder F2-F6), `index.ts` (barrel `export type` di 20 tipi pubblici, registration record interno escluso)
- `packages/core/src/index.ts` modificato: sostituito `export {}` con `export type * from './types'` (Rule 2 — espone i tipi alla public API surface)
- `pnpm --filter @sembridge/core typecheck` exit 0
- `pnpm biome check packages/core/src/` exit 0 (10 file checked)
- `pnpm --filter @sembridge/core build` exit 0 — dist/index.d.ts cresciuto da 13 B a 4.53 KB con 20 tipi pubblici esposti

Deviation Rule applicate:
1. **Rule 1** — `DeepReadonly` rama Array: cambiato `ReadonlyArray<DeepReadonly<U>>` in shorthand `readonly DeepReadonly<U>[]` (Biome `useConsistentArrayType`)
2. **Rule 1** — `PipelineStep`: spostato il blocco future-step da union-trailing-comments a comment-block pre-type (rifiutato dal Biome formatter)
3. **Rule 2** — Aggiunto `export type * from './types'` a `src/index.ts` (correctness gap nel plan: senza questo i plan paralleli 04/05/06 non possono importare via `from '@sembridge/core'` e dist/index.d.ts resta vuoto)

Decisione planner confermata:
- `SubscribeOptions.once?: boolean` incluso (RESEARCH Open Question 1 risolta in favore)
- `PluginContext.broker: unknown` provvisorio (plan 08 risolverà via TS declaration merging)

### Next Action

Eseguire Wave 3 (plan 04, 05, 06 paralleli — utility moduli):

```
/gsd-execute-plan 1 04
/gsd-execute-plan 1 05
/gsd-execute-plan 1 06
```

Plan 04 (Utility batch A): `broker-error.ts` factory + costanti `ERR_CODES`, `deep-freeze.ts`, `console-logger.ts`, `event-tap.ts` (NoopEventTap).
Plan 05 (Utility batch B): `topic-matcher.ts` (Trie segmentato D-08/09/10/11), `event-factory.ts`, `event-validator.ts`.
Plan 06 (Utility batch C): `topic-registry.ts`, `subscriber-registry.ts`, `lifecycle.ts` (state machine D-25/26).

I plan paralleli importeranno i tipi da `@sembridge/core/types` (path interno) o `from '@sembridge/core'` (barrel — funzionante post-plan-03).

### Files Created/Updated in this Session

Plan 01-03 execution:

- `packages/core/src/types/broker-event.ts` (creato)
- `packages/core/src/types/deep-readonly.ts` (creato)
- `packages/core/src/types/subscription.ts` (creato)
- `packages/core/src/types/plugin.ts` (creato)
- `packages/core/src/types/error.ts` (creato)
- `packages/core/src/types/logger.ts` (creato)
- `packages/core/src/types/tap.ts` (creato)
- `packages/core/src/types/config.ts` (creato)
- `packages/core/src/types/index.ts` (creato — barrel)
- `packages/core/src/index.ts` (modificato — `export {}` → `export type * from './types'`)
- `.planning/phases/01-core-essenziale/01-03-SUMMARY.md` (creato)
- `.planning/STATE.md` (aggiornato con nuova posizione)
- `.planning/ROADMAP.md` (aggiornato con plan 01-03 completion)
- `.planning/REQUIREMENTS.md` (aggiornato con CORE-06/CORE-07/CORE-13/CORE-14/ERR-01/VAL-06 in stato `Pending — types defined, runtime in plan 04+`)

Build artifacts generati (gitignored): `packages/core/dist/index.js` (68 B placeholder runtime) + `packages/core/dist/index.d.ts` (4.53 KB con 20 tipi pubblici) + `packages/core/dist/index.js.map` (69 B)

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

**Plans complete (Phase 1):** 01-01 ✓, 01-02 ✓, 01-03 ✓ — Wave 1 + Wave 2 done. Wave 3 (04/05/06 paralleli) next.
