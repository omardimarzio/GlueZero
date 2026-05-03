---
last_updated: 2026-05-03
status: in_progress
project: SemBridge
milestone: v1.0
current_phase: 3
current_wave: 8
current_plan: 03-13
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
| Wave | **8 / 9** (next: 03-13 integration tests scenario meteo) |
| Plan in esecuzione | — (03-12 chiuso ✓) |
| Plan progress F3 | **12 / 14 completati** (03-01 → 03-12 con SUMMARY.md ✓) |
| Plan progress globale | 35 / 37 (95%) |
| Mode GSD | yolo + auto_advance + parallelization (sequential exec, no worktree) |
| Modello attivo | `claude-opus-4-7-1` (opus) — override esplicito su tutti i sub-agent |

## Ultimo step completato (auto-update 2026-05-03T09:49:13Z)

- Plan: **03-12** → SUMMARY.md committed
- Commit: `2def867 docs(03-12): complete RouterBroker composition wrapper plan execution`
- Phase progress: **12/14** plan completati con SUMMARY.md
- Project progress: 35/37 plan (95%)


## Prossimo step

**Per riprendere F3 da dove ci siamo fermati:**
```
/gsd-execute-phase 3 --auto --wave 8
```

Oppure spawn diretto agente per 03-13:
```
Agent(subagent_type="gsd-executor", model="opus", prompt="Execute plan 03-13 — Integration tests scenario meteo end-to-end. Read 03-13-PLAN.md. Create SUMMARY.md. Update STATE/ROADMAP.")
```

Dopo 03-12 il piano prosegue:
- 03-13 (Wave 8) — Integration tests scenario meteo ← NEXT
- 03-14 (Wave 9) — Final gate (coverage, CI, DOC-04)

## Vincoli attivi (da CLAUDE.md)

- **Modello:** SOLO `claude-opus-4-7-1` per tutti i sub-agent (mai sonnet, mai haiku — neanche per checker/synthesizer/verifier).
- **Lingua:** Italiano per risposte/prompt/commit/JSDoc descrittivi; inglese solo per codice/identificatori/comandi shell.
- **Boundary:** libero in `/Users/omarmarzio/programming/prova AI/`; fuori solo lettura/creazione.
- **Decisioni:** alta autonomia — chiedi solo per scope irreversibili, BLOCKER architetturali con tradeoff, valori che solo l'utente conosce.
- **Vincolo D-83:** ZERO modifiche a `packages/core/` runtime e `packages/mapper/` runtime per tutta F3 (composition wrapper pattern).
- **Auto-advance attivo:** discuss → plan → execute → verify automatico senza chiedere conferma.

## Decisioni recenti rilevanti

- **Plan 03-12 (Wave 7) ESEGUITO ✓** — RouterBroker composition wrapper + RouterEngine + createRouterBroker. 29/29 test deterministici TDD GREEN. D-83 strict verificato. 5 BLOCKER iter1 fix applicati. Cyclic workspace dep routing↔gateway gestito (type-only).
- **D-100** (NEW da revision plan iter 1): `RouterBroker` isola accesso `CanonicalRegistry` private di F2 via getter `getCanonicalSchemaForTopic` con loud throw + opt-in `requiresRouteTopics` come bypass. Documentata in `.planning/phases/03-routing-server-gateway-http/03-CONTEXT.md`.
- **Plan 03-12 fix tecnici** (auto-fix Rule 1/3 in execution):
  - Workspace dep: aggiunto `@sembridge/gateway` come dep di routing
  - Subpath: aggiunti re-export 7 createXxxStrategy a `@sembridge/gateway/http`
  - validator F3 V1 NO default (valibotAdapter signature mismatch — adapter conversion deferred F4/F6)
  - safeOptions injection per inner.publish (D-23 source default 'system:router')
  - emitTapStep inline pattern (startStep/safeTapStep non barrel-exposed in core)
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
