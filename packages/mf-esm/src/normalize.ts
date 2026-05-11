/**
 * `normalizeModule` — Smart fallback priority 4-step lockato (D-V2-F9-05).
 *
 * Trasforma il modulo ESM importato in un `MicroFrontendRuntimeModule` valido
 * (interface F8 con 5 hook opzionali — `mount` minimo obbligatorio D-V2-F9-06).
 *
 * **Priority lockata (D-V2-F9-05) — researcher/planner NON deve invertire o aggiungere step:**
 * 1. `exportName` esplicito (≠ `'default'`) → lookup `module[exportName]`. Se ha
 *    `mount` function → ritorna lifecycle. Altrimenti THROW `MF_LOADER_INVALID_MODULE`
 *    (NO fall-through perché l'override esplicito è "all-or-nothing").
 * 2. `module.default` → se è oggetto con `mount` function → ritorna lifecycle estratto.
 * 3. Named exports flat su `module` top-level (`module.bootstrap`/`module.mount`/etc.) →
 *    se almeno `mount` function → ritorna lifecycle.
 * 4. Nessuna strategia valida → THROW `MF_LOADER_INVALID_MODULE` con rich diagnostic
 *    `details` shape (D-V2-F9-08): `{ url, exportName?, hasDefault, defaultKeys, namedKeys, reason }`.
 *
 * **Hook type check (D-V2-F9-07):** `typeof === 'function'` STRICT per ogni hook.
 * Una chiave esistente ma con valore non-function (null, oggetto, primitive, string)
 * viene ESCLUSA dalla normalizzazione senza throw. Robusto per consumer che usa
 * pattern `bootstrap = null` per disabilitare l'hook senza segnalare errore.
 *
 * **Mount obbligatorio (D-V2-F9-06):** Solo `mount` è hook minimo richiesto. Senza
 * `mount` un MF non può renderizzare; `bootstrap`/`update`/`unmount`/`destroy` sono
 * ottimizzazioni opzionali (cleanup subscribe già garantito via D-V2-16 cascade
 * `unsubscribeByOwner('mf:${id}')` anche senza `unmount` esplicito).
 *
 * @see PRD §23.5 (ESM loader export rules — "OR" interpretato come priority list)
 * @see D-V2-F9-05 (priority lockata), D-V2-F9-06 (mount minimo), D-V2-F9-07 (typeof strict)
 * @see D-V2-F9-08 (rich diagnostic details shape)
 */
import type { MicroFrontendRuntimeModule } from '@gluezero/microfrontends'
import { createMfEsmError } from './mf-esm-error'

/**
 * Opzioni per la normalizzazione del modulo ESM caricato.
 *
 * `url` è obbligatorio per popolare i `details` diagnostic del rich error
 * `MF_LOADER_INVALID_MODULE` (D-V2-F9-08). `exportName` opzionale per attivare
 * Strategy 1 (lookup esplicito).
 */
export interface NormalizeOptions {
  /** URL del modulo importato (per diagnostic). */
  readonly url: string
  /** Nome export named esplicito da preferire (D-V2-F9-05 Strategy 1). */
  readonly exportName?: string
}

/**
 * Chiavi degli hook del lifecycle MF (PRD §13.2 — `MicroFrontendRuntimeModule` interface).
 * Solo `mount` è obbligatorio per modulo valido (D-V2-F9-06).
 */
const HOOK_KEYS = ['bootstrap', 'mount', 'update', 'unmount', 'destroy'] as const

/**
 * Normalizza il modulo importato a `MicroFrontendRuntimeModule` (lifecycle).
 *
 * Smart fallback priority 4-step lockato D-V2-F9-05 (vedi @packageDocumentation
 * blocco di questo file per dettaglio completo).
 *
 * @param module - Namespace ESM importato (output di `await import(url)`).
 * @param opts - Opzioni con `url` (obbligatorio per diagnostic) + `exportName?` opzionale.
 * @returns `MicroFrontendRuntimeModule` con almeno `mount` function (altri hook opzionali).
 *
 * @example Strategy 1 — exportName esplicito
 * ```ts
 * // mf.js: export const app = { mount(ctx) {...}, unmount(ctx) {...} }
 * const mod = await import('https://cdn.example/mf.js')
 * const lifecycle = normalizeModule(mod, {
 *   url: 'https://cdn.example/mf.js',
 *   exportName: 'app',
 * })
 * // lifecycle.mount + lifecycle.unmount disponibili
 * ```
 *
 * @example Strategy 2 — default export
 * ```ts
 * // mf.js: export default { bootstrap(ctx) {...}, mount(ctx) {...}, destroy(ctx) {...} }
 * const mod = await import('https://cdn.example/mf.js')
 * const lifecycle = normalizeModule(mod, { url: 'https://cdn.example/mf.js' })
 * // lifecycle.bootstrap + lifecycle.mount + lifecycle.destroy disponibili
 * ```
 *
 * @example Strategy 3 — named exports flat
 * ```ts
 * // mf.js: export function mount(ctx) {...}; export function unmount(ctx) {...}
 * const mod = await import('https://cdn.example/mf.js')
 * const lifecycle = normalizeModule(mod, { url: 'https://cdn.example/mf.js' })
 * // lifecycle.mount + lifecycle.unmount disponibili
 * ```
 *
 * @throws `BrokerError` con `code: 'MF_LOADER_INVALID_MODULE'` se nessuna strategia
 *   produce un lifecycle valido (mount mancante o non-function). Details include
 *   `{ url, exportName?, hasDefault, defaultKeys, namedKeys, reason }` per debug DX.
 *
 * @see PRD §23.5 (ESM loader export rules)
 * @see D-V2-F9-05 (priority lockata), D-V2-F9-06 (mount obbligatorio),
 *   D-V2-F9-07 (typeof strict), D-V2-F9-08 (rich diagnostic shape)
 */
export function normalizeModule(
  module: Record<string, unknown>,
  opts: NormalizeOptions,
): MicroFrontendRuntimeModule {
  const { url, exportName } = opts

  // Strategy 1: explicit exportName (non-default) — D-V2-F9-05 step 1.
  // L'override esplicito è "all-or-nothing": se exportName è settato ma non valido,
  // FAIL FAST senza fall-through a default/named — il consumer ha richiesto
  // esplicitamente quel symbol, ignorarlo silenziosamente sarebbe confondente.
  if (exportName && exportName !== 'default') {
    const candidate = module[exportName]
    const lifecycle = extractLifecycle(candidate)
    if (lifecycle) return lifecycle
    throw createMfEsmError({
      code: 'MF_LOADER_INVALID_MODULE',
      message: `Export "${exportName}" in "${url}" è mancante o non valido (no mount function)`,
      details: buildInvalidDetails(
        module,
        url,
        exportName,
        `exportName "${exportName}" not found or invalid`,
      ),
    })
  }

  // Strategy 2: default export — D-V2-F9-05 step 2.
  // Coperto sia da `exportName === 'default'` esplicito sia da `exportName` omesso.
  const defaultExp = module['default']
  const fromDefault = extractLifecycle(defaultExp)
  if (fromDefault) return fromDefault

  // Strategy 3: named exports flat — D-V2-F9-05 step 3.
  // Top-level `module.bootstrap`/`module.mount`/etc. come fallback semantico DX.
  const fromNamed = extractLifecycle(module)
  if (fromNamed) return fromNamed

  // Strategy 4: throw — D-V2-F9-05 step 4.
  throw createMfEsmError({
    code: 'MF_LOADER_INVALID_MODULE',
    message: `Nessun lifecycle valido in "${url}" (richiesto almeno "mount" function, PRD §23.5)`,
    details: buildInvalidDetails(
      module,
      url,
      exportName,
      'no valid lifecycle (need at least "mount" function)',
    ),
  })
}

/**
 * Estrae lifecycle hook da `candidate` con `typeof === 'function'` strict (D-V2-F9-07).
 *
 * Hook chiave esistente ma non-function (null, oggetto, primitive, string) → escluso
 * dalla normalizzazione SENZA throw (robusto per pattern `bootstrap = null` consumer).
 * Ritorna `null` se `candidate` non è object o se `mount` non risulta function finale
 * (D-V2-F9-06 mount obbligatorio).
 *
 * @internal Helper privato — NON esportato dal barrel.
 */
function extractLifecycle(candidate: unknown): MicroFrontendRuntimeModule | null {
  if (!candidate || typeof candidate !== 'object') return null
  const c = candidate as Record<string, unknown>
  const lifecycle: Partial<Record<(typeof HOOK_KEYS)[number], (...args: unknown[]) => unknown>> = {}
  for (const key of HOOK_KEYS) {
    const value = c[key]
    if (typeof value === 'function') {
      // D-V2-F9-07 typeof strict — solo function viene inclusa
      lifecycle[key] = value as (...args: unknown[]) => unknown
    }
  }
  if (typeof lifecycle.mount !== 'function') return null // D-V2-F9-06 mount obbligatorio
  return lifecycle as MicroFrontendRuntimeModule
}

/**
 * Costruisce i details rich diagnostic per `MF_LOADER_INVALID_MODULE` (D-V2-F9-08).
 *
 * Shape:
 * - `url`: URL del modulo importato (sempre presente)
 * - `exportName?`: incluso solo se settato (exactOptionalPropertyTypes-friendly)
 * - `hasDefault`: boolean — `'default'` key presente e non-undefined su `module`
 * - `defaultKeys`: array delle key top-level di `module.default` (se è object), else `[]`
 * - `namedKeys`: array delle key di `module` filtrate `!== 'default'`
 * - `reason`: human-readable per debug DX
 *
 * Bundle cost ~80 B accettabile (D-V2-F9-08).
 *
 * @internal Helper privato — NON esportato dal barrel.
 */
function buildInvalidDetails(
  module: Record<string, unknown>,
  url: string,
  exportName: string | undefined,
  reason: string,
): Record<string, unknown> {
  const defaultExp = module['default']
  const defaultObj: Record<string, unknown> =
    defaultExp && typeof defaultExp === 'object' ? (defaultExp as Record<string, unknown>) : {}
  return {
    url,
    ...(exportName !== undefined && { exportName }),
    hasDefault: 'default' in module && defaultExp !== undefined,
    defaultKeys: Object.keys(defaultObj),
    namedKeys: Object.keys(module).filter((k) => k !== 'default'),
    reason,
  }
}
