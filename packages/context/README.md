# @gluezero/context

> **Runtime Context module + per-MF mapping integration per GlueZero v2.0** — Container reattivo per propagazione 11 chiavi standard PRD §18.4 con selector subscribe granulare + integrazione canonical mapper F2 namespace-scoped per micro-frontend.

**Stato:** experimental — alpha `v2.0.0`. Non pubblicato su npm fino alla GA v2.0.0 (Phase 17).

![Status: experimental](https://img.shields.io/badge/status-experimental_alpha-orange)
![Bundle](https://img.shields.io/badge/bundle-≤4_KB_gzipped-blue)
![Tier-1](https://img.shields.io/badge/tests-Tier--1_jsdom-green)
![REQ-IDs](https://img.shields.io/badge/REQ--IDs-11%2F11-success)
![D--83](https://img.shields.io/badge/D--83-strict_triple_v2.0-purple)

ESM-only TypeScript library. Browser evergreen target (ES2022). Espone un container `RuntimeContext` reattivo con 5 API CRUD (set/replace/get/subscribe/clear), 8 standard events fire pattern 1 aggregator + N specific, writableKeys ACL fail-secure per micro-frontend, integrazione canonical mapper F2 namespace-scoped, Inspector EventTap wrapper con attribution `microFrontendId`, e contextMap auto-injection LIVE in `ctx.context`.

Tre dipendenze peer obbligatorie: [`@gluezero/core`](../core/README.md) (broker base), [`@gluezero/microfrontends`](../microfrontends/README.md) (registry + FSM), [`@gluezero/mapper`](../mapper/README.md) (canonical model + AliasRegistry namespace-scoped).

## Indice

1. [Quick start](#quick-start)
2. [Installazione](#installazione)
3. [RuntimeContext API](#runtimecontext-api)
4. [Selector subscribe](#selector-subscribe)
5. [Read-only enforcement](#read-only-enforcement)
6. [Mapping per-MF](#mapping-per-mf)
7. [contextMap auto-injection LIVE](#contextmap-auto-injection-live)
8. [Errors](#errors)
9. [Q&A](#qa)
10. [REQ-IDs coverage + bundle size](#req-ids-coverage--bundle-size)

---

## Quick start

```ts
import { createBroker } from '@gluezero/core'
import { microfrontendModule } from '@gluezero/microfrontends'
import { contextModule, setRuntimeContext, subscribeRuntimeContext } from '@gluezero/context'

// Ordine moduli OBBLIGATORIO — microfrontendModule() PRIMA di contextModule()
const broker = createBroker({
  modules: [microfrontendModule(), contextModule()],
})

// App shell scrive context
setRuntimeContext({ tenantId: 'acme', user: { id: 'u1' }, locale: 'en' })

// Subscribe granulare con reference identity preservata
const off = subscribeRuntimeContext(
  (ctx) => ctx.user,
  (user, prev) => console.log('user changed:', user),
)

// Update solo locale → handler NON invocato (shallow gate Object.is top-level)
setRuntimeContext({ locale: 'it' })

// Cleanup esplicito
off()
```

Vedi [`examples/microfrontends/mf-context-basic.html`](../../examples/microfrontends/mf-context-basic.html) per demo HTML standalone.

---

## Installazione

Post-GA v2.0.0 (al momento workspace-only durante v2.0 alpha):

```bash
pnpm add @gluezero/core @gluezero/microfrontends @gluezero/mapper @gluezero/context
```

Bundle gate: ≤ 4 KB gzipped (D-V2-F10-19 lockato).

Pattern S1 augment opt-in via subpath (intent signaling, no DX surface):

```ts
import '@gluezero/context/augment'  // side-effect (D-V2-F10-17 stretto)
```

---

## RuntimeContext API

5 metodi pubblici CRUD (MF-CTX-01, PRD §18.5):

```ts
function setRuntimeContext(partial: Partial<RuntimeContext>, options?: SetContextOptions): void
function replaceRuntimeContext(next: RuntimeContext, options?: SetContextOptions): void
function getRuntimeContext(): Readonly<RuntimeContext>
function clearRuntimeContext(keys?: ReadonlyArray<keyof RuntimeContext>, options?: SetContextOptions): void
function subscribeRuntimeContext<T>(selector, handler, options?): () => void  // overload TS
```

### Shape `RuntimeContext` — 11 chiavi standard (MF-CTX-02, PRD §18.4)

| Chiave | Tipo | Topic specifico |
|--------|------|----------------|
| `tenantId` | `string?` | `context.tenant.changed` |
| `user` | `RuntimeUser?` | `context.user.changed` |
| `locale` | `string?` | `context.locale.changed` |
| `timezone` | `string?` | (solo aggregator) |
| `permissions` | `readonly string[]?` | `context.permissions.changed` |
| `featureFlags` | `Record<string, boolean>?` | `context.featureflags.changed` |
| `theme` | `string?` | `context.theme.changed` |
| `direction` | `'ltr' \| 'rtl'?` | (solo aggregator) |
| `environment` | `'development' \| 'staging' \| 'production'?` | (solo aggregator) |
| `currentRoute` | `RuntimeRouteContext?` | `context.route.changed` |
| `metadata` | `Record<string, unknown>?` | (solo aggregator) |

### Fire pattern 1 + N (D-V2-F10-13)

Ogni `setRuntimeContext` che cambia N chiavi pubblica **1 aggregator + N specific** events sync flush (FIFO ordering coerente F1 `broker.publish` — v1-bc-replay #1):

```ts
setRuntimeContext({ tenantId: 'X', user: U })
// Publica:
//   - context.changed (aggregator, changedKeys: ['tenantId', 'user'])
//   - context.tenant.changed (focused, changedKeys: ['tenantId'])
//   - context.user.changed (focused, changedKeys: ['user'])
```

Sync flush (D-V2-F10-14): NO microtask batching, NO debouncing — ogni mutation pubblica immediatamente.

---

## Selector subscribe

Overload TypeScript (D-V2-F10-01) — funzione arbitraria O keys-array shortcut:

```ts
// Function selector
subscribeRuntimeContext((ctx) => ctx.user, (u, prev) => { /* ... */ })

// Keys array shortcut (`as const` obbligatorio per inference precisa)
subscribeRuntimeContext(
  ['user', 'tenantId'] as const,
  (slice, prev) => { /* slice: Pick<RuntimeContext, 'user' | 'tenantId'> */ },
)
```

**Reference identity preservata** (D-V2-F10-02 shallowEqual gate Object.is top-level):

```ts
setRuntimeContext({ user: U })  // initial
subscribeRuntimeContext((ctx) => ctx.user, handler)
setRuntimeContext({ locale: 'it' })  // user invariato → handler NON invocato
```

**AbortSignal cascade** (D-V2-F10-04):

```ts
const ctrl = new AbortController()
subscribeRuntimeContext(sel, handler, { signal: ctrl.signal })
ctrl.abort()  // auto-cleanup
```

### P-17 anti-pattern + pattern stabile

```ts
// ❌ Anti-pattern: nuovo wrapper object ad ogni dispatch
subscribeRuntimeContext(
  (ctx) => ({ user: ctx.user, tenant: ctx.tenantId }),
  handler,
)
// Shallow gate Object.is top-level previene cascade SOLO se ctx.user
// e ctx.tenantId mantengono ref identico → wrapper shallow eq → NO trigger.

// ✅ Pattern stabile: selector reference top-level stabile
const userTenantSel = (ctx: RuntimeContext) => ({ user: ctx.user, tenant: ctx.tenantId })
subscribeRuntimeContext(userTenantSel, handler)
```

Selector throw isolation (T-F10-02): se `selector` throw, skip subscriber con `continue` (no cascade crash). Handler throw → log-only.

---

## Read-only enforcement

writableKeys allowlist per-MF (MF-CTX-04, D-V2-F10-05/06 fail-secure default):

```ts
broker.registerMicroFrontend!({
  id: 'customer-dashboard',
  loader: { type: 'esm', url: '...' },
  context: { writableKeys: ['currentRoute'] },  // MF può scrivere SOLO currentRoute
})

// Da MF facade (callerMfId)
setRuntimeContext({ tenantId: 'X' }, { callerMfId: 'customer-dashboard' })
// → publica 'microfrontend.context.denied' con payload {microFrontendId, attemptedKeys, allowedKeys, timestamp}
// → throw BrokerError code: 'MF_CONTEXT_WRITE_DENIED'
```

Default `writableKeys = []` (vuoto) → MF read-only by default (fail-secure D-V2-F10-05).

App shell (broker raw caller, `callerMfId === undefined`) sempre allowed (pass-through D-V2-F10-05).

**Flow su denied:** publish topic PRIMA → throw POI (debug visibility + audit, D-V2-F10-06).

---

## Mapping per-MF

Per-MF `MapperEngine` instance scoped (MF-MAP-01/02 + MF-INT-MAP-01, D-V2-F10-09):

```ts
broker.registerMicroFrontend!({
  id: 'mf-customer',
  loader: { type: 'esm', url: '...' },
  mapping: {
    inputMap: { customerId: { canonical: 'customer_id' } },
    contextMap: { currentTenant: 'tenantId' },
    namespace: 'mf:mf-customer',
  },
})
```

Riusa F2 `MapperEngine` + `AliasRegistry` via DI 5-args zero diff (D-83 strict). Namespace `mf:${mfId}` scoped. Cleanup `unregisterScopedAll` su unmount (T-F10-05 leak prevention).

Explicit MF `inputMap` WINS su global alias (D-V2-F10-11) + warn log dedup `${mfId}:${field}`.

### Mapping Inspector attribution (MF-MAP-03 + MF-INT-MAP-02)

Composition wrapper Proxy-style D-46 carryover — F2 inspector class UNCHANGED (D-83 strict):

```ts
import { MappingInspector } from '@gluezero/mapper'
import { wrapInspectorWithMfAttribution } from '@gluezero/context'

const inspector = new MappingInspector({ errorBufferSize: 50 })
let currentMfId: string | undefined
const wrapped = wrapInspectorWithMfAttribution(inspector, () => currentMfId)

currentMfId = 'customer-dashboard'
wrapped.recordError(err)
// → details.microFrontendId = 'customer-dashboard' injected automaticamente (NO mutation di err)
```

---

## contextMap auto-injection LIVE

`ctx.context` field popolato LIVE post-mount (MF-CTX-06 + D-V2-F10-15):

```ts
broker.registerMicroFrontend!({
  id: 'mf-x',
  mapping: { contextMap: { currentTenant: 'tenantId', language: 'locale' } },
})

// Dentro MF lifecycle mount hook:
function mount(ctx: MicroFrontendRuntimeContext) {
  console.log(ctx.context)
  // → { tenantId: 'acme', locale: 'it', currentTenant: 'acme', language: 'it' }
  //   standard passthrough + alias overlay PRD §18.8
}
```

Auto-update su ogni `context.changed` (internal subscribe full state). Cleanup via `abortSignal` mount lifecycle plumbed F8 (D-V2-F10-04 + T-F10-W2-P04-03 leak mitigation).

Strategy A mutation cast: F8 `createMfRuntimeContext` ritorna oggetto NON-frozen verificato — mutation a runtime safe (T-F10-W2-P04-04).

---

## Errors

Code locale `MF_CONTEXT_WRITE_DENIED` (NON in `MicroFrontendErrorCode` union F8 — D-83 strict block):

```ts
try {
  setRuntimeContext({ tenantId: 'X' }, { callerMfId: 'mf-x' })
} catch (err) {
  if (err.code === 'MF_CONTEXT_WRITE_DENIED') {
    console.log(err.details)
    // { mfId, attemptedKeys, allowedKeys, deniedKeys }
  }
}
```

Topic `microfrontend.context.denied` PRIMA del throw (debug visibility):

```ts
broker.subscribe('microfrontend.context.denied', (e) => {
  console.log(e.payload) // { microFrontendId, attemptedKeys, allowedKeys, timestamp }
})
```

---

## Q&A

**Q: Perché shallow gate Object.is e non deep-equal?**
A: Bundle saving (~600 B) + anti-pattern stack ban list. Consumer responsabile immutability via spread (`{...prev, field: new}`). Stable selector reference (top-level estratto) per ottimizzare ulteriormente.

**Q: Perché writableKeys allowlist e non blocklist?**
A: Fail-secure default — MF non dichiarato = read-only by default. Blocklist alternativa (`readOnlyKeys`) defer V2.1 se DX feedback emerge dal consumer reale (D-V2-F10-05).

**Q: Posso usare deep-frozen state?**
A: NO — perf overhead + bundle. Doc-only "treat returned snapshots as immutable" (D-V2-F10-07).

**Q: Posso modificare `MicroFrontendErrorCode` per aggiungere `MF_CONTEXT_WRITE_DENIED`?**
A: NO — D-83 strict triple v2.0 lockato (zero diff `packages/microfrontends/src/`). F10 espone `ContextErrorCode` literal LOCALE via `@gluezero/context` (D-V2-F9-12 carryover).

**Q: Come integro con React?**
A: F17 framework adapters introdurranno `useRuntimeContext(selector)` hook React + Vue + Web Components. F10 espone API agnostica.

**Q: Perché `context.featureflags.changed` lowercase e non `context.featureFlags.changed`?**
A: F1 broker regex topic `^[a-z][a-z0-9]*(\\.[a-z][a-z0-9*]*)*$` (D-08 TopicTrie) — lowercase per segment obbligatorio. Convention coerente F8 (`microfrontend.load.failed` ecc.).

---

## REQ-IDs coverage + bundle size

| REQ-ID | Implementazione | Test |
|--------|-----------------|------|
| MF-CTX-01 | 5 API CRUD (set/replace/get/subscribe/clear) | runtime-context.test.ts + integration SC1 |
| MF-CTX-02 | 11 chiavi PRD §18.4 | runtime-context.test.ts |
| MF-CTX-03 | 8 events fire pattern (1 aggregator + 7 specific) | events.test.ts + integration SC3 |
| MF-CTX-04 | writableKeys ACL fail-secure + throw + topic | acl-enforcer.test.ts + integration |
| MF-CTX-05 | Selector subscribe overload + reference identity | selector.test.ts + integration SC1 |
| MF-CTX-06 | Debug snapshot + contextMap LIVE | context-map-facade.test.ts + integration SC3 |
| MF-MAP-01 | MicroFrontendMapping 6 fields | mapping-integration.test.ts + integration SC2 |
| MF-MAP-02 | Namespace isolation + explicit wins | mapping-integration.test.ts + collision-tracker.test.ts |
| MF-MAP-03 | Inspector `microFrontendId` attribution | inspector-wrapper.test.ts |
| MF-INT-MAP-01 | Canonical mapper F2 riusato namespace-scoped | mapping-integration.test.ts |
| MF-INT-MAP-02 | Inspector ring buffer F2 esteso | inspector-wrapper.test.ts |

**Bundle size:** target ≤ 4 KB gzipped (D-V2-F10-19 lockato). Verifica:

```bash
pnpm size-limit --filter @gluezero/context
```

**Testing:**

```bash
pnpm --filter @gluezero/context test               # Tier-1 jsdom unit (117 test)
pnpm --filter @gluezero/context test:integration   # Tier-1 jsdom E2E SC1-SC4 (22 test)
```

NO Tier-3 Playwright (D-V2-F10-16 — F10 logica pura JS, no DOM-heavy concern).

---

*Phase 10 — Runtime Context Module + Mapping per-MF (v2.0.0-alpha.0). Vedi [PRD §16 + §18](../../prd_2.0.0.md) per il contratto completo.*
