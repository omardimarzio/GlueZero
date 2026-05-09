/**
 * Tier-1 jsdom tests per `STANDARD_ROLES` + `STANDARD_ROLE_DEFINITIONS`
 * (D-F7-15 vocabolario lockato 14 ruoli, D-F7-16 dot-notation enforcement).
 *
 * Refs:
 * - 07-CONTEXT.md D-F7-15 (lista esatta ruoli) + D-F7-16 (dot-notation)
 * - 07-05-PLAN.md Task 1
 * - UI-ROLE-07
 */
import { describe, expect, it } from 'vitest'
import {
  STANDARD_ROLE_DEFINITIONS,
  STANDARD_ROLES,
  type StandardRole,
} from '../standard-roles'

describe('STANDARD_ROLES (D-F7-15)', () => {
  it('contains exactly 14 roles', () => {
    expect(STANDARD_ROLES.length).toBe(14)
  })

  it('contains the locked vocabulary', () => {
    expect([...STANDARD_ROLES].sort()).toEqual([
      'action.danger',
      'action.ghost',
      'action.primary',
      'action.secondary',
      'feedback.error',
      'feedback.info',
      'feedback.success',
      'feedback.warning',
      'input.invalid',
      'input.text',
      'navigation.active',
      'navigation.link',
      'surface.base',
      'surface.elevated',
    ])
  })

  it('all roles match dot-notation regex (D-F7-16)', () => {
    const re = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/
    for (const role of STANDARD_ROLES) {
      expect(role, `${role} must match dot-notation`).toMatch(re)
    }
  })

  it('has no duplicates', () => {
    const set = new Set(STANDARD_ROLES)
    expect(set.size).toBe(STANDARD_ROLES.length)
  })

  it('is frozen (immutable as const)', () => {
    expect(Object.isFrozen(STANDARD_ROLES)).toBe(true)
  })

  it('STANDARD_ROLE_DEFINITIONS has all 14 entries with non-empty description', () => {
    const keys = Object.keys(STANDARD_ROLE_DEFINITIONS)
    expect(keys.length).toBe(14)
    for (const role of STANDARD_ROLES) {
      const def = STANDARD_ROLE_DEFINITIONS[role as StandardRole]
      expect(def.description).toBeTruthy()
      expect(typeof def.description).toBe('string')
    }
  })

  it('definitions object is frozen', () => {
    expect(Object.isFrozen(STANDARD_ROLE_DEFINITIONS)).toBe(true)
  })

  it('every STANDARD_ROLES entry has a corresponding definition key', () => {
    const defKeys = new Set(Object.keys(STANDARD_ROLE_DEFINITIONS))
    for (const role of STANDARD_ROLES) {
      expect(defKeys.has(role)).toBe(true)
    }
  })
})
