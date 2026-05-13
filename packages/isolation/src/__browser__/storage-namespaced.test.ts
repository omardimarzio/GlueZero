/**
 * Tier-3 Playwright Chromium Scenario 4: localStorage namespaced + cross-MF isolation.
 *
 * D-V2-F13-14: jsdom localStorage è sintetico (per-test), Chromium reale verifica
 * cross-context isolation + key iteration ordering deterministica.
 *
 * @see prd_2.0.0.md §21.7 — StorageFacade contract
 * @see D-V2-F13-09 — Storage namespacing prefix
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createStorageFacade } from '../facades/storage.js'
import { DEFAULT_ISOLATION_POLICY } from '../types/policy.js'

const mockBroker = {
  publish(_topic: string, _payload: unknown): void {
    /* no-op for browser test */
  },
}

describe('Tier-3 Chromium — Scenario 4: storage-namespaced', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it('setItem/getItem namespaced prefix gz:mf:<id>:<key>', () => {
    const storage = createStorageFacade(
      'mf-store-1',
      { ...DEFAULT_ISOLATION_POLICY, storage: 'namespaced' },
      mockBroker,
    )
    storage?.setItem('counter', '42')
    expect(window.localStorage.getItem('gz:mf:mf-store-1:counter')).toBe('42')
    expect(storage?.getItem('counter')).toBe('42')
    // Raw key (no prefix) NON accessible via facade
    window.localStorage.setItem('counter', 'raw')
    expect(storage?.getItem('counter')).toBe('42') // ancora il valore prefissato
  })

  it('clear() namespace-restricted: mf-1 keys removed, mf-2 keys preserved, global keys preserved', () => {
    const storage1 = createStorageFacade(
      'mf-store-A',
      { ...DEFAULT_ISOLATION_POLICY, storage: 'namespaced' },
      mockBroker,
    )
    const storage2 = createStorageFacade(
      'mf-store-B',
      { ...DEFAULT_ISOLATION_POLICY, storage: 'namespaced' },
      mockBroker,
    )
    storage1?.setItem('k', 'v-A')
    storage2?.setItem('k', 'v-B')
    window.localStorage.setItem('global-key', 'global-value')

    storage1?.clear()

    // mf-A cleared
    expect(window.localStorage.getItem('gz:mf:mf-store-A:k')).toBeNull()
    // mf-B preserved
    expect(window.localStorage.getItem('gz:mf:mf-store-B:k')).toBe('v-B')
    // global key preserved
    expect(window.localStorage.getItem('global-key')).toBe('global-value')
  })

  it('Cross-MF isolation reale Chromium localStorage — mf-1 vs mf-10 NON collision string-prefix', () => {
    const storage1 = createStorageFacade(
      'mf-1',
      { ...DEFAULT_ISOLATION_POLICY, storage: 'namespaced' },
      mockBroker,
    )
    const storage10 = createStorageFacade(
      'mf-10',
      { ...DEFAULT_ISOLATION_POLICY, storage: 'namespaced' },
      mockBroker,
    )
    storage1?.setItem('key', 'value-1')
    storage10?.setItem('key', 'value-10')

    storage1?.clear() // clear su mf-1 — NON deve toccare mf-10

    expect(storage1?.getItem('key')).toBeNull()
    expect(storage10?.getItem('key')).toBe('value-10')
  })

  it('storage=blocked → factory ritorna undefined', () => {
    const storage = createStorageFacade(
      'mf-blocked',
      { ...DEFAULT_ISOLATION_POLICY, storage: 'blocked' },
      mockBroker,
    )
    expect(storage).toBeUndefined()
  })
})
