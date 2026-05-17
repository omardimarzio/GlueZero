/**
 * Service locator naming constants (D-V2-02 BLOCKING).
 *
 * Ogni modulo opt-in v2.0 (`@gluezero/microfrontends`, `@gluezero/context`, etc.)
 * registra il proprio service con una di queste const come chiave. I consumer
 * tipizzano via generic cast: `broker.getService<MicroFrontendsService>(SERVICE_MICROFRONTENDS)`.
 *
 * @example
 * ```ts
 * import { SERVICE_MICROFRONTENDS } from '@gluezero/core'
 * import { microfrontendModule } from '@gluezero/microfrontends'
 * import type { MicroFrontendsService } from '@gluezero/microfrontends'
 *
 * const broker = createBroker({ modules: [microfrontendModule()] })
 * const mf = broker.getService<MicroFrontendsService>(SERVICE_MICROFRONTENDS)
 * if (!mf) throw new Error('@gluezero/microfrontends not installed')
 * await mf.register(descriptor)
 * ```
 *
 * Le const sono `as const` per type-narrowing (`typeof SERVICE_MICROFRONTENDS`
 * = `'microfrontends'` literal type, non `string`). Le 6 const coprono i package
 * v2.0 F8-F14; future fasi F15+ aggiungeranno altre `SERVICE_*` additive.
 *
 * @see RESEARCH §10 service locator naming + ROADMAP §Phase 8
 */

/** Service registrato da `@gluezero/microfrontends` (F8). */
export const SERVICE_MICROFRONTENDS = 'microfrontends' as const

/** Service registrato da `@gluezero/context` (F10). */
export const SERVICE_CONTEXT = 'context' as const

/** Service registrato da `@gluezero/permissions` (F11). */
export const SERVICE_PERMISSIONS = 'permissions' as const

/** Service registrato da `@gluezero/compat` (F12). */
export const SERVICE_COMPAT = 'compat' as const

/** Service registrato da `@gluezero/isolation` (F13). */
export const SERVICE_ISOLATION = 'isolation' as const

/** Service registrato da `@gluezero/fallbacks` (F14). */
export const SERVICE_FALLBACKS = 'fallbacks' as const
