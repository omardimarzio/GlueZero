---
phase: 04-realtime-inbound-sse-prioritario-ws-opzionale
plan: 04
subsystem: gateway/sse-ws
tags: [realtime, visibility-api, di-guard, lifecycle, tdd]
dependency_graph:
  requires:
    - "@gluezero/gateway runtime (plan 04-01)"
    - "globalThis.document (browser/jsdom)"
  provides:
    - "createVisibilityDetector factory + VisibilityDetector interface + VisibilityState type"
    - "VisibilityDetectorOptions con DI guard `document?: Document | null`"
  affects:
    - "Plan 04-07 (RealtimeChannelManager) — single shared instance, freshness check on visible"
tech-stack:
  added: []
  patterns:
    - "factory-with-closure (analog reconnect-strategy.ts F4 + circuit-breaker.ts F3)"
    - "listener tracking + removeEventListener cleanup (analog combine-signals.ts:62-86)"
    - "DI guard for environment without Document (Worker/SSR/iframe sandbox)"
    - "TDD RED→GREEN co-located test sibling (D-117)"
key-files:
  created:
    - packages/gateway/src/sse-ws/visibility-detector.ts
    - packages/gateway/src/sse-ws/visibility-detector.test.ts
  modified: []
decisions:
  - "DI guard 3-way: undefined → globalThis.document, null → no-op (Worker/SSR), Document mock → test injection"
  - "getState() ritorna 'visible' default sicuro quando doc=null (assumiamo visibile se non possiamo osservare)"
  - "Idempotenza esplicita: start() e stop() no-op se already-active/already-stopped (mitiga T-04-04-02/03)"
metrics:
  duration_seconds: 1092
  duration_human: "~18 min"
  completed_date: "2026-05-04"
  tasks_total: 1
  tasks_completed: 1
  files_created: 2
  files_modified: 0
  loc_source: 125
  loc_test: 150
  loc_total: 275
  tests_added: 11
  tests_passing: 11
  monorepo_tests_passing: 680
  commits:
    - "a74a9dc test(04-04): add failing tests for createVisibilityDetector (D-110, DI guard, idempotency)"
    - "1e1d34b feat(04-04): implement createVisibilityDetector with DI guard + cleanup pattern (D-110)"
requirements:
  - RT-05
---

# Phase 04 Plan 04-04: Visibility detector wrapper Summary

**One-liner:** Factory event-driven `createVisibilityDetector(opts)` che astrae la Visibility API con DI guard per environment senza `document` (Worker/SSR/iframe sandbox), idempotenza start/stop e cleanup garantito via `removeEventListener` puntuale — pattern listener tracking analog `combine-signals.ts` di F3.

## Obiettivo raggiunto

Implementazione del wrapper Visibility API (D-110, RESEARCH §5) come building block per il `RealtimeChannelManager` (plan 04-07): una singola istanza condivisa orchestra il "freshness check" su `visibilitychange → visible` di tutti i canali realtime attivi. Il detector è event-driven puro (nessun polling timer-based) e completamente testabile via dependency injection del `Document`.

## File creati

| File | LOC | Ruolo |
|------|-----|-------|
| `packages/gateway/src/sse-ws/visibility-detector.ts` | 125 | Factory + interface + DI guard |
| `packages/gateway/src/sse-ws/visibility-detector.test.ts` | 150 | 11 test deterministici TDD (jsdom tier-1) |

**Totale:** 275 LOC, 0 file modificati (additive-only — D-83 strict ✓).

## API pubblica

```typescript
export type VisibilityState = 'visible' | 'hidden'

export interface VisibilityDetectorOptions {
  readonly onChange: (state: VisibilityState) => void
  /**
   * - `undefined` (default) → `globalThis.document`
   * - `null` → explicit disable (Worker/SSR)
   * - `Document` mock → test injection
   */
  readonly document?: Document | null
}

export interface VisibilityDetector {
  start(): void          // idempotent
  stop(): void           // idempotent + cleanup garantito
  getState(): VisibilityState
  isActive(): boolean
}

export function createVisibilityDetector(opts: VisibilityDetectorOptions): VisibilityDetector
```

## TDD cycle visibile in git log

```
1e1d34b feat(04-04): implement createVisibilityDetector with DI guard + cleanup pattern (D-110)
a74a9dc test(04-04): add failing tests for createVisibilityDetector (D-110, DI guard, idempotency)
```

**RED gate verificato:** prima del commit GREEN, il test fallisce con `Failed to resolve import "./visibility-detector"` (file produzione non esiste). Il commit RED introduce SOLO il test; il commit GREEN introduce SOLO l'implementazione.

## Test coverage (11/11 PASS)

```
$ cd packages/gateway && pnpm test src/sse-ws/visibility-detector.test.ts --run
RUN  v4.1.5
Test Files  1 passed (1)
     Tests  11 passed (11)
  Duration  377ms
```

| # | Scenario | Verifica |
|---|----------|----------|
| 1 | Pre-start state | `isActive() === false` prima di `start()` |
| 2 | Lifecycle base | `start() → isActive=true`, `stop() → isActive=false` |
| 3 | Idempotenza start | 2x `start()` → `addEventListener` chiamata UNA volta (T-04-04-02) |
| 4 | Idempotenza stop | 2x `stop()` → `removeEventListener` chiamata UNA volta |
| 5 | Dispatch hidden | `visibilitychange` con `state='hidden'` → `onChange('hidden')` |
| 6 | Dispatch visible | `visibilitychange` con `state='visible'` → `onChange('visible')` |
| 7 | getState coerente | `getState()` ritorna stato corrente di `document.visibilityState` |
| 8 | DI guard null doc | `document: null` → `start()` no-op, `getState()` default 'visible' |
| 9 | DI guard isActive | `document: null` → `isActive()` resta `false` anche post-`start()` |
| 10 | Cleanup post-stop | dispatch event DOPO `stop()` NON invoca `onChange` (T-04-04-03) |
| 11 | DI isolation | `addEventListener` invocato sul `mockDoc` iniettato, NON sul `globalThis.document` (T-04-04-01) |

## Verifiche tecniche

| Check | Comando | Risultato |
|-------|---------|-----------|
| TDD test count | `grep -c "it(" visibility-detector.test.ts` | **11** (≥11 atteso ✓) |
| Anti-AP-5 (no polling) | `grep -v '^#' visibility-detector.ts \| grep -c "setInterval"` | **0** ✓ |
| No setTimeout (event-driven puro) | `grep -c "setTimeout" visibility-detector.ts` | **0** ✓ |
| Typecheck gateway | `pnpm exec tsc --noEmit` | exit 0 ✓ |
| Typecheck monorepo | `pnpm -r --parallel typecheck` | 4/4 packages PASS ✓ |
| Suite gateway | `pnpm test --run` | 146/146 PASS (18 file) ✓ |
| Suite monorepo full | `pnpm -r test --run` | **680/680** PASS ✓ |
| Build gateway (ESM+DTS) | `pnpm build` | Build success ✓ |
| Re-export `createVisibilityDetector` | acceptance criteria PLAN | named export presente ✓ |
| Re-export `VisibilityDetector` interface | acceptance criteria PLAN | named export presente ✓ |
| Re-export `VisibilityState` type | acceptance criteria PLAN | `'visible' \| 'hidden'` literal union ✓ |
| `addEventListener('visibilitychange'` presente | acceptance criteria PLAN | sì ✓ |
| `removeEventListener('visibilitychange'` presente | acceptance criteria PLAN | sì ✓ |
| Cronologia git RED+GREEN separati | acceptance criteria PLAN | `a74a9dc` + `1e1d34b` ✓ |

## Decisioni di implementazione

### 1. DI guard 3-way con normalizzazione anticipata

```typescript
const doc =
  opts.document === null
    ? null
    : opts.document !== undefined
      ? opts.document
      : typeof globalThis !== 'undefined' && 'document' in globalThis
        ? ((globalThis as { document?: Document }).document ?? null)
        : null
```

**Rationale:** la risoluzione del Document avviene UNA SOLA volta nel closure del factory, non ad ogni `start()/stop()/getState()`. Questo:
- Garantisce coerenza: se al momento del factory `globalThis.document` è disponibile, resta il riferimento usato anche se `globalThis.document` viene successivamente ridefinito (test isolation).
- Semplifica la logica downstream: tutti i metodi check `if (!doc)` invece di rivalutare la guard 3-way.
- Permette test 11 di funzionare: `globalSpy` su `globalThis.document.addEventListener` non viene mai chiamato perché `doc` punta a `mockDoc`.

### 2. Default sicuro `'visible'` su DI guard attivo

`getState()` ritorna `'visible'` quando `doc === null`. Rationale (RESEARCH §5.3): in un Worker o SSR non possiamo osservare la visibility — assumere `'hidden'` causerebbe il `RealtimeChannelManager` (plan 04-07) ad applicare ×3 stale timeout permanentemente, comportamento errato. Assumere `'visible'` mantiene il comportamento "normale" del manager.

### 3. Pattern listener tracking analog `combine-signals.ts`

```typescript
let active = false
let listener: (() => void) | null = null

start(): void {
  if (active || !doc) return
  const fn = (): void => { opts.onChange(read()) }
  listener = fn
  doc.addEventListener('visibilitychange', fn)
  active = true
},
stop(): void {
  if (!active || !doc || listener === null) return
  doc.removeEventListener('visibilitychange', listener)
  listener = null
  active = false
},
```

**Rationale:** memoize `listener` ref per `removeEventListener` puntuale. Se passassimo una funzione fresh a `removeEventListener` (es. `(): void => onChange(read())`), il browser non rimuoverebbe nulla (identity check). Pattern identico a `combine-signals.ts:62-86` (tracking handlers per cleanup).

### 4. Idempotenza esplicita con guard `if (active || !doc) return`

Mitigazione T-04-04-02 (memory leak start ripetuto): senza la guard `if (active)`, due `start()` consecutivi registrerebbero due listener. Test 3 verifica `addEventListener` chiamato UNA volta su 2 `start()`.

## Threat model — disposizioni applicate

| Threat ID | Categoria | Disposizione | Implementazione |
|-----------|-----------|--------------|-----------------|
| T-04-04-01 | Tampering Document mock | accept | DI esplicito; consumer responsabile. Test 11 verifica isolation `mockDoc` vs `globalThis.document`. |
| T-04-04-02 | Memory leak start ripetuto | mitigate ✓ | Guard `if (active) return` in `start()`. Test 3 verifica `addEventListener` count = 1 su 2 start. |
| T-04-04-03 | Memory leak no stop | mitigate ✓ | `stop()` rimuove via `removeEventListener` puntuale. Test 4+10 verificano cleanup. |
| T-04-04-04 | Information Disclosure | accept | `visibilityState` è API pubblica browser (no secret). |
| T-04-04-05 | Mobile freeze divergence | accept | Documentato in plan 04-09 come limitazione platform-level (Safari iOS background freeze). |

## Vincolo D-83 strict (zero modifiche fuori sse-ws)

```bash
$ git diff a74a9dc^ HEAD --stat -- packages/core/src packages/mapper/src packages/routing/src packages/gateway/src/http
# (nessun output — zero modifiche)
```

Tutte le modifiche sono nuovi file `additive-only` in `packages/gateway/src/sse-ws/`. Nessuna API esistente toccata.

## Deviations from Plan

**None — plan 04-04 eseguito esattamente come scritto.** L'unico aggiustamento minore è stato riformulare 2 commenti che contenevano la stringa letterale `setInterval` (didascalica nell'anti-pattern AP-5 reference) per garantire compliance al check `grep -c "setInterval" === 0` anche senza filtro di linea-commento — il PLAN richiede il check con `grep -v '^#'` ma per robustezza preferiamo zero occorrenze totali. Cambiamento puramente cosmetico.

## Hand-off note per plan 04-07 (RealtimeChannelManager)

Il manager può importare `createVisibilityDetector` direttamente dal modulo:

```typescript
import { createVisibilityDetector } from './visibility-detector'

// Single shared instance per manager
const visibility = createVisibilityDetector({
  onChange: (state) => {
    if (state === 'visible') manager.checkFreshnessAll()  // D-110 freshness check
    else manager.applyStaleTolerance(3)                    // D-110 ×3 timeout on hidden
  }
})
visibility.start()

// Cleanup teardown (D-112 cascade)
manager.onDestroy(() => visibility.stop())
```

**Casi limite gestiti dal detector:**
- Worker/SSR senza `document` → manager riceve `null` consapevolmente (`document: null` in opts) → detector no-op + getState() 'visible' default → manager comportamento normale.
- Multiple subscribers: il manager è UNICO consumer; non serve fan-out interno (pattern 1:1 detector→manager).

## Self-Check

**Created files:**
- `packages/gateway/src/sse-ws/visibility-detector.ts` — FOUND ✓
- `packages/gateway/src/sse-ws/visibility-detector.test.ts` — FOUND ✓

**Commits:**
- `a74a9dc` (RED test) — FOUND ✓
- `1e1d34b` (GREEN feat) — FOUND ✓

**Verification commands:**
- `pnpm test src/sse-ws/visibility-detector.test.ts --run` → 11/11 PASS ✓
- `pnpm -r test --run` → 680/680 PASS (zero regressioni) ✓
- `pnpm exec tsc --noEmit` → exit 0 ✓
- `pnpm build` → ESM+DTS success ✓

## Self-Check: PASSED
