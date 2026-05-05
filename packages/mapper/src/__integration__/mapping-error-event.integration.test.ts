// Integration test — mapping.error event publication (D-58)
// (Phase 2 ROADMAP success criterion #4 chiusura PRD §39 #4 VAL-09, REQ ERR-02 extension).
//
// Verifica end-to-end:
//   - On transform failure con `onFailure: 'block'` → publica `mapping.error` con
//     payload `{ error: BrokerError, sourceEvent: topic, step: 'event.mapped.canonical' }`
//   - F2 NON publica `<topic>.failed` (D-59 — quello è F3)
//   - L'evento originale NON viene consegnato ai subscriber regolari (delivery skipped)
//
// **NO mock dei moduli interni F2** (D-49 + plan 02-11 vincolo): usa `createMapperBroker`
// reale tramite `createMapperHarness`. La pubblicazione di `mapping.error` è async
// (deliveryMode default — D-58 publish via inner.publish con deliveryMode 'async').

import type { BrokerEvent } from '@gluezero/core'
import { describe, expect, it } from 'vitest'
import { createMapperHarness } from '../test-utils/mapper-harness'
import type { CanonicalSchemaId } from '../types/canonical-schema'

describe('mapping.error event publication (D-58, criterion #4)', () => {
  it('publishes mapping.error when transform throws with onFailure block', async () => {
    const harness = createMapperHarness({
      schemas: [
        {
          id: 'fragile' as CanonicalSchemaId,
          fields: {
            crashy: { type: 'string', required: false, onFailure: 'block' },
          },
        },
      ],
      transforms: {
        boom: () => {
          throw new Error('inner boom')
        },
      },
    })

    const errorEvents: BrokerEvent[] = []
    harness.broker.subscribe('mapping.error', (e) => {
      errorEvents.push(e)
    })

    await harness.broker.registerPlugin({
      id: 'p-fragile',
      canonicalSchemaId: 'fragile' as CanonicalSchemaId,
      outputMap: {
        crashy: { source: 'src', transform: 'boom' },
      },
    })

    harness.broker.publish(
      'test.topic',
      { src: 'value' },
      {
        source: { type: 'plugin', id: 'p-fragile' },
        deliveryMode: 'sync',
      },
    )

    // Async delivery: flush microtask per propagare il publish di mapping.error
    await new Promise<void>((resolve) => queueMicrotask(resolve))
    await new Promise<void>((resolve) => queueMicrotask(resolve))

    expect(errorEvents.length).toBeGreaterThan(0)
    const errPayload = errorEvents[0]?.payload as Record<string, unknown>
    expect(errPayload).toBeDefined()
    expect(errPayload.error).toBeDefined()
    expect(errPayload.sourceEvent).toBe('test.topic')
    expect(errPayload.step).toBe('event.mapped.canonical')

    // BrokerError shape verifica
    const errObj = errPayload.error as Record<string, unknown>
    expect(errObj.code).toBe('mapping.transform.failed')
    expect(errObj.category).toBe('mapping')
  })

  it('does NOT publish topic.failed (D-59 — F2 only emits mapping.error)', async () => {
    const harness = createMapperHarness({
      schemas: [
        {
          id: 'fragile2' as CanonicalSchemaId,
          fields: { crashy: { type: 'string', onFailure: 'block' } },
        },
      ],
      transforms: {
        boom: () => {
          throw new Error('boom')
        },
      },
    })

    const failedEvents: BrokerEvent[] = []
    harness.broker.subscribe('test.topic.failed', (e) => failedEvents.push(e))

    const wildcardFailed: BrokerEvent[] = []
    harness.broker.subscribe('*.failed', (e) => wildcardFailed.push(e))

    await harness.broker.registerPlugin({
      id: 'p-f',
      canonicalSchemaId: 'fragile2' as CanonicalSchemaId,
      outputMap: { crashy: { source: 'src', transform: 'boom' } },
    })

    harness.broker.publish(
      'test.topic',
      { src: 'x' },
      {
        source: { type: 'plugin', id: 'p-f' },
        deliveryMode: 'sync',
      },
    )

    // Flush microtasks
    await new Promise<void>((resolve) => queueMicrotask(resolve))
    await new Promise<void>((resolve) => queueMicrotask(resolve))

    // F2 NON deve emettere topic.failed (questo è F3 routing)
    expect(failedEvents).toHaveLength(0)
    expect(wildcardFailed).toHaveLength(0)
  })

  it('skips delivery to regular subscribers when mapping fails (D-59)', async () => {
    const harness = createMapperHarness({
      schemas: [
        {
          id: 'fragile3' as CanonicalSchemaId,
          fields: { v: { type: 'string', onFailure: 'block' } },
        },
      ],
      transforms: {
        boom: () => {
          throw new Error('boom')
        },
      },
    })

    const regular: unknown[] = []
    harness.broker.subscribe('test.topic', (e) => {
      regular.push(e.payload)
    })

    await harness.broker.registerPlugin({
      id: 'p-skip',
      canonicalSchemaId: 'fragile3' as CanonicalSchemaId,
      outputMap: { v: { source: 'src', transform: 'boom' } },
    })

    harness.broker.publish(
      'test.topic',
      { src: 'x' },
      {
        source: { type: 'plugin', id: 'p-skip' },
        deliveryMode: 'sync',
      },
    )

    // Subscriber regolare NON riceve l'evento (D-59 delivery skipped)
    expect(regular).toHaveLength(0)
  })

  it('records mapping errors in MappingInspector ring buffer (D-48)', async () => {
    const harness = createMapperHarness({
      schemas: [
        {
          id: 'fragile4' as CanonicalSchemaId,
          fields: { v: { type: 'string', onFailure: 'block' } },
        },
      ],
      transforms: {
        boom: () => {
          throw new Error('boom')
        },
      },
    })

    await harness.broker.registerPlugin({
      id: 'p-rec',
      canonicalSchemaId: 'fragile4' as CanonicalSchemaId,
      outputMap: { v: { source: 'src', transform: 'boom' } },
    })

    const inspector = harness.broker.getMappingInspector()
    expect(inspector.lastErrors()).toHaveLength(0)

    harness.broker.publish(
      'topic-rec',
      { src: 'x' },
      {
        source: { type: 'plugin', id: 'p-rec' },
        deliveryMode: 'sync',
      },
    )

    // Mapping error registrato nell'Inspector (recordError chiamato dal handleMappingError)
    const errors = inspector.lastErrors()
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0]?.code).toBe('mapping.transform.failed')

    // Snapshot getDebugSnapshot.mappings.lastMappingErrors aggiornato
    const snap = harness.broker.getDebugSnapshot()
    expect(snap.mappings.lastMappingErrors.length).toBeGreaterThan(0)
  })
})
