/**
 * F13 topics literal `as const` per `@gluezero/isolation` (D-V2-F13-12).
 *
 * Cardinality W1: 1 RIUSO governance F8 + 6 NEW locali = 7 topics totali.
 *
 * ## RIUSO governance F8 (Pitfall 7 ACK)
 *
 * `microfrontend.isolation.warning` GIA in F8 `MF_GOVERNANCE_TOPICS[3]` — F13
 * RIUSA via import diretto (NO duplica literal). Verificato indice contro
 * `packages/microfrontends/src/topics.ts:67-73`.
 *
 * ## NEW locali F13 (6 topics)
 *
 * Topic-naming pattern coerente F8 lifecycle:
 * - `microfrontend.gateway.request` — Emit pre-request da `GatewayFacade.request` (W2 P03)
 * - `microfrontend.gateway.error` — Emit on gateway failure da `GatewayFacade`
 * - `microfrontend.worker.task.started` — Emit pre-run da `WorkerFacade.run` (W2 P03)
 * - `microfrontend.worker.task.completed` — Emit on worker resolve
 * - `microfrontend.worker.task.error` — Emit on worker reject
 * - `microfrontend.storage.changed` — Emit on `StorageFacade.setItem|removeItem|clear`
 *
 * @see prd_2.0.0.md §31.3 — Governance topics extension
 * @see D-V2-F13-12 — Topic naming F13 locali
 */
import { MF_GOVERNANCE_TOPICS } from '@gluezero/microfrontends'

/**
 * Topic riusato da F8 governance (`MF_GOVERNANCE_TOPICS[3]`).
 *
 * NON un literal locale — è il **valore** importato dal F8 array constant. Tree-shake
 * preservato (literal type narrowing IDE autocomplete).
 */
export const ISOLATION_WARNING_TOPIC: 'microfrontend.isolation.warning' =
  MF_GOVERNANCE_TOPICS[3]

/**
 * 6 topics literal locali F13 (D-V2-F13-12).
 *
 * NON sovrapposti con F8 (verifica via grep `packages/microfrontends/src/topics.ts` —
 * F8 governance NON include gateway/worker/storage).
 */
export const MF_ISOLATION_TOPICS = [
  'microfrontend.gateway.request',
  'microfrontend.gateway.error',
  'microfrontend.worker.task.started',
  'microfrontend.worker.task.completed',
  'microfrontend.worker.task.error',
  'microfrontend.storage.changed',
] as const

/**
 * Union type derivato — IDE autocomplete + narrowing per consumer subscribe.
 *
 * Include il topic riusato F8 + i 6 locali = 7 valori.
 */
export type IsolationTopic =
  | (typeof MF_ISOLATION_TOPICS)[number]
  | typeof ISOLATION_WARNING_TOPIC
