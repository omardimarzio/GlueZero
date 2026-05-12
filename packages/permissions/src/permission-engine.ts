/**
 * F11 Permission Engine sincrono single + action discriminator 10 actions
 * (D-V2-F11-03 lockato: NO 8 engine separati per categoria).
 *
 * Pipeline:
 *
 * 1. `check(req)` sync: lookup LRU → cache hit return; miss → load patterns from
 *    descriptor → matchPatterns → cache + return.
 * 2. `enforce(req)` mode dispatch:
 *    - mode `'off'`: no-op.
 *    - mode `'warn'`: if denied → publishDeniedTopics + console.warn + return (NO throw).
 *    - mode `'enforce'`: if denied → publishDeniedTopics + throw PermissionError.
 *
 * **Cache hit ~50 ns / miss ~2 us target** (SC3 ROADMAP linea 289 P-02 mitigation).
 *
 * **D-V2-F11-14 fail-secure default**: MF senza `descriptor.permissions` → patterns=[] →
 * matchPatterns(false). In mode `'enforce'` → throw (deny-all). In mode `'warn'` → topic
 * publish + console.warn (allow telemetry). In mode `'off'` → no-op.
 *
 * @see prd_2.0.0.md §19.4 — pattern matching
 * @see prd_2.0.0.md §19.5 — 10 enforcement points
 * @see prd_2.0.0.md §19.6 — PermissionError + topics
 * @see prd_2.0.0.md §19.7 — modes off/warn/enforce
 * @see D-V2-F11-03 (single engine + 10 actions discriminator)
 * @see D-V2-F11-14 (fail-secure default deny-all)
 * @see D-V2-F11-15 (warn mode telemetry)
 */
import type { Broker } from '@gluezero/core'
import type { MicroFrontendsService } from '@gluezero/microfrontends'
import { lruClearByMfId, lruGet, lruSet } from './lru-cache'
import { matchPatterns } from './pattern-matcher'
import { createPermissionError, publishDeniedTopics } from './permission-error'
import type { PermissionCategory } from './types/permissions'
import { getPermissions } from './types/descriptor-augment'

/**
 * 10 action discriminator (D-V2-F11-03).
 *
 * Espande le 9 categorie PRD §19.3 in 11 actions runtime granulari:
 * `context.read`/`context.write` collapsano a categoria `context`,
 * `storage.read`/`storage.write` collapsano a categoria `storage` (1:N category → action).
 */
export type PermissionAction =
  | 'publish'
  | 'subscribe'
  | 'route'
  | 'gateway'
  | 'worker'
  | 'context.read'
  | 'context.write'
  | 'storage.read'
  | 'storage.write'
  | 'theme'
  | 'devtools'

/**
 * Request shape per `check`/`enforce`.
 */
export interface PermissionCheckRequest {
  readonly mfId: string
  readonly action: PermissionAction
  readonly resource: string
}

/**
 * 3 enforcement modes (PRD §19.7 + D-V2-F11-15).
 *
 * - `'off'`: skip check (no-op enforce).
 * - `'warn'`: telemetry topic + console.warn, NO throw (allow-all behavior).
 * - `'enforce'`: topic + throw `PERMISSION_DENIED` (default production).
 */
export type PermissionMode = 'off' | 'warn' | 'enforce'

/**
 * Permission engine public API (D-V2-F11-03 single engine).
 */
export interface PermissionEngine {
  /** Sync check: ritorna true se allowed (LRU cached). */
  check(req: PermissionCheckRequest): boolean
  /** Mode dispatch enforce: throw/topic/warn per mode (D-V2-F11-15). */
  enforce(req: PermissionCheckRequest): void
  /** Invalidation LRU per mfId (lifecycle hooks: unregister/unmount/permissions.updated). */
  clearCacheByMfId(mfId: string): number
  /** Mode corrente (read-only post-install, D-V2-F11-14 immutable). */
  readonly mode: PermissionMode
}

/**
 * Map action → category descriptor.
 *
 * `context.read`/`context.write` collapsano a `context`, `storage.read`/`storage.write`
 * collapsano a `storage` (PRD §19.3 9 categorie descriptor; F11 D-V2-F11-03 espande
 * 10 actions per granularita runtime).
 */
function actionToCategory(action: PermissionAction): PermissionCategory {
  if (action === 'context.read' || action === 'context.write') return 'context'
  if (action === 'storage.read' || action === 'storage.write') return 'storage'
  return action as PermissionCategory
}

/**
 * Factory `PermissionEngine` — single engine instance bound a `(broker, mfService, mode)`.
 *
 * Lifecycle: invocato da `permissionsModule().install()` (W2-P03) durante module init.
 * Lo stato (mode) e closure-captured immutabile — runtime override defer V2.1.
 *
 * @param broker Broker reference per `publishDeniedTopics` (denied flow).
 * @param mfService MicroFrontendsService reference per `getPermissions(reg.descriptor)`.
 * @param mode Mode enforcement globale `'off' | 'warn' | 'enforce'`.
 * @returns `PermissionEngine` con `check` sync + `enforce` mode dispatch + `clearCacheByMfId`.
 */
export function createPermissionEngine(
  broker: Broker,
  mfService: MicroFrontendsService,
  mode: PermissionMode,
): PermissionEngine {
  const engine: PermissionEngine = {
    mode,
    check(req: PermissionCheckRequest): boolean {
      const key = `${req.mfId}::${req.action}::${req.resource}`
      const cached = lruGet(key)
      if (cached !== undefined) return cached
      const reg = mfService.get(req.mfId)
      const perms = reg ? getPermissions(reg.descriptor) : undefined
      const category = actionToCategory(req.action)
      const patterns = (perms?.[category] as readonly string[] | undefined) ?? []
      const result = matchPatterns(patterns, req.resource)
      lruSet(key, result)
      return result
    },
    enforce(req: PermissionCheckRequest): void {
      if (mode === 'off') return
      if (engine.check(req)) return
      // Denied flow F10 acl-enforcer:172-185 pattern (publish PRIMA del throw)
      publishDeniedTopics(broker, {
        mfId: req.mfId,
        action: req.action,
        resource: req.resource,
      })
      if (mode === 'warn') {
        // D-V2-F11-15 warn mode telemetry: topic + console.warn (NO throw)
        console.warn(
          `[permissions] MF "${req.mfId}" denied: ${req.action} on "${req.resource}"`,
        )
        return
      }
      // mode === 'enforce' → throw PermissionError
      throw createPermissionError({
        code: 'PERMISSION_DENIED',
        message: `MicroFrontend "${req.mfId}" denied: ${req.action} on "${req.resource}"`,
        details: { microFrontendId: req.mfId, action: req.action, resource: req.resource },
      })
    },
    clearCacheByMfId(mfId: string): number {
      return lruClearByMfId(mfId)
    },
  }
  return engine
}
