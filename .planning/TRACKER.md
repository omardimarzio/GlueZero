---
last_updated: 2026-05-03
status: phase_3_complete
project: SemBridge
milestone: v1.0
current_phase: 4
current_wave: 1
current_plan: pending_verifier_then_discuss_phase_4
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
| Fase | **Phase 3 — Routing & Server Gateway HTTP — ✅ COMPLETE** |
| Wave | **9 / 9** completata (03-14 final gate ✓) |
| Plan in esecuzione | — (Phase 3 chiusa, ready for verifier) |
| Plan progress F3 | **14 / 14 completati** (03-01 → 03-14 con SUMMARY.md ✓) |
| Plan progress globale | 37 / 37 (100%) |
| Mode GSD | yolo + auto_advance + parallelization (sequential exec, no worktree) |
| Modello attivo | `claude-opus-4-7-1` (opus) — override esplicito su tutti i sub-agent |

## Ultimo step completato (auto-update 2026-05-03T23:05Z)

- Plan: **03-14** → final gate F3 + SUMMARY.md committed
- Commits: `86790f0` (README italiani 600 LOC), `660fec6` (biome cleanup + manual TS bracket fix), `9922a36` (CI gates extension + size budget realistic)
- Phase progress: **14/14** plan completati
- Project progress: 37/37 plan (100%)
- 4 open issues PRD §39 chiusi cumulativamente F3: #5 ROUTE-16, #6 ROUTE-15, #7 LIFE-02 ext F3, #8 ROUTE-09
- D-83 strict ✓ (zero modifiche packages/core/ né packages/mapper/ runtime per tutta F3 — 14 plan)


## Prossimo step

**Phase 3 → verifier → Phase 4 discuss:**

```
/gsd-verifier 3   # goal-backward verification 5 success criteria + 29 REQ-IDs
/gsd-discuss-phase 4 --auto --research   # Realtime SSE/WS adapter
```

Phase 4 prevede:
- Adapter SSE prioritario (`@sembridge/gateway/sse-ws`)
- Adapter WebSocket opzionale
- Reconnection policy (Last-Event-ID per SSE, ping app-level per WS, exponential backoff full-jitter cap 30s, Visibility API integration)
- Chiude PRD §39 #9 (RT-07)
- 7 REQ-IDs: RT-01..RT-07

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
