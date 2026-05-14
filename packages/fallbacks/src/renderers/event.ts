/**
 * Event fallback renderer (D-V2-F14-03 + D-V2-F14-15).
 *
 * `broker.publish(definition.topic ?? FALLBACK_EVENT_DEFAULT_TOPIC, payload)` con
 * source descriptor F1 D-23 obbligatorio + `deliveryMode:'sync'`.
 *
 * Payload include `fallbackApplied:true` carryover marker PRD §31.5.
 *
 * @see D-V2-F14-03 — Topic default `microfrontend.fallback.event`
 * @see D-V2-F14-15 — Event publish renderer
 */
import type { Broker } from '@gluezero/core'
import type { FallbackDefinition } from '../types/policy.js'
import type { MicroFrontendErrorLifecyclePhase } from '../types/errors.js'
import { FALLBACK_EVENT_DEFAULT_TOPIC } from '../topics.js'

/**
 * Source descriptor F1 D-23 obbligatorio (anti-spoof) + `deliveryMode:'sync'` per
 * consistency con governance topics F8.
 */
const PUBLISH_OPTS = {
  source: { type: 'plugin' as const, id: 'fallbacks', name: '@gluezero/fallbacks' },
  deliveryMode: 'sync' as const,
}

export interface EventRenderResult {
  readonly applied: true
  readonly fallbackType: 'event'
}

/**
 * Emette evento custom su `definition.topic` (o default `microfrontend.fallback.event`).
 *
 * Payload include `fallbackApplied:true` carryover marker PRD §31.5 (chain detection
 * downstream: subscriber può rilevare che evento è prodotto da fallback engine).
 *
 * @param broker Broker per `broker.publish(topic, payload, opts)`.
 * @param mfId MicroFrontend ID — popolato in `payload.microFrontendId`.
 * @param phase Lifecycle phase F8 (load|bootstrap|mount|runtime|update|unmount|destroy)
 *   — popolato in `payload.lifecyclePhase`.
 * @param error Shape error minimale (passato in `payload.error`).
 * @param definition FallbackDefinition — usa `definition.topic` se presente, altrimenti
 *   default `FALLBACK_EVENT_DEFAULT_TOPIC`.
 * @returns RenderResult con `applied: true` + `fallbackType: 'event'`.
 */
export function renderEventFallback(
  broker: Broker,
  mfId: string,
  phase: MicroFrontendErrorLifecyclePhase,
  error: { readonly message: string; readonly code?: string },
  definition: FallbackDefinition,
): EventRenderResult {
  const topic = definition.topic ?? FALLBACK_EVENT_DEFAULT_TOPIC
  broker.publish(
    topic,
    {
      microFrontendId: mfId,
      lifecyclePhase: phase,
      error,
      fallbackApplied: true,
      timestamp: Date.now(),
    },
    PUBLISH_OPTS,
  )
  return { applied: true, fallbackType: 'event' }
}
