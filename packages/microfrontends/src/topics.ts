/**
 * Standard topics per `@gluezero/microfrontends` (D-V2-F8-12).
 *
 * 3 `as const` arrays + 4 union types derivati = IDE autocomplete + type narrowing.
 * Tree-shakable (literal-types zero runtime cost).
 *
 * Cardinality lockata: 17 + 7 + 5 = 29 topics. NON ampliare/ridurre senza re-discuss.
 *
 * @see PRD §31 + RESEARCH §5 + PATTERNS §30 + D-V2-F8-12
 */

/**
 * 17 lifecycle topics standard (PRD §31.1, MF-EVT-01).
 *
 * Mapping state → topic:
 * - registered, unregistered (1+1)
 * - resolving, loading, loaded (3)
 * - bootstrapping, bootstrapped (2)
 * - mounting, mounted (2)
 * - updating, updated (2)
 * - unmounting, unmounted (2)
 * - destroying, destroyed (2)
 * - failed, reloaded (2)
 * Totale: 17
 */
export const MF_LIFECYCLE_TOPICS = [
  'microfrontend.registered',
  'microfrontend.unregistered',
  'microfrontend.resolving',
  'microfrontend.loading',
  'microfrontend.loaded',
  'microfrontend.bootstrapping',
  'microfrontend.bootstrapped',
  'microfrontend.mounting',
  'microfrontend.mounted',
  'microfrontend.updating',
  'microfrontend.updated',
  'microfrontend.unmounting',
  'microfrontend.unmounted',
  'microfrontend.destroying',
  'microfrontend.destroyed',
  'microfrontend.failed',
  'microfrontend.reloaded',
] as const

/**
 * 7 error topics standard (PRD §31.2, MF-EVT-02).
 *
 * Emessi in addition al lifecycle `microfrontend.failed` per discriminare la phase.
 */
export const MF_ERROR_TOPICS = [
  'microfrontend.load.failed',
  'microfrontend.bootstrap.failed',
  'microfrontend.mount.failed',
  'microfrontend.runtime.failed',
  'microfrontend.update.failed',
  'microfrontend.unmount.failed',
  'microfrontend.destroy.failed',
] as const

/**
 * 5 governance topics standard (PRD §31.3, MF-EVT-03).
 *
 * Emessi da fasi F11 (permissions, capabilities), F12 (compatibility), F13 (isolation),
 * F14 (fallbacks). F8 fornisce SOLO le constants — emission effettiva nelle fasi target.
 */
export const MF_GOVERNANCE_TOPICS = [
  'microfrontend.capability.missing',
  'microfrontend.compatibility.failed',
  'microfrontend.permission.denied',
  'microfrontend.isolation.warning',
  'microfrontend.fallback.rendered',
] as const

// ===== Union types derivati (D-V2-F8-12) =====

/** Type union dei 17 lifecycle topics — IDE autocomplete + narrowing. */
export type MfLifecycleTopic = (typeof MF_LIFECYCLE_TOPICS)[number]

/** Type union dei 7 error topics. */
export type MfErrorTopic = (typeof MF_ERROR_TOPICS)[number]

/** Type union dei 5 governance topics. */
export type MfGovernanceTopic = (typeof MF_GOVERNANCE_TOPICS)[number]

/** Type union completa dei 29 standard topics. */
export type MfStandardTopic = MfLifecycleTopic | MfErrorTopic | MfGovernanceTopic

// ===== Helpers =====

/**
 * Mapping `MicroFrontendState` → topic lifecycle corrispondente.
 *
 * Usato da `registry.ts` per pubblicare lifecycle events su transition.
 * NOTE: NON tutti gli stati hanno topic 1:1 — `failed` ha topic separato +
 * error topic phase-specific (vedi `MF_ERROR_TOPIC_FOR_PHASE`).
 *
 * @example Lookup topic per state corrente
 * ```ts
 * const state: MicroFrontendState = 'mounted'
 * const topic = MF_LIFECYCLE_TOPIC_FOR_STATE[state]
 * // → 'microfrontend.mounted'
 * if (topic) broker.publish(topic, payload)
 * ```
 *
 * @see MF_LIFECYCLE_TOPICS — array completo
 * @see MF_ERROR_TOPIC_FOR_PHASE — mapping phase → error topic
 */
export const MF_LIFECYCLE_TOPIC_FOR_STATE: Readonly<Record<string, MfLifecycleTopic | undefined>> =
  {
    registered: 'microfrontend.registered',
    resolving: 'microfrontend.resolving',
    loading: 'microfrontend.loading',
    loaded: 'microfrontend.loaded',
    bootstrapping: 'microfrontend.bootstrapping',
    bootstrapped: 'microfrontend.bootstrapped',
    mounting: 'microfrontend.mounting',
    mounted: 'microfrontend.mounted',
    updating: 'microfrontend.updating',
    unmounting: 'microfrontend.unmounting',
    unmounted: 'microfrontend.unmounted',
    destroying: 'microfrontend.destroying',
    destroyed: 'microfrontend.destroyed',
    failed: 'microfrontend.failed',
  } as const

/**
 * Mapping `MicroFrontendFailurePhase` → error topic corrispondente.
 *
 * Usato da `registry.ts` per pubblicare error event phase-specific in addition al
 * `microfrontend.failed` lifecycle event.
 *
 * @example Lookup error topic da failure phase
 * ```ts
 * const phase: MicroFrontendFailurePhase = 'bootstrap'
 * const errorTopic = MF_ERROR_TOPIC_FOR_PHASE[phase]
 * // → 'microfrontend.bootstrap.failed'
 * broker.publish(errorTopic, errorPayload)
 * ```
 *
 * @see MF_ERROR_TOPICS — array dei 7 error topic literals
 */
export const MF_ERROR_TOPIC_FOR_PHASE: Readonly<Record<string, MfErrorTopic>> = {
  load: 'microfrontend.load.failed',
  bootstrap: 'microfrontend.bootstrap.failed',
  mount: 'microfrontend.mount.failed',
  runtime: 'microfrontend.runtime.failed',
  update: 'microfrontend.update.failed',
  unmount: 'microfrontend.unmount.failed',
  destroy: 'microfrontend.destroy.failed',
} as const
