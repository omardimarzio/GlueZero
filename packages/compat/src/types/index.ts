// Barrel re-export dei tipi pubblici del package `@gluezero/compat`.
// Coerente con pattern F11 `packages/permissions/src/types/*` — single barrel,
// solo `export type` per types-only API (zero runtime cost).
export type { MicroFrontendCompatibility } from './compatibility'
export type {
  CompatibilityIssue,
  CompatibilityIssueType,
  CompatibilityReport,
} from './report'
export type { CompatibilityPolicy } from './policy'
export type { CompatAwareMfDescriptor } from './descriptor-augment'
export { getCompatibility } from './descriptor-augment'
