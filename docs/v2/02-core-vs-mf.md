# 02 — Core vs MF Layer

`@gluezero/core` è il broker baseline (v1.x preservato bit-exact). Il **MF Layer**
(`@gluezero/microfrontends` + loaders + governance modules) è additive opt-in.
Questo documento aiuta a decidere quando — e quando NON — adottare il MF Layer.

## Quando NON usare il MF Layer

- App **monolitica single-team** con 1 codebase, 1 bundle, 1 deploy.
- Pipeline standard pub/sub senza lifecycle di chunk dinamici.
- Bundle size critical (delta ≤ +350 B per il solo broker baseline — D-V2-21 PASS).
- Progetto v1.x stable senza requisiti nuovi → upgrade Livello A senza modifiche.

In questi casi, `createBroker({})` è sufficiente. Il MF Layer non viene mai caricato.

## Quando usare il MF Layer

- ≥ 2 chunks caricati on-demand (ESM modules, WC custom, iframe sandbox).
- Necessità di **lifecycle governance** (bootstrap/mount/unmount con stati osservabili).
- Necessità di permission/compat/isolation governance tra MF (multi-team).
- Topic boundary contracts tra team (29 standard topics F8 + 7 MF_ERROR_TOPICS).
- Devtools introspection per debug runtime tra MF (`mf-inspector`).

## Adoption levels in sintesi

Tre profili pensati per coprire l'80% degli scenari. Tutti compatibili tra loro (puoi
partire da A e migrare a B/C senza breaking change):

- **A** — `createBroker({})` (v1.x semantics, zero adopt).
- **B** — `createBroker({ modules: [microFrontendModule(), mfEsmModule()] })`
  (lifecycle FSM + 1 loader, no governance avanzata).
- **C** — Full governance stack F8-F17 (permissions, compat, isolation, fallback,
  mf-inspector, adapter framework).

Vedi [17 — Migration guide](./17-migration-guide.md) per snippet code completi per ogni livello.

## Costi e benefici

| Aspetto | Livello A | Livello B | Livello C |
|---------|-----------|-----------|-----------|
| Bundle gzip | ≤ 8.87 KB | ~15 KB | ~60-65 KB |
| Setup complexity | Zero | Bassa | Media |
| Multi-team | No | Limitato | Sì (full) |
| Permission/compat boundary | No | No | Sì |
| Isolation DOM/CSS/JS | No | No | Sì |
| Devtools introspection MF | v1.x base | v1.x base | Sì (mf-inspector) |
| Adapter framework React/WC | n/a | n/a | Sì (F17) |

## Decisioni v2.0 lockate

- **D-V2-21** — Cap baseline core raised a 8.87 KB per accomodare BC additive.
- **D-V2-F17-09** — Adoption levels A/B/C documentati con migration path linear.
- **BC §42** — `createBroker({})` deve produrre broker bit-exact v1.x (14 API public preservate).

## Riferimenti

- [01 — Architettura v2.0](./01-architecture.md)
- [17 — Migration guide v1.x → v2.0](./17-migration-guide.md)
- [18 — Performance & Bundle](./18-performance-bundle.md)
- [README @gluezero/core](../../packages/core/README.md)
- [README @gluezero/microfrontends](../../packages/microfrontends/README.md)
