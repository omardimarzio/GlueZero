// __browser__/specificity-cascade.test.ts — Tier-3 Playwright Chromium @layer
// cascade ordering test (Wave 6 plan 07-13 — TEST-03 ext F7 Pitfall HIGH #2).
//
// Verifica: l'ordinamento `@layer reset, vendor, plugin, gluezero-theme.{tokens,
// roles, adapter}, animation, app-overrides` risolve la specificity war:
// - gluezero-theme.adapter VINCE su plugin (declared later in cascade list)
// - app-overrides (LAST) VINCE su gluezero-theme.adapter
//
// jsdom NON valuta `@layer` cascade ordering — Tier-3 mandatory.

import { afterEach, describe, expect, it } from 'vitest'

const STYLE_ID = 'gz-cascade-test-style'

function setupCascadePage(extraCss: string, bodyHtml: string): void {
  const styleEl = document.createElement('style')
  styleEl.id = STYLE_ID
  styleEl.textContent = `
    @layer reset, vendor, plugin, gluezero-theme.tokens, gluezero-theme.roles, gluezero-theme.adapter, animation, app-overrides;
    ${extraCss}
  `
  document.head.appendChild(styleEl)

  // Append test fixture into body
  const container = document.createElement('div')
  container.id = 'gz-cascade-container'
  container.innerHTML = bodyHtml
  document.body.appendChild(container)
}

function teardown(): void {
  document.getElementById(STYLE_ID)?.remove()
  document.getElementById('gz-cascade-container')?.remove()
}

describe('Specificity war @layer cascade (Pitfall HIGH #2)', () => {
  afterEach(() => {
    teardown()
  })

  it('gluezero-theme.adapter wins over plugin layer (cascade order)', () => {
    setupCascadePage(
      `
      @layer gluezero-theme.adapter {
        [data-gz-role="action.primary"] { background: rgb(99, 102, 241); }
      }
      @layer plugin {
        [data-gz-role="action.primary"].plugin-override { background: rgb(255, 0, 0); }
      }
    `,
      `
      <button data-gz-role="action.primary" id="default">Default</button>
      <button data-gz-role="action.primary" class="plugin-override" id="override">Override</button>
    `,
    )

    const defaultBg = getComputedStyle(document.getElementById('default') as HTMLElement)
      .backgroundColor
    const overrideBg = getComputedStyle(document.getElementById('override') as HTMLElement)
      .backgroundColor

    // Adapter wins on default — indigo
    expect(defaultBg).toMatch(/rgb\(99,\s*102,\s*241\)/)
    // Cascade order: plugin BEFORE gluezero-theme.adapter → adapter wins (LATER = HIGHER priority).
    expect(overrideBg).toMatch(/rgb\(99,\s*102,\s*241\)/)
  })

  it('app-overrides layer (LAST) wins over gluezero-theme.adapter', () => {
    setupCascadePage(
      `
      @layer gluezero-theme.adapter {
        [data-gz-role="action.primary"] { background: rgb(99, 102, 241); }
      }
      @layer app-overrides {
        [data-gz-role="action.primary"].my-override { background: rgb(0, 200, 0); }
      }
    `,
      `<button data-gz-role="action.primary" class="my-override" id="btn">Btn</button>`,
    )

    const bg = getComputedStyle(document.getElementById('btn') as HTMLElement).backgroundColor
    // app-overrides is LAST in @layer order → highest priority
    expect(bg).toMatch(/rgb\(0,\s*200,\s*0\)/)
  })
})
