/**
 * F14 policy interfaces — `MicroFrontendFallbackPolicy` + `FallbackDefinition`
 * discriminated union 5-mode + `RetryPolicy` + `CircuitBreakerPolicy` (PRD §29.3
 * verbatim).
 *
 * Coverage REQ-ID skeleton W1: MF-FALLBACK-01 (policy interface 6-onXError scope
 * frozen REQUIREMENTS.md riga 140) + MF-FALLBACK-03 (CircuitBreakerPolicy).
 *
 * **D-83 strict septuple**: tutti i type sono locali a `@gluezero/fallbacks/src/`
 * — zero diff `packages/{core,microfrontends,mapper,context,permissions,compat,isolation}/src/`.
 *
 * @see prd_2.0.0.md §29.3 — Policy + RetryPolicy + CircuitBreakerPolicy
 * @see D-V2-F14-09 — RetryPolicy scope 6 onXError + ±20% jitter
 * @see D-V2-F14-11 — CircuitBreakerPolicy per-MF state machine 3-state
 * @see D-V2-F14-13/14/15 — FallbackDefinition 4 rendering modes + none
 */
import type { MicroFrontendErrorLifecyclePhase } from './errors.js'

/**
 * `RetryPolicy` (PRD §29.3) — Configurazione retry per-phase scope.
 *
 * - `attempts`: numero totale di tentativi (default 1 = no retry, MAX_TYPICAL 5).
 * - `delayMs?`: base delay (ms) tra tentativi. Default 0 (immediato).
 * - `backoff?`: strategia di crescita delay (`'none' | 'linear' | 'exponential'`). Default 'none'.
 * - `jitter?`: applica randomization ±20% al delay (default false). Mitigazione retry storm P-01.
 *
 * @see D-V2-F14-09 — RetryPolicy scope 6 onXError + ±20% jitter conservativo
 */
export interface RetryPolicy {
  readonly attempts: number
  readonly delayMs?: number
  readonly backoff?: 'none' | 'linear' | 'exponential'
  readonly jitter?: boolean
}

/**
 * `CircuitBreakerPolicy` (PRD §29.3) — Configurazione circuit breaker per-MF.
 *
 * State machine 3-state: `closed` → `open` (su threshold) → `half-open` (post timer)
 * → `closed` (su success) | `open` (su failure).
 *
 * - `enabled`: default false (opt-in safety).
 * - `failureThreshold`: failure consecutive prima di aprire il circuit.
 * - `resetAfterMs`: durata `open` state prima di passare a `half-open`.
 *
 * @see D-V2-F14-11 — CircuitBreaker per-MF state machine
 */
export interface CircuitBreakerPolicy {
  readonly enabled: boolean
  readonly failureThreshold: number
  readonly resetAfterMs: number
}

/**
 * Type-only forward reference per evitare ciclo import (microfrontend-error.ts
 * importa policy.ts per Constructor params type, policy.ts referenzia error shape
 * per `FallbackDefinition.handler` signature).
 *
 * Shape minimale subset di `MicroFrontendError` necessaria al handler signature.
 * Cast soft al call site (W2 P02 garantisce instanceof + readonly fields).
 */
type MicroFrontendErrorLike = Error & {
  readonly category: 'microfrontend'
  readonly code: string
  readonly microFrontendId: string
  readonly lifecyclePhase: MicroFrontendErrorLifecyclePhase
  readonly recoverable: boolean
}

/**
 * `FallbackDefinition` (PRD §29.3) — Discriminated union 5-mode.
 *
 * - `type:'html'`: target.innerHTML = html (host-controlled config, no XSS sanitization runtime).
 * - `type:'component'`: delega a F15 adapter via `SERVICE_FRAMEWORK_ADAPTER`; assente → stub HTML generic.
 * - `type:'event'`: broker.publish(topic ?? 'microfrontend.fallback.event', payload).
 * - `type:'custom'`: await handler(error, ctx) con try/catch.
 * - `type:'none'`: no-op + emit observability topic.
 *
 * Note: discriminator semplice (NO union members type-narrow stretto) per coerenza
 * con shape PRD verbatim — runtime check W2 P02 valida `type` ↔ campi richiesti.
 *
 * @see D-V2-F14-13/14/15 — 4 rendering modes + none
 */
export interface FallbackDefinition {
  readonly type: 'html' | 'component' | 'event' | 'custom' | 'none'
  readonly html?: string
  readonly component?: unknown
  readonly topic?: string
  readonly handler?: (err: MicroFrontendErrorLike, ctx: unknown) => void | Promise<void>
  readonly recoverable?: boolean
  readonly retry?: RetryPolicy
}

/**
 * `MicroFrontendFallbackPolicy` (PRD §29.3) — Policy completa per-MF.
 *
 * 6 `onXError` scope literal compliance PRD §29.3 (frozen REQUIREMENTS.md riga 140)
 * + 2 policy-level common `retry` + `circuitBreaker` (applicabili a tutti i 6
 * onXError scope come default — per-phase override via `FallbackDefinition.retry?`).
 *
 * `destroy` phase NON ha per-policy field dedicato: usa default fallback chain
 * orchestrator no-policy-field (W2 P04). `onUpdateError?` supported via
 * `getDefinitionForPhase` switch (W2 task 14-04-T03).
 *
 * @see prd_2.0.0.md §29.3 — Policy + RetryPolicy + CircuitBreakerPolicy
 * @see D-V2-F14-09 — Retry scope 6 onXError
 */
export interface MicroFrontendFallbackPolicy {
  readonly onLoadError?: FallbackDefinition
  readonly onBootstrapError?: FallbackDefinition
  readonly onMountError?: FallbackDefinition
  readonly onRuntimeError?: FallbackDefinition
  readonly onUpdateError?: FallbackDefinition
  readonly onUnmountError?: FallbackDefinition
  readonly retry?: RetryPolicy
  readonly circuitBreaker?: CircuitBreakerPolicy
}
