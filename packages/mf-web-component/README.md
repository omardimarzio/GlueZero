# @gluezero/mf-web-component

> Loader Custom Elements (Web Components) per GlueZero v2.0 — Phase 15.

[![npm](https://img.shields.io/badge/npm-2.0.0--alpha-blue)](https://www.npmjs.com/package/@gluezero/mf-web-component) [![bundle](https://img.shields.io/badge/bundle-1.94KB%2F3KB-green)]() [![tier](https://img.shields.io/badge/tier-1%2B3-success)]()

Loader `MicroFrontendLoaderAdapter` con `type='web-component'`: import ESM dinamico + `customElements.whenDefined` + `AbortSignal.timeout` cascade + 3-mode `contextMode` (property / attribute / event) + reuse-on-collision warning. Bundle 1.94 KB gzip su cap 3 KB (64% utilizzo).

## Quick start

```ts
import { createBroker } from '@gluezero/core'
import { microfrontendModule } from '@gluezero/microfrontends'
import '@gluezero/microfrontends/augment'
import '@gluezero/mf-web-component/augment'
import { webComponentLoader } from '@gluezero/mf-web-component'

const broker = createBroker({ modules: [microfrontendModule()] })
const service = broker.modules.get('@gluezero/microfrontends')
service.registerLoader(webComponentLoader)

// Descrittore MF
await service.register({
  id: 'product-card',
  name: 'Product Card',
  version: '1.0.0',
  loader: {
    type: 'web-component',
    url: 'https://cdn.example.com/product-card.js',
    elementName: 'product-card',
    contextMode: 'property',
    timeoutMs: 15000,
  },
  mount: { selector: '#main' },
})
```

## Install

```bash
pnpm add @gluezero/mf-web-component
# peer optional richiesto se usi context mode 'property'/'event':
pnpm add @gluezero/context
```

I peer hard `@gluezero/core` + `@gluezero/microfrontends` sono richiesti (workspace:^).
Il peer opzionale `@gluezero/context` serve solo se distribuisci `MicroFrontendRuntimeContext` via property setter o `CustomEvent`.

## API

### `webComponentLoader: MicroFrontendLoaderAdapter`

Adapter pre-istanziato (singleton) con `type='web-component'` + funzione `load(definition, ctx) → LoadedModule` async + lifecycle wrapper `{mount, unmount}` interno + metadata `{elementName, contextMode, timeoutMs, reused, url}`.

### `WebComponentLoaderDefinition`

```ts
interface WebComponentLoaderDefinition {
  readonly type: 'web-component'
  readonly url: string                                    // ESM module URL
  readonly elementName: string                            // tag name kebab-case
  readonly contextMode?: 'property' | 'attribute' | 'event'  // default 'property' (D-V2-F15-05)
  readonly timeoutMs?: number                             // default 15000ms
}
```

### `applyContext(element, context, mode)`

Dispatcher 3-mode per propagare `MicroFrontendRuntimeContext` al Custom Element:

- `'property'` (default): `element.glueZeroContext = ctx` — preserva reference identity (no clone, no JSON).
- `'attribute'`: `element.setAttribute('data-gluezero-context', JSON.stringify(subset))` con subset `{tenantId, locale, environment, direction}`.
- `'event'`: `element.dispatchEvent(new CustomEvent('gluezero:context', {detail: {context}, bubbles: false, composed: false}))`.

### `MfWebComponentError` + `createMfWebComponentError`

Class custom extends Error implements BrokerError (D-V2-F15-12). 4 literal codes:

| Code | Quando | Recovery |
| --- | --- | --- |
| `MF_WC_SCRIPT_LOAD_FAILED` | ESM import rejection (network/parse/CSP) o url/elementName invalid | Check URL allowlist + integrity attribute |
| `MF_WC_DEFINE_TIMEOUT` | `customElements.whenDefined` non risolve entro `timeoutMs` | Investigare modulo MF (forse non fa `customElements.define`) |
| `MF_WC_ALREADY_DEFINED` | (DOMException collision interno — non raised, gestito via reuse warning) | N/A (reuse path) |
| `MF_WC_CONTEXT_MODE_INVALID` | `contextMode` non in `{property, attribute, event}` | Fix descriptor |

## Examples

### Esempio 1 — ESM CDN + property mode (default)

```ts
await service.register({
  id: 'catalog',
  loader: {
    type: 'web-component',
    url: 'https://esm.sh/@my-org/catalog-card@1.0',
    elementName: 'catalog-card',
  },
})
```

### Esempio 2 — attribute mode (subset locale per CSP-strict)

```ts
await service.register({
  id: 'banner',
  loader: {
    type: 'web-component',
    url: '/mfs/banner.js',
    elementName: 'banner-cta',
    contextMode: 'attribute',
  },
})
// nel Custom Element:
// observedAttributes = ['data-gluezero-context']
// attributeChangedCallback(name, _, newVal) { const ctx = JSON.parse(newVal) }
```

### Esempio 3 — event mode (Vanilla DOM event)

```ts
await service.register({
  id: 'profile',
  loader: { type: 'web-component', url: '...', elementName: 'user-profile', contextMode: 'event' },
})
// nel Custom Element:
// connectedCallback() {
//   this.addEventListener('gluezero:context', (e) => { this._ctx = e.detail.context })
// }
```

### Esempio 4 — multi-MF stesso elementName (design-system primitives)

```ts
// MF "header" registra <ds-button>
await service.register({ id: 'header', loader: { type: 'web-component', url: '/a.js', elementName: 'ds-button' } })
// MF "footer" registra anche <ds-button> — il loader emette console.warn e RIUSA la classe esistente:
//   [mf-wc] custom element 'ds-button' already defined — reusing existing registration for mfId=footer
await service.register({ id: 'footer', loader: { type: 'web-component', url: '/b.js', elementName: 'ds-button' } })
```

## Errors

| Code | Phase | Recovery | REQ |
| --- | --- | --- | --- |
| `MF_WC_SCRIPT_LOAD_FAILED` | load | Check URL + CSP + network | MF-WC-01 |
| `MF_WC_DEFINE_TIMEOUT` | load | Verificare modulo MF chiami `customElements.define` | MF-WC-01 |
| `MF_WC_CONTEXT_MODE_INVALID` | load | Fix descriptor `contextMode` | MF-WC-01 |
| `MF_WC_ALREADY_DEFINED` | (interno) | Reuse silent — solo warning | D-V2-F15-08 |

## Q&A

**Q: Perché property mode è default e non attribute?**
A: Reference identity preserved → no JSON parse cost + supporta object cyclic + signal/store reactive (D-V2-F15-05).

**Q: Posso usare il loader senza shadow DOM?**
A: Sì. Il loader non opina su shadow vs light DOM. Combinabile con `@gluezero/isolation` (F13) per shadow-dom isolation strict.

**Q: Cosa succede se 2 MF definiscono lo stesso `elementName`?**
A: Il secondo emette `console.warn`, riusa la classe già registrata, `metadata.reused: true`. Pattern intentional per design-system primitives shared (D-V2-F15-08).

**Q: Posso passare un `AbortSignal` per cancellare il load?**
A: Sì, via `ctx.signal` (LoaderContext). Composite con `AbortSignal.timeout(timeoutMs)` carryover F9.

**Q: Il loader chiama `appendChild` sul container?**
A: No. Il loader produce `LoadedModule`; il `MicroFrontendsService` orchestrator F8 monta sul `MountDefinition.selector`. Separation of concerns.

## Migration v1.x → v2.0

Zero breaking change per chi non usa il loader (è un package nuovo v2.0). Opt-in pattern:

```ts
// v2.0 — pattern S1 augment marker
import '@gluezero/mf-web-component/augment'
import { webComponentLoader } from '@gluezero/mf-web-component'
service.registerLoader(webComponentLoader)
```

## Limitations (PRD §44)

- `contextMode: 'attribute'` espone subset minimo `{tenantId, locale, environment, direction}` — deep features (permissions, featureFlags, theme tokens) deferred V2.1.
- Il loader NON serve shadow DOM cross-frame storage isolation (responsabilità `@gluezero/isolation`).
- Tree-shake JSDoc descrittivi italiano via tsup minify (production drop comments).

## Performance

| Metric | Value | Note |
| --- | --- | --- |
| Bundle gzipped | 1.94 KB | Cap 3 KB (64% utilizzo) |
| Augment gzipped | 22 B | Cap 1 KB |
| Cold load (ESM import) | ~2-5 ms | Network-dependent |
| `customElements.whenDefined` race | <1 ms | Native browser API |
| applyContext property mode | ~10 µs | Setter direct |

## Bundle

| Entry | Path | Limit | Gzip |
| --- | --- | --- | --- |
| `@gluezero/mf-web-component` | `dist/index.js` | 3 KB | **1.94 KB** |
| `@gluezero/mf-web-component/augment` | `dist/augment.js` | 1 KB | **22 B** |

## Riferimenti

- PRD §25 — Web Component Loader
- PRD §44 — Limitations
- D-V2-F15-05 — Default `contextMode='property'`
- D-V2-F15-06 — `customElements.whenDefined` + `AbortSignal.timeout`
- D-V2-F15-07 — ESM-only `import(url)`
- D-V2-F15-08 — Reuse-on-collision warning
- REQ MF-WC-01 — Web Component loader contract
- 15-CONTEXT.md — 16+12 decisioni F15
- 15-02-SUMMARY.md — Implementation W2 P02

---

*Phase 15 v2.0.0 — Last updated: 2026-05-15 (W3 P05 closure)*
