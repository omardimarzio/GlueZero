// TransformFn / TransformDescriptor / TransformContext (PRD §14.6, REQ MAP-12).
//
// Riferimento decisioni (02-CONTEXT.md):
// - D-31: API pubblica `registerTransform(name, fn)` — coerente con `registerPlugin/Route` di F1.
// - D-44: `onFailure: 'block' | 'skip' | 'fallback'` decide cosa fare su throw del transform.
// - D-45: errore wrapped in `BrokerError 'mapping.transform.failed'` con `originalError`+`cause` ES2022.
//
// `TransformName` è branded (Pitfall #12) — solo cast esplicito permette di instanziare.
//
// `TransformContext` espone al transform un sotto-insieme readonly del runtime broker:
//   - `logger` (per debug log strutturati)
//   - `pluginId` (chi ha pubblicato l'evento — utile per error attribution)
//   - `fieldName` (quale field canonical si sta producendo)
//   - `canonicalSchemaId` (a quale schema il field appartiene — opzionale)
//
// Threat coverage:
// - T-02-02-01 (Tampering — type confusion `CanonicalSchemaId` ↔ `TransformName`): brand symbols
//   distinti garantiscono che un id schema non venga passato come transform name e viceversa.

import type { BrokerLogger } from '@gluezero/core'
import type { CanonicalSchemaId } from './canonical-schema'

declare const __transformNameBrand: unique symbol

/**
 * Branded type per nome transform (Pitfall #12 — type confusion prevention).
 * Solo cast esplicito `as TransformName` permette di "instanziare" il tipo.
 */
export type TransformName = string & { readonly [__transformNameBrand]: true }

/**
 * Contesto readonly passato al transform a runtime (D-44).
 *
 * Il transform può loggare via `ctx.logger`, leggere `pluginId`/`fieldName`/`canonicalSchemaId`
 * per error attribution. NON può mutare nulla.
 */
export interface TransformContext {
  readonly logger: BrokerLogger
  readonly pluginId: string
  readonly fieldName: string
  readonly canonicalSchemaId?: CanonicalSchemaId
}

/**
 * Signature di un transform registrato.
 *
 * Input `unknown` per supportare i casi mixed (rename, format, derive — il caller passa
 * il valore del source field). Output `unknown` perché il mapper-engine validerà il tipo
 * canonico atteso al passo 6 (canonical validation) via `ValidatorAdapter`.
 *
 * Su throw, il mapper-engine applica D-44 onFailure policy del field e — su `'block'` —
 * wrappa l'errore in `BrokerError 'mapping.transform.failed'` con `originalError`/`cause` (D-45).
 */
export type TransformFn = (input: unknown, ctx: TransformContext) => unknown

/**
 * Descrittore di un transform registrato via `registerTransform(name, fn)` (D-31).
 *
 * `name` è il nome lookup (string per ergonomia; il cast a `TransformName` avviene
 * al register interno per audit branding). `description` opzionale per Inspector debug.
 */
export interface TransformDescriptor {
  readonly name: string
  readonly fn: TransformFn
  readonly description?: string
}
