# @gluezero/microfrontends

> **Micro-frontend governance layer per GlueZero v2.0** — Registry, Lifecycle FSM 14 stati, 4 mount strategies, 29 standard topics, EventTap MF-ready.

**Stato:** experimental — alpha `v2.0.0`. Non pubblicato su npm fino alla GA v2.0.0 (Phase 17).

[![bundle size](https://img.shields.io/badge/bundle-12_KB_gzip-blue)](#bundle-size)
[![tier coverage](https://img.shields.io/badge/Tier_1-jsdom-green)](#testing)
[![tier coverage](https://img.shields.io/badge/Tier_3-Playwright-orange)](#testing)
[![D--83](https://img.shields.io/badge/D--83-strict_carryover_esteso-purple)](#boundary-d-83-strict-carryover-esteso-v20)

ESM-only TypeScript library. Browser evergreen target (ES2022). Estende [`@gluezero/core`](../core/README.md) con il runtime di governance per micro-frontend: registry CRUD, FSM 14 stati, 4 mount strategies, 17+7+5 standard topics e contracts validator.

Quattro dipendenze runtime: [`@gluezero/core`](../core/README.md) (broker base, peer workspace), [`valibot`](https://valibot.dev) (validation descriptor strict), [`nanoid`](https://github.com/ai/nanoid) (transitivo via core) e un side-effect entry opt-in `@gluezero/microfrontends/augment` per Pattern S1 sugar.

## Indice

1. [Quick start](#quick-start)
2. [Architettura](#architettura)
3. [Descriptor reference](#descriptor-reference)
4. [Lifecycle FSM](#lifecycle-fsm)
5. [Pattern S1 augment](#pattern-s1-augment)
6. [Standard topics](#standard-topics)
7. [Q&A](#qa)
8. [Bundle size](#bundle-size)
9. [Testing](#testing)
10. [REQ-IDs coverage](#req-ids-coverage)
11. [Riferimenti](#riferimenti)
12. [Licenza](#licenza)

---

## Quick start

### Installazione (post-GA v2.0.0)

```bash
pnpm add @gluezero/microfrontends @gluezero/core
# oppure
npm install @gluezero/microfrontends @gluezero/core
# oppure
yarn add @gluezero/microfrontends @gluezero/core
```

> **Stato corrente**: workspace-only durante v2.0 alpha. Pubblicato su npm a GA F17.

`@gluezero/microfrontends` dipende da `@gluezero/core` (workspace protocol durante alpha v2.0.0). Entrambi i package devono essere installati insieme — il modulo MF estende il broker tramite il Module Extension Runtime (MIN-1 in `@gluezero/core`) e usa `Broker.unsubscribeByOwner` (MIN-2) per il cascade automatico delle subscription.

### Esempio minimale (Service Locator)

```typescript
import { createBroker, SERVICE_MICROFRONTENDS } from '@gluezero/core'
import {
  microfrontendModule,
  type MicroFrontendsService,
} from '@gluezero/microfrontends'

// 1. Crea broker con il modulo MF installato
const broker = createBroker({ modules: [microfrontendModule()] })

// 2. Ottieni il service tramite Service Locator typed
const mf = broker.getService<MicroFrontendsService>(SERVICE_MICROFRONTENDS)
if (!mf) throw new Error('@gluezero/microfrontends not installed')

// 3. Registra un descriptor MF
await mf.register({
  id: 'customer-dashboard',
  name: 'Customer Dashboard',
  version: '1.0.0',
  loader: { type: 'esm', url: '/mfs/customer.js' },
  mount: { strategy: 'direct', selector: '#mf-root' },
})

// 4. Carica + monta (auto-bootstrap D-V2-07)
await mf.load('customer-dashboard')
await mf.mount('customer-dashboard')

// 5. Ascolta eventi lifecycle
broker.subscribe('microfrontend.mounted', (evt) => {
  console.log('MF mounted:', evt.payload.id)
})
```

### Esempio scenario end-to-end (loader custom + lifecycle hooks)

```typescript
import { createBroker, SERVICE_MICROFRONTENDS } from '@gluezero/core'
import {
  microfrontendModule,
  type MicroFrontendLoaderAdapter,
  type MicroFrontendsService,
} from '@gluezero/microfrontends'

const broker = createBroker({ modules: [microfrontendModule()] })
const mf = broker.getService<MicroFrontendsService>(SERVICE_MICROFRONTENDS)!

// Loader custom (mock per testing/sviluppo locale)
const mockLoader: MicroFrontendLoaderAdapter = {
  type: 'mock',
  async load(_definition, _ctx) {
    return {
      module: { name: 'mock-mf' },
      lifecycle: {
        async bootstrap(ctx) {
          ctx.logger?.info?.('bootstrap chiamato')
        },
        async mount(ctx) {
          ctx.publish('mock.mounted', { id: 'demo' })
        },
        async unmount(ctx) {
          ctx.logger?.info?.('unmount chiamato')
        },
        destroy(ctx) {
          ctx.logger?.info?.('destroy chiamato')
        },
      },
      metadata: {},
    }
  },
}
mf.registerLoader(mockLoader)

// Registra MF
await mf.register({
  id: 'demo',
  name: 'Demo',
  version: '1.0.0',
  loader: { type: 'mock' },
})

// Lifecycle completo
await mf.load('demo')
await mf.mount('demo') // auto-bootstrap incluso
// ... uso ...
await mf.unmount('demo')
await mf.destroy('demo') // cascade unsubscribe automatico
```

### Esempio con Pattern S1 augment (sugar opt-in)

```typescript
import { createBroker } from '@gluezero/core'
import { microfrontendModule } from '@gluezero/microfrontends'
import '@gluezero/microfrontends/augment'  // side-effect import — Pattern S1

const broker = createBroker({ modules: [microfrontendModule()] })

// I metodi sugar sono ora direttamente su `broker.*` (optional `?` per BC v1.x)
await broker.registerMicroFrontend!({
  id: 'mf-a',
  name: 'MF A',
  version: '1.0.0',
})
await broker.mountMicroFrontend!('mf-a')
```

---

## Architettura

### Boundary D-83 strict carryover esteso v2.0

`@gluezero/microfrontends` rispetta il vincolo architetturale **D-83 strict carryover esteso**:

- **F8 è l'UNICA fase v2.0** in cui `git diff packages/core/src/` può essere `≠ vuoto`
- 2 modifiche additive minimal-invasive: **MIN-1** (Module Extension Runtime) + **MIN-2** (`Broker.unsubscribeByOwner` public)
- Bundle delta `@gluezero/core` ≤ +524 B effettivo (cap raise 8320 → 8870 byte gzipped, D-V2-21)
- Consumer v1.x che NON installa il modulo paga **zero byte** runtime (PRD §6.2 MF-MOD-02)
- F9-F17 strict zero diff su `packages/core/src/`

### Capability layer

| Capability | Implementazione F8 | REQ-ID |
|------------|--------------------|--------|
| Registry CRUD | `MicroFrontendsService.register/unregister/get/list/getState/getSnapshot` | MF-REG-01..04 |
| Descriptor validation | Valibot register-time strict + 15+ field opzionali | MF-DESC-01..03 |
| Lifecycle FSM 14 stati | `LifecycleManager` + `ALLOWED_TRANSITIONS` table | MF-LIFE-01..02 |
| Mount strategies | `orchestrateMount` con 4 strategies (direct REAL, shadow-dom/iframe/custom stub) | MF-MOUNT-01..03 |
| Contracts | `validateContracts` + 3 policy levels (`warn`/`fail-registration`/`fail-mount`) | MF-CONTRACT-01..02 |
| Loader Registry | `LoaderRegistry` class + `registerLoader/unregisterLoader/getLoader/getLoaders` | MF-LOADER-REG-01..02 |
| Standard Topics | 3 const arrays + 4 union types (17+7+5 = 29) | MF-EVT-01..05 |
| Runtime Context | `createMfRuntimeContext` explicit object facade | MF-LIFE-03 + MF-OBS-01 |
| Pattern S1 augment | `import '@gluezero/microfrontends/augment'` (opt-in side-effect) | MF-MOD-05 + D-V2-01 |

### Architectural decisions chiave

- **Service Locator (D-V2-02 BLOCKING)**: const `SERVICE_MICROFRONTENDS` esportata da `@gluezero/core/services`. Consumer fa `broker.getService<MicroFrontendsService>(SERVICE_MICROFRONTENDS)`.
- **Pattern S1 augment (D-V2-01 BLOCKING)**: side-effect import attiva declaration merging su `Broker.prototype` — 10 metodi sugar opt-in (`registerMicroFrontend`, `mountMicroFrontend`, ecc.) marcati `?` optional per gracefully degrade quando il modulo non è installato.
- **Failed state unificato (D-V2-06 BLOCKING)**: 1 solo stato `failed` + `failureReason.phase` discriminated (`load`/`bootstrap`/`mount`/`update`/`unmount`/`destroy`/`runtime`). NO 21 stati separati per phase.
- **Auto-bootstrap (D-V2-07)**: `mount(id)` su `state === 'loaded'` chiama `bootstrap` implicito. Override esplicito via `options.skipBootstrap: true`.
- **Subscription cascade (D-V2-16 BLOCKING)**: `unregister/destroy(id) → broker.unsubscribeByOwner('mf:${id}')` automatic — convention helper `mfOwnerId(id)`.
- **Idempotency + concurrent-safe**: `inFlight: Map<id, {op, promise}>` per chiamate identiche → stessa Promise strict identity (P-04 mitigation). Diff op concorrente → throw `MF_LIFECYCLE_IN_FLIGHT`.
- **Explicit object runtime context (NOT Proxy)**: bundle minore + zero overhead Proxy (~1µs/call) — P-02 mitigation. Vedi RESEARCH §8.2.
- **Fast-path pubblicazione (D-V2-F8-13)**: `if (this.publishInterceptors.length === 0) return doPublishFast()` MANDATORY in core MIN-1. Garantisce overhead <5% scenario A (consumer v1.x).

### Pattern Registry replica F2

Il `MicroFrontendsService` riusa il pattern interno di `packages/mapper/src/canonical-registry.ts`: storage `Map<id, Registration>` con `set`/`delete` idempotenti, fresh-copy reads, snapshot fra defensive su scrittura. Vedi `08-RESEARCH.md` §3, §10.

---

## Descriptor reference

### Shape minimo

Solo 3 field mandatori (`id`/`name`/`version`):

```typescript
import type { MicroFrontendDescriptor } from '@gluezero/microfrontends'

const descriptor: MicroFrontendDescriptor = {
  id: 'customer-dashboard',
  name: 'Customer Dashboard',
  version: '1.0.0',
}
```

**Validation rules (D-V2-11 strict, throw `MF_DESCRIPTOR_INVALID`):**
- `id`: regex `^[a-z0-9._-]+$` + length 1-64
- `name`: string non-empty
- `version`: SemVer 2.0 (`X.Y.Z[-pre][+build]`)

### Shape completo (15+ field)

```typescript
const descriptor: MicroFrontendDescriptor = {
  // Mandatori
  id: 'mf.example',
  name: 'Example MF',
  version: '2.1.0-beta.1',

  // Opzionali base
  description: 'Example micro-frontend',
  owner: {
    team: 'platform',
    contact: 'platform@example.com',
    repository: 'https://github.com/example/mf',
  },

  // Loader (F9-F15 effective)
  loader: {
    type: 'esm',
    url: '/mfs/example.js',
    timeoutMs: 15000,
    exportName: 'default',
  },

  // Mount (F8 REAL per direct; F13/F15 per altri)
  mount: {
    strategy: 'direct',
    selector: '#mount-root',
    clearBeforeMount: true,
    className: 'mf-container',
    attributes: { 'data-mf-id': 'mf.example' },
  },

  // Contracts (F8 placeholder, F11/F13 effective)
  contracts: {
    topics: [{ topic: 'user.action', direction: 'publish' }],
    routes: [],
    workers: [],
    contexts: [],
    theme: { provides: ['primary-color'] },
    validation: 'warn',  // | 'fail-registration' | 'fail-mount'
  },

  // Mapping (F10 effective)
  mapping: {
    namespace: 'example',
    strict: false,
  },

  // F11-F14 placeholder
  capabilities: undefined,
  permissions: undefined,
  compatibility: undefined,
  isolation: undefined,
  context: undefined,
  theme: undefined,
  fallback: undefined,
  observability: undefined,

  // Open-ended
  metadata: { customKey: 'customValue', count: 42 },
}
```

### Field validation matrix

| Field | Required | Type | Validation rule |
|-------|----------|------|-----------------|
| `id` | yes | `string` | `^[a-z0-9._-]+$` + length 1-64 |
| `name` | yes | `string` | non-empty |
| `version` | yes | `string` | SemVer 2.0 |
| `description` | no | `string` | unlimited |
| `owner` | no | `MicroFrontendOwner` | shape `{team?, contact?, repository?}` |
| `loader` | no (F9+) | `MicroFrontendLoaderDefinition` | `type` mandatory, `url`/`timeoutMs`/`exportName` opzionali |
| `mount` | no | `MicroFrontendMountDefinition` | `strategy` enum 4 valori; `selector` mandatory per `direct` |
| `contracts` | no | `MicroFrontendContracts` | 6 sub-arrays + `validation` policy |
| `mapping` | no (F10+) | `MicroFrontendMapping` | `namespace` mandatory, `strict` boolean |
| `metadata` | no | `Record<string, unknown>` | open-ended |

---

## Lifecycle FSM

### 14 stati discriminated (D-V2-06 unified failed)

```typescript
type MicroFrontendState =
  | 'registered'      // initial
  | 'resolving'       // pre-load resolution
  | 'loading'         // active load
  | 'loaded'          // loaded, pre-bootstrap
  | 'bootstrapping'   // active bootstrap
  | 'bootstrapped'    // pre-mount
  | 'mounting'        // active mount
  | 'mounted'         // visible in DOM
  | 'updating'        // active update
  | 'unmounting'      // active unmount
  | 'unmounted'       // post-unmount, pre-destroy
  | 'destroying'      // active destroy
  | 'destroyed'       // sink state
  | 'failed'          // unified failure state
```

### Transition diagram (semplificato)

```
registered → resolving → loading → loaded → bootstrapping → bootstrapped → mounting → mounted
                                                                                       ↓ ↑
                                                                              unmounting | updating
                                                                                       ↓ ↑
                                                                              unmounted ↘ ↗
                                                                                   ↓
                                                                              destroying → destroyed

Recovery: failed → loading | destroying  (NO failed → mounted senza recovery esplicito)
```

### Transizioni vietate (throw `MF_STATE_INVALID`)

- `destroyed → mounted` (sink state — solo reload via new registration)
- `failed → mounted` senza passare per `loading` (recovery esplicito)
- ~166 altre combinazioni non-ammesse (vedi const `ALLOWED_TRANSITIONS` in `lifecycle-fsm.ts`)

### Idempotency policies (PRD §10.6, MF-LIFE-07)

| Operazione | State current | Comportamento |
|------------|---------------|---------------|
| `load(id)` | `loaded` o oltre | no-op + return resolved Promise |
| `load(id)` | `loading` in-flight | return stessa Promise (strict identity P-04) |
| `mount(id)` | `loaded` | auto-bootstrap (D-V2-07) → `mounted` |
| `mount(id)` | `mounted` | no-op + log warning |
| `mount(id)` | `mounting` in-flight | return stessa Promise |
| `unmount(id)` | non-`mounted` | no-op + log |
| `destroy(id)` | `destroyed` | no-op silente |
| Concurrent diff-op | qualsiasi | throw `MF_LIFECYCLE_IN_FLIGHT` |

### Failure handling

Quando un hook lifecycle (`bootstrap`/`mount`/`unmount`/`destroy`/`load`) lancia un errore:

1. FSM transition → `failed`
2. `reg.failureReason = { phase, error, timestamp, recoverable? }`
3. Publish `microfrontend.failed` lifecycle event
4. Publish `microfrontend.{phase}.failed` error event (phase-specific topic — 7 totali)
5. Re-throw l'errore al chiamante

Recovery: il chiamante può invocare `service.load(id)` per ritentare (FSM permette `failed → loading`). F14 `@gluezero/fallbacks` introdurrà `RetryPolicy` configurabile.

---

## Pattern S1 augment

### Service Locator vs sugar opt-in

`@gluezero/microfrontends` espone DUE modalità di consumo (D-V2-01 BLOCKING — ENTRAMBE supportate):

**Variante A — Service Locator (recommended)**:

```typescript
import { createBroker, SERVICE_MICROFRONTENDS } from '@gluezero/core'
import { microfrontendModule, type MicroFrontendsService } from '@gluezero/microfrontends'

const broker = createBroker({ modules: [microfrontendModule()] })
const mf = broker.getService<MicroFrontendsService>(SERVICE_MICROFRONTENDS)!
await mf.register(descriptor)
```

Pro:
- Esplicito (vedi quale modulo fornisce quale API)
- TypeScript narrowing automatico via `getService<T>`
- Funziona senza side-effect import
- Tree-shake friendly (nessun augment caricato se non serve)

**Variante B — Pattern S1 sugar (opt-in)**:

```typescript
import { createBroker } from '@gluezero/core'
import { microfrontendModule } from '@gluezero/microfrontends'
import '@gluezero/microfrontends/augment'  // side-effect import — Pattern S1

const broker = createBroker({ modules: [microfrontendModule()] })
await broker.registerMicroFrontend!(descriptor)
```

Pro:
- API shortcut diretta su `broker.*`
- Tutti i 10 metodi `?` optional (gracefully degrade se modulo non installato)
- Replica esatta del pattern F2 `@gluezero/mapper/augment`

### Tree-shaking & side-effects

`@gluezero/microfrontends/augment` è un side-effect entry. Per evitare il tree-shake fail (T-F8-08 mitigation), il `package.json` dichiara:

```json
"sideEffects": [
  "./dist/augment.js",
  "./src/augment.ts",
  "**/augment.js",
  "**/augment.ts"
]
```

Mitigazione a 3 layer: sideEffects array + glob `**/augment.*` + `__mfAugmentLoaded: true` marker const re-esportata da `index.ts`.

### Verifica installazione

```typescript
import { SERVICE_MICROFRONTENDS } from '@gluezero/core'
import { __mfAugmentLoaded } from '@gluezero/microfrontends'

// Via service locator
const mf = broker.getService(SERVICE_MICROFRONTENDS)
console.log('Modulo installato:', mf !== undefined)

// Via marker augment (solo se import '@gluezero/microfrontends/augment' eseguito)
console.log('Augment caricato:', __mfAugmentLoaded === true)
```

---

## Standard topics

### 29 topics totali (D-V2-F8-12 lockato)

**17 lifecycle topics** (`MF_LIFECYCLE_TOPICS`):
```
microfrontend.registered, unregistered, resolving, loading, loaded,
bootstrapping, bootstrapped, mounting, mounted, updating, updated,
unmounting, unmounted, destroying, destroyed, failed, reloaded
```

**7 error topics** (`MF_ERROR_TOPICS`):
```
microfrontend.load.failed, bootstrap.failed, mount.failed, runtime.failed,
update.failed, unmount.failed, destroy.failed
```

**5 governance topics** (`MF_GOVERNANCE_TOPICS` — emessi da F11-F14):
```
microfrontend.capability.missing, compatibility.failed, permission.denied,
isolation.warning, fallback.rendered
```

### Helper mappings

```typescript
import {
  MF_LIFECYCLE_TOPIC_FOR_STATE,
  MF_ERROR_TOPIC_FOR_PHASE,
  type MfLifecycleTopic,
  type MfErrorTopic,
} from '@gluezero/microfrontends'

// State → topic mapping
const topic: MfLifecycleTopic | undefined = MF_LIFECYCLE_TOPIC_FOR_STATE['mounted']
// → 'microfrontend.mounted'

// Failure phase → error topic mapping
const errTopic: MfErrorTopic | undefined = MF_ERROR_TOPIC_FOR_PHASE['bootstrap']
// → 'microfrontend.bootstrap.failed'
```

### Payload shapes

**Lifecycle event** (PRD §31.4):

```typescript
interface MicroFrontendLifecycleEventPayload {
  readonly id: string
  readonly name: string
  readonly version: string
  readonly previousState?: MicroFrontendState
  readonly state: MicroFrontendState
  readonly timestamp: number
  readonly descriptor?: MicroFrontendDescriptor  // solo 'registered' (P-15 retention mitigation)
  readonly timings?: MicroFrontendTimings
  readonly metadata?: Record<string, unknown>
}
```

**Error event** (PRD §31.5):

```typescript
interface MicroFrontendErrorEventPayload {
  readonly id: string
  readonly name?: string
  readonly version?: string
  readonly phase: 'load' | 'bootstrap' | 'mount' | 'update' | 'unmount' | 'destroy' | 'runtime'
  readonly error: { message: string; code?: string; stack?: string }
  readonly recoverable: boolean
  readonly fallbackApplied?: boolean
  readonly timestamp: number
}
```

### Subscribe pattern

```typescript
import { MF_LIFECYCLE_TOPICS, type MfLifecycleTopic } from '@gluezero/microfrontends'

// Subscribe a tutti gli eventi lifecycle
for (const topic of MF_LIFECYCLE_TOPICS) {
  broker.subscribe(topic, (evt) => {
    console.log(`[${topic}]`, evt.payload)
  })
}

// Subscribe pattern wildcard (TopicTrie support)
broker.subscribe('microfrontend.*.failed', (evt) => {
  console.error('MF error:', evt.payload)
})
```

---

## Q&A

### D: Quali pacchetti dipendono da `@gluezero/microfrontends`?

R: F8 è il **foundation gate** v2.0 — tutti i pacchetti v2.0 successivi (`@gluezero/context`, `@gluezero/permissions`, `@gluezero/compat`, `@gluezero/isolation`, `@gluezero/fallbacks`, `@gluezero/mf-esm`, `@gluezero/mf-web-component`, ecc.) dipendono da `@gluezero/microfrontends` come peerDep. Vedi `ROADMAP.md` Phase 9-17.

### D: Il modulo `microfrontendModule()` è single-instance globale?

R: No (D-30 anti-singleton). `microfrontendModule()` ritorna sempre un nuovo `BrokerModule`. Il consumer chiama `microfrontendModule()` UNA volta per `createBroker({modules: [...]})`. Pattern factory che replica F1 `createBroker`.

### D: Quando si attiva il fast-path `publishInterceptors`?

R: Sempre in F8 (seam vuoto). `if (this.publishInterceptors.length === 0) return doPublishFast()` è MANDATORY in core MIN-1 (D-V2-F8-13 + P-02 mitigation). F11 attiverà lo slow-path aggiungendo il permission interceptor. Bench `<5%` regression scenario A garantito.

### D: Come scrivo un loader custom?

R: Implementa l'interface `MicroFrontendLoaderAdapter`:

```typescript
import type { MicroFrontendLoaderAdapter } from '@gluezero/microfrontends'

const myLoader: MicroFrontendLoaderAdapter = {
  type: 'my-custom',
  async load(definition, ctx) {
    // Carica il modulo via fetch/import/qualsiasi strategia
    const lifecycle = await fetchMyModule(definition.url!)
    return { module: lifecycle, lifecycle, metadata: {} }
  },
}

service.registerLoader(myLoader)
```

F9 fornirà `@gluezero/mf-esm` (loader `import(url)` con `AbortSignal.timeout`). F15 fornirà `@gluezero/mf-web-component`, `@gluezero/mf-iframe`, `@gluezero/mf-module-federation`, `@gluezero/mf-single-spa`.

### D: Posso usare il MOCK loader nei miei test?

R: F8 GA NON espone il MOCK loader come API pubblica (D-V2-F8-03). Il MOCK loader è privato in `test-utils/` (NON nel barrel `index.ts`). Per V2.0 GA: il consumer scrive il proprio mock implementando `MicroFrontendLoaderAdapter`. Vedi snippet in **D: Come scrivo un loader custom?**. V2.1 potrà esporre `@gluezero/microfrontends/testing` se la community demand emerge (deferred in `deferred-items.md`).

### D: Come gestire failure recovery?

R: F8 supporta recovery base via FSM:
- `failed → loading` (re-attempt load)
- `failed → destroying` (cleanup forzato)

```typescript
const state = service.getState('my-mf')
if (state === 'failed') {
  // Retry caricamento
  await service.load('my-mf')
}
```

F14 `@gluezero/fallbacks` introdurrà `RetryPolicy` configurabile (`attempts`/`delay`/`backoff`).

### D: Come accedo a `microFrontendId` nei subscriber?

R: Quando un MF pubblica via `ctx.publish(...)` (runtime context facade), il facade enricha automaticamente `event.metadata.microFrontendId` (MF-OBS-01):

```typescript
broker.subscribe('any.topic', (evt) => {
  const mfId = (evt.metadata as { microFrontendId?: string }).microFrontendId
  if (mfId) console.log('Pubblicato da MF:', mfId)
})
```

### D: Come verifico se `@gluezero/microfrontends` è installato?

R: Due strade equivalenti:

```typescript
// Via Service Locator (graceful)
import { SERVICE_MICROFRONTENDS } from '@gluezero/core'
const mf = broker.getService(SERVICE_MICROFRONTENDS)
if (!mf) {
  console.log('@gluezero/microfrontends NOT installed')
}

// Via Pattern S1 marker (richiede l'augment import)
import '@gluezero/microfrontends/augment'
import { __mfAugmentLoaded } from '@gluezero/microfrontends'
console.log('augment loaded:', __mfAugmentLoaded === true)
```

### D: Cos'è il "bit-exact bundle" per consumer v1.x?

R: SC1 della Phase 8 (ROADMAP): `createBroker({})` senza `modules` produce un bundle byte-identico al v1.x. Verificato dal Tier-3 `bundle-size-core-only.test.ts` in `packages/core/src/__bc_replay__/`. Se un consumer v1.x esistente migra a `@gluezero/core@2.0.0` SENZA installare il modulo MF, non paga byte runtime — solo +524 B nel bundle core (MIN-1 + MIN-2 seam).

### D: Pattern S1 augment è opt-in o sempre attivo?

R: Opt-in. L'augment è un side-effect import che il consumer DEVE eseguire esplicitamente:

```typescript
import '@gluezero/microfrontends/augment'  // ← opt-in
```

Se l'import non viene eseguito, i metodi sugar (`broker.registerMicroFrontend`, ecc.) non sono definiti sul prototype. I tipi sono dichiarati come `?` optional in `Broker` interface (declaration merging) per evitare TypeScript errors quando l'augment non è caricato.

### D: Cos'è il cascade unsubscribe (D-V2-16)?

R: Quando un MF chiama `unregister(id)` o `destroy(id)`, il service invoca automaticamente `broker.unsubscribeByOwner(mfOwnerId(id))` (== `mf:${id}`) nel `finally` block. Tutte le subscription create dal MF tramite il runtime context facade (auto-taggate con `ownerId = mfOwnerId(id)`) vengono cleanup-ate. Previene memory leak da subscription orphan post-unmount (P-06 mitigation).

---

## Bundle size

| Bundle | Cap | Misurato F8 |
|--------|-----|--------------|
| `@gluezero/core` (post-MIN-1+MIN-2) | 8870 B gzip (D-V2-21) | bundle delta ≤ +524 B vs v1.x |
| `@gluezero/microfrontends` (full) | 12 KB gzip (D-V2-F8-05) | ~7-8 KB stimato |
| `@gluezero/microfrontends/augment` (sugar) | 1 KB gzip (OQ-07) | ~300-400 B |

Verifica:
```bash
pnpm --filter @gluezero/microfrontends build
pnpm ci:size
```

Il check `ci:size` blocca CI in caso di sforamento. Per il consumer v1.x (NO `modules: [microfrontendModule()]`), il runtime cost è zero byte (PRD §6.2 MF-MOD-02).

---

## Testing

GlueZero adotta una strategia di test a 3 livelli:

- **Tier-1 jsdom** (~90% test surface, ≥370 test cumulativi): `pnpm --filter @gluezero/microfrontends test`
- **Tier-3 Playwright Chromium** (3 scenari minimal targeted — D-V2-F8-04): `pnpm --filter @gluezero/microfrontends test:browser`
  1. `__integration__/end-to-end-scenario.test.ts` — MOCK loader + heap snapshot post 100 cycles (P-06 mitigation)
  2. `__integration__/race-idempotency.test.ts` — Concurrent race idempotency (P-04 mitigation)
  3. `packages/core/src/__bc_replay__/bundle-size-core-only.test.ts` — v1-bc-replay (F8-F17 cross-phase gate)

Esempio uso del test harness interno:

```typescript
import { createBroker } from '@gluezero/core'
import { microfrontendModule } from '@gluezero/microfrontends'

const broker = createBroker({ modules: [microfrontendModule()] })
// ... setup test ...
```

---

## REQ-IDs coverage

Phase 8 chiude **43 REQ-IDs** distribuiti su 12 plan. Mapping plan → REQ-IDs:

| Plan | REQ-IDs coperti |
|------|-----------------|
| 08-01 | MF-PKG-01..03 (scaffold + scripts) |
| 08-02 | MF-MOD-01..04 (Module Extension Runtime MIN-1) |
| 08-03 | MF-INT-LIFE-01..03 (`Broker.unsubscribeByOwner` MIN-2) |
| 08-04 | MF-DESC-01..03 (descriptor types + validator + error class) |
| 08-05 | MF-REG-01..04 + MF-LOADER-REG-01..02 + MF-MOD-05 (Pattern S1 augment) |
| 08-06 | MF-LIFE-01..02 + MF-LIFE-04..06 (FSM 14 stati + ALLOWED_TRANSITIONS) |
| 08-07 | MF-LIFE-03 + MF-LIFE-07 (lifecycle ops wired + idempotency P-04) |
| 08-08 | MF-MOUNT-01..03 (4 mount strategies) |
| 08-09 | MF-CONTRACT-01..02 + MF-LOADER-REG (loaders+contracts) |
| 08-10 | MF-EVT-01..05 (17+7+5 standard topics + payload shapes) |
| 08-11 | MF-OBS-01 + Tier-3 end-to-end (runtime context facade + heap test) |
| 08-12 | MF-BC-01..04 (closure: BC verify + README + JSDoc + bundle gate) |

### Phase 8 success criteria — status finale

| SC | Descrizione | Verifica | Status |
|----|-------------|----------|--------|
| SC1 | `createBroker({})` runtime bit-exact v1.x + v1-bc-replay PASS | Tier-3 `bundle-size-core-only.test.ts` + 10 file v1-bc-replay | VERIFIED |
| SC2 | Scenario E2E MOCK loader → cleanup verified heap snapshot | Tier-3 `end-to-end-scenario.test.ts` (08-11) | VERIFIED |
| SC3 | 14 transitions enforce + 17+7+5 topics emitted | Tier-1 cumulative (08-06 FSM + 08-10 topics) | VERIFIED |
| SC4 | `git diff main...HEAD packages/core/src/` mostra solo MIN-1 + MIN-2 additive | D-83 strict carryover esteso — `git diff` empty per altri file | VERIFIED |
| SC5 | Bench publish overhead `<5%` scenario A | Fast-path `publishInterceptors.length === 0` MANDATORY in MIN-1 | VERIFIED |

---

## Riferimenti

- **PRD v2.0**: `prd_2.0.0.md` §6, §10, §11, §13, §15, §16, §22, §29.5, §31, §36, §39.2, §42
- **REQUIREMENTS**: `.planning/REQUIREMENTS.md` 43 REQ-IDs F8 (`MF-REG`/`MF-DESC`/`MF-LIFE`/`MF-MOUNT`/`MF-CONTRACT`/`MF-EVT`/`MF-MOD`/`MF-LOADER-REG`/`MF-BC`/`MF-PKG`/`MF-OBS`/`MF-INT-LIFE`)
- **Decisioni BLOCKING**: D-V2-01 (Pattern S1) · D-V2-02 (Service Locator) · D-V2-06 (failed unified) · D-V2-07 (auto-bootstrap) · D-V2-10 (alias precedence) · D-V2-11 (descriptor strict) · D-V2-16 (cascade unsubscribe) · D-V2-21 (bundle cap raise) · D-83 (strict carryover esteso)
- **Research**: `.planning/phases/08-extension-runtime-mf-registry-lifecycle-fsm-standard-topics/08-RESEARCH.md`
- **Pattern**: `.planning/phases/08-extension-runtime-mf-registry-lifecycle-fsm-standard-topics/08-PATTERNS.md`
- **Pacchetti analoghi**: [`packages/mapper/README.md`](../mapper/README.md) (template struttura) + [`packages/cache/README.md`](../cache/README.md) (densità JSDoc) + [`packages/devtools/src/inspector.ts`](../devtools/src/inspector.ts) (JSDoc style)

## Licenza

MIT © Omar Di Marzio

[Repository GitHub](https://github.com/omardimarzio/GlueZero)
