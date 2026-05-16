/**
 * Tier-3 Playwright Chromium scenario: `createReactMicroFrontendLifecycle` mount end-to-end.
 *
 * Verifica integration completa Factory + Provider + ErrorBoundary in real browser:
 * - `createRoot` reale (no jsdom stub) — React 19 concurrent rendering
 * - `mount(target)` effettivo + DOM target popolato
 * - `unmount()` + `destroy()` cleanup completo
 * - `metadata.microFrontendId` auto-iniezione MF-OBS-01 carryover F8
 *
 * @see MF-TEST-03 scenario PRD §40.2 (gap-filling React-specific)
 * @see D-V2-F17-17 Tier-3 Playwright Chromium
 */
import { describe, it, expect } from 'vitest'
import { createBroker } from '@gluezero/core'
import { createReactMicroFrontendLifecycle } from '../../src/factory.js'
import { GlueZeroProvider } from '../../src/provider.js'
import { useGlueZeroPublish } from '../../src/hooks/use-gluezero-publish.js'

function MyComponent(): JSX.Element {
  return <div data-testid="mf-root">hello from MF</div>
}

function ClickerComp(): JSX.Element {
  const publish = useGlueZeroPublish()
  return (
    <button
      data-testid="btn"
      onClick={() =>
        publish('test.click', { ts: 1 }, { source: { type: 'component', id: 'btn' } })
      }
    >
      click
    </button>
  )
}

describe('createReactMicroFrontendLifecycle — Tier-3 Playwright Chromium', () => {
  it('bootstrap + mount + unmount + destroy completa lifecycle in real browser', async () => {
    const broker = createBroker({})
    const lifecycle = createReactMicroFrontendLifecycle(MyComponent)
    const target = document.createElement('div')
    target.id = 'mf-target'
    document.body.appendChild(target)

    try {
      await lifecycle.bootstrap(broker)
      await lifecycle.mount(target)

      // Aspetta React paint reale (concurrent rendering React 19 può richiedere
      // più di un microtask). 2 RAF + setTimeout(0) garantisce flush deterministico.
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
      await new Promise<void>((r) => setTimeout(r, 0))

      const rendered = target.querySelector('[data-testid="mf-root"]')
      expect(rendered).not.toBeNull()
      expect(rendered?.textContent).toBe('hello from MF')

      await lifecycle.unmount()
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
      await new Promise<void>((r) => setTimeout(r, 0))

      expect(target.children.length).toBe(0)

      await lifecycle.destroy()
    } finally {
      document.body.removeChild(target)
    }
  })

  it('mfContext.id propagato a metadata.microFrontendId via useGlueZeroPublish', async () => {
    const broker = createBroker({})
    const received: Array<{ topic: string; metadata?: { microFrontendId?: string } }> = []
    broker.subscribe('test.click', (e) => {
      received.push(e as unknown as { topic: string; metadata?: { microFrontendId?: string } })
    })

    const lifecycle = createReactMicroFrontendLifecycle(ClickerComp)
    // Minimal mfContext mock per il Provider (richiede solo `id` per l'auto-iniezione)
    const mfContext = { id: 'mf-clicker' } as unknown as Parameters<
      typeof lifecycle.bootstrap
    >[1]
    const target = document.createElement('div')
    document.body.appendChild(target)

    try {
      await lifecycle.bootstrap(broker, mfContext)
      await lifecycle.mount(target)
      // 2 RAF + setTimeout(0) per garantire React 19 concurrent paint
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
      await new Promise<void>((r) => setTimeout(r, 0))

      const btn = target.querySelector('[data-testid="btn"]') as HTMLButtonElement | null
      expect(btn).not.toBeNull()
      btn?.click()

      // Default delivery is async (microtask) — wait two RAFs to flush
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
      await new Promise<void>((r) => setTimeout(r, 10))

      expect(received).toHaveLength(1)
      expect(received[0]?.metadata?.microFrontendId).toBe('mf-clicker')

      await lifecycle.destroy()
    } finally {
      document.body.removeChild(target)
    }
  })

  it('GlueZeroProvider standalone render con createRoot diretto (no factory)', async () => {
    const broker = createBroker({})
    const target = document.createElement('div')
    document.body.appendChild(target)

    const { createRoot } = await import('react-dom/client')
    const root = createRoot(target)
    root.render(
      <GlueZeroProvider broker={broker}>
        <MyComponent />
      </GlueZeroProvider>,
    )

    try {
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
      await new Promise<void>((r) => setTimeout(r, 0))
      const rendered = target.querySelector('[data-testid="mf-root"]')
      expect(rendered).not.toBeNull()
      expect(rendered?.textContent).toBe('hello from MF')
    } finally {
      root.unmount()
      document.body.removeChild(target)
    }
  })
})
