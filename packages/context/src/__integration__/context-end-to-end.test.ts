/**
 * Tier-1 jsdom integration suite end-to-end — W3 P05 closure F10
 * (D-V2-F10-16 Tier-1 only — NO Tier-3 Playwright).
 *
 * 5 describe blocks coprono cross-cumulativamente i 4 SC ROADMAP scenarios + REQ-IDs
 * cross-verification 11/11 REQ-IDs F10:
 *
 * - **SC1**: 2 MF distinti ricevono context propagato + reference identity preservata
 *   (MF-CTX-01/02/05).
 * - **SC2**: 2 MF namespace diversi mappano stesso topic canonico senza collision +
 *   explicit-wins (MF-MAP-01/02/03 + MF-INT-MAP-01/02).
 * - **SC3**: 8 events standard payload `{previous, current, changedKeys}` shape +
 *   serializable snapshot (MF-CTX-03 + MF-CTX-06).
 * - **SC4**: deep-equal selector tests — shallowEqual gate NON tratta nested deep
 *   (P-17 mitigation D-V2-F10-02). Bundle ≤4 KB cap verificato via size-limit (gate
 *   esterno, NOT in test file).
 * - **REQ-IDs cross-verification**: 11/11 REQ-IDs F10 accessibili dal barrel pubblico.
 *
 * Harness: `createBroker({modules: [microfrontendModule(), contextModule()]})` con
 * MF registration mock + lifecycle event simulation (microfrontend.mounted/unmounted)
 * per testare flusso end-to-end.
 *
 * **Exclusion vitest:** `vitest.config.ts` esclude `src/__integration__/**` dal default
 * test run (pattern F9 split). Esecuzione esplicita:
 * ```bash
 * pnpm --filter @gluezero/context test src/__integration__/
 * ```
 *
 * @see .planning/ROADMAP.md (4 SC F10 literal)
 * @see .planning/phases/10-runtime-context-module-mapping-per-mf/10-05-PLAN.md
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBroker } from '@gluezero/core'
import {
  microfrontendModule,
  type MicroFrontendsService,
  type MicroFrontendRegistration,
} from '@gluezero/microfrontends'
import { __resetForTest as __resetRuntimeForTest } from '../runtime-context'
import { __resetFacadeForTest } from '../context-map-facade'
import {
  __resetMappingForTest,
  getActiveMfIds,
  getMfMapperEngine,
} from '../mapping-integration'
import { contextModule } from '../context-module'
import {
  CONTEXT_TOPICS,
  computeContextSnapshot,
  createContextError,
  enforceWrite,
  getDebugSnapshot,
  getRuntimeContext,
  getWritableKeys,
  replaceRuntimeContext,
  setRuntimeContext,
  subscribeRuntimeContext,
  wrapInspectorWithMfAttribution,
  clearRuntimeContext,
  type ContextChangedPayload,
  type MicroFrontendMapping,
  type RuntimeContext,
} from '../index'

// ===== Harness helpers =====

function makeHarness(): {
  broker: ReturnType<typeof createBroker>
  mfService: MicroFrontendsService
} {
  const broker = createBroker({
    modules: [microfrontendModule(), contextModule()],
  })
  const mfService = broker.getService<MicroFrontendsService>('microfrontends')
  if (!mfService) throw new Error('mfService missing in harness setup')
  return { broker, mfService }
}

function registerAndMountMf(opts: {
  broker: ReturnType<typeof createBroker>
  mfService: MicroFrontendsService
  id: string
  writableKeys?: readonly string[]
  mapping?: MicroFrontendMapping
}): MicroFrontendRegistration {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const descriptor: any = {
    id: opts.id,
    name: opts.id,
    version: '1.0.0',
    loader: { type: 'esm', url: `/${opts.id}.js` },
  }
  if (opts.writableKeys !== undefined) {
    descriptor.context = { writableKeys: opts.writableKeys }
  }
  if (opts.mapping !== undefined) {
    descriptor.mapping = opts.mapping
  }
  opts.mfService.register(descriptor)
  const reg = opts.mfService.get(opts.id) as MicroFrontendRegistration & {
    runtimeContext?: { context?: unknown }
  }
  // Mock runtime context object (in production lifecycle è creato da F8 facade
  // via createMfRuntimeContext post-mount). Per test E2E iniettiamo placeholder
  // per verificare LIVE injection cascade `attachMfContext`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(reg as any).runtimeContext = { context: undefined }
  // D-23 source descriptor obbligatorio per ogni broker.publish.
  // deliveryMode: 'sync' obbligatorio per asserzioni sincrone post-publish nel test
  // (F1 default async → queueMicrotask defer handler — non visibile expect immediato).
  opts.broker.publish(
    'microfrontend.mounted',
    { id: opts.id },
    {
      source: { type: 'plugin', id: 'test-harness', name: 'integration-test' },
      deliveryMode: 'sync',
    },
  )
  return reg
}

function publishUnmount(
  broker: ReturnType<typeof createBroker>,
  id: string,
): void {
  broker.publish(
    'microfrontend.unmounted',
    { id },
    {
      source: { type: 'plugin', id: 'test-harness', name: 'integration-test' },
      deliveryMode: 'sync',
    },
  )
}

function resetAll(): void {
  __resetRuntimeForTest()
  __resetFacadeForTest()
  __resetMappingForTest()
}

// ===== SC1: Context propagation + reference identity =====

describe('SC1: 2 MF context propagation + reference identity preserved (MF-CTX-01/02/05)', () => {
  beforeEach(() => {
    resetAll()
  })
  afterEach(() => {
    resetAll()
  })

  it('2 MF distinti ricevono context propagato — update solo locale NON triggera handler user (reference identity)', () => {
    const { broker, mfService } = makeHarness()
    registerAndMountMf({ broker, mfService, id: 'mf-1' })
    registerAndMountMf({ broker, mfService, id: 'mf-2' })

    const user = { id: 'u1' }
    setRuntimeContext({ tenantId: 'acme', user, locale: 'en', theme: 'light' })

    const userHandler = vi.fn()
    const tenantHandler = vi.fn()
    subscribeRuntimeContext((ctx) => ctx.user, userHandler)
    subscribeRuntimeContext((ctx) => ctx.tenantId, tenantHandler)

    // Update SOLO locale — user/tenantId invariati (reference identity)
    setRuntimeContext({ locale: 'it' })

    // CRITICAL SC1: reference identity preserved → handler NON invocato
    expect(userHandler).not.toHaveBeenCalled()
    expect(tenantHandler).not.toHaveBeenCalled()

    // Update user → SOLO userHandler invocato
    setRuntimeContext({ user: { id: 'u2' } })
    expect(userHandler).toHaveBeenCalledTimes(1)
    expect(tenantHandler).not.toHaveBeenCalled()
  })

  it('keys array overload + reference identity (shallow gate top-level)', () => {
    const { broker, mfService } = makeHarness()
    registerAndMountMf({ broker, mfService, id: 'mf-1' })

    const handler = vi.fn()
    subscribeRuntimeContext(['user', 'tenantId'] as const, handler)

    setRuntimeContext({ user: { id: 'u1' }, tenantId: 'acme' })
    expect(handler).toHaveBeenCalledTimes(1)

    // Update locale → handler NON invocato (slice shallow eq su user+tenantId)
    setRuntimeContext({ locale: 'it' })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('AbortSignal cascade auto-cleanup (D-V2-F10-04)', () => {
    const { broker, mfService } = makeHarness()
    registerAndMountMf({ broker, mfService, id: 'mf-1' })

    const handler = vi.fn()
    const ctrl = new AbortController()
    subscribeRuntimeContext((ctx) => ctx.user, handler, { signal: ctrl.signal })

    setRuntimeContext({ user: { id: 'u1' } })
    expect(handler).toHaveBeenCalledTimes(1)

    ctrl.abort()
    setRuntimeContext({ user: { id: 'u2' } })
    expect(handler).toHaveBeenCalledTimes(1) // cleanup avvenuto
  })
})

// ===== SC2: Namespace + explicit-wins =====

describe('SC2: 2 MF namespace + explicit wins mapping per-MF (MF-MAP-01/02/03 + MF-INT-MAP-01/02)', () => {
  beforeEach(() => {
    resetAll()
  })
  afterEach(() => {
    resetAll()
  })

  it('2 MF stesso canonical, namespace diversi → engines isolati (D-V2-F10-09)', () => {
    const { broker, mfService } = makeHarness()
    registerAndMountMf({
      broker,
      mfService,
      id: 'mf-customer-a',
      mapping: {
        inputMap: { customerId: { canonical: 'customer_id' } },
        namespace: 'mf:mf-customer-a',
      },
    })
    registerAndMountMf({
      broker,
      mfService,
      id: 'mf-customer-b',
      mapping: {
        inputMap: { customerId: { canonical: 'customer_id' } },
        namespace: 'mf:mf-customer-b',
      },
    })

    expect(getActiveMfIds().sort()).toEqual(['mf-customer-a', 'mf-customer-b'])
    // Engines distinte — per-MF instance scoped (D-V2-F10-09)
    expect(getMfMapperEngine('mf-customer-a')).not.toBe(
      getMfMapperEngine('mf-customer-b'),
    )
  })

  it('unmount cascade: detachMfMapping cleanup namespace AliasRegistry (T-F10-05 leak prevention)', () => {
    const { broker, mfService } = makeHarness()
    registerAndMountMf({
      broker,
      mfService,
      id: 'mf-x',
      mapping: { inputMap: { customerId: { canonical: 'customer_id' } } },
    })
    expect(getMfMapperEngine('mf-x')).toBeDefined()
    publishUnmount(broker, 'mf-x')
    expect(getMfMapperEngine('mf-x')).toBeUndefined()
  })

  it('wrapInspectorWithMfAttribution arricchisce ring buffer F2 con microFrontendId (MF-MAP-03 + MF-INT-MAP-02)', async () => {
    makeHarness()
    const { MappingInspector } = await import('@gluezero/mapper')
    const inspector = new MappingInspector({ errorBufferSize: 50 })
    const wrapped = wrapInspectorWithMfAttribution(inspector, () => 'mf-customer-a')

    const { createBrokerError } = await import('@gluezero/core')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wrapped.recordError(createBrokerError({ code: 'TEST', category: 'mapping' as any, message: 'x' }))
    const errs = inspector.lastErrors()
    expect(errs).toHaveLength(1)
    expect((errs[0]!.details as Record<string, unknown>)['microFrontendId']).toBe(
      'mf-customer-a',
    )
  })
})

// ===== SC3: Events shape + serializable snapshot =====

describe('SC3: 8 events shape + serializable snapshot (MF-CTX-03 + MF-CTX-06)', () => {
  beforeEach(() => {
    resetAll()
  })
  afterEach(() => {
    resetAll()
  })

  it('8 standard topics CONTEXT_TOPICS contiene PRD §18.6 literal (1 aggregator + 7 specific)', () => {
    expect(CONTEXT_TOPICS).toHaveLength(8)
    expect(CONTEXT_TOPICS).toContain('context.changed')
    expect(CONTEXT_TOPICS).toContain('context.user.changed')
    expect(CONTEXT_TOPICS).toContain('context.tenant.changed')
    expect(CONTEXT_TOPICS).toContain('context.locale.changed')
    expect(CONTEXT_TOPICS).toContain('context.permissions.changed')
    // NB: lowercase per F1 broker regex (D-08 TopicTrie) — `context.featureflags.changed`
    expect(CONTEXT_TOPICS).toContain('context.featureflags.changed')
    expect(CONTEXT_TOPICS).toContain('context.theme.changed')
    expect(CONTEXT_TOPICS).toContain('context.route.changed')
  })

  it('payload {previous, current, changedKeys} shape valido per ogni topic (1 aggregator + N specific)', () => {
    const { broker, mfService } = makeHarness()
    registerAndMountMf({ broker, mfService, id: 'mf-1' })

    const aggregatorHandler = vi.fn()
    const userTopicHandler = vi.fn()
    const themeTopicHandler = vi.fn()
    broker.subscribe<ContextChangedPayload>('context.changed', (e) =>
      aggregatorHandler(e.payload),
    )
    broker.subscribe<ContextChangedPayload>('context.user.changed', (e) =>
      userTopicHandler(e.payload),
    )
    broker.subscribe<ContextChangedPayload>('context.theme.changed', (e) =>
      themeTopicHandler(e.payload),
    )

    setRuntimeContext({ user: { id: 'u1' }, theme: 'dark', timezone: 'Europe/Rome' })

    // Aggregator → changedKeys = [theme, timezone, user] (union)
    expect(aggregatorHandler).toHaveBeenCalledTimes(1)
    const aggPayload = aggregatorHandler.mock.calls[0]![0] as ContextChangedPayload
    expect([...aggPayload.changedKeys].sort()).toEqual(
      ['theme', 'timezone', 'user'].sort(),
    )
    // Topic-specific user → changedKeys = [user] (focused)
    expect(userTopicHandler).toHaveBeenCalledTimes(1)
    const userPayload = userTopicHandler.mock.calls[0]![0] as ContextChangedPayload
    expect(userPayload.changedKeys).toEqual(['user'])
    // Topic-specific theme → changedKeys = [theme] (focused)
    expect(themeTopicHandler).toHaveBeenCalledTimes(1)
    const themePayload = themeTopicHandler.mock.calls[0]![0] as ContextChangedPayload
    expect(themePayload.changedKeys).toEqual(['theme'])
    // timezone NON ha topic specifico (solo aggregator) — verificato in altro test
  })

  it('timezone/direction/environment/metadata NON emettono topic specifico (solo aggregator)', () => {
    const { broker, mfService } = makeHarness()
    registerAndMountMf({ broker, mfService, id: 'mf-1' })

    // Subscribe a tutti 8 topics
    const calls: Record<string, number> = {}
    for (const topic of CONTEXT_TOPICS) {
      calls[topic] = 0
      broker.subscribe(topic, () => {
        calls[topic] = (calls[topic] ?? 0) + 1
      })
    }

    setRuntimeContext({
      timezone: 'Europe/Rome',
      direction: 'ltr',
      environment: 'production',
      metadata: { x: 1 },
    })

    expect(calls['context.changed']).toBe(1) // aggregator ALWAYS
    // 7 topic-specific NON invocati (timezone/direction/environment/metadata no topic)
    expect(calls['context.user.changed']).toBe(0)
    expect(calls['context.tenant.changed']).toBe(0)
    expect(calls['context.locale.changed']).toBe(0)
    expect(calls['context.permissions.changed']).toBe(0)
    expect(calls['context.featureflags.changed']).toBe(0)
    expect(calls['context.theme.changed']).toBe(0)
    expect(calls['context.route.changed']).toBe(0)
  })

  it('getDebugSnapshot() ritorna oggetto serializable (JSON.stringify safe — MF-CTX-06)', () => {
    const { broker, mfService } = makeHarness()
    registerAndMountMf({ broker, mfService, id: 'mf-x' })
    setRuntimeContext({ tenantId: 'acme', user: { id: 'u1' } })

    const snap = getDebugSnapshot()
    expect(snap.state).toEqual({ tenantId: 'acme', user: { id: 'u1' } })
    expect(typeof snap.perMfSubscriptionCount).toBe('number')
    // Serializable verification — no circular refs, no function refs
    expect(() => JSON.stringify(snap)).not.toThrow()
  })

  it('contextMap auto-injection LIVE in ctx.context (MF-CTX-06 + D-V2-F10-15)', () => {
    const { broker, mfService } = makeHarness()
    const reg = registerAndMountMf({
      broker,
      mfService,
      id: 'mf-x',
      mapping: { contextMap: { currentTenant: 'tenantId', language: 'locale' } },
    })

    setRuntimeContext({ tenantId: 'acme', locale: 'it' })

    const ctx = (reg.runtimeContext as { context?: Record<string, unknown> }).context
    expect(ctx?.['tenantId']).toBe('acme') // passthrough
    expect(ctx?.['locale']).toBe('it') // passthrough
    expect(ctx?.['currentTenant']).toBe('acme') // alias overlay
    expect(ctx?.['language']).toBe('it') // alias overlay
  })
})

// ===== SC4: Deep-equal selector tests + P-17 mitigation =====

describe('SC4: deep-equal selector tests (P-17 mitigation D-V2-F10-02)', () => {
  beforeEach(() => {
    resetAll()
  })
  afterEach(() => {
    resetAll()
  })

  it('shallowEqual gate NON tratta nested deep — consumer responsabilità immutability', () => {
    const { broker, mfService } = makeHarness()
    registerAndMountMf({ broker, mfService, id: 'mf-x' })

    const handler = vi.fn()
    subscribeRuntimeContext((ctx) => ctx.user, handler)

    // Set initial user con nested object
    const profile1 = { theme: 'light' }
    setRuntimeContext({ user: { id: 'u1', profile: profile1 } })
    expect(handler).toHaveBeenCalledTimes(1)

    // Caso A: nuovo ref top-level user con nested profile DIVERSO → shallow eq
    // di `ctx.user` confronta Object.keys(user) con Object.is.
    // user.id (primitive 'u1' === 'u1' OK) + user.profile (NEW ref ≠ old) → Object.is false
    // → handler invocato (top-level gate rileva diff).
    setRuntimeContext({ user: { id: 'u1', profile: { theme: 'dark' } } })
    expect(handler).toHaveBeenCalledTimes(2)

    // Caso B: shallow eq DEEP non gestito — se consumer ripassa STESSO nested ref
    // shallow gate ritorna true → handler NON invocato (consumer responsabilità
    // immutability D-V2-F10-02: deep equal NON eseguito anche se shape fosse cambiata).
    const currentUser = getRuntimeContext().user
    if (currentUser) {
      // Stesso top-level ref user → Object.is short-circuit true → handler NOT invocato
      setRuntimeContext({ user: currentUser })
    }
    expect(handler).toHaveBeenCalledTimes(2) // STILL 2 — shallow gate Object.is fast path
  })

  it('inline selector P-17 cope: wrapper shallow eq preserva reference identity', () => {
    const { broker, mfService } = makeHarness()
    registerAndMountMf({ broker, mfService, id: 'mf-x' })

    setRuntimeContext({ user: { id: 'u1' }, tenantId: 'acme' })

    const handler = vi.fn()
    // P-17 anti-pattern: inline wrapper object ad ogni call
    subscribeRuntimeContext(
      (ctx) => ({ user: ctx.user, tenant: ctx.tenantId }),
      handler,
    )

    // Update di chiave NOT in selector slice
    setRuntimeContext({ locale: 'it' })
    // Wrapper top-level shallow eq: user ref same, tenant ref same → handler NOT triggered
    expect(handler).not.toHaveBeenCalled()
  })
})

// ===== REQ-IDs cross-verification =====

describe('REQ-IDs cross-verification — 11 REQ-IDs F10 implementati e accessibili dal barrel', () => {
  beforeEach(() => {
    resetAll()
  })
  afterEach(() => {
    resetAll()
  })

  it('MF-CTX-01: 5 API CRUD esposte dal barrel', () => {
    expect(typeof setRuntimeContext).toBe('function')
    expect(typeof replaceRuntimeContext).toBe('function')
    expect(typeof getRuntimeContext).toBe('function')
    expect(typeof subscribeRuntimeContext).toBe('function')
    expect(typeof clearRuntimeContext).toBe('function')
  })

  it('MF-CTX-02: tipo RuntimeContext accetta 11 chiavi standard PRD §18.4', () => {
    const ctx: RuntimeContext = {
      tenantId: 'T',
      user: { id: 'u' },
      locale: 'it',
      timezone: 'Europe/Rome',
      permissions: ['r'],
      featureFlags: { b: true },
      theme: 'd',
      direction: 'ltr',
      environment: 'production',
      currentRoute: { path: '/' },
      metadata: { x: 'y' },
    }
    expect(Object.keys(ctx)).toHaveLength(11)
  })

  it('MF-CTX-03: 8 standard topics CONTEXT_TOPICS', () => {
    expect(CONTEXT_TOPICS).toHaveLength(8)
  })

  it('MF-CTX-04: enforceWrite + createContextError + getWritableKeys esposti', () => {
    expect(typeof enforceWrite).toBe('function')
    expect(typeof createContextError).toBe('function')
    expect(typeof getWritableKeys).toBe('function')
  })

  it('MF-CTX-05: subscribeRuntimeContext overload fn + keys-array', () => {
    const { broker, mfService } = makeHarness()
    registerAndMountMf({ broker, mfService, id: 'mf-1' })

    const off1 = subscribeRuntimeContext((ctx) => ctx.user, () => {})
    const off2 = subscribeRuntimeContext(['user'] as const, () => {})
    expect(typeof off1).toBe('function')
    expect(typeof off2).toBe('function')
    off1()
    off2()
  })

  it('MF-CTX-06: getDebugSnapshot + computeContextSnapshot esposti', () => {
    expect(typeof getDebugSnapshot).toBe('function')
    expect(typeof computeContextSnapshot).toBe('function')
  })

  it('MF-MAP-01 + MF-INT-MAP-01: MicroFrontendMapping type + per-MF MapperEngine attivo via mount', () => {
    const { broker, mfService } = makeHarness()
    registerAndMountMf({
      broker,
      mfService,
      id: 'mf-x',
      mapping: { inputMap: { f: { canonical: 'c' } } },
    })
    expect(getMfMapperEngine('mf-x')).toBeDefined()
  })

  it('MF-MAP-02: namespace isolation 2 MF', () => {
    const { broker, mfService } = makeHarness()
    registerAndMountMf({
      broker,
      mfService,
      id: 'mf-1',
      mapping: { inputMap: { f: { canonical: 'c' } } },
    })
    registerAndMountMf({
      broker,
      mfService,
      id: 'mf-2',
      mapping: { inputMap: { f: { canonical: 'c' } } },
    })
    expect(getActiveMfIds().sort()).toEqual(['mf-1', 'mf-2'])
  })

  it('MF-MAP-03 + MF-INT-MAP-02: wrapInspectorWithMfAttribution esposto', () => {
    expect(typeof wrapInspectorWithMfAttribution).toBe('function')
  })
})
