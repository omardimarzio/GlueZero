---
last_updated: 2026-05-04
status: phase_4_executing_wave_3_04_05_done_pending_04_06
project: SemBridge
milestone: v1.0
current_phase: 4
current_wave: 3
current_plan: phase_4_wave_3_04_06_ws_adapter_next
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
| Fase | **Phase 4 — Realtime inbound (SSE/WS) — 🟢 EXECUTING (Wave 3: 04-05 SSE adapter ✅ DONE; pending 04-06 WS adapter)** |
| Wave | **3 / 6 in progress** (04-05 done; 04-06 next) |
| Plan in esecuzione | — (04-05 completato; 04-06 next sequential) |
| Plan progress F4 | 5 / 9 plan committed (04-01 + 04-02 + 04-03 + 04-04 + 04-05 done; 04-06..04-09 todo) |
| Plan progress globale | 42 / 46 (91%) |
| Mode GSD | yolo + auto_advance + parallelization (sequential exec, no worktree) |
| Modello attivo | `claude-opus-4-7-1` (opus) — override esplicito su tutti i sub-agent |

## Ultimo step completato (auto-update 2026-05-04T13:50:30Z)

- Plan: **04-05** → SUMMARY.md committed
- Commit: `bf848a1 docs(04-05): complete plan SUMMARY + STATE/ROADMAP/REQUIREMENTS/TRACKER update — Phase 4 Wave 3 SSE adapter done`
- Phase progress: **5/9** plan completati con SUMMARY.md
- Project progress: 42/46 plan (91%)


## Prossimo step

**Wave 3 — 04-06 WS adapter (sequential):**

```
Skill: gsd-execute-phase 4
```

Plan da eseguire:
- **04-06** — websocket-adapter.ts (envelope JSON D-106 + ping/pong app-level D-111 + scheme switch D-107 http/ws + state machine timing) → consuma `parseFrame` + `INTERNAL_TOPICS` + `isInternalTopic` da 04-02; usa `createReconnectStrategy` da 04-03; pattern adapter analog `sse-adapter.ts` da 04-05

Wave struttura globale F4:
- ✅ Wave 1: 04-01 (bootstrap) — DONE 2026-05-04
- ✅ Wave 2: 04-02 + 04-03 + 04-04 — DONE 2026-05-04 (3 plan TDD building blocks)
- 🟡 Wave 3: 04-05 ✅ DONE + 04-06 ⏳ pending (SSE/WS adapters)
- ⏳ Wave 4: 04-07 (RealtimeChannelManager + runReconnectLoop, consuma createVisibilityDetector da 04-04 + createReconnectStrategy da 04-03 + SseAdapter da 04-05 + WSAdapter da 04-06)
- ⏳ Wave 5: 04-08 (RealtimeBroker + integration tests Tier-1/2/3, usa MockEventSource.byChannelName per harness routing strict B-NEW-2)
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

- **Plan 04-05 ESEGUITO ✓ (Wave 3 — SSE adapter)** — `SseAdapter` class production-ready: lifecycle connect/disconnect/checkFreshness, Last-Event-ID via query string `?lastEventId=` (D-105 / RESEARCH §3.2 / chiusura RT-07), W-4 SC-1 closure (def.eventTypes loop addEventListener — topic deriva da event field SSE), B-5 Q5 closure (def.sseHeartbeatEventTypes default ['heartbeat'] silent freshness update senza publish), backpressure DI adapter-level (D-115 riuso F3), AbortController cascade (D-112) con re-init al re-connect (Rule 1 fix), DI EventSourceCtor per test jsdom (RESEARCH §9.1). MockEventSource test util con `byChannelName` Map (B-NEW-2 fix iter 2 owned da 04-05 — abilita harness routing strict 04-08). 14/14 test PASS, 160/160 gateway, **694/694 monorepo full**, tsc clean. Anti-AP-2 verificato (0 `Authorization`); anti-AP-3 (0 import `reconnecting-websocket`); AP-4 implicito (`es.close()` esplicito su error). RT-01/RT-04/RT-06/RT-07 progress (SSE-side closed; pending WS 04-06 + integration 04-07/04-08); RT-05 partial (createReconnectStrategy istanziata, loop reconnect del manager).
- **Plan 04-04 ESEGUITO ✓ (Wave 2 close)** — `createVisibilityDetector({ onChange, document })` factory event-driven. Pattern listener tracking analog `combine-signals.ts:62-86` (memoize listener ref + addEventListener + removeEventListener puntuale). DI guard 3-way: `undefined` → `globalThis.document`, `null` → explicit Worker/SSR disable (no-op + getState 'visible' default sicuro), `Document` mock → test injection. Idempotenza esplicita start/stop (T-04-04-02/03 mitigation). Anti-AP-5 verificato: 0 setInterval/setTimeout (event-driven puro). 11/11 test PASS, **680/680 monorepo full**, tsc clean su 4 package. RT-05 progresso (visibility wrapper done; pending heartbeat 04-05/06 + manager 04-07).
- **Plan 04-03 ESEGUITO ✓ (Wave 2)** — `createReconnectStrategy` factory state machine: full jitter D-109 + auto-fallback D-107 (threshold 3 + cycle cap 5) + Q3 §6.2 consolidationMs guard anti-flap (default 5000ms — opzione B). Interface 8 metodi, DI random+now per test deterministici. 15/15 test PASS, 669/669 monorepo, anti-AP-3 verificato (no `reconnecting-websocket` import). Pattern factory + closure analog circuit-breaker.ts F3.
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
