/**
 * Persistenza opt-in (THEME-08, D-F7-12 default OFF).
 *
 * Pattern: 4 chiavi separate (Q3 raccomandazione lockata).
 * - `gluezero.theme.mode`      → 'auto' | 'light' | 'dark'
 * - `gluezero.theme.density`   → 'compact' | 'comfortable' | 'spacious'
 * - `gluezero.theme.direction` → 'ltr' | 'rtl'
 * - `gluezero.theme.adapter`   → string (adapter id, validated upstream)
 *
 * Vantaggi vs JSON unificato:
 * - `StorageEvent.key` permette listener selettivo per chiave
 * - Atomic single-key update (no read-modify-write race)
 * - No `JSON.parse` cost on every event
 * - Debugging localStorage via DevTools è più leggibile
 *
 * **Default OFF (D-F7-12):** `enabled: false` → tutti i metodi sono no-op senza
 * toccare localStorage né registrare listener `storage`. Questo previene SSR
 * mismatch + multi-tab thrashing automaticamente.
 *
 * **Threat mitigations (T-F7-02 / T-F7-03 / T-F7-04 / T-F7-05):**
 * - Try/catch wrap su tutti gli accessi `getItem`/`setItem`/`removeItem` per
 *   silenziare `SecurityError` (CSP / privacy mode) e `QuotaExceededError`.
 * - Whitelist enum su read/write/storage-event: valori non riconosciuti
 *   ignorati silently (no throw, no contamination).
 * - Adapter id validation (`/^[a-zA-Z0-9_-]+$/`, max 64) defense-in-depth XSS.
 *
 * **Lifecycle:** `destroy()` rimuove `storage` event listener (no leak
 * multi-tab). Idempotent. Subscribe post-destroy ritorna no-op unsubscribe.
 *
 * Refs: 07-CONTEXT.md D-F7-12, 07-RESEARCH.md Q3, 07-04-PLAN.md Task 1,
 *       PRD §16 (persistenza opt-in), THEME-08.
 */

/** Prefix namespace usato per il filter `StorageEvent.key`. */
const KEY_PREFIX = 'gluezero.theme.' as const

/** Mappa logical key → localStorage key (4-keys raccomandazione Q3). */
const KEYS = {
  mode: 'gluezero.theme.mode',
  density: 'gluezero.theme.density',
  direction: 'gluezero.theme.direction',
  adapter: 'gluezero.theme.adapter',
} as const

/** Whitelist mode (mirror `theme-manager.ts` VALID_MODES). */
const VALID_MODES: ReadonlySet<string> = new Set(['auto', 'light', 'dark'])

/** Whitelist density (mirror `theme-manager.ts` VALID_DENSITIES). */
const VALID_DENSITIES: ReadonlySet<string> = new Set([
  'compact',
  'comfortable',
  'spacious',
])

/** Whitelist direction (mirror `theme-manager.ts` VALID_DIRECTIONS). */
const VALID_DIRECTIONS: ReadonlySet<string> = new Set(['ltr', 'rtl'])

/** Adapter id format (defense-in-depth XSS, T-F7-05 mitigation). */
const ADAPTER_ID_REGEX = /^[a-zA-Z0-9_-]+$/
const ADAPTER_ID_MAX_LEN = 64

/** State letto/scritto dalla persistenza. Tutti i campi sono optional. */
export interface PersistenceState {
  mode?: 'auto' | 'light' | 'dark'
  density?: 'compact' | 'comfortable' | 'spacious'
  direction?: 'ltr' | 'rtl'
  adapter?: string
}

/** Surface API esposta da `createThemePersistence()`. */
export interface ThemePersistence {
  /** `true` se persistenza attiva (D-F7-12 default OFF significa false). */
  readonly enabled: boolean
  /**
   * Legge i 4 valori da localStorage. Ritorna `null` se persistenza off,
   * SSR (no `window`/`localStorage`), o nessuna chiave valida presente.
   */
  read(): PersistenceState | null
  /**
   * Scrive i campi forniti su localStorage (chiavi separate per atomic update).
   * No-op se persistenza off o SSR.
   */
  write(state: Partial<PersistenceState>): void
  /**
   * Registra listener per `StorageEvent` multi-tab filtrato per namespace
   * `gluezero.theme.*` + value enum whitelist (T-F7-04 Spoofing mitigation).
   * Ritorna unsubscribe function. No-op se persistenza off, SSR, o post-destroy.
   */
  subscribe(listener: (state: PersistenceState) => void): () => void
  /**
   * Cleanup: rimuove `storage` event listener (no leak). Idempotent.
   * Post-destroy `subscribe` ritorna no-op unsubscribe.
   */
  destroy(): void
}

/** Opzioni factory `createThemePersistence`. */
export interface CreateThemePersistenceOptions {
  /**
   * Persistenza attiva. **Default OFF (D-F7-12)** — il caller deve passare
   * esplicitamente `true` per abilitare lettura/scrittura localStorage +
   * subscribe `storage`.
   */
  enabled: boolean
}

/**
 * Validate mode value (whitelist enum).
 * @returns Mode normalizzato se whitelist, undefined altrimenti.
 */
function validateMode(v: string | null): 'auto' | 'light' | 'dark' | undefined {
  return v != null && VALID_MODES.has(v)
    ? (v as 'auto' | 'light' | 'dark')
    : undefined
}

/**
 * Validate density value (whitelist enum).
 * @returns Density normalizzata se whitelist, undefined altrimenti.
 */
function validateDensity(
  v: string | null,
): 'compact' | 'comfortable' | 'spacious' | undefined {
  return v != null && VALID_DENSITIES.has(v)
    ? (v as 'compact' | 'comfortable' | 'spacious')
    : undefined
}

/**
 * Validate direction value (whitelist enum).
 * @returns Direction normalizzata se whitelist, undefined altrimenti.
 */
function validateDirection(v: string | null): 'ltr' | 'rtl' | undefined {
  return v != null && VALID_DIRECTIONS.has(v)
    ? (v as 'ltr' | 'rtl')
    : undefined
}

/**
 * Validate adapter id (defense-in-depth XSS, T-F7-05 mitigation).
 *
 * Constraints: max 64 chars, regex `^[a-zA-Z0-9_-]+$` (mirror NamingPolicy
 * di altri identifier GlueZero; il valore ATTUALMENTE valido per adapter id
 * sarà controllato da `AdapterRegistry` in W3 plan 07-06).
 *
 * @returns Adapter id se valido, undefined altrimenti.
 */
function validateAdapter(v: string | null): string | undefined {
  if (v == null) return undefined
  if (v.length === 0 || v.length > ADAPTER_ID_MAX_LEN) return undefined
  if (!ADAPTER_ID_REGEX.test(v)) return undefined
  return v
}

/**
 * Crea una nuova {@link ThemePersistence} (closure factory, D-30 anti-singleton).
 *
 * **Default OFF (D-F7-12):** `enabled: false` ritorna stub no-op che NON tocca
 * localStorage né registra listener. Il caller deve passare esplicitamente
 * `enabled: true` per abilitare persistenza.
 *
 * **SSR safe:** se `window`/`localStorage` non disponibili (SSR / Node),
 * tutti i metodi degradano a no-op silently.
 *
 * @param opts - Opzioni: `enabled` (boolean, required).
 * @returns Nuova istanza {@link ThemePersistence}.
 *
 * @example
 * ```ts
 * // Default OFF: nessun side-effect.
 * const off = createThemePersistence({ enabled: false })
 * off.read()   // null
 * off.write({ mode: 'dark' }) // no-op
 *
 * // Enabled: legge/scrive 4 chiavi separate.
 * const on = createThemePersistence({ enabled: true })
 * on.write({ mode: 'dark' })
 * // localStorage['gluezero.theme.mode'] === 'dark'
 *
 * const unsub = on.subscribe((partial) => {
 *   console.log('multi-tab change:', partial)
 * })
 * // … later
 * unsub()
 * on.destroy()
 * ```
 *
 * @see THEME-08
 */
export function createThemePersistence(
  opts: CreateThemePersistenceOptions,
): ThemePersistence {
  const enabled = opts.enabled === true
  const hasStorage =
    typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
  const listeners = new Set<(state: PersistenceState) => void>()
  let storageHandler: ((e: StorageEvent) => void) | null = null
  let destroyed = false

  function safeGet(key: string): string | null {
    if (!enabled || !hasStorage || destroyed) return null
    try {
      return window.localStorage.getItem(key)
    } catch {
      // SecurityError CSP / privacy mode → silent (T-F7-02 mitigation).
      return null
    }
  }

  function safeSet(key: string, value: string | null): void {
    if (!enabled || !hasStorage || destroyed) return
    try {
      if (value === null) {
        window.localStorage.removeItem(key)
      } else {
        window.localStorage.setItem(key, value)
      }
    } catch (err) {
      // QuotaExceededError / SecurityError → log warn, no throw
      // (T-F7-03 DoS mitigation).
      console.warn(
        `[gluezero/theme] localStorage write denied for "${key}":`,
        err,
      )
    }
  }

  function read(): PersistenceState | null {
    if (!enabled || !hasStorage) return null
    const state: PersistenceState = {}
    const m = validateMode(safeGet(KEYS.mode))
    if (m) state.mode = m
    const d = validateDensity(safeGet(KEYS.density))
    if (d) state.density = d
    const dir = validateDirection(safeGet(KEYS.direction))
    if (dir) state.direction = dir
    const a = validateAdapter(safeGet(KEYS.adapter))
    if (a) state.adapter = a
    if (Object.keys(state).length === 0) return null
    return state
  }

  function write(state: Partial<PersistenceState>): void {
    if (!enabled || !hasStorage) return
    if (state.mode !== undefined) safeSet(KEYS.mode, state.mode)
    if (state.density !== undefined) safeSet(KEYS.density, state.density)
    if (state.direction !== undefined) safeSet(KEYS.direction, state.direction)
    if (state.adapter !== undefined) safeSet(KEYS.adapter, state.adapter)
  }

  function subscribe(
    listener: (state: PersistenceState) => void,
  ): () => void {
    if (!enabled || !hasStorage || destroyed) {
      return (): void => {
        /* no-op */
      }
    }
    listeners.add(listener)
    // Lazy-create storage handler on first subscribe (no listener
    // registrato se nessuno ha mai sottoscritto).
    if (!storageHandler) {
      storageHandler = (e: StorageEvent): void => {
        // Whitelist namespace (T-F7-04 Spoofing mitigation).
        if (e.key == null || !e.key.startsWith(KEY_PREFIX)) return
        const partial: PersistenceState = {}
        switch (e.key) {
          case KEYS.mode: {
            const v = validateMode(e.newValue)
            if (v) partial.mode = v
            break
          }
          case KEYS.density: {
            const v = validateDensity(e.newValue)
            if (v) partial.density = v
            break
          }
          case KEYS.direction: {
            const v = validateDirection(e.newValue)
            if (v) partial.direction = v
            break
          }
          case KEYS.adapter: {
            const v = validateAdapter(e.newValue)
            if (v) partial.adapter = v
            break
          }
          default:
            // Key fuori whitelist set (es. `gluezero.theme.foo` non gestito).
            return
        }
        if (Object.keys(partial).length === 0) return // value rejected
        for (const l of listeners) l(partial)
      }
      window.addEventListener('storage', storageHandler)
    }
    return (): void => {
      listeners.delete(listener)
    }
  }

  function destroy(): void {
    if (destroyed) return
    destroyed = true
    if (storageHandler && typeof window !== 'undefined') {
      window.removeEventListener('storage', storageHandler)
      storageHandler = null
    }
    listeners.clear()
  }

  return {
    enabled,
    read,
    write,
    subscribe,
    destroy,
  }
}
