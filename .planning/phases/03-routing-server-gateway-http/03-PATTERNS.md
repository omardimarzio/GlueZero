# Phase 3: Routing & Server Gateway HTTP — Pattern Map

**Mapped:** 2026-04-30
**Files analyzed:** 30 file di nuova creazione (split tra `@gluezero/routing` e `@gluezero/gateway/http`) + 0 modifiche dirette a F1/F2 (vincolo composition wrapper D-83)
**Analogs found:** 27 / 30 con analogo F1/F2 esatto o role-match. 3 file (Strategy primitives) hanno NEW pattern documentato in RESEARCH §"Pattern 3 — Strategy Pattern + Chain of Responsibility".

> **Vincolo D-83:** ZERO modifiche a `packages/core/src/` runtime e `packages/mapper/src/` runtime. F3 è un'estensione **composition wrapper** (`RouterBroker = wrap(MapperBroker)`) + TS declaration merging via `augment.ts`. I pattern analoghi sono il riferimento autoritativo per ciascun nuovo file.

## File Classification

### `@gluezero/routing` (Routing Engine)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `packages/routing/src/augment.ts` | augment (declaration merging) | type-only | `packages/mapper/src/augment.ts` | exact |
| `packages/routing/src/types/route-definition.ts` | type definition (discriminated union) | type-only | `packages/mapper/src/types/canonical-schema.ts` | role-match |
| `packages/routing/src/types/route-policies.ts` | type definition | type-only | `packages/mapper/src/types/input-output-map.ts` | role-match |
| `packages/routing/src/types/route-outcome.ts` | type definition (discriminated result) | type-only | `packages/mapper/src/types/validator-adapter.ts` (`ValidationResult`) | role-match |
| `packages/routing/src/types/routing-config.ts` | config type | type-only | `packages/core/src/types/config.ts` | role-match |
| `packages/routing/src/route-resolver.ts` | resolver (registry + dispatch) | request-response (sync compile, sync match) | `packages/core/src/core/topic-matcher.ts` (`TopicTrie`) + `packages/mapper/src/canonical-registry.ts` | exact (composition di entrambi) |
| `packages/routing/src/route-executor.ts` | executor (dispatch by type) | request-response (async per http/cache/composite, sync per local) | `packages/mapper/src/transform-pipeline.ts` (apply by name + onFailure policy) | role-match |
| `packages/routing/src/route-handlers/local-handler.ts` | route-handler (delegate) | request-response | `packages/mapper/src/broker-mapper-wrapper.ts` § canonical-only passthrough | role-match |
| `packages/routing/src/route-handlers/http-handler.ts` | route-handler (delegate to gateway) | request-response (async) | `packages/mapper/src/mapper-engine.ts` (`applyOutputMap` orchestration) + composition con HttpGateway | role-match |
| `packages/routing/src/route-handlers/cache-handler.ts` | route-handler (stub no-op F3) | placeholder | `packages/core/src/core/event-tap.ts` (`noopEventTap`) | exact (no-op pattern) |
| `packages/routing/src/route-handlers/composite-handler.ts` | route-handler (workflow) | event-driven workflow | `packages/mapper/src/broker-mapper-wrapper.ts` § cascade D-26 (try/catch chain) | role-match |
| `packages/routing/src/router-engine.ts` | engine glue (registerRoute/unregisterRoute) | API surface | `packages/core/src/core/plugin-registry.ts` (`PluginRegistry`) | role-match |
| `packages/routing/src/router-broker-wrapper.ts` | composition wrapper | request-response | `packages/mapper/src/broker-mapper-wrapper.ts` (`MapperBroker`) | exact (replica D-49 pattern → D-83) |
| `packages/routing/src/public-factory.ts` | factory + Valibot validation | API surface | `packages/mapper/src/public-factory.ts` (`createMapperBroker`) | exact |
| `packages/routing/src/outcome-collector.ts` | step 10 publisher | event-driven | `packages/mapper/src/broker-mapper-wrapper.ts` § `handleMappingError` (publish + sanitize + recursion guard) | role-match |
| `packages/routing/src/strategies/first-match.ts` | strategy (multipleRoutes policy) | sync filter | `packages/mapper/src/alias-registry.ts` § `resolve` (priority order) | role-match |
| `packages/routing/src/strategies/priority-ordered.ts` | strategy (priority sort) | sync filter | `packages/mapper/src/alias-registry.ts` § `resolve` | role-match |
| `packages/routing/src/strategies/all-broadcast.ts` | strategy (fan-out) | sync filter | `packages/core/src/core/topic-matcher.ts` (`match`) | role-match |
| `packages/routing/src/test-utils/router-harness.ts` | test harness | test fixture | `packages/mapper/src/test-utils/mapper-harness.ts` (`createMapperHarness`) | exact (extends pattern) |
| `packages/routing/src/__integration__/scenario-meteo-http.test.ts` | integration test | test | `packages/mapper/src/__integration__/weather-scenario.test.ts` (analogo F2) | exact |
| `packages/routing/src/__integration__/retry-policy.test.ts` | integration test | test | F2 integration test pattern | role-match |
| `packages/routing/src/__integration__/dedupe.test.ts` | integration test | test | F2 integration test pattern | role-match |
| `packages/routing/src/__integration__/concurrency-latest-only.test.ts` | integration test | test | F2 integration test pattern | role-match |
| `packages/routing/src/__integration__/url-allowlist.test.ts` | integration test | test | F2 integration test pattern | role-match |
| `packages/routing/src/__integration__/route-cascade-cleanup.test.ts` | integration test | test | F2 cascade test pattern | role-match |
| `packages/routing/src/index.ts` | barrel public API | type-only re-export | `packages/mapper/src/index.ts` | exact |

### `@gluezero/gateway/http` (HTTP Gateway)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `packages/gateway/src/augment.ts` | augment (BrokerConfig.gateway) | type-only | `packages/mapper/src/augment.ts` | exact |
| `packages/gateway/src/http/types/gateway-config.ts` | config type | type-only | `packages/core/src/types/config.ts` | role-match |
| `packages/gateway/src/http/types/http-strategies.ts` | strategy interface declarations | type-only | `packages/mapper/src/types/validator-adapter.ts` (`ValidatorAdapter` pluggable interface) | role-match |
| `packages/gateway/src/http/types/http-error.ts` | error code constants | type-only | `packages/mapper/src/types/mapping-error.ts` (`MappingErrorCode`) | exact |
| `packages/gateway/src/http/http-gateway.ts` | gateway entry (compose middlewares) | request-response (async) | `packages/mapper/src/mapper-engine.ts` (`MapperEngine` — composition di 4 moduli) | role-match |
| `packages/gateway/src/http/policy-chain.ts` | middleware compose helper | request-response | NEW pattern (Koa-compose) — vedi RESEARCH §"Pattern 3" | partial (no F1/F2 analog) |
| `packages/gateway/src/http/url-allowlist.ts` | guard (pre-fetch validation) | sync validation | `packages/core/src/core/topic-matcher.ts` § `validateTopic` regex guard | role-match |
| `packages/gateway/src/http/retry-after-parser.ts` | parser util | sync transform | `packages/core/src/core/event-factory.ts` (date helpers) | role-match (utility) |
| `packages/gateway/src/http/strategies/retry-strategy.ts` | strategy (default ExponentialBackoffWithJitter) | async retry loop | NEW pattern — vedi RESEARCH §"Pattern 3" + PITFALLS #5 | partial (no F1/F2 analog) |
| `packages/gateway/src/http/strategies/timeout-strategy.ts` | strategy (FixedTimeout via AbortSignal.timeout) | sync wrapper | NEW pattern | partial (no F1/F2 analog) |
| `packages/gateway/src/http/strategies/dedupe-strategy.ts` | strategy (KeyBased Map<key, Promise>) | concurrency | NEW pattern | partial (no F1/F2 analog) |
| `packages/gateway/src/http/strategies/backpressure-strategy.ts` | strategy (queue/drop/throttle/debounce/latest-only) | concurrency | NEW pattern | partial (no F1/F2 analog) |
| `packages/gateway/src/http/strategies/auth-strategy.ts` | strategy (BearerHook + single-flight refresh) | async + middleware | NEW pattern (single-flight) — vedi RESEARCH §"Pattern 5" | partial (no F1/F2 analog) |
| `packages/gateway/src/http/strategies/idempotency-strategy.ts` | strategy (auto Idempotency-Key via nanoid) | sync header injection | NEW pattern (riusa nanoid F1) | partial (no F1/F2 analog) |
| `packages/gateway/src/http/strategies/circuit-breaker.ts` | strategy (per-route fail counter, opt-in disabled) | state machine | `packages/core/src/core/lifecycle.ts` (`transitionState`) | role-match (state machine) |
| `packages/gateway/src/http/public-factory.ts` | factory + Valibot validation | API surface | `packages/mapper/src/public-factory.ts` | exact |
| `packages/gateway/src/http/index.ts` | http subpath barrel | type-only re-export | `packages/mapper/src/index.ts` | exact |
| `packages/gateway/src/index.ts` | umbrella barrel | type-only re-export | `packages/mapper/src/index.ts` | exact |

---

## Pattern Assignments

### A. Composition wrapper (D-83 — replica F2 D-49)

#### `packages/routing/src/router-broker-wrapper.ts` (composition wrapper, request-response)

**Analog:** `packages/mapper/src/broker-mapper-wrapper.ts`

**Header doc + composition fields pattern** (lines 1-60, 205-243 dell'analogo):

```typescript
// MapperBroker — composition wrapper di Broker (F1) con MapperEngine + Inspector (F2).
// Vincolo D-49: NESSUNA modifica a packages/core/src/. Solo composition + wrapping del descriptor
// hooks per propagare il mapper-aware ctx.broker quando i plugin si sottoscrivono dentro
// onMount/onRegister.

export class MapperBroker {
  private readonly inner: Broker
  private readonly canonicalRegistry: CanonicalRegistry
  private readonly aliasRegistry: AliasRegistry
  private readonly transformPipeline: TransformPipeline
  private readonly mapper: MapperEngine
  private readonly inspector: MappingInspector
  private readonly logger: BrokerLogger
  private readonly tap: EventTap
  private readonly ownership = new Map<string, OwnershipEntry>()

  constructor(config: MapperBrokerConfig = {}) {
    this.logger = config.runtime?.logger ?? silentLogger
    this.canonicalRegistry = new CanonicalRegistry()
    // … wiring composition
    this.inner = new Broker(config)
    this.bootstrapFromConfig(config)
  }
```

**Adattamento F3 (RouterBroker):** sostituire `Broker` con `MapperBroker`, aggiungere `RouteResolver` + `RouteExecutor` + `HttpGateway` + `OutcomeCollector` come componenti privati. RESEARCH lines 421-484 mostrano la struttura esatta.

**`publish` pattern** (lines 351-443 dell'analogo — invocazione tap step + branch logic + delegate inner.publish):

```typescript
publish<T>(topic: string, payload: T, options: MapperPublishOptions = {}): void {
  const sourcePluginId = options.source?.id
  let canonicalPayload: unknown = payload
  const preAllocatedEventId = (options as { id?: string }).id ?? nanoid()

  if (sourcePluginId !== undefined && this.mapper.hasCompiled(sourcePluginId)) {
    try {
      // Step 4 tap (event.source.resolved)
      this.emitF2Tap('event.source.resolved' as PipelineStep, topic, {
        eventId: preAllocatedEventId,
        metadata: { pluginId: sourcePluginId },
      })
      // Step 5: applyOutputMap
      canonicalPayload = this.mapper.applyOutputMap(sourcePluginId, payload)
      // Step 6: validateCanonical → handleMappingError on fail (D-59 NO delivery)
      // …
    } catch (err) {
      if (isBrokerError(err)) {
        this.handleMappingError(err, topic, 'event.mapped.canonical')
        return
      }
      throw err
    }
  }
  this.inner.publish(topic, canonicalPayload, { ...options, id: preAllocatedEventId })
}
```

**Adattamento F3:** dopo `inner.publish` (cioè dopo step 1-7 di F1+F2), il `RouterBroker.publish` invoca step 8 (resolver), step 9 (executor), step 10 (outcome). Per route HTTP/cache/composite l'execute è async non-blocking; il local è già coperto dal `inner.publish` (F1+F2 delivery).

**Cascade `unregisterPlugin` pattern** (lines 517-561 dell'analogo — multi-step try/catch isolato):

```typescript
async unregisterPlugin(id: string): Promise<void> {
  await this.inner.unregisterPlugin(id)
  const recordCascadeError = (step: string, err: unknown): void => {
    this.logger.error(`MapperBroker: ${step} cascade failed`, { pluginId: id, error: err })
    // … wrap + record
  }
  try { this.aliasRegistry.unregisterScopedAll(id) } catch (err) { recordCascadeError('alias', err) }
  try { this.transformPipeline.unregisterByOwner(id) } catch (err) { recordCascadeError('transforms', err) }
  try { this.mapper.unregisterPluginMappings(id) } catch (err) { recordCascadeError('mapper', err) }
  // … schema cleanup
  this.ownership.delete(id)
}
```

**Adattamento F3 (D-86 LIFE-02 ext):** aggiungere `try { this.resolver.unregisterByOwner(id) }` + `try { this.executor.abortInFlightByOwner(id) }`. Ogni step indipendente — pattern isolation T-02-10-03 invariato.

**`registerRoute`/`unregisterRoute` (D-60):** non c'è analogo F1/F2 diretto perché F3 è il primo a esporre route. Pattern simile a `registerCanonicalSchema` (lines 616-626 dell'analogo):

```typescript
registerCanonicalSchema(schema: CanonicalSchema, options: RegisterCanonicalSchemaOptions = {}): boolean {
  const ok = this.canonicalRegistry.register(schema)
  if (ok && options.ownerId !== undefined) {
    const own = this.ownership.get(options.ownerId)
    if (own) own.canonicalSchemaIds.add(schema.id)
  }
  return ok
}
```

**Adattamento F3:** `registerRoute(routeDef, options?: { ownerId? })` ritorna `RouteRegistration { id, unregister }`, traccia ownership in `Map<ownerId, Set<routeId>>`.

---

### B. Augment (TS declaration merging — D-85, D-93, D-94, D-95)

#### `packages/routing/src/augment.ts` (augment, type-only)

**Analog:** `packages/mapper/src/augment.ts` (109 righe — file COMPLETAMENTE replicabile)

**Header pattern** (lines 1-46 dell'analogo, copiare ad-letteram con sostituzioni F2→F3):

```typescript
// augment.ts — TS declaration merging per estendere @gluezero/core con i tipi F3.
// (D-85, D-93, D-94, D-95 in 03-CONTEXT.md)
//
// Vincolo D-83: NESSUNA modifica a packages/core/src/ né packages/mapper/src/.
// Questo file è il PUNTO UNICO di chiusura dei `unknown` placeholder F1 per le sezioni F3.
//
// Cosa estende:
//   - PluginDescriptor — aggiunge `routes?: RouteDefinition[]` (D-94, replica F2 D-57)
//   - BrokerConfig — sostituisce `unknown` placeholder con tipi specifici per
//     `routes` e `gateway` (D-93, replica F2 D-56)
//   - CanonicalSchema — aggiunge `requiresRoute?: boolean` per ROUTE-16 (D-95)
//
// Cosa NON estende qui:
//   - PipelineStep (type alias literal): TS NON supporta declaration merging di type alias.
//     Strategia: barrel ri-esporta `F3PipelineStep` come literal union additive con i 3
//     nuovi step (D-85). Pattern identico a `F2PipelineStep` di mapper/src/index.ts:176-181.
//
// Side-effect import: `packages/routing/src/index.ts` importa questo file PRIMA degli export.
// `package.json` ha `sideEffects: ["./dist/augment.js"]` (T-02-09-01 mitigation pattern F2).
```

**`declare module` block pattern** (lines 52-95 dell'analogo):

```typescript
declare module '@gluezero/core' {
  interface PluginDescriptor {
    /** F3 augmentation (D-94): route dichiarate dal plugin auto-registrate al registerPlugin. */
    readonly routes?: readonly RouteDefinition[]
  }

  interface BrokerConfig {
    /** Sezione `routes` (D-93): array di RouteDefinition pre-registrate al boot. */
    routes?: readonly RouteDefinition[]
    /** Sezione `gateway` (D-93): config HTTP gateway (auth/allowlist/defaults/circuitBreaker). */
    gateway?: GatewayConfig
  }
}

declare module '@gluezero/mapper' {
  interface CanonicalSchema {
    /** F3 augmentation (D-95, ROUTE-16): se true, topic senza route → throw route.required.missing. */
    readonly requiresRoute?: boolean
  }
}

export const __augmentLoaded: true = true
```

**Adattamento F3:** stesso identico schema di F2; aggiungere il declare module per `@gluezero/mapper` per estendere `CanonicalSchema`.

#### `packages/gateway/src/augment.ts` (augment, type-only)

**Analog:** identico a `packages/mapper/src/augment.ts`. Augmenta SOLO `BrokerConfig.gateway`. Pattern identico al routing augment, con `declare module '@gluezero/core'` solo per `gateway?: GatewayConfig`.

---

### C. Public Factory (Valibot validation + composition root — D-63 createRouterBroker)

#### `packages/routing/src/public-factory.ts` (factory, API surface)

**Analog:** `packages/mapper/src/public-factory.ts` (134 righe — pattern identico)

**Schema Valibot pattern** (lines 33-71 dell'analogo):

```typescript
import * as v from 'valibot'
import { MapperBroker } from './broker-mapper-wrapper'

const FieldDescriptorSchema = v.object({ /* … */ })
const CanonicalSchemaSchema = v.object({ /* … */ })

const MapperBrokerConfigSchema = v.looseObject({
  // Sezioni F1 (pass-through)
  runtime: v.optional(v.unknown()),
  debug: v.optional(v.unknown()),
  topicSchemas: v.optional(v.unknown()),
  // Sezioni F2 (D-56) — validate strutturalmente
  canonicalModel: v.optional(v.object({
    schemas: v.optional(v.array(CanonicalSchemaSchema)),
  })),
  aliasRegistry: v.optional(v.object({ /* … */ })),
  transforms: v.optional(v.record(v.string(), v.function())),
})
```

**Adattamento F3:** schema accetta tutte le sezioni F1+F2 come pass-through (v.looseObject) e valida strutturalmente le NUOVE sezioni `routes` (array di RouteDefinition con discriminator `type`) e `gateway` (GatewayConfig: `auth`, `allowlist`, `defaults`, `circuitBreaker`). Pattern: usare `v.variant('type', [RouteLocalSchema, RouteHttpSchema, RouteCacheSchema, RouteCompositeSchema])` per la discriminated union.

**Factory function pattern** (lines 123-132 dell'analogo):

```typescript
export function createMapperBroker(
  config: ConstructorParameters<typeof MapperBroker>[0] = {},
): MapperBroker {
  const parsed = v.safeParse(MapperBrokerConfigSchema, config)
  if (!parsed.success) {
    const messages = parsed.issues.map((i) => i.message).join('; ')
    throw new Error(`Invalid MapperBrokerConfig: ${messages}`)
  }
  return new MapperBroker(config)
}
```

**Adattamento F3:** `createRouterBroker(config)` → costruttore `RouterBroker(config)`. Error message: `Invalid RouterBrokerConfig: …`. NO singleton (D-30 invariato).

#### `packages/gateway/src/http/public-factory.ts` (factory)

**Analog:** stesso `packages/mapper/src/public-factory.ts`. Esporta `createHttpGateway(config: GatewayConfig)` con Valibot validation strutturale di `auth.getToken` (function), `auth.refresh` (optional function), `allowlist` (array di string|RegExp), `defaults.timeout` (number), `defaults.retry` (oggetto), `defaults.idempotency` (oggetto), `circuitBreaker` (optional oggetto).

---

### D. Resolver (dispatch table pre-compilata — D-64)

#### `packages/routing/src/route-resolver.ts` (resolver, request-response)

**Analog primario:** `packages/core/src/core/topic-matcher.ts` (`TopicTrie`) — riuso wildcard match
**Analog secondario:** `packages/mapper/src/canonical-registry.ts` (`CanonicalRegistry`) — pattern register/unregister/listener + ownership

**TopicTrie reuse pattern** (lines 69-139 di topic-matcher.ts):

```typescript
export class TopicTrie<T> {
  private root: TrieNode<T> = createNode()

  insert(pattern: string, item: T): void {
    validateTopicPattern(pattern)
    const segments = pattern.split('.')
    let node = this.root
    for (const seg of segments) {
      let child = node.children.get(seg)
      if (!child) { child = createNode(); node.children.set(seg, child) }
      node = child
    }
    node.subscribers.add(item)
  }

  match(topic: string): T[] {
    validateTopic(topic)
    const segments = topic.split('.')
    const result: T[] = []
    this.matchRecursive(this.root, segments, 0, result)
    return result
  }
}
```

**Adattamento F3:** istanziare `TopicTrie<CompiledRoute>` come membro privato del `RouteResolver`. Insert al `registerRoute(def)`, match al `resolve(topic)`. **IMPORTANTE:** `TopicTrie` è currently NON esposto da `@gluezero/core` barrel (è solo internal). Plan F3-04 deve ri-esportarlo via path interno (`@gluezero/core/internal/topic-matcher`) oppure ricomporlo via composition lookup nel `Subscription.matcher` esistente. Decidere in plan 03-05.

**Register/listener/ownership pattern** (lines 100-160 di canonical-registry.ts):

```typescript
register(schema: CanonicalSchema, options: RegisterOptions = {}): boolean {
  // Reserved-keys guard (T-02-03 mitigation)
  if (RESERVED_KEYS.has(schema.id)) throw createBrokerError({ code: 'canonical.id.reserved', … })
  // Requires resolution check (D-36)
  if (schema.requires) {
    const missing = schema.requires.filter((req) => !this.schemas.has(req))
    if (missing.length > 0) throw createBrokerError({ code: 'canonical.requires.unresolved', … })
  }
  // Strict mode: throw on duplicate; non-strict: idempotent return false
  if (this.schemas.has(schema.id)) {
    if (options.strict) throw createBrokerError({ code: 'canonical.id.duplicate', … })
    return false
  }
  this.schemas.set(schema.id, schema)
  // Listener invocation (T-02-03-01 swallow)
  for (const listener of this.listeners) {
    try { listener(schema) } catch { /* swallow */ }
  }
  return true
}
```

**Adattamento F3:** `RouteResolver.register(def, ownerId?)` → idempotent default + strict opt-in via `route.id.duplicate`. Aggiungere precompilation step PRIMA dell'insert nel trie: `compile(def)` produce `CompiledRoute { id, definition, ownerId, priority, compiledRequestBuilder, compiledResponseMapper }` (RESEARCH lines 494-501). Tracking ownership: `Map<ownerId, Set<routeId>>` come in `OwnershipEntry` di MapperBroker (lines 148-152 di broker-mapper-wrapper.ts).

---

### E. Executor + Route Handlers (dispatch by type — D-65)

#### `packages/routing/src/route-executor.ts` (executor, request-response)

**Analog:** `packages/mapper/src/transform-pipeline.ts` § `apply` (lines 117-180 — dispatch by name + onFailure policy)

**Apply by-name + escalation policy pattern** (lines 117-186 di transform-pipeline.ts):

```typescript
apply(name: string, input: unknown, ctx: TransformContext, onFailure: FieldFailureMode, defaultValue?: unknown): unknown {
  const entry = this.transforms.get(name)
  if (!entry) {
    throw createBrokerError({ code: 'transform.not-found', … })
  }
  try {
    return entry.descriptor.fn(input, ctx)
  } catch (err) {
    // D-44 onFailure escalation policy
    if (onFailure === 'block') {
      throw createBrokerError({
        code: 'mapping.transform.failed',
        category: 'mapping',
        message: `Transform "${name}" failed`,
        ...(err instanceof Error && { originalError: err }),
        details: { transformName: name, originalMessage: err instanceof Error ? err.message : String(err) },
      })
    }
    if (onFailure === 'skip') return undefined
    if (onFailure === 'fallback') return defaultValue
  }
}
```

**Adattamento F3:** `RouteExecutor.execute(compiledRoute, event)` switcha su `compiledRoute.definition.type`:
- `'local'` → `localHandler(event, this.bus)` sync
- `'http'` → `await httpHandler(event, this.httpGateway, this.mapper)` async ritorna `RouteOutcome`
- `'cache'` → `await cacheHandler.execute(event)` (stub F3 → `RouteOutcome.error code='cache.not-implemented'`)
- `'composite'` → `await compositeHandler.execute(event, children)` workflow

#### `packages/routing/src/route-handlers/local-handler.ts` (route-handler, request-response)

**Analog:** `packages/mapper/src/broker-mapper-wrapper.ts` § canonical-only passthrough (lines 363-442)

Implementation (≤30 LOC come specificato in RESEARCH line 369): l'handler `local` semplicemente delega a `inner.publish` (cioè il `MapperBroker.publish` invariato F2). Dato che `RouterBroker.publish` per topic con SOLO route `local` già delega a `inner.publish` (vedi RouterBroker pattern A sopra), questo handler è invocato SOLO per `RouteDefinition.type === 'local'` esplicito (raro — il default no-route usa la stessa delega).

#### `packages/routing/src/route-handlers/http-handler.ts` (route-handler, async request-response)

**Analog:** `packages/mapper/src/mapper-engine.ts` § `applyOutputMap` orchestration (vedi mapper-engine.ts lines 1-67 header docs per pattern di "compose 4 moduli")

**Pattern orchestration:**
1. **Build request:** invoca `mapper.mapToShape(canonicalPayload, route.request.queryMap)` per query params + `mapper.mapToShape(payload, route.request.bodyMap)` per body (D-96 — riuso `MapperEngine`).
2. **Delegate to gateway:** `await httpGateway.fetch(httpRequestSpec, ctx)` ritorna `Response` o throw.
3. **Parse + validate response:** invoca `mapper.mapToCanonical(serverResponse, route.response.canonical)` (D-97). Se la route dichiara `response: { canonical: 'weather' }`, applica step 6 di F2 (`canonicalRegistry.validateCanonical`).
4. **Wrap in RouteOutcome:** `{ ok: true, canonicalPayload }` o `{ ok: false, error: BrokerError }`.

#### `packages/routing/src/route-handlers/cache-handler.ts` (placeholder no-op F6)

**Analog esatto:** `packages/core/src/core/event-tap.ts` § `noopEventTap` (lines 19-21):

```typescript
export const noopEventTap: EventTap = {
  onPipelineStep: () => {},
}
```

**Adattamento F3:** stub returns `RouteOutcome.error { code: 'cache.not-implemented', category: 'config', … }`. F6 sostituirà con cache adapter reale.

#### `packages/routing/src/route-handlers/composite-handler.ts` (workflow, event-driven)

**Analog:** `packages/mapper/src/broker-mapper-wrapper.ts` § cascade `unregisterPlugin` (lines 517-561 — pattern multi-step try/catch chain). Workflow F3: check-cache (F6 stub) → http (F3 reale) → update-cache (F6 stub) → publish loaded.

---

### F. Outcome Collector (step 10 — D-80, D-82)

#### `packages/routing/src/outcome-collector.ts` (event-driven publisher)

**Analog:** `packages/mapper/src/broker-mapper-wrapper.ts` § `handleMappingError` (lines 1029-1068)

**Publish + sanitize + recursion guard pattern** (lines 1029-1068 dell'analogo):

```typescript
private handleMappingError(err: BrokerError, sourceTopic: string, step: string): void {
  this.inspector.recordError(err)
  // CR-06 recursion guard: skip se la pair (sourceTopic, step) è già in-flight
  const key = `${sourceTopic}::${step}`
  if (this.inFlightMappingErrors.has(key)) {
    this.logger.warn('mapping.error recursion guard activated', { sourceTopic, step })
    return
  }
  this.inFlightMappingErrors.add(key)
  try {
    // CR-06 sanitization: payload safe (no originalError, no cause, no stack ricorsivi)
    const safeError = { code: err.code, category: err.category, message: err.message, details: err.details }
    this.inner.publish('mapping.error', { error: safeError, sourceEvent: sourceTopic, step }, {
      source: { type: 'system', id: 'mapper' },
      deliveryMode: 'async',
    })
  } finally {
    this.inFlightMappingErrors.delete(key)
  }
}
```

**Adattamento F3 (D-82 NO double publish):**
- `OutcomeCollector.collect(routeOutcome, originatingEvent, route)`:
  - Se `outcome.ok` → publish `<topic>.loaded` (riuso `route.publishes.success` o convention `<topic-prefix>.loaded`)
  - Se `outcome.error` → publish `<topic>.failed` UNA volta con shape D-80 (code/message/category/routeId/topic/eventId/originalError/cause/httpStatus/retryAttempt/retryAfterMs)
- Pattern recursion guard adattato: `Map<eventId, Set<step>>` per garantire single publish per outcome (D-82).
- Aggiuntiva publish di `network.error` per `category: 'network'` (D-81 — secondo evento CORE separato).

---

### G. Test Utils + Integration Test (extends F2 harness — D-89)

#### `packages/routing/src/test-utils/router-harness.ts` (test fixture)

**Analog esatto:** `packages/mapper/src/test-utils/mapper-harness.ts` (128 righe — file COMPLETAMENTE replicabile con sostituzioni)

**Header doc + options pattern** (lines 1-60 dell'analogo):

```typescript
// mapper-harness.ts — fixture condivisa per integration test del package
// `@gluezero/mapper` (PRD §29 D-53 scenario meteo end-to-end, REQ TEST-01/TEST-02).

export interface MapperHarnessOptions {
  readonly debug?: boolean
  readonly schemas?: readonly CanonicalSchema[]
  readonly transforms?: Readonly<Record<string, TransformFn>>
  readonly aliases?: Readonly<Record<string, string>>
}

export interface MapperHarness {
  readonly broker: MapperBroker
  readonly steps: Array<{ step: PipelineStep; snapshot: PipelineSnapshot }>
  reset(): void
  byStep(step: PipelineStep): PipelineSnapshot[]
  defineCanonicalSchema(schema: CanonicalSchema): void
  defineTransform(name: string, fn: TransformFn): void
}
```

**Factory function pattern** (lines 91-128 dell'analogo):

```typescript
export function createMapperHarness(options: MapperHarnessOptions = {}): MapperHarness {
  const steps: MapperHarness['steps'] = []
  const tap: EventTap = {
    onPipelineStep(step, snapshot): void { steps.push({ step, snapshot }) },
  }
  const broker = createMapperBroker({
    runtime: {
      tap,
      logLevel: 'silent',
      ...(options.debug !== undefined && { debug: options.debug }),
    },
    ...(options.schemas && { canonicalModel: { schemas: [...options.schemas] } }),
    ...(options.transforms && { transforms: { ...options.transforms } }),
    ...(options.aliases && { aliasRegistry: { global: { ...options.aliases } } }),
  })
  return { broker, steps, reset() { steps.length = 0 }, byStep(step) { /* … */ }, … }
}
```

**Adattamento F3 (`createRouterHarness`):** estende le options con:
- `routes?: readonly RouteDefinition[]` — pre-registrate al boot
- `gateway?: GatewayConfig` — config gateway test-friendly
- `mockServer?: SetupServerApi` — `msw` 2.x mock setup (RESEARCH line 102)

E le helpers con:
- `defineRoute(def: RouteDefinition): RouteRegistration`
- `mockServer(handlers: RequestHandler[]): SetupServerApi` — wrapper `setupServer` di `msw/node`
- `expectFetched(url: string | RegExp): RequestSpec[]` — assertion sui fetch effettuati
- `expectRetryAttempts(n: number): void` — assertion retry count
- `expectAborted(n: number): void` — assertion AbortController.abort calls

**Pattern msw setup nel harness:**

```typescript
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

const server = setupServer(...handlers)
server.listen({ onUnhandledRequest: 'error' })
afterAll(() => server.close())
```

#### Integration test files (6 file)

**Analog template:** RESEARCH §"Scenario meteo PRD §29 esteso con HTTP" (lines 374-428 di 03-CONTEXT.md) + pattern test F2 `__integration__/`. Ogni test usa `createRouterHarness` + `msw` handlers per verificare end-to-end.

---

### H. Type definitions (discriminated unions, branded types)

#### `packages/routing/src/types/route-definition.ts` (type-only)

**Analog:** `packages/mapper/src/types/canonical-schema.ts` (struttura `CanonicalSchema` con discriminator + readonly fields)

**Pattern discriminated union F3:**

```typescript
import type { GatewayConfig } from '@gluezero/gateway'
import type { CanonicalSchemaId, InputMap, OutputMap } from '@gluezero/mapper'

export interface RouteLocalDefinition {
  readonly id: string
  readonly type: 'local'
  readonly topic: string
  readonly priority?: number
}

export interface RouteHttpDefinition {
  readonly id: string
  readonly type: 'http'
  readonly topic: string
  readonly priority?: number
  readonly request: {
    readonly method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
    readonly url: string
    readonly queryMap?: OutputMap   // canonico → server flat (riuso F2)
    readonly bodyMap?: OutputMap    // canonico → server body
    readonly serializer?: (canonical: unknown) => BodyInit  // D-98 opt-in
  }
  readonly response: {
    readonly canonical: CanonicalSchemaId  // D-97 — riferimento schema F2
  }
  readonly publishes?: {
    readonly success?: string
    readonly error?: string
  }
  readonly policies?: RoutePolicies
}

export interface RouteCacheDefinition { /* type defined F3, adapter F6 */ }
export interface RouteCompositeDefinition { /* workflow F3, cache adapter F6 */ }

export type RouteDefinition =
  | RouteLocalDefinition
  | RouteHttpDefinition
  | RouteCacheDefinition
  | RouteCompositeDefinition
```

#### `packages/routing/src/types/route-outcome.ts` (type-only)

**Analog esatto:** `packages/mapper/src/types/validator-adapter.ts` § `ValidationResult` (discriminated `{ ok: true } | { ok: false }`)

**Pattern:**

```typescript
export type RouteOutcome =
  | { readonly ok: true; readonly canonicalPayload: unknown; readonly routeId: string }
  | { readonly ok: false; readonly error: BrokerError; readonly routeId: string }
```

#### `packages/gateway/src/http/types/http-error.ts` (type-only error codes)

**Analog esatto:** `packages/mapper/src/types/mapping-error.ts` (literal union dei codici errore + type guard `isMappingErrorCode`)

**Pattern:**

```typescript
export type GatewayErrorCode =
  | 'gateway.timeout'
  | 'gateway.4xx'
  | 'gateway.5xx'
  | 'gateway.network'
  | 'gateway.url.forbidden'
  | 'response.validation.failed'
  | 'route.required.missing'
  | 'auth.expired'
  | 'circuit.open'

export function isGatewayErrorCode(code: string): code is GatewayErrorCode { /* … */ }
```

---

### I. Strategy Pattern + Chain of Responsibility (NEW — RESEARCH §"Pattern 3")

I file `packages/gateway/src/http/strategies/*.ts` non hanno analogo F1/F2 diretto perché il gateway HTTP introduce strategie auth/retry/dedupe/idempotency mai presenti prima. Riferimento: RESEARCH lines 531-624 con pattern Koa-compose.

#### `packages/gateway/src/http/policy-chain.ts` (compose helper)

**Pattern Koa-compose** (RESEARCH lines 555-568):

```typescript
type GatewayMiddleware = (ctx: GatewayContext, next: () => Promise<void>) => Promise<void>

export function compose(middlewares: readonly GatewayMiddleware[]): (ctx: GatewayContext) => Promise<void> {
  return async (ctx) => {
    let index = -1
    const dispatch = async (i: number): Promise<void> => {
      if (i <= index) throw new Error('next() called multiple times')
      index = i
      const fn = middlewares[i]
      if (!fn) return
      await fn(ctx, () => dispatch(i + 1))
    }
    return dispatch(0)
  }
}
```

#### Strategy interface pattern (analogo `ValidatorAdapter` di F2)

**Analog:** `packages/mapper/src/types/validator-adapter.ts` § `ValidatorAdapter` interface pluggable

**Pattern F3 (esempio per RetryStrategy):**

```typescript
// Source: packages/mapper/src/types/validator-adapter.ts (struttura interface adapter)
export interface ValidatorAdapter {
  validate(schema: unknown, payload: unknown): ValidationResult
}

// Adattamento F3:
export interface RetryStrategy {
  shouldRetry(response: Response | undefined, error: Error | undefined, attempt: number): boolean
  delayMs(attempt: number, retryAfter?: number): number
}
```

Pattern identico per `TimeoutStrategy`, `DedupeStrategy`, `BackpressureStrategy`, `AuthStrategy`, `IdempotencyStrategy`. Default implementation per ognuno (`ExponentialBackoffWithJitter`, `FixedTimeout`, `KeyBased`, `LatestOnly`, `BearerHook`, `AutoIdempotency`) come export named di stessa file (pattern `valibotAdapter` di F2).

#### Single-flight pattern per `auth-strategy.ts` (D-72 + Pitfall 5)

**Source:** RESEARCH lines 671-694:

```typescript
class SingleFlightRefresh {
  private inflightRefresh: Promise<string> | null = null
  async refresh(refreshFn: () => Promise<string>): Promise<string> {
    if (this.inflightRefresh) return this.inflightRefresh
    this.inflightRefresh = refreshFn().finally(() => { this.inflightRefresh = null })
    return this.inflightRefresh
  }
}
```

#### Circuit breaker (state machine — D-99)

**Analog:** `packages/core/src/core/lifecycle.ts` § `transitionState` (state machine `closed → open → half-open → closed`).

---

### J. URL Allowlist (SEC-05 — D-71)

#### `packages/gateway/src/http/url-allowlist.ts`

**Analog:** `packages/core/src/core/topic-matcher.ts` § `validateTopic` (regex guard + throw on mismatch)

**Pattern** (lines 35-44 dell'analogo):

```typescript
const TOPIC_REGEX = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9*]*)*$/
export function validateTopic(topic: string): void {
  if (!TOPIC_REGEX.test(topic)) {
    throw createBrokerError({
      code: 'topic.invalid',
      category: 'topic',
      message: `Invalid topic name: "${topic}". Must match pattern …`,
      details: { topic, regex: TOPIC_REGEX.source },
    })
  }
}
```

**Adattamento F3:**

```typescript
export function validateAgainstAllowlist(url: string, allowlist: ReadonlyArray<string | RegExp> | undefined): void {
  if (!allowlist) return  // dev convenience — warning emesso al createBroker
  const ok = allowlist.some((entry) =>
    entry instanceof RegExp ? entry.test(url) : url.startsWith(entry) || url === entry
  )
  if (!ok) {
    throw createBrokerError({
      code: 'gateway.url.forbidden',
      category: 'config',
      message: `URL "${url}" is not in the allowlist`,
      details: { url, allowlist: allowlist.map((e) => String(e)) },
    })
  }
}
```

**Pitfall 7 (redirect bypass):** post-redirect re-validation richiesta → `redirect: 'manual'` di default + re-call `validateAgainstAllowlist` su `Location` header.

---

### K. Barrel + Side-effect import

#### `packages/routing/src/index.ts` (barrel public API)

**Analog esatto:** `packages/mapper/src/index.ts` (lines 64-181 — pattern barrel con side-effect import + runtime exports + type exports + F2PipelineStep literal union).

**Pattern fondamentale (lines 64-82 dell'analogo):**

```typescript
// Side-effect import — abilita TS declaration merging per PluginDescriptor + BrokerConfig.
// Vedi `packages/mapper/src/augment.ts` (D-49/D-56/D-57).
// Ri-esportiamo `__augmentLoaded` come simbolo pubblico per evitare il tree-shaking.

export { __augmentLoaded } from './augment'
// Runtime exports
export { MapperBroker } from './broker-mapper-wrapper'
export { createMapperBroker } from './public-factory'
// Type exports
export type { CanonicalSchema, … } from './types/canonical-schema'
// Pipeline step literal union additive
export type F2PipelineStep =
  | 'event.source.resolved'
  | 'event.mapped.canonical'
  | 'event.canonical.validated'
  | 'event.mapped.consumer'
  | 'event.final.validated'
```

**Adattamento F3:**

```typescript
export { __augmentLoaded } from './augment'
export { RouterBroker } from './router-broker-wrapper'
export { createRouterBroker } from './public-factory'
export type { RouteDefinition, RouteLocalDefinition, RouteHttpDefinition, … } from './types/route-definition'
export type { RouteOutcome, RouteResult, RouteError } from './types/route-outcome'
export type { RoutePolicies, RetryPolicyConfig, BackpressurePolicyConfig, … } from './types/route-policies'
export type F3PipelineStep =
  | 'event.route.resolved'
  | 'event.route.executed'
  | 'event.outcome.collected'
```

---

## Shared Patterns (cross-cutting)

### Pattern S1: Side-effect import + sideEffects array (T-02-09-01 mitigation)

**Source:** `packages/mapper/src/augment.ts:18-25` + `packages/mapper/package.json` § `sideEffects: ["./dist/augment.js"]`
**Apply to:** Both `packages/routing/` and `packages/gateway/` (entrambi i package F3 hanno `augment.ts` da preservare dal tree-shaker)

```json
// packages/{routing,gateway}/package.json
{
  "sideEffects": ["./dist/augment.js"]
}
```

### Pattern S2: BrokerError construction + `Error.cause` chain (D-80)

**Source:** `packages/core/src/core/broker-error.ts:45-58`
**Apply to:** All gateway/routing files that throw — `route-resolver.ts`, `route-executor.ts`, `http-gateway.ts`, `url-allowlist.ts`, `outcome-collector.ts`, every strategy file, `auth-strategy.ts`.

```typescript
// Source: packages/core/src/core/broker-error.ts:45-58
export function createBrokerError(params: CreateBrokerErrorParams): BrokerError {
  const err = new Error(params.message) as Error as MutableBrokerError
  err.name = 'BrokerError'
  err.code = params.code
  err.category = params.category
  if (params.details) err.details = params.details
  if (params.originalError) {
    err.originalError = params.originalError
    err.cause = params.originalError  // ES2022 chain
  }
  if (params.routeId) err.routeId = params.routeId
  if (params.topic) err.topic = params.topic
  if (params.eventId) err.eventId = params.eventId
  return err as BrokerError
}
```

**F3 use:** TUTTI gli errori `gateway.*`/`route.*`/`auth.*`/`circuit.*` USANO questa factory. `routeId`+`topic`+`eventId` sono già nel `CreateBrokerErrorParams` di F1 — pattern naturale per F3.

### Pattern S3: EventTap step instrumentation (D-85, vincolo architetturale CLAUDE.md)

**Source:** `packages/core/src/core/event-tap.ts:23-53` (`safeTapStep` + `startStep`)
**Apply to:** All step F3 emissions in `route-resolver.ts` (step 8), `route-executor.ts` (step 9), `outcome-collector.ts` (step 10), and `router-broker-wrapper.ts` orchestration.

```typescript
// Source: packages/core/src/core/event-tap.ts:23-53
export function safeTapStep(tap: EventTap, step: PipelineStep, snapshot: PipelineSnapshot, onError?: (e: unknown) => void): void {
  try { tap.onPipelineStep(step, snapshot) } catch (e) { onError?.(e) }
}

export function startStep(): SnapshotFactory {
  const start = performance.now()
  return (step, eventId, topic, extras = {}) => ({
    eventId, topic, step,
    timestamp: Date.now(),
    durationMs: performance.now() - start,
    ...extras,
  })
}
```

**F3 use:** ogni step (8/9/10) crea factory all'inizio, emette tap alla fine con `safeTapStep` + try/catch swallow. F6 sostituirà no-op con Inspector reale **senza retrofit** (vincolo architetturale).

### Pattern S4: Conditional spread per `exactOptionalPropertyTypes`

**Source:** Pervasive in F1+F2 — esempio `packages/mapper/src/transform-pipeline.ts:84-92` + `packages/mapper/src/test-utils/mapper-harness.ts:101-110`

```typescript
// Source: packages/mapper/src/transform-pipeline.ts:84-92
const descriptor: TransformDescriptor = {
  name,
  fn,
  ...(options.description !== undefined && { description: options.description }),
}
const entry: TransformEntry = {
  descriptor,
  ...(options.ownerId !== undefined && { ownerId: options.ownerId }),
}
```

**F3 use:** OBBLIGATORIO in TUTTI i file F3 per costruire `RouteDefinition`, `CompiledRoute`, `RouteOutcome`, `GatewayContext`, `BrokerError details` con campi opzionali. `tsconfig.base.json` ha `exactOptionalPropertyTypes: true`.

### Pattern S5: `nanoid` per id generation (D-70 idempotency token + correlationId)

**Source:** `packages/core/src/core/event-factory.ts:63` (createBrokerEvent: `id: params.id ?? nanoid()`) + `packages/mapper/src/broker-mapper-wrapper.ts:361` (`preAllocatedEventId = options.id ?? nanoid()`)

**F3 use:**
- `idempotency-strategy.ts` → genera `Idempotency-Key: nanoid()` al first attempt; persiste su retry (D-70 + Pitfall 3)
- `outcome-collector.ts` → propaga `correlationId` da event scatenante a `<topic>.loaded`/`<topic>.failed`
- `route-executor.ts` → eventualmente per `RouteOutcome.id` se serve correlare retry attempt

### Pattern S6: `valibotAdapter` per response validation (VAL-05, D-78)

**Source:** `packages/mapper/src/valibot-adapter.ts:99-152` (export `valibotAdapter: ValidatorAdapter` con safeParse + issue mapping)

**F3 use:** `route-handlers/http-handler.ts` invoca `valibotAdapter.validate(canonicalSchema, parsedResponse)` per validare la response dopo il mapping server→canonical. Riuso DIRETTO — F3 non re-implementa.

### Pattern S7: Cascade D-26 ext F3 (LIFE-02 chiusura PRD §39 #7)

**Source:** `packages/mapper/src/broker-mapper-wrapper.ts:517-561` (cascade `unregisterPlugin` con try/catch isolato per ogni step)

**F3 extension (D-86):** estende il cascade aggiungendo:
1. `inner.unregisterPlugin(id)` (delegato a `MapperBroker.unregisterPlugin` — F1+F2 cascade già coperto)
2. `this.resolver.unregisterByOwner(id)` — rimuove route ownership-tagged
3. `this.executor.abortInFlightByOwner(id)` — cascade abort `AbortController` per ogni fetch in volo bound al `pluginId` (D-76)
4. `recordCascadeError` per ognuno → swallow + log + Inspector ring buffer (T-02-10-03 invariato)

### Pattern S8: msw 2.x setup per integration test (D-89)

**Source:** RESEARCH §"Common Pitfalls / Pitfall 8" + RESEARCH §"Plan Topology Wave 6"

**F3 use:** `router-harness.ts` espone `mockServer(handlers)` wrapper di `setupServer` da `msw/node`. Test integration (`scenario-meteo-http.test.ts`, ecc.) usano:

```typescript
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

const server = setupServer(
  http.get('/api/weather', () => HttpResponse.json({ city: 'Roma', date: '2026-04-30', temp: 22, condition: 'sunny' })),
)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

### Pattern S9: CI gates extension (publint + attw + size-limit) — pattern F2 plan 02-12

**Source:** F2 plan 02-12 ha esteso `publint`, `attw` (Are The Types Wrong), `size-limit` a `@gluezero/mapper` (replicare per F3).

**F3 plan 03-14 final gate must:**
- Estendere `publint --strict` a `packages/routing/` e `packages/gateway/`
- Estendere `attw --pack` a entrambi i package F3
- Aggiungere `size-limit` budget:
  - `@gluezero/routing` → 5 KB gzip (RESEARCH line 13)
  - `@gluezero/gateway/http` → 6 KB gzip (RESEARCH line 13 + line 339)
- Aggiungere config `package.json` `exports` con subpath `./http` e `./sse-ws` (placeholder F4) — RESEARCH lines 330-342:

```json
{
  "name": "@gluezero/gateway",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./http": { "types": "./dist/http/index.d.ts", "import": "./dist/http/index.js" }
  },
  "size-limit": [
    { "name": "@gluezero/gateway/http (gzip)", "path": "dist/http/index.js", "limit": "6 KB", "gzip": true }
  ]
}
```

---

## No Analog Found

File senza match diretto F1/F2 (planner usa RESEARCH §"Pattern 3" + RESEARCH §"Pattern 5" + RESEARCH §"Code Examples" — sono pattern documentati nel research, non analoghi codice esistente):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `packages/gateway/src/http/policy-chain.ts` | compose helper | request-response | Koa-compose pattern (RESEARCH lines 555-568) — NEW pattern, no F1/F2 analog ma documentato in research |
| `packages/gateway/src/http/strategies/retry-strategy.ts` | strategy + full jitter formula | async retry | NEW (RESEARCH §"Pattern 3" + PITFALLS #5 full-jitter formula) |
| `packages/gateway/src/http/strategies/timeout-strategy.ts` | strategy + AbortSignal | sync wrapper | NEW (RESEARCH §"Don't Hand-Roll" `AbortSignal.timeout()`) |
| `packages/gateway/src/http/strategies/dedupe-strategy.ts` | KeyBased dedup Map<key, Promise> | concurrency | NEW (RESEARCH "Code Examples" Promise singleton) |
| `packages/gateway/src/http/strategies/backpressure-strategy.ts` | queue/drop/throttle/debounce/latest-only/coalesce | concurrency | NEW (PRD §23.3 — multi-policy enum) |
| `packages/gateway/src/http/strategies/auth-strategy.ts` | BearerHook + single-flight refresh | async middleware | NEW (RESEARCH §"Pattern 5" SingleFlightRefresh) |
| `packages/gateway/src/http/strategies/idempotency-strategy.ts` | auto Idempotency-Key via nanoid | sync header injection | NEW (riusa nanoid F1) |
| `packages/gateway/src/http/retry-after-parser.ts` | parser HTTP-date / delta-seconds | sync transform | NEW (utility tipica HTTP) |
| `packages/gateway/src/http/http-gateway.ts` | gateway entry (compose middlewares) | request-response | Pattern composition `MapperEngine` (role-match) ma orchestrazione middleware è NEW |

**Per ognuno di questi file il planner deve estrarre il pattern/excerpt direttamente da RESEARCH.md** (lines 415-694: "Architecture Patterns" + "Code Examples" sections) anziché da un file F1/F2.

---

## Metadata

**Analog search scope:**
- `packages/core/src/{core,types,test-utils}/` — base layer (16 file)
- `packages/mapper/src/{,test-utils,types,__integration__}/` — composition wrapper template (15 file)
- `packages/{routing,gateway}/src/` — vuote, placeholder F1 plan 01 (saranno popolate da F3)

**Files scanned:** 27 file analizzati (15 mapper + 12 core)
**Files read in detail:**
- `packages/mapper/src/broker-mapper-wrapper.ts` (1083 lines) — composition wrapper template autoritativo
- `packages/mapper/src/augment.ts` (109 lines) — declaration merging template
- `packages/mapper/src/public-factory.ts` (134 lines) — Valibot factory template
- `packages/mapper/src/canonical-registry.ts` (222 lines) — register/listener/ownership template
- `packages/mapper/src/test-utils/mapper-harness.ts` (128 lines) — harness template
- `packages/mapper/src/transform-pipeline.ts` (~120 lines header read) — apply by-name + escalation template
- `packages/mapper/src/alias-registry.ts` (~120 lines header read) — scoped/global resolve template
- `packages/mapper/src/mapper-engine.ts` (~120 lines header read) — engine composition template
- `packages/core/src/core/topic-matcher.ts` (155 lines) — TopicTrie wildcard reuse
- `packages/core/src/core/event-tap.ts` (53 lines) — safeTapStep + startStep template
- `packages/core/src/core/broker-error.ts` (87 lines) — createBrokerError template
- `packages/core/src/core/plugin-registry.ts` (~100 lines header read) — cascade + scoped broker
- `packages/core/src/test-utils/pipeline-harness.ts` (75 lines) — harness primitive template
- `packages/core/src/types/{tap,plugin,config}.ts` — placeholder docs F1 chiusi da F3 augment
- `packages/core/src/public-factory.ts` (115 lines) — Valibot looseObject template

**Pattern extraction date:** 2026-04-30
