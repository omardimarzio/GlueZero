#!/usr/bin/env node
/**
 * check-d83-f13.mjs — D-83 strict SEXTUPLE esteso v2.0 verifier per Phase 13.
 *
 * W3 P05 REAL IMPLEMENTATION (sostituisce W1 placeholder smoke gate).
 *
 * Esegue 11 git diff checks ALL-ZERO sentinel:
 *
 * 1. `git diff $F10_END..HEAD -- packages/core/src/` (= 0)
 * 2. `git diff $F10_END..HEAD -- packages/microfrontends/src/` (= 0)
 * 3. `git diff $F10_END..HEAD -- packages/mapper/src/` (= 0)
 * 4. `git diff $F10_END..HEAD -- packages/context/src/` (= 0)
 * 5. `git diff $F11_END..HEAD -- packages/permissions/src/` (= 0)
 * 6. `git diff $F12_END..HEAD -- packages/compat/src/` (= 0)
 * 7-13. `git diff v1.1.0..HEAD -- packages/{theme,cache,gateway,worker,mf-esm,devtools,routing}/src/` (= 0)
 *
 * F10_END = 27dd7db (frozen — completion F10)
 * F11_END = resolved at runtime via `git log --grep="^docs(11-05-permissions-closure):" --format=%H -1`
 * F12_END = resolved at runtime via `git log --grep="^docs(12-05" --format=%H -1` (12-05 OR 12-05-compat-w3-closure)
 *
 * Exit code:
 *  - 0 = PASS (all 11 checks return 0 diff lines)
 *  - 1 = FAIL (one or more checks > 0 diff lines OR resolution error)
 *
 * Output JSON-formatted per CI parsing.
 *
 * @see PLAN 13-05 Task 4 — verifier reale W3 closure
 * @see D-V2-F13-22 — D-83 strict SEXTUPLE esteso v2.0
 * @see PRD §47.11 — D-83 strict triple/quadruple/quintuple/sextuple esteso
 */
import { execSync } from 'node:child_process'

const F10_END = '27dd7db' // Frozen — completion F10
const F9_END = '7408f25' // Frozen — completion F9 (mf-esm closure, post-v1.1.0)
const V11_TAG = 'v1.1.0' // Frozen baseline v1.0/v1.1

// Resolve F11_END at runtime
let F11_END
try {
  F11_END = execSync(
    'git log --extended-regexp --grep="^docs\\(11-05-permissions-closure\\):" --format=%H -1',
    { encoding: 'utf-8' },
  ).trim()
  if (!F11_END) {
    console.error('[check-d83-f13] FAIL: F11_END not resolved (grep miss — pattern ^docs(11-05-permissions-closure):)')
    process.exit(1)
  }
} catch (err) {
  console.error(`[check-d83-f13] FAIL: F11_END resolution failed: ${err.message}`)
  process.exit(1)
}

// Resolve F12_END at runtime (matches either ^docs(12-05): or ^docs(12-05-compat-w3-closure):)
let F12_END
try {
  F12_END = execSync(
    'git log --extended-regexp --grep="^docs\\(12-05" --format=%H -1',
    { encoding: 'utf-8' },
  ).trim()
  if (!F12_END) {
    console.error('[check-d83-f13] FAIL: F12_END not resolved (grep miss — pattern ^docs(12-05)')
    process.exit(1)
  }
} catch (err) {
  console.error(`[check-d83-f13] FAIL: F12_END resolution failed: ${err.message}`)
  process.exit(1)
}

const checks = [
  // F10_END..HEAD strict for 4 packages (core + microfrontends + mapper + context)
  { base: F10_END, path: 'packages/core/src/', name: 'core (F10_END strict)' },
  { base: F10_END, path: 'packages/microfrontends/src/', name: 'microfrontends (F10_END strict)' },
  { base: F10_END, path: 'packages/mapper/src/', name: 'mapper (F10_END strict)' },
  { base: F10_END, path: 'packages/context/src/', name: 'context (F10_END strict)' },
  // F11_END..HEAD strict for permissions
  { base: F11_END, path: 'packages/permissions/src/', name: 'permissions (F11_END strict)' },
  // F12_END..HEAD strict for compat
  { base: F12_END, path: 'packages/compat/src/', name: 'compat (F12_END strict)' },
  // Frozen baseline v1.1.0..HEAD for 7 v1.x packages
  { base: V11_TAG, path: 'packages/theme/src/', name: 'theme (v1.1 frozen)' },
  { base: V11_TAG, path: 'packages/cache/src/', name: 'cache (v1.0 frozen)' },
  { base: V11_TAG, path: 'packages/gateway/src/', name: 'gateway (v1.0 frozen)' },
  { base: V11_TAG, path: 'packages/worker/src/', name: 'worker (v1.0 frozen)' },
  // mf-esm finalized in F9 (post-v1.1.0) — use F9_END baseline (Rule 1 fix W3 P05 plan baseline drift)
  { base: F9_END, path: 'packages/mf-esm/src/', name: 'mf-esm (F9_END frozen)' },
  { base: V11_TAG, path: 'packages/devtools/src/', name: 'devtools (frozen)' },
  { base: V11_TAG, path: 'packages/routing/src/', name: 'routing (frozen)' },
]

const results = []
let allPass = true

for (const check of checks) {
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
  verifier: 'check-d83-f13.mjs',
  version: 'W3-P05-REAL',
  allPass,
  resolved: { F10_END, F11_END, F12_END, F9_END, V11_TAG },
  checks: results,
}

console.log(JSON.stringify(output, null, 2))
process.exit(allPass ? 0 : 1)
