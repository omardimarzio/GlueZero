---
last_updated: 2026-05-02
status: in_progress
project: SemBridge
milestone: v1.0
current_phase: 3
current_wave: 5
current_plan: 03-10
session_active: false
---

# TRACKER — SemBridge

> **Boot protocol:** Questo file è la fonte canonica per ripartire dopo `/clear` o crash. Aggiornato dopo ogni step significativo.
>
> **Read order al boot:**
> 1. Questo file (`.planning/TRACKER.md`)
> 2. `.planning/STATE.md` per cross-check
> 3. `CLAUDE.md` per vincoli operativi
> 4. Memoria GSD-Claude (auto-loaded)

## Stato corrente

| Campo | Valore |
|-------|--------|
| Fase | **Phase 3 — Routing & Server Gateway HTTP** |
| Wave | **6 / 9** (next: 03-10 Strategies dedupe+backpressure) |
| Plan in esecuzione | — (03-09 chiuso ✓) |
| Plan progress F3 | **9 / 14 completati** (03-01 → 03-09 con SUMMARY.md ✓) |
| Plan progress globale | 33 / 37 (89%) |
| Mode GSD | yolo + auto_advance + parallelization (sequential exec, no worktree) |
| Modello attivo | `claude-opus-4-7-1` (opus) — override esplicito su tutti i sub-agent |

## Ultimo step completato (auto-update 2026-05-02T11:32:32Z)

- Plan: **03-09** → SUMMARY.md committed
- Commit: `0ff3566 docs(03-09): complete strategies retry+timeout+idempotency plan execution`
- Phase progress: **9/14** plan completati con SUMMARY.md
- Project progress: 33/37 plan (89%)


## Prossimo step

**Per riprendere F3 da dove ci siamo fermati:**
```
/gsd-execute-phase 3 --auto --wave 5
```

Oppure spawn diretto agente per 03-10:
```
Agent(subagent_type="gsd-executor", model="opus", prompt="Execute plan 03-10 — Strategies Wave 4-B dedupe+backpressure. Read 03-10-PLAN.md. Create SUMMARY.md. Update STATE/ROADMAP.")
```

Dopo 03-10 il piano prosegue:
- 03-10 (Wave 5) — Strategies dedupe+backpressure ← NEXT
- 03-11 (Wave 6) — Strategies auth+circuit-breaker
- 03-12 (Wave 7) — RouterBroker composition + LIFE-02 cascade
- 03-13 (Wave 8) — Integration tests scenario meteo
- 03-14 (Wave 9) — Final gate (coverage, CI, DOC-04)

## Vincoli attivi (da CLAUDE.md)

- **Modello:** SOLO `claude-opus-4-7-1` per tutti i sub-agent (mai sonnet, mai haiku — neanche per checker/synthesizer/verifier).
- **Lingua:** Italiano per risposte/prompt/commit/JSDoc descrittivi; inglese solo per codice/identificatori/comandi shell.
- **Boundary:** libero in `/Users/omarmarzio/programming/prova AI/`; fuori solo lettura/creazione.
- **Decisioni:** alta autonomia — chiedi solo per scope irreversibili, BLOCKER architetturali con tradeoff, valori che solo l'utente conosce.
- **Vincolo D-83:** ZERO modifiche a `packages/core/` runtime e `packages/mapper/` runtime per tutta F3 (composition wrapper pattern).
- **Auto-advance attivo:** discuss → plan → execute → verify automatico senza chiedere conferma.

## Decisioni recenti rilevanti

- **D-100** (NEW da revision plan iter 1): `RouterBroker` isola accesso `CanonicalRegistry` private di F2 via getter `getCanonicalSchemaForTopic` con loud throw + opt-in `requiresRouteTopics` come bypass. Documentata in `.planning/phases/03-routing-server-gateway-http/03-CONTEXT.md`.
- **Plan 03-12 (Wave 7) modifiche revision iter 1:**
  - topic `'routing.composite.cache-deferred'` → `'routing.composite.deferred'` (TOPIC_REGEX no hyphen)
  - aggiunto `subscribe<T>(...)` delegate esplicito su RouterBroker
  - ROUTE-16 chiusura via opt-in `requiresRouteTopics` + loud throw (no silent fallback)
- **Plan 03-11 (Wave 6) modifica revision iter 1:** `category: 'auth'` → `category: 'config'` (ErrorCategory union non include 'auth' e D-83 vieta modifica core).

## Agent in background

Nessun agent attualmente in background. (Vedi `Agent IDs` in cronologia conversazione per recovery via SendMessage.)

## File chiave

- `prd.md` (root) — fonte autoritativa unica
- `CLAUDE.md` — vincoli operativi
- `.planning/STATE.md` — stato GSD ufficiale
- `.planning/ROADMAP.md` — 6 fasi v1.0
- `.planning/REQUIREMENTS.md` — 91 REQ-ID
- `.planning/phases/03-routing-server-gateway-http/03-CONTEXT.md` — 41 decisioni D-60..D-100 lockate
- `.planning/phases/03-routing-server-gateway-http/03-RESEARCH.md` — 1282 LOC research
- `.planning/phases/03-routing-server-gateway-http/03-PATTERNS.md` — 30 file analoghi F1/F2

## Note libere

- L'utente ha richiesto persistenza completa post-`/clear` con TRACKER.md aggiornato dopo ogni step. Questo file è la pietra angolare della ripartenza.
- Aggiornamenti TRACKER.md sono parte del workflow GSD e vanno committati insieme a SUMMARY/STATE/ROADMAP per consistency.
- Boundary esteso (era SemBridge, ora `/Users/omarmarzio/programming/prova AI/`) → tutti i progetti dentro sono area libera operativa.
