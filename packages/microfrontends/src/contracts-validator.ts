/**
 * Contracts Validator (MF-CONTRACT-02).
 *
 * Valida la dichiarazione contratti del MF descriptor con policy configurabile:
 * - `warn` (default F8): log warnings, returns `{ok: true, warnings}` — non bloccante
 * - `fail-registration`: throw `MF_DESCRIPTOR_INVALID` a register-time se shape invalid
 * - `fail-mount`: throw `MF_DESCRIPTOR_INVALID` a mount-time se shape invalid
 *
 * F8 placeholder scope: structural shape check only (presenza arrays/object types).
 * Effective check vs registry state (topic registry / route registry / capability /
 * theme) arriva in F11 (permissions/capabilities) + F13 (isolation/theme).
 *
 * @see RESEARCH §13.W4 + PRD §15 + MF-CONTRACT-02
 */
import { createMfError } from './microfrontend-error'
import type {
  ContractValidationPolicy,
  MicroFrontendContracts,
} from './types/contracts'

/** Phase di trigger della validation (per error message context). */
export type ValidationPhase = 'register' | 'mount'

/** Severity di warning interno. */
export type ContractWarningSeverity = 'info' | 'warning' | 'error'

/** Warning structure dettagliata. */
export interface ContractWarning {
  readonly severity: ContractWarningSeverity
  readonly contractType: 'topics' | 'routes' | 'workers' | 'contexts' | 'theme'
  readonly message: string
  readonly details?: Record<string, unknown>
}

/** Risultato della validation. */
export interface ContractValidationResult {
  readonly ok: boolean
  readonly warnings: readonly ContractWarning[]
  readonly errors: readonly ContractWarning[]
}

/** Context passato a `validateContracts` (per logging opzionale). */
export interface ContractValidationContext {
  readonly mfId: string
  readonly phase: ValidationPhase
  /** Logger opzionale per emissione warnings. */
  readonly logger?: {
    warn?: (msg: string, meta?: unknown) => void
    info?: (msg: string, meta?: unknown) => void
  }
}

/**
 * Valida i contracts del MF descriptor secondo la policy.
 *
 * @param contracts - Contracts dal descriptor (undefined = no validation, return ok)
 * @param ctx - Context con mfId/phase/logger
 * @returns Risultato `ContractValidationResult` con warnings + errors
 *
 * @throws `MF_DESCRIPTOR_INVALID` se policy `fail-registration` / `fail-mount` e shape errors
 *
 * @example
 * ```ts
 * import { validateContracts } from '@gluezero/microfrontends'
 *
 * const result = validateContracts(
 *   descriptor.contracts,
 *   { mfId: 'customer-dashboard', phase: 'register' },
 * )
 * if (result.warnings.length > 0) {
 *   console.warn('Contract warnings:', result.warnings)
 * }
 * ```
 */
export function validateContracts(
  contracts: MicroFrontendContracts | undefined,
  ctx: ContractValidationContext,
): ContractValidationResult {
  // No contracts dichiarati = no validation (return ok)
  if (!contracts) {
    return { ok: true, warnings: [], errors: [] }
  }

  const policy: ContractValidationPolicy = contracts.validation ?? 'warn'
  const warnings: ContractWarning[] = []
  const errors: ContractWarning[] = []

  // F8 placeholder shape checks (structural only — F11/F13 effective check)

  // Topics
  if (contracts.topics !== undefined) {
    if (!Array.isArray(contracts.topics)) {
      errors.push({
        severity: 'error',
        contractType: 'topics',
        message: `contracts.topics must be an array`,
        details: { mfId: ctx.mfId, providedType: typeof contracts.topics },
      })
    } else {
      for (const t of contracts.topics) {
        const tt = t as { topic?: string; direction?: string }
        if (typeof tt.topic !== 'string' || tt.topic.length === 0) {
          warnings.push({
            severity: 'warning',
            contractType: 'topics',
            message: `topic must be non-empty string`,
            details: { mfId: ctx.mfId, provided: tt },
          })
        }
        if (
          tt.direction !== 'publish' &&
          tt.direction !== 'subscribe' &&
          tt.direction !== 'both'
        ) {
          warnings.push({
            severity: 'warning',
            contractType: 'topics',
            message: `topic direction must be 'publish' | 'subscribe' | 'both'`,
            details: { mfId: ctx.mfId, topic: tt.topic, provided: tt.direction },
          })
        }
      }
    }
  }

  // Routes (structural only)
  if (contracts.routes !== undefined && !Array.isArray(contracts.routes)) {
    errors.push({
      severity: 'error',
      contractType: 'routes',
      message: `contracts.routes must be an array`,
      details: { mfId: ctx.mfId, providedType: typeof contracts.routes },
    })
  }

  // Workers (structural only)
  if (contracts.workers !== undefined && !Array.isArray(contracts.workers)) {
    errors.push({
      severity: 'error',
      contractType: 'workers',
      message: `contracts.workers must be an array`,
      details: { mfId: ctx.mfId, providedType: typeof contracts.workers },
    })
  }

  // Contexts (structural only)
  if (contracts.contexts !== undefined && !Array.isArray(contracts.contexts)) {
    errors.push({
      severity: 'error',
      contractType: 'contexts',
      message: `contracts.contexts must be an array`,
      details: { mfId: ctx.mfId, providedType: typeof contracts.contexts },
    })
  }

  // Theme (structural only — può essere object oppure undefined)
  if (
    contracts.theme !== undefined &&
    (typeof contracts.theme !== 'object' || contracts.theme === null)
  ) {
    errors.push({
      severity: 'error',
      contractType: 'theme',
      message: `contracts.theme must be an object`,
      details: { mfId: ctx.mfId, providedType: typeof contracts.theme },
    })
  }

  // Apply policy
  const hasErrors = errors.length > 0

  // Policy `warn`: log + return — no throw, errors degradano a warnings
  if (policy === 'warn') {
    if (ctx.logger?.warn) {
      for (const w of [...warnings, ...errors]) {
        ctx.logger.warn(`[contracts:${w.contractType}] ${w.message}`, w.details)
      }
    }
    return { ok: true, warnings: [...warnings, ...errors], errors: [] }
  }

  // Policy `fail-registration` / `fail-mount`: throw se errors presenti e phase corrispondente
  if (
    (policy === 'fail-registration' && ctx.phase === 'register') ||
    (policy === 'fail-mount' && ctx.phase === 'mount')
  ) {
    const firstError = errors[0]
    if (firstError !== undefined) {
      throw createMfError({
        code: 'MF_DESCRIPTOR_INVALID',
        message: `Contract validation failed for MF "${ctx.mfId}" (policy=${policy}, phase=${ctx.phase}): ${firstError.message}`,
        details: {
          mfId: ctx.mfId,
          phase: ctx.phase,
          policy,
          contractType: firstError.contractType,
          errors: errors.map((e) => ({ type: e.contractType, message: e.message })),
        },
      })
    }
  }

  // Policy fail-* su phase non corrispondente → degrade a warn (log) ma preserva errors nel result
  if (ctx.logger?.warn) {
    for (const w of [...warnings, ...errors]) {
      ctx.logger.warn(`[contracts:${w.contractType}] ${w.message}`, w.details)
    }
  }

  return {
    ok: !hasErrors,
    warnings,
    errors,
  }
}
