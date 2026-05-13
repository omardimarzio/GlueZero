/**
 * F12 W4 — Snapshot Provider stub no-op (F16 deferred D-12-20).
 *
 * Cover REQ-IDs: MF-COMPAT-02 (preparation F16 SnapshotProvider Registry).
 *
 * **D-12-20 lockato — F12 NON registra automaticamente.** Anticipare F16
 * violerebbe D-83 strict + cross-fase rework risk (F16 ha la chiusura
 * `devtools.registerSnapshotProvider()` API MIN-3).
 *
 * **Comportamento F12 corrente:**
 * - File NON re-esportato dal barrel `src/index.ts` (audit-grep verify: `dist/index.d.ts`
 *   NON contiene `createSnapshotProvider` symbol).
 * - Tree-shake automatic post-build (no consumer = code rimosso da dist via esbuild).
 * - `broker.getService('compat').getCompatibilityReport(id?)` API pubblica è sufficient
 *   per devtools-side introspection durante F12 (host può polling manuale).
 *
 * **Quando F16 implementerà SnapshotProvider Registry:**
 * ```typescript
 * // In @gluezero/devtools F16 install hook:
 * import { createSnapshotProvider } from '@gluezero/compat/internal/snapshot-provider-stub'
 * // ATTENZIONE: F16 può importare direttamente da subpath internal se necessario,
 * // OPPURE F12 può aggiungere export pubblico in V2.1 quando F16 ship.
 * devtools.registerSnapshotProvider('compat', createSnapshotProvider(compatService))
 * ```
 *
 * @internal Reserved for F16 — NOT public API in V2.0 GA.
 * @see D-12-20 / MF-DEVTOOLS-05 / MIN-3
 * @see PRD §47 MIN-3 SnapshotProvider Registry deferred F16
 * @see plan 12-04 Task 1
 */
import type { CompatService } from '../compat-module'
import type { CompatibilityReport } from '../types/report'

/**
 * Snapshot shape per F16 SnapshotProvider Registry (D-12-20 preparation).
 *
 * F12 deferred — F16 (MF-DEVTOOLS-05 / MIN-3) implementerà il wire-up:
 * `broker.getDebugSnapshot().external.compat` = `CompatSnapshot`.
 *
 * **Fields:**
 * - `reports`: Record<mfId, CompatibilityReport> (serializzabile JSON.stringify).
 * - `timestamp`: Date.now() epoch ms quando lo snapshot è stato preso (carryover
 *   D-12-18 `checkedAt` pattern).
 *
 * @see PRD §47 MIN-3 SnapshotProvider Registry deferred F16
 */
export interface CompatSnapshot {
  readonly reports: Readonly<Record<string, CompatibilityReport>>
  readonly timestamp: number
}

/**
 * F16 SnapshotProvider factory placeholder — NON registrato automaticamente.
 *
 * Ritorna una function `() => CompatSnapshot` che produce uno snapshot point-in-time
 * dei report memoizzati nel service. La conversione `Map → Record` è effettuata via
 * `Object.fromEntries` (JSON-serializzabile).
 *
 * **Idempotency:** ogni invocazione del provider produce un nuovo `CompatSnapshot`
 * con `timestamp` fresco e snapshot dei report correnti (immutable snapshot pattern).
 *
 * **D-12-20 NOT REGISTERED:** F12 NON invoca `devtools.registerSnapshotProvider()`.
 * F16 effettuerà il wire-up quando `MIN-3` sarà attivo.
 *
 * @param service `CompatService` ottenuto via `broker.getService(SERVICE_COMPAT)`.
 * @returns Function `() => CompatSnapshot` invocabile on-demand.
 *
 * @example F16 future wire-up (NON F12)
 * ```typescript
 * import { createSnapshotProvider } from '@gluezero/compat/internal/snapshot-provider-stub'
 * const compatService = broker.getService('compat')
 * const provider = createSnapshotProvider(compatService)
 * devtools.registerSnapshotProvider('compat', provider)
 * // Devtools UI poi invoca provider() su-demand per ottenere lo snapshot.
 * ```
 *
 * @example Shape verify
 * ```typescript
 * const provider = createSnapshotProvider(compatService)
 * const snapshot = provider()
 * // snapshot: { reports: { 'mf-1': {...}, 'mf-2': {...} }, timestamp: 1700000000000 }
 * ```
 *
 * @internal Reserved for F16 — NOT public API in V2.0 GA.
 * @see D-12-20 / MF-DEVTOOLS-05 / MIN-3
 */
export function createSnapshotProvider(service: CompatService): () => CompatSnapshot {
  return () => ({
    reports: Object.fromEntries(service.getCompatibilityReport()) as Readonly<
      Record<string, CompatibilityReport>
    >,
    timestamp: Date.now(),
  })
}
