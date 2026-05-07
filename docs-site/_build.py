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


def page_html(title: str, section: str, content: str, rel_base: str, breadcrumb: str = "") -> str:
    """Wrap content in full HTML doc."""
    description = f"{section} — GlueZero v{VERSION} documentation"
    if not breadcrumb:
        breadcrumb = f'<nav class="breadcrumb" aria-label="Breadcrumb"><a href="{rel_base}index.html">Docs</a> / {section}</nav>'
    return f'''<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} — GlueZero docs</title>
<meta name="description" content="{description}">
<link rel="stylesheet" href="{rel_base}assets/styles.css">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='6' fill='%236366F1'/%3E%3Ctext x='12' y='17' text-anchor='middle' fill='white' font-family='sans-serif' font-weight='800' font-size='12'%3EGZ%3C/text%3E%3C/svg%3E">
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
    print(f"\n  ✓ search-index.json ({len(index)} entries)")
    print(f"\n  Built {len(PAGES)} pages in {ROOT}")


if __name__ == '__main__':
    main()
