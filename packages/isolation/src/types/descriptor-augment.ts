import type { MicroFrontendDescriptor } from '@gluezero/microfrontends'
import type { MicroFrontendIsolationPolicy } from './policy.js'
import type { MicroFrontendThemePolicy } from './theme-policy.js'

/**
 * `IsolationAwareMfDescriptor` — Type narrowing locale per `descriptor.isolation`
 * + `descriptor.theme` (D-V2-F13-20 + D-83 strict SEXTUPLE esteso).
 *
 * Pattern carryover F11 `PermissionAwareMfDescriptor` + F12 `CompatAwareMfDescriptor`:
 * NO `declare module '@gluezero/microfrontends'` block, NO diff
 * `packages/microfrontends/src/types/descriptor.ts`. Il narrowing avviene SOLO
 * localmente in `@gluezero/isolation` via interface extension + cast soft helper
 * accessor.
 *
 * `isolation?: Partial<MicroFrontendIsolationPolicy>` — Per-MF override permette di
 * specificare 1+ chiavi senza dover ridichiarare tutte le 7 (resolver merge con
 * default+policyDefault completa lo shape).
 *
 * @see prd_2.0.0.md §13.4 — Descriptor extensions opzionali
 * @see prd_2.0.0.md §21.3 — Per-MF isolation override
 * @see prd_2.0.0.md §11.2 — Per-MF theme policy
 * @see D-V2-F13-20 — Pattern S1 augment subpath (carryover D-V2-F11-22 + D-V2-F12)
 */
export interface IsolationAwareMfDescriptor extends MicroFrontendDescriptor {
  readonly isolation?: Partial<MicroFrontendIsolationPolicy>
  readonly theme?: MicroFrontendThemePolicy
}

/**
 * Helper accessor sicuro per `descriptor.isolation`.
 *
 * Esegue cast soft locale a `IsolationAwareMfDescriptor` senza assumere che il
 * descriptor abbia il campo `isolation` (TS strict-safe).
 *
 * @param descriptor Descriptor MF qualsiasi (anche senza isolation override).
 * @returns Partial isolation policy se presente, altrimenti `undefined`.
 *
 * @example Read per-MF isolation override
 * ```ts
 * const iso = getIsolation(descriptor)
 * if (iso?.css === 'shadow-dom') {
 *   // shadow-dom path
 * }
 * ```
 */
export function getIsolation(
  descriptor: MicroFrontendDescriptor,
): Partial<MicroFrontendIsolationPolicy> | undefined {
  return (descriptor as IsolationAwareMfDescriptor).isolation
}

/**
 * Helper accessor sicuro per `descriptor.theme`.
 *
 * Stesso pattern di `getIsolation` — cast locale type-narrowing senza mutare il
 * descriptor upstream.
 *
 * @param descriptor Descriptor MF qualsiasi (anche senza theme policy).
 * @returns Theme policy se presente, altrimenti `undefined`.
 *
 * @example Read per-MF theme override
 * ```ts
 * const theme = getThemePolicy(descriptor)
 * if (theme?.inherit === false) {
 *   // isolated theme path
 * }
 * ```
 */
export function getThemePolicy(
  descriptor: MicroFrontendDescriptor,
): MicroFrontendThemePolicy | undefined {
  return (descriptor as IsolationAwareMfDescriptor).theme
}
