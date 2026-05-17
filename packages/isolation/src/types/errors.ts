/**
 * `IsolationPolicyError` — Error factory per violazioni isolation policy F13.
 *
 * Cover REQ-IDs: MF-ISO-XX (isolation policy violation reporting).
 *
 * ## Auto-fix Rule 1 (Plan-level): BrokerError è interface, NON class
 *
 * Il PLAN.md linea 522-553 dichiarava `class IsolationPolicyError extends BrokerError`,
 * ma `BrokerError` in `@gluezero/core/src/types/error.ts:44` è una **interface** strutturale
 * non una classe. Auto-fix applicata in linea con il pattern reale F11 `permission-error.ts`
 * + F12 `compat-error.ts`: usiamo `createBrokerError` factory che ritorna `BrokerError`
 * immutabile con `category: 'microfrontend'` + `code` ristretto al union locale.
 *
 * ## D-V2-F13-22 STRICT (carryover D-V2-F11-22 + D-V2-F12)
 *
 * F13 NON estende `ErrorCategory` union (D-83 strict SEXTUPLE esteso v2.0 block diff
 * `packages/core/src/`). Riusa literal `'microfrontend'` (additive F8 W1-P03) tramite
 * direct cast — coerente F11 D-V2-F11-22 + F12 pattern.
 *
 * ## Pitfall 7 ACK
 *
 * `microfrontend.isolation.warning` GIA in F8 `MF_GOVERNANCE_TOPICS[3]` — riusato via
 * import diretto in `packages/isolation/src/topics.ts` (NO duplica literal).
 *
 * @see prd_2.0.0.md §21.3 — Isolation policy violation reporting
 * @see D-V2-F13-07 — Iframe stub IFRAME_ADAPTER_REQUIRED
 * @see D-V2-F13-22 — Strict block diff core (carryover F11 D-V2-F11-22)
 * @see packages/permissions/src/permission-error.ts (F11 reference template)
 */
import { type BrokerError, createBrokerError, type ErrorCategory } from '@gluezero/core'
import { MF_GOVERNANCE_TOPICS } from '@gluezero/microfrontends'

/**
 * Codici errore specifici di `@gluezero/isolation` (union locale F13).
 *
 * NON aggiunti al `MicroFrontendErrorCode` union upstream (D-V2-F13-22 strict block).
 *
 * - `IFRAME_ADAPTER_REQUIRED`: policy richiede `iframe` ma host NON ha fornito
 *   `resolvers.iframeLoader` (delegate F15 `@gluezero/mf-iframe`). Details shape:
 *   `{microFrontendId, dimension: 'dom'|'css'|'js'}`.
 * - `POLICY_INVALID`: shape policy non valida (es. combinazione `dom: 'iframe'`
 *   + `js: 'shared-window'` incompatibile). Details shape: `{microFrontendId, reason}`.
 * - `STORAGE_BLOCKED`: codice riservato per warning emit quando MF tenta accesso a
 *   storage con `policy.storage: 'blocked'`. Details shape: `{microFrontendId, action}`.
 */
export type IsolationPolicyErrorCode =
  | 'IFRAME_ADAPTER_REQUIRED'
  | 'POLICY_INVALID'
  | 'STORAGE_BLOCKED'

/**
 * Parametri input per la factory `createIsolationPolicyError`.
 *
 * Shape allineata a `CreatePermissionErrorParams` F11 + `CreateCompatErrorParams` F12.
 */
export interface CreateIsolationPolicyErrorParams {
  readonly code: IsolationPolicyErrorCode
  readonly message: string
  readonly details?: Record<string, unknown>
}

/**
 * Factory per `BrokerError` con `category: 'microfrontend'` e `code` ristretto al
 * union locale `IsolationPolicyErrorCode`.
 *
 * Pattern direct cast del literal `'microfrontend'` al type `ErrorCategory` —
 * D-V2-F13-22 + carryover D-V2-F11-22 + D-V2-F12: NON estendiamo il union upstream
 * per vincolo D-83 strict SEXTUPLE esteso v2.0 (NO diff `packages/core/src/`).
 *
 * @param params Input: `code` (IsolationPolicyErrorCode), `message`, opzionale `details`.
 * @returns `BrokerError` immutabile con `category: 'microfrontend'` + `code` preservato.
 *
 * @example Throw IFRAME_ADAPTER_REQUIRED quando iframe loader missing (W2 P02)
 * ```ts
 * throw createIsolationPolicyError({
 *   code: 'IFRAME_ADAPTER_REQUIRED',
 *   message: 'MicroFrontend "mf-x" requires iframe adapter but no resolvers.iframeLoader provided',
 *   details: { microFrontendId: 'mf-x', dimension: 'dom' },
 * })
 * ```
 *
 * @example Throw POLICY_INVALID per shape malformata
 * ```ts
 * throw createIsolationPolicyError({
 *   code: 'POLICY_INVALID',
 *   message: 'MicroFrontend "mf-x" isolation policy invalid: dom=iframe requires js=sandboxed-iframe',
 *   details: { microFrontendId: 'mf-x', reason: 'dom-js-mismatch' },
 * })
 * ```
 */
export function createIsolationPolicyError(
  params: CreateIsolationPolicyErrorParams,
): BrokerError {
  return createBrokerError({
    code: params.code,
    category: 'microfrontend' as ErrorCategory,
    message: params.message,
    ...(params.details && { details: params.details }),
  })
}

/**
 * Topic governance F8 riusato via import (Pitfall 7 ACK — NO duplica literal in
 * `topics.ts` locale F13).
 *
 * Index `[3]` in `MF_GOVERNANCE_TOPICS` array F8 (`MF_GOVERNANCE_TOPICS[3]` ===
 * `'microfrontend.isolation.warning'`). Verificato indice contro
 * `packages/microfrontends/src/topics.ts:67-73`.
 */
const MF_ISOLATION_WARNING: (typeof MF_GOVERNANCE_TOPICS)[number] =
  'microfrontend.isolation.warning'

/**
 * Re-export del topic riusato per consumer convenience (audit-grep friendly).
 *
 * @internal scope F13 — primary export è `ISOLATION_WARNING_TOPIC` in `./topics.ts`.
 */
export { MF_ISOLATION_WARNING }

/**
 * `IsolationPolicyErrorContext` — Context shape per emit `microfrontend.isolation.warning`.
 *
 * Payload utilizzato dalla W2 quando isolation engine pubblica warning su violation
 * non-blocking (es. shadowDOM fallback per browser legacy, storage namespace miss).
 */
export interface IsolationPolicyErrorContext {
  readonly microFrontendId?: string
  readonly code: IsolationPolicyErrorCode
  readonly report?: unknown
  readonly timestamp?: number
}
