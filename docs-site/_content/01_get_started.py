# Content for Get Started section.
# Each entry: (url, title, section, keywords, html, rel_base)

PAGES = []

# --------------------------------------------------------------------------
# getting-started.html
# --------------------------------------------------------------------------

PAGES.append((
    'getting-started.html', 'Getting started', 'Get started',
    'install npm pnpm tutorial first event hello world weather',
    './',
    '''<h1>Getting started</h1>
<p class="lead">Install GlueZero, create your first broker, register a plugin, route an event end-to-end. Five minutes.</p>

<h2 id="install">1. Install</h2>
<p>The aggregate package <code>@gluezero/gluezero</code> re-exports everything from the eight sub-packages and gives you the <code>createGlueZero()</code> factory.</p>
<pre><code class="language-bash">pnpm add @gluezero/gluezero
# or: npm install @gluezero/gluezero
# or: yarn add @gluezero/gluezero</code></pre>
<p>Prefer to install only what you use? The eight packages are independent:</p>
<pre><code class="language-bash">pnpm add @gluezero/core @gluezero/mapper</code></pre>
<div class="callout">
<span class="callout-label">Browser-only</span>GlueZero targets evergreen browsers (ES2022, ESM-only). It is not designed for Node.js server-side use.
</div>

<h2 id="hello">2. Hello world</h2>
<p>The minimum working example: subscribe to a topic, publish an event, observe delivery.</p>
<pre><code class="language-typescript">import { createGlueZero } from '@gluezero/gluezero'

const broker = createGlueZero({ debug: true })

broker.subscribe('greeting.received', (event) => {
  console.log('subscriber got:', event.payload)
})

broker.publish('greeting.received', { message: 'Hello, GlueZero' })
// → console: subscriber got: { message: 'Hello, GlueZero' }
</code></pre>
<p><code>publish</code> is non-blocking: delivery happens via <code>queueMicrotask</code> so you can publish from inside subscribers without blowing the stack.</p>

<h2 id="plugin">3. Register a plugin</h2>
<p>Plugins are reusable units of behavior with their own lifecycle. They declare what they publish, what they subscribe to, and how their local field names map to the canonical model.</p>
<pre><code class="language-typescript">broker.registerPlugin({
  id: 'weather-form',
  name: 'Weather form',
  version: '1.0.0',
  publishes: [{ topic: 'weather.requested' }],
  subscribes: [{ topic: 'weather.loaded' }],
  handlers: {
    'weather.loaded': (event) => {
      renderForecast(event.payload)
    },
  },
  onMount: (ctx) => {
    console.log('weather-form mounted as', ctx.id)
  },
})
</code></pre>
<p><strong>Lifecycle is automatic:</strong> when you call <code>broker.unregisterPlugin('weather-form')</code>, every subscription registered through this plugin is removed in cascade — no leaks. This is the LIFE-02 contract (decision <code>D-26</code>) and is enforced across all 8 packages.</p>

<h2 id="canonical">4. Canonical mapping (multi-plugin interop)</h2>
<p>The real value emerges when two plugins use different field names for the same concept. With canonical mapping, each plugin maps locally to a shared vocabulary.</p>
<pre><code class="language-typescript">const broker = createGlueZero({
  canonicalModel: {
    schemas: [{
      id: 'weather.canonical',
      fields: {
        location: { type: 'string' },
        forecast_date: { type: 'string' },
        temperature_celsius: { type: 'number' },
      },
    }],
  },
  aliasRegistry: {
    global: {
      // automatic aliases (any plugin can use these)
      città: 'location',
      data: 'forecast_date',
      temp: 'temperature_celsius',
    },
  },
})

// Italian-naming plugin
broker.registerPlugin({
  id: 'italian-form',
  publishes: [{ topic: 'weather.requested' }],
  outputMap: {
    città: { to: 'location' },
    data: { to: 'forecast_date' },
  },
})

// English-naming consumer
broker.registerPlugin({
  id: 'english-widget',
  subscribes: [{ topic: 'weather.loaded' }],
  inputMap: {
    location: 'location',
    'forecast-date': 'forecast_date',
    temperature: 'temperature_celsius',
  },
  handlers: {
    'weather.loaded': (event) => {
      // event.payload is { location, 'forecast-date', temperature }
      // normalized from the canonical { location, forecast_date, temperature_celsius }
    },
  },
})
</code></pre>

<h2 id="route">5. Add an HTTP route</h2>
<p>Routes describe what should happen when a topic is published. The classic pattern: a topic <code>X.requested</code> triggers an HTTP call that publishes back <code>X.loaded</code> on success or <code>X.failed</code> on error.</p>
<pre><code class="language-typescript">broker.registerRoute({
  id: 'weather-fetch',
  on: 'weather.requested',
  type: 'http',
  request: {
    method: 'GET',
    url: '/api/weather',
    queryMap: {
      location: 'location',
      forecast_date: 'date',
    },
  },
  publishes: {
    success: 'weather.loaded',
    error: 'weather.failed',
  },
  policies: {
    timeout: { ms: 5000 },
    retry: { attempts: 2, on: ['5xx', 'network'] },
    dedupe: { window: 'inflight' },
  },
})

broker.publish('weather.requested', { città: 'Roma', data: '2026-05-10' })
// → mapper translates to canonical
// → route fires GET /api/weather?location=Roma&amp;date=2026-05-10
// → response published as 'weather.loaded'
// → english-widget receives mapped payload
</code></pre>
<p>Components that subscribe to <code>weather.loaded</code> never know about HTTP, retry, mapping, deduplication. They just receive the event when it&rsquo;s ready.</p>

<h2 id="next">Next steps</h2>
<div class="cards">
  <a class="card" href="concepts/overview.html">
    <div class="card-icon">◯</div>
    <div class="card-title">The mental model</div>
    <div class="card-desc">Events, routes, canonical model, lifecycle, pipeline — how the parts fit together.</div>
  </a>
  <a class="card" href="recipes/auth-token-refresh.html">
    <div class="card-icon">▦</div>
    <div class="card-title">Recipes</div>
    <div class="card-desc">Auth + token refresh, multi-tenant cache, realtime reconnect, worker progress.</div>
  </a>
  <a class="card" href="api/gluezero.html">
    <div class="card-icon">{ }</div>
    <div class="card-title">API reference</div>
    <div class="card-desc">Type signatures and full options for every public function.</div>
  </a>
</div>
'''
))
