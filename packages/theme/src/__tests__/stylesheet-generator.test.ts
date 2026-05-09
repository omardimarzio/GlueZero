import { afterEach, describe, expect, it } from 'vitest'
import { createStyleSheetGenerator } from '../stylesheet-generator'

const tokensOnly = {
  id: 'tokens-only',
  cssRules: {
    'action.primary':
      'background: var(--gz-color-primary); color: var(--gz-color-on-primary);',
    'feedback.error': 'color: var(--gz-color-error);',
  },
}
const empty = { id: 'empty' }

describe('createStyleSheetGenerator (Strategia B)', () => {
  afterEach(() => {
    // Cleanup any lingering <style> nodes
    document
      .querySelectorAll('style[data-gz-stylesheet]')
      .forEach((s) => s.remove())
  })

  it('generate produces @layer-wrapped rules', () => {
    const gen = createStyleSheetGenerator({ adapter: tokensOnly })
    const css = gen.generate()
    expect(css).toContain('@layer gluezero-theme.adapter {')
    expect(css).toContain('[data-gz-role="action.primary"]')
    expect(css).toContain('[data-gz-role="feedback.error"]')
    expect(css).toContain('--gz-color-primary')
  })

  it('uses equality selector only (Pitfall 9 mitigation)', () => {
    const gen = createStyleSheetGenerator({ adapter: tokensOnly })
    const css = gen.generate()
    expect(css).not.toContain('data-gz-role*=')
    expect(css).not.toContain('data-gz-role^=')
    expect(css).not.toContain('data-gz-role$=')
  })

  it('mount adds <style> to <head>', () => {
    const gen = createStyleSheetGenerator({ adapter: tokensOnly })
    gen.mount()
    const el = document.head.querySelector(
      'style[data-gz-stylesheet="tokens-only"]',
    )
    expect(el).not.toBeNull()
    expect(el!.textContent).toContain('@layer gluezero-theme.adapter')
    gen.dispose()
  })

  it('dispose removes <style>', () => {
    const gen = createStyleSheetGenerator({ adapter: tokensOnly })
    gen.mount()
    gen.dispose()
    const el = document.head.querySelector(
      'style[data-gz-stylesheet="tokens-only"]',
    )
    expect(el).toBeNull()
  })

  it('mount with scope uses scope as parent (D-F7-05 multi-tema)', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const gen = createStyleSheetGenerator({ adapter: tokensOnly, scope: root })
    gen.mount()
    const el = root.querySelector('style[data-gz-stylesheet="tokens-only"]')
    expect(el).not.toBeNull()
    gen.dispose()
    document.body.removeChild(root)
  })

  it('adapter without cssRules produces empty CSS', () => {
    const gen = createStyleSheetGenerator({ adapter: empty })
    expect(gen.generate()).toBe('')
  })

  it('null adapter produces empty CSS', () => {
    const gen = createStyleSheetGenerator({ adapter: null })
    expect(gen.generate()).toBe('')
  })

  it('mount is idempotent', () => {
    const gen = createStyleSheetGenerator({ adapter: tokensOnly })
    gen.mount()
    gen.mount()
    const els = document.head.querySelectorAll(
      'style[data-gz-stylesheet="tokens-only"]',
    )
    expect(els.length).toBe(1)
    gen.dispose()
  })

  it('dispose without mount is no-op', () => {
    const gen = createStyleSheetGenerator({ adapter: tokensOnly })
    expect(() => gen.dispose()).not.toThrow()
  })

  it('setAdapter swaps CSS atomically (single textContent write)', () => {
    const newAdapter = {
      id: 'new',
      cssRules: { 'action.primary': 'background: red;' },
    }
    const gen = createStyleSheetGenerator({ adapter: tokensOnly })
    gen.mount()
    gen.setAdapter(newAdapter)
    const el = document.head.querySelector('style[data-gz-stylesheet="new"]')
    expect(el).not.toBeNull()
    expect(el!.textContent).toContain('background: red;')
    gen.dispose()
  })

  it('preserves multi-role selector equality form', () => {
    const gen = createStyleSheetGenerator({ adapter: tokensOnly })
    const css = gen.generate()
    // Both rules use exact equality form
    expect(css.match(/\[data-gz-role="[^"]+"\]/g)?.length).toBe(2)
  })
})
