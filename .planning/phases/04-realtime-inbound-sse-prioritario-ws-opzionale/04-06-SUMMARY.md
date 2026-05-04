---
phase: 04-realtime-inbound-sse-prioritario-ws-opzionale
plan: 06
subsystem: gateway/sse-ws
tags: [websocket, envelope-json, ping-pong, stale-detection, scheme-switch, bufferedamount, subprotocols, tdd, D-101, D-104, D-106, D-107, D-109, D-111, D-113, D-115, RT-02, RT-04, RT-05, RT-06, ERR-02, AP-3, AP-4, AP-6, B-NEW-2]
dependency_graph:
  requires:
    - "@sembridge/gateway/sse-ws bootstrap (Plan 04-01) — RealtimeChannelDef + tipi (Q4 wsSubprotocols field)"
    - "frame-parser (Plan 04-02) — parseFrame + isInternalTopic + INTERNAL_TOPICS"
    - "createReconnectStrategy factory (Plan 04-03) — initialMode 'websocket' + per-channel override"
    - "createBrokerError + nanoid (F1 core)"
    - "BackpressureStrategy interface (F3 — riuso 1:1 D-115)"
  provides:
    - "WebSocketAdapter class + WebSocketAdapterDeps interface — wrapper WebSocket production-ready"
    - "MockWebSocket test util + byChannelName indexing (B-NEW-2 fix iter 2 owned da 04-06)"
    - "RealtimePublishFn type (loose-coupling publish callback)"
  affects:
    - "Plan 04-07 (RealtimeChannelManager) — istanzia WebSocketAdapter via new WebSocketAdapter(def, deps); applica scheme switch automatico per consumer URL HTTP-style"
    - "Plan 04-08 (Realtime integration tests) — usa MockWebSocket.byChannelName per harness routing per-canale (B-NEW-2)"
tech-stack:
  added: []
  patterns:
    - "factory-with-class composition (parallelo a SseAdapter plan 04-05; reuse pattern http-gateway.ts F3)"
    - "DI WebSocketCtor per test jsdom (RESEARCH §9.1)"
    - "AbortController re-init al re-connect (cycle-friendly per manager loop, fix coerente con 04-05 Rule 1)"
    - "Heartbeat ping/pong applicativo (D-111) — anti-AP-4 readyState non è liveness"
    - "Stale detection via lastPongAt watchdog (RESEARCH §4.6)"
    - "bufferedAmount cap pre-send (RESEARCH §4.4) — prevent amplification quando TCP buffer saturo"
    - "Scheme switch http(s)→ws(s) automatico (D-107) — UX uniforme con HTTP API"
    - "Close codes routing RFC 6455 §7.4 — distinzione 1000 normal vs 1006 abnormal vs fatali (1002/3/7/9/10/15)"
    - "Internal topics filter strict via isInternalTopic (PITFALL §11.7 anti-AP-6) — `__ping__`/`__pong__` consumed, weather.__ping__ passa through"
    - "TDD RED→GREEN co-located test sibling (D-117)"
    - "Idempotent disconnect via flag disconnectedPublished (no doppio publish, allineato con sse-adapter)"
    - "MockWebSocket byChannelName indexing via ?_channel=<name> query param (B-NEW-2 owned da 04-06)"
key-files:
  created:
    - packages/gateway/src/sse-ws/websocket-adapter.ts
    - packages/gateway/src/sse-ws/websocket-adapter.test.ts
    - packages/gateway/src/sse-ws/test-utils/mock-websocket.ts
  modified: []
decisions:
  - "D-101 lockata: composition wrapper (adapter consumed dal RealtimeBroker via manager 04-07)"
  - "D-104 lockata: buildUrl() async hook chiamato PRIMA di OGNI connect/reconnect (auth-agnostic)"
  - "D-106 lockata: envelope JSON `{topic,data,id?}` strict via parseFrame (plan 04-02). Frame non-conformi → network.error category protocol (riuso ERR-02 ext F3)"
  - "D-107 lockata: scheme switch automatico http→ws / https→wss tramite URL API + fallback regex per URL relativi"
  - "D-109 lockata: createReconnectStrategy istanziata in constructor con initialMode='websocket'"
  - "D-111 lockata: ping/pong applicativo via envelope `__ping__`/`__pong__`, intervalMs default 30s, staleTimeoutMs default 60s (uniforme con SSE freshness Q5). Stale watchdog: Date.now()-lastPongAt > staleTimeoutMs → close + recordFailure"
  - "D-113 lockata: source: { type: 'server', id: 'realtime-channel', name: 'websocket' } (Object.frozen)"
  - "D-115 lockata: backpressure DI adapter-level pre-publish con priority 'normal' (riuso F3 BackpressureStrategy)"
  - "Q4 closure: wsSubprotocols passthrough opt-in al WebSocket constructor"
  - "RFC 6455 §7.4 close codes routing: shouldReconnectOnCloseCode helper — 1000 normal/1002/1003/1007/1009/1010/1015 fatali → no recordFailure; tutti gli altri → recordFailure (manager triggera reconnect)"
  - "B-NEW-2 lockata iter 2: MockWebSocket.byChannelName Map indicizzata via `?_channel=<name>` query param (owned da 04-06, parallelo a MockEventSource owned da 04-05)"
  - "PITFALL §11.7 anti-AP-6 closure: isInternalTopic strict (frame-parser di 04-02) usato qui senza alcun fallback startsWith — Test 15 verifica weather.__ping__ passa through"
metrics:
  duration_minutes: ~15
  completed_date: 2026-05-04
  tasks_total: 2
  tasks_completed: 2
  files_created: 3
  files_modified: 0
  loc_source: 583   # websocket-adapter.ts
  loc_test: 341     # websocket-adapter.test.ts
  loc_test_utils: 192  # mock-websocket.ts
  loc_total: 1116
  tests_added: 15
  tests_passing: 15
  monorepo_tests_passing: 709
  commits:
    - "4d4d654 test(04-06): add MockWebSocket test util with byChannelName indexing (B-NEW-2 fix iter 2)"
    - "4349b8a test(04-06): add failing tests for WebSocketAdapter (D-101/D-106/D-107/D-111, RT-02/04/05/06)"
    - "740ba5b feat(04-06): implement WebSocketAdapter (envelope JSON + ping/pong + stale + scheme switch + bufferedAmount cap)"
requirements_completed:
  - RT-02  # Adapter WebSocket — wrapper WebSocket nativo + envelope JSON + ping/pong + scheme switch
  - RT-04  # source: { type:'server', id:'realtime-channel', name:'websocket' } applicato (Test 4)
  - RT-06  # Frame envelope JSON parsing + frame parse fail → network.error category protocol
requirements_partial:
  - RT-05  # Reconnect config override-abile (createReconnectStrategy istanziata; loop di reconnect è del manager 04-07). Heartbeat ping/pong + stale detection lockati (D-111).
  - ERR-02 # network.error category protocol per frame parse fail (Test 6); system.realtime.connected/disconnected con close codes (Test 4/11/12)
---

# Phase 4 Plan 06: WebSocket adapter (envelope JSON D-106 + ping/pong app-level D-111 + scheme switch D-107) Summary

**One-liner:** `WebSocketAdapter` class production-ready che incapsula `WebSocket` nativo con scheme switch automatico http(s)→ws(s) (D-107), envelope JSON parsing strict via `parseFrame` di 04-02 (D-106), heartbeat ping/pong applicativo `{topic:'__ping__',data:{ts}}` ogni 30s con stale watchdog 60s (D-111 + anti-AP-4 RESEARCH §4.6), bufferedAmount cap 64KB pre-send (RESEARCH §4.4), close codes routing RFC 6455 §7.4 (1000 normal vs 1006 abnormal vs fatali no-recovery), wsSubprotocols passthrough opt-in (Q4), AbortController cascade (D-112), backpressure DI adapter-level (D-115 riuso F3 1:1) e DI `WebSocketCtor` per test jsdom (RESEARCH §9.1). Internal topics `__ping__`/`__pong__` filtrati strict via `isInternalTopic` (PITFALL §11.7 anti-AP-6). 15/15 test deterministici TDD RED→GREEN. Cronologia git mostra 3 commit atomic.

## Cosa è stato fatto

Plan 04-06 implementa **3 file nuovi co-located** secondo il pattern TDD obbligatorio (D-117 ext D-88/D-92 da F3) + `MockWebSocket` test util owned dal plan (B-NEW-2 fix iter 2 — parallelo a `MockEventSource` owned da plan 04-05). Tre commit atomici visibili in cronologia git.

### File creati

| File | LOC | Contenuto |
|------|-----|-----------|
| `packages/gateway/src/sse-ws/websocket-adapter.ts` | **583** | Class `WebSocketAdapter` + `WebSocketAdapterDeps` interface + `RealtimePublishFn` type + helper privati (`handleOpen`, `handleClose`, `dispatchInbound`, `startHeartbeat`, `stopHeartbeat`, `switchScheme`, `makeSystemEvent`) + `shouldReconnectOnCloseCode` pure function (RFC 6455 §7.4) + costanti `BUFFERED_AMOUNT_PING_CAP`/`DEFAULT_HEARTBEAT_INTERVAL_MS`/`DEFAULT_STALE_TIMEOUT_MS`/`WS_SOURCE` (Object.frozen) |
| `packages/gateway/src/sse-ws/websocket-adapter.test.ts` | **341** | 15 test deterministici TDD organizzati in 1 describe block, copertura: scheme switch (T1), wsSubprotocols (T2), missing url (T3), open+heartbeat (T4), envelope dispatch (T5), parse fail (T6), `__ping__` filter (T7), `__pong__` updates lastPongAt (T8), heartbeat send (T9), stale detection (T10), close codes 1006 abnormal (T11) vs 1000 normal (T12), bufferedAmount cap (T13), abort cascade (T14), `weather.__ping__` passes through (T15) |
| `packages/gateway/src/sse-ws/test-utils/mock-websocket.ts` | **192** | `MockWebSocket` class compatibile `WebSocket` interface + `static byChannelName: Map<string, MockWebSocket>` indicizzata da `?_channel=<name>` query param (B-NEW-2 fix owned da 04-06 — abilita harness routing strict per-canale di plan 04-08) + helper `__open/__message/__error/__close/__setBufferedAmount/__reset` |

**Totale:** 1116 LOC, 0 file modificati (additive-only — D-83 strict ✓).

### Public API (lockata)

```typescript
export type RealtimePublishFn = (event: BrokerEvent) => void

export interface WebSocketAdapterDeps {
  readonly publishFn: RealtimePublishFn
  readonly backpressure?: BackpressureStrategy            // D-115 riuso F3
  readonly WebSocketCtor?: typeof WebSocket               // DI test
}

export class WebSocketAdapter {
  readonly name: string

  constructor(def: RealtimeChannelDef, deps: WebSocketAdapterDeps)
  connect(externalSignal?: AbortSignal): Promise<void>    // throw realtime.config.invalid se né buildUrl né url
  disconnect(reason?: string): void                        // idempotent
  checkFreshness(staleTimeoutMs: number): boolean          // visibility orchestration D-110
  getDebugInfo(): { name, mode: 'websocket', readyState, lastPongAt, lastEventReceivedAt }
}
```

## Output verification

### Test suite (15/15 PASS)

```
> @sembridge/gateway test src/sse-ws/websocket-adapter.test.ts --run
 RUN  v4.1.5
 Test Files  1 passed (1)
      Tests  15 passed (15)
   Duration  409ms
```

Suddivisione test:

| # | Scenario | Verifica |
|---|----------|----------|
| 1 | Scheme switch (D-107) | `buildUrl='https://api.example.com/ws'` → MockWebSocket creato con `wss://api.example.com/ws` |
| 2 | wsSubprotocols passthrough (Q4) | `def.wsSubprotocols=['sembridge-v1']` → `MockWebSocket.protocol === 'sembridge-v1'` |
| 3 | Missing url+buildUrl | throw BrokerError code='realtime.config.invalid' category='config' |
| 4 | `__open()` + heartbeat avviato | publishFn `system.realtime.connected` con `source.name='websocket'`; dopo intervalMs 1000 → `__ping__` frame inviato |
| 5 | Envelope JSON valido (D-106) | `{topic:'orders.created',data:{id:1},id:'evt-7'}` → BrokerEvent con id='evt-7', topic='orders.created', payload={id:1} |
| 6 | Envelope malformato | `'not-json{{'` → publishFn `network.error` payload `{category:'protocol',code:'realtime.frame.parse-failed',channel:'feed',reason:'malformed-json'}` |
| 7 | `__ping__` filter strict (anti-AP-6) | server invia `{topic:'__ping__'}` → publishFn NON invocato per `__ping__` |
| 8 | `__pong__` updates lastPongAt + filter | server invia `{topic:'__pong__'}` → publishFn NON invocato; advanceTimers(50_000) → NO stale disconnect (pong reset watchdog) |
| 9 | Heartbeat send (D-111) | advanceTimers(1_100) + (1_000) → 2+ frame `__ping__` in `sentFrames` |
| 10 | Stale detection (D-111) | staleTimeoutMs=5_000, advanceTimers(6_500) senza pong → publishFn `system.realtime.disconnected` reason='stale.no-pong' + readyState===CLOSED |
| 11 | Close 1006 abnormal (RFC 6455) | `__close(1006,'abnormal-closure',false)` → publishFn `system.realtime.disconnected` payload `{code:1006,channel:'feed'}` |
| 12 | Close 1000 normal | `__close(1000,'normal',true)` → publishFn `system.realtime.disconnected` payload `{code:1000}`; readyState===CLOSED |
| 13 | bufferedAmount > 64KB | `__setBufferedAmount(100_000)` + advanceTimers(1_100) → `sentFrames.length` invariato (ping skipped, RESEARCH §4.4) |
| 14 | AbortController cascade (D-112) | external signal abort → readyState===CLOSED |
| 15 | **PITFALL §11.7 anti-AP-6** | `{topic:'weather.__ping__',data:{city:'Roma'}}` → publishFn invocato con topic='weather.__ping__' (passa through, NO filter) |

### Gateway suite (175/175 PASS — zero regressioni)

```
 Test Files  20 passed (20)
      Tests  175 passed (175)   ← era 160 prima di 04-06 (+15)
```

### Monorepo full suite (709/709 PASS — zero regressioni)

```
core:    248 passed (24 files)
mapper:  183 passed (16 files)
gateway: 175 passed (20 files)   ← +15 vs 160 baseline post-04-05
routing: 103 passed (16 files)
TOTAL:   709/709                  ← +15 vs 694 baseline post-04-05
```

### Typecheck monorepo (clean)

```
$ pnpm --filter @sembridge/gateway exec tsc --noEmit
(exit 0, no output)
```

### Build gateway (ESM + DTS clean)

```
ESM dist/index.js              29.16 KB
ESM dist/sse-ws/index.js       228.00 B   (barrel ancora skeleton — runtime esposto in plan 04-08)
ESM dist/sse-ws/augment.js     232.00 B
ESM ⚡️ Build success in 73ms
DTS dist/index.d.ts                   1.26 KB
DTS dist/sse-ws/index.d.ts            10.83 KB
DTS ⚡️ Build success in 591ms
```

**Nota:** il `websocket-adapter` NON è (ancora) ri-esportato dal barrel `sse-ws/index.ts` — questo è atteso. Verrà esposto in plan 04-08 con il public-factory `createRealtimeBroker`. I consumer interni (test 04-06 + plan 04-07 manager) usano import diretti `from './websocket-adapter'`.

### Anti-pattern verificati

```bash
# AP-3 (no `reconnecting-websocket` library — vincolo PRD §31.3 + STACK.md):
$ grep -v '^//' packages/gateway/src/sse-ws/websocket-adapter.ts | grep -c "reconnecting-websocket"
0

# AP-6 (no `startsWith('__')` prefix match — usa solo isInternalTopic strict):
$ grep -v '^//' packages/gateway/src/sse-ws/websocket-adapter.ts | grep -c "startsWith('__')"
0

# AP-2 (no Authorization header injection — vincolo PRD §31.3 + D-104):
$ grep -v '^//' packages/gateway/src/sse-ws/websocket-adapter.ts | grep -c "Authorization"
0

# AP-4 implicito (no native reconnect, ping/pong applicativo):
# stale watchdog Date.now()-lastPongAt > staleTimeoutMs → ws.close() esplicito ✓
```

## TDD RED→GREEN gate compliance

Cronologia git mostra commit separati (D-117 strict):

| Gate | Hash | Type | Subject |
|------|------|------|---------|
| Helper | `4d4d654` | test | `add MockWebSocket test util with byChannelName indexing (B-NEW-2 fix iter 2)` |
| RED | `4349b8a` | test | `add failing tests for WebSocketAdapter (D-101/D-106/D-107/D-111, RT-02/04/05/06)` |
| GREEN | `740ba5b` | feat | `implement WebSocketAdapter (envelope JSON + ping/pong + stale + scheme switch + bufferedAmount cap)` |

**RED gate verificato** prima del commit GREEN: `vitest` fail con `Failed to resolve import "./websocket-adapter" from "src/sse-ws/websocket-adapter.test.ts"`. Il commit RED introduce SOLO i test; il commit GREEN introduce SOLO l'implementazione.

## Threat coverage applicata

| Threat ID | Categoria | Disposition | Implementazione |
|-----------|-----------|-------------|-----------------|
| T-04-06-01 | DoS frame oversize 10MB | accept (V1) | parseFrame non impone byte cap (deferred V1.x). Mitigation deferred al backpressure D-115 e al server side. Documentato per DOC-04 plan 04-09. |
| T-04-06-02 | Spoofing finto pong | accept | Il server può sempre rispondere con `__pong__`; il client si fida (RESEARCH §4.6 — alternativa è zero, browser non espone ping/pong nativi). Documentato. |
| T-04-06-03 | Spoofing system.realtime.* | accept (V1) | Il topic `system.realtime.*` può tecnicamente essere pubblicato dal server. V1 NON aggiunge filter. DOC-04 plan 04-09 documenta che consumer "non dovrebbero subscribe a system.realtime.* da source server". |
| T-04-06-04 | URL injection via buildUrl | accept | Consumer responsabilità (D-104 contract). Documentato in DOC-04. |
| T-04-06-05 | bufferedAmount amplification | mitigate ✓ | Check `bufferedAmount > 64_000` prima di send ping (RESEARCH §4.4). Test 13 verifica skip — `sentFrames.length` invariato dopo `__setBufferedAmount(100_000) + advanceTimers(1_100)`. |
| T-04-06-06 | Memory leak heartbeat timer | mitigate ✓ | `stopHeartbeat()` chiamato in `disconnect()` E in `handleClose()`. `__reset()` test util pulisce instances + byChannelName. |
| T-04-06-07 | Topic pollution `__ping__` | mitigate ✓ | `isInternalTopic` strict match — `__ping__`/`__pong__` consumed dal client (no publish). Test 7 verifica `__ping__` filtrato; Test 15 verifica `weather.__ping__` passa through. |
| T-04-06-08 | TCP zombie OPEN-but-dead | mitigate ✓ | RESEARCH §4.6 — ping/pong app-level + staleTimeoutMs watchdog. Test 10 verifica `advanceTimers(6_500)` senza pong → close + `system.realtime.disconnected reason='stale.no-pong'`. |
| T-04-06-09 | onerror+onclose race | mitigate ✓ | RESEARCH §4.5 — `'error'` listener swallow (info opaque), `'close'` listener unica fonte di truth. Test 11/12 verificano close codes via `__close()` direttamente. |

## Vincoli rispettati

- **D-83 strict (ZERO modifiche fuori `packages/gateway/src/sse-ws/`):**

```bash
$ git diff bf848a1..HEAD --name-only | grep -vE "^packages/gateway/src/sse-ws/|^\.planning/"
(empty - 0 violations)
```

Tutte le modifiche sono nuovi file `additive-only` in `packages/gateway/src/sse-ws/`. Nessuna API esistente toccata.

- **D-117 TDD RED→GREEN:** 3 commit separati visibili in `git log` (helper test util + RED + GREEN).
- **AP-2 (no `Authorization`):** verificato via grep — 0 occorrenze nel runtime code.
- **AP-3 (no `reconnecting-websocket`):** verificato via grep import strict — 0 occorrenze.
- **AP-6 (no `startsWith('__')`):** verificato via grep — 0 occorrenze (usa solo `isInternalTopic` strict di frame-parser plan 04-02).
- **Lingua CLAUDE.md:** italiano per JSDoc descrittivi e commenti dottrinali; inglese per identifier, codice, error keywords, log keywords (es. `'system.realtime.connected'`, `'realtime.config.invalid'`, `'stale.no-pong'`, `'realtime.frame.parse-failed'`).

## Deviations from Plan

**Nessuna deviazione applicata durante l'esecuzione.** Il plan è stato eseguito esattamente come specificato:
- Interface signatures: `WebSocketAdapter` class + `WebSocketAdapterDeps` interface ✓
- File count: 3 nuovi (websocket-adapter.ts + websocket-adapter.test.ts + test-utils/mock-websocket.ts) ✓
- Test count: ≥15 → effettivi 15 ✓
- Pattern PATTERNS.md §2.9 applicato 1:1 ✓
- Default values: heartbeatIntervalMs=30_000, staleTimeoutMs=60_000, BUFFERED_AMOUNT_PING_CAP=64_000 ✓
- Anti-pattern AP-3 + AP-6: grep counts === 0 ✓
- TDD RED→GREEN strict (3 commit separati) ✓

**Pattern coerente con plan 04-05 (SseAdapter):** stessa shape API (`connect/disconnect/checkFreshness/getDebugInfo`), stesso pattern AbortController re-init al re-connect, stesso pattern flag `disconnectedPublished` per idempotenza, stesso pattern `WS_SOURCE` Object.frozen costante. Nessun retrofit a sse-adapter — additive-only.

## Issues Encountered

- **DTS build TS5055 race condition con `clean: true` di tsup:** durante l'iniziale build post-implementation, `pnpm --filter @sembridge/gateway build` ha lanciato `error TS5055: Cannot write file 'dist/http/index.d.ts' because it would overwrite input file`. Il problema è una race condition di tsup: `clean: true` rimuove `dist/` PRIMA dell'ESM build, ma TS DTS pass scopre i `.d.ts` esistenti come input prima della rimozione. Risolto con `rm -rf packages/gateway/dist && pnpm --filter @sembridge/gateway build` — esit 0 + DTS clean. Non è un issue del codice (verificato: stash + build → success; pop + rm dist + build → success). Il fix è transient — verrà risolto da CI cache fresh.
- **Inizialmente 1 occorrenza `startsWith('__')` in JSDoc commento dottrinale:** Il commento JSDoc descriveva l'anti-pattern `topic === '__ping__' non startsWith('__')`. Il grep di acceptance criteria conta anche le occorrenze nei comment block `/** ... */`. Per soddisfare strict acceptance, ho riformulato il JSDoc rimuovendo l'esempio `startsWith` (mantenuta la spiegazione strutturale). Counts post-fix: 0/0/0 per AP-2/AP-3/AP-6.

## Hand-off note per Wave 4 (plan 04-07 RealtimeChannelManager)

Il manager può importare `WebSocketAdapter` direttamente:

```typescript
import { WebSocketAdapter } from './websocket-adapter'
import { SseAdapter } from './sse-adapter'

// Single adapter per channel (mode='websocket' o 'auto' fallback to WS)
const adapter = new WebSocketAdapter(def, {
  publishFn: (event) => broker.publish(event),
  backpressure: this.backpressureStrategy,  // shared F3 instance, opt-in
  // WebSocketCtor: omitted in production → globalThis.WebSocket
})

// Reconnect loop (manager-owned):
while (!isPermanentlyFailed) {
  try {
    await adapter.connect(externalAbortSignal)
    // ... attendi 'open' o 'close' (eventi pubblicati via publishFn)
    // Manager osserva system.realtime.connected/disconnected per sapere quando ricollegarsi
  } catch (err) {
    // realtime.config.invalid o realtime.websocket.unavailable
  }
  await sleep(reconnectStrategy.nextDelayMs())  // delay tra retry
  // Sopra connect() re-inizia: il controller è auto-re-init se era aborted
}
```

**API utility per il manager:**
- `adapter.checkFreshness(60_000)` → invocato da Visibility API on-visible (D-110); se `false` → `disconnect()` + `connect()` immediato.
- `adapter.getDebugInfo()` → snapshot per Inspector plan 04-09 (incluso `lastPongAt` per metrics ping/pong).
- `adapter.disconnect('cascade.unregisterPlugin')` → invocato dal manager per cascade D-112 cleanup.

**Casi limite gestiti dall'adapter:**
- `def.buildUrl` async ritarda la creazione di `WebSocket` → il manager deve `await connect()` prima di considerare il canale "connecting".
- `def.url` con scheme `https://` viene auto-convertito a `wss://` (Test 1).
- `wsSubprotocols` opt-in: se non fornito, `new WebSocket(url)` senza protocols (browser default).
- Stale detection auto-triggera close + recordFailure: il manager osserva `system.realtime.disconnected reason='stale.no-pong'` come segnale di reconnect needed.
- Frame parse fail: pubblicato `network.error` ma il canale rimane connesso (continua a ricevere altri eventi). Il manager non deve reagire al singolo frame fail (solo al close event).

**Auto-fallback SSE↔WS (D-107):** Il manager osserva `reconnect.shouldFallback() === true` (dopo 3 fail consecutivi nel mode corrente, default) e chiama `reconnect.fallback()` → switch mode + reset counter. Il manager poi istanzia il NUOVO adapter (SseAdapter o WebSocketAdapter) con la stessa `def` ma scheme/path coerenti (D-107 specifica che il consumer fornisce un solo `buildUrl()` che ritorna URL HTTP; l'adapter WS applica lo scheme switch automatico — il manager non deve gestire la conversione).

**B-NEW-2 closure (test-only):** plan 04-08 può usare `MockWebSocket.byChannelName.get(channelName)` per routing strict per-canale dell'harness, parallelo a `MockEventSource.byChannelName` di plan 04-05. Test pattern:

```typescript
new MockWebSocket('wss://x/ws?_channel=orders')  // auto-registra in byChannelName
const orders = MockWebSocket.byChannelName.get('orders')  // deterministico
```

## Self-Check

**Created files:**
- `packages/gateway/src/sse-ws/websocket-adapter.ts` — FOUND ✓ (583 LOC, contiene `export class WebSocketAdapter` + `WebSocketAdapterDeps` + `RealtimePublishFn` + `shouldReconnectOnCloseCode` + `WS_SOURCE` Object.frozen)
- `packages/gateway/src/sse-ws/websocket-adapter.test.ts` — FOUND ✓ (341 LOC, 15 `it(` blocks)
- `packages/gateway/src/sse-ws/test-utils/mock-websocket.ts` — FOUND ✓ (192 LOC, `export class MockWebSocket` + `byChannelName` Map)

**Commits:**
- `4d4d654` (helper test util) — FOUND ✓
- `4349b8a` (RED test) — FOUND ✓
- `740ba5b` (GREEN feat) — FOUND ✓

**Acceptance criteria del plan:**
- [x] File `websocket-adapter.ts` esiste e contiene `export class WebSocketAdapter`
- [x] File contiene `interface WebSocketAdapterDeps` con `publishFn`, `backpressure?`, `WebSocketCtor?`
- [x] File contiene `import { parseFrame, isInternalTopic, INTERNAL_TOPICS } from './frame-parser'`
- [x] File contiene `createReconnectStrategy({ ..., initialMode: 'websocket' })`
- [x] File contiene scheme switch `https:` → `wss:` e `http:` → `ws:` (function `switchScheme`)
- [x] File contiene `setInterval` per heartbeat con `INTERNAL_TOPICS.PING`
- [x] File contiene check `bufferedAmount > BUFFERED_AMOUNT_PING_CAP` (64_000)
- [x] File contiene staleTimeoutMs check con `Date.now() - this.lastPongAt`
- [x] File contiene `source: { type: 'server', id: 'realtime-channel', name: 'websocket' }` (costante `WS_SOURCE` Object.frozen)
- [x] File contiene `wsSubprotocols` passthrough a `new Ctor(wsUrl, subprotocols)`
- [x] File contiene `shouldReconnectOnCloseCode` function con codes 1000/1002/1003/1007/1009/1010/1015 → false
- [x] File NON contiene `reconnecting-websocket` (anti-AP-3): grep === 0
- [x] File NON contiene `startsWith('__')` (anti-AP-6): grep === 0 (riformulazione JSDoc post-fix)
- [x] File `websocket-adapter.test.ts` contiene almeno 15 test (effettivi: 15)
- [x] `pnpm --filter @sembridge/gateway test packages/gateway/src/sse-ws/websocket-adapter.test.ts` exit 0 (15/15 PASS)
- [x] `pnpm --filter @sembridge/gateway exec tsc --noEmit` exit 0 (clean)
- [x] Cronologia git mostra ≥2 commit 04-06 (RED + GREEN); effettivi: 3 (helper + RED + GREEN)
- [x] MockWebSocket.byChannelName implementato + `?_channel=<name>` parsing nel constructor (B-NEW-2 fix iter 2)
- [x] Ping/pong applicativo tested (Test 4/9) + staleTimeoutMs watchdog tested (Test 10) + pong updates lastPongAt tested (Test 8)
- [x] Frame envelope JSON parser usato (D-106) — Test 5 (valid) + Test 6 (parse fail)

## Self-Check: PASSED
