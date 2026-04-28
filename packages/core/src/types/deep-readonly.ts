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

export type DeepReadonly<T> = T extends Date | RegExp | Error
  ? T
  : T extends Map<infer K, infer V>
    ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
    : T extends Set<infer U>
      ? ReadonlySet<DeepReadonly<U>>
      : T extends Array<infer U>
        ? ReadonlyArray<DeepReadonly<U>>
        : T extends object
          ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
          : T
