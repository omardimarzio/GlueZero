// __browser__/os-preferences.test.ts — Tier-3 Playwright Chromium emulateMedia
// OS preferences test (Wave 6 plan 07-13 — TEST-03 ext F7 Pitfall HIGH #6).
//
// Verifica:
// - CDP `Emulation.setEmulatedMedia` con `prefers-color-scheme: dark` triggera
//   `:root:not([data-gz-theme])` override sui token `--gz-*`.
// - CDP `prefers-reduced-motion: reduce` triggera safety-net animation layer
//   con `animation-duration: 0.01ms !important`.
//
// jsdom NON supporta `getComputedStyle('--gz-*')` (Vitest #1689) — Tier-3 mandatory.

import { afterEach, describe, expect, it } from 'vitest'
// @ts-expect-error — vitest browser globals (no @types for runtime export)
import { cdp } from 'vitest/browser'

const STYLE_ID = 'gz-osprefs-test-style'

function setupStyles(css: string, bodyHtml = ''): void {
  const styleEl = document.createElement('style')
  styleEl.id = STYLE_ID
  styleEl.textContent = css
  document.head.appendChild(styleEl)
  if (bodyHtml) {
    const container = document.createElement('div')
    container.id = 'gz-osprefs-container'
    container.innerHTML = bodyHtml
    document.body.appendChild(container)
  }
}

function teardown(): void {
  document.getElementById(STYLE_ID)?.remove()
  document.getElementById('gz-osprefs-container')?.remove()
}

async function setEmulation(features: { name: string; value: string }[]): Promise<void> {
  const session = cdp()
  await session.send('Emulation.setEmulatedMedia', { features })
}

describe('OS preferences (Pitfall HIGH #6)', () => {
  afterEach(async () => {
    teardown()
    await setEmulation([])
  })

  it('emulateMedia colorScheme dark applies dark token override', async () => {
    setupStyles(`
      @layer gluezero-theme.tokens {
        :root { --gz-color-text: #111827; }
        @media (prefers-color-scheme: dark) {
          :root:not([data-gz-theme]) { --gz-color-text: #F9FAFB; }
        }
      }
    `)

    await setEmulation([{ name: 'prefers-color-scheme', value: 'dark' }])

    const color = getComputedStyle(document.documentElement)
      .getPropertyValue('--gz-color-text')
      .trim()
    // Dark text token = #F9FAFB
    expect(color).toBe('#F9FAFB')
  })

  it('emulateMedia colorScheme light keeps default token', async () => {
    setupStyles(`
      @layer gluezero-theme.tokens {
        :root { --gz-color-text: #111827; }
        @media (prefers-color-scheme: dark) {
          :root:not([data-gz-theme]) { --gz-color-text: #F9FAFB; }
        }
      }
    `)

    await setEmulation([{ name: 'prefers-color-scheme', value: 'light' }])

    const color = getComputedStyle(document.documentElement)
      .getPropertyValue('--gz-color-text')
      .trim()
    expect(color).toBe('#111827')
  })

  it('reduced-motion safety-net applies animation-duration: 0.01ms !important', async () => {
    setupStyles(
      `
      @layer animation {
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }
      }
      #gz-osprefs-anim { animation: pulse 2s infinite; }
      @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.5 } }
    `,
      `<div id="gz-osprefs-anim">Animated</div>`,
    )

    await setEmulation([{ name: 'prefers-reduced-motion', value: 'reduce' }])

    const dur = getComputedStyle(document.getElementById('gz-osprefs-anim') as HTMLElement)
      .animationDuration
    // Chromium normalizza `0.01ms` → `1e-05s` (entrambe rappresentano 0.01ms).
    // Safety-net !important applicato → durata effettivamente azzerata.
    expect(dur).toMatch(/^(0\.01ms|1e-05s|0\.00001s)$/)
  })
})
