import type { MicroFrontendDescriptor } from '@gluezero/microfrontends'
import type { MicroFrontendCompatibility } from './compatibility'

/**
 * Type narrowing locale per `descriptor.compatibility`.
 *
 * D-83 strict triple esteso v2.0 (carryover D-V2-F11-22): NO `declare module
 * '@gluezero/microfrontends'`, NO diff a `packages/microfrontends/src/types/descriptor.ts`.
 * Il narrowing avviene SOLO localmente in `@gluezero/compat` via interface extension —
 * BC §42 14 API frozen preservata.
 *
 * Pattern carryover F11 `PermissionAwareMfDescriptor`
 * (`packages/permissions/src/types/descriptor-augment.ts:18-21`) — stesso meccanismo,
 * zero declaration merging upstream.
 *
 * @see prd_2.0.0.md §13.4 — descriptor extensions opzionali
 * @see prd_2.0.0.md §20.3 — `descriptor.compatibility` shape
 * @see D-83 strict triple (NO diff to packages/{core,microfrontends,mapper}/src/)
 */
export interface CompatAwareMfDescriptor extends MicroFrontendDescriptor {
  readonly compatibility?: MicroFrontendCompatibility
}

/**
 * Helper accessor sicuro per `descriptor.compatibility`.
 *
 * Esegue il cast locale a `CompatAwareMfDescriptor` senza assumere che il
 * descriptor abbia il campo `compatibility` (cast soft via `as` — TS strict-safe).
 *
 * Ritorna `undefined` se il descriptor non dichiara la chiave `compatibility`
 * (skip silenzioso — D-12 default).
 *
 * @param descriptor Descriptor MF qualsiasi (anche senza compatibility).
 * @returns L'oggetto `MicroFrontendCompatibility` se presente, altrimenti `undefined`.
 *
 * @example
 * ```ts
 * const caps = getCompatibility(descriptor)
 * if (caps) {
 *   const report = engine.computeReport(descriptor.id, caps)
 * }
 * ```
 */
export function getCompatibility(
  descriptor: MicroFrontendDescriptor,
): MicroFrontendCompatibility | undefined {
  return (descriptor as CompatAwareMfDescriptor).compatibility
}
