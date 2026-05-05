// BrokerLogger — interfaccia logger del broker (PRD §25.4, REQ CORE-10).
//
// Riferimento decisioni (CONTEXT 01):
// - D-12: ConsoleLogger di default con namespace prefix `[gluezero]`
// - D-13: adapter slot `setLogger(customLogger)` per swap a pino/winston/telemetry
// - D-14: surface minima `{error, warn, info, debug, trace}(message, meta?)` —
//   no structured JSON di default (mantiene DX in browser devtools)
//
// `silent` NON è un metodo dell'interfaccia — è un *livello* che, se settato,
// fa diventare tutti i metodi no-op nell'implementazione default `ConsoleLogger`
// (plan 04 — `console-logger.ts`). I 6 livelli sono: silent | error | warn | info | debug | trace.

/**
 * Log level: `silent` makes all methods no-op; otherwise `error < warn < info <
 * debug < trace`. Hierarchical filtering: configured level enables itself + lower.
 */
export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug' | 'trace'

/**
 * Logger interface used by the broker (PRD §25.4, REQ CORE-10).
 *
 * Surface intentionally minimal (D-14) — 5 methods accepting `message` + optional
 * structured `meta`. Default impl: `createConsoleLogger`. Swappable via
 * `Broker.setLogger` (D-13) for pino/winston/telemetry adapters.
 */
export interface BrokerLogger {
  error(message: string, meta?: Record<string, unknown>): void
  warn(message: string, meta?: Record<string, unknown>): void
  info(message: string, meta?: Record<string, unknown>): void
  debug(message: string, meta?: Record<string, unknown>): void
  trace(message: string, meta?: Record<string, unknown>): void
}
