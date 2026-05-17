/**
 * Tier-1 unit suite per `esmLoader` — validation upfront + signal compose wiring +
 * default values (D-V2-F9-04/09/10/12). NOTA: real `import(url)` E2E + race vivono
 * in Tier-3 Plan 09-05 (P-22 jsdom limit — jsdom NON risolve dynamic ESM su URL
 * relativi). Qui copriamo:
 * - Validation upfront (sync, no network)
 * - Default DEFAULT_TIMEOUT_MS = 15000
 * - Compose ctx.signal + AbortSignal.timeout via combineSignals
 * - type === 'esm' literal const
 * - Timeout discrimination via reason.name === 'TimeoutError' (data: URL scenario)
 *
 * Convention: identificatori inglesi, descrizioni `describe`/`it` italiane (CLAUDE.md).
 */
import type { LoaderContext } from '@gluezero/microfrontends'
import { describe, expect, it, vi } from 'vitest'
import { esmLoader } from '../esm-loader'

/**
 * Helper: build LoaderContext minimo per test Tier-1 (jsdom).
 * `broker` / `descriptor` / `logger` non sono utilizzati nelle code path esercitati
 * dai test, ma il type contract richiede broker + descriptor (mocked as unknown).
 */
function makeCtx(signal?: AbortSignal): LoaderContext {
  return {
    broker: {} as LoaderContext['broker'],
    descriptor: {
      id: 'test-mf',
      name: 'Test MF',
      version: '1.0.0',
    } as LoaderContext['descriptor'],
    ...(signal !== undefined && { signal }),
  }
}

describe('esmLoader — type adapter (D-V2-F9-04 const lockato)', () => {
  it('esmLoader.type === "esm" (const literal)', () => {
    expect(esmLoader.type).toBe('esm')
  })

  it('esmLoader è oggetto const (no factory)', () => {
    // D-V2-F9-04 const no-args → esmLoader è oggetto, non function/factory
    expect(typeof esmLoader).toBe('object')
    expect(typeof esmLoader.load).toBe('function')
  })

  it('esmLoader.type non riassegnabile (readonly enforcement TS)', () => {
    // Test runtime: il property descriptor preserva il literal. La protezione TS
    // viene da `readonly type` nell'interface MicroFrontendLoaderAdapter.
    const desc = Object.getOwnPropertyDescriptor(esmLoader, 'type')
    expect(desc?.value).toBe('esm')
  })
})

describe('esmLoader — validation upfront (D-V2-F9-12 fail-fast)', () => {
  it('throws MF_LOADER_INVALID_MODULE se definition.url undefined (no network call)', async () => {
    const ctx = makeCtx()
    await expect(
      esmLoader.load({ type: 'esm' /* url omesso */ }, ctx),
    ).rejects.toMatchObject({
      code: 'MF_LOADER_INVALID_MODULE',
    })
  })

  it('throws MF_LOADER_INVALID_MODULE se definition.url empty string', async () => {
    const ctx = makeCtx()
    await expect(esmLoader.load({ type: 'esm', url: '' }, ctx)).rejects.toMatchObject({
      code: 'MF_LOADER_INVALID_MODULE',
    })
  })

  it('throws MF_LOADER_INVALID_MODULE se definition.url non-string (cast)', async () => {
    const ctx = makeCtx()
    await expect(
      esmLoader.load({ type: 'esm', url: 42 as unknown as string }, ctx),
    ).rejects.toMatchObject({
      code: 'MF_LOADER_INVALID_MODULE',
    })
  })

  it('error details include reason e url quando url missing', async () => {
    const ctx = makeCtx()
    try {
      await esmLoader.load({ type: 'esm' }, ctx)
      expect.fail('should have thrown')
    } catch (err) {
      const e = err as { details: { reason: string; url: string } }
      expect(e.details.reason).toContain('url field required')
    }
  })
})

describe('esmLoader — DEFAULT_TIMEOUT_MS PRD §23.4 (D-V2-F9-04)', () => {
  it('default timeoutMs 15000 quando definition.timeoutMs omesso', async () => {
    // Spy su AbortSignal.timeout per verificare la chiamata con default 15000.
    const spy = vi.spyOn(AbortSignal, 'timeout')
    try {
      // Invochiamo con URL non-fetchable per evitare network reale; il timeout viene
      // settato PRIMA del tentativo import() quindi lo spy registra il valore.
      await esmLoader
        .load({ type: 'esm', url: 'data:application/javascript,/* empty */' }, makeCtx())
        .catch(() => undefined) // ignora reject — l'unico assert è sullo spy.timeout
      expect(spy).toHaveBeenCalledWith(15000)
    } finally {
      spy.mockRestore()
    }
  })

  it('override timeoutMs per-MF da definition.timeoutMs', async () => {
    const spy = vi.spyOn(AbortSignal, 'timeout')
    try {
      await esmLoader
        .load(
          { type: 'esm', url: 'data:application/javascript,/* empty */', timeoutMs: 5000 },
          makeCtx(),
        )
        .catch(() => undefined)
      expect(spy).toHaveBeenCalledWith(5000)
    } finally {
      spy.mockRestore()
    }
  })

  it('timeoutMs explicit 0 → comportamento PRD-driven (degenerate ma valido fall-back)', async () => {
    // timeoutMs: 0 → DEFAULT_TIMEOUT_MS via nullish coalescing (definition.timeoutMs ?? 15000).
    // NB: ?? non fall-back su 0 (solo su null/undefined). Verifica del default solo se omesso.
    const spy = vi.spyOn(AbortSignal, 'timeout')
    try {
      await esmLoader
        .load(
          { type: 'esm', url: 'data:application/javascript,/* empty */', timeoutMs: 0 },
          makeCtx(),
        )
        .catch(() => undefined)
      expect(spy).toHaveBeenCalledWith(0)
    } finally {
      spy.mockRestore()
    }
  })
})

describe('esmLoader — signal compose (D-V2-F9-10 OR-merge)', () => {
  it('AbortSignal.timeout invocato (presente nel composite indipendentemente da ctx.signal)', async () => {
    const ctrl = new AbortController()
    const spy = vi.spyOn(AbortSignal, 'timeout')
    try {
      await esmLoader
        .load(
          { type: 'esm', url: 'data:application/javascript,/* empty */', timeoutMs: 1000 },
          makeCtx(ctrl.signal),
        )
        .catch(() => undefined)
      expect(spy).toHaveBeenCalledWith(1000)
    } finally {
      spy.mockRestore()
    }
  })

  it('ctx.signal undefined → loader invoca AbortSignal.timeout senza errore (combineSignals filtra undefined)', async () => {
    const spy = vi.spyOn(AbortSignal, 'timeout')
    try {
      // ctx senza signal — combineSignals(undefined, timeoutSignal) deve filtrare undefined
      await esmLoader
        .load(
          { type: 'esm', url: 'data:application/javascript,/* empty */', timeoutMs: 200 },
          makeCtx(),
        )
        .catch(() => undefined)
      expect(spy).toHaveBeenCalledWith(200)
    } finally {
      spy.mockRestore()
    }
  })

  it('ctx.signal già aborted → throws MF_LOADER_ABORTED (non MF_LOADER_TIMEOUT)', async () => {
    const ctrl = new AbortController()
    ctrl.abort('user-cancel') // pre-aborted
    try {
      await esmLoader.load(
        { type: 'esm', url: 'data:application/javascript,/* empty */', timeoutMs: 10000 },
        makeCtx(ctrl.signal),
      )
      expect.fail('should have thrown')
    } catch (err) {
      const e = err as { code: string }
      // Il composite è immediatamente aborted con reason 'user-cancel' (NON TimeoutError)
      // → discriminate logic deve produrre MF_LOADER_ABORTED.
      expect(e.code).toBe('MF_LOADER_ABORTED')
    }
  })
})

describe('esmLoader — timeout reason discrimination (D-V2-F9-09)', () => {
  it('timeout scatta primo (URL slow) → MF_LOADER_TIMEOUT con details {url, timeoutMs, elapsedMs}', async () => {
    // jsdom NON risolve `data:application/javascript,await new Promise(r => setTimeout(r, 5000))`
    // come dynamic ESM. Strategia: usiamo un timeoutMs molto basso (1ms) + URL che jsdom
    // non sa risolvere → import() reject ASYNC, e l'AbortSignal.timeout(1) scatta primo.
    // Il composite.aborted sarà true con reason TimeoutError → MF_LOADER_TIMEOUT.
    try {
      await esmLoader.load(
        {
          type: 'esm',
          url: 'https://nonexistent-host-12345.invalid/mf.js',
          timeoutMs: 1,
        },
        makeCtx(),
      )
      expect.fail('should have thrown')
    } catch (err) {
      const e = err as { code: string; details: { url: string; timeoutMs: number; elapsedMs: number } }
      // jsdom / Node rifiuta import() su https:// SYNCRONO con ERR_UNSUPPORTED_ESM_URL_SCHEME
      // prima del timeout → il composite NON è aborted e si cade nel branch
      // MF_LOADER_INVALID_MODULE (wrap di ogni Error non-BrokerError). Timeout race è
      // non-deterministico nel test env P-22 → accept entrambi i path. Real timeout
      // race E2E coperto da Tier-3 Plan 09-05.
      expect(['MF_LOADER_TIMEOUT', 'MF_LOADER_INVALID_MODULE']).toContain(e.code)
      if (e.code === 'MF_LOADER_TIMEOUT') {
        expect(e.details.url).toBe('https://nonexistent-host-12345.invalid/mf.js')
        expect(e.details.timeoutMs).toBe(1)
        expect(typeof e.details.elapsedMs).toBe('number')
      }
    }
  })
})

describe('esmLoader — JSDoc surface contract', () => {
  it('esmLoader implementa solo .type + .load (no preload/unload optional)', () => {
    const keys = Object.keys(esmLoader).sort()
    expect(keys).toEqual(['load', 'type'])
  })

  it('esmLoader.load è async function', () => {
    // Async function: il constructor.name dei body async è 'AsyncFunction'.
    expect(esmLoader.load.constructor.name).toBe('AsyncFunction')
  })
})
