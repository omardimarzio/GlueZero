/**
 * `<GlueZeroErrorBoundary>` — Error boundary class component built-in (D-V2-F17-03).
 *
 * Cattura errori React render/lifecycle nei figli ed esegue 3 azioni in cascade:
 * 1. **Render fallback** — `props.fallback` se fornito (riceve `{error, reset}`)
 *    altrimenti un minimal HTML `role="alert"` di default.
 * 2. **Publish F8 standard topic** `microfrontend.runtime.failed` sul broker con
 *    payload `{ error: { message, name, stack }, microFrontendId }`.
 *    Riuso costante topic F8 (nessun nuovo topic).
 * 3. **Delegation `SERVICE_FALLBACKS` (F14)** — lookup graceful degradation: se il
 *    `fallbacksModule()` è installato sul broker viene invocato `onRuntimeError`
 *    (best-effort, NESSUN throw se F14 assente — pattern Service Locator F14).
 *
 * Zero peer dependency aggiuntive — class component nativo React (no react-error-boundary).
 *
 * @example Uso base con default fallback
 * ```tsx
 * <GlueZeroProvider broker={broker}>
 *   <GlueZeroErrorBoundary microFrontendId="cart-mf">
 *     <CartComponent />
 *   </GlueZeroErrorBoundary>
 * </GlueZeroProvider>
 * ```
 *
 * @example Custom fallback con retry
 * ```tsx
 * <GlueZeroErrorBoundary
 *   microFrontendId="cart-mf"
 *   fallback={({ error, reset }) => (
 *     <div>
 *       <p>Errore: {error.message}</p>
 *       <button onClick={reset}>Riprova</button>
 *     </div>
 *   )}
 * >
 *   <CartComponent />
 * </GlueZeroErrorBoundary>
 * ```
 *
 * @see SERVICE_FALLBACKS — F14 Service Locator graceful degradation.
 * @see MF_ERROR_TOPICS — F8 standard error topics constants.
 * @see prd_2.0.0.md §29.6 — Runtime error boundary spec.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react'
import type { Broker } from '@gluezero/core'
import { BrokerCtx } from './contexts.js'
import type { GlueZeroErrorBoundaryProps, ErrorBoundaryState } from './types.js'

/**
 * Service Locator binding key per `@gluezero/fallbacks` (F8 pre-dichiarato).
 * Hard-coded come literal `'fallbacks'` per evitare dependency su `@gluezero/core`
 * SERVICE_FALLBACKS symbol (mantiene `@gluezero/fallbacks` peer optional).
 *
 * Allineato a `packages/core/src/services.ts:43 SERVICE_FALLBACKS = 'fallbacks'`.
 *
 * @internal
 */
const SERVICE_FALLBACKS_KEY = 'fallbacks' as const

/** Shape minimale del Service F14 (vedi `@gluezero/fallbacks` FallbacksService). */
interface FallbacksServiceLite {
  readonly onRuntimeError?: (mfId: string, err: Error) => void
}

/**
 * Default fallback minimal HTML — renderizzato quando `props.fallback` non è fornito.
 * `role="alert"` per accessibilità screen reader.
 */
function defaultFallback(error: Error): ReactNode {
  return (
    <div
      role="alert"
      style={{
        padding: 16,
        border: '1px solid #c00',
        color: '#c00',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <strong>GlueZero runtime error</strong>
      <pre style={{ whiteSpace: 'pre-wrap', margin: '8px 0 0', fontSize: 12 }}>
        {error.message}
      </pre>
    </div>
  )
}

/**
 * Error boundary class component. Vedi {@link GlueZeroErrorBoundaryProps}.
 *
 * @throws Non lancia mai: tutti gli errori interni (publish failure, F14 lookup
 *         failure) sono swallowed con `try/catch` per evitare cascading error
 *         dentro un error boundary.
 */
export class GlueZeroErrorBoundary extends Component<
  GlueZeroErrorBoundaryProps,
  ErrorBoundaryState
> {
  static override contextType: typeof BrokerCtx = BrokerCtx
  // Annotazione del tipo del context (React 19 + TS strict)
  declare context: Broker | null

  override readonly state: ErrorBoundaryState = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, _info: ErrorInfo): void {
    const broker = this.context
    const microFrontendId = this.props.microFrontendId

    if (broker === null) {
      return
    }

    // 1. Publish topic F8 standard `microfrontend.runtime.failed`
    // Delivery sync per garantire che eventuali subscriber siano notificati prima
    // del prossimo render React (consistency con error topic semantica F8/F14).
    try {
      broker.publish(
        'microfrontend.runtime.failed',
        {
          error: { message: error.message, name: error.name, stack: error.stack },
          microFrontendId: microFrontendId ?? null,
        },
        {
          source: {
            type: 'component',
            id: microFrontendId
              ? `gluezero-error-boundary:${microFrontendId}`
              : 'gluezero-error-boundary',
          },
          deliveryMode: 'sync',
        },
      )
    } catch {
      // Swallow publish failure per evitare cascading error dentro un error boundary.
    }

    // 2. Delega F14 SERVICE_FALLBACKS `onRuntimeError` policy (graceful degradation)
    try {
      const brokerWithService = broker as unknown as {
        getService?: (key: string) => FallbacksServiceLite | undefined
      }
      const fallbacksService = brokerWithService.getService?.(SERVICE_FALLBACKS_KEY)
      if (fallbacksService?.onRuntimeError && microFrontendId) {
        fallbacksService.onRuntimeError(microFrontendId, error)
      }
    } catch {
      // F14 non installato o lookup fallito → graceful degradation, no throw.
    }
  }

  /** Reset dello stato di errore — utile per implementare retry lato componente. */
  reset = (): void => {
    this.setState({ hasError: false, error: null })
  }

  override render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback({ error: this.state.error, reset: this.reset })
      }
      return defaultFallback(this.state.error)
    }
    return this.props.children
  }
}
