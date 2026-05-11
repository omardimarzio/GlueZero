/**
 * MOCK loader privato (D-V2-F8-03 lockato — NON in barrel).
 *
 * Simula `MicroFrontendLoaderAdapter` per scenari test E2E + Tier-3 Playwright.
 * Consumer scrivono il proprio mock loader implementando l'interface pubblica
 * (`MicroFrontendLoaderAdapter`). F9 (mf-esm) testerà contro loader reale ESM.
 *
 * @internal NON esposto da `packages/microfrontends/src/index.ts` (privato).
 *
 * @see RESEARCH §6.2 + PATTERNS §40 + D-V2-F8-03
 */
import type { LoadedModule, MicroFrontendLoaderAdapter } from '../loader-registry'
import type { MicroFrontendRuntimeModule } from '../types/runtime-context'

/** Configurazione MOCK loader (test-controlled). */
export interface MockLoaderConfig {
  /** Override del `type` adapter (default `'mock'`). Utile per registrare loader multipli. */
  readonly type?: string

  /** Simula latency network in ms (default 0). */
  readonly delayMs?: number

  /** Forza failure su una specifica phase lifecycle. */
  readonly failOn?: 'load' | 'bootstrap' | 'mount' | 'unmount' | 'destroy' | null

  /** Override custom dei lifecycle hooks (per spy/assertion). */
  readonly lifecycle?: Partial<MicroFrontendRuntimeModule>

  /** Metadata custom restituiti nel LoadedModule. */
  readonly metadata?: Record<string, unknown>
}

/**
 * Factory MOCK loader (D-V2-F8-03).
 *
 * Replica pattern F2 `createMapperHarness` — privato, NON in barrel.
 *
 * @example
 * ```ts
 * import { createMockLoader } from './test-utils/mock-loader'
 *
 * const mockLoader = createMockLoader({ delayMs: 5, failOn: null })
 * service.registerLoader(mockLoader)
 * await service.register({ id: 'x', name: 'X', version: '1.0.0', loader: { type: 'mock' } })
 * await service.load('x') // success path
 * ```
 */
export function createMockLoader(config: MockLoaderConfig = {}): MicroFrontendLoaderAdapter {
  const adapterType = config.type ?? 'mock'

  return {
    type: adapterType,
    async load(definition, _ctx) {
      if (config.delayMs && config.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, config.delayMs))
      }
      if (config.failOn === 'load') {
        throw new Error('mock loader: simulated load failure')
      }

      const lifecycle: MicroFrontendRuntimeModule = {
        bootstrap:
          config.lifecycle?.bootstrap ??
          (async () => {
            if (config.failOn === 'bootstrap') {
              throw new Error('mock loader: simulated bootstrap failure')
            }
          }),
        mount:
          config.lifecycle?.mount ??
          (async () => {
            if (config.failOn === 'mount') {
              throw new Error('mock loader: simulated mount failure')
            }
          }),
        unmount:
          config.lifecycle?.unmount ??
          (async () => {
            if (config.failOn === 'unmount') {
              throw new Error('mock loader: simulated unmount failure')
            }
          }),
        destroy:
          config.lifecycle?.destroy ??
          (() => {
            if (config.failOn === 'destroy') {
              throw new Error('mock loader: simulated destroy failure')
            }
          }),
        ...(config.lifecycle?.update && { update: config.lifecycle.update }),
      }

      const loaded: LoadedModule = {
        module: { mockId: definition.url ?? `mock-${Date.now()}` },
        lifecycle,
        metadata: config.metadata ?? { mock: true },
      }
      return loaded
    },
  }
}
