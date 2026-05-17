/**
 * Tipi pubblici di `@gluezero/react` (Phase 17 W2 P02 — REQ MF-FRAMEWORK-REACT-01..04).
 *
 * Le interfacce esposte qui sono il contratto pubblico verso i consumer: `GlueZeroProvider`
 * props, opzioni della factory `createReactMicroFrontendLifecycle`, stato/props di
 * `<GlueZeroErrorBoundary>`. Re-esporta inoltre tipi utili da `@gluezero/core` +
 * `@gluezero/microfrontends` per ridurre il numero di import richiesti agli utenti.
 *
 * @see GlueZeroProvider
 * @see createReactMicroFrontendLifecycle
 * @see GlueZeroErrorBoundary
 * @packageDocumentation
 */
import type { ReactNode } from 'react'
import type { Broker, BrokerEvent } from '@gluezero/core'
import type {
  MicroFrontendPublishOptions,
  MicroFrontendRuntimeContext,
} from '@gluezero/microfrontends'

/**
 * Props del componente `<GlueZeroProvider>` (D-V2-F17-02).
 *
 * Provider unico: monta 2 React.Context separati internamente
 * (BrokerCtx + MfCtx) — `useGlueZero()` legge il broker, `useMicroFrontendContext()`
 * legge il contesto MF (può essere assente nell'host).
 *
 * @see GlueZeroProvider
 */
export interface GlueZeroProviderProps {
  /** Broker singolo dell'host application (D-V2-F17-02). */
  broker: Broker
  /** Contesto MF opzionale (se Provider è dentro un MF). Null/undefined per host. */
  mfContext?: MicroFrontendRuntimeContext
  /** Sottoalbero React. */
  children: ReactNode
}

/**
 * Opzioni della factory `createReactMicroFrontendLifecycle` (D-V2-F17-04).
 *
 * @see createReactMicroFrontendLifecycle
 */
export interface CreateReactMicroFrontendLifecycleOptions {
  /** Abilita `<React.StrictMode>` wrap (default `true`). */
  strictMode?: boolean
  /**
   * Target HTML element esplicito per mount. Se omesso la factory si aspetta
   * che `ctx.mountTarget` (DOM passato in `MicroFrontendRuntimeContext` esteso
   * o equivalente) sia disponibile in fase `mount(ctx)`.
   */
  mountTarget?: HTMLElement
}

/**
 * Stato interno di `<GlueZeroErrorBoundary>` (D-V2-F17-03).
 *
 * Esposto come tipo per consentire eventuali test type-only e per documentazione.
 */
export interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Props di `<GlueZeroErrorBoundary>` (D-V2-F17-03).
 *
 * @see GlueZeroErrorBoundary
 */
export interface GlueZeroErrorBoundaryProps {
  /** Sottoalbero React monitorato. */
  children: ReactNode
  /**
   * Fallback custom invocato in stato errore. Riceve l'errore catturato e una
   * funzione `reset()` che riporta il boundary allo stato "no error" (utile per
   * implementare retry UI lato componente).
   *
   * Se omesso viene renderizzato un fallback minimal HTML (role="alert").
   */
  fallback?: (state: { error: Error; reset: () => void }) => ReactNode
  /**
   * Identificativo MF opzionale: viene incluso nel payload del topic
   * `microfrontend.runtime.failed` e usato per il lookup `SERVICE_FALLBACKS`
   * (graceful degradation F14).
   */
  microFrontendId?: string
}

/** Re-export per convenienza pubblica (riduce import nei consumer). */
export type { Broker, BrokerEvent, MicroFrontendPublishOptions, MicroFrontendRuntimeContext }
