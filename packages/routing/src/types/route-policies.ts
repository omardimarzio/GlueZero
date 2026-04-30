// RoutePolicies — descrittori dichiarativi delle policy applicabili ad ogni
// `RouteDefinition` del routing engine F3 (PRD §17.8, §23, REQ ROUTE-08/10/11/13,
// SEC-01/03).
//
// Riferimento decisioni (03-CONTEXT.md):
// - D-68: Strategy Pattern per ogni policy (`RetryStrategy`, `TimeoutStrategy`,
//         `DedupeStrategy`, `BackpressureStrategy`, `AuthStrategy`,
//         `IdempotencyStrategy`). I tipi qui sono i **descriptor** dichiarativi che
//         istanziano la strategy concreta nel gateway (plan 03-08+).
// - D-69: Retry default `{ maxAttempts: 3, baseDelayMs: 300, maxDelayMs: 10000 }` con
//         full jitter; retry differenziato 4xx/5xx (chiusura PRD §39 #8).
// - D-70: Idempotency default `{ mode: 'auto', headerName: 'Idempotency-Key' }` per
//         POST/PATCH/PUT/DELETE (chiusura SEC-03).
// - D-72: AuthPolicy descrittiva (`bearer: true` opt-in oppure `custom` hook) — la
//         resolve effettiva del token avviene tramite `gateway.auth` di GatewayConfig.
// - D-73: ConcurrencyPolicy `'latest-only' | 'serial' | 'parallel'` (chiusura PRD §39
//         #6 race condition; default auto-detect: `*.requested` + GET → 'latest-only').
// - D-74: DedupePolicy via `keyFrom` o `key` function (chiusura ROUTE-11).
// - D-75: BackpressurePolicy enum (queue/drop/throttle/debounce/latest-only/coalesce).
//         Eventi `priority: 'critical'` BYPASSANO ogni backpressure (PITFALLS #4).
//
// Vincolo `exactOptionalPropertyTypes: true`: tutti i campi opzionali sono
// `readonly X?: T` (mai `readonly X: T | undefined`).
//
// Threat coverage:
// - T-03-02-04 (DoS — `maxAttempts: Infinity`): il tipo permette qualsiasi `number`,
//   il warning runtime è responsabilità della `RetryStrategy` (plan 03-09).

/**
 * Configurazione della retry policy per una route HTTP (D-69, ROUTE-09).
 *
 * Default (applicato dalla `RetryStrategy` se non override):
 * - `maxAttempts: 3`
 * - `baseDelayMs: 300`
 * - `maxDelayMs: 10000`
 * - `retryOn` undefined → default 5xx + 408 + 429 + network error (NO retry altre 4xx)
 *
 * Backoff formula (full jitter, PITFALLS #5):
 * `min(maxDelayMs, baseDelayMs * 2^attempt) * (0.5 + Math.random() * 0.5)`
 *
 * @example
 * ```ts
 * const retry: RetryPolicyConfig = { maxAttempts: 5, baseDelayMs: 500, maxDelayMs: 30000 }
 * ```
 */
export interface RetryPolicyConfig {
  readonly maxAttempts?: number
  readonly baseDelayMs?: number
  readonly maxDelayMs?: number
  /** Lista esplicita di status code retry-able (override default 5xx + 408/429). */
  readonly retryOn?: ReadonlyArray<number>
}

/**
 * Configurazione della dedupe policy per una route HTTP (D-74, ROUTE-11).
 *
 * Due request con stesso `dedupeKey` in volo collassano in una sola fetch (Promise
 * condiviso). Default fallback se `key`/`keyFrom` non forniti e method=`GET`:
 * `routeId + sortedQueryParams`. Per non-GET, default undefined (NO dedup automatico).
 *
 * - `key`: funzione esplicita che produce la chiave dedupe per evento.
 * - `keyFrom`: shortcut per concatenare il valore di N field canonical del payload.
 *
 * @example
 * ```ts
 * const dedupe: DedupePolicyConfig = { keyFrom: ['location', 'forecast_date'] }
 * ```
 */
export interface DedupePolicyConfig {
  readonly key?: (event: unknown) => string
  readonly keyFrom?: ReadonlyArray<string>
}

/**
 * Concurrency policy per una route HTTP (D-73, ROUTE-08).
 *
 * - `'latest-only'` — nuova request abort la precedente; solo l'ultima `<topic>.loaded`
 *   viene pubblicata. Default per topic `*.requested` + method GET (PITFALLS #2.A).
 * - `'serial'` — request accodate, eseguite una alla volta (FIFO).
 * - `'parallel'` — tutte parallele, nessun coordinamento. Default per metodi non-GET
 *   o senza pattern `*.requested`.
 */
export type ConcurrencyPolicy = 'latest-only' | 'serial' | 'parallel'

/**
 * Backpressure policy per una route HTTP (D-75, ROUTE-10, chiusura PITFALLS #4).
 *
 * Discriminated union sulla strategia. Eventi `priority: 'critical'` BYPASSANO
 * sempre la policy (es. `system.error` di F1).
 *
 * - `queue-bounded` — coda con limite massimo `max` (drop overflow oldest first).
 * - `drop` — droppa silenziosamente le request quando il limite viene raggiunto.
 * - `throttle` — max `perSec` request al secondo (token bucket).
 * - `debounce` — esegue solo dopo `waitMs` di silenzio (consolida burst).
 * - `latest-only` — abort delle pending in favore della più recente.
 * - `merge` / `coalesce` — combina N eventi pending in 1 (semantica route-specific).
 */
export type BackpressurePolicyConfig =
  | { readonly type: 'queue-bounded'; readonly max: number }
  | { readonly type: 'drop' }
  | { readonly type: 'throttle'; readonly perSec: number }
  | { readonly type: 'debounce'; readonly waitMs: number }
  | { readonly type: 'latest-only' }
  | { readonly type: 'merge' }
  | { readonly type: 'coalesce' }

/**
 * Auth policy descrittiva per una route HTTP (D-72, SEC-01).
 *
 * Il descriptor si limita a indicare _se_ la route richiede auth e _come_ injectare gli
 * header. La resolve effettiva del token avviene nella `AuthStrategy` del gateway
 * (`gateway.auth.getToken`).
 *
 * - `bearer: true` → injecta `Authorization: Bearer <token>` usando `gateway.auth.getToken`.
 * - `custom` → hook completo che produce header arbitrari (override del default Bearer).
 */
export interface AuthPolicyConfig {
  readonly bearer?: boolean
  readonly custom?: (req: {
    readonly url: string
    readonly headers: Readonly<Record<string, string>>
  }) => Promise<Readonly<Record<string, string>>>
}

/**
 * Idempotency policy per una route HTTP (D-70, SEC-03).
 *
 * Default per metodi `POST`/`PATCH`/`PUT`/`DELETE`: `{ mode: 'auto', headerName: 'Idempotency-Key' }`.
 *
 * - `mode: 'auto'` — la `IdempotencyStrategy` genera `nanoid()` al first attempt e lo
 *   riusa identico sui retry (chiave: stesso `BrokerEvent.id`).
 * - `mode: 'manual'` — il caller fornisce la chiave (es. via metadata evento).
 * - `mode: false` — disabilita idempotency per route safe-by-design.
 */
export interface IdempotencyPolicyConfig {
  readonly mode: 'auto' | 'manual' | false
  readonly headerName?: string
}

/**
 * Error policy override per una route HTTP (override del default D-69).
 *
 * - `'always'` — retry su qualsiasi errore (anche 4xx tipicamente non retry-abili).
 *   Sconsigliato — può causare retry storm. Solo per casi specifici (es. server beta).
 * - `'never'` — nessun retry, fail-fast.
 * - `'default'` — usa la politica D-69 (5xx + 408 + 429 + network error).
 */
export interface ErrorPolicyConfig {
  readonly retryOn?: 'always' | 'never' | 'default'
}

/**
 * Timeout policy per una route HTTP (default `30000` ms — espresso anche come `number`).
 *
 * Wrapper su `AbortSignal.timeout()` (D-68 / `TimeoutStrategy`).
 */
export interface TimeoutPolicyConfig {
  readonly ms: number
}

/**
 * Container di policy applicabili a una `RouteDefinition` (D-68 Strategy Pattern).
 *
 * Tutti i campi sono opzionali — quando assenti, la `Strategy` di default applica i
 * valori D-69/D-70/D-73 etc. Il caller può sostituire le strategy concrete a livello
 * di `GatewayConfig.defaults` o per route specifica.
 *
 * @example
 * ```ts
 * const policies: RoutePolicies = {
 *   timeout: 5000,
 *   retry: { maxAttempts: 3 },
 *   concurrency: 'latest-only',
 *   dedupe: { keyFrom: ['location', 'forecast_date'] },
 * }
 * ```
 */
export interface RoutePolicies {
  /** Timeout in ms (number shortcut) o `TimeoutPolicyConfig`. Default 30000 ms. */
  readonly timeout?: number | TimeoutPolicyConfig
  /** Retry config oppure `false` per disabilitare retry esplicitamente. */
  readonly retry?: RetryPolicyConfig | false
  /** Dedupe config oppure `false` per disabilitare dedup esplicitamente. */
  readonly dedupe?: DedupePolicyConfig | false
  readonly concurrency?: ConcurrencyPolicy
  readonly backpressure?: BackpressurePolicyConfig
  /** Auth config oppure `boolean` shortcut (`true` = `{ bearer: true }`). */
  readonly auth?: AuthPolicyConfig | boolean
  /** Idempotency config oppure `false` per opt-out esplicito. */
  readonly idempotency?: IdempotencyPolicyConfig | false
  readonly error?: ErrorPolicyConfig
}
