/**
 * TokenRegistry — closure factory che gestisce la mappa interna di design token
 * + write-through DOM via `:root.style.setProperty('--gz-*', value)` (D-F7-05
 * multi-scope) + Valibot validation register-time + cardinality cap (D-166).
 *
 * Pattern role-match con i registry F1 (`createPluginRegistry`) e F6
 * (`createMetricsCollector`): closure factory anti-singleton (D-30) — ogni call
 * a `createTokenRegistry()` ritorna un'istanza indipendente con stato isolato.
 *
 * **Lifecycle:**
 * 1. `apply(tokens, opts?)` → safeParse Valibot → checkCap → setProperty + Map.set + notify subscribers
 * 2. `getActive()` → snapshot frozen del Map corrente
 * 3. `subscribe(listener)` → notify a ogni apply post-success → ritorna unsubscribe
 * 4. `destroy()` → throw flag attivato + clear Map + clear listeners (irreversibile)
 *
 * **Multi-scope (D-F7-05):** per default `apply` scrive su `:root`. Con
 * `opts.scope: HTMLElement` scrive sul subtree-root specifico — utile per
 * dashboard multi-tenant o componenti con tema sovrascritto localmente.
 *
 * **Anti-singleton (D-30):** mai esportare un'istanza shared; userland chiama
 * `createTokenRegistry()` quando serve. ThemeManager (W2 plan 07-03) compone
 * un singolo TokenRegistry interno per istanza ThemeManager.
 *
 * Refs:
 * - 07-CONTEXT.md D-F7-05 (multi-scope), D-F7-08 (deep-frozen), D-F7-11 (cap)
 * - 07-02-PLAN.md Task 2
 * - THEME-01, THEME-02, THEME-09, THEME-10, THEME-11
 */

import { safeParse } from 'valibot'
import { TOKEN_CAP, checkCap } from './cardinality-cap'
import { TokenSetSchema } from './internal/valibot-schemas'
import { createThemeError } from './theme-error'

/**
 * Surface API del TokenRegistry. Esposta da `createTokenRegistry()`.
 * Plan W3 estende il consumer ThemeManager con `setMode`/`setDensity`/etc.;
 * il TokenRegistry resta a focus single-purpose (solo tokens).
 */
export interface TokenRegistry {
  /**
   * Applica i token al DOM scope (default `:root`) + aggiorna stato interno.
   *
   * @param tokens - Record kebab-case → CSS value (validato Valibot register-time).
   * @param opts - Optional scope HTMLElement (D-F7-05) + allowMore opt-in cap override.
   * @throws {ThemeError} `theme.token.invalid` su Valibot failure.
   * @throws {ThemeError} `theme.token.cap-exceeded` su over-cap senza `allowMore`.
   * @throws {ThemeError} `theme.snapshot.frozen` se chiamato post-`destroy`.
   */
  apply(tokens: Record<string, string>, opts?: ApplyOptions): void
  /** Ritorna snapshot frozen dello stato attivo corrente. */
  getActive(): Readonly<Record<string, string>>
  /**
   * Iscrive un listener notificato a ogni `apply` post-success.
   * @returns Unsubscribe function.
   */
  subscribe(
    listener: (active: Readonly<Record<string, string>>) => void,
  ): () => void
  /**
   * Distrugge il registry: clears Map + listeners, blocca successivi `apply`.
   * Idempotent (safe to call multiple times).
   */
  destroy(): void
}

/** Options per `apply` — scope multi-tenant + override cap. */
export interface ApplyOptions {
  /** Element target (default `:root` aka `document.documentElement`). D-F7-05. */
  scope?: HTMLElement | undefined
  /** Bypass cap deny (THEME-11 + D-F7-11). Default `false`. */
  allowMore?: boolean | undefined
}

/** Options factory `createTokenRegistry`. */
export interface CreateTokenRegistryOptions {
  /**
   * Token iniziali (es. dal boot snapshot anti-FOUC). Popolano lo stato
   * interno SENZA propagazione DOM — il boot script inline ha già scritto le
   * proprietà CSS pre-paint.
   */
  initial?: Record<string, string> | undefined
}

/**
 * Listener type alias — esposto per riuso nei test e nei consumer downstream.
 */
type ActiveListener = (active: Readonly<Record<string, string>>) => void

/**
 * Crea un nuovo {@link TokenRegistry}.
 *
 * @param opts - Configurazione opzionale (initial seed).
 * @returns Nuova istanza indipendente (D-30).
 *
 * @example Apply globale + multi-scope (D-F7-05)
 * ```ts
 * const reg = createTokenRegistry()
 * reg.apply({ 'color-primary': '#FF6B35' })
 * // → :root.style.setProperty('--gz-color-primary', '#FF6B35')
 *
 * reg.apply({ 'spacing-md': '1.5rem' }, { scope: document.querySelector('.dashboard')! })
 * // → element.style.setProperty(...) — :root NON modificato
 * ```
 *
 * @example Subscribe a token changes (Inspector / live editor)
 * ```ts
 * const unsub = reg.subscribe((active) => console.log('tokens →', active))
 * reg.apply({ 'color-primary': '#FF6B35' })
 * unsub()
 * ```
 *
 * @example Initial seed (anti-FOUC boot)
 * ```ts
 * const reg = createTokenRegistry({
 *   initial: { 'color-primary': '#3B82F6' }, // letti da pre-paint script
 * })
 * ```
 *
 * @see THEME-01
 * @see THEME-02
 * @see THEME-09
 * @see THEME-10
 * @see THEME-11
 */
export function createTokenRegistry(
  opts: CreateTokenRegistryOptions = {},
): TokenRegistry {
  const active = new Map<string, string>()
  const listeners = new Set<ActiveListener>()
  let destroyed = false

  // Seed initial — populate Map senza DOM write (boot script ha già scritto)
  if (opts.initial) {
    for (const [k, val] of Object.entries(opts.initial)) {
      if (typeof val === 'string') {
        active.set(k, val)
      }
    }
  }

  function snapshotActive(): Readonly<Record<string, string>> {
    return Object.freeze(Object.fromEntries(active))
  }

  function notify(): void {
    const snap = snapshotActive()
    for (const l of listeners) {
      l(snap)
    }
  }

  function apply(
    tokens: Record<string, string>,
    applyOpts: ApplyOptions = {},
  ): void {
    if (destroyed) {
      throw createThemeError({
        code: 'theme.snapshot.frozen',
        message: 'TokenRegistry has been destroyed',
      })
    }

    // Validation register-time (T-F7-01 + T-F7-05 + THEME-10)
    const parsed = safeParse(TokenSetSchema, tokens)
    if (!parsed.success) {
      throw createThemeError({
        code: 'theme.token.invalid',
        message: `Invalid token set: ${parsed.issues.map((i) => i.message).join('; ')}`,
        details: { issueCount: parsed.issues.length },
      })
    }

    // Cardinality cap (THEME-11 + D-F7-11)
    const incoming = parsed.output
    let projected = active.size
    for (const k of Object.keys(incoming)) {
      if (!active.has(k)) {
        projected += 1
      }
    }
    const cap = checkCap(
      projected,
      TOKEN_CAP,
      'token',
      applyOpts.allowMore ?? false,
    )
    if (!cap.allow) {
      throw createThemeError({
        code: 'theme.token.cap-exceeded',
        message: cap.warn ?? 'Token cap exceeded',
        details: { projected, cap: TOKEN_CAP },
      })
    }
    if (cap.warn) {
      // Soft-warn: log non-fatal (pattern D-166)
      console.warn(`[gluezero/theme] ${cap.warn}`)
    }

    // Resolve target scope (D-F7-05)
    const targetEl: HTMLElement | null =
      applyOpts.scope ??
      (typeof document !== 'undefined' ? document.documentElement : null)

    // Write-through: setProperty + Map insert
    for (const [k, val] of Object.entries(incoming)) {
      active.set(k, val)
      if (targetEl !== null && typeof targetEl.style?.setProperty === 'function') {
        targetEl.style.setProperty(`--gz-${k}`, val)
      }
    }

    notify()
  }

  function getActive(): Readonly<Record<string, string>> {
    return snapshotActive()
  }

  function subscribe(listener: ActiveListener): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  function destroy(): void {
    destroyed = true
    listeners.clear()
    active.clear()
  }

  return { apply, getActive, subscribe, destroy }
}
