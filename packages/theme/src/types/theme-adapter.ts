/**
 * Theme adapter contract — bridge tra canonical roles GlueZero e DS sottostante
 * (Tailwind/Bootstrap/Material/shadcn). Plan W4 implementa registry; plan W5
 * implementa apply.
 *
 * Un adapter espone:
 * - `roleMap`: mapping `role canonical → DS class names` (es.
 *   `'action.primary' → 'btn btn-primary'` per Bootstrap).
 * - `cssRules`: mapping `role canonical → CSS rule body` (alternativa a class
 *   names, per DS senza utility classes).
 *
 * Solo uno tra `roleMap` e `cssRules` deve essere fornito (XOR esclusivo;
 * validazione in plan W4 register-adapter).
 */
export interface ThemeAdapter {
  /** ID univoco adapter (es. 'tailwind', 'bootstrap', 'material'). */
  readonly id: string
  /** Mapping role → DS classes (es. `{ 'action.primary': 'btn btn-primary' }`). */
  readonly roleMap?: Readonly<Record<string, string>>
  /** Mapping role → CSS rule body (es. `{ 'action.primary': 'background: var(--gz-color-primary); ...' }`). */
  readonly cssRules?: Readonly<Record<string, string>>
}

/**
 * Options per `registerAdapter` (W4).
 *
 * - `override`: consenti rimpiazzare adapter con stesso ID (default `false`).
 *   Se `false` + ID duplicato → throw `theme.adapter.duplicate`.
 * - `ownerPluginId`: tracking owner per cleanup (Open Q4 + LIFE-02).
 */
export interface RegisterAdapterOptions {
  override?: boolean
  ownerPluginId?: string
}
