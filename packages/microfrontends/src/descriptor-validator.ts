/**
 * MicroFrontendDescriptor Valibot schema register-time strict (D-V2-11 BLOCKING).
 *
 * Validate descriptor a register-time, throw `MF_DESCRIPTOR_INVALID` con
 * `{field, reason, issues}` dettagliato. NO default silente, NO coercion.
 *
 * Sub-shapes F10-F14 lasciati `v.unknown()` placeholder — effective validation
 * nelle rispettive fasi target.
 *
 * @see RESEARCH §4 + PATTERNS §31
 */
import * as v from 'valibot'
import { createMfError } from './microfrontend-error'
import type { MicroFrontendDescriptor } from './types/descriptor'

/** Regex id MF (PRD §11.4). */
const MF_ID_REGEX = /^[a-z0-9._-]+$/

/** SemVer 2.0 regex. */
const SEMVER_REGEX = /^\d+\.\d+\.\d+(-[a-z0-9.-]+)?(\+[a-z0-9.-]+)?$/i

const MicroFrontendIdSchema = v.pipe(
  v.string(),
  v.regex(MF_ID_REGEX, 'id must match /^[a-z0-9._-]+$/ (PRD §11.4)'),
  v.minLength(1, 'id must be non-empty'),
  v.maxLength(64, 'id must be ≤ 64 chars'),
)

const MicroFrontendVersionSchema = v.pipe(
  v.string(),
  v.regex(SEMVER_REGEX, 'version must be SemVer 2.0 (X.Y.Z[-pre][+build])'),
)

const MicroFrontendOwnerSchema = v.object({
  team: v.optional(v.string()),
  contact: v.optional(v.string()),
  repository: v.optional(v.string()),
  documentation: v.optional(v.string()),
})

const MicroFrontendLoaderDefinitionSchema = v.object({
  type: v.string(),
  url: v.optional(v.string()),
  timeoutMs: v.optional(v.number()),
  exportName: v.optional(v.string()),
  options: v.optional(v.record(v.string(), v.unknown())),
})

const MicroFrontendMountDefinitionSchema = v.object({
  selector: v.optional(v.string()),
  element: v.optional(v.unknown()), // HTMLElement runtime
  strategy: v.optional(v.picklist(['direct', 'shadow-dom', 'iframe', 'custom'])),
  containerId: v.optional(v.string()),
  clearBeforeMount: v.optional(v.boolean()),
  preserveOnUnmount: v.optional(v.boolean()),
  attributes: v.optional(v.record(v.string(), v.string())),
  className: v.optional(v.string()),
  style: v.optional(v.record(v.string(), v.string())),
  options: v.optional(v.record(v.string(), v.unknown())),
})

const MicroFrontendContractsSchema = v.object({
  topics: v.optional(v.array(v.unknown())),
  routes: v.optional(v.array(v.unknown())),
  workers: v.optional(v.array(v.unknown())),
  contexts: v.optional(v.array(v.unknown())),
  theme: v.optional(v.unknown()),
  validation: v.optional(v.picklist(['warn', 'fail-registration', 'fail-mount'])),
})

const MicroFrontendMappingSchema = v.object({
  namespace: v.optional(v.string()),
  inputMap: v.optional(v.unknown()),
  outputMap: v.optional(v.unknown()),
  serverMap: v.optional(v.unknown()),
  contextMap: v.optional(v.unknown()),
  strict: v.optional(v.boolean()),
})

/**
 * Schema completo `MicroFrontendDescriptor` (PRD §11.2).
 *
 * Annotazione esplicita `GenericSchema<unknown, unknown>` richiesta da
 * `isolatedDeclarations: true` (tsconfig.base.json:17). Output `unknown` per
 * evitare clash con `exactOptionalPropertyTypes: true` su `description?: string`
 * vs Valibot infer `description?: string | undefined`. La funzione
 * `validateDescriptor` fa il narrowing finale al tipo `MicroFrontendDescriptor`
 * (cast safe post-validation).
 */
export const MicroFrontendDescriptorSchema: v.GenericSchema<unknown, unknown> = v.object({
  id: MicroFrontendIdSchema,
  name: v.pipe(v.string(), v.minLength(1, 'name must be non-empty')),
  version: MicroFrontendVersionSchema,

  description: v.optional(v.string()),
  owner: v.optional(MicroFrontendOwnerSchema),
  loader: v.optional(MicroFrontendLoaderDefinitionSchema),
  mount: v.optional(MicroFrontendMountDefinitionSchema),
  contracts: v.optional(MicroFrontendContractsSchema),
  mapping: v.optional(MicroFrontendMappingSchema),

  // Placeholder F10-F14 (effective validation nelle fasi target):
  capabilities: v.optional(v.unknown()),
  permissions: v.optional(v.unknown()),
  compatibility: v.optional(v.unknown()),
  isolation: v.optional(v.unknown()),
  context: v.optional(v.unknown()),
  theme: v.optional(v.unknown()),
  fallback: v.optional(v.unknown()),
  observability: v.optional(v.unknown()),

  // Open-ended (OQ-04 CONTEXT.md specifics):
  metadata: v.optional(v.record(v.string(), v.unknown())),
})

/**
 * Subset minimale Valibot issue rilevante per il mapping.
 *
 * Riferimento: stesso pattern del mapper-engine in `packages/mapper/src/valibot-adapter.ts`.
 */
interface ValibotIssueLike {
  readonly path?: ReadonlyArray<{ readonly key: unknown }>
  readonly message: string
}

/**
 * Valida un descriptor MF register-time strict (D-V2-11).
 *
 * @param d - Descriptor candidato (unknown).
 * @returns Descriptor validato (tipo narrowed).
 * @throws `BrokerError` con `code: 'MF_DESCRIPTOR_INVALID'` se validation fail.
 *   `details` contiene `field` (path concatenato), `reason` (messaggio primo issue),
 *   `issues` (array completo).
 *
 * @example
 * ```ts
 * const descriptor = validateDescriptor({
 *   id: 'customer-dashboard',
 *   name: 'Customer Dashboard',
 *   version: '1.0.0',
 *   loader: { type: 'esm', url: '/mfs/customer.js' },
 *   mount: { strategy: 'direct', selector: '#root' },
 * })
 * // → MicroFrontendDescriptor (validated)
 *
 * try {
 *   validateDescriptor({ id: 'INVALID UPPERCASE', name: 'X', version: '1.0.0' })
 * } catch (err) {
 *   console.log(err.code) // 'MF_DESCRIPTOR_INVALID'
 *   console.log(err.details.field) // 'id'
 *   console.log(err.details.reason) // 'id must match /^[a-z0-9._-]+$/'
 * }
 * ```
 */
export function validateDescriptor(d: unknown): MicroFrontendDescriptor {
  const result = v.safeParse(MicroFrontendDescriptorSchema, d)
  if (!result.success) {
    const firstIssue = result.issues[0] as ValibotIssueLike
    const fieldPath = (firstIssue.path ?? []).map((p) => String(p.key)).join('.')
    throw createMfError({
      code: 'MF_DESCRIPTOR_INVALID',
      message: `Invalid MicroFrontendDescriptor: ${firstIssue.message}`,
      details: {
        field: fieldPath || '<root>',
        reason: firstIssue.message,
        issues: (result.issues as readonly ValibotIssueLike[]).map((i) => ({
          path: (i.path ?? []).map((p) => String(p.key)),
          message: i.message,
        })),
      },
    })
  }
  return result.output as MicroFrontendDescriptor
}
