# @sembridge/mapper

Canonical model + mapper bidirezionale per SemBridge (Phase 2).

> Pacchetto della famiglia [`@sembridge`](https://github.com/<TBD>/sembridge) — V1, ESM-only, target browser evergreen (ES2022).

## Stato

Phase 2 in sviluppo. La superficie pubblica del package viene popolata progressivamente dai plan 02-02 → 02-12. Vedi `.planning/phases/02-canonical-model-mapper/` per il piano dettagliato.

## Cosa contiene (a regime — fine F2)

- **Canonical Vocabulary Registry** — campi canonici tipizzati, alias riconosciuti, schema versioning (`requires`).
- **Mapper bidirezionale** — pipeline pre-compilata locale → canonico (input) e canonico → consumer (output) per ogni plugin sottoscritto.
- **Transform Pipeline** — rename, nested, default, format transform, unit normalization, derive (`$derive`), partial mapping; `registerTransform(name, fn)` per trasformazioni custom.
- **Mapping Inspector** — estensione di `EventTap` ai 5 nuovi step della pipeline §28 (step 4, 5, 6, 11, 12).
- **Validation adapter** — Valibot 1.x default; adapter pluggable (Zod/Ajv deferred a V2).

## Vincolo architetturale (D-49)

Il package `@sembridge/mapper` NON modifica `bus.ts` di `@sembridge/core` (Phase 1). La pipeline è estesa via composition wrapper + TS declaration merging del `PipelineStep` union. Vedi `02-CONTEXT.md` per il dettaglio.

## Documentazione

La documentazione utente completa (DOC-03 — REQ ROADMAP F2) è prodotta nel plan finale 02-12 con scenario meteo PRD §29 end-to-end senza HTTP.

## Licenza

MIT.
