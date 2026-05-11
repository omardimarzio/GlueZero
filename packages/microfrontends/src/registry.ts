/**
 * MicroFrontendsService implementation (MF-REG-01..04, MF-LOADER-REG-01..02, MF-LIFE-03..05, MF-LIFE-07).
 *
 * - CRUD complete: register/unregister/get/list/getState/getSnapshot
 * - Lifecycle ops wired (W3-P07): load/bootstrap/mount/unmount/destroy
 *   - `runOp(id, op, body)` helper centralizza: lookup registration → check `inFlight`
 *     idempotency → strict identity per stesso op (P-04) → throw `MF_LIFECYCLE_IN_FLIGHT`
 *     per op diverso concorrente → wrap body con `.finally(inFlight.delete)`
 *   - Auto-bootstrap D-V2-07: `mount(id)` su `state === 'loaded'` chiama `bootstrap`
 *     automaticamente; override via `options.skipBootstrap: true`
 *   - Idempotency (PRD §10.6): `mount` su `mounted` = no-op + debug log;
 *     `destroy` su `destroyed` = no-op silente
 * - Cascade `destroy → broker.unsubscribeByOwner(mfOwnerId(id))` SEMPRE in `finally`
 *   (D-V2-16 + MIN-2)
 * - Failure: transition → 'failed' con `failureReason.phase` discriminato (D-V2-06)
 *
 * Pattern Registry replica F2 `canonical-registry.ts` (Map interno + idempotent
 * delete) MA con `inFlight` Map populated + cascade unsubscribe (D-V2-16).
 *
 * NOTA F8 W3-P07: i lifecycle hook ricevono uno stub minimale `RuntimeContext`
 * (publish/subscribe no-op) — il RuntimeContext facade completo arriva in W5-P11
 * (createMfRuntimeContext con auto-tagging + metadata enrichment).
 *
 * @see RESEARCH §3, §10 + PATTERNS §32 + D-V2-16 + D-V2-07 + PRD §10
 */
import type { BrokerModuleContext } from '@gluezero/core'
import { validateDescriptor } from './descriptor-validator'
import { mfOwnerId } from './internal/owner-id'
import { LifecycleManager } from './lifecycle-fsm'
import {
  type LoadedModule,
  type LoaderContext,
  LoaderRegistry,
  type MicroFrontendLoaderAdapter,
} from './loader-registry'
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
   * Operazioni in-flight per id (P-04 mitigation — wired W3-P07).
   *
   * Map<id, {op, promise}>: stesso op concorrente = stessa Promise strict identity;
   * op diverso concorrente = throw `MF_LIFECYCLE_IN_FLIGHT`. Cleanup naturale via
   * `.finally(() => inFlight.delete(id))` (OQ-06: NO TTL, deferred V2.1).
   */
  const inFlight = new Map<string, { readonly op: LifecycleOp; readonly promise: Promise<void> }>()

  /** Loader Registry interno (delegato da registerLoader/etc.). */
  const loaders = new LoaderRegistry()

  /** Lifecycle FSM instance — writer autoritativo delle transitions (W3-P06). */
  const fsm = new LifecycleManager()

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

  async function unregister(id: string, options?: { force?: boolean }): Promise<void> {
    const reg = registrations.get(id)
    if (!reg) return // idempotent no-op (PRD §10.6)

    try {
      // Se non destroyed, prova a chiamare destroy (cascade transitions FSM-driven).
      if (reg.state !== 'destroyed') {
        try {
          await destroy(id, options?.force ? { force: true } : {})
        } catch (err) {
          // Force OR re-throw: se force=true swallow per consentire cleanup anche con destroy fail.
          if (!options?.force) throw err
        }
      }
    } finally {
      // D-V2-16 + MIN-2 cascade — SEMPRE eseguito (anche su error nel destroy).
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

  // ===== Lifecycle ops (W3-P07 wired) =====

  /**
   * Helper centralizzato per esecuzione idempotent + concurrent-safe delle lifecycle ops.
   *
   * Pattern P-04 mitigation:
   * 1. Lookup `registrations.get(id)` → throw `MF_NOT_REGISTERED` se assente
   * 2. Check `inFlight.get(id)`:
   *    - stesso `op` → ritorna stessa Promise strict identity (idempotent concurrent)
   *    - `op` diverso → throw `MF_LIFECYCLE_IN_FLIGHT` con dettaglio currentOp/requestedOp
   * 3. Wrap `body(reg)` in Promise + `.finally(inFlight.delete(id))` (cleanup naturale)
   * 4. `inFlight.set(id, {op, promise})` → return promise
   */
  async function runOp(
    id: string,
    op: LifecycleOp,
    body: (reg: MicroFrontendRegistration) => Promise<void>,
  ): Promise<void> {
    const reg = registrations.get(id)
    if (!reg) {
      throw createMfError({
        code: 'MF_NOT_REGISTERED',
        message: `MicroFrontend "${id}" not registered`,
        details: { id, op },
      })
    }

    // P-04: idempotency + concurrent-safe.
    const existing = inFlight.get(id)
    if (existing) {
      if (existing.op === op) {
        // Identità stretta: chiamata concorrente identica → stessa Promise.
        return existing.promise
      }
      throw createMfError({
        code: 'MF_LIFECYCLE_IN_FLIGHT',
        message: `MicroFrontend "${id}" busy with op "${existing.op}", cannot start "${op}"`,
        details: { id, currentOp: existing.op, requestedOp: op },
      })
    }

    const promise = body(reg).finally(() => {
      // Cleanup naturale Promise resolve/reject (OQ-06: NO TTL, deferred V2.1).
      inFlight.delete(id)
    })
    inFlight.set(id, { op, promise })
    return promise
  }

  /**
   * Stub runtime context F8 — minimo per soddisfare il chiamato lifecycle hook.
   *
   * W5-P11 introdurrà `createMfRuntimeContext` con facade publish/subscribe completo
   * (auto-enrichment metadata + ownerId auto-tagging D-V2-16).
   */
  function makeStubRuntimeContext(reg: MicroFrontendRegistration): unknown {
    return {
      id: reg.descriptor.id,
      descriptor: reg.descriptor,
      broker,
      publish: (..._args: unknown[]) => {},
      subscribe: (..._args: unknown[]) => ({ unsubscribe: () => {} }),
      logger: ctx.logger,
    }
  }

  async function load(id: string, options?: LoadOptions): Promise<void> {
    return runOp(id, 'load', async (reg) => {
      // Idempotenza: già loaded (o oltre) = no-op (PRD §10.6 + MF-LIFE-07).
      if (
        reg.state === 'loaded' ||
        reg.state === 'bootstrapping' ||
        reg.state === 'bootstrapped' ||
        reg.state === 'mounting' ||
        reg.state === 'mounted' ||
        reg.state === 'unmounting' ||
        reg.state === 'unmounted'
      ) {
        return
      }

      const loaderType = reg.descriptor.loader?.type
      if (!loaderType) {
        throw createMfError({
          code: 'MF_LOADER_NOT_FOUND',
          message: `MicroFrontend "${id}" has no loader.type in descriptor`,
          details: { id },
        })
      }

      const adapter = loaders.get(loaderType)
      if (!adapter) {
        const err = new Error(`Loader type "${loaderType}" not registered`)
        fsm.transition(reg, 'failed', { phase: 'load', error: err })
        throw createMfError({
          code: 'MF_LOADER_NOT_FOUND',
          message: `Loader type "${loaderType}" not registered`,
          details: { id, loaderType },
        })
      }

      try {
        fsm.transition(reg, 'resolving')
        fsm.transition(reg, 'loading')

        const loaderCtx: LoaderContext = {
          broker,
          descriptor: reg.descriptor,
          ...(options?.signal && { signal: options.signal }),
          ...(ctx.logger && { logger: ctx.logger }),
        }
        // biome-ignore lint/style/noNonNullAssertion: loader presente verificato sopra
        const loaded = await adapter.load(reg.descriptor.loader!, loaderCtx)
        reg.loadedModule = loaded
        fsm.transition(reg, 'loaded')
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err))
        // Solo se non già 'failed' (e.g. dal check loader non registrato)
        if (reg.state !== 'failed') {
          fsm.transition(reg, 'failed', { phase: 'load', error: errorObj })
        }
        throw err
      }
    })
  }

  async function bootstrap(id: string): Promise<void> {
    return runOp(id, 'bootstrap', async (reg) => {
      // Idempotenza: già bootstrapped o oltre = no-op (PRD §10.6).
      if (
        reg.state === 'bootstrapped' ||
        reg.state === 'mounting' ||
        reg.state === 'mounted' ||
        reg.state === 'unmounting' ||
        reg.state === 'unmounted'
      ) {
        return
      }

      if (reg.state !== 'loaded') {
        throw createMfError({
          code: 'MF_STATE_INVALID',
          message: `MicroFrontend "${id}" must be in 'loaded' state to bootstrap (current: ${reg.state})`,
          details: { id, currentState: reg.state, requiredState: 'loaded' },
        })
      }

      try {
        fsm.transition(reg, 'bootstrapping')
        const loaded = reg.loadedModule as LoadedModule | undefined
        if (loaded?.lifecycle.bootstrap) {
          const stubCtx = makeStubRuntimeContext(reg)
          await loaded.lifecycle.bootstrap(stubCtx as never)
        }
        fsm.transition(reg, 'bootstrapped')
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err))
        fsm.transition(reg, 'failed', { phase: 'bootstrap', error: errorObj })
        throw err
      }
    })
  }

  async function mount(id: string, options?: MountOptions): Promise<void> {
    return runOp(id, 'mount', async (reg) => {
      // Idempotenza: già mounted = no-op + debug log (PRD §10.6 + MF-LIFE-07).
      if (reg.state === 'mounted') {
        ctx.logger?.debug?.(`[microfrontends] mount("${id}") no-op (already mounted)`)
        return
      }

      // D-V2-07 auto-bootstrap: se state 'loaded' e non skipBootstrap, chiama bootstrap inline.
      // NB: chiamata interna NON via runOp (siamo già dentro runOp 'mount' wrapping).
      if (reg.state === 'loaded' && !options?.skipBootstrap) {
        try {
          fsm.transition(reg, 'bootstrapping')
          const loaded = reg.loadedModule as LoadedModule | undefined
          if (loaded?.lifecycle.bootstrap) {
            const stubCtx = makeStubRuntimeContext(reg)
            await loaded.lifecycle.bootstrap(stubCtx as never)
          }
          fsm.transition(reg, 'bootstrapped')
        } catch (err) {
          const errorObj = err instanceof Error ? err : new Error(String(err))
          fsm.transition(reg, 'failed', { phase: 'bootstrap', error: errorObj })
          throw err
        }
      }

      if (reg.state !== 'bootstrapped' && reg.state !== 'unmounted') {
        throw createMfError({
          code: 'MF_STATE_INVALID',
          message: `MicroFrontend "${id}" must be 'bootstrapped' or 'unmounted' to mount (current: ${reg.state})`,
          details: { id, currentState: reg.state },
        })
      }

      try {
        fsm.transition(reg, 'mounting')
        const loaded = reg.loadedModule as LoadedModule | undefined
        if (loaded?.lifecycle.mount) {
          const stubCtx = makeStubRuntimeContext(reg)
          await loaded.lifecycle.mount(stubCtx as never)
        }
        fsm.transition(reg, 'mounted')
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err))
        fsm.transition(reg, 'failed', { phase: 'mount', error: errorObj })
        throw err
      }
    })
  }

  async function unmount(id: string): Promise<void> {
    return runOp(id, 'unmount', async (reg) => {
      // Idempotenza: non-mounted = no-op + debug log (PRD §10.6).
      if (reg.state !== 'mounted') {
        ctx.logger?.debug?.(`[microfrontends] unmount("${id}") no-op (state: ${reg.state})`)
        return
      }

      try {
        fsm.transition(reg, 'unmounting')
        const loaded = reg.loadedModule as LoadedModule | undefined
        if (loaded?.lifecycle.unmount) {
          const stubCtx = makeStubRuntimeContext(reg)
          await loaded.lifecycle.unmount(stubCtx as never)
        }
        fsm.transition(reg, 'unmounted')
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err))
        fsm.transition(reg, 'failed', { phase: 'unmount', error: errorObj })
        throw err
      }
    })
  }

  async function destroy(id: string, options?: { force?: boolean }): Promise<void> {
    return runOp(id, 'destroy', async (reg) => {
      // Idempotenza silente: destroyed = no-op senza warn (PRD §10.6 cleanup multi-path).
      if (reg.state === 'destroyed') return

      // Force option: skippa transition checks (cleanup forzato).
      if (options?.force) {
        try {
          const loaded = reg.loadedModule as LoadedModule | undefined
          loaded?.lifecycle.destroy?.(makeStubRuntimeContext(reg) as never)
        } catch {
          // Force = swallow errors hook
        }
        // Force transition direct (bypass FSM enforcement).
        reg.previousState = reg.state
        reg.state = 'destroyed'
        reg.timings = { ...reg.timings, destroyedAt: Date.now() }
        // Cascade cleanup.
        broker.unsubscribeByOwner(mfOwnerId(id))
        return
      }

      try {
        // Se mounted, dobbiamo passare per unmounting prima (FSM enforcement).
        if (reg.state === 'mounted') {
          fsm.transition(reg, 'unmounting')
          const loaded = reg.loadedModule as LoadedModule | undefined
          if (loaded?.lifecycle.unmount) {
            await loaded.lifecycle.unmount(makeStubRuntimeContext(reg) as never)
          }
          fsm.transition(reg, 'unmounted')
        }

        fsm.transition(reg, 'destroying')
        const loaded = reg.loadedModule as LoadedModule | undefined
        // destroy hook è sync (vs altri async — semantic v1.x carryover).
        loaded?.lifecycle.destroy?.(makeStubRuntimeContext(reg) as never)
        fsm.transition(reg, 'destroyed')
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err))
        fsm.transition(reg, 'failed', { phase: 'destroy', error: errorObj })
        throw err
      } finally {
        // Cascade SEMPRE eseguito (D-V2-16 + MIN-2) — anche su error destroy hook.
        broker.unsubscribeByOwner(mfOwnerId(id))
      }
    })
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
