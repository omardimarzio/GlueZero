// assert-serializable.ts — Deep-walk validator pre-postMessage per Worker Runtime (D-139, D-140, D-142).
//
// Riferimento decisioni (05-CONTEXT.md):
// - D-139: dev-mode auto + opt-out via `BrokerConfig.workers.assertSerializable: 'always'|'dev'|'off'`.
//   Default `'dev'` → attivo se `process.env.NODE_ENV !== 'production'` o `import.meta.env.DEV`.
//   In production = zero overhead. Il check ON/OFF gating è responsabilità del consumer
//   (worker-bridge plan 05-04) — questo module è la pure validation funzione.
// - D-140: throw `BrokerError({code:'worker.serialization.failed.<sub>', category:'worker'})` PRE-postMessage,
//   con `details.fieldPath` puntante al campo colpevole (es. `'payload.options.transform'`,
//   `'list[2]'`). Il task NON viene dispatched (zero waste) — il route executor cattura,
//   publica `<topic>.failed` + `worker.error` (D-152 plan 05-06).
// - D-142: contratto serializzazione documentato in DOC-04+DOC-05 (plan 05-07 closure totale).
//   Runtime: deep-walk supporta SCA-native built-ins (Date, Map, Set, RegExp, ArrayBuffer,
//   TypedArray, Blob, ImageData, ImageBitmap) come opachi non-walkati; throw su 4 sub-codes.
//
// Pattern parser puro identico a `frame-parser.ts` (gateway/src/sse-ws/) — input → guard chain.
// **Inversione vs frame-parser:** ritorna `void` su success, throw `BrokerError` strutturato su fail.
// Pattern coerente con error-first design F1 ERR-01 + F3 OutcomeCollector.
//
// Threat coverage:
// - T-05-02-01 (DoS — cyclic payload stack overflow): WeakSet `visited` per cycle detection.
//   Test 12 verifica `a.self = a` no stack overflow.
// - T-05-02-02 (Information Disclosure — payload value in error): `details` include solo
//   `{fieldPath, fieldType, constructorName?}` — NIENTE value. Audit: grep `value:` zero match.
// - T-05-02-03 (Logic flaw — Pitfall 7.A bypass): throw PRE-postMessage strutturato + path al campo.

import { createBrokerError } from '@sembridge/core'

/**
 * Deep-walk recursive validator: throw `BrokerError` se `value` contiene tipi non
 * serializzabili dall'algoritmo Structured Clone (SCA) usato da `postMessage`
 * verso un Worker (D-142).
 *
 * **Sub-codes** (D-140):
 * - `worker.serialization.failed.function` — `typeof v === 'function'`
 * - `worker.serialization.failed.symbol` — `typeof v === 'symbol'`
 * - `worker.serialization.failed.dom-node` — `value.nodeType === number` (Element, Document, …)
 * - `worker.serialization.failed.custom-class` — instance di classe user-defined (prototype lost)
 *
 * **SCA-supported (no throw):** primitive (string/number/boolean/null/undefined/bigint),
 * plain object, plain array, Date, Map, Set, RegExp, ArrayBuffer, TypedArray, Blob, File,
 * FileList, ImageData, ImageBitmap, MessagePort.
 *
 * **Cycle detection:** `WeakSet<object>` traccia oggetti già visitati. Strutture cicliche
 * legittime (e.g. `a.self = a`) NON triggherano stack overflow — SCA stesso supporta i cicli
 * (clonati come riferimenti condivisi nel destination realm) (T-05-02-01 mitigation).
 *
 * **Path tracking:** il parametro `path` accumula la posizione del field corrente nel payload.
 * Convenzione: top-level key = nome plain (`'fn'`), nested = dotted (`'deep.nested.fn'`),
 * array index = bracketed (`'list[2]'`). Path vuoto al root level (entry point dal consumer).
 *
 * **Contratto error.details** (T-05-02-02 mitigation): mai includere `value` raw nel details
 * payload — solo metadata (`fieldPath`, `fieldType`, `constructorName?`). Il consumer è autore
 * del payload, non sorgente untrusted (boundary main thread → DOC-05 documenta trade-off DX).
 *
 * @param value - Payload da validare (top-level del task argument). `unknown` per gestire
 *   difensivamente input arbitrari dal consumer.
 * @param path - Field path corrente per error reporting (default `''` al root). Internal
 *   recursion accumula segments via `${path}.${key}` o `${path}[${i}]`.
 * @param visited - `WeakSet` per cycle detection. Internal recursion-only (default `new WeakSet()`).
 *
 * @throws {BrokerError} Code `worker.serialization.failed.<sub>` con `category:'worker'` e
 *   `details:{fieldPath, fieldType, constructorName?}` su violation.
 *
 * @example
 * ```ts
 * // Valid — no throw
 * assertSerializable({ id: 'o-1', total: 42, when: new Date() })
 *
 * // Invalid — throws BrokerError code worker.serialization.failed.function
 * try {
 *   assertSerializable({ transform: (x: number) => x * 2 })
 * } catch (err) {
 *   if (isBrokerError(err)) {
 *     console.log(err.code, err.details?.fieldPath) // '...function', 'transform'
 *   }
 * }
 * ```
 */
export function assertSerializable(
  value: unknown,
  path = '',
  visited: WeakSet<object> = new WeakSet(),
): void {
  // Step 1: primitive + null/undefined — sempre SCA-OK
  if (value === null || value === undefined) return
  const t = typeof value
  if (t === 'string' || t === 'number' || t === 'boolean' || t === 'bigint') return

  // Step 2: function — throw .function (Pattern raccomandato D-142: registerTransform + transformId)
  if (t === 'function') {
    throw createBrokerError({
      code: 'worker.serialization.failed.function',
      category: 'worker',
      message: `Field at "${path}" is a function — not serializable across worker boundary. Pattern: registerTransform(name, fn) and pass transformId instead.`,
      details: { fieldPath: path, fieldType: 'function' },
    })
  }

  // Step 3: symbol — throw .symbol (non clonabili da SCA)
  if (t === 'symbol') {
    throw createBrokerError({
      code: 'worker.serialization.failed.symbol',
      category: 'worker',
      message: `Field at "${path}" is a symbol — not serializable across worker boundary.`,
      details: { fieldPath: path, fieldType: 'symbol' },
    })
  }

  // Step 4+: object branches. Cycle detection PRIMA di walk per Pitfall T-05-02-01.
  // `visited.has(value)` true → ramo già percorso: return (SCA supporta cicli, niente DoS).
  const obj = value as object
  if (visited.has(obj)) return
  visited.add(obj)

  // Step 4: DOM Node detection — `nodeType` è property duck-typed di tutti i Node DOM.
  // `instanceof Node` non funziona cross-realm (es. iframe), `nodeType: number` sì.
  if (typeof (obj as { nodeType?: unknown }).nodeType === 'number') {
    throw createBrokerError({
      code: 'worker.serialization.failed.dom-node',
      category: 'worker',
      message: `Field at "${path}" is a DOM Node — cannot cross worker boundary. Serialize relevant data first (e.g. element.outerHTML, element.dataset).`,
      details: { fieldPath: path, fieldType: 'dom-node' },
    })
  }

  // Step 5: Array (plain) — walk recursive con path bracketed `${path}[${i}]`.
  // **PRIMA** dello step SCA-builtins perché `[object Array]` matcherebbe il filter
  // `tag.endsWith('Array]')` per TypedArray (false-positive: Array è user-controlled,
  // TypedArray è opaco SCA). Order critico per Test 11 (function in array).
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const childPath = path === '' ? `[${i}]` : `${path}[${i}]`
      assertSerializable(value[i], childPath, visited)
    }
    return
  }

  // Step 6: SCA-supported built-ins — opachi (non walkare contenuto interno).
  // Detection via `Object.prototype.toString.call` per gestire cross-realm + tag custom.
  // TypedArray match via suffix `Array]` (Uint8Array, Float32Array, BigInt64Array, ...).
  // Plain Array già filtrato dallo Step 5 — qui `tag.endsWith('Array]')` cattura solo TypedArray.
  const tag = Object.prototype.toString.call(value)
  if (
    tag === '[object Date]' ||
    tag === '[object RegExp]' ||
    tag === '[object Map]' ||
    tag === '[object Set]' ||
    tag === '[object ArrayBuffer]' ||
    tag === '[object SharedArrayBuffer]' ||
    tag === '[object Blob]' ||
    tag === '[object File]' ||
    tag === '[object FileList]' ||
    tag === '[object ImageData]' ||
    tag === '[object ImageBitmap]' ||
    tag === '[object MessagePort]' ||
    tag === '[object Error]' ||
    tag === '[object DOMException]' ||
    tag.endsWith('Array]') // Uint8Array / Float32Array / BigInt64Array / ...
  ) {
    return
  }

  // Step 7: plain object detection — prototype null o Object.prototype.
  // Custom class user-defined ha `proto.constructor.name !== 'Object'` (es. `Order`, `Map`-non-built-in).
  const proto = Object.getPrototypeOf(value) as object | null
  if (proto === null || proto === Object.prototype) {
    // Plain object — walk con path dotted `${path}.${key}`.
    for (const key of Object.keys(obj)) {
      const childPath = path === '' ? key : `${path}.${key}`
      // biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature TS strict require bracket access on Record<string, unknown>
      assertSerializable((obj as Record<string, unknown>)[key], childPath, visited)
    }
    return
  }

  // Step 8: custom class instance — prototype lost on structuredClone (D-142 anti-pattern).
  // SCA copia le own enumerable properties ma `instanceof MyClass` è false post-clone.
  const constructorName =
    (proto as { constructor?: { name?: string } }).constructor?.name ?? 'unknown'
  throw createBrokerError({
    code: 'worker.serialization.failed.custom-class',
    category: 'worker',
    message: `Field at "${path}" is instance of ${constructorName} — prototype lost on structured clone. Pass a plain object DTO instead.`,
    details: {
      fieldPath: path,
      fieldType: 'custom-class',
      constructorName,
    },
  })
}
