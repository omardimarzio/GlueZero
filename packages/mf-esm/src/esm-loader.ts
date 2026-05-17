/**
 * `esmLoader` — Loader concreto `MicroFrontendLoaderAdapter` con `type: 'esm'`
 * (D-V2-F9-04 const no-args lockato — NON factory).
 *
 * Carica un modulo MF via `import(url)` dinamico con enforcement timeout (default
 * 15000 ms da PRD §23.4, override per-MF via `descriptor.loader.timeoutMs`), compone
 * il `ctx.signal` consumer con timeout interno via `combineSignals` OR-merge
 * (D-V2-F9-10), e normalizza l'export a `MicroFrontendRuntimeModule` con smart
 * fallback priority 4-step (D-V2-F9-05).
 *
 * Rejection discriminate:
 * - `MF_LOADER_TIMEOUT` se il timeout interno scatta primo
 * - `MF_LOADER_ABORTED` se `ctx.signal` consumer aborta primo
 * - `MF_LOADER_INVALID_MODULE` se il modulo importato non espone lifecycle valido
 *
 * @see PRD §22 (Loader Registry API), §23 (ESM loader §23.1-§23.5)
 * @see D-V2-F9-04 (const no-args), D-V2-F9-05 (normalize priority),
 *   D-V2-F9-09 (timeout race), D-V2-F9-10 (signal compose), D-V2-F9-12 (error codes literal)
 */
import type {
  LoadedModule,
  LoaderContext,
  MicroFrontendLoaderAdapter,
  MicroFrontendLoaderDefinition,
} from '@gluezero/microfrontends'
import { combineSignals } from './internal/combine-signals'
import { createMfEsmError } from './mf-esm-error'
import { normalizeModule } from './normalize'

/**
 * Default timeout per `import(url)` dinamico (PRD §23.4 + D-V2-F9-04 lockato).
 *
 * Override per-MF via `descriptor.loader.timeoutMs`. Researcher/planner NON modifica
 * il default senza re-discuss (bench empirico 3G slow/4G/fiber tracciato in deferred
 * `09-CONTEXT.md`).
 */
const DEFAULT_TIMEOUT_MS = 15000

/**
 * Promise che rifiuta quando `signal` aborta. Cleanup esplicito su settle via
 * `removeEventListener` (mitiga T-F9-03 listener leak quando il signal è long-lived
 * ma `Promise.race` viene vinta dal `import()` success path).
 *
 * @internal Helper privato — NON esportato dal barrel.
 */
function abortPromise(signal: AbortSignal): Promise<never> {
  return new Promise<never>((_, reject) => {
    if (signal.aborted) {
      reject(signal.reason)
      return
    }
    const onAbort = (): void => {
      signal.removeEventListener('abort', onAbort)
      reject(signal.reason)
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * Loader concreto `MicroFrontendLoaderAdapter` con `type: 'esm'` (D-V2-F9-04
 * const lockato — NON factory).
 *
 * @example Registrazione via mfEsmModule (W2 Plan 09-04 outcome)
 * ```ts
 * import { createBroker } from '@gluezero/core'
 * import { microfrontendModule } from '@gluezero/microfrontends'
 * import { mfEsmModule } from '@gluezero/mf-esm'
 *
 * const broker = createBroker({ modules: [microfrontendModule(), mfEsmModule()] })
 * await broker.registerMicroFrontend({
 *   id: 'dashboard',
 *   name: 'Customer Dashboard',
 *   version: '1.0.0',
 *   loader: { type: 'esm', url: 'https://cdn.example/dashboard.js', timeoutMs: 5000 },
 * })
 * await broker.loadMicroFrontend('dashboard')
 * ```
 *
 * @example Default timeout PRD §23.4
 * ```ts
 * loader: { type: 'esm', url: '/mfs/analytics.js' } // timeoutMs default 15000
 * ```
 *
 * @example exportName esplicito (Strategy 1 D-V2-F9-05)
 * ```ts
 * loader: { type: 'esm', url: '/mfs/multi.js', exportName: 'lifecycle' }
 * ```
 *
 * @throws `BrokerError` con `code: 'MF_LOADER_TIMEOUT'` se `timeoutMs` eccede.
 * @throws `BrokerError` con `code: 'MF_LOADER_ABORTED'` se `ctx.signal` aborted dal consumer.
 * @throws `BrokerError` con `code: 'MF_LOADER_INVALID_MODULE'` se modulo non ha lifecycle valido
 *   o se `definition.url` manca / non è string.
 *
 * @see PRD §23 (ESM loader)
 * @see D-V2-F9-04 (const no-args), D-V2-F9-05 (normalize priority),
 *   D-V2-F9-09 (timeout race), D-V2-F9-10 (signal compose)
 */
export const esmLoader: MicroFrontendLoaderAdapter = {
  type: 'esm',
  async load(
    definition: MicroFrontendLoaderDefinition,
    ctx: LoaderContext,
  ): Promise<LoadedModule> {
    const url = definition.url
    if (!url || typeof url !== 'string') {
      throw createMfEsmError({
        code: 'MF_LOADER_INVALID_MODULE',
        message: 'descriptor.loader.url mancante o non-string per type "esm"',
        details: { url: String(url), reason: 'url field required for ESM loader' },
      })
    }

    const timeoutMs = definition.timeoutMs ?? DEFAULT_TIMEOUT_MS
    const exportName = definition.exportName

    const startedAt = performance.now()
    const timeoutSignal = AbortSignal.timeout(timeoutMs)
    // D-V2-F9-10 OR-merge: ctx.signal consumer + timeout interno → composite.
    // ctx.signal può essere undefined (combineSignals filtra), ma timeoutSignal è sempre presente.
    const composite = combineSignals(ctx.signal, timeoutSignal)

    try {
      // D-V2-F9-09 Promise.race: import() vs composite abort.
      // NB: `/* @vite-ignore */` sopprime il warning Vite static analysis per import
      // dinamico con URL non-letterale (test infrastructure + dev server). Innocuo in
      // produzione: bundler consumer non-Vite (webpack/esbuild/rollup) ignorano il
      // comment senza warning. NON è semantica runtime.
      const module = (await Promise.race([
        import(/* @vite-ignore */ url),
        abortPromise(composite),
      ])) as Record<string, unknown>

      // D-V2-F9-05 smart fallback priority — extract lifecycle dal modulo importato.
      const exportNameOpts = exportName !== undefined ? { exportName } : {}
      const lifecycle = normalizeModule(module, { url, ...exportNameOpts })

      const elapsedMs = performance.now() - startedAt
      return {
        module,
        lifecycle,
        metadata: {
          url,
          timeoutMs,
          elapsedMs,
          ...(exportName !== undefined && { exportName }),
        },
      }
    } catch (err) {
      // Discriminate timeout vs aborted vs invalid module / network error.
      if (composite.aborted) {
        const reason = composite.reason as { name?: string } | undefined
        const isTimeout = reason !== undefined && reason.name === 'TimeoutError'
        const elapsedMs = performance.now() - startedAt
        if (isTimeout) {
          throw createMfEsmError({
            code: 'MF_LOADER_TIMEOUT',
            message: `import("${url}") ha superato ${timeoutMs} ms (elapsed ${elapsedMs.toFixed(0)} ms)`,
            details: { url, timeoutMs, elapsedMs },
          })
        }
        throw createMfEsmError({
          code: 'MF_LOADER_ABORTED',
          message: `import("${url}") aborted via consumer signal`,
          details: {
            url,
            reason:
              typeof reason === 'object' && reason !== null && 'toString' in reason
                ? String(reason)
                : 'unknown',
          },
        })
      }
      // BrokerError già normalizzato (es. MF_LOADER_INVALID_MODULE da normalizeModule)
      // → rethrow pulito senza doppio wrapping. Riconosciuto via category/code MF_LOADER_*.
      if (
        err instanceof Error &&
        'code' in err &&
        typeof (err as { code: unknown }).code === 'string' &&
        ((err as { code: string }).code.startsWith('MF_LOADER_') ||
          (err as { code: string }).code.startsWith('MF_'))
      ) {
        throw err
      }
      // Network/parse error da import() (es. ERR_UNSUPPORTED_ESM_URL_SCHEME Node,
      // SyntaxError parse JS, network failure browser) → wrap come
      // MF_LOADER_INVALID_MODULE preservando originalError per debug.
      throw createMfEsmError({
        code: 'MF_LOADER_INVALID_MODULE',
        message: `Errore caricamento "${url}": ${err instanceof Error ? err.message : String(err)}`,
        details: { url, reason: 'import() rejected (network/parse error)' },
        ...(err instanceof Error && { originalError: err }),
      })
    }
  },
}
