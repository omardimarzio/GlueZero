/**
 * F14 descriptor extension type-only — `FallbackAwareMfDescriptor` + helper
 * accessor `getFallback` (D-V2-F14-19 stretto Pattern S1 carryover F11/F12/F13).
 *
 * Coverage REQ-ID skeleton: MF-FALLBACK-01 (descriptor.fallback? opt-in field).
 *
 * **D-V2-F14-19 stretto Pattern S1**: NO `declare module '@gluezero/microfrontends'`
 * (limitazione TS literal union upstream + D-83 strict septuple block diff). Consumer
 * accedono al campo via cast soft o helper accessor `getFallback`. Coerente F11
 * `PermissionAwareMfDescriptor` (`packages/permissions/src/types/descriptor-augment.ts`)
 * + F13 `IsolationAwareMfDescriptor` pattern.
 *
 * @see prd_2.0.0.md §13.4 — descriptor extensions opzionali
 * @see D-V2-F14-19 — Augment subpath Pattern S1 stretto carryover
 * @see packages/permissions/src/types/descriptor-augment.ts (F11 reference template)
 */
import type { MicroFrontendDescriptor } from '@gluezero/microfrontends'
import type { MicroFrontendFallbackPolicy } from './policy.js'

/**
 * Type narrowing locale per `descriptor.fallback?` opt-in.
 *
 * D-V2-F14-19 stretto: NO declaration merging upstream a `@gluezero/microfrontends`
 * (PermissionAwareMfDescriptor + IsolationAwareMfDescriptor stesso pattern F11/F13).
 *
 * @see prd_2.0.0.md §29.3 — Policy descriptor opt-in field
 */
export interface FallbackAwareMfDescriptor extends MicroFrontendDescriptor {
  readonly fallback?: MicroFrontendFallbackPolicy
}

/**
 * Helper accessor type-safe per estrarre `fallback?` dal descriptor.
 *
 * Esegue il cast locale a `FallbackAwareMfDescriptor` senza assumere che il
 * descriptor abbia il campo `fallback` (cast soft via `as` — TS strict-safe).
 * Coerente F11 `getPermissions` + F13 `getIsolation` helper pattern.
 *
 * @param descriptor Descriptor MF qualsiasi (anche senza fallback policy).
 * @returns L'oggetto `MicroFrontendFallbackPolicy` se presente, altrimenti `undefined`.
 *
 * @example
 * ```ts
 * const policy = getFallback(reg.descriptor)
 * if (policy?.onLoadError) {
 *   // applica fallback chain per phase 'load'
 * }
 * ```
 */
export function getFallback(
  descriptor: MicroFrontendDescriptor,
): MicroFrontendFallbackPolicy | undefined {
  return (descriptor as FallbackAwareMfDescriptor).fallback
}
