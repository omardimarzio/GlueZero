/**
 * F14 Tier-3 Playwright shared fixture — setup broker reale + microfrontendModule +
 * fallbacksModule + helper register MF / simulate failure via topic emit.
 *
 * Pattern Rule 1 carryover F13 `__browser__/` setup analog (W3 P05 closure).
 *
 * **Strategia testing**: i test Tier-3 NON simulano loader rejection reale via
 * `mfService.load()` perché ciò richiede infrastructure mock pesante (esm
 * loaders, fetch interceptor). Invece i test:
 *
 *  1. Registrano un MF via `mfService.register({...descriptor, fallback: ...})`
 *     con il `fallback` policy desiderato.
 *  2. Triggerano emit diretto `microfrontend.<phase>.failed` topic via
 *     `broker.publish(...)` (simula F8 publishErrorEvent path).
 *  3. Verificano che l'orchestrator chain D-V2-F14-12 applichi:
 *     - Circuit check
 *     - Retry scheduling
 *     - Fallback render dispatch
 *     - Emit `microfrontend.fallback.rendered` con `fallbackType` corretto.
 *
 * Questo approccio è **end-to-end real** per il dominio F14 (subscribe +
 * orchestrator + renderer + emit) — la parte "lifecycle FSM trigger" di F8
 * è già coperta dai test F8 stessi.
 *
 * @see D-V2-F14-15 — Tier-3 6 scenari LoC stima
 * @see D-V2-F14-12 — Orchestrator chain order
 * @see packages/isolation/__browser__/ — F13 carryover template pattern
 */
import { createBroker } from '@gluezero/core'
import { microfrontendModule } from '@gluezero/microfrontends'
import { fallbacksModule, type FallbacksModuleOptions } from '../src/fallbacks-module.js'

/**
 * Payload-shape descriptor MF accettato da `registerMf`. Tutti i campi descrittivi
 * sono opzionali tranne `id`. Il campo `fallback` è il key di interesse F14.
 */
export interface MfDescriptorInput {
  readonly id: string
  readonly name?: string
  readonly version?: string
  readonly mount?: { readonly selector?: string; readonly strategy?: string }
  readonly fallback?: unknown
  readonly [key: string]: unknown
}

/**
 * API esposta dal fixture per i 6 scenari Tier-3.
 */
export interface TestFixture {
  /** Broker reale costruito con `microfrontendModule()` + `fallbacksModule(options)`. */
  readonly broker: ReturnType<typeof createBroker>
  /** Registra MF via `MicroFrontendsService.register()` (validato Valibot register-time). */
  readonly registerMf: (descriptor: MfDescriptorInput) => Promise<void>
  /** Triggera emit `microfrontend.<phase>.failed` topic — simulate F8 lifecycle FSM error path. */
  readonly triggerFail: (mfId: string, phase: string, errorMsg?: string, recoverable?: boolean) => void
  /**
   * Attende che `topic` sia osservato (opzionalmente con `predicate`) entro 1s timeout.
   * Risolve col primo payload matching, rejette dopo timeout.
   */
  readonly topicSeen: (topic: string, predicate?: (payload: unknown) => boolean) => Promise<unknown>
  /** Cleanup DOM + dispose subscriptions. */
  readonly cleanup: () => void
  /** Diretto accesso a `getCircuitState`/`getRetryAttempts` via SERVICE_FALLBACKS lookup. */
  readonly getFallbacksService: () => {
    readonly getCircuitState: (id: string) => string
    readonly getRetryAttempts: (id: string, phase: string) => number
  }
}

/**
 * Setup fixture F14 Tier-3 — entry-point shared per ogni `scenario-*-*.spec.ts`.
 *
 * @param options Setup options forwarded a `fallbacksModule({})`.
 * @param containerSelector Selector del container DOM root (default `#root`).
 *
 * @returns Fixture con broker reale + helper `registerMf`/`triggerFail`/`topicSeen`/`cleanup`.
 */
export async function setupF14Fixture(
  options: FallbacksModuleOptions = {},
  containerSelector = '#root',
): Promise<TestFixture> {
  // Reset DOM root
  const containerId = containerSelector.startsWith('#')
    ? containerSelector.slice(1)
    : containerSelector
  document.body.innerHTML = `<div id="${containerId}"></div>`

  const broker = createBroker({
    modules: [microfrontendModule(), fallbacksModule(options)],
  })

  // Capture events on key F14 topics + open custom topics for scenario 3
  const captured = new Map<string, unknown[]>()
  const ALL_TOPICS = [
    'microfrontend.fallback.rendered',
    'microfrontend.fallback.event',
    'microfrontend.recovered',
    'microfrontend.circuit.opened',
    'microfrontend.circuit.closed',
  ]
  const subs = ALL_TOPICS.map((t) =>
    broker.subscribe(t, (event: { topic: string; payload: unknown }) => {
      const list = captured.get(t) ?? []
      list.push(event.payload)
      captured.set(t, list)
    }),
  )

  const mfService = broker.getService<{
    register(descriptor: unknown): Promise<void>
  }>('microfrontends')
  if (mfService === undefined) {
    throw new Error('[Tier-3 setup] microfrontends service not registered (microfrontendModule missing?)')
  }

  async function registerMf(descriptor: MfDescriptorInput): Promise<void> {
    const fullDescriptor = {
      name: descriptor.name ?? descriptor.id,
      version: descriptor.version ?? '1.0.0',
      ...descriptor,
    }
    await mfService.register(fullDescriptor)
  }

  function triggerFail(
    mfId: string,
    phase: string,
    errorMsg = 'simulated failure',
    recoverable = true,
  ): void {
    broker.publish(
      `microfrontend.${phase}.failed`,
      {
        id: mfId,
        phase,
        error: { message: errorMsg },
        recoverable,
        timestamp: Date.now(),
      },
      {
        source: { type: 'plugin' as const, id: 'tier3-test', name: 'tier3-test' },
        deliveryMode: 'sync' as const,
      },
    )
  }

  async function topicSeen(
    topic: string,
    predicate?: (payload: unknown) => boolean,
  ): Promise<unknown> {
    const start = Date.now()
    while (Date.now() - start < 1500) {
      const list = captured.get(topic) ?? []
      const match = predicate !== undefined ? list.find(predicate) : list[0]
      if (match !== undefined) return match
      await new Promise((r) => setTimeout(r, 20))
    }
    const seen = captured.get(topic) ?? []
    throw new Error(
      `Topic "${topic}" not observed within 1.5s (captured ${seen.length} events on this topic)`,
    )
  }

  function getFallbacksService(): {
    readonly getCircuitState: (id: string) => string
    readonly getRetryAttempts: (id: string, phase: string) => number
  } {
    const svc = broker.getService<{
      readonly getCircuitState: (id: string) => string
      readonly getRetryAttempts: (id: string, phase: string) => number
    }>('fallbacks')
    if (svc === undefined) {
      throw new Error('[Tier-3 setup] fallbacks service not registered')
    }
    return svc
  }

  return {
    broker,
    registerMf,
    triggerFail,
    topicSeen,
    getFallbacksService,
    cleanup: () => {
      for (const s of subs) s.unsubscribe()
      document.body.innerHTML = ''
    },
  }
}
