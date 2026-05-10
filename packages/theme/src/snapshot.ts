/**
 * Snapshot helpers — `createSnapshot` (deep-frozen ThemeSnapshot factory) +
 * `diffSnapshots` (utility per token map diff).
 *
 * Pattern role-match con `packages/core/src/types/broker-event.ts` deep-frozen
 * (D-F7-08): `structuredClone` + `Object.freeze` ricorsivo. NO import esterno —
 * la dipendenza è solo sul tipo locale `ThemeSnapshot`.
 *
 * `diffSnapshots` è esposta per riuso dall'Inspector (UI-DEVTOOLS-04 W5a):
 * mostra i delta token tra due snapshot consecutivi nel timeline panel.
 *
 * Refs:
 * - 07-CONTEXT.md D-F7-08 (snapshot deep-frozen)
 * - 07-02-PLAN.md Task 2
 * - THEME-09 (immutable snapshot), UI-DEVTOOLS-04 (diff reuse)
 */

import type { ThemeSnapshot } from './types/theme-snapshot'

/** Input shape per `createSnapshot` — mirror dei field di `ThemeSnapshot`. */
export interface SnapshotInput {
  themeId: string
  tokens: Record<string, string>
  mode: 'auto' | 'light' | 'dark'
  resolvedMode: 'light' | 'dark'
  density: 'compact' | 'comfortable' | 'spacious'
  direction: 'ltr' | 'rtl'
  activeAdapterId: string | null
  scope: 'root' | 'scoped'
}

/**
 * Crea un {@link ThemeSnapshot} deep-frozen (D-F7-08).
 *
 * Pattern v1.0 BrokerEvent: `structuredClone` per disaccoppiare dall'input
 * (mutating input post-snapshot NON affetta lo snapshot) + `Object.freeze`
 * top-level + freeze esplicito su `tokens` (record nested).
 *
 * @param input - Stato corrente del theme manager.
 * @returns ThemeSnapshot immutable cross-subscriber.
 *
 * @example
 * ```ts
 * const snap = createSnapshot({
 *   themeId: 'default',
 *   tokens: { 'color-primary': '#FF6B35' },
 *   mode: 'auto', resolvedMode: 'dark',
 *   density: 'comfortable', direction: 'ltr',
 *   activeAdapterId: null, scope: 'root',
 * })
 * Object.isFrozen(snap)         // true
 * Object.isFrozen(snap.tokens)  // true
 * ```
 *
 * @see THEME-09
 */
export function createSnapshot(input: SnapshotInput): ThemeSnapshot {
  const cloned = structuredClone({
    themeId: input.themeId,
    tokens: { ...input.tokens },
    mode: input.mode,
    resolvedMode: input.resolvedMode,
    density: input.density,
    direction: input.direction,
    activeAdapterId: input.activeAdapterId,
    scope: input.scope,
  })
  Object.freeze(cloned.tokens)
  Object.freeze(cloned)
  return cloned as ThemeSnapshot
}

/** Diff tra due token map (record `key → value`). */
export interface SnapshotDiff {
  /** Keys presenti in `b` ma non in `a`. */
  readonly added: Readonly<Record<string, string>>
  /** Keys presenti in `a` ma non in `b`. */
  readonly removed: Readonly<Record<string, string>>
  /** Keys presenti in entrambi ma con valori diversi. */
  readonly changed: Readonly<Record<string, { from: string; to: string }>>
}

/**
 * Diff flat record di token (~30 LoC custom — no jsondiffpatch/deep-diff dep).
 *
 * Tre categorie:
 * - `added`: keys in `b` non in `a`
 * - `removed`: keys in `a` non in `b`
 * - `changed`: keys in entrambi con `a[k] !== b[k]`
 *
 * Risultato top-level + nested objects sono `Object.freeze` per garantire
 * immutability (UI-DEVTOOLS-04 timeline panel ne fa rendering read-only).
 *
 * @param a - Token map snapshot precedente.
 * @param b - Token map snapshot corrente.
 * @returns SnapshotDiff readonly.
 *
 * @example
 * ```ts
 * const d = diffSnapshots({ x: '1', y: '2' }, { x: '9', z: '3' })
 * // d.added === { z: '3' }
 * // d.removed === { y: '2' }
 * // d.changed === { x: { from: '1', to: '9' } }
 * ```
 *
 * @see UI-DEVTOOLS-04
 */
export function diffSnapshots(
  a: Readonly<Record<string, string>>,
  b: Readonly<Record<string, string>>,
): SnapshotDiff {
  const added: Record<string, string> = {}
  const removed: Record<string, string> = {}
  const changed: Record<string, { from: string; to: string }> = {}
  for (const k of Object.keys(b)) {
    const bv = b[k]
    if (bv === undefined) continue
    if (!(k in a)) {
      added[k] = bv
    } else {
      const av = a[k]
      if (av !== undefined && av !== bv) {
        changed[k] = { from: av, to: bv }
      }
    }
  }
  for (const k of Object.keys(a)) {
    const av = a[k]
    if (av !== undefined && !(k in b)) {
      removed[k] = av
    }
  }
  return Object.freeze({
    added: Object.freeze(added),
    removed: Object.freeze(removed),
    changed: Object.freeze(changed),
  })
}
