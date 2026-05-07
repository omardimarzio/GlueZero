# GlueZero examples

Standalone HTML files that import GlueZero from a CDN (`esm.sh`) and demonstrate live functionality. **No build step, no dependencies, no toolchain.** Open the HTML files in a browser and they work.

## Available examples

| Example | What it demonstrates |
|---------|----------------------|
| [`weather-demo.html`](./weather-demo.html) | Two plugins with different naming conventions interoperating through canonical mapping. Mocked HTTP route, optional cache layer, simulated failures, live event log, debug snapshot. |

## How they work

Each example imports GlueZero directly via [`esm.sh`](https://esm.sh):

```html
<script type="module">
  import { createGlueZero } from 'https://esm.sh/@gluezero/gluezero@1.0.1'
  const broker = createGlueZero({ /* ... */ })
</script>
```

`esm.sh` resolves the package and all its dependencies (`@gluezero/core`, `@gluezero/mapper`, ..., plus `valibot`, `nanoid`, `comlink`) into native ESM that the browser loads directly. No bundling, no transpilation.

## Running locally

The simplest way:

```bash
# Open directly in the browser
open examples/weather-demo.html

# Or via a local static server (avoids potential CORS issues with file://)
python3 -m http.server 8080 --directory examples
# then visit http://localhost:8080/weather-demo.html
```

## Hosting on gluezero.org

These files are designed to be hosted under `gluezero.org/examples/` (or anywhere). They&rsquo;re fully self-contained — copy the HTML and you&rsquo;re done. No build pipeline needed.

## Building your own example

Start from the structure of `weather-demo.html`:

1. Single HTML file
2. `<script type="module">` block at the bottom
3. `import { createGlueZero } from 'https://esm.sh/@gluezero/gluezero@1.0.1'`
4. Build your broker, plugins, routes
5. Wire UI events to broker.publish, render data on broker.subscribe

For real production code, install via npm and bundle with your tool of choice — but for examples, demos, prototypes, and tutorials, the CDN approach is hard to beat.

## See also

- [docs](https://gluezero.org/docs) — full documentation
- [Getting started](https://gluezero.org/docs/getting-started.html)
- [API reference](https://gluezero.org/docs/api/gluezero.html)
- [Recipes](https://gluezero.org/docs/recipes/auth-token-refresh.html) — auth, multi-tenant cache, realtime, worker progress
