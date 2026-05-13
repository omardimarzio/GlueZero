/**
 * `lifecycle-register-hook.ts` — Eager resolution + warning emit al register
 * (D-V2-F13-03 + W2 P02 13-02 + carryover F11/F12 pattern).
 *
 * Cover REQ-IDs: MF-ISO-01 (cache eager resolution alla register) + MF-ISO-06
 * (warning matrix emit `microfrontend.isolation.warning` topic).
 *
 * ## Flusso (per ogni `microfrontend.registered` event)
 *
 *  1. `getIsolation(descriptor)` → `Partial<MicroFrontendIsolationPolicy>` | undefined.
 *  2. `resolvePolicy(declared, opts.policyDefault, mfId)` → `ResolvedIsolationPolicy`.
 *  3. `cache.set(mfId, resolved)` — espone via `IsolationService.getResolvedPolicy(mfId)`.
 *  4. `detectInconsistentCombinations(resolved, mfId)` → array warning.
 *  5. Per ogni warning:
 *     a. `broker.publish(ISOLATION_WARNING_TOPIC, warning)` SYNC (RIUSO F8 indice [3]).
 *     b. `opts.warn(message)` — default `console.warn` (test seam via injection).
 *
 * ## RESEARCH §3 — `microfrontend.registered` topic timing
 *
 * F8 NON espone topic `'beforeRegister'`/`'beforeMount'` standard. `microfrontend.registered`
 * è il primo lifecycle topic post-validation, emesso SYNC dentro `mfService.register(...)`
 * prima del return. Timing OK per eager resolution + warning emit (precede qualsiasi
 * mount-time event).
 *
 * ## OQ-1 fallback strategy (LOW)
 *
 * Se empirical W2 emerge che il topic è ASYNC (microtask gap), il warning resta emesso
 * comunque pre-mount eager (il register hook è la prima sub-chain trigger). Fallback
 * dual-subscribe `microfrontend.registered` + `microfrontend.bootstrapped` documentato
 * come deviation Rule 1 nel SUMMARY se necessario.
 *
 * ## AbortSignal cleanup cascade (D-V2-16 + carryover F11/F12)
 *
 * Quando `opts.signal` fires `abort`:
 *  - `sub.unsubscribe()` — rilascia broker subscription.
 *  - `opts.cache.clear()` — svuota la cache delle policy risolte.
 *
 * Idempotent — `{once: true}` listener garantisce single execution anche su signal
 * re-abort (no-op).
 *
 * @see prd_2.0.0.md §21.3 — Eager resolution at register
 * @see D-V2-F13-03 — Eager resolution at register pattern
 * @see D-V2-16 — Cleanup cascade abortSignal
 * @see packages/permissions/src/lifecycle-hooks.ts (F11 reference template subscribe + abortSignal)
 * @see packages/compat/src/lifecycle-hooks.ts (F12 reference template governance topic + cache)
 */
import type { MicroFrontendDescriptor } from '@gluezero/microfrontends'
import type { MicroFrontendIsolationPolicy } from './types/policy.js'
import type { PolicyCache } from './internal/policy-cache.js'
import { resolvePolicy } from './policy-resolver.js'
import { detectInconsistentCombinations } from './warning-matrix.js'
import { ISOLATION_WARNING_TOPIC } from './topics.js'
import { getIsolation } from './types/descriptor-augment.js'

/**
 * Broker subset consumato dal register hook.
 *
 * Defined inline per evitare hard dependency su `@gluezero/core` Broker type
 * (re-import surface minimale ⇒ bundle leaner). Coerente F11/F12 pattern di
 * structural typing per hook composition.
 */
export interface RegisterHookBroker {
  readonly subscribe: (
    topic: string,
    handler: (payload: unknown) => void,
  ) => { readonly unsubscribe: () => void }
  readonly publish: (topic: string, payload: unknown) => void
}

/**
 * Subset payload F8 consumato dal register hook (type narrowing locale).
 *
 * F8 publishLifecycleEvent emette `MicroFrontendRegistration` (campo `descriptor`),
 * con `id` accessibile via `registration.descriptor.id`. Defensive narrowing supporta
 * shape minima `{ descriptor: { id, ... } }`.
 *
 * @internal
 */
interface RegisteredPayload {
  readonly descriptor?: MicroFrontendDescriptor
  // Defensive fallback — alcuni publisher F8 può variare il top-level shape.
  readonly id?: string
  readonly microFrontendId?: string
}

/**
 * Opzioni per `installRegisterHook`.
 */
export interface RegisterHookOptions {
  /**
   * Policy default host-wide (factory option `isolationModule({policyDefault})`).
   * Mergiato dal resolver tra DEFAULT e declared.
   */
  readonly policyDefault?: Partial<MicroFrontendIsolationPolicy>
  /**
   * Cache `Map<mfId, ResolvedIsolationPolicy>` injected. Il hook chiama `cache.set(...)`
   * per ogni register event. Lifecycle cache gestito esternamente (creato da
   * `isolationModule().install` in W2 P03).
   */
  readonly cache: PolicyCache
  /**
   * Signal opzionale per cascade cleanup (broker shutdown).
   * Fires `abort` → `sub.unsubscribe()` + `cache.clear()`.
   */
  readonly signal?: AbortSignal
  /**
   * Console warn injection seam (test). Default: `console.warn`.
   * Riceve `IsolationWarning.message` (string).
   */
  readonly warn?: (msg: string) => void
}

/**
 * Handle ritornato da `installRegisterHook` — espone `unsubscribe()` per teardown
 * manuale (alternativa al cascade via `signal`).
 */
export interface RegisterHookHandle {
  readonly unsubscribe: () => void
}

/**
 * Estrae l'id del MF dal payload F8 registered, con fallback defensive a 3 shape
 * (descriptor.id, top-level id, microFrontendId).
 *
 * @internal
 */
function extractMfId(payload: RegisteredPayload): string | undefined {
  return payload.descriptor?.id ?? payload.id ?? payload.microFrontendId
}

/**
 * Installa il register hook subscribe a `microfrontend.registered` lifecycle topic.
 *
 * Idempotent NON enforced — caller può chiamare 2x ottenendo 2 subscription
 * indipendenti (ogni call ritorna handle distinto). `isolationModule().install`
 * fa idempotent check tramite Service Locator (W2 P03 carryover F11 pattern).
 *
 * @param broker - Broker subscribe/publish minimal interface.
 * @param opts - Configurazione (policyDefault, cache, signal, warn).
 * @returns Handle con `unsubscribe()` per teardown manuale.
 *
 * @example Standard install (W2 P03 isolationModule context)
 * ```ts
 * const cache = createPolicyCache({ signal: ctrl.signal })
 * const handle = installRegisterHook(broker, {
 *   policyDefault: { dom: 'shadow-dom' },
 *   cache,
 *   signal: ctrl.signal,
 * })
 * // Su broker.publish('microfrontend.registered', {descriptor: {id: 'mf-1', ...}})
 * // → cache.get('mf-1') popolato + eventuali warning emessi
 * ```
 *
 * @example Test injection warn seam
 * ```ts
 * const warnings: string[] = []
 * installRegisterHook(mockBroker, {
 *   cache: createPolicyCache(),
 *   warn: (msg) => warnings.push(msg),
 * })
 * ```
 */
export function installRegisterHook(
  broker: RegisterHookBroker,
  opts: RegisterHookOptions,
): RegisterHookHandle {
  const warn = opts.warn ?? ((msg: string): void => console.warn(msg))

  const sub = broker.subscribe('microfrontend.registered', (payload) => {
    const p = (payload ?? {}) as RegisteredPayload
    const mfId = extractMfId(p)
    if (!mfId) return // defensive: payload malformato

    const descriptor = p.descriptor as MicroFrontendDescriptor | undefined
    // `getIsolation` accetta `MicroFrontendDescriptor`; senza descriptor estraiamo
    // un partial vuoto (resolver applica default puri).
    const declared = descriptor ? getIsolation(descriptor) : undefined

    const resolved = resolvePolicy(declared, opts.policyDefault, mfId)
    opts.cache.set(mfId, resolved)

    const warnings = detectInconsistentCombinations(resolved, mfId)
    for (const w of warnings) {
      broker.publish(ISOLATION_WARNING_TOPIC, w)
      warn(w.message)
    }
  })

  // AbortSignal cleanup cascade — D-V2-16 carryover F11/F12.
  if (opts.signal) {
    if (opts.signal.aborted) {
      // Signal già abortito alla install — teardown immediato.
      sub.unsubscribe()
      opts.cache.clear()
    } else {
      opts.signal.addEventListener(
        'abort',
        () => {
          sub.unsubscribe()
          opts.cache.clear()
        },
        { once: true },
      )
    }
  }

  return { unsubscribe: (): void => sub.unsubscribe() }
}
