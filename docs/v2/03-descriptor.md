# 03 — MicroFrontendDescriptor

`MicroFrontendDescriptor` è il contratto dichiarativo che descrive un micro-frontend gestito
dal broker GlueZero v2.0. È l'input principale di `broker.registerMicroFrontend(descriptor)`.

## Schema base

```typescript
interface MicroFrontendDescriptor {
  /** Identificatore univoco del MF nel broker. Deve essere stabile. */
  id: string;

  /** Versione del MF (semver). Usata per compat check (F12). */
  version: string;

  /** Loader strategy: 'esm' | 'web-component' | 'iframe' | 'module-federation' | 'single-spa'. */
  loader: LoaderConfig;

  /** Lifecycle hook names esportati dal MF (ESM/WC) o oggetto Lifecycle (adapter framework). */
  bootstrap?: string | LifecycleFn;
  mount?: string | LifecycleFn;
  unmount?: string | LifecycleFn;
  destroy?: string | LifecycleFn;

  /** Alternativa adapter framework: passa un oggetto compatibile con MicroFrontendRuntimeModule. */
  lifecycle?: MicroFrontendRuntimeModule;

  /** Capability dichiarate (per capability negotiation F11). */
  capabilities?: string[];

  /** Capability richieste dal MF (verificate al register/mount). */
  requiredCapabilities?: string[];

  /** Permission scope (event allow/deny + topic ACL). */
  permissions?: PermissionsScope;

  /** Compat constraints (F12 multi-dimensione semver). */
  compat?: CompatConstraints;

  /** Isolation policy override (F13). Default: 'mount-root' se isolation module attivo. */
  isolation?: 'mount-root' | 'scoped' | 'shadow-dom';

  /** Fallback strategy (F14). Default: SERVICE_FALLBACKS default config. */
  fallback?: FallbackConfig;

  /** Metadata libero per host application. */
  meta?: Record<string, unknown>;
}
```

## Esempio 1 — ESM loader (minimal Livello B)

```typescript
await broker.registerMicroFrontend({
  id: 'cart',
  version: '1.0.0',
  loader: {
    type: 'esm',
    url: '/mf/cart.js',
  },
  bootstrap: 'bootstrap',
  mount: 'mount',
  unmount: 'unmount',
});
```

Il modulo ESM `/mf/cart.js` deve esportare `bootstrap`, `mount`, `unmount` (e opzionalmente `destroy`):

```javascript
// /mf/cart.js
export async function bootstrap(context) { /* init */ }
export async function mount(container, context) { /* render */ }
export async function unmount(container, context) { /* cleanup */ }
```

## Esempio 2 — Web Component loader

```typescript
await broker.registerMicroFrontend({
  id: 'header',
  version: '2.0.0',
  loader: {
    type: 'web-component',
    url: '/mf/header.js',
    tagName: 'mf-header',
  },
});
```

Il modulo esporta un custom element. La factory `@gluezero/mf-web-component` gestisce
`customElements.define` o passa il control al consumatore (vedi PRD §15).

## Esempio 3 — iframe sandbox (security boundary forte)

```typescript
await broker.registerMicroFrontend({
  id: 'payment',
  version: '3.0.0',
  loader: {
    type: 'iframe',
    url: 'https://payment.example.com/mf.html',
    expectedOrigin: 'https://payment.example.com', // D-V2-09 mandatory
    sandbox: ['allow-scripts', 'allow-same-origin'],
  },
  isolation: 'shadow-dom', // ignorato — iframe ha già isolation forte
});
```

## Esempio 4 — Adapter React (Livello C)

```typescript
import { createReactMicroFrontendLifecycle } from '@gluezero/react';
import { CartRoot } from './cart-root';

const cartLifecycle = createReactMicroFrontendLifecycle(CartRoot, {
  strictMode: true,
});

await broker.registerMicroFrontend({
  id: 'cart',
  version: '2.0.0',
  capabilities: ['cart.write'],
  requiredCapabilities: ['auth.session'],
  permissions: { topicsAllow: ['cart.*', 'order.*'] },
  isolation: 'shadow-dom',
  lifecycle: cartLifecycle, // NB: oggetto, non hook stringhe
});
```

## Esempio 5 — Adapter Web Component (Livello C)

```typescript
import { CartElement } from './cart-element'; // estende GlueZeroElement

customElements.define('mf-cart', CartElement);

await broker.registerMicroFrontend({
  id: 'cart',
  version: '2.0.0',
  loader: {
    type: 'web-component',
    tagName: 'mf-cart',
    // url omesso: il custom element è già definito nella shell
  },
});
```

## Validazione

Il broker valida il descriptor con uno schema Valibot (tree-shakable ~1 KB). Errori sono
publicati come topic `microfrontend.descriptor.invalid` + thrown sincronamente da
`registerMicroFrontend`. Vedi PRD §10 per error matrix.

## Vincoli e regole

- `id` deve essere univoco nel broker scope.
- `version` deve essere semver valido (`x.y.z` o pre-release).
- `loader.type` deve corrispondere a un loader module installato in `createBroker({modules:[...]})`.
- `expectedOrigin` è **mandatory** per `loader.type === 'iframe'` (D-V2-09).
- `lifecycle` (oggetto) e i 4 hook stringhe sono **mutually exclusive**.

## Decisioni v2.0 lockate

- **D-V2-09** — Iframe loader `expectedOrigin` mandatory per closure attack prevention.
- **D-V2-13** — Isolation `mount-root` come default (opt-in shadow-dom esplicito).
- **D-V2-F8-3** — 14 stati FSM definiti come union finita.

## Riferimenti

- [04 — Lifecycle FSM](./04-lifecycle.md)
- [05 — Loaders](./05-loaders.md)
- [06 — Isolation](./06-isolation.md)
- [08 — Permissions](./08-permissions.md)
- [09 — Capabilities](./09-capabilities.md)
- [README @gluezero/microfrontends](../../packages/microfrontends/README.md)
- [PRD §10 — Descriptor](../../prd_2.0.0.md)
