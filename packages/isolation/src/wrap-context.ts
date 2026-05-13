/**
 * `wrapContextWithIsolation(baseCtx, mfId, resolvedPolicy, resolvers, themePolicy, broker)` —
 * D-V2-F13-10 composition esterna pura chained DOPO F11 `wrapContextWithPermissions`.
 *
 * Compone i 4 facade (`storage` + `gateway` + `worker` + `theme`) sul context F8/F11
 * tramite spread shallow — NON muta `baseCtx`. Coerente F11 carryover + D-46 composition
 * wrapper esterno pattern.
 *
 * ## Composition order ratificato (D-V2-F13-10)
 *
 * ```
 * F8 createMfRuntimeContext
 *   → [F11 wrapContextWithPermissions]  (optional, se permissions installato)
 *     → wrapContextWithIsolation        (questo wrap)
 *       → ctx finale exposto a MF code (mount hook input)
 * ```
 *
 * F11 chain dep tollerante: se `broker.getService(SERVICE_PERMISSIONS)` ritorna
 * undefined (peer optional NON installato), i 4 facade pass-through silenziosi +
 * warning una volta per broker (verificato nei facade individuali).
 *
 * ## Facade fields populated (conditional)
 *
 * - `storage`: presente se `policy.storage !== 'blocked'` (else undefined → field omesso).
 * - `gateway`: presente se `policy.network === 'gateway-only'` (else undefined per
 *   'blocked'/'direct-allowed' → field omesso).
 * - `worker`: SEMPRE creato (PRD §34 NON specifica policy worker disabling W2-P04).
 * - `theme`: presente se `themePolicy?.enabled !== false` (else undefined → field omesso).
 *
 * Field omitted via conditional spread `{...(value !== undefined && { key: value })}` —
 * coerente con augment narrow `?` su `MicroFrontendRuntimeContext` (OQ-7 LOW resolution).
 *
 * @example Wrap context chain F13 completa
 * ```ts
 * const baseCtx = createMfRuntimeContext(broker, reg)
 * const permsCtx = wrapContextWithPermissions(baseCtx, engine) // F11
 * const finalCtx = wrapContextWithIsolation(
 *   permsCtx,
 *   'mf-1',
 *   resolvedPolicy,
 *   { gateway: () => gw, worker: () => wk, theme: () => th },
 *   { enabled: true, inherit: true },
 *   broker,
 * )
 * finalCtx.storage?.setItem('foo', 'bar')   // namespaced gz:mf:mf-1:foo
 * await finalCtx.gateway?.request('users.list', payload)
 * await finalCtx.worker?.run('w-1', 'task', payload)
 * finalCtx.theme?.getToken('color-primary')
 * ```
 *
 * @see D-V2-F13-10 — Wrap context chain composition esterna
 * @see D-V2-F13-09 — Ownership 4 facade in F13
 * @see packages/permissions/src/enforcement-points.ts (F11 template wrapContextWithPermissions)
 *
 * @param baseCtx Output di F8 `createMfRuntimeContext` (optionally F11 wrapped).
 * @param mfId MicroFrontend identifier.
 * @param resolvedPolicy ResolvedIsolationPolicy (merged default + policyDefault + descriptor).
 * @param resolvers IsolationResolvers host-provided (gateway/worker/theme/iframeLoader optional).
 * @param themePolicy MicroFrontendThemePolicy | undefined (descriptor.themePolicy).
 * @param broker Minimal broker shape (publish + getService).
 * @returns Nuovo ctx con 4 facade fields conditional populated.
 */
import type { ResolvedIsolationPolicy } from './types/policy.js'
import type { MicroFrontendThemePolicy } from './types/theme-policy.js'
import type { IsolationResolvers } from './types/facades.js'
import { createStorageFacade } from './facades/storage.js'
import { createGatewayFacade } from './facades/gateway.js'
import { createWorkerFacade } from './facades/worker.js'
import { createThemeFacade } from './facades/theme.js'

interface Broker {
  publish(topic: string, payload: unknown): void
  getService?<T>(key: symbol | string): T | undefined
}

interface BaseCtx {
  readonly shadowContainer?: ShadowRoot
  readonly [k: string]: unknown
}

export function wrapContextWithIsolation<T extends BaseCtx>(
  baseCtx: T,
  mfId: string,
  resolvedPolicy: ResolvedIsolationPolicy,
  resolvers: IsolationResolvers,
  themePolicy: MicroFrontendThemePolicy | undefined,
  broker: Broker,
): T & {
  readonly storage?: ReturnType<typeof createStorageFacade>
  readonly gateway?: ReturnType<typeof createGatewayFacade>
  readonly worker?: ReturnType<typeof createWorkerFacade>
  readonly theme?: ReturnType<typeof createThemeFacade>
} {
  const storage = createStorageFacade(mfId, resolvedPolicy, broker)
  const gateway = createGatewayFacade(mfId, resolvedPolicy, resolvers, broker)
  const worker = createWorkerFacade(mfId, resolvedPolicy, resolvers, broker)
  const theme = createThemeFacade(
    mfId,
    resolvedPolicy,
    themePolicy,
    resolvers,
    broker,
    baseCtx.shadowContainer !== undefined
      ? { shadowContainer: baseCtx.shadowContainer }
      : {},
  )

  return {
    ...baseCtx,
    ...(storage !== undefined && { storage }),
    ...(gateway !== undefined && { gateway }),
    ...(worker !== undefined && { worker }),
    ...(theme !== undefined && { theme }),
  } as T & {
    readonly storage?: ReturnType<typeof createStorageFacade>
    readonly gateway?: ReturnType<typeof createGatewayFacade>
    readonly worker?: ReturnType<typeof createWorkerFacade>
    readonly theme?: ReturnType<typeof createThemeFacade>
  }
}
