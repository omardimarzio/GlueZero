---
phase: 04-realtime-inbound-sse-prioritario-ws-opzionale
plan: 07
subsystem: gateway/sse-ws
tags:
  - realtime
  - manager
  - registry
  - cascade-cleanup
  - visibility
  - reconnect-loop
  - tdd
requirements:
  - RT-01
  - RT-02
  - RT-03
  - RT-04
  - RT-05
  - ERR-02
dependency_graph:
  requires:
    - 04-01
    - 04-03
    - 04-04
    - 04-05
    - 04-06
  provides:
    - RealtimeChannelManager (N-channel registry + cascade D-112 + visibility orchestration + runReconnectLoop)
  affects:
    - 04-08 (RealtimeBroker compone Manager via createRealtimeBroker)
tech-stack:
  added: []
  patterns:
    - registry-by-name (D-102, anti-AP-11 — niente multiplex by URL)
    - lazy-init-singleton (Visibility detector al primo connect, teardown all'ultimo disconnect — D-110)
    - cascade-cleanup-by-owner (D-112 — pattern http-gateway abortInFlightByOwner)
    - factory-dispatch (mode='sse'|'auto'→SseAdapter, 'websocket'→WebSocketAdapter)
    - clock-injection-DI (testabilità runReconnectLoop sync — B-4)
    - reconnect-state-machine-orchestrator (B-4 + B-NEW-1 fix iter 2 — interface 04-03 strict)
key-files:
  created:
    - packages/gateway/src/sse-ws/realtime-channel-manager.ts (578 LOC)
    - packages/gateway/src/sse-ws/realtime-channel-manager.test.ts (489 LOC)
  modified: []
decisions:
  - 'D-102 confirmed: Map<name, ChannelEntry> indicizzata per `name`, una connection fisica per canale'
  - 'D-110 confirmed: VisibilityDetector lazy-init al primo connect (channels.size===0), teardown all''ultimo disconnect (channels.size===0)'
  - 'D-112 confirmed: disconnectByOwner cascade chiude tutti i canali del plugin, ritorna count'
  - 'B-4 closure D-107 auto-fallback effettivo: runReconnectLoop orchestra il rebind SSE→WS dopo fallbackThreshold fail'
  - 'B-4 cycle-cap: maxAttempts/globalCycleCap esauriti → publish system.realtime.failed con reason=cycle-cap-exceeded'
  - 'B-NEW-1 closure: signature loop allineata a interface ReconnectStrategy 04-03 — getMode() (NOT currentMode), nextDelayMs() no-arg, recordFailure() no-arg, fallback() toggla mode'
metrics:
  duration: '~25 min'
  completed: '2026-05-04'
  tests_passed: 16
  total_gateway_tests: 191
  total_monorepo_tests: 725
  loc_source: 578
  loc_test: 489
---

# Phase 4 Plan 07: RealtimeChannelManager Summary

> **One-liner:** Registry N-canale con cascade cleanup per-ownerId, lazy-init del VisibilityDetector e `runReconnectLoop` orchestrato (B-4 + B-NEW-1 fix) — 16 test TDD GREEN, signature 04-03 strict.

## Cosa è stato fatto

Implementato `RealtimeChannelManager` (D-102, D-110, D-112): la classe che il `RealtimeBroker` di plan 04-08 comporrà come "layer di orchestrazione" tra il broker pubblico e gli adapter SSE/WS. Il Manager espone:

- **Registry N-canale** indicizzato per `name` (`Map<string, ChannelEntry>`) — ogni canale ha la propria connection fisica (anti-AP-11, no multiplex automatico).
- **`connect(def, ownerId='system')`** — duplicate guard `realtime.channel.duplicate`, lazy-init del `VisibilityDetector` al primo connect, factory dispatch `SseAdapter` (mode='sse'|'auto') o `WebSocketAdapter` (mode='websocket'). Default 'auto' → 'sse' (D-107 SSE-first). Su connect fail iniziale, attiva `runReconnectLoop`.
- **`disconnect(name?)`** — chiude singolo canale o tutti. Setta `entry.manuallyClosed = true` PRIMA del cleanup per bloccare eventuale `runReconnectLoop` attivo. Teardown automatico del `VisibilityDetector` all'ULTIMO canale disconnesso.
- **`disconnectByOwner(ownerId, reason?)`** — cascade D-112 che chiude SOLO i canali del plugin specifico. Pattern identico a `HttpGateway.abortInFlightByOwner`. Ritorna `count` di canali chiusi (0 se nessuno).
- **`checkFreshnessAll()`** — invocato dal `VisibilityDetector` `onChange('visible')` callback. Per ogni canale stale (`adapter.checkFreshness(staleTimeoutMs)===false`), triggera `adapter.disconnect('stale.visibility-check')`.
- **`getDebugInfo()`** — snapshot `{ channelCount, visibilityActive, channels: [{ name, ownerId, mode, debug }] }`.

Il **`runReconnectLoop` privato** (B-4 closure + B-NEW-1 signature fix) orchestra il ciclo `nextDelayMs() → publish system.realtime.reconnecting → clock.sleep → shouldFallback()? fallback() : getMode() → connect → recordSuccess/recordFailure`. Termina su `manuallyClosed` (utente disconnect) o `isPermanentlyFailed()` (publish `system.realtime.failed` con `reason='cycle-cap-exceeded'`). Clock DI permette test sync senza `setTimeout` reali.

## Test eseguiti (16 test deterministici TDD GREEN)

```
✓ Test 1: constructor non attiva visibility detector (lazy init D-110)
✓ Test 2: connect() mode=sse → SseAdapter creato + visibility attiva
✓ Test 3: connect() mode=websocket → WebSocketAdapter creato
✓ Test 4: connect() duplicate name → throw realtime.channel.duplicate (category config)
✓ Test 5: connect() N canali con stesso ownerId → tutti tracked
✓ Test 6: disconnect(name) chiude solo quel canale, visibility ancora attiva
✓ Test 7: disconnect() (no arg) chiude tutti + teardown visibility
✓ Test 8: disconnectByOwner cascade D-112 chiude SOLO canali del plugin
✓ Test 9: disconnectByOwner(unknown) ritorna 0, no side effects
✓ Test 10: visibility on-visible → checkFreshnessAll non crasha (canali fresh restano)
✓ Test 11: visibility detector teardown automatico al last disconnect
✓ Test 12: getDebugInfo() shape — channelCount + visibilityActive + channels[]
✓ Test 13: B-4 D-107 auto-fallback EFFETTIVO — SSE fail → MockWebSocket istanziato
✓ Test 14: B-4 cycle-cap — maxAttempts esauriti → publish system.realtime.failed
✓ Test 15: disconnect manuale durante runReconnectLoop interrompe il loop
✓ Test 16: checkFreshnessAll() invoca disconnect su canali stale
```

**Output `pnpm --filter @gluezero/gateway test src/sse-ws/realtime-channel-manager.test.ts`:**
```
Test Files  1 passed (1)
     Tests  16 passed (16)
  Duration  534ms
```

**Suite gateway completa:** `Test Files 21 passed (21) | Tests 191 passed (191)` — zero regressioni.

**Monorepo full:** core 248/248 + mapper 183/183 + routing 103/103 + gateway 191/191 = **725/725 tests** PASS.

**Typecheck:** `pnpm --filter @gluezero/gateway exec tsc --noEmit` exit 0 (clean su core, mapper, routing, gateway).

**Build:** `pnpm --filter @gluezero/gateway build` ESM + DTS success in 70ms + 603ms.

## TDD RED→GREEN

| Step | Commit | Cosa |
|------|--------|------|
| RED  | `2247c69` | `test(04-07): add failing tests for RealtimeChannelManager (D-102, D-110, D-112)` — 16 test, file source non ancora esiste |
| GREEN | `1ee900f` | `feat(04-07): implement RealtimeChannelManager (N-channel registry + cascade D-112 + visibility orchestration)` — 16/16 PASS |

Cronologia git verificata:
```
1ee900f feat(04-07): implement RealtimeChannelManager (N-channel registry + cascade D-112 + visibility orchestration)
2247c69 test(04-07): add failing tests for RealtimeChannelManager (D-102, D-110, D-112)
```

## Architettura

### Pattern composti
- **Registry per-owner** ← `route-resolver.ts` di F3 (Map indicizzata + `unregisterByOwner`)
- **Cascade cleanup D-86 ext F4** ← `http-gateway.ts:283-298` (`abortInFlightByOwner`)
- **Lazy-init singleton** ← `combine-signals.ts:62-86` (listener tracking + cleanup)
- **State machine orchestrator** ← `circuit-breaker.ts` di F3 (factory + closure state)

### Vincoli rispettati
- **D-83 strict:** zero modifiche a `packages/{core,mapper,routing}/src/` e `packages/gateway/src/http/`. Solo file nuovi sotto `gateway/src/sse-ws/`.
- **AP-11 anti-pattern (PATTERNS.md §5):** Map indicizzata per `name`, NON per `url`. Zero multiplex automatico — verificato `grep -n "Map<.*url"` ritorna 0 match.
- **AP-3 anti-pattern:** zero import di `reconnecting-websocket` — verificato.
- **Interface 04-03 ReconnectStrategy strict (B-NEW-1 fix iter 2):** zero chiamate a `currentMode()`, `currentAttempt()`, `nextDelayMs(arg)`, `recordFailure(arg)` — solo i metodi del contract `getMode()`, `nextDelayMs()`, `recordFailure()`, `recordSuccess()`, `shouldFallback()`, `fallback()`, `isPermanentlyFailed()`.

### Decisioni implementate

| Decisione | Implementazione |
|-----------|-----------------|
| D-102 multi-channel topology | `Map<string, ChannelEntry>` indicizzata per `name`, una connection per canale |
| D-104 auth-agnostic `buildUrl` | Pass-through agli adapter (def.buildUrl/url) — il manager non gestisce auth |
| D-107 auto-fallback SSE→WS | `runReconnectLoop` su `shouldFallback()` rebinda l'adapter, B-4 closure verified Test 13 |
| D-110 Visibility integration | Lazy init al PRIMO connect (`channels.size===0 && visibility===null`), teardown all'ULTIMO disconnect (`channels.size===0` post-cleanup) |
| D-112 cascade cleanup | `disconnectByOwner(ownerId)` itera `channels.entries()` e filtra per ownerId |
| D-115 backpressure adapter-level | `buildSseDeps()`/`buildWsDeps()` propagano `deps.backpressure` agli adapter |
| RT-05 reconnect loop orchestrato | `runReconnectLoop` con `clock.sleep` DI, full jitter via `strategy.nextDelayMs()` |
| ERR-02 ext F4 system events | `system.realtime.reconnecting`/`connected`/`failed` via `publishSystem` helper |

### Threat coverage (dal `<threat_model>` del plan)

| Threat ID | Mitigazione |
|-----------|-------------|
| T-04-07-01 (Tampering — duplicate name) | Duplicate guard throw `realtime.channel.duplicate` (Test 4 verified) |
| T-04-07-02 (Memory leak — visibility detector) | Teardown automatico in disconnect/disconnectByOwner quando `channels.size===0` (Test 7+8+11 verified) |
| T-04-07-03 (Memory leak — adapter throw) | `try { adapter.disconnect } catch {}` swallow per robustezza (V1 acceptable, deferred V1.x) |
| T-04-07-04 (Race condition — unregister durante reconnect) | `entry.manuallyClosed=true` blocca il while-loop (Test 15 verified) |
| T-04-07-05 (Multiplexing leak) | accept (D-102 + AP-11 — V1.x può aggiungere `multiplex: true`) |
| T-04-07-06 (Visibility detector spoofing) | accept (DI esplicito — niente exposure runtime) |
| T-04-07-07 (Logic flaw — loop infinito) | `strategy.isPermanentlyFailed()` interrompe + publish failed (Test 14 verified) |

## Hand-off note per plan 04-08 (RealtimeBroker composition wrapper)

Il `RealtimeBroker` di plan 04-08 dovrà:

1. **Comporre il Manager via `new RealtimeChannelManager`** con `publishFn` legato al `RouterBroker.publish` interno (analogo al pattern composition wrapper di F3).

2. **Esporre `connectRealtime(def, ownerId?)`** che delega a `manager.connect(def, ownerId)`.

3. **Wrappare `unregisterPlugin(pluginId)`** per propagare la cascade D-112: prima `manager.disconnectByOwner(pluginId, 'plugin.unregistered')` (chiude i canali del plugin), poi delegare al `RouterBroker.unregisterPlugin` per le altre risorse (subscriptions, route, fetch in-flight).

4. **Test `Tier-1` (jsdom)** — usare `MockEventSource.byChannelName.get('orderName')` e `MockWebSocket.byChannelName.get('orderName')` per il routing strict per-canale (B-NEW-2 fix di plan 04-05/04-06). Il `def.buildUrl` di test deve produrre URL con `?_channel=<name>` per indexing deterministico.

5. **Test integrazione end-to-end** — registrare 2 plugin con N canali ciascuno, verificare cascade D-112 su `unregisterPlugin('plugin-A')` chiude solo i canali di A.

6. **Pipeline §28 step 1 ingress** — il publishFn iniettato nel Manager deve invocare il primo step della pipeline F3 (mapping/validation downstream). Verificare con un test che un MessageEvent SSE → adapter → publishFn → router engine → subscriber riceve l'evento canonical.

### Constraints da rispettare

- **D-83 strict:** ZERO modifiche a `packages/{core,mapper,routing}/src/` e `packages/gateway/src/http/`. Solo nuovi file sotto `gateway/src/sse-ws/`.
- **Pattern composition wrapper:** zero `Object.assign`, zero monkey-patch del `RouterBroker`. Composizione esplicita.
- **`RealtimeChannelManager` è già production-ready** — il broker non deve duplicare logica ma solo wrappare i metodi pubblici.

## Self-Check: PASSED

**File creati:**
- `packages/gateway/src/sse-ws/realtime-channel-manager.ts` ✓ FOUND
- `packages/gateway/src/sse-ws/realtime-channel-manager.test.ts` ✓ FOUND

**Commits:**
- `2247c69` (RED test) ✓ FOUND
- `1ee900f` (GREEN feat) ✓ FOUND

**Acceptance criteria del plan:**
- [x] File `realtime-channel-manager.ts` esiste con `export class RealtimeChannelManager`
- [x] `Map<string, ChannelEntry>` (NOT by url — anti-AP-11)
- [x] `connect(def, ownerId='system')` con duplicate guard `realtime.channel.duplicate`
- [x] `disconnect(name?)` con cascade teardown visibility (Test 7+11)
- [x] `disconnectByOwner(ownerId)` cascade D-112 returning count (Test 8+9)
- [x] `checkFreshnessAll()` invocato da visibility callback (Test 10+16)
- [x] Lazy init `createVisibilityDetector` solo al primo connect (Test 1+2)
- [x] Factory dispatch `mode === 'websocket' ? new WebSocketAdapter : new SseAdapter` (Test 2+3)
- [x] `getDebugInfo()` con `{ channelCount, visibilityActive, channels: [...] }` (Test 12)
- [x] `realtime.channel.duplicate` BrokerError code (Test 4)
- [x] Metodo privato `runReconnectLoop(name, def, ownerId)` con loop while + clock.sleep
- [x] Chiamate `strategy.nextDelayMs()` (no-arg), `strategy.getMode()`, `strategy.recordFailure()` (no-arg) — interface 04-03 strict
- [x] `private readonly clock: RealtimeManagerClock` con default `setTimeout` + DI override
- [x] `entry.strategy = createReconnectStrategy(...)` per-canale al connect (B-4)
- [x] `entry.manuallyClosed` flag bloccaz `runReconnectLoop` (Test 15)
- [x] `publishSystem('system.realtime.failed', { reason: 'cycle-cap-exceeded' ... })` su `isPermanentlyFailed()` (Test 14)
- [x] Rebinding adapter su `shouldFallback()` — `entry.adapter = new WebSocketAdapter` (Test 13)
- [x] File test contiene 16 test (≥10 richiesti)
- [x] `pnpm --filter @gluezero/gateway test` exit 0 (191/191)
- [x] `pnpm --filter @gluezero/gateway exec tsc --noEmit` exit 0
- [x] Cronologia git mostra ≥2 commit 04-07 (RED + GREEN)

**Deviazioni:** Nessuna. Plan eseguito esattamente come scritto, con auto-fix Rule 2 minor: aggiunto `try { adapter.disconnect } catch {}` swallow nelle disconnect/disconnectByOwner per coverage T-04-07-03 (memory leak adapter throw — il plan menziona "deferred V1.x", ma il try/catch è un mitigation parziale a costo zero).

**Plan COMPLETO. RealtimeChannelManager production-ready per consumo da plan 04-08 RealtimeBroker.**
