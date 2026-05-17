/**
 * Tier-1 jsdom unit tests for `storage.ts` — D-V2-F10-07 spread-copy + D-V2-F10-08
 * delete vs assign + computeChangedKeys Object.is top-level.
 *
 * @see packages/context/src/storage.ts
 */
import { afterEach, describe, expect, it } from 'vitest'
import { __resetForTest, clearState, getState, replaceState, setState } from '../storage'

describe('storage — internal plain object spread-copy (D-V2-F10-07)', () => {
  afterEach(() => {
    __resetForTest()
  })

  it('getState() ritorna empty object iniziale', () => {
    expect(getState()).toEqual({})
  })

  it('setState(partial) spread-copia stato + previous riferisce vecchio oggetto', () => {
    setState({ tenantId: 'T1' })
    const r = setState({ user: { id: 'u1' } })
    expect(r.previous).toEqual({ tenantId: 'T1' })
    expect(r.current).toEqual({ tenantId: 'T1', user: { id: 'u1' } })
    // current è NUOVO oggetto, non muta previous
    expect(r.current).not.toBe(r.previous)
  })

  it('changedKeys include solo chiavi con diff Object.is top-level', () => {
    setState({ tenantId: 'T1', locale: 'it' })
    const r = setState({ tenantId: 'T1', user: { id: 'u1' } }) // tenantId same, user new
    expect(r.changedKeys).toEqual(['user'])
  })

  it('setState({}) no-change → changedKeys empty array', () => {
    setState({ tenantId: 'T1' })
    const r = setState({})
    expect(r.changedKeys).toEqual([])
    expect(r.current).toEqual({ tenantId: 'T1' })
  })

  it('setState con stesso valore (Object.is true) → changedKeys empty', () => {
    setState({ tenantId: 'T1' })
    const r = setState({ tenantId: 'T1' })
    expect(r.changedKeys).toEqual([])
  })

  it('replaceState(next) sostituisce intero stato + changedKeys union previous+next', () => {
    setState({ tenantId: 'T1', locale: 'it' })
    const r = replaceState({ user: { id: 'u1' } })
    expect(r.current).toEqual({ user: { id: 'u1' } })
    // tenantId + locale rimossi → changed; user aggiunto → changed
    expect([...r.changedKeys].sort()).toEqual(['locale', 'tenantId', 'user'].sort())
  })

  it('clearState([keys]) usa delete (NOT assign undefined) — D-V2-F10-08', () => {
    setState({ tenantId: 'T1', locale: 'it' })
    const r = clearState(['tenantId'])
    // KEY check: tenantId NON IN current (delete), non solo undefined
    expect('tenantId' in r.current).toBe(false)
    expect(r.current).toEqual({ locale: 'it' })
    expect(r.changedKeys).toEqual(['tenantId'])
  })

  it('clearState() no-args itera 11 chiavi standard PRD §18.4', () => {
    setState({ tenantId: 'T1', locale: 'it', theme: 'dark' })
    const r = clearState()
    expect(r.current).toEqual({})
    // changedKeys contiene SOLO le chiavi presenti rimosse
    expect([...r.changedKeys].sort()).toEqual(['locale', 'tenantId', 'theme'].sort())
  })

  it('clearState([keys]) su chiavi non presenti → changedKeys empty', () => {
    setState({ tenantId: 'T1' })
    const r = clearState(['locale']) // locale non presente
    expect(r.changedKeys).toEqual([])
    expect(r.current).toEqual({ tenantId: 'T1' })
  })
})
