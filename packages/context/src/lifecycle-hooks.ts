/**
 * Lifecycle hooks per attach/detach cascade mapping + context-map facade
 * (D-V2-F10-15 + MF-MAP-01/02/03 + MF-CTX-06).
 *
 * Subscribe ai 4 lifecycle topics F8 (MF_LIFECYCLE_TOPICS):
 * - `microfrontend.mounted` → `attachMfMapping` + `attachMfContext`
 * - `microfrontend.unmounted` → `detachMfMapping` + `detachMfContext`
 * - `microfrontend.destroyed` → defensive cleanup (idempotent)
 * - `microfrontend.unregistered` → `detachMfMapping` (T-F10-05 leak prevention)
 *
 * **F10 NON modifica F8 registry** — composition esterna via subscribe ai topics
 * esistenti F8 (D-83 strict — zero diff `packages/microfrontends/src/`).
 *
 * **Type narrowing locale:** `MfLifecyclePayload { id: string }` rappresenta il subset
 * payload F8 consumato da F10 (PRD §31.1). F10 NON re-importa `MicroFrontendLifecycleEventPayload`
 * F8 per evitare coupling fragile (campi addizionali F11+ non rilevanti F10).
 *
 * @see PRD §31.1 (MF_LIFECYCLE_TOPICS)
 * @see D-V2-F10-15 (contextMap auto-injection LIVE)
 * @see T-F10-05 (MapperEngine instance leak mitigation)
 * @packageDocumentation
 */
import type { Broker, BrokerEvent } from '@gluezero/core'
import type { MicroFrontendsService } from '@gluezero/microfrontends'
import { attachMfContext, detachMfContext } from './context-map-facade'
import { attachMfMapping, detachMfMapping, type MicroFrontendMapping } from './mapping-integration'

/**
 * Subset payload F8 consumato da F10 lifecycle hooks.
 *
 * @internal
 */
interface MfLifecyclePayload {
  readonly id: string
}

/**
 * Type narrowing locale per il payload F8 (D-83 strict — NO declaration merging).
 *
 * F8 broker.subscribe ha signature unica `(topic, handler)` con `handler: (event: BrokerEvent) => void`.
 * F10 cast locale al payload subset consumato.
 *
 * @internal
 */
function getMfId(event: BrokerEvent<unknown>): string {
  return (event.payload as MfLifecyclePayload).id
}

/**
 * Type narrowing locale per `descriptor.mapping` field (D-83 strict — NO declaration merging).
 *
 * F8 `MicroFrontendDescriptor` ha `mapping?: unknown` placeholder. F10 narrowing locale
 * via cast `as { mapping?: MicroFrontendMapping }` evita ambiguità cross-package.
 *
 * @internal
 */
function getMappingFromDescriptor(descriptor: unknown): MicroFrontendMapping | undefined {
  return (descriptor as { mapping?: MicroFrontendMapping })?.mapping
}

/**
 * Wire lifecycle hooks per ctx.context auto-injection LIVE + per-MF mapping cascade.
 *
 * Subscribe a 4 lifecycle topics F8 (`MF_LIFECYCLE_TOPICS`):
 *
 * | Topic                          | Action                                                  |
 * |--------------------------------|---------------------------------------------------------|
 * | `microfrontend.mounted`        | attachMfMapping + attachMfContext (LIVE + abortSignal) |
 * | `microfrontend.unmounted`      | detachMfMapping + detachMfContext (cleanup cascade)    |
 * | `microfrontend.destroyed`      | detachMfMapping + detachMfContext (defensive idempotent)|
 * | `microfrontend.unregistered`   | detachMfMapping (T-F10-05 leak prevention)              |
 *
 * **Defensive `if (!reg) return` guard:** se `mfService.get(mfId)` ritorna undefined
 * (es. race condition, lifecycle event con MF già unregistered), skip senza throw.
 *
 * @param broker Broker reference per subscribe.
 * @param mfService MicroFrontendsService per lookup `reg = mfService.get(mfId)`.
 *
 * @example
 * ```ts
 * // Chiamato da `contextModule().install` (W2 P04):
 * wireLifecycleHooks(ctx.broker, mfService)
 * ```
 *
 * @see PRD §31.1 (MF_LIFECYCLE_TOPICS)
 * @see D-V2-F10-15 (contextMap auto-injection LIVE)
 * @see T-F10-05 (leak mitigation via cleanup cascade)
 */
export function wireLifecycleHooks(broker: Broker, mfService: MicroFrontendsService): void {
  broker.subscribe('microfrontend.mounted', (event: BrokerEvent<unknown>) => {
    const mfId = getMfId(event)
    const reg = mfService.get(mfId)
    if (!reg) return
    const mapping = getMappingFromDescriptor(reg.descriptor)
    attachMfMapping(broker, mfId, mapping)
    // AbortSignal mount lifecycle F8 plumbed via reg field (when available) —
    // cascade auto-cleanup via subscribeRuntimeContext signal option.
    const abortSignal = (reg as { abortSignal?: AbortSignal }).abortSignal
    attachMfContext(mfId, reg, abortSignal)
  })
  broker.subscribe('microfrontend.unmounted', (event: BrokerEvent<unknown>) => {
    const mfId = getMfId(event)
    detachMfMapping(mfId)
    detachMfContext(mfId)
  })
  broker.subscribe('microfrontend.destroyed', (event: BrokerEvent<unknown>) => {
    const mfId = getMfId(event)
    // Defensive idempotent — detach può essere già stato chiamato da unmounted
    detachMfMapping(mfId)
    detachMfContext(mfId)
  })
  broker.subscribe('microfrontend.unregistered', (event: BrokerEvent<unknown>) => {
    // T-F10-05 leak prevention: cleanup mapping anche se MF non era mounted.
    const mfId = getMfId(event)
    detachMfMapping(mfId)
    detachMfContext(mfId)
  })
}
