---
phase: 01-core-essenziale
plan: 07
subsystem: core-event-bus
tags:
  - event-bus
  - dispatch
  - handler-isolation
  - tap-orchestration
  - tdd
dependency-graph:
  requires:
    - broker-error-factory
    - is-broker-error-type-guard
    - deep-freeze-runtime
    - noop-event-tap
    - safe-tap-step-helper
    - topic-trie
    - validate-event-valibot
    - broker-event-type
    - subscription-type
    - subscribe-options-type
    - broker-logger-type
    - event-tap-type
  provides:
    - event-bus-class
    - event-bus-options-interface
    - event-bus-stats-interface
  affects:
    - phase-1-broker-public-api-plan-08
    - phase-1-plugin-registry-plan-08
tech-stack:
  added: []
  patterns:
    - tdd-red-green-per-plan
    - queue-microtask-async-delivery
    - try-catch-handler-isolation-with-system-error-publish
    - promise-catch-async-handler-isolation
    - abort-signal-hookup-event-listener
    - conditional-spread-exact-optional-property-types
    - getter-based-subscription-handle
    - deferred-system-error-via-queue-microtask
    - debug-mode-toggle-deep-freeze
key-files:
  created:
    - packages/core/src/core/bus.ts
    - packages/core/src/core/bus.test.ts
  modified: []
decisions:
  - "Test 'preserves BrokerError when handler throws one (no re-wrap)' aggiunto come Rule 2 (auto-add critical). Lo snippet handleHandlerError usa `isBrokerError(err) ? err : createBrokerError(...)` per preservare semantica originale di BrokerError lanciato dall'handler, ma il PLAN <behavior> non lo verificava esplicitamente. Test esplicita che un handler che throw `BrokerError` con code custom NON viene re-wrappato in `plugin.handler.failed` — il `payload.error.code` rimane `'custom.preserved'`. Razionale: contratto pubblico documentato implicitamente dallo snippet, ora coperto da gate TDD."
  - "Test 'invalid event does not emit event.delivered tap' aggiunto come Rule 2. Il PLAN <behavior> elenca 'tap.event.delivered NON chiamato' in modo descrittivo dentro il test 'validateEvent fail at publish', ma è più pulito separare il check sui tap dal check su isBrokerError. Verifica esplicitamente che né `event.validated` né `event.delivered` siano emessi quando lo step 3 throw."
  - "Test 'remote fallback to async + warn (D-03)' aggiunto come gemello del test 'worker fallback'. Lo snippet del PLAN testava solo `deliveryMode: 'worker'`, ma D-03 enumera entrambi `worker` e `remote` come fallback in F1. Coverage parità tra i due valori."
  - "Test 'returns 0 if no subscription matches the ownerId' aggiunto come edge case di unsubscribeByOwner — il PLAN testava solo il path positivo (3 + 2 owner). Verifica che il return type `number` sia coerente anche per il caso vuoto (zero subscription matched), non `undefined`."
  - "Test 'getStats reports topics and subscriber counts' aggiunto come Rule 2 — il PLAN elenca `getStats` nel verifica di unsubscribeByOwner ma non ne testa autonomamente la shape. Verifica esplicita: `topics`, `subscriberCount[topic]`, `pendingAsyncDelivery: 0` in steady state."
  - "Test 'setDebugMode toggles debug mode at runtime' aggiunto come Rule 2 — `setDebugMode` è esportato come metodo pubblico (RESEARCH snippet) ma non testato in PLAN <behavior>. Test verifica che il toggle a runtime cambia comportamento del freeze (mutable → frozen) tra publish successivi."
  - "Biome auto-fix `useOptionalChain` applicato manualmente in fase di lint: `if (!sub || !sub.active)` → `if (!sub?.active)` in unsubscribeInternal. Biome lo classifica come 'unsafe fix' (non auto-applicato dal --write) perché in casi generici l'optional chaining cambia semantica di lookup proprietà; in questo caso specifico (sub è `InternalSubscription | undefined` ottenuto da Map.get) i due rami sono semanticamente equivalenti. Applicato per parità di lint output con i moduli Wave 3 (zero warning)."
  - "Pattern `exactOptionalPropertyTypes`: `ownerId` in InternalSubscription assegnato via conditional spread `...(ownerId !== undefined && { ownerId })`; `originalError` in createBrokerError call site idem. Devia dallo snippet RESEARCH che usava `ownerId: ownerId ?? ''` (stringa vuota) — pattern errato per `exactOptionalPropertyTypes: true` perché `ownerId === ''` non è equivalente a `'ownerId' in sub === false`. Il test 'unsubscribeByOwner ritorna 0 per owner non matched' verifica indirettamente che la stringa vuota non venga confusa con un ownerId reale."
  - "system.error sempre pubblicato via queueMicrotask anche se l'handler originale era sync. Razionale: previene recursion durante la consegna corrente (T-07-03). Conseguenza testabile: i test 'handler isolation' richiedono `await flush(); await flush()` (due microtask flush) — il primo flush esegue il queueMicrotask del system.error publish, il secondo flush esegue il dispatchAsync di system.error verso i suoi subscriber."
  - "`once: true` applicato DOPO successful invocation (riga 217 bus.ts: `if (sub.options.once && sub.active)`). Razionale (decisione plan 03): se applicato PRIMA dell'handler, un handler che throw lascerebbe la subscription in stato active inconsistente; applicarlo DOPO garantisce che il primo evento sia comunque consegnato anche se l'handler successivamente throw nello stesso tick (in tal caso il system.error queueMicrotask schedula la pubblicazione ma la subscription è già unsubscribed)."
metrics:
  duration: "~12m wall-clock"
  completed: "2026-04-28T22:54:00+02:00"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
  commits: 2
  tests_added: 25
  tests_passing: 25
  lines_of_code: 693
---

# Phase 1 Plan 07: EventBus Core Summary

Implementato `EventBus` (`bus.ts`) — il cuore del broker GlueZero: dispatch pub/sub con handler isolation try/catch (sync) + `.catch()` (async), tap orchestration sui 5 step F1 della pipeline §28, delivery semantics `async` (default via `queueMicrotask`) / `sync` (immediate) / `worker`+`remote` (fallback async + warn `mapping.delivery.fallback`), AbortSignal-first subscribe (auto-unsubscribe su abort), `Subscription.unsubscribe()` idempotente, `SubscribeOptions.once` (single-invocation), `unsubscribeByOwner(ownerId): number` (cascade plugin cleanup), e `deepFreeze` opt-in in debug mode. Pattern TDD RED→GREEN preservato: 1 commit `test(01-07)` + 1 commit `feat(01-07)`. Coverage REQ-IDs: CORE-01 ✓, CORE-09 ✓, CORE-12 ✓, ERR-03 ✓ (più D-01, D-02, D-03, D-04, D-16, D-20, D-26, D-27).

## Objective Achieved

L'obiettivo del plan 01-07 è raggiunto integralmente:

- **2 file creati** in `packages/core/src/core/` (1 source 291 LOC + 1 test 402 LOC, 693 LOC totali)
- **`pnpm --filter @gluezero/core test`** esce 0 e riporta `Test Files 10 passed (10) | Tests 159 passed (159)` in 545 ms (suite cumulativa post-Wave-4 = 9 test files Wave 3 + 1 nuovo `bus.test.ts`)
- **`pnpm --filter @gluezero/core typecheck`** esce 0 (no TS errors, isolatedDeclarations conforme)
- **`pnpm biome check packages/core/src/core/`** esce 0 (20 file checked, 0 errori, 0 warning)
- **TDD pattern RED→GREEN** preservato: 1 commit `test(01-07): aggiunge test RED ...` precede il commit `feat(01-07): implementa ...` corrispondente
- **5 step pipeline F1** emessi al tap nell'ordine corretto (verificato dal test "invokes tap on all 5 F1 steps in order")
- **Threat T-07-02..T-07-06** mitigati (vedi sezione Threat Surface Scan)
- **`bus.ts` NON esportato da `packages/core/src/index.ts`** — coerente col mandato del prompt orchestrator (export pubblico è compito plan 08)

## Tasks Executed

| #   | Name                                                                          | Commit RED | Commit GREEN | Status |
| --- | ----------------------------------------------------------------------------- | ---------- | ------------ | ------ |
| 1+2 | bus.ts EventBus + bus.test.ts unit suite (CORE-01, CORE-09, CORE-12, ERR-03)  | `d328a96`  | `9189a03`    | done   |

NOTA: il PLAN suddivideva in 2 task separati ("Task 1: bus.ts impl" e "Task 2: bus.test.ts suite") ma la natura TDD richiede il test (RED) PRIMA dell'implementazione (GREEN). Ho quindi invertito l'ordine logico — committato prima `bus.test.ts` (RED gate verificato: import `./bus` falliva con errore Vite) poi `bus.ts` (GREEN gate verificato: 25/25 test passing). Numerazione commit RED/GREEN identica al pattern dei plan 04, 05, 06.

## Files Created

**Source module (1 file, 291 LOC):**

- `packages/core/src/core/bus.ts` (291 LOC) — esporta `class EventBus`, `interface EventBusOptions`, `interface EventBusStats`. API pubblica: `publish<T>(event: BrokerEvent<T>): void`, `subscribe(pattern, handler, options?, ownerId?): Subscription`, `unsubscribeByOwner(ownerId): number`, `getStats(): EventBusStats`, `setDebugMode(enabled): void`. API privata: `unsubscribeInternal`, `dispatchSync`, `dispatchAsync`, `runHandler`, `handleHandlerError`, `freezeForDelivery`, `snap`. Composta da: `nanoid` (id factory per system.error events), `TopicTrie<InternalSubscription>` (dispatch wildcard), `Map<id, InternalSubscription>` (handle index), `validateEvent` (step 3), `safeTapStep` (5 step F1), `deepFreeze` (debug mode), `createBrokerError` + `isBrokerError` (handler isolation system.error wrap).

**Test suite (1 file, 402 LOC, 25 test):**

- `packages/core/src/core/bus.test.ts` (402 LOC, **25 test** in 10 describe block):
  - `EventBus.publish + subscribe (CORE-01)` (6 test): sync delivery, wildcard match (CORE-09), async deferred to microtask (D-01), worker fallback (D-03), remote fallback (D-03), FIFO order under async
  - `Subscription handle (D-27)` (3 test): unsubscribe idempotente, expone id/topic/active, after-unsubscribe no-invoke
  - `AbortSignal hookup (D-26)` (1 test): auto-unsubscribe su `ac.abort()`
  - `Handler isolation (CORE-12, ERR-03, D-16)` (3 test): sync handler throw → broker non collassa + system.error pubblicato (con `error.code`, `error.category`, `originalEventId`, `originalTopic`); async handler rejected Promise → caught; preserve BrokerError no-rewrap quando handler throw BrokerError direttamente
  - `Tap orchestration — 5 F1 steps (CORE-13, D-20)` (3 test): tutti 5 step nell'ordine corretto, `event.delivered` snapshot include `metadata.subscriberCount`, tap che throw NON rompe la pipeline (D-20)
  - `Debug mode + deep-freeze (D-04)` (2 test): debug:true → TypeError on mutation; debug:false → mutable
  - `unsubscribeByOwner` (2 test): rimuove 3 sub di p1 + ritorna 3, ritorna 0 per owner non matched
  - `once option (plan 03)` (1 test): handler invocato max 1 volta dopo 2 publish
  - `validation failure at publish (VAL-01)` (2 test): invalid event throws BrokerError + handler not invoked, validation fail NON emette tap event.validated/event.delivered
  - `getStats` (1 test): topics/subscriberCount/pendingAsyncDelivery in steady state
  - `setDebugMode` (1 test): toggle a runtime cambia comportamento freeze

## Verification Results

### Acceptance criteria Task 1 (bus.ts)

- [x] File `packages/core/src/core/bus.ts` esiste, esporta `EventBus` class
- [x] File contiene `queueMicrotask` (D-01) — verificato grep
- [x] File chiama `safeTapStep` con tutti e 5 i step F1: `event.received`, `event.metadata.enriched`, `event.validated`, `event.dedupe.checked`, `event.delivered` — verificati 5 grep + test "invokes tap on all 5 F1 steps in order"
- [x] File contiene metodo `unsubscribeByOwner(ownerId): number` (per cascade in plan 08)
- [x] File pubblica `system.error` in handler isolation (CORE-12) — verificato grep `'system.error'` + test "sync handler that throws does not crash broker"
- [x] File logga warning `mapping.delivery.fallback` per `worker`/`remote` deliveryMode (D-03) — verificato grep + 2 test
- [x] Idempotenza unsubscribe: `unsubscribeInternal` ha early return su `!sub?.active` (D-27)
- [x] `pnpm --filter @gluezero/core typecheck` esce 0 (no TS errors)

### Acceptance criteria Task 2 (bus.test.ts)

- [x] File `packages/core/src/core/bus.test.ts` esiste con **25 test cases** (target ≥ 16)
- [x] Test verifica: 5 step pipeline F1 invocati in ordine via tap spy ✓
- [x] Test verifica: handler throw → broker continua + system.error pubblicato dopo microtask ✓
- [x] Test verifica: async handler rejected Promise → caught ✓
- [x] Test verifica: deliveryMode 'worker' E 'remote' → warn 'mapping.delivery.fallback' ✓
- [x] Test verifica: AbortSignal hookup (auto-unsubscribe su abort) ✓
- [x] Test verifica: unsubscribeByOwner ritorna count corretto + 0 per owner non matched ✓
- [x] Test verifica: `once: true` (single invocation) ✓
- [x] Test verifica: deep-freeze in debug mode, NOT in production ✓
- [x] Test verifica: validateEvent fail al publish ✓
- [x] `pnpm --filter @gluezero/core test bus` esce 0 con tutti i 25 test passing
- [x] Suite completa post-plan 07: `pnpm --filter @gluezero/core test` riporta `Test Files 10 passed` (4 plan04 + 3 plan05 + 2 plan06 + 1 plan07)

### Plan-wide verification

- [x] `packages/core/src/core/bus.ts` esiste con `EventBus` class (291 LOC, target ≥ 150)
- [x] `packages/core/src/core/bus.test.ts` esiste con 25 test cases (target ≥ 16)
- [x] `pnpm --filter @gluezero/core test bus` esce 0 → `Test Files 1 passed (1) | Tests 25 passed (25)`
- [x] `pnpm --filter @gluezero/core typecheck` esce 0
- [x] `pnpm biome check packages/core/src/core/bus.ts packages/core/src/core/bus.test.ts` esce 0 (zero warning, zero errori)
- [x] Suite completa post-Wave-4: `Test Files 10 passed | Tests 159 passed`
- [ ] Coverage v8 ≥ 90% su bus.ts — **NON MISURATA** (open item ereditato da plan 04: missing dep `@vitest/coverage-v8`); surrogate confidence: 25 test isolati con behavior coverage esplicito sui 5 step pipeline + 4 delivery modes + handler isolation sync+async + abort signal + once + unsubscribeByOwner + getStats + setDebugMode

## Final test output

```
> @gluezero/core@0.0.0 test
> vitest run --passWithNoTests

 RUN  v4.1.5 packages/core

 Test Files  10 passed (10)
      Tests  159 passed (159)
   Start at  22:54:10
   Duration  545ms (transform 351ms, setup 0ms, import 471ms, tests 43ms, environment 3.74s)
```

I 10 file di test corrispondono a:
- Plan 04: `broker-error.test.ts`, `deep-freeze.test.ts`, `logger.test.ts`, `event-tap.test.ts` (42 test)
- Plan 05: `topic-matcher.test.ts`, `event-factory.test.ts`, `event-validator.test.ts` (55 test)
- Plan 06: `topic-registry.test.ts`, `lifecycle.test.ts` (37 test)
- Plan 07: `bus.test.ts` (25 test) ← **nuovo**

## Deviations from Plan

### Auto-added (Rule 2 — missing critical / coverage gap)

**1. Test "preserves BrokerError when handler throws one (no re-wrap)"**

- **Found during:** Task 2 redazione test
- **Issue:** Lo snippet `handleHandlerError` usa `isBrokerError(err) ? err : createBrokerError(...)` — preserva BrokerError originale lanciato dall'handler invece di wrappare. Il PLAN `<behavior>` non testava esplicitamente questo comportamento. Senza test, una regressione futura potrebbe re-wrappare silenziosamente il BrokerError perdendo la `code` originale.
- **Fix:** Aggiunto test che lancia un BrokerError-like Error (con `code='custom.preserved'`, `category='plugin'`, `name='BrokerError'`) e verifica che `system.error.payload.error.code === 'custom.preserved'` (no rewrap a `plugin.handler.failed`).
- **Files modified:** `packages/core/src/core/bus.test.ts`
- **Commit:** `d328a96`

**2. Test "invalid event does not emit event.delivered tap"**

- **Found during:** Task 2 redazione test
- **Issue:** Il PLAN `<behavior>` elenca "tap.event.delivered NON chiamato" all'interno del test "validateEvent fail at publish", ma il check sui tap NON era separato dal check su `isBrokerError`. Granularità ridotta complica diagnostica futura.
- **Fix:** Decomposto in test indipendente: tap spy raccoglie `steps[]`, dopo publish con event invalid (id vuoto) verifica `steps NOT contain 'event.validated' AND NOT contain 'event.delivered'`. Verifica esplicita che lo step 3 throw blocca tap emission verso il flusso normale.
- **Files modified:** `packages/core/src/core/bus.test.ts`
- **Commit:** `d328a96`

**3. Test "remote fallback to async + warn (D-03)"**

- **Found during:** Task 2 redazione test
- **Issue:** Lo snippet `<action>` del PLAN testava solo `deliveryMode: 'worker'` per il fallback. D-03 enumera entrambi `worker` E `remote` come modi non implementati in F1. Senza test su `'remote'`, una regressione futura potrebbe rompere la parità senza essere rilevata.
- **Fix:** Aggiunto test gemello con `deliveryMode: 'remote'` che verifica `warn` invocato con `mode: 'remote', fallback: 'async'` + handler comunque invocato dopo flush.
- **Files modified:** `packages/core/src/core/bus.test.ts`
- **Commit:** `d328a96`

**4. Test "returns 0 if no subscription matches the ownerId" (edge case)**

- **Found during:** Task 2 redazione test
- **Issue:** Il PLAN testava solo path positivo `unsubscribeByOwner('p1') === 3`. Se l'implementazione iniziasse il counter a `undefined` invece di `0`, o se il for loop avesse early return errato, il caso "no matches" passerebbe silenziosamente con un valore non-numerico.
- **Fix:** Aggiunto test `unsubscribeByOwner('unknown') === 0` con bus che ha 1 sub registrata su un altro owner.
- **Files modified:** `packages/core/src/core/bus.test.ts`
- **Commit:** `d328a96`

**5. Test "getStats reports topics and subscriber counts"**

- **Found during:** Task 2 redazione test
- **Issue:** Il PLAN usa `getStats()` come sub-check del test `unsubscribeByOwner` (`expect(bus.getStats().topics.length).toBe(2)`) ma non testa autonomamente la shape di `EventBusStats`. Il return type `{ topics, subscriberCount, pendingAsyncDelivery }` non era verificato.
- **Fix:** Aggiunto test che subscribe 2 sub su `'a.b'` + 1 su `'c.d'`, verifica `stats.topics.sort() === ['a.b', 'c.d']`, `stats.subscriberCount['a.b'] === 2`, `stats.subscriberCount['c.d'] === 1`, `stats.pendingAsyncDelivery === 0`.
- **Files modified:** `packages/core/src/core/bus.test.ts`
- **Commit:** `d328a96`

**6. Test "setDebugMode toggles debug mode at runtime"**

- **Found during:** Task 2 redazione test
- **Issue:** `setDebugMode(enabled): void` è metodo pubblico esportato (RESEARCH snippet) ma il PLAN `<behavior>` non lo testava. Senza test, una regressione futura potrebbe rendere `setDebugMode` no-op (es. dimenticando `this.debugMode = enabled`).
- **Fix:** Aggiunto test che inizia con `debug:false`, conferma mutation OK, chiama `setDebugMode(true)`, conferma mutation throws TypeError sul publish successivo.
- **Files modified:** `packages/core/src/core/bus.test.ts`
- **Commit:** `d328a96`

### Auto-applied formatting (Rule 1 — Biome lint)

**7. Biome auto-format multi-line method signatures + useOptionalChain**

- **Found during:** Post-implementazione GREEN — `pnpm biome check` ha emesso 1 errore (formatter: 4 multi-line signature collassate a single-line) + 1 warning fixable (lint/complexity/useOptionalChain su `unsubscribeInternal`).
- **Issue:** Lo stile multi-line di `safeTapStep(...)` (3 chiamate), `dispatchSync(...)`, `dispatchAsync(...)`, `result.catch(...)`, `handleHandlerError(...)` era manualmente spezzato per leggibilità soggettiva. Biome ha unificato a single-line dentro line-length limit. Inoltre Biome ha suggerito `if (!sub?.active) return` invece di `if (!sub || !sub.active) return` (semanticamente equivalente — Map.get ritorna `T | undefined`).
- **Fix:** `pnpm biome check --write` ha auto-applicato il formatter. Il fix `useOptionalChain` (classificato unsafe per Biome perché in casi generici l'optional chaining cambia semantica di lookup proprietà) è stato applicato manualmente per parità di lint output con i moduli Wave 3 (zero warning).
- **Files modified:** `packages/core/src/core/bus.ts`
- **Commit:** `9189a03`

### Architectural Decisions

Nessuna — niente Rule 4 incontrata. Tutti i comportamenti del PLAN snippet RESEARCH si sono dimostrati corretti contro i contratti reali delle utility delivered da Wave 3 (validateEvent shape, TopicTrie API, BrokerEvent schema, BrokerLogger surface). L'unica deviazione concettuale rispetto allo snippet RESEARCH (`exactOptionalPropertyTypes` policy: spread invece di `?? ''`) era già esplicitamente richiesta dal PLAN action note.

## Authentication Gates

Nessun auth gate (operazioni esclusivamente locali: edit file, lint, typecheck, test, git commit).

## Threat Surface Scan

Threat model del plan 07 confermato. Mitigazioni applicate:

- **T-07-01** (DoS — Plugin handler infinite loop blocca event loop): ACCEPT in F1. Niente timeout su handler in F1 (deferred a F3 routes); broker non può proteggere da CPU-bound infinite loop nel single-thread JS. Documentato in modulo header. ✓
- **T-07-02** (DoS — Plugin handler ricorsivamente publica stesso topic): MITIGATE. Default `deliveryMode: 'async'` via `queueMicrotask` (D-01) — la consegna avviene su microtask separato dal publish, lo stack si svuota tra publish e dispatch. Test "FIFO order under async delivery" verifica che 3 publish consecutivi non si stack-overflow. ✓
- **T-07-03** (DoS — system.error pubblicato in handler isolation causa nuova handler error → recursion): MITIGATE. `system.error` pubblicato in `queueMicrotask` (defer); fallback `logger.error('Failed to publish system.error')` se la pubblicazione stessa fallisce (es. validateEvent throw — no retry). Test "sync handler that throws does not crash broker" verifica due flush microtask senza stack overflow. ✓
- **T-07-04** (Tampering — Subscriber muta event.payload condiviso): MITIGATE in dev mode. `freezeForDelivery` chiama `deepFreeze(payload)` + `deepFreeze(metadata)` + `Object.freeze(event)` quando `debugMode: true`. Test "debug:true freezes payload before delivery" verifica TypeError su mutation; test "debug:false does not freeze" verifica disattivazione in production per perf. ✓
- **T-07-05** (Information disclosure — system.error payload include originalError che può contenere PII): ACCEPT (per design — debugging utility; consumer è responsabile di filtrare PII prima di esporre). Documentato in modulo header. ✓
- **T-07-06** (DoS — Tap throw nel hot-path delivery degrada performance): MITIGATE. `safeTapStep` con try/catch esplicito (D-20); errori swallow non propagano. Test "a tap that throws does not break the pipeline (D-20)" verifica che il publish completi normalmente e l'handler venga invocato. ✓
- **T-07-07** (Tampering — Plugin handler unsubscribe altri handler cross-plugin): ACCEPT in F1. F1 espone `unsubscribeByOwner` come metodo del bus (chiamato da plugin-registry plan 08); plugin handler non hanno accesso diretto al bus interno via PluginContext (deferred a F2). ✓
- **T-07-08** (Spoofing — Plugin handler publica con `source.type: 'system'` impersonando broker): ACCEPT in F1. Niente enforcement di ownership di `source.id` (deferred a F2 con plugin-scoped publish wrapper). ✓

Nessun nuovo threat surface introdotto fuori dal `<threat_model>` del plan.

## Open Items

Open item ereditato da plan 04 (non risolto in plan 07):
- **Coverage v8 measurement**: install `@vitest/coverage-v8` (devDependency root) e ri-eseguire `pnpm --filter @gluezero/core test:coverage` al termine di Wave 4 per verificare il target ≥ 90% sui file `core/`. Non bloccante per F1 progress; surrogate confidence: 159 test passing su 10 moduli isolati con behavior coverage esplicito.

Nessun altro open item sul plan 07. Tutti i comportamenti elencati nel PLAN `<behavior>` sono coperti da test, e i 6 test extra Rule 2 estendono la copertura ai contratti documentati implicitamente dallo snippet RESEARCH.

## Ready For

**Wave 5 — plan 08** (Broker class composition + PluginRegistry + public-factory + index.ts):
- Composerà `EventBus` con `TopicRegistry` (plan 06) e `PluginRegistry` (nuovo in plan 08)
- Userà `EventBus.subscribe(pattern, handler, options, ownerId)` con `ownerId = pluginId` per associare ogni subscription al plugin owner
- Userà `EventBus.unsubscribeByOwner(pluginId)` per cascade unsubscribe alla rimozione/destruction del plugin (chiusura LIFE-02)
- Userà `transitionState(reg, target, logger)` + `VALID_TRANSITIONS` (plan 06) per orchestrare lo stato dei plugin
- Esporrà `getDebugSnapshot()` e `getEventBus().getStats()` come parte della public API debug (TOOL-01..TOOL-04)
- Esporterà `Broker`, `EventBus`, `TopicRegistry`, `PluginRegistry`, factory `createBroker(options)` da `packages/core/src/index.ts`

L'API pubblica del bus consumata da plan 08 è tutta presente:
- `new EventBus(logger, tap, options)` — costruttore
- `bus.publish<T>(event)` — hot path
- `bus.subscribe(pattern, handler, options, ownerId)` — registrazione subscription
- `bus.unsubscribeByOwner(ownerId): number` — cascade cleanup
- `bus.getStats(): EventBusStats` — debug snapshot
- `bus.setDebugMode(enabled)` — toggle dev mode

## Self-Check: PASSED

**Files verified (created):**

- FOUND: `packages/core/src/core/bus.ts`
- FOUND: `packages/core/src/core/bus.test.ts`

**Commits verified (2 — RED+GREEN):**

- FOUND: `d328a96` test(01-07): aggiunge test RED per EventBus dispatch + handler isolation + tap orchestration
- FOUND: `9189a03` feat(01-07): implementa EventBus dispatch + handler isolation + tap orchestration (CORE-01, CORE-09, CORE-12, ERR-03)

**Test verified:**

- 10 Test Files passed (cumulativo Wave 3 + Wave 4)
- 159 Tests passed (di cui 25 nuovi da plan 07)
- 0 TS errors (`tsc --noEmit`)
- 0 Biome lint/format issues (`biome check packages/core/src/core/`)
