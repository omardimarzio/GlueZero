import type { MicroFrontendDescriptor } from '@gluezero/microfrontends'
import type { MicroFrontendPermissions } from './permissions'
import type { MicroFrontendCapabilities } from './capabilities'

/**
 * Type narrowing locale per `descriptor.permissions` + `descriptor.capabilities`.
 *
 * D-V2-F11-17 + D-V2-F11-22 STRICT: NO `declare module '@gluezero/microfrontends'`
 * block, NO diff `packages/microfrontends/src/types/descriptor.ts`. Il narrowing
 * avviene SOLO localmente in `@gluezero/permissions` via interface extension.
 *
 * Pattern carryover F10 `ContextMfDescriptor` (`packages/context/src/acl-enforcer.ts:57-61`):
 * stesso meccanismo, zero declaration merging upstream — BC §42 14 API frozen preserved.
 *
 * @see prd_2.0.0.md §13.4 — descriptor extensions opzionali
 * @see D-V2-F11-22 strict triple (NO diff to F1-F10 src)
 */
export interface PermissionAwareMfDescriptor extends MicroFrontendDescriptor {
  readonly permissions?: MicroFrontendPermissions
  readonly capabilities?: MicroFrontendCapabilities
}

/**
 * Helper accessor sicuro per `descriptor.permissions`.
 *
 * Esegue il cast locale a `PermissionAwareMfDescriptor` senza assumere che il
 * descriptor abbia il campo `permissions` (cast soft via `as` — TS strict-safe).
 *
 * @param descriptor Descriptor MF qualsiasi (anche senza permissions).
 * @returns L'oggetto `MicroFrontendPermissions` se presente, altrimenti `undefined`.
 *
 * @example
 * ```ts
 * const perms = getPermissions(descriptor)
 * if (perms?.publish) { ... }
 * ```
 */
export function getPermissions(
  descriptor: MicroFrontendDescriptor,
): MicroFrontendPermissions | undefined {
  return (descriptor as PermissionAwareMfDescriptor).permissions
}

/**
 * Helper accessor sicuro per `descriptor.capabilities`.
 *
 * Stesso pattern di `getPermissions` — cast locale type-narrowing senza mutare
 * il descriptor upstream.
 *
 * @param descriptor Descriptor MF qualsiasi (anche senza capabilities).
 * @returns L'oggetto `MicroFrontendCapabilities` se presente, altrimenti `undefined`.
 *
 * @example
 * ```ts
 * const caps = getCapabilities(descriptor)
 * if (caps?.requires?.length) { ... }
 * ```
 */
export function getCapabilities(
  descriptor: MicroFrontendDescriptor,
): MicroFrontendCapabilities | undefined {
  return (descriptor as PermissionAwareMfDescriptor).capabilities
}
