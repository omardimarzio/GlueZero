---
phase: 04-realtime-inbound-sse-prioritario-ws-opzionale
plan: 01
subsystem: realtime
tags: [sse, websocket, declaration-merging, types, augment, scaffolding, gateway, subpath-exports]

# Dependency graph
requires:
  - phase: 01-core-essenziale
    provides: BrokerConfig + PluginDescriptor interface (target del declaration merging F4)
  - phase: 03-routing-server-gateway-http
    provides: BackpressurePolicyConfig riusato 1:1 da @gluezero/routing per RealtimeChannelDef.backpressure (D-115)
provides:
  - "Subpath @gluezero/gateway/sse-ws risolvibile (export configurato in package.json + tsup entry separati)"
  - "Tipi pubblici F4: RealtimeConfig, RealtimeChannelDef, RealtimeMode, RealtimeReconnectConfig, ReconnectDefaults, HeartbeatDefaults, VisibilityDefaults"
  - "Declaration merging BrokerConfig.realtime?: RealtimeConfig (chiusura placeholder F1 — D-102)"
  - "Declaration merging PluginDescriptor.realtimeChannels?: readonly RealtimeChannelDef[] (chiusura placeholder F1 in core/types/plugin.ts:50 — D-103)"
  - "F4PipelineStep type alias per i 3 step §28 ingress realtime ('event.realtime.received', 'event.realtime.frame-parsed', 'event.realtime.reconnecting')"
  - "Marker __augmentSseWsLoaded const literal true (Pattern S1 anti tree-shaking, T-04-01-01 mitigation)"
  - "RealtimeChannelDef.eventTypes (W-4 SSE custom event types) e .sseHeartbeatEventTypes (B-5 SSE heartbeat hook)"
  - "RealtimeChannelDef.wsSubprotocols (Q4 WS subprotocol auth handshake passthrough)"
affects: [04-02, 04-03, 04-04, 04-05, 04-06, 04-07, 04-08, 04-09]

# Tech tracking
tech-stack:
  added: []  # solo types + scaffolding, nessuna dipendenza runtime nuova
  patterns:
    - "Declaration merging additive cross-package via augment.ts (replica F2/F3 pattern)"
    - "Pattern S1 anti tree-shaking — marker __augmentSseWsLoaded re-esportato dal barrel (T-04-01-01 mitigation)"
    - "Subpath exports separati ./http (F3) + ./sse-ws (F4) per bundle budget isolato"
    - "F4PipelineStep literal union additive (TS non supporta merging di type alias)"
    - "Composition wrapper preparation (D-101): types-only scaffolding senza runtime"

key-files:
  created:
    - "packages/gateway/src/sse-ws/augment.ts (105 LOC) — declaration merging F4"
    - "packages/gateway/src/sse-ws/types/realtime-config.ts (87 LOC) — RealtimeConfig + Defaults"
    - "packages/gateway/src/sse-ws/types/realtime-channel-def.ts (125 LOC) — RealtimeChannelDef + RealtimeMode"
    - "packages/gateway/src/sse-ws/types/index.ts (18 LOC) — barrel types-only"
    - "packages/gateway/src/sse-ws/index.ts (33 LOC) — subpath barrel skeleton"
    - "packages/gateway/src/sse-ws/augment.test.ts (135 LOC) — 8 test smoke decl merging"
  modified:
    - "packages/gateway/package.json — exports './sse-ws' + description aggiornata"
    - "packages/gateway/tsup.config.ts — entry sse-ws/index + sse-ws/augment"
    - "packages/gateway/vitest.config.ts — coverage exclude src/sse-ws/{index,types,augment,test-utils}"
    - "packages/gateway/src/index.ts — umbrella barrel re-export __augmentSseWsLoaded + export * from './sse-ws'"

key-decisions:
  - "D-101 composition wrapper preparation: types-only scaffolding, ZERO runtime in 04-01"
  - "D-102 multi-channel topology: RealtimeConfig.channels: readonly RealtimeChannelDef[] (analog routes F3)"
  - "D-103 placeholder F1 chiuso: PluginDescriptor.realtimeChannels via decl merging (NON modifica core/types/plugin.ts)"
  - "D-104 buildUrl auth-agnostic: () => Promise<string> hook"
  - "D-107 mode union 'sse' | 'websocket' | 'auto' con fallbackThreshold 3 + globalCycleCap 5"
  - "D-115 BackpressurePolicyConfig riusato 1:1 da @gluezero/routing senza nuove definizioni"
  - "W-4: eventTypes opzionale SSE-only (chiude SC-1 ROADMAP scenario meteo event: weather.update)"
  - "B-5: sseHeartbeatEventTypes default ['heartbeat'] per server SSE freshness senza topic spam"
  - "Q4: wsSubprotocols opt-in passthrough a new WebSocket(url, protocols)"

patterns-established:
  - "augment.ts cross-package: ogni package augmenta i campi del proprio scope (F2 mapper, F3 routing/gateway-http, F4 gateway/sse-ws) — TS unifica le declaration merging additive su BrokerConfig"
  - "Pattern S1 marker: __augmentSseWsLoaded const literal `true = true` re-esportato dal barrel sse-ws/index.ts E dall'umbrella gateway/src/index.ts per double-safety anti tree-shaking"
  - "Subpath barrel skeleton-then-extend: 04-01 espone solo types + augment marker, plan 04-02..04-08 aggiungono runtime (parseFrame, adapter, manager, broker) incrementalmente"
  - "F4PipelineStep additive literal union: pattern F2PipelineStep + F3PipelineStep, consumer compone `PipelineStep | F2PipelineStep | F3PipelineStep | F4PipelineStep`"

requirements-completed:
  - RT-01  # PluginDescriptor.realtimeChannels (placeholder F1 chiuso)
  - RT-02  # config-driven realtime declaration (BrokerConfig.realtime + channels[])
  - RT-03  # subpath @gluezero/gateway/sse-ws risolvibile (build/export config)
  - RT-05  # reconnect config override-abile (ReconnectDefaults + RealtimeReconnectConfig per-channel)

# Metrics
duration: ~10min
completed: 2026-05-04
---

# Phase 4 Plan 01: Bootstrap @gluezero/gateway/sse-ws Summary

**Subpath SSE/WS scaffolding completo: types F4 (RealtimeConfig + RealtimeChannelDef + RealtimeMode + Defaults), declaration merging additive su BrokerConfig.realtime + PluginDescriptor.realtimeChannels (chiude placeholder F1 in core/types/plugin.ts:50), subpath exports + tsup multi-entry + vitest coverage exclude — pronto per Wave 2 (04-02..04-04 frame-parser/reconnect-strategy/visibility-detector).**

## Performance

- **Duration:** ~10 min (Task 1 + Task 2 atomic commits + verify+build clean)
- **Started:** 2026-05-04T12:21Z
- **Completed:** 2026-05-04T14:38Z (build verify finale)
- **Tasks:** 2/2
- **Files modified:** 10 (6 nuovi + 4 modificati)
- **LOC totale source:** 503 (368 source + 135 test)

## Accomplishments

- **Placeholder F1 chiuso** in `packages/core/src/types/plugin.ts:50` ("F4 will add: realtimeChannels") tramite declaration merging additive in `packages/gateway/src/sse-ws/augment.ts` — ZERO modifiche a core/ runtime (D-83 strict)
- **Tipi pubblici F4 dichiarati**: RealtimeConfig, RealtimeChannelDef, RealtimeMode ('sse'|'websocket'|'auto'), RealtimeReconnectConfig, ReconnectDefaults, HeartbeatDefaults, VisibilityDefaults — tutti exported come `type`-only via barrel
- **Subpath @gluezero/gateway/sse-ws risolvibile**: package.json `exports["./sse-ws"]` + tsup entry separati emettono `dist/sse-ws/{index.js, augment.js, index.d.ts, augment.d.ts}` (build success 71ms ESM + 577ms DTS)
- **F4PipelineStep type alias additive** per i 3 step §28 ingress realtime, consumer compone `PipelineStep | F2PipelineStep | F3PipelineStep | F4PipelineStep`
- **Pattern S1 anti tree-shaking**: `__augmentSseWsLoaded` re-esportato dal barrel `sse-ws/index.ts` E dall'umbrella `gateway/src/index.ts` (double-safety, T-04-01-01 mitigation)
- **8 test smoke decl merging** verificano coexistenza F1+F2+F3+F4 sullo stesso `BrokerConfig` (canonicalModel + routes + routing + gateway + realtime + runtime — Test 7 backward-compat)

## Task Commits

Ogni task committato atomicamente:

1. **Task 1: Crea augment.ts + types F4 + barrel skeleton** — `d090a1b` (feat)
   - 6 nuovi file: augment.ts, types/realtime-config.ts, types/realtime-channel-def.ts, types/index.ts, index.ts, augment.test.ts
   - 503 LOC totale source+test
2. **Task 2: Aggiorna build/test config + umbrella barrel** — `2624c66` (chore)
   - 4 file modificati: package.json, tsup.config.ts, vitest.config.ts, src/index.ts

**Plan metadata:** (questo SUMMARY + STATE/ROADMAP update — commit finale)

## Files Created/Modified

### Created (6)

- `packages/gateway/src/sse-ws/augment.ts` (105 LOC) — TS declaration merging `BrokerConfig.realtime` + `PluginDescriptor.realtimeChannels`, F4PipelineStep type alias, `__augmentSseWsLoaded: true` marker
- `packages/gateway/src/sse-ws/types/realtime-config.ts` (87 LOC) — `RealtimeConfig` interface root + `ReconnectDefaults`/`HeartbeatDefaults`/`VisibilityDefaults` sezioni
- `packages/gateway/src/sse-ws/types/realtime-channel-def.ts` (125 LOC) — `RealtimeChannelDef` interface + `RealtimeMode` union + `RealtimeReconnectConfig` per-channel override; importa `BackpressurePolicyConfig` da `@gluezero/routing` (D-115 riuso F3)
- `packages/gateway/src/sse-ws/types/index.ts` (18 LOC) — barrel types-only re-export
- `packages/gateway/src/sse-ws/index.ts` (33 LOC) — subpath barrel skeleton: side-effect import `__augmentSseWsLoaded` + type re-export aggregato
- `packages/gateway/src/sse-ws/augment.test.ts` (135 LOC) — 8 test: marker, F4PipelineStep, BrokerConfig.realtime, defaults, PluginDescriptor.realtimeChannels, backward-compat F1+F2+F3, coexistenza augment, BackpressurePolicyConfig D-115

### Modified (4)

- `packages/gateway/package.json` — aggiunto `exports["./sse-ws"]` (types + import) + description aggiornata "Phase 3 HTTP + Phase 4 realtime SSE/WS"
- `packages/gateway/tsup.config.ts` — 2 entry nuove: `'sse-ws/index': 'src/sse-ws/index.ts'` + `'sse-ws/augment': 'src/sse-ws/augment.ts'`
- `packages/gateway/vitest.config.ts` — coverage exclude esteso: `src/sse-ws/{index.ts, types/**, augment.ts, test-utils/**}` (thresholds invariati, calibrazione finale in 04-09)
- `packages/gateway/src/index.ts` — umbrella barrel: `export { __augmentSseWsLoaded } from './sse-ws/augment'` (Pattern S1) + `export * from './sse-ws'` (re-export aggregato)

## Decisions Made

Tutte le decisioni implementate sono lockate da 04-CONTEXT.md (D-101..D-120) e dal plan 04-01-PLAN.md frontmatter. Riepilogo applicato:

- **D-83 / D-101 strict respected**: ZERO modifiche runtime a `packages/core/src/`, `packages/mapper/src/`, `packages/routing/src/`, `packages/gateway/src/http/`. Verificato via `git diff --name-only d090a1b^..2624c66` — solo file in `packages/gateway/src/sse-ws/` + 4 file di config gateway-level (package.json, tsup, vitest, index.ts). Il commento placeholder `// F4 will add: realtimeChannels` in `core/types/plugin.ts:50` NON è stato rimosso (anti-pattern AP-1 evitato).
- **D-103 declaration merging additive** invece di modifica diretta a `core/types/plugin.ts`: il consumer importa `@gluezero/gateway/sse-ws` (o l'umbrella `@gluezero/gateway`) e ottiene `PluginDescriptor.realtimeChannels` tipizzato.
- **Pattern S1 double re-export**: `__augmentSseWsLoaded` re-esportato sia dal barrel `sse-ws/index.ts` (linea 18) sia dall'umbrella `gateway/src/index.ts` (linea 44) per double-safety anti tree-shaking aggressivo (Vite/webpack/esbuild).
- **W-4 + B-5 + Q4 closures**: `eventTypes`, `sseHeartbeatEventTypes`, `wsSubprotocols` dichiarati come campi opzionali del `RealtimeChannelDef` — essenziali per:
  - W-4: chiusura SC-1 ROADMAP scenario meteo `event: weather.update` (custom SSE event types che derivano `BrokerEvent.topic` dal field `event:`)
  - B-5: server SSE che inviano heartbeat sintattici senza spam topic (default `['heartbeat']`)
  - Q4: WS subprotocol auth handshake passthrough a `new WebSocket(url, protocols)`

## Deviations from Plan

**None — plan executed exactly as written.**

Tutti gli artifact sono prodotti come specificati nel plan frontmatter `must_haves.artifacts`. Tutti gli `acceptance_criteria` di Task 1 e Task 2 sono soddisfatti. Verifica D-83 strict OK (zero modifiche runtime a paths interdetti).

## Issues Encountered

- **Build warning TS5055 al primo run**: tentativo di build senza `clean` ha prodotto errore `Cannot write file 'dist/http/index.d.ts' because it would overwrite input file` (residuo di build precedente). Risolto eseguendo `pnpm --filter @gluezero/gateway clean && pnpm --filter @gluezero/gateway build`. Build success: 5 entry ESM + 5 DTS (29.16 KB index.js + 35.54 KB http/index.d.ts + 10.83 KB sse-ws/index.d.ts). Non è un'issue reale del plan — è una prassi di hygiene CI standard, già nota nel pattern F3.

## Verification Output

```
pnpm --filter @gluezero/gateway exec tsc --noEmit
# exit 0, no output

pnpm --filter @gluezero/gateway test
# Test Files  15 passed (15)
# Tests       105 passed (105)
# Duration    1.50s

pnpm --filter @gluezero/gateway clean && pnpm --filter @gluezero/gateway build
# ESM dist/sse-ws/index.js       228.00 B
# ESM dist/sse-ws/augment.js     232.00 B
# ESM dist/index.js              29.16 KB
# DTS dist/sse-ws/index.d.ts     10.83 KB
# DTS dist/sse-ws/augment.d.ts   96.00 B
# Build success in 71ms (ESM) + 577ms (DTS)
```

## D-83 Strict Verification

```
git diff --name-only d090a1b^..2624c66 | grep -E "packages/(core|mapper|routing)/src/|packages/gateway/src/http/"
# (empty — zero matches)
```

**Risultato:** zero modifiche a `packages/{core,mapper,routing}/src/` né a `packages/gateway/src/http/`. Eccezione consentita applicata: solo `packages/gateway/package.json`, `tsup.config.ts`, `vitest.config.ts`, `packages/gateway/src/index.ts` (build/config/aggregation, NOT runtime di subsystem altrui).

Conteggio file invariati (snapshot pre-04-01):
- `packages/core/src/`: 248 file invariati
- `packages/mapper/src/`: 183 file invariati
- `packages/routing/src/`: invariato (solo lettura tipo `BackpressurePolicyConfig`)
- `packages/gateway/src/http/`: invariato (sezione F3 esistente)

## Hand-off per Wave 2 (04-02 / 04-03 / 04-04)

I plan paralleli di Wave 2 possono ora importare:

```ts
// Type-only imports da @gluezero/gateway/sse-ws (subpath risolvibile)
import type {
  RealtimeChannelDef,
  RealtimeConfig,
  RealtimeMode,
  RealtimeReconnectConfig,
  ReconnectDefaults,
  HeartbeatDefaults,
  VisibilityDefaults,
} from '@gluezero/gateway/sse-ws'

// O internamente (file co-locati nel sotto-package):
import type { RealtimeChannelDef } from './types/realtime-channel-def'
import type { RealtimeConfig } from './types/realtime-config'
```

I 3 plan Wave 2 hanno file ownership disgiunta:
- **04-02** scrive `frame-parser.ts` + `frame-parser.test.ts` + `types/frame-envelope.ts`
- **04-03** scrive `reconnect-strategy.ts` + `reconnect-strategy.test.ts`
- **04-04** scrive `visibility-detector.ts` + `visibility-detector.test.ts`

Nessun conflitto di scrittura sui file 04-01.

## Self-Check: PASSED

- File `packages/gateway/src/sse-ws/augment.ts`: FOUND (105 LOC, contiene `declare module '@gluezero/core'` + `interface BrokerConfig { realtime?: RealtimeConfig }` + `interface PluginDescriptor { readonly realtimeChannels?: readonly RealtimeChannelDef[] }` + `export type F4PipelineStep` + `export const __augmentSseWsLoaded: true = true`)
- File `packages/gateway/src/sse-ws/types/realtime-config.ts`: FOUND (87 LOC, contiene `interface RealtimeConfig`)
- File `packages/gateway/src/sse-ws/types/realtime-channel-def.ts`: FOUND (125 LOC, contiene `interface RealtimeChannelDef` + `export type RealtimeMode = 'sse' | 'websocket' | 'auto'` + `eventTypes?` + `sseHeartbeatEventTypes?` + `wsSubprotocols?`)
- File `packages/gateway/src/sse-ws/types/index.ts`: FOUND (18 LOC, re-esporta tutti i types)
- File `packages/gateway/src/sse-ws/index.ts`: FOUND (33 LOC, contiene `export { __augmentSseWsLoaded`)
- File `packages/gateway/src/sse-ws/augment.test.ts`: FOUND (135 LOC, 8 test passing)
- File `packages/gateway/package.json`: contiene `"./sse-ws":` exports
- File `packages/gateway/tsup.config.ts`: contiene `'sse-ws/index'` + `'sse-ws/augment'` entries
- File `packages/gateway/vitest.config.ts`: contiene `'src/sse-ws/types/**'` exclude
- File `packages/gateway/src/index.ts`: contiene `export { __augmentSseWsLoaded } from './sse-ws/augment'` + `export * from './sse-ws'`
- Build artifacts: `dist/sse-ws/index.js` + `dist/sse-ws/augment.js` + `dist/sse-ws/index.d.ts` + `dist/sse-ws/augment.d.ts` tutti presenti
- Commit `d090a1b` (feat scaffold): FOUND in git log
- Commit `2624c66` (chore build/test config): FOUND in git log
- Test result: 105/105 passing (97 F3 + 8 F4)
- Typecheck: clean (exit 0)
- D-83 strict: 0 violations

## Next Phase Readiness

- ✅ **Wave 2 unblocked**: plan 04-02 (frame-parser), 04-03 (reconnect-strategy), 04-04 (visibility-detector) possono iniziare in parallelo con file ownership disgiunta
- ✅ **Tipi pubblici stabili**: i 7 tipi exported sono lockati per il resto della Phase 4 (modifica = breaking change → richiede explicit decision)
- ✅ **Build pipeline pronta**: `pnpm --filter @gluezero/gateway build` produce subpath separati. Plan 04-09 (final gate F4) calibrerà coverage thresholds + size budget post-implementation.
- ⏭️ **Run-time deferred**: parseFrame, createReconnectStrategy, createVisibilityDetector, SseAdapter, WebSocketAdapter, RealtimeChannelManager, RealtimeBroker, createRealtimeBroker — tutti aggiunti in 04-02..04-08

---
*Phase: 04-realtime-inbound-sse-prioritario-ws-opzionale*
*Plan: 04-01*
*Completed: 2026-05-04*
