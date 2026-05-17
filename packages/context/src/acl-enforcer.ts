/**
 * ACL writableKeys enforcer (MF-CTX-04, D-V2-F10-05/06).
 *
 * Stateless write-guard per `setRuntimeContext`/`replaceRuntimeContext`/`clearRuntimeContext`:
 * - `getWritableKeys(descriptor)`: estrae `writableKeys` array readonly da
 *   `descriptor.context.writableKeys` via **type narrowing locale** (NO declaration
 *   merging upstream → D-83 strict block). Default vuoto `[]` = MF read-only fail-secure.
 * - `enforceWrite(broker, mfId?, partialKeys, writableKeys)`: discriminazione caller
 *   app-shell vs MF facade; in caso di denied publica `microfrontend.context.denied`
 *   PRIMA del throw `MF_CONTEXT_WRITE_DENIED`.
 *
 * **Threat T-F10-01 (ACL bypass)** mitigato: F8 descriptor immutable post-register
 * (D-V2-11) + F10 stateless check at every call (no cache, no memoization) +
 * default fail-secure (writableKeys vuoto = read-only).
 *
 * @see MF-CTX-04, PRD §18.7 (read-only enforcement)
 * @see D-V2-F10-05 (writableKeys policy fail-secure)
 * @see D-V2-F10-06 (enforcement throw + topic publish PRIMA del throw)
 * @see D-V2-F10-21 carryover (topic locale, NO MF_ERROR_TOPICS F8 modifica)
 * @packageDocumentation
 */
import type { Broker } from '@gluezero/core'
import type { MicroFrontendDescriptor } from '@gluezero/microfrontends'
import { createContextError } from './context-error'

/**
 * Topic literal locale per denied event (D-V2-F10-06).
 *
 * **NON aggiunto a `MF_ERROR_TOPICS` array F8** (richiederebbe diff
 * `packages/microfrontends/src/topics.ts` — VIETATO D-83 strict triple v2.0).
 * Literal locale `as const` preserva TypeScript type discrimination senza
 * upstream diff. Audit grep: `grep -q "'microfrontend.context.denied'"
 * packages/microfrontends/src/topics.ts` MUST = NOT FOUND.
 *
 * Convention naming F1 broker regex `^[a-z][a-z0-9]*(\\.[a-z][a-z0-9*]*)*$`
 * — lowercase-segment coerente F8 (`microfrontend.load.failed`/
 * `microfrontend.permission.denied`/ecc.).
 *
 * @see D-V2-F10-06
 * @see D-V2-F8-12 (MF_ERROR_TOPICS F8 const array — F10 NON aggiunge)
 * @see D-V2-F10-21 (defer V2.x major se centralized error topics decision)
 */
export const CONTEXT_DENIED_TOPIC = 'microfrontend.context.denied' as const

/**
 * Type narrowing locale per descriptor.context field (D-V2-F10-05).
 *
 * F8 ha placeholder `context?: unknown` in `MicroFrontendDescriptor` (line 102 — già
 * presente per F10). F10 fa **type narrowing locale** SENZA declaration merging upstream
 * (coerente D-83 strict: NO diff F8 src, NO ambiguità su declaration merging effects).
 *
 * Audit grep: `! grep -q "declare module" packages/context/src/acl-enforcer.ts`.
 *
 * @see D-V2-F10-05
 * @see packages/microfrontends/src/types/descriptor.ts:102 (placeholder F8)
 */
interface ContextMfDescriptor extends MicroFrontendDescriptor {
  readonly context?: {
    readonly writableKeys?: readonly string[]
  }
}

/**
 * Payload event `microfrontend.context.denied` (D-V2-F10-06).
 *
 * Pubblicato PRIMA del throw `MF_CONTEXT_WRITE_DENIED` per audit visibility +
 * future devtools F16 integration.
 *
 * @see D-V2-F10-06
 */
export interface ContextDeniedPayload {
  readonly microFrontendId: string
  readonly attemptedKeys: ReadonlyArray<string>
  readonly allowedKeys: ReadonlyArray<string>
  readonly timestamp: number
}

/**
 * Estrae `writableKeys` da descriptor con type narrowing locale.
 *
 * Default vuoto `[]` = MF read-only by default (fail-secure D-V2-F10-05). App shell
 * (broker raw caller) bypassa enforcement — solo MF facade chiamano con `callerMfId`.
 *
 * @param descriptor `MicroFrontendDescriptor` con eventuale `context.writableKeys`.
 * @returns Array readonly di chiavi RuntimeContext scrivibili dal MF. Default `[]`
 *   (fail-secure: assenza context field o assenza writableKeys = MF read-only).
 *
 * @example MF con writableKeys allowlist
 * ```ts
 * const writable = getWritableKeys({
 *   id: 'customer-dashboard',
 *   name: 'Customer Dashboard',
 *   version: '1.0.0',
 *   context: { writableKeys: ['currentRoute'] },
 * } as MicroFrontendDescriptor)
 * // → ['currentRoute']
 * ```
 *
 * @example MF sans context field — fail-secure default vuoto
 * ```ts
 * const writable = getWritableKeys({
 *   id: 'analytics-widget',
 *   name: 'Analytics',
 *   version: '1.0.0',
 * } as MicroFrontendDescriptor)
 * // → [] (read-only by default)
 * ```
 *
 * @see D-V2-F10-05 (writableKeys policy fail-secure)
 * @see T-F10-01 (ACL bypass mitigation — stateless lookup at every call)
 */
export function getWritableKeys(descriptor: MicroFrontendDescriptor): readonly string[] {
  const ctxField = (descriptor as ContextMfDescriptor).context
  return ctxField?.writableKeys ?? []
}

/**
 * Enforce write permission per chiavi RuntimeContext (D-V2-F10-06).
 *
 * Discriminazione caller:
 * - `mfId === undefined` → app shell = pass-through (sempre allowed, D-V2-F10-05).
 * - `mfId` defined → MF facade → check ogni `partialKeys[i]` ∈ `writableKeys`.
 *
 * Flow su denied (almeno 1 chiave NOT in `writableKeys`):
 * 1. **PRIMA** `broker.publish('microfrontend.context.denied', payload)` (debug visibility).
 * 2. **POI** `throw createContextError({code: 'MF_CONTEXT_WRITE_DENIED', details})` (fail-fast).
 *
 * Fail-secure: anche se 1/N chiavi sono allowed, throw se almeno 1 è denied
 * (no partial mutation — caller `runtime-context.ts` chiama PRIMA di `setState`).
 *
 * **Threat T-F10-01 mitigation:** stateless check at every call (no cache),
 * descriptor immutable F8 post-register (D-V2-11), default fail-secure.
 *
 * @param broker `Broker` reference per publish denied topic.
 * @param mfId `string | undefined`: undefined = app shell (pass-through); string = MF caller id.
 * @param partialKeys Chiavi che il caller sta tentando di scrivere/cancellare.
 * @param writableKeys Allowlist scrivibili dal MF caller (da `getWritableKeys(descriptor)`).
 *
 * @throws `BrokerError` con `code: 'MF_CONTEXT_WRITE_DENIED'` se denied.
 *   Details shape: `{ mfId, attemptedKeys, allowedKeys, deniedKeys }`.
 *
 * @example App shell — pass-through senza check
 * ```ts
 * enforceWrite(broker, undefined, ['tenantId'], [])
 * // → return, no throw, no publish
 * ```
 *
 * @example MF facade — denied write
 * ```ts
 * enforceWrite(broker, 'mf-x', ['tenantId'], ['currentRoute'])
 * // 1. broker.publish('microfrontend.context.denied', {mfId:'mf-x', attemptedKeys:['tenantId'], allowedKeys:['currentRoute'], timestamp:...})
 * // 2. throw createContextError({code:'MF_CONTEXT_WRITE_DENIED', ...})
 * ```
 *
 * @see MF-CTX-04, PRD §18.7 (read-only enforcement)
 * @see T-F10-01 (writableKeys ACL bypass — descriptor immutable F8 + stateless check)
 * @see D-V2-F10-05 (fail-secure), D-V2-F10-06 (throw + topic publish)
 */
export function enforceWrite(
  broker: Broker,
  mfId: string | undefined,
  partialKeys: ReadonlyArray<string>,
  writableKeys: readonly string[],
): void {
  // App shell — sempre allowed (D-V2-F10-05)
  if (mfId === undefined) return

  // Compute denied subset
  const denied = partialKeys.filter((k) => !writableKeys.includes(k))
  if (denied.length === 0) return

  // 1. Publish denied topic PRIMA del throw (debug visibility + future devtools F16).
  // Source descriptor D-23 auto-inject + deliveryMode 'sync' coerente fireContextEvents
  // pattern (P02 SUMMARY Deviation #2/#4 — BrokerEvent requires source D-23, sync flush SLA).
  const payload: ContextDeniedPayload = {
    microFrontendId: mfId,
    attemptedKeys: partialKeys,
    allowedKeys: writableKeys,
    timestamp: Date.now(),
  }
  broker.publish<ContextDeniedPayload>(CONTEXT_DENIED_TOPIC, payload, {
    source: { type: 'plugin', id: 'context', name: '@gluezero/context' },
    deliveryMode: 'sync',
  })

  // 2. Throw fail-fast (no partial mutation upstream — caller chiama PRIMA di setState)
  throw createContextError({
    code: 'MF_CONTEXT_WRITE_DENIED',
    message:
      `MicroFrontend "${mfId}" attempted to write context keys not in writableKeys allowlist. ` +
      `Attempted: [${partialKeys.join(', ')}]. Allowed: [${writableKeys.join(', ') || '<none>'}].`,
    details: {
      mfId,
      attemptedKeys: partialKeys,
      allowedKeys: writableKeys,
      deniedKeys: denied,
    },
  })
}
