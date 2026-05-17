/**
 * F12 W2 Task 1 — Tier-1 unit suite per `version-registry.ts` (D-12-08 / D-12-10).
 *
 * Coverage:
 * - 8 register*Version API (3 PRD §20.4 + 4 D-12-10 additive + 1 theme peer-conditional).
 * - Emit topic `microfrontend.compatibility.version-changed` su value diverso (D-12-08).
 * - No-op idempotent su value identico.
 * - REVISIONE WARNING 6: payload key normalizzato a `dimension` (NON `category`).
 * - REVISIONE WARNING 8: source attribution importata da `internal/compat-source`.
 *
 * @see plan 12-02 Task 1 behavior — 10 test cases
 */
import { createBroker } from '@gluezero/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { COMPAT_PUBLISH_SOURCE } from '../internal/compat-source'
import { createVersionRegistry } from '../version-registry'

beforeEach(() => {
  vi.restoreAllMocks()
})
afterEach(() => {
  vi.restoreAllMocks()
})

function setup() {
  const broker = createBroker({})
  const registry = createVersionRegistry(broker)
  const publishSpy = vi.spyOn(broker, 'publish')
  return { broker, registry, publishSpy }
}

describe('createVersionRegistry — 8 register*Version setter + emit version-changed (D-12-08, D-12-10)', () => {
  it('Test 1: registerCanonicalModelVersion("customer", "1.2.0") sets map entry', () => {
    const { registry } = setup()
    registry.registerCanonicalModelVersion('customer', '1.2.0')
    expect(registry.canonicalModels.get('customer')).toBe('1.2.0')
  })

  it('Test 2: re-register diverso emette version-changed con dimension payload (REVISIONE WARNING 6)', () => {
    const { registry, publishSpy } = setup()
    registry.registerCanonicalModelVersion('customer', '1.2.0')
    publishSpy.mockClear() // ignore first registration
    registry.registerCanonicalModelVersion('customer', '1.3.0')
    expect(publishSpy).toHaveBeenCalledTimes(1)
    expect(publishSpy).toHaveBeenCalledWith(
      'microfrontend.compatibility.version.changed',
      expect.objectContaining({
        dimension: 'canonicalModels',
        key: 'customer',
        oldVersion: '1.2.0',
        newVersion: '1.3.0',
        timestamp: expect.any(Number),
      }),
      expect.any(Object),
    )
  })

  it('Test 3: re-register IDENTICO NON emette topic (no-op idempotent)', () => {
    const { registry, publishSpy } = setup()
    registry.registerCanonicalModelVersion('customer', '1.2.0')
    publishSpy.mockClear()
    registry.registerCanonicalModelVersion('customer', '1.2.0')
    expect(publishSpy).not.toHaveBeenCalled()
  })

  it('Test 4: 8 register API specifiche, ognuna setta la propria Map', () => {
    const { registry } = setup()
    registry.registerCanonicalModelVersion('customer', '1.0.0')
    registry.registerTopicVersion('order.placed', '2.0.0')
    registry.registerRouteVersion('route.checkout', '3.0.0')
    registry.registerWorkerVersion('worker.csv', '4.0.0')
    registry.registerLoaderVersion('esm', '5.0.0')
    registry.registerFrameworkVersion('react', '19.0.0')
    registry.registerDependencyVersion('lodash', '4.17.0')
    registry.registerThemeVersion('tokens', '1.0.0')
    expect(registry.canonicalModels.get('customer')).toBe('1.0.0')
    expect(registry.topics.get('order.placed')).toBe('2.0.0')
    expect(registry.routes.get('route.checkout')).toBe('3.0.0')
    expect(registry.workers.get('worker.csv')).toBe('4.0.0')
    expect(registry.loaders.get('esm')).toBe('5.0.0')
    expect(registry.framework.get('react')).toBe('19.0.0')
    expect(registry.dependencies.get('lodash')).toBe('4.17.0')
    expect(registry.theme.get('tokens')).toBe('1.0.0')
  })

  it('Test 5: 8 Map (incluso theme) inizialmente vuote', () => {
    const { registry } = setup()
    expect(registry.canonicalModels.size).toBe(0)
    expect(registry.topics.size).toBe(0)
    expect(registry.routes.size).toBe(0)
    expect(registry.workers.size).toBe(0)
    expect(registry.loaders.size).toBe(0)
    expect(registry.framework.size).toBe(0)
    expect(registry.dependencies.size).toBe(0)
    expect(registry.theme.size).toBe(0)
  })

  it('Test 6: registry.canonicalModels.get("customer") returns valore registrato (readonly access)', () => {
    const { registry } = setup()
    registry.registerCanonicalModelVersion('customer', '1.2.0')
    expect(registry.canonicalModels.get('customer')).toBe('1.2.0')
  })

  it('Test 7: Map è ReadonlyMap nell\'interface ma mutabile internamente via setter', () => {
    const { registry } = setup()
    // L'interface dichiara ReadonlyMap — verifica strutturale: il setter funziona
    // (la mutabilità interna è incapsulata via closure).
    registry.registerTopicVersion('a', '1.0.0')
    registry.registerTopicVersion('a', '2.0.0')
    expect(registry.topics.get('a')).toBe('2.0.0')
    // Verifica readonly enforcement TS: la Map non espone `.set()` via cast diretto.
    // (verifica solo runtime — TS enforces compile-time).
    expect(typeof (registry.topics as ReadonlyMap<string, string>).get).toBe('function')
  })

  it('Test 8: emit version-changed payload contiene timestamp epoch ms', () => {
    const { registry, publishSpy } = setup()
    const before = Date.now()
    registry.registerCanonicalModelVersion('customer', '1.0.0')
    const after = Date.now()
    const [, payload] = publishSpy.mock.calls[0]!
    expect((payload as { timestamp: number }).timestamp).toBeGreaterThanOrEqual(before)
    expect((payload as { timestamp: number }).timestamp).toBeLessThanOrEqual(after)
  })

  it('Test 9: 2 register*Version su category diverse non interferiscono (Map separate)', () => {
    const { registry } = setup()
    registry.registerCanonicalModelVersion('shared.key', '1.0.0')
    registry.registerTopicVersion('shared.key', '2.0.0')
    expect(registry.canonicalModels.get('shared.key')).toBe('1.0.0')
    expect(registry.topics.get('shared.key')).toBe('2.0.0')
    expect(registry.canonicalModels.size).toBe(1)
    expect(registry.topics.size).toBe(1)
  })

  it('Test 10: emit usa source COMPAT_PUBLISH_SOURCE (REVISIONE WARNING 8 — import-by-identity)', () => {
    const { registry, publishSpy } = setup()
    registry.registerCanonicalModelVersion('customer', '1.0.0')
    expect(publishSpy).toHaveBeenCalledWith(
      'microfrontend.compatibility.version.changed',
      expect.any(Object),
      expect.objectContaining({
        source: COMPAT_PUBLISH_SOURCE,
        deliveryMode: 'sync',
      }),
    )
  })

  it('Test 11: 8 setter coverage — registerThemeVersion accetta discriminator tokens/roles', () => {
    const { registry } = setup()
    registry.registerThemeVersion('tokens', '1.0.0')
    registry.registerThemeVersion('roles', '2.0.0')
    expect(registry.theme.get('tokens')).toBe('1.0.0')
    expect(registry.theme.get('roles')).toBe('2.0.0')
    expect(registry.theme.size).toBe(2)
  })
})
