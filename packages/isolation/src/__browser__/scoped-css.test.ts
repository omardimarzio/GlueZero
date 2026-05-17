/**
 * Tier-3 Playwright Chromium Scenario 2: scoped CSS + data-gz-mf attribute + scopeCss helper.
 *
 * D-V2-F13-14 + D-V2-F13-23: verifica isolation visiva selettore globale NON applicato dentro scope.
 *
 * @see prd_2.0.0.md §21.5 — CSS isolation scoped mode
 * @see D-V2-F13-06 — scopeCss helper minimal regex
 */
import { describe, expect, it } from 'vitest'
import { applyCssIsolation } from '../css-isolation.js'
import { scopeCss } from '../scope-css.js'
import { DEFAULT_ISOLATION_POLICY } from '../types/policy.js'

describe('Tier-3 Chromium — Scenario 2: scoped CSS', () => {
  it('applyCssIsolation set data-gz-mf attribute', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const mount = { element: host, context: {} }
    applyCssIsolation(mount, 'mf-scoped-1', { ...DEFAULT_ISOLATION_POLICY, css: 'scoped' })
    expect(host.getAttribute('data-gz-mf')).toBe('mf-scoped-1')
    document.body.removeChild(host)
  })

  it('scopeCss helper rewrite + isolation visiva (selettore globale NON applicato dentro scope)', () => {
    // Setup: 2 elementi `.btn`, uno fuori scope, uno dentro scope mf-1.
    const outer = document.createElement('div')
    outer.className = 'btn'
    outer.textContent = 'outer'
    outer.style.color = 'green' // default fallback se nessuna regola applica

    const inner = document.createElement('div')
    inner.setAttribute('data-gz-mf', 'mf-scoped-2')
    const innerBtn = document.createElement('div')
    innerBtn.className = 'btn'
    innerBtn.textContent = 'inner'
    inner.appendChild(innerBtn)

    document.body.appendChild(outer)
    document.body.appendChild(inner)

    // Inject scopeCss-generated stylesheet
    const rawCss = '.btn { color: rgb(255, 0, 0); }'
    const scoped = scopeCss(rawCss, 'mf-scoped-2')
    expect(scoped).toContain('[data-gz-mf="mf-scoped-2"] .btn')

    const styleEl = document.createElement('style')
    styleEl.textContent = scoped
    document.head.appendChild(styleEl)

    // Inner .btn riceve color: rgb(255, 0, 0) (rosso) — selettore scope matched
    const innerStyle = window.getComputedStyle(innerBtn)
    expect(innerStyle.color).toBe('rgb(255, 0, 0)')

    // Outer .btn NON riceve color rosso — selettore scope NON match (fallback computed default)
    const outerStyle = window.getComputedStyle(outer)
    expect(outerStyle.color).not.toBe('rgb(255, 0, 0)')

    document.body.removeChild(outer)
    document.body.removeChild(inner)
    document.head.removeChild(styleEl)
  })

  it('scopeCss preserva @media + scopa body interno', () => {
    const rawCss = '@media (min-width: 1px) { .item { color: blue; } }'
    const scoped = scopeCss(rawCss, 'mf-media')
    expect(scoped).toContain('@media (min-width: 1px)')
    expect(scoped).toContain('[data-gz-mf="mf-media"] .item')
  })

  it('scopeCss preserva @keyframes as-is (NO scope)', () => {
    const rawCss = '@keyframes spin { 0% { transform: rotate(0); } }'
    const scoped = scopeCss(rawCss, 'mf-key')
    expect(scoped).toContain('@keyframes spin')
    expect(scoped).not.toContain('[data-gz-mf="mf-key"] 0%')
  })
})
