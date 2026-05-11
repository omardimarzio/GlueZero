/**
 * Loader Registry interno (MF-LOADER-REG-01, MF-LOADER-REG-02).
 *
 * Storage per `MicroFrontendLoaderAdapter` indicizzati per `type` (`'esm'`,
 * `'web-component'`, `'iframe'`, `'module-federation'`, `'single-spa'`, custom).
 * F9-F15 forniranno i loader concreti via Pattern S1 install dal proprio modulo.
 *
 * Duplicate handling: throw `MF_LOADER_TYPE_DUPLICATE` (OQ-15 — no override silente,
 * coerente con `service.duplicate` v2.0 MIN-1 patterns).
 *
 * @see PRD §22 + RESEARCH §6 + PATTERNS §34
 */
import type { Broker, BrokerLogger } from '@gluezero/core'
import { createMfError } from './microfrontend-error'
import type { MicroFrontendDescriptor, MicroFrontendLoaderDefinition } from './types/descriptor'
import type { MicroFrontendRuntimeModule } from './types/runtime-context'

/** Context passato a `LoaderAdapter.load` (PRD §22). */
export interface LoaderContext {
  readonly broker: Broker
  readonly descriptor: MicroFrontendDescriptor
  readonly signal?: AbortSignal
  readonly logger?: BrokerLogger
}

/** Risultato della funzione `load` del LoaderAdapter. */
export interface LoadedModule {
  /** Modulo opaco caricato (es. ESM namespace, custom element class, iframe handle). */
  readonly module: unknown
  /** Lifecycle hook estratti dal modulo. */
  readonly lifecycle: MicroFrontendRuntimeModule
  /** Metadata opzionali del loader (debug/tracing). */
  readonly metadata?: Record<string, unknown>
}

/**
 * Interface implementata dai loader concreti (F9 ESM, F15 Web Component / iframe / MF / single-spa).
 *
 * F8 fornisce SOLO l'interface + il Registry. Implementazioni reali in F9-F15.
 */
export interface MicroFrontendLoaderAdapter {
  /** Type key del loader (es. `'esm'`, `'mock'`, `'iframe'`). */
  readonly type: string

  /** Carica il modulo MF dato il `loader` definition. */
  load(definition: MicroFrontendLoaderDefinition, ctx: LoaderContext): Promise<LoadedModule>

  /** Optional preload (DNS prefetch, modulemap warmup). */
  preload?(definition: MicroFrontendLoaderDefinition, ctx: LoaderContext): Promise<void>

  /** Optional unload (es. revoca URL ObjectURL per iframe). */
  unload?(loaded: LoadedModule, ctx: LoaderContext): Promise<void>
}

/**
 * Registry interno indicizzato per `type` string.
 *
 * Usato internamente da `MicroFrontendsService` (`registerLoader`/`getLoader`/etc.
 * delegano qui). Non esposto direttamente al consumer — accesso solo via service.
 */
export class LoaderRegistry {
  private readonly adapters = new Map<string, MicroFrontendLoaderAdapter>()

  /**
   * Registra un loader per il `type` dato.
   *
   * @throws `BrokerError` con `code: 'MF_LOADER_TYPE_DUPLICATE'` se `type` già registrato
   *   (OQ-15: no override silente).
   */
  register(adapter: MicroFrontendLoaderAdapter): void {
    if (this.adapters.has(adapter.type)) {
      throw createMfError({
        code: 'MF_LOADER_TYPE_DUPLICATE',
        message: `Loader type "${adapter.type}" already registered`,
        details: { type: adapter.type },
      })
    }
    this.adapters.set(adapter.type, adapter)
  }

  /** Rimuove il loader per `type`. Returns true se rimosso, false se non esisteva (idempotent). */
  unregister(type: string): boolean {
    return this.adapters.delete(type)
  }

  /** Lookup loader per `type`. Returns `undefined` se non registrato. */
  get(type: string): MicroFrontendLoaderAdapter | undefined {
    return this.adapters.get(type)
  }

  /** Lista snapshot di tutti i loader registrati (fresh copy ad ogni call). */
  list(): readonly MicroFrontendLoaderAdapter[] {
    return [...this.adapters.values()]
  }
}
