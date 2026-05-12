# @gluezero/permissions

> **Permission engine sincrono + Capability Registry + Pipeline §28 extension per MicroFrontend GlueZero v2.0** — Pattern matching 4 modes con deny-wins order-independent, LRU cache 500 entries event-driven, capability negotiation con first-wins, integrazione lifecycle 7 topics.

**Stato:** experimental — alpha `v2.0.0`. Non pubblicato su npm fino alla GA v2.0.0 (Phase 17).

![Status: experimental](https://img.shields.io/badge/status-experimental_alpha-orange)
![Bundle](https://img.shields.io/badge/bundle-≤_5_KB_gzipped-blue)
![Tier-1](https://img.shields.io/badge/tests-Tier--1_jsdom-green)
![REQ-IDs](https://img.shields.io/badge/REQ--IDs-13%2F13-success)
![D--83](https://img.shields.io/badge/D--83-strict_triple_v2.0-purple)

ESM-only TypeScript library. Browser evergreen target (ES2022). Espone una API combinata Permission + Capability + lifecycle integration via `permissionsModule({permissionMode?, capabilityPolicy?})` factory. Tre dipendenze peer: [`@gluezero/core`](../core/README.md) + [`@gluezero/microfrontends`](../microfrontends/README.md) (required), [`@gluezero/context`](../context/README.md) (optional).

## Indice

1. [Quick start](#quick-start)
2. [Install](#install)
3. [Pattern matching (4 modes + deny-wins)](#1-pattern-matching-4-modes--deny-wins)
4. [Le 10 enforcement points](#2-le-10-enforcement-points-action-discriminator)
5. [LRU cache](#3-lru-cache-500-entries-event-driven-invalidation)
6. [Capability Registry](#4-capability-registry-5-api-methods-prd-174)
7. [Modes `off` | `warn` | `enforce` + per-MF override](#5-modes-off--warn--enforce--per-mf-override)
8. [Pipeline §28 extension](#6-pipeline-28-extension-d-v2-20-blocking--chiusura-prd-4711)
9. [⚠️ Modello di sicurezza (P-13)](#7--modello-di-sicurezza-p-13--governance-not-crypto-sandbox)
10. [Errors](#8-errors)
11. [Esempi](#9-esempi)
12. [Q&A](#10-qa)

---

## Quick start

```typescript
import { createBroker } from '@gluezero/core'
import { microfrontendModule } from '@gluezero/microfrontends'
import { permissionsModule } from '@gluezero/permissions'

const broker = createBroker({
  modules: [
    microfrontendModule(),
    permissionsModule({ permissionMode: 'enforce', capabilityPolicy: 'block-mount' }),
  ],
})

const mfService = broker.getService('microfrontends')
mfService.register({
  id: 'customer-dashboard',
  name: 'customer-dashboard',
  version: '1.0.0',
  loader: { type: 'esm', url: '/customer-dashboard.js' },
  permissions: { publish: ['customer.*', '!customer.pii.*'] },
  capabilities: { requires: [{ name: 'theme.v1', version: '1.0.0' }] },
})
```

Vedi [`examples/microfrontends/mf-permissions-demo.html`](../../examples/microfrontends/mf-permissions-demo.html) per demo HTML standalone 2-MF.

---

## Install

```bash
pnpm add @gluezero/permissions @gluezero/microfrontends @gluezero/core
```

**Ordering obbligatorio dei modules**:

1. `microfrontendModule()` — fornisce `SERVICE_MICROFRONTENDS` (richiesto da permissions).
2. `contextModule()` — opzionale (preparazione per actions `context.*`).
3. `permissionsModule({permissionMode?, capabilityPolicy?})` — install via Service Locator.

PeerDeps: `@gluezero/core`, `@gluezero/microfrontends` (required); `@gluezero/context` (optional).

Bundle gate: ≤ 5 KB gzipped (D-V2-F11-19 lockato).

---

## 1. Pattern matching (4 modes + deny-wins)

PRD §19.4 — pattern syntax:

| Pattern | Semantica | Esempio match |
|---------|-----------|---------------|
| `customer.order` | Esatto | `customer.order` only |
| `customer.*` | Wildcard finale **multi-segment** (DIVERGE F1) | `customer`, `customer.X`, `customer.X.Y.Z` |
| `*` | Wildcard globale | qualunque topic |
| `!customer.pii.*` | Deny esplicito | overrides allow su match (deny-wins) |

**Deny-wins always order-independent** (D-V2-F11-05):

```typescript
// Tutti questi descriptor sono SEMANTICAMENTE EQUIVALENTI:
{ publish: ['customer.*', '!customer.pii.*'] }
{ publish: ['!customer.pii.*', 'customer.*'] }
// → publish 'customer.order.created' = ALLOWED
// → publish 'customer.pii.email' = DENIED (deny-wins)
```

---

## 2. Le 10 enforcement points (action discriminator)

D-V2-F11-03 — single engine + 10 actions runtime granular:

| Action | Categoria descriptor | Note |
|--------|---------------------|------|
| `publish` | `publish` | F8 facade wrap (W2 P03) |
| `subscribe` | `subscribe` | F8 facade wrap (W2 P03) |
| `route` | `route` | future F12+ |
| `gateway` | `gateway` | future F13 |
| `worker` | `worker` | future F13 |
| `context.read` | `context` | future F11+ context integration |
| `context.write` | `context` | future F11+ context integration |
| `storage.read` | `storage` | future F13 isolation |
| `storage.write` | `storage` | future F13 isolation |
| `theme` | `theme` | future F13 theme integration |
| `devtools` | `devtools` | future F16 |

F11 wrap PUBLISH + SUBSCRIBE via facade composition esterna (OQ-1 — vedi sezione 8).

---

## 3. LRU cache (500 entries, event-driven invalidation)

D-V2-F11-07 + D-V2-08 lockato **NO TTL F11** (defer V2.1).

- Cap **500 entries** Map insertion-order LRU.
- Cache hit ~50 ns target (P-02 mitigation).
- Invalidation events: `microfrontend.unregistered`, `microfrontend.unmounted`, `microfrontend.permissions.updated`.
- `clearCacheByMfId(mfId)` API consumer (typically invocato da lifecycle hooks).

---

## 4. Capability Registry (5 API methods PRD §17.4)

```typescript
const svc = broker.getService('permissions')
svc.registerCapability({ name: 'theme.v1', version: '1.0.0' }, '__app__')
svc.hasCapability('theme.v1', '1.0.0')  // true
svc.hasCapability('theme.v1')           // true (any version)
svc.getCapabilities()                   // readonly CapabilityProvision[]
const result = svc.checkMicroFrontendCapabilities('mf1', descriptorCaps)
// result: { ok, missing, incompatible, optionalMissing, provided, warnings }
```

**F11 string equality only** (D-V2-F11-10). Semver vero defer F12 `@gluezero/compat` con hard dep `semver` 7.8.0.

**Pitfall 6 first-wins**: register stesso `(name, version)` da 2 MF diversi → console.warn una volta + primo MF vince (OQ-6).

---

## 5. Modes `off` | `warn` | `enforce` + per-MF override

D-V2-F11-13/14/15/16:

| Mode | Behavior denied check |
|------|----------------------|
| `'off'` | Skip — no topic, no throw, no warn (debug bypass) |
| `'warn'` (default) | Topic publish + console.warn — NO throw (DX-friendly) |
| `'enforce'` | Topic publish + THROW `PERMISSION_DENIED` (production) |

**Default fail-secure** (D-V2-F11-14): MF senza `descriptor.permissions` in mode `'enforce'` → deny-all.

**Per-MF override `descriptor.capabilities.policy?`** more-strict wins (D-V2-F11-12):

```typescript
mfService.register({
  id: 'sensitive-mf',
  /* ... */
  capabilities: { policy: 'block-mount' },  // override install-time
})
```

---

## 6. Pipeline §28 extension (D-V2-20 BLOCKING — chiusura PRD §47.11)

L'ordine pipeline §28 esteso per eventi MF è:

```
validation → permission check → mapping → route resolve → execute → mapping inverso → consegna → metrics
```

**OQ-1 RESOLUTION**: F11 implementa "step 4.5 / step 11" come **PROPRIETÀ LOGICA della facade chain** (NON F1-level EventTap step).

Architettura:

- `wrapContextWithPermissions(baseCtx, engine)` intercetta `ctx.publish/subscribe` ANTE-azione.
- `engine.enforce({mfId, action, resource})` invocato PRIMA del passthrough a `baseCtx.publish`.
- Ordering implicito: `ctx.publish → enforce (logical step 4.5) → baseCtx.publish → step 5 mapping → ... → step 13 delivery → step 14 metrics`.

Zero diff `packages/core/src/` (D-V2-F11-22 strict triple).

**MF-PIPE-01 cross-fase obligation** (ROADMAP linea 456): ogni fase post-F11 deve preservare l'ordine logico — verifier `pipeline-harness` F1 readonly check.

---

## 7. ⚠️ Modello di sicurezza (P-13 — governance NOT crypto sandbox)

**IMPORTANTE**: `@gluezero/permissions` è un **governance layer**, NON un sandbox crittografico.

In modalità `shared-window` (MF caricati come ES module nello stesso global JS context dell'app shell), un MF malevolo PUÒ aggirare il check via riferimento raw broker:

```typescript
// MF malevolo:
import { broker } from 'gluezero-internal'  // riferimento raw broker
broker.publish('customer.pii.email', stolenData, {
  source: { type: 'plugin', id: 'evil', name: 'evil' },
  deliveryMode: 'sync',
})
// → NON passa via ctx.publish facade → NON viene checked.
```

**Decisione architetturale F11** (SC4 ROADMAP linea 290): `broker.publish` raw v1.x **NON instrumented** — solo `ctx.publish` facade applica check (facade-only enforcement). Vantaggi:

- Preserva backward compatibility 14 API frozen §42 (P-23 mitigation).
- `v1-bc-replay/publish-ordering.test.ts` PASS verifier.
- Plugin v1.x NON impattati.

**Per isolation crittografica vera**, usa:

- `kind: 'iframe'` MF (browser cross-origin enforcement).
- F13 `@gluezero/isolation` (D-V2-13 — F13 milestone) policy `js: 'iframe'` + `network: 'gateway-only'`.

---

## 8. Errors

`PermissionError` (BrokerError category `microfrontend`):

```typescript
{
  code: 'PERMISSION_DENIED' | 'CAPABILITY_MISSING',
  category: 'microfrontend',
  message: string,
  details: { microFrontendId, action, resource, requiredPermission? } |
           { microFrontendId, missing, incompatible, optionalMissing }
}
```

Topics pubblicati (sempre — warn + enforce):

- `permission.denied` (F11 locale)
- `microfrontend.permission.denied` (F8 governance reused — Pitfall 7 ACK)
- `microfrontend.capability.missing` (F8 governance reused)
- `capability.registered` / `capability.unregistered` (F11 locali)
- `microfrontend.permissions.updated` (F11 locale — emesso da `setMicroFrontendPermissions`)

---

## 9. Esempi

Vedi [`examples/microfrontends/mf-permissions-demo.html`](../../examples/microfrontends/mf-permissions-demo.html) per uno scenario E2E con 2 MF (customer-dashboard + analytics-widget) inclusivo di:

- Permission deny-wins on `customer.pii.*` (SC1)
- Capability registry registerCapability + checkCapabilitiesPreMount (SC2)
- LRU cache hit ratio (SC3)
- Facade-only governance NOT crypto sandbox (SC4 + P-13)

---

## 10. Q&A

**Q: Posso disabilitare il check per un singolo MF?**
A: Sì, via `descriptor.capabilities.policy: 'off'` (per-MF override D-V2-F11-12). NON c'è equivalente per `permissionMode` per-MF (anti-pattern P-13 — MF dichiara `mode: 'off'` su sé stesso = governance broken).

**Q: F11 supporta semver in capability version?**
A: No. F11 = string equality only (D-V2-F11-10). Semver vero defer F12 `@gluezero/compat`.

**Q: Cosa succede se 2 MF registrano la stessa capability?**
A: First-wins + console.warn una volta (Pitfall 6 + OQ-6). Per scenari multi-provider strict, defer V2.1.

**Q: Come faccio hard block pre-mount di un MF se capability missing?**
A: Usa `permissionService.checkCapabilitiesPreMount(mfId)` PRIMA di chiamare `mfService.bootstrap(id)`. La policy `block-mount` di F11 è best-effort post-hoc (OQ-2 — F9 NON espone seam pre-fetch).

**Q: Posso aggiungere actions custom oltre i 10 default?**
A: No, le 10 actions sono lockate da D-V2-F11-03. Aggiunte future via D-XX maggiore (V2.x).

**Q: La cache è scoped per broker?**
A: No, F11 cache è module-level singleton (tradeoff bundle 250 B vs scoped 400+ B). 2 broker indipendenti condividono la stessa LRU. Defer V2.1 se community demand.

---

## License

MIT © Omar Di Marzio

---

*Phase 11 — Permissions + Capabilities + Pipeline §28 Extension (v2.0.0-alpha.0). Vedi [PRD §17 + §19](../../prd_2.0.0.md) per il contratto completo.*
