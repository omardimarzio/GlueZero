# Walkthrough A → B → C — Migration Evolution

Lo stesso "Customer Dashboard" può essere implementato in **3 livelli
incrementali** (D-V2-F17-09 adoption levels). Ogni livello rappresenta un
commit progressivo dello stesso codebase: governance viene aggiunta
gradualmente **senza breaking change** (BC §42 garantita).

Riferimento decisione: [docs/v2/17-migration-guide.md](../../docs/v2/17-migration-guide.md).

---

## Step 1 — Livello A: v1.x semantics (zero-change drop-in)

**Cosa hai:** un broker baseline senza alcun MF feature. Codice **identico**
a v1.x: aggiorni la dipendenza `@gluezero/core` da `1.x` a `2.0.0`, non
configuri nulla, nessun import nuovo.

```javascript
// host-A.js — equivalente a v1.x
import { createBroker } from '@gluezero/core'

const broker = createBroker({})

// Wiring manuale dei 3 "componenti" (no MF lifecycle, no governance):
//   - Cart UI = funzione che crea DOM + listener broker
//   - Recs UI = funzione che crea DOM + listener broker
//   - Analytics = simple subscribe-and-log

broker.subscribe('cart.added', (e) => console.log('Cart added:', e.payload))
// ... wiring imperativo per ciascuna sezione
```

**Pro:**

- Bundle delta **≤ +350 B** vs v1.x baseline (D-V2-21 PASS F8-12).
- Zero codice nuovo, drop-in upgrade.
- BC §42 14 API public preservate al 100%.

**Contro:**

- No lifecycle FSM (mount/unmount manuali → memory leak risk se gli MF
  vengono aggiunti/rimossi a runtime).
- No permission / compat / isolation / fallback governance.
- No devtools inspector per MF (debug ridotto a `console.log`).

**Quando scegliere A:** progetti v1.x stabili, single-page app, nessuna
necessità imminente di governance MF, vuoi solo eliminare il warning di
deprecation v1.x.

---

## Step 2 — Livello B: opt-in MicroFrontend basic

**Cosa aggiungi cumulativamente:**

1. `@gluezero/microfrontends` module → lifecycle FSM 8 stati.
2. `@gluezero/mf-esm` loader → caricamento ESM dinamico via `import()`.
3. Registri ogni "componente" come MicroFrontendDescriptor.

```javascript
// host-B.js
import { createBroker } from '@gluezero/core'
import { microFrontendModule } from '@gluezero/microfrontends'
import { mfEsmModule } from '@gluezero/mf-esm'

const broker = createBroker({
  modules: [microFrontendModule(), mfEsmModule()],
})

await broker.registerMicroFrontend({
  id: 'cart-mf',
  name: 'Cart MF',
  version: '2.0.0',
  loader: { type: 'esm', url: './mf-cart.js' },
  mount: { target: '#mf-cart' },
})
// ... registra altri 2 MF
```

**Aggiunte rispetto a A:**

- Lifecycle FSM con 8 stati (`registered → loaded → bootstrapped → mounted
  → unmounted → destroyed`, plus `failed`/`unloaded`).
- 29 standard topics F8 (`microfrontend.registered`, `microfrontend.mounted`,
  `microfrontend.runtime.failed`, ecc.).
- Cleanup cascade `destroy → broker.unsubscribeByOwner(mfOwnerId(id))` →
  zero memory leak su `destroy()`.
- Bundle delta cumulativo ~10-12 KB gzipped (microFrontendModule + mfEsmModule).

**Pro:**

- Governance lifecycle base senza complessità governance avanzata.
- Memory leak prevention via cascade unsubscribe (D-V2-16).
- Standard topics F8 abilita inter-MF coordination dichiarativa.

**Contro:**

- Ancora nessuna permission / compat / isolation / fallback / devtools.
- Solo loader ESM (no iframe sandbox né Web Components).
- Nessun adapter framework specifico.

**Quando scegliere B:** shell semplice con 1-3 MF in chunk ESM, single team,
no requisito multi-tenant o multi-team, governance avanzata non ancora
prioritaria.

---

## Step 3 — Livello C: Production Full Governance

**Cosa aggiungi cumulativamente (vedi `host.js` di questo esempio):**

1. `@gluezero/permissions` → ACL allow/deny per topic per-MF.
2. `@gluezero/compat` → semver host vs MF + policy `block-mount`/`warn`/`allow`.
3. `@gluezero/isolation` → strategia per-MF (`shadow-dom`, `scoped`, `mount-root`).
4. `@gluezero/fallbacks` → `onMountError` + `onRuntimeError` event-based dispatch.
5. `@gluezero/devtools/mf-inspector` → live HTML panel + 14 metriche per-MF.
6. `@gluezero/mf-web-component` loader → 2° loader per Custom Elements.
7. `@gluezero/mf-iframe` loader → 3° loader per iframe sandbox.
8. `@gluezero/react` adapter per Cart MF → `createReactMicroFrontendLifecycle`
   + Provider + 6 hooks + built-in `<GlueZeroErrorBoundary>`.
9. `@gluezero/web-components` adapter per Recs MF → `GlueZeroElement` base.

```javascript
// host-C.js — vedi host.js in questo esempio per la versione completa
import { createBroker } from '@gluezero/core'
import { microFrontendModule } from '@gluezero/microfrontends'
import { mfEsmModule } from '@gluezero/mf-esm'
import { mfWebComponentModule } from '@gluezero/mf-web-component'
import { mfIframeModule } from '@gluezero/mf-iframe'
import { permissionsModule } from '@gluezero/permissions'
import { compatModule } from '@gluezero/compat'
import { isolationModule } from '@gluezero/isolation'
import { fallbacksModule } from '@gluezero/fallbacks'
import { mfInspectorModule } from '@gluezero/devtools/mf-inspector'

const broker = createBroker({
  modules: [
    microFrontendModule(),
    mfEsmModule(),
    mfWebComponentModule(),
    mfIframeModule(),
    permissionsModule({ policies: { /* per-MF ACL */ } }),
    compatModule({ hostVersion: '2.0.0', policy: 'block-mount' }),
    isolationModule({
      default: 'mount-root',
      perMfOverride: { 'recs-mf': 'shadow-dom' },
    }),
    fallbacksModule({ onMountError: 'event', onRuntimeError: 'event' }),
    mfInspectorModule(),
  ],
})

// Register 3 MF mixed (React + WC + iframe) ...
```

Sul lato MF, Cart MF usa l'adapter React:

```javascript
import {
  createReactMicroFrontendLifecycle,
  useGlueZeroPublish,
  useGlueZeroSubscribe,
} from '@gluezero/react'

function CartUI() {
  const publish = useGlueZeroPublish()
  const [items, setItems] = React.useState([])
  useGlueZeroSubscribe('cart.added', (e) => setItems(prev => [...prev, e.payload]))
  // ... render
}

export const { bootstrap, mount, unmount, destroy } =
  createReactMicroFrontendLifecycle(CartUI)
```

E Recs MF usa l'adapter Web Components:

```javascript
import { GlueZeroElement } from '@gluezero/web-components'

class RecsMfElement extends GlueZeroElement {
  onContextReady() {
    this.subscribe('cart.added', (e) => { /* ... */ })
  }
}
customElements.define('recs-mf-element', RecsMfElement)
```

**Aggiunte rispetto a B:**

- 5 governance feature attivi (permissions + compat + isolation + fallback + devtools).
- 3 loader types attivi (ESM + Web Component + iframe).
- 2 adapter framework (`@gluezero/react` + `@gluezero/web-components`).
- ErrorBoundary built-in React con `SERVICE_FALLBACKS` delegation (F14).
- Live observability via `mfInspectorModule` (17 fields + 14 metrics per-MF).
- Bundle delta cumulativo ~50-60 KB gzipped vs Livello A baseline.

**Pro:**

- Production-grade governance enterprise.
- Multi-team / multi-tenant / multi-MF SaaS scenario coperto.
- Visibility live via mf-inspector → debugging + observability in dev e prod.
- Compat semver permette aggiornamenti incrementali MF senza coordination
  obbligatoria di tutti i team contemporaneamente.

**Contro:**

- Maggiore overhead bundle (cap ~60 KB gzipped cumulative).
- Setup config più complesso (10 import top-level).
- Curva apprendimento per developer nuovi al modello MF.

**Quando scegliere C:** SaaS enterprise multi-team multi-MF, requisiti di
governance (security, compliance, observability), evoluzione indipendente
release per team.

---

## Tabella riassuntiva — quale livello scegliere

| Use case                                                  | Livello | Bundle delta gzipped |
| --------------------------------------------------------- | ------- | -------------------- |
| Upgrade safe v1.x → v2.0 senza modifiche al codice        | A       | ≤ +350 B             |
| Shell con 1-3 MF ESM lifecycle simple                     | B       | ~10-12 KB cumulative |
| Enterprise multi-team multi-MF + governance + framework   | C       | ~50-60 KB cumulative |

**Importante:** procedere incrementalmente A → B → C **senza rifare il
codebase** è sempre possibile. Ogni passaggio aggiunge moduli al
`createBroker({modules:[...]})` ma non richiede modifiche alle API esistenti
(BC §42 14 API v1.x replay PASS gate finale milestone).

## Riferimenti

- [docs/v2/17-migration-guide.md](../../docs/v2/17-migration-guide.md)
- [PRD §42.3 — Migration aggiuntiva](../../prd_2.0.0.md)
- [README customer-dashboard](./README.md)
