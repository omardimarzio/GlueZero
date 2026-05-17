# @gluezero/mf-esm

> **ESM dynamic loader per micro-frontend GlueZero v2.0** — `import(url)` + `AbortSignal.timeout` + normalizzazione export con smart fallback priority.

**Stato:** experimental — alpha `v2.0.0`. Non pubblicato su npm fino alla GA v2.0.0 (Phase 17).

![Status: experimental](https://img.shields.io/badge/status-experimental_alpha-orange)
![Bundle](https://img.shields.io/badge/bundle-3KB_gzip-blue)
![Tier-1](https://img.shields.io/badge/Tier_1-jsdom-green)
![Tier-3](https://img.shields.io/badge/Tier_3-Playwright_Chromium-orange)
![D--83](https://img.shields.io/badge/D--83-strict_carryover_esteso-purple)

ESM-only TypeScript library. Browser evergreen target (ES2022). Loader concreto che implementa l'interface `MicroFrontendLoaderAdapter` di [`@gluezero/microfrontends`](../microfrontends/README.md) con `type: 'esm'`. Carica i micro-frontend via `import(url)` dinamico, applica un timeout configurabile via `AbortSignal.timeout`, e normalizza l'export del modulo a `MicroFrontendRuntimeModule` (5 hook lifecycle).

Tre dipendenze runtime: [`@gluezero/core`](../core/README.md) (broker base, peer workspace), [`@gluezero/microfrontends`](../microfrontends/README.md) (registry + FSM, peer workspace), un side-effect entry opt-in `@gluezero/mf-esm/augment` per Pattern S1 intent signaling.

## Indice

1. [Quick start](#quick-start)
2. [Loader contract](#loader-contract)
3. [Options](#options)
4. [Module shape rules](#module-shape-rules)
5. [Examples](#examples)
6. [Errors](#errors)
7. [Q&A](#qa)
8. [Bundle size + Testing](#bundle-size--testing)
9. [REQ-IDs coverage](#req-ids-coverage)

---

## Quick start

### Installazione (post-GA v2.0.0)

```bash
pnpm add @gluezero/mf-esm @gluezero/microfrontends @gluezero/core
# oppure
npm install @gluezero/mf-esm @gluezero/microfrontends @gluezero/core
```

> **Stato corrente**: workspace-only durante v2.0 alpha. Pubblicato su npm a GA Phase 17.

`@gluezero/mf-esm` dichiara `@gluezero/microfrontends` come peer dependency obbligatoria (non optional): il loader registra sé stesso via Service Locator e richiede che `microfrontendModule()` sia installato PRIMA nell'array `modules: []`.

### Esempio minimale

```typescript
import { createBroker } from '@gluezero/core'
import { microfrontendModule } from '@gluezero/microfrontends'
import { mfEsmModule } from '@gluezero/mf-esm'

// 1. Crea broker con entrambi i moduli installati (ordine OBBLIGATORIO)
const broker = createBroker({
  modules: [microfrontendModule(), mfEsmModule()],
})

// 2. Registra un descriptor MF con loader ESM
await broker.registerMicroFrontend!({
  id: 'customer-dashboard',
  name: 'Customer Dashboard',
  version: '1.0.0',
  loader: { type: 'esm', url: 'https://cdn.example/dashboard.js' },
})

// 3. Carica + monta (auto-bootstrap D-V2-07)
await broker.loadMicroFrontend!('customer-dashboard')
await broker.mountMicroFrontend!('customer-dashboard')
```

> **Nota:** `broker.registerMicroFrontend!` / `loadMicroFrontend!` / `mountMicroFrontend!` richiedono l'import side-effect `@gluezero/microfrontends/augment` (F8). Senza augment, il flow equivalente passa attraverso `broker.getService(SERVICE_MICROFRONTENDS).{register,load,mount}`.

---

## Loader contract

Il loader concreto `esmLoader` implementa `MicroFrontendLoaderAdapter` (interface F8) con `type: 'esm'` e riceve un `MicroFrontendLoaderDefinition` con questo shape:

```typescript
interface MicroFrontendLoaderDefinition {
  type: 'esm'                  // discriminator literal
  url: string                  // URL del modulo ESM (obbligatorio)
  timeoutMs?: number           // default 15000 (PRD §23.4)
  exportName?: string          // default undefined → strategy default → strategy named flat
  options?: Record<string, unknown>  // riservato per future estensioni
}
```

Vedi [PRD §23 (ESM loader)](../../prd_2.0.0.md) per il contratto completo.

---

## Options

### `timeoutMs` (default `15000`)

Tempo massimo entro cui `import(url)` deve risolversi. Se eccede → throw `MF_LOADER_TIMEOUT`. Override per-MF:

```typescript
loader: { type: 'esm', url: '/mfs/slow.js', timeoutMs: 30000 }
```

> Decisione lockata D-V2-F9-04: `mfEsmModule()` è una factory **no-args**. NO setup-time options globali (carryover PRD §23.4). Override sempre per-MF.

### `exportName` (default `undefined`)

Nome dell'export named da preferire. Tre valori semanticamente distinti:

| Valore                | Strategia attivata                                            |
| --------------------- | ------------------------------------------------------------- |
| `undefined`           | Strategy 2 (default export) → Strategy 3 (named flat)         |
| `'default'`           | Equivalente a `undefined` (Strategy 2)                        |
| `'app'`, `'lifecycle'`, ... | Strategy 1 esplicita — fail-fast se l'export named manca |

Override per-MF:

```typescript
loader: { type: 'esm', url: '/mfs/multi.js', exportName: 'lifecycle' }
```

---

## Module shape rules

`@gluezero/mf-esm` accetta il modulo ESM caricato in **tre forme** semanticamente equivalenti, in ordine di priorità (D-V2-F9-05):

### Priority 4-step (lockata)

1. **Strategy 1 — `exportName` esplicito** (≠ `'default'`):
   `module[exportName]` → se ha `mount` function → OK. Altrimenti throw `MF_LOADER_INVALID_MODULE` (fail-fast, no fallthrough).
2. **Strategy 2 — `module.default`**:
   Se `module.default` ha `mount` function → OK.
3. **Strategy 3 — named exports flat**:
   `module.bootstrap`/`module.mount`/etc. top-level → se almeno `mount` function → OK.
4. **Throw** `MF_LOADER_INVALID_MODULE` con rich diagnostic details.

### Hook minimo obbligatorio: `mount`

Solo `mount` è hook minimo richiesto (D-V2-F9-06). Senza `mount` un MF non può renderizzare. Gli altri 4 hook (`bootstrap`, `update`, `unmount`, `destroy`) sono opzionali: no-op se assenti.

### Type check strict

Per ogni hook, `typeof === 'function'` STRICT (D-V2-F9-07). Una chiave esistente ma con valore non-function (null, oggetto, primitive, string) viene **esclusa** dalla normalizzazione SENZA throw. Robusto per pattern `bootstrap = null` consumer.

---

## Examples

### Esempio 1 — default export

```javascript
// mfs/dashboard.js
export default {
  async bootstrap(ctx) {
    ctx.logger?.info?.('bootstrap')
  },
  async mount(ctx) {
    const root = document.querySelector('#mf-root')
    root.innerHTML = '<h2>Dashboard caricato</h2>'
  },
  async unmount(ctx) {
    document.querySelector('#mf-root').innerHTML = ''
  },
  destroy(ctx) {
    /* cleanup finale */
  },
}
```

```typescript
loader: { type: 'esm', url: '/mfs/dashboard.js' }  // exportName omesso → Strategy 2
```

### Esempio 2 — `exportName` esplicito

```javascript
// mfs/multi-mf.js
export const app = {
  mount(ctx) { /* ... */ },
  unmount(ctx) { /* ... */ },
}
export const tracker = {
  mount(ctx) { /* ... */ },
}
```

```typescript
// Carica solo `app` lifecycle
loader: { type: 'esm', url: '/mfs/multi-mf.js', exportName: 'app' }
```

### Esempio 3 — named exports flat

```javascript
// mfs/flat.js
export function mount(ctx) {
  /* ... */
}
export function unmount(ctx) {
  /* ... */
}
```

```typescript
loader: { type: 'esm', url: '/mfs/flat.js' }  // Strategy 3 fallback
```

---

## Errors

`@gluezero/mf-esm` espone 3 codici errore via la factory `createMfEsmError`:

### `MF_LOADER_TIMEOUT`

`import(url)` non risolve entro `timeoutMs`. Details:

```typescript
{ url: string, timeoutMs: number, elapsedMs: number }
```

### `MF_LOADER_ABORTED`

Consumer `ctx.signal` aborted prima del timeout interno. Details:

```typescript
{ url: string, reason?: string }
```

### `MF_LOADER_INVALID_MODULE`

Modulo non ha lifecycle valido (no `mount` function dopo le 3 strategie) o errore network/parse durante `import()`. Details:

```typescript
{
  url: string
  exportName?: string
  hasDefault: boolean
  defaultKeys: string[]    // top-level keys di module.default (se è object)
  namedKeys: string[]      // keys di module filtrate !== 'default'
  reason: string           // human-readable per debug DX
}
```

### Esempio handler

```typescript
broker.subscribe('microfrontend.load.failed', (evt) => {
  const { id, error } = evt.payload
  if (error.code === 'MF_LOADER_TIMEOUT') {
    console.warn(`MF ${id} timeout dopo ${error.details.elapsedMs}ms`)
  } else if (error.code === 'MF_LOADER_INVALID_MODULE') {
    console.error(`MF ${id} invalido:`, error.details.reason)
  }
})
```

---

## Q&A

### Perché `@gluezero/mf-esm/augment` non aggiunge metodi al `Broker`?

Decisione lockata **D-V2-F9-02** più stretta di F2/F8: il subpath augment di `@gluezero/mf-esm` è side-effect-only intent signaling puro. NESSUN metodo nuovo su `Broker.prototype` E NESSUN blocco `declare module '@gluezero/core'`. La DX consumer è già coperta da `service.load(id)` (Service Locator) o `broker.loadMicroFrontend(id)` (esposto da `@gluezero/microfrontends/augment` F8). Surface API ridotta = bundle gain + tree-shake friendly.

### Posso registrare un loader custom con `type: 'esm'` insieme a `mfEsmModule()`?

No. La `LoaderRegistry.register()` di F8 lockato OQ-15 fa throw `MF_LOADER_TYPE_DUPLICATE` se il `type` è già registrato. Doppio install di `mfEsmModule()` o conflitto con custom loader `type: 'esm'` → fail-fast. Per loader custom: usa un type discriminator diverso (es. `'esm-cdn'`, `'esm-versioned'`).

### Cosa succede se l'URL è inaccessibile?

`import(url)` rejecta con network error (`TypeError: Failed to fetch dynamically imported module` browser, `ERR_NETWORK` o simili). `@gluezero/mf-esm` wrappa l'errore originale in `MF_LOADER_INVALID_MODULE` preservando `originalError` per debug. Il MF transita a FSM state `failed` con `failureReason.phase: 'load'` (D-V2-06).

### `exportName: 'default'` è equivalente a omettere `exportName`?

Sì. Entrambi attivano **Strategy 2** (lookup `module.default`). La logica D-V2-F9-05 step 1 esplicitamente esclude `exportName === 'default'` dal fail-fast comportamento di Strategy 1. Use case raro: documenta intent del consumer di voler il default export anche se il modulo ha named exports.

### Hot reload supportato?

No, non in V2.0. Il browser cache i moduli ESM per URL, e `import()` ritorna sempre la stessa Module Record per uno stesso URL nella stessa pagina. Per testing locale: usa fixture private (vedi `test/fixtures/sample-mf.js`) servite da Vite dev server con cache-busting query param (`?v=${Date.now()}`). Hot reload runtime è planning per V2.1 con strategia `import` + cache invalidation manuale.

### Posso usare `mfEsmModule()` con più broker indipendenti?

Sì. La factory rispetta **D-30 anti-singleton**: ogni call ritorna un nuovo `BrokerModule`. Test verificano che 2 broker indipendenti possano installare `mfEsmModule()` senza shared state.

### Bundle cap 3 KB è realistic per produzione?

Sì. Bundle effettivo a fine F9 W3: ~1.7 KB gzipped (vedi sezione successiva). Headroom ~1.3 KB per future estensioni V2.1 (es. integrity check SRI per CDN-hosted MF).

---

## Bundle size + Testing

### Bundle size

| Entry                              | Limit         | Effettivo (gzip) | Stato |
| ---------------------------------- | ------------- | ---------------- | ----- |
| `@gluezero/mf-esm (gzip)`          | 3 KB          | ~1.7 KB          | ✅    |
| `@gluezero/mf-esm/augment (gzip)`  | 1 KB          | ~30 B            | ✅    |

Cap lockato **D-V2-F9-18**. Tree-shake amichevole (tsup `treeshake: true` + `minify: true`).

### Testing

- **Tier-1 jsdom**: 82+ unit test (`esm-loader.test.ts`, `normalize.test.ts`, `combine-signals.test.ts`, `mf-esm-error.test.ts`, `mf-esm-module.test.ts`). Eseguito con `pnpm test`.
- **Tier-3 Playwright Chromium**: 3 scenari E2E con browser reale (`end-to-end-scenario.test.ts`, `timeout-scenario.test.ts`, `race-load-mount.test.ts`). Eseguito con `pnpm test:browser` (richiede Chromium installato via `pnpm exec playwright install chromium`).

---

## REQ-IDs coverage

| REQ-ID       | Descrizione                                                                          | Status   |
| ------------ | ------------------------------------------------------------------------------------ | -------- |
| `MF-ESM-01`  | `import(url)` + `AbortSignal.timeout(15000)` default + `exportName` opt              | Complete |
| `MF-ESM-02`  | Accetta `default` OR named exports; invalid → `MF_LOADER_INVALID_MODULE`             | Complete |

Vedi [REQUIREMENTS.md](../../.planning/REQUIREMENTS.md) per la traceability matrix completa Phase 9.

---

*Versione: `2.0.0-alpha.0` • Last updated: 2026-05-11*
