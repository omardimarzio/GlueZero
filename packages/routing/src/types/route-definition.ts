// RouteDefinition — discriminated union dichiarativa delle route F3 (PRD §17,
// REQ ROUTE-01..ROUTE-05).
//
// Riferimento decisioni (03-CONTEXT.md):
// - D-60: discriminator `type: 'local' | 'http' | 'cache' | 'composite'`. Ogni
//         sub-interface estende `RouteDefinitionBase` (id/topic/priority/policies).
// - D-65: route `'local'` consegna sync (pipeline F1 invariata); `'http'`/`'cache'`/
//         `'composite'` async ritornano `Promise<RouteOutcome>`.
// - D-66: campo `priority?: number` opzionale per `multipleRoutesPolicy: 'priority-ordered'`.
// - D-77: AbortSignal opzionale già esposto a livello `subscribe` (F1 plan 04/05); il
//         routing engine lo propaga al gateway in plan 03-13. Nessun campo dedicato qui.
// - D-96/D-97: `RouteHttpDefinition.request.queryMap`/`bodyMap` riusano `OutputMap` di
//         F2; `response.canonical` è un riferimento al `CanonicalSchemaId` di F2.
// - D-98: `request.serializer?` opt-in custom (form-data/multipart/binary). Default JSON.
//
// Vincolo `exactOptionalPropertyTypes: true`: tutti i campi opzionali sono
// `readonly X?: T` (mai `readonly X: T | undefined`).
//
// Threat coverage:
// - T-03-02-01 (Tampering — mutability): tutti i field `readonly`. Il `deepFreeze`
//   runtime al `registerRoute` è responsabilità del plan 03-05 (resolver).
// - T-03-02-02 (Type confusion): `CanonicalSchemaId` branded da F2 importato; gli `id`
//   delle route sono plain string ma sempre validati a runtime in plan 03-05.

import type { CanonicalSchemaId, OutputMap } from '@sembridge/mapper'
import type { RoutePolicies } from './route-policies'

/**
 * Campi comuni a ogni `RouteDefinition` (PRD §17, ROUTE-01).
 *
 * - `id` — identificativo univoco della route (validato runtime al register).
 * - `topic` — pattern di topic matching; supporta wildcard segment-based (`*`)
 *   coerente col trie di F1 D-08 (es. `weather.*.requested`).
 * - `priority` — opzionale, alta priorità vince in `multipleRoutesPolicy:
 *   'priority-ordered'` (D-66).
 * - `policies` — container di policy per timeout/retry/dedupe/etc (D-68).
 */
export interface RouteDefinitionBase {
  readonly id: string
  readonly topic: string
  readonly priority?: number
  readonly policies?: RoutePolicies
}

/**
 * Route locale (PRD §17.3, ROUTE-02, D-60).
 *
 * Consegna l'evento ai subscriber locali via la pipeline F1 invariata. È l'implicit
 * default per topic senza route registrata (a meno di `requiresRoute: true` sul
 * canonical schema — vedi D-67/D-95).
 */
export interface RouteLocalDefinition extends RouteDefinitionBase {
  readonly type: 'local'
}

/**
 * Spec del request HTTP per `RouteHttpDefinition` (PRD §17.4, D-96/D-97/D-98).
 *
 * - `queryMap`/`bodyMap` — `OutputMap` (F2) canonico → server flat. Riuso del
 *   `MapperEngine` (D-96).
 * - `serializer` — hook opt-in per body custom (form-data/multipart). Default JSON
 *   con `Content-Type: application/json` (D-98).
 */
export interface RouteHttpRequestSpec {
  readonly method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  readonly url: string
  readonly queryMap?: OutputMap
  readonly bodyMap?: OutputMap
  readonly serializer?: (canonical: unknown) => BodyInit
}

/**
 * Spec del response HTTP per `RouteHttpDefinition` (PRD §17.4, §21.2.5, D-97).
 *
 * `canonical` è il riferimento allo schema canonical registrato in F2 — il gateway
 * applica `mapper.mapToCanonical(serverResponse, canonical)` e poi step 6 di F2
 * (`canonicalRegistry.validateCanonical`).
 */
export interface RouteHttpResponseSpec {
  /** Riferimento al CanonicalSchema F2. Il branded `CanonicalSchemaId` è preferito,
   * ma `string` è ammesso per ergonomia (cast runtime). */
  readonly canonical: CanonicalSchemaId | string
}

/**
 * Topic specifici di publish per success/error di `RouteHttpDefinition`.
 *
 * Default convention (PRD §22.3, D-80): se omessi, il gateway usa
 * `<topic-prefix>.loaded` / `<topic-prefix>.failed`.
 */
export interface RouteHttpPublishesSpec {
  readonly success?: string
  readonly error?: string
}

/**
 * Route HTTP (PRD §17.4, ROUTE-03, D-60, D-96/D-97/D-98).
 *
 * Il gateway applica il pipeline standard:
 * 1. Build request via `request.queryMap`/`bodyMap` (canonico → server, riuso F2).
 * 2. Fetch via `HttpGateway` (auth + retry + timeout + dedupe + idempotency).
 * 3. Parse response e mapping server → canonico via `response.canonical`.
 * 4. Publish `publishes.success` o `publishes.error` (default `<topic>.loaded`/`.failed`).
 *
 * @example
 * ```ts
 * const weatherRoute: RouteHttpDefinition = {
 *   id: 'weather-http',
 *   type: 'http',
 *   topic: 'weather.requested',
 *   request: {
 *     method: 'GET',
 *     url: '/api/weather',
 *     queryMap: { city: { source: 'location' }, date: { source: 'forecast_date' } }
 *   },
 *   response: { canonical: 'weather' },
 *   publishes: { success: 'weather.loaded', error: 'weather.failed' },
 *   policies: { timeout: 5000, retry: { maxAttempts: 3 }, concurrency: 'latest-only' }
 * }
 * ```
 */
export interface RouteHttpDefinition extends RouteDefinitionBase {
  readonly type: 'http'
  readonly request: RouteHttpRequestSpec
  readonly response: RouteHttpResponseSpec
  readonly publishes?: RouteHttpPublishesSpec
}

/**
 * Strategia di cache per `RouteCacheDefinition` (PRD §17.6, §20.2, ROUTE-04).
 *
 * - `'cache-first'` — prova cache; se miss, fetch e popola.
 * - `'network-first'` — prova fetch; se fail, fallback alla cache.
 * - `'cache-then-network'` — restituisce cache subito + aggiorna in background.
 */
export type RouteCacheStrategy = 'cache-first' | 'network-first' | 'cache-then-network'

/**
 * Route cache (PRD §17.6, ROUTE-04, D-60).
 *
 * **F3 type-only — adapter implementativo a F6.** Il `route-handlers/cache-handler.ts`
 * F3 stub ritorna `RouteOutcome.error code='cache.not-implemented'`. F6 sostituirà con
 * l'adapter cache (in-memory + IndexedDB).
 */
export interface RouteCacheDefinition extends RouteDefinitionBase {
  readonly type: 'cache'
  readonly strategy: RouteCacheStrategy
  /** Funzione opzionale per derivare la chiave cache da un evento. */
  readonly key?: (event: unknown) => string
  /** Time-to-live in ms (default illimitato a livello tipo; F6 applicherà default). */
  readonly ttlMs?: number
}

/**
 * Step di un workflow `RouteCompositeDefinition` (PRD §17.7).
 *
 * Sequenza dichiarativa: check-cache → http (server fetch) → publish loaded/failed.
 * Lo `step.route` è opzionale — quando presente, fa riferimento all'`id` di una
 * `RouteDefinition` registrata separatamente.
 */
export interface RouteCompositeStep {
  readonly type: 'cache' | 'http' | 'publish'
  readonly route?: string
}

/**
 * Route composite (PRD §17.7, ROUTE-05, D-60).
 *
 * **F3 workflow type-only — l'adapter cache è F6.** Il `composite-handler.ts` F3
 * orchestra gli step in sequenza ma il sotto-step `cache` restituisce `cache.not-implemented`
 * fino a F6.
 */
export interface RouteCompositeDefinition extends RouteDefinitionBase {
  readonly type: 'composite'
  readonly steps: readonly RouteCompositeStep[]
}

/**
 * `RouteDefinition` discriminata via `type` (PRD §17.2, REQ ROUTE-01..05, D-60).
 *
 * Le 4 varianti coprono il routing engine F3 completo. Worker route (F5) verrà
 * aggiunto via TS declaration merging senza breaking change al type union.
 *
 * @example
 * ```ts
 * const route: RouteDefinition = { id: 'r-1', type: 'local', topic: 'weather.loaded' }
 * ```
 */
export type RouteDefinition =
  | RouteLocalDefinition
  | RouteHttpDefinition
  | RouteCacheDefinition
  | RouteCompositeDefinition
