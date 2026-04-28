// Deep-freeze runtime ricorsivo del payload (PRD §22, decisioni D-04, D-05).
//
// Pattern Object.freeze() ricorsivo, attivato di default in dev mode (debug: true).
// In production il freeze è skippato per performance, ma il contratto type-level
// `DeepReadonly<TPayload>` resta enforced compile-time.
//
// Cycle protection via WeakSet — gestisce `obj.self = obj` senza stack overflow.
// Skip se già frozen — perf hot path (idempotent + retorna velocemente per re-freeze).
//
// Opt-out per Date (D-05: freezable ma non immutabile, default skip),
// Promise (default skip — freeze rompe risoluzione), TypedArray (default skip —
// freeze rompe iterazione interna), Map/Set (default freeze ricorsivo su chiavi/valori).
//
// Errori in strict mode JS: `Object.freeze` + assignment dopo throw `TypeError`
// — testato nel test 9 (mutation post-freeze).

const FROZEN = new WeakSet<object>()

export interface DeepFreezeOptions {
  skipDates?: boolean
  skipMaps?: boolean
  skipSets?: boolean
  skipPromises?: boolean
  skipTypedArrays?: boolean
}

type ResolvedOptions = Required<DeepFreezeOptions>

export function deepFreeze<T>(value: T, options: DeepFreezeOptions = {}): T {
  const opts: ResolvedOptions = {
    skipDates: options.skipDates ?? true,
    skipMaps: options.skipMaps ?? false,
    skipSets: options.skipSets ?? false,
    skipPromises: options.skipPromises ?? true,
    skipTypedArrays: options.skipTypedArrays ?? true,
  }
  freezeRecursive(value, opts)
  return value
}

function freezeRecursive(value: unknown, opts: ResolvedOptions): void {
  if (value === null || value === undefined) return
  if (typeof value !== 'object') return
  if (FROZEN.has(value as object)) return
  if (Object.isFrozen(value)) return

  if (value instanceof Date) {
    if (!opts.skipDates) Object.freeze(value)
    return
  }
  if (value instanceof Promise) {
    if (!opts.skipPromises) Object.freeze(value)
    return
  }
  if (ArrayBuffer.isView(value)) {
    // TypedArray views: freeze rompe iterazione interna del buffer (D-05).
    // Skippiamo sempre — l'opzione skipTypedArrays è esplicita per documentare
    // l'intento, ma il body è no-op anche con skipTypedArrays: false.
    return
  }
  if (value instanceof Map) {
    if (!opts.skipMaps) {
      for (const [k, v] of value) {
        freezeRecursive(k, opts)
        freezeRecursive(v, opts)
      }
      Object.freeze(value)
    }
    return
  }
  if (value instanceof Set) {
    if (!opts.skipSets) {
      for (const v of value) freezeRecursive(v, opts)
      Object.freeze(value)
    }
    return
  }

  FROZEN.add(value as object)
  Object.freeze(value)
  for (const key of Object.getOwnPropertyNames(value)) {
    freezeRecursive((value as Record<string, unknown>)[key], opts)
  }
}
