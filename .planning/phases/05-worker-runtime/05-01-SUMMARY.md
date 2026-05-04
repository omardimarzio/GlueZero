---
phase: 05-worker-runtime
plan: 01
subsystem: worker-bootstrap
tags: [scaffold, declaration-merging, types, build, test-setup, F5]
provides:
  - "@sembridge/worker package compilable + buildable"
  - "BrokerConfig.workers TS type via decl merging (D-122)"
  - "PluginDescriptor.workers TS type via decl merging (D-126)"
  - "WorkerDescriptor / RouteWorkerDefinition / WorkerConfig / ProgressPayload / TaskState / WorkerTaskOutcome public types"
  - "INTERNAL_TOPICS_WORKER frozen const + isInternalWorkerTopic STRICT match"
  - "F5PipelineStep literal union (4 step §28)"
  - "__augmentWorkerLoaded marker (Pattern S1 anti tree-shake)"
requires:
  - "@sembridge/core BrokerConfig + PluginDescriptor F1"
  - "@sembridge/routing RoutePolicies F3 (Pick subset D-143)"
  - "@sembridge/gateway BackpressurePolicyConfig F3 (carryover D-130)"
affects:
  - "ROADMAP F5 progress: Wave 1 ✓"
  - "REQ progress: WK-01..WK-07 type-level scaffold + PKG-01..PKG-04 done"
tech-stack:
  added:
    - "comlink 4.4.2 (runtime dep, lockata D-125 + RESEARCH §2.1 + verified npm 2026-05-04)"
  patterns:
    - "TS declaration merging additive (declare module '@sembridge/core')"
    - "Pattern S1 anti tree-shake (sideEffects glob + __augmentLoaded re-export)"
    - "Pattern S5 STRICT match internal topics (anti AP-6 carryover F4 D-111)"
    - "Pick<RoutePolicies, ...> subset enforce TS-level (D-143)"
key-files:
  created:
    - "packages/worker/tsconfig.json (11 LOC)"
    - "packages/worker/tsup.config.ts (35 LOC)"
    - "packages/worker/vitest.config.ts (60 LOC)"
    - "packages/worker/vitest.browser.config.ts (34 LOC)"
    - "packages/worker/src/augment.ts (124 LOC)"
    - "packages/worker/src/augment.test.ts (162 LOC)"
    - "packages/worker/src/index.ts (73 LOC)"
    - "packages/worker/src/types/index.ts (21 LOC)"
    - "packages/worker/src/types/internal-topics.ts (55 LOC)"
    - "packages/worker/src/types/progress-payload.ts (54 LOC)"
    - "packages/worker/src/types/route-worker-definition.ts (149 LOC)"
    - "packages/worker/src/types/task-state.ts (94 LOC)"
    - "packages/worker/src/types/worker-config.ts (66 LOC)"
    - "packages/worker/src/types/worker-descriptor.ts (106 LOC)"
  modified:
    - "packages/worker/package.json (placeholder F1 → manifest pieno F5: name, deps, scripts, sideEffects)"
    - "pnpm-lock.yaml (comlink 4.4.2 + workspace deps + devDeps W1)"
decisions:
  - "D-121 — Composition wrapper WorkerBroker(RouterBroker) D-83 strict: Wave 1 expone solo type-level + augment additive, zero runtime modifiche F1-F4."
  - "D-122 — BrokerConfig.workers via TS decl merging additive (sezione opzionale strutturata letta da WorkerBroker plan 05-06)."
  - "D-123 — WorkerDescriptor.factory: () => Worker lazy invocata al primo dispatch (D-129) con pattern bundler-friendly new URL(..., import.meta.url)."
  - "D-124 — WorkerDescriptor.tasks readonly string[] dichiarate esplicite per fail-fast worker.task.unknown al register."
  - "D-126 — PluginDescriptor.workers via TS decl merging cascade ext F5 (LIFE-02 ext F5 plan 05-06)."
  - "D-127 — WorkerMode 'dedicated' | 'pool' default 'pool' con size = min(navigator.hardwareConcurrency, 4)."
  - "D-128 — Cap hard pool size 8 con allowUnboundedPool opt-in + console.warn dev mode."
  - "D-130 — F3 BackpressurePolicyConfig riusato 1:1 (subset Pick D-143)."
  - "D-131 — cancelGraceMs default 2000ms cooperative cancellation pool (dedicated → terminate immediato)."
  - "D-133 — TaskState union 'pending'|'done'|'timeout'|'cancelled'|'error' atomic state machine Pitfall 2C."
  - "D-136 — ProgressPayload canonical schema { value, message?, partialResult? } registrato in CanonicalRegistry F2."
  - "D-137 — INTERNAL_TOPICS_WORKER.PROGRESS '__progress__' STRICT match + default progressThrottleMs 100ms latest-only."
  - "D-141 — RouteWorkerDefinition.transferable JSONPath-like array readonly + wildcard [*] supportato."
  - "D-143 — RoutePolicies subset Pick<'timeout'|'concurrency'|'backpressure'|'dedupe'> enforced TS-level (NO retry/auth/circuitBreaker)."
  - "D-144 — RouteWorkerDefinition.policies.concurrency default 'latest-only' (semantica deferred plan 05-06)."
  - "D-145 — RouteWorkerDefinition.policies.timeout default 30000ms (override-abile via WorkerConfig.defaultTimeoutMs)."
  - "D-146 — RouteWorkerPublishesSpec hybrid auto-derive + override (regola suffix .requested → .completed|.failed|.progress)."
  - "D-147 — WorkerType 'module' | 'classic' default 'module' opt-in extension PRD §31.3."
  - "D-150 — Test 3-tier strategy (Tier-1 jsdom + Tier-3 Playwright Chromium configurati Wave 1 ready)."
  - "D-152 — F5PipelineStep literal union 4 valori (event.worker.dispatched|progress|completed|failed) — workaround R4 RESEARCH §17 RouteDefinition non merge-abile."
  - "D-153 — WorkerTaskOutcome shape per OutcomeCollector F3-style (publishing topic post-state-transition)."
metrics:
  duration_minutes: 8
  files_created: 14
  files_modified: 2
  loc_total: 1108
  test_count: 8
  test_passing: 8
  task_count: 3
  commit_count: 4
  completed_date: 2026-05-04
---

# Phase 5 Plan 01: Bootstrap @sembridge/worker — SUMMARY

Bootstrap del pacchetto `@sembridge/worker` come scaffold completo type-level: package.json + build/test config (tsup ESM-only + Vitest 3-tier ready) + tsconfig strict + augment.ts con declaration merging additive (BrokerConfig.workers + PluginDescriptor.workers + F5PipelineStep) + 6 type files (WorkerDescriptor / WorkerConfig / RouteWorkerDefinition / ProgressPayload / TaskState / INTERNAL_TOPICS_WORKER) + barrel pubblico. Wave 1 sequential gate per W2 (assert-serializable + transferable-extractor + task-tracker) e W3 (worker-bridge + worker-pool/registry). 8/8 smoke decl merging passing. D-83 strict ✓ verified zero modifiche runtime a `packages/{core,mapper,routing}/src/` e `packages/gateway/src/{http,sse-ws}/`.

## Output Summary

### File creati (14)

| File | LOC | Ruolo |
|------|-----|-------|
| `packages/worker/tsconfig.json` | 11 | Typecheck strict + isolatedDeclarations + lib WebWorker |
| `packages/worker/tsup.config.ts` | 35 | Build ESM-only 2 entry (index + augment), target es2022 |
| `packages/worker/vitest.config.ts` | 60 | Tier-1 jsdom + coverage v8 90/80/90/90 + exclude __browser__ |
| `packages/worker/vitest.browser.config.ts` | 34 | Tier-3 Playwright Chromium include __browser__ |
| `packages/worker/src/augment.ts` | 124 | Declaration merging F5 (D-122 + D-126) + F5PipelineStep + __augmentWorkerLoaded |
| `packages/worker/src/augment.test.ts` | 162 | 8 smoke test decl merging + Pattern S1 + S5 |
| `packages/worker/src/index.ts` | 73 | Barrel pubblico re-export augment + types |
| `packages/worker/src/types/index.ts` | 21 | Barrel types-only |
| `packages/worker/src/types/internal-topics.ts` | 55 | INTERNAL_TOPICS_WORKER frozen + STRICT helper |
| `packages/worker/src/types/progress-payload.ts` | 54 | ProgressPayload canonical schema D-136 |
| `packages/worker/src/types/route-worker-definition.ts` | 149 | RouteWorkerDefinition + RouteWorkerPublishesSpec D-143/D-146 |
| `packages/worker/src/types/task-state.ts` | 94 | TaskState union + WorkerTaskOutcome shape D-133/D-152 |
| `packages/worker/src/types/worker-config.ts` | 66 | WorkerConfig D-122 + AssertSerializableMode D-139 |
| `packages/worker/src/types/worker-descriptor.ts` | 106 | WorkerDescriptor D-123/124/127/128/131/147 |
| **Totale** | **1108** | (incl. 162 LOC test) |

### File modificati (2)

| File | Cambiamento |
|------|-------------|
| `packages/worker/package.json` | Placeholder F1 → manifest pieno F5 (name @sembridge/worker, deps comlink/@sembridge/{core,mapper,routing,gateway}/nanoid/valibot, sideEffects glob, scripts build/test/typecheck/test:browser/test:coverage/clean) |
| `pnpm-lock.yaml` | Aggiornato con comlink 4.4.2 + workspace deps + devDeps W1 |

## Test Results

```
RUN  v4.1.5 /Users/omarmarzio/programming/prova AI/SemBridge/packages/worker
Test Files  1 passed (1)
     Tests  8 passed (8)
  Start at  22:34:44
  Duration  462ms (transform 20ms, setup 0ms, import 29ms, tests 3ms, environment 363ms)
```

**8/8 smoke decl merging passing** (`packages/worker/src/augment.test.ts`):

| # | Test | Verifies |
|---|------|----------|
| 1 | `__augmentWorkerLoaded const true` | Pattern S1 anti tree-shake (T-05-01-02 mitigation) |
| 2 | `BrokerConfig.workers accepts WorkerConfig` | D-122 decl merging additive |
| 3 | `PluginDescriptor.workers accepts WorkerDescriptor[]` | D-126 cascade ext F5 |
| 4 | `F5PipelineStep 4 literal exact` | D-152 step 9 dispatch §28 |
| 5 | `Coexistence F2/F3/F4/F5` | Cumulative decl merging (T-05-01-04) |
| 6 | `INTERNAL_TOPICS_WORKER frozen + STRICT match` | Pattern S5 anti AP-6 (T-05-01-06) |
| 7 | `PluginDescriptor coesiste realtimeChannels + workers` | F4+F5 decl merging compatibili |
| 8 | `ProgressPayload + TaskState + RouteWorkerDefinition + WorkerTaskOutcome importable` | D-136/D-133/D-143/D-152 |

## CI Gates Verified

| Gate | Result |
|------|--------|
| `pnpm install` | OK (workspace coerente + comlink 4.4.2 + 8 packages + 1 cyclic warn pre-esistente routing↔gateway) |
| `pnpm -F @sembridge/worker typecheck` | exit 0 |
| `pnpm -F @sembridge/worker test --run` | 8/8 passing |
| `pnpm -F @sembridge/worker build` | OK — `dist/{index,augment}.{js,d.ts}` prodotti |
| `pnpm -F @sembridge/core typecheck` | exit 0 (zero regressione D-83) |
| `pnpm -F @sembridge/mapper typecheck` | exit 0 (zero regressione D-83) |
| `pnpm -F @sembridge/routing typecheck` | exit 0 (zero regressione D-83) |
| `pnpm -F @sembridge/gateway typecheck` | exit 0 (zero regressione D-83) |
| Full monorepo test | 248+183+103+222+8 = **764 passing** (+3 skip MSW V1.x F4) |

## Build Artifacts

```
dist/index.js              539 B
dist/index.js.map        9314 B
dist/index.d.ts          10658 B
dist/augment.js            230 B
dist/augment.js.map      6638 B
dist/augment.d.ts            89 B
dist/augment-CVg3ezec.d.ts  8642 B  (TypeScript hashed shared dts module — internal)
```

Tree-shake test:
- `dist/index.js` ~539 B (sopra il glob `**/augment.{ts,js}` viene preservato anche se barrel side-effect import).
- `__augmentWorkerLoaded` preserved nel bundle (verifica grep gate ↓).

## Pattern S1 Audit (anti tree-shake)

```bash
$ grep -c "__augmentWorkerLoaded" packages/worker/dist/index.js
2
$ grep -c "F5PipelineStep" packages/worker/dist/index.d.ts
1
$ grep -c "INTERNAL_TOPICS_WORKER" packages/worker/dist/index.d.ts
5
```

T-05-01-02 (DoS — tree-shaker elimina augment) **mitigated** ✓.

## D-83 Strict Verification

```bash
$ git diff main...HEAD -- packages/core/src/ packages/mapper/src/ \
                          packages/routing/src/ packages/gateway/src/http/ \
                          packages/gateway/src/sse-ws/
(empty output)
```

**D-83 strict gate ✓ verified** — zero modifiche runtime a F1-F4. F5 vive interamente in `packages/worker/`. L'unica eccezione documentata e attesa è `packages/worker/src/augment.ts` (declaration merging additive type-level, NON modifica runtime di alcun pacchetto).

## REQ Progress

| REQ-ID | Stato | Note |
|--------|-------|------|
| WK-01 | type-level scaffold | WorkerRegistry creazione/riuso pool — type `WorkerDescriptor` con `id`/`factory`/`tasks`/`mode`/`size` |
| WK-02 | type-level scaffold | tipo route worker — `RouteWorkerDefinition` discriminator `type='worker'` + `Pick<RoutePolicies,...>` D-143 |
| WK-03 | type-level scaffold | Task correlation — `correlationId` in `WorkerTaskOutcome` (D-134 propagato end-to-end) |
| WK-04 | type-level scaffold | Cancellation `cancelGraceMs` field (D-131) — runtime in W3 plan 05-04 |
| WK-05 | type-level scaffold | Progress `ProgressPayload` schema (D-136) — runtime in W4 plan 05-06 |
| WK-06 | type-level scaffold | Timeout `policies.timeout` Pick subset (D-145) — runtime in W3-W4 |
| WK-07 | type-level scaffold | Serialization `assertSerializable` mode + `transferable` JSONPath (D-139, D-141, D-142) — runtime W2 plan 05-02 + DOC W5 plan 05-07 chiude PRD §39 #11 |
| PKG-01 | done | ESM-only build via tsup format `['esm']` |
| PKG-02 | done | dts integrato via tsup `dts: true` |
| PKG-03 | done | Target evergreen ES2022 |
| PKG-04 | done | Monorepo pnpm `workspace:*` deps |

## Decisioni Applicate (referenziate nel codice)

D-121, D-122, D-123, D-124, D-126, D-127, D-128, D-130, D-131, D-133, D-134, D-136, D-137, D-141, D-143, D-144, D-145, D-146, D-147, D-150, D-152, D-153 — tutte referenziate via JSDoc comment in source code per audit-ability post-implementation.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| `7d64592` | chore(05-01) | Bootstrap pkg config + build/test setup |
| `2ec5fcf` | feat(05-01) | 7 type files F5 in src/types/ |
| `0d18c36` | test(05-01) | RED phase: failing test smoke decl merging |
| `77f19e1` | feat(05-01) | GREEN phase: augment.ts decl merging + barrel index.ts |

TDD gate sequence verified: chore (config bootstrap) → feat (type scaffold) → test (RED) → feat (GREEN). Gate compliance: 8/8 test passing post-GREEN, zero regression cross-package.

## Deviazioni dal Plan

**Auto-fixed (Rule 1/2/3): NESSUNA** — il plan era completo e dettagliato (analog F4 verbatim copy). Esecuzione lineare 3 task in 4 commit atomic.

**Decisioni minori in autonomia:**
- Aggiunto `lib: ["..., "WebWorker"]` in `tsconfig.json` (rispetto al `gateway/tsconfig.json` analog che ha solo DOM). **Razionale:** F5 manipola `Worker` constructor + `WorkerGlobalScope` — `lib WebWorker` è prerequisito per il typecheck di W2-W4. Decisione tecnica autonoma documentata.
- Ho omesso `packages/worker/biome.json` (era opzionale nel plan "se non c'è inheritance root"). Il workspace root `biome.json` è già presente e copre `**/*.ts` — biome inheritance funziona via root config senza file per-package (analog gateway/mapper/routing/core non hanno biome.json per-package).
- `pnpm-workspace.yaml` non è stato modificato — usa già il glob `'packages/*'` che include automaticamente `packages/worker`.
- Aggiunto `external: ['comlink']` in `tsup.config.ts` (oltre ai workspace deps) per evitare bundling della dep runtime. Decisione coerente con pattern gateway analog.
- `index.ts` ha placeholder commented per Wave 2-4 runtime exports (assertSerializable, taskTracker, WorkerBridge, WorkerPool, WorkerRegistry, WorkerHandler, WorkerBroker, createWorkerBroker) — pattern documentato in plan stesso.

## Building Blocks per Wave 2

Wave 1 completa rilascia il seguente contratto stabile per Wave 2 parallel (05-02 ‖ 05-03):

**Per plan 05-02 (assert-serializable + transferable-extractor):**
- `import type { ProgressPayload } from '@sembridge/worker'` (D-136 schema)
- `import type { RouteWorkerDefinition } from '@sembridge/worker'` (per `transferable: readonly string[]` JSONPath D-141)
- `import { INTERNAL_TOPICS_WORKER, isInternalWorkerTopic } from '@sembridge/worker'` (filter STRICT match D-131/D-137)

**Per plan 05-03 (task-tracker state machine atomico):**
- `import type { TaskState, WorkerTaskOutcome } from '@sembridge/worker'` (D-133 union + D-152 outcome shape)
- `import type { F5PipelineStep } from '@sembridge/worker'` (per emitTapStep D-152)

**Per plan 05-04 (worker-bridge):**
- `import type { WorkerDescriptor, WorkerType } from '@sembridge/worker'` (D-147 module/classic + D-148 URL pattern)
- `import { isInternalWorkerTopic } from '@sembridge/worker'` (filter cancel/progress messages)

**Per plan 05-05 (worker-pool):**
- `import type { WorkerDescriptor, WorkerMode } from '@sembridge/worker'` (D-127 mode + D-128 cap 8 + D-131 cancelGraceMs)

Tutti gli import type-only sono già esportati dal barrel `@sembridge/worker` via `src/index.ts`. Build artifacts `dist/` pronti per consumer test.

## Threat Coverage

| Threat ID | Disposition | Mitigation in W1 |
|-----------|-------------|------------------|
| T-05-01-01 | mitigate | `__augmentWorkerLoaded: true` const literal non runtime-mutabile + `Object.freeze(INTERNAL_TOPICS_WORKER)` |
| T-05-01-02 | mitigate | `package.json#sideEffects` glob `**/augment.{ts,js}` + barrel re-export — grep `__augmentWorkerLoaded` dist/index.js → 2 hits |
| T-05-01-03 | mitigate | `Pick<RoutePolicies, 'timeout' \| 'concurrency' \| 'backpressure' \| 'dedupe'>` enforced TS-level in `route-worker-definition.ts` — no exposure di RetryConfig/AuthConfig/CircuitBreakerConfig types (D-143) |
| T-05-01-04 | mitigate | grep gate `INTERNAL_TOPICS_WORKER` token uniquely identifica source, non commenti header |
| T-05-01-05 | accept | Source descriptor frozen const arriverà in 05-06 worker-handler — Wave 1 expone solo type-level |
| T-05-01-06 | mitigate | `Object.freeze(... as const)` blocca runtime mutation; STRICT match `topic === '__cancel__'` no `startsWith('__')` blocca prefix-spoofing (Pattern S5) |
| T-05-01-07 | accept | TS compiler protegge nativamente; tsc --noEmit completa < 1s (worker package empty src risolto < 100ms) |

## Self-Check: PASSED

**Files verified exist:**
```bash
$ for f in packages/worker/{package.json,tsconfig.json,tsup.config.ts,vitest.config.ts,vitest.browser.config.ts}; do
    [ -f "$f" ] && echo "FOUND: $f" || echo "MISSING: $f"
  done
FOUND: packages/worker/package.json
FOUND: packages/worker/tsconfig.json
FOUND: packages/worker/tsup.config.ts
FOUND: packages/worker/vitest.config.ts
FOUND: packages/worker/vitest.browser.config.ts
$ for f in packages/worker/src/{augment.ts,augment.test.ts,index.ts}; do
    [ -f "$f" ] && echo "FOUND: $f" || echo "MISSING: $f"
  done
FOUND: packages/worker/src/augment.ts
FOUND: packages/worker/src/augment.test.ts
FOUND: packages/worker/src/index.ts
$ for f in packages/worker/src/types/*.ts; do echo "FOUND: $f"; done
FOUND: packages/worker/src/types/index.ts
FOUND: packages/worker/src/types/internal-topics.ts
FOUND: packages/worker/src/types/progress-payload.ts
FOUND: packages/worker/src/types/route-worker-definition.ts
FOUND: packages/worker/src/types/task-state.ts
FOUND: packages/worker/src/types/worker-config.ts
FOUND: packages/worker/src/types/worker-descriptor.ts
```

**Commits verified exist:**
```bash
$ for h in 7d64592 2ec5fcf 0d18c36 77f19e1; do
    git log --oneline --all | grep -q "$h" && echo "FOUND: $h" || echo "MISSING: $h"
  done
FOUND: 7d64592
FOUND: 2ec5fcf
FOUND: 0d18c36
FOUND: 77f19e1
```

**Build artifacts verified:**
```bash
$ ls packages/worker/dist/
augment-CVg3ezec.d.ts  augment.d.ts  augment.js  augment.js.map
index.d.ts             index.js      index.js.map
```

**Plan 05-01 ready for closure.** Wave 2 può procedere parallelo (05-02 ‖ 05-03) con file ownership disgiunta:
- 05-02 → `packages/worker/src/{assert-serializable,transferable-extractor}.{ts,test.ts}`
- 05-03 → `packages/worker/src/{task-tracker}.{ts,test.ts}`

Nessun conflitto git index atteso.
