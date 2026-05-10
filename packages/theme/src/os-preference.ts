/**
 * OS preference watcher tramite `matchMedia` API (D-F7-13).
 *
 * Mitiga **Pitfall HIGH #6** (OS preferences ignorate). Espone helper imperativo
 * `getColorScheme/getReducedMotion/getContrast` per boot-time read + flow
 * subscribe/unsubscribe per le tre media query rilevanti:
 * - `prefers-color-scheme: dark` → `'dark' | 'light'`
 * - `prefers-reduced-motion: reduce` → `'reduce' | 'no-preference'` (boolean expose)
 * - `prefers-contrast: more` / `less` → `'more' | 'less' | 'no-preference'`
 *
 * **Lifecycle / cleanup (T-F7-04 mitigation):**
 * - Lazy: il `MediaQueryList` viene creato + listener registrato solo al primo
 *   `subscribe(kind, ...)` per quel `kind`.
 * - `destroy()` chiama `removeEventListener` su ogni MQL tracciato in `entries[]`
 *   (idempotent — safe to call multiple times).
 * - Subscribe post-destroy ritorna no-op unsubscribe (no leak).
 *
 * **SSR / test env senza matchMedia:** boot-time read ritorna fallback safe
 * (`'light'`, `false`, `'no-preference'`); `subscribe` ritorna no-op.
 *
 * **Anti-singleton (D-30):** ogni call a `createOsPreferenceWatcher()` ritorna
 * un'istanza indipendente con stato isolato.
 *
 * Refs:
 * - 07-CONTEXT.md D-F7-13 (default setMode auto mirror OS)
 * - 07-RESEARCH.md "Standard Stack" (matchMedia universale)
 * - 07-RESEARCH.md Pitfall HIGH #6 mitigation
 * - 07-03-PLAN.md Task 1
 */

/** Kind di OS preference tracciate. */
export type OsPreferenceKind = 'color-scheme' | 'reduced-motion' | 'contrast'

/** Color scheme risolto da `prefers-color-scheme`. */
export type ColorScheme = 'light' | 'dark'

/** Surface API esposta da `createOsPreferenceWatcher()`. */
export interface OsPreferenceWatcher {
  /** Boot-time read `prefers-color-scheme` → `'light' | 'dark'`. */
  getColorScheme(): ColorScheme
  /** Boot-time read `prefers-reduced-motion: reduce` → boolean. */
  getReducedMotion(): boolean
  /** Boot-time read `prefers-contrast` → `'more' | 'less' | 'no-preference'`. */
  getContrast(): 'more' | 'less' | 'no-preference'
  /**
   * Subscribe a una OS preference; il listener riceve il valore risolto
   * (`'dark'`/`'light'`, `'reduce'`/`'no-preference'`, ecc.) ad ogni change.
   *
   * @returns Unsubscribe function (idempotent).
   */
  subscribe(
    kind: OsPreferenceKind,
    listener: (value: string) => void,
  ): () => void
  /** Cleanup matchMedia listeners (idempotent — T-F7-04 mitigation). */
  destroy(): void
}

interface MqlEntry {
  mql: MediaQueryList
  handler: (e: MediaQueryListEvent) => void
  kind: OsPreferenceKind
}

/**
 * Crea un nuovo {@link OsPreferenceWatcher} (D-30 anti-singleton).
 *
 * @returns Istanza indipendente con stato isolato.
 *
 * @example
 * ```ts
 * const w = createOsPreferenceWatcher()
 * console.log(w.getColorScheme())           // 'light' o 'dark'
 * const unsub = w.subscribe('color-scheme', (v) => console.log('OS →', v))
 * // … later
 * unsub()
 * w.destroy()
 * ```
 *
 * @see OsPreferenceWatcher
 */
export function createOsPreferenceWatcher(): OsPreferenceWatcher {
  // Guard SSR / test env without matchMedia
  const hasMatchMedia =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function'

  const entries: MqlEntry[] = []
  const listeners = new Map<OsPreferenceKind, Set<(value: string) => void>>()
  let destroyed = false

  function getColorScheme(): ColorScheme {
    if (!hasMatchMedia) return 'light'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  }

  function getReducedMotion(): boolean {
    if (!hasMatchMedia) return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  function getContrast(): 'more' | 'less' | 'no-preference' {
    if (!hasMatchMedia) return 'no-preference'
    if (window.matchMedia('(prefers-contrast: more)').matches) return 'more'
    if (window.matchMedia('(prefers-contrast: less)').matches) return 'less'
    return 'no-preference'
  }

  function queryFor(kind: OsPreferenceKind): string {
    switch (kind) {
      case 'color-scheme':
        return '(prefers-color-scheme: dark)'
      case 'reduced-motion':
        return '(prefers-reduced-motion: reduce)'
      case 'contrast':
        return '(prefers-contrast: more)'
    }
  }

  function valueFor(kind: OsPreferenceKind, mql: MediaQueryList): string {
    switch (kind) {
      case 'color-scheme':
        return mql.matches ? 'dark' : 'light'
      case 'reduced-motion':
        return mql.matches ? 'reduce' : 'no-preference'
      case 'contrast':
        return mql.matches ? 'more' : 'no-preference'
    }
  }

  function subscribe(
    kind: OsPreferenceKind,
    listener: (value: string) => void,
  ): () => void {
    if (destroyed) return () => {}
    if (!hasMatchMedia) return () => {}
    let set = listeners.get(kind)
    if (!set) {
      set = new Set()
      listeners.set(kind, set)
      // Lazy-create the MQL + handler when first listener subscribes
      const mql = window.matchMedia(queryFor(kind))
      const handler = (_e: MediaQueryListEvent): void => {
        const v = valueFor(kind, mql)
        const set2 = listeners.get(kind)
        if (set2) {
          for (const l of set2) l(v)
        }
      }
      mql.addEventListener('change', handler)
      entries.push({ mql, handler, kind })
    }
    set.add(listener)
    return () => {
      const cur = listeners.get(kind)
      if (cur) cur.delete(listener)
    }
  }

  function destroy(): void {
    if (destroyed) return
    destroyed = true
    for (const { mql, handler } of entries) {
      mql.removeEventListener('change', handler)
    }
    entries.length = 0
    listeners.clear()
  }

  return { getColorScheme, getReducedMotion, getContrast, subscribe, destroy }
}
