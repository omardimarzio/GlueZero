# GlueZero v2.0 — Documentazione

Benvenuto nella documentazione di **GlueZero v2.0**. v2.0 estende v1.x con un **MF Layer**
opzionale (broker + lifecycle FSM 14 stati + governance + adapter framework React/WC),
preservando backward compatibility bit-exact su `createBroker({})` (BC §42).

## Per dove iniziare

- **Nuovo in GlueZero?** → [01 — Architettura v2.0](./01-architecture.md)
- **Migrazione da v1.x?** → [17 — Migration guide v1.x → v2.0](./17-migration-guide.md)
- **Quick start React?** → [README @gluezero/react](../../packages/react/README.md)
- **Quick start Web Components?** → [README @gluezero/web-components](../../packages/web-components/README.md)
- **Performance & bundle?** → [18 — Performance & Bundle](./18-performance-bundle.md)

## 18 Documenti

### Architettura & Concetti

1. [Architettura v2.0](./01-architecture.md)
2. [Core vs MF Layer](./02-core-vs-mf.md)
3. [MicroFrontendDescriptor](./03-descriptor.md)
4. [Lifecycle FSM 14 stati](./04-lifecycle.md)
5. [Loaders (5 strategies)](./05-loaders.md)

### Governance

6. [Isolation (mount-root / scoped / shadow-dom)](./06-isolation.md)
7. [Context (RuntimeContext 11 chiavi)](./07-context.md)
8. [Permissions (deny-wins order-independent)](./08-permissions.md)
9. [Capabilities (first-wins)](./09-capabilities.md)
10. [Compat / Versioning (9 dimensioni semver)](./10-compat-versioning.md)
11. [Fallback (circuit → retry → render)](./11-fallback.md)
12. [Devtools MF (14 metriche + 17 fields)](./12-devtools-mf.md)

### Esempi

13. [Esempi ESM (`mf-esm`)](./13-examples-esm.md)
14. [Esempi Web Component (`mf-web-component` + `@gluezero/web-components`)](./14-examples-wc.md)
15. [Esempi iframe sandbox (`mf-iframe`)](./15-examples-iframe.md)
16. [Esempi React adapter (`@gluezero/react`)](./16-examples-react.md)

### Migration & Performance

17. [Migration guide v1.x → v2.0 (adoption levels A/B/C)](./17-migration-guide.md)
18. [Performance & Bundle impact (cap per-package + bench gate)](./18-performance-bundle.md)

## API reference (TypeDoc)

Generated TypeDoc API reference per ogni package: https://omardimarzio.github.io/GlueZero/v2/api/

## Audit copertura README package (15 carryover + 2 NEW F17)

| Package | Stato | README | docs/v2/ correlato |
|---------|-------|--------|---------------------|
| `@gluezero/core` | F1 GA | [README](../../packages/core/README.md) | [01](./01-architecture.md), [02](./02-core-vs-mf.md) |
| `@gluezero/mapper` | F2 GA | [README](../../packages/mapper/README.md) | [07](./07-context.md) |
| `@gluezero/routing` | F3 GA | [README](../../packages/routing/README.md) | — |
| `@gluezero/gateway` | F3 GA | [README](../../packages/gateway/README.md) | — |
| `@gluezero/worker` | F4 GA | [README](../../packages/worker/README.md) | — |
| `@gluezero/cache` | F5 GA | [README](../../packages/cache/README.md) | — |
| `@gluezero/theme` | F7 GA | [README](../../packages/theme/README.md) | [06](./06-isolation.md) |
| `@gluezero/devtools` | F6 + F16 GA | [README](../../packages/devtools/README.md) | [12](./12-devtools-mf.md) |
| `@gluezero/microfrontends` | F8 GA | [README](../../packages/microfrontends/README.md) | [03](./03-descriptor.md), [04](./04-lifecycle.md) |
| `@gluezero/mf-esm` | F9 GA | [README](../../packages/mf-esm/README.md) | [13](./13-examples-esm.md) |
| `@gluezero/context` | F10 GA | [README](../../packages/context/README.md) | [07](./07-context.md) |
| `@gluezero/permissions` | F11 GA | [README](../../packages/permissions/README.md) | [08](./08-permissions.md), [09](./09-capabilities.md) |
| `@gluezero/compat` | F12 GA | [README](../../packages/compat/README.md) | [10](./10-compat-versioning.md) |
| `@gluezero/isolation` | F13 GA | [README](../../packages/isolation/README.md) | [06](./06-isolation.md) |
| `@gluezero/fallbacks` | F14 GA | [README](../../packages/fallbacks/README.md) | [11](./11-fallback.md) |
| `@gluezero/mf-web-component` | F15 GA | [README](../../packages/mf-web-component/README.md) | [14](./14-examples-wc.md) |
| `@gluezero/mf-iframe` | F15 GA | [README](../../packages/mf-iframe/README.md) | [15](./15-examples-iframe.md) |
| `@gluezero/mf-module-federation` | F15 experimental | [README](../../packages/mf-module-federation/README.md) | [05](./05-loaders.md) |
| `@gluezero/mf-single-spa` | F15 experimental | [README](../../packages/mf-single-spa/README.md) | [05](./05-loaders.md) |
| `@gluezero/gluezero` (umbrella) | F1-F6 carryover | [README](../../packages/gluezero/README.md) | — |
| **`@gluezero/react` (F17 NEW)** | F17 GA | [README](../../packages/react/README.md) | [16](./16-examples-react.md) |
| **`@gluezero/web-components` (F17 NEW)** | F17 GA | [README](../../packages/web-components/README.md) | [14](./14-examples-wc.md) |

## Riferimenti

- [PRD v2.0](../../prd_2.0.0.md)
- [GitHub repo](https://github.com/omardimarzio/GlueZero)
- [.planning/ROADMAP.md](../../.planning/ROADMAP.md) (work-in-progress fasi GSD)

## License

MIT — vedi [LICENSE](../../LICENSE).
