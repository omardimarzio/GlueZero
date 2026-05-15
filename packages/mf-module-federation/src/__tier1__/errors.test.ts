/**
 * Tier-1 jsdom — `errors.ts` MfModuleFederationError class + factory + 5 literal codes
 * (D-V2-F15-12 + REQ MF-MF-02 lockato).
 */
import { describe, expect, it } from 'vitest'
import {
  createMfModuleFederationError,
  MfModuleFederationError,
  type MfModuleFederationErrorCode,
} from '../errors'

describe('MfModuleFederationError — D-V2-F15-12 class + 5 literal codes (REQ MF-MF-02)', () => {
  it('instanceof MfModuleFederationError + Error', () => {
    const err = new MfModuleFederationError({
      code: 'MF_REMOTE_ENTRY_LOAD_FAILED',
      message: 'entry load failed',
    })
    expect(err).toBeInstanceOf(MfModuleFederationError)
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('MfModuleFederationError')
  })

  it('BrokerError shape: category = "microfrontend" readonly inline', () => {
    const err = new MfModuleFederationError({
      code: 'MF_REMOTE_SCOPE_NOT_FOUND',
      message: 'scope not found',
    })
    expect(err.category).toBe('microfrontend')
  })

  it('5 literal codes union — all valid (REQ MF-MF-02 lockato)', () => {
    const codes: MfModuleFederationErrorCode[] = [
      'MF_REMOTE_ENTRY_LOAD_FAILED',
      'MF_REMOTE_SCOPE_NOT_FOUND',
      'MF_REMOTE_MODULE_NOT_FOUND',
      'MF_REMOTE_FACTORY_FAILED',
      'MF_SHARE_SCOPE_FAILED',
    ]
    for (const code of codes) {
      const err = new MfModuleFederationError({ code, message: `test ${code}` })
      expect(err.code).toBe(code)
    }
  })

  it('microFrontendId + scope + module + details propagati', () => {
    const err = new MfModuleFederationError({
      code: 'MF_REMOTE_MODULE_NOT_FOUND',
      message: 'module not found',
      microFrontendId: 'mf-analytics',
      scope: 'analytics_app',
      module: './AnalyticsWidget',
      details: { url: 'https://cdn.example/remoteEntry.js' },
    })
    expect(err.microFrontendId).toBe('mf-analytics')
    expect(err.scope).toBe('analytics_app')
    expect(err.module).toBe('./AnalyticsWidget')
    expect(err.details).toEqual({ url: 'https://cdn.example/remoteEntry.js' })
  })

  it('originalError + cause ES2022 chain (planner-time micro-decision risolto)', () => {
    const original = new Error('underlying loadRemote error')
    const err = new MfModuleFederationError({
      code: 'MF_REMOTE_FACTORY_FAILED',
      message: 'factory failed',
      originalError: original,
    })
    expect(err.originalError).toBe(original)
    expect(err.cause).toBe(original)
  })

  it('createMfModuleFederationError factory equivalent al new MfModuleFederationError', () => {
    const errA = createMfModuleFederationError({
      code: 'MF_SHARE_SCOPE_FAILED',
      message: 'host shared section absent',
      microFrontendId: 'mf-x',
    })
    expect(errA).toBeInstanceOf(MfModuleFederationError)
    expect(errA.code).toBe('MF_SHARE_SCOPE_FAILED')
    expect(errA.microFrontendId).toBe('mf-x')
  })
})
