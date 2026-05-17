/**
 * `MicroFrontendThemePolicy` — Policy theme 8-chiavi (PRD §11.2 + MF-INT-THEME-01).
 *
 * Definisce override theme per-MF su 8 dimensioni: `enabled`, `roles`, `tokens`,
 * `adapter`, `inherit`, `localOverrides`, `directionAware`, `densityAware`.
 *
 * Aggiunto a `MicroFrontendDescriptor` via declaration merging in
 * `@gluezero/isolation/types/descriptor-augment.ts` (Pattern S1 stretto — NO diff
 * `packages/microfrontends/src/` — D-83 strict).
 *
 * ## Adapter signature deferral
 *
 * `adapter?: string` placeholder W1 (CONTEXT.md Claude's Discretion). W2 può estendere
 * a `string | ((token: string, value: string) => string)` callback se richiesto da
 * MF-INT-THEME-02/03 transform pipeline. Decisione deferita per evitare lock-in W1.
 *
 * @see prd_2.0.0.md §11.2 — Theme policy 8-key
 * @see MF-INT-THEME-01..04 — Theme inheritance + transform + roles
 */
export interface MicroFrontendThemePolicy {
  readonly enabled?: boolean
  readonly roles?: readonly string[]
  readonly tokens?: Readonly<Record<string, string>>
  readonly adapter?: string
  readonly inherit?: boolean
  readonly localOverrides?: Readonly<Record<string, string>>
  readonly directionAware?: boolean
  readonly densityAware?: boolean
}
