/**
 * `useGlueZeroSubscribe(topic, handler, options?)` — Sottoscrive un topic per la
 * durata del lifecycle del componente.
 *
 * Pattern D-V2-F17-01: `useEffect + useRef stable handler`. Motivazione:
 * - `useRef` mantiene un riferimento stabile al handler più recente → update del
 *   handler tra render NON causano re-subscribe (subscribe è costoso, evitiamo
 *   churn nel broker).
 * - `useEffect` con dependency `[broker, topic]` → re-subscribe SOLO se broker o
 *   topic cambiano (cambio Provider o cambio topic dinamico).
 * - Cleanup invoca `subscription.unsubscribe()` — idempotente lato broker F1
 *   (sicuro anche se chiamato due volte in StrictMode dev).
 *
 * StrictMode-safe: doppio mount in dev fa subscribe → cleanup (unsubscribe) →
 * subscribe (idempotente). Nessuna duplicate delivery.
 *
 * @param topic Pattern topic (supporta wildcards F1 D-11, es. `cart.*`).
 * @param handler Funzione invocata su event ricevuto. Aggiornabile a ogni render
 *                senza penalty di re-subscribe (stable ref).
 * @param options Opzioni subscribe (forwarded a `broker.subscribe()`).
 *
 * @example Subscribe semplice
 * ```tsx
 * function CartBadge() {
 *   const [count, setCount] = useState(0)
 *   useGlueZeroSubscribe('cart.added', () => setCount(c => c + 1))
 *   return <span>{count}</span>
 * }
 * ```
 *
 * @example Pattern wildcard + opzione `once`
 * ```tsx
 * useGlueZeroSubscribe('order.*', (event) => console.log(event), { once: true })
 * ```
 *
 * @see useGlueZero
 * @see prd_2.0.0.md §28.2 — React hooks API
 */
import { useEffect, useRef } from 'react'
import type { BrokerEvent, SubscribeOptions } from '@gluezero/core'
import { useGlueZero } from './use-gluezero.js'

export function useGlueZeroSubscribe(
  topic: string,
  handler: (event: BrokerEvent) => void | Promise<void>,
  options?: SubscribeOptions,
): void {
  const broker = useGlueZero()

  // useRef stable handler — aggiornato a ogni render senza re-subscribe (D-V2-F17-01).
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    const subscription = broker.subscribe(
      topic,
      (event) => handlerRef.current(event),
      options,
    )
    return () => {
      subscription.unsubscribe()
    }
    // Dipendenze intenzionalmente solo [broker, topic]: handler accessibile via
    // `handlerRef.current` (stable handler pattern); options memo-stable lato caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [broker, topic])
}
