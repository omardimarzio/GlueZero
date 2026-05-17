/**
 * `useGlueZero()` — Hook canonico per accedere al `Broker` dal Provider antenato.
 *
 * Failure-fast: lancia `Error` se chiamato fuori da `<GlueZeroProvider>` (no fallback
 * silente — il componente è quasi certamente in mounted in posizione sbagliata).
 *
 * Pattern carryover F1 broker public API: il valore ritornato è la stessa istanza
 * passata a Provider — confronto reference-equal `===` è valido nei test.
 *
 * @returns `Broker` istanza singola dell'host application.
 * @throws Error se `<GlueZeroProvider>` non è installato nell'albero antenati.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const broker = useGlueZero()
 *   return (
 *     <button onClick={() => broker.publish('clicked', {}, { source: { type: 'component', id: 'btn' } })}>
 *       Click
 *     </button>
 *   )
 * }
 * ```
 *
 * @see GlueZeroProvider
 * @see useGlueZeroBroker — Alias semantico identico.
 */
import { useContext } from 'react'
import type { Broker } from '@gluezero/core'
import { BrokerCtx } from '../contexts.js'

export function useGlueZero(): Broker {
  const broker = useContext(BrokerCtx)
  if (broker === null) {
    throw new Error(
      'useGlueZero() chiamato fuori da <GlueZeroProvider>. Assicurati che il componente sia un discendente di GlueZeroProvider.',
    )
  }
  return broker
}
