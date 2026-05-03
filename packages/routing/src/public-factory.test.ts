// public-factory.test.ts — TDD RED→GREEN per createRouterBroker (Plan 03-12 Task 3).
//
// Coverage: 6 test deterministici (4 originali + 2 revision iter 1):
// - Test 1-4: factory ritorna istanze valide / throw su config invalida
// - Test 5-6: requiresRouteTopics opt-in (BLOCKER 4 fix)

import { describe, expect, it } from 'vitest'
import { createRouterBroker } from './public-factory'
import { RouterBroker } from './router-broker-wrapper'

describe('createRouterBroker (Plan 03-12 Task 3 — public factory + Valibot validation)', () => {
  it('Test 1: createRouterBroker({}) ritorna RouterBroker instance', () => {
    const broker = createRouterBroker({})
    expect(broker).toBeInstanceOf(RouterBroker)
  })

  it('Test 2: createRouterBroker({ routes: [validRoute] }) ritorna instance con route registrata', () => {
    const broker = createRouterBroker({
      routes: [
        {
          id: 'r-test',
          type: 'local',
          topic: 'weather.requested',
        },
      ],
    })
    expect(broker).toBeInstanceOf(RouterBroker)
    // Verify route è registrata: unregister deve ritornare true
    expect(broker.unregisterRoute('r-test')).toBe(true)
  })

  it('Test 3: createRouterBroker({ routes: "invalid" }) → throw Invalid RouterBrokerConfig', () => {
    expect(() => createRouterBroker({ routes: 'invalid' as never })).toThrow(
      /Invalid RouterBrokerConfig/,
    )
  })

  it('Test 4: createRouterBroker({ gateway: { allowlist: [/^\\/api\\//] } }) ritorna instance con gateway', () => {
    const broker = createRouterBroker({
      gateway: { allowlist: ['https://api.example.com'] },
    })
    expect(broker).toBeInstanceOf(RouterBroker)
  })

  it('Test 5 (BLOCKER 4 fix — requiresRouteTopics opt-in): config.routing.requiresRouteTopics accettato dal Valibot schema', () => {
    const broker = createRouterBroker({
      routing: { requiresRouteTopics: ['custom.action.requested'] },
    })
    expect(broker).toBeInstanceOf(RouterBroker)
  })

  it('Test 6 (BLOCKER 4 fix): config.routing.requiresRouteTopics non-array → throw Invalid RouterBrokerConfig', () => {
    expect(() =>
      createRouterBroker({
        routing: { requiresRouteTopics: 'invalid' as never },
      }),
    ).toThrow(/Invalid RouterBrokerConfig/)
  })
})
