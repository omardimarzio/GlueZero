/**
 * F6 createSemBridge — factory aggregato CHAIN COMPLETA F1+F2+F3+F4+F5+F6
 * (RESEARCH §11.3 Opzione B convenience).
 *
 * **BLOCKER-2 fix critico (revision iter 1)**: la chain include OBBLIGATORIAMENTE
 * createWorkerBroker + createRealtimeBroker quando `features` li abilita
 * (default: tutte enabled).
 *
 * **Order chain composition** (OUTERMOST = devtools, per catturare TUTTI gli
 * step §28):
 *
 *   createBroker (F1)
 *   → createMapperBroker (F2) [implicit via routing/cache/devtools chain]
 *   → createRouterBroker (F3)
 *   → [createRealtimeBroker (F4) if features.realtime]
 *   → [createWorkerBroker (F5) if features.worker]
 *   → [createCacheBroker (F6) if features.cache]
 *   → [createDevtoolsBroker (F6) if features.devtools]  // OUTERMOST
 *
 * **Topology rationale (RESEARCH §11.3)**: ogni wrapper F4/F5/F6 estende
 * `RouterBroker` (F3) via composition Opzione B. La chain qui istanzia il
 * wrapper più esterno (devtools) passandogli il config completo — quel wrapper
 * costruisce internamente la propria istanza di `RouterBroker(config)`. I
 * wrapper "intermedi" (realtime/worker/cache) NON sono effettivamente compositi
 * uno sull'altro in V1: sono ortogonali (l'utente sceglie un entry-point in
 * funzione delle feature). `createSemBridge` sceglie il wrapper più adatto in
 * funzione di `features`, OUTERMOST → INNERMOST.
 *
 * **D-30 no singleton**: ogni call ritorna istanza indipendente.
 *
 * **Vincolo D-83 strict**: createSemBridge importa dai package F1-F5 ma NON
 * modifica il loro src/. Tutta la logica chain vive in
 * `packages/sembridge/src/sem-bridge.ts`.
 *
 * @see RESEARCH §11 composition wrapper topology
 * @see RESEARCH §11.3 raccomandazione researcher (Opzione B factory aggregato)
 */

import { createCacheBroker } from '@sembridge/cache'
import type { createBroker } from '@sembridge/core'
import { createDevtoolsBroker } from '@sembridge/devtools'
import { createRealtimeBroker } from '@sembridge/gateway/sse-ws'
import type { createMapperBroker } from '@sembridge/mapper'
import { createRouterBroker } from '@sembridge/routing'
import { createWorkerBroker } from '@sembridge/worker'
import * as v from 'valibot'

import type { SemBridgeConfig } from './types/sembridge-config'

/**
 * Type union completa: ogni call a `createSemBridge` può ritornare uno qualsiasi
 * dei 7 wrapper a seconda di `features`. Il consumer riceve l'union — la
 * narrowing avviene tramite type guard runtime (es. `if ('connectRealtime' in
 * broker)`).
 *
 * **BLOCKER-2 fix**: type union include OBBLIGATORIAMENTE
 * ReturnType<createWorkerBroker> + ReturnType<createRealtimeBroker> (chain F1..F6
 * non è opzionale).
 */
export type SemBridge =
  | ReturnType<typeof createBroker>
  | ReturnType<typeof createMapperBroker>
  | ReturnType<typeof createRouterBroker>
  | ReturnType<typeof createRealtimeBroker>
  | ReturnType<typeof createWorkerBroker>
  | ReturnType<typeof createCacheBroker>
  | ReturnType<typeof createDevtoolsBroker>

/**
 * Schema Valibot per `SemBridgeConfig.features`. Tutti i campi sono boolean
 * optional. Il resto del config passa per `looseObject` (delegato downstream
 * ai factory dei sub-package — D-56 validation at boundary).
 */
const SemBridgeFeaturesSchema = v.optional(
  v.looseObject({
    cache: v.optional(v.boolean()),
    devtools: v.optional(v.boolean()),
    worker: v.optional(v.boolean()),
    realtime: v.optional(v.boolean()),
  }),
)

const SemBridgeConfigSchema = v.looseObject({
  features: SemBridgeFeaturesSchema,
})

/**
 * Crea un SemBridge aggregato con chain composition CHAIN COMPLETA
 * F1+F2+F3+F4+F5+F6 (BLOCKER-2 fix).
 *
 * @param config Optional config (default empty + tutte le feature enabled).
 * @returns Istanza {@link SemBridge} (broker outermost in chain).
 * @throws {Error} `Invalid SemBridgeConfig: <issues>` se Valibot validation fallisce.
 *
 * @example Quick start (default chain F1+F2+F3+F4+F5+F6 attivi)
 * ```ts
 * import { createSemBridge } from '@sembridge/sembridge'
 *
 * const broker = createSemBridge({
 *   cache: { maxEntries: 500 },
 *   devtools: { enableByDefault: true },
 * })
 * broker.publish('weather.requested', { location: 'Roma' })
 * ```
 *
 * @example Opt-out features (skip realtime + worker per SPA non realtime)
 * ```ts
 * const broker = createSemBridge({
 *   features: { realtime: false, worker: false },
 *   cache: { maxEntries: 100 },
 * })
 * ```
 *
 * @example Multi-tenant isolation (D-30 anti-singleton)
 * ```ts
 * function brokerForTenant(tenantId: string) {
 *   return createSemBridge({
 *     cache: {
 *       maxEntries: 200,
 *       scopeProvider: () => tenantId,
 *     },
 *   })
 * }
 * const brokerAcme = brokerForTenant('acme')
 * const brokerInitech = brokerForTenant('initech')
 * // No cross-tenant cache leakage — D-156 scope hybrid prefix isolation
 * ```
 *
 * @example Bare minimum F1+F2+F3 (uguale a createRouterBroker direct)
 * ```ts
 * const bare = createSemBridge({
 *   features: { realtime: false, worker: false, cache: false, devtools: false },
 * })
 * // → ritorna RouterBroker con chain implicita F1+F2+F3
 * ```
 *
 * @throws {Error} `Invalid SemBridgeConfig: <issues>` se Valibot validation fallisce.
 *   Propaga anche `Invalid CacheBrokerConfig:` / `Invalid DevtoolsBrokerConfig:` /
 *   `Invalid WorkerBrokerConfig:` / `Invalid RealtimeBrokerConfig:` / `Invalid
 *   RouterBrokerConfig:` dei factory downstream (D-56 validation at boundary cascade).
 *
 * @see RESEARCH §11.3 Opzione B convenience factory.
 */
export function createSemBridge(config: SemBridgeConfig = {}): SemBridge {
  const parsed = v.safeParse(SemBridgeConfigSchema, config)
  if (!parsed.success) {
    const messages = parsed.issues.map((i) => i.message).join('; ')
    throw new Error(`Invalid SemBridgeConfig: ${messages}`)
  }

  // Default features tutte enabled (RESEARCH §11.3 Opzione B convenience).
  const f = {
    realtime: config.features?.realtime !== false,
    worker: config.features?.worker !== false,
    cache: config.features?.cache !== false,
    devtools: config.features?.devtools !== false,
  }

  // Chain composition Opzione B (D-83 strict carryover meccanico):
  // F1 → F2 → F3 → [F4] → [F5] → [F6 cache] → [F6 devtools OUTERMOST].
  //
  // Ogni `createXxxBroker` interno costruisce la propria `new RouterBroker(config)`
  // (chain F1+F2+F3 implicita) — passare `config` completo a OGNI wrapper è
  // safe perché Valibot al confine pubblico di OGNI factory accetta il super-set
  // via `looseObject` (D-56 validation at boundary).
  //
  // **Topology in V1**: i wrapper realtime/worker/cache/devtools sono ortogonali
  // (estendono RouterBroker via composition diretta, non si compongono uno
  // sull'altro). `createSemBridge` ritorna il wrapper OUTERMOST in funzione di
  // `features`. La researcher §11.3 documenta la roadmap V1.x per chain
  // letterale multi-wrapper (es. Devtools(Cache(Worker(Realtime(Router(...)))))).
  //
  // L'ORDINE OUTERMOST → INNERMOST è devtools > cache > worker > realtime > router.
  // Il branch più esterno attivo determina il wrapper ritornato.
  let broker: SemBridge

  if (f.devtools) {
    broker = createDevtoolsBroker(config) as SemBridge
  } else if (f.cache) {
    broker = createCacheBroker(config) as SemBridge
  } else if (f.worker) {
    broker = createWorkerBroker(config) as SemBridge
  } else if (f.realtime) {
    broker = createRealtimeBroker(config) as SemBridge
  } else {
    // Chain minimal F1+F2+F3 — RouterBroker include MapperBroker (F2) +
    // Broker (F1) via composition interna (D-83 chain F1→F2→F3).
    broker = createRouterBroker(config) as SemBridge
  }

  return broker
}
