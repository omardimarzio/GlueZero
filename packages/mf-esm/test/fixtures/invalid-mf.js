// packages/mf-esm/test/fixtures/invalid-mf.js
//
// Fixture privata Tier-3 invalid module scenario — D-V2-F9-14 extension iter 2 (M-3 plan-checker).
// Export senza mount/lifecycle hooks — testa Strategy 4 fallthrough D-V2-F9-05 con throw
// `MF_LOADER_INVALID_MODULE` (Tier-3 scenario 2b).
//
// Servito da Vite dev server come fixture privata. Esclusione npm publish via
// `package.json:files` whitelist.

export const foo = 'bar'
