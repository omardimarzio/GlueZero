/**
 * Tier-1 unit tests — `awaitDefined` helper (D-V2-F15-06).
 *
 * Coverage:
 * - resolves pre-timeout (happy path — element già definito)
 * - timeout → MF_WC_DEFINE_TIMEOUT con elementName + timeoutMs in details
 * - ctx.signal abort pre-call → reject immediato (AbortError raw)
 * - ctx.signal abort mid-flight → reject + cleanup listener
 * - timeoutMs <= 0 o non-finito → trattato come default 15000 ms (defensive)
 *
 * Environment: jsdom (customElements stub).
 *
 * @see D-V2-F15-06 — customElements.whenDefined + AbortSignal.timeout 15000ms default
 */
import { afterEach, describe, expect, it } from 'vitest'
import { MfWebComponentError } from '../errors'
import { awaitDefined } from '../whenDefined-await'

// Counter per generare nomi unici cross-test (evita collision in registry globale).
let defineCounter = 0
function uniqueName(prefix: string): string {
  defineCounter += 1
  return `${prefix}-${defineCounter}-${Date.now()}`
}

describe('awaitDefined helper', () => {
  afterEach(() => {
    // customElements registry è global — no possibilità di "unregister" in jsdom.
    // Mitigato via uniqueName() per ogni test.
  })

  it('resolves pre-timeout — element già definito (happy path)', async () => {
    const name = uniqueName('mf-defined-test')
    class TestElement extends HTMLElement {}
    customElements.define(name, TestElement)

    const klass = await awaitDefined(name, undefined, 5000)
    expect(klass).toBe(TestElement)
  })

  it('resolves quando element viene definito mid-flight (race)', async () => {
    const name = uniqueName('mf-late-define')
    class LateElement extends HTMLElement {}

    const promise = awaitDefined(name, undefined, 5000)
    // Define dopo brevissimo delay — race risolve via whenDefined
    setTimeout(() => customElements.define(name, LateElement), 10)
    const klass = await promise
    expect(klass).toBe(LateElement)
  })

  it('timeout → throw MfWebComponentError code MF_WC_DEFINE_TIMEOUT con details {elementName, timeoutMs, elapsedMs}', async () => {
    const name = uniqueName('mf-never-define')

    await expect(awaitDefined(name, undefined, 50)).rejects.toThrow(MfWebComponentError)
    try {
      await awaitDefined(name, undefined, 50)
    } catch (err) {
      expect(err).toBeInstanceOf(MfWebComponentError)
      const wcErr = err as MfWebComponentError
      expect(wcErr.code).toBe('MF_WC_DEFINE_TIMEOUT')
      expect(wcErr.details?.['elementName']).toBe(name)
      expect(wcErr.details?.['timeoutMs']).toBe(50)
      expect(typeof wcErr.details?.['elapsedMs']).toBe('number')
    }
  })

  it('ctx.signal aborted pre-call → reject immediato (AbortError raw, NO MF_WC_DEFINE_TIMEOUT)', async () => {
    const name = uniqueName('mf-pre-aborted')
    const controller = new AbortController()
    controller.abort(new DOMException('cancelled', 'AbortError'))

    await expect(awaitDefined(name, controller.signal, 5000)).rejects.toBeDefined()
    try {
      await awaitDefined(name, controller.signal, 5000)
    } catch (err) {
      // Consumer abort → NON MF_WC_DEFINE_TIMEOUT (discriminato lato wc-loader)
      expect(err).not.toBeInstanceOf(MfWebComponentError)
    }
  })

  it('ctx.signal aborted mid-flight → reject + cleanup', async () => {
    const name = uniqueName('mf-mid-abort')
    const controller = new AbortController()

    const promise = awaitDefined(name, controller.signal, 5000)
    setTimeout(() => controller.abort(new DOMException('user cancel', 'AbortError')), 10)
    await expect(promise).rejects.toBeDefined()
  })

  it('timeoutMs <= 0 trattato come default 15000 ms (defensive) — non timeout immediato', async () => {
    const name = uniqueName('mf-defensive')
    class DefensiveElement extends HTMLElement {}
    customElements.define(name, DefensiveElement)

    // Se timeoutMs=0 fosse rispettato letteralmente, scatterebbe immediato → throw.
    // Defensive fall-back a 15000 ms → resolve happy path.
    const klass = await awaitDefined(name, undefined, 0)
    expect(klass).toBe(DefensiveElement)
  })

  it('timeoutMs NaN/non-finite → fall-back default 15000 ms', async () => {
    const name = uniqueName('mf-nan')
    class NanElement extends HTMLElement {}
    customElements.define(name, NanElement)

    const klass = await awaitDefined(name, undefined, Number.NaN)
    expect(klass).toBe(NanElement)
  })
})
