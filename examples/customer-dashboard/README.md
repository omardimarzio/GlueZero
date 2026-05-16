# Customer Dashboard — End-to-End Example (Livello C Full Governance)

Golden showcase di **GlueZero v2.0**: 1 host shell + 3 MicroFrontend mixed
(React + Web Component + iframe sandbox) con tutti i **5 governance feature**
attivi simultaneamente. Pensato per dimostrare il valore di v2.0 a stakeholder
ed early adopters via npm tag `next` post-W7.

> Questo è il "Livello C" della scala adoption A → B → C definita in
> [docs/v2/17-migration-guide.md](../../docs/v2/17-migration-guide.md).
> Per la migration evolution sullo stesso esempio vedi
> [walkthrough-A-B-C.md](./walkthrough-A-B-C.md).

## Cosa dimostra (8 feature attive)

| Feature                | Componente / Module          | Note                                                                |
| ---------------------- | ---------------------------- | ------------------------------------------------------------------- |
| React adapter          | Cart MF                      | `createReactMicroFrontendLifecycle` + Provider + 6 hooks            |
| Web Components adapter | Recommendations MF           | `GlueZeroElement` base class + AbortController cleanup + shadow-dom |
| iframe sandbox loader  | Analytics MF                 | F15 bridge handshake postMessage + `expectedOrigin` validation      |
| Permissions ACL        | `permissionsModule`          | Cart MF NO `payment.*` topic, Recs MF NO `*.admin`                  |
| Compatibility check    | `compatModule`               | Host v2.0 + policy `block-mount` (MF v1.x bloccati)                 |
| Isolation per-MF       | `isolationModule`            | Recs MF shadow-dom override, altri mount-root default               |
| Fallback policies      | `fallbacksModule`            | `onRuntimeError: event` + `onMountError: event`                     |
| Devtools Inspector     | `mfInspectorModule` F16      | Live HTML panel (refresh 1s) con 17 fields + 14 metrics per-MF      |

## Quick run

L'esempio richiede un web server locale (importmap CORS + iframe stessa origin).

```bash
# Dalla root del repo
cd examples/customer-dashboard

# Opzione A — server zero-config
npx -y http-server -p 8080 -c-1

# Opzione B — Python
python3 -m http.server 8080
```

Poi apri http://localhost:8080 nel browser. **Tutti i moduli sono caricati da
CDN `esm.sh`** con versione pinata `2.0.0` (vedi `index.html` `<script type="importmap">`).

Per dev locale puoi anche puntare ai bundle locali sostituendo gli URL CDN con
path relativi a `../../packages/*/dist/index.js` dopo `pnpm build:packages`.

## Struttura directory

```
customer-dashboard/
├── index.html                    # Host shell con 3 mount targets + inspector panel
├── host.js                       # Bootstrap broker + 9 modules + register 3 MF
├── mf-cart-react.js              # MF Cart via @gluezero/react createReactMicroFrontendLifecycle
├── mf-recommendations-wc.js      # MF Recs via @gluezero/web-components GlueZeroElement
├── mf-analytics-iframe.html      # MF Analytics iframe page
├── mf-analytics-iframe.js        # MF Analytics iframe message handler bridge
├── README.md                     # Questo file
└── walkthrough-A-B-C.md          # Migration evolution Livello A → B → C su stesso esempio
```

## Flow degli eventi (scenario realistico)

1. L'utente clicca **"Add to cart"** sul Cart MF (React). L'hook
   `useGlueZeroPublish` pubblica `cart.added` con `metadata.microFrontendId =
   'cart-mf'` (MF-OBS-01 facade injection automatica).
2. Recommendations MF (Web Component) è sottoscritto a `cart.added` via
   `this.subscribe(...)` instance method. Il signal del proprio
   `AbortController` viene auto-iniettato → cleanup automatico in
   `disconnectedCallback`. Aggiunge un'entry "Hai aggiunto X — prova anche
   X-similar" alla lista shadow-dom.
3. Analytics MF (iframe) riceve `cart.added` via F15 bridge `postMessage` con
   `expectedOrigin` validation lato parent. Mostra ogni evento nel proprio log
   interno.
4. Inspector live panel (refresh 1s) chiama `broker.getDebugSnapshot()` +
   `broker.getMetrics()` e mostra:
   - **17 fields per-MF** (id, state, version, lifecycle timings, descriptor,
     permissions, compat, isolation, fallback strategy, ecc.)
   - **14 metriche per-MF** (mount duration, publish/subscribe counts, error
     counters, ecc. — F16 `mf-inspector` module)

## Governance attiva (5 feature dimostrate)

### 1. `permissionsModule` — ACL allow/deny per topic

Vedi `host.js` blocco `permissionsModule({ policies: {...} })`:

- `cart-mf`: `allow ['cart.*', 'system.warmup']`, `deny ['payment.*']`.
  Se Cart MF tentasse `publish('payment.charge', ...)`, l'event verrebbe
  bloccato e il broker emetterebbe `microfrontend.permission.denied`.
- `recs-mf`: `allow ['recommendation.*', 'cart.added']`, `deny ['*.admin']`.
- `analytics-mf`: `allow ['analytics.*', 'cart.added', 'recommendation.*']`
  (read-only, nessun deny).

### 2. `compatModule` — semver compat host vs MF

`compatModule({ hostVersion: '2.0.0', policy: 'block-mount' })`. Tutti i 3 MF
hanno `version: '2.0.0'` → match → mount permesso. Per uno scenario interattivo
con policy alternative vedi
[`../microfrontends/mf-compat-matrix.html`](../microfrontends/mf-compat-matrix.html).

### 3. `isolationModule` — strategia mount per MF

`isolationModule({ default: 'mount-root', perMfOverride: { 'recs-mf': 'shadow-dom' } })`.
Recs MF (WC) opera nativamente con shadow DOM open, Cart MF (React) e Analytics
MF (iframe) usano mount-root.

### 4. `fallbacksModule` — error policy

`fallbacksModule({ onMountError: 'event', onRuntimeError: 'event' })`.
Se Cart MF lanciasse un'eccezione React, il built-in `GlueZeroErrorBoundary`
(@gluezero/react) pubblicherebbe `microfrontend.runtime.failed`. Il
`SERVICE_FALLBACKS` lookup graceful degradation delegherebbe poi alla policy
`onRuntimeError: 'event'` → dispatch event-based (no UI fallback rendering).

### 5. `mfInspectorModule` — live observability

F16 `mfInspectorModule()` espone `broker.getDebugSnapshot()` esteso con
`microFrontends[]` array (17 fields per-MF) e `broker.getMetrics()` con
`microFrontends[]` array di 14 metriche per-MF. L'Inspector panel HTML del
dashboard refresha entrambi ogni 1s mostrando lo stato live del sistema.

## Walkthrough migration

Per vedere come arrivare a questo Livello C partendo da v1.x **senza breaking
change** in 3 step incrementali, vedi
[walkthrough-A-B-C.md](./walkthrough-A-B-C.md).

## Riferimenti

- [PRD §40.4 — Examples HTML standalone](../../prd_2.0.0.md)
- [docs/v2/17-migration-guide.md — Adoption levels A/B/C](../../docs/v2/17-migration-guide.md)
- [README @gluezero/react](../../packages/react/README.md)
- [README @gluezero/web-components](../../packages/web-components/README.md)
- [README @gluezero/devtools (mf-inspector subpath)](../../packages/devtools/README.md)
