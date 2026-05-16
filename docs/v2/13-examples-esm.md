# 13 — Esempi ESM

Showcase del loader **`@gluezero/mf-esm`** — il loader più semplice e raccomandato come
**default** per nuovi progetti. Usa `import(url)` nativo del browser con `AbortSignal.timeout`
per gestire timeout e normalizzazione export con smart fallback priority.

## Quick start

```typescript
import { createBroker } from '@gluezero/core';
import { microFrontendModule } from '@gluezero/microfrontends';
import { mfEsmModule } from '@gluezero/mf-esm';

const broker = createBroker({
  modules: [microFrontendModule(), mfEsmModule()],
});

await broker.registerMicroFrontend({
  id: 'header',
  version: '1.0.0',
  loader: {
    type: 'esm',
    url: '/mf/header.js',
    timeout: 5000, // optional, default 30000
  },
  bootstrap: 'bootstrap',
  mount: 'mount',
  unmount: 'unmount',
});

const container = document.getElementById('header-slot')!;
await broker.mountMicroFrontend('header', { container });
```

## Struttura del modulo MF ESM

Il file ESM deve esportare almeno `mount` (gli altri lifecycle sono opzionali):

```javascript
// /mf/header.js
export async function bootstrap(context) {
  console.log('[header] bootstrap', context.microFrontendId);
}

export async function mount(container, context) {
  container.innerHTML = '<h1>Header MF</h1>';
  context.broker.publish('header.mounted', { ts: Date.now() });
}

export async function unmount(container, context) {
  container.innerHTML = '';
  context.broker.publish('header.unmounted', { ts: Date.now() });
}

export async function destroy(context) {
  // cleanup risorse globali
}
```

Il loader normalizza l'export con priority: oggetto `default` → named exports → fallback.
Vedi [README `@gluezero/mf-esm`](../../packages/mf-esm/README.md) per dettagli del matching.

## Esempio HTML standalone

Apri direttamente nel browser (no bundler):

```html
<!DOCTYPE html>
<html lang="it">
  <head>
    <meta charset="UTF-8" />
    <title>MF ESM Demo</title>
  </head>
  <body>
    <div id="header-slot"></div>

    <script type="module">
      import { createBroker } from 'https://esm.sh/@gluezero/core@2.0.0';
      import { microFrontendModule } from 'https://esm.sh/@gluezero/microfrontends@2.0.0';
      import { mfEsmModule } from 'https://esm.sh/@gluezero/mf-esm@2.0.0';

      const broker = createBroker({
        modules: [microFrontendModule(), mfEsmModule()],
      });

      await broker.registerMicroFrontend({
        id: 'header',
        version: '1.0.0',
        loader: { type: 'esm', url: '/mf/header.js' },
        bootstrap: 'bootstrap',
        mount: 'mount',
        unmount: 'unmount',
      });

      await broker.mountMicroFrontend('header', {
        container: document.getElementById('header-slot'),
      });
    </script>
  </body>
</html>
```

Vedi anche [`examples/microfrontends/mf-esm-basic.html`](../../examples/microfrontends/mf-esm-basic.html)
per la versione completa di error handling + devtools inspector.

## Use case tipici

- ESM nativi compatibili browser evergreen (Chrome 91+, Firefox 89+, Safari 15+).
- MF in dominio o sub-dominio dell'host (no CORS issue).
- MF leggeri (≤ 500 KB) — per chunk pesanti considera lazy `<link rel="modulepreload">`.

## Limitazioni

- `import(url)` dinamico richiede CORS abilitato sul server origin del MF.
- Niente fallback automatico cross-browser (no SystemJS) — se ti serve, usa
  `@gluezero/mf-module-federation` o `@gluezero/mf-single-spa`.
- Niente import map injection automatica — gestione dipendenze peer è responsabilità del bundler MF.

## Decisioni v2.0 lockate

- **D-V2-F9-01** — Smart fallback export priority `default > named > module-itself`.
- **D-V2-F9-02** — AbortSignal.timeout default 30s; override per descriptor.

## Riferimenti

- [README @gluezero/mf-esm](../../packages/mf-esm/README.md)
- [03 — Descriptor](./03-descriptor.md)
- [04 — Lifecycle FSM](./04-lifecycle.md)
- [05 — Loaders](./05-loaders.md)
- [`examples/microfrontends/mf-esm-basic.html`](../../examples/microfrontends/mf-esm-basic.html)
- [PRD §11 — Loader ESM](../../prd_2.0.0.md)
