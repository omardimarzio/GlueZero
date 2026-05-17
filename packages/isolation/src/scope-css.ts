/**
 * `scope-css.ts` — D-V2-F13-06 minimal regex selettore prefix helper opt-in.
 *
 * Cover REQ-IDs: MF-ISO-02 parziale (scopeCss helper opt-in per CSS isolation
 * `css='scoped'` mode).
 *
 * ## Pattern Vue/styled-components scoped CSS
 *
 * Prefissa ogni selettore top-level con `[data-gz-mf="<id>"]` (attribute settato
 * da `applyCssIsolation` su mount.element). Helper opt-in: MF chiama
 * esplicitamente, runtime NON inietta CSS automaticamente.
 *
 * Bundle target: ~300 B gzipped (Claude's Discretion CONTEXT.md — minimal regex
 * sufficiente per casi comuni Vue/styled-components, NON PostCSS-style full parser).
 *
 * ## Supporta
 *
 *  - Selettori top-level normali: `.foo` → `[data-gz-mf="<id>"] .foo`
 *  - Comma-separated lists: `.foo, .bar` → `[data-gz-mf="<id>"] .foo, [data-gz-mf="<id>"] .bar`
 *  - At-rule preservation con scoping ricorsivo del body:
 *    - `@media`, `@supports`: body parsed ricorsivamente (selettori interni scopati).
 *    - `@keyframes`, `@font-face`, `@import`, `@charset`: preservati as-is (NO scope).
 *
 * ## NON supporta (overkill F13, doc README)
 *
 *  - Nested selectors PostCSS-style (`.a { .b { ... } }`) → `.b` NON viene re-scopato.
 *  - Selettori pseudo-elemento root-targeting (`:root`, `:host`, `html`, `body`) →
 *    semplicemente prefissati anche se semanticamente non corretto.
 *  - Escape sequences CSS complesse (`\{`, `\}`) all'interno di strings → bounded
 *    by string size; nessun backtracking O(n²).
 *
 * @see prd_2.0.0.md §21.5 — CSS isolation scoped mode
 * @see D-V2-F13-06 — minimal regex Claude's Discretion
 */

/**
 * Prefissa selettori CSS con `[data-gz-mf="<mfId>"]` per scoping.
 *
 * Implementazione: parser char-by-char con depth-tracking delle `{}` brace per
 * gestire at-rule + body block correttamente. Linear scan O(n) char count
 * (no regex backtracking).
 *
 * @param rawCss - CSS string raw. Bounded by MF size (tipico ≤ 100 KB).
 * @param mfId - Identificatore del MicroFrontend (valore dello scope attribute).
 * @returns CSS string con selettori top-level prefissati + at-rule preserved.
 *
 * @example Selettore top-level
 * ```ts
 * scopeCss('.btn { color: red; }', 'mf-1')
 * // → '[data-gz-mf="mf-1"] .btn { color: red; }'
 * ```
 *
 * @example Comma-separated list
 * ```ts
 * scopeCss('.a, .b { color: red; }', 'mf-1')
 * // → '[data-gz-mf="mf-1"] .a, [data-gz-mf="mf-1"] .b { color: red; }'
 * ```
 *
 * @example @media preservato + body scopato ricorsivamente
 * ```ts
 * scopeCss('@media (max-width: 600px) { .a { color: red; } }', 'mf-1')
 * // → '@media (max-width: 600px) { [data-gz-mf="mf-1"] .a { color: red; } }'
 * ```
 *
 * @example @keyframes preservato as-is (NO scope)
 * ```ts
 * scopeCss('@keyframes spin { 0% { transform: rotate(0); } }', 'mf-1')
 * // → '@keyframes spin { 0% { transform: rotate(0); } }'
 * ```
 *
 * @see D-V2-F13-06 — minimal regex (Claude's Discretion CONTEXT.md)
 */
export function scopeCss(rawCss: string, mfId: string): string {
  const scope = `[data-gz-mf="${mfId}"]`
  const result: string[] = []
  const len = rawCss.length
  let i = 0

  while (i < len) {
    // Skip whitespace top-level.
    while (i < len && /\s/.test(rawCss[i] as string)) i++
    if (i >= len) break

    // At-rule detection: `@media`, `@keyframes`, `@supports`, `@font-face`, `@import`, ...
    if (rawCss[i] === '@') {
      // Trova fine header at-rule (fino a `{` o `;`).
      let j = i
      while (j < len && rawCss[j] !== '{' && rawCss[j] !== ';') j++

      // At-rule sintetica con terminatore `;` (es. `@import url(...);`, `@charset "utf-8";`).
      if (j < len && rawCss[j] === ';') {
        result.push(rawCss.slice(i, j + 1))
        i = j + 1
        continue
      }

      // At-rule con body: trova chiusura `{...}` matching brace (depth tracking).
      const header = rawCss.slice(i, j).trim()
      let depth = 1
      let k = j + 1
      while (k < len && depth > 0) {
        if (rawCss[k] === '{') depth++
        else if (rawCss[k] === '}') depth--
        k++
      }
      const body = rawCss.slice(j + 1, k - 1)

      // @media / @supports: scope ricorsivo del body (nested rules).
      // @keyframes / @font-face / altri: body preservato as-is (NO scope — semantica diversa).
      if (header.startsWith('@media') || header.startsWith('@supports')) {
        result.push(`${header} { ${scopeCss(body, mfId)} }`)
      } else {
        result.push(`${header} { ${body.trim()} }`)
      }
      i = k
      continue
    }

    // Regola normale: `selectorList { body }`.
    let j = i
    while (j < len && rawCss[j] !== '{') j++
    if (j >= len) break

    const selectorList = rawCss.slice(i, j).trim()
    let depth = 1
    let k = j + 1
    while (k < len && depth > 0) {
      if (rawCss[k] === '{') depth++
      else if (rawCss[k] === '}') depth--
      k++
    }
    const body = rawCss.slice(j + 1, k - 1).trim()

    // Comma-split selector list, prefisso ogni selector con lo scope attribute.
    const scoped = selectorList
      .split(',')
      .map((s) => `${scope} ${s.trim()}`)
      .join(', ')
    result.push(`${scoped} { ${body} }`)
    i = k
  }

  return result.join('\n')
}
