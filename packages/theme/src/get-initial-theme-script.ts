/**
 * Helper IIFE inline blocking pre-paint per anti-FOUC (Pitfall HIGH #1).
 *
 * Setta `data-gz-theme` + `data-gz-mode` su `<html>` PRIMA del paint, evitando
 * il flicker di colori errati durante il frame 1. Pattern Material/Radix/
 * Vercel/shadcn convergente: helper ritorna SOLO il body IIFE, il consumer è
 * responsabile dell'inserimento in `<script>` tag (eventualmente con `nonce`
 * per CSP-strict — Open Q2).
 *
 * @example Uso tipico in HTML statico:
 * ```html
 * <head>
 *   <link rel="stylesheet" href="/path/to/tokens-default.css">
 *   <script>${getInitialThemeScript()}</script>
 * </head>
 * ```
 *
 * @example Uso con persistenza opt-in (D-F7-12 default OFF):
 * ```ts
 * const script = getInitialThemeScript({ persistence: 'localStorage' })
 * // → IIFE che legge `localStorage.getItem('gluezero.theme.mode')` + fallback OS detection
 * ```
 *
 * Threat model: T-F7-02 (InformationDisclosure) mitigato — lettura localStorage
 * gated dietro `opts.persistence === 'localStorage'` esplicito; try/catch
 * silenzia accesso negato (CSP/privacy mode/SSR). T-F7-05 (XSS) mitigato — body
 * statico zero user-input interpolation.
 *
 * Refs: 07-CONTEXT.md D-F7-12 + Pitfall HIGH #1; 07-RESEARCH.md Open Q1/Q2/Q3.
 */
export interface GetInitialThemeScriptOptions {
  /**
   * Persistenza opt-in (D-F7-12 default OFF).
   * - `false` (default): IIFE non legge localStorage, fa solo OS detection.
   * - `'localStorage'`: legge `gluezero.theme.mode` (Open Q3 — 4 chiavi separate
   *    `gluezero.theme.{mode,density,direction,adapter}`).
   */
  persistence?: false | 'localStorage'
}

/**
 * Ritorna il body IIFE auto-contenuto (~30 LoC) come stringa, da inserire in
 * `<script>` nel `<head>` del documento.
 *
 * Il body:
 * 1. Legge mode da localStorage (se `persistence === 'localStorage'`) o usa 'auto'.
 * 2. Risolve 'auto' via `matchMedia('(prefers-color-scheme: dark)')`.
 * 3. Setta `data-gz-theme` (resolved) + `data-gz-mode` (user-selected) su `<html>`.
 * 4. Try/catch silent fallback su 'light'/'auto' per resilienza SSR + privacy mode.
 *
 * Output deterministico — zero user-input interpolation (T-F7-05 mitigation).
 *
 * @param opts - Opzioni configurazione (default `{ persistence: false }`).
 * @returns Stringa IIFE pronta per `<script>`.
 *
 * @example SSR Next.js — inject in `<head>` build-time
 * ```ts
 * // app/layout.tsx (Next.js App Router)
 * <script
 *   nonce={cspNonce}
 *   dangerouslySetInnerHTML={{
 *     __html: getInitialThemeScript({ persistence: 'localStorage' }),
 *   }}
 * />
 * ```
 *
 * @see Pitfall HIGH #1 anti-FOUC mitigation
 * @see D-F7-12 (persistenza default OFF)
 */
export function getInitialThemeScript(opts: GetInitialThemeScriptOptions = {}): string {
  const persistence = opts.persistence ?? false
  const readMode =
    persistence === 'localStorage' ? "localStorage.getItem('gluezero.theme.mode')" : 'null'
  return `(function(){
try {
  var mode = ${readMode};
  if (mode !== 'light' && mode !== 'dark' && mode !== 'auto') mode = 'auto';
  var resolved = mode;
  if (mode === 'auto') {
    resolved = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-gz-theme', resolved);
  document.documentElement.setAttribute('data-gz-mode', mode);
} catch (e) {
  document.documentElement.setAttribute('data-gz-theme', 'light');
  document.documentElement.setAttribute('data-gz-mode', 'auto');
}
})();`
}
