/**
 * `compareShareScopes` — Share scope conflict detection (D-V2-F15-10 warn + proceed).
 *
 * Quando il consumer dichiara `descriptor.loader.shared: {react: {requiredVersion: '^18.2'}}`
 * e l'host fornisce una versione che NON soddisfa il range, il loader:
 *
 * 1. Emette `console.warn` strutturato `[mf-mf] share scope version mismatch ...`.
 * 2. Pubblica topic `microfrontend.mf.share.version-mismatch` con payload
 *    `{mfId, sharedKey, required, provided, timestamp}`.
 * 3. **Procede usando shared host** — NESSUN throw (carryover F12 warn-then-proceed
 *    policy, coerente webpack MF default behavior).
 *
 * `MF_SHARE_SCOPE_FAILED` resta riservato per scope completamente assente (es. host
 * non ha shared section) — vedi `mf-loader.ts` path discriminato.
 *
 * ## Limitazioni note V2.0 — Module Federation Issue #4071
 *
 * La detection del provided version host è best-effort browser-side: in alcuni setup
 * webpack MF la version effettiva è risolta lazy dentro `__webpack_share_scopes__`
 * e NON è introspectable senza patch runtime. V2.0 implementa il check su tre fonti
 * fallback (in priority order):
 *
 * 1. `window[sharedKey]?.version` — pattern globale UMD-style legacy (rare 2026).
 * 2. `globalThis.__webpack_share_scopes__?.default?.[sharedKey]` — webpack MF runtime
 *    state (volatile, dependency on internal naming).
 * 3. Skip senza warn — se non risolvibile, NO false positive (deliberato per Issue #4071).
 *
 * Workaround completo (consumer-driven version reporting via topic `microfrontend.mf.share.provided`)
 * deferred V2.1. Doc-link: https://github.com/module-federation/core/issues/4071
 *
 * @see D-V2-F15-10 — Share scope conflict warn + proceed (NO throw)
 * @see F12 compat warn-then-proceed policy carryover
 * @see PRD §24 — Module Federation Loader
 * @packageDocumentation
 */
import type { Broker } from '@gluezero/core'

/**
 * Shape minimo `shared` config (sottoinsieme dei field webpack MF + utili per detection).
 */
export interface ShareScopeConfig {
  readonly requiredVersion?: string
  readonly singleton?: boolean
  readonly eager?: boolean
}

/**
 * Payload del topic `microfrontend.mf.share.version-mismatch` (D-V2-F15-10).
 */
export interface ShareVersionMismatchPayload {
  readonly mfId: string
  readonly sharedKey: string
  readonly required: string
  readonly provided: string
  readonly timestamp: number
}

/**
 * Risolve la versione host del pacchetto `sharedKey` (best-effort, Issue #4071-aware).
 *
 * @internal Helper privato — NON esportato dal barrel.
 */
function resolveHostVersion(sharedKey: string): string | undefined {
  // Strategy 1: window globale UMD-style (es. window.React.version).
  const win = globalThis as unknown as Record<string, unknown>
  const pkgGlobal = win[sharedKey]
  if (
    pkgGlobal !== null &&
    typeof pkgGlobal === 'object' &&
    'version' in pkgGlobal &&
    typeof (pkgGlobal as { version: unknown }).version === 'string'
  ) {
    return (pkgGlobal as { version: string }).version
  }

  // Strategy 2: webpack MF runtime state (volatile internal naming).
  const wpScopes = (globalThis as { __webpack_share_scopes__?: Record<string, unknown> })
    .__webpack_share_scopes__
  if (wpScopes !== undefined) {
    const defaultScope = wpScopes['default'] as Record<string, unknown> | undefined
    if (defaultScope !== undefined && sharedKey in defaultScope) {
      const entry = defaultScope[sharedKey] as Record<string, unknown> | undefined
      if (entry !== undefined && typeof entry['version'] === 'string') {
        return entry['version'] as string
      }
    }
  }

  // Strategy 3: skip senza false positive (Issue #4071 deferred V2.1).
  return undefined
}

/**
 * Verifica se `provided` soddisfa il range `required` (semver-like minimal check).
 *
 * Implementa subset minimal di semver senza importare la lib `semver` (peer optional via
 * `@gluezero/compat` transitive — F12, ~10 KB bundle cost se importato direttamente).
 *
 * Supporta operatori:
 * - `^X.Y.Z` — caret (compatible: same major, ≥ X.Y.Z)
 * - `~X.Y.Z` — tilde (patch-level: same major.minor, ≥ X.Y.Z)
 * - `>=X.Y.Z`, `>X.Y.Z`, `=X.Y.Z`, exact `X.Y.Z`.
 * - Range con `||` separator (es. `^5.9.0 || ^6.0.0`).
 *
 * Per range complessi (es. comparator unions `>=1.0.0 <2.0.0`) la check ritorna `true`
 * conservativamente (no false positive sul warn — Issue #4071 awareness).
 *
 * @internal Helper privato — NON esportato dal barrel.
 */
function satisfiesMinimal(provided: string, required: string): boolean {
  const providedParts = parseVersion(provided)
  if (providedParts === null) return true // unknown → skip warn (no false positive)

  // Range `||` split (OR)
  const ranges = required.split('||').map((r) => r.trim())
  return ranges.some((range) => satisfiesSingle(providedParts, range))
}

function satisfiesSingle(
  provided: { readonly major: number; readonly minor: number; readonly patch: number },
  range: string,
): boolean {
  range = range.trim()
  // Caret: ^X.Y.Z
  if (range.startsWith('^')) {
    const target = parseVersion(range.slice(1))
    if (target === null) return true
    if (provided.major !== target.major) return false
    if (provided.minor < target.minor) return false
    if (provided.minor === target.minor && provided.patch < target.patch) return false
    return true
  }
  // Tilde: ~X.Y.Z
  if (range.startsWith('~')) {
    const target = parseVersion(range.slice(1))
    if (target === null) return true
    if (provided.major !== target.major || provided.minor !== target.minor) return false
    return provided.patch >= target.patch
  }
  // >=X.Y.Z
  if (range.startsWith('>=')) {
    const target = parseVersion(range.slice(2).trim())
    if (target === null) return true
    return compareVersions(provided, target) >= 0
  }
  // >X.Y.Z
  if (range.startsWith('>')) {
    const target = parseVersion(range.slice(1).trim())
    if (target === null) return true
    return compareVersions(provided, target) > 0
  }
  // =X.Y.Z or X.Y.Z
  const exact = range.startsWith('=') ? range.slice(1).trim() : range
  const target = parseVersion(exact)
  if (target === null) return true
  return (
    provided.major === target.major &&
    provided.minor === target.minor &&
    provided.patch === target.patch
  )
}

function parseVersion(
  v: string,
): { readonly major: number; readonly minor: number; readonly patch: number } | null {
  const match = v.trim().match(/^(\d+)\.(\d+)\.(\d+)/)
  if (match === null) return null
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  }
}

function compareVersions(
  a: { readonly major: number; readonly minor: number; readonly patch: number },
  b: { readonly major: number; readonly minor: number; readonly patch: number },
): number {
  if (a.major !== b.major) return a.major - b.major
  if (a.minor !== b.minor) return a.minor - b.minor
  return a.patch - b.patch
}

/**
 * Confronta `shared` config del MF con scope host. Per ogni `requiredVersion` mismatched,
 * emette `console.warn` + pubblica topic `microfrontend.mf.share.version-mismatch`. NON
 * throw (D-V2-F15-10 — carryover F12 warn-then-proceed).
 *
 * Versione host risolta via 3-strategy fallback (vedi `resolveHostVersion` — Issue #4071
 * awareness, no false positive).
 *
 * @param shared - Config `shared` dal descriptor MF loader.
 * @param broker - Broker reference per topic emit (auto-enricha metadata).
 * @param mfId - MicroFrontend ID identificativo per payload + warn message.
 *
 * @example
 * ```ts
 * // Inside mf-loader.load:
 * if (definition.shared !== undefined) {
 *   compareShareScopes(definition.shared, ctx.broker, ctx.descriptor.id)
 * }
 * ```
 *
 * @example Output warn + topic on mismatch
 * ```text
 * [mf-mf] share scope version mismatch: mfId="dashboard" requires react@^18.2 but host
 * provides react@19.0 — using host shared (D-V2-F15-10 warn + proceed)
 *
 * topic: microfrontend.mf.share.version-mismatch
 * payload: {mfId: "dashboard", sharedKey: "react", required: "^18.2", provided: "19.0", timestamp: 1700000000000}
 * ```
 *
 * @example Host version not resolvable (Issue #4071 fallback)
 * ```ts
 * // Se window.react.version undefined e __webpack_share_scopes__ assente:
 * // → NO warn (deliberato, no false positive per Issue #4071)
 * // → procede silently
 * ```
 *
 * @see D-V2-F15-10 — Share scope conflict warn + proceed (NO throw)
 * @see F12 compat warn-then-proceed policy carryover
 * @see https://github.com/module-federation/core/issues/4071 — share scope detection limitation
 */
export function compareShareScopes(
  shared: Readonly<Record<string, ShareScopeConfig>>,
  broker: Broker,
  mfId: string,
): void {
  for (const sharedKey of Object.keys(shared)) {
    const config = shared[sharedKey]
    if (config === undefined || config.requiredVersion === undefined) continue
    const provided = resolveHostVersion(sharedKey)
    if (provided === undefined) continue // Issue #4071 — no false positive
    if (satisfiesMinimal(provided, config.requiredVersion)) continue // happy path
    // Mismatch detected → warn + emit topic, no throw.
    const payload: ShareVersionMismatchPayload = {
      mfId,
      sharedKey,
      required: config.requiredVersion,
      provided,
      timestamp: Date.now(),
    }
    // eslint-disable-next-line no-console
    console.warn(
      `[mf-mf] share scope version mismatch: mfId="${mfId}" requires ${sharedKey}@${config.requiredVersion} but host provides ${sharedKey}@${provided} — using host shared (D-V2-F15-10 warn + proceed)`,
    )
    broker.publish('microfrontend.mf.share.version-mismatch', payload)
  }
}
