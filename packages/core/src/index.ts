// @sembridge/core public API surface.
//
// Phase 1 Plan 03 (Wave 2) — espone i tipi pubblici via re-export type-only del barrel
// `./types`. Plan 08 (Wave 4) aggiungerà i runtime export (`createBroker`, `Broker`,
// `createBrokerError`, `ConsoleLogger`, costanti errore, ecc.).
//
// I tipi interni (es. registration record del plugin registry) NON sono ri-esportati
// dal barrel `./types` — restano accessibili solo via path relativo `./types/plugin`.

export type * from './types'
