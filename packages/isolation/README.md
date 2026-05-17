# `@gluezero/isolation`

Modulo opt-in per **isolation policy + facade injection** in microfrontend governance v2.0:
DOM/CSS/JS/Events/Storage/Network/Globals (PRD §21.3) + 4 facade (storage, gateway, worker, theme)
con permission integration F11 + theme integration v1.1 (adoptedStyleSheets D-F7-22 carryover).

> ⚠️ **Governance, NON sandbox crittografica.** Vedi sezione "P-13: Modello di sicurezza" sotto.

---

## 1. Quick start

```ts
import { createBroker } from '@gluezero/core'
import { microfrontendModule } from '@gluezero/microfrontends'
import { permissionsModule } from '@gluezero/permissions'
import { isolationModule } from '@gluezero/isolation'
import '@gluezero/isolation/augment' // declaration merging type-only side-effect

const broker = createBroker({
  modules: [
    microfrontendModule(),
    permissionsModule(),
    isolationModule({
      policyDefault: { dom: 'shadow-dom', css: 'shadow-dom' },
      resolvers: {
        gateway: () => myGatewayService,
        worker:  () => myWorkerService,
        theme:   () => myThemeService,
        // iframeLoader: () => myIframeAdapter,  // F15 future
      },
    }),
  ],
})
```

Una volta installato, `isolationModule` subscriba ai topic F8 `microfrontend.registered` +
`microfrontend.mounting` e applica policy resolver + apply chain (DOM, CSS, iframe stub)
automaticamente. Il consumer NON deve invocare hook manualmente.

## 2. Install

```bash
pnpm add @gluezero/isolation
# Hard peer:
pnpm add @gluezero/core @gluezero/microfrontends
# Peer optional (a seconda delle facade desiderate):
pnpm add @gluezero/permissions @gluezero/theme @gluezero/gateway @gluezero/worker @gluezero/cache @gluezero/context
```

Hard deps esterne: **zero**. 6 peer optional + 2 hard peer (core + microfrontends).

Bundle:
- `@gluezero/isolation` ≤ 12 KB gzip (D-V2-F13-13)
- `@gluezero/isolation/augment` ≤ 1 KB gzip (intent signaling side-effect-only)

## 3. Policy 7-key (PRD §21.3)

| Chiave    | Valori                                                 | Default            | Descrizione                          |
|-----------|--------------------------------------------------------|--------------------|--------------------------------------|
| `dom`     | `'none' \| 'mount-root' \| 'shadow-dom' \| 'iframe'`  | `'mount-root'`     | DOM isolation level                  |
| `css`     | `'none' \| 'scoped' \| 'shadow-dom' \| 'iframe'`      | `'scoped'`         | CSS isolation level                  |
| `js`      | `'shared-window' \| 'sandboxed-iframe'`                | `'shared-window'`  | JS execution context                 |
| `events`  | `'broker-only' \| 'broker-plus-dom' \| 'isolated'`    | `'broker-only'`    | Event propagation scope              |
| `storage` | `'shared' \| 'namespaced' \| 'blocked'`               | `'shared'`         | localStorage access policy           |
| `network` | `'direct-allowed' \| 'gateway-only' \| 'blocked'`     | `'direct-allowed'` | Network access policy                |
| `globals` | `'allowed' \| 'restricted' \| 'isolated'`             | `'allowed'`        | Window globals access policy         |

**Resolver merge order** (più alta priorità in fondo, prevale):

1. `DEFAULT_ISOLATION_POLICY` (PRD §21.3 baseline lockato D-V2-F13-17 BLOCKING).
2. `policyDefault` (factory option `isolationModule({policyDefault: {...}})`) — host-wide override.
3. `descriptor.isolation` (per-MF da `descriptor.isolation`) — override per-MF, prevale.

Partial-merge per chiave: ogni delle 7 chiavi è risolta indipendentemente.

```ts
import { resolvePolicy } from '@gluezero/isolation'

resolvePolicy({ dom: 'iframe' }, { dom: 'shadow-dom' }, 'mf-1')
// → { dom: 'iframe', css: 'scoped' (default), js: 'shared-window', ... }
```

## 4. Le 4 Facade (PRD §21.7 + §33 + §34 + §35)

`wrapContextWithIsolation` compone 4 facade sul runtime context F8/F11 esposto a MF code:

| Facade   | Signature                                          | Permission action | Topics emessi                                                                         |
|----------|----------------------------------------------------|-------------------|---------------------------------------------------------------------------------------|
| storage  | `getItem/setItem/removeItem/clear`                 | (none — local)    | `microfrontend.storage.changed`                                                       |
| gateway  | `request(routeId, payload, options)`               | `gateway`         | `microfrontend.gateway.request` + `.error`                                            |
| worker   | `run(workerId, task, payload, options)`            | `worker`          | `microfrontend.worker.task.started/.completed/.error`                                 |
| theme    | `getToken/getRole/isInheriting`                    | `theme` (token)   | (legge tokens via ThemeService — no broker emit)                                      |

Comportamenti per policy mode:
- `storage='blocked'` → `ctx.storage = undefined`. `storage='namespaced'` → prefisso `gz:mf:<id>:<key>`.
- `network='blocked' | 'direct-allowed'` → `ctx.gateway = undefined`. `network='gateway-only'` → facade attiva.
- `worker` sempre presente (PRD §34 NON specifica policy worker disabling W2-P04).
- `theme` undefined se `themePolicy?.enabled === false`.

Permission integration F11 lazy peer optional tolerant — se `@gluezero/permissions` NON installato,
facade pass-through silenzioso + warning una volta per broker.

```ts
// MF-side code:
ctx.storage?.setItem('counter', '42')
const result = await ctx.gateway?.request('users.list', { page: 1 })
const compute = await ctx.worker?.run('worker-fft', 'compute', { data: [1, 2, 3] })
const primary = ctx.theme?.getToken('color-primary')
```

## 5. Shadow-dom + scoped CSS

**Strategy A mutation cast (D-V2-F13-05)** per `dom='shadow-dom'`:

1. `host.attachShadow({mode:'open'})` crea ShadowRoot sull'host element.
2. Crea inner div container con attribute `data-gz-mf-container=<mfId>`.
3. Sostituisce `mount.element` in-place con il div interno (loader F9 ESM riceve container shadowed transparently).
4. Espone `mount.context.shadowContainer = shadowRoot` per theme adoptedStyleSheets propagation.

**Scoped CSS** (`css='scoped'`):

```ts
import { scopeCss } from '@gluezero/isolation'

const scoped = scopeCss('.btn { color: red; }', 'mf-1')
// → '[data-gz-mf="mf-1"] .btn { color: red; }'
```

`scopeCss` è un helper opt-in: il MF deve invocarlo esplicitamente per scoping. Runtime NON
inietta CSS automaticamente. Supporta selettori top-level, comma-separated lists, `@media` +
`@supports` (body ricorsivo), `@keyframes` + `@font-face` + `@import` preservati as-is.

Minimal regex (Claude's Discretion CONTEXT.md) — bundle ~300 B gzip. NON supporta nested
selectors PostCSS-style — vedi sezione Q&A.

## 6. Iframe (F15 dependency)

`applyIframeStub` per `dom='iframe'` richiede `resolvers.iframeLoader` host-provided. Senza
adapter → throw `IsolationPolicyError` con `code='IFRAME_ADAPTER_REQUIRED'` + MF FSM → `failed`.

F15 `@gluezero/mf-iframe` (deferred) fornirà l'adapter reale con sandbox/postMessage bridge.

```ts
isolationModule({
  resolvers: {
    iframeLoader: () => ({
      createSandbox(policy, mfId, mount) {
        // F15 adapter implementation
        const iframe = document.createElement('iframe')
        iframe.sandbox = 'allow-scripts'
        // ...mount.element = iframe; ...
      },
    }),
  },
})
```

## 7. Esempi codice MF

```ts
// MF entry point:
export const bootstrap = (ctx) => {
  // storage namespaced
  ctx.storage?.setItem('user.id', '123')

  // gateway con permission check
  ctx.gateway?.request('orders.list', { customerId: 123 })
    .then(orders => render(orders))
    .catch(err => { if (err.code === 'PERMISSION_DENIED') showAuthBanner() })

  // worker async task
  ctx.worker?.run('worker-pdf', 'render', { templateId: 'invoice' })

  // theme token read
  document.documentElement.style.setProperty(
    '--color-primary',
    ctx.theme?.getToken('color-primary') ?? '#0066cc',
  )
}
```

## 8. Errors (IsolationPolicyError)

Codes ratificati v2.0:
- `IFRAME_ADAPTER_REQUIRED` — `dom='iframe'` senza `resolvers.iframeLoader`. Throw da `applyIframeStub`.
- `POLICY_INVALID` — iframe adapter signature mismatch (es. loader ritorna `undefined` o oggetto senza `createSandbox`).
- `STORAGE_BLOCKED` — riservato future use (warning emit quando MF tenta accesso a `ctx.storage` con `storage='blocked'`).

```ts
import { createIsolationPolicyError } from '@gluezero/isolation'

throw createIsolationPolicyError({
  code: 'IFRAME_ADAPTER_REQUIRED',
  message: 'MicroFrontend declares dom=iframe but no iframe adapter is registered',
  details: { microFrontendId: 'mf-x', dimension: 'dom' },
})
```

Errors hanno `category: 'microfrontend'` (riuso F8 `ErrorCategory` literal — NO union extension upstream).

## 9. Q&A

**D: scopeCss supporta nested selectors PostCSS-style?**
R: No. Implementazione minimal regex (`.a { .b { ... } }` → `.b` NON re-scopato). Per nested selectors usare un pre-processor (PostCSS, CSS Modules, build-time scope). F13 fornisce scoping runtime minimo.

**D: Posso usare `dom='iframe'` senza adapter F15?**
R: No. Throw `IFRAME_ADAPTER_REQUIRED`. F15 `@gluezero/mf-iframe` è deferred (roadmap). Workaround: usa `dom='shadow-dom'` per isolation moderato.

**D: Perché `resolvers` è 2-opt invece di Service Locator?**
R: AMENDMENT D-V2-F13-04-AMENDED. Service Locator F8 NON espone `SERVICE_GATEWAY/WORKER/THEME` poiché i package v1.0/v1.1 NON si auto-registrano via `BrokerModule.install`. Resolver pattern lazy host-provided. Vedi sezione 13.

**D: jsdom è sufficiente per testare F13?**
R: No. Tier-1 jsdom copre policy resolver + DOM mutation base. Tier-3 Playwright Chromium obbligatorio per `attachShadow` full, `adoptedStyleSheets`, `localStorage` cross-context, `iframe sandbox`. 6 scenari D-V2-F13-23 forniti.

**D: Cosa succede se F11 (permissions) NON è installato?**
R: Facade gateway/worker/theme funzionano in pass-through (mode='off' effettivo) + warning una volta per broker. F13 è peer-optional-tolerant.

**D: `ctx.publish` è isolato per `events='isolated'`?**
R: No. F13 NON modifica events runtime behavior — descriptor field è documented lock per future F8 extension. Pubblicazione `ctx.publish` resta pass-through F8 broker-only.

**D: Storage `shared` mode terze parti che bypass?**
R: Defer V2.1. OQ-2 ratificato: `descriptor.owner.type` NON esiste F8, warning third-party NON emettibile. Per enforcement usa `namespaced` + valida lato host.

**D: Posso installare isolationModule 2x sullo stesso broker?**
R: No. Idempotent guard → re-install rileva `SERVICE_ISOLATION` già registrato + `console.warn` + early return. Pattern coerente F11/F12.

**D: Come avviene il cleanup quando il broker shutdown?**
R: D-V2-16 cascade. AbortController interno → policyCache.clear() + register/mount hooks unsubscribe. Host deve invocare `service.__abort__()` (esposto via Symbol marker) o tramite custom shutdown.

**D: Bundle finale superi 12 KB?**
R: Fallback documentato (sezione 12). Drop ordering: 1) tsup minify-whitespace, 2) inline buildThemeStyleSheet, 3) ridurre IsolationPolicyError details introspection, 4) re-discuss cap raise D-V2-F13-13.

**D: Cosa testano i 6 scenari Tier-3 Playwright Chromium?**
R: 1) shadow-dom mount Strategy A, 2) scoped CSS isolation visiva, 3) iframe stub + FSM failed, 4) localStorage namespaced cross-MF, 5) adoptedStyleSheets theme propagation, 6) warning matrix combinations end-to-end con console.warn captured.

## 10. Migration v1.x → v2.0 (isolation opt-in)

v1.x NON aveva isolation module. Comportamento equivalente in v2.0 = `isolationModule()` con
default policy applicata via `wrapContextWithIsolation`. Per **opt-out completo**: NON installare
`isolationModule` nell'array modules `createBroker({ modules: [...] })`.

Migrazione tipica progressive:

```ts
// v1.x:
const broker = createBroker({ modules: [microfrontendModule()] })

// v2.0 — Phase 1 (no behavior change):
const broker = createBroker({ modules: [microfrontendModule()] })

// v2.0 — Phase 2 (opt-in isolation defaults):
const broker = createBroker({
  modules: [
    microfrontendModule(),
    isolationModule(),  // defaults DEFAULT_ISOLATION_POLICY
  ],
})

// v2.0 — Phase 3 (hardening):
const broker = createBroker({
  modules: [
    microfrontendModule(),
    permissionsModule({ permissionMode: 'enforce' }),
    isolationModule({
      policyDefault: { dom: 'shadow-dom', css: 'shadow-dom', storage: 'namespaced' },
      resolvers: { gateway: () => gw, worker: () => wk, theme: () => th },
    }),
  ],
})
```

BC §42 preserved (D-V2-F13-09): 14 API v1.x stabili — `v1-bc-replay` PASS gate 267/270.

## 11. ⚠️ P-13: Modello di sicurezza (governance NON crypto)

**Importante.** `@gluezero/isolation` è un **layer di governance**, non una sandbox crittografica.

In modalità `js='shared-window'` (default), un MF malicious può:

- Chiamare `window.fetch` direttamente bypassando `ctx.gateway` + permission check (`network='gateway-only'` doc-only).
- Accedere a `localStorage` direttamente bypassando `ctx.storage` namespace (`storage='namespaced'` doc-only).
- Mutare globali condivisi (`globals='isolated'` non enforceable senza iframe sandbox).
- Iniettare CSS arbitrario senza `data-gz-mf` scope (`css='scoped'` doc-only — applicato solo da `scopeCss` opt-in).

**Per enforcement reale** usare `js='sandboxed-iframe'` + `dom='iframe'` + adapter F15 `@gluezero/mf-iframe`.

Mitigations applicate da F13 (governance layer):

1. **Warning matrix MF-ISO-06** rileva combinazioni inconsistent e emette `microfrontend.isolation.warning` (es. `js:'shared-window' + network:'blocked'` → P-13 warning con messaggio lockato PRD §21.9).
2. **Topic governance** `microfrontend.isolation.warning` per devtools F16 observability + audit trail.
3. **README disclaimer obbligatorio** (questa sezione).
4. **Documentation Q&A esplicita** non-enforceable shared-window.
5. **Audit attribution** — `metadata.microFrontendId` auto-iniettato in gateway/worker (T-13-W2-P04-01 mitigation: MF NON può spoofare microFrontendId via options.metadata.microFrontendId override).
6. **Topic storage observability** — `microfrontend.storage.changed` emit su setItem/removeItem/clear per audit.

P-13 è una **decisione architetturale ratificata** — F13 fornisce governance + audit. Enforcement
crypto richiede iframe sandbox + postMessage bridge (deferred F15).

## 12. Bundle gate (≤ 12 KB gzip)

`size-limit` configurato per 2 entry:
- `@gluezero/isolation` (gzip) ≤ 12 KB su `dist/index.js`
- `@gluezero/isolation/augment` (gzip) ≤ 1 KB su `dist/augment.js`

Verifica empirica W3:

```bash
pnpm --filter @gluezero/isolation build
gzip -c packages/isolation/dist/index.js | wc -c   # ≤ 12288
gzip -c packages/isolation/dist/augment.js | wc -c # ≤ 1024
pnpm exec size-limit
```

Breakdown stimato (cumulative W1+W2+W3):
- 4 facade (storage/gateway/worker/theme): ~4.5 KB
- DOM/CSS isolation + mount hook: ~1.5 KB
- policy resolver + warning matrix: ~1.0 KB
- buildThemeStyleSheet + scopeCss + iframe stub: ~0.85 KB
- augment + module install + types + topics: ~0.3 KB
- tsup overhead: ~0.7 KB

**Fallback se bundle eccede 12 KB:**
1. `tsup --minify-whitespace` (drop ~5-10%).
2. Inline `buildThemeStyleSheet` senza helper export (~50 B).
3. Ridurre `IsolationPolicyError.details` introspection (~80 B).
4. Re-discuss cap raise D-V2-F13-13 (cap conservativo).

## 13. Resolver pattern (AMENDMENT D-V2-F13-04-AMENDED)

F13 factory `isolationModule({policyDefault?, resolvers?})` accetta 2 opzioni invece di 1 per
risolvere **OQ-6 (HIGH)**: Service Locator F8 `SERVICE_GATEWAY`/`SERVICE_WORKER`/`SERVICE_THEME`
NON esistono in v1.0/v1.1 (i package v1.x NON si auto-registrano via `BrokerModule.install`).

Resolver pattern obbligatorio per accesso a gateway/worker/theme:

```ts
isolationModule({
  resolvers: {
    gateway: () => gatewayServiceInstance,  // function lazy (re-resolvable)
    worker:  () => workerServiceInstance,
    theme:   () => themeServiceInstance,
    iframeLoader: () => iframeAdapter,     // optional, F15 future
  },
})
```

**Vantaggi resolver pattern:**

1. **Lazy lookup** — resolver invocato ad ogni `request/run/getToken` call (re-resolvable in caso di host hot-swap).
2. **Peer optional tolerant** — se resolver non fornito, facade emette warning ma NON fallisce hard.
3. **Coerente F11** — F11 2-opt factory D-V2-F11-18 (deliberata divergenza ratificata).
4. **Backward compatible** — F13 NON modifica `@gluezero/core/services.ts` (D-83 strict SEXTUPLE esteso v2.0).

**Future migration path (V2.1+):** se i package v1.x adottano `BrokerModule.install` pattern,
sarà possibile rimuovere resolver pattern in favor di Service Locator standard.

**Ratification status:** ✅ Ratificato W1 P01 + verificato runtime P04 (gateway/worker/theme facade
uso `resolvers.gateway?()/.worker?()/.theme?()` lazy) + documented W3 P05 (questa sezione).

---

## Riferimenti

- PRD §21 — Isolation module specification
- PRD §11.2 — Theme policy 8-key + inherit pattern
- PRD §33 — Gateway integration
- PRD §34 — Worker integration
- PRD §35 — Theme integration
- PRD §42 — Backward compatibility 14 API v1.x
- PRD §44 — Verifier obligations
- ROADMAP F13 — 17 REQ-IDs (MF-ISO-01..06 + MF-INT-* + MF-DOC-02/04 + MF-TEST-01 + MF-PIPE-01 + MF-BC-01..04)
- CONTEXT D-V2-F13-XX — 26 decisioni ratificate W1-W3

## Licenza

MIT © Omar Di Marzio
