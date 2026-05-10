/**
 * STANDARD_ROLE_DEFINITIONS — descrizioni human-readable italiane dei 14
 * ruoli canonici per devtools / docs / Inspector W5a.
 *
 * **Subpath separato (D-F7-04 + bundle budget):** estratto da
 * `standard-roles.ts` per NON gravare sul bundle runtime principale
 * `@gluezero/theme` (~250 B di stringhe IT). Consumer Inspector W5a
 * importa esplicitamente:
 *
 * ```ts
 * import { STANDARD_ROLE_DEFINITIONS } from '@gluezero/theme/standard-role-definitions'
 * ```
 *
 * Il runtime core (theme manager, adapter registry, role registry) NON
 * importa questo modulo — le descrizioni sono inutili a runtime, servono
 * solo per UI di documentazione/inspection.
 *
 * `description` è destinata al consumo di docs e devtools UI; il consumer
 * (es. ThemeInspector W5a) è responsabile dell'escape se renderizza la
 * stringa nel DOM (T-F7-05 disposition: accept).
 *
 * Refs:
 * - 07-CONTEXT.md D-F7-04 (subpath additivo) + D-F7-15 (vocabolario)
 * - 07-06-PLAN.md (bundle mitigation)
 * - UI-ROLE-07
 */

import type { StandardRole } from './standard-roles'

/**
 * Descrizioni human-readable italiane dei 14 STANDARD_ROLES.
 *
 * Frozen object — nessuna mutation runtime.
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
