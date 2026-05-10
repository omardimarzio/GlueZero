/**
 * StyleSheetGenerator — Strategia B applicazione DOM (D-F7-03, UI-ROLE-04 #2).
 *
 * Genera un `<style>` con regole CSS wrappate nella cascade lockata
 * `@layer gluezero-theme.adapter { [data-gz-role="X"] { ... } }` per ogni
 * entry di `adapter.cssRules`.
 *
 * Pattern critico per consumer che NON vogliono utility-classes (Tailwind/Bootstrap):
 * un design system "tokens-only" applica regole DS-specific puntando ai canonical
 * roles via `data-gz-role`, sfruttando `@layer` per garantire specificity controllata
 * (Pitfall HIGH #2 specificity war mitigation — D-F7-10).
 *
 * Pitfall 9 (substring selector) mitigation:
 * SOLO `[data-gz-role="<exact>"]` equality. NON `*=`, `^=`, `$=` (vietati).
 *
 * Multi-scope (D-F7-05):
 * `createStyleSheetGenerator({ adapter, scope: el })` mette il `<style>` come
 * child di `el`, abilitando temi paralleli su sotto-alberi diversi.
 *
 * Atomic textContent swap su `setAdapter()`: nessun flicker visibile (single
 * property write, browser ricalcola layout in 1 paint).
 *
 * Refs:
 * - 07-CONTEXT.md D-F7-03 (Strategie A/B/C), D-F7-05 (multi-scope), D-F7-10 (cascade lockata)
 * - 07-RESEARCH.md Pitfall HIGH #2 + Pitfall 9
 * - 07-07-PLAN.md Task 2
 * - UI-ROLE-04 Strategia B
 */

import type { ThemeAdapter } from './types/theme-adapter'

export interface StyleSheetGeneratorOptions {
  readonly adapter: ThemeAdapter | null
  /** Mount point: default `document.head`; multi-scope D-F7-05 via element. */
  readonly scope?: HTMLElement
}

export interface StyleSheetGenerator {
  /** Genera la stringa CSS wrappata in `@layer gluezero-theme.adapter`. */
  generate(): string
  /** Inserisce un `<style>` in `<head>` (o nello `scope`). Idempotente. */
  mount(): void
  /** Rimuove il `<style>`. Idempotente. */
  dispose(): void
  /** Sostituisce l'adapter attivo + atomic textContent swap se montato. */
  setAdapter(adapter: ThemeAdapter | null): void
  /** Restituisce l'elemento `<style>` montato o `null`. */
  getStyleElement(): HTMLStyleElement | null
}

/**
 * CSS escape per attribute value `[data-gz-role="..."]`.
 * Defense-in-depth contro role names malformati (anche se RoleSetSchema validate
 * upstream impone dot-notation lowercase, evitiamo CSS rule break-out con `"` o `\`).
 */
function escapeAttrValue(value: string): string {
  return value.replace(/["\\]/g, '\\$&')
}

/**
 * Crea un nuovo {@link StyleSheetGenerator} (D-30 anti-singleton).
 *
 * @example
 * ```ts
 * const gen = createStyleSheetGenerator({ adapter: tokensOnly })
 * gen.mount() // injects <style id="..."> in <head>
 * gen.setAdapter(otherAdapter) // atomic CSS swap
 * gen.dispose() // removes <style>
 * ```
 *
 * @see UI-ROLE-04 Strategia B
 * @see D-F7-10 (cascade `@layer` lockata)
 */
export function createStyleSheetGenerator(
  opts: StyleSheetGeneratorOptions,
): StyleSheetGenerator {
  let currentAdapter: ThemeAdapter | null = opts.adapter
  let styleEl: HTMLStyleElement | null = null

  function generate(): string {
    if (currentAdapter == null || currentAdapter.cssRules == null) return ''
    const entries = Object.entries(currentAdapter.cssRules)
    if (entries.length === 0) return ''
    const body = entries
      .map(([role, rules]) => {
        return `  [data-gz-role="${escapeAttrValue(role)}"] { ${rules} }`
      })
      .join('\n')
    return `@layer gluezero-theme.adapter {\n${body}\n}\n`
  }

  function mount(): void {
    if (styleEl != null) return // idempotent
    if (typeof document === 'undefined') return
    styleEl = document.createElement('style')
    styleEl.setAttribute('data-gz-stylesheet', currentAdapter?.id ?? 'unknown')
    styleEl.textContent = generate()
    const target = opts.scope ?? document.head
    target.appendChild(styleEl)
  }

  function dispose(): void {
    if (styleEl != null && styleEl.parentNode != null) {
      styleEl.parentNode.removeChild(styleEl)
    }
    styleEl = null
  }

  function setAdapter(adapter: ThemeAdapter | null): void {
    currentAdapter = adapter
    if (styleEl != null) {
      // Atomic single textContent write + attribute update
      styleEl.textContent = generate()
      styleEl.setAttribute('data-gz-stylesheet', adapter?.id ?? 'unknown')
    }
  }

  function getStyleElement(): HTMLStyleElement | null {
    return styleEl
  }

  return { generate, mount, dispose, setAdapter, getStyleElement }
}
