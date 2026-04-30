/**
 * @sembridge/gateway — HTTP Gateway centralizzato + adapter realtime per SemBridge.
 *
 * Phase 3 (HTTP) + Phase 4 (SSE/WebSocket). Il package è organizzato in **subpath
 * exports** (`./http`, `./sse-ws` Phase 4) per separare le capability sia a livello
 * di build sia di dependency boundary. Vedi RESEARCH §"Subpath Exports Recommendation".
 *
 * **Umbrella barrel** (questo file): re-export tipi/runtime aggregati. La maggior
 * parte dei consumer importerà direttamente da `@sembridge/gateway/http` per
 * beneficiare del bundle budget separato (8 KB gzip vs aggregato dopo F4).
 *
 * Vincolo architetturale (D-83): il package NON modifica `bus.ts` di F1 né
 * `broker-mapper-wrapper.ts` di F2. È invocato dal `RouteExecutor` di
 * `@sembridge/routing` (composition).
 *
 * Plan 03-04 aggiungerà `import './augment'` come side-effect (declaration
 * merging di `BrokerConfig.gateway?` — D-94/D-95) e i type re-export da `./http`.
 *
 * @packageDocumentation
 */

// Plan 03-04 popolerà il side-effect import './augment' + i type re-export aggregati
//             da ./http (HttpGatewayConfig, HttpStrategies, HttpErrorCode).
// Plan 03-08+ popolerà i runtime export aggregati (createHttpGateway re-export).

export {}
