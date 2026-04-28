# @sembridge/core

> Core event broker (pub/sub, plugin registry, lifecycle, BrokerEvent) for SemBridge.

ESM-only TypeScript browser library. Browser evergreen target (ES2022). Zero runtime dependencies beyond `nanoid` (ID generation) and `valibot` (schema validation).

## Installazione

```sh
pnpm add @sembridge/core
```

## API pubblica (skeleton)

L'API completa viene definita nei plan 03-08 di Phase 1. Surface attesa:

- `createBroker(config: BrokerConfig): Broker` — factory imperativa (D-19, D-30)
- `Broker` — istanza con `publish`, `subscribe`, `registerPlugin`, `unregisterPlugin`, `getTopicRegistry`, `getDebugSnapshot`, `enableDebug`, `disableDebug`, `setLogger`
- `BrokerEvent`, `EventSource`, `Subscription`, `PluginDescriptor`, `BrokerError`, `BrokerLogger`, `EventTap`, `PipelineStep`, `PipelineSnapshot`, `BrokerConfig`, `LogLevel`, `DeliveryMode`, `Priority`, `EventId`, `DeepReadonly`, `ErrorCategory`, `PluginContext`, `PluginState` — public types
- `createBrokerError`, `isBrokerError` — error utilities

## Vincolo architetturale

`EventTap` interface viene instrumentata già in F1 con implementazione no-op; F6 sostituirà no-op con Inspector reali senza retrofit. Vedi `.planning/research/SUMMARY.md` "Vincolo critico architetturale".

## Stato Phase 1

Plan 01: monorepo bootstrap (plan 01-01) — completato
Plan 02: package config (corrente)
Plan 03-08: types + core modules + EventBus + PluginRegistry + Broker (TBD)
Plan 09-10: integration + robustness tests (TBD)
Plan 11: build verification + DOC-01 finalizzato (TBD)

## Riferimenti

- `prd.md` (root) sezioni §10, §11, §12, §15, §16, §22, §24, §25.4, §27, §28, §31, §33.2, §39, §42
- `.planning/phases/01-core-essenziale/01-CONTEXT.md` — 30 decisioni locked (D-01..D-30)
- `.planning/phases/01-core-essenziale/01-RESEARCH.md` — implementation patterns

## Licenza

MIT
