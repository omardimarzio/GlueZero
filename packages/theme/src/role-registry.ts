/**
 * RoleRegistry — closure factory per gestire il vocabolario semantic-role
 * (UI-ROLE-01/02/06/07).
 *
 * Pattern D-30 anti-singleton: ogni `createRoleRegistry()` ritorna uno stato
 * isolato (Map + Set di listener). Due istanze parallele NON interferiscono
 * (es. test parallel + plugin scopes multipli).
 *
 * Validazione register-time:
 * - `RoleSetSchema` (Valibot) enforce dot-notation `category.subname` (D-F7-16)
 * - `checkCap` cardinality cap 100 + soft-warn 50% + `allowMore` opt-in (D-F7-14)
 *
 * Observer pattern (Inspector W5a):
 * - `subscribe(listener)` invocato su register/unregister con
 *   `{ kind: 'registered'|'unregistered', role: string }`
 * - Listener errors sono isolati (try/catch + warn log) per prevenire crash
 *   propagation (T-F7-04 mitigation)
 *
 * Idempotenza:
 * - `register` di un ruolo già presente è no-op + warn (first wins).
 * - `unregister` di un ruolo non registrato throw `theme.role.unregistered`.
 *
 * Refs:
 * - 07-CONTEXT.md D-F7-14 (cap pattern), D-F7-16 (dot-notation)
 * - 07-05-PLAN.md Task 2
 * - UI-ROLE-01, UI-ROLE-06, UI-ROLE-07
 */

import { safeParse } from 'valibot'
import { ROLE_CAP, checkCap } from './cardinality-cap'
import { RoleSetSchema } from './internal/valibot-schemas'
import { createThemeError } from './theme-error'
import type { RoleDefinition, RoleSet } from './types/role'

/** Evento emesso ai subscriber al register/unregister di un ruolo. */
export interface RoleRegistryEvent {
  readonly kind: 'registered' | 'unregistered'
  readonly role: string
}

/** Listener per eventi del role registry. */
export type RoleRegistryListener = (event: RoleRegistryEvent) => void

/** Opzioni per `register`. */
export interface RegisterRolesOptions {
  /** Bypass del cap 100 (D-F7-14, UI-ROLE-06). Default `false`. */
  readonly allowMore?: boolean
}

/** Public surface della factory `createRoleRegistry`. */
export interface RoleRegistry {
  /**
   * Registra uno o più ruoli. Idempotente: ruoli già presenti emettono warn
   * e mantengono la definition originale. Throw `theme.role.invalid` se shape
   * non valida (Valibot dot-notation regex). Throw `theme.role.cap-exceeded`
   * se proiezione supera 100 senza `allowMore: true`.
   */
  register(roles: RoleSet, opts?: RegisterRolesOptions): void
  /**
   * Rimuove un ruolo. Throw `theme.role.unregistered` se assente.
   * Notifica i subscriber con `{ kind: 'unregistered', role }`.
   */
  unregister(role: string): void
  /** Ritorna `true` se il ruolo è registrato. */
  has(role: string): boolean
  /** Ritorna l'array readonly frozen dei nomi ruoli registrati. */
  list(): readonly string[]
  /** Ritorna la definition del ruolo o `undefined`. */
  get(role: string): RoleDefinition | undefined
  /**
   * Sottoscrive un listener agli eventi register/unregister.
   * Ritorna la funzione di unsubscribe (idempotent).
   */
  subscribe(listener: RoleRegistryListener): () => void
  /**
   * Distrugge il registry: clears Map + Set di listener. Successivi
   * register/unregister throw `theme.snapshot.frozen`. Idempotente.
   */
  destroy(): void
}

/**
 * Crea un nuovo {@link RoleRegistry} closure-based (D-30 anti-singleton).
 *
 * @example
 * ```ts
 * const registry = createRoleRegistry()
 * registry.register({
 *   'action.primary': { description: 'Azione principale' },
 * })
 * registry.subscribe((ev) => console.log(ev))
 * // ...
 * registry.destroy()
 * ```
 */
export function createRoleRegistry(): RoleRegistry {
  const roles = new Map<string, RoleDefinition>()
  const listeners = new Set<RoleRegistryListener>()
  let destroyed = false

  function ensureLive(): void {
    if (destroyed) {
      throw createThemeError({
        code: 'theme.snapshot.frozen',
        message: 'RoleRegistry has been destroyed',
      })
    }
  }

  function notify(event: RoleRegistryEvent): void {
    for (const l of listeners) {
      try {
        l(event)
      } catch (err) {
        console.warn('[gluezero/theme] RoleRegistry listener error:', err)
      }
    }
  }

  function register(input: RoleSet, opts: RegisterRolesOptions = {}): void {
    ensureLive()
    const parsed = safeParse(RoleSetSchema, input)
    if (!parsed.success) {
      throw createThemeError({
        code: 'theme.role.invalid',
        message: `Invalid role set: ${parsed.issues.map((i) => i.message).join('; ')}`,
        details: { issues: parsed.issues },
      })
    }
    // Filter idempotent (already-registered) keys to compute projected size
    const incoming = Object.entries(parsed.output)
    const newKeys = incoming.filter(([k]) => !roles.has(k))
    const projectedSize = roles.size + newKeys.length
    const cap = checkCap(projectedSize, ROLE_CAP, 'role', opts.allowMore ?? false)
    if (!cap.allow) {
      throw createThemeError({
        code: 'theme.role.cap-exceeded',
        message: cap.warn ?? 'Role cap exceeded',
        details: { current: projectedSize, cap: ROLE_CAP },
      })
    }
    if (cap.warn) {
      console.warn(`[gluezero/theme] ${cap.warn}`)
    }
    // Apply: idempotent on existing keys. Normalize Valibot's
    // `{ description: string | undefined }` → `RoleDefinition` (`description?: string`)
    // omettendo la chiave quando undefined (exactOptionalPropertyTypes: true).
    for (const [name, def] of incoming) {
      if (roles.has(name)) {
        console.warn(
          `[gluezero/theme] Role "${name}" already registered (idempotent no-op).`,
        )
        continue
      }
      const stored: RoleDefinition =
        def.description !== undefined ? { description: def.description } : {}
      roles.set(name, stored)
      notify({ kind: 'registered', role: name })
    }
  }

  function unregister(role: string): void {
    ensureLive()
    if (!roles.has(role)) {
      throw createThemeError({
        code: 'theme.role.unregistered',
        message: `Role "${role}" is not registered`,
        details: { role },
      })
    }
    roles.delete(role)
    notify({ kind: 'unregistered', role })
  }

  function has(role: string): boolean {
    return roles.has(role)
  }

  function list(): readonly string[] {
    return Object.freeze([...roles.keys()])
  }

  function get(role: string): RoleDefinition | undefined {
    return roles.get(role)
  }

  function subscribe(listener: RoleRegistryListener): () => void {
    if (destroyed) return () => {}
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  function destroy(): void {
    if (destroyed) return
    destroyed = true
    roles.clear()
    listeners.clear()
  }

  return { register, unregister, has, list, get, subscribe, destroy }
}
