/**
 * `moduleFederationLoader` — Loader adapter F15 W2 P04 (experimental @0.x.0).
 *
 * Implementa `MicroFrontendLoaderAdapter` F8 con `type: 'module-federation'`:
 *
 * 1. Validation `scope` + `module` + `url` non-empty.
 * 2. Caricamento `@module-federation/runtime` peer optional (range `>=2.0.0 <3.0.0`)
 *    via `await import('@module-federation/runtime')`. Su peer assente → throw
 *    `MF_REMOTE_ENTRY_LOAD_FAILED` con hint install.
 * 3. `mfRuntime.init({name, remotes, shared})` idempotent (tracking module-level).
 * 4. `compareShareScopes(definition.shared, ctx.broker, mfId)` — warn + emit topic se
 *    version mismatch (D-V2-F15-10, NO throw).
 * 5. `mfRuntime.loadRemote(scope/module)` race con `combineSignals(ctx.signal, timeout)`.
 * 6. Error code mapping da MF Runtime error.code regex:
 *    - `LOAD_REMOTE_ENTRY_FAILED` / network 404 → `MF_REMOTE_ENTRY_LOAD_FAILED`
 *    - `scope not found` → `MF_REMOTE_SCOPE_NOT_FOUND`
 *    - `module not found` → `MF_REMOTE_MODULE_NOT_FOUND`
 *    - factory invocation throw → `MF_REMOTE_FACTORY_FAILED` (cause chain ES2022)
 *    - host senza shared section → `MF_SHARE_SCOPE_FAILED` (riservato — D-V2-F15-10
 *      version mismatch è warn-only)
 * 7. `normalizeModule(factoryResult, opts)` — carryover F9 4-step priority.
 * 8. Return `LoadedModule {module, lifecycle, metadata}`.
 *
 * @see D-V2-F15-09 — webpack-only V2.0 GA + Module Federation Runtime 2.4.x peer
 * @see D-V2-F15-10 — Share scope conflict warn + proceed
 * @see REQ MF-MF-02 — 5 error codes literal union
 * @see PRD §24 — Module Federation Loader (experimental @0.x.0)
 */
import type {
  LoadedModule,
  LoaderContext,
  MicroFrontendLoaderAdapter,
  MicroFrontendLoaderDefinition,
} from '@gluezero/microfrontends'
import { createMfModuleFederationError } from './errors'
import { abortPromise, combineSignals } from './internal/combine-signals'
import { normalizeModule } from './normalize'
import { compareShareScopes } from './share-scope-conflict'
import type { ModuleFederationLoaderDefinition } from './types/descriptor'

/**
 * Default timeout `loadRemote` race in millisecondi (carryover F9 D-V2-F9-04 — PRD §23.4).
 *
 * Override per-MF via `descriptor.loader.timeoutMs`.
 */
const DEFAULT_TIMEOUT_MS = 15000

/**
 * Shape minimo del peer `@module-federation/runtime` 2.4.x utilizzato.
 *
 * Tipizzato locally per evitare import diretto del peer optional (consumer install solo
 * se usa MF loader — D-V2-F15-09).
 *
 * @internal
 */
interface MfRuntimeModule {
  readonly init: (config: {
    readonly name: string
    readonly remotes: ReadonlyArray<{
      readonly name: string
      readonly entry: string
      readonly type?: string
      readonly alias?: string
    }>
    readonly shared?: Record<string, unknown>
  }) => unknown
  readonly loadRemote: (key: string) => Promise<unknown>
  readonly __VERSION__?: string
}

/**
 * Cache module-level del peer `@module-federation/runtime` per evitare double-import.
 *
 * @internal
 */
let cachedMfRuntime: MfRuntimeModule | undefined

/**
 * Tracking init() già chiamato per host (idempotent — re-call init è OK per MF Runtime
 * ma evitiamo double-emit topic + double-overhead).
 *
 * @internal
 */
const initializedScopes = new Set<string>()

/**
 * Cast helper — `MicroFrontendLoaderDefinition` → `ModuleFederationLoaderDefinition`.
 *
 * @internal
 */
function narrow(definition: MicroFrontendLoaderDefinition): ModuleFederationLoaderDefinition {
  return definition as ModuleFederationLoaderDefinition
}

/**
 * Carica peer `@module-federation/runtime` con try/catch — throw error code coerente se
 * peer non installato.
 *
 * @internal
 */
async function loadMfRuntime(mfId: string): Promise<MfRuntimeModule> {
  if (cachedMfRuntime !== undefined) return cachedMfRuntime
  try {
    // `/* @vite-ignore */` sopprime warning Vite static analysis su import dinamico
    // di peer optional (consumer install only-if-used).
    const mod = (await import(/* @vite-ignore */ '@module-federation/runtime')) as unknown
    cachedMfRuntime = mod as MfRuntimeModule
    return cachedMfRuntime
  } catch (err) {
    throw createMfModuleFederationError({
      code: 'MF_REMOTE_ENTRY_LOAD_FAILED',
      message: `@module-federation/runtime peer dependency non installato. Run: pnpm add @module-federation/runtime@">=2.0.0 <3.0.0" (mfId="${mfId}")`,
      microFrontendId: mfId,
      ...(err instanceof Error && { originalError: err }),
      details: { reason: 'peer dependency not installed' },
    })
  }
}

/**
 * Mappa error MF Runtime → `MfModuleFederationErrorCode` specifico via regex su message.
 *
 * Pattern carryover RESEARCH §"Error code mapping" linee 213-221.
 *
 * @internal
 */
function mapMfRuntimeError(err: unknown): {
  readonly code:
    | 'MF_REMOTE_ENTRY_LOAD_FAILED'
    | 'MF_REMOTE_SCOPE_NOT_FOUND'
    | 'MF_REMOTE_MODULE_NOT_FOUND'
    | 'MF_REMOTE_FACTORY_FAILED'
  readonly message: string
} {
  const e = err as { code?: unknown; message?: unknown }
  const errCode = typeof e.code === 'string' ? e.code : ''
  const errMsg = typeof e.message === 'string' ? e.message : String(err)
  const lowerMsg = errMsg.toLowerCase()

  // LOAD_REMOTE_ENTRY_FAILED / network 404 / fetch error → MF_REMOTE_ENTRY_LOAD_FAILED
  if (
    errCode === 'LOAD_REMOTE_ENTRY_FAILED' ||
    lowerMsg.includes('remoteentry') ||
    lowerMsg.includes('failed to fetch') ||
    lowerMsg.includes('404') ||
    lowerMsg.includes('network')
  ) {
    return { code: 'MF_REMOTE_ENTRY_LOAD_FAILED', message: errMsg }
  }
  // scope not found
  if (lowerMsg.includes('scope') && lowerMsg.includes('not found')) {
    return { code: 'MF_REMOTE_SCOPE_NOT_FOUND', message: errMsg }
  }
  // module not found
  if (lowerMsg.includes('module') && lowerMsg.includes('not found')) {
    return { code: 'MF_REMOTE_MODULE_NOT_FOUND', message: errMsg }
  }
  // Default: factory failure (cause chain ES2022 preserva originalError stack)
  return { code: 'MF_REMOTE_FACTORY_FAILED', message: errMsg }
}

/**
 * Loader concreto Module Federation `MicroFrontendLoaderAdapter` con `type:
 * 'module-federation'` (D-V2-F15-09).
 *
 * @example Registrazione consumer-side
 * ```ts
 * import { createBroker } from '@gluezero/core'
 * import { microfrontendModule } from '@gluezero/microfrontends'
 * import '@gluezero/mf-module-federation/augment'
 * import { moduleFederationLoader } from '@gluezero/mf-module-federation'
 *
 * const broker = createBroker({ modules: [microfrontendModule()] })
 * const service = broker.modules.get('@gluezero/microfrontends')
 * service.registerLoader(moduleFederationLoader)
 * ```
 *
 * @example Descriptor MF webpack 5
 * ```ts
 * await broker.registerMicroFrontend({
 *   id: 'analytics-mf',
 *   name: 'Analytics MF',
 *   version: '1.0.0',
 *   loader: {
 *     type: 'module-federation',
 *     scope: 'analytics_app',
 *     module: './AnalyticsWidget',
 *     url: 'https://cdn.example/analytics/remoteEntry.js',
 *     shared: { react: { requiredVersion: '^18.2', singleton: true } },
 *   },
 * })
 * await broker.loadMicroFrontend('analytics-mf')
 * ```
 *
 * @example Custom exportName + timeout
 * ```ts
 * loader: {
 *   type: 'module-federation',
 *   scope: 'app',
 *   module: 'Multi',
 *   url: '/mf/remoteEntry.js',
 *   exportName: 'lifecycle',
 *   timeoutMs: 5000,
 * }
 * ```
 *
 * @example Share scope mismatch (warn + emit, no throw)
 * ```ts
 * // host fornisce react@19, MF richiede ^18.2 → console.warn + topic emit
 * // microfrontend.mf.share.version-mismatch payload {mfId, sharedKey, required, provided, timestamp}
 * // Procede usando shared host (D-V2-F15-10).
 * ```
 *
 * @example Error: MF Runtime peer absent
 * ```ts
 * // Senza @module-federation/runtime installato → throw MfModuleFederationError
 * // code: 'MF_REMOTE_ENTRY_LOAD_FAILED', message hint install
 * ```
 *
 * @throws `MfModuleFederationError` con code:
 *   - `MF_REMOTE_ENTRY_LOAD_FAILED`: peer assente / remoteEntry.js 404 / init() failure.
 *   - `MF_REMOTE_SCOPE_NOT_FOUND`: scope sconosciuto in remotes registry.
 *   - `MF_REMOTE_MODULE_NOT_FOUND`: module path sconosciuto nello scope.
 *   - `MF_REMOTE_FACTORY_FAILED`: factory invocation throw o normalize fail.
 *   - `MF_SHARE_SCOPE_FAILED`: scope completamente assente in host shared section (riservato).
 *
 * @see D-V2-F15-09 — webpack-only V2.0 GA + Module Federation Runtime 2.4.x peer
 * @see D-V2-F15-10 — Share scope conflict warn + proceed (NO throw — riservato MF_SHARE_SCOPE_FAILED)
 * @see REQ MF-MF-02 — 5 error codes literal union
 * @see PRD §24 — Module Federation Loader
 */
export const moduleFederationLoader: MicroFrontendLoaderAdapter = {
  type: 'module-federation',
  async load(
    definition: MicroFrontendLoaderDefinition,
    ctx: LoaderContext,
  ): Promise<LoadedModule> {
    const mfDef = narrow(definition)
    const mfId = ctx.descriptor.id

    // ===== Step 1: Validation =====
    if (!mfDef.scope || typeof mfDef.scope !== 'string') {
      throw createMfModuleFederationError({
        code: 'MF_REMOTE_ENTRY_LOAD_FAILED',
        message: `descriptor.loader.scope mancante o non-string per type='module-federation' mfId='${mfId}'`,
        microFrontendId: mfId,
        details: { scope: String(mfDef.scope), reason: 'scope field required' },
      })
    }
    if (!mfDef.module || typeof mfDef.module !== 'string') {
      throw createMfModuleFederationError({
        code: 'MF_REMOTE_ENTRY_LOAD_FAILED',
        message: `descriptor.loader.module mancante o non-string per type='module-federation' mfId='${mfId}'`,
        microFrontendId: mfId,
        scope: mfDef.scope,
        details: { module: String(mfDef.module), reason: 'module field required' },
      })
    }
    if (!mfDef.url || typeof mfDef.url !== 'string') {
      throw createMfModuleFederationError({
        code: 'MF_REMOTE_ENTRY_LOAD_FAILED',
        message: `descriptor.loader.url mancante o non-string per type='module-federation' mfId='${mfId}'`,
        microFrontendId: mfId,
        scope: mfDef.scope,
        module: mfDef.module,
        details: { url: String(mfDef.url), reason: 'url field required (remoteEntry.js)' },
      })
    }

    // ===== Step 2: Carica peer MF Runtime =====
    const mfRuntime = await loadMfRuntime(mfId)

    // ===== Step 3: Init idempotent =====
    const initKey = `${mfDef.scope}::${mfDef.url}`
    if (!initializedScopes.has(initKey)) {
      try {
        mfRuntime.init({
          name: 'gluezero-host',
          remotes: [
            {
              name: mfDef.scope,
              entry: mfDef.url,
              type: 'module',
            },
          ],
          ...(mfDef.shared !== undefined && { shared: mfDef.shared as Record<string, unknown> }),
        })
        initializedScopes.add(initKey)
      } catch (err) {
        throw createMfModuleFederationError({
          code: 'MF_REMOTE_ENTRY_LOAD_FAILED',
          message: `Module Federation Runtime init() fallita per scope="${mfDef.scope}" entry="${mfDef.url}" mfId="${mfId}": ${err instanceof Error ? err.message : String(err)}`,
          microFrontendId: mfId,
          scope: mfDef.scope,
          module: mfDef.module,
          ...(err instanceof Error && { originalError: err }),
          details: { url: mfDef.url, reason: 'mfRuntime.init() rejected' },
        })
      }
    }

    // ===== Step 4: Share scope conflict (D-V2-F15-10 warn + proceed, NO throw) =====
    if (mfDef.shared !== undefined) {
      compareShareScopes(mfDef.shared, ctx.broker, mfId)
    }

    // ===== Step 5: loadRemote race con timeout =====
    const timeoutMs = mfDef.timeoutMs ?? DEFAULT_TIMEOUT_MS
    const startedAt = performance.now()
    const timeoutSignal = AbortSignal.timeout(timeoutMs)
    const composite = combineSignals(ctx.signal, timeoutSignal)
    const remoteKey = `${mfDef.scope}/${mfDef.module}`

    let factoryResult: unknown
    try {
      factoryResult = await Promise.race([
        mfRuntime.loadRemote(remoteKey),
        abortPromise(composite),
      ])
    } catch (err) {
      // Discrimina timeout/aborted vs MF Runtime errors via composite signal state.
      if (composite.aborted) {
        const reason = composite.reason as { name?: string } | undefined
        const isTimeout = reason !== undefined && reason.name === 'TimeoutError'
        const elapsedMs = performance.now() - startedAt
        throw createMfModuleFederationError({
          code: 'MF_REMOTE_ENTRY_LOAD_FAILED',
          message: isTimeout
            ? `loadRemote("${remoteKey}") timeout ${timeoutMs}ms (elapsed ${elapsedMs.toFixed(0)}ms) mfId="${mfId}"`
            : `loadRemote("${remoteKey}") aborted via consumer signal mfId="${mfId}"`,
          microFrontendId: mfId,
          scope: mfDef.scope,
          module: mfDef.module,
          ...(err instanceof Error && { originalError: err }),
          details: { url: mfDef.url, timeoutMs, elapsedMs, aborted: !isTimeout, timeout: isTimeout },
        })
      }
      // BrokerError già normalizzato (es. errors emessi da factory invocation interna)
      // → rethrow pulito senza doppio wrapping.
      if (
        err instanceof Error &&
        'code' in err &&
        typeof (err as { code: unknown }).code === 'string' &&
        (err as { code: string }).code.startsWith('MF_')
      ) {
        throw err
      }
      // MF Runtime error → mapping via regex.
      const mapped = mapMfRuntimeError(err)
      throw createMfModuleFederationError({
        code: mapped.code,
        message: `Module Federation loadRemote("${remoteKey}") fallita mfId="${mfId}": ${mapped.message}`,
        microFrontendId: mfId,
        scope: mfDef.scope,
        module: mfDef.module,
        ...(err instanceof Error && { originalError: err }),
        details: { url: mfDef.url, remoteKey, reason: 'mfRuntime.loadRemote rejected' },
      })
    }

    // ===== Step 6: Reject undefined / null factory result =====
    if (factoryResult === undefined || factoryResult === null) {
      throw createMfModuleFederationError({
        code: 'MF_REMOTE_MODULE_NOT_FOUND',
        message: `Module Federation loadRemote("${remoteKey}") ritorna ${factoryResult} mfId="${mfId}"`,
        microFrontendId: mfId,
        scope: mfDef.scope,
        module: mfDef.module,
        details: { url: mfDef.url, remoteKey, reason: 'loadRemote returned nullish' },
      })
    }

    // ===== Step 7: Normalize factory result (carryover F9 4-step priority) =====
    const lifecycle = normalizeModule(factoryResult, {
      url: mfDef.url,
      ...(mfDef.exportName !== undefined && { exportName: mfDef.exportName }),
      scope: mfDef.scope,
      module: mfDef.module,
      microFrontendId: mfId,
    })

    // ===== Step 8: Return LoadedModule =====
    const elapsedMs = performance.now() - startedAt
    return {
      module: factoryResult,
      lifecycle,
      metadata: {
        scope: mfDef.scope,
        module: mfDef.module,
        url: mfDef.url,
        remoteKey,
        elapsedMs,
        timeoutMs,
        mfRuntimeVersion: mfRuntime.__VERSION__ ?? 'unknown',
        ...(mfDef.exportName !== undefined && { exportName: mfDef.exportName }),
      },
    }
  },
}

/**
 * Reset interno cache + tracking init (TESTING ONLY — non documentato pubblicamente).
 *
 * Permette ai test Tier-1 di resettare stato module-level tra `describe` blocks senza
 * stalling cross-test. NON usare in production code.
 *
 * @internal
 */
export function __resetModuleFederationLoaderForTests(): void {
  cachedMfRuntime = undefined
  initializedScopes.clear()
}

/**
 * Inject helper TESTING ONLY — popola cache `cachedMfRuntime` con mock MF Runtime.
 *
 * @internal
 */
export function __injectMfRuntimeForTests(mock: unknown): void {
  cachedMfRuntime = mock as MfRuntimeModule
}
