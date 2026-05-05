---
phase: 06-cache-tooling-avanzato
plan: 08b
type: execute
wave: 4
depends_on: [06-08a]
files_modified:
  - packages/devtools/src/devtools-broker.ts
  - packages/devtools/src/devtools-broker.test.ts
  - packages/devtools/src/public-factory.ts
  - packages/devtools/src/public-factory.test.ts
  - packages/devtools/src/__integration__/multiplex-tap-flow.test.ts
  - packages/devtools/src/__integration__/pause-resume-flow.test.ts
  - packages/devtools/src/__integration__/metrics-cardinality-flow.test.ts
  - packages/devtools/src/__integration__/inspector-snapshot.test.ts
  - packages/devtools/src/index.ts
  - packages/gluezero/src/glue-zero.ts
  - packages/gluezero/src/sem-bridge.test.ts
  - packages/gluezero/src/__integration__/chain-completa-flow.test.ts
  - packages/gluezero/src/__integration__/features-opt-out.test.ts
  - packages/gluezero/src/index.ts
autonomous: true
requirements:
  - TOOL-01
  - TOOL-02
  - TOOL-03
  - TOOL-04
  - TOOL-05
  - PIPE-01
  - LIFE-02
  - ERR-02
  - TEST-01
  - TEST-02
must_haves:
  truths:
    - "DevtoolsBroker composition wrapper di RouterBroker — wrappa runtime.tap con MultiplexTap aggregator (D-159 chain) + auto-wrap F1 single-tap legacy (wrapLegacyTap helper 06-04)"
    - "DevtoolsBroker espone API: enableDebug() / disableDebug() / getDebugSnapshot() / getMetrics() / pauseTopic() / resumeTopic() / flushQueue() (TOOL-03 + TOOL-04)"
    - "DevtoolsBroker.publish() applica pauseController.intercept(event) PRE-RouterBroker — 'queued'/'dropped' skip downstream, 'pass' delegate"
    - "createDevtoolsBroker(config) factory Valibot safeParse + 'Invalid DevtoolsBrokerConfig:' + D-30"
    - "getDebugSnapshot() ritorna deep-clone via structuredClone (D-162) di { recentEvents (EventInspector buffer), recentRoutes (RouteInspector buffer), currentMetrics, pausedTopics, enabled }"
    - "Step 14 attivazione D-161: DevtoolsBroker post inner.publish() emette tap.onPipelineStep('event.observed', snapshot) ai tap registrati"
    - "enableDebug/disableDebug toggle live-mode con NODE_ENV detection: default `process.env.NODE_ENV !== 'production'` → enabled=true (DX dev-friendly), production false (zero overhead)"
    - "createGlueZero(config) factory aggregato in @gluezero/gluezero implementa CHAIN COMPLETA F1+F2+F3+F4+F5+F6 (BLOCKER-2 fix esatto):
       createBroker → createMapperBroker → createRouterBroker → [createRealtimeBroker if features.realtime] → [createWorkerBroker if features.worker] → [createCacheBroker if features.cache] → [createDevtoolsBroker if features.devtools]
       Default features tutte enabled (RESEARCH §11.3 Opzione B convenience). Devtools è OUTERMOST per catturare TUTTI gli step §28."
    - "createGlueZero type union completa: GlueZero = ReturnType<createBroker> | ReturnType<createMapperBroker> | ReturnType<createRouterBroker> | ReturnType<createRealtimeBroker> | ReturnType<createWorkerBroker> | ReturnType<createCacheBroker> | ReturnType<createDevtoolsBroker> (NON solo Cache | Devtools — chain completa F1..F6)"
    - "Verifica acceptance createGlueZero: `grep -E 'createWorkerBroker|createRealtimeBroker' packages/gluezero/src/glue-zero.ts` deve trovare ENTRAMBI"
    - "Integration test 'createGlueZero default features chain F1+F2+F3+F4+F5+F6 active': verifica che pubblicare un evento attiva mapper + routing + (se features.cache=true) cache + devtools tap"
    - "Integration test 'createGlueZero { features: { realtime: false } } skip realtime': verifica che createRealtimeBroker NON è chiamato + chain procede senza step realtime"
    - "Barrel FINAL append packages/devtools/src/index.ts CUMULATIVO esportazioni Wave 3 + Wave 4 (Inspector + Metrics + Pause + MultiplexTap + composition wrappers) — BLOCKER-1 fix: SOLO 06-08b modifica devtools/src/index.ts in Wave 3+4"
    - "Barrel @gluezero/gluezero index.ts esporta createGlueZero + tipi + re-export pubblici sub-package"
    - "Coverage v8 sui file ≥90/80/90/90 sui 4 nuovi source (devtools-broker, public-factory devtools, sem-bridge, index sembridge)"
    - "Vincolo D-83 strict (CRITICO): `git diff main...HEAD packages/{core,mapper,routing,gateway,worker}/src/` exit 0 lines per tutto il plan 06-08b — tutto F6 Wave 4b vive in `packages/{devtools,sembridge}/src/`"
  artifacts:
    - path: "packages/devtools/src/devtools-broker.ts"
      provides: "DevtoolsBroker class composition wrapper — wrappa runtime.tap con MultiplexTap + Inspector + Metrics + PauseController + getDebugSnapshot (D-159/D-160/D-161/D-162 + step 14 attivazione)"
    - path: "packages/devtools/src/public-factory.ts"
      provides: "createDevtoolsBroker(config) Valibot safeParse + D-30 + 'Invalid DevtoolsBrokerConfig:'"
    - path: "packages/gluezero/src/glue-zero.ts"
      provides: "createGlueZero(config) factory aggregato CHAIN COMPLETA F1+F2+F3+F4+F5+F6 (BLOCKER-2 fix) + features opt-out + D-30 + type union completa"
    - path: "packages/devtools/src/__integration__/multiplex-tap-flow.test.ts"
      provides: "Tier-1 integration test 3+ tap chain con error isolation end-to-end via createDevtoolsBroker"
    - path: "packages/devtools/src/__integration__/pause-resume-flow.test.ts"
      provides: "Tier-1 integration test pauseTopic + replay + flushQueue audit"
    - path: "packages/devtools/src/__integration__/metrics-cardinality-flow.test.ts"
      provides: "Tier-1 integration test cardinality cap audit + getMetricsDelta + naming Prometheus"
    - path: "packages/devtools/src/__integration__/inspector-snapshot.test.ts"
      provides: "Tier-1 integration test Inspector capture + getDebugSnapshot deep-clone immutability"
    - path: "packages/gluezero/src/__integration__/chain-completa-flow.test.ts"
      provides: "Tier-1 integration test createGlueZero default chain F1+F2+F3+F4+F5+F6 active end-to-end"
    - path: "packages/gluezero/src/__integration__/features-opt-out.test.ts"
      provides: "Tier-1 integration test features opt-out: realtime=false / worker=false / cache=false / devtools=false combinations"
  key_links:
    - from: "packages/devtools/src/devtools-broker.ts"
      to: "packages/devtools/src/multiplex-tap.ts + event-inspector.ts + route-inspector.ts + metrics-collector.ts + pause-controller.ts"
      via: "composition wires Inspector + Metrics + Pause + MultiplexTap into RouterBroker.runtime.tap"
      pattern: "createMultiplexTap\\|createEventInspector\\|createRouteInspector\\|createMetricsCollector\\|createPauseController"
    - from: "packages/gluezero/src/glue-zero.ts"
      to: "createBroker → createMapperBroker → createRouterBroker → createRealtimeBroker → createWorkerBroker → createCacheBroker → createDevtoolsBroker"
      via: "chain composition COMPLETA F1+F2+F3+F4+F5+F6 (BLOCKER-2 fix esatto)"
      pattern: "createBroker\\|createMapperBroker\\|createRouterBroker\\|createRealtimeBroker\\|createWorkerBroker\\|createCacheBroker\\|createDevtoolsBroker"
    - from: "packages/devtools/src/index.ts"
      to: "TUTTI gli export Wave 3 + Wave 4"
      via: "FINAL barrel append CUMULATIVO post-Wave 3 (BLOCKER-1 fix)"
      pattern: "createMultiplexTap\\|createEventInspector\\|createRouteInspector\\|createMetricsCollector\\|createPauseController\\|DevtoolsBroker\\|createDevtoolsBroker"
---

<objective>
Wave 4b sequential gate (post 06-08a — depends_on cache wrapper): completion devtools wrapper + createGlueZero aggregato CHAIN COMPLETA + barrel devtools FINAL append cumulativo + 6 integration test 3-tier.

**4 deliverable principali (BLOCKER-1 + BLOCKER-2 fix):**

1. **DevtoolsBroker composition wrapper** (`packages/devtools/src/devtools-broker.ts`): istanzia EventInspector + RouteInspector + MetricsCollector + PauseController dal config. Wrappa `runtime.tap` legacy F1 (auto-wrap via wrapLegacyTap 06-04) + tap user F6 in MultiplexTap aggregator. Espone API `enableDebug` / `disableDebug` / `getDebugSnapshot` / `getMetrics` / `pauseTopic` / `resumeTopic` / `flushQueue`. **Step 14 attivazione D-161**: post `inner.publish()` emette `tap.onPipelineStep('event.observed', snapshot)`. NODE_ENV detection per default enableByDefault.

2. **createDevtoolsBroker factory** (`packages/devtools/src/public-factory.ts`): Valibot safeParse + D-30 + prefisso 'Invalid DevtoolsBrokerConfig:'.

3. **createGlueZero aggregato CHAIN COMPLETA F1+F2+F3+F4+F5+F6** (`packages/gluezero/src/glue-zero.ts`) — **BLOCKER-2 fix critico**:

   ```ts
   import { createBroker } from '@gluezero/core'
   import { createMapperBroker } from '@gluezero/mapper'
   import { createRouterBroker } from '@gluezero/routing'
   import { createRealtimeBroker } from '@gluezero/gateway/sse-ws'
   import { createWorkerBroker } from '@gluezero/worker'
   import { createCacheBroker } from '@gluezero/cache'
   import { createDevtoolsBroker } from '@gluezero/devtools'

   export interface GlueZeroFeatures {
     readonly realtime?: boolean   // default true
     readonly worker?: boolean     // default true
     readonly cache?: boolean      // default true
     readonly devtools?: boolean   // default true (auto-off in production via D-160)
   }

   export interface GlueZeroConfig extends BrokerConfig {
     readonly features?: GlueZeroFeatures
     readonly realtime?: RealtimeConfig
     readonly workers?: WorkerConfig
     readonly cache?: CacheConfig
     readonly devtools?: DevtoolsConfig
   }

   export type GlueZero =
     | ReturnType<typeof createBroker>
     | ReturnType<typeof createMapperBroker>
     | ReturnType<typeof createRouterBroker>
     | ReturnType<typeof createRealtimeBroker>
     | ReturnType<typeof createWorkerBroker>
     | ReturnType<typeof createCacheBroker>
     | ReturnType<typeof createDevtoolsBroker>

   export function createGlueZero(config: GlueZeroConfig = {}): GlueZero {
     const f = {
       realtime: config.features?.realtime !== false,
       worker:   config.features?.worker !== false,
       cache:    config.features?.cache !== false,
       devtools: config.features?.devtools !== false,
     }

     // Chain composition Opzione B (D-83 strict carryover meccanico):
     let broker: any = createBroker(config)
     broker = createMapperBroker({ ...config, inner: broker })
     broker = createRouterBroker({ ...config, inner: broker })
     if (f.realtime) broker = createRealtimeBroker({ ...config, inner: broker })
     if (f.worker)   broker = createWorkerBroker({ ...config, inner: broker })
     if (f.cache)    broker = createCacheBroker({ ...config, inner: broker })
     if (f.devtools) broker = createDevtoolsBroker({ ...config, inner: broker })
     return broker as GlueZero
   }
   ```

   Default features tutte enabled. Devtools è OUTERMOST per catturare TUTTI gli step §28.

4. **6 integration test 3-tier** (4 devtools + 2 sembridge):
   - devtools: multiplex-tap-flow, pause-resume-flow, metrics-cardinality-flow, inspector-snapshot
   - sembridge: chain-completa-flow (verifica F1+F2+F3+F4+F5+F6 attivi per default), features-opt-out (realtime=false skip)

5. **Barrel FINAL append `packages/devtools/src/index.ts`** — **BLOCKER-1 fix critico**:
   Cumulative append di TUTTI gli export Wave 3 + Wave 4 (Inspector + Metrics + Pause + MultiplexTap + composition wrappers). Wave 3 plans 06-05/06-06/06-07 NON toccano questo file (file ownership disgiunta verified). Solo 06-08b è il single-writer cumulativo post-Wave 3.

**Vincolo D-83 strict (CRITICO):** `git diff main...HEAD packages/{core,mapper,routing,gateway,worker}/src/` exit 0 — tutta F6 Wave 4b vive in `packages/{devtools,sembridge}/src/`.

Output: 3 file source production-ready (~360 LOC totali) + 4 file test (~32 test) + 6 integration test (~20 scenari) + barrel cumulative + sembridge chain completa.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/06-cache-tooling-avanzato/06-CONTEXT.md
@.planning/phases/06-cache-tooling-avanzato/06-RESEARCH.md
@.planning/phases/06-cache-tooling-avanzato/06-PATTERNS.md
@.planning/phases/06-cache-tooling-avanzato/06-01-PLAN.md
@.planning/phases/06-cache-tooling-avanzato/06-04-PLAN.md
@.planning/phases/06-cache-tooling-avanzato/06-05-PLAN.md
@.planning/phases/06-cache-tooling-avanzato/06-06-PLAN.md
@.planning/phases/06-cache-tooling-avanzato/06-07-PLAN.md
@.planning/phases/06-cache-tooling-avanzato/06-08a-PLAN.md
@CLAUDE.md
@packages/worker/src/worker-broker.ts
@packages/worker/src/public-factory.ts
@packages/gateway/src/sse-ws/realtime-broker.ts
@packages/gateway/src/sse-ws/public-factory.ts
@packages/devtools/src/multiplex-tap.ts
@packages/devtools/src/tap-registry.ts
@packages/devtools/src/event-inspector.ts
@packages/devtools/src/route-inspector.ts
@packages/devtools/src/metrics-collector.ts
@packages/devtools/src/pause-controller.ts
@packages/cache/src/cache-broker.ts
@packages/cache/src/public-factory.ts
@packages/gluezero/src/index.ts

<interfaces>
F5 worker-broker.ts pattern (analog target VERBATIM):

```typescript
export class WorkerBroker {
  private readonly inner: RouterBroker
  constructor(config) { this.inner = new RouterBroker(config) }
  publish(topic, payload, options) { /* Opzione B intercept */ }
  registerPlugin(desc) { /* cascade D-126 */ }
  unregisterPlugin(id) { /* cascade D-126 LIFE-02 */ }
}
```

06-04 wrapLegacyTap helper:

```typescript
export function wrapLegacyTap(config: {
  readonly runtime?: { readonly tap?: EventTap }
  readonly taps?: readonly EventTap[]
}): readonly EventTap[]
```

06-08a CacheBroker (chained inside createGlueZero if features.cache):

```typescript
export class CacheBroker { /* extends RouterBroker via composition */ }
export function createCacheBroker(config: CacheBrokerConfig = {}): CacheBroker
```
</interfaces>
</context>

<threat_model>
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-06-08b-01 | Logic flaw (composition order matters — DevtoolsBroker dopo CacheBroker o viceversa) | sem-bridge factory | mitigate | Test sem-bridge.test.ts verifica order: createBroker → mapper → router → realtime → worker → cache → devtools. Devtools è OUTERMOST per catturare TUTTI gli step §28. Documented in JSDoc |
| T-06-08b-02 | Information Disclosure (getDebugSnapshot deep-clone perf disclose / leak) | devtools-broker getDebugSnapshot | mitigate | RESEARCH §15.3 documenta perf <50ms su 500 entries × 5KB. Test perf benchmark in 06-09a Tier-3 Playwright. structuredClone API standard zero side-effect |
| T-06-08b-03 | DoS (DevtoolsBroker.publish accumula tap allocation in hot path con debug=on) | devtools-broker publish | mitigate | D-160 lazy-mode tap delegate solo quando enabled. Inspector early-return D-160. Test integration verifica hot-path (1000 publish/sec sotto Tier-1 jsdom budget) |
| T-06-08b-04 | Tampering (config.features bypass — consumer fa createGlueZero({features: {cache: false}}) ma cacheRoutes presenti) | sem-bridge | mitigate | Validation feature consistency: se cacheRoutes definite ma features.cache===false → throw "Invalid GlueZeroConfig: cache routes defined but feature disabled". Test |
| T-06-08b-05 | Logic flaw (chain completa NON include realtime/worker — BLOCKER-2 regression) | sem-bridge | mitigate | Acceptance grep `createWorkerBroker|createRealtimeBroker` in glue-zero.ts deve trovare ENTRAMBI. Integration test chain-completa verifica scenario realtime SSE inbound + worker offload entrambi attivi |
| T-06-08b-06 | Logic flaw (Wave 3 plans hanno toccato barrel devtools/index.ts retroattivamente) | barrel devtools/index.ts | mitigate | BLOCKER-1 fix verified: 06-05/06-06/06-07 non hanno modificato il barrel (verifica `git log --oneline packages/devtools/src/index.ts` post-06-08b deve mostrare singolo append cumulativo) |
</threat_model>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: devtools-broker.ts + public-factory.ts (DevtoolsBroker composition + step 14 attivazione + factory)</name>
  <files>packages/devtools/src/devtools-broker.ts, packages/devtools/src/devtools-broker.test.ts, packages/devtools/src/public-factory.ts, packages/devtools/src/public-factory.test.ts</files>
  <read_first>
    - packages/worker/src/worker-broker.ts (analog composition wrapper)
    - packages/worker/src/public-factory.ts (analog factory)
    - packages/devtools/src/multiplex-tap.ts (creato 06-04)
    - packages/devtools/src/tap-registry.ts (creato 06-04 — wrapLegacyTap helper)
    - packages/devtools/src/event-inspector.ts (creato 06-05)
    - packages/devtools/src/route-inspector.ts (creato 06-05)
    - packages/devtools/src/metrics-collector.ts (creato 06-06)
    - packages/devtools/src/pause-controller.ts (creato 06-07)
    - .planning/phases/06-cache-tooling-avanzato/06-PATTERNS.md sezione devtools-broker LOC 750-803
    - .planning/phases/06-cache-tooling-avanzato/06-RESEARCH.md §5 tap registry architecture + §12 step 14 attivazione + §11 composition topology
  </read_first>
  <action>
RED + GREEN TDD pattern.

GREEN devtools-broker.ts (~200 LOC):

```typescript
import type { EventTap, PluginDescriptor } from '@gluezero/core'
import { RouterBroker, type RouterBrokerConfig } from '@gluezero/routing'
import { createEventInspector, type EventInspector } from './event-inspector'
import { createMetricsCollector, type MetricsCollector } from './metrics-collector'
import { createMultiplexTap } from './multiplex-tap'
import { createPauseController, type PauseController } from './pause-controller'
import { createRouteInspector, type RouteInspector } from './route-inspector'
import { wrapLegacyTap } from './tap-registry'
import type { DevtoolsConfig } from './types/devtools-config'
import type { MetricsSnapshot } from './types/metrics'
import type { FlushQueueResult } from './types/pause-state'

export interface DevtoolsBrokerConfig extends RouterBrokerConfig {
  readonly taps?: readonly EventTap[]
  readonly devtools?: DevtoolsConfig
}

export interface DebugSnapshot {
  readonly recentEvents: readonly unknown[]
  readonly recentRoutes: readonly unknown[]
  readonly currentMetrics: MetricsSnapshot
  readonly pausedTopics: readonly string[]
  readonly enabled: boolean
}

const isProduction = (): boolean => {
  try {
    return typeof process !== 'undefined' && typeof process.env !== 'undefined' && process.env.NODE_ENV === 'production'
  } catch {
    return false
  }
}

export class DevtoolsBroker {
  private readonly inner: RouterBroker
  private readonly inspector: EventInspector
  private readonly routeInspector: RouteInspector
  private readonly metrics: MetricsCollector
  private readonly pauseController: PauseController

  constructor(config: DevtoolsBrokerConfig) {
    const initiallyEnabled = config.devtools?.enableByDefault ?? !isProduction()

    this.inspector = createEventInspector({ bufferSize: config.devtools?.eventBufferSize, initiallyEnabled })
    this.routeInspector = createRouteInspector({ bufferSize: config.devtools?.routeBufferSize, initiallyEnabled })
    this.metrics = createMetricsCollector({
      histogramSamples: config.devtools?.histogramSamples,
      maxLabelCombinations: config.devtools?.maxLabelCombinations,
      onCardinalityOverflow: (info) => this.inner?.publish('system.metrics.cardinality-overflow', info),
    })
    this.pauseController = createPauseController({
      maxQueueSize: config.devtools?.pauseQueueMaxSize,
      publishFn: (topic, payload) => this.inner.publish(topic, payload),
    })

    // D-159 tap registry: auto-wrap F1 single-tap legacy + F6 array + Inspector + RouteInspector + Metrics tap
    const userTaps = wrapLegacyTap({ runtime: config.runtime, taps: config.taps })
    const allTaps: EventTap[] = [
      this.inspector.tap,
      this.routeInspector.tap,
      this.metrics.tap,
      ...userTaps,
    ]
    const multiplexTap = createMultiplexTap(allTaps)

    this.inner = new RouterBroker({
      ...config,
      runtime: { ...config.runtime, tap: multiplexTap },
    })
  }

  publish(topic: string, payload: unknown, options?: any): Promise<void> | void {
    const event = {
      id: options?.id ?? `evt-${Date.now()}`,
      topic, payload, priority: options?.priority,
      timestamp: Date.now(),
      source: options?.source ?? { type: 'plugin', id: 'devtools-broker' },
    } as any
    const action = this.pauseController.intercept(event)
    if (action === 'queued' || action === 'dropped') return
    const result = this.inner.publish(topic, payload, options)
    // D-161 step 14 attivazione — event.observed post deliver via MultiplexTap
    return result instanceof Promise ? result.then(() => undefined) : result
  }

  registerPlugin(desc: PluginDescriptor) { return this.inner.registerPlugin(desc) }
  unregisterPlugin(id: string) { this.inner.unregisterPlugin(id) }

  enableDebug() { this.inspector.enable(); this.routeInspector.enable() }
  disableDebug() { this.inspector.disable(); this.routeInspector.disable() }

  getDebugSnapshot(): DebugSnapshot {
    return structuredClone({
      recentEvents: this.inspector.getBuffer(),
      recentRoutes: this.routeInspector.getBuffer(),
      currentMetrics: this.metrics.getMetrics(),
      pausedTopics: this.pauseController.getSnapshot().pausedTopics,
      enabled: this.inspector.getSnapshot().enabled,
    })
  }

  getMetrics(): MetricsSnapshot { return this.metrics.getMetrics() }
  pauseTopic(topic: string) { this.pauseController.pauseTopic(topic) }
  resumeTopic(topic: string) { this.pauseController.resumeTopic(topic) }
  flushQueue(topic?: string): readonly FlushQueueResult[] { return this.pauseController.flushQueue(topic) }
}
```

GREEN public-factory.ts:

```typescript
import * as v from 'valibot'
import { DevtoolsBroker, type DevtoolsBrokerConfig } from './devtools-broker'

const DevtoolsConfigSchema = v.optional(v.looseObject({
  enableByDefault: v.optional(v.boolean()),
  eventBufferSize: v.optional(v.pipe(v.number(), v.minValue(1))),
  routeBufferSize: v.optional(v.pipe(v.number(), v.minValue(1))),
  histogramSamples: v.optional(v.pipe(v.number(), v.minValue(1))),
  maxLabelCombinations: v.optional(v.pipe(v.number(), v.minValue(1))),
  pauseQueueMaxSize: v.optional(v.pipe(v.number(), v.minValue(1))),
}))

const DevtoolsBrokerConfigSchema = v.looseObject({
  runtime: v.optional(v.unknown()),
  debug: v.optional(v.unknown()),
  // ... pass-through F2-F6
  taps: v.optional(v.array(v.unknown())),
  devtools: DevtoolsConfigSchema,
})

export function createDevtoolsBroker(config: DevtoolsBrokerConfig = {}): DevtoolsBroker {
  const parsed = v.safeParse(DevtoolsBrokerConfigSchema, config)
  if (!parsed.success) {
    const messages = parsed.issues.map((i) => i.message).join('; ')
    throw new Error(`Invalid DevtoolsBrokerConfig: ${messages}`)
  }
  return new DevtoolsBroker(config)
}

export type { DevtoolsBrokerConfig }
export { DevtoolsBroker }
```

Test devtools-broker.test.ts: 14+ test (composition wires Inspector+Metrics+Pause (3) + multiplex tap chain (3) + auto-wrap F1 single-tap (2) + step 14 attivazione (1) + getDebugSnapshot deep-clone (2) + enableDebug/disableDebug toggle + NODE_ENV detection (2) + pauseTopic API (1)).

Test public-factory.test.ts: 5+ test analog F5 (Valibot fail prefix + D-30 multi-tenant isolation + happy path).

Commit:

```bash
git add packages/devtools/src/devtools-broker.ts packages/devtools/src/devtools-broker.test.ts packages/devtools/src/public-factory.ts packages/devtools/src/public-factory.test.ts
git commit -m "feat(06-08b): GREEN DevtoolsBroker composition + step 14 + getDebugSnapshot + factory (D-159..D-162/D-167/D-170)

DevtoolsBroker composition wrapper RouterBroker — wrappa Inspector + Metrics + PauseController
+ MultiplexTap aggregator (auto-wrap F1 single-tap legacy via wrapLegacyTap 06-04).
Step 14 attivazione D-161 (event.observed post inner.publish).

API esposta: enableDebug/disableDebug/getDebugSnapshot (structuredClone D-162) + getMetrics
+ pauseTopic/resumeTopic/flushQueue (TOOL-03 + TOOL-04). NODE_ENV detection inline default.

createDevtoolsBroker(config) factory Valibot + 'Invalid DevtoolsBrokerConfig:' + D-30.

Pattern F5 worker-broker.ts:1-100 + F4 realtime-broker.ts:1-100 carryover esatto.

14 test broker + 5 test factory passing. Coverage v8 90/80/90/90.

D-83 strict OK.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```
  </action>
  <verify>
    <automated>cd "/Users/omarmarzio/programming/prova AI/GlueZero" && pnpm -F @gluezero/devtools test --run devtools-broker 2>&1 | tail -15 && pnpm -F @gluezero/devtools test --run public-factory 2>&1 | tail -10</automated>
  </verify>
  <done>
    - devtools-broker.ts ~200 LOC + .test.ts 14+ test
    - public-factory.ts ~80 LOC + .test.ts 5+ test
    - 4 commit TDD (RED + GREEN x2)
    - Coverage v8 ≥90/80/90/90
    - D-83 strict OK
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: glue-zero.ts (createGlueZero CHAIN COMPLETA F1+F2+F3+F4+F5+F6 — BLOCKER-2 fix)</name>
  <files>packages/gluezero/src/glue-zero.ts, packages/gluezero/src/sem-bridge.test.ts</files>
  <read_first>
    - packages/cache/src/public-factory.ts (creato 06-08a — createCacheBroker)
    - packages/devtools/src/public-factory.ts (creato Task 1 — createDevtoolsBroker)
    - packages/worker/src/public-factory.ts (createWorkerBroker F5)
    - packages/gateway/src/sse-ws/public-factory.ts (createRealtimeBroker F4)
    - packages/routing/src/public-factory.ts (createRouterBroker F3)
    - packages/mapper/src/public-factory.ts (createMapperBroker F2)
    - packages/core/src/public-factory.ts (createBroker F1)
    - .planning/phases/06-cache-tooling-avanzato/06-PATTERNS.md sezione sem-bridge LOC 810-836
    - .planning/phases/06-cache-tooling-avanzato/06-RESEARCH.md §11.3 raccomandazione researcher (Opzione B factory aggregato)
  </read_first>
  <behavior>
    - Test 1: createGlueZero({}) ritorna GlueZero con CHAIN COMPLETA F1+F2+F3+F4+F5+F6 attiva (default features tutte enabled)
    - Test 2: createGlueZero({ features: { realtime: false } }) → createRealtimeBroker NON chiamato + chain procede senza step realtime
    - Test 3: createGlueZero({ features: { worker: false } }) → createWorkerBroker NON chiamato
    - Test 4: createGlueZero({ features: { cache: false } }) → createCacheBroker NON chiamato
    - Test 5: createGlueZero({ features: { devtools: false } }) → createDevtoolsBroker NON chiamato
    - Test 6: createGlueZero({ features: { realtime: false, worker: false } }) → solo F1+F2+F3+F6 chain
    - Test 7: D-30 multi-tenant isolation — 2 createGlueZero istanze indipendenti (NO singleton)
    - Test 8: Valibot fail prefix verified — config.features={cache:'string'} → throw 'Invalid GlueZeroConfig:'
    - Test 9: type union completa — `GlueZero` accetta ReturnType di TUTTI i 7 factory (compile-time check)
    - Test 10: Acceptance grep — glue-zero.ts source contiene riferimento sia a `createWorkerBroker` che `createRealtimeBroker` (BLOCKER-2 fix verification)
  </behavior>
  <action>
RED + GREEN TDD pattern.

GREEN glue-zero.ts (~120 LOC) — implementazione **CHAIN COMPLETA F1+F2+F3+F4+F5+F6 (BLOCKER-2 fix esatto)**:

```typescript
/**
 * F6 createGlueZero — factory aggregato CHAIN COMPLETA F1+F2+F3+F4+F5+F6
 * (RESEARCH §11.3 Opzione B convenience).
 *
 * **BLOCKER-2 fix critico (revision iter 1)**: la chain include OBBLIGATORIAMENTE
 * createWorkerBroker + createRealtimeBroker quando features li abilita.
 *
 * Order chain composition (OUTERMOST = devtools, per catturare TUTTI gli step §28):
 *   createBroker (F1)
 *   → createMapperBroker (F2)
 *   → createRouterBroker (F3)
 *   → [createRealtimeBroker (F4) if features.realtime]
 *   → [createWorkerBroker (F5) if features.worker]
 *   → [createCacheBroker (F6) if features.cache]
 *   → [createDevtoolsBroker (F6) if features.devtools]  // OUTERMOST
 *
 * **D-30 no singleton**: ogni call ritorna istanza indipendente.
 *
 * @see RESEARCH §11 composition wrapper topology
 */

import * as v from 'valibot'
import { createBroker } from '@gluezero/core'
import { createMapperBroker } from '@gluezero/mapper'
import { createRouterBroker } from '@gluezero/routing'
import { createRealtimeBroker } from '@gluezero/gateway/sse-ws'
import { createWorkerBroker } from '@gluezero/worker'
import { createCacheBroker } from '@gluezero/cache'
import { createDevtoolsBroker } from '@gluezero/devtools'

import type { GlueZeroConfig, GlueZeroFeatures } from './types/gluezero-config'

export type GlueZero =
  | ReturnType<typeof createBroker>
  | ReturnType<typeof createMapperBroker>
  | ReturnType<typeof createRouterBroker>
  | ReturnType<typeof createRealtimeBroker>
  | ReturnType<typeof createWorkerBroker>
  | ReturnType<typeof createCacheBroker>
  | ReturnType<typeof createDevtoolsBroker>

const GlueZeroConfigSchema = v.looseObject({
  features: v.optional(v.looseObject({
    cache:    v.optional(v.boolean()),
    devtools: v.optional(v.boolean()),
    worker:   v.optional(v.boolean()),
    realtime: v.optional(v.boolean()),
  })),
})

/**
 * Crea un GlueZero aggregato con chain composition COMPLETA F1+F2+F3+F4+F5+F6.
 *
 * @param config Optional config (default empty + tutte le feature enabled)
 * @returns Istanza GlueZero (broker outermost in chain)
 * @throws {Error} Invalid GlueZeroConfig
 *
 * @example Quick start (default chain F1+F2+F3+F4+F5+F6)
 * ```ts
 * const broker = createGlueZero({
 *   cache: { maxEntries: 500 },
 *   devtools: { enableByDefault: true },
 * })
 * broker.publish('weather.requested', { location: 'Roma' })
 * ```
 *
 * @example Opt-out features (skip realtime + worker per SPA non realtime)
 * ```ts
 * const broker = createGlueZero({
 *   features: { realtime: false, worker: false },
 *   cache: { maxEntries: 100 },
 * })
 * ```
 *
 * @see RESEARCH §11.3 Opzione B convenience factory
 */
export function createGlueZero(config: GlueZeroConfig = {}): GlueZero {
  const parsed = v.safeParse(GlueZeroConfigSchema, config)
  if (!parsed.success) {
    const messages = parsed.issues.map((i) => i.message).join('; ')
    throw new Error(`Invalid GlueZeroConfig: ${messages}`)
  }
  const f = {
    realtime: config.features?.realtime !== false,
    worker:   config.features?.worker !== false,
    cache:    config.features?.cache !== false,
    devtools: config.features?.devtools !== false,
  }

  // Chain composition Opzione B (D-83 strict carryover meccanico):
  // F1 → F2 → F3 → [F4] → [F5] → [F6 cache] → [F6 devtools OUTERMOST]
  let broker: any = createBroker(config)
  broker = createMapperBroker({ ...config, inner: broker })
  broker = createRouterBroker({ ...config, inner: broker })
  if (f.realtime) broker = createRealtimeBroker({ ...config, inner: broker })
  if (f.worker)   broker = createWorkerBroker({ ...config, inner: broker })
  if (f.cache)    broker = createCacheBroker({ ...config, inner: broker })
  if (f.devtools) broker = createDevtoolsBroker({ ...config, inner: broker })
  return broker as GlueZero
}
```

**Acceptance gate verification (BLOCKER-2):**

```bash
# Verifica che chain include createWorkerBroker E createRealtimeBroker
grep -E "createWorkerBroker|createRealtimeBroker" packages/gluezero/src/glue-zero.ts | wc -l
# Atteso: ≥4 (2 import + 2 use case if branch)
```

Test sem-bridge.test.ts: 10+ test (vedi behavior block above) + acceptance grep test.

Commit:

```bash
git add packages/gluezero/src/glue-zero.ts packages/gluezero/src/sem-bridge.test.ts
git commit -m "feat(06-08b): GREEN createGlueZero CHAIN COMPLETA F1+F2+F3+F4+F5+F6 (BLOCKER-2 fix)

createGlueZero(config) factory aggregato chain composition COMPLETA — features opt-out
(cache/devtools/worker/realtime). Default tutte enabled.

**BLOCKER-2 fix critico**: chain implementa F1+F2+F3+F4+F5+F6 obbligatoriamente
(NON V1 minimal Devtools(Cache(...)) come iter precedente).

Ordine OUTERMOST → INNERMOST: devtools > cache > worker > realtime > router > mapper > broker.
Devtools outermost per catturare TUTTI gli step §28.

Type union GlueZero = ReturnType<createBroker | createMapperBroker | createRouterBroker |
createRealtimeBroker | createWorkerBroker | createCacheBroker | createDevtoolsBroker>
(7 ReturnType — chain completa F1..F6).

10/10 sem-bridge.test.ts passing. Acceptance grep verified
('createWorkerBroker|createRealtimeBroker' presenti entrambi).

D-83 strict OK — zero modifiche packages/{core,mapper,routing,gateway,worker}/src/.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```
  </action>
  <verify>
    <automated>cd "/Users/omarmarzio/programming/prova AI/GlueZero" && pnpm -F @gluezero/gluezero test --run sem-bridge 2>&1 | tail -15 && grep -cE "createWorkerBroker|createRealtimeBroker" packages/gluezero/src/glue-zero.ts</automated>
  </verify>
  <done>
    - glue-zero.ts ~120 LOC + .test.ts 10+ test
    - 2 commit TDD (RED + GREEN)
    - Acceptance grep verified: chain include createWorkerBroker + createRealtimeBroker (BLOCKER-2 fix)
    - Coverage v8 ≥90/80/90/90
    - D-83 strict OK
  </done>
</task>

<task type="auto">
  <name>Task 3: Barrel FINAL append cumulativo + 6 integration test 3-tier (BLOCKER-1 fix + WARNING-4 fix)</name>
  <files>packages/devtools/src/index.ts, packages/gluezero/src/index.ts, packages/devtools/src/__integration__/multiplex-tap-flow.test.ts, packages/devtools/src/__integration__/pause-resume-flow.test.ts, packages/devtools/src/__integration__/metrics-cardinality-flow.test.ts, packages/devtools/src/__integration__/inspector-snapshot.test.ts, packages/gluezero/src/__integration__/chain-completa-flow.test.ts, packages/gluezero/src/__integration__/features-opt-out.test.ts</files>
  <read_first>
    - packages/cache/src/__integration__/cache-flow.test.ts (creato 06-08a — analog Tier-1 jsdom integration test pattern)
    - packages/cache/src/test-utils/cache-harness.ts (analog harness pattern)
    - packages/worker/src/__integration__/dedicated.test.ts (analog Tier-1 jsdom)
    - packages/devtools/src/devtools-broker.ts (creato Task 1)
    - packages/gluezero/src/glue-zero.ts (creato Task 2)
    - .planning/phases/06-cache-tooling-avanzato/06-RESEARCH.md §13 test 3-tier strategy F6
  </read_first>
  <action>
**3.1 — Barrel FINAL append `packages/devtools/src/index.ts` (BLOCKER-1 fix critico — single-writer cumulativo post-Wave 3):**

```typescript
// Wave 3 cumulative append (post 06-04 base + 06-05 + 06-06 + 06-07 source completed)
export { createMultiplexTap } from './multiplex-tap'
export { createTapRegistry, wrapLegacyTap, type TapHandle, type TapRegistry } from './tap-registry'
export { createEventInspector, type EventInspector, type EventInspectorOptions } from './event-inspector'
export { createRouteInspector, type RouteInspector, type RouteInspectorOptions } from './route-inspector'
export { createMetricsCollector, type MetricsCollector, type MetricsCollectorOptions } from './metrics-collector'
export { createReservoir, reservoirAdd, computeSummary, type ReservoirState } from './reservoir-sampling'
export { createCardinalityTracker, flatLabels, type CardinalityTracker, type CardinalityTrackerOptions } from './cardinality-cap'
export { createPauseController, type PauseController, type PauseControllerOptions, type PausePublishFn } from './pause-controller'

// Wave 4 cumulative append (composition wrappers)
export { DevtoolsBroker, type DevtoolsBrokerConfig, type DebugSnapshot } from './devtools-broker'
export { createDevtoolsBroker } from './public-factory'
```

**3.2 — Barrel `packages/gluezero/src/index.ts`:**

```typescript
// Side-effect re-export per attivare augment di tutti i sub-package
import '@gluezero/cache'
import '@gluezero/devtools'

export { createGlueZero, type GlueZero } from './sem-bridge'
export type { GlueZeroConfig, GlueZeroFeatures } from './types/gluezero-config'

// Re-export pubblico API surface da cache + devtools
export {
  createCacheBroker, createMemoryCacheAdapter, cacheKey, stableHash,
  type CacheAdapter, type CacheConfig,
} from '@gluezero/cache'

export {
  createDevtoolsBroker, createMultiplexTap, createTapRegistry,
  createEventInspector, createRouteInspector, createMetricsCollector, createPauseController,
  type MetricsSnapshot, type DebugSnapshot,
} from '@gluezero/devtools'
```

**3.3 — 4 integration test devtools (Tier-1 jsdom):**

- `multiplex-tap-flow.test.ts` (3 scenari): 3+ tap registered (Inspector + Metrics + custom user) chain end-to-end via createDevtoolsBroker, error isolation tap throw doesn't block downstream, step 14 'event.observed' fired
- `pause-resume-flow.test.ts` (3 scenari): pauseTopic + 100 publish queued + resumeTopic → replay order preserved + downstream subscriber received in order; flushQueue audit emit verified
- `metrics-cardinality-flow.test.ts` (3 scenari): cap reached → drop new combo + emit `system.metrics.cardinality-overflow` audit, getMetricsDelta calcolo corretto, naming Prometheus-friendly verified
- `inspector-snapshot.test.ts` (3 scenari): Inspector capture publish events + getDebugSnapshot deep-clone immutability + mutation safety

**3.4 — 2 integration test sembridge (Tier-1 jsdom — chain completa verification):**

- `chain-completa-flow.test.ts` (3 scenari):
  - Test A: createGlueZero default → publish event → mapper attivo (canonical) + routing attivo (route execution) + cache attiva (se cache route) + devtools tap registra evento
  - Test B: createGlueZero default + cache route + worker route → entrambi attivi (cache hit rapido + worker offload async)
  - Test C: createGlueZero default + realtime SSE inbound mock → realtime adapter attivo + tap cattura `realtime.connected` lifecycle
- `features-opt-out.test.ts` (4 scenari):
  - Test A: features.realtime=false → realtime adapter NON istanziato (verify via mock spy)
  - Test B: features.worker=false → worker pool NON istanziato
  - Test C: features.cache=false → cacheRoutes ignorate (no cache hit)
  - Test D: features.devtools=false → tap multiplex NON wired

**3.5 — Commit aggregato:**

```bash
git add packages/devtools/src/index.ts packages/gluezero/src/index.ts packages/devtools/src/__integration__/ packages/gluezero/src/__integration__/
git commit -m "test(06-08b): barrel devtools FINAL cumulative + 6 integration test 3-tier (BLOCKER-1 + BLOCKER-2 closure)

Barrel FINAL append packages/devtools/src/index.ts cumulative (BLOCKER-1 fix):
- Wave 3 exports: createMultiplexTap + createTapRegistry + createEventInspector +
  createRouteInspector + createMetricsCollector + createReservoir + createCardinalityTracker
  + createPauseController + types
- Wave 4 exports: DevtoolsBroker + createDevtoolsBroker + types

Single-writer cumulativo post-Wave 3 — Wave 3 plans 06-05/06-06/06-07 NON hanno modificato
il barrel (file ownership disgiunta verified).

Barrel sembridge: side-effect re-export augment + createGlueZero + re-export pubblico API
surface da @gluezero/cache + @gluezero/devtools.

Devtools integration (4 file):
- multiplex-tap-flow.test.ts (3): 3+ tap chain + error isolation + step 14 attivazione
- pause-resume-flow.test.ts (3): queue FIFO + replay order + flushQueue audit
- metrics-cardinality-flow.test.ts (3): cap audit + delta + naming Prometheus
- inspector-snapshot.test.ts (3): Inspector capture + getDebugSnapshot deep-clone immutability

GlueZero integration (2 file — BLOCKER-2 acceptance):
- chain-completa-flow.test.ts (3): createGlueZero default chain F1+F2+F3+F4+F5+F6 active end-to-end
- features-opt-out.test.ts (4): realtime/worker/cache/devtools opt-out verified via spy

20/20 integration test passing. Cross-package zero regression.

D-83 strict OK verified.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```
  </action>
  <verify>
    <automated>cd "/Users/omarmarzio/programming/prova AI/GlueZero" && pnpm -F @gluezero/cache test 2>&1 | tail -15 && pnpm -F @gluezero/devtools test 2>&1 | tail -15 && pnpm -F @gluezero/gluezero test 2>&1 | tail -15 && DIFF=$(git diff main...HEAD -- packages/core/src/ packages/mapper/src/ packages/routing/src/ packages/gateway/src/ packages/worker/src/ | wc -l); echo "D-83 strict diff lines $DIFF (atteso 0)"</automated>
  </verify>
  <done>
    - Barrel FINAL packages/devtools/src/index.ts cumulative Wave 3+4 (BLOCKER-1 fix verified — single-writer)
    - Barrel packages/gluezero/src/index.ts re-export aggregati
    - 6 integration test files (~20 scenari Tier-1 jsdom passing)
    - WARNING-4 fix applicato: verify cross-package include `pnpm -F @gluezero/gluezero test`
    - 1 commit aggregato barrel + integration
    - Cross-package zero regression
    - D-83 strict OK verified (CRITICO acceptance gate)
  </done>
</task>

</tasks>

<verification>
- 50+ test totali (Tier-1 jsdom): devtools-broker (14) + devtools-factory (5) + sem-bridge (10) + 20 integration test (4 devtools + 2 sembridge file ~20 scenari)
- Coverage v8 sui 4 nuovi source ≥90/80/90/90
- Pattern carryover esplicito documentato (F5 worker-broker.ts:1-100 + F4 realtime-broker.ts:1-100 + F5 createWorkerBroker)
- D-83 strict: `git diff main...HEAD packages/{core,mapper,routing,gateway,worker}/src/` exit 0 lines (CRITICO)
- Step 14 attivazione D-161 verificata via integration test multiplex-tap-flow + inspector-snapshot
- getDebugSnapshot deep-clone D-162 verified mutation safety
- **BLOCKER-1 fix verified**: barrel devtools/src/index.ts modificato SOLO da 06-08b (single-writer post-Wave 3) — verifica `git log --oneline packages/devtools/src/index.ts` mostra append cumulativo Wave 4b (no Wave 3 commits)
- **BLOCKER-2 fix verified**: createGlueZero include CHAIN COMPLETA F1+F2+F3+F4+F5+F6 — acceptance grep `createWorkerBroker|createRealtimeBroker` ≥4 hits
- WARNING-4 fix applicato: verify Task 3 include `pnpm -F @gluezero/gluezero test`
- Threat coverage T-06-08b-01..06 documentato + tested
</verification>

<success_criteria>
- [x] DevtoolsBroker composition + step 14 attivazione + getDebugSnapshot deep-clone ✅
- [x] createDevtoolsBroker factory Valibot + D-30 ✅
- [x] **createGlueZero CHAIN COMPLETA F1+F2+F3+F4+F5+F6 (BLOCKER-2 fix)** ✅
- [x] **Barrel devtools FINAL append cumulativo single-writer (BLOCKER-1 fix)** ✅
- [x] 20+ integration test 3-tier Tier-1 jsdom passing (4 devtools + 2 sembridge) ✅
- [x] Pattern carryover F5 worker-broker.ts + F4 realtime-broker.ts ✅
- [x] TOOL-01..05 + PIPE-01 + LIFE-02 + ERR-02 + TEST-01/02 runtime done (full closure 06-09b final gate) ✅
- [x] D-83 strict carryover verified ✅
</success_criteria>

<output>
Crea `.planning/phases/06-cache-tooling-avanzato/06-08b-SUMMARY.md` con:
- File creati devtools + sembridge (count) + LOC
- Test count breakdown (broker + factory + integration)
- Coverage v8 measured
- Pattern carryover documentation (F5 worker-broker + F4 realtime-broker)
- BLOCKER-1 fix verification (barrel single-writer)
- BLOCKER-2 fix verification (chain completa acceptance grep)
- D-83 strict acceptance verified
- Threat coverage T-06-08b-01..06
- Building blocks pronti per 06-09a (CI gates + size-limit + biome) + 06-09b (DOC + JSDoc + REQ flip + milestone v1.0 closure)
</output>
