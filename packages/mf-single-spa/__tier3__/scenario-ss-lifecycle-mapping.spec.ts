/**
 * Tier-3 Scenario SS #1 (Chromium reale): single-spa lifecycle mapping bit-exact
 * bootstrap → mount → unmount + topic emission chain
 * `microfrontend.lifecycle.{phase}.{started,completed}` governance + NO router replacement
 * verification (D-V2-F15-11 + REQ MF-SS-01).
 *
 * **Strategia**: testiamo `singleSpaLoader` direttamente in Chromium real — happy path
 * lifecycle invocation chain + topic emit governance + ssProps shape (NO singleSpa /
 * mountParcel propagated — REQ MF-SS-01 + V2.1 deferred).
 *
 * Coverage REQ MF-SS-01 + D-V2-F15-11 + lifecycle bit-exact PRD §27.4.
 *
 * @see PLAN 15-05 Phase A — Tier-3 Playwright Chromium 8 scenari (2 SS)
 * @see SUMMARY 15-04 — ss-loader.test.ts Tier-1 17 PASS
 */
import type { Broker } from '@gluezero/core'
import type {
  LoaderContext,
  MicroFrontendDescriptor,
  MicroFrontendRuntimeContext,
} from '@gluezero/microfrontends'
import { describe, expect, it, vi } from 'vitest'
import { __setMountContainerForTests, singleSpaLoader } from '../src/ss-loader.js'
import type { SingleSpaApp } from '../src/types/descriptor.js'

interface CapturedTopic {
  topic: string
  payload: unknown
}

function makeMockBroker(): {
  captured: CapturedTopic[]
  broker: Broker
} {
  const captured: CapturedTopic[] = []
  const broker = {
    publish: vi.fn((topic: string, payload: unknown) => {
      captured.push({ topic, payload })
    }),
    subscribe: vi.fn(),
  } as unknown as Broker
  return { captured, broker }
}

function makeCtx(mfId = 'mf-ss-tier3'): {
  ctx: LoaderContext
  captured: CapturedTopic[]
} {
  const { captured, broker } = makeMockBroker()
  const descriptor: MicroFrontendDescriptor = {
    id: mfId,
    name: mfId,
    version: '1.0.0',
    loader: { type: 'single-spa' },
  } as MicroFrontendDescriptor
  return { ctx: { broker, descriptor }, captured }
}

function makeRuntimeCtx(ctx: LoaderContext): MicroFrontendRuntimeContext {
  return {
    id: ctx.descriptor.id,
    descriptor: ctx.descriptor,
    broker: ctx.broker,
    publish: vi.fn(),
    subscribe: vi.fn(),
  } as unknown as MicroFrontendRuntimeContext
}

function makeApp(overrides: Partial<SingleSpaApp> = {}): SingleSpaApp {
  return {
    bootstrap: vi.fn(() => Promise.resolve()),
    mount: vi.fn(() => Promise.resolve()),
    unmount: vi.fn(() => Promise.resolve()),
    ...overrides,
  }
}

describe('Tier-3 SS #1: lifecycle mapping bit-exact + topic emission', () => {
  it('bootstrap → mount → unmount chain + topic emit governance triple per phase', async () => {
    const app = makeApp()
    const def = {
      type: 'single-spa' as const,
      module: () => Promise.resolve(app),
      appName: 'navbar-ss',
    }
    const { ctx, captured } = makeCtx('mf-nav-ss')

    const loaded = await singleSpaLoader.load(def, ctx)
    expect(loaded.module).toBe(app)
    expect(typeof loaded.lifecycle.bootstrap).toBe('function')
    expect(typeof loaded.lifecycle.mount).toBe('function')
    expect(typeof loaded.lifecycle.unmount).toBe('function')

    const rctx = makeRuntimeCtx(ctx)
    const container = document.createElement('div')
    container.id = 'ss-mount-target'
    document.body.appendChild(container)
    __setMountContainerForTests(rctx, container)

    // Invoke lifecycle chain
    await loaded.lifecycle.bootstrap!(rctx)
    await loaded.lifecycle.mount!(rctx)
    await loaded.lifecycle.unmount!(rctx)

    // SS app invocations
    expect(app.bootstrap).toHaveBeenCalled()
    expect(app.mount).toHaveBeenCalled()
    expect(app.unmount).toHaveBeenCalled()

    // Topic emission chain (started + completed per ogni phase)
    const topics = captured.map((c) => c.topic)
    expect(topics).toContain('microfrontend.lifecycle.bootstrap.started')
    expect(topics).toContain('microfrontend.lifecycle.bootstrap.completed')
    expect(topics).toContain('microfrontend.lifecycle.mount.started')
    expect(topics).toContain('microfrontend.lifecycle.mount.completed')
    expect(topics).toContain('microfrontend.lifecycle.unmount.started')
    expect(topics).toContain('microfrontend.lifecycle.unmount.completed')

    // Cleanup
    container.remove()
  })

  it('ssProps shape: domElement + name — NO singleSpa NO mountParcel (REQ MF-SS-01)', async () => {
    let capturedProps: Record<string, unknown> | undefined
    const app = makeApp({
      mount: vi.fn((props: Record<string, unknown>) => {
        capturedProps = props
        return Promise.resolve()
      }),
    })
    const def = {
      type: 'single-spa' as const,
      module: () => Promise.resolve(app),
      appName: 'card-ss',
    }
    const { ctx } = makeCtx('mf-card')
    const loaded = await singleSpaLoader.load(def, ctx)

    const rctx = makeRuntimeCtx(ctx)
    const container = document.createElement('section')
    document.body.appendChild(container)
    __setMountContainerForTests(rctx, container)

    await loaded.lifecycle.mount!(rctx)

    expect(capturedProps).toBeDefined()
    expect(capturedProps!['domElement']).toBe(container)
    expect(capturedProps!['name']).toBe('card-ss')
    // NO router replacement — singleSpa API NOT propagated (REQ MF-SS-01)
    expect(capturedProps!['singleSpa']).toBeUndefined()
    // mountParcel deferred V2.1
    expect(capturedProps!['mountParcel']).toBeUndefined()

    container.remove()
  })

  it('lifecycle entry as array (single-spa 5.9+ parallel) — Promise.all happy', async () => {
    const fn1 = vi.fn(() => Promise.resolve())
    const fn2 = vi.fn(() => Promise.resolve())
    const app: SingleSpaApp = {
      bootstrap: [fn1, fn2],
      mount: vi.fn(() => Promise.resolve()),
      unmount: vi.fn(() => Promise.resolve()),
    }
    const def = {
      type: 'single-spa' as const,
      module: app,
    }
    const { ctx } = makeCtx('mf-array-bootstrap')
    const loaded = await singleSpaLoader.load(def, ctx)

    const rctx = makeRuntimeCtx(ctx)
    await loaded.lifecycle.bootstrap!(rctx)

    expect(fn1).toHaveBeenCalled()
    expect(fn2).toHaveBeenCalled()
  })
})
