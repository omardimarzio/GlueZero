/**
 * `mfEsmModule()` factory — `BrokerModule` opt-in per `@gluezero/mf-esm` (D-V2-F9-01, D-V2-F9-04).
 *
 * Install pattern LOOKUP service (D-V2-F9-01):
 * - F8 `microfrontendModule()` CREATE service via `createMicroFrontendsService(ctx)`.
 * - F9 `mfEsmModule()` LOOKUP service via `ctx.broker.getService<MicroFrontendsService>(SERVICE_MICROFRONTENDS)`
 *   e chiama `service.registerLoader(esmLoader)`.
 *
 * Pre-requisito ordering: il consumer DEVE installare `microfrontendModule()` PRIMA
 * di `mfEsmModule()` nell'array `modules: []` del `createBroker({})`. Se il service
 * non è registrato → throw `Error` esplicativo (T-F9-10 mitigation).
 *
 * Duplicate handling (D-V2-F9-03): `service.registerLoader` delega a
 * `LoaderRegistry.register` (F8 OQ-15 lockato) — throw `MF_LOADER_TYPE_DUPLICATE`
 * se un loader con `type: 'esm'` è già registrato (fail-fast).
 *
 * No-args lockato (D-V2-F9-04): factory NO-args. Defaults da PRD §23.4 baked-in
 * nel loader (`DEFAULT_TIMEOUT_MS = 15000`, `exportName: undefined`). Override
 * per-MF via `descriptor.loader.{ timeoutMs, exportName }`.
 *
 * Anti-singleton (D-30 carryover F1): ritorna SEMPRE nuovo `BrokerModule` ad ogni
 * call — 2 broker indipendenti possono installare `mfEsmModule()` senza shared state.
 *
 * Version: `'2.0.0-alpha.0'` (D-V2-F8-10 carryover — pre-GA, NON pubblicato su
 * npm fino a F17 GA). Divergenza da F8 `microfrontendModule().version === '2.0.0'`
 * intenzionale: F9 è il primo loader concreto v2.0 in alpha.
 *
 * @see PRD §22 (Loader Registry API), §23 (ESM loader), §6.4 (Pattern S1)
 * @see D-V2-F9-01 (install lookup), D-V2-F9-02 (NO Broker.prototype augment),
 *   D-V2-F9-03 (duplicate handling cascade), D-V2-F9-04 (no-args defaults PRD §23.4)
 */
import type { BrokerModule } from '@gluezero/core'
import { SERVICE_MICROFRONTENDS } from '@gluezero/core'
import type { MicroFrontendsService } from '@gluezero/microfrontends'
import { esmLoader } from './esm-loader'

/**
 * Factory `BrokerModule` per `@gluezero/mf-esm`.
 *
 * Install pattern lookup (D-V2-F9-01):
 * - Cerca il service `@gluezero/microfrontends` via `ctx.broker.getService(SERVICE_MICROFRONTENDS)`.
 * - Chiama `service.registerLoader(esmLoader)` (throw `MF_LOADER_TYPE_DUPLICATE` se duplicato — F8 OQ-15 lockato D-V2-F9-03).
 * - Se il service non è installato → throw `Error` con messaggio chiaro (T-F9-10 mitigation).
 *
 * No-args lockato D-V2-F9-04 — defaults da PRD §23.4 baked-in nel loader (`timeoutMs: 15000`,
 * `exportName: undefined`). Override per-MF via `descriptor.loader.{ timeoutMs, exportName }`.
 *
 * Anti-singleton lockato D-30 carryover F1 — ritorna nuovo `BrokerModule` ad ogni call.
 *
 * NB: D-V2-F9-02 lockato — il modulo NON estende il prototype Broker (nessuna
 * patch metodi come F8). La DX consumer è già coperta da `service.load(id)`
 * o `broker.loadMicroFrontend(id)` (esposti da `@gluezero/microfrontends/augment`).
 *
 * @example Consumer base
 * ```ts
 * import { createBroker } from '@gluezero/core'
 * import { microfrontendModule } from '@gluezero/microfrontends'
 * import { mfEsmModule } from '@gluezero/mf-esm'
 *
 * const broker = createBroker({
 *   modules: [microfrontendModule(), mfEsmModule()],
 * })
 * ```
 *
 * @example Consumer con Pattern S1 augment opt-in DX
 * ```ts
 * import { createBroker } from '@gluezero/core'
 * import { microfrontendModule } from '@gluezero/microfrontends'
 * import { mfEsmModule } from '@gluezero/mf-esm'
 * import '@gluezero/microfrontends/augment' // F8 — espone broker.loadMicroFrontend(id), etc.
 * import '@gluezero/mf-esm/augment'         // F9 — intent signaling puro (no DX surface)
 *
 * const broker = createBroker({
 *   modules: [microfrontendModule(), mfEsmModule()],
 * })
 * await broker.registerMicroFrontend!({
 *   id: 'dashboard',
 *   name: 'Customer Dashboard',
 *   version: '1.0.0',
 *   loader: { type: 'esm', url: '/mfs/dashboard.js' },
 * })
 * await broker.loadMicroFrontend!('dashboard')
 * ```
 *
 * @throws `Error` se `@gluezero/microfrontends` non è installato prima (consumer deve
 *   aggiungere `microfrontendModule()` PRIMA di `mfEsmModule()` nell'array modules).
 * @throws `BrokerError` con `code: 'MF_LOADER_TYPE_DUPLICATE'` se un loader con
 *   `type: 'esm'` è già registrato (F8 OQ-15 lockato — cascade D-V2-F9-03).
 *
 * @see PRD §22 (Loader Registry API), §23 (ESM loader)
 * @see D-V2-F9-01 (install lookup), D-V2-F9-03 (duplicate handling),
 *   D-V2-F9-04 (no-args defaults), D-V2-F9-02 (NO Broker.prototype augment)
 */
export function mfEsmModule(): BrokerModule {
  return {
    id: 'mf-esm',
    version: '2.0.0-alpha.0',
    install(ctx): void {
      const service = ctx.broker.getService<MicroFrontendsService>(SERVICE_MICROFRONTENDS)
      if (!service) {
        throw new Error(
          '@gluezero/mf-esm requires @gluezero/microfrontends to be installed first. ' +
            'Add microfrontendModule() before mfEsmModule() in the modules array.',
        )
      }
      // D-V2-F9-03 cascade — service.registerLoader delega a LoaderRegistry.register
      // che throw MF_LOADER_TYPE_DUPLICATE se type='esm' già registrato (F8 OQ-15).
      service.registerLoader(esmLoader)
    },
  }
}
