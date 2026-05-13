/**
 * Service Locator binding per `@gluezero/isolation` (D-V2-F13-21).
 *
 * ## Auto-fix Rule 1 (Plan-level): Riuso F8 SERVICE_ISOLATION constant
 *
 * Il PLAN.md linea 632 proponeva `Symbol.for('@gluezero/isolation/service')` come
 * binding locale. Ma `SERVICE_ISOLATION = 'isolation' as const` è GIA esportato da
 * `@gluezero/core/src/services.ts:40` (F8 pre-dichiarato per F13). Pattern coerente
 * F11 `SERVICE_PERMISSIONS` + F12 `SERVICE_COMPAT` — riuso constant F8 invece di
 * creare local Symbol divergente (D-V2-02 service locator naming BLOCKING).
 *
 * ## Service signature
 *
 * `IsolationService` interface definisce l'API che `isolationModule({...}).install`
 * registrerà via `ctx.registerService(SERVICE_ISOLATION, ...)` in W2. Altri consumer
 * (es. devtools F16 SnapshotProvider per inspector overlay) possono query la service
 * istanza via `broker.getService<IsolationService>(SERVICE_ISOLATION)`.
 *
 * @see prd_2.0.0.md §21 — Isolation module
 * @see D-V2-02 — Service Locator naming BLOCKING
 * @see D-V2-F13-21 — Service Locator install pattern F13
 */
import { SERVICE_ISOLATION } from '@gluezero/core'
import type { ResolvedIsolationPolicy } from './types/policy.js'

/**
 * Re-export del constant F8 per consumer convenience (canonical source = `@gluezero/core`).
 *
 * Pattern coerente F11 `permissions-module.ts:59` + F12 — package isolation NON
 * definisce un constant locale divergente per evitare due chiavi di binding (F8
 * `'isolation'` vs locale Symbol diverging).
 */
export { SERVICE_ISOLATION }

/**
 * `IsolationService` — Signature service registrato da `isolationModule({...}).install` (W2 P03).
 *
 * API minima W1 (estesa W2/W3 con runtime mutation + audit):
 * - `getResolvedPolicy(mfId)`: Lookup policy merged (default + policyDefault + descriptor.isolation).
 *   Ritorna `undefined` se MF NON registrato. Usato da devtools F16 + W2 isolation engine.
 * - `scopeCss(rawCss, mfId)`: Trasforma CSS rule scoping (`policy.css: 'scoped'`) prefissando
 *   selettori con `[data-mf-id="<mfId>"]`. Used by W2 dom-css-handler + W3 integration.
 *
 * NOTE W1 stub: questa signature è la public contract. W2 implementa real logic.
 *
 * @see D-V2-F13-06 — scopeCss helper (W2 implementation)
 * @see D-V2-F13-10 — wrap context chain
 */
export interface IsolationService {
  readonly getResolvedPolicy: (mfId: string) => ResolvedIsolationPolicy | undefined
  readonly scopeCss: (rawCss: string, mfId: string) => string
}
