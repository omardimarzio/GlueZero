---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
last_updated: "2026-04-28T12:08:21.288Z"
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 11
  completed_plans: 1
  percent: 9
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
Current Plan: 2 of 11
Total Plans: 11

- **Phase:** 1 — Core essenziale
- **Plan:** 01-01 — Bootstrap monorepo + tooling root (COMPLETE)
- **Status:** Executing Phase 01-core-essenziale
- **Progress:** 1/11 plans complete in Phase 1 (`█▱▱▱▱▱▱▱▱▱▱`); 0/6 phases complete (`▱▱▱▱▱▱`)

## Phases Overview

- **Total phases:** 6 (allineate 1:1 con PRD §32)
- **Phases complete:** []
- **Granularity:** coarse
- **Coverage:** 91/91 requisiti v1 mappati

| Phase | Goal (sintesi) | Status |
|-------|----------------|--------|
| 1 | Core essenziale (broker pub/sub, plugin registry, EventTap pre-instrumentato) | In progress (1/11 plans) |
| 2 | Canonical Model & Mapper bidirezionale + Mapping Inspector | Not started |
| 3 | Routing engine + HTTP gateway con retry/timeout/dedupe/auth | Not started |
| 4 | Realtime inbound (SSE prioritario, WS opzionale) | Not started |
| 5 | Worker Runtime (registry, route worker, task tracking) | Not started |
| 6 | Cache + Tooling avanzato (Inspector, Metrics, debug API) | Not started |

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases complete | 0 / 6 |
| Plans complete in current phase | 1 / 11 (Phase 1) |
| Plans abandoned | 0 |
| Plans repaired | 0 |
| Time per phase | — |
| Time per plan | 01-01: 4m 14s (3 tasks, 23 files) |

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
- [ ] Decidere libreria validation finale (Valibot raccomandato, adapter pluggable per Zod/Ajv) — decisione tactical in F2 design
- [ ] Approvare manualmente install scripts esbuild/msw via `pnpm approve-builds` se serve in Plan 02 quando `@sembridge/core` configura tsup
- [ ] Eseguire Plan 02 (configurazione `@sembridge/core` con runtime deps + tooling per-package)

### Active Blockers

Nessun blocker attivo.

### Open Questions

Nessuna domanda aperta. Le 11 open issues PRD §39 hanno già decisione raccomandata e fase di chiusura assegnata.

## Session Continuity

### Last Action

Plan 01-01 (Bootstrap monorepo + tooling root) eseguito e committato (3 task, 3 commit, 23 file):

- pnpm 10.33.2 attivato via corepack
- 8 directory `packages/` create (core + 7 placeholder privati)
- Tooling root installato e verificato live: TS 6.0.3, Biome 2.4.13, Changesets 2.31.0, Vitest 4.1.5, tsup 8.5.1
- `pnpm install` 7.4s, 355 pacchetti
- `pnpm biome check .` exit 0
- `pnpm typecheck` exit 0 (con `--if-present`)

Deviation Rule 1 (auto-format Biome 2.4.13) e Rule 3 (`--if-present` per pnpm 10) applicate, documentate in 01-01-SUMMARY.md.

### Next Action

Eseguire Plan 02 (Wave 1):

```
/gsd-execute-plan 1 02
```

Plan 02: configurazione completa di `packages/core/` con `package.json` (runtime deps), `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`, `.size-limit.json`, stub `src/index.ts`.

### Files Created/Updated in this Session

Plan 01-01 execution:

- `package.json`, `pnpm-workspace.yaml`, `.npmrc`, `.gitignore`, `tsconfig.base.json` (root)
- `biome.json`, `.changeset/config.json`, `.changeset/README.md` (tooling)
- `pnpm-lock.yaml` (lockfile)
- 14 file `packages/<pkg>/{package.json, README.md}` per i 7 placeholder
- `.planning/phases/01-core-essenziale/01-01-SUMMARY.md` (creato)
- `.planning/STATE.md` (aggiornato con nuova posizione)

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
