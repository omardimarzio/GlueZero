# @gluezero/theme

> **UI Standardization Layer** per GlueZero v1.1 — design tokens canonici (`--gz-*`) + role registry (`data-gz-role="action.primary"`) + theme adapter intercambiabile + broker events `ui.*`. **Opt-in.** Bundle ≤ 6 KB gzipped.

> 🎉 **v2.0.0 GA (2026-05-17)** — Theme integration per-MF via `@gluezero/isolation` (Phase F13 — theme bridge + shadow-DOM scoping). Vedi [root README](../../README.md#microfrontend-governance-layer-v20-opt-in) · [docs/v2/](../../docs/v2/index.md) · [migration guide A/B/C](../../docs/v2/17-migration-guide.md).

[![npm](https://img.shields.io/npm/v/@gluezero/theme.svg)](https://npmjs.com/package/@gluezero/theme)

## Cos'è

`@gluezero/theme` permette a plugin sviluppati indipendentemente — in qualunque framework UI (React, Vue, Svelte, Solid, Lit, Web Components, vanilla DOM) — di essere **ribrandizzati**, **dark-mode-switched**, **density-adattati** e **RTL-switched** a runtime, senza ricompilazione.

Il pattern replica al dominio visuale lo stesso paradigma del canonical mapper di `@gluezero/mapper` (v1.0): vocabolario di **ruoli canonici** (`data-gz-role="action.primary"`) + **theme adapter** intercambiabile (`roleMap` o `cssRules`) + **design tokens canonici** (`--gz-color-primary`, `--gz-spacing-md`, …).

Tutti i cambi di tema attraversano la pipeline §28 standard del broker come eventi (`ui.theme.changed`, `ui.density.changed`, `ui.direction.changed`, `ui.adapter.changed`, `ui.osPreference.changed`). Sono ispezionabili via Theme Inspector, esposto come subpath additivo `@gluezero/devtools/theme-inspector`.

L'intero layer è **opt-in**: chi non importa `@gluezero/theme` paga zero KB. Chi lo importa ma non lo configura ha un default ragionevole (`auto` mode mirror OS, persistenza OFF, scope `:root`, tokens canonici `--gz-*` riconosciuti).

## Quick start

### 1. Installa

```bash
pnpm add @gluezero/theme
```

### 2. Linka `tokens-default.css` nel `<head>` (anti-FOUC)

```html
<!doctype html>
<html>
  <head>
    <link rel="stylesheet" href="/node_modules/@gluezero/theme/tokens-default.css">
    <script>
      // IIFE inline pre-paint — vedi getInitialThemeScript()
    </script>
  </head>
  <body>...</body>
</html>
```

Per evitare il FOUC al boot, inietta il body IIFE generato da `getInitialThemeScript()`:

```typescript
import { getInitialThemeScript } from '@gluezero/theme'

// Build-time / SSR: inserisci il body in un <script> nel <head>
// PRIMA del JS principale.
const body = getInitialThemeScript({ persistence: 'localStorage' })
// → "(function(){ ... document.documentElement.setAttribute(...) ... })();"
```

L'IIFE legge `localStorage.getItem('gluezero.theme.mode')` (se `persistence: 'localStorage'`) o usa `'auto'`, risolve `prefers-color-scheme`, e setta `data-gz-theme` + `data-gz-mode` su `<html>` PRIMA del paint.

### 3. Crea il theme runtime

```typescript
import { createGlueZero } from '@gluezero/gluezero'
import { createTheme } from '@gluezero/theme'

const theme = createTheme({
  persistence: 'localStorage', // opt-in (default OFF — D-F7-12)
})
const gz = createGlueZero({ theme })

theme.manager.setMode('auto') // mirror prefers-color-scheme dell'OS
```

Anche standalone (senza aggregate `createGlueZero`) il theme funziona: composizione **Opzione B** (D-F7-01) — broker injection opt-in.

### 4. Usa `data-gz-role` nel markup

```html
<button data-gz-role="action.primary">Salva</button>
<input data-gz-role="input.text" />
<div data-gz-role="surface.elevated">…</div>
```

### 5. Registra un adapter (Tailwind, Bootstrap, tokens-only, …)

```typescript
theme.register({
  id: 'tailwind',
  roleMap: {
    'action.primary': 'bg-indigo-600 text-white px-4 py-2 rounded',
    'action.secondary': 'bg-gray-200 text-gray-900 px-4 py-2 rounded',
    'feedback.error': 'text-red-600',
  },
})

theme.setActiveAdapter('tailwind')
```

A questo punto ogni `<button data-gz-role="action.primary">` riceve automaticamente `bg-indigo-600 text-white px-4 py-2 rounded` via MutationObserver, anche per nodi aggiunti dinamicamente al DOM.

## Token system

### Vocabolario lockato v1.1.0 (D-F7-22 — ~35 token)

| Categoria        | Token                                                                                                                                                                                                                                                                                                              | Conteggio |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| Color (semantic) | `color-primary`, `color-on-primary`, `color-secondary`, `color-on-secondary`, `color-surface`, `color-surface-elevated`, `color-text`, `color-text-muted`, `color-border`, `color-error`, `color-success`, `color-warning`, `color-info`                                                                           | 13        |
| Spacing          | `spacing-xs`, `spacing-sm`, `spacing-md`, `spacing-lg`, `spacing-xl`, `spacing-2xl`                                                                                                                                                                                                                                | 6         |
| Radius           | `radius-none`, `radius-sm`, `radius-md`, `radius-lg`, `radius-full`                                                                                                                                                                                                                                                | 5         |
| Elevation        | `elevation-0`, `elevation-1`, `elevation-2`, `elevation-3`                                                                                                                                                                                                                                                         | 4         |
| Font             | `font-size-base`, `font-size-lg`, `font-size-xl`                                                                                                                                                                                                                                                                   | 3         |
| Motion           | `motion-short`, `motion-medium`, `motion-long`                                                                                                                                                                                                                                                                     | 3         |
| Z-index          | `z-overlay`, `z-modal`                                                                                                                                                                                                                                                                                             | 2         |

Tutti i token vivono in `:root` come CSS Custom Properties con prefix `--gz-*`. La **dark mode** è uno swap atomico di un sottoinsieme (~12 valori semantici color/surface) applicato via attribute selector `[data-gz-theme="dark"]`.

I 10 token più "core" (`color-primary`, `color-surface`, `color-text`, `spacing-md`, `radius-md`, …) hanno autocomplete IDE via module augmentation di `csstype` (`csstype-augment.ts`). Gli altri ~25 + i custom token restano `string` (anti-feature ban list — niente narrow types esaustivi).

### `applyTokens` runtime override

```typescript
// Brand swap atomico
theme.applyTokens({
  'color-primary': '#FF6B35',
  'color-on-primary': '#FFFFFF',
})
// Tutti i nodi che leggono var(--gz-color-primary) si aggiornano in 1 paint
```

L'apply scrive `:root.style.setProperty('--gz-color-primary', '#FF6B35')` + aggiorna lo stato interno + notifica i subscriber + pubblica `ui.theme.changed` (se broker fornito).

### Multi-scope theming (D-F7-05)

Per micro-frontend con tema differente nella stessa pagina:

```typescript
const dashboard = document.querySelector<HTMLElement>('.dashboard')!
theme.applyTokens(
  { 'color-primary': '#FF6B35' },
  { scope: dashboard },
)
// Solo il subtree .dashboard riceve il nuovo --gz-color-primary; :root invariato.
```

## Ruoli canonici (Role Registry)

### `STANDARD_ROLES` v1.1.0 lockato (D-F7-15 — 14 ruoli)

```typescript
import { STANDARD_ROLES } from '@gluezero/theme'

// [
//   'action.primary', 'action.secondary', 'action.danger', 'action.ghost',
//   'feedback.error', 'feedback.success', 'feedback.warning', 'feedback.info',
//   'surface.base', 'surface.elevated',
//   'input.text', 'input.invalid',
//   'navigation.link', 'navigation.active',
// ]
```

**Naming convention: dot-notation** `category.subname` (D-F7-16). Pseudo-state (disabled, hover, focus) si gestiscono via CSS pseudo-classi standard sul selettore `[data-gz-role="..."]` (D-F7-18) — NON ruoli espliciti aggiuntivi.

```css
[data-gz-role="action.primary"]:hover { … }
[data-gz-role="action.primary"]:disabled { … }
[data-gz-role="input.text"]:focus { … }
```

### Custom roles

```typescript
theme.manager.roles.register({
  'custom.callout': { description: 'Callout component custom' },
})
```

Cap **100 ruoli** default + soft-warn al 50% + `{ allowMore: true }` opt-in (D-F7-14). Stessa logica del cap token (200) — pattern role-match con i registry F1/F6.

## Theme adapter (3 strategie)

### Strategia A — `DomApplier` (`roleMap`)

L'adapter dichiara `roleMap`: ruolo → classi del DS attivo. Un MutationObserver `attributeFilter: ['data-gz-role']` (Pitfall HIGH #3 mitigation — overhead minimal) applica le classi ai nodi via `WeakMap`-tracker non-destructive (UI-ROLE-10).

```typescript
theme.register({
  id: 'tailwind',
  roleMap: {
    'action.primary': 'bg-indigo-600 text-white px-4 py-2 rounded',
  },
})
```

Caso d'uso: utility-class DS (Tailwind, Bootstrap, …).

### Strategia B — `StyleSheetGenerator` (`cssRules`)

L'adapter dichiara `cssRules`: ruolo → CSS rules. Un singolo `<style>@layer gluezero-theme.adapter { [data-gz-role="X"] { ... } }` viene iniettato in `<head>` (o nello `scope`).

```typescript
theme.register({
  id: 'tokens-only',
  cssRules: {
    'action.primary':
      'background: var(--gz-color-primary); color: var(--gz-color-on-primary); padding: var(--gz-spacing-md) var(--gz-spacing-lg); border-radius: var(--gz-radius-md);',
  },
})
```

Caso d'uso: design system "tokens-only" (zero utility classes, regole DS-specific che leggono `var(--gz-*)`). Cascade lockata `@layer gluezero-theme.adapter` (D-F7-10) → specificity controllata, niente specificity war (Pitfall HIGH #2).

### Strategia C — `classFor()` escape hatch

```typescript
import { classFor } from '@gluezero/theme'

const adapter = theme.manager.adapters.getActive()
btn.className = classFor(adapter, 'action.primary')

// Oppure in React JSX:
// <button className={classFor(adapter, 'action.primary')}>Salva</button>
```

Helper puro, no side-effect DOM, no observer. Ruoli non coperti ritornano `''` (no throw) — l'Inspector flagga come `unregistered+used (warn)` se serve.

### Hot-swap runtime atomico

```typescript
theme.setActiveAdapter('tailwind')   // tailwind classes su tutti i nodi data-gz-role
theme.setActiveAdapter('bootstrap5') // btn btn-primary
theme.setActiveAdapter(null)         // remove all adapter classes (cleanup non-destructive)
```

Hot-swap è atomico via `queueMicrotask` (Q5 raccomandazione) — nessun visible flicker. Le classi precedenti vengono rimosse SOLO dal `WeakMap track`: classi pre-esistenti aggiunte dal consumer restano.

### Collision throw + override esplicito (D-F7-09)

```typescript
theme.register({ id: 'tailwind', … })
theme.register({ id: 'tailwind', … }) // throw ThemeError theme.adapter.duplicate
theme.register({ id: 'tailwind', … }, { override: true }) // OK, esplicito
```

Niente "first wins" implicito — silent override è una sorgente nota di debug notturno. La policy è opt-in esplicito.

## Broker events `ui.*`

Tutti i cambi tema sono pubblicati come eventi broker (UI-EVENT-01..06):

| Topic                    | Payload                                                                |
| ------------------------ | ---------------------------------------------------------------------- |
| `ui.theme.changed`       | `{ themeId, tokens, mode, resolvedMode, scope }`                       |
| `ui.density.changed`     | `{ density, previous? }`                                               |
| `ui.direction.changed`   | `{ dir, previous? }`                                                   |
| `ui.adapter.changed`     | `{ current, previous, cause: 'manual'/'plugin-cascade'/'unregister' }` |
| `ui.osPreference.changed`| `{ kind: 'color-scheme'/'reduced-motion'/'contrast', value }`          |

```typescript
import { UI_THEME_CHANGED } from '@gluezero/theme'

const unsub = broker.subscribe(UI_THEME_CHANGED, (event) => {
  console.log('Mode changed to', event.payload.mode)
})
```

**Lifecycle cascade:** se un plugin viene unregistered (`broker.publish('system.plugin.unregistered', { id })`), tutti i theme adapter registrati con `{ ownerPluginId }` vengono cleanup-ati (LIFE-02 ext F7, D-F7-06). Se l'adapter cleanup-ato era ATTIVO → emette `ui.adapter.changed` con `cause: 'plugin-cascade'`.

## Devtools

Subpath additivo `@gluezero/devtools/theme-inspector`:

```typescript
import {
  createThemeInspector,
  createRoleCoverageReport,
  createLiveTokenEditor,
  snapshotTokens,
} from '@gluezero/devtools/theme-inspector'

const inspector = createThemeInspector(broker, { initiallyEnabled: true })
theme.manager.setMode('dark')
console.log(inspector.getBuffer())
// [{ topic: 'ui.theme.changed', payload: ..., timestamp: ... }, ...]

const coverage = createRoleCoverageReport({
  adapter: theme.manager.adapters.getActive(),
  roles: theme.manager.roles.list(),
}).scan()
console.log(coverage.unregisteredAndUsedWarn)
// → ruoli usati nel DOM ma non coperti dall'adapter

const editor = createLiveTokenEditor({ tokenRegistry: theme.manager.tokens })
editor.set('color-primary', '#00BCD4') // applica a runtime + emette ui.theme.changed

const snap = snapshotTokens()
// → Record<string, string> dei `--gz-*` correnti su :root, JSON-serializable per export
```

Subpath additivo (D-F7-04) → tree-shake-friendly: chi non importa devtools paga zero KB sul bundle production.

## Persistence opt-in

`createTheme({ persistence: 'localStorage' })` attiva la persistenza con **4 chiavi separate** (Q3 raccomandazione lockata):

- `gluezero.theme.mode` ('auto' | 'light' | 'dark')
- `gluezero.theme.density` ('compact' | 'comfortable' | 'spacious')
- `gluezero.theme.direction` ('ltr' | 'rtl')
- `gluezero.theme.adapter` (id stringa o '')

**Default OFF** (D-F7-12) — nessuna scrittura silente. Multi-tab via `StorageEvent` listener: cambi in tab A vengono mirror-ati in tab B atomicamente.

## Anti-FOUC

Pipeline raccomandata:

1. `<head>` → `<link rel="stylesheet" href=".../tokens-default.css">` (defaults `--gz-*` per `:root`).
2. `<head>` → `<script>${getInitialThemeScript({ persistence: 'localStorage' })}</script>` (IIFE blocking pre-paint setta `data-gz-theme`/`data-gz-mode`).
3. JS principale dopo: `createTheme()` legge stato corrente (DOM attribute + localStorage) e si sincronizza senza re-paint.

## Scenario end-to-end: meteo dashboard dark mode (F1+F2+F3+F4+F5+F6+F7)

```typescript
import { createGlueZero } from '@gluezero/gluezero'
import { createTheme } from '@gluezero/theme'
import { registerCanonicalSchema } from '@gluezero/mapper'

// F2 canonical schema (esistente)
registerCanonicalSchema('weather.observation', { /* ... */ })

// F7 theme + persistence opt-in + broker injection
const theme = createTheme({ persistence: 'localStorage' })
const gz = createGlueZero({ theme })

// F1 plugin lifecycle + LIFE-02 ext F7 cascade su unregister
gz.plugins.register({
  id: 'meteo',
  onMount(ctx) {
    // F2 mapper: weather.observation → UI-shaped
    ctx.broker.subscribe('weather.observation', (ev) => {
      // F6 cache: stato locale per riconnessione (deduce delta)
      // F3/F4 routing+gateway: SSE inbound già consumato
      const role = ev.payload.severity === 'critical' ? 'feedback.error' : 'feedback.info'
      renderCard(role, ev.payload)
    })

    // F7 theme adapter scoped al plugin (cleanup automatico su unregister)
    gz.theme?.register(
      {
        id: 'meteo-tailwind',
        roleMap: {
          'feedback.info': 'bg-blue-50 text-blue-900 px-3 py-2 rounded',
          'feedback.error': 'bg-red-50 text-red-900 px-3 py-2 rounded ring-1 ring-red-200',
          'surface.elevated': 'bg-white shadow-md rounded-lg',
        },
      },
      { ownerPluginId: 'meteo' },
    )
    gz.theme?.setActiveAdapter('meteo-tailwind')
  },
})

// Auto dark mode via OS prefs
gz.theme?.manager.setMode('auto')

// Brand swap a runtime
gz.theme?.applyTokens({ 'color-primary': '#FF6B35' })

// Cleanup: unregister plugin → cascade unregisterAdapter + ui.adapter.changed cause='plugin-cascade'
gz.plugins.unregister('meteo')
```

Tutto attraversa la pipeline §28 standard del broker. Inspector W5a può ricostruire l'intera storia degli eventi `ui.*` via `inspector.getBuffer()`.

## Browser support degradation policy (UI-DOC-02)

| Feature                          | Baseline | Status v1.1.0                                        |
| -------------------------------- | -------- | ---------------------------------------------------- |
| CSS Custom Properties            | universal| ✅ supportato                                        |
| CSS `@layer`                     | 2022-08  | ✅ supportato                                        |
| CSS `@property`                  | 2024-07  | ✅ supportato (token core animabili)                 |
| CSS `@scope`                     | 2025-12  | ⚠ deferred V1.x (Strategia D NON implementata in 1.1)|
| `MutationObserver`               | universal| ✅ supportato                                        |
| `matchMedia` + `addEventListener`| universal| ✅ supportato                                        |
| `WeakMap`/`WeakRef`              | universal| ✅ supportato                                        |

**No polyfill imposti** (vincolo PRD §31.3). `@layer`/`@property`/`prefers-color-scheme` sono baseline 2024+ in tutti i browser evergreen. Browser più vecchi degradano gracefully (cascade fallback a regole CSS standard, niente layering specifico).

## Inline `style` attribute browser law (UI-DOC-03)

> ⚠ **Browser law:** L'attributo `style` inline vince SEMPRE su qualunque adapter, inclusi `cssRules` generati da `@gluezero/theme`. Questa è una **regola del browser**, non una scelta di GlueZero.

Se vedi un nodo con `style="color: red"`, nessun adapter può sovrascriverlo (a meno di `!important`, che `@gluezero/theme` evita per principio — eccezione documentata SOLO per `prefers-reduced-motion` safety-net Q7).

```html
<!-- ❌ ANTI-PATTERN: inline style sovrascrive sempre l'adapter -->
<button data-gz-role="action.primary" style="background: red">Salva</button>

<!-- ✅ CORRETTO: lascia che l'adapter applichi le classi -->
<button data-gz-role="action.primary">Salva</button>
```

**Best practice:** NON injettare inline style da user input — è anche un vector XSS (T-F7-05). Se devi customizzare, usa `applyTokens()` per scrivere CSS Custom Properties; queste possono essere sovrascritte dall'adapter via `cssRules` perché `var(--gz-*)` viene risolto al match-time della rule.

## data-gz-role is NOT ARIA (UI-DOC-04)

> ⚠ **Accessibility:** `data-gz-role="action.primary"` è un'**etichetta semantica visuale** (UI standardization layer), NON un'alternativa ad ARIA `role` o `aria-*`.

```html
<!-- ✅ CORRETTO: data-gz-role + ARIA coexist -->
<button data-gz-role="action.primary" aria-label="Salva il documento">Salva</button>

<!-- ❌ ERRATO: NON sostituire role/aria con data-gz-role -->
<div data-gz-role="action.primary" onclick="...">Salva</div>
<!-- Manca <button>; manca aria-label; screen reader non interpreta. -->
```

`createRoleCoverageReport()` flagga **non-semantic warn** quando un ruolo `action.*` viene applicato a un `<div>` invece di `<button>`/`<a>`/`<input>` (UI-DEVTOOLS-02). Una **lint rule ESLint** `gluezero/data-gz-role-on-interactive` (verifica statica) è **deferred a V1.x**.

## Q&A

### Q1 — Posso usare `@gluezero/theme` senza framework?

Sì. È un layer browser-side puro: vanilla DOM, web components, qualunque framework UI. Non c'è dipendenza React/Vue/Svelte.

### Q2 — Devo installare Tailwind/Bootstrap come dependency?

No. Tailwind/Bootstrap sono **adapter consumer-side**, NON runtime dep di `@gluezero/theme`. Tu fornisci la `roleMap` con le classi del tuo DS (qualunque). L'adapter è una mappa pura, niente import side-effect.

### Q3 — Cosa succede se ho un CSP strict (`script-src 'self'`)?

`getInitialThemeScript()` ritorna SOLO il body IIFE (zero `eval`, zero user-input interpolation). Tu sei responsabile dell'inserimento del tag `<script nonce="...">` nel `<head>`: applica il nonce al tag, e il body IIFE statico (deterministico) supera CSP-strict. Una opzione `{ nonce }` per generare anche il wrapper `<script>` è **deferred a V1.x** (Q2 raccomandazione).

### Q4 — Multi-tab persistence: cosa succede se cambio mode in tab A?

Lo `StorageEvent` listener (composto internamente in `createThemePersistence`) riceve il cambio in tab B e applica `setMode` automaticamente — **4 chiavi separate** (`gluezero.theme.{mode,density,direction,adapter}`) per atomic update (Q3 raccomandazione lockata, evita race su singola chiave JSON).

### Q5 — Posso usare custom token oltre i ~35 standard?

Sì. `applyTokens({ 'my-custom-token': 'value' })` accetta qualunque chiave kebab-case — niente narrow types esaustivi (anti-feature ban list). Solo i 10 token branded core (`color-primary`, `spacing-md`, `radius-md`, …) hanno autocomplete IDE via `csstype` module augmentation. Cap 200 token totali + soft-warn 50% + `{ allowMore: true }` opt-in (D-F7-14).

### Q6 — SSR (Next.js, Nuxt, Remix) — funziona?

Sì, con cura. `getInitialThemeScript()` è progettato per essere injectato nel `<head>` SSR-side (output deterministico). La persistenza default OFF (D-F7-12) evita SSR mismatch automatico. Se attivi `'localStorage'`, attendi hydration prima di leggere lo state lato server (lo stato lo legge il browser, non Node).

### Q7 — `prefers-reduced-motion` come si gestisce?

`OsPreferenceWatcher` ascolta `(prefers-reduced-motion: reduce)` ed emette `ui.osPreference.changed` con `kind: 'reduced-motion'`. **Safety-net unico:** in `tokens-default.css` esiste un blocco `@media (prefers-reduced-motion: reduce) { :root { --gz-motion-*: 0ms !important } }`. Questo è l'**unico `!important`** ammesso nel layer (eccezione esplicita documentata, accessibility-first).

### Q8 — Bundle size?

`@gluezero/theme` ≤ **6 KB gzipped** (PKG-04 ext F7, size-limit gate CI in plan 07-13). `tokens-default.css` separato (~2 KB) NON conta nel JS budget. `@gluezero/devtools/theme-inspector` subpath ≤ **3 KB gzipped** addizionali (importato solo in dev/preview).

### Q9 — Dark mode "auto" come funziona internamente?

`createTheme()` di default fa `setMode('auto')` (D-F7-13): il `ThemeManager` legge `matchMedia('(prefers-color-scheme: dark)').matches` e setta `data-gz-theme` di conseguenza, poi sottoscrive il `change` event per propagare automaticamente. `setMode('light' | 'dark')` esplicito disattiva il listener (forced).

## Vincoli architetturali (D-F7-* lockate)

Le 22+ decisioni architetturali della Fase 7 sono lockate in `.planning/ROADMAP.md` e `.planning/research/SUMMARY.md`. Sintesi delle 14 più rilevanti per chi implementa adapter custom:

- **D-F7-01** Composition Opzione B (standalone broker injection, NO wrapper).
- **D-F7-02** Pipeline §28 NON estesa (eventi `ui.*` viaggiano su pipeline standard).
- **D-F7-03** Strategie A+B default + C escape hatch + D `@scope` deferred V1.x.
- **D-F7-04** Devtools subpath additivo `@gluezero/devtools/theme-inspector`.
- **D-F7-05** Multi-tema scope `:root` default + `opts.scope` opt-in HTMLElement.
- **D-F7-06** LIFE-02 ext F7 cascade unregister adapter su `system.plugin.unregistered`.
- **D-F7-07** Aggregate `createGlueZero({ theme? })` opt-in.
- **D-F7-08** `ThemeSnapshot` deep-frozen.
- **D-F7-09** `registerAdapter` collision throw + `{ override: true }` esplicito.
- **D-F7-10** Cascade `@layer gluezero-theme.adapter` lockata (specificity controllata).
- **D-F7-11** Format DTCG superset esposto + `Map<string,string>` interno.
- **D-F7-12** Persistenza default OFF (zero scrittura silente).
- **D-F7-13** Default `setMode('auto')` mirror OS.
- **D-F7-14** Cardinality cap 100 ruoli + 200 token + soft-warn 50% + `{ allowMore: true }`.

Per il riferimento completo: vedi [`../../.planning/ROADMAP.md`](../../.planning/ROADMAP.md) e [`../../.planning/research/SUMMARY.md`](../../.planning/research/SUMMARY.md).

## API reference

API reference TypeDoc generata in `dist/typedoc/` (build via `pnpm --filter @gluezero/theme docs`). Surface stabile lockata v1.1.0:

- `createTheme(opts?)` → `Theme` (entry point principale).
- `createThemeManager(opts?)` → `ThemeManager` (standalone, senza Strategia A/B).
- `createTokenRegistry(opts?)` → `TokenRegistry`.
- `createRoleRegistry()` → `RoleRegistry`.
- `createAdapterRegistry()` → `AdapterRegistry`.
- `createDomApplier(opts)` → `DomApplier`.
- `createStyleSheetGenerator(opts)` → `StyleSheetGenerator`.
- `classFor(adapter, role)` → `string`.
- `getInitialThemeScript(opts?)` → `string`.
- `STANDARD_ROLES`, `STANDARD_ROLE_DEFINITIONS` (constants).
- `UI_THEME_CHANGED`, `UI_DENSITY_CHANGED`, `UI_DIRECTION_CHANGED`, `UI_ADAPTER_CHANGED`, `UI_OS_PREFERENCE_CHANGED` (topic constants).

## License

MIT — Omar Di Marzio
