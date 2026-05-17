/**
 * `@gluezero/react` — Adapter React per GlueZero v2.0 (Phase 17 W2 P02).
 *
 * Surface pubblica:
 * - `<GlueZeroProvider>` — Provider single con 2 React.Context separati internamente
 *   (BrokerCtx + MfCtx) → D-V2-F17-02.
 * - 6 hooks: `useGlueZero` / `useGlueZeroBroker` (alias) / `useGlueZeroPublish` /
 *   `useGlueZeroSubscribe` / `useRuntimeContext` / `useMicroFrontendContext` →
 *   D-V2-F17-01 (useEffect+useRef stable handler pattern per subscribe).
 * - `<GlueZeroErrorBoundary>` — Error boundary built-in con publish topic F8
 *   `microfrontend.runtime.failed` + delegation `SERVICE_FALLBACKS` F14 →
 *   D-V2-F17-03.
 * - `createReactMicroFrontendLifecycle` — Factory `MicroFrontendRuntimeModule`
 *   compatibile F8 con `createRoot` + opzionale `<StrictMode>` wrap → D-V2-F17-04.
 *
 * Peer dependencies (entrambe optional):
 * - `react: >=18.2.0 <20.0.0`
 * - `react-dom: >=18.2.0 <20.0.0`
 *
 * Bundle gate: ≤ 10 KB gzipped (size-limit enforced).
 *
 * @example Quick start (host application)
 * ```tsx
 * import { createBroker } from '@gluezero/core'
 * import { GlueZeroProvider, useGlueZero } from '@gluezero/react'
 *
 * const broker = createBroker({})
 *
 * function App() {
 *   return (
 *     <GlueZeroProvider broker={broker}>
 *       <MyComponent />
 *     </GlueZeroProvider>
 *   )
 * }
 *
 * function MyComponent() {
 *   const broker = useGlueZero()
 *   return <button onClick={() => broker.publish('clicked', {}, { source: { type: 'component', id: 'btn' } })}>Click</button>
 * }
 * ```
 *
 * @example Mount React MF via factory
 * ```tsx
 * import { createReactMicroFrontendLifecycle } from '@gluezero/react'
 * import { MyMicroFrontend } from './MyMicroFrontend.js'
 *
 * const lifecycle = createReactMicroFrontendLifecycle(MyMicroFrontend, {
 *   mountTarget: document.getElementById('mf-target')!,
 * })
 * // Registra come MicroFrontendRuntimeModule in @gluezero/microfrontends.
 * ```
 *
 * @see https://github.com/omardimarzio/GlueZero/tree/main/packages/react#readme
 * @see prd_2.0.0.md §28.2 — React adapter
 * @see prd_2.0.0.md §29.6 — Runtime error boundary
 * @packageDocumentation
 */

// Provider + ErrorBoundary
export { GlueZeroProvider } from './provider.js'
export { GlueZeroErrorBoundary } from './error-boundary.js'

// Factory
export { createReactMicroFrontendLifecycle } from './factory.js'
export type { ReactMicroFrontendLifecycle } from './factory.js'

// 6 hooks
export { useGlueZero } from './hooks/use-gluezero.js'
export { useGlueZeroBroker } from './hooks/use-gluezero-broker.js'
export { useGlueZeroPublish } from './hooks/use-gluezero-publish.js'
export { useGlueZeroSubscribe } from './hooks/use-gluezero-subscribe.js'
export { useRuntimeContext } from './hooks/use-runtime-context.js'
export { useMicroFrontendContext } from './hooks/use-microfrontend-context.js'

// Types
export type {
  GlueZeroProviderProps,
  GlueZeroErrorBoundaryProps,
  ErrorBoundaryState,
  CreateReactMicroFrontendLifecycleOptions,
} from './types.js'
