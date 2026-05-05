---
quick_id: 260505-v1e
slug: rinomina-sembridge-to-gluezero
created: 2026-05-05
status: pending
purpose: Checklist per la nuova sessione Claude Code post-mv root directory
---

# Post-rename checklist — riapertura Claude Code

> **Quando leggere questo file:** alla prima sessione Claude Code dopo il `mv` della root directory `SemBridge` → `GlueZero`. Il boot protocol di CLAUDE.md punta a `TRACKER.md`, e TRACKER.md rimanda qui.

## Stato attuale (al momento della scrittura, 2026-05-05)

- ✅ Quick task `260505-v1e` (rename) completato: 9 commit atomic, CI gates 8/8 verdi.
- ✅ Milestone v1.0 chiusa (verifier PASS commit `50fa102`).
- ✅ Scope npm aggiornato a `@gluezero/*` su 8 package (NON ancora pubblicato).
- ⏳ Root directory ancora `/Users/omarmarzio/programming/prova AI/SemBridge` (utente la rinominerà a `GlueZero` chiudendo la sessione).
- ⏳ `pnpm release` mai eseguito.

## Passi da eseguire alla nuova sessione

### Fase A — verifica integrità post-mv

- [ ] `pwd` deve restituire `/Users/omarmarzio/programming/prova AI/GlueZero`.
- [ ] `git status` pulito (no diff inattesi dopo `mv`).
- [ ] `pnpm install` (riallinea symlink workspace + node_modules che dipendono dai path assoluti).
- [ ] `pnpm typecheck && pnpm test` smoke check rapido — devono restare verdi (1165 passed + 3 skip MSW V1.x F4 atteso).

### Fase B — pre-release tecnici (oltre al rename già fatto)

- [ ] **npm scope reservation:** crea l'organization `gluezero` su https://www.npmjs.com/org/create. Senza questa step `pnpm release` fallisce con 403. Verifica che l'utente npm corrente abbia diritti pubblicazione sullo scope.
- [ ] **2FA / token publish:** se il tuo account npm ha 2FA, genera un `automation token` granulare per `@gluezero/*` (Settings → Access Tokens → Granular). Salva in `~/.npmrc` o env CI.
- [ ] **Smoke install tarball locale:** `pnpm pack` su `packages/gluezero` → installa in un progetto throwaway → testa `import { createGlueZero } from '@gluezero/gluezero'` end-to-end. Costo ~5 minuti, evita publish rotto.
- [ ] **Repo GitHub:** rinomina `omardimarzio/SemBridge` → `omardimarzio/GlueZero` su GitHub (UI o `gh repo rename`). GitHub redirige le URL vecchie automaticamente. Poi:
  - [ ] `git remote set-url origin <new-URL>`
  - [ ] Verifica `repository`/`homepage`/`bugs.url` negli 8 `package.json` (sono già stati aggiornati nel rename, ma double-check con `git grep "SemBridge\\|sembridge" -- 'package.json' '**/package.json'`).
- [ ] **Dominio gluezero:** registralo prima del publish per evitare squatting — anche solo un placeholder.
- [ ] **README root:** verifica `README.md` root descriva GlueZero in italiano con esempio `createGlueZero` minimo + link agli 8 package.

### Fase C — release v1.0.0 effettiva

```bash
pnpm install
pnpm changeset version        # consuma .changeset/v1-0-0-release.md → bump 0.0.0 → 1.0.0
# Verifica MANUALE: i bump devono essere 1.0.0 su TUTTI gli 8 package.json prima di proseguire
git add . && git commit -m "chore(release): v1.0.0"
pnpm release                  # changeset publish + git tag v1.0.0
git push --follow-tags origin main
```

- [ ] Verifica post-publish: `npm view @gluezero/gluezero version` deve restituire `1.0.0`.
- [ ] Stessa verifica per gli altri 7 package: core, mapper, routing, gateway, worker, cache, devtools.

### Fase D — post-release / opzionali

- [ ] **GitHub Release:** `gh release create v1.0.0 --generate-notes` con sintesi 6 fasi (prosa da `.changeset/v1-0-0-release.md`).
- [ ] **TypeDoc → docs site:** stack include già `typedoc + typedoc-plugin-markdown`. Servirebbe workflow GitHub Pages (~30 min setup).
- [ ] **gsd-verifier finale post-release:** `/gsd-verifier 6` per confermare milestone coerente post-publish.
- [ ] **Annuncio:** Twitter/Mastodon/Reddit r/javascript se applicabile.

## File chiave da consultare

- `prd.md` — fonte autoritativa
- `CLAUDE.md` — vincoli operativi (lingua italiano, modello opus, boundary)
- `.planning/TRACKER.md` — stato sessione corrente
- `.planning/STATE.md` — stato GSD (sezione "Quick Tasks Completed")
- `.planning/quick/260505-v1e-rinomina-sembridge-to-gluezero/260505-v1e-SUMMARY.md` — sintesi completa del rename già fatto
- `.changeset/v1-0-0-release.md` — entry CHANGELOG v1.0.0 con scope `@gluezero/*`
- `packages/gluezero/EXAMPLES.md` — chain completa F1+F2+F3+F4+F5+F6

## Note manuali (non script-eseguibili)

Le seguenti operazioni l'utente le fa esternamente al repo (NON dentro Claude Code):

1. `mv` root directory (già documentato in SUMMARY).
2. `cp -r ~/.claude/projects/-Users-omarmarzio-programming-prova-AI-SemBridge/memory ~/.claude/projects/-Users-omarmarzio-programming-prova-AI-GlueZero/memory` per copiare la auto-memory GSD-Claude alla nuova path.
3. `rm -rf graphify-out && /graphify .` per rigenerare il knowledge graph alla nuova path (vecchio artefatto referenzia path SemBridge).
