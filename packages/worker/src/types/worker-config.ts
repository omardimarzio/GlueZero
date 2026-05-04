// types/worker-config.ts — shape `BrokerConfig.workers` aggiunta via TS declaration
// merging in `augment.ts` (D-122).
//
// Riferimento decisioni (05-CONTEXT.md):
// - D-122: sezione `workers` di `BrokerConfig` letta dal `WorkerBroker` costruttore
//   (plan 05-06) per istanziare `WorkerRegistry` + `WorkerPool` map e configurare
//   defaults globali. Pattern simmetrico a `BrokerConfig.realtime` (F4) +
//   `BrokerConfig.gateway` (F3).
// - D-139: `assertSerializable` mode default `'dev'` (auto NODE_ENV !== 'production').
//   `'always'` runtime cost in prod (debug only); `'off'` disabilita.
// - D-137: default `progressThrottleMs` globale 100ms — override-abile per-route via
//   `RouteWorkerDefinition.progressThrottleMs`.
// - D-145: default timeout globale 30000ms — override-abile per-route via
//   `RouteWorkerDefinition.policies.timeout`.
//
// Pattern role-match con `packages/gateway/src/sse-ws/types/realtime-config.ts`:
// root config con sezione `defaults.*` opzionale e settings runtime.

/**
 * Modalità del check `assertSerializable` (D-139).
 *
 * - `'always'` — esegue il deep-walk su ogni `postMessage` (cost runtime; debug
 *   prod only).
 * - `'dev'` — auto-detect via `NODE_ENV !== 'production'` (default V1 — esegue
 *   solo in dev/test).
 * - `'off'` — disabilita completamente (no overhead; producer GIA validato in
 *   build pipeline).
 */
export type AssertSerializableMode = 'always' | 'dev' | 'off'

/**
 * Configurazione worker — root config dichiarata in `BrokerConfig.workers`
 * (D-122).
 *
 * Aggiunta a `BrokerConfig` via TS declaration merging in `augment.ts`. Tutti
 * i field sono opzionali — l'absence usa i default lockati nel CONTEXT (D-139,
 * D-137, D-145).
 *
 * @example
 * ```ts
 * const config: BrokerConfig = {
 *   workers: {
 *     assertSerializable: 'dev',           // D-139 default
 *     defaultProgressThrottleMs: 100,      // D-137 default
 *     defaultTimeoutMs: 30_000,            // D-145 default
 *   },
 * }
 * ```
 */
export interface WorkerConfig {
  /**
   * Mode `assertSerializable` (D-139). Default `'dev'` (auto-detect via
   * `NODE_ENV !== 'production'`).
   */
  readonly assertSerializable?: AssertSerializableMode
  /**
   * Override default `progressThrottleMs` globale (D-137). Default 100ms.
   * Override-abile per-route via `RouteWorkerDefinition.progressThrottleMs`.
   */
  readonly defaultProgressThrottleMs?: number
  /**
   * Override default timeout globale (D-145). Default 30000ms (30 secondi).
   * Override-abile per-route via `RouteWorkerDefinition.policies.timeout`.
   */
  readonly defaultTimeoutMs?: number
}
