# 04 — Lifecycle FSM

`@gluezero/microfrontends` (F8) implementa una **finite-state machine 14 stati** che governa
il ciclo di vita di ogni micro-frontend registrato. Tutte le transizioni sono osservabili
via 29 standard topics + 7 MF_ERROR_TOPICS.

## Quick start

```typescript
import { createBroker } from '@gluezero/core';
import { microFrontendModule } from '@gluezero/microfrontends';

const broker = createBroker({
  modules: [microFrontendModule()],
});

// Observability lifecycle
broker.subscribe('microfrontend.state.changed', (event) => {
  console.log(`${event.data.microFrontendId}: ${event.data.from} → ${event.data.to}`);
});

await broker.registerMicroFrontend({ id: 'cart', version: '1.0.0', /* ... */ });
await broker.mountMicroFrontend('cart', { container });
```

## API reference

Documentazione API completa: vedi [@gluezero/microfrontends](../../packages/microfrontends/README.md).

## I 14 stati FSM

Stati ordinati per fase logica:

1. `unregistered` — stato iniziale (descriptor non noto al broker).
2. `registering` — `registerMicroFrontend` in corso (sync validation).
3. `registered` — descriptor validato, pronto per load.
4. `loading` — loader sta scaricando il modulo MF (ESM/WC/iframe).
5. `loaded` — modulo scaricato, hook esportati identificati.
6. `bootstrapping` — `bootstrap` hook in esecuzione.
7. `bootstrapped` — bootstrap completed, pronto per mount.
8. `mounting` — `mount` hook in esecuzione (DOM in costruzione).
9. `mounted` — MF live, visible nel DOM.
10. `unmounting` — `unmount` hook in esecuzione (cleanup DOM).
11. `unmounted` — DOM cleanup completed, ready per re-mount.
12. `destroying` — `destroy` hook in esecuzione (cleanup globale).
13. `destroyed` — MF rimosso definitivamente dal registry.
14. `failed` — error state da qualsiasi transizione (vedi MF_ERROR_TOPICS).

## Transition diagram

```
unregistered ──register──→ registering ──ok──→ registered
                                │
                                ▼ (error)
                            failed
registered ──load──→ loading ──ok──→ loaded ──bootstrap──→ bootstrapping ──ok──→ bootstrapped
loaded ──mount──→ mounting ──ok──→ mounted ──unmount──→ unmounting ──ok──→ unmounted
unmounted ──mount──→ mounting (re-mount cycle)
unmounted ──destroy──→ destroying ──ok──→ destroyed
```

## 29 standard topics

Tre famiglie:

- **Registration**: `microfrontend.descriptor.registered`, `microfrontend.descriptor.unregistered`, `microfrontend.descriptor.invalid`.
- **Lifecycle transitions**: 1 per ogni transizione (e.g. `microfrontend.bootstrap.started`, `microfrontend.mount.completed`).
- **State change**: `microfrontend.state.changed` (catch-all con `from`/`to`).

Vedi [README @gluezero/microfrontends](../../packages/microfrontends/README.md) per l'elenco completo.

## 7 MF_ERROR_TOPICS

Pubblicati su transizione fallita:

- `microfrontend.descriptor.invalid`
- `microfrontend.load.failed`
- `microfrontend.bootstrap.failed`
- `microfrontend.mount.failed`
- `microfrontend.unmount.failed`
- `microfrontend.destroy.failed`
- `microfrontend.runtime.failed` (errore runtime post-mount — publicato da F14 fallback + F17 React ErrorBoundary)

## Decisioni v2.0 lockate

- **D-V2-F8-3** — 14 stati FSM come union finita (no extension custom).
- **D-V2-F8-4** — Transizioni atomiche con publish state changed dopo successo.
- **D-V2-F14-01** — `microfrontend.runtime.failed` come topic single point per error post-mount.

## Riferimenti

- [PRD §10 — Lifecycle](../../prd_2.0.0.md)
- [PRD §31 — Standard topics](../../prd_2.0.0.md)
- [README @gluezero/microfrontends](../../packages/microfrontends/README.md)
- [03 — Descriptor](./03-descriptor.md)
- [11 — Fallback](./11-fallback.md)
