/**
 * Tier-3 Scenario SS #2 (Chromium reale): single-spa lifecycle invalid →
 * MF_SS_LIFECYCLE_INVALID throw + topic emission lifecycle.failed (D-V2-F15-11 + REQ MF-SS-01).
 *
 * **Strategia**: testiamo path di error per modulo non-conforming a single-spa contract:
 * - `module` returna oggetto senza bootstrap/mount/unmount (es. `{foo: 'bar'}`)
 * - `module` returna primitive (string/number)
 * - mount lifecycle throw runtime exception → propagation con MF_SS_LIFECYCLE_INVALID
 *
 * Coverage REQ MF-SS-01 + D-V2-F15-11 + 4 error codes union (MF_SS_LIFECYCLE_INVALID).
 *
 * @see PLAN 15-05 Phase A — Tier-3 Playwright Chromium 8 scenari (2 SS — failure)
 * @see SUMMARY 15-04 — ss-loader.test.ts Tier-1 errors path covered
 */
import type { Broker } from '@gluezero/core'
import type {
  LoaderContext,
  MicroFrontendDescriptor,
} from '@gluezero/microfrontends'
import { describe, expect, it, vi } from 'vitest'
import { MfSingleSpaError } from '../src/errors.js'
import { singleSpaLoader } from '../src/ss-loader.js'

function makeCtx(mfId = 'mf-ss-invalid'): LoaderContext {
  const broker = {
    publish: vi.fn(),
    subscribe: vi.fn(),
  } as unknown as Broker
  const descriptor: MicroFrontendDescriptor = {
    id: mfId,
    name: mfId,
    version: '1.0.0',
    loader: { type: 'single-spa' },
  } as MicroFrontendDescriptor
  return { broker, descriptor }
}

describe('Tier-3 SS #2: lifecycle invalid → MF_SS_LIFECYCLE_INVALID', () => {
  it('module returns object senza bootstrap/mount/unmount → MF_SS_LIFECYCLE_INVALID', async () => {
    const def = {
      type: 'single-spa' as const,
      module: () => Promise.resolve({ foo: 'bar' as never }),
    }
    await expect(singleSpaLoader.load(def, makeCtx() as never)).rejects.toThrow(
      MfSingleSpaError,
    )
    try {
      await singleSpaLoader.load(def, makeCtx() as never)
    } catch (err) {
      expect((err as MfSingleSpaError).code).toBe('MF_SS_LIFECYCLE_INVALID')
    }
  })

  it('module returns primitive (string) → MF_SS_LIFECYCLE_INVALID', async () => {
    const def = {
      type: 'single-spa' as const,
      module: () => Promise.resolve('not-an-app' as never),
    }
    await expect(singleSpaLoader.load(def, makeCtx() as never)).rejects.toBeInstanceOf(
      MfSingleSpaError,
    )
  })

  it('module returns null → MF_SS_LIFECYCLE_INVALID', async () => {
    const def = {
      type: 'single-spa' as const,
      module: () => Promise.resolve(null as never),
    }
    await expect(singleSpaLoader.load(def, makeCtx() as never)).rejects.toBeInstanceOf(
      MfSingleSpaError,
    )
  })

  it('module returns bootstrap-only (no mount, no unmount) → MF_SS_LIFECYCLE_INVALID', async () => {
    const def = {
      type: 'single-spa' as const,
      module: () =>
        Promise.resolve({
          bootstrap: () => Promise.resolve(),
          // mount + unmount mancanti
        } as never),
    }
    await expect(singleSpaLoader.load(def, makeCtx() as never)).rejects.toBeInstanceOf(
      MfSingleSpaError,
    )
  })

  it('module is not callable nor object → MF_SS_LIFECYCLE_INVALID', async () => {
    const def = {
      type: 'single-spa' as const,
      module: 42 as never,
    }
    await expect(singleSpaLoader.load(def, makeCtx() as never)).rejects.toBeInstanceOf(
      MfSingleSpaError,
    )
  })

  it('MfSingleSpaError shape: code + microFrontendId + appName fields', () => {
    const err = new MfSingleSpaError({
      code: 'MF_SS_LIFECYCLE_INVALID',
      message: 'Invalid lifecycle module shape',
      microFrontendId: 'mf-app',
      appName: 'app-name',
    })
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(MfSingleSpaError)
    expect(err.code).toBe('MF_SS_LIFECYCLE_INVALID')
    expect(err.microFrontendId).toBe('mf-app')
    expect(err.appName).toBe('app-name')
    expect(err.category).toBe('microfrontend')
  })

  it('4 literal codes union: each instantiable', () => {
    const codes = [
      'MF_SS_LIFECYCLE_INVALID',
      'MF_SS_BOOTSTRAP_FAILED',
      'MF_SS_MOUNT_FAILED',
      'MF_SS_UNMOUNT_FAILED',
    ] as const

    for (const code of codes) {
      const err = new MfSingleSpaError({
        code,
        message: `test ${code}`,
        microFrontendId: 'mf-test',
      })
      expect(err.code).toBe(code)
    }
  })
})
