/**
 * Tier-1 unit suite per `createWorkerFacade` — 6 test (jsdom).
 *
 * Coverage: permission deny + resource format `${workerId}.${task}` +
 * 3 topics (started/completed/error) + metadata.microFrontendId attribution.
 *
 * @see packages/isolation/src/facades/worker.ts
 */
import { describe, expect, test, vi } from 'vitest'
import { DEFAULT_ISOLATION_POLICY } from '../types/policy.js'
import { createWorkerFacade } from './worker.js'

interface PublishedEvent {
  readonly topic: string
  readonly payload: unknown
}

interface CheckCall {
  readonly mfId: string
  readonly action: string
  readonly resource?: string
}

function mockBroker(opts?: {
  permissionResult?: { allowed: boolean; mode: 'off' | 'warn' | 'enforce' }
  noPermissionService?: boolean
  capturedChecks?: CheckCall[]
}): {
  published: PublishedEvent[]
  publish(topic: string, payload: unknown): void
  getService<T>(key: symbol | string): T | undefined
} {
  const published: PublishedEvent[] = []
  const checks = opts?.capturedChecks ?? []
  return {
    published,
    publish(topic: string, payload: unknown): void {
      published.push({ topic, payload })
    },
    getService<T>(_key: symbol | string): T | undefined {
      if (opts?.noPermissionService) return undefined
      const result = opts?.permissionResult ?? { allowed: true, mode: 'enforce' as const }
      return {
        check: (args: CheckCall): { allowed: boolean; mode: string } => {
          checks.push(args)
          return result
        },
      } as unknown as T
    },
  }
}

function mockWorkerService() {
  const calls: Array<{
    workerId: string
    task: string
    payload: unknown
    options: unknown
  }> = []
  return {
    calls,
    run: vi.fn(
      async (workerId: string, task: string, payload: unknown, options: unknown) => {
        calls.push({ workerId, task, payload, options })
        return { ok: true, result: 42 }
      },
    ),
  }
}

describe('createWorkerFacade', () => {
  test('permission denied enforce → throw with code=PERMISSION_DENIED', async () => {
    const broker = mockBroker({
      permissionResult: { allowed: false, mode: 'enforce' },
    })
    const wk = createWorkerFacade(
      'mf-1',
      DEFAULT_ISOLATION_POLICY,
      { worker: () => mockWorkerService() },
      broker,
    )
    await expect(wk.run('worker-1', 'compute', { x: 1 })).rejects.toMatchObject({
      message: expect.stringContaining("worker.run('worker-1.compute')"),
      code: 'PERMISSION_DENIED',
    })
  })

  test('resource format `${workerId}.${task}` (action=worker)', async () => {
    const captured: CheckCall[] = []
    const broker = mockBroker({ capturedChecks: captured })
    const wk = createWorkerFacade(
      'mf-1',
      DEFAULT_ISOLATION_POLICY,
      { worker: () => mockWorkerService() },
      broker,
    )
    await wk.run('worker-fft', 'compute', { data: [1, 2, 3] })
    expect(captured).toHaveLength(1)
    expect(captured[0]).toEqual({
      mfId: 'mf-1',
      action: 'worker',
      resource: 'worker-fft.compute',
    })
  })

  test('topic started emit pre-call microfrontend.worker.task.started', async () => {
    const broker = mockBroker()
    const wk = createWorkerFacade(
      'mf-1',
      DEFAULT_ISOLATION_POLICY,
      { worker: () => mockWorkerService() },
      broker,
    )
    await wk.run('worker-1', 'compute', { x: 1 })
    const started = broker.published.find(
      (e) => e.topic === 'microfrontend.worker.task.started',
    )
    expect(started).toBeDefined()
    expect(started?.payload).toMatchObject({
      microFrontendId: 'mf-1',
      workerId: 'worker-1',
      task: 'compute',
      timestamp: expect.any(Number),
    })
  })

  test('topic completed emit on success with durationMs', async () => {
    const broker = mockBroker()
    const wk = createWorkerFacade(
      'mf-1',
      DEFAULT_ISOLATION_POLICY,
      { worker: () => mockWorkerService() },
      broker,
    )
    await wk.run('worker-1', 'compute', { x: 1 })
    const completed = broker.published.find(
      (e) => e.topic === 'microfrontend.worker.task.completed',
    )
    expect(completed).toBeDefined()
    expect(completed?.payload).toMatchObject({
      microFrontendId: 'mf-1',
      workerId: 'worker-1',
      task: 'compute',
      durationMs: expect.any(Number),
    })
    expect((completed?.payload as { durationMs: number }).durationMs).toBeGreaterThanOrEqual(0)
  })

  test('topic error emit on catch + re-throw', async () => {
    const broker = mockBroker()
    const failingService = {
      run: vi.fn(async () => {
        throw new Error('Worker boom')
      }),
    }
    const wk = createWorkerFacade(
      'mf-1',
      DEFAULT_ISOLATION_POLICY,
      { worker: () => failingService },
      broker,
    )
    await expect(wk.run('worker-1', 'compute')).rejects.toThrow('Worker boom')
    const errored = broker.published.find(
      (e) => e.topic === 'microfrontend.worker.task.error',
    )
    expect(errored).toBeDefined()
    expect(errored?.payload).toMatchObject({
      microFrontendId: 'mf-1',
      workerId: 'worker-1',
      task: 'compute',
      error: 'Worker boom',
    })
  })

  test('metadata.microFrontendId attribution forced (T-13-W2-P04-01 mitigation)', async () => {
    const broker = mockBroker()
    const svc = mockWorkerService()
    const wk = createWorkerFacade(
      'mf-1',
      DEFAULT_ISOLATION_POLICY,
      { worker: () => svc },
      broker,
    )
    await wk.run('worker-1', 'compute', { x: 1 }, { metadata: { traceId: 'xyz' } })
    expect(svc.calls).toHaveLength(1)
    expect(svc.calls[0]?.options).toMatchObject({
      metadata: { traceId: 'xyz', microFrontendId: 'mf-1' },
    })
  })
})
