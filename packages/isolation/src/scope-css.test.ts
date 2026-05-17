/**
 * Tier-1 unit suite per `scope-css.ts` (W2 P03 — 5 test).
 *
 * Cover REQ-IDs: MF-ISO-02 parziale (scopeCss helper opt-in per css='scoped').
 *
 * @see D-V2-F13-06 — minimal regex Claude's Discretion CONTEXT.md
 */
import { describe, expect, it } from 'vitest'
import { scopeCss } from './scope-css.js'

describe('scopeCss', () => {
  it('selettore top-level: prefissa `.btn` con `[data-gz-mf="<id>"]`', () => {
    const out = scopeCss('.btn { color: red; }', 'mf-1')

    expect(out).toContain('[data-gz-mf="mf-1"] .btn')
    expect(out).toContain('color: red;')
  })

  it('comma-separated list: prefissa ogni selettore della lista', () => {
    const out = scopeCss('.a, .b { color: red; }', 'mf-1')

    expect(out).toContain('[data-gz-mf="mf-1"] .a')
    expect(out).toContain('[data-gz-mf="mf-1"] .b')
    // Comma separator tra i selettori scopati preservato.
    expect(out).toMatch(/\[data-gz-mf="mf-1"\] \.a,\s+\[data-gz-mf="mf-1"\] \.b/)
  })

  it('@media: preservato + body scopato ricorsivamente', () => {
    const out = scopeCss('@media (max-width: 600px) { .a { color: red; } }', 'mf-1')

    expect(out).toContain('@media (max-width: 600px)')
    // Selettore interno scopato.
    expect(out).toContain('[data-gz-mf="mf-1"] .a')
    // Il prefix NON è applicato al `@media` header stesso.
    expect(out).not.toMatch(/\[data-gz-mf="mf-1"\] @media/)
  })

  it('@keyframes: preservato as-is (NO scope su steps `0%`/`100%`)', () => {
    const out = scopeCss('@keyframes spin { 0% { transform: rotate(0); } 100% { transform: rotate(360deg); } }', 'mf-1')

    expect(out).toContain('@keyframes spin')
    expect(out).toContain('0%')
    expect(out).toContain('100%')
    // Step selettori NON sono prefissati con lo scope attribute.
    expect(out).not.toContain('[data-gz-mf="mf-1"] 0%')
    expect(out).not.toContain('[data-gz-mf="mf-1"] 100%')
  })

  it('nested no-rewrite (PostCSS-style overkill F13): .a outer scopato, .b inner NON ri-scopato', () => {
    const out = scopeCss('.a { .b { color: red; } }', 'mf-1')

    // Outer scopato.
    expect(out).toContain('[data-gz-mf="mf-1"] .a')
    // Nested .b NON è re-prefissato (limitazione documented overkill F13).
    // Verifica: occorrenze di `[data-gz-mf="mf-1"]` === 1 (solo outer).
    const occurrences = (out.match(/\[data-gz-mf="mf-1"\]/g) ?? []).length
    expect(occurrences).toBe(1)
  })
})
