/**
 * `useGlueZeroBroker()` — Alias semantico di `useGlueZero()` per leggibilità.
 *
 * Comportamento identico a `useGlueZero()`. Esiste come alias per chi preferisce
 * un nome esplicito "broker" nel sito di chiamata (es. `const broker = useGlueZeroBroker()`).
 * Stesso lancio `Error` fuori Provider.
 *
 * @returns `Broker` istanza singola dell'host application.
 * @throws Error se `<GlueZeroProvider>` non è installato nell'albero antenati.
 *
 * @example
 * ```tsx
 * function CounterButton() {
 *   const broker = useGlueZeroBroker()
 *   return (
 *     <button onClick={() => broker.publish('counter.inc', { delta: 1 }, { source: { type: 'component', id: 'counter' } })}>
 *       +
 *     </button>
 *   )
 * }
 * ```
 *
 * @see useGlueZero — Implementazione canonica.
 */
export { useGlueZero as useGlueZeroBroker } from './use-gluezero.js'
