---
phase: 03-routing-server-gateway-http
plan: 07
subsystem: outcome-collector
tags:
  - outcome-collector
  - phase-3
  - routing
  - error-handling
  - sanitization
  - recursion-guard
  - network-error
  - life-02-cascade
dependency-graph:
  requires:
    - phase: 03-02
      provides: "@gluezero/routing types (RouteOutcome ok|error discriminated)"
    - phase: 03-05
      provides: "RouteResolver + CompiledRoute interface (definition, ownerId, priority)"
    - phase: 03-06
      provides: "RouteExecutor produce RouteOutcome consumato dal collector"
    - phase: 01
      provides: "@gluezero/core (BrokerError, BrokerEvent, EventTap, PipelineStep, PipelineSnapshot)"
  provides:
    - "OutcomeCollector class con collect + recursion guard (Set<eventId+suffix>) + topic resolution"
    - "OutcomeCollectorDeps interface (publishFn DI + tap opzionale)"
    - "PublishFn type signature (topic, payload, options)"
    - "deriveLoadedTopic + deriveFailedTopic helpers (convention `<prefix>.loaded`/`<prefix>.failed`)"
    - "sanitizeError helper (T-03-07-01 mitigation — rimuove originalError/cause/stack)"
    - "Tap step 10 'event.outcome.collected' emit PRE-publish (D-85, Pattern S3)"
    - "Pubblicazione network.error addizionale per category='network' (D-81)"
  affects:
    - "03-12 (RouterBroker wrapper): istanzia OutcomeCollector; bind publishFn a inner.publish del MapperBroker"
    - "03-13 (LIFE-02 cascade integration test): verifica end-to-end <topic>.failed shape D-80 ai subscriber"
    - "03-14 (final gate): coverage v8 ≥90% richiede test deterministici qui presenti"
tech-stack:
  added: []
  patterns:
    - "Pattern S2 (createBrokerError chain): tutti gli errori sanitized usano la shape standard di BrokerError di F1"
    - "Pattern S3 (EventTap step instrumentation): tap step 10 emit inline con try/catch swallow — replica F2 emitF2Tap (broker-mapper-wrapper.ts:325) e route-executor.emitTap. safeTapStep di core NON è esposto al barrel pubblico, quindi inline pattern preserva D-83 strict"
    - "Pattern S4 (Conditional spread per exactOptionalPropertyTypes: true): sanitizeError usa `...(field !== undefined && { field })` per evitare assegnazioni undefined esplicite"
    - "Recursion guard pattern (D-82, replica F2 handleMappingError): Set<eventId+suffix> con cleanup `finally` block. Suffix discrimina 'loaded' vs 'failed' per permettere transizioni semantic distinte"
    - "Sanitization pattern CR-06 (replica F2 broker-mapper-wrapper.ts:1042-1048): payload safe rimuove originalError, cause, stack. Solo code/category/message/details + ids pubblici"
    - "Topic resolution con override: route.publishes.success/error esplicito > convention `<prefix>.loaded`/`<prefix>.failed`. Convention rispetta multi-segmento (es. 'weather.alert.requested' → 'weather.alert.loaded')"
    - "Dependency Injection per publishFn: il collector NON conosce il broker; il RouterBroker plan 03-12 farà il bind. Permette test isolati con vi.fn()"
    - "Cast tipato isolato per shape D-80 esteso F3: campi httpStatus/retryAttempt/retryAfterMs non nativi al BrokerError di F1; lettura via `err as BrokerError & { ... }` documenta esplicitamente l'accesso esteso"
key-files:
  created:
    - "packages/routing/src/outcome-collector.ts"
    - "packages/routing/src/outcome-collector.test.ts"
  modified: []
key-decisions:
  - "**Recursion guard chiave `eventId::suffix`** invece di solo `eventId` (replica F2 pattern `sourceTopic::step`): permette di pubblicare DUE eventi distinti per lo stesso eventId quando uno è 'loaded' e un altro è 'failed' (caso impossibile in pratica ma garantisce robustezza). Blocca solo la re-entrata sul medesimo outcome — semantic identica al guard F2."
  - "**Sanitize esclude TRE campi** (originalError, cause, stack): replica esatta del pattern F2 CR-06. Verificato in Test 8: payload non contiene `originalError`, `cause`, né `stack`."
  - "**Tap step 10 emit inline** (try/catch swallow) invece di import da `safeTapStep` di core: `safeTapStep` non è esposto al barrel `@gluezero/core`. Esporlo violerebbe D-83 strict (no modifiche a packages/core/). Replica del pattern route-executor.ts:236-260 e F2 broker-mapper-wrapper.ts:325. Auditabile via grep."
  - "**Network.error pubblicato DOPO `<topic>.failed`** (mai prima, mai sostitutivo): D-81 stipula AGGIUNTIVO al BrokerEvent del topic family. Test 4 verifica entrambi i publish con ordine deterministico."
  - "**`publishFn` come DI callback** invece di referenza diretta al broker: mantiene D-83 (ZERO accesso a inner.publish dal collector). Il RouterBroker plan 03-12 farà il bind a `(t, p, o) => mapperBroker.publish(t, p, o)`. Permette test 100% isolati con `vi.fn()` mock."
  - "**Topic resolution multi-segmento** (`weather.alert.requested` → `weather.alert.loaded`): test 7 verifica esplicitamente. La logica `lastIndexOf('.')` + check su suffix `'requested'` gestisce correttamente i casi nested. Fallback `<topic>.loaded` per topic senza suffix `'requested'`."
metrics:
  duration: "~25min (TDD RED+GREEN+typecheck fix)"
  completed: "2026-04-30"
  test-count: 8
  test-pass-rate: "8/8 (100%)"
  total-routing-tests: "51/51 (43 baseline + 8 nuovi)"
  loc: 377
  files: 2
---

# Phase 03 Plan 07: OutcomeCollector step 10 — publish loaded/failed shape D-80, network.error, recursion guard

OutcomeCollector pubblica `<topic>.loaded` su success e `<topic>.failed` con shape sanitized D-80 su error UNA VOLTA SOLA tramite recursion guard `Set<eventId+suffix>`; per `category: 'network'` aggiunge un `network.error` addizionale come BrokerEvent CORE; tap step 10 `event.outcome.collected` emesso PRE-publish per Pattern S3.

## Tasks Completed

| Task | Name                                                                  | Commit    | Files                                                                          |
| ---- | --------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------ |
| 1    | outcome-collector.ts con collect + recursion guard + tap step 10 (RED) | `95b7581` | packages/routing/src/outcome-collector.test.ts (287 LOC, 8 test)               |
| 1    | outcome-collector.ts con collect + recursion guard + tap step 10 (GREEN) | `b00d1af` | packages/routing/src/outcome-collector.ts (377 LOC)                            |

## Test Results

```
Test Files  1 passed (1)
     Tests  8 passed (8)
```

8/8 test del file `outcome-collector.test.ts` passing:

1. **Test 1**: `outcome.ok` → publishFn invocato con `<topic-prefix>.loaded` + canonicalPayload + metadata
2. **Test 2**: `outcome.ok` con `route.publishes.success: 'weather.fresh'` → override convention
3. **Test 3**: `outcome.error category='validation'` → `<topic-prefix>.failed` + payload BrokerError shape D-80
4. **Test 4**: `outcome.error category='network'` → DUE publishFn calls (`<topic-prefix>.failed` + `network.error` D-81)
5. **Test 5**: due `collect` consecutivi con stesso eventId → solo UNA publishFn call (recursion guard D-82)
6. **Test 6**: tap.onPipelineStep invocato con `'event.outcome.collected'` PRIMA del publish
7. **Test 7**: topic prefix resolution multi-segmento (`weather.alert.requested` → `weather.alert.loaded`/`weather.alert.failed`)
8. **Test 8**: `outcome.error` con `originalError` → payload sanitized SENZA stack/originalError ma CON code/category/message/details

**Suite completa @gluezero/routing**: 51/51 passing (43 baseline + 8 nuovi). Zero regressioni.

## REQ-IDs Coverage

- **ROUTE-12**: `<topic>.failed` automatico su errore route HTTP — collector pubblica UNA volta con shape D-80 (Test 3, 4, 7, 8)
- **ERR-02 ext** (Phase 3): `<topic>.failed` con BrokerError shape standard + `network.error` come BrokerEvent CORE separato per `category='network'` (Test 3, 4)
- **LIFE-02 ext** (Phase 3 — partial): recursion guard previene loop publish→handler→collect→publish per stesso outcome. La cascade abort completa è plan 03-12 (RouterBroker.unregisterPlugin)

## Decisions Closed

### D-80 — `<topic>.failed` shape standard
**Status: CLOSED**. La factory `createBrokerError` di F1 fornisce già la shape autoritativa con campi `code/message/category/routeId/topic/eventId/originalError/cause/details`. I campi estesi F3 `httpStatus/retryAttempt/retryAfterMs` (non nativi al `BrokerError` di F1) vengono letti via cast tipato isolato `err as BrokerError & { httpStatus?: number; ... }` — pattern documentato e auditabile via grep.

### D-81 — `network.error` BrokerEvent CORE separato
**Status: CLOSED**. Pubblicato DOPO `<topic>.failed` quando `error.category === 'network'`. Test 4 verifica entrambi i publish con ordine deterministico:
1. Primo: `weather.failed` con shape D-80
2. Secondo: `network.error` con stessa shape sanitized

### D-82 — NO double publish
**Status: CLOSED**. Recursion guard `Set<eventId+suffix>` previene re-entry sincrona sullo stesso outcome. Pattern replica F2 `handleMappingError` con `Set<sourceTopic::step>`. Cleanup garantito via `finally` block (T-03-07-02 mitigation).

### D-85 — Tap step 10 PRE-publish
**Status: CLOSED**. `event.outcome.collected` emesso PRIMA della chiamata a `publishFn`. Test 6 verifica esplicitamente l'ordine via `callOrder` array (`['tap:event.outcome.collected', 'publish']`).

## Sanitization Shape Esplicita

Il `sanitizeError(err: BrokerError): SanitizedError` produce questa shape pubblica (T-03-07-01 mitigation):

```typescript
{
  code: string             // SEMPRE presente
  category: string         // SEMPRE presente
  message: string          // SEMPRE presente
  routeId?: string         // se presente nell'errore originale
  topic?: string           // se presente nell'errore originale
  eventId?: string         // se presente nell'errore originale
  httpStatus?: number      // F3 esteso, via cast (non nativo F1)
  retryAttempt?: number    // F3 esteso, via cast (non nativo F1)
  retryAfterMs?: number    // F3 esteso, via cast (non nativo F1)
  details?: Record<string, unknown>  // se presente nell'errore originale
}
```

**Mai inclusi nel payload published**:
- `originalError` (Error reference — può contenere stack ricorsivi)
- `cause` (ES2022 chain — può contenere reference circolari)
- `stack` (Error stack trace — information disclosure)

Test 8 verifica esplicitamente l'assenza di questi 3 campi via `expect.not.toHaveProperty(...)`.

## Threat Model Coverage

| Threat ID | Disposition | Mitigation Implementata |
|-----------|-------------|--------------------------|
| T-03-07-01 | mitigate | `sanitizeError` esclude originalError/cause/stack — Test 8 |
| T-03-07-02 | mitigate | recursion guard `Set<eventId+suffix>` con `finally` cleanup — Test 5 |
| T-03-07-03 | accept | Topic naming validato a valle dal `bus.publish` (F1 validateTopic regex). Collector è plugin authority — non valida |

## Vincoli D-83 Confermati

`git diff --name-only HEAD~2 HEAD` → SOLO `packages/routing/src/outcome-collector{.test,}.ts`.
**ZERO modifiche** a `packages/core/` e `packages/mapper/` runtime. Vincolo D-83 strict rispettato:
- `safeTapStep` di core replicato inline (try/catch swallow)
- `publishFn` callback iniettato (no accesso diretto a `inner.publish`)
- Shape D-80 esteso F3 letta via cast tipato isolato (no augmentation a `packages/core/types/error.ts`)

## Verification

- [x] 8/8 test passing (`pnpm --filter @gluezero/routing test outcome-collector.test.ts`)
- [x] 51/51 test routing totale (43 baseline + 8 nuovi, zero regressioni)
- [x] `tsc --noEmit` exit 0 (`pnpm --filter @gluezero/routing typecheck`)
- [x] 0 changes a `packages/core/` e `packages/mapper/` runtime
- [x] `class OutcomeCollector` presente nel file (grep ok)
- [x] `network.error` literal presente (D-81 confermato)
- [x] `deriveLoadedTopic` + `deriveFailedTopic` helpers esposti
- [x] `inFlightPublishes` recursion guard membro privato (D-82 confermato)
- [x] `event.outcome.collected` tap step emesso (D-85 confermato)
- [x] LOC 377 ≥ 120 minimum richiesto

## Deviations from Plan

**None** — plan eseguito esattamente come scritto. Unico fix automatico:

### Auto-fixed Issues

**1. [Rule 1 - Bug] TS4111 index signature access**
- **Found during:** Task 1 GREEN (post-implementation typecheck)
- **Issue:** `metadata.errorCode` e `metadata.errorCategory` violavano `noPropertyAccessFromIndexSignature` su un `Record<string, unknown>`
- **Fix:** sostituito con bracket notation `metadata['errorCode']` / `metadata['errorCategory']`
- **Files modified:** packages/routing/src/outcome-collector.ts
- **Commit:** b00d1af (incluso nel commit GREEN — fix pre-commit prima del commit finale)

## Self-Check: PASSED

**Files created:**
- [x] FOUND: packages/routing/src/outcome-collector.ts (377 LOC)
- [x] FOUND: packages/routing/src/outcome-collector.test.ts (287 LOC)

**Commits:**
- [x] FOUND: 95b7581 (test RED — `test(03-07): aggiunge test RED per OutcomeCollector`)
- [x] FOUND: b00d1af (feat GREEN — `feat(03-07): implementa OutcomeCollector step 10 pipeline §28`)

**Verifiche grep:**
- [x] `class OutcomeCollector` presente
- [x] `network.error` presente (D-81)
- [x] `deriveLoadedTopic` + `deriveFailedTopic` presenti
- [x] `inFlightPublishes` presente (recursion guard D-82)
- [x] `event.outcome.collected` presente (tap step 10 D-85)

## TDD Gate Compliance

- [x] **RED gate**: commit `test(03-07): ...` (95b7581) precede l'implementazione
- [x] **GREEN gate**: commit `feat(03-07): ...` (b00d1af) successivo, test che prima fallivano ora passano
- [x] No REFACTOR commit necessario — implementazione pulita al primo passaggio (eccetto fix typecheck includere nel GREEN commit)
