---
phase: 01-core-essenziale
plan: 08
subsystem: broker-public-api
tags:
  - plugin-registry
  - broker-class
  - public-api
  - cascade-cleanup
  - tdd
  - life-02-closure
dependency-graph:
  requires:
    - event-bus-class
    - topic-registry
    - lifecycle-state-machine
    - event-factory
    - console-logger
    - silent-logger
    - noop-event-tap
    - broker-error-factory
    - is-broker-error-type-guard
    - plugin-descriptor-type
    - plugin-context-type
    - plugin-registration-type
    - broker-config-type
    - subscription-type
    - subscribe-options-type
    - broker-event-type
    - valibot
  provides:
    - plugin-registry-class
    - create-plugin-scoped-broker-helper
    - plugin-scoped-broker-interface
    - broker-class
    - broker-debug-snapshot-interface
    - create-broker-factory
    - public-api-surface
  affects:
    - phase-1-plan-09-pipeline-harness
    - phase-1-plan-10-robustness-tests
    - phase-2-canonical-mapper-package
    - phase-3-routing-package
tech-stack:
  added: []
  patterns:
    - tdd-red-green-per-plan
    - composition-root-class
    - proxy-based-scoped-broker-wrapper
    - cascade-cleanup-deterministic
    - try-catch-cascade-must-always-run
    - valibot-safe-parse-config-validation
    - imperative-api-factory-no-singleton
    - structural-interface-isolated-declarations
    - import-meta-env-dev-fallback-try-catch
key-files:
  created:
    - packages/core/src/core/plugin-registry.ts
    - packages/core/src/core/plugin-registry.test.ts
    - packages/core/src/core/broker.ts
    - packages/core/src/public-factory.ts
    - packages/core/src/public-factory.test.ts
  modified:
    - packages/core/src/index.ts
decisions:
  - "PluginContext.broker placeholder `unknown` di plan 03 risolto via approccio strutturale (interface PluginScopedBroker) invece di TypeScript declaration merging. Razionale: declaration merging su `types/plugin.ts` richiederebbe import circolare types/plugin.ts → core/broker.ts → core/plugin-registry.ts → types/plugin.ts. Il wrapper Proxy `createPluginScopedBroker` espone strutturalmente una `subscribe()` ridefinita + delegate degli altri metodi via `[key: string]: unknown` index signature; il consumer cast `ctx.broker as { subscribe: ... }` è coerente con il pattern strutturale TypeScript. Plan future possono comunque applicare declaration merging non-breaking se necessario."
  - "createBroker validation throw `Error` nativo (non BrokerError) con prefisso 'Invalid BrokerConfig:'. Razionale: errore di development-time per il consumer del config, non runtime broker-internal. `Error` nativo è più semplice da match-pattern nei test (`/Invalid BrokerConfig/`) e non richiede `code`/`category` enumerati (1 sola classe di errore documentata). Documentato in modulo header public-factory.ts."
  - "createPluginScopedBroker `rootBroker: object` parametro tipizzato come `object` invece di tipare `Broker` per evitare ciclo import core/plugin-registry.ts → core/broker.ts → core/plugin-registry.ts. Il tipo strutturale `PluginScopedBroker` (interface esportata) descrive la surface ritornata. Effetto: testabilità migliorata (test costruisce un `rootBroker = { subscribe: ... }` minimal stub) e zero coupling tra plugin-registry e broker.ts a livello di import."
  - "Test `'subscribe via scoped broker with no signal still tags ownerId'` aggiunto come Rule 2 (auto-add critical). Lo snippet del PLAN testava solo il path con onMount + multiple subscribe(). Il test isolato verifica esplicitamente che senza AbortSignal hookup la sub è comunque rimossa da unsubscribeByOwner — gate diretto contro regressioni del Proxy interceptor su `subscribe`."
  - "Test `'non-function properties on root are returned as-is'` aggiunto come Rule 2. Il PLAN behaviour cita il delegation, ma l'unico test verificava metodi (function values). Aggiunto test su property non-function (`version: '1.2.3'`) per verificare che il Proxy `get()` ritorna il valore raw quando `typeof value !== 'function'` — gate contro regressioni in cui `Reflect.get` venisse erroneamente sostituito da `value.bind(target)` su tutto."
  - "Test `'cascade procedes even if onDestroy throws'` aggiunto come Rule 2. Il PLAN behaviour elenca `onDestroy che throw → cascade già completata, solo log` ma il test originale `'cascade procedes even if onUnmount throws'` era l'unico per il pattern try/catch swallow. Aggiunto test gemello per onDestroy che verifica `errorLog.toHaveBeenCalledWith('Plugin onDestroy threw', ...)` + plugin removed dal registry post-unregister."
  - "Test `'list returns empty array when no plugins registered'` + `'removes id from list after unregister'` aggiunti come Rule 2 — il PLAN testava solo `list()` con plugin registrati, non gli edge case empty/post-removal."
  - "Test `'accepts runtime config with all F1 fields'` aggiunto come Rule 2 — il PLAN testava `runtime: { logLevel: 'debug' }` ma non esplicitava la validation di `runtime.debug`, `runtime.deepFreezeInDev`, `debug.enabled`, `debug.snapshotPayloadsFull`. Verifica esplicita che il Valibot schema accetta tutti i 5 campi F1 senza throw."
  - "Test `'Broker.registerPlugin + unregisterPlugin lifecycle'` aggiunto al public-factory.test.ts come integration smoke (Rule 2). Sebbene il PLAN behaviour ne preveda l'esistenza implicita (lifecycle hooks chiamati in ordine D-25), nessun test del PLAN snippet collega la lifecycle order alla classe Broker via createBroker. Verifica che order=['register', 'mount'] dopo registerPlugin e order=['register', 'mount', 'unmount', 'destroy'] dopo unregisterPlugin."
  - "Test `'Plugin scoped subscribe → cascade unsubscribe on unregisterPlugin (LIFE-02)'` aggiunto al public-factory.test.ts come gate end-to-end LIFE-02 via API pubblica (Rule 2). I test in plugin-registry.test.ts verificano la cascade isolando il PluginRegistry; questo test verifica che la stessa cascade funzioni quando il consumer usa `createBroker()` + `broker.registerPlugin()` + `broker.unregisterPlugin()` — chiusura PRD §39 #7 verificata via public surface."
  - "Test `'enableDebug/disableDebug toggle does not throw'` non verifica side-effect (deep-freeze attivo dopo enable). Razionale: il side-effect è già coperto da `bus.test.ts` 'setDebugMode toggles debug mode at runtime' (plan 07). Qui basta verificare che la composition method del Broker delega correttamente al bus.setDebugMode senza throw — gate di leggera fragilità accettato per evitare duplicazione test."
  - "import.meta.env.DEV access wrapped in try/catch (broker.ts costruttore). Razionale: in test runner Node senza Vite/tsup injection, `import.meta.env` può essere undefined (non un errore Node-side, ma in alcune toolchain TypeScript strict potrebbe). Il try/catch garantisce che il fallback `isDev = false` funzioni in tutti i runtime. Side-effect testabile: tutti i test public-factory.test.ts creano broker senza esplicitare `runtime.debug`, e `getDebugSnapshot().pendingAsyncDelivery === 0` conferma che il debug mode default è false in test environment."
  - "Biome auto-fix Rule 1 applicato 2 volte: (a) Organize Imports su plugin-registry.ts + plugin-registry.test.ts dopo Task 1, (b) Organize Imports + format multi-line su broker.ts + index.ts + public-factory.test.ts dopo Task 2. Pattern già esercitato da plan 07. Zero biome warning post-fix."
metrics:
  duration: "~14m wall-clock"
  completed: "2026-04-28T23:16:00+02:00"
  tasks_completed: 2
  files_created: 5
  files_modified: 1
  commits: 4
  tests_added: 32
  tests_passing: 191
  lines_of_code: 1040
---

# Phase 1 Plan 08: Broker Class + Public API Summary

Implementati i 4 moduli di chiusura del package `@gluezero/core` Phase 1: `PluginRegistry` (`plugin-registry.ts` 224 LOC) con auto-mount D-25 + cascade cleanup D-26 (chiusura PRD §39 #7 — LIFE-02), helper `createPluginScopedBroker` Proxy-based per enforcement D-26 punto 1 (subscription dentro hooks plugin auto-tagged con `ownerId`), `Broker` class (`broker.ts` 166 LOC) come composition root EventBus + PluginRegistry + TopicRegistry + logger + tap, `createBroker(config?)` factory (`public-factory.ts` 68 LOC) con validazione Valibot D-18 e D-30 no-singleton, e public API surface (`index.ts` 38 LOC) che esporta runtime + tipi pubblici. Pattern TDD RED→GREEN preservato: 2 commit RED + 2 commit GREEN. Coverage REQ-IDs: CORE-02 ✓, CORE-04 ✓, CORE-05 ✓, CORE-11 ✓, CORE-14 ✓, LIFE-01 ✓, LIFE-02 ✓ (più D-17, D-18, D-19, D-25, D-26, D-28, D-29, D-30).

## Objective Achieved

L'obiettivo del plan 01-08 è raggiunto integralmente:

- **5 file creati** + 1 file modificato (`packages/core/src/index.ts` upgraded da type-only re-export a public API surface completa)
- **`pnpm --filter @gluezero/core test`** esce 0 e riporta `Test Files 12 passed (12) | Tests 191 passed (191)` in 622-797 ms (suite cumulativa post-Wave-5 = 10 file Wave 4 + 2 nuovi: `plugin-registry.test.ts` 19 test + `public-factory.test.ts` 13 test)
- **`pnpm --filter @gluezero/core typecheck`** esce 0 (no TS errors, isolatedDeclarations conforme)
- **`pnpm biome check packages/core/src/`** esce 0 (35 file checked, 0 errori, 0 warning)
- **`pnpm --filter @gluezero/core build`** produce `dist/index.js` 23.14 KB + `dist/index.d.ts` 6.44 KB + `dist/index.js.map` 80.04 KB
- **Smoke test imports**: `Object.keys(m).sort()` ritorna `["Broker", "createBroker", "createBrokerError", "createConsoleLogger", "isBrokerError", "silentLogger"]` — superset rispetto al minimo richiesto `["Broker", "createBroker", "createBrokerError", "isBrokerError"]`
- **TDD pattern RED→GREEN** preservato: 2 commit `test(01-08): aggiunge test RED ...` precedono i corrispondenti commit `feat(01-08): implementa ...`
- **Cascade D-26 punto 1 enforcement** verificato sia in unit (plugin-registry.test.ts test 'CASCADE D-26 point 1') sia in integration (public-factory.test.ts test 'Plugin scoped subscribe → cascade unsubscribe on unregisterPlugin')
- **Threat T-08-01..T-08-08** mitigati o accettati come da threat model (vedi sezione Threat Surface Scan)

## Tasks Executed

| #   | Name                                                                          | Commit RED | Commit GREEN | Status |
| --- | ----------------------------------------------------------------------------- | ---------- | ------------ | ------ |
| 1   | PluginRegistry + createPluginScopedBroker + cascade D-26 (CORE-04, CORE-05, CORE-11, LIFE-02) | `ada0cfb`  | `1377ef9`    | done   |
| 2   | Broker class + createBroker factory + index.ts public API (CORE-02, CORE-14, D-28, D-29, D-30) | `285390b`  | `1960be9`    | done   |

NOTA: il PLAN dichiarava Task 2 con `tdd="false"`, ma per coerenza col pattern preservato in tutti i plan precedenti (e per garantire un RED gate verificabile), ho applicato anche al Task 2 il pattern RED+GREEN: prima committato `public-factory.test.ts` (RED gate verificato: import da `./public-factory` e `./core/broker` falliscono per moduli mancanti), poi committato `broker.ts` + `public-factory.ts` + `index.ts` (GREEN gate verificato: 13/13 nuovi test passing). Documentato come deviation Rule 2 (gate explicit improves regression detection).

## Files Created

**Source modules (3 file):**

- `packages/core/src/core/plugin-registry.ts` (224 LOC) — esporta `class PluginRegistry`, `function createPluginScopedBroker`, `interface PluginScopedBroker`. API pubblica: `register(descriptor): Promise<void>` (auto-mount D-25), `unregister(id): Promise<void>` (cascade D-26 → onDestroy → destroyed), `list(): string[]`, `get(id): PluginRegistration | undefined`. Helper Proxy `createPluginScopedBroker(rootBroker: object, bus: EventBus, pluginId: string): PluginScopedBroker` ritorna wrapper che propaga `ownerId=pluginId` al bus su ogni `subscribe()` e delega altri metodi al rootBroker via `Reflect.get` con auto-bind per function values.
- `packages/core/src/core/broker.ts` (166 LOC) — esporta `class Broker` e `interface BrokerDebugSnapshot`. API pubblica: `publish<T>(topic, payload, options?): void`, `subscribe(pattern, handler, options?): Subscription`, `registerPlugin(descriptor): Promise<void>`, `unregisterPlugin(id): Promise<void>`, `getTopicRegistry(): readonly string[]`, `setLogger(logger: BrokerLogger): void`, `enableDebug(): void`, `disableDebug(): void`, `getDebugSnapshot(): BrokerDebugSnapshot`. Composta da: `EventBus` (plan 07 — dispatch), `PluginRegistry` (plan 08 — lifecycle), `TopicRegistry` (plan 06 — topic noti), default logger `createConsoleLogger(level)` (plan 04), default tap `noopEventTap` (plan 04). Costante module-level `F1_PIPELINE_STEPS` con i 5 step F1 della pipeline §28. Costruttore wrappa `import.meta.env.DEV` in try/catch per fallback safe in runtime non-bundler.
- `packages/core/src/public-factory.ts` (68 LOC) — esporta `function createBroker(config?: BrokerConfig): Broker`. Valibot `BrokerConfigSchema` valida strutturalmente `runtime` (debug+deepFreezeInDev+logLevel boolean/picklist; logger+tap unknown) + `debug` (enabled+snapshotPayloadsFull boolean) + 8 sezioni F2-F6 (`topicSchemas`, `canonicalModel`, `aliasRegistry`, `transforms`, `routes`, `transport`, `workers`, `cache`) come `v.unknown()`. `safeParse` ritorna issues su fallimento → throw `Error('Invalid BrokerConfig: ' + issues.join('; '))`.

**Test suites (2 file, 32 nuovi test):**

- `packages/core/src/core/plugin-registry.test.ts` (368 LOC, **19 test** in 4 describe block):
  - `PluginRegistry.register` (5 test): order onRegister → onMount + state mounted, PluginContext shape, plugin.id.duplicate D-17, rollback su onRegister throw, state failed su onMount throw
  - `PluginRegistry.unregister` (7 test): order onUnmount → onDestroy + transitions, plugin.not-found, CASCADE D-26 point 1 via scoped broker (5 sub auto-tagged → unsubscribed), AbortController fires post-unregister, cascade procede su onUnmount throw, cascade procede su onDestroy throw, signal.aborted false during onUnmount + true during onDestroy (RESEARCH Open Q 5)
  - `createPluginScopedBroker` (4 test): propagation ownerId al bus.subscribe, delegation non-subscribe methods al root, subscribe sempre tagga (anche senza signal), non-function properties returned as-is
  - `PluginRegistry.list` (3 test): array di id registrati, empty array nessun plugin, removed post-unregister

- `packages/core/src/public-factory.test.ts` (176 LOC, **13 test** in 2 describe block):
  - `createBroker` (6 test): empty config → Broker instance, D-30 independent instances, valid logLevel (debug/silent/trace), invalid logLevel D-18 → Error /Invalid BrokerConfig/, F2-F6 placeholder sections (CORE-14), all F1 runtime fields validation
  - `Broker — public API surface (via createBroker)` (7 test): publish + subscribe end-to-end (CORE-01), getDebugSnapshot D-28 shape (6 fields + pipelineSteps esatti), enableDebug/disableDebug D-29 toggle no-throw, getTopicRegistry CORE-03, registerPlugin + unregisterPlugin lifecycle CORE-04+CORE-05, plugin scoped subscribe → cascade unsubscribe LIFE-02 chiusura PRD §39 #7, setLogger swap

**File modified (1):**

- `packages/core/src/index.ts` (10 LOC → 38 LOC) — public API surface upgraded. Runtime exports: `createBroker`, `Broker`, `createBrokerError`, `isBrokerError`, `createConsoleLogger`, `silentLogger`. Type exports espliciti (no wildcard `export type *`): `BrokerEvent`, `EventSource`, `DeliveryMode`, `Priority`, `EventId`, `Subscription`, `SubscribeOptions`, `PluginDescriptor`, `PluginContext`, `PluginState`, `BrokerError`, `ErrorCategory`, `BrokerLogger`, `LogLevel`, `EventTap`, `PipelineStep`, `PipelineSnapshot`, `BrokerConfig`, `DeepReadonly`. Tipi interni (`PluginRegistration`, `BrokerDebugSnapshot`, `PluginScopedBroker`, `EventBusOptions`, `EventBusStats`, `CreateBrokerErrorParams`) NON ri-esportati per mantenere control sulla surface.

## Verification Results

### Acceptance criteria Task 1 (plugin-registry)

- [x] File `packages/core/src/core/plugin-registry.ts` esporta `PluginRegistry` class **e** `createPluginScopedBroker` helper — verificato grep
- [x] `createPluginScopedBroker(root, bus, pluginId)` ritorna Proxy che propaga `ownerId=pluginId` su ogni `subscribe()` chiamata; altri metodi delegati al broker root — verificato test 'propagates ownerId to bus.subscribe'
- [x] register chiama transitionState in ordine: registered → mounting → mounted (D-25) — verificato test 'final state mounted'
- [x] register con id duplicato → throw BrokerError code='plugin.id.duplicate' (D-17) — verificato test 'throws plugin.id.duplicate'
- [x] unregister chiama: unmounting → unmounted → destroyed — verificato test 'invokes onUnmount then onDestroy in order'
- [x] Cascade ordine D-26: bus.unsubscribeByOwner(pluginId) → abortController.abort() → onDestroy — verificato 3 test (CASCADE point 1, AbortController fires, signal.aborted timing)
- [x] **D-26 point 1 esercitato in pratica**: subscription via scoped broker auto-tagged + rimosse — verificato test 'CASCADE D-26 point 1' (5 sub registrate da onMount via ctx.broker, post-unregister bus.getStats().topics.length === 0)
- [x] File test ha 19 test cases (target ≥ 15)
- [x] `pnpm --filter @gluezero/core test plugin-registry` esce 0 → 19/19 test passing
- [x] signal.aborted === false durante onUnmount, true durante onDestroy — verificato test esplicito
- [x] `grep -q "import { createPluginScopedBroker, PluginRegistry } from './plugin-registry'" packages/core/src/core/plugin-registry.test.ts` (post Biome Organize Imports il named import order è alfabetico)

### Acceptance criteria Task 2 (broker + public-factory + index)

- [x] File `packages/core/src/core/broker.ts` esporta `Broker` class con tutti i metodi D-28: `publish`, `subscribe`, `registerPlugin`, `unregisterPlugin`, `getTopicRegistry`, `setLogger`, `enableDebug`, `disableDebug`, `getDebugSnapshot` — verificato grep
- [x] `getDebugSnapshot()` ritorna oggetto con tutti i 6 campi D-28: topics, subscriberCount, pluginIds, pendingAsyncDelivery, logLevel, pipelineSteps — verificato test 'returns expected shape'
- [x] `pipelineSteps` array contiene esattamente i 5 step F1 — verificato test
- [x] File `packages/core/src/public-factory.ts` esporta `createBroker(config?)` con validazione Valibot — verificato grep `v.safeParse`
- [x] createBroker con `logLevel: 'invalid'` lancia errore `Invalid BrokerConfig` — verificato test
- [x] createBroker accetta tutte le 8 sezioni F2-F6 placeholder (CORE-14) — verificato test
- [x] File `packages/core/src/index.ts` esporta: `createBroker`, `Broker`, `isBrokerError`, `createBrokerError`, `createConsoleLogger`, `silentLogger` runtime + tipi pubblici via `export type` — verificato grep
- [x] File `packages/core/src/public-factory.test.ts` ha 13 test cases per: empty config, independent instances (D-30), valid logLevel, invalid logLevel, F2-F6 placeholders, all F1 runtime fields, end-to-end pub/sub, getDebugSnapshot shape, enableDebug/disableDebug, getTopicRegistry, registerPlugin/unregisterPlugin lifecycle, plugin scoped LIFE-02 cascade, setLogger
- [x] `pnpm --filter @gluezero/core test` esce 0 con `Test Files 12 passed`
- [x] `pnpm --filter @gluezero/core build` esce 0 → dist/index.js 23.14 KB + dist/index.d.ts 6.44 KB
- [x] Smoke import `dist/index.js` espone Broker, createBroker, createBrokerError, isBrokerError (più createConsoleLogger, silentLogger)

### Plan-wide verification

- [x] 5 file source + 2 file test esistenti
- [x] `pnpm --filter @gluezero/core test` esce 0 con `Test Files 12 passed | Tests 191 passed`
- [x] `pnpm --filter @gluezero/core build` esce 0; produce `dist/index.js` + `dist/index.d.ts`
- [x] `pnpm --filter @gluezero/core typecheck` esce 0
- [x] `pnpm biome check packages/core/src/` esce 0 (35 file checked)
- [x] Smoke import `dist/index.js` espone superset richiesto
- [ ] Coverage v8 ≥ 90% — **NON MISURATA** (open item ereditato da plan 04: missing dep `@vitest/coverage-v8`); surrogate confidence: 191 test passing su 12 moduli isolati con behavior coverage esplicito su tutta la surface F1 Phase 1
- [x] `package.json#exports` permette `import { createBroker } from '@gluezero/core'` (verificato dal smoke test)

## Final test output

```
> @gluezero/core@0.0.0 test
> vitest run --passWithNoTests

 RUN  v4.1.5 packages/core

 Test Files  12 passed (12)
      Tests  191 passed (191)
   Start at  23:15:53
   Duration  797ms (transform 471ms, setup 0ms, import 686ms, tests 58ms, environment 6.97s)
```

I 12 file di test corrispondono a:
- Plan 04: `broker-error.test.ts`, `deep-freeze.test.ts`, `logger.test.ts`, `event-tap.test.ts` (42 test)
- Plan 05: `topic-matcher.test.ts`, `event-factory.test.ts`, `event-validator.test.ts` (55 test)
- Plan 06: `topic-registry.test.ts`, `lifecycle.test.ts` (37 test)
- Plan 07: `bus.test.ts` (25 test)
- Plan 08: `plugin-registry.test.ts` (19 test) + `public-factory.test.ts` (13 test) = **32 nuovi**

## Final build output

```
ESM dist/index.js     23.14 KB
ESM dist/index.js.map 80.04 KB
ESM ⚡️ Build success in 51ms
DTS dist/index.d.ts 6.44 KB
DTS ⚡️ Build success in 346ms
```

## Smoke test exports

```bash
$ node --input-type=module -e "import('./dist/index.js').then(m => console.log(JSON.stringify(Object.keys(m).sort())))"
["Broker","createBroker","createBrokerError","createConsoleLogger","isBrokerError","silentLogger"]
```

Superset rispetto al minimo richiesto `["Broker", "createBroker", "createBrokerError", "isBrokerError"]`. I 2 export aggiuntivi (`createConsoleLogger`, `silentLogger`) sono utility helper documentate dal plan come "potenziali altri export richiesti dal plan" (vedi prompt orchestrator punto 5).

## Deviations from Plan

### Auto-added (Rule 2 — missing critical / coverage gap)

**1. Test "subscribe via scoped broker with no signal still tags ownerId"**

- **Found during:** Task 1 redazione test
- **Issue:** Lo snippet del PLAN testava la cascade via onMount + multiple subscribe(). Senza un test isolato sul comportamento del Proxy quando il subscribe non ha `signal` opt-in, una regressione futura potrebbe rompere il tagging in modi sottili (es. Proxy `get()` interceptor che cambia behavior se `options` è undefined).
- **Fix:** Aggiunto test che chiama `scoped.subscribe('topic.x', () => {})` (no options object) e verifica `bus.unsubscribeByOwner('p-scoped') === 1`.
- **Files modified:** `packages/core/src/core/plugin-registry.test.ts`
- **Commit:** `ada0cfb`

**2. Test "non-function properties on root are returned as-is"**

- **Found during:** Task 1 redazione test
- **Issue:** Il PLAN behaviour cita la delegation per i metodi (function values). L'implementazione del Proxy `get()` ritorna `value.bind(target)` solo se `typeof value === 'function'`, altrimenti return `value` raw. Senza test sul ramo non-function, una regressione che mette `value.bind(target)` su tutto crasherebbe a runtime.
- **Fix:** Aggiunto test con `root = { version: '1.2.3', subscribe: () => null }` che verifica `scoped.version === '1.2.3'`.
- **Files modified:** `packages/core/src/core/plugin-registry.test.ts`
- **Commit:** `ada0cfb`

**3. Test "cascade procedes even if onDestroy throws"**

- **Found during:** Task 1 redazione test
- **Issue:** Il PLAN behaviour elenca il pattern "onDestroy che throw → cascade già completata, solo log" ma il test snippet originale del PLAN testava solo onUnmount throw. Senza gemello su onDestroy, una regressione potrebbe propagare l'errore di onDestroy fuori da unregister().
- **Fix:** Aggiunto test che registra plugin con onDestroy throw → unregister non throw → errorLog chiamato con 'Plugin onDestroy threw' + plugin removed dal registry.
- **Files modified:** `packages/core/src/core/plugin-registry.test.ts`
- **Commit:** `ada0cfb`

**4. Test "list returns empty array when no plugins registered" + "removes id from list after unregister"**

- **Found during:** Task 1 redazione test
- **Issue:** Il PLAN testava `list()` solo con plugin registrati (`expect(reg.list()).toEqual(['p1', 'p2'])`). Edge case empty/post-removal non coperti — Map iteration potrebbe avere bug subtle (es. `[...this.plugins.keys()]` su Map vuoto).
- **Fix:** 2 test aggiuntivi: empty array iniziale + post-unregister un id residuo.
- **Files modified:** `packages/core/src/core/plugin-registry.test.ts`
- **Commit:** `ada0cfb`

**5. Test "accepts runtime config with all F1 fields"**

- **Found during:** Task 2 redazione test
- **Issue:** Il PLAN testava solo `runtime: { logLevel: 'debug' }` per la validation positiva. I 5 campi F1 di `runtime` (debug, deepFreezeInDev, logLevel, logger, tap) + i 2 di `debug` (enabled, snapshotPayloadsFull) non avevano coverage esplicita.
- **Fix:** Aggiunto test che passa tutti i 5 campi runtime + 2 debug e verifica no-throw — gate contro regressioni in cui il Valibot schema sbagliasse a validare un campo F1.
- **Files modified:** `packages/core/src/public-factory.test.ts`
- **Commit:** `285390b`

**6. Test "Broker.registerPlugin + unregisterPlugin lifecycle"**

- **Found during:** Task 2 redazione test
- **Issue:** Il PLAN behaviour del Task 2 elenca implicitamente la lifecycle hooks chiamati in ordine D-25, ma nessun test del PLAN snippet collegava la lifecycle order alla classe Broker. I test plugin-registry verificano `PluginRegistry` isolato; serve un gate end-to-end sull'API pubblica.
- **Fix:** Aggiunto test integration che usa `createBroker()` + `broker.registerPlugin({ id, onRegister, onMount, onUnmount, onDestroy })` + `broker.unregisterPlugin(id)` e verifica order=['register', 'mount', 'unmount', 'destroy'] + `broker.getDebugSnapshot().pluginIds` aggiornato.
- **Files modified:** `packages/core/src/public-factory.test.ts`
- **Commit:** `285390b`

**7. Test "Plugin scoped subscribe → cascade unsubscribe on unregisterPlugin (LIFE-02)"**

- **Found during:** Task 2 redazione test
- **Issue:** I test in `plugin-registry.test.ts` verificano la cascade D-26 isolando il `PluginRegistry`. Manca un gate end-to-end via API pubblica `createBroker()`/`registerPlugin()`/`unregisterPlugin()` che verifichi LIFE-02 (chiusura PRD §39 #7) attraverso la composition completa del Broker.
- **Fix:** Aggiunto test che usa `broker.registerPlugin({ id, onMount: (ctx) => { ctx.broker.subscribe(...); ctx.broker.subscribe(...) } })`, conferma `getDebugSnapshot().topics.length === 2`, chiama `broker.unregisterPlugin(id)`, conferma `getDebugSnapshot().topics.length === 0`. Verifica end-to-end che il Broker passa correttamente il scoped broker al PluginContext e la cascade rimuove le sub.
- **Files modified:** `packages/core/src/public-factory.test.ts`
- **Commit:** `285390b`

### Auto-applied formatting (Rule 1 — Biome lint)

**8. Biome auto-fix Organize Imports + format multi-line (Task 1)**

- **Found during:** Post-implementazione GREEN Task 1 — `pnpm biome check` ha emesso 3 errori: Organize Imports (ordering alfabetico) su `plugin-registry.ts` import block, Organize Imports su `plugin-registry.test.ts` named imports nel `from './plugin-registry'`, format multi-line su test signature `createPluginScopedBroker(...)`.
- **Fix:** `pnpm biome check --write packages/core/src/core/plugin-registry.ts packages/core/src/core/plugin-registry.test.ts` — Biome auto-applicato 2 fix.
- **Files modified:** `packages/core/src/core/plugin-registry.ts`, `packages/core/src/core/plugin-registry.test.ts`
- **Commit:** `1377ef9` (incluso GREEN per coerenza con pattern plan 07)

**9. Biome auto-fix Organize Imports + format multi-line (Task 2)**

- **Found during:** Post-implementazione GREEN Task 2 — `pnpm biome check` ha emesso 3 errori: Organize Imports su `broker.ts` (PluginRegistry, createPluginScopedBroker named import re-ordered alfabeticamente), Organize Imports su `index.ts` (4 runtime exports re-ordered alfabeticamente prima dei type exports — pattern statement ordering Biome), format multi-line collassato su `expect(() => createBroker(...)).toThrow(...)` in `public-factory.test.ts`.
- **Fix:** `pnpm biome check --write packages/core/src/` — Biome auto-applicato 3 fix.
- **Files modified:** `packages/core/src/core/broker.ts`, `packages/core/src/index.ts`, `packages/core/src/public-factory.test.ts`
- **Commit:** `1960be9` (incluso GREEN)

### Architectural Decisions

**10. PluginContext.broker placeholder `unknown` di plan 03 risolto via approccio strutturale (NOT Rule 4)**

- **Found during:** Task 1 design implementazione `createPluginScopedBroker`
- **Issue:** Il prompt orchestrator (punto 4) cita: "Plan 08 deve risolverlo. Il plan dovrebbe specificare l'approccio (declaration merging sull'interface o re-typing della `PluginContext` in `plugin-registry.ts`). Segui le indicazioni del PLAN." Il PLAN snippet usa `rootBroker: B extends object` generico, ma `isolatedDeclarations: true` richiede tipo concreto. Declaration merging su `types/plugin.ts` richiederebbe import circolare types/plugin.ts → core/broker.ts → core/plugin-registry.ts → types/plugin.ts.
- **Decisione:** Approach strutturale invece di declaration merging:
  - `createPluginScopedBroker(rootBroker: object, bus: EventBus, pluginId: string): PluginScopedBroker`
  - Esporta `interface PluginScopedBroker { subscribe(...): Subscription; [key: string]: unknown }`
  - Consumer cast `ctx.broker as { subscribe: (p, h) => Subscription }` — coerente con il tipo `PluginContext.broker: unknown` invariato
- **Razionale:** (a) niente import circolari, (b) `PluginRegistry` resta agnostico al `Broker.ts`, (c) `types/plugin.ts` invariato (no breaking change), (d) `PluginContext.broker: unknown` documentato già in plan 03 come placeholder che plan 08 può risolvere "via TypeScript declaration merging O re-typing dell'interfaccia" — l'approccio strutturale è la terza via valida.
- **Plan future:** Plan F2/F3 possono comunque applicare declaration merging non-breaking se il consumer DX richiedesse `ctx.broker.subscribe(...)` senza cast.
- **Documented in:** modulo header `plugin-registry.ts` + commento broker.ts costruttore + decisions frontmatter SUMMARY

**11. createBroker validation Error nativo vs BrokerError (NOT Rule 4)**

- **Found during:** Task 2 implementazione `public-factory.ts`
- **Issue:** Il PLAN behaviour cita: "createBroker(config) valida config con Valibot e lancia errore esplicito se invalid (D-18)". Lo snippet usa `throw new Error('Invalid BrokerConfig: ...')`, ma D-18 originalmente prevedeva `BrokerError` `code='config.invalid'` o `'broker.config.invalid'`.
- **Decisione:** `Error` nativo (non BrokerError) con prefisso 'Invalid BrokerConfig:'.
- **Razionale:** (a) errore di development-time per il consumer del config, non runtime broker-internal (BrokerError è per errori semantici della pipeline broker), (b) match-pattern test `/Invalid BrokerConfig/` più semplice contro Error nativo, (c) non serve `code`/`category` enumerati (1 sola classe di errore), (d) consumer riconosce la stringa per gestione UX.
- **Documented in:** modulo header `public-factory.ts` (full razionale 4-punti) + decisions frontmatter SUMMARY

Nessuna Rule 4 (architectural change blocking). Le 2 architectural decisions documentate sopra sono entrambe risolutive di ambiguità del PLAN tra opzioni equivalenti — coerenti con D-18 nello spirito (validation explicit), e plan 03 documentation (`PluginContext.broker: unknown` placeholder).

## Authentication Gates

Nessun auth gate (operazioni esclusivamente locali: edit file, lint, typecheck, test, build, git commit).

## Threat Surface Scan

Threat model del plan 08 confermato. Mitigazioni applicate:

- **T-08-01** (DoS — createBroker con config malformato → broker non crea ma errore criptico): MITIGATE. Valibot validation D-18 con messaggio chiaro per ogni issue (`Invalid BrokerConfig: ${issues.map(i => i.message).join('; ')}`). Test 'throws on invalid runtime.logLevel' verifica regex `/Invalid BrokerConfig/`. ✓
- **T-08-02** (Tampering — onUnmount handler non chiamato in cascade → memory leak): MITIGATE. `try { onUnmount } catch { log }; continue cascade` D-26 — cascade sempre eseguita anche se hook fail. Test 'cascade procedes even if onUnmount throws' verifica che bus.getStats().topics.length === 0 anche con onUnmount throw. ✓
- **T-08-03** (Tampering — onDestroy handler non chiamato → resource leak): MITIGATE. Try/catch attorno onDestroy; log error ma cascade già completata. Test 'cascade procedes even if onDestroy throws' verifica errorLog + plugin removed. ✓
- **T-08-04** (Tampering — Plugin con id duplicato sovrascrive — overwrite silenzioso): MITIGATE. D-17: `plugin.id.duplicate` throw; nessun overwrite. Test 'throws plugin.id.duplicate' verifica. ✓
- **T-08-05** (Information disclosure — getDebugSnapshot espone subscriberCount per topic in production): ACCEPT. API documentata; consumer responsabile di non chiamarla in production se sensitive (deferred guard a F6 con `disableDebug` enforcement). Documentato in modulo header broker.ts. ✓
- **T-08-06** (Tampering — PluginContext.broker permette plugin di mutare lo stato del broker): ACCEPT. F1 plugin hanno full broker access (intenzionale per registrare subscription); F3 può aggiungere capability tokens se serve isolation più stretta. Il `createPluginScopedBroker` mitiga parzialmente (subscribe è scoped, altri metodi delegati invariati). ✓
- **T-08-07** (Tampering — Race condition register/unregister concorrenti stesso id): MITIGATE. Map.has + Map.set sono atomici nel single-threaded JS; transitionState valida pre-condition; race detection via state machine (transition invalida → throw `plugin.lifecycle.invalid-transition`). ✓
- **T-08-08** (DoS — Plugin con `onMount` infinito blocca register Promise): ACCEPT. F1 non implementa timeout su lifecycle hooks (deferred a F3 routes con per-route timeout); broker non può proteggere da CPU-bound infinite loop. Documentato in modulo header plugin-registry.ts. ✓

Nessun nuovo threat surface introdotto fuori dal `<threat_model>` del plan.

## Open Items

Open item ereditato da plan 04 (non risolto in plan 08):
- **Coverage v8 measurement**: install `@vitest/coverage-v8` (devDependency root) e ri-eseguire `pnpm --filter @gluezero/core test:coverage` al termine di Wave 5 per verificare il target ≥ 90% sui file `core/` + `public-factory.ts`. Non bloccante per F1 progress; surrogate confidence: 191 test passing su 12 moduli isolati con behavior coverage esplicito sull'intera surface F1.

Open item nuovo (Phase 2/3 follow-up, non bloccante):
- **PluginContext.broker declaration merging**: l'approccio strutturale di plan 08 richiede al consumer un `ctx.broker as { subscribe: (p, h) => Subscription }` cast. Plan F2 (canonical mapper) o F3 (routing) possono applicare declaration merging non-breaking sull'interface `PluginContext` per esporre `broker: PluginScopedBroker` direttamente, eliminando il cast. Documented in decisions frontmatter (decision #1).

Nessun altro open item sul plan 08. Tutti i comportamenti elencati nel PLAN `<behavior>` Task 1 sono coperti da test, e i 7 test extra Rule 2 estendono la copertura agli edge case e ai gate end-to-end via public API.

## Ready For

**Wave 6 — plan 09** (PipelineHarness + integration tests parallelo a plan 10 — robustness tests):

Plan 09 può comporre il PipelineHarness che esercita end-to-end:
- `createBroker({ runtime: { tap: customTap } })` con tap custom che cattura tutti i 5 step F1
- `broker.publish(...)` + `broker.subscribe(...)` su pattern wildcard
- `broker.registerPlugin({ ...lifecycle hooks })` con onMount che esercita scoped subscribe
- Verification che la pipeline §28 step ordering è coerente cross-plugin
- Assertion sui `event.delivered` snapshot.metadata.subscriberCount

Plan 10 può esercitare robustness:
- 100 plugin registrati in parallelo con register/unregister rapid cycle
- Stress test cascade: 1000 sub per plugin, unregister rimuove tutte
- Memory leak detection: registerPlugin/unregisterPlugin in loop senza riferimenti residui
- Recursion stress: handler che publish stesso topic (D-01 microtask deferred)

L'API pubblica del Broker consumata da plan 09/10 è tutta presente:
- `createBroker(config?: BrokerConfig): Broker` — factory imperativa D-19
- `broker.publish<T>(topic, payload, options?)` — hot path
- `broker.subscribe(pattern, handler, options?): Subscription` — registrazione subscription
- `broker.registerPlugin(descriptor): Promise<void>` — auto-mount D-25
- `broker.unregisterPlugin(id): Promise<void>` — cascade D-26 LIFE-02
- `broker.getTopicRegistry(): readonly string[]` — topic noti CORE-03
- `broker.getDebugSnapshot(): BrokerDebugSnapshot` — D-28 debug introspection
- `broker.enableDebug()` / `broker.disableDebug()` — D-29 toggle
- `broker.setLogger(logger)` — D-13 adapter slot
- `import * from '@gluezero/core'` — public API surface index.ts

## Self-Check: PASSED

**Files verified (created):**

- FOUND: `packages/core/src/core/plugin-registry.ts`
- FOUND: `packages/core/src/core/plugin-registry.test.ts`
- FOUND: `packages/core/src/core/broker.ts`
- FOUND: `packages/core/src/public-factory.ts`
- FOUND: `packages/core/src/public-factory.test.ts`

**Files verified (modified):**

- FOUND: `packages/core/src/index.ts` (38 LOC vs 10 LOC iniziali)

**Commits verified (4 — 2× RED+GREEN):**

- FOUND: `ada0cfb` test(01-08): aggiunge test RED per plugin-registry + cascade D-26
- FOUND: `1377ef9` feat(01-08): implementa PluginRegistry + createPluginScopedBroker (CORE-04, CORE-05, CORE-11, LIFE-02)
- FOUND: `285390b` test(01-08): aggiunge test RED per createBroker + Broker public API
- FOUND: `1960be9` feat(01-08): implementa Broker class + createBroker factory + public API surface (CORE-02, CORE-04, CORE-11, CORE-14, LIFE-01, LIFE-02)

**Test verified:**

- 12 Test Files passed (cumulativo Wave 3 + Wave 4 + Wave 5)
- 191 Tests passed (di cui 32 nuovi da plan 08: 19 plugin-registry + 13 public-factory)
- 0 TS errors (`tsc --noEmit`)
- 0 Biome lint/format issues (`biome check packages/core/src/`)

**Build verified:**

- `dist/index.js` 23.14 KB
- `dist/index.d.ts` 6.44 KB
- Smoke imports: `["Broker", "createBroker", "createBrokerError", "createConsoleLogger", "isBrokerError", "silentLogger"]` — superset richiesto verificato
