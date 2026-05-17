/**
 * Error factory locale per `@gluezero/mf-esm` (loader ESM dinamico).
 *
 * Wrapper di `createBrokerError` (`@gluezero/core`) con:
 * - `category: 'microfrontend'` fisso (literal aggiunto al union `ErrorCategory` di
 *   `@gluezero/core` in F8 W1-P03 — F9 lo riusa via direct cast).
 * - `MfEsmErrorCode` typed union LOCALE (3 codes), NON aggiunta al union F8
 *   `MicroFrontendErrorCode` di `packages/microfrontends/src/microfrontend-error.ts`
 *   per D-V2-F9-12 + D-83 strict carryover esteso v2.0 (F9 NON modifica
 *   `packages/microfrontends/src/`).
 *
 * Pattern direct cast `'microfrontend' as ErrorCategory` — il loader ESM è downstream
 * di `@gluezero/microfrontends` e non può estendere union upstream. Il cast è type-safe
 * perché `'microfrontend'` è già membro lockato di `ErrorCategory` (additive F8).
 *
 * @see PRD §22 (Loader Registry API)
 * @see PRD §23.4 (timeout default 15000 ms)
 * @see PRD §23.5 (ESM loader export rules)
 * @see D-V2-F9-12 (literal type locale, NO union extension F8)
 * @see D-V2-F9-08 (rich diagnostic shape per details serialization)
 */
import { type BrokerError, createBrokerError, type ErrorCategory } from '@gluezero/core'

/**
 * Codici errore specifici del loader ESM (`@gluezero/mf-esm`).
 *
 * Union locale — NON aggiunta al `MicroFrontendErrorCode` union di `@gluezero/microfrontends`
 * (D-V2-F9-12 + D-83 strict carryover esteso v2.0: F9 NON modifica `packages/microfrontends/src/`).
 *
 * - `MF_LOADER_TIMEOUT`: `import(url)` non risolve entro `timeoutMs` (default 15000 ms da PRD §23.4).
 *   Details shape (D-V2-F9-08): `{ url, timeoutMs, elapsedMs }`.
 * - `MF_LOADER_ABORTED`: consumer `ctx.signal` aborted prima del timeout interno.
 *   Details shape: `{ url, reason? }`.
 * - `MF_LOADER_INVALID_MODULE`: re-esposto per discovery DX consumer — il literal è già
 *   nel union F8 `MicroFrontendErrorCode`, F9 lo riusa direct (D-V2-F9-12).
 *   Details shape (D-V2-F9-08): `{ url, exportName?, hasDefault, defaultKeys, namedKeys, reason }`.
 *
 * @see PRD §23.5 (ESM loader export rules)
 * @see D-V2-F9-12 (literal type locale, NO union extension)
 */
export type MfEsmErrorCode =
  | 'MF_LOADER_TIMEOUT'
  | 'MF_LOADER_ABORTED'
  | 'MF_LOADER_INVALID_MODULE'

/**
 * Parametri input per la factory `createMfEsmError`.
 *
 * Shape allineata a `CreateMfErrorParams` di `@gluezero/microfrontends` (F8 pattern)
 * con `code` tipato sul union locale `MfEsmErrorCode` invece che `MicroFrontendErrorCode`.
 */
export interface CreateMfEsmErrorParams {
  readonly code: MfEsmErrorCode
  readonly message: string
  readonly details?: Record<string, unknown>
  readonly originalError?: Error
}

/**
 * Factory per `BrokerError` con `category: 'microfrontend'` (riusa la categoria
 * aggiunta in F8 W1-P03 al union `ErrorCategory` di `@gluezero/core`) e
 * `code` ristretto al union locale `MfEsmErrorCode`.
 *
 * Pattern direct cast `'microfrontend' as ErrorCategory` — D-V2-F9-12: il loader ESM
 * è downstream di `@gluezero/microfrontends` e non può estendere il union
 * `MicroFrontendErrorCode` upstream per vincolo D-83 strict carryover esteso v2.0
 * (`git diff packages/microfrontends/src/` deve restare vuoto in F9).
 *
 * @param params - Parametri input: `code` (MfEsmErrorCode), `message`, opzionali `details` + `originalError`.
 * @returns `BrokerError` immutabile con `category: 'microfrontend'` e `code` preservato.
 *
 * @example Throw timeout error nel loader
 * ```ts
 * throw createMfEsmError({
 *   code: 'MF_LOADER_TIMEOUT',
 *   message: `Loader ESM timeout dopo 15000 ms su "${url}"`,
 *   details: { url, timeoutMs: 15000, elapsedMs: 15012 },
 * })
 * ```
 *
 * @example Wrap original error in normalizzazione export
 * ```ts
 * try {
 *   const module = await import(url)
 *   return normalizeModule(module, definition)
 * } catch (err) {
 *   throw createMfEsmError({
 *     code: 'MF_LOADER_INVALID_MODULE',
 *     message: `Modulo ESM non valido: ${(err as Error).message}`,
 *     details: { url, hasDefault: false, defaultKeys: [], namedKeys: [], reason: 'parse failed' },
 *     originalError: err as Error,
 *   })
 * }
 * ```
 *
 * @throws Mai — la factory ritorna sempre un `BrokerError`. È responsabilità del caller eseguire `throw`.
 *
 * @see createBrokerError (@gluezero/core) — wrapper sottostante
 * @see PRD §23.4 (timeout default 15000 ms)
 * @see PRD §23.5 (ESM loader export rules)
 * @see D-V2-F9-12 (literal cast locale, NO union extension F8)
 */
export function createMfEsmError(params: CreateMfEsmErrorParams): BrokerError {
  return createBrokerError({
    code: params.code,
    // 'microfrontend' literal nel ErrorCategory union (F8 W1-P03 additive non-breaking).
    // Cast diretto (D-V2-F9-12): riusa la categoria senza estendere `MicroFrontendErrorCode`.
    category: 'microfrontend' as ErrorCategory,
    message: params.message,
    ...(params.details && { details: params.details }),
    ...(params.originalError && { originalError: params.originalError }),
  })
}
