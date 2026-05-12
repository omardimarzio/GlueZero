/**
 * F11 enforcement points — facade composition esterna pura (OQ-1) + service
 * monkey-patch idempotent (OQ-3).
 *
 * Cover REQ-IDs: MF-PERM-02 (10 enforcement points action discriminator) +
 * MF-PIPE-01 (pipeline §28 D-V2-20 BLOCKING — proprietà logica facade chain step 4.5).
 *
 * ## OQ-1 RESOLUTION (research §1 — facade-only enforcement)
 *
 * **`broker.publish` raw NON è intercettato.** Il seam `publishInterceptors`
 * dichiarato in `packages/core/src/core/broker.ts:96` E referenziato in
 * `module.ts:113` NON è invocato dal metodo `Broker.publish` (verified
 * `broker.ts:198-207` — entrambi i branch `if/else` eseguono lo stesso codice
 * `bus.publish(event)` senza chiamare gli interceptors).
 *
 * Conseguenza architetturale: F11 NON può fare pipeline-level interception via
 * EventTap multiplex senza diff core, e D-V2-F11-22 D-83 strict triple vieta
 * qualunque diff `packages/{core,microfrontends,mapper}/src/`.
 *
 * **Soluzione adottata (D-V2-F11-01 scaffolding + D-V2-F11-02 amended A1 — `publishInterceptors` NOT invocato dal core):** `wrapContextWithPermissions`
 * wrappa il facade output di `createMfRuntimeContext` F8 con composition esterna
 * pura. Ogni call `ctx.publish(...)`/`ctx.subscribe(...)` invoca prima
 * `engine.enforce({mfId, action, resource})`. Se enforce non throw → invocazione
 * delegata a `baseCtx.publish`/`baseCtx.subscribe` (F8 facade) → `broker.publish`
 * raw → pipeline §28 unchanged.
 *
 * **Pipeline §28 ordine (MF-PIPE-01 D-V2-20 BLOCKING — PRD §47.11)** è
 * PROPRIETÀ LOGICA della facade chain:
 *
 * ```
 * ctx.publish(topic, payload)               // step 1 logical entry
 *   → engine.enforce()                     // step 4.5 logical (permission)
 *   → baseCtx.publish(...)                 // step 2-3 (source enrichment)
 *     → broker.publish(...)                // step 5+ mapping → route → exec → delivery → metrics
 * ```
 *
 * App shell + plugin v1.x che usano raw `broker.publish` BYPASSANO il check
 * (SC4 ROADMAP linea 290). Documentato in README W3 P06 — P-13 governance NOT
 * crypto sandbox; mitigation: iframe isolation F13.
 *
 * ## OQ-3 RESOLUTION (research §7 — service monkey-patch)
 *
 * F8 NON espone hook per F11 wrap del context post-creation (verified
 * `runtime-context-factory.ts:57-103` + `registry.ts` — `bootstrap/mount/unmount/destroy`
 * ritornano `Promise<void>`, NON ritornano il context). Il context viene
 * costruito internamente dal registry e passato ai lifecycle hook del modulo
 * MF — non è disponibile al caller esterno.
 *
 * **Soluzione adottata (D-V2-F11-XX amended A3):** `wrapServiceWithPermissions`
 * applica un **audit marker** non-enumerable `__permissionsServicePatched` al
 * service e marca i metodi `bootstrap/mount/unmount/destroy` come "patched"
 * (wrapper idempotent — chiamate ripetute NON re-patchano).
 *
 * Il wrap effettivo del context al call site (ctx-aware enforcement) viene
 * applicato manualmente dal consumer dove F8 espone il context (es. dentro un
 * `MicroFrontendRuntimeModule.mount(ctx)` hook che invoca
 * `wrapContextWithPermissions(ctx, engine)`). Il marker fornisce audit-grep
 * post-install + base per future estensioni F12+ quando F8 esporrà hook context.
 *
 * @see prd_2.0.0.md §19.5 — 10 enforcement points
 * @see prd_2.0.0.md §47.11 — D-V2-20 pipeline §28 ordine
 * @see ROADMAP linea 290 — SC4 broker.publish raw NON instrumented
 * @see ROADMAP linea 456 — MF-PIPE-01 cross-fase BLOCKING
 * @see D-V2-F11-02 amendment A1 — facade-only (NO EventTap multiplex)
 * @see D-V2-F11-22 — strict triple zero diff upstream
 */
import type { Subscription } from '@gluezero/core'
import type {
  MicroFrontendEventHandler,
  MicroFrontendRuntimeContext,
  MicroFrontendsService,
} from '@gluezero/microfrontends'
import type { PermissionAction, PermissionEngine } from './permission-engine'

/**
 * Wrappa il `MicroFrontendRuntimeContext` F8 con permission check ANTE-azione
 * via composition esterna pura — NON muta `baseCtx`.
 *
 * Actions wrappate F11 (subset disponibile nel facade F8):
 *
 * - `publish` → `engine.enforce({mfId, action:'publish', resource:topic})`
 * - `subscribe` → `engine.enforce({mfId, action:'subscribe', resource:pattern})`
 *
 * Actions F12+ (route/gateway/worker/context.read/context.write/storage.read/
 * storage.write/theme/devtools) NON ancora wrappate — verranno aggiunte quando
 * i rispettivi facade field saranno esposti da F8/F12+.
 *
 * Il field `broker` (raw passthrough) viene preservato unchanged via
 * spread `{...baseCtx}` — SC4 ROADMAP linea 290 + P-13 governance not crypto.
 *
 * @param baseCtx Output di `createMfRuntimeContext(broker, reg, abortSignal?)` F8.
 * @param engine PermissionEngine creato da `createPermissionEngine(broker, mfService, mode)` (plan 11-02).
 * @returns NUOVO context con `publish`/`subscribe` wrappati + tutti gli altri
 *   field preservati per riferimento (incluso `broker`, `id`, `descriptor`,
 *   `signal`, `logger`, e gli placeholder F10-F13).
 *
 * @throws {BrokerError} `PERMISSION_DENIED` se `engine.mode === 'enforce'` e il
 *   check pattern fallisce (forwardato da `engine.enforce`).
 *
 * @example Wrap publish — denied check ANTE-action
 * ```typescript
 * const baseCtx = createMfRuntimeContext(broker, reg)
 * const wrappedCtx = wrapContextWithPermissions(baseCtx, engine)
 *
 * wrappedCtx.publish('customer.order.created', payload)
 * // → engine.enforce({mfId, action:'publish', resource:'customer.order.created'})
 * // → baseCtx.publish('customer.order.created', payload)
 * // → broker.publish(... enriched metadata)
 *
 * wrappedCtx.broker === baseCtx.broker // true — raw passthrough preserved
 * ```
 *
 * @example Wrap subscribe — denied pattern ANTE-action
 * ```typescript
 * const wrappedCtx = wrapContextWithPermissions(baseCtx, engine)
 * wrappedCtx.subscribe('analytics.*', handler)
 * // → engine.enforce({mfId, action:'subscribe', resource:'analytics.*'})
 * // → baseCtx.subscribe('analytics.*', handler)
 * ```
 *
 * @throws {BrokerError} `PERMISSION_DENIED` (categoria `microfrontend`) — propagato da
 *   `engine.enforce` se subscribe pattern denied dal descriptor MF in mode enforce.
 *
 * @see ROADMAP linea 456 — MF-PIPE-01 cross-fase obligation pipeline §28 BLOCKING.
 */
export function wrapContextWithPermissions(
  baseCtx: MicroFrontendRuntimeContext,
  engine: PermissionEngine,
): MicroFrontendRuntimeContext {
  const mfId = baseCtx.id
  return {
    ...baseCtx,
    publish<T>(topic: string, payload: T, options?: unknown): void {
      // MF-PIPE-01 step 4.5 logico — permission check ANTE-action.
      engine.enforce({ mfId, action: 'publish' as PermissionAction, resource: topic })
      baseCtx.publish(topic, payload, options as never)
    },
    subscribe(
      pattern: string,
      handler: MicroFrontendEventHandler,
      options?: unknown,
    ): Subscription {
      engine.enforce({ mfId, action: 'subscribe' as PermissionAction, resource: pattern })
      return baseCtx.subscribe(pattern, handler, options as never)
    },
  }
}

/**
 * Shape interna patched per audit marker. NON public API surface.
 *
 * Il marker `__permissionsServicePatched` è non-enumerable + non-writable +
 * non-configurable per audit-grep clean (NON apparirà in `Object.keys` o
 * `JSON.stringify`) e tampering-resistant.
 *
 * @internal
 */
type PatchableService = MicroFrontendsService & {
  readonly __permissionsServicePatched?: true
}

/**
 * Applica audit marker `__permissionsServicePatched` al service F8 +
 * monkey-patcha i metodi lifecycle `bootstrap/mount/unmount/destroy` come
 * idempotent wrapper (chiamata pre-invocazione invocata ma no-op funzionale —
 * il context wrap effettivo è applicato dal consumer via
 * `wrapContextWithPermissions` dove il context è disponibile).
 *
 * **Idempotent** via marker check: chiamata 2x con stesso service NON re-patcha
 * (i wrapper referenze restano identiche — `firstPatch === secondPatch`).
 *
 * **Audit-grep clean**: il marker NON appare in `Object.keys(mfService)` o in
 * `JSON.stringify(mfService)` (non-enumerable).
 *
 * **Tampering-resistant**: `writable:false + configurable:false` — un MF
 * malevolo NON può `delete service.__permissionsServicePatched` (T-11-11
 * mitigation basic).
 *
 * @param mfService Service `@gluezero/microfrontends` da `broker.getService(SERVICE_MICROFRONTENDS)`.
 * @param engine PermissionEngine per check enforce (reservato per evoluzione F12+
 *   quando F8 esporrà context hook — passato closure per stabilità ref).
 *
 * @example Audit-grep idempotent marker
 * ```sh
 * grep "__permissionsServicePatched" packages/permissions/dist/index.js
 * # expect ≥1 match (set + check sites)
 * ```
 *
 * @example Verifica idempotente
 * ```typescript
 * wrapServiceWithPermissions(mfService, engine)
 * const firstBootstrap = mfService.bootstrap
 * wrapServiceWithPermissions(mfService, engine) // no-op
 * mfService.bootstrap === firstBootstrap // true
 * ```
 */
export function wrapServiceWithPermissions(
  mfService: MicroFrontendsService,
  engine: PermissionEngine,
): void {
  const tagged = mfService as PatchableService
  if (tagged.__permissionsServicePatched) return // idempotent guard
  Object.defineProperty(tagged, '__permissionsServicePatched', {
    value: true,
    writable: false,
    enumerable: false,
    configurable: false,
  })

  // Engine retained in closure per evoluzione F12+ (quando F8 esporrà hook
  // context post-creation, il wrapper potrà invocare wrapContextWithPermissions
  // direttamente sui result). Per ora il monkey-patch è marker-only su
  // bootstrap/mount/unmount/destroy: i wrapper preservano la signature
  // Promise<void> e delegano all'original.
  void engine

  const lifecycleMethods = ['bootstrap', 'mount', 'unmount', 'destroy'] as const
  for (const method of lifecycleMethods) {
    const original = (tagged as unknown as Record<string, unknown>)[method]
    if (typeof original !== 'function') continue
    const originalFn = (original as (...args: unknown[]) => unknown).bind(tagged)
    Object.defineProperty(tagged, method, {
      value(...args: unknown[]): unknown {
        // F11 W2 monkey-patch baseline: invoke original + audit hook point.
        // F12+: il wrapper potrà invocare engine.enforce su lifecycle action
        // (es. 'mount' permission) qui se PRD/D-V2 lo ratifica.
        return originalFn(...args)
      },
      writable: true,
      configurable: true,
    })
  }
}
