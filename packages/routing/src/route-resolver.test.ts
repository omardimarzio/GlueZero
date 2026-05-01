// route-resolver.test.ts — TDD RED→GREEN per RouteResolver (D-64, D-66, D-86).
//
// Coverage: 13 test deterministici per resolver dispatch table + multi-route policy +
// cascade unregisterByOwner.

import { describe, expect, it, vi } from 'vitest'
import { isBrokerError } from '@sembridge/core'
import type { RouteDefinition, RouteHttpDefinition, RouteLocalDefinition } from './types/route-definition'
import {
  type AmbiguousRouteEvent,
  type CompiledRoute,
  RouteResolver,
} from './route-resolver'

// Helper factory: minimal RouteLocalDefinition con id/topic configurabili e priority opzionale.
function localRoute(id: string, topic: string, priority?: number): RouteLocalDefinition {
  const def: { id: string; type: 'local'; topic: string; priority?: number } = {
    id,
    type: 'local',
    topic,
  }
  if (priority !== undefined) def.priority = priority
  return def as RouteLocalDefinition
}

// Helper factory: minimal RouteHttpDefinition per testare pre-curry requestBuilder.
function httpRoute(id: string, topic: string): RouteHttpDefinition {
  return {
    id,
    type: 'http',
    topic,
    request: {
      method: 'GET',
      url: '/api/test',
      queryMap: { city: { source: 'location' } } as never,
    },
    response: { canonical: 'weather' },
  } as RouteHttpDefinition
}

describe('RouteResolver', () => {
  it('Test 1: register(def) con id univoco ritorna RouteRegistration', () => {
    const resolver = new RouteResolver()
    const reg = resolver.register(localRoute('r1', 'weather.requested'))
    expect(reg.id).toBe('r1')
    expect(typeof reg.unregister).toBe('function')
  })

  it('Test 2: register(def) con id duplicato in strict mode → throw BrokerError route.id.duplicate', () => {
    const resolver = new RouteResolver({ strict: true })
    resolver.register(localRoute('r1', 'weather.requested'))
    let caught: unknown
    try {
      resolver.register(localRoute('r1', 'other.topic'))
    } catch (err) {
      caught = err
    }
    expect(caught).toBeDefined()
    expect(isBrokerError(caught)).toBe(true)
    if (isBrokerError(caught)) {
      expect(caught.code).toBe('route.id.duplicate')
      expect(caught.category).toBe('config')
    }
  })

  it('Test 3: register(def) con id duplicato in non-strict (default) → idempotent (no throw)', () => {
    const resolver = new RouteResolver()
    const r1 = resolver.register(localRoute('r1', 'weather.requested'))
    const r2 = resolver.register(localRoute('r1', 'other.topic'))
    expect(r1.id).toBe('r1')
    expect(r2.id).toBe('r1')
    // Resolve `weather.requested` deve trovare la versione originale (non duplicata)
    const matches = resolver.resolve('weather.requested')
    expect(matches.length).toBe(1)
    // Verifica che NON ci siano duplicati (list)
    expect(resolver.list().length).toBe(1)
  })

  it('Test 4: resolve("weather.requested") con 1 route registrata → ritorna [CompiledRoute]', () => {
    const resolver = new RouteResolver()
    resolver.register(localRoute('r1', 'weather.requested'))
    const matches = resolver.resolve('weather.requested')
    expect(matches.length).toBe(1)
    expect(matches[0]?.id).toBe('r1')
    expect(matches[0]?.definition.topic).toBe('weather.requested')
  })

  it('Test 5: resolve("weather.requested") con 0 route → ritorna []', () => {
    const resolver = new RouteResolver()
    const matches = resolver.resolve('weather.requested')
    expect(matches).toEqual([])
  })

  it('Test 6: resolve("weather.alert.failed") con route "weather.*.failed" → match wildcard', () => {
    const resolver = new RouteResolver()
    resolver.register(localRoute('r-wild', 'weather.*.failed'))
    const matches = resolver.resolve('weather.alert.failed')
    expect(matches.length).toBe(1)
    expect(matches[0]?.id).toBe('r-wild')
  })

  it('Test 7: resolve con N=3 route + multipleRoutesPolicy "first-match" → ritorna [primo]', () => {
    const resolver = new RouteResolver()
    resolver.register(localRoute('r1', 'weather.requested'))
    resolver.register(localRoute('r2', 'weather.*'))
    resolver.register(localRoute('r3', '*.requested'))
    const matches = resolver.resolve('weather.requested', 'first-match')
    expect(matches.length).toBe(1)
    // first-match = ordine inserimento nel trie; r1 o uno qualunque ma deve essere uno solo
    expect(['r1', 'r2', 'r3']).toContain(matches[0]?.id)
  })

  it('Test 8: resolve con N=3 route + multipleRoutesPolicy "priority-ordered" → ritorna [priority più alta]', () => {
    const resolver = new RouteResolver()
    resolver.register(localRoute('low', 'weather.requested', 1))
    resolver.register(localRoute('high', 'weather.*', 5))
    resolver.register(localRoute('mid', '*.requested', 3))
    const matches = resolver.resolve('weather.requested', 'priority-ordered')
    expect(matches.length).toBe(1)
    expect(matches[0]?.id).toBe('high')
    expect(matches[0]?.priority).toBe(5)
  })

  it('Test 9: resolve con N=3 route + multipleRoutesPolicy "all" → ritorna [tutte e 3]', () => {
    const resolver = new RouteResolver()
    resolver.register(localRoute('r1', 'weather.requested'))
    resolver.register(localRoute('r2', 'weather.*'))
    resolver.register(localRoute('r3', '*.requested'))
    const matches = resolver.resolve('weather.requested', 'all')
    expect(matches.length).toBe(3)
    const ids = matches.map((m) => m.id).sort()
    expect(ids).toEqual(['r1', 'r2', 'r3'])
  })

  it('Test 10: unregister(routeId) rimuove dal dispatch table', () => {
    const resolver = new RouteResolver()
    resolver.register(localRoute('r1', 'weather.requested'))
    expect(resolver.resolve('weather.requested').length).toBe(1)
    const removed = resolver.unregister('r1')
    expect(removed).toBe(true)
    expect(resolver.resolve('weather.requested')).toEqual([])
    // Re-unregister di un id non esistente → false
    expect(resolver.unregister('r1')).toBe(false)
  })

  it('Test 11: unregisterByOwner(ownerId) rimuove TUTTE le route con quell ownerId', () => {
    const resolver = new RouteResolver()
    resolver.register(localRoute('a1', 'weather.requested'), { ownerId: 'plugin-A' })
    resolver.register(localRoute('a2', 'weather.alert.failed'), { ownerId: 'plugin-A' })
    resolver.register(localRoute('a3', 'auth.login.requested'), { ownerId: 'plugin-A' })
    resolver.register(localRoute('b1', 'forecast.loaded'), { ownerId: 'plugin-B' })

    expect(resolver.countByOwner('plugin-A')).toBe(3)
    expect(resolver.countByOwner('plugin-B')).toBe(1)

    const removed = resolver.unregisterByOwner('plugin-A')
    expect(removed.sort()).toEqual(['a1', 'a2', 'a3'])
    expect(resolver.countByOwner('plugin-A')).toBe(0)
    expect(resolver.countByOwner('plugin-B')).toBe(1)
    // plugin-B intatto
    expect(resolver.resolve('forecast.loaded').length).toBe(1)
    // plugin-A eliminato
    expect(resolver.resolve('weather.requested').length).toBe(0)
  })

  it('Test 12: compile(def) pre-curria requestBuilder per RouteHttpDefinition', () => {
    const resolver = new RouteResolver()
    const reg = resolver.register(httpRoute('http-1', 'weather.requested'))
    expect(reg.id).toBe('http-1')
    const compiled = resolver.resolve('weather.requested')[0] as CompiledRoute
    expect(compiled.requestBuilder).toBeDefined()
    if (compiled.requestBuilder) {
      const req = compiled.requestBuilder({ location: 'Roma' }) as Record<string, unknown>
      expect(req.method).toBe('GET')
      expect(req.url).toBe('/api/test')
      expect(req.queryMap).toBeDefined()
      expect(req.canonical).toEqual({ location: 'Roma' })
    }
    // Route locale → requestBuilder undefined
    resolver.register(localRoute('local-1', 'auth.login.requested'))
    const localCompiled = resolver.resolve('auth.login.requested')[0] as CompiledRoute
    expect(localCompiled.requestBuilder).toBeUndefined()
  })

  it('Test 13: dev mode con N>1 route + "first-match" → emette routing.ambiguous via callback', () => {
    const onAmbiguous = vi.fn<(event: AmbiguousRouteEvent) => void>()
    const resolver = new RouteResolver({ onAmbiguousRoutes: onAmbiguous })
    resolver.register(localRoute('r1', 'weather.requested'))
    resolver.register(localRoute('r2', 'weather.*'))
    const matches = resolver.resolve('weather.requested', 'first-match')
    expect(matches.length).toBe(1)
    expect(onAmbiguous).toHaveBeenCalledTimes(1)
    const event = onAmbiguous.mock.calls[0]?.[0]
    expect(event?.topic).toBe('weather.requested')
    expect(event?.candidateRouteIds.length).toBe(2)
    expect(event?.selectedRouteId).toBe(event?.candidateRouteIds[0])
  })

  it('Test 14: register valida il topic pattern (validateTopicPattern riusato)', () => {
    const resolver = new RouteResolver()
    let caught: unknown
    try {
      // Pattern malformato (uppercase) — F1 validateTopicPattern throw
      resolver.register({ id: 'bad', type: 'local', topic: 'Weather.Requested' } as RouteDefinition)
    } catch (err) {
      caught = err
    }
    expect(caught).toBeDefined()
    expect(isBrokerError(caught)).toBe(true)
    if (isBrokerError(caught)) {
      expect(caught.code).toBe('topic.pattern.invalid')
    }
  })
})
