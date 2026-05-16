# 17 — Migration guide v1.x → v2.0

Guida step-by-step per migrare un progetto da GlueZero v1.x a v2.0. La migration è
**gradualmente adottabile** in tre livelli (A → B → C) — ogni livello è additive e non
forza l'adozione del successivo.

> **Vincolo fondamentale BC §42:** v2.0 è retro-compatibile **bit-exact** con v1.x.
> Senza configurazione esplicita di moduli, `createBroker({})` produce un broker semanticamente
> identico a v1.x. Le 14 API public del broker sono preservate (publish, subscribe,
> registerService, getService, e altre 10).

## Adoption levels overview

| Livello | Scope | Bundle delta | Setup complexity |
|---------|-------|--------------|------------------|
| **A** — Zero-change v1.x | Solo upgrade dipendenza | ≤ +350 B | Zero |
| **B** — Opt-in MF basic | + microfrontends + 1 loader | +6 KB | Bassa |
| **C** — Production governance | Full stack F8-F17 | +52 KB | Media |

Il path raccomandato è iterativo: parti da A → eleva a B quando hai il primo MF →
eleva a C quando aggiungi il secondo team o esponi production-critical MF.

---

## Livello A — Zero-change v1.x semantics

**Use case:** progetti v1.x stable che vogliono ottenere security/maintenance updates
v2.0 senza adottare MF features.

**Cosa fare:**

1. Aggiorna versione package:
   ```bash
   pnpm up @gluezero/core@2.0.0
   ```
2. Nessuna modifica al codice. `createBroker({})` rimane bit-exact v1.x.

**Verifica:**

- `pnpm test` PASS senza modifiche al test suite.
- Bundle delta ≤ +350 B (D-V2-21 PASS — cap raise 8870 B documented).
- BC §42 14 API public preservate (publish/subscribe/registerService/getService/...).

**Vantaggio:** upgrade safe per security/maintenance senza adottare MF features.
La pipeline §28 funziona esattamente come v1.x.

---

## Livello B — Opt-in MF basic

**Use case:** shell semplice con 1-3 MF ESM caricati on-demand, lifecycle governance F8 standard,
no permissions/compat/isolation/fallback advanced.

**Cosa aggiungere:**

```typescript
import { createBroker } from '@gluezero/core';
import { microFrontendModule } from '@gluezero/microfrontends';
import { mfEsmModule } from '@gluezero/mf-esm';

const broker = createBroker({
  modules: [
    microFrontendModule(),
    mfEsmModule(),
  ],
});

await broker.registerMicroFrontend({
  id: 'cart',
  version: '1.0.0',
  loader: { type: 'esm', url: '/mf/cart.js' },
  bootstrap: 'bootstrap',
  mount: 'mount',
  unmount: 'unmount',
});

await broker.mountMicroFrontend('cart', {
  container: document.getElementById('cart-slot')!,
});
```

**Cosa NON aggiungere (vs Livello C):**

- `permissions` (controllo manuale dei topic boundary).
- `compat` (no semver check inter-MF).
- `isolation` (CSS bleed possibile tra MF).
- `fallbacks` (error handling manuale).
- `devtools/mf-inspector` (debug solo via base v1.x inspector).

**Vantaggio:** lifecycle governance F8 + standard topics (29 PRD §31) + zero ulteriore complessità.
Setup ~10 minuti per il primo MF.

---

## Livello C — Production MF Governance

**Use case:** enterprise multi-team multi-MF SaaS, production-critical, security boundary forte
inter-MF, observability completa via devtools.

**Cosa aggiungere:**

```typescript
import { createBroker } from '@gluezero/core';
import { microFrontendModule } from '@gluezero/microfrontends';
import { mfEsmModule } from '@gluezero/mf-esm';
import { mfWebComponentModule } from '@gluezero/mf-web-component';
import { mfIframeModule } from '@gluezero/mf-iframe';
import { permissionsModule } from '@gluezero/permissions';
import { compatModule } from '@gluezero/compat';
import { isolationModule } from '@gluezero/isolation';
import { fallbacksModule } from '@gluezero/fallbacks';
import { devtoolsModule } from '@gluezero/devtools';
import { mfInspectorModule } from '@gluezero/devtools/mf-inspector';

const broker = createBroker({
  modules: [
    microFrontendModule(),
    mfEsmModule(),
    mfWebComponentModule(),
    mfIframeModule(),
    permissionsModule({
      rules: [
        { mf: 'cart', topicsAllow: ['cart.*', 'order.*'] },
        { mf: 'payment', topicsAllow: ['payment.*'], topicsDeny: ['cart.internal.*'] },
      ],
    }),
    compatModule({ hostVersion: '2.0.0', policy: 'block-mount' }),
    isolationModule({ default: 'mount-root' }),
    fallbacksModule({
      defaults: {
        retry: { attempts: 3, backoff: 'exponential', initialDelay: 200 },
        circuit: { threshold: 5, windowMs: 30000 },
        onMountError: 'retry',
        onRuntimeError: 'fallback-ui',
      },
    }),
    devtoolsModule(),
    mfInspectorModule(),
  ],
});

// Framework adapter per MF basati su React (F17)
import { createReactMicroFrontendLifecycle } from '@gluezero/react';
import { CartRoot } from './cart-mf/index.js';

const cartLifecycle = createReactMicroFrontendLifecycle(CartRoot, { strictMode: true });

await broker.registerMicroFrontend({
  id: 'cart',
  version: '2.0.0',
  capabilities: ['cart.write'],
  requiredCapabilities: ['auth.session'],
  permissions: { topicsAllow: ['cart.*'] },
  compat: { gluezero: '^2.0.0' },
  isolation: 'shadow-dom',
  lifecycle: cartLifecycle, // NB: oggetto, non hook stringhe
});
```

**Cosa abilita:** governance full stack F8-F17:

- **Permission boundary** tra MF (deny-wins order-independent).
- **Capability negotiation** first-wins.
- **Semver compat check** 9 dimensioni con 5 policy.
- **Isolation** mount-root / scoped / shadow-dom.
- **Fallback retry + circuit + render** automatico.
- **Devtools mf-inspector** 17 fields + 14 metriche per-MF.

**Bundle delta:** ~50-60 KB gzipped totale (vs v1.x 8.87 KB baseline solo).
Consultare [18 — Performance & Bundle](./18-performance-bundle.md) per breakdown.

---

## Customer-dashboard end-to-end

Esempio realistico A→B→C migration evolution: vedi
[`examples/customer-dashboard/`](../../examples/customer-dashboard/) (Plan 17-06).

Il customer-dashboard mostra host React shell + 3 MF mixed (1 ESM + 1 WC + 1 iframe) con
governance F8-F17 attiva.

---

## 5-7 cause di breaking change false positive da evitare

Errori comuni durante migration che **sembrano** breaking change ma sono solo
misconfiguration:

### 1. Aliasing `customElements.define` manuale nella shell

**Errore:** la shell chiama `customElements.define('mf-cart', CartElement)` PRIMA di
`registerMicroFrontend({loader: { type: 'web-component', tagName: 'mf-cart' }})`. Risultato:
collision tra il define manuale e il register MF (loader F15 si aspetta che define avvenga
nel modulo MF, non nella shell).

**Fix:** lascia che il MF module chiami `define` (carico async dal loader).

### 2. Custom Element name collision tra MF

**Errore:** due MF dichiarano `tagName: 'mf-cart'`. Il broker non rileva la collision (sono
namespace globali del browser), ma il secondo register fallisce a runtime.

**Fix:** usa convention `tagName: 'mf-<mf-id>'` (e.g. `mf-cart-v2`). Il F17 WC adapter NON
auto-registra per evitare questa classe di errori.

### 3. Topic prefix sovrapposizione

**Errore:** il MF custom usa topic `microfrontend.cart.added` (prefix `microfrontend.` riservato
ai 29 standard topics F8). Risultato: topic publicato ma confonde devtools observability.

**Fix:** usa prefix custom MF-scoped (e.g. `cart.added`, `myapp.cart.added`). Consulta i 29
standard topics F8 in [04 — Lifecycle FSM](./04-lifecycle.md).

### 4. Lifecycle hook async non-await

**Errore:** il MF dichiara `async function mount(container, ctx)` ma fa fire-and-forget di
operazioni (e.g. `fetch(...)` senza await). Risultato: state FSM transitions a `mounted` prima
che il rendering sia completo → race condition con `unmount`.

**Fix:** await tutte le operazioni async nel hook. Vedi PRD §10 — lifecycle blocking semantics.

### 5. Storage namespacing manuale

**Errore:** il MF custom usa `localStorage.setItem('cart-state', ...)` direttamente. Risultato:
collision con altri MF che hanno stessa key.

**Fix:** usa `mfContext.runtime.storage` (auto-namespaced) o `context.isolation.storage` quando
F13 attivo. Vedi [07 — Context](./07-context.md).

### 6. Module Federation peer mismatch (V2.0 GA mantiene experimental)

**Errore:** install `@gluezero/mf-module-federation@2.0.0` ma `@module-federation/runtime@1.x.x`
(peer richiesto `2.4.x`). Risultato: runtime error al primo MF Module Federation load.

**Fix:** install peer compatibile. Vedi [05 — Loaders](./05-loaders.md) tabella experimental.

### 7. React adapter React peer < 18.2

**Errore:** install `@gluezero/react@2.0.0` con `react@17.x` peer. Risultato: throw a runtime
(adapter usa `createRoot` API non disponibile in React 17).

**Fix:** upgrade React ≥ 18.2 (peer constraint `>=18.2.0 <20.0.0`).

---

## Riferimenti

- [PRD §42 — Backward Compatibility](../../prd_2.0.0.md)
- [01 — Architettura v2.0](./01-architecture.md)
- [02 — Core vs MF Layer](./02-core-vs-mf.md)
- [18 — Performance & Bundle](./18-performance-bundle.md)
- [README @gluezero/core](../../packages/core/README.md)
- [README @gluezero/microfrontends](../../packages/microfrontends/README.md)
- [README @gluezero/react](../../packages/react/README.md)
- [`examples/customer-dashboard/`](../../examples/customer-dashboard/) (Plan 17-06)
