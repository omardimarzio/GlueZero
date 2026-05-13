/**
 * F12 Enforcement points — service-wrap monkey-patch su `register/load/mount`
 * (OQ-1 carryover F11 + scope esteso 3 metodi).
 *
 * Cover REQ-IDs: MF-COMPAT-02 (10 enforcement points service install) +
 * MF-COMPAT-04 (5 policy dispatch wired into 3 lifecycle trigger points).
 *
 * ## OQ-1 RESOLUTION (HIGH)
 *
 * F8 NON espone hook API `pre-register` / `pre-load` / `pre-mount` (verified
 * `packages/microfrontends/src/registry.ts:83-104` interface
 * `MicroFrontendsService` — i metodi tornano `Promise<void>` e sono terminali).
 * Quindi service-wrap monkey-patch è l'UNICO path per implementare il timing
 * "compat check PRIMA dell'invocazione originale" richiesto da `block-*` policies.
 *
 * Pattern carryover F11 `wrapServiceWithPermissions`
 * (`packages/permissions/src/enforcement-points.ts:197-233`) — stesso meccanismo,
 * marker idempotente `__compatServicePatched` (NON `__permissionsServicePatched`
 * — wrap concatenazione naturale con F11 senza conflict).
 *
 * **Scope esteso F12 vs F11:**
 * - F11 patches: `bootstrap`, `mount`, `unmount`, `destroy` (4 methods).
 * - F12 patches: `register`, `load`, `mount` (3 methods; intersezione con F11 = `mount`).
 *
 * Sul metodo `mount` (intersezione), i 2 wrap si concatenano naturalmente:
 * - install order `[microfrontendModule(), permissionsModule(), compatModule()]`
 * - F12 patcha PER ULTIMO → F12 wrap è layer ESTERNO.
 * - Call `mfService.mount(id)`:
 *   1. F12 wrap eseguito: compat check → throw `COMPAT_INCOMPATIBLE` se policy=block-mount + report fail.
 *   2. Se F12 OK: invoca `originalFn` (che è il wrap F11): permission check.
 *   3. Se F11 OK: invoca original mount registry FSM (transitions).
 *
 * ## OQ-2 RESOLUTION (HIGH) — Ordering F11+F12
 *
 * Documentato qui per cross-fase reference: l'ordering dipende da install order
 * host-controlled in `createBroker({ modules: [...] })`. La SEMANTICA documentata
 * è che F12 (compat) viene eseguito PRIMA di F11 (permission) sul metodo `mount`,
 * perché "incompatibilità categorica" precede "permission denial" come tipologia
 * di blocco — un MF incompatibile non dovrebbe nemmeno essere considerato per
 * permission resolution. Cross-fase test SC5 in plan 12-05 verifica empiricamente
 * tale comportamento.
 *
 * ## Idempotency
 *
 * Marker `__compatServicePatched` (non-enumerable + non-writable + non-configurable)
 * previene double-wrap se `compatModule` viene installato 2 volte (es. test setup,
 * multi-broker). Carryover F11 D-V2-F11-XX strict + Object.defineProperty config=false.
 *
 * @see prd_2.0.0.md §20.6 — 5 policy + 3 phase dispatch
 * @see D-12-03 — block-registration sync throw on register
 * @see D-12-04 — phase trigger matrix
 * @see packages/permissions/src/enforcement-points.ts:158-233 (TEMPLATE F11)
 * @see plan 12-03 Task 1
 */
import type { Broker } from '@gluezero/core'
import type { MicroFrontendDescriptor, MicroFrontendsService } from '@gluezero/microfrontends'
import type { CheckEngine } from './check-engine'
import type { CompatibilityPhase } from './compat-error'
import { enforceCompatPolicy } from './policy-dispatch'
import { getCompatibility } from './types/descriptor-augment'
import type { CompatibilityPolicy } from './types/policy'

/**
 * Shape interna patched per audit marker. NON public API surface.
 *
 * Il marker `__compatServicePatched` è non-enumerable + non-writable +
 * non-configurable per audit-grep clean (NON apparirà in `Object.keys` o
 * `JSON.stringify`) e tampering-resistant.
 *
 * Disjoint dal F11 marker `__permissionsServicePatched` — coesistenza naturale
 * (i 2 markers + 2 wrap layers possono essere applicati allo stesso service
 * senza conflitto).
 *
 * @internal
 */
type PatchableService = MicroFrontendsService & {
  readonly __compatServicePatched?: true
}

/**
 * Applica audit marker `__compatServicePatched` al service F8 + monkey-patcha
 * i metodi lifecycle `register/load/mount` con wrapper che esegue
 * `enforceCompatPolicy` PRIMA dell'invocazione `originalFn`.
 *
 * **Per ciascun metodo:**
 * - `register` (`args[0] = descriptor`): estrae `descriptor.compatibility` direttamente
 *   dai params, esegue check + dispatch policy con `phase='registration'`. D-12-03 sync throw.
 * - `load` (`args[0] = mfId`): lookup descriptor via `mfService.get(mfId)`, estrae
 *   `descriptor.compatibility`, dispatch con `phase='load'`. OQ-3 funzionale F12.
 * - `mount` (`args[0] = mfId`): lookup descriptor via `mfService.get(mfId)`, dispatch con `phase='mount'`.
 *
 * Se descriptor mancante o senza `compatibility?` → skip silenzioso, invoca `originalFn`.
 *
 * Throw propagato via async function rejection (D-12-03 sync throw nel wrapper si
 * traduce in Promise rejection per i 3 metodi che ritornano `Promise<void>`).
 *
 * **Idempotent** via marker check: chiamata 2x con stesso service NON re-patcha
 * (i wrapper referenze restano identiche — `firstPatch === secondPatch`).
 *
 * **Audit-grep clean**: il marker NON appare in `Object.keys(mfService)` o in
 * `JSON.stringify(mfService)` (non-enumerable).
 *
 * **Tampering-resistant**: `writable:false + configurable:false` — un MF
 * malevolo NON può `delete service.__compatServicePatched` (T-12-W3-01 mitigation).
 *
 * @param mfService Service `@gluezero/microfrontends` da `broker.getService(SERVICE_MICROFRONTENDS)`.
 * @param engine CheckEngine creato da `createCheckEngine(...)` (W2) — invocato `computeReport(mfId, caps)`.
 * @param broker Broker reference per emit topic governance via `enforceCompatPolicy`.
 * @param installPolicy Policy di install-time (D-12-11 minimal single option).
 *
 * @example Audit-grep idempotent marker
 * ```sh
 * grep "__compatServicePatched" packages/compat/dist/index.js
 * # expect ≥1 match (set + check sites)
 * ```
 *
 * @example Verifica idempotente
 * ```typescript
 * wrapServiceWithCompat(mfService, engine, broker, 'block-mount')
 * const firstMount = mfService.mount
 * wrapServiceWithCompat(mfService, engine, broker, 'block-mount') // no-op
 * mfService.mount === firstMount // true
 * ```
 *
 * @example Throw COMPAT_INCOMPATIBLE su register block
 * ```typescript
 * wrapServiceWithCompat(mfService, engine, broker, 'block-registration')
 * await mfService.register({ id: 'x', compatibility: { gluezero: '^999.0.0' } })
 * // → Promise rejection con BrokerError code='COMPAT_INCOMPATIBLE' phase='registration'
 * ```
 *
 * @see OQ-1 carryover F11 service-wrap pattern (extended scope F12)
 * @see OQ-2 ordering F11+F12 (documentation cross-ref in module JSDoc above)
 */
export function wrapServiceWithCompat(
  mfService: MicroFrontendsService,
  engine: CheckEngine,
  broker: Broker,
  installPolicy: CompatibilityPolicy,
): void {
  const tagged = mfService as PatchableService
  if (tagged.__compatServicePatched) return // idempotent guard carryover F11

  Object.defineProperty(tagged, '__compatServicePatched', {
    value: true,
    writable: false,
    enumerable: false,
    configurable: false,
  })

  // F12-specific: register/load/mount (NOT bootstrap/mount/unmount/destroy F11).
  // Coppia (method, phase) per il dispatch policy del wrapper.
  const lifecycleMethods: ReadonlyArray<readonly [string, CompatibilityPhase]> = [
    ['register', 'registration'],
    ['load', 'load'],
    ['mount', 'mount'],
  ]

  for (const [method, phase] of lifecycleMethods) {
    const original = (tagged as unknown as Record<string, unknown>)[method]
    if (typeof original !== 'function') continue
    const originalFn = (original as (...args: unknown[]) => unknown).bind(tagged)

    Object.defineProperty(tagged, method, {
      // `async` keyword: il throw sync di `enforceCompatPolicy` viene convertito
      // in Promise rejection (consumer pattern `await mf.register(...)` vede
      // rejection coerente con D-12-03 "Promise rejection").
      async value(...args: unknown[]): Promise<unknown> {
        // Estrai descriptor in base al metodo:
        // - register: args[0] = descriptor (oggetto inline).
        // - load/mount: args[0] = mfId (string) → lookup via mfService.get(mfId).descriptor.
        const descriptor: MicroFrontendDescriptor | undefined =
          method === 'register'
            ? (args[0] as MicroFrontendDescriptor | undefined)
            : mfService.get(args[0] as string)?.descriptor

        if (descriptor) {
          const caps = getCompatibility(descriptor)
          if (caps) {
            // computeReport invocato sempre (D-12-12 memoization preserved).
            const report = engine.computeReport(descriptor.id, caps)
            // enforceCompatPolicy emit topic governance + throw se blocking match phase ↔ policy.
            // Il throw sync nell'async wrapper si traduce in Promise rejection nativamente.
            enforceCompatPolicy(broker, descriptor.id, report, installPolicy, phase)
          }
        }
        return originalFn(...args)
      },
      writable: true,
      configurable: true,
    })
  }
}
