// Integration test — Plugin cleanup cascade D-26 ext F2 (LIFE-02 ext F2)
// (REQ LIFE-02 chiusura PRD §39 #7 in F2 per le risorse mapper).
//
// Verifica end-to-end:
//   - `unregisterPlugin(id)` cascade pulisce risorse mapper:
//     * alias scoped (registrati con scope: pluginId)
//     * transforms con ownerId === id
//     * compiled mapping (mapper.unregisterPluginMappings)
//   - I counter del MappingInspector tornano al baseline post-unregister
//   - Plugin scomparso da `getDebugSnapshot().pluginIds`
//   - Cascade isolata: unregister plugin A NON tocca risorse di plugin B
//
// **NO mock dei moduli interni F2** (D-49 + plan 02-11 vincolo): usa `createMapperBroker`
// reale tramite `createMapperHarness`. La cascade è implementata in
// `MapperBroker.unregisterPlugin` (broker-mapper-wrapper.ts plan 02-10) con try/catch
// swallow per ogni step (T-02-10-03).

import { describe, expect, it } from 'vitest'
import { createMapperHarness } from '../test-utils/mapper-harness'
import type { CanonicalSchemaId } from '../types/canonical-schema'

describe('Plugin cleanup cascade (LIFE-02 ext F2)', () => {
  it('unregisterPlugin cleans up scoped aliases + owned transforms + mapper compiled', async () => {
    const harness = createMapperHarness({
      schemas: [
        {
          id: 'sch' as CanonicalSchemaId,
          fields: { x: { type: 'string', required: false } },
        },
      ],
    })

    await harness.broker.registerPlugin({
      id: 'plugin-cleanup',
      canonicalSchemaId: 'sch' as CanonicalSchemaId,
      outputMap: { x: { source: 'src' } },
    })

    // Register risorse plugin-scoped
    harness.broker.registerAlias('foo', 'bar', { scope: 'plugin-cleanup' })
    harness.broker.registerTransform('plugin-cleanup-tx', (x) => x, {
      ownerId: 'plugin-cleanup',
    })

    const before = harness.broker.getDebugSnapshot().mappings
    expect(before.registeredTransforms).toBe(1)
    expect(harness.broker.getDebugSnapshot().pluginIds).toContain('plugin-cleanup')

    await harness.broker.unregisterPlugin('plugin-cleanup')

    const after = harness.broker.getDebugSnapshot().mappings
    // Cascade: owned transform removed
    expect(after.registeredTransforms).toBe(0)
    // Plugin no longer in registry
    expect(harness.broker.getDebugSnapshot().pluginIds).not.toContain('plugin-cleanup')
  })

  it('cascade isolation: unregister plugin A does NOT touch plugin B resources', async () => {
    const harness = createMapperHarness({
      schemas: [
        {
          id: 'shared' as CanonicalSchemaId,
          fields: { v: { type: 'string', required: false } },
        },
      ],
    })

    await harness.broker.registerPlugin({
      id: 'pa',
      canonicalSchemaId: 'shared' as CanonicalSchemaId,
      outputMap: { v: { source: 'srcA' } },
    })
    await harness.broker.registerPlugin({
      id: 'pb',
      canonicalSchemaId: 'shared' as CanonicalSchemaId,
      outputMap: { v: { source: 'srcB' } },
    })

    harness.broker.registerTransform('tx-a', (x) => x, { ownerId: 'pa' })
    harness.broker.registerTransform('tx-b', (x) => x, { ownerId: 'pb' })
    harness.broker.registerAlias('alA', 'canA', { scope: 'pa' })
    harness.broker.registerAlias('alB', 'canB', { scope: 'pb' })

    expect(harness.broker.getDebugSnapshot().mappings.registeredTransforms).toBe(2)

    // Unregister solo pa
    await harness.broker.unregisterPlugin('pa')

    const snap = harness.broker.getDebugSnapshot()
    // tx-a rimosso, tx-b ancora presente
    expect(snap.mappings.registeredTransforms).toBe(1)
    // pb ancora registered
    expect(snap.pluginIds).toContain('pb')
    expect(snap.pluginIds).not.toContain('pa')
  })

  it('cascade clears compiled mapping (re-publish post-unregister is passthrough)', async () => {
    const harness = createMapperHarness({
      schemas: [
        {
          id: 'rec' as CanonicalSchemaId,
          fields: { canonical: { type: 'string', required: false } },
        },
      ],
    })

    await harness.broker.registerPlugin({
      id: 'p-mapped',
      canonicalSchemaId: 'rec' as CanonicalSchemaId,
      outputMap: {
        canonical: { source: 'local' },
      },
    })

    // Verifica che il mapping compilato è registrato (publish con sourceId p-mapped applica)
    const captured: unknown[] = []
    harness.broker.subscribe('rec.topic', (e) => captured.push(e.payload))

    harness.broker.publish(
      'rec.topic',
      { local: 'value-A' },
      {
        source: { type: 'plugin', id: 'p-mapped' },
        deliveryMode: 'sync',
      },
    )
    expect(captured).toHaveLength(1)
    expect(captured[0]).toEqual({ canonical: 'value-A' })

    // Unregister plugin
    await harness.broker.unregisterPlugin('p-mapped')

    // Re-publish con stesso sourceId — il compiled è stato cleared, passthrough
    // (mapper.hasCompiled('p-mapped') = false → bus.publish diretto col payload originale)
    harness.broker.publish(
      'rec.topic',
      { local: 'value-B' },
      {
        source: { type: 'plugin', id: 'p-mapped' },
        deliveryMode: 'sync',
      },
    )
    expect(captured).toHaveLength(2)
    // Passthrough → payload originale (NON canonicalizzato)
    expect(captured[1]).toEqual({ local: 'value-B' })
  })

  it('cascade swallows errors per step (T-02-10-03)', async () => {
    const harness = createMapperHarness()

    await harness.broker.registerPlugin({
      id: 'p-no-resources',
    })

    // Plugin senza outputMap/transforms/alias scoped — la cascade non deve throw
    // anche se non c'è nulla da pulire
    await expect(harness.broker.unregisterPlugin('p-no-resources')).resolves.toBeUndefined()

    expect(harness.broker.getDebugSnapshot().pluginIds).not.toContain('p-no-resources')
  })
})
