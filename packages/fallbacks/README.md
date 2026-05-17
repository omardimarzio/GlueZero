# `@gluezero/fallbacks`

Layer di **fallback & error boundary opt-in** per micro-frontend gestiti da
`@gluezero/microfrontends`. Subscribe esterna ai 7 `MF_ERROR_TOPICS` di Phase 8
e applica una catena `circuit → retry → fallback render` per ciascun MF, **senza
modificare alcun package upstream** (D-83 strict septuple esteso F14).

> **Status:** v2.0.0-alpha.0 — experimental tag. GA target Phase 17 (D-V2-F8-10).
> **Bundle target:** ≤ 6 KB gzipped (`index.js`) + ≤ 1 KB (`augment.js`).

---

## 1. Quick start

```ts
import { createBroker } from '@gluezero/core'
import { microfrontendModule } from '@gluezero/microfrontends'
import { fallbacksModule } from '@gluezero/fallbacks'
import '@gluezero/fallbacks/augment' // type-only narrowing locale (D-V2-F14-19)

const broker = createBroker({
  modules: [
    microfrontendModule(),
    fallbacksModule({
      defaultPolicy: {
        onLoadError: {
          type: 'html',
          html: '<div>App temporaneamente non disponibile</div>',
        },
      },
      retryDefault: { attempts: 2, delayMs: 100, backoff: 'exponential', jitter: true },
      circuitDefault: { enabled: true, failureThreshold: 5, resetAfterMs: 30000 },
    }),
  ],
})

const mfService = broker.getService('microfrontends')!
await mfService.register({
  id: 'dashboard',
  name: 'Dashboard',
  version: '1.0.0',
  loader: { type: 'esm', url: '/mf/dashboard.js' },
  mount: { selector: '#dashboard-root', strategy: 'direct' },
  fallback: {
    onMountError: { type: 'event', topic: 'app.fallback.dashboard' },
  },
})
```

Per esempi completi vedi [§7 Examples](#7-examples).

---

## 2. Install

```sh
pnpm add @gluezero/core @gluezero/microfrontends @gluezero/fallbacks
```

**Peer dependencies opzionali** (zero hard dep — F14 layer è "soft Service Locator"):

- `@gluezero/context` — riceve `MicroFrontendRuntimeContext` nel custom handler `ctx`.
- `@gluezero/permissions` — type compat solo (permission check NON applicato runtime — vedi Q&A §9).
- `@gluezero/isolation` — `SERVICE_ISOLATION` per target preserve in modalità `shadow-dom`.
- `@gluezero/devtools` — Phase 16 future per Inspector observability (frozen REQUIREMENTS table).

---

## 3. `FallbackPolicy` — 6 scope per-phase

Per ciascun MF puoi dichiarare 6 `onXError` scope corrispondenti alle 7 lifecycle phase di
Phase 8 (eccetto `destroy` — vedi sotto):

```ts
import type { MicroFrontendFallbackPolicy } from '@gluezero/fallbacks'

const policy: MicroFrontendFallbackPolicy = {
  onLoadError:      { type: 'html', html: '<div>Loading failed</div>' },
  onBootstrapError: { type: 'component', component: ErrorBoundaryComponent },
  onMountError:     { type: 'event', topic: 'app.fallback.mount' },
  onRuntimeError:   { type: 'custom', handler: async (err, ctx) => { /* ... */ } },
  onUpdateError:    { type: 'none' },
  onUnmountError:   { type: 'none' },
  // NOTA: 'destroy' phase NON ha onDestroyError per design — il dispatcher applica
  // default fallback policy (host-level) se definito, oppure emette solo
  // 'microfrontend.fallback.rendered' fallbackType:'none' per observability.
  retry:            { attempts: 3, delayMs: 100, backoff: 'exponential', jitter: true },
  circuitBreaker:   { enabled: true, failureThreshold: 3, resetAfterMs: 5000 },
}
```

**Heuristic `recoverable` default** (D-V2-F14-08):

- `load` / `bootstrap` / `mount` / `runtime` / `update` → `recoverable: true` (retry abilitato).
- `unmount` / `destroy` → `recoverable: false` (cleanup phases, retry rischioso).

**Precedence policy resolution** (orchestrator chain):

1. `descriptor.fallback` (per-MF override registrato a register-time).
2. `options.defaultPolicy` (host-level globale passato a `fallbacksModule({})`).
3. `undefined` → fallbackType `'none'` (observability emit only).

---

## 4. 4 Rendering modes (+ `none`)

### `type: 'html'`

Applica `target.innerHTML = html`. **Target chain priority** (D-V2-F14-13):

1. `descriptor.mount.element` (se bound runtime context F10).
2. `document.querySelector(descriptor.mount.selector)`.
3. `null` → `console.warn` + skip (osservabile via `fallbackType: 'html-skipped'`).

Con `@gluezero/isolation` installato + `policy.dom === 'shadow-dom'` + `host.shadowRoot !== null`:
il target viene esteso a `host.shadowRoot` (preserve CSS scoping).

> **Disclaimer governance P-13**: `innerHTML` **NON è sanitizzato runtime**. La policy `fallback`
> è descriptor-time config controllato dall'host (parte del manifest, non runtime input).
> DOMPurify integration deferred V2.1 opt-in. NO XSS sanitization è un trade-off
> ratificato per minimal bundle + host-controlled config governance.

### `type: 'component'`

Delega al framework adapter di Phase 15 via Service Locator `SERVICE_FRAMEWORK_ADAPTER`
(D-V2-F14-14):

- **Adapter presente** (`@gluezero/react|vue|svelte` F15): `adapter.renderFallbackComponent(component, target, error)` → `fallbackType: 'component'`.
- **Adapter assente** (W3 P05 stato corrente F14): `console.warn` + HTML stub generic
  `<div data-gz-fallback-stub data-gz-mf="<mfId>">component fallback requires F15 adapter</div>`
  → `fallbackType: 'component-stub'` (graceful, **NON-throw** — diff F13 iframe-stub).

### `type: 'event'`

`broker.publish(definition.topic ?? 'microfrontend.fallback.event', payload, opts)` (D-V2-F14-15):

- Payload include `{microFrontendId, lifecyclePhase, error, fallbackApplied: true, timestamp}`.
- `fallbackApplied: true` è marker carryover PRD §31.5 — chain detection downstream.
- Opts: source descriptor F1 D-23 `{type:'plugin', id:'fallbacks', name:'@gluezero/fallbacks'}` + `deliveryMode:'sync'`.

Shell-app subscribe il topic e gestisce UI (Bell badge "service degraded", banner, ecc.).

### `type: 'custom'`

`await definition.handler(error, ctx)` con `try/catch`:

- Handler throw sync / Promise reject → `console.error` + `fallbackType: 'custom-failed'`.
- `ctx` = `MicroFrontendRuntimeContext` di Phase 10 (con facades `storage`/`gateway`/`worker`/`theme`
  se Phase 13 installato).
- Handler undefined → `console.warn` + `fallbackType: 'custom-failed'` (defensive, discriminated
  union ammette `handler?` optional).

### `type: 'none'`

No-op. Emette comunque `microfrontend.fallback.rendered` con `fallbackType: 'none'` per
observability (Phase 16 SnapshotProvider devtools future).

---

## 5. `RetryPolicy` — backoff + jitter

```ts
interface RetryPolicy {
  readonly attempts: number      // 1 = no retry (default)
  readonly delayMs?: number      // base delay ms (default 0)
  readonly backoff?: 'none' | 'linear' | 'exponential'  // default 'none'
  readonly jitter?: boolean      // ±20% randomization (default false)
}
```

| Mode | Delay formula | Esempio (base 100ms, attempt 0/1/2) |
|------|---------------|--------------------------------------|
| `none` | `delayMs` costante | 100 / 100 / 100 |
| `linear` | `delayMs * (attempt + 1)` | 100 / 200 / 300 |
| `exponential` | `delayMs * 2^attempt` | 100 / 200 / 400 |

**Jitter ±20% conservativo** (D-V2-F14-09): `factor = 0.8 + Math.random() * 0.4`, range
`[delay*0.8, delay*1.2)`. Mitiga retry-storm cross-MF (Pitfall P-01 thundering herd) —
distribuzione uniforme. Valore "conservativo" vs F3 AWS full ±50% perché browser context
ha minore tolleranza a delay variance.

**Retry skip runtime/update** (OQ-1 D-V2-F14-10-AMENDED):

Phase 8 NON espone trigger esplicito per `runtime`/`update` phase (errors arrivano da hook
user-code o adapter Phase 9 mf-esm). F14 applica fallback diretto senza retry per queste
due phase. La heuristic `recoverable: true` resta preservata per devtools observability
F16 (la semantica "errore intercettabile" è separata dalla decision "retry triggerable").

---

## 6. `CircuitBreakerPolicy` — state machine 3-state

```ts
interface CircuitBreakerPolicy {
  readonly enabled: boolean         // default false (opt-in safety D-V2-F14-11)
  readonly failureThreshold: number // consecutive fail prima di open
  readonly resetAfterMs: number     // durata open prima di half-open lazy
}
```

**State transitions** (3-state FSM):

| From | To | Trigger | Effetto |
|------|------|---------|---------|
| `closed` | `open` | `consecutiveFailures >= failureThreshold` | emit `microfrontend.circuit.opened` con `{microFrontendId, consecutiveFailures, timestamp}` |
| `open` | `half-open` | lazy: prossimo `canExecute()` post `resetAfterMs` | nessun emit (state machine internal) |
| `half-open` | `closed` | `recordSuccess` | emit `microfrontend.circuit.closed` + reset counter |
| `half-open` | `open` | `recordFailure` | re-emit `microfrontend.circuit.opened` + restart timer |

Topics emit usano source descriptor F1 D-23 `{type:'plugin', id:'fallbacks', name:'@gluezero/fallbacks'}`.

**Per-MF isolato**: ogni `mfId` ha proprio state interno (Map privata). Cleanup automatico
via subscribe `microfrontend.unregistered` (P-02 memory leak mitigation).

---

## 7. Examples

4 MF scenari concreti — vedi [`examples/microfrontends/mf-fallback-demo.html`](../../examples/microfrontends/mf-fallback-demo.html):

| MF | Mode | Use case |
|----|------|----------|
| `product-grid` | `html` | Load failure → `<div class="grid-error">Catalog unavailable</div>` |
| `analytics-widget` | `component` | Bootstrap failure → component-stub (no F15 adapter) |
| `notifications` | `event` | Runtime failure → topic `app.fallback.notifications` → Bell badge "service degraded" |
| `legacy-checkout` | `custom` + retry + circuit | `await fetch('/api/log-fallback'); ctx.storage?.setItem(...)` + 3 retry exponential + jitter + circuit threshold 3 |

Esempio inline `custom` async handler con context:

```ts
fallback: {
  onRuntimeError: {
    type: 'custom',
    handler: async (err, ctx) => {
      // ctx (Phase 10) opzionale — undefined se @gluezero/context non installato
      const log = ctx?.storage?.getItem('error-log') ?? '[]'
      const errors = JSON.parse(log)
      errors.push({
        mfId: err.microFrontendId,
        phase: err.lifecyclePhase,
        message: err.message,
        ts: Date.now(),
      })
      ctx?.storage?.setItem('error-log', JSON.stringify(errors.slice(-50)))
    },
  },
}
```

---

## 8. Errors — `MicroFrontendError` class

Class `MicroFrontendError extends Error` con `BrokerError` shape inline (D-V2-F14-05-RATIFIED).
Pattern **divergente** dai factory F11/F12/F13: F14 sceglie class per supportare
`instanceof MicroFrontendError` type narrowing devtools-friendly + ES2022 `cause`
propagation native.

```ts
import { MicroFrontendError } from '@gluezero/fallbacks'

throw new MicroFrontendError({
  code: 'MF_RETRY_EXHAUSTED',  // hint type MfFallbackErrorCode (5 codici locali)
  message: 'Retry exhausted for mfId=dashboard after 3 attempts',
  microFrontendId: 'dashboard',
  lifecyclePhase: 'load',
  recoverable: false,
  originalError: originalLoaderError, // auto-popola ES2022 `cause` se omesso esplicito
})
```

**5 codici hint locali** `MfFallbackErrorCode` (string aperto — D-V2-F14-06):

- `MF_FALLBACK_RENDER_FAILED`
- `MF_RETRY_EXHAUSTED`
- `MF_CIRCUIT_OPEN`
- `MF_FALLBACK_TARGET_NOT_FOUND`
- `MF_FALLBACK_COMPONENT_NO_ADAPTER`

**Compat duck-typing**: `isBrokerError(err)` di `@gluezero/core` ritorna `true` via
duck-typing (`code !== undefined && category !== undefined`). Helper opt-in
`err.toBrokerError()` converte a plain shape non-class (utile per `postMessage`
structured clone o `JSON.stringify`).

---

## 9. Q&A

**Q: Perché `fallbacksModule` è opt-in invece di built-in core?**
Phase 8 D-V2-F8-10 lockato: no auto-install. Host decide quando attivare governance F14.
Bundle gate 6 KB applicato solo se installato.

**Q: Pattern S1 augment subpath quanto pesa?**
L'augment è side-effect-only (~22 B gzipped) + declaration merging type-only (0 bytes
runtime). Import obbligatorio per chi vuole il narrowing TS `descriptor.fallback?` su
`MicroFrontendDescriptor`; il narrowing è locale (D-V2-F14-19 stretto — NO `declare
module '@gluezero/microfrontends'`).

**Q: Perché Service Locator delega a F15 invece di rendering inline React/Vue?**
F14 NON può dipendere da `react`/`vue`/`svelte` (bundle bloat 50-100 KB + peer mismatch).
F15 framework adapters implementano `renderFallbackComponent`. Adapter assente:
HTML stub generic graceful (NON-throw) → `fallbackType: 'component-stub'`.

**Q: Permission action `'fallback'` supportata?**
NO — F11 `PermissionAction` è literal union chiuso (RATIFIED D-V2-F14-AMENDABLE).
Aggiungere `'fallback'` richiede diff F11 `src/` → D-83 violation septuple. Fallback
rendering è governance-layer host-controlled, non permission-gated. Deferred V2.1.

**Q: Retry runtime/update?**
Skipped (`recoverable: true` heuristic preserved per devtools observability F16, ma
trigger API NON disponibile in F8 5-ops surface — RATIFIED D-V2-F14-10-AMENDED).
F15 adapter potrebbe propagare via lifecycle hooks (deferred).

**Q: Cosa succede se `descriptor.fallback` NON è dichiarato per un MF?**
Orchestrator usa `options.defaultPolicy` (host-level). Se anche quello assente, emette
`microfrontend.fallback.rendered` con `fallbackType: 'none'` (observability preserve)
senza rendering visivo.

---

## 10. Migration v1.x → v2.0

`@gluezero/fallbacks` è additive opt-in v2.0 — **nessun breaking** per app v1.x.

```ts
// v1.x (no fallbacks support — error topics emessi ma no orchestrator)
const broker = createBroker({ modules: [microfrontendModule()] })

// v2.0 (additive opt-in fallbacks)
const broker = createBroker({
  modules: [microfrontendModule(), fallbacksModule({ /* options */ })],
})
```

**Compatibilità verificata**:

- `MicroFrontendError` class è additive (non sostituisce `createMfError` factory di Phase 8).
- 14 API v1.x preservation gate PASS (`v1-bc-replay/publish-ordering.test.ts` 267/270).
- Pipeline §28 cross-fase ordine preservato (`pipeline-harness` MF-PIPE-01).

---

## 11. Limitations — PRD §29.6 runtime error boundary shared-window

In modalità framework-shared-window (default Phase 13 isolation `dom: 'mount-root'`),
runtime errors possono essere intercettati SOLO se:

1. Passati esplicitamente dagli adapter Phase 15 (React `componentDidCatch` / Error Boundary,
   Vue `errorHandler`, Svelte component-level catch).
2. Sollevati negli hook lifecycle (`onMount`, `onUnmount`, `onUpdate`) — F8 emette
   `MF_ERROR_TOPICS` standard.

Per iframe MF (Phase 15 `@gluezero/mf-iframe`): errors riportati via bridge
`gz:context:update` postMessage (deferred F15 closure).

F14 inline scope = errors propagati via lifecycle FSM Phase 8 + adapter Phase 15.
Code-level error boundary inline (`window.addEventListener('error')` /
`unhandledrejection`) NON è intercettato F14 (deferred V2.1).

**Threat model coverage** (vedi `14-CONTEXT.md` threat register T-14-05-01..04):

- Tampering check-d83-f14 baseline drift → mitigate via `resolveBaseline()` helper.
- DoS retry storm → mitigated via default `attempts: 1` + jitter ±20% + circuit before retry.

---

## 12. Performance

- **Bundle**: ≤ 6 KB gzipped (`@gluezero/fallbacks` index.js) + ≤ 1 KB (`augment.js`).
  Misura corrente W3 P05 closure: index ~3.4 KB gzip (57% del cap), augment ~22 B gzip.
- **Zero overhead se non installato**: package è opt-in `BrokerModule` factory; consumer
  che NON installa `fallbacksModule()` paga 0 bytes runtime.
- **Lookup costs**: Service Locator lookup (`SERVICE_ISOLATION`, `SERVICE_FRAMEWORK_ADAPTER`)
  sono lazy + cached implicito per call (~50 ns per hit).
- **Subscribe overhead**: 7 `broker.subscribe` sui `MF_ERROR_TOPICS` + 1 su
  `microfrontend.unregistered` → 8 subscriptions totali. Cleanup cascade D-V2-16 garantisce
  zero leak (`AbortController` orchestrato).
- **Retry counter**: `Map<mfId::phase, number>` privato, O(1) ops. Cleanup automatico su
  unregister.
- **Circuit state**: `Map<mfId, CircuitState>` privato, O(1) ops. Cleanup automatico.

---

## 13. Bundle

Verifica gate locale:

```sh
pnpm --filter @gluezero/fallbacks exec size-limit
```

Output atteso:

```
@gluezero/fallbacks (gzip)         ≤ 6 KB
@gluezero/fallbacks/augment (gzip) ≤ 1 KB
```

**Tree-shake friendly**: ESM-only + `sideEffects: ["./dist/augment.js", "./src/augment.ts",
"**/augment.js", "**/augment.ts"]` array completo. I sub-renderer
(`html`/`component`/`event`/`custom`) sono **internal-only** (NO re-export da barrel —
il consumer ottiene la chain completa via `dispatchFallback` dispatcher unificato).

**Composite gate end-to-end** (`ci:gate:f14`):

```sh
pnpm --filter @gluezero/fallbacks run ci:gate:f14
```

Sequenza: `typecheck` → `build` → `test` → `publint` → `attw` → `size-limit` →
`check-d83-f14` → `v1-bc-replay` → `pipeline-harness`. Failure singola → exit 1.

---

*Documentazione italiano descrittivo per CLAUDE.md vincolo; identifier/code/log keyword
inglesi. Per dettaglio decision D-V2-F14-* vedi `14-VERIFICATION.md` formal closure.*
