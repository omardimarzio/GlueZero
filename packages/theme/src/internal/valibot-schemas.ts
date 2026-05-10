/**
 * Valibot schemas internal — TokenSet / RoleSet / ThemeAdapter.
 *
 * Valibot 1.x pipe API tree-shakable: `v.pipe(v.string(), v.regex(...), ...)`.
 * Ogni helper importato individualmente → bundle picca solo le funzioni usate
 * (~1-3 KB per schema, dichiarato in `.planning/research/STACK.md`).
 *
 * Pattern role-match con `packages/mapper/src/valibot-adapter.ts` (NON import —
 * D-83 strict). F7 caller usa `safeParse(schema, payload)` direttamente; sui
 * fail trasforma `result.issues` in `createThemeError({ details: { issues } })`.
 *
 * Path `internal/` indica che questi schemi NON sono ri-esportati nel barrel
 * pubblico `index.ts` (advanced users possono fare `import` esplicito da
 * subpath se servono per validare adapter custom in userland).
 *
 * Refs:
 * - 07-CONTEXT.md D-F7-16 (dot-notation `category.subname`), D-F7-19/22 (token vocab)
 * - 07-02-PLAN.md Task 1
 * - VAL-ext-F7, T-F7-01 + T-F7-05 (XSS guard)
 */

import * as v from 'valibot'

/**
 * Token name regex: lowercase alfanumerico con trattini SOLO.
 * Es valid: `color-primary`, `spacing-2xl`, `motion-medium`.
 * Es invalid: `Color-Primary`, `bad key`, `_underscore`, `with.dot`.
 *
 * Previene prop injection (es. CSS custom property name attaccante-controllata
 * che esce dal namespace `--gz-*`).
 */
const TOKEN_KEY_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/

/**
 * Token value regex: rifiuta `<` `>` `{` `}` `;` per prevenire CSS/HTML injection.
 * Defense-in-depth: `setProperty(name, value)` browser-native escapa già
 * parzialmente, questo schema chiude il gap a livello validation.
 *
 * Caratteri rifiutati:
 * - `<` `>` — script tag injection
 * - `{` `}` — CSS rule break-out
 * - `;` — multiple property injection (`red; expression(...)`)
 */
const TOKEN_VALUE_REGEX = /^[^<>{};]*$/

/** Schema per nome token (chiave del record). Min 1, max 64 char. */
export const TokenKeySchema: v.GenericSchema<string, string> = v.pipe(
  v.string(),
  v.minLength(1),
  v.maxLength(64),
  v.regex(TOKEN_KEY_REGEX, 'Token key must match /^[a-z0-9-]+$/'),
)

/** Schema per valore token (CSS Custom Property value). Max 256 char. */
export const TokenValueSchema: v.GenericSchema<string, string> = v.pipe(
  v.string(),
  v.maxLength(256),
  v.regex(TOKEN_VALUE_REGEX, 'Token value must not contain < > { } ;'),
)

/**
 * TokenSetSchema — record di design token canonici (THEME-10).
 *
 * Validato register-time da `TokenRegistry.apply()`. Su fail → `safeParse`
 * ritorna `{ success: false, issues }` → caller throw `theme.token.invalid`.
 */
export const TokenSetSchema: v.GenericSchema<
  Record<string, string>,
  Record<string, string>
> = v.record(TokenKeySchema, TokenValueSchema)

/**
 * Role name regex: dot-notation `category.subname` (D-F7-16).
 * Coerente con il canonical mapper F2 (es. `message.posted`, `weather.requested`).
 *
 * Es valid: `action.primary`, `feedback.error`, `navigation.link`.
 * Es invalid: `action`, `Action.Primary`, `action. primary`, `_action.primary`.
 */
const ROLE_NAME_REGEX = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/

/** Schema per role name (chiave del record). */
export const RoleNameSchema: v.GenericSchema<string, string> = v.pipe(
  v.string(),
  v.regex(
    ROLE_NAME_REGEX,
    'Role name must be `category.subname` dot-notation (lowercase)',
  ),
)

/** Shape di un singolo role: descrizione opzionale (estesa in W3). */
export interface RoleEntry {
  readonly description?: string | undefined
}

/**
 * RoleSetSchema — set di canonical roles registrabili (W3 RoleRegistry).
 *
 * Esposto per validation register-time degli STANDARD_ROLES + ruoli custom.
 * Plan 07-02 introduce lo schema; il consumer reale è W3 plan 07-05.
 */
export const RoleSetSchema: v.GenericSchema<
  Record<string, RoleEntry>,
  Record<string, RoleEntry>
> = v.record(
  RoleNameSchema,
  v.object({
    description: v.optional(v.string()),
  }),
)

/** Shape inferita per ThemeAdapter validato (subset W2 — plan W3 estende). */
export interface ThemeAdapterShape {
  readonly id: string
  readonly roleMap?: Record<string, string> | undefined
  readonly cssRules?: Record<string, string> | undefined
}

/**
 * ThemeAdapterSchema — shape adapter Tailwind/Bootstrap/Material/etc.
 *
 * - `id` required (1-64 char)
 * - `roleMap` opzionale: `Record<roleName, classNames>` (Strategia A — DOM applier)
 * - `cssRules` opzionale: `Record<roleName, cssRuleBody>` (Strategia B — StyleSheet)
 *
 * XOR roleMap/cssRules NON è enforced qui (validazione a livello registerAdapter
 * in W3 plan 07-06). Schema valida solo i tipi base.
 */
export const ThemeAdapterSchema: v.GenericSchema<
  ThemeAdapterShape,
  ThemeAdapterShape
> = v.object({
  id: v.pipe(v.string(), v.minLength(1), v.maxLength(64)),
  roleMap: v.optional(v.record(RoleNameSchema, v.string())),
  cssRules: v.optional(v.record(RoleNameSchema, v.string())),
})
