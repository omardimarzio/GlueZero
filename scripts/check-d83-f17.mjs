#!/usr/bin/env node
/**
 * check-d83-f17.mjs — D-83 strict octuple esteso v2.0 verifier per Phase 17
 * (closure milestone GA — NO eccezione F17 devtools).
 *
 * F17 W7 P07 REAL IMPLEMENTATION (foundation closure milestone v2.0.0 GA).
 *
 * F17 closure: ZERO diff in TUTTI i package esistenti (16 v2.0 + 5 v1.x).
 * Codice F17 solo in:
 *  - packages/react/src/           (NEW W2 — @gluezero/react adapter)
 *  - packages/web-components/src/  (NEW W3 — @gluezero/web-components adapter + /lit subpath)
 *  - packages/_bench/src/          (NEW W4 — private workspace tinybench harness, no publish)
 *
 * **NO eccezione F17 devtools/src/** — la finestra additiva F16 D-V2-F16-14 è chiusa
 * post-W4 P04 F16. `git diff $F16_END..HEAD -- packages/devtools/src/` MUST = 0 lines
 * (D-V2-F17-18 zero eccezione lockata).
 *
 * Esegue **19 git diff checks ALL-ZERO sentinel** su 3 cluster:
 *
 * **Cluster A — Strict octuple esteso F11..F14 v2.0 protected (8 packages):**
 *  1. `git diff $F10_END..HEAD -- packages/core/src/` (= 0, escluso `__bc_replay__/`)
 *  2. `git diff $F10_END..HEAD -- packages/microfrontends/src/` (= 0)
 *  3. `git diff $F10_END..HEAD -- packages/mapper/src/` (= 0)
 *  4. `git diff $F10_END..HEAD -- packages/context/src/` (= 0)
 *  5. `git diff $F11_END..HEAD -- packages/permissions/src/` (= 0)
 *  6. `git diff $F12_END..HEAD -- packages/compat/src/` (= 0)
 *  7. `git diff $F13_END..HEAD -- packages/isolation/src/` (= 0)
 *  8. `git diff $F14_END..HEAD -- packages/fallbacks/src/` (= 0)
 *
 * **Cluster B — F15 loaders + F16 devtools frozen post-F16 (5 packages):**
 *  9. `git diff $F15_END..HEAD -- packages/mf-web-component/src/` (= 0)
 * 10. `git diff $F15_END..HEAD -- packages/mf-iframe/src/` (= 0)
 * 11. `git diff $F15_END..HEAD -- packages/mf-module-federation/src/` (= 0)
 * 12. `git diff $F15_END..HEAD -- packages/mf-single-spa/src/` (= 0)
 * 13. `git diff $F16_END..HEAD -- packages/devtools/src/` (= 0) **NO eccezione F17**
 *
 * **Cluster C — Frozen baseline v1.0/v1.1 + mf-esm F9 (6 packages):**
 * 14. `git diff v1.1.0..HEAD -- packages/theme/src/`   (= 0)
 * 15. `git diff v1.1.0..HEAD -- packages/cache/src/`   (= 0)
 * 16. `git diff v1.1.0..HEAD -- packages/gateway/src/` (= 0)
 * 17. `git diff v1.1.0..HEAD -- packages/worker/src/`  (= 0)
 * 18. `git diff v1.1.0..HEAD -- packages/routing/src/` (= 0)
 * 19. `git diff $F9_END..HEAD -- packages/mf-esm/src/` (= 0)
 *
 * **TOTALE: 19 git diff checks ALL-ZERO** (8 v2.0 protected + 5 F15/F16 frozen + 6 v1.x/mf-esm frozen).
 *
 * Baseline resolution:
 *  - F9_END  = `7408f25` (frozen — completion F9 mf-esm closure, post-v1.1.0)
 *  - F10_END = `27dd7db` (frozen — completion F10 core/microfrontends/mapper/context)
 *  - F11_END = `a4aec0df` (frozen — completion F11 permissions closure)
 *  - F12_END = resolved at runtime via `git log --grep="^docs(12-05" -- packages/compat/src/`
 *  - F13_END = resolved at runtime via `git log --grep="^docs(13-05" -- packages/isolation/src/`
 *  - F14_END = `5a739b3` (frozen — completion F14 fallbacks closure)
 *  - F15_END = `30ef597` (frozen — completion F15 4 loaders closure)
 *  - F16_END = resolved at runtime via `git log --grep="^docs(16-04" -- packages/devtools/src/`
 *  - V11_TAG = `v1.1.0` (frozen baseline v1.0/v1.1 — theme/cache/gateway/worker/routing)
 *
 * Exit code:
 *  - 0 = PASS (all 19 checks return 0 diff lines)
 *  - 1 = FAIL (one or more checks > 0 diff lines OR resolution error)
 *
 * Output JSON-formatted per CI parsing.
 *
 * @see PLAN 17-07 Task 1 — verifier reale W7 P07 foundation GA closure
 * @see D-V2-F17-18 — zero eccezione devtools F17 (finestra F16 chiusa)
 * @see PRD §47.11 — D-83 strict triple/quadruple/quintuple/sextuple/septuple/octuple/octuple-esteso
 * @see scripts/check-d83-f16.mjs (F16 template carryover septuple esteso + eccezione devtools)
 */
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const F9_END = '7408f25' // Frozen — completion F9 (mf-esm closure, post-v1.1.0)
const F10_END = '27dd7db' // Frozen — completion F10
const F11_END = 'a4aec0df' // Frozen — completion F11 permissions closure
const F14_END = '5a739b3' // Frozen — completion F14 fallbacks closure
const F15_END = '30ef597' // Frozen — completion F15 4 loaders closure
const V11_TAG = 'v1.1.0' // Frozen baseline v1.0/v1.1

/**
 * Resolve baseline SHA via grep su commit history (fallback per F12/F13/F16 squashable).
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
        `[check-d83-f17] FAIL: ${label} not resolved (grep miss — pattern ${grepPattern})`,
      )
      process.exit(1)
    }
    return sha
  } catch (err) {
    console.error(`[check-d83-f17] FAIL: ${label} resolution failed: ${err.message}`)
    process.exit(1)
  }
}

const F12_END = resolveBaseline('^docs\\(12-05', 'F12_END')
const F13_END = resolveBaseline('^docs\\(13-05', 'F13_END')
const F16_END = resolveBaseline('^docs\\(16-04', 'F16_END')

// F17 ZERO eccezione D-83 strict octuple esteso:
// packages/devtools/src/ NO ulteriori diff post-F16 (D-V2-F17-18). Cluster B include
// devtools check con base = F16_END (finestra additiva F16 chiusa).
const checks = [
  // Cluster A — Strict octuple esteso F11..F14 (8 v2.0 protected packages)
  {
    base: F10_END,
    path: 'packages/core/src/',
    name: 'core (F10_END strict)',
    // F16/F17 BC §42 test directory exception (carryover W3 P03 F16):
    // `__bc_replay__/` è test layer convention F8 — NON source core. F16 ha esteso con
    // NUOVI test BC §42 API #13/#14 (devtools-snapshot-shape + get-metrics-shape).
    // F17 NON estende ulteriori test ma preserva l'exclusion per consistency carryover.
    excludes: ['packages/core/src/__bc_replay__/'],
  },
  { base: F10_END, path: 'packages/microfrontends/src/', name: 'microfrontends (F10_END strict)' },
  { base: F10_END, path: 'packages/mapper/src/', name: 'mapper (F10_END strict)' },
  { base: F10_END, path: 'packages/context/src/', name: 'context (F10_END strict)' },
  { base: F11_END, path: 'packages/permissions/src/', name: 'permissions (F11_END strict)' },
  { base: F12_END, path: 'packages/compat/src/', name: 'compat (F12_END strict)' },
  { base: F13_END, path: 'packages/isolation/src/', name: 'isolation (F13_END strict)' },
  { base: F14_END, path: 'packages/fallbacks/src/', name: 'fallbacks (F14_END strict)' },
  // Cluster B — F15 loaders + F16 devtools frozen post-F16 (5 packages, NO eccezione F17)
  { base: F15_END, path: 'packages/mf-web-component/src/', name: 'mf-web-component (F15_END strict)' },
  { base: F15_END, path: 'packages/mf-iframe/src/', name: 'mf-iframe (F15_END strict)' },
  { base: F15_END, path: 'packages/mf-module-federation/src/', name: 'mf-module-federation (F15_END strict)' },
  { base: F15_END, path: 'packages/mf-single-spa/src/', name: 'mf-single-spa (F15_END strict)' },
  { base: F16_END, path: 'packages/devtools/src/', name: 'devtools (F16_END NO eccezione F17)' },
  // Cluster C — Frozen baseline v1.0/v1.1 (5 v1.x packages + mf-esm F9_END)
  { base: V11_TAG, path: 'packages/theme/src/', name: 'theme (v1.1 frozen)' },
  { base: V11_TAG, path: 'packages/cache/src/', name: 'cache (v1.0 frozen)' },
  { base: V11_TAG, path: 'packages/gateway/src/', name: 'gateway (v1.0 frozen)' },
  { base: V11_TAG, path: 'packages/worker/src/', name: 'worker (v1.0 frozen)' },
  { base: V11_TAG, path: 'packages/routing/src/', name: 'routing (v1.0 frozen)' },
  { base: F9_END, path: 'packages/mf-esm/src/', name: 'mf-esm (F9_END frozen)' },
]

const results = []
let allPass = true

for (const check of checks) {
  if (!existsSync(check.path)) {
    console.warn(`[check-d83-f17] skip ${check.name}: ${check.path} not found`)
    results.push({ ...check, diffLines: 0, pass: true, skipped: true })
    continue
  }
  let diffLines = 0
  let error
  try {
    // F17 carryover Rule 4 pattern F16 verifier — pathspec exclusions per BC §42
    // `__bc_replay__/` test directory (carryover F15 verifier: `:(exclude)<path>`).
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
  verifier: 'check-d83-f17.mjs',
  version: 'W7-P07-REAL',
  allPass,
  resolved: { F9_END, F10_END, F11_END, F12_END, F13_END, F14_END, F15_END, F16_END, V11_TAG },
  totalChecks: checks.length,
  exception:
    'ZERO eccezione F17 — devtools/src/ frozen post-F16 (D-V2-F17-18). Finestra additiva F16 chiusa.',
  exceptionBcReplay:
    'packages/core/src/__bc_replay__/ EXCLUDED da check core (carryover F16 W3 P03 — BC §42 test directory F8 convention)',
  newPackagesF17: [
    'packages/react/src/ (NEW W2 — @gluezero/react adapter)',
    'packages/web-components/src/ (NEW W3 — @gluezero/web-components + /lit subpath)',
    'packages/_bench/src/ (NEW W4 — tinybench harness private)',
  ],
  checks: results,
}

console.log(JSON.stringify(output, null, 2))

if (allPass) {
  console.log(
    '\n✅ D-83 strict octuple esteso F17 (8 v2.0 protected + 5 F15/F16 frozen + 6 v1.x/mf-esm frozen = 19 checks): ALL ZERO-DIFF',
  )
  console.log(
    '   F17 codice solo in: packages/{react,web-components,_bench}/src/ (NEW). ZERO eccezione devtools F17 (D-V2-F17-18 lockato).',
  )
  console.log(
    '   ECCEZIONE BC §42: packages/core/src/__bc_replay__/ EXCLUDED da core check (carryover F16 W3 P03)',
  )
}

process.exit(allPass ? 0 : 1)
