/**
 * Tier-1 jsdom test suite — `mapping-integration.ts` per-MF MapperEngine + AliasRegistry
 * namespace-scoped (MF-MAP-01/02 + MF-INT-MAP-01).
 *
 * Test coverage:
 * - attachMfMapping con mapping vuoto/undefined → no-op
 * - attachMfMapping con inputMap → crea MapperEngine + registra scoped aliases
 * - Per-MF isolation: 2 MF con namespace diversi → engines indipendenti (T-F10-03)
 * - detachMfMapping cleanup (T-F10-05)
 * - 100× register/unregister cycle → no leak (T-F10-05)
 * - Throw esplicativo se `__initMappingIntegration` non chiamato
 *
 * @see D-V2-F10-09 (per-MF MapperEngine instance scoped)
 * @see D-V2-F10-11 (collision policy dedup)
 * @see T-F10-03 (namespace collision)
 * @see T-F10-05 (MapperEngine leak)
 */
import type { Broker, BrokerLogger } from '@gluezero/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __initMappingIntegration,
  __resetMappingForTest,
  attachMfMapping,
  detachMfMapping,
  getActiveMfIds,
  getMfMapperEngine,
  type MicroFrontendMapping,
} from '../mapping-integration'

describe('mapping-integration — per-MF MapperEngine + AliasRegistry namespace (MF-MAP-01..02 + MF-INT-MAP-01)', () => {
  let mockBroker: Broker
  let mockLogger: BrokerLogger
  let warnSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    warnSpy = vi.fn()
    mockLogger = {
      trace: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
      warn: warnSpy,
      error: vi.fn(),
    }
    mockBroker = { publish: vi.fn() } as unknown as Broker
    __initMappingIntegration(mockLogger)
  })

  afterEach(() => {
    __resetMappingForTest()
  })

  it('attachMfMapping con mapping undefined → no-op (skip engine creation)', () => {
    attachMfMapping(mockBroker, 'mf-x', undefined)
    expect(getMfMapperEngine('mf-x')).toBeUndefined()
  })

  it('attachMfMapping con mapping senza inputMap/outputMap → skip engine creation (bundle saving)', () => {
    attachMfMapping(mockBroker, 'mf-x', { contextMap: { localKey: 'tenantId' } })
    expect(getMfMapperEngine('mf-x')).toBeUndefined()
  })

  it('attachMfMapping con inputMap → crea MapperEngine instance (MF-INT-MAP-01)', () => {
    const mapping: MicroFrontendMapping = {
      inputMap: { customerId: { canonical: 'customer_id' } },
    }
    attachMfMapping(mockBroker, 'mf-customer', mapping)
    const engine = getMfMapperEngine('mf-customer')
    expect(engine).toBeDefined()
  })

  it('attachMfMapping con outputMap → crea MapperEngine instance', () => {
    const mapping: MicroFrontendMapping = {
      outputMap: { 'order.created': { canonical: 'order_created' } },
    }
    attachMfMapping(mockBroker, 'mf-orders', mapping)
    expect(getMfMapperEngine('mf-orders')).toBeDefined()
  })

  it('per-MF isolation: 2 MF con namespace diversi → engines indipendenti (T-F10-03 / MF-MAP-02)', () => {
    attachMfMapping(mockBroker, 'mf-1', {
      inputMap: { customerId: { canonical: 'customer_id' } },
    })
    attachMfMapping(mockBroker, 'mf-2', {
      inputMap: { customerId: { canonical: 'cust_uuid' } },
    })
    expect(getActiveMfIds().sort()).toEqual(['mf-1', 'mf-2'])
    // Engines distinte — instance identity diverse
    expect(getMfMapperEngine('mf-1')).not.toBe(getMfMapperEngine('mf-2'))
    expect(getMfMapperEngine('mf-1')).toBeDefined()
    expect(getMfMapperEngine('mf-2')).toBeDefined()
  })

  it('detachMfMapping cleanup AliasRegistry + Map entries + collisions (T-F10-05)', () => {
    attachMfMapping(mockBroker, 'mf-x', {
      inputMap: { customerId: { canonical: 'cust_id' } },
    })
    expect(getMfMapperEngine('mf-x')).toBeDefined()
    detachMfMapping('mf-x')
    expect(getMfMapperEngine('mf-x')).toBeUndefined()
    expect(getActiveMfIds()).not.toContain('mf-x')
  })

  it('detachMfMapping idempotent — invocata 2× senza throw', () => {
    attachMfMapping(mockBroker, 'mf-x', {
      inputMap: { f: { canonical: 'c' } },
    })
    detachMfMapping('mf-x')
    expect(() => detachMfMapping('mf-x')).not.toThrow()
    expect(getMfMapperEngine('mf-x')).toBeUndefined()
  })

  it('register + unregister 100× cycle → no leak (T-F10-05)', () => {
    for (let i = 0; i < 100; i++) {
      attachMfMapping(mockBroker, `mf-${i}`, {
        inputMap: { x: { canonical: 'y' } },
      })
      detachMfMapping(`mf-${i}`)
    }
    expect(getActiveMfIds()).toHaveLength(0)
  })

  it('warn log dedup: senza global alias collision → no warn fired', () => {
    // Pre-condition: questo test assume NO global aliases setup → no collision triggered.
    // Test full global-collision dedup è dipendente da setup CanonicalRegistry shared
    // (out of scope F10 — coperto in W3 integration test).
    attachMfMapping(mockBroker, 'mf-x', {
      inputMap: { customField: { canonical: 'canonical_field' } },
    })
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('ensureShared throw esplicativo se __initMappingIntegration NON chiamato', () => {
    __resetMappingForTest() // clear shared singletons
    expect(() =>
      attachMfMapping(mockBroker, 'mf-x', {
        inputMap: { f: { canonical: 'c' } },
      }),
    ).toThrow(/not initialized/)
  })
})

// ===== Integration SC2 scenario (Task 3 — lifecycle hooks cascade) =====

import { createBroker } from '@gluezero/core'
import { microfrontendModule } from '@gluezero/microfrontends'
import type { MicroFrontendDescriptor, MicroFrontendsService } from '@gluezero/microfrontends'
import { SERVICE_MICROFRONTENDS } from '@gluezero/core'
import { contextModule } from '../context-module'

describe('integration: SC2 scenario 2 MF namespace + lifecycle cascade (MF-MAP-02 + MF-INT-MAP-01 + T-F10-05)', () => {
  beforeEach(() => {
    __resetMappingForTest()
  })
  afterEach(() => {
    __resetMappingForTest()
  })

  function makeHarness(): {
    broker: ReturnType<typeof createBroker>
    mfService: MicroFrontendsService
  } {
    const broker = createBroker({
      modules: [microfrontendModule(), contextModule()],
    })
    const mfService = broker.getService<MicroFrontendsService>(SERVICE_MICROFRONTENDS)
    if (!mfService) throw new Error('mfService missing')
    return { broker, mfService }
  }

  function makeMfDescriptor(opts: {
    id: string
    inputMap?: Record<string, { canonical: string }>
  }): MicroFrontendDescriptor {
    return {
      id: opts.id,
      name: opts.id,
      version: '1.0.0',
      loader: { type: 'esm', url: '/x.js' },
      ...(opts.inputMap !== undefined && {
        mapping: { inputMap: opts.inputMap, namespace: `mf:${opts.id}` },
      }),
    } as unknown as MicroFrontendDescriptor
  }

  it('SC2 scenario 2 MF distinti con stesso canonical → engines isolati per namespace', async () => {
    const { broker, mfService } = makeHarness()
    await mfService.register(
      makeMfDescriptor({
        id: 'mf-customer-1',
        inputMap: { customerId: { canonical: 'customer_id' } },
      }),
    )
    await mfService.register(
      makeMfDescriptor({
        id: 'mf-customer-2',
        inputMap: { customerId: { canonical: 'customer_id' } },
      }),
    )
    // Simulate mounted lifecycle events — wireLifecycleHooks listens
    broker.publish(
      'microfrontend.mounted',
      { id: 'mf-customer-1', name: 'mf-customer-1', version: '1.0.0', state: 'mounted', timestamp: Date.now() },
      { source: { type: 'plugin', id: 'mf-customer-1', name: 'mf-customer-1' }, deliveryMode: 'sync' },
    )
    broker.publish(
      'microfrontend.mounted',
      { id: 'mf-customer-2', name: 'mf-customer-2', version: '1.0.0', state: 'mounted', timestamp: Date.now() },
      { source: { type: 'plugin', id: 'mf-customer-2', name: 'mf-customer-2' }, deliveryMode: 'sync' },
    )

    // 2 engines distinti — namespace isolation (T-F10-03)
    expect(getActiveMfIds().sort()).toEqual(['mf-customer-1', 'mf-customer-2'])
    expect(getMfMapperEngine('mf-customer-1')).not.toBe(getMfMapperEngine('mf-customer-2'))
    expect(getMfMapperEngine('mf-customer-1')).toBeDefined()
    expect(getMfMapperEngine('mf-customer-2')).toBeDefined()
  })

  it('lifecycle hooks cleanup on unmount: detachMfMapping cascade', async () => {
    const { broker, mfService } = makeHarness()
    await mfService.register(
      makeMfDescriptor({
        id: 'mf-x',
        inputMap: { customerId: { canonical: 'customer_id' } },
      }),
    )
    broker.publish(
      'microfrontend.mounted',
      { id: 'mf-x', name: 'mf-x', version: '1.0.0', state: 'mounted', timestamp: Date.now() },
      { source: { type: 'plugin', id: 'mf-x', name: 'mf-x' }, deliveryMode: 'sync' },
    )
    expect(getMfMapperEngine('mf-x')).toBeDefined()

    broker.publish(
      'microfrontend.unmounted',
      { id: 'mf-x', name: 'mf-x', version: '1.0.0', state: 'unmounted', timestamp: Date.now() },
      { source: { type: 'plugin', id: 'mf-x', name: 'mf-x' }, deliveryMode: 'sync' },
    )
    expect(getMfMapperEngine('mf-x')).toBeUndefined()
  })

  it('lifecycle hooks cleanup on unregistered (T-F10-05 leak prevention)', async () => {
    const { broker, mfService } = makeHarness()
    await mfService.register(
      makeMfDescriptor({
        id: 'mf-y',
        inputMap: { f: { canonical: 'c' } },
      }),
    )
    broker.publish(
      'microfrontend.mounted',
      { id: 'mf-y', name: 'mf-y', version: '1.0.0', state: 'mounted', timestamp: Date.now() },
      { source: { type: 'plugin', id: 'mf-y', name: 'mf-y' }, deliveryMode: 'sync' },
    )
    expect(getMfMapperEngine('mf-y')).toBeDefined()
    broker.publish(
      'microfrontend.unregistered',
      { id: 'mf-y', name: 'mf-y', version: '1.0.0', state: 'destroyed', timestamp: Date.now() },
      { source: { type: 'plugin', id: 'mf-y', name: 'mf-y' }, deliveryMode: 'sync' },
    )
    expect(getMfMapperEngine('mf-y')).toBeUndefined()
  })
})
