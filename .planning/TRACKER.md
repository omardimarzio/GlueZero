---
last_updated: 2026-05-04
status: phase_4_executing_wave_3_done_pending_wave_4_04_07_manager
project: SemBridge
milestone: v1.0
current_phase: 4
current_wave: 4
current_plan: phase_4_wave_4_04_07_realtime_channel_manager_next
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
| Fase | **Phase 4 — Realtime inbound (SSE/WS) — 🟢 EXECUTING (Wave 3 ✅ DONE: SSE+WS adapters; Wave 4 pending — 04-07 RealtimeChannelManager)** |
| Wave | **3 / 6 done; Wave 4 next** (04-05 + 04-06 done; 04-07 next sequential) |
| Plan in esecuzione | — (04-06 completato; 04-07 next sequential) |
| Plan progress F4 | 6 / 9 plan committed (04-01 + 04-02 + 04-03 + 04-04 + 04-05 + 04-06 done; 04-07..04-09 todo) |
| Plan progress globale | 43 / 46 (93%) |
| Mode GSD | yolo + auto_advance + parallelization (sequential exec, no worktree) |
| Modello attivo | `claude-opus-4-7-1` (opus) — override esplicito su tutti i sub-agent |

## Ultimo step completato (auto-update 2026-05-04T16:05:00Z)

- Plan: **04-06** → SUMMARY.md ready for commit
- Commit GREEN: `740ba5b feat(04-06): implement WebSocketAdapter (envelope JSON + ping/pong + stale + scheme switch + bufferedAmount cap)`
- Commit RED: `4349b8a test(04-06): add failing tests for WebSocketAdapter (D-101/D-106/D-107/D-111, RT-02/04/05/06)`
- Commit Helper: `4d4d654 test(04-06): add MockWebSocket test util with byChannelName indexing (B-NEW-2 fix iter 2)`
- Phase progress: **6/9** plan completati con SUMMARY.md
- Project progress: 43/46 plan (93%)


## Prossimo step

**Wave 4 — 04-07 RealtimeChannelManager (sequential):**

```
Skill: gsd-execute-phase 4
```

Plan da eseguire:
- **04-07** — realtime-channel-manager.ts (N-channel registry + cascade D-112 + visibility orchestration + reconnect loop) → consuma `createVisibilityDetector` da 04-04 + `createReconnectStrategy` da 04-03 + `SseAdapter` da 04-05 + `WebSocketAdapter` da 04-06; orchestration auto-fallback SSE↔WS (D-107 + reconnect.shouldFallback() / fallback() / globalCycleCap 5)

Wave struttura globale F4:
- ✅ Wave 1: 04-01 (bootstrap) — DONE 2026-05-04
- ✅ Wave 2: 04-02 + 04-03 + 04-04 — DONE 2026-05-04 (3 plan TDD building blocks)
- ✅ Wave 3: 04-05 + 04-06 — DONE 2026-05-04 (SSE+WS adapters production-ready)
- ⏳ Wave 4: 04-07 (RealtimeChannelManager + runReconnectLoop, consuma createVisibilityDetector da 04-04 + createReconnectStrategy da 04-03 + SseAdapter da 04-05 + WSAdapter da 04-06)
- ⏳ Wave 5: 04-08 (RealtimeBroker + integration tests Tier-1/2/3, usa MockEventSource.byChannelName + MockWebSocket.byChannelName per harness routing strict B-NEW-2)
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

- **Plan 04-06 ESEGUITO ✓ (Wave 3 close — WS adapter)** — `WebSocketAdapter` class production-ready: lifecycle connect/disconnect/checkFreshness, scheme switch automatico http(s)→ws(s) (D-107 — `switchScheme` con `URL` API + fallback regex), envelope JSON parsing strict via `parseFrame` di 04-02 (D-106), heartbeat ping/pong applicativo `{topic:'__ping__',data:{ts}}` ogni 30s con stale watchdog 60s (D-111 + anti-AP-4 RESEARCH §4.6 — `Date.now()-lastPongAt > staleTimeoutMs` → close + recordFailure), bufferedAmount cap 64KB pre-send (RESEARCH §4.4 — `BUFFERED_AMOUNT_PING_CAP` constant), close codes routing RFC 6455 §7.4 (`shouldReconnectOnCloseCode` pure function — 1000 normal/1002/1003/1007/1009/1010/1015 fatali → no recordFailure; altri → recordFailure manager-triggered), wsSubprotocols passthrough opt-in (Q4 — `new Ctor(wsUrl, subprotocols as string\|string[])`), AbortController cascade (D-112) con re-init al re-connect (pattern coerente con 04-05 Rule 1 fix), backpressure DI adapter-level (D-115 riuso F3 1:1 — schedule(channelName, 'normal', task)), DI WebSocketCtor per test jsdom (RESEARCH §9.1). PITFALL §11.7 anti-AP-6 verificato runtime: `isInternalTopic` strict (frame-parser di 04-02) — `__ping__`/`__pong__` consumed (pong aggiorna lastPongAt), `weather.__ping__` passa through (Test 7+15). 15/15 websocket-adapter test PASS, 175/175 gateway, **709/709 monorepo full**, tsc clean su 4 package. Anti-AP-3 verificato (0 import `reconnecting-websocket`); anti-AP-6 (0 `startsWith('__')`); anti-AP-2 (0 `Authorization`). MockWebSocket test util con `byChannelName` Map indicizzata via `?_channel=<name>` (B-NEW-2 fix iter 2 owned da 04-06, parallelo a MockEventSource owned da 04-05 — abilita harness routing strict 04-08). RT-02 closed (WebSocket adapter production-ready); RT-04/RT-05/RT-06/RT-07 progress (WS source descriptor + heartbeat + envelope JSON + ping/pong stale detection); ERR-02 ext (network.error category protocol Test 6 + system.realtime.connected/disconnected close codes Test 4/11/12). D-83 strict ✓ (zero modifiche fuori `gateway/src/sse-ws/`). Issue minore: DTS build TS5055 race condition con `clean: true` di tsup transient (risolto con `rm -rf dist` prima del rebuild — non è issue del codice).
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
