# 05 — Loaders

GlueZero v2.0 supporta **5 loader strategies** per integrare micro-frontend. Ogni loader è
un module opt-in da installare in `createBroker({modules: [...]})`. Solo i loader registrati
sono utilizzabili dai descriptor.

## Quick start

```typescript
import { createBroker } from '@gluezero/core';
import { microFrontendModule } from '@gluezero/microfrontends';
import { mfEsmModule } from '@gluezero/mf-esm';

const broker = createBroker({
  modules: [
    microFrontendModule(),
    mfEsmModule(), // abilita loader.type === 'esm'
  ],
});
```

## API reference

Documentazione API completa: vedi i README dei singoli package linkati nella tabella sotto.

## Tabella decisioni — quale loader scegliere

| Loader | Stato | Bundle gzip | Use case principale | Trade-off |
|--------|-------|-------------|---------------------|-----------|
| **`@gluezero/mf-esm`** | GA | ≤ 2 KB | **Default raccomandato** per nuovi progetti. ESM nativi, browser evergreen. | Richiede CORS + browser ESM support; no fallback automatico cross-browser legacy. |
| **`@gluezero/mf-web-component`** | GA | ≤ 3 KB | MF framework-agnostic (vanilla, Lit, Stencil). Shadow DOM isolation forte. | Il MF deve chiamare `customElements.define` (no auto-register). |
| **`@gluezero/mf-iframe`** | GA | ≤ 10 KB | MF third-party, multi-tenant SaaS, security boundary forte. | Overhead memoria + latency bridge postMessage; no shared services. |
| **`@gluezero/mf-module-federation`** | experimental | ≤ 5 KB | Integration con app già su Module Federation (webpack 5 / rspack). | Peer `@module-federation/runtime` 2.4.x; complessità setup; non GA. |
| **`@gluezero/mf-single-spa`** | experimental | ≤ 3 KB | Migration graduale da progetti single-spa esistenti. | Peer `single-spa` ^5.9 ‖ ^6; deferred GA V2.1 (D-V2-23). |

## Decision tree

```
È nuovo progetto?
├── Sì → mf-esm (default)
│        Eccezione: bisogno shadow DOM forte → mf-web-component
│        Eccezione: third-party non trusted → mf-iframe
└── No (migration)
   ├── App webpack 5 Module Federation? → mf-module-federation
   ├── App single-spa? → mf-single-spa
   └── App legacy isolata? → mf-iframe (quarantine)
```

## Combinazione multi-loader

Tutti i loader possono essere installati simultaneamente. Il broker seleziona il loader giusto
in base a `descriptor.loader.type`:

```typescript
const broker = createBroker({
  modules: [
    microFrontendModule(),
    mfEsmModule(),         // type === 'esm'
    mfWebComponentModule(), // type === 'web-component'
    mfIframeModule(),       // type === 'iframe'
  ],
});

await broker.registerMicroFrontend({ id: 'cart', loader: { type: 'esm', url: '...' } });
await broker.registerMicroFrontend({ id: 'header', loader: { type: 'web-component', url: '...' } });
await broker.registerMicroFrontend({ id: 'payment', loader: { type: 'iframe', url: '...' } });
```

## Decisioni v2.0 lockate

- **D-V2-F9-01** — `mf-esm` smart fallback export priority `default > named > module-itself`.
- **D-V2-F15-WC** — `mf-web-component` non chiama `customElements.define` (responsabilità del MF).
- **D-V2-09** — `mf-iframe` `expectedOrigin` mandatory (closure security boundary).
- **D-V2-23** — `mf-module-federation` + `mf-single-spa` mantenuti experimental in V2.0 GA;
  GA planning V2.1.

## Riferimenti

- [13 — Esempi ESM](./13-examples-esm.md)
- [14 — Esempi Web Component](./14-examples-wc.md)
- [15 — Esempi iframe](./15-examples-iframe.md)
- [README @gluezero/mf-esm](../../packages/mf-esm/README.md)
- [README @gluezero/mf-web-component](../../packages/mf-web-component/README.md)
- [README @gluezero/mf-iframe](../../packages/mf-iframe/README.md)
- [README @gluezero/mf-module-federation](../../packages/mf-module-federation/README.md)
- [README @gluezero/mf-single-spa](../../packages/mf-single-spa/README.md)
- [PRD §11-16 — Loaders](../../prd_2.0.0.md)
