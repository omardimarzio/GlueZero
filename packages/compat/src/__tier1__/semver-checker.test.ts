/**
 * F12 W2 Task 1 — Tier-1 unit suite per `semver-checker.ts` (PRD §20.3 ranges).
 *
 * Coverage:
 * - 7 range types: exact, caret, tilde, range, x-range, OR, prerelease (default exclude).
 * - Defensive try-catch su range invalid (T-12-02 ReDoS mitigation companion).
 * - `isValidVersion` happy + edge cases.
 *
 * @see plan 12-02 Task 1 behavior — 12 test cases
 */
import { describe, expect, it } from 'vitest'
import { createSemverChecker } from '../semver-checker'

describe('createSemverChecker.satisfies (7 range types PRD §20.3)', () => {
  const checker = createSemverChecker()

  it('Test 1: satisfies("2.1.0", "^2.0.0") returns true (caret range)', () => {
    expect(checker.satisfies('2.1.0', '^2.0.0')).toBe(true)
  })

  it('Test 2: satisfies("3.0.0", "^2.0.0") returns false (caret major boundary)', () => {
    expect(checker.satisfies('3.0.0', '^2.0.0')).toBe(false)
  })

  it('Test 3: satisfies("1.2.5", "~1.2.3") returns true (tilde range)', () => {
    expect(checker.satisfies('1.2.5', '~1.2.3')).toBe(true)
  })

  it('Test 4: satisfies("1.3.0", "~1.2.3") returns false (tilde minor boundary)', () => {
    expect(checker.satisfies('1.3.0', '~1.2.3')).toBe(false)
  })

  it('Test 5: satisfies("2.5.0", ">=2.0.0 <3.0.0") returns true (range)', () => {
    expect(checker.satisfies('2.5.0', '>=2.0.0 <3.0.0')).toBe(true)
  })

  it('Test 6: satisfies("1.5.0", "1.x") returns true (x-range)', () => {
    expect(checker.satisfies('1.5.0', '1.x')).toBe(true)
  })

  it('Test 7: satisfies("2.3.4", "^1 || ^2") returns true (OR)', () => {
    expect(checker.satisfies('2.3.4', '^1 || ^2')).toBe(true)
  })

  it('Test 8: satisfies("1.0.0-rc.1", "^1.0.0") returns false (prerelease excluded default)', () => {
    expect(checker.satisfies('1.0.0-rc.1', '^1.0.0')).toBe(false)
  })

  it('Test 9: satisfies("1.0.0", "invalid-range") returns false (defensive try-catch)', () => {
    expect(checker.satisfies('1.0.0', 'invalid-range')).toBe(false)
  })
})

describe('createSemverChecker.isValidVersion', () => {
  const checker = createSemverChecker()

  it('Test 10: isValidVersion("1.2.3") returns true', () => {
    expect(checker.isValidVersion('1.2.3')).toBe(true)
  })

  it('Test 11: isValidVersion("garbage") returns false', () => {
    expect(checker.isValidVersion('garbage')).toBe(false)
  })

  it('Test 12: isValidVersion("") returns false', () => {
    expect(checker.isValidVersion('')).toBe(false)
  })
})
