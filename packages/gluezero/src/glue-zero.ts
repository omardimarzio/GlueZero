/**
 * F6 createGlueZero — factory aggregato CHAIN COMPLETA F1+F2+F3+F4+F5+F6
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
 * funzione delle feature). `createGlueZero` sceglie il wrapper più adatto in
 * funzione di `features`, OUTERMOST → INNERMOST.
 *
 * **D-30 no singleton**: ogni call ritorna istanza indipendente.
 *
 * **Vincolo D-83 strict**: createGlueZero importa dai package F1-F5 ma NON
 * modifica il loro src/. Tutta la logica chain vive in
 * `packages/gluezero/src/glue-zero.ts`.
 *
 * @see RESEARCH §11 composition wrapper topology
 * @see RESEARCH §11.3 raccomandazione researcher (Opzione B factory aggregato)
 */

import { createCacheBroker } from '@gluezero/cache'
import type { createBroker } from '@gluezero/core'
import { createDevtoolsBroker } from '@gluezero/devtools'
import { createRealtimeBroker } from '@gluezero/gateway/sse-ws'
import type { createMapperBroker } from '@gluezero/mapper'
import { createRouterBroker } from '@gluezero/routing'
import { createWorkerBroker } from '@gluezero/worker'
import * as v from 'valibot'

// v1.1.0 ext F7 (D-F7-07): type-only import — peer optional `@gluezero/theme`.
// Zero runtime dep: il consumer costruisce il theme tramite
// `createTheme()` da `@gluezero/theme/factory` e lo passa in input. Tree-shake
// safe: se il consumer NON usa `theme`, nulla del package theme entra nel bundle.
import type { Theme } from '@gluezero/theme/factory'

import type { GlueZeroConfig } from './types/gluezero-config'

/**
 * v1.1.0 ext F7 (D-F7-07): augmentation passthrough applicata al return value
 * di `createGlueZero` — il broker ritornato espone un field `.theme` (`Theme |
 * null`) addizionale, indipendente dalla chain composition F1-F6.
 *
 * Implementazione runtime: `Object.defineProperty(broker, 'theme', { value })`
 * (vedi `createGlueZero` body). La presenza del field NON altera il behavior
 * della chain (theme è standalone — D-F7-01 Opzione B).
 */
export interface GlueZeroThemeAugment {
  /**
   * Theme handle se `config.theme` fornito; altrimenti `null`. Passthrough getter
   * (D-F7-01 Opzione B standalone — il theme NON wrappa il broker).
   */
  readonly theme: Theme | null
}

/**
 * Type union completa: ogni call a `createGlueZero` può ritornare uno qualsiasi
 * dei 7 wrapper a seconda di `features`. Il consumer riceve l'union — la
 * narrowing avviene tramite type guard runtime (es. `if ('connectRealtime' in
 * broker)`).
 *
 * **BLOCKER-2 fix**: type union include OBBLIGATORIAMENTE
 * ReturnType<createWorkerBroker> + ReturnType<createRealtimeBroker> (chain F1..F6
 * non è opzionale).
 *
 * **v1.1.0 ext F7 (D-F7-07)**: ogni variante è intersezione con
 * {@link GlueZeroThemeAugment} — espone `.theme` field (`Theme | null`).
 */
export type GlueZero = (
  | ReturnType<typeof createBroker>
  | ReturnType<typeof createMapperBroker>
  | ReturnType<typeof createRouterBroker>
  | ReturnType<typeof createRealtimeBroker>
  | ReturnType<typeof createWorkerBroker>
  | ReturnType<typeof createCacheBroker>
  | ReturnType<typeof createDevtoolsBroker>
) &
  GlueZeroThemeAugment

/**
 * Schema Valibot per `GlueZeroConfig.features`. Tutti i campi sono boolean
 * optional. Il resto del config passa per `looseObject` (delegato downstream
 * ai factory dei sub-package — D-56 validation at boundary).
 */
const GlueZeroFeaturesSchema = v.optional(
  v.looseObject({
    cache: v.optional(v.boolean()),
    devtools: v.optional(v.boolean()),
    worker: v.optional(v.boolean()),
    realtime: v.optional(v.boolean()),
  }),
)

const GlueZeroConfigSchema = v.looseObject({
  features: GlueZeroFeaturesSchema,
})

/**
 * Crea un GlueZero aggregato con chain composition CHAIN COMPLETA
 * F1+F2+F3+F4+F5+F6 (BLOCKER-2 fix).
 *
 * @param config Optional config (default empty + tutte le feature enabled).
 * @returns Istanza {@link GlueZero} (broker outermost in chain).
 * @throws {Error} `Invalid GlueZeroConfig: <issues>` se Valibot validation fallisce.
 *
 * @example Quick start (default chain F1+F2+F3+F4+F5+F6 attivi)
 * ```ts
 * import { createGlueZero } from '@gluezero/gluezero'
 *
 * const broker = createGlueZero({
 *   cache: { maxEntries: 500 },
 *   devtools: { enableByDefault: true },
 * })
 * broker.publish('weather.requested', { location: 'Roma' })
 * ```
 *
 * @example Opt-out features (skip realtime + worker per SPA non realtime)
 * ```ts
 * const broker = createGlueZero({
 *   features: { realtime: false, worker: false },
 *   cache: { maxEntries: 100 },
 * })
 * ```
 *
 * @example Multi-tenant isolation (D-30 anti-singleton)
 * ```ts
 * function brokerForTenant(tenantId: string) {
 *   return createGlueZero({
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
 * const bare = createGlueZero({
 *   features: { realtime: false, worker: false, cache: false, devtools: false },
 * })
 * // → ritorna RouterBroker con chain implicita F1+F2+F3
 * ```
 *
 * @example v1.1.0 ext F7 — Optional theme layer (D-F7-07)
 * ```ts
 * import { createGlueZero } from '@gluezero/gluezero'
 * import { createTheme } from '@gluezero/theme/factory'
 *
 * const theme = createTheme({ persistence: 'localStorage' })
 * const broker = createGlueZero({ theme })
 * broker.theme?.manager.setMode('dark')
 * broker.theme?.applyTokens({ 'color-primary': '#FF6B35' })
 * ```
 *
 * @throws {Error} `Invalid GlueZeroConfig: <issues>` se Valibot validation fallisce.
 *   Propaga anche `Invalid CacheBrokerConfig:` / `Invalid DevtoolsBrokerConfig:` /
 *   `Invalid WorkerBrokerConfig:` / `Invalid RealtimeBrokerConfig:` / `Invalid
 *   RouterBrokerConfig:` dei factory downstream (D-56 validation at boundary cascade).
 *
 * @see RESEARCH §11.3 Opzione B convenience factory.
 */
export function createGlueZero(config: GlueZeroConfig = {}): GlueZero {
  const parsed = v.safeParse(GlueZeroConfigSchema, config)
  if (!parsed.success) {
    const messages = parsed.issues.map((i) => i.message).join('; ')
    throw new Error(`Invalid GlueZeroConfig: ${messages}`)
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
  // sull'altro). `createGlueZero` ritorna il wrapper OUTERMOST in funzione di
  // `features`. La researcher §11.3 documenta la roadmap V1.x per chain
  // letterale multi-wrapper (es. Devtools(Cache(Worker(Realtime(Router(...)))))).
  //
  // L'ORDINE OUTERMOST → INNERMOST è devtools > cache > worker > realtime > router.
  // Il branch più esterno attivo determina il wrapper ritornato.
  let broker: GlueZero

  if (f.devtools) {
    broker = createDevtoolsBroker(config) as GlueZero
  } else if (f.cache) {
    broker = createCacheBroker(config) as GlueZero
  } else if (f.worker) {
    broker = createWorkerBroker(config) as GlueZero
  } else if (f.realtime) {
    broker = createRealtimeBroker(config) as GlueZero
  } else {
    // Chain minimal F1+F2+F3 — RouterBroker include MapperBroker (F2) +
    // Broker (F1) via composition interna (D-83 chain F1→F2→F3).
    broker = createRouterBroker(config) as GlueZero
  }

  // v1.1.0 ext F7 (D-F7-07): attach `theme` field passthrough (D-F7-01 Opzione B
  // standalone — il theme NON wrappa il broker, è handle separato passato in
  // input dal consumer). `Object.defineProperty` per renderlo readonly e
  // non-enumerable (no impatto su `Object.keys(broker)` / spread / iteration
  // pre-W5b → zero regressione su consumer F1-F6).
  const theme: Theme | null = config.theme ?? null
  Object.defineProperty(broker, 'theme', {
    value: theme,
    writable: false,
    enumerable: false,
    configurable: false,
  })

  return broker
}
