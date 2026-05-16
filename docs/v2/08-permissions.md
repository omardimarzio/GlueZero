# 08 — Permissions

`@gluezero/permissions` (F11) è il modulo opt-in che fornisce **permission engine sincrono**
(no async I/O nel hot path) per:

- **Event allow/deny** — chi può publish/subscribe a quale topic.
- **Topic ACL** — pattern matching con 4 modi (exact / prefix / glob / regex).
- **LRU cache** 500 entries event-driven invalidation.
- **Deny-wins order-independent** semantics.
- **Pipeline §28 extension** — permission check come step opt-in del pipeline broker.

## Quick start

```typescript
import { createBroker } from '@gluezero/core';
import { microFrontendModule } from '@gluezero/microfrontends';
import { permissionsModule } from '@gluezero/permissions';

const broker = createBroker({
  modules: [
    microFrontendModule(),
    permissionsModule({
      rules: [
        { mf: 'cart', topicsAllow: ['cart.*', 'order.*'] },
        { mf: 'cart', topicsDeny: ['cart.internal.*'] }, // deny-wins
        { mf: 'header', topicsAllow: ['user.*'], capabilities: ['user.read'] },
      ],
    }),
  ],
});

await broker.registerMicroFrontend({
  id: 'cart',
  capabilities: ['cart.write'], // dichiarato dal MF
  // ...
});
```

## API reference

Documentazione API completa: vedi [@gluezero/permissions](../../packages/permissions/README.md).

## 4 pattern matching modes

| Mode | Sintassi | Esempio match | Esempio NO match |
|------|----------|---------------|------------------|
| **exact** | `'cart.added'` | `'cart.added'` | `'cart.removed'` |
| **prefix** | `'cart.*'` | `'cart.added'`, `'cart.x.y'` | `'order.added'` |
| **glob** | `'**.error'` | `'cart.error'`, `'a.b.error'` | `'error.cart'` |
| **regex** | `/^cart\.(added\|removed)$/` | `'cart.added'`, `'cart.removed'` | `'cart.updated'` |

## Deny-wins order-independent

Se anche una sola rule denies un topic, l'access è bloccato. L'ordine delle rules non conta:

```typescript
// Equivalente alla rule dell'esempio Quick start
rules: [
  { mf: 'cart', topicsDeny: ['cart.internal.*'] }, // DENY (block-all internal)
  { mf: 'cart', topicsAllow: ['cart.*'] },          // ALLOW (eccetto internal)
]
```

Una publish a `cart.internal.secret` da MF `cart` è **bloccata** (deny applica).

## Permission denied flow

Quando una operation è denied:

1. Pipeline step ferma l'esecuzione (no event delivery downstream).
2. Topic `microfrontend.permission.denied` viene publicato con `{microFrontendId, topic, action}`.
3. Il MF originator può subscribe a questo topic per UI feedback.

## LRU cache 500 entries

Il pattern match risultato è cached con LRU 500 entries. Invalidation eventi:

- `register_microfrontend` — cache evict per nuovo MF.
- `unregister_microfrontend` — cache evict per MF rimosso.
- `update_rules` — cache full clear.

## Decisioni v2.0 lockate

- **D-V2-F11-01** — Permission engine sincrono (no async I/O nel hot path).
- **D-V2-F11-02** — Deny-wins order-independent semantics.
- **D-V2-F11-03** — LRU cache 500 entries event-driven invalidation.
- **D-V2-F11-04** — `microfrontend.permission.denied` come topic single point.

## Riferimenti

- [PRD §22 — Permissions](../../prd_2.0.0.md)
- [README @gluezero/permissions](../../packages/permissions/README.md)
- [09 — Capabilities](./09-capabilities.md)
- [04 — Lifecycle FSM](./04-lifecycle.md)
