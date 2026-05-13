/**
 * F12 CompatError factory + publishCompatTopics helper (MF-COMPAT-04 + MF-COMPAT-03).
 *
 * Cover REQ-IDs:
 * - MF-COMPAT-04 (CompatibilityError shape PRD §20 + 2 topic governance emit PRIMA del throw).
 * - MF-COMPAT-03 (Report-as-payload — consistency 1:1 topic ↔ API D-12-16).
 *
 * **OQ-4 RESOLUTION (planner W2 ratify, AMENDMENT D-12-03):**
 *
 * Plan 12-02 + CONTEXT.md D-12-03 originalmente specificavano
 * `category: 'compatibility'`. La RESEARCH ha raccomandato e il planner W2 ha
 * ratificato `category: 'microfrontend' as ErrorCategory` (DIRECT-CAST), NON
 * `'compatibility'`, per i seguenti motivi:
 *
 * 1. **D-83 strict triple esteso v2.0 preserved**: estendere il union
 *    `ErrorCategory` upstream in `packages/core/src/errors.ts` violerebbe
 *    `git diff packages/core/src/` = 0.
 * 2. **Carryover F11 D-V2-F11-22**: F11 `createPermissionError` usa esattamente lo
 *    stesso pattern (`'microfrontend' as ErrorCategory` direct-cast). Coerenza
 *    cross-fase tra moduli MF-governance.
 * 3. **Discriminator semantico via `code`**: il filtro consumer-side è
 *    `err.code === 'COMPAT_INCOMPATIBLE'` o `err.code.startsWith('COMPAT_')` —
 *    `code` enum è già la fonte di verità per categorizzazione granulare.
 *
 * Documentazione cross-ref:
 * - JSDoc qui (questo file).
 * - W2 SUMMARY sezione "OQ Resolution Outcomes".
 * - README W3 sezione "Error categories" (plan 12-05).
 *
 * **Pitfall 7 ACK**: `microfrontend.compatibility.failed` GIA in F8
 * `MF_GOVERNANCE_TOPICS[1]` — F12 RIUSA via import diretto (NO duplica literal in
 * `topics.ts` locale F12 — D-83 strict).
 *
 * @see prd_2.0.0.md §20 — CompatibilityError shape + 2 topics standard
 * @see D-V2-F11-22 (F11 strict carryover — NO union extension upstream)
 * @see plan 12-02 OQ-4 AMENDMENT D-12-03 (planner ratify)
 * @see packages/permissions/src/permission-error.ts (TEMPLATE F11 — direct-cast pattern)
 */
import {
  type Broker,
  type BrokerError,
  createBrokerError,
  type ErrorCategory,
} from '@gluezero/core'
import { MF_GOVERNANCE_TOPICS } from '@gluezero/microfrontends'
// REVISIONE WARNING 8: source attribution centralizzata in internal module condiviso.
import { COMPAT_PUBLISH_SOURCE } from './internal/compat-source'
import type { CompatibilityReport } from './types/report'

/**
 * `CompatErrorCode` — discriminator semantico per `BrokerError.code`.
 *
 * 2 codes union locale F12 (NON aggiunti a `MicroFrontendErrorCode` upstream —
 * D-83 strict block):
 *
 * - `'COMPAT_INCOMPATIBLE'`: report.errors[] populated + policy blocking → throw.
 *   Details: `{microFrontendId, phase, report}`.
 * - `'COMPAT_VERSION_INVALID'`: actual o range non parsabile da semver (defensive,
 *   raro). Details: `{microFrontendId, phase, report, invalidValue}`.
 *
 * Consumer pattern di filtro:
 * ```ts
 * if (err.code === 'COMPAT_INCOMPATIBLE') { ... }
 * // o più generico:
 * if (err.code.startsWith('COMPAT_')) { ... }
 * ```
 */
export type CompatErrorCode = 'COMPAT_INCOMPATIBLE' | 'COMPAT_VERSION_INVALID'

/**
 * `CompatibilityPhase` — discriminator del lifecycle phase in cui il throw è
 * avvenuto (D-12-04).
 *
 * Usato come `details.phase` per dispatching consumer/devtools:
 * - `'registration'`: throw da `broker.registerMicroFrontend(desc)` (block-registration).
 * - `'load'`: throw da `service.load(id)` (block-load — OQ-3 FUNZIONALE F12).
 * - `'mount'`: throw da `service.mount(id)` (block-mount — anche block-load alias F11).
 */
export type CompatibilityPhase = 'registration' | 'load' | 'mount'

/**
 * Parametri input per la factory `createCompatError`.
 *
 * Shape allineata a F11 `CreatePermissionErrorParams` (D-V2-F11-08 pattern) con
 * 2 field aggiuntivi `phase` + `microFrontendId` + `report` per
 * dispatching/devtools downstream (D-12-04 + D-12-16).
 */
export interface CreateCompatErrorParams {
  readonly code: CompatErrorCode
  readonly message: string
  readonly phase: CompatibilityPhase
  readonly microFrontendId: string
  readonly report: CompatibilityReport
  readonly details?: Record<string, unknown>
}

/**
 * Factory per `BrokerError` compat — `category: 'microfrontend'` direct-cast (OQ-4).
 *
 * Pattern carryover F11 `createPermissionError` (D-V2-F11-22 strict). Discriminator
 * semantico via `code` enum (`COMPAT_INCOMPATIBLE` / `COMPAT_VERSION_INVALID`).
 *
 * @param params Parametri input: `code`, `message`, `phase`, `microFrontendId`, `report`, opzionale `details`.
 * @returns `BrokerError` immutabile con `category: 'microfrontend'` + `code` preservato + `details: {microFrontendId, phase, report, ...}`.
 *
 * @throws Mai direttamente. Questa factory **ritorna** `BrokerError` senza mai
 *   throwarlo — il throw è responsabilità del caller (vedi `enforceCompatPolicy`
 *   in `policy-dispatch.ts` e `wrapServiceWithCompat` in `enforcement-points.ts`).
 *   Pattern intenzionale per consentire emit-before-throw (D-12-05): il caller
 *   prima emette `microfrontend.compatibility.failed` topic, poi throwa il
 *   `BrokerError` ritornato.
 *
 * @example Throw incompat error nel `policy-dispatch.enforceCompatPolicy`
 * ```ts
 * throw createCompatError({
 *   code: 'COMPAT_INCOMPATIBLE',
 *   message: 'MicroFrontend "checkout" incompatible at mount: gluezero-version',
 *   phase: 'mount',
 *   microFrontendId: 'checkout',
 *   report,
 * })
 * ```
 *
 * @example Throw version invalid (semver parse fallback)
 * ```ts
 * throw createCompatError({
 *   code: 'COMPAT_VERSION_INVALID',
 *   message: 'MicroFrontend "x" declared invalid version range',
 *   phase: 'registration',
 *   microFrontendId: 'x',
 *   report,
 *   details: { invalidValue: 'garbage-range' },
 * })
 * ```
 *
 * @example Pattern emit-before-throw (D-12-05 plan 12-05 closure)
 * ```ts
 * if (!report.ok && policy === 'block-mount' && phase === 'mount') {
 *   publishCompatTopics(broker, report, 'failed') // emit FIRST
 *   throw createCompatError({                      // then throw
 *     code: 'COMPAT_INCOMPATIBLE',
 *     message: `MF "${id}" incompatible at mount`,
 *     phase: 'mount',
 *     microFrontendId: id,
 *     report,
 *   })
 * }
 * ```
 *
 * @see prd_2.0.0.md §20 — CompatibilityError shape
 * @see D-V2-F11-22 (F11 carryover direct-cast)
 * @see plan 12-02 OQ-4 AMENDMENT D-12-03
 * @see D-12-05 emit-before-throw pattern (plan 12-05 closure)
 * @see OQ-4 — category 'microfrontend' direct-cast (NOT 'compatibility')
 */
export function createCompatError(params: CreateCompatErrorParams): BrokerError {
  return createBrokerError({
    code: params.code,
    category: 'microfrontend' as ErrorCategory,
    message: params.message,
    details: {
      microFrontendId: params.microFrontendId,
      phase: params.phase,
      report: params.report,
      ...(params.details ?? {}),
    },
  })
}

/**
 * F8 governance topic `'microfrontend.compatibility.failed'` RIUSATO via import
 * (Pitfall 7 ACK — NON duplica literal in `topics.ts` locale F12).
 *
 * Index `[1]` in F8 `MF_GOVERNANCE_TOPICS` array
 * (`packages/microfrontends/src/topics.ts:67-73`).
 *
 * @internal
 */
const MF_COMPAT_FAILED: (typeof MF_GOVERNANCE_TOPICS)[number] =
  'microfrontend.compatibility.failed'

/**
 * F12 NUOVO topic locale (literal in `topics.ts` MF_COMPAT_TOPICS[0]).
 *
 * @internal
 */
const MF_COMPAT_WARNING = 'microfrontend.compatibility.warning' as const

/**
 * Helper per emit topic compat — riuso F8 governance + literal F12 locale.
 *
 * Pattern carryover F11 `publishDeniedTopics` (publish topic PRIMA del throw,
 * F10 `acl-enforcer.ts:172-185`).
 *
 * - `level: 'failed'`  → emit `'microfrontend.compatibility.failed'` (F8 reuse).
 * - `level: 'warning'` → emit `'microfrontend.compatibility.warning'` (F12 locale).
 *
 * **Payload (D-12-16):** `CompatibilityReport` completo — stessa shape ritornata da
 * `getCompatibilityReport(id)` (consistency 1:1 topic ↔ API).
 *
 * **Source attribution (REVISIONE WARNING 8):** importata da
 * `./internal/compat-source` (modulo privilegiato, bypassa permission check F11
 * carryover).
 *
 * @param broker Broker reference per publish.
 * @param report `CompatibilityReport` (payload shape PRD §20.5).
 * @param level `'failed'` (errors[] populated) o `'warning'` (warnings[] populated or policy='warn').
 *
 * @example Emit failed PRIMA del throw
 * ```ts
 * publishCompatTopics(broker, report, 'failed')
 * throw createCompatError({...})
 * ```
 *
 * @see D-12-05 — emit topic on block PRIMA del throw
 * @see D-12-16 — Report-as-payload consistency
 */
export function publishCompatTopics(
  broker: Broker,
  report: CompatibilityReport,
  level: 'failed' | 'warning',
): void {
  const topic = level === 'failed' ? MF_COMPAT_FAILED : MF_COMPAT_WARNING
  broker.publish(topic, report, {
    source: COMPAT_PUBLISH_SOURCE,
    deliveryMode: 'sync' as const,
  } as never)
}
