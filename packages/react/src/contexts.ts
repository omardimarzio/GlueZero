/**
 * React.Context separati internamente per `broker` + `mfContext` (D-V2-F17-02).
 *
 * Pattern "1 Provider, 2 Context": l'esterno `<GlueZeroProvider>` monta due
 * `React.createContext` annidati. Cambio del `mfContext` NON forza il re-render
 * dei consumer del solo `broker` (tear-resistant in concurrent rendering React 19).
 *
 * Valore di default:
 * - `BrokerCtx = null` → consumer (`useGlueZero`) lancia errore esplicativo se
 *   chiamato fuori Provider (failure-fast).
 * - `MfCtx = null` → consumer (`useMicroFrontendContext`) ritorna null senza
 *   throw (modalità host-without-MF legittima).
 *
 * @see GlueZeroProvider
 * @see useGlueZero
 * @see useMicroFrontendContext
 * @packageDocumentation
 */
import { createContext, type Context } from 'react'
import type { Broker } from '@gluezero/core'
import type { MicroFrontendRuntimeContext } from '@gluezero/microfrontends'

/**
 * Context interno per il `Broker`. Letto da `useGlueZero()` + `useGlueZeroBroker()`.
 *
 * @internal
 */
export const BrokerCtx: Context<Broker | null> = createContext<Broker | null>(null)
BrokerCtx.displayName = 'GlueZeroBrokerContext'

/**
 * Context interno per il `MicroFrontendRuntimeContext`.
 * Letto da `useMicroFrontendContext()` e indirettamente da `useRuntimeContext()`.
 *
 * @internal
 */
export const MfCtx: Context<MicroFrontendRuntimeContext | null> =
  createContext<MicroFrontendRuntimeContext | null>(null)
MfCtx.displayName = 'GlueZeroMicroFrontendContext'
