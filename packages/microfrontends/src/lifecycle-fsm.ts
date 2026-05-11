/**
 * MicroFrontend Lifecycle FSM custom switch a 14 stati (MF-LIFE-02, MF-LIFE-06).
 *
 * Enforce transizioni ammesse da `ALLOWED_TRANSITIONS` table (`./types/lifecycle.ts`).
 * Transizioni vietate (`destroyed → mounted`, `failed → mounted` senza passare per
 * `loading` recovery) → throw `MF_STATE_INVALID`.
 *
 * `failureReason.phase` popolato quando transition → 'failed' (D-V2-06 discriminated).
 *
 * W3-P06 fornisce SOLO la state machine. Wiring delle lifecycle ops (load/mount/etc.)
 * con `inFlight: Map<id, Promise>` + idempotency + auto-bootstrap D-V2-07 arriva in W3-P07.
 *
 * @see RESEARCH §3 + PATTERNS §33 + D-V2-06 BLOCKING + PRD §10.4
 */
import { createMfError } from './microfrontend-error'
import type { MicroFrontendRegistration } from './types/descriptor'
import {
  ALLOWED_TRANSITIONS,
  type MicroFrontendFailurePhase,
  type MicroFrontendFailureReason,
  type MicroFrontendState,
  type MicroFrontendTimings,
  transitionAllowed,
} from './types/lifecycle'

/** Failure context fornito a `transition` quando target = 'failed'. */
export interface LifecycleFailureContext {
  readonly phase: MicroFrontendFailurePhase
  readonly error: Error
}

/**
 * Lifecycle FSM manager — applica transizioni sulla state machine.
 *
 * Istanziato dentro `createMicroFrontendsService` (W3-P07 wiring).
 *
 * @example
 * ```ts
 * const fsm = new LifecycleManager()
 * const reg = {
 *   descriptor: { id: 'mf', name: 'MF', version: '1.0.0' },
 *   state: 'registered' as MicroFrontendState,
 * }
 * fsm.transition(reg, 'resolving') // OK: registered → resolving ammesso
 * fsm.transition(reg, 'mounted')   // THROWS MF_STATE_INVALID
 * ```
 */
export class LifecycleManager {
  /**
   * Esegue una transizione di stato mutando `reg.state` e `reg.previousState`.
   *
   * Atomic check-then-set: se transition vietata throw PRIMA di mutare lo stato
   * (T-F8-03 mitigation — stato non modificato in caso di throw).
   *
   * @param reg - Registrazione MF mutable (modifica `state`/`previousState` fields)
   * @param to - Stato target
   * @param failure - Solo per transizioni → 'failed': fornisce `phase` + `error`.
   *   Se omesso ma `to === 'failed'`, ricostruzione minimale `phase: 'runtime'`.
   * @throws `MF_STATE_INVALID` se transizione non in ALLOWED_TRANSITIONS table.
   *   Stato `reg.state` NON modificato in caso di throw.
   *
   * @example
   * ```ts
   * fsm.transition(reg, 'failed', {
   *   phase: 'load',
   *   error: new Error('network timeout'),
   * })
   * // reg.state === 'failed', reg.failureReason.phase === 'load'
   * ```
   *
   * @see ALLOWED_TRANSITIONS table — `./types/lifecycle.ts`
   * @see createMfError — `./microfrontend-error.ts`
   */
  transition(
    reg: MicroFrontendRegistration,
    to: MicroFrontendState,
    failure?: LifecycleFailureContext,
  ): void {
    if (!transitionAllowed(reg.state, to)) {
      throw createMfError({
        code: 'MF_STATE_INVALID',
        message: `Invalid transition ${reg.state} → ${to} for "${reg.descriptor.id}"`,
        details: {
          id: reg.descriptor.id,
          from: reg.state,
          to,
          allowedFromHere: [...ALLOWED_TRANSITIONS[reg.state]],
        },
      })
    }

    reg.previousState = reg.state
    reg.state = to

    if (to === 'failed') {
      // D-V2-06: failureReason.phase discriminated
      const reason: MicroFrontendFailureReason = failure
        ? {
            phase: failure.phase,
            error: failure.error,
            timestamp: Date.now(),
            recoverable: false, // F8 stub default; F14 sovrascrive con policy reale
          }
        : {
            // Pattern interno: chi chiama transition('failed') dovrebbe fornire failure
            // context. Se non fornito → ricostruzione minimale runtime fallback.
            phase: 'runtime',
            error: new Error(`Unknown failure cause for ${reg.descriptor.id}`),
            timestamp: Date.now(),
            recoverable: false,
          }
      reg.failureReason = reason
    } else if (reg.failureReason) {
      // Reset failureReason quando transitioning out of 'failed' (recovery success cleanup).
      // `delete` invece di `= undefined` per coerenza con exactOptionalPropertyTypes.
      delete reg.failureReason
    }

    // Update timings per stati chiave (PRD §31.4).
    // Cast a mutable shape interno: il type pubblico ha tutti i field readonly, ma
    // qui siamo nel writer autoritativo (il FSM owna le mutation di timings).
    const mutableTimings = (reg.timings ?? {}) as {
      -readonly [K in keyof MicroFrontendTimings]: MicroFrontendTimings[K]
    }
    const now = Date.now()
    switch (to) {
      case 'loading':
        mutableTimings.loadStartedAt = now
        break
      case 'loaded':
        mutableTimings.loadedAt = now
        break
      case 'bootstrapped':
        mutableTimings.bootstrappedAt = now
        break
      case 'mounted':
        mutableTimings.mountedAt = now
        break
      case 'unmounted':
        mutableTimings.unmountedAt = now
        break
      case 'destroyed':
        mutableTimings.destroyedAt = now
        break
    }
    if (!reg.timings) {
      reg.timings = mutableTimings
    }
  }

  /**
   * Helper alternativo `transitionAllowed` (riferimento standalone — riuso dal Registry).
   *
   * @example
   * ```ts
   * LifecycleManager.isAllowed('registered', 'resolving') // true
   * LifecycleManager.isAllowed('destroyed', 'mounted')    // false
   * ```
   *
   * @see transitionAllowed from `./types/lifecycle`
   */
  static isAllowed(from: MicroFrontendState, to: MicroFrontendState): boolean {
    return transitionAllowed(from, to)
  }
}
