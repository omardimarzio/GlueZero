# 01 — Architettura v2.0

GlueZero v2.0 introduce un **MF Layer** opzionale (additive, opt-in) che estende il broker
v1.x con governance dei micro-frontend: loaders dichiarativi, lifecycle FSM 14 stati, permissions,
compatibility semver multi-dimensione, isolation policy, fallback con retry/circuit, devtools
mf-inspector. Tutto è additive: senza moduli installati il broker rimane **bit-exact v1.x**
(vincolo BC §42 preservato).

L'architettura ruota intorno a tre principi:

1. **Backward compatibility duro**: `createBroker({})` produce un broker semanticamente identico a v1.x.
2. **Composizione esterna pura**: gli adapter framework (`@gluezero/react`, `@gluezero/web-components`)
   sono librerie wrap del broker pubblico — non sono moduli installabili in `createBroker({modules:[...]})`.
3. **Pipeline §28 estesa incrementalmente**: la pipeline di 14 step di v1.x viene preservata e le
   funzionalità v2.0 (mapper namespacing, permissions check, isolation injection) si agganciano
   come step opzionali quando i moduli sono presenti.

## Layer overview

```
┌─────────────────────────────────────────────────────┐
│ Host application                                    │
│ - createBroker({ modules: [...] })                  │
│ - registerMicroFrontend(...) × N                    │
└────────────────────────────┬────────────────────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
                ▼                         ▼
┌─────────────────────────────┐ ┌────────────────────────────────┐
│ Adapter framework (opt)     │ │ Loader (opt)                   │
│ - @gluezero/react           │ │ - @gluezero/mf-esm             │
│ - @gluezero/web-components  │ │ - @gluezero/mf-web-component   │
│   (+ /lit subpath)          │ │ - @gluezero/mf-iframe          │
│                             │ │ - @gluezero/mf-module-federation
│                             │ │ - @gluezero/mf-single-spa      │
└─────────────────────────────┘ └────────────────────────────────┘
                                          │
                                          ▼
                              ┌──────────────────────────────┐
                              │ @gluezero/microfrontends (F8)│
                              │ Registry + FSM 14 stati      │
                              │ + 29 standard topics         │
                              │ + 7 MF_ERROR_TOPICS          │
                              └──────────────────────────────┘
                                          │
                                          ▼
                              ┌──────────────────────────────┐
                              │ Governance modules (opt)     │
                              │ - permissions (F11)          │
                              │ - compat (F12)               │
                              │ - isolation (F13)            │
                              │ - context (F10)              │
                              │ - fallbacks (F14)            │
                              │ - devtools/mf-inspector (F16)│
                              └──────────────────────────────┘
                                          │
                                          ▼
                              ┌──────────────────────────────┐
                              │ @gluezero/core broker (F1)   │
                              │ publish / subscribe          │
                              │ + service registry           │
                              │ + EventTap chain D-159       │
                              └──────────────────────────────┘
```

## Vincoli architetturali (PRD §33.2)

Non negoziabili — verificati ad ogni fase con vincoli D-83 (zero modifica `src/` esistenti tra fasi):

1. **Canonical model**: `@gluezero/mapper` fornisce vocabolario canonico per integration multi-MF.
2. **Mapper bidirezionale**: trasformazione locale ↔ canonico ↔ locale (no lossy round-trip).
3. **Broker singolo gateway server**: tutto il traffico verso il server passa per le route del broker.
4. **`fetch` + ≥ 1 canale realtime inbound**: SSE come prioritario, WebSocket come alternativa.
5. **Web Worker support**: `@gluezero/worker` con registry + pool + task tracking.
6. **Debug + introspection**: Event/Mapping/Route Inspector via `@gluezero/devtools`.
7. **Lifecycle preventivo memory leak**: tutti i subscribe/services/route sono auto-unregister
   alla disposal del proprietario (plugin, MF, host).
8. **Routing dichiarativo**: configuration-driven, no callback magic.
9. **Validazione payload minima**: schema-based al ingress dei boundary.

## Composizione esterna pura per gli adapter

`@gluezero/react` e `@gluezero/web-components` (F17) sono **peer-installed wrap** del broker
pubblico API. Non implementano `Module` interface e non si registrano in `createBroker({modules:[...]})`.
Sono librerie che incapsulano l'integration React/WC sul broker già istanziato.

Questo scelta architetturale ha conseguenze importanti:

- **Tree-shaking nativo**: un host che non usa React non importa nulla da `@gluezero/react`.
- **Zero impact su BC §42**: gli adapter non possono perturbare il broker baseline.
- **Versioning indipendente**: gli adapter possono evolvere senza forzare bump del core.

## Adoption levels A/B/C

GlueZero v2.0 supporta tre livelli di adoption (vedi [17 — Migration guide](./17-migration-guide.md)):

- **A** — Zero-change v1.x (`createBroker({})` senza moduli, semantica bit-exact).
- **B** — Opt-in MF basic (microfrontends + 1 loader, no governance avanzata).
- **C** — Production full stack F8-F17 (governance + adapter framework).

## Bundle delta target (PRD §43)

| Configurazione | Bundle gzip | Delta vs v1.x |
|----------------|-------------|---------------|
| Livello A (solo core) | ≤ 8.87 KB | ≤ +350 B (D-V2-21 cap raise documented) |
| Livello B (core + mf + 1 loader) | ~15 KB | n/a (nuovo) |
| Livello C (full governance + react adapter) | ~60-65 KB | n/a (nuovo) |

Dettagli per package: [18 — Performance & Bundle](./18-performance-bundle.md).

## Riferimenti

- [PRD §2 — Architettura](../../prd_2.0.0.md)
- [PRD §33 — Vincoli architetturali](../../prd_2.0.0.md)
- [README @gluezero/core](../../packages/core/README.md)
- [README @gluezero/microfrontends](../../packages/microfrontends/README.md)
- [02 — Core vs MF Layer](./02-core-vs-mf.md)
- [03 — MicroFrontendDescriptor](./03-descriptor.md)
- [04 — Lifecycle FSM](./04-lifecycle.md)
- [17 — Migration guide v1.x → v2.0](./17-migration-guide.md)
