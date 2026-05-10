/**
 * ThemeError factory + type guard (pattern role-match `packages/core/src/core/broker-error.ts`).
 *
 * Costruisce un Error nativo (instanceof Error mantenuto) arricchito con i campi
 * del contratto ThemeError. Conditional assignment per `details` opzionale
 * (`exactOptionalPropertyTypes: true` distingue tra "campo assente" e "undefined").
 *
 * Refs: PRD §22 + REQ ERR-ext-F7; 07-CONTEXT.md categoria `theme` (ext error).
 */

/**
 * Codici errore dominio theme — uno per situazione runtime distinguibile.
 * Plan W2-W6 estendono con codici aggiuntivi via TS literal union.
 */
export type ThemeErrorCode =
  | 'theme.token.invalid'
  | 'theme.token.cap-exceeded'
  | 'theme.role.invalid'
  | 'theme.role.unregistered'
  | 'theme.role.cap-exceeded'
  | 'theme.adapter.duplicate'
  | 'theme.adapter.invalid'
  | 'theme.adapter.unknown'
  | 'theme.snapshot.frozen'
  | 'theme.persistence.unavailable'
  | 'theme.mode.invalid'
  | 'theme.density.invalid'
  | 'theme.direction.invalid'

/** Shape readonly del ThemeError pubblicato da `createThemeError`. */
export interface ThemeError extends Error {
  readonly code: ThemeErrorCode
  readonly category: 'theme'
  readonly details?: Record<string, unknown>
}

/** MutableThemeError — alias mutable usato solo internamente alla factory. */
type MutableThemeError = {
  -readonly [K in keyof ThemeError]: ThemeError[K]
}

/**
 * Crea un {@link ThemeError} con i parametri forniti.
 *
 * Returns a native `Error` (instanceof Error preserved) enriched with the
 * ThemeError contract fields. `details` viene assegnato solo se non-null
 * (rispetta `exactOptionalPropertyTypes: true`).
 *
 * @param opts - Parametri errore: `code`, `message` + optional `details`.
 * @returns Un `ThemeError` instance (Error subclass, readonly fields).
 *
 * @example
 * ```ts
 * throw createThemeError({
 *   code: 'theme.adapter.duplicate',
 *   message: `Adapter "${id}" già registrato`,
 *   details: { adapterId: id, ownerPluginId },
 * })
 * ```
 */
export function createThemeError(opts: {
  code: ThemeErrorCode
  message: string
  details?: Record<string, unknown>
}): ThemeError {
  const err = new Error(opts.message) as Error as MutableThemeError
  err.name = 'ThemeError'
  err.code = opts.code
  err.category = 'theme'
  if (opts.details != null) {
    err.details = opts.details
  }
  return err as ThemeError
}

/**
 * Type guard runtime per {@link ThemeError}.
 *
 * @param value - Any value to test.
 * @returns `true` se è un Error con `category === 'theme'` + `code` definito.
 *
 * @example
 * ```ts
 * try {
 *   themeManager.registerAdapter(adapter)
 * } catch (err) {
 *   if (isThemeError(err)) {
 *     console.log(err.code, err.details)
 *   }
 * }
 * ```
 */
export function isThemeError(value: unknown): value is ThemeError {
  return (
    value instanceof Error &&
    (value as ThemeError).category === 'theme' &&
    (value as ThemeError).code !== undefined
  )
}
