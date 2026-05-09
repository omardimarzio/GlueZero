/**
 * `createRoleCoverageReport` — coverage report DOM scan + diff vs adapter.roleMap
 * (W5a plan 07-09, UI-DEVTOOLS-02).
 *
 * Scan i nodi con `[data-gz-role]` nello scope (default `document.body`) e
 * produce 5 categorie:
 *
 * 1. **registeredAndUsed**: ruoli usati nel DOM **E** registrati nel registry
 *    (o mappati dall'adapter attivo).
 * 2. **registeredAndOrphan**: ruoli registrati ma nessun nodo li usa.
 * 3. **unregisteredAndUsedWarn**: nodi con `data-gz-role` non registrato → warn
 *    (consistent con D-F7-17 adapter coverage policy = opzionale + report nei
 *    devtools).
 * 4. **inlineStyleWarn**: nodi con `data-gz-role` MA anche `style="..."` inline
 *    → a11y / specificity flag (browser law D-F7-25 inline wins always; il
 *    consumer deve essere consapevole).
 * 5. **nonSemanticWarn**: nodi con ruolo `action.*`/`navigation.link`/`input.*`
 *    su element NON semantico (es. `<div data-gz-role="action.primary">` invece
 *    di `<button>`) → a11y warn (Pitfall HIGH #5 mitigation).
 *
 * **D-F7-04 D-83 strict:** vive in NUOVA sub-folder
 * `packages/devtools/src/theme-inspector/`. Zero modifiche a
 * `packages/devtools/src/index.ts`.
 *
 * Refs:
 * - 07-CONTEXT.md UI-DEVTOOLS-02
 * - 07-09-PLAN.md Task 3
 * - 07-CONTEXT.md D-F7-17 (adapter coverage policy report)
 */

import type { ThemeAdapter } from '@gluezero/theme'

/** Singola entry coverage per un ruolo: ruolo + count + element list. */
export interface CoverageEntry {
  /** Nome del ruolo (es. 'action.primary', 'feedback.error'). */
  readonly role: string
  /** Numero di elementi che usano questo ruolo. */
  readonly count: number
  /** Element list (snapshot read-only al momento dello scan). */
  readonly elements: readonly HTMLElement[]
}

/** Risultato di {@link RoleCoverageReport.scan}. */
export interface CoverageScanResult {
  /** Ruoli usati nel DOM E registrati nel registry/adapter. */
  readonly registeredAndUsed: readonly CoverageEntry[]
  /** Ruoli registrati ma nessun nodo DOM li usa. */
  readonly registeredAndOrphan: readonly string[]
  /** Ruoli usati nel DOM ma NON registrati (warn). */
  readonly unregisteredAndUsedWarn: readonly CoverageEntry[]
  /** Nodi con `data-gz-role` MA anche `style=` inline (warn). */
  readonly inlineStyleWarn: readonly {
    readonly role: string
    readonly element: HTMLElement
    readonly cssText: string
  }[]
  /** Nodi con ruolo applicato a element non-semantico (warn a11y). */
  readonly nonSemanticWarn: readonly {
    readonly role: string
    readonly element: HTMLElement
    readonly expected: string
    readonly got: string
  }[]
}

/** Surface API esposta da {@link createRoleCoverageReport}. */
export interface RoleCoverageReport {
  /** Esegue uno scan one-shot dello scope; ritorna {@link CoverageScanResult}. */
  scan(): CoverageScanResult
}

/** Opzioni di {@link createRoleCoverageReport}. */
export interface CreateRoleCoverageReportOptions {
  /**
   * Adapter attivo per estrarre il `roleMap`/`cssRules` (può essere `null` se
   * nessun adapter è attivo — in tal caso la coverage si basa solo su `roles`).
   */
  readonly adapter: ThemeAdapter | null
  /**
   * Ruoli registrati nella RoleRegistry (`theme.manager.roles.list()`).
   * Servono per calcolare `registeredAndOrphan` e marcare un ruolo come
   * "registrato" anche se l'adapter non lo mappa.
   */
  readonly roles: readonly string[]
  /** Scope DOM da scansionare (default `document.body`). */
  readonly scope?: HTMLElement | Document
}

/**
 * Mapping ruoli "action.*" / "navigation.*" / "input.*" → tag HTML semanticamente
 * attesi. Pattern UI-DEVTOOLS-02 + Pitfall HIGH #5 mitigation (a11y warn quando
 * un ruolo "action.primary" è applicato a `<div>` invece di `<button>`).
 *
 * Riferito ai 14 STANDARD_ROLES v1.1.0 (D-F7-15). Solo i ruoli con vincolo
 * semantico forte sono qui — `surface.*` e `feedback.*` non hanno expectations
 * (sono container neutri).
 */
const SEMANTIC_EXPECTATIONS: Readonly<Record<string, readonly string[]>> = {
  'action.primary': ['BUTTON', 'A', 'INPUT'],
  'action.secondary': ['BUTTON', 'A', 'INPUT'],
  'action.danger': ['BUTTON', 'A'],
  'action.ghost': ['BUTTON', 'A'],
  'navigation.link': ['A'],
  'navigation.active': ['A'],
  'input.text': ['INPUT', 'TEXTAREA'],
  'input.invalid': ['INPUT', 'TEXTAREA'],
}

/**
 * Crea un {@link RoleCoverageReport} (D-30 anti-singleton).
 *
 * Lo scan è one-shot e read-only sul DOM (subscriber passivo). Risultato
 * deeply-frozen per immutability cross-consumer.
 *
 * @example
 * ```ts
 * import { createTheme } from '@gluezero/theme/factory'
 * import { createRoleCoverageReport } from '@gluezero/devtools/theme-inspector'
 *
 * const theme = createTheme()
 * theme.register({ id: 'tw', roleMap: { 'action.primary': 'btn' } })
 * theme.setActiveAdapter('tw')
 *
 * const report = createRoleCoverageReport({
 *   adapter: theme.manager.adapters.get('tw') ?? null,
 *   roles: theme.manager.roles.list().map((r) => r.name),
 * })
 *
 * const result = report.scan()
 * console.log(result.registeredAndUsed)        // ruoli OK
 * console.log(result.unregisteredAndUsedWarn)  // ruoli orfani DOM
 * console.log(result.nonSemanticWarn)          // <div role="action.primary"> warn
 * console.log(result.inlineStyleWarn)          // style="..." inline warn
 * ```
 *
 * @param opts - {@link CreateRoleCoverageReportOptions}.
 * @returns {@link RoleCoverageReport} closure.
 *
 * @see UI-DEVTOOLS-02
 * @see D-F7-17 (adapter coverage policy = opzionale + report nei devtools)
 */
export function createRoleCoverageReport(
  opts: CreateRoleCoverageReportOptions,
): RoleCoverageReport {
  function scan(): CoverageScanResult {
    const scope =
      opts.scope ?? (typeof document !== 'undefined' ? document.body : null)
    if (scope == null) {
      return Object.freeze({
        registeredAndUsed: Object.freeze([]),
        registeredAndOrphan: Object.freeze([]),
        unregisteredAndUsedWarn: Object.freeze([]),
        inlineStyleWarn: Object.freeze([]),
        nonSemanticWarn: Object.freeze([]),
      })
    }
    const elements = scope.querySelectorAll<HTMLElement>('[data-gz-role]')
    const usedByRole = new Map<string, HTMLElement[]>()
    const inlineStyleWarn: {
      role: string
      element: HTMLElement
      cssText: string
    }[] = []
    const nonSemanticWarn: {
      role: string
      element: HTMLElement
      expected: string
      got: string
    }[] = []
    for (const el of elements) {
      const role = el.getAttribute('data-gz-role') ?? ''
      const arr = usedByRole.get(role) ?? []
      arr.push(el)
      usedByRole.set(role, arr)
      // Inline style detection — browser law specificity wins always; warn flag
      const inline = el.getAttribute('style')
      if (inline != null && inline.trim().length > 0) {
        inlineStyleWarn.push({ role, element: el, cssText: inline })
      }
      // Semantic expectation a11y warn (Pitfall HIGH #5)
      const expected = SEMANTIC_EXPECTATIONS[role]
      if (expected != null && !expected.includes(el.tagName)) {
        nonSemanticWarn.push({
          role,
          element: el,
          expected: expected.join('|'),
          got: el.tagName,
        })
      }
    }
    const registeredSet = new Set(opts.roles)
    const adapterMappedSet = new Set<string>([
      ...Object.keys(opts.adapter?.roleMap ?? {}),
      ...Object.keys(opts.adapter?.cssRules ?? {}),
    ])
    const registeredAndUsed: CoverageEntry[] = []
    const unregisteredAndUsedWarn: CoverageEntry[] = []
    for (const [role, els] of usedByRole) {
      const entry: CoverageEntry = Object.freeze({
        role,
        count: els.length,
        elements: Object.freeze([...els]) as readonly HTMLElement[],
      })
      if (registeredSet.has(role) || adapterMappedSet.has(role)) {
        registeredAndUsed.push(entry)
      } else {
        unregisteredAndUsedWarn.push(entry)
      }
    }
    const registeredAndOrphan: string[] = []
    for (const role of registeredSet) {
      if (!usedByRole.has(role)) registeredAndOrphan.push(role)
    }
    return Object.freeze({
      registeredAndUsed: Object.freeze(registeredAndUsed),
      registeredAndOrphan: Object.freeze(registeredAndOrphan),
      unregisteredAndUsedWarn: Object.freeze(unregisteredAndUsedWarn),
      inlineStyleWarn: Object.freeze(inlineStyleWarn),
      nonSemanticWarn: Object.freeze(nonSemanticWarn),
    })
  }

  return { scan }
}
