---
phase: 06-cache-tooling-avanzato
plan: 08a
type: execute
wave: 4
depends_on: [06-03]
files_modified:
  - packages/cache/src/cache-broker.ts
  - packages/cache/src/cache-broker.test.ts
  - packages/cache/src/public-factory.ts
  - packages/cache/src/public-factory.test.ts
  - packages/cache/src/test-utils/cache-harness.ts
  - packages/cache/src/__integration__/cache-flow.test.ts
  - packages/cache/src/__integration__/lifecycle-cleanup.test.ts
  - packages/cache/src/__integration__/cache-then-network.test.ts
  - packages/cache/src/__integration__/tap-events.test.ts
  - packages/cache/src/index.ts
autonomous: true
requirements:
  - CACHE-01
  - CACHE-02
  - CACHE-03
  - PIPE-01
  - LIFE-02
must_haves:
  truths:
    - "CacheBroker composition wrapper di RouterBroker (D-83 strict carryover esatto F1-F5 → F6) — header doc commento esplicito che cita Opzione B research §4.2"
    - "createCacheBroker(config) factory pubblico Valibot safeParse + prefisso 'Invalid CacheBrokerConfig:' + D-30 anti-singleton (analog F5 createWorkerBroker)"
    - "CacheBroker.publish(topic, payload, options) intercetta topic matching una cache route registrata PRIMA di delegare a inner.publish (Opzione B verified)"
    - "CacheBroker cascade D-126 ext F6 LIFE-02: unregisterPlugin(id) → inner.unregisterPlugin + adapter.invalidate({ prefix: <ownerId>::}) idempotente try/catch isolato"
    - "Cache route emette tap.onPipelineStep('event.cache.lookup'/'hit'/'miss'/'evicted') via deps.tap injected nel CacheHandler (D-161 lifecycle events) — wrapper passa optional tap forward da config.runtime.tap"
    - "Tap forwarding hook DI in CacheBroker constructor — consumed da DevtoolsBroker in 06-08b (composition F4+F5+F6 chain)"
    - "createCacheHarness fixture per integration test — wrappa createCacheBroker con DI + subscribe wildcard multi-depth (W-3 closure F4 carryover)"
    - "Barrel FINAL append packages/cache/src/index.ts esportazioni Wave 4 (CacheBroker + createCacheBroker + createCacheHarness) — cumulative chiusura cache package"
    - "4 integration test cache 3-tier (Tier-1 jsdom): cache-flow (HIT/MISS + scope D-156 + invalidate), lifecycle-cleanup (cascade D-126 ext F6 LIFE-02), cache-then-network (ordering microtask deterministic), tap-events (cache.hit/miss/evicted lifecycle D-161)"
    - "Coverage v8 sui 2 file source ≥90/80/90/90 (cache-broker + public-factory)"
    - "Vincolo D-83 strict (CRITICO): `git diff main...HEAD packages/{core,mapper,routing,gateway,worker}/src/` exit 0 lines per tutto il plan 06-08a"
  artifacts:
    - path: "packages/cache/src/cache-broker.ts"
      provides: "CacheBroker class composition wrapper di RouterBroker — Opzione B intercept publish per cache routes + cascade unregisterPlugin invalidate by ownerId (D-83 + D-126 ext F6 LIFE-02) + tap forwarding D-161"
    - path: "packages/cache/src/public-factory.ts"
      provides: "createCacheBroker(config) Valibot safeParse + D-30 + 'Invalid CacheBrokerConfig:' (analog F5 createWorkerBroker)"
    - path: "packages/cache/src/test-utils/cache-harness.ts"
      provides: "createCacheHarness fixture per integration test — wrappa createCacheBroker con DI + subscribe wildcard multi-depth"
    - path: "packages/cache/src/__integration__/cache-flow.test.ts"
      provides: "Tier-1 jsdom integration test cache-first HIT/MISS + scope D-156 user isolation + invalidate"
    - path: "packages/cache/src/__integration__/lifecycle-cleanup.test.ts"
      provides: "Tier-1 integration test cascade D-126 ext F6 LIFE-02: unregisterPlugin invalidate cache by owner"
    - path: "packages/cache/src/__integration__/cache-then-network.test.ts"
      provides: "Tier-1 integration test cache-then-network ordering microtask deterministic + scope D-156"
    - path: "packages/cache/src/__integration__/tap-events.test.ts"
      provides: "Tier-1 integration test tap lifecycle events cache.hit/miss/evicted (D-161 step 14 readiness)"
  key_links:
    - from: "packages/cache/src/cache-broker.ts"
      to: "@sembridge/routing RouterBroker"
      via: "composition wrapper inner.RouterBroker (D-83 strict carryover)"
      pattern: "RouterBroker"
    - from: "packages/cache/src/cache-broker.ts"
      to: "packages/cache/src/cache-handler.ts (06-03)"
      via: "createCacheHandlerF6 wired in CacheBroker constructor"
      pattern: "createCacheHandlerF6"
    - from: "packages/cache/src/index.ts"
      to: "CacheBroker + createCacheBroker + createCacheHarness"
      via: "FINAL barrel append Wave 4 cache package"
      pattern: "CacheBroker\\|createCacheBroker"
---

<objective>
Wave 4a sequential gate (post W2-bis 06-03): consumer dei moduli cache W2/W2-bis — composition wrapper CacheBroker + factory pubblico + harness + 4 integration test 3-tier.

**3 deliverable principali:**

1. **CacheBroker composition wrapper Opzione B** (`packages/cache/src/cache-broker.ts`): intercetta `publish(topic)` per cache routes registrate PRIMA di delegare a `inner.publish` (RouterBroker F3). Pattern carryover ESATTO da F5 worker-broker.ts:1-100. Cascade D-126 ext F6 LIFE-02 (`unregisterPlugin` → `adapter.invalidate({prefix: ownerId+::})`). Tap forwarding optional via `config.runtime.tap` per D-161 lifecycle events (consumed dal DevtoolsBroker in 06-08b).

2. **createCacheBroker factory** (`packages/cache/src/public-factory.ts`): Valibot safeParse + D-30 anti-singleton + prefisso 'Invalid CacheBrokerConfig:'.

3. **createCacheHarness fixture + 4 integration test 3-tier** in `packages/cache/src/__integration__/`:
   - `cache-flow.test.ts`: cache-first HIT/MISS + scope D-156 user isolation + invalidate API
   - `lifecycle-cleanup.test.ts`: unregisterPlugin → cache invalidate by ownerId, idempotency
   - `cache-then-network.test.ts`: ordering microtask deterministic via vitest fake timers + flushMicrotasks
   - `tap-events.test.ts`: cache lifecycle events ('event.cache.lookup'/'hit'/'miss'/'evicted') emessi via deps.tap injected (D-161 step 14 readiness — DevtoolsBroker 06-08b consumer)

**Barrel FINAL append `packages/cache/src/index.ts`**: export CacheBroker + createCacheBroker + createCacheHarness + tipi pubblici Wave 4 chiusura.

**Vincolo D-83 strict (CRITICO):** `git diff main...HEAD packages/{core,mapper,routing,gateway,worker}/src/` exit 0 — tutta F6 Wave 4a vive in `packages/cache/src/`.

**File ownership Wave 4 disgiunta da 06-08b**: 06-08a tocca SOLO `packages/cache/`. 06-08b tocca SOLO `packages/devtools/` + `packages/sembridge/`. Sequential dependency 06-08b depends_on [06-08a] per ordering chain composition.

Output: 2 file source production-ready (~230 LOC totali) + 2 file test factory (~18 test) + harness ~50 LOC + 4 integration test (~13+ scenari Tier-1 jsdom) + barrel FINAL append.
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
@.planning/phases/06-cache-tooling-avanzato/06-02-PLAN.md
@.planning/phases/06-cache-tooling-avanzato/06-03-PLAN.md
@CLAUDE.md
@packages/worker/src/worker-broker.ts
@packages/worker/src/public-factory.ts
@packages/worker/src/test-utils/worker-harness.ts
@packages/worker/src/__integration__
@packages/cache/src/cache-handler.ts
@packages/cache/src/composite-handler.ts
@packages/cache/src/memory-cache-adapter.ts
@packages/cache/src/index.ts

<interfaces>
From packages/worker/src/worker-broker.ts (analog target VERBATIM):

```typescript
import { RouterBroker, type RouterBrokerConfig } from '@sembridge/routing'

export interface WorkerBrokerConfig extends RouterBrokerConfig {
  readonly workers?: WorkerConfig
  readonly workerRoutes?: readonly RouteWorkerDefinition[]
}

export class WorkerBroker {
  private readonly inner: RouterBroker
  constructor(config: WorkerBrokerConfig) { this.inner = new RouterBroker(config) }
  publish(topic, payload, options) { /* Opzione B intercept */ }
  registerPlugin(desc) { /* cascade D-126 */ }
  unregisterPlugin(id) { /* cascade D-126 LIFE-02 */ }
}
```

From packages/worker/src/public-factory.ts (analog factory pattern):

```typescript
const WorkerBrokerConfigSchema = v.looseObject({ /* sezioni F1-F5 */ })

export function createWorkerBroker(config: WorkerBrokerConfig = {}): WorkerBroker {
  const parsed = v.safeParse(WorkerBrokerConfigSchema, config)
  if (!parsed.success) {
    const messages = parsed.issues.map((i) => i.message).join('; ')
    throw new Error(`Invalid WorkerBrokerConfig: ${messages}`)
  }
  return new WorkerBroker(config)
}
```
</interfaces>
</context>

<threat_model>
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-06-08a-01 | Logic flaw (cascade unregisterPlugin idempotency — cleanup parziale) | cache-broker | mitigate | 3-step cascade try/catch isolato per ogni step (analog F5 worker-broker D-126). Test lifecycle-cleanup verifica behavior |
| T-06-08a-02 | Information Disclosure (cache cross-tenant via missing scope on multi-plugin scenario) | cache-broker + cache-harness | mitigate | D-156 scope hybrid + D-157 missing scope audit. Test cache-flow scope isolation explicit |
| T-06-08a-03 | DoS (CacheBroker.publish hot-path overhead per topic non-cache) | cache-broker.publish | mitigate | Map.get(topic) O(1) lookup. Test perf integration sotto Tier-1 jsdom budget (1000 publish/sec) |
| T-06-08a-04 | Logic flaw (cache-then-network ordering inverted post composition) | cache-broker + cache-handler delegate | mitigate | RESEARCH §15.6 queueMicrotask SYNC pattern preservato (06-03 cache-handler) — composition wrapper NON re-ordina. Test cache-then-network ordering deterministic |
</threat_model>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: cache-broker.ts + public-factory.ts (CacheBroker composition wrapper Opzione B + Valibot factory)</name>
  <files>packages/cache/src/cache-broker.ts, packages/cache/src/cache-broker.test.ts, packages/cache/src/public-factory.ts, packages/cache/src/public-factory.test.ts</files>
  <read_first>
    - packages/worker/src/worker-broker.ts (analog target VERBATIM — composition wrapper Opzione B + cascade D-126)
    - packages/worker/src/public-factory.ts (analog target VERBATIM — Valibot safeParse + D-30)
    - packages/cache/src/cache-handler.ts (06-03 — createCacheHandlerF6 wired in CacheBroker constructor)
    - packages/cache/src/composite-handler.ts (06-03 — createCompositeHandlerF6)
    - packages/cache/src/memory-cache-adapter.ts (06-02 — adapter creation in constructor)
    - packages/cache/src/types/cache-config.ts (06-01 — CacheConfig + scopeProvider)
    - .planning/phases/06-cache-tooling-avanzato/06-PATTERNS.md sezione cache-broker LOC 366-427 + public-factory LOC 432-477
    - .planning/phases/06-cache-tooling-avanzato/06-RESEARCH.md §4.2 concretizzazione Opzione B + §11 composition topology
  </read_first>
  <action>
RED + GREEN TDD pattern.

GREEN cache-broker.ts (~150 LOC) — replica `packages/worker/src/worker-broker.ts` con sostituzione semantica:
- WorkerRegistry → MemoryCacheAdapter (via createMemoryCacheAdapter da 06-02)
- WorkerHandler → CacheHandlerF6 (via createCacheHandlerF6 da 06-03)
- workerRoutes → cacheRoutes: Map&lt;topic, RouteCacheDefinition&gt;

Skeleton TS:

```typescript
import type { EventTap } from '@sembridge/core'
import { RouterBroker, type RouterBrokerConfig } from '@sembridge/routing'
import { type CacheAdapter, createMemoryCacheAdapter } from './memory-cache-adapter'
import { createCacheHandlerF6, type CacheHandlerF6 } from './cache-handler'
import type { CacheConfig } from './types/cache-config'

export interface CacheBrokerConfig extends RouterBrokerConfig {
  readonly cache?: CacheConfig
  readonly cacheRoutes?: readonly { /* RouteCacheDefinition shape */ }[]
}

export class CacheBroker {
  private readonly inner: RouterBroker
  private readonly adapter: CacheAdapter
  private readonly handler: CacheHandlerF6
  private readonly cacheRoutes: Map<string, any>

  constructor(config: CacheBrokerConfig) {
    this.inner = new RouterBroker(config)
    this.adapter = config.cache?.adapter ?? createMemoryCacheAdapter({ maxEntries: config.cache?.maxEntries })
    this.handler = createCacheHandlerF6({
      cache: this.adapter,
      publishFn: (t, p, o) => this.inner.publish(t, p, o),
      scopeProvider: config.cache?.scopeProvider,
      tap: config.runtime?.tap,  // forward tap for D-161 lifecycle (consumed by DevtoolsBroker 06-08b)
      httpHandler: async (event, route, signal) => {
        try {
          await this.inner.publish(event.topic, event.payload, {})
          return { outcome: 'success', value: event.payload }
        } catch (err) {
          return { outcome: 'error', error: err }
        }
      },
    })
    this.cacheRoutes = new Map((config.cacheRoutes ?? []).map((r: any) => [r.topic, r]))
  }

  publish(topic: string, payload: unknown, options?: any): Promise<void> | void {
    const cacheRoute = this.cacheRoutes.get(topic)
    if (cacheRoute) {
      const event = { id: 'evt-' + Date.now(), topic, payload, timestamp: Date.now(), source: { type: 'plugin', id: 'cache-broker' } }
      return this.handler.execute(event as any, cacheRoute as any).then(() => undefined)
    }
    return this.inner.publish(topic, payload, options)
  }

  registerPlugin(desc: any): any { return this.inner.registerPlugin(desc) }

  unregisterPlugin(id: string): void {
    try { this.inner.unregisterPlugin(id) } catch {}
    try { this.adapter.invalidate({ prefix: `${id}::` }) } catch {}
  }

  getCacheStats() { return this.adapter.stats() }
}
```

GREEN public-factory.ts replica `packages/worker/src/public-factory.ts`:

```typescript
import * as v from 'valibot'
import { CacheBroker, type CacheBrokerConfig } from './cache-broker'

const CacheConfigSchema = v.optional(v.looseObject({
  maxEntries: v.optional(v.pipe(v.number(), v.minValue(1))),
  adapter: v.optional(v.unknown()),
  scopeProvider: v.optional(v.unknown()),
}))

const CacheBrokerConfigSchema = v.looseObject({
  runtime: v.optional(v.unknown()),
  debug: v.optional(v.unknown()),
  // ... pass-through F1-F5 sezioni
  cache: CacheConfigSchema,
  cacheRoutes: v.optional(v.array(v.looseObject({
    type: v.literal('cache'),
    id: v.pipe(v.string(), v.minLength(1)),
    topic: v.pipe(v.string(), v.minLength(1)),
    strategy: v.picklist(['cache-first', 'network-first', 'cache-then-network']),
    ttl: v.optional(v.pipe(v.number(), v.minValue(0))),
  }))),
})

export function createCacheBroker(config: CacheBrokerConfig = {}): CacheBroker {
  const parsed = v.safeParse(CacheBrokerConfigSchema, config)
  if (!parsed.success) {
    const messages = parsed.issues.map((i) => i.message).join('; ')
    throw new Error(`Invalid CacheBrokerConfig: ${messages}`)
  }
  return new CacheBroker(config)
}
```

Test cache-broker.test.ts: 12+ test (composition delegate (3) + Opzione B intercept (2) + cascade unregisterPlugin invalidate by owner (2) + cache stats expose (2) + DI override adapter (1) + edge cases (2)).

Test public-factory.test.ts: 6+ test (Valibot fail prefix + D-30 multi-tenant isolation + happy path).

Commit:

```bash
git add packages/cache/src/cache-broker.ts packages/cache/src/cache-broker.test.ts packages/cache/src/public-factory.ts packages/cache/src/public-factory.test.ts
git commit -m "feat(06-08a): GREEN CacheBroker composition wrapper Opzione B + createCacheBroker factory (D-83/D-121)

CacheBroker composition wrapper di RouterBroker (D-83 strict carryover F1-F5 verbatim
analog F5 worker-broker.ts:1-100). publish() Opzione B intercept per cache routes
cascade D-126 ext F6 LIFE-02 (unregisterPlugin to adapter.invalidate prefix ownerId).
Tap forwarding optional per D-161 lifecycle events (consumed by DevtoolsBroker 06-08b).

createCacheBroker(config) factory pubblico Valibot safeParse + 'Invalid CacheBrokerConfig:'
+ D-30 anti-singleton (analog F5 createWorkerBroker).

12 test cache-broker + 6 test factory passing. Coverage v8 90/80/90/90.

D-83 strict OK verified.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```
  </action>
  <verify>
    <automated>cd "/Users/omarmarzio/programming/prova AI/SemBridge" && pnpm -F @sembridge/cache test 2>&1 | tail -15 && pnpm -F @sembridge/cache build 2>&1 | tail -5</automated>
  </verify>
  <done>
    - cache-broker.ts ~150 LOC + .test.ts 12+ test
    - public-factory.ts ~80 LOC + .test.ts 6+ test
    - 4 commit TDD (RED + GREEN x2)
    - Coverage v8 ≥90/80/90/90
    - D-83 strict OK
  </done>
</task>

<task type="auto">
  <name>Task 2: createCacheHarness fixture + 4 integration test 3-tier cache (Tier-1 jsdom — D-151 carryover F5) + barrel FINAL append</name>
  <files>packages/cache/src/test-utils/cache-harness.ts, packages/cache/src/__integration__/cache-flow.test.ts, packages/cache/src/__integration__/lifecycle-cleanup.test.ts, packages/cache/src/__integration__/cache-then-network.test.ts, packages/cache/src/__integration__/tap-events.test.ts, packages/cache/src/index.ts</files>
  <read_first>
    - packages/worker/src/test-utils/worker-harness.ts (analog harness — wildcard subscribe multi-depth W-3 closure F4)
    - packages/worker/src/__integration__/dedicated.test.ts (analog Tier-1 jsdom integration test pattern)
    - packages/worker/src/__integration__/cascade-cleanup.test.ts (analog cascade D-126 LIFE-02 ext F5)
    - packages/cache/src/cache-broker.ts (creato Task 1)
    - .planning/phases/06-cache-tooling-avanzato/06-RESEARCH.md §13 test 3-tier strategy F6
  </read_first>
  <action>
2.1 — `packages/cache/src/test-utils/cache-harness.ts`:

```typescript
import { createCacheBroker, type CacheBrokerConfig } from '../public-factory'

export interface CacheHarness {
  readonly broker: ReturnType<typeof createCacheBroker>
  readonly events: readonly { topic: string; payload: unknown }[]
  publish(topic: string, payload: unknown, options?: any): Promise<void> | void
  reset(): void
}

export function createCacheHarness(config: CacheBrokerConfig = {}): CacheHarness {
  const broker = createCacheBroker(config)
  const events: { topic: string; payload: unknown }[] = []
  for (const pattern of ['*', '*.*', '*.*.*', '*.*.*.*']) {
    try {
      broker.registerPlugin({
        id: `harness-${pattern}`,
        subscriptions: [{
          topic: pattern,
          handler: (event: any) => events.push({ topic: event.topic, payload: event.payload }),
        }],
      } as any)
    } catch {}
  }
  return {
    broker,
    events,
    publish: (t, p, o) => broker.publish(t, p, o),
    reset: () => { events.length = 0 },
  }
}
```

2.2 — 4 integration test cache (Tier-1 jsdom):

- `cache-flow.test.ts` (4+ scenari): cache-first HIT/MISS + scope D-156 user isolation + invalidate API (string/RegExp/{prefix})
- `lifecycle-cleanup.test.ts` (3 scenari): unregisterPlugin → cache invalidate by ownerId, idempotency, no leak in adapter stats
- `cache-then-network.test.ts` (3 scenari): ordering microtask deterministic via vitest fake timers + flushMicrotasks, network arrives faster vs slower, MISS only fetch
- `tap-events.test.ts` (3 scenari): inject mock tap in config.runtime.tap → verify cache.lookup/hit/miss events emessi durante publish con cache route (D-161 step 14 readiness — preparazione per DevtoolsBroker 06-08b consumer)

2.3 — Barrel FINAL append `packages/cache/src/index.ts` (cumulative chiusura cache package):

```typescript
// Wave 4 final cumulative append
export { CacheBroker, type CacheBrokerConfig } from './cache-broker'
export { createCacheBroker } from './public-factory'
export { createCacheHarness, type CacheHarness } from './test-utils/cache-harness'
```

Commit:

```bash
git add packages/cache/src/test-utils/cache-harness.ts packages/cache/src/__integration__/ packages/cache/src/index.ts
git commit -m "test(06-08a): cache-harness + 4 integration test 3-tier (Tier-1 jsdom — D-151 carryover F5) + barrel FINAL append

Cache integration (4 file):
- cache-flow.test.ts (4 scenari): cache-first HIT/MISS + scope D-156 + invalidate API
- lifecycle-cleanup.test.ts (3 scenari): unregisterPlugin invalidate by ownerId + idempotency
- cache-then-network.test.ts (3 scenari): ordering microtask deterministic + edge cases
- tap-events.test.ts (3 scenari): cache.lookup/hit/miss events emessi via tap (D-161 readiness)

createCacheHarness fixture (analog F5 worker-harness — wildcard subscribe multi-depth
W-3 closure F4 carryover).

Barrel FINAL append packages/cache/src/index.ts: CacheBroker + createCacheBroker +
createCacheHarness Wave 4 chiusura.

13/13 integration test passing. Cross-package zero regression.

D-83 strict OK verified.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```
  </action>
  <verify>
    <automated>cd "/Users/omarmarzio/programming/prova AI/SemBridge" && pnpm -F @sembridge/cache test 2>&1 | tail -20 && pnpm -F @sembridge/cache build 2>&1 | tail -5 && DIFF=$(git diff main...HEAD -- packages/core/src/ packages/mapper/src/ packages/routing/src/ packages/gateway/src/ packages/worker/src/ | wc -l); echo "D-83 strict diff lines $DIFF (atteso 0)"</automated>
  </verify>
  <done>
    - cache-harness.ts ~50 LOC fixture
    - 4 integration test files (~13 scenari Tier-1 jsdom passing)
    - Barrel FINAL append packages/cache/src/index.ts cumulative chiusura
    - 1 commit aggregato test integration + barrel
    - D-83 strict OK verified
  </done>
</task>

</tasks>

<verification>
- 31+ test totali (Tier-1 jsdom): cache-broker (12) + cache-factory (6) + 13 integration test
- Coverage v8 sui 2 file source ≥90/80/90/90
- Pattern carryover esplicito documentato (F5 worker-broker.ts:1-100 + F5 createWorkerBroker)
- D-83 strict: `git diff main...HEAD packages/{core,mapper,routing,gateway,worker}/src/` exit 0 lines (CRITICO)
- Cache-then-network ordering microtask deterministic verified (Tier-1 fake timers + flushMicrotasks)
- Cascade D-126 ext F6 LIFE-02 verificata via lifecycle-cleanup integration test
- Tap forwarding D-161 readiness verificata via tap-events integration test
- Threat coverage T-06-08a-01..04 documentato + tested
- Barrel FINAL append packages/cache/src/index.ts cumulative chiusura cache package
</verification>

<success_criteria>
- [x] CacheBroker composition wrapper Opzione B (D-83 strict + D-121 carryover) ✅
- [x] createCacheBroker factory Valibot + D-30 ✅
- [x] createCacheHarness fixture per integration test ✅
- [x] 4 integration test 3-tier Tier-1 jsdom passing ✅
- [x] Barrel FINAL append packages/cache/src/index.ts cumulative chiusura ✅
- [x] Pattern carryover F5 worker-broker.ts ✅
- [x] CACHE-01..03 + LIFE-02 ext F6 + PIPE-01 readiness runtime done (final closure 06-09b) ✅
- [x] D-83 strict carryover verified ✅
</success_criteria>

<output>
Crea `.planning/phases/06-cache-tooling-avanzato/06-08a-SUMMARY.md` con:
- File creati cache (count) + LOC
- Test count breakdown (broker + factory + integration)
- Coverage v8 measured
- Pattern carryover documentation (F5 worker-broker)
- D-83 strict acceptance verified
- Threat coverage T-06-08a-01..04
- Building blocks pronti per 06-08b (DevtoolsBroker composition wrapper + createSemBridge chain completa)
</output>
