/**
 * v1-bc-replay — Bundle cap freeze `@gluezero/core` consumer v1.x senza modules.
 *
 * D-V2-21 BLOCKING: cap raise +350 B allowance per MIN-1+MIN-2. La baseline
 * PRISTINE attuale empiricamente misurata su `main@d4c0777` + W1-P01 è **8320
 * bytes gzipped** (NOT 6.9-7.0 KB come ipotizzato dal plan — deviazione Rule 1
 * documentata nel SUMMARY 08-02). Cap effettivo = baseline + allowance =
 * **8670 bytes**.
 *
 * Post-MIN-1+MIN-2 (W1-P03) il bundle DEVE restare ≤ 8670 bytes (test PASSES) —
 * se sfora, MIN-* ha aggiunto > +350 B (REGRESSION → fix richiesto).
 *
 * Strategia implementazione (RESEARCH §13 OQ-08): misura programmatic via
 * `fs.readFileSync` + `gzipSync` da `node:zlib` invece di invocare `size-limit`
 * CLI (più affidabile in test isolation). Il test SKIP gracefully se
 * `dist/index.js` non esiste (build non eseguita) — CI esegue `pnpm build`
 * prima di `pnpm test` per garantire dist presente.
 *
 * NB: root `package.json:size-limit` per core attualmente cap `"8 KB"` (8192 B)
 * è già over-budget rispetto alla baseline misurata; W1-P03 dovrà raise a
 * `8670 B` allineato al cap MIN. Il test embedded usa `8670` byte come
 * D-V2-21 effettivo contract post baseline recalibration.
 *
 * @see .planning/phases/08-extension-runtime-mf-registry-lifecycle-fsm-standard-topics/08-RESEARCH.md §7
 * @see .planning/phases/08-extension-runtime-mf-registry-lifecycle-fsm-standard-topics/08-02-SUMMARY.md "Deviations"
 * @see D-V2-F8-08 suite content #9
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = resolve(__filename, '..')

// Baseline PRISTINE misurata empiricamente su main@d4c0777 + W1-P01 = 8320 bytes
// gzipped. Cap = baseline (8320) + D-V2-21 allowance (+350 B per MIN-1+MIN-2) = 8670.
const PRISTINE_CAP_BYTES = 8670

describe('v1-bc-replay: bundle cap @gluezero/core consumer v1.x (D-V2-21)', () => {
  it(`dist/index.js gzipped ≤ ${PRISTINE_CAP_BYTES} bytes (baseline 8320 + D-V2-21 allowance +350 B)`, () => {
    const distPath = resolve(__dirname, '../../dist/index.js')
    if (!existsSync(distPath)) {
      // Build non eseguita — skip pulito (CI esegue build prima dei test).
      console.warn(
        `[v1-bc-replay] dist/index.js not found at ${distPath} — skipping bundle size check (run \`pnpm --filter @gluezero/core build\` first)`,
      )
      expect(true).toBe(true)
      return
    }
    const source = readFileSync(distPath)
    const gzipped = gzipSync(source)
    const bytes = gzipped.byteLength
    expect(bytes).toBeLessThanOrEqual(PRISTINE_CAP_BYTES)
  })
})
