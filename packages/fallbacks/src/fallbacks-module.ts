/**
 * D-V2-F14-10-AMENDED — RUNTIME/UPDATE RETRY POLICY
 *
 * Per RESEARCH.md F14 §OQ-1: MicroFrontendsService F8 espone 5 ops pubbliche
 * (load/bootstrap/mount/unmount/destroy). Non esistono attemptRuntime/attemptUpdate.
 *
 * Alternative documentate per runtime/update phase retry:
 * (a) Re-invoke descriptor.lifecycle.onMount/onUpdate direttamente — VIOLATES D-83 strict
 *     (richiede accesso lifecycle ref via Service Locator, accoppiamento stretto F8 internal).
 * (b) Emit topic 'microfrontend.retry.requested' che F8 lifecycle-ops subscriber consume —
 *     richiede diff packages/microfrontends/src/ (D-83 violation septuple).
 * (c) Skip retry per runtime/update phases — preferred per D-83 compliance.
 *
 * Decisione planner-time RATIFICATA: alternativa (c). runtime/update errors
 * applicano direttamente fallback render (skip retry, skip circuit increment).
 *
 * Discrepanza apparente con D-V2-F14-08 heuristic (runtime=recoverable:true):
 * 'recoverable' resta true per devtools/observability semantica (errore intercettabile
 * da host adapter F15), ma retry trigger via broker.<phase>(mfId) non disponibile.
 * Documentato in README §5 "Retry skip runtime/update".
 *
 * @see .planning/phases/14-fallback-error-boundary-devtools-mf-inspector/14-RESEARCH.md OQ-1
 * @see .planning/phases/14-fallback-error-boundary-devtools-mf-inspector/14-CONTEXT.md D-V2-F14-10
 */

/**
 * `fallbacksModule()` factory — `BrokerModule` FINAL implementation (W2 P04 wire reale).
 *
 * Sostituisce W1 STUB no-impl con orchestrator chain D-V2-F14-12:
 * 1. Circuit check (open → skip retry, dispatch fallback)
 * 2. Retry check (shouldRetry + skip runtime/update OQ-1)
 * 3. Fallback render dispatch (4-mode + none)
 * 4. Success path (retry recovered → emit microfrontend.recovered + reset + recordSuccess)
 *
 * Install flow (carryover Rule 4 stretto F13 isolation-module.ts + F11 permissions-module.ts):
 * 1. Lookup `SERVICE_MICROFRONTENDS` via `ctx.broker.getService` — throw esplicativo se assente
 * 2. Idempotent guard: re-install rileva `SERVICE_FALLBACKS` already registered → warn + return
 * 3. AbortController interno + `createRetryEngine()` + `createCircuitBreaker(broker)`
 * 4. Costruisce `FallbacksService` API → `ctx.registerService(SERVICE_FALLBACKS, service)`
 * 5. `installErrorSubscribe(broker, { dispatch: orchestratorChain, signal: ctrl.signal })`
 * 6. Subscribe `microfrontend.unregistered` per cleanup P-02
 * 7. AbortSignal cleanup cascade D-V2-16: broker shutdown → ctrl.abort() → unsubscribe + state clear
 *
 * **Anti-singleton D-30**: ogni call ritorna nuovo `BrokerModule`.
 *
 * **AMENDMENT D-V2-F14-04**: factory expands a 3-opt `{defaultPolicy?, retryDefault?,
 * circuitDefault?}` (vs F13=2-opt) per scope semantically maggiore — fallback + retry
 * + circuit son 3 concept indipendenti per design F14.
 *
 * @see D-V2-F14-04 — 3-opt factory scaling
 * @see D-V2-F14-12 — Orchestrator chain order
 * @see D-V2-F14-16 — Cleanup cascade abortSignal
 * @see packages/isolation/src/isolation-module.ts (F13 reference template)
 */
import type { BrokerModule, BrokerModuleContext } from '@gluezero/core'
import { SERVICE_FALLBACKS, SERVICE_MICROFRONTENDS } from '@gluezero/core'
import type { MicroFrontendsService } from '@gluezero/microfrontends'
import type {
  CircuitBreakerPolicy,
  FallbackDefinition,
  MicroFrontendFallbackPolicy,
  RetryPolicy,
} from './types/policy.js'
import type { MicroFrontendErrorLifecyclePhase } from './types/errors.js'
import type { FallbacksService } from './service-locator.js'
import { getFallback } from './types/descriptor-augment.js'
import { createRetryEngine } from './retry-engine.js'
import { createCircuitBreaker } from './circuit-breaker.js'
import { dispatchFallback } from './fallback-renderer.js'
import { installErrorSubscribe } from './lifecycle-error-subscribe.js'
import { MicroFrontendError } from './microfrontend-error.js'
import { MF_FALLBACK_TOPICS, FALLBACK_RENDERED_TOPIC } from './topics.js'

/**
 * Source descriptor F1 D-23 obbligatorio + `deliveryMode:'sync'` per consistency
 * con governance topics F8.
 */
const PUBLISH_OPTS = {
  source: { type: 'plugin' as const, id: 'fallbacks', name: '@gluezero/fallbacks' },
  deliveryMode: 'sync' as const,
}
/** `MF_FALLBACK_TOPICS[0]` === `'microfrontend.recovered'` (retry success emit). */
const TOPIC_RECOVERED = MF_FALLBACK_TOPICS[0]
/** Default retry policy quando né `definition.retry` né `policy.retry` né `options.retryDefault` set. */
const DEFAULT_RETRY: RetryPolicy = { attempts: 1 }
/** Default circuit policy: `enabled:false` (opt-in safety D-V2-F14-11). */
const DEFAULT_CIRCUIT: CircuitBreakerPolicy = {
  enabled: false,
  failureThreshold: 3,
  resetAfterMs: 5000,
}
/** 7 lifecycle phases F8 — usato in microfrontend.unregistered cleanup loop. */
const ALL_PHASES: readonly MicroFrontendErrorLifecyclePhase[] = [
  'load',
  'bootstrap',
  'mount',
  'runtime',
  'update',
  'unmount',
  'destroy',
]

/**
 * Setup-time options per `fallbacksModule()` (D-V2-F14-04 3-opt scaling).
 *
 * - `defaultPolicy?`: host-level fallback per tutti i MF (descriptor-level override).
 *   Tipicamente `onLoadError` html generic "App unavailable" — sblocca UX consistency
 *   senza richiedere a ogni MF di definire un proprio fallback.
 * - `retryDefault?`: default RetryPolicy globale applicato a tutti i 6 onXError scope
 *   (descriptor.fallback.retry override fine-grained per-phase).
 * - `circuitDefault?`: default CircuitBreakerPolicy globale (descriptor override).
 *   Tipicamente `{enabled: true, failureThreshold: 3, resetAfterMs: 5000}` per
 *   production safety.
 *
 * @example Setup minimale (defaults — no retry, no circuit, no fallback)
 * ```ts
 * fallbacksModule()
 * ```
 *
 * @example Setup production con retry + circuit globali + html fallback generic
 * ```ts
 * fallbacksModule({
 *   defaultPolicy: {
 *     onLoadError: { type: 'html', html: '<div>App unavailable</div>' },
 *   },
 *   retryDefault: { attempts: 3, delayMs: 100, backoff: 'exponential', jitter: true },
 *   circuitDefault: { enabled: true, failureThreshold: 3, resetAfterMs: 5000 },
 * })
 * ```
 */
export interface FallbacksModuleOptions {
  readonly defaultPolicy?: MicroFrontendFallbackPolicy
  readonly retryDefault?: RetryPolicy
  readonly circuitDefault?: CircuitBreakerPolicy
}

/**
 * Mappa phase → key di policy `MicroFrontendFallbackPolicy.onXError`.
 *
 * BL1 fix MF-FALLBACK-01 frozen:
 * - `update` → `policy.onUpdateError` mapped (was incorrectly returning undefined).
 * - `destroy` → `undefined` (NO per-policy field — 6-scope contract REQUIREMENTS.md riga 140).
 *   Orchestrator chain applica default fallback no-policy-field path.
 */
function getDefinitionForPhase(
  policy: MicroFrontendFallbackPolicy | undefined,
  phase: MicroFrontendErrorLifecyclePhase,
): FallbackDefinition | undefined {
  if (policy === undefined) return undefined
  switch (phase) {
    case 'load':
      return policy.onLoadError
    case 'bootstrap':
      return policy.onBootstrapError
    case 'mount':
      return policy.onMountError
    case 'runtime':
      return policy.onRuntimeError
    case 'update':
      return policy.onUpdateError
    case 'unmount':
      return policy.onUnmountError
    case 'destroy':
      return undefined
  }
}

/**
 * Factory `BrokerModule` per `@gluezero/fallbacks` — W2 P04 FINAL implementation.
 *
 * @param options Setup-time options 3-opt (defaults: undefined su tutti).
 * @returns Nuovo `BrokerModule` con install che lookup SERVICE_MICROFRONTENDS,
 *   idempotent guard SERVICE_FALLBACKS, costruisce RetryEngine + CircuitBreaker,
 *   register service, installErrorSubscribe wire orchestratorChain, subscribe
 *   microfrontend.unregistered per cleanup P-02, AbortSignal cascade D-V2-16.
 *
 * @throws Se `@gluezero/microfrontends` NON installato → Error esplicativo.
 *
 * @example Install chain F14 completa
 * ```ts
 * import { createBroker } from '@gluezero/core'
 * import { microfrontendModule } from '@gluezero/microfrontends'
 * import { fallbacksModule } from '@gluezero/fallbacks'
 *
 * const broker = createBroker({
 *   modules: [microfrontendModule(), fallbacksModule()],
 * })
 * ```
 *
 * @example Anti-singleton — 2 broker indipendenti
 * ```ts
 * const broker1 = createBroker({ modules: [microfrontendModule(), fallbacksModule()] })
 * const broker2 = createBroker({ modules: [microfrontendModule(), fallbacksModule()] })
 * // fallback engine separati con state isolato.
 * ```
 */
export function fallbacksModule(options: FallbacksModuleOptions = {}): BrokerModule {
  return {
    id: 'fallbacks',
    version: '2.0.0-alpha.0',
    install(ctx: BrokerModuleContext): void {
      const broker = ctx.broker

      // (1) Lookup SERVICE_MICROFRONTENDS — required
      const maybeMfService = broker.getService<MicroFrontendsService>(SERVICE_MICROFRONTENDS)
      if (maybeMfService === undefined) {
        throw new Error(
          '@gluezero/fallbacks requires @gluezero/microfrontends to be installed first. ' +
            'Add microfrontendModule() before fallbacksModule() in the modules array.',
        )
      }
      // Const alias post-narrowing — preserva non-undefined narrowing nel closure orchestratorChain.
      const mfService: MicroFrontendsService = maybeMfService

      // (2) Idempotent guard
      const alreadyInstalled = broker.getService<FallbacksService>(SERVICE_FALLBACKS)
      if (alreadyInstalled !== undefined) {
        // biome-ignore lint/suspicious/noConsole: dev warning intentional (re-install governance)
        console.warn('[fallbacks] already installed; skipping re-install')
        return
      }

      // (3) AbortController + engines
      const ctrl = new AbortController()
      const retryEngine = createRetryEngine()
      const circuitBreaker = createCircuitBreaker(broker)

      // (4) Service API
      const service: FallbacksService = {
        getCircuitState: (mfId: string) => circuitBreaker.getState(mfId),
        getRetryAttempts: (mfId, phase) => retryEngine.getAttempts(mfId, phase),
      }
      ctx.registerService(SERVICE_FALLBACKS, service)

      // (5) Orchestrator chain (D-V2-F14-12)
      async function orchestratorChain(args: {
        mfId: string
        phase: MicroFrontendErrorLifecyclePhase
        error: { readonly message: string; readonly code?: string }
        recoverable: boolean
      }): Promise<void> {
        const { mfId, phase, error, recoverable } = args

        const reg = mfService.get(mfId)
        const descriptorPolicy = reg !== undefined ? getFallback(reg.descriptor) : undefined
        const policy = descriptorPolicy ?? options.defaultPolicy
        const definition = getDefinitionForPhase(policy, phase)
        const retryPolicy: RetryPolicy =
          definition?.retry ?? policy?.retry ?? options.retryDefault ?? DEFAULT_RETRY
        const circuitPolicy: CircuitBreakerPolicy =
          policy?.circuitBreaker ?? options.circuitDefault ?? DEFAULT_CIRCUIT

        // mountElement / selector extraction — soft cast su shape ipotetica `reg.mount?.element`
        // (F8 registry non garantisce questa shape — caller F10 runtime context potrebbe popolarla).
        const mountElement = (
          reg as unknown as { mount?: { element?: HTMLElement } } | undefined
        )?.mount?.element
        const selector = (
          reg?.descriptor as unknown as { mount?: { selector?: string } } | undefined
        )?.mount?.selector

        function buildMfError(): MicroFrontendError {
          return new MicroFrontendError({
            code: error.code ?? 'MF_FALLBACK_RENDER_FAILED',
            message: error.message,
            microFrontendId: mfId,
            lifecyclePhase: phase,
            recoverable,
          })
        }

        // (5.1) Circuit check — open → skip retry, dispatch fallback directly
        if (!circuitBreaker.canExecute(mfId)) {
          if (definition !== undefined) {
            await dispatchFallback({
              broker,
              mfId,
              phase,
              error: buildMfError(),
              definition,
              ...(mountElement !== undefined && { mountElement }),
              ...(selector !== undefined && { selector }),
              ctx: undefined,
            })
          } else {
            broker.publish(
              FALLBACK_RENDERED_TOPIC,
              {
                microFrontendId: mfId,
                lifecyclePhase: phase,
                fallbackType: 'none',
                timestamp: Date.now(),
              },
              PUBLISH_OPTS,
            )
          }
          return
        }

        // (5.2) Retry check (skip runtime/update per OQ-1)
        const retryCapable =
          recoverable &&
          phase !== 'runtime' &&
          phase !== 'update' &&
          retryEngine.shouldRetry(mfId, phase, retryPolicy)
        if (retryCapable) {
          const attempt = retryEngine.getAttempts(mfId, phase)
          const delay = retryEngine.computeDelay(attempt, retryPolicy)
          retryEngine.incrementAttempt(mfId, phase)
          setTimeout(() => {
            const op = (mfService as unknown as Record<string, (id: string) => Promise<void>>)[
              phase
            ]
            // W11/D-V2-F14-10-AMENDED defensive guard: keep as future-proof against F8 API surface
            // changes (e.g. if F15+ adds runtime/update ops, this prevents undefined invocation).
            // Currently unreachable because phase filter (line above) excludes runtime/update — kept
            // as belt-and-suspenders for forward compatibility.
            if (typeof op !== 'function') return
            op.call(mfService, mfId).then(
              () => {
                // Success path: emit recovered + reset + recordSuccess
                broker.publish(
                  TOPIC_RECOVERED,
                  {
                    microFrontendId: mfId,
                    lifecyclePhase: phase,
                    attempts: attempt + 1,
                    timestamp: Date.now(),
                  },
                  PUBLISH_OPTS,
                )
                retryEngine.resetCounter(mfId, phase)
                circuitBreaker.recordSuccess(mfId, circuitPolicy)
              },
              () => {
                /* re-fail: subscriber riceve nuovo MF_ERROR_TOPIC, ciclo riprende */
              },
            )
          }, delay)
          return
        }

        // (5.3) Retry exhausted o skip: record + dispatch
        circuitBreaker.recordFailure(mfId, circuitPolicy)
        if (definition !== undefined) {
          await dispatchFallback({
            broker,
            mfId,
            phase,
            error: buildMfError(),
            definition,
            ...(mountElement !== undefined && { mountElement }),
            ...(selector !== undefined && { selector }),
            ctx: undefined,
          })
        } else {
          broker.publish(
            FALLBACK_RENDERED_TOPIC,
            {
              microFrontendId: mfId,
              lifecyclePhase: phase,
              fallbackType: 'none',
              timestamp: Date.now(),
            },
            PUBLISH_OPTS,
          )
        }
      }

      // (6) Subscribe MF_ERROR_TOPICS — P02 wire reale
      const errorSubHandle = installErrorSubscribe(broker, {
        dispatch: orchestratorChain,
        signal: ctrl.signal,
      })

      // (7) Subscribe microfrontend.unregistered per cleanup P-02
      const unregisterSub = broker.subscribe(
        'microfrontend.unregistered',
        (event) => {
          const payload = event.payload as
            | { readonly id?: string; readonly microFrontendId?: string }
            | undefined
          const mfId = payload?.id ?? payload?.microFrontendId
          if (typeof mfId !== 'string') return
          circuitBreaker.dispose(mfId)
          for (const phase of ALL_PHASES) retryEngine.resetCounter(mfId, phase)
        },
        { deliveryMode: 'sync' },
      )

      // (8) AbortSignal cleanup cascade D-V2-16
      const onAbort = (): void => {
        errorSubHandle.unsubscribeAll()
        unregisterSub.unsubscribe()
      }
      if (ctrl.signal.aborted) {
        onAbort()
      } else {
        ctrl.signal.addEventListener('abort', onAbort, { once: true })
      }

      // Expose ctrl tramite shutdownSignal opzionale (host responsability)
      const shutdownSignal = (broker as unknown as { shutdownSignal?: AbortSignal })
        .shutdownSignal
      if (shutdownSignal !== undefined) {
        if (shutdownSignal.aborted) ctrl.abort()
        else shutdownSignal.addEventListener('abort', () => ctrl.abort(), { once: true })
      }

      // Param hold — `defaultPolicy`/`retryDefault`/`circuitDefault` letti durante chain
      void options
    },
  }
}
