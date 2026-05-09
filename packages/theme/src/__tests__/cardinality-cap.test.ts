// Tier-1 jsdom tests per `checkCap` cardinality helper (D-166 replica locale).
//
// Verifica le 4 zone del cap: under-soft / soft-warn (≥50%) / cap reached / allowMore opt-in.
// Pattern role-match con la classe stateful `packages/devtools/src/cardinality-cap.ts`
// (NON import — D-83 strict). Plan 07-02 Task 1.
//
// Refs: 07-02-PLAN.md Task 1 behavior tests 1-5; THEME-11; D-F7-11.

import { describe, expect, it } from 'vitest'
import {
  checkCap,
  ROLE_CAP,
  SOFT_WARN_RATIO,
  TOKEN_CAP,
} from '../cardinality-cap'

describe('checkCap — constants', () => {
  it('exposes TOKEN_CAP=200, ROLE_CAP=100, SOFT_WARN_RATIO=0.5', () => {
    expect(TOKEN_CAP).toBe(200)
    expect(ROLE_CAP).toBe(100)
    expect(SOFT_WARN_RATIO).toBe(0.5)
  })
})

describe('checkCap — under soft-warn threshold', () => {
  it('returns { allow: true } without warn for low counts', () => {
    expect(checkCap(0, 200, 'token')).toEqual({ allow: true })
    expect(checkCap(50, 200, 'token')).toEqual({ allow: true })
    expect(checkCap(99, 200, 'token')).toEqual({ allow: true })
  })
})

describe('checkCap — over soft-warn threshold (≥50%)', () => {
  it('returns allow:true with warn message at 50%', () => {
    const res = checkCap(100, 200, 'token')
    expect(res.allow).toBe(true)
    expect(res.warn).toBeDefined()
    expect(res.warn).toContain('100/200')
    expect(res.warn).toContain('over 50%')
  })

  it('returns allow:true with warn message at 75%', () => {
    const res = checkCap(150, 200, 'token')
    expect(res.allow).toBe(true)
    expect(res.warn).toContain('150/200')
    expect(res.warn).toContain('over 50%')
  })

  it('returns allow:true with warn message just below cap (199/200)', () => {
    const res = checkCap(199, 200, 'token')
    expect(res.allow).toBe(true)
    expect(res.warn).toContain('199/200')
  })
})

describe('checkCap — at or over cap (deny)', () => {
  it('returns allow:false with override hint at exact cap', () => {
    const res = checkCap(200, 200, 'token')
    expect(res.allow).toBe(false)
    expect(res.warn).toContain('cap reached')
    expect(res.warn).toContain('200')
    expect(res.warn).toContain('allowMore: true')
  })

  it('returns allow:false at cap+1', () => {
    const res = checkCap(201, 200, 'token')
    expect(res.allow).toBe(false)
    expect(res.warn).toContain('cap reached')
  })
})

describe('checkCap — allowMore opt-in override', () => {
  it('returns allow:true without warn at cap when allowMore=true', () => {
    expect(checkCap(200, 200, 'token', true)).toEqual({ allow: true })
  })

  it('returns allow:true without warn over cap when allowMore=true', () => {
    expect(checkCap(250, 200, 'token', true)).toEqual({ allow: true })
  })
})

describe('checkCap — role type messages', () => {
  it('uses "role" prefix in soft-warn message', () => {
    const res = checkCap(60, 100, 'role')
    expect(res.allow).toBe(true)
    expect(res.warn).toContain('role')
    expect(res.warn).toContain('60/100')
  })

  it('uses "role" prefix in cap-reached message', () => {
    const res = checkCap(100, 100, 'role')
    expect(res.allow).toBe(false)
    expect(res.warn).toContain('role cap reached')
  })

  it('returns allow:true under soft-warn for role (49/100)', () => {
    expect(checkCap(49, 100, 'role')).toEqual({ allow: true })
  })
})
