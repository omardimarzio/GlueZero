/**
 * `webComponentLoader` — Loader concreto `MicroFrontendLoaderAdapter` con
 * `type: 'web-component'` (F15 P02 implementation completa W2).
 *
 * Implementa il loader Web Component (Custom Elements) ESM-only per micro-frontends
 * GlueZero v2.0. Flow:
 *
 * 1. **Validate** `definition.url` (string non-empty) + `definition.elementName`
 *    (string contenente `-` — spec WHATWG custom element name requirement).
 * 2. **Validate** `definition.contextMode` ∈ `{'property','attribute','event'}` (default
 *    `'property'` D-V2-F15-05) + `definition.timeoutMs` (default 15000 ms D-V2-F15-06).
 * 3. **Reuse-on-collision pre-check** (D-V2-F15-08): se `customElements.get(elementName)`
 *    ritorna già una classe → `console.warn` + return reused klass + `metadata.reused: true`.
 *    NO throw (warning-level — supporta multi-mount stesso MF + shared design system
 *    primitives cross-MF).
 * 4. **ESM import** (D-V2-F15-07 carryover F9): `import(url, {signal: composite})`
 *    con `combineSignals(ctx.signal, AbortSignal.timeout(timeoutMs))`. Side-effect
 *    `customElements.define(elementName, klass)` esegue durante module evaluation.
 *    Network/parse error → `MF_WC_SCRIPT_LOAD_FAILED` con `originalError`.
 * 5. **whenDefined race** (D-V2-F15-06): `awaitDefined(elementName, ctx.signal, timeoutMs)`.
 *    Step happy-path risolve immediato (step 4 ha già fatto `define`); race protegge
 *    da moduli che NON registrano l'element (timeout → `MF_WC_DEFINE_TIMEOUT`).
 * 6. **Ritorna** `LoadedModule` con `module: klass` + `lifecycle` wrapper (`mount`
 *    crea l'element e applica `contextMode` dispatch, `unmount` rimuove).
 *
 * **Composition pure** (D-V2-F15-27): zero Service Locator binding + zero subscribe
 * broker topics. Registrazione consumer-side via `service.registerLoader(webComponentLoader)`.
 *
 * @see PRD §22 (Loader Registry API), §25 (Web Component Loader)
 * @see D-V2-F15-05/06/07/08 — WC loader API + timing decisions
 * @see packages/mf-esm/src/esm-loader.ts (F9 template diretto carryover)
 */
import type {
  LoadedModule,
  LoaderContext,
  MicroFrontendLoaderAdapter,
  MicroFrontendLoaderDefinition,
  MicroFrontendRuntimeContext,
  MicroFrontendRuntimeModule,
} from '@gluezero/microfrontends'
import { applyContext, type ContextMode } from './context-dispatch'
import { createMfWebComponentError } from './errors'
import { combineSignals } from './internal/combine-signals'
import { abortPromise } from './internal/abort-promise'
import type { WebComponentLoaderDefinition } from './types/descriptor'
import { awaitDefined } from './whenDefined-await'

/**
 * Default timeout `import(url)` + `customElements.whenDefined` (D-V2-F15-06 +
 * carryover F9 D-V2-F9-01 — PRD §23.4 baseline).
 */
const DEFAULT_TIMEOUT_MS = 15000

/**
 * Custom element name regex — kebab-case + almeno un `-` (spec WHATWG semplificato).
 * Validation register-time per evitare `DOMException SyntaxError` in
 * `customElements.define()`.
 */
const ELEMENT_NAME_RE = /^[a-z][a-z0-9._-]*-[a-z0-9._-]*$/

/**
 * WeakMap per traccia element instance lato unmount lookup. Chiave =
 * `MicroFrontendRuntimeContext` (lifecycle `mount` riceve `ctx`, `unmount` riceve
 * stesso `ctx` → garantito reference identity). Value = `HTMLElement` montato.
 */
const MOUNTED_ELEMENTS = new WeakMap<MicroFrontendRuntimeContext, HTMLElement>()

/**
 * Valid contextMode set per validation O(1).
 * @internal
 */
const VALID_CONTEXT_MODES: ReadonlySet<ContextMode> = new Set(['property', 'attribute', 'event'])

/**
 * Crea il `MicroFrontendRuntimeModule` lifecycle wrapper attorno alla
 * `CustomElementConstructor`.
 *
 * - `mount(ctx)`: `document.createElement(elementName)` + `applyContext(el, ctx.context, mode)`
 *   + (TODO consumer can override via `definition.mountAdapter`) → append a container risolto
 *   da `ctx`. Track element nella `MOUNTED_ELEMENTS` WeakMap.
 * - `unmount(ctx)`: lookup element via WeakMap → `element.remove()`.
 *
 * Lifecycle minimo F9 compliant (D-V2-F9-06 — `mount` obbligatorio). `bootstrap` /
 * `update` / `destroy` omessi (no setup-once specifico per WC; element già mountato
 * via `mount`).
 *
 * @internal Helper privato — esposto solo via `LoadedModule.lifecycle`.
 */
function createLifecycleWrapper(
  _klass: CustomElementConstructor,
  elementName: string,
  contextMode: ContextMode,
): MicroFrontendRuntimeModule {
  return {
    mount(ctx: MicroFrontendRuntimeContext): void {
      const element = document.createElement(elementName) as HTMLElement
      // Propaga RuntimeContext via mode dispatcher.
      // `ctx.context` placeholder F10 (`unknown`) — il custom element interpreta lato consumer.
      applyContext(element, ctx.context, contextMode)
      MOUNTED_ELEMENTS.set(ctx, element)
      // NOTA: F15 P02 NON gestisce container resolution (responsability `microfrontends`
      // orchestrate via `MicroFrontendMountDefinition.selector`). Il consumer custom
      // mount adapter può ricevere `element` via lifecycle alternative — qui produciamo
      // semplicemente l'element pronto.
    },
    unmount(ctx: MicroFrontendRuntimeContext): void {
      const element = MOUNTED_ELEMENTS.get(ctx)
      if (element) {
        element.remove()
        MOUNTED_ELEMENTS.delete(ctx)
      }
    },
  }
}

/**
 * Estrae i field WC-specific da `MicroFrontendLoaderDefinition` con narrowing.
 *
 * @internal
 */
function narrow(definition: MicroFrontendLoaderDefinition): WebComponentLoaderDefinition {
  return definition as WebComponentLoaderDefinition
}

/**
 * Loader concreto `MicroFrontendLoaderAdapter` con `type: 'web-component'`
 * (D-V2-F15-05..08 implementation lockata).
 *
 * @example Registrazione consumer-side
 * ```ts
 * import { createBroker } from '@gluezero/core'
 * import { microfrontendModule } from '@gluezero/microfrontends'
 * import { webComponentLoader } from '@gluezero/mf-web-component'
 * import '@gluezero/mf-web-component/augment'
 *
 * const broker = createBroker({ modules: [microfrontendModule()] })
 * const service = broker.modules.get('@gluezero/microfrontends')
 * service.registerLoader(webComponentLoader)
 * ```
 *
 * @example Descriptor minimo
 * ```ts
 * await broker.registerMicroFrontend({
 *   id: 'dashboard',
 *   name: 'Dashboard',
 *   version: '1.0.0',
 *   loader: {
 *     type: 'web-component',
 *     url: 'https://cdn.example/mf-dashboard.js',
 *     elementName: 'mf-dashboard', // kebab-case mandatory
 *   },
 * })
 * ```
 *
 * @example Descriptor con contextMode + timeoutMs override
 * ```ts
 * await broker.registerMicroFrontend({
 *   id: 'analytics',
 *   name: 'Analytics',
 *   version: '2.1.0',
 *   loader: {
 *     type: 'web-component',
 *     url: '/mfs/analytics.js',
 *     elementName: 'mf-analytics',
 *     contextMode: 'attribute', // override default 'property'
 *     timeoutMs: 5000,
 *   },
 * })
 * ```
 *
 * @example Reuse-on-collision (D-V2-F15-08)
 * ```ts
 * // 1° MF registra mf-button via define
 * await broker.loadMicroFrontend('mf-a-with-button')
 * // 2° MF dichiara stesso elementName → reuse + console.warn
 * await broker.loadMicroFrontend('mf-b-with-button')
 * // console.warn: [mf-wc] custom element 'mf-button' already defined — reusing existing registration for mfId=mf-b-with-button
 * ```
 *
 * @throws `MfWebComponentError` con `code: 'MF_WC_SCRIPT_LOAD_FAILED'` se `url` /
 *   `elementName` invalid o `import()` rejects.
 * @throws `MfWebComponentError` con `code: 'MF_WC_DEFINE_TIMEOUT'` se
 *   `customElements.whenDefined` non risolve entro `timeoutMs`.
 * @throws `MfWebComponentError` con `code: 'MF_WC_CONTEXT_MODE_INVALID'` se
 *   `contextMode` non in `{'property','attribute','event'}`.
 *
 * @see D-V2-F15-05 (default contextMode property)
 * @see D-V2-F15-06 (whenDefined + AbortSignal.timeout)
 * @see D-V2-F15-07 (ESM-only via import(url))
 * @see D-V2-F15-08 (reuse-on-collision warning)
 */
export const webComponentLoader: MicroFrontendLoaderAdapter = {
  type: 'web-component',
  async load(
    definition: MicroFrontendLoaderDefinition,
    ctx: LoaderContext,
  ): Promise<LoadedModule> {
    const wcDef = narrow(definition)
    const url = wcDef.url
    const elementName = wcDef.elementName

    // ===== Step 1-2: Validation =====
    if (!url || typeof url !== 'string') {
      throw createMfWebComponentError({
        code: 'MF_WC_SCRIPT_LOAD_FAILED',
        message: 'descriptor.loader.url mancante o non-string per type "web-component"',
        microFrontendId: ctx.descriptor.id,
        details: { url: String(url), reason: 'url field required' },
      })
    }
    if (!elementName || typeof elementName !== 'string' || !ELEMENT_NAME_RE.test(elementName)) {
      throw createMfWebComponentError({
        code: 'MF_WC_SCRIPT_LOAD_FAILED',
        message: `descriptor.loader.elementName mancante o non valido ("${String(elementName)}") — custom elements require kebab-case con almeno un "-" (WHATWG spec)`,
        microFrontendId: ctx.descriptor.id,
        details: { elementName: String(elementName), reason: 'invalid custom element name' },
      })
    }

    const contextMode: ContextMode = wcDef.contextMode ?? 'property'
    if (!VALID_CONTEXT_MODES.has(contextMode)) {
      throw createMfWebComponentError({
        code: 'MF_WC_CONTEXT_MODE_INVALID',
        message: `contextMode "${String(contextMode)}" non valido (atteso: 'property' | 'attribute' | 'event')`,
        microFrontendId: ctx.descriptor.id,
        details: { contextMode: String(contextMode), elementName },
      })
    }

    const timeoutMs =
      typeof wcDef.timeoutMs === 'number' && Number.isFinite(wcDef.timeoutMs) && wcDef.timeoutMs > 0
        ? wcDef.timeoutMs
        : DEFAULT_TIMEOUT_MS

    // ===== Step 3: Reuse-on-collision pre-check (D-V2-F15-08) =====
    const existing = customElements.get(elementName)
    if (existing) {
      console.warn(
        `[mf-wc] custom element '${elementName}' already defined — reusing existing registration for mfId=${ctx.descriptor.id}`,
      )
      return {
        module: existing,
        lifecycle: createLifecycleWrapper(existing, elementName, contextMode),
        metadata: {
          elementName,
          contextMode,
          timeoutMs,
          reused: true,
          url,
        },
      }
    }

    // ===== Step 4: ESM import (D-V2-F15-07 carryover F9) =====
    const startedAt =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now()
    const timeoutSignal = AbortSignal.timeout(timeoutMs)
    const composite = combineSignals(ctx.signal, timeoutSignal)

    try {
      // `/* @vite-ignore */` sopprime warning Vite static analysis su dynamic import (carryover F9).
      await Promise.race([import(/* @vite-ignore */ url), abortPromise(composite)])
    } catch (err) {
      // Discriminate timeout vs consumer abort vs import rejection.
      if (composite.aborted) {
        const reason = composite.reason as { name?: string } | undefined
        const isTimeout = reason !== undefined && reason.name === 'TimeoutError'
        const elapsedMs =
          (typeof performance !== 'undefined' && typeof performance.now === 'function'
            ? performance.now()
            : Date.now()) - startedAt
        if (isTimeout) {
          throw createMfWebComponentError({
            code: 'MF_WC_SCRIPT_LOAD_FAILED',
            message: `import("${url}") timeout dopo ${timeoutMs} ms (elapsed ${elapsedMs.toFixed(0)} ms) per elementName "${elementName}"`,
            microFrontendId: ctx.descriptor.id,
            details: { url, elementName, timeoutMs, elapsedMs, reason: 'import timeout' },
          })
        }
        throw createMfWebComponentError({
          code: 'MF_WC_SCRIPT_LOAD_FAILED',
          message: `import("${url}") aborted via consumer signal per elementName "${elementName}"`,
          microFrontendId: ctx.descriptor.id,
          details: { url, elementName, reason: 'consumer abort' },
        })
      }
      // Network/parse/CSP error da import() → wrap come MF_WC_SCRIPT_LOAD_FAILED.
      throw createMfWebComponentError({
        code: 'MF_WC_SCRIPT_LOAD_FAILED',
        message: `Errore caricamento "${url}" per elementName "${elementName}": ${err instanceof Error ? err.message : String(err)}`,
        microFrontendId: ctx.descriptor.id,
        details: { url, elementName, reason: 'import() rejected (network/parse/CSP)' },
        ...(err instanceof Error && { originalError: err }),
      })
    }

    // ===== Step 5: whenDefined race (D-V2-F15-06) =====
    // Happy path: step 4 ha già fatto customElements.define() side-effect → whenDefined
    // risolve immediato. Race protegge da moduli che NON registrano l'element.
    const klass = await awaitDefined(elementName, ctx.signal, timeoutMs)

    // ===== Step 6: Ritorna LoadedModule =====
    return {
      module: klass,
      lifecycle: createLifecycleWrapper(klass, elementName, contextMode),
      metadata: {
        elementName,
        contextMode,
        timeoutMs,
        reused: false,
        url,
      },
    }
  },
}
