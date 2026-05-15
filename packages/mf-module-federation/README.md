# @gluezero/mf-module-federation

> Module Federation loader (webpack 5 + `@module-federation/runtime` 2.4.x) per GlueZero v2.0 — Phase 15.

[![npm](https://img.shields.io/badge/npm-0.x.0--experimental-orange)]() [![bundle](https://img.shields.io/badge/bundle-3.2KB%2F5KB-green)]()

🧪 **Experimental @0.x.0** — D-V2-23 lockato V2.0 GA. GA promotion (`@1.0.0`) deferred V2.1 post-feedback.

Loader `MicroFrontendLoaderAdapter` con `type='module-federation'`: integra `@module-federation/runtime` 2.4.x stable + share scope conflict warn-then-proceed + factory normalize 4-step priority carryover F9 + 5 error codes literal union (REQ MF-MF-02).

## Quick start

### Host shell

```ts
import { createBroker } from '@gluezero/core'
import { microfrontendModule } from '@gluezero/microfrontends'
import '@gluezero/mf-module-federation/augment'
import { moduleFederationLoader } from '@gluezero/mf-module-federation'

const broker = createBroker({ modules: [microfrontendModule()] })
const service = broker.modules.get('@gluezero/microfrontends')
service.registerLoader(moduleFederationLoader)

await service.register({
  id: 'dashboard',
  loader: {
    type: 'module-federation',
    url: 'https://cdn.example.com/customerApp/remoteEntry.js',
    scope: 'customerApp',
    module: './Dashboard',
    shared: {
      react: { requiredVersion: '^18.2.0', singleton: true },
      'react-dom': { requiredVersion: '^18.2.0', singleton: true },
    },
  },
  mount: { selector: '#main' },
})
```

### Remote MF (webpack 5 config)

```js
// webpack.config.js del MF remote
new ModuleFederationPlugin({
  name: 'customerApp',
  filename: 'remoteEntry.js',
  exposes: {
    './Dashboard': './src/Dashboard.jsx',
  },
  shared: { react: { singleton: true }, 'react-dom': { singleton: true } },
})
```

## Install

```bash
pnpm add @gluezero/mf-module-federation @module-federation/runtime
```

Peer hard: `@gluezero/core`, `@gluezero/microfrontends`. Peer optional `@module-federation/runtime` con range `>=2.0.0 <3.0.0` — consumer install solo se usa MF loader.

## API

### `moduleFederationLoader: MicroFrontendLoaderAdapter`

Adapter pre-istanziato con `type='module-federation'`. 7-step lifecycle:

1. Validation `scope` + `module` + `url`.
2. Caricamento `@module-federation/runtime` peer optional via `await import('@module-federation/runtime')`.
3. `mfRuntime.init({name, remotes, shared})` idempotent (tracking module-level).
4. `compareShareScopes(definition.shared, ctx.broker, mfId)` — warn + emit topic.
5. `mfRuntime.loadRemote(scope/module)` race con `combineSignals(ctx.signal, timeout)`.
6. Error code mapping da MF Runtime error.code regex.
7. `normalizeModule(factoryResult, opts)` — carryover F9 D-V2-F9-05 4-step priority.

### `ModuleFederationLoaderDefinition`

```ts
interface ModuleFederationLoaderDefinition {
  readonly type: 'module-federation'
  readonly url: string                                      // remoteEntry.js URL
  readonly scope: string                                    // remote MF name
  readonly module: string                                   // exposed key (es. './Dashboard')
  readonly exportName?: string                              // override default export
  readonly shared?: Readonly<Record<string, ShareScopeConfig>>
  readonly timeoutMs?: number                               // default 15000ms
}
```

### `MfModuleFederationError`

Class extends Error implements BrokerError (D-V2-F15-12). 5 literal codes:

| Code | Quando | Recovery |
| --- | --- | --- |
| `MF_REMOTE_ENTRY_LOAD_FAILED` | fetch `remoteEntry.js` fallita (network/404/CSP) o peer optional `@module-federation/runtime` non installato | Check URL + CSP + install peer dep |
| `MF_REMOTE_SCOPE_NOT_FOUND` | scope completamente assente in host shared section | Fix `ModuleFederationPlugin.name` MF remote |
| `MF_REMOTE_MODULE_NOT_FOUND` | `loadRemote(scope/module)` ritorna `undefined` | Check `exposes` key MF remote webpack config |
| `MF_REMOTE_FACTORY_FAILED` | factory invocation throw o no lifecycle valido in module shape | Investigare module export shape (default vs named) |
| `MF_SHARE_SCOPE_FAILED` | scope NOT FOUND in host shared section (es. host non ha shared) | Add `shared: {...}` in host MF config |

## Share scope — warn + proceed policy (D-V2-F15-10)

Quando `requiredVersion` non soddisfa la versione host fornita:

1. `console.warn`: `[mf-mf] share scope version mismatch: mfId="..." requires react@^18.2.0 but host provides react@19.0.0 — using host shared (D-V2-F15-10 warn + proceed)`.
2. Emit topic `microfrontend.mf.share.version-mismatch` con payload `{mfId, sharedKey, required, provided, timestamp}`.
3. **Procede usando shared host** — nessun throw (coerente webpack MF default behavior + F12 warn-then-proceed pattern).

`MF_SHARE_SCOPE_FAILED` resta riservato solo per scope completamente assente.

## Examples

### Esempio 1 — basic remote

```ts
await service.register({
  id: 'sidebar',
  loader: {
    type: 'module-federation',
    url: '/mfs/customerApp/remoteEntry.js',
    scope: 'customerApp',
    module: './Sidebar',
  },
})
```

### Esempio 2 — shared scope multi-package

```ts
await service.register({
  id: 'dashboard',
  loader: {
    type: 'module-federation',
    url: 'https://cdn/customerApp/remoteEntry.js',
    scope: 'customerApp',
    module: './Dashboard',
    shared: {
      react: { requiredVersion: '^18.2.0', singleton: true },
      'react-dom': { requiredVersion: '^18.2.0', singleton: true },
      '@gluezero/core': { requiredVersion: '^2.0.0', singleton: true, eager: true },
    },
  },
})
```

### Esempio 3 — multiple remotes (federation)

```ts
const remotes = ['header', 'sidebar', 'dashboard', 'footer'] as const
for (const id of remotes) {
  await service.register({
    id,
    loader: { type: 'module-federation', url: `/mfs/${id}/remoteEntry.js`, scope: id, module: `./${id}` },
  })
}
```

### Esempio 4 — explicit exportName override (Strategy 1 D-V2-F9-05)

```ts
await service.register({
  id: 'feature',
  loader: {
    type: 'module-federation',
    url: '/mfs/feature/remoteEntry.js',
    scope: 'feature',
    module: './Feature',
    exportName: 'customLifecycle', // override default export
  },
})
```

## Errors

Vedi tabella completa sopra (sezione "MfModuleFederationError"). 5 literal codes union — gestire via `if (err instanceof MfModuleFederationError && err.code === 'MF_REMOTE_...')`.

## Q&A

**Q: Perché experimental @0.x.0 e non GA?**
A: D-V2-23 BLOCKING — MF + SS adapter restano experimental V2.0 GA per consentire feedback community + iterazione API senza semver breaking. GA promotion (`@1.0.0`) deferred V2.1.

**Q: Funziona con rsbuild?**
A: V2.0 supporta webpack-only (D-V2-F15-09). rsbuild produce `mf-manifest.json` con shape leggermente diversa — supporto deferred V2.1.

**Q: Funziona con vite plugin Module Federation?**
A: V2.0 NO. La community vite-MF è frammentata (2+ plugin diversi). Supporto deferred V2.1 dopo consolidamento ecosistema.

**Q: Cosa fa il warn share scope mismatch?**
A: Carryover F12 warn-then-proceed policy: il MF procede usando la shared lib host (coerente webpack MF default). Pubblica topic `microfrontend.mf.share.version-mismatch` per observability — devtools possono visualizzare le drift.

**Q: Come pinno la version `react` cross-MF?**
A: Usa `singleton: true` in tutti i remoti + host. webpack MF garantirà una sola istanza (la prima loaded). Versione effettiva risolta lazy.

**Q: Posso fare lazy loading remoto?**
A: Sì, il loader integra `combineSignals(ctx.signal, AbortSignal.timeout(15000))` — il caller può cancellare via `ctx.signal`.

## Migration v1.x → v2.0

Primo MF loader v2.0. Zero breaking change v1.x. Opt-in:

```ts
import '@gluezero/mf-module-federation/augment'
import { moduleFederationLoader } from '@gluezero/mf-module-federation'
service.registerLoader(moduleFederationLoader)
```

## Limitations (PRD §44)

- **webpack-only V2.0 GA** (D-V2-F15-09): rsbuild + vite deferred V2.1.
- **`@0.x.0` experimental**: API surface può cambiare in V2.1 prima di GA.
- **Issue #4071 share scope detection** (module-federation/core): la version host effettiva è best-effort via 3-strategy fallback (`window[key].version` → `__webpack_share_scopes__.default[key]` → silent skip). Consumer-driven reporting via topic deferred V2.1.
- **No HMR support**: production builds only V2.0.
- **No `dynamic remote URLs` API helper**: usa `service.register()` con URL già risolto.

## Performance

| Metric | Value | Note |
| --- | --- | --- |
| Bundle gzipped | **3.2 KB** | Cap 5 KB (64% utilizzo) |
| Augment gzipped | 22 B | Cap 1 KB |
| `init()` idempotent | ~0.1 ms | Module-level cache |
| `loadRemote()` race | network-dependent | Composite signal |
| `compareShareScopes` per key | ~10 µs | Inline semver minimal |

## Bundle

| Entry | Path | Limit | Gzip |
| --- | --- | --- | --- |
| `@gluezero/mf-module-federation` | `dist/index.js` | 5 KB | **3.2 KB** |
| `@gluezero/mf-module-federation/augment` | `dist/augment.js` | 1 KB | **22 B** |

## Riferimenti

- PRD §24 — Module Federation Loader (experimental @0.x.0)
- PRD §44 — Limitations
- D-V2-23 BLOCKING — MF + SS adapter experimental V2.0
- D-V2-F15-09 — webpack-only V2.0 GA
- D-V2-F15-10 — Share scope warn + proceed
- D-V2-F15-12 — Custom error class per-package
- REQ MF-MF-01..02
- 15-CONTEXT.md, 15-04-SUMMARY.md
- module-federation/core Issue #4071 — share scope detection limitation
- @module-federation/runtime 2.4.x stable Mar 2026

---

*Phase 15 v2.0.0 — Last updated: 2026-05-15 (W3 P05 closure)*
