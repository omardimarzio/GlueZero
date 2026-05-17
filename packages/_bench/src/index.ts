/**
 * `@gluezero/_bench` — performance benchmark harness (private workspace).
 *
 * Esporta `runScenarioA` + `runScenarioB` per consumo programmatico
 * (es. comparazione CI multi-run + report). Runner principale: `src/run.ts`.
 *
 * @packageDocumentation
 */
export { runScenarioA } from './scenario-a.bench.js'
export { runScenarioB } from './scenario-b.bench.js'
export type { BenchResult } from './scenario-a.bench.js'
