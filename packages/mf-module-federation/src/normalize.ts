/**
 * `normalizeModule` — Factory result normalize per Module Federation (carryover F9
 * `packages/mf-esm/src/normalize.ts` D-V2-F9-05).
 *
 * Module Federation Runtime 2.4.x `loadRemote(scope/module)` ritorna un oggetto opaco
 * che può essere:
 * - Factory function `() => Promise<Module>` (rare 2.4.x — moved to factory normalization).
 * - Module namespace `{default: lifecycle}` (most common — ESM module bundling).
 * - Module namespace `{bootstrap, mount, unmount}` (named exports flat).
 *
 * Replica letterale logic F9 normalize.ts adattata per MF factory shape — 4-step priority
 * lockata D-V2-F9-05:
 *
 * 1. `exportName` esplicito (≠ `'default'`) → lookup `module[exportName]`. THROW se invalid.
 * 2. `module.default` → estrai lifecycle se ha almeno `mount` function.
 * 3. Named exports flat top-level (`module.bootstrap`/`module.mount`/etc.).
 * 4. Nessuna strategia → throw `MF_REMOTE_FACTORY_FAILED` con rich diagnostic.
 *
 * **Hook type check strict (D-V2-F9-07):** `typeof === 'function'`. Chiavi esistenti ma
 * con valore non-function vengono escluse senza throw.
 *
 * **Mount obbligatorio (D-V2-F9-06):** Solo `mount` minimo richiesto per modulo valido.
 *
 * @see PRD §24 (Module Federation Loader experimental @0.x.0)
 * @see D-V2-F9-05 — priority lockata, D-V2-F9-06 — mount minimo, D-V2-F9-07 — typeof strict
 * @see F9 mf-esm `packages/mf-esm/src/normalize.ts` (source carryover)
 * @packageDocumentation
 */
import type { MicroFrontendRuntimeModule } from '@gluezero/microfrontends'
import { createMfModuleFederationError } from './errors'

/**
 * Opzioni per la normalizzazione del factory result Module Federation.
 *
 * `url` è obbligatorio per popolare i `details` diagnostic. `scope` + `module` opzionali
 * per error context multi-remote.
 */
export interface NormalizeOptions {
  /** URL del `remoteEntry.js` (per diagnostic). */
  readonly url: string
  /** Nome export esplicito da preferire (Strategy 1 D-V2-F9-05). */
  readonly exportName?: string
  /** Scope MF (es. `'customerApp'`) — diagnostic. */
  readonly scope?: string
  /** Module path (es. `'Dashboard'`) — diagnostic. */
  readonly module?: string
  /** MicroFrontend ID — diagnostic. */
  readonly microFrontendId?: string
}

/**
 * Hook keys lifecycle MF (PRD §13.2 — `MicroFrontendRuntimeModule` interface).
 * Solo `mount` obbligatorio (D-V2-F9-06).
 */
const HOOK_KEYS = ['bootstrap', 'mount', 'update', 'unmount', 'destroy'] as const

/**
 * Normalizza il factory result Module Federation a `MicroFrontendRuntimeModule`.
 *
 * @param factoryResult - Risultato di `mfRuntime.loadRemote(scope/module)`.
 * @param opts - Opzioni con `url` obbligatorio + `exportName?` + `scope?` + `module?`.
 * @returns `MicroFrontendRuntimeModule` con almeno `mount` function.
 *
 * @example Strategy 2 — default export (most common MF 2.4.x)
 * ```ts
 * // remote: export default { mount(ctx) {...}, unmount(ctx) {...} }
 * const factory = await mfRuntime.loadRemote('customerApp/Dashboard')
 * const lifecycle = normalizeModule(factory, {
 *   url: 'https://cdn/remoteEntry.js',
 *   scope: 'customerApp',
 *   module: 'Dashboard',
 * })
 * ```
 *
 * @example Strategy 3 — named exports flat
 * ```ts
 * // remote: export function mount(ctx) {...}; export function unmount(ctx) {...}
 * const factory = await mfRuntime.loadRemote('customerApp/Dashboard')
 * const lifecycle = normalizeModule(factory, {url: 'https://cdn/remoteEntry.js'})
 * ```
 *
 * @throws `MfModuleFederationError` con `code: 'MF_REMOTE_FACTORY_FAILED'` se nessuna
 *   strategia produce lifecycle valido (mount mancante o non-function). Details include
 *   `{url, scope?, module?, exportName?, hasDefault, defaultKeys, namedKeys, reason}`.
 *
 * @see D-V2-F9-05 — priority lockata
 * @see REQ MF-MF-02 — MF_REMOTE_FACTORY_FAILED literal code
 */
export function normalizeModule(
  factoryResult: unknown,
  opts: NormalizeOptions,
): MicroFrontendRuntimeModule {
  const { url, exportName, scope, module, microFrontendId } = opts

  // Reject primitive / null / undefined factory result.
  if (factoryResult === null || factoryResult === undefined || typeof factoryResult !== 'object') {
    throw createMfModuleFederationError({
      code: 'MF_REMOTE_FACTORY_FAILED',
      message: `Module Federation factory result invalido per "${scope ?? '?'}/${module ?? '?'}" — atteso object, ricevuto ${typeof factoryResult}`,
      ...(microFrontendId !== undefined && { microFrontendId }),
      ...(scope !== undefined && { scope }),
      ...(module !== undefined && { module }),
      details: { url, reason: 'factory result is not an object' },
    })
  }

  const mod = factoryResult as Record<string, unknown>

  // Strategy 1: explicit exportName (D-V2-F9-05 step 1). All-or-nothing — throw if invalid.
  if (exportName && exportName !== 'default') {
    const candidate = mod[exportName]
    const lifecycle = extractLifecycle(candidate)
    if (lifecycle) return lifecycle
    throw createMfModuleFederationError({
      code: 'MF_REMOTE_FACTORY_FAILED',
      message: `Export "${exportName}" in "${scope ?? '?'}/${module ?? '?'}" mancante o non valido (no mount function)`,
      ...(microFrontendId !== undefined && { microFrontendId }),
      ...(scope !== undefined && { scope }),
      ...(module !== undefined && { module }),
      details: buildInvalidDetails(
        mod,
        url,
        exportName,
        `exportName "${exportName}" not found or invalid`,
      ),
    })
  }

  // Strategy 2: default export (D-V2-F9-05 step 2).
  const defaultExp = mod['default']
  const fromDefault = extractLifecycle(defaultExp)
  if (fromDefault) return fromDefault

  // Strategy 3: named exports flat (D-V2-F9-05 step 3).
  const fromNamed = extractLifecycle(mod)
  if (fromNamed) return fromNamed

  // Strategy 4: throw (D-V2-F9-05 step 4).
  throw createMfModuleFederationError({
    code: 'MF_REMOTE_FACTORY_FAILED',
    message: `Nessun lifecycle valido in factory result per "${scope ?? '?'}/${module ?? '?'}" (richiesto almeno "mount" function, PRD §24)`,
    ...(microFrontendId !== undefined && { microFrontendId }),
    ...(scope !== undefined && { scope }),
    ...(module !== undefined && { module }),
    details: buildInvalidDetails(
      mod,
      url,
      exportName,
      'no valid lifecycle (need at least "mount" function)',
    ),
  })
}

/**
 * Estrae lifecycle hook da `candidate` con `typeof === 'function'` strict (D-V2-F9-07).
 *
 * @internal Helper privato.
 */
function extractLifecycle(candidate: unknown): MicroFrontendRuntimeModule | null {
  if (!candidate || typeof candidate !== 'object') return null
  const c = candidate as Record<string, unknown>
  const lifecycle: Partial<
    Record<(typeof HOOK_KEYS)[number], (...args: unknown[]) => unknown>
  > = {}
  for (const key of HOOK_KEYS) {
    const value = c[key]
    if (typeof value === 'function') {
      lifecycle[key] = value as (...args: unknown[]) => unknown
    }
  }
  if (typeof lifecycle.mount !== 'function') return null // D-V2-F9-06
  return lifecycle as MicroFrontendRuntimeModule
}

/**
 * Costruisce i details rich diagnostic per `MF_REMOTE_FACTORY_FAILED` (D-V2-F9-08).
 *
 * @internal Helper privato.
 */
function buildInvalidDetails(
  mod: Record<string, unknown>,
  url: string,
  exportName: string | undefined,
  reason: string,
): Record<string, unknown> {
  const defaultExp = mod['default']
  const defaultObj: Record<string, unknown> =
    defaultExp && typeof defaultExp === 'object' ? (defaultExp as Record<string, unknown>) : {}
  return {
    url,
    ...(exportName !== undefined && { exportName }),
    hasDefault: 'default' in mod && defaultExp !== undefined,
    defaultKeys: Object.keys(defaultObj),
    namedKeys: Object.keys(mod).filter((k) => k !== 'default'),
    reason,
  }
}
