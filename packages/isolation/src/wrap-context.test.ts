/**
 * Tier-1 unit suite per `wrapContextWithIsolation` — 2 test (jsdom).
 *
 * Coverage: 4 facade composition (storage+gateway+worker+theme populated) +
 * F11 chain dep tollerante peer optional (permissions absent → facade pass-through
 * silenzioso + warning una volta).
 *
 * @see packages/isolation/src/wrap-context.ts
 */
import { describe, expect, test, vi } from 'vitest'
import { DEFAULT_ISOLATION_POLICY } from '../src/types/policy.js'
import { wrapContextWithIsolation } from '../src/wrap-context.js'

interface PublishedEvent {
  readonly topic: string
  readonly payload: unknown
}

function mockBroker(opts?: { noPermissionService?: boolean }): {
  published: PublishedEvent[]
  publish(topic: string, payload: unknown): void
  getService<T>(key: symbol | string): T | undefined
} {
  const published: PublishedEvent[] = []
  return {
    published,
    publish(topic: string, payload: unknown): void {
      published.push({ topic, payload })
    },
    getService<T>(_key: symbol | string): T | undefined {
      if (opts?.noPermissionService) return undefined
      return {
        check: (): { allowed: boolean; mode: string } => ({
          allowed: true,
          mode: 'enforce',
        }),
      } as unknown as T
    },
  }
}

describe('wrapContextWithIsolation', () => {
  test('4 facade composition — storage + gateway + worker + theme populated', () => {
    const broker = mockBroker()
    const baseCtx = {
      id: 'mf-1',
      broker: { /* mock raw */ } as unknown,
      publish(): void {},
      subscribe(): unknown { return { unsubscribe(): void {} } },
    }
    const wrapped = wrapContextWithIsolation(
      baseCtx,
      'mf-1',
      {
        ...DEFAULT_ISOLATION_POLICY,
        storage: 'namespaced',
        network: 'gateway-only',
      },
      {
        gateway: () => ({ request: vi.fn(async () => ({ ok: true })) }),
        worker: () => ({ run: vi.fn(async () => ({ ok: true })) }),
        theme: () => ({
          getToken: vi.fn((): string | undefined => 'token-val'),
          getRole: vi.fn((): string | undefined => 'role-val'),
          currentTokens: (): Record<string, string> => ({}),
          currentRoles: (): Record<string, string> => ({}),
        }),
      },
      { enabled: true, inherit: false },
      broker,
    )
    // Base ctx fields preservati
    expect(wrapped.id).toBe('mf-1')
    // 4 facade fields populated
    expect(wrapped.storage).toBeDefined()
    expect(wrapped.gateway).toBeDefined()
    expect(wrapped.worker).toBeDefined()
    expect(wrapped.theme).toBeDefined()
    // Storage prefix applied
    wrapped.storage!.setItem('k', 'v')
    expect(window.localStorage.getItem('gz:mf:mf-1:k')).toBe('v')
    window.localStorage.clear()
  })

  test('F11 chain dep tollerante — permissions ASSENTE → pass-through silenzioso (no throw)', async () => {
    const broker = mockBroker({ noPermissionService: true })
    const baseCtx = {
      id: 'mf-1',
      broker: {} as unknown,
      publish(): void {},
      subscribe(): unknown { return { unsubscribe(): void {} } },
    }
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const wrapped = wrapContextWithIsolation(
      baseCtx,
      'mf-1',
      {
        ...DEFAULT_ISOLATION_POLICY,
        storage: 'namespaced',
        network: 'gateway-only',
      },
      {
        gateway: () => ({ request: vi.fn(async () => ({ ok: true })) }),
        worker: () => ({ run: vi.fn(async () => ({ ok: true })) }),
      },
      undefined,
      broker,
    )
    // Gateway invocato senza permissions installato → pass-through (NO throw)
    await expect(wrapped.gateway!.request('users.list')).resolves.toEqual({ ok: true })
    // Warning emitted once per broker (gateway)
    expect(
      consoleWarnSpy.mock.calls.some((call) =>
        String(call[0]).includes('@gluezero/permissions not installed'),
      ),
    ).toBe(true)
    consoleWarnSpy.mockRestore()
  })
})
