/**
 * `snapshotTokens` + `diffSnapshots` (W5a plan 07-09, UI-DEVTOOLS-04 + UI-DEVTOOLS-05).
 *
 * - `snapshotTokens(scope?)`: legge i CSS Custom Properties con prefix `--gz-*`
 *   da inline style + `getComputedStyle(scope)` e ritorna un record flat
 *   `Record<token-name-without-prefix, value>`.
 * - `diffSnapshots(a, b)`: re-export pure della utility da `@gluezero/theme`
 *   (W2 plan 07-02 utility) per garantire UI-DEVTOOLS-04 esposto nel subpath.
 *
 * **D-F7-04 D-83 strict:** vive in NUOVA sub-folder
 * `packages/devtools/src/theme-inspector/`. Zero modifiche a
 * `packages/devtools/src/index.ts` o ai file top-level esistenti.
 *
 * **NOTA jsdom (Tier-1) limitation:** `getComputedStyle(html, pseudo)` ritorna
 * `''` per CSS Custom Properties (Vitest issue #1689). Il fallback iterativo
 * legge da `target.style.length` + `target.style.item(i)` (inline) — funziona
 * in jsdom anche su `--gz-*` set via `setProperty`. Tier-3 Playwright Chromium
 * (W6 plan 07-13) verifica il path completo via `getComputedStyle`.
 *
 * Refs:
 * - 07-CONTEXT.md UI-DEVTOOLS-04 (snapshot+diff exposed in subpath)
 * - 07-09-PLAN.md Task 2
 * - packages/theme/src/snapshot.ts (diffSnapshots — W2 plan 07-02)
 */

// Re-export `diffSnapshots` da `@gluezero/theme` (W2 plan 07-02 utility) — UI-DEVTOOLS-04.
// Pattern `export ... from` preserva la signature originale (compat isolatedDeclarations).
export { diffSnapshots } from '@gluezero/theme'

/**
 * Read tokens correnti: itera `--gz-*` properties da inline style + computed.
 *
 * Strategia ibrida (jsdom-friendly):
 * 1. Itera `target.style` (inline `--gz-*` set via `setProperty`).
 * 2. Per ogni nome con prefix `--gz-`, prova `target.style.getPropertyValue(name)`
 *    (inline) come prima fonte; se vuoto, fallback a `getComputedStyle(target).getPropertyValue(name)`.
 *
 * In Tier-3 Chromium reale anche tokens applicati via cascade `:root` (es.
 * `tokens-default.css` import) sono leggibili tramite `getComputedStyle` con
 * `getPropertyValue('--gz-*')` enumerando i nomi noti — questa V1 si limita
 * agli inline-set per uniformità jsdom + DX immediato.
 *
 * @param scope - HTMLElement target (default `document.documentElement`).
 * @returns Record `key → value` dove `key` è il nome senza prefix `--gz-`.
 *
 * @example
 * ```ts
 * import { snapshotTokens } from '@gluezero/devtools/theme-inspector'
 *
 * document.documentElement.style.setProperty('--gz-color-primary', '#FF6B35')
 * const snap = snapshotTokens()
 * console.log(snap['color-primary']) // '#FF6B35'
 * ```
 *
 * @see UI-DEVTOOLS-04
 */
export function snapshotTokens(scope?: HTMLElement): Record<string, string> {
  const target =
    scope ?? (typeof document !== 'undefined' ? document.documentElement : null)
  if (target == null) return {}
  const result: Record<string, string> = {}
  // jsdom-friendly: enumera inline style.length + filtra prefix `--gz-`
  for (let i = 0; i < target.style.length; i++) {
    const name = target.style.item(i)
    if (!name.startsWith('--gz-')) continue
    const inline = target.style.getPropertyValue(name)
    let value = inline
    if (value === '' && typeof window !== 'undefined') {
      try {
        value = window.getComputedStyle(target).getPropertyValue(name)
      } catch {
        /* jsdom-safe fallback: ignora errori getComputedStyle */
      }
    }
    const trimmed = value.trim()
    if (trimmed === '') continue
    // strip prefix `--gz-` (5 chars) — name is non-empty by construction
    const key = name.slice(5)
    result[key] = trimmed
  }
  return result
}

/**
 * `diffSnapshots(a, b)` è re-exportato sopra (statement `export { diffSnapshots }
 * from '@gluezero/theme'` riga 25). Custom ~30 LoC, NO `jsondiffpatch`/`deep-diff`
 * deps. Tre categorie: `added` / `removed` / `changed` — readonly + frozen.
 *
 * @example
 * ```ts
 * import { diffSnapshots } from '@gluezero/devtools/theme-inspector'
 *
 * const d = diffSnapshots({ x: '1' }, { x: '2', y: '3' })
 * console.log(d.added)   // { y: '3' }
 * console.log(d.changed) // { x: { from: '1', to: '2' } }
 * console.log(d.removed) // {}
 * ```
 *
 * @see UI-DEVTOOLS-04
 * @see packages/theme/src/snapshot.ts (source utility)
 */
