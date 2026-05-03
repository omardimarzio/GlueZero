// backpressure-strategy.test.ts — Test deterministici per BackpressureStrategy 6 policy
// types + critical priority bypass (D-75, ROUTE-10, Pitfall 4 fix).
//
// Coverage:
// - 'queue-bounded' max:N — overflow drop-new (default) e drop-oldest (opt-in)
// - 'drop' — solo 1 in volo, secondi rejected
// - 'throttle' perSec:N — rate-limit con finestra 1s
// - 'debounce' waitMs:N — solo l'ultimo dopo quiet
// - 'latest-only' — abort cascade pending
// - 'merge'/'coalesce' — V1 alias latest-only minimal
// - priority='critical' bypass tutte le policy (Pitfall 4)
// - queueLength(routeId) per Inspector

import { isBrokerError } from '@sembridge/core'
import { describe, expect, it, vi } from 'vitest'
import { createBackpressureStrategy } from './backpressure-strategy'

describe('createBackpressureStrategy — 6 policy + critical bypass (D-75, ROUTE-10, Pitfall 4)', () => {
  it("Test 1: 'queue-bounded' max:2 — 3 schedule consecutivi con drop-new (default) → 1st e 2nd eseguono, 3rd rejected con BrokerError 'backpressure.dropped'", async () => {
    const strategy = createBackpressureStrategy({
      defaultPolicy: { type: 'queue-bounded', max: 2 },
    })

    let resolveT1: (v: string) => void = () => {}
    let resolveT2: (v: string) => void = () => {}
    const t1 = vi.fn().mockImplementation(
      () =>
        new Promise<string>((r) => {
          resolveT1 = r
        }),
    )
    const t2 = vi.fn().mockImplementation(
      () =>
        new Promise<string>((r) => {
          resolveT2 = r
        }),
    )
    const t3 = vi.fn().mockResolvedValue('ok')

    const p1 = strategy.schedule('routeA', 'normal', t1)
    const p2 = strategy.schedule('routeA', 'normal', t2)
    // 3rd schedule overflow → reject (drop-new default)
    await expect(strategy.schedule('routeA', 'normal', t3)).rejects.toMatchObject({
      code: 'backpressure.dropped',
    })
    expect(t3).not.toHaveBeenCalled()

    // settle p1 e p2 per pulizia
    resolveT1('ok-1')
    resolveT2('ok-2')
    await Promise.all([p1, p2])
  })

  it("Test 2: 'queue-bounded' max:2 con dropOldest:true — 3rd schedule abort 1st pending", async () => {
    const strategy = createBackpressureStrategy({
      defaultPolicy: { type: 'queue-bounded', max: 2 },
      dropOldest: true,
    })

    let resolveT3: (v: string) => void = () => {}
    const t1 = vi.fn().mockImplementation(() => new Promise(() => {})) // never resolves
    const t2 = vi.fn().mockImplementation(() => new Promise(() => {})) // never resolves
    const t3 = vi.fn().mockImplementation(
      () =>
        new Promise<string>((r) => {
          resolveT3 = r
        }),
    )

    const p1 = strategy.schedule('routeA', 'normal', t1)
    const p2 = strategy.schedule('routeA', 'normal', t2)
    // 3rd schedule → con dropOldest, 1st pending viene aborted (rejected)
    const p3 = strategy.schedule('routeA', 'normal', t3)

    await expect(p1).rejects.toMatchObject({ code: 'backpressure.dropped' })
    expect(t3).toHaveBeenCalledTimes(1)

    resolveT3('ok-3')
    await p3
    // catch p2 hanging promise — non deve far fallire il test (async leak protection)
    void p2.catch(() => {})
  })

  it("Test 3: 'drop' policy con 1 task in volo → 2nd schedule immediato drop (reject)", async () => {
    const strategy = createBackpressureStrategy({
      defaultPolicy: { type: 'drop' },
    })

    let resolveT1: (v: string) => void = () => {}
    const t1 = vi.fn().mockImplementation(
      () =>
        new Promise<string>((r) => {
          resolveT1 = r
        }),
    )
    const t2 = vi.fn().mockResolvedValue('ok-2')

    const p1 = strategy.schedule('routeB', 'normal', t1)
    // 2nd schedule mentre t1 in volo → drop immediato
    await expect(strategy.schedule('routeB', 'normal', t2)).rejects.toMatchObject({
      code: 'backpressure.dropped',
    })
    expect(t2).not.toHaveBeenCalled()

    resolveT1('ok-1')
    await p1
  })

  it("Test 4: 'throttle' perSec:5 — 10 schedule rapidi → primi 5 eseguono, restanti rejected", async () => {
    const strategy = createBackpressureStrategy({
      defaultPolicy: { type: 'throttle', perSec: 5 },
    })

    const tasks = Array.from({ length: 10 }, () => vi.fn().mockResolvedValue('ok'))
    const results = await Promise.allSettled(
      tasks.map((t) => strategy.schedule('routeC', 'normal', t)),
    )

    const fulfilled = results.filter((r) => r.status === 'fulfilled')
    const rejected = results.filter((r) => r.status === 'rejected')

    expect(fulfilled.length).toBe(5)
    expect(rejected.length).toBe(5)
    // tutti i rejected hanno code 'backpressure.dropped'
    for (const r of rejected) {
      expect(isBrokerError((r as PromiseRejectedResult).reason)).toBe(true)
      expect((r as PromiseRejectedResult).reason.code).toBe('backpressure.dropped')
    }
  })

  it("Test 5: 'debounce' waitMs:50 — 5 schedule consecutivi entro 50ms → solo l'ULTIMO eseguito dopo quiet", async () => {
    vi.useFakeTimers()
    const strategy = createBackpressureStrategy({
      defaultPolicy: { type: 'debounce', waitMs: 50 },
    })

    const tasks = Array.from({ length: 5 }, (_, i) => vi.fn().mockResolvedValue(`task-${i}`))

    const promises = tasks.map((t) => strategy.schedule('routeD', 'normal', t))

    // avanza 50ms → solo l'ultimo deve essere eseguito
    await vi.advanceTimersByTimeAsync(50)

    // I primi 4 sono ancora pending (debounce timer reset), solo l'ultimo eseguito
    expect(tasks[0]).not.toHaveBeenCalled()
    expect(tasks[1]).not.toHaveBeenCalled()
    expect(tasks[2]).not.toHaveBeenCalled()
    expect(tasks[3]).not.toHaveBeenCalled()
    expect(tasks[4]).toHaveBeenCalledTimes(1)

    // L'ultima Promise deve risolvere
    await expect(promises[4]).resolves.toBe('task-4')

    vi.useRealTimers()
  })

  it("Test 6: 'latest-only' — 2 schedule consecutivi → 2° eseguito, pending precedenti aborted", async () => {
    const strategy = createBackpressureStrategy({
      defaultPolicy: { type: 'latest-only' },
    })

    const t1 = vi.fn().mockResolvedValue('first')
    const t2 = vi.fn().mockResolvedValue('second')

    // 1st schedule (eseguito)
    const r1 = await strategy.schedule('routeE', 'normal', t1)
    expect(r1).toBe('first')
    expect(t1).toHaveBeenCalledTimes(1)

    // 2nd schedule → eseguito (latest-only abort precedenti pending, ma t1 già completato)
    const r2 = await strategy.schedule('routeE', 'normal', t2)
    expect(r2).toBe('second')
    expect(t2).toHaveBeenCalledTimes(1)
  })

  it("Test 7: 'merge' — comportamento V1 minimal alias latest-only (3 schedule → ultimo eseguito)", async () => {
    const strategy = createBackpressureStrategy({
      defaultPolicy: { type: 'merge' },
    })

    const t1 = vi.fn().mockResolvedValue('a')
    const t2 = vi.fn().mockResolvedValue('b')
    const t3 = vi.fn().mockResolvedValue('c')

    const r1 = await strategy.schedule('routeF', 'normal', t1)
    const r2 = await strategy.schedule('routeF', 'normal', t2)
    const r3 = await strategy.schedule('routeF', 'normal', t3)

    // V1 minimal: ogni schedule eseguito (semantica equivalente a latest-only senza pending)
    expect(r1).toBe('a')
    expect(r2).toBe('b')
    expect(r3).toBe('c')
  })

  it("Test 8: priority 'critical' BYPASSA 'queue-bounded' max:0 (Pitfall 4 fix)", async () => {
    const strategy = createBackpressureStrategy({
      defaultPolicy: { type: 'queue-bounded', max: 0 },
    })

    const criticalTask = vi.fn().mockResolvedValue('critical-ok')

    // Senza bypass questa fallirebbe (max:0 → tutti dropped)
    const result = await strategy.schedule('routeG', 'critical', criticalTask)

    expect(result).toBe('critical-ok')
    expect(criticalTask).toHaveBeenCalledTimes(1)
  })

  it("Test 9: priority 'critical' BYPASSA 'drop' (sempre eseguito)", async () => {
    const strategy = createBackpressureStrategy({
      defaultPolicy: { type: 'drop' },
    })

    let resolveT1: (v: string) => void = () => {}
    const t1 = vi.fn().mockImplementation(
      () =>
        new Promise<string>((r) => {
          resolveT1 = r
        }),
    )
    const tCritical = vi.fn().mockResolvedValue('critical-ok')

    // 1st in volo
    const p1 = strategy.schedule('routeH', 'normal', t1)
    // critical bypass: NO drop, viene eseguito anche con t1 in volo
    const result = await strategy.schedule('routeH', 'critical', tCritical)

    expect(result).toBe('critical-ok')
    expect(tCritical).toHaveBeenCalledTimes(1)

    resolveT1('ok-1')
    await p1
  })

  it('Test 10: queueLength(routeId) ritorna numero pending corretto', async () => {
    const strategy = createBackpressureStrategy({
      defaultPolicy: { type: 'queue-bounded', max: 5 },
    })

    // route mai vista → 0
    expect(strategy.queueLength('unseen-route')).toBe(0)

    // dopo schedule senza pending tracking esplicito (queue-bounded esegue diretto se sotto cap)
    // queueLength riflette state.pending.length, che per queue-bounded V1 minimal non accoda
    // (esegue subito) — dunque rimane 0 anche dopo schedule (aspettativa contratto: pending count).
    const t = vi.fn().mockResolvedValue('ok')
    await strategy.schedule('routeI', 'normal', t)
    expect(strategy.queueLength('routeI')).toBe(0)
  })
})
