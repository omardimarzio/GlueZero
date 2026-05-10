/**
 * DomApplier — Strategia A applicazione DOM (D-F7-03, UI-ROLE-04 #1).
 *
 * Closure factory che osserva un sottoalbero DOM via `MutationObserver` con
 * `attributeFilter: ['data-gz-role']` + `subtree: true` + `childList: true`
 * e applica le classi DS-specific dell'adapter attivo (`adapter.roleMap[role]`)
 * tramite `ClassesTracker.track` (cleanup non-destructive — UI-ROLE-10).
 *
 * Pitfall HIGH #3 mitigation (MutationObserver overhead):
 * - `attributeFilter` ridotto a singola property → filtering O(1) browser-side.
 * - Batched `requestIdleCallback` (con fallback rAF + setTimeout) per limitare
 *   reflows in DOM-heavy.
 * - `data-gz-skip-observer` opt-out per nodi che gestiscono le classi a mano.
 *
 * Pitfall HIGH #4 mitigation (race React StrictMode/concurrent render):
 * - `queueMicrotask` coalescing: tutte le mutation in stesso tick vengono
 *   processate in un singolo flush → niente flicker durante render concurrent.
 *
 * Hot-swap atomico (UI-ROLE-05 + Q5 raccomandazione):
 * - `setAdapter(newAdapter)` accoda restore + re-apply in stesso microtask:
 *   il browser fa ri-paint singolo (no flicker visivo).
 *
 * Multi-scope (D-F7-05):
 * - `observerRoot` configurabile (default `document.body`) consente DomApplier
 *   paralleli su sotto-alberi distinti con adapter diversi.
 *
 * Refs:
 * - 07-CONTEXT.md D-F7-03 (3 strategie), D-F7-05 (multi-scope)
 * - 07-RESEARCH.md Pitfall HIGH #2/#3/#4, Q1 (observerRoot), Q5 (queueMicrotask)
 * - 07-07-PLAN.md Task 3
 * - UI-ROLE-04 / UI-ROLE-05 / UI-ROLE-08 / UI-ROLE-10
 */

import { createClassesTracker, type ClassesTracker } from './internal/weakmap-classes'
import type { ThemeAdapter } from './types/theme-adapter'

export interface DomApplierOptions {
  readonly adapter: ThemeAdapter | null
  /** Tracker condiviso opzionale; se omesso ne crea uno interno (auto-destroyed). */
  readonly classesTracker?: ClassesTracker
  /** Default `document.body` (Q1 raccomandazione). */
  readonly observerRoot?: HTMLElement
}

export interface DomApplier {
  /** Re-scan dei nodi `[data-gz-role]` dentro `observerRoot`. */
  scan(): void
  /** Hot-swap atomico: rimuove classi dell'adapter precedente + applica nuovo. */
  setAdapter(adapter: ThemeAdapter | null): void
  /** Disconnette MutationObserver + cleanup tracker (se owned). */
  dispose(): void
}

/**
 * Schedule batched: requestIdleCallback con fallback rAF + setTimeout(0).
 */
function scheduleIdle(cb: () => void): void {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => cb(), { timeout: 100 })
  } else if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => cb())
  } else {
    setTimeout(cb, 0)
  }
}

/**
 * Crea un nuovo {@link DomApplier} (D-30 anti-singleton).
 *
 * @example
 * ```ts
 * const applier = createDomApplier({ adapter: tailwind, observerRoot: document.body })
 * // ... applier osserva mutations e applica classi
 * applier.setAdapter(bootstrap) // hot-swap atomico
 * applier.dispose()
 * ```
 *
 * @see UI-ROLE-04 Strategia A
 * @see UI-ROLE-05 hot-swap atomico
 */
export function createDomApplier(opts: DomApplierOptions): DomApplier {
  let currentAdapter: ThemeAdapter | null = opts.adapter
  const tracker = opts.classesTracker ?? createClassesTracker()
  const ownsTracker = opts.classesTracker == null
  let observer: MutationObserver | null = null
  let observerRoot: HTMLElement | null = null
  // Pending nodes batched between MO callback and microtask flush
  const pending = new Set<HTMLElement>()
  let microtaskScheduled = false

  function applyToNode(el: HTMLElement): void {
    if (el.hasAttribute('data-gz-skip-observer')) return
    const role = el.getAttribute('data-gz-role')
    if (role == null) {
      tracker.restore(el)
      return
    }
    // Idempotent cleanup before apply (handles role-swap correctly)
    tracker.restore(el)
    if (currentAdapter == null || currentAdapter.roleMap == null) return
    const cls = currentAdapter.roleMap[role]
    if (cls == null || cls === '') return
    const classes = cls.split(/\s+/).filter(Boolean)
    tracker.track(el, classes)
  }

  function flushPending(): void {
    microtaskScheduled = false
    const nodes = [...pending]
    pending.clear()
    scheduleIdle(() => {
      for (const el of nodes) {
        applyToNode(el)
      }
    })
  }

  function enqueue(el: HTMLElement): void {
    pending.add(el)
    if (!microtaskScheduled) {
      microtaskScheduled = true
      queueMicrotask(flushPending)
    }
  }

  function scan(): void {
    if (observerRoot == null) return
    const all = observerRoot.querySelectorAll<HTMLElement>('[data-gz-role]')
    for (const el of all) enqueue(el)
  }

  function setAdapter(adapter: ThemeAdapter | null): void {
    // Q5 hot-swap atomico: restore + re-apply in singolo microtask
    currentAdapter = adapter
    if (observerRoot == null) return
    const all = observerRoot.querySelectorAll<HTMLElement>(
      '[data-gz-role]:not([data-gz-skip-observer])',
    )
    queueMicrotask(() => {
      for (const el of all) {
        tracker.restore(el)
        applyToNode(el)
      }
    })
  }

  function dispose(): void {
    if (observer != null) {
      observer.disconnect()
      observer = null
    }
    pending.clear()
    if (ownsTracker) tracker.destroy()
    observerRoot = null
  }

  function start(): void {
    if (typeof MutationObserver === 'undefined') return
    observerRoot =
      opts.observerRoot ??
      (typeof document !== 'undefined' ? document.body : null)
    if (observerRoot == null) return
    observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'attributes' && m.target instanceof HTMLElement) {
          enqueue(m.target)
        } else if (m.type === 'childList') {
          for (const node of m.addedNodes) {
            if (node instanceof HTMLElement) {
              if (node.hasAttribute('data-gz-role')) enqueue(node)
              const descendants = node.querySelectorAll('[data-gz-role]')
              for (const d of descendants) enqueue(d as HTMLElement)
            }
          }
          for (const node of m.removedNodes) {
            if (node instanceof HTMLElement) {
              tracker.restore(node)
              const descendants = node.querySelectorAll('[data-gz-role]')
              for (const d of descendants) tracker.restore(d as HTMLElement)
            }
          }
        }
      }
    })
    observer.observe(observerRoot, {
      attributes: true,
      attributeFilter: ['data-gz-role'],
      subtree: true,
      childList: true,
    })
    scan()
  }

  start()

  return { scan, setAdapter, dispose }
}
