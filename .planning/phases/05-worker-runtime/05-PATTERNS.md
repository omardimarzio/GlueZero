# Phase 5: Worker Runtime — PATTERNS

**Phase:** 05-worker-runtime
**Generated:** 2026-05-04
**Source CONTEXT.md decisions:** D-121..D-154 (34 decisioni lockate)
**Source RESEARCH.md:** §3 architettura, §4 Comlink deep-dive, §5 pool, §6 serialization, §7 pipeline, §8 plan, §9 test 3-tier
**Files mapped:** 35 file (7 source core + 1 augment + 1 factory + 7 type defs + 9 unit test + 1 mock-worker + 8 integration test + 1 browser test + 1 worker test artifact + config files)
**Analogs:** F1/F2 (composition base), F3 (D-83 strict + dispatch + strategies), F4 (composition wrapper + 3-tier test + cascade)

**Convenzioni di matching:**
- **exact** — stesso ruolo + stesso data flow + stessa architettura → copia verbatim adattando nomi
- **role-match** — stesso ruolo, dati simili → copia struttura, riformula contenuto
- **pattern-only** — copia algoritmo/idea, file fisicamente diverso

---

## File Inventory (proposed)

### Wave 1 — Bootstrap pkg + types + augment (plan 05-01)

| File | Role | Data flow | Analog | Match |
|------|------|-----------|--------|-------|
| `packages/worker/package.json` | Config | manifest | `packages/gateway/package.json` (multi-export) → ridotto a single `.` (no `./http`/`./sse-ws` subpath in F5) | role-match |
| `packages/worker/tsup.config.ts` | Config | build | `packages/gateway/tsup.config.ts` | role-match |
| `packages/worker/tsconfig.json` | Config | typecheck | `packages/gateway/tsconfig.json` | exact |
| `packages/worker/vitest.config.ts` | Config | test runner Tier-1 | `packages/gateway/vitest.config.ts` | exact |
| `packages/worker/vitest.browser.config.ts` | Config | test runner Tier-3 | `packages/gateway/vitest.browser.config.ts` | exact |
| `packages/worker/biome.json` | Config | lint/format | (workspace inherit) | exact |
| `packages/worker/src/index.ts` | Barrel | re-export | `packages/gateway/src/sse-ws/index.ts` | role-match |
| `packages/worker/src/augment.ts` | Augment | TS decl merging | `packages/gateway/src/sse-ws/augment.ts` | exact |
| `packages/worker/src/augment.test.ts` | Test (smoke decl merging) | type-only | `packages/gateway/src/sse-ws/augment.test.ts` | exact |
| `packages/worker/src/types/worker-descriptor.ts` | Type | shape | `packages/gateway/src/sse-ws/types/realtime-channel-def.ts` | role-match |
| `packages/worker/src/types/worker-config.ts` | Type | shape | `packages/gateway/src/sse-ws/types/realtime-config.ts` | role-match |
| `packages/worker/src/types/route-worker-definition.ts` | Type | shape (route extension) | `packages/routing/src/types/route-definition.ts` (RouteHttpDefinition) | role-match |
| `packages/worker/src/types/progress-payload.ts` | Type | shape (canonical schema) | `packages/gateway/src/sse-ws/types/frame-envelope.ts` | role-match |
| `packages/worker/src/types/task-state.ts` | Type | enum + outcome | `packages/routing/src/types/route-outcome.ts` | role-match |
| `packages/worker/src/types/index.ts` | Barrel | type re-export | `packages/gateway/src/sse-ws/types/index.ts` | exact |

### Wave 2 — Building blocks A (plan 05-02) + B (plan 05-03)

| File | Role | Data flow | Analog | Match |
|------|------|-----------|--------|-------|
| `packages/worker/src/assert-serializable.ts` | Source — pure validator | input → throw/pass | `packages/gateway/src/sse-ws/frame-parser.ts` (pure parser, no throw → discriminated result) — F5 inverte: throw su violation | pattern-only |
| `packages/worker/src/assert-serializable.test.ts` | Test (TDD RED→GREEN) | unit deterministic | `packages/gateway/src/sse-ws/frame-parser.test.ts` | role-match |
| `packages/worker/src/transferable-extractor.ts` | Source — pure extractor | input → list | `packages/gateway/src/http/retry-after-parser.ts` (pure parser, narrow input/output) | pattern-only |
| `packages/worker/src/transferable-extractor.test.ts` | Test | unit | `packages/gateway/src/http/retry-after-parser.test.ts` | role-match |
| `packages/worker/src/task-tracker.ts` | Source — state machine factory | state lookup atomic CAS | `packages/gateway/src/http/strategies/circuit-breaker.ts` (state machine 3-states con `Map<key,State>` + closure factory) | exact |
| `packages/worker/src/task-tracker.test.ts` | Test | unit FSM | `packages/gateway/src/http/strategies/circuit-breaker.test.ts` | exact |

### Wave 3 — Adapters A (plan 05-04) + B (plan 05-05)

| File | Role | Data flow | Analog | Match |
|------|------|-----------|--------|-------|
| `packages/worker/src/worker-bridge.ts` | Source — RPC wrapper + lifecycle | input → Worker postMessage → output | `packages/gateway/src/sse-ws/sse-adapter.ts` (DI external constructor `EventSourceCtor` + lazy lifecycle + AbortController integration) | exact |
| `packages/worker/src/worker-bridge.test.ts` | Test (TDD) | unit Tier-1 jsdom + mock | `packages/gateway/src/sse-ws/sse-adapter.test.ts` | exact |
| `packages/worker/src/test-utils/mock-worker.ts` | Test util | mock Worker | `packages/gateway/src/sse-ws/test-utils/mock-event-source.ts` (DI replacement, `__open`/`__message`/`__error` test helpers + `byChannelName` Map) | exact |
| `packages/worker/src/worker-pool.ts` | Source — bounded pool + queue | acquire/release/respawn | `packages/gateway/src/sse-ws/realtime-channel-manager.ts` (registry N entries + cascade + lifecycle) + `packages/gateway/src/http/strategies/backpressure-strategy.ts` (queue + AbortController per task) | role-match (split) |
| `packages/worker/src/worker-pool.test.ts` | Test | unit pool lifecycle | `packages/gateway/src/sse-ws/realtime-channel-manager.test.ts` | role-match |

### Wave 4 — Composition + integration (plan 05-06)

| File | Role | Data flow | Analog | Match |
|------|------|-----------|--------|-------|
| `packages/worker/src/worker-registry.ts` | Source — Map<id, descriptor> + cascade | register/get/unregisterByOwner | `packages/gateway/src/sse-ws/realtime-channel-manager.ts` (registry + `disconnectByOwner` cascade D-112) | exact |
| `packages/worker/src/worker-registry.test.ts` | Test | unit | `packages/gateway/src/sse-ws/realtime-channel-manager.test.ts` (registry portion) | role-match |
| `packages/worker/src/worker-handler.ts` | Source — Strategy F3 dispatch | event → registry → pool → bridge → outcome | `packages/routing/src/route-handlers/local-handler.ts` (Strategy injectable in `RouteExecutorDeps`) + `packages/routing/src/outcome-collector.ts` (outcome shape D-80) | pattern-only |
| `packages/worker/src/worker-handler.test.ts` | Test | unit dispatch flow | `packages/routing/src/route-executor.test.ts` (dispatch table tests) | role-match |
| `packages/worker/src/worker-broker.ts` | Source — composition wrapper | publish intercept + cascade plugin override | `packages/gateway/src/sse-ws/realtime-broker.ts` (composition wrapper di `RouterBroker` + cascade D-112) | exact |
| `packages/worker/src/worker-broker.test.ts` | Test | unit composition + cascade | `packages/gateway/src/sse-ws/realtime-broker.test.ts` | exact |
| `packages/worker/src/public-factory.ts` | Source — factory + Valibot safeParse | config → Broker | `packages/gateway/src/sse-ws/public-factory.ts` (`createRealtimeBroker` con `safeParse`) | exact |
| `packages/worker/src/public-factory.test.ts` | Test | factory validation | `packages/gateway/src/sse-ws/public-factory.test.ts` | exact |
| `packages/worker/src/test-utils/worker-harness.ts` | Test util | end-to-end fixture | `packages/gateway/src/sse-ws/test-utils/realtime-harness.ts` (collect events + global patch + reset) | exact |
| `packages/worker/src/__integration__/dedicated.test.ts` (D-151 #1) | Integration | T1 jsdom + MockWorker | `packages/routing/src/__integration__/scenario-meteo-http.test.ts` | role-match |
| `packages/worker/src/__integration__/pool-concurrent.test.ts` (D-151 #2) | Integration | T1 | `packages/routing/src/__integration__/concurrency-latest-only.test.ts` | role-match |
| `packages/worker/src/__integration__/timeout-strict.test.ts` (D-151 #3) | Integration | T1 deterministic | `packages/routing/src/__integration__/retry-policy.test.ts` | role-match |
| `packages/worker/src/__integration__/cancel-cooperative.test.ts` (D-151 #4) | Integration | T1 + signal proxy | `packages/routing/src/__integration__/concurrency-latest-only.test.ts` | role-match |
| `packages/worker/src/__integration__/cancel-hard.test.ts` (D-151 #5) | Integration | T1 + terminate | (no analog — F5 first) | pattern-only |
| `packages/worker/src/__integration__/serialization-fail.test.ts` (D-151 #6) | Integration | T1 + assertSerializable | (no analog — F5 first) | pattern-only |
| `packages/worker/src/__integration__/cascade-cleanup.test.ts` (D-151 #8) | Integration | T1 + unregisterPlugin | `packages/routing/src/__integration__/route-cascade-cleanup.test.ts` | exact |
| `packages/worker/src/__integration__/backpressure-storm.test.ts` (D-151 #9) | Integration | T1 + critical bypass | `packages/gateway/src/sse-ws/__integration__/` (backpressure scenarios F4) | role-match |
| `packages/worker/src/__browser__/test-worker.ts` | Test artifact (Worker source) | Comlink.expose API | (no analog — F5 first) | pattern-only |
| `packages/worker/src/__browser__/playwright-worker-smoke.test.ts` (D-151 #7) | Test Tier-3 Playwright | Worker reale + transferable | `packages/gateway/src/sse-ws/__browser__/playwright-sse-smoke.test.ts` | exact |

### Wave 5/Final — Final gate (plan 05-07)

| File | Role | Data flow | Analog | Match |
|------|------|-----------|--------|-------|
| `docs/DOC-04.md` (UPDATE) | Doc | append §Worker | F4 update di DOC-04 §Realtime | role-match |
| `docs/DOC-05.md` (UPDATE) | Doc | append scenario CSV/report | F4 update di DOC-05 §Realtime | role-match |
| `.planning/REQUIREMENTS.md` (UPDATE) | Project doc | WK-01..WK-07 → Complete | F4 update RT-01..RT-07 | exact |
| `.planning/STATE.md` (UPDATE) | Project doc | F5 closure | F4 closure pattern | exact |
| `.planning/ROADMAP.md` (UPDATE) | Project doc | Phase 5 done | F4 closure pattern | exact |
| `.planning/phases/05-worker-runtime/05-SUMMARY.md` | Phase doc | gate report | `.planning/phases/04-realtime-inbound-sse-prioritario-ws-opzionale/04-SUMMARY.md` | exact |

---

## Per-File Pattern Map

### `packages/worker/package.json` (Wave 1, plan 05-01)

**Role:** Config — pkg manifest
**Analog:** `packages/gateway/package.json`
**Match:** role-match — F5 single barrel (no `./http`/`./sse-ws` subpath; gateway ne ha 2)
**Decisioni:** D-122 (deps comlink/nanoid/valibot), D-147 (`type: module`), D-150 (browser test config)

**Code excerpt analog (`packages/gateway/package.json:1-72`):**
```json
{
  "name": "@gluezero/gateway",
  "version": "0.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } },
  "sideEffects": ["./dist/augment.js", "./src/augment.ts", "**/augment.js", "**/augment.ts"],
  "engines": { "node": ">=20" },
  "scripts": {
    "build": "tsup",
    "test": "vitest run --passWithNoTests",
    "test:browser": "vitest run --config vitest.browser.config.ts --passWithNoTests",
    "test:coverage": "vitest run --coverage --passWithNoTests",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@gluezero/core": "workspace:*",
    "@gluezero/mapper": "workspace:*",
    "@gluezero/routing": "workspace:*",
    "nanoid": "5.1.9",
    "valibot": "1.3.1"
  },
  "devDependencies": { "@vitest/browser": "4.1.5", "vitest": "4.1.5", "tsup": "8.5.1" }
}
```

**Adattamento F5:**
- name → `@gluezero/worker`
- aggiungi dep runtime `comlink: "4.4.2"` (D-125 lockata RESEARCH §2.1)
- preserva `sideEffects` glob `**/augment.ts` (Pattern S1 anti-tree-shake)
- single `exports` `.` (no subpath: F5 è single-purpose)

---

### `packages/worker/src/index.ts` (Wave 1, plan 05-01) — Barrel

**Analog:** `packages/gateway/src/sse-ws/index.ts`
**Match:** role-match (struttura identica, contenuto F5)
**Decisioni:** D-121 (composition wrapper API), D-122 (`createWorkerBroker`), Pattern S1 anti-tree-shake `__augmentSseWsLoaded` → `__augmentWorkerLoaded`

**Code excerpt analog (`packages/gateway/src/sse-ws/index.ts:32-72`):**
```ts
// Side-effect import — abilita TS declaration merging per BrokerConfig.realtime
// + PluginDescriptor.realtimeChannels (D-103). Pattern S1 anti tree-shaking.
export { __augmentSseWsLoaded, type F4PipelineStep } from './augment'
// ---------- Runtime export: parser ----------
export { INTERNAL_TOPICS, isInternalTopic, parseFrame } from './frame-parser'
export { createRealtimeBroker } from './public-factory'
export { RealtimeBroker, type RealtimeBrokerConfig } from './realtime-broker'
// ---------- Runtime export: manager + broker + factory ----------
export {
  RealtimeChannelManager,
  type RealtimeChannelManagerDebugInfo,
  type RealtimeChannelManagerDeps,
} from './realtime-channel-manager'
// ---------- Runtime export: state machines ----------
export {
  createReconnectStrategy,
  type ReconnectStrategy,
  type ReconnectStrategyOptions,
} from './reconnect-strategy'
// ---------- Runtime export: adapters (consumer avanzati) ----------
export { SseAdapter, type SseAdapterDeps } from './sse-adapter'
```

**Adattamento F5:** export `createWorkerBroker`, `WorkerBroker`, `WorkerRegistry`, `WorkerPool`, `WorkerBridge`, `TaskTracker`, `assertSerializable`, `extractTransferables`, `INTERNAL_TOPICS_WORKER` (`__cancel__`/`__progress__` D-131/137), `F5PipelineStep` literal union, `__augmentWorkerLoaded`.

---

### `packages/worker/src/augment.ts` (Wave 1, plan 05-01) — Declaration merging

**Analog:** `packages/gateway/src/sse-ws/augment.ts`
**Match:** **exact** — copy struttura verbatim, sostituisci `realtime`/`realtimeChannels` con `workers`/`workers[]`
**Decisioni:** D-126 (PluginDescriptor.workers), D-122 (BrokerConfig.workers), D-152 (RouteWorkerDefinition non mergeable in union → consumer dichiara superset), Pattern S1

**Code excerpt analog (`packages/gateway/src/sse-ws/augment.ts:36-105`):**
```ts
import type { RealtimeChannelDef } from './types/realtime-channel-def'
import type { RealtimeConfig } from './types/realtime-config'

declare module '@gluezero/core' {
  /** F4 augmentation (D-102, PRD §27): aggiunge la sezione `realtime` a `BrokerConfig`. */
  interface BrokerConfig {
    /** Sezione `realtime` (D-102, PRD §16.2/§18.3-18.4): config canali SSE/WS multi-channel. */
    realtime?: RealtimeConfig
  }

  /** F4 augmentation (D-103, RT-01): PluginDescriptor.realtimeChannels. */
  interface PluginDescriptor {
    /** Canali realtime auto-registrati al `registerPlugin` con `ownerId = pluginId` (D-103). */
    readonly realtimeChannels?: readonly RealtimeChannelDef[]
  }
}

/**
 * F4 PipelineStep — eventi step §28 emessi dagli adapter SSE/WS (D-113 ingress).
 *
 * **Limitazione TS**: `PipelineStep` di `@gluezero/core` è un type alias literal union, NON
 * un'interface — TS non supporta declaration merging di type alias. Soluzione: il consumer
 * che dichiara tap F4 importa questo super-set additive...
 */
export type F4PipelineStep =
  | 'event.realtime.received'
  | 'event.realtime.frame-parsed'
  | 'event.realtime.reconnecting'

/** Marker const esportato per detection runtime del side-effect import. */
export const __augmentSseWsLoaded: true = true
```

**Adattamento F5 (D-126/D-122/D-152):**
```ts
// Pseudo-template
declare module '@gluezero/core' {
  interface BrokerConfig {
    /** Sezione `workers` (D-122, PRD §19): config runtime worker (assertSerializable mode, defaults). */
    workers?: WorkerConfig
  }
  interface PluginDescriptor {
    /** F5 augmentation (D-126): worker auto-registrati con ownerId=pluginId al registerPlugin. */
    readonly workers?: readonly WorkerDescriptor[]
  }
}
export type F5PipelineStep =
  | 'event.worker.dispatched'
  | 'event.worker.progress'
  | 'event.worker.completed'
  | 'event.worker.failed'
export const __augmentWorkerLoaded: true = true
```

**Nota R4 (RESEARCH §17):** `RouteDefinition` union NON merge-abile — `RouteWorkerDefinition` esportato a parte e consumer dichiara `type AllRoutes = F3RouteDefinition | RouteWorkerDefinition` localmente.

---

### `packages/worker/src/types/worker-descriptor.ts` (Wave 1, plan 05-01)

**Analog:** `packages/gateway/src/sse-ws/types/realtime-channel-def.ts`
**Match:** role-match — pattern "shape descriptor con `name`/`id` chiave registry + factory hook + policy override"
**Decisioni:** D-123 (factory `() => Worker`), D-124 (tasks readonly), D-127 (mode), D-147 (workerType)

**Code excerpt analog (`packages/gateway/src/sse-ws/types/realtime-channel-def.ts:38-55`):**
```ts
export type RealtimeMode = 'sse' | 'websocket' | 'auto'

export interface RealtimeReconnectConfig {
  readonly baseMs?: number
  readonly capMs?: number
  readonly fallbackThreshold?: number
  readonly globalCycleCap?: number
}

export interface RealtimeChannelDef {
  readonly name: string  // chiave registry
  readonly mode?: RealtimeMode
  readonly buildUrl?: () => Promise<string>  // factory async D-104
  readonly url?: string
  readonly reconnect?: RealtimeReconnectConfig
  // ... etc
}
```

**Adattamento F5:**
```ts
export type WorkerMode = 'dedicated' | 'pool'  // D-127
export type WorkerType = 'module' | 'classic'  // D-147

export interface WorkerDescriptor {
  readonly id: string                              // chiave registry
  readonly factory: () => Worker                   // D-123 lazy
  readonly tasks: readonly string[]                // D-124 fail-fast
  readonly mode?: WorkerMode                       // D-127 default 'pool'
  readonly size?: number                           // D-127 pool size
  readonly allowUnboundedPool?: boolean            // D-128 opt-in
  readonly workerType?: WorkerType                 // D-147 default 'module'
  readonly cancelGraceMs?: number                  // D-131 default 2000
}
```

---

### `packages/worker/src/types/route-worker-definition.ts` (Wave 1, plan 05-01)

**Analog:** `packages/routing/src/types/route-definition.ts` (specifico `RouteHttpDefinition`)
**Match:** role-match — replica struttura RouteDefinition F3 (id/topic/policies/publishes) ridotta al subset D-143 + extension F5-specific
**Decisioni:** D-143 (subset policies), D-141 (transferable), D-137 (progressThrottleMs), D-146 (publishes override)

**Adattamento F5 (RESEARCH §7.1):**
```ts
import type { RoutePolicies } from '@gluezero/routing'

export interface RouteWorkerDefinition {
  readonly type: 'worker'
  readonly id: string
  readonly topic: string
  readonly worker: string                                          // workerId in registry
  readonly task: string                                            // task name in worker.tasks
  readonly publishes?: {
    readonly success?: string                                      // override <topic>.completed (D-146)
    readonly progress?: string
    readonly error?: string
  }
  readonly transferable?: readonly string[]                        // D-141 JSONPath
  readonly progressThrottleMs?: number                             // D-137 default 100
  readonly priority?: number
  readonly policies?: Pick<RoutePolicies, 'timeout' | 'concurrency' | 'backpressure' | 'dedupe'>
  // D-143: NIENTE retry/auth/circuitBreaker
}
```

---

### `packages/worker/src/assert-serializable.ts` (Wave 2, plan 05-02)

**Role:** Source — pure validator, deep-walk ricorsivo
**Analog:** `packages/gateway/src/sse-ws/frame-parser.ts` (parser puro, no throw normalmente — F5 inverte: throw su violation con `BrokerError` strutturato)
**Match:** pattern-only — la struttura è "input → guard chain", ma frame-parser ritorna discriminated union mentre F5 throw
**Decisioni:** D-139 (dev-mode auto), D-140 (throw + fieldPath), D-142 (SCA contract WK-07)

**Code excerpt analog (`packages/gateway/src/sse-ws/frame-parser.ts:79-118` — pattern guard chain):**
```ts
export function parseFrame(raw: unknown): FrameParseResult {
  if (typeof raw !== 'string') {
    return { ok: false, reason: 'malformed-json', raw: String(raw) }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, reason: 'malformed-json', raw }
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, reason: 'invalid-shape', raw }
  }
  const obj = parsed as Record<string, unknown>
  const topic = obj['topic']
  if (typeof topic !== 'string' || topic.length === 0) {
    return { ok: false, reason: 'missing-topic', raw }
  }
  // ... build envelope
}
```

**Pattern F5 da RESEARCH §6.2 (~80 LOC):**
```ts
export function assertSerializable(value: unknown, path = '$', visited = new Set<unknown>()): void {
  if (value === null || value === undefined) return
  const t = typeof value
  if (t === 'string' || t === 'number' || t === 'boolean' || t === 'bigint') return
  if (t === 'function') {
    throw createBrokerError({
      code: 'worker.serialization.failed.function',
      category: 'worker',
      message: `Field at ${path} is a function — not serializable. Use registerTransform...`,
      details: { fieldPath: path, fieldType: 'function' },
    })
  }
  // ... symbol, dom-node, custom-class branches
  // SCA-supported: walk Object/Array, return on Date/Map/Set/ArrayBuffer/Blob/etc.
}
```

**Sub-codes (RESEARCH §6.3 / Claude's Discretion):**
- `worker.serialization.failed.function`
- `worker.serialization.failed.symbol`
- `worker.serialization.failed.dom-node`
- `worker.serialization.failed.custom-class`

---

### `packages/worker/src/transferable-extractor.ts` (Wave 2, plan 05-02)

**Role:** Source — pure extractor JSONPath-like (`literal.path`, `[*]` wildcard)
**Analog:** `packages/gateway/src/http/retry-after-parser.ts` (pure parser, narrow input → output, zero deps)
**Match:** pattern-only — entrambi sono ~50-80 LOC zero-dep parsers
**Decisioni:** D-141 (JSONPath subset), Claude's Discretion: zero `jsonpath-plus` (RESEARCH §6.4)

**Pattern F5 da RESEARCH §6.4 (~80 LOC zero-dep):**
```ts
/**
 * Estrae transferable da payload via path JSONPath-like.
 * Supporta:
 *   - 'payload.audioBuffer'          (literal)
 *   - 'payload.images[*].buffer'     (wildcard array)
 * NON supporta: filter, recursive descent, slice. Subset deterministico.
 */
export function extractTransferables(payload: unknown, paths: readonly string[]): Transferable[] {
  const result: Transferable[] = []
  for (const path of paths) {
    extractAt(payload, path.split(/\.|\[/).filter(Boolean), 0, result)
  }
  return result
}

function isTransferable(v: unknown): boolean {
  if (v instanceof ArrayBuffer) return true
  if (typeof MessagePort !== 'undefined' && v instanceof MessagePort) return true
  if (typeof ImageBitmap !== 'undefined' && v instanceof ImageBitmap) return true
  if (typeof OffscreenCanvas !== 'undefined' && v instanceof OffscreenCanvas) return true
  // ... ReadableStream/WritableStream/TransformStream
  return false
}
```

---

### `packages/worker/src/task-tracker.ts` (Wave 2, plan 05-03) — State machine atomico

**Role:** Source — state machine factory closure-based, `Map<TaskId, TaskState>` con check-and-set atomico
**Analog:** `packages/gateway/src/http/strategies/circuit-breaker.ts` (state machine 3-states con `Map<routeId, CircuitState>` + closure factory + transition function)
**Match:** **exact** — pattern factory closure + Map per-key + state transitions + getter per debug
**Decisioni:** D-133 (state machine atomico Pitfall 2C closure), D-134 (correlationId), D-151 #3 (timeout strict scenario), Counter `workerLateResponses` (Claude's Discretion)

**Code excerpt analog (`packages/gateway/src/http/strategies/circuit-breaker.ts:38-130`):**
```ts
interface CircuitState {
  state: 'closed' | 'open' | 'half-open'
  consecutiveFailures: number
  openedAt: number
}

export function createCircuitBreakerStrategy(
  options: CircuitBreakerStrategyOptions = {},
): CircuitBreakerStrategy {
  const config = options.config
  const states = new Map<string, CircuitState>()  // per-routeId state isolato

  function getOrCreateState(routeId: string): CircuitState {
    let s = states.get(routeId)
    if (s === undefined) {
      s = { state: 'closed', consecutiveFailures: 0, openedAt: 0 }
      states.set(routeId, s)
    }
    return s
  }

  function maybeTransitionToHalfOpen(s: CircuitState): void {
    if (s.state === 'open' && config !== undefined &&
        Date.now() - s.openedAt >= config.cooldownMs) {
      s.state = 'half-open'
    }
  }

  return {
    canExecute(routeId: string): boolean { /* ... */ },
    recordSuccess(routeId: string): void { /* reset state to closed */ },
    recordFailure(routeId: string): void { /* increment counter, transition to open */ },
    getState(routeId: string): string { /* ... */ },
  }
}
```

**Adattamento F5 (D-133 + RESEARCH §3.2):**
```ts
type TaskState = 'pending' | 'done' | 'timeout' | 'cancelled' | 'error'

interface TrackerState {
  state: TaskState
  startedAt: number
  correlationId: string
}

export function createTaskTracker(): TaskTracker {
  const tasks = new Map<string, TrackerState>()
  let lateResponses = 0  // Pitfall 2C audit counter

  function tryTransition(taskId: string, target: Exclude<TaskState, 'pending'>): boolean {
    const s = tasks.get(taskId)
    if (s === undefined || s.state !== 'pending') {
      lateResponses++  // Late response post-non-pending — silenziosamente scartata D-133
      return false
    }
    s.state = target  // atomic CAS — JS event loop single-threaded
    return true
  }

  return {
    register(taskId, correlationId) { tasks.set(taskId, { state: 'pending', /* ... */ }) },
    markDone(taskId, result) { return tryTransition(taskId, 'done') },
    markTimeout(taskId) { return tryTransition(taskId, 'timeout') },
    markCancelled(taskId) { return tryTransition(taskId, 'cancelled') },
    markError(taskId, err) { return tryTransition(taskId, 'error') },
    getDebugSnapshot() { return { tasksActive: /*...*/, lateResponses } },
  }
}
```

---

### `packages/worker/src/worker-bridge.ts` (Wave 3, plan 05-04) — Comlink wrapper

**Role:** Source — RPC adapter (Comlink wrap) con DI Worker constructor + lifecycle + AbortSignal proxy + transferable transfer
**Analog:** `packages/gateway/src/sse-ws/sse-adapter.ts` (DI external constructor `EventSourceCtor` + lazy lifecycle + AbortController integration + listener cleanup tracking + `disconnectedPublished` flag pattern)
**Match:** **exact** — stesso pattern DI + lazy lifecycle + cleanup
**Decisioni:** D-125 (Comlink expose), D-129 (lazy first dispatch), D-131 (terminate dedicated), D-132 (AbortSignal Comlink.proxy), D-135 (onProgress proxy), D-141 (Comlink.transfer), D-150 (DI WorkerCtor per MockWorker)

**Code excerpt analog (`packages/gateway/src/sse-ws/sse-adapter.ts:71-160`):**
```ts
export interface SseAdapterDeps {
  /** Publish callback verso il broker (D-113). */
  readonly publishFn: RealtimePublishFn
  /** Backpressure strategy adapter-level (D-115 — riuso F3, opt-in). */
  readonly backpressure?: BackpressureStrategy
  /**
   * DI EventSource constructor per test jsdom (RESEARCH §9.1).
   * Default: `globalThis.EventSource` (browser nativo).
   */
  readonly EventSourceCtor?: typeof EventSource
}

export class SseAdapter {
  readonly name: string
  private es: EventSource | null = null
  /**
   * AbortController scoped al ciclo connect→disconnect corrente. Viene RE-INIZIALIZZATO
   * a ogni `connect()` per supportare il loop di reconnect del manager.
   */
  private controller = new AbortController()
  private readonly reconnect: ReconnectStrategy
  private lastEventId: string | undefined = undefined
  private listeners: Array<{ type: string; fn: EventListener }> = []
  private disconnectedPublished = false

  constructor(
    private readonly def: RealtimeChannelDef,
    private readonly deps: SseAdapterDeps,
  ) {
    this.name = def.name
    this.reconnect = createReconnectStrategy({ initialMode: 'sse', /* ... */ })
  }

  async connect(externalSignal?: AbortSignal): Promise<void> {
    const EventSourceCtor = this.deps.EventSourceCtor ?? globalThis.EventSource
    const url = await this.resolveUrl()
    this.es = new EventSourceCtor(url, { withCredentials: true })
    // ... register listeners, abort cascade
  }

  disconnect(reason?: string): void {
    this.es?.close()
    this.controller.abort(reason)
  }
}
```

**Adattamento F5 (RESEARCH §4.4):**
```ts
import * as Comlink from 'comlink'

export interface WorkerBridgeDeps {
  /** DI Worker constructor (test injection MockWorker, default `globalThis.Worker`). */
  readonly WorkerCtor?: typeof Worker
  /** Optional assertSerializable mode override (D-139). */
  readonly assertSerializableMode?: 'always' | 'dev' | 'off'
}

export class WorkerBridge {
  private worker: Worker | null = null  // lazy first-dispatch (D-129)
  private proxy: Comlink.Remote<Record<string, unknown>> | null = null

  constructor(
    private readonly desc: WorkerDescriptor,
    private readonly deps: WorkerBridgeDeps,
  ) {}

  async dispatch(
    taskName: string,
    payload: unknown,
    signal: AbortSignal,
    onProgress?: (p: ProgressPayload) => void,
  ): Promise<unknown> {
    if (this.worker === null) {
      // D-129 lazy spawn al first dispatch
      this.worker = this.desc.factory()
      this.proxy = Comlink.wrap(this.worker)
    }
    // D-139/D-140 assertSerializable PRE-postMessage
    if (shouldAssert(this.deps.assertSerializableMode)) assertSerializable(payload)
    // D-141 transferable extraction
    const transferList = extractTransferables(payload, this.desc.transferable ?? [])
    // D-132 AbortSignal proxy via Comlink
    const signalProxy = Comlink.proxy(signal)
    const onProgressProxy = onProgress ? Comlink.proxy(onProgress) : undefined
    const wrappedPayload = transferList.length > 0
      ? Comlink.transfer(payload, transferList)
      : payload
    const taskFn = (this.proxy as Record<string, unknown>)[taskName]
    return await (taskFn as (...args: unknown[]) => Promise<unknown>)(
      wrappedPayload, signalProxy, onProgressProxy
    )
  }

  terminate(): void {
    this.proxy && Comlink.releaseProxy.call(this.proxy)
    this.worker?.terminate()
    this.worker = null
    this.proxy = null
  }
}
```

---

### `packages/worker/src/worker-pool.ts` (Wave 3, plan 05-05) — Bounded pool + queue

**Role:** Source — pool slots Map + queue + lazy spawn + respawn + cancellation hybrid
**Analog (split):**
1. `packages/gateway/src/sse-ws/realtime-channel-manager.ts` — registry Map + cascade lifecycle
2. `packages/gateway/src/http/strategies/backpressure-strategy.ts` — queue-bounded + AbortController per pending task

**Match:** role-match (splits across 2 analogs)
**Decisioni:** D-127 (`min(hwc, 4)`), D-128 (cap 8 + opt-in), D-129 (lazy spawn), D-130 (BackpressureStrategy F3 riusata), D-131 (cancellation hybrid: dedicated terminate vs pool cooperative)

**Code excerpt analog 1 (`packages/gateway/src/sse-ws/realtime-channel-manager.ts:162-200`):**
```ts
export class RealtimeChannelManager {
  private readonly channels = new Map<string, ChannelEntry>()
  // ...

  async connect(def: RealtimeChannelDef, ownerId: string = 'system'): Promise<void> {
    if (this.channels.has(def.name)) {
      throw createBrokerError({ code: 'realtime.channel.duplicate', /* ... */ })
    }
    // Lazy init visibility detector al primo canale
    // Factory dispatch: SseAdapter o WebSocketAdapter
    // Register entry + connect
  }
}
```

**Code excerpt analog 2 — backpressure queue pattern (`packages/gateway/src/http/strategies/backpressure-strategy.ts:31-47`):**
```ts
type RouteState = {
  readonly policy: BackpressurePolicyConfig
  pending: Array<{
    readonly controller: AbortController
    readonly reject: (e: unknown) => void
  }>
  inFlight: number
}
```

**Adattamento F5 (RESEARCH §5.1):**
```ts
function defaultPoolSize(): number {
  const hwc = (typeof navigator !== 'undefined' && typeof navigator.hardwareConcurrency === 'number')
    ? navigator.hardwareConcurrency : 4
  return Math.min(hwc, 4)  // D-127
}

interface PoolSlot {
  readonly bridge: WorkerBridge
  busy: boolean
  currentTaskId?: string
}

export class WorkerPool {
  private readonly slots = new Map<string, PoolSlot[]>()  // workerId → slots
  private readonly queue = new Map<string, TaskRequest[]>()

  async acquireSlot(workerId: string): Promise<PoolSlot> {
    // Lazy spawn first (D-129)
    // Round-robin tra free; espandi pool fino a `size`; oltre → enqueue
  }

  releaseSlot(workerId: string, slot: PoolSlot): void { /* ... */ }
  respawn(workerId: string, slotIndex: number): void { /* D-131 fallback */ }
  disconnectByOwner(ownerId: string): void { /* D-126 cascade */ }
}
```

---

### `packages/worker/src/worker-registry.ts` (Wave 4, plan 05-06)

**Analog:** `packages/gateway/src/sse-ws/realtime-channel-manager.ts` (registry portion + cascade `disconnectByOwner`)
**Match:** **exact** — Map<id, descriptor> + register/get/listByOwner + cascade unregisterByOwner D-112
**Decisioni:** D-124 (fail-fast `worker.task.unknown`), D-126 (cascade `unregisterByOwner` ext D-86 F3 → ext D-112 F4 → ext F5 a workers + queue dei task pending)

**Code excerpt analog (cascade pattern `packages/gateway/src/sse-ws/realtime-broker.ts:225-271`):**
```ts
async registerPlugin(descriptor: PluginDescriptor): Promise<void> {
  await this.inner.registerPlugin(descriptor)
  if (descriptor.realtimeChannels && descriptor.realtimeChannels.length > 0) {
    for (const def of descriptor.realtimeChannels) {
      try {
        await this.manager.connect(def, descriptor.id)
      } catch (err) {
        // W-5 fix — niente silent catch: emit `system.warn` con dettagli strutturati
        this.inner.publish('system.warn', { plugin: descriptor.id, channel: def.name,
          reason: 'realtime-channel-register-failed', error: /*...*/ } as never,
          { source: { type: 'system', id: 'realtime-broker', name: 'register-plugin' } } as RouterPublishOptions,
        )
      }
    }
  }
}

async unregisterPlugin(id: string): Promise<void> {
  try { await this.inner.unregisterPlugin(id) } catch { /* pattern F3 silent */ }
  try { this.manager.disconnectByOwner(id) } catch { /* idempotency safe */ }
}
```

**Adattamento F5:** sostituisci `realtimeChannels` con `workers`, `manager.connect` con `registry.register` + `bridge.spawn` lazy, `disconnectByOwner` con `unregisterByOwner` + `pool.terminateByOwner`. Pre-validate `tasks` array in `registry.register` (D-124 fail-fast: throw `worker.task.unknown` se route registrata su task non in `desc.tasks`).

---

### `packages/worker/src/worker-handler.ts` (Wave 4, plan 05-06) — Strategy F3 dispatch

**Role:** Source — Strategy injectable in `RouteExecutorDeps.workerHandler` (D-152) — orchestra registry → pool → bridge → tracker → outcome
**Analog:**
1. `packages/routing/src/route-handlers/local-handler.ts` (Strategy DI iniettata in `RouteExecutorDeps`)
2. `packages/routing/src/outcome-collector.ts` (outcome shape D-80 mirror)

**Match:** pattern-only (handler logic è F5-specific)
**Decisioni:** D-152 (step 9 dispatch — research raccomanda **Opzione B composition pre-publish** §7.2), D-153 (mapping canonical → output via inputMap step 11), D-134 (correlationId end-to-end), D-143 (subset policies)

**Code excerpt analog 1 — RouteExecutorDeps signature (`packages/routing/src/route-executor.ts:62-71`):**
```ts
export interface RouteExecutorDeps {
  readonly httpHandler: (
    event: BrokerEvent,
    route: CompiledRoute,
    signal: AbortSignal,
  ) => Promise<RouteOutcome>
  readonly resolveSubRoute: (id: string) => CompiledRoute | undefined
  readonly tap?: EventTap
  readonly onCacheDeferred?: (event: { topic: string; routeId: string }) => void
}
```

**Code excerpt analog 2 — OutcomeCollector publish shape (`packages/routing/src/outcome-collector.ts:60-100`):**
```ts
export type PublishFn = (
  topic: string,
  payload: unknown,
  options?: { source?: { type: string; id: string }; correlationId?: string },
) => void

interface SanitizedError {
  readonly code: string
  readonly category: string
  readonly message: string
  readonly routeId?: string
  readonly topic?: string
  readonly eventId?: string
  // ... NO originalError/cause/stack (T-03-07-01)
}
```

**Pattern F5 (RESEARCH §7.2 + §7.3, Opzione B):**
```ts
export type WorkerHandler = (
  event: BrokerEvent,
  route: CompiledRoute,
  signal: AbortSignal,
) => Promise<WorkerOutcome>

export function createWorkerHandler(deps: WorkerHandlerDeps): WorkerHandler {
  return async (event, route, signal) => {
    const def = route.definition as RouteWorkerDefinition
    const desc = deps.registry.get(def.worker)
    if (!desc) {
      return { ok: false, routeId: route.id, error: createBrokerError({
        code: 'worker.unknown', category: 'config' /* ... */
      }) }
    }
    const taskId = nanoid()
    deps.tracker.register(taskId, event.correlationId ?? event.id)
    const slot = await deps.pool.acquireSlot(def.worker)
    try {
      const result = await slot.bridge.dispatch(def.task, event.payload, signal, /* onProgress */)
      if (deps.tracker.markDone(taskId, result)) {
        return { ok: true, routeId: route.id, result }
      }
      // late response — already markedTimeout/markedCancelled
      return /* outcome built from final state */
    } catch (err) {
      deps.tracker.markError(taskId, err)
      return { ok: false, routeId: route.id, error: /* sanitized */ }
    } finally {
      deps.pool.releaseSlot(def.worker, slot)
    }
  }
}
```

---

### `packages/worker/src/worker-broker.ts` (Wave 4, plan 05-06) — Composition wrapper

**Role:** Source — composition wrapper di `RouterBroker` (F3) con `workerHandler` injection + cascade D-126 + publish intercept (Opzione B research §7.2)
**Analog:** `packages/gateway/src/sse-ws/realtime-broker.ts` — composition wrapper paradigmatico (D-101 / D-83 strict)
**Match:** **exact** — copy struttura verbatim (`inner: RouterBroker`, override `registerPlugin/unregisterPlugin`, delegate `publish/subscribe` con intercept)
**Decisioni:** D-121 (composition wrapper), D-122 (`createWorkerBroker`), D-126 (PluginDescriptor.workers cascade), D-152 (publish intercept Opzione B)

**Code excerpt analog (`packages/gateway/src/sse-ws/realtime-broker.ts:106-153`):**
```ts
export class RealtimeBroker {
  private readonly inner: RouterBroker
  private readonly manager: RealtimeChannelManager

  constructor(config: RealtimeBrokerConfig = {}) {
    // 1. Compose RouterBroker (F3) — pattern identico RouterBroker → MapperBroker (D-83 chain)
    this.inner = new RouterBroker(config)

    // 2. Build Manager con publishFn legato all'inner (pipeline §28 step 1 ingress)
    const managerDeps: RealtimeChannelManagerDeps = {
      publishFn: (event) => {
        this.inner.publish(
          event.topic,
          event.payload as never,
          { source: event.source, id: event.id } as RouterPublishOptions,
        )
      },
    }
    this.manager = new RealtimeChannelManager(managerDeps)

    // 3. Bootstrap channels da config
    if (config.realtime?.channels) {
      for (const def of config.realtime.channels) {
        this.manager.connect(def, 'system').catch(() => { /* errore già pubblicato */ })
      }
    }
  }
}
```

**Adattamento F5 (Opzione B publish intercept — RESEARCH §7.2 lines 1000-1042):**
```ts
export class WorkerBroker {
  private readonly inner: RouterBroker
  private readonly registry: WorkerRegistry
  private readonly pool: WorkerPool
  private readonly tracker: TaskTracker
  private readonly handler: WorkerHandler
  private readonly workerRoutes = new Map<string, RouteWorkerDefinition>()  // topic → route

  constructor(config: WorkerBrokerConfig = {}) {
    this.inner = new RouterBroker(config)
    this.registry = new WorkerRegistry()
    this.pool = new WorkerPool({ /* deps */ })
    this.tracker = createTaskTracker()
    this.handler = createWorkerHandler({ registry: this.registry, pool: this.pool, tracker: this.tracker })
    // Bootstrap workers + worker routes from config
    /* ... */
  }

  // Pre-publish intercept (Opzione B — D-152) — analog research §7.2
  async publish(topic: string, payload: unknown, options?: PublishOptions): Promise<void> {
    const workerRoute = this.workerRoutes.get(topic)
    if (workerRoute === undefined) {
      return this.inner.publish(topic, payload, options)  // delegate normale F1+F2+F3
    }
    return this.executeWorkerFlow(topic, payload, workerRoute, options)
  }

  // Cascade override (analog F4 realtime-broker.ts:225-271)
  async registerPlugin(descriptor: PluginDescriptor): Promise<void> {
    await this.inner.registerPlugin(descriptor)
    if (descriptor.workers) {
      for (const desc of descriptor.workers) {
        try { this.registry.register(desc, descriptor.id) }
        catch (err) {
          this.inner.publish('system.warn', { plugin: descriptor.id, worker: desc.id,
            reason: 'worker-register-failed' /* ... */ } as never, /* ... */)
        }
      }
    }
  }

  async unregisterPlugin(id: string): Promise<void> {
    try { await this.inner.unregisterPlugin(id) } catch { /* silent F3 pattern */ }
    try { this.registry.unregisterByOwner(id) } catch { /* idempotent */ }
    try { this.pool.terminateByOwner(id) } catch { /* idempotent */ }
  }
}
```

---

### `packages/worker/src/public-factory.ts` (Wave 4, plan 05-06) — `createWorkerBroker`

**Analog:** `packages/gateway/src/sse-ws/public-factory.ts`
**Match:** **exact** — copy struttura, sostituisci `realtime` con `workers` schema
**Decisioni:** D-122 (Valibot safeParse), D-30 (no singleton — pattern F1)

**Code excerpt analog (`packages/gateway/src/sse-ws/public-factory.ts:114-121`):**
```ts
export function createRealtimeBroker(config: RealtimeBrokerConfig = {}): RealtimeBroker {
  const parsed = v.safeParse(RealtimeBrokerConfigSchema, config)
  if (!parsed.success) {
    const messages = parsed.issues.map((i) => i.message).join('; ')
    throw new Error(`Invalid RealtimeBrokerConfig: ${messages}`)
  }
  return new RealtimeBroker(config)
}
```

**Adattamento F5:**
- Schema Valibot per `WorkerConfig.assertSerializable` literal union `'always' | 'dev' | 'off'` (D-139)
- Schema `WorkerDescriptor` con `factory: v.function()`, `tasks: v.array(v.string())`, `mode: v.optional(v.union([v.literal('dedicated'), v.literal('pool')]))`
- Throw `Invalid WorkerBrokerConfig: ${messages}` (pattern F1/F2/F3/F4)

---

### `packages/worker/src/test-utils/mock-worker.ts` (Wave 3, plan 05-04)

**Analog:** `packages/gateway/src/sse-ws/test-utils/mock-event-source.ts`
**Match:** **exact** — copy struttura DI mock per Tier-1 jsdom (jsdom NON ha `Worker`, come non ha `EventSource`)
**Decisioni:** D-118 carryover (3-tier pattern), D-150 (Tier-1 jsdom MockWorker)

**Code excerpt analog (`packages/gateway/src/sse-ws/test-utils/mock-event-source.ts:29-92`):**
```ts
export class MockEventSource {
  static readonly CONNECTING = 0 as const
  static readonly OPEN = 1 as const
  static readonly CLOSED = 2 as const
  static lastInstance: MockEventSource | null = null
  static instances: MockEventSource[] = []
  static byChannelName: Map<string, MockEventSource> = new Map()  // B-NEW-2 routing

  readonly url: string
  readyState: number = MockEventSource.CONNECTING
  private listeners: Map<string, Set<EventListener>> = new Map()

  constructor(url: string | URL, init?: EventSourceInit) {
    this.url = url.toString()
    MockEventSource.lastInstance = this
    MockEventSource.instances.push(this)
    // Parse `?_channel=<name>` per indexing test-only
    try {
      const parsed = new URL(this.url, 'http://localhost')
      const channelName = parsed.searchParams.get('_channel')
      if (channelName) MockEventSource.byChannelName.set(channelName, this)
    } catch { /* no-op */ }
  }

  addEventListener(type: string, fn: EventListener): void { /* ... */ }
  close(): void { this.readyState = MockEventSource.CLOSED }

  // Test helpers `__open`, `__message`, `__error` (NOT part of EventSource spec)
  __open(): void { this.readyState = MockEventSource.OPEN /* dispatch listeners */ }
}
```

**Adattamento F5:**
```ts
export class MockWorker {
  static lastInstance: MockWorker | null = null
  static instances: MockWorker[] = []
  static byWorkerId: Map<string, MockWorker> = new Map()

  readonly url: string
  private listeners: Map<string, Set<EventListener>> = new Map()
  private terminated = false

  constructor(url: string | URL, options?: WorkerOptions) {
    this.url = url.toString()
    MockWorker.lastInstance = this
    MockWorker.instances.push(this)
    // index per workerId via query string `?_worker=<id>`
  }

  postMessage(msg: unknown, transferList?: Transferable[]): void { /* ... */ }
  addEventListener(type: string, fn: EventListener): void { /* ... */ }
  terminate(): void { this.terminated = true }

  // Test helpers
  __reply(payload: unknown): void { /* dispatch 'message' event con payload */ }
  __error(err: ErrorEvent): void { /* dispatch 'error' */ }
}
```

---

### `packages/worker/src/test-utils/worker-harness.ts` (Wave 4, plan 05-06)

**Analog:** `packages/gateway/src/sse-ws/test-utils/realtime-harness.ts`
**Match:** **exact** — collect events via subscribe wildcard 4-pattern + globals patch (`globalThis.Worker`) + reset
**Decisioni:** D-150 (Tier-1 fixture), W-3 closure carryover (NO monkey-patch publish)

**Code excerpt analog (`packages/gateway/src/sse-ws/test-utils/realtime-harness.ts:35-77`):**
```ts
const COLLECT_PATTERNS: readonly string[] = ['*', '*.*', '*.*.*', '*.*.*.*']

export interface RealtimeHarness {
  readonly broker: RealtimeBroker
  readonly events: CollectedEvent[]
  pushSseEvent(channelName: string, data: string, id?: string, eventType?: string): void
  reset(): void
  flushAsync(ms?: number): Promise<void>
}
```

**Adattamento F5:**
```ts
export interface WorkerHarness {
  readonly broker: WorkerBroker
  readonly events: CollectedEvent[]
  replyFromWorker(workerId: string, taskId: string, result: unknown): void
  errorFromWorker(workerId: string, taskId: string, err: unknown): void
  progressFromWorker(workerId: string, taskId: string, p: ProgressPayload): void
  reset(): void
  flushAsync(ms?: number): Promise<void>
}
```

---

### `packages/worker/src/__browser__/test-worker.ts` (Wave 4, plan 05-06) — Worker artifact

**Analog:** Nessuno (F5 first — F4 non ha worker artifact, ha solo `playwright-sse-smoke.test.ts` con mock server)
**Match:** pattern-only — riferimento RESEARCH §9.3 Tier-3
**Decisioni:** D-150 (Tier-3 Playwright Worker reali), D-125 (Comlink expose primary)

**Pattern F5 da RESEARCH §9.3 (~30 LOC):**
```ts
import * as Comlink from 'comlink'

const api = {
  parseCsv: async (input: string, signal: Comlink.Remote<AbortSignal>, onProgress?: Comlink.Remote<(p: ProgressPayload) => void>) => {
    onProgress?.({ value: 0.5, message: 'Halfway' })
    if (await signal.aborted) throw new DOMException('Aborted', 'AbortError')
    return input.split('\n').map((l) => l.split(','))
  },
  echoBuffer: async (buf: ArrayBuffer) => buf.byteLength,  // verifica transferable
  echoDate: async (d: Date) => d,                          // verifica structuredClone Date round-trip
}
Comlink.expose(api)
```

---

### `packages/worker/src/__browser__/playwright-worker-smoke.test.ts` (Wave 4, plan 05-06)

**Analog:** `packages/gateway/src/sse-ws/__browser__/playwright-sse-smoke.test.ts` (Tier-3 con server reale + Worker reale)
**Match:** **exact** — usa `vitest.browser.config.ts` + `playwright/chromium`
**Decisioni:** D-150 Tier-3, D-151 #7 (transferable byteLength=0 verifica)

---

### Integration tests `__integration__/*.test.ts` (Wave 4, plan 05-06)

**Analog principale:** `packages/routing/src/__integration__/route-cascade-cleanup.test.ts` (cascade pattern) + `concurrency-latest-only.test.ts` (state machine race tests) + F4 `realtime-broker.test.ts` (composition tests)

**Code excerpt analog cascade (`packages/routing/src/__integration__/route-cascade-cleanup.test.ts:51-80`):**
```ts
it('plugin con 3 route → unregisterPlugin → route rimosse + nuovo publish 0 fetch (LIFE-02 ext F3)', async () => {
  let weatherFetchCount = 0
  // mock server
  await harness.broker.registerPlugin({
    id: 'multi-plugin',
    routes: [
      { id: 'weather-route', type: 'http', topic: 'weather.requested', /* ... */ },
      // ...
    ],
  })
  // publish + assert
  await harness.broker.unregisterPlugin('multi-plugin')
  // assert: nuovo publish stesso topic → 0 fetch
})
```

**Adattamento F5 cascade (D-151 #8):** sostituisci `routes` con `workers`, `fetchCount` con `dispatchCount`, asserisci `pool.getDebugSnapshot().workerActiveBridges === 0` post-unregisterPlugin (Pitfall 7.C audit).

**Mapping D-151 10 scenari (RESEARCH §9.4) → file integration:**

| # | Scenario | File | Analog |
|---|----------|------|--------|
| 1 | Worker dedicated end-to-end | `__integration__/dedicated.test.ts` | `routing/.../scenario-meteo-http.test.ts` |
| 2 | Pool 4 task concorrenti su size=2 | `__integration__/pool-concurrent.test.ts` | `routing/.../concurrency-latest-only.test.ts` |
| 3 | Timeout strict (Pitfall 2C) | `__integration__/timeout-strict.test.ts` | `routing/.../retry-policy.test.ts` (timer fake pattern) |
| 4 | Cancellation cooperative pool | `__integration__/cancel-cooperative.test.ts` | `routing/.../concurrency-latest-only.test.ts` |
| 5 | Cancellation hard dedicated | `__integration__/cancel-hard.test.ts` | (no analog — F5 first) |
| 6 | Serialization fail dev mode | `__integration__/serialization-fail.test.ts` | (assert-serializable.test.ts unit + integration) |
| 7 | Transferable byteLength=0 | `__browser__/playwright-worker-smoke.test.ts::transferable` | F4 playwright pattern |
| 8 | Cascade cleanup unregisterPlugin | `__integration__/cascade-cleanup.test.ts` | `routing/.../route-cascade-cleanup.test.ts` |
| 9 | Backpressure storm critical bypass | `__integration__/backpressure-storm.test.ts` | F4 storm scenarios |
| 10 | Progress throttle 100ms | `worker-bridge.test.ts::progress-throttle` | (unit con fake timer) |

---

## Shared Patterns (cross-cutting, applicabili a multipli file F5)

### S1 — Anti tree-shake side-effect (Pattern S1, T-04-01-01 mitigation)

**Source pattern:** `packages/routing/src/augment.ts:171` + `packages/gateway/src/sse-ws/augment.ts:105` (export `__augmentLoaded` const literal `true`) + barrel re-export
**Apply to:** `packages/worker/src/augment.ts` (export `__augmentWorkerLoaded`) + `packages/worker/src/index.ts` (re-export)
**Code excerpt source:**
```ts
// packages/routing/src/augment.ts:171
export const __augmentLoaded: true = true
// packages/routing/src/index.ts barrel
export { __augmentLoaded, type F3PipelineStep } from './augment'
```
**Audit:** `grep "__augmentWorkerLoaded" dist/` post-build verifica side-effect presente.

### S2 — Cascade unregisterByOwner (D-26 → D-86 → D-112 → ext F5)

**Source pattern:** `packages/gateway/src/sse-ws/realtime-broker.ts:260-271` (try/catch isolato per ogni step cascade)
**Apply to:** `packages/worker/src/worker-broker.ts:unregisterPlugin`, `packages/worker/src/worker-registry.ts:unregisterByOwner`, `packages/worker/src/worker-pool.ts:terminateByOwner`
**Code excerpt source:**
```ts
async unregisterPlugin(id: string): Promise<void> {
  try { await this.inner.unregisterPlugin(id) } catch { /* pattern F3 silent */ }
  try { this.manager.disconnectByOwner(id) } catch { /* idempotency safe */ }
}
```
**F5 extension:** F5 aggiunge step (3) `pool.terminateByOwner(id)` per terminate worker + svuotare queue task pending (D-126 ext F5 + Pitfall 7.C audit).

### S3 — Tap step §28 + safeTapStep inline (D-85 carryover)

**Source pattern:** `packages/routing/src/route-executor.ts:236-260` (inline `try/catch` swallow per emettere tap step senza esporre `safeTapStep` di core)
**Apply to:** `packages/worker/src/worker-handler.ts` (step 9 `event.worker.dispatched`/`completed`/`failed`/`progress`)
**RESEARCH §7.4 mapping:**
| Tap step | Where emitted |
|----------|---------------|
| `event.worker.dispatched` | WorkerBridge.dispatch |
| `event.worker.progress` | onProgress callback adapter |
| `event.worker.completed` | TaskTracker.markDone |
| `event.worker.failed` | TaskTracker.markError/Timeout/Cancelled |

### S4 — DI external constructor per Tier-1 jsdom test (RESEARCH §9.1)

**Source pattern:** `packages/gateway/src/sse-ws/sse-adapter.ts:80` (`EventSourceCtor?: typeof EventSource`) + `realtime-channel-manager.ts:73` (DI nel manager)
**Apply to:** `packages/worker/src/worker-bridge.ts` (`WorkerCtor?: typeof Worker`) + `packages/worker/src/worker-pool.ts` (DI bridge factory)
**Rationale:** jsdom non ha `Worker` nativo (come non ha `EventSource`/`WebSocket`); DI con default `globalThis.Worker` permette injection MockWorker in test.

### S5 — Reserved internal topics filtrati (D-111 carryover, RESEARCH §3.2)

**Source pattern:** `packages/gateway/src/sse-ws/frame-parser.ts:42-46` (`INTERNAL_TOPICS = Object.freeze({ PING: '__ping__', PONG: '__pong__' })` + match STRICT no prefix)
**Apply to:** `packages/worker/src/` (`INTERNAL_TOPICS_WORKER = { CANCEL: '__cancel__', PROGRESS: '__progress__' }` D-131/137)
**Code excerpt source:**
```ts
export const INTERNAL_TOPICS: Readonly<{ readonly PING: '__ping__'; readonly PONG: '__pong__' }> =
  Object.freeze({ PING: '__ping__', PONG: '__pong__' } as const)
export function isInternalTopic(t: string): boolean {
  return t === INTERNAL_TOPICS.PING || t === INTERNAL_TOPICS.PONG
}
```
**Match STRICT mandatory** (chiusura PITFALL §11.7 / AP-6): no `t.startsWith('__')` — topic legittimi `weather.__cancel__` legittimi.

### S6 — Topic naming auto-derive `<topic>.completed` (D-146)

**Source pattern:** `packages/routing/src/outcome-collector.ts:24-28` (suffix-replace logic per `<topic>.requested` → `<topic>.loaded`/`failed`)
**Apply to:** `packages/worker/src/worker-handler.ts` (auto-derive `<topic>.completed`/`.progress`/`.failed`)
**Code excerpt source:**
```ts
// packages/routing/src/outcome-collector.ts:24-28
// Topic naming resolution (D-80, ROUTE-12):
// - `route.publishes.success` esplicito > convention `<prefix>.loaded`
// - Convention prefix: se topic termina con `.requested`, sostituisce il suffix; altrimenti
//   appende `.loaded`/`.failed`. Esempi:
//     `weather.requested` → `weather.loaded`/`weather.failed`
//     `weather.alert.requested` → `weather.alert.loaded`/`weather.alert.failed`
```
**F5 adattamento (D-146):** `.completed` invece di `.loaded`, identica logica suffix replace.

### S7 — BackpressureStrategy F3 riusata 1:1 (D-130 / D-115 carryover)

**Source pattern:** `packages/gateway/src/http/strategies/backpressure-strategy.ts` — `createBackpressureStrategy({ defaultPolicy, resolvePolicy, dropOldest })` + critical bypass
**Apply to:** `packages/worker/src/worker-handler.ts` (wrap dispatch con backpressure, critical bypass identico)
**Code excerpt source:**
```ts
// Critical bypass (Pitfall 4.C) — coerente con F3
if (event.priority === 'critical') {
  return this.dispatchInternal(event, route, signal)
}
return backpressureStrategy.schedule(route.id, event.priority, () => this.dispatchInternal(...))
```
**F5 import pattern:** `import type { BackpressureStrategy } from '@gluezero/gateway/http'` + `import { createBackpressureStrategy } from '@gluezero/gateway/http'` (workspace dep). NO ridichiarazione del type union F5.

### S8 — Sanitization payload errors (T-03-07-01 / T-04-08-09 mitigation)

**Source pattern:** `packages/routing/src/outcome-collector.ts:84-100` (SanitizedError shape exclude `originalError`/`cause`/`stack`)
**Apply to:** F5 worker errors — `BrokerError.details` include solo `{ taskId, fieldPath, fieldType }` per `worker.serialization.failed.*` (T-05-04-02 mitigation)
**RESEARCH §11.2:** "F5 segue pattern F3 D-78: `BrokerError.details` include solo `{taskId, fieldPath, fieldType}` — NIENTE payload value."

### S9 — Tre livelli di test (D-118 carryover, D-150)

**Source pattern:** `packages/gateway/vitest.config.ts` (Tier-1 jsdom + exclude `__browser__`) + `packages/gateway/vitest.browser.config.ts` (Tier-3 Playwright)
**Apply to:** `packages/worker/vitest.config.ts` + `packages/worker/vitest.browser.config.ts`
**Coverage threshold (D-92 carryover):** `{ statements: 90, branches: 80, functions: 90, lines: 90 }` con `provider: 'v8'`
**RESEARCH §9 mapping:**
- Tier-1: jsdom + MockWorker (113 unit test stimati)
- Tier-2: N/A (worker in-process — no HTTP/WS)
- Tier-3: Playwright Chromium per Worker reali (8 integration jsdom + 6 browser smoke)

---

## No Analog Found (F5-first patterns — pianifica da RESEARCH)

| File | Role | Reason | Reference |
|------|------|--------|-----------|
| `packages/worker/src/__integration__/cancel-hard.test.ts` | Integration test terminate dedicated | F4 non ha terminate hard (SSE/WS chiudono via `close()` non `terminate()`) | RESEARCH §9.4 D-151 #5 |
| `packages/worker/src/__integration__/serialization-fail.test.ts` | Integration assertSerializable | F5 first — assertSerializable è feature F5-only | RESEARCH §6.2 / D-151 #6 |
| `packages/worker/src/__browser__/test-worker.ts` | Worker artifact con Comlink.expose | F5 first — F4 non ha worker artifact | RESEARCH §9.3 |
| Comlink AbortSignal proxy `await signal.aborted` async pattern | DX gotcha (R2 RESEARCH §17) | API Comlink-specific — DOC-05 deve esplicitare | RESEARCH §4.2 |
| `assertSerializable` deep-walk con cycle detection | Validator F5-specific | WHATWG SCA spec deep-walk algoritmo standard | RESEARCH §6.2 |
| `extractTransferables` JSONPath subset | F5-specific implementazione zero-dep | RESEARCH §6.4 (rejected `jsonpath-plus` 4-6 KB) | RESEARCH §6.4 |
| `Comlink.proxy(signal)` + `Comlink.proxy(onProgress)` + `Comlink.transfer(payload, list)` | Comlink-specific RPC primitives | API stabile dal 2019 | RESEARCH §4.1 / §4.4 |

**Strategia pianificazione per F5-first:**
1. Per `cancel-hard.test.ts`: replica struttura `cascade-cleanup.test.ts` ma con `mode: 'dedicated'` + asserisce `MockWorker.lastInstance.terminate` chiamato (vi.spy su `__terminate`).
2. Per `serialization-fail.test.ts`: usa `assertSerializable.test.ts` come unit base + integration verifica `<topic>.failed` published con `payload.error.code === 'worker.serialization.failed.function'`.
3. Per `test-worker.ts` artifact: ~30 LOC RESEARCH §9.3 template.
4. Per Comlink async proxy DX: documentare in DOC-05 con WARNING block (R2 RESEARCH §17 mitigation).

---

## Patterns NON applicabili (out of scope F5)

| Pattern | Perché non applicabile | Source |
|---------|------------------------|--------|
| HTTP gateway policies (retry/auth/circuit) | D-143 strict subset: NIENTE retry/auth/circuitBreaker per worker V1 | CONTEXT.md D-143 |
| SSE/WS adapter | F4 only — F5 ortogonale a F4 (D-101/D-121) | RESEARCH §3.3 |
| Mapper internal logic (canonicalRegistry, mapToCanonical) | F2 only — F5 riusa via composition `inner: RouterBroker` (delegate trasparente) | D-83 strict |
| `RouterEngine` sub-class direct | Approccio Opzione A — research raccomanda Opzione B (publish intercept) per evitare D-83 strict violation | RESEARCH §7.2 |
| Multi-channel/multi-protocol (`'auto'` fallback SSE→WS) | F4 specific — F5 ha 1 mode (`'dedicated' \| 'pool'`) ma niente fallback inter-mode | D-127 |
| Reconnect strategy con full jitter + cycle cap | F4 specific (network reconnection) — worker errori sono deterministici, no retry default | D-143 |
| Visibility detector | F4 specific (PageVisibility API per freshness check stale connection) — worker non hanno staleness concept | D-110 (F4 only) |

---

## Metadata

**Analog search scope:**
- `packages/core/src/` (read-only — D-83 strict)
- `packages/mapper/src/` (read-only — D-83 strict)
- `packages/routing/src/` (analog source primary per dispatch + outcome)
- `packages/gateway/src/http/` (analog source per strategies riusate D-130)
- `packages/gateway/src/sse-ws/` (analog source primary per composition wrapper + 3-tier test + cascade)
- `packages/worker/` (current state — empty placeholder F1, da popolare F5)

**Files scanned:** ~25 file analoghi letti targeted (no full reads su file > 500 LOC; targeted ranges via offset/limit per pattern extraction)

**Pattern extraction date:** 2026-05-04

**Plan structure consigliata (RESEARCH §8 / §13):** 7 plan in 6 wave (W1 bootstrap sequential gate, W2 building blocks A∥B parallel, W3 adapters A∥B parallel, W4 composition + integration sequential gate, W5/Final closure)

**File ownership disgiunta entro wave (vincolo agent-swarm CLAUDE.md):**

| Wave | Plan | File esclusivi |
|------|------|----------------|
| W1 | 05-01 | `package.json`, `tsup.config.ts`, `tsconfig.json`, `vitest.config.ts`, `src/types/*`, `src/index.ts`, `src/augment.{ts,test.ts}` |
| W2 | 05-02 | `src/assert-serializable.{ts,test.ts}`, `src/transferable-extractor.{ts,test.ts}` |
| W2 | 05-03 | `src/task-tracker.{ts,test.ts}` |
| W3 | 05-04 | `src/worker-bridge.{ts,test.ts}`, `src/test-utils/mock-worker.ts` |
| W3 | 05-05 | `src/worker-pool.{ts,test.ts}` |
| W4 | 05-06 | `src/worker-registry.{ts,test.ts}`, `src/worker-handler.{ts,test.ts}`, `src/worker-broker.{ts,test.ts}`, `src/public-factory.{ts,test.ts}`, `src/test-utils/worker-harness.ts`, `src/__integration__/*`, `src/__browser__/*` |
| W5/Final | 05-07 | `docs/DOC-04.md` (UPDATE), `docs/DOC-05.md` (UPDATE), `.planning/REQUIREMENTS.md` (UPDATE), `.planning/STATE.md` (UPDATE), `.planning/ROADMAP.md` (UPDATE), `.planning/phases/05-worker-runtime/05-SUMMARY.md` |

---

## PATTERN MAPPING COMPLETE

**Phase:** 05-worker-runtime
**Files classified:** 35 (15 source/config + 9 unit test + 1 mock-worker + 1 worker-harness + 8 integration + 1 worker artifact + 1 playwright + 6 doc/project files updated in W5)
**Analogs found:** 31 / 35 (88% match) — 4 file F5-first (no analog)

**Coverage by match quality:**
- exact match: 14 file (composition wrapper, augment, factory, mock-worker, harness, cascade tests, build configs)
- role-match: 12 file (descriptors, types, registry, pool split, handler analogs)
- pattern-only: 5 file (assertSerializable, transferableExtractor, worker-handler bespoke logic, integration cascade-cleanup adapt)
- no analog (F5-first): 4 file (cancel-hard, serialization-fail integration, test-worker artifact, Comlink async proxy DX docs)

**Key patterns identified:**
- **Composition wrapper paradigmatico** (F2 D-49 → F3 D-83 → F4 D-101 → F5 D-121): `inner: RouterBroker` + override `registerPlugin/unregisterPlugin` + delegate `publish/subscribe` con intercept pre-publish per case worker (Opzione B research §7.2 — evita D-83 violation).
- **State machine atomico Pitfall 2C** (D-133): pattern circuit-breaker (F3 D-99) — `Map<TaskId, TrackerState>` con check-and-set + counter `lateResponses` per audit (Claude's Discretion).
- **DI external constructor** (S4): `WorkerCtor?: typeof Worker` analog `EventSourceCtor?: typeof EventSource` di F4 — necessario per Tier-1 jsdom (no Worker nativo).
- **Cascade unregisterByOwner** (S2 — D-26 → D-86 → D-112 → ext F5): try/catch isolato per ogni step (3-step cascade in F5 vs 2-step in F4).
- **Reserved internal topics STRICT match** (S5 — D-111 → ext F5): `__cancel__`/`__progress__` filtrati con `topic === '__cancel__'` esatto, NO prefix.
- **3-tier test riuso** (S9 — D-118 → D-150): identico a F4 con MockWorker al posto di MockEventSource/MockWebSocket.
- **BackpressureStrategy F3 riusata 1:1** (S7 — D-75 → D-115 → D-130): import `@gluezero/gateway/http`, NO ridichiarazione tipi.
- **Anti tree-shake `__augmentLoaded`** (S1): pattern già consolidato 3 volte (F2/F3/F4) — F5 quarto utilizzo.

**File created:** `.planning/phases/05-worker-runtime/05-PATTERNS.md`

**Ready for planning:** Pattern mapping complete. Planner può ora referenziare analog patterns + code excerpt + decisioni applicabili in 7 PLAN.md F5 (05-01 bootstrap, 05-02 assert+extractor, 05-03 task-tracker, 05-04 worker-bridge, 05-05 worker-pool, 05-06 broker+integration, 05-07 final-gate).
