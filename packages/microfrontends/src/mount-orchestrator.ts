/**
 * Mount Orchestrator (MF-MOUNT-01, MF-MOUNT-02, MF-MOUNT-03).
 *
 * Coordina le 4 mount strategies. F8 implementa REALMENTE `direct`; gli altri 3
 * (`shadow-dom` / `iframe` / `custom`) sono stub con throw rilevante perché richiedono:
 * - `shadow-dom`: `@gluezero/isolation` (F13)
 * - `iframe`: `@gluezero/mf-iframe` (F15)
 * - `custom`: consumer-provided implementation (V2.1)
 *
 * Selector resolution (MF-MOUNT-02):
 * - `definition.element` (HTMLElement reference) PREVALE su `definition.selector`
 * - Altrimenti `document.querySelector(definition.selector)`
 * - Nessuno dei due → throw `MF_MOUNT_TARGET_NOT_FOUND`
 *
 * Threat mitigations (08-08 PLAN §threat_model):
 * - T-F8-04 accept: cleanup DOM su unmount è responsabilità del consumer/loader hook
 *   (`preserveOnUnmount: true` consente skip esplicito). Mount orchestrator scope =
 *   solo mount-time setup.
 * - T-F8-05 mitigate: stub strategies fail-fast con error message specifica package.
 * - T-F8-07 accept: CSS selector invalid → DOMException propagata al consumer.
 *
 * @see RESEARCH §13.W4 + PATTERNS §35 + PRD §11.2 + PRD §14
 */
import type { LoadedModule } from './loader-registry'
import { createMfError } from './microfrontend-error'
import type { MicroFrontendMountDefinition, MountStrategy } from './types/mount'
import type { MicroFrontendRuntimeContext } from './types/runtime-context'

/** Risultato del mount orchestrator — descrive dove e con che strategy il MF è montato. */
export interface MountResult {
  /** Container DOM element dove il MF è stato montato. */
  readonly container: HTMLElement
  /** Strategy applicata. */
  readonly strategy: MountStrategy
  /** Eventuale Shadow Root (solo strategy 'shadow-dom' — F13). */
  readonly shadowRoot?: ShadowRoot
  /** Eventuale iframe element (solo strategy 'iframe' — F15). */
  readonly iframe?: HTMLIFrameElement
}

/**
 * Esegue il mount del MF nel DOM secondo la strategy specificata.
 *
 * @param definition - Mount definition (selector o element + strategy + opzioni)
 * @param loaded - Modulo MF caricato (contiene `lifecycle` hooks)
 * @param ctx - Runtime context del MF (per logger, broker, signal, id)
 * @returns Risultato mount con container + eventuali Shadow Root / iframe
 *
 * @throws `MF_MOUNT_TARGET_NOT_FOUND` se né `element` né `selector` forniti,
 *   se `selector` non risolve, se `element` non è un HTMLElement valido, oppure
 *   se la strategy stubbed (shadow-dom richiede F13, iframe richiede F15,
 *   custom richiede V2.1).
 *
 * @example
 * ```ts
 * import { orchestrateMount } from '@gluezero/microfrontends'
 *
 * const result = await orchestrateMount(
 *   { strategy: 'direct', selector: '#app-root', clearBeforeMount: true },
 *   loadedModule,
 *   runtimeCtx,
 * )
 * console.log(result.container) // HTMLElement target
 * ```
 */
export async function orchestrateMount(
  definition: MicroFrontendMountDefinition,
  loaded: LoadedModule,
  ctx: MicroFrontendRuntimeContext,
): Promise<MountResult> {
  const strategy: MountStrategy = definition.strategy ?? 'direct'

  // Resolve target container — `element` prevale (MF-MOUNT-02).
  const target = resolveTarget(definition, strategy, ctx.id)

  switch (strategy) {
    case 'direct':
      return mountDirect(target, definition, loaded, ctx)
    case 'shadow-dom':
      return mountShadowDom(target, definition, loaded, ctx)
    case 'iframe':
      return mountIframe(target, definition, loaded, ctx)
    case 'custom':
      return mountCustom(target, definition, loaded, ctx)
    default: {
      // Exhaustive check — TypeScript cattura case mancanti a compile-time.
      const _exhaustive: never = strategy
      throw createMfError({
        code: 'MF_MOUNT_TARGET_NOT_FOUND',
        message: `Unknown mount strategy: ${String(_exhaustive)}`,
        details: { strategy: String(_exhaustive) },
      })
    }
  }
}

/**
 * Resolve del target container (MF-MOUNT-02).
 *
 * Precedenza:
 * 1. `definition.element` (HTMLElement reference diretto) prevale
 * 2. `definition.selector` via `document.querySelector`
 * 3. Nessuno dei due → throw `MF_MOUNT_TARGET_NOT_FOUND`
 */
function resolveTarget(
  definition: MicroFrontendMountDefinition,
  strategy: MountStrategy,
  mfId: string,
): HTMLElement {
  // 1. Element diretto prevale.
  if (definition.element !== undefined) {
    const el = definition.element
    if (isHTMLElement(el)) return el
    throw createMfError({
      code: 'MF_MOUNT_TARGET_NOT_FOUND',
      message: `definition.element is not a valid HTMLElement for MF "${mfId}"`,
      details: { mfId, strategy, providedType: typeof el },
    })
  }

  // 2. Selector lookup via document.querySelector.
  if (definition.selector !== undefined) {
    if (typeof document === 'undefined') {
      throw createMfError({
        code: 'MF_MOUNT_TARGET_NOT_FOUND',
        message: `Cannot resolve selector "${definition.selector}" — no document available`,
        details: { mfId, selector: definition.selector, strategy },
      })
    }
    const found = document.querySelector(definition.selector)
    if (!found) {
      throw createMfError({
        code: 'MF_MOUNT_TARGET_NOT_FOUND',
        message: `Selector "${definition.selector}" not found in DOM for MF "${mfId}"`,
        details: { mfId, selector: definition.selector, strategy },
      })
    }
    if (!isHTMLElement(found)) {
      throw createMfError({
        code: 'MF_MOUNT_TARGET_NOT_FOUND',
        message: `Selector "${definition.selector}" resolved to non-HTMLElement node`,
        details: {
          mfId,
          selector: definition.selector,
          strategy,
          nodeType: found.nodeType,
        },
      })
    }
    return found
  }

  // 3. Né element né selector.
  throw createMfError({
    code: 'MF_MOUNT_TARGET_NOT_FOUND',
    message: `MicroFrontend "${mfId}" mount definition has neither 'selector' nor 'element'`,
    details: { mfId, strategy },
  })
}

/** Type guard isomorfo HTMLElement (browser + jsdom). */
function isHTMLElement(x: unknown): x is HTMLElement {
  return typeof HTMLElement !== 'undefined' && x instanceof HTMLElement
}

// ===== Strategy: direct (REAL impl F8) =====

async function mountDirect(
  target: HTMLElement,
  definition: MicroFrontendMountDefinition,
  loaded: LoadedModule,
  ctx: MicroFrontendRuntimeContext,
): Promise<MountResult> {
  // clearBeforeMount: rimuovi children container pre-mount (no innerHTML='' per evitare
  // edge-case parsing HTML in alcuni engine; firstChild loop è semanticamente identico).
  if (definition.clearBeforeMount === true) {
    while (target.firstChild) {
      target.removeChild(target.firstChild)
    }
  }

  // Container ID configurabile (consumer-driven).
  if (definition.containerId) {
    target.id = definition.containerId
  }

  // Apply attributes (consumer-controlled, no sanitization in F8 — selector is data).
  if (definition.attributes) {
    for (const [key, value] of Object.entries(definition.attributes)) {
      target.setAttribute(key, value)
    }
  }

  // Apply className additivo (NOT replace — preserva pattern v1.x className compose).
  if (definition.className) {
    target.classList.add(...definition.className.split(/\s+/).filter(Boolean))
  }

  // Apply inline style.
  if (definition.style) {
    for (const [prop, value] of Object.entries(definition.style)) {
      ;(target.style as unknown as Record<string, string>)[prop] = value
    }
  }

  // Invoke lifecycle.mount hook se presente. Il loader gestisce il DOM internamente —
  // F8 orchestrator garantisce solo il container setup. Full wiring di `mount.target`
  // nel runtime context è deferito a W5-P11 (D-V2-F8-13 pipeline §28 ext).
  await loaded.lifecycle.mount?.(ctx)

  return {
    container: target,
    strategy: 'direct',
  }
}

// ===== Strategy: shadow-dom (STUB F8 — F13 isolation) =====

async function mountShadowDom(
  _target: HTMLElement,
  _definition: MicroFrontendMountDefinition,
  _loaded: LoadedModule,
  ctx: MicroFrontendRuntimeContext,
): Promise<MountResult> {
  throw createMfError({
    code: 'MF_MOUNT_TARGET_NOT_FOUND',
    message: `Mount strategy 'shadow-dom' requires @gluezero/isolation module (F13). MF: ${ctx.id}`,
    details: {
      mfId: ctx.id,
      strategy: 'shadow-dom',
      requiredPackage: '@gluezero/isolation',
      availableFromPhase: 'F13',
    },
  })
}

// ===== Strategy: iframe (STUB F8 — F15 mf-iframe) =====

async function mountIframe(
  _target: HTMLElement,
  _definition: MicroFrontendMountDefinition,
  _loaded: LoadedModule,
  ctx: MicroFrontendRuntimeContext,
): Promise<MountResult> {
  throw createMfError({
    code: 'MF_MOUNT_TARGET_NOT_FOUND',
    message: `Mount strategy 'iframe' requires @gluezero/mf-iframe module (F15). MF: ${ctx.id}`,
    details: {
      mfId: ctx.id,
      strategy: 'iframe',
      requiredPackage: '@gluezero/mf-iframe',
      availableFromPhase: 'F15',
    },
  })
}

// ===== Strategy: custom (STUB F8 — V2.1) =====

async function mountCustom(
  _target: HTMLElement,
  _definition: MicroFrontendMountDefinition,
  _loaded: LoadedModule,
  ctx: MicroFrontendRuntimeContext,
): Promise<MountResult> {
  throw createMfError({
    code: 'MF_MOUNT_TARGET_NOT_FOUND',
    message: `Mount strategy 'custom' requires consumer-provided implementation. Deferred to V2.1 design. MF: ${ctx.id}`,
    details: {
      mfId: ctx.id,
      strategy: 'custom',
      availableFromVersion: 'V2.1',
    },
  })
}
