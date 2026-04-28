// DeepReadonly<T> — utility ricorsiva che propaga `readonly` su tutti i livelli.
//
// Riferimento decisione D-07 (CONTEXT 01): branded immutable types — il payload type
// pubblicato come `Readonly<TPayload>` deep tramite questa utility.
//
// Comportamento:
// - `Date | RegExp | Error` sono passthrough (non-recursive) — sono "primitive object" che
//   il consumer si aspetta di poter usare con la propria API senza wrapper readonly.
// - `Map` / `Set` diventano varianti `Readonly*` con chiavi/valori ricorsivamente readonly.
// - `Array<T>` diventa `ReadonlyArray<DeepReadonly<T>>`.
// - `object` (qualsiasi record) diventa `{ readonly [K]: DeepReadonly<T[K]> }`.
// - Primitivi (`string | number | boolean | bigint | symbol | null | undefined`) restano `T`.

/**
 * Recursive `readonly` utility (D-07). Used by `BrokerEvent.payload` to enforce
 * compile-time immutability on consumers.
 *
 * Behavior:
 * - `Date | RegExp | Error` are passthrough (non-recursive).
 * - `Map` / `Set` become `ReadonlyMap` / `ReadonlySet` with deep-readonly entries.
 * - `Array<T>` becomes `ReadonlyArray<DeepReadonly<T>>`.
 * - Object records become `{ readonly [K]: DeepReadonly<T[K]> }`.
 * - Primitives stay `T`.
 *
 * @typeParam T - Source type.
 */
export type DeepReadonly<T> = T extends Date | RegExp | Error
  ? T
  : T extends Map<infer K, infer V>
    ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
    : T extends Set<infer U>
      ? ReadonlySet<DeepReadonly<U>>
      : T extends Array<infer U>
        ? readonly DeepReadonly<U>[]
        : T extends object
          ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
          : T
