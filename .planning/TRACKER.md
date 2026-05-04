---
last_updated: 2026-05-04
status: phase_4_executing_wave_2_partial_04_02_done
project: SemBridge
milestone: v1.0
current_phase: 4
current_wave: 2
current_plan: phase_4_wave_2_continue_04_03_04_04
session_active: true
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
| Fase | **Phase 4 — Realtime inbound (SSE/WS) — 🟢 EXECUTING (Wave 2 partial: 04-02 done)** |
| Wave | **1 / 6 done + Wave 2 partial** (Wave 2 remaining: 04-03 ∥ 04-04) |
| Plan in esecuzione | — (04-02 completato; Wave 2 remaining: 04-03 + 04-04) |
| Plan progress F4 | 2 / 9 plan committed (04-01 + 04-02 done; 04-03..04-09 todo) |
| Plan progress globale | 39 / 46 (85%) |
| Mode GSD | yolo + auto_advance + parallelization (sequential exec, no worktree) |
| Modello attivo | `claude-opus-4-7-1` (opus) — override esplicito su tutti i sub-agent |

## Ultimo step completato (2026-05-04 — plan 04-02)

- Plan: **04-02** → SUMMARY.md committed (frame-parser puro WebSocket envelope JSON)
- Commits TDD: `26cc3c2` RED test + `edcbf3b` GREEN feat (+ commit metadata SUMMARY/STATE/ROADMAP/TRACKER finale)
- Files: 3 nuovi (332 LOC: types/frame-envelope.ts 50 + frame-parser.ts 140 + frame-parser.test.ts 142)
- Tests: 15/15 frame-parser PASS + 120/120 gateway suite + 654/654 monorepo full
- D-83 strict ✓ (zero modifiche fuori `gateway/src/sse-ws/`)
- PITFALL §11.7 chiusura Q1 anti-AP-6 verificato (`grep startsWith('__')` = 0)
- Q2 closure 04-CONTEXT — riuso ERR-02 ext F3 `network.error` per frame parse errors
- Phase progress: **2/9** plan completati con SUMMARY.md
- Project progress: 39/46 plan (85%)


## Prossimo step

**Wave 2 — 2 plan paralleli rimanenti con file ownership disgiunta (04-02 already done):**

```
Skill: gsd-execute-phase 4
```

Plan da eseguire (parallel-friendly, no scrittura su file 04-01/04-02):
- **04-03** — reconnect-strategy.ts (full-jitter D-109 + auto-fallback D-107 + consolidationMs Q3) → scrive `reconnect-strategy.{ts,test.ts}`
- **04-04** — visibility-detector.ts (D-110 + DI guard Worker/SSR) → scrive `visibility-detector.{ts,test.ts}`

Wave struttura globale F4:
- ✅ Wave 1: 04-01 (bootstrap) — DONE 2026-05-04
- 🟡 Wave 2: 04-02 done ∥ 04-03 todo ∥ 04-04 todo
- ⏳ Wave 3: 04-05 ∥ 04-06 (2 parallel — SSE/WS adapters; 04-06 consuma parseFrame da 04-02)
- ⏳ Wave 4: 04-07 (RealtimeChannelManager + runReconnectLoop)
- ⏳ Wave 5: 04-08 (RealtimeBroker + integration tests Tier-1/2/3)
- ⏳ Wave 6: 04-09 (final gate)

Phase 4 lock highlights:
- Auth-agnostic via `buildUrl()` hook (D-104)
- Envelope JSON `{topic, data, id?}` per WS (D-106)
- `RealtimeChannelManager` con N canali (D-102)
- Auto-fallback SSE→WS default abilitato V1 (D-107)
- Composition wrapper `RealtimeBroker` su `RouterBroker` (D-101 ext D-83)
- Mapper server→canonical riusato + pipeline §28 step 1 ingress (D-113, D-114)
- Cascade cleanup `unregisterPlugin` ext F4 (D-112 ext D-86)
- Test TDD RED→GREEN + coverage v8 ≥90% (D-117 ext D-88/D-92)

## Vincoli attivi (da CLAUDE.md)

- **Modello:** SOLO `claude-opus-4-7-1` per tutti i sub-agent (mai sonnet, mai haiku — neanche per checker/synthesizer/verifier).
- **Lingua:** Italiano per risposte/prompt/commit/JSDoc descrittivi; inglese solo per codice/identificatori/comandi shell.
- **Boundary:** libero in `/Users/omarmarzio/programming/prova AI/`; fuori solo lettura/creazione.
- **Decisioni:** alta autonomia — chiedi solo per scope irreversibili, BLOCKER architetturali con tradeoff, valori che solo l'utente conosce.
- **Vincolo D-83:** ZERO modifiche a `packages/core/` runtime e `packages/mapper/` runtime per tutta F3 (composition wrapper pattern).
- **Auto-advance attivo:** discuss → plan → execute → verify automatico senza chiedere conferma.

## Decisioni recenti rilevanti

- **Phase 4 CONTEXT.md (D-101..D-120)** — 20 decisioni nuove: auth-agnostic `buildUrl`, envelope JSON `{topic,data,id}`, RealtimeChannelManager N-canali, auto-fallback SSE→WS default abilitato (cap 5 cicli), Visibility API integration, composition wrapper RealtimeBroker, riuso pipeline §28 + mapper F2/F3 + backpressure F3 + cascade cleanup F1.
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
