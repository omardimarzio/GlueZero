/**
 * Tier-1 unit suite per `normalizeModule` — smart fallback priority 4-step
 * (D-V2-F9-05) + typeof strict (D-V2-F9-07) + mount obbligatorio (D-V2-F9-06) +
 * rich diagnostic details (D-V2-F9-08).
 *
 * 20 test case raggruppati per Strategy / strict / mount-required / details.
 *
 * Convention: identificatori inglesi, descrizioni `describe`/`it` italiane (CLAUDE.md).
 */
import type { BrokerError } from '@gluezero/core'
import { describe, expect, it } from 'vitest'
import { normalizeModule } from '../normalize'

/** Helper: lifecycle dummy con mount obbligatorio (D-V2-F9-06). */
function makeLifecycle(): {
  bootstrap: () => void
  mount: () => void
  unmount: () => void
} {
  return {
    bootstrap: () => undefined,
    mount: () => undefined,
    unmount: () => undefined,
  }
}

/** Helper: estrae il `code` da un'eccezione BrokerError catchata. */
function codeOf(err: unknown): string {
  return (err as BrokerError).code
}

describe('normalizeModule — Strategy 1 exportName esplicito (D-V2-F9-05)', () => {
  it('lookup module[exportName] con mount function valido → ritorna lifecycle', () => {
    const lc = makeLifecycle()
    const module = { app: lc }
    const lifecycle = normalizeModule(module, {
      url: 'https://cdn.example/mf.js',
      exportName: 'app',
    })
    expect(lifecycle.mount).toBe(lc.mount)
    expect(lifecycle.unmount).toBe(lc.unmount)
    expect(lifecycle.bootstrap).toBe(lc.bootstrap)
  })

  it('exportName missing → throws MF_LOADER_INVALID_MODULE con reason "exportName ... not found"', () => {
    const module = { default: makeLifecycle() }
    try {
      normalizeModule(module, {
        url: 'https://cdn.example/mf.js',
        exportName: 'missing',
      })
      expect.fail('should have thrown')
    } catch (err) {
      expect(codeOf(err)).toBe('MF_LOADER_INVALID_MODULE')
      const details = (err as BrokerError).details as { reason: string; exportName: string }
      expect(details.reason).toContain('exportName "missing" not found')
      expect(details.exportName).toBe('missing')
    }
  })

  it('exportName presente ma non-object → throws (no fall-through)', () => {
    const module = { app: 'not-an-object' }
    try {
      normalizeModule(module, { url: 'x', exportName: 'app' })
      expect.fail('should have thrown')
    } catch (err) {
      expect(codeOf(err)).toBe('MF_LOADER_INVALID_MODULE')
    }
  })

  it('exportName presente object ma senza mount → throws (no fall-through default/named)', () => {
    const module = {
      app: { bootstrap: () => undefined, unmount: () => undefined }, // NO mount
      default: makeLifecycle(), // valido ma NON deve essere usato per Strategy 1 fail-fast
    }
    try {
      normalizeModule(module, { url: 'x', exportName: 'app' })
      expect.fail('should have thrown (no fall-through D-V2-F9-05)')
    } catch (err) {
      expect(codeOf(err)).toBe('MF_LOADER_INVALID_MODULE')
    }
  })

  it('exportName === "default" → equivalente a omesso (cade su Strategy 2)', () => {
    const lc = makeLifecycle()
    const module = { default: lc }
    const lifecycle = normalizeModule(module, {
      url: 'x',
      exportName: 'default',
    })
    expect(lifecycle.mount).toBe(lc.mount)
  })
})

describe('normalizeModule — Strategy 2 default export', () => {
  it('default con mount function → ritorna lifecycle', () => {
    const lc = makeLifecycle()
    const lifecycle = normalizeModule({ default: lc }, { url: 'x' })
    expect(lifecycle.mount).toBe(lc.mount)
    expect(lifecycle.bootstrap).toBe(lc.bootstrap)
    expect(lifecycle.unmount).toBe(lc.unmount)
  })

  it('default con mount NON-function (null) → fall-through a named', () => {
    const namedMount = (): void => undefined
    const module = {
      default: { mount: null }, // mount esiste ma non function → escluso da extract
      mount: namedMount, // named flat valido
    }
    const lifecycle = normalizeModule(module, { url: 'x' })
    expect(lifecycle.mount).toBe(namedMount)
  })

  it('default con altri hook ma senza mount → fall-through a named', () => {
    const namedMount = (): void => undefined
    const module = {
      default: { bootstrap: () => undefined, destroy: () => undefined }, // no mount
      mount: namedMount,
    }
    const lifecycle = normalizeModule(module, { url: 'x' })
    expect(lifecycle.mount).toBe(namedMount)
  })

  it('default 5 hook tutti function → tutti inclusi (full lifecycle)', () => {
    const full = {
      bootstrap: () => undefined,
      mount: () => undefined,
      update: () => undefined,
      unmount: () => undefined,
      destroy: () => undefined,
    }
    const lifecycle = normalizeModule({ default: full }, { url: 'x' })
    expect(lifecycle.bootstrap).toBe(full.bootstrap)
    expect(lifecycle.mount).toBe(full.mount)
    expect(lifecycle.update).toBe(full.update)
    expect(lifecycle.unmount).toBe(full.unmount)
    expect(lifecycle.destroy).toBe(full.destroy)
  })
})

describe('normalizeModule — Strategy 3 named exports flat', () => {
  it('top-level mount + unmount → ritorna lifecycle con 2 hook', () => {
    const mount = (): void => undefined
    const unmount = (): void => undefined
    const module = { mount, unmount }
    const lifecycle = normalizeModule(module, { url: 'x' })
    expect(lifecycle.mount).toBe(mount)
    expect(lifecycle.unmount).toBe(unmount)
    expect(lifecycle.bootstrap).toBeUndefined()
  })

  it('top-level mount solo → ritorna lifecycle con 1 hook', () => {
    const mount = (): void => undefined
    const lifecycle = normalizeModule({ mount }, { url: 'x' })
    expect(lifecycle.mount).toBe(mount)
  })

  it('top-level update + destroy ma no mount → fall-through a Strategy 4 (throw)', () => {
    const module = {
      update: () => undefined,
      destroy: () => undefined,
      // NO mount → strategy 3 fallisce
    }
    try {
      normalizeModule(module, { url: 'x' })
      expect.fail('should have thrown')
    } catch (err) {
      expect(codeOf(err)).toBe('MF_LOADER_INVALID_MODULE')
      const details = (err as BrokerError).details as { reason: string }
      expect(details.reason).toContain('no valid lifecycle')
    }
  })
})

describe('normalizeModule — Strategy 4 throw (D-V2-F9-05 step 4)', () => {
  it('empty module → throws MF_LOADER_INVALID_MODULE con reason "no valid lifecycle"', () => {
    try {
      normalizeModule({}, { url: 'https://cdn.example/empty.js' })
      expect.fail('should have thrown')
    } catch (err) {
      expect(codeOf(err)).toBe('MF_LOADER_INVALID_MODULE')
      const details = (err as BrokerError).details as { reason: string; url: string }
      expect(details.reason).toContain('no valid lifecycle')
      expect(details.url).toBe('https://cdn.example/empty.js')
    }
  })

  it('module con default vuoto e niente named → throws', () => {
    try {
      normalizeModule({ default: {} }, { url: 'x' })
      expect.fail('should have thrown')
    } catch (err) {
      expect(codeOf(err)).toBe('MF_LOADER_INVALID_MODULE')
    }
  })
})

describe('normalizeModule — details rich diagnostic (D-V2-F9-08)', () => {
  it('details include hasDefault/defaultKeys/namedKeys/reason quando throw senza exportName', () => {
    const module = {
      default: { name: 'mf-x', version: '1.0.0' }, // NO mount → fail
      foo: 'bar',
      baz: 42,
    }
    try {
      normalizeModule(module, { url: 'https://cdn.example/mf.js' })
      expect.fail('should have thrown')
    } catch (err) {
      const details = (err as BrokerError).details as {
        url: string
        hasDefault: boolean
        defaultKeys: string[]
        namedKeys: string[]
        reason: string
        exportName?: string
      }
      expect(details.url).toBe('https://cdn.example/mf.js')
      expect(details.hasDefault).toBe(true)
      expect(details.defaultKeys).toEqual(['name', 'version'])
      expect(details.namedKeys).toEqual(['foo', 'baz'])
      expect(details.reason).toContain('no valid lifecycle')
      expect(details.exportName).toBeUndefined()
    }
  })

  it('details.exportName presente nel throw Strategy 1', () => {
    try {
      normalizeModule({ foo: 'bar' }, { url: 'x', exportName: 'missing' })
      expect.fail('should have thrown')
    } catch (err) {
      const details = (err as BrokerError).details as { exportName: string }
      expect(details.exportName).toBe('missing')
    }
  })

  it('hasDefault false se module senza key "default"', () => {
    try {
      normalizeModule({ foo: 1 }, { url: 'x' })
      expect.fail('should have thrown')
    } catch (err) {
      const details = (err as BrokerError).details as {
        hasDefault: boolean
        defaultKeys: string[]
        namedKeys: string[]
      }
      expect(details.hasDefault).toBe(false)
      expect(details.defaultKeys).toEqual([])
      expect(details.namedKeys).toEqual(['foo'])
    }
  })
})

describe('normalizeModule — typeof strict (D-V2-F9-07)', () => {
  it('hook = null → escluso (no throw, prosegue priority)', () => {
    const mount = (): void => undefined
    // bootstrap = null su default → escluso ma mount valido → lifecycle ritornato senza bootstrap
    const module = { default: { bootstrap: null, mount } }
    const lifecycle = normalizeModule(module, { url: 'x' })
    expect(lifecycle.mount).toBe(mount)
    expect(lifecycle.bootstrap).toBeUndefined() // escluso senza throw
  })

  it('hook = oggetto → escluso', () => {
    const mount = (): void => undefined
    const module = { default: { unmount: { not: 'a function' }, mount } }
    const lifecycle = normalizeModule(module, { url: 'x' })
    expect(lifecycle.mount).toBe(mount)
    expect(lifecycle.unmount).toBeUndefined()
  })

  it('hook = number → escluso', () => {
    const mount = (): void => undefined
    const module = { default: { update: 42, mount } }
    const lifecycle = normalizeModule(module, { url: 'x' })
    expect(lifecycle.mount).toBe(mount)
    expect(lifecycle.update).toBeUndefined()
  })

  it('hook = string → escluso', () => {
    const mount = (): void => undefined
    const module = { default: { destroy: 'fake', mount } }
    const lifecycle = normalizeModule(module, { url: 'x' })
    expect(lifecycle.mount).toBe(mount)
    expect(lifecycle.destroy).toBeUndefined()
  })

  it('hook = arrow function → incluso', () => {
    const arrowMount = (): void => undefined
    const lifecycle = normalizeModule({ default: { mount: arrowMount } }, { url: 'x' })
    expect(lifecycle.mount).toBe(arrowMount)
  })
})

describe('normalizeModule — mount obbligatorio (D-V2-F9-06)', () => {
  it('module con tutti gli hook tranne mount → throws', () => {
    const module = {
      default: {
        bootstrap: () => undefined,
        update: () => undefined,
        unmount: () => undefined,
        destroy: () => undefined,
        // NO mount
      },
    }
    try {
      normalizeModule(module, { url: 'x' })
      expect.fail('should have thrown')
    } catch (err) {
      expect(codeOf(err)).toBe('MF_LOADER_INVALID_MODULE')
    }
  })

  it('module con solo mount → lifecycle valido (altri hook no-op upstream)', () => {
    const mount = (): void => undefined
    const lifecycle = normalizeModule({ default: { mount } }, { url: 'x' })
    expect(lifecycle.mount).toBe(mount)
    expect(lifecycle.bootstrap).toBeUndefined()
    expect(lifecycle.unmount).toBeUndefined()
    expect(lifecycle.destroy).toBeUndefined()
  })
})
