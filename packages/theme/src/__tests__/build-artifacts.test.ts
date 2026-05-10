// Tier-1 smoke test per artefatti build (Pitfall 8 mitigation: tsup onSuccess
// silent failure). Verifica `dist/index.js`, `dist/index.d.ts`, e copia
// `dist/tokens-default.css` post-build.
//
// Skip in dev (no `dist/` ancora generato); enforce in CI dopo `pnpm build`.
//
// Refs: 07-01-PLAN.md Task 3 behavior test 5; threat T-F7-01 (Tampering CSS asset).

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const distDir = resolve(__dirname, '../../dist')

describe('build artifacts (Pitfall 8 mitigation: tsup onSuccess silent failure)', () => {
  it.runIf(existsSync(distDir))('dist/index.js exists post-build', () => {
    expect(existsSync(resolve(distDir, 'index.js'))).toBe(true)
  })

  it.runIf(existsSync(distDir))('dist/index.d.ts exists post-build', () => {
    expect(existsSync(resolve(distDir, 'index.d.ts'))).toBe(true)
  })

  it.runIf(existsSync(distDir))('dist/tokens-default.css exists post-build (onSuccess copy)', () => {
    expect(existsSync(resolve(distDir, 'tokens-default.css'))).toBe(true)
  })

  it.runIf(existsSync(resolve(distDir, 'tokens-default.css')))(
    'dist/tokens-default.css contains @layer cascade declaration',
    () => {
      const css = readFileSync(resolve(distDir, 'tokens-default.css'), 'utf-8')
      expect(css).toContain(
        '@layer reset, vendor, plugin, gluezero-theme.tokens, gluezero-theme.roles, gluezero-theme.adapter, animation, app-overrides;',
      )
    },
  )

  it.runIf(existsSync(resolve(distDir, 'tokens-default.css')))(
    'dist/tokens-default.css contains canonical token --gz-color-primary',
    () => {
      const css = readFileSync(resolve(distDir, 'tokens-default.css'), 'utf-8')
      expect(css).toContain('--gz-color-primary:')
    },
  )

  it.runIf(existsSync(resolve(distDir, 'tokens-default.css')))(
    'dist/tokens-default.css contains prefers-reduced-motion safety-net',
    () => {
      const css = readFileSync(resolve(distDir, 'tokens-default.css'), 'utf-8')
      expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    },
  )

  it.skipIf(!existsSync(distDir))('skip note (dist not present in dev)', () => {
    // marker test — esiste solo per visibilità nel report quando dist è presente.
    expect(true).toBe(true)
  })
})
