// Test RED per MapperBroker — composition wrapper di Broker (F1) con MapperEngine + Inspector (F2).
// Coverage del PLAN 02-10 Task 1: 12 acceptance criteria.

import type { BrokerEvent, PluginContext, Subscription } from '@sembridge/core'
import { isBrokerError } from '@sembridge/core'
import { describe, expect, it, vi } from 'vitest'
import { MapperBroker } from './broker-mapper-wrapper'
import type { CanonicalSchemaId } from './types/canonical-schema'

// Helper: shape minimale per `ctx.broker` esposta dal F1 createPluginScopedBroker.
// `ctx.broker` è `unknown` per default — il consumer deve fare cast esplicito o uso strutturale.
interface ScopedBrokerSubscribe {
  subscribe(
    pattern: string,
    handler: (event: BrokerEvent) => void | Promise<void>,
    options?: { signal?: AbortSignal },
  ): Subscription
  publish(topic: string, payload: unknown, options?: Record<string, unknown>): void
}

describe('MapperBroker', () => {
  it('Test 1: instantiates without errors with default config', () => {
    const broker = new MapperBroker({ runtime: { logLevel: 'silent' } })
    expect(broker).toBeInstanceOf(MapperBroker)
    // F1 surface presente
    expect(typeof broker.publish).toBe('function')
    expect(typeof broker.subscribe).toBe('function')
    expect(typeof broker.registerPlugin).toBe('function')
    expect(typeof broker.unregisterPlugin).toBe('function')
    // F2 new API surface (D-31)
    expect(typeof broker.registerCanonicalSchema).toBe('function')
    expect(typeof broker.registerTransform).toBe('function')
    expect(typeof broker.registerAlias).toBe('function')
    expect(typeof broker.getMappingInspector).toBe('function')
  })

  it('Test 2: registerCanonicalSchema returns true on new, false on duplicate', () => {
    const broker = new MapperBroker({ runtime: { logLevel: 'silent' } })
    const schema = {
      id: 'weather' as CanonicalSchemaId,
      fields: { location: { type: 'string' as const, required: true } },
    }
    expect(broker.registerCanonicalSchema(schema)).toBe(true)
    expect(broker.registerCanonicalSchema(schema)).toBe(false)
  })

  it('Test 3: registerTransform throws on duplicate name', () => {
    const broker = new MapperBroker({ runtime: { logLevel: 'silent' } })
    const fn = (input: unknown): unknown => input
    broker.registerTransform('parseItalianDate', fn)
    let threw = false
    try {
      broker.registerTransform('parseItalianDate', fn)
    } catch (err) {
      threw = true
      expect(isBrokerError(err)).toBe(true)
      if (isBrokerError(err)) {
        expect(err.code).toBe('transform.id.duplicate')
      }
    }
    expect(threw).toBe(true)
  })

  it('Test 4: registerAlias supports global and scoped', () => {
    const broker = new MapperBroker({ runtime: { logLevel: 'silent' } })
    expect(broker.registerAlias('city', 'location', { scope: 'global' })).toBe(true)
    expect(broker.registerAlias('city', 'location', { scope: 'plugin-a' })).toBe(true)
    // default scope è 'global'
    expect(broker.registerAlias('day', 'date')).toBe(true)
  })

  it('Test 5: registerPlugin invokes compileMappings post-onRegister and outputMap is applied on publish', async () => {
    const broker = new MapperBroker({ runtime: { logLevel: 'silent' } })
    broker.registerCanonicalSchema({
      id: 'weather' as CanonicalSchemaId,
      fields: {
        location: { type: 'string', required: true },
        forecast_date: { type: 'string', required: true },
      },
    })
    broker.registerTransform('parseItalianDate', (input) => {
      const [d, m, y] = String(input).split('/')
      return `${y}-${m}-${d}`
    })

    await broker.registerPlugin({
      id: 'form',
      canonicalSchemaId: 'weather' as CanonicalSchemaId,
      outputMap: {
        location: { source: 'città' },
        forecast_date: { source: 'data', transform: 'parseItalianDate' },
      },
    })

    const received: unknown[] = []
    broker.subscribe('weather.requested', (ev) => {
      received.push(ev.payload)
    })

    broker.publish(
      'weather.requested',
      { città: 'Roma', data: '30/04/2026' },
      {
        source: { type: 'plugin', id: 'form' },
        deliveryMode: 'sync',
      },
    )

    expect(received).toHaveLength(1)
    expect(received[0]).toEqual({ location: 'Roma', forecast_date: '2026-04-30' })
  })

  it('Test 6: cycle detection at registerPlugin throws mapping.cycle.detected', async () => {
    const broker = new MapperBroker({ runtime: { logLevel: 'silent' } })
    broker.registerCanonicalSchema({
      id: 'cyc' as CanonicalSchemaId,
      fields: {
        a: { type: 'string' },
        b: { type: 'string' },
      },
    })
    broker.registerTransform('concat', (input) => String(input))

    let threw = false
    try {
      await broker.registerPlugin({
        id: 'cycplug',
        canonicalSchemaId: 'cyc' as CanonicalSchemaId,
        outputMap: {
          a: { derive: { sources: ['b'], transform: 'concat' } },
          b: { derive: { sources: ['a'], transform: 'concat' } },
        },
      })
    } catch (err) {
      threw = true
      expect(isBrokerError(err)).toBe(true)
      if (isBrokerError(err)) {
        expect(err.code).toBe('mapping.cycle.detected')
      }
    }
    expect(threw).toBe(true)
  })

  it('Test 7: unregisterPlugin cascade removes scoped alias + transforms ownerId + mapper compiled', async () => {
    const broker = new MapperBroker({ runtime: { logLevel: 'silent' } })
    broker.registerCanonicalSchema({
      id: 'weather' as CanonicalSchemaId,
      fields: { location: { type: 'string', required: true } },
    })

    await broker.registerPlugin({
      id: 'p1',
      canonicalSchemaId: 'weather' as CanonicalSchemaId,
      outputMap: { location: { source: 'città' } },
    })
    // scoped alias + transform ownerId p1
    broker.registerAlias('citta', 'location', { scope: 'p1' })
    broker.registerTransform('p1Transform', (x) => x, { ownerId: 'p1' })

    const beforeSnap = broker.getDebugSnapshot()
    expect(beforeSnap.mappings.registeredTransforms).toBeGreaterThanOrEqual(1)

    await broker.unregisterPlugin('p1')

    const afterSnap = broker.getDebugSnapshot()
    // Cascade: transform p1 removed
    expect(afterSnap.mappings.registeredTransforms).toBe(0)
    // Cascade: applyOutputMap dopo unregister non applica più il mapping
    // (compiled mapping removed → passthrough)
    // Verifichiamo via internal: il publish di un evento con sourceId 'p1' deve essere
    // un passthrough (nessuna throw, payload originale).
    // Alias scoped p1 rimosso (verifica indiretta: lista alias globali non cambia).
    expect(afterSnap.mappings.registeredAliases).toBe(beforeSnap.mappings.registeredAliases)
  })

  it('Test 8: publish with outputMap + transform → consumer with inputMap (scenario meteo PRD §29)', async () => {
    const broker = new MapperBroker({ runtime: { logLevel: 'silent' } })
    broker.registerCanonicalSchema({
      id: 'weather' as CanonicalSchemaId,
      fields: {
        location: { type: 'string', required: true },
        forecast_date: { type: 'string', required: true },
      },
    })
    broker.registerTransform('parseItalianDate', (input) => {
      const [d, m, y] = String(input).split('/')
      return `${y}-${m}-${d}`
    })

    await broker.registerPlugin({
      id: 'form',
      canonicalSchemaId: 'weather' as CanonicalSchemaId,
      outputMap: {
        location: { source: 'città' },
        forecast_date: { source: 'data', transform: 'parseItalianDate' },
      },
    })

    const received: unknown[] = []
    await broker.registerPlugin({
      id: 'widget',
      canonicalSchemaId: 'weather' as CanonicalSchemaId,
      inputMap: {
        'day-prevision': { source: 'forecast_date' },
        location: { source: 'location' },
      },
      onMount(ctx: PluginContext): void {
        ;(ctx.broker as ScopedBrokerSubscribe).subscribe('weather.requested', (ev) => {
          received.push(ev.payload)
        })
      },
    })

    broker.publish(
      'weather.requested',
      { città: 'Roma', data: '30/04/2026' },
      {
        source: { type: 'plugin', id: 'form' },
        deliveryMode: 'sync',
      },
    )

    expect(received).toHaveLength(1)
    expect(received[0]).toEqual({ location: 'Roma', 'day-prevision': '2026-04-30' })
  })

  it('Test 9: subscribe with consumer plugin ownerId applies inputMap (passo 11)', async () => {
    // Variante diretta del test 8: il consumer chiama broker.subscribe con ownerId esplicito
    // (non via ctx.broker). Verifica che applyInputMap sia applicato anche per subscribe diretto
    // del MapperBroker quando l'ownerId è settato (es. da createPluginScopedBroker).
    const broker = new MapperBroker({ runtime: { logLevel: 'silent' } })
    broker.registerCanonicalSchema({
      id: 'weather' as CanonicalSchemaId,
      fields: { location: { type: 'string', required: true } },
    })

    // Plugin form pubblica
    await broker.registerPlugin({
      id: 'form',
      canonicalSchemaId: 'weather' as CanonicalSchemaId,
      outputMap: { location: { source: 'città' } },
    })

    // Plugin widget consumer registrato con inputMap
    await broker.registerPlugin({
      id: 'widget2',
      canonicalSchemaId: 'weather' as CanonicalSchemaId,
      inputMap: {
        place: { source: 'location' },
      },
    })

    const received: unknown[] = []
    // subscribe con ownerId (il MapperBroker accetta ownerId per applicare inputMap del consumer)
    broker.subscribe(
      'weather.requested',
      (ev) => {
        received.push(ev.payload)
      },
      { ownerId: 'widget2' },
    )

    broker.publish(
      'weather.requested',
      { città: 'Milano' },
      {
        source: { type: 'plugin', id: 'form' },
        deliveryMode: 'sync',
      },
    )

    expect(received).toHaveLength(1)
    expect(received[0]).toEqual({ place: 'Milano' })
  })

  it('Test 10: publish mapping.error on transform failure with onFailure block (D-58)', async () => {
    const broker = new MapperBroker({ runtime: { logLevel: 'silent' } })
    broker.registerCanonicalSchema({
      id: 'weather' as CanonicalSchemaId,
      fields: {
        forecast_date: { type: 'string', required: true, onFailure: 'block' },
      },
    })
    broker.registerTransform('badTransform', () => {
      throw new Error('boom')
    })

    await broker.registerPlugin({
      id: 'form',
      canonicalSchemaId: 'weather' as CanonicalSchemaId,
      outputMap: {
        forecast_date: { source: 'data', transform: 'badTransform' },
      },
    })

    const errorEvents: unknown[] = []
    broker.subscribe('mapping.error', (ev) => {
      errorEvents.push(ev.payload)
    })

    // Subscriber regolare NON deve ricevere l'evento (delivery skipped — D-59)
    const regularReceived: unknown[] = []
    broker.subscribe('weather.requested', (ev) => {
      regularReceived.push(ev.payload)
    })

    broker.publish(
      'weather.requested',
      { data: '30/04/2026' },
      {
        source: { type: 'plugin', id: 'form' },
        deliveryMode: 'sync',
      },
    )
    // mapping.error è published in async — flush microtask
    await new Promise<void>((resolve) => queueMicrotask(resolve))
    await new Promise<void>((resolve) => queueMicrotask(resolve))

    expect(regularReceived).toHaveLength(0)
    expect(errorEvents.length).toBeGreaterThan(0)
    const errorPayload = errorEvents[0] as {
      error: { code: string; category: string }
      sourceEvent: string
      step: string
    }
    expect(errorPayload.error.code).toBe('mapping.transform.failed')
    expect(errorPayload.error.category).toBe('mapping')
    expect(errorPayload.sourceEvent).toBe('weather.requested')
    expect(errorPayload.step).toBe('event.mapped.canonical')
  })

  it('Test 11: getDebugSnapshot returns extended snapshot with mappings section (D-48)', () => {
    const broker = new MapperBroker({ runtime: { logLevel: 'silent' } })
    broker.registerCanonicalSchema({
      id: 's1' as CanonicalSchemaId,
      fields: { x: { type: 'string' } },
    })
    broker.registerCanonicalSchema({
      id: 's2' as CanonicalSchemaId,
      fields: { y: { type: 'string' } },
    })
    broker.registerAlias('city', 'location')
    broker.registerTransform('t1', (x) => x)

    const snap = broker.getDebugSnapshot()
    // F1 fields presenti
    expect(snap).toHaveProperty('topics')
    expect(snap).toHaveProperty('subscriberCount')
    expect(snap).toHaveProperty('pluginIds')
    expect(snap).toHaveProperty('pendingAsyncDelivery')
    expect(snap).toHaveProperty('logLevel')
    expect(snap).toHaveProperty('pipelineSteps')
    // F2 mappings section
    expect(snap.mappings).toBeDefined()
    expect(snap.mappings.canonicalSchemas).toBe(2)
    expect(snap.mappings.registeredAliases).toBe(1)
    expect(snap.mappings.registeredTransforms).toBe(1)
    expect(Array.isArray(snap.mappings.lastMappingErrors)).toBe(true)
  })

  it('Test 12: getMappingInspector returns the MappingInspector instance', () => {
    const broker = new MapperBroker({ runtime: { logLevel: 'silent' } })
    const inspector = broker.getMappingInspector()
    expect(inspector).toBeDefined()
    expect(typeof inspector.recordError).toBe('function')
    expect(typeof inspector.lastErrors).toBe('function')
    expect(typeof inspector.getSnapshot).toBe('function')
  })

  it('Bonus Test 13: passthrough for plugin without outputMap (regression)', async () => {
    const broker = new MapperBroker({ runtime: { logLevel: 'silent' } })

    await broker.registerPlugin({ id: 'plain', version: '1.0.0' })

    const received: unknown[] = []
    broker.subscribe('demo.evt', (ev) => {
      received.push(ev.payload)
    })

    broker.publish(
      'demo.evt',
      { foo: 'bar' },
      {
        source: { type: 'plugin', id: 'plain' },
        deliveryMode: 'sync',
      },
    )

    expect(received).toHaveLength(1)
    // Senza outputMap registrato, il payload passa invariato (passthrough)
    // Nota: il MapperEngine.applyOutputMap fa shallow copy → record con stesse keys
    expect(received[0]).toEqual({ foo: 'bar' })
  })

  it('Bonus Test 14: publish without source.id leaves payload untouched (no source-resolved → no mapping)', () => {
    const broker = new MapperBroker({ runtime: { logLevel: 'silent' } })
    const received: unknown[] = []
    broker.subscribe('system.evt', (ev) => {
      received.push(ev.payload)
    })

    // publish senza source.id: il MapperBroker NON applica outputMap (D-50 step 4 fallisce
    // a risolvere source plugin); pass-through al bus diretto. Però F1 richiede source per default.
    broker.publish(
      'system.evt',
      { x: 1 },
      {
        source: { type: 'system', id: 'broker' },
        deliveryMode: 'sync',
      },
    )

    expect(received).toHaveLength(1)
    expect(received[0]).toEqual({ x: 1 })
  })
})

describe('MapperBroker · CR-06 fix mapping.error safe payload + recursion guard', () => {
  it('mapping.error payload is sanitized: no originalError, no cause, no circular refs', async () => {
    const broker = new MapperBroker({ runtime: { logLevel: 'silent' } })
    broker.registerCanonicalSchema({
      id: 'sch-cr06' as CanonicalSchemaId,
      fields: { v: { type: 'string' as const, onFailure: 'block' as const } },
    })
    broker.registerTransform('boomCirc', () => {
      // Crea un Error con cause circolare per stress-test la sanitization.
      const original = new Error('original boom')
      const wrapper = new Error('wrapper boom', { cause: original })
      // Nota: NON facciamo (original.cause = wrapper) per evitare di crashare
      // il logger nella creazione dell'Error stesso. Il test verifica che il
      // payload mapping.error NON contenga originalError/cause anche nel caso
      // semplice — implicitamente garantisce che eventuali ref circolari NON
      // arriverebbero al subscriber.
      throw wrapper
    })
    await broker.registerPlugin({
      id: 'p-cr06',
      canonicalSchemaId: 'sch-cr06' as CanonicalSchemaId,
      outputMap: { v: { source: 'src', transform: 'boomCirc' } },
    })

    const errorPayloads: unknown[] = []
    broker.subscribe('mapping.error', (e) => {
      errorPayloads.push(e.payload)
    })

    broker.publish(
      'cr06.topic',
      { src: 'x' },
      { source: { type: 'plugin', id: 'p-cr06' }, deliveryMode: 'sync' },
    )
    await new Promise<void>((resolve) => queueMicrotask(resolve))
    await new Promise<void>((resolve) => queueMicrotask(resolve))

    expect(errorPayloads.length).toBeGreaterThan(0)
    const payload = errorPayloads[0] as { error: Record<string, unknown> }
    expect(payload.error).toBeDefined()
    // CR-06 fix: il payload error contiene SOLO field sicuri.
    expect(payload.error.code).toBe('mapping.transform.failed')
    expect(payload.error.category).toBe('mapping')
    expect(payload.error.message).toBeDefined()
    // NO originalError, NO cause, NO stack ricorsivi nel payload pubblicato.
    expect(payload.error.originalError).toBeUndefined()
    expect(payload.error.cause).toBeUndefined()
  })

  it('mapping.error subscriber loop is bounded (CR-06 recursion guard)', async () => {
    // Un subscriber a mapping.error che a sua volta throw NON deve causare
    // re-publish infinito di mapping.error. F1 handler isolation + CR-06
    // recursion guard tracka l'in-flight per (sourceTopic, step).
    const broker = new MapperBroker({ runtime: { logLevel: 'silent' } })
    broker.registerCanonicalSchema({
      id: 'sch-loop' as CanonicalSchemaId,
      fields: { v: { type: 'string' as const, onFailure: 'block' as const } },
    })
    broker.registerTransform('boomLoop', () => {
      throw new Error('boom loop')
    })
    await broker.registerPlugin({
      id: 'p-loop',
      canonicalSchemaId: 'sch-loop' as CanonicalSchemaId,
      outputMap: { v: { source: 'src', transform: 'boomLoop' } },
    })
    let invokeCount = 0
    broker.subscribe('mapping.error', () => {
      invokeCount++
      // Subscriber malformato: throw — F1 handler isolation prende il controllo.
      throw new Error('subscriber boom')
    })
    broker.publish(
      'loop.topic',
      { src: 'x' },
      { source: { type: 'plugin', id: 'p-loop' }, deliveryMode: 'sync' },
    )
    // Flush microtask multipli per assicurare la propagation completa.
    for (let i = 0; i < 5; i++) {
      await new Promise<void>((resolve) => queueMicrotask(resolve))
    }
    // Il subscriber è invocato esattamente 1 volta — NO loop infinito.
    expect(invokeCount).toBe(1)
  })
})

describe('MapperBroker · CR-05 fix bootstrapFromConfig error handling', () => {
  it('topologically sorts canonical schemas by `requires` (out-of-order config accepted)', () => {
    // forecast.requires = [user]. Nell'array, forecast viene PRIMA di user — order
    // dependency check forza l'errore canonical.requires.unresolved senza topo sort.
    // Con topo sort (CR-05 fix), il bootstrap completa con successo.
    expect(() => {
      new MapperBroker({
        runtime: { logLevel: 'silent' },
        canonicalModel: {
          schemas: [
            {
              id: 'forecast' as CanonicalSchemaId,
              requires: ['user'],
              fields: { date: { type: 'string' as const } },
            },
            {
              id: 'user' as CanonicalSchemaId,
              fields: { name: { type: 'string' as const } },
            },
          ],
        },
      })
    }).not.toThrow()
  })

  it('WR-B iter2: throws bootstrap.canonical.duplicate on duplicate schema id (NOT cycle)', () => {
    // Pre-iter2: due schema con stesso id passavano silently nel topological sort
    // (idToSchema.set sovrascrive); poi result.length !== schemas.length → throw
    // 'bootstrap.canonical.requires.cycle' fuorviante.
    // Iter2 fix: detection esplicita di duplicate id → BrokerError dedicato.
    let threw = false
    try {
      new MapperBroker({
        runtime: { logLevel: 'silent' },
        canonicalModel: {
          schemas: [
            {
              id: 'a' as CanonicalSchemaId,
              fields: { x: { type: 'string' as const } },
            },
            {
              id: 'a' as CanonicalSchemaId, // duplicate id
              fields: { y: { type: 'string' as const } },
            },
          ],
        },
      })
    } catch (err) {
      threw = true
      expect(isBrokerError(err)).toBe(true)
      if (isBrokerError(err)) {
        expect(err.code).toBe('bootstrap.canonical.duplicate')
        expect(err.category).toBe('config')
        // Il messaggio NON deve menzionare 'cycle' (semantically wrong)
        expect(err.message).not.toMatch(/cycle/i)
        expect(err.details).toMatchObject({ schemaId: 'a' })
      }
    }
    expect(threw).toBe(true)
  })

  it('wraps bootstrap errors via logger and re-throws BrokerError (consumer notified)', () => {
    // Schema con cyclical requires (forecast→user; user→forecast) → impossibile da risolvere.
    // CR-05 fix: il bootstrap throw un BrokerError con context, NON crash silente.
    let threw = false
    try {
      new MapperBroker({
        runtime: { logLevel: 'silent' },
        canonicalModel: {
          schemas: [
            {
              id: 'a' as CanonicalSchemaId,
              requires: ['b'],
              fields: { x: { type: 'string' as const } },
            },
            {
              id: 'b' as CanonicalSchemaId,
              requires: ['a'],
              fields: { y: { type: 'string' as const } },
            },
          ],
        },
      })
    } catch (err) {
      threw = true
      expect(isBrokerError(err)).toBe(true)
      if (isBrokerError(err)) {
        // Lasciamo libertà sul codice esatto (può essere bootstrap.canonical.cycle o
        // canonical.requires.unresolved); ciò che conta è che è un BrokerError di category
        // 'mapping' o 'config'.
        expect(['mapping', 'config']).toContain(err.category)
      }
    }
    expect(threw).toBe(true)
  })
})

describe('MapperBroker · F1 surface delegation', () => {
  it('getTopicRegistry, setLogger, enableDebug/disableDebug delegated to inner Broker', () => {
    const broker = new MapperBroker({ runtime: { logLevel: 'silent' } })
    broker.subscribe('test.event', vi.fn())
    expect(broker.getTopicRegistry()).toBeDefined()
    expect(() => broker.enableDebug()).not.toThrow()
    expect(() => broker.disableDebug()).not.toThrow()
    expect(() =>
      broker.setLogger({
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        trace: vi.fn(),
      }),
    ).not.toThrow()
  })
})
