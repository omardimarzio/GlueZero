// Console-based BrokerLogger di default (PRD §25.4, REQ CORE-10, decisioni D-12, D-13, D-14).
//
// Mapping livelli → metodi (D-12):
//   silent  → no-op completo (nessun console method invocato)
//   error   → console.error
//   warn    → console.warn
//   info    → console.info
//   debug   → console.debug
//   trace   → console.debug (con prefisso TRACE per distinzione visiva — D-12)
//
// Filtering: ogni metodo controlla `LEVEL_ORDER[level] >= LEVEL_ORDER[targetMethod]`.
// Es. logger configurato a `info` → `debug` no-op (info=3, debug=4 → 3<4 → skip).
//
// Namespace prefix `[sembridge]` come primo argomento (D-12) — sempre presente,
// permette filtering nei browser devtools.
//
// `silentLogger` esporta i 5 metodi BrokerLogger come no-op — utility comoda per test
// e per consumer che vogliono disattivare logging senza configurare livello `silent`.

import type { BrokerLogger, LogLevel } from '../types/logger'

const LEVEL_ORDER: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5,
}

const PREFIX = '[sembridge]'

/**
 * Create a console-based {@link BrokerLogger} (PRD §25.4, REQ CORE-10).
 *
 * Mapping levels → methods (D-12):
 * - `silent` → no-op
 * - `error` → `console.error`
 * - `warn` → `console.warn`
 * - `info` → `console.info`
 * - `debug` → `console.debug`
 * - `trace` → `console.debug` (with `TRACE` prefix)
 *
 * Filtering: each method checks `LEVEL_ORDER[level] >= LEVEL_ORDER[targetMethod]`.
 *
 * Namespace prefix `[sembridge]` is always present (D-12) — enables filtering
 * in browser devtools.
 *
 * @param level - Minimum log level (default `'info'`).
 * @returns A {@link BrokerLogger} backed by `console`.
 *
 * @example
 * ```ts
 * const logger = createConsoleLogger('debug')
 * logger.info('broker started', { id: 'main' })
 * // [sembridge] [INFO] broker started { id: 'main' }
 * ```
 */
export function createConsoleLogger(level: LogLevel = 'info'): BrokerLogger {
  const enabled = (target: LogLevel): boolean => LEVEL_ORDER[level] >= LEVEL_ORDER[target]

  const fmt = (label: string, msg: string, meta?: Record<string, unknown>): unknown[] =>
    meta !== undefined ? [`${PREFIX} [${label}]`, msg, meta] : [`${PREFIX} [${label}]`, msg]

  return {
    error(message, meta) {
      if (enabled('error')) console.error(...fmt('ERROR', message, meta))
    },
    warn(message, meta) {
      if (enabled('warn')) console.warn(...fmt('WARN', message, meta))
    },
    info(message, meta) {
      if (enabled('info')) console.info(...fmt('INFO', message, meta))
    },
    debug(message, meta) {
      if (enabled('debug')) console.debug(...fmt('DEBUG', message, meta))
    },
    trace(message, meta) {
      if (enabled('trace')) console.debug(...fmt('TRACE', message, meta))
    },
  }
}

/**
 * No-op {@link BrokerLogger} — all 5 methods are empty functions.
 *
 * Useful for tests and for consumers that want to disable logging without
 * configuring `level: 'silent'`.
 */
export const silentLogger: BrokerLogger = {
  error: () => {},
  warn: () => {},
  info: () => {},
  debug: () => {},
  trace: () => {},
}
