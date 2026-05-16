# 16 — Esempi React adapter

Showcase del **`@gluezero/react`** (F17 NEW) — adapter idiomatico React per integration
del broker GlueZero v2.0 in app React 18.2+/19.x. Provider singolo, 6 hooks stable, factory
per integration MF lifecycle, ErrorBoundary built-in con fallback delegation.

## Quick start

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
  return <button onClick={() => broker.publish('counter.inc', {})}>+1</button>;
}

createRoot(document.getElementById('root')!).render(<App />);
```

## Provider singolo

Il `<GlueZeroProvider>` espone DUE React.Context separati internamente (D-V2-F17-02):

- `BrokerContext` — l'istanza del broker.
- `MfContext` — il `MicroFrontendRuntimeContext` (null se mount standalone fuori MF).

Render uno solo `<GlueZeroProvider>` a livello host. Re-Provider annidati sono supportati
ma scoraggiati (override broker scope).

```tsx
<GlueZeroProvider broker={broker} mfContext={mfContext}>
  {children}
</GlueZeroProvider>
```

## 6 hooks public API

```tsx
// 1. Accede al broker (throw se fuori Provider)
const broker = useGlueZero();

// 2. Alias semantico
const broker = useGlueZeroBroker();

// 3. Publish stable con auto-iniezione metadata.microFrontendId
const publish = useGlueZeroPublish();
publish('cart.added', { sku: 'ABC' });

// 4. Subscribe pattern useEffect+useRef stable handler (D-V2-F17-01)
useGlueZeroSubscribe('cart.updated', (event) => {
  setCart(event.data);
});

// 5. RuntimeContext (storage namespaced, runtime info)
const runtime = useRuntimeContext();
runtime?.storage.local.setItem('key', 'value');

// 6. MicroFrontendRuntimeContext (null fuori MF scope)
const mfContext = useMicroFrontendContext();
if (mfContext) {
  console.log('Running as MF', mfContext.microFrontendId);
}
```

### `useGlueZeroSubscribe` — stable handler pattern

Il pattern `useEffect + useRef` interno garantisce **zero re-subscription** anche se il
componente re-render con un nuovo handler reference:

```tsx
function CartView() {
  const [items, setItems] = useState<Item[]>([]);

  useGlueZeroSubscribe('cart.updated', (event) => {
    // Questo handler si "aggiorna" senza unsubscribe/resubscribe sul broker
    setItems([...items, event.data.item]);
  });

  return <ul>{items.map(...)}</ul>;
}
```

## ErrorBoundary built-in

`<GlueZeroErrorBoundary>` è una class component che catch errori del child tree,
publish `microfrontend.runtime.failed` topic, e delega a `SERVICE_FALLBACKS` (F14) per
graceful degradation. Senza F14 attivo, render il `fallback` prop:

```tsx
import { GlueZeroErrorBoundary } from '@gluezero/react';

function CartShell() {
  return (
    <GlueZeroErrorBoundary
      microFrontendId="cart"
      fallback={<div>Cart momentaneamente non disponibile</div>}
    >
      <CartView />
    </GlueZeroErrorBoundary>
  );
}
```

## Factory `createReactMicroFrontendLifecycle`

Wrap un React component come `MicroFrontendRuntimeModule` (F8) compatibile con
`broker.registerMicroFrontend({lifecycle: ...})`:

```tsx
import { createBroker } from '@gluezero/core';
import { microFrontendModule } from '@gluezero/microfrontends';
import { createReactMicroFrontendLifecycle } from '@gluezero/react';

function CartRoot({ context }: { context: MicroFrontendRuntimeContext }) {
  return <div>Cart {context.microFrontendId}</div>;
}

const cartLifecycle = createReactMicroFrontendLifecycle(CartRoot, {
  strictMode: true, // wrap in React.StrictMode (default true)
});

const broker = createBroker({
  modules: [microFrontendModule()],
});

await broker.registerMicroFrontend({
  id: 'cart',
  version: '1.0.0',
  lifecycle: cartLifecycle, // NB: lifecycle oggetto, non hook stringhe ESM
});

await broker.mountMicroFrontend('cart', {
  container: document.getElementById('cart-slot')!,
});
```

La factory gestisce internamente:

- `createRoot(container)` su `mount`.
- `root.unmount()` su `unmount` (asincrono — return Promise resolved dopo flush).
- Wrap in `React.StrictMode` se `strictMode: true` (default).
- Wrap automatico in `<GlueZeroProvider>` con broker + mfContext injection.

## Esempio HTML standalone (CDN esm.sh)

```html
<!DOCTYPE html>
<html lang="it">
  <head>
    <meta charset="UTF-8" />
    <title>MF React Adapter Demo</title>
  </head>
  <body>
    <div id="root"></div>

    <script type="module">
      import React, { useState } from 'https://esm.sh/react@19';
      import { createRoot } from 'https://esm.sh/react-dom@19/client';
      import { createBroker } from 'https://esm.sh/@gluezero/core@2.0.0';
      import {
        GlueZeroProvider,
        useGlueZero,
        useGlueZeroSubscribe,
      } from 'https://esm.sh/@gluezero/react@2.0.0?deps=react@19';

      const broker = createBroker({});

      function App() {
        const [count, setCount] = useState(0);
        useGlueZeroSubscribe('counter.inc', () => setCount((c) => c + 1));
        const b = useGlueZero();
        return React.createElement(
          'button',
          { onClick: () => b.publish('counter.inc', {}) },
          `Count: ${count}`,
        );
      }

      createRoot(document.getElementById('root')).render(
        React.createElement(
          GlueZeroProvider,
          { broker },
          React.createElement(App),
        ),
      );
    </script>
  </body>
</html>
```

L'esempio completo customer-dashboard (host React shell + 3 MF mixed esm/wc/iframe)
è disponibile in [`examples/customer-dashboard/`](../../examples/customer-dashboard/) (Plan 17-06).

## Use case tipici

- Host shell React 18.2+/19.x con MF mixed (React + WC + iframe).
- Wrap di React components come MF lifecycle compatibile.
- Migration di app React esistente verso GlueZero broker (Livello C).

## Limitazioni

- **SSR / `hydrateRoot` non supportato** — solo `createRoot` client-side. Deferred V2.1.
- **`useGlueZeroValue` con `useSyncExternalStore`** — il 7° hook è deferred V2.1
  (lock REQ MF-FRAMEWORK-REACT-01 letterale 6 hooks).
- **React `use()` + Suspense pattern** — deferred V2.1.
- **Concurrent rendering edge case**: `useGlueZeroSubscribe` non protegge contro tearing
  in concurrent mode con `useTransition` complesso — preferire `useSyncExternalStore` quando
  il 7° hook arriverà.

## Decisioni v2.0 lockate

- **D-V2-F17-01** — `useGlueZeroSubscribe` pattern useEffect + useRef stable handler.
- **D-V2-F17-02** — Single Provider con 2 React.Context separati internamente.
- **D-V2-F17-03** — `createReactMicroFrontendLifecycle` auto-wrap in `<GlueZeroProvider>`.
- **D-V2-F17-04** — `GlueZeroErrorBoundary` publish `microfrontend.runtime.failed` +
  delega `SERVICE_FALLBACKS`.

## Riferimenti

- [README @gluezero/react](../../packages/react/README.md)
- [03 — Descriptor](./03-descriptor.md)
- [04 — Lifecycle FSM](./04-lifecycle.md)
- [11 — Fallback](./11-fallback.md)
- [`examples/customer-dashboard/`](../../examples/customer-dashboard/) (Plan 17-06)
- [PRD §28.2 — React adapter](../../prd_2.0.0.md)
- [PRD §29.6 — Runtime error boundary](../../prd_2.0.0.md)
