/**
 * `isolationModule()` factory — `BrokerModule` opt-in per `@gluezero/isolation`
 * (D-V2-F13-01 scaffolding + D-V2-F13-04-AMENDED 2-opt + D-V2-F13-21 Service Locator).
 *
 * ## AMENDMENT D-V2-F13-04-AMENDED (OQ-6 ratificato)
 *
 * Factory expands 1-opt → 2-opt `{policyDefault?, resolvers?}` poiché Service Locator
 * F8 NON espone `SERVICE_GATEWAY` / `SERVICE_WORKER` / `SERVICE_THEME` (i package
 * v1.0/v1.1 NON si auto-registrano via `BrokerModule.install`). Resolver pattern
 * obbligatorio per facade lazy lookup host-provided. Coerente F11 2-opt factory
 * D-V2-F11-18 deliberata divergenza ratificata.
 *
 * ## Pattern install — Service Locator F8 LOOKUP (W2 implementation)
 *
 * Replica il pattern F11 `permissionsModule()` install:
 *
 * 1. Lookup `SERVICE_MICROFRONTENDS` via `ctx.broker.getService(...)`. Se assente
 *    → throw `Error` esplicativo (`@gluezero/isolation requires @gluezero/microfrontends`).
 * 2. Construct `IsolationEngine` (W2 P02 — policy resolver) + `IsolationContextChain`
 *    (W2 P03 — wrap-context facade injection).
 * 3. Costruisce `IsolationService` API (getResolvedPolicy + scopeCss + future runtime mutation).
 * 4. Registra `SERVICE_ISOLATION` via `ctx.registerService(...)` (D-V2-F13-21).
 * 5. Subscribe lifecycle hooks (`microfrontend.registered` + `microfrontend.mounting` +
 *    `microfrontend.unmounting`) per applicare DOM/CSS/storage isolation.
 * 6. Idempotent install warning su re-install (carryover F11 D-V2-F11-XX).
 *
 * ## W1 stub (questo file)
 *
 * Ritorna `BrokerModule` con `install(ctx)` no-op body. W2 P03 implementa la real
 * logic (lookup + service construction + lifecycle subscribe + wrap-context).
 *
 * ## Anti-singleton D-30 (carryover F1 + F11)
 *
 * Ogni call ritorna NUOVO `BrokerModule`. Supporta scenario 2-broker indipendenti
 * con isolation engine separati.
 *
 * @see prd_2.0.0.md §21 — Isolation module
 * @see D-V2-F13-04-AMENDED — Factory 2-opt resolver pattern
 * @see D-V2-F13-21 — Service Locator install pattern
 * @see packages/permissions/src/permissions-module.ts (F11 reference template)
 */
import type { BrokerModule } from '@gluezero/core'
import type { MicroFrontendIsolationPolicy } from './types/policy.js'
import type { IsolationResolvers } from './types/facades.js'

/**
 * Setup-time options per `isolationModule()` (AMENDMENT D-V2-F13-04-AMENDED).
 *
 * Defaults applicati al call site:
 * - `policyDefault?`: undefined (resolver usa `DEFAULT_ISOLATION_POLICY` baseline PRD §21.3).
 * - `resolvers?`: undefined (tutti i facade undefined; ctx.gateway/worker/theme/storage
 *   = undefined a runtime per i MF che richiedono questi facade — warning emit).
 *
 * @example Setup minimale (defaults baseline)
 * ```ts
 * isolationModule()
 * ```
 *
 * @example Setup production (policy stretta + 3 resolvers)
 * ```ts
 * isolationModule({
 *   policyDefault: { dom: 'shadow-dom', css: 'shadow-dom', storage: 'namespaced' },
 *   resolvers: {
 *     gateway: () => gatewayService,
 *     worker:  () => workerService,
 *     theme:   () => themeService,
 *   },
 * })
 * ```
 */
export interface IsolationModuleOptions {
  readonly policyDefault?: Partial<MicroFrontendIsolationPolicy>
  readonly resolvers?: IsolationResolvers
}

/**
 * Factory `BrokerModule` per `@gluezero/isolation`.
 *
 * @param options Setup-time options (defaults: policyDefault=undefined, resolvers=undefined).
 * @returns Nuovo `BrokerModule` con `install` no-op W1 (W2 P03 implementa real logic).
 *
 * @throws `Error` se `@gluezero/microfrontends` NON installato PRIMA (W2 P03 — W1 stub no-op).
 *
 * @example Install chain F13 completa
 * ```ts
 * import { createBroker } from '@gluezero/core'
 * import { microfrontendModule } from '@gluezero/microfrontends'
 * import { contextModule } from '@gluezero/context'
 * import { permissionsModule } from '@gluezero/permissions'
 * import { isolationModule } from '@gluezero/isolation'
 *
 * const broker = createBroker({
 *   modules: [
 *     microfrontendModule(),
 *     contextModule(),
 *     permissionsModule(),
 *     isolationModule({
 *       policyDefault: { dom: 'shadow-dom', css: 'shadow-dom' },
 *       resolvers: {
 *         gateway: () => gatewayService,
 *         worker:  () => workerService,
 *         theme:   () => themeService,
 *       },
 *     }),
 *   ],
 * })
 * ```
 *
 * @example Anti-singleton — 2 broker indipendenti
 * ```ts
 * const broker1 = createBroker({ modules: [microfrontendModule(), isolationModule()] })
 * const broker2 = createBroker({ modules: [microfrontendModule(), isolationModule()] })
 * // isolation engine separati con state isolato.
 * ```
 *
 * @see D-V2-F13-04-AMENDED — 2-opt resolver factory ratificato
 * @see ROADMAP linea XXX — MF-PIPE-01 cross-fase obligation (Tap composition esterna W2)
 */
export function isolationModule(_options: IsolationModuleOptions = {}): BrokerModule {
  return {
    id: 'isolation',
    version: '2.0.0-alpha.0',
    install(_ctx): void {
      // W1 STUB no-op — W2 P03 implementa real logic:
      //
      //  1. Lookup SERVICE_MICROFRONTENDS:
      //     const mfService = ctx.broker.getService<MicroFrontendsService>(SERVICE_MICROFRONTENDS)
      //     if (!mfService) throw new Error('@gluezero/isolation requires @gluezero/microfrontends')
      //
      //  2. Construct isolation engine + context chain:
      //     const engine = createIsolationEngine(options.policyDefault)
      //     const contextChain = createIsolationContextChain(engine, options.resolvers)
      //
      //  3. Register IsolationService:
      //     ctx.registerService(SERVICE_ISOLATION, {
      //       getResolvedPolicy: engine.resolve,
      //       scopeCss: scopeCss,
      //     })
      //
      //  4. Subscribe lifecycle hooks (4 topics F8):
      //     - microfrontend.registered → engine.resolve(descriptor) + cache
      //     - microfrontend.mounting   → applyDom/Css/Storage isolation
      //     - microfrontend.unmounting → cleanup shadow root + storage namespace
      //     - microfrontend.unregistered → invalidate engine cache
      //
      //  5. Register wrap-context chain:
      //     ctx.broker.publishInterceptors? — D-V2-F13-XX wrap-context propagation
      //
      //  6. Idempotent re-install warning:
      //     if (ctx.broker.getService(SERVICE_ISOLATION)) ctx.logger.warn(...)
    },
  }
}
