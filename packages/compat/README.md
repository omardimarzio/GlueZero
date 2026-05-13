# @gluezero/compat

> **Modulo opt-in di compatibilità semver multi-dimensione per MicroFrontend GlueZero v2.0** — 9 dimensioni di version contract (gluezero, canonical models, topics, routes, workers, theme, loaders, framework, dependencies), 5 policy (off / warn / block-registration / block-load / block-mount), bundle ≤ 9 KB gzip incluso `semver` 7.x tree-shaken.

**Stato:** experimental — alpha `v2.0.0-alpha.0`. Non pubblicato su npm fino alla GA v2.0.0 (Phase 17).

![Status: experimental](https://img.shields.io/badge/status-experimental_alpha-orange)
![Bundle](https://img.shields.io/badge/bundle-≤_9_KB_gzipped-blue)
![Tier-1](https://img.shields.io/badge/tests-Tier--1_jsdom-green)
![REQ-IDs](https://img.shields.io/badge/REQ--IDs-5%2F5-success)
![D--83](https://img.shields.io/badge/D--83-strict_triple_v2.0-purple)

ESM-only TypeScript library. Browser evergreen target (ES2022). Espone `compatModule({compatibilityPolicy?})` factory. Tre dipendenze peer: [`@gluezero/core`](../core/README.md) + [`@gluezero/microfrontends`](../microfrontends/README.md) (required), [`@gluezero/theme`](../theme/README.md) (optional). Una dependency hard: `semver` `^7.7.4`.

## Indice

1. [Quick start](#quick-start)
2. [Install](#install)
3. [Le 9 dimensioni di compatibilità](#1-le-9-dimensioni-di-compatibilità)
4. [5 policy: off / warn / block-registration / block-load / block-mount](#2-5-policy)
5. [Version Registry — 8 register*Version API](#3-version-registry)
6. [CompatibilityReport shape](#4-compatibilityreport)
7. [Lifecycle integration](#5-lifecycle-integration)
8. [Bundle gate ≤ 9 KB](#6-bundle-gate)
9. [⚠️ Modello di sicurezza (P-13 + P-14)](#7--modello-di-sicurezza)
10. [Errors](#8-errors)
11. [Ordering F11+F12](#9-ordering-f11f12)
12. [Q&A](#10-qa)

---

## Quick start

```typescript
import { createBroker } from '@gluezero/core'
import { microfrontendModule } from '@gluezero/microfrontends'
import { compatModule } from '@gluezero/compat'

const broker = createBroker({
  modules: [
    microfrontendModule(),
    compatModule({ compatibilityPolicy: 'block-mount' }),
  ],
})

// Host app seed version registry (D-12-06 authoritative source):
const compat = broker.getService('compat')
compat.registerCanonicalModelVersion('customer', '1.2.0')
compat.registerTopicVersion('customer.order.created', '1.0.0')
compat.registerRouteVersion('customer-route', '1.0.0')

// MF descriptor con compatibility dichiarata:
const mfService = broker.getService('microfrontends')
await mfService.register({
  id: 'customer-dashboard',
  name: 'customer-dashboard',
  version: '1.0.0',
  loader: { type: 'esm', url: '/customer-dashboard.js' },
  compatibility: {
    gluezero: '^2.0.0',
    canonicalModels: { customer: '^1.0.0' },
    topics: { 'customer.order.created': '^1.0.0' },
  },
})

await mfService.mount('customer-dashboard') // OK se compat report.ok === true
```

## Install

```bash
pnpm add @gluezero/compat @gluezero/core @gluezero/microfrontends
```

`@gluezero/compat` ha **una hard dep esterna** (prima nella history v2.0): `semver` `^7.7.4` (battle-tested, ~3.5-5 KB gz dopo tree-shake subpath imports).

> **OQ-7 — nessun peer F11**: `@gluezero/compat` è ortogonale a `@gluezero/permissions` (F11). Se entrambi installati, vedi sezione [Ordering F11+F12](#9-ordering-f11f12).

## 1. Le 9 dimensioni di compatibilità

Una MF dichiara `descriptor.compatibility: MicroFrontendCompatibility` (opzionale). 9 dimensioni semver, ognuna con runtime source dedicato:

| # | Dim | Tipo | Runtime source |
|---|-----|------|----------------|
| 1 | `gluezero` | `string` range | Build-time constant `__GLUEZERO_VERSION__` (tsup `define` — OQ-5) |
| 2 | `canonicalModels` | `Record<namespace, range>` | `registerCanonicalModelVersion(ns, ver)` |
| 3 | `topics` | `Record<topic, range>` | `registerTopicVersion(topic, ver)` |
| 4 | `routes` | `Record<routeId, range>` | `registerRouteVersion(routeId, ver)` |
| 5 | `workers` | `Record<workerId, range>` | `registerWorkerVersion(id, ver)` (additive D-12-10) |
| 6 | `theme` | `{tokens?, roles?}` | `registerThemeVersion(kind, ver)` (additive D-12-10, peer optional) |
| 7 | `loaders` | `Record<loaderType, range>` | `registerLoaderVersion(type, ver)` |
| 8 | `framework` | `{name, version?}` | `registerFrameworkVersion(name, ver)` |
| 9 | `dependencies` | `Record<package, range>` | `registerDependencyVersion(pkg, ver)` |

> **OQ-6 — narrowing locale**: la chiave `compatibility?` **NON è aggiunta** al type `MicroFrontendDescriptor` upstream (D-83 strict triple esteso v2.0). Type narrowing locale via `CompatAwareMfDescriptor` (`@gluezero/compat`).

Range semver supportati: exact (`1.0.0`), caret (`^1.2.3`), tilde (`~1.2.3`), range (`>=1.0.0 <2.0.0`), x-range (`1.x`), OR (`^1 || ^2`), prerelease (`-rc.1`).

## 2. 5 policy

Costruttore `compatModule({compatibilityPolicy?})` accetta 5 valori (D-12-02, default `'warn'`):

| Policy | Comportamento | Trigger phase |
|--------|--------------|---------------|
| `off` | Nessun check (no emit, no throw, no compute) | — |
| `warn` (default) | Compute + emit `microfrontend.compatibility.warning`/`.failed`; MAI throw; console.warn su mismatch | tutte |
| `block-registration` | Throw sync su `mf.register(desc)` → MF NON entra in registry | `registration` |
| `block-load` | Throw async su `mf.load(id)` → FSM transition → `failed` phase=`load` | `load` (funzionale F12, OQ-3) |
| `block-mount` | Throw async su `mf.mount(id)` → FSM transition → `failed` phase=`mount` | `mount` |

> **OQ-3 resolution**: in F12 `block-load` è **funzionale** (NON solo alias di `block-mount` come in F11). F8 espone `service.load` patchabile → check è bloccante reale durante `load` phase.

Su OGNI block triggered: emit `microfrontend.compatibility.failed` PRIMA del throw (D-12-05); per `warnings[]` populated o policy=`'warn'`: emit `microfrontend.compatibility.warning`.

## 3. Version Registry

Storage = 8 `Map<string, string>` singleton broker-scoped (D-12-08). 9 setter API totali (5 PRD §20.4 + 4 D-12-10 additive + 1 D-12-10 theme peer-conditional):

```typescript
const compat = broker.getService('compat')

// PRD §20.4 standard 3 (canonical/topic/route):
compat.registerCanonicalModelVersion('customer', '1.2.0')
compat.registerTopicVersion('customer.order.created', '1.0.0')
compat.registerRouteVersion('payment-flow', '2.1.0')

// D-12-10 additive non-breaking 4 (worker/loader/framework/dependency):
compat.registerWorkerVersion('heavy-compute', '1.5.0')
compat.registerLoaderVersion('esm', '2.0.0')
compat.registerFrameworkVersion('react', '19.0.5')
compat.registerDependencyVersion('react-dom', '19.0.5')

// D-12-10 additive (peer-conditional optional @gluezero/theme):
compat.registerThemeVersion('tokens', '1.0.0')
compat.registerThemeVersion('roles', '1.0.0')
```

**Re-register stessa key con valore diverso:** overwrite + emit topic `microfrontend.compatibility.version-changed` (informational, D-12-08), payload `{dimension, key, oldVersion, newVersion, timestamp}`. Invalida automaticamente il memoize cache `Map<mfId, lastReport>`.

**Re-register IDENTICO:** no-op silenzioso (no emit).

> **Note `registerThemeVersion`:** peer optional. Se `@gluezero/theme` NON installato come peer, il setter resta callable ma il consumer tipicamente non lo invoca. F12 NON gating sull'esistenza del peer.

## 4. CompatibilityReport

```typescript
interface CompatibilityReport {
  readonly ok: boolean             // true sse errors.length === 0
  readonly microFrontendId: string
  readonly checkedAt: number        // Date.now() epoch ms (D-12-18)
  readonly errors: readonly CompatibilityIssue[]
  readonly warnings: readonly CompatibilityIssue[]
}

interface CompatibilityIssue {
  readonly type: CompatibilityIssueType  // 9 valori enum
  readonly required?: string
  readonly actual?: string
  readonly message: string
  readonly context?: Readonly<Record<string, unknown>>  // {subKey, name, ...}
}
```

API consumer:

```typescript
compat.checkMicroFrontendCompatibility('mf-id') // compute on-demand + memoize
compat.getCompatibilityReport('mf-id')           // ritorna cached o compute
compat.getCompatibilityReport()                   // no-arg → Map<mfId, Report> (D-12-17)
```

**JSON-serializzabile:** `JSON.stringify(Object.fromEntries(compat.getCompatibilityReport()))` ritorna stringa parseabile (preparazione F16 SnapshotProvider — D-12-20).

## 5. Lifecycle integration

3 trigger point F8 FSM (D-12-01 single check, multi-trigger):

1. **pre-register** — service-wrap `mfService.register()` (OQ-1): check + policy=`block-registration` → throw sync.
2. **pre-load** — service-wrap `mfService.load()`: check + policy=`block-load` → throw async → FSM `failed` phase=`load`.
3. **pre-mount** — service-wrap `mfService.mount()`: check + policy=`block-mount` → throw async → FSM `failed` phase=`mount`.

**Defensive subscribe (OQ-2 dual)** carryover F11: topic `microfrontend.bootstrapped` + `.loaded` per warn telemetry fallback (copre auto-bootstrap inline D-V2-07).

**Memoization** (D-12-12, NO LRU): `Map<mfId, CompatibilityReport>` invalidata totale su `register*Version()` (emit `version-changed` → lifecycle hook → `engine.invalidateReportCache()`).

**Cleanup cascade** (D-V2-16 carryover): subscribe `microfrontend.unregistered` → `engine.deleteReport(mfId)`.

## 6. Bundle gate

`@gluezero/compat` cap ≤ **9 KB gzip** (size-limit gate root). Composizione approssimativa:

- `semver` subpath imports (`functions/satisfies` + `functions/valid`) ≈ 3.5-5 KB gz (CJS→ESM via tsup `noExternal: ['semver']`)
- check-engine + version-registry + policy-dispatch + service-wrap + lifecycle-hooks ≈ 2-3 KB gz
- types + topics + error factory ≈ <1 KB gz

> **OQ-5 — build-time constant**: `__GLUEZERO_VERSION__` injected via tsup `define` option. Default fallback `'2.0.0'`; production CI legge `process.env.GLUEZERO_VERSION` (changesets).

## 7. ⚠️ Modello di sicurezza

### P-13 carryover F11 — Governance NON crypto sandbox

`@gluezero/compat` (come `@gluezero/permissions`) è **governance**, NON sandbox crittografica. Un MF malevolo può sempre dichiarare `compatibility.gluezero: '^999.0.0'` per bypassare il check; il modello presume che i MF siano sviluppati da team trusted entro l'organizzazione. Vendor scenario richiede `@gluezero/isolation` (F13) + iframe loader (F15).

### P-14 mitigation — Version drift

Se l'host NON aggiorna `register*Version()` quando i contract canonical/topic/route cambiano, il compat report devia silenziosamente. Mitigazioni:

1. **Default `'warn'`** (D-12-02): no block-by-default.
2. **Missing version = warning** (D-12-09): adoption progressiva senza esplosioni.
3. **Topic `version-changed`** (D-12-08): host può subscribe per audit log.
4. **Best practice**: ogni release di contract richiede update `register*Version()` PRIMA del rilascio MF consumer. Considerare CI gate "compat-checkup" (deferred V2.1).

### Sicurezza intrinseca

- **ReDoS**: `semver` 7.x ha `RANGE_LENGTH_LIMIT=512` interna; wrapper `semver-checker.ts` try-catch defensive su `new Range(invalidInput)`.
- **Prototype pollution**: `Object.entries(declared)` su descriptor frozen post-register (D-V2-11 F8).
- **PII**: report contiene solo `microFrontendId` + version ranges (no credenziali, no payload utente).

## 8. Errors

`CompatError` è un `BrokerError` con shape:

```typescript
{
  code: 'COMPAT_INCOMPATIBLE' | 'COMPAT_VERSION_INVALID',
  category: 'microfrontend',  // OQ-4 direct-cast — vedi note sotto
  message: string,
  details: {
    microFrontendId: string,
    phase: 'registration' | 'load' | 'mount',
    report: CompatibilityReport,
  }
}
```

> **OQ-4 resolution (AMENDMENT D-12-03)**: `category: 'microfrontend'` (NON `'compatibility'`) — direct-cast carryover F11 D-V2-F11-22 per preservare D-83 strict triple esteso v2.0 (NO extend `ErrorCategory` union upstream). Discriminator semantico: `code` prefix `COMPAT_*` filtra programmaticamente. Pattern consumer: `err.code.startsWith('COMPAT_')`.

## 9. Ordering F11+F12

Quando entrambi `permissionsModule` e `compatModule` sono installati (`modules: [microfrontendModule(), permissionsModule(), compatModule()]`):

- **Mount intersezione**: F11 patches `bootstrap/mount/unmount/destroy`; F12 patches `register/load/mount`. **Intersezione: `mount`**.
- **Install order matters (OQ-2)**: F12 patcha DOPO F11 → F12 wrap = layer ESTERNO. Comportamento su `mf.mount(id)`:
  1. F12 wrap esegue compat check FIRST → if `block-mount` + `report.ok===false` → throw `COMPAT_INCOMPATIBLE` (mount aborted; permission check NEVER reached).
  2. Se F12 OK → F11 wrap → permission check (può throw `PERMISSION_DENIED`).
  3. Se F11 OK → original mount → registry FSM transitions.

**Coerente**: incompatibilità categorica precede permission denial (un MF versione errata non può fare nulla, regardless di permissions).

**Ordering inverso** `[microfrontendModule(), compatModule(), permissionsModule()]`: F11 wrap = layer esterno. Permission check FIRST; se permission deny → throw `PERMISSION_DENIED` (compat NEVER reached). Coverage test SC5 Test 2 verifica entrambi gli ordini.

I 2 marker coesistono: `mfService.__compatServicePatched === true` + `mfService.__permissionsServicePatched === true` (idempotent disjoint).

## 10. Q&A

**Perché italiano nei testi descrittivi?**
Convenzione progetto GlueZero v2.0 (MF-DOC-02 carryover F11): testi descrittivi italiani per chiarezza autori; identificatori, codice, error messages letterali in inglese per portabilità.

**Posso usare `semver` `8.x` quando uscirà?**
Sì, `peerDependencies` `semver: ^7.7.4` non vincola a 7.x. Quando semver 8.x sarà rilasciato (post-2026), package.json potrà essere aggiornato a `^7.7.4 || ^8.0.0`.

**`@gluezero/compat` può funzionare senza `@gluezero/microfrontends`?**
No — install throw chiaro se `microfrontendModule()` non installato PRIMA nei `modules: [...]`.

**`createSnapshotProvider` è accessibile via `import`?**
Non in V2.0 GA (D-12-20). È un `@internal` helper preparato per F16 (`@gluezero/devtools` SnapshotProvider Registry MIN-3). Quando F16 ship, F12 esporrà l'helper o F16 importerà da subpath internal.

**Posso registrare versioni runtime DOPO che MF è già mounted?**
Sì — `register*Version()` emit `version-changed` topic → cache invalida → prossimo `getCompatibilityReport()` ricalcola. La mount NON viene re-checkata automaticamente (non c'è "re-mount on version-change" — è host responsibility valutare se rimontare).

---

**License:** MIT
**Author:** Omar Di Marzio
**Repo:** https://github.com/omardimarzio/GlueZero
