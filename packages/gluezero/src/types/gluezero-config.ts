/**
 * F6 GlueZeroConfig — config per `createGlueZero(config)` aggregato (D-30 no
 * singleton + research §11 Opzione B factory aggregato).
 *
 * Estende `BrokerConfig` di @gluezero/core (con augmentation F2-F6 attive via
 * side-effect import dei rispettivi augment.ts). Aggiunge `features` flag per
 * opt-out di feature opzionali (cache/devtools/worker/realtime).
 *
 * @see RESEARCH §11 composition wrapper topology — Opzione A chain explicit vs
 *  Opzione B factory aggregato.
 */
import type { BrokerConfig } from '@gluezero/core'

export interface GlueZeroFeatures {
  readonly cache?: boolean
  readonly devtools?: boolean
  readonly worker?: boolean
  readonly realtime?: boolean
}

export interface GlueZeroConfig extends BrokerConfig {
  /**
   * Opt-out di feature opzionali. Default: tutte enabled (true).
   *
   * Esempio: `features: { cache: false }` esclude `createCacheBroker` dalla
   * chain — il broker risultante è equivalente a `createDevtoolsBroker(...)`
   * senza cache layer (zero costo bundle se tree-shake aggressivo).
   */
  readonly features?: GlueZeroFeatures
}
