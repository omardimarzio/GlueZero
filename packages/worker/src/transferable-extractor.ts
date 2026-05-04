// transferable-extractor.ts — Pure extractor JSONPath-like per Transferable opt-in (D-141).
//
// Riferimento decisioni (05-CONTEXT.md):
// - D-141: `WorkerRouteDescriptor.transferable?: readonly string[]` con path stile
//   `'payload.audioBuffer'` o `'payload.images[*].buffer'` (wildcard `[*]`). Il bridge
//   estrae i transferable, chiama `port.postMessage(msg, transferList)`. Documentato
//   esplicitamente in DOC-05: "i campi transferred non sono più accessibili dal main
//   thread" (Pitfall 7.E warning) — closure parziale runtime in 05-02 + DOC-05 in 05-07.
//
// Decisione researcher zero-dep (RESEARCH.md §6.4): implementazione custom ~80 LOC
// invece di `jsonpath-plus` (4-6 KB). Subset deterministico testabile:
//   - 'audioBuffer'              (literal single-level)
//   - 'data.opts.buf'            (nested dotted)
//   - 'images[*].buffer'         (wildcard array)
//   - 'a.b[*].c[*].buf'          (deep nested wildcard chain)
//
// NON supporta (V1): filter, recursive descent (`..`), slice, numeric index `[0]`.
// V1 = wildcard `[*]` only. Numeric index opt-in V1.x se emerge use case.
//
// Pattern parser puro identico a `retry-after-parser.ts` (gateway/src/http/) — input
// narrow → output narrow, NO throw, NO side-effect, NO state. Test deterministici
// tier-1 jsdom senza setup async.
//
// Threat coverage:
// - T-05-02-04 (DoS — malformed path crash): `parsePath` ritorna `null` su malformed
//   (`'..'`, leading/trailing `.`, `[` non seguito da `*]`, empty string). `walk`
//   graceful su null/undefined. Test 15 verifica.
// - T-05-02-05 (Tampering — Transferable mutati): pure function, non muta input. La
//   transferList è array NUOVO; ownership non trasferita finché `postMessage` non viene
//   chiamato dal worker-bridge plan 05-04. Documentato DOC-05 W5.
// - T-05-02-06 (DoS — wildcard infinite loop): `walk` recursive con `segIdx` incrementale,
//   termina quando `segIdx === segments.length`. Niente loop infinito (no descendant `..`).

/**
 * Segment di path parsato.
 *
 * - `key`: literal property name (es. `'audioBuffer'`, `'buffer'`).
 * - `wildcard`: array iteration `[*]` (V1 supporta solo wildcard, no numeric index).
 */
type Segment = { readonly type: 'key'; readonly name: string } | { readonly type: 'wildcard' }

/**
 * Estrae oggetti `Transferable` dal payload via path JSONPath-like (D-141).
 *
 * Supporta subset deterministico:
 * - **Literal**: `'audioBuffer'`, `'data.opts.buf'`, `'images.metadata.id'`
 * - **Wildcard array**: `'images[*].buffer'`, `'list[*]'`, `'a.b[*].c[*].buf'`
 *
 * Path malformed (es. `'..'`, leading/trailing `.`, `[` senza `*]`) → graceful skip
 * (return `[]` per quel path, no throw — T-05-02-04 mitigation).
 *
 * **Deduplication via Set**: lo stesso `Transferable` referenziato da path multipli
 * è incluso 1 volta sola nel risultato (Test 13). Importante per `port.postMessage`
 * che fallisce se la transferList contiene duplicati.
 *
 * **Tipi Transferable detection** (`isTransferable`):
 * - `ArrayBuffer` (incluso `TypedArray.buffer`)
 * - `MessagePort`
 * - `ImageBitmap` (typeof guard per jsdom)
 * - `OffscreenCanvas` (typeof guard)
 * - `ReadableStream` / `WritableStream` / `TransformStream` (typeof guard)
 *
 * **NON supportato V1**: filter `[?]`, descendant `..`, numeric index `[0]`, slice `[0:3]`.
 *
 * @param payload - Oggetto payload da cui estrarre i transferable. `unknown` per gestire
 *   difensivamente input arbitrari dal consumer.
 * @param paths - Array readonly di path string. Ogni path è valutato indipendentemente.
 *   Empty array → return `[]` (Test 11).
 * @returns Array `Transferable[]` deduplicato. Order: per path nell'ordine di paths,
 *   per match nell'ordine di traversal (depth-first, breadth per wildcard array).
 *
 * @example
 * ```ts
 * // Literal single-level
 * extractTransferables({ audioBuffer: ab }, ['audioBuffer'])
 * // → [ab]
 *
 * // Nested
 * extractTransferables({ data: { opts: { buf: ab } } }, ['data.opts.buf'])
 * // → [ab]
 *
 * // Wildcard array
 * extractTransferables({ images: [{ buffer: ab1 }, { buffer: ab2 }] }, ['images[*].buffer'])
 * // → [ab1, ab2]
 *
 * // Multi-path con dedup
 * extractTransferables({ a: shared, b: shared }, ['a', 'b'])
 * // → [shared]
 *
 * // Malformed path graceful
 * extractTransferables({ a: ab }, ['a..b'])
 * // → []
 * ```
 */
export function extractTransferables(payload: unknown, paths: readonly string[]): Transferable[] {
  if (paths.length === 0) return []
  // Set per deduplication (Test 13 + protezione port.postMessage da DataCloneError).
  const collected = new Set<Transferable>()
  for (const path of paths) {
    const segments = parsePath(path)
    if (segments === null) continue // malformed path — skip graceful (Test 15)
    walk(payload, segments, 0, collected)
  }
  return [...collected]
}

/**
 * Parsa un path string in array `Segment[]`. Ritorna `null` su malformed.
 *
 * Forme accettate:
 * - `'foo'` → `[{type:'key', name:'foo'}]`
 * - `'foo.bar'` → `[{type:'key', name:'foo'}, {type:'key', name:'bar'}]`
 * - `'foo[*]'` → `[{type:'key', name:'foo'}, {type:'wildcard'}]`
 * - `'foo[*].bar'` → `[..., {type:'wildcard'}, {type:'key', name:'bar'}]`
 * - `'list[*]'` → `[{type:'key', name:'list'}, {type:'wildcard'}]`
 *
 * Forme malformed (return `null`):
 * - empty string `''`
 * - `'..'` (consecutive dots)
 * - `'.foo'` o `'foo.'` (leading/trailing dot)
 * - `'['` o `'[*'` (bracket non chiuso o malformed)
 * - `'foo[0]'` (numeric index non supportato V1)
 * - `'foo[?]'` (filter non supportato V1)
 *
 * @internal
 */
function parsePath(path: string): Segment[] | null {
  if (path.length === 0) return null
  if (path.startsWith('.') || path.endsWith('.')) return null

  const segments: Segment[] = []
  let buf = ''
  let i = 0

  while (i < path.length) {
    const ch = path[i]
    if (ch === '.') {
      if (buf.length === 0) return null // consecutive dots o leading dot
      segments.push({ type: 'key', name: buf })
      buf = ''
      i++
      continue
    }
    if (ch === '[') {
      // Path como `foo[*]` — flush buf accumulato (se presente) come key segment
      if (buf.length > 0) {
        segments.push({ type: 'key', name: buf })
        buf = ''
      }
      // Aspetta literal `*]`
      if (path[i + 1] !== '*' || path[i + 2] !== ']') return null
      segments.push({ type: 'wildcard' })
      i += 3
      // Dopo `]` accetta solo `.<key>` o end-of-string
      if (i < path.length && path[i] !== '.') return null
      if (path[i] === '.') i++ // skip dot
      continue
    }
    if (ch === ']') {
      // `]` orfano senza `[` aperto — malformed
      return null
    }
    // Char normale → accumula in buf
    buf += ch
    i++
  }

  // Flush trailing buf (es. `'foo'` solo, o `'foo.bar'` ultimo segment)
  if (buf.length > 0) {
    segments.push({ type: 'key', name: buf })
  }

  // Path tipo `'foo[*].'` con trailing `.` post-skip dot → segments non vuoto ma
  // l'ultimo iter consumed dot lasciando buf empty. Caso edge già coperto da
  // `path.endsWith('.')` early check sopra.
  if (segments.length === 0) return null
  return segments
}

/**
 * Walk recursive del `current` value seguendo `segments` da `segIdx`. Quando
 * `segIdx === segments.length` (terminal), aggiunge `current` al `collected` Set
 * se è `Transferable`.
 *
 * Comportamento:
 * - Wildcard segment + Array → ricorri su ogni element con `segIdx + 1`
 * - Wildcard segment + non-Array → return graceful (no throw)
 * - Key segment + Object → ricorri su `current[seg.name]` con `segIdx + 1`
 * - Key segment + non-Object → return graceful (no match per quel path)
 * - `current === null/undefined` → return graceful
 *
 * @internal
 */
function walk(
  current: unknown,
  segments: readonly Segment[],
  segIdx: number,
  collected: Set<Transferable>,
): void {
  if (current === null || current === undefined) return

  if (segIdx === segments.length) {
    // Terminal — controlla se transferable e aggiungi al Set
    if (isTransferable(current)) {
      collected.add(current as Transferable)
    }
    return
  }

  const seg = segments[segIdx]
  if (seg === undefined) return // unreachable (boundary check), TS exhaustiveness

  if (seg.type === 'wildcard') {
    if (Array.isArray(current)) {
      for (const item of current) {
        walk(item, segments, segIdx + 1, collected)
      }
    }
    // Wildcard su non-array → graceful skip (no match)
    return
  }

  // seg.type === 'key' — accedi a property se current è object
  if (typeof current !== 'object') return
  // biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature TS strict require bracket access on Record<string, unknown>
  const next = (current as Record<string, unknown>)[seg.name]
  walk(next, segments, segIdx + 1, collected)
}

/**
 * Verifica se `v` è `Transferable` (può essere passato in `transferList` di
 * `postMessage`). Detection via `instanceof` con typeof guard per environments
 * dove il global non è definito (jsdom non implementa `ImageBitmap`/`OffscreenCanvas`).
 *
 * Tipi Transferable supportati (HTML spec):
 * - `ArrayBuffer` (incluso `SharedArrayBuffer` in alcune spec — qui solo ArrayBuffer base)
 * - `MessagePort`
 * - `ImageBitmap`
 * - `OffscreenCanvas`
 * - `ReadableStream` / `WritableStream` / `TransformStream` (newer)
 *
 * Non Transferable: `TypedArray` (Uint8Array, ...) — il **buffer** sottostante è
 * Transferable, quindi consumer deve dichiarare path `.buffer` (Test 7).
 *
 * @internal
 */
function isTransferable(v: unknown): boolean {
  if (v instanceof ArrayBuffer) return true
  if (typeof MessagePort !== 'undefined' && v instanceof MessagePort) return true
  if (typeof ImageBitmap !== 'undefined' && v instanceof ImageBitmap) return true
  if (typeof OffscreenCanvas !== 'undefined' && v instanceof OffscreenCanvas) return true
  if (typeof ReadableStream !== 'undefined' && v instanceof ReadableStream) return true
  if (typeof WritableStream !== 'undefined' && v instanceof WritableStream) return true
  if (typeof TransformStream !== 'undefined' && v instanceof TransformStream) return true
  return false
}
