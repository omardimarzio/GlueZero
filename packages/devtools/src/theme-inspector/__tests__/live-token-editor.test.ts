// live-token-editor.test.ts — F7 plan 07-09 W5a Task 3.
//
// Tier-1 jsdom suite per `createLiveTokenEditor` (UI-DEVTOOLS-03).
//
// Verifica:
// - render() aggiunge form al container con un input per ogni token
// - input change invoca theme.applyTokens({ [name]: value })
// - destroy() rimuove form dal container (idempotent)
// - NODE_ENV gate: production → no-op render+destroy (T-F7-02 mitigation)
//
// Refs:
// - 07-09-PLAN.md Task 3 behavior 7-10
// - 07-CONTEXT.md UI-DEVTOOLS-03 + D-160 + T-F7-02

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createLiveTokenEditor,
  type ThemeLikeForEditor,
} from '../live-token-editor'

function createMockTheme(
  initial: Record<string, string>,
): ThemeLikeForEditor & { applied: Record<string, string>[] } {
  const applied: Record<string, string>[] = []
  return {
    applied,
    applyTokens(tokens: Record<string, string>): void {
      applied.push({ ...tokens })
    },
    getActiveTheme() {
      return { tokens: { ...initial } }
    },
  }
}

describe('createLiveTokenEditor', () => {
  let container: HTMLElement
  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })
  afterEach(() => {
    if (container.parentNode === document.body) {
      document.body.removeChild(container)
    }
  })

  it('render() adds form with one <input> per token (default = all tokens from snapshot)', () => {
    const theme = createMockTheme({
      'color-primary': '#FF6B35',
      'spacing-md': '1rem',
    })
    const editor = createLiveTokenEditor(theme)
    editor.render(container)
    const form = container.querySelector('form[data-gz-live-editor]')
    expect(form).toBeTruthy()
    const inputs = container.querySelectorAll('input[type="text"]')
    expect(inputs.length).toBe(2)
    const names = Array.from(inputs).map((i) => (i as HTMLInputElement).name)
    expect(names).toContain('color-primary')
    expect(names).toContain('spacing-md')
  })

  it('render() pre-fills input value from current snapshot', () => {
    const theme = createMockTheme({ 'color-primary': '#FF6B35' })
    const editor = createLiveTokenEditor(theme)
    editor.render(container)
    const input = container.querySelector(
      'input[name="color-primary"]',
    ) as HTMLInputElement
    expect(input.value).toBe('#FF6B35')
  })

  it('input change invokes theme.applyTokens({ [name]: value })', () => {
    const theme = createMockTheme({ 'color-primary': '#FF6B35' })
    const editor = createLiveTokenEditor(theme)
    editor.render(container)
    const input = container.querySelector(
      'input[name="color-primary"]',
    ) as HTMLInputElement
    input.value = '#000000'
    input.dispatchEvent(new Event('change'))
    expect(theme.applied.length).toBe(1)
    expect(theme.applied[0]).toEqual({ 'color-primary': '#000000' })
  })

  it('subset opts.tokens limits the form to selected tokens', () => {
    const theme = createMockTheme({
      'color-primary': '#FF6B35',
      'spacing-md': '1rem',
      'radius-md': '8px',
    })
    const editor = createLiveTokenEditor(theme, { tokens: ['color-primary'] })
    editor.render(container)
    const inputs = container.querySelectorAll('input[type="text"]')
    expect(inputs.length).toBe(1)
    expect((inputs[0] as HTMLInputElement).name).toBe('color-primary')
  })

  it('destroy() removes form from container', () => {
    const theme = createMockTheme({ 'color-primary': '#FF6B35' })
    const editor = createLiveTokenEditor(theme)
    editor.render(container)
    expect(container.querySelector('form[data-gz-live-editor]')).toBeTruthy()
    editor.destroy()
    expect(container.querySelector('form[data-gz-live-editor]')).toBeNull()
  })

  it('destroy() is idempotent (multiple call safe)', () => {
    const theme = createMockTheme({ 'color-primary': '#FF6B35' })
    const editor = createLiveTokenEditor(theme)
    editor.render(container)
    editor.destroy()
    expect(() => editor.destroy()).not.toThrow()
    expect(container.querySelector('form[data-gz-live-editor]')).toBeNull()
  })

  it('re-render replaces previous form (idempotent on container)', () => {
    const theme = createMockTheme({ 'color-primary': '#FF6B35' })
    const editor = createLiveTokenEditor(theme)
    editor.render(container)
    editor.render(container)
    const forms = container.querySelectorAll('form[data-gz-live-editor]')
    expect(forms.length).toBe(1)
    editor.destroy()
  })

  it('NODE_ENV=production: render() + destroy() no-op (T-F7-02 mitigation)', () => {
    const original = process.env['NODE_ENV']
    process.env['NODE_ENV'] = 'production'
    try {
      const theme = createMockTheme({ 'color-primary': '#FF6B35' })
      const editor = createLiveTokenEditor(theme)
      editor.render(container)
      // Production: render should NOT add the form
      expect(container.querySelector('form[data-gz-live-editor]')).toBeNull()
      // destroy still callable + no-op
      expect(() => editor.destroy()).not.toThrow()
    } finally {
      if (original === undefined) {
        delete process.env['NODE_ENV']
      } else {
        process.env['NODE_ENV'] = original
      }
    }
  })

  it('NODE_ENV=production: applyTokens NOT invoked even if input dispatched', () => {
    const original = process.env['NODE_ENV']
    process.env['NODE_ENV'] = 'production'
    try {
      const theme = createMockTheme({ 'color-primary': '#FF6B35' })
      const spy = vi.spyOn(theme, 'applyTokens')
      const editor = createLiveTokenEditor(theme)
      editor.render(container)
      expect(spy).not.toHaveBeenCalled()
      editor.destroy()
    } finally {
      if (original === undefined) {
        delete process.env['NODE_ENV']
      } else {
        process.env['NODE_ENV'] = original
      }
    }
  })

  it('non-production NODE_ENV: render adds form normally', () => {
    const original = process.env['NODE_ENV']
    process.env['NODE_ENV'] = 'development'
    try {
      const theme = createMockTheme({ 'color-primary': '#FF6B35' })
      const editor = createLiveTokenEditor(theme)
      editor.render(container)
      expect(container.querySelector('form[data-gz-live-editor]')).toBeTruthy()
      editor.destroy()
    } finally {
      if (original === undefined) {
        delete process.env['NODE_ENV']
      } else {
        process.env['NODE_ENV'] = original
      }
    }
  })
})
