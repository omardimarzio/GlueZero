/**
 * `Object.is` top-level shallow equality check (~50ns/call).
 *
 * Usato da `selector.ts dispatchSelectors` come gate per evitare cascade re-render
 * (P-17 mitigation D-V2-F10-02). Listener NON invocato se `shallowEqual(prevSlice, currentSlice)`.
 *
 * **Semantica:**
 * - `Object.is(a, b)` short-circuit return `true` (gestisce NaN, -0/+0, ref identity).
 * - Se uno dei due non è oggetto o è null → `false`.
 * - Confronta `Object.keys(a).length === Object.keys(b).length` + `Object.is` per ogni
 *   key top-level del primo argomento.
 *
 * **Non-goals (esplicitamente fuori scope D-V2-F10-02):**
 * - NO deep equal (bundle ban + anti-pattern stack ban list).
 * - NO auto-freeze (perf overhead).
 * - NO array special case (slice è plain object da selector function o keys-array helper).
 *
 * Costo: O(n) dove n = numero chiavi top-level del returned slice.
 *
 * @param a Primo valore.
 * @param b Secondo valore.
 * @returns `true` se shallow-equal top-level, `false` altrimenti.
 *
 * @example
 * ```ts
 * shallowEqual({ user: u, tenant: 't' }, { user: u, tenant: 't' })   // true (stesso ref user)
 * shallowEqual({ user: u1 }, { user: u2 })                            // false (diff ref user)
 * shallowEqual({ a: NaN }, { a: NaN })                                // true (Object.is)
 * shallowEqual(null, undefined)                                       // false
 * shallowEqual('a', 'a')                                              // true (primitives Object.is)
 * shallowEqual({ a: 1 }, { a: 1, b: 2 })                              // false (length keys diversa)
 * ```
 *
 * @see D-V2-F10-02 (equality gate Object.is top-level)
 * @see P-17 mitigation (context update flood / cascade re-render)
 */
export function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || a === null) return false
  if (typeof b !== 'object' || b === null) return false
  const aKeys = Object.keys(a as Record<string, unknown>)
  const bKeys = Object.keys(b as Record<string, unknown>)
  if (aKeys.length !== bKeys.length) return false
  for (const k of aKeys) {
    if (
      !Object.is(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k],
      )
    ) {
      return false
    }
  }
  return true
}
