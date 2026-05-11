/**
 * Collision tracker per warn log dedup (D-V2-F10-11).
 *
 * Set<`${mfId}:${field}`> entries. Garantisce che `logger.warn('alias override...')`
 * sia chiamato UNA SOLA VOLTA per tuple `(mfId, field)` — NO spam log.
 *
 * **Threat T-F10-03 mitigation:** dedup per (mfId, field) tuple → log warn al massimo
 * 1 volta per tuple anche se `attachMfMapping` invocato N volte (es. hot-reload, re-mount).
 *
 * **Cleanup cascade:** `clearCollisionsForMf(mfId)` chiamata da `detachMfMapping(mfId)`
 * al `microfrontend.unmounted`/`destroyed`/`unregistered` lifecycle event — coerente con
 * Map cleanup (T-F10-05 leak mitigation).
 *
 * @see D-V2-F10-11 (collision policy explicit-wins + dedup)
 * @see T-F10-03 (namespace collision register-time)
 * @see T-F10-05 (MapperEngine instance leak mitigation — cleanup cascade)
 * @packageDocumentation
 */

const collisions = new Set<string>()

function key(mfId: string, field: string): string {
  return `${mfId}:${field}`
}

/**
 * Marca una tuple `(mfId, field)` come "collision già loggata".
 *
 * Idempotent: chiamate ripetute con stessa tuple sono no-op (Set semantic).
 *
 * @param mfId Id MF (es. `'customer-dashboard'`).
 * @param field Local field name (es. `'customerId'`).
 *
 * @example
 * ```ts
 * markCollision('mf-x', 'customerId')
 * markCollision('mf-x', 'customerId')  // no-op (already in Set)
 * ```
 */
export function markCollision(mfId: string, field: string): void {
  collisions.add(key(mfId, field))
}

/**
 * Verifica se una tuple `(mfId, field)` è già stata loggata come collision.
 *
 * @param mfId Id MF.
 * @param field Local field name.
 * @returns `true` se `markCollision(mfId, field)` è stato già chiamato.
 *
 * @example
 * ```ts
 * if (!hasSeenCollision('mf-x', 'customerId')) {
 *   logger.warn('alias override...')
 *   markCollision('mf-x', 'customerId')
 * }
 * ```
 */
export function hasSeenCollision(mfId: string, field: string): boolean {
  return collisions.has(key(mfId, field))
}

/**
 * Cleanup entries `${mfId}:*` al unregister/destroy MF.
 *
 * Chiamato da `detachMfMapping(mfId)` cascade lifecycle. Garantisce che la stessa
 * (mfId, field) tuple emetta nuovamente warn log se l'MF si ri-registra dopo unregister
 * (es. hot-reload con changes alle alias rule).
 *
 * @param mfId Id MF di cui rimuovere tutte le entries collision.
 *
 * @see T-F10-05 (leak mitigation cleanup cascade)
 */
export function clearCollisionsForMf(mfId: string): void {
  const prefix = `${mfId}:`
  for (const k of collisions) {
    if (k.startsWith(prefix)) collisions.delete(k)
  }
}

/**
 * Test-only reset — NON nel barrel pubblico (D-V2-F9-11).
 *
 * @internal
 */
export function __resetCollisionsForTest(): void {
  collisions.clear()
}
