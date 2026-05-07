# Content for Concepts: Overview + Broker + Canonical model
PAGES = []

# --------------------------------------------------------------------------
# concepts/overview.html
# --------------------------------------------------------------------------
PAGES.append((
    'concepts/overview.html', 'Overview', 'Concepts',
    'mental model events routes canonical lifecycle pipeline architecture',
    '../',
    '''<h1>Mental model</h1>
<p class="lead">GlueZero is built around a single observable event flow. Modules don&rsquo;t call each other; they publish topics. Routes decide what happens. The pipeline ensures every event is mapped, validated, dispatched, observed.</p>

<h2 id="layers">The four layers</h2>
<p>Conceptually, every event in GlueZero crosses four logical layers:</p>
<table>
<thead><tr><th>Layer</th><th>Responsibility</th><th>Owner</th></tr></thead>
<tbody>
<tr><td><strong>Publish</strong></td><td>Emit a topic with a local payload</td><td><code>@gluezero/core</code></td></tr>
<tr><td><strong>Translate</strong></td><td>Map local fields → canonical → consumer fields</td><td><code>@gluezero/mapper</code></td></tr>
<tr><td><strong>Route</strong></td><td>Resolve where the event goes (local, HTTP, worker, cache, realtime, composite)</td><td><code>@gluezero/routing</code> + <code>@gluezero/gateway</code></td></tr>
<tr><td><strong>Observe</strong></td><td>Tap into the lifecycle for debug, metrics, inspection</td><td><code>@gluezero/devtools</code></td></tr>
</tbody>
</table>

<h2 id="topics">Topics, not direct calls</h2>
<p>The first principle: components don&rsquo;t hold references to each other. They emit semantic topics like <code>weather.requested</code>, <code>customer.list.requested</code>, <code>file.parse.completed</code>. Anyone who subscribes to that topic receives the event.</p>
<pre><code class="language-typescript">// Component A doesn't know about Component B
broker.publish('customer.selected', { id: 'C-001' })

// Component B doesn't know about Component A
broker.subscribe('customer.selected', (event) => {
  loadCustomerDetails(event.payload.id)
})
</code></pre>
<p>Topics use <strong>dot-segmented naming</strong> (<code>scope.entity.action</code>) and support wildcards: <code>weather.*</code> matches <code>weather.alert.requested</code> and <code>weather.loaded</code>.</p>

<h2 id="events">Events have structure</h2>
<p>Every published payload is wrapped in a <code>BrokerEvent</code> with metadata:</p>
<pre><code class="language-typescript">{
  id: 'evt_xKp9N3...',           // unique nanoid
  topic: 'customer.selected',
  timestamp: 1714834567890,
  source: { type: 'plugin', id: 'customer-table' },
  payload: { id: 'C-001' },
  deliveryMode: 'async',         // async (default) | sync
  priority: 'normal',            // 'critical' | 'high' | 'normal' | 'low'
}
</code></pre>
<p>The metadata travels with the event end-to-end and is what makes the system observable. The Inspector (Phase 6) records these objects in a ring buffer for replay.</p>

<h2 id="canonical">Canonical model: shared vocabulary</h2>
<p>When plugin A emits <code>{ città: 'Roma' }</code> and plugin B expects <code>{ location: 'Roma' }</code>, the traditional fix is a custom adapter. With GlueZero, both plugins map their local fields to a canonical name <code>location</code>, and the mapper handles the bidirectional translation.</p>
<p>The canonical schema is the contract. Aliases (automatic) and explicit <code>inputMap</code>/<code>outputMap</code> per plugin are the implementation. Add a third plugin C with its own naming, and you don&rsquo;t need to write three new adapters — you map C once to the canonical and it speaks with everyone.</p>
<p>See <a href="canonical-model.html">Canonical model</a> for the full picture.</p>

<h2 id="routes">Routes: declarative dispatch</h2>
<p>A route says &ldquo;when topic X is published, do Y, then publish Z&rdquo;. There are six route types:</p>
<table>
<thead><tr><th>Type</th><th>What it does</th></tr></thead>
<tbody>
<tr><td><code>local</code></td><td>Just deliver to local subscribers (the implicit default)</td></tr>
<tr><td><code>http</code></td><td>Make a fetch call, publish success/error with the response</td></tr>
<tr><td><code>realtime-inbound</code></td><td>Subscribe to an SSE/WebSocket channel and re-publish frames as topics</td></tr>
<tr><td><code>worker</code></td><td>Dispatch the payload to a Web Worker, publish progress and completion</td></tr>
<tr><td><code>cache</code></td><td>Read/write through a cache adapter with one of three strategies</td></tr>
<tr><td><code>composite</code></td><td>Chain multiple route types in a single declarative pipeline</td></tr>
</tbody>
</table>
<p>Routes attach <strong>policies</strong> (timeout, retry, backoff, dedupe, auth, idempotency, URL allowlist, concurrency, circuit breaker, backpressure). Components don&rsquo;t care about any of this.</p>

<h2 id="lifecycle">Lifecycle: cascade unregister</h2>
<p>One of the most expensive bugs in event-driven UIs is the orphan subscription: a component unmounts but its subscriber is still alive, leaking memory and firing handlers that touch dead state.</p>
<p>GlueZero enforces <strong>cascade cleanup</strong> on <code>unregisterPlugin</code>: every subscription, route, in-flight HTTP request, realtime connection, worker task, cache entry tagged with the plugin&rsquo;s ownerId is automatically released. This is the <code>LIFE-02</code> contract (decision <code>D-26</code>), extended through all six phases.</p>
<pre><code class="language-typescript">broker.registerPlugin({
  id: 'my-plugin',
  // ... declares routes, subscriptions, etc.
})

// later — single call cleans up EVERYTHING
broker.unregisterPlugin('my-plugin')
</code></pre>

<h2 id="pipeline">The §28 pipeline</h2>
<p>Every published event traverses a 14-step pipeline (defined in PRD §28). The pipeline is built incrementally across the 6 phases — each phase adds steps without changing earlier ones (the &ldquo;D-83 strict carryover&rdquo; rule).</p>
<ol>
<li>Event received from publisher</li>
<li>Metadata enrichment (id, timestamp, source)</li>
<li>Source-side validation (Phase 2)</li>
<li>Output map (local → canonical, Phase 2)</li>
<li>Canonical validation (Phase 2)</li>
<li>Dedupe check (Phase 1+3)</li>
<li>Route resolution (Phase 3)</li>
<li>Strategy chain: timeout, retry, auth, etc. (Phase 3)</li>
<li>Dispatch to handler: local / HTTP / worker / cache (Phase 3+5+6)</li>
<li>Outcome events: <code>X.loaded</code> / <code>X.failed</code> / <code>X.progress</code></li>
<li>Input map (canonical → consumer local, Phase 2)</li>
<li>Consumer validation (Phase 2)</li>
<li>Subscriber delivery</li>
<li><code>event.observed</code> lifecycle event (Phase 6: Inspector + Metrics taps fire here)</li>
</ol>
<p>You don&rsquo;t implement these steps. You configure them through <code>BrokerConfig</code>, plugins, and routes.</p>

<h2 id="composition">Composition wrapper architecture</h2>
<p>GlueZero is a stack of composition wrappers (decision <code>D-49</code>). Each phase wraps the previous one without modifying it:</p>
<pre><code>Broker (F1)
  └─ wrapped by MapperBroker (F2)
       └─ wrapped by RouterBroker (F3)
            └─ wrapped by RealtimeBroker (F4)
                 └─ wrapped by WorkerBroker (F5)
                      └─ wrapped by CacheBroker (F6)
                           └─ wrapped by DevtoolsBroker (F6)
                                └─ exposed via createGlueZero()
</code></pre>
<p>Each wrapper intercepts <code>publish</code> for the topics it cares about; everything else passes through to the inner broker untouched. This is why you can use only <code>@gluezero/core</code> if you only need pub/sub, or <code>@gluezero/core + @gluezero/mapper</code> if you don&rsquo;t need routing yet.</p>

<h2 id="next">Where to next</h2>
<div class="cards">
  <a class="card" href="broker.html">
    <div class="card-title">Broker</div>
    <div class="card-desc">Pub/sub primitives, topic patterns, plugin lifecycle.</div>
  </a>
  <a class="card" href="canonical-model.html">
    <div class="card-title">Canonical model</div>
    <div class="card-desc">How alias resolution and explicit maps work together.</div>
  </a>
  <a class="card" href="routing.html">
    <div class="card-title">Routing</div>
    <div class="card-desc">The six route types and the policy chain.</div>
  </a>
</div>
'''
))


# --------------------------------------------------------------------------
# concepts/broker.html
# --------------------------------------------------------------------------
PAGES.append((
    'concepts/broker.html', 'Broker', 'Concepts',
    'broker pub-sub topics wildcards subscribe publish handler unsubscribe lifecycle plugin cascade',
    '../',
    '''<h1>Broker</h1>
<p class="lead">The broker is the in-page pub/sub runtime. Every topic, every subscription, every event flows through it. <code>@gluezero/core</code> is the only required package.</p>

<h2 id="create">Creating a broker</h2>
<pre><code class="language-typescript">import { createBroker } from '@gluezero/core'

const broker = createBroker({
  debug: true,
  // optional: deep-freeze runtime check on payloads in dev
  // optional: tap callbacks for instrumentation
})
</code></pre>
<p><code>createBroker</code> is a <strong>pure function</strong> — calling it twice returns two independent brokers (decision <code>D-30</code>, no singleton). This matters for tests and for multi-tenant setups where you want isolation.</p>

<h2 id="topics">Topics</h2>
<p>Topics are dot-segmented strings. Convention: <code>scope.entity.action</code>.</p>
<table>
<thead><tr><th>Pattern</th><th>Matches</th></tr></thead>
<tbody>
<tr><td><code>weather.loaded</code></td><td>only the exact topic <code>weather.loaded</code></td></tr>
<tr><td><code>weather.*</code></td><td>any single segment after <code>weather.</code> — <code>weather.loaded</code>, <code>weather.failed</code></td></tr>
<tr><td><code>weather.*.requested</code></td><td><code>weather.alert.requested</code>, <code>weather.daily.requested</code></td></tr>
<tr><td><code>*.failed</code></td><td>every <code>X.failed</code> topic</td></tr>
</tbody>
</table>
<div class="callout">
<span class="callout-label">Lookup is O(segments)</span>The matching engine is a segmented trie (decision <code>D-08</code>). Lookup cost is proportional to the number of segments in the published topic, independent of the total number of subscribers. Scale to thousands of wildcard subscribers without degradation.
</div>

<h2 id="subscribe">Subscribing</h2>
<pre><code class="language-typescript">const sub = broker.subscribe('weather.loaded', (event) => {
  console.log(event.payload)
})

// later: cleanup
sub.unsubscribe()
</code></pre>
<p>The handler receives a full <code>BrokerEvent</code>, not just the payload — you have access to <code>event.id</code>, <code>event.timestamp</code>, <code>event.source</code>, and other metadata.</p>

<h3 id="subscribe-options">Subscribe options</h3>
<pre><code class="language-typescript">broker.subscribe('weather.loaded', handler, {
  once: true,             // unsubscribe automatically after first delivery
  signal: ctx.signal,     // tie to AbortSignal — cancellable cleanup
  priority: 'high',       // delivery order vs other subscribers
})
</code></pre>

<h2 id="publish">Publishing</h2>
<pre><code class="language-typescript">broker.publish('weather.loaded', { city: 'Roma', temp_c: 22 })
</code></pre>
<p>By default delivery is <strong>async via <code>queueMicrotask</code></strong> (decision <code>D-01</code>). This guarantees:</p>
<ul>
<li><strong>FIFO ordering</strong> — events are delivered in publish order</li>
<li><strong>No re-entrancy</strong> — a handler that publishes the same topic doesn&rsquo;t cause a stack overflow</li>
<li><strong>Microtask isolation</strong> — publisher and subscriber run on separate microtasks</li>
</ul>
<p>For specific cases (e.g. <code>system.error</code> needs sync fail-fast), opt in to sync delivery:</p>
<pre><code class="language-typescript">broker.publish('system.error', err, { deliveryMode: 'sync' })
</code></pre>

<h3 id="publish-options">Publish options</h3>
<pre><code class="language-typescript">broker.publish(topic, payload, {
  deliveryMode: 'async',   // 'async' (default) | 'sync'
  priority: 'normal',      // 'critical' | 'high' | 'normal' | 'low'
  source: { type: 'plugin', id: 'my-plugin' },
})
</code></pre>

<h2 id="freeze">Payload immutability</h2>
<p>In dev mode (<code>debug: true</code>), payloads are <strong>deep-frozen</strong> before delivery (decisions <code>D-04</code>, <code>D-05</code>). A subscriber that tries to mutate the payload throws in dev and silently no-ops in production. This protects against the &ldquo;subscriber A mutates, subscriber B sees the mutation&rdquo; class of bugs.</p>
<pre><code class="language-typescript">broker.subscribe('weather.loaded', (event) => {
  event.payload.temp_c = 999  // throws in dev, no-op in prod
})
</code></pre>
<p>The freeze is recursive on plain objects and arrays. <code>Date</code>, <code>Map</code>, <code>Set</code> are freezable but their internal state is not — treat them as immutable by convention.</p>

<h2 id="plugins">Plugins</h2>
<p>A plugin is a unit of behavior that the broker manages: it has an id, lifecycle hooks, declared topics, and (in later phases) maps and routes.</p>
<pre><code class="language-typescript">broker.registerPlugin({
  id: 'weather-form',
  name: 'Weather form',
  version: '1.0.0',
  publishes: [{ topic: 'weather.requested' }],
  subscribes: [{ topic: 'weather.loaded' }],
  handlers: {
    'weather.loaded': (event) => render(event.payload),
  },
  onMount: (ctx) => { console.log('mounted', ctx.id) },
  onUnmount: (ctx) => { console.log('unmounted', ctx.id) },
  onDestroy: (ctx) => { /* final cleanup */ },
})
</code></pre>

<h3 id="ctx">PluginContext</h3>
<p>Hooks receive a <code>ctx</code> object with:</p>
<ul>
<li><code>ctx.id</code> — the plugin id</li>
<li><code>ctx.broker</code> — a scoped broker proxy that auto-tags subscriptions with the plugin id (so cleanup works)</li>
<li><code>ctx.signal</code> — an <code>AbortSignal</code> tied to the plugin lifecycle</li>
<li><code>ctx.logger</code> — namespaced logger (visible in Inspector)</li>
</ul>
<p>Use <code>ctx.broker.subscribe(...)</code> instead of the global <code>broker.subscribe(...)</code> when subscribing inside <code>onMount</code> — that way the cascade unregister picks up the subscription automatically.</p>

<h2 id="cascade">Cascade unregister (LIFE-02)</h2>
<p>The single most important guarantee of the broker: when you call <code>broker.unregisterPlugin('weather-form')</code>, every subscription created through this plugin&rsquo;s scope is automatically removed. No leaks, no orphan handlers (decision <code>D-26</code>).</p>
<pre><code class="language-typescript">broker.registerPlugin({
  id: 'my-plugin',
  onMount: (ctx) => {
    ctx.broker.subscribe('a.topic', handlerA)
    ctx.broker.subscribe('b.topic', handlerB)
  },
})

// One call removes both subscriptions
broker.unregisterPlugin('my-plugin')
</code></pre>
<p>The cascade is extended in every later phase: <code>@gluezero/routing</code> removes routes registered by the plugin; <code>@gluezero/gateway</code> aborts in-flight HTTP requests; <code>@gluezero/worker</code> terminates worker tasks; <code>@gluezero/cache</code> invalidates cached entries scoped to the plugin. All of this happens through a single <code>unregisterPlugin</code> call.</p>

<h2 id="snapshot">Debug snapshot</h2>
<p>At any time, you can ask the broker for a snapshot of its current state — useful in tests, in the Inspector, or for diagnostics:</p>
<pre><code class="language-typescript">const snapshot = broker.getDebugSnapshot()
// {
//   recentEvents: [...],
//   recentRoutes: [...],
//   currentMetrics: {...},
//   pausedTopics: [...],
//   enabled: true,
// }
</code></pre>
<p>The snapshot is deep-cloned via <code>structuredClone</code> (decision <code>D-162</code>) so reading it doesn&rsquo;t accidentally pin live state.</p>

<h2 id="next">Where to next</h2>
<div class="cards">
  <a class="card" href="canonical-model.html">
    <div class="card-title">Canonical model</div>
    <div class="card-desc">Make plugins with different naming conventions interoperate without pairwise adapters.</div>
  </a>
  <a class="card" href="../api/core.html">
    <div class="card-title">Core API reference</div>
    <div class="card-desc">Full type signatures for createBroker, BrokerEvent, PluginDescriptor.</div>
  </a>
</div>
'''
))


# --------------------------------------------------------------------------
# concepts/canonical-model.html
# --------------------------------------------------------------------------
PAGES.append((
    'concepts/canonical-model.html', 'Canonical model', 'Concepts',
    'canonical model alias mapper plugin field translation input output map transform validation',
    '../',
    '''<h1>Canonical model</h1>
<p class="lead">A shared vocabulary that lets plugins with different field names interoperate without pairwise adapters. Each plugin maps once to canonical names; the mapper translates bidirectionally for everyone else.</p>

<h2 id="problem">The problem it solves</h2>
<p>Two plugins emit data about the same concept but use different keys:</p>
<pre><code class="language-typescript">// Plugin A (italian source)
{ città: 'Roma', data: '30/04/2026' }

// Plugin B (english consumer expects)
{ location: 'Roma', forecast_date: '2026-04-30' }
</code></pre>
<p>The traditional fix: write a custom adapter A→B. Then plugin C arrives, write A→C, B→C. Number of adapters grows quadratically.</p>
<p>The GlueZero fix: define a canonical schema with canonical names. Each plugin declares how its local fields map to the canonical. Translation between any two plugins is handled by the mapper.</p>

<h2 id="schema">Canonical schema</h2>
<pre><code class="language-typescript">const broker = createGlueZero({
  canonicalModel: {
    schemas: [{
      id: 'weather.canonical',
      fields: {
        location: { type: 'string', required: true },
        forecast_date: { type: 'string', required: true },
        temperature_celsius: { type: 'number' },
        weather_condition: { type: 'string' },
      },
    }],
  },
})
</code></pre>
<p>The schema is the contract. Field types are validated by <code>@gluezero/mapper</code> using <a href="https://valibot.dev" target="_blank" rel="noopener">Valibot</a> by default (you can plug in Zod or Ajv via <code>ValidatorAdapter</code>).</p>

<h2 id="aliases">Automatic aliases</h2>
<p>If most plugins follow predictable variations of a canonical name, declare them once globally:</p>
<pre><code class="language-typescript">aliasRegistry: {
  global: {
    città: 'location',
    city: 'location',
    place: 'location',
    data: 'forecast_date',
    date: 'forecast_date',
    temp: 'temperature_celsius',
  },
}
</code></pre>
<p>Now any plugin that emits <code>{ città: 'Roma' }</code> automatically produces <code>{ location: 'Roma' }</code> on the canonical side, no per-plugin map needed.</p>

<h2 id="explicit">Explicit maps (per plugin)</h2>
<p>When a plugin needs custom logic — transforms, computed fields, defaults — use explicit <code>outputMap</code> and <code>inputMap</code>.</p>

<h3 id="outputmap">outputMap (publisher → canonical)</h3>
<pre><code class="language-typescript">broker.registerPlugin({
  id: 'italian-form',
  publishes: [{ topic: 'weather.requested' }],
  outputMap: {
    città: { to: 'location', transform: 'normalizeLocationName' },
    data: { to: 'forecast_date', transform: 'parseItalianDate' },
  },
})

// also declare the named transforms
broker.registerTransform('parseItalianDate', (value) =&gt; {
  // '30/04/2026' → '2026-04-30'
  const [d, m, y] = value.split('/')
  return `${y}-${m}-${d}`
})
broker.registerTransform('normalizeLocationName', (s) =&gt; s.trim().toLowerCase())
</code></pre>

<h3 id="inputmap">inputMap (canonical → consumer)</h3>
<pre><code class="language-typescript">broker.registerPlugin({
  id: 'english-widget',
  subscribes: [{ topic: 'weather.loaded' }],
  inputMap: {
    location: 'location',
    'forecast-date': 'forecast_date',
    temperature: 'temperature_celsius',
    status: 'weather_condition',
  },
  handlers: {
    'weather.loaded': (event) =&gt; {
      // event.payload uses consumer-local keys: location, forecast-date, temperature, status
    },
  },
})
</code></pre>

<h2 id="resolution">Resolution order</h2>
<p>When the mapper sees a local field, it resolves the canonical target in this order (decision <code>D-40</code>):</p>
<ol>
<li><strong>Explicit plugin map</strong> (<code>inputMap</code> / <code>outputMap</code>) — always wins</li>
<li><strong>Plugin-scoped aliases</strong> (declared per plugin in <code>aliasRegistry.scoped</code>)</li>
<li><strong>Global aliases</strong> (<code>aliasRegistry.global</code>)</li>
<li><strong>Name match</strong> — if the local name equals a canonical name, use it as-is</li>
</ol>
<p>This means an explicit <code>outputMap: { città: { to: 'location' } }</code> always overrides a global alias for <code>città</code>. The order is deterministic and documented (PRD §39 #1, closed in F2).</p>

<h2 id="missing">Missing fields and transform failures</h2>
<p>Two policies handle edge cases (decisions <code>D-43</code>, <code>D-44</code>):</p>
<table>
<thead><tr><th>Situation</th><th>Default</th><th>Override</th></tr></thead>
<tbody>
<tr><td>Required canonical field is missing</td><td>throw <code>BrokerError mapping.field.missing</code></td><td><code>field: { required: false, default: 0 }</code></td></tr>
<tr><td>Transform throws an exception</td><td>block: throw <code>mapping.transform.failed</code></td><td><code>onFailure: 'skip'</code> or <code>'fallback'</code> with default value</td></tr>
</tbody>
</table>

<h2 id="cycles">Cycle detection (compile-time)</h2>
<p>The mapper builds a dispatch table at <code>registerPlugin</code> time. If you accidentally create a cycle <code>A → B → A</code> in your <code>inputMap</code>/<code>outputMap</code>, the mapper detects it immediately and throws <code>mapping.cycle.detected</code> with the cycle path (decision <code>D-35</code>). You don&rsquo;t pay the cost at runtime — every event publish has O(1) lookup against the precompiled table.</p>

<h2 id="validation">Validation hooks</h2>
<p>The mapper validates 3 times along the pipeline (decision <code>D-39</code>):</p>
<ol>
<li><strong>Source validation</strong> — local payload before mapping (catches publisher bugs early)</li>
<li><strong>Canonical validation</strong> — payload after <code>outputMap</code>, before route dispatch (catches map bugs)</li>
<li><strong>Consumer validation</strong> — payload after <code>inputMap</code>, before subscriber delivery (catches consumer-side bugs)</li>
</ol>
<p>Validators are pluggable via <code>ValidatorAdapter</code>. Default: <a href="https://valibot.dev" target="_blank" rel="noopener">Valibot</a> (~1-3 KB per schema, tree-shakable). Adapters for Zod and Ajv can be added without changing the mapper engine (decision <code>D-38</code>).</p>

<h2 id="inspector">Mapping Inspector</h2>
<p>In dev mode, every mapping operation is recorded by the Mapping Inspector. You can ask the broker for the last N mapping events with their before/after payloads, transforms applied, and any errors:</p>
<pre><code class="language-typescript">const inspector = broker.getMappingInspector()
const recent = inspector.getSnapshot({ limit: 10 })
// → [{ pluginId, topic, direction: 'output' | 'input',
//     localPayload, canonicalPayload, transformsApplied, errors, ... }]
</code></pre>
<p>Useful when debugging why plugin C isn&rsquo;t receiving what plugin A emitted.</p>

<h2 id="next">Where to next</h2>
<div class="cards">
  <a class="card" href="routing.html">
    <div class="card-title">Routing</div>
    <div class="card-desc">Tell the broker what to do when a topic is published — local, HTTP, worker, cache.</div>
  </a>
  <a class="card" href="../api/mapper.html">
    <div class="card-title">Mapper API reference</div>
    <div class="card-desc">Full type signatures for canonicalModel, aliasRegistry, transforms.</div>
  </a>
</div>
'''
))
