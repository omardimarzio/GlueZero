/**
 * `warning-matrix.test.ts` — Tier-1 unit suite (jsdom) per `detectInconsistentCombinations`.
 *
 * Cover REQ-IDs: MF-ISO-06 (5 combinazioni inconsistent rilevate + 5 valid no-warning).
 *
 * 10 test totali:
 *  1-5. Detection 5 codici (P-13 / IFRAME_EVENTS / STORAGE_BLOCKED_SHADOW /
 *       JS_SANDBOXED_MOUNT / GLOBALS_ISOLATED_JS_SHARED)
 *  6.   No-warning DEFAULT_ISOLATION_POLICY
 *  7.   No-warning canonical shadow-dom MF
 *  8.   No-warning canonical iframe MF
 *  9.   No-warning js:'shared-window' + network:'gateway-only' (P-13 NON triggera)
 * 10.   Multi-warning P-13 + GLOBALS_ISOLATED_JS_SHARED contemporaneamente
 */
import { describe, expect, test } from 'vitest'
import { DEFAULT_ISOLATION_POLICY } from './policy-resolver.js'
import { detectInconsistentCombinations } from './warning-matrix.js'
import type { ResolvedIsolationPolicy } from './types/policy.js'

const MF_ID = 'mf-test'

describe('detectInconsistentCombinations — 5 codici inconsistent (MF-ISO-06)', () => {
  test('1. P-13 detected: js="shared-window" + network="blocked" (PRD §21.9)', () => {
    const policy: ResolvedIsolationPolicy = {
      ...DEFAULT_ISOLATION_POLICY,
      js: 'shared-window',
      network: 'blocked',
    }
    const warnings = detectInconsistentCombinations(policy, MF_ID)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]?.code).toBe('P-13')
    expect(warnings[0]?.microFrontendId).toBe(MF_ID)
    expect(warnings[0]?.combination).toEqual({
      js: 'shared-window',
      network: 'blocked',
    })
    // PRD §21.9 substring lockato — drift detector.
    expect(warnings[0]?.message).toContain(
      'Network blocking cannot be fully enforced',
    )
    expect(typeof warnings[0]?.timestamp).toBe('number')
  })

  test('2. IFRAME_EVENTS detected: dom="iframe" + events="broker-plus-dom"', () => {
    const policy: ResolvedIsolationPolicy = {
      ...DEFAULT_ISOLATION_POLICY,
      dom: 'iframe',
      events: 'broker-plus-dom',
      // Evita trigger P-13: combo già fuori da shared-window+blocked.
      js: 'sandboxed-iframe',
    }
    const warnings = detectInconsistentCombinations(policy, MF_ID)
    const codes = warnings.map((w) => w.code)
    expect(codes).toContain('IFRAME_EVENTS')
    const w = warnings.find((x) => x.code === 'IFRAME_EVENTS')
    expect(w?.combination).toEqual({
      dom: 'iframe',
      events: 'broker-plus-dom',
    })
    expect(w?.message).toContain('CustomEvents do not cross iframe')
  })

  test('3. STORAGE_BLOCKED_SHADOW detected: storage="blocked" + dom="shadow-dom"', () => {
    const policy: ResolvedIsolationPolicy = {
      ...DEFAULT_ISOLATION_POLICY,
      dom: 'shadow-dom',
      storage: 'blocked',
    }
    const warnings = detectInconsistentCombinations(policy, MF_ID)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]?.code).toBe('STORAGE_BLOCKED_SHADOW')
    expect(warnings[0]?.combination).toEqual({
      storage: 'blocked',
      dom: 'shadow-dom',
    })
    expect(warnings[0]?.message).toContain('shadow-dom isolates DOM')
  })

  test('4. JS_SANDBOXED_MOUNT detected: js="sandboxed-iframe" + dom !== "iframe"', () => {
    const policy: ResolvedIsolationPolicy = {
      ...DEFAULT_ISOLATION_POLICY,
      js: 'sandboxed-iframe',
      // dom='mount-root' (default) — NON 'iframe' → triggera.
    }
    const warnings = detectInconsistentCombinations(policy, MF_ID)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]?.code).toBe('JS_SANDBOXED_MOUNT')
    expect(warnings[0]?.combination).toEqual({
      js: 'sandboxed-iframe',
      dom: 'mount-root',
    })
    expect(warnings[0]?.message).toContain(
      "js='sandboxed-iframe' requires dom='iframe'",
    )
    // Verifica interpolazione `policy.dom` nel template literal.
    expect(warnings[0]?.message).toContain("dom='mount-root'")
  })

  test('5. GLOBALS_ISOLATED_JS_SHARED detected: globals="isolated" + js="shared-window"', () => {
    const policy: ResolvedIsolationPolicy = {
      ...DEFAULT_ISOLATION_POLICY,
      globals: 'isolated',
      js: 'shared-window',
    }
    const warnings = detectInconsistentCombinations(policy, MF_ID)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]?.code).toBe('GLOBALS_ISOLATED_JS_SHARED')
    expect(warnings[0]?.combination).toEqual({
      globals: 'isolated',
      js: 'shared-window',
    })
    expect(warnings[0]?.message).toContain(
      "globals='isolated' is not enforceable",
    )
  })
})

describe('detectInconsistentCombinations — 5 valid (no-warning safe)', () => {
  test('6. DEFAULT_ISOLATION_POLICY → zero warnings (PRD §21.3 baseline safe)', () => {
    const warnings = detectInconsistentCombinations(
      DEFAULT_ISOLATION_POLICY,
      MF_ID,
    )
    expect(warnings).toHaveLength(0)
  })

  test('7. canonical shadow-dom MF (dom=shadow + css=shadow + storage=namespaced) → zero', () => {
    const policy: ResolvedIsolationPolicy = {
      ...DEFAULT_ISOLATION_POLICY,
      dom: 'shadow-dom',
      css: 'shadow-dom',
      storage: 'namespaced',
    }
    const warnings = detectInconsistentCombinations(policy, MF_ID)
    expect(warnings).toHaveLength(0)
  })

  test('8. canonical iframe MF (dom=iframe + js=sandboxed + events=isolated + network=gateway) → zero', () => {
    const policy: ResolvedIsolationPolicy = {
      ...DEFAULT_ISOLATION_POLICY,
      dom: 'iframe',
      js: 'sandboxed-iframe',
      events: 'isolated',
      network: 'gateway-only',
    }
    const warnings = detectInconsistentCombinations(policy, MF_ID)
    expect(warnings).toHaveLength(0)
  })

  test('9. js="shared-window" + network="gateway-only" → zero (P-13 NON triggera senza blocked)', () => {
    const policy: ResolvedIsolationPolicy = {
      ...DEFAULT_ISOLATION_POLICY,
      js: 'shared-window',
      network: 'gateway-only',
    }
    const warnings = detectInconsistentCombinations(policy, MF_ID)
    expect(warnings).toHaveLength(0)
  })

  test('10. multi-warning: P-13 + GLOBALS_ISOLATED_JS_SHARED contemporaneamente', () => {
    const policy: ResolvedIsolationPolicy = {
      ...DEFAULT_ISOLATION_POLICY,
      js: 'shared-window',
      network: 'blocked',
      globals: 'isolated',
    }
    const warnings = detectInconsistentCombinations(policy, MF_ID)
    expect(warnings).toHaveLength(2)
    const codes = warnings.map((w) => w.code).sort()
    expect(codes).toEqual(['GLOBALS_ISOLATED_JS_SHARED', 'P-13'])
    // Ogni warning ha lo stesso microFrontendId.
    for (const w of warnings) {
      expect(w.microFrontendId).toBe(MF_ID)
    }
  })
})
