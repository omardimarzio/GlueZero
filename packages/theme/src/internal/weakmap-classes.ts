/**
 * ClassesTracker — WeakMap<HTMLElement, Set<string>> (UI-ROLE-10).
 *
 * Cleanup non-destructive: ogni `track(el, classes)` aggiunge classi al nodo
 * e tiene traccia per cleanup successivo via `restore(el)`. Le classi
 * pre-esistenti (NON aggiunte dal tracker) NON vengono rimosse — il tracker
 * è "additive-only", quindi `restore` riporta SOLO le sue mutation.
 *
 * Pattern critico per UI-ROLE-05 hot-swap atomico:
 * - `setAdapter('tailwind')` → `track(el, ['btn-primary'])`
 * - `setAdapter('bootstrap5')` → `restore(el)` (cleanup tailwind classes) →
 *   `track(el, ['btn', 'btn-primary'])` (apply bootstrap classes)
 *
 * Memory hygiene: WeakMap auto-GC quando l'`HTMLElement` diventa unreachable
 * (detached + senza ref strong altrove). Nessun cap esplicito (T-F7-03 accept).
 *
 * Internal — NON re-esportato dal barrel `index.ts`. Consumer è il DomApplier
 * (W3 plan 07-07) e il setActive flow del theme manager (W4).
 *
 * Refs:
 * - 07-CONTEXT.md UI-ROLE-10 (WeakMap track)
 * - 07-RESEARCH.md Pitfall HIGH #2 (specificity war + cleanup non-destructive)
 * - 07-06-PLAN.md Task 1
 */

/** Public surface della factory `createClassesTracker`. */
export interface ClassesTracker {
  /**
   * Aggiunge `classes` al nodo `el.classList` + traccia internamente.
   *
   * Edge cases:
   * - `classes.length === 0` → no-op.
   * - Class name vuota o con spazi → ignorata (defensive: classList API
   *   tratta spazi come separator, evitiamo input ambigui).
   * - Class già presente sul nodo (pre-esistente o pre-tracked) → NON
   *   aggiunta nuovamente al tracking set (no double-track) e classList
   *   non duplica (browser-native dedup).
   */
  track(el: HTMLElement, classes: readonly string[]): void
  /**
   * Rimuove SOLO le classi tracciate dal tracker per `el`; classi
   * pre-esistenti (NON aggiunte dal tracker) restano. Cleanup completo:
   * dopo `restore`, l'entry WeakMap è eliminata (next track ricomincia
   * da set vuoto).
   *
   * No-op se `el` non è tracciato.
   */
  restore(el: HTMLElement): void
  /**
   * Reset interno: WeakMap re-iniziata. Le classi già applicate sui nodi
   * NON vengono rimosse automaticamente (chiama `restore` per ognuno
   * prima di `destroy`, oppure accetta che il DOM resti "sporco" finché
   * il consumer non lo ripulisce manualmente).
   *
   * Idempotente.
   */
  destroy(): void
}

/**
 * Crea un nuovo {@link ClassesTracker} closure-based (D-30 anti-singleton).
 *
 * @example
 * ```ts
 * const tracker = createClassesTracker()
 * tracker.track(button, ['btn', 'btn-primary'])
 * // ... swap adapter ...
 * tracker.restore(button) // rimuove btn + btn-primary; classi pre-esistenti restano
 * ```
 *
 * @see UI-ROLE-10
 * @see ClassesTracker
 */
export function createClassesTracker(): ClassesTracker {
  let tracked: WeakMap<HTMLElement, Set<string>> = new WeakMap()

  function track(el: HTMLElement, classes: readonly string[]): void {
    if (classes.length === 0) return
    let set = tracked.get(el)
    if (!set) {
      set = new Set<string>()
      tracked.set(el, set)
    }
    for (const cls of classes) {
      // Defensive: skip empty + class names with spaces (invalid per classList semantics)
      if (cls === '' || cls.includes(' ')) continue
      // Pre-existing classes (added by user/server SSR/other code) NON tracked
      // → restore non le rimuoverà (cleanup non-destructive).
      if (!el.classList.contains(cls)) {
        el.classList.add(cls)
        set.add(cls)
      }
    }
  }

  function restore(el: HTMLElement): void {
    const set = tracked.get(el)
    if (!set) return
    for (const cls of set) {
      el.classList.remove(cls)
    }
    tracked.delete(el)
  }

  function destroy(): void {
    // WeakMap entries auto-GC quando elements diventano unreachable; comunque
    // re-init per rompere closure references e rendere il tracker "amnesico".
    tracked = new WeakMap()
  }

  return { track, restore, destroy }
}
