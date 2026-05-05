---
phase: 04-realtime-inbound-sse-prioritario-ws-opzionale
plan: 02
subsystem: realtime
tags: [websocket, frame-parser, envelope, internal-topics, tdd, anti-AP-6, gateway, sse-ws]

# Dependency graph
requires:
  - phase: 04-realtime-inbound-sse-prioritario-ws-opzionale
    plan: 01
    provides: "Subpath @gluezero/gateway/sse-ws risolvibile + types directory esistente per co-location di frame-envelope.ts"
provides:
  - "parseFrame(raw: unknown): FrameParseResult — pure function, NO throw, NO state, NO side-effect"
  - "FrameEnvelope interface (D-106 envelope JSON: { topic, data, id? })"
  - "FrameParseResult discriminated union ({ ok: true, envelope } | { ok: false, reason: 'malformed-json' | 'missing-topic' | 'invalid-shape', raw })"
  - "INTERNAL_TOPICS frozen const ({ PING: '__ping__', PONG: '__pong__' })"
  - "isInternalTopic(topic: string): boolean — strict equality match (PITFALL §11.7 chiusura anti-AP-6)"
affects: [04-06, 04-08]  # 04-06 websocket-adapter consuma parseFrame; 04-08 RealtimeBroker integra adapter

# Tech tracking
tech-stack:
  added: []  # nessuna dipendenza runtime nuova
  patterns:
    - "Parser puro pattern (analog parseRetryAfter F3): input narrow → output union discriminato, no throw, no side-effect"
    - "Discriminated union result (ok/reason) per error path graceful (caller usa .ok per branching)"
    - "Object.freeze + Readonly type annotation per --isolatedDeclarations su const frozen"
    - "TDD RED→GREEN strict (commit separati test+impl, verifica esplicita import resolution failure in RED)"
    - "Strict equality match per topic riservati (PITFALL §11.7 anti-AP-6 closure Q1)"

key-files:
  created:
    - "packages/gateway/src/sse-ws/types/frame-envelope.ts (50 LOC) — FrameEnvelope + FrameParseResult types-only"
    - "packages/gateway/src/sse-ws/frame-parser.ts (140 LOC) — parseFrame + INTERNAL_TOPICS + isInternalTopic"
    - "packages/gateway/src/sse-ws/frame-parser.test.ts (142 LOC) — 15 test deterministici jsdom tier-1"
  modified: []  # NESSUNA modifica a file esistenti — D-83 strict ext F4

key-decisions:
  - "D-106 envelope JSON shape locked: { topic: string non-vuoto, data: unknown, id?: string }"
  - "D-111 internal topics __ping__/__pong__ riservati con strict equality (NO prefix match — PITFALL §11.7 Q1 closure)"
  - "Q2 closure 04-CONTEXT (frame parse error → network.error category protocol): consumer adapter 04-06 publica `network.error` riusando ERR-02 ext F3, NIENTE nuovo `realtime.protocol.error` event"
  - "Input difensivo unknown: parseFrame accetta `unknown` (non solo string) per gestire MessageEvent.data tipato `any` da DOM lib (ArrayBuffer/Blob/number → malformed-json)"
  - "id non-string ignorato (no crash, envelope.id undefined): l'adapter genererà via nanoid se mancante (D-106)"

patterns-established:
  - "Pattern parser puro F4: input `unknown` (non solo `string`) per defense-in-depth contro DOM lib `any`. Estensione del pattern parseRetryAfter F3"
  - "Pattern strict-equality per topic riservati: `topic === '__ping__' || topic === '__pong__'`, NO startsWith/regex prefix. Replicabile per altri internal topics futuri"
  - "Pattern `Readonly<{ readonly K: V }>` annotation type esplicita su Object.freeze const per --isolatedDeclarations: necessario su tutti i `as const` frozen exported"

requirements-completed:
  - RT-02  # WebSocket adapter foundations (parseFrame è il primo runtime building block per 04-06)
  - RT-04  # Messaggi server convertiti in eventi interni (envelope contract definito qui, mapping al BrokerEvent in 04-06)
  - RT-06  # Normalizzazione payload inbound: parseFrame estrae il payload raw, normalizzazione canonical step §28 4 in 04-08
  - ERR-02  # Eventi standard `network.error` come reason path (riuso F3, no nuovi event types)

# Metrics
duration: ~12min
completed: 2026-05-04
---

# Phase 4 Plan 02: Frame Parser Puro Summary

**Pure function `parseFrame(raw: unknown): FrameParseResult` per WebSocket envelope JSON `{topic, data, id?}` (D-106) + filtro topic interni `__ping__`/`__pong__` con strict equality match (D-111 + PITFALL §11.7 chiusura anti-AP-6) — TDD RED→GREEN cycle clean, 15/15 test passing, zero regressioni cross-package.**

## Performance

- **Duration:** ~12 min (RED commit + 1 fix iter su TS strict noPropertyAccessFromIndexSignature + isolatedDeclarations + GREEN commit + verifica full suite)
- **Started:** 2026-05-04 (post 04-01 chiusura)
- **Completed:** 2026-05-04
- **Tasks:** 1/1 (TDD task atomico)
- **Files created:** 3 (1 types + 1 source + 1 test)
- **LOC totale:** 332 (50 types + 140 source + 142 test)

## Accomplishments

- **`parseFrame` pure function** (D-106) deterministica e difensiva: input `unknown` (non solo `string`) per gestire `MessageEvent.data` tipato `any` dalla DOM lib (ArrayBuffer/Blob/number → `malformed-json` graceful). NO throw garantito al caller, NO side-effect, NO state.
- **`FrameParseResult` discriminated union** con 3 reason path (`malformed-json`, `missing-topic`, `invalid-shape`) + `raw` field per debug/forensics nel `network.error` event payload (Q2 closure: riuso ERR-02 ext F3, NO nuovo event type).
- **`INTERNAL_TOPICS` frozen** (`Object.freeze` + `Readonly<{readonly PING: '__ping__'; readonly PONG: '__pong__'}>` annotation per `--isolatedDeclarations`): import-time immutable, mutation accidentale dal consumer impossibile.
- **`isInternalTopic` strict-equality** (chiave **anti-AP-6 PITFALL §11.7**): `topic === '__ping__' || topic === '__pong__'`. Topic legittimi consumer come `weather.__ping__` (raro ma legittimo) NON sono filtrati come internal. Test 13 esplicito blocca regressione.
- **TDD RED→GREEN clean**: 2 commit separati visibili in git log, RED verificato con failure esplicito di vitest (`Failed to resolve import "./frame-parser"`), GREEN verificato con 15/15 PASS.
- **D-83 strict ext F4**: zero modifiche a `packages/{core,mapper,routing}/src/` né a `packages/gateway/src/http/`. Verifica `git diff --name-only 26cc3c2~1..edcbf3b | grep -E "..."` = 0 matches.
- **Zero regressioni cross-package**: full monorepo `pnpm -r test --run` 654/654 PASS (248 core + 183 mapper + 103 routing + 120 gateway).

## Task Commits

Task atomico con TDD strict RED→GREEN:

1. **RED — Test failing**: `26cc3c2` (`test(04-02): add failing tests for parseFrame + isInternalTopic (D-106 + PITFALL §11.7)`)
   - 2 file creati: `types/frame-envelope.ts` (50 LOC) + `frame-parser.test.ts` (142 LOC)
   - Verifica: vitest fail con "Failed to resolve import './frame-parser'" — `frame-parser.ts` non esiste ancora.
2. **GREEN — Implementation passing**: `edcbf3b` (`feat(04-02): implement parseFrame + INTERNAL_TOPICS + isInternalTopic (D-106, D-111)`)
   - 1 file creato: `frame-parser.ts` (140 LOC)
   - Verifica: vitest 15/15 PASS, tsc --noEmit exit 0, full suite 120/120 gateway + 654/654 monorepo.
3. **REFACTOR**: skip — codice già clean (parser puro 50 effective LOC, pattern allineato a `parseRetryAfter`). Nessun cambio di comportamento → nessun commit (TDD ortodosso).

**Plan metadata commit:** (questo SUMMARY + STATE/ROADMAP update — commit finale separato, vedi sezione "Final Commit").

## Files Created/Modified

### Created (3)

- `packages/gateway/src/sse-ws/types/frame-envelope.ts` (50 LOC)
  - `interface FrameEnvelope { readonly topic: string; readonly data: unknown; readonly id?: string }`
  - `type FrameParseResult = { readonly ok: true; readonly envelope: FrameEnvelope } | { readonly ok: false; readonly reason: 'malformed-json' | 'missing-topic' | 'invalid-shape'; readonly raw: string }`
  - JSDoc esteso con riferimento D-106, Q2 closure, link a step §28 mapping (plan 04-08), riferimento a PITFALL §11.7.

- `packages/gateway/src/sse-ws/frame-parser.ts` (140 LOC)
  - `export const INTERNAL_TOPICS: Readonly<{ readonly PING: '__ping__'; readonly PONG: '__pong__' }> = Object.freeze({ ... } as const)`
  - `export function parseFrame(raw: unknown): FrameParseResult` — 5 step deterministici (input check, JSON.parse guard, shape check, topic check, build envelope con id opt-string).
  - `export function isInternalTopic(topic: string): boolean` — strict equality, single-line implementation.
  - JSDoc esteso con threat coverage T-04-02-01..04, esempio uso completo, riferimento PITFALL §11.7 chiave anti-AP-6.

- `packages/gateway/src/sse-ws/frame-parser.test.ts` (142 LOC)
  - 2 `describe` block: `parseFrame` (10 test) + `isInternalTopic` (5 test).
  - Test numerati 1..15 con traceability esplicita al `<behavior>` del plan 04-02-PLAN.md.
  - Determinismo tier-1 jsdom: nessun setup async, nessun fixture esterno, run < 5ms.

### Modified (0)

**ZERO modifiche** a file esistenti. NON modificato:
- `packages/gateway/src/sse-ws/index.ts` (barrel) — `parseFrame`/`isInternalTopic`/`INTERNAL_TOPICS`/`FrameEnvelope`/`FrameParseResult` saranno esportati dal barrel quando il consumer 04-06 (websocket-adapter) sarà implementato. Per ora gli import sono interni al sub-package via path relativo `./frame-parser`. Il plan 04-06 estenderà `index.ts` come parte del proprio scope.
- `packages/gateway/src/sse-ws/types/index.ts` (types barrel) — stesso ragionamento: `FrameEnvelope`/`FrameParseResult` saranno aggiunti al re-export quando consumer-pubblici esistono.

Decisione coerente con D-101 composition wrapper preparation di 04-01: i runtime sono aggiunti incrementalmente, il barrel evolve plan-by-plan.

## Decisions Made

Tutte le decisioni implementate sono lockate da 04-CONTEXT.md (D-101..D-120) e dal plan 04-02-PLAN.md frontmatter. Riepilogo applicato:

- **D-106 envelope shape locked**: `{ topic: string non-vuoto, data: unknown, id?: string }`. Topic vuoto è esplicitamente rifiutato come `missing-topic` (Test 4) — più strict di "campo `topic` presente". `id` non-string è ignorato graceful (Test 10 — no crash, envelope.id undefined) — l'adapter 04-06 genererà via nanoid se mancante.
- **D-111 + PITFALL §11.7 chiusura Q1 closure**: strict equality match `topic === '__ping__' || topic === '__pong__'`. NO `startsWith('__')`, NO regex prefix `/^__/`, NO wildcard. Verifica via `grep -v "^//" frame-parser.ts | grep -c "startsWith('__')" = 0`. Test 13 (`weather.__ping__` → false) blocca regressione futura.
- **Q2 closure 04-CONTEXT**: scelto **riuso `network.error` esistente** (ERR-02 ext F3) invece di nuovo `realtime.protocol.error`. Il `FrameParseResult.reason` enum (`malformed-json`/`missing-topic`/`invalid-shape`) viene mappato dal consumer adapter 04-06 a `category: 'protocol'` nel `network.error` payload. Coerente con la preferenza esplicita di 04-CONTEXT.md "preferenza per riuso `network.error` esistente, salvo evidenze contrarie".
- **Input difensivo `unknown`**: parser accetta `raw: unknown` (non solo `string`) — `MessageEvent.data` è tipato `any` da DOM lib e può essere `ArrayBuffer`/`Blob`/`number` per protocolli misti. V1 supporta solo testo JSON (D-106) → input non-string ritorna `malformed-json` graceful con `raw: String(raw)` per debug. Pattern di defense-in-depth coerente con il principio "trust no one" della pipeline §28.
- **id non-string ignorato**: invece di rifiutare il frame come errore, l'envelope è valido senza `id` e l'adapter 04-06 genererà via nanoid (Test 10). Trade-off: un server malformatto che invia `id: 42` non crasha la pipeline ma perde la deduplica via dedupeKey. Documentato in JSDoc.
- **`Readonly<...>` type annotation esplicita** su `INTERNAL_TOPICS`: necessario per `--isolatedDeclarations` (TS5+ strict tsconfig F4 wide). Pattern replicabile per tutti gli `as const` frozen exported nei plan futuri F4.

## Deviations from Plan

**Minor — Rule 3 (TS strict typecheck blocking issues during GREEN)**

Durante GREEN ho hit 2 errori TS strict che richiedevano fix inline (entrambi sono blocking issues per il typecheck, non bug logici):

1. **TS4111 noPropertyAccessFromIndexSignature**: `obj.topic`/`obj.data`/`obj.id` non accessibili come dot-notation su `Record<string, unknown>` — richiesto bracket access `obj['topic']`.
   - **Fix**: estratto `const topic = obj['topic']` + `const data = obj['data']` + `const id = obj['id']` con narrow type check su variabili locali (più leggibile + soddisfa tsconfig F4).
   - **Files modified**: `packages/gateway/src/sse-ws/frame-parser.ts` (Step 4-5).
   - **Commit**: incluso nel commit GREEN (`edcbf3b`) — il fix è parte dell'impl finale, non un cambio post-hoc.

2. **TS9010 isolatedDeclarations**: `export const INTERNAL_TOPICS = Object.freeze({...} as const)` necessitava type annotation esplicita.
   - **Fix**: `export const INTERNAL_TOPICS: Readonly<{ readonly PING: '__ping__'; readonly PONG: '__pong__' }> = Object.freeze({...} as const)`.
   - **Files modified**: `packages/gateway/src/sse-ws/frame-parser.ts` (linea 42-46).
   - **Commit**: incluso nel commit GREEN (`edcbf3b`).

Entrambi i fix sono Rule 3 (blocking issue per il typecheck) e sono coerenti con il pattern Established in F1/F3 (`Readonly<...>` annotation + bracket access su `Record`). Nessuna deviazione di scope o di comportamento — i 15 test rimangono identici e passano dopo il fix.

**Nessun'altra deviazione** dal plan: il file frame-envelope.ts è copiato verbatim da PATTERNS.md §2.4, frame-parser.ts segue PATTERNS.md §2.5 (con bracket access fix), frame-parser.test.ts replica i 15 test specificati nel `<behavior>` del plan.

## Issues Encountered

- **TS strict `noPropertyAccessFromIndexSignature`**: tsconfig F4 wide (esteso da F3) include `noPropertyAccessFromIndexSignature: true` (best practice TypeScript). Il pattern `obj.topic` su `Record<string, unknown>` è rifiutato. Fix: bracket access `obj['topic']`. Risolto in <1min.
- **TS strict `--isolatedDeclarations`**: tsconfig F4 wide include `isolatedDeclarations: true` (PATTERNS.md F1 D-15). `Object.freeze({...} as const)` non ha tipo inferibile cross-file → richiede annotation esplicita. Fix: `Readonly<{...}>` annotation. Risolto in <1min.

Entrambi sono pattern noti nei plan F3 (`@gluezero/gateway` ha già queste regole su `http/`). Nessuna issue nuova rispetto al pattern Established.

## Verification Output

```
# 1. Test plan-specific (post GREEN)
pnpm --filter @gluezero/gateway test src/sse-ws/frame-parser.test.ts --run
#  Test Files  1 passed (1)
#       Tests  15 passed (15)
#    Duration  379ms

# 2. Typecheck gateway
pnpm --filter @gluezero/gateway exec tsc --noEmit
#  exit 0, no output

# 3. Full gateway suite (105 baseline + 15 nuovi)
pnpm --filter @gluezero/gateway test --run
#  Test Files  16 passed (16)
#       Tests  120 passed (120)
#    Duration  1.46s

# 4. Build clean (zero regressioni su subpath bundles)
pnpm --filter @gluezero/gateway clean && pnpm --filter @gluezero/gateway build
#  ESM dist/index.js              29.16 KB
#  ESM dist/http/index.js         29.00 KB
#  ESM dist/sse-ws/index.js       228.00 B
#  ESM dist/sse-ws/augment.js     232.00 B
#  ESM Build success in 70ms
#  DTS Build success in 590ms

# 5. Full monorepo regression
pnpm -r test --run
#  packages/core    test:  Tests 248 passed (248)
#  packages/mapper  test:  Tests 183 passed (183)
#  packages/routing test:  Tests 103 passed (103)
#  packages/gateway test:  Tests 120 passed (120)
#  TOTAL: 654/654 PASS

# 6. Test count assertion
grep -c "it(" packages/gateway/src/sse-ws/frame-parser.test.ts
#  15

# 7. Anti-AP-6 strict verify (no startsWith('__') in source code, comments excluded)
grep -v "^//" packages/gateway/src/sse-ws/frame-parser.ts | grep -v "^\s*\*" | grep -v "^\s*/\*" | grep -c "startsWith('__')"
#  0
```

## D-83 Strict Verification

```
git diff --name-only 26cc3c2~1..edcbf3b | grep -E "packages/(core|mapper|routing)/src/|packages/gateway/src/http/"
# (empty — zero matches)
```

**Risultato**: zero modifiche a `packages/{core,mapper,routing}/src/` né a `packages/gateway/src/http/`. Tutti i 3 file creati sono in `packages/gateway/src/sse-ws/`:
- `packages/gateway/src/sse-ws/types/frame-envelope.ts`
- `packages/gateway/src/sse-ws/frame-parser.ts`
- `packages/gateway/src/sse-ws/frame-parser.test.ts`

Conteggio invariati post-04-02:
- `packages/core/src/`: invariato (248 file, 248 test PASS)
- `packages/mapper/src/`: invariato (183 file, 183 test PASS)
- `packages/routing/src/`: invariato (103 test PASS)
- `packages/gateway/src/http/`: invariato (test count F3 incluso nei 120 totali gateway)

## Anti-AP-6 (PITFALL §11.7) Verification

**Chiusura Q1** della discussione 04-CONTEXT.md: il match dei topic interni deve essere strict equality, NON prefix.

```
# Source code dopo strip dei commenti — zero match
grep -v "^//" packages/gateway/src/sse-ws/frame-parser.ts \
  | grep -v "^\s*\*" \
  | grep -v "^\s*/\*" \
  | grep -c "startsWith('__')"
#  0

# Test esplicito blocca regressione futura
Test 13: isInternalTopic('weather.__ping__') === false
```

**Implementation**: `topic === INTERNAL_TOPICS.PING || topic === INTERNAL_TOPICS.PONG` (linea 137). Nessun `startsWith`, nessun regex `/^__/`, nessun wildcard.

## Hand-off per 04-06 (websocket-adapter.ts)

Il consumer plan 04-06 può ora importare:

```ts
// Internal sub-package import (consigliato per 04-06 perché co-located):
import { parseFrame, isInternalTopic, INTERNAL_TOPICS } from './frame-parser'
import type { FrameEnvelope, FrameParseResult } from './types/frame-envelope'

// Esempio uso:
ws.addEventListener('message', (ev) => {
  const result = parseFrame(ev.data)
  if (!result.ok) {
    publishFn({
      topic: 'network.error',
      payload: { reason: result.reason, raw: result.raw, channelName },
      source: { type: 'server', id: 'realtime-channel', name: 'websocket' },
    })
    return
  }
  if (isInternalTopic(result.envelope.topic)) {
    // Heartbeat handling: aggiorna lastPongReceivedAt o consume __ping__ → reply __pong__.
    handleHeartbeat(result.envelope)
    return
  }
  publishFn({
    topic: result.envelope.topic,
    payload: result.envelope.data,
    id: result.envelope.id, // opzionale, l'adapter genera via nanoid se undefined
    source: { type: 'server', id: 'realtime-channel', name: 'websocket' },
  })
})
```

**Note hand-off**:
- Il **byte-cap raw frame** (T-04-02-01 DoS mitigation) deve essere implementato in **04-06** (es. `if (raw.length > MAX_FRAME_BYTES) { publish network.error; return }` PRIMA di chiamare `parseFrame`). 04-02 NON impone cap (parser puro, nessun side-effect).
- Il **filter `system.realtime.*`** (T-04-02-05 spoofing mitigation: server invia falso `system.realtime.connected`) deve essere implementato in **04-06**: drop frame se `topic.startsWith('system.realtime.') && source.type === 'server'`.
- **Barrel export**: 04-06 estenderà `packages/gateway/src/sse-ws/index.ts` per esportare `parseFrame`/`isInternalTopic`/`INTERNAL_TOPICS`/`FrameEnvelope`/`FrameParseResult` come API pubblica.

## Self-Check: PASSED

- File `packages/gateway/src/sse-ws/types/frame-envelope.ts`: FOUND (50 LOC, contiene `interface FrameEnvelope` + `type FrameParseResult` discriminated union)
- File `packages/gateway/src/sse-ws/frame-parser.ts`: FOUND (140 LOC, contiene `export const INTERNAL_TOPICS` + `export function parseFrame` + `export function isInternalTopic`)
- File `packages/gateway/src/sse-ws/frame-parser.test.ts`: FOUND (142 LOC, 15 test in 2 describe block)
- Commit `26cc3c2` (RED test): FOUND in git log (`git log --oneline -5 | grep 26cc3c2` ✓)
- Commit `edcbf3b` (GREEN feat): FOUND in git log (`git log --oneline -5 | grep edcbf3b` ✓)
- Test result: 15/15 frame-parser test passing + 120/120 gateway suite + 654/654 monorepo full
- Typecheck: clean (exit 0, no errors)
- Anti-AP-6 verify: 0 occurrences of `startsWith('__')` o regex prefix in source code (commenti esclusi)
- D-83 strict: 0 violations
- Build: ESM 70ms + DTS 590ms, 5 entry points (index, augment, http/index, sse-ws/index, sse-ws/augment)

## Next Phase Readiness

- ✅ **Wave 2 plan 04-02 done**. I plan paralleli 04-03 (reconnect-strategy) e 04-04 (visibility-detector) sono indipendenti per file ownership e possono procedere/completarsi in parallelo.
- ✅ **04-06 (websocket-adapter) unblocked**: `parseFrame`/`isInternalTopic`/`INTERNAL_TOPICS`/`FrameEnvelope`/`FrameParseResult` disponibili per import interno.
- ✅ **04-08 (realtime-broker) parzialmente unblocked**: il contratto envelope è stabile; l'integrazione step §28 4 mapping canonical sarà concretizzata in 04-08 via `RouterBroker.publish`.
- ⏭️ **Run-time deferred**: byte-cap raw frame (T-04-02-01), filter `system.realtime.*` server-spoofing (T-04-02-05), heartbeat ping/pong scheduler (D-111 ping ogni 30s) — tutti nel scope di 04-06/04-08.

---
*Phase: 04-realtime-inbound-sse-prioritario-ws-opzionale*
*Plan: 04-02*
*Completed: 2026-05-04*
