---
phase: 02-canonical-model-mapper
plan: 06
subsystem: valibot-adapter
tags: [validator, valibot, adapter, tdd, parallel-wave-3]

# Dependency graph
requires:
  - phase: 02-canonical-model-mapper
    plan: 02
    provides: "ValidatorAdapter interface + ValidationResult discriminated union + ValidationIssue subset"
provides:
  - "packages/mapper/src/valibot-adapter.ts — valibotAdapter (default ValidatorAdapter, D-37)"
  - "packages/mapper/src/valibot-adapter.test.ts — 10 unit test (success/fail/issue mapping/no-throw/no-mutation/optional/unknown)"
  - "Pattern adapter pluggable NO-throw (D-38) implementato — V2 supporterà Zod/Ajv senza breaking change"
  - "Issue mapping deterministic: BaseIssue.path → string[] readonly (T-02-06-04 mitigation)"
  - "try/catch wrapper attorno a v.safeParse per resilienza a schema non-Valibot (T-02-06-01 mitigation)"
affects: [02-07-mapper-engine, 02-09-augment, 02-10-integration-tests, 02-12-final-gate-DOC-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Discriminated union NO-throw per adapter pluggable: caller decide cosa fare con il fail (publish mapping.error o fallback policy D-44)"
    - "Wrapper try/catch attorno a v.safeParse: resilienza a schema malformato senza violare contract NO-throw"
    - "Conditional spread {-readonly [K]: V} per exactOptionalPropertyTypes compliance — i field opzionali assenti NON sono undefined espliciti"
    - "Path mapping esplicito: i.path.map(p => String(p.key)) produce string[] deterministic per consumer cross-adapter"
    - "TDD RED→GREEN come F1: 1 commit test failing (RED gate), 1 commit feat (GREEN gate)"

key-files:
  created:
    - "packages/mapper/src/valibot-adapter.ts (130 LOC) — valibotAdapter const + mapIssue helper + ValibotIssue interface locale"
    - "packages/mapper/src/valibot-adapter.test.ts (110 LOC) — 10 test cases covering VAL-03/VAL-04/VAL-07 contract"
  modified: []

key-decisions:
  - "Nessuna deviazione dalle decisioni D-37/D-38/D-39 di 02-CONTEXT.md — il plan è eseguito esattamente come scritto"
  - "Aggiunto try/catch attorno a v.safeParse per resilienza a schema non-Valibot/malformato (T-02-06-01 mitigation). Coerente con contract NO-throw documentato in JSDoc; il caller riceve sempre ValidationResult discriminato"
  - "Issue mapping conditional spread invece di blanket spread: rispetta exactOptionalPropertyTypes (i field opzionali non vengono valorizzati a undefined esplicito)"
  - "ValibotIssue interface locale al modulo: estratto subset rilevante delle proprietà runtime di v.BaseIssue per disaccoppiare dal generico complesso `BaseIssue<TInput>` di Valibot 1.x"

patterns-established:
  - "Pattern adapter pluggable per future implementazioni Zod/Ajv (V2): replicabile come `zodAdapter`/`ajvAdapter` con stessa interface ValidatorAdapter, mapping issue differente ma stessa shape ValidationIssue"
  - "Pattern issue mapping cross-adapter: ValidationIssue minimal subset (path/message/expected/received) consente mapping da Zod/Ajv senza breaking change al contract"
  - "Pattern try/catch defensivo attorno a librerie 3rd party che potrebbero throw inaspettatamente — coerente con contract result-object NO-throw"

requirements-completed: []
requirements-type-level:
  - VAL-03
  - VAL-04
  - VAL-07

# Metrics
duration: 2min
completed: 2026-04-29
---

# Phase 2 Plan 06: valibotAdapter Summary

**Implementato `valibotAdapter` — il default `ValidatorAdapter` (D-37) usato dal MapperEngine (plan 02-07) ai passi 6 (canonical validation) e 12 (final validation per consumer) della pipeline §28. Adapter pluggable NO-throw (D-38) con issue mapping deterministic da `v.BaseIssue.path` a `string[]`. Wave 3 parallelo a 02-03/02-04/02-05 con file ownership disgiunta.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-29T17:57:31Z
- **Completed:** 2026-04-29T17:59:29Z
- **Tasks:** 1/1 completed (TDD RED→GREEN)
- **Files created:** 2 nuovi (240 LOC totali — 130 source + 110 test)
- **Files modified:** 0

## Accomplishments

- `valibotAdapter` const implementa `ValidatorAdapter` interface (D-37, D-38) — pattern singleton non-class coerente con la natura stateless dell'adapter
- `v.safeParse` wrapped in try/catch per resilienza a schema malformato/non-Valibot (T-02-06-01 mitigation) — il caller riceve sempre `ValidationResult` discriminato senza eccezioni inattese
- `mapIssue` helper privato: mappa `v.BaseIssue` a `ValidationIssue` subset con conditional spread per `exactOptionalPropertyTypes` compliance
- Path mapping deterministic: `BaseIssue.path: [PathItem, ...]` → `string[]` via `String(p.key)` (T-02-06-04 mitigation)
- 10 unit test coprono: success string, type mismatch, `v.unknown()` accettazione, object schema valido, missing field, issue message presence, array mixed types, payload immutability (JSON-safe invariant), optional field assente, NEVER throws con null/undefined/wrong type/array
- Nessun modulo modificato — file ownership disgiunta confermata vs Wave 3 paralleli (02-03 canonical-registry, 02-04 alias-registry, 02-05 transform-pipeline)
- Mapper full test suite: 51/51 passing (4 file: alias-registry, canonical-registry, transform-pipeline, valibot-adapter)
- Core regression: 248/248 passing (no break su F1)
- typecheck exit 0 con `isolatedDeclarations: true` enforcement (return type esplicito su funzione `mapIssue`, generic explicit su `validate<T>`)

## Task Commits

TDD pattern RED→GREEN come F1 (D-52). Due commit atomici sequenziali separati per tracciabilità del gate TDD nel git history.

1. **Task 1 RED — test(02-06): aggiunge test RED per valibotAdapter** — `5df4dce`
   - File: `packages/mapper/src/valibot-adapter.test.ts` (110 LOC, 10 test cases)
   - Atteso fail (modulo `valibot-adapter.ts` non ancora creato) — verificato `Failed to resolve import "./valibot-adapter"`
2. **Task 1 GREEN — feat(02-06): implementa valibotAdapter (REQ VAL-03/VAL-04/VAL-07 — D-37/D-38)** — `cd509f3`
   - File: `packages/mapper/src/valibot-adapter.ts` (130 LOC)
   - Atteso pass — verificato `Test Files 1 passed (1) | Tests 10 passed (10)`

**Plan metadata commit:** TBD (eseguito alla fine del workflow tramite `gsd-sdk query commit`).

## Files Created

### packages/mapper/src/

- **`valibot-adapter.ts`** (130 LOC) — Esporta:
  - `valibotAdapter: ValidatorAdapter` const (D-37, D-38)
  - Helper privato `mapIssue(issue: ValibotIssue): ValidationIssue` con conditional spread per `exactOptionalPropertyTypes`
  - Interface locale `ValibotIssue` (subset rilevante di `v.BaseIssue` runtime shape)
  - Header con riferimenti D-37/D-38/D-39, threat coverage T-02-06-01..T-02-06-05, differenza Rule 4 vs F1 `event-validator.ts`
  - JSDoc IntelliSense completo + `@example` con scenario meteo (PRD §29)

- **`valibot-adapter.test.ts`** (110 LOC) — 10 test cases:
  1. `returns ok: true with value on successful validation (string)` — happy path string
  2. `returns ok: false with issues on type mismatch (NO throw)` — fail path con issues array
  3. `v.unknown() accepts any payload` — schema permissivo
  4. `object schema with all required fields valid → ok: true` — happy path object
  5. `object schema with missing required field → ok: false with path` — D-42 field mancante
  6. `issue mapping includes message + path when available` — issue shape
  7. `array schema with mixed types → ok: false with element index path` — array validation
  8. `does not mutate the input payload` — JSON-safe invariant (T-02-06-03)
  9. `optional field absent is valid (ok: true)` — `v.optional()` semantics
  10. `NEVER throws — invalid payload always returns ok: false` — contract NO-throw (T-02-06-01)

## Verification

| Comando | Risultato |
|---------|-----------|
| `pnpm --filter @sembridge/mapper test valibot-adapter` (post Task RED) | FAIL (atteso — TDD RED gate; `Failed to resolve import "./valibot-adapter"`) |
| `pnpm --filter @sembridge/mapper test valibot-adapter` (post Task GREEN) | Exit 0; **Test Files 1 passed (1) — Tests 10 passed (10)** |
| `pnpm --filter @sembridge/mapper test` (full mapper suite) | Exit 0; **4 file/51 test passing** (alias-registry + canonical-registry + transform-pipeline + valibot-adapter) |
| `pnpm --filter @sembridge/mapper typecheck` | Exit 0 (no errori TS, `isolatedDeclarations` enforcement OK) |
| `pnpm --filter @sembridge/core test` | Exit 0; **24 file/248 test passing** (no regression Phase 1) |
| Acceptance grep checks (6/6) | PASSED — file esistono, exports valibotAdapter, implementa ValidatorAdapter, usa v.safeParse, mappa issues |
| `valibot` in `dependencies` (NON devDependencies) | OK — `packages/mapper/package.json:39-42` `dependencies: { @sembridge/core: workspace:*, valibot: 1.3.1 }` |
| File ownership disgiunta vs Wave 3 paralleli | OK — solo `packages/mapper/src/valibot-adapter{.ts,.test.ts}` modificati, nessun overlap con 02-03/02-04/02-05 |

## Threat Coverage

| Threat ID | Disposition | Mitigation in commit |
|-----------|-------------|----------------------|
| T-02-06-01 (DoS — schema malformato/non-Valibot causa exception in safeParse) | mitigate | `try/catch` wrapper in `validate()` (riga 100-122) ritorna `{ ok: false, issues: [...] }` con singola issue contenente `err.message`. Coerente con contract NO-throw documentato in JSDoc del `ValidatorAdapter` interface (`types/validator-adapter.ts:54-58`). |
| T-02-06-02 (Information disclosure — issue messages contengono PII di payload) | accept | F2 V1: documentato in header file (riga 26-28). F6 Inspector con redaction sarà richiesto per produzione (DOC-03 deferred). |
| T-02-06-03 (Tampering — adapter muta payload) | mitigate | `v.safeParse` ritorna nuova reference su success (Valibot 1.x semantica). Test 8 verifica `JSON.stringify(payload) === before` invariant post-validate. |
| T-02-06-04 (Repudiation — issue path è `PathItem[]` non `string[]`) | mitigate | Mapping esplicito `issue.path.map(p => String(p.key))` produce `string[]` deterministic. Pattern conditional spread evita `undefined` esplicito (riga 73-75). |
| T-02-06-05 (DoS — schema con ricorsione infinita) | accept | Valibot 1.x gestisce internamente ricorsione (trust nel runtime). Nessun custom recursion guard nell'adapter — sarebbe duplicazione del lavoro di Valibot. |

## Deviations from Plan

**None — il plan è stato eseguito esattamente come scritto.**

Tutti gli step (test RED → implementazione → test GREEN → typecheck) sono stati eseguiti senza deviazioni. Nessun checkpoint hit. Nessun Rule 1/2/3/4 applicato.

**Note tecniche minori (non deviazioni — già anticipate dal PLAN nel campo `<output>`):**

1. **Try/catch attorno a `v.safeParse`** — il PLAN snippet (riga 312-320) include esplicitamente `try/catch` con commento "Valibot's safeParse non lancia mai per schema validi; per sicurezza wrap try/catch (es. schema malformato/non-Valibot passato per errore)". Coerente con threat T-02-06-01 (`mitigate` disposition). Non è una deviazione — è prescritto dal PLAN.
2. **Interface locale `ValibotIssue`** — non specificato esplicitamente nel PLAN, ma è implicito dal pattern `mapIssue(i as ValibotIssue)` nel snippet. Estratto in interface per disaccoppiare dal generico complesso `v.BaseIssue<TInput>` di Valibot 1.x e migliorare la leggibilità. Coerente con Rule 2 readability principle.
3. **Conditional spread per `exactOptionalPropertyTypes`** — il PLAN snippet usa `if (issue.path) { result.path = ... }` (assignment condizionale), che è esattamente il pattern conditional spread richiesto da `exactOptionalPropertyTypes: true` (eredita da `tsconfig.base.json`). Coerente.

## Auth Gates

Nessun auth gate — task interamente automatico (file creation + test/typecheck local).

## TDD Gate Compliance

Plan `type: execute` con task `tdd="true"` — ciclo RED→GREEN rispettato:

1. **RED gate (commit `5df4dce`)** — `test(02-06): aggiunge test RED per valibotAdapter`. Test fail verificato (`Failed to resolve import "./valibot-adapter"`).
2. **GREEN gate (commit `cd509f3`)** — `feat(02-06): implementa valibotAdapter (REQ VAL-03/VAL-04/VAL-07 — D-37/D-38)`. Test pass verificato (10/10).

Nessun REFACTOR gate necessario — implementazione già pulita al primo GREEN. Coerente con `git log --oneline | grep "02-06:"`:

```
cd509f3 feat(02-06): implementa valibotAdapter (REQ VAL-03/VAL-04/VAL-07 — D-37/D-38)
5df4dce test(02-06): aggiunge test RED per valibotAdapter
```

## Open Items / Pronto-per

- ✅ **Closed:** D-37 implementato (Valibot 1.x come default validator)
- ✅ **Closed:** D-38 implementato (adapter pluggable — V2 può aggiungere Zod/Ajv senza breaking change)
- ✅ **Ready:** plan 02-07 (`MapperEngine`) può importare `import { valibotAdapter } from './valibot-adapter'` come default per `validator: ValidatorAdapter` config
- ✅ **Ready:** plan 02-09 (`augment.ts`) può ri-esportare `valibotAdapter` dal barrel principale `@sembridge/mapper/index.ts`
- ⏳ **Pending:** plan 02-07 (`MapperEngine`) consumerà `valibotAdapter` ai passi 6 (canonical validation) e 12 (final validation per consumer) della pipeline §28 (D-39)
- ⏳ **Pending:** plan 02-12 (final gate F2) misurerà coverage v8 ≥ 90% sul file `valibot-adapter.ts`. Stima attuale: ~95% (10 test coprono tutti i branch happy/fail/edge)

## Self-Check: PASSED

File creati (verifica esistenza):
- packages/mapper/src/valibot-adapter.ts: FOUND
- packages/mapper/src/valibot-adapter.test.ts: FOUND

Commit hash (verifica esistenza in git log):
- 5df4dce (Task RED — test failing per valibotAdapter): FOUND
- cd509f3 (Task GREEN — feat valibotAdapter implementation): FOUND
