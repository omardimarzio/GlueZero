/**
 * `MicroFrontendRuntimeContext` factory (MF-LIFE-03, MF-OBS-01).
 *
 * Crea un context con facade `publish`/`subscribe` che enricha automaticamente:
 * - `metadata: {microFrontendId, microFrontendVersion, lifecycleState}` (MF-OBS-01 + PRD §39.2)
 * - `source: { type: 'plugin', id, name }` auto-inject (D-23 carryover; convenzione
 *    08-10 lifecycle event — il core `event-validator` picklist consente
 *    `['plugin', 'component', 'server', 'worker', 'system']` SOLO. D-83 vieta
 *    modifica core, dunque `'plugin'` è il valore canonico per MF source.type.)
 * - `ownerId: mfOwnerId(reg.descriptor.id)` per cascade unsubscribe (D-V2-16)
 *
 * RESEARCH §8.2 deviation critica: **explicit object** (NOT Proxy come F1
 * `createPluginScopedBroker`). Motivi:
 * - Bundle minore (~30 B per method vs ~50 LoC Proxy)
 * - Zero overhead Proxy (~1 µs/call) — P-02 mitigation
 * - Trace stack chiaro per debug (Proxy nasconde call stack)
 *
 * @see RESEARCH §8 + PATTERNS §37 + PRD §13.3 + PRD §39.2
 */
import type { Broker } from '@gluezero/core'
import { mfOwnerId } from './internal/owner-id'
import type { MicroFrontendRegistration } from './types/descriptor'
import type {
  MicroFrontendPublishOptions,
  MicroFrontendRuntimeContext,
} from './types/runtime-context'

/**
 * Factory `MicroFrontendRuntimeContext`.
 *
 * @param broker - Broker root al quale i facade methods forwardano
 * @param reg - Registration corrente (state, descriptor) per metadata enrichment
 * @param abortSignal - Opzionale `AbortSignal` propagato a subscribe per auto-abort su unmount
 * @returns Context con facade publish/subscribe + metadata enrichment passivo
 *
 * @example
 * ```ts
 * import { createMfRuntimeContext } from '@gluezero/microfrontends'
 *
 * // Dentro lifecycle op del registry:
 * const ctx = createMfRuntimeContext(broker, reg, abortController.signal)
 * await loaded.lifecycle.mount(ctx)
 *
 * // Quando il MF chiama ctx.publish:
 * ctx.publish('user.action', { type: 'click' })
 * // Equivalente a:
 * // broker.publish('user.action', { type: 'click' }, {
 * //   source: { type: 'plugin', id: reg.descriptor.id, name: reg.descriptor.name },
 * //   metadata: {
 * //     microFrontendId: reg.descriptor.id,
 * //     microFrontendVersion: reg.descriptor.version,
 * //     lifecycleState: reg.state,
 * //   },
 * // })
 * ```
 */
export function createMfRuntimeContext(
  broker: Broker,
  reg: MicroFrontendRegistration,
  abortSignal?: AbortSignal,
): MicroFrontendRuntimeContext {
  const mfId = reg.descriptor.id
  const ownerId = mfOwnerId(mfId)

  return {
    id: mfId,
    descriptor: reg.descriptor,
    broker,
    // Facade publish — enricha metadata + auto-source
    publish: <T>(topic: string, payload: T, options?: MicroFrontendPublishOptions): void => {
      // F8: lifecycleState read at call-time (eventually consistent — RESEARCH §14.2)
      broker.publish(topic, payload, {
        ...options,
        metadata: {
          ...options?.metadata,
          microFrontendId: mfId,
          microFrontendVersion: reg.descriptor.version,
          lifecycleState: reg.state,
        },
        source: options?.source ?? {
          type: 'plugin',
          id: mfId,
          name: reg.descriptor.name,
        },
      } as never)
    },
    // Facade subscribe — auto-tag ownerId per cascade D-V2-16
    subscribe: (pattern, handler, options) => {
      return broker.subscribe(
        pattern as never,
        handler as never,
        {
          ...options,
          signal: options?.signal ?? abortSignal,
          ownerId,
        } as never,
      )
    },
    ...(abortSignal !== undefined && { signal: abortSignal }),
    // F8 stub: logger ereditato dal broker (no child scope per ora — RESEARCH OQ-05 deferred)
    // Placeholder F10-F13 — `undefined` esplicito non required (TS optional)
  }
}
