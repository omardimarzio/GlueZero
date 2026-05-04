// task-tracker.test.ts — Test deterministici TDD RED phase per createTaskTracker
// (state machine atomico Pitfall 2C closure D-133 / D-134 / D-151).
//
// Scope (12 test enumerati nel plan 05-03):
// 1. register memorizes pending + correlationId
// 2. markDone su pending → true + state 'done'
// 3. markTimeout su pending → true + state 'timeout'
// 4. markCancelled su pending → true + state 'cancelled'
// 5. markError su pending → true + state 'error'
// 6. ATOMIC GUARD CRITICAL — markDone DOPO markTimeout: false + lateResponses++
// 7. ATOMIC GUARD inverse — markTimeout DOPO markDone: false + lateResponses++
// 8. ATOMIC GUARD double-done — markDone 2x: secondo false + lateResponses++
// 9. markDone su taskId mai registrato → false + lateResponses++
// 10. getDebugSnapshot shape ({ tasksActive, tasksCompleted, lateResponses, tasks[] })
// 11. register stesso taskId 2 volte → silent override (last-write-wins, tasksActive non duplica)
// 12. correlationId end-to-end — getOutcome ritorna WorkerTaskOutcome con correlationId + elapsedMs > 0
//
// Pattern: factory closure analog `circuit-breaker.test.ts` di F3 — fresh
// instance via beforeEach. Niente fake timers — il test di elapsedMs usa un
// `await setTimeout(5ms)` reale per garantire `Date.now()` delta > 0.

import { beforeEach, describe, expect, it } from 'vitest'
import { createTaskTracker, type TaskTracker } from './task-tracker'

describe('createTaskTracker — state machine atomico Pitfall 2C closure (D-133 / D-134)', () => {
  let tracker: TaskTracker

  beforeEach(() => {
    tracker = createTaskTracker()
  })

  it('Test 1: register memorizza pending + correlationId; tasksActive = 1', () => {
    tracker.register('t1', 'corr-1')
    const snap = tracker.getDebugSnapshot()
    expect(snap.tasksActive).toBe(1)
    const taskInfo = snap.tasks.find((t) => t.taskId === 't1')
    expect(taskInfo).toBeDefined()
    expect(taskInfo?.state).toBe('pending')
    expect(taskInfo?.correlationId).toBe('corr-1')
  })

  it('Test 2: markDone su pending → true + state diventa "done", tasksActive decrementa a 0', () => {
    tracker.register('t1', 'corr-1')
    expect(tracker.markDone('t1', { value: 42 })).toBe(true)
    const snap = tracker.getDebugSnapshot()
    expect(snap.tasksActive).toBe(0)
    expect(snap.tasksCompleted).toBe(1)
    expect(snap.tasks.find((t) => t.taskId === 't1')?.state).toBe('done')
  })

  it('Test 3: markTimeout su pending → true + state diventa "timeout"', () => {
    tracker.register('t1', 'corr-1')
    expect(tracker.markTimeout('t1')).toBe(true)
    const snap = tracker.getDebugSnapshot()
    expect(snap.tasksActive).toBe(0)
    expect(snap.tasksCompleted).toBe(1)
    expect(snap.tasks.find((t) => t.taskId === 't1')?.state).toBe('timeout')
  })

  it('Test 4: markCancelled su pending → true + state diventa "cancelled"', () => {
    tracker.register('t1', 'corr-1')
    expect(tracker.markCancelled('t1')).toBe(true)
    const snap = tracker.getDebugSnapshot()
    expect(snap.tasksActive).toBe(0)
    expect(snap.tasksCompleted).toBe(1)
    expect(snap.tasks.find((t) => t.taskId === 't1')?.state).toBe('cancelled')
  })

  it('Test 5: markError su pending → true + state diventa "error"', () => {
    tracker.register('t1', 'corr-1')
    expect(tracker.markError('t1', 'worker.error', 'boom')).toBe(true)
    const snap = tracker.getDebugSnapshot()
    expect(snap.tasksActive).toBe(0)
    expect(snap.tasksCompleted).toBe(1)
    expect(snap.tasks.find((t) => t.taskId === 't1')?.state).toBe('error')
    const outcome = tracker.getOutcome('t1')
    expect(outcome?.errorCode).toBe('worker.error')
    expect(outcome?.errorMessage).toBe('boom')
  })

  it('Test 6: ATOMIC GUARD CRITICAL — markDone DOPO markTimeout ritorna false + lateResponses++ + state resta "timeout"', () => {
    // Pitfall 2C scenario: timer firefox markTimeout firstly, worker resolve
    // arriva late ed invoca markDone. Lo state machine deve scartare la late
    // response silenziosamente: non viene ripubblicato '<topic>.completed'.
    tracker.register('t1', 'corr-1')
    expect(tracker.markTimeout('t1')).toBe(true)
    // Late response from worker arrives after timeout fired
    expect(tracker.markDone('t1', { foo: 'bar' })).toBe(false)
    const snap = tracker.getDebugSnapshot()
    expect(snap.lateResponses).toBe(1)
    expect(snap.tasks.find((t) => t.taskId === 't1')?.state).toBe('timeout')
    // tasksCompleted NON incrementato dalla late response (solo la prima
    // transition vale).
    expect(snap.tasksCompleted).toBe(1)
  })

  it('Test 7: ATOMIC GUARD inverse — markTimeout DOPO markDone ritorna false + lateResponses++ + state resta "done"', () => {
    // Scenario inverso: worker resolve si materializza rapidamente, poi il
    // timer scaduto invoca markTimeout. Stessa garanzia: la seconda
    // transition è droppata silenziosamente.
    tracker.register('t1', 'corr-1')
    expect(tracker.markDone('t1', { value: 1 })).toBe(true)
    expect(tracker.markTimeout('t1')).toBe(false)
    const snap = tracker.getDebugSnapshot()
    expect(snap.lateResponses).toBe(1)
    expect(snap.tasks.find((t) => t.taskId === 't1')?.state).toBe('done')
    expect(snap.tasksCompleted).toBe(1)
  })

  it('Test 8: ATOMIC GUARD double-done — markDone chiamato 2x, secondo ritorna false + lateResponses++', () => {
    // Defensive guard contro worker che (per bug consumer) invia 2 message di
    // success per lo stesso taskId. Solo il primo conta.
    tracker.register('t1', 'corr-1')
    expect(tracker.markDone('t1', { value: 'first' })).toBe(true)
    expect(tracker.markDone('t1', { value: 'second' })).toBe(false)
    const snap = tracker.getDebugSnapshot()
    expect(snap.lateResponses).toBe(1)
    expect(snap.tasksCompleted).toBe(1)
    // Result preservato è quello del PRIMO markDone (last-write-wins NON applicabile a
    // transition non-pending — il primo ha già lockato lo state).
    const outcome = tracker.getOutcome('t1')
    expect(outcome?.result).toEqual({ value: 'first' })
  })

  it('Test 9: markDone su taskId mai registrato ritorna false + lateResponses++', () => {
    expect(tracker.markDone('never', { x: 1 })).toBe(false)
    const snap = tracker.getDebugSnapshot()
    expect(snap.lateResponses).toBe(1)
    expect(snap.tasks).toHaveLength(0)
    expect(snap.tasksCompleted).toBe(0)
    expect(snap.tasksActive).toBe(0)
  })

  it('Test 10: getDebugSnapshot ritorna shape { tasksActive, tasksCompleted, lateResponses, tasks[] } con stato accurato', () => {
    // Scenario misto: 2 task registrati, 1 completato, 1 pending.
    tracker.register('t1', 'corr-1')
    tracker.register('t2', 'corr-2')
    tracker.markDone('t1', { v: 1 })
    const snap = tracker.getDebugSnapshot()
    expect(snap).toMatchObject({
      tasksActive: 1, // t2 è ancora pending
      tasksCompleted: 1, // t1 è done
      lateResponses: 0,
    })
    expect(snap.tasks).toHaveLength(2)
    const t1 = snap.tasks.find((t) => t.taskId === 't1')
    const t2 = snap.tasks.find((t) => t.taskId === 't2')
    expect(t1?.state).toBe('done')
    expect(t1?.correlationId).toBe('corr-1')
    expect(typeof t1?.startedAt).toBe('number')
    expect(t2?.state).toBe('pending')
    expect(t2?.correlationId).toBe('corr-2')
    expect(typeof t2?.startedAt).toBe('number')
  })

  it('Test 11: register stesso taskId 2 volte → silent override last-write-wins, tasksActive non duplica', () => {
    tracker.register('t1', 'corr-1')
    // Secondo register: niente throw, override silenzioso del correlationId
    // (last-write-wins). tasksActive resta 1 — il taskId è la chiave del Map.
    expect(() => {
      tracker.register('t1', 'corr-2')
    }).not.toThrow()
    const snap = tracker.getDebugSnapshot()
    expect(snap.tasksActive).toBe(1)
    expect(snap.tasks).toHaveLength(1)
    const taskInfo = snap.tasks.find((t) => t.taskId === 't1')
    expect(taskInfo?.correlationId).toBe('corr-2') // last-write-wins
    expect(taskInfo?.state).toBe('pending') // re-register reset a pending
  })

  it('Test 12: correlationId end-to-end (D-134) — getOutcome ritorna WorkerTaskOutcome con correlationId e elapsedMs > 0', async () => {
    tracker.register('t1', 'corr-1')
    // setTimeout reale 5ms per garantire Date.now() delta > 0 (no fake timers)
    await new Promise((r) => setTimeout(r, 5))
    tracker.markDone('t1', { value: 42 })
    const outcome = tracker.getOutcome('t1')
    expect(outcome).toBeDefined()
    expect(outcome?.taskId).toBe('t1')
    expect(outcome?.correlationId).toBe('corr-1')
    expect(outcome?.state).toBe('done')
    expect(outcome?.result).toEqual({ value: 42 })
    expect(outcome?.elapsedMs).toBeGreaterThan(0)
  })
})
