/**
 * Tier-1 jsdom unit tests for `events.ts` — D-V2-F10-13/14 events fire pattern 1+N
 * sync flush + CONTEXT_TOPICS 8 entries + CONTEXT_TOPIC_FOR_KEY mapping 7+4.
 *
 * @see packages/context/src/events.ts
 */
import type { Broker } from '@gluezero/core'
import { describe, expect, it, vi } from 'vitest'
import { CONTEXT_TOPIC_FOR_KEY, CONTEXT_TOPICS, fireContextEvents } from '../events'
import type { RuntimeContext } from '../types/runtime-context'

describe('events — 1 aggregator + N specific fire pattern (MF-CTX-03, D-V2-F10-13/14)', () => {
  it('CONTEXT_TOPICS contiene 8 topics PRD §18.6', () => {
    expect(CONTEXT_TOPICS).toHaveLength(8)
    expect(CONTEXT_TOPICS).toContain('context.changed')
    expect(CONTEXT_TOPICS).toContain('context.user.changed')
    expect(CONTEXT_TOPICS).toContain('context.tenant.changed')
    expect(CONTEXT_TOPICS).toContain('context.locale.changed')
    expect(CONTEXT_TOPICS).toContain('context.permissions.changed')
    expect(CONTEXT_TOPICS).toContain('context.featureflags.changed')
    expect(CONTEXT_TOPICS).toContain('context.theme.changed')
    expect(CONTEXT_TOPICS).toContain('context.route.changed')
  })

  it('CONTEXT_TOPIC_FOR_KEY mapping 7 chiavi con topic specifico', () => {
    expect(CONTEXT_TOPIC_FOR_KEY['user']).toBe('context.user.changed')
    expect(CONTEXT_TOPIC_FOR_KEY['tenantId']).toBe('context.tenant.changed')
    expect(CONTEXT_TOPIC_FOR_KEY['locale']).toBe('context.locale.changed')
    expect(CONTEXT_TOPIC_FOR_KEY['permissions']).toBe('context.permissions.changed')
    expect(CONTEXT_TOPIC_FOR_KEY['featureFlags']).toBe('context.featureflags.changed')
    expect(CONTEXT_TOPIC_FOR_KEY['theme']).toBe('context.theme.changed')
    expect(CONTEXT_TOPIC_FOR_KEY['currentRoute']).toBe('context.route.changed')
  })

  it('4 chiavi senza topic specifico (timezone/direction/environment/metadata) → undefined (solo aggregator)', () => {
    expect(CONTEXT_TOPIC_FOR_KEY['timezone']).toBeUndefined()
    expect(CONTEXT_TOPIC_FOR_KEY['direction']).toBeUndefined()
    expect(CONTEXT_TOPIC_FOR_KEY['environment']).toBeUndefined()
    expect(CONTEXT_TOPIC_FOR_KEY['metadata']).toBeUndefined()
  })

  it('fireContextEvents emette 1 aggregator + N specific sync flush', () => {
    const publish = vi.fn()
    const broker = { publish } as unknown as Broker
    const previous: RuntimeContext = {}
    const current: RuntimeContext = { tenantId: 'T1', user: { id: 'u1' } }
    fireContextEvents(broker, previous, current, ['tenantId', 'user'])
    expect(publish).toHaveBeenCalledTimes(3) // 1 aggregator + 2 specific
    // Order FIFO sync: aggregator → tenant → user
    const calls = publish.mock.calls
    expect(calls[0]?.[0]).toBe('context.changed')
    expect(calls[0]?.[1]).toEqual({ previous, current, changedKeys: ['tenantId', 'user'] })
    expect(calls[1]?.[0]).toBe('context.tenant.changed')
    expect(calls[1]?.[1]).toEqual({ previous, current, changedKeys: ['tenantId'] })
    expect(calls[2]?.[0]).toBe('context.user.changed')
    expect(calls[2]?.[1]).toEqual({ previous, current, changedKeys: ['user'] })
  })

  it('fireContextEvents per chiave senza topic specifico emette SOLO aggregator', () => {
    const publish = vi.fn()
    const broker = { publish } as unknown as Broker
    const previous: RuntimeContext = {}
    const current: RuntimeContext = { timezone: 'Europe/Rome' }
    fireContextEvents(broker, previous, current, ['timezone'])
    expect(publish).toHaveBeenCalledTimes(1) // SOLO aggregator (timezone non ha topic specifico)
    expect(publish.mock.calls[0]?.[0]).toBe('context.changed')
  })

  it('payload uniforme {previous, current, changedKeys} shape per ogni topic', () => {
    const publish = vi.fn()
    const broker = { publish } as unknown as Broker
    fireContextEvents(broker, {}, { locale: 'it' }, ['locale'])
    for (const call of publish.mock.calls) {
      const payload = call[1] as Record<string, unknown>
      expect(payload).toHaveProperty('previous')
      expect(payload).toHaveProperty('current')
      expect(payload).toHaveProperty('changedKeys')
    }
  })

  it('fireContextEvents con changedKeys multi mix (1 specific + 1 aggregator-only)', () => {
    const publish = vi.fn()
    const broker = { publish } as unknown as Broker
    // locale → specific topic; timezone → solo aggregator
    fireContextEvents(broker, {}, { locale: 'it', timezone: 'Europe/Rome' }, [
      'locale',
      'timezone',
    ])
    // 1 aggregator + 1 specific (locale) — timezone NO specific
    expect(publish).toHaveBeenCalledTimes(2)
    expect(publish.mock.calls[0]?.[0]).toBe('context.changed')
    expect(publish.mock.calls[1]?.[0]).toBe('context.locale.changed')
  })
})
