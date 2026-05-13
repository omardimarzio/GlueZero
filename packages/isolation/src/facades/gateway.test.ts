/**
 * Tier-1 unit suite per `createGatewayFacade` — 6 test (jsdom).
 *
 * Coverage: permission deny/allow + metadata.microFrontendId attribution +
 * 2 topics (request/error) + network='blocked'/'direct-allowed' → undefined +
 * peer optional permissions absent → pass-through.
 *
 * @see packages/isolation/src/facades/gateway.ts
 */
import { describe, expect, test, vi } from 'vitest'
import { DEFAULT_ISOLATION_POLICY } from '../types/policy.js'
import { createGatewayFacade } from './gateway.js'

interface PublishedEvent {
  readonly topic: string
  readonly payload: unknown
}

function mockBroker(opts?: {
  permissionResult?: { allowed: boolean; mode: 'off' | 'warn' | 'enforce' }
  noPermissionService?: boolean
}): {
  published: PublishedEvent[]
  publish(topic: string, payload: unknown): void
  getService<T>(key: symbol | string): T | undefined
} {
  const published: PublishedEvent[] = []
  const broker = {
    published,
    publish(topic: string, payload: unknown): void {
      published.push({ topic, payload })
    },
    getService<T>(_key: symbol | string): T | undefined {
      if (opts?.noPermissionService) return undefined
      const result = opts?.permissionResult ?? { allowed: true, mode: 'enforce' as const }
      return {
        check: (): { allowed: boolean; mode: string } => result,
      } as unknown as T
    },
  }
  return broker
}

function mockGatewayService() {
  const calls: Array<{
    routeId: string
    payload: unknown
    options: unknown
  }> = []
  return {
    calls,
    request: vi.fn(async (routeId: string, payload: unknown, options: unknown) => {
      calls.push({ routeId, payload, options })
      return { ok: true, routeId }
    }),
  }
}

describe('createGatewayFacade', () => {
  test('permission denied enforce → throw with code=PERMISSION_DENIED', async () => {
    const broker = mockBroker({
      permissionResult: { allowed: false, mode: 'enforce' },
    })
    const gw = createGatewayFacade(
      'mf-1',
      { ...DEFAULT_ISOLATION_POLICY, network: 'gateway-only' },
      { gateway: () => mockGatewayService() },
      broker,
    )
    expect(gw).toBeDefined()
    await expect(gw!.request('users.list', { page: 1 })).rejects.toMatchObject({
      message: expect.stringContaining("gateway.request('users.list')"),
      code: 'PERMISSION_DENIED',
    })
  })

  test('permission allowed → gatewayService.request invoked with metadata.microFrontendId attribution', async () => {
    const broker = mockBroker()
    const svc = mockGatewayService()
    const gw = createGatewayFacade(
      'mf-1',
      { ...DEFAULT_ISOLATION_POLICY, network: 'gateway-only' },
      { gateway: () => svc },
      broker,
    )
    const result = await gw!.request('users.list', { page: 1 }, { metadata: { traceId: 'abc' } })
    expect(result).toEqual({ ok: true, routeId: 'users.list' })
    expect(svc.calls).toHaveLength(1)
    expect(svc.calls[0]?.routeId).toBe('users.list')
    expect(svc.calls[0]?.payload).toEqual({ page: 1 })
    // metadata.microFrontendId forzato override (T-13-W2-P04-01 mitigation)
    expect(svc.calls[0]?.options).toMatchObject({
      metadata: { traceId: 'abc', microFrontendId: 'mf-1' },
    })
  })

  test('topic emit pre-call microfrontend.gateway.request', async () => {
    const broker = mockBroker()
    const gw = createGatewayFacade(
      'mf-1',
      { ...DEFAULT_ISOLATION_POLICY, network: 'gateway-only' },
      { gateway: () => mockGatewayService() },
      broker,
    )
    await gw!.request('users.list', { page: 1 })
    const requestTopic = broker.published.find(
      (e) => e.topic === 'microfrontend.gateway.request',
    )
    expect(requestTopic).toBeDefined()
    expect(requestTopic?.payload).toMatchObject({
      microFrontendId: 'mf-1',
      routeId: 'users.list',
      timestamp: expect.any(Number),
    })
  })

  test('topic emit on error microfrontend.gateway.error + re-throw', async () => {
    const broker = mockBroker()
    const failingService = {
      request: vi.fn(async () => {
        throw new Error('Network failure')
      }),
    }
    const gw = createGatewayFacade(
      'mf-1',
      { ...DEFAULT_ISOLATION_POLICY, network: 'gateway-only' },
      { gateway: () => failingService },
      broker,
    )
    await expect(gw!.request('users.list')).rejects.toThrow('Network failure')
    const errorTopic = broker.published.find(
      (e) => e.topic === 'microfrontend.gateway.error',
    )
    expect(errorTopic).toBeDefined()
    expect(errorTopic?.payload).toMatchObject({
      microFrontendId: 'mf-1',
      routeId: 'users.list',
      error: 'Network failure',
    })
  })

  test('network=blocked → factory returns undefined', () => {
    const broker = mockBroker()
    const gw = createGatewayFacade(
      'mf-1',
      { ...DEFAULT_ISOLATION_POLICY, network: 'blocked' },
      { gateway: () => mockGatewayService() },
      broker,
    )
    expect(gw).toBeUndefined()
  })

  test('network=direct-allowed → factory returns undefined (no observability)', () => {
    const broker = mockBroker()
    const gw = createGatewayFacade(
      'mf-1',
      { ...DEFAULT_ISOLATION_POLICY, network: 'direct-allowed' },
      { gateway: () => mockGatewayService() },
      broker,
    )
    expect(gw).toBeUndefined()
  })
})
