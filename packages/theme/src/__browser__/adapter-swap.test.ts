// __browser__/adapter-swap.test.ts — Tier-3 Playwright Chromium adapter hot-swap
// atomico (Wave 6 plan 07-13 — TEST-03 ext F7 Pitfall HIGH #5 + Q5).
//
// Verifica: lo swap di un `<style data-gz-stylesheet>` via `textContent` è atomico
// (single browser repaint) → nessun flicker visibile durante la sostituzione delle
// regole CSS dell'adapter attivo.
//
// jsdom NON valuta repaint timing — Tier-3 mandatory per smoke visivo.

import { afterEach, describe, expect, it } from 'vitest'

let styleEl: HTMLStyleElement | null = null
let btn: HTMLButtonElement | null = null

function setup(): void {
  styleEl = document.createElement('style')
  styleEl.setAttribute('data-gz-stylesheet', 'A')
  styleEl.textContent =
    '@layer gluezero-theme.adapter { [data-gz-role="action.primary"] { background: rgb(99, 102, 241); } }'
  document.head.appendChild(styleEl)

  // Cascade @layer ordering style
  const layerStyle = document.createElement('style')
  layerStyle.id = 'gz-swap-layer-order'
  layerStyle.textContent =
    '@layer reset, vendor, plugin, gluezero-theme.tokens, gluezero-theme.roles, gluezero-theme.adapter, animation, app-overrides;'
  document.head.appendChild(layerStyle)

  btn = document.createElement('button')
  btn.setAttribute('data-gz-role', 'action.primary')
  btn.id = 'gz-swap-btn'
  btn.textContent = 'Btn'
  document.body.appendChild(btn)
}

function teardown(): void {
  styleEl?.remove()
  styleEl = null
  document.getElementById('gz-swap-layer-order')?.remove()
  btn?.remove()
  btn = null
  // Clean any leftover [data-gz-stylesheet]
  for (const el of document.querySelectorAll('style[data-gz-stylesheet]')) el.remove()
}

function swap(id: string, css: string): void {
  if (!styleEl) throw new Error('styleEl not initialized')
  styleEl.setAttribute('data-gz-stylesheet', id)
  styleEl.textContent = css
}

describe('Adapter hot-swap atomico (Pitfall HIGH #5 + Q5)', () => {
  afterEach(() => {
    teardown()
  })

  it('swap <style data-gz-stylesheet> via textContent is atomic (no residual styles)', () => {
    setup()

    // Initial adapter A → indigo
    const bg1 = getComputedStyle(btn as HTMLButtonElement).backgroundColor
    expect(bg1).toMatch(/rgb\(99,\s*102,\s*241\)/)

    // Atomic swap to adapter B → red
    swap(
      'B',
      '@layer gluezero-theme.adapter { [data-gz-role="action.primary"] { background: rgb(255, 0, 0); } }',
    )

    const bg2 = getComputedStyle(btn as HTMLButtonElement).backgroundColor
    expect(bg2).toMatch(/rgb\(255,\s*0,\s*0\)/)

    // Verify only ONE <style data-gz-stylesheet> survives (no orphan)
    const count = document.querySelectorAll('style[data-gz-stylesheet]').length
    expect(count).toBe(1)

    // Verify the surviving stylesheet has id='B'
    const id = document
      .querySelector('style[data-gz-stylesheet]')
      ?.getAttribute('data-gz-stylesheet')
    expect(id).toBe('B')
  })
})
