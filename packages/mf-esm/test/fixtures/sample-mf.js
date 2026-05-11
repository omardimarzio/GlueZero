// packages/mf-esm/test/fixtures/sample-mf.js
//
// Fixture privata Tier-3 — D-V2-F9-14 lockato (NON in package.json:files, NON in barrel pubblico).
// Conforming a `MicroFrontendRuntimeModule` interface F8 (5 hook opzionali, `mount` obbligatorio).
//
// Heap marker pattern deterministic per scenario 1 (P-06 mitigation): alternativa robusta a
// `performance.measureUserAgentSpecificMemory()` — meno dipendente da Playwright bug #27499 +
// no requirement COOP+COEP. Test legge `globalThis.__mfEsmFixtureMarker.length` per verificare
// che mount/unmount aggiungano/rimuovano marker (zero-leak post 100 cycle).
//
// Servito da Vite dev server via `publicDir: 'test/fixtures'` (vedi vitest.browser.config.ts).
// URL atteso lato test browser: `/sample-mf.js` (root server) o fallback A/B documentati.

globalThis.__mfEsmFixtureMarker = globalThis.__mfEsmFixtureMarker ?? []

export default {
  async bootstrap(ctx) {
    ctx.logger?.info?.('[sample-mf] bootstrap', { id: ctx.id })
  },
  async mount(ctx) {
    const marker = { id: ctx.id, mountedAt: performance.now() }
    globalThis.__mfEsmFixtureMarker.push(marker)
    ctx.publish?.('sample-mf.mounted', { id: ctx.id })
  },
  async unmount(ctx) {
    const idx = globalThis.__mfEsmFixtureMarker.findIndex((m) => m.id === ctx.id)
    if (idx >= 0) globalThis.__mfEsmFixtureMarker.splice(idx, 1)
  },
  destroy(_ctx) {
    // Cleanup sincrono finale — nessun side-effect aggiuntivo (cascade D-V2-16 già gestito).
  },
}
