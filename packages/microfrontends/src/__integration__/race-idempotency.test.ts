/**
 * Tier-3 Playwright Chromium — concurrent lifecycle race idempotency scenario.
 *
 * D-V2-F8-04 minimal targeted (Tier-3 scope): scenario `mount + unmount` concorrenti
 * + cleanup `inFlight` Map verified su browser reale. jsdom non copre tutti gli edge
 * case di async scheduling — Playwright Chromium con `--expose-gc` consente verifica
 * reale + heap snapshot scenario futuro (P-22 mitigation).
 *
 * P-04 mitigation verified:
 * - `inFlight: Map<id, Promise>` garantisce identità stretta della Promise per stesso
 *   op (test: `expect(p1).toBe(p2)`)
 * - Op diverso concorrente -> throw `MF_LIFECYCLE_IN_FLIGHT`
 * - Cleanup naturale via `.finally(inFlight.delete)`: post-resolve nuove chiamate
 *   idempotenti non sollevano IN_FLIGHT
 *
 * Eseguito da: `pnpm --filter @gluezero/microfrontends test:browser`
 * (richiede `pnpm exec playwright install chromium` lato CI / dev).
 *
 * @see D-V2-F8-04 scenario #2 + RESEARCH §6.4 + OQ-13 + PRD §10.5
 */
import { createBroker, SERVICE_MICROFRONTENDS } from '@gluezero/core'
import { expect, test } from 'vitest'
import type { MicroFrontendLoaderAdapter } from '../loader-registry'
import { microfrontendModule } from '../microfrontend-module'
import type { MicroFrontendsService } from '../registry'

function makeChromiumHarness() {
  const broker = createBroker({ modules: [microfrontendModule()] })
  const service = broker.getService<MicroFrontendsService>(SERVICE_MICROFRONTENDS)
  if (!service) throw new Error('SERVICE_MICROFRONTENDS not registered')
  let mountCallCount = 0
  let unmountCallCount = 0
  const mockLoader: MicroFrontendLoaderAdapter = {
    type: 'mock',
    async load() {
      return {
        module: {},
        lifecycle: {
          bootstrap: async () => {},
          mount: async () => {
            mountCallCount++
            await new Promise((r) => setTimeout(r, 5))
          },
          unmount: async () => {
            unmountCallCount++
            await new Promise((r) => setTimeout(r, 5))
          },
          destroy: () => {},
        },
      }
    },
  }
  service.registerLoader(mockLoader)
  return {
    broker,
    service,
    getMountCalls: () => mountCallCount,
    getUnmountCalls: () => unmountCallCount,
  }
}

test('Tier-3: concurrent same-op mount returns same Promise (strict identity P-04)', async () => {
  const { service, getMountCalls } = makeChromiumHarness()
  await service.register({
    id: 'race-test',
    name: 'Race',
    version: '1.0.0',
    loader: { type: 'mock' },
  })
  await service.load('race-test')

  // 10 concurrent mount calls — should all share the same Promise (P-04 strict identity).
  const promises = Array.from({ length: 10 }, () => service.mount('race-test'))
  const firstPromise = promises[0]
  for (const p of promises) {
    expect(p).toBe(firstPromise) // strict identity (P-04)
  }
  await Promise.all(promises)

  // mount hook chiamato esattamente UNA volta nonostante 10 chiamate concorrenti.
  expect(getMountCalls()).toBe(1)
  expect(service.getState('race-test')).toBe('mounted')
})

test('Tier-3: concurrent different-op throws MF_LIFECYCLE_IN_FLIGHT', async () => {
  const { service } = makeChromiumHarness()
  await service.register({
    id: 'race-test-2',
    name: 'Race2',
    version: '1.0.0',
    loader: { type: 'mock' },
  })
  await service.load('race-test-2')

  // Avvia mount (slow per garantire op in-flight).
  const mountP = service.mount('race-test-2')

  // Concurrent unmount durante mount in-flight → throw sync MF_LIFECYCLE_IN_FLIGHT.
  let caught: unknown
  try {
    service.unmount('race-test-2')
    expect.fail('should have thrown MF_LIFECYCLE_IN_FLIGHT')
  } catch (err) {
    caught = err
  }
  expect((caught as { code: string }).code).toBe('MF_LIFECYCLE_IN_FLIGHT')

  await mountP // cleanup
  expect(service.getState('race-test-2')).toBe('mounted')
})

test('Tier-3: inFlight cleanup naturale Promise resolve (no leak)', async () => {
  const { service, getMountCalls } = makeChromiumHarness()
  await service.register({
    id: 'race-test-3',
    name: 'Race3',
    version: '1.0.0',
    loader: { type: 'mock' },
  })
  await service.load('race-test-3')
  await service.mount('race-test-3')

  // Dopo mount completion, una nuova chiamata mount è no-op (idempotent).
  // Verifica che inFlight Map sia stata pulita (NON throw IN_FLIGHT).
  await service.mount('race-test-3') // no-op, but accepted
  expect(service.getState('race-test-3')).toBe('mounted')
  // mount hook chiamato SOLO una volta (la prima); il no-op idempotent non lo invoca.
  expect(getMountCalls()).toBe(1)

  // Cycle completo OK: unmount + destroy senza IN_FLIGHT leak.
  await service.unmount('race-test-3')
  await service.destroy('race-test-3')
  expect(service.getState('race-test-3')).toBe('destroyed')
})
