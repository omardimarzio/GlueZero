/**
 * MicroFrontendsService implementation (MF-REG-01..04, MF-LOADER-REG-01..02).
 *
 * - CRUD complete: register/unregister/get/list/getState/getSnapshot
 * - `inFlight: Map<id, {op, promise}>` prep (P-04 mitigation — pieno wiring W3-P07)
 * - Cascade `unregister → broker.unsubscribeByOwner(mfOwnerId(id))` (D-V2-16)
 * - Lifecycle ops stub (load/bootstrap/mount/unmount/destroy) → throw `MF_NOT_REGISTERED`
 *   con `details.phase = 'W2-stub'` per disambiguare nei test che chiamano lifecycle
 *   prima del wiring FSM W3-P06.
 *
 * Pattern Registry replica F2 `canonical-registry.ts` (Map interno + idempotent
 * delete) MA con `inFlight` Map preparatorio + cascade unsubscribe (D-V2-16).
 *
 * @see RESEARCH §3, §10 + PATTERNS §32 + D-V2-16 + PRD §10
 */
import type { BrokerModuleContext } from '@gluezero/core'
import { validateDescriptor } from './descriptor-validator'
import { mfOwnerId } from './internal/owner-id'
import { LoaderRegistry, type MicroFrontendLoaderAdapter } from './loader-registry'
import { createMfError } from './microfrontend-error'
import type { MicroFrontendDescriptor, MicroFrontendRegistration } from './types/descriptor'
import type { MicroFrontendState } from './types/lifecycle'

/** Operazione lifecycle tracciata in `inFlight` Map (P-04 prep). */
export type LifecycleOp = 'load' | 'bootstrap' | 'mount' | 'update' | 'unmount' | 'destroy'

/** Snapshot debug del MF — shape stub F8 (devtools complete in F16). */
export interface MicroFrontendDebugSnapshot {
  readonly id: string
  readonly state: MicroFrontendState
  readonly previousState?: MicroFrontendState
  readonly descriptor: MicroFrontendDescriptor
  readonly failureReason?: {
    readonly phase: string
    readonly message: string
    readonly timestamp: number
  }
}

/** Filter passato a `service.list()`. */
export interface ListFilter {
  readonly state?: MicroFrontendState
}

/** Options passati a `service.load()` — F9 effective. */
export interface LoadOptions {
  readonly signal?: AbortSignal
}

/** Options passati a `service.mount()`. */
export interface MountOptions {
  readonly skipBootstrap?: boolean
}

/**
 * Service implementation registrato come `SERVICE_MICROFRONTENDS` nel Broker.
 *
 * Service Locator typed: consumer fa
 * `broker.getService<MicroFrontendsService>(SERVICE_MICROFRONTENDS)`.
 */
export interface MicroFrontendsService {
  // ===== Registry CRUD (MF-REG-01..04) =====
  register(descriptor: MicroFrontendDescriptor): Promise<void>
  unregister(id: string, options?: { force?: boolean }): Promise<void>
  get(id: string): MicroFrontendRegistration | undefined
  list(filter?: ListFilter): readonly MicroFrontendRegistration[]
  getState(id: string): MicroFrontendState | undefined
  getSnapshot(id?: string): MicroFrontendDebugSnapshot | undefined

  // ===== Lifecycle ops (W3 wired) =====
  load(id: string, options?: LoadOptions): Promise<void>
  bootstrap(id: string): Promise<void>
  mount(id: string, options?: MountOptions): Promise<void>
  unmount(id: string): Promise<void>
  destroy(id: string, options?: { force?: boolean }): Promise<void>

  // ===== Loader Registry (MF-LOADER-REG-01..02) =====
  registerLoader(adapter: MicroFrontendLoaderAdapter): void
  unregisterLoader(type: string): boolean
  getLoader(type: string): MicroFrontendLoaderAdapter | undefined
  getLoaders(): readonly MicroFrontendLoaderAdapter[]
}

/**
 * Factory `MicroFrontendsService` chiamata da `microfrontendModule().install(ctx)`.
 *
 * Riceve `BrokerModuleContext` per accedere a `broker` (per cascade unsubscribe MIN-2).
 *
 * @example
 * ```ts
 * // Internal usage (microfrontend-module.ts):
 * install(ctx) {
 *   const service = createMicroFrontendsService(ctx)
 *   ctx.registerService(SERVICE_MICROFRONTENDS, service)
 * }
 * ```
 */
export function createMicroFrontendsService(ctx: BrokerModuleContext): MicroFrontendsService {
  /** Storage descriptor + state per id. */
  const registrations = new Map<string, MicroFrontendRegistration>()

  /**
   * Operazioni in-flight per id (P-04 prep — wiring W3-P07).
   *
   * Dichiarato in W2 per concretezza del tipo + readiness al wire-up W3.
   * Nessun set/delete in W2 perché lifecycle ops sono stub. W3-P07 popola
   * questa Map durante load/bootstrap/mount/etc. per concurrency control.
   */
  // biome-ignore lint/correctness/noUnusedVariables: P-04 prep — wiring W3-P07
  const inFlight = new Map<string, { readonly op: LifecycleOp; readonly promise: Promise<void> }>()

  /** Loader Registry interno (delegato da registerLoader/etc.). */
  const loaders = new LoaderRegistry()

  const broker = ctx.broker

  // ===== CRUD =====

  async function register(descriptor: MicroFrontendDescriptor): Promise<void> {
    // MF-DESC-03 + D-V2-11: Valibot validate strict register-time
    const validated = validateDescriptor(descriptor)

    // MF-REG-03: duplicate detection (no override silente)
    if (registrations.has(validated.id)) {
      throw createMfError({
        code: 'MF_DESCRIPTOR_INVALID',
        message: `MicroFrontend "${validated.id}" already registered`,
        details: { id: validated.id, reason: 'duplicate' },
      })
    }

    const reg: MicroFrontendRegistration = {
      descriptor: validated,
      state: 'registered',
      timings: { registeredAt: Date.now() },
    }
    registrations.set(validated.id, reg)
  }

  async function unregister(id: string, _options?: { force?: boolean }): Promise<void> {
    const reg = registrations.get(id)
    if (!reg) return // idempotent no-op (PRD §10.6)

    try {
      // W3-P06+P07 wire-up: chiamare lifecycle.destroy(id) qui prima del cascade.
      // F8 W2 stub: nessun lifecycle FSM ancora attivo, skip destroy. Cascade
      // comunque eseguito. Vedi 08-06/08-07 per wire-up completo.
      if (reg.state === 'mounted') {
        // F8 stub: lascio l'unregister procedere — il FSM W3 enforcerà la sequence
      }
    } finally {
      // D-V2-16 + MIN-2 cascade — SEMPRE eseguito (anche su error nel destroy futuro).
      broker.unsubscribeByOwner(mfOwnerId(id))
      registrations.delete(id)
    }
  }

  function get(id: string): MicroFrontendRegistration | undefined {
    return registrations.get(id)
  }

  function list(filter?: ListFilter): readonly MicroFrontendRegistration[] {
    const all = [...registrations.values()] // fresh copy (T-02-06 mutation guard)
    if (filter?.state !== undefined) {
      return all.filter((r) => r.state === filter.state)
    }
    return all
  }

  function getState(id: string): MicroFrontendState | undefined {
    return registrations.get(id)?.state
  }

  function getSnapshot(id?: string): MicroFrontendDebugSnapshot | undefined {
    if (id !== undefined) {
      const r = registrations.get(id)
      if (!r) return undefined
      return buildSnapshot(r)
    }
    // No id → restituisce il primo registrato (F8 stub; F16 espone array completo).
    const first = registrations.values().next().value
    if (!first) return undefined
    return buildSnapshot(first)
  }

  function buildSnapshot(r: MicroFrontendRegistration): MicroFrontendDebugSnapshot {
    const base: MicroFrontendDebugSnapshot = {
      id: r.descriptor.id,
      state: r.state,
      descriptor: r.descriptor,
      ...(r.previousState !== undefined && { previousState: r.previousState }),
      ...(r.failureReason && {
        failureReason: {
          phase: r.failureReason.phase,
          message: r.failureReason.error.message,
          timestamp: r.failureReason.timestamp,
        },
      }),
    }
    return base
  }

  // ===== Lifecycle ops (W3 wired) =====
  // F8 W2 stub: throw MF_NOT_REGISTERED con `phase: 'W2-stub'` per disambiguare
  // nei test. Wiring effettivo in 08-06 (FSM transitions) + 08-07 (concurrency).

  function unimplementedW3(op: LifecycleOp): Promise<void> {
    return Promise.reject(
      createMfError({
        code: 'MF_NOT_REGISTERED',
        message: `Lifecycle op "${op}" stubbed in W2; full impl in W3-P06/P07`,
        details: { op, phase: 'W2-stub' },
      }),
    )
  }

  function load(_id: string, _options?: LoadOptions): Promise<void> {
    return unimplementedW3('load')
  }

  function bootstrap(_id: string): Promise<void> {
    return unimplementedW3('bootstrap')
  }

  function mount(_id: string, _options?: MountOptions): Promise<void> {
    return unimplementedW3('mount')
  }

  function unmount(_id: string): Promise<void> {
    return unimplementedW3('unmount')
  }

  function destroy(_id: string, _options?: { force?: boolean }): Promise<void> {
    return unimplementedW3('destroy')
  }

  // ===== Loader Registry delegate =====

  function registerLoader(adapter: MicroFrontendLoaderAdapter): void {
    loaders.register(adapter)
  }

  function unregisterLoader(type: string): boolean {
    return loaders.unregister(type)
  }

  function getLoader(type: string): MicroFrontendLoaderAdapter | undefined {
    return loaders.get(type)
  }

  function getLoaders(): readonly MicroFrontendLoaderAdapter[] {
    return loaders.list()
  }

  return {
    register,
    unregister,
    get,
    list,
    getState,
    getSnapshot,
    load,
    bootstrap,
    mount,
    unmount,
    destroy,
    registerLoader,
    unregisterLoader,
    getLoader,
    getLoaders,
  }
}
