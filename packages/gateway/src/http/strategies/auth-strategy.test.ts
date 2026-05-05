// auth-strategy.test.ts — Test deterministici per BearerHookAuth (D-72 + Pitfall 5 fix).
//
// Coverage:
// - Factory shape (getToken + refresh + isInflightRefresh methods)
// - Token caching opt-in via tokenCacheMs (D-72)
// - Token caching disabled (default) — ogni getToken invoca config.getToken
// - Refresh con config.refresh definito
// - Refresh con config.refresh undefined → throw 'auth.refresh.unavailable' con
//   category 'config' (BLOCKER 1 fix iter 1: ErrorCategory union NON include 'auth')
// - Single-flight refresh (Pattern 5 RESEARCH, Pitfall 5): N caller concurrent → 1 sola
//   config.refresh invocation
// - Inflight flag esposto via isInflightRefresh
// - Failure path: tutti i caller rejected con stesso error + nuovo refresh chiama config

import { isBrokerError } from '@gluezero/core'
import { describe, expect, it, vi } from 'vitest'
import { createAuthStrategy } from './auth-strategy'

describe('createAuthStrategy — BearerHookAuth (D-72, SEC-01/SEC-02/ROUTE-07 + Pitfall 5)', () => {
  it('Test 1: getToken() invoca config.getToken e ritorna value', async () => {
    const getTokenSpy = vi.fn().mockResolvedValue('token-1')
    const auth = createAuthStrategy({ config: { getToken: getTokenSpy } })

    const token = await auth.getToken()

    expect(token).toBe('token-1')
    expect(getTokenSpy).toHaveBeenCalledTimes(1)
  })

  it('Test 2: getToken() con tokenCacheMs:1000 → 2 chiamate consecutive entro 1s ritornano stesso token (1 sola config.getToken call)', async () => {
    const getTokenSpy = vi.fn().mockResolvedValue('token-cached')
    const auth = createAuthStrategy({
      config: { getToken: getTokenSpy, tokenCacheMs: 1000 },
    })

    const t1 = await auth.getToken()
    const t2 = await auth.getToken()

    expect(t1).toBe('token-cached')
    expect(t2).toBe('token-cached')
    expect(getTokenSpy).toHaveBeenCalledTimes(1)
  })

  it('Test 3: getToken() con tokenCacheMs:0 (default) → ogni chiamata invoca config.getToken', async () => {
    const getTokenSpy = vi.fn().mockResolvedValue('token-fresh')
    const auth = createAuthStrategy({ config: { getToken: getTokenSpy } })

    await auth.getToken()
    await auth.getToken()
    await auth.getToken()

    expect(getTokenSpy).toHaveBeenCalledTimes(3)
  })

  it('Test 4: refresh() con config.refresh definito → invoca e ritorna nuovo token', async () => {
    const refreshSpy = vi.fn().mockResolvedValue('new-token')
    const auth = createAuthStrategy({
      config: {
        getToken: vi.fn().mockResolvedValue('old-token'),
        refresh: refreshSpy,
      },
    })

    // refresh? è opzionale nell'interface — assertion type-narrow
    const newToken = await auth.refresh?.()

    expect(newToken).toBe('new-token')
    expect(refreshSpy).toHaveBeenCalledTimes(1)
  })

  it('Test 5: refresh() con config.refresh undefined → throw BrokerError "auth.refresh.unavailable" category "config" (BLOCKER 1 fix)', async () => {
    const auth = createAuthStrategy({
      config: { getToken: vi.fn().mockResolvedValue('only-token') },
    })

    // L'interface AuthStrategy.refresh? è opzionale, ma adottiamo always-provide pattern:
    // refresh method sempre presente, throw se config.refresh undefined.
    await expect(auth.refresh?.()).rejects.toSatisfy((err: unknown) => {
      if (!isBrokerError(err)) return false
      return err.code === 'auth.refresh.unavailable' && err.category === 'config'
    })
  })

  it('Test 6: 5 refresh() PARALLELI → config.refresh invocato 1 SOLA volta (single-flight Pitfall 5)', async () => {
    let resolveRefresh: ((token: string) => void) | undefined
    const refreshSpy = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveRefresh = resolve
        }),
    )
    const auth = createAuthStrategy({
      config: { getToken: vi.fn().mockResolvedValue('old'), refresh: refreshSpy },
    })

    // 5 refresh PARALLELI prima del settle
    const promises = Array.from({ length: 5 }, () => auth.refresh?.() ?? Promise.resolve(''))
    // Settle UNICO della Promise condivisa
    resolveRefresh?.('shared-new-token')

    const tokens = await Promise.all(promises)

    expect(refreshSpy).toHaveBeenCalledTimes(1)
    expect(tokens).toEqual([
      'shared-new-token',
      'shared-new-token',
      'shared-new-token',
      'shared-new-token',
      'shared-new-token',
    ])
  })

  it('Test 7: dopo Test 6 settle, nuovo refresh() → config.refresh invocato (release flag)', async () => {
    const refreshSpy = vi
      .fn()
      .mockResolvedValueOnce('first-new')
      .mockResolvedValueOnce('second-new')
    const auth = createAuthStrategy({
      config: { getToken: vi.fn().mockResolvedValue('old'), refresh: refreshSpy },
    })

    const t1 = await auth.refresh?.()
    // Settle del primo refresh — flag inflight rilasciato
    const t2 = await auth.refresh?.()

    expect(t1).toBe('first-new')
    expect(t2).toBe('second-new')
    expect(refreshSpy).toHaveBeenCalledTimes(2)
  })

  it('Test 8: config.refresh throws → tutti i 5 caller rejected con same error; nuovo refresh chiama config.refresh', async () => {
    const errorMarker = new Error('refresh-failed')
    const refreshSpy = vi
      .fn()
      .mockRejectedValueOnce(errorMarker)
      .mockResolvedValueOnce('recovery-token')
    const auth = createAuthStrategy({
      config: { getToken: vi.fn().mockResolvedValue('old'), refresh: refreshSpy },
    })

    // 5 caller PARALLELI → 1 sola invocation, tutti reject con stesso errore
    const settled = await Promise.allSettled([
      auth.refresh?.() ?? Promise.resolve(''),
      auth.refresh?.() ?? Promise.resolve(''),
      auth.refresh?.() ?? Promise.resolve(''),
      auth.refresh?.() ?? Promise.resolve(''),
      auth.refresh?.() ?? Promise.resolve(''),
    ])

    expect(refreshSpy).toHaveBeenCalledTimes(1)
    for (const s of settled) {
      expect(s.status).toBe('rejected')
      if (s.status === 'rejected') {
        expect(s.reason).toBe(errorMarker)
      }
    }

    // Nuova refresh DOPO il fail → config.refresh invocato di nuovo (flag rilasciato)
    const recoveryToken = await auth.refresh?.()
    expect(recoveryToken).toBe('recovery-token')
    expect(refreshSpy).toHaveBeenCalledTimes(2)
  })

  it('Test 9: isInflightRefresh() true durante refresh, false altrimenti', async () => {
    let resolveRefresh: ((token: string) => void) | undefined
    const refreshSpy = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveRefresh = resolve
        }),
    )
    const auth = createAuthStrategy({
      config: { getToken: vi.fn().mockResolvedValue('old'), refresh: refreshSpy },
    })

    expect(auth.isInflightRefresh()).toBe(false)

    const promise = auth.refresh?.() ?? Promise.resolve('')
    expect(auth.isInflightRefresh()).toBe(true)

    resolveRefresh?.('done')
    await promise
    expect(auth.isInflightRefresh()).toBe(false)
  })
})
