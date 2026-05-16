/**
 * Tier-1 jsdom tests per `createReactMicroFrontendLifecycle` (Task 4 — Phase 17 W2 P02).
 *
 * Verifica D-V2-F17-04:
 * - Shape ritornato {bootstrap, mount, unmount, destroy, lifecycleModule}
 * - mount() lancia se bootstrap() non chiamato
 * - mount() lancia se chiamato due volte senza unmount
 * - bootstrap + mount renderizza Component nel target
 * - unmount svuota il DOM
 * - destroy idempotente
 * - strictMode option default true e bypassabile
 *
 * @see createReactMicroFrontendLifecycle
 */
import { describe, it, expect, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { createBroker } from '@gluezero/core'

afterEach(() => {
  cleanup()
})
import { createReactMicroFrontendLifecycle } from '../src/factory.js'

function MyComp() {
  return <div data-testid="comp">hello</div>
}

async function flushReactRender(): Promise<void> {
  // Flush createRoot render iniziale (React 19 schedule via microtask)
  await new Promise<void>((r) => setTimeout(r, 0))
}

describe('createReactMicroFrontendLifecycle', () => {
  it('ritorna oggetto con bootstrap/mount/unmount/destroy + lifecycleModule', () => {
    const lifecycle = createReactMicroFrontendLifecycle(MyComp)
    expect(typeof lifecycle.bootstrap).toBe('function')
    expect(typeof lifecycle.mount).toBe('function')
    expect(typeof lifecycle.unmount).toBe('function')
    expect(typeof lifecycle.destroy).toBe('function')
    expect(typeof lifecycle.lifecycleModule).toBe('object')
  })

  it('mount() chiamato senza bootstrap() prior → lancia Error', async () => {
    const lifecycle = createReactMicroFrontendLifecycle(MyComp)
    const target = document.createElement('div')
    await expect(lifecycle.mount(target)).rejects.toThrow(/bootstrap/)
  })

  it('bootstrap + mount(target) renderizza Component dentro target', async () => {
    const broker = createBroker({})
    const lifecycle = createReactMicroFrontendLifecycle(MyComp)
    const target = document.createElement('div')
    document.body.appendChild(target)
    try {
      await lifecycle.bootstrap(broker)
      await lifecycle.mount(target)
      await flushReactRender()
      expect(target.querySelector('[data-testid="comp"]')?.textContent).toBe('hello')
      await lifecycle.destroy()
    } finally {
      document.body.removeChild(target)
    }
  })

  it('unmount() svuota il DOM target', async () => {
    const broker = createBroker({})
    const lifecycle = createReactMicroFrontendLifecycle(MyComp)
    const target = document.createElement('div')
    document.body.appendChild(target)
    try {
      await lifecycle.bootstrap(broker)
      await lifecycle.mount(target)
      await flushReactRender()
      await lifecycle.unmount()
      await flushReactRender()
      expect(target.children.length).toBe(0)
    } finally {
      document.body.removeChild(target)
    }
  })

  it('mount() doppio chiamato senza unmount() → lancia Error', async () => {
    const broker = createBroker({})
    const lifecycle = createReactMicroFrontendLifecycle(MyComp)
    const target = document.createElement('div')
    document.body.appendChild(target)
    try {
      await lifecycle.bootstrap(broker)
      await lifecycle.mount(target)
      await expect(lifecycle.mount(target)).rejects.toThrow(/già/)
      await lifecycle.destroy()
    } finally {
      document.body.removeChild(target)
    }
  })

  it('destroy() idempotente (multiple chiamate safe)', async () => {
    const broker = createBroker({})
    const lifecycle = createReactMicroFrontendLifecycle(MyComp)
    const target = document.createElement('div')
    document.body.appendChild(target)
    try {
      await lifecycle.bootstrap(broker)
      await lifecycle.mount(target)
      await lifecycle.destroy()
      await expect(lifecycle.destroy()).resolves.not.toThrow()
    } finally {
      document.body.removeChild(target)
    }
  })

  it('options.strictMode: false skips StrictMode wrap (Component renderizzato)', async () => {
    const broker = createBroker({})
    const lifecycle = createReactMicroFrontendLifecycle(MyComp, { strictMode: false })
    const target = document.createElement('div')
    document.body.appendChild(target)
    try {
      await lifecycle.bootstrap(broker)
      await lifecycle.mount(target)
      await flushReactRender()
      expect(target.querySelector('[data-testid="comp"]')?.textContent).toBe('hello')
      await lifecycle.destroy()
    } finally {
      document.body.removeChild(target)
    }
  })

  it('lifecycleModule (F8 adapter) ha shape MicroFrontendRuntimeModule (bootstrap/mount/unmount/destroy)', () => {
    const lifecycle = createReactMicroFrontendLifecycle(MyComp, {
      mountTarget: document.createElement('div'),
    })
    const m = lifecycle.lifecycleModule
    expect(typeof m.bootstrap).toBe('function')
    expect(typeof m.mount).toBe('function')
    expect(typeof m.unmount).toBe('function')
    expect(typeof m.destroy).toBe('function')
  })
})
