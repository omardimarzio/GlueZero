/**
 * Facade interfaces per `@gluezero/isolation` — 4 facade abstraction (PRD §21.7 + §33.3 + §34.2).
 *
 * Facade wrappa peer optional service (`@gluezero/cache` / `@gluezero/gateway` /
 * `@gluezero/worker` / `@gluezero/theme`) per:
 * 1. Aggiungere `metadata.microFrontendId` auto-inject (audit + traceability)
 * 2. Applicare isolation policy (storage namespacing prefix, gateway permission check,
 *    worker permission check, theme inheritance enforcement)
 * 3. Esporre API minimale stabile NON dipendente dalla shape interna del peer
 *
 * Riferimento implementazione: W2 P03 (`storage-facade.ts`, `gateway-facade.ts`,
 * `worker-facade.ts`, `theme-facade.ts`).
 *
 * @see prd_2.0.0.md §21.7 — StorageFacade contract
 * @see prd_2.0.0.md §33.3 — GatewayFacade integration
 * @see prd_2.0.0.md §34.2 — WorkerFacade integration
 */

/**
 * `StorageFacade` — Abstraction su `window.localStorage` con namespace prefix.
 *
 * Comportamento per `policy.storage`:
 * - `'shared'`: pass-through senza prefisso (key raw)
 * - `'namespaced'`: prefisso `gz:mf:<mfId>:<key>` applicato a tutte le operazioni
 * - `'blocked'`: `ctx.storage` settato a `undefined` (NON expose il facade)
 *
 * @see prd_2.0.0.md §21.7 — Storage isolation modes
 * @see D-V2-F13-09 — Storage namespacing prefix
 */
export interface StorageFacade {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  clear(): void
}

/**
 * `GatewayRequestOptions` — Options input per `GatewayFacade.request`.
 *
 * `metadata.microFrontendId` viene auto-iniettato dal facade (sovrascrive eventuale
 * value caller per audit consistency).
 */
export interface GatewayRequestOptions {
  readonly metadata?: Record<string, unknown>
  readonly signal?: AbortSignal
  readonly timeout?: number
}

/**
 * `GatewayFacade` — Wrappa `GatewayService.request` (MF-INT-GW-01/02/03).
 *
 * Auto-inject `metadata.microFrontendId` + permission check (`@gluezero/permissions`
 * peer optional se installato — pattern `network`/`gateway` action). Per
 * `policy.network: 'blocked'` → `ctx.gateway` undefined.
 *
 * @see prd_2.0.0.md §33.3 — Gateway integration
 * @see MF-INT-GW-01/02/03 — Permission + metadata auto-inject + audit
 */
export interface GatewayFacade {
  request(routeId: string, payload?: unknown, options?: GatewayRequestOptions): Promise<unknown>
}

/**
 * `WorkerRunOptions` — Options input per `WorkerFacade.run`.
 *
 * `metadata.microFrontendId` viene auto-iniettato dal facade per audit consistency.
 */
export interface WorkerRunOptions {
  readonly metadata?: Record<string, unknown>
  readonly signal?: AbortSignal
  readonly timeout?: number
}

/**
 * `WorkerFacade` — Wrappa `WorkerService.run` (MF-INT-WK-01/02).
 *
 * Auto-inject `metadata.microFrontendId` + permission check (`@gluezero/permissions`
 * peer optional se installato — pattern `worker.run` action).
 *
 * @see prd_2.0.0.md §34.2 — Worker integration
 * @see MF-INT-WK-01/02 — Permission + metadata auto-inject
 */
export interface WorkerFacade {
  run(workerId: string, task: string, payload?: unknown, options?: WorkerRunOptions): Promise<unknown>
}

/**
 * `ThemeFacade` — API minima theme read-only (MF-INT-THEME-01/02/03/04).
 *
 * Esposta a runtime context MF per query token/role correnti + inheritance check.
 * API estensibile in V2.1 (set token / subscribe theme change) — W1 minimal scope.
 *
 * @see D-V2-F13-08 — ThemeFacade minimal API
 */
export interface ThemeFacade {
  getToken(name: string): string | undefined
  getRole(name: string): string | undefined
  isInheriting(): boolean
}

/**
 * `IsolationResolvers` — Resolver pattern host-provided (AMENDMENT D-V2-F13-04-AMENDED).
 *
 * OQ-6 resolution: Service Locator F8 NON espone `SERVICE_GATEWAY` / `SERVICE_WORKER` /
 * `SERVICE_THEME` (i package v1.0/v1.1 NON si auto-registrano via `BrokerModule.install`).
 * Quindi factory `isolationModule({resolvers})` accetta callback host-provided per
 * lookup lazy delle service istanze.
 *
 * Coerente F11 2-opt factory D-V2-F11-18 (deliberata divergenza da F10 no-args
 * ratificata via OQ-3 — F11 needs `permissionMode`+`capabilityPolicy` setup-time;
 * F13 needs `resolvers` setup-time).
 *
 * `iframeLoader` opzionale → delegate F15 `@gluezero/mf-iframe` (W1 skeleton placeholder).
 *
 * @see D-V2-F13-04-AMENDED — Factory 2-opt resolver pattern
 * @see D-V2-F11-18 — F11 2-opt factory divergenza ratificata
 */
export interface IsolationResolvers {
  readonly gateway?: () => unknown | undefined
  readonly worker?: () => unknown | undefined
  readonly theme?: () => unknown | undefined
  readonly iframeLoader?: () => unknown | undefined
}
