/**
 * `contextModule()` factory — `BrokerModule` opt-in per `@gluezero/context`
 * (D-V2-F10-17, D-V2-F10-18).
 *
 * Install pattern LOOKUP service (replica F9 D-V2-F9-01 pattern):
 * - F8 `microfrontendModule()` CREATE service via `createMicroFrontendsService(ctx)`.
 * - F9 `mfEsmModule()` LOOKUP service via `ctx.broker.getService<MicroFrontendsService>(SERVICE_MICROFRONTENDS)`
 *   e chiama `service.registerLoader(esmLoader)`.
 * - F10 `contextModule()` LOOKUP service via stesso pattern; W2 P02/P04 completeranno
 *   con storage init + wireLifecycleHooks (auto-injection LIVE ctx.context).
 *
 * Pre-requisito ordering: il consumer DEVE installare `microfrontendModule()` PRIMA
 * di `contextModule()` nell'array `modules: []` del `createBroker({})`. Se il service
 * non è registrato → throw `Error` esplicativo (T-F10-W1-04 mitigation).
 *
 * No-args lockato (D-V2-F10-18): factory NO-args. Override per-descriptor via
 * `descriptor.context.writableKeys` (W2 P03) e `descriptor.mapping.contextMap`
 * (W2 P04). NO setup-time options globali (coerente D-V2-F9-04).
 *
 * Anti-singleton (D-30 carryover F1): ritorna SEMPRE nuovo `BrokerModule` ad ogni
 * call — 2 broker indipendenti possono installare `contextModule()` senza shared state.
 *
 * Version: `'2.0.0-alpha.0'` (D-V2-F8-10 carryover — pre-GA, NON pubblicato su
 * npm fino a F17 GA). Coerente F9 `mfEsmModule().version === '2.0.0-alpha.0'`.
 *
 * @see PRD §22 (Loader Registry API), §18 (Runtime Context), §6.4 (Pattern S1)
 * @see D-V2-F10-17 (Pattern S1 augment stretto), D-V2-F10-18 (factory no-args)
 */
import type { BrokerModule } from '@gluezero/core'
import { SERVICE_MICROFRONTENDS } from '@gluezero/core'
import type { MicroFrontendsService } from '@gluezero/microfrontends'
import { initRuntimeContext } from './runtime-context'

/**
 * Factory `BrokerModule` per `@gluezero/context`.
 *
 * Install pattern lookup (D-V2-F10-18 + carryover D-V2-F9-01):
 * - Cerca il service `@gluezero/microfrontends` via `ctx.broker.getService(SERVICE_MICROFRONTENDS)`.
 * - Se il service non è installato → throw `Error` con messaggio chiaro
 *   (T-F10-W1-04 mitigation).
 * - (W2 P02) Build internal RuntimeContext state storage (single plain object
 *   D-V2-F10-07 spread-copy on update).
 * - (W2 P04) Wire lifecycle hooks per ctx.context auto-injection LIVE (D-V2-F10-15)
 *   + per-MF MapperEngine scoped Map<mfId, MapperEngine> (D-V2-F10-09).
 *
 * Per ora (W1 Plan 10-01 scaffolding) install è stub: lookup-validate only.
 *
 * No-args lockato D-V2-F10-18 — defaults sensibili da PRD §18 baked-in: storage interno
 * vuoto + writableKeys per-descriptor (default vuoto = read-only fail-secure). Override
 * per-descriptor via `descriptor.context.writableKeys` (W2 P03) +
 * `descriptor.mapping.contextMap` (W2 P04).
 *
 * Anti-singleton lockato D-30 carryover F1 — ritorna nuovo `BrokerModule` ad ogni call.
 *
 * NB: D-V2-F10-17 lockato — il modulo NON estende il prototype Broker (nessuna patch
 * metodi). NESSUN `declare module '@gluezero/core'` block nel subpath augment. La DX
 * consumer è coperta da `service.setRuntimeContext(...)` (W2 P02 esposto via service
 * locator) o eventualmente `broker.setRuntimeContext(...)` se F8 microfrontends/augment
 * esponesse sugar method types — out of F10 scope scaffolding.
 *
 * @example Consumer base — Quick start
 * ```ts
 * import { createBroker } from '@gluezero/core'
 * import { microfrontendModule } from '@gluezero/microfrontends'
 * import { contextModule } from '@gluezero/context'
 *
 * const broker = createBroker({
 *   modules: [microfrontendModule(), contextModule()],
 * })
 * ```
 *
 * @example Consumer con Pattern S1 augment opt-in DX (intent signaling F10)
 * ```ts
 * import { createBroker } from '@gluezero/core'
 * import { microfrontendModule } from '@gluezero/microfrontends'
 * import { contextModule } from '@gluezero/context'
 * import '@gluezero/microfrontends/augment' // F8 — espone broker.loadMicroFrontend(id), etc.
 * import '@gluezero/context/augment'        // F10 — intent signaling puro (no DX surface)
 *
 * const broker = createBroker({
 *   modules: [microfrontendModule(), contextModule()],
 * })
 * ```
 *
 * @throws `Error` se `@gluezero/microfrontends` non è installato prima (consumer deve
 *   aggiungere `microfrontendModule()` PRIMA di `contextModule()` nell'array modules).
 *
 * @see PRD §18 (Runtime Context), §6.4 (Pattern S1)
 * @see D-V2-F10-17 (augment side-effect stretto), D-V2-F10-18 (factory no-args)
 */
export function contextModule(): BrokerModule {
  return {
    id: 'context',
    version: '2.0.0-alpha.0',
    install(ctx): void {
      const service = ctx.broker.getService<MicroFrontendsService>(SERVICE_MICROFRONTENDS)
      if (!service) {
        throw new Error(
          '@gluezero/context requires @gluezero/microfrontends to be installed first. ' +
            'Add microfrontendModule() before contextModule() in the modules array.',
        )
      }
      // W2 P02: init runtime context broker reference (storage state già module-level).
      initRuntimeContext(ctx.broker)
      // W2 P04 aggiungerà: wireLifecycleHooks(ctx.broker, service, contextService) per
      // ctx.context auto-injection LIVE + per-MF MapperEngine Map<mfId, MapperEngine>.
    },
  }
}
