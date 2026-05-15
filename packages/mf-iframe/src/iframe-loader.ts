/**
 * `iframeLoader` — Factory loader concreto `MicroFrontendLoaderAdapter` con
 * `type: 'iframe'` + duck-typing `IframeAdapter.createSandbox` per F13 sblocco
 * (D-V2-F15-21 lockato — closure D-V2-09 BLOCKING T-15-01..10).
 *
 * ## Implementation completa W2 P03
 *
 *  1. **Validation** `expectedOrigin` MANDATORY + `url` non-empty.
 *  2. **Sandbox baseline** `'allow-scripts'` default + console.warn se override include
 *     `'allow-same-origin'` (REQ MF-SEC-01 + T-15-07 mitigation).
 *  3. **Iframe DOM creation** `document.createElement('iframe')` + sandbox apply + allow
 *     (Permissions Policy) optional.
 *  4. **Bridge handshake** `BridgeManager` istanza + `start()` + `await waitForReady(timeoutMs)`.
 *  5. **LoadedModule shape** `{module: iframe, lifecycle: createIframeLifecycle(...), metadata}`.
 *
 * ## F13 sblocco duck-typing (D-V2-F15-21)
 *
 * `iframeLoader()` ritorna oggetto compatibile sia con `MicroFrontendLoaderAdapter`
 * (`type='iframe'` + `load` + `unload`) sia con `IframeAdapter` F13 (`createSandbox`).
 * Quando consumer fa `isolationModule({resolvers: {iframeLoader: () => mfIframeAdapter}})`,
 * F13 `iframe-stub.ts:104-114` lookup `resolvers.iframeLoader?.()` ritorna l'adapter
 * con `createSandbox(policy, mfId, mount): void` → sblocca `IFRAME_ADAPTER_REQUIRED`
 * throw path.
 *
 * ## Shared module-level state
 *
 * `dedup` + `limiter` instance module-level shared per-process (NO Service Locator —
 * D-V2-F15-27). Coerente F9 mf-esm pattern (no Service Locator binding).
 *
 * @see D-V2-F15-01..04 — Security gates D-V2-09 closure
 * @see D-V2-F15-21 — IframeAdapter.createSandbox contract F13 sblocco
 * @see REQ MF-IFRAME-04 — expectedOrigin MANDATORY + targetOrigin '*' BANNED
 * @see REQ MF-SEC-01 — Sandbox baseline 'allow-scripts'
 * @see packages/isolation/src/iframe-stub.ts:41-47 (F13 IframeAdapter contract)
 */
import type {
  LoaderContext,
  LoadedModule,
  MicroFrontendLoaderAdapter,
  MicroFrontendLoaderDefinition,
  MicroFrontendRuntimeContext,
  MicroFrontendRuntimeModule,
} from '@gluezero/microfrontends'
import { BridgeManager } from './bridge'
import { createMfIframeError } from './errors'
import { DedupRegistry } from './lru-dedup'
import { validateExpectedOrigin } from './origin-validator'
import { RateLimiter } from './rate-limiter'
import type { IframeLoaderDefinition } from './types/descriptor'

/**
 * Default timeout `BridgeManager.waitForReady` (handshake gz:handshake → gz:ready).
 *
 * Allineato F9/F15 mf-wc D-V2-F9-01 baseline (PRD §23.4).
 */
const DEFAULT_BRIDGE_TIMEOUT_MS = 15000

/**
 * Sandbox baseline default (REQ MF-SEC-01).
 *
 * Solo `'allow-scripts'` — NO `'allow-same-origin'` default. Override consumer via
 * `definition.sandbox` esplicito; se include `allow-same-origin` → `console.warn`.
 */
const DEFAULT_SANDBOX = 'allow-scripts'

/**
 * Shared module-level DedupRegistry (per-process scope — coerente con bridge-shared state).
 *
 * @internal
 */
const sharedDedup = new DedupRegistry()

/**
 * Shared module-level RateLimiter (per-process scope — coerente con bridge-shared state).
 *
 * @internal
 */
const sharedLimiter = new RateLimiter()

/**
 * WeakMap per traccia iframe instance lato unmount lookup. Chiave =
 * `MicroFrontendRuntimeContext` (lifecycle mount riceve ctx, unmount riceve stesso ctx).
 *
 * @internal
 */
const MOUNTED_IFRAMES = new WeakMap<
  MicroFrontendRuntimeContext,
  { iframe: HTMLIFrameElement; bridge: BridgeManager }
>()

/**
 * Narrowing helper — cast `MicroFrontendLoaderDefinition` a `IframeLoaderDefinition`.
 *
 * @internal
 */
function narrow(definition: MicroFrontendLoaderDefinition): IframeLoaderDefinition {
  return definition as IframeLoaderDefinition
}

/**
 * Risolve sandbox token list — baseline `'allow-scripts'` se non override + warn su
 * `allow-same-origin` (REQ MF-SEC-01 + T-15-07).
 *
 * @internal
 */
function resolveSandbox(definition: IframeLoaderDefinition, mfId: string): string {
  const sandbox = definition.sandbox
  if (sandbox === undefined || sandbox === '') {
    return DEFAULT_SANDBOX
  }
  // Warn se consumer override include allow-same-origin (T-15-07 sandbox erosion)
  if (sandbox.includes('allow-same-origin')) {
    console.warn(
      `[mf-iframe] sandbox include 'allow-same-origin' per mfId='${mfId}' — erode containment (REQ MF-SEC-01). Considerare rimozione se non strict requirement.`,
    )
  }
  return sandbox
}

/**
 * Crea il `MicroFrontendRuntimeModule` lifecycle wrapper attorno al iframe + bridge.
 *
 * - `mount(ctx)`: track iframe+bridge nella WeakMap (DOM mount fisico è responsabilità
 *   del consumer/orchestrator F8 via `MicroFrontendMountDefinition.selector`).
 * - `unmount(ctx)`: lookup iframe → bridge.close() + iframe.remove() + cleanup dedup/limiter.
 *
 * @internal
 */
function createIframeLifecycle(
  iframe: HTMLIFrameElement,
  bridge: BridgeManager,
  mfId: string,
  expectedOrigin: string,
): MicroFrontendRuntimeModule {
  return {
    mount(ctx: MicroFrontendRuntimeContext): void {
      MOUNTED_IFRAMES.set(ctx, { iframe, bridge })
      // Container resolution è F8 orchestrator responsibility (MicroFrontendMountDefinition.selector)
    },
    unmount(ctx: MicroFrontendRuntimeContext): void {
      const tracked = MOUNTED_IFRAMES.get(ctx)
      if (tracked !== undefined) {
        tracked.bridge.close()
        tracked.iframe.remove()
        MOUNTED_IFRAMES.delete(ctx)
        sharedDedup.clearForMf(expectedOrigin, mfId)
        sharedLimiter.clearForMf(mfId)
      }
    },
    destroy(_ctx: MicroFrontendRuntimeContext): void {
      // Cleanup finale sync (idempotent — mount may have unmounted already)
      // Niente da fare se unmount già chiamato.
    },
  }
}

/**
 * `IframeAdapter` shape duck-typing F13 sblocco (D-V2-F15-21).
 *
 * Identico al contract `packages/isolation/src/iframe-stub.ts:41-47` (NO import diretto
 * — D-83 strict octuple, no diff `packages/isolation/src/`).
 */
export interface IframeAdapter {
  createSandbox(
    policy: { dom?: string; readonly [key: string]: unknown },
    mfId: string,
    mount: { element: HTMLElement; readonly [key: string]: unknown },
  ): void
}

/**
 * Combined return type — `MicroFrontendLoaderAdapter & IframeAdapter` duck-typing.
 */
type IframeLoaderAdapter = MicroFrontendLoaderAdapter & IframeAdapter

/**
 * Factory iframe loader — ritorna adapter compatibile sia con `MicroFrontendLoaderAdapter`
 * (F8 LoaderRegistry) sia con `IframeAdapter` F13 contract (sblocco F13 stub).
 *
 * @example Install
 * ```ts
 * import { createBroker } from '@gluezero/core'
 * import { microfrontendModule } from '@gluezero/microfrontends'
 * import { isolationModule } from '@gluezero/isolation'
 * import '@gluezero/mf-iframe/augment'
 * import { iframeLoader } from '@gluezero/mf-iframe'
 *
 * const adapter = iframeLoader() // factory call
 * const broker = createBroker({
 *   modules: [
 *     microfrontendModule(),
 *     isolationModule({ resolvers: { iframeLoader: () => adapter } }),
 *   ],
 * })
 * const service = broker.modules.get('@gluezero/microfrontends')
 * service.registerLoader(adapter)
 * ```
 *
 * @example Descriptor iframe
 * ```ts
 * await broker.registerMicroFrontend({
 *   id: 'analytics-iframe',
 *   name: 'Analytics (iframe)',
 *   version: '1.0.0',
 *   loader: {
 *     type: 'iframe',
 *     url: 'https://analytics.example.com/mf.html',
 *     expectedOrigin: 'https://analytics.example.com', // MANDATORY
 *     sandbox: 'allow-scripts allow-forms',             // override default
 *   } satisfies IframeLoaderDefinition,
 * })
 * ```
 *
 * @throws `MfIframeError` su validation fail (`MF_IFRAME_ORIGIN_MISMATCH` /
 *   `MF_IFRAME_BRIDGE_TIMEOUT`).
 */
export function iframeLoader(): IframeLoaderAdapter {
  return {
    type: 'iframe' as const,

    async load(
      definition: MicroFrontendLoaderDefinition,
      ctx: LoaderContext,
    ): Promise<LoadedModule> {
      const iframeDef = narrow(definition)
      const mfId = ctx.descriptor.id

      // ===== Step 1: Validation =====
      validateExpectedOrigin(iframeDef.expectedOrigin, mfId)

      if (!iframeDef.url || typeof iframeDef.url !== 'string') {
        throw createMfIframeError({
          code: 'MF_IFRAME_BRIDGE_TIMEOUT',
          message: `descriptor.loader.url mancante o non-string per type='iframe' mfId='${mfId}'`,
          microFrontendId: mfId,
          details: { url: String(iframeDef.url), reason: 'url field required' },
        })
      }

      // ===== Step 2: Sandbox baseline (REQ MF-SEC-01) =====
      const sandbox = resolveSandbox(iframeDef, mfId)

      // ===== Step 3: Iframe DOM creation =====
      const iframe = document.createElement('iframe')
      iframe.src = iframeDef.url
      // sandbox attribute (DOMTokenList in modern browsers, attribute string fallback)
      iframe.setAttribute('sandbox', sandbox)
      if (iframeDef.allow) {
        iframe.setAttribute('allow', iframeDef.allow)
      }

      // ===== Step 4: Bridge handshake (se bridge enabled, default true) =====
      const bridgeEnabled = iframeDef.bridge !== false
      let bridge: BridgeManager | undefined
      if (bridgeEnabled) {
        bridge = new BridgeManager({
          iframe,
          expectedOrigin: iframeDef.expectedOrigin,
          mfId,
          broker: ctx.broker,
          dedup: sharedDedup,
          limiter: sharedLimiter,
        })

        // Avvia handshake al load dell'iframe
        const timeoutMs =
          typeof iframeDef.timeoutMs === 'number' &&
          Number.isFinite(iframeDef.timeoutMs) &&
          iframeDef.timeoutMs > 0
            ? iframeDef.timeoutMs
            : DEFAULT_BRIDGE_TIMEOUT_MS

        // Setup waitForReady promise PRIMA del start (race-safety se gz:ready arriva early).
        const readyPromise = bridge.waitForReady(timeoutMs)
        bridge.start()
        // Nota: in scenari reali production il consumer monta iframe nel DOM dopo `load()`;
        // qui restituiamo bridge + iframe pronto. Test Tier-1 jsdom NON aspetta readyPromise
        // (iframe.src non triggera load in jsdom senza DOM mount + network) — usa
        // `bridge: false` per skip handshake oppure test mockano postMessage.
        // Default behavior: aspettiamo readyPromise come da PLAN step 6.
        await readyPromise.catch((err: Error) => {
          // Cleanup parziale se handshake fail
          bridge?.close()
          throw err
        })
      }

      // ===== Step 5: LoadedModule =====
      return {
        module: iframe,
        lifecycle: bridge !== undefined
          ? createIframeLifecycle(iframe, bridge, mfId, iframeDef.expectedOrigin)
          : {
              mount(ctx: MicroFrontendRuntimeContext): void {
                MOUNTED_IFRAMES.set(ctx, { iframe, bridge: undefined as unknown as BridgeManager })
              },
              unmount(ctx: MicroFrontendRuntimeContext): void {
                const tracked = MOUNTED_IFRAMES.get(ctx)
                if (tracked !== undefined) {
                  tracked.iframe.remove()
                  MOUNTED_IFRAMES.delete(ctx)
                }
              },
            },
        metadata: {
          url: iframeDef.url,
          expectedOrigin: iframeDef.expectedOrigin,
          sandbox,
          bridge: bridgeEnabled,
          allow: iframeDef.allow,
        },
      }
    },

    async unload(loaded: LoadedModule, ctx: LoaderContext): Promise<void> {
      // Cleanup deferred al lifecycle.unmount (chiamato da F8 orchestrator FSM unmount step).
      // Qui no-op idempotent — segnala fine lifecycle.
      const _ = { loaded, ctx } // anti-unused-warning
      void _
    },

    /**
     * `createSandbox(policy, mfId, mount)` — F13 IframeAdapter contract duck-typing
     * sblocco (D-V2-F15-21).
     *
     * F13 `iframe-stub.ts:95-127` chiama `loader.createSandbox(policy, mfId, mount)`
     * quando `policy.dom === 'iframe'`. F15 risponde costruendo iframe DOM + applicando
     * sandbox da policy + sostituendo `mount.element` (Strategy A mutation cast analog
     * a shadow-dom F13).
     *
     * NO bridge auto-start qui — `createSandbox` è isolation-only; bridge è separato
     * lifecycle load path (chiamato esplicito tramite `load()`).
     */
    createSandbox(
      policy: { dom?: string; readonly [key: string]: unknown },
      mfId: string,
      mount: { element: HTMLElement; readonly [key: string]: unknown },
    ): void {
      // Costruisce iframe sandbox da policy (default 'allow-scripts' se policy non lo definisce)
      const sandboxAttr = typeof policy['sandbox'] === 'string'
        ? (policy['sandbox'] as string)
        : DEFAULT_SANDBOX
      const iframe = document.createElement('iframe')
      iframe.setAttribute('sandbox', sandboxAttr)
      iframe.setAttribute('data-gz-mf-id', mfId)
      // Strategy A mutation cast — sostituisce mount.element con iframe.
      // Coerente con F13 shadow-dom pattern. Caller (iframe-stub.ts) responsabile per
      // DOM placement; qui produciamo iframe pronto.
      const mutable = mount as { element: HTMLElement }
      mutable.element = iframe as unknown as HTMLElement
    },
  }
}
