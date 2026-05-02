---
last_updated: 2026-04-30
status: in_progress
project: SemBridge
milestone: v1.0
current_phase: 3
current_wave: 4
current_plan: 03-09
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
| Wave | **5 / 9** (next: 03-09 Strategies retry+timeout+idempotency) |
| Plan in esecuzione | — (03-08 chiuso ✓) |
| Plan progress F3 | **8 / 14 completati** (03-01 → 03-08 con SUMMARY.md ✓) |
| Plan progress globale | 32 / 37 (86%) |
| Mode GSD | yolo + auto_advance + parallelization (sequential exec, no worktree) |
| Modello attivo | `claude-opus-4-7-1` (opus) — override esplicito su tutti i sub-agent |

## Ultimo step completato

- **03-08 HttpGateway core + policy chain + http-handler** → SUMMARY committed (`docs(03-08): complete plan execution`)
- 6 commits sequenziali: `1f265fc` test RED utility + `61014e8` feat GREEN utility + `1dc5a86` test RED HttpGateway + `99a1d73` feat GREEN HttpGateway + `bf1477d` test RED http-handler + `32c3eb8` feat GREEN http-handler
- 35/35 test passing (15 utility + 13 HttpGateway+factory + 7 http-handler); routing 58/58 + gateway 33/33 zero regressioni
- **D-83 verificato strict:** `git diff HEAD~6 -- packages/core/ packages/mapper/` → empty; core 248/248 + mapper 183/183 invariati
- REQ-IDs chiusi: ROUTE-03, ROUTE-06, ROUTE-13, SEC-04, SEC-05, VAL-05
- Decisione architetturale: structural-typed deps in `http-handler` (HttpHandlerGateway/Mapper/Validator) per evitare cyclic dependency `@sembridge/routing` ↔ `@sembridge/gateway` — RouterBroker plan 03-12 cabla istanze concrete

## Prossimo step

**Per riprendere F3 da dove ci siamo fermati:**
```
/gsd-execute-phase 3 --auto --wave 4
```

Oppure spawn diretto agente per completare 03-08:
```
Agent(subagent_type="gsd-executor", model="opus", prompt="Execute plan 03-08 — completare i task GREEN HttpGateway + http-handler già iniziati. Read existing partial commits 1f265fc/61014e8/1dc5a86. Create SUMMARY.md. Update STATE/ROADMAP.")
```

Dopo 03-08 il piano prosegue:
- 03-09 (Wave 4) — Strategies retry+timeout+idempotency
- 03-10 (Wave 5) — Strategies dedupe+backpressure
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
