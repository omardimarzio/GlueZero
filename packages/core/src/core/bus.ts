// EventBus — il cuore del broker SemBridge (CORE-01, CORE-09, CORE-12, ERR-03).
//
// Dispatch pub/sub con:
//   - tap orchestration sui 5 step F1 della pipeline §28 (CORE-13, D-20)
//   - handler isolation try/catch sync + .catch() async (D-16) → publish system.error
//   - delivery semantics: 'async' default via queueMicrotask (D-01), 'sync' immediate (D-02),
//     'worker'/'remote' fallback async + warn (D-03)
//   - AbortSignal-first subscribe → auto-unsubscribe su abort (D-26)
//   - Subscription.unsubscribe() idempotente (D-27)
//   - SubscribeOptions.once → handler invocato max una volta (decisione plan 03)
//   - unsubscribeByOwner(ownerId) per cascade plugin cleanup (LIFE-02 in plan 08)
//   - deep-freeze opt-in dev mode (D-04) → mutation tentata dal subscriber → TypeError
//
// Threat coverage:
// - T-07-02 (DoS — ricursione publish stesso topic): default async via queueMicrotask
//   svuota lo stack tra publish e delivery.
// - T-07-03 (DoS — system.error in handler isolation causa recursion): system.error
//   pubblicato in queueMicrotask (defer); fallback `logger.error` se la pubblicazione
//   stessa fallisce (no retry).
// - T-07-04 (Tampering — mutation event.payload): freezeForDelivery in dev mode con
//   deepFreeze (D-04). In production type-level DeepReadonly è enforcement compile-time.
// - T-07-06 (DoS — tap throw nel hot-path): safeTapStep con try/catch (D-20).
//
// `exactOptionalPropertyTypes: true` policy: campi opzionali NON valorizzati come
// `undefined`. Conditional spread `...(x !== undefined && { x })` produce proprietà
// assente vs proprietà undefined.

import { nanoid } from 'nanoid'
import type { BrokerEvent } from '../types/broker-event'
import type { BrokerLogger } from '../types/logger'
import type { SubscribeOptions, Subscription } from '../types/subscription'
import type { EventTap, PipelineSnapshot, PipelineStep } from '../types/tap'
import { createBrokerError, isBrokerError } from './broker-error'
import { deepFreeze } from './deep-freeze'
import { safeTapStep } from './event-tap'
import { validateEvent } from './event-validator'
import { TopicTrie } from './topic-matcher'

interface InternalSubscription {
  id: string
  topic: string // pattern (può contenere '*')
  handler: (event: BrokerEvent) => void | Promise<void>
  active: boolean
  ownerId?: string
  options: SubscribeOptions
  abortListener?: () => void
}

export interface EventBusOptions {
  debug: boolean
}

export interface EventBusStats {
  topics: string[]
  subscriberCount: Record<string, number>
  pendingAsyncDelivery: number
}

export class EventBus {
  private readonly trie = new TopicTrie<InternalSubscription>()
  private readonly byId = new Map<string, InternalSubscription>()
  private pendingAsync = 0
  private debugMode: boolean

  constructor(
    private readonly logger: BrokerLogger,
    private readonly tap: EventTap,
    options: EventBusOptions,
  ) {
    this.debugMode = options.debug
  }

  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled
  }

  publish<T>(event: BrokerEvent<T>): void {
    // Step 1: received
    safeTapStep(this.tap, 'event.received', this.snap('event.received', event))

    // Step 2: enrich (id/timestamp già settati da event-factory, no-op concettuale in F1)
    safeTapStep(this.tap, 'event.metadata.enriched', this.snap('event.metadata.enriched', event))

    // Step 3: validate (VAL-01) — throw blocca consegna; tap NON emesso per validated/delivered
    try {
      validateEvent(event)
    } catch (err) {
      this.logger.error('Event validation failed', { eventId: event.id, error: err })
      throw err
    }
    safeTapStep(this.tap, 'event.validated', this.snap('event.validated', event))

    // Step 7-base: dedupe placeholder (full dedupe in F3)
    safeTapStep(this.tap, 'event.dedupe.checked', this.snap('event.dedupe.checked', event))

    // Step 13: delivery
    const matches = this.trie.match(event.topic)
    const frozenEvent = this.debugMode ? this.freezeForDelivery(event) : event

    const mode = event.deliveryMode ?? 'async'
    if (mode === 'sync') {
      this.dispatchSync(matches, frozenEvent)
    } else {
      if (mode === 'worker' || mode === 'remote') {
        this.logger.warn('mapping.delivery.fallback', { mode, fallback: 'async' })
      }
      this.dispatchAsync(matches, frozenEvent)
    }

    safeTapStep(
      this.tap,
      'event.delivered',
      this.snap('event.delivered', frozenEvent, {
        metadata: { subscriberCount: matches.length },
      }),
    )
  }

  subscribe(
    pattern: string,
    handler: (event: BrokerEvent) => void | Promise<void>,
    options: SubscribeOptions = {},
    ownerId?: string,
  ): Subscription {
    const id = nanoid()
    const sub: InternalSubscription = {
      id,
      topic: pattern,
      handler,
      active: true,
      ...(ownerId !== undefined && { ownerId }),
      options,
    }

    // trie.insert valida il pattern internamente via validateTopicPattern
    this.trie.insert(pattern, sub)
    this.byId.set(id, sub)

    if (options.signal) {
      const listener = (): void => this.unsubscribeInternal(id)
      options.signal.addEventListener('abort', listener)
      sub.abortListener = listener
    }

    const handle: Subscription = {
      get id() {
        return id
      },
      get topic() {
        return pattern
      },
      get active() {
        return sub.active
      },
      unsubscribe: () => this.unsubscribeInternal(id),
    }
    return handle
  }

  unsubscribeByOwner(ownerId: string): number {
    let count = 0
    for (const [id, sub] of this.byId) {
      if (sub.ownerId === ownerId) {
        this.unsubscribeInternal(id)
        count++
      }
    }
    return count
  }

  getStats(): EventBusStats {
    const topics = this.trie.collectAllPatterns()
    const subscriberCount: Record<string, number> = {}
    for (const sub of this.byId.values()) {
      subscriberCount[sub.topic] = (subscriberCount[sub.topic] ?? 0) + 1
    }
    return { topics, subscriberCount, pendingAsyncDelivery: this.pendingAsync }
  }

  private unsubscribeInternal(id: string): void {
    const sub = this.byId.get(id)
    if (!sub?.active) return // idempotent (D-27)
    sub.active = false
    this.trie.remove(sub.topic, sub)
    this.byId.delete(id)
    if (sub.abortListener && sub.options.signal) {
      sub.options.signal.removeEventListener('abort', sub.abortListener)
    }
  }

  private dispatchSync(matches: InternalSubscription[], event: BrokerEvent): void {
    for (const sub of matches) {
      if (!sub.active) continue
      this.runHandler(sub, event)
    }
  }

  private dispatchAsync(matches: InternalSubscription[], event: BrokerEvent): void {
    if (matches.length === 0) return
    this.pendingAsync++
    queueMicrotask(() => {
      this.pendingAsync--
      for (const sub of matches) {
        if (!sub.active) continue
        this.runHandler(sub, event)
      }
    })
  }

  private runHandler(sub: InternalSubscription, event: BrokerEvent): void {
    try {
      const result = sub.handler(event)
      if (result && typeof (result as Promise<void>).catch === 'function') {
        ;(result as Promise<void>).catch((err: unknown) => this.handleHandlerError(sub, event, err))
      }
      // Apply { once: true } DOPO successful invocation (decisione plan 03)
      if (sub.options.once && sub.active) {
        this.unsubscribeInternal(sub.id)
      }
    } catch (err) {
      this.handleHandlerError(sub, event, err)
    }
  }

  private handleHandlerError(sub: InternalSubscription, event: BrokerEvent, err: unknown): void {
    this.logger.error('Plugin handler threw', {
      subscriptionId: sub.id,
      topic: event.topic,
      eventId: event.id,
      ...(sub.ownerId !== undefined && { ownerId: sub.ownerId }),
      error: err,
    })
    const sysError = isBrokerError(err)
      ? err
      : createBrokerError({
          code: 'plugin.handler.failed',
          category: 'plugin',
          message: err instanceof Error ? err.message : String(err),
          ...(err instanceof Error && { originalError: err }),
          eventId: event.id,
          topic: event.topic,
        })
    // Defer system.error publish to next microtask per evitare recursion (T-07-03)
    queueMicrotask(() => {
      try {
        this.publish<{
          error: typeof sysError
          originalEventId: string
          originalTopic: string
        }>({
          id: nanoid(),
          topic: 'system.error',
          timestamp: Date.now(),
          source: { type: 'system', id: 'broker' },
          payload: {
            error: sysError,
            originalEventId: event.id,
            originalTopic: event.topic,
          } as never,
          priority: 'critical',
          deliveryMode: 'async',
        })
      } catch {
        this.logger.error('Failed to publish system.error', { error: sysError })
      }
    })
  }

  private freezeForDelivery<T>(event: BrokerEvent<T>): BrokerEvent<T> {
    deepFreeze(event.payload)
    if (event.metadata) deepFreeze(event.metadata)
    Object.freeze(event)
    return event
  }

  private snap<T>(
    step: PipelineStep,
    event: BrokerEvent<T>,
    extras: Partial<PipelineSnapshot> = {},
  ): PipelineSnapshot {
    return {
      eventId: event.id,
      topic: event.topic,
      step,
      timestamp: Date.now(),
      durationMs: 0,
      ...(this.debugMode && { payloadAfter: event.payload }),
      ...extras,
    }
  }
}
