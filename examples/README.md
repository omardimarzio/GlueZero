# GlueZero examples

Standalone HTML files that import GlueZero from a CDN (`esm.sh`) and demonstrate live functionality. **No build step, no dependencies, no toolchain.** Open the HTML files in a browser and they work.

## Available examples

| Example | What it demonstrates |
|---------|----------------------|
| [`showcase/`](./showcase/index.html) ⭐ | **v1.1** — **Live Showcase** with sidebar menu + 7 interactive demos: pub/sub broker, canonical mapping, routing+gateway (real fetch), worker runtime, cache layer, observability, theme. Each demo has live UI + salient code snippets. The most complete tour. |
| [`pub-sub-demo.html`](./pub-sub-demo.html) | One publisher, four subscribers reacting independently to the same topic. Pure broker pub/sub between DOM components on the same page. Zero network. Now extended (v1.1) with a live theme switcher (light/dark + brand swap) using `data-gz-role`. |
| [`theme-tokens-only/`](./theme-tokens-only/index.html) | **v1.1** — Pure design tokens runtime override via `applyTokens()` and `--gz-*` CSS Custom Properties. Brand swap on the same DOM, zero adapter. |
| [`theme-dark-mode-meteo/`](./theme-dark-mode-meteo/index.html) | **v1.1** — Anti-FOUC dark mode with `getInitialThemeScript()` IIFE pre-paint + `prefers-color-scheme` auto-mirror via `matchMedia`. Full meteo plugin scenario F1 → F7. |
| [`theme-tailwind/`](./theme-tailwind/index.html) | **v1.1** — Theme adapter swap with the same canonical markup (`data-gz-role`) — Tailwind utility classes vs. custom stylesheet, intercambiabile a runtime. |

## How they work

Each example imports GlueZero directly via [`esm.sh`](https://esm.sh):

```html
<script type="module">
  import { createGlueZero } from 'https://esm.sh/@gluezero/gluezero@1.1.0'
  const broker = createGlueZero({ /* ... */ })
</script>
```

`esm.sh` resolves the package and all its dependencies (`@gluezero/core`, `@gluezero/mapper`, ..., plus `valibot`, `nanoid`, `comlink`) into native ESM that the browser loads directly. No bundling, no transpilation.

## Running locally

The simplest way:

```bash
# Open directly in the browser
open examples/pub-sub-demo.html

# Or via a local static server (avoids potential CORS issues with file://)
python3 -m http.server 8080 --directory examples
# then visit http://localhost:8080/pub-sub-demo.html
```

## Hosting on gluezero.org

These files are designed to be hosted under `gluezero.org/examples/` (or anywhere). They&rsquo;re fully self-contained — copy the HTML and you&rsquo;re done. No build pipeline needed.

## Building your own example

Start from the structure of `pub-sub-demo.html`:

1. Single HTML file
2. `<script type="module">` block at the bottom
3. `import { createGlueZero } from 'https://esm.sh/@gluezero/gluezero@1.1.0'`
4. Build your broker, plugins, routes
5. Wire UI events to broker.publish, render data on broker.subscribe

For real production code, install via npm and bundle with your tool of choice — but for examples, demos, prototypes, and tutorials, the CDN approach is hard to beat.

## See also

- [docs](https://gluezero.org/docs) — full documentation
- [Getting started](https://gluezero.org/docs/getting-started.html)
- [API reference](https://gluezero.org/docs/api/gluezero.html)
- [Recipes](https://gluezero.org/docs/recipes/auth-token-refresh.html) — auth, multi-tenant cache, realtime, worker progress
