import type { StorageFacade, WorkerFacade } from './facades.js'

/**
 * Declaration merging additive su `MicroFrontendRuntimeContext` (F8 lockato — F10 D-V2-F10-XX).
 *
 * F13 aggiunge SOLO i field NUOVI non già presenti come placeholder F8:
 *
 * - `storage?`: StorageFacade — NEW campo (NON presente F8). Disponibile per
 *   `policy.storage: 'shared' | 'namespaced'`, undefined per `'blocked'`.
 * - `worker?`: WorkerFacade — NEW campo (NON presente F8). Disponibile se host
 *   fornisce `resolvers.worker` (D-V2-F13-04-AMENDED).
 * - `shadowContainer?`: ShadowRoot — NEW campo (NON presente F8, OQ-7 LOW resolution).
 *   Disponibile per `policy.css: 'shadow-dom'` o `policy.dom: 'shadow-dom'`.
 *
 * ## Field NON ridichiarati (conflict mitigation)
 *
 * `gateway?` e `theme?` sono GIA dichiarati in `packages/microfrontends/src/types/runtime-context.ts:86,92`
 * come placeholder `unknown` (F8 li ha pre-dichiarati per F13). Riusiamo lo slot
 * upstream senza ridichiarazione (TS error TS2717 "Subsequent property declarations
 * must have the same type" se ridichiaro con type stretto).
 *
 * Pattern: a runtime W2 P03 il wrap-context chain SET il valore al `GatewayFacade` /
 * `ThemeFacade`, e i consumer `@gluezero/isolation` esportano helper accessor type-safe
 * (`getGatewayFacade(ctx)` / `getThemeFacade(ctx)`) che fanno cast da `unknown` ai
 * facade interfaces. Auto-fix Rule 1: documentato in CHECKPOINT W2.
 *
 * ## D-83 strict SEXTUPLE esteso v2.0
 *
 * Declaration merging type-only — NO modifica `packages/microfrontends/src/types/runtime-context.ts`.
 *
 * @see D-V2-F13-10 — Wrap context chain registration
 * @see D-V2-F13-20 — Pattern S1 augment subpath
 * @see OQ-7 — `shadowContainer?` field additive (LOW resolution)
 */
declare module '@gluezero/microfrontends' {
  interface MicroFrontendRuntimeContext {
    readonly storage?: StorageFacade
    readonly worker?: WorkerFacade
    readonly shadowContainer?: ShadowRoot
  }
}

export {}
