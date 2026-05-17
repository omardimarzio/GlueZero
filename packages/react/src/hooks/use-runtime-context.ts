/**
 * `useRuntimeContext()` — Accede al `MicroFrontendRuntimeContext` corrente.
 *
 * Alias semantico di `useMicroFrontendContext()` con naming allineato al termine
 * "runtime context" usato in PRD §13. Comodo per consumer che pensano in termini
 * di "runtime context" più che di "micro-frontend".
 *
 * NON throwa fuori MF: ritorna `null` (modalità host legittima).
 *
 * @returns `MicroFrontendRuntimeContext | null` — null fuori MF.
 *
 * @example
 * ```tsx
 * function Logger() {
 *   const rt = useRuntimeContext()
 *   rt?.logger?.info?.('Component renderizzato')
 *   return null
 * }
 * ```
 *
 * @see useMicroFrontendContext — Alias canonico.
 * @see prd_2.0.0.md §13 — Runtime Context spec.
 */
import type { MicroFrontendRuntimeContext } from '@gluezero/microfrontends'
import { useMicroFrontendContext } from './use-microfrontend-context.js'

export function useRuntimeContext(): MicroFrontendRuntimeContext | null {
  return useMicroFrontendContext()
}
