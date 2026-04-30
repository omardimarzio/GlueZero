// TransformPipeline — registry + executor di transform per il mapper (PRD §14.6, REQ MAP-12).
//
// Riferimento decisioni (02-CONTEXT.md):
// - D-31: API pubblica `registerTransform(name, fn)` — coerente con register pattern F1.
// - D-44: VAL-09 chiusura PRD §39 #4 — `onFailure: 'block' | 'skip' | 'fallback'` decide
//   cosa fare su throw del transform.
// - D-45: errore wrapped in `BrokerError 'mapping.transform.failed'` con `originalError`+`cause`
//   ES2022. createBrokerError di F1 fa già il wiring (broker-error.ts:51-54).
// - D-26 ext F2: `unregisterByOwner(pluginId)` cascade plugin unregister (wired al broker
//   wrapper plan 02-10).
//
// Pattern try/catch shape: identico a `safeTapStep` (event-tap.ts:23-34) ma con
// escalation policy invece di silent swallow.
//
// Threat coverage:
// - T-02-05-01 (DoS — transform throw collassa publish): try/catch + onFailure policy.
//   Default 'block' → publish `mapping.error` (gestito da mapper-engine plan 02-07);
//   'skip' / 'fallback' permettono delivery degraded.
// - T-02-05-02 (Tampering — wrapped error perde stack trace originale): `createBrokerError`
//   mantiene `originalError` + ES2022 `cause` chaining (broker-error.ts:51-54).
// - T-02-05-03 (Repudiation — transform anonimo no-ownerId): cascade salta entry senza
//   ownerId (intenzionale: transform globali). Cleanup manuale via `unregister(name)`.
// - T-02-05-04 (Spoofing — register transform name che shadow): throw `transform.id.duplicate`
//   indipendentemente da ownerId. Plugin deve usare naming distinct.
// - T-02-05-05 (Tampering — non-Error throw value perde info): `err instanceof Error ?
//   err.message : String(err)` preserva messaggio anche su `throw 'string'`.

import { createBrokerError } from '@sembridge/core'
import type { FieldFailureMode } from './types/canonical-schema'
import type { TransformContext, TransformDescriptor, TransformFn } from './types/transform'

interface TransformEntry {
  readonly descriptor: TransformDescriptor
  readonly ownerId?: string
}

/**
 * Opzioni per `register(name, fn, options?)`.
 *
 * - `description`: stringa descrittiva opzionale (per Inspector debug F6)
 * - `ownerId`: id del plugin proprietario (cascade D-26 ext F2 — `unregisterByOwner`)
 */
export interface RegisterTransformOptions {
  readonly description?: string
  readonly ownerId?: string
}

/**
 * Registry + executor di transform pluggable per il mapper.
 *
 * Il consumer (mapper-engine plan 02-07) chiama `apply(name, input, ctx, onFailure, defaultValue?)`
 * durante la compilazione runtime del mapping per ciascun field. La pipeline applica D-44
 * onFailure policy in modo deterministico per ogni field secondo `FieldDescriptor.onFailure`.
 *
 * @example
 * ```ts
 * const pipeline = new TransformPipeline()
 * pipeline.register('parseItalianDate', (input) => {
 *   const [d, m, y] = String(input).split('/')
 *   return `${y}-${m}-${d}`
 * }, { ownerId: 'plugin-form' })
 *
 * const result = pipeline.apply('parseItalianDate', '30/04/2026', ctx, 'block')
 * // → '2026-04-30'
 * ```
 */
export class TransformPipeline {
  private readonly transforms = new Map<string, TransformEntry>()

  /**
   * Registra un transform con il `name` fornito.
   *
   * @throws BrokerError `transform.id.duplicate` se `name` è già registrato (D-17 pattern F1).
   */
  register(name: string, fn: TransformFn, options: RegisterTransformOptions = {}): void {
    if (this.transforms.has(name)) {
      throw createBrokerError({
        code: 'transform.id.duplicate',
        category: 'mapping',
        message: `Transform name "${name}" is already registered.`,
        details: { name },
      })
    }
    const descriptor: TransformDescriptor = {
      name,
      fn,
      ...(options.description !== undefined && { description: options.description }),
    }
    const entry: TransformEntry = {
      descriptor,
      ...(options.ownerId !== undefined && { ownerId: options.ownerId }),
    }
    this.transforms.set(name, entry)
  }

  /** Ritorna `true` se un transform con `name` è registrato. */
  has(name: string): boolean {
    return this.transforms.has(name)
  }

  /** Ritorna il `TransformDescriptor` se registrato, altrimenti `undefined`. */
  get(name: string): TransformDescriptor | undefined {
    return this.transforms.get(name)?.descriptor
  }

  /**
   * Applica il transform `name` all'input con `ctx` e applica D-44 onFailure policy.
   *
   * Il caller (mapper-engine plan 02-07) passa `defaultValue` quando `onFailure: 'fallback'`
   * e il field ha `default: T` configurato in `FieldDescriptor`. Se il caller non passa
   * un default e il transform throw con onFailure 'fallback', si applica il downgrade a 'skip'
   * (return undefined) — coerente con D-44.
   *
   * @throws BrokerError `transform.not-found` se `name` non registrato.
   * @throws BrokerError `mapping.transform.failed` se transform throw E onFailure === 'block'.
   */
  apply(
    name: string,
    input: unknown,
    ctx: TransformContext,
    onFailure: FieldFailureMode,
    defaultValue?: unknown,
  ): unknown {
    const entry = this.transforms.get(name)
    if (!entry) {
      throw createBrokerError({
        code: 'transform.not-found',
        category: 'mapping',
        message: `Transform "${name}" is not registered.`,
        details: { name },
      })
    }
    try {
      return entry.descriptor.fn(input, ctx)
    } catch (err) {
      const wrapped = createBrokerError({
        code: 'mapping.transform.failed',
        category: 'mapping',
        message: err instanceof Error ? err.message : String(err),
        ...(err instanceof Error && { originalError: err }),
        details: {
          pluginId: ctx.pluginId,
          fieldName: ctx.fieldName,
          transformName: name,
        },
      })

      if (onFailure === 'block') throw wrapped
      if (onFailure === 'skip') return undefined
      // 'fallback': use defaultValue if provided, else downgrade to skip (undefined)
      return defaultValue
    }
  }

  /** Ritorna i nomi dei transform registrati, ordinati alfabeticamente, in una copia fresca. */
  list(): string[] {
    return [...this.transforms.keys()].sort()
  }

  /**
   * Rimuove un transform. Ritorna `true` se rimosso, `false` se non esisteva.
   */
  unregister(name: string): boolean {
    return this.transforms.delete(name)
  }

  /**
   * Cascade D-26 ext F2: rimuove tutti i transform con `ownerId === pluginId`.
   * I transform senza ownerId (globali) vengono mantenuti — vedi T-02-05-03 disposition.
   *
   * WR-05 fix: collect-then-delete pattern — evita mutation del Map durante
   * l'iterazione (formalmente safe per JS Map iteration semantics ma anti-pattern
   * stylistic e segnalato da alcuni lint rules).
   *
   * @returns numero di transform rimossi
   */
  unregisterByOwner(pluginId: string): number {
    const toDelete: string[] = []
    for (const [name, entry] of this.transforms) {
      if (entry.ownerId === pluginId) toDelete.push(name)
    }
    for (const name of toDelete) {
      this.transforms.delete(name)
    }
    return toDelete.length
  }
}
