/**
 * Test cardinality + literal types narrowing dei standard topics (D-V2-F8-12).
 *
 * Verifica:
 * - Cardinality lockata 17 + 7 + 5 = 29 topics
 * - Prefix `microfrontend.` su tutti
 * - Uniqueness cross-array
 * - Content specifico (PRD §31)
 * - Mapping helpers state → topic + phase → error topic
 * - Union types narrowing compile-time
 *
 * @see PRD §31 + RESEARCH §5
 */
import { describe, expect, it } from 'vitest'
import {
  MF_ERROR_TOPIC_FOR_PHASE,
  MF_ERROR_TOPICS,
  MF_GOVERNANCE_TOPICS,
  MF_LIFECYCLE_TOPIC_FOR_STATE,
  MF_LIFECYCLE_TOPICS,
  type MfStandardTopic,
} from './topics'

describe('Standard topics — cardinality lockata D-V2-F8-12', () => {
  it('MF_LIFECYCLE_TOPICS ha esattamente 17 elementi (PRD §31.1)', () => {
    expect(MF_LIFECYCLE_TOPICS).toHaveLength(17)
  })

  it('MF_ERROR_TOPICS ha esattamente 7 elementi (PRD §31.2)', () => {
    expect(MF_ERROR_TOPICS).toHaveLength(7)
  })

  it('MF_GOVERNANCE_TOPICS ha esattamente 5 elementi (PRD §31.3)', () => {
    expect(MF_GOVERNANCE_TOPICS).toHaveLength(5)
  })

  it('totale 29 standard topics (17+7+5)', () => {
    const totalCount =
      MF_LIFECYCLE_TOPICS.length + MF_ERROR_TOPICS.length + MF_GOVERNANCE_TOPICS.length
    expect(totalCount).toBe(29)
  })
})

describe('Standard topics — naming prefix', () => {
  it('lifecycle topics tutti iniziano con "microfrontend."', () => {
    for (const topic of MF_LIFECYCLE_TOPICS) {
      expect(topic.startsWith('microfrontend.')).toBe(true)
    }
  })

  it('error topics tutti contengono ".failed"', () => {
    for (const topic of MF_ERROR_TOPICS) {
      expect(topic).toContain('.failed')
      expect(topic.startsWith('microfrontend.')).toBe(true)
    }
  })

  it('governance topics tutti iniziano con "microfrontend." e hanno scope-specifico', () => {
    for (const topic of MF_GOVERNANCE_TOPICS) {
      expect(topic.startsWith('microfrontend.')).toBe(true)
    }
  })

  it('topics uniqueness — nessun duplicato cross-array', () => {
    const all = [...MF_LIFECYCLE_TOPICS, ...MF_ERROR_TOPICS, ...MF_GOVERNANCE_TOPICS]
    const set = new Set(all)
    expect(set.size).toBe(all.length)
  })

  it('tutti i topics match regex /^microfrontend\\.[a-z.]+$/', () => {
    const re = /^microfrontend\.[a-z.]+$/
    const all = [...MF_LIFECYCLE_TOPICS, ...MF_ERROR_TOPICS, ...MF_GOVERNANCE_TOPICS]
    for (const topic of all) {
      expect(topic).toMatch(re)
    }
  })
})

describe('Standard topics — specific content (PRD §31)', () => {
  it('lifecycle include "microfrontend.registered"', () => {
    expect(MF_LIFECYCLE_TOPICS).toContain('microfrontend.registered')
  })

  it('lifecycle include "microfrontend.mounted"', () => {
    expect(MF_LIFECYCLE_TOPICS).toContain('microfrontend.mounted')
  })

  it('lifecycle include "microfrontend.failed"', () => {
    expect(MF_LIFECYCLE_TOPICS).toContain('microfrontend.failed')
  })

  it('lifecycle include "microfrontend.reloaded" (F9-effective)', () => {
    expect(MF_LIFECYCLE_TOPICS).toContain('microfrontend.reloaded')
  })

  it('error include "microfrontend.load.failed"', () => {
    expect(MF_ERROR_TOPICS).toContain('microfrontend.load.failed')
  })

  it('error include "microfrontend.runtime.failed"', () => {
    expect(MF_ERROR_TOPICS).toContain('microfrontend.runtime.failed')
  })

  it('governance include "microfrontend.permission.denied"', () => {
    expect(MF_GOVERNANCE_TOPICS).toContain('microfrontend.permission.denied')
  })

  it('governance include "microfrontend.fallback.rendered"', () => {
    expect(MF_GOVERNANCE_TOPICS).toContain('microfrontend.fallback.rendered')
  })
})

describe('Topic helpers — state/phase mapping', () => {
  it('MF_LIFECYCLE_TOPIC_FOR_STATE.registered → "microfrontend.registered"', () => {
    expect(MF_LIFECYCLE_TOPIC_FOR_STATE.registered).toBe('microfrontend.registered')
  })

  it('MF_LIFECYCLE_TOPIC_FOR_STATE.mounted → "microfrontend.mounted"', () => {
    expect(MF_LIFECYCLE_TOPIC_FOR_STATE.mounted).toBe('microfrontend.mounted')
  })

  it('MF_ERROR_TOPIC_FOR_PHASE.load → "microfrontend.load.failed"', () => {
    expect(MF_ERROR_TOPIC_FOR_PHASE.load).toBe('microfrontend.load.failed')
  })

  it('MF_ERROR_TOPIC_FOR_PHASE.mount → "microfrontend.mount.failed"', () => {
    expect(MF_ERROR_TOPIC_FOR_PHASE.mount).toBe('microfrontend.mount.failed')
  })

  it('MF_ERROR_TOPIC_FOR_PHASE.runtime → "microfrontend.runtime.failed"', () => {
    expect(MF_ERROR_TOPIC_FOR_PHASE.runtime).toBe('microfrontend.runtime.failed')
  })
})

describe('Union types narrowing — compile-time verify', () => {
  it('MfStandardTopic accetta lifecycle topic literal', () => {
    const t: MfStandardTopic = 'microfrontend.mounted'
    expect(MF_LIFECYCLE_TOPICS).toContain(t)
  })

  it('MfStandardTopic accetta error topic literal', () => {
    const t: MfStandardTopic = 'microfrontend.load.failed'
    expect(MF_ERROR_TOPICS).toContain(t)
  })

  it('MfStandardTopic accetta governance topic literal', () => {
    const t: MfStandardTopic = 'microfrontend.permission.denied'
    expect(MF_GOVERNANCE_TOPICS).toContain(t)
  })
})
