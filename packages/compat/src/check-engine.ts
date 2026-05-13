/**
 * F12 Check Engine — orchestratore algoritmo 9 dimensioni semver (PRD §20.3).
 *
 * Cover REQ-IDs:
 * - MF-COMPAT-01 (types operativi 9 dim — input).
 * - MF-COMPAT-03 (CompatibilityReport shape PRD §20.5 + Issue type 9-enum).
 *
 * **Algoritmo 9 dimensioni (PRD §20.3):**
 *
 * | Dim | Type | Lookup | Mismatch | Missing |
 * |-----|------|--------|----------|---------|
 * | `gluezero` | scalar | `GLUEZERO_BUILD_VERSION` (build-time const) | error | n/a |
 * | `canonicalModels` | `Record<key, range>` | `registry.canonicalModels.get(key)` | error | warning (D-12-09) |
 * | `topics` | `Record<key, range>` | `registry.topics.get(key)` | error | warning |
 * | `routes` | `Record<key, range>` | `registry.routes.get(key)` | error | warning |
 * | `workers` | `Record<key, range>` | `registry.workers.get(key)` | error | warning |
 * | `loaders` | `Record<key, range>` | `registry.loaders.get(key)` | error | warning |
 * | `dependencies` | `Record<key, range>` | `registry.dependencies.get(key)` | error | warning |
 * | `theme` | `{tokens?, roles?}` | `registry.theme.get(kind)` | error | warning |
 * | `framework` | `{name, version?}` | `registry.framework.get(name)` | error | warning |
 *
 * Regola comune (D-12-09):
 * - dim dichiarata + registry has key → semver `satisfies` → ok o error.
 * - dim dichiarata + registry NO key → warning (missing version).
 * - dim NON dichiarata → skip silenzioso (D-12 default — adoption progressiva).
 *
 * **Output (PRD §20.5):**
 * - `ok: boolean` = `errors.length === 0` (warnings non bloccano).
 * - `microFrontendId`, `checkedAt: Date.now()` (D-12-18).
 * - `errors[]`, `warnings[]`: array di `CompatibilityIssue` con `type` (1 di 9 enum),
 *   `required?`, `actual?`, `message`, `context?: {subKey, ...}` (D-12-19).
 *
 * **Memoization (D-12-12 NO LRU):**
 * `lastReports = new Map<string, CompatibilityReport>()` closure-captured.
 * `computeReport(mfId, caps)` sempre `lastReports.set(mfId, report)`. Lifecycle
 * hooks (plan 12-03) invocano `invalidateReportCache()` o `deleteReport(mfId)` su
 * topic `microfrontend.unregistered` / `version.changed`.
 *
 * @see prd_2.0.0.md §20.3 — Compatibility descriptor 9 dim
 * @see prd_2.0.0.md §20.5 — CompatibilityReport shape
 * @see D-12-09 — Missing version = warning (NON error)
 * @see D-12-12 — Memoization simple Map (NO LRU eviction)
 * @see D-12-17 — getReport overload (id? optional)
 * @see D-12-18 — checkedAt = Date.now() (carryover F8 MicroFrontendTimings)
 * @see D-12-19 — `context.subKey` additive per Record-based dim disambiguation
 * @see RESEARCH.md §4 — Algorithm pseudocode + 9-step iteration
 * @see packages/permissions/src/permission-engine.ts (TEMPLATE F11 engine pattern)
 */
import type { Broker } from '@gluezero/core'
import type { MicroFrontendsService } from '@gluezero/microfrontends'
import { publishCompatTopics, type CompatibilityPhase } from './compat-error'
import { GLUEZERO_BUILD_VERSION } from './internal/gluezero-version'
import type { SemverChecker } from './semver-checker'
import type { MicroFrontendCompatibility } from './types/compatibility'
import { getCompatibility } from './types/descriptor-augment'
import type { CompatibilityPolicy } from './types/policy'
import type {
  CompatibilityIssue,
  CompatibilityIssueType,
  CompatibilityReport,
} from './types/report'
import type { VersionRegistry } from './version-registry'

/**
 * Public API Check Engine — 6 metodi pubblici per orchestrazione 9-dim semver check.
 *
 * **API:**
 * - `check(mfId)`: lookup descriptor via `mfService.get(mfId)` → compute → memo + return.
 * - `computeReport(mfId, caps)`: forza compute con caps inline (skip mfService lookup).
 * - `getReport(id?)`: overload — con id ritorna memo o compute; senza id ritorna `ReadonlyMap`.
 * - `invalidateReportCache()`: clear tutte le entries memo.
 * - `deleteReport(mfId)`: delete single entry memo.
 * - `publishFailedTopic(mfId, report, phase)`: wrapper di `publishCompatTopics(level='failed')`
 *   (per uso da `policy-dispatch.ts` — emit-prima-di-throw pattern).
 */
export interface CheckEngine {
  /** Lookup descriptor + compute report + memoize. Race-safe (return ok-empty se mf missing). */
  check(mfId: string): CompatibilityReport
  /** Compute report con caps inline (skip mfService lookup) + memoize. */
  computeReport(
    mfId: string,
    caps: MicroFrontendCompatibility | undefined,
  ): CompatibilityReport
  /** Overload (D-12-17): con id → report singolo memo/compute; senza id → ReadonlyMap tutta. */
  getReport(id: string): CompatibilityReport | undefined
  getReport(): ReadonlyMap<string, CompatibilityReport>
  /** Clear memo (invocato da lifecycle hook su `version.changed`). */
  invalidateReportCache(): void
  /** Delete single memo entry (invocato da lifecycle hook su `unregistered`). */
  deleteReport(mfId: string): boolean
  /** Wrapper emit `microfrontend.compatibility.failed` (per policy-dispatch). */
  publishFailedTopic(mfId: string, report: CompatibilityReport, phase: CompatibilityPhase): void
}

/**
 * Factory `CheckEngine` — closure-captured `mfService` + `registry` + `checker` + `broker`.
 *
 * Pattern carryover F11 `createPermissionEngine` (closure-state engine + 5 deps DI).
 *
 * @param mfService MicroFrontends service per `get(id) → registration.descriptor`.
 * @param registry VersionRegistry per lookup `dim.get(subKey)`.
 * @param checker SemverChecker per `satisfies(actual, range)`.
 * @param broker Broker reference per emit `microfrontend.compatibility.failed`.
 * @param _policy CompatibilityPolicy (reservato — F12 ignora qui, dispatch in policy-dispatch).
 * @returns `CheckEngine` con 6 API methods.
 *
 * @example Setup standalone (test scope)
 * ```ts
 * const broker = createBroker({})
 * const mfService = { get: (id) => ({ descriptor: { id, compatibility: { gluezero: '^2.0.0' } } }) }
 * const registry = createVersionRegistry(broker)
 * const checker = createSemverChecker()
 * const engine = createCheckEngine(mfService, registry, checker, broker, 'warn')
 * const report = engine.check('mf-1')
 * report.ok // boolean
 * ```
 *
 * @see prd_2.0.0.md §20.3 — algoritmo 9 dim
 * @see D-12-12 — memoization simple Map (NO LRU)
 */
export function createCheckEngine(
  mfService: Pick<MicroFrontendsService, 'get'>,
  registry: VersionRegistry,
  checker: SemverChecker,
  broker: Broker,
  _policy: CompatibilityPolicy,
): CheckEngine {
  // D-12-12 memoization simple Map (NO LRU — host trusted, scope = MF count bounded).
  const lastReports = new Map<string, CompatibilityReport>()

  /**
   * Costruisce un `CompatibilityIssue` standard.
   *
   * @internal
   */
  function makeIssue(
    type: CompatibilityIssueType,
    required: string | undefined,
    actual: string | undefined,
    message: string,
    context?: Readonly<Record<string, unknown>>,
  ): CompatibilityIssue {
    return {
      type,
      ...(required !== undefined && { required }),
      ...(actual !== undefined && { actual }),
      message,
      ...(context && { context }),
    }
  }

  /**
   * Algoritmo 9 dim — iteratore stateless che popola errors[] + warnings[].
   *
   * @internal
   */
  function runAlgorithm(
    caps: MicroFrontendCompatibility,
    errors: CompatibilityIssue[],
    warnings: CompatibilityIssue[],
  ): void {
    // === Dim 1: gluezero (scalar range vs build-time const) ===
    if (caps.gluezero !== undefined) {
      const range = caps.gluezero
      const actual = GLUEZERO_BUILD_VERSION
      if (!checker.satisfies(actual, range)) {
        errors.push(
          makeIssue(
            'gluezero-version',
            range,
            actual,
            `gluezero: actual ${actual} does NOT satisfy required range ${range}`,
          ),
        )
      }
    }

    // === Dim 2-7: Record-based ===
    // canonicalModels / topics / routes / workers / loaders / dependencies.
    const recordDims: ReadonlyArray<{
      key: keyof MicroFrontendCompatibility
      type: CompatibilityIssueType
      registryMap: ReadonlyMap<string, string>
    }> = [
      { key: 'canonicalModels', type: 'canonical-model-version', registryMap: registry.canonicalModels },
      { key: 'topics', type: 'topic-version', registryMap: registry.topics },
      { key: 'routes', type: 'route-version', registryMap: registry.routes },
      { key: 'workers', type: 'worker-version', registryMap: registry.workers },
      { key: 'loaders', type: 'loader-version', registryMap: registry.loaders },
      { key: 'dependencies', type: 'dependency-version', registryMap: registry.dependencies },
    ]

    for (const dim of recordDims) {
      const declared = caps[dim.key] as Readonly<Record<string, string>> | undefined
      if (declared === undefined) continue
      for (const [subKey, range] of Object.entries(declared)) {
        const actual = dim.registryMap.get(subKey)
        if (actual === undefined) {
          // D-12-09: missing version = warning (NON error).
          warnings.push(
            makeIssue(
              dim.type,
              range,
              undefined,
              `${dim.key}.${subKey}: version not registered (declared ${range})`,
              { subKey },
            ),
          )
          continue
        }
        if (!checker.satisfies(actual, range)) {
          errors.push(
            makeIssue(
              dim.type,
              range,
              actual,
              `${dim.key}.${subKey}: actual ${actual} does NOT satisfy required range ${range}`,
              { subKey },
            ),
          )
        }
      }
    }

    // === Dim 8: theme ({tokens?, roles?} object) ===
    if (caps.theme !== undefined) {
      const themeDims: ReadonlyArray<{ kind: 'tokens' | 'roles'; range: string | undefined }> = [
        { kind: 'tokens', range: caps.theme.tokens },
        { kind: 'roles', range: caps.theme.roles },
      ]
      for (const t of themeDims) {
        if (t.range === undefined) continue
        const actual = registry.theme.get(t.kind)
        if (actual === undefined) {
          warnings.push(
            makeIssue(
              'theme-version',
              t.range,
              undefined,
              `theme.${t.kind}: version not registered (declared ${t.range})`,
              { subKey: t.kind },
            ),
          )
          continue
        }
        if (!checker.satisfies(actual, t.range)) {
          errors.push(
            makeIssue(
              'theme-version',
              t.range,
              actual,
              `theme.${t.kind}: actual ${actual} does NOT satisfy required range ${t.range}`,
              { subKey: t.kind },
            ),
          )
        }
      }
    }

    // === Dim 9: framework ({name, version?} object) ===
    if (caps.framework !== undefined) {
      const fw = caps.framework
      const actual = registry.framework.get(fw.name)
      if (actual === undefined) {
        warnings.push(
          makeIssue(
            'framework-version',
            fw.version,
            undefined,
            `framework "${fw.name}": not installed (declared version ${fw.version ?? 'any'})`,
            { name: fw.name },
          ),
        )
      } else if (fw.version !== undefined) {
        if (!checker.satisfies(actual, fw.version)) {
          errors.push(
            makeIssue(
              'framework-version',
              fw.version,
              actual,
              `framework "${fw.name}": actual ${actual} does NOT satisfy required range ${fw.version}`,
              { name: fw.name },
            ),
          )
        }
      }
      // Se fw.version undefined + actual presente: ok silenzioso (any version match).
    }
  }

  function computeReport(
    mfId: string,
    caps: MicroFrontendCompatibility | undefined,
  ): CompatibilityReport {
    const errors: CompatibilityIssue[] = []
    const warnings: CompatibilityIssue[] = []
    if (caps !== undefined) {
      runAlgorithm(caps, errors, warnings)
    }
    const report: CompatibilityReport = {
      ok: errors.length === 0,
      microFrontendId: mfId,
      checkedAt: Date.now(),
      errors,
      warnings,
    }
    lastReports.set(mfId, report)
    return report
  }

  function check(mfId: string): CompatibilityReport {
    const registration = mfService.get(mfId)
    if (registration === undefined) {
      // Race-safe defensive: MF unregistered just before check. Return ok-empty.
      const report: CompatibilityReport = {
        ok: true,
        microFrontendId: mfId,
        checkedAt: Date.now(),
        errors: [],
        warnings: [],
      }
      lastReports.set(mfId, report)
      return report
    }
    const caps = getCompatibility(registration.descriptor)
    return computeReport(mfId, caps)
  }

  // getReport overload (D-12-17): con id → report singolo memo/compute; senza id → Map tutta.
  function getReport(id: string): CompatibilityReport | undefined
  function getReport(): ReadonlyMap<string, CompatibilityReport>
  function getReport(
    id?: string,
  ): CompatibilityReport | undefined | ReadonlyMap<string, CompatibilityReport> {
    if (id === undefined) return lastReports
    const cached = lastReports.get(id)
    if (cached !== undefined) return cached
    // Compute on-demand se non memoizzato — usa check (lookup descriptor).
    return check(id)
  }

  function invalidateReportCache(): void {
    lastReports.clear()
  }

  function deleteReport(mfId: string): boolean {
    return lastReports.delete(mfId)
  }

  function publishFailedTopic(
    _mfId: string,
    report: CompatibilityReport,
    _phase: CompatibilityPhase,
  ): void {
    // Wrapper per consistency emit — coerente con D-12-16 (Report-as-payload, NO MF-id duplicato).
    publishCompatTopics(broker, report, 'failed')
  }

  return {
    check,
    computeReport,
    getReport,
    invalidateReportCache,
    deleteReport,
    publishFailedTopic,
  }
}
