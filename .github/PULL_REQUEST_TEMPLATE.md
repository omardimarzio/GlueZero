<!-- Grazie per il tuo contributo a GlueZero. Compila la checklist sotto. -->

## Cosa cambia

<!-- Descrivi in 1-3 frasi cosa fa questa PR e perché. -->

## Riferimenti

- PRD section: `prd.md` § <!-- es. §17.8 -->
- DECISIONS: <!-- es. D-72, D-83 -->
- REQ-ID: <!-- es. ROUTE-09 -->
- Issue: <!-- es. closes #123 -->

## Tipo di cambiamento

- [ ] Bug fix (non-breaking)
- [ ] Nuova feature (non-breaking)
- [ ] Breaking change (vedi sotto)
- [ ] Documentazione / chore / test

## Checklist

- [ ] Ho letto [`CONTRIBUTING.md`](../CONTRIBUTING.md) e [`CLAUDE.md`](../CLAUDE.md)
- [ ] Ho consultato [`DECISIONS.md`](../DECISIONS.md); se la PR contraddice una decisione esistente, ho citato quale e perché
- [ ] D-83 strict carryover preservato: nessuna modifica a `packages/{core,mapper}/src/` da pacchetti F3+
- [ ] `pnpm typecheck` pass su tutti gli 8 package
- [ ] `pnpm test` pass (zero regressioni; nuovi test dove serve)
- [ ] `pnpm build` pass (8/8 con dts)
- [ ] `pnpm lint` pass (Biome zero errori)
- [ ] Cascade `unregisterPlugin` (LIFE-02) coperta se la PR aggiunge stato plugin-scoped
- [ ] `pnpm changeset` generato per cambiamenti user-facing (major/minor/patch)
- [ ] JSDoc TypeDoc-ready su API pubbliche aggiunte (`@example`, `@see`, `@throws`)
- [ ] README di package aggiornato (italiano) se la API pubblica cambia

## Breaking change (solo se applicabile)

<!-- Spiega cosa rompe, chi è impattato, e suggerisci il path di migrazione. -->

## Note per il reviewer

<!-- Aspetti che vuoi siano controllati con particolare attenzione, alternative considerate, ecc. -->
