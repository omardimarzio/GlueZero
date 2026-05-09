// Tier-1 jsdom tests per `getInitialThemeScript` IIFE anti-FOUC (Pitfall HIGH #1).
//
// Coverage: shape IIFE wrapper, presenza setAttribute(data-gz-theme/data-gz-mode),
// gating localStorage dietro `persistence === 'localStorage'`, matchMedia
// prefers-color-scheme detection, try/catch silent fallback.
//
// Refs: 07-01-PLAN.md Task 3 behavior tests 1-3; 07-RESEARCH.md Open Q1/Q2/Q3.

import { describe, expect, it } from 'vitest'
import { getInitialThemeScript } from '../get-initial-theme-script'

describe('getInitialThemeScript', () => {
  it('returns IIFE wrapper (starts with (function(){ and ends with })();)', () => {
    const script = getInitialThemeScript()
    expect(script.startsWith('(function(){')).toBe(true)
    expect(script.endsWith('})();')).toBe(true)
  })

  it('includes documentElement setAttribute for both data-gz-theme and data-gz-mode', () => {
    const script = getInitialThemeScript()
    expect(script).toContain("document.documentElement.setAttribute('data-gz-theme'")
    expect(script).toContain("document.documentElement.setAttribute('data-gz-mode'")
  })

  it('default persistence false: does NOT read localStorage', () => {
    const script = getInitialThemeScript()
    expect(script).not.toContain('localStorage.getItem')
  })

  it('explicit persistence false: does NOT read localStorage', () => {
    const script = getInitialThemeScript({ persistence: false })
    expect(script).not.toContain('localStorage.getItem')
  })

  it("persistence 'localStorage': reads gluezero.theme.mode key (Open Q3 4-keys namespace)", () => {
    const script = getInitialThemeScript({ persistence: 'localStorage' })
    expect(script).toContain("localStorage.getItem('gluezero.theme.mode')")
  })

  it("includes matchMedia('(prefers-color-scheme: dark)') for OS detection", () => {
    const script = getInitialThemeScript()
    expect(script).toContain("matchMedia('(prefers-color-scheme: dark)')")
  })

  it('includes try/catch with fallback to light/auto', () => {
    const script = getInitialThemeScript()
    expect(script).toContain('try {')
    expect(script).toContain('} catch (e) {')
    expect(script).toContain("'data-gz-theme', 'light'")
    expect(script).toContain("'data-gz-mode', 'auto'")
  })

  it('IIFE body is deterministic (no user-input interpolation — T-F7-05 mitigation)', () => {
    const script1 = getInitialThemeScript()
    const script2 = getInitialThemeScript()
    expect(script1).toBe(script2)
  })

  it("validates mode against allow-list ('light'|'dark'|'auto')", () => {
    const script = getInitialThemeScript({ persistence: 'localStorage' })
    expect(script).toContain("if (mode !== 'light' && mode !== 'dark' && mode !== 'auto')")
  })

  // Smoke runtime in jsdom: eseguendo il body IIFE, document.documentElement riceve
  // gli attributi attesi.
  it('runtime in jsdom: executing the IIFE sets data-gz-theme + data-gz-mode on <html>', () => {
    document.documentElement.removeAttribute('data-gz-theme')
    document.documentElement.removeAttribute('data-gz-mode')
    const script = getInitialThemeScript()
    // eslint-disable-next-line no-new-func
    new Function(script)()
    expect(document.documentElement.getAttribute('data-gz-theme')).toMatch(/^(light|dark)$/)
    expect(document.documentElement.getAttribute('data-gz-mode')).toMatch(/^(light|dark|auto)$/)
  })
})
