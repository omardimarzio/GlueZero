/**
 * `installErrorSubscribe` — Subscribe seam composition esterna pura ai 7
 * `MF_ERROR_TOPICS` di F8 (D-V2-F14-01 lockato).
 *
 * Cover REQ-IDs: MF-FALLBACK-04 entry-point dispatch chain (W2 P02 closure) +
 * dependency parziale MF-FALLBACK-02 (Orchestrator wire reale W2 P04).
 *
 * Pattern Rule 4 carryover stretto F13 `lifecycle-register-hook.ts` + F11
 * `lifecycle-hooks.ts`: subscribe via loop array + `deliveryMode:'sync'` esplicito
 * + AbortSignal cleanup cascade D-V2-16.
 *
 * ## Composition esterna pura D-V2-F14-01
 *
 * Zero diff `packages/microfrontends/src/`. F14 subscribe ai topic emessi da F8
 * `publishErrorEvent` helper (`packages/microfrontends/src/registry.ts:361-385`).
 * F8 NON viene modificato.
 *
 * ## Payload parsing OQ-4 verified
 *
 * `MicroFrontendErrorEventPayload.phase` è popolato nativamente da F8 (registry.ts
 * linee 361-385: `phase: reg.failureReason.phase` con `reg.failureReason` settato
 * dal lifecycle FSM). F14 estrae `phase` direttamente dal payload — più robust
 * di split topic literal `'microfrontend.{phase}.failed'` (defensive contro
 * future F8 topic naming refactor).
 *
 * ## Dispatch chain entry-point
 *
 * Questo file orchestra SOLO il subscribe + parser; il dispatch reale a
 * `circuit→retry→fallback render` (D-V2-F14-12) avviene nel callback `dispatch`
 * passato da `fallbacksModule.install` (W2 P04 wiring).
 *
 * ## AbortSignal cleanup cascade D-V2-16
 *
 * Quando `opts.signal` fires `abort`:
 *  - Tutti i 7 `sub.unsubscribe()` vengono chiamati in sequenza.
 *  - `{once: true}` listener garantisce single execution anche su signal re-abort.
 *  - Se `signal.aborted === true` al momento install, teardown immediato.
 *
 * @see prd_2.0.0.md §29.4 — F14 error event subscription
 * @see D-V2-F14-01 — Subscribe seam composition esterna pura
 * @see D-V2-F14-08 — lifecyclePhase derivation da payload.phase
 * @see D-V2-F14-12 — Ordine subscriber circuit→retry→fallback
 * @see D-V2-16 — Cleanup cascade abortSignal cross-fase
 * @see packages/permissions/src/lifecycle-hooks.ts (F11 reference template)
 * @see packages/isolation/src/lifecycle-register-hook.ts (F13 reference template)
 * @see packages/microfrontends/src/registry.ts:361-385 — publishErrorEvent payload source
 */
import type { Broker, BrokerEvent } from '@gluezero/core'
import {
  MF_ERROR_TOPICS,
  type MicroFrontendErrorEventPayload,
} from '@gluezero/microfrontends'
import type { MicroFrontendErrorLifecyclePhase } from './types/errors.js'

/**
 * Argomenti callback dispatch — passati a `handleErrorEvent` per ogni evento
 * subscribe dei 7 `MF_ERROR_TOPICS`.
 *
 * Shape estratta da `MicroFrontendErrorEventPayload` F8 + type narrowing locale F14:
 *  - `mfId`: `payload.id` (F8 popolato da `reg.descriptor.id`).
 *  - `phase`: `payload.phase` (F8 popolato da `reg.failureReason.phase`).
 *  - `error`: `payload.error` (F8 popolato da err Error con message + stack? + code?).
 *  - `recoverable`: `payload.recoverable` (F8 popolato da `reg.failureReason.recoverable ?? false`).
 *
 * @see MicroFrontendErrorEventPayload — F8 source shape
 */
export interface ErrorChainArgs {
  readonly mfId: string
  readonly phase: MicroFrontendErrorLifecyclePhase
  readonly error: { readonly message: string; readonly stack?: string; readonly code?: string }
  readonly recoverable: boolean
}

/**
 * Context object passato a `installErrorSubscribe` — contiene callback dispatch
 * + AbortSignal opt per cleanup cascade.
 *
 * W2 P04 popola `dispatch` con orchestrator chain `circuit→retry→fallback` reale
 * (D-V2-F14-12). W2 P02 espone solo il seam: tutti i test del W2 P02 mockano
 * `dispatch` per verifica behavior subscribe.
 */
export interface ErrorSubscribeContext {
  readonly dispatch: (args: ErrorChainArgs) => void | Promise<void>
  readonly signal?: AbortSignal
}

/**
 * Handle ritornato per cleanup manuale opt (alternative a AbortSignal).
 *
 * `unsubscribeAll()` invoca `sub.unsubscribe()` per ognuna delle 7 subscription
 * registrate al momento install. Idempotent — call multiple no-op dopo prima
 * invocazione (broker subscription handle idempotency).
 */
export interface ErrorSubscribeHandle {
  readonly unsubscribeAll: () => void
}

/**
 * Installa subscribe esterno ai 7 `MF_ERROR_TOPICS` F8 + wire dispatch callback.
 *
 * Per ogni topic dei 7 (load/bootstrap/mount/runtime/update/unmount/destroy.failed):
 *  1. `broker.subscribe(topic, handler, { deliveryMode: 'sync' })` — carryover F11 pattern.
 *  2. Handler estrae `payload.phase` (preferito) → narrowing `MicroFrontendErrorLifecyclePhase`.
 *  3. Handler invoca `ctx.dispatch({ mfId, phase, error, recoverable })`.
 *  4. Dispatch callback è fire-and-forget (`void ctx.dispatch(...)`) per non bloccare event loop.
 *
 * Cleanup cascade D-V2-16:
 *  - Se `ctx.signal` settato + non-aborted: registra `{once:true}` abort listener.
 *  - Se `ctx.signal.aborted === true`: teardown immediato (unsubscribe all 7).
 *  - Se `ctx.signal === undefined`: nessun cleanup auto; consumer deve chiamare `handle.unsubscribeAll()`.
 *
 * @param broker Broker su cui subscribe ai 7 MF_ERROR_TOPICS.
 * @param ctx Context con `dispatch` callback obbligatorio + `signal` opt.
 * @returns Handle con `unsubscribeAll()` per cleanup manuale (alternativa al signal cascade).
 *
 * @example Wire da `fallbacksModule.install` (W2 P04 — pattern atteso)
 * ```ts
 * const ctrl = new AbortController()
 * const handle = installErrorSubscribe(ctx.broker, {
 *   dispatch: async ({ mfId, phase, error, recoverable }) => {
 *     // circuit check → retry check → fallback render (D-V2-F14-12)
 *     await orchestratorChain({
 *       mfId,
 *       phase,
 *       error,
 *       recoverable,
 *       retryEngine,
 *       circuit,
 *       renderer,
 *     })
 *   },
 *   signal: ctrl.signal,
 * })
 * // Su broker shutdown: ctrl.abort() → tutti i 7 sub.unsubscribe()
 * ```
 *
 * @example Test injection — dispatch mock
 * ```ts
 * const dispatch = vi.fn()
 * const handle = installErrorSubscribe(mockBroker, { dispatch })
 * mockBroker.publish('microfrontend.load.failed', { id: 'mf-1', phase: 'load', ... })
 * expect(dispatch).toHaveBeenCalledWith({ mfId: 'mf-1', phase: 'load', ... })
 * handle.unsubscribeAll()
 * ```
 *
 * @see D-V2-F14-01 — Subscribe seam composition esterna pura
 */
export function installErrorSubscribe(
  broker: Broker,
  ctx: ErrorSubscribeContext,
): ErrorSubscribeHandle {
  const subs = MF_ERROR_TOPICS.map((topic) =>
    broker.subscribe(
      topic,
      (event: BrokerEvent) => {
        const payload = event.payload as MicroFrontendErrorEventPayload
        // OQ-4 verified: payload.phase popolato nativamente da F8
        // (registry.ts:361-385). Preferito su split topic literal.
        const phase = payload.phase as MicroFrontendErrorLifecyclePhase
        // Fire-and-forget — dispatch callback non blocca event loop (T-14-02-02 mitigation).
        void ctx.dispatch({
          mfId: payload.id,
          phase,
          error: payload.error,
          recoverable: payload.recoverable,
        })
      },
      { deliveryMode: 'sync' },
    ),
  )

  // AbortSignal cleanup cascade D-V2-16 — carryover F11/F12/F13 pattern.
  if (ctx.signal !== undefined) {
    const handler = (): void => {
      for (const sub of subs) sub.unsubscribe()
    }
    if (ctx.signal.aborted) {
      // Signal già abortito alla install — teardown immediato.
      handler()
    } else {
      ctx.signal.addEventListener('abort', handler, { once: true })
    }
  }

  return {
    unsubscribeAll: (): void => {
      for (const sub of subs) sub.unsubscribe()
    },
  }
}
