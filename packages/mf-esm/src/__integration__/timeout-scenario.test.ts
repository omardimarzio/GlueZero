/**
 * Tier-3 Playwright Chromium — scenario 2 lockato D-V2-F9-13: timeout enforcement
 * + invalid module rich diagnostic.
 *
 * Copre Success Criterion F9:
 * - SC2: Timeout configurabile + invalid module → MF_LOADER_TIMEOUT + FSM `failed`
 *   con `failureReason.phase: 'load'` + rich diagnostic MF_LOADER_INVALID_MODULE.
 *
 * Fixture privati Task 1:
 * - `slow-mf.js`: top-level `await new Promise(r => setTimeout(r, 5000))` → blocca
 *   `import()` per 5000 ms → trigger timeout con `timeoutMs: 100`.
 * - `invalid-mf.js`: `export const foo = 'bar'` senza mount → trigger Strategy 4
 *   fallthrough D-V2-F9-05 → MF_LOADER_INVALID_MODULE.
 *
 * URL pattern: runtime URL build (spike outcome PASS — vedi end-to-end-scenario.test.ts).
 *
 * @see D-V2-F9-13 scenario 2 + D-V2-F9-09 timeout race + D-V2-F9-08 rich diagnostic
 */
import { createBroker, SERVICE_MICROFRONTENDS } from '@gluezero/core'
import {
  microfrontendModule,
  type MicroFrontendsService,
} from '@gluezero/microfrontends'
import { describe, expect, test } from 'vitest'
import { mfEsmModule } from '../mf-esm-module'

function urlFor(name: string): string {
  return new URL(`/${name}`, window.location.origin).href
}

function makeHarness(): {
  broker: ReturnType<typeof createBroker>
  service: MicroFrontendsService
} {
  const broker = createBroker({
    modules: [microfrontendModule(), mfEsmModule()],
  })
  const service = broker.getService<MicroFrontendsService>(SERVICE_MICROFRONTENDS)
  if (!service) throw new Error('SERVICE_MICROFRONTENDS not registered')
  return { broker, service }
}

describe('Tier-3 scenario 2 — timeout + invalid module rich diagnostic', () => {
  test('timeoutMs override → reject MF_LOADER_TIMEOUT + FSM failed + failureReason.phase load', async () => {
    const { service } = makeHarness()
    const slowUrl = urlFor('slow-mf.js')

    await service.register({
      id: 'timeout-mf',
      name: 'Timeout MF',
      version: '1.0.0',
      // Fixture slow-mf.js top-level await 5000 ms — timeoutMs: 100 trigger timeout.
      loader: { type: 'esm', url: slowUrl, timeoutMs: 100 },
    })

    let caught: unknown
    try {
      await service.load('timeout-mf')
      expect.fail('should have thrown MF_LOADER_TIMEOUT')
    } catch (err) {
      caught = err
    }

    expect(caught).toBeDefined()
    const err = caught as { code?: string; details?: Record<string, unknown> }
    expect(err.code).toBe('MF_LOADER_TIMEOUT')
    expect(err.details).toBeDefined()
    expect(err.details?.['url']).toBe(slowUrl)
    expect(err.details?.['timeoutMs']).toBe(100)
    expect(typeof err.details?.['elapsedMs']).toBe('number')
    // elapsedMs deve essere >= 100 (timeout effettivamente scattato).
    expect(err.details?.['elapsedMs'] as number).toBeGreaterThanOrEqual(95)

    // FSM transition a 'failed' con failureReason.phase = 'load' (D-V2-06).
    expect(service.getState('timeout-mf')).toBe('failed')
    const snapshot = service.getSnapshot('timeout-mf')
    expect(snapshot?.failureReason?.phase).toBe('load')
  })

  test('invalid module (no mount hook) → MF_LOADER_INVALID_MODULE + rich diagnostic details', async () => {
    const { service } = makeHarness()
    const invalidUrl = urlFor('invalid-mf.js')

    await service.register({
      id: 'invalid-mf',
      name: 'Invalid MF',
      version: '1.0.0',
      // Fixture invalid-mf.js: export const foo = 'bar' — no mount → Strategy 4 throw.
      loader: { type: 'esm', url: invalidUrl },
    })

    let caught: unknown
    try {
      await service.load('invalid-mf')
      expect.fail('should have thrown MF_LOADER_INVALID_MODULE')
    } catch (err) {
      caught = err
    }

    expect(caught).toBeDefined()
    const err = caught as { code?: string; details?: Record<string, unknown> }
    expect(err.code).toBe('MF_LOADER_INVALID_MODULE')
    // Rich diagnostic details shape D-V2-F9-08.
    expect(err.details).toBeDefined()
    expect(err.details?.['url']).toBe(invalidUrl)
    expect(err.details?.['hasDefault']).toBe(false)
    expect(Array.isArray(err.details?.['defaultKeys'])).toBe(true)
    expect(err.details?.['defaultKeys']).toEqual([])
    expect(Array.isArray(err.details?.['namedKeys'])).toBe(true)
    // namedKeys include 'foo' (l'unico export named non-default).
    expect((err.details?.['namedKeys'] as string[]).includes('foo')).toBe(true)
    expect(typeof err.details?.['reason']).toBe('string')
    expect(err.details?.['reason'] as string).toMatch(/lifecycle|mount/i)

    // FSM failed con failureReason.phase = 'load' (D-V2-06).
    expect(service.getState('invalid-mf')).toBe('failed')
    const snapshot = service.getSnapshot('invalid-mf')
    expect(snapshot?.failureReason?.phase).toBe('load')
  })
})
