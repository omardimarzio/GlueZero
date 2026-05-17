/**
 * Composition wrapper D-46 carryover F2 (D-V2-F10-10):
 * intercetta `recordError(err)` del F2 `MappingInspector` e arricchisce il payload
 * con `microFrontendId` lookup contestuale (MF-MAP-03 + MF-INT-MAP-02).
 *
 * **Strategy A Proxy (~50 LoC, preserva 100% API consumer F6 v1.x back-compat).**
 * Tutti i metodi tranne `recordError` sono passthrough via `Reflect.get`.
 *
 * **F2 inspector class UNCHANGED** — composition esterna (D-83 strict zero diff F2).
 *
 * Ring buffer snapshot esposto include `microFrontendId?` field opzionale in
 * `BrokerError.details` (back-compat consumer F6 v1.x che non leggono mfId ricevono
 * shape originale).
 *
 * @see MF-MAP-03, MF-INT-MAP-02
 * @see D-V2-F10-10 (Inspector EventTap wrapper)
 * @see D-46 (composition wrapper pattern F2)
 * @see T-F10-W2-P04-01 (Proxy escape mitigation — Reflect.get fallback)
 * @see T-F10-W2-P04-02 (BrokerError mutation mitigation — createBrokerError clone)
 * @packageDocumentation
 */
import { type BrokerError, createBrokerError } from '@gluezero/core'
import type { MappingInspector } from '@gluezero/mapper'

/**
 * Wrap un F2 `MappingInspector` con attribution layer per `microFrontendId`.
 *
 * Quando `recordError(err)` viene chiamato:
 * 1. Lookup contestuale via `getMfIdFromContext()`.
 * 2. Se `mfId` defined → clone `err` via `createBrokerError` con `details.microFrontendId`
 *    merged (NO mutation di `err` originale — T-F10-W2-P04-02 mitigation).
 * 3. Se `mfId` undefined → passthrough con `err` originale (back-compat).
 * 4. Delegate al `target.recordError(enriched)` F2 originale.
 *
 * Tutti gli altri metodi (`recordSnapshot`, `lastErrors`, `clearErrors`, `getSnapshot`)
 * sono passthrough via `Reflect.get(target, prop, receiver)`.
 *
 * @param inspector F2 MappingInspector instance (esposta pubblicamente da `@gluezero/mapper`).
 * @param getMfIdFromContext Lookup contestuale del mfId attivo durante operazione mapping.
 *   Pattern callback per supportare lookup dinamico (es. accesso a contesto async).
 * @returns MappingInspector wrapper API-compatible (assignable a `MappingInspector` type).
 *
 * @example
 * ```ts
 * import { MappingInspector } from '@gluezero/mapper'
 * import { wrapInspectorWithMfAttribution } from '@gluezero/context'
 *
 * const inspector = new MappingInspector({
 *   canonicalRegistry, aliasRegistry, transformPipeline, errorBufferSize: 50
 * })
 * let currentMfId: string | undefined
 * const wrapped = wrapInspectorWithMfAttribution(inspector, () => currentMfId)
 *
 * currentMfId = 'customer-dashboard'
 * wrapped.recordError(err)  // → details.microFrontendId = 'customer-dashboard' injected
 * ```
 *
 * @see MF-MAP-03, MF-INT-MAP-02
 * @see D-V2-F10-10
 */
export function wrapInspectorWithMfAttribution(
  inspector: MappingInspector,
  getMfIdFromContext: () => string | undefined,
): MappingInspector {
  return new Proxy(inspector, {
    get(target, prop, receiver): unknown {
      if (prop === 'recordError') {
        return (err: BrokerError): void => {
          const mfId = getMfIdFromContext()
          // T-F10-W2-P04-02 mitigation: NO mutation — clone via createBrokerError factory.
          const enriched: BrokerError =
            mfId !== undefined
              ? createBrokerError({
                  code: err.code,
                  category: err.category,
                  message: err.message,
                  details: { ...(err.details ?? {}), microFrontendId: mfId },
                  ...(err.originalError !== undefined && { originalError: err.originalError }),
                })
              : err
          target.recordError(enriched)
        }
      }
      // T-F10-W2-P04-01 mitigation: Reflect.get fallback — preserva native trap semantics.
      return Reflect.get(target, prop, receiver)
    },
  })
}
