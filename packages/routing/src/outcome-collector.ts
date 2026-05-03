// outcome-collector.ts — Step 10 pipeline §28 (D-84): trasforma RouteOutcome in
// BrokerEvent `<topic>.loaded` o `<topic>.failed` PIÙ `network.error` per
// `category: 'network'` (D-80, D-81, D-82, ROUTE-12, ERR-02 ext).
//
// Riferimento decisioni (03-CONTEXT.md):
// - D-80: shape standard `BrokerError` su `<topic>.failed` — `code, message, category,
//         routeId, topic, eventId, originalError?, cause?, httpStatus?, retryAttempt?,
//         retryAfterMs?`. Sanitization rimuove `originalError`/`cause`/stack ricorsivi
//         (T-03-07-01 mitigation, replica pattern F2 `handleMappingError`).
// - D-81: `network.error` AGGIUNTIVO come BrokerEvent CORE separato per
//         `category: 'network'`. Permette consumer sistemici (telemetria, banner offline)
//         senza dipendere da topic specifico.
// - D-82: NO double publish — recursion guard `Set<eventId+suffix>` previene loop. Pattern
//         identico a F2 `handleMappingError` (broker-mapper-wrapper.ts:1029-1068) con
//         `inFlightMappingErrors`.
// - D-85: tap step 10 `event.outcome.collected` emesso PRIMA del publish (Pattern S3).
//         `safeTapStep` di core NON è esposto al barrel pubblico — replichiamo inline il
//         try/catch swallow (replica pattern route-executor.ts:236-260, mapper
//         broker-mapper-wrapper.ts:325).
//
// Topic naming resolution (D-80, ROUTE-12):
// - `route.publishes.success` esplicito > convention `<prefix>.loaded`
// - `route.publishes.error` esplicito > convention `<prefix>.failed`
// - Convention prefix: se topic termina con `.requested`, sostituisce il suffix; altrimenti
//   appende `.loaded`/`.failed`. Esempi:
//     `weather.requested` → `weather.loaded`/`weather.failed`
//     `weather.alert.requested` → `weather.alert.loaded`/`weather.alert.failed`
//     `weather` (no segmenti) → `weather.loaded`/`weather.failed` (fallback)
//
// Vincolo D-83: ZERO modifiche a packages/core/ + packages/mapper/ runtime. Il
// `publishFn` è iniettato come callback (DI) — il RouterBroker (plan 03-12) lo bind a
// `inner.publish` del MapperBroker.
//
// Threat coverage:
// - T-03-07-01 (Information Disclosure — originalError stack trace nel payload): mitigate
//   via `sanitizeError` che NON include `originalError`, `cause`, `stack`. Solo
//   `code/category/message/details` + ids. Pattern CR-06 sanitization F2.
// - T-03-07-02 (DoS — recursion infinita publish→handler→collect→publish): mitigate via
//   recursion guard `Set<eventId+suffix>` (D-82). Set chiave include il suffix per
//   permettere transizioni success→error su altro outcome (semantic identica al guard F2).
// - T-03-07-03 (Spoofing — malicious route.publishes sostituisce topic core): accettato.
//   Topic naming validato dal `bus.publish` a valle (F1 validateTopic regex);
//   l'OutcomeCollector è plugin authority — non valida.

import type {
  BrokerError,
  BrokerEvent,
  EventTap,
  PipelineSnapshot,
  PipelineStep,
} from '@sembridge/core'
import type { CompiledRoute } from './route-resolver'
import type { RouteOutcome } from './types/route-outcome'

/**
 * Callback per la pubblicazione del BrokerEvent risultante.
 *
 * Il RouterBroker (plan 03-12) lo bind a `inner.publish` del MapperBroker per
 * mantenere il vincolo D-83 (ZERO modifiche a core/mapper runtime). Permette a
 * `OutcomeCollector` di restare puro — testabile con mock `vi.fn()`.
 */
export type PublishFn = (
  topic: string,
  payload: unknown,
  options?: {
    source?: { type: string; id: string }
    correlationId?: string
  },
) => void

/**
 * Dependency injection per `OutcomeCollector` (D-80, D-82).
 *
 * - `publishFn` — callback iniettato per pubblicare il BrokerEvent risultante.
 * - `tap` — opzionale; se presente, emette step 10 `event.outcome.collected` PRIMA
 *   del publish (Pattern S3 + D-85). Default: no-op (nessuna emissione).
 */
export interface OutcomeCollectorDeps {
  readonly publishFn: PublishFn
  readonly tap?: EventTap
}

/**
 * Shape del BrokerError sanitized per il payload published (D-80, T-03-07-01).
 *
 * Esclude `originalError`, `cause`, `stack` per prevenire information disclosure.
 * Include solo i campi pubblici sicuri della contract D-80.
 */
interface SanitizedError {
  readonly code: string
  readonly category: string
  readonly message: string
  readonly routeId?: string
  readonly topic?: string
  readonly eventId?: string
  readonly httpStatus?: number
  readonly retryAttempt?: number
  readonly retryAfterMs?: number
  readonly details?: Readonly<Record<string, unknown>>
}

/**
 * Deriva il topic `<prefix>.loaded` da un topic originale.
 *
 * Se il topic termina con `.requested`, il suffix viene sostituito.
 * Altrimenti `.loaded` viene appeso (fallback per topic non standard).
 *
 * @example
 * deriveLoadedTopic('weather.requested') === 'weather.loaded'
 * deriveLoadedTopic('weather.alert.requested') === 'weather.alert.loaded'
 * deriveLoadedTopic('weather') === 'weather.loaded'
 */
function deriveLoadedTopic(originalTopic: string): string {
  const idx = originalTopic.lastIndexOf('.')
  if (idx === -1) return `${originalTopic}.loaded`
  const suffix = originalTopic.slice(idx + 1)
  if (suffix === 'requested') {
    const prefix = originalTopic.slice(0, idx)
    return `${prefix}.loaded`
  }
  return `${originalTopic}.loaded`
}

/**
 * Deriva il topic `<prefix>.failed` da un topic originale.
 *
 * Stessa logica di `deriveLoadedTopic` ma con suffix `.failed`.
 *
 * @example
 * deriveFailedTopic('weather.requested') === 'weather.failed'
 * deriveFailedTopic('weather.alert.requested') === 'weather.alert.failed'
 */
function deriveFailedTopic(originalTopic: string): string {
  const idx = originalTopic.lastIndexOf('.')
  if (idx === -1) return `${originalTopic}.failed`
  const suffix = originalTopic.slice(idx + 1)
  if (suffix === 'requested') {
    const prefix = originalTopic.slice(0, idx)
    return `${prefix}.failed`
  }
  return `${originalTopic}.failed`
}

/**
 * Sanitizza un BrokerError per il publish (T-03-07-01 mitigation, D-80).
 *
 * Rimuove `originalError`, `cause`, `stack` e mantiene solo i campi pubblici sicuri
 * della contract D-80. Conditional spread per `exactOptionalPropertyTypes: true`.
 *
 * I campi `httpStatus`, `retryAttempt`, `retryAfterMs` non sono nativi del BrokerError
 * di F1 ma sono parte dello shape D-80 esteso F3 — leggi via cast tipato isolato.
 */
function sanitizeError(err: BrokerError): SanitizedError {
  const ext = err as BrokerError & {
    httpStatus?: number
    retryAttempt?: number
    retryAfterMs?: number
  }
  // WR-05 fix iter 2: D-83 strict vieta estendere CreateBrokerErrorParams (core).
  // I 3 field estesi D-80 (httpStatus/retryAttempt/retryAfterMs) sono popolati o come
  // top-level (legacy) o nel `details` bag (workaround D-83-compliant). Questo
  // sanitizer ora legge da entrambe le sedi — top-level prevale, fallback su details.
  const detailsBag = (err.details ?? {}) as {
    httpStatus?: unknown
    retryAttempt?: unknown
    retryAfterMs?: unknown
  }
  const httpStatus =
    ext.httpStatus ?? (typeof detailsBag.httpStatus === 'number' ? detailsBag.httpStatus : undefined)
  const retryAttempt =
    ext.retryAttempt ??
    (typeof detailsBag.retryAttempt === 'number' ? detailsBag.retryAttempt : undefined)
  const retryAfterMs =
    ext.retryAfterMs ??
    (typeof detailsBag.retryAfterMs === 'number' ? detailsBag.retryAfterMs : undefined)
  return {
    code: err.code,
    category: err.category,
    message: err.message,
    ...(err.routeId !== undefined && { routeId: err.routeId }),
    ...(err.topic !== undefined && { topic: err.topic }),
    ...(err.eventId !== undefined && { eventId: err.eventId }),
    ...(httpStatus !== undefined && { httpStatus }),
    ...(retryAttempt !== undefined && { retryAttempt }),
    ...(retryAfterMs !== undefined && { retryAfterMs }),
    ...(err.details !== undefined && { details: err.details }),
  }
}

/**
 * OutcomeCollector — step 10 pipeline §28 (D-84).
 *
 * Trasforma il `RouteOutcome` ritornato dall'executor in un BrokerEvent
 * `<topic>.loaded` (success) o `<topic>.failed` (error), pubblicandolo UNA VOLTA
 * SOLA tramite `publishFn` (D-82 — recursion guard). Per `category: 'network'`
 * pubblica anche `network.error` come BrokerEvent CORE separato (D-81).
 *
 * Pre-publish emette il tap step 10 `event.outcome.collected` con metadata
 * strutturata (routeId, ok, errorCode/errorCategory). Pattern S3.
 *
 * @example
 * ```ts
 * const collector = new OutcomeCollector({
 *   publishFn: (topic, payload, options) => mapperBroker.publish(topic, payload, options),
 *   tap: inspectorTap,
 * })
 * collector.collect(outcome, route, event)
 * ```
 */
export class OutcomeCollector {
  /**
   * Recursion guard per `D-82` (NO double publish).
   *
   * Chiave: `<eventId>::<suffix>` dove suffix è `'loaded'` o `'failed'`. Permette
   * transizioni semantiche fra outcome distinti sullo stesso eventId (es. retry
   * loop) ma blocca la re-entrata sullo stesso outcome (loop publish→handler→collect).
   */
  private readonly inFlightPublishes = new Set<string>()

  constructor(private readonly deps: OutcomeCollectorDeps) {}

  /**
   * Esegue lo step 10 pipeline §28 (D-84): emette tap, sanitizza, pubblica.
   *
   * Sequenza:
   * 1. Recursion guard check (D-82) → skip se già in-flight
   * 2. Tap step 10 emit (D-85, Pattern S3) — PRE-publish
   * 3. Branch ok: publish `<prefix>.loaded` con canonicalPayload + metadata
   * 4. Branch error: publish `<prefix>.failed` con shape D-80 sanitized
   * 5. Per `category: 'network'`: publish addizionale `network.error` (D-81)
   * 6. Cleanup recursion guard nel `finally`
   *
   * @param outcome - RouteOutcome ritornato dall'executor (step 9).
   * @param route - CompiledRoute che ha generato l'outcome (per `publishes` override).
   * @param event - BrokerEvent originario (`.requested`) — usato per `correlationId`.
   */
  collect(outcome: RouteOutcome, route: CompiledRoute, event: BrokerEvent): void {
    const guardKey = `${event.id}::${outcome.ok ? 'loaded' : 'failed'}`
    if (this.inFlightPublishes.has(guardKey)) return
    this.inFlightPublishes.add(guardKey)

    const startTime = performance.now()

    try {
      // Tap step 10 PRE-publish (D-85, Pattern S3).
      this.emitTap(startTime, event, route, outcome)

      if (outcome.ok) {
        this.publishLoaded(outcome, route, event)
      } else {
        this.publishFailed(outcome, route, event)
        // D-81: network.error secondario per category='network'.
        if (outcome.error.category === 'network') {
          this.publishNetworkError(outcome.error, route, event)
        }
      }
    } finally {
      this.inFlightPublishes.delete(guardKey)
    }
  }

  /**
   * Conta le publish attualmente in-flight (debug helper, riusato da Inspector F6).
   */
  inFlightCount(): number {
    return this.inFlightPublishes.size
  }

  /**
   * Pubblica `<topic>.loaded` con canonicalPayload + metadata (D-80 success branch).
   *
   * Topic resolution: `route.publishes.success` esplicito (override) >
   * convention `<prefix>.loaded`.
   */
  private publishLoaded(
    outcome: Extract<RouteOutcome, { ok: true }>,
    route: CompiledRoute,
    event: BrokerEvent,
  ): void {
    const publishes = (route.definition as { publishes?: { success?: string } }).publishes
    const successTopic = publishes?.success ?? deriveLoadedTopic(event.topic)

    // Costruzione payload: spread del canonicalPayload (se object) + metadata opzionale.
    const basePayload =
      outcome.canonicalPayload !== null &&
      typeof outcome.canonicalPayload === 'object' &&
      !Array.isArray(outcome.canonicalPayload)
        ? (outcome.canonicalPayload as Record<string, unknown>)
        : { value: outcome.canonicalPayload }

    const payload = {
      ...basePayload,
      ...(outcome.metadata !== undefined && { metadata: outcome.metadata }),
    }

    this.deps.publishFn(successTopic, payload, {
      source: { type: 'system', id: 'router' },
      correlationId: event.id,
    })
  }

  /**
   * Pubblica `<topic>.failed` con BrokerError shape D-80 sanitized.
   *
   * Topic resolution: `route.publishes.error` esplicito (override) >
   * convention `<prefix>.failed`.
   */
  private publishFailed(
    outcome: Extract<RouteOutcome, { ok: false }>,
    route: CompiledRoute,
    event: BrokerEvent,
  ): void {
    const publishes = (route.definition as { publishes?: { error?: string } }).publishes
    const failedTopic = publishes?.error ?? deriveFailedTopic(event.topic)
    const safeError = sanitizeError(outcome.error)

    this.deps.publishFn(
      failedTopic,
      {
        error: safeError,
        sourceEvent: { topic: event.topic, eventId: event.id },
        routeId: route.id,
      },
      {
        source: { type: 'system', id: 'router' },
        correlationId: event.id,
      },
    )
  }

  /**
   * Pubblica `network.error` come BrokerEvent CORE separato (D-81).
   *
   * Aggiuntivo a `<topic>.failed` quando `error.category === 'network'`. Consumer
   * sistemici (telemetria, banner offline UI) si sottoscrivono a `network.error`
   * direttamente.
   */
  private publishNetworkError(error: BrokerError, route: CompiledRoute, event: BrokerEvent): void {
    const safeError = sanitizeError(error)
    this.deps.publishFn(
      'network.error',
      {
        error: safeError,
        sourceEvent: { topic: event.topic, eventId: event.id },
        routeId: route.id,
      },
      {
        source: { type: 'system', id: 'router' },
        correlationId: event.id,
      },
    )
  }

  /**
   * Emette tap step 10 `event.outcome.collected` con metadata strutturata (D-85).
   *
   * Pattern try/catch swallow inline (replica F2 `emitF2Tap` /
   * `route-executor.emitTap`): `safeTapStep` di core NON è esposto al barrel
   * pubblico, quindi inline pattern preserva D-83 strict.
   */
  private emitTap(
    startTime: number,
    event: BrokerEvent,
    route: CompiledRoute,
    outcome: RouteOutcome,
  ): void {
    if (this.deps.tap === undefined) return
    const metadata: Record<string, unknown> = {
      routeId: route.id,
      ok: outcome.ok,
    }
    if (!outcome.ok) {
      metadata['errorCode'] = outcome.error.code
      metadata['errorCategory'] = outcome.error.category
    }
    const snapshot: PipelineSnapshot = {
      eventId: event.id,
      topic: event.topic,
      step: 'event.outcome.collected' as PipelineStep,
      timestamp: Date.now(),
      durationMs: performance.now() - startTime,
      metadata,
    }
    try {
      this.deps.tap.onPipelineStep('event.outcome.collected' as PipelineStep, snapshot)
    } catch {
      // Pattern F1 safeTapStep: swallow per non rompere il chain (T-04-01 mitigation).
    }
  }
}
