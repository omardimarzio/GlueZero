/**
 * Tier-1 unit suite per `mfEsmModule()` — install lookup pattern (D-V2-F9-01),
 * duplicate handling cascade (D-V2-F9-03), no-args defaults (D-V2-F9-04),
 * anti-singleton (D-30 carryover F1), augment side-effect marker + NO Broker.prototype
 * augment (D-V2-F9-02).
 *
 * Convention: identificatori inglesi, descrizioni `describe`/`it` italiane (CLAUDE.md).
 *
 * @see D-V2-F9-01 install lookup, D-V2-F9-02 NO Broker.prototype,
 *   D-V2-F9-03 duplicate cascade, D-V2-F9-04 no-args
 */
import { createBroker, SERVICE_MICROFRONTENDS } from '@gluezero/core'
import {
  type MicroFrontendLoaderAdapter,
  microfrontendModule,
  type MicroFrontendsService,
} from '@gluezero/microfrontends'
import { describe, expect, it } from 'vitest'
import { esmLoader } from '../esm-loader'
import { mfEsmModule } from '../mf-esm-module'

describe('mfEsmModule — install lookup service (D-V2-F9-01)', () => {
  it('lookup MicroFrontendsService via service locator e registra esmLoader', () => {
    const broker = createBroker({
      modules: [microfrontendModule(), mfEsmModule()],
    })
    const service = broker.getService<MicroFrontendsService>(SERVICE_MICROFRONTENDS)
    expect(service).toBeDefined()
    expect(service?.getLoader('esm')).toBe(esmLoader)
  })

  it('esmLoader registrato ha type="esm" e load function', () => {
    const broker = createBroker({
      modules: [microfrontendModule(), mfEsmModule()],
    })
    const service = broker.getService<MicroFrontendsService>(SERVICE_MICROFRONTENDS)
    const loader = service?.getLoader('esm')
    expect(loader?.type).toBe('esm')
    expect(typeof loader?.load).toBe('function')
  })
})

/**
 * Helper: estrae il root cause dalla chain di wrap errors generata da
 * `createBroker` quando un install fallisce. Il broker wrappa l'install error
 * con `BrokerError { code: 'module.install.failed', cause / originalError }`.
 */
function getRootCause(err: unknown): Error {
  let current: unknown = err
  const visited = new Set<unknown>()
  while (current && typeof current === 'object' && !visited.has(current)) {
    visited.add(current)
    const c = current as { cause?: unknown; originalError?: unknown }
    if (c.originalError) {
      current = c.originalError
      continue
    }
    if (c.cause) {
      current = c.cause
      continue
    }
    break
  }
  return current as Error
}

describe('mfEsmModule — pre-requisito microfrontendModule (T-F9-10)', () => {
  it('throws Error se @gluezero/microfrontends NON installato prima', () => {
    try {
      createBroker({ modules: [mfEsmModule()] })
      expect.fail('should have thrown')
    } catch (err: unknown) {
      const root = getRootCause(err)
      expect(root.message).toMatch(/requires @gluezero\/microfrontends/i)
    }
  })

  it("error message indica esplicitamente l'ordering corretto", () => {
    try {
      createBroker({ modules: [mfEsmModule()] })
      expect.fail('should have thrown')
    } catch (err: unknown) {
      const root = getRootCause(err)
      expect(root.message).toMatch(/microfrontendModule\(\) before mfEsmModule\(\)/)
    }
  })

  it('install ordering invertito (mfEsmModule prima) → throws', () => {
    // Anche con microfrontendModule presente DOPO, l'install di mfEsmModule
    // viene eseguito prima e fallisce. L'ordine nei `modules: []` conta.
    try {
      createBroker({ modules: [mfEsmModule(), microfrontendModule()] })
      expect.fail('should have thrown')
    } catch (err: unknown) {
      const root = getRootCause(err)
      expect(root.message).toMatch(/requires @gluezero\/microfrontends/i)
    }
  })
})

describe('mfEsmModule — duplicate handling cascade (D-V2-F9-03, F8 OQ-15)', () => {
  it('double install di mfEsmModule() → throws MF_LOADER_TYPE_DUPLICATE', () => {
    try {
      createBroker({
        modules: [microfrontendModule(), mfEsmModule(), mfEsmModule()],
      })
      expect.fail('should have thrown')
    } catch (err: unknown) {
      const root = getRootCause(err)
      expect((root as { code?: string }).code).toBe('MF_LOADER_TYPE_DUPLICATE')
    }
  })

  it('conflict con custom loader type="esm" → throws MF_LOADER_TYPE_DUPLICATE', () => {
    // Setup: registra mfEsmModule() prima, poi tentativo di registrare custom
    // loader type='esm' direttamente via service.registerLoader → cascade.
    const broker = createBroker({
      modules: [microfrontendModule(), mfEsmModule()],
    })
    const service = broker.getService<MicroFrontendsService>(SERVICE_MICROFRONTENDS)
    const customEsmLoader: MicroFrontendLoaderAdapter = {
      type: 'esm',
      async load() {
        return {
          module: {},
          lifecycle: {
            mount: async (): Promise<void> => {
              /* no-op custom */
            },
          },
        }
      },
    }
    expect(() => {
      service?.registerLoader(customEsmLoader)
    }).toThrow(
      expect.objectContaining({
        code: 'MF_LOADER_TYPE_DUPLICATE',
      }),
    )
  })
})

describe('mfEsmModule — id/version BrokerModule shape', () => {
  it('mfEsmModule().id === "mf-esm"', () => {
    expect(mfEsmModule().id).toBe('mf-esm')
  })

  it('mfEsmModule().version === "2.0.0-alpha.0" (D-V2-F8-10 pre-GA)', () => {
    expect(mfEsmModule().version).toBe('2.0.0-alpha.0')
  })

  it('mfEsmModule().install è function', () => {
    expect(typeof mfEsmModule().install).toBe('function')
  })
})

describe('mfEsmModule — anti-singleton (D-30 carryover F1)', () => {
  it('mfEsmModule() ritorna nuovo BrokerModule ad ogni call (referential inequality)', () => {
    const a = mfEsmModule()
    const b = mfEsmModule()
    expect(a).not.toBe(b)
  })

  it('2 broker indipendenti possono installare mfEsmModule() senza shared state', () => {
    const broker1 = createBroker({
      modules: [microfrontendModule(), mfEsmModule()],
    })
    const broker2 = createBroker({
      modules: [microfrontendModule(), mfEsmModule()],
    })
    const service1 = broker1.getService<MicroFrontendsService>(SERVICE_MICROFRONTENDS)
    const service2 = broker2.getService<MicroFrontendsService>(SERVICE_MICROFRONTENDS)
    // Service distinti (no shared state) ma entrambi hanno esmLoader registrato.
    expect(service1).not.toBe(service2)
    expect(service1?.getLoader('esm')).toBe(esmLoader)
    expect(service2?.getLoader('esm')).toBe(esmLoader)
  })
})

describe('mfEsmModule — NO Broker.prototype augment (D-V2-F9-02 STRICT)', () => {
  it('install non aggiunge metodi al Broker prototype', () => {
    // Snapshot prototype keys PRIMA di qualunque install.
    const brokerBefore = createBroker({ modules: [microfrontendModule()] })
    const protoKeysBefore = Object.getOwnPropertyNames(
      Object.getPrototypeOf(brokerBefore) as object,
    ).sort()

    // Install mfEsmModule su un broker fresh — verifica che prototype non cambi.
    const brokerAfter = createBroker({
      modules: [microfrontendModule(), mfEsmModule()],
    })
    const protoKeysAfter = Object.getOwnPropertyNames(
      Object.getPrototypeOf(brokerAfter) as object,
    ).sort()

    // Stesso set di keys: mfEsmModule NON estende il prototype del Broker.
    expect(protoKeysAfter).toEqual(protoKeysBefore)
  })

  it('broker post-install NON espone metodi sugar mf-esm specifici', () => {
    const broker = createBroker({
      modules: [microfrontendModule(), mfEsmModule()],
    })
    // F8 microfrontends/augment espone loadMicroFrontend (sugar service.load),
    // ma F9 NON aggiunge NESSUN metodo broker-level sugar specifico ESM
    // (es. no `broker.loadEsmMicroFrontend` o `broker.registerEsmLoader`).
    const brokerKeys = Object.keys(broker)
    const esmSugarKeys = brokerKeys.filter((k) =>
      /esm|Esm|ESM/.test(k),
    )
    expect(esmSugarKeys).toEqual([])
  })
})

describe('mfEsmModule — augment side-effect import (D-V2-F9-02)', () => {
  it('__mfEsmAugmentLoaded marker disponibile via side-effect import', async () => {
    // Import barrel (che a sua volta side-effect import './augment').
    const mod = await import('../index')
    expect((mod as { __mfEsmAugmentLoaded: true }).__mfEsmAugmentLoaded).toBe(true)
  })

  it('marker preservato anche con import diretto del file augment', async () => {
    const augmentMod = await import('../augment')
    expect((augmentMod as { __mfEsmAugmentLoaded: true }).__mfEsmAugmentLoaded).toBe(true)
  })
})
