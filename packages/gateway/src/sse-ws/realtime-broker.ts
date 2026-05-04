// realtime-broker.ts — `RealtimeBroker` composition wrapper di `RouterBroker` (F3 plan
// 03-12) — D-101 / D-83 strict (NESSUNA modifica a F1/F2/F3 runtime).
//
// Pattern composition identico a `RouterBroker` (router-broker-wrapper.ts:105-226):
//   - inner: `RouterBroker` (F3) — delegato per pub/sub/lifecycle base + routing + http gateway
//   - manager: `RealtimeChannelManager` (plan 04-07) — N canali SSE/WS indicizzati per name
//   - publish/subscribe → delegate a inner (composition pattern, NO modify)
//   - registerPlugin/unregisterPlugin → override per cascade auto-register channels (D-103)
//     + cascade cleanup (D-112)
//   - connectRealtime/disconnectRealtime → API surface F4 pubblica (PRD §16.2)
//
// Vincolo D-83 strict (carryover F3 → F4): ZERO modifiche a `packages/core/`,
// `packages/mapper/`, `packages/routing/`, `packages/gateway/src/http/` runtime. F4 vive
// SOLO in `packages/gateway/src/sse-ws/` + `packages/gateway/src/sse-ws/augment.ts`
// (declaration merging dei tipi).
//
// W-1 fix iter 2 — source preservation end-to-end:
//   il `publishFn` legato dal manager all'`inner.publish` chiama
//   `inner.publish(event.topic, event.payload, { source: event.source, id: event.id })`.
//   Verificato vivo: `RouterBroker.publish` accetta `options.source` e `options.id` come
//   parte di `MapperPublishOptions = Parameters<Broker['publish']>[2]` (vedi
//   `packages/core/src/core/broker.ts:155-163` + `event-factory.ts:44`). I subscriber
//   ricevono `BrokerEvent.source` invariato (createBrokerEvent F1 usa `params.source`
//   se fornito; il source frozen `SSE_SOURCE = { type: 'server', id: 'realtime-channel',
//   name: 'sse' }` di plan 04-05 viaggia immutato).
//
// W-5 fix iter 2 — niente silent catch su channel-register failure:
//   `registerPlugin` override emette `system.warn` con `reason: 'realtime-channel-register-failed'`
//   se `manager.connect` throw (es. realtime.channel.duplicate). Il plugin viene COMUNQUE
//   registrato (graceful degrade, pattern F3). Consumer può subscribe a `system.warn` per
//   audit/alert.
//
// Threat coverage:
// - T-04-08-02 (Tampering — RealtimeBroker modifica RouterBroker internals): mitigate.
//   `inner` è private + accesso via metodi pubblici only. D-101 strict.
// - T-04-08-04 (Memory leak — unregisterPlugin parziale): mitigate. Try/catch isolato
//   per ogni step (pattern F3 router-broker-wrapper.ts:463-485).
// - T-04-08-09 (Logic flaw — source.type='server' lost via publish API): mitigate
//   (verification-gated). Verifica vivo `Broker.publish(topic, payload, options)`
//   accetta `source` e `id` — confermato.

import type { PluginDescriptor, Subscription } from '@sembridge/core'
import { RouterBroker, type RouterBrokerConfig } from '@sembridge/routing'
import { RealtimeChannelManager, type RealtimeChannelManagerDeps } from './realtime-channel-manager'
import type { RealtimeChannelDef } from './types/realtime-channel-def'
import type { RealtimeConfig } from './types/realtime-config'

/**
 * Configurazione `RealtimeBroker` — accetta tutto il `RouterBrokerConfig` di F3 + sezione F4.
 *
 * Pattern declaration merging: `realtime?: RealtimeConfig` aggiunto via
 * `sse-ws/augment.ts` (plan 04-01 D-103). Per chiarezza export-side ridichiariamo il
 * super-set come interface esplicita — coerente con `RouterBrokerConfig` di F3.
 */
export interface RealtimeBrokerConfig extends RouterBrokerConfig {
  /** Configurazione canali realtime SSE/WS (D-102). */
  readonly realtime?: RealtimeConfig
}

/** Type del terzo argomento di `RouterBroker.publish` — riusato per propagare options.source/id. */
type RouterPublishOptions = Parameters<RouterBroker['publish']>[2]

/**
 * `RealtimeBroker` — composition wrapper di `RouterBroker` per F4 SSE/WS (D-101).
 *
 * @example
 * ```ts
 * import { createRealtimeBroker } from '@sembridge/gateway/sse-ws'
 *
 * const broker = createRealtimeBroker({
 *   realtime: {
 *     channels: [
 *       { name: 'orders', mode: 'auto', buildUrl: async () => `/events?token=${await getToken()}` },
 *     ],
 *   },
 * })
 * await broker.connectRealtime({ name: 'notifications', mode: 'sse', url: '/notifications' })
 * broker.subscribe('orders.created', (ev) => { ... })
 * ```
 */
export class RealtimeBroker {
  private readonly inner: RouterBroker
  private readonly manager: RealtimeChannelManager

  constructor(config: RealtimeBrokerConfig = {}) {
    // 1. Compose RouterBroker (F3) — pattern identico RouterBroker → MapperBroker
    //    (D-83 chain F1→F2→F3→F4).
    this.inner = new RouterBroker(config)

    // 2. Build Manager con publishFn legato all'inner (pipeline §28 step 1 ingress D-113).
    //    Il publishFn riceve un `BrokerEvent` completo costruito dall'adapter; lo
    //    trasformiamo in chiamata a `inner.publish(topic, payload, options)` preservando
    //    `source` e `id` (W-1 closure).
    const managerDeps: RealtimeChannelManagerDeps = {
      publishFn: (event) => {
        // W-1 fix — source preservato end-to-end. `Broker.publish` (F1, vedi
        // packages/core/src/core/broker.ts:155-163) accetta `options.source` e
        // `options.id` come parte di `Omit<PublishParams<T>, 'topic'|'payload'>`.
        // `RouterBroker.publish` propaga `options` invariato a `MapperBroker.publish`
        // (router-broker-wrapper.ts:277-283) che li passa a `Broker.publish`
        // (broker-mapper-wrapper.ts:442) che li passa a `createBrokerEvent`
        // (event-factory.ts:48-67). Il source SSE_SOURCE/WS_SOURCE pubblicato
        // dall'adapter viaggia invariato fino al subscriber finale.
        this.inner.publish(
          event.topic,
          event.payload as never,
          {
            source: event.source,
            id: event.id,
          } as RouterPublishOptions,
        )
      },
    }

    this.manager = new RealtimeChannelManager(managerDeps)

    // 3. Bootstrap channels da config (D-102, analogo `routes` di F3 plan 03-12).
    if (config.realtime?.channels) {
      for (const def of config.realtime.channels) {
        // Fire-and-forget connect — pattern Promise.catch difensivo come
        // router-broker-wrapper.ts:316-320. L'errore è già pubblicato come
        // `system.realtime.disconnected` dall'adapter/manager se configurazione invalida.
        this.manager.connect(def, 'system').catch(() => {
          // No-op: errore già pubblicato — niente unhandledrejection.
        })
      }
    }
  }

  // ============================================================================
  // Realtime API (D-102, PRD §16.2)
  // ============================================================================

  /**
   * Connetti un canale realtime (D-102). Se `def.name` già registrato → throw
   * `realtime.channel.duplicate` (BrokerError category 'config' — vedi
   * `realtime-channel-manager.ts` plan 04-07).
   *
   * Owner di default `'system'` (top-level consumer API). Il `registerPlugin`
   * override di sotto passa invece `descriptor.id` come ownerId per cascade D-112.
   *
   * @example
   * ```ts
   * await broker.connectRealtime({ name: 'orders', mode: 'auto', url: '/events' })
   * ```
   */
  async connectRealtime(def: RealtimeChannelDef): Promise<void> {
    return this.manager.connect(def, 'system')
  }

  /**
   * Disconnetti un canale (`name` omesso = tutti — D-102).
   *
   * Su disconnect ULTIMO canale → teardown visibility detector (D-110 cascade,
   * gestito dal manager).
   *
   * @example
   * ```ts
   * broker.disconnectRealtime('orders')  // singolo
   * broker.disconnectRealtime()           // tutti + visibility teardown
   * ```
   */
  disconnectRealtime(name?: string): void {
    this.manager.disconnect(name)
  }

  // ============================================================================
  // Plugin management (override per cascade D-103 + D-112)
  // ============================================================================

  /**
   * Registra un plugin — delegate a `RouterBroker.registerPlugin` + auto-register
   * `descriptor.realtimeChannels` con `ownerId = descriptor.id` (D-103).
   *
   * Pattern try/catch isolato: un canale fallito NON blocca il register del plugin
   * (graceful degrade pattern F3 router-broker-wrapper.ts:437-449).
   *
   * **W-5 fix iter 2** — niente silent catch: emit `system.warn` con dettagli per
   * audit/debug. Il plugin viene COMUNQUE registrato; il consumer può subscribe a
   * `system.warn` per loggare/alertare.
   */
  async registerPlugin(descriptor: PluginDescriptor): Promise<void> {
    await this.inner.registerPlugin(descriptor)
    if (descriptor.realtimeChannels && descriptor.realtimeChannels.length > 0) {
      for (const def of descriptor.realtimeChannels) {
        try {
          await this.manager.connect(def, descriptor.id)
        } catch (err) {
          // W-5 fix — niente silent catch: emit `system.warn` con dettagli
          // strutturati. Il `source.type: 'system'` distingue da event server-pushed
          // ed evita ambiguità con eventi adapter (T-04-08-05 mitigation parziale).
          this.inner.publish(
            'system.warn',
            {
              plugin: descriptor.id,
              channel: def.name,
              reason: 'realtime-channel-register-failed',
              error: err instanceof Error ? err.message : String(err),
            } as never,
            {
              source: { type: 'system', id: 'realtime-broker', name: 'register-plugin' },
            } as RouterPublishOptions,
          )
        }
      }
    }
  }

  /**
   * Unregister plugin — cascade D-112 (estende D-86 di F3).
   *
   * Sequenza con try/catch isolato per ogni step (pattern F3
   * router-broker-wrapper.ts:463-485 — un fail in F3 cascade NON blocca F4 cleanup):
   *   1. `inner.unregisterPlugin(id)` — F3 cascade routes + http abort + F2 cascade + F1 unsub
   *   2. `manager.disconnectByOwner(id)` — chiude canali realtime registrati dal plugin
   */
  async unregisterPlugin(id: string): Promise<void> {
    try {
      await this.inner.unregisterPlugin(id)
    } catch {
      /* pattern F3 silent — un fail in F3 cascade NON deve bloccare F4 cleanup */
    }
    try {
      this.manager.disconnectByOwner(id)
    } catch {
      /* pattern F3 silent — idempotency safe */
    }
  }

  // ============================================================================
  // Public API delegate (publish/subscribe/route/canonical — passthrough)
  // ============================================================================

  /** Delegate `inner.publish` — pattern router-broker-wrapper.ts:422-424. */
  publish(...args: Parameters<RouterBroker['publish']>): ReturnType<RouterBroker['publish']> {
    return this.inner.publish(...args)
  }

  /** Delegate `inner.subscribe`. */
  subscribe(...args: Parameters<RouterBroker['subscribe']>): Subscription {
    return this.inner.subscribe(...args)
  }

  /** Delegate `inner.registerRoute` (F3 — D-60 ROUTE-01). */
  registerRoute(
    ...args: Parameters<RouterBroker['registerRoute']>
  ): ReturnType<RouterBroker['registerRoute']> {
    return this.inner.registerRoute(...args)
  }

  /** Delegate `inner.unregisterRoute`. */
  unregisterRoute(
    ...args: Parameters<RouterBroker['unregisterRoute']>
  ): ReturnType<RouterBroker['unregisterRoute']> {
    return this.inner.unregisterRoute(...args)
  }

  /** Delegate `inner.registerCanonicalSchema` (F2 — D-31). */
  registerCanonicalSchema(
    ...args: Parameters<RouterBroker['registerCanonicalSchema']>
  ): ReturnType<RouterBroker['registerCanonicalSchema']> {
    return this.inner.registerCanonicalSchema(...args)
  }

  /**
   * Snapshot debug esteso con sezione `realtime` (manager debug info).
   *
   * **Inner snapshot tentativo**: `RouterBroker` (F3) NON espone `getDebugSnapshot`
   * direttamente sull'API pubblica (delegate è opt-in — vedi router-broker-wrapper.ts).
   * `MapperBroker` (F2) lo espone via il MapperBroker inner del RouterBroker, ma
   * accederci richiederebbe rompere D-83 (cast su private field). V1 pragma:
   * proviamo un duck-typing call best-effort tramite cast `unknown` — se `inner`
   * espone il metodo (es. quando F3 V1.x lo aggiungerà), lo invochiamo; altrimenti
   * `null`. Pattern coerente con T-04-08-02 mitigation (composition opaca).
   *
   * @returns `{ inner: <RouterBroker debug or null>, realtime: <Manager debug> }`.
   */
  getDebugSnapshot(): {
    readonly inner: unknown
    readonly realtime: ReturnType<RealtimeChannelManager['getDebugInfo']>
  } {
    // Duck-typing best-effort — se `RouterBroker` non espone `getDebugSnapshot`
    // pubblicamente, ritorniamo null per la sezione `inner`. NIENTE cast su
    // private field (vincolo D-83/D-101 T-04-08-02).
    const innerWithDebug = this.inner as unknown as {
      getDebugSnapshot?: () => unknown
    }
    const innerDebug =
      typeof innerWithDebug.getDebugSnapshot === 'function'
        ? innerWithDebug.getDebugSnapshot()
        : null
    return {
      inner: innerDebug,
      realtime: this.manager.getDebugInfo(),
    }
  }
}
