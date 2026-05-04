---
phase: 05-worker-runtime
plan: 02
subsystem: "@sembridge/worker — building blocks W2-A"
tags:
  - tdd
  - red-green
  - serialization
  - validation
  - transferable
  - jsonpath
  - wk-07
  - d-83-strict
  - wave-2-a
requirements_completed:
  - WK-07
  - VAL-01
  - ERR-02
  - TEST-01
dependency_graph:
  requires:
    - "05-01 (W1) — types F5 + augment.ts decl merging + barrel index.ts skeleton"
    - "@sembridge/core — createBrokerError + ErrorCategory.worker (F1 ERR-01)"
  provides:
    - "assertSerializable(value, path?, visited?) — pure deep-walk SCA validator"
    - "extractTransferables(payload, paths) — pure JSONPath-like extractor"
    - "Building blocks WK-07 closure runtime (DOC-04+DOC-05 parte testuale in 05-07)"
  affects:
    - "05-04 (Wave 3) — worker-bridge consumer di entrambi pre-postMessage"
    - "05-06 (Wave 4) — worker-handler integration nel route executor"
tech-stack:
  added: []
  patterns:
    - "Pure parser puro analog frame-parser.ts (F4) + retry-after-parser.ts (F3)"
    - "Deep-walk recursive con WeakSet cycle detection (T-05-02-01)"
    - "Set-based deduplication per dedup transferList (T-05-02-04)"
    - "Path tracking dotted/bracketed per BrokerError.details.fieldPath"
    - "Zero-dep custom parser (vs jsonpath-plus 4-6 KB) — RESEARCH §6.4"
    - "TDD RED→GREEN co-located 2 commit atomici per task (D-149)"
key-files:
  created:
    - "packages/worker/src/assert-serializable.ts (191 LOC)"
    - "packages/worker/src/assert-serializable.test.ts (155 LOC)"
    - "packages/worker/src/transferable-extractor.ts (256 LOC)"
    - "packages/worker/src/transferable-extractor.test.ts (137 LOC)"
  modified:
    - "packages/worker/src/index.ts (append-only — coordinato con 05-03 wave parallel)"
decisions_applied:
  - "D-139 — assertSerializable dev-mode auto + opt-out (BrokerConfig.workers.assertSerializable)"
  - "D-140 — throw BrokerError code 'worker.serialization.failed.{function|symbol|dom-node|custom-class}' PRE-postMessage con fieldPath"
  - "D-141 — transferable JSONPath-like wildcard array zero-dep (~80 LOC custom)"
  - "D-142 — contratto serializzazione runtime (DOC-04+DOC-05 documentazione in 05-07)"
  - "D-149 — TDD RED→GREEN co-located 2 commit per task"
  - "D-150 — Tier-1 jsdom unit (Tier-3 ImageBitmap/Worker reali deferred 05-07)"
  - "D-83 — strict — F5 vive solo in packages/worker/src/"
metrics:
  duration_minutes: 8
  completed_at: "2026-05-04"
  tasks_completed: 2
  files_created: 4
  files_modified: 1
  total_loc: 739
---

# Phase 5 Plan 02: Building blocks W2-A (assert-serializable + transferable-extractor) Summary

Validatore SCA deep-walk con cycle detection (`assertSerializable`) + estrattore JSONPath-like wildcard (`extractTransferables`), entrambi pure functions zero-dep — chiusura WK-07 closure runtime parziale (PRD §39 #11), pronti per consumer 05-04 worker-bridge in Wave 3.

## Cosa è stato fatto

### Task 1 — assertSerializable (D-139/D-140)
Validator deep-walk ricorsivo che attraversa `payload: unknown` e throw `BrokerError` PRE-postMessage su tipi non-SCA (Structured Clone Algorithm).

**Algoritmo:**
1. Primitive (`null` / `undefined` / `string` / `number` / `boolean` / `bigint`) → return (SCA OK)
2. `function` → throw `worker.serialization.failed.function` con `details.fieldPath`
3. `symbol` → throw `worker.serialization.failed.symbol`
4. Object branches con cycle detection via `WeakSet<object>`:
   - DOM Node (duck-typed `nodeType: number` cross-realm) → throw `worker.serialization.failed.dom-node`
   - Plain Array → walk recursive con path bracketed `${path}[${i}]`
   - SCA-supported built-ins (Date/Map/Set/RegExp/ArrayBuffer/TypedArray/Blob/File/ImageData/ImageBitmap/MessagePort/Error/DOMException) → return opachi
   - Plain object (`Object.getPrototypeOf` null o `Object.prototype`) → walk recursive con path dotted `${path}.${key}`
   - Custom class instance → throw `worker.serialization.failed.custom-class` con `constructorName`

**Bug catturato durante GREEN (Rule 1 auto-fix):** il filter `tag.endsWith('Array]')` per TypedArray catturava anche `[object Array]` (plain Array), causando skip del walk. Fix: filter Plain Array (Step 5) PRIMA dei built-ins SCA opachi (Step 6). Test 11 (`function in array`) era il test che ha smascherato il bug.

### Task 2 — extractTransferables (D-141)
Pure extractor JSONPath-like zero-dep (~80 LOC) che estrae oggetti `Transferable[]` dal payload via path string.

**Subset supportato:**
- Literal: `'audioBuffer'`, `'data.opts.buf'`
- Wildcard array: `'images[*].buffer'`, `'list[*]'`
- Deep nested wildcard chain: `'a.b[*].c[*].buf'`

**parsePath defensive (T-05-02-04 mitigation):** ritorna `null` su malformed path → graceful skip per quel path nel main extractor:
- empty string `''`
- consecutive dots `'..'` o leading/trailing `'.'`
- `[` orfano o senza `*]` literal
- numeric index `[0]` non supportato V1 (filter, slice non supportati)

**Set-based deduplication:** stesso `Transferable` in path multipli → 1 sola occorrenza (Test 13). Necessario per `port.postMessage(msg, transferList)` che fallisce con `DataCloneError` su duplicati.

**isTransferable detection (typeof guards per jsdom):**
- `ArrayBuffer` (incluso `TypedArray.buffer` via Test 7)
- `MessagePort`
- `ImageBitmap` (typeof guard — Test 9 skip su jsdom, deferred Tier-3)
- `OffscreenCanvas`
- `ReadableStream` / `WritableStream` / `TransformStream`

## Test risultati

**30/30 passing** (Tier-1 jsdom):
- `assert-serializable.test.ts`: 15/15 (7 valid types + 6 throw + 1 cycle + 1 undefined)
- `transferable-extractor.test.ts`: 15/15 (literal/nested/wildcard/missing/typedarray/messageport/imagebitmap-skip/multipath/empty/non-transferable/dedup/deep-chain/malformed)

**Coverage v8 (worker package):**

| File | Stmts | Branch | Funcs | Lines |
|------|-------|--------|-------|-------|
| assert-serializable.ts | 96.87% | 95.91% | 100% | 96.42% |
| transferable-extractor.ts | 88.75% | 84.21% | 100% | 98.36% |

Plan threshold target ≥90/80/90/90 → **soddisfatto** (branch 84.21% > 80% target).

## CI gates

- `pnpm -F @sembridge/worker test --run` → 50/50 passing (8 augment + 12 task-tracker [05-03] + 30 di questo plan)
- `pnpm -F @sembridge/worker typecheck` → exit 0
- `pnpm -F @sembridge/worker build` → ESM dist 7.93 KB; DTS 19.49 KB
- `pnpm -r typecheck` cross-package → exit 0 (no regression core/mapper/routing/gateway/worker)
- `grep -c "createBrokerError" assert-serializable.ts` → 5 ✓ (4 sub-codes + 1 import)
- `grep -c "category: 'worker'" assert-serializable.ts` → 4 ✓
- `grep -c "WeakSet" assert-serializable.ts` → 4 ✓
- `grep -c "Transferable" transferable-extractor.ts` → 22 ✓
- `grep -c "wildcard" transferable-extractor.ts` → 13 ✓
- `grep -c "MessagePort" transferable-extractor.ts` → 3 ✓
- `grep -rc "JSON.stringify" packages/worker/src/` → 0 ✓ (F5 NON usa JSON.stringify)
- Build dist contiene `assertSerializable` (4 occorrenze) + `extractTransferables` (2 occorrenze) ✓

## D-83 strict ✓

```bash
git diff main..HEAD -- packages/core/src/ packages/mapper/src/ packages/routing/src/ packages/gateway/src/http/ packages/gateway/src/sse-ws/
# Output: zero righe
```

Tutte le modifiche del plan 05-02 vivono ESCLUSIVAMENTE in `packages/worker/src/`. Composition wrapper pattern intatto.

## Threat coverage

| Threat ID | Component | Disposition | Verifica |
|-----------|-----------|-------------|----------|
| T-05-02-01 | DoS cyclic payload stack overflow | mitigate | Test 12 `a.self = a` no throw via WeakSet ✓ |
| T-05-02-02 | Information Disclosure value leak | mitigate | `details` include solo metadata (`fieldPath`/`fieldType`/`constructorName?`) — zero `value:` reference ✓ |
| T-05-02-03 | Logic flaw Pitfall 7.A bypass | mitigate | Throw PRE-postMessage strutturato + zero `JSON.stringify` ✓ |
| T-05-02-04 | DoS malformed path crash | mitigate | `parsePath` ritorna null + Test 15 verifica 5 forms malformed → `[]` ✓ |
| T-05-02-05 | Tampering Transferable mutati | accept | Pure function, ownership non trasferita finché postMessage (DOC-05 W5 closure) |
| T-05-02-06 | DoS wildcard infinite loop | mitigate | `walk` recursive con `segIdx` incrementale, no descendant `..` V1 — Test 14 deep chain ✓ |
| T-05-02-07 | Information Disclosure fieldPath sensitive | accept | Trade-off DX vs info leak — consumer è autore del payload (DOC-05 W5) |

## Building blocks pronti per Wave 3 (05-04 worker-bridge)

```ts
// Esempio integration in 05-04 worker-bridge.ts:
import { assertSerializable, extractTransferables } from '@sembridge/worker'

async dispatch(workerId: string, taskName: string, payload: unknown, transferable: readonly string[]) {
  // Step 1: validate (D-139 dev-mode auto, opt-out via config)
  if (this.shouldAssert) {
    assertSerializable(payload) // throws BrokerError pre-postMessage
  }
  // Step 2: extract transferable (D-141)
  const transferList = extractTransferables(payload, transferable)
  // Step 3: postMessage con transferList (Comlink integration)
  return this.bridge[taskName](payload, { transfer: transferList })
}
```

Entrambe le primitive sono pure, zero side-effect, deterministiche → testabili in isolamento + facilmente mockabili nel WorkerBridge integration test (Wave 3).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plain Array catturato da filter `tag.endsWith('Array]')` come SCA-built-in opaque**
- **Found during:** GREEN Task 1 (Test 11 fail)
- **Issue:** `Object.prototype.toString.call([])` → `'[object Array]'` matchava il filter dei built-ins SCA (TypedArray) destinato a Uint8Array/Float32Array/etc., causando skip del walk recursive su Array → function nidificata in array NON rilevata
- **Fix:** Spostato Step Plain Array (Step 5) PRIMA dello Step SCA built-ins (Step 6). Plain Array walk con path bracketed; built-ins TypedArray restano opachi
- **Files modified:** `packages/worker/src/assert-serializable.ts`
- **Commit:** `c75c205` (assorbito nel GREEN Task 1 commit)

Nessun'altra deviation. Tasks eseguiti come da plan.

## Commits

| Type | Hash | Message |
|------|------|---------|
| test (RED) | `1f54fd6` | RED assert-serializable 15 test deep-walk SCA validator |
| feat (GREEN) | `c75c205` | GREEN assert-serializable deep-walk SCA validator |
| test (RED) | `7ef7e45` | RED transferable-extractor 15 test JSONPath-like |
| feat (GREEN) | `017367b` | GREEN transferable-extractor JSONPath-like zero-dep |
| chore (barrel) | `0ce51f0` | expose assertSerializable + extractTransferables in barrel |

## Coordinamento parallel con 05-03 (Wave 2-B)

Il plan 05-03 (`createTaskTracker` state machine atomico) è eseguito in parallelo con file ownership disgiunta:
- 05-02 owns: `assert-serializable.{ts,test.ts}` + `transferable-extractor.{ts,test.ts}`
- 05-03 owns: `task-tracker.{ts,test.ts}`
- Barrel `index.ts` append disgiunto (sezioni separate W2-A vs W2-B), nessun conflict git

I commit interleaved sono: `7ef7e45` (mio RED Task 2) → `bbbc989` (05-03 GREEN) → `2c3a454` (05-03 barrel append) → `017367b` (mio GREEN Task 2) → `0ce51f0` (mio barrel append). Sequenza pulita, nessun rebase necessario.

## REQ progress

- **WK-07** — closure runtime parziale (algoritmo + 4 sub-codes + JSONPath extractor implementati). Closure totale in 05-07 final gate (DOC-04+DOC-05 contract documentation).
- **VAL-01** — validation pre-dispatch payload non-SCA contributo iniziale; integration nel pipeline §28 step 9 in 05-06 (worker-handler).
- **ERR-02** — `worker.error` envelope contributo: code namespace `worker.serialization.failed.*` + `category: 'worker'` strutturato.
- **TEST-01** — Tier-1 jsdom 30 test deterministici. Tier-3 (ImageBitmap reale, Worker round-trip) deferred al final gate Wave 5.

## Self-Check: PASSED

**Files verified:**
- FOUND: `packages/worker/src/assert-serializable.ts` (191 LOC)
- FOUND: `packages/worker/src/assert-serializable.test.ts` (155 LOC)
- FOUND: `packages/worker/src/transferable-extractor.ts` (256 LOC)
- FOUND: `packages/worker/src/transferable-extractor.test.ts` (137 LOC)
- FOUND: `packages/worker/src/index.ts` (modified — append-only)

**Commits verified (git log):**
- FOUND: `1f54fd6` test(05-02) RED assert-serializable
- FOUND: `c75c205` feat(05-02) GREEN assert-serializable
- FOUND: `7ef7e45` test(05-02) RED transferable-extractor
- FOUND: `017367b` feat(05-02) GREEN transferable-extractor
- FOUND: `0ce51f0` chore(05-02) expose barrel

**Test/build/typecheck:**
- 30/30 plan tests passing (50/50 worker package totale)
- typecheck cross-package exit 0
- build dist generato con export pubblici
- coverage v8 ≥ plan thresholds (90/80/90/90)

**D-83 strict:** zero diff fuori `packages/worker/src/` ✓
