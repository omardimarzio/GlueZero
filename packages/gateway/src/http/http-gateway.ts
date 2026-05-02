// http-gateway.ts — Server Gateway HTTP centralizzato (PRD §18, ROUTE-06).
//
// Compone le 6+1 Strategy come dependency injection nella `execute()` (Pattern 3 RESEARCH).
// Il gateway NON implementa le strategy — le riceve dal `RouteExecutor`/`http-handler`.
// Plan 03-09/10/11 forniscono le default implementation di RetryStrategy/AuthStrategy/etc.
//
// Vincoli chiave:
// - SEC-05 (D-71): URL allowlist pre-fetch + post-redirect re-validation (Pitfall 7).
// - ROUTE-13: AbortController per ogni request, abortInFlight + abortInFlightByOwner.
// - ROUTE-06: tutte le route HTTP DEVONO passare per il gateway (no fetch diretto da plugin).
// - D-70: Idempotency-Key auto-generato al first attempt + persistente sui retry
//   (chiave: BrokerEvent.id originario — chiusura PITFALLS #3 retry-storm con replay).
// - D-72: Authorization Bearer header + single-flight refresh (delegato a AuthStrategy).
// - D-77: AbortSignal del subscriber propagato alla fetch via combineSignals
//   (chiusura PITFALLS #2.B).
// - D-99: Circuit breaker per-route opt-in (canExecute pre-fetch + recordSuccess/Failure).
//
// Pattern composition (D-83):
// - ZERO modifiche a packages/core/ + packages/mapper/ runtime.
// - HttpGateway è invocato dal `http-handler.ts` di @sembridge/routing (plan 03-08 Task 3).
// - Le 6+1 Strategy sono fornite come dependency injection — qui agnostico all'impl.
//
// Threat coverage (vedi <threat_model> in 03-08-PLAN.md):
// - T-03-08-01 (Information Disclosure — redirect leak Authorization): mitigate via
//   `redirect: 'manual'` + `validateAgainstAllowlist(Location)`.
// - T-03-08-02 (Tampering — URL injection bypass): URL parsed via `new URL(location, base)`.
// - T-03-08-04 (Spoofing — Idempotency-Key replay): nanoid 21-char entropy 126-bit
//   (delegato a IdempotencyStrategy — A2 RESEARCH).
// - T-03-08-06 (DoS — inFlight Map cresce illimitato): `finally { this.inFlight.delete(eventId) }`.

import type { BrokerEvent } from '@sembridge/core'
import { createBrokerError } from '@sembridge/core'
import { combineSignals } from './combine-signals'
import type { GatewayConfig } from './types/gateway-config'
import type {
  AuthStrategy,
  BackpressureStrategy,
  CircuitBreakerStrategy,
  DedupeStrategy,
  HttpRequestSpec,
  HttpResponseSpec,
  IdempotencyStrategy,
  RetryStrategy,
  TimeoutStrategy,
} from './types/http-strategies'
import { validateAgainstAllowlist } from './url-allowlist'

/**
 * Strategy bundle iniettato a `HttpGateway.execute()` (D-68).
 *
 * Tutti i field opzionali — il gateway funziona anche senza strategy (plain fetch),
 * ma in produzione il `RouterBroker` (plan 03-12) inietterà le default
 * implementation (`ExponentialBackoffWithJitter`, `BearerHook`, `AutoIdempotency`, ...).
 */
export interface HttpGatewayStrategies {
  readonly retry?: RetryStrategy
  readonly timeout?: TimeoutStrategy
  readonly dedupe?: DedupeStrategy
  readonly backpressure?: BackpressureStrategy
  readonly auth?: AuthStrategy
  readonly idempotency?: IdempotencyStrategy
  readonly circuitBreaker?: CircuitBreakerStrategy
}

/**
 * Entry interna del registry `inFlight` (T-03-08-06 mitigation: cleanup garantito).
 */
interface InFlightEntry {
  readonly controller: AbortController
  readonly ownerId: string | undefined
  readonly routeId: string
}

/**
 * Subset di route information consumato dal gateway. La signature accetta plain
 * `{ id, ownerId? }` per evitare coupling stretto con `CompiledRoute` di @sembridge/routing
 * (T-03-08-02 — gateway agnostico al routing engine).
 */
export interface HttpGatewayRouteInfo {
  readonly id: string
  readonly ownerId?: string
}

/**
 * HttpGateway — Server Gateway HTTP centralizzato (PRD §18, ROUTE-06).
 *
 * Lifecycle:
 * 1. `execute(request, route, event, externalSignal, strategies)` — validate URL → inject
 *    auth/idempotency headers → combine N signal → fetch (con retry loop interno se
 *    `strategies.retry` presente) → re-validate Location su 3xx → parse JSON.
 * 2. `abortInFlight(eventId)` — abort puntuale di una request in volo (ROUTE-13).
 * 3. `abortInFlightByOwner(ownerId)` — cascade abort plugin-scoped (LIFE-02 ext F3, D-86).
 *
 * @example
 * ```ts
 * const gw = createHttpGateway({ allowlist: ['https://api.example.com'] })
 * const response = await gw.execute(request, { id: 'r-1' }, event, signal, strategies)
 * if (response.ok) console.log(response.body)
 * ```
 */
export class HttpGateway {
  private readonly inFlight = new Map<string, InFlightEntry>()
  private readonly config: GatewayConfig

  constructor(config: GatewayConfig = {}) {
    this.config = config
  }

  /**
   * Esegue una HTTP request attraverso la policy chain (D-68 + D-71/D-72/D-77/D-99).
   *
   * Pipeline (esecuzione sincrona delle policy + retry loop interno):
   * 1. Pre-fetch allowlist validation (D-71 / SEC-05).
   * 2. Auth header injection via `strategies.auth.getToken()` (D-72).
   * 3. Idempotency-Key generation (D-70) per metodi non-idempotenti.
   * 4. AbortSignal coordinato (external + own + timeout) via `combineSignals` (D-77).
   * 5. Circuit breaker check (D-99) — skip fetch se open.
   * 6. Retry loop con `strategies.retry.shouldRetry()` + `delayMs()`.
   * 7. Fetch + redirect manual + post-redirect Location re-validation (Pitfall 7).
   * 8. Parse JSON → `HttpResponseSpec`.
   *
   * @returns `HttpResponseSpec` con `ok`/`status`/`headers`/`body`. NON throw su 4xx/5xx
   *   — il caller (http-handler) decide come trasformarli in RouteOutcome.error.
   * @throws `BrokerError 'gateway.url.forbidden'` su URL fuori allowlist (pre-fetch).
   * @throws `BrokerError 'gateway.timeout'/'gateway.aborted'/'gateway.network'` su error fetch.
   * @throws `BrokerError 'circuit.open'` se circuit breaker open per route.
   */
  async execute(
    request: HttpRequestSpec,
    route: HttpGatewayRouteInfo,
    event: BrokerEvent,
    externalSignal: AbortSignal | undefined,
    strategies: HttpGatewayStrategies,
  ): Promise<HttpResponseSpec> {
    // SEC-05 (D-71): pre-fetch allowlist validation.
    validateAgainstAllowlist(request.url, this.config.allowlist, {
      routeId: route.id,
      topic: event.topic,
      eventId: event.id,
    })

    // Auth header injection (D-72) — SingleFlight refresh delegato a AuthStrategy.
    const headers: Record<string, string> = { ...request.headers }
    if (strategies.auth) {
      const token = await strategies.auth.getToken()
      if (token !== undefined) headers['Authorization'] = `Bearer ${token}`
    }

    // Idempotency-Key (D-70 / SEC-03) — UNA volta, persistente sui retry (Pitfall 3).
    if (
      strategies.idempotency &&
      (request.method === 'POST' ||
        request.method === 'PATCH' ||
        request.method === 'PUT' ||
        request.method === 'DELETE')
    ) {
      headers[strategies.idempotency.headerName()] = strategies.idempotency.generate(event.id)
    }

    // Combined signal (D-77 + Pitfall 4).
    const ownController = new AbortController()
    this.inFlight.set(event.id, {
      controller: ownController,
      ownerId: route.ownerId,
      routeId: route.id,
    })

    const timeoutMs =
      typeof this.config.defaults?.timeout === 'number' ? this.config.defaults.timeout : 30_000
    const timeoutSignal = strategies.timeout?.signal(timeoutMs) ?? AbortSignal.timeout(timeoutMs)
    const fetchSignal = combineSignals(externalSignal, ownController.signal, timeoutSignal)

    const finalRequest: HttpRequestSpec = { ...request, headers }

    try {
      // Circuit breaker (D-99) check pre-fetch.
      if (strategies.circuitBreaker && !strategies.circuitBreaker.canExecute(route.id)) {
        throw createBrokerError({
          code: 'circuit.open',
          category: 'network',
          message: `Circuit breaker open for route "${route.id}"`,
          routeId: route.id,
          topic: event.topic,
          eventId: event.id,
        })
      }

      // Retry loop — delega a RetryStrategy.shouldRetry/delayMs.
      let attempt = 0
      let lastError: Error | undefined
      let lastResponse: Response | undefined
      const maxAttempts = strategies.retry
        ? (this.config.defaults?.retry?.maxAttempts ?? 3)
        : 1

      while (attempt < maxAttempts) {
        attempt++
        try {
          const response = await this.fetchOnce(finalRequest, fetchSignal)
          lastResponse = response
          if (response.ok || !strategies.retry?.shouldRetry(response, undefined, attempt)) {
            strategies.circuitBreaker?.recordSuccess(route.id)
            return await this.parseResponse(response)
          }
          if (attempt < maxAttempts && strategies.retry) {
            const retryAfter = response.headers.get('Retry-After')
            const delay = strategies.retry.delayMs(attempt, retryAfter)
            await new Promise<void>((res) => setTimeout(res, delay))
          }
        } catch (err) {
          lastError = err as Error
          // Re-throw immediato per BrokerError gateway.url.forbidden (post-redirect).
          if (
            (err as { code?: string } | null)?.code === 'gateway.url.forbidden' ||
            (err as { code?: string } | null)?.code === 'circuit.open'
          ) {
            throw err
          }
          if (
            !strategies.retry?.shouldRetry(undefined, lastError, attempt) ||
            attempt >= maxAttempts
          ) {
            break
          }
          const retryStrategy = strategies.retry
          if (retryStrategy) {
            await new Promise<void>((res) => setTimeout(res, retryStrategy.delayMs(attempt)))
          }
        }
      }

      strategies.circuitBreaker?.recordFailure(route.id)

      // Outcome finale dopo retry exhausted.
      if (lastResponse) {
        return await this.parseResponse(lastResponse)
      }
      // Network error / timeout / abort.
      throw createBrokerError({
        code: this.classifyError(lastError, ownController.signal, externalSignal, timeoutSignal),
        category: 'network',
        message: lastError?.message ?? 'Network error',
        routeId: route.id,
        topic: event.topic,
        eventId: event.id,
        ...(lastError && { originalError: lastError }),
        details: { attemptCount: attempt },
      })
    } finally {
      this.inFlight.delete(event.id)
    }
  }

  /**
   * Abort puntuale di una request in volo (ROUTE-13).
   *
   * @param eventId - id dell'evento che ha originato la request.
   * @param reason - motivo abort propagato a `signal.reason`.
   * @returns `true` se l'abort è stato eseguito, `false` se l'eventId non era in volo.
   */
  abortInFlight(eventId: string, reason: string = 'gateway.aborted'): boolean {
    const entry = this.inFlight.get(eventId)
    if (!entry) return false
    entry.controller.abort(reason)
    return true
  }

  /**
   * Cascade abort di tutte le request bound al ownerId (LIFE-02 ext F3, D-86).
   *
   * @param ownerId - id del plugin/owner.
   * @param reason - motivo abort (default `'plugin.unregistered'`).
   * @returns Numero di request abortite (0 se nessuna).
   */
  abortInFlightByOwner(ownerId: string, reason: string = 'plugin.unregistered'): number {
    let count = 0
    for (const entry of this.inFlight.values()) {
      if (entry.ownerId === ownerId) {
        entry.controller.abort(reason)
        count++
      }
    }
    return count
  }

  /**
   * Conta le request in volo (debug helper, riusato da Inspector F6).
   */
  inFlightCount(): number {
    return this.inFlight.size
  }

  /**
   * Esegue una singola fetch con `redirect: 'manual'` + Location re-validation (Pitfall 7).
   *
   * @internal
   */
  private async fetchOnce(req: HttpRequestSpec, signal: AbortSignal): Promise<Response> {
    const init: RequestInit = {
      method: req.method,
      headers: req.headers,
      signal,
      redirect: 'manual',
      ...(req.body !== undefined && { body: req.body }),
    }
    const response = await fetch(req.url, init)
    // Pitfall 7 (D-71): post-redirect re-validation.
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('Location')
      if (location !== null) {
        const resolvedUrl = new URL(location, req.url).href
        validateAgainstAllowlist(resolvedUrl, this.config.allowlist)
        // Refetch manuale con stessi headers (preserve Idempotency-Key + Authorization).
        return await fetch(resolvedUrl, init)
      }
    }
    return response
  }

  /**
   * Parse Response → HttpResponseSpec normalizzato.
   *
   * Tenta `await response.json()`; su parse fail (response empty, non-JSON) ritorna
   * `body: null` invece di throw — il caller decide la severity.
   *
   * @internal
   */
  private async parseResponse(response: Response): Promise<HttpResponseSpec> {
    let body: unknown
    try {
      body = await response.json()
    } catch {
      body = null
    }
    return {
      ok: response.ok,
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body,
    }
  }

  /**
   * Classifica l'errore di fetch in base allo stato dei signal abort.
   *
   * - `signal.reason` include 'timeout' o equals 'gateway.timeout' → `gateway.timeout`
   * - signal aborted ma non timeout → `gateway.aborted`
   * - altrimenti → `gateway.network` (DNS/CORS/offline/parse)
   *
   * @internal
   */
  private classifyError(
    _err: Error | undefined,
    ownSignal: AbortSignal,
    externalSignal: AbortSignal | undefined,
    timeoutSignal: AbortSignal,
  ): 'gateway.timeout' | 'gateway.network' | 'gateway.aborted' {
    // Timeout: il timeout signal scattato è il discriminante più affidabile.
    if (timeoutSignal.aborted) return 'gateway.timeout'
    // External abort con reason che indica timeout
    if (externalSignal?.aborted) {
      const reason = String(externalSignal.reason ?? '')
      if (reason.includes('timeout') || reason === 'gateway.timeout') return 'gateway.timeout'
      return 'gateway.aborted'
    }
    if (ownSignal.aborted) {
      const reason = String(ownSignal.reason ?? '')
      if (reason.includes('timeout') || reason === 'gateway.timeout') return 'gateway.timeout'
      return 'gateway.aborted'
    }
    return 'gateway.network'
  }
}
