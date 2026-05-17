# 10 — Compat / Versioning

`@gluezero/compat` (F12) è il modulo opt-in che fornisce **semver-based compat check
multi-dimensione** per micro-frontend governance. 9 dimensioni di version contract con 5
policy applicate al register/load/mount.

## Quick start

```typescript
import { createBroker } from '@gluezero/core';
import { microFrontendModule } from '@gluezero/microfrontends';
import { compatModule } from '@gluezero/compat';

const broker = createBroker({
  modules: [
    microFrontendModule(),
    compatModule({
      hostVersion: '2.0.0',
      policy: 'block-mount', // default
    }),
  ],
});

await broker.registerMicroFrontend({
  id: 'cart',
  version: '1.5.0',
  compat: {
    gluezero: '^2.0.0', // minimum host broker version
    canonicalModels: { user: '^1.0.0' }, // mapper F2 canonical version
  },
  // ...
});
```

Se il host runs `@gluezero/core@1.9.x` e il MF richiede `^2.0.0`, il broker pubblica
`microfrontend.compatibility.failed` + blocca il mount (con policy `block-mount`).

## API reference

Documentazione API completa: vedi [@gluezero/compat](../../packages/compat/README.md).

## 9 dimensioni di version contract

| Dimensione | Descrizione | Esempio constraint |
|------------|-------------|---------------------|
| `gluezero` | Host broker version | `^2.0.0` |
| `canonicalModels` | Mapper F2 canonical model version | `{user: '^1.0.0'}` |
| `topics` | Standard topics version (29 F8) | `'>=29.0.0'` |
| `routes` | Route schema version | `'^1.0.0'` |
| `workers` | Worker bridge protocol version | `'^1.0.0'` |
| `theme` | Theme tokens version | `'^1.1.0'` |
| `loaders` | Loader protocol version | `{esm: '^1.0.0'}` |
| `framework` | Framework adapter peer version | `{react: '>=18.2.0 <20.0.0'}` |
| `dependencies` | Generic peer deps | `{lit: '^3.0.0'}` |

## 5 policy applicabili

| Policy | Comportamento |
|--------|---------------|
| `off` | Nessun check (skip totale del module). |
| `warn` | Log warn ma continua execution. |
| `block-registration` | Fail al register (descriptor non entra nel registry). |
| `block-load` | Register OK ma load module fallisce. |
| `block-mount` | Load OK ma mount fallisce (default). |

La policy può essere globale (in `compatModule({policy: ...})`) o override per-MF nel descriptor.

## Topic single point

`microfrontend.compatibility.failed` con payload `{microFrontendId, dimension, constraint, actual}`
permette UI feedback granulare:

```typescript
broker.subscribe('microfrontend.compatibility.failed', (event) => {
  console.error(`MF ${event.data.microFrontendId}: dimensione ${event.data.dimension} non compatibile`);
  console.error(`  Constraint: ${event.data.constraint}, Actual: ${event.data.actual}`);
});
```

## Bundle impact

Il package include `semver` 7.x **tree-shaken** (~6 KB delta). Total package gzip ≤ 9 KB.

## Decisioni v2.0 lockate

- **D-V2-13** — Default policy `block-mount` (più permissivo di `block-registration`,
  più strict di `warn`).
- **D-V2-14** — 9 dimensioni come union finita V2.0 (extension custom deferred V2.1).
- **D-V2-F12-01** — `semver` 7.x tree-shaken come sola peer non-opzionale.

## Riferimenti

- [PRD §23 — Compat / Versioning](../../prd_2.0.0.md)
- [README @gluezero/compat](../../packages/compat/README.md)
- [09 — Capabilities](./09-capabilities.md)
- [17 — Migration guide](./17-migration-guide.md)
