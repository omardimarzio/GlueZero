---
last_updated: 2026-05-04
status: phase_4_complete_ready_for_verifier
project: SemBridge
milestone: v1.0
current_phase: 5
current_wave: null
current_plan: phase_5_discuss_pending
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
| Fase | **Phase 5 — Worker Runtime — 🟢 NOT STARTED** (Phase 4 ✅ COMPLETE — ready for verifier; Phase 5 da avviare con `/gsd-discuss-phase 5 --research`) |
| Wave | — |
| Plan in esecuzione | — |
| Plan progress F4 | **9 / 9 (✅ COMPLETE)** — 04-01..04-09 done |
| Plan progress globale | 45 / 46+ (Phase 5+6 ancora da pianificare; 46 = baseline pre-F5) |
| Mode GSD | yolo + auto_advance + parallelization (sequential exec, no worktree) |
| Modello attivo | `claude-opus-4-7-1` (opus) — override esplicito su tutti i sub-agent |

## Ultimo step completato (auto-update 2026-05-04 fine plan 04-09)

- Plan: **04-09** → final gate F4 (5 commits + SUMMARY.md)
- Commit: vedi serie `761e4ad` test coverage doc + `3c01b73` style biome cleanup F4 + `7014380` docs README Realtime SSE/WS section + `e7638f9` docs JSDoc API pubblica + final docs commit closure
- Phase progress: **9/9** plan completati con SUMMARY.md (✅ Phase 4 COMPLETE)
- Project progress: 45/46 plan (Phase 4 chiusa, Phase 5+6 ancora da pianificare)
- Open issue PRD §39 #9 (RT-07) chiuso in DOC-04 README

## Prossimo step

**Avvio Phase 5 (Worker Runtime):**

```
Skill: gsd-discuss-phase 5 --research
```
o
```
Skill: gsd-plan-phase 5 --research
```

Plan da eseguire (TBD, da pianificare):
- WK-01..WK-07 da REQUIREMENTS.md
- Comlink + WorkerBridge, structuredClone default, WK-07 chiude PRD §39 #11 (serializzazione messaggi worker)
- F5 e F4 sono ortogonali — F5 può iniziare in qualsiasi momento dopo Phase 3

Wave struttura globale F4 (RIEPILOGO CHIUSURA):
- ✅ Wave 1: 04-01 (bootstrap) — DONE 2026-05-04
- ✅ Wave 2: 04-02 + 04-03 + 04-04 — DONE 2026-05-04 (3 plan TDD building blocks)
- ✅ Wave 3: 04-05 + 04-06 — DONE 2026-05-04 (SSE+WS adapters production-ready)
- ✅ Wave 4: 04-07 — DONE 2026-05-04 (RealtimeChannelManager + runReconnectLoop B-4 closure + cycle-cap)
- ✅ Wave 5: 04-08 — DONE 2026-05-04 (RealtimeBroker composition + createRealtimeBroker + 14 integration test 3-tier + harness)
- ✅ Wave 6: 04-09 — DONE 2026-05-04 (final gate F4: coverage v8 doc + biome cleanup + DOC-04 README italiano + JSDoc + REQUIREMENTS/ROADMAP/STATE/TRACKER closure; PRD §39 #9 RT-07 closed)

Phase 4 closure highlights:
- ✅ RT-01..RT-07 + ERR-02 ext + LIFE-02 ext F4 + TEST-01/02/03 ext F4 → Complete
- ✅ DOC-04 README esteso con sezione Realtime SSE/WS (+298 LOC italiano, 14 sub-paragrafi: Quick start, Auth, Frame envelope, SSE eventTypes, SSE heartbeat, Reconnect contract, Ping/pong WS, Auto-fallback D-107+D-108, Visibility, Cascade cleanup, Backpressure, Mapper+Validation D-114+D-116, Test 3-tier D-118, Limitazioni V1 + Q1-Q6 closure rationale)
- ✅ Coverage v8 sse-ws/ subset 91.80% statements / 86.70% branches / 89.53% functions / 93.75% lines (supera target ≥85/75/88/87)
- ✅ CI gates: publint ✅, attw ESM-only ✅, biome ✅ zero errors, typecheck ✅, build ✅
- ✅ D-83 strict carryover verified — zero modifiche runtime a F1-F3 + gateway/http per tutta F4
- ✅ Phase 5 pronta a iniziare (parallelizzabile con Phase 4 verificata)

## Vincoli attivi (da CLAUDE.md)

- **Modello:** SOLO `claude-opus-4-7-1` per tutti i sub-agent (mai sonnet, mai haiku — neanche per checker/synthesizer/verifier).
- **Lingua:** Italiano per risposte/prompt/commit/JSDoc descrittivi; inglese solo per codice/identificatori/comandi shell.
- **Boundary:** libero in `/Users/omarmarzio/programming/prova AI/`; fuori solo lettura/creazione.
- **Decisioni:** alta autonomia — chiedi solo per scope irreversibili, BLOCKER architetturali con tradeoff, valori che solo l'utente conosce.
- **Vincolo D-83:** ZERO modifiche a `packages/core/` runtime e `packages/mapper/` runtime per tutta F3 (composition wrapper pattern).
- **Auto-advance attivo:** discuss → plan → execute → verify automatico senza chiedere conferma.

## Decisioni recenti rilevanti

- **Plan 04-09 ESEGUITO ✓ (Wave 6 — Final gate F4 — Phase 4 CHIUSA)** — Final gate F4 completato in 5 commits atomic: `761e4ad` test coverage thresholds documentation post-implementation (sse-ws/ subset 91.80% statements / 86.70% branches / 89.53% functions / 93.75% lines, supera target ≥85/75/88/87 — thresholds globali invariati per non rompere CI di sviluppi in corso che potrebbero introdurre defensive try/catch nel sub-modulo /http). `3c01b73` style biome auto-format su 19 file sse-ws/ + 2 lint fix manuali (frame-parser.ts: biome-ignore lint/complexity/useLiteralKeys per `obj['topic']`/`obj['data']`/`obj['id']` su `Record<string,unknown>` — `noPropertyAccessFromIndexSignature` TS strict richiede bracket access; realtime-broker.ts: `disconnectRealtime` rimosso `return` su void chain — lint/correctness/noVoidTypeReturn). `7014380` docs README Realtime SSE/WS section +298 LOC italiano: 14 sub-paragrafi (Quick start, Auth patterns D-104/D-105 4 strategie, Frame envelope D-106 con Q2 closure category 'protocol' nel payload, SSE custom event types W-4 SC-1, SSE heartbeat hook B-5 Q5, Reconnect contract RT-05 + Last-Event-ID query string + system.realtime.* + Q3 consolidationMs, Ping/pong WS D-111 strict-match Q1, Auto-fallback D-107+D-108 caveat path differenti V1, Visibility-aware D-110, Cascade cleanup D-112 LIFE-02 ext F4, Backpressure adapter-level D-115 riuso F3, Mapper+Validation D-114+D-116 W-2 closure scenario meteo, Test 3-tier D-118 B-1 closure, Limitazioni V1 + Q1-Q6 closure rationale). `e7638f9` docs JSDoc API pubblica TypeDoc-ready: 5 file public arricchiti con @see/@throws/@param (RealtimeBroker class header con 3 @example + 3 @see; createRealtimeBroker con @example + @throws + 2 @see; SseAdapter/WebSocketAdapter/RealtimeChannelManager con @example + cross-references; build verifica preservation in dts: 12 @example + 21 @see in `dist/sse-ws/index.d.ts`). Final docs commit (REQUIREMENTS/ROADMAP/STATE/TRACKER + SUMMARY 04-09). REQ flip: RT-01..RT-07 + ERR-02 ext + LIFE-02 ext F4 + TEST-01/02/03 ext F4 → Complete. **PRD §39 #9 (RT-07) chiuso** in DOC-04. Test invariato 222/225 gateway + 756/759 monorepo (no regression). D-83 strict carryover ✓ verified `git diff packages/{core,mapper,routing}/src/ packages/gateway/src/http/` zero hits per tutta F4 (verificato dal first commit Phase 4 `d090a1b` parent). Phase 4 ready for gsd-verifier; Phase 5 (Worker Runtime, parallelizzabile con F4) can start.

- **Plan 04-08 ESEGUITO ✓ (Wave 5 — RealtimeBroker composition + integration tests Tier-1/2/3)** — `RealtimeBroker` composition wrapper di RouterBroker (D-101 + D-83 strict) con manager `RealtimeChannelManager`; `createRealtimeBroker` public factory (D-30 no singleton + Valibot safeParse, prefix "Invalid RealtimeBrokerConfig"); `createRealtimeHarness` fixture per integration test (subscribe wildcard multi-depth `'*','*.*','*.*.*','*.*.*.*'` — W-3 closure NIENTE monkey-patch broker.publish + byChannelName routing B-2/B-NEW-2 closure). **W-1 closure verified live**: `Broker.publish(topic, payload, options)` (F1 broker.ts:155-163) accetta `options.source` e `options.id`, propagati invariati F2→F3→F1 fino a `createBrokerEvent` (event-factory.ts:52). Test 11 BEHAVIOR-VERIFICATING: subscriber riceve `event.source.type === 'server'` + `event.source.name === 'sse'` end-to-end. **W-5 closure**: registerPlugin con channel-register fail emette `system.warn` con `reason='realtime-channel-register-failed'` (Test 12). **B-3 closure**: tutti 12 test broker BEHAVIOR-VERIFICATING (asserzioni su getDebugSnapshot/subscribe callback, zero placeholder presence-only). **B-4 closure auto-fallback effettivo via integration test**: `auto-fallback.test.ts` Test 1 sostituisce `globalThis.EventSource` con `FailingMockEventSource` che throw nel constructor → forza il path `manager.connect → catch → runReconnectLoop` → dopo `fallbackThreshold:1` rebind a `MockWebSocket` (`expect(MockWebSocket.instances.length).toBeGreaterThanOrEqual(1)`). Test 2 cycle-cap: SSE+WS entrambi failing → `system.realtime.failed` con `reason='cycle-cap-exceeded'`. **D-118 3-tier closure**: Tier-1 jsdom 8 file 13 test passing + Tier-2 MSW 3 file `describe.skip` V1.x deferred (jsdom no native EventSource per RT-07 round-trip; ws.link compat) + Tier-3 Playwright real Chromium 1 test attivo (W-NEW-1 EventSource API verified non-mock). **Vitest 4.x browser provider API**: pre-4.x stringa, post-4.x factory function — installato `@vitest/browser 4.1.5` + `@vitest/browser-playwright 4.1.5` + Playwright Chromium binary. **W-NEW-3 closure**: `vitest.config.ts` exclude `**/__browser__/**` per evitare carico Tier-3 in jsdom run. 4 commits TDD: `c436293` RED test + `2d3417e` GREEN feat broker+factory + `48acfae` feat harness + `ccedd3a` test integration+barrel. **18 nuovi file ~1620 LOC** (realtime-broker 296 + test 220 + factory 123 + test 64 + harness 223 + 11 integration test files + 1 browser smoke). **222/225 gateway** (3 skip MSW V1.x), **756/759 monorepo full**, tsc clean su 5 package, build OK con `dist/sse-ws/{index,augment}.{js,d.ts}` + `createRealtimeBroker` esportato (17 occurrence in dts). RT-01..RT-07 + ERR-02 + TEST-01/02/03 progress; RT-06 + RT-07 marked complete. D-83 strict ✓ verified `git diff packages/{core,mapper,routing}/src/ packages/gateway/src/http/` zero hits. Pronto per 04-09 final gate (publint/attw/size-limit + DOC-04).

- **Plan 04-07 ESEGUITO ✓ (Wave 4 — RealtimeChannelManager)** — `RealtimeChannelManager` class production-ready: registry N-canale `Map<string, ChannelEntry>` indicizzato per `name` (D-102, anti-AP-11 verificato — Map by `name`, NON by `url`), lazy-init del `VisibilityDetector` al PRIMO connect (`channels.size === 0 && visibility === null`) + teardown automatico all'ULTIMO disconnect (`channels.size === 0` post-cleanup) (D-110), cascade cleanup `disconnectByOwner(ownerId, reason?)` D-112 (pattern identico a `HttpGateway.abortInFlightByOwner` di F3), factory dispatch `SseAdapter` (mode='sse'|'auto') / `WebSocketAdapter` (mode='websocket') con default 'auto'→'sse' SSE-first (D-107), duplicate guard `realtime.channel.duplicate` (BrokerError category 'config' — ErrorCategory F1 senza modifica core D-83), `runReconnectLoop` privato con `RealtimeManagerClock` DI per testabilità sync (`clock.sleep = () => Promise.resolve()` per test microtask resolution senza fake timers vitest). **B-4 closure D-107 auto-fallback EFFETTIVO**: pre-fix nessun runner orchestrava il fallback effettivo, post-fix `runReconnectLoop` while-loop `nextDelayMs() → publish system.realtime.reconnecting → clock.sleep → shouldFallback() ? fallback() : getMode() → costruisce nuovo adapter (rebind SSE→WS) → connect → recordSuccess|recordFailure` (Test 13 verifica MockWebSocket.lastInstance non-null dopo SSE failing + fallbackThreshold=1). **B-4 cycle-cap**: maxAttempts/globalCycleCap esauriti → `strategy.isPermanentlyFailed()` true → publish `system.realtime.failed reason='cycle-cap-exceeded'` (Test 14). **B-NEW-1 fix iter 2**: signature loop allineata strict a interface ReconnectStrategy 04-03 — `getMode()` (NOT `currentMode()`), `nextDelayMs()` no-arg, `recordFailure()` no-arg, `fallback()` toggla mode + ritorna nuovo, `shouldFallback()`, `isPermanentlyFailed()` — verifica grep `currentMode\|currentAttempt` runtime = 0 match. `entry.manuallyClosed = true` flag setttato in disconnect/disconnectByOwner blocca `runReconnectLoop` al prossimo while-check (T-04-07-04 mitigation — Test 15). 16/16 test PASS, **191/191 gateway**, **725/725 monorepo full**, tsc clean su 4 package (core/mapper/routing/gateway). D-83 strict ✓ (zero modifiche fuori `gateway/src/sse-ws/`). Anti-AP-11 verificato (Map by name, zero multiplex by URL); anti-AP-3 (0 import `reconnecting-websocket`). RT-01/RT-02/RT-03/RT-04/RT-05 progress (manager API surface esposta + runReconnectLoop orchestrator); ERR-02 ext (`system.realtime.reconnecting/connected/failed` via `publishSystem` helper con `source: { type: 'system', id: 'realtime-channel-manager', name: 'manager' }`). Building block pronto per consumer 04-08 RealtimeBroker (composition wrapper di RouterBroker — comporrà il manager via `new RealtimeChannelManager` con `publishFn` legato al `RouterBroker.publish` interno; espone `connectRealtime`/`disconnectRealtime` consumer-facing API; wrappa `unregisterPlugin(pluginId)` per propagare cascade D-112 via `manager.disconnectByOwner(pluginId, 'plugin.unregistered')`). 2 commits TDD: `2247c69` RED test + `1ee900f` GREEN feat.
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
