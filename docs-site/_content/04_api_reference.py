# API Reference for the 8 packages.
PAGES = []

# --------------------------------------------------------------------------
PAGES.append((
    'api/gluezero.html', '@gluezero/gluezero', 'API reference',
    'createGlueZero aggregate factory chain composition F1 F2 F3 F4 F5 F6 features opt-out',
    '../',
    '''<h1><code>@gluezero/gluezero</code></h1>
<p class="lead">Aggregate factory that composes all 6 phases into a single broker. <code>createGlueZero()</code> returns a fully wired runtime: pub/sub + canonical mapping + routing + HTTP gateway + realtime + worker + cache + devtools.</p>

<div class="callout">
<span class="callout-label">Install</span>
<code>pnpm add @gluezero/gluezero</code> — pulls in all 8 sub-packages as transitive deps.
</div>

<h2 id="createGlueZero"><code>createGlueZero(config)</code></h2>
<pre><code class="language-typescript">function createGlueZero(config?: GlueZeroConfig): GlueZeroBroker
</code></pre>
<p>Pure function (no singleton). Each call returns a fresh, independent instance.</p>

<h3 id="config"><code>GlueZeroConfig</code></h3>
<pre><code class="language-typescript">interface GlueZeroConfig {
  // F1: Core
  debug?: boolean
  taps?: readonly EventTap[]

  // F2: Mapper
  canonicalModel?: CanonicalModelConfig
  aliasRegistry?: { global?: Record&lt;string, string&gt;; scoped?: Record&lt;string, Record&lt;string, string&gt;&gt; }
  transforms?: Record&lt;string, TransformFn&gt;
  validator?: ValidatorAdapter

  // F3: Routing + Gateway HTTP
  routes?: readonly RouteDefinition[]
  gateway?: GatewayConfig

  // F4: Realtime
  realtime?: RealtimeConfig

  // F5: Worker
  workers?: WorkerConfig

  // F6: Cache + Devtools
  cache?: CacheConfig
  devtools?: DevtoolsConfig

  // Feature opt-out (default: all on)
  features?: {
    cache?: boolean
    devtools?: boolean
    worker?: boolean
    realtime?: boolean
  }
}
</code></pre>
<p>Every section is optional — pass an empty object to get a minimal broker. Features can be explicitly disabled to reduce bundle size at runtime.</p>

<h3 id="example">Example: full chain</h3>
<pre><code class="language-typescript">import { createGlueZero } from '@gluezero/gluezero'

const broker = createGlueZero({
  debug: true,
  canonicalModel: {
    schemas: [{
      id: 'weather.canonical',
      fields: {
        location: { type: 'string', required: true },
        forecast_date: { type: 'string', required: true },
        temperature_celsius: { type: 'number' },
      },
    }],
  },
  aliasRegistry: {
    global: { città: 'location', data: 'forecast_date' },
  },
  routes: [
    {
      id: 'weather-fetch',
      on: 'weather.requested',
      type: 'http',
      request: { method: 'GET', url: '/api/weather' },
      publishes: { success: 'weather.loaded', error: 'weather.failed' },
      policies: { timeout: { ms: 5000 }, retry: { attempts: 2 } },
    },
  ],
  cache: {
    scopeProvider: () => getCurrentUserId(),
  },
})

broker.publish('weather.requested', { città: 'Roma', data: '2026-05-10' })
</code></pre>

<h2 id="broker"><code>GlueZeroBroker</code> instance</h2>
<p>The returned broker exposes every method from every phase, all on one object. The wrapper architecture is transparent to the caller.</p>

<h3 id="pub-sub">Pub/sub (from <code>@gluezero/core</code>)</h3>
<ul>
<li><code>publish(topic, payload, options?)</code></li>
<li><code>subscribe(topic, handler, options?)</code></li>
<li><code>unsubscribe(subscriptionId)</code></li>
<li><code>registerPlugin(descriptor)</code></li>
<li><code>unregisterPlugin(id)</code></li>
</ul>

<h3 id="mapper">Mapper (from <code>@gluezero/mapper</code>)</h3>
<ul>
<li><code>registerCanonicalSchema(schema)</code></li>
<li><code>registerTransform(name, fn)</code></li>
<li><code>registerAlias(local, canonical, opts?)</code></li>
<li><code>getMappingInspector()</code></li>
</ul>

<h3 id="routing">Routing (from <code>@gluezero/routing</code>)</h3>
<ul>
<li><code>registerRoute(definition)</code></li>
<li><code>unregisterRoute(id)</code></li>
<li><code>getRouteInspector()</code></li>
</ul>

<h3 id="realtime">Realtime (from <code>@gluezero/gateway</code>)</h3>
<ul>
<li><code>connectRealtime()</code></li>
<li><code>disconnectRealtime()</code></li>
</ul>

<h3 id="worker-api">Worker (from <code>@gluezero/worker</code>)</h3>
<ul>
<li><code>registerWorker(descriptor)</code></li>
<li><code>unregisterWorker(id)</code></li>
</ul>

<h3 id="cache-api">Cache (from <code>@gluezero/cache</code>)</h3>
<ul>
<li><code>cache.invalidate(keyOrPattern)</code></li>
<li><code>cache.has(key)</code></li>
<li><code>cache.get(key)</code></li>
</ul>

<h3 id="devtools-api">Devtools (from <code>@gluezero/devtools</code>)</h3>
<ul>
<li><code>getEventInspector()</code></li>
<li><code>getMappingInspector()</code></li>
<li><code>getRouteInspector()</code></li>
<li><code>getMetrics()</code> / <code>getMetricsDelta(prev)</code></li>
<li><code>pauseTopic(topic)</code> / <code>resumeTopic(topic)</code> / <code>flushQueue(topic?)</code></li>
<li><code>enableDebug()</code> / <code>disableDebug()</code></li>
<li><code>getDebugSnapshot()</code></li>
</ul>

<h2 id="opt-out">Feature opt-out</h2>
<p>If you don&rsquo;t need a phase, disable it for runtime efficiency:</p>
<pre><code class="language-typescript">const broker = createGlueZero({
  features: {
    worker: false,    // skip worker registry init
    realtime: false,  // skip SSE/WS adapters
  },
})
</code></pre>
<p>Disabled features still expose their API surface (calls become no-ops) so consuming code doesn&rsquo;t need to branch on feature flags.</p>

<h2 id="see-also">See also</h2>
<div class="cards">
  <a class="card" href="../concepts/overview.html"><div class="card-title">Mental model</div><div class="card-desc">How the 6 phases compose at runtime.</div></a>
  <a class="card" href="core.html"><div class="card-title">Core API</div><div class="card-desc">Just the pub/sub primitives.</div></a>
</div>
'''
))


# --------------------------------------------------------------------------
PAGES.append((
    'api/core.html', '@gluezero/core', 'API reference',
    'createBroker BrokerEvent PluginDescriptor subscribe publish unsubscribe registerPlugin unregisterPlugin TopicTrie',
    '../',
    '''<h1><code>@gluezero/core</code></h1>
<p class="lead">The pub/sub broker. <code>createBroker(config)</code>, <code>publish</code>, <code>subscribe</code>, <code>registerPlugin</code>. Foundation of every other package.</p>

<h2 id="createBroker"><code>createBroker(config?)</code></h2>
<pre><code class="language-typescript">function createBroker(config?: BrokerConfig): Broker
</code></pre>
<p>Pure factory. No singleton. Tests rely on this.</p>

<h3 id="brokerconfig"><code>BrokerConfig</code></h3>
<pre><code class="language-typescript">interface BrokerConfig {
  debug?: boolean              // dev mode: deep-freeze, full payload capture
  taps?: readonly EventTap[]   // observability hooks (Inspector, Metrics, custom)
  topicSchemas?: TopicSchema[] // optional schema-level constraints
}
</code></pre>

<h2 id="publish"><code>broker.publish(topic, payload, options?)</code></h2>
<pre><code class="language-typescript">function publish&lt;T&gt;(
  topic: string,
  payload: T,
  options?: PublishOptions
): void

interface PublishOptions {
  deliveryMode?: 'async' | 'sync'      // default: 'async' (queueMicrotask)
  priority?: 'critical' | 'high' | 'normal' | 'low'   // default: 'normal'
  source?: { type: string; id?: string; name?: string }
  id?: string                          // override auto-generated nanoid
}
</code></pre>
<p>Async by default. Sync available for fail-fast topics like <code>system.error</code>.</p>

<h2 id="subscribe"><code>broker.subscribe(topic, handler, options?)</code></h2>
<pre><code class="language-typescript">function subscribe&lt;T&gt;(
  topic: string,                          // exact or wildcard pattern
  handler: (event: BrokerEvent&lt;T&gt;) =&gt; void | Promise&lt;void&gt;,
  options?: SubscribeOptions
): Subscription

interface SubscribeOptions {
  once?: boolean                          // auto-unsubscribe after first delivery
  signal?: AbortSignal                    // tie subscription to AbortSignal
  priority?: 'critical' | 'high' | 'normal' | 'low'
  ownerId?: string                        // tag for cascade cleanup (set automatically by ctx.broker)
}

interface Subscription {
  id: string
  topic: string
  active: boolean
  unsubscribe(): void
}
</code></pre>

<h2 id="brokerevent"><code>BrokerEvent&lt;T&gt;</code></h2>
<pre><code class="language-typescript">interface BrokerEvent&lt;T = unknown&gt; {
  readonly id: string                                        // nanoid (~22 chars)
  readonly topic: string
  readonly timestamp: number                                 // Date.now() at publish
  readonly source: { type: string; id?: string; name?: string }
  readonly payload: DeepReadonly&lt;T&gt;                          // frozen in dev
  readonly deliveryMode: 'async' | 'sync'
  readonly priority: 'critical' | 'high' | 'normal' | 'low'
  readonly metadata?: Record&lt;string, unknown&gt;                // mapping/origin/custom tags
}
</code></pre>

<h2 id="register-plugin"><code>broker.registerPlugin(descriptor)</code></h2>
<pre><code class="language-typescript">function registerPlugin(descriptor: PluginDescriptor): void

interface PluginDescriptor {
  id: string
  name: string
  version: string
  publishes?: TopicDeclaration[]
  subscribes?: TopicDeclaration[]
  handlers?: Record&lt;string, EventHandler&gt;

  // F2: Mapper extensions (declaration merging)
  inputMap?: InputMap
  outputMap?: OutputMap

  // F3: Routes auto-registered
  routes?: RouteDefinition[]

  // F5: Workers auto-registered
  workers?: WorkerDescriptor[]

  // Lifecycle hooks
  onMount?: (ctx: PluginContext) =&gt; void | Promise&lt;void&gt;
  onUnmount?: (ctx: PluginContext) =&gt; void | Promise&lt;void&gt;
  onDestroy?: (ctx: PluginContext) =&gt; void | Promise&lt;void&gt;
}

interface PluginContext {
  id: string
  broker: PluginScopedBroker         // proxy that auto-tags subscriptions
  signal: AbortSignal                // tied to plugin lifecycle
  logger: Logger                     // namespaced
}
</code></pre>

<h2 id="unregister-plugin"><code>broker.unregisterPlugin(id)</code></h2>
<pre><code class="language-typescript">function unregisterPlugin(id: string): void
</code></pre>
<p>Cascade cleanup (LIFE-02, decision <code>D-26</code>):</p>
<ol>
<li>Calls <code>onUnmount(ctx)</code></li>
<li>Removes every subscription tagged with this plugin&rsquo;s ownerId</li>
<li>Aborts <code>ctx.signal</code> (cancels in-flight HTTP via gateway)</li>
<li>Unregisters routes auto-registered by this plugin (F3+)</li>
<li>Disconnects realtime channels owned by this plugin (F4+)</li>
<li>Terminates worker tasks owned by this plugin (F5+)</li>
<li>Invalidates cache entries scoped to this plugin (F6+)</li>
<li>Calls <code>onDestroy(ctx)</code></li>
</ol>
<p>Even if any step throws, the cascade continues — partial failure is preferable to leak.</p>

<h2 id="other">Other methods</h2>
<ul>
<li><code>getDebugSnapshot()</code> — readonly snapshot of broker state (deep-cloned)</li>
<li><code>getTopicRegistry()</code> — list of all known topics + subscriber counts</li>
<li><code>getStats()</code> — counters (events published, subscriptions active, etc.)</li>
<li><code>setDebugMode(on: boolean)</code> — runtime toggle</li>
</ul>

<h2 id="errors">Errors</h2>
<p>All errors are <code>BrokerError</code> instances — sanitized shape:</p>
<pre><code class="language-typescript">interface BrokerError extends Error {
  code: string                  // e.g. 'broker.subscription.duplicate'
  category: 'config' | 'runtime' | 'validation' | 'network' | 'protocol' | 'auth'
  details?: Record&lt;string, unknown&gt;
  cause?: Error                 // ES2022 native
}

function isBrokerError(err: unknown): err is BrokerError
</code></pre>
'''
))


# --------------------------------------------------------------------------
PAGES.append((
    'api/mapper.html', '@gluezero/mapper', 'API reference',
    'createMapperBroker canonical schema alias transform inputMap outputMap MapperEngine MappingInspector',
    '../',
    '''<h1><code>@gluezero/mapper</code></h1>
<p class="lead">Canonical model + bidirectional mapper. <code>createMapperBroker(config)</code>, plus declaration merging that adds <code>inputMap</code> / <code>outputMap</code> to <code>PluginDescriptor</code>.</p>

<h2 id="createMapperBroker"><code>createMapperBroker(config)</code></h2>
<pre><code class="language-typescript">function createMapperBroker(config?: MapperBrokerConfig): MapperBroker

interface MapperBrokerConfig extends BrokerConfig {
  canonicalModel?: { schemas: CanonicalSchema[] }
  aliasRegistry?: {
    global?: Record&lt;string, string&gt;
    scoped?: Record&lt;string, Record&lt;string, string&gt;&gt;
  }
  transforms?: Record&lt;string, TransformFn&gt;
  validator?: ValidatorAdapter
}
</code></pre>

<h2 id="canonicalschema"><code>CanonicalSchema</code></h2>
<pre><code class="language-typescript">interface CanonicalSchema {
  id: CanonicalSchemaId           // branded type
  topic?: string                  // optional topic association
  fields: Record&lt;string, FieldDescriptor&gt;
  requires?: string[]             // dependent schema ids
  requiresRoute?: boolean         // strict: throw if topic has no route
}

interface FieldDescriptor {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'date'
  required?: boolean
  default?: unknown               // applied when source field is missing
  validate?: (v: unknown) =&gt; boolean | string  // custom validator
}
</code></pre>

<h2 id="inputmap-outputmap">InputMap / OutputMap</h2>
<p>Declared on <code>PluginDescriptor</code> via TypeScript declaration merging — automatic when you import <code>@gluezero/mapper</code>:</p>
<pre><code class="language-typescript">interface OutputMap {
  [localField: string]: {
    to: string                    // canonical field name
    transform?: string            // registered transform name
  } | string                      // shortcut: just the canonical name
}

interface InputMap {
  [localField: string]: string   // canonical → local field rename
}
</code></pre>

<h2 id="register-canonical"><code>broker.registerCanonicalSchema(schema)</code></h2>
<pre><code class="language-typescript">function registerCanonicalSchema(schema: CanonicalSchema): void
</code></pre>
<p>Idempotent. Throws on duplicate id with different shape (decision <code>D-36</code>).</p>

<h2 id="register-alias"><code>broker.registerAlias(local, canonical, opts?)</code></h2>
<pre><code class="language-typescript">function registerAlias(
  local: string,
  canonical: string,
  opts?: { scope?: 'global' | string; warn?: boolean }
): void
</code></pre>

<h2 id="register-transform"><code>broker.registerTransform(name, fn)</code></h2>
<pre><code class="language-typescript">function registerTransform(
  name: string,
  fn: (value: unknown, ctx: TransformContext) =&gt; unknown
): void

interface TransformContext {
  pluginId: string
  fieldName: string
  direction: 'input' | 'output'
  payload: unknown                // full payload (for derived transforms)
}
</code></pre>

<h2 id="validator"><code>ValidatorAdapter</code></h2>
<p>Pluggable validator (decision <code>D-38</code>). Default: Valibot. Adapters for Zod and Ajv can be implemented without modifying the engine.</p>
<pre><code class="language-typescript">interface ValidatorAdapter {
  validate&lt;T&gt;(schema: unknown, payload: unknown):
    | { ok: true; value: T }
    | { ok: false; issues: ValidationIssue[] }
}

interface ValidationIssue {
  path: string[]
  message: string
  expected?: string
  received?: unknown
}
</code></pre>

<h2 id="inspector"><code>broker.getMappingInspector()</code></h2>
<pre><code class="language-typescript">function getMappingInspector(): MappingInspector

interface MappingInspector {
  getSnapshot(opts?: { limit?: number; topic?: string }): MappingEntry[]
  clearErrors(): void
  lastErrors(): MappingError[]
}

interface MappingEntry {
  pluginId: string
  topic: string
  direction: 'input' | 'output'
  localPayload: unknown
  canonicalPayload: unknown
  transformsApplied: string[]
  errors: MappingError[]
  durationMs: number
}
</code></pre>

<h2 id="errors">Error codes</h2>
<table>
<thead><tr><th>Code</th><th>When</th></tr></thead>
<tbody>
<tr><td><code>mapping.cycle.detected</code></td><td>Cycle in inputMap/outputMap chain (compile-time)</td></tr>
<tr><td><code>mapping.transform.failed</code></td><td>Registered transform threw an error</td></tr>
<tr><td><code>mapping.field.missing</code></td><td>Required canonical field has no source value</td></tr>
<tr><td><code>mapping.canonical.validation.failed</code></td><td>Canonical payload failed schema validation</td></tr>
<tr><td><code>mapping.consumer.validation.failed</code></td><td>Consumer-side payload failed validation after inputMap</td></tr>
<tr><td><code>alias.global.conflict</code></td><td>Conflicting global aliases for same local name</td></tr>
<tr><td><code>alias.scoped.conflict</code></td><td>Conflicting scoped aliases within same plugin</td></tr>
</tbody>
</table>
'''
))


# --------------------------------------------------------------------------
PAGES.append((
    'api/routing.html', '@gluezero/routing', 'API reference',
    'createRouterBroker registerRoute RouteDefinition RouteResolver TopicTrie policy',
    '../',
    '''<h1><code>@gluezero/routing</code></h1>
<p class="lead">Declarative routing. <code>createRouterBroker(config)</code>, <code>registerRoute(definition)</code>. Six route types share the same resolver and policy chain.</p>

<h2 id="createRouterBroker"><code>createRouterBroker(config)</code></h2>
<pre><code class="language-typescript">function createRouterBroker(config?: RoutingBrokerConfig): RouterBroker

interface RoutingBrokerConfig extends MapperBrokerConfig {
  routes?: readonly RouteDefinition[]
  multipleRoutesPolicy?: 'first-match' | 'priority-ordered' | 'all'
  gateway?: GatewayConfig            // see @gluezero/gateway
}
</code></pre>

<h2 id="route-definition"><code>RouteDefinition</code></h2>
<p>Discriminated union by <code>type</code>:</p>
<pre><code class="language-typescript">type RouteDefinition =
  | LocalRoute
  | HttpRoute
  | RealtimeInboundRoute
  | WorkerRoute
  | CacheRoute
  | CompositeRoute

interface BaseRoute {
  id: string
  on: string                      // topic or wildcard pattern
  priority?: number               // higher wins under 'priority-ordered'
  policies?: RoutePolicies
}

interface HttpRoute extends BaseRoute {
  type: 'http'
  request: {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    url: string                   // can include $placeholder syntax
    queryMap?: Record&lt;string, string | TransformRef&gt;
    bodyMap?: Record&lt;string, string | TransformRef&gt;
    headerMap?: Record&lt;string, string&gt;
    headers?: Record&lt;string, string&gt;
  }
  publishes: { success: string; error: string }
  responseMap?: Record&lt;string, string&gt;   // server payload → canonical
}

interface WorkerRoute extends BaseRoute {
  type: 'worker'
  worker: { id: string; task: string }
  transferable?: string[]                 // JSON-path-like opt-in
  publishes: { success: string; error: string; progress?: string }
}

interface CacheRoute extends BaseRoute {
  type: 'cache'
  cache: {
    key: string | ((event: BrokerEvent) =&gt; string)
    ttl?: number                          // ms
    strategy: 'cache-first' | 'network-first' | 'cache-then-network'
    scoped?: boolean
    scope?: (event: BrokerEvent) =&gt; string | null
  }
  fallback: HttpRoute | WorkerRoute       // what runs on miss
  publishes: { success: string; error: string }
}

interface RealtimeInboundRoute extends BaseRoute {
  type: 'realtime-inbound'
  channel: { name: string; mode: 'sse' | 'websocket' | 'auto' }
  url: string
  publishes: { onMessage: string; onConnect?: string; onDisconnect?: string }
}

interface CompositeRoute extends BaseRoute {
  type: 'composite'
  steps: RouteStep[]
  publishes: { success: string; error: string }
}
</code></pre>

<h2 id="policies"><code>RoutePolicies</code></h2>
<pre><code class="language-typescript">interface RoutePolicies {
  timeout?: { ms: number }
  retry?: {
    attempts: number
    on?: ('5xx' | '4xx' | 'network' | 'all')[]   // default: ['5xx', 'network']
    respectRetryAfter?: boolean                  // honor Retry-After header
  }
  backoff?: { strategy: 'exponential'; baseMs?: number; maxMs?: number }
  dedupe?: { window: 'inflight' | 'time'; ms?: number; key?: (e: BrokerEvent) =&gt; string }
  auth?: AuthPolicy
  idempotency?: { auto?: boolean; key?: (e: BrokerEvent) =&gt; string }
  concurrency?: 'parallel' | 'serial' | 'latest-only' | { mode: 'queue-bounded'; max: number }
  circuitBreaker?: { failureThreshold: number; cooldownMs: number; halfOpenAttempts?: number }
  backpressure?: BackpressurePolicy
}
</code></pre>

<h2 id="register-route"><code>broker.registerRoute(definition)</code></h2>
<pre><code class="language-typescript">function registerRoute(definition: RouteDefinition): void
</code></pre>
<p>Validates schema (Valibot) and pre-compiles into the dispatch table. Duplicate id throws <code>route.id.duplicate</code>.</p>

<h2 id="unregister-route"><code>broker.unregisterRoute(id)</code></h2>
<pre><code class="language-typescript">function unregisterRoute(id: string): void
</code></pre>

<h2 id="inspector"><code>broker.getRouteInspector()</code></h2>
<pre><code class="language-typescript">interface RouteInspector {
  getSnapshot(opts?: { limit?: number; routeId?: string }): RouteEntry[]
}

interface RouteEntry {
  routeId: string
  topic: string
  eventId: string
  resolvedAt: number
  strategiesExecuted: { name: string; durationMs: number; outcome: 'pass' | 'retry' | 'fail' }[]
  outcome: 'success' | 'error' | 'cancelled'
  durationMs: number
}
</code></pre>
'''
))


# --------------------------------------------------------------------------
PAGES.append((
    'api/gateway.html', '@gluezero/gateway', 'API reference',
    'createRealtimeBroker HttpGateway SseAdapter WebSocketAdapter AuthStrategy RetryStrategy strategies',
    '../',
    '''<h1><code>@gluezero/gateway</code></h1>
<p class="lead">HTTP gateway and SSE/WebSocket realtime adapters. Two sub-modules: <code>@gluezero/gateway/http</code> and <code>@gluezero/gateway/sse-ws</code>.</p>

<h2 id="createRealtimeBroker"><code>createRealtimeBroker(config)</code></h2>
<pre><code class="language-typescript">function createRealtimeBroker(config?: RealtimeBrokerConfig): RealtimeBroker

interface RealtimeBrokerConfig extends RoutingBrokerConfig {
  realtime?: {
    adapter?: 'sse' | 'websocket' | 'auto'        // default: 'auto'
    fallbackThreshold?: number                    // SSE failures before WS switch
    cycleCap?: number                             // max reconnect cycles
    visibilityAware?: boolean                     // pause when tab hidden, default: true
    pingIntervalMs?: number                       // WS app-level ping, default: 30000
    staleTimeoutMs?: number                       // WS pong timeout, default: 60000
  }
}
</code></pre>

<h2 id="connect"><code>broker.connectRealtime()</code> / <code>disconnectRealtime()</code></h2>
<pre><code class="language-typescript">function connectRealtime(): void
function disconnectRealtime(reason?: string): void
</code></pre>
<p>Triggers connection of all <code>realtime-inbound</code> routes. Disconnect aborts all in-flight EventSource/WebSocket instances and prevents auto-reconnect.</p>

<h2 id="auth-policy"><code>AuthPolicy</code></h2>
<pre><code class="language-typescript">interface AuthPolicy {
  scheme: 'bearer' | 'basic' | 'cookie' | 'custom'
  getToken?: () =&gt; string | Promise&lt;string&gt;
  refresh?: () =&gt; Promise&lt;string&gt;                 // single-flight refresh on 401
  customHeaders?: () =&gt; Record&lt;string, string&gt;
}
</code></pre>
<p>Single-flight refresh: if multiple requests hit 401 simultaneously, only one <code>refresh()</code> call fires; others queue and retry with the new token (decision <code>D-72</code>).</p>

<h2 id="backpressure"><code>BackpressurePolicy</code></h2>
<pre><code class="language-typescript">type BackpressurePolicy =
  | { mode: 'drop-oldest'; max: number }
  | { mode: 'drop-newest'; max: number }
  | { mode: 'reject'; max: number }
  | { mode: 'queue-bounded'; max: number }
  | { mode: 'sliding-window'; max: number }
  | { mode: 'critical-bypass'; max: number; bypass: 'critical' }
</code></pre>
<p>Critical-priority events bypass backpressure caps when <code>mode: 'critical-bypass'</code> (decision <code>D-75</code>, used for <code>system.error</code> etc.).</p>

<h2 id="frame"><code>RealtimeFrame</code></h2>
<pre><code class="language-typescript">interface RealtimeFrame {
  topic: string                       // server-decided topic
  data: unknown                       // payload (will be canonical-validated)
  id?: string                         // for Last-Event-ID resume on SSE
}
</code></pre>

<h2 id="sub-modules">Sub-modules</h2>

<h3 id="http-module"><code>@gluezero/gateway/http</code></h3>
<p>Re-exports the strategies for advanced use cases (custom route handler, custom adapter):</p>
<ul>
<li><code>createTimeoutStrategy(config)</code></li>
<li><code>createRetryStrategy(config)</code></li>
<li><code>createBackoffStrategy(config)</code></li>
<li><code>createDedupeStrategy(config)</code></li>
<li><code>createAuthStrategy(config)</code></li>
<li><code>createIdempotencyStrategy(config)</code></li>
<li><code>createBackpressureStrategy(config)</code></li>
<li><code>createCircuitBreakerStrategy(config)</code></li>
</ul>
<p>Each is a stateful object with <code>execute(request, next)</code> middleware signature.</p>

<h3 id="sse-ws-module"><code>@gluezero/gateway/sse-ws</code></h3>
<p>Re-exports the realtime building blocks for advanced use cases:</p>
<ul>
<li><code>SseAdapter</code> class</li>
<li><code>WebSocketAdapter</code> class</li>
<li><code>RealtimeChannelManager</code> class</li>
<li><code>createReconnectStrategy(config)</code></li>
<li><code>createVisibilityDetector(config)</code></li>
<li><code>parseFrame(text)</code> / <code>serializeFrame(frame)</code></li>
</ul>
'''
))


# --------------------------------------------------------------------------
PAGES.append((
    'api/worker.html', '@gluezero/worker', 'API reference',
    'createWorkerBroker registerWorker WorkerDescriptor expose Comlink WorkerPool WorkerBridge',
    '../',
    '''<h1><code>@gluezero/worker</code></h1>
<p class="lead">Web Worker runtime. Bounded pool, hybrid cancellation, transferable opt-in, dev-mode serialization checks. Built on Comlink under the hood.</p>

<h2 id="createWorkerBroker"><code>createWorkerBroker(config)</code></h2>
<pre><code class="language-typescript">function createWorkerBroker(config?: WorkerBrokerConfig): WorkerBroker

interface WorkerBrokerConfig extends RealtimeBrokerConfig {
  workers?: {
    assertSerializable?: 'always' | 'dev' | 'off'   // default: 'dev'
    progressThrottleMs?: number                     // default: 100
    cancelGraceMs?: number                          // default: 2000
    poolSize?: number                               // default: min(hwc, 4) cap 8
  }
}
</code></pre>

<h2 id="worker-descriptor"><code>WorkerDescriptor</code></h2>
<pre><code class="language-typescript">interface WorkerDescriptor {
  id: string
  factory: () =&gt; Worker                  // lazy: called on first dispatch
  tasks: readonly string[]               // declared task names (fail-fast on unknown)
  poolSize?: number                      // override per worker
  type?: 'module' | 'classic'            // default: 'module' (ESM)
}
</code></pre>

<h2 id="register-worker"><code>broker.registerWorker(descriptor)</code></h2>
<pre><code class="language-typescript">function registerWorker(descriptor: WorkerDescriptor): void
</code></pre>
<p>Validates the descriptor. The <code>factory()</code> is NOT called until the first dispatch — registration is cheap.</p>

<h2 id="expose"><code>expose(api)</code> — inside the worker source</h2>
<pre><code class="language-typescript">// Inside csv-worker.ts
import { expose } from '@gluezero/worker'

expose({
  parseCSV: async (
    fileBuffer: ArrayBuffer,
    signal: AbortSignal,                 // proxied via Comlink
    onProgress: (p: ProgressPayload) =&gt; void
  ) =&gt; {
    // ...
    return parsedRows
  },
  validateCSV: async (...) =&gt; { /* ... */ },
})

interface ProgressPayload {
  value: number          // 0..1 normalized
  message?: string
  partialResult?: unknown
}
</code></pre>

<h2 id="task-state"><code>TaskState</code></h2>
<pre><code class="language-typescript">type TaskState =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timed-out'
</code></pre>

<h2 id="task-tracker"><code>broker.getTaskTracker()</code></h2>
<pre><code class="language-typescript">interface TaskTracker {
  list(): TaskInfo[]
  get(id: string): TaskInfo | undefined
}

interface TaskInfo {
  id: string
  workerId: string
  taskName: string
  state: TaskState
  startedAt: number
  completedAt?: number
  durationMs?: number
  correlationId: string                 // matches BrokerEvent.id
  topic: string
}
</code></pre>

<h2 id="errors">Error codes</h2>
<table>
<thead><tr><th>Code</th><th>When</th></tr></thead>
<tbody>
<tr><td><code>worker.unknown</code></td><td>Dispatch to unregistered worker id</td></tr>
<tr><td><code>worker.task.unknown</code></td><td>Task name not in <code>tasks</code> array (fail-fast)</td></tr>
<tr><td><code>worker.timeout</code></td><td>Timeout policy fired</td></tr>
<tr><td><code>worker.cancelled</code></td><td>AbortSignal cancellation</td></tr>
<tr><td><code>worker.serialization.failed</code></td><td>Payload not structuredClone-able (dev mode)</td></tr>
<tr><td><code>worker.pool.size.exceeded</code></td><td>poolSize > hard cap 8</td></tr>
</tbody>
</table>

<h2 id="utilities">Utilities</h2>
<ul>
<li><code>assertSerializable(value, opts?)</code> — throws if value can&rsquo;t cross postMessage boundary</li>
<li><code>extractTransferables(payload, jsonPaths)</code> — collect ArrayBuffer-like objects from payload</li>
<li><code>deriveTopic(sourceTopic, suffix)</code> — <code>weather.requested</code> + <code>completed</code> → <code>weather.completed</code></li>
</ul>
'''
))


# --------------------------------------------------------------------------
PAGES.append((
    'api/cache.html', '@gluezero/cache', 'API reference',
    'createCacheBroker CacheAdapter MemoryCacheAdapter strategies invalidate TTL scope',
    '../',
    '''<h1><code>@gluezero/cache</code></h1>
<p class="lead">In-memory LRU cache adapter with three strategies, scope hybrid, TTL. Pluggable adapter interface for IndexedDB, sessionStorage, etc.</p>

<h2 id="createCacheBroker"><code>createCacheBroker(config)</code></h2>
<pre><code class="language-typescript">function createCacheBroker(config?: CacheBrokerConfig): CacheBroker

interface CacheBrokerConfig extends WorkerBrokerConfig {
  cache?: {
    adapter?: CacheAdapter                  // default: new MemoryCacheAdapter()
    maxEntries?: number                     // default: 1000 for MemoryCacheAdapter
    scopeProvider?: () =&gt; string | null     // global default scope
  }
}
</code></pre>

<h2 id="adapter"><code>CacheAdapter</code> interface</h2>
<pre><code class="language-typescript">interface CacheAdapter {
  get(key: string): Promise&lt;CacheEntry | undefined&gt; | CacheEntry | undefined
  set(key: string, value: unknown, opts?: { ttl?: number; ownerId?: string }): Promise&lt;void&gt; | void
  has(key: string): Promise&lt;boolean&gt; | boolean
  delete(key: string): Promise&lt;void&gt; | void
  invalidate(pattern: string | RegExp | { prefix: string }): Promise&lt;number&gt; | number
  invalidateByOwner(ownerId: string): Promise&lt;number&gt; | number
  size(): Promise&lt;number&gt; | number
  clear(): Promise&lt;void&gt; | void
}

interface CacheEntry {
  value: unknown
  storedAt: number
  expiresAt?: number
  ownerId?: string
}
</code></pre>

<h2 id="memory-adapter"><code>MemoryCacheAdapter</code></h2>
<pre><code class="language-typescript">class MemoryCacheAdapter implements CacheAdapter {
  constructor(opts?: { maxEntries?: number })
  // LRU eviction by Map insertion order, TTL orthogonal
}
</code></pre>
<p>Default. <code>maxEntries: 1000</code>. Predictable memory footprint.</p>

<h2 id="invalidate"><code>broker.cache.invalidate(pattern)</code></h2>
<pre><code class="language-typescript">function invalidate(
  pattern: string | RegExp | { prefix: string }
): Promise&lt;number&gt;
</code></pre>
<p>Returns the number of entries invalidated.</p>

<h2 id="cache-handler"><code>createCacheHandlerF6(opts)</code> — advanced</h2>
<p>Re-exposed for users who want to plug a custom cache layer into a custom route handler. Most users don&rsquo;t need this — declare a <code>type: 'cache'</code> route instead.</p>

<h2 id="errors">Error codes</h2>
<table>
<thead><tr><th>Code</th><th>When</th></tr></thead>
<tbody>
<tr><td><code>system.cache.scope-missing</code></td><td>Scoped route, scopeProvider returned null/undefined (audit, non-throwing)</td></tr>
<tr><td><code>cache.adapter.error</code></td><td>Adapter threw (custom adapter only)</td></tr>
</tbody>
</table>
'''
))


# --------------------------------------------------------------------------
PAGES.append((
    'api/devtools.html', '@gluezero/devtools', 'API reference',
    'createDevtoolsBroker EventInspector RouteInspector MetricsCollector PauseController MultiplexTap',
    '../',
    '''<h1><code>@gluezero/devtools</code></h1>
<p class="lead">Inspector + MetricsCollector + PauseController. The observability layer that exposes the event flow for debugging and measurement.</p>

<h2 id="createDevtoolsBroker"><code>createDevtoolsBroker(config)</code></h2>
<pre><code class="language-typescript">function createDevtoolsBroker(config?: DevtoolsBrokerConfig): DevtoolsBroker

interface DevtoolsBrokerConfig extends CacheBrokerConfig {
  devtools?: {
    inspectorBufferSize?: number       // default: 500
    metricsCardinalityCap?: number     // default: 100 per metric
    metricsReservoirSize?: number      // default: 1024 samples per histogram
    pauseQueueMaxSize?: number         // default: 1000
  }
}
</code></pre>

<h2 id="event-inspector"><code>broker.getEventInspector()</code></h2>
<pre><code class="language-typescript">interface EventInspector {
  getSnapshot(opts?: { limit?: number; topic?: string }): EventInspectorEntry[]
  clear(): void
}

interface EventInspectorEntry {
  id: string
  topic: string
  timestamp: number
  source: { type: string; id?: string; name?: string }
  payload: unknown                                 // deep-cloned
  deliveryMode: 'async' | 'sync'
  priority: 'critical' | 'high' | 'normal' | 'low'
  pipelineSteps: PipelineStepRecord[]              // 14 steps for dev
  outcome: 'delivered' | 'failed' | 'dedup-skipped' | 'paused-queued'
  subscribersReached: number
  errors?: BrokerError[]
}
</code></pre>

<h2 id="metrics"><code>broker.getMetrics()</code> / <code>getMetricsDelta(prev)</code></h2>
<pre><code class="language-typescript">interface MetricsSnapshot {
  counters: Record&lt;string, number&gt;
  gauges: Record&lt;string, number&gt;
  histograms: Record&lt;string, HistogramSummary&gt;
  capturedAt: number
}

interface HistogramSummary {
  count: number
  sum: number
  p50: number
  p90: number
  p99: number
  // optional p25 / p75 also present
}

function getMetrics(): MetricsSnapshot
function getMetricsDelta(prev: MetricsSnapshot): MetricsSnapshot
</code></pre>

<h2 id="pause"><code>broker.pauseTopic / resumeTopic / flushQueue</code></h2>
<pre><code class="language-typescript">function pauseTopic(topic: string): void                 // queue events instead of delivering
function resumeTopic(topic: string): void                // flush queue to subscribers
function flushQueue(topic?: string): { droppedCount: number; droppedEventIds: string[] }
</code></pre>
<p>Critical-priority events bypass pause (still delivered).</p>

<h2 id="taps"><code>EventTap</code> + <code>MultiplexTap</code></h2>
<pre><code class="language-typescript">interface EventTap {
  onEventPublished?(event: BrokerEvent): void
  onEventDelivered?(event: BrokerEvent, subscribersReached: number): void
  onEventFailed?(event: BrokerEvent, error: BrokerError): void
  onPipelineStep?(eventId: string, step: PipelineStepRecord): void
  onMetricsTick?(metrics: MetricsSnapshot): void
  onRouteResolved?(routeId: string, eventId: string, durationMs: number): void
}

function createMultiplexTap(taps: EventTap[]): EventTap   // chain with error isolation
</code></pre>
<p>Each tap runs in its own try/catch — a failing tap doesn&rsquo;t affect the others (decision <code>D-159</code>).</p>

<h2 id="debug-mode"><code>enableDebug / disableDebug</code></h2>
<pre><code class="language-typescript">function enableDebug(): void
function disableDebug(): void
function getDebugSnapshot(): DebugSnapshot

interface DebugSnapshot {
  recentEvents: EventInspectorEntry[]
  recentRoutes: RouteEntry[]
  currentMetrics: MetricsSnapshot
  pausedTopics: string[]
  enabled: boolean
}
</code></pre>
'''
))
