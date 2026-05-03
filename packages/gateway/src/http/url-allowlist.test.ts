// url-allowlist.test.ts — copre SEC-05 (D-71) URL allowlist guard pre-fetch.
//
// Behavior coperti (4 test):
// 1. allowlist undefined → pass (dev convenience, warning emesso al boot).
// 2. allowlist con regex → match URL → pass.
// 3. allowlist con string prefix → match URL prefix → pass.
// 4. URL fuori allowlist → throw BrokerError 'gateway.url.forbidden' con details.

import { isBrokerError } from '@sembridge/core'
import { describe, expect, it } from 'vitest'
import { validateAgainstAllowlist } from './url-allowlist'

describe('url-allowlist.ts (SEC-05 — D-71)', () => {
  it('allowlist undefined returns silently (dev convenience)', () => {
    expect(() => validateAgainstAllowlist('https://evil.com/api', undefined)).not.toThrow()
  })

  it('regex entry matching URL returns silently', () => {
    expect(() =>
      validateAgainstAllowlist('https://api.example.com/v1/weather', [
        /^https:\/\/api\.example\.com\//,
      ]),
    ).not.toThrow()
  })

  it('string prefix entry matching URL returns silently', () => {
    expect(() =>
      validateAgainstAllowlist('https://api.example.com/v1/users', ['https://api.example.com']),
    ).not.toThrow()
  })

  it('URL outside allowlist throws BrokerError gateway.url.forbidden with context', () => {
    let caught: unknown
    try {
      validateAgainstAllowlist('https://evil.com/exfil', ['https://api.example.com'], {
        routeId: 'r-1',
        topic: 'weather.requested',
        eventId: 'evt-123',
      })
    } catch (err) {
      caught = err
    }
    expect(isBrokerError(caught)).toBe(true)
    if (isBrokerError(caught)) {
      expect(caught.code).toBe('gateway.url.forbidden')
      expect(caught.category).toBe('config')
      expect(caught.routeId).toBe('r-1')
      expect(caught.topic).toBe('weather.requested')
      expect(caught.eventId).toBe('evt-123')
      expect(caught.details).toBeDefined()
    }
  })
})
