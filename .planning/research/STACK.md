# Stack Research — SemBridge

**Domain:** Libreria JavaScript browser-side modulare (TypeScript-first, ESM) — broker pub/sub + routing dichiarativo + canonical model + gateway server + worker runtime + tooling
**Researched:** 2026-04-28
**Confidence complessivo:** MEDIO-ALTO

> **Nota metodologica importante:** durante questa ricerca le tool di accesso live al web (WebSearch, WebFetch, Brave Search, Context7 MCP, Exa, Firecrawl) non erano disponibili nell'ambiente di esecuzione. Le raccomandazioni si basano sul training data (cutoff gennaio 2026), che copre con buona affidabilità l'ecosistema 2024-2025 ma può essere stale per release di fine 2025/inizio 2026. Le versioni indicate sono "ultime conosciute al training" — verificare con `npm view <pkg> version` prima dell'install. Il **rationale architetturale** è invece robusto: indipendente dalle versioni esatte. Confidence per ogni raccomandazione esplicitato in tabella.

---

## Executive summary

Lo stack raccomandato per SemBridge è:

- **Build:** `tsup` (singola libreria) o `unbuild` se si sceglie monorepo + multi-target
- **Test:** `Vitest` con `@vitest/browser` (Playwright provider) per le suite che toccano Web Worker, fetch reali, SSE e WebSocket; `jsdom` o `happy-dom` per i test puramente unitari sul broker core
- **Validation:** `Valibot` per gli schemi pubblici e canonical model (tree-shakable, ~1-2 KB minified+gzipped per schema), con adapter pluggable per chi preferisce Zod
- **HTTP:** `fetch` nativo, con uno strato `Gateway` interno (retry/timeout/dedupe/auth) costruito in casa — non `ky`/`wretch`/`ofetch`. Rationale: il PRD richiede policy estese che vanno oltre quelle dei wrapper, e una libreria-middleware non deve trascinare wrapper opinionati
- **EventBus:** in-house. Mitt/eventemitter3 sono troppo poveri per l'evento `BrokerEvent` con metadata, lifecycle, dedupe, backpressure e wildcard. RxJS sarebbe overkill e introdurrebbe un paradigma estraneo all'API pubblica del PRD
- **Worker RPC:** `Comlink` 4.x per la message-bridge typed; in alternativa, RPC custom su `postMessage` se il footprint deve restare minimo (~0). Valutare al momento dell'implementazione fase 5
- **Realtime:** `EventSource` nativo (SSE) e `WebSocket` nativo, incapsulati in adapter interni con reconnection/backoff/heartbeat custom. Niente `reconnecting-websocket` né polyfill SSE: vincolo "polyfill separati dal core" del PRD §31.3
- **Serialization worker:** `structuredClone` nativo (algoritmo) via `postMessage`, con supporto opzionale a `superjson` come adapter quando servono Date/Map/Set/BigInt fuori dai limiti dell'algoritmo SCA
- **ID:** `nanoid` (~130 byte gzipped) per `BrokerEvent.id`, `correlationId`, `traceId`. Niente `uuid` (più pesante, meno URL-safe), niente `ulid` (non serve ordering temporale lessicografico per gli ID broker)
- **IndexedDB (futuro):** `idb` di Jake Archibald per V1.x quando si attiverà la persistenza opzionale (PRD §20.3)
- **TypeScript:** 5.5+ con `target: ES2022`, `module: ESNext`, `moduleResolution: Bundler`, strict suite completa, `verbatimModuleSyntax: true`
- **Lint/Format:** `Biome` (one-tool, fast). ESLint+Prettier solo se il team ha investimento storico in plugin ESLint specifici
- **Versioning:** `Changesets` (single-package o monorepo, allineato a npm publish)
- **Docs API:** `TypeDoc` con tema markdown per generazione automatica + esempi handwritten in `examples/`
- **Repo:** **monorepo `pnpm` workspaces** con i sub-system del PRD §10 (`@sembridge/core`, `@sembridge/mapper`, `@sembridge/gateway`, `@sembridge/worker`, `@sembridge/cache`, `@sembridge/devtools`) + `@sembridge/sembridge` come bundle pubblico aggregato. Niente Turbo/Nx in V1: pnpm workspaces + script root sono sufficienti

---

## Recommended Stack

### Core Technologies

| Technology | Version (ultima nota) | Purpose | Why Recommended | Confidence |
|------------|------------------------|---------|-----------------|------------|
| TypeScript | 5.5.x → 5.6.x | Linguaggio sorgente | Imposto da PRD §31.2 e PKG-02. La 5.5+ ha `using` declarations e isolated declarations utili per dts veloci | ALTO |
| pnpm | 9.x | Package manager + workspaces | Workspaces nativi con hoisting strict, ottimo per monorepo di librerie TS. Più rigoroso di npm/yarn nel rilevare deps fantasma — critico per una libreria pubblicata | ALTO |
| tsup | 8.x | Bundler della singola libreria | Zero-config su esbuild, supporta multi-format (ESM+CJS+IIFE), genera `.d.ts` con rollup-plugin-dts integrato, treeshaking decente. Molto comune per librerie TS pure | ALTO |
| Vitest | 2.x → 3.x | Test runner | Compatibile Vite, ESM-first, supporta `jsdom` + `happy-dom` + browser mode (Playwright). API jest-like. Watch mode veloce. È de-facto lo standard per librerie TS moderne | ALTO |
| Valibot | 1.x (stable) | Schema validation | Tree-shakable per design (pipe + functional API): paghi solo gli schema che importi. Tipicamente 5-10x più leggero di Zod a parità di expressivity. Ottimo per una libreria che vuole minimo footprint browser | MEDIO-ALTO |
| Biome | 1.9.x → 2.x | Linter + formatter | Single tool, scritto in Rust, ~10-30x più veloce di ESLint+Prettier. Configurazione minimale. Per una libreria TS moderna senza necessità di plugin ESLint esoterici è la scelta state-of-the-art | MEDIO-ALTO |
| Changesets | 2.x | Versioning + changelog | Standard per librerie pubblicate (incluso monorepo). Genera changelog Markdown da PR-friendly snippet. Compatibile con pnpm workspaces. Alternativa `semantic-release` più automatica ma meno granulare | ALTO |
| TypeDoc | 0.27.x → 0.28.x | API documentation | De-facto standard per documentazione di librerie TypeScript. Plugin `typedoc-plugin-markdown` per output integrabile in static site generator | ALTO |

### Supporting Libraries

| Library | Version (ultima nota) | Purpose | When to Use | Confidence |
|---------|------------------------|---------|-------------|------------|
| nanoid | 5.x | Generazione `BrokerEvent.id`, `correlationId`, `traceId` | Sempre. ~130 B gzipped, URL-safe alphabet, performance superiore a uuid v4. Default 21 char ≈ 126 bit di entropia (sufficiente per ID di sessione) | ALTO |
| Comlink | 4.4.x | RPC typed broker ↔ worker | Fase 5 (Worker runtime). Astrae `postMessage` in API tipo `proxy.method(args)`. Supporta transferable. ~1.1 KB gzipped. Ottimo DX. Alternativa: RPC custom (~200 LoC) se si vuole zero deps esterne | MEDIO-ALTO |
| idb | 8.x | IndexedDB adapter (opzionale) | Fase 6+ se/quando si attiverà persistenza cache. Wrapper Promise-based di Jake Archibald (Google), bundle minimo (~2 KB gzipped). Niente Dexie nel core: troppo opinionato e pesante | MEDIO |
| @vitest/browser | versioning Vitest | Browser mode per test che toccano Worker reali, EventSource, WebSocket | Solo per integration test che richiedono ambiente browser reale. Provider raccomandato: Playwright | MEDIO-ALTO |
| msw (Mock Service Worker) | 2.x | Mock HTTP/SSE/WebSocket nei test | Nei test di Gateway HTTP route, realtime adapter, retry/timeout. Lavora a livello Service Worker / fetch interceptor — ottimo per non spaccare il fetch reale durante i test | ALTO |
| superjson | 2.x | Serialization extra (opzionale) | Solo se schema worker richiede serializzazione di Date/Map/Set/BigInt fuori dai limiti SCA, e solo come adapter pluggable, non nel core. Default: structuredClone nativo | BASSO-MEDIO |
| jsdom | 25.x | DOM simulato per test unit | Nei test broker/mapper che toccano fetch o EventTarget ma non hanno bisogno di vero browser | ALTO |
| happy-dom | 16.x → 17.x | DOM simulato (alternativa a jsdom) | Più veloce di jsdom (2-3x) ma meno completo. Usare se i test sono semplici e non toccano API esotiche | MEDIO |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| pnpm workspaces | Monorepo management | Niente Turbo/Nx in V1: con 6-7 package interni e build veloci esbuild, lo script root in pnpm basta. Aggiungere Turborepo solo se la build matrix cresce |
| publint | Lint del package per pubblicazione npm | Verifica `package.json`, `exports` field, dual-CJS/ESM gotchas, types resolution. Da eseguire in CI prima di ogni release |
| arethetypeswrong (`@arethetypeswrong/cli`) | Verifica risoluzione `.d.ts` per consumer | Critico per libreria distribuita ESM con dual exports — segnala configurazioni che spaccano TypeScript node16/bundler resolution |
| size-limit + size-limit-preset-small-lib | Bundle size budget enforcement | CI gate: il `core` < 8 KB gzipped, `gateway` < 6 KB, `mapper` < 5 KB. Critico per libreria browser |
| GitHub Actions / Bun test runners | CI | Matrix Node 20 + 22, build + test + size-limit + publint + areTheTypesWrong |
| TypeDoc + `typedoc-plugin-markdown` | API docs | Output Markdown integrabile in VitePress / Docusaurus / static site |

---

## Installation

```bash
# Inizializzazione monorepo
pnpm init
pnpm add -Dw typescript@^5.5.0 tsup@^8.0.0 vitest@^2.0.0 \
  @biomejs/biome@^1.9.0 @changesets/cli@^2.27.0 \
  typedoc@^0.27.0 publint@^0.3.0 \
  @arethetypeswrong/cli@^0.17.0 size-limit@^11.0.0

# Test toolchain
pnpm add -Dw jsdom@^25.0.0 happy-dom@^16.0.0 \
  @vitest/browser@^2.0.0 playwright@^1.49.0 msw@^2.6.0

# Runtime deps (per i package interni)
pnpm add valibot@^1.0.0 nanoid@^5.0.0 --filter @sembridge/core
pnpm add comlink@^4.4.1 --filter @sembridge/worker
pnpm add idb@^8.0.0 --filter @sembridge/cache  # solo quando attivata persistenza
```

> Le versioni `^x.y.z` indicate sono le ultime note al training; eseguire `pnpm outdated` o `npm view <pkg> version` prima dell'esecuzione effettiva. Confidence sulle versioni precise: MEDIO; confidence sulla scelta della libreria: ALTO.

---

## Stack analysis per dimensione richiesta

### 1. Build tool / bundler — `tsup`

**Scelta: tsup (esbuild-based) con dts da rollup-plugin-dts integrato.**

**Pro:**
- Zero-config per casi tipici libreria TS
- Multi-format nativo: `format: ['esm', 'cjs', 'iife']` (PRD §31.1 — UMD/IIFE opzionale)
- Generazione `.d.ts` integrata via flag `dts: true`
- Treeshaking via esbuild; output ESM compatibile con bundler downstream (Vite/Webpack/esbuild)
- Watch mode veloce per dev
- Build di SemBridge core stimata < 500ms

**Contro:**
- Minimo controllo sulla shape esatta del bundle rispetto a Rollup puro
- `.d.ts` rollup non sempre perfetto su edge case di re-export complessi (mitigabile con `--dts-resolve` o `tsc --emitDeclarationOnly` separato)

**Alternative considerate:**
- **`unbuild`** (UnJS): ottimo per multi-target, integra `mkdist` per stub builds. Migliore se si fa monorepo pesante. **Trade-off:** meno popolare di tsup ma sta crescendo. Considerare per V1.x se si nota che tsup non gestisce bene il monorepo.
- **Rollup puro** + plugin (`@rollup/plugin-typescript`, `rollup-plugin-dts`, `@rollup/plugin-node-resolve`): più verboso, controllo massimo, configurazione esplicita. Indicato se si vuole 100% controllo sulla bundle shape — overkill per una libreria nuova.
- **Vite library mode** (`build.lib`): valido, ma porta dietro Vite anche per build production. Più indicato se si distribuisce un componente con asset bundling.
- **Rolldown** (Rollup ng, Rust-based): nel 2026 sta uscendo dalla beta. Sarà la scelta naturale fra 12 mesi. Per V1 di SemBridge, in produzione, non ancora maturo. **Watch list: aggiornare la scelta se Rolldown raggiunge stabilità durante lo sviluppo.**

**Configurazione consigliata `tsup.config.ts`:**

```ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,        // libreria, no chunking
  minify: false,           // lascia minify al consumer
  target: 'es2022',
  platform: 'browser',
  external: [/^node:/],    // niente Node built-in nei bundle
})
```

**Confidence: ALTO**

---

### 2. Testing framework — `Vitest` (+ `jsdom` + `@vitest/browser` quando serve)

**Scelta: Vitest 2.x come runner unico per unit, integration e browser test.**

**Strategia a tre livelli:**

| Livello | Ambiente | Tooling | Cosa testa |
|---------|----------|---------|-----------|
| Unit | `node` puro | Vitest | logica pura broker, mapper, validation, transform pipeline |
| Integration mid | `jsdom` o `happy-dom` | Vitest + jsdom + msw | Gateway HTTP, route engine end-to-end, EventTarget-based subscribe, lifecycle hooks |
| Integration browser | Browser reale (Chromium) | `@vitest/browser` + Playwright + msw | Worker reali, `EventSource`, `WebSocket`, `structuredClone` con transferable |

**Pro Vitest:**
- API jest-like, zero learning curve
- ESM-first, allineato con SemBridge ESM
- `vitest --workspace` per separare i tre livelli
- Browser mode con provider Playwright è state-of-the-art 2025-2026
- Test typecheck nativo via `vitest --typecheck`
- Snapshot inline e deferred snapshot
- Watch mode rapidissimo

**Contro:**
- Browser mode è ancora segnato "experimental-ish" in alcuni edge case (mitigabile usando `webdriverio` provider come fallback)
- Workspace config richiede attenzione per non duplicare le dipendenze

**Web Worker testing — punti chiave:**
- `jsdom`/`happy-dom` **non implementano `Worker` reali** — restituiscono stub. Quindi i test che istanziano `new Worker()` devono andare in browser mode oppure usare un mock RPC bridge in unit
- In Vitest browser mode, `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })` funziona nativamente con Vite che gestisce i worker entry
- Per integration mid (jsdom) si raccomanda di mockare il worker bridge con un'interfaccia testabile (fake RPC), non il `Worker` browser API

**SSE / WebSocket testing:**
- `EventSource` non esiste in jsdom out-of-the-box — usare `eventsource` package come polyfill nei test
- `WebSocket` è in jsdom ma non realmente connesso. Usare `msw` per stub WS in test mid-level
- In browser mode, entrambi funzionano nativamente con `msw` 2.x che supporta WS dal 2024

**Confidence: ALTO** sulla scelta Vitest. **MEDIO** sull'esatta strategia browser mode — può richiedere tuning.

---

### 3. Schema validation — `Valibot` (con adapter Zod opzionale)

**Scelta primaria: Valibot 1.x.**

**Rationale:**

Per una libreria che deve validare:
- evento (sintassi `BrokerEvent`)
- payload topic
- modello canonico
- post-mapping
- risposta server

…la validation runs **in cammino caldo** — ogni evento la attraversa. La libreria deve essere ridotta in dimensione (vincolo browser PRD §31.3) e non imporre una grossa dipendenza.

**Comparazione (numeri ricavati dal training, cutoff Q4 2025):**

| Libreria | Bundle min+gz (typical) | Tree-shaking | TypeScript inference | Runtime perf |
|----------|------------------------|--------------|----------------------|---------------|
| Zod 3.x | ~12-13 KB intero | Limitato (chain API) | Eccellente | Buono |
| **Valibot 1.x** | **~1-3 KB per schema usato** | **Ottimo (functional pipe)** | Eccellente | Ottimo |
| Ajv 8.x | ~30 KB con strict mode | Scarso | Tramite generazione | Velocissimo (compilato) |
| Yup | ~25 KB | Scarso | Mediocre | Mediocre |

**Perché Valibot vince in questo contesto:**
- API funzionale pipe-based: importi solo `object`, `string`, `number`, ecc. — nient'altro arriva nel bundle
- Inference TS al pari di Zod
- Runtime overhead inferiore a Zod su schemi semplici
- Permette di esportare schemi pubblici senza forzare il consumer a installare Zod

**Quando Zod ha senso:**
- Se i consumer hanno già Zod nel loro stack e si vuole risparmiarsi l'integrazione
- Se servono feature avanzate Zod (`.brand`, `.lazy` complessi) che Valibot non copre 1:1
- **Strategia hybrid raccomandata:** esporre un'astrazione `Schema` interna (interfaccia narrow `parse(input): Result<T>`) e fornire **adapter** per Valibot, Zod e schema JSON Schema → Ajv. SemBridge core rimane agnostico.

**Quando Ajv ha senso:**
- Solo se il PRD imponesse **JSON Schema strict** come formato canonico per gli schemi (PRD §21.3 dice "preferibilmente JSON Schema o equivalente tipizzato" — quindi non vincolante). Ajv è ottimo runtime ma footprint pesante.

**Raccomandazione finale:** Valibot come **referenza di default**, esposto via adapter `createValibotAdapter(schemas)` per permettere swap futuro.

**Confidence: MEDIO-ALTO.** La scelta tra Zod e Valibot è una delle più dibattute del 2024-2025; Valibot ha guadagnato consenso specifico per librerie e SDK browser-side. Per una app con tooling pesante (Next.js, ecc.) Zod resta la default di mercato.

---

### 4. HTTP client — `fetch` nativo + Gateway interno custom

**Scelta: nessun wrapper esterno. Costruire il `Gateway` interno sopra `fetch` nativo.**

**Rationale chiave:**

Il PRD §17.8 / §18.1 / §22 / §23 richiede:
- timeout
- retry (con differenziazione 4xx/5xx, ROUTE-09)
- backoff esponenziale + jitter
- dedupe via `dedupeKey`
- auth pluggable (interceptor pattern, token refresh)
- circuit breaker (PRD §10 menziona "Circuit Policies")
- request cancellation (AbortController)
- normalizzazione risposta verso eventi broker
- centralizzazione status HTTP non validi

Nessun wrapper esistente copre **tutte** queste policy in modo che si integri pulitamente con il route engine event-driven. I wrapper esistenti (`ky`, `wretch`, `ofetch`) coprono il **70-80%** ma:
- **`ky`** (Sindre Sorhus): retry, hooks, AbortController. Buono ma opinionato sull'API. Bundle ~3 KB. Richiederebbe wrappare `ky` in un layer SemBridge → indirezione inutile.
- **`wretch`**: API fluente (`.url().get().json()`). Buono per chi scrive request manuali, meno ergonomico per route engine generato da config.
- **`ofetch`** (UnJS): retry, body coercion, ottimo DX. Bundle ~5 KB. Lega a UnJS ecosystem.

**Decisione architetturale:**
1. Gateway HTTP riceve `RouteDefinition` + `BrokerEvent`, non interagisce con un wrapper di alto livello
2. Implementa internamente: timeout (AbortSignal), retry, dedupe (via Map<dedupeKey, Promise>), interceptor auth, error mapping
3. Espone hook pubblici: `onRequest`, `onResponse`, `onError`, `onRetry`, `onAuthRefresh`
4. Bundle target: **< 4 KB gzipped** per il modulo gateway

**Quando reconsiderare un wrapper:**
- Se in fase 3 il developer trova che ricostruire dedupe + retry + timeout porta via troppo tempo, valutare `ofetch` come implementation detail (mai esposto nell'API pubblica). Wrapping con tree-shaking pulito ammesso.

**Cosa NON fare:**
- Non esporre `fetch` API direttamente nell'API pubblica del broker (rompe il principio "broker unico gateway", PRD §3.3)
- Non usare `axios` — pesante (~13 KB), non native fetch, non ESM-first

**Confidence: ALTO** sulla decisione "fetch nativo + custom layer". **MEDIO** sull'esclusione totale di `ofetch` come implementation detail.

---

### 5. EventBus / pub-sub — implementazione in-house

**Scelta: implementare in casa. Niente mitt, eventemitter3, RxJS.**

**Rationale:**

Il PRD descrive un broker che **non è un emitter**. Confronto:

| Capability richiesta dal PRD | mitt | eventemitter3 | RxJS Subject | In-house |
|------------------------------|------|---------------|--------------|----------|
| `BrokerEvent` con metadata strutturati | No | No | Parziale | Sì |
| Wildcard topic (`weather.*`, `*.failed`) | No | No | Filter manuale | Sì |
| Dedupe via `dedupeKey` | No | No | distinctUntilKeyChanged-like | Sì |
| Backpressure (queue bounded, drop, throttle, debounce, latest) | No | No | Sì (operatori) | Sì |
| Pipeline mapping locale → canonico → locale | No | No | Sì (operatori) | Sì |
| Subscriber registry ispezionabile | No | Parziale | No (Subject) | Sì |
| Lifecycle plugin (mount/unmount cleanup) | No | No | Subscription teardown | Sì |
| Priorità eventi (low/normal/high/critical) | No | No | Custom Scheduler | Sì |
| TTL eventi | No | No | No | Sì |
| Source descriptor obbligatorio | No | No | No | Sì |
| API pub/sub semplice (PRD §16.2) | Sì | Sì | No (paradigma observable) | Sì |

**Conclusione:**
- **mitt/eventemitter3** sono troppo magri. Costruirci sopra significa reimplementare la maggior parte del broker, perdendo tempo a sincronizzare un'astrazione esterna con il modello evento ufficiale (PRD §11)
- **RxJS** è troppo pesante (~25-30 KB anche con tree-shaking aggressivo) e impone un paradigma observable che il PRD §16.2 esplicitamente non vuole nell'API pubblica (`broker.subscribe(topic, handler)` è un'API callback-based, non un `Observable<T>`)
- **In-house:** una `Map<topic, Set<Subscriber>>` + wildcard matcher + queue management ≈ 300-500 LoC di codice testato, perfetto fit con il modello

**Componenti interni del bus (in-house):**

```ts
// Pseudocodice strutturale
class EventBus {
  private exact: Map<string, Set<SubscriberEntry>>
  private wildcard: Array<{ pattern: RegExp, sub: SubscriberEntry }>
  private queues: Map<string, BoundedQueue<BrokerEvent>>
  private dedupeIndex: Map<string, number /* timestamp */>
  private paused: Set<string>

  publish(event: BrokerEvent): void
  subscribe(topic: string, handler: Handler, opts?: SubscribeOptions): SubscriptionHandle
  unsubscribe(handle: SubscriptionHandle): void
  pauseTopic(topic: string): void
  resumeTopic(topic: string): void
  flushQueue(topic?: string): void
}
```

**Riferimenti ispirazionali (da studiare, non da importare):**
- `tinybus`, `nanoevents` — per la minimal core
- Internal event hubs di RxJS Subject — per pattern di subscriber registry
- `EventTarget` nativa — pattern di add/removeEventListener con AbortController

**Confidence: ALTO.** Decisione architetturale solida e supportata dal PRD.

---

### 6. Web Worker integration — `Comlink` (V1) con possibilità di switch a custom RPC

**Scelta primaria: Comlink 4.4.x.**

**Pro Comlink:**
- API typed (con TypeScript) `Comlink.wrap<API>(worker)` → proxy che chiama `await proxy.method(args)`
- Gestisce automaticamente `postMessage` + correlation ID + Promise resolution
- Supporta `Comlink.transfer(value, transferList)` per ArrayBuffer/MessagePort
- ~1.1 KB gzipped, single dep
- API stabile dal 2019
- Maintenance attiva (Google)

**Contro:**
- Il modello "proxy method call" mappa imperfettamente sul modello evento del broker — serve uno strato di adapter `Route worker → Comlink call → broker event`. Comunque migliore che reinventare RPC.
- Cancellazione task richiede pattern AbortController-aware sopra Comlink

**Alternative considerate:**
- **`greenlet`** — molto minimale ma orientato a "single function in worker", non a API estese. Inadatto a worker con più task (PRD §19.6 cita parsing, dedup massiva, ecc.)
- **`workerize`** / **`workerize-loader`** — vecchi (legati a Webpack), non più mantenuti attivamente
- **`threads.js`** — orientato a Node.js + browser, API più ampia ma footprint maggiore (~5 KB)
- **Custom RPC su `postMessage`** (~150-200 LoC): valutare in V1.x se Comlink dovesse risultare ostico in caso di transferable complessi o cancellazione. Per V1, Comlink fornisce un buon DX a basso costo.

**Pattern di integrazione raccomandato:**

```ts
// In broker
const workerRoute: WorkerRoute = {
  type: 'worker',
  worker: 'report-worker',
  task: 'generateReport',
}

// In SemBridge worker module
import * as Comlink from 'comlink'

const api = {
  generateReport: async (canonicalPayload, ctx: WorkerCtx) => {
    ctx.onProgress?.(0.5)
    return /* ... */
  },
}
Comlink.expose(api)

// Nel main thread, lato gateway worker
const proxy = Comlink.wrap<typeof api>(new Worker(/* ... */, { type: 'module' }))
const result = await proxy.generateReport(canonicalPayload, /* progress callback handle */)
```

**Confidence: MEDIO-ALTO.** Comlink è solido ma il fit non è perfetto al 100%. Mantenere astrazione `WorkerBridge` interna per poter cambiare implementazione senza toccare le route.

---

### 7. Realtime — `EventSource` nativo (SSE) e `WebSocket` nativo + adapter custom

**Scelta: zero librerie esterne. Adapter SSE/WS custom sopra le API browser native.**

**Rationale:**

PRD §31.3 dice "polyfill devono essere separati dal core". Il PRD §18.6 elenca esplicitamente le policy di reconnection da supportare (retry interval, exponential backoff, max retry, heartbeats, stale connection detection, jitter). Tutte queste sono **policy applicative** che vivono naturalmente nell'adapter SemBridge, non in una libreria esterna.

**Per SSE:**
- `EventSource` API nativa è in **tutti i browser evergreen** (Chrome, Firefox, Safari, Edge — supporto > 95% globalmente nel 2025)
- Limitazione nota: nessun supporto a custom headers (es. `Authorization`) nell'API standard. Workaround: token in query string, oppure usare `fetch + ReadableStream` per implementare SSE manualmente quando servono header (pattern comune nelle SDK serie). Mantenere come opzione "v2"
- Niente `eventsource-polyfill`: è inutile per browser evergreen e introduce ~10 KB

**Per WebSocket:**
- API nativa `WebSocket` ovunque
- Reconnection custom (PRD §18.6 elenca esplicitamente le policy): retry con backoff + jitter, heartbeat ping/pong, stale detection via timeout
- Niente `reconnecting-websocket`: la libreria copre ~30% delle policy richieste e impone un'API che andrebbe wrappata
- `partysocket` (PartyKit) è interessante ma orientato a PartyKit ecosystem — overkill per SemBridge

**Adapter pattern raccomandato:**

```ts
interface RealtimeAdapter {
  connect(url: string, options: RealtimeOptions): Promise<void>
  disconnect(): Promise<void>
  onMessage(handler: (msg: ServerMessage) => void): () => void
  onStateChange(handler: (state: 'connecting' | 'open' | 'closed' | 'reconnecting') => void): () => void
}

class SseAdapter implements RealtimeAdapter { /* ... */ }
class WebSocketAdapter implements RealtimeAdapter { /* ... */ }
```

**Cosa è importante:**
- Heartbeat custom (su SSE: `: keep-alive\n\n` lato server riconosciuto come no-op; su WS: ping frame o messaggio applicativo)
- Stale connection detection: se non si riceve nulla per `idleTimeoutMs * 1.5` allora reconnect
- Visibility API integration: pausare reconnect aggressivo quando tab è hidden, ripartire su `visibilitychange`

**Confidence: ALTO.** Pattern consolidato, le librerie esistenti coprono solo casi semplici.

---

### 8. Serialization messaggi worker — `structuredClone` nativo

**Scelta: structuredClone (algoritmo SCA usato implicitamente da `postMessage`) + adapter `superjson` opzionale.**

**Rationale:**

`postMessage` usa **automaticamente** l'algoritmo Structured Clone (SCA). Quindi nel caso base **non c'è serializzazione esplicita da fare** — basta passare l'oggetto. Quando si vuole forzare il transfer di ArrayBuffer/MessagePort, si usa `transferable` come secondo argomento.

SCA supporta:
- primitive
- Array, Object, Map, Set
- Date, RegExp
- ArrayBuffer (transferable)
- Blob, File, FileList
- ImageData, ImageBitmap (transferable)

SCA **non** supporta:
- functions
- DOM nodes
- prototype chain custom (oggetti instanceof MyClass perdono il prototype)
- Symbol non-registered
- Error objects (parzialmente supportato in browser recenti)

**Quando serve `superjson` o `devalue`:**
- Solo se il contratto worker include classi custom da preservare (rare in worker context — di solito si preferisce DTO plain)
- Solo come adapter pluggable opt-in nel `WorkerBridge.serializer`

**Cosa NON fare:**
- Non usare `JSON.stringify` per default — è 5-10x più lento di SCA, perde Date/Map/Set, non supporta transferable
- Non usare `superjson` di default — aggiunge ~5 KB e overhead se SCA basta

**Pattern raccomandato:**

```ts
interface WorkerSerializer {
  serialize<T>(value: T): { data: unknown; transferList: Transferable[] }
  deserialize<T>(data: unknown): T
}

class StructuredCloneSerializer implements WorkerSerializer { /* default */ }
class SuperjsonSerializer implements WorkerSerializer { /* opt-in */ }
```

**Confidence: ALTO.**

---

### 9. ID generation — `nanoid`

**Scelta: nanoid 5.x.**

**Comparazione:**

| Libreria | Bundle min+gz | Default length | URL-safe | Performance | Note |
|----------|---------------|----------------|----------|-------------|------|
| `uuid` v9 | ~5-6 KB (con v4) | 36 char (con dash) | No (dash) | Medio | Standard de jure RFC 4122 |
| **`nanoid`** | **~130 B** | **21 char** | **Sì** | **Veloce** | Default per ID interni |
| `ulid` | ~1 KB | 26 char | Sì | Veloce | Lessicograficamente ordinabile |
| crypto.randomUUID() | 0 (nativo) | 36 char | No | Veloce | Nativo, no deps. Solo se import lib non è già necessaria |

**Raccomandazione SemBridge:**

- `BrokerEvent.id` → **nanoid** — 21 char è sufficiente per uniqueness in-page (collision probability ~1e-10 per 10M ID/h)
- `correlationId` / `causationId` / `traceId` → nanoid stesso (entropia 126 bit OK)
- `subscriptionId` → nanoid stesso o counter monotonico interno (più leggero — basta `++this.counter`)

**Perché non `uuid`:**
- Dimensione 5x maggiore
- 36 char con dash poco URL-safe e meno leggibile in log

**Perché non `ulid`:**
- L'ordinamento lessicografico temporale è utile per database time-series, **non** per ID di eventi in memoria. Per ordering temporal il broker già usa `timestamp` esplicito

**Perché non `crypto.randomUUID()` (anche se nativo):**
- Funziona, ma 36 char con dash. Considerabile come **fallback zero-deps** se si vuole rimuovere `nanoid`. Il delta di 130 B vale però la migliore DX di nanoid

**Confidence: ALTO.**

---

### 10. IndexedDB adapter — `idb` (futuro)

**Scelta: idb 8.x — solo quando si attiverà la persistenza opzionale (PRD §20.3).**

**Rationale:**

- `idb` (Jake Archibald, Google Chrome team) è il wrapper Promise-based standard per IndexedDB
- Bundle ~2 KB gzipped
- API minimale, segue da vicino IndexedDB nativo
- Mature dal 2018, manutenuto attivamente

**Alternative considerate:**
- **`dexie`** (~30 KB) — feature-rich (query DSL, transactions, sync), ma overkill per uno strato cache adapter. Indicato se SemBridge dovesse esporre query API ricche
- **`rxdb`** — orientato a sync/replication, troppo opinionato

**Consiglio operativo:**
- Tenere fuori dal core in V1
- Esporre `CacheAdapter` interface in `@sembridge/cache` con `MemoryCacheAdapter` come default
- Pubblicare `@sembridge/cache-idb` come package separato in V1.x

**Confidence: MEDIO** sulla scelta `idb`. **ALTO** sull'approccio "opt-in via package separato".

---

### 11. TypeScript build target & tsconfig

**Scelta: `target: ES2022`, `module: ESNext`, `moduleResolution: Bundler`, strict full.**

**Rationale ES2022:**
- Top-level await
- `Error.cause` (utile per `BrokerError.originalError`)
- Class fields stable
- `Object.hasOwn`
- Private class methods
- Tutti i browser evergreen lo supportano nativamente nel 2025-2026

**Rationale `moduleResolution: Bundler`:**
- Nuovo modificatore TS 5.x
- Ammette estensioni `.ts` negli import (workspace-friendly)
- Allineato con come bundler downstream risolvono moduli (Vite, esbuild, Rollup, Bun)

**`tsconfig.json` raccomandato (root):**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable", "WebWorker"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true,
    "noPropertyAccessFromIndexSignature": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "isolatedDeclarations": true,
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
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**Note critiche:**
- `noUncheckedIndexedAccess: true` — fondamentale per una libreria che lavora con `Record<string, unknown>` (mapper, metadata)
- `isolatedDeclarations: true` (TS 5.5+) — abilita generazione `.d.ts` parallela e veloce, future-proof per Rolldown/swc
- `verbatimModuleSyntax: true` — coerenza ESM, niente `import` magico downcompiled in CJS quando non serve
- `lib: WebWorker` — mantenere disponibili i tipi worker nel progetto generale; per il package `@sembridge/worker` valutare un tsconfig separato che fa il flip in `WebWorker` puro senza `DOM`

**Confidence: ALTO.**

---

### 12. Lint / format — `Biome` (preferito) o ESLint+Prettier

**Scelta primaria: Biome 1.9.x → 2.x.**

**Pro Biome:**
- Singolo tool: linter + formatter + import sorting + file checker
- Scritto in Rust (basato su rome → biome): 10-30x più veloce di ESLint+Prettier
- Configurazione minimale (`biome.json`)
- TypeScript-aware
- VS Code extension ufficiale ottima
- 2025: ha raggiunto parity feature con ESLint per i ~95% dei casi

**Contro Biome:**
- Plugin ecosystem più piccolo di ESLint
- Niente regole TS-strict-style avanzate (es. `@typescript-eslint/strict-type-checked` rules) — ma non strettamente necessarie se TS strict mode è attivo
- Niente lint cross-file deep

**Quando ESLint + Prettier vince:**
- Se serve un plugin specifico (es. plugin custom interno azienda, plugin React/Vue, regole accessibility avanzate)
- Per SemBridge (libreria pura, no UI framework, no React) Biome è ottimale

**`biome.json` raccomandato:**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "files": { "ignore": ["dist", "node_modules", "coverage"] },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "complexity": { "noForEach": "off" },
      "style": { "useImportType": "error", "noNonNullAssertion": "error" },
      "suspicious": { "noExplicitAny": "warn" }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "organizeImports": { "enabled": true },
  "javascript": {
    "formatter": { "quoteStyle": "single", "semicolons": "asNeeded" }
  }
}
```

**Confidence: MEDIO-ALTO.** Biome ha consolidato la sua posizione nel 2024-2025, ma la community resta divisa. Alternativa "consensual": ESLint flat config + Prettier — funziona perfettamente, solo più lento.

---

### 13. Versioning / changelog automation — `Changesets`

**Scelta: Changesets 2.x.**

**Rationale:**
- Standard de-facto per librerie TypeScript pubblicate (PNPM, Vitest, tsup, ecc. lo usano)
- Funziona sia per single-package sia per monorepo
- Workflow: `pnpm changeset` apre prompt → snippet `.md` in `.changeset/` → `pnpm changeset version` consuma snippet, bumpa versioni e aggiorna `CHANGELOG.md` → `pnpm changeset publish` pubblica su npm
- Integrazione GitHub Actions `changesets/action` per PR automatiche di "Version Packages"
- Granular: ogni package del monorepo può avere bump indipendente
- Funziona con semver fixed o independent (consigliato: independent per monorepo SemBridge, eccetto major bumps coordinati)

**Alternativa considerata:**
- **`semantic-release`** — automatizza completamente da commit message convenzionali. Più aggressivo, meno controllo. Buono per CI puramente automatica, meno trasparente per chi legge il CHANGELOG.
- **release-please** (Google) — tag-based release notes via PR. Ottimo ma più orientato a Google open source style. Valutabile come alternativa.

**Confidence: ALTO.**

---

### 14. Documentation generation — `TypeDoc`

**Scelta: TypeDoc 0.27.x con `typedoc-plugin-markdown` per output integrabile.**

**Rationale:**
- Standard de facto per documentazione API di librerie TypeScript
- Genera HTML autonomo + Markdown via plugin
- Supporta TSDoc tag (`@param`, `@example`, `@deprecated`, `@experimental`)
- Si appoggia direttamente al `.d.ts` — niente sincronizzazione manuale

**Alternative:**
- **API Extractor** (Microsoft) — più rigoroso, genera "API report" JSON per audit di breaking change. Utile in V1.x quando la libreria stabilizza l'API pubblica e si vuole regression test su breaking changes
- **Docusaurus / VitePress** — non sono generatori di API docs, ma static site builders. Si combinano con TypeDoc Markdown per il sito doc completo

**Strategia documentazione SemBridge:**
1. **API reference** (auto-generata) — TypeDoc Markdown → integrato in static site
2. **Guide handwritten** — `docs/` MDX/Markdown: getting started, plugin guide, canonical model guide, route engine guide, debug tooling (PRD §41)
3. **Esempi end-to-end** — `examples/` directory con app demo (incluso scenario meteo PRD §29)
4. **CHANGELOG** auto da Changesets

**Confidence: ALTO.**

---

### 15. Repository structure — monorepo `pnpm` workspaces

**Scelta: monorepo pnpm workspaces con sub-package per sub-system PRD §10.**

**Struttura proposta:**

```
sembridge/
├── packages/
│   ├── core/                  # @sembridge/core
│   │   └── src/
│   │       ├── broker/        # Event Bus, Topic Registry, Subscriber Registry
│   │       ├── event/         # BrokerEvent types, factories
│   │       ├── plugin/        # Plugin Registry, lifecycle
│   │       └── index.ts
│   ├── mapper/                # @sembridge/mapper
│   │   └── src/
│   │       ├── canonical/     # Canonical Vocabulary Registry
│   │       ├── alias/         # Alias Registry
│   │       ├── transform/     # Transform pipeline
│   │       ├── validate/      # Validation layer (Valibot adapter)
│   │       └── index.ts
│   ├── gateway/               # @sembridge/gateway
│   │   └── src/
│   │       ├── http/          # Fetch client, retry, timeout, dedupe, auth
│   │       ├── sse/           # EventSource adapter
│   │       ├── ws/            # WebSocket adapter
│   │       └── index.ts
│   ├── worker/                # @sembridge/worker
│   │   └── src/
│   │       ├── bridge/        # Comlink wrapper / RPC abstraction
│   │       ├── pool/          # Worker pool
│   │       ├── registry/      # Worker registry
│   │       └── index.ts
│   ├── cache/                 # @sembridge/cache
│   │   └── src/
│   │       ├── memory/
│   │       ├── policies/      # cache-first, network-first, etc
│   │       └── index.ts
│   ├── devtools/              # @sembridge/devtools
│   │   └── src/
│   │       ├── inspector/     # Event/Mapping/Route inspector
│   │       ├── metrics/
│   │       └── index.ts
│   ├── routing/               # @sembridge/routing (route engine)
│   │   └── src/
│   │       ├── engine/
│   │       ├── handlers/      # local, http, worker, cache, composite, realtime-inbound
│   │       └── index.ts
│   └── sembridge/             # @sembridge/sembridge — bundle aggregato pubblico
│       └── src/index.ts       # re-export selezionato + createBroker()
├── examples/
│   ├── weather-demo/          # PRD §29
│   ├── plugin-template/
│   └── debug-tooling-demo/
├── docs/
│   └── ...                    # static site sources
├── .changeset/
├── biome.json
├── tsconfig.base.json
├── pnpm-workspace.yaml
└── package.json
```

**Rationale monorepo:**
- I sub-system PRD §10 sono naturalmente separabili: core non deve conoscere worker/SSE/WebSocket
- Tree-shaking esplicito: chi usa solo broker locale non importa gateway/worker
- Test isolation: ogni package ha suite propria
- Versioning: developer può rilasciare solo `@sembridge/cache` senza bump del core
- DX: refactor cross-package via pnpm workspace protocol (`workspace:^`)

**Cosa non fare:**
- **Niente Turborepo / Nx** in V1: 6-7 package, build veloci esbuild — pnpm + script root bastano. Aggiungere Turbo solo se la build matrix diventa onerosa (improbabile per librerie pure). Confidence ALTA su questa esclusione iniziale.
- **Niente Lerna** (deprecato in pratica dal 2023; Nx ha assorbito il maintenance)
- **Niente `bun workspaces`** ancora — tooling test/lint ESM è meno maturo su Bun nel Q1 2026; valutare per V2

**Quando NON fare monorepo (alternativa single-package):**
- Se il developer preferisce assoluta semplicità di setup e accetta che il consumer importi sempre l'intera libreria (~25 KB gzipped target)
- In quel caso: cartelle `src/core/`, `src/mapper/`, ecc. con `index.ts` unico e tree-shaking via `sideEffects: false`

**Raccomandazione finale:** **monorepo dal giorno 1.** Il costo iniziale è 1-2 giorni; il vantaggio è strutturale e duraturo.

**Confidence: ALTO** sul monorepo. **MEDIO** sull'esatta granularità (potrebbe consolidarsi in 4-5 package se la separazione si rivelasse over-engineering).

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| tsup | unbuild | Se monorepo richiede stub builds, multi-target avanzato |
| tsup | Rolldown | Q3 2026+ quando Rolldown stabilizza (futuro upgrade) |
| Vitest | Bun test | Solo se si decide di runnare tutto su Bun (futuro, più sperimentale per browser API) |
| Valibot | Zod | Se l'utenza target usa già Zod estensivamente |
| Valibot | Ajv | Se schemi devono essere JSON Schema strict (regulatory/contracts) |
| fetch + custom | ofetch | Se fase 3 supera 2 settimane di overrun nell'implementazione policy |
| In-house EventBus | RxJS | Se in V2 si decide di esporre API observable + operator chain |
| Comlink | RPC custom | Se Comlink causa problemi con cancellazione task complessa o transferable edge case |
| EventSource nativo | fetch + ReadableStream | Se serve auth con custom Authorization header sul canale SSE |
| WebSocket nativo | partysocket | Se SemBridge si integra con PartyKit ecosystem |
| structuredClone | superjson | Se contract worker include classi custom da preservare attraverso il boundary |
| nanoid | crypto.randomUUID() | Se zero-deps è priorità assoluta |
| Biome | ESLint + Prettier | Se serve plugin ESLint specifico (es. eslint-plugin-import-x con regole custom) |
| Changesets | semantic-release | Per CI release fully-automated, meno trasparente |
| TypeDoc | API Extractor | Quando V1.x stabilizza API pubblica e serve regression test su breaking changes |
| pnpm workspaces | Single-package src/ | Se il team preferisce setup minimale e accetta zero tree-shaking sub-system |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Webpack come bundler libreria | Configurazione complessa, output non ESM-clean per librerie, slow | tsup |
| Parcel | Eccellente per app, scarso DX per libreria distribuita TS | tsup |
| Jest | Slow su ESM-only TypeScript, configurazione ESM dolorosa, watch mode meno reattivo | Vitest |
| Karma + Mocha + Chai | Stack legacy, browser test pieno di overhead config | Vitest browser mode + Playwright |
| Yup | API encadenata limita tree-shaking, inference TS mediocre | Valibot o Zod |
| io-ts | API funzionale ma overhead Either monad + boilerplate fp-ts | Valibot |
| Joi | No tree-shaking, no TS-first, target server | Valibot |
| Axios | ~13 KB, no native fetch, no ESM-first | fetch nativo + custom Gateway |
| superagent | API legacy callback/promise mista, no TS-first | fetch nativo |
| RxJS in core API pubblica | ~25-30 KB, paradigma observable estraneo al PRD §16.2 | In-house EventBus, eventualmente RxJS in adapter opzionale |
| mitt / eventemitter3 da soli | Troppo magri rispetto al modello evento PRD §11 | In-house EventBus |
| reconnecting-websocket | Reconnection ~30% delle policy PRD §18.6, API che impone wrapping | WebSocket nativo + adapter custom |
| eventsource-polyfill | Non necessario per browser evergreen, ~10 KB di carico | EventSource nativo |
| socket.io-client | Soluzione full-stack opinionata server-incluso, NO solo per SSE/WS pure | WebSocket nativo |
| uuid v4 | ~5-6 KB vs nanoid 130 B, 36 char con dash | nanoid |
| Lerna | Deprecato (Nx l'ha assorbito) | pnpm workspaces |
| Turborepo in V1 | Overhead per 6-7 package con build esbuild già veloce | pnpm workspaces script root, valutare in V1.x |
| TSLint | Deprecato dal 2019 | Biome o ESLint flat config |
| Babel come compilatore TS | Slow, niente type-check; serve a Babel solo se servono plugin custom | tsc + esbuild (in tsup) |
| `Worker` con classic script (no `type: 'module'`) | Niente import statici dei moduli, niente top-level await | `new Worker(url, { type: 'module' })` |

---

## Stack Patterns by Variant

**Se il developer vuole ridurre al minimo le dipendenze esterne (target < 20 KB gzipped per `@sembridge/sembridge`):**
- **Sostituire Comlink** con RPC custom su `postMessage` (~200 LoC)
- **Sostituire nanoid** con `crypto.randomUUID()` nativo
- **Sostituire Valibot** con validatore minimale custom (solo se schemi pubblici sono semplici — fattibile ma sconsigliato)
- Rimane: `idb` solo se persistenza attivata
- **Trade-off:** 200-500 LoC in più di codice "infrastrutturale" da mantenere; risparmio 2-4 KB

**Se il developer accetta deps moderate per migliore DX (target 25-35 KB gzipped):**
- Stack raccomandato sopra (Comlink + nanoid + Valibot + idb opzionale)

**Se il developer vuole offrire massima compatibilità ai consumer (es. integrarsi in app che usano Zod):**
- Mantenere validation layer agnostic con adapter `@sembridge/validation-zod` come package separato in V1.x
- Default Valibot per chi non specifica nulla

**Se il progetto integra subito con framework UI (React/Vue):**
- **Non** fare bridge React/Vue nel core (PRD §5: "non sostituire React/Vue/...")
- Pubblicare `@sembridge/react` e `@sembridge/vue` come package separati con hook (`useSubscribe`, `usePublish`)
- Deferred: questi possono uscire in V1.x dopo che core stabilizza

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| TypeScript 5.5+ | tsup 8.x, Vitest 2.x, Biome 1.9+ | `isolatedDeclarations` richiede TS 5.5 |
| Vitest 2.x | jsdom 25.x, happy-dom 16+, Playwright 1.49+ | Browser mode raccomanda Playwright provider |
| pnpm 9.x | Node 20+, Changesets 2.x | `workspace:^` protocol stabile da pnpm 7+ |
| Comlink 4.4.x | TypeScript 4.5+, browser ESM, Node 18+ worker_threads | Attenzione `transferable` deve essere wrappato `Comlink.transfer(value, [transferList])` |
| Valibot 1.x | TypeScript 4.7+ (template literal types) | Pipe API stabile da v0.30+; v1 è il release stabile lanciato fine 2024 |
| nanoid 5.x | ESM-only | Da v4 in poi è ESM-only; per CJS legacy usare v3 (deprecato) |
| MSW 2.x | Node 18+, browsers evergreen, fetch API | v2 cambia API rispetto a v1 (request/response API) |
| `@vitest/browser` | Vitest 2.x stessa versione | Tenere allineato exact-match in package.json |
| `idb` 8.x | IndexedDB nativa (universale) | API Promise-based |
| TypeDoc 0.27+ | TypeScript 5.x (rispettare matrice ufficiale) | Plugin markdown stesso versioning |

---

## Compatibilità con vincoli PRD verificati

| Vincolo PRD | Stack scelto | Verdict |
|-------------|--------------|---------|
| TypeScript come linguaggio (PRD §31.2, PKG-02) | TS 5.5+ | OK |
| Distribuzione ESM (PRD §31.1, PKG-01) | tsup `format: ['esm']` + opzionale CJS/IIFE | OK |
| Browser evergreen (PRD §31.3, PKG-03) | Target ES2022 + native APIs | OK |
| Polyfill separati dal core | Niente eventsource-polyfill, niente axios | OK |
| Web Worker support (PRD §19) | Comlink + structuredClone nativo | OK |
| Fetch + ≥1 canale realtime inbound (PRD §18) | fetch nativo + EventSource (SSE) + WebSocket | OK |
| Validazione minima payload (PRD §21, VAL-01..06) | Valibot (con adapter pluggable) | OK |
| Schema preferibilmente JSON Schema o equivalente tipizzato (PRD §21.3) | Valibot tipizzato (equivalente) + opzione Ajv via adapter | OK |
| Debug e introspection (PRD §25) | `@sembridge/devtools` package + TypeDoc API ref | OK |
| Lifecycle anti-leak (PRD §24) | EventBus in-house con AbortController-style unsubscribe handles | OK |
| Test su pub/sub, mapping, route, worker (TEST-01) | Vitest + jsdom + browser mode + msw | OK |

---

## Repository structure decision tree

```
Decisione: monorepo o single-package?
│
├─ Numero di sub-system del PRD §10 indipendenti? → 7 (core, mapper, gateway, worker, cache, devtools, routing)
├─ Tree-shaking sub-system pubblico richiesto? → SÌ (PRD vuole minimizzare deps consumer)
├─ Versionabilità indipendente desiderata? → SÌ (cache opt-in V1.x)
├─ Team size? → 1-3 developer (ipotizzato)
│
└─ Verdict: MONOREPO con pnpm workspaces. Niente Turbo iniziale.
```

---

## Sources

> **Disclaimer:** durante questa ricerca le tool di accesso live al web (WebSearch, WebFetch, Brave, Context7 MCP, Exa, Firecrawl) erano disabilitate dall'environment. Le source qui sotto sono **conoscenze derivate dal training data Claude (cutoff gennaio 2026)** e dalle pratiche consolidate nell'ecosistema TypeScript/JavaScript 2024-2025.

- TypeScript handbook (Microsoft) — opzioni `isolatedDeclarations`, `verbatimModuleSyntax`, `moduleResolution` Bundler — confidence ALTO
- tsup docs (egoist.dev) — feature, esbuild integration, dts via rollup — confidence ALTO
- Vitest docs (vitest.dev) — Browser mode, jsdom/happy-dom, workspace, msw integration — confidence ALTO
- Valibot docs (valibot.dev) — tree-shaking pipe API, bundle size benchmarks — confidence MEDIO-ALTO
- Comlink GitHub README (Google Chrome team) — API e bundle size — confidence ALTO
- Sindre Sorhus ky/nanoid READMEs — bundle size, API — confidence ALTO
- pnpm workspaces docs — `workspace:^` protocol, hoisting model — confidence ALTO
- Biome docs (biomejs.dev) — feature parity con ESLint+Prettier, performance — confidence MEDIO-ALTO
- Changesets docs (changesets.io) — workflow, monorepo support — confidence ALTO
- TypeDoc + typedoc-plugin-markdown — confidence ALTO
- MDN: EventSource, WebSocket, Worker, structuredClone, postMessage — feature support evergreen — confidence ALTO
- caniuse.com (training snapshot) — supporto browser ES2022, WebSocket, EventSource — confidence ALTO

---

## Verifica preliminare prima dell'implementazione

Prima di committare al stack, eseguire questi check (5 minuti):

```bash
# 1. Versioni effettive correnti
npm view tsup version
npm view vitest version
npm view valibot version
npm view comlink version
npm view nanoid version
npm view idb version
npm view typedoc version
npm view @biomejs/biome version
npm view @changesets/cli version
npm view typescript version

# 2. Compatibility check (post-install)
pnpm install
pnpm dlx publint
pnpm dlx @arethetypeswrong/cli .

# 3. Bundle size sanity check
pnpm dlx size-limit  # con preset configurato
```

Se una qualsiasi versione consigliata è > 1 anno indietro rispetto alla latest, valutare l'aggiornamento e leggere il changelog per breaking changes.

---

*Stack research per: SemBridge — libreria browser-side TypeScript modulare (broker pub/sub + canonical model + gateway + worker + cache + tooling)*
*Researched: 2026-04-28*
*Confidence complessivo: MEDIO-ALTO (rationale architetturale ALTO, versioni esatte MEDIO per indisponibilità tool live)*
