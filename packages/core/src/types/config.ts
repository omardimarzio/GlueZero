// BrokerConfig — config globale broker (PRD §27, REQ CORE-14).
//
// Coverage CORE-14: la firma include TUTTE le sezioni del PRD §27 anche se F1 non le usa,
// così F2-F6 estendono il tipo via TypeScript declaration merging senza breaking change.
//
// F1 sezioni implementate:
//   - `runtime`: debug, deepFreezeInDev, logLevel, logger, tap (tutti opzionali)
//   - `debug`: enabled, snapshotPayloadsFull
//
// F2-F6 sezioni: aggiunte via TS declaration merging dai package downstream (D-56):
//   - F2 `@gluezero/mapper/src/augment.ts` aggiunge `canonicalModel`, `aliasRegistry`, `transforms`
//   - F3 aggiungerà `routes`, `transport`
//   - F5 aggiungerà `workers`
//   - F6 aggiungerà `cache`
//
// F1 sezioni placeholder (validate come `valibot.unknown()` in `public-factory.ts` di plan 08,
// ignored at runtime in F1, sempre tipate `unknown` perché senza wiring a package F2-F6):
//   - `topicSchemas` (F2 — non augmentato perché topic schema strategy V2)
//
// Riferimento decisione D-29 (CONTEXT 01): `runtime.debug` (default: `import.meta.env.DEV`)
// attiva deep-freeze runtime + verbose logging + tap snapshot full payload.

import type { BrokerLogger, LogLevel } from './logger'
import type { EventTap } from './tap'

/**
 * Global broker configuration (PRD §27, REQ CORE-14).
 *
 * F1 implements the `runtime` and `debug` sections; F2-F6 sections
 * (`canonicalModel`, `aliasRegistry`, `transforms`, `routes`, `transport`,
 * `workers`, `cache`) are added via TypeScript declaration merging by the
 * downstream packages (`@gluezero/mapper` for F2, etc.). They are accepted
 * but ignored at runtime in F1 — Valibot schema accepts them as `unknown`
 * via index-signature pass-through in `public-factory.ts` (no breaking change).
 *
 * `topicSchemas` rimane `unknown` placeholder F1 (no augment in F2 — topic
 * schema strategy è V2 deferred).
 *
 * `runtime.debug` defaults to `import.meta.env.DEV` when available (D-29) and
 * activates deep-freeze runtime + verbose tap snapshots.
 */
export interface BrokerConfig {
  // F1 sections (implemented):
  runtime?: {
    debug?: boolean
    deepFreezeInDev?: boolean
    logLevel?: LogLevel
    logger?: BrokerLogger
    tap?: EventTap
  }
  debug?: {
    enabled?: boolean
    snapshotPayloadsFull?: boolean
  }

  // F2 placeholder section (kept as `unknown` — augment NOT planned per topic
  // schema strategy V2 deferred):
  topicSchemas?: unknown

  // F2-F6 sections: aggiunte via TS declaration merging dai package downstream
  // (D-56 — packages/mapper/src/augment.ts per canonicalModel/aliasRegistry/transforms).
  // NON dichiarate qui: il declaration merging delle interface richiede che gli
  // augment NON entrino in conflitto con field già dichiarati con tipo diverso.
}
