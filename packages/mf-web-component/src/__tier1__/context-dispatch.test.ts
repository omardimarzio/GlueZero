/**
 * Tier-1 unit tests — `applyContext` 3-mode dispatcher (D-V2-F15-05).
 *
 * Coverage:
 * - mode 'property' (default): reference identity preserved via setter
 * - mode 'attribute': subset serializable JSON valido {tenantId, locale, environment, direction}
 * - mode 'event': CustomEvent('gluezero:context', {detail: {context}, bubbles: false, composed: false})
 * - mode invalid: throw MF_WC_CONTEXT_MODE_INVALID
 * - context.locale undefined: attribute mode omette field
 * - direction undefined: handled gracefully (no JSON error)
 *
 * Environment: jsdom (DOM + CustomEvent + HTMLElement).
 *
 * @see D-V2-F15-05 — Default contextMode property + 3-mode dispatcher
 */
import { describe, expect, it, vi } from 'vitest'
import { applyContext } from '../context-dispatch'
import { MfWebComponentError } from '../errors'

describe('applyContext 3-mode dispatcher', () => {
  it("mode 'property': element.glueZeroContext === context (reference identity preserved)", () => {
    const element = document.createElement('div')
    const context = { tenantId: 'acme', locale: 'it-IT', user: { id: 'u1' } }
    applyContext(element, context, 'property')
    expect((element as unknown as { glueZeroContext: unknown }).glueZeroContext).toBe(context)
  })

  it("mode 'attribute': subset serializable {tenantId,locale,environment,direction} JSON valido", () => {
    const element = document.createElement('div')
    const context = {
      tenantId: 'acme',
      locale: 'it-IT',
      environment: 'production',
      direction: 'ltr',
      // Field non serializable subset — esclusi
      permissions: ['read'],
      featureFlags: { x: true },
    }
    applyContext(element, context, 'attribute')
    const raw = element.getAttribute('data-gluezero-context')
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    expect(parsed).toEqual({
      tenantId: 'acme',
      locale: 'it-IT',
      environment: 'production',
      direction: 'ltr',
    })
    expect(parsed.permissions).toBeUndefined()
    expect(parsed.featureFlags).toBeUndefined()
  })

  it("mode 'event': CustomEvent('gluezero:context', {detail.context}) dispatched, NO bubbles NO composed", () => {
    const element = document.createElement('div')
    const context = { tenantId: 'acme', locale: 'en-US' }
    const handler = vi.fn()
    element.addEventListener('gluezero:context', handler)
    applyContext(element, context, 'event')
    expect(handler).toHaveBeenCalledOnce()
    const event = handler.mock.calls[0]![0] as CustomEvent
    expect(event.detail.context).toBe(context)
    expect(event.bubbles).toBe(false)
    expect(event.composed).toBe(false)
  })

  it('mode invalid: throw MfWebComponentError code MF_WC_CONTEXT_MODE_INVALID', () => {
    const element = document.createElement('div')
    expect(() =>
      applyContext(element, {}, 'unknown' as unknown as 'property'),
    ).toThrow(MfWebComponentError)
    try {
      applyContext(element, {}, 'totally-bogus' as unknown as 'property')
    } catch (err) {
      expect(err).toBeInstanceOf(MfWebComponentError)
      expect((err as MfWebComponentError).code).toBe('MF_WC_CONTEXT_MODE_INVALID')
      expect((err as MfWebComponentError).details?.['mode']).toBe('totally-bogus')
    }
  })

  it('attribute mode: context.locale undefined → field omesso dal JSON (no null/undefined entries)', () => {
    const element = document.createElement('div')
    applyContext(element, { tenantId: 'acme', environment: 'dev' }, 'attribute')
    const parsed = JSON.parse(element.getAttribute('data-gluezero-context')!)
    expect(parsed).toEqual({ tenantId: 'acme', environment: 'dev' })
    expect('locale' in parsed).toBe(false)
    expect('direction' in parsed).toBe(false)
  })

  it('attribute mode: context vuoto/null → JSON "{}" valido (no throw)', () => {
    const elementA = document.createElement('div')
    applyContext(elementA, null, 'attribute')
    expect(elementA.getAttribute('data-gluezero-context')).toBe('{}')

    const elementB = document.createElement('div')
    applyContext(elementB, undefined, 'attribute')
    expect(elementB.getAttribute('data-gluezero-context')).toBe('{}')
  })
})
