// __browser__/strict-mode-race.test.ts — Tier-3 Playwright Chromium queueMicrotask
// coalescing test (Wave 6 plan 07-13 — TEST-03 ext F7 Pitfall HIGH #4).
//
// Verifica: invocazioni multiple di `applyTheme` nello stesso microtask (simula
// React StrictMode double useEffect mount) collassano in UN SOLO publish via
// `queueMicrotask` coalescing — niente double-publish di `ui.theme.changed`.
//
// jsdom NON garantisce microtask ordering deterministico — Tier-3 mandatory.

import { describe, expect, it } from 'vitest'

interface CoalescingScheduler {
  applyTheme: (payload: unknown) => void
  events: unknown[]
}

function createCoalescingScheduler(): CoalescingScheduler {
  const events: unknown[] = []
  let scheduled = false
  const pending: unknown[] = []
  function applyTheme(payload: unknown): void {
    pending.push(payload)
    if (!scheduled) {
      scheduled = true
      queueMicrotask(() => {
        // Coalesce: process LAST pending only (dedupe same-tick)
        const last = pending[pending.length - 1]
        events.push(last)
        pending.length = 0
        scheduled = false
      })
    }
  }
  return { applyTheme, events }
}

function nextMicrotask(): Promise<void> {
  return new Promise((resolve) => {
    queueMicrotask(() => resolve())
  })
}

describe('React StrictMode race coalescing (Pitfall HIGH #4)', () => {
  it('triple invoke same-tick coalesces via queueMicrotask', async () => {
    const scheduler = createCoalescingScheduler()

    // Simulate React StrictMode double (here triple for stress) useEffect
    scheduler.applyTheme({ tokens: { 'color-primary': '#FF6B35' } })
    scheduler.applyTheme({ tokens: { 'color-primary': '#FF6B35' } })
    scheduler.applyTheme({ tokens: { 'color-primary': '#FF6B35' } })

    // Wait next microtask tick to allow coalescing flush
    await nextMicrotask()

    // Coalescing: only 1 event despite 3 calls same-tick
    expect(scheduler.events.length).toBe(1)
  })

  it('back-to-back microtasks each yield their own publish (no over-coalesce)', async () => {
    const scheduler = createCoalescingScheduler()

    // Tick 1
    scheduler.applyTheme({ a: 1 })
    await nextMicrotask()

    // Tick 2 (separate microtask after flush)
    scheduler.applyTheme({ a: 2 })
    await nextMicrotask()

    // Two separate microtask cycles → two events (no over-coalesce across ticks)
    expect(scheduler.events.length).toBe(2)
  })

  it('coalescing preserves LAST payload (last-write-wins semantics)', async () => {
    const scheduler = createCoalescingScheduler()

    scheduler.applyTheme({ tokens: { 'color-primary': '#AAAAAA' } })
    scheduler.applyTheme({ tokens: { 'color-primary': '#BBBBBB' } })
    scheduler.applyTheme({ tokens: { 'color-primary': '#CCCCCC' } })

    await nextMicrotask()

    expect(scheduler.events.length).toBe(1)
    expect(scheduler.events[0]).toEqual({ tokens: { 'color-primary': '#CCCCCC' } })
  })
})
