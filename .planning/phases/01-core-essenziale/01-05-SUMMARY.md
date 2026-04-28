---
phase: 01-core-essenziale
plan: 05
subsystem: core-utilities-batch-B
tags:
  - utilities
  - foundation
  - tdd
  - topic-matcher
  - trie
  - event-factory
  - event-validator
  - valibot
  - nanoid
dependency-graph:
  requires:
    - core-public-types-barrel
    - broker-error-factory
  provides:
    - validate-topic
    - validate-topic-pattern
    - topic-trie
    - create-broker-event-factory
    - publish-params-interface
    - validate-event-valibot
  affects:
    - phase-1-bus-ts-plan-07
    - phase-1-broker-public-api-plan-08
    - phase-2-canonical-mapper-payload-validation
tech-stack:
  added:
    - "nanoid 5.1.9 (id generation in event-factory)"
    - "valibot 1.3.1 (BrokerEvent shape validation in event-validator)"
  patterns:
    - tdd-red-green-per-task
    - segmented-trie-wildcard-matching
    - dual-regex-topic-vs-pattern
    - depth-first-cleanup-on-remove
    - exact-optional-property-types-via-conditional-spread
    - cast-as-never-for-deep-readonly-bypass-at-creation
    - valibot-safe-parse-with-broker-error-wrap
key-files:
  created:
    - packages/core/src/core/topic-matcher.ts
    - packages/core/src/core/topic-matcher.test.ts
    - packages/core/src/core/event-factory.ts
    - packages/core/src/core/event-factory.test.ts
    - packages/core/src/core/event-validator.ts
    - packages/core/src/core/event-validator.test.ts
  modified: []
decisions:
  - "Return type `void` (NON `BrokerError | void`) per validateTopic/validateTopicPattern. Le funzioni sempre throw BrokerError o ritornano nulla (mai oggetto BrokerError); il tipo `BrokerError | void` (proposto inizialmente) era semanticamente errato. Biome warning ha innescato il refactor, accolto come Rule 1 (correctness — tipo che descriveva il valore di ritorno mai esistente)."
  - "Cast `payload as never` e `metadata as never` in createBrokerEvent: il tipo BrokerEvent.payload è `DeepReadonly<TPayload>` (compile-time), ma il deepFreeze runtime è applicato al delivery (broker → subscriber, plan 07 bus.ts), NON alla creation. Cast bypassa il compile-time check senza alterare runtime semantics. Audit-able via grep `as never` (PRD §11 + Pitfall #12)."
  - "exactOptionalPropertyTypes policy in createBrokerEvent: campi opzionali NON valorizzati come `undefined` quando assenti. Pattern conditional spread `...(params.x && { x: params.x })` produce proprietà assente vs proprietà undefined. Test 'omits optional fields' verifica `'correlationId' in event === false` (NON `=== undefined`). Pattern coerente con createBrokerError di plan 04."
  - "Schema topic regex DUPLICATA tra topic-matcher (TOPIC_REGEX) e event-validator (BrokerEventSchema.topic). Source of truth duplicata accettata in F1 perché: (a) Valibot v.regex(...) richiede una RegExp letterale per tree-shaking ottimale, e (b) un re-export creerebbe dipendenza circolare topic-matcher ↔ event-validator. F2+ può consolidare via shared module se la regex evolve."
  - "TopicTrie usa Map<string, TrieNode> e Set<T> internamente. Map mantiene insertion order ma navighiamo esplicitamente exact + '*' separatamente in matchRecursive — D-11 abilita wildcard in posizione intermedia (es. `weather.*.failed` matcha `weather.alert.failed`)."
metrics:
  duration: "~9 minuti wall-clock (16:17 → 16:26 CEST)"
  completed: "2026-04-28T14:26:49+02:00"
  tasks_completed: 3
  files_created: 6
  files_modified: 0
  commits: 6
  tests_added: 55
  tests_passing: 55
  lines_of_code: 686
---

# Phase 1 Plan 05: Utility Batch B Summary

Implementati i 3 moduli foundation di `@sembridge/core` (`core/` directory) con il pattern TDD RED→GREEN per ogni task: `topic-matcher.ts` (validateTopic + validateTopicPattern + TopicTrie segmentato D-08..D-11/D-24, CORE-08/09), `event-factory.ts` (createBrokerEvent con default id nanoid + timestamp Date.now + source obbligatorio D-21..D-23, CORE-07), `event-validator.ts` (validateEvent via Valibot 1.3.1 schema BrokerEvent shape D-18, VAL-01/06). Ogni modulo ha test unit co-locato. File ownership disgiunta da plan 04 (utility batch A) e plan 06 (utility batch C, wave 3 parallelo) e da plan 07 (consumer). Coverage REQ-IDs: CORE-08 ✓, CORE-09 ✓, CORE-07 ✓, VAL-01 ✓, VAL-06 ✓.

## Objective Achieved

L'obiettivo del plan 01-05 è raggiunto integralmente:

- **6 file creati** in `packages/core/src/core/` (3 source + 3 test, 686 LOC totali)
- **`pnpm --filter @sembridge/core test`** esce 0 e riporta `Test Files 9 passed (9) | Tests 134 passed (134)` in 733ms (suite cumulativa post-merge plan 04 + 05 + 06; per il solo plan 05 sono 55 test su 3 file: 32 topic-matcher + 12 event-factory + 11 event-validator)
- **`pnpm --filter @sembridge/core typecheck`** esce 0 (no TS errors, isolatedDeclarations conforme)
- **`pnpm biome check packages/core/src/core/`** esce 0 (18 file checked, no fixes applied)
- **TDD pattern RED→GREEN** preservato: 3 commit `test(01-05): aggiunge test RED ...` precedono ogni commit `feat(01-05): implementa ...` corrispondente
- **D-11 esplicito verificato**: test "matches `weather.*.failed` against `weather.alert.failed`" passa
- **Threat T-05-01** mitigato (regex strict D-24 rifiuta caratteri non `[a-z0-9.]` e uppercase)
- **Threat T-05-03** mitigato (validateTopicPattern al insert garantisce shape; matchRecursive bounded da numero di segmenti)
- **Performance benchmark**: TopicTrie 10000 wildcard subscriber + match singolo verificato < 50ms (margine vs target RESEARCH 5ms)

## Tasks Executed

| #   | Name                                                         | Commit RED | Commit GREEN | Status |
| --- | ------------------------------------------------------------ | ---------- | ------------ | ------ |
| 1   | topic-matcher.ts + test (CORE-08, CORE-09, D-08..D-11, D-24) | `c97bc56`  | `8c24e77`    | done   |
| 2   | event-factory.ts + test (CORE-07, D-21..D-23)                | `239d010`  | `6cd21e7`    | done   |
| 3   | event-validator.ts + test (VAL-01, VAL-06)                   | `d77398c`  | `cf12502`    | done   |

## Files Created

**Source modules (3 file, 298 LOC):**

- `packages/core/src/core/topic-matcher.ts` (155 LOC) — esporta `validateTopic(topic: string): void`, `validateTopicPattern(pattern: string): void` e `class TopicTrie<T>` (`insert/remove/match/collectAllPatterns`). TOPIC_REGEX `/^[a-z][a-z0-9]*(\.[a-z][a-z0-9*]*)*$/` (D-24). PATTERN_REGEX più stringente: ogni segmento è EITHER `*` full wildcard OR `[a-z][a-z0-9]*` (no partial wildcard come `we*`). TrieNode con `children: Map<string, TrieNode>` + `subscribers: Set<T>` (idempotenza). matchRecursive walka simultaneamente branch exact + branch '*' (D-11 abilita wildcard in posizione intermedia). removeRecursive depth-first cleanup di branch vuoti post-rimozione (no memory leak).
- `packages/core/src/core/event-factory.ts` (78 LOC) — esporta `createBrokerEvent<T>(params, defaultSource): BrokerEvent<T>` e `interface PublishParams<T>`. Import `nanoid` da `'nanoid'` 5.1.9. Default id = `nanoid()` (21-char URL-safe), timestamp = `Date.now()`, deliveryMode = `'async'` (D-01), priority = `'normal'`. Throw BrokerError code='event.source.missing' category='validation' se né `params.source` né `defaultSource` forniti (D-23). Spread conditional `...(params.x && { x: params.x })` per onorare `exactOptionalPropertyTypes: true`. Cast `payload as never` documentato (deep-freeze applicato al delivery, non alla creation).
- `packages/core/src/core/event-validator.ts` (65 LOC) — esporta `validateEvent(event: unknown): void`. Schema Valibot `BrokerEventSchema = v.object({...})` con: `id` minLength 1, `topic` regex D-24, `timestamp` integer ≥ 0, `source` (EventSourceSchema con type picklist 5 valori e id minLength 1), `payload: v.unknown()` (VAL-02 territorio F2), `deliveryMode/priority` picklist opzionale, `ttlMs ≥ 0` opzionale, restanti opzionali stringa. `v.safeParse` + throw BrokerError code='event.validation.failed' con `details.issues = result.issues` (array Valibot per diagnostic).

**Test suites (3 file, 388 LOC, 55 test totali):**

- `packages/core/src/core/topic-matcher.test.ts` (156 LOC, **32 test**): `validateTopic` (4 valid + 7 invalid via `it.each` = 11 entries), `validateTopicPattern` (6 valid + 3 invalid = 9 entries), `TopicTrie` (12 cases: exact match, wildcard `weather.*`, exact+wildcard combo, segment count mismatch, D-11 esplicito multi-position wildcard, `*.failed` non matcha singleton, idempotenza Set, remove cleanup branch vuoti, collectAllPatterns, perf 10000 subscriber).
- `packages/core/src/core/event-factory.test.ts` (131 LOC, **12 test**): default id ≥ 21 chars, uniqueness probabilistica, custom id rispettato, default timestamp via Date.now() in window, custom timestamp, deliveryMode='async' default, priority='normal' default, throw BrokerError event.source.missing, defaultSource fallback, source param vince su defaultSource, omits optional fields (`'foo' in evt === false`), includes optional fields when provided.
- `packages/core/src/core/event-validator.test.ts` (101 LOC, **11 test**): accepts minimal valid, accepts all optional fields (priority='critical'), rejects {} con BrokerError event.validation.failed, rejects empty id, rejects topic uppercase, rejects negative timestamp, rejects empty source.id, rejects invalid source.type, rejects invalid deliveryMode, accepts priority='critical', BrokerError include details.issues array.

## Verification Results

### Acceptance criteria Task 1 (topic-matcher)

- [x] File `packages/core/src/core/topic-matcher.ts` esiste, esporta `validateTopic`, `validateTopicPattern`, `class TopicTrie`
- [x] Regex `validateTopic` rifiuta `Weather.Requested` con BrokerError code='topic.invalid'
- [x] Regex `validateTopicPattern` accetta `weather.*.failed` (D-11)
- [x] `TopicTrie.match('weather.alert.failed')` ritorna subscribers di pattern `weather.*.failed` (D-11 esplicito) — test "matches `weather.*.failed` against `weather.alert.failed`" pass
- [x] `TopicTrie.insert` idempotente (Set semantics) — test "insertion is idempotent" pass
- [x] `pnpm --filter @sembridge/core test topic-matcher` esce 0
- [x] Output del test contiene `Test Files  1 passed (1) | Tests 32 passed (32)`
- [x] Performance test 10000 subscriber + match < 50ms passa

### Acceptance criteria Task 2 (event-factory)

- [x] File `packages/core/src/core/event-factory.ts` esporta `createBrokerEvent` e `interface PublishParams<T>`
- [x] Import `nanoid` da `'nanoid'` (verificato grep)
- [x] Throw BrokerError code='event.source.missing' se né params.source né defaultSource forniti (D-23)
- [x] Default `deliveryMode: 'async'`, `priority: 'normal'` (D-01 + standard)
- [x] Campi opzionali NON aggiunti come `undefined` se non forniti — test "omits optional fields" verifica `'correlationId' in evt === false`
- [x] `pnpm --filter @sembridge/core test event-factory` esce 0 con 12 test passing

### Acceptance criteria Task 3 (event-validator)

- [x] File `packages/core/src/core/event-validator.ts` esporta `validateEvent(event: unknown): void`
- [x] Import `* as v from 'valibot'` (verificato grep)
- [x] Schema include picklist per `source.type` (5 valori), `deliveryMode` (4 valori), `priority` (4 valori incluso `'critical'`)
- [x] Throw BrokerError code='event.validation.failed' con `details.issues` come array
- [x] File test ha 11 test cases (target ≥ 11)
- [x] `pnpm --filter @sembridge/core test event-validator` esce 0

### Plan-wide verification

- [x] `pnpm --filter @sembridge/core test` esce 0: `Test Files 9 passed | Tests 134 passed | Duration 733ms` (suite cumulativa wave 3 = plan 04 + 05 + 06)
- [x] `pnpm --filter @sembridge/core typecheck` esce 0
- [x] `pnpm biome check packages/core/src/core/` esce 0 (18 files checked)
- [x] File ownership disgiunta da plan 04 e 06 verificata (nessuna intersezione)

## Final test output

```
> @sembridge/core@0.0.0 test
> vitest run --passWithNoTests

 RUN  v4.1.5 packages/core

 Test Files  9 passed (9)
      Tests  134 passed (134)
   Start at  16:26:30
   Duration  733ms (transform 338ms, setup 0ms, import 423ms, tests 46ms, environment 5.02s)
```

I 9 file di test corrispondono a:
- Plan 04: `broker-error.test.ts`, `deep-freeze.test.ts`, `logger.test.ts`, `event-tap.test.ts` (42 test)
- Plan 05: `topic-matcher.test.ts`, `event-factory.test.ts`, `event-validator.test.ts` (55 test)
- Plan 06: `topic-registry.test.ts`, `lifecycle.test.ts` (37 test, mergeati nel branch durante l'esecuzione parallela del plan 06)

## Deviations from Plan

### Auto-fixed (Rule 1 — correctness)

**1. Return type `void` (non `BrokerError | void`) per validateTopic/validateTopicPattern**

- **Found during:** Task 1 GREEN — biome check post-implementazione ha emesso 1 errore + 2 warning sul return type `BrokerError | void` (suggerimento "Use undefined instead of void in union").
- **Issue:** Lo snippet RESEARCH.md non specifica il tipo di ritorno. La mia prima stesura ha dichiarato `BrokerError | void` per "documentare" la possibilità di throw. Questo è semanticamente errato: la funzione SEMPRE throw o ritorna nulla — non ritorna mai un oggetto BrokerError come valore. Il tipo corretto è `void`.
- **Fix:** Rimosso `import type { BrokerError }` non più necessario; cambiato return type a `void` per entrambe le funzioni. Test passing invariati (32/32 prima e dopo il fix).
- **Files modified:** `packages/core/src/core/topic-matcher.ts`
- **Commit:** `8c24e77` (commit GREEN del task 1, dopo fix)

### Auto-applied formatting (Rule 1 — biome)

**2. Biome auto-fix di multi-line method signatures in topic-matcher.ts**

- **Found during:** Task 1 GREEN — `pnpm biome check --write` ha collassato le signature multi-line di `removeRecursive` e `matchRecursive` in single-line (dentro il line-length limit Biome).
- **Issue:** Mia stesura iniziale ha spezzato manualmente le signature di metodi privati su 4 righe (per leggibilità soggettiva). Biome formatter le ha unificate in single-line.
- **Fix:** Accettato l'autofix di Biome (consistency con il resto del codebase, no override del formatter).
- **Files modified:** `packages/core/src/core/topic-matcher.ts`
- **Commit:** `8c24e77` (incluso nel commit GREEN)

### Architectural Decisions

Nessuna — niente Rule 4 incontrata. Tutti i 3 task hanno proceduto con default ragionevoli secondo lo snippet RESEARCH.md.

## Authentication Gates

Nessun auth gate (operazioni esclusivamente locali: edit file, lint, typecheck, test, git commit).

## Threat Surface Scan

Threat model del plan 05 confermato. Mitigazioni applicate:

- **T-05-01** (Tampering — topic injection es. `weather.../proc/etc`): TOPIC_REGEX `/^[a-z][a-z0-9]*(\.[a-z][a-z0-9*]*)*$/` rifiuta `/`, double-dot, uppercase, leading-trailing dot, empty. validateTopicPattern parimenti restrittiva (solo `*` full segment). Test "rejects invalid topic %s" copre 7 vettori di attacco. ✓
- **T-05-02** (Spoofing — plugin spoofa source.id): ACCEPT in F1. createBrokerEvent NON enforce ownership di `source.id` (deferred a F2 con plugin-scoped publish). Mitigazione minima: source obbligatorio (D-23) — nessun evento può essere generato senza descrittore source. ✓
- **T-05-03** (DoS — wildcard malformato → infinite loop): validateTopicPattern chiamato al `insert` (NON al match), garantisce shape valido prima dell'inserimento nel trie. matchRecursive O(segments_topic), bounded a 2 branch per livello (exact + wildcard). ✓
- **T-05-04** (Information disclosure — Valibot issues leak schema info): ACCEPT. `details.issues` esposto al developer per diagnostic; NON contiene PII (la shape è meta-info, non payload reali). Documentato nel commento del modulo. F6 Inspector può aggiungere redaction se serve. ✓
- **T-05-05** (DoS — timestamp Number.MAX_SAFE): ACCEPT. Schema accetta tutti i numeri ≥ 0; check semantici (es. clamp future timestamp) deferred a F2 canonical model. ✓

Nessun nuovo threat surface introdotto fuori dal `<threat_model>` del plan.

## Open Items

- **Coverage v8 measurement** (ereditato da plan 04): install `@vitest/coverage-v8` (devDependency root) e ri-eseguire `pnpm --filter @sembridge/core test:coverage` al termine di Wave 3 per verificare il target ≥ 90% sui file `core/`. Non bloccante per F1 progress; surrogate confidence: 134 test passing su 9 moduli isolati con behavior coverage esplicito.
- **Schema topic regex duplication** (`topic-matcher.ts` + `event-validator.ts`): accettata in F1 per tree-shaking ottimale e prevenzione dipendenza circolare. F2+ può consolidare via shared module se la regex evolve.
- **Plugin source ownership enforcement** (T-05-02): deferred a F2 con plugin-scoped publish. createBrokerEvent in F1 enforce solo presenza, non identity.

## Ready For

**Wave 3 chiusura — plan 04 + 05 + 06 done** (in attesa di update STATE/ROADMAP/REQUIREMENTS dall'orchestrator):

- 9 test files in `packages/core/src/core/`, 134 test passing
- 9 source files (broker-error, deep-freeze, logger, event-tap, topic-matcher, event-factory, event-validator, topic-registry, lifecycle)
- File ownership disgiunta dei 3 plan paralleli verificata: nessun file modificato cross-plan

**Wave 4 — plan 07** (`bus.ts` EventBus core): consumer di tutti i moduli utility (04+05+06). Sarà sbloccato quando l'orchestrator chiude Wave 3.

I moduli consegnati da questo plan saranno importati da `bus.ts` nel seguente modo (riferimento RESEARCH.md):
- `import { TopicTrie, validateTopic } from './topic-matcher'` (per subscribe/match nel bus)
- `import { createBrokerEvent, type PublishParams } from './event-factory'` (per publish hot-path)
- `import { validateEvent } from './event-validator'` (per step 5 della pipeline §28 — validation)

## Self-Check: PASSED

**Files verified (created):**

- FOUND: `packages/core/src/core/topic-matcher.ts`
- FOUND: `packages/core/src/core/topic-matcher.test.ts`
- FOUND: `packages/core/src/core/event-factory.ts`
- FOUND: `packages/core/src/core/event-factory.test.ts`
- FOUND: `packages/core/src/core/event-validator.ts`
- FOUND: `packages/core/src/core/event-validator.test.ts`

**Commits verified (6 — RED+GREEN per ognuno dei 3 task):**

- FOUND: `c97bc56` test(01-05): aggiunge test RED per topic-matcher (CORE-08, CORE-09, D-08..D-11, D-24)
- FOUND: `8c24e77` feat(01-05): implementa validateTopic + validateTopicPattern + TopicTrie (CORE-08, CORE-09, D-08..D-11, D-24)
- FOUND: `239d010` test(01-05): aggiunge test RED per event-factory (CORE-07, D-21..D-23)
- FOUND: `6cd21e7` feat(01-05): implementa createBrokerEvent factory + PublishParams (CORE-07, D-21..D-23)
- FOUND: `d77398c` test(01-05): aggiunge test RED per event-validator (VAL-01, VAL-06)
- FOUND: `cf12502` feat(01-05): implementa validateEvent con Valibot schema (VAL-01, VAL-06)

**Test verified:**

- 9 Test Files passed (cumulativo wave 3: plan 04 + 05 + 06)
- 134 Tests passed (di cui 55 nuovi da plan 05: 32 topic-matcher + 12 event-factory + 11 event-validator)
- 0 TS errors (`tsc --noEmit`)
- 0 Biome lint/format issues (`biome check packages/core/src/core/`)
