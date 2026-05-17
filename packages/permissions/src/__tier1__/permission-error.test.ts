/**
 * Tier-1 unit test — PermissionError factory + publishDeniedTopics (MF-PERM-04).
 *
 * Copertura: shape PRD §19.6 strict + 2 topics F8 reused via import + payload
 * timestamp additive D-V2-F11-08 + source descriptor F1 D-23 + requiredPermission
 * opzionale omesso.
 *
 * @see packages/permissions/src/permission-error.ts
 * @see prd_2.0.0.md §19.6
 */
import { createBroker } from '@gluezero/core'
import { describe, expect, it, vi } from 'vitest'
import { createPermissionError, publishDeniedTopics } from '../permission-error'

describe('createPermissionError (shape PRD §19.6 strict)', () => {
  it('crea BrokerError con code PERMISSION_DENIED + category microfrontend + details', () => {
    const err = createPermissionError({
      code: 'PERMISSION_DENIED',
      message: 'MF mf1 denied publish customer.pii.email',
      details: { microFrontendId: 'mf1', action: 'publish', resource: 'customer.pii.email' },
    })
    expect(err.code).toBe('PERMISSION_DENIED')
    expect(err.category).toBe('microfrontend')
    expect(err.message).toBe('MF mf1 denied publish customer.pii.email')
    expect(err.details).toEqual({
      microFrontendId: 'mf1',
      action: 'publish',
      resource: 'customer.pii.email',
    })
  })

  it('crea BrokerError CAPABILITY_MISSING', () => {
    const err = createPermissionError({
      code: 'CAPABILITY_MISSING',
      message: 'MF mf2 missing capabilities',
      details: { microFrontendId: 'mf2', missing: ['theme.v1'] },
    })
    expect(err.code).toBe('CAPABILITY_MISSING')
    expect(err.category).toBe('microfrontend')
    expect(err.details?.missing).toEqual(['theme.v1'])
  })

  it('details opzionale omesso quando non passato', () => {
    const err = createPermissionError({
      code: 'PERMISSION_DENIED',
      message: 'no details',
    })
    expect(err.details).toBeUndefined()
  })
})

describe('publishDeniedTopics (2 topics F10 acl-enforcer pattern)', () => {
  it('pubblica permission.denied + microfrontend.permission.denied con payload identico', () => {
    const broker = createBroker({})
    const handler1 = vi.fn()
    const handler2 = vi.fn()
    broker.subscribe('permission.denied', handler1)
    broker.subscribe('microfrontend.permission.denied', handler2)

    publishDeniedTopics(broker, {
      mfId: 'mf1',
      action: 'publish',
      resource: 'customer.pii.email',
      requiredPermission: 'publish:customer.pii.*',
    })

    expect(handler1).toHaveBeenCalledOnce()
    expect(handler2).toHaveBeenCalledOnce()
    const event1 = handler1.mock.calls[0][0]
    const event2 = handler2.mock.calls[0][0]
    // Payload identico ai 2 topics
    expect(event1.payload).toEqual(event2.payload)
    // Payload shape PRD §19.6
    expect(event1.payload).toMatchObject({
      microFrontendId: 'mf1',
      action: 'publish',
      resource: 'customer.pii.email',
      requiredPermission: 'publish:customer.pii.*',
    })
    // timestamp additive non-breaking (D-V2-F11-08)
    expect(typeof event1.payload.timestamp).toBe('number')
  })

  it('payload senza requiredPermission opzionale è omesso (NOT explicit undefined)', () => {
    const broker = createBroker({})
    const handler = vi.fn()
    broker.subscribe('permission.denied', handler)

    publishDeniedTopics(broker, { mfId: 'mf1', action: 'subscribe', resource: 'private.*' })

    expect(handler).toHaveBeenCalledOnce()
    const payload = handler.mock.calls[0][0].payload
    expect('requiredPermission' in payload).toBe(false)
  })

  it('source descriptor F1 D-23 obbligatorio: plugin:permissions:@gluezero/permissions', () => {
    const broker = createBroker({})
    const handler = vi.fn()
    broker.subscribe('permission.denied', handler)

    publishDeniedTopics(broker, { mfId: 'mf1', action: 'publish', resource: 'X' })

    expect(handler.mock.calls[0][0].source).toMatchObject({
      type: 'plugin',
      id: 'permissions',
      name: '@gluezero/permissions',
    })
  })
})
