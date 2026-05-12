/**
 * F11 Capability Checker — policy dispatch 4 valori PRD §17.6 (MF-CAP-04).
 *
 * - `'off'`: skip — no topic, no throw, no warn (per-MF override pattern: developer
 *   disabilita check selettivamente).
 * - `'warn'`: topic publish + `console.warn` — NO throw (DX onboarding-friendly).
 * - `'block-load'`: **OQ-2 ALIAS A block-mount** + warning aggiuntivo (F9 NON espone
 *   seam pre-fetch — defer V2.1 hardening). Research §9 verified F9 ESM loader does
 *   NOT provide pre-fetch hook. F11 emit warning + throws come block-mount.
 * - `'block-mount'`: topic publish + throw `CAPABILITY_MISSING` (coerente F10
 *   D-V2-F10-06 fail-secure pattern).
 *
 * **D-V2-F11-12 per-MF override more-strict wins**: composizione in lifecycle-hooks:
 * `effectivePolicy = descriptor.capabilities.policy ?? installPolicy` (per-MF prevale).
 *
 * **B-03 FIX**: `computeCapabilityResult` importato direttamente da
 * `./capability-registry` (public export). NO file phantom di re-export interno.
 *
 * @see prd_2.0.0.md §17.5 — CapabilityCheckResult shape
 * @see prd_2.0.0.md §17.6 — capabilityPolicy 4 valori
 * @see D-V2-F11-11 (pre-mount check + event-driven invalidation)
 * @see D-V2-F11-12 (per-MF override more-strict wins)
 * @see ROADMAP linea 288 — SC2 block-mount esempio
 */
import type { Broker } from '@gluezero/core'
import { MF_GOVERNANCE_TOPICS } from '@gluezero/microfrontends'
// B-03 FIX: import diretto computeCapabilityResult dal public export di capability-registry.
// NO file intermedio di re-export, NO phantom internal export.
import { computeCapabilityResult } from './capability-registry'
import { createPermissionError } from './permission-error'
import type { CapabilityCheckResult, CapabilityPolicy } from './types/capabilities'

/**
 * Pitfall 7 ACK: F8 governance topic `'microfrontend.capability.missing'`
 * (`MF_GOVERNANCE_TOPICS[0]`) riusato via import (NON duplicato in topics.ts F11).
 *
 * @internal
 */
const MF_CAPABILITY_MISSING: (typeof MF_GOVERNANCE_TOPICS)[number] =
  'microfrontend.capability.missing'

const publishOpts = {
  source: { type: 'plugin' as const, id: 'permissions', name: '@gluezero/permissions' },
  deliveryMode: 'sync' as const,
}

/**
 * Re-export `computeCapabilityResult` per consumer esterni (es. lifecycle-hooks
 * test che vogliono computare check senza istanziare il registry).
 *
 * @see capability-registry.ts (public export — B-03 FIX)
 */
export { computeCapabilityResult }

/**
 * Policy dispatch enforcement — invocato da lifecycle-hooks dopo aver computato
 * `CapabilityCheckResult` via `registry.checkMicroFrontendCapabilities`.
 *
 * Dispatch logic:
 *
 * | Policy        | result.ok=true | result.ok=false                                            |
 * |---------------|----------------|------------------------------------------------------------|
 * | `'off'`       | no-op          | no-op (skip qualunque enforcement)                         |
 * | `'warn'`      | no-op          | publish topic + console.warn + NO throw                    |
 * | `'block-load'`| no-op          | publish topic + console.warn alias note + THROW (OQ-2 alias)|
 * | `'block-mount'`| no-op         | publish topic + THROW `CAPABILITY_MISSING`                 |
 *
 * Publish topic emit PRIMA del throw (pattern F10 `acl-enforcer.ts:172-185`) per
 * garantire telemetry/devtools visibility anche su flow throw.
 *
 * @param broker Broker reference per publish `microfrontend.capability.missing`.
 * @param mfId ID del MF che ha fallito il check.
 * @param result `CapabilityCheckResult` dal registry.
 * @param policy Effective policy (per-MF override già risolto dal caller).
 *
 * @throws `BrokerError({code: 'CAPABILITY_MISSING'})` se policy === 'block-mount' o 'block-load' e result.ok=false.
 *
 * @example Policy enforcement standard
 * ```ts
 * const result = registry.checkMicroFrontendCapabilities('mf1', caps)
 * const effectivePolicy = caps?.policy ?? installPolicy
 * enforceCapabilityPolicy(broker, 'mf1', result, effectivePolicy)
 * ```
 */
export function enforceCapabilityPolicy(
  broker: Broker,
  mfId: string,
  result: CapabilityCheckResult,
  policy: CapabilityPolicy,
): void {
  if (policy === 'off' || result.ok) return

  // 1. Publish topic PRIMA del throw (pattern F10 acl-enforcer:172-185).
  broker.publish(
    MF_CAPABILITY_MISSING,
    {
      microFrontendId: mfId,
      missing: result.missing,
      incompatible: result.incompatible,
      optionalMissing: result.optionalMissing,
      timestamp: Date.now(),
    },
    publishOpts,
  )

  if (policy === 'warn') {
    console.warn(
      `[permissions] MF "${mfId}" capability check failed: ` +
        `missing=[${result.missing.join(', ')}] ` +
        `incompatible=[${result.incompatible
          .map((i) => `${i.name}(req:${i.required},got:${i.provided})`)
          .join(', ')}]`,
    )
    return
  }

  // OQ-2 — block-load aliased a block-mount con warning (F9 NON espone seam pre-fetch — defer V2.1).
  if (policy === 'block-load') {
    console.warn(
      `[permissions] policy 'block-load' aliased to 'block-mount' in F11 ` +
        `(F9 ESM loader does NOT expose pre-fetch seam; defer V2.1).`,
    )
  }

  // policy === 'block-mount' (o 'block-load' aliasato) → throw CAPABILITY_MISSING.
  throw createPermissionError({
    code: 'CAPABILITY_MISSING',
    message:
      `MicroFrontend "${mfId}" missing capabilities: [${result.missing.join(', ')}]` +
      (result.incompatible.length > 0
        ? ` + incompatible: [${result.incompatible
            .map((i) => `${i.name}(required:${i.required}, provided:${i.provided})`)
            .join(', ')}]`
        : ''),
    details: {
      microFrontendId: mfId,
      missing: [...result.missing],
      incompatible: [...result.incompatible],
      optionalMissing: [...result.optionalMissing],
    },
  })
}
