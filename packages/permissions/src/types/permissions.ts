/**
 * `MicroFrontendPermissions` descriptor (PRD §19.3) — 9 categorie.
 *
 * Pattern syntax PRD §19.4:
 * - Esatto: `'customer.order'` matcha solo `customer.order`.
 * - Wildcard finale: `'customer.*'` matcha `customer` + qualsiasi profondità (D-V2-F11-06 multi-segment).
 * - Wildcard globale: `'*'` matcha qualunque topic.
 * - Deny esplicito: `'!customer.pii.*'` (deny-wins always order-independent — D-V2-F11-05).
 *
 * @see prd_2.0.0.md §19.3 — MicroFrontendPermissions shape 9-category
 * @see prd_2.0.0.md §19.4 — pattern matching 4 modes (esatto/wildcard-finale/wildcard-globale/deny)
 */
export type PermissionPattern = string

/**
 * Le 9 categorie di permessi PRD §19.3.
 *
 * Ogni categoria corrisponde a una capability surface della libreria che può essere
 * gated da pattern di permessi. Le 10 enforcement points facade applicano controlli
 * su queste categorie (cfr. W2 P03 — D-V2-F11-13).
 */
export type PermissionCategory =
  | 'publish'
  | 'subscribe'
  | 'route'
  | 'gateway'
  | 'worker'
  | 'context'
  | 'storage'
  | 'theme'
  | 'devtools'

/**
 * Descriptor permessi opzionale per `MicroFrontendDescriptor`.
 *
 * Ogni campo è un array readonly di `PermissionPattern` (string). L'assenza
 * del campo significa "nessun permesso esplicito su questa categoria" (default
 * deny in modalità `enforce`, default warn in modalità `warn` — D-V2-F11-04).
 *
 * @example Descriptor esempio con permessi misti
 * ```ts
 * const descriptor: PermissionAwareMfDescriptor = {
 *   id: 'mf-customer',
 *   permissions: {
 *     publish: ['customer.*'],
 *     subscribe: ['customer.*', 'order.*'],
 *     gateway: ['!customer.pii.*'],
 *   },
 * }
 * ```
 *
 * @see prd_2.0.0.md §19.3
 */
export interface MicroFrontendPermissions {
  readonly publish?: readonly PermissionPattern[]
  readonly subscribe?: readonly PermissionPattern[]
  readonly route?: readonly PermissionPattern[]
  readonly gateway?: readonly PermissionPattern[]
  readonly worker?: readonly PermissionPattern[]
  readonly context?: readonly PermissionPattern[]
  readonly storage?: readonly PermissionPattern[]
  readonly theme?: readonly PermissionPattern[]
  readonly devtools?: readonly PermissionPattern[]
}
