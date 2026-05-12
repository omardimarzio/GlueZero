/**
 * F11 Capability Registry — global single source-of-truth (D-V2-F11-09).
 *
 * Cover REQ-IDs: MF-CAP-02 (registerCapability + first-wins) + MF-CAP-03 (hasCapability +
 * checkMicroFrontendCapabilities) + MF-CAP-05 (cleanup cascade D-V2-16 + invalidation
 * event-driven).
 *
 * Map storage: `Map<"name::version", providerMfId>` + reverse index
 * `Map<mfId, Set<key>>` per cleanup cascade D-V2-16 su unregister MF.
 *
 * **Pitfall 6 first-wins** (research §A6): `registerCapability` stesso
 * `(name, version)` da 2 MF diversi → seconda call `console.warn` + NON
 * sovrascrive (mfA primo register vince, mfB ignorato). Warning emesso una
 * volta sola per `(name, version)` tuple via `duplicateWarnedKeys`.
 *
 * **D-V2-F11-10 string equality only**: F11 NO semver. Semver vero defer F12
 * `@gluezero/compat` con hard dep `semver` 7.8.0 tree-shaken
 * (ROADMAP linea 307 — prima nuova hard dep F12).
 *
 * **B-03 FIX**: `computeCapabilityResult` esportata come public function diretta
 * da questo modulo. Importata da `capability-checker.ts` via
 * `import { computeCapabilityResult } from './capability-registry'` —
 * NO file intermedio di re-export, NO phantom internal export.
 *
 * @see prd_2.0.0.md §17.4 — Registry API 5 methods
 * @see prd_2.0.0.md §17.5 — CapabilityCheckResult shape
 * @see D-V2-F11-09 (global single SoT)
 * @see D-V2-F11-10 (string equality only)
 * @see D-V2-F11-22 (strict triple — NO diff upstream F1-F10)
 */
import type { Broker } from '@gluezero/core'
import { MF_GOVERNANCE_TOPICS } from '@gluezero/microfrontends'
import type {
  CapabilityCheckResult,
  CapabilityIncompatibility,
  CapabilityPolicy,
  CapabilityProvision,
  MicroFrontendCapabilities,
} from './types/capabilities'

/**
 * Pitfall 7 ACK: F8 governance topic `'microfrontend.capability.missing'`
 * (`MF_GOVERNANCE_TOPICS[0]`) — RIUSATO via import (NON duplicato in topics.ts).
 *
 * Tipizzato come literal del union di F8 per garantire string equality compile-time.
 *
 * @internal
 */
const _MF_CAPABILITY_MISSING: (typeof MF_GOVERNANCE_TOPICS)[number] =
  'microfrontend.capability.missing'
// Forza il bundler a preservare il literal nel chunk (audit-grep gate Pitfall 7).
void _MF_CAPABILITY_MISSING

/**
 * Public API Capability Registry — global single source-of-truth (D-V2-F11-09).
 *
 * PRD §17.4 5 metodi obbligatori + 2 helper interni:
 * - `cleanupByMfId` (cascade D-V2-16 — invocato da lifecycle hooks)
 * - `invalidateCheckCache` (event-driven invalidation D-V2-F11-07)
 */
export interface CapabilityRegistry {
  /** PRD §17.4 #1 — app shell o MF registra una provided capability. */
  registerCapability(cap: CapabilityProvision, providerMfId?: string): void
  /** PRD §17.4 #2 — unregister manuale (cleanup cascade automatico via lifecycle hooks). */
  unregisterCapability(name: string, version: string): boolean
  /** PRD §17.4 #3 — check presenza (version optional → any version match). */
  hasCapability(name: string, version?: string): boolean
  /** PRD §17.4 #4 — enumera tutte le capabilities registrate. */
  getCapabilities(): readonly CapabilityProvision[]
  /** PRD §17.4 #5 — check shape strict PRD §17.5 contro registry corrente. */
  checkMicroFrontendCapabilities(
    mfId: string,
    caps: MicroFrontendCapabilities | undefined,
  ): CapabilityCheckResult
  /** Cleanup cascade D-V2-16 — invocato da lifecycle-hooks su `microfrontend.unregistered`. */
  cleanupByMfId(mfId: string): number
  /** Clear cache check result (invocato su capability.registered/unregistered events). */
  invalidateCheckCache(): void
}

/**
 * Factory `CapabilityRegistry` — bind broker per topics emit + closure state immutabile.
 *
 * Lifecycle: invocato da `permissionsModule().install()` (W2-P03) durante module init.
 * Lo state (Map registry + reverseIndex + checkResultCache) è closure-captured: NON
 * esposto come field public — accessibile solo via API methods.
 *
 * @param broker Broker reference per `'capability.registered'` / `'capability.unregistered'` emit.
 * @param _policy Reservato per future override per-registry (F11 ignora — policy applicata in checker).
 * @returns `CapabilityRegistry` con 5 API methods PRD §17.4 + cleanup cascade + cache invalidation.
 *
 * @example Setup standalone (test scope)
 * ```ts
 * const broker = createBroker({})
 * const registry = createCapabilityRegistry(broker, 'warn')
 * registry.registerCapability({ name: 'theme.v1', version: '1.0.0' }, 'mf-shell')
 * registry.hasCapability('theme.v1', '1.0.0') // true
 * ```
 *
 * @example Check MF capabilities — strict shape PRD §17.5 (6-field result)
 * ```ts
 * const result = registry.checkMicroFrontendCapabilities('analytics-widget', {
 *   requires: [{ name: 'theme.v1', version: '1.0.0' }],
 * })
 * // result: { ok, missing, incompatible, optionalMissing, provided, warnings }
 * ```
 *
 * @see prd_2.0.0.md §17.4 — Registry API 5 methods MF-CAP-02
 * @see prd_2.0.0.md §17.5 — CapabilityCheckResult shape MF-CAP-03
 */
export function createCapabilityRegistry(
  broker: Broker,
  _policy: CapabilityPolicy,
): CapabilityRegistry {
  // D-V2-F11-09 global single SoT — `Map<"name::version", providerMfId>`.
  const registry = new Map<string, string>()
  // Reverse index per cleanup cascade D-V2-16 — `Map<mfId, Set<key>>`.
  const reverseIndex = new Map<string, Set<string>>()
  // Cache risultati `checkMicroFrontendCapabilities` per `mfId` (invalidata
  // event-driven su capability.registered/unregistered/cleanup).
  const checkResultCache = new Map<string, CapabilityCheckResult>()
  // Pitfall 6 first-wins: warn una volta sola per `(name, version)` tuple.
  const duplicateWarnedKeys = new Set<string>()

  const publishOpts = {
    source: { type: 'plugin' as const, id: 'permissions', name: '@gluezero/permissions' },
    deliveryMode: 'sync' as const,
  }

  function indexByMfId(mfId: string, key: string): void {
    let set = reverseIndex.get(mfId)
    if (!set) {
      set = new Set()
      reverseIndex.set(mfId, set)
    }
    set.add(key)
  }

  const api: CapabilityRegistry = {
    registerCapability(cap, providerMfId = '__app__'): void {
      const key = `${cap.name}::${cap.version}`
      if (registry.has(key)) {
        // Pitfall 6 first-wins (D-V2-F11-22 spirito — DX onboarding-friendly):
        // seconda call NON sovrascrive, log warn una sola volta per (name, version).
        if (!duplicateWarnedKeys.has(key)) {
          console.warn(
            `[permissions] capability "${cap.name}@${cap.version}" already provided by ` +
              `"${registry.get(key)}"; ignoring duplicate registration by "${providerMfId}".`,
          )
          duplicateWarnedKeys.add(key)
        }
        return
      }
      registry.set(key, providerMfId)
      indexByMfId(providerMfId, key)
      // Invalida computed check results — un MF potrebbe ora soddisfare requires precedenti.
      checkResultCache.clear()
      broker.publish(
        'capability.registered',
        {
          name: cap.name,
          version: cap.version,
          providerMfId,
          timestamp: Date.now(),
        },
        publishOpts,
      )
    },
    unregisterCapability(name, version): boolean {
      const key = `${name}::${version}`
      const providerMfId = registry.get(key)
      if (providerMfId === undefined) return false
      registry.delete(key)
      reverseIndex.get(providerMfId)?.delete(key)
      duplicateWarnedKeys.delete(key)
      checkResultCache.clear()
      broker.publish(
        'capability.unregistered',
        {
          name,
          version,
          providerMfId,
          timestamp: Date.now(),
        },
        publishOpts,
      )
      return true
    },
    hasCapability(name, version): boolean {
      if (version !== undefined) return registry.has(`${name}::${version}`)
      // Any version match — D-V2-F11-10 version optional in hasCapability/requires.
      const prefix = `${name}::`
      for (const k of registry.keys()) if (k.startsWith(prefix)) return true
      return false
    },
    getCapabilities(): readonly CapabilityProvision[] {
      const out: CapabilityProvision[] = []
      for (const k of registry.keys()) {
        const sep = k.indexOf('::')
        if (sep > 0) {
          out.push({ name: k.slice(0, sep), version: k.slice(sep + 2) })
        }
      }
      return out
    },
    checkMicroFrontendCapabilities(mfId, caps): CapabilityCheckResult {
      const cached = checkResultCache.get(mfId)
      if (cached) return cached
      const result = computeCapabilityResult(mfId, caps, registry)
      checkResultCache.set(mfId, result)
      return result
    },
    cleanupByMfId(mfId): number {
      const keys = reverseIndex.get(mfId)
      if (!keys || keys.size === 0) return 0
      let count = 0
      for (const key of keys) {
        const sep = key.indexOf('::')
        if (sep <= 0) continue
        const name = key.slice(0, sep)
        const version = key.slice(sep + 2)
        if (registry.delete(key)) {
          broker.publish(
            'capability.unregistered',
            {
              name,
              version,
              providerMfId: mfId,
              timestamp: Date.now(),
              reason: 'mf_unregistered' as const,
            },
            publishOpts,
          )
          count++
        }
        duplicateWarnedKeys.delete(key)
      }
      reverseIndex.delete(mfId)
      checkResultCache.clear()
      return count
    },
    invalidateCheckCache(): void {
      checkResultCache.clear()
    },
  }
  return api
}

/**
 * Compute `CapabilityCheckResult` shape PRD §17.5 strict (6-field).
 *
 * F11 string equality only (D-V2-F11-10):
 * - `requires` name+version presenti in registry exact → ok.
 * - `requires` name presente con version diversa → `incompatible[]`.
 * - `requires` name+version assenti → `missing[]`.
 * - `requires.version === undefined` → any version match (D-V2-F11-10 — version optional).
 * - `optional` name+version assenti → `optionalMissing[]` + `warnings[]` populated (OQ-4).
 * - `provides` → passthrough come `provided[]`.
 *
 * **OQ-4 warnings semantics**: stringhe diagnostiche per optional missing (`name@version not satisfied`).
 *
 * **B-03 FIX**: questa è la public export importata direttamente da
 * `capability-checker.ts`. NO file phantom di re-export.
 *
 * @param _mfId ID MF check-target (reservato — future per-MF custom logic).
 * @param caps Descriptor capabilities (può essere undefined).
 * @param registry Map state `"name::version" → providerMfId`.
 * @returns `CapabilityCheckResult` immutabile shape PRD §17.5.
 *
 * @example No caps → ok true tutti i field empty
 * ```ts
 * computeCapabilityResult('mf1', undefined, new Map())
 * // → { ok: true, missing: [], incompatible: [], optionalMissing: [], provided: [], warnings: [] }
 * ```
 *
 * @see prd_2.0.0.md §17.5
 * @see D-V2-F11-10 (string equality)
 */
export function computeCapabilityResult(
  _mfId: string,
  caps: MicroFrontendCapabilities | undefined,
  registry: Map<string, string>,
): CapabilityCheckResult {
  if (!caps) {
    return {
      ok: true,
      missing: [],
      incompatible: [],
      optionalMissing: [],
      provided: [],
      warnings: [],
    }
  }

  const missing: string[] = []
  const incompatible: CapabilityIncompatibility[] = []
  const optionalMissing: string[] = []
  const warnings: string[] = []

  function findVersionFor(name: string): string | undefined {
    const prefix = `${name}::`
    for (const k of registry.keys()) if (k.startsWith(prefix)) return k.slice(prefix.length)
    return undefined
  }

  for (const req of caps.requires ?? []) {
    if (req.version !== undefined) {
      const exact = `${req.name}::${req.version}`
      if (!registry.has(exact)) {
        const provided = findVersionFor(req.name)
        if (provided !== undefined) {
          // D-V2-F11-10 string equality: stesso name + diversa version → incompatible.
          incompatible.push({ name: req.name, required: req.version, provided })
        } else {
          missing.push(req.name)
        }
      }
    } else {
      // Any version match (D-V2-F11-10 — version optional).
      if (findVersionFor(req.name) === undefined) missing.push(req.name)
    }
  }

  for (const opt of caps.optional ?? []) {
    if (opt.version !== undefined) {
      if (!registry.has(`${opt.name}::${opt.version}`)) {
        optionalMissing.push(opt.name)
        warnings.push(`Optional capability "${opt.name}@${opt.version}" not satisfied`)
      }
    } else if (findVersionFor(opt.name) === undefined) {
      optionalMissing.push(opt.name)
      warnings.push(`Optional capability "${opt.name}" (any version) not satisfied`)
    }
  }

  return {
    ok: missing.length === 0 && incompatible.length === 0,
    missing,
    incompatible,
    optionalMissing,
    provided: (caps.provides ?? []) as readonly CapabilityProvision[],
    warnings,
  }
}
