/**
 * Bench Scenario A — `createBroker({})` + 1000 publish topics misti.
 *
 * Misura overhead baseline broker SENZA alcun modulo v2.0 installato.
 * Target regression vs baseline-v1.json: ≤ 5% (D-V2-F17-15 P-02 mitigation).
 *
 * @see MF-TEST-04
 * @see D-V2-F17-15
 */
import { Bench } from 'tinybench'
import { createBroker } from '@gluezero/core'

/**
 * 10 topic misti — copre singolo segmento + dotted multi-segment per
 * stressare il TopicTrie matching (carryover F1 D-11 wildcards).
 */
const TOPICS = [
  'topic.a',
  'topic.b',
  'topic.c.wild',
  'order.created',
  'order.failed',
  'cart.added',
  'system.warmup',
  'user.login',
  'user.logout',
  'view.changed',
] as const

/**
 * Source obbligatoria per `broker.publish` (D-23). Costante riusata per
 * minimizzare overhead di allocation in hot loop.
 */
const SOURCE = { type: 'plugin' as const, id: 'bench-a' }

export interface BenchResult {
  mean: number
  sd: number
  p75: number
  samples: number
}

export async function runScenarioA(): Promise<BenchResult> {
  const bench = new Bench({
    time: 200,
    iterations: 10,
    warmupTime: 50,
    warmupIterations: 3,
  })

  bench.add('Scenario A — createBroker({}) + 1000 publish', () => {
    const broker = createBroker({})
    for (let i = 0; i < 1000; i++) {
      const topic = TOPICS[i % TOPICS.length] as string
      broker.publish(topic, { idx: i }, { source: SOURCE })
    }
  })

  await bench.run()
  const task = bench.tasks[0]
  if (!task) throw new Error('Scenario A: no task')
  const result = task.result
  if (!result) throw new Error('Scenario A: no result')
  // tinybench types: result has latency.mean/sd/p75 (3.x API)
  const latency = (result as unknown as { latency?: { mean?: number; sd?: number; p75?: number; samples?: number[] } }).latency
  return {
    mean: latency?.mean ?? (result as unknown as { mean?: number }).mean ?? 0,
    sd: latency?.sd ?? (result as unknown as { sd?: number }).sd ?? 0,
    p75: latency?.p75 ?? (result as unknown as { p75?: number }).p75 ?? latency?.mean ?? 0,
    samples: latency?.samples?.length ?? 0,
  }
}

// Standalone runner: `pnpm bench:scenario-a`
const invokedDirectly = process.argv[1] !== undefined &&
  import.meta.url === `file://${process.argv[1]}`
if (invokedDirectly) {
  runScenarioA().then((r) => {
    console.log('Scenario A result:', JSON.stringify(r, null, 2))
  }).catch((err) => {
    console.error('Scenario A error:', err)
    process.exit(1)
  })
}
