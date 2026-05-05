---
phase: 04-realtime-inbound-sse-prioritario-ws-opzionale
plan: 03
subsystem: gateway/sse-ws/reconnect-strategy
tags: [reconnect, full-jitter, fallback, state-machine, tdd, D-107, D-109, Q3]
dependency_graph:
  requires:
    - "@gluezero/gateway/sse-ws (Plan 04-01 bootstrap)"
  provides:
    - "createReconnectStrategy(options) factory"
    - "ReconnectStrategy interface (8 metodi)"
    - "ReconnectStrategyOptions config"
  affects: []
tech_stack:
  added: []
  patterns:
    - "factory + closure state (analog circuit-breaker.ts F3)"
    - "full jitter formula AWS Architecture Blog (analog retry-strategy.ts F3)"
    - "DI random + now per test deterministici"
    - "TDD RED→GREEN con vi.useFakeTimers()"
key_files:
  created:
    - packages/gateway/src/sse-ws/reconnect-strategy.ts
    - packages/gateway/src/sse-ws/reconnect-strategy.test.ts
  modified: []
decisions:
  - "D-107 lockata (auto-fallback SSE→WS default V1, threshold 3, cycle cap 5)"
  - "D-109 lockata (full jitter base 1000ms, cap 30000ms, maxAttempts default Infinity)"
  - "Q3 §6.2 chiusa (consolidationMs default 5000ms — opzione B anti-flap)"
metrics:
  duration_minutes: 4
  completed_date: 2026-05-04
  tasks: 1
  files: 2
  loc_added: 407
  test_count: 15
  test_pass: "15/15 (100%)"
  monorepo_test: "669/669 (era 654 prima di 04-03, +15)"
requirements_completed:
  - RT-05
  - RT-07
---

# Phase 4 Plan 03: Reconnect strategy state machine (full jitter + auto-fallback SSE↔WS + consolidationMs reset) Summary

**One-liner:** `createReconnectStrategy()` factory implementa state machine reconnect per-canale combinando full jitter backoff (D-109, formula AWS), auto-fallback SSE↔WS (D-107, threshold 3 + cycle cap 5) e reset criteria con consolidationMs guard anti-flap (Q3 §6.2 default 5000ms), interamente custom (no lib `reconnecting-websocket` per vincolo PRD §31.3).

## Cosa è stato fatto

Plan 04-03 implementa 1 file source + 1 file test co-located, secondo pattern TDD obbligatorio (D-117 ext D-88/D-92 da F3). Due commit atomici visibili in cronologia git: RED (test) e GREEN (impl).

### File creati

| File | LOC | Contenuto |
|------|-----|-----------|
| `packages/gateway/src/sse-ws/reconnect-strategy.ts` | 238 | Factory `createReconnectStrategy` + interface `ReconnectStrategy` + `ReconnectStrategyOptions` + commenti dottrinali sui threat (T-04-03-01..04) |
| `packages/gateway/src/sse-ws/reconnect-strategy.test.ts` | 169 | 15 test deterministici TDD organizzati in 4 describe block (full jitter math, auto-fallback state machine, reset criteria con consolidationMs guard, reset() + initialMode) |

### Public API (lockata)

```typescript
export interface ReconnectStrategy {
  nextDelayMs(): number          // formula full jitter D-109
  recordFailure(): void          // increment consecutive + total
  recordSuccess(): void          // reset counter SOLO se trascorso consolidationMs
  shouldFallback(): boolean      // true se consecutive >= threshold AND cycles < cap
  fallback(): 'sse' | 'websocket' // switch mode + reset consecutive + increment cycles
  getMode(): 'sse' | 'websocket'
  isPermanentlyFailed(): boolean // cycles >= cap OR totalAttempts >= maxAttempts
  reset(): void
}

export interface ReconnectStrategyOptions {
  readonly baseMs?: number              // default 1_000 (D-109)
  readonly capMs?: number               // default 30_000 (D-109)
  readonly consolidationMs?: number     // default 5_000 (Q3 §6.2)
  readonly maxAttempts?: number         // default Number.POSITIVE_INFINITY (RT-05)
  readonly fallbackThreshold?: number   // default 3 (D-107)
  readonly globalCycleCap?: number      // default 5 (D-107)
  readonly initialMode?: 'sse' | 'websocket' // default 'sse' (D-107 SSE-first)
  readonly random?: () => number        // DI Math.random
  readonly now?: () => number           // DI Date.now
}

export function createReconnectStrategy(options?: ReconnectStrategyOptions): ReconnectStrategy
```

## Output verification

### Test suite (15/15 PASS)

```
> @gluezero/gateway test packages/gateway/src/sse-ws/reconnect-strategy.test.ts

 Test Files  1 passed (1)
      Tests  15 passed (15)
   Duration  370ms
```

Suddivisione test:

| Describe block | Test count | Coverage |
|----------------|------------|----------|
| full jitter math (D-109 + RT-05) | 3 | base case, post-1-fail, cap a capMs con random=0.999 |
| auto-fallback state machine (D-107) | 6 | threshold 3, sub-threshold, sse→ws, ws→sse round-trip, counter reset, cycle cap 5 |
| reset criteria con consolidationMs guard (Q3 §6.2) | 3 | anti-flap entro 1s, reset dopo 6s, maxAttempts cap |
| reset() + initialMode | 3 | reset state completo, default 'sse' (D-107 SSE-first), override 'websocket' |

### Gateway suite (135/135 PASS — zero regressioni)

```
 Test Files  17 passed (17)
      Tests  135 passed (135)   ← era 120 prima di 04-03 (+15)
```

### Monorepo full suite (669/669 PASS — zero regressioni)

```
core:    248 passed (24 files)
mapper:  183 passed (16 files)
gateway: 135 passed (17 files)   ← +15 vs 120 baseline post-04-02
routing: 103 passed (16 files)
TOTAL:   669/669
```

### Typecheck monorepo (clean)

```
core typecheck: Done
mapper typecheck: Done
gateway typecheck: Done
routing typecheck: Done
```

### Anti-pattern AP-3 verificato

```bash
$ grep -E "^(import|require).*reconnecting-websocket" packages/gateway/src/sse-ws/reconnect-strategy.ts
# (no match — exit 1)
```

L'unico match `reconnecting-websocket` nel file è il commento documentale `// Anti-AP-3: NO import...` che documenta esplicitamente il vincolo PRD §31.3 / STACK.md.

## TDD RED→GREEN gate compliance

Cronologia git mostra 2 commit separati (D-117 strict):

| Gate | Hash | Type | Subject |
|------|------|------|---------|
| RED | `cfe6020` | test | `add failing tests for createReconnectStrategy (D-107, D-109, Q3)` |
| GREEN | `d3b3921` | feat | `implement createReconnectStrategy state machine (...)` |

RED gate verificato con `Failed to resolve import "./reconnect-strategy"` prima della creazione del file source. GREEN gate verificato con 15/15 PASS dopo creazione.

## Threat coverage applicata

| Threat ID | Categoria | Disposition | Mitigation |
|-----------|-----------|-------------|------------|
| T-04-03-01 | DoS thundering herd | mitigate | Full jitter `random(0, exp)` distribuzione uniforme — Test 1-3 |
| T-04-03-02 | DoS reconnect storm permanente | mitigate | `globalCycleCap: 5` + `maxAttempts` + `isPermanentlyFailed()` — Test 9, 12 |
| T-04-03-03 | Tampering Math.random predicibile | accept | Documentato (browser non-cryptographic OK per jitter spread) |
| T-04-03-04 | Repudiation timing reset ambiguo | mitigate | `consolidationMs: 5_000` default + override-abile — Test 10, 11 |

## Vincoli rispettati

- **D-83 strict (ZERO modifiche fuori `packages/gateway/src/sse-ws/`):** verificato — nessun touch a `packages/{core,mapper,routing}/src/` o `packages/gateway/src/http/`. Solo 2 file nuovi nel subpath `sse-ws/`.
- **D-117 TDD RED→GREEN:** 2 commit separati visibili in `git log`.
- **AP-3 (no `reconnecting-websocket`):** verificato via grep import strict.
- **Lingua CLAUDE.md:** italiano per JSDoc descrittivi e commenti dottrinali; inglese per identifier, codice, error keywords, log keywords.

## Deviations from Plan

**None — plan executed exactly as written.**

Tutti e 15 i test, le interface signatures, le default values, le formule e i pattern sono stati implementati esattamente come specificato nel plan PLAN.md. Nessun fix Rule 1/2/3 applicato perché il plan è risultato self-contained e privo di ambiguità.

## Hand-off note per Wave 3 (plan 04-05/04-06)

I plan adapter SSE (04-05) e WebSocket (04-06) possono importare:

```typescript
import { createReconnectStrategy, type ReconnectStrategy } from './reconnect-strategy'
```

dal subpath relativo `packages/gateway/src/sse-ws/`. Pattern d'uso canonico (vedi JSDoc `@example` di `createReconnectStrategy`):

```typescript
const r = createReconnectStrategy({ initialMode: 'sse', maxAttempts: 50 })
while (!connected && !r.isPermanentlyFailed()) {
  await sleep(r.nextDelayMs())
  try {
    await connect(r.getMode())
    r.recordSuccess()
    connected = true
  } catch {
    r.recordFailure()
    if (r.shouldFallback()) r.fallback()
  }
}
if (r.isPermanentlyFailed()) {
  broker.publish({ topic: 'system.realtime.failed', source: 'system:realtime', data: {...} })
}
```

Plan 04-07 (`RealtimeChannelManager` + `runReconnectLoop`) consumerà la stessa interface da N canali in parallelo (uno per channel-def via `RealtimeConfig.channels`), con state isolato per-channel via closure.

## Self-Check: PASSED

**Files exist:**
- `packages/gateway/src/sse-ws/reconnect-strategy.ts` ✓ (238 LOC)
- `packages/gateway/src/sse-ws/reconnect-strategy.test.ts` ✓ (169 LOC)

**Commits exist:**
- `cfe6020` (RED test) ✓
- `d3b3921` (GREEN feat) ✓

**Acceptance criteria del plan:**
- [x] File `reconnect-strategy.ts` esiste e contiene `export function createReconnectStrategy`
- [x] File `reconnect-strategy.ts` esiste e contiene `export interface ReconnectStrategy`
- [x] File `reconnect-strategy.ts` esiste e contiene `export interface ReconnectStrategyOptions`
- [x] Formula full jitter `Math.floor(random() * Math.min(capMs, baseMs * 2 ** state.consecutiveFailures))` presente
- [x] `globalCycleCap` (D-107 cap) presente
- [x] `consolidationMs` (Q3) presente
- [x] NO import `reconnecting-websocket` (anti-AP-3)
- [x] File `.test.ts` contiene ≥15 `it(` (count: 15)
- [x] File `.test.ts` usa `vi.useFakeTimers()` per deterministic timing
- [x] `pnpm test` exit 0 con tutti i test passing (15/15 specifici, 135/135 gateway, 669/669 monorepo)
- [x] `pnpm typecheck` exit 0 (clean su tutto il monorepo)
- [x] Cronologia git mostra 2 commit separati 04-03: RED + GREEN
