// Integration test — Cycle detection register-time (D-54)
// (Phase 2 ROADMAP success criterion #5, REQ MAP-13).
//
// Verifica end-to-end che un descriptor plugin con mapping circolare (`A → B → A`
// o `A → B → C → A`) venga rifiutato al `registerPlugin` con `BrokerError`
// `mapping.cycle.detected` SUL register (NON a runtime publish).
//
// Il test verifica anche determinismo: stesso descriptor dato in input → stesso
// `details.cycle` path in output (D-35 — cycle path è stabile).
//
// Pattern F1 replicato (`plugin-cleanup.integration.test.ts`): stato pre-register
// vs post-failure deve essere identico (rollback completo).
//
// **NO mock dei moduli interni F2** (D-49 + plan 02-11 vincolo): usa `createMapperBroker`
// reale tramite `createMapperHarness`.

import { isBrokerError } from '@sembridge/core'
import { describe, expect, it } from 'vitest'
import { createMapperHarness } from '../test-utils/mapper-harness'
import type { CanonicalSchemaId } from '../types/canonical-schema'

describe('Cycle detection register-time (D-54, success criterion #5)', () => {
  it('throws mapping.cycle.detected at registerPlugin (NOT at publish)', async () => {
    const harness = createMapperHarness({
      schemas: [
        {
          id: 'cyc' as CanonicalSchemaId,
          fields: { a: { type: 'string' }, b: { type: 'string' } },
        },
      ],
      transforms: { tx: (x) => x },
    })

    let caught: unknown
    try {
      await harness.broker.registerPlugin({
        id: 'p-cyc',
        canonicalSchemaId: 'cyc' as CanonicalSchemaId,
        outputMap: {
          a: { derive: { sources: ['b'], transform: 'tx' } },
          b: { derive: { sources: ['a'], transform: 'tx' } },
        },
      })
    } catch (e) {
      caught = e
    }

    expect(caught).toBeDefined()
    expect(isBrokerError(caught)).toBe(true)
    if (isBrokerError(caught)) {
      expect(caught.code).toBe('mapping.cycle.detected')
      const details = caught.details as Record<string, unknown> | undefined
      expect(details?.pluginId).toBe('p-cyc')
      expect(Array.isArray(details?.cycle)).toBe(true)
    }

    // Plugin NON registered post-failure (rollback verificato — D-35 throw immediato
    // PRIMA di inner.registerPlugin nel MapperBroker.registerPlugin, plan 02-10).
    expect(harness.broker.getDebugSnapshot().pluginIds).not.toContain('p-cyc')
  })

  it('cycle detection is deterministic: same descriptor → same cycle path', async () => {
    // Stesso descriptor invocato 3 volte su 3 harness fresche → details.cycle identico
    const cyclePaths: string[][] = []
    for (let i = 0; i < 3; i++) {
      const harness = createMapperHarness({
        schemas: [
          {
            id: 'cyc' as CanonicalSchemaId,
            fields: {
              a: { type: 'string' },
              b: { type: 'string' },
              c: { type: 'string' },
            },
          },
        ],
        transforms: { tx: (x) => x },
      })

      try {
        await harness.broker.registerPlugin({
          id: 'p-cyc-deterministic',
          canonicalSchemaId: 'cyc' as CanonicalSchemaId,
          outputMap: {
            a: { derive: { sources: ['b'], transform: 'tx' } },
            b: { derive: { sources: ['c'], transform: 'tx' } },
            c: { derive: { sources: ['a'], transform: 'tx' } },
          },
        })
      } catch (e) {
        if (isBrokerError(e)) {
          const details = e.details as Record<string, unknown> | undefined
          const cycle = details?.cycle as string[] | undefined
          if (cycle) cyclePaths.push(cycle)
        }
      }
    }

    // Tutti e 3 i path uguali (Object.entries insertion-order JS preservato + DFS deterministic)
    expect(cyclePaths).toHaveLength(3)
    expect(cyclePaths[0]).toEqual(cyclePaths[1])
    expect(cyclePaths[1]).toEqual(cyclePaths[2])
    // Il cycle dovrebbe partire da 'a' e ritornare ad 'a' (DFS top-level Object.entries order)
    expect(cyclePaths[0]?.[0]).toBe('a')
    expect(cyclePaths[0]?.[cyclePaths[0].length - 1]).toBe('a')
  })

  it('cycle thrown at register, NOT at runtime publish (D-35 strict)', async () => {
    const harness = createMapperHarness({
      schemas: [
        {
          id: 'cyc' as CanonicalSchemaId,
          fields: { a: { type: 'string' }, b: { type: 'string' } },
        },
      ],
      transforms: { tx: (x) => x },
    })

    // Stato pre-register: nessun plugin registrato
    expect(harness.broker.getDebugSnapshot().pluginIds).toEqual([])

    let registerError: unknown
    try {
      await harness.broker.registerPlugin({
        id: 'p-runtime-test',
        canonicalSchemaId: 'cyc' as CanonicalSchemaId,
        outputMap: {
          a: { derive: { sources: ['b'], transform: 'tx' } },
          b: { derive: { sources: ['a'], transform: 'tx' } },
        },
      })
    } catch (e) {
      registerError = e
    }

    // Errore al register (NON a runtime publish)
    expect(isBrokerError(registerError)).toBe(true)
    // Il publish a runtime di un topic con quel source NON deve throw mapping.cycle
    // (il plugin NON è registrato — passthrough)
    let publishError: unknown
    try {
      harness.broker.publish(
        'cyc.topic',
        { a: 1, b: 2 },
        {
          source: { type: 'plugin', id: 'p-runtime-test' },
          deliveryMode: 'sync',
        },
      )
    } catch (e) {
      publishError = e
    }
    // Publish non deve throw — il plugin non è registered (mapper.hasCompiled = false)
    expect(publishError).toBeUndefined()
  })
})
