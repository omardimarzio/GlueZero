/**
 * `<GlueZeroProvider>` — Entry point unico con 2 React.Context separati (D-V2-F17-02).
 *
 * Architettura:
 * - Esterno: `<BrokerCtx.Provider value={broker}>` (Broker singolo, NON cambia in
 *   condizioni normali — consumer broker non subiscono ri-render spurious).
 * - Interno: `<MfCtx.Provider value={mfContext ?? null}>` (può variare con il
 *   ciclo lifecycle del MF; cambi NON propagano ai consumer BrokerCtx).
 *
 * Pattern "Provider single + Context multipli" → API ergonomica per developer
 * (un solo wrap nel root) ma tear-resistant in concurrent rendering React 19.
 *
 * @example Host application
 * ```tsx
 * const broker = createBroker({})
 *
 * <GlueZeroProvider broker={broker}>
 *   <App />
 * </GlueZeroProvider>
 * ```
 *
 * @example Provider dentro un MF (con mfContext)
 * ```tsx
 * <GlueZeroProvider broker={broker} mfContext={mfRuntimeContext}>
 *   <MicroFrontendApp />
 * </GlueZeroProvider>
 * ```
 *
 * @see useGlueZero
 * @see useMicroFrontendContext
 * @see prd_2.0.0.md §28.2 — React adapter Provider
 */
import type { JSX } from 'react'
import { BrokerCtx, MfCtx } from './contexts.js'
import type { GlueZeroProviderProps } from './types.js'

/**
 * Provider unico esposto da `@gluezero/react`. Vedi tipi {@link GlueZeroProviderProps}.
 *
 * @param props Props comprendenti `broker` (obbligatorio), `mfContext` (opzionale)
 *              e `children` (sottoalbero React).
 * @returns JSX element con i due Context.Provider annidati.
 */
export function GlueZeroProvider({
  broker,
  mfContext,
  children,
}: GlueZeroProviderProps): JSX.Element {
  return (
    <BrokerCtx.Provider value={broker}>
      <MfCtx.Provider value={mfContext ?? null}>{children}</MfCtx.Provider>
    </BrokerCtx.Provider>
  )
}
