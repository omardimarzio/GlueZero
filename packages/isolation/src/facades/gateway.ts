/**
 * `createGatewayFacade(mfId, policy, resolvers, broker)` — D-V2-F13-12 + MF-INT-GW-01/02/03.
 *
 * AMENDMENT D-V2-F13-04-AMENDED resolver pattern: usa `resolvers.gateway?.()` lazy
 * invece di `getService(SERVICE_GATEWAY)` poiché Service Locator F8 NON espone
 * questo binding (i package v1.0 NON si auto-registrano via BrokerModule).
 *
 * ## Lifecycle request (per ogni invocazione `request(routeId, payload, options?)`)
 *
 * 1. **Permission check lazy** via `broker.getService(SERVICE_PERMISSIONS)?.check({mfId,
 *    action:'gateway', resource: routeId})`. Modes:
 *    - `'enforce'` + denied → throw Error con `code='PERMISSION_DENIED'`.
 *    - `'warn'` + denied → `console.warn` + emit `microfrontend.permission.denied` + procedi.
 *    - `'off'` → skip check.
 *    - Permission service ASSENTE (peer optional NON installato) → pass-through silenzioso
 *      + warning una volta per broker (WeakSet-tracked).
 * 2. **Pre-call topic** `microfrontend.gateway.request` con `{microFrontendId, routeId, timestamp}`.
 * 3. **Lazy resolver lookup** `resolvers.gateway?.()` → GatewayService instance.
 *    Se undefined → throw Error("Gateway service not available").
 * 4. **Invoke con metadata attribution** `gatewayService.request(routeId, payload,
 *    {...options, metadata: { ...options?.metadata, microFrontendId: mfId }})` — override
 *    forzato per audit (T-13-W2-P04-01 mitigation: MF NON può spoofare microFrontendId).
 * 5. **On error** → emit `microfrontend.gateway.error` con `{microFrontendId, routeId,
 *    error: err.message}` + re-throw (NON swallow).
 *
 * ## Network policy modes
 *
 * - `network='blocked'` → factory ritorna `undefined` (ctx.gateway = undefined).
 * - `network='direct-allowed'` → factory ritorna `undefined` (MF usa `fetch` direct,
 *   NO observability — documentato P-13 governance NOT crypto README W3 P05/P06).
 * - `network='gateway-only'` → facade obbligatoria (caller deve fornire resolvers.gateway,
 *   altrimenti throw runtime al primo request).
 *
 * @example Setup gateway facade (production)
 * ```ts
 * const gw = createGatewayFacade(
 *   'mf-1',
 *   { ...DEFAULT_ISOLATION_POLICY, network: 'gateway-only' },
 *   { gateway: () => gatewayService },
 *   broker,
 * )
 * const result = await gw!.request('users.list', { page: 1 })
 * // gatewayService.request invocato con metadata.microFrontendId = 'mf-1' (auto-injected)
 * ```
 *
 * @see prd_2.0.0.md §33 — Gateway integration
 * @see D-V2-F13-04-AMENDED — Factory 2-opt resolver pattern
 * @see D-V2-F13-12 — Topic emit observability
 *
 * @param mfId MicroFrontend identifier.
 * @param policy ResolvedIsolationPolicy (merged).
 * @param resolvers Host-provided lazy resolvers (resolvers.gateway?).
 * @param broker Minimal broker shape per topic emit + getService.
 * @returns `GatewayFacade | undefined` (undefined per network='blocked'|'direct-allowed').
 */
import type { ResolvedIsolationPolicy } from '../types/policy.js'
import type {
  GatewayFacade,
  GatewayRequestOptions,
  IsolationResolvers,
} from '../types/facades.js'

interface Broker {
  publish(topic: string, payload: unknown): void
  getService?<T>(key: symbol | string): T | undefined
}

interface PermissionCheckResult {
  readonly allowed: boolean
  readonly mode: 'off' | 'warn' | 'enforce'
  readonly reason?: string
}

interface PermissionService {
  check(args: {
    readonly mfId: string
    readonly action: string
    readonly resource?: string
  }): PermissionCheckResult
}

interface GatewayServiceShape {
  request(
    routeId: string,
    payload?: unknown,
    options?: unknown,
  ): Promise<unknown>
}

// Track facade-type-level warning once-per-broker (peer optional permissions missing).
// WeakSet evita memory leak (broker garbage-collected → entry rimossa).
const WARNED_NO_PERMISSIONS_GATEWAY = new WeakSet<Broker>()

const SERVICE_PERMISSIONS_KEY = 'permissions' // F8 string key (carryover F11 SERVICE_PERMISSIONS)

export function createGatewayFacade(
  mfId: string,
  policy: ResolvedIsolationPolicy,
  resolvers: IsolationResolvers,
  broker: Broker,
): GatewayFacade | undefined {
  if (policy.network === 'blocked' || policy.network === 'direct-allowed') {
    return undefined
  }

  return {
    async request(
      routeId: string,
      payload?: unknown,
      options?: GatewayRequestOptions,
    ): Promise<unknown> {
      // 1. Permission check lazy (peer optional tolerant)
      const permService = broker.getService?.<PermissionService>(
        SERVICE_PERMISSIONS_KEY,
      )
      if (permService) {
        const result = permService.check({
          mfId,
          action: 'gateway',
          resource: routeId,
        })
        if (!result.allowed) {
          if (result.mode === 'enforce') {
            const err = new Error(
              `Permission denied: gateway.request('${routeId}') for mf='${mfId}'`,
            )
            ;(err as { code?: string }).code = 'PERMISSION_DENIED'
            throw err
          }
          if (result.mode === 'warn') {
            console.warn(
              `[@gluezero/isolation] Permission warn: gateway.request('${routeId}') for mf='${mfId}'`,
            )
            broker.publish('microfrontend.permission.denied', {
              microFrontendId: mfId,
              action: 'gateway',
              resource: routeId,
            })
          }
          // mode === 'off' → skip
        }
      } else if (!WARNED_NO_PERMISSIONS_GATEWAY.has(broker)) {
        WARNED_NO_PERMISSIONS_GATEWAY.add(broker)
        console.warn(
          `[@gluezero/isolation] @gluezero/permissions not installed; gateway facade pass-through (mode='off' effective).`,
        )
      }

      // 2. Pre-call topic emit
      broker.publish('microfrontend.gateway.request', {
        microFrontendId: mfId,
        routeId,
        timestamp: Date.now(),
      })

      // 3. Lazy resolver lookup
      const gatewayService = resolvers.gateway?.() as
        | GatewayServiceShape
        | undefined
      if (!gatewayService) {
        throw new Error(
          `[@gluezero/isolation] Gateway service not available; provide resolvers.gateway to isolationModule().`,
        )
      }

      // 4. Invoke con metadata.microFrontendId attribution forzata (T-13-W2-P04-01 mitigation)
      try {
        const enhancedOptions = {
          ...options,
          metadata: {
            ...options?.metadata,
            microFrontendId: mfId, // force override (NON user-injectable)
          },
        }
        const result = await gatewayService.request(
          routeId,
          payload,
          enhancedOptions,
        )
        return result
      } catch (err) {
        // 5. Error topic emit + re-throw
        broker.publish('microfrontend.gateway.error', {
          microFrontendId: mfId,
          routeId,
          error: err instanceof Error ? err.message : String(err),
        })
        throw err
      }
    },
  }
}
