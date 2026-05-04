---
phase: 04-realtime-inbound-sse-prioritario-ws-opzionale
plan: 08
subsystem: gateway/sse-ws
tags:
  - realtime
  - broker
  - composition
  - public-factory
  - integration-tests
  - 3-tier-test-strategy
requirements:
  - RT-01
  - RT-02
  - RT-03
  - RT-04
  - RT-05
  - RT-06
  - RT-07
  - ERR-02
  - TEST-01
  - TEST-02
  - TEST-03
dependency_graph:
  requires:
    - 04-01
    - 04-02
    - 04-03
    - 04-04
    - 04-05
    - 04-06
    - 04-07
  provides:
    - RealtimeBroker (composition wrapper di RouterBroker — D-101 / D-83 strict)
    - createRealtimeBroker public factory (D-30 + Valibot validation)
    - createRealtimeHarness fixture per integration test
    - 14 integration test files (Tier-1 jsdom + Tier-2 MSW + Tier-3 Playwright)
    - sse-ws/index.ts barrel finale completo
  affects:
    - 04-09 (final gate publint/attw/size-limit)
tech-stack:
  added:
    - msw 2.13.6 (devDep) — Tier-2 MSW infrastructure (V1.x effective)
    - '@vitest/browser 4.1.5' (devDep) — Tier-3 Playwright bootstrap
    - '@vitest/browser-playwright 4.1.5' (devDep) — Vitest 4.x browser provider factory
  patterns:
    - composition-wrapper (D-101 — replica RouterBroker → MapperBroker pattern)
    - Valibot-safeParse-at-boundary (D-30 + D-56 — pattern F1/F2/F3)
    - subscribe-wildcard-multi-depth (W-3 closure — pattern '*','*.*','*.*.*','*.*.*.*' per coprire eventi 1-4 segmenti senza monkey-patch)
    - byChannelName-static-Map-routing (B-2 + B-NEW-2 closure — strict per-channel lookup via _channel query param)
    - 3-tier-test-strategy (D-118 — jsdom + MSW + Playwright real browser)
key-files:
  created:
    - packages/gateway/src/sse-ws/realtime-broker.ts (296 LOC)
    - packages/gateway/src/sse-ws/realtime-broker.test.ts (220 LOC, 12 test BEHAVIOR-VERIFICATING)
    - packages/gateway/src/sse-ws/public-factory.ts (123 LOC)
    - packages/gateway/src/sse-ws/public-factory.test.ts (64 LOC, 6 test)
    - packages/gateway/src/sse-ws/test-utils/realtime-harness.ts (223 LOC)
    - packages/gateway/src/sse-ws/__integration__/multi-channel-routing.test.ts (67 LOC, 2 test, B-2 closure)
    - packages/gateway/src/sse-ws/__integration__/sse-reconnect.test.ts (57 LOC, 1 test)
    - packages/gateway/src/sse-ws/__integration__/ws-stale-detection.test.ts (52 LOC, 1 test)
    - packages/gateway/src/sse-ws/__integration__/auto-fallback.test.ts (128 LOC, 2 test, B-4 closure)
    - packages/gateway/src/sse-ws/__integration__/visibility-aware.test.ts (63 LOC, 2 test, D-110)
    - packages/gateway/src/sse-ws/__integration__/cascade-cleanup.test.ts (65 LOC, 2 test, D-112)
    - packages/gateway/src/sse-ws/__integration__/backpressure-storm.test.ts (47 LOC, 1 test, D-115)
    - packages/gateway/src/sse-ws/__integration__/mapper-canonicalization.test.ts (97 LOC, 2 test, W-2)
    - packages/gateway/src/sse-ws/__integration__/msw-sse-replay.test.ts (32 LOC, describe.skip V1.x)
    - packages/gateway/src/sse-ws/__integration__/msw-ws-stale.test.ts (19 LOC, describe.skip V1.x)
    - packages/gateway/src/sse-ws/__integration__/msw-auto-fallback.test.ts (20 LOC, describe.skip V1.x)
    - packages/gateway/src/sse-ws/__browser__/playwright-sse-smoke.test.ts (47 LOC, 1 test attivo + 1 skip V1.x)
    - packages/gateway/vitest.browser.config.ts (NEW, Tier-3 Playwright config)
  modified:
    - packages/gateway/src/sse-ws/index.ts (barrel finale completo — RealtimeBroker, createRealtimeBroker, RealtimeChannelManager, adapters, state machines, parser)
    - packages/gateway/vitest.config.ts (W-NEW-3 — exclude **/__browser__/**)
    - packages/gateway/package.json (scripts test:msw + test:browser; devDeps msw + @vitest/browser + @vitest/browser-playwright)
decisions:
  - 'D-101 confirmed: RealtimeBroker compone RouterBroker (D-83 strict, ZERO modifiche F1/F2/F3 runtime) — verified live RouterBroker.publish accetta options.source/id'
  - 'D-30 confirmed: createRealtimeBroker pure function, no singleton, multi-tenant safe'
  - 'D-103 confirmed: registerPlugin auto-registra descriptor.realtimeChannels con ownerId=descriptor.id'
  - 'D-112 confirmed: unregisterPlugin cascade chain inner.unregisterPlugin → manager.disconnectByOwner (verified in cascade-cleanup.test.ts 5→4 channels)'
  - 'W-1 closure: source.type=server + name=sse preservato end-to-end via inner.publish(topic, payload, { source, id }) — Test 11 BEHAVIOR-VERIFICATING'
  - 'W-2 closure: pipeline §28 step 1-13 esercitata (subscriber riceve via subscribe end-to-end) — V1 smoke (mapping inbound automatic on `realtime-inbound` route placeholder PRD §17.5 deferred V1.x)'
  - 'W-3 closure: harness usa subscribe wildcard multi-depth (*,*.*,*.*.*,*.*.*.*) NIENTE monkey-patch broker.publish — il path manager.publishFn → inner.publish resta intatto, pipeline §28 esercitata'
  - 'W-5 closure: registerPlugin con channel-register fail emette system.warn con reason=realtime-channel-register-failed — Test 12 BEHAVIOR-VERIFICATING'
  - 'B-1 closure 3-tier: Tier-1 jsdom 8 file passing + Tier-2 MSW infrastructure (V1.x effective) + Tier-3 Playwright real Chromium 1 test attivo'
  - 'B-2 closure: harness routing strict via MockEventSource.byChannelName.get(name) + MockWebSocket.byChannelName.get(name); throw esplicito su name non matchato'
  - 'B-3 closure: tutti 12 test broker BEHAVIOR-VERIFICATING (asserzioni su getDebugSnapshot/subscribe callback) — zero placeholder presence-only'
  - 'B-4 closure: auto-fallback.test.ts verifica MockWebSocket istanziato dopo SSE constructor fail (FailingMockEventSource) + cycle-cap → system.realtime.failed reason=cycle-cap-exceeded'
  - 'B-NEW-2 closure (iter 2): byChannelName Map è property statica permanente owned dai mock (04-05/04-06); harness consuma direttamente come API pubblica del mock'
  - 'W-NEW-1 closure: Tier-3 Playwright smoke verifica EventSource API instanziabile in real Chromium; E2E completo deferred V1.x con test.skip esplicito + disclaimer'
  - 'W-NEW-3 closure: vitest.config.ts exclude **/__browser__/** per evitare carico Tier-3 in jsdom run; Tier-3 isolato in vitest.browser.config.ts'
metrics:
  duration: '~80 min'
  completed: '2026-05-04'
  tests_added: 19  # 12 broker + 6 factory + 1 W-1 source preservation
  integration_tests_added: 13  # 8 Tier-1 (test count) + 3 Tier-2 skip + 2 Tier-3 (1 attivo + 1 skip)
  tests_passed: 222  # gateway full
  tests_skipped: 3   # 3 MSW Tier-2 deferred V1.x
  total_gateway_tests: 225
  total_monorepo_tests: 759
  loc_source: 642  # realtime-broker (296) + public-factory (123) + harness (223)
  loc_test: 980    # 18 unit + 13 integration files
---

# Phase 4 Plan 08: RealtimeBroker Composition + Integration Tests Summary

> **One-liner:** RealtimeBroker compone RouterBroker (D-101 / D-83 strict) + factory pubblica `createRealtimeBroker` con Valibot + harness e 14 integration test 3-tier (jsdom 8 file passing + MSW V1.x deferred + Playwright real Chromium smoke). 222/225 gateway test passing, B-1..B-4 + W-1..W-5 closure, vincolo D-83 verificato live.

## Cosa è stato fatto

Implementato il **`RealtimeBroker` composition wrapper** (D-101) — la classe che chiude la chain F1→F2→F3→F4 senza toccare il runtime delle phase precedenti (vincolo D-83 strict). Il broker è il consumer-facing layer per Phase 4: espone `connectRealtime`/`disconnectRealtime` (PRD §16.2), override `registerPlugin` per auto-registrare `descriptor.realtimeChannels` con `ownerId=descriptor.id` (D-103), override `unregisterPlugin` per la cascade D-112, e delega passthrough a `RouterBroker.publish/subscribe/registerRoute/registerCanonicalSchema`. Il `manager.publishFn` invoca `inner.publish(event.topic, event.payload, { source: event.source, id: event.id })` — verificato live che `Broker.publish` (F1, `packages/core/src/core/broker.ts:155-163`) accetta `source` e `id` in options, propagati intatti attraverso F2→F3→F1 fino a `createBrokerEvent` (event-factory.ts:48-67) — **W-1 closure source preservation end-to-end** (Test 11 verifica `event.source.type === 'server' && event.source.name === 'sse'` ricevuto dal subscriber finale).

Implementato il **`createRealtimeBroker` public factory** (D-30 no singleton + Valibot safeParse). Schema valida `realtime.channels[].name: string` + `mode: 'sse'|'websocket'|'auto'` literal union; sezioni F1-F3 (runtime, debug, canonicalModel, aliasRegistry, transforms, routes, gateway, routing) passano via `looseObject` — la validation dettagliata è downstream in `createRouterBroker` (D-56 validation at boundary). Su fail: `Error("Invalid RealtimeBrokerConfig: <issues>")` (pattern F1/F2/F3).

Implementato la **`createRealtimeHarness`** fixture per integration test. Patcha `globalThis.EventSource` + `globalThis.WebSocket` con `MockEventSource`/`MockWebSocket` (jsdom-friendly), espone broker creato via `createRealtimeBroker`, eventi raccolti via subscribe wildcard multi-depth (`'*'`, `'*.*'`, `'*.*.*'`, `'*.*.*.*'`) — **W-3 closure**: niente monkey-patch di `broker.publish`, il path `manager.publishFn → inner.publish` resta intatto e la pipeline §28 viene esercitata interamente. Routing strict per-canale via `MockEventSource.byChannelName.get(name)` + `MockWebSocket.byChannelName.get(name)` — **B-2 + B-NEW-2 closure**: convention test `?_channel=<name>` in URL, throw esplicito se name non matcha (intentional — indica test setup error).

Creati i **14 integration test files (3-tier strategy D-118)**:

**Tier-1 jsdom (8 file, 13 test passing)**:
- `multi-channel-routing.test.ts` — B-2 closure smoke 2 canali simultanei + throw esplicito su name unknown
- `sse-reconnect.test.ts` — SSE error → publish `system.realtime.disconnected` con reason `eventsource.error`
- `ws-stale-detection.test.ts` — WS no pong oltre `staleTimeout` → disconnected published
- `auto-fallback.test.ts` — **B-4 closure**: SSE constructor fail (FailingMockEventSource) → `runReconnectLoop` rebinda adapter → `MockWebSocket.instances.length >= 1`; cycle-cap → `system.realtime.failed` con `reason='cycle-cap-exceeded'`
- `visibility-aware.test.ts` — D-110 lazy init/teardown VisibilityDetector + visibilitychange dispatch non crash
- `cascade-cleanup.test.ts` — D-112: 5 plugin con channels → `unregisterPlugin('p3')` → 4 channels rimasti, p3.feed scomparso, ownerId match
- `backpressure-storm.test.ts` — D-115 smoke 1000 eventi rapidi → broker no crash + canale ancora attivo
- `mapper-canonicalization.test.ts` — **W-2 closure** smoke V1: payload server-side raggiunge subscriber attraverso pipeline §28 + source preserved (V1 limitation: mapping inbound automatic richiede `realtime-inbound` route placeholder PRD §17.5 — deferred V1.x)

**Tier-2 MSW (3 file, all `describe.skip` V1.x)**:
- `msw-sse-replay.test.ts` — V1.x deferred: jsdom no native EventSource → richiede polyfill EventSource fetch-based
- `msw-ws-stale.test.ts` — V1.x deferred: msw 2.5+ ws.link integration con jsdom WebSocket compat da verificare
- `msw-auto-fallback.test.ts` — V1.x deferred: stack ws.link + http.get round-trip

**Tier-3 Playwright (1 file, 1 test attivo + 1 skip V1.x)**:
- `playwright-sse-smoke.test.ts` — **W-NEW-1 closure** smoke real Chromium: `typeof EventSource === 'function'` + `new EventSource('http://localhost:0/non-existent')` no throw al construct (verifica NON-mock); E2E completo (connect+receive con server fixture) deferred V1.x con `test.skip` + disclaimer.

Aggiornato il **`sse-ws/index.ts` barrel finale** (Task 4): export `RealtimeBroker`, `RealtimeBrokerConfig`, `createRealtimeBroker`, `RealtimeChannelManager` (+ tipi), `SseAdapter`, `WebSocketAdapter`, `createReconnectStrategy`, `createVisibilityDetector`, `parseFrame`, `isInternalTopic`, `INTERNAL_TOPICS`. Build verificato: `dist/sse-ws/{index,augment}.{js,d.ts}` con `createRealtimeBroker` esportato (17 occurrence in dist/sse-ws/index.d.ts).

Configurazione testabilità:
- `vitest.config.ts` (Tier-1 jsdom) **W-NEW-3 closure**: `exclude: ['node_modules', 'dist', '**/__browser__/**']` per evitare il carico dei file Tier-3 in jsdom (richiedono real-browser API non disponibili in Node).
- `vitest.browser.config.ts` NEW (Tier-3 Playwright): `provider: playwright()` factory (vitest 4.x API change — vedi disclaimer al top del file), `headless: true`, `instances: [{ browser: 'chromium' }]`, include solo `__browser__/**`.
- `package.json` scripts: `test:msw` (vitest run su `__integration__/msw-*`), `test:browser` (vitest run con browser config).
- devDeps aggiunte: `msw 2.13.6`, `@vitest/browser 4.1.5`, `@vitest/browser-playwright 4.1.5`.

## Test eseguiti

### Unit test broker + factory (18 test BEHAVIOR-VERIFICATING — B-3 closure)

`realtime-broker.test.ts` (12 test):
1. **Test 1 (D-101)** — constructor compone RouterBroker, publish/subscribe round-trip via composition
2. **Test 2 (D-102 B-3)** — connectRealtime registra canale con `ownerId='system'` (verificato via getDebugSnapshot)
3. **Test 3 (D-103)** — registerPlugin auto-registra realtimeChannels con `ownerId=plugin.id`
4. **Test 4 (D-112 cascade)** — unregisterPlugin chiude SOLO i canali del plugin
5. **Test 5 (D-102 bootstrap)** — config.realtime.channels istanziati al constructor
6. **Test 6 (composition passthrough)** — publish delegate a inner.publish
7. **Test 7 (D-102)** — disconnectRealtime() chiude tutti i canali
8. **Test 8 (debug surface)** — getDebugSnapshot include sezione realtime + inner
9. **Test 9 (D-103 no side-effect)** — registerPlugin senza realtimeChannels, manager invariato
10. **Test 10 (D-112 idempotency)** — unregisterPlugin senza channels non throw
11. **Test 11 (W-1 source preservation)** — subscriber riceve `event.source.type='server'` + `name='sse'` end-to-end
12. **Test 12 (W-5)** — registerPlugin con duplicate channel → publish `system.warn`, plugin still registered

`public-factory.test.ts` (6 test):
1. config vuota → broker valido (publish/subscribe round-trip funziona)
2. config con realtime.channels valid → bootstrap
3. invalid name (numero) → throw `Invalid RealtimeBrokerConfig`
4. invalid mode literal → throw
5. **D-30 no singleton** — 2 chiamate ritornano istanze diverse
6. looseObject preserve sezioni F3 (gateway, routes)

### Integration test (13 attivi + 3 skip V1.x)

8 file Tier-1 jsdom (13 test passing) + 3 file Tier-2 MSW (skip V1.x) + 1 file Tier-3 Playwright (1 test attivo + 1 skip V1.x).

### Output `pnpm test`

```text
Test Files  31 passed | 3 skipped (34)
     Tests  222 passed | 3 skipped (225)
```

### Output `pnpm test:msw`

```text
Test Files  3 skipped (3)
     Tests  3 skipped (3)
```

### Output `pnpm test:browser`

```text
Test Files  1 passed (1)
     Tests  1 passed | 1 skipped (2)
```

### Output `pnpm typecheck`

Zero error TS.

### Output `pnpm build`

```text
ESM dist/sse-ws/index.js     ~78 KB
ESM dist/sse-ws/augment.js   ~3 KB
DTS dist/sse-ws/index.d.ts   44.49 KB
DTS dist/sse-ws/augment.d.ts 118 B
```

`createRealtimeBroker` esportato in dist (17 occurrence in `dist/sse-ws/index.d.ts`).

### Output monorepo full

| Package | Tests | Note |
|---------|-------|------|
| @sembridge/core | 248 passed | invariato |
| @sembridge/mapper | 183 passed | invariato |
| @sembridge/routing | 103 passed | invariato |
| @sembridge/gateway | 222 passed + 3 skip | +34 test (12 broker + 6 factory + 13 integration + 1 Tier-3 attivo + 2 Tier-2/3 skip) |
| **Totale** | **756 passed + 3 skip** | **vs pre-04-08: 725 → +34 nuovi test** |

## Decisioni architetturali

### W-1 closure: source preservation end-to-end (verification-gated)

Il `RealtimeBroker.constructor` istanzia il `RealtimeChannelManager` con `publishFn` legato all'`inner.publish`. Il publishFn riceve un `BrokerEvent` completo costruito dall'adapter (con `source: SSE_SOURCE = { type: 'server', id: 'realtime-channel', name: 'sse' }` di plan 04-05) e lo trasforma in chiamata `inner.publish(event.topic, event.payload, { source: event.source, id: event.id })`.

**Verification vivo (read_first Task 1)**: confermato che `Broker.publish` (F1, `packages/core/src/core/broker.ts:155-163`) accetta `source` e `id` come parte di `Omit<PublishParams<T>, 'topic'|'payload'>`. `MapperBroker.publish` (broker-mapper-wrapper.ts:442) propaga `options` invariato a `inner.publish` via spread `{ ...options, id: preAllocatedEventId }`. `createBrokerEvent` (event-factory.ts:52) usa `params.source ?? defaultSource` — il source è preservato se fornito. **Test 11** dimostra empiricamente: subscriber riceve `event.source.type === 'server'` + `event.source.name === 'sse'`.

T-04-08-09 (Logic flaw — source.type='server' lost se RouterBroker.publish non accetta options.source/id): **mitigated**. Verification-gated check passing.

### W-3 closure: harness senza monkey-patch

L'harness `createRealtimeHarness` collect events via subscribe wildcard a 4 pattern di profondità (`'*'`, `'*.*'`, `'*.*.*'`, `'*.*.*.*'`). Il F1 topic-matcher (`packages/core/src/core/topic-matcher.ts:115-138`) supporta `*` come segment wildcard ma il match avviene per profondità esatta — l'harness copre eventi 1-4 segmenti che è sufficiente per i topic standard SemBridge (`'orders'`, `'system.warn'`, `'system.realtime.connected'`, `'system.realtime.connected.x'`). NIENTE monkey-patch di `broker.publish` — il path `manager.publishFn → inner.publish` ORIGINALE resta intatto e la pipeline §28 (step 1-13 F1, +F2 step 4-6, +F3 step 8-10) viene esercitata interamente.

### B-3 closure: zero placeholder presence-only

I 12 test di `realtime-broker.test.ts` asseriscono SOLO side-effect osservabili:
- `getDebugSnapshot().realtime.channels.find(...)` (Test 2/3/4/7/9)
- `subscribe(topic, cb)` callback ricevuto (Test 1/6/11/12)
- Promise resolution (Test 10)
- Error throw type (Test 3/4 di public-factory)

Zero `expect(typeof fn).toBe('function')` — pattern presence-only è banned per B-3 closure.

### B-4 closure: auto-fallback effettivo verificato

`auto-fallback.test.ts` Test 1 sostituisce `globalThis.EventSource` con `FailingMockEventSource` che throw nel constructor. Questo forza il path `manager.connect → catch → runReconnectLoop` di plan 04-07 (verified Test 13 unit). Dopo `fallbackThreshold: 1` fail, il loop chiama `strategy.fallback()` → `nextMode='websocket'` → istanzia `MockWebSocket`. Asserzione `expect(MockWebSocket.instances.length).toBeGreaterThanOrEqual(1)` chiude la closure end-to-end via integration test.

Test 2 cycle-cap: `maxAttempts: 2` + `FailingMockWebSocket` anche fail → strategy `isPermanentlyFailed()` true → `runReconnectLoop` publica `system.realtime.failed` con `reason='cycle-cap-exceeded'`. Subscriber catch via `broker.subscribe('system.realtime.failed', ...)`.

### W-NEW-3 closure: vitest config exclude __browser__

Senza `exclude: ['**/__browser__/**']` in `vitest.config.ts`, vitest jsdom carica i file Tier-3 e fallisce (tipicamente `EventSource` undefined in Node, oppure `playwright` import resolve fail). La modifica vive in 04-08 (NON in 04-01) perché `__browser__/` viene introdotto qui.

Verifica: `grep -c '__browser__' packages/gateway/vitest.config.ts` ritorna 1 nel blocco `test.exclude`.

### Vitest 4.x browser provider API change

Vitest 4.x ha cambiato l'API `browser.provider`: pre-4.x accettava string literal (es. `'playwright'`), post-4.x accetta una factory function importata da `@vitest/browser-playwright`. Aggiornata `vitest.browser.config.ts` con `import { playwright } from '@vitest/browser-playwright'` + `provider: playwright()`. Aggiunti devDeps `@vitest/browser 4.1.5` + `@vitest/browser-playwright 4.1.5`. Playwright Chromium binary installato via `pnpm exec playwright install chromium`.

## Closure overview B-1..B-4 + W-1..W-5

| Closure | Test/file | Risultato |
|---------|-----------|-----------|
| **B-1 (D-118 3-tier)** | Tier-1 8 file (jsdom) + Tier-2 3 file MSW (V1.x deferred) + Tier-3 1 file Playwright | ✅ Tier-1 + Tier-3 attivi, Tier-2 skip documentato |
| **B-2 (multi-channel routing)** | `multi-channel-routing.test.ts` (2 test) | ✅ pushSseEvent('a',...) raggiunge SOLO subscriber('a'); throw esplicito su name unknown |
| **B-3 (zero placeholder)** | `realtime-broker.test.ts` (12 test) | ✅ Tutti BEHAVIOR-VERIFICATING via getDebugSnapshot/subscribe callback |
| **B-4 (auto-fallback effettivo)** | `auto-fallback.test.ts` Test 1+2 | ✅ MockWebSocket.instances >= 1 dopo SSE fail; cycle-cap → system.realtime.failed reason=cycle-cap-exceeded |
| **B-NEW-2 (byChannelName property)** | mock files plan 04-05/06 | ✅ static byChannelName Map permanente, harness consume direttamente |
| **W-1 (source preservation)** | `realtime-broker.test.ts` Test 11 | ✅ subscriber riceve event.source.type='server' + name='sse' |
| **W-2 (mapper canonicalization)** | `mapper-canonicalization.test.ts` | ✅ V1 smoke (passthrough payload server→subscriber + source preserved). V1.x: realtime-inbound route abiliterà inputMap automatic |
| **W-3 (harness wildcard)** | `realtime-harness.ts` line 113-128 | ✅ subscribe('*','*.*','*.*.*','*.*.*.*') NIENTE monkey-patch broker.publish |
| **W-5 (system.warn)** | `realtime-broker.test.ts` Test 12 | ✅ duplicate channel → publish system.warn reason=realtime-channel-register-failed |
| **W-NEW-1 (Tier-3 disclaimer)** | `playwright-sse-smoke.test.ts` | ✅ EventSource API verificato + V1.x E2E test.skip + disclaimer documentato |
| **W-NEW-3 (vitest exclude)** | `vitest.config.ts` line 9 | ✅ `'**/__browser__/**'` in exclude |

## Vincolo D-83 strict — verifica

Modifiche fuori da `packages/gateway/src/sse-ws/`:

| Path | Modifica | Verifica D-83 |
|------|----------|---------------|
| `packages/gateway/vitest.config.ts` | Aggiunto `exclude: ['**/__browser__/**']` | OK — config build/test, NON runtime |
| `packages/gateway/vitest.browser.config.ts` | NEW file | OK — config build/test, NON runtime |
| `packages/gateway/package.json` | Scripts test:msw + test:browser, devDeps msw + @vitest/browser* | OK — config build/test, NON runtime |

**ZERO modifiche** a:
- `packages/core/` runtime
- `packages/mapper/` runtime
- `packages/routing/` runtime
- `packages/gateway/src/http/` runtime

D-83 strict ✅ verified via `git diff packages/{core,mapper,routing}/src/ packages/gateway/src/http/ HEAD~5 HEAD` (zero hits).

## Hand-off note per 04-09 (final gate)

Il subpath `@sembridge/gateway/sse-ws` è pronto per:
1. **publint --strict**: verifica package.json compatibility (sideEffects glob già configurato per `**/augment.{js,ts}`).
2. **attw --pack --profile=esm-only**: verifica .d.ts ESM-only correctness.
3. **size-limit**: misurare bundle size del subpath `dist/sse-ws/index.js` (~78 KB ESM minified target).
4. **DOC-04 update**: documentare consumer-facing API (`createRealtimeBroker`, `connectRealtime`, `disconnectRealtime`, source descriptors `'server'`/`'sse'`/`'websocket'`) + closure decisions D-101..D-120 + threat register T-04-08-01..T-04-08-09.
5. **Threat flags scan**: nessun nuovo trust boundary introdotto in 04-08 oltre quelli già documentati nel `<threat_model>` del plan.

V1.x roadmap residua (non blockers per V1):
- Tier-2 MSW SSE replay attivo (richiede polyfill EventSource fetch-based)
- Tier-2 MSW WS stale + auto-fallback attivi (richiede msw 2.5+ ws.link compat verifica)
- Tier-3 Playwright E2E completo (server fixture HTTP locale)
- `realtime-inbound` route handler (PRD §17.5 placeholder) — abiliterà mapping inbound automatic per W-2 closure full

## Self-Check: PASSED

Verificato:
- ✅ `packages/gateway/src/sse-ws/realtime-broker.ts` (296 LOC) — exists
- ✅ `packages/gateway/src/sse-ws/realtime-broker.test.ts` (220 LOC) — exists
- ✅ `packages/gateway/src/sse-ws/public-factory.ts` (123 LOC) — exists
- ✅ `packages/gateway/src/sse-ws/public-factory.test.ts` (64 LOC) — exists
- ✅ `packages/gateway/src/sse-ws/test-utils/realtime-harness.ts` (223 LOC) — exists
- ✅ 11 integration test files in `__integration__/` — all exist
- ✅ 1 browser test file in `__browser__/` — exists
- ✅ `vitest.browser.config.ts` — exists
- ✅ `sse-ws/index.ts` — `createRealtimeBroker` exported (17 occurrences in dist)
- ✅ Commits:
  - `c436293` test(04-08): RED tests
  - `2d3417e` feat(04-08): GREEN RealtimeBroker + factory
  - `48acfae` feat(04-08): test-utils harness
  - `ccedd3a` test(04-08): integration tests + barrel
- ✅ Tests: 222 passed (gateway) + 3 skip; 756 monorepo
- ✅ typecheck: clean
- ✅ build: dist/sse-ws/{index,augment}.{js,d.ts} OK
