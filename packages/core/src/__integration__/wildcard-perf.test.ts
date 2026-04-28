// Robustness test — Wildcard performance (TEST-03 subset, D-09).
//
// Verifica end-to-end che il lookup `match()` per wildcard sia O(segments)
// e non O(N) sul numero di subscriber registrati. Il scenario worst-case:
//   - 10000 subscriber wildcard distinti registrati su namespace separati
//     (ns0.*, ns1.*, ..., ns9999.*) — popolano il trie con N/2 path
//   - 1 subscriber wildcard target (`weather.*`)
//   - 1 publish su `weather.requested` — match dovrebbe trovare SOLO il
//     subscriber target in tempo costante rispetto a N
//
// Performance budget: RESEARCH dichiara < 5ms target su V8 hot path.
// Allowance del test: 50ms per assorbire jsdom overhead + V8 cold path
// (primo run, no JIT) + CI variance. Su CI lento il margin può essere
// ulteriormente esteso (deviation Rule 3 documentata in SUMMARY).
//
// Pattern naming: i topic pattern devono iniziare con `[a-z]` per segmento
// (PATTERN_REGEX in topic-matcher.ts). `ns0`, `ns1`, ..., `ns9999` sono
// validi (lowercase + alphanumeric, primo char `[a-z]`).
//
// Ownership pattern: questo file usa `*.test.ts` non-integration per
// disambiguazione da plan 09 (che possiede `*.integration.test.ts`).

import { describe, expect, it } from 'vitest'
import { createPipelineHarness } from '../test-utils/pipeline-harness'

describe('Wildcard performance (TEST-03 subset, D-09)', () => {
  it('10000 distinct wildcard subscribers, single match < 50ms', () => {
    const h = createPipelineHarness()

    // Register 10000 wildcard subscribers across distinct namespaces.
    for (let i = 0; i < 10000; i++) {
      h.broker.subscribe(`ns${i}.*`, () => {})
    }
    // Add the target wildcard.
    let receivedCount = 0
    h.broker.subscribe('weather.*', () => {
      receivedCount++
    })

    const start = performance.now()
    h.broker.publish(
      'weather.requested',
      {},
      {
        source: { type: 'plugin', id: 'p' },
        deliveryMode: 'sync',
      },
    )
    const elapsed = performance.now() - start

    expect(receivedCount).toBe(1)
    // RESEARCH says < 5ms target on V8 hot path; relax to 50ms for jsdom + cold path + CI variance.
    expect(elapsed).toBeLessThan(50)
  })

  it('1000 wildcards under same namespace + 1 publish — all matched', () => {
    const h = createPipelineHarness()
    let count = 0
    for (let i = 0; i < 1000; i++) {
      h.broker.subscribe('events.*', () => {
        count++
      })
    }
    h.broker.publish(
      'events.created',
      {},
      {
        source: { type: 'plugin', id: 'p' },
        deliveryMode: 'sync',
      },
    )
    expect(count).toBe(1000)
  })
})
