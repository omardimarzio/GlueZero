/**
 * `webComponentLoader` — Skeleton stub LoaderAdapter F15 W1.
 *
 * Implementazione W2 Plan 15-02:
 * - `customElements.whenDefined(elementName)` + `AbortSignal.timeout(15000ms)` race
 *   (D-V2-F15-06 — carryover F9 D-V2-F9-01 pattern).
 * - `import(definition.url, {signal: ctx.signal})` ESM-only (D-V2-F15-07).
 * - contextMode dispatch 3-mode `property`/`attribute`/`event` (D-V2-F15-05 default property).
 * - Reuse-on-collision DOMException catch + console.warn + `customElements.get()`
 *   (D-V2-F15-08).
 *
 * @see D-V2-F15-05/06/07/08 — WC loader API + timing decisions
 * @see packages/mf-esm/src/esm-loader.ts (F9 template diretto carryover)
 */
import type {
  LoaderContext,
  LoadedModule,
  MicroFrontendLoaderAdapter,
  MicroFrontendLoaderDefinition,
} from '@gluezero/microfrontends'

/**
 * Skeleton stub — body W2 P02 implementation.
 *
 * @throws `MfWebComponentError` con code in `MfWebComponentErrorCode` union su
 *   timeout / script load failed / contextMode invalid.
 */
export const webComponentLoader: MicroFrontendLoaderAdapter = {
  type: 'web-component',
  async load(_definition: MicroFrontendLoaderDefinition, _ctx: LoaderContext): Promise<LoadedModule> {
    throw new Error(
      'TODO W2 P02 — webComponentLoader implementation D-V2-F15-05..08 (customElements.whenDefined + AbortSignal.timeout + contextMode dispatch + reuse-on-collision)',
    )
  },
}
