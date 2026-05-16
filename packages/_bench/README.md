# @gluezero/_bench

Workspace privato (non publishabile su npm — `"private": true`) che ospita il benchmark suite per il regression gate CI di GlueZero v2.0.

## Scenari

- **Scenario A** — `createBroker({})` + 1000 publish topics misti. Cap regression ≤ 5% vs `baseline-v1.json`.
- **Scenario B** — `createBroker({ modules: [microfrontendModule()] })` + 1000 publish (zero MF attivi). Cap regression ≤ 10% vs `baseline-v1.json`.

Entrambi gli scenari usano `tinybench` 3.x con warmup iterations + 10 samples + t-test built-in per mitigare il rischio P-02 (false negative per noise statistico).

## Uso locale

```bash
pnpm --filter @gluezero/_bench bench
```

Exit code:

- `0` se entrambi gli scenari sono dentro il cap.
- `1` se almeno uno regredisce oltre il cap.

Esecuzione singolo scenario standalone:

```bash
pnpm --filter @gluezero/_bench bench:scenario-a
pnpm --filter @gluezero/_bench bench:scenario-b
```

## CI hard gate

Il workflow `.github/workflows/bench.yml` esegue `pnpm --filter @gluezero/_bench bench` su ogni push/PR verso `main`. Exit 1 → CI fail → PR bloccata.

## Aggiornare il baseline

`baseline-v1.json` è snapshot immutabile della performance v1.x. Aggiornare SOLO con commit message che giustifica esplicitamente:

- Cosa è cambiato (nuova feature, refactor, ecc.).
- Perché il nuovo costo è accettabile.
- Approvazione (single-author = self-approval documentato).

Esempio commit message:

```
perf(bench): re-baseline scenario B after F11 permissions integration

F11 aggiunge permission check sulla pipeline §28 → +6% overhead atteso e
accettabile. Aggiorno baseline da 275000 ns → 291750 ns per evitare false
positive nel CI gate dopo merge.
```

## Riferimenti

- PRD §43 — Performance requirements.
- D-V2-F17-15 — tinybench + CI hard gate.
- P-02 — bench false negative mitigation (`tinybench` t-test + warmup + 10 samples).
- 17-CONTEXT.md — F17 closure milestone GA.
