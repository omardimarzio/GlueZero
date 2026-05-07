#!/usr/bin/env python3
"""
GlueZero docs-site builder.

Genera tutti gli HTML statici da definizioni Python centralizzate.
Zero dipendenze esterne. Output: HTML pronti da deployare su qualsiasi
static host (gluezero.org/docs/).

Run: python3 docs-site/_build.py

Architettura:
- SIDEBAR (struttura nav fissa)
- PAGES (lista di {url, title, section, keywords, html})
- build_page(): wrappa il contenuto nel layout
- search-index.json: generato da PAGES per il search client-side
"""

import json
import os
from pathlib import Path

ROOT = Path(__file__).parent.resolve()
VERSION = "1.0.0"
SITE_URL = "https://gluezero.org"
DOCS_BASE_URL = "https://gluezero.org/docs"
OG_IMAGE = "https://gluezero.org/og-image.png"  # 1200x630, fallback to site root if missing
TWITTER_HANDLE = ""  # set if you have one, e.g. "@gluezero"

# Per-page SEO descriptions (concise, search-result optimized 140-160 chars)
PAGE_DESCRIPTIONS = {
    'index.html': "GlueZero documentation: a TypeScript-first frontend integration runtime that connects modules, plugins, APIs, realtime, workers and cache.",
    'getting-started.html': "Install GlueZero, create your first broker, register a plugin, route an event end-to-end. Five minutes from zero to working app.",
    'concepts/overview.html': "GlueZero mental model: events, routes, canonical mapping, plugin lifecycle, the §28 14-step pipeline, composition wrapper architecture.",
    'concepts/broker.html': "The pub/sub broker: createBroker, topics with wildcards, subscribe/publish, plugin lifecycle, cascade unregister with no leaks.",
    'concepts/canonical-model.html': "Canonical model + bidirectional mapper: shared vocabulary across plugins, alias resolution order, cycle detection at register time.",
    'concepts/routing.html': "Declarative routing: 6 route types (local, http, realtime, worker, cache, composite) with policy chain — timeout, retry, dedupe, auth.",
    'concepts/gateway.html': "HTTP gateway with 11-step strategy chain: auth single-flight, retry on 5xx, dedupe, idempotency keys, URL allowlist, sanitized errors.",
    'concepts/realtime.html': "Realtime inbound: SSE-first with auto-fallback to WebSocket, visibility-aware reconnection, Last-Event-ID resume, app-level ping/pong.",
    'concepts/worker.html': "Web Worker runtime: registry, bounded pool, Comlink RPC bridge, hybrid cancellation, transferable opt-in, dev-mode serialization checks.",
    'concepts/cache.html': "In-memory LRU cache with 3 strategies (cache-first, network-first, cache-then-network) and 3-layer scope hybrid for multi-tenant safety.",
    'concepts/devtools.html': "Devtools: Event/Mapping/Route Inspector, MetricsCollector simil-OpenMetrics with reservoir sampling, PauseController, tap registry.",

    'api/gluezero.html': "createGlueZero(config) API reference: aggregate factory composing all 6 phases, GlueZeroConfig union type, instance methods, feature opt-out.",
    'api/core.html': "@gluezero/core API reference: createBroker, BrokerEvent, PluginDescriptor, subscribe/publish options, error codes, full type signatures.",
    'api/mapper.html': "@gluezero/mapper API reference: createMapperBroker, CanonicalSchema, InputMap/OutputMap, ValidatorAdapter, MappingInspector.",
    'api/routing.html': "@gluezero/routing API reference: createRouterBroker, RouteDefinition union (6 types), RoutePolicies, RouteInspector.",
    'api/gateway.html': "@gluezero/gateway API reference: HTTP gateway + SSE/WebSocket realtime adapters, AuthPolicy single-flight, BackpressurePolicy modes.",
    'api/worker.html': "@gluezero/worker API reference: createWorkerBroker, WorkerDescriptor, expose() inside worker, TaskState, TaskTracker, error codes.",
    'api/cache.html': "@gluezero/cache API reference: CacheAdapter interface, MemoryCacheAdapter, invalidate, scope hybrid configuration.",
    'api/devtools.html': "@gluezero/devtools API reference: EventInspector, MetricsSnapshot with histograms, EventTap interface, MultiplexTap chaining.",

    'recipes/auth-token-refresh.html': "Recipe: configure Bearer auth with single-flight token refresh on 401. Many concurrent 401s trigger only one refresh.",
    'recipes/multi-tenant-cache.html': "Recipe: per-user cache isolation with scopeProvider, fail-secure on missing scope, audit events, logout invalidation.",
    'recipes/reconnect-realtime.html': "Recipe: SSE-first realtime with auto-fallback to WebSocket, full reconnection state machine, cycle cap, visibility-aware.",
    'recipes/worker-progress.html': "Recipe: parse 50MB CSV in a Web Worker with throttled progress events, transferable zero-copy ArrayBuffer, latest-only cancellation.",
    'recipes/debug-flow.html': "Recipe: trace a broken event flow through the §28 14-step pipeline using Event/Mapping/Route Inspector and metrics.",
    'recipes/react-integration.html': "Recipe: React integration with useGlueZeroEvent hook, context provider, plugin tied to component lifecycle, SSR-safe.",

    'decisions.html': "Architectural decisions index: 170 decisions D-01..D-170 across the 6 implementation phases of GlueZero v1.0.",
    'faq.html': "GlueZero FAQ: when to use, when not to use, comparisons with Redux/RxJS/React Query/EventEmitter, bundle size, SSR, TypeScript.",
}

# ==========================================================================
# SIDEBAR STRUCTURE
# ==========================================================================
SIDEBAR = [
    ("Get started", [
        ("Welcome", "index.html"),
        ("Getting started", "getting-started.html"),
    ]),
    ("Concepts", [
        ("Overview", "concepts/overview.html"),
        ("Broker", "concepts/broker.html"),
        ("Canonical model", "concepts/canonical-model.html"),
        ("Routing", "concepts/routing.html"),
        ("HTTP gateway", "concepts/gateway.html"),
        ("Realtime", "concepts/realtime.html"),
        ("Worker", "concepts/worker.html"),
        ("Cache", "concepts/cache.html"),
        ("Devtools", "concepts/devtools.html"),
    ]),
    ("API reference", [
        ("@gluezero/gluezero", "api/gluezero.html"),
        ("@gluezero/core", "api/core.html"),
        ("@gluezero/mapper", "api/mapper.html"),
        ("@gluezero/routing", "api/routing.html"),
        ("@gluezero/gateway", "api/gateway.html"),
        ("@gluezero/worker", "api/worker.html"),
        ("@gluezero/cache", "api/cache.html"),
        ("@gluezero/devtools", "api/devtools.html"),
    ]),
    ("Recipes", [
        ("Auth + token refresh", "recipes/auth-token-refresh.html"),
        ("Multi-tenant cache", "recipes/multi-tenant-cache.html"),
        ("Reconnect SSE→WS", "recipes/reconnect-realtime.html"),
        ("Worker progress", "recipes/worker-progress.html"),
        ("Debug with Inspector", "recipes/debug-flow.html"),
        ("React integration", "recipes/react-integration.html"),
    ]),
    ("Reference", [
        ("Architectural decisions", "decisions.html"),
        ("FAQ", "faq.html"),
    ]),
]


def render_sidebar(rel_base: str) -> str:
    """rel_base es. './' per index, '../' per concepts/*.html"""
    out = ['<nav class="sidebar" aria-label="Documentation navigation">']
    for section_title, items in SIDEBAR:
        out.append('<div class="sidebar-section">')
        out.append(f'  <div class="sidebar-section-title">{section_title}</div>')
        for label, url in items:
            out.append(f'  <a class="sidebar-link" href="{rel_base}{url}">{label}</a>')
        out.append('</div>')
    out.append('</nav>')
    return '\n'.join(out)


def render_topbar(rel_base: str) -> str:
    return f'''<header class="topbar" role="banner">
  <button class="menu-toggle" aria-label="Toggle navigation">☰</button>
  <a class="topbar-brand" href="{rel_base}index.html">
    <span class="topbar-brand-mark">GZ</span>
    <span>GlueZero</span>
    <span class="topbar-version">v{VERSION}</span>
  </a>
  <div class="topbar-search" style="position: relative;">
    <input type="search" placeholder="Search documentation…" autocomplete="off" spellcheck="false">
    <div class="search-results"></div>
  </div>
  <div class="topbar-actions">
    <a class="topbar-link" href="https://gluezero.org" target="_blank" rel="noopener">Site</a>
    <a class="topbar-link" href="https://github.com/omardimarzio/GlueZero" target="_blank" rel="noopener">GitHub</a>
    <a class="topbar-link" href="https://www.npmjs.com/package/@gluezero/gluezero" target="_blank" rel="noopener">npm</a>
    <button class="theme-toggle" aria-label="Toggle theme">🌙</button>
  </div>
</header>'''


def render_footer() -> str:
    return '''<footer class="footer">
  <div>GlueZero v''' + VERSION + ''' — MIT License</div>
  <div>
    <a href="https://gluezero.org">gluezero.org</a> ·
    <a href="https://github.com/omardimarzio/GlueZero">GitHub</a> ·
    <a href="https://www.npmjs.com/package/@gluezero/gluezero">npm</a>
  </div>
</footer>'''


def page_html(title: str, section: str, content: str, rel_base: str, url: str, breadcrumb: str = "") -> str:
    """Wrap content in full HTML doc with full SEO meta."""
    description = PAGE_DESCRIPTIONS.get(url, f"{section} — GlueZero v{VERSION} documentation")
    canonical = f"{DOCS_BASE_URL}/{url}"
    page_title = f"{title} — GlueZero docs" if url != 'index.html' else "GlueZero — frontend integration runtime documentation"

    if not breadcrumb:
        breadcrumb = f'<nav class="breadcrumb" aria-label="Breadcrumb"><a href="{rel_base}index.html">Docs</a> / {section}</nav>'

    # JSON-LD structured data — TechArticle for content pages, WebSite for index
    if url == 'index.html':
        jsonld = {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": "GlueZero documentation",
            "url": DOCS_BASE_URL + "/",
            "description": description,
            "publisher": {"@type": "Organization", "name": "GlueZero", "url": SITE_URL},
            "potentialAction": {
                "@type": "SearchAction",
                "target": {"@type": "EntryPoint", "urlTemplate": f"{DOCS_BASE_URL}/?q={{search_term_string}}"},
                "query-input": "required name=search_term_string",
            },
        }
    else:
        jsonld = {
            "@context": "https://schema.org",
            "@type": "TechArticle",
            "headline": title,
            "description": description,
            "url": canonical,
            "inLanguage": "en",
            "author": {"@type": "Organization", "name": "GlueZero", "url": SITE_URL},
            "publisher": {"@type": "Organization", "name": "GlueZero", "url": SITE_URL},
            "isPartOf": {"@type": "WebSite", "name": "GlueZero documentation", "url": DOCS_BASE_URL + "/"},
            "articleSection": section,
            "keywords": "gluezero, frontend, browser, pub-sub, event-bus, typescript",
        }
    jsonld_str = json.dumps(jsonld, separators=(',', ':'))

    twitter_extra = f'<meta name="twitter:site" content="{TWITTER_HANDLE}">\n' if TWITTER_HANDLE else ''

    return f'''<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{page_title}</title>
<meta name="description" content="{description}">
<meta name="theme-color" content="#6366F1">
<meta name="color-scheme" content="light dark">
<meta name="generator" content="GlueZero docs builder">
<link rel="canonical" href="{canonical}">
<link rel="alternate" hreflang="en" href="{canonical}">
<link rel="alternate" hreflang="x-default" href="{canonical}">

<!-- Open Graph -->
<meta property="og:type" content="article">
<meta property="og:site_name" content="GlueZero">
<meta property="og:title" content="{title} — GlueZero">
<meta property="og:description" content="{description}">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="{OG_IMAGE}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="en_US">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
{twitter_extra}<meta name="twitter:title" content="{title} — GlueZero">
<meta name="twitter:description" content="{description}">
<meta name="twitter:image" content="{OG_IMAGE}">

<link rel="stylesheet" href="{rel_base}assets/styles.css">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='6' fill='%236366F1'/%3E%3Ctext x='12' y='17' text-anchor='middle' fill='white' font-family='sans-serif' font-weight='800' font-size='12'%3EGZ%3C/text%3E%3C/svg%3E">

<script type="application/ld+json">{jsonld_str}</script>
</head>
<body data-base="{rel_base}">
{render_topbar(rel_base)}
{render_sidebar(rel_base)}
<main class="content" role="main">
<div class="content-inner">
{breadcrumb}
{content}
{render_footer()}
</div>
</main>
<script src="{rel_base}assets/docs.js"></script>
</body>
</html>'''


# ==========================================================================
# PAGES — definite in moduli separati per leggibilità
# Vengono importate qui sotto via execfile-style (tutto inline per semplicità)
# ==========================================================================

PAGES = []

def add(url, title, section, keywords, html, rel_base):
    PAGES.append({
        'url': url, 'title': title, 'section': section,
        'keywords': keywords, 'html': html, 'rel_base': rel_base,
    })


# ==========================================================================
# CONTENT — Get started
# ==========================================================================

add(
    'index.html', 'Welcome', 'Get started',
    'gluezero browser frontend integration runtime pub-sub broker',
    rel_base='./',
    html='''<h1>GlueZero documentation</h1>
<p class="lead">A frontend integration runtime for modular browser applications. Connect components, plugins, APIs, realtime events, workers and cache through declarative events and canonical data mapping.</p>

<div class="callout">
<span class="callout-label">v1.0.0</span>This documentation covers GlueZero v1.0.0 (latest). All 8 packages under <code>@gluezero/*</code> are stable, ESM-only, with TypeScript declarations.
</div>

<h2 id="install">Install</h2>
<pre><code class="language-bash">pnpm add @gluezero/gluezero</code></pre>
<p>or selectively, if you only need a subset:</p>
<pre><code class="language-bash">pnpm add @gluezero/core @gluezero/mapper</code></pre>

<h2 id="hello">Hello, GlueZero</h2>
<pre><code class="language-typescript">import { createGlueZero } from '@gluezero/gluezero'

const broker = createGlueZero({ debug: true })

broker.subscribe('weather.loaded', (payload) => {
  console.log('Got weather:', payload)
})

broker.publish('weather.loaded', { city: 'Roma', temp_c: 22 })
</code></pre>

<h2 id="explore">Explore the docs</h2>
<div class="cards">
  <a class="card" href="getting-started.html">
    <div class="card-icon">▶</div>
    <div class="card-title">Getting started</div>
    <div class="card-desc">Install, create your first broker, register a plugin, route an event end-to-end.</div>
  </a>
  <a class="card" href="concepts/overview.html">
    <div class="card-icon">◯</div>
    <div class="card-title">Concepts</div>
    <div class="card-desc">The mental model: events, routes, canonical model, lifecycle, pipeline.</div>
  </a>
  <a class="card" href="api/gluezero.html">
    <div class="card-icon">{ }</div>
    <div class="card-title">API reference</div>
    <div class="card-desc">Type signatures, parameters, return values, examples for every public function.</div>
  </a>
  <a class="card" href="recipes/auth-token-refresh.html">
    <div class="card-icon">▦</div>
    <div class="card-title">Recipes</div>
    <div class="card-desc">Practical patterns: auth, multi-tenant cache, realtime reconnect, worker progress.</div>
  </a>
  <a class="card" href="decisions.html">
    <div class="card-icon">⚙</div>
    <div class="card-title">Architectural decisions</div>
    <div class="card-desc">170 indexed decisions explaining the &ldquo;why&rdquo; behind every design choice.</div>
  </a>
  <a class="card" href="faq.html">
    <div class="card-icon">?</div>
    <div class="card-title">FAQ</div>
    <div class="card-desc">When to use GlueZero, comparisons with Redux/RxJS/React Query, common pitfalls.</div>
  </a>
</div>

<h2 id="philosophy">Why GlueZero</h2>
<p>Modern frontend applications are no longer just trees of UI components. They&rsquo;re ecosystems of independent components, third-party plugins, dashboard widgets, backend APIs, realtime channels, cache layers, background workers, low-code modules and customer-specific customizations.</p>
<p>As this ecosystem grows, <strong>integration becomes the real problem</strong>. Without a governed integration layer, teams end up with components calling each other directly, scattered <code>fetch()</code> calls, custom adapters between every pair of modules, duplicated retry/timeout/error logic, plugin field names that don&rsquo;t match, and no clear way to inspect what happened when data moved across the app.</p>
<p>GlueZero introduces a controlled event layer inside the browser. Components and plugins declare what they publish and consume; GlueZero handles routing, canonical mapping, server communication, worker delegation, cache policies, validation and observability.</p>

<div class="callout success">
<strong>Not a framework. Not a state manager. Not just an event emitter.</strong> A frontend integration runtime, designed to live alongside React/Vue/Svelte and tools like Redux/RxJS/React Query.
</div>

<h2 id="packages">The 8 packages</h2>
<table>
<thead><tr><th>Package</th><th>Role</th><th>Bundle (gz)</th></tr></thead>
<tbody>
<tr><td><a href="api/core.html"><code>@gluezero/core</code></a></td><td>Pub/sub broker, plugin registry, EventTap</td><td>~6 KB</td></tr>
<tr><td><a href="api/mapper.html"><code>@gluezero/mapper</code></a></td><td>Canonical model + bidirectional mapper</td><td>~12 KB</td></tr>
<tr><td><a href="api/routing.html"><code>@gluezero/routing</code></a></td><td>Declarative routing engine</td><td>~19 KB</td></tr>
<tr><td><a href="api/gateway.html"><code>@gluezero/gateway</code></a></td><td>HTTP gateway + SSE/WS realtime</td><td>~6 KB (HTTP)</td></tr>
<tr><td><a href="api/worker.html"><code>@gluezero/worker</code></a></td><td>Worker registry + pool + bridge</td><td>~26 KB</td></tr>
<tr><td><a href="api/cache.html"><code>@gluezero/cache</code></a></td><td>LRU cache + 3 strategies</td><td>~22 KB</td></tr>
<tr><td><a href="api/devtools.html"><code>@gluezero/devtools</code></a></td><td>Inspector + Metrics + PauseController</td><td>~22 KB</td></tr>
<tr><td><a href="api/gluezero.html"><code>@gluezero/gluezero</code></a></td><td>Aggregate <code>createGlueZero()</code> factory</td><td>~35 KB</td></tr>
</tbody>
</table>
'''
)


# ==========================================================================
# Stub remaining pages (will be filled in batch 2/3/4)
# ==========================================================================

STUB_PAGES = [
    # Get started
    ('getting-started.html', 'Getting started', 'Get started', 'install npm pnpm tutorial first event', './'),

    # Concepts
    ('concepts/overview.html', 'Overview', 'Concepts', 'concepts mental model events routes pipeline', '../'),
    ('concepts/broker.html', 'Broker', 'Concepts', 'broker pub-sub topics wildcards subscribe publish', '../'),
    ('concepts/canonical-model.html', 'Canonical model', 'Concepts', 'canonical model alias mapper plugin field translation', '../'),
    ('concepts/routing.html', 'Routing', 'Concepts', 'routing route types local http realtime worker cache composite', '../'),
    ('concepts/gateway.html', 'HTTP gateway', 'Concepts', 'gateway http policy retry timeout dedupe auth', '../'),
    ('concepts/realtime.html', 'Realtime', 'Concepts', 'realtime sse websocket reconnect auto-fallback ping', '../'),
    ('concepts/worker.html', 'Worker', 'Concepts', 'worker web-worker comlink pool registry cancellation', '../'),
    ('concepts/cache.html', 'Cache', 'Concepts', 'cache lru ttl scope strategy cache-first network-first', '../'),
    ('concepts/devtools.html', 'Devtools', 'Concepts', 'devtools inspector metrics pause-controller debug', '../'),

    # API reference
    ('api/gluezero.html', '@gluezero/gluezero', 'API reference', 'api gluezero aggregate createGlueZero factory chain', '../'),
    ('api/core.html', '@gluezero/core', 'API reference', 'api core broker subscribe publish createBroker', '../'),
    ('api/mapper.html', '@gluezero/mapper', 'API reference', 'api mapper canonical alias transform', '../'),
    ('api/routing.html', '@gluezero/routing', 'API reference', 'api routing route registerRoute resolver', '../'),
    ('api/gateway.html', '@gluezero/gateway', 'API reference', 'api gateway http sse websocket strategy', '../'),
    ('api/worker.html', '@gluezero/worker', 'API reference', 'api worker registerWorker pool bridge', '../'),
    ('api/cache.html', '@gluezero/cache', 'API reference', 'api cache adapter lru memory strategies', '../'),
    ('api/devtools.html', '@gluezero/devtools', 'API reference', 'api devtools inspector metrics pause', '../'),

    # Recipes
    ('recipes/auth-token-refresh.html', 'Auth + token refresh', 'Recipes', 'recipe auth bearer token refresh single-flight', '../'),
    ('recipes/multi-tenant-cache.html', 'Multi-tenant cache', 'Recipes', 'recipe cache scope multi-tenant fail-secure', '../'),
    ('recipes/reconnect-realtime.html', 'Reconnect SSE→WS', 'Recipes', 'recipe realtime reconnect auto-fallback', '../'),
    ('recipes/worker-progress.html', 'Worker progress', 'Recipes', 'recipe worker progress events background job', '../'),
    ('recipes/debug-flow.html', 'Debug with Inspector', 'Recipes', 'recipe debug inspector flow event lifecycle', '../'),
    ('recipes/react-integration.html', 'React integration', 'Recipes', 'recipe react hook useBroker integration', '../'),

    # Reference
    ('decisions.html', 'Architectural decisions', 'Reference', 'decisions architectural design rationale 170 indexed', './'),
    ('faq.html', 'FAQ', 'Reference', 'faq questions answers comparison redux rxjs', './'),
]

for url, title, section, keywords, rel_base in STUB_PAGES:
    add(
        url, title, section, keywords, rel_base=rel_base,
        html=f'<h1>{title}</h1>\n<p class="lead">This page is under construction. Check back shortly for the full content.</p>\n<p><a href="{rel_base}index.html">← Back to docs home</a></p>'
    )


# ==========================================================================
# IMPORT CONTENT MODULES (overrides stubs with real content)
# ==========================================================================

import importlib.util
CONTENT_DIR = ROOT / "_content"
if CONTENT_DIR.exists():
    for py_file in sorted(CONTENT_DIR.glob("*.py")):
        spec = importlib.util.spec_from_file_location(py_file.stem, py_file)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        if hasattr(module, "PAGES"):
            # Content files use tuple shape: (url, title, section, keywords, rel_base, html)
            for url, title, section, keywords, rel_base, html in module.PAGES:
                # Replace existing stub or add new
                existing_idx = None
                for i, p in enumerate(PAGES):
                    if p['url'] == url:
                        existing_idx = i
                        break
                entry = {
                    'url': url, 'title': title, 'section': section,
                    'keywords': keywords, 'html': html, 'rel_base': rel_base,
                }
                if existing_idx is not None:
                    PAGES[existing_idx] = entry
                else:
                    PAGES.append(entry)


# ==========================================================================
# WRITE OUTPUT
# ==========================================================================

def main():
    os.makedirs(ROOT / 'concepts', exist_ok=True)
    os.makedirs(ROOT / 'api', exist_ok=True)
    os.makedirs(ROOT / 'recipes', exist_ok=True)

    for p in PAGES:
        out_path = ROOT / p['url']
        out_path.parent.mkdir(parents=True, exist_ok=True)
        full_html = page_html(
            title=p['title'],
            section=p['section'],
            content=p['html'],
            rel_base=p['rel_base'],
            url=p['url'],
        )
        out_path.write_text(full_html, encoding='utf-8')
        print(f"  ✓ {p['url']}")

    # Search index — simplified entries
    index = []
    for p in PAGES:
        index.append({
            'title': p['title'],
            'section': p['section'],
            'keywords': p['keywords'],
            'url': p['url'],
        })
    (ROOT / 'search-index.json').write_text(json.dumps(index, indent=2), encoding='utf-8')
    print(f"  ✓ search-index.json ({len(index)} entries)")

    # robots.txt — allow all, point to sitemap
    robots_txt = f"""# GlueZero documentation — robots
User-agent: *
Allow: /

Sitemap: {DOCS_BASE_URL}/sitemap.xml
"""
    (ROOT / 'robots.txt').write_text(robots_txt, encoding='utf-8')
    print(f"  ✓ robots.txt")

    # sitemap.xml — full URL set with lastmod and priority
    from datetime import datetime, timezone
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    priority_map = {
        'index.html': '1.0',
        'getting-started.html': '0.9',
    }
    sitemap_lines = ['<?xml version="1.0" encoding="UTF-8"?>']
    sitemap_lines.append('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    for p in PAGES:
        url = p['url']
        loc = f"{DOCS_BASE_URL}/{url}"
        priority = priority_map.get(url, '0.7' if url.startswith('concepts/') else '0.6')
        changefreq = 'monthly' if url == 'index.html' else 'quarterly'
        sitemap_lines.append('  <url>')
        sitemap_lines.append(f'    <loc>{loc}</loc>')
        sitemap_lines.append(f'    <lastmod>{today}</lastmod>')
        sitemap_lines.append(f'    <changefreq>{changefreq}</changefreq>')
        sitemap_lines.append(f'    <priority>{priority}</priority>')
        sitemap_lines.append('  </url>')
    sitemap_lines.append('</urlset>')
    (ROOT / 'sitemap.xml').write_text('\n'.join(sitemap_lines), encoding='utf-8')
    print(f"  ✓ sitemap.xml ({len(PAGES)} URLs)")

    # OG image placeholder (1200x630 SVG → PNG would need ImageMagick; SVG works for og:image fallback)
    og_svg = '''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6366F1"/>
      <stop offset="100%" stop-color="#4F46E5"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <rect x="500" y="200" width="200" height="200" rx="40" fill="white" fill-opacity="0.1"/>
  <text x="600" y="335" text-anchor="middle" fill="white" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-weight="900" font-size="100">GZ</text>
  <text x="600" y="475" text-anchor="middle" fill="white" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-weight="800" font-size="72">GlueZero</text>
  <text x="600" y="525" text-anchor="middle" fill="white" fill-opacity="0.85" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-weight="500" font-size="28">Frontend integration runtime · v''' + VERSION + '''</text>
</svg>'''
    (ROOT / 'assets' / 'og-image.svg').write_text(og_svg, encoding='utf-8')
    print(f"  ✓ assets/og-image.svg (placeholder — convert to og-image.png for production)")

    print(f"\n  Built {len(PAGES)} pages + sitemap + robots in {ROOT}")


if __name__ == '__main__':
    main()
