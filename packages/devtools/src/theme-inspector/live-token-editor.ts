/**
 * `createLiveTokenEditor` — form HTML che invoca `theme.applyTokens()` runtime
 * (W5a plan 07-09, UI-DEVTOOLS-03).
 *
 * Editor "Figma-lite" minimal — zero design tool, solo controlli base. Ogni
 * input modifica un token; `change` invoca `theme.applyTokens({ [name]: value })`.
 *
 * **NODE_ENV gate (D-160 pattern F6):** in production il body dell'editor è un
 * no-op (zero overhead, render() / destroy() fanno nothing). Tree-shake del
 * body via dead-code elimination quando i bundler vedono `process.env.NODE_ENV
 * === 'production'`.
 *
 * **D-F7-04 D-83 strict:** vive in NUOVA sub-folder
 * `packages/devtools/src/theme-inspector/`. Zero modifiche a
 * `packages/devtools/src/index.ts`.
 *
 * **Threat coverage T-F7-02 (InformationDisclosure LiveTokenEditor in production):**
 * il body è gated dietro NODE_ENV check inline (`isProduction()`); production
 * ritorna `{ render: noop, destroy: noop }` — zero DOM mutation, zero memoria.
 *
 * Refs:
 * - 07-CONTEXT.md UI-DEVTOOLS-03 (LiveTokenEditor — NODE_ENV gate)
 * - 07-09-PLAN.md Task 3
 */

// Type-only import: `Theme` viene da `@gluezero/theme/factory` (subpath).
// Per evitare un secondo `peerDependencies` entry esplicito sul subpath specifico,
// dichiariamo il subset usato (`applyTokens` + `getActiveTheme`) come duck-type
// inline. Pattern role-match con `BrokerLike` in `@gluezero/theme/types/ui-events.ts`.
//
// Razionale: il consumer passa già il proprio handle `theme` da `@gluezero/theme/factory`;
// non serve il binding nominale `Theme`. Mantiene il subpath self-contained
// rispetto agli altri subpath di `@gluezero/theme`.

/** Subset di {@link Theme} (`@gluezero/theme/factory`) usato da {@link createLiveTokenEditor}. */
export interface ThemeLikeForEditor {
  /** Applica deltas di token al theme manager. */
  applyTokens(
    tokens: Record<string, string>,
    opts?: { scope?: HTMLElement; allowMore?: boolean },
  ): void
  /** Ritorna lo snapshot deep-frozen corrente (legge `tokens` per popolare il form). */
  getActiveTheme(): { readonly tokens: Readonly<Record<string, string>> }
}

/** Opzioni di {@link createLiveTokenEditor}. */
export interface CreateLiveTokenEditorOptions {
  /**
   * Sottoinsieme di token names da mostrare nel form (default: tutti i correnti
   * dello snapshot `theme.getActiveTheme().tokens`).
   */
  readonly tokens?: readonly string[]
}

/** Surface API esposta da {@link createLiveTokenEditor}. */
export interface LiveTokenEditor {
  /** Renderizza il form nel container fornito (idempotent: re-render rimpiazza). */
  render(container: HTMLElement): void
  /** Cleanup: rimuove il form dal container. Idempotent. */
  destroy(): void
}

/**
 * NODE_ENV inline detect (D-160 pattern carryover F6 EventInspector).
 * Production = `true` → body no-op (T-F7-02 mitigation).
 */
function isProduction(): boolean {
  try {
    const proc = (
      globalThis as {
        process?: { env?: Record<string, string | undefined> }
      }
    ).process
    if (proc != null && proc.env != null) {
      return proc.env['NODE_ENV'] === 'production'
    }
  } catch {
    /* ignore — fallback browser-dev */
  }
  return false
}

/**
 * Crea un nuovo {@link LiveTokenEditor} (D-30 anti-singleton).
 *
 * Production gate (T-F7-02 mitigation): se `NODE_ENV === 'production'` ritorna
 * un editor no-op (`render` / `destroy` non fanno nulla). Bundler con
 * `process.env.NODE_ENV` define a build-time tree-shake il body.
 *
 * Form HTML minimal: per ogni token name del subset (default: tutti i tokens
 * correnti) crea `<label>token-name: <input value=current /></label>`. On
 * `change` invoca `theme.applyTokens({ [token-name]: input.value })`.
 *
 * @example
 * ```ts
 * import { createTheme } from '@gluezero/theme/factory'
 * import { createLiveTokenEditor } from '@gluezero/devtools/theme-inspector'
 *
 * const theme = createTheme()
 * const editor = createLiveTokenEditor(theme, {
 *   tokens: ['color-primary', 'spacing-md', 'radius-md'],
 * })
 *
 * const panel = document.getElementById('devtools-panel')!
 * editor.render(panel)
 *
 * // Plus tardi
 * editor.destroy() // rimuove il form
 * ```
 *
 * @param theme - Handle `Theme` da `@gluezero/theme/factory` (duck-typed).
 * @param opts - {@link CreateLiveTokenEditorOptions}.
 * @returns {@link LiveTokenEditor} closure.
 *
 * @see UI-DEVTOOLS-03
 * @see D-160 (NODE_ENV gate hot-path)
 */
export function createLiveTokenEditor(
  theme: ThemeLikeForEditor,
  opts: CreateLiveTokenEditorOptions = {},
): LiveTokenEditor {
  if (isProduction()) {
    // T-F7-02 mitigation: production no-op (zero DOM, zero memoria)
    return {
      render(): void {
        /* no-op in production */
      },
      destroy(): void {
        /* no-op in production */
      },
    }
  }

  let formEl: HTMLFormElement | null = null
  let containerRef: HTMLElement | null = null

  function render(container: HTMLElement): void {
    // Idempotent: re-render rimpiazza il form precedente
    if (formEl != null && containerRef != null) {
      destroy()
    }
    const snapshot = theme.getActiveTheme()
    const tokenNames = opts.tokens ?? Object.keys(snapshot.tokens)
    const form = document.createElement('form')
    form.setAttribute('data-gz-live-editor', '')
    for (const tokenName of tokenNames) {
      const label = document.createElement('label')
      label.style.display = 'block'
      label.style.marginBottom = '4px'
      label.appendChild(document.createTextNode(`${tokenName}: `))
      const input = document.createElement('input')
      input.type = 'text'
      input.name = tokenName
      input.value = snapshot.tokens[tokenName] ?? ''
      input.addEventListener('change', () => {
        theme.applyTokens({ [tokenName]: input.value })
      })
      label.appendChild(input)
      form.appendChild(label)
    }
    container.appendChild(form)
    formEl = form
    containerRef = container
  }

  function destroy(): void {
    if (
      formEl != null &&
      containerRef != null &&
      formEl.parentNode === containerRef
    ) {
      containerRef.removeChild(formEl)
    }
    formEl = null
    containerRef = null
  }

  return { render, destroy }
}
