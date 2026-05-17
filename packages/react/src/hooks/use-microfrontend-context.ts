/**
 * `useMicroFrontendContext()` — Accede al `MicroFrontendRuntimeContext` corrente.
 *
 * Diversamente da `useGlueZero()` NON throwa fuori MF: ritorna `null` quando il
 * Provider non riceve `mfContext` (modalità host legittima). Questo permette
 * a componenti shared host+MF di testare `if (mfContext)` senza dover gestire
 * eccezioni.
 *
 * @returns `MicroFrontendRuntimeContext | null` — null fuori MF.
 *
 * @example Componente "MF-aware"
 * ```tsx
 * function MfAware() {
 *   const mf = useMicroFrontendContext()
 *   return <span>MF id: {mf?.id ?? 'host'}</span>
 * }
 * ```
 *
 * @see GlueZeroProvider
 * @see useRuntimeContext — Shortcut per `.runtime`.
 */
import { useContext } from 'react'
import type { MicroFrontendRuntimeContext } from '@gluezero/microfrontends'
import { MfCtx } from '../contexts.js'

export function useMicroFrontendContext(): MicroFrontendRuntimeContext | null {
  return useContext(MfCtx)
}
