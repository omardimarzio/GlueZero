# Concepts: routing, gateway, realtime, worker, cache, devtools
PAGES = []

# --------------------------------------------------------------------------
PAGES.append((
    'concepts/routing.html', 'Routing', 'Concepts',
    'routing route types local http realtime worker cache composite policy chain resolver',
    '../',
    '''<h1>Routing</h1>
<p class="lead">Routes turn published topics into actions. They&rsquo;re declarative, observable, and composable. Six route types cover the integration patterns you actually need.</p>

<h2 id="anatomy">Anatomy of a route</h2>
<pre><code class="language-typescript">broker.registerRoute({
  id: 'weather-fetch',
  on: 'weather.requested',
  type: 'http',
  request: { method: 'GET', url: '/api/weather', queryMap: { location: 'location' } },
  publishes: { success: 'weather.loaded', error: 'weather.failed' },
  policies: { timeout: { ms: 5000 }, retry: { attempts: 2 } },
})
</code></pre>
<p>Every route has:</p>
<ul>
<li><code>id</code> — unique identifier (used for cascade unregister, debug, metrics)</li>
<li><code>on</code> — the topic (or wildcard) that triggers it</li>
<li><code>type</code> — one of the six route types</li>
<li>type-specific config (<code>request</code> for http, <code>worker</code> for worker, <code>cache</code> for cache, etc.)</li>
<li><code>publishes</code> — outcome topics (<code>success</code>, <code>error</code>, optionally <code>progress</code>)</li>
<li><code>policies</code> — strategy chain (timeout, retry, dedupe, auth, …)</li>
</ul>

<h2 id="types">The six route types</h2>

<h3 id="local"><code>local</code></h3>
<p>The default. Just deliver to local subscribers — no routing logic. Implicit when you publish a topic with no matching route.</p>

<h3 id="http"><code>http</code></h3>
<p>Make a fetch call. The request is built from the canonical payload via <code>queryMap</code> / <code>bodyMap</code> / <code>headerMap</code>. The response is published as <code>success</code> or <code>error</code>.</p>
<pre><code class="language-typescript">{
  type: 'http',
  request: {
    method: 'POST',
    url: '/api/customers',
    bodyMap: { name: 'customer_name', email: 'customer_email' },
    headers: { 'X-Tenant': '$ctx.tenantId' },
  },
}
</code></pre>

<h3 id="realtime"><code>realtime-inbound</code></h3>
<p>Subscribe to an SSE or WebSocket channel. Server frames are normalized via the canonical model and re-published as topics.</p>
<pre><code class="language-typescript">{
  type: 'realtime-inbound',
  channel: { name: 'notifications', mode: 'auto' },
  url: '/api/realtime',
  publishes: { onMessage: '$frame.topic' },  // server decides the topic
}
</code></pre>

<h3 id="worker"><code>worker</code></h3>
<p>Dispatch the payload to a Web Worker registered with <code>broker.registerWorker(...)</code>. Progress events are published continuously, completion at the end.</p>
<pre><code class="language-typescript">{
  type: 'worker',
  worker: { id: 'csv-parser', task: 'parseCSV' },
  publishes: {
    progress: 'csv.parse.progress',
    success: 'csv.parse.completed',
    error: 'csv.parse.failed',
  },
}
</code></pre>

<h3 id="cache"><code>cache</code></h3>
<p>Read/write through a cache adapter with one of three strategies (decision <code>D-156</code>):</p>
<ul>
<li><code>cache-first</code> — return cached if present, fall back to network</li>
<li><code>network-first</code> — try network, fall back to cache on failure</li>
<li><code>cache-then-network</code> — emit cached immediately, then fresh from network (microtask-ordered)</li>
</ul>

<h3 id="composite"><code>composite</code></h3>
<p>Chain multiple route types in one declaration. Useful for &ldquo;cache check, then worker compute, then HTTP persist&rdquo; pipelines.</p>
<pre><code class="language-typescript">{
  type: 'composite',
  steps: [
    { type: 'cache', key: 'forecast.$location.$date', strategy: 'cache-first' },
    { type: 'http', url: '/api/forecast', method: 'GET' },
  ],
}
</code></pre>

<h2 id="policies">The policy chain</h2>
<p>Every <code>http</code> / <code>worker</code> / <code>cache</code> / <code>composite</code> route runs through a chain of strategies. Each is opt-in via the <code>policies</code> key:</p>
<table>
<thead><tr><th>Policy</th><th>What it does</th><th>Default</th></tr></thead>
<tbody>
<tr><td><code>timeout</code></td><td>AbortSignal-based timeout</td><td>10s for http, 30s for worker</td></tr>
<tr><td><code>retry</code></td><td>Retry on 5xx + network (not 4xx, decision <code>D-73</code>)</td><td>none</td></tr>
<tr><td><code>backoff</code></td><td>Exponential with full-jitter</td><td>active when retry is set</td></tr>
<tr><td><code>dedupe</code></td><td>Cancel duplicate inflight requests</td><td>none</td></tr>
<tr><td><code>auth</code></td><td>Bearer with single-flight token refresh (decision <code>D-72</code>)</td><td>none</td></tr>
<tr><td><code>idempotency</code></td><td>Auto-key on POST/PATCH/PUT/DELETE</td><td>none</td></tr>
<tr><td><code>concurrency</code></td><td>'parallel' | 'serial' | 'latest-only' | 'queue-bounded'</td><td>parallel</td></tr>
<tr><td><code>circuitBreaker</code></td><td>Open after N consecutive failures</td><td>none (opt-in)</td></tr>
<tr><td><code>backpressure</code></td><td>6 modes including critical-priority bypass</td><td>none</td></tr>
</tbody>
</table>

<h2 id="resolution">Multiple matching routes</h2>
<p>What if two routes match the same topic? Default policy <code>first-match</code> uses the first registered route (decision <code>D-66</code>). In dev mode the broker emits <code>routing.ambiguous</code> as a warning.</p>
<p>Override:</p>
<pre><code class="language-typescript">broker.registerRoute({ /* ... */, priority: 100 })
// → resolver applies 'priority-ordered' policy, highest priority wins
</code></pre>
<p>Or set globally <code>multipleRoutesPolicy: 'all'</code> for broadcast routing (every matching route fires).</p>

<h2 id="no-route">Topic without a route</h2>
<p>By default, a topic with no matching route is delivered to local subscribers only — no error (decision <code>D-67</code>). If you want strict routing where every topic <em>must</em> have a route, declare it on the canonical schema:</p>
<pre><code class="language-typescript">{
  id: 'weather.canonical',
  requiresRoute: true,
  // throws BrokerError 'route.required.missing' if no route exists
}
</code></pre>

<h2 id="cascade">Cascade unregister (LIFE-02 ext)</h2>
<p>When a plugin is unregistered, every route registered through that plugin&rsquo;s <code>routes</code> field is automatically removed. Plus: in-flight HTTP requests are aborted, realtime channels are disconnected, worker tasks are terminated.</p>

<h2 id="next">Where to next</h2>
<div class="cards">
  <a class="card" href="gateway.html"><div class="card-title">HTTP gateway</div><div class="card-desc">The strategy chain in action: auth, retry, dedupe, idempotency.</div></a>
  <a class="card" href="../api/routing.html"><div class="card-title">Routing API reference</div><div class="card-desc">Full RouteDefinition type signature.</div></a>
</div>
'''
))


# --------------------------------------------------------------------------
PAGES.append((
    'concepts/gateway.html', 'HTTP gateway', 'Concepts',
    'gateway http policy retry timeout dedupe auth bearer single-flight idempotency allowlist circuit-breaker backpressure',
    '../',
    '''<h1>HTTP gateway</h1>
<p class="lead">A single observable layer for outbound HTTP. All <code>type: 'http'</code> routes share the same strategy chain — auth, retry, timeout, dedupe, idempotency, allowlist, circuit breaker, backpressure.</p>

<h2 id="why">Why a gateway</h2>
<p>The traditional pattern: <code>fetch('/api/...')</code> scattered across components. Each component duplicates auth headers, retry logic, error handling. Some forget. Some get it wrong. None of them are observable.</p>
<p>The gateway centralizes all of this. Components publish topics; routes describe HTTP calls; the gateway runs every call through the same policy stack. The result:</p>
<ul>
<li>One place to add a new auth scheme</li>
<li>One place to tune retry behavior</li>
<li>One place to add observability</li>
<li>Components don&rsquo;t know HTTP exists</li>
</ul>

<h2 id="strategy-chain">The strategy chain</h2>
<p>For each request, strategies execute in this order:</p>
<ol>
<li><strong>Allowlist</strong> — block if URL host is not allowlisted (decision <code>D-71</code>)</li>
<li><strong>Auth</strong> — attach Bearer token, refresh once if 401 (single-flight, decision <code>D-72</code>)</li>
<li><strong>Idempotency</strong> — auto-generate idempotency key on POST/PATCH/PUT/DELETE (decision <code>D-70</code>)</li>
<li><strong>Dedupe</strong> — collapse concurrent identical requests (in-flight or windowed)</li>
<li><strong>Concurrency</strong> — apply per-route policy (latest-only, serial, queue-bounded)</li>
<li><strong>Backpressure</strong> — drop or queue if concurrency cap reached (with critical-priority bypass)</li>
<li><strong>Circuit breaker</strong> — open after N failures, half-open after cooldown (per-route opt-in)</li>
<li><strong>Timeout</strong> — abort with <code>AbortSignal.timeout()</code></li>
<li><strong>Retry</strong> — retry on 5xx and network errors only, not 4xx (decision <code>D-73</code>) — except 408/429 honoring <code>Retry-After</code> header</li>
<li><strong>Backoff</strong> — exponential with full-jitter when retrying</li>
<li><strong>Fetch</strong> — the actual request</li>
<li><strong>Response normalization</strong> — map server payload via the route&rsquo;s <code>responseMap</code></li>
</ol>
<p>Each strategy is configured via the <code>policies</code> key on the route. Default is &ldquo;everything off&rdquo; — opt in only what you need.</p>

<h2 id="auth">Auth + single-flight refresh</h2>
<pre><code class="language-typescript">broker.registerRoute({
  id: 'protected-route',
  on: 'customers.list.requested',
  type: 'http',
  request: { method: 'GET', url: '/api/customers' },
  publishes: { success: 'customers.list.loaded', error: 'customers.list.failed' },
  policies: {
    auth: {
      scheme: 'bearer',
      getToken: () => sessionToken,
      refresh: async () => {
        const res = await fetch('/api/refresh', { method: 'POST' })
        return (await res.json()).accessToken
      },
    },
  },
})
</code></pre>
<p>If multiple routes hit a 401 simultaneously, only one refresh is fired (<strong>single-flight</strong>); the others queue and retry with the new token.</p>

<h2 id="dedupe">Dedupe</h2>
<p>Two patterns:</p>
<pre><code class="language-typescript">policies: {
  dedupe: { window: 'inflight' },         // collapse concurrent identical requests
}
// or
policies: {
  dedupe: { window: 'time', ms: 500 },    // throttle: ignore identical requests within 500ms
}
</code></pre>
<p>The dedupe key is the route id + canonical payload hash. Override with a custom key function if you want narrower or wider deduplication.</p>

<h2 id="idempotency">Idempotency</h2>
<p>For POST/PATCH/PUT/DELETE, the gateway can auto-generate an <code>Idempotency-Key</code> header (UUID v4 by default). The server decides whether to honor it. Useful when the user double-clicks &ldquo;Submit&rdquo;.</p>
<pre><code class="language-typescript">policies: { idempotency: { auto: true } }
</code></pre>

<h2 id="allowlist">URL allowlist</h2>
<p>Critical for security. Without an allowlist, any route definition can hit any URL (potentially data exfiltration if route definitions come from third-party plugins).</p>
<pre><code class="language-typescript">// Global config
gateway: {
  allowlist: ['/api/', 'https://api.example.com/'],
  onBlocked: (url) =&gt; broker.publish('system.security.blocked', { url }),
}
</code></pre>
<p>Allowlisted prefixes apply to the final URL <em>after redirects</em> (decision <code>D-71</code>) — the gateway re-validates the destination if a redirect is followed.</p>

<h2 id="errors">Sanitized errors</h2>
<p>When a request fails, the gateway publishes the route&rsquo;s <code>error</code> topic with a sanitized payload (no stack, no original error, no internal details):</p>
<pre><code class="language-typescript">{
  code: 'http.timeout',
  category: 'network',
  message: 'Request timed out after 5000ms',
  routeId: 'weather-fetch',
  topic: 'weather.requested',
  eventId: 'evt_xKp9N3...',
}
</code></pre>
<p>The full error is logged via the Inspector (dev mode) but never leaks into application code that might display it to the user.</p>

<h2 id="next">Where to next</h2>
<div class="cards">
  <a class="card" href="realtime.html"><div class="card-title">Realtime</div><div class="card-desc">SSE + WebSocket with auto-fallback and visibility-aware reconnection.</div></a>
  <a class="card" href="../recipes/auth-token-refresh.html"><div class="card-title">Recipe: Auth + token refresh</div><div class="card-desc">Working example with token expiration and refresh.</div></a>
</div>
'''
))


# --------------------------------------------------------------------------
PAGES.append((
    'concepts/realtime.html', 'Realtime', 'Concepts',
    'realtime sse server-sent-events websocket reconnect auto-fallback ping pong visibility last-event-id',
    '../',
    '''<h1>Realtime inbound</h1>
<p class="lead">Subscribe to server-pushed events as topics. SSE is the default; WebSocket is the upgrade path. Auto-fallback, visibility-aware reconnection, and frame normalization through the canonical model.</p>

<h2 id="why">SSE-first</h2>
<p>Most realtime use cases are unidirectional (server → client). SSE wins:</p>
<ul>
<li>Native <code>EventSource</code> in every browser (no polyfill, decision <code>D-104</code>)</li>
<li>Automatic reconnection at the protocol level</li>
<li>Built-in <code>Last-Event-ID</code> for resume after disconnect</li>
<li>Standard text framing — easy to debug</li>
</ul>
<p>Use WebSocket when you need bidirectional traffic (chat, collaborative editing, ack-required messaging) or strict ordering across many topics.</p>

<h2 id="route">A realtime route</h2>
<pre><code class="language-typescript">broker.registerRoute({
  id: 'notifications-channel',
  type: 'realtime-inbound',
  channel: { name: 'notifications', mode: 'auto' },  // auto = SSE first, fallback to WS
  url: '/api/realtime/notifications',
  policies: {
    auth: { scheme: 'bearer', getToken: () => sessionToken },
    reconnect: { maxAttempts: 10, fallbackThreshold: 3 },
  },
  publishes: {
    onMessage: '$frame.topic',  // server frame decides which topic to publish
    onConnect: 'system.realtime.connected',
    onDisconnect: 'system.realtime.disconnected',
  },
})

broker.connectRealtime()  // explicit connect (or auto on first registerRoute)
</code></pre>

<h2 id="frames">Frame envelope</h2>
<p>The server sends frames in a uniform JSON envelope (decision <code>D-106</code>):</p>
<pre><code class="language-json">{ "topic": "notification.received",
  "data": { "title": "New message", "body": "..." },
  "id": "msg-12345" }</code></pre>
<p>The realtime adapter parses, validates, and re-publishes as a <code>BrokerEvent</code> on the topic specified in <code>frame.topic</code>. Subscribers don&rsquo;t know it came from SSE vs WS.</p>

<h2 id="reconnect">Reconnect contract</h2>
<p>Every disconnect is governed by a state machine:</p>
<ol>
<li>Initial connect → <code>system.realtime.connecting</code></li>
<li>Connected → <code>system.realtime.connected</code></li>
<li>Connection drops → <code>system.realtime.disconnected</code> (with reason)</li>
<li>Backoff with full-jitter, attempt N → <code>system.realtime.reconnecting</code></li>
<li>If <code>fallbackThreshold</code> consecutive failures on SSE → switch to WebSocket (auto mode)</li>
<li>If global cycle cap exceeded → <code>system.realtime.failed</code> (terminal — manual reconnect required)</li>
</ol>
<p>Backoff uses full-jitter with anti-flap consolidation (decision <code>D-109</code>): if connection succeeds and drops within 5s, the next backoff doesn&rsquo;t reset to zero — protects against flapping servers.</p>

<h2 id="visibility">Visibility-aware</h2>
<p>When the tab goes hidden (Page Visibility API), the realtime adapter pauses reconnect attempts (decision <code>D-110</code>). Coming back to the foreground triggers an immediate reconnect attempt. Save battery, save server load.</p>

<h2 id="last-event-id">Last-Event-ID</h2>
<p>SSE has a built-in resume mechanism: the client sends <code>Last-Event-ID</code> on reconnect, the server can replay events newer than that id. The adapter passes the last seen <code>frame.id</code> as a query string parameter (browsers don&rsquo;t allow custom headers on EventSource).</p>

<h3 id="ws-ping">WebSocket: application-level ping/pong</h3>
<p>Browsers don&rsquo;t expose the <code>ping</code> frame on WebSocket. The adapter sends an application-level ping every 30s on a reserved internal topic <code>__ping__</code>; the server replies with <code>__pong__</code>. If no pong within 60s, the connection is considered stale and reconnect kicks in (decision <code>D-111</code>).</p>

<h2 id="auth">Auth on connect</h2>
<p>SSE in browsers cannot send custom <code>Authorization</code> headers. The adapter supports four auth strategies (decision <code>D-104</code>):</p>
<ol>
<li><strong>Cookie</strong> — server sets HTTP-only cookie at login, EventSource sends it automatically</li>
<li><strong>Query param</strong> — append <code>?access_token=...</code> to the URL (less safe — token in logs)</li>
<li><strong>Server-issued ticket</strong> — exchange refresh token for short-lived ticket via fetch, then connect</li>
<li><strong>WebSocket subprotocol</strong> — WS only; pass token in subprotocol negotiation</li>
</ol>

<h2 id="next">Where to next</h2>
<div class="cards">
  <a class="card" href="../recipes/reconnect-realtime.html"><div class="card-title">Recipe: Reconnect SSE→WS</div><div class="card-desc">Auto-fallback in action with cycle cap.</div></a>
  <a class="card" href="../api/gateway.html"><div class="card-title">Gateway API reference</div><div class="card-desc">Full RealtimeChannelDescriptor type.</div></a>
</div>
'''
))


# --------------------------------------------------------------------------
PAGES.append((
    'concepts/worker.html', 'Worker', 'Concepts',
    'worker web-worker comlink pool registry cancellation progress serialization transferable',
    '../',
    '''<h1>Worker runtime</h1>
<p class="lead">Move heavy work off the main thread without breaking the event flow. Bounded pool, hybrid cancellation, transferable opt-in, serialization checks in dev mode.</p>

<h2 id="why">When to use a worker</h2>
<p>The classic reasons:</p>
<ul>
<li>Large CSV/JSON parsing</li>
<li>Image manipulation, encoding, decoding</li>
<li>CPU-heavy data transformation</li>
<li>Cryptography (hash, sign, verify large payloads)</li>
<li>Compression, decompression</li>
<li>Local search index, fuzzy matching on large datasets</li>
</ul>
<p>If your operation regularly takes &gt; 50ms on the main thread, it should probably be a worker.</p>

<h2 id="register">Register a worker</h2>
<pre><code class="language-typescript">broker.registerWorker({
  id: 'csv-parser',
  factory: () => new Worker(new URL('./csv-worker.ts', import.meta.url), { type: 'module' }),
  tasks: ['parseCSV', 'validateCSV'],
  poolSize: 2,
})
</code></pre>
<p>The factory is lazy — the actual <code>Worker</code> instance is created only on first dispatch. <code>tasks</code> declares the names of methods the worker exposes (Comlink RPC). A dispatch to an unknown task fails fast with <code>worker.task.unknown</code>.</p>

<h2 id="route">Route a topic to a worker</h2>
<pre><code class="language-typescript">broker.registerRoute({
  id: 'csv-parse',
  on: 'csv.parse.requested',
  type: 'worker',
  worker: { id: 'csv-parser', task: 'parseCSV' },
  publishes: {
    progress: 'csv.parse.progress',
    success: 'csv.parse.completed',
    error: 'csv.parse.failed',
  },
})

broker.publish('csv.parse.requested', { fileBuffer: arrayBuffer })
</code></pre>

<h2 id="worker-source">Inside the worker</h2>
<pre><code class="language-typescript">// csv-worker.ts
import { expose } from '@gluezero/worker'

expose({
  parseCSV: async (fileBuffer, signal, onProgress) => {
    const text = new TextDecoder().decode(fileBuffer)
    const rows = []
    const lines = text.split('\\n')
    for (let i = 0; i &lt; lines.length; i++) {
      if (signal.aborted) throw new Error('cancelled')
      rows.push(parseLine(lines[i]))
      if (i % 1000 === 0) {
        onProgress({ value: i / lines.length, message: `${i} rows` })
      }
    }
    return rows
  },
})
</code></pre>
<p>Tasks receive: the args from the route&rsquo;s payload, an <code>AbortSignal</code> proxied through Comlink, an <code>onProgress</code> callback that publishes back to the main thread.</p>

<h2 id="pool">Pool</h2>
<p>The pool is bounded by default (decision <code>D-127</code>): <code>min(navigator.hardwareConcurrency, 4)</code> with a hard cap of 8. Lazy spawn — workers are created on first dispatch, not at registration.</p>
<table>
<thead><tr><th>Setting</th><th>Default</th><th>Override</th></tr></thead>
<tbody>
<tr><td>Initial pool size</td><td><code>min(hwc, 4)</code></td><td><code>poolSize: N</code></td></tr>
<tr><td>Hard cap</td><td>8</td><td>configurable, but exceeding 8 logs a warning</td></tr>
<tr><td>Spawn behavior</td><td>Lazy (first dispatch)</td><td>—</td></tr>
<tr><td>Backpressure</td><td>Reuses HTTP gateway BackpressureStrategy</td><td>per-route override</td></tr>
</tbody>
</table>

<h2 id="cancellation">Hybrid cancellation</h2>
<p>Two cancellation modes (decision <code>D-131</code>):</p>
<ol>
<li><strong>Dedicated workers</strong> — when a task is cancelled, the worker is <code>terminate()</code>d. Hard kill, immediate. Cost: respawn on next dispatch.</li>
<li><strong>Pool workers</strong> — cooperative cancellation. The <code>AbortSignal</code> is proxied via Comlink; the task is responsible for checking <code>signal.aborted</code> and throwing. Grace period 2000ms, then hard terminate if still running.</li>
</ol>
<p>The state machine ensures atomicity (decision <code>D-133</code>, Pitfall 2C): a task that completes <em>after</em> being cancelled (race condition) has its result silently discarded. No double publish of completion + error.</p>

<h2 id="serialization">Serialization (WK-07)</h2>
<p>Web Workers transfer data via <code>structuredClone</code>. Most things work; some don&rsquo;t. The default <code>structuredClone</code> supports: primitives, plain objects, arrays, <code>Date</code>, <code>Map</code>, <code>Set</code>, <code>BigInt</code>, <code>Blob</code>, <code>ArrayBuffer</code>, typed arrays, <code>MessagePort</code>. Functions, DOM elements, prototypes are NOT transferable.</p>
<p>In dev mode, the runtime wraps every <code>postMessage</code> with <code>assertSerializable</code> (decision <code>D-139</code>) — a deep walk that throws <code>worker.serialization.failed</code> with the offending field path <em>before</em> the message is sent. This catches bugs immediately, with a useful error.</p>

<h3 id="transferable">Transferable opt-in</h3>
<p>Large <code>ArrayBuffer</code> objects can be <em>transferred</em> instead of cloned (zero-copy). Opt-in via JSON-path-like array (decision <code>D-141</code>):</p>
<pre><code class="language-typescript">{
  type: 'worker',
  worker: { id: 'image-processor', task: 'process' },
  transferable: ['payload.imageData', 'payload.thumbnails[*].buffer'],
}
</code></pre>
<p>Transferred objects become unusable on the main thread after dispatch (their <code>byteLength</code> drops to 0). The dev-mode check warns if you accidentally try to read them.</p>

<h2 id="progress">Progress events</h2>
<p>The <code>onProgress</code> callback inside the worker is throttled to 100ms latest-only by default (decision <code>D-137</code>). 1000 progress calls in 1 second result in ~10 published events, not 1000. Override with <code>progressThrottleMs</code> per route.</p>

<h2 id="next">Where to next</h2>
<div class="cards">
  <a class="card" href="../recipes/worker-progress.html"><div class="card-title">Recipe: Worker progress</div><div class="card-desc">Background CSV parser with progress UI.</div></a>
  <a class="card" href="../api/worker.html"><div class="card-title">Worker API reference</div><div class="card-desc">Full WorkerDescriptor and registerWorker types.</div></a>
</div>
'''
))


# --------------------------------------------------------------------------
PAGES.append((
    'concepts/cache.html', 'Cache', 'Concepts',
    'cache lru ttl scope strategy cache-first network-first cache-then-network adapter memory invalidation',
    '../',
    '''<h1>Cache</h1>
<p class="lead">An in-memory LRU cache with three strategies, scope-aware isolation, and TTL. Pluggable adapter — swap in IndexedDB or sessionStorage as needed.</p>

<h2 id="adapter">CacheAdapter</h2>
<p>The cache is interface-driven. The default <code>MemoryCacheAdapter</code> implements:</p>
<ul>
<li>LRU eviction with <code>maxEntries: 1000</code> default (decision <code>D-158</code>)</li>
<li>TTL orthogonal to LRU (entry can be evicted before expiry if cache is full)</li>
<li>Map-order tracking (insertion = LRU recency, idiomatic JS)</li>
<li>Predictable memory footprint</li>
</ul>
<p>You can swap the adapter:</p>
<pre><code class="language-typescript">const broker = createGlueZero({
  cache: { adapter: new IndexedDBAdapter() },  // V1.x package — coming
})
</code></pre>

<h2 id="route">Cache route</h2>
<pre><code class="language-typescript">broker.registerRoute({
  id: 'forecast-cached',
  on: 'forecast.requested',
  type: 'cache',
  cache: {
    key: (event) =&gt; `forecast.${event.payload.location}.${event.payload.date}`,
    ttl: 5 * 60 * 1000,            // 5 minutes
    strategy: 'cache-then-network',
  },
  fallback: {
    type: 'http',
    request: { method: 'GET', url: '/api/forecast' },
  },
  publishes: { success: 'forecast.loaded', error: 'forecast.failed' },
})
</code></pre>
<p>The <code>fallback</code> is what runs on cache miss (or always, for <code>cache-then-network</code>). It can be any other route type.</p>

<h2 id="strategies">The three strategies</h2>
<table>
<thead><tr><th>Strategy</th><th>Behavior</th><th>Use case</th></tr></thead>
<tbody>
<tr><td><code>cache-first</code></td><td>Return cached if present, otherwise call fallback and cache</td><td>Static-ish data: dropdowns, taxonomies, dictionaries</td></tr>
<tr><td><code>network-first</code></td><td>Try fallback, on failure return cached as last resort</td><td>Resilience: works offline-ish</td></tr>
<tr><td><code>cache-then-network</code></td><td>Emit cached immediately, then emit fresh from network (microtask-ordered)</td><td>UX: instant first paint + auto-refresh</td></tr>
</tbody>
</table>
<p><strong>cache-then-network</strong> publishes the same topic twice with <code>metadata.origin: 'cache'</code> first, <code>'remote'</code> second (decision <code>D-156</code>, RESEARCH §15.6). Subscribers can choose to render the cached version immediately and update on fresh.</p>

<h2 id="scope">Scope hybrid</h2>
<p>The biggest cache pitfall in multi-tenant apps: leaking data between users.</p>
<p>GlueZero solves this with a 3-layer scope hybrid (decision <code>D-156</code>):</p>
<ol>
<li><strong>Config-level scopeProvider</strong> — global default. Returns the current scope (e.g. user id).</li>
<li><strong>Route-level scope override</strong> — per-route function for finer control.</li>
<li><strong>Fail-secure on missing scope</strong> — if scope is required but <code>null</code> (e.g. user not logged in yet), the cache <strong>misses</strong>. Doesn&rsquo;t leak global cache, doesn&rsquo;t throw, just publishes <code>system.cache.scope-missing</code> for audit (decision <code>D-157</code>).</li>
</ol>
<pre><code class="language-typescript">const broker = createGlueZero({
  cache: {
    scopeProvider: () =&gt; getCurrentUserId(),  // returns 'u-123' or null
  },
})

// then a scoped route:
broker.registerRoute({
  type: 'cache',
  cache: {
    key: 'profile.$userId',
    scoped: true,                    // require scope
    // OR scope: (event) =&gt; event.payload.tenantId  // per-route override
  },
})
</code></pre>
<p>Internally, the cache key becomes <code>${scope}::${baseKey}</code>. Different users see different caches. Cross-tenant leakage is impossible.</p>

<h2 id="invalidation">Invalidation</h2>
<p>Three ways to invalidate:</p>
<pre><code class="language-typescript">broker.cache.invalidate('forecast.Roma.2026-05-10')        // exact key
broker.cache.invalidate(/^forecast\\./)                    // RegExp
broker.cache.invalidate({ prefix: 'profile.' })            // prefix object
</code></pre>
<p>Plus automatic invalidation through cascade <code>unregisterPlugin</code>: cache entries tagged with the plugin&rsquo;s ownerId are removed when the plugin is unregistered (LIFE-02 ext F6).</p>

<h2 id="ordering">cache-then-network ordering</h2>
<p>The twin emission of <code>cache-then-network</code> uses microtask ordering to guarantee:</p>
<ol>
<li>Cache hit fires synchronously after publish (well, on next microtask)</li>
<li>Network call starts in parallel</li>
<li>Fresh result fires later, never before the cached</li>
</ol>
<p>Subscribers see <code>metadata.origin: 'cache'</code> first, then <code>'remote'</code> (or <code>'remote-failed'</code> if network fails — cache result remains valid).</p>

<h2 id="next">Where to next</h2>
<div class="cards">
  <a class="card" href="../recipes/multi-tenant-cache.html"><div class="card-title">Recipe: Multi-tenant cache</div><div class="card-desc">Per-user cache scope with fail-secure.</div></a>
  <a class="card" href="../api/cache.html"><div class="card-title">Cache API reference</div><div class="card-desc">Full CacheAdapter interface and config types.</div></a>
</div>
'''
))


# --------------------------------------------------------------------------
PAGES.append((
    'concepts/devtools.html', 'Devtools', 'Concepts',
    'devtools inspector metrics openmetrics prometheus reservoir cardinality cap pause-controller debug snapshot',
    '../',
    '''<h1>Developer tooling</h1>
<p class="lead">Inspector, MetricsCollector, PauseController. The observability layer that makes the event flow debuggable in dev and measurable in production.</p>

<h2 id="inspector">Event/Mapping/Route Inspector</h2>
<p>Three inspectors, all backed by ring buffers (default 500 entries, decision <code>D-167</code>). Memory cost: ~5-10 MB with average payloads.</p>
<pre><code class="language-typescript">const events = broker.getEventInspector()
const last = events.getSnapshot({ limit: 50 })
// → [
//     { id, topic, timestamp, source, payload, deliveryMode, priority,
//       pipelineSteps: [...], outcome: 'delivered' | 'failed' | 'dedup-skipped' },
//     ...
//   ]

const mapping = broker.getMappingInspector()
const last_mapping = mapping.getSnapshot({ limit: 50 })
// → mapping operations with before/after payloads

const routes = broker.getRouteInspector()
const last_routes = routes.getSnapshot({ limit: 50 })
// → route resolutions with strategy chain executed and timings
</code></pre>

<h3 id="ring-buffer">Why ring buffer</h3>
<p>Bounded memory. Most recent N entries always available. Old entries silently drop. Predictable in long-running pages (dashboards, single-page apps that live for hours).</p>

<h3 id="snapshot">Deep clone snapshot</h3>
<p>Calling <code>getSnapshot()</code> returns a deep clone via <code>structuredClone</code> (decision <code>D-162</code>). Reading the snapshot doesn&rsquo;t pin live broker state. Pass the result freely to dev UIs, JSON.stringify, IPC bridges to a browser extension.</p>

<h2 id="metrics">MetricsCollector</h2>
<p>Simil-OpenMetrics format with three primitive types:</p>
<pre><code class="language-typescript">{
  counters: {
    'gluezero.gateway.http_requests_total{method="GET",status="200"}': 1234,
    'gluezero.broker.events_published_total{topic="weather.requested"}': 567,
  },
  gauges: {
    'gluezero.worker.pool_size': 4,
    'gluezero.cache.entries_count': 89,
  },
  histograms: {
    'gluezero.gateway.http_duration_ms{route="weather-fetch"}': {
      count: 1234, sum: 45678, p50: 32, p90: 75, p99: 180,
    },
  },
}
</code></pre>

<h3 id="naming">Naming convention</h3>
<p>Prometheus-friendly dot.case (decision <code>D-163</code>): <code>gluezero.&lt;package&gt;.&lt;metric&gt;</code>. Suffixes follow Prometheus conventions:</p>
<ul>
<li><code>_total</code> for counters (cumulative)</li>
<li><code>_ms</code> for durations</li>
<li><code>_bytes</code> for sizes</li>
</ul>
<p>1:1 mapping to OpenTelemetry exporter format — the V1.x <code>@gluezero/metrics-otel</code> adapter is straightforward.</p>

<h3 id="reservoir">Histogram reservoir</h3>
<p>Histograms use Algorithm R reservoir sampling (Vitter 1985, decision <code>D-165</code>). Bounded sample size (~1024 samples per metric). Approximate quantiles (p50/p90/p99) are computed from the reservoir on read. Memory bounded; quantile error &lt; 5% for typical workloads.</p>

<h3 id="cardinality">Cardinality cap</h3>
<p>The Achilles heel of metrics with labels: unbounded cardinality blows up memory. The collector caps distinct label combinations to <strong>100 per metric name</strong> (decision <code>D-166</code>). Beyond that, the metric publishes <code>system.metrics.cardinality-overflow</code> for audit and silently drops new combinations.</p>
<p>Best practice: avoid high-cardinality labels (don&rsquo;t use user id, request id, etc. as label values).</p>

<h3 id="delta">getMetricsDelta()</h3>
<p>Useful for periodic exporters: ask for the delta since the last call.</p>
<pre><code class="language-typescript">let prev = broker.getMetrics()
setInterval(() =&gt; {
  const delta = broker.getMetricsDelta(prev)
  exportToBackend(delta)
  prev = broker.getMetrics()
}, 60_000)
</code></pre>

<h2 id="pause">PauseController</h2>
<p>Two methods: pause delivery on a topic, resume it later.</p>
<pre><code class="language-typescript">broker.pauseTopic('notifications.received')
// publishers continue to call publish; events are queued FIFO

broker.resumeTopic('notifications.received')
// queued events flush to subscribers in publish order

broker.flushQueue('notifications.received')  // drop queued (with audit event)
</code></pre>
<p>The queue is bounded (<code>maxQueueSize: 1000</code> default, decision <code>D-170</code>) with drop-oldest FIFO when full. <strong>Critical-priority events bypass the pause</strong> — emergency events still get delivered.</p>
<p>Use case: bulk import that publishes 10k notifications to a UI; pause the topic during import, flush at the end, deliver one summary notification.</p>

<h2 id="debug-mode">enableDebug / disableDebug</h2>
<p>Toggle observability at runtime (decision <code>D-160</code>). When debug is off, taps are still registered but in &ldquo;lazy mode&rdquo; — minimal overhead, no payload capture, no metric increment cost.</p>
<pre><code class="language-typescript">broker.enableDebug()
// full payload capture, freeze checks, mapping inspector active

broker.disableDebug()
// lazy mode, only error-path taps fire
</code></pre>
<p>Default: <code>debug</code> is on in development, off in production (NODE_ENV-aware autodetection).</p>

<h2 id="taps">Tap registry</h2>
<p>Custom taps integrate with third-party tools (Sentry, OpenTelemetry, custom dashboards):</p>
<pre><code class="language-typescript">const broker = createGlueZero({
  taps: [
    {
      onEventPublished: (event) =&gt; sentry.addBreadcrumb({ topic: event.topic }),
      onEventFailed: (event, err) =&gt; sentry.captureException(err),
    },
    {
      onMetricsTick: (metrics) =&gt; otelExporter.export(metrics),
    },
  ],
})
</code></pre>
<p>Each tap runs in an isolated try/catch — a failing tap doesn&rsquo;t crash the others (decision <code>D-159</code>).</p>

<h2 id="next">Where to next</h2>
<div class="cards">
  <a class="card" href="../recipes/debug-flow.html"><div class="card-title">Recipe: Debug with Inspector</div><div class="card-desc">Trace an event through 14 pipeline steps in dev tools.</div></a>
  <a class="card" href="../api/devtools.html"><div class="card-title">Devtools API reference</div><div class="card-desc">Full Inspector and MetricsCollector types.</div></a>
</div>
'''
))
