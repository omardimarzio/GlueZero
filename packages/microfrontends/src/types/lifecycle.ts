/**
 * MicroFrontend lifecycle types (PRD §10.3, §29.5, MF-LIFE-01).
 *
 * 14 stati discriminated union + transitions table immutable + failureReason
 * con `phase` discriminato (D-V2-06 BLOCKING: `failed` unificato + `failureReason.phase`).
 *
 * @see ROADMAP §Phase 8 + RESEARCH §3
 */

/**
 * 14 lifecycle stati (PRD §10.3, MF-LIFE-01).
 *
 * Discriminated union immutable. `failed` è UNIFICATO (D-V2-06): la phase
 * dell'errore è discriminata da `MicroFrontendFailureReason.phase`.
 *
 * @example
 * ```ts
 * const state: MicroFrontendState = 'mounted'
 * if (state === 'failed') {
 *   // recovery: failed → loading | destroying
 * }
 * ```
 *
 * @see ALLOWED_TRANSITIONS — transition table autoritativa
 * @see PRD §10.3 — 14 stati spec
 */
export type MicroFrontendState =
  | 'registered'
  | 'resolving'
  | 'loading'
  | 'loaded'
  | 'bootstrapping'
  | 'bootstrapped'
  | 'mounting'
  | 'mounted'
  | 'updating'
  | 'unmounting'
  | 'unmounted'
  | 'destroying'
  | 'destroyed'
  | 'failed'

/** Fase del ciclo di vita in cui si è verificato il failure (D-V2-06). */
export type MicroFrontendFailurePhase =
  | 'load'
  | 'bootstrap'
  | 'mount'
  | 'update'
  | 'unmount'
  | 'destroy'
  | 'runtime'

/**
 * Ragione del fallimento del MF, popolata quando `state === 'failed'`.
 *
 * @example
 * ```ts
 * const reg = service.get('my-mf')!
 * if (reg.failureReason) {
 *   console.error(`MF failed in phase ${reg.failureReason.phase}:`, reg.failureReason.error.message)
 * }
 * ```
 *
 * @see PRD §10.5 — failureReason shape
 * @see registry.ts — publishErrorEvent (emette `microfrontend.{phase}.failed`)
 */
export interface MicroFrontendFailureReason {
  readonly phase: MicroFrontendFailurePhase
  readonly error: Error
  readonly timestamp: number
  /** F14 FallbackPolicy hint — stub `false` default in F8. */
  readonly recoverable?: boolean
}

/**
 * Transizioni ammesse da ogni stato (PRD §10.4 + D-V2-06).
 *
 * Transizioni VIETATE (throw `MF_STATE_INVALID`):
 * - `destroyed → mounted` (sink state — solo reload via new registration)
 * - `failed → mounted` senza passare per `loading` (recovery esplicito)
 *
 * @see lifecycle-fsm.ts:transitionAllowed
 */
export const ALLOWED_TRANSITIONS: Readonly<
  Record<MicroFrontendState, ReadonlySet<MicroFrontendState>>
> = {
  registered: new Set(['resolving', 'destroying', 'failed']),
  resolving: new Set(['loading', 'failed']),
  loading: new Set(['loaded', 'failed']),
  loaded: new Set(['bootstrapping', 'destroying', 'failed']),
  bootstrapping: new Set(['bootstrapped', 'failed']),
  bootstrapped: new Set(['mounting', 'destroying', 'failed']),
  mounting: new Set(['mounted', 'failed']),
  mounted: new Set(['updating', 'unmounting', 'failed']),
  updating: new Set(['mounted', 'failed']),
  unmounting: new Set(['unmounted', 'failed']),
  unmounted: new Set(['mounting', 'destroying', 'failed']),
  destroying: new Set(['destroyed', 'failed']),
  destroyed: new Set([]), // sink state — reload = new registration
  failed: new Set(['loading', 'destroying']), // recovery esplicito
} as const

/**
 * Helper standalone (riusato da `lifecycle-fsm.ts`).
 *
 * @example
 * ```ts
 * transitionAllowed('registered', 'resolving') // true
 * transitionAllowed('destroyed', 'mounted')    // false (sink state)
 * transitionAllowed('failed', 'mounted')       // false (recovery esplicito richiesto)
 * transitionAllowed('failed', 'loading')       // true (recovery path)
 * ```
 *
 * @see LifecycleManager.transition — il writer autoritativo
 * @see LifecycleManager.isAllowed — wrapper static alternativo
 */
export function transitionAllowed(from: MicroFrontendState, to: MicroFrontendState): boolean {
  return ALLOWED_TRANSITIONS[from].has(to)
}

/** Timings opzionali popolati durante lifecycle (PRD §31.4). */
export interface MicroFrontendTimings {
  readonly registeredAt?: number
  readonly loadStartedAt?: number
  readonly loadedAt?: number
  readonly bootstrappedAt?: number
  readonly mountedAt?: number
  readonly unmountedAt?: number
  readonly destroyedAt?: number
}
