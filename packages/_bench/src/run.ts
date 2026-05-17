/**
 * Bench runner — esegue scenario A + B, confronta con baseline-v1.json,
 * exit 1 se regression > 5% (A) o > 10% (B).
 *
 * CI hard gate (D-V2-F17-15 + P-02 mitigation).
 *
 * @example Local
 * ```bash
 * pnpm --filter @gluezero/_bench bench
 * ```
 *
 * @example CI
 * ```yaml
 * # .github/workflows/bench.yml
 * - run: pnpm --filter @gluezero/_bench bench
 * ```
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { runScenarioA } from './scenario-a.bench.js'
import { runScenarioB } from './scenario-b.bench.js'

interface Baseline {
  scenarioA_mean_ms: number
  scenarioA_p75_ms: number
  scenarioA_sd_ms: number
  scenarioB_mean_ms: number
  scenarioB_p75_ms: number
  scenarioB_sd_ms: number
}

/** Cap regression Scenario A — 5% (D-V2-F17-15, PRD §43). */
const CAP_A = 0.05
/** Cap regression Scenario B — 10% (D-V2-F17-15, PRD §43). */
const CAP_B = 0.10

function loadBaseline(): Baseline {
  const here = dirname(fileURLToPath(import.meta.url))
  const path = resolve(here, './baseline-v1.json')
  const raw = readFileSync(path, 'utf-8')
  return JSON.parse(raw) as Baseline
}

function pctRegression(actual: number, baseline: number): number {
  return (actual - baseline) / baseline
}

async function main(): Promise<void> {
  console.log('Loading baseline...')
  const baseline = loadBaseline()

  console.log('Running Scenario A...')
  const aResult = await runScenarioA()
  console.log(`Scenario A actual: mean=${aResult.mean.toFixed(4)} ms, p75=${aResult.p75.toFixed(4)} ms`)
  const aPct = pctRegression(aResult.mean, baseline.scenarioA_mean_ms)
  console.log(`Scenario A regression: ${(aPct * 100).toFixed(2)}% (cap ${CAP_A * 100}%)`)

  console.log('Running Scenario B...')
  const bResult = await runScenarioB()
  console.log(`Scenario B actual: mean=${bResult.mean.toFixed(4)} ms, p75=${bResult.p75.toFixed(4)} ms`)
  const bPct = pctRegression(bResult.mean, baseline.scenarioB_mean_ms)
  console.log(`Scenario B regression: ${(bPct * 100).toFixed(2)}% (cap ${CAP_B * 100}%)`)

  const failures: string[] = []
  if (aPct > CAP_A) {
    failures.push(`Scenario A regression ${(aPct * 100).toFixed(2)}% > cap ${CAP_A * 100}%`)
  }
  if (bPct > CAP_B) {
    failures.push(`Scenario B regression ${(bPct * 100).toFixed(2)}% > cap ${CAP_B * 100}%`)
  }

  if (failures.length > 0) {
    console.error('\nBENCH FAIL:')
    for (const f of failures) console.error(`  - ${f}`)
    console.error(
      '\nIf intentional (e.g., new feature with documented cost), update baseline-v1.json with justification commit message.',
    )
    process.exit(1)
  }

  console.log('\nBENCH PASS — all scenarios within regression cap.')
}

main().catch((err) => {
  console.error('Bench runner error:', err)
  process.exit(1)
})
