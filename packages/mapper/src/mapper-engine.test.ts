// Test TDD per MapperEngine (plan 02-07 — chiude PRD §39 #1, #3 a runtime).
//
// Coverage 3 chunk:
// - Chunk A (Test 1-10): rename / nested / default / partial / required (D-40, D-42 chiude VAL-08)
// - Chunk B (Test 11-19): transform / unit normalization / derive / onFailure (D-44 — chiude VAL-09 a runtime mapper)
// - Chunk C (Test 20-26): cycle detection / validation / cascade unregister (D-35, D-26 ext F2, D-39)
//
// Pattern replicato da packages/core/src/core/bus.test.ts (harness setup, vi.fn handler, expect toEqual / toThrow).

import { isBrokerError, silentLogger } from '@sembridge/core'
import { describe, expect, it } from 'vitest'
import { AliasRegistry } from './alias-registry'
import { CanonicalRegistry } from './canonical-registry'
import { MapperEngine, type MapperPluginDescriptor } from './mapper-engine'
import { TransformPipeline } from './transform-pipeline'
import type { CanonicalSchema, CanonicalSchemaId } from './types/canonical-schema'
import { valibotAdapter } from './valibot-adapter'

interface EngineHarness {
  readonly engine: MapperEngine
  readonly canonical: CanonicalRegistry
  readonly alias: AliasRegistry
  readonly transform: TransformPipeline
}

const makeEngine = (): EngineHarness => {
  const canonical = new CanonicalRegistry()
  const alias = new AliasRegistry()
  const transform = new TransformPipeline()
  const engine = new MapperEngine({
    canonicalRegistry: canonical,
    aliasRegistry: alias,
    transformPipeline: transform,
    validator: valibotAdapter,
    logger: silentLogger,
  })
  return { engine, canonical, alias, transform }
}

const weatherSchema: CanonicalSchema = {
  id: 'weather' as CanonicalSchemaId,
  fields: {
    location: { type: 'string', required: true },
    forecast_date: { type: 'string', required: false },
    urgency: { type: 'string', required: false },
    temperature_celsius: { type: 'number', required: false, onFailure: 'skip' },
  },
}

describe('MapperEngine — chunk A: rename / nested / default / partial / required', () => {
  it('Test 1: MAP-04 rename — outputMap { location: { source: "città" } } produces { location: "Roma" } (partial)', () => {
    const { engine, canonical } = makeEngine()
    canonical.register(weatherSchema)
    const desc: MapperPluginDescriptor = {
      id: 'p-rename',
      canonicalSchemaId: 'weather' as CanonicalSchemaId,
      outputMap: { location: { source: 'città' } },
    }
    engine.compileMappings(desc)
    expect(engine.applyOutputMap(desc.id, { città: 'Roma', other: 'x' })).toEqual({
      location: 'Roma',
    })
  })

  it('Test 2: MAP-05 nested — dot-path source resolves nested value', () => {
    const { engine, canonical } = makeEngine()
    canonical.register(weatherSchema)
    const desc: MapperPluginDescriptor = {
      id: 'p-nested',
      canonicalSchemaId: 'weather' as CanonicalSchemaId,
      outputMap: { location: { source: 'address.city' } },
    }
    engine.compileMappings(desc)
    expect(engine.applyOutputMap(desc.id, { address: { city: 'Roma' } })).toEqual({
      location: 'Roma',
    })
  })

  it('Test 3: MAP-05 nested missing required → throws mapping.field.missing (D-42, VAL-08)', () => {
    const { engine, canonical } = makeEngine()
    canonical.register(weatherSchema)
    const desc: MapperPluginDescriptor = {
      id: 'p-nested-missing',
      canonicalSchemaId: 'weather' as CanonicalSchemaId,
      outputMap: { location: { source: 'address.city' } },
    }
    engine.compileMappings(desc)
    let caught: unknown
    try {
      engine.applyOutputMap(desc.id, { address: {} })
    } catch (e) {
      caught = e
    }
    expect(isBrokerError(caught)).toBe(true)
    expect((caught as { code: string }).code).toBe('mapping.field.missing')
    expect((caught as { details: Record<string, unknown> }).details.pluginId).toBe(
      'p-nested-missing',
    )
    expect((caught as { details: Record<string, unknown> }).details.fieldName).toBe('location')
  })

  it('Test 4: MAP-06 default — { urgency: { default: "normal" } } applies on missing payload', () => {
    const { engine, canonical } = makeEngine()
    canonical.register(weatherSchema)
    const desc: MapperPluginDescriptor = {
      id: 'p-default',
      canonicalSchemaId: 'weather' as CanonicalSchemaId,
      outputMap: {
        location: { source: 'città' },
        urgency: { default: 'normal' },
      },
    }
    engine.compileMappings(desc)
    expect(engine.applyOutputMap(desc.id, { città: 'Roma' })).toEqual({
      location: 'Roma',
      urgency: 'normal',
    })
  })

  it('Test 5: MAP-06 default override — source value wins over default when present', () => {
    const { engine, canonical } = makeEngine()
    canonical.register(weatherSchema)
    const desc: MapperPluginDescriptor = {
      id: 'p-default-override',
      canonicalSchemaId: 'weather' as CanonicalSchemaId,
      outputMap: {
        location: { source: 'città' },
        urgency: { source: 'urgenza', default: 'normal' },
      },
    }
    engine.compileMappings(desc)
    expect(engine.applyOutputMap(desc.id, { città: 'Roma', urgenza: 'high' })).toEqual({
      location: 'Roma',
      urgency: 'high',
    })
  })

  it('Test 6: MAP-10 partial — only declared fields appear in canonical', () => {
    const { engine, canonical } = makeEngine()
    canonical.register(weatherSchema)
    const desc: MapperPluginDescriptor = {
      id: 'p-partial',
      canonicalSchemaId: 'weather' as CanonicalSchemaId,
      outputMap: { location: { source: 'città' } },
    }
    engine.compileMappings(desc)
    const result = engine.applyOutputMap(desc.id, {
      città: 'Roma',
      data: '30/04/2026',
      urgenza: 'high',
      temp: '22°C',
      extra: 'noise',
    })
    expect(result).toEqual({ location: 'Roma' })
    expect(Object.keys(result)).toEqual(['location'])
  })

  it('Test 7: D-42 required:true missing → throws mapping.field.missing (closes PRD §39 #3, VAL-08)', () => {
    const { engine, canonical } = makeEngine()
    canonical.register(weatherSchema)
    const desc: MapperPluginDescriptor = {
      id: 'p-required-missing',
      canonicalSchemaId: 'weather' as CanonicalSchemaId,
      outputMap: { location: { source: 'città' } },
    }
    engine.compileMappings(desc)
    let caught: unknown
    try {
      engine.applyOutputMap(desc.id, { other: 'x' })
    } catch (e) {
      caught = e
    }
    expect(isBrokerError(caught)).toBe(true)
    expect((caught as { code: string }).code).toBe('mapping.field.missing')
    const details = (caught as { details: Record<string, unknown> }).details
    expect(details.pluginId).toBe('p-required-missing')
    expect(details.fieldName).toBe('location')
  })

  it('Test 8: D-42 required:false + no default + missing → field omitted (exactOptionalPropertyTypes)', () => {
    const { engine, canonical } = makeEngine()
    canonical.register(weatherSchema)
    const desc: MapperPluginDescriptor = {
      id: 'p-optional-missing',
      canonicalSchemaId: 'weather' as CanonicalSchemaId,
      outputMap: {
        location: { source: 'città' },
        urgency: { source: 'urgenza' },
      },
    }
    engine.compileMappings(desc)
    const result = engine.applyOutputMap(desc.id, { città: 'Roma' })
    expect(result).toEqual({ location: 'Roma' })
    expect('urgency' in result).toBe(false)
  })

  it('Test 9: D-40 / MAP-17 — explicit mapping wins over auto-alias (closes PRD §39 #1)', () => {
    const { engine, canonical, alias } = makeEngine()
    canonical.register(weatherSchema)
    // Auto-alias would map "city" → "place" if explicit mapping is absent.
    alias.registerGlobal('city', 'place')
    const desc: MapperPluginDescriptor = {
      id: 'p-explicit-wins',
      canonicalSchemaId: 'weather' as CanonicalSchemaId,
      // Explicit mapping: "city" payload field becomes canonical "location" (NOT "place").
      outputMap: { location: { source: 'city' } },
    }
    engine.compileMappings(desc)
    const result = engine.applyOutputMap(desc.id, { city: 'Roma' })
    expect(result).toEqual({ location: 'Roma' })
    expect('place' in result).toBe(false)
  })

  it('Test 9b: CR-02 fix — global alias is applied at runtime when no explicit mapping exists (D-40 livello 3)', () => {
    const { engine, canonical, alias } = makeEngine()
    canonical.register({
      id: 'sch9b' as CanonicalSchemaId,
      fields: { location: { type: 'string', required: false } },
    })
    // Alias globale: city → location. NESSUN outputMap esplicito su location.
    alias.registerGlobal('city', 'location')
    const desc: MapperPluginDescriptor = {
      id: 'p-alias-runtime',
      canonicalSchemaId: 'sch9b' as CanonicalSchemaId,
      // outputMap vuoto → il mapper deve consultare alias registry per i payload field.
    }
    engine.compileMappings(desc)
    const result = engine.applyOutputMap(desc.id, { city: 'Roma' })
    // L'alias deve essere applicato a runtime: 'city' (locale) → 'location' (canonical).
    expect(result).toEqual({ location: 'Roma' })
  })

  it('Test 9c: CR-02 fix — scoped alias wins over global alias at runtime (D-40 livelli 2 vs 3)', () => {
    const { engine, canonical, alias } = makeEngine()
    canonical.register({
      id: 'sch9c' as CanonicalSchemaId,
      fields: {
        place: { type: 'string', required: false },
        location: { type: 'string', required: false },
      },
    })
    alias.registerGlobal('city', 'location')
    alias.registerScoped('p-scoped', 'city', 'place')
    const desc: MapperPluginDescriptor = {
      id: 'p-scoped',
      canonicalSchemaId: 'sch9c' as CanonicalSchemaId,
    }
    engine.compileMappings(desc)
    const result = engine.applyOutputMap(desc.id, { city: 'Milano' })
    // Scoped vince su global (D-40 livello 2 > 3): canonical 'place' (NON 'location').
    expect(result).toEqual({ place: 'Milano' })
  })

  it('Test 9d: CR-02 fix — explicit mapping on canonical field overrides alias (D-40 livello 1 wins)', () => {
    const { engine, canonical, alias } = makeEngine()
    canonical.register({
      id: 'sch9d' as CanonicalSchemaId,
      fields: { location: { type: 'string', required: false } },
    })
    // Alias globale 'city' → 'location'.
    alias.registerGlobal('city', 'location')
    const desc: MapperPluginDescriptor = {
      id: 'p-explicit-over-alias',
      canonicalSchemaId: 'sch9d' as CanonicalSchemaId,
      // Mapping esplicito: location ← name (NON via alias 'city')
      outputMap: { location: { source: 'name' } },
    }
    engine.compileMappings(desc)
    // Payload contiene sia 'name' (esplicito) sia 'city' (alias) — esplicito vince.
    const result = engine.applyOutputMap(desc.id, { name: 'Roma', city: 'Milano' })
    expect(result).toEqual({ location: 'Roma' })
  })

  it('Test 10: passthrough — plugin without compileMappings returns shallow copy of payload', () => {
    const { engine } = makeEngine()
    const result = engine.applyOutputMap('unregistered-plugin', { foo: 'bar', n: 42 })
    expect(result).toEqual({ foo: 'bar', n: 42 })
    // Shallow copy: mutating result does not affect future calls.
    ;(result as Record<string, unknown>).foo = 'mutated'
    const second = engine.applyOutputMap('unregistered-plugin', { foo: 'bar', n: 42 })
    expect(second).toEqual({ foo: 'bar', n: 42 })
  })
})

describe('MapperEngine — chunk B: transform / derive / onFailure', () => {
  it('Test 11: MAP-07 format transform — parseItalianDate "30/04/2026" → "2026-04-30"', () => {
    const { engine, canonical, transform } = makeEngine()
    canonical.register(weatherSchema)
    transform.register('parseItalianDate', (input) => {
      const [d, m, y] = String(input).split('/')
      return `${y}-${m}-${d}`
    })
    const desc: MapperPluginDescriptor = {
      id: 'p-format-transform',
      canonicalSchemaId: 'weather' as CanonicalSchemaId,
      outputMap: {
        location: { source: 'città' },
        forecast_date: { source: 'data', transform: 'parseItalianDate' },
      },
    }
    engine.compileMappings(desc)
    expect(engine.applyOutputMap(desc.id, { città: 'Roma', data: '30/04/2026' })).toEqual({
      location: 'Roma',
      forecast_date: '2026-04-30',
    })
  })

  it('Test 12: MAP-08 unit normalization — parseTempCelsius "22°C" → 22 (numeric)', () => {
    const { engine, canonical, transform } = makeEngine()
    canonical.register(weatherSchema)
    transform.register('parseTempCelsius', (input) => {
      const m = String(input).match(/^(-?\d+(?:\.\d+)?)/)
      return m ? Number(m[1]) : Number.NaN
    })
    const desc: MapperPluginDescriptor = {
      id: 'p-unit-norm',
      canonicalSchemaId: 'weather' as CanonicalSchemaId,
      outputMap: {
        location: { source: 'città' },
        temperature_celsius: { source: 'temp', transform: 'parseTempCelsius' },
      },
    }
    engine.compileMappings(desc)
    expect(engine.applyOutputMap(desc.id, { città: 'Roma', temp: '22°C' })).toEqual({
      location: 'Roma',
      temperature_celsius: 22,
    })
  })

  it('Test 13: MAP-09 derive — concat firstName + lastName → fullName', () => {
    const { engine, canonical, transform } = makeEngine()
    const userSchema: CanonicalSchema = {
      id: 'user' as CanonicalSchemaId,
      fields: { fullName: { type: 'string', required: false } },
    }
    canonical.register(userSchema)
    transform.register('concat', (args) => (args as unknown[]).join(' '))
    const desc: MapperPluginDescriptor = {
      id: 'p-derive',
      canonicalSchemaId: 'user' as CanonicalSchemaId,
      outputMap: {
        fullName: { derive: { sources: ['firstName', 'lastName'], transform: 'concat' } },
      },
    }
    engine.compileMappings(desc)
    expect(engine.applyOutputMap(desc.id, { firstName: 'Mario', lastName: 'Rossi' })).toEqual({
      fullName: 'Mario Rossi',
    })
  })

  it('Test 14: D-44 onFailure default "block" — transform throw → mapping.transform.failed', () => {
    const { engine, canonical, transform } = makeEngine()
    // Schema with field having no onFailure declared (default 'block').
    const blockSchema: CanonicalSchema = {
      id: 'block-schema' as CanonicalSchemaId,
      fields: {
        location: { type: 'string', required: false },
        // No onFailure → defaults to 'block'.
        out: { type: 'string', required: false },
      },
    }
    canonical.register(blockSchema)
    transform.register('boom', () => {
      throw new Error('boom error')
    })
    const desc: MapperPluginDescriptor = {
      id: 'p-block-default',
      canonicalSchemaId: 'block-schema' as CanonicalSchemaId,
      outputMap: { out: { source: 'src', transform: 'boom' } },
    }
    engine.compileMappings(desc)
    let caught: unknown
    try {
      engine.applyOutputMap(desc.id, { src: 'x' })
    } catch (e) {
      caught = e
    }
    expect(isBrokerError(caught)).toBe(true)
    expect((caught as { code: string }).code).toBe('mapping.transform.failed')
  })

  it('Test 15: D-44 onFailure "skip" — transform throw → field omitted, no throw', () => {
    const { engine, canonical, transform } = makeEngine()
    // weatherSchema has temperature_celsius onFailure: 'skip'.
    canonical.register(weatherSchema)
    transform.register('boom', () => {
      throw new Error('boom')
    })
    const desc: MapperPluginDescriptor = {
      id: 'p-skip',
      canonicalSchemaId: 'weather' as CanonicalSchemaId,
      outputMap: {
        location: { source: 'città' },
        temperature_celsius: { source: 'temp', transform: 'boom' },
      },
    }
    engine.compileMappings(desc)
    const result = engine.applyOutputMap(desc.id, { città: 'Roma', temp: 'irrelevant' })
    expect(result).toEqual({ location: 'Roma' })
    expect('temperature_celsius' in result).toBe(false)
  })

  it('Test 16: D-44 onFailure "fallback" with default — transform throw → use default', () => {
    const { engine, canonical, transform } = makeEngine()
    const fallbackSchema: CanonicalSchema = {
      id: 'fb-schema' as CanonicalSchemaId,
      fields: {
        location: { type: 'string', required: false },
        temperature_celsius: {
          type: 'number',
          required: false,
          onFailure: 'fallback',
          default: 0,
        },
      },
    }
    canonical.register(fallbackSchema)
    transform.register('boom', () => {
      throw new Error('boom')
    })
    const desc: MapperPluginDescriptor = {
      id: 'p-fallback-default',
      canonicalSchemaId: 'fb-schema' as CanonicalSchemaId,
      outputMap: {
        location: { source: 'città' },
        temperature_celsius: { source: 'temp', transform: 'boom' },
      },
    }
    engine.compileMappings(desc)
    expect(engine.applyOutputMap(desc.id, { città: 'Roma', temp: 'irrelevant' })).toEqual({
      location: 'Roma',
      temperature_celsius: 0,
    })
  })

  it('Test 17: D-44 onFailure "fallback" without default + required:false → field omitted (downgrade to skip)', () => {
    const { engine, canonical, transform } = makeEngine()
    const fbNoDefaultSchema: CanonicalSchema = {
      id: 'fb-no-default' as CanonicalSchemaId,
      fields: {
        location: { type: 'string', required: false },
        temperature_celsius: { type: 'number', required: false, onFailure: 'fallback' },
      },
    }
    canonical.register(fbNoDefaultSchema)
    transform.register('boom', () => {
      throw new Error('boom')
    })
    const desc: MapperPluginDescriptor = {
      id: 'p-fallback-no-default',
      canonicalSchemaId: 'fb-no-default' as CanonicalSchemaId,
      outputMap: {
        location: { source: 'città' },
        temperature_celsius: { source: 'temp', transform: 'boom' },
      },
    }
    engine.compileMappings(desc)
    const result = engine.applyOutputMap(desc.id, { città: 'Roma', temp: 'irrelevant' })
    expect(result).toEqual({ location: 'Roma' })
    expect('temperature_celsius' in result).toBe(false)
  })

  it('Test 18: transform deterministic — same descriptor + same payload → same output (no side effect)', () => {
    const { engine, canonical, transform } = makeEngine()
    canonical.register(weatherSchema)
    transform.register('parseItalianDate', (input) => {
      const [d, m, y] = String(input).split('/')
      return `${y}-${m}-${d}`
    })
    const desc: MapperPluginDescriptor = {
      id: 'p-determ',
      canonicalSchemaId: 'weather' as CanonicalSchemaId,
      outputMap: {
        location: { source: 'città' },
        forecast_date: { source: 'data', transform: 'parseItalianDate' },
      },
    }
    engine.compileMappings(desc)
    const r1 = engine.applyOutputMap(desc.id, { città: 'Roma', data: '30/04/2026' })
    const r2 = engine.applyOutputMap(desc.id, { città: 'Roma', data: '30/04/2026' })
    expect(r1).toEqual(r2)
  })

  it('Test 19: transform context — receives ctx with pluginId, fieldName, logger', () => {
    const { engine, canonical, transform } = makeEngine()
    canonical.register(weatherSchema)
    let observedCtx: { pluginId?: string; fieldName?: string; hasLogger?: boolean } = {}
    transform.register('inspect', (input, ctx) => {
      observedCtx = {
        pluginId: ctx.pluginId,
        fieldName: ctx.fieldName,
        hasLogger: typeof ctx.logger?.info === 'function',
      }
      return input
    })
    const desc: MapperPluginDescriptor = {
      id: 'p-ctx',
      canonicalSchemaId: 'weather' as CanonicalSchemaId,
      outputMap: {
        location: { source: 'città', transform: 'inspect' },
      },
    }
    engine.compileMappings(desc)
    engine.applyOutputMap(desc.id, { città: 'Roma' })
    expect(observedCtx.pluginId).toBe('p-ctx')
    expect(observedCtx.fieldName).toBe('location')
    expect(observedCtx.hasLogger).toBe(true)
  })
})

describe('MapperEngine — chunk C: cycle / validation / cascade', () => {
  it('Test 20: D-35 cycle detection — A→B→A throws mapping.cycle.detected with details', () => {
    const { engine, canonical, transform } = makeEngine()
    const cycSchema: CanonicalSchema = {
      id: 'cyc' as CanonicalSchemaId,
      fields: { a: { type: 'string' }, b: { type: 'string' } },
    }
    canonical.register(cycSchema)
    transform.register('tx', (x) => x)
    const desc: MapperPluginDescriptor = {
      id: 'p-cyc',
      canonicalSchemaId: 'cyc' as CanonicalSchemaId,
      outputMap: {
        a: { derive: { sources: ['b'], transform: 'tx' } },
        b: { derive: { sources: ['a'], transform: 'tx' } },
      },
    }
    let caught: unknown
    try {
      engine.compileMappings(desc)
    } catch (e) {
      caught = e
    }
    expect(isBrokerError(caught)).toBe(true)
    expect((caught as { code: string }).code).toBe('mapping.cycle.detected')
    const details = (caught as { details: Record<string, unknown> }).details
    expect(details.pluginId).toBe('p-cyc')
    expect(details.cycle).toEqual(expect.arrayContaining(['a', 'b']))
  })

  it('Test 21: D-35 cycle thrown at compileMappings, NOT at applyOutputMap', () => {
    const { engine, canonical, transform } = makeEngine()
    const cycSchema: CanonicalSchema = {
      id: 'cyc2' as CanonicalSchemaId,
      fields: { a: { type: 'string' }, b: { type: 'string' } },
    }
    canonical.register(cycSchema)
    transform.register('tx', (x) => x)
    const cycDesc: MapperPluginDescriptor = {
      id: 'p-cyc2',
      canonicalSchemaId: 'cyc2' as CanonicalSchemaId,
      outputMap: {
        a: { derive: { sources: ['b'], transform: 'tx' } },
        b: { derive: { sources: ['a'], transform: 'tx' } },
      },
    }
    // compileMappings throws → cycle detected at register-time.
    expect(() => engine.compileMappings(cycDesc)).toThrow()

    // Now register a valid plugin and verify applyOutputMap does not throw cycle errors.
    canonical.register(weatherSchema)
    const validDesc: MapperPluginDescriptor = {
      id: 'p-valid',
      canonicalSchemaId: 'weather' as CanonicalSchemaId,
      outputMap: { location: { source: 'città' } },
    }
    expect(() => engine.compileMappings(validDesc)).not.toThrow()
    expect(() => engine.applyOutputMap(validDesc.id, { città: 'Roma' })).not.toThrow()
  })

  it('Test 22: D-35 cycle detection deterministic — same descriptor → same details.cycle', () => {
    const cycSchema: CanonicalSchema = {
      id: 'cyc3' as CanonicalSchemaId,
      fields: { a: { type: 'string' }, b: { type: 'string' } },
    }
    const buildEngine = (): { engine: MapperEngine; desc: MapperPluginDescriptor } => {
      const { engine, canonical, transform } = makeEngine()
      canonical.register(cycSchema)
      transform.register('tx', (x) => x)
      const desc: MapperPluginDescriptor = {
        id: 'p-cyc3',
        canonicalSchemaId: 'cyc3' as CanonicalSchemaId,
        outputMap: {
          a: { derive: { sources: ['b'], transform: 'tx' } },
          b: { derive: { sources: ['a'], transform: 'tx' } },
        },
      }
      return { engine, desc }
    }

    const captureCycle = (): unknown => {
      const { engine, desc } = buildEngine()
      try {
        engine.compileMappings(desc)
      } catch (e) {
        return (e as { details: Record<string, unknown> }).details.cycle
      }
      return undefined
    }

    const c1 = captureCycle()
    const c2 = captureCycle()
    expect(c1).toEqual(c2)
  })

  it('Test 22b: CR-03 fix — cycle detection covers mixed derive+source (a.derive=[b]; b.source=a)', () => {
    const { engine, canonical, transform } = makeEngine()
    canonical.register({
      id: 'cycMix' as CanonicalSchemaId,
      fields: { a: { type: 'string' }, b: { type: 'string' } },
    })
    transform.register('tx', (x) => x)
    const desc: MapperPluginDescriptor = {
      id: 'p-cyc-mix',
      canonicalSchemaId: 'cycMix' as CanonicalSchemaId,
      outputMap: {
        // a deriva da b; b è un alias semplice di a → cycle a→b→a misto.
        a: { derive: { sources: ['b'], transform: 'tx' } },
        b: { source: 'a' },
      },
    }
    let caught: unknown
    try {
      engine.compileMappings(desc)
    } catch (e) {
      caught = e
    }
    expect(isBrokerError(caught)).toBe(true)
    expect((caught as { code: string }).code).toBe('mapping.cycle.detected')
    const details = (caught as { details: Record<string, unknown> }).details
    expect(details.pluginId).toBe('p-cyc-mix')
    expect(details.cycle).toEqual(expect.arrayContaining(['a', 'b']))
  })

  it('Test 22c: CR-03 fix — source pointing to non-map field is NOT a cycle', () => {
    const { engine, canonical, transform } = makeEngine()
    canonical.register({
      id: 'noCyc' as CanonicalSchemaId,
      fields: { a: { type: 'string' }, b: { type: 'string' } },
    })
    transform.register('tx', (x) => x)
    // a.source punta a un campo locale che NON è un altro field del map → no cycle.
    const desc: MapperPluginDescriptor = {
      id: 'p-no-cyc',
      canonicalSchemaId: 'noCyc' as CanonicalSchemaId,
      outputMap: {
        a: { source: 'localField' },
        b: { source: 'otherLocal' },
      },
    }
    expect(() => engine.compileMappings(desc)).not.toThrow()
  })

  it('Test 23: D-35 no cycle on flat derive (sources do not derive themselves)', () => {
    const { engine, canonical, transform } = makeEngine()
    const userSchema: CanonicalSchema = {
      id: 'user2' as CanonicalSchemaId,
      fields: { fullName: { type: 'string', required: false } },
    }
    canonical.register(userSchema)
    transform.register('concat', (args) => (args as unknown[]).join(' '))
    const desc: MapperPluginDescriptor = {
      id: 'p-flat',
      canonicalSchemaId: 'user2' as CanonicalSchemaId,
      outputMap: {
        fullName: { derive: { sources: ['firstName', 'lastName'], transform: 'concat' } },
      },
    }
    expect(() => engine.compileMappings(desc)).not.toThrow()
  })

  it('Test 24: D-26 ext cascade — unregisterPluginMappings returns true once, false thereafter', () => {
    const { engine, canonical } = makeEngine()
    canonical.register(weatherSchema)
    const desc: MapperPluginDescriptor = {
      id: 'p-cascade',
      canonicalSchemaId: 'weather' as CanonicalSchemaId,
      outputMap: { location: { source: 'città' } },
    }
    engine.compileMappings(desc)
    expect(engine.unregisterPluginMappings(desc.id)).toBe(true)
    expect(engine.unregisterPluginMappings(desc.id)).toBe(false)
    // After unregister, applyOutputMap returns shallow copy passthrough.
    const result = engine.applyOutputMap(desc.id, { foo: 'bar' })
    expect(result).toEqual({ foo: 'bar' })
  })

  it('Test 25: D-39 validateCanonical — schema not registered → ok:false with issues', () => {
    const { engine } = makeEngine()
    const result = engine.validateCanonical('unknown-schema' as CanonicalSchemaId, {})
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.length).toBeGreaterThan(0)
      expect(result.issues[0]?.message).toContain('unknown-schema')
    }
  })

  it('Test 25b: CR-04 fix — validateCanonical enforces required:true field missing → ok:false', () => {
    const { engine, canonical } = makeEngine()
    canonical.register({
      id: 'sch25b' as CanonicalSchemaId,
      fields: {
        location: { type: 'string', required: true },
        urgency: { type: 'string', required: false },
      },
    })
    // location required mancante → ok: false
    const r1 = engine.validateCanonical('sch25b' as CanonicalSchemaId, { urgency: 'normal' })
    expect(r1.ok).toBe(false)
    if (!r1.ok) {
      expect(r1.issues.length).toBeGreaterThan(0)
      expect(r1.issues[0]?.path).toContain('location')
    }
    // location presente → ok: true
    const r2 = engine.validateCanonical('sch25b' as CanonicalSchemaId, { location: 'Roma' })
    expect(r2.ok).toBe(true)
  })

  it('Test 25c: CR-04 fix — validateCanonical enforces FieldDescriptor.type mismatch → ok:false', () => {
    const { engine, canonical } = makeEngine()
    canonical.register({
      id: 'sch25c' as CanonicalSchemaId,
      fields: {
        location: { type: 'string', required: false },
        temperature: { type: 'number', required: false },
      },
    })
    // type mismatch: location attesa string, ricevuta number
    const r1 = engine.validateCanonical('sch25c' as CanonicalSchemaId, { location: 42 })
    expect(r1.ok).toBe(false)
    // type 'any' / mancante → ok
    const r2 = engine.validateCanonical('sch25c' as CanonicalSchemaId, {
      location: 'Roma',
      temperature: 22,
    })
    expect(r2.ok).toBe(true)
  })

  it('Test 25d: CR-04 fix — validateCanonical accepts non-object payload → ok:false', () => {
    const { engine, canonical } = makeEngine()
    canonical.register({
      id: 'sch25d' as CanonicalSchemaId,
      fields: { location: { type: 'string', required: false } },
    })
    const r1 = engine.validateCanonical('sch25d' as CanonicalSchemaId, 'not-an-object')
    expect(r1.ok).toBe(false)
    const r2 = engine.validateCanonical('sch25d' as CanonicalSchemaId, null)
    expect(r2.ok).toBe(false)
  })

  it("Test 25e: CR-04 fix — validateCanonical with type 'any' accepts any value", () => {
    const { engine, canonical } = makeEngine()
    canonical.register({
      id: 'sch25e' as CanonicalSchemaId,
      fields: { meta: { type: 'any', required: false } },
    })
    expect(engine.validateCanonical('sch25e' as CanonicalSchemaId, { meta: 42 }).ok).toBe(true)
    expect(engine.validateCanonical('sch25e' as CanonicalSchemaId, { meta: 'str' }).ok).toBe(true)
    expect(engine.validateCanonical('sch25e' as CanonicalSchemaId, { meta: null }).ok).toBe(true)
    expect(engine.validateCanonical('sch25e' as CanonicalSchemaId, { meta: { x: 1 } }).ok).toBe(
      true,
    )
  })

  it('Test 26: stats — returns compiledPluginCount, canonicalSchemas, registeredAliases', () => {
    const { engine, canonical, alias } = makeEngine()
    canonical.register(weatherSchema)
    canonical.register({
      id: 'other' as CanonicalSchemaId,
      fields: { x: { type: 'string' } },
    })
    alias.registerGlobal('city', 'location')
    const desc1: MapperPluginDescriptor = {
      id: 'p-stats-1',
      canonicalSchemaId: 'weather' as CanonicalSchemaId,
      outputMap: { location: { source: 'città' } },
    }
    const desc2: MapperPluginDescriptor = {
      id: 'p-stats-2',
      canonicalSchemaId: 'other' as CanonicalSchemaId,
      outputMap: { x: { source: 'src' } },
    }
    engine.compileMappings(desc1)
    engine.compileMappings(desc2)
    const stats = engine.stats()
    expect(stats.compiledPluginCount).toBe(2)
    expect(stats.canonicalSchemas).toBe(2)
    expect(stats.registeredAliases.global).toBe(1)
  })
})
