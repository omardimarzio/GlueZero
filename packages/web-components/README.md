# @gluezero/web-components

> Adapter Web Components per GlueZero v2.0 — `GlueZeroElement` base class + AbortController cleanup + subpath `/lit` per Lit 3.x integration.

[![npm](https://img.shields.io/badge/npm-2.0.0-blue)](https://www.npmjs.com/package/@gluezero/web-components)
[![bundle base](https://img.shields.io/badge/base-609B%2F8KB-success)]()
[![bundle lit](https://img.shields.io/badge/%2Flit-480B%2F3KB-success)]()
[![tier](https://img.shields.io/badge/test-Tier1%2BTier3-success)]()

**Stato:** GA — `v2.0.0`. Pubblicato su npm dalla GA v2.0.0 (Phase 17).

## 1. Quick start

```typescript
import { GlueZeroElement } from '@gluezero/web-components';

export class CartElement extends GlueZeroElement {
  onContextReady() {
    this.subscribe('user.logged-in', (event) => {
      this.render(event.data);
    });

    this.publish('cart.mounted', {});
  }

  render(user: User) {
    this.innerHTML = `<h2>Hello ${user.name}</h2>`;
  }
}

customElements.define('mf-cart', CartElement);
```

Setup minimal in 3 step:

1. Estendi `GlueZeroElement` per il tuo Custom Element.
2. Implementa `onContextReady()` per setup (auto-chiamato quando broker + context sono iniettati).
3. Usa `this.publish(...)` / `this.subscribe(...)` con cleanup automatico via `AbortController` su `disconnectedCallback`.

## 2. Installazione

```bash
pnpm add @gluezero/web-components @gluezero/core
```

Opzionale (per Lit 3.x):

```bash
pnpm add lit
```

Peer dependencies:

- `lit: >=3.0.0 <4.0.0` (optional, solo per subpath `/lit`)

Nessun import statico di `lit` a livello modulo nel package base — usalo solo importando dal subpath
`@gluezero/web-components/lit`.

## 3. API public surface

Due subpath distinti:

### Subpath base `@gluezero/web-components`

```typescript
import { GlueZeroElement } from '@gluezero/web-components';
```

| Export | Tipo | Descrizione |
|--------|------|-------------|
| `GlueZeroElement` | class extends HTMLElement | Base class per Custom Elements GlueZero-aware |
| `Broker` | type | Re-export tipo broker (per JSDoc) |
| `BrokerEvent` | type | Re-export tipo evento broker |
| `EventSource` | type | Re-export tipo source |
| `MicroFrontendRuntimeContext` | type | Re-export tipo MF context |
| `SubscribeOptions` | type | Opzioni `this.subscribe(...)` |
| `Subscription` | type | Handle restituito da subscribe |
| `WcPublishOptions` | type | Opzioni `this.publish(...)` |

### Subpath `/lit` (Lit 3.x integration)

```typescript
import { GlueZeroController, GlueZeroLitMixin } from '@gluezero/web-components/lit';
```

| Export | Tipo | Descrizione |
|--------|------|-------------|
| `GlueZeroController` | class | ReactiveController building block per Lit avanzato |
| `GlueZeroControllerHost` | type | Interface richiesta per usare il Controller |
| `GlueZeroLitMixin` | function | Class mixin ergonomic (raccomandato) |
| `GlueZeroLitMixinInterface` | type | Interface esposta dal Mixin |

Per dettagli API completa con tipi: [TypeDoc generated](https://omardimarzio.github.io/GlueZero/v2/api/).

## 4. Examples

### Custom Element vanilla (no Lit)

```typescript
import { GlueZeroElement } from '@gluezero/web-components';

class HeaderEl extends GlueZeroElement {
  onContextReady() {
    this.subscribe('user.profile.changed', (event) => {
      const root = this.shadowRoot ?? this;
      root.innerHTML = `<h1>Hello ${event.data.name}</h1>`;
    });
  }
}

customElements.define('mf-header', HeaderEl);
```

### Lit 3.x — Mixin (raccomandato)

```typescript
import { LitElement, html } from 'lit';
import { GlueZeroLitMixin } from '@gluezero/web-components/lit';

class CartEl extends GlueZeroLitMixin(LitElement) {
  override connectedCallback() {
    super.connectedCallback();
    this.gluezero.subscribe('cart.updated', (event) => {
      this.items = event.data.items;
      this.requestUpdate();
    });
  }

  items: Item[] = [];

  override render() {
    return html`<ul>${this.items.map((i) => html`<li>${i.name}</li>`)}</ul>`;
  }
}

customElements.define('mf-cart', CartEl);
```

### Lit 3.x — Controller (avanzato)

```typescript
import { LitElement } from 'lit';
import { GlueZeroController } from '@gluezero/web-components/lit';

class HeaderEl extends LitElement {
  glueZeroBroker = null;
  glueZeroContext = null;
  gluezero = new GlueZeroController(this);
}
```

### Property wiring dal loader F15

Il loader `@gluezero/mf-web-component` injecta `glueZeroBroker` + `glueZeroContext` come property
sul Custom Element prima di `connectedCallback`. `GlueZeroElement` ascolta i set e chiama
`onContextReady()` quando entrambi sono populated.

Esempi completi:

- [`examples/microfrontends/mf-shadow-dom.html`](../../examples/microfrontends/mf-shadow-dom.html) (shadow DOM isolation)
- [`examples/microfrontends/mf-context-basic.html`](../../examples/microfrontends/mf-context-basic.html)
- [docs/v2/14-examples-wc.md](../../docs/v2/14-examples-wc.md)

## 5. Q&A

**Devo importare `lit` separatamente?**
Sì — `lit` è peer optional. Installalo solo se usi il subpath `/lit`. Il package base
`@gluezero/web-components` non ha alcuna dipendenza da Lit.

**`customElements.define` viene chiamato automaticamente?**
No (D-V2-F15-WC). La responsabilità è del modulo MF per evitare collision tra MF
con stesso `tagName`. Il loader F15 verifica solo `customElements.whenDefined(tagName)` dopo
il caricamento del modulo.

**Posso usare `GlueZeroElement` con shadow DOM?**
Sì — chiama `this.attachShadow({mode: 'open'})` nel constructor o `connectedCallback`. La base
class non forza un mode di rendering specifico.

**`AbortController` viene riusato cross-subscribe?**
Sì — un singolo `AbortController` per istanza. Su `disconnectedCallback` viene chiamato `.abort()`
che dispatcha unsubscribe per tutti i subscribe attivi.

**Lit Reactive Controller vs Mixin — quale scegliere?**
- **Mixin** (raccomandato): API ergonomic `this.gluezero.publish(...)` + auto-wiring.
- **Controller**: building block diretto per pattern avanzati (composition con altri controller).

**Posso usare Stencil / Hybrids / Solid custom-elements?**
Sì in modo limitato — usa direttamente i tipi `Broker` + `Subscription` esposti senza ereditare
da `GlueZeroElement`. Il wiring property `glueZeroBroker`/`glueZeroContext` resta convenzione
universale.

## 6. Migration v1.x → v2.0 opt-in

`@gluezero/web-components` è **NUOVO** in v2.0 (non esisteva in v1.x). Aggiunta opzionale.

Vedi [docs/v2/17-migration-guide.md](../../docs/v2/17-migration-guide.md) per adoption levels A/B/C.

L'adapter è adottabile incrementalmente:

- **Step 1:** estendi `GlueZeroElement` per il tuo Custom Element esistente.
- **Step 2:** sposta logic da `connectedCallback` a `onContextReady()`.
- **Step 3:** rimuovi cleanup manuale subscribe (gestito da `AbortController`).
- **Step 4 (Lit):** wrap con `GlueZeroLitMixin` o aggiungi `new GlueZeroController(this)`.

## 7. Limitations

- **NO auto-register customElements.define**: il modulo MF è responsabile (D-V2-F15-WC).
- **Form-associated Custom Elements + ElementInternals** — supporto deferred V2.1.
- **SSR / declarative shadow DOM** — non supportato V2.0.
- **Lit < 3.0 / Lit 4+** — fuori dal peer range (`>=3.0.0 <4.0.0`).
- **CustomStateSet** — non integrato V2.0 (deferred V2.1).

## 8. Performance

- **Bundle base:** ≤ 8 KB gzipped (size-limit). Actual: **609 B** (92% margin).
- **Bundle `/lit`:** ≤ 3 KB gzipped (size-limit). Actual: **480 B** (84% margin).

Vedi [18 — Performance & Bundle](../../docs/v2/18-performance-bundle.md).

`AbortController` cleanup automatico evita memory leak comune con event listener + broker
subscribe nei Custom Elements.

## 9. Bundle

- **Build:** tsup ESM-only + dts + target ES2022.
- **Output base:** `dist/index.js` (609 B gzipped) + `dist/index.d.ts`.
- **Output `/lit`:** `dist/lit.js` (480 B gzipped) + `dist/lit.d.ts`.
- **sideEffects:** `false` — tree-shaking friendly per entrambi i subpath.

## 10. TypeScript support

Strict mode. Types incluso (`dist/index.d.ts` + `dist/lit.d.ts`). `attw` clean (ESM-only profile).

Subpath types sono dichiarati in `package.json` `exports` per resolution corretta da bundler
e TypeScript 5.x.

## 11. SSR / Browser support

- **Browser:** OK (Custom Elements v1 standard, evergreen ES2022).
- **SSR:** NON supportato V2.0 (Custom Elements native SSR è ancora WICG draft).
- **Declarative Shadow DOM:** non auto-rehydrated dalla base class (manuale).

## 12. Lit subpath integration

Two-tier pattern (D-V2-F17-07):

1. **`GlueZeroController`** — `ReactiveController` building block per Lit avanzato.
2. **`GlueZeroLitMixin`** — class mixin ergonomic per uso comune (raccomandato).

Snippet Mixin copy-paste:

```typescript
import { LitElement, html } from 'lit';
import { GlueZeroLitMixin } from '@gluezero/web-components/lit';

class MyMfEl extends GlueZeroLitMixin(LitElement) {
  override connectedCallback() {
    super.connectedCallback();
    this.gluezero.subscribe('topic.x', (e) => this.handle(e));
  }

  override render() {
    return html`<button @click="${() => this.gluezero.publish('clicked', {})}">+</button>`;
  }

  handle(_: unknown) { /* ... */ }
}

customElements.define('my-mf-el', MyMfEl);
```

Peer optional: `lit: >=3.0.0 <4.0.0`. NO import statico `lit` a livello modulo
(peerDependenciesMeta.lit.optional = true). Importa direttamente da `'lit'` solo quando usi il subpath.

## 13. FAQ + Riferimenti

- **Bug + feature requests:** [GitHub Issues](https://github.com/omardimarzio/GlueZero/issues)
- **PRD §15 — Loader Web Component:** [prd_2.0.0.md](../../prd_2.0.0.md)
- **PRD §28.3 — Web Components adapter:** [prd_2.0.0.md](../../prd_2.0.0.md)
- **docs/v2 hub:** [docs/v2/index.md](../../docs/v2/index.md)
- **Migration guide:** [docs/v2/17-migration-guide.md](../../docs/v2/17-migration-guide.md)
- **TypeDoc API reference:** https://omardimarzio.github.io/GlueZero/v2/api/

## License

MIT — vedi [LICENSE](../../LICENSE).
