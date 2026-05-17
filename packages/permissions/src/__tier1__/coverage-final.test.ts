/**
 * F11 Coverage Final Verifier (W3 P05 closure).
 *
 * Cross-reference automatico via grep markers sui source file F11:
 * - 13/13 REQ-IDs F11 (MF-PERM-01..06 + MF-CAP-01..05 + MF-INT-LIFE-03 + MF-PIPE-01)
 * - 22/22 D-V2-F11-XX decisions (D-V2-F11-01..22)
 * - 5/5 SC ROADMAP linee 287-291
 * - 7/7 OQ research resolved (OQ-1..7)
 * - 3/3 Pitfall HIGH mitigation (P-02 / P-13 / P-23)
 *
 * Methodology: scan ricorsivo source `src/**\/*.ts` (esclusi __tier1__ + __integration__)
 * + parsing JSDoc/comment marker anchor + README literal disclosure check.
 *
 * **B-02 FIX (iter1 revision)**: SC4 README disclosure literal check tramite read sync
 * di `../../README.md` (W-02 fix integrato).
 *
 * **W-04 FIX (iter1 revision)**: @throws distribution corretta — `permission-error.ts`
 * (factory ritorna BrokerError NON throws) ha 0 @throws, redistribuito agli effettivi
 * propagator (engine + enforcement + checker + module + hooks).
 *
 * @see .planning/REQUIREMENTS.md linee 376-388 — traceability matrix F11
 * @see .planning/ROADMAP.md linee 287-291 — 5 SC literal
 * @see .planning/phases/11-permissions-capabilities-pipeline-28-extension/11-CONTEXT.md — 22 D-V2-F11-XX
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const SRC_DIR = join(__dirname, '..')

function readAllSource(): string {
  function walk(dir: string): string[] {
    const out: string[] = []
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (
        entry.name === '__tier1__' ||
        entry.name === '__integration__' ||
        entry.name === 'dist' ||
        entry.name === 'node_modules'
      )
        continue
      const p = join(dir, entry.name)
      if (entry.isDirectory()) out.push(...walk(p))
      else if (entry.name.endsWith('.ts')) out.push(p)
    }
    return out
  }
  return walk(SRC_DIR)
    .map((f) => readFileSync(f, 'utf-8'))
    .join('\n')
}

const allSource = readAllSource()

describe('F11 Coverage Final — 13/13 REQ-IDs traceability', () => {
  const reqIds = [
    'MF-PERM-01',
    'MF-PERM-02',
    'MF-PERM-03',
    'MF-PERM-04',
    'MF-PERM-05',
    'MF-PERM-06',
    'MF-CAP-01',
    'MF-CAP-02',
    'MF-CAP-03',
    'MF-CAP-04',
    'MF-CAP-05',
    'MF-INT-LIFE-03',
    'MF-PIPE-01',
  ]
  it.each(reqIds)('REQ-ID %s referenced in source', (reqId) => {
    expect(allSource).toContain(reqId)
  })
})

describe('F11 Coverage Final — 22/22 D-V2-F11-XX decisions referenced', () => {
  const decisions = Array.from(
    { length: 22 },
    (_, i) => `D-V2-F11-${String(i + 1).padStart(2, '0')}`,
  )
  it.each(decisions)('decision %s referenced in source', (decisionId) => {
    expect(allSource).toContain(decisionId)
  })
})

describe('F11 Coverage Final — 5/5 SC ROADMAP linee 287-291', () => {
  // SC1: deny-wins + PERMISSION_DENIED topic
  it('SC1: deny-wins pattern matching + PERMISSION_DENIED', () => {
    expect(allSource).toMatch(/deny-wins/i)
    expect(allSource).toContain('PERMISSION_DENIED')
  })

  // SC2: capability missing + block-mount + capability.missing topic
  it('SC2: capability missing + block-mount + topic microfrontend.capability.missing', () => {
    expect(allSource).toContain('block-mount')
    expect(allSource).toContain('CAPABILITY_MISSING')
    expect(allSource).toMatch(/microfrontend\.capability\.missing/)
  })

  // SC3: pipeline §28 D-V2-20 + LRU
  it('SC3: pipeline §28 D-V2-20 + LRU cache', () => {
    expect(allSource).toMatch(/D-V2-20|Pipeline §28|MF-PIPE-01/)
    expect(allSource).toMatch(/LRU|lruGet|lruSet/)
  })

  // SC4: facade-only — raw broker.publish NOT instrumented
  it('SC4: facade-only + raw broker.publish NOT instrumented (P-23 governance)', () => {
    expect(allSource).toMatch(/governance.*crypto|facade-only|raw broker\.publish/i)
  })

  // FIX W-02: SC4 — verifica testual letterale README disclosure P-13 governance-not-crypto
  it('SC4 — README discloses P-13 governance-not-crypto warning (testual letterale)', () => {
    const readme = readFileSync(join(__dirname, '../../README.md'), 'utf-8')
    expect(readme).toMatch(/governance NOT crypto sandbox|Modello di sicurezza/i)
    expect(readme).toMatch(/broker\.publish.*raw.*NON instrumented|facade-only.*enforcement/i)
  })

  // SC5: bundle ≤ 5 KB (verified externally via size-limit, ma anchor JSDoc)
  it('SC5: bundle 5 KB cap anchor in JSDoc', () => {
    expect(allSource).toMatch(/5 KB|D-V2-F11-19|bundle target/i)
  })
})

describe('F11 Coverage Final — 7 OQ research resolved documentation', () => {
  it('OQ-1 facade-only enforcement ACK', () => {
    expect(allSource).toMatch(/OQ-1|facade-only|publishInterceptors.*NOT.*invocato/i)
  })

  it('OQ-2 dual subscribe bootstrapped+loaded', () => {
    expect(allSource).toMatch(/OQ-2|best-effort post-hoc|dual subscribe/i)
    expect(allSource).toContain("'microfrontend.bootstrapped'")
    expect(allSource).toContain("'microfrontend.loaded'")
  })

  it('OQ-3 monkey-patch idempotent marker', () => {
    expect(allSource).toMatch(/OQ-3|__permissionsServicePatched|monkey-patch/i)
  })

  it('OQ-4 warnings semantics strings diagnostic', () => {
    expect(allSource).toMatch(/OQ-4|Optional capability.*not satisfied|warnings/i)
  })

  it('OQ-5 setMicroFrontendPermissions API', () => {
    expect(allSource).toMatch(/setMicroFrontendPermissions|microfrontend\.permissions\.updated/)
    expect(allSource).toMatch(/OQ-5/)
  })

  it('OQ-6 capability duplicate first-wins (Pitfall 6)', () => {
    expect(allSource).toMatch(/OQ-6|Pitfall 6|first-wins|already provided by/i)
  })

  it('OQ-7 PipelineStep enum extension MOOT (facade-only resolution)', () => {
    // OQ-7 = MOOT — facade chain logica, NOT F1-level pipeline step
    expect(allSource).toMatch(/Pipeline §28|MF-PIPE-01|PROPRIETÀ LOGICA|step 4\.5/i)
  })
})

describe('F11 Coverage Final — 3 Pitfall HIGH mitigation', () => {
  it('P-02 publish overhead: LRU 500 + facade single check', () => {
    expect(allSource).toMatch(/MAX_ENTRIES = 500|LRU.*500|P-02/i)
  })

  it('P-13 permission theater: governance NOT crypto sandbox', () => {
    expect(allSource).toMatch(/governance.*crypto|crypto.*sandbox|P-13/i)
  })

  it('P-23 BC break check: SC4 facade-only + v1-bc-replay anchor', () => {
    expect(allSource).toMatch(/P-23|v1-bc-replay|publish-ordering|SC4/i)
  })
})

describe('F11 Coverage Final — Audit grep markers preserved', () => {
  it('Pattern S1 augment marker (D-V2-F11-17)', () => {
    const augment = readFileSync(join(SRC_DIR, 'augment.ts'), 'utf-8')
    expect(augment).toContain('__permissionsAugmentLoaded')
    // NO declare module (D-V2-F11-17 strict) nel codice (esclusi commenti)
    const codeOnly = augment.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
    expect(codeOnly).not.toContain('declare module')
    expect(codeOnly).not.toContain('Broker.prototype')
  })

  it('OQ-3 service monkey-patch idempotent marker', () => {
    const enf = readFileSync(join(SRC_DIR, 'enforcement-points.ts'), 'utf-8')
    expect(enf).toContain('__permissionsServicePatched')
  })

  it('Pitfall 7 ACK: F8 MF_GOVERNANCE_TOPICS reused via import (NON duplicato in topics.ts)', () => {
    const topicsF11 = readFileSync(join(SRC_DIR, 'topics.ts'), 'utf-8')
    // F11 topics.ts NON duplica F8 topics governance literal:
    expect(topicsF11).not.toContain("'microfrontend.permission.denied'")
    expect(topicsF11).not.toContain("'microfrontend.capability.missing'")
    // Ma li riusa via import in altri file:
    expect(allSource).toContain('MF_GOVERNANCE_TOPICS')
  })

  it('LRU cache cap 500 + clearByMfId event-driven', () => {
    const lru = readFileSync(join(SRC_DIR, 'lru-cache.ts'), 'utf-8')
    expect(lru).toContain('MAX_ENTRIES = 500')
    expect(lru).toContain('lruClearByMfId')
  })
})
