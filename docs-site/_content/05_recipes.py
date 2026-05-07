# Recipes: practical patterns
PAGES = []

# --------------------------------------------------------------------------
PAGES.append((
    'recipes/auth-token-refresh.html', 'Auth + token refresh', 'Recipes',
    'recipe auth bearer token refresh single-flight 401 expire',
    '../',
    '''<h1>Recipe: Auth + token refresh</h1>
<p class="lead">Configure Bearer auth with automatic token refresh on 401. Single-flight semantics: many concurrent 401s trigger only one refresh.</p>

<h2 id="setup">Setup</h2>
<pre><code class="language-typescript">import { createGlueZero } from '@gluezero/gluezero'

let accessToken = localStorage.getItem('access_token') ?? ''
let refreshToken = localStorage.getItem('refresh_token') ?? ''

const broker = createGlueZero({
  routes: [
    {
      id: 'list-customers',
      on: 'customers.list.requested',
      type: 'http',
      request: {
        method: 'GET',
        url: '/api/customers',
      },
      publishes: {
        success: 'customers.list.loaded',
        error: 'customers.list.failed',
      },
      policies: {
        timeout: { ms: 8000 },
        retry: { attempts: 1, on: ['5xx', 'network'] },
        auth: {
          scheme: 'bearer',
          getToken: () =&gt; accessToken,
          refresh: async () =&gt; {
            const res = await fetch('/api/auth/refresh', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken }),
            })
            if (!res.ok) throw new Error('refresh failed')
            const json = await res.json()
            accessToken = json.accessToken
            refreshToken = json.refreshToken
            localStorage.setItem('access_token', accessToken)
            localStorage.setItem('refresh_token', refreshToken)
            return accessToken
          },
        },
      },
    },
  ],
})
</code></pre>

<h2 id="usage">Usage</h2>
<pre><code class="language-typescript">broker.subscribe('customers.list.loaded', (event) =&gt; {
  renderCustomerTable(event.payload)
})

broker.subscribe('customers.list.failed', (event) =&gt; {
  if (event.payload.code === 'auth.refresh.failed') {
    redirectToLogin()
  } else {
    showErrorBanner(event.payload.message)
  }
})

// trigger
broker.publish('customers.list.requested', {})
</code></pre>

<h2 id="behavior">What happens</h2>
<ol>
<li>Request fires with current <code>accessToken</code>.</li>
<li>Server responds <strong>200 OK</strong> → <code>customers.list.loaded</code> publishes.</li>
<li>Server responds <strong>401</strong> → auth strategy intercepts, calls <code>refresh()</code>, retries once with the new token.</li>
<li>If <code>refresh()</code> throws → <code>customers.list.failed</code> publishes with <code>code: 'auth.refresh.failed'</code>. App redirects to login.</li>
</ol>

<h2 id="single-flight">Single-flight refresh</h2>
<p>What if 5 different routes all hit 401 at the same time? Without single-flight, you&rsquo;d call <code>/api/auth/refresh</code> 5 times — race condition, server load, possibly invalidating the latest refresh token before it&rsquo;s used.</p>
<p>The auth strategy guarantees:</p>
<ul>
<li>Only one <code>refresh()</code> promise is in flight at a time</li>
<li>Concurrent 401s wait for that single promise to resolve</li>
<li>All retries use the same fresh token</li>
</ul>
<p>This is built-in (decision <code>D-72</code>); you don&rsquo;t configure anything for it.</p>

<h2 id="custom-401">Custom 401 detection</h2>
<p>Some APIs return 200 with a body indicating auth failure. Handle it via a custom <code>shouldRefresh</code>:</p>
<pre><code class="language-typescript">auth: {
  scheme: 'custom',
  getToken: () =&gt; accessToken,
  shouldRefresh: (response, body) =&gt; {
    return response.status === 401
      || (response.status === 200 &amp;&amp; body?.error?.code === 'TOKEN_EXPIRED')
  },
  refresh: async () =&gt; { /* ... */ },
}
</code></pre>
'''
))


# --------------------------------------------------------------------------
PAGES.append((
    'recipes/multi-tenant-cache.html', 'Multi-tenant cache', 'Recipes',
    'recipe cache scope multi-tenant fail-secure user-isolation per-user',
    '../',
    '''<h1>Recipe: Multi-tenant cache</h1>
<p class="lead">A cache layer that physically isolates data per user. If the scope is missing (user not logged in yet, race at boot), the cache misses safely instead of leaking shared data.</p>

<h2 id="problem">Why scope matters</h2>
<p>Without scope, the cache is shared globally:</p>
<ul>
<li>User A logs in, fetches their customer list, cache stores it</li>
<li>User A logs out</li>
<li>User B logs in, cache returns A&rsquo;s customer list — <strong>data leak</strong></li>
</ul>

<h2 id="solution">Solution: scopeProvider</h2>
<pre><code class="language-typescript">import { createGlueZero } from '@gluezero/gluezero'

const broker = createGlueZero({
  cache: {
    scopeProvider: () =&gt; getCurrentUser()?.id ?? null,
  },
  routes: [
    {
      id: 'customers-cached',
      on: 'customers.list.requested',
      type: 'cache',
      cache: {
        key: 'customers.list',           // base key
        ttl: 5 * 60 * 1000,
        strategy: 'cache-then-network',
        scoped: true,                    // require scope (fail-secure if missing)
      },
      fallback: {
        type: 'http',
        request: { method: 'GET', url: '/api/customers' },
      },
      publishes: { success: 'customers.list.loaded', error: 'customers.list.failed' },
    },
  ],
})

function getCurrentUser() {
  // your auth state provider
  return globalThis.__currentUser ?? null
}
</code></pre>

<h2 id="behavior">What happens</h2>
<table>
<thead><tr><th>Scenario</th><th>Behavior</th></tr></thead>
<tbody>
<tr><td>User A logged in, requests customers</td><td>Cache key becomes <code>u-A::customers.list</code>. First call cache miss → HTTP fetch → cache store. Second call cache hit.</td></tr>
<tr><td>User B logs in (after A), requests customers</td><td>Cache key becomes <code>u-B::customers.list</code>. Different key from A → cache miss → HTTP fetch. <strong>No leak.</strong></td></tr>
<tr><td>scopeProvider returns null (boot, race, error)</td><td>Cache lookup returns miss; cache write is no-op. <code>system.cache.scope-missing</code> emitted for audit. Route still works (HTTP fetch fires). User sees fresh data, no crash.</td></tr>
</tbody>
</table>

<h2 id="audit">Audit missing scope</h2>
<pre><code class="language-typescript">broker.subscribe('system.cache.scope-missing', (event) =&gt; {
  console.warn('Cache scope missing for route', event.payload.routeId,
               'topic', event.payload.topic, 'eventId', event.payload.eventId)
  // → ship to your observability backend
  sentry.captureMessage('cache.scope-missing', { extra: event.payload })
})
</code></pre>

<h2 id="logout-invalidate">Invalidate on logout</h2>
<p>When the user logs out, drop their entire scope from the cache:</p>
<pre><code class="language-typescript">async function logout() {
  const userId = getCurrentUser()?.id
  if (userId) {
    broker.cache.invalidate({ prefix: `${userId}::` })
  }
  await fetch('/api/logout', { method: 'POST' })
  globalThis.__currentUser = null
}
</code></pre>

<h2 id="route-override">Per-route override</h2>
<p>Some data is genuinely shared across users (taxonomies, dictionaries). Don&rsquo;t scope those:</p>
<pre><code class="language-typescript">{
  id: 'taxonomy-cached',
  type: 'cache',
  cache: {
    key: 'taxonomy.products',
    strategy: 'cache-first',
    ttl: 60 * 60 * 1000,
    scoped: false,                       // skip scopeProvider (shared cache)
  },
  // ...
}
</code></pre>

<h2 id="custom-scope">Custom scope per route</h2>
<p>Need a different scope dimension (tenant + role)?</p>
<pre><code class="language-typescript">cache: {
  key: 'reports.summary',
  scope: (event) =&gt; {
    const u = getCurrentUser()
    return u ? `${u.tenantId}.${u.role}` : null
  },
}
</code></pre>
'''
))


# --------------------------------------------------------------------------
PAGES.append((
    'recipes/reconnect-realtime.html', 'Reconnect SSE→WS', 'Recipes',
    'recipe realtime reconnect auto-fallback sse websocket cycle-cap',
    '../',
    '''<h1>Recipe: Reconnect SSE→WS auto-fallback</h1>
<p class="lead">SSE-first, with automatic switch to WebSocket after N consecutive failures. Cycle cap prevents infinite reconnection in catastrophic outages.</p>

<h2 id="setup">Setup</h2>
<pre><code class="language-typescript">const broker = createGlueZero({
  realtime: {
    adapter: 'auto',                  // SSE first, fallback to WS
    fallbackThreshold: 3,             // 3 SSE failures → switch to WS
    cycleCap: 10,                     // max 10 full SSE↔WS cycles
    visibilityAware: true,            // pause when tab hidden
  },
  routes: [
    {
      id: 'notifications',
      type: 'realtime-inbound',
      channel: { name: 'notifications', mode: 'auto' },
      url: '/api/realtime/notifications',
      policies: {
        auth: {
          scheme: 'bearer',
          getToken: () =&gt; sessionToken,
        },
      },
      publishes: {
        onMessage: '$frame.topic',
        onConnect: 'system.realtime.connected',
        onDisconnect: 'system.realtime.disconnected',
      },
    },
  ],
})

broker.connectRealtime()
</code></pre>

<h2 id="state-machine">The reconnect state machine</h2>
<ol>
<li>Initial connect → <code>system.realtime.connecting</code> { adapter: 'sse' }</li>
<li>EventSource opens → <code>system.realtime.connected</code></li>
<li>Connection drops → <code>system.realtime.disconnected</code> { reason: 'server-closed' }</li>
<li>Backoff with full jitter → <code>system.realtime.reconnecting</code> { attempt: 1, adapter: 'sse', delayMs: 1240 }</li>
<li>SSE fails 3 times in a row → <code>system.realtime.fallback</code> { from: 'sse', to: 'websocket' }</li>
<li>WebSocket opens → <code>system.realtime.connected</code> { adapter: 'websocket' }</li>
<li>WS also fails 3 times → fallback back to SSE (1 cycle = SSE+WS pair)</li>
<li>10 cycles exhausted → <code>system.realtime.failed</code> { reason: 'cycle-cap-exceeded' } — terminal, manual reconnect required</li>
</ol>

<h2 id="observe">Observe state</h2>
<pre><code class="language-typescript">broker.subscribe('system.realtime.connected', (event) =&gt; {
  console.log('connected via', event.payload.adapter)
  ui.showOnline()
})

broker.subscribe('system.realtime.disconnected', (event) =&gt; {
  console.log('disconnected:', event.payload.reason)
  ui.showOffline()
})

broker.subscribe('system.realtime.reconnecting', (event) =&gt; {
  console.log(`attempt ${event.payload.attempt} via ${event.payload.adapter}, retry in ${event.payload.delayMs}ms`)
})

broker.subscribe('system.realtime.fallback', (event) =&gt; {
  console.warn(`switching from ${event.payload.from} to ${event.payload.to}`)
})

broker.subscribe('system.realtime.failed', (event) =&gt; {
  ui.showFatalError('Realtime unavailable. Please reload.')
})
</code></pre>

<h2 id="manual">Manual reconnect</h2>
<pre><code class="language-typescript">broker.subscribe('system.realtime.failed', () =&gt; {
  ui.showRetryButton(() =&gt; {
    broker.disconnectRealtime()       // ensure clean state
    broker.connectRealtime()          // reset cycle counter
  })
})
</code></pre>

<h2 id="visibility">Visibility behavior</h2>
<p>When the user tabs away (Page Visibility API), the realtime adapter:</p>
<ul>
<li>Stops attempting new reconnections</li>
<li>Holds the existing connection if alive (server may close it on its own)</li>
</ul>
<p>When the tab returns to foreground:</p>
<ul>
<li>Triggers an immediate reconnect attempt (skips backoff)</li>
<li>Resumes from <code>Last-Event-ID</code> on SSE if the server supports it</li>
</ul>
'''
))


# --------------------------------------------------------------------------
PAGES.append((
    'recipes/worker-progress.html', 'Worker progress', 'Recipes',
    'recipe worker progress events background csv parser progress-bar',
    '../',
    '''<h1>Recipe: Worker with progress events</h1>
<p class="lead">Parse a 50 MB CSV in a Web Worker, with throttled progress updates that drive a UI progress bar.</p>

<h2 id="worker-source">Worker source — <code>csv-worker.ts</code></h2>
<pre><code class="language-typescript">import { expose } from '@gluezero/worker'
import { parseCsvLine } from './csv-utils'

expose({
  parseCSV: async (
    fileBuffer: ArrayBuffer,
    signal: AbortSignal,
    onProgress: (p: { value: number; message: string }) =&gt; void
  ) =&gt; {
    const text = new TextDecoder().decode(fileBuffer)
    const lines = text.split('\\n')
    const total = lines.length
    const rows: any[] = []

    for (let i = 0; i &lt; total; i++) {
      if (signal.aborted) throw new Error('cancelled')
      rows.push(parseCsvLine(lines[i]))

      // Progress every 1000 rows. The runtime throttles to 100ms latest-only
      // so even calling it every iteration is safe, just less efficient.
      if (i % 1000 === 0) {
        onProgress({
          value: i / total,
          message: `Processed ${i.toLocaleString()} of ${total.toLocaleString()} rows`,
        })
      }
    }

    return rows
  },
})
</code></pre>

<h2 id="main-thread">Main thread setup</h2>
<pre><code class="language-typescript">const broker = createGlueZero({
  workers: [
    {
      id: 'csv-parser',
      factory: () =&gt; new Worker(
        new URL('./csv-worker.ts', import.meta.url),
        { type: 'module' }
      ),
      tasks: ['parseCSV'],
      poolSize: 2,
    },
  ],
  routes: [
    {
      id: 'parse-csv',
      on: 'csv.parse.requested',
      type: 'worker',
      worker: { id: 'csv-parser', task: 'parseCSV' },
      transferable: ['payload.fileBuffer'],   // zero-copy ArrayBuffer transfer
      publishes: {
        progress: 'csv.parse.progress',
        success: 'csv.parse.completed',
        error: 'csv.parse.failed',
      },
      policies: {
        timeout: { ms: 60_000 },              // 60s for very large files
        concurrency: 'latest-only',           // cancel previous if user re-uploads
      },
    },
  ],
})
</code></pre>

<h2 id="ui">UI integration</h2>
<pre><code class="language-typescript">broker.subscribe('csv.parse.progress', (event) =&gt; {
  progressBar.value = event.payload.value
  progressLabel.textContent = event.payload.message
})

broker.subscribe('csv.parse.completed', (event) =&gt; {
  progressBar.hidden = true
  renderTable(event.payload)
})

broker.subscribe('csv.parse.failed', (event) =&gt; {
  progressBar.hidden = true
  showError(event.payload.message)
})

document.querySelector('#file-input').addEventListener('change', async (e) =&gt; {
  const file = e.target.files[0]
  if (!file) return
  const buffer = await file.arrayBuffer()
  progressBar.hidden = false
  broker.publish('csv.parse.requested', { fileBuffer: buffer, fileName: file.name })
})
</code></pre>

<h2 id="cancel">Cancellation</h2>
<p>Two ways the parsing can be cancelled:</p>
<ul>
<li>User uploads a new file → <code>concurrency: 'latest-only'</code> aborts the previous task</li>
<li>Plugin owning the route is unregistered → cascade cancellation</li>
</ul>
<p>The worker honors the <code>signal</code> at every iteration, so cancellation is fast (within one row of CSV).</p>

<h2 id="transferable">Transferable for zero-copy</h2>
<p>Without <code>transferable</code>, the 50 MB <code>ArrayBuffer</code> is structuredCloned (copied byte-by-byte). With <code>transferable: ['payload.fileBuffer']</code>, ownership is transferred — the main thread loses access (<code>byteLength</code> drops to 0) but the worker gets the buffer for free.</p>
<p>Use this for any large binary: images, audio, video, large CSVs/JSONs.</p>

<h2 id="serialization">Dev-mode serialization checks</h2>
<p>If you accidentally pass a non-cloneable value (function, DOM element, class instance), <code>assertSerializable</code> throws <em>before</em> <code>postMessage</code> is called, with the exact field path:</p>
<pre><code>BrokerError: worker.serialization.failed.function
  fieldPath: 'payload.callback'
  hint: 'Functions cannot cross postMessage boundary. Pass data instead.'
</code></pre>
'''
))


# --------------------------------------------------------------------------
PAGES.append((
    'recipes/debug-flow.html', 'Debug with Inspector', 'Recipes',
    'recipe debug inspector flow event lifecycle 14-step pipeline trace',
    '../',
    '''<h1>Recipe: Debug a broken flow with the Inspector</h1>
<p class="lead">When a value appears wrong in your UI, trace it back through the §28 pipeline. The Inspector shows the full lifecycle of each event.</p>

<h2 id="enable">Enable debug</h2>
<pre><code class="language-typescript">const broker = createGlueZero({
  debug: true,                          // dev mode: full payload capture, deep-freeze
})
</code></pre>
<p>In production, debug is off by default (autodetected via <code>NODE_ENV</code>). You can toggle at runtime:</p>
<pre><code class="language-typescript">broker.enableDebug()
// reproduce the bug
broker.disableDebug()
</code></pre>

<h2 id="capture">Capture the event</h2>
<pre><code class="language-typescript">// Right after the buggy interaction
const events = broker.getEventInspector().getSnapshot({ limit: 50 })
console.table(events.map(e =&gt; ({
  id: e.id,
  topic: e.topic,
  outcome: e.outcome,
  duration: e.pipelineSteps.reduce((s, st) =&gt; s + st.durationMs, 0),
})))
</code></pre>

<h2 id="pipeline">Inspect a single event&rsquo;s pipeline</h2>
<pre><code class="language-typescript">const target = events.find(e =&gt; e.topic === 'weather.loaded')
console.log('Steps:', target.pipelineSteps)
// [
//   { name: 'event.received', durationMs: 0.1 },
//   { name: 'event.metadata.enriched', durationMs: 0.05 },
//   { name: 'event.source.validated', durationMs: 0.3 },
//   { name: 'event.source.mapped', durationMs: 0.4, mapping: { applied: ['città→location'] } },
//   { name: 'event.canonical.validated', durationMs: 0.2 },
//   { name: 'event.dedupe.checked', durationMs: 0.05, deduped: false },
//   { name: 'route.resolved', durationMs: 0.1, routeId: 'weather-fetch' },
//   { name: 'http.request', durationMs: 542, url: '/api/weather?location=Roma&amp;date=2026-05-10' },
//   { name: 'http.response', durationMs: 4, status: 200 },
//   { name: 'event.consumer.mapped', durationMs: 0.3 },
//   { name: 'event.consumer.validated', durationMs: 0.2 },
//   { name: 'event.delivered', durationMs: 0.1, subscribersReached: 2 },
//   { name: 'event.observed', durationMs: 0 },
// ]
</code></pre>
<p>You can immediately see: where time is spent, what mapping was applied, whether validation failed, which route was selected.</p>

<h2 id="mapping">Diagnose mapping bugs</h2>
<pre><code class="language-typescript">const mapping = broker.getMappingInspector().getSnapshot({ limit: 20 })
const wrong = mapping.find(m =&gt; m.errors.length &gt; 0 || m.canonicalPayload.location === undefined)

console.log('Local:', wrong.localPayload)
console.log('Canonical:', wrong.canonicalPayload)
console.log('Transforms applied:', wrong.transformsApplied)
console.log('Errors:', wrong.errors)
</code></pre>
<p>Common findings:</p>
<ul>
<li>An <code>outputMap</code> mapping refers to a transform that wasn&rsquo;t registered</li>
<li>A required canonical field is missing because the local field name doesn&rsquo;t match any alias</li>
<li>A <code>parseDate</code> transform crashed on an unexpected input format</li>
</ul>

<h2 id="routes">Diagnose routing</h2>
<pre><code class="language-typescript">const routes = broker.getRouteInspector().getSnapshot({ limit: 20 })
console.table(routes.map(r =&gt; ({
  routeId: r.routeId,
  topic: r.topic,
  outcome: r.outcome,
  duration: r.durationMs,
  retried: r.strategiesExecuted.filter(s =&gt; s.outcome === 'retry').length,
})))
</code></pre>

<h2 id="metrics">Watch metrics in real-time</h2>
<pre><code class="language-typescript">setInterval(() =&gt; {
  const m = broker.getMetrics()
  console.log('http duration p99:',
    m.histograms['gluezero.gateway.http_duration_ms{route="weather-fetch"}']?.p99)
  console.log('errors:',
    m.counters['gluezero.gateway.http_errors_total{route="weather-fetch"}'])
}, 5000)
</code></pre>

<h2 id="export">Export for analysis</h2>
<pre><code class="language-typescript">// Capture full diagnostic snapshot (deep-cloned)
const snapshot = broker.getDebugSnapshot()
copy(JSON.stringify(snapshot, null, 2))   // Chrome devtools console — copies to clipboard
</code></pre>
<p>Send this to a colleague or paste into a bug report. It&rsquo;s self-contained — no live broker reference, safe to share.</p>
'''
))


# --------------------------------------------------------------------------
PAGES.append((
    'recipes/react-integration.html', 'React integration', 'Recipes',
    'recipe react hook useBroker useGlueZeroEvent integration component',
    '../',
    '''<h1>Recipe: React integration</h1>
<p class="lead">A custom hook <code>useGlueZeroEvent</code> that subscribes to a topic and re-renders when an event arrives. Cleanup on unmount is automatic.</p>

<div class="callout">
GlueZero doesn&rsquo;t ship a React adapter — it&rsquo;s framework-agnostic. The pattern below is ~30 lines you can paste into your project. Equivalents for Vue / Svelte / Solid follow the same shape.
</div>

<h2 id="hook">The hook</h2>
<pre><code class="language-typescript">// hooks/useGlueZeroEvent.ts
import { useEffect, useState } from 'react'
import type { BrokerEvent } from '@gluezero/core'
import { useGlueZero } from './GlueZeroContext'

export function useGlueZeroEvent&lt;T = unknown&gt;(
  topic: string,
  initial: T | null = null
): { event: BrokerEvent&lt;T&gt; | null; payload: T | null } {
  const broker = useGlueZero()
  const [event, setEvent] = useState&lt;BrokerEvent&lt;T&gt; | null&gt;(null)

  useEffect(() =&gt; {
    const sub = broker.subscribe&lt;T&gt;(topic, (e) =&gt; {
      setEvent(e)
    })
    return () =&gt; sub.unsubscribe()
  }, [broker, topic])

  return {
    event,
    payload: event ? (event.payload as T) : initial,
  }
}
</code></pre>

<h2 id="context">Context provider</h2>
<pre><code class="language-typescript">// hooks/GlueZeroContext.tsx
import { createContext, useContext, ReactNode } from 'react'
import { createGlueZero } from '@gluezero/gluezero'
import type { GlueZeroBroker } from '@gluezero/gluezero'

const Ctx = createContext&lt;GlueZeroBroker | null&gt;(null)

const broker = createGlueZero({
  debug: import.meta.env.DEV,
  // ... your config
})

export function GlueZeroProvider({ children }: { children: ReactNode }) {
  return &lt;Ctx.Provider value={broker}&gt;{children}&lt;/Ctx.Provider&gt;
}

export function useGlueZero(): GlueZeroBroker {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useGlueZero must be inside GlueZeroProvider')
  return ctx
}
</code></pre>

<h2 id="usage">Component usage</h2>
<pre><code class="language-tsx">function WeatherWidget() {
  const broker = useGlueZero()
  const { payload: weather } = useGlueZeroEvent&lt;Weather&gt;('weather.loaded')

  function refresh() {
    broker.publish('weather.requested', { location: 'Roma' })
  }

  if (!weather) return &lt;button onClick={refresh}&gt;Load weather&lt;/button&gt;

  return (
    &lt;div&gt;
      &lt;h3&gt;{weather.location}&lt;/h3&gt;
      &lt;p&gt;{weather.temperature_celsius}°C&lt;/p&gt;
      &lt;button onClick={refresh}&gt;Refresh&lt;/button&gt;
    &lt;/div&gt;
  )
}
</code></pre>

<h2 id="register-plugin">Register a plugin tied to a component</h2>
<pre><code class="language-tsx">function FormPlugin() {
  const broker = useGlueZero()

  useEffect(() =&gt; {
    broker.registerPlugin({
      id: 'form-component',
      name: 'Form',
      version: '1.0.0',
      publishes: [{ topic: 'form.submitted' }],
      onMount: (ctx) =&gt; console.log('mounted as', ctx.id),
    })
    return () =&gt; broker.unregisterPlugin('form-component')
    // ↑ cascade cleanup: unsubscribes everything, aborts in-flight HTTP, etc.
  }, [broker])

  return &lt;form onSubmit={(e) =&gt; { e.preventDefault(); broker.publish('form.submitted', getData()) }}&gt;
    {/* ... */}
  &lt;/form&gt;
}
</code></pre>

<h2 id="strict-mode">React StrictMode</h2>
<p>StrictMode mounts components twice in dev. The hook handles this correctly: each mount creates a subscription, each unmount disposes it. There&rsquo;s no leak. The same pattern works for plugins — register on mount, unregister on unmount.</p>

<h2 id="ssr">SSR / Next.js</h2>
<p>GlueZero is browser-only. In SSR-rendered React (Next.js, Remix, Astro), wrap the provider in a check:</p>
<pre><code class="language-tsx">'use client'  // Next.js App Router

export function GlueZeroProvider({ children }) {
  if (typeof window === 'undefined') return &lt;&gt;{children}&lt;/&gt;
  // ... create broker, provide
}
</code></pre>
'''
))
