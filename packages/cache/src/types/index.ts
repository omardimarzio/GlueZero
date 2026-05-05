// types/index.ts — barrel types-only F6 Cache layer.
//
// Re-export `import type { ... } from '@gluezero/cache'` per consumer e per i
// plan 06-02..06-08 che importano i types senza dipendere dal runtime
// (memory-cache-adapter, cache-handler, cache-broker). Pattern identico a
// `worker/types/index.ts` di F5.
//
// Riferimento: 06-PATTERNS.md §"types/index.ts" (analog F5 worker pattern map).

export type { CacheAdapter, CacheStats } from './cache-adapter'
export type { CacheConfig } from './cache-config'
export type { CacheEntry } from './cache-entry'
