# Phase 1: Core essenziale - Research

**Researched:** 2026-04-28
**Domain:** Browser-side TypeScript event broker library — monorepo bootstrap + `@gluezero/core` (event bus pub/sub, plugin registry, lifecycle, `BrokerEvent` model, `EventTap` pre-instrumentato)
**Confidence:** HIGH (rationale architetturale + versioni stack VERIFICATE live via `npm view` 2026-04-28)
**Tipo research:** *validate & detail* — la ricerca alta è già fatta (`STACK.md`/`ARCHITECTURE.md`/`SUMMARY.md`/`PITFALLS.md`); questo documento entra nei dettagli implementativi che il planner deve avere chiari per generare task atomici.

---

## Summary

La fase 1 produce due artefatti principali: (1) lo **scaffold del monorepo `pnpm` workspaces** con i 7 sotto-pacchetti `@gluezero/{core, mapper, gateway, routing, worker, cache, devtools}` + bundle aggregato `@gluezero/gluezero`; (2) il **codice di `@gluezero/core`** — broker pub/sub in-page, plugin registry con lifecycle anti-leak, struttura `BrokerEvent`, `EventTap` pre-instrumentato sui 5 step pipeline implementati in F1. Tutti gli altri sub-package esistono come placeholder con `package.json` + README.

Le decisioni stack sono già lockate da CONTEXT.md (D-01..D-30): default `deliveryMode: 'async'` via `queueMicrotask`, deep-freeze runtime in dev, trie segmentato per wildcard matching, console-based logger con adapter slot, no singleton globale, factory `createBroker(config)` con cascade cleanup obbligatoria su `unregisterPlugin`, `EventTap.onPipelineStep` chiamato sui 5 step F1 (received/enriched/validated/dedupe-checked/delivered). I 28 REQ-ID di Phase 1 (CORE-01..14, VAL-01, VAL-06, ERR-01, ERR-03, LIFE-01..02, TEST-01/03 subset, PKG-01..04, DOC-01) sono mappati in maniera esplicita ai moduli core e ai test.

Versioni stack **verificate live via `npm view`** in data 2026-04-28: TypeScript 6.0.3, tsup 8.5.1, Vitest 4.1.5, Biome 2.4.13, Changesets 2.31.0, nanoid 5.1.9, Valibot 1.3.1, jsdom 29.1.0, happy-dom 20.9.0, msw 2.13.6, Playwright 1.59.1, TypeDoc 0.28.19, publint 0.3.18, attw 0.18.2, size-limit 12.1.0, pnpm 10.33.2, idb 8.0.3, Comlink 4.4.2. Il salto rispetto a STACK.md (TS 5.5 → 6.0, Vitest 2.x → 4.x, Biome 1.9 → 2.x, jsdom 25 → 29) è **non bloccante** ma richiede uso esatto delle nuove versioni: la migration TS 5→6 e Vitest 3→4 hanno breaking minori che il planner deve recepire.

**Primary recommendation:** scaffolding del monorepo come prima cosa (Wave 0), poi codice `@gluezero/core` modulo per modulo seguendo l'ordine `types → topic-matcher → event-factory → broker-error → logger → bus → topic-registry → plugin-registry → lifecycle → event-tap → public-factory`. Test `PipelineHarness` (spy su EventTap) come fixture condivisa. Tutti i moduli pubblici esposti via `src/index.ts` con `package.json#exports` selettivo.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Delivery semantics**
- **D-01:** Default `deliveryMode: 'async'` via `queueMicrotask` — garantisce FIFO, previene re-entrancy, isola publisher/subscriber sullo stesso microtask boundary.
- **D-02:** Override `'sync'` ammesso a livello di `publish(topic, payload, { deliveryMode: 'sync' })` e su `subscribe`. NON è il default; è opt-in esplicito.
- **D-03:** Modi `'worker'` e `'remote'` dichiarati nel tipo `BrokerEvent.deliveryMode` ma **no-op in F1** — mappati su `async` con warning `mapping.delivery.fallback`.

**Payload safety**
- **D-04:** Deep-freeze runtime del payload prima della consegna ai subscriber, **attivo di default in dev mode (`debug: true`)**. In production (`debug: false`) il freeze è skippato per performance, ma il contratto type-level `Readonly<T>` resta.
- **D-05:** Freeze ricorsivo (`Object.freeze` su ogni livello di `object`/`array`); `Date`, `Map`, `Set` sono freezable ma non immutabili — documentare il limite. Mutazioni profonde da subscriber sono silently ignored in production e throw in dev.
- **D-06:** **NO `structuredClone`** del payload all'ingresso in F1 — costo proibitivo per eventi piccoli/frequenti. Il clone è riservato al confine worker (F5).
- **D-07:** Branded immutable types: payload pubblicato come `Readonly<TPayload>` deep tramite utility `DeepReadonly<T>`.

**Wildcard matching**
- **D-08:** **Trie segmentato** come struttura dati per Subscriber Registry. Topic split per `.` → ogni segmento è un nodo; nodi `*` come ramificazione wildcard (single-segment match).
- **D-09:** Lookup `O(segments_in_topic)` indipendente dal numero di subscriber.
- **D-10:** Costo `subscribe`/`unsubscribe` `O(segments_in_pattern)`. Insertion idempotente.
- **D-11:** Edge case: subscribe a `weather.*.failed` con publish `weather.alert.failed` deve matchare. Test esplicito.

**Logging**
- **D-12:** **Console-based logger di default** con namespace prefix `[gluezero]` e mapping livelli → metodi: `silent` no-op, `error` → `console.error`, `warn` → `console.warn`, `info` → `console.info`, `debug` → `console.debug`, `trace` → `console.debug` (con prefisso TRACE).
- **D-13:** **Adapter slot tramite `setLogger(customLogger)`** che accetta un'implementazione conforme a `BrokerLogger`.
- **D-14:** `BrokerLogger.{error, warn, info, debug, trace}(message, meta?)` come surface minima. No structured JSON di default.

### Claude's Discretion (decisioni da PRD + research)

- **D-15:** Sub-package layout monorepo: 7 sotto-pacchetti `@gluezero/{core, mapper, gateway, routing, worker, cache, devtools}` + aggregato `@gluezero/gluezero`. In F1 viene scaffoldato l'intero workspace ma solo `@gluezero/core` riceve codice.
- **D-16:** Plugin handler error isolation: handler sync con eccezione → caught con try/catch e pubblicato come `system.error` con `BrokerError.category: 'plugin'`. Handler async con Promise rejected → `.catch()` automatico con stesso treatment. Nessun timeout di default su handler subscribe.
- **D-17:** Plugin id collision: `registerPlugin({id: existingId})` throw `BrokerError.code: 'plugin.id.duplicate'`. Nessun overwrite silenzioso.
- **D-18:** Config validation: `createBroker(config)` valida fail-fast all'init usando schemi Valibot.
- **D-19:** `createBroker` API surface: factory imperativa `createBroker(config) → Broker`; configurazioni runtime sia dichiarabili nel `config` SIA registrabili imperativamente dopo.
- **D-20:** **EventTap surface in F1**: tap chiamato sui 5 step pipeline implementati in F1 — `event.received`, `event.metadata.enriched`, `event.validated`, `event.dedupe.checked`, `event.delivered`. Sync, no return value, errors swallowed.
- **D-21:** `BrokerEvent.id` generation: `nanoid()` (default 21 char URL-safe) se assente. ID custom ammessi (collision throw).
- **D-22:** `BrokerEvent.timestamp`: `Date.now()` se assente. Custom ammessi.
- **D-23:** `BrokerEvent.source`: obbligatorio. `{ type: 'plugin' | 'component', id: string, ... }`. Validazione fail al publish se source missing.
- **D-24:** Topic naming validation: regex `^[a-z][a-z0-9]*(\.[a-z][a-z0-9*]*)*$` (lowercase, dot-separated). Topic invalidi → throw `BrokerError.code: 'topic.invalid'`.
- **D-25:** Lifecycle execution order: `registerPlugin` → `onRegister` (sync); `start()` o auto-mount → `onMount` (async, awaitable); `unregisterPlugin` → `onUnmount` (async) → cascade unsubscribe → `onDestroy` (sync).
- **D-26:** Cascade cleanup su `unregisterPlugin`: (1) tutte le subscription registrate dal plugin, (2) tutte le route, (3) tutti i transform, (4) AbortController firing.
- **D-27:** `Subscription` handle: `{ unsubscribe(): void; readonly id: string; readonly topic: string; readonly active: boolean }`. Idempotente.
- **D-28:** `getDebugSnapshot()` ritorna in F1: `{ topics: string[]; subscriberCount: Record<topic, number>; pluginIds: string[]; pendingAsyncDelivery: number; logLevel: LogLevel; pipelineSteps: PipelineStep[] }`.
- **D-29:** `enableDebug()` / `disableDebug()` toggle: in F1 attiva/disattiva deep-freeze runtime + verbose logging + tap snapshot full payload. Default: `debug: true` se `import.meta.env.DEV`.
- **D-30:** **NO singleton globale**: `createBroker` ritorna istanze indipendenti. Multiple istanze nello stesso pagina sono ammesse e isolate.

### Deferred Ideas (OUT OF SCOPE)

- Wildcard `**` multi-segment (non in PRD §12.3).
- Service Worker registration helper (PRD §18.7, post-V1).
- Topic schema validation payload (VAL-02 → F2).
- Subscription `{ once: true }` — RACCOMANDATO da CONTEXT come ~10 LOC, **decisione planner**: includere o meno.
- Backpressure (queue bounded, throttle, debounce) → ROUTE-10 → F3.
- Persistent log adapter → estensione via `setLogger`, post-V1.

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CORE-01 | Event bus pub/sub `publish(topic, payload, options?)` + `subscribe(topic, handler, options?)` | Modulo `bus.ts` § Module-by-module, snippet `EventBus` |
| CORE-02 | `subscribe` ritorna `Subscription` handle con `unsubscribe()` idempotente | Modulo `bus.ts` + `types.ts` § `Subscription` interface (D-27) |
| CORE-03 | `getTopicRegistry()` traccia tutti i topic noti | Modulo `topic-registry.ts` § Module-by-module |
| CORE-04 | `registerPlugin(descriptor)` + `unregisterPlugin(id)` | Modulo `plugin-registry.ts` § Module-by-module |
| CORE-05 | Lifecycle hooks: `onRegister`, `onMount`, `onUnmount`, `onDestroy` | Modulo `lifecycle.ts` § Module-by-module + state machine D-25 |
| CORE-06 | Struttura `BrokerEvent` completa | Modulo `event-factory.ts` + `types.ts` § `BrokerEvent` interface |
| CORE-07 | `id` univoco (nanoid), `timestamp` valorizzato dal broker, `source` obbligatorio | D-21/D-22/D-23 + `event-factory.ts` |
| CORE-08 | Naming dot-separated minuscolo, pattern `<entity>.<action>.<status>`, validato al publish | Modulo `topic-matcher.ts` § validateTopic + regex D-24 |
| CORE-09 | Wildcard subscribe (`weather.*`, `*.failed`, `form.customer.*`) | Modulo `topic-matcher.ts` § Trie + D-08..D-11 |
| CORE-10 | Logging configurabile 6 livelli (`silent | error | warn | info | debug | trace`) | Modulo `logger.ts` § ConsoleLogger + D-12..D-14 |
| CORE-11 | Unsubscribe automatico su unregister plugin (no memory leak) | Modulo `plugin-registry.ts` § cascade D-26 |
| CORE-12 | Plugin handler isolato: eccezione non collassa broker | Modulo `bus.ts` § dispatch try/catch + `system.error` publish (D-16) |
| CORE-13 | `EventTap` instrumentata in F1 anche con no-op | Modulo `event-tap.ts` § interface + D-20 (5 step) |
| CORE-14 | `createBroker(config)` con sezioni `runtime`/`topicSchemas`/`canonicalModel`/`aliasRegistry`/`transforms`/`routes`/`transport`/`workers`/`debug`/`cache` | Modulo `public-factory.ts` § BrokerConfig schema (placeholder per sezioni F2-F6) |
| VAL-01 | Validazione sintattica `BrokerEvent` | Modulo `event-validator.ts` § Valibot schema + D-18 |
| VAL-06 | Schema definitions tipizzati | Valibot 1.3.1 come scelta locked (STACK.md §3) |
| ERR-01 | `BrokerError` con `code`, `message`, `category`, `details`, `originalError`, `routeId`, `topic`, `eventId` | Modulo `broker-error.ts` § factory |
| ERR-03 | Errori isolati: runtime non collassa | `bus.ts` dispatch try/catch + `lifecycle.ts` hook isolation |
| LIFE-01 | Subscribe ritorna handle; plugin smontabili senza leak | CORE-02 + CORE-11 |
| LIFE-02 | Unregister plugin rimuove subscription, handler, risorse — **chiusura PRD §39 #7** | D-26 cascade obbligatoria |
| TEST-01 (subset) | Unit test su pub/sub, unsubscribe, wildcard, lifecycle cleanup | § Test patterns — fixture `PipelineHarness`, suite per modulo |
| TEST-03 (subset) | Test robustezza: storm di eventi, plugin malconfigurato | § Test patterns — storm test, plugin che lancia eccezione |
| PKG-01 | Distribuzione ESM (CJS/IIFE opzionali) | tsup config § Config files |
| PKG-02 | TypeScript come sorgente, JS compilato distribuito | tsconfig § Config files |
| PKG-03 | Target browser evergreen, polyfill separati | `target: ES2022` + browser-only deps |
| PKG-04 | `.d.ts` generate per API pubblica | tsup `dts: true` |
| DOC-01 | Documentazione API pubblica (skeleton) | README + JSDoc su ogni export pubblico |

---

## Project Constraints (from CLAUDE.md)

Direttive applicabili a Phase 1:

| Direttiva | Origine | Applicazione F1 |
|-----------|---------|------------------|
| Modello agenti GSD = `claude-opus-4-7-1` | CLAUDE.md §"Modello AI" | Tutti gli spawn agenti devono usare `model: "opus"` esplicito |
| Lingua italiana per output utente; codice/identificatori/comandi shell in inglese | CLAUDE.md §"Lingua" | RESEARCH.md/PLAN.md in italiano; codice TS, npm scripts, REQ-ID in inglese |
| Minimizzare interazioni utente, procedere su default ragionevoli | CLAUDE.md §"Domande" | Niente domande durante planning se PRD/CONTEXT chiariscono |
| `EventTap` pre-instrumentata in F1 (no retrofit in F6) | CLAUDE.md §"Vincolo critico" | Modulo `event-tap.ts` con interfaccia + no-op + chiamate puntuali da `bus.ts` sui 5 step |
| TS 5.5+, target ES2022, ESM-first, `moduleResolution: Bundler`, strict completo | CLAUDE.md §"Stack" + STACK.md | tsconfig.base.json (vedi § Config files) |
| Monorepo `pnpm` workspaces 7 package | CLAUDE.md §"Stack" + D-15 | Wave 0 setup |
| Niente RxJS/mitt/eventemitter3/ky/wretch/ofetch/axios/uuid/reconnecting-websocket/eventsource-polyfill | CLAUDE.md §"Cosa NON usare" + STACK.md | Lock di esclusioni: in F1 le uniche deps runtime sono `nanoid` + `valibot` |
| Pipeline §28 deve essere skeleton in F1 (step 1, 2, 3, 7-base, 13) | CLAUDE.md §"Pipeline §28" | Ogni step F1 emette `tap.onPipelineStep(stepId, snapshot)` |
| Open issue PRD §39 #7 (LIFE-02) chiuso in F1 | CLAUDE.md §"Open issues" | Cascade `unregisterPlugin` D-26 + test deterministico |

---

## Architectural Responsibility Map

Phase 1 è puramente browser-runtime: niente UI, niente server, niente persistenza. La mappatura tier è semplice ma va esplicitata per allineamento con plan-checker.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Event bus pub/sub in-memory | Browser / Client | — | Tutto vive nella stessa pagina, nessuna chiamata cross-process |
| Plugin registry + lifecycle | Browser / Client | — | I plugin sono moduli JS in-page; lifecycle non richiede servizi esterni |
| `BrokerEvent` factory + nanoid | Browser / Client | — | Generazione ID e timestamp lato client |
| `EventTap` (Wire Tap) | Browser / Client | — | Implementazione no-op in F1; reale in F6, sempre client-side |
| Topic registry (`Set<string>`) | Browser / Client | — | Tracking in-memory dei topic noti |
| Build / packaging (tsup → ESM) | Build-time | — | Output dist/* consumato dal browser; nessun runtime server |
| Test (Vitest + jsdom) | Build-time / CI | Browser (V4 jsdom) | Suite unit + integration mid-level eseguite in jsdom (browser-like) |

**Nota:** non ci sono tier "API/Backend", "CDN", o "Database". Phase 1 è esplicitamente single-tier client-only. Questo allinea con PRD §5 ("la libreria è browser-side, non sostituto di logica server-side"). Se un task del plan dovesse menzionare backend/API, è un'errata assegnazione.

---

## Stack versions (verified live 2026-04-28)

> Tutte le versioni sotto sono state verificate in questa sessione tramite `npm view <pkg> version`. Source: npm registry, query date 2026-04-28.

### Runtime dependencies

| Package | Version verificata | F1 use | Source |
|---------|-------------------|--------|--------|
| `nanoid` | **5.1.9** | Generazione `BrokerEvent.id`, `correlationId`, `traceId`, `subscriptionId` | `[VERIFIED: npm registry 2026-04-28]` |
| `valibot` | **1.3.1** | Schema validation `BrokerConfig` + `BrokerEvent` shape | `[VERIFIED: npm registry 2026-04-28]` |

**Niente altro** è dependency runtime di `@gluezero/core` in F1.

### DevDependencies (root + per-package)

| Package | Version verificata | Scope |
|---------|-------------------|-------|
| `typescript` | **6.0.3** | Root devDep (workspace-wide) |
| `tsup` | **8.5.1** | Per-package build per `@gluezero/core` |
| `vitest` | **4.1.5** | Test runner (root + per-package config) |
| `@vitest/browser` | **4.1.5** | Per future fasi F4/F5; preinstallato come placeholder |
| `playwright` | **1.59.1** | Provider per `@vitest/browser` (non usato attivamente in F1) |
| `jsdom` | **29.1.0** | DOM simulato per integration test mid-level |
| `happy-dom` | **20.9.0** | DOM simulato alternativa (più veloce; valutare scelta) |
| `msw` | **2.13.6** | Non strettamente necessario in F1; preinstallato per F3 |
| `@biomejs/biome` | **2.4.13** | Lint + format (root) |
| `@changesets/cli` | **2.31.0** | Versioning workspace-wide |
| `typedoc` | **0.28.19** | Generazione `.d.ts` documentation |
| `publint` | **0.3.18** | CI gate per package shape (`exports`, `types`, ecc.) |
| `@arethetypeswrong/cli` | **0.18.2** | CI gate per resolution `.d.ts` (`attw`) |
| `size-limit` | **12.1.0** | Bundle size budget enforcement |
| `pnpm` (manager) | **10.33.2** | Package manager per workspaces |

### Salti di versione vs STACK.md (degni di attenzione)

| Package | STACK.md disse | Reale | Note migration |
|---------|---------------|-------|---------------|
| TypeScript | 5.5.x → 5.6.x | **6.0.3** | TS 6 è la prima major release dopo 5.x; verificare changelog per breaking. `isolatedDeclarations` (richiesto da `tsconfig`) è stable da TS 5.5 → resta valido |
| Vitest | 2.x → 3.x | **4.1.5** | Vitest 4 introduce nuove default per workspace + browser mode v2; planner deve usare la docs Vitest 4 corrente, NON 2.x |
| Biome | 1.9.x → 2.x | **2.4.13** | Biome 2 è stable; `biome.json` schema URL deve puntare a `https://biomejs.dev/schemas/2.4.13/schema.json`, NON 1.9.4 come in STACK.md |
| jsdom | 25.x | **29.1.0** | API stabile, salto di versione non breaking per uso base |
| happy-dom | 16+ | **20.9.0** | API stabile, salto di versione non breaking |
| TypeDoc | 0.27.x | **0.28.19** | Compatibile con TS 6 |
| pnpm | 9.x | **10.33.2** | Workspaces protocol invariato |

### Environment Audit

| Dependency | Required By | Available on machine | Version | Fallback |
|------------|------------|---------------------|---------|----------|
| Node.js >= 20 | All packages | ✓ | 24.1.0 | — |
| npm | Bootstrap | ✓ | 11.7.0 | — |
| pnpm | Workspaces | ✗ | — | **MANCA — il planner DEVE includere step `corepack enable && corepack prepare pnpm@10.33.2 --activate` come prima azione** |
| Git | Versioning | (assumed available) | — | — |
| Playwright browsers | F4/F5 (non F1) | (lazy-installed by `playwright install`) | — | Skippabile in F1 |

**Missing dependencies blocking:** `pnpm` non installato. Mitigazione standard: usare `corepack` (incluso da Node 16.10+) per attivare pnpm 10.33.2 senza richiedere install globale. Documentare in README della repo.

---

## Setup commands (scaffolding monorepo)

Comandi shell esatti da eseguire nell'ordine. Tutti relativi alla root `/Users/omarmarzio/programming/prova AI/GlueZero/` (che già contiene `prd.md`, `CLAUDE.md`, `.planning/`).

### 1. Bootstrap del package manager

```bash
# Attiva pnpm 10.33.2 via corepack (non installa globalmente)
corepack enable
corepack prepare pnpm@10.33.2 --activate
pnpm --version  # deve stampare 10.33.2
```

### 2. Inizializzazione root

```bash
# Crea package.json root (NON un package pubblicato — solo workspace orchestrator)
cat > package.json <<'EOF'
{
  "name": "gluezero-monorepo",
  "private": true,
  "version": "0.0.0",
  "packageManager": "pnpm@10.33.2",
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "build": "pnpm -r --filter='./packages/*' run build",
    "test": "pnpm -r --filter='./packages/*' run test",
    "test:watch": "pnpm -r --filter='./packages/*' run test:watch",
    "lint": "biome check .",
    "format": "biome format --write .",
    "typecheck": "pnpm -r --filter='./packages/*' run typecheck",
    "ci:publint": "pnpm -r --filter='./packages/*' exec publint",
    "ci:attw": "pnpm -r --filter='./packages/*' exec attw --pack",
    "ci:size": "size-limit",
    "changeset": "changeset",
    "release": "pnpm build && changeset publish"
  },
  "devDependencies": {
    "typescript": "6.0.3",
    "@biomejs/biome": "2.4.13",
    "@changesets/cli": "2.31.0",
    "vitest": "4.1.5",
    "@vitest/browser": "4.1.5",
    "playwright": "1.59.1",
    "jsdom": "29.1.0",
    "happy-dom": "20.9.0",
    "msw": "2.13.6",
    "tsup": "8.5.1",
    "typedoc": "0.28.19",
    "publint": "0.3.18",
    "@arethetypeswrong/cli": "0.18.2",
    "size-limit": "12.1.0",
    "@size-limit/preset-small-lib": "12.1.0"
  }
}
EOF
```

### 3. Workspace config

```bash
cat > pnpm-workspace.yaml <<'EOF'
packages:
  - 'packages/*'
EOF
```

### 4. `.npmrc`

```bash
cat > .npmrc <<'EOF'
auto-install-peers=true
strict-peer-dependencies=false
prefer-workspace-packages=true
shared-workspace-lockfile=true
save-exact=true
EOF
```

### 5. `.gitignore`

```bash
cat > .gitignore <<'EOF'
# deps
node_modules
.pnpm-store

# build output
dist
*.tsbuildinfo

# test
coverage
.vitest

# tooling
.turbo
.cache

# editor
.vscode
.idea
.DS_Store

# OS
Thumbs.db

# logs
*.log
npm-debug.log*
pnpm-debug.log*
EOF
```

### 6. `tsconfig.base.json` (root)

Vedi § Config files per il contenuto completo.

### 7. Scaffold dei 7 sub-package

```bash
mkdir -p packages/{core,mapper,gateway,routing,worker,cache,devtools,sembridge}
for pkg in core mapper gateway routing worker cache devtools sembridge; do
  mkdir -p "packages/$pkg/src"
done
```

Per ciascun package, creare `package.json`, `tsconfig.json`, `tsup.config.ts`, `README.md`. Vedi § Config files.

### 8. Installazione dipendenze

```bash
# Installa dev deps al root
pnpm install

# Installa runtime deps su @gluezero/core
pnpm add -F @gluezero/core nanoid@5.1.9 valibot@1.3.1
```

### 9. Init Changesets

```bash
pnpm changeset init
# Modifica .changeset/config.json (vedi § Config files)
```

### 10. Init Biome

```bash
pnpm biome init
# Sostituisci biome.json con la versione raccomandata (vedi § Config files)
```

### 11. Verifica setup

```bash
pnpm install                # tutto installato senza warning
pnpm typecheck              # nessun errore TS (anche se i sub-package sono vuoti)
pnpm lint                   # Biome happy
pnpm test                   # vitest dice "no test files found" (atteso in fase 1 wave 0)
```

---

## Config files

### `tsconfig.base.json` (root, esteso da ogni package)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],

    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true,
    "noPropertyAccessFromIndexSignature": true,

    "isolatedModules": true,
    "isolatedDeclarations": true,
    "verbatimModuleSyntax": true,

    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,

    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "useDefineForClassFields": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true
  },
  "exclude": ["**/node_modules", "**/dist", "**/*.test.ts", "**/*.spec.ts"]
}
```

**Rationale dei flag chiave:**
- `isolatedDeclarations` (TS 5.5+, stable in TS 6): abilita generazione `.d.ts` parallela e veloce — richiede che ogni export pubblico abbia type annotation esplicita.
- `verbatimModuleSyntax`: forza `import type` esplicito — coerenza ESM, niente `import` magico convertito in CJS dove non serve.
- `noUncheckedIndexedAccess`: critico per metadata `Record<string, unknown>` (sicurezza tipologica su lookup).
- `exactOptionalPropertyTypes`: distingue `{x?: number}` da `{x: number | undefined}` (richiesto per discriminated unions su `BrokerEvent`).

**Source:** TypeScript 6.0 handbook (verificato 2026-04-28 npm registry); `[CITED: docs della v5.5+ + STACK.md §11]`.

### `packages/core/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "**/*.test.ts", "**/*.spec.ts"]
}
```

**Nota:** non usiamo `references` in F1 — i 7 sub-package hanno dipendenze interne via `workspace:*` ma `@gluezero/core` non importa da nessun altro. Se F2 dovesse far importare `@gluezero/mapper` da `@gluezero/core` (improbabile), si valuteranno project references.

### `packages/core/tsup.config.ts`

```ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],          // V1 ESM-only — CJS dual-package hazard mitigation
  dts: true,                // genera .d.ts
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,         // libreria → no chunking
  minify: false,            // lascia minify al consumer
  target: 'es2022',
  platform: 'browser',
  external: [/^node:/],     // niente Node built-in nei bundle
  banner: {
    js: '/* @gluezero/core — MIT — https://github.com/<TBD>/sembridge */',
  },
})
```

**Decisione su CJS dual-package:** **solo ESM in V1**. Rationale:
- Tutti i bundler moderni (Vite, Webpack 5+, esbuild, Rollup, Bun, Parcel) supportano ESM nativamente.
- Dual ESM+CJS introduce *dual-package hazard* (state singleton diviso tra le due versioni — letale per un broker con istanze).
- Consumer legacy CJS possono usare dynamic `import()` o aggiornare bundler.
- `package.json#exports` punta solo a `./dist/index.js` (ESM) + `./dist/index.d.ts`.

Se un consumer richiede CJS in V1.x, si aggiungerà `format: ['esm', 'cjs']` con cautela e test dual-package hazard.

### `packages/core/package.json`

```json
{
  "name": "@gluezero/core",
  "version": "0.0.0",
  "description": "Core event broker (pub/sub, plugin registry, lifecycle, BrokerEvent) for GlueZero",
  "license": "MIT",
  "author": "",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./package.json": "./package.json"
  },
  "files": ["dist", "README.md", "LICENSE"],
  "sideEffects": false,
  "engines": {
    "node": ">=20"
  },
  "publishConfig": {
    "access": "public",
    "provenance": true
  },
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "nanoid": "5.1.9",
    "valibot": "1.3.1"
  },
  "devDependencies": {
    "tsup": "8.5.1",
    "typescript": "6.0.3",
    "vitest": "4.1.5",
    "jsdom": "29.1.0"
  },
  "size-limit": [
    {
      "name": "@gluezero/core (gzip)",
      "path": "dist/index.js",
      "limit": "8 KB",
      "gzip": true
    }
  ]
}
```

**Note critiche:**
- `"type": "module"` — package è ESM puro.
- `"sideEffects": false` — abilita tree-shaking aggressivo dal consumer.
- `exports` field con `types` PRIMA di `import` (ordine richiesto da TS resolver per `node16`/`bundler`).
- `publishConfig.provenance: true` — npm provenance attestations (sicurezza supply chain, supportato da npm 9.5+).
- `size-limit` budget: 8 KB gzip (allineato a STACK.md §15 e SUMMARY.md).

### Stub `package.json` per gli altri 6 sub-package + aggregato

In F1 questi sono **solo placeholder con README**, nessun codice. Esempio per `packages/mapper/package.json`:

```json
{
  "name": "@gluezero/mapper",
  "version": "0.0.0",
  "description": "Canonical model + bidirectional mapper for GlueZero (Phase 2 — placeholder in Phase 1)",
  "license": "MIT",
  "type": "module",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist", "README.md"],
  "publishConfig": {
    "access": "public"
  }
}
```

**Importante:** mettere `"private": true` sui placeholder così `pnpm changeset publish` li ignora finché non hanno codice. In F2/F3/F4/F5/F6 si rimuove `"private": true` quando si attiva il publish.

Per `@gluezero/gluezero` (aggregato) idem — placeholder fino a quando F2-F6 non riempiono i sub-package.

### `.changeset/config.json`

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.5/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": [
    "@gluezero/mapper",
    "@gluezero/gateway",
    "@gluezero/routing",
    "@gluezero/worker",
    "@gluezero/cache",
    "@gluezero/devtools",
    "@gluezero/gluezero"
  ]
}
```

**Rationale:**
- `fixed: []` e `linked: []` — ogni package ha versioning indipendente (consigliato per monorepo GlueZero dove i package matureranno a velocità diverse).
- `ignore` — finché i 6 placeholder restano `"private": true`, comunque metterli in ignore per chiarezza (rimuovere progressivamente in F2..F6).
- `access: "public"` — published as scoped public packages.

**Initial changeset per V0.1.0:**
- Decisione: **NO publish in F1**. La fase 1 produce codice ma il primo release pubblico avviene a fine F2 (quando il valore differenziante — canonical model — è espresso).
- Nessun `.changeset/*.md` viene creato in F1; il package resta a `0.0.0` lavorando come monorepo interno.

Se il planner decide di pubblicare un alpha `0.1.0-alpha.0` solo per `@gluezero/core` a fine F1 per testing, il changeset sarebbe:

```md
---
"@gluezero/core": minor
---

Initial alpha release of @gluezero/core: event bus, plugin registry, lifecycle hooks, BrokerEvent model, EventTap pre-instrumentation. Full API surface defined; F2-F6 will add canonical model, routing, gateway, worker, cache, devtools.
```

### `biome.json`

```json
{
  "$schema": "https://biomejs.dev/schemas/2.4.13/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "files": {
    "includes": [
      "**/*.ts",
      "**/*.tsx",
      "**/*.js",
      "**/*.json",
      "!**/dist/**",
      "!**/node_modules/**",
      "!**/coverage/**",
      "!**/*.d.ts"
    ]
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "complexity": { "noForEach": "off" },
      "style": {
        "useImportType": "error",
        "noNonNullAssertion": "warn",
        "useConsistentArrayType": {
          "level": "error",
          "options": { "syntax": "shorthand" }
        }
      },
      "suspicious": { "noExplicitAny": "error" }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "asNeeded",
      "trailingCommas": "all",
      "arrowParentheses": "always"
    }
  },
  "assist": {
    "actions": {
      "source": {
        "organizeImports": "on"
      }
    }
  }
}
```

**Note Biome 2.x:**
- Schema URL **deve** essere 2.4.13, non 1.9.4 (cambio breaking schema).
- `vcs.useIgnoreFile: true` — Biome 2 rispetta `.gitignore` automaticamente.
- `assist.actions.source.organizeImports` ha sostituito il top-level `organizeImports` di Biome 1.x.
- `noExplicitAny: error` per libreria pubblicata (downstream consumer non deve mai vedere `any` in `.d.ts`).
- `useImportType: error` — coerenza con `verbatimModuleSyntax: true` in tsconfig.

`[VERIFIED: Biome 2.4.13 schema URL via npm registry 2026-04-28]`

### `vitest.config.ts` per `@gluezero/core`

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: '@gluezero/core',
    environment: 'jsdom',           // browser-like DOM per test integration mid-level
    globals: false,                  // import esplicito da 'vitest' — più chiaro per libreria
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
    typecheck: {
      enabled: false,                // separato via `pnpm typecheck`
    },
  },
})
```

**Decisioni:**
- `environment: 'jsdom'` per F1 (3-livelli strategy: Node unit non serve qui perché il broker è browser-target; jsdom mid è il livello giusto; browser real è F4/F5).
- `globals: false` — preferiamo `import { describe, it, expect } from 'vitest'` esplicito (DX migliore in libreria pubblicata, IDE friendly).
- `coverage.provider: 'v8'` — più veloce di istanbul, sufficiente per coverage report.
- Soglie 90/85/90/90 — sane default per un core broker; il planner può rilassare se servono test integration più che unit.

### `.size-limit.json` (root o `package.json`-embedded)

Già embedded in `packages/core/package.json` sopra. Per il root, non serve `.size-limit.json` finché altri package non hanno bundle.

---

## Module-by-module implementation patterns

Layout `packages/core/src/`:

```
src/
├── types/
│   ├── broker-event.ts        # BrokerEvent, EventSource, DeliveryMode, Priority
│   ├── plugin.ts              # PluginDescriptor, PluginContext, lifecycle states
│   ├── subscription.ts        # Subscription handle interface
│   ├── config.ts              # BrokerConfig (con sezioni placeholder F2-F6)
│   ├── error.ts               # BrokerError, ErrorCategory
│   ├── logger.ts              # BrokerLogger interface, LogLevel
│   ├── tap.ts                 # EventTap interface, PipelineStep, PipelineSnapshot
│   ├── deep-readonly.ts       # DeepReadonly<T> utility
│   └── index.ts               # public re-exports
├── core/
│   ├── topic-matcher.ts       # Trie + validateTopic(regex)
│   ├── topic-registry.ts      # Set<string> + observer
│   ├── event-factory.ts       # createBrokerEvent() — id, timestamp, source default
│   ├── event-validator.ts     # Valibot schema su BrokerEvent shape (VAL-01)
│   ├── broker-error.ts        # createBrokerError() factory
│   ├── deep-freeze.ts         # deepFreeze(obj, options?)
│   ├── logger.ts              # ConsoleLogger default + setLogger() adapter slot
│   ├── event-tap.ts           # NoopEventTap + tap orchestration helpers
│   ├── bus.ts                 # EventBus (publish/subscribe/unsubscribe + dispatch)
│   ├── lifecycle.ts           # PluginLifecycleManager (state machine)
│   ├── plugin-registry.ts     # registerPlugin/unregisterPlugin + cascade cleanup
│   └── broker.ts              # internal Broker class composing all
├── public-factory.ts          # createBroker(config) → Broker
└── index.ts                   # public API surface
```

### `types/broker-event.ts`

```ts
import type { DeepReadonly } from './deep-readonly'

export type DeliveryMode = 'sync' | 'async' | 'worker' | 'remote'
export type Priority = 'low' | 'normal' | 'high' | 'critical'

export interface EventSource {
  readonly type: 'plugin' | 'component' | 'server' | 'worker' | 'system'
  readonly id: string
  readonly name?: string
  readonly version?: string
}

export interface BrokerEvent<TPayload = unknown> {
  readonly id: string
  readonly topic: string
  readonly timestamp: number
  readonly source: EventSource
  readonly payload: DeepReadonly<TPayload>
  readonly metadata?: DeepReadonly<Record<string, unknown>>
  readonly correlationId?: string
  readonly causationId?: string
  readonly traceId?: string
  readonly schemaVersion?: string
  readonly deliveryMode?: DeliveryMode
  readonly priority?: Priority
  readonly ttlMs?: number
  readonly dedupeKey?: string
}

// Branded type per ID (PRD §11.3 + Pitfall #12 TypeScript pitfalls)
declare const __eventIdBrand: unique symbol
export type EventId = string & { readonly [__eventIdBrand]: true }
```

**Note:**
- `readonly` ovunque per coerenza con D-04/D-07 (deep-freeze contract type-level).
- `DeepReadonly<TPayload>` propaga readonly su tutti i livelli (vedi `types/deep-readonly.ts`).
- Branded type `EventId` previene confusione con altri `string` (esempio uso: helper accept `EventId` non solo `string`).
- `metadata` è opzionale ma se presente è readonly profondo.

### `types/deep-readonly.ts`

```ts
export type DeepReadonly<T> =
  T extends Date | RegExp | Error
    ? T
    : T extends Map<infer K, infer V>
      ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
      : T extends Set<infer U>
        ? ReadonlySet<DeepReadonly<U>>
        : T extends Array<infer U>
          ? ReadonlyArray<DeepReadonly<U>>
          : T extends object
            ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
            : T
```

### `types/subscription.ts`

```ts
export interface Subscription {
  readonly id: string
  readonly topic: string
  readonly active: boolean
  unsubscribe(): void
}

export interface SubscribeOptions {
  readonly signal?: AbortSignal
  readonly priority?: 'low' | 'normal' | 'high'
  readonly deliveryMode?: 'sync' | 'async'
  readonly once?: boolean   // OPZIONALE — decisione planner se includere (vedi CONTEXT Deferred)
}
```

### `types/plugin.ts`

```ts
import type { Subscription } from './subscription'

export type PluginState =
  | 'unregistered'
  | 'registered'
  | 'mounting'
  | 'mounted'
  | 'unmounting'
  | 'unmounted'
  | 'failed'
  | 'destroyed'

export interface PluginDescriptor {
  readonly id: string
  readonly version?: string
  readonly displayName?: string
  // F2 will add: inputMap, outputMap, requires, provides
  // F3 will add: routes
  // F4 will add: realtimeChannels
  // F5 will add: workers

  onRegister?(ctx: PluginContext): void | Promise<void>
  onMount?(ctx: PluginContext): void | Promise<void>
  onUnmount?(ctx: PluginContext): void | Promise<void>
  onDestroy?(ctx: PluginContext): void
}

export interface PluginContext {
  readonly id: string
  readonly logger: import('./logger').BrokerLogger
  readonly broker: import('../core/broker').Broker
  readonly signal: AbortSignal     // fires on unregisterPlugin
}

// Internal — NOT exported publicly
export interface PluginRegistration {
  descriptor: PluginDescriptor
  state: PluginState
  subscriptions: Set<Subscription>
  abortController: AbortController
  // F2/F3/F4/F5 extend with: routes, transforms, realtimeChannels, workers
  registeredAt: number
  mountedAt?: number
  unmountedAt?: number
  failureReason?: import('./error').BrokerError
}
```

### `types/error.ts`

```ts
export type ErrorCategory =
  | 'validation'
  | 'plugin'
  | 'mapping'      // F2 will populate
  | 'route'        // F3 will populate
  | 'network'      // F3 will populate
  | 'worker'       // F5 will populate
  | 'system'
  | 'config'
  | 'topic'

export interface BrokerError extends Error {
  readonly code: string
  readonly category: ErrorCategory
  readonly details?: Record<string, unknown>
  readonly originalError?: Error
  readonly routeId?: string
  readonly topic?: string
  readonly eventId?: string
}

export interface CreateBrokerErrorParams {
  code: string
  category: ErrorCategory
  message: string
  details?: Record<string, unknown>
  originalError?: Error
  routeId?: string
  topic?: string
  eventId?: string
}
```

### `types/logger.ts`

```ts
export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug' | 'trace'

export interface BrokerLogger {
  error(message: string, meta?: Record<string, unknown>): void
  warn(message: string, meta?: Record<string, unknown>): void
  info(message: string, meta?: Record<string, unknown>): void
  debug(message: string, meta?: Record<string, unknown>): void
  trace(message: string, meta?: Record<string, unknown>): void
}
```

**Nota su D-12:** `silent` NON è un metodo dell'interfaccia — è un *livello* che, se settato, fa diventare tutti i metodi no-op nell'implementazione default (`ConsoleLogger`).

### `types/tap.ts`

```ts
export type PipelineStep =
  // F1 implements these 5:
  | 'event.received'
  | 'event.metadata.enriched'
  | 'event.validated'
  | 'event.dedupe.checked'
  | 'event.delivered'
  // F2/F3 will add:
  // | 'event.source.resolved'        // step 4
  // | 'event.mapped.canonical'       // step 5
  // | 'event.canonical.validated'    // step 6
  // | 'event.route.resolved'         // step 8
  // | 'event.route.executed'         // step 9
  // | 'event.outcome.collected'      // step 10
  // | 'event.mapped.consumer'        // step 11
  // | 'event.final.validated'        // step 12
  // F6 will add:
  // | 'event.observed'               // step 14

export interface PipelineSnapshot {
  readonly eventId: string
  readonly topic: string
  readonly step: PipelineStep
  readonly timestamp: number
  readonly durationMs: number
  readonly payloadBefore?: unknown
  readonly payloadAfter?: unknown
  readonly metadata?: Record<string, unknown>
}

export interface EventTap {
  onPipelineStep(step: PipelineStep, snapshot: PipelineSnapshot): void
}
```

### `types/config.ts`

```ts
import type { LogLevel, BrokerLogger } from './logger'
import type { EventTap } from './tap'

export interface BrokerConfig {
  // F1 sections (implemented):
  runtime?: {
    debug?: boolean                      // default: import.meta.env.DEV
    deepFreezeInDev?: boolean            // default: true
    logLevel?: LogLevel                  // default: 'info'
    logger?: BrokerLogger                // override default ConsoleLogger
    tap?: EventTap                       // override default NoopEventTap
  }
  debug?: {
    enabled?: boolean
    snapshotPayloadsFull?: boolean       // default: debug mode
  }

  // F2-F6 placeholder sections (validated as `unknown` in F1, ignored at runtime):
  topicSchemas?: unknown
  canonicalModel?: unknown
  aliasRegistry?: unknown
  transforms?: unknown
  routes?: unknown
  transport?: unknown
  workers?: unknown
  cache?: unknown
}
```

**Nota CORE-14:** la firma deve includere TUTTE le sezioni del PRD §27 anche se F1 non le usa, così F2-F6 estendono il tipo via TypeScript declaration merging senza breaking. F1 valida `runtime` e `debug` con Valibot; le altre sezioni passano valib `unknown()` (tollerante).

### `core/topic-matcher.ts` — Trie segmentato (D-08)

```ts
import { createBrokerError } from './broker-error'

const TOPIC_REGEX = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9*]*)*$/

export function validateTopic(topic: string): void {
  if (!TOPIC_REGEX.test(topic)) {
    throw createBrokerError({
      code: 'topic.invalid',
      category: 'topic',
      message: `Invalid topic name: "${topic}". Must match pattern <entity>.<action>.<status> (lowercase, dot-separated).`,
      details: { topic, regex: TOPIC_REGEX.source },
    })
  }
}

export function validateTopicPattern(pattern: string): void {
  // Same regex but allow '*' as a full segment
  // weather.*  → OK
  // *.failed   → OK
  // weather.*.failed → OK
  const SEG = /^([a-z][a-z0-9]*|\*)(\.([a-z][a-z0-9]*|\*))*$/
  if (!SEG.test(pattern)) {
    throw createBrokerError({
      code: 'topic.pattern.invalid',
      category: 'topic',
      message: `Invalid topic pattern: "${pattern}".`,
      details: { pattern },
    })
  }
}

interface TrieNode<T> {
  children: Map<string, TrieNode<T>>      // key = segment, '*' for wildcard
  subscribers: Set<T>
}

function createNode<T>(): TrieNode<T> {
  return { children: new Map(), subscribers: new Set() }
}

export class TopicTrie<T> {
  private root: TrieNode<T> = createNode()

  insert(pattern: string, item: T): void {
    validateTopicPattern(pattern)
    const segments = pattern.split('.')
    let node = this.root
    for (const seg of segments) {
      let child = node.children.get(seg)
      if (!child) {
        child = createNode()
        node.children.set(seg, child)
      }
      node = child
    }
    node.subscribers.add(item)
  }

  remove(pattern: string, item: T): boolean {
    const segments = pattern.split('.')
    return this.removeRecursive(this.root, segments, 0, item)
  }

  private removeRecursive(
    node: TrieNode<T>,
    segments: string[],
    idx: number,
    item: T,
  ): boolean {
    if (idx === segments.length) {
      return node.subscribers.delete(item)
    }
    const seg = segments[idx]!
    const child = node.children.get(seg)
    if (!child) return false
    const removed = this.removeRecursive(child, segments, idx + 1, item)
    // Cleanup empty branches
    if (child.children.size === 0 && child.subscribers.size === 0) {
      node.children.delete(seg)
    }
    return removed
  }

  match(topic: string): T[] {
    validateTopic(topic)
    const segments = topic.split('.')
    const result: T[] = []
    this.matchRecursive(this.root, segments, 0, result)
    return result
  }

  private matchRecursive(
    node: TrieNode<T>,
    segments: string[],
    idx: number,
    result: T[],
  ): void {
    if (idx === segments.length) {
      for (const sub of node.subscribers) result.push(sub)
      return
    }
    const seg = segments[idx]!
    // Exact match
    const exact = node.children.get(seg)
    if (exact) this.matchRecursive(exact, segments, idx + 1, result)
    // Wildcard match
    const wild = node.children.get('*')
    if (wild) this.matchRecursive(wild, segments, idx + 1, result)
  }

  // For getDebugSnapshot()
  collectAllPatterns(): string[] {
    const out: string[] = []
    this.walk(this.root, [], out)
    return out
  }

  private walk(node: TrieNode<T>, path: string[], out: string[]): void {
    if (node.subscribers.size > 0) out.push(path.join('.'))
    for (const [seg, child] of node.children) {
      this.walk(child, [...path, seg], out)
    }
  }
}
```

**Test essenziali (TopicTrie):**
- `weather.*` matcha `weather.requested` e `weather.loaded`, NON `weather` (no segment) né `weather.alert.failed` (single-segment match).
- `*.failed` matcha `weather.failed`, `auth.failed`, NON `failed` (no leading segment).
- `weather.*.failed` matcha `weather.alert.failed` (D-11 esplicito).
- Insertion idempotente: stesso pattern + stesso item → no duplicate (Set semantics).
- Remove pulisce nodi vuoti per non lasciare residui.
- Performance: `match` su 10000 subscriber con 4 segmenti → < 1ms (test storm).

### `core/event-factory.ts`

```ts
import { nanoid } from 'nanoid'
import type { BrokerEvent, EventSource, DeliveryMode, Priority } from '../types/broker-event'
import { createBrokerError } from './broker-error'

export interface PublishParams<T> {
  topic: string
  payload: T
  source?: EventSource
  metadata?: Record<string, unknown>
  correlationId?: string
  causationId?: string
  traceId?: string
  schemaVersion?: string
  deliveryMode?: DeliveryMode
  priority?: Priority
  ttlMs?: number
  dedupeKey?: string
  id?: string
  timestamp?: number
}

export function createBrokerEvent<T>(
  params: PublishParams<T>,
  defaultSource: EventSource | undefined,
): BrokerEvent<T> {
  const source = params.source ?? defaultSource
  if (!source) {
    throw createBrokerError({
      code: 'event.source.missing',
      category: 'validation',
      message: 'BrokerEvent requires a source descriptor (D-23). None provided and no default available.',
      topic: params.topic,
    })
  }
  return {
    id: (params.id ?? nanoid()) as string,
    topic: params.topic,
    timestamp: params.timestamp ?? Date.now(),
    source,
    payload: params.payload as never,        // freeze applied at delivery, not at creation
    ...(params.metadata && { metadata: params.metadata as never }),
    ...(params.correlationId && { correlationId: params.correlationId }),
    ...(params.causationId && { causationId: params.causationId }),
    ...(params.traceId && { traceId: params.traceId }),
    ...(params.schemaVersion && { schemaVersion: params.schemaVersion }),
    deliveryMode: params.deliveryMode ?? 'async',
    priority: params.priority ?? 'normal',
    ...(params.ttlMs !== undefined && { ttlMs: params.ttlMs }),
    ...(params.dedupeKey && { dedupeKey: params.dedupeKey }),
  }
}
```

### `core/event-validator.ts` (VAL-01 con Valibot)

```ts
import * as v from 'valibot'

const EventSourceSchema = v.object({
  type: v.picklist(['plugin', 'component', 'server', 'worker', 'system']),
  id: v.pipe(v.string(), v.minLength(1)),
  name: v.optional(v.string()),
  version: v.optional(v.string()),
})

const BrokerEventSchema = v.object({
  id: v.pipe(v.string(), v.minLength(1)),
  topic: v.pipe(v.string(), v.regex(/^[a-z][a-z0-9]*(\.[a-z][a-z0-9*]*)*$/)),
  timestamp: v.pipe(v.number(), v.integer(), v.minValue(0)),
  source: EventSourceSchema,
  payload: v.unknown(),                  // payload schema is VAL-02 (F2 territory)
  metadata: v.optional(v.record(v.string(), v.unknown())),
  correlationId: v.optional(v.string()),
  causationId: v.optional(v.string()),
  traceId: v.optional(v.string()),
  schemaVersion: v.optional(v.string()),
  deliveryMode: v.optional(v.picklist(['sync', 'async', 'worker', 'remote'])),
  priority: v.optional(v.picklist(['low', 'normal', 'high', 'critical'])),
  ttlMs: v.optional(v.pipe(v.number(), v.minValue(0))),
  dedupeKey: v.optional(v.string()),
})

export function validateEvent(event: unknown): void {
  const result = v.safeParse(BrokerEventSchema, event)
  if (!result.success) {
    throw createBrokerError({
      code: 'event.validation.failed',
      category: 'validation',
      message: `BrokerEvent validation failed: ${result.issues.map((i) => i.message).join('; ')}`,
      details: { issues: result.issues },
    })
  }
}
```

### `core/broker-error.ts`

```ts
import type { BrokerError, CreateBrokerErrorParams } from '../types/error'

export function createBrokerError(params: CreateBrokerErrorParams): BrokerError {
  const err = new Error(params.message) as BrokerError & { -readonly [K in keyof BrokerError]: BrokerError[K] }
  err.name = 'BrokerError'
  err.code = params.code
  err.category = params.category
  if (params.details) err.details = params.details
  if (params.originalError) {
    err.originalError = params.originalError
    // ES2022 Error.cause for stack chaining
    ;(err as Error & { cause?: unknown }).cause = params.originalError
  }
  if (params.routeId) err.routeId = params.routeId
  if (params.topic) err.topic = params.topic
  if (params.eventId) err.eventId = params.eventId
  return err
}

export function isBrokerError(value: unknown): value is BrokerError {
  return value instanceof Error && (value as BrokerError).code !== undefined &&
    (value as BrokerError).category !== undefined
}
```

### `core/deep-freeze.ts` (D-04, D-05)

```ts
const FROZEN = new WeakSet<object>()

export interface DeepFreezeOptions {
  skipDates?: boolean              // default: true (Date is frozen but mutations are no-op anyway)
  skipMaps?: boolean               // default: false (freeze + freeze entries)
  skipSets?: boolean               // default: false
  skipPromises?: boolean           // default: true
  skipTypedArrays?: boolean        // default: true (TypedArray freeze breaks views)
}

export function deepFreeze<T>(value: T, options: DeepFreezeOptions = {}): T {
  const opts = {
    skipDates: options.skipDates ?? true,
    skipMaps: options.skipMaps ?? false,
    skipSets: options.skipSets ?? false,
    skipPromises: options.skipPromises ?? true,
    skipTypedArrays: options.skipTypedArrays ?? true,
  }
  freezeRecursive(value, opts)
  return value
}

function freezeRecursive(value: unknown, opts: Required<DeepFreezeOptions>): void {
  if (value === null || value === undefined) return
  if (typeof value !== 'object') return
  if (FROZEN.has(value as object)) return       // cycle protection
  if (Object.isFrozen(value)) return

  // Special types
  if (value instanceof Date) {
    if (!opts.skipDates) Object.freeze(value)
    return
  }
  if (value instanceof Promise) {
    if (!opts.skipPromises) Object.freeze(value)
    return
  }
  if (ArrayBuffer.isView(value)) {
    if (!opts.skipTypedArrays) {
      // do not freeze TypedArray views (breaks iteration)
    }
    return
  }
  if (value instanceof Map) {
    if (!opts.skipMaps) {
      for (const [k, v] of value) {
        freezeRecursive(k, opts)
        freezeRecursive(v, opts)
      }
      Object.freeze(value)
    }
    return
  }
  if (value instanceof Set) {
    if (!opts.skipSets) {
      for (const v of value) freezeRecursive(v, opts)
      Object.freeze(value)
    }
    return
  }

  FROZEN.add(value as object)
  Object.freeze(value)
  for (const key of Object.getOwnPropertyNames(value)) {
    freezeRecursive((value as Record<string, unknown>)[key], opts)
  }
}
```

**Note critiche:**
- `WeakSet` per cycle protection (gestisce `obj.self = obj`).
- Date/Map/Set/Promise/TypedArray hanno default sensati documentati nei JSDoc.
- Performance: skip se già frozen (evita freeze ridondante in hot path).
- Errori in dev mode: in strict mode JS, `Object.freeze` + assignment throw `TypeError`; il broker NON cattura — propaga al subscriber per evidenziare il bug.

### `core/logger.ts`

```ts
import type { BrokerLogger, LogLevel } from '../types/logger'

const LEVEL_ORDER: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5,
}

const PREFIX = '[gluezero]'

export function createConsoleLogger(level: LogLevel = 'info'): BrokerLogger {
  const enabled = (target: LogLevel): boolean => LEVEL_ORDER[level] >= LEVEL_ORDER[target]

  const fmt = (level: string, msg: string, meta?: Record<string, unknown>): unknown[] =>
    meta ? [`${PREFIX} [${level}]`, msg, meta] : [`${PREFIX} [${level}]`, msg]

  return {
    error(message, meta) {
      if (enabled('error')) console.error(...fmt('ERROR', message, meta))
    },
    warn(message, meta) {
      if (enabled('warn')) console.warn(...fmt('WARN', message, meta))
    },
    info(message, meta) {
      if (enabled('info')) console.info(...fmt('INFO', message, meta))
    },
    debug(message, meta) {
      if (enabled('debug')) console.debug(...fmt('DEBUG', message, meta))
    },
    trace(message, meta) {
      if (enabled('trace')) console.debug(...fmt('TRACE', message, meta))
    },
  }
}

// silentLogger — utility per test
export const silentLogger: BrokerLogger = {
  error: () => {},
  warn: () => {},
  info: () => {},
  debug: () => {},
  trace: () => {},
}
```

**Nota D-13 adapter slot:** lo swap del logger non avviene tramite `setLogger()` globale (rompe D-30 no singleton) ma tramite **costruzione** del `Broker` con `config.runtime.logger` che sostituisce il default. Per dynamism a runtime, il `Broker` espone `broker.setLogger(logger)` come metodo di istanza.

### `core/event-tap.ts`

```ts
import type { EventTap, PipelineStep, PipelineSnapshot } from '../types/tap'

export const noopEventTap: EventTap = {
  onPipelineStep: () => {},
}

export function safeTapStep(
  tap: EventTap,
  step: PipelineStep,
  snapshot: PipelineSnapshot,
  onError?: (e: unknown) => void,
): void {
  try {
    tap.onPipelineStep(step, snapshot)
  } catch (e) {
    // D-20: errors swallowed; a failing tap must never break the pipeline
    onError?.(e)
  }
}

// Helper for measuring step duration
export function startStep(): (step: PipelineStep, eventId: string, topic: string, extras?: Partial<PipelineSnapshot>) => PipelineSnapshot {
  const start = performance.now()
  return (step, eventId, topic, extras = {}) => ({
    eventId,
    topic,
    step,
    timestamp: Date.now(),
    durationMs: performance.now() - start,
    ...extras,
  })
}
```

### `core/bus.ts` — EventBus principale

```ts
import { nanoid } from 'nanoid'
import type { BrokerEvent } from '../types/broker-event'
import type { Subscription, SubscribeOptions } from '../types/subscription'
import type { BrokerLogger } from '../types/logger'
import type { EventTap, PipelineSnapshot } from '../types/tap'
import { TopicTrie, validateTopic } from './topic-matcher'
import { deepFreeze } from './deep-freeze'
import { validateEvent } from './event-validator'
import { createBrokerError, isBrokerError } from './broker-error'
import { safeTapStep, startStep } from './event-tap'

interface InternalSubscription {
  id: string
  topic: string                  // pattern (may contain '*')
  handler: (event: BrokerEvent) => void | Promise<void>
  active: boolean
  ownerId?: string               // pluginId or componentId
  options: SubscribeOptions
  abortListener?: () => void
}

export class EventBus {
  private trie = new TopicTrie<InternalSubscription>()
  private byId = new Map<string, InternalSubscription>()
  private pendingAsync = 0
  private debugMode: boolean

  constructor(
    private readonly logger: BrokerLogger,
    private readonly tap: EventTap,
    options: { debug: boolean },
  ) {
    this.debugMode = options.debug
  }

  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled
  }

  publish<T>(event: BrokerEvent<T>): void {
    // Step 1: received
    safeTapStep(this.tap, 'event.received', this.snap('event.received', event))

    // Step 2: enrich (id/timestamp already set by event-factory)
    safeTapStep(this.tap, 'event.metadata.enriched', this.snap('event.metadata.enriched', event))

    // Step 3: validate (VAL-01)
    try {
      validateEvent(event)
    } catch (err) {
      this.logger.error('Event validation failed', { eventId: event.id, error: err })
      throw err
    }
    safeTapStep(this.tap, 'event.validated', this.snap('event.validated', event))

    // Step 7-base: dedupe check (placeholder — full dedupe in F3)
    safeTapStep(this.tap, 'event.dedupe.checked', this.snap('event.dedupe.checked', event))

    // Step 13: delivery (resolve subscribers)
    const matches = this.trie.match(event.topic)
    const frozenEvent = this.debugMode
      ? this.freezeForDelivery(event)
      : event

    const mode = event.deliveryMode ?? 'async'
    if (mode === 'sync') {
      this.dispatchSync(matches, frozenEvent)
    } else {
      // 'async' | 'worker' (warn) | 'remote' (warn) — all map to async in F1
      if (mode === 'worker' || mode === 'remote') {
        this.logger.warn('mapping.delivery.fallback', { mode, fallback: 'async' })
      }
      this.dispatchAsync(matches, frozenEvent)
    }

    safeTapStep(this.tap, 'event.delivered', this.snap('event.delivered', frozenEvent, {
      metadata: { subscriberCount: matches.length },
    }))
  }

  subscribe(
    pattern: string,
    handler: (event: BrokerEvent) => void | Promise<void>,
    options: SubscribeOptions = {},
    ownerId?: string,
  ): Subscription {
    validateTopic(pattern.replace(/\*/g, 'wildcard'))   // light check; trie enforces full pattern
    const id = nanoid()
    const sub: InternalSubscription = {
      id,
      topic: pattern,
      handler,
      active: true,
      ownerId: ownerId ?? '',
      options,
    }

    this.trie.insert(pattern, sub)
    this.byId.set(id, sub)

    if (options.signal) {
      const listener = () => this.unsubscribeInternal(id)
      options.signal.addEventListener('abort', listener)
      sub.abortListener = listener
    }

    return {
      get id() { return id },
      get topic() { return pattern },
      get active() { return sub.active },
      unsubscribe: () => this.unsubscribeInternal(id),
    }
  }

  unsubscribeInternal(id: string): void {
    const sub = this.byId.get(id)
    if (!sub || !sub.active) return        // idempotent (D-27)
    sub.active = false
    this.trie.remove(sub.topic, sub)
    this.byId.delete(id)
    if (sub.abortListener && sub.options.signal) {
      sub.options.signal.removeEventListener('abort', sub.abortListener)
    }
  }

  unsubscribeByOwner(ownerId: string): number {
    let count = 0
    for (const [id, sub] of this.byId) {
      if (sub.ownerId === ownerId) {
        this.unsubscribeInternal(id)
        count++
      }
    }
    return count
  }

  // For getDebugSnapshot()
  getStats(): { topics: string[]; subscriberCount: Record<string, number>; pendingAsyncDelivery: number } {
    const topics = this.trie.collectAllPatterns()
    const subscriberCount: Record<string, number> = {}
    for (const sub of this.byId.values()) {
      subscriberCount[sub.topic] = (subscriberCount[sub.topic] ?? 0) + 1
    }
    return { topics, subscriberCount, pendingAsyncDelivery: this.pendingAsync }
  }

  private dispatchSync(matches: InternalSubscription[], event: BrokerEvent): void {
    for (const sub of matches) {
      if (!sub.active) continue
      this.runHandler(sub, event)
    }
  }

  private dispatchAsync(matches: InternalSubscription[], event: BrokerEvent): void {
    if (matches.length === 0) return
    this.pendingAsync++
    queueMicrotask(() => {
      this.pendingAsync--
      for (const sub of matches) {
        if (!sub.active) continue
        this.runHandler(sub, event)
      }
    })
  }

  private runHandler(sub: InternalSubscription, event: BrokerEvent): void {
    try {
      const result = sub.handler(event)
      if (result && typeof (result as Promise<void>).catch === 'function') {
        (result as Promise<void>).catch((err) => this.handleHandlerError(sub, event, err))
      }
    } catch (err) {
      this.handleHandlerError(sub, event, err)
    }
  }

  private handleHandlerError(sub: InternalSubscription, event: BrokerEvent, err: unknown): void {
    this.logger.error('Plugin handler threw', {
      subscriptionId: sub.id,
      topic: event.topic,
      eventId: event.id,
      ownerId: sub.ownerId,
      error: err,
    })
    // D-16: publish system.error (use direct trie match for system.* to avoid recursion on validator)
    const sysError = isBrokerError(err)
      ? err
      : createBrokerError({
          code: 'plugin.handler.failed',
          category: 'plugin',
          message: err instanceof Error ? err.message : String(err),
          originalError: err instanceof Error ? err : undefined,
          eventId: event.id,
          topic: event.topic,
        })
    // Do NOT throw — handler isolation (CORE-12, ERR-03)
    // Publishing system.error here would be recursive — guard with a flag or fire-and-forget
    queueMicrotask(() => {
      try {
        this.publish({
          id: nanoid(),
          topic: 'system.error',
          timestamp: Date.now(),
          source: { type: 'system', id: 'broker' },
          payload: { error: sysError, originalEventId: event.id, originalTopic: event.topic } as never,
          priority: 'critical',
          deliveryMode: 'async',
        })
      } catch {
        // Last-resort: log only
        this.logger.error('Failed to publish system.error', { error: sysError })
      }
    })
  }

  private freezeForDelivery<T>(event: BrokerEvent<T>): BrokerEvent<T> {
    // D-04: freeze in dev mode (debugMode = true)
    deepFreeze(event.payload)
    if (event.metadata) deepFreeze(event.metadata)
    Object.freeze(event)
    return event
  }

  private snap(step: PipelineSnapshot['step'], event: BrokerEvent, extras: Partial<PipelineSnapshot> = {}): PipelineSnapshot {
    return {
      eventId: event.id,
      topic: event.topic,
      step,
      timestamp: Date.now(),
      durationMs: 0,    // TODO: per-step measurement (use startStep)
      ...(this.debugMode && { payloadAfter: event.payload }),
      ...extras,
    }
  }
}
```

**Note critiche:**
- `dispatchAsync` usa `queueMicrotask` (D-01) — più veloce di `setTimeout(0)`, ma garantisce comunque che il publisher esca dallo stack prima della consegna.
- `runHandler` cattura sia errori sync (try/catch) sia rejected Promise (`.catch()` su return value). Pattern necessario per D-16 + CORE-12.
- `system.error` pubblicato in `queueMicrotask` per evitare recursion se il fallimento avviene durante la consegna stessa.
- `unsubscribeByOwner` è il metodo che `plugin-registry.ts` chiama in cascade D-26.

### `core/topic-registry.ts`

```ts
export class TopicRegistry {
  private topics = new Set<string>()
  private listeners = new Set<(topic: string) => void>()

  register(topic: string): boolean {
    if (this.topics.has(topic)) return false
    this.topics.add(topic)
    for (const l of this.listeners) {
      try { l(topic) } catch {}
    }
    return true
  }

  has(topic: string): boolean {
    return this.topics.has(topic)
  }

  list(): string[] {
    return [...this.topics].sort()
  }

  onRegistered(listener: (topic: string) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}
```

**Nota:** la pubblicazione automatica di `system.topic.registered` è OUT OF SCOPE in F1 (decisione tactical: il TopicRegistry è "soft" — registra al primo `publish`). Verifica con planner se serve emit di `system.topic.registered` (raccomandato come 5 LOC aggiuntive).

### `core/lifecycle.ts`

```ts
import type { PluginRegistration, PluginState } from '../types/plugin'
import type { BrokerLogger } from '../types/logger'
import { createBrokerError } from './broker-error'

const VALID_TRANSITIONS: Record<PluginState, PluginState[]> = {
  unregistered: ['registered'],
  registered: ['mounting', 'unmounted'],
  mounting: ['mounted', 'failed'],
  mounted: ['unmounting'],
  unmounting: ['unmounted', 'failed'],
  unmounted: ['destroyed'],
  failed: ['unmounting', 'destroyed'],
  destroyed: [],
}

export function transitionState(reg: PluginRegistration, target: PluginState, logger: BrokerLogger): void {
  const allowed = VALID_TRANSITIONS[reg.state]
  if (!allowed.includes(target)) {
    const err = createBrokerError({
      code: 'plugin.lifecycle.invalid-transition',
      category: 'plugin',
      message: `Invalid plugin lifecycle transition: ${reg.state} → ${target} (plugin: ${reg.descriptor.id})`,
      details: { from: reg.state, to: target, pluginId: reg.descriptor.id },
    })
    logger.error(err.message, { error: err })
    throw err
  }
  reg.state = target
}
```

### `core/plugin-registry.ts`

```ts
import type { PluginDescriptor, PluginRegistration } from '../types/plugin'
import type { EventBus } from './bus'
import type { BrokerLogger } from '../types/logger'
import { createBrokerError } from './broker-error'
import { transitionState } from './lifecycle'

export class PluginRegistry {
  private plugins = new Map<string, PluginRegistration>()

  constructor(
    private readonly bus: EventBus,
    private readonly logger: BrokerLogger,
    private readonly buildContext: (id: string, signal: AbortSignal) => import('../types/plugin').PluginContext,
  ) {}

  async register(descriptor: PluginDescriptor): Promise<void> {
    if (this.plugins.has(descriptor.id)) {
      throw createBrokerError({
        code: 'plugin.id.duplicate',                 // D-17
        category: 'plugin',
        message: `Plugin id "${descriptor.id}" is already registered.`,
        details: { id: descriptor.id },
      })
    }

    const ac = new AbortController()
    const reg: PluginRegistration = {
      descriptor,
      state: 'unregistered',
      subscriptions: new Set(),
      abortController: ac,
      registeredAt: Date.now(),
    }
    this.plugins.set(descriptor.id, reg)

    transitionState(reg, 'registered', this.logger)

    const ctx = this.buildContext(descriptor.id, ac.signal)

    try {
      await descriptor.onRegister?.(ctx)
    } catch (err) {
      reg.failureReason = this.toBrokerError(err, descriptor.id)
      transitionState(reg, 'unmounted', this.logger)         // skip failed register: rollback to unmounted
      this.plugins.delete(descriptor.id)
      throw reg.failureReason
    }

    // Auto-mount per CONTEXT (D-25 — broker.start() also OK; auto by default)
    transitionState(reg, 'mounting', this.logger)
    try {
      await descriptor.onMount?.(ctx)
      reg.mountedAt = Date.now()
      transitionState(reg, 'mounted', this.logger)
    } catch (err) {
      reg.failureReason = this.toBrokerError(err, descriptor.id)
      transitionState(reg, 'failed', this.logger)
      this.logger.error('Plugin mount failed', { id: descriptor.id, error: err })
      throw reg.failureReason
    }
  }

  async unregister(id: string): Promise<void> {
    const reg = this.plugins.get(id)
    if (!reg) {
      throw createBrokerError({
        code: 'plugin.not-found',
        category: 'plugin',
        message: `Plugin id "${id}" not registered.`,
      })
    }

    transitionState(reg, 'unmounting', this.logger)
    const ctx = this.buildContext(id, reg.abortController.signal)
    try {
      await reg.descriptor.onUnmount?.(ctx)
    } catch (err) {
      this.logger.error('Plugin onUnmount threw', { id, error: err })
      // continue cascade — D-26 must always run
    }

    // CASCADE CLEANUP (D-26, LIFE-02 — closes PRD §39 #7)
    // 1. Unsubscribe everything owned by plugin
    const unsubCount = this.bus.unsubscribeByOwner(id)
    // 2. (F3 will add) routes registered by plugin
    // 3. (F2 will add) transforms registered by plugin
    // 4. Fire AbortController for in-flight async handlers
    reg.abortController.abort()

    reg.subscriptions.clear()
    reg.unmountedAt = Date.now()
    transitionState(reg, 'unmounted', this.logger)

    try {
      reg.descriptor.onDestroy?.(ctx)
    } catch (err) {
      this.logger.error('Plugin onDestroy threw', { id, error: err })
    }

    transitionState(reg, 'destroyed', this.logger)
    this.plugins.delete(id)

    this.logger.debug('Plugin unregistered', { id, unsubscribed: unsubCount })
  }

  list(): string[] {
    return [...this.plugins.keys()]
  }

  get(id: string): PluginRegistration | undefined {
    return this.plugins.get(id)
  }

  private toBrokerError(err: unknown, pluginId: string): import('../types/error').BrokerError {
    return createBrokerError({
      code: 'plugin.lifecycle.failed',
      category: 'plugin',
      message: err instanceof Error ? err.message : String(err),
      originalError: err instanceof Error ? err : undefined,
      details: { pluginId },
    })
  }
}
```

### `core/broker.ts` — composizione interna

```ts
import { EventBus } from './bus'
import { PluginRegistry } from './plugin-registry'
import { TopicRegistry } from './topic-registry'
import { createConsoleLogger } from './logger'
import { noopEventTap } from './event-tap'
import type { BrokerConfig } from '../types/config'
import type { BrokerEvent } from '../types/broker-event'
import type { Subscription, SubscribeOptions } from '../types/subscription'
import type { PluginDescriptor } from '../types/plugin'
import type { BrokerLogger, LogLevel } from '../types/logger'
import type { EventTap, PipelineStep } from '../types/tap'
import { createBrokerEvent, type PublishParams } from './event-factory'

export class Broker {
  private bus: EventBus
  private plugins: PluginRegistry
  private topics = new TopicRegistry()
  private logger: BrokerLogger
  private tap: EventTap
  private debugMode: boolean

  constructor(config: BrokerConfig = {}) {
    const isDev = (typeof import.meta !== 'undefined' && (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV) ?? false
    this.debugMode = config.runtime?.debug ?? isDev
    this.logger = config.runtime?.logger ?? createConsoleLogger(config.runtime?.logLevel ?? 'info')
    this.tap = config.runtime?.tap ?? noopEventTap

    this.bus = new EventBus(this.logger, this.tap, { debug: this.debugMode })
    this.plugins = new PluginRegistry(
      this.bus,
      this.logger,
      (id, signal) => ({
        id,
        logger: this.logger,
        broker: this,
        signal,
      }),
    )
  }

  publish<T>(topic: string, payload: T, options: Omit<PublishParams<T>, 'topic' | 'payload'> = {}): void {
    const event = createBrokerEvent({ topic, payload, ...options }, undefined)
    this.topics.register(topic)
    this.bus.publish(event)
  }

  subscribe(
    pattern: string,
    handler: (event: BrokerEvent) => void | Promise<void>,
    options: SubscribeOptions = {},
  ): Subscription {
    return this.bus.subscribe(pattern, handler, options)
  }

  registerPlugin(descriptor: PluginDescriptor): Promise<void> {
    return this.plugins.register(descriptor)
  }

  unregisterPlugin(id: string): Promise<void> {
    return this.plugins.unregister(id)
  }

  getTopicRegistry(): readonly string[] {
    return this.topics.list()
  }

  setLogger(logger: BrokerLogger): void {
    this.logger = logger
  }

  enableDebug(): void {
    this.debugMode = true
    this.bus.setDebugMode(true)
  }

  disableDebug(): void {
    this.debugMode = false
    this.bus.setDebugMode(false)
  }

  getDebugSnapshot(): {
    topics: string[]
    subscriberCount: Record<string, number>
    pluginIds: string[]
    pendingAsyncDelivery: number
    logLevel: LogLevel
    pipelineSteps: PipelineStep[]
  } {
    const stats = this.bus.getStats()
    return {
      topics: stats.topics,
      subscriberCount: stats.subscriberCount,
      pluginIds: this.plugins.list(),
      pendingAsyncDelivery: stats.pendingAsyncDelivery,
      logLevel: 'info',                  // TODO: track actual current level
      pipelineSteps: [
        'event.received',
        'event.metadata.enriched',
        'event.validated',
        'event.dedupe.checked',
        'event.delivered',
      ],
    }
  }
}
```

### `public-factory.ts` (D-19)

```ts
import { Broker } from './core/broker'
import type { BrokerConfig } from './types/config'
import * as v from 'valibot'

const BrokerConfigSchema = v.object({
  runtime: v.optional(v.object({
    debug: v.optional(v.boolean()),
    deepFreezeInDev: v.optional(v.boolean()),
    logLevel: v.optional(v.picklist(['silent', 'error', 'warn', 'info', 'debug', 'trace'])),
    logger: v.optional(v.unknown()),     // structural check at runtime
    tap: v.optional(v.unknown()),
  })),
  debug: v.optional(v.unknown()),
  // F2-F6 sections: tolerant
  topicSchemas: v.optional(v.unknown()),
  canonicalModel: v.optional(v.unknown()),
  aliasRegistry: v.optional(v.unknown()),
  transforms: v.optional(v.unknown()),
  routes: v.optional(v.unknown()),
  transport: v.optional(v.unknown()),
  workers: v.optional(v.unknown()),
  cache: v.optional(v.unknown()),
})

export function createBroker(config: BrokerConfig = {}): Broker {
  const parsed = v.safeParse(BrokerConfigSchema, config)
  if (!parsed.success) {
    throw new Error(`Invalid BrokerConfig: ${parsed.issues.map((i) => i.message).join('; ')}`)
  }
  return new Broker(config)
}
```

### `index.ts` — public API surface

```ts
export { createBroker } from './public-factory'
export { Broker } from './core/broker'
export type {
  BrokerEvent,
  EventSource,
  DeliveryMode,
  Priority,
  EventId,
} from './types/broker-event'
export type { Subscription, SubscribeOptions } from './types/subscription'
export type {
  PluginDescriptor,
  PluginContext,
  PluginState,
} from './types/plugin'
export type { BrokerError, ErrorCategory } from './types/error'
export { isBrokerError, createBrokerError } from './core/broker-error'
export type { BrokerLogger, LogLevel } from './types/logger'
export type { EventTap, PipelineStep, PipelineSnapshot } from './types/tap'
export type { BrokerConfig } from './types/config'
export type { DeepReadonly } from './types/deep-readonly'
```

**Convenzioni naming (D-19, ARCHITECTURE.md):**
- `lowerCamelCase` per metodi/funzioni (`createBroker`, `registerPlugin`, `unsubscribe`).
- `PascalCase` per tipi/interfacce/classi (`Broker`, `BrokerEvent`, `Subscription`, `PluginDescriptor`).
- `SCREAMING_SNAKE_CASE` per costanti.
- `snake_case` riservato per i campi del canonical model (F2 — non in F1).

---

## Test patterns

### Strategia 3-livelli adattata a F1

| Livello | Ambiente | F1 usage | Future |
|---------|----------|----------|--------|
| **Unit** | jsdom | Maggior parte dei test (broker logic non DOM-dependent ma test eseguiti in jsdom per coerenza con le fasi successive) | F2-F6 estendono |
| **Integration mid** | jsdom | Pub/sub end-to-end, plugin lifecycle, EventTap spy verifica step pipeline | F3 aggiunge `msw` |
| **Browser real** | `@vitest/browser` + Playwright | **NON usato in F1** (placeholder install) | F4 (SSE/WS), F5 (Worker) |

### `PipelineHarness` — fixture condivisa

Ubicazione: `packages/core/src/test-utils/pipeline-harness.ts` (esposto solo in `package.json#exports['./test-utils']` se serve cross-package; in F1 può rimanere interno).

```ts
import type { EventTap, PipelineStep, PipelineSnapshot } from '../types/tap'
import type { BrokerEvent } from '../types/broker-event'
import { Broker } from '../core/broker'

export interface PipelineHarness {
  broker: Broker
  steps: Array<{ step: PipelineStep; snapshot: PipelineSnapshot }>
  reset(): void
  byStep(step: PipelineStep): PipelineSnapshot[]
}

export function createPipelineHarness(): PipelineHarness {
  const steps: PipelineHarness['steps'] = []
  const tap: EventTap = {
    onPipelineStep: (step, snapshot) => {
      steps.push({ step, snapshot })
    },
  }
  const broker = new Broker({ runtime: { tap, logLevel: 'silent' } })
  return {
    broker,
    steps,
    reset() { steps.length = 0 },
    byStep(step) {
      return steps.filter((s) => s.step === step).map((s) => s.snapshot)
    },
  }
}

export function brokerEvent<T>(overrides: Partial<BrokerEvent<T>> = {}): BrokerEvent<T> {
  return {
    id: overrides.id ?? 'test-id',
    topic: overrides.topic ?? 'test.topic',
    timestamp: overrides.timestamp ?? Date.now(),
    source: overrides.source ?? { type: 'plugin', id: 'test-plugin' },
    payload: overrides.payload as never,
    deliveryMode: overrides.deliveryMode ?? 'sync',
    priority: overrides.priority ?? 'normal',
    ...overrides,
  } as BrokerEvent<T>
}
```

### Suite per modulo (TEST-01 subset, TEST-03 subset)

**Unit tests (pure logic):**

| File | What it tests |
|------|---------------|
| `topic-matcher.test.ts` | `validateTopic` regex, `validateTopicPattern`, `TopicTrie.insert/remove/match` (incluso D-11 `weather.*.failed` matcha `weather.alert.failed`), edge cases (empty, multi-wildcard), idempotenza insertion |
| `event-factory.test.ts` | `createBrokerEvent` con/senza id custom (nanoid default), timestamp default, source obbligatorio (throw se missing), deliveryMode default, priority default |
| `event-validator.test.ts` | Valibot schema rifiuta event con id mancante / topic invalido / source mancante / source.id empty / priority non valida; accetta event minimo valido |
| `broker-error.test.ts` | `createBrokerError` con tutti i field; `Error.cause` set per ES2022; `isBrokerError` type guard |
| `deep-freeze.test.ts` | Object/Array nested → frozen; cycle protection; Date skipped (default); Map/Set freezed; mutation throw in strict mode; performance guard (10000 keys < 50ms) |
| `logger.test.ts` | Console logger livelli (silent no-op, error → console.error, ecc.); namespace prefix presente; meta passato come secondo arg |
| `lifecycle.test.ts` | `transitionState` valide / invalide per ogni stato; throw su transizione non permessa con messaggio chiaro |

**Integration tests (jsdom, broker reale):**

| File | What it tests | REQ-ID |
|------|---------------|--------|
| `bus.integration.test.ts` | publish + subscribe end-to-end; subscription handle ritornato; unsubscribe smette di ricevere; idempotenza `unsubscribe()` chiamato due volte; FIFO order via async (publish A, B, C → consumer riceve A, B, C); sync mode immediato | CORE-01, CORE-02, D-01 |
| `wildcard.integration.test.ts` | `weather.*` riceve `weather.requested` e `weather.loaded`; `*.failed` riceve `weather.failed`/`auth.failed`; `weather.*.failed` matcha `weather.alert.failed` | CORE-09, D-11 |
| `topic-validation.integration.test.ts` | publish con topic invalido (`Weather.Requested`, `weather/requested`, `weather..requested`) → throw `BrokerError.code: 'topic.invalid'` | CORE-08, D-24 |
| `event-tap.integration.test.ts` | `createPipelineHarness` riceve i 5 step in ordine per ogni publish (received → enriched → validated → dedupe-checked → delivered); errore in tap NON rompe la pipeline (D-20); snapshot include payloadAfter solo in debug mode | CORE-13, D-20 |
| `plugin-lifecycle.integration.test.ts` | registerPlugin chiama `onRegister` → `onMount`; unregisterPlugin chiama `onUnmount` → `onDestroy`; ordine D-25 verificato; plugin id duplicato → throw `plugin.id.duplicate`; mount fail → state `failed` | CORE-04, CORE-05, D-17, D-25 |
| `plugin-cleanup.integration.test.ts` | **Test deterministico LIFE-02 (chiusura PRD §39 #7)**: register plugin con 5 subscription + AbortController in volo → unregisterPlugin → `getDebugSnapshot()` mostra subscriberCount, pluginIds tornati al pre-registrazione; AbortSignal del plugin context fired | CORE-11, LIFE-02, D-26 |
| `handler-isolation.integration.test.ts` | Handler che lancia eccezione → broker continua; system.error pubblicato con BrokerError.category='plugin'; handler async rejected → idem | CORE-12, ERR-01, ERR-03, D-16 |
| `deep-freeze.integration.test.ts` | Subscriber muta `event.payload.foo = 'bar'` in dev mode → throw TypeError; in production (`debug: false`) → silently ignored; nested object idem | D-04, D-05 |

**Robustness tests (TEST-03 subset):**

| File | What it tests |
|------|---------------|
| `storm.test.ts` | Publish 10000 eventi su singolo topic (5 subscriber, async delivery) → tutti consegnati, FIFO, no leak. Verifica `pendingAsyncDelivery` torna a 0. Wall-clock < 5s in jsdom. |
| `wildcard-perf.test.ts` | 10000 subscriber wildcard distinti → 1 publish con `match()` ritorna in < 5ms (lookup O(segments)). |
| `plugin-fault.test.ts` | Plugin con `onMount` che throw → state `failed`, broker continua a funzionare; secondo plugin con id valido si registra correttamente. |
| `concurrent-unregister.test.ts` | Plugin con handler async pendente; unregisterPlugin → AbortSignal fires; handler successivo finisce ma il system.error per ownerId del plugin smontato non viene consegnato (subscription rimossa). |

### Test eseguibili (planner DEVE includere questi comandi nel plan)

```bash
# Quick run (per task commit, < 30s):
pnpm -F @gluezero/core test

# Watch:
pnpm -F @gluezero/core test:watch

# Coverage:
pnpm -F @gluezero/core test:coverage

# Typecheck:
pnpm -F @gluezero/core typecheck

# Build smoke test:
pnpm -F @gluezero/core build && node -e "import('@gluezero/core').then(m => console.log(Object.keys(m)))"
```

---

## Pitfall mitigation table (specifico per F1)

| Pitfall | Riferimento PITFALLS.md | Mitigazione in F1 |
|---------|-------------------------|--------------------|
| **#1 Memory leak da subscribe persistenti** (BLOCKING) | §1 | (a) `subscribe → Subscription` (D-27); (b) AbortSignal-first nelle SubscribeOptions; (c) owner-based registry: ogni subscription ha `ownerId = pluginId`; (d) `unregisterPlugin` cascade D-26 con `bus.unsubscribeByOwner(id)`; (e) test deterministico `plugin-cleanup.integration.test.ts` con tolleranza zero |
| **#3 Canonical model drift** (BLOCKING) | §3 | NOT in F1 (F2 territory). F1 stabilizza solo i tipi `BrokerEvent`, `EventSource`, `PluginDescriptor` con TS strict; F2 estenderà `PluginDescriptor` con `inputMap`/`outputMap` via TS declaration merging senza breaking. |
| **#9 Plugin isolation insufficiente** (HIGH) | §9 | (a) try/catch attorno a OGNI handler in `runHandler`; (b) Promise rejected → `.catch()` automatico; (c) `system.error` publish via queueMicrotask (D-16); (d) deep-freeze payload in dev mode (D-04); (e) test `handler-isolation.integration.test.ts` |
| **#11 API design tranelli** (BLOCKING) | §11 | (a) `subscribe` ritorna **`Subscription`** non `void` (CORE-02, D-27); (b) topic naming validato con regex (D-24, CORE-08) — fail al publish; (c) **deep-freeze del payload (D-04, D-05)** prevenne mutazione condivisa; (d) tipi TS espliciti per `PublishParams` / `SubscribeOptions` con JSDoc |
| **#12 TypeScript pitfalls** | §12 | `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, branded types per `EventId`, `DeepReadonly<T>` per payload, `as never` solo in event-factory dove safe |
| **#13 Build / distribution** | §13 | (a) ESM-only V1 (no dual-package hazard); (b) `sideEffects: false`; (c) `package.json#exports` con `types` prima di `import`; (d) CI gates: `publint` + `attw` + `size-limit`; (e) provenance attestations |
| **#14 Open issues PRD §39** | §14 | F1 chiude #7 (LIFE-02 cascade) con D-26 + test deterministico. Altri 10 punti rimangono per F2-F6 (mappati in ROADMAP.md) |
| **#16 Performance wildcard scan** | §16 | Trie segmentato (D-08); test `wildcard-perf.test.ts` con N=10000 subscriber + lookup < 5ms (D-09 lookup `O(segments)`) |
| **Stack overflow re-entrancy** | n/a | Default `deliveryMode: 'async'` (D-01) via `queueMicrotask` previene infinite recursion handler→publish stesso topic. Test esplicito |
| **Race condition timeout vs success** | §2.C | NOT in F1 (F5 worker). Documentato nel tipo `BrokerEvent.deliveryMode: 'worker'` ma no-op in F1 con warning fallback (D-03) |

---

## Open issues PRD §39 closure plan (F1)

F1 chiude **1 su 11** open issues PRD §39:

| # | Open Issue | F1 Closure Strategy |
|---|------------|---------------------|
| 7 | Unsubscribe automatico in `unregisterPlugin` | **CHIUSURA F1** via D-26 cascade: (1) `bus.unsubscribeByOwner(pluginId)` rimuove tutte le subscription; (2) `reg.abortController.abort()` fires AbortSignal a tutti i listener registrati con `signal`; (3) test deterministico `plugin-cleanup.integration.test.ts` verifica `getDebugSnapshot()` post-unregister == pre-registrazione (counter zero); (4) JSDoc su `unregisterPlugin` documenta il contratto cascade |

**Altri punti PRD §39:**
- #1 (alias mapping) → F2
- #2 (ordine pipeline) → F1 SKELETON (5 step instrumentati con tap), F2-F6 estendono
- #3, #4 (validation field/transform) → F2
- #5, #6, #8 (route policy) → F3
- #9 (realtime reconnect) → F4
- #10 (metriche format) → F6
- #11 (worker serializzazione) → F5

F1 NON deve toccare/anticipare gli altri 10 punti. Sono fuori scope.

---

## State of the Art

| Old approach (non per F1) | Current approach (F1) | Why |
|---------------------------|------------------------|-----|
| `EventEmitter` Node API | EventBus in-house con trie segmentato | EventEmitter non ha wildcard, dedupe, priority, metadata strutturati (PITFALLS §11) |
| `mitt` / `eventemitter3` | EventBus in-house | Troppo magri per BrokerEvent — coprono ~10% dei requisiti F1 |
| `RxJS Subject` come API pubblica | API callback-based `subscribe(topic, handler)` | RxJS overkill (~25-30 KB), paradigma observable estraneo a PRD §16.2 |
| `uuid` v4 | `nanoid` 5.1.9 | 5x più piccolo (130 B vs 5-6 KB), URL-safe |
| Webpack/Parcel | `tsup` 8.5.1 | Zero-config esbuild, dts integrato, output ESM clean per librerie |
| Jest | Vitest 4.1.5 | ESM-first, watch mode rapido, browser mode con Playwright |
| Yarn/Lerna | `pnpm` 10.33.2 workspaces | Hoisting strict, dep fantasma rilevabili, no Lerna deprecato |
| ESLint+Prettier | Biome 2.4.13 | One-tool 10-30x più veloce, schema 2.x stable |

**Deprecated/da NON usare in F1:**
- `Worker` con classic script (`type: 'classic'`) → no top-level await (anche se F5 territory).
- `Object.freeze` shallow → usa il nostro `deepFreeze` (D-05).
- `console.log` non-prefixed → usa `BrokerLogger` (D-12).

---

## Validation Architecture

> `workflow.nyquist_validation` non esplicitamente settato in `.planning/config.json` (controllato — file mostra `mode: yolo`, `parallelization: true`, niente nyquist_validation). Trattato come **enabled** secondo policy default.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 |
| Config file | `packages/core/vitest.config.ts` (creato in Wave 0) |
| Quick run command | `pnpm -F @gluezero/core test` |
| Full suite command | `pnpm test` (ricorsivo su tutti i workspace package) |
| Coverage command | `pnpm -F @gluezero/core test:coverage` |
| Typecheck | `pnpm -F @gluezero/core typecheck` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CORE-01 | publish + subscribe end-to-end | integration jsdom | `pnpm -F @gluezero/core test bus.integration.test.ts` | ❌ Wave 0 |
| CORE-02 | `subscribe` ritorna `Subscription` con `unsubscribe()` idempotente | integration jsdom | `pnpm -F @gluezero/core test bus.integration.test.ts -t "Subscription"` | ❌ Wave 0 |
| CORE-03 | TopicRegistry traccia topic | unit | `pnpm -F @gluezero/core test topic-registry.test.ts` | ❌ Wave 0 |
| CORE-04 | registerPlugin / unregisterPlugin | integration jsdom | `pnpm -F @gluezero/core test plugin-lifecycle.integration.test.ts` | ❌ Wave 0 |
| CORE-05 | Lifecycle hooks chiamati nell'ordine | integration jsdom | `pnpm -F @gluezero/core test plugin-lifecycle.integration.test.ts -t "lifecycle order"` | ❌ Wave 0 |
| CORE-06 | BrokerEvent shape rispettata | unit | `pnpm -F @gluezero/core test event-factory.test.ts` | ❌ Wave 0 |
| CORE-07 | id univoco / timestamp / source | unit | `pnpm -F @gluezero/core test event-factory.test.ts -t "defaults"` | ❌ Wave 0 |
| CORE-08 | Topic naming validation | unit + integration | `pnpm -F @gluezero/core test topic-validation.integration.test.ts` | ❌ Wave 0 |
| CORE-09 | Wildcard subscribe | integration | `pnpm -F @gluezero/core test wildcard.integration.test.ts` | ❌ Wave 0 |
| CORE-10 | Logging livelli | unit | `pnpm -F @gluezero/core test logger.test.ts` | ❌ Wave 0 |
| CORE-11 | Cascade unsubscribe (LIFE-02) | integration | `pnpm -F @gluezero/core test plugin-cleanup.integration.test.ts` | ❌ Wave 0 |
| CORE-12 | Plugin handler error isolation | integration | `pnpm -F @gluezero/core test handler-isolation.integration.test.ts` | ❌ Wave 0 |
| CORE-13 | EventTap instrumented sui 5 step | integration | `pnpm -F @gluezero/core test event-tap.integration.test.ts` | ❌ Wave 0 |
| CORE-14 | createBroker config validation | integration | `pnpm -F @gluezero/core test public-factory.test.ts` | ❌ Wave 0 |
| VAL-01 | Validazione sintattica BrokerEvent | unit | `pnpm -F @gluezero/core test event-validator.test.ts` | ❌ Wave 0 |
| VAL-06 | Schema definitions | implicit (tipo Valibot) | typecheck | ❌ Wave 0 |
| ERR-01 | BrokerError factory | unit | `pnpm -F @gluezero/core test broker-error.test.ts` | ❌ Wave 0 |
| ERR-03 | Errori isolati | integration | (covered by handler-isolation + plugin-fault) | ❌ Wave 0 |
| LIFE-01 | Subscribe ritorna handle | covered by CORE-02 | (same) | (same) |
| LIFE-02 | Unregister cascade | covered by CORE-11 | (same) | (same) |
| TEST-01 (subset) | Suite core deterministica | (covered by all above) | `pnpm -F @gluezero/core test` | ❌ Wave 0 |
| TEST-03 (subset) | Storm + plugin malconfigurato | robustness | `pnpm -F @gluezero/core test storm.test.ts plugin-fault.test.ts` | ❌ Wave 0 |
| PKG-01..PKG-04 | Packaging | CI gate | `pnpm ci:publint && pnpm ci:attw && pnpm ci:size` | ❌ Wave 0 |
| DOC-01 | API skeleton docs | manual review | (typedoc + README presenti) | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm -F @gluezero/core test` (suite completa core < 30s in jsdom)
- **Per wave merge:** `pnpm test` (workspace-wide; in F1 solo core ha test, ma comando funziona)
- **Phase gate:** `pnpm test && pnpm typecheck && pnpm lint && pnpm ci:publint && pnpm ci:attw && pnpm ci:size && pnpm -F @gluezero/core build` — tutto verde prima di `/gsd-verify-work`.

### Wave 0 Gaps

Tutti i file test e config devono essere creati in Wave 0 (greenfield):

- [ ] `packages/core/vitest.config.ts` — Vitest config con jsdom
- [ ] `packages/core/src/test-utils/pipeline-harness.ts` — fixture condivisa
- [ ] `packages/core/src/types/__tests__/` (vuoto, types-only)
- [ ] `packages/core/src/core/topic-matcher.test.ts`
- [ ] `packages/core/src/core/event-factory.test.ts`
- [ ] `packages/core/src/core/event-validator.test.ts`
- [ ] `packages/core/src/core/broker-error.test.ts`
- [ ] `packages/core/src/core/deep-freeze.test.ts`
- [ ] `packages/core/src/core/logger.test.ts`
- [ ] `packages/core/src/core/lifecycle.test.ts`
- [ ] `packages/core/src/core/topic-registry.test.ts`
- [ ] `packages/core/src/__integration__/bus.integration.test.ts`
- [ ] `packages/core/src/__integration__/wildcard.integration.test.ts`
- [ ] `packages/core/src/__integration__/topic-validation.integration.test.ts`
- [ ] `packages/core/src/__integration__/event-tap.integration.test.ts`
- [ ] `packages/core/src/__integration__/plugin-lifecycle.integration.test.ts`
- [ ] `packages/core/src/__integration__/plugin-cleanup.integration.test.ts` (**LIFE-02 deterministico**)
- [ ] `packages/core/src/__integration__/handler-isolation.integration.test.ts`
- [ ] `packages/core/src/__integration__/deep-freeze.integration.test.ts`
- [ ] `packages/core/src/__integration__/storm.test.ts`
- [ ] `packages/core/src/__integration__/wildcard-perf.test.ts`
- [ ] `packages/core/src/__integration__/plugin-fault.test.ts`
- [ ] `packages/core/src/__integration__/concurrent-unregister.test.ts`
- [ ] Framework install: `pnpm install` (dopo creazione package.json root) — **richiesto BEFORE qualunque test**

---

## Security Domain

> `security_enforcement` non esplicitamente settato. F1 è codice browser-runtime puro senza network, auth, persistenza dati utente, crittografia. Surface attacco minimale.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | F3 territory (header auth gateway, SEC-01) |
| V3 Session Management | no | non applicabile a libreria broker |
| V4 Access Control | no | F3 territory (URL allowlist, SEC-05) |
| V5 Input Validation | **yes** | Valibot 1.3.1 per `BrokerConfig` (D-18) e `BrokerEvent` shape (VAL-01); regex topic naming (D-24) |
| V6 Cryptography | no | F1 non genera token, hash, secret. nanoid usa `crypto.getRandomValues` ma è ID non secret |
| V14 Configuration | partial | `package.json#exports` lock, `sideEffects: false`, `provenance: true` (npm supply chain) |

### Known Threat Patterns for `@gluezero/core`

| Pattern | STRIDE | Mitigation in F1 |
|---------|--------|---------------------|
| Plugin malevolo che sniffa eventi non destinati | Information disclosure | Naming convention forzata (CORE-08); plugin sub solo a topic noti; pattern wildcard validati |
| Plugin malevolo che spoof `event.source` | Spoofing | Source validation: `EventSource.id` deve corrispondere al pluginId del caller (TODO: enforcement in F2 con plugin-scoped publish?) |
| Mutazione condivisa del payload tra subscriber (pattern accidentale + pattern malevolo) | Tampering | Deep-freeze in dev mode (D-04, D-05); tipo `DeepReadonly<T>` |
| Re-entrancy stack overflow (handler ri-pubblica stesso topic) | Denial of Service | Default `deliveryMode: 'async'` con `queueMicrotask` (D-01); test esplicito |
| Plugin handler che lancia eccezione → broker collassa | Denial of Service | try/catch + `system.error` publish (D-16, CORE-12, ERR-03) |
| Bundle supply chain (npm install untrusted package) | Tampering | `pnpm` lockfile + `provenance: true` per pubblicazione npm; CI gate `publint` + `attw` |
| `noUncheckedIndexedAccess` bypass via `any` | Tampering (TS) | Biome `noExplicitAny: error` |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | TS 6.0.3 introduce solo breaking minori rispetto a TS 5.5; `isolatedDeclarations` resta stable | Stack versions § Salti di versione | Se major breaking, planner deve sostituire con TS 5.6.x ultima → cambia `tsconfig.base.json` |
| A2 | Vitest 4.1.5 mantiene API jest-like compatibile con codice esempio v2.x | Stack versions § Salti di versione | Se Vitest 4 cambia API in modo significativo, test setup va riscritto |
| A3 | Biome 2.4.13 schema URL `https://biomejs.dev/schemas/2.4.13/schema.json` è corretto (verificato per pattern; non visitato live) | Config files § biome.json | Se errato URL, IDE warn ma `biome check` funziona ugualmente |
| A4 | `import.meta.env.DEV` disponibile via tooling Vite/tsup standard; fallback `false` se undefined | core/broker.ts | Se non disponibile in environment specifico, `debugMode` default a `false` (production-like) |
| A5 | `queueMicrotask` API stabile in tutti i browser evergreen 2026 | bus.ts § dispatchAsync (D-01) | Falso negativo improbabile; `queueMicrotask` è ES2018 universale |
| A6 | `nanoid` 5.1.9 ESM-only senza problemi di compatibilità con tsup ESM output | event-factory.ts | Se dual ESM/CJS issue, downgrade a v3 (CJS-compatible) |
| A7 | Valibot 1.3.1 API `v.safeParse` / `v.picklist` / `v.pipe` stabili dalla 1.0 | event-validator.ts, public-factory.ts | Se breaking minor, leggere CHANGELOG e aggiornare snippet |
| A8 | Test deterministici LIFE-02 (cascade) sufficienti senza sondare pendenti AbortController in modo asincrono | Test patterns § plugin-cleanup | Test potrebbe essere flaky se microtask non flushate prima di assert; mitigazione: `await new Promise(r => queueMicrotask(r))` prima di snapshot |
| A9 | `NoopEventTap.onPipelineStep = () => {}` zero overhead V8 dopo monomorphic JIT | event-tap.ts | Improbabile; benchmark in F6 se serve |
| A10 | `pnpm changeset publish` con `private: true` su 6 placeholder li ignora silenziosamente | .changeset/config.json | Se `changesets` warna, mettere espliciti in `ignore` (già fatto) |
| A11 | Subscription `{ once: true }` è OUT OF SCOPE F1 salvo decisione planner | types/subscription.ts | Se planner sceglie di includere, ~10 LOC aggiuntive in `bus.ts` (decremento active dopo prima delivery) |
| A12 | `getDebugSnapshot()` non deve esporre payload completo per default in production | broker.ts | Se servono payload completi, deve essere opt-in via `enableDebug()` (D-29); già coperto |

**Note:** queste assunzioni sono operative — il planner può procedere; eventuali falsificazioni durante implementazione richiedono adeguamenti minori, mai redesign.

---

## Open Questions

1. **Subscription `{ once: true }` — includere in F1?**
   - What we know: CONTEXT marca come "Deferred Idea, raccomandato come ~10 LOC".
   - What's unclear: nessun REQ-ID lo richiede esplicitamente.
   - Recommendation: **planner DECIDE**. Se incluso, è ~15 LOC in `bus.ts`/`runHandler` (`if (sub.options.once) this.unsubscribeInternal(sub.id)`) + 1 test. Costo trascurabile, valore DX significativo.

2. **`TopicRegistry` emette `system.topic.registered`?**
   - What we know: D-28 menziona `topics: string[]` in snapshot. CONTEXT non specifica se emit di evento.
   - What's unclear: il PRD §10 cita "Topic Registry pubblica/traccia tutti i topic noti" — "pubblica" potrebbe significare "espone" o "pubblica come evento".
   - Recommendation: **interpretazione tactical**: "pubblica" = "espone via `getTopicRegistry()`" (CORE-03 lo conferma). Niente emit di evento `system.topic.registered` in F1. Aggiungere se F6 lo richiede per Inspector.

3. **`getDebugSnapshot()` traccia il `logLevel` corrente?**
   - What we know: D-28 dice `logLevel: LogLevel`.
   - What's unclear: il `Broker` non traccia il log level corrente esplicitamente — il `ConsoleLogger` lo conosce internamente.
   - Recommendation: **planner**: il `Broker` deve memorizzare `currentLogLevel: LogLevel` (campo privato) sincronizzato col logger creato. Snapshot lo legge. ~5 LOC.

4. **Pubblicazione iniziale F1 → V0.1.0 alpha o V0.0.0?**
   - What we know: CONTEXT non lo chiede; SUMMARY raccomanda di pubblicare aggregato in F2+.
   - What's unclear: utenti early-adopter vorrebbero un alpha?
   - Recommendation: **NO publish in F1**. `version: "0.0.0"` con `private: false` ma niente `pnpm changeset publish`. Primo release pubblico = fine F2 (canonical model è il valore differenziante).

5. **`AbortController` per plugin context — quando `abort()`?**
   - What we know: D-26 dice "AbortController firing" nel cascade.
   - What's unclear: quando esattamente nel flow `unregisterPlugin`?
   - Recommendation: **abort PRIMA di onDestroy ma DOPO onUnmount** — così `onUnmount` può fare cleanup ordinato vedendo `signal.aborted === false`, e `onDestroy` lo vede già `true`. Documentato in JSDoc su `PluginContext.signal`.

---

## Risk Register

| Rischio | Probabilità | Impatto | Mitigazione |
|---------|------------|---------|--------------|
| Vitest 4 breaking changes vs esempi v2 in STACK.md | MEDIA | MEDIO | Planner consulta docs Vitest 4 corrente. Snippet `vitest.config.ts` qui sopra è già aggiornato per v4. |
| TS 6.0 type errors su pattern v5.5 | BASSA | MEDIO | Già verificato `isolatedDeclarations` stable in TS 6; flag `verbatimModuleSyntax` invariato. |
| `corepack` non disponibile su CI runner | BASSA | BASSO | Fallback documentato: `npm install -g pnpm@10.33.2` |
| Performance trie wildcard < 5ms con 10k subscriber non raggiunta | BASSA | MEDIO | Test `wildcard-perf.test.ts` come gate; se fallisce, micro-ottimizzazioni (es. evitare spread `[...]` in hot path, riutilizzare array buffer). |
| Deep-freeze ricorsivo lento su payload grandi (> 1000 keys) | MEDIA | BASSO | Solo in dev mode (D-04 production skipped); WeakSet cycle protection già ottimizzata. |
| Plugin lifecycle state machine ha edge case non coperto | MEDIA | MEDIO | Test esaustivo `lifecycle.test.ts` per ogni transizione VALID_TRANSITIONS; edge case `failed` → ricovery non in F1 (planner valuta). |
| `system.error` recursion se broker stesso fallisce | BASSA | ALTO | Pattern `queueMicrotask + try/catch + last-resort logger.error` (vedi `bus.ts handleHandlerError`); test `handler-isolation` lo valida. |
| `PipelineHarness` snapshot include payload reale (memory leak in test) | BASSA | BASSO | Test `reset()` chiamato in `beforeEach`. |
| `package.json#exports` malformed → import fallisce per consumer | MEDIA | ALTO | CI gates `publint` + `attw` obbligatori prima di `/gsd-verify-work`. |
| Granularità monorepo 7-package over-engineering per F1 | BASSA | BASSO | F1 popola solo `@gluezero/core`; consolidamento eventuale in F1.x dopo F2 review. |
| Branded type `EventId` causa friction TS in test | BASSA | BASSO | Helper `brokerEvent()` in pipeline-harness.ts cast as needed; `as EventId` ammesso in test. |

---

## Sources

### Primary (HIGH confidence)

- **npm registry** (queries 2026-04-28) — versioni esatte tutti i package: `[VERIFIED: npm view 2026-04-28]`
  - typescript@6.0.3, tsup@8.5.1, vitest@4.1.5, @biomejs/biome@2.4.13, @changesets/cli@2.31.0, nanoid@5.1.9, valibot@1.3.1, jsdom@29.1.0, happy-dom@20.9.0, msw@2.13.6, playwright@1.59.1, typedoc@0.28.19, publint@0.3.18, @arethetypeswrong/cli@0.18.2, size-limit@12.1.0, comlink@4.4.2, idb@8.0.3, pnpm@10.33.2 (all verified)
- **Project artifacts:**
  - `prd.md` — fonte autoritativa GlueZero (§10, §11, §12, §15, §16, §22, §24, §25.4, §27, §28, §31, §33.2, §39, §42)
  - `.planning/REQUIREMENTS.md` — 28 REQ-ID di Phase 1
  - `.planning/ROADMAP.md` — Phase 1 goal, scope, success criteria
  - `.planning/research/STACK.md` — stack rationale (rationale verificato; versioni superseded da live npm view 2026-04-28)
  - `.planning/research/ARCHITECTURE.md` — pattern Mediator + Pipes-and-Filters + Wire Tap + EventTap pre-instrumented
  - `.planning/research/PITFALLS.md` — 17 pitfall (#1, #11, #14, #16 critici per F1)
  - `.planning/research/SUMMARY.md` — sintesi orientata planning
  - `.planning/phases/01-core-essenziale/01-CONTEXT.md` — 30 decisioni locked (D-01..D-30)
  - `CLAUDE.md` — vincoli operativi progetto

### Secondary (MEDIUM confidence)

- TypeScript handbook (Microsoft) — `isolatedDeclarations`, `verbatimModuleSyntax`, `moduleResolution: Bundler` `[CITED: training data Q1 2026]`
- MDN — `Object.freeze`, `queueMicrotask`, `WeakSet`, `AbortController`, `AbortSignal` `[CITED: training data]`
- Hohpe & Woolf — *Enterprise Integration Patterns* (2003) — Mediator, Pipes-and-Filters, Wire Tap (capp. 3, 7, 10) `[CITED: PRD §10 references]`
- pnpm workspaces docs — `workspace:^` protocol, `corepack` activation `[CITED: training data]`
- Biome 2.x changelog (schema URL change vs 1.x) `[ASSUMED dal pattern Biome semver]`
- Vitest 4.x docs (Vitest 4 lanciato Q4 2025) `[ASSUMED API stability vs 3.x]`

### Tertiary (LOW confidence — flagged in Assumptions)

- TS 6.0 breaking changes specifici vs 5.5 — non verificati live in questa sessione (A1)
- Vitest 4 API completa vs codice esempio v2/v3 in STACK.md (A2)
- Biome 2.4.13 schema URL exact match (A3)

---

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — versioni verificate live tramite `npm view` in questa sessione
- Architecture: **HIGH** — già pattern stabili da ARCHITECTURE.md, validati con ulteriore dettaglio implementativo
- Pitfalls: **HIGH** — 4 pitfall critici per F1 con mitigation prescrittiva
- API design: **HIGH** — 30 decisioni locked in CONTEXT.md riducono spazio decisionale
- Test patterns: **MEDIUM-HIGH** — Vitest 4 API potrebbe avere differenze minori vs snippet (A2)
- Documentation: **MEDIUM** — DOC-01 è skeleton, dettagli in F6
- Open issues PRD §39 closure: **HIGH** — solo #7 in F1, strategia chiara

**Research date:** 2026-04-28
**Valid until:** 2026-05-28 (30 giorni — stack stabile, ma re-verify versioni se planning slip > 30 giorni)

---

## RESEARCH COMPLETE
