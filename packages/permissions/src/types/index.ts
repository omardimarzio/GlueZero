/**
 * Barrel types per `@gluezero/permissions`.
 *
 * Espone interfacce pubbliche PRD §17 (capabilities) + §19 (permissions) +
 * descriptor type narrowing locale (D-V2-F11-17/22 strict).
 *
 * @see prd_2.0.0.md §17 (Capability negotiation), §19 (Permission module)
 */

export type {
  MicroFrontendPermissions,
  PermissionPattern,
  PermissionCategory,
} from './permissions'

export type {
  MicroFrontendCapabilities,
  CapabilityRequirement,
  CapabilityProvision,
  CapabilityCheckResult,
  CapabilityIncompatibility,
  CapabilityPolicy,
} from './capabilities'

export type {
  PermissionAwareMfDescriptor,
} from './descriptor-augment'

/**
 * Setup-time options per `permissionsModule()` factory.
 *
 * D-V2-F11-18 — 2 setup options (ratificata divergenza F10 D-V2-F10-18):
 * - `permissionMode`: enforcement globale di TUTTI i pattern di permessi
 *   (`off` / `warn` / `enforce`). Default `enforce`.
 * - `capabilityPolicy`: policy globale capability check (`off` / `warn` /
 *   `block-load` / `block-mount`). Default `warn`. Override per-MF via
 *   `descriptor.capabilities.policy` (D-V2-F11-12 more-strict wins).
 *
 * @see D-V2-F11-18 (setup-time options 2-field)
 */
export interface PermissionsModuleOptions {
  readonly permissionMode?: 'off' | 'warn' | 'enforce'
  readonly capabilityPolicy?: 'off' | 'warn' | 'block-load' | 'block-mount'
}
