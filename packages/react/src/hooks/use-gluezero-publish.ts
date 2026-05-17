/**
 * `useGlueZeroPublish()` — Ritorna una funzione `publish` stable con auto-iniezione
 * di `metadata.microFrontendId` quando il Provider ha un `mfContext`.
 *
 * - Identità della funzione preservata across re-render (useCallback con deps stabili)
 *   → safe da passare come prop a componenti memoized senza ri-render spurious.
 * - Auto-iniezione MF-OBS-01 facade (carryover F8): se `<GlueZeroProvider>` ha
 *   `mfContext` il `metadata.microFrontendId` è popolato automaticamente; payload
 *   metadata custom forniti dal caller vengono preservati e l'`microFrontendId`
 *   eventuale viene sovrascritto con il valore del contesto MF (single source of truth).
 *
 * NOTE: `@gluezero/core` D-23 richiede `source: EventSource` su publish. La funzione
 * ritornata accetta come parte di `options` la `source` esattamente come `broker.publish()`.
 *
 * @returns Funzione publish con signature `<T>(topic, payload?, options?) => void`.
 *
 * @example Publish base
 * ```tsx
 * function CounterButton() {
 *   const publish = useGlueZeroPublish()
 *   return (
 *     <button
 *       onClick={() =>
 *         publish('counter.inc', { delta: 1 }, { source: { type: 'component', id: 'counter' } })
 *       }
 *     >
 *       +
 *     </button>
 *   )
 * }
 * ```
 *
 * @example Auto-iniezione metadata.microFrontendId (Provider con mfContext)
 * ```tsx
 * // Dentro un MF con mfContext.id === 'cart-mf'
 * function AddBtn() {
 *   const publish = useGlueZeroPublish()
 *   publish('cart.added', { sku: 'X' }, { source: { type: 'component', id: 'add-btn' } })
 *   // → broker riceve event con metadata.microFrontendId === 'cart-mf'
 * }
 * ```
 *
 * @see useGlueZero — Broker raw (publish manuale senza auto-iniezione).
 * @see GlueZeroProvider
 */
import { useCallback } from 'react'
import type { Broker } from '@gluezero/core'
import { useGlueZero } from './use-gluezero.js'
import { useMicroFrontendContext } from './use-microfrontend-context.js'

/**
 * Tipo della funzione ritornata da `useGlueZeroPublish`.
 * Allineata strutturalmente a `Broker.publish` (3° argomento è il sottoinsieme di
 * opzioni accettato dal broker: `source`, `metadata`, `priority`, ecc.).
 */
export type UseGlueZeroPublishFn = <T = unknown>(
  topic: string,
  payload?: T,
  options?: Parameters<Broker['publish']>[2],
) => void

export function useGlueZeroPublish(): UseGlueZeroPublishFn {
  const broker = useGlueZero()
  const mf = useMicroFrontendContext()
  const mfId: string | null = mf?.id ?? null

  return useCallback(
    <T,>(
      topic: string,
      payload?: T,
      options?: Parameters<Broker['publish']>[2],
    ) => {
      if (mfId !== null) {
        const baseMetadata = (options?.metadata ?? {}) as Record<string, unknown>
        const metadata = { ...baseMetadata, microFrontendId: mfId }
        // Cast del payload a `T` — l'API broker richiede payload tipato; il default
        // `undefined as T` è ergonomico per topic-marker senza payload.
        broker.publish(topic, payload as T, { ...(options ?? {}), metadata })
      } else {
        broker.publish(topic, payload as T, options)
      }
    },
    [broker, mfId],
  )
}
