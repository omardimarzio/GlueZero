/**
 * MicroFrontend mount definition types (PRD §11.2, MF-MOUNT-01..03).
 *
 * 4 strategies: `direct` (DOM diretto) | `shadow-dom` (Shadow DOM isolation)
 * | `iframe` (iframe isolation) | `custom` (callback consumer-driven).
 *
 * @see RESEARCH §13.W4 + PATTERNS §26
 */

/** Strategia di mount del MF (PRD §11.2 MF-MOUNT-01). */
export type MountStrategy = 'direct' | 'shadow-dom' | 'iframe' | 'custom'

/**
 * Definizione del mount del MF.
 *
 * Almeno uno tra `selector` e `element` DEVE essere fornito (validato runtime
 * dal mount-orchestrator, non a livello schema).
 *
 * MF-MOUNT-02: selector non-trovato → `MF_MOUNT_TARGET_NOT_FOUND`; `element` prevale.
 * MF-MOUNT-03: `shadow-dom` / `iframe` requirement dichiarati.
 */
export interface MicroFrontendMountDefinition {
  /** CSS selector del container (alternativa a `element`). */
  readonly selector?: string

  /** HTMLElement reference diretto (prevale su `selector`). Runtime-checked. */
  readonly element?: unknown // HTMLElement (no runtime type per portability isomorfica)

  /** Strategia di mount. Default `'direct'`. */
  readonly strategy?: MountStrategy

  /** ID custom container creato dall'orchestrator. */
  readonly containerId?: string

  /** Pulisce il container prima del mount (default false). */
  readonly clearBeforeMount?: boolean

  /** Mantiene il DOM dopo unmount (default false). */
  readonly preserveOnUnmount?: boolean

  /** Attributi HTML applicati al container. */
  readonly attributes?: Readonly<Record<string, string>>

  /** Class CSS applicata al container. */
  readonly className?: string

  /** Style inline applicato al container. */
  readonly style?: Readonly<Record<string, string>>

  /** Options strategy-specific (es. `shadowRootMode: 'open' | 'closed'`). */
  readonly options?: Readonly<Record<string, unknown>>
}
