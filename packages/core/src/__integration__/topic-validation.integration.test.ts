// Integration test — Topic naming validation (CORE-08, success criterion #3 ROADMAP Phase 1, D-24).
//
// Verifica end-to-end che `Broker.publish(topic, ...)` rifiuti i topic NON conformi
// al pattern D-24 (`<entity>.<action>.<status>`, lowercase alfanumerico, dot-separated)
// e accetti i topic validi.
//
// NOTA IMPLEMENTATIVA (deviation Rule 1 — bug nel plan):
// Il PLAN snippet originale si aspettava `code === 'topic.invalid'`, che è il code
// emesso da `topic-matcher.validateTopic()`. In realtà la pipeline `bus.publish`
// invoca `validateEvent(event)` PRIMA del topic matching, e il `BrokerEventSchema`
// (event-validator.ts) usa la stessa regex D-24 — quindi il primo error path che
// scatta su topic invalido è `event.validation.failed` (category='validation'),
// NON `topic.invalid` (category='topic'). Il behavior funzionale richiesto dal
// PLAN ("publish con topic invalido throw BrokerError") resta verificato; cambia
// solo il code discriminator. Documentato nel SUMMARY come deviation Rule 1.

import { describe, expect, it } from 'vitest'
import { isBrokerError } from '../core/broker-error'
import { createPipelineHarness } from '../test-utils/pipeline-harness'

describe('Topic naming validation (CORE-08, success criterion #3, D-24)', () => {
  it.each([
    ['Weather.Requested'], // uppercase rejected
    ['weather/requested'], // separator non-`.`
    ['weather..requested'], // double-dot
    ['1weather.x'], // primo char numerico
    [''], // empty
    ['weather.'], // trailing dot
    ['.weather'], // leading dot
  ])('publish with invalid topic %s throws BrokerError code=event.validation.failed (category=validation)', (topic) => {
    const h = createPipelineHarness()
    let caught: unknown = null
    try {
      h.broker.publish(topic, {}, { source: { type: 'plugin', id: 'p' }, deliveryMode: 'sync' })
    } catch (e) {
      caught = e
    }
    expect(caught).not.toBeNull()
    expect(isBrokerError(caught)).toBe(true)
    // Pre-bus validation throws code='event.validation.failed' (validateEvent),
    // NOT 'topic.invalid' (which would only fire if validation were skipped and
    // we hit trie.match() with a malformed string — unreachable via publish).
    expect((caught as { code: string }).code).toBe('event.validation.failed')
    expect((caught as { category: string }).category).toBe('validation')
  })

  it.each([
    ['weather.requested'],
    ['weather.requested.success'],
    ['form.customer.submit'],
    ['a.b.c.d.e'],
  ])('publish with valid topic %s does not throw', (topic) => {
    const h = createPipelineHarness()
    expect(() =>
      h.broker.publish(topic, {}, { source: { type: 'plugin', id: 'p' }, deliveryMode: 'sync' }),
    ).not.toThrow()
  })
})
