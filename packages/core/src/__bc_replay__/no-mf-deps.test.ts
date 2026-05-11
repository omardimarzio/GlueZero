/**
 * v1-bc-replay — P-01 mitigation Tier-1: `@gluezero/core` package.json no MF runtime deps.
 *
 * Vieta `dependencies` + `peerDependencies` verso i 16 package MF v2.0 in
 * `@gluezero/core`. Tier-1 backup complementare al CI script git diff check
 * (RESEARCH §11.3) per detection runtime contamination cross-fase F8-F17.
 *
 * Il test legge `packages/core/package.json` via `readFileSync` (evita friction
 * con `import ... with { type: 'json' }` in TS isolatedDeclarations) e asserisce
 * che nessuno dei 16 nomi MF compaia in dependencies o peerDependencies.
 *
 * @see .planning/phases/08-extension-runtime-mf-registry-lifecycle-fsm-standard-topics/08-RESEARCH.md §11.3
 * @see D-V2-F8-08 + P-01 mitigation Tier-1
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = resolve(__filename, '..')

const MF_PACKAGES = [
  'microfrontends',
  'mf-esm',
  'context',
  'permissions',
  'compat',
  'isolation',
  'fallbacks',
  'mf-devtools',
  'react',
  'vue',
  'svelte',
  'web-components',
  'mf-web-component',
  'mf-iframe',
  'mf-module-federation',
  'mf-single-spa',
] as const

interface CorePkg {
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

const pkgPath = resolve(__dirname, '../../package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as CorePkg

describe('v1-bc-replay: @gluezero/core no MF runtime deps (P-01)', () => {
  it('package.json dependencies do NOT include any MF package', () => {
    const deps = pkg.dependencies ?? {}
    for (const mf of MF_PACKAGES) {
      expect(
        deps[`@gluezero/${mf}`],
        `dependencies must not include @gluezero/${mf}`,
      ).toBeUndefined()
    }
  })

  it('package.json peerDependencies do NOT include any MF package', () => {
    const peer = pkg.peerDependencies ?? {}
    for (const mf of MF_PACKAGES) {
      expect(
        peer[`@gluezero/${mf}`],
        `peerDependencies must not include @gluezero/${mf}`,
      ).toBeUndefined()
    }
  })
})
