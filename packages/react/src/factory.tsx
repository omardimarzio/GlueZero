/**
 * `createReactMicroFrontendLifecycle(Component, options?)` — Factory che crea un
 * `MicroFrontendRuntimeModule` compatibile F8 (D-V2-F17-04).
 *
 * Strategia: `createRoot(target).render(<StrictMode><GlueZeroProvider><ErrorBoundary><Component/></ErrorBoundary></GlueZeroProvider></StrictMode>)`.
 *
 * **Lifecycle adapter** — il `MicroFrontendRuntimeModule` F8 espone hooks che ricevono
 * un `MicroFrontendRuntimeContext` (`ctx`), non un `target: HTMLElement`. La factory
 * supporta 2 modalità di risoluzione del target DOM:
 *   1. **Esplicito** (raccomandato): `options.mountTarget` — l'host fornisce il container.
 *   2. **Standalone API**: la factory ritorna anche metodi `mount(target)/unmount()/destroy()`
 *      con signature target-based (analog F15 wc-loader) utilizzabili direttamente dal
 *      loader senza passare per il `MicroFrontendRuntimeContext`.
 *
 * Il valore ritornato espone ENTRAMBI gli stili (vedi `ReactMicroFrontendLifecycle`):
 * - `bootstrap(broker, mfContext?)` / `mount(target)` / `unmount()` / `destroy()` — API standalone.
 * - `lifecycleModule` — getter del `MicroFrontendRuntimeModule` shape compatibile F8.
 *
 * @param Component React component da mountare (riceve `props={}`).
 * @param options Opzioni `{ strictMode = true, mountTarget? }`.
 * @returns `ReactMicroFrontendLifecycle` — vedi sopra per lo shape esposto.
 *
 * @example API standalone (mount diretto)
 * ```tsx
 * import { createReactMicroFrontendLifecycle } from '@gluezero/react'
 * import { MyComp } from './MyComp.js'
 *
 * const lifecycle = createReactMicroFrontendLifecycle(MyComp)
 * await lifecycle.bootstrap(broker)
 * await lifecycle.mount(document.getElementById('mf-target')!)
 * // ... later
 * await lifecycle.unmount()
 * await lifecycle.destroy()
 * ```
 *
 * @example StrictMode disabilitato
 * ```tsx
 * const lifecycle = createReactMicroFrontendLifecycle(LegacyComp, { strictMode: false })
 * ```
 *
 * @example Adapter `MicroFrontendRuntimeModule` (con mountTarget esplicito)
 * ```tsx
 * const lifecycle = createReactMicroFrontendLifecycle(MyComp, {
 *   mountTarget: document.getElementById('mf-target')!,
 * })
 * // lifecycle.lifecycleModule è registrabile come MicroFrontendRuntimeModule.
 * ```
 *
 * @see GlueZeroProvider
 * @see GlueZeroErrorBoundary
 * @see prd_2.0.0.md §28.2 — React adapter factory.
 * @throws Error se `mount(target)` chiamato prima di `bootstrap(broker)`.
 * @throws Error se `mount(target)` chiamato due volte senza unmount intermedio.
 */
import { StrictMode, type ComponentType, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { Broker } from '@gluezero/core'
import type {
  MicroFrontendRuntimeContext,
  MicroFrontendRuntimeModule,
} from '@gluezero/microfrontends'
import { GlueZeroProvider } from './provider.js'
import { GlueZeroErrorBoundary } from './error-boundary.js'
import type { CreateReactMicroFrontendLifecycleOptions } from './types.js'

/**
 * Lifecycle ritornato dalla factory. Espone API standalone (target-based) +
 * adapter `lifecycleModule` (ctx-based F8).
 */
export interface ReactMicroFrontendLifecycle {
  /** Prima chiamata — registra broker + mfContext opzionale. */
  bootstrap(broker: Broker, mfContext?: MicroFrontendRuntimeContext): Promise<void>
  /** Monta il Component nel target DOM. Richiede `bootstrap()` chiamato prima. */
  mount(target: HTMLElement): Promise<void>
  /** Smonta il root React. Idempotente (chiamate multiple safe). */
  unmount(): Promise<void>
  /** Cleanup finale: unmount + reset broker/mfContext references. Idempotente. */
  destroy(): Promise<void>
  /**
   * Adapter `MicroFrontendRuntimeModule` (F8 ctx-based). Richiede
   * `options.mountTarget` esplicito (o equivalente sul `ctx.descriptor` user-defined).
   */
  readonly lifecycleModule: MicroFrontendRuntimeModule
}

export function createReactMicroFrontendLifecycle<
  P extends object = Record<string, never>,
>(
  Component: ComponentType<P>,
  options: CreateReactMicroFrontendLifecycleOptions = {},
): ReactMicroFrontendLifecycle {
  const strictMode = options.strictMode ?? true
  const explicitMountTarget = options.mountTarget ?? null

  let root: Root | null = null
  let storedBroker: Broker | null = null
  let storedMfContext: MicroFrontendRuntimeContext | null = null

  function buildTree(): ReactNode {
    if (storedBroker === null) {
      throw new Error(
        'createReactMicroFrontendLifecycle: bootstrap() deve essere chiamato prima di mount()',
      )
    }
    // `exactOptionalPropertyTypes: true` richiede spread condizionali
    // (assenza prop !== prop: undefined).
    const providerProps =
      storedMfContext !== null
        ? { broker: storedBroker, mfContext: storedMfContext }
        : { broker: storedBroker }
    const ebProps =
      storedMfContext?.id !== undefined ? { microFrontendId: storedMfContext.id } : {}
    const tree = (
      <GlueZeroProvider {...providerProps}>
        <GlueZeroErrorBoundary {...ebProps}>
          <Component {...({} as P)} />
        </GlueZeroErrorBoundary>
      </GlueZeroProvider>
    )
    return strictMode ? <StrictMode>{tree}</StrictMode> : tree
  }

  async function bootstrap(
    broker: Broker,
    mfContext?: MicroFrontendRuntimeContext,
  ): Promise<void> {
    storedBroker = broker
    storedMfContext = mfContext ?? null
  }

  async function mount(target: HTMLElement): Promise<void> {
    if (storedBroker === null) {
      throw new Error(
        'createReactMicroFrontendLifecycle: bootstrap() deve essere chiamato prima di mount()',
      )
    }
    if (root !== null) {
      throw new Error(
        'createReactMicroFrontendLifecycle: mount() già chiamato. Invoca unmount() prima di rimountare.',
      )
    }
    root = createRoot(target)
    root.render(buildTree())
  }

  async function unmount(): Promise<void> {
    if (root !== null) {
      root.unmount()
      root = null
    }
  }

  async function destroy(): Promise<void> {
    await unmount()
    storedBroker = null
    storedMfContext = null
  }

  // ===== Adapter MicroFrontendRuntimeModule (F8 ctx-based) =====
  const lifecycleModule: MicroFrontendRuntimeModule = {
    async bootstrap(ctx: MicroFrontendRuntimeContext) {
      await bootstrap(ctx.broker, ctx)
    },
    async mount(_ctx: MicroFrontendRuntimeContext) {
      if (explicitMountTarget === null) {
        throw new Error(
          'createReactMicroFrontendLifecycle.lifecycleModule.mount: nessun mountTarget. Passa `options.mountTarget` o usa l\'API standalone mount(target).',
        )
      }
      await mount(explicitMountTarget)
    },
    async unmount(_ctx: MicroFrontendRuntimeContext) {
      await unmount()
    },
    destroy(_ctx: MicroFrontendRuntimeContext) {
      // Best-effort cleanup sync. unmount() async è await-ed via Promise drop.
      void destroy()
    },
  }

  return { bootstrap, mount, unmount, destroy, lifecycleModule }
}
