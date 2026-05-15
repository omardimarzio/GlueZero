/**
 * `singleSpaLoader` — Loader adapter F15 W2 P04 (experimental @0.x.0).
 *
 * Implementa `MicroFrontendLoaderAdapter` F8 con `type: 'single-spa'`:
 *
 * 1. Validation `definition.module` callable o object con lifecycle inline.
 * 2. Resolve modulo via `await definition.module()` (se function) o usa diretto.
 * 3. Validate single-spa contract `bootstrap`/`mount`/`unmount` (function o array of
 *    functions — 5.9+ supporta array per parallel exec). Mismatch → `MF_SS_LIFECYCLE_INVALID`.
 * 4. Mapping lifecycle bit-exact SS → GlueZero (PRD §27.4):
 *    - `single-spa.bootstrap → MicroFrontendRuntimeModule.bootstrap`
 *    - `single-spa.mount → mount`
 *    - `single-spa.unmount → unmount`
 *    - `destroy`: NO equivalent in single-spa → no-op fallback.
 * 5. Topic emit governance via `ctx.broker.publish` su pre/post each phase + error path.
 * 6. ParcelProps shape mapping `{domElement, name, customProps}` — PRD §27. NO
 *    `singleSpa` API propagation (REQ MF-SS-01 — NO router replacement) + NO
 *    `mountParcel` (V2.1 deferred — top-level lifecycle only).
 * 7. Return `LoadedModule {module, lifecycle, metadata}`.
 *
 * @see D-V2-F15-11 — Peer dep single-spa ^5.9.0 || ^6.0.0
 * @see REQ MF-SS-01 — Lifecycle mapping + NO router replacement
 * @see PRD §27 — single-spa Adapter (experimental @0.x.0)
 */
import type {
  LoadedModule,
  LoaderContext,
  MicroFrontendLoaderAdapter,
  MicroFrontendLoaderDefinition,
  MicroFrontendRuntimeContext,
  MicroFrontendRuntimeModule,
} from '@gluezero/microfrontends'
import { createMfSingleSpaError } from './errors'
import type {
  SingleSpaApp,
  SingleSpaLifecycleEntry,
  SingleSpaLifecycleFn,
  SingleSpaLoaderDefinition,
} from './types/descriptor'

/**
 * Cast helper.
 *
 * @internal
 */
function narrow(definition: MicroFrontendLoaderDefinition): SingleSpaLoaderDefinition {
  return definition as SingleSpaLoaderDefinition
}

/**
 * Verifica shape minimo `SingleSpaApp` — `bootstrap`/`mount`/`unmount` come function o
 * array of functions (single-spa 5.9+ supporta array per parallel exec via Promise.all).
 *
 * @internal
 */
function isLifecycleEntry(value: unknown): value is SingleSpaLifecycleEntry {
  if (typeof value === 'function') return true
  if (Array.isArray(value)) {
    return value.every((fn) => typeof fn === 'function')
  }
  return false
}

/**
 * Validate single-spa app shape — `bootstrap`/`mount`/`unmount` mandatory functions o
 * array of functions.
 *
 * @internal
 */
function isSingleSpaApp(value: unknown): value is SingleSpaApp {
  if (value === null || typeof value !== 'object') return false
  const obj = value as Record<string, unknown>
  return (
    isLifecycleEntry(obj['bootstrap']) &&
    isLifecycleEntry(obj['mount']) &&
    isLifecycleEntry(obj['unmount'])
  )
}

/**
 * Invoca lifecycle entry — function singola o array of functions in parallel
 * (`Promise.all` per array, single await per function).
 *
 * Pattern carryover single-spa 5.9 `flattenFnArray` runtime.
 *
 * @internal
 */
async function invokeSingleSpaLifecycle(
  entry: SingleSpaLifecycleEntry,
  props: Record<string, unknown>,
): Promise<void> {
  if (Array.isArray(entry)) {
    await Promise.all(entry.map((fn) => Promise.resolve(fn(props))))
    return
  }
  if (typeof entry === 'function') {
    await Promise.resolve(entry(props))
    return
  }
  // Should never reach (validate happens before invoke).
  throw createMfSingleSpaError({
    code: 'MF_SS_LIFECYCLE_INVALID',
    message: 'lifecycle entry must be function or array of functions',
    details: { actualType: typeof entry },
  })
}

/**
 * ParcelProps shape mapping (PRD §27 + REQ MF-SS-01):
 *
 * - `domElement` → container (resolved da F8 MicroFrontendMountDefinition.selector
 *   o `document.createElement('div')` fallback minimal).
 * - `name` → `appName` (override esplicito) o `ctx.descriptor.id` fallback.
 * - `customProps` → `ctx.context` se truthy + record-shaped, altrimenti `{}`.
 *
 * **Esclusi intenzionalmente** (REQ MF-SS-01 + V2.1 deferred):
 * - `singleSpa` API — NO router replacement, GlueZero non sostituisce single-spa routing.
 * - `mountParcel` — parcels API deferred V2.1 (planner-time micro-decision).
 *
 * @internal
 */
function ssProps(
  definition: SingleSpaLoaderDefinition,
  ctx: MicroFrontendRuntimeContext,
  container?: HTMLElement,
): Record<string, unknown> {
  const name = definition.appName ?? ctx.descriptor.id
  // Avoid typeof DOM check failing in non-browser test envs — guard with globalThis.
  const fallbackContainer: HTMLElement =
    container ??
    ((globalThis as { document?: { createElement: (tag: string) => HTMLElement } }).document
      ?.createElement('div') as HTMLElement)
  const customProps =
    ctx.context !== undefined && ctx.context !== null && typeof ctx.context === 'object'
      ? (ctx.context as Record<string, unknown>)
      : {}
  return {
    domElement: fallbackContainer,
    name,
    customProps,
    // singleSpa: NON propagato — REQ MF-SS-01 NO router replacement
    // mountParcel: NON propagato — V2.1 deferred
  }
}

/**
 * Tracking container fornito da F8 mount step. Lifecycle wrapper `mount(ctx)` riceve
 * `ctx.context.mountElement` opzionale (consumer F8 orchestrator), oppure fallback su
 * `document.createElement('div')` in `ssProps`.
 *
 * WeakMap per-context permette cleanup automatico GC al unmount.
 *
 * @internal
 */
const MOUNT_CONTAINERS = new WeakMap<MicroFrontendRuntimeContext, HTMLElement>()

/**
 * Wrappa il lifecycle single-spa app in `MicroFrontendRuntimeModule` GlueZero —
 * mapping bit-exact + topic emit governance + error wrapping.
 *
 * @internal
 */
function createSsLifecycle(
  app: SingleSpaApp,
  definition: SingleSpaLoaderDefinition,
  ctx: LoaderContext,
): MicroFrontendRuntimeModule {
  const mfId = ctx.descriptor.id
  const appName = definition.appName ?? mfId

  return {
    async bootstrap(runtimeCtx: MicroFrontendRuntimeContext): Promise<void> {
      ctx.broker.publish('microfrontend.lifecycle.bootstrap.started', {
        mfId,
        appName,
        timestamp: Date.now(),
      })
      try {
        await invokeSingleSpaLifecycle(app.bootstrap, ssProps(definition, runtimeCtx))
        ctx.broker.publish('microfrontend.lifecycle.bootstrap.completed', {
          mfId,
          appName,
          timestamp: Date.now(),
        })
      } catch (err) {
        ctx.broker.publish('microfrontend.lifecycle.bootstrap.failed', {
          mfId,
          appName,
          error: err instanceof Error ? err.message : String(err),
          timestamp: Date.now(),
        })
        throw createMfSingleSpaError({
          code: 'MF_SS_BOOTSTRAP_FAILED',
          message: `single-spa bootstrap fallita per appName="${appName}" mfId="${mfId}": ${err instanceof Error ? err.message : String(err)}`,
          microFrontendId: mfId,
          appName,
          ...(err instanceof Error && { originalError: err }),
          details: { phase: 'bootstrap' },
        })
      }
    },
    async mount(runtimeCtx: MicroFrontendRuntimeContext): Promise<void> {
      ctx.broker.publish('microfrontend.lifecycle.mount.started', {
        mfId,
        appName,
        timestamp: Date.now(),
      })
      try {
        const container = MOUNT_CONTAINERS.get(runtimeCtx)
        await invokeSingleSpaLifecycle(app.mount, ssProps(definition, runtimeCtx, container))
        ctx.broker.publish('microfrontend.lifecycle.mount.completed', {
          mfId,
          appName,
          timestamp: Date.now(),
        })
      } catch (err) {
        ctx.broker.publish('microfrontend.lifecycle.mount.failed', {
          mfId,
          appName,
          error: err instanceof Error ? err.message : String(err),
          timestamp: Date.now(),
        })
        throw createMfSingleSpaError({
          code: 'MF_SS_MOUNT_FAILED',
          message: `single-spa mount fallita per appName="${appName}" mfId="${mfId}": ${err instanceof Error ? err.message : String(err)}`,
          microFrontendId: mfId,
          appName,
          ...(err instanceof Error && { originalError: err }),
          details: { phase: 'mount' },
        })
      }
    },
    async unmount(runtimeCtx: MicroFrontendRuntimeContext): Promise<void> {
      ctx.broker.publish('microfrontend.lifecycle.unmount.started', {
        mfId,
        appName,
        timestamp: Date.now(),
      })
      try {
        const container = MOUNT_CONTAINERS.get(runtimeCtx)
        await invokeSingleSpaLifecycle(app.unmount, ssProps(definition, runtimeCtx, container))
        MOUNT_CONTAINERS.delete(runtimeCtx)
        ctx.broker.publish('microfrontend.lifecycle.unmount.completed', {
          mfId,
          appName,
          timestamp: Date.now(),
        })
      } catch (err) {
        ctx.broker.publish('microfrontend.lifecycle.unmount.failed', {
          mfId,
          appName,
          error: err instanceof Error ? err.message : String(err),
          timestamp: Date.now(),
        })
        throw createMfSingleSpaError({
          code: 'MF_SS_UNMOUNT_FAILED',
          message: `single-spa unmount fallita per appName="${appName}" mfId="${mfId}": ${err instanceof Error ? err.message : String(err)}`,
          microFrontendId: mfId,
          appName,
          ...(err instanceof Error && { originalError: err }),
          details: { phase: 'unmount' },
        })
      }
    },
    // `destroy`: no equivalent in single-spa (REQ MF-SS-01) — no-op fallback.
    destroy(_runtimeCtx: MicroFrontendRuntimeContext): void {
      // No-op intentional — single-spa non ha destroy phase, unmount cleanup è sufficiente.
    },
  }
}

/**
 * Helper testing — registra container per `runtimeCtx` mount lookup.
 *
 * Non documentato pubblicamente — consumer F8 orchestrator imposta container via
 * extension dell'lifecycle wrapper (V2.1 surface formal). V2.0 questo helper test-only.
 *
 * @internal
 */
export function __setMountContainerForTests(
  runtimeCtx: MicroFrontendRuntimeContext,
  container: HTMLElement,
): void {
  MOUNT_CONTAINERS.set(runtimeCtx, container)
}

/**
 * Loader concreto single-spa `MicroFrontendLoaderAdapter` con `type: 'single-spa'`
 * (D-V2-F15-11).
 *
 * @example Registrazione consumer-side
 * ```ts
 * import { createBroker } from '@gluezero/core'
 * import { microfrontendModule } from '@gluezero/microfrontends'
 * import '@gluezero/mf-single-spa/augment'
 * import { singleSpaLoader } from '@gluezero/mf-single-spa'
 *
 * const broker = createBroker({ modules: [microfrontendModule()] })
 * const service = broker.modules.get('@gluezero/microfrontends')
 * service.registerLoader(singleSpaLoader)
 * ```
 *
 * @example Descriptor SS async loader
 * ```ts
 * await broker.registerMicroFrontend({
 *   id: 'navbar-app',
 *   name: 'Navbar (single-spa)',
 *   version: '1.0.0',
 *   loader: {
 *     type: 'single-spa',
 *     module: () => import('https://cdn.example/navbar.js'),
 *     appName: 'navbar',
 *   },
 * })
 * await broker.loadMicroFrontend('navbar-app')
 * ```
 *
 * @example Object inline (testing co-located)
 * ```ts
 * loader: {
 *   type: 'single-spa',
 *   module: {
 *     bootstrap: async () => { ... },
 *     mount: async ({domElement}) => { domElement.innerHTML = 'Hi' },
 *     unmount: async ({domElement}) => { domElement.innerHTML = '' },
 *   },
 * }
 * ```
 *
 * @example Lifecycle array parallel (single-spa 5.9+)
 * ```ts
 * module: {
 *   bootstrap: async () => {...},
 *   mount: [async () => {...}, async () => {...}], // Promise.all parallel
 *   unmount: async () => {...},
 * }
 * ```
 *
 * @throws `MfSingleSpaError` con code:
 *   - `MF_SS_LIFECYCLE_INVALID`: modulo non-conforming (bootstrap/mount/unmount mancanti
 *     o non function/array).
 *   - `MF_SS_BOOTSTRAP_FAILED`: invocation bootstrap throw.
 *   - `MF_SS_MOUNT_FAILED`: invocation mount throw.
 *   - `MF_SS_UNMOUNT_FAILED`: invocation unmount throw.
 *
 * @see D-V2-F15-11 — Peer single-spa ^5.9.0 || ^6.0.0
 * @see REQ MF-SS-01 — Lifecycle mapping bit-exact + NO router replacement
 * @see PRD §27 — single-spa Adapter
 */
export const singleSpaLoader: MicroFrontendLoaderAdapter = {
  type: 'single-spa',
  async load(
    definition: MicroFrontendLoaderDefinition,
    ctx: LoaderContext,
  ): Promise<LoadedModule> {
    const ssDef = narrow(definition)
    const mfId = ctx.descriptor.id
    const appName = ssDef.appName ?? mfId

    // ===== Step 1: Validation =====
    if (typeof ssDef.module !== 'function' && (ssDef.module === null || typeof ssDef.module !== 'object')) {
      throw createMfSingleSpaError({
        code: 'MF_SS_LIFECYCLE_INVALID',
        message: `descriptor.loader.module deve essere function o object con lifecycle inline per type='single-spa' mfId='${mfId}'`,
        microFrontendId: mfId,
        appName,
        details: {
          actualType: typeof ssDef.module,
          reason: 'module field required (function o SingleSpaApp object)',
        },
      })
    }

    // ===== Step 2: Resolve modulo =====
    let resolvedModule: unknown
    try {
      const maybe = typeof ssDef.module === 'function' ? ssDef.module() : ssDef.module
      resolvedModule = await Promise.resolve(maybe)
    } catch (err) {
      throw createMfSingleSpaError({
        code: 'MF_SS_LIFECYCLE_INVALID',
        message: `single-spa module() loader fallita per appName="${appName}" mfId="${mfId}": ${err instanceof Error ? err.message : String(err)}`,
        microFrontendId: mfId,
        appName,
        ...(err instanceof Error && { originalError: err }),
        details: { reason: 'module() function rejected' },
      })
    }

    // ===== Step 3: Validate SingleSpaApp shape =====
    if (!isSingleSpaApp(resolvedModule)) {
      const obj = resolvedModule as Record<string, unknown> | null
      throw createMfSingleSpaError({
        code: 'MF_SS_LIFECYCLE_INVALID',
        message: `Modulo single-spa per appName="${appName}" mfId="${mfId}" non ha lifecycle valido (richiesti bootstrap/mount/unmount come function o array of functions, PRD §27.4)`,
        microFrontendId: mfId,
        appName,
        details: {
          hasLifecycle: {
            bootstrap: obj !== null && isLifecycleEntry(obj['bootstrap']),
            mount: obj !== null && isLifecycleEntry(obj['mount']),
            unmount: obj !== null && isLifecycleEntry(obj['unmount']),
          },
          actualKeys: obj !== null && typeof obj === 'object' ? Object.keys(obj) : [],
        },
      })
    }

    // ===== Step 4: Wrappa lifecycle SS → GlueZero =====
    const lifecycle = createSsLifecycle(resolvedModule, ssDef, ctx)

    // ===== Step 5: Return LoadedModule =====
    const modAsRecord = resolvedModule as unknown as Record<string, unknown>
    return {
      module: resolvedModule,
      lifecycle,
      metadata: {
        appName,
        hasUpdate: typeof resolvedModule.update !== 'undefined',
        lifecycleArrayBootstrap: Array.isArray(modAsRecord['bootstrap']),
        lifecycleArrayMount: Array.isArray(modAsRecord['mount']),
        lifecycleArrayUnmount: Array.isArray(modAsRecord['unmount']),
      },
    }
  },
}

/**
 * Type re-export helper — `SingleSpaLifecycleFn` per testing/integration esterni.
 *
 * @internal Re-exported via index.ts barrel come type.
 */
export type { SingleSpaLifecycleFn }
