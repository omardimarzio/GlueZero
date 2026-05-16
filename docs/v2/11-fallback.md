# 11 — Fallback

`@gluezero/fallbacks` (F14) è il modulo opt-in che fornisce **layer di fallback & error
boundary** per i MF gestiti da `@gluezero/microfrontends`. Subscribe esternamente ai 7
`MF_ERROR_TOPICS` di F8 e applica una catena `circuit → retry → fallback render` per
ciascun MF, **senza modificare** il codice del MF stesso.

## Quick start

```typescript
import { createBroker } from '@gluezero/core';
import { microFrontendModule } from '@gluezero/microfrontends';
import { fallbacksModule } from '@gluezero/fallbacks';

const broker = createBroker({
  modules: [
    microFrontendModule(),
    fallbacksModule({
      defaults: {
        retry: { attempts: 3, backoff: 'exponential', initialDelay: 200 },
        circuit: { threshold: 5, windowMs: 30000, halfOpenAfterMs: 60000 },
        onMountError: 'retry',
        onRuntimeError: 'fallback-ui',
      },
      perMf: {
        payment: { circuit: { threshold: 2 } }, // più strict per MF critical
      },
    }),
  ],
});
```

## API reference

Documentazione API completa: vedi [@gluezero/fallbacks](../../packages/fallbacks/README.md).

## Catena `circuit → retry → fallback`

Quando un MF errors (mount.failed o runtime.failed):

1. **Circuit check**: se circuit è `open`, skip retry e applica fallback direttamente.
2. **Retry**: se circuit è `closed` o `half-open`, retry `attempts` volte con backoff.
3. **Fallback**: se retry esauriti, applica `onMountError` / `onRuntimeError` policy.

## Policy `onMountError` / `onRuntimeError`

| Policy | Comportamento |
|--------|---------------|
| `retry` | Retry secondo config (con circuit breaker). |
| `fallback-ui` | Render un fallback DOM nel container (`<div class="mf-error">...</div>` default). |
| `unmount` | Unmount completo del MF (cleanup). |
| `propagate` | Re-throw per gestione manuale (no broker-level fallback). |

## Integration con React ErrorBoundary (F17)

`@gluezero/react` espone `<GlueZeroErrorBoundary>` (class component) che:

1. Catch errors del child tree.
2. Publish `microfrontend.runtime.failed` con `{microFrontendId, error}`.
3. Delega la decisione a `@gluezero/fallbacks` (`SERVICE_FALLBACKS`) se installato.
4. Render `fallback` prop se F14 non installato (graceful degradation).

```tsx
<GlueZeroErrorBoundary microFrontendId="cart" fallback={<CartUnavailable />}>
  <CartView />
</GlueZeroErrorBoundary>
```

## 7 MF_ERROR_TOPICS subscribed

- `microfrontend.descriptor.invalid`
- `microfrontend.load.failed`
- `microfrontend.bootstrap.failed`
- `microfrontend.mount.failed`
- `microfrontend.unmount.failed`
- `microfrontend.destroy.failed`
- `microfrontend.runtime.failed`

## Decisioni v2.0 lockate

- **D-V2-F14-01** — `microfrontend.runtime.failed` come topic single point per error post-mount.
- **D-V2-F14-02** — Catena `circuit → retry → fallback` fissa (order non configurabile).
- **D-V2-F14-03** — Subscribe esterno ai 7 MF_ERROR_TOPICS (no modifica F8 source).
- **D-V2-F17-04** — `GlueZeroErrorBoundary` delega `SERVICE_FALLBACKS` quando F14 attivo.

## Riferimenti

- [PRD §24 — Fallback](../../prd_2.0.0.md)
- [README @gluezero/fallbacks](../../packages/fallbacks/README.md)
- [04 — Lifecycle FSM](./04-lifecycle.md)
- [16 — Esempi React adapter](./16-examples-react.md)
- [README @gluezero/react](../../packages/react/README.md)
