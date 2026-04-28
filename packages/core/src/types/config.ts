// BrokerConfig — config globale broker (PRD §27, REQ CORE-14).
//
// Coverage CORE-14: la firma include TUTTE le sezioni del PRD §27 anche se F1 non le usa,
// così F2-F6 estendono il tipo via TypeScript declaration merging senza breaking change.
//
// F1 sezioni implementate:
//   - `runtime`: debug, deepFreezeInDev, logLevel, logger, tap (tutti opzionali)
//   - `debug`: enabled, snapshotPayloadsFull
//
// F2-F6 sezioni placeholder (validate come `valibot.unknown()` in `public-factory.ts` di plan 08,
// ignored at runtime in F1):
//   - `topicSchemas` (F2)
//   - `canonicalModel` (F2)
//   - `aliasRegistry` (F2)
//   - `transforms` (F2)
//   - `routes` (F3)
//   - `transport` (F3/F4)
//   - `workers` (F5)
//   - `cache` (F6)
//
// Riferimento decisione D-29 (CONTEXT 01): `runtime.debug` (default: `import.meta.env.DEV`)
// attiva deep-freeze runtime + verbose logging + tap snapshot full payload.

import type { BrokerLogger, LogLevel } from './logger'
import type { EventTap } from './tap'

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

  // F2-F6 placeholder sections (validated as `unknown` in F1, ignored at runtime):
  topicSchemas?: unknown
  canonicalModel?: unknown
  aliasRegistry?: unknown
  transforms?: unknown
  routes?: unknown
  transport?: unknown
  workers?: unknown
  cache?: unknown
}
