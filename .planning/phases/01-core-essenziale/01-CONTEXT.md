# Phase 1: Core essenziale - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Esiste un broker pub/sub in-page, testabile, che pubblica e consegna `BrokerEvent` strutturati, con plugin registry, lifecycle hooks anti-leak, naming convention validata e infrastruttura di osservabilità (`EventTap`) pre-instrumentata. È il fondamento sul quale F2-F6 costruiscono mapper, routing, gateway, worker, cache e tooling.

**Cosa è IN scope per F1:**
- Event bus pub/sub con `publish` / `subscribe` / `unsubscribe`
- Topic Registry, Subscriber Registry
- Plugin Registry con lifecycle hooks (`onRegister`, `onMount`, `onUnmount`, `onDestroy`)
- Struttura `BrokerEvent` (id, topic, timestamp, source, payload, metadata, correlationId, causationId, traceId, schemaVersion, deliveryMode, priority, ttlMs, dedupeKey)
- Validazione sintattica evento (VAL-01) — solo `BrokerEvent` shape, nessun payload schema
- Wildcard subscribe (`weather.*`, `*.failed`, `form.customer.*`)
- Logging configurabile con 6 livelli
- `EventTap` interface instrumentata negli step di pipeline implementati in F1 (no-op default)
- API factory `createBroker(config)` con sezioni di config solo per le aree F1 (le altre aree restano valid placeholder)
- Setup monorepo `pnpm` workspaces + scaffold dei 7 package (anche se in F1 solo `@gluezero/core` ha codice)
- BrokerError factory (ERR-01)
- Test setup con Vitest + jsdom + browser harness Playwright stub
- Documentazione skeleton (README + API skeleton)

**Cosa è FUORI scope per F1:**
- Canonical model / mapper (F2)
- Validazione payload topic e schema canonico (F2)
- Route engine, HTTP gateway (F3)
- Realtime SSE/WS (F4)
- Worker runtime (F5)
- Cache, Inspector reali, metrics (F6)

</domain>

<decisions>
## Implementation Decisions

### Delivery semantics

- **D-01:** **Default `deliveryMode: 'async'`** per gli eventi locali. Consegna via `queueMicrotask` per garantire FIFO ordering tra publish e consegna, prevenire re-entrancy (handler che ri-pubblica stesso topic non causa stack overflow), e isolare publisher/subscriber sullo stesso microtask boundary.
- **D-02:** Override `deliveryMode: 'sync'` ammesso a livello di `publish(topic, payload, { deliveryMode: 'sync' })` e a livello di `subscribe` per casi specifici (es. `system.error` può richiedere sync per fail-fast). NON è il default; è opt-in esplicito.
- **D-03:** **Modi `worker` e `remote`** sono dichiarati nel tipo `BrokerEvent.deliveryMode` ma sono no-op in F1 — saranno gestiti dalle route in F3/F5. In F1 vengono mappati su `async` con un warning (`mapping.delivery.fallback`).

### Payload safety

- **D-04:** **Deep-freeze runtime del payload** prima della consegna ai subscriber, attivato di default in dev mode (`debug: true`). In production (`debug: false`) il freeze è skippato per performance, ma il contratto type-level `Readonly<T>` resta.
- **D-05:** Il freeze è ricorsivo (`Object.freeze` su ogni livello finché ci sono `object`/`array`); `Date`, `Map`, `Set` sono freezable ma non immutabili — documentare il limite. Mutazioni profonde da subscriber sono silently ignored in production e throw in dev.
- **D-06:** No `structuredClone` per il payload all'ingresso in F1 — costo proibitivo per eventi piccoli/frequenti. Il clone è riservato al confine worker (F5) dove è obbligatorio.
- **D-07:** Branded immutable types: il payload type pubblicato come `Readonly<TPayload>` deep tramite utility `DeepReadonly<T>`.

### Wildcard matching

- **D-08:** **Trie segmentato** come struttura dati per Subscriber Registry. Topic split per `.` → ogni segmento è un nodo; nodi `*` come ramificazione wildcard (single-segment match); supporto futuro a `**` (multi-segment) considerato ma NON in F1 — solo `*` single-segment per coerenza con PRD §12.3.
- **D-09:** Lookup `O(segments_in_topic)` indipendente dal numero di subscriber — scala fino a migliaia di subscriber wildcard senza degradazione.
- **D-10:** Costo `subscribe`/`unsubscribe` `O(segments_in_pattern)`. Insertion idempotente.
- **D-11:** Edge case: subscribe a `weather.*.failed` con publish `weather.alert.failed` deve matchare. Documentare con test esplicito.

### Logging

- **D-12:** **Console-based logger di default** con namespace prefix `[gluezero]` e mapping livelli → metodi: `silent` no-op, `error` → `console.error`, `warn` → `console.warn`, `info` → `console.info`, `debug` → `console.debug`, `trace` → `console.debug` (con prefisso TRACE).
- **D-13:** **Adapter slot tramite `setLogger(customLogger)`** che accetta un'implementazione conforme a `BrokerLogger` interface. Permette swap futuro a pino/winston/custom backend telemetry senza dipendenze in core.
- **D-14:** `BrokerLogger.{error, warn, info, debug, trace}(message, meta?)` come surface minima. No structured JSON di default (mantiene DX in browser devtools).

### Claude's Discretion

Le seguenti decisioni tecniche sono prese internamente sulla base di PRD + research (riferimenti documentati). L'utente può sovrascrivere durante planning se necessario.

- **D-15:** **Sub-package layout monorepo**: confermo i 7 sub-package proposti da STACK.md (`@gluezero/{core, mapper, gateway, routing, worker, cache, devtools}` + aggregato `@gluezero/gluezero`). In F1 viene scaffoldato l'intero workspace ma solo `@gluezero/core` riceve codice — gli altri restano placeholder con `package.json` e README. Rationale: separazione di concerns chiara, tree-shaking ottimale, possibilità di pubblicare incrementalmente. Riferimento: `STACK.md` §"Repository Structure".
- **D-16:** **Plugin handler error isolation**: handler sync che lancia eccezione → caught con try/catch e pubblicato come `system.error` con `BrokerError.category: 'plugin'`. Handler async che ritorna Promise rejected → `.catch()` automatico con stesso treatment. Nessun timeout di default su handler subscribe (i timeout si applicano a route remote, F3). Rationale: PRD §22.2 (errori isolati), Pitfall #9.
- **D-17:** **Plugin id collision**: `registerPlugin({id: existingId})` throw `BrokerError.code: 'plugin.id.duplicate'`. Nessun overwrite silenzioso. Rationale: PRD §30.3 esplicito su collision id.
- **D-18:** **Config validation**: `createBroker(config)` valida fail-fast all'init usando schemi Valibot — config invalida → throw con messaggio specifico del field. Rationale: catch errori di setup il più presto possibile, Pitfall #10.
- **D-19:** **`createBroker` API surface**: factory imperativa `createBroker(config) → Broker`; tutte le configurazioni runtime (plugin, route, transform, schema) sono SIA dichiarabili nel `config` SIA registrabili imperativamente dopo (`broker.registerPlugin(...)`, `broker.registerRoute(...)`). Rationale: PRD §16.2 esplicito sui metodi imperativi; permette uso sia dichiarativo sia dinamico.
- **D-20:** **`EventTap` surface in F1**: il tap viene chiamato sui seguenti step della pipeline implementati in F1 — `event.received` (step 1), `event.metadata.enriched` (step 2), `event.validated` (step 3), `event.dedupe.checked` (step 7-base), `event.delivered` (step 13). F2-F5 aggiungono step (4-6, 8-12). F6 sostituisce no-op con Inspector reali. Contratto: `EventTap.onPipelineStep(step: PipelineStep, snapshot: PipelineSnapshot): void` — sync, no return value, errors swallowed (un tap che fallisce non rompe la pipeline).
- **D-21:** **`BrokerEvent.id` generation**: `nanoid()` (default 21 char URL-safe), valorizzato dal broker in `publish` se assente. ID custom sono ammessi (ma devono essere univoci — collision throw).
- **D-22:** **`BrokerEvent.timestamp`**: valorizzato dal broker in `publish` se assente. `Date.now()` (millis since epoch). Timestamp custom ammessi.
- **D-23:** **`BrokerEvent.source`**: obbligatorio. Publisher (plugin) deve dichiarare `source: { type: 'plugin', id: pluginId, ... }`. Per publish da component non-plugin (es. da framework UI): `source: { type: 'component', id: componentId }`. Validazione fail al publish se source missing.
- **D-24:** **Topic naming validation** al `publish`: regex `^[a-z][a-z0-9]*(\.[a-z][a-z0-9*]*)*$` (lowercase, dot-separated, prima lettera alfabetica). Topic invalidi → throw `BrokerError.code: 'topic.invalid'`.
- **D-25:** **Lifecycle execution order**: `registerPlugin` → `onRegister` (sync); successivo `broker.start()` o auto-mount → `onMount` (async, awaitable); `unregisterPlugin` → `onUnmount` (async) → cascade unsubscribe → `onDestroy` (sync). Ogni hook è opzionale; default no-op.
- **D-26:** **Cascade cleanup su `unregisterPlugin`**: rimosse in ordine: (1) tutte le subscription registrate dal plugin, (2) tutte le route registrate dal plugin, (3) tutti i transform registrati, (4) AbortController firing per i pending in-flight handlers async. Rationale: PRD §24.2, Pitfall #1, REQ LIFE-02.
- **D-27:** **`Subscription` handle**: oggetto `{ unsubscribe(): void; readonly id: string; readonly topic: string; readonly active: boolean }`. Idempotente (chiamare `unsubscribe` due volte è no-op dopo la prima).
- **D-28:** **`getDebugSnapshot()`** ritorna in F1: `{ topics: string[]; subscriberCount: Record<topic, number>; pluginIds: string[]; pendingAsyncDelivery: number; logLevel: LogLevel; pipelineSteps: PipelineStep[] }`. F6 estenderà con metrics complete.
- **D-29:** **`enableDebug()` / `disableDebug()` toggle**: in F1 attiva/disattiva il deep-freeze runtime + verbose logging + tap snapshot full payload (vs payload omitted). Default: `debug: true` se `import.meta.env.DEV`, `false` altrimenti.
- **D-30:** **No singleton globale**: `createBroker` ritorna istanze indipendenti. Multiple istanze nello stesso pagina sono ammesse e isolate. Rationale: Pitfall #11, testability, multi-tenant scenarios.

### Folded Todos

(Nessuno — questa è la prima fase, nessun todo precedente da incorporare.)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project authoritative source
- `prd.md` — PRD completo, fonte autoritativa unica. Sezioni rilevanti per F1: §6 (terminologia), §10 (architettura logica), §11 (modello evento), §12 (topic), §15 (modello plugin), §16 (API pubblica minima), §22 (gestione errori), §24 (lifecycle e memory safety), §25.4 (log levels), §27 (config globale), §28 (pipeline ufficiale), §31 (compatibilità packaging), §33.2 (vincoli non negoziabili), §35.1 (unit test obbligatori), §36 (criteri di accettazione), §39 (open issues — alcuni si chiudono in F1: LIFE-02), §42 (checklist conformità).

### Project planning files
- `.planning/PROJECT.md` — overview, core value, requirements, constraints, key decisions
- `.planning/REQUIREMENTS.md` — 91 REQ-ID v1, mapping a fasi
- `.planning/ROADMAP.md` — 6 fasi con goal, scope, success criteria, dipendenze; sezione Phase 1 in particolare
- `.planning/config.json` — workflow GSD config (profile=quality, granularity=coarse, parallelization=true, mode=yolo)
- `.planning/STATE.md` — stato corrente del progetto

### Research outputs
- `.planning/research/STACK.md` — stack tecnologico raccomandato; sezioni rilevanti per F1: tsup, Vitest, Biome, Changesets, nanoid, EventBus in-house rationale, Repository Structure (monorepo pnpm workspaces 7-package layout), TypeScript config (target ES2022, moduleResolution Bundler, isolatedDeclarations)
- `.planning/research/FEATURES.md` — table stakes (TS-01..TS-09 vincoli §33.2, TS-10..TS-18 API minima §16, TS-19..TS-23 modello evento, TS-32..TS-36 tooling), feature complexity ranking; differenziatori DIFF-01..DIFF-10
- `.planning/research/ARCHITECTURE.md` — pattern architetturali (Mediator + Pipes-and-Filters + Wire Tap), component boundaries Core Broker ↔ Routing/Mapping/Tooling, build order F1 critico, module structure (`src/core/`, `src/types/`, `src/index.ts`), interfacce da congelare in F1, plugin contract, testabilità (PipelineHarness)
- `.planning/research/PITFALLS.md` — 17 pitfall con strategie di prevenzione; rilevanti per F1: #1 (memory leak subscribe persistenti), #11 (API design — handle, naming, mutation), #14 (Open Issues PRD §39 da chiudere), #16 (wildcard performance), #10 (validation noise/visibility)
- `.planning/research/SUMMARY.md` — sintesi per roadmap; "Vincolo critico: EventTap pre-instrumentato in F1"

### Project guide
- `CLAUDE.md` — vincoli operativi (modello claude-opus-4-7-1, lingua italiana, agent-swarm, minimize questions); roadmap mapping fasi → package; open issues PRD §39 mapping; pipeline §28 distribuzione cross-fase

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

(Greenfield — nessun codice preesistente. F1 inizia con repo vuoto + `prd.md` + `.planning/`.)

### Established Patterns

(Nessun pattern preesistente. F1 stabilisce i pattern fondamentali per le fasi successive.)

### Integration Points

- Future-fase integration: F2 estenderà la pipeline aggiungendo step 4-6, 11-12 e installerà tap reali per Mapping Inspector
- Future-fase integration: F3 estenderà aggiungendo step 7-full, 8-10 (route resolution + execute)
- Future-fase integration: F6 sostituirà tap no-op con Inspector reali instrumentati negli step già emessi da F1-F5

</code_context>

<specifics>
## Specific Ideas

- L'esempio meteo del PRD §29 e §38 deve poter essere "in volo" alla fine di F1 limitatamente alla parte locale (Plugin form pubblica `weather.requested` e Plugin widget si sottoscrive — senza HTTP, senza mapper). Test integration espliciti.
- Il fixture di test `PipelineHarness` deve permettere di verificare ogni step della pipeline implementato in F1 ricevendo gli eventi tramite `EventTap` (no-op sostituito da spy in test).
- Naming canonico futuro (snake_case per i campi, da PRD §29) NON entra in F1 — riservato a F2 — ma le interfacce di F1 devono essere TS-strict così che F2 possa estenderle senza breaking change.

</specifics>

<deferred>
## Deferred Ideas

- **Wildcard `**` multi-segment** — non in PRD §12.3 (che cita solo `*`). Considerato per V1.x/V2 se emerge use case. Non in F1.
- **Service Worker registration helper** — PRD §18.7 lo elenca come opzionale post-V1. Non in F1.
- **Topic schema validation** (payload schema per topic) — è VAL-02, mappata a F2. Non in F1.
- **Subscription `{ once: true }`** — pattern comune in EventEmitter; PRD non lo richiede esplicitamente, ma è zero-cost da aggiungere come `subscribe.once(topic, handler)`. Decisione rimandata al planning di F1 (raccomandato includerlo, ~10 LOC).
- **Backpressure (queue bounded, throttle, debounce)** — è ROUTE-10, mappata a F3. Non in F1.
- **Persistent log adapter (file/HTTP backend)** — fuori scope V1; estensione possibile via `setLogger`.

### Reviewed Todos (not folded)

(Nessuno.)

</deferred>

---

*Phase: 01-core-essenziale*
*Context gathered: 2026-04-28*
