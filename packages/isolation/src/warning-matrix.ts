/**
 * `warning-matrix.ts` — Detection 5 combinazioni inconsistent (MF-ISO-06).
 *
 * Cover REQ-IDs: MF-ISO-06 (warning matrix combinazioni inconsistent rilevate al
 * register hook + emesse via `microfrontend.isolation.warning` topic).
 *
 * ## Matrice — 5 codici (P-13 principale + 4 derivate)
 *
 * | Code                           | Trigger combination                              | Severity |
 * |--------------------------------|--------------------------------------------------|----------|
 * | `P-13`                         | `js='shared-window'` + `network='blocked'`       | warning  |
 * | `IFRAME_EVENTS`                | `dom='iframe'` + `events='broker-plus-dom'`      | warning  |
 * | `STORAGE_BLOCKED_SHADOW`       | `storage='blocked'` + `dom='shadow-dom'`         | warning  |
 * | `JS_SANDBOXED_MOUNT`           | `js='sandboxed-iframe'` + `dom !== 'iframe'`     | warning  |
 * | `GLOBALS_ISOLATED_JS_SHARED`   | `globals='isolated'` + `js='shared-window'`      | warning  |
 *
 * Tutti i warning sono **non-fatal**: il MF resta registrato e mountabile, ma il
 * developer riceve telemetria via `console.warn` + `broker.publish` per debug
 * runtime e devtools F16 SnapshotProvider (futuro).
 *
 * ## P-13 messaggio testuale lockato PRD §21.9
 *
 * Il messaggio del codice principale `P-13` è copiato verbatim da PRD §21.9 (frozen
 * baseline v2.0). Substring test in `warning-matrix.test.ts` previene drift accidentale.
 *
 * ## OQ-3 payload shape ratificato
 *
 * `IsolationWarning` shape: `{microFrontendId, code, combination, message, timestamp}`.
 * Coerente F11/F12 governance payload pattern. Consumer downstream (F16 SnapshotProvider,
 * devtools overlay) possono interrogare la shape stabile.
 *
 * @see prd_2.0.0.md §21.9 — Warning matrix P-13 testo lockato
 * @see D-V2-F13-03 — Eager detection at register
 * @see ROADMAP MF-ISO-06 — 5 combinazioni inconsistent
 */
import type { ResolvedIsolationPolicy } from './types/policy.js'

/**
 * Codici delle 5 combinazioni inconsistent rilevate.
 *
 * Stable string literals — usati come `payload.code` nei warning emessi e da consumer
 * filter pattern (es. devtools inspector filtra per codice).
 */
export type IsolationWarningCode =
  | 'P-13'
  | 'IFRAME_EVENTS'
  | 'STORAGE_BLOCKED_SHADOW'
  | 'JS_SANDBOXED_MOUNT'
  | 'GLOBALS_ISOLATED_JS_SHARED'

/**
 * `IsolationWarning` — Shape canonica del payload warning (OQ-3 ratificato).
 *
 * - `microFrontendId`: id del MF target (consumer filtering).
 * - `code`: uno dei 5 codici stabili (consumer typed dispatch).
 * - `combination`: snapshot delle chiavi policy che hanno triggerato il warning
 *   (es. `{js:'shared-window', network:'blocked'}`). Subset variabile a seconda
 *   del codice — utile a devtools per evidenziare le chiavi conflicting.
 * - `message`: testo human-readable, già localizzato (v2.0 = inglese, futuro i18n).
 * - `timestamp`: `Date.now()` al momento del detect (audit + ordering).
 */
export interface IsolationWarning {
  readonly microFrontendId: string
  readonly code: IsolationWarningCode
  readonly combination: Readonly<Record<string, string>>
  readonly message: string
  readonly timestamp: number
}

/**
 * Detect le 5 combinazioni inconsistent (MF-ISO-06) sulla policy risolta.
 *
 * Funzione pura — no side effect, no I/O. Idempotent (chiamare 2x con stessa policy
 * produce stesso output, tranne `timestamp` che riflette `Date.now()` corrente).
 *
 * Multi-warning per policy: una stessa `ResolvedIsolationPolicy` può triggerare più
 * codici (es. `js:'shared-window' + network:'blocked' + globals:'isolated'` triggera
 * P-13 + GLOBALS_ISOLATED_JS_SHARED).
 *
 * @param policy - Policy risolta da `resolvePolicy(...)`.
 * @param microFrontendId - Id del MF (incluso in ogni warning emesso).
 * @returns Array readonly di `IsolationWarning` — vuoto se policy è consistent.
 *
 * @example Detection P-13 principale
 * ```ts
 * const warnings = detectInconsistentCombinations(
 *   { ...DEFAULT, js: 'shared-window', network: 'blocked' },
 *   'mf-1',
 * )
 * // → [{ code: 'P-13', message: "Network blocking cannot be fully enforced...", ... }]
 * ```
 *
 * @example No-warning su policy canonical iframe
 * ```ts
 * const warnings = detectInconsistentCombinations(
 *   { ...DEFAULT, dom: 'iframe', js: 'sandboxed-iframe', events: 'isolated', network: 'gateway-only' },
 *   'mf-1',
 * )
 * // → [] (zero warning — combo canonical iframe MF)
 * ```
 */
export function detectInconsistentCombinations(
  policy: ResolvedIsolationPolicy,
  microFrontendId: string,
): readonly IsolationWarning[] {
  const warnings: IsolationWarning[] = []
  const now = Date.now()

  // 1. P-13 principale — PRD §21.9 testo lockato.
  if (policy.js === 'shared-window' && policy.network === 'blocked') {
    warnings.push({
      microFrontendId,
      code: 'P-13',
      combination: { js: policy.js, network: policy.network },
      message:
        'Network blocking cannot be fully enforced in shared-window mode; MF can bypass via window.fetch. Use iframe sandbox for enforceable network isolation.',
      timestamp: now,
    })
  }

  // 2. IFRAME_EVENTS — DOM CustomEvents NON cross-iframe.
  if (policy.dom === 'iframe' && policy.events === 'broker-plus-dom') {
    warnings.push({
      microFrontendId,
      code: 'IFRAME_EVENTS',
      combination: { dom: policy.dom, events: policy.events },
      message:
        "DOM CustomEvents do not cross iframe boundaries; events='broker-plus-dom' degrades to 'broker-only' for iframe-isolated MFs.",
      timestamp: now,
    })
  }

  // 3. STORAGE_BLOCKED_SHADOW — shadow-dom isola DOM, NON localStorage.
  if (policy.storage === 'blocked' && policy.dom === 'shadow-dom') {
    warnings.push({
      microFrontendId,
      code: 'STORAGE_BLOCKED_SHADOW',
      combination: { storage: policy.storage, dom: policy.dom },
      message:
        "Combination storage='blocked' + dom='shadow-dom' is inconsistent: shadow-dom isolates DOM but localStorage remains globally accessible. Use storage='namespaced' for scoped isolation.",
      timestamp: now,
    })
  }

  // 4. JS_SANDBOXED_MOUNT — js sandboxing richiede iframe container.
  if (policy.js === 'sandboxed-iframe' && policy.dom !== 'iframe') {
    warnings.push({
      microFrontendId,
      code: 'JS_SANDBOXED_MOUNT',
      combination: { js: policy.js, dom: policy.dom },
      message: `js='sandboxed-iframe' requires dom='iframe' container; current dom='${policy.dom}' cannot enforce JS sandboxing.`,
      timestamp: now,
    })
  }

  // 5. GLOBALS_ISOLATED_JS_SHARED — globals isolated impossibile in shared window.
  if (policy.globals === 'isolated' && policy.js === 'shared-window') {
    warnings.push({
      microFrontendId,
      code: 'GLOBALS_ISOLATED_JS_SHARED',
      combination: { globals: policy.globals, js: policy.js },
      message:
        "globals='isolated' is not enforceable when js='shared-window'; window globals shared across all MFs.",
      timestamp: now,
    })
  }

  return warnings
}
