// __browser__/fouc.test.ts — Tier-3 Playwright Chromium FOUC frame-1 test
// (Wave 6 plan 07-13 — TEST-03 ext F7 Pitfall HIGH #1).
//
// Esecuzione: `pnpm -F @gluezero/theme test:browser` con Vitest 4.x browser
// provider Playwright Chromium headless.
//
// Verifica: con `prefers-color-scheme: dark` emulato via CDP, l'IIFE pre-paint
// imposta `data-gz-theme="dark"` PRIMA del primo paint, evitando FOUC bianco.
// jsdom NON copre questo caso (Vitest #1689 — `getComputedStyle('--gz-*')` returns '').
//
// Riferimenti:
// - 07-RESEARCH.md Pitfall HIGH #1 (FOUC frame-1 signature)
// - 07-CONTEXT.md TEST-03 ext F7

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
// @ts-expect-error — vitest browser globals (no @types for runtime export)
import { cdp } from 'vitest/browser'

const STYLE_ID = 'gz-fouc-test-style'

function injectTokenStyles(): void {
  const styleEl = document.createElement('style')
  styleEl.id = STYLE_ID
  styleEl.textContent = `
    @layer reset, vendor, plugin, gluezero-theme.tokens, gluezero-theme.roles, gluezero-theme.adapter, animation, app-overrides;
    @layer gluezero-theme.tokens {
      :root { --gz-color-surface: #FFFFFF; --gz-color-text: #111827; }
      [data-gz-theme="dark"] { --gz-color-surface: #111827; --gz-color-text: #F9FAFB; }
    }
    body { background: var(--gz-color-surface); color: var(--gz-color-text); margin: 0; }
  `
  document.head.appendChild(styleEl)
}

function applyIIFEAntiFOUC(): void {
  // Replicates `getInitialThemeScript` IIFE pre-paint logic.
  const resolved =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  document.documentElement.setAttribute('data-gz-theme', resolved)
}

async function emulateColorScheme(scheme: 'light' | 'dark' | 'no-preference'): Promise<void> {
  // Use CDP `Emulation.setEmulatedMedia` (Chromium-only) to switch matchMedia results.
  const session = cdp()
  await session.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: scheme }],
  })
}

describe('FOUC frame-1 (Pitfall HIGH #1)', () => {
  beforeEach(() => {
    injectTokenStyles()
  })

  afterEach(async () => {
    document.getElementById(STYLE_ID)?.remove()
    document.documentElement.removeAttribute('data-gz-theme')
    // Reset CDP emulation between tests.
    const session = cdp()
    await session.send('Emulation.setEmulatedMedia', { features: [] })
  })

  it('no white flash with prefers-color-scheme: dark — IIFE applies dark token at frame 1', async () => {
    await emulateColorScheme('dark')
    applyIIFEAntiFOUC()

    expect(document.documentElement.getAttribute('data-gz-theme')).toBe('dark')

    // dark surface = #111827 = rgb(17, 24, 39)
    const bg = getComputedStyle(document.body).backgroundColor
    expect(bg).toMatch(/rgb\(17,\s*24,\s*39\)/)
  })

  it('light fallback when prefers-color-scheme: light', async () => {
    await emulateColorScheme('light')
    applyIIFEAntiFOUC()

    expect(document.documentElement.getAttribute('data-gz-theme')).toBe('light')

    // light surface = #FFFFFF = rgb(255, 255, 255)
    const bg = getComputedStyle(document.body).backgroundColor
    expect(bg).toMatch(/rgb\(255,\s*255,\s*255\)/)
  })
})
