/**
 * F6 GlueZeroConfig — config per `createGlueZero(config)` aggregato (D-30 no
 * singleton + research §11 Opzione B factory aggregato).
 *
 * Estende `BrokerConfig` di @gluezero/core (con augmentation F2-F6 attive via
 * side-effect import dei rispettivi augment.ts). Aggiunge `features` flag per
 * opt-out di feature opzionali (cache/devtools/worker/realtime).
 *
 * **v1.1.0 ext F7 (D-F7-07):** parametro additivo opt-in `theme?: Theme`. Default
 * OFF (theme non incluso). Quando passato, l'aggregate espone il theme come
 * field `.theme` in passthrough getter (D-F7-01 Opzione B standalone — il theme
 * NON wrappa il broker, è un handle separato che ascolta/emette `ui.*` events).
 *
 * @see RESEARCH §11 composition wrapper topology — Opzione A chain explicit vs
 *  Opzione B factory aggregato.
 * @see 07-CONTEXT.md D-F7-07 — aggregate parametro opt-in opzionale
 * @see 07-CONTEXT.md D-F7-01 — composition Opzione B standalone (theme non wrappa)
 */
import type { BrokerConfig } from '@gluezero/core'
// v1.1.0 ext F7 (D-F7-07): import type-only — peer optional, zero runtime dep.
// `@gluezero/theme` esposto come `peerDependenciesMeta.optional: true`; consumer
// che NON installa @gluezero/theme NON paga costo (TS resolve fail-soft solo se
// il consumer prova a costruire il config con `theme`).
import type { Theme } from '@gluezero/theme/factory'

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

  /**
   * v1.1.0 ext F7 (D-F7-07) — Optional theme layer handle.
   *
   * Quando passato, `createGlueZero` espone il theme come field `.theme` in
   * passthrough getter (D-F7-01 Opzione B standalone). Il theme è istanziato
   * dall'utente via `import { createTheme } from '@gluezero/theme/factory'` e
   * passato in input — l'aggregate NON lo costruisce internamente (D-30
   * anti-singleton + zero coupling al theme runtime).
   *
   * Default: undefined → field `.theme` ritorna `null`.
   *
   * @example
   * ```ts
   * import { createGlueZero } from '@gluezero/gluezero'
   * import { createTheme } from '@gluezero/theme/factory'
   *
   * const theme = createTheme({ persistence: 'localStorage' })
   * const broker = createGlueZero({ theme })
   * broker.theme?.manager.setMode('dark')
   * ```
   */
  readonly theme?: Theme
}
