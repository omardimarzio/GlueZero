// realtime-channel-manager.ts — `RealtimeChannelManager` class
// (D-102 / D-110 / D-112 — RT-01/02/03/04/05, ERR-02).
//
// Registry N-channel + cascade cleanup per-ownerId + orchestrazione del
// `VisibilityDetector` (singleton lazy-init/teardown).
//
// Pattern composto da:
// - `route-resolver.ts` di F3 (per-owner registry + `unregisterByOwner`)
// - `http-gateway.ts:283-298` (`abortInFlightByOwner` D-86 cascade)
// - Lazy-init pattern per Visibility detector (al primo connect, NON al construct)
//
// Riferimenti decisioni (04-CONTEXT.md):
// - D-102: `RealtimeChannelManager` con `Map<name, ChannelEntry>`, indicizzato per
//   `name` univoco — NON per URL (anti-AP-11 PATTERNS.md §5: niente multiplex automatico).
// - D-107: auto-fallback SSE→WS — `runReconnectLoop` rebinda l'adapter su
//   `strategy.shouldFallback()` (B-4 closure: pre-fix nessun runner orchestrava il
//   fallback effettivo, post-fix l'adapter passa SSE→WS dopo `fallbackThreshold`
//   fail consecutivi).
// - D-110: Visibility API integration — `createVisibilityDetector` lazy al primo
//   `connect()`, teardown all'ultimo `disconnect()`. Su `'visible'` invoca
//   `checkFreshnessAll()` su tutti i canali registrati.
// - D-112: cascade cleanup `disconnectByOwner` chiude TUTTI i canali registrati dal
//   plugin (consumed dal `RealtimeBroker.unregisterPlugin` di plan 04-08).
// - D-115: backpressure adapter-level (riuso F3) — passato all'adapter via deps.
//
// Pattern Anti-AP-11 (PATTERNS.md §5): NESSUNO multiplex automatico — ogni canale
// ha la propria connection (D-102). Map by `name`, NON by `url`.

import { type BrokerEvent, createBrokerError } from '@sembridge/core'
import { nanoid } from 'nanoid'
import type { BackpressureStrategy } from '../http/types/http-strategies'
import { createReconnectStrategy, type ReconnectStrategy } from './reconnect-strategy'
import { SseAdapter, type SseAdapterDeps } from './sse-adapter'
import type { RealtimeChannelDef } from './types/realtime-channel-def'
import { createVisibilityDetector, type VisibilityDetector } from './visibility-detector'
import { WebSocketAdapter, type WebSocketAdapterDeps } from './websocket-adapter'

/** Default `staleTimeoutMs` per `checkFreshnessAll` (D-110 + D-111). 60s uniforme con WS heartbeat. */
const DEFAULT_STALE_TIMEOUT_MS = 60_000

/**
 * Adapter union — entrambi implementano `connect`, `disconnect`, `checkFreshness`,
 * `getDebugInfo`. Il manager dispatcha al constructor giusto in base a `def.mode`
 * o al `nextMode` calcolato in `runReconnectLoop` (B-4 fallback).
 */
type Adapter = SseAdapter | WebSocketAdapter

/**
 * Funzione publish iniettata dal manager — loose coupling (no import diretto del
 * Broker). Identica al typedef in `sse-adapter.ts` / `websocket-adapter.ts`.
 */
export type RealtimePublishFn = (event: BrokerEvent) => void

/**
 * Clock injection per `runReconnectLoop` test (B-4). Default `setTimeout`-based.
 * Test injection: `clock.sleep = () => Promise.resolve()` per loop sync.
 */
export interface RealtimeManagerClock {
  /** Attende `ms` millisecondi. */
  readonly sleep: (ms: number) => Promise<void>
}

/**
 * Dipendenze del Manager — mirror di `SseAdapterDeps` + `WebSocketAdapterDeps` +
 * visibility DI + clock DI per test.
 */
export interface RealtimeChannelManagerDeps {
  /** Publish callback verso il broker (D-113 — pipeline §28 step 1 ingress). */
  readonly publishFn: RealtimePublishFn
  /** Backpressure strategy adapter-level (D-115 — riuso F3, opt-in). */
  readonly backpressure?: BackpressureStrategy
  /** DI EventSource constructor per test jsdom (RESEARCH §9.1). */
  readonly EventSourceCtor?: typeof EventSource
  /** DI WebSocket constructor per test jsdom (RESEARCH §9.1). */
  readonly WebSocketCtor?: typeof WebSocket
  /**
   * DI Document per `VisibilityDetector` (RESEARCH §5.3 — testabilità).
   * - `undefined` (default): usa `globalThis.document`.
   * - `null`: explicit disable (Worker/SSR/iframe sandbox).
   * - `Document` mock: test injection.
   */
  readonly document?: Document | null
  /** Override `staleTimeoutMs` per `checkFreshnessAll` (default 60_000). */
  readonly staleTimeoutMs?: number
  /** Clock injection per `runReconnectLoop` test (B-4). Default: real `setTimeout`. */
  readonly clock?: RealtimeManagerClock
}

/**
 * Entry interno della Map registry — un canale fisicamente connesso (o in-flight
 * di reconnect). Tutti i field sono mutabili perché il `runReconnectLoop` aggiorna
 * `adapter`, `controller`, `mode` durante il fallback.
 */
interface ChannelEntry {
  readonly def: RealtimeChannelDef
  readonly ownerId: string
  /** Adapter corrente (può essere sostituito durante `runReconnectLoop` su mode switch B-4). */
  adapter: Adapter
  /** Controller corrente (rinnovato a ogni reconnect attempt). */
  controller: AbortController
  /** Mode corrente (può cambiare su `shouldFallback()` B-4). */
  mode: 'sse' | 'websocket'
  /** Reconnect strategy per-canale (B-4 — istanziata al connect, riusata da `runReconnectLoop`). */
  readonly strategy: ReconnectStrategy
  /** True se l'utente ha chiamato `disconnect()` manualmente — blocca `runReconnectLoop`. */
  manuallyClosed: boolean
}

/** Snapshot info per debug (Inspector F6 future-compat / DOC-04). */
export interface RealtimeChannelManagerDebugInfo {
  readonly channelCount: number
  readonly visibilityActive: boolean
  readonly channels: ReadonlyArray<{
    readonly name: string
    readonly ownerId: string
    readonly mode: 'sse' | 'websocket'
    readonly debug: ReturnType<Adapter['getDebugInfo']>
  }>
}

/**
 * `RealtimeChannelManager` — registry N-channel + cascade cleanup + visibility
 * orchestration (D-102, D-110, D-112).
 *
 * Lifecycle:
 * 1. `new RealtimeChannelManager(deps)` — istanzia registry vuoto. Visibility
 *    detector NON ancora attivo (lazy init D-110).
 * 2. `await manager.connect(def, ownerId?)` — registra canale + factory dispatch
 *    a `SseAdapter` (mode='sse'|'auto') o `WebSocketAdapter` (mode='websocket').
 *    Al primo connect, lazy-init del `VisibilityDetector`.
 * 3. `manager.disconnect(name?)` — chiude singolo canale o tutti. Teardown
 *    visibility quando l'ultimo canale è disconnesso.
 * 4. `manager.disconnectByOwner(ownerId)` — cascade D-112 (consumed da
 *    `RealtimeBroker.unregisterPlugin` di plan 04-08).
 * 5. `runReconnectLoop` (privato) — orchestra il ciclo
 *    `nextDelayMs() → sleep → shouldFallback()? fallback() : getMode() → connect →
 *    recordSuccess()|recordFailure()` (B-4 + B-NEW-1 fix). Pubblica
 *    `system.realtime.reconnecting` durante l'attesa e `system.realtime.failed`
 *    con `reason='cycle-cap-exceeded'` su `strategy.isPermanentlyFailed()`.
 *
 * **Anti-pattern AP-11 (PATTERNS.md §5):** NESSUN multiplex automatico — ogni canale
 * ha la propria connection (D-102). Map indicizzata per `name`, NON per `url`.
 *
 * @example
 * ```ts
 * const manager = new RealtimeChannelManager({
 *   publishFn: (ev) => broker.publish(ev),
 *   document: globalThis.document,
 * })
 * await manager.connect({ name: 'orders', mode: 'auto', url: '/sse' }, 'plugin-A')
 * await manager.connect({ name: 'feed', mode: 'websocket', url: '/ws' }, 'plugin-A')
 * // ...
 * manager.disconnectByOwner('plugin-A') // chiude entrambi
 * ```
 *
 * @see {@link RealtimeBroker} — composition wrapper consumer-facing (plan 04-08)
 * @see {@link SseAdapter} — adapter prioritario V1 (plan 04-05)
 * @see {@link WebSocketAdapter} — adapter alternativo + auto-fallback target (plan 04-06)
 * @see {@link createReconnectStrategy} — full jitter D-109 + auto-fallback D-107 (plan 04-03)
 * @see {@link createVisibilityDetector} — D-110 freshness check on visible (plan 04-04)
 */
export class RealtimeChannelManager {
  private readonly channels = new Map<string, ChannelEntry>()
  private visibility: VisibilityDetector | null = null
  private readonly staleTimeoutMs: number
  /** Clock injection per testabilità (B-4). Default: `setTimeout`-based. */
  private readonly clock: RealtimeManagerClock

  constructor(private readonly deps: RealtimeChannelManagerDeps) {
    this.staleTimeoutMs = deps.staleTimeoutMs ?? DEFAULT_STALE_TIMEOUT_MS
    this.clock =
      deps.clock ??
      ({
        sleep: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
      } satisfies RealtimeManagerClock)
  }

  /**
   * Registra + connette un canale (D-102).
   *
   * Steps:
   * 1. Duplicate guard: throw `realtime.channel.duplicate` se `name` già registrato.
   * 2. Lazy init `VisibilityDetector` al PRIMO canale (D-110).
   * 3. Istanzia `ReconnectStrategy` per-canale (B-4 — usata da `runReconnectLoop`).
   * 4. Factory dispatch: `SseAdapter` se mode='sse'|'auto', `WebSocketAdapter`
   *    se mode='websocket'. Default 'auto' → 'sse' (D-107 SSE-first).
   * 5. Registra entry nella Map e tenta `await adapter.connect(controller.signal)`.
   * 6. Se connect fail: `strategy.recordFailure()` + trigger `runReconnectLoop`.
   *
   * @param def - Definizione canale (D-102).
   * @param ownerId - Owner per cascade D-112 (default `'system'` per top-level
   *   `connectRealtime` consumer; il `RealtimeBroker` di plan 04-08 passa il
   *   `pluginId` corrente).
   * @throws `BrokerError` con `code: 'realtime.channel.duplicate'` (category 'config')
   *   se il `name` è già registrato.
   */
  async connect(def: RealtimeChannelDef, ownerId: string = 'system'): Promise<void> {
    if (this.channels.has(def.name)) {
      throw createBrokerError({
        code: 'realtime.channel.duplicate',
        category: 'config',
        message: `Channel "${def.name}" already registered`,
        details: { channel: def.name },
      })
    }

    // Lazy init visibility detector al PRIMO canale (D-110).
    if (this.channels.size === 0 && this.visibility === null) {
      this.visibility = createVisibilityDetector({
        ...(this.deps.document !== undefined && { document: this.deps.document }),
        onChange: (state): void => {
          if (state === 'visible') this.checkFreshnessAll()
        },
      })
      this.visibility.start()
    }

    // Mode resolution: 'auto' → 'sse' (D-107 SSE-first), 'websocket' → 'websocket',
    // 'sse' → 'sse'.
    const initialMode: 'sse' | 'websocket' = def.mode === 'websocket' ? 'websocket' : 'sse'

    // B-4 — istanzia `ReconnectStrategy` per-canale; il `runReconnectLoop` la usa
    // per il ciclo `nextDelayMs/recordSuccess/recordFailure/shouldFallback`.
    const strategy = createReconnectStrategy({
      initialMode,
      ...(def.reconnect?.baseMs !== undefined && { baseMs: def.reconnect.baseMs }),
      ...(def.reconnect?.capMs !== undefined && { capMs: def.reconnect.capMs }),
      ...(def.reconnect?.consolidationMs !== undefined && {
        consolidationMs: def.reconnect.consolidationMs,
      }),
      ...(def.reconnect?.maxAttempts !== undefined && {
        maxAttempts: def.reconnect.maxAttempts,
      }),
      ...(def.reconnect?.fallbackThreshold !== undefined && {
        fallbackThreshold: def.reconnect.fallbackThreshold,
      }),
      ...(def.reconnect?.globalCycleCap !== undefined && {
        globalCycleCap: def.reconnect.globalCycleCap,
      }),
    })

    const controller = new AbortController()

    let adapter: Adapter
    try {
      adapter =
        initialMode === 'websocket'
          ? new WebSocketAdapter(def, this.buildWsDeps())
          : new SseAdapter(def, this.buildSseDeps())
    } catch (_err) {
      // Constructor throw (es. WebSocketCtor non disponibile): registra strategy
      // failure e attiva runReconnectLoop fallback. Crea entry fittizia per
      // il loop — il loop ricreerà l'adapter al prossimo iteration.
      strategy.recordFailure()
      // Senza adapter, costruiamo un sentinel: registriamo l'entry e lasciamo
      // che runReconnectLoop costruisca al prossimo attempt. Per evitare
      // null-handling nel resto della classe, costruiamo un placeholder che
      // viene immediatamente sostituito.
      // Pattern: crea SseAdapter (low-cost — solo init reconnect strategy)
      // come placeholder; verrà sostituito al primo loop iteration.
      adapter = new SseAdapter(def, this.buildSseDeps())
      const entry: ChannelEntry = {
        def,
        ownerId,
        adapter,
        controller,
        mode: initialMode,
        strategy,
        manuallyClosed: false,
      }
      this.channels.set(def.name, entry)
      void this.runReconnectLoop(def.name, def, ownerId)
      return
    }

    const entry: ChannelEntry = {
      def,
      ownerId,
      adapter,
      controller,
      mode: initialMode,
      strategy,
      manuallyClosed: false,
    }
    this.channels.set(def.name, entry)

    try {
      await adapter.connect(controller.signal)
      strategy.recordSuccess()
    } catch (_err) {
      // B-NEW-1 fix — `recordFailure()` no-arg per allineamento all'interface 04-03.
      strategy.recordFailure()
      // Trigger reconnect loop on initial connect failure (non-manual).
      void this.runReconnectLoop(def.name, def, ownerId)
    }
  }

  /**
   * Disconnect singolo canale (per `name`) o tutti (`name` omesso).
   *
   * Su disconnect ULTIMO canale → teardown visibility detector (D-110 cascade).
   *
   * Setta `entry.manuallyClosed = true` PRIMA del cleanup per bloccare un
   * eventuale `runReconnectLoop` attivo (B-4 — `while (!manuallyClosed)`).
   */
  disconnect(name?: string): void {
    if (name === undefined) {
      // Disconnect-all: chiude tutti i canali + teardown visibility.
      for (const entry of this.channels.values()) {
        entry.manuallyClosed = true
        try {
          entry.adapter.disconnect('manual.disconnect-all')
        } catch {
          // idempotent — l'adapter dovrebbe essere safe ma swallow per robustezza
          // (T-04-07-03 mitigation parziale).
        }
        if (!entry.controller.signal.aborted) {
          entry.controller.abort('manual.disconnect-all')
        }
      }
      this.channels.clear()
      this.teardownVisibility()
      return
    }

    const entry = this.channels.get(name)
    if (!entry) return
    entry.manuallyClosed = true
    try {
      entry.adapter.disconnect('manual')
    } catch {
      // idempotent swallow
    }
    if (!entry.controller.signal.aborted) {
      entry.controller.abort('manual')
    }
    this.channels.delete(name)
    if (this.channels.size === 0) this.teardownVisibility()
  }

  /**
   * Cascade cleanup D-112 — chiude TUTTI i canali registrati dal plugin con
   * `ownerId`.
   *
   * Pattern identico a `HttpGateway.abortInFlightByOwner`
   * (`gateway/http/http-gateway.ts:283-298`). Il `RealtimeBroker` di plan 04-08
   * lo invoca da `unregisterPlugin` per propagare la cascade D-86 ext F4.
   *
   * @param ownerId - Plugin owner — null/empty match niente.
   * @param reason - Reason descriptor propagato all'adapter.disconnect (default
   *   `'plugin.unregistered'`).
   * @returns Numero di canali chiusi (0 se nessuno con quell'`ownerId`).
   */
  disconnectByOwner(ownerId: string, reason: string = 'plugin.unregistered'): number {
    let count = 0
    for (const [name, entry] of this.channels.entries()) {
      if (entry.ownerId === ownerId) {
        entry.manuallyClosed = true
        try {
          entry.adapter.disconnect(reason)
        } catch {
          // idempotent swallow
        }
        if (!entry.controller.signal.aborted) {
          entry.controller.abort(reason)
        }
        this.channels.delete(name)
        count += 1
      }
    }
    if (this.channels.size === 0) this.teardownVisibility()
    return count
  }

  /**
   * Freshness check su tutti i canali (D-110 invocato dal `VisibilityDetector`
   * `onChange('visible')` callback).
   *
   * Per ogni canale stale (`adapter.checkFreshness(staleTimeoutMs)` ritorna `false`),
   * triggera `adapter.disconnect('stale.visibility-check')`. Il loop di reconnect
   * del manager riprenderà via `runReconnectLoop` se l'adapter publica
   * `system.realtime.disconnected`.
   *
   * Idempotente: se nessun canale è stale, no-op.
   */
  checkFreshnessAll(): void {
    for (const entry of this.channels.values()) {
      const stillFresh = entry.adapter.checkFreshness(this.staleTimeoutMs)
      if (!stillFresh) {
        try {
          entry.adapter.disconnect('stale.visibility-check')
        } catch {
          // swallow — adapter responsable
        }
      }
    }
  }

  /**
   * Snapshot debug — pattern F1 `getDebugSnapshot`.
   *
   * @returns `{ channelCount, visibilityActive, channels: [{ name, ownerId, mode, debug }] }`.
   */
  getDebugInfo(): RealtimeChannelManagerDebugInfo {
    const channels = Array.from(this.channels.values()).map((e) => ({
      name: e.def.name,
      ownerId: e.ownerId,
      mode: e.mode,
      debug: e.adapter.getDebugInfo(),
    }))
    return {
      channelCount: this.channels.size,
      visibilityActive: this.visibility?.isActive() ?? false,
      channels,
    }
  }

  // ============================================================================
  // Private helpers
  // ============================================================================

  /**
   * `runReconnectLoop` — ciclo orchestrato di reconnect per il canale `name`
   * (B-4 + B-NEW-1 fix iter 2).
   *
   * Signature allineata all'interface `ReconnectStrategy` del plan 04-03:
   * - `getMode()` (NOT `currentMode()`)
   * - `nextDelayMs()` no-arg (NOT `nextDelayMs(attempt)`)
   * - `recordFailure()` no-arg (NOT `recordFailure(err)`)
   * - `fallback()` toggla mode interno + ritorna nuovo mode
   *
   * Loop:
   * 1. `nextDelayMs()` → publish `system.realtime.reconnecting` → `clock.sleep(delay)`.
   * 2. Re-check `manuallyClosed` post-sleep (potrebbe essere stato disconnesso).
   * 3. `strategy.shouldFallback() ? fallback() : getMode()` → `nextMode`.
   * 4. Rebind adapter+controller per `nextMode` (mode switch su fallback).
   * 5. `try connect → recordSuccess + publish system.realtime.connected ; on error
   *    → recordFailure() → loop`.
   *
   * Termina quando:
   * - `manuallyClosed === true` (utente disconnect/unregister) — return silenzioso.
   * - `strategy.isPermanentlyFailed()` — publish `system.realtime.failed` con
   *   `reason: 'cycle-cap-exceeded'` (B-4 cycle-cap closure).
   *
   * Chiusura D-107 auto-fallback effettivo (B-4): pre-fix nessun runner orchestrava
   * il fallback effettivo. Post-fix: dopo `fallbackThreshold` fail consecutivi,
   * l'adapter viene rebinded da SSE a WS (o viceversa).
   *
   * @param name - Canale registrato.
   * @param def - Definizione canale (per ricostruzione adapter).
   * @param ownerId - Per propagazione system events.
   */
  private async runReconnectLoop(
    name: string,
    def: RealtimeChannelDef,
    ownerId: string,
  ): Promise<void> {
    const entry = this.channels.get(name)
    if (!entry) return
    const strategy = entry.strategy

    while (!strategy.isPermanentlyFailed() && !entry.manuallyClosed && this.channels.has(name)) {
      const delay = strategy.nextDelayMs()
      const modeBeforeAttempt = strategy.getMode()
      this.publishSystem('system.realtime.reconnecting', {
        channel: name,
        mode: modeBeforeAttempt,
        delayMs: delay,
        ownerId,
      })

      await this.clock.sleep(delay)

      // Re-check post-sleep (utente potrebbe aver disconnesso durante il delay).
      if (entry.manuallyClosed || !this.channels.has(name)) return

      // `shouldFallback()` true → `fallback()` toggla mode interno e ritorna il
      // nuovo mode; altrimenti riusiamo il mode corrente via `getMode()`.
      const nextMode: 'sse' | 'websocket' = strategy.shouldFallback()
        ? strategy.fallback()
        : strategy.getMode()

      // Rinnova controller + adapter (rebind on mode switch).
      const newController = new AbortController()
      let newAdapter: Adapter
      try {
        newAdapter =
          nextMode === 'websocket'
            ? new WebSocketAdapter(def, this.buildWsDeps())
            : new SseAdapter(def, this.buildSseDeps())
      } catch (_constructorErr) {
        // Constructor throw (es. WebSocketCtor non disponibile in jsdom + DI mock
        // failing). Registra failure e continua il loop al prossimo iteration.
        strategy.recordFailure()
        continue
      }
      entry.adapter = newAdapter
      entry.controller = newController
      entry.mode = nextMode

      try {
        await newAdapter.connect(newController.signal)
        strategy.recordSuccess()
        this.publishSystem('system.realtime.connected', {
          channel: name,
          mode: nextMode,
          ownerId,
        })
        return
      } catch (_err) {
        // B-NEW-1 — `recordFailure()` no-arg (interface 04-03). L'errore non è
        // passato: la strategy traccia solo il counter; il dettaglio dell'errore
        // è già stato pubblicato come `system.realtime.disconnected` dall'adapter
        // (plan 04-05/06). Non logga qui per evitare spam — gli adapter F4 hanno
        // già loro logging via publishSystem.
        strategy.recordFailure()
      }
    }

    if (strategy.isPermanentlyFailed() && !entry.manuallyClosed) {
      this.publishSystem('system.realtime.failed', {
        channel: name,
        reason: 'cycle-cap-exceeded',
        ownerId,
      })
    }
  }

  /**
   * Helper interno per pubblicare eventi `system.realtime.*` (B-4 — pattern adapter).
   *
   * Identico a `makeSystemEvent` di sse-adapter.ts / websocket-adapter.ts ma con
   * source descriptor `name: 'manager'` per distinguere gli event emessi dal
   * runReconnectLoop dagli event emessi dagli adapter (su Inspector F6 future).
   */
  private publishSystem(topic: string, payload: Record<string, unknown>): void {
    this.deps.publishFn({
      id: nanoid(),
      topic,
      timestamp: Date.now(),
      source: { type: 'system', id: 'realtime-channel-manager', name: 'manager' },
      payload,
    } as BrokerEvent)
  }

  /** Builder di `SseAdapterDeps` con spread condizionale per `exactOptionalPropertyTypes`. */
  private buildSseDeps(): SseAdapterDeps {
    return {
      publishFn: this.deps.publishFn,
      ...(this.deps.backpressure !== undefined && { backpressure: this.deps.backpressure }),
      ...(this.deps.EventSourceCtor !== undefined && {
        EventSourceCtor: this.deps.EventSourceCtor,
      }),
    }
  }

  /** Builder di `WebSocketAdapterDeps` con spread condizionale. */
  private buildWsDeps(): WebSocketAdapterDeps {
    return {
      publishFn: this.deps.publishFn,
      ...(this.deps.backpressure !== undefined && { backpressure: this.deps.backpressure }),
      ...(this.deps.WebSocketCtor !== undefined && { WebSocketCtor: this.deps.WebSocketCtor }),
    }
  }

  /** Teardown visibility detector + reset reference (idempotent). */
  private teardownVisibility(): void {
    if (this.visibility !== null) {
      this.visibility.stop()
      this.visibility = null
    }
  }
}
