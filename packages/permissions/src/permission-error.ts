/**
 * F11 PermissionError factory + publishDeniedTopics helper (MF-PERM-04).
 *
 * Pattern coerente F10 `context-error.ts:27-101` + denied flow F10
 * `acl-enforcer.ts:172-185` (publish topic PRIMA del throw).
 *
 * **D-V2-F11-22 STRICT**: F11 NON estende `ErrorCategory` union (D-83 strict triple
 * v2.0 block diff `packages/core/src/`). Riusa literal microfrontend come ErrorCategory
 * (additive F8 W1-P03 — coerente F9 D-V2-F9-12 + F10 D-V2-F10-06 pattern direct cast).
 *
 * **Pitfall 7 ACK**: `microfrontend.permission.denied` GIA in F8
 * `MF_GOVERNANCE_TOPICS[2]` — F11 RIUSA via import diretto (NO duplica literal in
 * `topics.ts` locale).
 *
 * @see prd_2.0.0.md §19.6 — PermissionError shape + 2 topics
 * @see D-V2-F11-04 (topics locale literal)
 * @see D-V2-F11-08 (PermissionError shape + timestamp additive)
 * @see D-V2-F11-22 (strict triple — NO union extension upstream)
 * @see packages/context/src/context-error.ts (F10 reference template)
 * @see packages/context/src/acl-enforcer.ts:172-185 (denied flow pattern)
 */
import { type Broker, type BrokerError, createBrokerError, type ErrorCategory } from '@gluezero/core'
import { MF_GOVERNANCE_TOPICS } from '@gluezero/microfrontends'

/**
 * Codici errore specifici di `@gluezero/permissions`.
 *
 * Union locale F11 scope (2 codes) — NON aggiunti al `MicroFrontendErrorCode` union
 * di `@gluezero/microfrontends` (D-V2-F11-22 strict block).
 *
 * - `PERMISSION_DENIED`: pattern check denied in mode `enforce`. Emitted da
 *   `permission-engine.enforce()`. Details shape: `{microFrontendId, action, resource}`.
 * - `CAPABILITY_MISSING`: capability check failed (W2-P04 capability registry).
 *   Details shape: `{microFrontendId, missing: string[]}`.
 */
export type PermissionErrorCode = 'PERMISSION_DENIED' | 'CAPABILITY_MISSING'

/**
 * Parametri input per la factory `createPermissionError`.
 *
 * Shape allineata a `CreateContextErrorParams` di F10 (D-V2-F10-06 pattern) +
 * `CreateMfEsmErrorParams` di F9 (D-V2-F9-12 pattern).
 */
export interface CreatePermissionErrorParams {
  readonly code: PermissionErrorCode
  readonly message: string
  readonly details?: Record<string, unknown>
}

/**
 * Factory per `BrokerError` con `category: 'microfrontend'` e `code` ristretto al
 * union locale `PermissionErrorCode`.
 *
 * Pattern direct cast del literal microfrontend al type ErrorCategory — D-V2-F11-22 +
 * D-V2-F11-08 carryover: il sub-modulo permissions e downstream di `@gluezero/microfrontends`
 * e non puo estendere il union `MicroFrontendErrorCode` upstream per vincolo D-83 strict
 * triple v2.0 (NO diff `packages/microfrontends/src/`).
 *
 * @param params Parametri input: `code` (PermissionErrorCode), `message`, opzionale `details`.
 * @returns `BrokerError` immutabile con `category: 'microfrontend'` + `code` preservato.
 *
 * @example Throw denied error nel `permission-engine.enforce`
 * ```ts
 * throw createPermissionError({
 *   code: 'PERMISSION_DENIED',
 *   message: 'MicroFrontend "mf-x" denied: publish on "customer.pii.email"',
 *   details: { microFrontendId: 'mf-x', action: 'publish', resource: 'customer.pii.email' },
 * })
 * ```
 */
export function createPermissionError(params: CreatePermissionErrorParams): BrokerError {
  return createBrokerError({
    code: params.code,
    category: 'microfrontend' as ErrorCategory,
    message: params.message,
    ...(params.details && { details: params.details }),
  })
}

/**
 * Topic governance F8 riusato via import (Pitfall 7 ACK — NO duplica literal in
 * `topics.ts` locale F11).
 *
 * Index `[2]` in `MF_GOVERNANCE_TOPICS` array F8 (`MF_GOVERNANCE_TOPICS[2]` ===
 * `'microfrontend.permission.denied'`).
 */
const MF_PERMISSION_DENIED: (typeof MF_GOVERNANCE_TOPICS)[number] =
  'microfrontend.permission.denied'

/**
 * Request shape input per `publishDeniedTopics`.
 *
 * @internal scope F11 — NON public API surface (engine usa internamente).
 */
export interface PermissionDeniedRequest {
  readonly mfId: string
  readonly action: string
  readonly resource: string
  readonly requiredPermission?: string
}

/**
 * Payload shape PRD §19.6 strict + `timestamp` additive non-breaking (D-V2-F11-08).
 *
 * Il field `timestamp` e additive per devtools F16 timeline replay (coerente F10
 * `ContextDeniedPayload.timestamp` pattern).
 *
 * @see prd_2.0.0.md §19.6
 */
export interface PermissionDeniedPayload {
  readonly microFrontendId: string
  readonly action: string
  readonly resource: string
  readonly requiredPermission?: string
  readonly timestamp: number
}

/**
 * Pubblica 2 topics denied PRIMA del throw (pattern F10 `acl-enforcer.ts:172-185`).
 *
 * Topic 1 (locale F11 NEW): `'permission.denied'` — non-MF-prefixed, application-wide.
 * Topic 2 (F8 reused): `'microfrontend.permission.denied'` — MF-scoped governance.
 *
 * Source descriptor F1 D-23 obbligatorio: `{type:'plugin', id:'permissions', name:'@gluezero/permissions'}`.
 * Delivery mode `'sync'` coerente F10 fireContextEvents pattern (sync flush SLA).
 *
 * @param broker Broker reference per publish denied topics.
 * @param req Request denied: `mfId`, `action`, `resource`, opzionale `requiredPermission`.
 *
 * @see prd_2.0.0.md §19.6 — 2 topics standard PermissionError
 * @see D-V2-F11-08 (payload + timestamp additive)
 */
export function publishDeniedTopics(broker: Broker, req: PermissionDeniedRequest): void {
  const payload: PermissionDeniedPayload = {
    microFrontendId: req.mfId,
    action: req.action,
    resource: req.resource,
    ...(req.requiredPermission && { requiredPermission: req.requiredPermission }),
    timestamp: Date.now(),
  }
  const opts = {
    source: { type: 'plugin' as const, id: 'permissions', name: '@gluezero/permissions' },
    deliveryMode: 'sync' as const,
  }
  broker.publish('permission.denied', payload, opts)
  broker.publish(MF_PERMISSION_DENIED, payload, opts)
}
