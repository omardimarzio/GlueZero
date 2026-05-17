/**
 * F12 W4 Task 1 — Tier-1 unit suite per `internal/snapshot-provider-stub.ts`.
 *
 * Coverage:
 *
 * - Test 1: `createSnapshotProvider(service)` ritorna function `() => CompatSnapshot`.
 * - Test 2: invocazione provider ritorna shape `{reports, timestamp}` con tipi corretti.
 * - Test 3: `snapshot.reports` è Record (NON Map) — Object.fromEntries conversion.
 *
 * **Audit-grep test (D-12-20 NOT in public barrel):** verifica in Task 3 closure post-build
 * via `grep -q 'createSnapshotProvider' dist/index.d.ts` → deve FALLIRE (assenza simbolo
 * = barrel hygiene OK).
 *
 * @see plan 12-04 Task 1
 * @see D-12-20 — F16 deferred stub NON in barrel pubblico
 */
import { createBroker } from '@gluezero/core'
import { microfrontendModule } from '@gluezero/microfrontends'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { compatModule, type CompatService } from '../compat-module'
import { createSnapshotProvider } from '../internal/snapshot-provider-stub'

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('snapshot-provider-stub (D-12-20 F16 deferred)', () => {
  it('Test 1: createSnapshotProvider ritorna factory function', () => {
    const broker = createBroker({ modules: [microfrontendModule(), compatModule()] })
    const service = broker.getService('compat') as unknown as CompatService
    const provider = createSnapshotProvider(service)
    expect(typeof provider).toBe('function')
  })

  it('Test 2: provider invocato ritorna shape CompatSnapshot {reports, timestamp}', () => {
    const broker = createBroker({ modules: [microfrontendModule(), compatModule()] })
    const service = broker.getService('compat') as unknown as CompatService
    const provider = createSnapshotProvider(service)
    const snapshot = provider()
    expect(snapshot).toMatchObject({
      reports: expect.any(Object),
      timestamp: expect.any(Number),
    })
    expect(snapshot.timestamp).toBeLessThanOrEqual(Date.now())
    expect(snapshot.timestamp).toBeGreaterThan(0)
  })

  it('Test 3: snapshot.reports è Record (NOT Map) — Object.fromEntries conversion', async () => {
    const broker = createBroker({ modules: [microfrontendModule(), compatModule()] })
    const mfService = broker.getService('microfrontends') as unknown as {
      register: (d: unknown) => Promise<void>
    }
    const service = broker.getService('compat') as unknown as CompatService
    // Pre-popola un report tramite check on-demand.
    await mfService.register({
      id: 'mf-snap-1',
      name: 'mf-snap-1',
      version: '1.0.0',
      loader: { type: 'esm', url: '/x.js' },
      compatibility: { gluezero: '^2.0.0' },
    })
    service.checkMicroFrontendCompatibility('mf-snap-1')
    const provider = createSnapshotProvider(service)
    const snapshot = provider()
    // reports è plain object (Record), NOT Map instance.
    expect(snapshot.reports).not.toBeInstanceOf(Map)
    expect(typeof snapshot.reports).toBe('object')
    // Reports contiene la entry pre-popolata.
    expect(snapshot.reports['mf-snap-1']).toBeDefined()
    expect(snapshot.reports['mf-snap-1']?.microFrontendId).toBe('mf-snap-1')
  })

  it('Test 4: provider re-invocato produce timestamp fresco (immutable snapshot pattern)', async () => {
    const broker = createBroker({ modules: [microfrontendModule(), compatModule()] })
    const service = broker.getService('compat') as unknown as CompatService
    const provider = createSnapshotProvider(service)
    const s1 = provider()
    // Piccolo delay tramite microtask (Date.now() incrementa a granularità ms).
    await new Promise((resolve) => setTimeout(resolve, 2))
    const s2 = provider()
    expect(s2.timestamp).toBeGreaterThanOrEqual(s1.timestamp)
    // Snapshot sono oggetti distinti (NEW object ogni call).
    expect(s2).not.toBe(s1)
  })

  it('Test 5: snapshot JSON.stringify roundtrip (D-12-16 serializzabile)', async () => {
    const broker = createBroker({ modules: [microfrontendModule(), compatModule()] })
    const mfService = broker.getService('microfrontends') as unknown as {
      register: (d: unknown) => Promise<void>
    }
    const service = broker.getService('compat') as unknown as CompatService
    await mfService.register({
      id: 'mf-json',
      name: 'mf-json',
      version: '1.0.0',
      loader: { type: 'esm', url: '/x.js' },
      compatibility: { gluezero: '^2.0.0' },
    })
    service.checkMicroFrontendCompatibility('mf-json')
    const provider = createSnapshotProvider(service)
    const snapshot = provider()
    const serialized = JSON.stringify(snapshot)
    expect(() => JSON.parse(serialized)).not.toThrow()
    const parsed = JSON.parse(serialized) as {
      reports: Record<string, { microFrontendId: string }>
      timestamp: number
    }
    expect(parsed.reports['mf-json']?.microFrontendId).toBe('mf-json')
  })
})

describe('snapshot-provider-stub barrel hygiene (D-12-20 verify)', () => {
  it('Test 6: index.ts barrel NON re-esporta createSnapshotProvider', async () => {
    const barrel = await import('../index')
    const keys = Object.keys(barrel)
    expect(keys).not.toContain('createSnapshotProvider')
    expect(keys).not.toContain('CompatSnapshot')
  })
})
