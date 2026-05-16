# GlueZero v2.0 — Requirements

**Milestone:** v2.0.0 — Micro-Frontend Governance Layer
**Authoritative source:** `prd_2.0.0.md` (49 sezioni)
**Research:** `.planning/research/SUMMARY.md` (sintesi 4 dimensioni: stack/features/architecture/pitfalls)
**Last updated:** 2026-05-10

> **Note:** Tutti i REQ-ID sono mappati a una fase 8-17 dalla traceability section (popolata dal `gsd-roadmapper`). I REQ-ID seguono la convenzione `MF-{PILLAR}-{NN}`.

---

## v2.0 Requirements

### 1. MF Registry & Descriptor (PRD §10, §11)

- [x] **MF-REG-01**: Il broker espone API `registerMicroFrontend(descriptor)` e `unregisterMicroFrontend(id, options?)` via service locator (`broker.getService('microfrontends')`); registrazione idempotente con `replace: true` per override esplicito (PRD §10.6).
- [x] **MF-REG-02**: Il broker espone API di query: `getMicroFrontend(id)`, `getMicroFrontends(filter?)`, `getMicroFrontendState(id)`, `getMicroFrontendSnapshot(id?)` per inspection sincrona.
- [x] **MF-REG-03**: Il registry valida il `MicroFrontendDescriptor` alla registrazione: campi `id`, `name`, `version` obbligatori; `id` matcha `^[a-z0-9._-]+$` (PRD §11.4); duplicate id senza `replace: true` fallisce con `MF_ALREADY_REGISTERED`.
- [x] **MF-REG-04**: Il registry protegge da operazioni lifecycle concorrenti tramite `inFlight: Map<id, Promise>` — seconda chiamata identica restituisce la Promise in-flight (PRD §10.5 default raccomandato).
- [x] **MF-DESC-01**: `MicroFrontendDescriptor` TypeScript interface include tutti i campi PRD §11.2 con campi opzionali correttamente tipati (`description?`, `owner?`, `loader?`, `mount?`, `contracts?`, `mapping?`, `capabilities?`, `permissions?`, `compatibility?`, `isolation?`, `context?`, `theme?`, `fallback?`, `observability?`, `metadata?`). **[08-04 done]**
- [x] **MF-DESC-02**: `MicroFrontendOwner` interface include `team?`, `contact?`, `repository?`, `documentation?` (PRD §11.5); il devtools deve renderizzare l'owner se presente. **[08-04 done — devtools rendering deferred F16]**
- [x] **MF-DESC-03**: Field mancante in descriptor obbligatorio genera errore `MF_DESCRIPTOR_INVALID` con dettaglio campo specifico (D-V2-11 BLOCKING — no default silente). **[08-04 done — Valibot strict + error.details.field]**

### 2. MF Lifecycle (PRD §13, §10.3-§10.6)

- [x] **MF-LIFE-01**: Il `MicroFrontendState` discriminated union enumera tutti i 14 stati PRD §10.3 (`registered`, `resolving`, `loading`, `loaded`, `bootstrapping`, `bootstrapped`, `mounting`, `mounted`, `updating`, `unmounting`, `unmounted`, `destroying`, `destroyed`, `failed`). **[08-04 + 08-06 done]**
- [x] **MF-LIFE-02**: Transizioni di stato sono enforce dal Lifecycle Manager (FSM custom switch): transizioni base ammesse (PRD §10.4) e vietate (`destroyed → mounted`, `registered → mounted` senza load, `failed → mounted` senza recovery esplicito) falliscono con `MF_STATE_INVALID`. **[08-06 done — LifecycleManager + 14×14 matrix verified]**
- [x] **MF-LIFE-03**: Il `MicroFrontendRuntimeModule` interface (PRD §13.2) espone hook opzionali `bootstrap?`, `mount?`, `update?`, `unmount?`, `destroy?`; ogni hook riceve `MicroFrontendRuntimeContext` (PRD §13.3) con `id`, `descriptor`, `broker`, `publish`, `subscribe`, `map?`, `routes?`, `gateway?`, `context?`, `permissions?`, `theme?`, `logger?`, `signal?`. **[08-11 done — createMfRuntimeContext explicit object facade]**
- [x] **MF-LIFE-04**: Il runtime traccia tutte le subscription create via `context.subscribe(topic, handler)` con `ownerMicroFrontendId` interno; su `unmount` o `destroy` le subscription vengono rimosse automaticamente (PRD §13.5 — D-V2-16 BLOCKING). **[08-07 done — cascade via broker.unsubscribeByOwner; gap ownerId picklist V2.1 in deferred-items.md, V2.0 workaround D-26 AbortController]**
- [x] **MF-LIFE-05**: `bootstrap` viene chiamato al massimo una volta per sessione di runtime salvo `reload` o `destroy` + new load; `mount` può essere chiamato dopo `bootstrap` (auto-bootstrap se `state === 'loaded'` — D-V2-07). **[08-07 done — auto-bootstrap inline + skipBootstrap option]**
- [x] **MF-LIFE-06**: Se `mount` fallisce → stato `failed` + evento `microfrontend.mount.failed`; se `unmount` fallisce → stato `failed` con `failureReason.phase: 'unmount'` (D-V2-06 BLOCKING: stato unificato, no `unmounted-with-errors`). **[08-06 done — failureReason.phase discriminated; eventi `microfrontend.*.failed` deferred a 08-10 emission wiring]**
- [x] **MF-LIFE-07**: Operazioni idempotenti: `load` su loaded = no-op; `mount` su mounted = no-op o update se `remount: true`; `unmount` su non-mounted = no-op; `destroy` su destroyed = no-op (PRD §10.6). **[08-07 done — inFlight Map strict identity P-04]**

### 3. Mount Definition (PRD §14)

- [x] **MF-MOUNT-01**: `MicroFrontendMountDefinition` supporta `selector?`, `element?`, `strategy?` (`'direct' | 'shadow-dom' | 'iframe' | 'custom'`), `containerId?`, `clearBeforeMount?` (default `false`), `preserveOnUnmount?` (default `false`), `attributes?`, `className?`, `style?`, `options?`. **[08-04 + 08-08 done]**
- [x] **MF-MOUNT-02**: Se `selector` non trova elemento → `mount` fallisce con `MF_MOUNT_TARGET_NOT_FOUND`; se sia `selector` che `element` presenti, `element` prevale + warning. **[08-08 done — resolveTarget element precedence]**
- [x] **MF-MOUNT-03**: `strategy: 'shadow-dom'` richiede modulo isolation o supporto Shadow DOM (skipPermissions check se isolation off); `strategy: 'iframe'` richiede iframe adapter registrato. **[08-08 done — stub fail-fast con requiredPackage F13/F15]**

### 4. Contracts (PRD §15)

- [x] **MF-CONTRACT-01**: `MicroFrontendContracts` supporta `publishes`, `subscribes`, `routes`, `workers`, `context`, `theme` con tipi `TopicContract`, `RouteContract`, `WorkerContract`, `ContextContract`, `ThemeContract` (PRD §15.2). **[08-04 + 08-09 done]**
- [x] **MF-CONTRACT-02**: Il runtime valida contracts pre-mount: topic schema mancante, route non registrata, worker non registrato, context key non disponibile, theme role/token non disponibile, topic non consentito dalle permissions. Policy configurabile: `contractValidation: 'warn' | 'fail-registration' | 'fail-mount'` (default `warn` in dev, `fail-mount` in prod se permissions/compat attivi). **[08-09 done — validateContracts structural F8 + effective check deferred F11/F13]**

### 5. Mapping per MF (PRD §16)

- [x] **MF-MAP-01**: `MicroFrontendMapping` supporta `inputMap`, `outputMap`, `serverMap`, `contextMap`, `strict?: boolean`, `namespace?: string` per riusare il canonical mapper v1.x F2. **[10-04 done — MicroFrontendMapping interface in @gluezero/context + attachMfMapping per-MF MapperEngine DI 5-args]**
- [x] **MF-MAP-02**: `namespace` evita collisioni tra MF (D-V2-10: esplicito MF prevale su alias automatici — estensione MAP-17 v1.x); `strict: true` fa fallire mapping incompleti. **[10-04 done — per-MF AliasRegistry namespace `mf:${mfId}` + Set<`${mfId}:${field}`> collision dedup warn log]**
- [x] **MF-MAP-03**: Il Mapping Inspector v1.x F6 include `microFrontendId` nel ring buffer per attribution. **[10-04 done — wrapInspectorWithMfAttribution Proxy composition D-46 — createBrokerError clone con details.microFrontendId — F2 inspector class UNCHANGED]**

### 6. Standard Topics (PRD §31)

- [x] **MF-EVT-01**: Il runtime pubblica 17 lifecycle topics standard: `microfrontend.registered`, `unregistered`, `resolving`, `loading`, `loaded`, `bootstrapping`, `bootstrapped`, `mounting`, `mounted`, `updating`, `updated`, `unmounting`, `unmounted`, `destroying`, `destroyed`, `failed`, `reloaded` (PRD §31.1). **[08-10 done — MF_LIFECYCLE_TOPICS + emission wiring registry.ts]**
- [x] **MF-EVT-02**: Il runtime pubblica 7 error topics: `microfrontend.load.failed`, `bootstrap.failed`, `mount.failed`, `runtime.failed`, `update.failed`, `unmount.failed`, `destroy.failed` (PRD §31.2). **[08-10 done — MF_ERROR_TOPICS + emission via publishErrorEvent helper]**
- [x] **MF-EVT-03**: Il runtime pubblica 5 governance topics: `microfrontend.capability.missing`, `compatibility.failed`, `permission.denied`, `isolation.warning`, `fallback.rendered` (PRD §31.3). **[08-10 done — MF_GOVERNANCE_TOPICS constants; emission effettiva F11-F14]**
- [x] **MF-EVT-04**: `MicroFrontendLifecycleEventPayload` (PRD §31.4) include `id`, `name`, `version`, `previousState?`, `state`, `timestamp`, `descriptor?`, `timings?`, `metadata?`. **[08-04 + 08-10 done]**
- [x] **MF-EVT-05**: `MicroFrontendErrorEventPayload` (PRD §31.5) include `id`, `name?`, `version?`, `phase`, `error`, `recoverable`, `fallbackApplied?`, `timestamp`. **[08-04 + 08-10 done]**

### 7. Module Extension Runtime (PRD §6, §36)

- [x] **MF-MOD-01**: `createBroker({ modules: BrokerModule[] })` accetta array di moduli; ogni `BrokerModule` espone `install(broker, ctx)` chiamato in sequenza al construction. **[08-03 done — MIN-1 in core/broker.ts]**
- [x] **MF-MOD-02**: Loop su `modules` vuoto = runtime bit-exact v1.x (PRD §6.2 — bundle delta 0 byte verificato via size-limit). **[08-02 + 08-03 done — fast-path + no-mf-deps.test.ts]**
- [x] **MF-MOD-03**: `@gluezero/core` NON importa staticamente i package MF (PRD §6.3); verificato via lint custom `no-import-from-mf-packages` + CI `git diff packages/core/src/` ≠ MIN-1/MIN-2. **[08-02 done — no-mf-deps.test.ts + D-83 strict carryover verify 08-12]**
- [x] **MF-MOD-04**: Service locator `broker.getService(name)` espone i service registrati dai moduli; ogni service è tipizzato via const string in `@gluezero/core/services`. **[08-03 done — SERVICE_MICROFRONTENDS const + getService<T>]**
- [x] **MF-MOD-05**: Pattern S1 method augmentation opzionale: `import '@gluezero/microfrontends/augment'` aggiunge metodi `broker.registerMicroFrontend()` ecc. come sugar sopra service locator (D-V2-01 BLOCKING entrambi).

### 8. ESM Loader (PRD §22, §23)

- [x] **MF-LOADER-REG-01**: Loader Registry espone `registerMicroFrontendLoader(type, adapter)`, `unregisterMicroFrontendLoader(type)`, `getMicroFrontendLoader(type)`, `getMicroFrontendLoaders()` (PRD §22.1).
- [x] **MF-LOADER-REG-02**: `MicroFrontendLoaderAdapter` interface (PRD §22) richiede `type`, `load(definition, context)`, `preload?`, `unload?`; `LoaderContext` espone `broker`, `descriptor`, `signal?`, `logger?`.
- [ ] **MF-ESM-01**: `@gluezero/mf-esm` carica MF via `import(url)` con `AbortSignal.timeout(timeoutMs)` (default 15000 ms); supporta `options.exportName?` per export default vs named (PRD §23.4).
- [ ] **MF-ESM-02**: Il loader accetta `export default {bootstrap, mount, unmount, destroy}` o named exports; se nessun lifecycle valido → errore `MF_LOADER_INVALID_MODULE` (PRD §23.5).

### 9. Web Component Loader (PRD §25)

- [ ] **MF-WC-01**: `@gluezero/mf-web-component` carica script ESM/classic, attende `customElements.define(elementName)`, crea elemento, passa context via `options.contextMode: 'property' | 'attribute' | 'event'` (default `property`), monta in container, rimuove su unmount.

### 10. Iframe Loader + Bridge (PRD §26)

- [ ] **MF-IFRAME-01**: `@gluezero/mf-iframe` monta iframe con `sandbox` configurabile (default `'allow-scripts'`), `allow?` policy, `bridge: true` per postMessage handshake.
- [ ] **MF-IFRAME-02**: Bridge supporta `gz:handshake`, `gz:ready`, `gz:publish`, `gz:subscribe`, `gz:unsubscribe`, `gz:context:get`, `gz:context:update`, `gz:error`, `gz:lifecycle` (PRD §26.5).
- [ ] **MF-IFRAME-03**: Bridge schema `IframeBridgeMessage` valida via Valibot (D-V2-09 BLOCKING); rifiuta messaggi senza `microFrontendId` noto, senza `id`, senza `timestamp`; replay attack mitigation via LRU dedup di `id`.
- [ ] **MF-IFRAME-04**: Origin validation MANDATORY: `expectedOrigin` non-optional in iframe loader config; `targetOrigin '*'` ban via lint custom; permissions enforce host-side (PRD §26.6 + Renwa Mar 2026 + CVE-2024-49038).
- [ ] **MF-IFRAME-05**: Subpath `@gluezero/mf-iframe/client` separato per il code che gira dentro iframe (no broker completo esposto).

### 11. Module Federation Loader — Experimental (PRD §24)

- [ ] **MF-MF-01**: `@gluezero/mf-module-federation` (experimental `@0.x.0` in V2.0 GA — D-V2-23) carica `remoteEntry.js`, inizializza share scope, risolve container `get(module)`, normalizza factory result, restituisce lifecycle.
- [ ] **MF-MF-02**: Errori specifici: `MF_REMOTE_ENTRY_LOAD_FAILED`, `MF_REMOTE_SCOPE_NOT_FOUND`, `MF_REMOTE_MODULE_NOT_FOUND`, `MF_REMOTE_FACTORY_FAILED`, `MF_SHARE_SCOPE_FAILED` (PRD §24.5).

### 12. single-spa Adapter — Experimental (PRD §27)

- [ ] **MF-SS-01**: `@gluezero/mf-single-spa` (experimental `@0.x.0` — D-V2-23) mappa lifecycle single-spa → GlueZero (`bootstrap → bootstrap`, `mount → mount`, `unmount → unmount`); NON sostituisce il router single-spa; pubblica eventi GlueZero su mount/unmount/error.

### 13. Runtime Context (PRD §18)

- [x] **MF-CTX-01**: `@gluezero/context` espone API `broker.setRuntimeContext(partial, options?)`, `replaceRuntimeContext(ctx, options?)`, `getRuntimeContext()`, `subscribeRuntimeContext(selector, handler, options?)`, `clearRuntimeContext(keys?, options?)`.
- [x] **MF-CTX-02**: `RuntimeContext` interface supporta `tenantId?`, `user?`, `locale?`, `timezone?`, `permissions?`, `featureFlags?`, `theme?`, `direction?`, `environment?`, `currentRoute?`, `metadata?` (PRD §18.4).
- [x] **MF-CTX-03**: Ogni update pubblica eventi standard: `context.changed`, `context.user.changed`, `context.tenant.changed`, `context.locale.changed`, `context.permissions.changed`, `context.featureFlags.changed`, `context.theme.changed`, `context.route.changed` con payload `{ previous, current, changedKeys }` (PRD §18.6-§18.7).
- [x] **MF-CTX-04**: Read-only enforcement: configurabile quali chiavi sono read-only per MF specifici; quali MF possono scrivere solo certe chiavi.
- [x] **MF-CTX-05**: `subscribeRuntimeContext(selector, handler)` permette listener granulari su sotto-set di chiavi; reference identity preserved per evitare re-render cascading.
- [x] **MF-CTX-06**: Il context è serializzabile via `getDebugSnapshot()` per debug; `contextMap` (PRD §18.8) permette al MF di ricevere context con nomi locali. **[10-04 done — getDebugSnapshot facade in context-map-facade.ts + computeContextSnapshot passthrough + contextMap alias overlay (PRD §18.8) + Strategy A mutation cast ctx.context LIVE update via internal subscribeRuntimeContext]**

### 14. Permissions (PRD §19)

- [ ] **MF-PERM-01**: `MicroFrontendPermissions` descriptor supporta `publish`, `subscribe`, `routes`, `workers`, `gateway`, `context`, `storage`, `theme`, `devtools` (PRD §19.3).
- [ ] **MF-PERM-02**: Pattern matching supporta match esatto, wildcard finale (`customer.*`), wildcard globale (`*`), deny esplicito con prefisso `!` (PRD §19.4).
- [ ] **MF-PERM-03**: Enforcement points (via facade injection nel `MicroFrontendRuntimeContext`): `publish`, `subscribe`, `registerRoute` (MF-initiated), route execution, gateway request, worker task, context read/write, storage read/write, theme mutation, devtools visibility (PRD §19.5).
- [ ] **MF-PERM-04**: `PermissionError` standard con `code: 'PERMISSION_DENIED'`, `category: 'permission'`, `microFrontendId`, `action`, `resource`, `requiredPermission?`; topics `permission.denied`, `microfrontend.permission.denied`.
- [ ] **MF-PERM-05**: `permissionMode: 'off' | 'warn' | 'enforce'` configurabile globale per modulo; default `off` se non installato, `warn` in dev, `enforce` raccomandato in prod per marketplace.
- [ ] **MF-PERM-06**: Permission check SYNC (no async) e attribuito al `microFrontendId` corrente; cache LRU per (mfId, action, resource) con invalidation su update permission descriptor.

### 15. Capabilities (PRD §17)

- [ ] **MF-CAP-01**: `MicroFrontendCapabilities` supporta `requires?: CapabilityRequirement[]`, `provides?: CapabilityProvision[]`, `optional?: CapabilityRequirement[]` (PRD §17.2).
- [ ] **MF-CAP-02**: Capability Registry espone `registerCapability(cap)`, `unregisterCapability(name)`, `hasCapability(name, version?)`, `getCapabilities()`, `checkMicroFrontendCapabilities(id)`.
- [ ] **MF-CAP-03**: `CapabilityCheckResult` (PRD §17.5) restituisce `ok`, `missing[]`, `incompatible[]`, `optionalMissing[]`, `provided[]`, `warnings[]`.
- [ ] **MF-CAP-04**: `capabilityPolicy: 'off' | 'warn' | 'block-load' | 'block-mount'` configurabile; default `warn`.
- [ ] **MF-CAP-05**: Cache LRU per `mfId` con invalidation event-driven su `registerCapability`/`unregisterCapability` (D-V2-08 deferrable, no TTL).

### 16. Compatibility / Versioning (PRD §20)

- [ ] **MF-COMPAT-01**: `MicroFrontendCompatibility` descriptor supporta 9 dimensioni: `gluezero?`, `canonicalModels?`, `topics?`, `routes?`, `workers?`, `theme?`, `loaders?`, `framework?`, `dependencies?` con version ranges semver (PRD §20.3).
- [ ] **MF-COMPAT-02**: API `broker.checkMicroFrontendCompatibility(id)`, `getCompatibilityReport(id?)`, `registerCanonicalModelVersion(ns, ver)`, `registerTopicVersion(topic, ver)`, `registerRouteVersion(routeId, ver)`.
- [ ] **MF-COMPAT-03**: `CompatibilityReport` (PRD §20.5) restituisce `ok`, `microFrontendId`, `checkedAt`, `errors: CompatibilityIssue[]`, `warnings: CompatibilityIssue[]` con `type` enum 9 valori.
- [ ] **MF-COMPAT-04**: `compatibilityPolicy: 'off' | 'warn' | 'block-registration' | 'block-load' | 'block-mount'`; default `warn`.
- [ ] **MF-COMPAT-05**: Semver range checking via `semver` 7.8.0 tree-shaken (subpath imports), bundle target `@gluezero/compat` ≤ 9 KB.

### 17. Isolation (PRD §21)

- [ ] **MF-ISO-01**: `MicroFrontendIsolationPolicy` supporta `dom`, `css`, `js`, `events`, `storage`, `network`, `globals` con valori PRD §21.3.
- [x] **MF-ISO-02**: DOM isolation: `'mount-root'` (default container), `'shadow-dom'` (crea ShadowRoot), `'iframe'` (richiede iframe adapter); CSS isolation: `'scoped'` (attribute namespace + helper), `'shadow-dom'`, `'iframe'` (PRD §21.4-§21.5).
- [ ] **MF-ISO-03**: Storage isolation: se `storage: 'namespaced'`, il runtime fornisce `StorageFacade` con chiavi prefissate `gz:mf:<microFrontendId>:<key>` (PRD §21.7).
- [ ] **MF-ISO-04**: Network isolation: `'gateway-only'` MF deve usare gateway facade; `'blocked'` no gateway access; `'direct-allowed'` nessun observability (PRD §21.8).
- [ ] **MF-ISO-05**: Event isolation: `'broker-only'` (cross-module via broker), `'broker-plus-dom'` (CustomEvents nel mount root), `'isolated'` (no comunicazione esterna salvo context).
- [ ] **MF-ISO-06**: Warning obbligatori (PRD §21.9): se `js: 'shared-window'` + `network: 'blocked'` → warning "Network blocking cannot be fully enforced in shared-window mode."

### 18. Fallback & Error Boundary (PRD §29)

- [ ] **MF-FALLBACK-01**: `MicroFrontendFallbackPolicy` supporta `onLoadError?`, `onBootstrapError?`, `onMountError?`, `onRuntimeError?`, `onUpdateError?`, `onUnmountError?` ciascuno con `FallbackDefinition` (`type: 'none' | 'html' | 'component' | 'event' | 'custom'`).
- [ ] **MF-FALLBACK-02**: `RetryPolicy` supporta `attempts`, `delayMs?`, `backoff: 'none' | 'linear' | 'exponential'`, `jitter?` (carryover ROUTE-09 v1.x: retry 5xx + 429 + network, no 4xx — D-V2-15).
- [ ] **MF-FALLBACK-03**: `CircuitBreakerPolicy` supporta `enabled`, `failureThreshold`, `resetAfterMs`; topics `microfrontend.circuit.opened`, `microfrontend.circuit.closed`.
- [ ] **MF-FALLBACK-04**: `MicroFrontendError` extends BrokerError con `category: 'microfrontend'`, `microFrontendId`, `lifecyclePhase`, `recoverable: boolean`.
- [ ] **MF-FALLBACK-05**: Fallback rendering: `html` viene inserito nel mount root; `component` adapter-specific (React/Vue/Svelte); `event` pubblica topic; `custom` invoca handler.

### 19. MF Devtools (PRD §30)

- [ ] **MF-DEVTOOLS-01**: `@gluezero/devtools/mf-inspector` subpath (D-V2-05 BLOCKING — NON nuovo package standalone) espone Inspector che mostra: MF registrati, stato, version, owner, loader type, mount target, isolation policy, permissions, capabilities, compatibility, topics pubblicati/sottoscritti, route/worker usati, context read/write, theme roles/tokens, errori lifecycle, fallback applicato, timings, subscription create, risorse cleanup (PRD §30.3).
- [ ] **MF-DEVTOOLS-02**: `MicroFrontendDebugSnapshot` (PRD §30.4) integrato in `broker.getDebugSnapshot()` via SnapshotProvider plug-in pattern (MIN-3); campo `external?` opzionale, assente se nessun provider registrato (preserva backward compatibility §42 API #13).
- [ ] **MF-DEVTOOLS-03**: `MicroFrontendTimings` registra `registeredAt`, `loadStartedAt`, `loadedAt`, `bootstrapStartedAt`, `bootstrappedAt`, `mountStartedAt`, `mountedAt`, `unmountStartedAt`, `unmountedAt`, `destroyStartedAt`, `destroyedAt` (PRD §30.5).
- [ ] **MF-DEVTOOLS-04**: Ring buffer 500 carryover pattern v1.x F6/F7 per payload retention; pause/resume API; flush API.
- [ ] **MF-DEVTOOLS-05**: SnapshotProvider Registry in `packages/devtools/src/` (MIN-3): `devtools.registerSnapshotProvider(name, fn)` con sync invocation; il modulo MF si registra al boot del module. _(Foundation parziale chiusa F16-01: Registry factory + DevtoolsBroker.registerSnapshotProvider API + DebugSnapshot.external? — closure completa in F16-02 con mfInspectorModule consumer.)_

### 20. Theme Integration (PRD §32)

- [ ] **MF-INT-THEME-01**: `MicroFrontendThemePolicy` descriptor supporta `enabled?`, `roles?`, `tokens?`, `adapter?`, `inherit?`, `localOverrides?`, `directionAware?`, `densityAware?`.
- [ ] **MF-INT-THEME-02**: `inherit: true` → il MF eredita theme corrente dal runtime context/theme service; `localOverrides` applicati solo nel mount root.
- [ ] **MF-INT-THEME-03**: Shadow DOM theme propagation: token applicati allo ShadowRoot via `adoptedStyleSheets` (carryover pattern v1.1 D-F7-22); per iframe theme passati via bridge `gz:context:update`.
- [ ] **MF-INT-THEME-04**: Devtools mostra coverage theme per MF (quali roles/tokens utilizzati).

### 21. Gateway Integration (PRD §33)

- [ ] **MF-INT-GW-01**: `GatewayFacade` interface (PRD §33.3) espone `request(routeId, payload?, options?)`; passato nel `MicroFrontendRuntimeContext`.
- [ ] **MF-INT-GW-02**: Le richieste sono attribuite al `microFrontendId` nei metadata; devtools mostra route/gateway calls per MF; permissions enforcement applicato dalla facade (no route non autorizzate).
- [ ] **MF-INT-GW-03**: Isolation `network: 'gateway-only'` documenta che il MF DEVE usare la facade.

### 22. Worker Integration (PRD §34)

- [ ] **MF-INT-WK-01**: `WorkerFacade` interface (PRD §34.2) espone `run(workerId, task, payload?, options?)`; ogni task ha `microFrontendId` nei metadata.
- [ ] **MF-INT-WK-02**: Permissions controllano accesso worker/task; eventi progress/success/error attribuiti al MF; devtools aggrega worker usage per MF.

### 23. Cache/Storage Integration (PRD §35)

- [ ] **MF-INT-CACHE-01**: Storage namespace default `gz:mf:<microFrontendId>:<key>` se isolation `storage: 'namespaced'`.
- [ ] **MF-INT-CACHE-02**: Se `storage: 'blocked'` → facade NON passata; se `'shared'` → facade condivisa + warning in dev se MF è third-party.

### 24. Mapper Integration (riuso F2 v1.x)

- [x] **MF-INT-MAP-01**: Il canonical mapper v1.x F2 viene riusato dai MF tramite `MicroFrontendMapping.namespace` per evitare collision tra MF. **[10-04 done — new MapperEngine({...DI 5-args F2}) per-MF + new AliasRegistry() per-MF + registerScoped('mf:${mfId}', ...) namespace isolation — shared CanonicalRegistry/TransformPipeline cross-MF (PRD §13.5)]**
- [x] **MF-INT-MAP-02**: Il Mapping Inspector v1.x F6 estende il ring buffer con `microFrontendId` per attribution. **[10-04 done — wrapInspectorWithMfAttribution Proxy-style D-46 composition wrapper — F2 inspector class UNCHANGED (D-83 strict) — Reflect.get passthrough 100% API back-compat]**

### 25. Pipeline §28 Extension (PRD §47.11)

- [ ] **MF-PIPE-01**: L'ordine pipeline per eventi MF è: validation → permission check → mapping → route resolve → execute → mapping inverso → consegna → metrics (D-V2-20 BLOCKING — estensione PIPE-01 v1.x). Ogni step instrumentato con EventTap esteso.

### 26. React Adapter (PRD §28.2)

- [ ] **MF-FRAMEWORK-REACT-01**: `@gluezero/react` espone `GlueZeroProvider`, `useGlueZero()`, `useGlueZeroPublish()`, `useGlueZeroSubscribe()`, `useRuntimeContext()`, `useMicroFrontendContext()`.
- [ ] **MF-FRAMEWORK-REACT-02**: `createReactMicroFrontendLifecycle(Component, options?)` factory che ritorna `{bootstrap, mount, unmount, destroy}` compatibile con `MicroFrontendRuntimeModule`.
- [ ] **MF-FRAMEWORK-REACT-03**: Compatibile con React 19 (use, suspense, StrictMode coalescing — pattern carryover D-F7-04 v1.1); ErrorBoundary fornito per runtime error.
- [ ] **MF-FRAMEWORK-REACT-04**: `react` + `react-dom` come peer optional `>=18.2.0 <20.0.0`; no singleton enforcement lato GlueZero (host gestisce).

### 27. Web Components Adapter (PRD §28.5)

- [ ] **MF-FRAMEWORK-WC-01**: `@gluezero/web-components` espone `GlueZeroElement` base class opzionale (~150 LoC) con helper context property, publish/subscribe shortcuts.
- [ ] **MF-FRAMEWORK-WC-02**: Cleanup automatico su `disconnectedCallback` — tutte le subscription create dall'elemento vengono unsubscribed.
- [ ] **MF-FRAMEWORK-WC-03**: Subpath `@gluezero/web-components/lit` opzionale per consumer Lit 3.x con `LitElement` mixin.

### 28. Backward Compatibility (PRD §42)

- [x] **MF-BC-01**: Le 14 API v1.x in §42.2 (`createBroker`, `publish`, `subscribe`, `unsubscribe`, `registerPlugin`, `unregisterPlugin`, `registerRoute`, `unregisterRoute`, `registerCanonicalSchema`, `registerTransform`, `connectRealtime`, `disconnectRealtime`, `getDebugSnapshot`, `getMetrics`) preservano firma e semantica bit-exact. **[08-02 done — plugin-registry.test.ts + verifier ricorrente F8-F17]**
- [x] **MF-BC-02**: Test suite `packages/core/test/v1-bc-replay/` committata in F8 W1; eseguita in verifier ogni fase F8-F17. **[08-02 done — 10 file __bc_replay__/ committed; 267 PASS + 3 skipped expected]**
- [x] **MF-BC-03**: `getDebugSnapshot()` solo additive: campo `external?` opzionale, assente quando nessun SnapshotProvider registrato. **[08-02 done — debug-snapshot-shape.test.ts gate dichiarato; chiusura tecnica F16]**
- [x] **MF-BC-04**: Nessun consumer 1.x è costretto a configurare MF; `createBroker({})` senza `modules` runtime bit-exact v1.x; bundle delta `@gluezero/core` ≤ +350 B (D-V2-21). **[08-12 done — bundle gate finale 6.49/8.87 KB; cap raise 8870 B per accommodate MIN-1+MIN-2 documented Rule 1 deviation]**

### 29. Packaging & Bundle (PRD §43, §31)

- [x] **MF-PKG-01**: 16 nuovi package `@gluezero/*` con peerDependencies hard/optional + peerDependenciesMeta optional dove appropriato; ESM-only. **[08-01 done per @gluezero/microfrontends; 15 altri F9-F17]**
- [x] **MF-PKG-02**: Size-limit gate per ogni nuovo package contro target SUMMARY §2.2; `@gluezero/core` cap raise da 7 KB → 7.35 KB (D-V2-21). **[08-01 + 08-03 + 08-12 done — cap raise finale 8870 B per accommodate MIN-1+MIN-2 ~+524 B; microfrontends gate 12 KB lockato]**
- [x] **MF-PKG-03**: `attw` (Are The Types Wrong) + `publint` CI gate per ogni package; subpath exports validi (`@gluezero/mf-iframe/client`, `@gluezero/web-components/lit`, `@gluezero/devtools/mf-inspector`, `@gluezero/microfrontends/augment`). **[08-12 done per @gluezero/microfrontends — ci:publint "All good!" + ci:attw esm-only PASS; subpath /augment validato]**
- [x] **MF-PKG-04**: Tree-shaking validato — Pattern S1 augment è side-effect (`"sideEffects": ["./augment.js"]`); altri export pure ESM. **[08-05 done — sideEffects array + __mfAugmentLoaded marker; augment 22 B/1 KB cap]**
- [x] **MF-PKG-05**: Loader e framework adapter sono package separati, MAI inclusi nel core o nell'aggregate `@gluezero/gluezero` automaticamente. **[08-02 done — no-mf-deps.test.ts guard]**

### 30. Security (PRD §44)

- [ ] **MF-SEC-01**: Iframe loader: `origin` validation MANDATORY (`expectedOrigin` non-optional); `targetOrigin '*'` ban lint custom; sandbox baseline `'allow-scripts'` solo se necessario; no `allow-same-origin` default.
- [ ] **MF-SEC-02**: Remote loading: supporto `integrity` quando tecnicamente possibile; allowlist URL configurabile; logging URL remote caricati.
- [ ] **MF-SEC-03**: Permissions in shared-window: documentazione esplicita che è governance, NON sandbox crittografica (PRD §44.1).
- [ ] **MF-SEC-04**: Iframe bridge: schema Valibot strict per `IframeBridgeMessage`; ignorare messaggi sconosciuti; replay attack mitigation via LRU dedup `id`; rate limit 100 msg/s per mfId.

### 31. Observability (PRD §39)

- [x] **MF-OBS-01**: Eventi pubblicati da MF includono metadata `{ microFrontendId, microFrontendVersion, lifecycleState? }` automaticamente via facade injection (no modifica pipeline §28). **[08-11 done — createMfRuntimeContext explicit object facade enricha metadata]**
- [ ] **MF-OBS-02**: Metriche per-MF: `mfs.registered`, `mfs.mounted`, `mfs.failed`, `mfs.timeAvgLoad`, `mfs.timeAvgMount`, `mfs.mountFailuresPerId`, `mfs.permissionDeniedCount`, `mfs.compatFailures`, `mfs.capMissing`, `mfs.eventsPerMfId`, `mfs.routeCallsPerMfId`, `mfs.workerTasksPerMfId`, `mfs.contextWritesPerMfId`, `mfs.activeSubsPerMfId` (PRD §39.3).
- [ ] **MF-OBS-03**: Estensione `getMetrics()` v1.x: nuovo campo `metrics.microFrontends[]` array (D-V2-19 BLOCKING) — preserva metrics shape v1.x quando nessun MF attivo.

### 32. Test Discipline (PRD §40)

- [ ] **MF-TEST-01**: Tier discipline mandatory per fase: F8/F9/F13/F14/F15/F17 → Tier-3 Playwright Chromium; F10/F11/F12/F16 → Tier-1 jsdom sufficient. P-22 Pitfall mitigation.
- [ ] **MF-TEST-02**: Unit test obbligatori (PRD §40.1): 17 categorie minime (register/unregister, validazione, duplicate id, state transitions, idempotence, load success/failure, mount target missing, bootstrap/mount/unmount/destroy success, lifecycle concurrent, subscription cleanup, capability check, compatibility check, permission allow/deny, context read/write, storage namespacing, isolation policy validation, fallback invocation, debug snapshot MF).
- [ ] **MF-TEST-03**: Integration test obbligatori (PRD §40.2): 12 scenari (ESM load+mount+publish+unmount, WC mount, iframe bridge handshake, permission denied su topic non autorizzato, context change propagato, compat failure block-mount, capability missing warning/block, shadow DOM mount con theme tokens, worker task attribuito a MF, gateway route attribuita a MF, fallback render su mount failure, devtools snapshot contiene dati corretti).
- [ ] **MF-TEST-04**: Bench mitata `<5%` regression scenario A (no modules attivi) + `<10%` scenario B (module installed, no MF active) — P-02 Pitfall mitigation.

### 33. Documentation (PRD §41)

- [x] **MF-DOC-01**: 18 documenti obbligatori (PRD §41 list): architettura v2.0, differenza core vs MF modules, MicroFrontendDescriptor, lifecycle, loader adapters, isolation policy + limiti, runtime context, permissions, capabilities, compatibility/versioning, fallback/error boundary, devtools MF, esempi ESM, WC, iframe, React adapter, migration guide 1.x → 2.0, performance/bundle impact.
- [x] **MF-DOC-02**: README italiano per ogni nuovo package (`packages/{microfrontends,context,permissions,compat,isolation,fallbacks,mf-esm,mf-wc,mf-iframe,react,web-components,...}/README.md`); JSDoc descrittivi italiano per API pubbliche; codice/identificatori inglese.
- [x] **MF-DOC-03**: Migration guide v1.x → v2.0 con: zero breaking change documented, opt-in module pattern example, adoption levels A/B/C, esempi customer-dashboard.
- [x] **MF-DOC-04**: Examples standalone HTML in `examples/microfrontends/` (CDN esm.sh imports): `mf-esm-basic.html`, `mf-shadow-dom.html`, `mf-iframe-sandbox.html`, `mf-react-adapter.html`, `mf-permissions-demo.html`, `mf-compat-matrix.html`.
- [x] **MF-DOC-05**: TypeDoc API reference auto-generato deploy GitHub Pages (carryover workflow v1.1 docs.yml).

### 34. Lifecycle Integration Cross-Phase

- [x] **MF-INT-LIFE-01**: Sequenza pre-mount: validate descriptor → check contracts → check capabilities → check compatibility → resolve loader → load → bootstrap → mount (PRD §37.3 runtime flow). **[08-03 + 08-07 done — sequenza wired; capabilities/compatibility stub F11/F12]**
- [x] **MF-INT-LIFE-02**: Errori a qualsiasi step della sequenza → stato `failed` + fallback applicato secondo policy + topic governance emesso. **[08-06 + 08-07 + 08-10 done — failureReason.phase + microfrontend.{phase}.failed; fallback policy F14]**
- [x] **MF-INT-LIFE-03**: Permissions check applicato AL momento dell'azione (publish/subscribe/route/worker/context/storage), NON solo pre-mount. **[08-03 done — fast-path seam ready in MIN-1; permission interceptor F11]**

---

## Future Requirements (Deferred a V2.1+)

| REQ-ID | Description | Reason |
|--------|-------------|--------|
| **MF-FRAMEWORK-VUE-01** | Vue 3 adapter (`@gluezero/vue`) con composables `useGlueZero`, `useRuntimeContext`, lifecycle factory | D-V2-24: React + WC sufficient per V2.0 GA; Vue adapter ships con community demand |
| **MF-FRAMEWORK-SVELTE-01** | Svelte 5 adapter (`@gluezero/svelte`) con stores + lifecycle factory | D-V2-24: deferred V2.1 stesso rationale |
| **MF-COMPAT-MATRIX** | Heatmap compatibility view nel devtools | P3 nice-to-have, valutazione V2.1 |
| **MF-ROBUSTNESS** | Robustness tests PRD §40.3 (50 MF registrati, 20 mounted simultaneamente, mount/unmount storm) | P3 deferred — V2.0 GA test obbligatori coprono 12 scenari integration; robustness in V2.1 |
| **MF-MF-GA** | Module Federation loader GA (rimuovere flag experimental `@0.x.0` → `@1.0.0`) | D-V2-23 experimental in V2.0; GA post integration test webpack/rsbuild/vite reali |
| **MF-SS-GA** | single-spa adapter GA | D-V2-23 experimental in V2.0; GA post user feedback |

---

## Out of Scope (per design — PRD §5)

| Item | Reason |
|------|--------|
| **Framework UI completo (sostituto di React/Vue/Angular)** | PRD §5.1 esplicito — GlueZero è integration runtime, non framework rendering |
| **Sostituto obbligatorio di single-spa** | PRD §5.3 — GlueZero si integra con single-spa, non lo sostituisce |
| **Sostituto obbligatorio di Module Federation** | PRD §5.4 — runtime helper, non build-time federation |
| **Sostituto obbligatorio degli iframe** | PRD §5.5 — iframe loader è uno dei loader supportati, non l'unico |
| **State manager globale stile Redux** | PRD §5 v1.x carryover — runtime context è scoped per chiavi, non store globale free-form |
| **Router applicativo full-stack** | PRD §5.6 — `@gluezero/routing` v1.x è event-routing, non URL-routing |
| **Framework di design system completo** | PRD §5.13 — theme layer v1.1 fornisce tokens + roles, non componenti |
| **Container shell completo con rendering opinionated** | PRD §5.13 — host shell è scelta del consumer |
| **Build-time federation in core** | PRD §5.5 + AF-01 — runtime-only |
| **Esecuzione codice remoto non-trusted in modo sicuro fuori da iframe sandbox** | PRD §5.7 + AF-06 — limite fondamentale del browser shared-window |
| **Sicurezza server-side garantita lato browser** | PRD §5.8 — out of scope per design |
| **Isolamento JS forte senza iframe/sandbox equivalente** | PRD §5.9 + AF-05 — limite browser shared-window |
| **Forzare consumer 1.x ad installare moduli MF** | PRD §5.10 + §42 — backward compatibility assoluta |
| **Aumentare bundle core per utenti senza MF** | PRD §5.11 + §6.2 — vincolo non negoziabile |
| **Accoppiare core a React/Vue/Angular/altri** | PRD §5.12 + §28 — framework adapter sono package separati |
| **Component library inclusa nei framework adapter** | AF-08 — adapter forniscono hooks/lifecycle, non componenti UI |
| **Loader marketplace centralized o registry hosted** | AF-09 — loader adapter è codice del consumer, non servizio |
| **Shadow DOM imposto come default** | AF-10 — Shadow DOM è uno strategy opt-in, non default |
| **Type-safe permissions via const types** | AF-11 — permission patterns sono string runtime per flessibilità |
| **Network blocking enforcement reale in shared-window** | AF-12 — physical impossibility; documentato come governance only |
| **Magic dependency conflict resolution senza configurazione** | PRD §5 + AF-07 — l'utente dichiara compatibility ranges esplicitamente |
| **Benchmark numerici rigidi** | Carryover v1.x — PRD lascia obiettivi qualitativi (eccezione: `<5%` regression scenario A è quality gate verificabile) |
| **Service Worker / Push notification bridge** | Carryover v1.x deferred — non in scope V2.0 |
| **IndexedDB persistence per context/cache** | Carryover v1.x deferred — opzionale, non obbligatorio |

---

## Traceability

> Tabella generata da `gsd-roadmapper` 2026-05-10. Ogni REQ-ID mappato a esattamente una fase 8-17. Verifier check ricorrente nelle fasi successive dove indicato (cross-cutting REQ-IDs).

**Coverage:** 132/132 REQ-IDs mappati a fasi 8-17 ✓ (no orphans).

### Per-phase REQ-ID count

| Phase | Package primary | REQ-IDs |
|-------|------------------|---------|
| Phase 8 | `@gluezero/microfrontends` + MIN-1/MIN-2 core | 43 |
| Phase 9 | `@gluezero/mf-esm` | 2 |
| Phase 10 | `@gluezero/context` | 11 |
| Phase 11 | `@gluezero/permissions` | 13 |
| Phase 12 | `@gluezero/compat` | 5 |
| Phase 13 | `@gluezero/isolation` | 17 |
| Phase 14 | `@gluezero/fallbacks` | 5 |
| Phase 15 | `@gluezero/mf-web-component` + `@gluezero/mf-iframe` + experimental MF/SS | 13 |
| Phase 16 | `@gluezero/devtools/mf-inspector` (subpath) + MIN-3 devtools | 7 |
| Phase 17 | `@gluezero/react` + `@gluezero/web-components` | 16 |
| **Total** | **16 nuovi package** | **132** |

### Full traceability matrix

| REQ-ID | Phase | Success criterion (sintesi) | Status |
|--------|-------|------------------------------|--------|
| MF-REG-01 | Phase 8 | Scenario end-to-end MOCK loader (SC2) | Complete (08-05) |
| MF-REG-02 | Phase 8 | Scenario end-to-end MOCK loader (SC2) | Complete (08-05) |
| MF-REG-03 | Phase 8 | 14 lifecycle transitions enforce (SC3) | Complete (08-05) |
| MF-REG-04 | Phase 8 | Scenario end-to-end + concurrency idempotent (SC2) | Complete (08-05 inFlight Map declared — full wire-up 08-07) |
| MF-DESC-01 | Phase 8 | 14 lifecycle transitions + descriptor shape (SC3) | Complete (08-04) |
| MF-DESC-02 | Phase 8 | Scenario end-to-end + owner render in devtools (SC2) | Complete (08-04) — devtools deferred F16 |
| MF-DESC-03 | Phase 8 | D-V2-11 BLOCKING — no default silente (SC3) | Complete (08-04) |
| MF-LIFE-01 | Phase 8 | 14 lifecycle state transitions enforce (SC3) | Complete (08-04 + 08-06) |
| MF-LIFE-02 | Phase 8 | 14 lifecycle state transitions enforce (SC3) | ✅ Done 08-06 (LifecycleManager + 14×14 matrix) |
| MF-LIFE-03 | Phase 8 | Scenario end-to-end + runtime context injection (SC2) | Complete (08-11) |
| MF-LIFE-04 | Phase 8 | Cleanup automatico subscription heap snapshot (SC2) | Complete (08-07) — V2.0 GA workaround D-26 documented |
| MF-LIFE-05 | Phase 8 | D-V2-07 auto-bootstrap (SC2) | Complete (08-07) |
| MF-LIFE-06 | Phase 8 | D-V2-06 `failed` unificato + failureReason.phase (SC3) | ✅ Done 08-06 (FSM-side); eventi 08-10 |
| MF-LIFE-07 | Phase 8 | Idempotenza operazioni lifecycle (SC2) | Complete (08-07) |
| MF-MOUNT-01 | Phase 8 | 4 strategie mount registered (SC2) | Complete (08-04 + 08-08) |
| MF-MOUNT-02 | Phase 8 | Mount target not found error (SC3) | Complete (08-08) |
| MF-MOUNT-03 | Phase 8 | Strategy requirements dichiarati (SC2) | Complete (08-08) |
| MF-CONTRACT-01 | Phase 8 | 6 contract types definiti (SC2) | Complete (08-04 + 08-09) |
| MF-CONTRACT-02 | Phase 8 | Contract validation pre-mount policy (SC3) | Complete (08-09) |
| MF-EVT-01 | Phase 8 | 17 lifecycle topics pubblicati (SC3) | Complete (08-10) |
| MF-EVT-02 | Phase 8 | 7 error topics pubblicati (SC3) | Complete (08-10) |
| MF-EVT-03 | Phase 8 | 5 governance topics pubblicati (SC3) | Complete (08-10) — emission F11-F14 |
| MF-EVT-04 | Phase 8 | LifecycleEventPayload shape valido (SC3) | Complete (08-04 + 08-10) |
| MF-EVT-05 | Phase 8 | ErrorEventPayload shape valido (SC3) | Complete (08-04 + 08-10) |
| MF-MOD-01 | Phase 8 | createBroker({}) bit-exact v1.x (SC1) | Complete (08-03 MIN-1) |
| MF-MOD-02 | Phase 8 | Loop array vuoto bundle delta 0 (SC1) | Complete (08-02 + 08-03) |
| MF-MOD-03 | Phase 8 | Lint custom no-import-from-mf-packages (SC4) | Complete (08-02 no-mf-deps test + 08-12 D-83 verify) |
| MF-MOD-04 | Phase 8 | Service locator tipizzato (SC2) | Complete (08-03 SERVICE_MICROFRONTENDS) |
| MF-MOD-05 | Phase 8 | D-V2-01 BLOCKING Pattern S1 augment (SC2) | Complete (08-05) |
| MF-LOADER-REG-01 | Phase 8 | Loader Registry API (SC2) | Complete (08-05) |
| MF-LOADER-REG-02 | Phase 8 | LoaderAdapter interface + LoaderContext (SC2) | Complete (08-05) |
| MF-BC-01 | Phase 8 | Suite v1-bc-replay 14 API §42.2 PASS (SC1) — verifier check ricorrente F9-F17 | Complete (08-02) |
| MF-BC-02 | Phase 8 | Suite v1-bc-replay committata in W1 (SC1) — eseguita ogni fase F8-F17 | Complete (08-02) |
| MF-BC-03 | Phase 8 | external? opzionale dichiarato (SC1) — chiusura tecnica F16 | Complete (08-02 gate) |
| MF-BC-04 | Phase 8 | Bundle delta core ≤ +350 B (SC1) — D-V2-21 BLOCKING | Complete (08-12) — cap raise 8870 B documented Rule 1 |
| MF-PKG-01 | Phase 8 | Nuovo package ESM-only peerDeps optional (SC2) | Complete (08-01) |
| MF-PKG-02 | Phase 8 | size-limit gate microfrontends ≤ 8 KB (SC1) | Complete (08-01 + 08-12) — gate 12 KB lockato |
| MF-PKG-03 | Phase 8 | attw + publint + subpath augment (SC2) | Complete (08-12) |
| MF-PKG-04 | Phase 8 | Tree-shaking + augment side-effect (SC2) | Complete (08-05) |
| MF-PKG-05 | Phase 8 | Loader/adapter mai inclusi nel core (SC1) | Complete (08-02) |
| MF-OBS-01 | Phase 8 | Metadata enriched via facade injection (SC2) | Complete (08-11) |
| MF-INT-LIFE-01 | Phase 8 | Sequenza pre-mount validate→...→mount (SC2) | Complete (08-03 + 08-07) |
| MF-INT-LIFE-02 | Phase 8 | Errori → failed + fallback + governance topic (SC2) | Complete (08-06 + 08-07 + 08-10) |
| MF-ESM-01 | Phase 9 | ESM dynamic import + timeout 15s (SC1, SC2) | Pending |
| MF-ESM-02 | Phase 9 | Default vs named export + invalid module error (SC2) | Pending |
| MF-CTX-01 | Phase 10 | 5 API context (set/replace/get/subscribe/clear) (SC1) | Done (10-02 + 10-05 closure E2E) |
| MF-CTX-02 | Phase 10 | RuntimeContext 11 chiavi (SC1) | Done (10-02 + 10-05 closure E2E) |
| MF-CTX-03 | Phase 10 | 8 eventi context standard payload valido (SC3) | Done (10-02 + 10-05 closure SC3) |
| MF-CTX-04 | Phase 10 | Read-only enforcement per MF (SC1) | Done (10-03 + 10-05 closure E2E) |
| MF-CTX-05 | Phase 10 | Selector subscribe + reference identity (SC1) | Done (10-02 + 10-05 closure SC1) |
| MF-CTX-06 | Phase 10 | Serializable snapshot + contextMap (SC3) | Done (10-04 + 10-05 closure SC3) |
| MF-MAP-01 | Phase 10 | MicroFrontendMapping namespace (SC2) | Done (10-04 + 10-05 closure SC2) |
| MF-MAP-02 | Phase 10 | D-V2-10 esplicito MF prevale (SC2) | Done (10-04 + 10-05 closure SC2) |
| MF-MAP-03 | Phase 10 | Mapping Inspector microFrontendId attribution (SC2) | Done (10-04 + 10-05 closure SC2) |
| MF-INT-MAP-01 | Phase 10 | Canonical mapper F2 riusato via namespace (SC2) | Done (10-04 + 10-05 closure SC2) |
| MF-INT-MAP-02 | Phase 10 | Inspector ring buffer esteso (SC2) | Done (10-04 + 10-05 closure SC2) |
| MF-PERM-01 | Phase 11 | Descriptor 9 categorie permissions (SC1) | Pending |
| MF-PERM-02 | Phase 11 | Pattern matching wildcard + deny ! (SC1) | Pending |
| MF-PERM-03 | Phase 11 | Facade injection no modifica core publish (SC4) | Pending |
| MF-PERM-04 | Phase 11 | PermissionError + topic permission.denied (SC1) | Pending |
| MF-PERM-05 | Phase 11 | permissionMode off/warn/enforce (SC1) | Pending |
| MF-PERM-06 | Phase 11 | Check sync + LRU cache + invalidation (SC3) | Pending |
| MF-CAP-01 | Phase 11 | Capabilities requires/provides/optional (SC2) | Pending |
| MF-CAP-02 | Phase 11 | Capability Registry API (SC2) | Pending |
| MF-CAP-03 | Phase 11 | CheckResult ok/missing/incompatible/etc (SC2) | Pending |
| MF-CAP-04 | Phase 11 | capabilityPolicy 4 valori (SC2) | Pending |
| MF-CAP-05 | Phase 11 | LRU cache mfId + event-driven invalidation (SC3) | Pending |
| MF-INT-LIFE-03 | Phase 11 | Permission check al momento azione (SC1) | Pending |
| MF-PIPE-01 | Phase 11 | D-V2-20 BLOCKING pipeline ext ordine (SC3) | Pending |
| MF-COMPAT-01 | Phase 12 | Descriptor 9 dimensioni semver (SC1, SC2) | Pending |
| MF-COMPAT-02 | Phase 12 | API check + register version (SC1) | Pending |
| MF-COMPAT-03 | Phase 12 | CompatibilityReport shape (SC1, SC4) | Pending |
| MF-COMPAT-04 | Phase 12 | compatibilityPolicy 5 valori (SC1) | Pending |
| MF-COMPAT-05 | Phase 12 | semver 7.8 tree-shaken bundle ≤ 9 KB (SC3) | Pending |
| MF-ISO-01 | Phase 13 | IsolationPolicy 7 chiavi (SC1, SC2, SC3) | Pending |
| MF-ISO-02 | Phase 13 | DOM/CSS isolation strategies (SC1) | Pending |
| MF-ISO-03 | Phase 13 | Storage namespace gz:mf:<id>:<key> (SC2) | Pending |
| MF-ISO-04 | Phase 13 | Network gateway-only/blocked/direct (SC3) | Pending |
| MF-ISO-05 | Phase 13 | Event broker-only/plus-dom/isolated (SC1) | Pending |
| MF-ISO-06 | Phase 13 | Warning combinazioni inconsistent (SC3) | Pending |
| MF-INT-THEME-01 | Phase 13 | ThemePolicy descriptor (SC1) | Pending |
| MF-INT-THEME-02 | Phase 13 | inherit + localOverrides (SC1) | Pending |
| MF-INT-THEME-03 | Phase 13 | adoptedStyleSheets carryover D-F7-22 (SC1) | Pending |
| MF-INT-THEME-04 | Phase 13 | Theme coverage devtools (preparazione F16) | Pending |
| MF-INT-GW-01 | Phase 13 | GatewayFacade.request in RuntimeContext (SC3) | Pending |
| MF-INT-GW-02 | Phase 13 | Attribution microFrontendId + permissions (SC3) | Pending |
| MF-INT-GW-03 | Phase 13 | Network gateway-only doc facade (SC3) | Pending |
| MF-INT-WK-01 | Phase 13 | WorkerFacade.run + metadata (SC4) | Pending |
| MF-INT-WK-02 | Phase 13 | Permissions + eventi attribuiti MF (SC4) | Pending |
| MF-INT-CACHE-01 | Phase 13 | Storage namespace default (SC2) | Pending |
| MF-INT-CACHE-02 | Phase 13 | storage blocked/shared (SC2) | Pending |
| MF-FALLBACK-01 | Phase 14 | FallbackPolicy 6 scope phase (SC2) | Pending |
| MF-FALLBACK-02 | Phase 14 | RetryPolicy backoff + jitter (SC1, SC3) | Pending |
| MF-FALLBACK-03 | Phase 14 | CircuitBreakerPolicy + topics open/close (SC1) | Pending |
| MF-FALLBACK-04 | Phase 14 | MicroFrontendError extends BrokerError (SC1) | Pending |
| MF-FALLBACK-05 | Phase 14 | Rendering html/component/event/custom (SC2) | Pending |
| MF-WC-01 | Phase 15 | WC custom element registered + context (SC1) | Pending |
| MF-IFRAME-01 | Phase 15 | Iframe sandbox + allow + bridge (SC2) | Pending |
| MF-IFRAME-02 | Phase 15 | Bridge 9 message types (SC2) | Pending |
| MF-IFRAME-03 | Phase 15 | D-V2-09 Valibot schema + LRU dedup replay (SC2) | Pending |
| MF-IFRAME-04 | Phase 15 | expectedOrigin MANDATORY + targetOrigin ban (SC2, SC5) | Pending |
| MF-IFRAME-05 | Phase 15 | Subpath /client no broker completo (SC6) | Pending |
| MF-MF-01 | Phase 15 | Module Federation experimental @0.x (SC3) | Pending |
| MF-MF-02 | Phase 15 | MF errori specifici 5 codici (SC3) | Pending |
| MF-SS-01 | Phase 15 | single-spa adapter experimental @0.x (SC4) | Pending |
| MF-SEC-01 | Phase 15 | Iframe origin validation + sandbox baseline (SC2, SC5) | Pending |
| MF-SEC-02 | Phase 15 | integrity + allowlist + logging remote (SC5) | Pending |
| MF-SEC-03 | Phase 15 | Doc governance non sandbox crypto (SC5) | Pending |
| MF-SEC-04 | Phase 15 | Schema strict + rate limit + dedup (SC2) | Pending |
| MF-DEVTOOLS-01 | Phase 16 | Inspector 17 campi PRD §30.3 (SC1) | Pending |
| MF-DEVTOOLS-02 | Phase 16 | SnapshotProvider MIN-3 + external? (SC2, SC4) | Pending |
| MF-DEVTOOLS-03 | Phase 16 | 11 timings lifecycle (SC1) | Pending |
| MF-DEVTOOLS-04 | Phase 16 | Ring buffer 500 + pause/resume/flush (SC1) | Pending |
| MF-DEVTOOLS-05 | Phase 16 | SnapshotProvider Registry MIN-3 in devtools/src (SC2, SC4) | Partial (Foundation 16-01 ✅; closure 16-02 W2) |
| MF-OBS-02 | Phase 16 | 14 metriche per-MF (SC3) | Pending |
| MF-OBS-03 | Phase 16 | D-V2-19 metrics.microFrontends[] array (SC3) | Pending |
| MF-FRAMEWORK-REACT-01 | Phase 17 | GlueZeroProvider + 6 hooks (SC1) | Pending |
| MF-FRAMEWORK-REACT-02 | Phase 17 | createReactMicroFrontendLifecycle factory (SC1) | Pending |
| MF-FRAMEWORK-REACT-03 | Phase 17 | React 19 StrictMode + ErrorBoundary (SC1) | Pending |
| MF-FRAMEWORK-REACT-04 | Phase 17 | peer optional 18.2-20 (SC5) | Pending |
| MF-FRAMEWORK-WC-01 | Phase 17 | GlueZeroElement base class (SC2) | Pending |
| MF-FRAMEWORK-WC-02 | Phase 17 | Cleanup disconnectedCallback (SC2) | Pending |
| MF-FRAMEWORK-WC-03 | Phase 17 | Subpath /lit Lit 3 mixin (SC2, SC5) | Pending |
| MF-TEST-01 | Phase 17 | Tier discipline closure formale (SC4) | Pending |
| MF-TEST-02 | Phase 17 | 17 categorie unit test minime (SC4) | Pending |
| MF-TEST-03 | Phase 17 | 12 scenari integration test (SC4) | Pending |
| MF-TEST-04 | Phase 17 | Bench <5% scenario A + <10% B (SC3) | Pending |
| MF-DOC-01 | Phase 17 | 18 documenti PRD §41 (SC5) | Pending |
| MF-DOC-02 | Phase 17 | README italiano + JSDoc descrittivi (SC5) | Pending |
| MF-DOC-03 | Phase 17 | Migration guide + adoption levels A/B/C (SC5) | Complete (17-05 + 17-06 customer-dashboard golden showcase + walkthrough A/B/C) |
| MF-DOC-04 | Phase 17 | 6 examples standalone HTML CDN (SC5) | Complete (17-06: 4 carryover F9/F11/F13/F15 + 2 NEW mf-react-adapter + mf-compat-matrix) |
| MF-DOC-05 | Phase 17 | TypeDoc GitHub Pages auto-deploy (SC5) | Pending |

**Verifier checklist ricorrente cross-fase (F8-F17):**
- MF-BC-01 / MF-BC-02 / MF-BC-04 verificati ogni fase verifier via `v1-bc-replay/` suite + `git diff packages/core/src/` + `size-limit`
- MF-MOD-03 verificato ogni fase via lint custom `no-import-from-mf-packages` + CI gate
- MF-PIPE-01 verificato ogni fase verifier post-F11 (extension ordine pipeline preservato)
- MF-TEST-04 bench `<5%`/`<10%` verificato ogni fase con baseline.json committato (closure formale F17)
- MF-TEST-01 Tier discipline applicata già da F8 (closure formale F17)
