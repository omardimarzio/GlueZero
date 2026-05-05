// Integration test — Scenario meteo PRD §29 end-to-end senza HTTP
// (Phase 2 ROADMAP success criterion #1, D-53, REQ TEST-02 plugin↔plugin con mapping diverso).
//
// Verifica end-to-end:
//   - Plugin form pubblica `weather.requested` con payload locale italiano
//     `{ città: 'Roma', data: '30/04/2026' }`
//   - Mapper produce internamente canonical `{ location: 'Roma', forecast_date: '2026-04-30' }`
//     (transforms `parseItalianDate` + `normalizeLocationName` registrati al boot)
//   - Plugin widget consumer riceve `{ location, day-prevision }` via `inputMap` inverso
//
// Inoltre verifica che il mapper supporta tutti i 7 casi PRD §14.2 (Phase 2 ROADMAP
// criterion #3): rename, nested (dot path), default (schema-driven), transform di formato,
// derive ($derive con concat-like), partial mapping, validazione post-mapping.
//
// **NO mock dei moduli interni F2** (D-49 + plan 02-11 vincolo): la fixture
// `createMapperHarness` istanzia un `MapperBroker` REALE via `createMapperBroker(config)`
// e i 4 moduli Wave 3 (CanonicalRegistry, AliasRegistry, TransformPipeline, ValibotAdapter)
// vengono compose internamente dal broker wrapper.

import type { BrokerEvent, PluginContext, Subscription } from '@gluezero/core'
import { describe, expect, it } from 'vitest'
import { createMapperHarness } from '../test-utils/mapper-harness'
import type { CanonicalSchemaId } from '../types/canonical-schema'

// Helper: shape minimale per il `ctx.broker` esposto dal F1 createPluginScopedBroker
// (wrapped F2 dal MapperBroker.wrapPluginContext per applicare inputMap consumer-side).
interface ScopedBrokerSubscribe {
  subscribe(
    pattern: string,
    handler: (event: BrokerEvent) => void | Promise<void>,
    options?: { signal?: AbortSignal },
  ): Subscription
}

describe('Scenario meteo PRD §29 — end-to-end senza HTTP (D-53, success criterion #1)', () => {
  it('form publishes weather.requested with città/data → widget receives location/day-prevision', async () => {
    const harness = createMapperHarness({
      schemas: [
        {
          id: 'weather' as CanonicalSchemaId,
          fields: {
            location: { type: 'string', required: true },
            forecast_date: { type: 'string', required: true },
          },
        },
      ],
      transforms: {
        parseItalianDate: (input) => {
          const [d, m, y] = String(input).split('/')
          return `${y}-${m}-${d}`
        },
        normalizeLocationName: (input) => String(input).trim(),
      },
    })

    // Plugin form (publisher) — outputMap locale → canonical
    await harness.broker.registerPlugin({
      id: 'plugin-form',
      canonicalSchemaId: 'weather' as CanonicalSchemaId,
      outputMap: {
        location: { source: 'città', transform: 'normalizeLocationName' },
        forecast_date: { source: 'data', transform: 'parseItalianDate' },
      },
    })

    // Plugin widget (consumer) — inputMap canonical → locale (renames forecast_date in 'day-prevision')
    const received: Record<string, unknown>[] = []
    await harness.broker.registerPlugin({
      id: 'plugin-widget',
      canonicalSchemaId: 'weather' as CanonicalSchemaId,
      inputMap: {
        location: { source: 'location' },
        'day-prevision': { source: 'forecast_date' },
      },
      onMount(ctx: PluginContext): void {
        // Il MapperBroker wrappa ctx.broker: il subscribe è auto-wrapped per applicare
        // applyInputMap(pluginId, ...) al payload canonico in arrivo (D-51).
        ;(ctx.broker as ScopedBrokerSubscribe).subscribe('weather.requested', (event) => {
          received.push(event.payload as Record<string, unknown>)
        })
      },
    })

    // Form publisha — payload locale italiano (città, data DD/MM/YYYY)
    harness.broker.publish(
      'weather.requested',
      { città: 'Roma', data: '30/04/2026' },
      {
        source: { type: 'plugin', id: 'plugin-form' },
        deliveryMode: 'sync',
      },
    )

    // Widget riceve canonical mappato via inputMap
    expect(received).toHaveLength(1)
    expect(received[0]).toEqual({
      location: 'Roma',
      'day-prevision': '2026-04-30',
    })

    // Verifica che il tap ha visto la pipeline F1 (event.received → ... → event.delivered)
    expect(harness.byStep('event.received').length).toBeGreaterThan(0)
    expect(harness.byStep('event.delivered').length).toBeGreaterThan(0)
    // CR-01 fix verification: il tap ha visto i 5 step F2 (D-50, vincolo
    // architetturale CLAUDE.md "EventTap interface deve essere instrumentata già in F1").
    // CR-01-RESIDUAL iter2: aggiunto verify per event.source.resolved (5° step F2).
    expect(harness.byStep('event.source.resolved' as never).length).toBeGreaterThan(0)
    expect(harness.byStep('event.mapped.canonical' as never).length).toBeGreaterThan(0)
    expect(harness.byStep('event.canonical.validated' as never).length).toBeGreaterThan(0)
    expect(harness.byStep('event.mapped.consumer' as never).length).toBeGreaterThan(0)
    expect(harness.byStep('event.final.validated' as never).length).toBeGreaterThan(0)

    // WR-C iter2 verification: gli step subscribe-side (11/12) usano il BrokerEvent.id
    // reale come `eventId` (NON il placeholder `f2:topic:step`). Il `BrokerEvent.id` di
    // F1 è generato da nanoid — controlliamo che NON sia il placeholder string.
    const consumerSnap = harness.byStep('event.mapped.consumer' as never)[0]
    const finalSnap = harness.byStep('event.final.validated' as never)[0]
    expect(consumerSnap?.eventId).toBeDefined()
    expect(consumerSnap?.eventId).not.toMatch(/^f2:/)
    expect(finalSnap?.eventId).toBeDefined()
    expect(finalSnap?.eventId).not.toMatch(/^f2:/)
    // Coerenza: i due step subscribe-side condividono lo stesso BrokerEvent.id.
    expect(consumerSnap?.eventId).toBe(finalSnap?.eventId)

    // WR-01 iter3 verification: anche gli step publish-side (4/5/6) propagano un
    // eventId reale (NON placeholder), pre-allocato dal MapperBroker via nanoid e
    // riusato da inner.publish via options.id. I 5 step F2 di un singolo evento
    // condividono lo STESSO eventId — Inspector V2/F6 può correlare snapshot
    // cross-step deterministically.
    // NB: lo step `event.source.resolved` ha doppia semantica V1 (publisher + consumer
    // side, vedi WR-04 iter3). Filtriamo lo snapshot publisher-side via
    // `metadata.pluginId === 'plugin-form'` (publisher source plugin id).
    const sourceResolvedSnaps = harness.byStep('event.source.resolved' as never)
    const publisherSourceResolved = sourceResolvedSnaps.find(
      (s) => (s.metadata as { pluginId?: string } | undefined)?.pluginId === 'plugin-form',
    )
    const mappedCanonicalSnap = harness.byStep('event.mapped.canonical' as never)[0]
    const canonicalValidatedSnap = harness.byStep('event.canonical.validated' as never)[0]
    expect(publisherSourceResolved?.eventId).toBeDefined()
    expect(publisherSourceResolved?.eventId).not.toMatch(/^f2:/)
    expect(mappedCanonicalSnap?.eventId).toBeDefined()
    expect(mappedCanonicalSnap?.eventId).not.toMatch(/^f2:/)
    expect(canonicalValidatedSnap?.eventId).toBeDefined()
    expect(canonicalValidatedSnap?.eventId).not.toMatch(/^f2:/)
    // I 5 step F2 dell'evento condividono lo STESSO eventId (publisher → subscriber).
    expect(publisherSourceResolved?.eventId).toBe(consumerSnap?.eventId)
    expect(mappedCanonicalSnap?.eventId).toBe(consumerSnap?.eventId)
    expect(canonicalValidatedSnap?.eventId).toBe(consumerSnap?.eventId)
  })

  it('multiple consumers with different inputMap receive different shapes (TEST-02)', async () => {
    const harness = createMapperHarness({
      schemas: [
        {
          id: 'weather' as CanonicalSchemaId,
          fields: {
            location: { type: 'string', required: true },
            forecast_date: { type: 'string', required: true },
          },
        },
      ],
      transforms: {
        parseItalianDate: (input) => {
          const [d, m, y] = String(input).split('/')
          return `${y}-${m}-${d}`
        },
      },
    })

    await harness.broker.registerPlugin({
      id: 'form',
      canonicalSchemaId: 'weather' as CanonicalSchemaId,
      outputMap: {
        location: { source: 'città' },
        forecast_date: { source: 'data', transform: 'parseItalianDate' },
      },
    })

    const widgetA: unknown[] = []
    const widgetB: unknown[] = []

    // Consumer A: usa rename location → place
    await harness.broker.registerPlugin({
      id: 'widget-a',
      canonicalSchemaId: 'weather' as CanonicalSchemaId,
      inputMap: {
        place: { source: 'location' },
        date: { source: 'forecast_date' },
      },
      onMount(ctx): void {
        ;(ctx.broker as ScopedBrokerSubscribe).subscribe('weather.requested', (e) => {
          widgetA.push(e.payload)
        })
      },
    })

    // Consumer B: usa nomenclatura differente
    await harness.broker.registerPlugin({
      id: 'widget-b',
      canonicalSchemaId: 'weather' as CanonicalSchemaId,
      inputMap: {
        city: { source: 'location' },
        when: { source: 'forecast_date' },
      },
      onMount(ctx): void {
        ;(ctx.broker as ScopedBrokerSubscribe).subscribe('weather.requested', (e) => {
          widgetB.push(e.payload)
        })
      },
    })

    harness.broker.publish(
      'weather.requested',
      { città: 'Milano', data: '01/05/2026' },
      {
        source: { type: 'plugin', id: 'form' },
        deliveryMode: 'sync',
      },
    )

    // Ogni consumer riceve la propria nomenclatura locale
    expect(widgetA).toHaveLength(1)
    expect(widgetA[0]).toEqual({ place: 'Milano', date: '2026-05-01' })

    expect(widgetB).toHaveLength(1)
    expect(widgetB[0]).toEqual({ city: 'Milano', when: '2026-05-01' })
  })

  it('PRD §14.2 cases: rename, nested, transform, derive, partial work end-to-end (criterion #3)', async () => {
    const harness = createMapperHarness({
      schemas: [
        {
          id: 'mixed' as CanonicalSchemaId,
          fields: {
            renamed: { type: 'string', required: false },
            nested: { type: 'string', required: false },
            transformed: { type: 'string', required: false },
            derived: { type: 'string', required: false },
          },
        },
      ],
      transforms: {
        upper: (s) => String(s).toUpperCase(),
        // Pattern PRD §14.5: derive concat — il mapper-engine passa l'array di source values
        // come singolo argomento al transform.
        concatSpace: (args) => {
          const values = args as readonly unknown[]
          return values.map((v) => String(v)).join(' ')
        },
      },
    })

    await harness.broker.registerPlugin({
      id: 'mixed-plugin',
      canonicalSchemaId: 'mixed' as CanonicalSchemaId,
      outputMap: {
        // 1. Rename: oldName → renamed (PRD §14.2.1, MAP-04)
        renamed: { source: 'oldName' },
        // 2. Nested: a.b.c → nested (dot-path, PRD §14.2.2, MAP-05)
        nested: { source: 'a.b.c' },
        // 3. Transform di formato: plain → transformed via upper (PRD §14.2.4, MAP-07)
        transformed: { source: 'plain', transform: 'upper' },
        // 4. Derive: x + y → derived via concatSpace (PRD §14.2.6, MAP-09)
        derived: { derive: { sources: ['x', 'y'], transform: 'concatSpace' } },
      },
    })

    let captured: unknown
    harness.broker.subscribe('mixed.topic', (e) => {
      captured = e.payload
    })

    harness.broker.publish(
      'mixed.topic',
      {
        oldName: 'renamed-value',
        a: { b: { c: 'nested-value' } },
        plain: 'lower',
        x: 'foo',
        y: 'bar',
        // 5. Partial mapping: questo field NON è dichiarato nel outputMap → NON appare in canonical
        ignored: 'partial-ignored',
      },
      {
        source: { type: 'plugin', id: 'mixed-plugin' },
        deliveryMode: 'sync',
      },
    )

    const c = captured as Record<string, unknown>
    expect(c.renamed).toBe('renamed-value')
    expect(c.nested).toBe('nested-value')
    expect(c.transformed).toBe('LOWER')
    expect(c.derived).toBe('foo bar')
    // Partial mapping (MAP-10): 'ignored' NON è nel canonical
    expect('ignored' in c).toBe(false)
  })

  it('default applies when source field is missing (MAP-06, D-42)', async () => {
    const harness = createMapperHarness({
      schemas: [
        {
          id: 'with-default' as CanonicalSchemaId,
          fields: {
            urgency: { type: 'string', required: false, default: 'normal' },
            label: { type: 'string', required: false },
          },
        },
      ],
    })

    // Pattern MAP-06: il MappingRule dichiara source + default — quando il source
    // è assente nel payload locale, il mapper applica il default della rule (resolution
    // ordering coerente con D-42/D-43: prima rule.default, poi schema-level default).
    await harness.broker.registerPlugin({
      id: 'p-default',
      canonicalSchemaId: 'with-default' as CanonicalSchemaId,
      outputMap: {
        // urgency è dichiarata con source 'urg' che non sarà presente nel payload
        // → applica default 'normal' (rule.default OR schema FieldDescriptor.default)
        urgency: { source: 'urg', default: 'normal' },
        label: { source: 'lab' },
      },
    })

    let captured: unknown
    harness.broker.subscribe('default.topic', (e) => {
      captured = e.payload
    })

    harness.broker.publish(
      'default.topic',
      { lab: 'priority-task' }, // 'urg' assente → default applica
      {
        source: { type: 'plugin', id: 'p-default' },
        deliveryMode: 'sync',
      },
    )

    const c = captured as Record<string, unknown>
    expect(c.label).toBe('priority-task')
    // Default applicato per urgency (D-42 + MAP-06)
    expect(c.urgency).toBe('normal')
  })
})
