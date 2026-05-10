// role-coverage-report.test.ts — F7 plan 07-09 W5a Task 3.
//
// Tier-1 jsdom suite per `createRoleCoverageReport` (UI-DEVTOOLS-02).
//
// Verifica le 5 categorie di output:
// 1. registeredAndUsed (ruoli usati nel DOM E registrati)
// 2. registeredAndOrphan (ruoli registrati ma non usati nel DOM)
// 3. unregisteredAndUsedWarn (ruoli nel DOM ma non registrati)
// 4. inlineStyleWarn (nodi con `[data-gz-role]` + `style=`)
// 5. nonSemanticWarn (es. `<div data-gz-role="action.primary">`)
//
// Refs:
// - 07-09-PLAN.md Task 3 behavior 1-6
// - 07-CONTEXT.md UI-DEVTOOLS-02 + D-F7-17 + Pitfall HIGH #5

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ThemeAdapter } from '@gluezero/theme'
import { createRoleCoverageReport } from '../role-coverage-report'

describe('createRoleCoverageReport', () => {
  let scope: HTMLElement
  beforeEach(() => {
    scope = document.createElement('div')
    document.body.appendChild(scope)
  })
  afterEach(() => {
    document.body.removeChild(scope)
  })

  it('scan returns 5 frozen arrays', () => {
    const adapter: ThemeAdapter = { id: 'tw', roleMap: { 'action.primary': 'btn' } }
    const r = createRoleCoverageReport({
      adapter,
      roles: ['action.primary'],
      scope,
    })
    const result = r.scan()
    expect(Array.isArray(result.registeredAndUsed)).toBe(true)
    expect(Array.isArray(result.registeredAndOrphan)).toBe(true)
    expect(Array.isArray(result.unregisteredAndUsedWarn)).toBe(true)
    expect(Array.isArray(result.inlineStyleWarn)).toBe(true)
    expect(Array.isArray(result.nonSemanticWarn)).toBe(true)
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.registeredAndUsed)).toBe(true)
  })

  it('node with mapped role: registeredAndUsed entry with count + element list', () => {
    const btn = document.createElement('button')
    btn.setAttribute('data-gz-role', 'action.primary')
    scope.appendChild(btn)
    const btn2 = document.createElement('button')
    btn2.setAttribute('data-gz-role', 'action.primary')
    scope.appendChild(btn2)
    const adapter: ThemeAdapter = { id: 'tw', roleMap: { 'action.primary': 'btn' } }
    const r = createRoleCoverageReport({
      adapter,
      roles: ['action.primary'],
      scope,
    })
    const result = r.scan()
    expect(result.registeredAndUsed.length).toBe(1)
    expect(result.registeredAndUsed[0]?.role).toBe('action.primary')
    expect(result.registeredAndUsed[0]?.count).toBe(2)
    expect(result.registeredAndUsed[0]?.elements.length).toBe(2)
  })

  it('node with role mapped via cssRules also counts as registeredAndUsed', () => {
    const span = document.createElement('span')
    span.setAttribute('data-gz-role', 'surface.elevated')
    scope.appendChild(span)
    const adapter: ThemeAdapter = {
      id: 'b5',
      cssRules: { 'surface.elevated': 'box-shadow: 0 2px 8px rgba(0,0,0,.1);' },
    }
    const r = createRoleCoverageReport({
      adapter,
      roles: [],
      scope,
    })
    const result = r.scan()
    expect(result.registeredAndUsed.length).toBe(1)
    expect(result.registeredAndUsed[0]?.role).toBe('surface.elevated')
    expect(result.unregisteredAndUsedWarn.length).toBe(0)
  })

  it('node with orphan role: unregisteredAndUsedWarn flag', () => {
    const span = document.createElement('span')
    span.setAttribute('data-gz-role', 'orphan.role')
    scope.appendChild(span)
    const r = createRoleCoverageReport({
      adapter: { id: 'tw', roleMap: {} },
      roles: [],
      scope,
    })
    const result = r.scan()
    expect(result.unregisteredAndUsedWarn.length).toBe(1)
    expect(result.unregisteredAndUsedWarn[0]?.role).toBe('orphan.role')
    expect(result.unregisteredAndUsedWarn[0]?.count).toBe(1)
  })

  it('registered roles with no DOM use: registeredAndOrphan list', () => {
    const r = createRoleCoverageReport({
      adapter: null,
      roles: ['action.primary', 'feedback.error', 'navigation.link'],
      scope,
    })
    const result = r.scan()
    expect(result.registeredAndOrphan.length).toBe(3)
    expect(result.registeredAndOrphan).toContain('action.primary')
    expect(result.registeredAndOrphan).toContain('feedback.error')
    expect(result.registeredAndOrphan).toContain('navigation.link')
  })

  it('inline style flag: warn array with role + element + cssText', () => {
    const btn = document.createElement('button')
    btn.setAttribute('data-gz-role', 'action.primary')
    btn.setAttribute('style', 'color: red')
    scope.appendChild(btn)
    const adapter: ThemeAdapter = { id: 'tw', roleMap: { 'action.primary': 'btn' } }
    const r = createRoleCoverageReport({
      adapter,
      roles: ['action.primary'],
      scope,
    })
    const result = r.scan()
    expect(result.inlineStyleWarn.length).toBe(1)
    expect(result.inlineStyleWarn[0]?.role).toBe('action.primary')
    expect(result.inlineStyleWarn[0]?.cssText).toContain('color: red')
    expect(result.inlineStyleWarn[0]?.element).toBe(btn)
  })

  it('non-semantic role usage warn: <div data-gz-role="action.primary">', () => {
    const div = document.createElement('div')
    div.setAttribute('data-gz-role', 'action.primary')
    scope.appendChild(div)
    const adapter: ThemeAdapter = { id: 'tw', roleMap: { 'action.primary': 'btn' } }
    const r = createRoleCoverageReport({
      adapter,
      roles: ['action.primary'],
      scope,
    })
    const result = r.scan()
    expect(result.nonSemanticWarn.length).toBe(1)
    expect(result.nonSemanticWarn[0]?.role).toBe('action.primary')
    expect(result.nonSemanticWarn[0]?.got).toBe('DIV')
    expect(result.nonSemanticWarn[0]?.expected).toContain('BUTTON')
    expect(result.nonSemanticWarn[0]?.element).toBe(div)
  })

  it('semantic role usage <button data-gz-role="action.primary"> does NOT trigger nonSemanticWarn', () => {
    const btn = document.createElement('button')
    btn.setAttribute('data-gz-role', 'action.primary')
    scope.appendChild(btn)
    const r = createRoleCoverageReport({
      adapter: { id: 'tw', roleMap: { 'action.primary': 'btn' } },
      roles: ['action.primary'],
      scope,
    })
    const result = r.scan()
    expect(result.nonSemanticWarn.length).toBe(0)
  })

  it('non-semantic warn covers input.text on <div>', () => {
    const div = document.createElement('div')
    div.setAttribute('data-gz-role', 'input.text')
    scope.appendChild(div)
    const r = createRoleCoverageReport({
      adapter: null,
      roles: ['input.text'],
      scope,
    })
    const result = r.scan()
    expect(result.nonSemanticWarn.length).toBe(1)
    expect(result.nonSemanticWarn[0]?.expected).toContain('INPUT')
  })

  it('surface.* role on <div> does NOT trigger nonSemanticWarn (no expectation)', () => {
    const div = document.createElement('div')
    div.setAttribute('data-gz-role', 'surface.base')
    scope.appendChild(div)
    const r = createRoleCoverageReport({
      adapter: null,
      roles: ['surface.base'],
      scope,
    })
    const result = r.scan()
    expect(result.nonSemanticWarn.length).toBe(0)
  })

  it('default scope is document.body when scope omitted', () => {
    const span = document.createElement('span')
    span.setAttribute('data-gz-role', 'orphan.role')
    document.body.appendChild(span)
    const r = createRoleCoverageReport({
      adapter: null,
      roles: [],
    })
    const result = r.scan()
    // span is direct child of body → captured
    expect(
      result.unregisteredAndUsedWarn.some((e) => e.role === 'orphan.role'),
    ).toBe(true)
    document.body.removeChild(span)
  })

  it('empty scope returns all-empty result', () => {
    const r = createRoleCoverageReport({
      adapter: null,
      roles: [],
      scope,
    })
    const result = r.scan()
    expect(result.registeredAndUsed.length).toBe(0)
    expect(result.registeredAndOrphan.length).toBe(0)
    expect(result.unregisteredAndUsedWarn.length).toBe(0)
    expect(result.inlineStyleWarn.length).toBe(0)
    expect(result.nonSemanticWarn.length).toBe(0)
  })
})
