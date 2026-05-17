# 06 — Isolation

`@gluezero/isolation` (F13) è il modulo opt-in che fornisce **isolation policy + facade
injection** per micro-frontend governance. Copre DOM/CSS/JS/Events/Storage/Network/Globals
(PRD §21.3) con 4 facade (storage, gateway, worker, theme) integrate con permissions (F11)
e theme tokens (v1.1, adoptedStyleSheets D-F7-22 carryover).

## Quick start

```typescript
import { createBroker } from '@gluezero/core';
import { microFrontendModule } from '@gluezero/microfrontends';
import { isolationModule } from '@gluezero/isolation';

const broker = createBroker({
  modules: [
    microFrontendModule(),
    isolationModule({
      default: 'mount-root', // opt-in default (D-V2-13)
    }),
  ],
});

await broker.registerMicroFrontend({
  id: 'cart',
  isolation: 'shadow-dom', // override per-MF
  // ...
});
```

## API reference

Documentazione API completa: vedi [@gluezero/isolation](../../packages/isolation/README.md).

## 3 policy isolation

| Policy | DOM scope | CSS isolation | Use case |
|--------|-----------|---------------|----------|
| **`mount-root`** | container element | nessuna (CSS global) | Default opt-in. MF trust alto, no risk CSS bleed. |
| **`scoped`** | container + CSS attribute scoping | attribute `data-mf-id` su ogni rule | Trust medio. Evita CSS bleed senza overhead shadow DOM. |
| **`shadow-dom`** | shadow root | totale (shadow boundary) | Trust basso. Third-party MF, theme reset forte. |

## Decisione `mount-root` default

`shadow-dom` è **opt-in esplicito** (D-V2-13). Motivazione:

- Shadow DOM ha overhead memoria (~10-20 KB per shadow root).
- Shadow DOM rompe form-association + a11y in edge case (form-associated CE deferred V2.1).
- La maggioranza dei progetti hanno MF trust alto (mono-team).

## Theme integration

Quando `theme` module v1.1 è attivo, `isolation` injecta automaticamente:

- `adoptedStyleSheets` con theme tokens (D-F7-22) nel shadow root (se `shadow-dom`).
- CSS variable scoping su mount root (se `scoped`).
- Niente injection (se `mount-root`).

## Facade injection

`isolation` espone 4 facade nel `MicroFrontendRuntimeContext`:

```typescript
context.isolation.storage // storage facade con namespacing automatic
context.isolation.gateway // gateway facade con permission check pre-fetch
context.isolation.worker  // worker facade con registry scoped
context.isolation.theme   // theme facade con token resolution
```

Le facade applicano permission check (F11) trasparentemente — il MF non vede mai una richiesta
non autorizzata che vada in errore (è bloccata a livello facade prima di hit il backend).

## Decisioni v2.0 lockate

- **D-V2-13** — `mount-root` come default isolation policy.
- **D-V2-F13-01** — 4 facade (storage, gateway, worker, theme) injection nel `MicroFrontendRuntimeContext`.
- **D-F7-22 carryover** — `adoptedStyleSheets` integration con `@gluezero/theme` v1.1.

## Riferimenti

- [PRD §21.3 — Isolation](../../prd_2.0.0.md)
- [README @gluezero/isolation](../../packages/isolation/README.md)
- [07 — Context](./07-context.md)
- [08 — Permissions](./08-permissions.md)
- [14 — Esempi Web Component](./14-examples-wc.md)
