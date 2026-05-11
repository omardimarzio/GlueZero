/**
 * 11 chiavi standard PRD §18.4 come const tuple `as const`.
 *
 * Usata da:
 * - `clearRuntimeContext()` no-args (D-V2-F10-08) per iterare le 11 chiavi standard e
 *   chiamare `delete state[k]` ognuna (exactOptionalPropertyTypes TS strict pattern).
 * - `acl-enforcer.ts` (W2 P03) per validazione `writableKeys` top-level — qualunque
 *   `writableKeys` value deve essere un subset di `RUNTIME_CONTEXT_KEYS`.
 * - Selector keys-array overload helper `internal/keys-selector.ts` (W2 P02) per
 *   validazione runtime type-narrow `keyof RuntimeContext`.
 *
 * Ordering coerente PRD §18.4 (tenantId/user/locale/timezone/permissions/featureFlags/
 * theme/direction/environment/currentRoute/metadata).
 *
 * @see PRD §18.3 (elenco chiavi standard), §18.4 (interface RuntimeContext)
 * @see D-V2-F10-08 (clearRuntimeContext default itera 11 chiavi standard)
 */
export const RUNTIME_CONTEXT_KEYS = [
  'tenantId',
  'user',
  'locale',
  'timezone',
  'permissions',
  'featureFlags',
  'theme',
  'direction',
  'environment',
  'currentRoute',
  'metadata',
] as const

/**
 * Type-level union delle 11 chiavi standard `RuntimeContext`.
 *
 * Estratto via lookup `(typeof RUNTIME_CONTEXT_KEYS)[number]` — narrowed string literal
 * union per type-safety in `acl-enforcer.ts` writableKeys validation + selector keys-array
 * overload runtime narrowing.
 *
 * @see RUNTIME_CONTEXT_KEYS
 */
export type RuntimeContextKey = (typeof RUNTIME_CONTEXT_KEYS)[number]
