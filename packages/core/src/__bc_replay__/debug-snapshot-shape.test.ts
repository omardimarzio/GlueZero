/**
 * v1-bc-replay — PRD §42.2 API #13 freeze: getDebugSnapshot shape v1.x preserved.
 *
 * MF-BC-03: il campo `external?` opzionale DEVE essere ASSENTE quando nessun
 * SnapshotProvider è registrato (MIN-3 deferred a F16). Verifica chirurgica:
 * `expect(snap).not.toHaveProperty('external')`.
 *
 * Shape v1.x da `BrokerDebugSnapshot` (packages/core/src/core/broker.ts:58):
 *   - topics: string[]
 *   - subscriberCount: Record<string, number>
 *   - pluginIds: string[]
 *   - pendingAsyncDelivery: number
 *   - logLevel: LogLevel
 *   - pipelineSteps: PipelineStep[]
 *
 * @see .planning/phases/08-extension-runtime-mf-registry-lifecycle-fsm-standard-topics/08-RESEARCH.md §7.2
 * @see D-V2-F8-08 suite content #7
 */

import { createBroker } from '@gluezero/core'
import { describe, expect, it } from 'vitest'

describe('v1-bc-replay: getDebugSnapshot shape (API #13, MF-BC-03)', () => {
  it('getDebugSnapshot returns v1.x shape — all 6 fields present', () => {
    const broker = createBroker({})
    const snap = broker.getDebugSnapshot()
    expect(snap).toHaveProperty('topics')
    expect(snap).toHaveProperty('subscriberCount')
    expect(snap).toHaveProperty('pluginIds')
    expect(snap).toHaveProperty('pendingAsyncDelivery')
    expect(snap).toHaveProperty('logLevel')
    expect(snap).toHaveProperty('pipelineSteps')
  })

  it('getDebugSnapshot field types preserved (v1.x contract)', () => {
    const broker = createBroker({})
    const snap = broker.getDebugSnapshot()
    expect(Array.isArray(snap.topics)).toBe(true)
    expect(typeof snap.subscriberCount).toBe('object')
    expect(Array.isArray(snap.pluginIds)).toBe(true)
    expect(typeof snap.pendingAsyncDelivery).toBe('number')
    expect(typeof snap.logLevel).toBe('string')
    expect(Array.isArray(snap.pipelineSteps)).toBe(true)
  })

  it('getDebugSnapshot does NOT have `external` field (MIN-3 deferred F16, MF-BC-03)', () => {
    const broker = createBroker({})
    const snap = broker.getDebugSnapshot()
    expect(snap).not.toHaveProperty('external')
  })

  it('getDebugSnapshot baseline empty: 0 topics, 0 plugins, 0 pending async delivery', () => {
    const broker = createBroker({})
    const snap = broker.getDebugSnapshot()
    expect(snap.topics).toEqual([])
    expect(snap.pluginIds).toEqual([])
    expect(snap.pendingAsyncDelivery).toBe(0)
    expect(snap.subscriberCount).toEqual({})
  })
})
