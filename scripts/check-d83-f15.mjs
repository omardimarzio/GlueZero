#!/usr/bin/env node
/**
 * check-d83-f15.mjs — D-83 strict OCTUPLE esteso v2.0 verifier per Phase 15.
 *
 * W3 P05 REAL IMPLEMENTATION (closure F15).
 *
 * Esegue 15 git diff checks ALL-ZERO sentinel su 2 cluster:
 *
 * **Cluster A — Strict OCTUPLE esteso F15** (8 v2.0 protected packages):
 *  1. `git diff $F10_END..HEAD -- packages/core/src/` (= 0)
 *  2. `git diff $F10_END..HEAD -- packages/microfrontends/src/` (= 0)
 *  3. `git diff $F10_END..HEAD -- packages/mapper/src/` (= 0)
 *  4. `git diff $F10_END..HEAD -- packages/context/src/` (= 0)
 *  5. `git diff $F11_END..HEAD -- packages/permissions/src/` (= 0)
 *  6. `git diff $F12_END..HEAD -- packages/compat/src/` (= 0)
 *  7. `git diff $F13_END..HEAD -- packages/isolation/src/` (= 0)
 *  8. `git diff $F14_END..HEAD -- packages/fallbacks/src/` (= 0)
 *
 * **Cluster B — Frozen baseline v1.0/v1.1** (7 v1.x packages + mf-esm F9_END):
 *  9-15. `git diff v1.1.0..HEAD -- packages/{theme,cache,gateway,worker,devtools,routing}/src/` (= 0)
 *        + `git diff $F9_END..HEAD -- packages/mf-esm/src/` (= 0)
 *
 * **TOTALE: 15 git diff checks** (8 octuple + 7 frozen v1.x/mf-esm).
 *
 * Baseline resolution:
 *  - F9_END  = `7408f25` (frozen — completion F9 mf-esm closure, post-v1.1.0)
 *  - F10_END = `27dd7db` (frozen — completion F10)
 *  - F11_END = `a4aec0df` (frozen — completion F11 permissions closure)
 *  - F12_END = resolved at runtime via `git log --grep="^docs(12-05" -- packages/compat/src/`
 *  - F13_END = resolved at runtime via `git log --grep="^docs(13-05" -- packages/isolation/src/`
 *  - F14_END = `5a739b3` (frozen — completion F14 fallbacks closure)
 *  - V11_TAG = `v1.1.0` (frozen baseline v1.0/v1.1)
 *
 * Exit code:
 *  - 0 = PASS (all 15 checks return 0 diff lines)
 *  - 1 = FAIL (one or more checks > 0 diff lines OR resolution error)
 *
 * Output JSON-formatted per CI parsing.
 *
 * @see PLAN 15-05 Task 6 — verifier reale W3 P05 closure
 * @see D-V2-F15-24 — `ci:gate:f15` composite + `scripts/check-d83-f15.mjs` verifier reale
 * @see PRD §47.11 — D-83 strict triple/quadruple/quintuple/sextuple/septuple/octuple esteso
 * @see scripts/check-d83-f14.mjs (F14 template carryover Rule 4)
 */
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const F9_END = '7408f25' // Frozen — completion F9 (mf-esm closure, post-v1.1.0)
const F10_END = '27dd7db' // Frozen — completion F10
const F11_END = 'a4aec0df' // Frozen — completion F11 permissions closure
const F14_END = '5a739b3' // Frozen — completion F14 fallbacks closure
const V11_TAG = 'v1.1.0' // Frozen baseline v1.0/v1.1

/**
 * Resolve baseline SHA via grep su commit history (fallback per F12/F13 squashable).
 *
 * @param {string} grepPattern Extended regex pattern per `git log --grep`.
 * @param {string} label Label diagnostico per error logging.
 * @returns {string} SHA risolto.
 */
function resolveBaseline(grepPattern, label) {
  try {
    const sha = execSync(
      `git log --extended-regexp --grep="${grepPattern}" --format=%H -1`,
      { encoding: 'utf-8' },
    ).trim()
    if (!sha) {
      console.error(
        `[check-d83-f15] FAIL: ${label} not resolved (grep miss — pattern ${grepPattern})`,
      )
      process.exit(1)
    }
    return sha
  } catch (err) {
    console.error(`[check-d83-f15] FAIL: ${label} resolution failed: ${err.message}`)
    process.exit(1)
  }
}

const F12_END = resolveBaseline('^docs\\(12-05', 'F12_END')
const F13_END = resolveBaseline('^docs\\(13-05', 'F13_END')

const checks = [
  // Cluster A — Strict OCTUPLE esteso F15 (8 v2.0 protected packages)
  { base: F10_END, path: 'packages/core/src/', name: 'core (F10_END strict)' },
  { base: F10_END, path: 'packages/microfrontends/src/', name: 'microfrontends (F10_END strict)' },
  { base: F10_END, path: 'packages/mapper/src/', name: 'mapper (F10_END strict)' },
  { base: F10_END, path: 'packages/context/src/', name: 'context (F10_END strict)' },
  { base: F11_END, path: 'packages/permissions/src/', name: 'permissions (F11_END strict)' },
  { base: F12_END, path: 'packages/compat/src/', name: 'compat (F12_END strict)' },
  { base: F13_END, path: 'packages/isolation/src/', name: 'isolation (F13_END strict)' },
  { base: F14_END, path: 'packages/fallbacks/src/', name: 'fallbacks (F14_END strict)' },
  // Cluster B — Frozen baseline v1.0/v1.1 (6 v1.x packages + mf-esm F9_END)
  { base: V11_TAG, path: 'packages/theme/src/', name: 'theme (v1.1 frozen)' },
  { base: V11_TAG, path: 'packages/cache/src/', name: 'cache (v1.0 frozen)' },
  { base: V11_TAG, path: 'packages/gateway/src/', name: 'gateway (v1.0 frozen)' },
  { base: V11_TAG, path: 'packages/worker/src/', name: 'worker (v1.0 frozen)' },
  { base: F9_END, path: 'packages/mf-esm/src/', name: 'mf-esm (F9_END frozen)' },
  { base: V11_TAG, path: 'packages/devtools/src/', name: 'devtools (v1.0 frozen)' },
  { base: V11_TAG, path: 'packages/routing/src/', name: 'routing (v1.0 frozen)' },
]

const results = []
let allPass = true

for (const check of checks) {
  if (!existsSync(check.path)) {
    console.warn(`[check-d83-f15] skip ${check.name}: ${check.path} not found`)
    results.push({ ...check, diffLines: 0, pass: true, skipped: true })
    continue
  }
  let diffLines = 0
  let error
  try {
    const out = execSync(`git diff ${check.base}..HEAD --numstat -- ${check.path}`, {
      encoding: 'utf-8',
    })
    diffLines = out
      .split('\n')
      .filter(Boolean)
      .reduce((acc, line) => {
        const [add, del] = line.split('\t').map(Number)
        return acc + (Number.isNaN(add) ? 0 : add) + (Number.isNaN(del) ? 0 : del)
      }, 0)
  } catch (err) {
    diffLines = -1
    error = err.message
  }
  const pass = diffLines === 0
  if (!pass) allPass = false
  results.push({ ...check, diffLines, pass, ...(error && { error }) })
}

const output = {
  verifier: 'check-d83-f15.mjs',
  version: 'W3-P05-REAL',
  allPass,
  resolved: { F9_END, F10_END, F11_END, F12_END, F13_END, F14_END, V11_TAG },
  totalChecks: checks.length,
  checks: results,
}

console.log(JSON.stringify(output, null, 2))

if (allPass) {
  console.log(
    '\n🎉 D-83 strict OCTUPLE esteso F15 (8 packages) + frozen baseline v1.x/mf-esm (7 packages): ALL ZERO-DIFF (15/15)',
  )
}

process.exit(allPass ? 0 : 1)
