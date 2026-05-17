/**
 * `CompatibilityPolicy` — enum union 5 valori (PRD §20.6). Default `'warn'` (D-12-02).
 *
 * Controlla **dove** nel lifecycle FSM F8 il check di compatibilità diventa bloccante;
 * il check stesso viene SEMPRE calcolato (anche con `'off'` nessun compute) per produrre
 * `CompatibilityReport` consumabile via `getCompatibilityReport(id)` e topic governance.
 *
 * - `'off'` — nessun check (no emit, no throw, no compute). Disabilita completamente
 *   il modulo per debugging o ambienti dev/staging.
 * - `'warn'` — compute + emit `microfrontend.compatibility.warning` (warnings populated)
 *   o `microfrontend.compatibility.failed` (errors populated), MAI throw. Default safe.
 * - `'block-registration'` — throw `CompatError` sync su `broker.registerMicroFrontend(desc)`
 *   → MF NON entra nel registry (D-12-03). Coerente con pattern v1.x throw su register invalidi.
 * - `'block-load'` — throw async su `broker.loadMicroFrontend(id)` (post-register, pre-load)
 *   → FSM transition → `failed` con `failureReason.phase = 'load'` (D-12-04).
 *   In F12 `'block-load'` è FUNZIONALE (NON alias di `'block-mount'` come in F11 capability
 *   policy — OQ-3 resolution: F12 lifecycle FSM F8 distingue trigger load vs mount).
 * - `'block-mount'` — throw async su `broker.mountMicroFrontend(id)` → FSM transition →
 *   `failed` con `failureReason.phase = 'mount'` (D-12-04).
 *
 * Su ogni block: emit `microfrontend.compatibility.failed` PRIMA del throw (D-12-05).
 *
 * Estende il pattern F11 `CapabilityPolicy` (4 valori) con `'block-registration'` nuovo per F12
 * (F11 non distingue trigger registration perché capability resolution è run-time per-publish).
 *
 * @see prd_2.0.0.md §20.6 — CompatibilityPolicy 5 valori
 * @see D-12-02 — default `'warn'`
 * @see D-12-03/04/05 — trigger point + topic emission semantics
 */
export type CompatibilityPolicy =
  | 'off'
  | 'warn'
  | 'block-registration'
  | 'block-load'
  | 'block-mount'
