/**
 * `isolationModule()` factory — `BrokerModule` opt-in per `@gluezero/isolation`
 * (D-V2-F13-01 scaffolding + D-V2-F13-04-AMENDED 2-opt + D-V2-F13-21 Service Locator).
 *
 * W3 P05 FINAL IMPLEMENTATION (sostituisce W1 stub no-op):
 *  1. Lookup `SERVICE_MICROFRONTENDS` via `ctx.broker.getService(...)`. Se assente
 *     → throw `Error` esplicativo coerente F11 pattern.
 *  2. Idempotent guard: re-install rileva `SERVICE_ISOLATION` già registrato +
 *     console.warn + early return (D-V2-F13-21 carryover F11 pattern).
 *  3. Crea AbortController interno + `policyCache = createPolicyCache({signal})`.
 *  4. Costruisce `IsolationService` API (`getResolvedPolicy(mfId)` + `scopeCss`).
 *  5. Registra `SERVICE_ISOLATION` via `ctx.registerService(SERVICE_ISOLATION, ...)`.
 *  6. `installRegisterHook(broker, {policyDefault, cache, signal})` — P02 register
 *     hook subscribe `microfrontend.registered` + warning matrix emit.
 *  7. `installMountHook(broker, {cache, resolvers, signal})` — P03 mount hook subscribe
 *     `microfrontend.mounting` + apply chain dom→css→iframe.
 *  8. AbortSignal cleanup cascade D-V2-16: broker shutdown → ctrl.abort() (host
 *     responsabilità tramite test setup) → tutti i sub.unsubscribe + cache.clear.
 *
 * ## AMENDMENT D-V2-F13-04-AMENDED (OQ-6 ratificato)
 *
 * Factory expands 1-opt → 2-opt `{policyDefault?, resolvers?}` poiché Service Locator
 * F8 NON espone `SERVICE_GATEWAY` / `SERVICE_WORKER` / `SERVICE_THEME` (i package
 * v1.0/v1.1 NON si auto-registrano via `BrokerModule.install`). Resolver pattern
 * obbligatorio per facade lazy lookup host-provided. Coerente F11 2-opt factory
 * D-V2-F11-18 deliberata divergenza ratificata.
 *
 * ## D-V2-F13-22 STRICT SEXTUPLE esteso
 *
 * NO modifica `packages/core/src/`, `packages/microfrontends/src/`,
 * `packages/mapper/src/`, `packages/context/src/`, `packages/permissions/src/`,
 * `packages/compat/src/`. Tutte le primitive F13 sono additive in
 * `packages/isolation/src/`.
 *
 * ## Anti-singleton D-30 (carryover F1 + F11)
 *
 * Ogni call ritorna NUOVO `BrokerModule`. Supporta scenario 2-broker indipendenti
 * con isolation engine separati.
 *
 * @see prd_2.0.0.md §21 — Isolation module
 * @see D-V2-F13-04-AMENDED — Factory 2-opt resolver pattern
 * @see D-V2-F13-21 — Service Locator install pattern
 * @see D-V2-16 — Cleanup cascade abortSignal
 * @see packages/permissions/src/permissions-module.ts (F11 reference template)
 */
import type { BrokerModule } from '@gluezero/core'
import { SERVICE_ISOLATION, SERVICE_MICROFRONTENDS } from '@gluezero/core'
import type { MicroFrontendsService } from '@gluezero/microfrontends'
import type { MicroFrontendIsolationPolicy, ResolvedIsolationPolicy } from './types/policy.js'
import type { IsolationResolvers } from './types/facades.js'
import { createPolicyCache } from './internal/policy-cache.js'
import { installRegisterHook } from './lifecycle-register-hook.js'
import { installMountHook } from './lifecycle-mount-hook.js'
import { scopeCss } from './scope-css.js'
import type { IsolationService } from './service-locator.js'

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
 *
 * @see D-V2-F13-04-AMENDED — 2-opt resolver factory ratificato
 */
export interface IsolationModuleOptions {
  readonly policyDefault?: Partial<MicroFrontendIsolationPolicy>
  readonly resolvers?: IsolationResolvers
}

/**
 * Factory `BrokerModule` per `@gluezero/isolation` — W3 P05 FINAL implementation.
 *
 * @param options Setup-time options (defaults: policyDefault=undefined, resolvers=undefined).
 * @returns Nuovo `BrokerModule` con `install` che lookup `SERVICE_MICROFRONTENDS`,
 *   registra `SERVICE_ISOLATION`, subscribe lifecycle hooks register/mount, applica
 *   abortSignal cascade D-V2-16.
 *
 * @throws `Error` se `@gluezero/microfrontends` NON installato PRIMA (consumer deve
 *   aggiungere `microfrontendModule()` nell'array `modules` prima di `isolationModule()`).
 *
 * @example Install chain F13 completa con permissions (cross-fase F11+F13)
 * ```ts
 * import { createBroker } from '@gluezero/core'
 * import { microfrontendModule } from '@gluezero/microfrontends'
 * import { permissionsModule } from '@gluezero/permissions'
 * import { isolationModule } from '@gluezero/isolation'
 *
 * const broker = createBroker({
 *   modules: [
 *     microfrontendModule(),
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
 * @see D-V2-F13-21 — Service Locator install + idempotent guard
 * @see D-V2-16 — Cleanup cascade abortSignal pattern
 */
export function isolationModule(options: IsolationModuleOptions = {}): BrokerModule {
  return {
    id: 'isolation',
    version: '2.0.0-alpha.0',
    install(ctx): void {
      // 1. Lookup SERVICE_MICROFRONTENDS (peer required — fail-fast F11 pattern).
      const maybeMfService = ctx.broker.getService<MicroFrontendsService>(SERVICE_MICROFRONTENDS)
      if (!maybeMfService) {
        throw new Error(
          '@gluezero/isolation requires @gluezero/microfrontends to be installed first. ' +
            'Add microfrontendModule() before isolationModule() in the modules array.',
        )
      }

      // 2. Idempotent guard — re-install rileva SERVICE_ISOLATION già registrato.
      const existing = ctx.broker.getService<IsolationService>(SERVICE_ISOLATION)
      if (existing) {
        // biome-ignore lint/suspicious/noConsole: dev warning intentional (re-install governance)
        console.warn(
          '[@gluezero/isolation] Module already installed on broker; skipping re-install.',
        )
        return
      }

      // 3. Crea AbortController interno + policyCache cascade.
      const ctrl = new AbortController()
      const cache = createPolicyCache({ signal: ctrl.signal })

      // 4. Costruisce IsolationService API.
      const service: IsolationService = {
        getResolvedPolicy(mfId: string): ResolvedIsolationPolicy | undefined {
          return cache.get(mfId)
        },
        scopeCss,
      }

      // 5. Registra SERVICE_ISOLATION via ctx.registerService (D-V2-F13-21).
      ctx.registerService(SERVICE_ISOLATION, service)

      // 6. Install register hook P02 — subscribe `microfrontend.registered` topic.
      installRegisterHook(
        {
          subscribe: (topic, h) => ctx.broker.subscribe(topic, h),
          publish: (topic, p) => {
            ctx.broker.publish(topic, p, {
              source: {
                type: 'plugin' as const,
                id: 'isolation',
                name: '@gluezero/isolation',
              },
              deliveryMode: 'sync' as const,
            } as never)
          },
        },
        {
          ...(options.policyDefault !== undefined && { policyDefault: options.policyDefault }),
          cache,
          signal: ctrl.signal,
        },
      )

      // 7. Install mount hook P03 — subscribe `microfrontend.mounting` topic.
      installMountHook(
        {
          subscribe: (pattern, handler, opts) => {
            const sub = ctx.broker.subscribe(pattern, handler)
            if (opts?.signal) {
              opts.signal.addEventListener('abort', () => sub.unsubscribe(), { once: true })
            }
            return { unsubscribe: sub.unsubscribe }
          },
        },
        {
          cache,
          resolvers: options.resolvers ?? {},
          signal: ctrl.signal,
        },
      )

      // 8. AbortSignal cleanup cascade D-V2-16 — host invoca ctrl.abort() su shutdown
      //    (esposto come parte del service via runtime ext OR caller-managed).
      //    Per testing diretto, IsolationService espone `__abort__` via Symbol marker
      //    (NOT public API): test utility hook accede via cast.
      ;(service as unknown as { __abort__: () => void }).__abort__ = (): void => ctrl.abort()
    },
  }
}
