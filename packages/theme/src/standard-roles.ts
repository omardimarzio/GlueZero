/**
 * STANDARD_ROLES — vocabolario canonico v1.1.0 lockato (D-F7-15).
 *
 * 14 ruoli totali = 4 action + 4 feedback + 2 surface + 2 input + 2 navigation.
 *
 * Convention naming: dot-notation `category.subname` (D-F7-16). I role names
 * sono enforcati a runtime da `RoleSetSchema` Valibot regex
 * `^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$` (vedi `internal/valibot-schemas.ts`).
 *
 * Pseudo-state (disabled, hover, focus) si gestiscono via CSS pseudo-classes
 * standard sul selettore `[data-gz-role="..."]` — NON sono ruoli espliciti
 * (D-F7-18). Esempio: `[data-gz-role="action.primary"]:disabled { ... }`.
 *
 * Refs:
 * - 07-CONTEXT.md D-F7-15 (lista lockata) + D-F7-16 (dot-notation) + D-F7-18
 *   (no pseudo-state ruoli)
 * - UI-ROLE-07
 *
 * @example
 * <button data-gz-role="action.primary">Salva</button>
 * <input data-gz-role="input.text" />
 * <div data-gz-role="feedback.error">Errore validazione</div>
 */
/**
 * Tuple letterale dei 14 ruoli canonici. Annotata esplicitamente per soddisfare
 * `--isolatedDeclarations` (non possiamo inferire la tuple `as const` dietro
 * `Object.freeze` senza annotation).
 */
export type StandardRole =
  | 'action.primary'
  | 'action.secondary'
  | 'action.danger'
  | 'action.ghost'
  | 'feedback.error'
  | 'feedback.success'
  | 'feedback.warning'
  | 'feedback.info'
  | 'surface.base'
  | 'surface.elevated'
  | 'input.text'
  | 'input.invalid'
  | 'navigation.link'
  | 'navigation.active'

export const STANDARD_ROLES: ReadonlyArray<StandardRole> = Object.freeze([
  'action.primary',
  'action.secondary',
  'action.danger',
  'action.ghost',
  'feedback.error',
  'feedback.success',
  'feedback.warning',
  'feedback.info',
  'surface.base',
  'surface.elevated',
  'input.text',
  'input.invalid',
  'navigation.link',
  'navigation.active',
] as const)

/**
 * Definizioni human-readable per devtools / docs / Inspector W5a.
 *
 * `description` è destinata al consumo di documentazione e devtools UI; il
 * consumer (es. ThemeInspector W5a) è responsabile dell'escape se renderizza
 * la stringa nel DOM (T-F7-05 disposition: accept).
 */
export const STANDARD_ROLE_DEFINITIONS: Readonly<
  Record<StandardRole, { readonly description: string }>
> = Object.freeze({
  'action.primary': {
    description:
      'Azione primaria del flow corrente (es. Salva, Continua, Conferma)',
  },
  'action.secondary': {
    description: 'Azione secondaria non distruttiva (es. Annulla, Indietro)',
  },
  'action.danger': {
    description: 'Azione distruttiva o irreversibile (es. Elimina, Reset)',
  },
  'action.ghost': {
    description:
      'Azione minimale priva di sfondo (es. link-style button, icon button)',
  },
  'feedback.error': {
    description: 'Feedback errore bloccante o critico',
  },
  'feedback.success': {
    description: 'Feedback successo operazione',
  },
  'feedback.warning': {
    description: 'Feedback warning non bloccante',
  },
  'feedback.info': {
    description: 'Feedback informativo neutrale',
  },
  'surface.base': {
    description: 'Superficie di base della pagina/contenitore principale',
  },
  'surface.elevated': {
    description: 'Superficie elevata (card, dialog, popover, tooltip)',
  },
  'input.text': {
    description: 'Campo di input testuale standard',
  },
  'input.invalid': {
    description: 'Campo di input in stato invalido (validation failure)',
  },
  'navigation.link': {
    description: 'Link di navigazione standard',
  },
  'navigation.active': {
    description:
      'Link di navigazione corrispondente alla pagina/sezione corrente',
  },
})
