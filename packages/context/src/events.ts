/**
 * 8 standard topics PRD §18.6 (MF-CTX-03, D-V2-F10-13).
 *
 * **Cardinalità events:**
 * - 1 aggregator catch-all (`context.changed`) — SEMPRE pubblicato su ogni mutation con
 *   `changedKeys.length > 0`.
 * - 7 topic-specific per chiavi `user`/`tenantId`/`locale`/`permissions`/`featureFlags`/
 *   `theme`/`currentRoute` — pubblicati SOLO se la rispettiva chiave appare in `changedKeys`.
 * - 4 chiavi `timezone`/`direction`/`environment`/`metadata` NON hanno topic dedicato —
 *   emettono SOLO aggregator.
 *
 * **Sync flush ordering (D-V2-F10-14):** coerente con F1 `broker.publish` sync FIFO (v1-bc-replay #1).
 * NO microtask batching, NO debouncing — ogni `setRuntimeContext` pubblica immediatamente.
 *
 * @see PRD §18.6 (events standard topics elenco esplicito)
 * @see D-V2-F10-13 (events fire pattern 1 + N sync flush)
 * @see D-V2-F10-14 (sync flush no batching)
 * @packageDocumentation
 */
import type { Broker } from '@gluezero/core'
import type { RuntimeContext } from './types/runtime-context'

/**
 * Tupla di 8 standard topics PRD §18.6 `as const` per type narrowing.
 *
 * Ordering: aggregator first, poi 7 specific in ordine PRD §18.6.
 *
 * @see ContextTopic
 */
export const CONTEXT_TOPICS = [
  'context.changed',
  'context.user.changed',
  'context.tenant.changed',
  'context.locale.changed',
  'context.permissions.changed',
  'context.featureFlags.changed',
  'context.theme.changed',
  'context.route.changed',
] as const

/**
 * Union type derivato da `CONTEXT_TOPICS` — narrowed string literal union per type-safety.
 */
export type ContextTopic = (typeof CONTEXT_TOPICS)[number]

/**
 * Mapping chiave `RuntimeContext` → topic-specific.
 *
 * - 7 chiavi mappate (user/tenantId/locale/permissions/featureFlags/theme/currentRoute).
 * - 4 chiavi `undefined` (timezone/direction/environment/metadata) — non hanno topic
 *   dedicato, emettono SOLO aggregator `context.changed`.
 *
 * `Readonly<Record<string, ContextTopic | undefined>>` — pattern analog F8
 * `MF_LIFECYCLE_TOPIC_FOR_STATE` (`packages/microfrontends/src/topics.ts`).
 */
export const CONTEXT_TOPIC_FOR_KEY: Readonly<Record<string, ContextTopic | undefined>> = {
  user: 'context.user.changed',
  tenantId: 'context.tenant.changed',
  locale: 'context.locale.changed',
  permissions: 'context.permissions.changed',
  featureFlags: 'context.featureFlags.changed',
  theme: 'context.theme.changed',
  currentRoute: 'context.route.changed',
  // timezone, direction, environment, metadata → undefined (solo aggregator)
} as const

/**
 * Payload event uniforme PRD §18.6 (MF-CTX-03).
 *
 * Shape identico per tutti i topics — aggregator e specific. Consumer può discriminare
 * via `changedKeys` (aggregator ha tutte le chiavi changed; specific ha SOLO la chiave
 * del topic).
 */
export interface ContextChangedPayload {
  readonly previous: Readonly<RuntimeContext>
  readonly current: Readonly<RuntimeContext>
  readonly changedKeys: ReadonlyArray<keyof RuntimeContext>
}

/**
 * Fire events 1 aggregator + N specific sync flush (D-V2-F10-13/14).
 *
 * **Pattern:**
 * - SEMPRE publica `context.changed` aggregator catch-all con `changedKeys` completo.
 * - Per ogni chiave in `changedKeys` con topic specifico in `CONTEXT_TOPIC_FOR_KEY`:
 *   publica `context.X.changed` con `changedKeys: [key]` (focused payload).
 * - Sync FIFO ordering coerente F1 `broker.publish` v1-bc-replay #1.
 *
 * **Caller responsibility:** garantire `changedKeys.length > 0` PRIMA di chiamare
 * `fireContextEvents` — questa funzione NON gestisce il caso no-op (l'aggregator
 * verrebbe comunque pubblicato).
 *
 * @param broker Broker reference (passato da `runtime-context.ts ensureBroker`).
 * @param previous State snapshot pre-mutation.
 * @param current State snapshot post-mutation.
 * @param changedKeys Array di chiavi changed (Object.is top-level diff).
 *
 * @example
 * ```ts
 * fireContextEvents(broker, previous, current, ['tenantId', 'user'])
 * // Pubblica:
 * // 1. context.changed con changedKeys: ['tenantId', 'user']
 * // 2. context.tenant.changed con changedKeys: ['tenantId']
 * // 3. context.user.changed con changedKeys: ['user']
 * ```
 *
 * @see MF-CTX-03, D-V2-F10-13/14
 */
export function fireContextEvents(
  broker: Broker,
  previous: Readonly<RuntimeContext>,
  current: Readonly<RuntimeContext>,
  changedKeys: ReadonlyArray<keyof RuntimeContext>,
): void {
  // (1) Aggregator catch-all SEMPRE
  broker.publish<ContextChangedPayload>('context.changed', {
    previous,
    current,
    changedKeys,
  })
  // (N) Topic-specific per chiave con topic dedicato
  for (const key of changedKeys) {
    const topic = CONTEXT_TOPIC_FOR_KEY[key as string]
    if (topic !== undefined) {
      broker.publish<ContextChangedPayload>(topic, {
        previous,
        current,
        changedKeys: [key],
      })
    }
  }
}
