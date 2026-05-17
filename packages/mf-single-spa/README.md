# @gluezero/mf-single-spa

> single-spa lifecycle adapter (peer `^5.9.0 || ^6.0.0`) per GlueZero v2.0 — Phase 15.

[![npm](https://img.shields.io/badge/npm-0.x.0--experimental-orange)]() [![bundle](https://img.shields.io/badge/bundle-1.44KB%2F3KB-green)]()

🧪 **Experimental @0.x.0** — D-V2-23 lockato V2.0 GA. GA promotion (`@1.0.0`) deferred V2.1 post-feedback.

Loader `MicroFrontendLoaderAdapter` con `type='single-spa'`: lifecycle mapping bit-exact `bootstrap/mount/unmount` (PRD §27.4) + topic emission governance + NO router replacement (REQ MF-SS-01) + 4 error codes literal union.

## Quick start

```ts
import { createBroker } from '@gluezero/core'
import { microfrontendModule } from '@gluezero/microfrontends'
import '@gluezero/mf-single-spa/augment'
import { singleSpaLoader } from '@gluezero/mf-single-spa'

const broker = createBroker({ modules: [microfrontendModule()] })
const service = broker.modules.get('@gluezero/microfrontends')
service.registerLoader(singleSpaLoader)

await service.register({
  id: 'navbar',
  loader: {
    type: 'single-spa',
    module: () => import('https://cdn/navbar.js'), // lazy load
    appName: 'navbar',
  },
  mount: { selector: '#nav' },
})
```

## Install

```bash
pnpm add @gluezero/mf-single-spa single-spa
```

Peer hard: `@gluezero/core`, `@gluezero/microfrontends`. Peer optional `single-spa` con range `^5.9.0 || ^6.0.0` — consumer install solo se usa SS loader.

## API

### `singleSpaLoader: MicroFrontendLoaderAdapter`

Adapter pre-istanziato con `type='single-spa'`. Lifecycle invocation:

1. Resolve modulo via `await definition.module()` (function) o usa diretto (object).
2. Validate single-spa contract (`bootstrap`/`mount`/`unmount` come function o array of functions).
3. Mapping lifecycle bit-exact:
   - `single-spa.bootstrap → MicroFrontendRuntimeModule.bootstrap`
   - `single-spa.mount → mount`
   - `single-spa.unmount → unmount`
   - `destroy`: no-op fallback (single-spa non ha equivalent).
4. Topic emit governance `microfrontend.lifecycle.{phase}.{started,completed,failed}` per phase.
5. ssProps shape `{domElement, name, customProps}` (NO `singleSpa` API, NO `mountParcel`).

### `SingleSpaLoaderDefinition`

```ts
interface SingleSpaLoaderDefinition {
  readonly type: 'single-spa'
  readonly module: SingleSpaApp | (() => Promise<SingleSpaApp>)
  readonly appName?: string                                 // default mfId
  readonly customProps?: Record<string, unknown>
  readonly timeoutMs?: number                               // default 15000ms
}

interface SingleSpaApp {
  readonly bootstrap: SingleSpaLifecycleEntry  // function | array
  readonly mount: SingleSpaLifecycleEntry
  readonly unmount: SingleSpaLifecycleEntry
  readonly update?: SingleSpaLifecycleEntry    // optional (single-spa 5.9+)
}
```

### `MfSingleSpaError`

Class extends Error implements BrokerError (D-V2-F15-12). 4 literal codes:

| Code | Quando | Recovery |
| --- | --- | --- |
| `MF_SS_LIFECYCLE_INVALID` | Module non-conforming (manca `bootstrap`/`mount`/`unmount`, sono non-function) | Fix MF module export shape |
| `MF_SS_BOOTSTRAP_FAILED` | `bootstrap(props)` throw | Investigare MF code bootstrap path |
| `MF_SS_MOUNT_FAILED` | `mount(props)` throw | Check DOM container + props shape |
| `MF_SS_UNMOUNT_FAILED` | `unmount(props)` throw | Check MF cleanup logic |

## Lifecycle mapping bit-exact (PRD §27.4)

```
┌────────────────────┐         ┌────────────────────────────────┐
│  single-spa app    │         │  MicroFrontendRuntimeModule    │
├────────────────────┤         ├────────────────────────────────┤
│  bootstrap(props)  │  ────►  │  bootstrap(ctx)                │
│  mount(props)      │  ────►  │  mount(ctx)                    │
│  unmount(props)    │  ────►  │  unmount(ctx)                  │
│  (no destroy)      │         │  destroy(ctx) → no-op fallback │
│  update(props)     │  ────►  │  update(ctx) — optional 5.9+   │
└────────────────────┘         └────────────────────────────────┘
```

ssProps shape (single-spa contract):

```ts
{
  domElement: HTMLElement,   // container F8 mount selector
  name: string,              // appName ?? mfId
  ...customProps,            // forwarded da descriptor
}
```

**NO `singleSpa` API propagation** (REQ MF-SS-01) — GlueZero non sostituisce single-spa routing.
**NO `mountParcel`** — Parcels API deferred V2.1.

## NO router replacement (REQ MF-SS-01)

GlueZero NON sostituisce single-spa routing engine. Se l'app shell usa `registerApplication` di single-spa, MF resta gestito da single-spa routing. Il loader F15 fornisce solo lifecycle adapter — non interferisce con `<single-spa-router>`.

## Examples

### Esempio 1 — lazy module via dynamic import

```ts
await service.register({
  id: 'sidebar',
  loader: {
    type: 'single-spa',
    module: () => import('https://cdn/sidebar.js'),
    appName: 'sidebar',
  },
})
```

### Esempio 2 — inline app object

```ts
const navApp = {
  async bootstrap(props) { console.log('boot', props.name) },
  async mount(props) { props.domElement.innerHTML = '<nav>menu</nav>' },
  async unmount(props) { props.domElement.innerHTML = '' },
}

await service.register({
  id: 'nav',
  loader: { type: 'single-spa', module: navApp },
})
```

### Esempio 3 — array lifecycle (parallel exec single-spa 5.9+)

```ts
await service.register({
  id: 'multi',
  loader: {
    type: 'single-spa',
    module: () =>
      Promise.resolve({
        bootstrap: [
          async () => { /* setup A */ },
          async () => { /* setup B */ },
        ],
        mount: async (props) => { /* ... */ },
        unmount: async (props) => { /* ... */ },
      }),
  },
})
// bootstrap esegue [A,B] in parallel via Promise.all
```

### Esempio 4 — customProps forwarded

```ts
await service.register({
  id: 'product',
  loader: {
    type: 'single-spa',
    module: () => import('/product.js'),
    appName: 'product',
    customProps: { theme: 'dark', locale: 'it-IT' },
  },
})
// MF riceve props = {domElement, name: 'product', theme: 'dark', locale: 'it-IT'}
```

## Errors

Vedi tabella sopra. 4 literal codes union — gestire via `if (err instanceof MfSingleSpaError && err.code === 'MF_SS_...')`.

## Q&A

**Q: Perché experimental @0.x.0?**
A: D-V2-23 BLOCKING — feedback community + iterazione API. GA promotion (`@1.0.0`) deferred V2.1.

**Q: Supporta single-spa Parcels?**
A: V2.0 NO (top-level lifecycle only). `mountParcel`/`createParcel`/`applyMounted` deferred V2.1.

**Q: Posso coesistere con single-spa esistente?**
A: Sì. GlueZero non sostituisce single-spa routing. Puoi avere alcuni MF gestiti da single-spa (`registerApplication`) e altri da GlueZero (`service.register({loader: {type: 'single-spa', ...}})`). Ognuno gestisce il suo subset.

**Q: Il loader supporta `update()` hook (single-spa 5.9+)?**
A: Sì come optional. Se MF expone `update(props)`, viene mappato a `MicroFrontendRuntimeModule.update(ctx)`.

**Q: Come passo customProps tipizzati?**
A: `customProps: Record<string, unknown>` nel descriptor. Cast inside l'app MF.

**Q: Posso usare il loader con react-redux store cross-MF?**
A: Sì, è agnostic. Store sharing è responsabilità del MF code, non del loader.

## Migration v1.x → v2.0

Primo SS adapter v2.0. Zero breaking change v1.x. Opt-in:

```ts
import '@gluezero/mf-single-spa/augment'
import { singleSpaLoader } from '@gluezero/mf-single-spa'
service.registerLoader(singleSpaLoader)
```

## Limitations (PRD §44)

- **Top-level lifecycle only V2.0**: Parcels API deferred V2.1.
- **`@0.x.0` experimental**: API surface può cambiare in V2.1 prima di GA.
- **NO router replacement** (REQ MF-SS-01).
- **No `getMountedApps()` / `getAppStatus()` propagation**: usa single-spa direttamente o devtools.
- **Peer range `^5.9.0 || ^6.0.0`**: 5.8.x e precedenti NOT supported (API breaking 5.9 array lifecycle).

## Performance

| Metric | Value | Note |
| --- | --- | --- |
| Bundle gzipped | **1.44 KB** | Cap 3 KB (48% utilizzo) |
| Augment gzipped | 22 B | Cap 1 KB |
| Resolve module callable | ~0.1 ms | Promise.resolve |
| Lifecycle invocation | depends on MF | Single await per phase |
| Topic emit per phase | ~10 µs | broker.publish sync |

## Bundle

| Entry | Path | Limit | Gzip |
| --- | --- | --- | --- |
| `@gluezero/mf-single-spa` | `dist/index.js` | 3 KB | **1.44 KB** |
| `@gluezero/mf-single-spa/augment` | `dist/augment.js` | 1 KB | **22 B** |

## Riferimenti

- PRD §27 — single-spa Adapter (experimental @0.x.0)
- PRD §44 — Limitations
- D-V2-23 BLOCKING — MF + SS adapter experimental V2.0
- D-V2-F15-11 — Peer dep `single-spa@^5.9.0 || ^6.0.0`
- D-V2-F15-12 — Custom error class per-package
- REQ MF-SS-01 — Lifecycle mapping + NO router replacement
- 15-CONTEXT.md, 15-04-SUMMARY.md
- single-spa 6.0.3 stable Mar 2026

---

*Phase 15 v2.0.0 — Last updated: 2026-05-15 (W3 P05 closure)*
