/**
 * classFor — Strategia C escape hatch imperativo (D-F7-03, UI-ROLE-04 #3).
 *
 * Helper puro: ritorna la stringa di classi DS-specific per il ruolo dato,
 * in base al `roleMap` dell'adapter passato. NO side-effect DOM, NO observer.
 *
 * Caso d'uso: framework code (React/Vue/Svelte) che preferisce applicare
 * classi manualmente nel render anziché tramite MutationObserver (Strategia A)
 * o via `<style>` injection (Strategia B).
 *
 * D-F7-17 coverage opzionale: ruoli non coperti dall'adapter ritornano `''`
 * (no throw). Inspector W5a può flaggare gli usage `unregistered+used (warn)`.
 *
 * @example
 * ```tsx
 * <button className={classFor(adapter, 'action.primary')}>Salva</button>
 * ```
 *
 * @see UI-ROLE-04 Strategia C
 * @see D-F7-03 (3 strategie applicazione DOM)
 * @see D-F7-17 (coverage opzionale + report devtools)
 */

import type { ThemeAdapter } from './types/theme-adapter'

/**
 * Ritorna la stringa di classi mappate per `role` nell'adapter, oppure `''`.
 *
 * @param adapter Adapter attivo (`null` ammesso = nessun adapter)
 * @param role Role name (es. `'action.primary'`)
 * @returns Stringa classi space-separated o `''` se ruolo non mappato (no throw)
 */
export function classFor(adapter: ThemeAdapter | null, role: string): string {
  if (adapter == null || adapter.roleMap == null) return ''
  return adapter.roleMap[role] ?? ''
}
