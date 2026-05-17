/**
 * Tier-1 unit suite per `createStorageFacade` — 7 test (jsdom).
 *
 * Coverage: namespace prefix + namespace-restricted clear (T-13-W2-P04-02
 * mitigation prefix collision) + blocked undefined + shared pass-through +
 * topic emit observability + prefix collision edge case.
 *
 * @see packages/isolation/src/facades/storage.ts
 */
import { beforeEach, describe, expect, test } from 'vitest'
import { DEFAULT_ISOLATION_POLICY } from '../types/policy.js'
import { createStorageFacade } from './storage.js'

interface PublishedEvent {
  readonly topic: string
  readonly payload: unknown
}

function mockBroker(): {
  published: PublishedEvent[]
  publish(topic: string, payload: unknown): void
} {
  const published: PublishedEvent[] = []
  return {
    published,
    publish(topic: string, payload: unknown): void {
      published.push({ topic, payload })
    },
  }
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('createStorageFacade', () => {
  test('namespaced setItem applies prefix `gz:mf:<mfId>:` + emit topic', () => {
    const broker = mockBroker()
    const facade = createStorageFacade(
      'mf-1',
      { ...DEFAULT_ISOLATION_POLICY, storage: 'namespaced' },
      broker,
    )
    expect(facade).toBeDefined()
    facade!.setItem('counter', '42')
    expect(window.localStorage.getItem('gz:mf:mf-1:counter')).toBe('42')
    expect(window.localStorage.getItem('counter')).toBeNull()
    expect(broker.published).toHaveLength(1)
    expect(broker.published[0]?.topic).toBe('microfrontend.storage.changed')
    expect(broker.published[0]?.payload).toMatchObject({
      microFrontendId: 'mf-1',
      op: 'set',
      key: 'counter',
      scope: 'namespaced',
    })
  })

  test('namespaced getItem reads prefixed key (NON raw)', () => {
    const broker = mockBroker()
    window.localStorage.setItem('gz:mf:mf-1:foo', 'bar')
    window.localStorage.setItem('foo', 'raw')
    const facade = createStorageFacade(
      'mf-1',
      { ...DEFAULT_ISOLATION_POLICY, storage: 'namespaced' },
      broker,
    )
    expect(facade!.getItem('foo')).toBe('bar')
  })

  test('namespaced clear() namespace-restricted (NOT touch global or other-mf keys)', () => {
    window.localStorage.setItem('gz:mf:mf-1:a', '1')
    window.localStorage.setItem('gz:mf:mf-1:b', '2')
    window.localStorage.setItem('gz:mf:mf-2:c', '3')
    window.localStorage.setItem('global-key', 'untouched')
    const broker = mockBroker()
    const facade = createStorageFacade(
      'mf-1',
      { ...DEFAULT_ISOLATION_POLICY, storage: 'namespaced' },
      broker,
    )
    facade!.clear()
    expect(window.localStorage.getItem('gz:mf:mf-1:a')).toBeNull()
    expect(window.localStorage.getItem('gz:mf:mf-1:b')).toBeNull()
    expect(window.localStorage.getItem('gz:mf:mf-2:c')).toBe('3')
    expect(window.localStorage.getItem('global-key')).toBe('untouched')
    expect(broker.published).toHaveLength(1)
    expect(broker.published[0]?.payload).toMatchObject({
      microFrontendId: 'mf-1',
      op: 'clear',
      scope: 'namespaced',
    })
  })

  test('blocked → factory returns undefined (facade NOT created)', () => {
    const broker = mockBroker()
    const facade = createStorageFacade(
      'mf-1',
      { ...DEFAULT_ISOLATION_POLICY, storage: 'blocked' },
      broker,
    )
    expect(facade).toBeUndefined()
  })

  test('shared mode pass-through no prefix', () => {
    const broker = mockBroker()
    const facade = createStorageFacade(
      'mf-1',
      { ...DEFAULT_ISOLATION_POLICY, storage: 'shared' },
      broker,
    )
    expect(facade).toBeDefined()
    facade!.setItem('counter', '42')
    expect(window.localStorage.getItem('counter')).toBe('42')
    expect(window.localStorage.getItem('gz:mf:mf-1:counter')).toBeNull()
    expect(broker.published[0]?.payload).toMatchObject({ scope: 'shared' })
  })

  test('topic emit on setItem AND removeItem (observability MF-ISO-03)', () => {
    const broker = mockBroker()
    const facade = createStorageFacade(
      'mf-1',
      { ...DEFAULT_ISOLATION_POLICY, storage: 'namespaced' },
      broker,
    )
    facade!.setItem('k', 'v')
    facade!.removeItem('k')
    expect(broker.published).toHaveLength(2)
    expect(broker.published[0]?.payload).toMatchObject({ op: 'set' })
    expect(broker.published[1]?.payload).toMatchObject({ op: 'remove', key: 'k' })
  })

  test('prefix collision edge: mf-1 vs mf-10 isolated (T-13-W2-P04-02 mitigation)', () => {
    const broker1 = mockBroker()
    const broker10 = mockBroker()
    const f1 = createStorageFacade(
      'mf-1',
      { ...DEFAULT_ISOLATION_POLICY, storage: 'namespaced' },
      broker1,
    )
    const f10 = createStorageFacade(
      'mf-10',
      { ...DEFAULT_ISOLATION_POLICY, storage: 'namespaced' },
      broker10,
    )
    f1!.setItem('k', '1')
    f10!.setItem('k', '10')
    expect(f1!.getItem('k')).toBe('1')
    expect(f10!.getItem('k')).toBe('10')
    f1!.clear()
    // After mf-1 clear, mf-10 untouched
    expect(f1!.getItem('k')).toBeNull()
    expect(f10!.getItem('k')).toBe('10')
    // Verify the actual stored keys still exist for mf-10
    expect(window.localStorage.getItem('gz:mf:mf-10:k')).toBe('10')
  })
})
