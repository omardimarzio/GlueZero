/**
 * Error factory locale F10 — `MF_CONTEXT_WRITE_DENIED` (MF-CTX-04).
 *
 * Wrapper di `createBrokerError` (`@gluezero/core`) con:
 * - `category: 'microfrontend'` fisso (literal già aggiunto al union `ErrorCategory` di
 *   `@gluezero/core` in F8 W1-P03 — F10 lo riusa via direct cast, replica F9 D-V2-F9-12).
 * - `ContextErrorCode` typed union LOCALE (1 code F10 scope: `MF_CONTEXT_WRITE_DENIED`).
 *
 * **NON aggiunto al `MicroFrontendErrorCode` union F8** (D-V2-F10-06 + D-V2-F9-12 carryover
 * stretto): richiederebbe diff `packages/microfrontends/src/microfrontend-error.ts` —
 * VIETATO D-83 strict triple v2.0 (F10 NON modifica `packages/microfrontends/src/`).
 *
 * Pattern direct cast `'microfrontend' as ErrorCategory` — il sub-modulo context è
 * downstream di `@gluezero/microfrontends` e non può estendere union upstream. Il cast
 * è type-safe perché `'microfrontend'` è già membro lockato di `ErrorCategory` (additive F8).
 *
 * **NO `originalError` field** (a differenza F9 `createMfEsmError`): F10 throw è sempre
 * originato in ACL enforcer locale (`acl-enforcer.ts:enforceWrite`), no wrap di errori
 * upstream da catturare.
 *
 * @see MF-CTX-04, PRD §18.7 (read-only enforcement)
 * @see D-V2-F10-06 (enforcement mode: throw + topic publish)
 * @see D-V2-F9-12 (literal type locale, NO union extension upstream)
 * @see packages/mf-esm/src/mf-esm-error.ts (F9 reference template)
 * @packageDocumentation
 */
import { type BrokerError, createBrokerError, type ErrorCategory } from '@gluezero/core'

/**
 * Codici errore specifici dell'enforcement context locale (`@gluezero/context`).
 *
 * Union locale F10 scope (1 code) — NON aggiunta al `MicroFrontendErrorCode` union di
 * `@gluezero/microfrontends` (D-V2-F10-06 + D-V2-F9-12 + D-83 strict carryover esteso v2.0:
 * F10 NON modifica `packages/microfrontends/src/`).
 *
 * - `MF_CONTEXT_WRITE_DENIED`: un MF ha tentato di scrivere su una chiave RuntimeContext
 *   che NON è nel suo `descriptor.context.writableKeys` allowlist (D-V2-F10-05 fail-secure).
 *   Details shape: `{ mfId, attemptedKeys, allowedKeys, deniedKeys }`.
 *
 * @see PRD §18.7 (read-only enforcement)
 * @see D-V2-F10-05 (writableKeys policy fail-secure)
 * @see D-V2-F10-06 (enforcement throw + topic publish)
 */
export type ContextErrorCode = 'MF_CONTEXT_WRITE_DENIED'

/**
 * Parametri input per la factory `createContextError`.
 *
 * Shape allineata a `CreateMfEsmErrorParams` di F9 (D-V2-F9-12 pattern) con:
 * - `code` tipato sul union locale `ContextErrorCode` invece che `MicroFrontendErrorCode`.
 * - **NO `originalError` field** (F10 throw è sempre originato in ACL locale).
 */
export interface CreateContextErrorParams {
  readonly code: ContextErrorCode
  readonly message: string
  readonly details?: Record<string, unknown>
}

/**
 * Factory per `BrokerError` con `category: 'microfrontend'` (riusa la categoria F8
 * additive) e `code` ristretto al union locale `ContextErrorCode`.
 *
 * Pattern direct cast `'microfrontend' as ErrorCategory` — D-V2-F10-06 + D-V2-F9-12
 * carryover stretto: il sub-modulo context è downstream di `@gluezero/microfrontends`
 * e non può estendere il union `MicroFrontendErrorCode` upstream per vincolo D-83
 * strict triple v2.0 (`git diff packages/microfrontends/src/` deve restare vuoto in F10).
 *
 * @param params - Parametri input: `code` (ContextErrorCode), `message`, opzionale `details`.
 * @returns `BrokerError` immutabile con `category: 'microfrontend'` e `code` preservato.
 *
 * @example Throw ACL denied error nel `enforceWrite`
 * ```ts
 * throw createContextError({
 *   code: 'MF_CONTEXT_WRITE_DENIED',
 *   message: 'MicroFrontend "customer-dashboard" attempted to write keys not in writableKeys allowlist',
 *   details: {
 *     mfId: 'customer-dashboard',
 *     attemptedKeys: ['tenantId'],
 *     allowedKeys: ['currentRoute'],
 *     deniedKeys: ['tenantId'],
 *   },
 * })
 * ```
 *
 * @throws Mai — la factory ritorna sempre un `BrokerError`. È responsabilità del caller eseguire `throw`.
 *
 * @see createBrokerError (@gluezero/core) — wrapper sottostante
 * @see MF-CTX-04, PRD §18.7 (read-only enforcement)
 * @see D-V2-F9-12 (literal cast locale, NO union extension F8)
 * @see D-V2-F10-06 (enforcement throw + topic publish)
 */
export function createContextError(params: CreateContextErrorParams): BrokerError {
  return createBrokerError({
    code: params.code,
    // 'microfrontend' literal nel ErrorCategory union (F8 W1-P03 additive non-breaking).
    // Cast diretto (D-V2-F9-12): riusa la categoria senza estendere `MicroFrontendErrorCode`.
    category: 'microfrontend' as ErrorCategory,
    message: params.message,
    ...(params.details && { details: params.details }),
  })
}
