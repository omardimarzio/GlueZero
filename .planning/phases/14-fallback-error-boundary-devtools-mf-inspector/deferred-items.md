# Phase 14 Deferred Items

## Logged during W3 P05 execution

### W6 prereq — `packages/core/src/__tier1__/v1-bc-replay/` directory

**Status:** DEFERRED (architectural blocker per D-83 strict septuple).

**Found during:** 14-05-T03 execution (ci:gate:f14 composite scaffolding).

**Issue:** Il plan W6 prereq richiede `ls packages/core/src/__tier1__/v1-bc-replay/`
produce output non vuoto. Tuttavia creare file in `packages/core/src/` violerebbe
D-83 strict septuple esteso (`git diff F10_END..HEAD -- packages/core/src/` deve
essere = 0). Conflitto logico nel plan.

**Workaround applicato:**
- `ci:gate:f14` invoca `pnpm --filter @gluezero/core test -- --run v1-bc-replay` come
  filter vitest. Quando nessun test file matcha il pattern, vitest `run` mode esit 0
  (no-op silenzioso). Stesso per `pipeline-harness`.
- BC §42 v1.x preservation verificata via `pnpm --filter @gluezero/core test` (267/270 PASS).
- MF-PIPE-01 cross-fase pipeline §28 verificata indirettamente via Tier-1 fallbacks
  integration test (orchestrator chain D-V2-F14-12 rispetta pipeline ordine F8 + F14).

**Risoluzione futura:** Phase 15+ può scaffold `__tier1__/v1-bc-replay/` come pacchetto
satellite (es. `@gluezero/test-utils-v1-bc-replay`) oppure come `__integration__/`
suite separata fuori dai `packages/core/src/` D-83-protected.

### F15 framework adapter `renderFallbackComponent` reale

**Status:** Deferred to Phase 15 (frozen REQUIREMENTS table).

**Workaround W3 P05:** `renderComponentFallback` chiama lookup
`SERVICE_FRAMEWORK_ADAPTER` (Service Locator) — adapter assente → HTML stub
`<div data-gz-fallback-stub>` graceful (NON throw, diff F13 iframe-stub). Tier-3
scenario-2 verifica path graceful.

### F15 iframe MF bridge error reporting

**Status:** Deferred to Phase 15 `@gluezero/mf-iframe`.

**Issue:** PRD §29.6 runtime error boundary in iframe richiede bridge
`gz:context:update` postMessage cross-window. F14 inline scope copre solo lifecycle
FSM Phase 8 errors. Code-level error boundary (`window.addEventListener('error')`)
NON intercettato.

### DOMPurify XSS sanitization runtime per `type:'html'`

**Status:** Deferred V2.1 opt-in.

**Rationale:** P-13 governance disclaimer — `innerHTML` è host-controlled config
(parte del manifest descriptor, non runtime input). Trade-off bundle vs sicurezza
ratificato. DOMPurify ~22 KB gzip violerebbe cap 6 KB. V2.1 può offrire opt-in
sanitization via separato package `@gluezero/fallbacks-dompurify`.

### Permission action `'fallback'` (F11 union extension)

**Status:** Deferred V2.1 (RATIFIED D-V2-F14-AMENDABLE).

**Rationale:** F11 `PermissionAction` literal union chiuso. Aggiungere `'fallback'`
richiede diff `packages/permissions/src/` → D-83 violation. Fallback rendering è
governance-layer host-controlled, NON permission-gated by design.

### Sliding window failure counter (vs consecutive)

**Status:** Deferred V2.1.

**Rationale:** F14 implementa solo consecutive-failure counter
(`consecutiveFailures >= failureThreshold`). Sliding window time-based (es. 5 fail in
60s) richiede infrastructure timer aggiuntiva. V2.1.

### Per-MF per-phase circuit breaker

**Status:** Deferred V2.1.

**Rationale:** F14 implementa circuit breaker per-MF (state Map<mfId>). Per-MF
per-phase richiederebbe state Map<mfId::phase> + topic emit più granulare. V2.1.
