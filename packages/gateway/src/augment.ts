// augment.ts — TS declaration merging per estendere @sembridge/core con `BrokerConfig.gateway`.
// (D-93 in 03-CONTEXT.md — replica F2 D-56 + parallelo a plan 03-03 F3 routing augment)
//
// Vincolo D-83: NESSUNA modifica a packages/core/src/ né packages/mapper/src/ runtime.
// Questo file è il PUNTO UNICO di chiusura del placeholder F1 per la sezione `BrokerConfig.gateway`.
//
// Cosa estende:
//   - BrokerConfig (interface, da @sembridge/core) — aggiunge `gateway?: GatewayConfig` come
//     campo opzionale (D-93). Sezione complementare a `BrokerConfig.routes`/`BrokerConfig.routing`
//     augmentate da `packages/routing/src/augment.ts` (plan 03-03 — pattern simmetrico).
//
// Perché qui (separato da `@sembridge/routing`):
//   - `@sembridge/gateway` ha già `@sembridge/routing` come dependency workspace (vedi
//     `package.json` dependencies). Augmentare `BrokerConfig.gateway?: GatewayConfig` da
//     `packages/routing/src/augment.ts` richiederebbe `import type { GatewayConfig } from
//     '@sembridge/gateway'` da routing → ciclo workspace.
//   - Soluzione: ogni package augmenta i campi pertinenti al PROPRIO scope. Routing augmenta
//     `routes`/`routing` (campi che dipendono da `RouteDefinition`/`RoutingConfig`); gateway
//     augmenta `gateway` (campo che dipende da `GatewayConfig`).
//   - TS supporta declaration merging ADDITIVO della stessa interface da fonti multiple
//     (T-03-04-02): consumer che importa entrambi `@sembridge/routing` e `@sembridge/gateway`
//     ottiene `BrokerConfig` con `routes`+`routing`+`gateway` tutti tipizzati.
//
// Cosa NON estende qui:
//   - Nessun altro campo di BrokerConfig né di altri interface. Scope minimale: solo
//     `BrokerConfig.gateway?` (la sola augmentation che richiede `GatewayConfig` da
//     `@sembridge/gateway`).
//   - PipelineStep (type alias literal): F3 non introduce step pipeline gateway-specific
//     (i 3 step F3 — `event.route.resolved`/`event.route.executed`/`event.outcome.collected`
//     — sono già coperti da `F3PipelineStep` di `@sembridge/routing`). F4 SSE/WS aggiungerà
//     eventuali step nuovi via `F4PipelineStep` da questo package.
//
// Side-effect import: `packages/gateway/src/index.ts` ri-esporta `__augmentGatewayLoaded` da
// questo file (`export { __augmentGatewayLoaded } from './augment'`). Il `package.json` ha
// `sideEffects: ["./dist/augment.js", "./src/augment.ts", "**/augment.js", "**/augment.ts"]`
// (Pattern S1 — T-03-04-01 mitigation, replica T-02-09-01 di F2). La `tsup.config.ts` ha
// `src/augment.ts` come entry separata per emettere `dist/augment.js` (path referenziato nel
// `sideEffects`).
//
// Audit-able: `__augmentGatewayLoaded` const fornisce una runtime check che il modulo è stato
// caricato (utile per test e debugging consumer-side).
//
// Threat coverage:
// - T-03-04-01 (Tampering — tree-shaker elimina dist/augment.js): mitigate via
//   `sideEffects` array nel `package.json` + `__augmentGatewayLoaded` export const
//   ri-esportato dal barrel `src/index.ts`.
// - T-03-04-02 (Spoofing — declaration merging accidentale collisioni con routing F3
//   augment): accept. TS unifica le declaration merging della stessa interface
//   `BrokerConfig` da `@sembridge/routing` (campi `routes`/`routing`) e `@sembridge/gateway`
//   (campo `gateway`) — i campi sono DISGIUNTI per costruzione, niente collisione di nomi.
//   Test backward-compat verifica coexistenza routing+gateway fields.

import type { GatewayConfig } from './http/types/gateway-config'

declare module '@sembridge/core' {
  /**
   * F3 augmentation (D-93, SEC-01..SEC-05): aggiunge la sezione `gateway` a `BrokerConfig`.
   *
   * `gateway`: configurazione del Server Gateway HTTP centralizzato (auth/allowlist/defaults/
   * circuitBreaker — D-71/D-72/D-99). Pattern identico a `BrokerConfig.canonicalModel`/
   * `aliasRegistry`/`transforms` di F2 — sezione strutturata letta dal `RouterBroker`
   * costruttore (plan 03-12) per istanziare `HttpGateway` (plan 03-08).
   *
   * NB: `BrokerConfig.routes`/`BrokerConfig.routing` (D-93 sezioni F3 routing) sono
   * augmentate da `packages/routing/src/augment.ts` (plan 03-03). I tre campi
   * (`gateway`/`routes`/`routing`) sono DISGIUNTI per costruzione — niente collisione di
   * nomi (T-03-04-02 accept).
   */
  interface BrokerConfig {
    /** Sezione `gateway` (D-93, PRD §27): config HTTP gateway con auth/allowlist/defaults/circuitBreaker. */
    gateway?: GatewayConfig
  }
}

/**
 * Marker const esportato per detection runtime del side-effect import.
 *
 * Esistenza:
 * 1. Forza il file a essere considerato un "module" (vs ambient declarations) — già
 *    soddisfatto dall'`import type` sopra ma double-safety.
 * 2. Permette ai test (`augment.test.ts`) di verificare che `import './augment'` non
 *    venga tree-shaken dal bundler (T-03-04-01 mitigation diretta).
 * 3. Audit-able: `grep "__augmentGatewayLoaded" dist/` permette di confermare il
 *    side-effect è presente nel bundle distribuito.
 *
 * Pattern S1 (replica `__augmentLoaded` di mapper/src/augment.ts:109 + `__augmentLoaded`
 * di routing/src/augment.ts:172): export const literal `true` ri-esportato dal barrel
 * `src/index.ts` per evitare tree-shaking accidentale. Nome distinto da
 * `__augmentLoaded` (mapper) e `__augmentLoaded` (routing) per consentire ai consumer
 * di distinguere i 3 augment in fase di debug.
 */
export const __augmentGatewayLoaded: true = true
