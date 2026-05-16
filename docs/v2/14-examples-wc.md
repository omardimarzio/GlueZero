# 14 — Esempi Web Component

Showcase di **due moduli complementari** per Web Components in v2.0:

1. **`@gluezero/mf-web-component`** — il **loader** lato shell che carica un Custom Element MF
   e lo mount come tag `<my-mf>`.
2. **`@gluezero/web-components`** (F17, NEW) — la **base class adapter** lato MF (o standalone)
   che eredita `GlueZeroElement` con broker wiring + AbortController cleanup automatico.
3. **`@gluezero/web-components/lit`** (F17, subpath) — integrazione Lit 3.x via `GlueZeroController`
   + `GlueZeroLitMixin`.

## Quick start — loader `@gluezero/mf-web-component`

```typescript
import { createBroker } from '@gluezero/core';
import { microFrontendModule } from '@gluezero/microfrontends';
import { mfWebComponentModule } from '@gluezero/mf-web-component';

const broker = createBroker({
  modules: [microFrontendModule(), mfWebComponentModule()],
});

await broker.registerMicroFrontend({
  id: 'cart',
  version: '1.0.0',
  loader: {
    type: 'web-component',
    url: '/mf/cart.js',
    tagName: 'mf-cart',
  },
});

await broker.mountMicroFrontend('cart', {
  container: document.getElementById('cart-slot')!,
});
```

Il loader carica il modulo ESM, attende `customElements.whenDefined('mf-cart')`, e mount un
`<mf-cart>` element nel container. Il modulo MF è responsabile di chiamare `customElements.define`.

## Quick start — base class `@gluezero/web-components` (F17)

Estendi `GlueZeroElement` per ottenere broker wiring automatico:

```typescript
import { GlueZeroElement } from '@gluezero/web-components';

export class CartElement extends GlueZeroElement {
  connectedCallback() {
    super.connectedCallback();

    // Broker + context disponibili automaticamente
    this.subscribe('user.logged-in', (event) => {
      this.render(event.data);
    });

    this.publish('cart.mounted', { id: this.glueZeroContext?.microFrontendId });
  }

  render(user: User) {
    this.innerHTML = `<h2>Hello ${user.name}</h2>`;
  }
}

customElements.define('mf-cart', CartElement);
```

`GlueZeroElement` espone:

- `this.glueZeroBroker` — broker injected dal loader (o globale).
- `this.glueZeroContext` — `MicroFrontendRuntimeContext` (null se mount standalone fuori MF).
- `this.publish(topic, payload)` — shortcut con auto-iniezione `metadata.microFrontendId`.
- `this.subscribe(topic, handler, options?)` — cleanup automatico via `AbortController` su `disconnectedCallback`.

## Quick start — Lit 3.x subpath `/lit`

Due opzioni: Reactive Controller (composable) o Class Mixin (inheritance).

### Reactive Controller

```typescript
import { LitElement, html } from 'lit';
import { GlueZeroController } from '@gluezero/web-components/lit';

export class CartLit extends LitElement {
  private gz = new GlueZeroController(this);

  override connectedCallback() {
    super.connectedCallback();
    this.gz.subscribe('cart.updated', (event) => {
      this.items = event.data.items;
    });
  }

  override render() {
    return html`<ul>${this.items.map(i => html`<li>${i.name}</li>`)}</ul>`;
  }

  private items: Item[] = [];
}

customElements.define('mf-cart', CartLit);
```

### Class Mixin

```typescript
import { LitElement, html } from 'lit';
import { GlueZeroLitMixin } from '@gluezero/web-components/lit';

class Base extends GlueZeroLitMixin(LitElement) {}

export class CartLit extends Base {
  override connectedCallback() {
    super.connectedCallback();
    this.subscribe('cart.updated', (event) => {
      this.items = event.data.items;
    });
  }

  override render() {
    return html`<ul>${this.items.map(i => html`<li>${i.name}</li>`)}</ul>`;
  }

  private items: Item[] = [];
}
```

## Esempio HTML standalone (shadow DOM isolation)

Apri direttamente nel browser:

```html
<!DOCTYPE html>
<html lang="it">
  <head>
    <meta charset="UTF-8" />
    <title>MF Web Component Demo</title>
  </head>
  <body>
    <div id="cart-slot"></div>

    <script type="module">
      import { createBroker } from 'https://esm.sh/@gluezero/core@2.0.0';
      import { microFrontendModule } from 'https://esm.sh/@gluezero/microfrontends@2.0.0';
      import { mfWebComponentModule } from 'https://esm.sh/@gluezero/mf-web-component@2.0.0';

      const broker = createBroker({
        modules: [microFrontendModule(), mfWebComponentModule()],
      });

      await broker.registerMicroFrontend({
        id: 'cart',
        version: '1.0.0',
        loader: {
          type: 'web-component',
          url: '/mf/cart.js',
          tagName: 'mf-cart',
        },
        isolation: 'shadow-dom',
      });

      await broker.mountMicroFrontend('cart', {
        container: document.getElementById('cart-slot'),
      });
    </script>
  </body>
</html>
```

Vedi anche [`examples/microfrontends/mf-shadow-dom.html`](../../examples/microfrontends/mf-shadow-dom.html).

## Use case tipici

- MF framework-agnostic (vanilla, Lit, Stencil, Hybrids).
- MF con shadow DOM isolation forte richiesta.
- Reuse del MF in contesti non-GlueZero (la Custom Element resta usable standalone).

## Limitazioni

- **NO auto-register**: il modulo MF è responsabile di `customElements.define`. La shell
  non deve chiamarla per evitare collision tra MF.
- **Form-associated + ElementInternals** — supporto deferred V2.1.
- **SSR / declarative shadow DOM** — non supportato V2.0.

## Decisioni v2.0 lockate

- **D-V2-F15-WC** — Loader non chiama `customElements.define`; la responsabilità è del MF.
- **D-V2-F17-WC-01** — `GlueZeroElement` usa AbortController per cleanup automatico subscribe
  in `disconnectedCallback`.
- **D-V2-F17-WC-02** — `/lit` subpath separato per zero peer dependency su Lit nel package base.

## Riferimenti

- [README @gluezero/mf-web-component](../../packages/mf-web-component/README.md)
- [README @gluezero/web-components](../../packages/web-components/README.md)
- [06 — Isolation](./06-isolation.md)
- [`examples/microfrontends/mf-shadow-dom.html`](../../examples/microfrontends/mf-shadow-dom.html)
- [PRD §15 — Loader Web Component](../../prd_2.0.0.md)
