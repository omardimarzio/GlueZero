/**
 * @gluezero/gateway — HTTP Gateway centralizzato + adapter realtime per GlueZero.
 *
 * Phase 3 (HTTP) + Phase 4 (SSE/WebSocket realtime). Il package è organizzato in
 * **subpath exports** (`./http` per F3 HTTP gateway, `./sse-ws` per F4 SSE/WS realtime
 * adapter) per separare le capability sia a livello di build sia di dependency
 * boundary. Vedi RESEARCH §"Subpath Exports Recommendation".
 *
 * **Umbrella barrel** (questo file): re-export tipi/runtime aggregati. La maggior
 * parte dei consumer importerà direttamente da `@gluezero/gateway/http` per
 * beneficiare del bundle budget separato (8 KB gzip vs aggregato dopo F4).
 *
 * Vincolo architetturale (D-83): il package NON modifica `bus.ts` di F1 né
 * `broker-mapper-wrapper.ts` di F2. È invocato dal `RouteExecutor` di
 * `@gluezero/routing` (composition).
 *
 * **Side-effect import** (Pattern S1, T-03-04-01 mitigation): la riga
 * `export { __augmentGatewayLoaded } from './augment'` ri-esporta il marker const da
 * `./augment` PRIMA dei type re-export aggregati. Questo:
 * 1. Forza il bundler a trattare `./augment` come modulo con side-effect (declaration
 *    merging di `BrokerConfig.gateway?: GatewayConfig` — D-93).
 * 2. Espone `__augmentGatewayLoaded` come simbolo pubblico per detection runtime.
 * 3. Combinato con `package.json.sideEffects: ["./dist/augment.js", ...]` evita il
 *    tree-shaking accidentale del file augment in consumer aggressivi (Vite/webpack/esbuild).
 *
 * Plan 03-08+ popolerà i runtime export aggregati (createHttpGateway re-export
 * dall'umbrella + `HttpGateway` class export).
 *
 * @packageDocumentation
 */

// Side-effect import — abilita TS declaration merging per BrokerConfig.gateway.
// Vedi `packages/gateway/src/augment.ts` (D-83/D-93).
// Ri-esportiamo `__augmentGatewayLoaded` come simbolo pubblico per evitare il
// tree-shaking del side-effect import (T-03-04-01 mitigation). Il `package.json` ha
// `sideEffects: ["./dist/augment.js", "./src/augment.ts", "**/augment.js", "**/augment.ts"]`
// array per double-safety in ambienti consumer.
export { __augmentGatewayLoaded } from './augment'

// PHASE 4 (plan 04-01) — side-effect augment SSE/WS: declaration merging additive di
// `BrokerConfig.realtime` + `PluginDescriptor.realtimeChannels` (D-102/D-103). Il glob
// `sideEffects: ["**/augment.ts", "**/augment.js"]` esistente copre `dist/sse-ws/augment.js`
// (Pattern S1 anti tree-shaking, T-04-01-01 mitigation).
export { __augmentSseWsLoaded } from './sse-ws/augment'

// Re-export sub-modulo HTTP per consumer che importano dall'umbrella.
// Consumer ottimizzati per bundle size importeranno direttamente da
// `@gluezero/gateway/http` (subpath dedicato — RESEARCH §"Subpath Exports").
export * from './http'

// PHASE 4 (plan 04-01) — re-export sub-modulo SSE/WS dall'umbrella. Consumer
// ottimizzati per bundle size importeranno direttamente da `@gluezero/gateway/sse-ws`
// (subpath dedicato). Plan 04-01 espone solo types + augment marker; i runtime
// (parseFrame, SseAdapter, WebSocketAdapter, RealtimeChannelManager, RealtimeBroker,
// createRealtimeBroker) verranno aggiunti incrementalmente nei plan 04-02..04-08.
export * from './sse-ws'
