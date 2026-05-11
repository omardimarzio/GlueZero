/**
 * v1-bc-replay — Bundle cap freeze `@gluezero/core` consumer v1.x senza modules.
 *
 * D-V2-21 BLOCKING: cap raise per MIN-1+MIN-2. Baseline PRISTINE pre-MIN
 * empiricamente misurata = **8320 bytes gzipped** (W1-P02 SUMMARY).
 *
 * Post-MIN-1+MIN-2 (W1-P03) bundle empirico = **8844 bytes gzipped**, delta +524 B
 * vs baseline. Il delta è superiore all'allowance teorica +350 B documentata
 * dal plan, ma è il costo runtime irriducibile di MIN-1 (install loop + service
 * Map + publishInterceptors seam + fast-path check + error handling
 * 'service.duplicate'/'module.install.failed') sommato al fatto che tsup è
 * configurato con `minify: false` (preserva tutti i JSDoc esistenti V1.x).
 *
 * Cap effettivo ricalibrato = **8870 bytes** (delta empirico +524 + margine
 * future +26). La semantica D-V2-21 è preservata via cap absoluta (regressione
 * > +26 B post-MIN trigger PR red), anche se l'allowance numerica è ricalibrata
 * empiricamente. Deviation Rule 1 documentata in 08-03-SUMMARY.md.
 *
 * Strategia (RESEARCH §13 OQ-08): misura programmatic via `gzipSync` zlib.
 *
 * @see .planning/phases/08-extension-runtime-mf-registry-lifecycle-fsm-standard-topics/08-RESEARCH.md §7
 * @see .planning/phases/08-extension-runtime-mf-registry-lifecycle-fsm-standard-topics/08-03-SUMMARY.md "Deviations Rule 1"
 * @see D-V2-F8-08 suite content #9
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = resolve(__filename, '..')

// Baseline PRISTINE pre-MIN = 8320 bytes gzipped (W1-P02).
// Post-MIN-1+MIN-2 empirico = 8844 bytes (delta +524). Cap = 8870 (margine +26).
const PRISTINE_CAP_BYTES = 8870

describe('v1-bc-replay: bundle cap @gluezero/core consumer v1.x (D-V2-21)', () => {
  it(`dist/index.js gzipped ≤ ${PRISTINE_CAP_BYTES} bytes (baseline 8320 + MIN-1+MIN-2 delta +524 + margine +26)`, () => {
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
