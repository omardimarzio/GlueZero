/**
 * Service Locator binding per `@gluezero/fallbacks` (D-V2-F14-04).
 *
 * ## Riuso F8 SERVICE_FALLBACKS constant (D-V2-02 BLOCKING coerente)
 *
 * `SERVICE_FALLBACKS = 'fallbacks' as const` GIA esportato da
 * `@gluezero/core/src/services.ts:43` (F8 pre-dichiarato per F14). Pattern coerente
 * F11 `SERVICE_PERMISSIONS` + F12 `SERVICE_COMPAT` + F13 `SERVICE_ISOLATION` — riuso
 * constant F8 invece di creare local Symbol divergente.
 *
 * ## Service signature
 *
 * `FallbacksService` interface definisce l'API che `fallbacksModule({...}).install`
 * registrerà via `ctx.registerService(SERVICE_FALLBACKS, ...)` in W2 P04. Altri
 * consumer (es. devtools F16 SnapshotProvider per inspector overlay, devtools
 * MfHistogram timeline replay) possono query la service istanza via
 * `broker.getService<FallbacksService>(SERVICE_FALLBACKS)`.
 *
 * @see prd_2.0.0.md §29.4 — Service signature getCircuitState + getRetryAttempts
 * @see D-V2-02 — Service Locator naming BLOCKING
 * @see D-V2-F14-04 — fallbacksModule install pattern
 */
import { SERVICE_FALLBACKS } from '@gluezero/core'
import type { MicroFrontendErrorLifecyclePhase } from './types/errors.js'

/**
 * Re-export del constant F8 per consumer convenience (canonical source = `@gluezero/core`).
 *
 * Pattern coerente F11 `permissions-module.ts` + F12 + F13 `isolation/service-locator.ts:33`
 * — package fallbacks NON definisce un constant locale divergente per evitare due
 * chiavi di binding (F8 `'fallbacks'` vs locale Symbol diverging).
 */
export { SERVICE_FALLBACKS }

/**
 * `FallbacksService` — Signature service registrato da `fallbacksModule({...}).install` (W2 P04).
 *
 * API W1 stub (signature definitiva, W2 P04 implementa logica reale):
 * - `getCircuitState(mfId)`: lookup state corrente del circuit per `mfId`. Ritorna
 *   `undefined` se MF non tracked dal circuit (circuit breaker disabled o MF mai
 *   transitato attraverso un error topic). Usato da devtools F16 SnapshotProvider.
 * - `getRetryAttempts(mfId, phase)`: lookup contatore retry per coppia (mfId, phase).
 *   Ritorna 0 default se nessun retry counter attivo. Reset post `microfrontend.recovered`
 *   emission. Usato da devtools timeline + observability metrics.
 *
 * NOTE W1 stub: questa signature è la public contract. W2 P04 implementa real logic
 * via `RetryEngine` + `CircuitBreaker` internal state machines.
 *
 * @see D-V2-F14-11 — CircuitBreaker per-MF state machine 3-state
 * @see D-V2-F14-09 — RetryPolicy scope 6 onXError
 */
export interface FallbacksService {
  readonly getCircuitState: (
    mfId: string,
  ) => 'closed' | 'open' | 'half-open' | undefined
  readonly getRetryAttempts: (
    mfId: string,
    phase: MicroFrontendErrorLifecyclePhase,
  ) => number
}
