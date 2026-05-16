# @gluezero/react

> Adapter React idiomatico per GlueZero v2.0 — `<GlueZeroProvider>` + 6 hooks + `<GlueZeroErrorBoundary>` + `createReactMicroFrontendLifecycle` factory.

[![npm](https://img.shields.io/badge/npm-2.0.0-blue)](https://www.npmjs.com/package/@gluezero/react)
[![bundle](https://img.shields.io/badge/bundle-1.53KB%2F10KB-success)]()
[![peer](https://img.shields.io/badge/react-%3E%3D18.2--%3C20-blue)]()
[![tier](https://img.shields.io/badge/test-Tier1%2BTier3-success)]()

**Stato:** GA — `v2.0.0`. Pubblicato su npm dalla GA v2.0.0 (Phase 17).

## 1. Quick start

```tsx
import { createRoot } from 'react-dom/client';
import { createBroker } from '@gluezero/core';
import { GlueZeroProvider, useGlueZero } from '@gluezero/react';

const broker = createBroker({});

function App() {
  return (
    <GlueZeroProvider broker={broker}>
      <CounterButton />
    </GlueZeroProvider>
  );
}

function CounterButton() {
  const broker = useGlueZero();
  return (
    <button onClick={() => broker.publish('counter.inc', {})}>+1</button>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
```

Setup minimal in 3 step:

1. Istanzia `broker` con `createBroker({})` (o full modules per Livello C).
2. Wrap la root con `<GlueZeroProvider broker={broker}>`.
3. Usa i 6 hooks (`useGlueZero`, `useGlueZeroPublish`, `useGlueZeroSubscribe`, ecc.) nei componenti.

## 2. Installazione

```bash
pnpm add @gluezero/react @gluezero/core react react-dom
```

Opzionale (per Livello C):

```bash
pnpm add @gluezero/microfrontends
```

Peer dependencies (entrambe optional):

- `react: >=18.2.0 <20.0.0`
- `react-dom: >=18.2.0 <20.0.0`

React 17 non è supportato (manca `createRoot` API).

## 3. API public surface

Quattro categorie: Provider, 6 hooks, ErrorBoundary, factory.

### Provider

```tsx
<GlueZeroProvider broker={broker} mfContext={mfContext}>
  {children}
</GlueZeroProvider>
```

Provider singolo con DUE React.Context separati internamente (D-V2-F17-02):

- `BrokerContext` — l'istanza del broker.
- `MfContext` — il `MicroFrontendRuntimeContext` (null se mount standalone fuori MF).

### Hooks (6)

| Hook | Returns | Note |
|------|---------|------|
| `useGlueZero()` | `Broker` | Accede al broker. Throw se fuori Provider. |
| `useGlueZeroBroker()` | `Broker` | Alias semantico di `useGlueZero`. |
| `useGlueZeroPublish()` | `(topic, payload, options?) => void` | Funzione stable con auto-iniezione `metadata.microFrontendId`. |
| `useGlueZeroSubscribe(topic, handler, options?)` | `void` | Pattern `useEffect+useRef` stable handler (D-V2-F17-01). Zero re-subscription. |
| `useRuntimeContext()` | `RuntimeContext \| null` | Accede `RuntimeContext` da F10 (null se F10 non attivo). |
| `useMicroFrontendContext()` | `MicroFrontendRuntimeContext \| null` | Accede MfContext (null fuori MF scope). |

### ErrorBoundary

```tsx
<GlueZeroErrorBoundary
  microFrontendId="cart"
  fallback={<div>Cart momentaneamente non disponibile</div>}
>
  <CartView />
</GlueZeroErrorBoundary>
```

Class component built-in che:

1. Catch errors del child tree.
2. Publish `microfrontend.runtime.failed` con `{microFrontendId, error}`.
3. Delega `SERVICE_FALLBACKS` (F14) se installato — graceful degradation automatica.
4. Render `fallback` prop se F14 non installato.

### Factory

```tsx
const lifecycle = createReactMicroFrontendLifecycle(CartRoot, {
  strictMode: true, // wrap in React.StrictMode (default true)
});

await broker.registerMicroFrontend({
  id: 'cart',
  version: '1.0.0',
  lifecycle, // NB: oggetto, non hook stringhe ESM
});
```

Ritorna un oggetto `{bootstrap, mount, unmount, destroy}` compatibile `MicroFrontendRuntimeModule` F8.
Gestisce internamente `createRoot(container)` su mount + `root.unmount()` su unmount + wrap automatico
in `<GlueZeroProvider>` con broker + mfContext injection.

Per dettagli API completa con tipi: [TypeDoc generated](https://omardimarzio.github.io/GlueZero/v2/api/).

## 4. Examples

```tsx
// useGlueZeroSubscribe — stable handler pattern
import { useState } from 'react';
import { useGlueZeroSubscribe } from '@gluezero/react';

function CartView() {
  const [items, setItems] = useState<Item[]>([]);

  useGlueZeroSubscribe('cart.updated', (event) => {
    setItems(event.data.items);
  });

  return (
    <ul>{items.map((i) => <li key={i.id}>{i.name}</li>)}</ul>
  );
}
```

```tsx
// useGlueZeroPublish — auto-iniezione microFrontendId
import { useGlueZeroPublish } from '@gluezero/react';

function AddToCartButton({ sku }: { sku: string }) {
  const publish = useGlueZeroPublish();
  return (
    <button onClick={() => publish('cart.added', { sku })}>
      Aggiungi al carrello
    </button>
  );
}
```

```tsx
// Factory — wrap React component come MF lifecycle
import { createBroker } from '@gluezero/core';
import { microFrontendModule } from '@gluezero/microfrontends';
import { createReactMicroFrontendLifecycle } from '@gluezero/react';

function CartRoot({ context }: { context: MicroFrontendRuntimeContext }) {
  return <div>Cart MF — id: {context.microFrontendId}</div>;
}

const broker = createBroker({ modules: [microFrontendModule()] });
const lifecycle = createReactMicroFrontendLifecycle(CartRoot);

await broker.registerMicroFrontend({
  id: 'cart',
  version: '1.0.0',
  lifecycle,
});

await broker.mountMicroFrontend('cart', {
  container: document.getElementById('cart-slot')!,
});
```

Esempi completi:

- [`examples/microfrontends/mf-react-adapter.html`](../../examples/microfrontends/mf-react-adapter.html) (CDN esm.sh)
- [`examples/customer-dashboard/`](../../examples/customer-dashboard/) (host React shell + 3 MF mixed — Plan 17-06)
- [docs/v2/16-examples-react.md](../../docs/v2/16-examples-react.md)

## 5. Q&A

**Devo usare `<GlueZeroProvider>` per ogni MF?**
No, un Provider singolo a livello host è sufficiente. Multi-Provider annidato è supportato ma scoraggiato (override broker scope).

**Posso usare React 17?**
No, supportiamo solo React `>=18.2.0`. React 17 non ha `createRoot` API. Per progetti React 17, valuta upgrade prima di adottare l'adapter.

**Posso usare React 19?**
Sì, peer è `<20.0.0`. Testato con React 19.x.

**Perché 6 hooks e non 7 con `useSyncExternalStore`?**
Lock REQ MF-FRAMEWORK-REACT-01 letterale a 6 hooks. Il 7° hook `useGlueZeroValue` è deferred V2.1.

**`useGlueZeroSubscribe` re-subscribe a ogni render?**
No, il pattern `useEffect+useRef` interno garantisce zero re-subscription anche se il componente render con handler reference nuovo.

**Posso usare `react use()` + Suspense?**
Deferred V2.1. V2.0 supporta solo hooks classic.

## 6. Migration v1.x → v2.0 opt-in

`@gluezero/react` è **NUOVO** in v2.0 (non esisteva in v1.x). Aggiunta opzionale per progetti React.

Vedi [docs/v2/17-migration-guide.md](../../docs/v2/17-migration-guide.md) per adoption levels A/B/C.

L'adapter è adottabile incrementalmente:

- **Step 1:** wrap la root con `<GlueZeroProvider>`.
- **Step 2:** sostituisci `broker.publish(...)` con `useGlueZeroPublish()` nei componenti.
- **Step 3:** sostituisci `broker.subscribe(...)` con `useGlueZeroSubscribe` (no cleanup manuale necessario).
- **Step 4 (opzionale):** usa `createReactMicroFrontendLifecycle` per wrap MF React-based.

## 7. Limitations

- **SSR / `hydrateRoot` non supportato** — solo `createRoot` client-side. SSR + hydration deferred V2.1.
- **Hook 7° `useGlueZeroValue` con `useSyncExternalStore`** — deferred V2.1 (REQ MF-FRAMEWORK-REACT-01 letterale 6 hooks lock).
- **React `use()` + Suspense pattern** — deferred V2.1.
- **Concurrent rendering edge case**: `useGlueZeroSubscribe` non protegge contro tearing in concurrent mode con `useTransition` complesso — preferire `useSyncExternalStore` quando il 7° hook arriverà.

## 8. Performance

Bundle ≤ 10 KB gzipped (size-limit gate enforced via `pnpm ci:gate:react`). Actual: **1.53 KB**
(85% margin) — vedi [18 — Performance & Bundle](../../docs/v2/18-performance-bundle.md).

`useGlueZeroSubscribe` pattern useEffect+useRef garantisce zero re-subscription overhead a render.
Il subscribe avviene una volta sola al mount + cleanup automatico su unmount.

Bench scenario A (createBroker + 1000 publish): regression ≤ 5% vs v1.x baseline.

## 9. Bundle

- **Build:** tsup ESM-only + dts + target ES2022.
- **Output:** `dist/index.js` (1.53 KB gzipped) + `dist/index.d.ts`.
- **sideEffects:** `false` — tree-shaking friendly.

## 10. TypeScript support

Strict mode. Types incluso (`dist/index.d.ts`). `attw` clean (ESM-only profile).

Tipi esportati:

- `GlueZeroProviderProps`
- `GlueZeroErrorBoundaryProps`
- `ErrorBoundaryState`
- `ReactMicroFrontendLifecycle`
- `CreateReactMicroFrontendLifecycleOptions`

## 11. SSR / Browser support

- **Browser:** OK (`createRoot` client-side, evergreen ES2022).
- **SSR / hydration:** NON supportato V2.0 (deferred V2.1).
- **React Server Components:** NON supportato V2.0 (deferred V2.1+).

## 12. TypeScript support per Web Components

N/A — per Lit 3.x usare `@gluezero/web-components/lit`. React e Lit sono package distinti.
Per integration con Custom Elements puri usa `@gluezero/web-components` (base class `GlueZeroElement`).

## 13. FAQ + Riferimenti

- **Bug + feature requests:** [GitHub Issues](https://github.com/omardimarzio/GlueZero/issues)
- **PRD §28.2 React adapter:** [prd_2.0.0.md](../../prd_2.0.0.md)
- **PRD §29.6 Runtime error boundary:** [prd_2.0.0.md](../../prd_2.0.0.md)
- **docs/v2 hub:** [docs/v2/index.md](../../docs/v2/index.md)
- **Migration guide:** [docs/v2/17-migration-guide.md](../../docs/v2/17-migration-guide.md)
- **TypeDoc API reference:** https://omardimarzio.github.io/GlueZero/v2/api/

## License

MIT — vedi [LICENSE](../../LICENSE).
