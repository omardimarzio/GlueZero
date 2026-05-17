# 07 — Context

`@gluezero/context` (F10) è il modulo opt-in che fornisce **RuntimeContext** — un container
reattivo per propagazione delle 11 chiavi standard PRD §18.4 (user, locale, theme, feature
flags, ecc.) con **selector subscribe granulare** + integrazione canonical mapper F2 per
namespace scoping per-MF.

## Quick start

```typescript
import { createBroker } from '@gluezero/core';
import { microFrontendModule } from '@gluezero/microfrontends';
import { contextModule } from '@gluezero/context';

const broker = createBroker({
  modules: [microFrontendModule(), contextModule()],
});

// Set di una chiave standard
broker.getService('context').set('locale', 'it-IT');

// Subscribe granulare (only triggered when 'locale' changes)
const unsubscribe = broker.getService('context').subscribe(
  (ctx) => ctx.locale,
  (locale) => console.log('Locale changed:', locale),
);
```

## API reference

Documentazione API completa: vedi [@gluezero/context](../../packages/context/README.md).

## 11 chiavi standard PRD §18.4

| Chiave | Tipo | Esempio | Scopo |
|--------|------|---------|-------|
| `user` | `User \| null` | `{id, name, roles}` | Identità utente loggato |
| `session` | `Session \| null` | `{token, expires}` | Sessione attiva |
| `locale` | `string` | `'it-IT'` | Locale corrente |
| `timezone` | `string` | `'Europe/Rome'` | Timezone IANA |
| `theme` | `'light' \| 'dark' \| string` | `'dark'` | Theme attivo |
| `featureFlags` | `Record<string, boolean>` | `{newCart: true}` | Feature flags resolved |
| `permissions` | `string[]` | `['cart.write']` | Permission grants utente |
| `tenant` | `Tenant \| null` | `{id, name}` | Tenant multi-tenant SaaS |
| `device` | `Device` | `{type: 'mobile'}` | Device info |
| `connectivity` | `'online' \| 'offline' \| 'slow'` | `'online'` | Network state |
| `app` | `AppInfo` | `{version, build}` | App metadata |

## Selector subscribe granulare

Il subscribe accetta un selector function. Il listener è chiamato **solo se** il selector
returna un valore diverso (shallow equality default; deep equality opt-in):

```typescript
// Subscribe solo a cambi di user.name
contextService.subscribe(
  (ctx) => ctx.user?.name,
  (name) => updateGreeting(name),
);

// Subscribe a cambi di permissions (deep equality necessaria per array)
contextService.subscribe(
  (ctx) => ctx.permissions,
  (perms) => updateUI(perms),
  { equalityFn: 'deep' },
);
```

## Integrazione MF namespace scoping

Quando un MF è registrato, `context` espone automaticamente:

- `mfContext.runtime.context` — accesso read-only al RuntimeContext globale.
- `mfContext.runtime.context.scoped(mfId)` — namespace scoped per chiavi custom MF (e.g.
  `'mf:cart.session'`).

Il mapper F2 garantisce che le chiavi scoped non collidano tra MF.

## Decisioni v2.0 lockate

- **D-V2-F10-01** — 11 chiavi standard come union finita (locked, no extension custom in V2.0).
- **D-V2-F10-02** — Selector subscribe granulare con shallow equality default + deep opt-in.
- **D-V2-F10-03** — Mapper F2 integration per namespace scoping per-MF.

## Riferimenti

- [PRD §18.4 — RuntimeContext keys](../../prd_2.0.0.md)
- [README @gluezero/context](../../packages/context/README.md)
- [03 — Descriptor](./03-descriptor.md)
- [README @gluezero/mapper](../../packages/mapper/README.md)
