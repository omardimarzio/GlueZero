// Integration test — Plugin cleanup cascade DETERMINISTIC LIFE-02
// (CORE-11, success criterion #2 ROADMAP Phase 1, chiusura PRD §39 #7).
//
// Verifica end-to-end che `Broker.unregisterPlugin(id)` esegua la cascade
// D-26 in modo deterministico:
//   1. bus.unsubscribeByOwner(id)  — rimuove tutte le subscription tagged
//   2. (F2/F3) routes/transforms — placeholder, non implementati in F1
//   3. abortController.abort()    — fires AbortSignal verso listener
//
// Il test "deterministic LIFE-02" (chiusura PRD §39 #7) confronta
// `getDebugSnapshot()` PRE-registrazione vs POST-unregister: devono essere
// uguali (stesso elenco topic, stesso elenco pluginIds, stesso pendingAsyncDelivery).
//
// Cascade D-26 punto 1 esercitata in pratica: il plugin usa il `pluginCtx.broker`
// (createPluginScopedBroker Proxy) che auto-tagga ogni subscribe con
// ownerId=pluginId. `unsubscribeByOwner` durante unregister rimuove TUTTE
// le subscription create dentro hooks plugin, senza richiedere AbortSignal hookup.
//
// AbortSignal hookup (D-26 punto 4) testato come defense-in-depth: se il plugin
// fa subscribe direttamente sul broker root passando `signal: ctx.signal`,
// AbortController.abort() rimuove comunque la sub.

import { describe, expect, it } from 'vitest'
import { createPipelineHarness } from '../test-utils/pipeline-harness'

// Tipo helper per accedere al subscribe esposto dal scoped broker (PluginContext.broker
// e' tipato come `unknown` in plan 03 — vedi types/plugin.ts).
type ScopedBrokerLike = {
  subscribe: (
    pattern: string,
    handler: (e: unknown) => void,
    options?: { once?: boolean },
  ) => { unsubscribe: () => void }
}

describe('Plugin cleanup cascade — deterministic LIFE-02 (CORE-11, success criterion #2, chiusura PRD §39 #7)', () => {
  it('getDebugSnapshot post-unregister equals pre-registration baseline (D-26 point 1 via scoped broker)', async () => {
    const h = createPipelineHarness()
    const baseline = h.broker.getDebugSnapshot()

    await h.broker.registerPlugin({
      id: 'plugin-with-many-subs',
      onMount: (ctx): void => {
        // Plugin USES ITS scoped broker — subscription auto-tagged con ownerId=pluginId
        // (createPluginScopedBroker propaga ownerId al bus, plan 08).
        // Cascade primario: bus.unsubscribeByOwner('plugin-with-many-subs') durante unregister.
        // NOTE: il pattern `topic.${i}` del PLAN snippet originale falliva la validazione
        // PATTERN_REGEX (segmento numerico non permesso — deve iniziare con [a-z]).
        // Deviation Rule 1: usiamo `topic.t${i}` che e' un pattern valido.
        const scoped = ctx.broker as unknown as ScopedBrokerLike
        for (let i = 0; i < 5; i++) {
          scoped.subscribe(`topic.t${i}`, () => {})
        }
      },
    })

    const middle = h.broker.getDebugSnapshot()
    expect(middle.pluginIds).toContain('plugin-with-many-subs')
    expect(middle.topics.length).toBeGreaterThanOrEqual(5)

    await h.broker.unregisterPlugin('plugin-with-many-subs')

    const after = h.broker.getDebugSnapshot()
    expect(after.pluginIds).toEqual(baseline.pluginIds)
    expect(after.topics).toEqual(baseline.topics) // 5 sub rimossi via unsubscribeByOwner
    expect(after.pendingAsyncDelivery).toBe(baseline.pendingAsyncDelivery)
  })

  it('cascade runs even when onUnmount throws (D-26 must always run, point 1 enforced)', async () => {
    const h = createPipelineHarness()
    await h.broker.registerPlugin({
      id: 'p1',
      onMount: (ctx): void => {
        const scoped = ctx.broker as unknown as ScopedBrokerLike
        scoped.subscribe('a.b', () => {})
      },
      onUnmount: (): void => {
        throw new Error('unmount-fail')
      },
    })
    expect(h.broker.getDebugSnapshot().topics).toContain('a.b')
    // unregister succeeds in completing cascade despite onUnmount throw
    await h.broker.unregisterPlugin('p1')
    expect(h.broker.getDebugSnapshot().topics).not.toContain('a.b')
    expect(h.broker.getDebugSnapshot().pluginIds).toEqual([])
  })

  it('AbortController.signal.aborted is true after unregister (defense-in-depth D-26 point 4)', async () => {
    const h = createPipelineHarness()
    let capturedSignal: AbortSignal | null = null
    await h.broker.registerPlugin({
      id: 'p1',
      onMount: (ctx): void => {
        capturedSignal = ctx.signal
      },
    })
    expect(capturedSignal).not.toBeNull()
    expect(capturedSignal?.aborted).toBe(false)
    await h.broker.unregisterPlugin('p1')
    expect(capturedSignal?.aborted).toBe(true)
  })

  it('AbortSignal hookup ALSO works as defense-in-depth (subscription with explicit signal: ctx.signal)', async () => {
    // Verifica che anche se il plugin fa subscribe direttamente sul broker root (non scoped)
    // passando explicit signal, l'unregister rimuova comunque la sub via D-26 point 4
    // (AbortController.abort()).
    const h = createPipelineHarness()
    await h.broker.registerPlugin({
      id: 'p-mixed',
      onMount: (ctx): void => {
        // Defensive path: explicit signal hookup, indipendente dal scoped broker
        h.broker.subscribe('defensive.topic', () => {}, { signal: ctx.signal })
      },
    })
    expect(h.broker.getDebugSnapshot().topics).toContain('defensive.topic')
    await h.broker.unregisterPlugin('p-mixed')
    expect(h.broker.getDebugSnapshot().topics).not.toContain('defensive.topic')
  })

  it('multiple plugins: unregister one does NOT affect others (scoped broker isolation)', async () => {
    const h = createPipelineHarness()
    await h.broker.registerPlugin({
      id: 'p1',
      onMount: (ctx): void => {
        const scoped = ctx.broker as unknown as ScopedBrokerLike
        scoped.subscribe('p1.topic', () => {})
      },
    })
    await h.broker.registerPlugin({
      id: 'p2',
      onMount: (ctx): void => {
        const scoped = ctx.broker as unknown as ScopedBrokerLike
        scoped.subscribe('p2.topic', () => {})
      },
    })
    await h.broker.unregisterPlugin('p1')
    const snap = h.broker.getDebugSnapshot()
    expect(snap.pluginIds).toEqual(['p2'])
    expect(snap.topics).toContain('p2.topic')
    expect(snap.topics).not.toContain('p1.topic')
  })
})
