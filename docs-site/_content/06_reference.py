# Reference: decisions.html (generato da DECISIONS.md) + faq.html
import re
from pathlib import Path

PAGES = []


def md_table_to_html(md_text: str) -> str:
    """Convert markdown tables, headings, lists, code, bold, italic, links to HTML."""
    lines = md_text.split('\n')
    out = []
    i = 0
    in_table = False
    in_code = False
    code_lang = ''
    while i < len(lines):
        line = lines[i]
        # Code fence
        if line.startswith('```'):
            if in_code:
                out.append('</code></pre>')
                in_code = False
            else:
                code_lang = line[3:].strip()
                out.append(f'<pre><code class="language-{code_lang}">')
                in_code = True
            i += 1
            continue
        if in_code:
            out.append(line.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'))
            i += 1
            continue
        # Tables
        if line.startswith('|') and i + 1 < len(lines) and re.match(r'^\|[\s\-|:]+\|', lines[i + 1]):
            cells = [c.strip() for c in line.strip('|').split('|')]
            out.append('<table>')
            out.append('<thead><tr>' + ''.join(f'<th>{format_inline(c)}</th>' for c in cells) + '</tr></thead>')
            i += 2
            out.append('<tbody>')
            while i < len(lines) and lines[i].startswith('|'):
                row_cells = [c.strip() for c in lines[i].strip('|').split('|')]
                out.append('<tr>' + ''.join(f'<td>{format_inline(c)}</td>' for c in row_cells) + '</tr>')
                i += 1
            out.append('</tbody></table>')
            continue
        # Heading
        h = re.match(r'^(#{1,6})\s+(.*)', line)
        if h:
            level = len(h.group(1))
            text = h.group(2)
            slug = re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')
            out.append(f'<h{level} id="{slug}">{format_inline(text)}</h{level}>')
            i += 1
            continue
        # HR
        if line.strip() == '---':
            out.append('<hr>')
            i += 1
            continue
        # Quote
        if line.startswith('>'):
            content = line[1:].strip()
            out.append(f'<blockquote class="callout">{format_inline(content)}</blockquote>')
            i += 1
            continue
        # List
        m_li = re.match(r'^(\s*)[-*+]\s+(.*)', line)
        if m_li:
            indent = len(m_li.group(1))
            content = m_li.group(2)
            # Simplification: not nesting, just one level
            if not (out and out[-1].endswith('</li>') or out and out[-1] == '<ul>'):
                out.append('<ul>')
            out.append(f'<li>{format_inline(content)}</li>')
            # Look ahead: if next is not list, close
            if i + 1 >= len(lines) or not re.match(r'^(\s*)[-*+]\s', lines[i + 1] if i + 1 < len(lines) else ''):
                out.append('</ul>')
            i += 1
            continue
        # Empty
        if line.strip() == '':
            out.append('')
            i += 1
            continue
        # Paragraph
        out.append(f'<p>{format_inline(line)}</p>')
        i += 1
    return '\n'.join(out)


def format_inline(text: str) -> str:
    # Code spans: `code`
    text = re.sub(r'`([^`]+)`', r'<code>\1</code>', text)
    # Bold: **bold**
    text = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', text)
    # Italic: *italic*
    text = re.sub(r'(?<!\*)\*([^*\s][^*]*[^*\s])\*(?!\*)', r'<em>\1</em>', text)
    # Links: [text](url)
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', text)
    return text


# Read DECISIONS.md and convert
ROOT = Path(__file__).parent.parent.parent
decisions_md = (ROOT / 'DECISIONS.md').read_text()

# Strip frontmatter
fm = re.match(r'^---\n.*?\n---\n', decisions_md, re.DOTALL)
if fm:
    decisions_md = decisions_md[fm.end():]

decisions_html = md_table_to_html(decisions_md)

PAGES.append((
    'decisions.html', 'Architectural decisions', 'Reference',
    'decisions architectural design rationale 170 indexed phases REQ-IDs PRD',
    './',
    f'''<h1>Architectural decisions</h1>
<p class="lead">170 architectural decisions accumulated across the 6 implementation phases. Each decision has a unique ID (D-XX) and is referenced from the codebase JSDoc, READMEs, and other docs pages.</p>

<div class="callout">
<span class="callout-label">How to read this</span>
Decisions are interpretations of v1 design requirements. They&rsquo;re not aspirational — every D-XX is reflected in the actual code. When you see a comment like <code>// D-83 strict carryover</code> in a source file, this is the index that explains what that decision means.
</div>

{decisions_html}
'''
))


# --------------------------------------------------------------------------
# FAQ
# --------------------------------------------------------------------------
PAGES.append((
    'faq.html', 'FAQ', 'Reference',
    'faq questions answers comparison redux rxjs react-query when not when use sse-pulled',
    './',
    '''<h1>FAQ</h1>
<p class="lead">Common questions and tradeoffs. Comparisons with adjacent tools.</p>

<h2 id="when">When should I use GlueZero</h2>
<p>If you&rsquo;re building any of these, GlueZero is probably a fit:</p>
<ul>
<li>Modular SaaS dashboards with many components exchanging data</li>
<li>ERP/CRM frontends with mixed plugin authors</li>
<li>Plugin-based applications (extensions, marketplaces)</li>
<li>Low-code or no-code builders</li>
<li>Micro-frontend platforms</li>
<li>Complex admin panels with multiple backends</li>
<li>Apps with realtime events + background processing + caching all coordinated</li>
<li>Systems where third-party modules must interoperate without naming alignment</li>
</ul>

<h2 id="when-not">When NOT to use GlueZero</h2>
<ul>
<li>Small apps with tightly controlled components</li>
<li>You don&rsquo;t have plugin interoperability problems</li>
<li>You don&rsquo;t need canonical data mapping</li>
<li>You don&rsquo;t need route-driven server communication</li>
<li>Your existing solution (React Query, etc.) already covers your needs</li>
</ul>
<p>GlueZero is designed for frontend complexity that has crossed from &ldquo;component state&rdquo; to &ldquo;application ecosystem&rdquo;. If you&rsquo;re still in component-state territory, the cost-benefit doesn&rsquo;t favor adoption.</p>

<h2 id="vs-redux">vs Redux</h2>
<p>Redux is a state container. GlueZero is an event coordinator. They solve different problems and can coexist:</p>
<ul>
<li>Redux: predictable global state for UI rendering</li>
<li>GlueZero: coordinated event flow between modules / plugins / APIs / workers / cache</li>
</ul>
<p>Use Redux for &ldquo;what should the UI render right now&rdquo;. Use GlueZero for &ldquo;when X happens, do Y, then publish Z&rdquo;.</p>

<h2 id="vs-rxjs">vs RxJS</h2>
<p>RxJS is reactive streams as a primitive. GlueZero is a higher-level integration runtime that uses similar concepts but adds canonical mapping, declarative routes, plugin lifecycle, and cascade cleanup as first-class. RxJS gives you the LEGO bricks; GlueZero gives you a ready-to-use kitchen.</p>
<p>You can implement most of GlueZero on top of RxJS. The reason GlueZero exists is to bake in the patterns (route-driven gateway, canonical mapping, cascade cleanup) so multiple teams agree on them automatically.</p>

<h2 id="vs-react-query">vs React Query / TanStack Query</h2>
<p>React Query is excellent at server state, caching, and request lifecycle for HTTP. GlueZero overlaps in HTTP routing but extends to:</p>
<ul>
<li>Plugin interoperability via canonical mapping (out of scope for React Query)</li>
<li>Web Worker delegation</li>
<li>Realtime SSE/WS</li>
<li>Cross-feature event flows beyond data fetching</li>
</ul>
<p>If your only need is HTTP fetch + cache, React Query is more focused. If you need to coordinate workers, realtime, and plugins together, GlueZero gives you one runtime instead of glue code between three.</p>

<h2 id="vs-eventemitter">vs EventEmitter / mitt</h2>
<p>Both are pub/sub primitives. GlueZero adds:</p>
<ul>
<li>Wildcard pattern matching (segmented trie, O(segments))</li>
<li>Plugin lifecycle and cascade cleanup (no leaks)</li>
<li>Async-by-default delivery (FIFO, no re-entrancy)</li>
<li>Routing engine (events become declarative actions)</li>
<li>Canonical mapping</li>
<li>Observability (Inspector, Metrics)</li>
</ul>
<p>If you just need topic-based pub/sub for a small app, mitt (~200 bytes) is the right tool. If you need any of the above, you&rsquo;d eventually re-implement them on top of mitt — at which point GlueZero is the cheaper option.</p>

<h2 id="bundle">What&rsquo;s the bundle size?</h2>
<p>For the aggregate <code>@gluezero/gluezero</code>: ~35 KB gzipped. For just <code>@gluezero/core</code>: ~6 KB gzipped. Each sub-package is tree-shakable and can be installed independently — you don&rsquo;t pay for what you don&rsquo;t use.</p>
<p>Bundle is dominated by:</p>
<ul>
<li><code>@gluezero/worker</code>: ~26 KB (includes Comlink + serialization runtime)</li>
<li><code>@gluezero/cache</code>: ~22 KB (LRU adapter + 3 strategies + scope hybrid)</li>
<li><code>@gluezero/devtools</code>: ~22 KB (Inspector + Metrics + reservoir + cardinality cap)</li>
</ul>

<h2 id="server">Can I use it on the server?</h2>
<p>No. GlueZero targets the browser only. No Node.js APIs are referenced; the design assumes a browser runtime (DOM, Web Workers, EventSource, WebSocket, IndexedDB-eligible). For server-side event-driven, look at NATS, Kafka, or domain-specific tools.</p>

<h2 id="frameworks">Does it work with React / Vue / Svelte / Angular?</h2>
<p>Yes — with all of them. GlueZero is framework-agnostic. The integration pattern is always the same: create one broker per app (in a context provider), expose it to components via a hook/composable/store, subscribe to topics in the relevant components. See <a href="recipes/react-integration.html">React integration recipe</a> for an example.</p>

<h2 id="ssr">Server-side rendering (Next.js, Nuxt, SvelteKit)?</h2>
<p>The broker should only run client-side. Wrap the provider in a check or use the <code>'use client'</code> directive (Next.js App Router). The library will throw on accidental SSR (it tries to access <code>window</code> early, which fails clearly).</p>

<h2 id="ts">Is TypeScript required?</h2>
<p>No. The library is TypeScript-first (declarations included), but the JavaScript output is plain ESM. You can use it from <code>.js</code> files. You lose autocompletion on <code>BrokerEvent.payload</code> generics, but everything works at runtime.</p>

<h2 id="versioning">Versioning</h2>
<p>SemVer. The 8 packages are released together with the same major.minor.patch. Inter-package deps use <code>workspace:*</code> in source and resolve to <code>^X.Y.Z</code> at publish time (Changesets does this automatically).</p>

<h2 id="prod-debug">Should I leave debug on in production?</h2>
<p>No. <code>debug: true</code> enables deep-freeze checks, full payload capture in the Inspector, and verbose taps. In production, leave it off (the default when <code>NODE_ENV === 'production'</code>) for performance.</p>

<h2 id="custom-cache">Can I use IndexedDB instead of MemoryCache?</h2>
<p>Yes — implement <code>CacheAdapter</code> and pass it via <code>cache.adapter</code>. A <code>@gluezero/cache-idb</code> package is on the V1.x roadmap. Until then, write a thin adapter (~50 lines) using the IndexedDB API.</p>

<h2 id="open-issues">What about PRD §39 #11?</h2>
<p>The cross-phase pipeline ordering opt-in is the only PRD §39 issue not closed in v1.0. It&rsquo;s deferred V1.x — the rationale: real-world consumers haven&rsquo;t emerged that need it, and shipping it speculatively risks API churn. When a concrete need surfaces, a v1.x release will add the opt-in.</p>

<h2 id="contribute">How do I contribute?</h2>
<p>Read <a href="https://github.com/omardimarzio/GlueZero/blob/main/CONTRIBUTING.md">CONTRIBUTING.md</a> on GitHub. Short version: read <a href="decisions.html">DECISIONS.md</a>, pick an existing decision before introducing a new pattern, run <code>pnpm typecheck &amp;&amp; pnpm test &amp;&amp; pnpm build</code> locally, generate a Changeset for user-visible changes, open a PR.</p>
'''
))
