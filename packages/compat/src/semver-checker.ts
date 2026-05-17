/**
 * Semver wrapper subpath import strategy per bundle target ≤ 9 KB (MF-COMPAT-05).
 *
 * Subpath imports specifici (NON `from 'semver'` root): tree-shake CJS→ESM
 * via tsup `noExternal: ['semver']` + esbuild interop shim (~50 B overhead).
 *
 * **Bundle math (RESEARCH §3.2):**
 * - `functions/satisfies` (247 B raw) → `classes/range` (15 KB) +
 *   `classes/comparator` (3.6 KB) + `classes/semver` (9.5 KB) + `internal/re` (8 KB) →
 *   ~37 KB raw.
 * - `functions/valid` (8 LoC) → `functions/parse` (1 KB) → `classes/semver` (già caricato).
 * - **Totale: ~37 KB raw / ~10-14 KB minified / ~3.5-5 KB gzipped.**
 *
 * Range supportati (PRD §20.3):
 * - exact (`'1.2.3'`)
 * - caret (`'^x.y.z'`)
 * - tilde (`'~x.y.z'`)
 * - range (`'>=a <b'`)
 * - x-range (`'1.x'` / `'1.2.*'`)
 * - OR (`'^1 || ^2'`)
 * - prerelease (`'-rc.1'` — exclude default unless `{includePrerelease:true}`).
 *
 * **T-12-02 mitigation (ReDoS):** `semver` 7.x ha `RANGE_LENGTH_LIMIT=512` +
 * `RANGE_MAX_LENGTH=2048` come protezione interna. Aggiungiamo wrapper try-catch
 * defensive che ritorna `false` su qualsiasi throw (range invalid, version
 * invalid) — coerente con il pattern Pitfall 7 F11 di safe-default.
 *
 * @see prd_2.0.0.md §20.3 — Compatibility ranges
 * @see RESEARCH.md §3 — semver subpath strategy
 * @see PITFALLS.md T-12-02 (ReDoS mitigation)
 */

// Subpath imports — NON `from 'semver'` (trascina ~40 KB).
import satisfies from 'semver/functions/satisfies'
import valid from 'semver/functions/valid'

/**
 * Interface pubblica del wrapper semver.
 *
 * 2 metodi:
 * - `satisfies(actual, range)`: ritorna `true` sse `actual` soddisfa `range` semver.
 * - `isValidVersion(v)`: ritorna `true` sse `v` è una versione semver valida.
 */
export interface SemverChecker {
  satisfies(actual: string, range: string): boolean
  isValidVersion(v: string): boolean
}

/**
 * Crea un'istanza del wrapper semver (stateless, pure function).
 *
 * Pattern carryover F11 `pattern-matcher.ts` (pure function — no closure state).
 * Non richiede `broker` né dipendenze esterne; è una thin façade sul `semver` lib.
 *
 * @returns `SemverChecker` con 2 metodi defensive (try-catch su throw interni).
 *
 * @example Caret range match (più comune)
 * ```ts
 * const checker = createSemverChecker()
 * checker.satisfies('2.1.0', '^2.0.0') // true (caret range — semver minor compatible)
 * checker.satisfies('3.0.0', '^2.0.0') // false (major breaking)
 * ```
 *
 * @example Defensive invalid range (T-12-02 mitigation)
 * ```ts
 * checker.satisfies('1.0.0', 'invalid-range') // false (defensive try-catch)
 * checker.satisfies('garbage', '^1.0.0')       // false (invalid actual)
 * ```
 *
 * @example OR range + prerelease
 * ```ts
 * checker.satisfies('2.0.0', '^1 || ^2')       // true (OR alternation)
 * checker.satisfies('2.0.0-rc.1', '^2.0.0')    // false (prerelease default excluded)
 * ```
 *
 * @example Valid version check
 * ```ts
 * checker.isValidVersion('1.2.3')   // true
 * checker.isValidVersion('garbage') // false
 * ```
 *
 * @see MF-COMPAT-05 — bundle ≤ 9 KB con semver 7.7.4 subpath tree-shake
 * @see prd_2.0.0.md §20.3 — dim `gluezero` scalar range check
 * @see RESEARCH.md §3 — subpath import bundle math
 * @see PITFALLS.md T-12-02 — ReDoS mitigation defensive try-catch
 */
export function createSemverChecker(): SemverChecker {
  return {
    satisfies(actual: string, range: string): boolean {
      // Defensive try-catch — `semver/functions/satisfies` può throw su range invalid
      // (es. `new Range(invalidInput)` throw internally). T-12-02 mitigation: la
      // protezione `RANGE_LENGTH_LIMIT=512` è già nel lib, ma aggiungiamo safe-default
      // per qualunque edge case (input garbage, version garbage).
      try {
        return satisfies(actual, range)
      } catch {
        return false
      }
    },
    isValidVersion(v: string): boolean {
      return valid(v) !== null
    },
  }
}
