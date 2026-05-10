/**
 * AdapterRegistry — closure factory per registrare ThemeAdapter intercambiabili
 * (UI-ROLE-03, UI-ROLE-09).
 *
 * Pattern D-30 anti-singleton: ogni `createAdapterRegistry()` ritorna stato
 * isolato (Map<adapterId, StoredAdapter> + Set<listener> + activeId). Due
 * istanze parallele NON interferiscono (test parallel + plugin scope multipli).
 *
 * Validazione register-time:
 * - `ThemeAdapterSchema` (Valibot, riuso W2 plan 07-02) enforce shape
 *   `{ id: string min 1, roleMap?: Record<roleName, string>, cssRules?: Record<roleName, string> }`
 * - Throw `theme.adapter.invalid` su shape errata.
 *
 * Collision handling (D-F7-09):
 * - `register({ id: 'tailwind', ... })` con id già presente senza
 *   `{ override: true }` → throw `theme.adapter.duplicate`.
 * - `register(adapter, { override: true })` sovrascrive senza throw (opt-in
 *   esplicito, nessun "first wins" implicito che porterebbe a debugging
 *   notturno).
 *
 * Active management:
 * - `setActive(id)` cambia adapter attivo + emette `{ kind: 'activated' }`.
 *   Throw `theme.adapter.unknown` su id non registrato.
 * - `setActive(null)` deactivates (emette `deactivated`).
 * - `unregister(activeId)` deactivates implicitamente prima di rimuovere.
 *
 * Observer pattern (Inspector W5a + adapter-changed broker event W4):
 * - `subscribe(listener)` invocato con `AdapterRegistryEvent` su ognuno di
 *   register / activated / deactivated / unregister.
 * - Listener errors isolati (try/catch + warn) per prevenire crash propagation.
 *
 * Lifecycle (LIFE-02 ext F7 prep):
 * - `register(adapter, { ownerPluginId })` salva l'ownership; W4 plan 07-08
 *   userà `getOwnerPluginId(id)` per cascade `unregisterPlugin → unregisterAdapter`.
 *
 * Tampering mitigation (T-F7-04):
 * - `Object.freeze` adapter shape + nested `roleMap`/`cssRules` post-register
 *   per prevenire mutation runtime dei consumer.
 *
 * Refs:
 * - 07-CONTEXT.md D-F7-09 (collision throw + override esplicito)
 * - 07-06-PLAN.md Task 2
 * - UI-ROLE-03, UI-ROLE-09, LIFE-02 ext F7
 */

import { safeParse } from 'valibot'
import { ThemeAdapterSchema } from './internal/valibot-schemas'
import { createThemeError } from './theme-error'
import type {
  RegisterAdapterOptions,
  ThemeAdapter,
} from './types/theme-adapter'

/**
 * Evento emesso ai subscriber su ogni state transition del registry.
 *
 * - `kind: 'registered'` — adapter aggiunto (anche override).
 * - `kind: 'activated'` — `setActive(id)` con id valido (`previousId`
 *   contiene l'adapter precedentemente attivo o `undefined`).
 * - `kind: 'deactivated'` — `setActive(null)` o `unregister(activeId)`.
 * - `kind: 'unregistered'` — adapter rimosso.
 */
export interface AdapterRegistryEvent {
  readonly kind: 'registered' | 'unregistered' | 'activated' | 'deactivated'
  readonly adapterId: string
  readonly previousId?: string
  readonly ownerPluginId?: string
}

/** Stored adapter: wraps user-provided shape + tracking metadata. Internal only. */
interface StoredAdapter {
  readonly adapter: ThemeAdapter
  readonly ownerPluginId?: string
}

/** Public surface della factory `createAdapterRegistry`. */
export interface AdapterRegistry {
  /**
   * Registra un adapter. Throw `theme.adapter.invalid` su shape errata,
   * `theme.adapter.duplicate` su id collisione (opt-in `{ override: true }`
   * per sovrascrivere). Salva `ownerPluginId` per cascade W4.
   */
  register(adapter: ThemeAdapter, opts?: RegisterAdapterOptions): void
  /**
   * Rimuove un adapter. Se attivo → deactivates prima. Throw
   * `theme.adapter.unknown` se id non registrato.
   */
  unregister(adapterId: string): void
  /** Ritorna `true` se l'id è registrato. */
  has(adapterId: string): boolean
  /** Ritorna l'adapter (frozen) o `undefined`. */
  get(adapterId: string): ThemeAdapter | undefined
  /** Ritorna l'ownerPluginId o `undefined`. Usato da cascade W4 plan 07-08. */
  getOwnerPluginId(adapterId: string): string | undefined
  /**
   * Cambia adapter attivo. `null` → deactivate. Throw `theme.adapter.unknown`
   * se id non registrato. Ritorna `{ previous, current }` per allow consumer
   * post-swap cleanup (es. `restoreClasses(previous)` durante hot-swap).
   */
  setActive(
    adapterId: string | null,
  ): { readonly previous: string | null; readonly current: string | null }
  /** Adapter attivo (frozen) o `null`. */
  getActive(): ThemeAdapter | null
  /** Id adapter attivo o `null`. */
  getActiveId(): string | null
  /** Array readonly frozen degli id registrati. */
  list(): readonly string[]
  /**
   * Sottoscrive un listener agli eventi register/activated/deactivated/unregister.
   * Ritorna unsubscribe (idempotent).
   */
  subscribe(listener: (event: AdapterRegistryEvent) => void): () => void
  /**
   * Distrugge il registry: clears Map + Set di listener + activeId.
   * Successivi register/setActive/unregister throw `theme.snapshot.frozen`.
   * Idempotente.
   */
  destroy(): void
}

/**
 * Crea un nuovo {@link AdapterRegistry} closure-based (D-30 anti-singleton).
 *
 * @example Register + activate + observer
 * ```ts
 * const reg = createAdapterRegistry()
 * reg.register({ id: 'tailwind', roleMap: { 'action.primary': 'btn-primary' } })
 * reg.setActive('tailwind')
 * reg.subscribe((ev) => console.log(ev))
 * ```
 *
 * @example Collision throw + override esplicito (D-F7-09)
 * ```ts
 * reg.register({ id: 'tailwind', roleMap: { ... } })
 * reg.register({ id: 'tailwind', roleMap: { ... } }) // throw theme.adapter.duplicate
 * reg.register({ id: 'tailwind', roleMap: { ... } }, { override: true }) // OK
 * ```
 *
 * @see UI-ROLE-03 (roleMap + cssRules)
 * @see UI-ROLE-09 (collision throw + override esplicito) — D-F7-09
 * @see LIFE-02 ext F7 (ownerPluginId per cascade W4 plan 07-08)
 */
export function createAdapterRegistry(): AdapterRegistry {
  const adapters = new Map<string, StoredAdapter>()
  const listeners = new Set<(event: AdapterRegistryEvent) => void>()
  let activeId: string | null = null
  let destroyed = false

  function ensureLive(): void {
    if (destroyed) {
      throw createThemeError({
        code: 'theme.snapshot.frozen',
        message: 'AdapterRegistry has been destroyed',
      })
    }
  }

  function notify(event: AdapterRegistryEvent): void {
    for (const l of listeners) {
      try {
        l(event)
      } catch (err) {
        console.warn('[gluezero/theme] AdapterRegistry listener error:', err)
      }
    }
  }

  function register(
    adapter: ThemeAdapter,
    opts: RegisterAdapterOptions = {},
  ): void {
    ensureLive()
    const parsed = safeParse(ThemeAdapterSchema, adapter)
    if (!parsed.success) {
      throw createThemeError({
        code: 'theme.adapter.invalid',
        message: `Invalid adapter shape: ${parsed.issues.map((i) => i.message).join('; ')}`,
        details: { issues: parsed.issues, adapterId: adapter?.id },
      })
    }
    const id = parsed.output.id
    if (adapters.has(id) && !opts.override) {
      throw createThemeError({
        code: 'theme.adapter.duplicate',
        message: `Adapter "${id}" already registered. Pass { override: true } to replace.`,
        details: { adapterId: id },
      })
    }
    // Object.freeze post-register: previene mutation runtime (T-F7-04).
    // Conditional spread perché exactOptionalPropertyTypes distingue
    // "campo assente" vs "undefined" (riuso pattern createThemeError).
    const frozen: ThemeAdapter = Object.freeze({
      id: parsed.output.id,
      ...(parsed.output.roleMap
        ? { roleMap: Object.freeze({ ...parsed.output.roleMap }) }
        : {}),
      ...(parsed.output.cssRules
        ? { cssRules: Object.freeze({ ...parsed.output.cssRules }) }
        : {}),
    })
    const stored: StoredAdapter =
      opts.ownerPluginId !== undefined
        ? { adapter: frozen, ownerPluginId: opts.ownerPluginId }
        : { adapter: frozen }
    adapters.set(id, stored)
    notify(
      opts.ownerPluginId !== undefined
        ? {
            kind: 'registered',
            adapterId: id,
            ownerPluginId: opts.ownerPluginId,
          }
        : { kind: 'registered', adapterId: id },
    )
  }

  function unregister(adapterId: string): void {
    ensureLive()
    const stored = adapters.get(adapterId)
    if (!stored) {
      throw createThemeError({
        code: 'theme.adapter.unknown',
        message: `Adapter "${adapterId}" is not registered`,
        details: { adapterId },
      })
    }
    adapters.delete(adapterId)
    if (activeId === adapterId) {
      const previous = activeId
      activeId = null
      notify({ kind: 'deactivated', adapterId: previous })
    }
    notify(
      stored.ownerPluginId !== undefined
        ? {
            kind: 'unregistered',
            adapterId,
            ownerPluginId: stored.ownerPluginId,
          }
        : { kind: 'unregistered', adapterId },
    )
  }

  function has(adapterId: string): boolean {
    return adapters.has(adapterId)
  }

  function get(adapterId: string): ThemeAdapter | undefined {
    return adapters.get(adapterId)?.adapter
  }

  function getOwnerPluginId(adapterId: string): string | undefined {
    return adapters.get(adapterId)?.ownerPluginId
  }

  function setActive(
    adapterId: string | null,
  ): { readonly previous: string | null; readonly current: string | null } {
    ensureLive()
    const previous = activeId
    if (adapterId === null) {
      activeId = null
      if (previous != null) notify({ kind: 'deactivated', adapterId: previous })
      return { previous, current: null }
    }
    if (!adapters.has(adapterId)) {
      throw createThemeError({
        code: 'theme.adapter.unknown',
        message: `Cannot activate unknown adapter "${adapterId}"`,
        details: { adapterId },
      })
    }
    activeId = adapterId
    notify(
      previous != null
        ? { kind: 'activated', adapterId, previousId: previous }
        : { kind: 'activated', adapterId },
    )
    return { previous, current: adapterId }
  }

  function getActive(): ThemeAdapter | null {
    if (activeId == null) return null
    return adapters.get(activeId)?.adapter ?? null
  }

  function getActiveId(): string | null {
    return activeId
  }

  function list(): readonly string[] {
    return Object.freeze([...adapters.keys()])
  }

  function subscribe(
    listener: (event: AdapterRegistryEvent) => void,
  ): () => void {
    if (destroyed) return () => {}
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  function destroy(): void {
    if (destroyed) return
    destroyed = true
    adapters.clear()
    listeners.clear()
    activeId = null
  }

  return {
    register,
    unregister,
    has,
    get,
    getOwnerPluginId,
    setActive,
    getActive,
    getActiveId,
    list,
    subscribe,
    destroy,
  }
}
