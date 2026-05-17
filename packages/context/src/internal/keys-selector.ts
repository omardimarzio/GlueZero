/**
 * keys-array → auto `Pick<RuntimeContext, K>` shallow selector helper (D-V2-F10-01).
 *
 * Usato internamente da `selector.ts` per implementare overload TS Sig 2 (keys-array).
 * Costruisce una closure che ritorna `Pick<RuntimeContext, K>` consentendo allo shallow
 * gate top-level di funzionare in modo naturale (chiavi del Pick = chiavi del subset).
 *
 * NON esposto dal barrel `packages/context/src/index.ts` (D-V2-F9-11 internal helpers).
 *
 * @example
 * ```ts
 * const sel = buildKeysSelector(['user', 'tenantId'] as const)
 * sel({ user: u, tenantId: 't', locale: 'en' })  // → { user: u, tenantId: 't' }
 * ```
 *
 * @see D-V2-F10-01 (selector signature overload TS)
 * @internal
 */
import type { RuntimeContext } from '../types/runtime-context'

/**
 * Builda una closure selector keys-array → Pick<RuntimeContext, K>.
 *
 * Costo: O(n) per ogni invocazione della closure dove n = `keys.length`.
 *
 * @param keys Array readonly di chiavi `keyof RuntimeContext`. Tipicamente passato come
 *   `['user', 'tenantId'] as const` dal consumer.
 * @returns Closure `(ctx) => Pick<RuntimeContext, K>` che proietta `ctx` sulle sole chiavi.
 *
 * @example
 * ```ts
 * const sel = buildKeysSelector(['user', 'tenantId'] as const)
 * sel({ user: { id: 'u1' }, tenantId: 'T1', locale: 'it' })
 * // → { user: { id: 'u1' }, tenantId: 'T1' }
 * ```
 */
export function buildKeysSelector<K extends keyof RuntimeContext>(
  keys: ReadonlyArray<K>,
): (ctx: Readonly<RuntimeContext>) => Pick<RuntimeContext, K> {
  return (ctx) => {
    const out = {} as { [P in K]: RuntimeContext[P] }
    for (const k of keys) {
      out[k] = ctx[k] as RuntimeContext[K]
    }
    return out as Pick<RuntimeContext, K>
  }
}
