/**
 * Mount Orchestrator — Tier-1 jsdom test (MF-MOUNT-01, MF-MOUNT-02, MF-MOUNT-03).
 *
 * Verifica:
 * - Selector resolution: `element` prevale su `selector`; not-found → throw
 * - Strategy `direct` REAL: attributes/className/style/containerId/clearBeforeMount/lifecycle.mount
 * - Strategy stub (`shadow-dom` / `iframe` / `custom`) → throw rilevante con hint package
 *
 * @see 08-08-PLAN.md acceptance_criteria
 */
import { describe, expect, it, vi } from 'vitest'
import type { LoadedModule } from './loader-registry'
import { orchestrateMount } from './mount-orchestrator'
import type { MicroFrontendMountDefinition, MountStrategy } from './types/mount'
import type { MicroFrontendRuntimeContext } from './types/runtime-context'

function makeStubCtx(id = 'test-mf'): MicroFrontendRuntimeContext {
  return {
    id,
    descriptor: { id, name: 'Test', version: '1.0.0' },
    broker: {} as never,
    publish: vi.fn(),
    subscribe: vi.fn(),
  } as unknown as MicroFrontendRuntimeContext
}

function makeLoadedModule(): LoadedModule {
  return {
    module: { mockId: 'inline' },
    lifecycle: {
      mount: vi.fn(async () => {}),
      unmount: vi.fn(async () => {}),
    },
  }
}

describe('orchestrateMount — selector resolution (MF-MOUNT-02)', () => {
  it('definition.element prevale su definition.selector', async () => {
    const elementA = document.createElement('div')
    elementA.id = 'element-a'
    const elementB = document.createElement('div')
    elementB.id = 'element-b'
    document.body.appendChild(elementB) // selector trovabile...

    const result = await orchestrateMount(
      { strategy: 'direct', selector: '#element-b', element: elementA },
      makeLoadedModule(),
      makeStubCtx(),
    )

    // ...ma element prevale.
    expect(result.container).toBe(elementA)
    document.body.removeChild(elementB)
  })

  it('selector resolution via document.querySelector', async () => {
    const target = document.createElement('div')
    target.id = 'sel-target'
    document.body.appendChild(target)

    const result = await orchestrateMount(
      { strategy: 'direct', selector: '#sel-target' },
      makeLoadedModule(),
      makeStubCtx(),
    )

    expect(result.container).toBe(target)
    document.body.removeChild(target)
  })

  it('selector non trovato → throw MF_MOUNT_TARGET_NOT_FOUND', async () => {
    await expect(
      orchestrateMount(
        { strategy: 'direct', selector: '#does-not-exist' },
        makeLoadedModule(),
        makeStubCtx(),
      ),
    ).rejects.toThrow(/MF_MOUNT_TARGET_NOT_FOUND|not found/i)
  })

  it('né element né selector forniti → throw MF_MOUNT_TARGET_NOT_FOUND', async () => {
    await expect(
      orchestrateMount({ strategy: 'direct' }, makeLoadedModule(), makeStubCtx()),
    ).rejects.toThrow(/neither.*selector.*element|MF_MOUNT_TARGET_NOT_FOUND/i)
  })

  it('element non-HTMLElement → throw MF_MOUNT_TARGET_NOT_FOUND', async () => {
    await expect(
      orchestrateMount(
        { strategy: 'direct', element: 'string-not-element' },
        makeLoadedModule(),
        makeStubCtx(),
      ),
    ).rejects.toThrow(/not a valid HTMLElement|MF_MOUNT_TARGET_NOT_FOUND/i)
  })
})

describe('orchestrateMount — strategy direct (real F8 impl)', () => {
  it('applica attributes/className/style al container', async () => {
    const target = document.createElement('div')
    document.body.appendChild(target)

    const result = await orchestrateMount(
      {
        strategy: 'direct',
        element: target,
        attributes: { 'data-mf-id': 'test-mf', 'data-version': '1.0.0' },
        className: 'mf-container active',
        style: { color: 'red', padding: '10px' },
      },
      makeLoadedModule(),
      makeStubCtx(),
    )

    expect(result.container.getAttribute('data-mf-id')).toBe('test-mf')
    expect(result.container.getAttribute('data-version')).toBe('1.0.0')
    expect(result.container.classList.contains('mf-container')).toBe(true)
    expect(result.container.classList.contains('active')).toBe(true)
    expect(result.container.style.color).toBe('red')
    expect(result.container.style.padding).toBe('10px')

    document.body.removeChild(target)
  })

  it('clearBeforeMount=true rimuove children pre-mount', async () => {
    const target = document.createElement('div')
    const child1 = document.createElement('span')
    const child2 = document.createElement('span')
    target.appendChild(child1)
    target.appendChild(child2)
    document.body.appendChild(target)

    await orchestrateMount(
      { strategy: 'direct', element: target, clearBeforeMount: true },
      makeLoadedModule(),
      makeStubCtx(),
    )

    expect(target.children.length).toBe(0)
    document.body.removeChild(target)
  })

  it('clearBeforeMount omesso/false NON rimuove children', async () => {
    const target = document.createElement('div')
    const child = document.createElement('span')
    target.appendChild(child)
    document.body.appendChild(target)

    await orchestrateMount(
      { strategy: 'direct', element: target },
      makeLoadedModule(),
      makeStubCtx(),
    )

    expect(target.children.length).toBe(1)
    expect(target.firstElementChild).toBe(child)
    document.body.removeChild(target)
  })

  it('containerId applica id al container', async () => {
    const target = document.createElement('div')
    document.body.appendChild(target)

    await orchestrateMount(
      { strategy: 'direct', element: target, containerId: 'custom-id' },
      makeLoadedModule(),
      makeStubCtx(),
    )

    expect(target.id).toBe('custom-id')
    document.body.removeChild(target)
  })

  it('className additivo (NOT replace) — preserva class esistenti', async () => {
    const target = document.createElement('div')
    target.classList.add('preexisting-class')
    document.body.appendChild(target)

    await orchestrateMount(
      { strategy: 'direct', element: target, className: 'new-class' },
      makeLoadedModule(),
      makeStubCtx(),
    )

    expect(target.classList.contains('preexisting-class')).toBe(true)
    expect(target.classList.contains('new-class')).toBe(true)
    document.body.removeChild(target)
  })

  it('chiama loaded.lifecycle.mount(ctx)', async () => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    const loaded = makeLoadedModule()
    const ctx = makeStubCtx()

    await orchestrateMount({ strategy: 'direct', element: target }, loaded, ctx)

    expect(loaded.lifecycle.mount).toHaveBeenCalledTimes(1)
    expect(loaded.lifecycle.mount).toHaveBeenCalledWith(ctx)
    document.body.removeChild(target)
  })

  it('lifecycle.mount assente → mount riesce comunque (hook opzionale)', async () => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    const loaded: LoadedModule = {
      module: { mockId: 'no-mount' },
      lifecycle: {}, // nessun hook
    }

    const result = await orchestrateMount(
      { strategy: 'direct', element: target },
      loaded,
      makeStubCtx(),
    )

    expect(result.container).toBe(target)
    expect(result.strategy).toBe('direct')
    document.body.removeChild(target)
  })

  it('strategy default è "direct" se non specificato', async () => {
    const target = document.createElement('div')
    document.body.appendChild(target)

    const result = await orchestrateMount(
      { element: target }, // no strategy field
      makeLoadedModule(),
      makeStubCtx(),
    )

    expect(result.strategy).toBe('direct')
    document.body.removeChild(target)
  })

  it('MountResult contiene container ref correttamente', async () => {
    const target = document.createElement('div')
    document.body.appendChild(target)

    const result = await orchestrateMount(
      { strategy: 'direct', element: target },
      makeLoadedModule(),
      makeStubCtx(),
    )

    expect(result).toMatchObject({
      container: target,
      strategy: 'direct',
    })
    expect(result.shadowRoot).toBeUndefined()
    expect(result.iframe).toBeUndefined()
    document.body.removeChild(target)
  })
})

describe('orchestrateMount — stub strategies (F13/F15/V2.1 dependencies)', () => {
  const stubCases: Array<{ strategy: MountStrategy; expectedMessage: RegExp }> = [
    { strategy: 'shadow-dom', expectedMessage: /requires @gluezero\/isolation/ },
    { strategy: 'iframe', expectedMessage: /requires @gluezero\/mf-iframe/ },
    { strategy: 'custom', expectedMessage: /Deferred to V2\.1/ },
  ]

  for (const { strategy, expectedMessage } of stubCases) {
    it(`strategy "${strategy}" stub → throws con hint rilevante`, async () => {
      const target = document.createElement('div')
      document.body.appendChild(target)

      await expect(
        orchestrateMount(
          { strategy, element: target } as MicroFrontendMountDefinition,
          makeLoadedModule(),
          makeStubCtx(),
        ),
      ).rejects.toThrow(expectedMessage)

      document.body.removeChild(target)
    })
  }

  it('stub shadow-dom include requiredPackage + availableFromPhase nei details', async () => {
    const target = document.createElement('div')
    document.body.appendChild(target)

    try {
      await orchestrateMount(
        { strategy: 'shadow-dom', element: target },
        makeLoadedModule(),
        makeStubCtx('shadow-mf'),
      )
      expect.fail('Should have thrown')
    } catch (err) {
      const e = err as { code?: string; details?: Record<string, unknown> }
      expect(e.code).toBe('MF_MOUNT_TARGET_NOT_FOUND')
      expect(e.details).toMatchObject({
        mfId: 'shadow-mf',
        strategy: 'shadow-dom',
        requiredPackage: '@gluezero/isolation',
        availableFromPhase: 'F13',
      })
    }
    document.body.removeChild(target)
  })

  it('stub iframe include requiredPackage + availableFromPhase nei details', async () => {
    const target = document.createElement('div')
    document.body.appendChild(target)

    try {
      await orchestrateMount(
        { strategy: 'iframe', element: target },
        makeLoadedModule(),
        makeStubCtx('iframe-mf'),
      )
      expect.fail('Should have thrown')
    } catch (err) {
      const e = err as { code?: string; details?: Record<string, unknown> }
      expect(e.code).toBe('MF_MOUNT_TARGET_NOT_FOUND')
      expect(e.details).toMatchObject({
        mfId: 'iframe-mf',
        strategy: 'iframe',
        requiredPackage: '@gluezero/mf-iframe',
        availableFromPhase: 'F15',
      })
    }
    document.body.removeChild(target)
  })

  it('stub custom include availableFromVersion nei details', async () => {
    const target = document.createElement('div')
    document.body.appendChild(target)

    try {
      await orchestrateMount(
        { strategy: 'custom', element: target },
        makeLoadedModule(),
        makeStubCtx('custom-mf'),
      )
      expect.fail('Should have thrown')
    } catch (err) {
      const e = err as { code?: string; details?: Record<string, unknown> }
      expect(e.code).toBe('MF_MOUNT_TARGET_NOT_FOUND')
      expect(e.details).toMatchObject({
        mfId: 'custom-mf',
        strategy: 'custom',
        availableFromVersion: 'V2.1',
      })
    }
    document.body.removeChild(target)
  })
})
