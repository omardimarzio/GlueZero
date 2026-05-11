/**
 * D-V2-16 convention: subscription tracking ownerId per cascade
 * `unregisterMicroFrontend → broker.unsubscribeByOwner(mf:${id})`.
 *
 * Typed string helper grepable: `grep -r "mfOwnerId(" packages/microfrontends/src/`
 * mostra ogni punto di chiamata cascade.
 *
 * @see RESEARCH §8 + PATTERNS §39
 */

/** Convention namespace per ownerId subscription tracking (D-V2-16). */
export const MF_OWNER_PREFIX = 'mf:' as const

/**
 * Costruisce l'ownerId standard `mf:${id}` per cascade unsubscribe (D-V2-16).
 *
 * Usato sia dal Registry (in `unregister` per cascade `broker.unsubscribeByOwner`),
 * sia dal `MicroFrontendRuntimeContext.subscribe` (F8 effective W3) per auto-tag delle
 * subscription create dagli hook lifecycle del MF.
 *
 * @param id - MicroFrontend descriptor id (regex `^[a-z0-9._-]+$`, validated register-time).
 * @returns ownerId formatted `mf:<id>`.
 *
 * @example
 * ```ts
 * import { mfOwnerId } from '@gluezero/microfrontends'
 *
 * const ownerId = mfOwnerId('customer-dashboard') // 'mf:customer-dashboard'
 * broker.unsubscribeByOwner(ownerId) // cleanup tutte subscriptions del MF
 * ```
 */
export function mfOwnerId(id: string): string {
  return `${MF_OWNER_PREFIX}${id}`
}
