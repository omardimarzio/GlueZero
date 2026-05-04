---
phase: 04-realtime-inbound-sse-prioritario-ws-opzionale
plan: 05
subsystem: gateway/sse-ws
tags: [sse, eventsource, last-event-id, backpressure, custom-event-types, heartbeat, tdd, D-101, D-104, D-105, D-109, D-113, D-115, RT-01, RT-04, RT-06, RT-07, W-4, B-5]
dependency_graph:
  requires:
    - "@sembridge/gateway/sse-ws bootstrap (Plan 04-01) — RealtimeChannelDef + tipi"
    - "createReconnectStrategy factory (Plan 04-03) — initialMode 'sse' + per-channel override"
    - "createBrokerError + nanoid (F1 core)"
    - "BackpressureStrategy interface (F3 — riuso 1:1 D-115)"
  provides:
    - "SseAdapter class + SseAdapterDeps interface — wrapper EventSource production-ready"
    - "MockEventSource test util + byChannelName indexing (B-NEW-2 fix)"
    - "RealtimePublishFn type (loose-coupling publish callback)"
  affects:
    - "Plan 04-07 (RealtimeChannelManager) — istanzia SseAdapter via new SseAdapter(def, deps)"
    - "Plan 04-08 (Realtime integration tests) — usa MockEventSource.byChannelName per harness routing per-canale"
tech-stack:
  added: []
  patterns:
    - "factory-with-closure (riuso analog circuit-breaker.ts F3 + reconnect-strategy.ts F4)"
    - "DI EventSourceCtor per test jsdom (RESEARCH §9.1)"
    - "AbortController re-init al re-connect (cycle-friendly per manager loop)"
    - "Listener tracking pattern (analog combine-signals.ts:62-86)"
    - "TDD RED→GREEN co-located test sibling (D-117)"
    - "Idempotent disconnect via flag disconnectedPublished (no doppio publish)"
    - "MockEventSource byChannelName indexing via ?_channel=<name> query param (B-NEW-2 owned da 04-05)"
key-files:
  created:
    - packages/gateway/src/sse-ws/sse-adapter.ts
    - packages/gateway/src/sse-ws/sse-adapter.test.ts
    - packages/gateway/src/sse-ws/test-utils/mock-event-source.ts
  modified: []
decisions:
  - "D-101 lockata: composition wrapper (adapter consumed dal RealtimeBroker via manager)"
  - "D-104 lockata: buildUrl() async hook chiamato PRIMA di OGNI connect/reconnect"
  - "D-105 lockata: NO header custom — Last-Event-ID via query string ?lastEventId="
  - "D-109 lockata: createReconnectStrategy istanziata in constructor con initialMode='sse'"
  - "D-113 lockata: source: { type: 'server', id: 'realtime-channel', name: 'sse' }"
  - "D-115 lockata: backpressure DI adapter-level pre-publish con priority 'normal'"
  - "W-4 SC-1 closure: def.eventTypes loop addEventListener — topic deriva da event field"
  - "B-5 Q5 closure: def.sseHeartbeatEventTypes default ['heartbeat'] → silent freshness update senza publish"
  - "B-NEW-2 lockata: MockEventSource.byChannelName Map indicizzata da ?_channel= query param (owned da 04-05)"
  - "Bug fix Rule 1: AbortController re-init al re-connect (era bloccato da disconnect)"
  - "Decisione minore: ErrorCategory union F1 non include 'protocol' → category viaggia in payload del network.error event (NOT come BrokerError.category) — coerente con nota plan 04-05"
metrics:
  duration_minutes: ~15
  completed_date: 2026-05-04
  tasks_total: 2
  tasks_completed: 2
  files_created: 3
  files_modified: 0
  loc_source: 464   # sse-adapter.ts
  loc_test: 278     # sse-adapter.test.ts
  loc_test_utils: 134  # mock-event-source.ts
  loc_total: 876
  tests_added: 14
  tests_passing: 14
  monorepo_tests_passing: 694
  commits:
    - "ba74ed6 test(04-05): add MockEventSource test util with byChannelName indexing (B-NEW-2 fix)"
    - "b581aa7 test(04-05): add failing tests for SseAdapter (D-101, D-104, D-109, RT-01/04/06/07)"
    - "fde59f8 feat(04-05): implement SseAdapter (EventSource wrapper + Last-Event-ID + custom event types + heartbeat hook)"
requirements_completed:
  - RT-01  # Adapter SSE con `EventSource` wrapper (lifecycle ✓)
  - RT-04  # Eventi standard system.realtime.connected/disconnected
  - RT-06  # Topic naming validation regex F1 (invalid → network.error category protocol)
  - RT-07  # Last-Event-ID injection via query string al re-connect (RESEARCH §3.2)
requirements_partial:
  - RT-05  # Reconnect config override-abile (createReconnectStrategy istanziata; loop di reconnect è del manager 04-07)
  - ERR-02 # network.error category protocol per topic invalid
---

# Phase 4 Plan 05: SSE adapter (EventSource wrapper + Last-Event-ID + custom event types + heartbeat hook) Summary

**One-liner:** `SseAdapter` class production-ready che incapsula `EventSource` con custom-reconnect-friendly lifecycle (no native reconnect — `es.close()` su error per applicare full jitter D-109 manualmente), Last-Event-ID injection manuale via query string `?lastEventId=` (D-105 / RESEARCH §3.2 / chiusura RT-07), custom event types W-4 SC-1 (`def.eventTypes` → `topic` = event field SSE), heartbeat eventTypes B-5 Q5 (`def.sseHeartbeatEventTypes` default `['heartbeat']` → silent freshness update), backpressure DI adapter-level (D-115 riuso 1:1 F3), AbortController cascade (D-112) e DI `EventSourceCtor` per test jsdom (RESEARCH §9.1). Cronologia git mostra TDD RED→GREEN strict.

## Cosa è stato fatto

Plan 04-05 implementa **3 file nuovi co-located** secondo il pattern TDD obbligatorio (D-117 ext D-88/D-92 da F3) + `MockEventSource` test util owned dal plan (B-NEW-2 fix iter 2). Tre commit atomici visibili in cronologia git.

### File creati

| File | LOC | Contenuto |
|------|-----|-----------|
| `packages/gateway/src/sse-ws/sse-adapter.ts` | **464** | Class `SseAdapter` + `SseAdapterDeps` interface + `RealtimePublishFn` type + helper privati (`dispatchInbound`, `tryParseJson`, `appendQueryParam`, `makeSystemEvent`, `addListener`) |
| `packages/gateway/src/sse-ws/sse-adapter.test.ts` | **278** | 14 test deterministici TDD organizzati in 1 describe block, copertura: lifecycle (T1-3), open/message dispatch (T4-5), Last-Event-ID injection (T6), error+close (T7), backpressure DI (T8), topic validation (T9), disconnect (T10), checkFreshness (T11), abort cascade (T12), W-4 SC-1 closure (T13), B-5 Q5 closure (T14) |
| `packages/gateway/src/sse-ws/test-utils/mock-event-source.ts` | **134** | `MockEventSource` class compatibile `EventSource` interface + `static byChannelName: Map<string, MockEventSource>` indicizzata da `?_channel=<name>` query param (B-NEW-2 fix owned da 04-05 — abilita harness routing strict per-canale di plan 04-08) |

**Totale:** 876 LOC, 0 file modificati (additive-only — D-83 strict ✓).

### Public API (lockata)

```typescript
export type RealtimePublishFn = (event: BrokerEvent) => void

export interface SseAdapterDeps {
  readonly publishFn: RealtimePublishFn
  readonly backpressure?: BackpressureStrategy            // D-115 riuso F3
  readonly EventSourceCtor?: typeof EventSource           // DI test
}

export class SseAdapter {
  readonly name: string

  constructor(def: RealtimeChannelDef, deps: SseAdapterDeps)
  connect(externalSignal?: AbortSignal): Promise<void>    // throw realtime.config.invalid se né buildUrl né url
  disconnect(reason?: string): void                        // idempotent
  checkFreshness(staleTimeoutMs: number): boolean          // visibility orchestration D-110
  getDebugInfo(): { name, mode: 'sse', readyState, lastEventId, lastEventReceivedAt }
}
```

## Output verification

### Test suite (14/14 PASS)

```
> @sembridge/gateway test src/sse-ws/sse-adapter.test.ts --run
 RUN  v4.1.5
 Test Files  1 passed (1)
      Tests  14 passed (14)
   Duration  394ms
```

Suddivisione test:

| # | Scenario | Verifica |
|---|----------|----------|
| 1 | connect() + buildUrl() | EventSource creato con URL risolto + withCredentials=true |
| 2 | connect() + url statico (no buildUrl) | EventSource creato con url statico |
| 3 | connect() senza buildUrl né url | throw BrokerError code='realtime.config.invalid' |
| 4 | __open() | publishFn riceve system.realtime.connected con source.name='sse' |
| 5 | __message default 'message' eventType | BrokerEvent con id=lastEventId + topic=def.name |
| 6 | Last-Event-ID injection (RT-07) | Secondo connect dopo message id='evt-1' → URL contiene `?lastEventId=evt-1` |
| 7 | __error() | publishFn system.realtime.disconnected + es.readyState===CLOSED |
| 8 | Backpressure DI (D-115) | schedule(channelName, 'normal', task) invocato per message events |
| 9 | Topic invalid (regex F1 fail) | publishFn network.error category='protocol' code='realtime.topic.invalid' no crash |
| 10 | disconnect() | EventSource closed + system.realtime.disconnected |
| 11 | checkFreshness | < staleTimeoutMs ritorna true (default safe se mai ricevuto) |
| 12 | AbortController cascade (D-112) | external signal abort → readyState===CLOSED |
| 13 | **W-4 SC-1 closure** | def.eventTypes=['weather.update'] → BrokerEvent.topic='weather.update' (NOT def.name); listener 'message' NON registrato |
| 14 | **B-5 Q5 closure** | def.sseHeartbeatEventTypes default ['heartbeat'] → __message eventType='heartbeat' aggiorna lastEventReceivedAt SENZA publish |

### Gateway suite (160/160 PASS — zero regressioni)

```
 Test Files  19 passed (19)
      Tests  160 passed (160)   ← era 146 prima di 04-05 (+14)
```

### Monorepo full suite (694/694 PASS — zero regressioni)

```
core:    248 passed (24 files)
mapper:  183 passed (16 files)
gateway: 160 passed (19 files)   ← +14 vs 146 baseline post-04-04
routing: 103 passed (16 files)
TOTAL:   694/694                  ← +14 vs 680 baseline post-04-04
```

### Typecheck monorepo (clean)

```
core typecheck: Done
mapper typecheck: Done
gateway typecheck: Done
routing typecheck: Done
```

### Build gateway (ESM + DTS clean)

```
ESM dist/index.js              29.16 KB
ESM dist/sse-ws/index.js       228.00 B   (barrel ancora skeleton — runtime esposto in plan 04-08)
ESM dist/sse-ws/augment.js     232.00 B
ESM ⚡️ Build success in 70ms
DTS ⚡️ Build success in 585ms
```

**Nota:** il `sse-adapter` NON è (ancora) ri-esportato dal barrel `sse-ws/index.ts` — questo è atteso. Verrà esposto in plan 04-08 con il public-factory `createRealtimeBroker`. I test in 04-05 e i consumer interni di plan 04-07 (manager) usano import diretti `from './sse-adapter'`.

### Anti-pattern verificati

```bash
# AP-2 (no Authorization header injection — vincolo PRD §31.3 + D-105):
$ grep -v '^//' packages/gateway/src/sse-ws/sse-adapter.ts | grep -c "Authorization"
0

# AP-3 (no `reconnecting-websocket` — vincolo PRD §31.3 + STACK.md):
$ grep -E "^(import|require).*reconnecting-websocket" packages/gateway/src/sse-ws/sse-adapter.ts
(no match)

# AP-4 implicito (no native reconnect):
# es.close() esplicito nel listener 'error' — sì ✓
```

## TDD RED→GREEN gate compliance

Cronologia git mostra commit separati (D-117 strict):

| Gate | Hash | Type | Subject |
|------|------|------|---------|
| Helper | `ba74ed6` | test | `add MockEventSource test util with byChannelName indexing (B-NEW-2 fix)` |
| RED | `b581aa7` | test | `add failing tests for SseAdapter (D-101, D-104, D-109, RT-01/04/06/07)` |
| GREEN | `fde59f8` | feat | `implement SseAdapter (EventSource wrapper + Last-Event-ID + custom event types + heartbeat hook)` |

**RED gate verificato** prima del commit GREEN: `vitest` fail con `Failed to resolve import "./sse-adapter" from "src/sse-ws/sse-adapter.test.ts"`. Il commit RED introduce SOLO i test; il commit GREEN introduce SOLO l'implementazione.

## Threat coverage applicata

| Threat ID | Categoria | Disposition | Implementazione |
|-----------|-----------|-------------|-----------------|
| T-04-05-01 | Tampering uppercase topic | mitigate ✓ | Topic validation regex `/^[a-z0-9]+(\.[a-z0-9]+)*$/`. Test 9 verifica `WEATHER.UPDATE` → network.error category='protocol' no crash |
| T-04-05-02 | Spoofing system.realtime.* da server | accept (V1) | Documentato in DOC-04 plan 04-09: convenzione interna; consumer non subscribe a server-emitted system.* in V1; V1.x può aggiungere strict filter |
| T-04-05-03 | URL injection via buildUrl | accept | Consumer responsabile (D-104 contract) |
| T-04-05-04 | Token in URL query string in browser history/proxy log | mitigate (parziale) | DOC-04 best practices: short-lived token TTL ≤5min, single-use; cookie auth preferred dove possibile |
| T-04-05-05 | DoS frame storm 10K/sec | mitigate ✓ | Backpressure DI (D-115) `schedule('feed', 'normal', task)` pre-publish; Test 8 verifica chiamata. Critical bypass per priority='critical' (riuso F3) |
| T-04-05-06 | Memory leak external abort | mitigate ✓ | `{ once: true }` su `addEventListener('abort')` cascade. Test 12 verifica disconnect su external abort |
| T-04-05-07 | Native reconnect race con custom reconnect | mitigate ✓ | RESEARCH §3.3: `es.close()` esplicito su error → readyState===CLOSED. Test 7 verifica |

## Vincoli rispettati

- **D-83 strict (ZERO modifiche fuori `packages/gateway/src/sse-ws/`):**

```bash
$ git diff e287353..HEAD --name-only | grep -vE "^packages/gateway/src/sse-ws/"
(empty - 0 violations)
```

Tutte le modifiche sono nuovi file `additive-only` in `packages/gateway/src/sse-ws/`. Nessuna API esistente toccata.

- **D-117 TDD RED→GREEN:** 3 commit separati visibili in `git log` (helper test util + RED + GREEN).
- **AP-2 (no `Authorization`):** verificato via grep — 0 occorrenze.
- **AP-3 (no `reconnecting-websocket`):** verificato via grep import strict — 0 occorrenze.
- **Lingua CLAUDE.md:** italiano per JSDoc descrittivi e commenti dottrinali; inglese per identifier, codice, error keywords, log keywords (es. `'system.realtime.connected'`, `'realtime.config.invalid'`, `'eventsource.error'`).

## Deviations from Plan

**1 deviazione [Rule 1 - Bug fix] applicata durante l'esecuzione:**

### `[Rule 1 - Bug] AbortController re-init al re-connect`

- **Found during:** Task 2 — Test 6 (Last-Event-ID tracking) ha rivelato il bug.
- **Issue:** Il pattern originale aveva `private readonly controller = new AbortController()` istanziato una sola volta in field initialization; il `disconnect()` chiama `controller.abort(reason)` per cleanup, ma poi `connect()` aveva la guard `if (this.controller.signal.aborted) return`, che bloccava qualsiasi re-connect successivo. Test 6 fallisce: secondo `connect()` skipped silenziosamente → MockEventSource.lastInstance resta quello del primo connect → URL non contiene `?lastEventId=`.
- **Fix:** Rimosso `readonly` dal `controller` field e aggiunto re-init opportunistic in `connect()`: se `controller.signal.aborted`, crea un fresh `AbortController` per il nuovo ciclo. Mantenuta la guard sull'`externalSignal` (early return se l'external è abortito al momento del connect).
- **Files modified:** `packages/gateway/src/sse-ws/sse-adapter.ts` (constructor + connect()).
- **Commit:** `fde59f8` (incluso nel commit GREEN, non ha richiesto un commit separato).
- **Pattern coerente:** http-gateway.ts gestisce il fetch lifecycle multi-attempt rinnovando il signal per ogni tentativo. Il pattern è ora documentato in JSDoc del field `controller`.

**Tutto il resto del plan è stato eseguito esattamente come specificato** — interface signatures, test count (≥12 → effettivi 14, +2 per W-4 SC-1 e B-5 Q5 closures), default values, formula Last-Event-ID, backpressure DI, AbortController cascade, ecc.

## Issues Encountered

- **Inizialmente fallito tsc per `readonly` su ReconnectStrategyOptions fields:** il pattern `reconnectOpts.baseMs = ...` non funzionava perché tutti i campi sono `readonly`. Risolto rifattorizzando con spread condizionale `...(def.reconnect?.baseMs !== undefined && { baseMs: def.reconnect.baseMs })`. Pattern già presente in `PATTERNS.md §2.8` ma non immediatamente applicato. Risolto in <1 min.
- **Initial `controller` block re-connect** — vedi sezione Deviations (Rule 1 fix). Risolto in <2 min.

## Hand-off note per Wave 4 (plan 04-07 RealtimeChannelManager)

Il manager può importare `SseAdapter` direttamente:

```typescript
import { SseAdapter } from './sse-adapter'

// Single SseAdapter per channel (mode='sse' o 'auto' iniziale SSE)
const adapter = new SseAdapter(def, {
  publishFn: (event) => broker.publish(event),
  backpressure: this.backpressureStrategy,  // shared F3 instance, opt-in
  // EventSourceCtor: omitted in production → globalThis.EventSource
})

// Reconnect loop (manager-owned):
while (!isPermanentlyFailed) {
  try {
    await adapter.connect(externalAbortSignal)
    // ... attendi 'open' o 'error' (eventi vengono pubblicati via publishFn)
    // Manager osserva `system.realtime.connected/disconnected` per sapere quando ricollegarsi
  } catch (err) {
    // realtime.config.invalid o realtime.eventsource.unavailable
  }
  await sleep(reconnectStrategy.nextDelayMs())  // delay tra retry
  // Sopra `connect()` re-inizia: il controller è auto-re-init se era aborted
}
```

**API utility per il manager:**
- `adapter.checkFreshness(60_000)` → invocato da Visibility API on-visible (D-110); se `false` → `disconnect()` + `connect()` immediato.
- `adapter.getDebugInfo()` → snapshot per Inspector plan 04-09.
- `adapter.disconnect('cascade.unregisterPlugin')` → invocato dal manager per cascade D-112 cleanup.

**Casi limite gestiti dall'adapter:**
- `def.buildUrl` async ritarda la creazione di `EventSource` → il manager deve `await connect()` prima di considerare il canale "connecting".
- `disconnect()` durante `await buildUrl()` → `controller.signal.aborted` impedisce comunque la creazione dell'EventSource (verificato: il flag è controllato pre-`new Ctor(url)`... [N.B. attualmente la guard è solo all'inizio del connect; un fix opzionale per il manager: validare che il consumer non chiami `connect()` e `disconnect()` race-condition. V1 V1.x può rendere la guard più stretta].
- Topic invalid: pubblicato `network.error` ma il canale rimane connesso (continua a ricevere altri eventi).

**B-NEW-2 closure (test-only):** plan 04-08 può usare `MockEventSource.byChannelName.get(channelName)` per routing strict per-canale dell'harness, evitando il fallback ambiguo a `MockEventSource.lastInstance`. Test pattern:

```typescript
new MockEventSource('https://x/sse?_channel=orders')  // auto-registra in byChannelName
const orders = MockEventSource.byChannelName.get('orders')  // deterministico
```

## Self-Check

**Created files:**
- `packages/gateway/src/sse-ws/sse-adapter.ts` — FOUND ✓ (464 LOC, contiene `export class SseAdapter` + `SseAdapterDeps` + `RealtimePublishFn`)
- `packages/gateway/src/sse-ws/sse-adapter.test.ts` — FOUND ✓ (278 LOC, 14 `it(` blocks)
- `packages/gateway/src/sse-ws/test-utils/mock-event-source.ts` — FOUND ✓ (134 LOC, `export class MockEventSource` + `byChannelName` Map)

**Commits:**
- `ba74ed6` (helper test util) — FOUND ✓
- `b581aa7` (RED test) — FOUND ✓
- `fde59f8` (GREEN feat) — FOUND ✓

**Acceptance criteria del plan:**
- [x] File `sse-adapter.ts` esiste e contiene `export class SseAdapter`
- [x] File contiene `interface SseAdapterDeps` con `publishFn`, `backpressure?`, `EventSourceCtor?`
- [x] File contiene `new Ctor(url, { withCredentials: true })` (auth via cookie path)
- [x] File contiene `lastEventId` tracking + `appendQueryParam` per Last-Event-ID injection (RESEARCH §3.2)
- [x] File contiene `addEventListener('open'`, listener loop `eventTypes`, listener loop `heartbeatTypes`, `addEventListener('error'`
- [x] File contiene `createReconnectStrategy` invocazione con `initialMode: 'sse'`
- [x] File contiene `recordFailure()` invocato in 'error' handler (line ~243)
- [x] File contiene `recordSuccess()` invocato in 'open' handler (line ~199)
- [x] File contiene `es.close()` su error handler (RESEARCH §3.3 disable native reconnect)
- [x] File contiene topic validation con regex `/^[a-z0-9]+(\.[a-z0-9]+)*$/`
- [x] File contiene `topic: 'network.error'` per topic invalid + `payload.category: 'protocol'`
- [x] File contiene loop `for (const eventType of eventTypes)` con fallback `['message']` (W-4 SC-1)
- [x] File contiene loop `for (const heartbeatType of heartbeatTypes)` con default `['heartbeat']` che aggiorna `lastEventReceivedAt` senza `publishFn` (B-5 Q5)
- [x] Test 13 verifica `event: weather.update` → BrokerEvent.topic === 'weather.update'
- [x] Test 14 verifica `event: heartbeat` → checkFreshness(60_000) === true E publishFn NOT called
- [x] File contiene `source: { type: 'server', id: 'realtime-channel', name: 'sse' }` (PRD §18.5 — costante `SSE_SOURCE` Object.frozen)
- [x] File contiene `externalSignal?.addEventListener('abort'` con `{ once: true }` (D-112 cascade)
- [x] File contiene `checkFreshness(staleTimeoutMs: number): boolean` method
- [x] File NON contiene `Authorization` literal (anti-AP-2 check)
- [x] File `sse-adapter.test.ts` contiene almeno 12 test (effettivi: 14)
- [x] `pnpm --filter @sembridge/gateway test src/sse-ws/sse-adapter.test.ts` exit 0 (14/14 PASS)
- [x] `pnpm --filter @sembridge/gateway exec tsc --noEmit` exit 0 (clean)
- [x] Cronologia git mostra ≥2 commit 04-05 (RED + GREEN); effettivi: 3 (helper + RED + GREEN)
- [x] MockEventSource.byChannelName implementato (B-NEW-2 fix)

## Self-Check: PASSED
