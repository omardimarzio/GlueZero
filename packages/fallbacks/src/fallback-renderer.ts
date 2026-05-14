/**
 * `dispatchFallback` — Dispatcher discriminated union 5-mode per `FallbackDefinition.type`.
 *
 * Pattern Rule 3 (no analog stretto — derivato PRD §29.3 discriminated union).
 *
 * Orchestrazione:
 * 1. Switch `definition.type` → renderer mode appropriato.
 * 2. Emit unificato `microfrontend.fallback.rendered` (F8 governance topic riuso —
 *    `MF_GOVERNANCE_TOPICS[4]` D-V2-F14-02) con payload uniform per devtools F16
 *    SnapshotProvider observability.
 *
 * 5 modes:
 * - `'html'`: target chain mountElement → querySelector → null+warn via renderers/html.ts.
 * - `'component'`: target HTMLElement non-null → SERVICE_FRAMEWORK_ADAPTER delega F15 o
 *   stub HTML generic via renderers/component.ts. Target risolto qui pre-renderer
 *   (mountElement priority, fallback querySelector).
 * - `'event'`: broker.publish(definition.topic ?? FALLBACK_EVENT_DEFAULT_TOPIC, payload)
 *   via renderers/event.ts.
 * - `'custom'`: await handler(error, ctx) async + try/catch via renderers/custom.ts.
 *   handler undefined → console.warn + fallbackType:'custom-failed' (defensive).
 * - `'none'`: no-op + emit observability fallbackType:'none'.
 *
 * Emit unificato:
 * - Topic: `FALLBACK_RENDERED_TOPIC = 'microfrontend.fallback.rendered'` (F8 governance riuso).
 * - Payload: `{microFrontendId, lifecyclePhase, fallbackType, timestamp}`.
 * - Opts: source descriptor F1 D-23 + `deliveryMode:'sync'`.
 *
 * @see D-V2-F14-02 — F8 governance topic riuso emit
 * @see prd_2.0.0.md §29.3 — FallbackDefinition discriminated union 5-mode
 */
import type { Broker } from '@gluezero/core'
import type { FallbackDefinition } from './types/policy.js'
import type { MicroFrontendErrorLifecyclePhase } from './types/errors.js'
import type { MicroFrontendError } from './microfrontend-error.js'
import { FALLBACK_RENDERED_TOPIC } from './topics.js'
import { renderHtmlFallback } from './renderers/html.js'
import { renderComponentFallback } from './renderers/component.js'
import { renderEventFallback } from './renderers/event.js'
import { renderCustomFallback } from './renderers/custom.js'

/**
 * Source descriptor F1 D-23 obbligatorio + `deliveryMode:'sync'` per consistency
 * con governance topics F8.
 */
const PUBLISH_OPTS = {
  source: { type: 'plugin' as const, id: 'fallbacks', name: '@gluezero/fallbacks' },
  deliveryMode: 'sync' as const,
}

/**
 * Union discriminator dei `fallbackType` possibili nel `microfrontend.fallback.rendered`
 * emit payload (F8 governance observability).
 */
export type FallbackType =
  | 'html'
  | 'html-skipped'
  | 'component'
  | 'component-stub'
  | 'event'
  | 'custom'
  | 'custom-failed'
  | 'none'

/**
 * Risultato di `dispatchFallback` — usato da `fallbacksModule` orchestrator per
 * tracking applied/skipped state + reason.
 */
export interface RenderResult {
  readonly applied: boolean
  readonly fallbackType: FallbackType
  readonly reason?: string
}

/**
 * Argomenti per `dispatchFallback`. Caller fallbacksModule orchestrator passa
 * mountElement + selector estratti da `reg.mount?.element` / `descriptor.mount?.selector`.
 */
export interface DispatchArgs {
  readonly broker: Broker
  readonly mfId: string
  readonly phase: MicroFrontendErrorLifecyclePhase
  readonly error: MicroFrontendError | { readonly message: string; readonly code?: string }
  readonly definition: FallbackDefinition
  readonly mountElement?: HTMLElement | ShadowRoot
  readonly selector?: string
  readonly ctx?: unknown
}

/**
 * Dispatcher async — discrimina su `definition.type` + emit unificato.
 *
 * @example Wire da orchestratorChain (W2 P04 fallbacksModule.install)
 * ```ts
 * const result = await dispatchFallback({
 *   broker, mfId, phase: 'load', error, definition: policy.onLoadError!,
 *   mountElement: reg.mount?.element as HTMLElement | undefined,
 *   selector: reg.descriptor.mount?.selector,
 *   ctx: runtimeContext,
 * })
 * ```
 *
 * @param args Vedi {@link DispatchArgs}.
 * @returns Promise<RenderResult>. Async perché custom handler può essere Promise.
 */
export async function dispatchFallback(args: DispatchArgs): Promise<RenderResult> {
  let result: RenderResult
  switch (args.definition.type) {
    case 'html': {
      result = renderHtmlFallback(
        args.broker,
        args.mfId,
        args.mountElement,
        args.selector,
        args.definition.html ?? '',
      )
      break
    }
    case 'component': {
      // Component renderer richiede target HTMLElement non-null
      const candidate =
        args.mountElement ??
        (typeof document !== 'undefined' && typeof args.selector === 'string'
          ? (document.querySelector<HTMLElement>(args.selector) ?? undefined)
          : undefined)
      // shadowRoot non valid target per component (F15 adapter atteso HTMLElement)
      const target =
        candidate !== undefined && candidate instanceof HTMLElement ? candidate : undefined
      if (target === undefined) {
        // biome-ignore lint/suspicious/noConsole: dev warning intentional (no target)
        console.warn(
          `[fallbacks] component fallback requires mount target for mfId="${args.mfId}" — skipped`,
        )
        result = {
          applied: false,
          fallbackType: 'component-stub',
          reason: 'target-not-found',
        }
      } else {
        result = renderComponentFallback(
          args.broker,
          args.mfId,
          target,
          args.definition.component,
          args.error as MicroFrontendError,
        )
      }
      break
    }
    case 'event': {
      result = renderEventFallback(
        args.broker,
        args.mfId,
        args.phase,
        args.error,
        args.definition,
      )
      break
    }
    case 'custom': {
      if (typeof args.definition.handler !== 'function') {
        // biome-ignore lint/suspicious/noConsole: dev warning intentional (handler missing)
        console.warn(
          `[fallbacks] custom fallback handler missing for mfId="${args.mfId}"`,
        )
        result = {
          applied: false,
          fallbackType: 'custom-failed',
          reason: 'handler-missing',
        }
      } else {
        result = await renderCustomFallback(
          args.definition.handler as (err: unknown, ctx: unknown) => void | Promise<void>,
          args.error as MicroFrontendError,
          args.ctx,
        )
      }
      break
    }
    case 'none': {
      result = { applied: true, fallbackType: 'none' }
      break
    }
    default: {
      // Defensive: discriminated union exhaustive — type unknown shouldn't reach here
      result = { applied: false, fallbackType: 'none', reason: 'unknown-type' }
    }
  }

  // Emit unificato D-V2-F14-02 — F8 governance topic riuso
  args.broker.publish(
    FALLBACK_RENDERED_TOPIC,
    {
      microFrontendId: args.mfId,
      lifecyclePhase: args.phase,
      fallbackType: result.fallbackType,
      timestamp: Date.now(),
    },
    PUBLISH_OPTS,
  )

  return result
}
