/**
 * @sembridge/mapper — Canonical model + bidirectional mapper per SemBridge.
 *
 * Phase 2 di SemBridge V1. Estende `@sembridge/core` (Phase 1) con:
 * - Canonical Vocabulary Registry (campi tipizzati, alias riconosciuti, requires)
 * - Mapper bidirezionale (locale → canonico → locale per ogni consumer)
 * - Transform Pipeline (rename, nested, default, transform, derive, partial)
 * - Validation adapter (Valibot 1.x default; Zod/Ajv deferred a V2)
 * - Mapping Inspector (estensione EventTap con 5 nuovi step pipeline §28)
 *
 * Vincolo architetturale (D-49 — vedi 02-CONTEXT.md): NON modifica `bus.ts` di F1.
 * Estende la pipeline via composition wrapper + TS declaration merging del
 * `PipelineStep` union (file `augment.ts`, importato per side-effect).
 *
 * Surface pubblica: progressivamente popolata dai plan 02-02 → 02-12.
 *
 * @packageDocumentation
 */

// Side-effect import — abilita TS declaration merging per PipelineStep,
// PluginDescriptor.inputMap/outputMap, BrokerConfig sezioni canonicalModel/aliasRegistry/transforms.
// Vedi packages/mapper/src/augment.ts (creato nel plan 02-09).
// import './augment'  — verrà attivato in 02-09 quando augment.ts esisterà

// Runtime exports — popolati dai plan successivi:
// export { CanonicalRegistry } from './canonical-registry'      // plan 02-03
// export { AliasRegistry } from './alias-registry'              // plan 02-04
// export { TransformPipeline } from './transform-pipeline'      // plan 02-05
// export { valibotAdapter } from './valibot-adapter'            // plan 02-06
// export { MapperEngine } from './mapper-engine'                // plan 02-07

// Type exports — popolati dai plan successivi:
// export type * from './types'                                  // plan 02-02

export {}
