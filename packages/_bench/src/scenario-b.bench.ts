/**
 * Bench Scenario B — `createBroker({ modules: [microfrontendModule()] })` + 1000 publish.
 *
 * Misura overhead con `microfrontendModule` installato MA ZERO MF attivi.
 * Target regression vs baseline-v1.json: ≤ 10% (D-V2-F17-15).
 *
 * @see MF-TEST-04
 * @see D-V2-F17-15
 */
import { Bench } from 'tinybench'
import { createBroker } from '@gluezero/core'
import { microfrontendModule } from '@gluezero/microfrontends'
import type { BenchResult } from './scenario-a.bench.js'

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

const SOURCE = { type: 'plugin' as const, id: 'bench-b' }

export async function runScenarioB(): Promise<BenchResult> {
  const bench = new Bench({
    time: 200,
    iterations: 10,
    warmupTime: 50,
    warmupIterations: 3,
  })

  bench.add('Scenario B — createBroker({modules:[microfrontendModule()]}) + 1000 publish', () => {
    const broker = createBroker({ modules: [microfrontendModule()] })
    for (let i = 0; i < 1000; i++) {
      const topic = TOPICS[i % TOPICS.length] as string
      broker.publish(topic, { idx: i }, { source: SOURCE })
    }
  })

  await bench.run()
  const task = bench.tasks[0]
  if (!task) throw new Error('Scenario B: no task')
  const result = task.result
  if (!result) throw new Error('Scenario B: no result')
  const latency = (result as unknown as { latency?: { mean?: number; sd?: number; p75?: number; samples?: number[] } }).latency
  return {
    mean: latency?.mean ?? (result as unknown as { mean?: number }).mean ?? 0,
    sd: latency?.sd ?? (result as unknown as { sd?: number }).sd ?? 0,
    p75: latency?.p75 ?? (result as unknown as { p75?: number }).p75 ?? latency?.mean ?? 0,
    samples: latency?.samples?.length ?? 0,
  }
}

const invokedDirectly = process.argv[1] !== undefined &&
  import.meta.url === `file://${process.argv[1]}`
if (invokedDirectly) {
  runScenarioB().then((r) => {
    console.log('Scenario B result:', JSON.stringify(r, null, 2))
  }).catch((err) => {
    console.error('Scenario B error:', err)
    process.exit(1)
  })
}
