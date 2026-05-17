/**
 * `microfrontendModule()` factory — `BrokerModule` opt-in (MF-MOD-05, D-V2-01).
 *
 * Install loop:
 * 1. Crea `MicroFrontendsService` (vedi `./registry`)
 * 2. Registra il service via `ctx.registerService(SERVICE_MICROFRONTENDS, service)`
 * 3. Pattern S1 sugar: monkey-patch della `Broker` instance host con 10 metodi
 *    convenience (`registerMicroFrontend`/`unregisterMicroFrontend`/...) — opt-in
 *    attivato a livello TS da `import '@gluezero/microfrontends/augment'` consumer-side.
 *
 * D-30 anti-singleton: factory ritorna SEMPRE nuovo `BrokerModule` instance.
 * T-F8-01: monkey-patch è scoped alla Broker instance (NON Broker.prototype global)
 * — consumer v1.x senza modules ha zero patch applicato.
 *
 * @see RESEARCH §9 + PATTERNS §23 + PRD §6.1
 */
import type { Broker, BrokerModule } from '@gluezero/core'
import { SERVICE_MICROFRONTENDS } from '@gluezero/core'
import { createMicroFrontendsService, type MicroFrontendsService } from './registry'

/**
 * Factory `BrokerModule` per `@gluezero/microfrontends`.
 *
 * @example
 * ```ts
 * import { createBroker, SERVICE_MICROFRONTENDS } from '@gluezero/core'
 * import { microfrontendModule } from '@gluezero/microfrontends'
 * import type { MicroFrontendsService } from '@gluezero/microfrontends'
 *
 * const broker = createBroker({ modules: [microfrontendModule()] })
 *
 * // Variante A — service locator typed
 * const mf = broker.getService<MicroFrontendsService>(SERVICE_MICROFRONTENDS)!
 * await mf.register(descriptor)
 *
 * // Variante B — Pattern S1 augment (richiede side-effect import)
 * import '@gluezero/microfrontends/augment'
 * await broker.registerMicroFrontend!(descriptor)
 * ```
 */
export function microfrontendModule(): BrokerModule {
  return {
    id: 'microfrontends',
    version: '2.0.0',
    install(ctx): void {
      const service = createMicroFrontendsService(ctx)
      ctx.registerService(SERVICE_MICROFRONTENDS, service)
      patchBrokerMethods(ctx.broker, service)
    },
  }
}

/**
 * Monkey-patch dei 10 metodi sugar sulla Broker instance host (Pattern S1 D-V2-01).
 *
 * I metodi sono dichiarati `?` optional in `augment.ts` (declaration merging) per
 * gracefully degrade quando il modulo non è installato (TS narrows `undefined`).
 *
 * T-F8-01 mitigation: il patch è scoped alla singola instance ricevuta da
 * `ctx.broker` (non `Broker.prototype` global). Consumer v1.x senza modules:
 * zero patch applicato → bit-exact v1.x runtime.
 */
/**
 * Shape esplicita del Broker post-patch (10 metodi sugar) — usato come cast target
 * per soddisfare sia `noPropertyAccessFromIndexSignature: true` (TS) che
 * `lint/complexity/useLiteralKeys` (Biome) che richiederebbero altrimenti
 * bracket notation vs dot notation in conflitto reciproco.
 */
interface BrokerWithMfSugar {
  registerMicroFrontend: MicroFrontendsService['register']
  unregisterMicroFrontend: MicroFrontendsService['unregister']
  getMicroFrontend: MicroFrontendsService['get']
  getMicroFrontends: MicroFrontendsService['list']
  getMicroFrontendState: MicroFrontendsService['getState']
  getMicroFrontendSnapshot: MicroFrontendsService['getSnapshot']
  loadMicroFrontend: MicroFrontendsService['load']
  mountMicroFrontend: MicroFrontendsService['mount']
  unmountMicroFrontend: MicroFrontendsService['unmount']
  destroyMicroFrontend: MicroFrontendsService['destroy']
}

function patchBrokerMethods(broker: Broker, service: MicroFrontendsService): void {
  const b = broker as unknown as BrokerWithMfSugar
  b.registerMicroFrontend = service.register.bind(service)
  b.unregisterMicroFrontend = service.unregister.bind(service)
  b.getMicroFrontend = service.get.bind(service)
  b.getMicroFrontends = service.list.bind(service)
  b.getMicroFrontendState = service.getState.bind(service)
  b.getMicroFrontendSnapshot = service.getSnapshot.bind(service)
  b.loadMicroFrontend = service.load.bind(service)
  b.mountMicroFrontend = service.mount.bind(service)
  b.unmountMicroFrontend = service.unmount.bind(service)
  b.destroyMicroFrontend = service.destroy.bind(service)
}
