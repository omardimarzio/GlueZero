// packages/mf-esm/test/fixtures/slow-mf.js
//
// Fixture privata Tier-3 timeout scenario — D-V2-F9-14 extension iter 2 (M-3 plan-checker).
// Top-level `await` blocca la risoluzione di `import()` per 5000 ms — usato per testare
// `timeoutMs: 100` reject con `MF_LOADER_TIMEOUT` (Tier-3 scenario 2).
//
// Servito da Vite dev server come fixture privata. Esclusione npm publish via
// `package.json:files` whitelist `["dist", "README.md", "LICENSE"]`.

await new Promise((r) => setTimeout(r, 5000))
export default {
  mount(_ctx) {
    /* mai raggiunto nel timeout scenario — import() viene cancellato */
  },
}
