# Roadmap: GlueZero v2.0.0 — Microfrontend Governance

**Fonte autoritativa:** `prd_2.0.0.md` (root del progetto)
**Granularità:** coarse
**Mode:** yolo · Parallelization: enabled · Model profile: quality
**Created:** 2026-04-28 (v2.0 init) · **Updated:** 2026-05-12 (F11 planned 5/5)

## Milestone

🚀 **v2.0.0 — Microfrontend Governance + Extensible Module Runtime** — Phases 8-17 (in progress)

Carryover milestone storiche (chiuse, riferimento documentale):
- ✅ v1.0.0 (Phases 1-6, shipped 2026-05-08)
- ✅ v1.1 (Phase 7, shipped 2026-05-10)

## Phases overview

| # | Phase | Package primary | Status |
|---|-------|-----------------|--------|
| 8 | Extension Runtime + MF Registry + Lifecycle FSM + Standard Topics | `@gluezero/microfrontends` (NEW) | ✅ Done |
| 9 | ESM Loader + Lifecycle End-to-End | `@gluezero/mf-esm` (NEW) | ✅ Done |
| 10 | Runtime Context Module + Mapping per-MF | `@gluezero/context` (NEW) | ✅ Done |
| 11 | Permissions + Capabilities + Pipeline §28 extension | `@gluezero/permissions` (NEW) | 🚧 In Progress (2/5) |
| 12 | Compatibility / Versioning (semver 9 dimensioni) | `@gluezero/compat` (NEW) | ⏳ Pending |
| 13 | Isolation + theme/cache/gateway/worker integration | `@gluezero/isolation` (NEW) | ✅ Done |
| 14 | Fallback & Error Boundary | `@gluezero/fallbacks` (NEW) | ✅ Done (2026-05-14) |
| 15 | WC + Iframe + Module Federation + single-spa Loaders (security blocker) | `@gluezero/{mf-web-component,mf-iframe,mf-module-federation,mf-single-spa}` (4 NEW) | ✅ Done (2026-05-15) |
| 16 | MF Devtools subpath + SnapshotProvider MIN-3 + Metrics MF | `@gluezero/devtools/mf-inspector` (subpath) + MIN-3 promosso da F8 | ⏳ Pending |
| 17 | 5/7 | In Progress|  |

Dipendenze: F8 → F9 → F10 → F11 → F12 → F13 → F14 → F15 → F16 → F17 (sequenziale con F4 ∥ F5 stile v1.x).

## Cross-fase obligations

Ogni fase post-F8 verifica:
- **D-83 strict triple esteso v2.0**: `git diff main...HEAD packages/{core,microfrontends,mapper}/src/` = vuoto (eccetto F8 W1-P03 MIN-1 + MIN-2 chiusa).
- **BC §42 14 API v1.x preserved**: `v1-bc-replay/publish-ordering.test.ts` PASS.
- **Bundle gate per-package** size-limit enforced.
- **publint + attw** clean per ogni package.

Cross-fase obligations specifiche:
- **MF-TEST-01** (linea 88): F10/F11/F12/F16 → Tier-1 jsdom sufficient; F8/F9/F13/F14/F15/F17 → Tier-3 Playwright.
- **MF-PIPE-01** (linea 456 — D-V2-20 BLOCKING): ordine pipeline §28 esteso preservato ogni fase post-F11.
- **MF-LOC-01** (linea 233): cross-fase test-tier obligation.

---

## Phase 8: Extension Runtime + MF Registry + Lifecycle FSM + Standard Topics ✅

**Package:** `@gluezero/microfrontends` (NEW)
**Goal:** BrokerModule extension runtime + MicroFrontendRegistry + Lifecycle FSM 14 stati + standard topics 29 totali (17 lifecycle + 7 governance + 5 error).
**Status:** Done — 5/5 plans completed.

---

## Phase 9: ESM Loader + Lifecycle End-to-End ✅

**Package:** `@gluezero/mf-esm` (NEW)
**Goal:** ESM dynamic import loader + lifecycle FSM end-to-end + augment subpath Pattern S1.
**Status:** Done — 5/5 plans completed.

---

## Phase 10: Runtime Context Module + Mapping per-MF ✅

**Package:** `@gluezero/context` (NEW)
**Goal:** Reactive runtime context container + writableKeys ACL + canonical mapper namespace per-MF + lifecycle hooks.
**Status:** Done — 5/5 plans completed (10-04 LIVE injection + 10-05 Tier-1 jsdom closure).

---

## Phase 11: Permissions + Capabilities + Pipeline §28 Extension 🚧

**Goal:** Modulo `@gluezero/permissions` con permission engine sincrono (LRU cache per `(mfId, action, resource)`) + Capability Registry + Pipeline §28 estensione (validation → permission check → mapping → route resolve → execute → mapping inverso → consegna → metrics — D-V2-20 BLOCKING).

**Package primary:** `@gluezero/permissions` (NEW) + Capability Registry come sub-modulo dello stesso package o subpath.

**Dependencies:** F8 (Registry, Module Extension Runtime) + F10 (RuntimeContext per scoping per-tenant).

**Requirements (13):**
- `MF-PERM-01` — `MicroFrontendPermissions` descriptor 9 categorie (publish, subscribe, routes, workers, gateway, context, storage, theme, devtools)
- `MF-PERM-02` — Pattern matching: esatto, wildcard finale (`customer.*`), globale (`*`), deny esplicito (`!`)
- `MF-PERM-03` — Enforcement points via facade injection nel `MicroFrontendRuntimeContext` (zero modifica core publish/subscribe raw)
- `MF-PERM-04` — `PermissionError` standard + topics `permission.denied`, `microfrontend.permission.denied`
- `MF-PERM-05` — `permissionMode: 'off' | 'warn' | 'enforce'` configurabile
- `MF-PERM-06` — Check SYNC + LRU cache + invalidation su update descriptor
- `MF-CAP-01` — `MicroFrontendCapabilities` con `requires?`, `provides?`, `optional?`
- `MF-CAP-02` — Capability Registry API (`registerCapability`, `hasCapability`, `checkMicroFrontendCapabilities`)
- `MF-CAP-03` — `CapabilityCheckResult` con `ok`, `missing[]`, `incompatible[]`, `optionalMissing[]`, `provided[]`, `warnings[]`
- `MF-CAP-04` — `capabilityPolicy: 'off' | 'warn' | 'block-load' | 'block-mount'`
- `MF-CAP-05` — LRU cache per `mfId` + invalidation event-driven (D-V2-08 deferrable, no TTL)
- `MF-INT-LIFE-03` — Permission check AL momento dell'azione (no solo pre-mount)
- `MF-PIPE-01` — Pipeline §28 esteso: validation → permission check → mapping → route resolve → execute → mapping inverso → consegna → metrics (D-V2-20 BLOCKING — chiusura PRD §47.11)

**Success criteria:**
1. MF con `permissions.publish: ['customer.*']` può pubblicare `customer.order.created` ma fallisce `payment.charged` con `PERMISSION_DENIED` topic + error category `permission`; deny esplicito `!customer.pii.*` prevale.
2. Capability missing detection: MF richiede `capability.theme.v1` non disponibile → policy `block-mount` fallisce con `CapabilityCheckResult.missing` populated; transizione MF → `failed` + topic `microfrontend.capability.missing`.
3. Pipeline §28 estesa con permission check step nell'ordine D-V2-20 BLOCKING; LRU cache hit ratio > 90% in benchmark (cache hit ~50 ns, miss ~2 µs, P-02 mitigation).
4. Permission enforcement via facade injection: `broker.publish` raw v1.x NON instrumented; solo `ctx.publish` facade applica check. Verifier conferma `v1-bc-replay/publish-ordering.test.ts` PASS.
5. Bundle `@gluezero/permissions` ≤ 5 KB gzip + Capability Registry combined; Tier-1 jsdom suite sufficient.

**Plans:** 2/5 plans executed
- [x] 11-01-PLAN.md — W1 scaffolding `@gluezero/permissions` (tsup multi-entry + types PRD §17/§19 + Pattern S1 stretto + root size-limit 5 KB + ci:gate:f11)
- [ ] 11-02-PLAN.md — W2 permission engine sync + pattern matching multi-segment + LRU cache 500 + PermissionError factory + topics locale (MF-PERM-02/04/05/06)
- [ ] 11-03-PLAN.md — W2 facade-only enforcement OQ-1 + service monkey-patch OQ-3 + permissionsModule factory 2-options (MF-PERM-01/03 + MF-INT-LIFE-03 + MF-PIPE-01)
- [x] 11-04-PLAN.md — W2 Capability Registry global + checker policy 4 valori + lifecycle hooks 7 topics OQ-2 dual subscribe (MF-CAP-01/02/03/04/05 + MF-INT-LIFE-03)
- [ ] 11-05-PLAN.md — W3 closure Tier-1 jsdom E2E + README italiano P-13 + JSDoc enrichment + bundle gate ≤ 5 KB + example HTML + verifier MF-PIPE-01 cross-fase

**UI hint:** no

**Risk / Pitfall HIGH attivi:** P-02 (publish overhead — LRU cache + fast-path), P-13 (permission theater shared-window — documentazione esplicita "governance not crypto sandbox"), P-23 (BC break check intensificato — facade injection only).

**Decisions BLOCKING discuss-phase:** D-V2-20 (ordine pipeline). **Deferrable:** D-V2-08 (capability cache TTL), D-V2-18 (worker serialization carryover WK-07).

---

## Phase 12: Compatibility / Versioning (semver 9 dimensioni) ⏳

**Goal:** Modulo `@gluezero/compat` per check semver multi-dimensione (`gluezero`, `canonicalModels`, `topics`, `routes`, `workers`, `theme`, `loaders`, `framework`, `dependencies`) — prima nuova hard dep esterna del progetto v2.0 (`semver` 7.8.0 tree-shaken subpath imports).

**Package primary:** `@gluezero/compat` (NEW) + prod hard dep `semver` 7.8.0.

**Dependencies:** F8 (Registry) + F11 (cache pattern reuse).

**Requirements (5):**
- `MF-COMPAT-01` — `MicroFrontendCompatibility` descriptor 9 dimensioni con version ranges semver
- `MF-COMPAT-02` — API `checkMicroFrontendCompatibility`, `getCompatibilityReport`, `registerCanonicalModelVersion`, `registerTopicVersion`, `registerRouteVersion`
- `MF-COMPAT-03` — `CompatibilityReport` con `ok`, `errors`, `warnings`, type enum 9 valori
- `MF-COMPAT-04` — `compatibilityPolicy: 'off' | 'warn' | 'block-registration' | 'block-load' | 'block-mount'`
- `MF-COMPAT-05` — Semver via `semver` 7.8.0 tree-shaken; bundle `@gluezero/compat` ≤ 9 KB

**Success criteria:**
1. MF dichiara `compatibility.gluezero: '^2.0.0'` su core v2.1 → `ok: true`; su core v3.0 → `ok: false`; policy `block-mount` fallisce mount.
2. 9 dimensioni testate end-to-end con matrix test (semver range subset).
3. Bundle `@gluezero/compat` ≤ 9 KB gzip INCLUSO `semver` 7.8.0 tree-shaken.
4. CompatibilityReport serializzabile via `getDebugSnapshot()`.

**Plans:** 5 plans

- [ ] 12-01-PLAN.md — W1 scaffolding `@gluezero/compat` (tsup multi-entry + noExternal semver + define __GLUEZERO_VERSION__ + types PRD §20 + Pattern S1 stretto + bundle 9 KB + ci:gate:f12)
- [ ] 12-02-PLAN.md — W2 parallel engine + version-registry (7 API) + semver-checker subpath + compat-error + topics + policy-dispatch + Tier-1 (~60 cases)
- [ ] 12-03-PLAN.md — W2 sequential compat-module factory + Service Locator install + service-wrap monkey-patch + lifecycle-hooks (4 topic subscribe + barrel completion)
- [ ] 12-04-PLAN.md — W2 closure snapshot-stub D-12-20 (F16 deferred) + memoization integration + Tier-1 SC1-SC4 (~12 cases)
- [ ] 12-05-PLAN.md — W3 closure Tier-1 SC5-SC8 (cross-fase F11+F12 ordering) + README italiano P-13/P-14 + JSDoc enrichment 8 file + bundle gate finale + MF-PIPE-01 cross-fase verifier

**UI hint:** no

**Risk / Pitfall MEDIUM attivi:** P-14 (capability/compat semver drift).

**Decisions:** Nessuna BLOCKING aggiuntiva (carryover D-V2-08 cache pattern da F11). Nota: `semver` installato è **7.7.4** (NON 7.8.0 anticipato — 7.8.0 NON esiste su npm 2026-05-13); usare `^7.7.4` latest released.

---

## Phase 13: Isolation + Theme/Cache/Gateway/Worker Integration ✅ COMPLETE

**Goal:** Modulo `@gluezero/isolation` per policy DOM/CSS/JS/Events/Storage/Network/Globals (PRD §21.3) + integrazione facade theme (carryover v1.1 D-F7-22) + cache/gateway/worker namespaced facades.

**Package primary:** `@gluezero/isolation` (NEW); estensione opt-in `@gluezero/theme` v1.1 (peer optional).

**Dependencies:** F8 (Registry + Lifecycle), F10 (Context), v1.1 `@gluezero/theme`, v1.0 `@gluezero/cache`/`@gluezero/gateway`/`@gluezero/worker`.

**Requirements (17):**
- `MF-ISO-01` — `MicroFrontendIsolationPolicy` 7 chiavi (dom, css, js, events, storage, network, globals)
- `MF-ISO-02` — DOM: `mount-root` | `shadow-dom` | `iframe`; CSS: `scoped` | `shadow-dom` | `iframe`
- `MF-ISO-03` — Storage isolation `namespaced` → `StorageFacade` con chiavi prefissate `gz:mf:<id>:<key>`
- `MF-ISO-04` — Network: `gateway-only` / `blocked` / `direct-allowed` (documentato non-enforceable shared-window, P-13)
- `MF-ISO-05` — Event: `broker-only` / `broker-plus-dom` / `isolated`
- `MF-ISO-06` — Warning su combinazioni inconsistent
- `MF-INT-THEME-01..04` — Theme integration (4 REQ-ID)
- `MF-INT-GW-01..03` — Gateway integration (3 REQ-ID)
- `MF-INT-WK-01..02` — Worker integration (2 REQ-ID)
- `MF-INT-CACHE-01..02` — Cache/storage integration (2 REQ-ID)

**Plans:** 5/5 plans executed ✅ (13-01 W1 + 13-02..04 W2 + 13-05 W3 closure)

**Status:** ✅ COMPLETE 2026-05-13 — `@gluezero/isolation` 14° package finalizzato. Bundle 4.33 KB / 12 KB cap (62% headroom). 17/17 REQ-IDs closed (MF-ISO-01..06 + MF-INT-THEME-01..04 + MF-INT-GW-01..03 + MF-INT-WK-01..02 + MF-INT-CACHE-01..02 + MF-DOC-02/04 + MF-TEST-01 + MF-PIPE-01 + MF-BC-01..04). Tier-1 unit 78/78 + integration SC1-SC7 15/15 + Tier-3 Playwright Chromium 6 scenari 23/23 PASS. AMENDMENT D-V2-F13-04-AMENDED ratificato FINAL ✅. ci:gate:f13 composite PASS (publint + attw + size-limit + v1-bc-replay 267/270 + pipeline-harness + check-d83-f13 11/11 zero-diff).

**UI hint:** sì (preview iframe sandbox — deferred F15 `@gluezero/mf-iframe`).

---

## Phase 14: Fallback & Error Boundary ✅ COMPLETE

**Goal:** Modulo `@gluezero/fallbacks` (15° workspace) — Fallback policies (onLoadError/onBootstrapError/onMountError/onRuntimeError/onUpdateError/onUnmountError) + RetryPolicy (3-mode backoff + ±20% jitter) + CircuitBreakerPolicy (3-state FSM closed/open/half-open) + 4 rendering modes (html/component/event/custom) + MicroFrontendError class. Composition esterna pura via subscribe ai 7 MF_ERROR_TOPICS F8 (zero diff packages/microfrontends/src/).

**Package primary:** `@gluezero/fallbacks` (NEW)

**Dependencies:** F8 (MF_ERROR_TOPICS + MicroFrontendsService) + F11 (lifecycle-hooks pattern carryover) + F13 (SERVICE_ISOLATION shadow-dom lookup opt) + F3 (RetryEngine + CircuitBreaker pattern carryover stretto).

**Requirements (5):**
- `MF-FALLBACK-01` — `MicroFrontendFallbackPolicy` 6 onXError scope + RetryPolicy + CircuitBreakerPolicy interface
- `MF-FALLBACK-02` — RetryPolicy 3-mode backoff (none/linear/exponential) + ±20% jitter + per-MF+per-phase counter
- `MF-FALLBACK-03` — CircuitBreakerPolicy 3-state FSM + 2 topics emit (microfrontend.circuit.opened + microfrontend.circuit.closed)
- `MF-FALLBACK-04` — MicroFrontendError class extends Error con BrokerError shape inline + duck-typing compat + ES2022 cause
- `MF-FALLBACK-05` — 4 rendering modes (html target chain + isolation respect; component Service Locator F15 delega; event broker.publish; custom await + try/catch) + none observability

**Success criteria:**
1. Fallback policy applicata su ognuna delle 4 phase eligible (load/bootstrap/mount/runtime) con i 4 mode (html/component/event/custom) — Tier-3 6 scenari verde.
2. RetryEngine + CircuitBreaker integrated; topic emit microfrontend.recovered + microfrontend.circuit.{opened,closed} via source descriptor F1 D-23.
3. MicroFrontendError class extends BrokerError shape inline; isBrokerError(err) returns true via duck-typing.
4. Bundle `@gluezero/fallbacks` ≤ 6 KB gzipped + augment ≤ 1 KB; Tier-1 jsdom ≥107 + Tier-3 Chromium 6 scenari PASS.

**Plans:** 5/5 plans complete

- [x] 14-01-PLAN.md — W1 scaffolding @gluezero/fallbacks (tsup multi-entry + peerDeps 5 + types PRD §29.3 + Pattern S1 augment stretto + bundle 6 KB cap + ci:gate:f14 + interfaces skeleton + Service Locator binding SERVICE_FALLBACKS)
- [x] 14-02-PLAN.md — W2 MicroFrontendError class + topics literal F14 (3 nuovi) + installErrorSubscribe (subscribe loop 7 MF_ERROR_TOPICS + dispatch entry-point + AbortSignal cascade) — MF-FALLBACK-04 closure
- [x] 14-03-PLAN.md — W2 RetryEngine (counter Map per-MF+per-phase + 3-mode backoff + ±20% jitter) + CircuitBreaker (3-state FSM + threshold + lazy transition + topics emit con source descriptor F1) — MF-FALLBACK-02/03 closure
- [x] 14-04-PLAN.md — W2 4 renderers (html + component + event + custom) + dispatcher discriminated union 5-mode + fallbacksModule install FINAL (orchestrator chain D-V2-F14-12 circuit→retry→fallback + cleanup P-02) — MF-FALLBACK-01/05 closure
- [x] 14-05-PLAN.md — W3 closure Tier-3 Playwright 6 scenari + README italiano 13 sezioni + JSDoc enrichment + bundle gate 6KB + check-d83-f14.mjs verifier reale + ci:gate:f14 composite + example HTML demo + ROADMAP §F14 refuso fix + 14-VERIFICATION.md + STATE/TRACKER closure

**UI hint:** sì (example HTML demo 4 MF scenari + UI interattiva).

**Risk / Pitfall HIGH attivi:** P-01 (retry storm — jitter ±20% + circuit→retry order mitigate), P-04 (custom handler Promise NON awaited — code review gate + Tier-1 await assertion), P-05 (subscribe stesso topic 2x — idempotent guard SERVICE_FALLBACKS check).

**Decisions BLOCKING discuss-phase:** Nessuna BLOCKING residua (D-V2-05 mf-inspector subpath → F16 ratificato, NON F14). 20 D-V2-F14-* decisioni lockate in 14-CONTEXT.md.

---

## Phase 15: WC + Iframe + Module Federation + single-spa Loaders ⏳

**Goal:** 4 nuovi loader adapter PRD §22-§27 — `@gluezero/mf-web-component` (Custom Elements ESM/classic), `@gluezero/mf-iframe` (sandbox + bridge postMessage 9 message types + LRU dedup replay + Valibot schema strict), `@gluezero/mf-module-federation` (experimental `@0.x.0` — webpack/rsbuild remoteEntry.js + share scope), `@gluezero/mf-single-spa` (experimental `@0.x.0` — lifecycle mapping). Security blocker fase per D-V2-09 (iframe Valibot schema + replay attack mitigation + expectedOrigin MANDATORY).

**Packages:** `@gluezero/mf-web-component` + `@gluezero/mf-iframe` + `@gluezero/mf-module-federation` + `@gluezero/mf-single-spa` (4 NEW).

**Dependencies:** F8 (MicroFrontendRegistry + Lifecycle FSM + MicroFrontendLoaderAdapter interface MF-LOADER-REG-02), F9 (`@gluezero/mf-esm` loader pattern carryover), F13 (`@gluezero/isolation` iframe stub IFRAME_ADAPTER_REQUIRED dependency injection — sblocco F15 reale).

**Requirements (13):**
- `MF-WC-01` — `@gluezero/mf-web-component`: ESM/classic script load + `customElements.define()` await + context via `contextMode: 'property' | 'attribute' | 'event'` (default property)
- `MF-IFRAME-01` — `@gluezero/mf-iframe`: sandbox configurabile (default `'allow-scripts'`) + `allow?` policy + `bridge: true` handshake
- `MF-IFRAME-02` — Bridge 9 message types: `gz:handshake`, `gz:ready`, `gz:publish`, `gz:subscribe`, `gz:unsubscribe`, `gz:context:get`, `gz:context:update`, `gz:error`, `gz:lifecycle`
- `MF-IFRAME-03` — D-V2-09 BLOCKING: `IframeBridgeMessage` validato via Valibot strict + reject senza `microFrontendId`/`id`/`timestamp` + LRU dedup replay
- `MF-IFRAME-04` — `expectedOrigin` MANDATORY non-optional + `targetOrigin '*'` ban via lint custom + Renwa Mar 2026 + CVE-2024-49038 mitigation
- `MF-IFRAME-05` — Subpath `@gluezero/mf-iframe/client` separato per code in-iframe (no broker completo esposto)
- `MF-MF-01` — `@gluezero/mf-module-federation` experimental `@0.x.0` (D-V2-23): `remoteEntry.js` load + share scope init + container `get(module)` + factory result normalize + lifecycle return
- `MF-MF-02` — 5 errori specifici: `MF_REMOTE_ENTRY_LOAD_FAILED`, `MF_REMOTE_SCOPE_NOT_FOUND`, `MF_REMOTE_MODULE_NOT_FOUND`, `MF_REMOTE_FACTORY_FAILED`, `MF_SHARE_SCOPE_FAILED`
- `MF-SS-01` — `@gluezero/mf-single-spa` experimental `@0.x.0` (D-V2-23): lifecycle mapping `bootstrap→bootstrap`/`mount→mount`/`unmount→unmount` + NO router replacement + publish eventi GlueZero su mount/unmount/error
- `MF-SEC-01` — Iframe origin validation MANDATORY + sandbox baseline (no `allow-same-origin` default) — SC2, SC5
- `MF-SEC-02` — Remote loading: `integrity` quando possibile + allowlist URL configurabile + logging URL remote
- `MF-SEC-03` — Doc governance esplicita: permissions in shared-window NON sandbox crittografica (PRD §44.1) — SC5
- `MF-SEC-04` — Iframe bridge: Valibot strict schema + ignore unknown messages + LRU dedup replay + rate limit 100 msg/s per `mfId`

**Success criteria:**
1. **SC1** — WC loader: ESM module si carica via `import()`, `customElements.define()` risolto, context passato property/attribute/event modes, mount in container, unmount clean.
2. **SC2** — Iframe loader: bridge handshake completo 9 messaggi + Valibot schema reject malformed + LRU dedup replay + `expectedOrigin` enforcement + sandbox `allow-scripts` baseline.
3. **SC3** — Module Federation experimental: `remoteEntry.js` load + share scope + 5 errori specifici raised correttamente nei rispettivi failure mode.
4. **SC4** — single-spa experimental: lifecycle mapping 1-1 + topics GlueZero emit su mount/unmount/error.
5. **SC5** — Security baseline: lint custom blocca `targetOrigin '*'`, allowlist URL doc completa, governance non-sandbox documentata in README per ogni adapter.
6. **SC6** — Subpath `@gluezero/mf-iframe/client` validato attw + publint + no broker completo esposto cross-frame.

**Plans:** 5/5 plans complete ✅

- [x] 15-01-PLAN.md — W1 scaffolding 4 packages F15 ESM-only (`becc268`)
- [x] 15-02-PLAN.md — W2 P02 `@gluezero/mf-web-component` implementation (`37ec15a..f5a7b6e`, 34 Tier-1)
- [x] 15-03-PLAN.md — W2 P03 `@gluezero/mf-iframe` + D-V2-09 BLOCKING closure (`843ccce..ce65ef0`, 66 Tier-1)
- [x] 15-04-PLAN.md — W2 P04 `@gluezero/mf-module-federation` + `@gluezero/mf-single-spa` merged (`f7c9cab..4f9b3c9`, 56 Tier-1)
- [x] 15-05-PLAN.md — W3 P05 closure F15 (`9ff9372..30ef597`, 38 Tier-3 + 4 README + 4 example HTML + check-d83-f15.mjs + 15-VERIFICATION.md formal closure)

**Status:** ✅ COMPLETE 2026-05-15. 5/5 plans + 13/13 REQ-IDs + 6/6 SC + 28 decisions (16 D-V2-F15-01..16 + 12 carryover D-V2-F15-17..28) + D-V2-09 + D-V2-23 BLOCKING formal closure + D-83 strict OCTUPLE 15/15 ZERO-DIFF + BC §42 + MF-PIPE-01 cross-fase 267/270 PASS + 194 test (156 Tier-1 + 38 Tier-3 Chromium Playwright) + bundle aggregate 11.4 KB / 22 KB cap (52% utilizzo). 10 STRIDE T-15-01..10 (9 mitigate + 1 accepted T-15-10 doc).

**UI hint:** sì (4 example HTML demo PRD §40.4 — `mf-shadow-dom.html`, `mf-iframe-sandbox.html`, `mf-module-federation-experimental.html`, `mf-single-spa-experimental.html`).

**Risk / Pitfall HIGH gestiti:** P-22 (Tier-3 Playwright Chromium 38 scenari PASS), security iframe replay+origin (7 D-V2-09 gates ALL mitigated), D-V2-09 BLOCKING closed.

**Decisions BLOCKING closed F15:** **D-V2-09** ✅ (Valibot bridge schema strict + LRU dedup replay + expectedOrigin MANDATORY). **D-V2-23** ✅ (MF/SS experimental `@0.x.0` V2.0 — GA promotion deferred V2.1).

---

## Phase 16: MF Devtools subpath + SnapshotProvider MIN-3 + Metrics MF ✅

**Goal:** Subpath `@gluezero/devtools/mf-inspector` (D-V2-05 BLOCKING — NON nuovo package standalone) con Inspector 17 campi PRD §30.3 + `MicroFrontendDebugSnapshot` integrato in `broker.getDebugSnapshot()` via SnapshotProvider plug-in pattern (MIN-3 promosso da F8) + Ring buffer 500 pattern carryover v1.x F6/F7 + 14 metriche per-MF + estensione `getMetrics()` v1.x con `metrics.microFrontends[]` array (D-V2-19 BLOCKING preserva metrics shape v1.x quando nessun MF attivo).

**Package primary:** `@gluezero/devtools` v1.x esistente (subpath `/mf-inspector` NEW) — zero nuovo workspace.

**Dependencies:** F8 (MIN-3 SnapshotProvider seam pre-instrumentato), tutte le fasi runtime F9-F15 (Inspector data sources: loaders, context, permissions, compat, isolation, fallbacks, framework adapters).

**Requirements (7):**
- `MF-DEVTOOLS-01` — Inspector subpath espone 17 campi: MF registrati, stato, version, owner, loader type, mount target, isolation policy, permissions, capabilities, compatibility, topics pub/sub, route/worker usati, context r/w, theme roles/tokens, errori lifecycle, fallback applicato, timings, subscription create, risorse cleanup
- `MF-DEVTOOLS-02` — `MicroFrontendDebugSnapshot` in `broker.getDebugSnapshot()` via SnapshotProvider plug-in (MIN-3); campo `external?` opzionale assente se nessun provider (preserva BC §42 API #13)
- `MF-DEVTOOLS-03` — `MicroFrontendTimings` registra 11 timing: `registeredAt`, `loadStartedAt`, `loadedAt`, `bootstrapStartedAt`, `bootstrappedAt`, `mountStartedAt`, `mountedAt`, `unmountStartedAt`, `unmountedAt`, `destroyStartedAt`, `destroyedAt`
- `MF-DEVTOOLS-04` — Ring buffer 500 carryover pattern v1.x F6/F7 + pause/resume API + flush API
- `MF-DEVTOOLS-05` — SnapshotProvider Registry MIN-3 in `packages/devtools/src/`: `devtools.registerSnapshotProvider(name, fn)` sync invocation; modulo MF si registra al boot
- `MF-OBS-02` — 14 metriche per-MF: `mfs.registered`, `mfs.mounted`, `mfs.failed`, `mfs.timeAvgLoad`, `mfs.timeAvgMount`, `mfs.mountFailuresPerId`, `mfs.permissionDeniedCount`, `mfs.compatFailures`, `mfs.capMissing`, `mfs.eventsPerMfId`, `mfs.routeCallsPerMfId`, `mfs.workerTasksPerMfId`, `mfs.contextWritesPerMfId`, `mfs.activeSubsPerMfId`
- `MF-OBS-03` — D-V2-19 BLOCKING: `getMetrics()` estende v1.x con `metrics.microFrontends[]` array; preserva shape v1.x quando nessun MF attivo

**Success criteria:**
1. **SC1** — Inspector 17 campi popolati end-to-end con 2 MF montati (ESM + WC) + lifecycle 11 timings completi + ring buffer 500 pause/resume/flush funzionanti.
2. **SC2** — SnapshotProvider MIN-3 registration + `external?` field assente quando nessun provider + bit-exact v1.x `getDebugSnapshot()` shape (BC §42 API #13).
3. **SC3** — `getMetrics().microFrontends[]` populated con 14 metriche per-MF + D-V2-19 shape preserved quando nessun MF.
4. **SC4** — Subpath `/mf-inspector` attw + publint clean + tree-shaken (no inclusion in `@gluezero/devtools` core).

**Plans:** 4 plans ✅ ALL COMPLETE 2026-05-16
- [x] 16-01-PLAN.md — W1 P01 MIN-3 SnapshotProvider Registry foundation + tsup multi-entry subpath mf-inspector + check-d83-f16.mjs verifier ✅ COMPLETE 2026-05-16 (`52bc405`, `6032e12`, `1442747`, `241f2d2` — 10 test PASS; MF-DEVTOOLS-05; D-V2-F16-01/02/03/19 closed)
- [x] 16-02-PLAN.md — W2 P02 mfInspectorModule + 17-fields aggregator hybrid pull+push + per-MF ring buffer 500 + 11 timings collector + pause/resume/flush ✅ COMPLETE 2026-05-16 (`7c9ab01`, `5c3d68e`, `d228924` — 61 test PASS; MF-DEVTOOLS-01..04; D-V2-F16-04..09)
- [x] 16-03-PLAN.md — W3 P03 14 metriche per-MF inline mfInspectorModule + DevtoolsBroker.registerMetricsProvider + getMetrics extension D-V2-19 + BC §42 get-metrics-shape.test.ts ✅ COMPLETE 2026-05-16 (`0a9fcfe`, `f346d8e`, `34c9a36` — 35 test PASS; MF-OBS-02/03; D-V2-F16-13/14/15 + D-V2-19 BLOCKING closure)
- [x] 16-04-PLAN.md — W4 P04 closure: README italiano 13 sezioni + JSDoc enrichment + bundle gate finale + example HTML interactive + ci:gate:f16 + 16-VERIFICATION.md ✅ COMPLETE 2026-05-16 (sc-closure 14 test PASS + 16-VERIFICATION.md formal closure)

**UI hint:** sì (MF Inspector UI tab — extension v1.x devtools panel).

**Risk / Pitfall MEDIUM attivi:** P-23 (BC break check intensificato — `getDebugSnapshot()` + `getMetrics()` shape preservation v1.x), P-22 (Tier-1 jsdom sufficient MF-TEST-01).

**Decisions BLOCKING discuss-phase:** **D-V2-05** (mf-inspector subpath devtools, NO package standalone) + **D-V2-19** (metrics.microFrontends[] array shape preservation).

---

## Phase 17: Framework Adapters (React + WC) + Migration + Docs + GA Release ⏳

**Goal:** Framework adapters opzionali v2.0 GA — `@gluezero/react` (Provider + 6 hooks + `createReactMicroFrontendLifecycle` factory + React 19 StrictMode + ErrorBoundary) + `@gluezero/web-components` (`GlueZeroElement` base class + cleanup `disconnectedCallback` + subpath `/lit` Lit 3.x mixin). Vue/Svelte adapter deferred V2.1 (D-V2-24). Closure milestone v2.0: tier discipline (MF-TEST-01) + 17 categorie unit + 12 scenari integration + bench `<5%`/`<10%` regression + 18 documenti PRD §41 + README italiano + JSDoc + migration guide 1.x→2.0 con adoption levels A/B/C + 6 examples HTML standalone + TypeDoc GitHub Pages + npm publish `@gluezero/*@2.0.0` (D-V2-F8-10 unlock — no npm publish until F17 lockato).

**Packages:** `@gluezero/react` + `@gluezero/web-components` (2 NEW). Vue/Svelte → V2.1 (D-V2-24).

**Dependencies:** Tutte le fasi precedenti (F8-F16). Framework adapters costruiscono su F8 (Lifecycle FSM) + F10 (RuntimeContext) + F13 (Isolation shadow-dom helper) + F14 (Fallback rendering modes — `component` rendering delega adapter).

**Requirements (16):**
- `MF-FRAMEWORK-REACT-01` — `@gluezero/react`: `GlueZeroProvider`, `useGlueZero()`, `useGlueZeroPublish()`, `useGlueZeroSubscribe()`, `useRuntimeContext()`, `useMicroFrontendContext()` (6 hooks)
- `MF-FRAMEWORK-REACT-02` — `createReactMicroFrontendLifecycle(Component, options?)` factory ritorna `{bootstrap, mount, unmount, destroy}` compatibile `MicroFrontendRuntimeModule`
- `MF-FRAMEWORK-REACT-03` — Compatibile React 19 (`use`, suspense, StrictMode coalescing — pattern carryover D-F7-04 v1.1) + ErrorBoundary runtime error
- `MF-FRAMEWORK-REACT-04` — Peer optional `react` + `react-dom` `>=18.2.0 <20.0.0`; no singleton enforcement lato GlueZero (host gestisce)
- `MF-FRAMEWORK-WC-01` — `@gluezero/web-components`: `GlueZeroElement` base class opzionale (~150 LoC) + helper context property + publish/subscribe shortcuts
- `MF-FRAMEWORK-WC-02` — Cleanup automatico su `disconnectedCallback` — tutte le subscription create dall'elemento unsubscribed
- `MF-FRAMEWORK-WC-03` — Subpath `@gluezero/web-components/lit` opzionale per Lit 3.x con `LitElement` mixin
- `MF-TEST-01` — Tier discipline closure formale (MF-TEST-01 cross-fase chiusura — verifier per ogni fase F8-F17)
- `MF-TEST-02` — 17 categorie unit test minime PRD §40.1 (register/unregister, validazione, duplicate id, state transitions, idempotence, load success/failure, mount target missing, bootstrap/mount/unmount/destroy success, lifecycle concurrent, subscription cleanup, capability check, compatibility check, permission allow/deny, context r/w, storage namespacing, isolation policy validation, fallback invocation, debug snapshot MF)
- `MF-TEST-03` — 12 scenari integration test PRD §40.2 (ESM load+mount+publish+unmount, WC mount, iframe bridge handshake, permission denied, context change propagato, compat failure block-mount, capability missing, shadow DOM mount con theme tokens, worker task attribuito, gateway route attribuita, fallback render, devtools snapshot)
- `MF-TEST-04` — Bench `<5%` regression scenario A (no modules) + `<10%` scenario B (module installed, no MF active) — P-02 mitigation
- `MF-DOC-01` — 18 documenti PRD §41 (architettura v2.0, core vs MF, MicroFrontendDescriptor, lifecycle, loaders, isolation, context, permissions, capabilities, compat/versioning, fallback, devtools MF, esempi ESM/WC/iframe/React, migration guide, performance)
- `MF-DOC-02` — README italiano per ogni nuovo package + JSDoc descrittivi italiano (identificatori inglese)
- `MF-DOC-03` — Migration guide v1.x → v2.0: zero breaking change + opt-in module pattern + adoption levels A/B/C + esempi customer-dashboard
- `MF-DOC-04` — 6 examples standalone HTML in `examples/microfrontends/` (CDN esm.sh): `mf-esm-basic.html`, `mf-shadow-dom.html`, `mf-iframe-sandbox.html`, `mf-react-adapter.html`, `mf-permissions-demo.html`, `mf-compat-matrix.html`
- `MF-DOC-05` — TypeDoc auto-deploy GitHub Pages (carryover workflow v1.1 `docs.yml`)

**Success criteria:**
1. **SC1** — React adapter: Provider + 6 hooks + factory + StrictMode safe + ErrorBoundary integration Tier-3 Playwright Chromium scenario verde.
2. **SC2** — WC adapter: `GlueZeroElement` base + `disconnectedCallback` cleanup + subpath `/lit` Lit 3.x mixin attw clean.
3. **SC3** — Bench `<5%` scenario A + `<10%` scenario B — P-02 cap verificato CI gate.
4. **SC4** — Test coverage: 17 unit categorie + 12 integration scenari + tier discipline MF-TEST-01 verifier closure.
5. **SC5** — Docs site live (TypeDoc GitHub Pages) + 18 documenti PRD §41 + 6 examples HTML + migration guide A/B/C + npm publish `@gluezero/*@2.0.0` GA (D-V2-F8-10 unlock).

**Plans:** 6/7 plans executed
- [x] 17-01-PLAN.md — W1 P01 scaffolding 2 packages (@gluezero/react + @gluezero/web-components) + tsup multi-entry subpath /lit + size-limit gate
- [x] 17-02-PLAN.md — W2 P02 @gluezero/react full (Provider + 6 hooks + factory + ErrorBoundary + Tier-1 jsdom)
- [x] 17-03-PLAN.md — W3 P03 @gluezero/web-components + subpath /lit (GlueZeroElement + AbortController + ReactiveController + LitMixin)
- [x] 17-04-PLAN.md — W4 P04 test closure cross-fase (MF-TEST-01..04 + tinybench bench + Tier-3 React Playwright)
- [x] 17-05-PLAN.md — W5 P05 18 documenti docs/v2/ + 2 README adapter italiano + TypeDoc GitHub Pages
- [x] 17-06-PLAN.md — W5 P06 examples/customer-dashboard/ end-to-end + 2 NEW examples HTML (mf-react-adapter + mf-compat-matrix) — MF-DOC-03 + MF-DOC-04 6/6 closure
- [ ] 17-07-PLAN.md — W7 P07 GA release sequencing (check-d83-f17 + changeset 2.0.0-rc.0 + 7-day soak + promote latest + 17-VERIFICATION.md)

**UI hint:** sì (React + WC demo apps + 6 examples HTML standalone PRD §40.4).

**Risk / Pitfall HIGH attivi:** P-02 (bench `<5%`/`<10%` regression hard gate), P-23 (BC break check finale milestone closure), P-22 (Tier-3 Playwright MF-TEST-01 React + WC).

**Decisions BLOCKING discuss-phase:** **D-V2-F8-10** (npm publish unlock GA gate F17 — no publish v2.0 prima di closure) + D-V2-24 (Vue/Svelte deferred V2.1 ratificato).

---

## Decisions BLOCKING attive milestone v2.0

| ID | Decisione | Fase chiusura |
|----|-----------|---------------|
| D-V2-05 | mf-inspector è subpath devtools (NO nuovo package standalone) | **F16** ✅ CHIUSA 2026-05-16 |
| D-V2-09 | Iframe bridge Valibot schema strict + LRU dedup replay + `expectedOrigin` MANDATORY | **F15** ✅ CHIUSA 2026-05-15 |
| D-V2-13 | Isolation è opt-in default `'mount-root'`/`'scoped'` (no breaking) | F13 ✓ chiusa |
| D-V2-19 | `getMetrics().microFrontends[]` array shape preservation v1.x | **F16** ✅ CHIUSA 2026-05-16 |
| D-V2-20 | Pipeline §28 esteso ordine literal (validation → permission → mapping → ...) | **F11** ✓ chiusura |
| D-V2-23 | MF/SS adapter experimental `@0.x.0` (no GA in V2.0) | **F15** ✅ CHIUSA 2026-05-15 |
| D-V2-24 | Vue/Svelte adapter deferred V2.1 (React + WC sufficient V2.0 GA) | **F17** ✓ chiusura prevista |
| D-V2-F8-10 | npm publish unlock solo a closure F17 GA (no publish prematuro v2.0) | **F17** ✓ chiusura prevista |

Deferrable: D-V2-08 (capability TTL), D-V2-18 (worker WK-07).

---

*Last updated: 2026-05-16 — F16 closed (D-V2-05 + D-V2-19 BLOCKING formal closure); F17 next; 8 BLOCKING decisions tracked (D-V2-13 chiusa F13; D-V2-09 + D-V2-23 chiuse 2026-05-15 F15; D-V2-05 + D-V2-19 chiuse 2026-05-16 F16; D-V2-20 chiusa F11; D-V2-24 + D-V2-F8-10 chiusura prevista F17 GA).*
