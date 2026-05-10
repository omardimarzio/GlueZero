// Tier-1 jsdom tests per `TokenSetSchema` / `RoleSetSchema` / `ThemeAdapterSchema`
// (Valibot 1.x pipe API tree-shakable). Plan 07-02 Task 1.
//
// Coverage:
// - TokenSetSchema: accept kebab-case keys + safe values; reject `<>{};` injection
//   + uppercase keys + spaces (T-F7-01 + T-F7-05 mitigation).
// - RoleSetSchema: accept dot-notation `category.subname`; reject sin-dot.
// - ThemeAdapterSchema: id required; roleMap/cssRules optional.
//
// Refs: 07-02-PLAN.md Task 1 behavior tests 6-12; THEME-10; VAL-ext-F7.

import { safeParse } from 'valibot'
import { describe, expect, it } from 'vitest'
import {
  RoleSetSchema,
  ThemeAdapterSchema,
  TokenSetSchema,
} from '../internal/valibot-schemas'

describe('TokenSetSchema', () => {
  it('accepts valid kebab-case keys + safe values', () => {
    const r = safeParse(TokenSetSchema, {
      'color-primary': '#FF6B35',
      'spacing-md': '1rem',
      'motion-medium': '250ms',
      'radius-2xl': '24px',
    })
    expect(r.success).toBe(true)
  })

  it('accepts empty record', () => {
    const r = safeParse(TokenSetSchema, {})
    expect(r.success).toBe(true)
  })

  it('rejects script injection in value (< >)', () => {
    const r = safeParse(TokenSetSchema, {
      'color-primary': '<script>alert(1)</script>',
    })
    expect(r.success).toBe(false)
  })

  it('rejects semicolon CSS expression injection', () => {
    const r = safeParse(TokenSetSchema, {
      'color-primary': 'red; expression(alert(1))',
    })
    expect(r.success).toBe(false)
  })

  it('rejects curly-brace injection in value', () => {
    const r = safeParse(TokenSetSchema, {
      'color-primary': '#fff} body{display:none',
    })
    expect(r.success).toBe(false)
  })

  it('rejects uppercase keys', () => {
    const r = safeParse(TokenSetSchema, { 'BAD-KEY': '#fff' })
    expect(r.success).toBe(false)
  })

  it('rejects spaces in keys', () => {
    const r = safeParse(TokenSetSchema, { 'bad key': '#fff' })
    expect(r.success).toBe(false)
  })

  it('rejects empty string keys', () => {
    const r = safeParse(TokenSetSchema, { '': '#fff' })
    expect(r.success).toBe(false)
  })

  it('rejects non-string token values', () => {
    const r = safeParse(TokenSetSchema, { 'color-primary': 12345 as unknown as string })
    expect(r.success).toBe(false)
  })
})

describe('RoleSetSchema', () => {
  it('accepts dot-notation role names', () => {
    const r = safeParse(RoleSetSchema, {
      'action.primary': { description: 'Primary CTA' },
      'feedback.error': {},
      'navigation.link': { description: 'Nav anchor' },
    })
    expect(r.success).toBe(true)
  })

  it('rejects role without dot', () => {
    const r = safeParse(RoleSetSchema, { action: {} })
    expect(r.success).toBe(false)
  })

  it('rejects role with uppercase', () => {
    const r = safeParse(RoleSetSchema, { 'Action.Primary': {} })
    expect(r.success).toBe(false)
  })

  it('rejects role with space', () => {
    const r = safeParse(RoleSetSchema, { 'action. primary': {} })
    expect(r.success).toBe(false)
  })
})

describe('ThemeAdapterSchema', () => {
  it('accepts adapter with id only (tokens-only adapter shape)', () => {
    const r = safeParse(ThemeAdapterSchema, { id: 'tokens-only' })
    expect(r.success).toBe(true)
  })

  it('accepts adapter with id + roleMap', () => {
    const r = safeParse(ThemeAdapterSchema, {
      id: 'tailwind',
      roleMap: { 'action.primary': 'bg-indigo-600 text-white' },
    })
    expect(r.success).toBe(true)
  })

  it('accepts adapter with id + cssRules', () => {
    const r = safeParse(ThemeAdapterSchema, {
      id: 'css-only',
      cssRules: { 'action.primary': 'background: var(--gz-color-primary);' },
    })
    expect(r.success).toBe(true)
  })

  it('rejects adapter without id', () => {
    const r = safeParse(ThemeAdapterSchema, {})
    expect(r.success).toBe(false)
  })

  it('rejects adapter with empty id string', () => {
    const r = safeParse(ThemeAdapterSchema, { id: '' })
    expect(r.success).toBe(false)
  })

  it('rejects adapter with non-string id', () => {
    const r = safeParse(ThemeAdapterSchema, { id: 42 })
    expect(r.success).toBe(false)
  })

  it('rejects adapter with invalid role name in roleMap', () => {
    const r = safeParse(ThemeAdapterSchema, {
      id: 'bad',
      roleMap: { invalidNoDot: 'cls' },
    })
    expect(r.success).toBe(false)
  })
})
