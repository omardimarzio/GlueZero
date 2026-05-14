/**
 * F14 topics literal `as const` per `@gluezero/fallbacks` (D-V2-F14-03).
 *
 * Cardinality W1: 1 RIUSO governance F8 (`microfrontend.fallback.rendered`) +
 * 3 NEW locali (`microfrontend.recovered` + `microfrontend.circuit.opened` +
 * `microfrontend.circuit.closed`) + 1 default event topic = 5 simboli totali.
 *
 * Coverage REQ-ID skeleton: MF-FALLBACK-03 (3 nuovi topics CircuitBreaker
 * observability + retry recovery + reuse F8 governance fallback rendered).
 *
 * ## RIUSO governance F8 (Pitfall 7 ACK)
 *
 * `microfrontend.fallback.rendered` GIA in F8 `MF_GOVERNANCE_TOPICS[4]` — F14
 * RIUSA via import diretto (NO duplica literal in `topics.ts` locale).
 * Verificato indice contro `packages/microfrontends/src/topics.ts:72`.
 *
 * ## NEW locali F14 (3 topics)
 *
 * Topic-naming pattern coerente F8 lifecycle:
 * - `microfrontend.recovered` — Emit post retry success + reset counter (W2 P04 orchestrator).
 * - `microfrontend.circuit.opened` — Emit su `failureThreshold` raggiunto (W2 P03 circuit).
 * - `microfrontend.circuit.closed` — Emit post `resetAfterMs` o success post half-open.
 *
 * @see prd_2.0.0.md §29.4 — Governance topics F14
 * @see D-V2-F14-03 — Topics literal F14 locali
 * @see D-V2-F14-02 — F8 governance topic riuso
 */
import { MF_GOVERNANCE_TOPICS } from '@gluezero/microfrontends'

/**
 * 3 topics literal locali F14 (D-V2-F14-03).
 *
 * NON sovrapposti con F8 (verifica via grep `packages/microfrontends/src/topics.ts`
 * — F8 governance NON include `recovered` o `circuit.*`).
 */
export const MF_FALLBACK_TOPICS = [
  'microfrontend.recovered',
  'microfrontend.circuit.opened',
  'microfrontend.circuit.closed',
] as const

/**
 * Topic default per `FallbackDefinition.type='event'` quando `topic` omesso.
 *
 * Application-wide non MF-prefixed: i consumer che subscribono devono filtrare
 * per `event.source.id` se vogliono targeting per MF.
 *
 * @see D-V2-F14-03
 */
export const FALLBACK_EVENT_DEFAULT_TOPIC = 'microfrontend.fallback.event' as const

/**
 * Riuso topic governance F8 (Pitfall 7 ACK — NO duplica literal).
 *
 * `MF_GOVERNANCE_TOPICS[4]` === `'microfrontend.fallback.rendered'` (F8
 * `packages/microfrontends/src/topics.ts:72` already declared). F14 emette dopo
 * render success o fallback skip per observability cross-fase.
 *
 * NON un literal locale — è il **valore** importato dal F8 array constant.
 * Tree-shake preservato (literal type narrowing IDE autocomplete).
 *
 * @see D-V2-F14-02 — F8 governance topic riuso
 */
export const FALLBACK_RENDERED_TOPIC: 'microfrontend.fallback.rendered' =
  MF_GOVERNANCE_TOPICS[4]

/**
 * Type literal union derivato — IDE autocomplete + narrowing per consumer subscribe.
 *
 * Include i 3 locali + topic governance F8 riuso + default event = 5 valori.
 */
export type MfFallbackTopic =
  | (typeof MF_FALLBACK_TOPICS)[number]
  | typeof FALLBACK_RENDERED_TOPIC
  | typeof FALLBACK_EVENT_DEFAULT_TOPIC
