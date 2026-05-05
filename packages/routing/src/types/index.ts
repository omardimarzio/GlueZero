// Barrel type-only del package `@gluezero/routing/types`.
//
// Tutti i type sono `export type *` (no runtime). Pattern identico a
// `packages/mapper/src/types/index.ts` di F2 ma F2 al momento non ha barrel
// dedicato per `types/` (export individuali nel barrel principale). F3 introduce
// questo barrel per aggregare i 4 file di tipo del routing engine.

export type * from './route-definition'
export type * from './route-outcome'
export type * from './route-policies'
export type * from './routing-config'
