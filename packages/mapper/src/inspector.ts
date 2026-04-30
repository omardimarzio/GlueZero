// MappingInspector — estensione `EventTap` di F1 per i 5 step F2 della pipeline §28
// (PRD §14.8, REQ MAP-15/MAP-16; D-46/D-47/D-48 in 02-CONTEXT.md).
//
// **Vincolo architetturale (D-46):** estende `EventTap` di F1 — NON è un'API parallela.
// Il broker wrapper (plan 02-10) compone questo inspector con il tap utente esistente
// tramite `wrapTap` helper, garantendo che entrambi vedano gli stessi step.
//
// **Scope F2 V1 (D-48):** Inspector reale full-snapshot per evento (payload before/after)
// è deferred a F6 (TOOL-01). F2 V1 espone solo:
//   - counter delle entità registrate (canonical schemas, alias globali, transform)
//   - ring buffer bounded degli ultimi N errori `mapping.*` (default 10) per debug
// `recordSnapshot` è no-op runtime in V1; F6 lo estenderà con storage per evento.
//
// Pattern F1 replicati:
// - `safeTapStep` di event-tap.ts (riga 23-34): try/catch swallow per non rompere il
//   chain del tap originale dentro `wrapTap` (T-02-08-03).
// - `BrokerDebugSnapshot` di broker.ts (riga 59-66): shape readonly per stats Inspector.
// - `[...this.errorBuffer]` spread copy: pattern F1 TopicRegistry/CanonicalRegistry
//   per prevenire mutation esterna del state interno (T-02-08-04).
//
// Threat coverage:
// - T-02-08-01 (DoS — error buffer cresce indefinitamente): bounded buffer con
//   `errorBufferSize` (default 10) + FIFO drop in `recordError`. Test "ring buffer
//   bounded" verifica.
// - T-02-08-02 (Information disclosure — error messages contengono PII): F2 V1
//   best-effort. Redaction obbligatoria sarà documentata in DOC-03 (plan 02-12)
//   per produzione; F6 fornirà hook di redaction esplicito.
// - T-02-08-03 (DoS — original tap throw rompe wrapTap chain): try/catch swallow
//   nel wrapTap (pattern F1 `safeTapStep`). Test verifica `recordSnapshot` chiamato
//   anche dopo throw del tap originale.
// - T-02-08-04 (Tampering — `lastErrors()` ritorna reference interno → mutation
//   esterna corrompe state): spread copy `[...this.errorBuffer]`. Test verifica.
// - T-02-08-05 (Repudiation — `recordSnapshot` no-op per F1 step → debug confuso):
//   intenzionale per V1; full per-event snapshot è scope F6 (D-48). JSDoc esplicita.
//
// `exactOptionalPropertyTypes: true` policy: `MappingInspectorOptions.errorBufferSize`
// è opzionale; valore default 10 viene risolto nel constructor.
// `isolatedDeclarations: true` enforcement: ogni metodo pubblico ha return type esplicito.

import type { BrokerError, EventTap, PipelineSnapshot, PipelineStep } from '@sembridge/core'
import type { AliasRegistry } from './alias-registry'
import type { CanonicalRegistry } from './canonical-registry'
import type { TransformPipeline } from './transform-pipeline'

/**
 * Opzioni per `MappingInspector` constructor.
 *
 * I tre registry sono iniettati read-only (D-48) per leggere statistiche tramite
 * i loro `list()` methods. `errorBufferSize` è il bound massimo del ring buffer
 * degli errori `mapping.*` registrati via `recordError` (default 10, T-02-08-01).
 */
export interface MappingInspectorOptions {
  readonly canonicalRegistry: CanonicalRegistry
  readonly aliasRegistry: AliasRegistry
  readonly transformPipeline: TransformPipeline
  readonly errorBufferSize?: number
}

/**
 * Snapshot leggero esposto da `MappingInspector.getSnapshot()` (D-48).
 *
 * Il broker wrapper (plan 02-10) include questo snapshot in `getDebugSnapshot().mappings`
 * per popolare l'API debug pubblica del Broker. Inspector reale full-snapshot per evento
 * è deferred a F6 (TOOL-01).
 */
export interface MappingInspectorSnapshot {
  readonly canonicalSchemas: number
  readonly registeredAliases: number
  readonly registeredTransforms: number
  readonly lastMappingErrors: BrokerError[]
}

/**
 * Estensione `EventTap` per i 5 nuovi step F2 della pipeline §28 (D-46).
 *
 * Sorgente delle statistiche `mappings` esposte dal `Broker.getDebugSnapshot()`
 * (D-48). Composizione tramite `wrapTap` helper col tap esistente (NON parallel API).
 *
 * @example
 * ```ts
 * const inspector = new MappingInspector({
 *   canonicalRegistry,
 *   aliasRegistry,
 *   transformPipeline,
 *   errorBufferSize: 20,
 * })
 *
 * // Composition col tap esistente (broker wrapper plan 02-10):
 * const composed = wrapTap(originalTap, inspector)
 * const broker = createBroker({ runtime: { tap: composed } })
 *
 * // Lettura stats (debug):
 * inspector.getSnapshot()
 * // → { canonicalSchemas: 3, registeredAliases: 5, registeredTransforms: 2,
 * //     lastMappingErrors: [...] }
 * ```
 */
export class MappingInspector {
  private readonly canonicalRegistry: CanonicalRegistry
  private readonly aliasRegistry: AliasRegistry
  private readonly transformPipeline: TransformPipeline
  private readonly errorBuffer: BrokerError[] = []
  private readonly errorBufferSize: number

  constructor(options: MappingInspectorOptions) {
    this.canonicalRegistry = options.canonicalRegistry
    this.aliasRegistry = options.aliasRegistry
    this.transformPipeline = options.transformPipeline
    this.errorBufferSize = options.errorBufferSize ?? 10
  }

  /**
   * Registra un'invocazione del tap (F1 + F2 step).
   *
   * **F2 V1: no-op runtime.** Il debug è esposto via `getSnapshot()` (counter +
   * lastErrors) — il full snapshot per evento (payload before/after, transform
   * applicati per evento) è deferred a F6 (TOOL-01) per evitare memory leak in
   * produzione (T-02-08-05 disposition: accept).
   *
   * Il metodo accetta sia gli step F1 (no-op pass-through) sia i 5 nuovi step F2
   * dichiarati via TS declaration merging in `augment.ts` (plan 02-09):
   * `event.source.resolved`, `event.mapped.canonical`, `event.canonical.validated`,
   * `event.mapped.consumer`, `event.final.validated`.
   *
   * @param _step - Pipeline step (F1 o F2).
   * @param _snapshot - Snapshot dello step.
   */
  recordSnapshot(_step: PipelineStep, _snapshot: PipelineSnapshot): void {
    // F2 V1: no-op intenzionale. F6 (TOOL-01) popolerà ring buffer per evento.
  }

  /**
   * Aggiunge un errore `mapping.*` al ring buffer.
   *
   * Il buffer è bounded a `errorBufferSize` (default 10): se la dimensione
   * eccede, il più vecchio viene scartato (FIFO drop) — T-02-08-01 mitigation.
   *
   * Il broker wrapper (plan 02-10) chiama questo metodo dal mapper-engine quando
   * intercetta errori `mapping.cycle.detected`, `mapping.field.missing`,
   * `mapping.transform.failed`, `mapping.canonical.validation.failed`,
   * `mapping.consumer.validation.failed`.
   *
   * @param error - `BrokerError` con `category: 'mapping'`.
   */
  recordError(error: BrokerError): void {
    this.errorBuffer.push(error)
    if (this.errorBuffer.length > this.errorBufferSize) {
      this.errorBuffer.shift() // FIFO drop oldest
    }
  }

  /**
   * Ritorna copia degli ultimi N errori `mapping.*` registrati.
   *
   * Spread copy garantisce che mutation esterna del result NON corrompa lo state
   * interno del buffer (T-02-08-04).
   *
   * @returns Array di `BrokerError` (copia fresca ad ogni chiamata).
   */
  lastErrors(): BrokerError[] {
    return [...this.errorBuffer]
  }

  /**
   * Svuota il ring buffer degli errori.
   *
   * Utile per test e per reset esplicito post-debug session. NON invocato
   * automaticamente — il caller (broker wrapper / consumer debug) decide policy.
   */
  clearErrors(): void {
    this.errorBuffer.length = 0
  }

  /**
   * Ritorna lo snapshot leggero per `Broker.getDebugSnapshot().mappings` (D-48).
   *
   * I counter sono lette via `list().length` dei tre registry; `lastMappingErrors`
   * è copia spread del ring buffer interno (T-02-08-04).
   *
   * @returns Snapshot con counter + ultimi errori.
   */
  getSnapshot(): MappingInspectorSnapshot {
    return {
      canonicalSchemas: this.canonicalRegistry.list().length,
      registeredAliases: this.aliasRegistry.listGlobal().length,
      registeredTransforms: this.transformPipeline.list().length,
      lastMappingErrors: this.lastErrors(),
    }
  }
}

/**
 * Helper composition: wrappa un tap esistente con il `MappingInspector` (D-46).
 *
 * Pattern composition (NON parallel API): il tap risultante chiama PRIMA
 * `inspector.recordSnapshot` e POI il tap originale (WR-04 fix — l'Inspector
 * vede sempre uno snapshot pristine, indipendentemente da eventuali mutation
 * dello stesso `snapshot` object da parte del tap utente). Errori del tap
 * originale sono swallowed (pattern F1 `safeTapStep` di event-tap.ts:23-34)
 * per non rompere il chain del tap composto (T-02-08-03 mitigation).
 *
 * Il broker wrapper (plan 02-10) usa questo helper per istanziare il tap finale:
 * ```ts
 * const composedTap = wrapTap(config.runtime?.tap ?? noopEventTap, inspector)
 * ```
 *
 * NB: il `recordSnapshot` dell'Inspector è no-op in F2 V1 (D-48); la mutation
 * concern di `snapshot` è preventiva — si attiva solo quando F6 popolerà il
 * ring buffer per evento. Cambiare ordine ora previene retrofit semantici poi.
 *
 * Async tap: se `original.onPipelineStep` ritorna una Promise rejected, il throw
 * non è catturato (Promise rejection != sync throw). Documentato come limitation
 * accept — i tap utente devono gestire le proprie Promise internamente (T-02-08-03).
 *
 * @param original - Tap originale fornito dal consumer (può essere `noopEventTap`).
 * @param inspector - Istanza `MappingInspector` da comporre.
 * @returns `EventTap` composito che invoca entrambi.
 */
export function wrapTap(original: EventTap, inspector: MappingInspector): EventTap {
  return {
    onPipelineStep(step, snapshot): void {
      // WR-04 fix: Inspector PRIMA del tap utente — vede sempre snapshot pristine.
      // recordSnapshot è no-op in F2 V1 ma il try/catch è preventivo per F6.
      try {
        inspector.recordSnapshot(step, snapshot)
      } catch {
        // Inspector non deve mai rompere il chain (defensive — F2 V1 no-op).
      }
      try {
        original.onPipelineStep(step, snapshot)
      } catch {
        // Swallow — il tap originale non deve rompere il chain (T-02-08-03,
        // pattern F1 safeTapStep).
      }
    },
  }
}
