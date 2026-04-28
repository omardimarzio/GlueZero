// Test suite per topic-matcher (CORE-08, CORE-09, D-08..D-11, D-24).
//
// Coverage:
// - validateTopic: regex naming D-24 (lowercase dot-separated)
// - validateTopicPattern: regex per wildcard `*` come full segment
// - TopicTrie<T>: insert/remove/match/collectAllPatterns con wildcard
//   - Match exact + wildcard combinato
//   - D-11 critico: `weather.*.failed` matcha `weather.alert.failed`
//   - `*.failed` NON matcha singleton `failed` (segment count mismatch)
//   - Insertion idempotente (Set semantics)
//   - Remove cleanup nodi vuoti
//   - Performance: 10000 wildcard subscribers, single match < 50ms

import { describe, expect, it } from 'vitest'
import { isBrokerError } from './broker-error'
import { TopicTrie, validateTopic, validateTopicPattern } from './topic-matcher'

describe('validateTopic', () => {
  it.each([
    ['weather.requested'],
    ['weather.requested.success'],
    ['weather'],
    ['a.b.c.d.e.f'],
  ])('accepts valid topic %s', (topic) => {
    expect(() => validateTopic(topic)).not.toThrow()
  })

  it.each([
    ['Weather.Requested'],
    ['weather/requested'],
    ['weather..requested'],
    ['1weather.x'],
    ['weather.'],
    ['.weather'],
    [''],
  ])('rejects invalid topic %s', (topic) => {
    let caught: unknown = null
    try {
      validateTopic(topic)
    } catch (e) {
      caught = e
    }
    expect(caught).not.toBeNull()
    expect(isBrokerError(caught)).toBe(true)
    expect((caught as { code: string }).code).toBe('topic.invalid')
  })
})

describe('validateTopicPattern', () => {
  it.each([
    ['weather.*'],
    ['*.failed'],
    ['weather.*.failed'],
    ['weather.requested'],
    ['*'],
    ['form.customer.*'],
  ])('accepts %s', (p) => {
    expect(() => validateTopicPattern(p)).not.toThrow()
  })

  it.each([['Weather.*'], ['weather/*'], ['weather..*']])('rejects %s', (p) => {
    expect(() => validateTopicPattern(p)).toThrow()
  })
})

describe('TopicTrie', () => {
  it('matches exact subscribed topic', () => {
    const trie = new TopicTrie<string>()
    trie.insert('weather.requested', 'A')
    expect(trie.match('weather.requested')).toEqual(['A'])
  })

  it('matches wildcard `weather.*` against `weather.requested` and `weather.loaded`', () => {
    const trie = new TopicTrie<string>()
    trie.insert('weather.*', 'W')
    expect(trie.match('weather.requested')).toEqual(['W'])
    expect(trie.match('weather.loaded')).toEqual(['W'])
  })

  it('combines exact + wildcard subscribers', () => {
    const trie = new TopicTrie<string>()
    trie.insert('weather.*', 'W')
    trie.insert('weather.requested', 'E')
    const result = trie.match('weather.requested')
    expect(result).toContain('W')
    expect(result).toContain('E')
    expect(result).toHaveLength(2)
  })

  it('does NOT match wildcard with different segment count', () => {
    const trie = new TopicTrie<string>()
    trie.insert('weather.alert.*', 'A')
    expect(trie.match('weather.requested')).toEqual([])
  })

  it('matches `weather.*.failed` against `weather.alert.failed` (D-11)', () => {
    const trie = new TopicTrie<string>()
    trie.insert('weather.*.failed', 'F')
    expect(trie.match('weather.alert.failed')).toEqual(['F'])
    expect(trie.match('weather.danger.failed')).toEqual(['F'])
  })

  it('matches `*.failed` against `weather.failed` and `auth.failed`', () => {
    const trie = new TopicTrie<string>()
    trie.insert('*.failed', 'F')
    expect(trie.match('weather.failed')).toEqual(['F'])
    expect(trie.match('auth.failed')).toEqual(['F'])
  })

  it('does NOT match `*.failed` against single-segment `failed`', () => {
    const trie = new TopicTrie<string>()
    trie.insert('*.failed', 'F')
    expect(trie.match('failed')).toEqual([])
  })

  it('insertion is idempotent (Set semantics)', () => {
    const trie = new TopicTrie<string>()
    trie.insert('x.y', 'A')
    trie.insert('x.y', 'A')
    expect(trie.match('x.y')).toEqual(['A'])
  })

  it('remove returns true on present, false on absent', () => {
    const trie = new TopicTrie<string>()
    trie.insert('a.b', 'A')
    expect(trie.remove('a.b', 'A')).toBe(true)
    expect(trie.remove('a.b', 'A')).toBe(false)
  })

  it('remove cleans empty branches', () => {
    const trie = new TopicTrie<string>()
    trie.insert('a.b.c', 'A')
    trie.remove('a.b.c', 'A')
    expect(trie.collectAllPatterns()).toEqual([])
  })

  it('collectAllPatterns returns subscribed patterns', () => {
    const trie = new TopicTrie<string>()
    trie.insert('weather.*', 'W')
    trie.insert('auth.failed', 'A')
    const patterns = trie.collectAllPatterns()
    expect(patterns).toContain('weather.*')
    expect(patterns).toContain('auth.failed')
  })

  it('performance: 10000 wildcard subscribers, single match < 50ms', () => {
    const trie = new TopicTrie<string>()
    for (let i = 0; i < 10000; i++) trie.insert(`ns${i}.*`, `S${i}`)
    trie.insert('weather.*', 'W')
    const start = performance.now()
    const result = trie.match('weather.requested')
    const elapsed = performance.now() - start
    expect(result).toContain('W')
    expect(elapsed).toBeLessThan(50)
  })
})
