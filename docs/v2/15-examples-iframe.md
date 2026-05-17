# 15 — Esempi iframe sandbox

Showcase del loader **`@gluezero/mf-iframe`** — la strategy con **security boundary forte**:
ogni MF gira in un iframe sandbox separato con bridge `postMessage` autenticato.

Usalo quando:

- I MF provengono da team o organizzazioni esterne (multi-tenant SaaS).
- Servono guarantee di isolation forte (DOM + JS + storage + globals).
- Il MF è third-party non trusted o legacy code da quarantine.

## Quick start

```typescript
import { createBroker } from '@gluezero/core';
import { microFrontendModule } from '@gluezero/microfrontends';
import { mfIframeModule } from '@gluezero/mf-iframe';

const broker = createBroker({
  modules: [microFrontendModule(), mfIframeModule()],
});

await broker.registerMicroFrontend({
  id: 'payment',
  version: '3.0.0',
  loader: {
    type: 'iframe',
    url: 'https://payment.example.com/mf.html',
    expectedOrigin: 'https://payment.example.com', // MANDATORY (D-V2-09)
    sandbox: ['allow-scripts', 'allow-same-origin', 'allow-forms'],
  },
});

await broker.mountMicroFrontend('payment', {
  container: document.getElementById('payment-slot')!,
});
```

## Bridge protocol

Il loader crea un iframe + handshake init con il MF via 9 message types (PRD §16):

1. `init` — host → mf — invio del broker contract initial.
2. `init-ack` — mf → host — conferma readiness.
3. `publish` — bi-direzionale — forward del topic publish.
4. `subscribe` — mf → host — richiesta di subscribe a topic remoto.
5. `unsubscribe` — mf → host.
6. `event` — host → mf — delivery di un evento subscribed.
7. `ping` / `pong` — liveness check (timeout-driven reconnect).
8. `error` — bi-direzionale — propagazione errori per fallback.

Il bridge usa **LRU dedup** (200 entry default) per evitare echo del messaggio originator.
L'origin check di `event.origin === expectedOrigin` è obbligatorio (closure security
boundary, D-V2-09 — chiude pitfall postMessage spoofing).

## Struttura del MF iframe

Il MF è un'app autonoma (HTML completo) che importa il bridge SDK:

```html
<!-- https://payment.example.com/mf.html -->
<!DOCTYPE html>
<html lang="it">
  <head>
    <meta charset="UTF-8" />
    <title>Payment MF</title>
  </head>
  <body>
    <div id="root"></div>

    <script type="module">
      import { createIframeMfBridge } from '@gluezero/mf-iframe/runtime';

      const bridge = await createIframeMfBridge({
        expectedOrigin: 'https://shell.example.com', // origin della shell
      });

      bridge.subscribe('payment.intent.created', (event) => {
        document.getElementById('root').textContent = `Pay ${event.data.amount}`;
      });

      bridge.publish('payment.mounted', { ts: Date.now() });
    </script>
  </body>
</html>
```

## Esempio HTML standalone

Vedi [`examples/microfrontends/mf-iframe-sandbox.html`](../../examples/microfrontends/mf-iframe-sandbox.html)
— include due iframe demo + bridge handshake observability + close pitfall postMessage spoofing.

## Use case tipici

- MF third-party (widget pubblicità, payment provider, chat service).
- Multi-tenant SaaS con team boundary forte.
- Quarantine di legacy code (jQuery, Angular 1.x) senza interferenza con shell moderna.

## Limitazioni

- **Overhead memoria**: ogni iframe ha context JS separato (~5-10 MB per iframe).
- **Latency bridge**: ogni publish/subscribe attraversa `postMessage` (~0.5-2 ms per round-trip).
- **No shared services**: i service registry del broker non sono accessibili nel MF iframe
  (solo topics via bridge).
- **No shared DOM ref**: il MF non può ricevere `container: HTMLElement` (il container è
  l'iframe stesso).

## Decisioni v2.0 lockate

- **D-V2-09** — `expectedOrigin` mandatory; null/undefined → throw sincrono.
- **D-V2-F15-IF-01** — LRU dedup 200 entry per closure attack prevention.
- **D-V2-F15-IF-02** — Bridge handshake con ping/pong timeout 5s default.

## Riferimenti

- [README @gluezero/mf-iframe](../../packages/mf-iframe/README.md)
- [03 — Descriptor](./03-descriptor.md)
- [06 — Isolation](./06-isolation.md)
- [`examples/microfrontends/mf-iframe-sandbox.html`](../../examples/microfrontends/mf-iframe-sandbox.html)
- [PRD §16 — Loader iframe](../../prd_2.0.0.md)
