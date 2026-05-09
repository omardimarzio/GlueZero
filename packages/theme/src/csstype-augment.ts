/**
 * Module augmentation `csstype` per IDE autocomplete + compile-time check
 * sui token canonici (D-F7-21 + Pattern 6).
 *
 * Permette di scrivere:
 * ```tsx
 * <div style={{ '--gz-color-primary': '#FF6B35' }} />
 * ```
 * con autocomplete attivo sui 10 branded core (D-F7-21) e fallback
 * string-typed via template literal `--gz-${string}` per il resto.
 *
 * **Zero runtime cost** — produce SOLO declaration merge a build-time. Il
 * file è importato come side-effect dal `src/index.ts` per garantire che
 * TypeScript carichi l'augmentation.
 */
import type {} from 'csstype'

declare module 'csstype' {
  interface Properties {
    // 10 branded core token (D-F7-21) — IDE autocomplete attivo
    '--gz-color-primary'?: string
    '--gz-color-on-primary'?: string
    '--gz-color-surface'?: string
    '--gz-color-text'?: string
    '--gz-color-text-muted'?: string
    '--gz-color-error'?: string
    '--gz-color-success'?: string
    '--gz-spacing-md'?: string
    '--gz-radius-md'?: string
    '--gz-motion-medium'?: string
    // Resto string-typed via template literal — estendibile downstream
    [key: `--gz-${string}`]: string | undefined
  }
}

// Marker export per garantire che TypeScript tratti questo come module e carichi
// l'augmentation a livello di compilation.
export {}
