/**
 * v1-bc-replay — DevtoolsBroker.getDebugSnapshot SnapshotProvider Registry MIN-3 verification.
 *
 * Verifica che il campo `external?` opzionale del `DevtoolsBroker.getDebugSnapshot()`
 * sia ASSENTE quando nessun provider registrato (BC §42 API #13 bit-exact preservation
 * v1.x) e popolato quando provider presenti (D-V2-F16-01/02/03).
 *
 * Pattern carryover F8 `debug-snapshot-shape.test.ts` — file separato per evitare
 * regressioni baseline F8 (verifica `createBroker` core, NON `createDevtoolsBroker`).
 * Quel test resta intatto: 4 scenari sul core Broker shape v1.x (6 fields fissi).
 *
 * NOTA shape: il `DevtoolsBroker.getDebugSnapshot()` ha shape DIVERSA dal core Broker —
 * 5 fields fissi (`recentEvents`, `recentRoutes`, `currentMetrics`, `pausedTopics`,
 * `enabled`) + `external?` opzionale (F16). Vedi `packages/devtools/src/devtools-broker.ts:89`.
 *
 * @see D-V2-F16-01 (Registry sede DevtoolsBroker.registerSnapshotProvider)
 * @see D-V2-F16-02 (external shape multi-provider name-keyed)
 * @see D-V2-F16-03 (sync invocation on-demand)
 * @see MF-DEVTOOLS-05 (REQ frozen contract)
 * @see MF-BC-03 (BC §42 API #13 external? absent baseline preserve)
 * @see packages/core/src/__bc_replay__/debug-snapshot-shape.test.ts (F8 baseline — NON modificato)
 */

import { createDevtoolsBroker } from '@gluezero/devtools'
import { describe, expect, it } from 'vitest'

describe('v1-bc-replay: DevtoolsBroker.getDebugSnapshot — MIN-3 Registry external? lifecycle (MF-BC-03)', () => {
  it('Scenario A — no providers registered → external ABSENT (BC §42 API #13 preserve)', () => {
    const broker = createDevtoolsBroker({})
    const snap = broker.getDebugSnapshot()
    expect(snap).not.toHaveProperty('external')
    // Shape base 5 fields DevtoolsBroker preservata
    expect(snap).toHaveProperty('recentEvents')
    expect(snap).toHaveProperty('recentRoutes')
    expect(snap).toHaveProperty('currentMetrics')
    expect(snap).toHaveProperty('pausedTopics')
    expect(snap).toHaveProperty('enabled')
  })

  it('Scenario B — 1 provider registered → external = {name: providerOutput} (D-V2-F16-02)', () => {
    const broker = createDevtoolsBroker({})
    broker.registerSnapshotProvider('test', () => ({ foo: 'bar' }))
    const snap = broker.getDebugSnapshot()
    expect(snap.external).toEqual({ test: { foo: 'bar' } })
  })

  it('Scenario C — 2 providers registered → external multi-keyed merge (D-V2-F16-02)', () => {
    const broker = createDevtoolsBroker({})
    broker.registerSnapshotProvider('a', () => ({ x: 1 }))
    broker.registerSnapshotProvider('b', () => ({ y: 2 }))
    const snap = broker.getDebugSnapshot()
    expect(snap.external).toEqual({ a: { x: 1 }, b: { y: 2 } })
  })
})
