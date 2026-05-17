#!/usr/bin/env node
/**
 * check-d83-f16.mjs — D-83 strict septuple esteso v2.0 verifier per Phase 16
 * con ECCEZIONE devtools/src/.
 *
 * W1 P01 REAL IMPLEMENTATION (foundation F16 → carryover W2/W3/W4).
 *
 * Esegue 17 git diff checks ALL-ZERO sentinel su 3 cluster:
 *
 * **Cluster A — Strict septuple esteso F11..F14 v2.0 protected (8 packages):**
 *  1. `git diff $F10_END..HEAD -- packages/core/src/` (= 0)
 *  2. `git diff $F10_END..HEAD -- packages/microfrontends/src/` (= 0)
 *  3. `git diff $F10_END..HEAD -- packages/mapper/src/` (= 0)
 *  4. `git diff $F10_END..HEAD -- packages/context/src/` (= 0)
 *  5. `git diff $F11_END..HEAD -- packages/permissions/src/` (= 0)
 *  6. `git diff $F12_END..HEAD -- packages/compat/src/` (= 0)
 *  7. `git diff $F13_END..HEAD -- packages/isolation/src/` (= 0)
 *  8. `git diff $F14_END..HEAD -- packages/fallbacks/src/` (= 0)
 *
 * **Cluster B — F15 loaders frozen (4 packages):**
 *  9. `git diff $F15_END..HEAD -- packages/mf-web-component/src/` (= 0)
 * 10. `git diff $F15_END..HEAD -- packages/mf-iframe/src/` (= 0)
 * 11. `git diff $F15_END..HEAD -- packages/mf-module-federation/src/` (= 0)
 * 12. `git diff $F15_END..HEAD -- packages/mf-single-spa/src/` (= 0)
 *
 * **Cluster C — Frozen baseline v1.0/v1.1 (5 packages + mf-esm F9_END):**
 * 13-17. `git diff v1.1.0..HEAD -- packages/{theme,cache,gateway,worker,routing}/src/` (= 0)
 *        + `git diff $F9_END..HEAD -- packages/mf-esm/src/` (= 0)
 *
 * **TOTALE: 17 git diff checks** (8 v2.0 protected + 4 F15 frozen + 5 v1.x + mf-esm).
 *
 * **ECCEZIONE F16 D-V2-F16-14 lockata:**
 * `packages/devtools/src/` PUÒ avere diff additivo F16 (research SUMMARY linea 217 +
 * F8 CONTEXT linea 41 lockato). NO check su `packages/devtools/src/` in F16 verifier —
 * coerente con MIN-3 SnapshotProvider Registry + subpath `mf-inspector` lock.
 *
 * **ECCEZIONE F16 BC §42 `__bc_replay__/` test directory (W3 P03 fix):**
 * `packages/core/src/__bc_replay__/` è una test directory convention F8 (BC §42 14 API
 * verification — debug-snapshot-shape, metrics-shape, ecc.) — NON source code core.
 * F16 può estendere questa directory con NUOVI test scenari per BC §42 API #13/#14
 * D-V2-19 shape preservation (W1 P01 `devtools-snapshot-shape.test.ts` + W3 P03
 * `get-metrics-shape.test.ts`). Esclusione esplicita via pathspec `:(exclude)` analog
 * pattern F15 verifier (carryover Rule 4). Documentazione: W2 P02 SUMMARY linea 269
 * (plan-checker iter 2 PASS conferma `__bc_replay__/` test layer).
 *
 * Baseline resolution:
 *  - F9_END  = `7408f25` (frozen — completion F9 mf-esm closure, post-v1.1.0)
 *  - F10_END = `27dd7db` (frozen — completion F10)
 *  - F11_END = `a4aec0df` (frozen — completion F11 permissions closure)
 *  - F12_END = resolved at runtime via `git log --grep="^docs(12-05" -- packages/compat/src/`
 *  - F13_END = resolved at runtime via `git log --grep="^docs(13-05" -- packages/isolation/src/`
 *  - F14_END = `5a739b3` (frozen — completion F14 fallbacks closure)
 *  - F15_END = `30ef597` (frozen — completion F15 closure docs, da STATE.md last_activity)
 *  - V11_TAG = `v1.1.0` (frozen baseline v1.0/v1.1)
 *
 * Exit code:
 *  - 0 = PASS (all 17 checks return 0 diff lines)
 *  - 1 = FAIL (one or more checks > 0 diff lines OR resolution error)
 *
 * Output JSON-formatted per CI parsing.
 *
 * @see PLAN 16-01 Task 3 — verifier reale W1 P01 foundation
 * @see D-V2-F16-14 — eccezione D-83 devtools/src/ esplicita
 * @see PRD §47.11 — D-83 strict triple/quadruple/quintuple/sextuple/septuple/octuple/septuple-esteso
 * @see scripts/check-d83-f15.mjs (F15 template carryover Rule 4)
 */
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const F9_END = '7408f25' // Frozen — completion F9 (mf-esm closure, post-v1.1.0)
const F10_END = '27dd7db' // Frozen — completion F10
const F11_END = 'a4aec0df' // Frozen — completion F11 permissions closure
const F14_END = '5a739b3' // Frozen — completion F14 fallbacks closure
const F15_END = '30ef597' // Frozen — completion F15 closure docs (STATE.md last_activity)
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
    const sha = execSync(`git log --extended-regexp --grep="${grepPattern}" --format=%H -1`, {
      encoding: 'utf-8',
    }).trim()
    if (!sha) {
      console.error(
        `[check-d83-f16] FAIL: ${label} not resolved (grep miss — pattern ${grepPattern})`,
      )
      process.exit(1)
    }
    return sha
  } catch (err) {
    console.error(`[check-d83-f16] FAIL: ${label} resolution failed: ${err.message}`)
    process.exit(1)
  }
}

const F12_END = resolveBaseline('^docs\\(12-05', 'F12_END')
const F13_END = resolveBaseline('^docs\\(13-05', 'F13_END')

// F16 ECCEZIONE D-83 strict septuple esteso:
// packages/devtools/src/ PUÒ avere diff additivo F16 (research SUMMARY linea 217 +
// F8 CONTEXT linea 41 lockato). NO check su packages/devtools/src/ in F16 verifier —
// coerente con MIN-3 SnapshotProvider Registry + subpath mf-inspector lock (D-V2-F16-14).
const checks = [
  // Cluster A — Strict septuple esteso F11..F14 (8 v2.0 protected packages)
  {
    base: F10_END,
    path: 'packages/core/src/',
    name: 'core (F10_END strict)',
    // F16 BC §42 test directory exception (W1 P01 + W3 P03):
    // `__bc_replay__/` è test layer convention F8 — NON source core. F16 estende con
    // NUOVI test BC §42 API #13/#14 (devtools-snapshot-shape + get-metrics-shape).
    excludes: ['packages/core/src/__bc_replay__/'],
  },
  { base: F10_END, path: 'packages/microfrontends/src/', name: 'microfrontends (F10_END strict)' },
  { base: F10_END, path: 'packages/mapper/src/', name: 'mapper (F10_END strict)' },
  { base: F10_END, path: 'packages/context/src/', name: 'context (F10_END strict)' },
  { base: F11_END, path: 'packages/permissions/src/', name: 'permissions (F11_END strict)' },
  { base: F12_END, path: 'packages/compat/src/', name: 'compat (F12_END strict)' },
  { base: F13_END, path: 'packages/isolation/src/', name: 'isolation (F13_END strict)' },
  { base: F14_END, path: 'packages/fallbacks/src/', name: 'fallbacks (F14_END strict)' },
  // Cluster B — F15 loaders frozen (4 packages)
  { base: F15_END, path: 'packages/mf-web-component/src/', name: 'mf-web-component (F15_END strict)' },
  { base: F15_END, path: 'packages/mf-iframe/src/', name: 'mf-iframe (F15_END strict)' },
  { base: F15_END, path: 'packages/mf-module-federation/src/', name: 'mf-module-federation (F15_END strict)' },
  { base: F15_END, path: 'packages/mf-single-spa/src/', name: 'mf-single-spa (F15_END strict)' },
  // Cluster C — Frozen baseline v1.0/v1.1 (5 v1.x packages + mf-esm F9_END)
  { base: V11_TAG, path: 'packages/theme/src/', name: 'theme (v1.1 frozen)' },
  { base: V11_TAG, path: 'packages/cache/src/', name: 'cache (v1.0 frozen)' },
  { base: V11_TAG, path: 'packages/gateway/src/', name: 'gateway (v1.0 frozen)' },
  { base: V11_TAG, path: 'packages/worker/src/', name: 'worker (v1.0 frozen)' },
  { base: F9_END, path: 'packages/mf-esm/src/', name: 'mf-esm (F9_END frozen)' },
  { base: V11_TAG, path: 'packages/routing/src/', name: 'routing (v1.0 frozen)' },
  // NOTE: NO `packages/devtools/src/` check — D-V2-F16-14 eccezione esplicita F16.
]

const results = []
let allPass = true

for (const check of checks) {
  if (!existsSync(check.path)) {
    console.warn(`[check-d83-f16] skip ${check.name}: ${check.path} not found`)
    results.push({ ...check, diffLines: 0, pass: true, skipped: true })
    continue
  }
  let diffLines = 0
  let error
  try {
    // F16 W3 P03 fix — pathspec exclusions per BC §42 `__bc_replay__/` test directory
    // (carryover Rule 4 pattern F15 verifier: `:(exclude)<path>`).
    const excludeArgs = (check.excludes ?? [])
      .map((p) => `':(exclude)${p}'`)
      .join(' ')
    const cmd = `git diff ${check.base}..HEAD --numstat -- ${check.path} ${excludeArgs}`.trim()
    const out = execSync(cmd, { encoding: 'utf-8' })
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
  verifier: 'check-d83-f16.mjs',
  version: 'W1-P01-REAL',
  allPass,
  resolved: { F9_END, F10_END, F11_END, F12_END, F13_END, F14_END, F15_END, V11_TAG },
  totalChecks: checks.length,
  exception: 'packages/devtools/src/ EXCLUDED (D-V2-F16-14 — research SUMMARY linea 217)',
  exceptionBcReplay:
    'packages/core/src/__bc_replay__/ EXCLUDED da check core (F16 W3 P03 fix — BC §42 test directory F8 convention)',
  checks: results,
}

console.log(JSON.stringify(output, null, 2))

if (allPass) {
  console.log(
    '\n✅ D-83 strict septuple esteso F16 (8 v2.0 protected + 4 F15 + 5 v1.x + mf-esm = 17 checks): ALL ZERO-DIFF',
  )
  console.log('   ECCEZIONE: packages/devtools/src/ EXCLUDED (D-V2-F16-14 lockato F16)')
  console.log(
    '   ECCEZIONE: packages/core/src/__bc_replay__/ EXCLUDED da core check (BC §42 test directory F8)',
  )
}

process.exit(allPass ? 0 : 1)
