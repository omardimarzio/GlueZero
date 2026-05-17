---
phase: 14-fallback-error-boundary-devtools-mf-inspector
plan: "14-04"
title: "W2 P04 — 4 Renderers (html/component/event/custom) + dispatcher + fallbacksModule install FINAL (orchestrator chain D-V2-F14-12)"
subsystem: "@gluezero/fallbacks"
tags: ["fallback-renderer", "dispatcher", "orchestrator-chain", "service-locator", "f15-stub", "isolation-respect", "f14-w2"]
wave: 2
depends_on: ["14-01", "14-02", "14-03"]
requirements_closed:
  - "MF-FALLBACK-01 — MicroFrontendFallbackPolicy 6-onXError scope (load/bootstrap/mount/runtime/update/unmount) wire reale via getDefinitionForPhase mapping + descriptor.fallback override + options.defaultPolicy carryover. BL1 fix frozen: 'update' → onUpdateError, 'destroy' → undefined (6-scope contract REQUIREMENTS.md riga 140)"
  - "MF-FALLBACK-05 — 4 rendering modes (html target chain isolation respect; component Service Locator F15 stub fallback; event broker.publish con source descriptor F1 D-23; custom await + try/catch) + none observability emit unificato microfrontend.fallback.rendered F8 governance riuso"
requires:
  - "@gluezero/core (Broker + BrokerModule + BrokerModuleContext + SERVICE_FALLBACKS + SERVICE_MICROFRONTENDS)"
  - "@gluezero/microfrontends (MicroFrontendsService 5 ops + MF_ERROR_TOPICS + MF_GOVERNANCE_TOPICS riuso)"
  - "@gluezero/fallbacks W1 14-01 (FallbackDefinition discriminated union 5-mode + MicroFrontendFallbackPolicy + types/descriptor-augment getFallback + topics + service-locator FallbacksService)"
  - "@gluezero/fallbacks W2 P02 14-02 (MicroFrontendError class + installErrorSubscribe seam composition esterna pura D-V2-F14-01)"
  - "@gluezero/fallbacks W2 P03 14-03 (createRetryEngine + createCircuitBreaker — 3-state FSM + 3-mode backoff)"
provides:
  - "renderHtmlFallback(broker, mfId, mountElement?, selector?, html) — target chain priority (a→b→c) + F13 SERVICE_ISOLATION shadow-dom detection (W7 fix: HTMLElement | ShadowRoot | undefined widening)"
  - "renderComponentFallback(broker, mfId, target, component, error) — F15 SERVICE_FRAMEWORK_ADAPTER lookup graceful + HTML stub data-gz-fallback-stub fallback (W9 fix: escapeAttr regex /[<>\"'&backtick]/g 6-char coverage)"
  - "renderEventFallback(broker, mfId, phase, error, definition) — broker.publish con topic ?? FALLBACK_EVENT_DEFAULT_TOPIC + source descriptor F1 D-23"
  - "renderCustomFallback(handler, error, ctx) async — await + try/catch + Promise unwrap (result instanceof Promise check micro-perf)"
  - "dispatchFallback async discriminated union 5-mode + emit unificato microfrontend.fallback.rendered F8 governance riuso D-V2-F14-02"
  - "fallbacksModule({defaultPolicy?, retryDefault?, circuitDefault?}) FINAL install: SERVICE_MICROFRONTENDS lookup throw + idempotent SERVICE_FALLBACKS guard + RetryEngine + CircuitBreaker + Service Locator binding + installErrorSubscribe wire + orchestratorChain D-V2-F14-12 (circuit → retry → fallback render → emit recovered/rendered) + cleanup P-02 microfrontend.unregistered subscribe + AbortSignal cascade D-V2-16"
  - "getDefinitionForPhase phase→onXError mapping BL1-fix MF-FALLBACK-01 frozen"
  - "Anti-singleton D-30: ogni fallbacksModule() call ritorna nuovo BrokerModule"
affects: []
tech-stack:
  added: []
  patterns:
    - "Rule 4 stretto F13 iframe-stub.ts per Service Locator delega F15 (component renderer) — diff F13 → F14: NON throw (F14 graceful fallback è degraded recovery, F13 iframe-stub throw IFRAME_ADAPTER_REQUIRED perché apply-chain blocking)"
    - "Rule 4 stretto F13 isolation-module.ts + F11 permissions-module.ts per install flow (lookup + idempotent + AbortController + service register + hooks + cleanup cascade)"
    - "Rule 3 inline derivato PRD §29.3 per html target chain + custom await/catch + dispatcher discriminated union switch"
    - "D-V2-F14-02 F8 governance topic riuso (MF_GOVERNANCE_TOPICS[4] = 'microfrontend.fallback.rendered') invece di duplica literal locale"
    - "D-V2-F14-12 orchestrator chain order: (1) circuit check canExecute → (2) retry check shouldRetry (skip runtime/update OQ-1) → (3) fallback render dispatch + success path emit microfrontend.recovered + reset counter + recordSuccess"
    - "D-V2-F14-10-AMENDED runtime/update retry skip per F8 5-ops API surface (alternative a/b violano D-83, alternativa c preferred). recoverable:true heuristic preserved per devtools observability F16"
    - "D-V2-F14-13 html target chain: (a) mountElement → (b) document.querySelector(selector) → (c) null + console.warn + fallbackType:'html-skipped' + F13 SERVICE_ISOLATION shadow-dom detection target widening"
    - "D-V2-F14-14 component Service Locator F15 stub: adapter assente → graceful HTML stub data-gz-fallback-stub (NON-throw, diff F13 iframe-stub throw)"
    - "D-V2-F14-15 event/custom: event publish con FALLBACK_EVENT_DEFAULT_TOPIC default + custom await + try/catch + console.error + fallbackType:'custom-failed'"
    - "D-V2-F14-16 cleanup cascade D-V2-16 carryover: ctrl.signal abort → installErrorSubscribe unsubscribeAll + unregisterSub.unsubscribe + shutdownSignal opt forwarding host"
    - "D-83 strict septuple esteso v2.0: 7 protected packages src/ zero diff verificato post-W2 P04 (git diff 8f6b4b7..HEAD = 0 lines)"
    - "F1 D-23 source descriptor convention {type:'plugin', id:'fallbacks', name:'@gluezero/fallbacks'} + deliveryMode:'sync' obbligatorio per ogni broker.publish"
    - "Anti-singleton D-30 carryover F1 — ogni fallbacksModule() call ritorna nuovo BrokerModule"
key-files:
  created:
    - "packages/fallbacks/src/renderers/html.ts (105 LoC) — renderHtmlFallback target chain + F13 isolation shadow-dom detection"
    - "packages/fallbacks/src/renderers/component.ts (114 LoC) — renderComponentFallback F15 adapter delega + HTML stub generic"
    - "packages/fallbacks/src/renderers/event.ts (66 LoC) — renderEventFallback broker.publish + source descriptor"
    - "packages/fallbacks/src/renderers/custom.ts (50 LoC) — renderCustomFallback async await + try/catch + Promise unwrap"
    - "packages/fallbacks/src/fallback-renderer.ts (202 LoC) — dispatchFallback async discriminated union 5-mode + emit unificato"
    - "packages/fallbacks/src/fallback-renderer.test.ts (595 LoC, 29 it() blocks) — Tier-1 jsdom dispatcher coverage 4-mode + isolation mock + adapter mock + edge cases"
    - "packages/fallbacks/src/fallbacks-module.test.ts (428 LoC, 17 it() blocks) — Tier-1 integration full chain + orchestrator + cleanup cascade + retry success path W8"
  modified:
    - "packages/fallbacks/src/fallbacks-module.ts (414 LoC, was 109 LoC W1 stub) — W1 stub no-impl → FINAL install + orchestrator chain D-V2-F14-12"
decisions:
  - "D-V2-F14-10-AMENDED ratificata alternativa (c) skip retry runtime/update per F8 5-ops API surface compliance D-83 (alternatives a/b violano septuple)"
  - "BL1 fix MF-FALLBACK-01 frozen getDefinitionForPhase: 'update' → policy.onUpdateError (was erroneamente returning undefined); 'destroy' → undefined (NO per-policy field — 6-scope contract REQUIREMENTS.md riga 140 — orchestrator chain applica default fallback no-policy-field path)"
  - "Component renderer dispatcher path: target risolto pre-renderer (mountElement priority, fallback querySelector, shadowRoot non valid per F15 adapter — instanceof HTMLElement guard) per evitare passare ShadowRoot a F15 adapter atteso HTMLElement"
  - "Custom handler undefined guard: console.warn + fallbackType:'custom-failed' (defensive — discriminated union ammette handler? optional)"
  - "W7 fix renderHtmlFallback signature: mountElement: HTMLElement | ShadowRoot | undefined widening per supportare caller F13 che passa direttamente shadowRoot via mount.context.shadowContainer"
  - "W9 fix escapeAttr regex /[<>\"'&backtick]/g 6-char coverage attribute-context defense-in-depth contro injection accidentale via mfId path (mfId descriptor validato F8 a registration-time, escape è defense-in-depth)"
  - "W11 defensive guard `typeof op !== 'function'` documentato future-proof contro F8 API surface changes (es. F15+ aggiunge runtime/update ops) — currently unreachable via phase filter, kept come belt-and-suspenders"
  - "SERVICE_FRAMEWORK_ADAPTER string literal locale 'framework-adapter' (NON pre-dichiarato in F8 services.ts per D-83 strict septuple — F15 può rinominare via declaration merging additive)"
  - "Closure capture narrowing fix: const alias `mfService: MicroFrontendsService` post-narrowing per preservare type nel orchestratorChain async closure (TS18048 fix)"
  - "AbortSignal cleanup cascade D-V2-16: ctrl.signal abort handler {once:true} + shutdownSignal opt forwarding (host responsibility) per coerenza F11+F13 pattern"
  - "Plan-test deviation Rule 1 documentata: planner test code aveva `expect(mod.name)...` ma BrokerModule contract @gluezero/core usa `id: string` — adjustato a `expect(mod.id).toBe('fallbacks')` coerente con W1 stub + isolation-module + permissions-module pattern"
metrics:
  duration_minutes: 13
  tasks_total: 3
  tasks_completed: 3
  files_created: 7
  files_modified: 1
  loc_added: 1929
  loc_removed: 44
  test_count: 130
  test_passed: 130
  commits: 3
  commit_hashes:
    - "828c746 — feat(14-04): 4 renderers fallback (html/component/event/custom)"
    - "fc7d75d — feat(14-04): fallback-renderer dispatcher 5-mode + emit unificato"
    - "d54db16 — feat(14-04): fallbacksModule install FINAL + orchestrator chain D-V2-F14-12"
  completed_date: "2026-05-14"
---

# Phase 14 Plan 14-04: W2 P04 Renderers + Dispatcher + fallbacksModule FINAL Summary

**One-liner:** Implementazione 4 renderer fallback (`renderHtmlFallback` target chain + F13 SERVICE_ISOLATION shadow-dom detection W7-fix; `renderComponentFallback` SERVICE_FRAMEWORK_ADAPTER F15 stub W9-fix; `renderEventFallback` broker.publish con source descriptor F1 D-23; `renderCustomFallback` async await + try/catch) + `dispatchFallback` dispatcher discriminated union 5-mode + emit unificato `microfrontend.fallback.rendered` F8 governance riuso D-V2-F14-02 + `fallbacksModule.install` FINAL (W1 stub → full wire reale) con orchestrator chain D-V2-F14-12 (circuit check → retry check skip runtime/update OQ-1 → fallback render dispatch + success path emit `microfrontend.recovered` + reset counter + recordSuccess) — chiude MF-FALLBACK-01 + MF-FALLBACK-05.

## Tasks Completed

### Task 14-04-T01 — 4 Renderers (html/component/event/custom)

**Files created:**
- `packages/fallbacks/src/renderers/html.ts` (105 LoC) — target chain priority (a) `mountElement` → (b) `document.querySelector(selector)` → (c) null + `console.warn` + `fallbackType:'html-skipped'`. F13 SERVICE_ISOLATION lookup duck-typed via `IsolationServiceLike` (zero hard peer dep): `policy.dom === 'shadow-dom'` + `host.shadowRoot !== null` → target widening a `shadowRoot` (preserve CSS scoping). W7 fix: signature `mountElement: HTMLElement | ShadowRoot | undefined` per supportare caller F13 che passa shadowRoot direct via `mount.context.shadowContainer`.
- `packages/fallbacks/src/renderers/component.ts` (114 LoC) — Rule 4 stretto carryover F13 `iframe-stub.ts` Service Locator delega F15. `SERVICE_FRAMEWORK_ADAPTER = 'framework-adapter' as const` string literal locale (NON pre-dichiarato in F8 `services.ts` per D-83 strict septuple — F15 può rinominare via declaration merging additive). Adapter presente: `adapter.renderFallbackComponent(component, target, error)` delega → `fallbackType:'component'`. Adapter assente: `console.warn` + HTML stub `<div data-gz-fallback-stub data-gz-mf="${escapeAttr(mfId)}">component fallback requires F15 adapter</div>` → `fallbackType:'component-stub'`. **Diff F13 → F14**: NON throw (F14 graceful: fallback è degraded recovery, F13 iframe-stub throw `IFRAME_ADAPTER_REQUIRED` perché iframe è apply-chain blocking). W9 fix: `escapeAttr` regex `/[<>"'&backtick]/g` 6-char coverage attribute-context defense-in-depth.
- `packages/fallbacks/src/renderers/event.ts` (66 LoC) — `broker.publish(definition.topic ?? FALLBACK_EVENT_DEFAULT_TOPIC, payload, PUBLISH_OPTS)`. Payload include `{microFrontendId, lifecyclePhase, error, fallbackApplied:true, timestamp}` (`fallbackApplied:true` carryover marker PRD §31.5 per chain detection downstream). PUBLISH_OPTS: source descriptor F1 D-23 `{type:'plugin', id:'fallbacks', name:'@gluezero/fallbacks'}` + `deliveryMode:'sync'`.
- `packages/fallbacks/src/renderers/custom.ts` (50 LoC) — `await handler(error, ctx)` async + try/catch. `result instanceof Promise` check evita `await` su valori sync (micro-perf). Success → `fallbackType:'custom'`. Throw sincrono o rejected Promise → `console.error('[fallbacks] custom handler failed', err)` + `fallbackType:'custom-failed'`.

**Acceptance gate Task 1:** `pnpm --filter @gluezero/fallbacks typecheck` esit 0 (i 4 renderer compilano standalone).

**Commit:** `828c746` — "feat(14-04): 4 renderers fallback (html/component/event/custom) — MF-FALLBACK-05 step 1/3"

---

### Task 14-04-T02 — Dispatcher + Tier-1 suite 4-mode verification

**Files created:**
- `packages/fallbacks/src/fallback-renderer.ts` (202 LoC) — `dispatchFallback` async discriminated union 5-mode (`html`/`component`/`event`/`custom`/`none`) switch su `definition.type`. Component path risolve target HTMLElement non-null pre-renderer (mountElement priority, fallback querySelector, **shadowRoot non valid per F15 adapter — `instanceof HTMLElement` guard**). Custom path guard `typeof handler !== 'function'` → `console.warn` + `fallbackType:'custom-failed'`. Default branch defensive (discriminated union exhaustive).

  **Emit unificato D-V2-F14-02 F8 governance topic riuso**: dopo ogni dispatch, `broker.publish(FALLBACK_RENDERED_TOPIC = 'microfrontend.fallback.rendered', {microFrontendId, lifecyclePhase, fallbackType, timestamp}, PUBLISH_OPTS)`. Chiamato 1 volta per dispatch — anche per `html-skipped` / `custom-failed` / `component-stub` per **observability preserve** (devtools F16 SnapshotProvider future).

- `packages/fallbacks/src/fallback-renderer.test.ts` (595 LoC, **29 it() blocks**) — Tier-1 jsdom suite coverage:
  - **8 test type:'html'**: mountElement priority + querySelector fallback + null target warn + F13 shadow-dom mock + edge case `host.shadowRoot=null` + W7 ShadowRoot direct input + html undefined default `''` + isolation policy `dom!='shadow-dom'` passthrough.
  - **4 test type:'component'**: F15 adapter delega + adapter assente HTML stub + no target component-stub skip + selector lookup.
  - **4 test type:'event'**: custom topic + default `FALLBACK_EVENT_DEFAULT_TOPIC` + source descriptor F1 D-23 + timestamp number.
  - **6 test type:'custom'**: sync void + async resolved + sync throw + rejected Promise + handler undefined + ctx parameter passed.
  - **1 test type:'none'**: no-op + emit observability.
  - **5 test emit unificato**: 1-call-per-dispatch + payload shape `{microFrontendId, lifecyclePhase, fallbackType, timestamp}` + opts source descriptor + custom-failed emit + html-skipped emit.
  - **1 test return Promise<RenderResult> async support**.

**Acceptance gate Task 2:** `pnpm --filter @gluezero/fallbacks test -- --run src/fallback-renderer.test.ts` esit 0 con 29 test PASS.

**Commit:** `fc7d75d` — "feat(14-04): fallback-renderer dispatcher 5-mode + emit unificato — MF-FALLBACK-05 step 2/3"

---

### Task 14-04-T03 — fallbacks-module.ts FINAL install + orchestrator chain D-V2-F14-12 + integration test

**File modified:**
- `packages/fallbacks/src/fallbacks-module.ts` (414 LoC, was 109 LoC W1 stub) — W1 stub no-impl sostituito da FINAL install impl:
  - **D-V2-F14-10-AMENDED JSDoc top-of-file** documenta alternatives (a) re-invoke lifecycle ref (D-83 violation), (b) emit retry.requested topic (D-83 violation septuple), (c) skip retry runtime/update (preferred D-83 compliance). Decisione planner-time RATIFICATA: alternativa (c). `recoverable:true` heuristic preserved per devtools observability F16.
  - **3-opt factory** `{defaultPolicy?, retryDefault?, circuitDefault?}` (D-V2-F14-04, vs F13=2-opt) per scope fallback+retry+circuit indipendenti.
  - **`getDefinitionForPhase` BL1-fix MF-FALLBACK-01 frozen**: switch `'update'` → `policy.onUpdateError` (was incorrectly returning undefined); `'destroy'` → `undefined` (NO per-policy field — 6-scope contract REQUIREMENTS.md riga 140 — orchestrator chain applica default fallback no-policy-field path).
  - **Install flow** Rule 4 stretto F13 `isolation-module.ts` + F11 `permissions-module.ts`:
    1. Lookup `SERVICE_MICROFRONTENDS` → throw esplicativo se assente
    2. Idempotent guard `SERVICE_FALLBACKS` già registered → `console.warn` + early return
    3. `AbortController` + `createRetryEngine()` + `createCircuitBreaker(broker)`
    4. Service API `{getCircuitState, getRetryAttempts}` → `ctx.registerService(SERVICE_FALLBACKS, service)`
    5. `orchestratorChain` async D-V2-F14-12 (vedi sotto)
    6. `installErrorSubscribe(broker, {dispatch: orchestratorChain, signal: ctrl.signal})`
    7. Subscribe `microfrontend.unregistered` per cleanup P-02: `circuitBreaker.dispose(mfId)` + `retryEngine.resetCounter` per tutte le 7 phases. Supporta entrambe le shape payload `{id}` e `{microFrontendId}`.
    8. AbortSignal cleanup cascade D-V2-16: `ctrl.signal` abort → `errorSubHandle.unsubscribeAll()` + `unregisterSub.unsubscribe()`. `shutdownSignal` opt forwarding host responsibility.
  - **`orchestratorChain` async D-V2-F14-12** (logica dispatch reale):
    1. **Circuit check**: `!circuitBreaker.canExecute(mfId)` → skip retry, dispatch fallback diretto (`definition !== undefined`) o emit `microfrontend.fallback.rendered` `fallbackType:'none'` (observability preserve).
    2. **Retry check** (skip runtime/update OQ-1): `recoverable && phase !== 'runtime' && phase !== 'update' && retryEngine.shouldRetry(mfId, phase, retryPolicy)` → `setTimeout(() => mfService[phase](mfId).then(...))`. **Success path**: emit `microfrontend.recovered` `{microFrontendId, lifecyclePhase, attempts, timestamp}` + `retryEngine.resetCounter` + `circuitBreaker.recordSuccess`. Re-fail: subscriber riceve nuovo `MF_ERROR_TOPIC`, ciclo riprende.
    3. **Retry exhausted o skip**: `circuitBreaker.recordFailure(mfId, circuitPolicy)` + dispatch fallback (`definition !== undefined`) o emit `microfrontend.fallback.rendered` `fallbackType:'none'`.
  - **W11 defensive guard** `typeof op !== 'function'` documentato future-proof contro F8 API surface changes (es. F15+ aggiunge runtime/update ops). Currently unreachable via phase filter — kept come belt-and-suspenders.
  - **Closure capture narrowing fix**: const alias `mfService: MicroFrontendsService` post-narrowing per preservare type nel `orchestratorChain` async closure (TS18048 fix).
  - **Anti-singleton D-30**: ogni `fallbacksModule()` call ritorna nuovo `BrokerModule`.

**File created:**
- `packages/fallbacks/src/fallbacks-module.test.ts` (428 LoC, **17 it() blocks**) — Tier-1 jsdom integration suite coverage:
  - **2 test factory shape**: `id: 'fallbacks'` + install function + anti-singleton D-30.
  - **5 test install flow**: SERVICE_MICROFRONTENDS lookup throw + idempotent guard + service register + getRetryAttempts default 0 + getCircuitState default `'closed'`.
  - **2 test full chain integration**: error event → dispatch → publish event topic + emit `microfrontend.fallback.rendered` post dispatch.
  - **2 test cleanup P-02**: `microfrontend.unregistered` con `id` + con `microFrontendId` alternative key entrambi supportati.
  - **1 test W8 retry success path D-V2-F14-12 (Scenario 12)**: retry success → emit `microfrontend.recovered` payload `{microFrontendId:'mf-recover', lifecyclePhase:'load', attempts:1}` + `getRetryAttempts('mf-recover', 'load')===0` (counter reset) + `getCircuitState('mf-recover')==='closed'` (recordSuccess).
  - **2 test skip retry runtime/update OQ-1**: `runtime.failed` + `update.failed` → dispatch fallback diretto (no setTimeout retry).
  - **1 test no fallback policy** → emit `fallbackType:'none'` (observability).
  - **2 test descriptor.fallback override defaultPolicy**: precedence + fallback to `defaultPolicy` quando `descriptor.fallback` assente.

**Acceptance gate Task 3:**
- `pnpm --filter @gluezero/fallbacks test` esit 0 (**130 test PASS** — 84 baseline + 29 fallback-renderer + 17 fallbacks-module).
- `pnpm --filter @gluezero/fallbacks typecheck` esit 0.
- `pnpm --filter @gluezero/fallbacks build` esit 0 (dist/index.js **9.47 KB un-gzipped / 3.46 KB gzipped** — sotto target 6 KB).
- D-83 strict septuple zero-diff verificato: `git diff 8f6b4b7..HEAD -- packages/{core,microfrontends,mapper,context,permissions,compat,isolation}/src/` = **0 lines**.

**Commit:** `d54db16` — "feat(14-04): fallbacksModule install FINAL + orchestrator chain D-V2-F14-12 — MF-FALLBACK-01 + MF-FALLBACK-05 CLOSED"

---

## Test Output Summary

```
 RUN  v4.1.5 /Users/omarmarzio/programming/AI/GlueZero2/.claude/worktrees/agent-ad8d1fbc5fa596043/packages/fallbacks

 Test Files  7 passed (7)
      Tests  130 passed (130)
   Duration  ~0.7s
```

**Test files coverage:**
- `topics.test.ts` (3 test, baseline W1 P01)
- `microfrontend-error.test.ts` (29 test, W2 P02)
- `lifecycle-error-subscribe.test.ts` (29 test, W2 P02)
- `retry-engine.test.ts` (29 test, W2 P03)
- `circuit-breaker.test.ts` (22 test, W2 P03)
- **`fallback-renderer.test.ts` (29 test, W2 P04) — NEW**
- **`fallbacks-module.test.ts` (17 test, W2 P04) — NEW**

**Total: 130 test PASS — W2 P02 + P03 + P04 closure complete.**

## Build Output

```
ESM dist/index.js       9.47 KB (3.46 KB gzipped — target 6 KB)
ESM dist/augment.js     195.00 B
ESM dist/augment.js.map 3.22 KB
ESM dist/index.js.map   98.68 KB
ESM ⚡️ Build success in 51ms
DTS Build start
DTS ⚡️ Build success in 387ms
DTS dist/index.d.ts   33.08 KB
DTS dist/augment.d.ts 2.83 KB
```

Bundle gate preliminare PASS (3.46 KB << 6 KB target — W3 P05 closure validerà definitively via size-limit + ci:gate:f14).

## D-83 Strict Septuple Verification

```
$ git diff 8f6b4b7..HEAD -- packages/core/src/ packages/microfrontends/src/ packages/mapper/src/ \
    packages/context/src/ packages/permissions/src/ packages/compat/src/ packages/isolation/src/
(empty output)
$ git diff 8f6b4b7..HEAD -- ... | wc -l
0
```

Zero diff sui 7 protected packages src/ — D-83 strict septuple esteso v2.0 enforcement verificato.

## REQ-ID Coverage Closure

### MF-FALLBACK-01 CLOSED ✅

**`MicroFrontendFallbackPolicy` 6-onXError scope wire reale:**
- `getDefinitionForPhase(policy, phase)` mapping 7-phase → 6-onXError + `destroy` undefined (REQUIREMENTS.md riga 140 frozen).
- `descriptor.fallback` override via `getFallback(reg.descriptor)` Pattern S1 stretto F11/F13.
- `options.defaultPolicy` carryover host-level fallback per tutti i MF.
- Precedence: `descriptorPolicy ?? options.defaultPolicy` (descriptor wins).

### MF-FALLBACK-05 CLOSED ✅

**4 rendering modes implementati:**
- `html`: target chain (a) mountElement → (b) querySelector → (c) null+warn + F13 SERVICE_ISOLATION shadow-dom detection.
- `component`: SERVICE_FRAMEWORK_ADAPTER F15 lookup → delega o HTML stub generic graceful.
- `event`: `broker.publish(topic, payload, opts)` con source descriptor F1 D-23 + `fallbackApplied:true` marker.
- `custom`: async `await handler(error, ctx)` + try/catch + `console.error` fallback.

**Emit unificato F8 governance riuso D-V2-F14-02:**
- Topic `microfrontend.fallback.rendered` chiamato 1 volta per dispatch (anche per skipped/failed — observability preserve).
- Payload `{microFrontendId, lifecyclePhase, fallbackType, timestamp}`.
- Opts source descriptor F1 D-23 + `deliveryMode:'sync'`.

## Wave 2 Status

**W2 complete: 5/5 REQ-IDs chiusi** (MF-FALLBACK-01..05):
- 14-02 W2 P02: MF-FALLBACK-04 (MicroFrontendError + installErrorSubscribe seam)
- 14-03 W2 P03: MF-FALLBACK-02 (RetryPolicy) + MF-FALLBACK-03 (CircuitBreakerPolicy)
- **14-04 W2 P04: MF-FALLBACK-01 (Policy wire) + MF-FALLBACK-05 (4 renderers + dispatcher) ← QUESTO**

**W3 P05 può procedere per closure:**
- Tier-3 Playwright Chromium 6 scenari D-V2-F14-14 pattern (F13 carryover).
- README italiano completo + JSDoc enrichment 100+ LoC.
- Bundle gate finale via `size-limit` (6 KB target verified).
- D-83 strict septuple verifier reale `ci:gate:f14`.
- ROADMAP refuso fix.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] BrokerModule contract `id` vs plan example `name`**
- **Found during:** Task 3 test scaffolding.
- **Issue:** Plan acceptance criteria + planner test code mostrava `expect(mod.name).toBe('@gluezero/fallbacks')`, ma il `BrokerModule` interface in `@gluezero/core/src/types/module.ts:49-74` definisce `id: string` (NOT `name`). W1 stub usava già correttamente `id: 'fallbacks'`, coerente con `isolation-module.ts:136` + `permissions-module.ts:129` pattern.
- **Fix:** Test scritto con `expect(mod.id).toBe('fallbacks')`. Documentato in JSDoc test file header.
- **Files modified:** `packages/fallbacks/src/fallbacks-module.test.ts`.
- **Commit:** `d54db16`.

**2. [Rule 1 - Bug] Closure capture narrowing TS18048**
- **Found during:** Task 3 typecheck post-fallbacks-module.ts write.
- **Issue:** `mfService` narrowed via `if (mfService === undefined) throw` ma TS non preserva narrowing nel closure async `orchestratorChain`. Error: `'mfService' is possibly 'undefined'`.
- **Fix:** Const alias `const mfService: MicroFrontendsService = maybeMfService` post-narrowing.
- **Files modified:** `packages/fallbacks/src/fallbacks-module.ts:175-178`.
- **Commit:** `d54db16` (incluso nello stesso commit Task 3).

### Authentication Gates

None.

### Threat Flags

Nessuna superficie security-relevant nuova oltre quanto già coperto in `<threat_model>` PLAN 14-04:
- T-14-04-01 (Tampering custom handler throw): mitigated via try/catch + console.error.
- T-14-04-02 (Spoofing innerHTML XSS): accepted (P-13 governance disclaimer host-controlled config).
- T-14-04-03 (Information Disclosure error.stack): accepted (downstream sanitization responsibility).
- T-14-04-04 (DoS retry storm): mitigated via default attempts:1 + jitter ±20% + circuit→retry order + skip runtime/update.
- T-14-04-05 (DoS double subscribe): mitigated via idempotent guard install check SERVICE_FALLBACKS.
- T-14-04-06 (DoS memory leak unregister): mitigated via subscribe microfrontend.unregistered + dispose + reset counters.
- T-14-04-07 (Elevation D-83 violation): mitigated via composition esterna pura — zero diff packages/microfrontends/src/.

## Self-Check: PASSED

**Files created:**
- ✅ `packages/fallbacks/src/renderers/html.ts` — FOUND
- ✅ `packages/fallbacks/src/renderers/component.ts` — FOUND
- ✅ `packages/fallbacks/src/renderers/event.ts` — FOUND
- ✅ `packages/fallbacks/src/renderers/custom.ts` — FOUND
- ✅ `packages/fallbacks/src/fallback-renderer.ts` — FOUND
- ✅ `packages/fallbacks/src/fallback-renderer.test.ts` — FOUND
- ✅ `packages/fallbacks/src/fallbacks-module.test.ts` — FOUND

**Files modified:**
- ✅ `packages/fallbacks/src/fallbacks-module.ts` — FOUND (W1 stub → FULL install)

**Commits:**
- ✅ `828c746` — FOUND
- ✅ `fc7d75d` — FOUND
- ✅ `d54db16` — FOUND

**Verification commands:**
- ✅ `pnpm --filter @gluezero/fallbacks test` — exit 0, 130 PASS
- ✅ `pnpm --filter @gluezero/fallbacks typecheck` — exit 0
- ✅ `pnpm --filter @gluezero/fallbacks build` — exit 0, 9.47 KB / 3.46 KB gzipped
- ✅ D-83 strict septuple: `git diff 8f6b4b7..HEAD -- 7-protected` = 0 lines
