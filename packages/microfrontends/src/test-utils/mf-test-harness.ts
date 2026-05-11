/**
 * Test harness privato per scenari E2E (D-V2-F8-03 lockato — NON in barrel).
 *
 * Replica pattern F2 `createMapperHarness`. Consumer scrivono il proprio harness
 * con propri mock loader. Per V2.0 GA: privato.
 *
 * @internal
 *
 * @see RESEARCH §6.3 + PATTERNS §41 + D-V2-F8-03
 */
import type { Broker } from '@gluezero/core'
import { createBroker, SERVICE_MICROFRONTENDS } from '@gluezero/core'
import type { MicroFrontendLoaderAdapter } from '../loader-registry'
import { microfrontendModule } from '../microfrontend-module'
import type { MicroFrontendsService } from '../registry'
import type { MicroFrontendDescriptor } from '../types/descriptor'
import { createMockLoader, type MockLoaderConfig } from './mock-loader'

/** Harness interface — facilita assertion + cleanup. */
export interface MfTestHarness {
  readonly broker: Broker
  readonly service: MicroFrontendsService
  readonly mockLoader: MicroFrontendLoaderAdapter

  /** Helper: register + load + mount in un colpo. */
  mountFresh(descriptor: MicroFrontendDescriptor): Promise<void>

  /** Cleanup totale per test isolation. */
  dispose(): Promise<void>
}

export interface MfTestHarnessOptions {
  readonly mockConfig?: MockLoaderConfig
}

/**
 * Factory test harness con broker reale + MOCK loader registrato.
 *
 * @example
 * ```ts
 * const harness = createMfTestHarness({ mockConfig: { delayMs: 1 } })
 * await harness.mountFresh({
 *   id: 'x', name: 'X', version: '1.0.0',
 *   loader: { type: 'mock' },
 * })
 * expect(harness.service.getState('x')).toBe('mounted')
 * await harness.dispose()
 * ```
 */
export function createMfTestHarness(options?: MfTestHarnessOptions): MfTestHarness {
  const broker = createBroker({ modules: [microfrontendModule()] })
  const service = broker.getService<MicroFrontendsService>(SERVICE_MICROFRONTENDS)
  if (!service) {
    throw new Error('createMfTestHarness: SERVICE_MICROFRONTENDS not registered')
  }
  const mockLoader = createMockLoader(options?.mockConfig)
  service.registerLoader(mockLoader)

  return {
    broker,
    service,
    mockLoader,
    async mountFresh(descriptor: MicroFrontendDescriptor): Promise<void> {
      await service.register(descriptor)
      await service.load(descriptor.id)
      await service.mount(descriptor.id)
    },
    async dispose(): Promise<void> {
      // Unregister tutti i MF + cascade cleanup
      const all = service.list()
      for (const reg of all) {
        try {
          await service.unregister(reg.descriptor.id, { force: true })
        } catch {
          // swallow errors during teardown — best effort
        }
      }
    },
  }
}
