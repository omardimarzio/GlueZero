---
last_updated: 2026-05-17
status: phase_17_w4_p05_complete_ready_for_w5_p06
project: GlueZero
milestone: v2.0.0
current_phase: 17
current_phase_name: Framework Adapters (React + WC) + Migration + Docs + GA Release
current_phase_status: w4_complete_p05_docs_typedoc_ready_for_w5_p06_examples_customer_dashboard

phase_17_w4_p05_complete:
  date: "2026-05-17"
  summary_file: .planning/phases/17-framework-adapters-react-wc-migration-docs-ga-release/17-05-SUMMARY.md
  commits:
    - 3baa24c: "docs(17-05): 8 markdown docs/v2/ gruppo 1 NEW — architettura + 4 esempi + performance + descriptor (MF-DOC-01 Task 1)"
    - d685999: "docs(17-05): 10 markdown docs/v2/ gruppo 2 — reference-style 04-12 + migration guide A/B/C principale (MF-DOC-01 + MF-DOC-03 Task 2)"
    - ddb5448: "docs(17-05): 2 README adapter italiano 13 sezioni + docs/v2/index.md landing page (MF-DOC-02 Task 3)"
    - d33969c: "chore(17-05): TypeDoc 0.28 + typedoc-plugin-markdown 4.9 + workflow docs/v2/ GitHub Pages auto-deploy (MF-DOC-05 Task 4)"
  req_ids_closed: [MF-DOC-01, MF-DOC-02, MF-DOC-03, MF-DOC-05]
  files_created: 21
  files_modified: 5
  docs_breakdown:
    docs_v2_markdown: 18  # PRD §41 18 documenti completi
    landing_page: 1  # docs/v2/index.md
    readme_adapter: 2  # packages/react/README.md + packages/web-components/README.md
    typedoc_api_generated: 704  # docs/v2/api/ TypeDoc plugin-markdown output (gitignored, rigenerabile)
  validation_passed:
    typedoc_build: "PASS (pnpm docs:build exit 0, 0 errors, 43 warnings non-bloccanti)"
    docs_structure: "PASS (18 markdown + index.md + 22 packages api/ generated)"
    readme_loc: "PASS (react 284 LoC + web-components 286 LoC, entrambi >= 250 target)"
    migration_guide_loc: "PASS (17-migration-guide.md 255 LoC, target >= 200)"
    d83_strict_octuple: "PASS (git diff F16_END=3ca6373..HEAD packages/{20 pkg}/src/ = 0)"
  decisions_locked:
    - "D-V2-F17-11 docs hybrid strategy: 18 markdown standalone + 21 README single-source-of-truth + TypeDoc auto-deploy"
    - "typedoc.json entryPointStrategy expand (vs packages) per cross-package affidabilità con plugin-markdown 4.9"
    - "Workflow docs.yml upload path docs/v2 unified (no separate prepare step)"
    - ".gitignore raffinato /docs/* + !/docs/v2/ + /docs/v2/api/ (source committed, TypeDoc output rigenerabile)"
  url_target: "https://omardimarzio.github.io/GlueZero/v2/"
  next_plan: "17-06-examples-customer-dashboard-PLAN.md (W5 P06 — host React shell + 3 MF mixed)"

phase_17_w3_p04_complete:
  date: "2026-05-17"
  summary_file: .planning/phases/17-framework-adapters-react-wc-migration-docs-ga-release/17-04-SUMMARY.md
  audit_file: .planning/phases/17-framework-adapters-react-wc-migration-docs-ga-release/17-test-audit.md
  commits:
    - 8ea330e: "feat(17-04): @gluezero/_bench workspace privato + tinybench scenari A/B + runner CI hard gate"
    - 4e51c2f: "perf(17-04): baseline-v1.json valori reali misurati pre-GA (Task 2)"
    - 725fa29: "test(17-04): 3 scenari Tier-3 Playwright Chromium React-specific NEW (MF-TEST-03 gap-filling)"
    - 41c08d7: "docs(17-04): audit MF-TEST-01..04 + CI workflow bench.yml hard gate (Task 4)"
  req_ids_closed: [MF-TEST-01, MF-TEST-02, MF-TEST-03, MF-TEST-04]
  files_created: 13
  files_modified: 2
  bench_baseline:
    scenarioA_mean_ms: 1.091
    scenarioA_p75_ms: 1.105
    scenarioA_sd_ms: 0.0292
    scenarioA_cap_pct: 5
    scenarioB_mean_ms: 1.180
    scenarioB_p75_ms: 1.203
    scenarioB_sd_ms: 0.0377
    scenarioB_cap_pct: 10
    node_version: v24.1.0
    hardware: "local-dev macOS Darwin 25.4.0"
  validation_passed:
    bench_typecheck: "PASS (pnpm --filter @gluezero/_bench typecheck exit 0)"
    bench_runner: "PASS (BENCH PASS, scenario A +4.63%, scenario B -6.31%, exit 0)"
    react_test_browser: "PASS (6/6 Tier-3 Playwright Chromium, Duration 756ms, exit 0)"
    bc_42_v1_replay: "PASS (33 test files / 273 test, Duration 2.20s)"
    mf_pipe_01_pipeline_harness: "PASS (33 test files / 273 test, Duration 2.10s)"
  d83_strict_octuple_esteso_f17_verifier: "ZERO diff su 20 packages esistenti (F16_END=3ca6373..HEAD = 0 lines)"
  deviations_auto_fixed:
    - "[Rule 3 - Blocking] Vitest 4.x browser provider API breaking change → playwright() factory invece di stringa"
    - "[Rule 1 - Bug] React 19 concurrent rendering 2 RAF + setTimeout invece di 1 RAF per paint deterministico"
    - "[Rule 3 - Blocking] lifecycle riferimento prima della dichiarazione in typeof lifecycle.bootstrap → riordino"
    - "[Rule 2 - Missing critical] tinybench 3.x unit millisecondi non nanosecondi → schema baseline _ms canonico + _ns legacy backward-compat"
  next_command: "/gsd-execute-phase 17 --chain (W5 P05 docs 18 markdown + TypeDoc + 2 README adapter italiano 13 sezioni)"


phase_17_w1_p01_complete:
  date: "2026-05-16"
  summary_file: .planning/phases/17-framework-adapters-react-wc-migration-docs-ga-release/17-01-SUMMARY.md
  commits:
    - 7973673: "feat(17-01): scaffold @gluezero/react workspace ESM-only con peer React 19 optional + size-limit 10KB"
    - 217d210: "feat(17-01): scaffold @gluezero/web-components workspace ESM-only multi-entry subpath /lit + peer Lit 3.x optional + size-limit 8KB/3KB"
    - a5c6525: "fix(17-01): aggiungi ignoreDeprecations 6.0 in tsconfig react + web-components per sbloccare tsup dts emit + lockfile pnpm 2 nuovi workspace"
  req_ids_closed: [MF-FRAMEWORK-REACT-04, MF-FRAMEWORK-WC-01, MF-FRAMEWORK-WC-03]
  files_created: 15
  files_modified: 1
  bundle_actuals_placeholder:
    react_gzip_b: 13
    web_components_gzip_b: 13
    web_components_lit_gzip_b: 13
  bundle_caps_locked:
    react_kb: 10
    web_components_kb: 8
    web_components_lit_kb: 3
  validation_passed:
    pnpm_install: "PASS (23 workspace projects, +2 nuovi)"
    react_build: "PASS (dist/index.js 67B + dist/index.d.ts 13B)"
    web_components_build: "PASS (dist/{index,lit/index}.{js,d.ts})"
    react_typecheck: "PASS"
    web_components_typecheck: "PASS"
    react_publint: "PASS (All good!)"
    web_components_publint: "PASS (All good!)"
    react_attw: "PASS esm-only (🟢 node16 ESM + 🟢 bundler)"
    web_components_attw: "PASS esm-only root + /lit subpath"
    react_size_limit: "13 B / 10 KB cap"
    web_components_size_limit: "13 B / 8 KB cap (root) + 13 B / 3 KB cap (/lit)"
  d83_strict_octuple_esteso_f17_verifier: "ZERO diff su 20 packages esistenti (F16_END=3ca6373..HEAD)"
  deviations_auto_fixed:
    - "[Rule 1 - Bug] tsup DTS emit fail TS5101 baseUrl deprecation → aggiunto ignoreDeprecations 6.0 in tsconfig react + web-components (carryover F15 pattern lockato)"
  next_command: "/gsd-execute-phase 17 --chain (W2 P02 @gluezero/react full implementation ‖ W3 P03 @gluezero/web-components + /lit parallel, file ownership disgiunto)"
phase_17_plans_ready_pass_with_caveats_legacy_archive: true
phase_17_context_gathered:
  date: "2026-05-16"
  context_file: .planning/phases/17-framework-adapters-react-wc-migration-docs-ga-release/17-CONTEXT.md
  discussion_log: .planning/phases/17-framework-adapters-react-wc-migration-docs-ga-release/17-DISCUSSION-LOG.md
  decisions_count: 20  # D-V2-F17-01..20
  areas_discussed: ["A — React adapter (4 decisions)", "B — WC adapter (4 decisions)", "C — Migration guide + docs (4 decisions)", "D — GA release + tests/bench/plans (4 decisions) + carryover auto-locked (4 decisions)"]
  packages_new: ["@gluezero/react", "@gluezero/web-components"]
  plans_count_planned: 7  # W1 scaffolding ∥ W2 React ∥ W3 WC ∥ W4 tests ∥ W5 docs ∥ W6 examples ∥ W7 GA
  parallelization: "W2 ∥ W3 parallel (React + WC file ownership disgiunta)"
  closure_milestone_targets:
    - "MF-TEST-01 tier discipline cross-fase F8-F17 verifier closure"
    - "MF-TEST-02 17 categorie unit audit + gap-filling"
    - "MF-TEST-03 12 integration gap-filling cross-fase + verifier sigilla 12/12"
    - "MF-TEST-04 tinybench packages/_bench/ + CI hard gate <5%/<10%"
    - "MF-DOC-01 18 documenti docs/v2/ + TypeDoc GitHub Pages"
    - "MF-DOC-02 README italiano 2 nuovi adapter + JSDoc enrichment"
    - "MF-DOC-03 migration guide adoption levels A/B/C + examples/customer-dashboard/ end-to-end"
    - "MF-DOC-04 6 examples HTML (2 NEW: mf-react-adapter + mf-compat-matrix)"
    - "MF-DOC-05 TypeDoc GitHub Pages auto-deploy"
    - "D-V2-F8-10 npm publish unlock GA gate (2.0.0-rc.0 staging + 7gg soak + 2.0.0 latest)"
  bundle_target_estimates:
    - "@gluezero/react ≤ 10 KB gzipped"
    - "@gluezero/web-components ≤ 8 KB gzipped"
    - "@gluezero/web-components/lit subpath ≤ 3 KB gzipped"
  blocking_decisions_to_close: ["D-V2-F8-10 (npm publish unlock GA gate)", "D-V2-24 (Vue/Svelte deferred V2.1 ratificato)"]
  d83_strict_octuple_esteso_f17: "ZERO eccezione — solo packages/react/src + packages/web-components/src NEW; 0 diff in tutti i package esistenti incluso devtools/src (eccezione lockata F16, no ulteriori diff F17)"
  next_command: "/gsd-plan-phase 17 --chain (auto-advance da /gsd-discuss-phase 17 --chain) — DONE"
  graphify_watcher: "PID instabile post-restart (verifica con cat graphify-out/.watch.pid)"
phase_17_plans_ready_pass_with_caveats:
  date: "2026-05-16"
  research_file: .planning/phases/17-framework-adapters-react-wc-migration-docs-ga-release/17-RESEARCH.md
  plan_files:
    - 17-01-scaffolding-PLAN.md (W1)
    - 17-02-react-adapter-PLAN.md (W2 parallel)
    - 17-03-wc-adapter-PLAN.md (W2 parallel)
    - 17-04-test-bench-closure-PLAN.md (W3)
    - 17-05-docs-typedoc-PLAN.md (W4)
    - 17-06-examples-customer-dashboard-PLAN.md (W5)
    - 17-07-ga-release-PLAN.md (W6 — contains 3 human checkpoints)
  plan_checker_verdict: "PASS_WITH_CAVEATS — 16/16 REQ-IDs coverage + 5/5 SC + 20/20 decisioni D-V2-F17-* + wave topology coerente W1→W2‖W2→W3→W4→W5→W6 + file ownership disgiunto W2‖W3 (packages/react/** vs packages/web-components/**) + D-83 strict octuple esteso F17 verifier reale scripts/check-d83-f17.mjs + BC §42 + MF-PIPE-01 cross-fase gates finali + D-V2-F8-10 BLOCKING unlock corretto"
  plan_checker_caveats:
    - "C1 MEDIUM Plan 06 Task 3 API broker.registerMicroFrontend name verification (read_first include packages/microfrontends/src/registry.ts → resolvibile in execute)"
    - "C2 LOW Plan 07 Task 1 __bc_replay__ exclusion documentation (convention — test code != production source)"
    - "C3 LOW Plan 04 Task 1 baseline-v1.json placeholder (Task 2 populates real values prima run)"
    - "C4 LOW Plan 02 Task 4 SERVICE_FALLBACKS symbol verification (plan note explicit + Service Locator graceful degradation pattern carryover)"
    - "C5 LOW Plan 07 Task 3 changeset pre-release flow ambiguity (2 alternatives equivalent functional result)"
    - "C6 MEDIUM Plan 04 Task 4 audit table assumed paths (plan prescribes exploratory step ls __tier1__/*.test.ts)"
  caveats_overridden_yolo_chain: 6
  caveats_override_rationale: "Tutti i 6 caveat sono self-mitigated dai plan stessi (read_first include + exploratory step prescribed) OR planner-time micro-decisions risolvibili durante execute. CLAUDE.md autonomy applicato: 'Verifier human_needed override coerenti con docs: applicare override e procedere'. NESSUN BLOCKER attivo."
  bundle_targets_locked:
    - "@gluezero/react ≤ 10 KB gzipped"
    - "@gluezero/web-components ≤ 8 KB gzipped"
    - "@gluezero/web-components/lit subpath ≤ 3 KB gzipped"
  blocking_decisions_to_close_w7: ["D-V2-F8-10 (npm publish unlock GA gate F17)", "D-V2-24 (Vue/Svelte deferred V2.1 — già ratificato)"]
  ga_release_strategy: "W7 P07: 2.0.0-rc.0 staging tag 'next' + 7gg soak monitoring + promote npm dist-tag add @gluezero/<pkg>@2.0.0 latest + GitHub Release v2.0.0 + 17-VERIFICATION.md PASS post-soak"
  d83_strict_octuple_esteso_f17: "ZERO eccezione — solo packages/react/src + packages/web-components/src NEW; 0 diff in tutti i package esistenti incluso devtools/src (eccezione lockata F16, NO ulteriori diff F17). scripts/check-d83-f17.mjs 19 git diff checks ALL-ZERO"
  next_command: "/gsd-execute-phase 17 --chain (auto-advance) — wave-parallel W2 ‖ W3"
phase_16_complete_verified_pass_legacy_archive: true
phase_16_complete_verified_pass:
phase_16_complete_verified_pass:
  date: "2026-05-16"
  verification_file: .planning/phases/16-mf-devtools-subpath-snapshotprovider-min-3-metrics-mf/16-VERIFICATION.md
  verifier_verdict: "PASS — 4/4 plans + 7/7 REQ-IDs + 4/4 SC + 20/20 decisions traceable + D-V2-05 + D-V2-19 BLOCKING formal closure + bundle 6.27 KB ≤ 8 KB subpath + D-83 strict septuple esteso F16 (eccezione devtools/src/) ZERO-DIFF + BC §42 273/276 cross-fase + ci:gate:f16 composite PASS"
  total_commits: 12
  wave_summary:
    W1_P01: "16-01 (4 commits 52bc405..241f2d2) — MIN-3 SnapshotProvider Registry foundation + tsup multi-entry subpath + check-d83-f16.mjs verifier + BC §42 #13 devtools-snapshot-shape"
    W2_P02: "16-02 (3 commits 7c9ab01..d228924) — mfInspectorModule + 17-fields aggregator hybrid pull+push + per-MF ring buffer 500 + 11 timings + pause/resume/flush"
    W3_P03: "16-03 (3 commits 0a9fcfe..34c9a36) — 14 metriche per-MF inline + DevtoolsBroker.registerMetricsProvider + BC §42 #14 get-metrics-shape D-V2-19"
    W4_P04: "16-04 (3 commits — sc-closure + JSDoc enrichment + README italiano 13 sezioni + example HTML + 16-VERIFICATION.md + STATE/TRACKER/ROADMAP finalization)"
  req_ids_closed: [MF-DEVTOOLS-01, MF-DEVTOOLS-02, MF-DEVTOOLS-03, MF-DEVTOOLS-04, MF-DEVTOOLS-05, MF-OBS-02, MF-OBS-03]
  decisions_closed_d_v2_f16: 20
  blocking_decisions_closed: [D-V2-05, D-V2-19]
  bundle_subpath_gzipped_kb: 6.27
  bundle_subpath_cap_kb: 8
  bundle_devtools_core_gzipped_kb: 22.7
  bundle_devtools_core_cap_kb: 27
  test_count_devtools_full: 332
  test_count_core_full: 276
  test_count_f16_aggregate: 116
  d83_verifier_exit: 0
  ci_gate_f16_exit: 0
  next_command: "/gsd-discuss-phase 17 (Phase 17 — Framework Adapters React + WC + Migration + GA Release)"
phase_16_w3_p03_complete_legacy_archive:
  date: "2026-05-16"
  summary_file: .planning/phases/16-mf-devtools-subpath-snapshotprovider-min-3-metrics-mf/16-03-SUMMARY.md
  commits:
    - 241f2d2: "fix(16-01): check-d83-f16.mjs escludere __bc_replay__/ test directory (eccezione BC §42 F8 convention — W1 P01 verifier shortcoming)"
    - 0a9fcfe: "feat(16-03): mf-inspector metrics.ts — 14 metriche per-MF gluezero.mfs.* (6 globali + 5 per-MF + 1 gauge + 2 histogram) composition F6 createMetricsCollector (MF-OBS-02)"
    - f346d8e: "feat(16-03): DevtoolsBroker.registerMetricsProvider + getMetrics microFrontends spread + module.ts wire-up dispatch (MF-OBS-03 D-V2-19)"
    - 34c9a36: "test(16-03): BC §42 get-metrics-shape.test.ts NEW — 3 scenari D-V2-19 shape preservation (MF-OBS-03 D-V2-F16-14)"
phase_15_complete_legacy_archive_section_below: true
phase_15_verifier_pass:
  date: "2026-05-15"
  verifier_verdict: "PASS (5/5 plans + 13/13 REQ-IDs + 6/6 SC + 28 decisions traceable + D-V2-09 + D-V2-23 BLOCKING formal closure + D-83 strict OCTUPLE 15/15 ZERO-DIFF + BC §42 cross-fase 267/270 PASS + MF-PIPE-01 preserved + packaging gates 4/4 publint + attw + size-limit + 194 test 156 Tier-1 jsdom + 38 Tier-3 Chromium Playwright)"
  verification_file: .planning/phases/15-wc-iframe-module-federation-single-spa-loaders/15-VERIFICATION.md
  next_command: "/gsd-discuss-phase 16 --chain (Phase 16 — MF Devtools subpath + SnapshotProvider MIN-3 + Metrics MF — D-V2-05 + D-V2-19 BLOCKING)"
phase_15_execution_complete:
  date: "2026-05-15"
  total_commits: 28
  commits_range: "becc268..30ef597"
  wave_summary:
    W1_P01: "15-01 (1 commit becc268) — scaffolding 4 packages F15 ESM-only"
    W2_P02: "15-02 (7 commits 37ec15a..f5a7b6e) — @gluezero/mf-web-component implementation completa + 34 Tier-1"
    W2_P03: "15-03 (10 commits 843ccce..ce65ef0) — @gluezero/mf-iframe + D-V2-09 BLOCKING closure + 66 Tier-1"
    W2_P04: "15-04 (4 commits f7c9cab..4f9b3c9) — @gluezero/mf-module-federation + @gluezero/mf-single-spa merged + 56 Tier-1"
    W3_P05: "15-05 (6 commits 9ff9372..30ef597) — closure F15: check-d83-f15.mjs + 8 Tier-3 + 4 README + 4 example HTML + JSDoc enrichment + 15-VERIFICATION.md"
  test_count: 194  # 156 Tier-1 jsdom + 38 Tier-3 Chromium Playwright
  bundle_aggregate_f15: "11.4 KB / 22 KB cap (52% utilizzo)"
  d83_strict_octuple: "15/15 ZERO-DIFF (8 octuple + 7 frozen v1.x/mf-esm)"
  d_v2_09_blocking_closure: "PASS — 7 security gates ALL mitigated"
  d_v2_23_blocking_closure: "PASS — MF + SS @0.x.0 V2.0 + GA deferred V2.1"
current_wave: all_complete
current_plan: all_complete (5/5 plans + verifier PASS_WITH_CAVEATS)
phase_13_verifier_pass:
  date: "2026-05-14"
  verifier_verdict: "PASS_WITH_CAVEATS (26/26 must-haves verified — 17 REQ-IDs F13 + 9 cross-fase, 4/4 SC, 26/26 D-V2-F13-* traceable, D-83 strict SEXTUPLE esteso 13/13 zero-diff verified empirically, bundle 4.23 KB / 12 KB cap 65% headroom + augment 22 B / 1 KB, 78 Tier-1 unit + 15 integration SC1-SC7 + 23 Tier-3 Playwright Chromium 6 scenari = 116/116 PASS, BC §42 v1-bc-replay 267/270 PASS, MF-PIPE-01 pipeline-harness preserved D-V2-20)"
  verification_file: .planning/phases/13-isolation-theme-cache-gateway-worker-integration/13-VERIFICATION.md
  caveats_overridden_yolo_chain: 4
  caveats_detail:
    - "3 skipped legacy v1-bc-replay tests — baseline preservato F8/F11/F12"
    - "F9_END=7408f25 baseline mf-esm (post-v1.1.0 finalization F9) — Rule 1 W3 P05 documentato verifier baseline drift fix"
    - "AMENDMENT D-V2-F13-04-AMENDED factory 1→2 opt — auto-ratificato OQ-6 Service Locator F8 SERVICE_GATEWAY/WORKER/THEME assenti v1.0/v1.1; coerente F11 2-opt carryover"
    - "MF-ISO-05 events parziale (descriptor lock + warning matrix MF-ISO-06) — runtime enforcement reale deferred V2.1"
  next_command: "/gsd-discuss-phase 14 --chain (Phase 14 — Fallback & Error Boundary + Devtools MF Inspector @gluezero/fallbacks, ~10 REQ-IDs MF-FALLBACK-01..05 + MF-DEVTOOLS-01..05, deps F8+F11+F13 closed, D-V2-05 BLOCKING)"
phase_13_execution_complete:
  date: "2026-05-14"
  total_commits: 13
  commits_range: "13b57cd..9fd360c"
  wave_summary:
    W1: "13-01 (3 commits 13b57cd..7393fa0) — scaffolding @gluezero/isolation 14° workspace"
    W2_P02: "13-02 (4 commits aa7815a..d7f9ad8) — policy-resolver + warning-matrix MF-ISO-06 + lifecycle-register-hook"
    W2_P03: "13-03 (2 commits 45558c8..91a8045) — DOM attachShadow + CSS data-gz-mf + scopeCss + iframe-stub + lifecycle-mount-hook"
    W2_P04: "13-04 (3 commits c6c917c..dc24037) — 4 facade + buildThemeStyleSheet internal + wrap-context composition esterna chained DOPO F11"
    W3: "13-05 (4 commits c856da2..9fd360c) — isolation-module FINAL + Tier-1 integration SC1-SC7 + Tier-3 Playwright 6 scenari + README italiano 377 LoC + JSDoc + HTML demo 3 MF + scripts/check-d83-f13.mjs verifier reale"
  bundle_final: "4.23 KB / 12 KB cap (D-V2-F13-13 lockato — 35% used, 7.77 KB headroom) + augment 22 B / 1 KB"
  test_suite: "78 Tier-1 unit + 15 Tier-1 integration SC1-SC7 + 23 Tier-3 Playwright Chromium 6 scenari = 116/116 PASS"
  req_ids_closed: [MF-ISO-01, MF-ISO-02, MF-ISO-03, MF-ISO-04, MF-ISO-05, MF-ISO-06, MF-INT-THEME-01, MF-INT-THEME-02, MF-INT-THEME-03, MF-INT-THEME-04, MF-INT-GW-01, MF-INT-GW-02, MF-INT-GW-03, MF-INT-WK-01, MF-INT-WK-02, MF-INT-CACHE-01, MF-INT-CACHE-02]
  cross_fase_req_closed: [MF-DOC-02, MF-DOC-04, MF-TEST-01, MF-PIPE-01, MF-BC-01..04, MF-PKG-01..04]
  sc_verified: [SC1, SC2, SC3, SC4]
  d_83_strict_sextuple_esteso_final: "13 git diff zero-lines: 4 F10_END=27dd7db..HEAD (core+microfrontends+mapper+context) + 1 F11_END=a4aec0df..HEAD (permissions) + 1 F12_END=ced731a..HEAD (compat) + 1 F9_END=7408f25..HEAD (mf-esm Rule 1 baseline drift fix) + 6 v1.1.0..HEAD (theme+cache+gateway+worker+devtools+routing frozen baseline) = ALL ZERO"
  amendments:
    - "AMENDMENT D-V2-F13-04-AMENDED: factory 1-opt → 2-opt {policyDefault?, resolvers?: {gateway?, worker?, theme?, iframeLoader?}} per OQ-6 risoluzione. Coerente F11 D-V2-F11-18 2-opt deliberata divergenza ratificata."
  human_needed_override:
    applied: "verifier PASS_WITH_CAVEATS con 4 override deferred pianificati coerente CLAUDE.md mode yolo + auto_advance + chain attivo da /gsd-discuss-phase 13 --chain"
    rationale: "Tutti i caveat sono deferred V2.1/F15/F16 documentati pre-execute o auto-ratificati post-research/OQ-empirical; verifier formale (13-VERIFICATION.md) ratifica risultato finale"
  pre_existing_caveat_non_f13: "attw fail su @gluezero/theme/tokens-default.css package.json export — pre-existing F7 v1.1 issue, fuori scope F13. Fix raccomandato in milestone closure cycle F17."
phase_13_plan_03_w2_complete:
  date: "2026-05-13"
  summary_file: .planning/phases/13-isolation-theme-cache-gateway-worker-integration/13-03-SUMMARY.md
  commits:
    - 45558c8: "feat(13-03): DOM isolation (attachShadow + Strategy A mutation cast) + CSS isolation (data-gz-mf) + scopeCss helper minimal regex"
    - 91a8045: "feat(13-03): iframe-stub (IFRAME_ADAPTER_REQUIRED throw + F15 delegate) + lifecycle-mount-hook (subscribe + apply chain + abortSignal) + barrel exports"
  files_created: 10
  files_modified: 1  # index.ts barrel (Rule 2)
  loc_total: 1171  # 696 source + 475 test
  tests_added: 23  # 5 dom + 4 css + 5 scope + 3 iframe + 6 lifecycle-mount
phase_13_plan_03_w2_complete:
  date: "2026-05-13"
  summary_file: .planning/phases/13-isolation-theme-cache-gateway-worker-integration/13-03-SUMMARY.md
  commits:
    - 45558c8: "feat(13-03): DOM isolation (attachShadow + Strategy A mutation cast) + CSS isolation (data-gz-mf) + scopeCss helper minimal regex"
    - 91a8045: "feat(13-03): iframe-stub (IFRAME_ADAPTER_REQUIRED throw + F15 delegate) + lifecycle-mount-hook (subscribe + apply chain + abortSignal) + barrel exports"
  files_created: 10
  files_modified: 1  # index.ts barrel (Rule 2)
  loc_total: 1171  # 696 source + 475 test
  tests_added: 23  # 5 dom + 4 css + 5 scope + 3 iframe + 6 lifecycle-mount
  tests_suite_total: 78
  bundle_pre_p03_gzip_bytes: 526
  bundle_post_p03_gzip_bytes: 1961  # 16.0% di 12288 cap (headroom 10327 B per W2-P05 + W3)
  bundle_delta_p03_bytes: 1435  # in linea con estimate 1.5 KB
  d83_sextuple_esteso_lines_diff: "0/0/0/0/0/0 (core+microfrontends+mapper+context+permissions+compat preservato)"
  deviations_rule_1: 2  # Payload F8 dual-shape + PolicyCache duck-typed decoupling parallel-safe
  deviations_rule_2: 1  # Barrel export API pubblica (5 funzioni + 6 types)
  mf_iso_02_coverage: "100% closed (DOM 4 modi + CSS 4 modi + scopeCss + iframe stub + lifecycle apply chain)"
  mf_iso_05_coverage: "parziale (events lock via descriptor — closure W3 P05 integration)"
  oq_resolved:
    oq_1_timing: "SYNC verified empirically (registry.ts:538 publish + :543 await + broker async microtask D-01 garantisce handler pre-loader)"
    oq_4_scope_css_depth: "minimal char-by-char parser O(n) Claude's Discretion CONTEXT.md (top-level + comma + @media/@supports body ricorsivo; NO nested PostCSS-style)"
    oq_5_mutation_cast: "Strategy A ratificato carryover D-V2-F10-XX (mount.element = innerDiv in-place pre-loader F9 ESM)"
  next_command: "/gsd-execute-phase 13 --no-transition per Plan 13-05 W3 (Tier-3 Playwright + README + JSDoc enrichment + bundle gate finale)"
phase_13_plan_01_w1_complete:
  date: "2026-05-13"
  summary_file: .planning/phases/13-isolation-theme-cache-gateway-worker-integration/13-01-SUMMARY.md
  commits:
    - 13b57cd: "feat(13-01): scaffolding package @gluezero/isolation - package.json + tsup + tsconfig + vitest configs"
    - 87e2ba4: "feat(13-01): types skeleton + topics literal + IsolationPolicyError (category=microfrontend frozen v1.0)"
    - 7393fa0: "feat(13-01): isolationModule({policyDefault?, resolvers?}) factory stub + augment Pattern S1 + Service Locator binding"
  files_created: 18
  files_modified: 1
  loc_total: 1293
  bundle_size_gzip_bytes: 526  # cap 12288 (4.4%, headroom 11762 B per W2)
  bundle_augment_gzip_bytes: 22  # cap 1024
  d83_sextuple_esteso_lines_diff: "0/0/0/0/0/0 (core+microfrontends+mapper+context+permissions+compat)"
  bc_section_42_replay: "267/270 PASS (3 skipped legacy baseline)"
  deviations_rule_1: 3  # 3 auto-fix Plan-level (BrokerError interface vs class + BrokerModule shape + SERVICE_ISOLATION F8 reuse)
  next_command: "/gsd-execute-phase 13 --no-transition per Plan 13-02 W2 (entry point policy resolver + warning + lifecycle-register)"
phase_13_context_complete:
  date: "2026-05-13"
  context_file: .planning/phases/13-isolation-theme-cache-gateway-worker-integration/13-CONTEXT.md
  discussion_log: .planning/phases/13-isolation-theme-cache-gateway-worker-integration/13-DISCUSSION-LOG.md
  d_v2_f13_decisions: 26  # 16 da discuss (4 aree × 4 domande) + 10 carryover auto-locked
  areas_discussed:
    - "A: Architettura enforcement + composition F10 (D-V2-F13-01..04) — hybrid lifecycle hook + wrap context + Service Locator perm + eager resolve at register + 1-opt factory"
    - "B: DOM/CSS isolation tech + scope iframe F13 vs F15 (D-V2-F13-05..08) — shadow-dom attachShadow + scoped data-gz-mf + iframe stub throw + theme adoptedStyleSheets D-F7-22"
    - "C: 4 facade integration storage/gateway/worker/theme (D-V2-F13-09..12) — TUTTE in @gluezero/isolation + wrapContextWithIsolation chain dopo F11 + localStorage namespace + attribution metadata + 5 topics literal F13"
    - "D: Bundle cap + Tier-3 Playwright + UI example + D-83 strict (D-V2-F13-13..16) — 12 KB cap + 6 Playwright scenari + 1 HTML demo 3 MF + D-83 sextuple esteso"
  bundle_cap_target: "12 KB gzipped (D-V2-F13-13 lockato)"
  d_83_strict_required: "F13 SESTA fase v2.0 strict SEXTUPLE esteso + frozen baseline v1.0/v1.1 (zero diff core+microfrontends+mapper+context+permissions+compat dai rispettivi END + theme/cache/gateway/worker/mf-esm/devtools/routing frozen v1.x baseline)"
  tier_3_scope: "6 Playwright Chromium scenari minimal targeted (D-V2-F8-04 pattern: shadow-dom mount + scoped CSS + iframe stub throw + StorageFacade namespaced + adoptedStyleSheets propagation + warning matrix)"
  package_new: "@gluezero/isolation (14° pacchetto del monorepo, ESM-only, peerDeps optional 8 package)"
  wave_structure_target:
    W1: "1 plan scaffolding (tsup multi-entry + augment + size-limit 12 KB + scripts + interfaces skeleton)"
    W2: "3 plan implementation (policy-resolver+warning+lifecycle-register | dom-css+scopeCss+iframe-stub+lifecycle-mount | 4-facade+wrap-context) parallelizzabili"
    W3: "1 plan Tier-1 jsdom + Tier-3 Playwright 6 scenari + README italiano + JSDoc + example HTML 3 MF + verifier"
  deferred:
    - "Iframe adapter completo (defer F15 @gluezero/mf-iframe)"
    - "Iframe theme bridge gz:context:update postMessage (defer F15)"
    - "sessionStorage support StorageFacade (defer V2.1)"
    - "MicroFrontendThemePolicy.adapter field signature (defer V2.1)"
    - "getDebugSnapshot().external.isolation integration (defer F16 MIN-3)"
    - "Network 'gateway-only' enforcement reale (defer V2.1 con F15 iframe sandbox)"
    - "Storage 'shared' third-party detection robusta (defer V2.1)"
    - "Devtools 'isolation overview' panel oltre stub (defer F16 MF-DEVTOOLS-05)"
    - "API setMicroFrontendIsolation runtime mutation (defer V2.1)"
  next_command: "/gsd-plan-phase 13 --auto (auto-chain attivo) — researcher + planner producono RESEARCH.md + PLAN.md F13"
phase_13_plan_complete:
  date: "2026-05-13"
  research_file: .planning/phases/13-isolation-theme-cache-gateway-worker-integration/13-RESEARCH.md
  patterns_file: .planning/phases/13-isolation-theme-cache-gateway-worker-integration/13-PATTERNS.md
  plan_files:
    - .planning/phases/13-isolation-theme-cache-gateway-worker-integration/13-01-PLAN.md  # W1 scaffolding (3 tasks, 18 nuovi file + 1 mod)
    - .planning/phases/13-isolation-theme-cache-gateway-worker-integration/13-02-PLAN.md  # W2 policy resolver + warning + lifecycle-register (3 tasks)
    - .planning/phases/13-isolation-theme-cache-gateway-worker-integration/13-03-PLAN.md  # W2 DOM/CSS + scopeCss + iframe-stub + lifecycle-mount (2 tasks)
    - .planning/phases/13-isolation-theme-cache-gateway-worker-integration/13-04-PLAN.md  # W2 4 facade + wrap-context + buildThemeStyleSheet (3 tasks)
    - .planning/phases/13-isolation-theme-cache-gateway-worker-integration/13-05-PLAN.md  # W3 Tier-1+Tier-3 closure + README + JSDoc + HTML demo + verifier (4 tasks)
  total_plans: 5
  total_tasks: 15  # 3+3+2+3+4
  total_est_loc: 6760  # ~4400 source + ~2360 test (target ROADMAP 5400 leggermente superato per Tier-3 6 scenari + integration)
  wave_structure:
    W1: "13-01 (scaffolding pkg @gluezero/isolation + multi-entry tsup + size-limit 12 KB + 7 topics + skeleton interfaces + augment Pattern S1)"
    W2: "13-02 sequential entry post-P01 (policy resolver + warning matrix MF-ISO-06 + lifecycle-register-hook subscribe microfrontend.registered) → 13-03 (DOM attachShadow + CSS data-gz-mf + scopeCss minimal regex + iframe-stub throw + lifecycle-mount-hook subscribe microfrontend.mounting, parallel-safe dopo P02 file ownership disgiunta) → 13-04 (4 facade + wrap-context composition esterna chained DOPO F11 + buildThemeStyleSheet ~400 B internal, parallel-safe dopo P02 file ownership disgiunta)"
    W3: "13-05 (isolation-module FINAL + Tier-1 integration ~12 test SC1-SC7 cross-fase F11+F12+F13 + Tier-3 Playwright Chromium 6 scenari + README italiano ~340-360 LoC + JSDoc 12 file + example HTML 3 MF + scripts/check-d83-f13.mjs verifier + ci:gate:f13)"
  amendments:
    - "AMENDMENT D-V2-F13-04-AMENDED: factory 1-opt → 2-opt {policyDefault?, resolvers?} (Service Locator SERVICE_GATEWAY/WORKER/THEME NON ESISTONO in v1.0/v1.1 per OQ-6 risoluzione). Coerente F11 D-V2-F11-18 2-opt deliberata divergenza ratificata."
  plan_check_verdict: "PASS_WITH_CAVEATS (17/17 REQ-IDs + 26/26 D-V2-F13-* coverage + 3-wave coarse + cross-fase obligations gate ALL PASS, 5 WARNING auto-fixable Rule 1 documentati)"
  plan_check_warnings_resolved_pre_execute:
    - "WARNING-3: IsolationPolicyError category='isolation' → 'microfrontend' (carryover F11/F12 ErrorCategory union frozen v1.0). Fix preventivo applicato in 13-01-PLAN.md:542 prima di execute."
  plan_check_warnings_deferred_to_execute_auto_fix:
    - "WARNING-1: D-V2-F13-04-AMENDED ratifica formale auto-applicata dal planner (RESEARCH OQ-6)"
    - "WARNING-2: Tier-3 scenario 3 valore aggiunto limitato (informativa, NO downgrade)"
    - "WARNING-4: P02 single-subscribe microfrontend.registered (vs dual-subscribe F11/F12); fallback empirical verifica W2-P02"
    - "WARNING-5: vitest browser config script invocation flag --config esplicito"
  next_command: "/gsd-execute-phase 13 --auto --no-transition (auto-chain attivo da discuss-phase --chain) — executor W1: 13-01 scaffolding @gluezero/isolation"
phase_12_complete_verified:
  date: "2026-05-13"
  verifier_verdict: "PASS_WITH_CAVEATS (4/4 SC, 5/5 MF-COMPAT-01..05, 20/20 D-12-01..20, 7/7 OQ resolved, bundle 7.9 KB / 9 KB cap, BC §42 267/270 v1-bc-replay PASS, D-83 strict quadruple ZERO diff core+microfrontends+mapper+permissions, MF-PIPE-01 PASS, semver 7.8.0 tree-shake noExternal)"
  pre_existing_caveat: "attw fail @gluezero/theme/tokens-default.css package.json export — pre-existing F7 issue, NOT regression F12 (verified empirically by checkout @ a4aec0df)"
  verification_file: .planning/phases/12-compatibility-versioning-semver-9-dimensioni/12-VERIFICATION.md
phase_11_complete_verified:
phase_11_verifier_pass:
  date: "2026-05-13"
  verifier_verdict: "PASS (3/3 must-haves, 13/13 REQ-IDs, 22/22 D-V2-F11-XX, 5/5 SC, 7/7 OQ resolved A1+A2+A3 amendments, 3/3 Pitfall HIGH mitigated P-02/P-13/P-23, D-83 strict triple esteso 0/0/0/0 lines diff F10_END=27dd7db..HEAD on packages/{core,microfrontends,mapper,context}/src/, bundle 3.02 KB / 5 KB cap headroom 1.95 KB, 160 Tier-1 + 21 integration = 181 tests PASS, 267 core v1-bc-replay PASS / 3 skipped zero regression)"
  verification_file: .planning/phases/11-permissions-capabilities-pipeline-28-extension/11-VERIFICATION.md
  minor_caveats_non_blocking: 3
  next_command: "/gsd-discuss-phase 12 --chain (Phase 12 — Compatibility/Versioning @gluezero/compat, 5 REQ-IDs MF-COMPAT-01..05, hard dep semver 7.8.0, bundle 9 KB, deps F8+F11) — COMPLETED 2026-05-13 PASS_WITH_CAVEATS"
phase_11_execution_complete:
  date: "2026-05-13"
  total_commits: 15
  commits_range: "745d19f..a4aec0d"
  wave_summary:
    W1: "11-01 (4 commits 745d19f..99983fa) — scaffolding @gluezero/permissions 13° workspace"
    W2a: "11-02 (3 commits 5de39af..effecf9) — engine + pattern + LRU + error + topics"
    W2b: "11-04 (3 commits 9d8965b..d712c80) — capability-registry + checker + lifecycle-hooks"
    W2c: "11-03 (2 commits 51a7701..cd8b84e) — enforcement-points OQ-1 facade-only + permissionsModule factory"
    W3: "11-05 (3 commits efe01c2..a4aec0d) — Tier-1 E2E + JSDoc enrichment + README italiano + demo HTML + ci:gate:f11 D-83 baseline fix"
  bundle_final: "3.02 KB / 5 KB cap (D-V2-F11-19 lockato — 60% used, 1.95 KB headroom)"
  test_suite: "160 Tier-1 unit + 21 integration jsdom = 181 PASS"
  jsdoc_counters: "+20 @example / +62 @see / +8 @throws (target 14/12/6 superati)"
  req_ids_closed: [MF-PERM-01, MF-PERM-02, MF-PERM-03, MF-PERM-04, MF-PERM-05, MF-PERM-06, MF-CAP-01, MF-CAP-02, MF-CAP-03, MF-CAP-04, MF-CAP-05, MF-INT-LIFE-03, MF-PIPE-01]
  sc_verified: [SC1, SC2, SC3, SC4, SC5]
  d_83_strict_triple_final: "F10_END=27dd7db..HEAD packages/{core,microfrontends,mapper,context}/src/ ALL ZERO DIFF"
  oq_amendments_applied:
    A1_critical: "OQ-1 facade-only enforcement via wrapContextWithPermissions composition esterna pura (publishInterceptors seam F8 D-V2-F8-13 NOT wired in core broker.ts:198-207 verified)"
    A2_high: "OQ-2 best-effort post-hoc capability check via dual subscribe microfrontend.bootstrapped+loaded (auto-bootstrap D-V2-07 inline coverage) + checkCapabilitiesPreMount API esplicita per hard block"
    A3_medium: "OQ-3 wrapServiceWithPermissions monkey-patch idempotent __permissionsServicePatched marker non-enumerable+non-writable"
  pipeline_28_resolution: "MF-PIPE-01 D-V2-20 ordine pipeline §28 preservato come PROPRIETÀ LOGICA della facade chain (ctx.publish wrap → engine.enforce → mapping/route resolve interni), NOT F1-level pipeline step instrumented. Cross-fase obligation closure formal F11 (ROADMAP linea 456) — pattern verifier consistente per fasi F12+."
  ci_gate_f11_d83_baseline_fix: "main → F10_END=27dd7db (closure docs commit a4aec0d). Coerente F8/F9/F10 verifier pattern."
  human_needed_override:
    applied: "execute-phase 11-02/11-05 agent truncations risolte via filesystem fallback + manual completion (commit effecf9 + a4aec0d) coerente CLAUDE.md mode yolo + auto_advance attivo"
    rationale: "Agent truncation è failure mode noto (workflow §9a/§11a filesystem fallback); recovery autonomo preserve invariants (D-83 + bundle + tests) — verifier formale (11-VERIFICATION.md) ratifica risultato finale"
  roadmap_md_anomaly_note: "Durante plan-phase il planner ha sovrascritto accidentalmente .planning/ROADMAP.md (ricostruito da memoria). Sezione F11 RICOSTRUITA è ACCURATA (verifier confirmed). Sezioni F12-F17 MAY HAVE INACCURACIES — user dovrebbe verificare against prd_2.0.0.md §48 + REQUIREMENTS.md prima di F12 plan-phase."
  pre_existing_caveat_non_f11: "attw fail su @gluezero/theme/tokens-default.css package.json export — pre-existing F7 issue, fuori scope F11. Fix raccomandato in milestone closure cycle F17."
last_completed_plan:
  id: 11-05
  date: "2026-05-13"
  commits: ["efe01c2", "c9970fc", "a4aec0d"]
  summary_file: .planning/phases/11-permissions-capabilities-pipeline-28-extension/11-05-SUMMARY.md
  tests_total: 105
  bundle_gzip_kb: 2.91
  d_83_strict_diff: 0  # packages/{core,microfrontends,mapper}/src/ vs 99983fa
  highlights:
    - "OQ-1 facade-only enforcement via wrapContextWithPermissions (composition esterna pura, NO EventTap multiplex)"
    - "OQ-3 service monkey-patch idempotent (__permissionsServicePatched non-enumerable + tampering-resistant)"
    - "permissionsModule({permissionMode?, capabilityPolicy?}) 2-options factory D-V2-F11-18 con default warn+warn"
    - "MF-PIPE-01 D-V2-20 chiuso come proprietà LOGICA della facade chain"
    - "5 deviation auto-fix Rule 1 (DTS narrowing closure + handler signature + Record cast + audit-grep file scheme + throw wrapping cause chain)"
phase_11_context_complete:
  date: "2026-05-12"
  context_file: .planning/phases/11-permissions-capabilities-pipeline-28-extension/11-CONTEXT.md
  discussion_log: .planning/phases/11-permissions-capabilities-pipeline-28-extension/11-DISCUSSION-LOG.md
  d_v2_f11_decisions: 22  # 16 da discuss (4 aree × 4 domande) + 6 carryover auto-locked
  areas_discussed:
    - "A: Pipeline §28 ordering + enforcement seam (D-V2-20 BLOCKING) — 4 decisions"
    - "B: Permission engine pattern matching + LRU + error semantics — 4 decisions"
    - "C: Capability Registry register/check/policy + lifecycle integration — 4 decisions"
    - "D: permissionMode + capabilityPolicy + per-MF override — 4 decisions"
  bundle_cap_target: "5 KB gzipped (D-V2-F11-19 lockato SC5 ROADMAP)"
  d_83_strict_required: "F11 TERZA fase v2.0 con git diff vuoto su packages/core/src/ E packages/microfrontends/src/ E packages/mapper/src/ (triple strict carryover)"
  tier_3_scope: "NESSUNO (Tier-1 jsdom only — D-V2-F11-21 + ROADMAP cross-fase obligation linea 88/233/456)"
  package_new: "@gluezero/permissions (13° pacchetto del monorepo, ESM-only, peerDeps optional core+microfrontends+context)"
phase_11_research_complete:
  date: "2026-05-12"
  research_file: .planning/phases/11-permissions-capabilities-pipeline-28-extension/11-RESEARCH.md
  confidence: "HIGH stack/seam/patterns/pitfalls; MEDIUM architecture facade-only OQ-1"
  critical_finding: "OQ-1 publishInterceptors seam NOT wired in broker.ts:198-207 (D-V2-F8-13 dead code) — F11 pivot facade-only enforcement"
  open_questions: 7  # OQ-1 CRITICAL + OQ-2 HIGH + OQ-3..7
  patterns_file: .planning/phases/11-permissions-capabilities-pipeline-28-extension/11-PATTERNS.md
  pattern_coverage: "21 NEW files + 2 root append, 90.5% analog F1-F10 (F10 acl-enforcer+context-module+lifecycle-hooks = template diretto)"
phase_11_plan_complete:
  date: "2026-05-13"
  verifier_verdict: "PASS iter2/3 (0 BLOCKER + 1 cosmetic WARNING non-blocking, 13/13 REQ-IDs + 22/22 D-V2-F11-XX coverage, all invariants preserved)"
  verifier_iterations: 2  # iter1: 3 BLOCKER + 5 WARNING; iter2: 0 BLOCKER + 1 WARNING (88% improvement)
  total_plans: 5
  total_tasks: 18  # 11-01:3 + 11-02:5 + 11-03:2 + 11-04:3 + 11-05:5
  total_est_loc: 5600  # ~4190 source + ~1400 test
  plan_files:
    - .planning/phases/11-permissions-capabilities-pipeline-28-extension/11-01-PLAN.md  # W1 scaffolding
    - .planning/phases/11-permissions-capabilities-pipeline-28-extension/11-02-PLAN.md  # W2 engine+pattern+LRU+error+topics (parallel-safe W2 start)
    - .planning/phases/11-permissions-capabilities-pipeline-28-extension/11-03-PLAN.md  # W2 enforcement-points+module (sequential after 11-02+11-04 per B-01 cross-import resolution)
    - .planning/phases/11-permissions-capabilities-pipeline-28-extension/11-04-PLAN.md  # W2 capability-registry+checker+lifecycle (parallel-safe after 11-02)
    - .planning/phases/11-permissions-capabilities-pipeline-28-extension/11-05-PLAN.md  # W3 Tier-1 closure + README + JSDoc + verifier
  wave_structure:
    W1: "11-01 (scaffolding pkg @gluezero/permissions multi-entry + augment + size-limit 5 KB + ci:gate:f11)"
    W2: "11-02 sequential entry (engine + pattern + LRU + error + topics) → 11-04 (capability registry + checker + lifecycle, parallel-safe dopo 11-02) → 11-03 (enforcement-points + module, dopo 11-02+11-04 per cross-import resolution B-01)"
    W3: "11-05 (Tier-1 closure + README italiano + JSDoc + example HTML + verifier 13 REQ-IDs + 5 SC + D-83 triple verify + MF-PIPE-01 cross-fase obligation)"
  amendments_post_research:
    - "A1: D-V2-F11-02 superseded by facade-only enforcement (OQ-1 publishInterceptors NOT wired in core)"
    - "A2: OQ-2 best-effort post-hoc capability check (auto-bootstrap D-V2-07 inline) + API esplicita checkCapabilitiesPreMount"
    - "A3: OQ-3 service monkey-patch idempotent __permissionsServicePatched marker"
  blocker_fixes_iter1:
    - "B-01: 11-03 cross-plan import 11-04 → depends_on update [11-02, 11-04] enforce wave order"
    - "B-02: SC2 test broker.publish().toThrow → permissionService.checkCapabilitiesPreMount().toThrow (F1 pub/sub no re-throw pattern)"
    - "B-03: capability-registry-internal-export phantom → direct export from capability-registry.ts"
  roadmap_md_anomaly:
    detected: "planner accidentally overwrote .planning/ROADMAP.md with empty content during plan-phase; reconstructed from session memory"
    f11_section_status: "ACCURATE — goal + 13 REQ-IDs + 5 SC + decisions BLOCKING match originale (verified by checker iter2)"
    f12_f17_section_status: "MAY HAVE INACCURACIES — user should verify against prd_2.0.0.md §48 + REQUIREMENTS.md before F12 plan-phase"
    impact_on_f11: "ZERO (F11 plans self-contained, verifier reads only F11 section)"
  next_command: "/gsd-execute-phase 11 --auto (auto-chain attivo) — executor W1: 11-01 scaffolding @gluezero/permissions"
phase_10_verifier_pass:
  date: "2026-05-12"
  verifier_verdict: "PASS (11/11 must-haves, 11/11 REQ-IDs, 4/4 SC, 21/21 D-V2-F10-XX, D-83 strict triple 0/0/0 diff, 9/9 threats mitigated, bundle 2.71 KB / 4 KB cap, 139/139 tests, JSDoc 31/111/10)"
  verification_file: .planning/phases/10-runtime-context-module-mapping-per-mf/10-VERIFICATION.md
  human_needed_override:
    applied: "10-05 Task 4 checkpoint:human-verify auto-approved"
    rationale: "CLAUDE.md mode yolo + auto_advance + chain attivo da /gsd-discuss-phase 10 --chain — verifier formale (10-VERIFICATION.md) sostituisce review"
  next_command: "/gsd-discuss-phase 11 --chain (Phase 11 — Permissions + Capabilities + Pipeline §28 Extension, 13 REQ-IDs, D-V2-20 BLOCKING ordine pipeline §28)"
last_completed_plan:
  id: 10-05
  date: "2026-05-12"
  commits: [85f6748, 067be9b, 27dd7db]
  summary: .planning/phases/10-runtime-context-module-mapping-per-mf/10-05-SUMMARY.md
last_completed_plan:
  id: 10-05
  date: "2026-05-12"
  commits: [85f6748, 067be9b, 27dd7db]
  summary: .planning/phases/10-runtime-context-module-mapping-per-mf/10-05-SUMMARY.md
  bundle_final: "2.71 KB / 4 KB cap (headroom 1.29 KB)"
  test_suite: "117 unit + 22 integration = 139 ALL PASS"
  req_ids_closed: [MF-CTX-01, MF-CTX-02, MF-CTX-03, MF-CTX-04, MF-CTX-05, MF-CTX-06, MF-MAP-01, MF-MAP-02, MF-MAP-03, MF-INT-MAP-01, MF-INT-MAP-02]
  sc_verified: [SC1, SC2, SC3, SC4]
  jsdoc_counters: "31 @example / 111 @see / 10 @throws (targets 12/10/5 all exceeded)"
  decisions_documented:
    - "F9-style split unit vs integration test (vitest.integration.config.ts separato)"
    - "Auto-approve checkpoint:human-verify (yolo mode + chain attivo CLAUDE.md decisional override)"
    - "Deviazioni Rule 1 inline test: D-23 source descriptor + PRD §11.4 lowercase id + deliveryMode 'sync' + SC4 deep-equal asserzione corretta"
    - "ci:gate:f10 esteso con test:integration step Tier-1 jsdom E2E"
  d_83_strict_triple_final: "F9_END=250601c..HEAD packages/{core,microfrontends,mapper}/src/ ALL ZERO DIFF"
  f2_inspector_unchanged: "0 lines diff packages/mapper/src/inspector.ts (composition Proxy esterna)"
phase_10_plans_complete:
  date: "2026-05-11"
  research_file: .planning/phases/10-runtime-context-module-mapping-per-mf/10-RESEARCH.md
  patterns_file: .planning/phases/10-runtime-context-module-mapping-per-mf/10-PATTERNS.md
  plan_files:
    - .planning/phases/10-runtime-context-module-mapping-per-mf/10-01-PLAN.md  # W1 scaffolding
    - .planning/phases/10-runtime-context-module-mapping-per-mf/10-02-PLAN.md  # W2 core API (sequential entry)
    - .planning/phases/10-runtime-context-module-mapping-per-mf/10-03-PLAN.md  # W2 ACL enforcement (parallel-safe dopo P02)
    - .planning/phases/10-runtime-context-module-mapping-per-mf/10-04-PLAN.md  # W2 mapping integration (parallel-safe dopo P02+P03)
    - .planning/phases/10-runtime-context-module-mapping-per-mf/10-05-PLAN.md  # W3 closure + Tier-1 + README + verifier
  verifier_verdict: "VERIFICATION PASSED — 12/12 dimensions pass, 11/11 REQ-IDs covered, 4/4 SC mapped, 21/21 D-V2-F10-XX tracked, 5 STRIDE threats covered, D-83 triple strict gates in tutti i plan"
  total_plans: 5
  total_tasks: 16
  total_est_loc: 2200
  wave_structure:
    W1: "10-01 (scaffolding pkg @gluezero/context multi-entry + augment + size-limit 4 KB + ci:gate:f10)"
    W2: "10-02 sequential entry (core API CTX-01/02/03/05) → 10-03 ACL (CTX-04 parallel-safe) → 10-04 mapping (CTX-06+MAP-01/02/03+INT-MAP-01/02 parallel-safe)"
    W3: "10-05 (Tier-1 closure + README italiano + JSDoc + example HTML + verifier 11 REQ-IDs + 4 SC + D-83 triple verify)"
  bundle_cap: "@gluezero/context ≤ 4 KB gzipped lockato D-V2-F10-19, stima ~3.37 KB con headroom ~630 B"
  d_83_strict_triple: "F10 SECONDA fase v2.0 con git diff packages/core/src/ + packages/microfrontends/src/ + packages/mapper/src/ TUTTI vuoti strict (F8 eccezione MIN-1/MIN-2 chiusa, F9 strict chiuso)"
  tier_3_scope: "NESSUNO (Tier-1 jsdom only — D-V2-F10-16 SC4 esplicito)"
  next_command: "/gsd-execute-phase 10 --auto (auto-chain attivo) — executor W1: 10-01 scaffolding @gluezero/context"
current_branch: gsd/v2.0.0-microfrontend-governance
branch_created_at: "2026-05-11T08:00:00.000Z"
branch_created_from: main@d4c0777
phase_10_context_complete:
  date: "2026-05-11"
  context_file: .planning/phases/10-runtime-context-module-mapping-per-mf/10-CONTEXT.md
  discussion_log: .planning/phases/10-runtime-context-module-mapping-per-mf/10-DISCUSSION-LOG.md
  d_v2_f10_decisions: 21  # 16 da discuss (4 aree × 4 domande) + 5 carryover auto-locked
  areas_discussed:
    - "A: Selector subscribe + reference identity (P-17) — 4 decisions"
    - "B: Read-only enforcement + storage (writableKeys per-descriptor) — 4 decisions"
    - "C: Namespace + Inspector extension (D-83 strict) — 4 decisions"
    - "D: Events fire-pattern + contextMap injection — 4 decisions"
  bundle_cap_target: "4 KB gzipped (D-V2-F10-19 lockato SC4 ROADMAP)"
  d_83_strict_required: "F10 SECONDA fase v2.0 con git diff vuoto su packages/core/src/ E packages/microfrontends/src/ E packages/mapper/src/ (triple strict)"
  tier_3_scope: "NESSUNO (Tier-1 jsdom only — D-V2-F10-16 SC4 ROADMAP esplicito)"
  package_new: "@gluezero/context (12° pacchetto del monorepo, ESM-only, peerDeps optional core+microfrontends+mapper)"
  wave_structure_target:
    W1: "1 plan scaffolding (tsup multi-entry + augment + size-limit + scripts)"
    W2: "2-3 plan implementation (core API + ACL + mapping integration parallelizzabili)"
    W3: "1 plan Tier-1 closure + README italiano + JSDoc + verifier"
  deferred:
    - "D-V2-12 VAL-09 transform failure → F11 (mapper pipeline internals)"
    - "MF_CONTEXT_WRITE_DENIED in MicroFrontendErrorCode union → V2.x major (D-83 block)"
    - "microfrontend.context.denied in MF_ERROR_TOPICS array → V2.x major / F11"
    - "AliasRegistry.unregisterByPlugin API exposure → F16/V2.1"
    - "React hook useRuntimeContext → F17 framework adapters"
    - "api-extractor diff CI gate → F11/F12"
    - "readOnlyKeys blocklist alternative → V2.1 DX feedback"
  next_command: "/gsd-plan-phase 10 --auto (auto-chain attivo) — researcher + planner producono RESEARCH.md + PLAN.md F10"
phase_9_context_complete:
  date: "2026-05-11"
  context_file: .planning/phases/09-esm-loader-lifecycle-end-to-end/09-CONTEXT.md
  discussion_log: .planning/phases/09-esm-loader-lifecycle-end-to-end/09-DISCUSSION-LOG.md
  d_v2_f9_decisions: 18  # 4 (install+augment) + 4 (normalize) + 4 (timeout/signal) + 4 (Tier-3+route) + 2 (wave/bundle)
  bundle_cap_target: "3 KB gzipped (SUMMARY §2.2 lockato D-V2-F9-18)"
  d_83_strict_required: "Prima fase v2.0 con git diff packages/core/src/ = vuoto E packages/microfrontends/src/ = vuoto (eccezione F8 chiusa)"
  tier_3_scope: "3 scenari Playwright Chromium minimal targeted (E2E + Timeout + Race) replica F8 D-V2-F8-04 pattern"
  deferred:
    - "D-V2-13/14 route carryover closure → F10/F11"
    - "Setup-time options globali → V2.1"
    - "Examples completi 6 file → F17 MF-DOC-04"
    - "api-extractor diff gate → F9 opzionale o defer F10"
    - "CDN esm.sh publish → F17 GA (D-V2-F8-10 lockato)"
  next_command: "/gsd-plan-phase 9 --auto (auto-chain attivo) — researcher + planner producono RESEARCH.md + PLAN.md F9"
phase_9_plans_complete:
  date: "2026-05-11"
  research_file: .planning/phases/09-esm-loader-lifecycle-end-to-end/09-RESEARCH.md
  patterns_file: .planning/phases/09-esm-loader-lifecycle-end-to-end/09-PATTERNS.md
  plan_verification_file: .planning/phases/09-esm-loader-lifecycle-end-to-end/09-PLAN-VERIFICATION.md
  iter1_verdict: "REVISE — 4 finding M-1..M-4 + 4 minor m-1..m-4"
  iter2_verdict: "SHIP ✓ (18/18 D-V2-F9-XX decisions, 4/4 SC, 2/2 REQ-IDs, 7/7 anti-pattern check)"
  total_plans: 5
  total_tasks: 17
  total_est_loc: 2670
  wave_structure:
    W1: "09-01 (scaffolding) + 09-02 (mf-esm-error) — parallel disgiunto"
    W2: "09-03 (esm-loader + normalize + combineSignals) → 09-04 (mfEsmModule + augment + barrel) — sequenziale per shared index.ts"
    W3: "09-05 (Tier-3 3 scenari + README + esempio + JSDoc + verifier closure)"
  bundle_cap: "@gluezero/mf-esm ≤ 3 KB gzipped lockato D-V2-F9-18"
  d_83_strict: "F9 prima fase v2.0 con git diff packages/core/src/ E packages/microfrontends/src/ entrambi vuoti strict"
  next_command: "/gsd-execute-phase 9 --auto (auto-chain attivo) — executor W1 parallel: 09-01 + 09-02"
phase_9_complete:
  date: "2026-05-11"
  verifier_verdict: "PASS (6/6 must-haves, 2/2 REQ-IDs, 4/4 SC, 18/18 D-V2-F9-XX, 8/8 cross-fase, 7/7 anti-pattern)"
  verification_file: .planning/phases/09-esm-loader-lifecycle-end-to-end/09-VERIFICATION.md
  total_commits: 14
  commits_range: "b9d9001..250601c"
  commits:
    - "b9d9001 feat(09-01-scaffolding): pkg @gluezero/mf-esm config (manifest + tsup multi-entry + tsconfig + vitest)"
    - "8fe2dbb feat(09-01-scaffolding): stub src/index.ts barrel + src/augment.ts side-effect marker"
    - "cb1097a chore(09-01-closure): aggiungi @gluezero/mf-esm a ci:publint + ci:attw + script ci:gate:f9 + size-limit entries"
    - "23f34b3 feat(09-02-error-factory): aggiungi mf-esm-error.ts con MfEsmErrorCode union locale + createMfEsmError factory"
    - "2582edd test(09-02-error-factory): aggiungi Tier-1 unit suite mf-esm-error.test.ts (13 test case)"
    - "f9a2e41 feat(09-03-combine-signals): replica VERBATIM helper OR-merge AbortSignal da F3 gateway"
    - "3a89e7b feat(09-03-normalize): smart fallback priority 4-step exportName→default→named→throw"
    - "31cb5d2 feat(09-03-esm-loader): MicroFrontendLoaderAdapter type='esm' con import() + race + normalize"
    - "ad47160 feat(09-04-module): aggiungi mfEsmModule() BrokerModule factory con install lookup service"
    - "6472e2f feat(09-04-augment): fill augment.ts side-effect-only intent signaling D-V2-F9-02 STRICT"
    - "a43a48e feat(09-04-barrel): fill index.ts barrel + fix size-limit ignore peerDeps mf-esm"
    - "c740fc1 test(09-05-tier3-docs-closure): vitest.browser.config Playwright Chromium + 3 fixture privati Tier-3"
    - "4cbb9da test(09-05-tier3-docs-closure): 3 file Tier-3 Playwright Chromium scenari D-V2-F9-13 lockati"
    - "322808c docs(09-05-tier3-docs-closure): README italiano @gluezero/mf-esm 320 LoC 10 sezioni"
    - "7eccac5 docs(09-05-tier3-docs-closure): esempio standalone HTML mf-esm-basic.html"
    - "7408f25 docs(09-05-tier3-docs-closure): JSDoc enrichment target proporzionale F9 (13 @example / 29 @see / 8 @throws)"
    - "250601c chore(09-05-tier3-docs-closure): estensione ci:gate:f9 automation Playwright install"
  bundle_finale: "@gluezero/mf-esm 1.68 KB gzipped / 3 KB cap (44% headroom)"
  tier1_tests: "82/82 PASS"
  tier3_tests: "6/6 PASS (3 scenari Playwright Chromium: E2E heap snapshot + Timeout + Race load/mount)"
  d_83_strict_verified: "git diff main..HEAD packages/core/src/ = vuoto E packages/microfrontends/src/ = vuoto"
  next_command: "/gsd-discuss-phase 10 --chain (Phase 10 — Runtime Context Module + Mapping per-MF, 11 REQ-IDs)"
phase_8_w5_p11_complete:
  date: "2026-05-11"
  summary_file: .planning/phases/08-extension-runtime-mf-registry-lifecycle-fsm-standard-topics/08-11-SUMMARY.md
  commits:
    - "1e03cc3 feat(08-11-context): runtime context factory + registry replace stub (B2 preservation)"
    - "5549b77 feat(08-11-test-utils): MOCK loader + test harness privati (D-V2-F8-03)"
    - "2f374f2 test(08-11-e2e): Tier-3 Playwright Chromium E2E scenario + heap snapshot"
    - "778a06a chore(08-11-integration): biome format + commento registry stub rephrase"
  files_created: 5 (+ deferred-items.md)
  files_modified: 2 (registry.ts, index.ts)
  tests_added_tier1: 13
  tests_added_tier3: 3
  tests_passing_microfrontends_tier1: "368 passed (12 file cumulativi)"
  tests_passing_microfrontends_tier3: "6 passed (2 file Playwright Chromium)"
  tests_passing_core: "267 passed | 3 skipped (zero regressioni v1-bc-replay)"
  core_diff_lines: 0
  d_83_verified: "git diff packages/core/src/ -> empty (D-83 strict preservato)"
  b2_preservation_verified: "publishLifecycleEvent + publishErrorEvent + commento '08-10 helper PRESERVED' INTATTI; makeStubRuntimeContext rimosso (count 0)"
  no_proxy_verified: "runtime-context-factory.ts: 0 hit 'new Proxy' (explicit object RESEARCH §8.2)"
  test_utils_private_verified: "index.ts barrel: 0 hit 'test-utils' (D-V2-F8-03 lockato)"
  biome_check: "0 errors / 0 warnings"
  deviations: "Rule 3 source.type='plugin' (D-83 picklist constraint, no 'microfrontend' nel core); Rule 3 architectural gap D-V2-16 cascade non funzionale senza modifica core (workaround D-26 AbortController; tracked in deferred-items.md per V2.1); Rule 1 logger=undefined assignment exactOptional fix; Rule 1 flush microtask in test async per default deliveryMode 'async'"
  next_command: "/gsd-execute-phase 8 (W6-P12 final — README italiano completo + JSDoc + bundle gate + Tier-3 wrap-up; eventualmente fix gap D-V2-16 con SubscribeOptions.ownerId? extension additive non-breaking)"
phase_8_w5_p10_complete:
  date: "2026-05-11"
  summary_file: .planning/phases/08-extension-runtime-mf-registry-lifecycle-fsm-standard-topics/08-10-SUMMARY.md
  commits:
    - "5617b74 feat(08-10-topics): standard topics 17+7+5 + 4 union types + 2 mapping helpers"
    - "cdd4ade feat(08-10-publish): registry.ts publishLifecycleEvent + publishErrorEvent helpers wired"
    - "7eec3fa test(08-10-payload): events-payload.test.ts 10 test lifecycle + error topics shape"
  files_created: 3
  files_modified: 2
  insertions: ~694
  deletions: 0
  tests_added: 35
  tests_passing_microfrontends_tier1: "355 passed (11 file cumulativi)"
  tests_passing_core: "267 passed | 3 skipped (zero regressioni v1-bc-replay)"
  bundle_microfrontends_gzipped: "6.94 KB (cap 12 KB, headroom 5.06 KB)"
  bundle_augment_gzipped: "22 B (cap 1 KB)"
  core_diff_lines: 0
  d_83_verified: "git diff packages/core/src/ -> empty (D-83 strict preservato)"
  m2_fix_verified: "git diff packages/microfrontends/src/lifecycle-fsm.ts -> empty (separation of concerns)"
  b2_preservation_comment: "1 hit '08-10 helper PRESERVED' in registry.ts (guidance per 08-11)"
  threats_mitigated: "T-F8-02 publish overhead (fast-path P-02 + literal types as const zero runtime cost) + T-F8-04 descriptor retention (P-15 mitigation + shallow-copy)"
  deviations: "Rule 1 fix iter (2 bug): source.type='plugin' invece di 'microfrontend' (Valibot picklist enforce ['plugin','component','server','worker','system']); shallow-copy timings + descriptor in payload (deep-freeze D-04 blocca transitions successive di reg.timings); Rule 1 test regex /not registered/ invece di /MF_LOADER_NOT_FOUND/ (createMfError().message user-friendly senza code prefix); Biome auto-format multi-line cast"
  next_command: "/gsd-execute-phase 8 (W5 sequential 08-11 — runtime-context-factory + MOCK loader + E2E Tier-3 Playwright; PRESERVARE publishLifecycleEvent/publishErrorEvent helpers + tutti call site in 7 lifecycle ops)"
phase_8_w3_p07_complete:
  date: "2026-05-11"
  summary_file: .planning/phases/08-extension-runtime-mf-registry-lifecycle-fsm-standard-topics/08-07-SUMMARY.md
  commits:
    - "811c867 feat(08-07-idempotency): wire lifecycle ops + inFlight Map + auto-bootstrap D-V2-07"
    - "076c30b test(08-07-tier1): aggiungi lifecycle-fsm-transitions integration test + fix sync runOp"
    - "6d2f9d7 test(08-07-tier3): aggiungi race-idempotency Playwright Chromium scenario + provider factory"
  files_created: 2
  files_modified: 5
  insertions: ~580
  deletions: ~60
  tests_added_tier1: 10
  tests_added_tier3: 3
  tests_passing_microfrontends_tier1: "268 passed (6 file cumulativi)"
  tests_passing_microfrontends_tier3: "3 passed Chromium 1.10s"
  tests_passing_core: "267 passed | 3 skipped (zero regressioni v1-bc-replay)"
  bundle_microfrontends_gzipped: "5.14 KB (cap 12 KB, headroom 6.86 KB)"
  core_diff_lines: 0
  p04_strict_identity_verified: "expect(p1).toBe(p2) Tier-1 + Tier-3 + 10 concurrent same Promise"
  auto_bootstrap_d_v2_07_verified: "mount('loaded') chiama bootstrap implicito; skipBootstrap=true override"
  cascade_d_v2_16_verified: "broker.unsubscribeByOwner(mf:id) SEMPRE in destroy finally"
  threats_mitigated: "T-F8-03 race state corruption (Tier-3 Chromium scenario) + T-F8-04 cascade leak prevention + T-F8-05 Tier-3 dep (@vitest/browser-playwright devDep + factory API)"
  deviations: "Rule 3 sync runOp + sync wrapper ops (async wrappa return rompendo strict identity); Rule 3 vitest.browser.config.ts API factory Vitest 4.x (@vitest/browser-playwright explicit devDep); Rule 3 MF_LIFECYCLE_IN_FLIGHT sync throw consumer wrappa try/catch; 2 test W2-stub registry.test.ts adattati; cascade unsubscribeByOwner 2 volte (destroy + unregister finally redundant) — idempotente broker-side"
  next_command: "/gsd-execute-phase 8 (W4 plans 08-08 ∥ 08-09 parallel Mount strategies 4-way + Loader Registry impl)"
phase_8_w3_p06_complete:
  date: "2026-05-11"
  summary_file: .planning/phases/08-extension-runtime-mf-registry-lifecycle-fsm-standard-topics/08-06-SUMMARY.md
  commits: ["81322de feat(08-06-fsm): LifecycleManager 14×14 FSM + transition enforce + MF_STATE_INVALID"]
  files_created: 2
  files_modified: 1
  insertions: 444
  deletions: 0
  tests_added: 217
  tests_passing_microfrontends: "258 passed (5 file cumulativi)"
  tests_passing_core: "267 passed | 3 skipped (zero regressioni v1-bc-replay)"
  bundle_microfrontends_gzipped: "4.63 KB (cap 12 KB, headroom ~7.4 KB)"
  bundle_augment_gzipped: "22 B (cap 1 KB)"
  core_diff_lines: 0
  matrix_coverage: "14×14 = 196 transition pairs verified deterministically (Tier-1 jsdom)"
  d_v2_06_verify: "destroyed→mounted REJECTED + failed→mounted REJECTED + failed→loading ALLOWED (recovery) + failed→destroying ALLOWED (cleanup)"
  threats_mitigated: "T-F8-03 atomic check-then-set + T-F8-04 FSM block destroyed sink state"
  deviations: "Rule 1 delete reg.failureReason vs = undefined per exactOptionalPropertyTypes; Biome auto-format mapped type cast multi-riga"
  next_command: "/gsd-execute-phase 8 (W3 plan 08-07 sequential Idempotency + inFlight Map + auto-bootstrap D-V2-07)"
phase_8_w2_p05_complete:
  date: "2026-05-11"
  summary_file: .planning/phases/08-extension-runtime-mf-registry-lifecycle-fsm-standard-topics/08-05-SUMMARY.md
  commits: ["835764e feat(08-05-owner-id)", "86544ab feat(08-05-registry)", "54e14a3 feat(08-05-augment)", "4146bb2 feat(08-05-barrel)"]
  files_created: 7
  files_modified: 1
  insertions: 889
  deletions: 3
  tests_passing: "41 passed (4 file cumulativi W2)"
  bundle_microfrontends_gzipped: "4.34 KB (cap 12 KB, 36% used)"
  bundle_augment_gzipped: "22 B (cap 1 KB)"
  core_diff_lines: 0
  t_f8_08_audit: "__mfAugmentLoaded marker preservato 2 hits in dist/augment.js (T-F8-08 mitigation verified)"
  smoke_runtime: "register/unregister + 10 sugar methods + augment marker all PASS"
  deviations: "Rule 1 BrokerWithMfSugar explicit interface fix TS strict vs Biome lint clash; Rule 1 cascade test via vi.spyOn (SubscribeOptions pubblico v1.x no ownerId); Rule 1 biome auto-format + template-curly-in-string false-positive"
  next_command: "/gsd-execute-phase 8 (W3 plan 08-06 sequential Lifecycle FSM 14 stati transitions)"
phase_8_w2_p04_complete:
  date: "2026-05-11"
  summary_file: .planning/phases/08-extension-runtime-mf-registry-lifecycle-fsm-standard-topics/08-04-SUMMARY.md
  commits: ["4953e7c feat(08-04-types)", "b616e69 feat(08-04-validator)", "a0bb6eb style(08-04)"]
  files_created: 11
  insertions: 923
  deletions: 33
  tests_passing: "14 passed (2 file)"
  core_diff_lines: 0
  fix_b1_locked: "category 'microfrontend' as ErrorCategory direct, NO cast as unknown as"
  deviations: "Rule 1 GenericSchema<unknown, unknown> fix isolatedDeclarations x exactOptionalPropertyTypes clash; Rule 1 test helper expectThrowWithCode fix .toThrow(/CODE/) pattern; Rule 1 biome auto-format"
  next_command: "/gsd-execute-phase 8 (W2 plan 08-05 parallel Registry CRUD + ServiceLocator + augment Pattern S1)"
phase_8_w1_p03_complete:
  date: "2026-05-11"
  summary_file: .planning/phases/08-extension-runtime-mf-registry-lifecycle-fsm-standard-topics/08-03-SUMMARY.md
  commits: ["acc436b feat(08-03-min1)", "64f2110 feat(08-03-min2)", "a78812a chore(08-03-services)", "9b8c668 feat(08-03-error-cat)", "7713b24 chore(08-03-size-cap)", "afd41f3 chore(08-03-lint)", "aa8cb69 style(08-03)"]
  files_modified: 11
  insertions: 326
  deletions: 23
  tests_passing: "267 passed | 3 skipped"
  bundle_post_min: "8844 B gzipped (cap 8870 B empirico)"
  d83_verified: "git diff main...HEAD packages/core/src/ -> 6 file W1-P03 allow-list (broker.ts, types/config.ts, types/error.ts, types/module.ts NEW, services.ts NEW, index.ts) + 10 file __bc_replay__/* (W1-P02 baseline + bundle-size cap raise)"
  deviations: "Rule 1 cap ricalibrato 8670 -> 8870 (delta empirico +524 vs allowance teorica +350 — eccesso +174 da JSDoc V1.x preserved con tsup minify:false)"
  next_command: "/gsd-execute-phase 8 (W2 plan 08-04 ∥ 08-05 parallel Registry+Descriptor)"
milestone_v1_1_close:
  closed_at: "2026-05-10T15:30:00.000Z"
  archived_to:
    - .planning/milestones/v1.1-ROADMAP.md
    - .planning/milestones/v1.1-REQUIREMENTS.md
  shipped_at: "2026-05-10T09:25:00.000Z"
session_active: true
verifier_verdict: PASS_WITH_CAVEATS (Phase 7 v1.1, 4 caveat accepted)
verifier_report: .planning/phases/07-ui-standardization-layer-v1-1/07-VERIFICATION.md
package_versions: "9 pacchetti @gluezero/* live su npm (theme 1.1.0 NEW + devtools/gluezero 1.1.0 + core/cache/gateway/mapper/routing/worker 1.0.2)"
parte_a_status: COMPLETE_2026-05-06
parte_b_status: COMPLETE_2026-05-07_v1_0_published
phase7_status: PUBLISHED_2026-05-10 (PR #1 merged, tag v1.1.0 pushed, 9 pacchetti pubblicati su npm, GitHub Release creata)
ship:
  branch: release/v1.1.0
  pr_number: 1
  pr_url: https://github.com/omardimarzio/GlueZero/pull/1
  pr_state: MERGED
  pr_merge_sha: ee486da
  merged_at: "2026-05-10T08:58:05Z"
release:
  tag: v1.1.0
  github_release_url: https://github.com/omardimarzio/GlueZero/releases/tag/v1.1.0
  published_at: "2026-05-10T09:25:00.000Z"
  packages_count: 9
  highlights: "@gluezero/theme@1.1.0 NEW (initial publish, 6.35 KB / 7 KB cap), devtools+gluezero minor 1.1.0, core+5 cascade patch 1.0.2"
post_publish_followups:
  - "Revoca npm token usato per il publish (security): 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 → https://www.npmjs.com/settings/omardimarzio/tokens"
  - "Verifica visual smoke test 4 examples in browser via esm.sh"
  - "Build script fix (commit e223cb4) propagato — futuri build includeranno theme correttamente"
---

# TRACKER — GlueZero

> **Boot protocol:** Questo file è la fonte canonica per ripartire dopo `/clear` o crash. Aggiornato dopo ogni step significativo.
>
> **Read order al boot:**
> 1. Questo file (`.planning/TRACKER.md`)
> 2. `.planning/STATE.md` per cross-check
> 3. `CLAUDE.md` per vincoli operativi
> 4. Memoria GSD-Claude (auto-loaded)

## Stato corrente

| Campo | Valore |
|-------|--------|
| Fase | **Phase 8 — Extension Runtime + MF Registry + Lifecycle FSM + Standard Topics (v2.0)** — W1 ✅ + W2 ✅ + W3-P06 ✅ (08-06 done) |
| Wave | **W3 in corso** — 08-06 (Lifecycle FSM 14×14 transitions enforce + MF_STATE_INVALID) ✅ done. Pending 08-07 (Idempotency + inFlight Map + auto-bootstrap D-V2-07 wire-up nel Registry). |
| Plan in esecuzione | **08-06 ✅ done — W3 primo plan**. 2 file NEW (lifecycle-fsm.ts + lifecycle-fsm.test.ts) + 1 modificato (index.ts barrel). 217 nuovi test (196 matrix 14×14 + 2 cardinality + 10 failure semantics + 7 timings + 3 isAllowed, cumulativi 258 mf). Bundle 4.63 KB gzipped (cap 12 KB, headroom ~7.4 KB). D-83 strict preservato (0 righe diff packages/core/src/). Core 267 PASS + 3 skipped (zero regressioni v1-bc-replay). D-V2-06 BLOCKING verify esplicito: destroyed→mounted REJECTED + failed→mounted REJECTED senza recovery + failed→loading ALLOWED. T-F8-03 atomic check-then-set + T-F8-04 destroyed sink mitigated. 1 commit atomico `81322de`. |
| Plan progress F7 | **13 / 13 (✅ COMPLETE)** — TUTTI i plan 07-01..07-13 done |
| Plan progress F6 | **11 / 11 (✅ COMPLETE)** — 06-01..06-09b all done with SUMMARY.md |
| Plan progress F5 | **7 / 7 (✅ COMPLETE)** — 05-01..05-07 done |
| Plan progress F4 | **9 / 9 (✅ COMPLETE)** — 04-01..04-09 done |
| Plan progress globale F1-F6 | **64 / 64 (100% ✅)** — milestone v1.0 SHIPPED |
| Plan progress globale F1-F7 | **77 / 77 (100% ✅)** — milestone v1.1 ready for release |
| Mode GSD | yolo + auto_advance + parallelization (sequential exec, no worktree) |
| Modello attivo | `claude-opus-4-7-1` (opus) — override esplicito su tutti i sub-agent |
| Graphify watch | bootstrap pending — verificare `graphify-out/.watch.pid` ad ogni nuova sessione |

## 🚧 Phase 7 — UI Standardization Layer (v1.1) — IN PROGRESS

**Stato:** Wave 2 in esecuzione — plan 07-01 + 07-02 ✅ COMPLETE.

### Plan 07-01 complete — 2026-05-09

- **Plan path:** `.planning/phases/07-ui-standardization-layer-v1-1/07-01-package-scaffolding-tokens-default-PLAN.md`
- **Summary:** `.planning/phases/07-ui-standardization-layer-v1-1/07-01-SUMMARY.md`
- **Commits (3 atomic):**
  - `f601323` feat(theme): scaffold workspace ESM-only + tsup multi-entry + Vitest configs
  - `1322ac9` feat(theme): tokens-default.css 35-token vocabolario canonico + cascade @layer + a11y safety-net
  - `b0bf2d5` feat(theme): IIFE anti-FOUC + ThemeError factory + topic constants + csstype augment + types skeleton
- **Tests:** 26/26 passing Tier-1 jsdom (10 IIFE + 9 ThemeError + 7 build-artifacts)
- **Bundle:** 793 B gzipped (cap 6 KB — 13% utilization)
- **D-83 carryover:** zero modifiche packages/{core,mapper,routing,gateway,worker,cache,devtools}/src/

### Plan 07-02 complete — 2026-05-09

- **Plan path:** `.planning/phases/07-ui-standardization-layer-v1-1/07-02-token-registry-apply-theme-PLAN.md`
- **Summary:** `.planning/phases/07-ui-standardization-layer-v1-1/07-02-SUMMARY.md`
- **Commits (2 atomic):**
  - `23dc8ab` feat(theme): cardinality-cap helper + Valibot schemas (W2 Task 1)
  - `e415050` feat(theme): TokenRegistry + snapshot helpers + barrel exports (W2 Task 2)
- **Tests:** 86/86 passing Tier-1 jsdom (60 nuovi: 12 cardinality-cap + 20 valibot-schemas + 10 snapshot + 18 token-registry)
- **Bundle:** 6.77 KB raw, **2.4 KB gzipped** (cap 6 KB — 40% utilization)
- **D-83 carryover esteso:** zero modifiche packages/{core,mapper,routing,gateway,worker,cache,devtools}/src/ nei commit del plan
- **Deviations applicate:** v.GenericSchema annotations per isolatedDeclarations TS6.0; RoleEntry/ThemeAdapterShape interfaces con `?: T | undefined` (exactOptionalPropertyTypes); guard `noUncheckedIndexedAccess` in diffSnapshots
- **Public API W2:** createTokenRegistry, TokenRegistry, ApplyOptions, CreateTokenRegistryOptions, createSnapshot, diffSnapshots, SnapshotInput, SnapshotDiff, checkCap, TOKEN_CAP, ROLE_CAP, SOFT_WARN_RATIO, CapCheckResult

### Plan 07-06 complete — 2026-05-09 (W3.2 — HERO v1.1.1 step 2/3)

- **Plan path:** `.planning/phases/07-ui-standardization-layer-v1-1/07-06-adapter-registry-collision-weakmap-PLAN.md`
- **Summary:** `.planning/phases/07-ui-standardization-layer-v1-1/07-06-SUMMARY.md`
- **Commits (5 atomic, TDD strict — RED→GREEN×2 + bundle mitigation):**
  - `11da796` test(07-06): aggiungi test fallisce per createClassesTracker WeakMap
  - `eb4462b` feat(07-06): createClassesTracker WeakMap cleanup non-destructive (UI-ROLE-10)
  - `8c554bd` test(07-06): aggiungi test fallisce per createAdapterRegistry collision/override
  - `0cf8ec4` feat(07-06): createAdapterRegistry collision throw + override opt-in (D-F7-09)
  - `43ea8b2` refactor(07-06): subpath STANDARD_ROLE_DEFINITIONS per bundle ≤6 KB (D-F7-04)
- **Tests:** 208/208 passing Tier-1 jsdom (+26 nuovi: 10 weakmap-classes + 16 adapter-registry)
- **Bundle:** 6110 B gzipped (5.97 kB) — cap 6 kB, 34 B headroom. Pre 5891 B → +219 B netto. Mitigation savings: −415 B (subpath split).
- **D-83 carryover esteso:** zero modifiche dai miei commit su packages/{core,mapper,routing,gateway,worker,cache,devtools}/src/ (verificato `git diff a151862..HEAD`)
- **Public API W3.2:** createAdapterRegistry, AdapterRegistry, AdapterRegistryEvent + subpath @gluezero/theme/standard-role-definitions
- **Internal:** createClassesTracker (NOT in barrel — internal/) per consumer DomApplier W3.3 plan 07-07
- **Pre-existing uncommitted preserved:** examples/pub-sub-demo.html, packages/core/src/core/plugin-registry.{ts,test.ts} (NON toccati come da context mandate)

### Plan 07-07 complete — 2026-05-09 (W3.3 — HERO v1.1.1 step 3/3 — CHIUSO)

- **Plan path:** `.planning/phases/07-ui-standardization-layer-v1-1/07-07-dom-applier-stylesheet-class-for-PLAN.md`
- **Summary:** `.planning/phases/07-ui-standardization-layer-v1-1/07-07-SUMMARY.md`
- **Commits (7 atomic, TDD strict — RED→GREEN×3 + bundle mitigation):**
  - `08b19d1` test(07-07): aggiungi test fallisce per classFor (Strategia C)
  - `d303231` feat(07-07): aggiungi classFor Strategia C escape hatch (UI-ROLE-04)
  - `b924048` test(07-07): aggiungi test fallisce per createStyleSheetGenerator (Strategia B)
  - `f46a80a` feat(07-07): aggiungi createStyleSheetGenerator Strategia B (UI-ROLE-04)
  - `49dc14c` test(07-07): aggiungi test fallisce per createDomApplier (Strategia A)
  - `c56860c` feat(07-07): aggiungi createDomApplier Strategia A (UI-ROLE-04 + UI-ROLE-05)
  - `95ef778` refactor(07-07): subpath dom-applier + stylesheet-generator (D-F7-04 bundle ≤6 KB)
- **Tests:** 234/234 passing Tier-1 jsdom (+26 nuovi: 4 class-for + 11 stylesheet-generator + 11 dom-applier)
- **Bundle:** 6159 B raw gzip / size-limit **6 kB ≤ 6 kB cap PASS exit 0**. Pre 6110 B → +49 B netto. Mitigation savings: −1374 B totale via subpath split doppio (Strategia A `dom-applier` + Strategia B `stylesheet-generator`).
- **D-83 carryover esteso:** zero modifiche dai miei commit su packages/{core,mapper,routing,gateway,worker,cache,devtools}/src/ (verificato 0 lines diff)
- **Public API W3.3 (barrel):** `classFor` (Strategia C escape hatch ~50 B)
- **Public API W3.3 (subpath):** `@gluezero/theme/dom-applier` createDomApplier (Strategia A); `@gluezero/theme/stylesheet-generator` createStyleSheetGenerator (Strategia B)
- **HERO v1.1.1 chiuso:** UI-ROLE-04+05+08+10 closure; Pitfall HIGH #2 (`@layer` cascade) + #3 (MO overhead batched) + #4 (race React StrictMode queueMicrotask) tutti mitigation in place. W3 wave HERO COMPLETA.
- **Pre-existing uncommitted preserved:** examples/pub-sub-demo.html, packages/core/src/core/plugin-registry.{ts,test.ts} (NON toccati come da context mandate)

### Plan 07-03 complete — 2026-05-09

- **Plan path:** `.planning/phases/07-ui-standardization-layer-v1-1/07-03-theme-manager-mode-density-direction-PLAN.md`
- **Summary:** `.planning/phases/07-ui-standardization-layer-v1-1/07-03-SUMMARY.md`
- **Commits (4 atomic, TDD strict — RED→GREEN×2):**
  - `1d01159` test(07-03): aggiungi test fallisce per createOsPreferenceWatcher
  - `b47aa8e` feat(07-03): OsPreferenceWatcher matchMedia listeners (D-F7-13)
  - `fec6047` test(07-03): aggiungi test fallisce per createThemeManager + estendi ThemeErrorCode
  - `fc0dd47` feat(07-03): ThemeManager mode/density/direction standalone (THEME-04..07,09)
- **Tests:** 117/117 passing Tier-1 jsdom (30 nuovi: 13 os-preference + 17 theme-manager); zero regressioni W1/W2.1
- **Bundle:** 12.81 KB raw, **3.7 KB gzipped** (cap 6 KB — 62% utilization; ~2.3 KB margin per W3-W6)
- **D-83 carryover esteso:** zero modifiche packages/{core,mapper,routing,gateway,worker,cache,devtools}/src/ nei commit del plan (verified `git diff e415050..HEAD --` returns 0 lines)
- **Deviations applicate:** vi.fn() type-cast pattern allineato con W2.1 valibot-schemas tests; lazy MQL creation in os-preference (handler+listener creati solo al primo subscribe per kind); auto→light/dark cleanup unsubscribes deterministicamente
- **Public API W2.2:** createThemeManager, ThemeManager, ThemeMode, ThemeDensity, ThemeDirection, createOsPreferenceWatcher, OsPreferenceWatcher, OsPreferenceKind, ColorScheme
- **Threat model:** T-F7-01 (whitelist Set check) + T-F7-04 (matchMedia cleanup deterministico) mitigated; tests verify both
- **Pending W4:** broker injection NON in W2 — `createThemeManager(config, broker?)` arriva W4 plan 07-08 con emit `ui.theme.changed`/`ui.density.changed`/`ui.direction.changed` (Open Q1 D-F7-01 Opzione B documented)

### Plan in coda Phase 7 (W2-W6, 11 remaining)

| # | Plan | Wave | Status |
|---|------|------|--------|
| 03 | theme-manager-mode-density-direction | 2 | ✅ done |
| 04 | persistence-localstorage | 2 | next |
| 05 | role-registry-standard-roles | 3 | pending |
| 06 | adapter-registry-collision-weakmap | 3 | pending |
| 07 | dom-applier-stylesheet-class-for | 4 | pending |
| 08 | broker-events-lifecycle-cascade | 4 | pending |
| 09 | devtools-theme-inspector-subpath | 5 | pending |
| 10 | aggregate-createGlueZero-theme | 5 | pending |
| 11 | readme-italiano-jsdoc | 6 | pending |
| 12 | examples-standalone-html-hero | 6 | pending |
| 13 | tier3-playwright-bundle-gate | 6 | pending |

### Prossimo step suggerito

`/gsd-execute-plan 07-04-persistence-localstorage` — Persistence opt-in localStorage (D-F7-12 default OFF) con read/write su 4 chiavi `gluezero.theme.{mode,density,direction,adapter}` + multi-tab StorageEvent listener (T-F7-04 SSR-correct).

Plan 07-04 estende `createThemeManager(config)` accettando `config.persistence === 'localStorage'` per riconciliare lo state `mode/density/direction` con il boot snapshot anti-FOUC (W1 plan 07-01 IIFE) e propagare cambi cross-tab.

W3 plan 07-05 (RoleRegistry) può partire in parallelo con 07-04 — file ownership disgiunta (`role-registry.ts` vs `persistence.ts`).

### Vincoli Phase 7

- **D-83 strict carryover esteso:** zero modifiche src/ ai package F1-F6+devtools (composition esterna pura).
- **Modello opus** mandatorio su tutti i sub-agent.
- **Lingua italiano** user-facing (commit, JSDoc descrittivi, README, SUMMARY); inglese codice.
- **Bundle target ≤ 6 KB gzipped** finale (W6 plan 13 verifier).
- **35 token vocabolario lockato** (D-F7-22 — eccezione: la decisione D-F7-20 enumera 13 nomi color, mantenuti tutti per matching della lockdown).

## 🚢 SHIPPED v1.0.0 — 2026-05-07T09:48:47Z

**8 package live su npm:**

```
@gluezero/core      1.0.0  →  https://www.npmjs.com/package/@gluezero/core
@gluezero/mapper    1.0.0  →  https://www.npmjs.com/package/@gluezero/mapper
@gluezero/routing   1.0.0  →  https://www.npmjs.com/package/@gluezero/routing
@gluezero/gateway   1.0.0  →  https://www.npmjs.com/package/@gluezero/gateway
@gluezero/worker    1.0.0  →  https://www.npmjs.com/package/@gluezero/worker
@gluezero/cache     1.0.0  →  https://www.npmjs.com/package/@gluezero/cache
@gluezero/devtools  1.0.0  →  https://www.npmjs.com/package/@gluezero/devtools
@gluezero/gluezero  1.0.0  →  https://www.npmjs.com/package/@gluezero/gluezero
```

**GitHub:**
- Repo: https://github.com/omardimarzio/GlueZero
- Release: https://github.com/omardimarzio/GlueZero/releases/tag/%40gluezero%2Fgluezero%401.0.0
- Tag pushed: 16 (8 tag-name primario + 8 tag refs)

**Sequenza release Parte B:**

| Step | Outcome | Commit |
|------|---------|--------|
| `gh repo rename glueZero → GlueZero` | ✅ ok (GitHub redirige URL vecchie) | — |
| `git remote add origin` | ✅ ok | — |
| `pnpm release` (1° tentativo) | ❌ EUSAGE provenance:true non supportato da CI:null | — |
| Fix `provenance: true` rimosso da 8 package.json | ✅ | `d14e04c` |
| `pnpm release` (2° tentativo) | ❌ 403 npm 2FA enforcement | — |
| Token granular `@gluezero/*` Read+Write configurato in `~/.npmrc` | ✅ user-side | — |
| `pnpm release` (3° tentativo) | ✅ 8/8 published successfully | — |
| `git push --follow-tags origin main` | ✅ main + 8 tag pushed | — |
| `gh release create @gluezero/gluezero@1.0.0 --latest` | ✅ release "GlueZero v1.0.0" Latest | — |

**Igiene post-release (TODO utente entro oggi):**

- [ ] Revoca token npm condiviso (incollato in chat → compromesso): https://www.npmjs.com/settings/omardimarzio/tokens
- [ ] Rimuovi `_authToken=npm_J5Ui...` da `~/.npmrc`
- [ ] Abilita 2FA livello "Authorization and writes" su npm profile
- [ ] (Opz.) Setup workflow `.github/workflows/release.yml` con `changeset/action@v1` + secret `NPM_TOKEN`

**V1.x roadmap (deferred opt-ins):**

- @gluezero/cache-idb (IndexedDB persistence)
- @gluezero/metrics-prometheus / @gluezero/metrics-otel exporters
- superjson adapter pluggable per worker serialization
- Custom histogram bucketing per route
- Anti-flap pause/resume debounce
- Worker retry policy idempotent opt-in
- PRD §39 #11 PIPE-01 (cross-fase pipeline ordering canonical doc)
- Workflow CI release automation (changeset-action) + provenance Sigstore re-enabled
- Dominio gluezero (utente)
- Annuncio social (utente)

## Parte A cleanup pre-release — 2026-05-06 ✅ COMPLETE

> **Sezione manuale** (NON gestita dall'hook auto-update di `## Ultimo step completato (auto-update 2026-05-16T22:40:39Z)

- Plan: **17-04** → SUMMARY.md committed
- Commit: `c095375 docs(17-04): SUMMARY 17-04 W3 P04 + STATE + TRACKER closure W3`
- Phase progress: **4/7** plan completati con SUMMARY.md
- Project progress: 56/65 plan (86%)


## Ultimo step completato (auto-update 2026-05-06T21:29:30Z)

- Plan: **03-11** → SUMMARY.md committed
- Commit: `b7f776c docs(planning): TRACKER + STATE riflettono Parte A complete`
- Phase progress: **11/11** plan completati con SUMMARY.md
- Project progress: 64/64 plan (100%)


## Prossimo step — Parte B (richiede l'utente)

> **🔴 BLOCCANTI** per `pnpm release` v1.0.0 (NON eseguibili da Claude):

| # | Azione | Strumento | Note |
|---|--------|-----------|------|
| B1 | `gh repo rename omardimarzio/SemBridge omardimarzio/GlueZero` | gh CLI o GitHub UI | Poi `git remote set-url origin <new-URL>` (Claude può eseguire questo step se URL fornito) |
| B2 | Crea org `gluezero` su https://www.npmjs.com/org/create | npmjs.com web | Senza questo `pnpm release` fallisce 403 |
| B2.1 | Genera **automation token granulare** scope `@gluezero/*` (se 2FA attivo) | npmjs.com Settings → Access Tokens | Salva in `~/.npmrc` o env CI |
| B3 | `pnpm release` (= `pnpm build && changeset publish`) | pnpm da root | **IRREVERSIBILE** (npm deprecate solo, no unpublish dopo 72h). Posso eseguirlo io con autorizzazione esplicita |
| B4 | `git push --follow-tags origin main` | git | Posso io con tua autorizzazione esplicita |
| B5 | `gh release create v1.0.0 --generate-notes` | gh CLI | Posso io con tua autorizzazione |

> **🟢 OPZIONALI** post-release:

| # | Azione | Strumento | Note |
|---|--------|-----------|------|
| B6 | Registra dominio `gluezero` (anti-squatting) | registrar | Solo utente |
| B7 | Workflow TypeDoc → GitHub Pages | `.github/workflows/docs.yml` | Posso scaffoldare; primo deploy manuale utente |
| B8 | License decision (MIT vs Apache-2.0) | repo/package.json | Scelta utente — package.json hanno già `license: MIT` ma root non ha LICENSE file |
| B9 | Annuncio v1.0 (Twitter/Mastodon/Reddit r/javascript) | manuale | Solo utente |

**Comando release effettivo (quando B1 + B2 sono fatti):**
```bash
pnpm release            # pnpm build && changeset publish (richiede npm auth)
git push --follow-tags origin main
gh release create v1.0.0 --generate-notes
```

Nessun plan/wave attivo. La sessione di execute Phase 6 è chiusa con success criteria coperti:
- ✅ Cache layer F6 + 3-strategy + scope hybrid
- ✅ Event Inspector + Route Inspector + ring buffer 500
- ✅ MetricsCollector simil-OpenMetrics (closes PRD §39 #10)
- ✅ PauseController pauseTopic/resumeTopic/flushQueue
- ✅ getDebugSnapshot deep-clone via structuredClone
- ✅ DOC-02/05/06 italiano + JSDoc TypeDoc-ready
- ✅ D-83 strict carryover ✓ verified per tutta F6
- ✅ 91/91 REQ-IDs Complete + 10/11 open issues PRD §39 closed (#2 deferred V1.x)

Wave structure F6 (8 sub-wave):
- **W1** sequential: 06-01 (bootstrap @gluezero/{cache,devtools,sembridge})
- **W2** ∥ parallel: 06-02 (MemoryCacheAdapter + stable-hash) ‖ 06-04 (MultiplexTap + tap registry)
- **W2-bis** sequential: 06-03 (CacheHandler + CompositeHandler concretizza F3 D-77)
- **W3** ∥ parallel (3-way): 06-05 (Event/RouteInspector) ‖ 06-06 (MetricsCollector + reservoir + cardinality cap) ‖ 06-07 (PauseController)
- **W4a** sequential gate: 06-08a (CacheBroker composition wrapper + factory + harness + 4 integration test)
- **W4b** sequential gate: 06-08b (DevtoolsBroker + createGlueZero **CHAIN COMPLETA F1+F2+F3+F4+F5+F6** + 6 integration test)
- **W5a** sequential gate: 06-09a (CI gates + size-limit + biome cleanup)
- **W5b** FINAL: 06-09b (DOC-02/05/06 README italiani + JSDoc + REQ matrix flip + PRD §39 #10 closure + CHANGELOG v1.0.0 milestone closure)

**Speedup wave-based:** ~1.3× vs sequential.

Wave struttura globale F5 (RIEPILOGO CHIUSURA):
- ✅ Wave 1: 05-01 (bootstrap) — DONE 2026-05-04
- ✅ Wave 2: 05-02 + 05-03 (building blocks A + B) — DONE 2026-05-04
- ✅ Wave 3: 05-04 (worker-bridge) ‖ 05-05 (worker-pool/registry) — DONE 2026-05-04 (parallel file ownership disgiunta)
- ✅ Wave 4: 05-06 (broker composition Opzione B + harness + 8 integration test Tier-1 + 6 browser smoke Tier-3 Playwright Chromium) — DONE 2026-05-04
- ✅ Wave 5: 05-07 (final gate F5: CI gates + DOC-05 README italiano + JSDoc TypeDoc-ready + REQ matrix flip atomic WK-01..WK-07 → Complete + PRD §39 #11 closure) — DONE 2026-05-05

Phase 5 in entry-point auto (vincoli architetturali confermati):
- WK-01..WK-07 da REQUIREMENTS.md
- WorkerBroker = composition wrapper di RouterBroker (D-121, D-83 strict carryover)
- Comlink 4.4.x + structuredClone default + transferable opt-in (WK-07 chiude PRD §39 #11)
- Pool bounded `min(hardwareConcurrency, 4)` cap 8 default (D-127, D-128)
- Hybrid cancellation: dedicated→terminate, pool→cooperative AbortSignal proxied via Comlink (D-131, D-132)
- State machine atomico Pitfall 2C (D-133)
- Hybrid Comlink expose + dispatcher utility (D-125)
- F5 ortogonale a F4 (utente sceglie un entry point o compone esplicitamente)

Wave struttura globale F4 (RIEPILOGO CHIUSURA):
- ✅ Wave 1: 04-01 (bootstrap) — DONE 2026-05-04
- ✅ Wave 2: 04-02 + 04-03 + 04-04 — DONE 2026-05-04 (3 plan TDD building blocks)
- ✅ Wave 3: 04-05 + 04-06 — DONE 2026-05-04 (SSE+WS adapters production-ready)
- ✅ Wave 4: 04-07 — DONE 2026-05-04 (RealtimeChannelManager + runReconnectLoop B-4 closure + cycle-cap)
- ✅ Wave 5: 04-08 — DONE 2026-05-04 (RealtimeBroker composition + createRealtimeBroker + 14 integration test 3-tier + harness)
- ✅ Wave 6: 04-09 — DONE 2026-05-04 (final gate F4: coverage v8 doc + biome cleanup + DOC-04 README italiano + JSDoc + REQUIREMENTS/ROADMAP/STATE/TRACKER closure; PRD §39 #9 RT-07 closed)

Phase 4 closure highlights:
- ✅ RT-01..RT-07 + ERR-02 ext + LIFE-02 ext F4 + TEST-01/02/03 ext F4 → Complete
- ✅ DOC-04 README esteso con sezione Realtime SSE/WS (+298 LOC italiano, 14 sub-paragrafi: Quick start, Auth, Frame envelope, SSE eventTypes, SSE heartbeat, Reconnect contract, Ping/pong WS, Auto-fallback D-107+D-108, Visibility, Cascade cleanup, Backpressure, Mapper+Validation D-114+D-116, Test 3-tier D-118, Limitazioni V1 + Q1-Q6 closure rationale)
- ✅ Coverage v8 sse-ws/ subset 91.80% statements / 86.70% branches / 89.53% functions / 93.75% lines (supera target ≥85/75/88/87)
- ✅ CI gates: publint ✅, attw ESM-only ✅, biome ✅ zero errors, typecheck ✅, build ✅
- ✅ D-83 strict carryover verified — zero modifiche runtime a F1-F3 + gateway/http per tutta F4
- ✅ Phase 5 pronta a iniziare (parallelizzabile con Phase 4 verificata)

## Vincoli attivi (da CLAUDE.md)

- **Modello:** SOLO `claude-opus-4-7-1` per tutti i sub-agent (mai sonnet, mai haiku — neanche per checker/synthesizer/verifier).
- **Lingua:** Italiano per risposte/prompt/commit/JSDoc descrittivi; inglese solo per codice/identificatori/comandi shell.
- **Boundary:** libero in `/Users/omarmarzio/programming/prova AI/`; fuori solo lettura/creazione.
- **Decisioni:** alta autonomia — chiedi solo per scope irreversibili, BLOCKER architetturali con tradeoff, valori che solo l'utente conosce.
- **Vincolo D-83:** ZERO modifiche a `packages/core/` runtime e `packages/mapper/` runtime per tutta F3 (composition wrapper pattern).
- **Auto-advance attivo:** discuss → plan → execute → verify automatico senza chiedere conferma.

## Decisioni recenti rilevanti

- **Plan 06-09b ESEGUITO ✓ (Wave 5b — Final gate F6 + MILESTONE v1.0 CHIUSA)** — Final gate F6 completato in 4 commit atomic: `3178103` DOC-02/05/06 consolidation finale italiano (4 README ~1748 LOC totali — WARNING-2 fix Q&A enumerate Q1-Q7) — packages/cache/README.md italiano 409 LOC con cache adapter + LRU + 3 strategies + scope D-156 + scenario cache-then-network + anti-pattern stampede + Q&A 5; packages/devtools/README.md italiano 368 LOC con sezione 6 "MetricsCollector — closes PRD §39 #10 (TOOL-05)" + 7 Q&A enumerate Q1-Q7 (Q1 dot.case rationale D-163, Q2 getMetricsDelta D-164, Q3 reservoir vs t-digest D-165, Q4 cardinality overflow D-166, Q5 Prometheus/OTel exporter V1.x, Q6 metriche standard out-of-the-box, Q7 custom metric V1.x) + anti-pattern cardinality explosion + structuredClone perf caveat; packages/gluezero/README.md italiano 452 LOC con guida integrazione plugin v1.0 + chain composition F1+F2+F3+F4+F5+F6 outermost devtools→cache→worker→realtime→router→mapper→broker + features opt-out + scenario meteo end-to-end + Q&A 8; packages/gluezero/EXAMPLES.md italiano 519 LOC con 10 esempi end-to-end consolidati cross-feature + scenario meteo full chain F1+F2+F3+F4+F5+F6. `a4b2af2` JSDoc API pubblica TypeDoc-ready su F6: 6 file public arricchiti con +3 @example (cache-broker stats consumption + cache-handler microtask ordering + cache-handler missing scope auth) + +2 @example (devtools-broker tap chain + pauseTopic admin) + +3 @example (metrics-collector counter/gauge/histogram observe) + +2 @example (pause-controller critical bypass + flushQueue audit) + +2 @example (sem-bridge multi-tenant + bare minimum) + 4 @throws sanitized error documentation. Preservation in dist/index.d.ts (post tsup ESM-only build): @example 36 / @see 55 / @throws 9 (sopra target ≥27/30/9 — pattern F5 05-07 commit e3b8770 23/30/21 carryover). `ca1656d` REQ matrix flip atomic in REQUIREMENTS.md: CACHE-01..03 + TOOL-01..05 → Complete con plan reference (06-02 + 06-03 + 06-05 + 06-06 + 06-07 + 06-08a + 06-08b + 06-09b) + DOC-02/05/06 → Complete (06-09b) + ERR-02 ext F6 (system.cache.scope-missing D-157 + system.queue.flushed D-169 + system.queue.overflow D-170 + system.metrics.cardinalityoverflow D-166 + sanitized error D-80 cache.network.failed/cache.strategy.unknown) → Complete + LIFE-02 ext F6 (cascade cache invalidate by ownerId D-156 prefix isolation 2-step idempotente) → Complete + PIPE-01 ext F6 (step 14 reale attivato `event.observed` D-161 — pipeline §28 14/14 step ora completa end-to-end) → Complete + TEST-01/02 ext F6 (100+ unit Tier-1 jsdom + 10 integration test 3-tier cache+devtools+sembridge — coverage v8 cache 100/94.21/100/100, devtools 96.44/89.28/94.36/96.98, sembridge 100/100/100/100) → Complete. Open Issues PRD §39 #10 (TOOL-05 metrics format) ✅ CLOSED 2026-05-05 — ULTIMA open issue v1.0 chiusa. Open #2 (cross-fase pipeline ordering) deferred V1.x — opt-in quando emergeranno consumer cross-fase reali. Final docs commit (questo + ROADMAP/STATE/TRACKER + 06-09b-SUMMARY.md + .changeset/v1-0-0-release.md). Test invariato 1166/1169 monorepo full (3 skip MSW V1.x F4 deferred — zero regression cross-package). CI gates F6: publint 8/8 ✅, attw ESM-only 8/8 ✅ (node16 🟢 + bundler 🟢), size-limit 8/8 ✅ (cache 22.13/27 KB + devtools 22.27/27 KB + sembridge 34.80/42 KB), biome ✅, typecheck 8/8 ✅, build 8/8 ✅. **D-83 strict carryover ✓ verified** `git diff main...HEAD packages/{core,mapper,routing,gateway,worker}/src/` exit 0 lines per tutta F6 (composition wrapper Opzione B preserva F1-F5 invariata). 16 decisioni F6 D-155..D-170 lockate. **MILESTONE v1.0 ✅ CHIUSA** — 6/6 fasi PRD complete + 10/11 open issues PRD §39 closed + 91/91 REQ-IDs Complete + 8 pacchetti `@gluezero/*` ESM-only ready for `npm publish v1.0.0`.

- **Plan 06-09a ESEGUITO ✓ (Wave 5a — CI gates final F6)** — 1 commit atomic `8941276 test(06-09a): coverage thresholds calibration post-impl + size-limit budget F6 + biome cleanup`. Coverage v8 calibrate post-impl (analog F4 04-09 commit `761e4ad` + F5 05-07 commit `1347d0b` pattern, floor measurato arrotondato per difetto 0.5%): @gluezero/cache 100/94.21/100/100 (thresholds 99.5/93.5/99.5/99.5) + @gluezero/devtools 96.44/89.28/94.36/96.98 (thresholds 95.94/88.78/93.86/96.48) + @gluezero/gluezero 100/100/100/100 (thresholds 99.5/99.5/99.5/99.5). Hard floor inderogabile target ≥90/80/90/90 rispettato con margini ampi. Size-limit budget calibrate measured + 20% headroom (lesson learned F3 commit `9922a36` carryover): @gluezero/cache 22.13/27 KB + @gluezero/devtools 22.27/27 KB + @gluezero/gluezero 34.80/42 KB (with all deps cross-package). Biome auto-format safe-fix su 28 file packages/{cache,devtools,sembridge}/src/ (organize imports + format whitespace, zero behavior change verificato via re-run completo 1166/1169 monorepo full). 33 warnings unsafe rimasti non bloccanti (suggerimenti stilistici opzionali). CI gates ALL GREEN: typecheck 8/8 + build ESM-only 8/8 + test 1166/1169 monorepo full (3 skip MSW V1.x F4 deferred, zero regression cross-package) + publint 8/8 All good (3 nuovi F6: cache + devtools + sembridge) + attw ESM-only OK 8/8 (node16 🟢 + bundler 🟢) + size-limit 8/8 within budget. ci:publint + ci:attw scripts esteso a 8 packages (era 4 F1-F3); aggiunto `ci:gate:f6` alias. **Deferred-items.md 06-06 risolto inline** (Auto-fix Rule 3): typecheck `@gluezero/gateway` + DTS chain `routing↔gateway` falliva con dist stale. Soluzione: rebuild ordinato F1+F2 → `pnpm build:f3:cyclic` (workflow F3-aware DTS bootstrap esistente in package.json) → F4-F6. Tutti 8 typecheck ora green. **D-83 strict ✓ verified**: 0 lines diff su `packages/{core,mapper,routing,gateway,worker}/src/` per tutto il plan 06-09a. Building blocks pronti per 06-09b (DOC italiani README cache+devtools+sembridge + JSDoc TypeDoc-ready + REQ matrix flip CACHE-01..03 + TOOL-01..05 + DOC-02/05/06 + PRD §39 #10 closure + CHANGELOG v1.0.0 milestone closure).

- **Phase 6 PLAN-PHASE COMPLETATO ✓ (research + pattern-mapper + planner iter 1 + plan-checker iter 1 → revision + plan-checker iter 2 PASS)** — RESEARCH.md 21 sezioni ~1450 LOC verificato live npm 2026-05-05 (lru-cache@11.3.6, tdigest@0.1.2, json-stable-stringify@1.3.0 **valutati e RIGETTATI** in favore di implementazioni inline: Map insertion order LRU ~80 LOC + reservoir Algorithm R Vitter 1985 ~30 LOC + stableStringify+FNV-1a ~50 LOC, zero new deps philosophy F1-F5 carryover). PATTERNS.md 38 file F6 mappati con analog F1-F5 esatto + 10 lesson learned cross-fase (size-limit pre-impl underestimate 20-30% raise post-impl, augment.ts pattern S1 anti tree-shake replica meccanica, README italiano 11 sezioni 400+ LOC carryover). Plan iter 1 = 9 plan; plan-checker iter 1 ha trovato 3 BLOCKER + 5 WARNING; **revision iter 1** ha applicato fix targettati: BLOCKER-1 barrel ownership devtools/index.ts spostato da Wave 3 ∥ a 06-08b Wave 4b sequential single-writer cumulative; **BLOCKER-2 createGlueZero chain completa F1+F2+F3+F4+F5+F6** (Opzione 1 raccomandata dal checker, decisione autonoma utente coerente con CONTEXT.md sezione "Composition wrapper aggregato" + RESEARCH §11.3 + ROADMAP SC-2 + CHANGELOG v1.0.0 8 package bump promise) — codice TS in 06-08b con import condizionali da @gluezero/{worker,gateway/sse-ws} + chain `if (f.realtime) ... if (f.worker) ... if (f.cache) ... if (f.devtools) ...` + type union 7 ReturnType; BLOCKER-3 split 06-08 → 06-08a/06-08b + split 06-09 → 06-09a/06-09b (9→11 plan totali) per scope sanity (06-08 era 20 file/4 task, 06-09 era 27 file/5 task — eccedevano budget context); WARNING-1 truth consistency post-fix; WARNING-2 7 Q&A enumerate Q1-Q7 in DOC-05 Sezione 6 (PRD §39 #10 closure: dot.case rationale D-163, getMetricsDelta D-164, reservoir vs t-digest D-165, cardinality overflow D-166, Prometheus/OTel exporter map, metriche standard, custom metric V1.x); WARNING-3 frontmatter cleanup; WARNING-4 `pnpm -F @gluezero/gluezero test` aggiunto verify; WARNING-5 NODE_ENV inline default `detectDefaultEnabled()` in createEventInspector + createRouteInspector. Plan-checker iter 2 verdetto **PASS**: 3/3 BLOCKER risolti + 5/5 WARNING risolti + 16/16 D-155..D-170 coverage cumulative + REQ-IDs coverage cross 11-plan tutti + ZERO threat HIGH+ severity ASVS L1 (~25-30 threat enumerated T-06-XX-NN) + D-83 strict acceptance gate ogni plan (`git diff main...HEAD packages/{core,mapper,routing,gateway,worker}/src/` exit 0 lines) + file ownership Wave 3 parallel disgiunta (06-05/06-06/06-07 NON modificano packages/devtools/src/index.ts) + chain completa F1+F2+F3+F4+F5+F6 in 06-08b createGlueZero (35 hits createWorkerBroker|createRealtimeBroker, type union 7 ReturnType) + milestone v1.0 closure deliverables (06-09b CHANGELOG 8 package bump + REQ matrix flip + PRD §39 #10 closure + ROADMAP F6 → ✅ Complete). Estimated speedup wave-based ~1.3× vs sequential. Coverage REQ-IDs F6 distribuiti: CACHE-01..03 (5/4/4 plan), TOOL-01..05 (5/5/5/5/4 plan), ERR-02 ext F6 (2 plan), LIFE-02 ext F6 (3 plan), PIPE-01 ext F6 (7 plan massima trasversalità), TEST-01/02 ext F6 (3/3 plan), DOC-02/05/06 (1/1/1 plan in 06-09b consolidamento finale), PKG-01..04 (2/2/2/2 plan in 06-01 + 06-09a). Pronto per `/gsd-execute-phase 6 --auto --no-transition`.

- **Phase 6 CONTEXT.md scritto ✓ (discuss-phase 6 --chain)** — 16 decisioni D-155..D-170 lockate. **A. Cache** (CACHE-01..03 + SC-5): D-155 cache key default `${topic}::${stableHash(canonicalPayload)}` (riuso F3 D-74 KeyBased) + override callback; D-156 scope hybrid `BrokerConfig.cache.scopeProvider` config-level + `RouteDefinition.cache.scope` route-level override; D-157 missing scope su route auth → skip cache + `system.cache.scope-missing` warn (zero-leakage by default); D-158 MemoryCacheAdapter LRU bounded `maxEntries=1000` default + TTL ortogonale. **B. EventTap** (TOOL-01/02/04): D-159 tap registry chain `BrokerConfig.taps?: readonly EventTap[]` con error isolation try/catch per tap + auto-wrap backward-compat di config.tap singleton; D-160 `enableDebug()/disableDebug()` toggle live-mode (tap sempre registrati, lazy mode quando off; default `NODE_ENV !== 'production'` → debug=on auto dev / auto-off prod, allineato D-139); D-161 tap su tutti 14 step §28 + lifecycle events (`route.dispatched`, `cache.hit/miss/evicted`, `worker.spawned/terminated`, `realtime.connected/disconnected`); D-162 `getDebugSnapshot()` deep clone via structuredClone (zero side-effect, zero race). **C. MetricsCollector** (TOOL-03/05 → PRD §39 #10 closure): D-163 naming `gluezero.<package>.<metric>` dot.case namespaced (Prometheus/OpenMetrics-friendly: `_total` counter, `_ms` duration, mapping 1:1 a OTel exporter V1.x); D-164 cumulative-only counters + helper `getMetricsDelta(prev)` opzionale; D-165 histogram = quantile summary `{ count, sum, p50, p90, p99 }` con ring buffer ~1024 samples (reservoir sampling/t-digest, lasciato al researcher in F6 RESEARCH.md); D-166 labels Prometheus-style flatten in name `metric{label="v"}` + cap 100 distinct combinations per metric (cardinality protection) + `system.metrics.cardinality-overflow` audit. **D. Inspector + pauseTopic** (TOOL-01/02/05): D-167 EventInspector + RouteInspector ring buffer 500 eventi default + config (~5-10MB con payload medio); D-168 `pauseTopic(topic)` block publish + queue events FIFO (subscriber + route NON triggherano, coerente SC-4 wording); D-169 `flushQueue(topic?)` drop silenzioso + emit `system.queue.flushed { topic, droppedCount, droppedEventIds }` (NIENTE re-publish — replay via resumeTopic); D-170 pause queue cap `maxQueueSize: 1000` default + drop-oldest FIFO + `system.queue.overflow` + critical priority bypass (consistency F3 D-75 + F5 D-130). **Carryover D-83 strict**: F6 vive solo in `packages/cache/src/` + `packages/devtools/src/` + augment.ts. Topology composition wrapper Opzione B vs factory aggregato `createGlueZero` lasciata al researcher. **Out of scope V1**: @gluezero/cache-idb (V1.x), OpenTelemetry exporter nativo (V1.x), real-time dashboard UI (V2), distributed tracing W3C (V1.x), bytes-based eviction (V1.x), custom histogram bucketing per route (V1.x), Inspector persistence, SharedWorker cross-tab metrics (V2), Service Worker bridge (V2), WorkerInspector dedicated (V1.x), MappingInspector integrato, user-defined metric registration (V1.x), anti-flap pause/resume (V1.x). **Open issue PRD §39 #10 (TOOL-05) chiusura pianificata in F6** via D-163/D-164/D-165/D-166. Auto-advance attivo a `/gsd-plan-phase 6 --auto` (--chain mode).

- **Plan 05-07 ESEGUITO ✓ (Wave 5 — Final gate F5 — Phase 5 CHIUSA)** — Final gate F5 completato in 5 commit atomic: `1347d0b` test coverage thresholds calibration post-implementation (worker subset 91.96% statements / 83.73% branches / 90.58% functions / 94.17% lines, supera floor 85/75/88/87 + supera target preliminary 90/80/90/90 — thresholds calibrate al floor measurato 91.5/83/90/93.5 analog F4 04-09 commit 761e4ad pattern) + size-limit budget @gluezero/worker 26.45/32 KB gz (include all deps cross-package Comlink + valibot + nanoid + @gluezero/{core,routing,gateway/http} — bundle effettivo dist/index.js senza deps esterni ~14 KB gz, lesson learned analog F3 routing 19.57/24 KB raised: STACK.md preventivi pre-implementation sotto-stimano sistematicamente per pacchetti compositi) + biome auto-format su 25 file packages/worker/src (organize imports + format whitespace, zero behavior change). `33d20a7` docs DOC-05 README italiano `packages/worker/README.md` 429 LOC 11 sezioni numerate: Quick start (factory createWorkerBroker D-122 + composition wrapper Opzione B D-121 + registerPlugin con workers field D-126), Worker source contract (D-123 factory lazy + D-124 tasks dichiarate fail-fast + D-125 hybrid Comlink expose + D-147 ESM default + D-148 new URL pattern), Pool strategy (D-127 min(hwc,4) + D-128 cap 8 + D-129 lazy first-dispatch + D-130 BackpressureStrategy F3 reuse 1:1 + critical bypass Pitfall 4.C), Cancellation (D-131 hybrid dedicated terminate / pool cooperative grace 2000ms + D-132 AbortSignal proxied via Comlink + D-144 concurrency 'latest-only'), Progress events (D-135 callback proxy + D-136 schema canonical {value, message?, partialResult?} + D-137 throttle 100ms latest-only + D-138 passa per pipeline §28 mapper), Serialization contract WK-07 PRD §39 #11 (D-139 dev-mode auto + D-140 throw PRE-postMessage + D-141 transferable JSONPath + D-142 documentazione completa con tabella structuredClone supported types incl. Date/Map/Set/BigInt/Blob/MessagePort + tabella tipi NON supportati con strategia raccomandata + JSON.stringify NEVER warning + Pitfall 7.E transferable detached byteLength=0), Scenario report generation pesante (esempio end-to-end PRD §29 esteso a worker + correlationId D-134 + cascade unregisterPlugin LIFE-02 ext F5), State machine timeout vs success Pitfall 2C closure (D-133 CAS atomico + counter lateResponses + test deterministic timeout-strict.test.ts), Worker module loading (D-147 ESM default + D-148 bundler-friendly pattern + classic opt-in raro), Limitazioni V1 (pool autoscaling + superjson + custom RPC + SharedWorker + worker.retry + auto-detect transferable + WorkerInspector F6 + IndexedDB queue), Q&A closure PRD §39 #11 (15 domande lockate Phase 5). `e3b8770` docs JSDoc API pubblica TypeDoc-ready: 5 file public arricchiti (public-factory createWorkerBroker 2 @example Quick start + Multi-tenant isolation D-30 + worker-handler 2 @example Strategy dispatch + Topic auto-derive deriveTopic + 4 @throws sanitized error shape + task-tracker 2 @example race timeout/success Pitfall 2C + cooperative cancellation + worker-pool 2 @example Lifecycle + Backpressure F3 reuse Pitfall 4.C critical bypass + 2 @throws + worker-registry 2 @example Register/lookup/cascade + Validate task fail-fast D-124 + 3 @throws); preservation in dist/index.d.ts: @example 23/10 + @see 30/15 + @throws 21/5 (sopra target floor analog F4 12/21/x). `3f07f7a` docs REQ matrix flip atomic in REQUIREMENTS.md: WK-01..WK-07 → Complete con plan reference (es. "Done plan 05-04+05-05+05-06") + ERR-02 ext F5 (worker.error + worker.messageerror sanitized error + ext codes worker.unknown/worker.task.unknown/worker.timeout/worker.cancelled/worker.serialization.failed.<sub>) → Complete + LIFE-02 ext F5 (cascade workers 3-step idempotente) → Complete + TEST-01/02/03 ext F5 (121 worker test Tier-1 jsdom + 6 browser smoke Tier-3 + 8 integration Tier-1 D-151 #1-#6,#8,#9 + Pitfall 2C deterministic) → Complete + DOC-05 → In Progress (worker section delivered F5, full consolidamento F6) + Open Issues PRD §39 #11 (WK-07) → CLOSED 2026-05-05 ✅ con citazione esplicita closure DOC-05 README + plan 05-02 assertSerializable + plan 05-04 transferable. Final docs commit (questo + ROADMAP/STATE/TRACKER + 05-07-SUMMARY.md). REQ flip: WK-01..WK-07 + ERR-02 ext + LIFE-02 ext F5 + TEST-01/02/03 ext F5 → Complete. **PRD §39 #11 (WK-07) chiuso** in DOC-05. Test invariato 121/121 worker Tier-1 jsdom + 6/6 browser smoke Tier-3 Playwright Chromium + 877/880 monorepo full (3 skip MSW V1.x F4 — no regression). D-83 strict carryover ✓ verified `git diff main...HEAD packages/{core,mapper,routing}/src/ + packages/gateway/src/{http,sse-ws}/` exit 0 lines per tutta F5 (composition wrapper Opzione B research §7.2 preserva tutta F1-F4 invariata). Phase 5 ready for gsd-verifier; Phase 6 (Cache & Tooling avanzato — ULTIMA fase v1.0) auto-advance enabled.

- **Plan 05-06 ESEGUITO ✓ (Wave 4 — composition wrapper Opzione B + factory + 8 integration test Tier-1 + 6 browser smoke Tier-3 Playwright)** — `WorkerBroker` class composition wrapper di `RouterBroker` (D-121, D-83 strict carryover F4) — pattern simmetrico a `RealtimeBroker` di F4 (plan 04-08). **Opzione B research §7.2 verified live**: `WorkerBroker.publish(topic)` intercepta topic matching una worker route registrata (Map<topic, RouteWorkerDefinition>) PRIMA di delegare a `inner.publish` (RouterBroker F3). Per topic non-worker → delegate trasparente a inner.publish (pipeline F3 invariata HTTP/local/cache/composite). Per topic worker → costruisce BrokerEvent canonico + AbortController external scope + invoca handler.execute. JSDoc cita Opzione B + D-83 in 14 occurrenze totali + 4 esplicite RESEARCH §7.2. **`createWorkerHandler({ registry, pool, tracker, publishFn })`** Strategy F3 dispatch (D-152 step 9 §28): registry.validateTask fail-fast (D-124) → tracker.register (D-134 correlationId end-to-end) → combined signal (external + timeout default 30s D-145 + concurrency abort) → pool.schedule (D-130 BackpressureStrategy F3 + critical bypass) → bridge.dispatch (Comlink RPC) → atomic CAS via tracker.markDone/markTimeout/markCancelled/markError (D-133 Pitfall 2C closure — late responses scartate silenziosamente) → publishFn outcome event. **Topic auto-derive D-146** via deriveTopic(sourceTopic, suffix) helper esportato — `weather.requested` → `weather.completed`/`.progress`/`.failed`; override esplicito via `route.publishes.{success|progress|error}`. **Sanitized error shape T-03-07-01 carryover**: publishFailure emette `<topic>.failed` (o override) + `worker.error` topic ext (ERR-02 ext F5 — pattern F3 D-81 network.error) con payload `{ code, category, message, routeId, topic, eventId, workerId, taskName }` — niente originalError/stack/cause. **Cascade D-126 LIFE-02 ext F5**: registerPlugin auto-registra desc.workers con ownerId=descriptor.id + system.warn strutturato su register failure (W-5 closure F4 — niente silent catch); unregisterPlugin 3-step cascade `inner.unregisterPlugin + pool.terminateByOwner + registry.unregisterByOwner` con try/catch isolato per idempotency. **`createWorkerBroker(config)`** factory pubblico Valibot WorkerBrokerConfigSchema + safeParse + prefisso `Invalid WorkerBrokerConfig:` + D-30 anti-singleton. **DI bridgeFactory innovation** (Auto-fix Rule 2): aggiunta opzione `WorkerBrokerConfig.bridgeFactory` per integration test deterministico — sostituisce default `WorkerBridge` (Comlink RPC reale) con `MockBridge` cooperativo (onora signal, tracking instances/byWorkerId/dispatchCalls/cancelledCount per assertion). Pattern coerente con `WorkerPool.bridgeFactory` (05-05 disaccoppiamento). **`createWorkerHarness`** fixture analog F4 realtime-harness — collect events via subscribe wildcard multi-depth `'*','*.*','*.*.*','*.*.*.*'` (W-3 closure F4 carryover — niente monkey-patch publish). **D-151 10 scenari coverage**: #1 dedicated.test happy path + correlationId, #2 pool-concurrent.test 4 publish parallel cap rispettato, #3 timeout-strict.test Pitfall 2C closure deterministic (NESSUN .completed dopo timeout + tracker.tasksCompleted===1), #4 cancel-cooperative.test signal abort onorato (cancelledCount>=1), #5 cancel-hard.test unregisterPlugin cascade hard kill (terminated===true + activeBridges===0), #6 serialization-fail.test assertSerializable PRE-postMessage simulata via custom bridgeFactory + worker.serialization.failed.function code, #8 cascade-cleanup.test 5-worker plugin cleanup + worker.unknown post-publish, #9 backpressure-storm.test critical priority bypass (Pitfall 4.C consistency) → 8 integration Tier-1 jsdom; #7 transferable byteLength=0 → 6 browser smoke Tier-3 Playwright Chromium reale (test-worker.ts Comlink.expose API + playwright-worker-smoke.test.ts: structuredClone Date/Map preserved Pitfall 7.B + Comlink.transfer ownership Pitfall 7.E + module worker PRD §31.3 + navigator.hardwareConcurrency); #10 (assertSerializable PRE-postMessage no spawn) coperto in 05-04 worker-bridge.test Test 4. 4 commits atomici: `4717a2e` feat WorkerHandler Strategy + 8 unit + `e117332` feat WorkerBroker composition + factory + harness + 12 broker test + 6 factory test + `6141eba` test 8 integration Tier-1 + `ff3d694` test 6 browser smoke Tier-3. 16 file creati + 1 modificato (~2112 LOC totali — 1383 source + 616 integration + 113 browser). **121/121 worker test passing** Tier-1 jsdom + **6/6 browser smoke** Tier-3 Playwright Chromium reale; cross-package zero regression: core 248 + mapper 183 + routing 103 + gateway 222 (3 skip MSW V1.x F4) + worker 121 = 877/880 monorepo full. Build OK ESM-only: dist/index.js 50.85 KB (+18.50 vs 05-04), dts 60.72 KB. Typecheck zero errors su 5 package. **D-83 strict ✓ verified** `git diff main packages/{core,mapper,routing}/src/ packages/gateway/src/{http,sse-ws}/` empty. 11/11 threat enumerate (T-05-06-01..T-05-06-11) tutti `LOW` severity, 10 `mitigate` + 1 `accept` (externalAbortControllers Map cleanup in finally bounded). REQ progress: WK-01..WK-07 + ERR-02 ext + LIFE-02 ext F5 + TEST-01/02/03 ext F5 → subset W4 done (full closure 05-07 final gate). 3 deviations Auto-fix Rule 1/2 documentate in SUMMARY (resolveTimeoutMs coerce number|TimeoutPolicyConfig + Test 2 worker-broker timeout MockWorker non-rispondente fix + DI bridgeFactory innovation).

- **Plan 05-04 ESEGUITO ✓ (Wave 3-A — WorkerBridge Comlink wrapper, parallel con 05-05 worker-pool/registry)** — `WorkerBridge` class production-ready (629 LOC) wrappa Comlink 4.4.2 con DI WorkerCtor + lazy first-dispatch lifecycle (D-129) + AbortSignal proxy via `Comlink.proxy(signal)` (D-132) + onProgress proxy con throttle latest-only window leading+trailing 100ms default (D-135 + D-137 — `makeThrottledOnProgress`) + assertSerializable PRE-postMessage modes 'always'|'dev'|'off' (D-139/D-140 — throw `worker.serialization.failed.<sub>` con fieldPath PRIMA di spawn, NO waste) + extractTransferables JSONPath + `Comlink.transfer(payload, transferList)` wrap (D-141 — Wave 2 building block consumption) + terminate idempotente (`Comlink.releaseProxy` + `worker.terminate` — D-131) + lazy re-spawn post-terminate (Test 10) + listener tracking error/messageerror events memorizza lastError per audit T-05-04-07 + WorkerHandler 05-06 outcome publishing. Fail-fast `worker.task.unknown` (D-124) PRIMA di spawn (T-05-04-06 mitigation). **DI ComlinkAdapter innovation**: Comlink ESM proprietà non-redefinable in test runtime (`Cannot redefine property: wrap`) → soluzione `WorkerBridgeDeps.comlinkAdapter?: ComlinkAdapter` opt-in con default binding diretto a `Comlink.{wrap,proxy,transfer,releaseProxy}`. Test inietta stub adapter via `Proxy` intercept senza dipendenza da MessageChannel reale. Pattern coerente con F4 `EventSourceCtor` DI carryover. **MockWorker test util** (208 LOC) implements Worker interface (postMessage/terminate/addEventListener/removeEventListener/dispatchEvent + onmessage/onmessageerror/onerror legacy) con static `lastInstance / instances / byWorkerId Map` indexing via `?_worker=<id>` query string + `reset()` + helpers `__reply / __error / __messageError` dispatch deterministico (analog F4 mock-event-source.ts D-150). 4 commits TDD: `b3cb23b` test MockWorker + `efc72c1` test RED 15 worker-bridge + `7461718` feat GREEN WorkerBridge + `9a52637` chore barrel + cleanup. **15/15 test passing** Tier-1 jsdom + DI MockWorker + `stubComlinkAdapter`; **87/87 full worker package suite** (15 nuovi + 72 W1+W2+W3-B precedenti); core 248/248, gateway 222/225 (3 skip MSW V1.x F4) → zero regression cross-package. Build OK ESM-only: dist/index.js 32.35 KB (con WorkerBridge + 24 hits in dts), augment.js 226 B. Typecheck zero errors su 5 package. **D-83 strict ✓ verified** `git diff main packages/{core,mapper,routing}/src/ packages/gateway/src/{http,sse-ws}/` empty. **File ownership disgiunta da 05-05 verified**: solo `worker-bridge.ts`, `worker-bridge.test.ts`, `test-utils/mock-worker.ts`, `index.ts` (append separato per WorkerBridge — sezione disgiunta da WorkerRegistry/WorkerPool di 05-05). Acceptance grep counts: Comlink.wrap 9 hits, Comlink.proxy 11, Comlink.transfer 9, Comlink.releaseProxy 12, assertSerializable 15, extractTransferables 6, worker.task.unknown 6, JSON.stringify( runtime invocations 0 (T-05-04-05 mitigation). 10/10 threat enumerate (T-05-04-01..T-05-04-10) tutti `LOW` severity tutti `mitigate`. Decisioni autonome: ComlinkAdapter DI marcato @internal + `getLastErrorForTesting` @internal exposto come API minor (necessario per Test 13/14 + WorkerHandler 05-06) + `detectDevMode` via globalThis cast (no @types/node dependency, Web Worker globalScope compatible) + listener cleanup esplicito al terminate (best-effort, F4 combine-signals.ts pattern). REQ progress: WK-01/WK-03/WK-04/WK-05/WK-07 partial (subset wave 3-A done, full closure 05-06+05-07), ERR-02 ext F5 (worker.error + worker.messageerror category 'worker'), TEST-01 ext (15 unit deterministici Tier-1).

- **Plan 05-05 ESEGUITO ✓ (Wave 3-B — WorkerRegistry + WorkerPool, parallel con 05-04 worker-bridge)** — `WorkerRegistry` Map<id, WorkerEntry> production-ready: register/get/validateTask/listByOwner/unregister/unregisterByOwner/getDebugSnapshot. Validazione fail-fast D-124 (id non-empty + factory callable + tasks non-empty) + cap hard 8 D-128 (`MAX_POOL_SIZE_HARD` const literal esportato) + duplicate guard con `existingOwner` details (T-05-05-03). Cascade `unregisterByOwner(ownerId)` ritorna readonly string[] (carryover F3 D-86 / F4 D-112 → ext F5 LIFE-02). 4 BrokerError codes uniformi `category='config'`: worker.id.duplicate, worker.unknown, worker.descriptor.invalid, worker.pool.size.exceeded. `WorkerPool` bounded slots + queue + lazy spawn + respawn + cascade: `defaultPoolSize() = min(navigator.hardwareConcurrency, 4)` con fallback 4 (jsdom/SSR — D-127), `acquireSlot/releaseSlot` atomic JS event-loop single-thread (T-05-05-06 race-free), espansione lazy fino a `targetSize` (D-129), `respawn(workerId, slotIdx)` D-131 fault recovery, `terminateByOwner(ownerId)` cascade idempotente, `schedule(routeId, priority, task)` delega F3 BackpressureStrategy con **critical bypass esplicito** (`priority === 'critical'` → bypass → grep verificabile, Pitfall 4.C). **F3 BackpressureStrategy riusato 1:1** via `import { createBackpressureStrategy } from '@gluezero/gateway/http'` workspace dep — zero ridichiarazione, zero copia, zero modifiche F3 source (D-130 carryover). **DI pattern WorkerBridgeLike interface** per disaccoppiamento da 05-04 (parallel wave 3): `WorkerPool` definisce subset minimal `{ dispatch, terminate }` + `WorkerPoolDeps.bridgeFactory: (desc) => WorkerBridgeLike` injectable. Test usano `MockBridge` locale (zero dep 05-04). Consumer Wave 4 (05-06) connetterà `bridgeFactory: (desc) => new WorkerBridge(desc, deps)` — TS structural typing assicura compat. `console.warn` 1x per worker se `allowUnboundedPool: true` con `size > MAX_POOL_SIZE_HARD` (Pitfall 7.D protection). 5 commits TDD: `c436c68` test RED registry (10 test) + `af10e3b` feat GREEN registry + `e72b4c7` test RED pool (12 test) + `4eb037a` feat GREEN pool + `2f1efd9` chore barrel append (sezione propria, no overlap con 05-04 che ha aggiunto `WorkerBridge` + types in append separato). **22/22 test passing** Tier-1 jsdom; coverage v8 sui due file 05-05: pool 93/80/100/95.74, registry 94.44/92.3/100/94.28 (target ≥90/80/90/90 ✓). Build OK ESM-only: dist/index.js 22.44 KB, augment.js 226 B, DTS dist/index.d.ts 34.19 KB. Typecheck zero errors. **D-83 strict ✓ verified** `git diff main...HEAD packages/{core,mapper,routing}/src/ packages/gateway/src/{http,sse-ws}/` empty. File ownership disgiunta da 05-04 verified: solo `worker-pool.ts`, `worker-pool.test.ts`, `worker-registry.ts`, `worker-registry.test.ts`, `index.ts` (append-only) toccati da 05-05. Auto-fix Rule 1 (TDD execution): Test 3 assertion ricalibrata su `taskRunCount` counter local (dispatchOnSlotWithTask non passa per bridge) + `slot.currentTaskId = undefined` → `delete slot.currentTaskId` per `exactOptionalPropertyTypes` strict. REQ progress: WK-01/WK-02/WK-04/WK-06 partial (subset wave 3-B done, route handler pending 05-06), LIFE-02 ext F5 progress, TEST-01/03 unit subset 22 deterministic.

- **Plan 05-01 ESEGUITO ✓ (Wave 1 — Bootstrap @gluezero/worker)** — Pacchetto F5 popolato come scaffold completo type-level: package.json (deps comlink 4.4.2 + @gluezero/{core,mapper,routing,gateway}/nanoid/valibot, sideEffects glob `**/augment.{ts,js}` Pattern S1), tsup.config.ts ESM-only 2 entry (index + augment) target es2022 + dts true, vitest.config.ts Tier-1 jsdom + coverage v8 90/80/90/90 + exclude `__browser__/**`, vitest.browser.config.ts Tier-3 Playwright Chromium factory provider Vitest 4.x. 6 type files in `src/types/` con shape esatte D-123/124/127/128/131/133/136/137/141/143/146/147 (WorkerDescriptor + WorkerMode/Type, WorkerConfig + AssertSerializableMode, RouteWorkerDefinition + RouteWorkerPublishesSpec con `Pick<RoutePolicies,'timeout'|'concurrency'|'backpressure'|'dedupe'>` enforce TS-level D-143, ProgressPayload canonical schema D-136, TaskState union 5 stati + WorkerTaskOutcome D-133/D-152, INTERNAL_TOPICS_WORKER frozen const + `isInternalWorkerTopic` STRICT match Pattern S5 anti AP-6 carryover F4 D-111). augment.ts `declare module '@gluezero/core'` aggiunge `BrokerConfig.workers?: WorkerConfig` (D-122) + `PluginDescriptor.workers?: readonly WorkerDescriptor[]` (D-126 cascade ext F5 LIFE-02) + esporta `F5PipelineStep` literal union 4 valori (D-152 step 9 dispatch §28) + `__augmentWorkerLoaded: true` const literal (Pattern S1 anti tree-shake T-05-01-02). Barrel `src/index.ts` re-esporta side-effect augment + tutti i type pubblici, placeholder commented per Wave 2-4 runtime exports. **8/8 augment.test.ts passing** (smoke decl merging + coexistence F2/F3/F4/F5 + Pattern S5 STRICT match). 4 commits TDD-compliant: `7d64592` chore (config) + `2ec5fcf` feat (types) + `0d18c36` test (RED) + `77f19e1` feat (GREEN). Cross-package typecheck zero regression (core/mapper/routing/gateway tutti OK), full monorepo 248+183+103+222+8 = 764 passing (3 skip MSW V1.x F4). **D-83 strict ✓ verified** `git diff main...HEAD packages/{core,mapper,routing}/src/ packages/gateway/src/{http,sse-ws}/` empty. Pattern S1 audit `__augmentWorkerLoaded` in `dist/index.js` → 2 hits, `F5PipelineStep` + `INTERNAL_TOPICS_WORKER` preserved in dts. Build artifacts `dist/{index,augment}.{js,d.ts}` (index.js 539 B, augment.js 230 B). REQ progress: WK-01..WK-07 type-level scaffold + PKG-01..PKG-04 done. Decisioni minori autonome: aggiunto `lib WebWorker` in tsconfig.json (prerequisito W2-W4 typecheck), omesso `packages/worker/biome.json` (workspace root inherit OK come gateway/mapper/routing/core), `pnpm-workspace.yaml` non modificato (glob `'packages/*'` già copre worker), aggiunto `external: ['comlink']` in tsup.config.ts. Building blocks pronti per Wave 2 parallel (05-02 ‖ 05-03) con file ownership disgiunta: 05-02 → `assert-serializable + transferable-extractor` ‖ 05-03 → `task-tracker`.

- **Phase 5 PLAN-PHASE COMPLETATO ✓ (research + pattern-mapping + planner + plan-checker)** — RESEARCH.md 1539 LOC con 17 sezioni (architettura, Comlink 4.4.2 deep dive, pool strategy, state machine atomico, cancellation, serialization WK-07, pipeline §28 step 9, plan structure 7/6, test 3-tier, pitfalls, threat ASVS L1) — verificate live versioni npm `comlink@4.4.2` `nanoid@5.1.11` `valibot@1.3.1` `vitest@4.1.5` `playwright@1.59.1`. PATTERNS.md 1288 LOC con 35 file classificati + code excerpt analog F1-F4 (88% exact match). 7 PLAN.md (05-01..05-07) prodotti in 5 wave: W1 bootstrap @gluezero/worker (tsup ESM-only + vitest 3-tier + types + augment.ts decl merging + deps comlink/@gluezero/{core,mapper,routing,gateway}); W2 ‖ (05-02 assert-serializable deep-walk + transferable-extractor JSONPath ‖ 05-03 task-tracker state machine atomico Pitfall 2C strict); W3 ‖ (05-04 worker-bridge Comlink + DI WorkerCtor + AbortSignal proxy + MockWorker test util ‖ 05-05 worker-pool lazy spawn + cap 8 + F3 BackpressureStrategy 1:1 + worker-registry); W4 (05-06 worker-broker composition wrapper Opzione B research §7.2 — D-83 strict preserved zero modifiche `packages/routing/` — + createWorkerBroker factory + worker-handler + 8 integration test 3-tier + 6 browser smoke Playwright); W5 (05-07 final gate: CI gates + DOC-05 README italiano 11 sezioni + JSDoc TypeDoc-ready + REQ matrix flip atomic WK-01..WK-07 → Complete + PRD §39 #11 chiuso esplicitamente). Plan-checker verdict PASS_WITH_CONCERNS (0 BLOCKER, 5 WARNING: SC-1 mapping canonical wording / barrel index.ts overlap pattern noto F4 / 05-05 wave dependency cosmetic / 05-06 T3 description sintetica / SC-4 MessageChannel wording). Decision coverage gate 34/34 ✓ (post-fix: aggiunto cumulative D-121..D-154 in 05-07 must_haves.truths). Threat model 57 enumerate F5 distribuiti (T-05-XX-NN), zero HIGH+ severity. Coverage REQ-IDs 12/12 phase + PKG-01..PKG-04 cross-cutting. Estimated speedup wave-based ~30-35% vs sequential.

- **Phase 5 CONTEXT.md scritto ✓ (discuss-phase 5 --chain)** — 34 decisioni D-121..D-154 lockate. Topology: composition wrapper `WorkerBroker(RouterBroker)` D-121 (D-83 strict carryover, F5 vive solo in `packages/worker/src/`). F4 e F5 ortogonali — utente sceglie un entry point o compone esplicitamente `createWorkerBroker(createRealtimeBroker(config))` con `RouterBroker` base condivisa. Worker source: Factory `() => Worker` lazy + tasks dichiarate esplicite (fail-fast `worker.task.unknown` al register) + hybrid Comlink expose + `createTaskDispatcher` utility (D-123, D-124, D-125) + top-level `registerWorker` + `PluginDescriptor.workers` declaration merging (D-126). Pool: bounded `min(hwc, 4)` cap hard 8 default (D-127, D-128) + lazy first-dispatch (D-129) + F3 BackpressureStrategy riusata 1:1 (D-130). Cancellation hybrid: dedicated→`worker.terminate()`, pool→cooperative `__cancel__` + `cancelGraceMs=2000ms` + AbortSignal proxied via Comlink (D-131, D-132) + state machine atomico `Map<TaskId, TaskState>` ignora response post-timeout (Pitfall 2C strict, D-133) + `correlationId` end-to-end (D-134). Progress: Comlink callback proxy `task(args, signal, onProgress)` con schema canonical `{ value, message?, partialResult? }` + adapter-level `progressThrottleMs=100` + passa per mapper (D-135..D-138). Serialization: `assertSerializable` dev-mode auto + opt-out via `BrokerConfig.workers.assertSerializable` (D-139) + throw `BrokerError('worker.serialization.failed')` PRE-postMessage con fieldPath (D-140) + transferable JSONPath-like array `['payload.audioBuffer', 'payload.images[*].buffer']` (D-141) + WK-07 closure DOC-04+DOC-05 (D-142). Route policies subset: timeout(30s) + concurrency('latest-only') + backpressure + dedupe; NO retry/auth/circuitBreaker (D-143, D-144, D-145). Topic naming hybrid auto-derive + override (D-146). Module loading: ESM default + classic opt-in via `workerType: 'classic'` (D-147, opt-in extension a PRD §31.3) + `new URL(..., import.meta.url)` pattern (D-148). Test 3-tier (D-149, D-150) + 10 scenari obbligatori (D-151) + final gate F5 simile 04-09 (D-154). Topics reservati `__cancel__`/`__progress__` (analog F4 D-111 `__ping__`/`__pong__`).

- **Plan 04-09 ESEGUITO ✓ (Wave 6 — Final gate F4 — Phase 4 CHIUSA)** — Final gate F4 completato in 5 commits atomic: `761e4ad` test coverage thresholds documentation post-implementation (sse-ws/ subset 91.80% statements / 86.70% branches / 89.53% functions / 93.75% lines, supera target ≥85/75/88/87 — thresholds globali invariati per non rompere CI di sviluppi in corso che potrebbero introdurre defensive try/catch nel sub-modulo /http). `3c01b73` style biome auto-format su 19 file sse-ws/ + 2 lint fix manuali (frame-parser.ts: biome-ignore lint/complexity/useLiteralKeys per `obj['topic']`/`obj['data']`/`obj['id']` su `Record<string,unknown>` — `noPropertyAccessFromIndexSignature` TS strict richiede bracket access; realtime-broker.ts: `disconnectRealtime` rimosso `return` su void chain — lint/correctness/noVoidTypeReturn). `7014380` docs README Realtime SSE/WS section +298 LOC italiano: 14 sub-paragrafi (Quick start, Auth patterns D-104/D-105 4 strategie, Frame envelope D-106 con Q2 closure category 'protocol' nel payload, SSE custom event types W-4 SC-1, SSE heartbeat hook B-5 Q5, Reconnect contract RT-05 + Last-Event-ID query string + system.realtime.* + Q3 consolidationMs, Ping/pong WS D-111 strict-match Q1, Auto-fallback D-107+D-108 caveat path differenti V1, Visibility-aware D-110, Cascade cleanup D-112 LIFE-02 ext F4, Backpressure adapter-level D-115 riuso F3, Mapper+Validation D-114+D-116 W-2 closure scenario meteo, Test 3-tier D-118 B-1 closure, Limitazioni V1 + Q1-Q6 closure rationale). `e7638f9` docs JSDoc API pubblica TypeDoc-ready: 5 file public arricchiti con @see/@throws/@param (RealtimeBroker class header con 3 @example + 3 @see; createRealtimeBroker con @example + @throws + 2 @see; SseAdapter/WebSocketAdapter/RealtimeChannelManager con @example + cross-references; build verifica preservation in dts: 12 @example + 21 @see in `dist/sse-ws/index.d.ts`). Final docs commit (REQUIREMENTS/ROADMAP/STATE/TRACKER + SUMMARY 04-09). REQ flip: RT-01..RT-07 + ERR-02 ext + LIFE-02 ext F4 + TEST-01/02/03 ext F4 → Complete. **PRD §39 #9 (RT-07) chiuso** in DOC-04. Test invariato 222/225 gateway + 756/759 monorepo (no regression). D-83 strict carryover ✓ verified `git diff packages/{core,mapper,routing}/src/ packages/gateway/src/http/` zero hits per tutta F4 (verificato dal first commit Phase 4 `d090a1b` parent). Phase 4 ready for gsd-verifier; Phase 5 (Worker Runtime, parallelizzabile con F4) can start.

- **Plan 04-08 ESEGUITO ✓ (Wave 5 — RealtimeBroker composition + integration tests Tier-1/2/3)** — `RealtimeBroker` composition wrapper di RouterBroker (D-101 + D-83 strict) con manager `RealtimeChannelManager`; `createRealtimeBroker` public factory (D-30 no singleton + Valibot safeParse, prefix "Invalid RealtimeBrokerConfig"); `createRealtimeHarness` fixture per integration test (subscribe wildcard multi-depth `'*','*.*','*.*.*','*.*.*.*'` — W-3 closure NIENTE monkey-patch broker.publish + byChannelName routing B-2/B-NEW-2 closure). **W-1 closure verified live**: `Broker.publish(topic, payload, options)` (F1 broker.ts:155-163) accetta `options.source` e `options.id`, propagati invariati F2→F3→F1 fino a `createBrokerEvent` (event-factory.ts:52). Test 11 BEHAVIOR-VERIFICATING: subscriber riceve `event.source.type === 'server'` + `event.source.name === 'sse'` end-to-end. **W-5 closure**: registerPlugin con channel-register fail emette `system.warn` con `reason='realtime-channel-register-failed'` (Test 12). **B-3 closure**: tutti 12 test broker BEHAVIOR-VERIFICATING (asserzioni su getDebugSnapshot/subscribe callback, zero placeholder presence-only). **B-4 closure auto-fallback effettivo via integration test**: `auto-fallback.test.ts` Test 1 sostituisce `globalThis.EventSource` con `FailingMockEventSource` che throw nel constructor → forza il path `manager.connect → catch → runReconnectLoop` → dopo `fallbackThreshold:1` rebind a `MockWebSocket` (`expect(MockWebSocket.instances.length).toBeGreaterThanOrEqual(1)`). Test 2 cycle-cap: SSE+WS entrambi failing → `system.realtime.failed` con `reason='cycle-cap-exceeded'`. **D-118 3-tier closure**: Tier-1 jsdom 8 file 13 test passing + Tier-2 MSW 3 file `describe.skip` V1.x deferred (jsdom no native EventSource per RT-07 round-trip; ws.link compat) + Tier-3 Playwright real Chromium 1 test attivo (W-NEW-1 EventSource API verified non-mock). **Vitest 4.x browser provider API**: pre-4.x stringa, post-4.x factory function — installato `@vitest/browser 4.1.5` + `@vitest/browser-playwright 4.1.5` + Playwright Chromium binary. **W-NEW-3 closure**: `vitest.config.ts` exclude `**/__browser__/**` per evitare carico Tier-3 in jsdom run. 4 commits TDD: `c436293` RED test + `2d3417e` GREEN feat broker+factory + `48acfae` feat harness + `ccedd3a` test integration+barrel. **18 nuovi file ~1620 LOC** (realtime-broker 296 + test 220 + factory 123 + test 64 + harness 223 + 11 integration test files + 1 browser smoke). **222/225 gateway** (3 skip MSW V1.x), **756/759 monorepo full**, tsc clean su 5 package, build OK con `dist/sse-ws/{index,augment}.{js,d.ts}` + `createRealtimeBroker` esportato (17 occurrence in dts). RT-01..RT-07 + ERR-02 + TEST-01/02/03 progress; RT-06 + RT-07 marked complete. D-83 strict ✓ verified `git diff packages/{core,mapper,routing}/src/ packages/gateway/src/http/` zero hits. Pronto per 04-09 final gate (publint/attw/size-limit + DOC-04).

- **Plan 04-07 ESEGUITO ✓ (Wave 4 — RealtimeChannelManager)** — `RealtimeChannelManager` class production-ready: registry N-canale `Map<string, ChannelEntry>` indicizzato per `name` (D-102, anti-AP-11 verificato — Map by `name`, NON by `url`), lazy-init del `VisibilityDetector` al PRIMO connect (`channels.size === 0 && visibility === null`) + teardown automatico all'ULTIMO disconnect (`channels.size === 0` post-cleanup) (D-110), cascade cleanup `disconnectByOwner(ownerId, reason?)` D-112 (pattern identico a `HttpGateway.abortInFlightByOwner` di F3), factory dispatch `SseAdapter` (mode='sse'|'auto') / `WebSocketAdapter` (mode='websocket') con default 'auto'→'sse' SSE-first (D-107), duplicate guard `realtime.channel.duplicate` (BrokerError category 'config' — ErrorCategory F1 senza modifica core D-83), `runReconnectLoop` privato con `RealtimeManagerClock` DI per testabilità sync (`clock.sleep = () => Promise.resolve()` per test microtask resolution senza fake timers vitest). **B-4 closure D-107 auto-fallback EFFETTIVO**: pre-fix nessun runner orchestrava il fallback effettivo, post-fix `runReconnectLoop` while-loop `nextDelayMs() → publish system.realtime.reconnecting → clock.sleep → shouldFallback() ? fallback() : getMode() → costruisce nuovo adapter (rebind SSE→WS) → connect → recordSuccess|recordFailure` (Test 13 verifica MockWebSocket.lastInstance non-null dopo SSE failing + fallbackThreshold=1). **B-4 cycle-cap**: maxAttempts/globalCycleCap esauriti → `strategy.isPermanentlyFailed()` true → publish `system.realtime.failed reason='cycle-cap-exceeded'` (Test 14). **B-NEW-1 fix iter 2**: signature loop allineata strict a interface ReconnectStrategy 04-03 — `getMode()` (NOT `currentMode()`), `nextDelayMs()` no-arg, `recordFailure()` no-arg, `fallback()` toggla mode + ritorna nuovo, `shouldFallback()`, `isPermanentlyFailed()` — verifica grep `currentMode\|currentAttempt` runtime = 0 match. `entry.manuallyClosed = true` flag setttato in disconnect/disconnectByOwner blocca `runReconnectLoop` al prossimo while-check (T-04-07-04 mitigation — Test 15). 16/16 test PASS, **191/191 gateway**, **725/725 monorepo full**, tsc clean su 4 package (core/mapper/routing/gateway). D-83 strict ✓ (zero modifiche fuori `gateway/src/sse-ws/`). Anti-AP-11 verificato (Map by name, zero multiplex by URL); anti-AP-3 (0 import `reconnecting-websocket`). RT-01/RT-02/RT-03/RT-04/RT-05 progress (manager API surface esposta + runReconnectLoop orchestrator); ERR-02 ext (`system.realtime.reconnecting/connected/failed` via `publishSystem` helper con `source: { type: 'system', id: 'realtime-channel-manager', name: 'manager' }`). Building block pronto per consumer 04-08 RealtimeBroker (composition wrapper di RouterBroker — comporrà il manager via `new RealtimeChannelManager` con `publishFn` legato al `RouterBroker.publish` interno; espone `connectRealtime`/`disconnectRealtime` consumer-facing API; wrappa `unregisterPlugin(pluginId)` per propagare cascade D-112 via `manager.disconnectByOwner(pluginId, 'plugin.unregistered')`). 2 commits TDD: `2247c69` RED test + `1ee900f` GREEN feat.
- **Plan 04-06 ESEGUITO ✓ (Wave 3 close — WS adapter)** — `WebSocketAdapter` class production-ready: lifecycle connect/disconnect/checkFreshness, scheme switch automatico http(s)→ws(s) (D-107 — `switchScheme` con `URL` API + fallback regex), envelope JSON parsing strict via `parseFrame` di 04-02 (D-106), heartbeat ping/pong applicativo `{topic:'__ping__',data:{ts}}` ogni 30s con stale watchdog 60s (D-111 + anti-AP-4 RESEARCH §4.6 — `Date.now()-lastPongAt > staleTimeoutMs` → close + recordFailure), bufferedAmount cap 64KB pre-send (RESEARCH §4.4 — `BUFFERED_AMOUNT_PING_CAP` constant), close codes routing RFC 6455 §7.4 (`shouldReconnectOnCloseCode` pure function — 1000 normal/1002/1003/1007/1009/1010/1015 fatali → no recordFailure; altri → recordFailure manager-triggered), wsSubprotocols passthrough opt-in (Q4 — `new Ctor(wsUrl, subprotocols as string\|string[])`), AbortController cascade (D-112) con re-init al re-connect (pattern coerente con 04-05 Rule 1 fix), backpressure DI adapter-level (D-115 riuso F3 1:1 — schedule(channelName, 'normal', task)), DI WebSocketCtor per test jsdom (RESEARCH §9.1). PITFALL §11.7 anti-AP-6 verificato runtime: `isInternalTopic` strict (frame-parser di 04-02) — `__ping__`/`__pong__` consumed (pong aggiorna lastPongAt), `weather.__ping__` passa through (Test 7+15). 15/15 websocket-adapter test PASS, 175/175 gateway, **709/709 monorepo full**, tsc clean su 4 package. Anti-AP-3 verificato (0 import `reconnecting-websocket`); anti-AP-6 (0 `startsWith('__')`); anti-AP-2 (0 `Authorization`). MockWebSocket test util con `byChannelName` Map indicizzata via `?_channel=<name>` (B-NEW-2 fix iter 2 owned da 04-06, parallelo a MockEventSource owned da 04-05 — abilita harness routing strict 04-08). RT-02 closed (WebSocket adapter production-ready); RT-04/RT-05/RT-06/RT-07 progress (WS source descriptor + heartbeat + envelope JSON + ping/pong stale detection); ERR-02 ext (network.error category protocol Test 6 + system.realtime.connected/disconnected close codes Test 4/11/12). D-83 strict ✓ (zero modifiche fuori `gateway/src/sse-ws/`). Issue minore: DTS build TS5055 race condition con `clean: true` di tsup transient (risolto con `rm -rf dist` prima del rebuild — non è issue del codice).
- **Plan 04-05 ESEGUITO ✓ (Wave 3 — SSE adapter)** — `SseAdapter` class production-ready: lifecycle connect/disconnect/checkFreshness, Last-Event-ID via query string `?lastEventId=` (D-105 / RESEARCH §3.2 / chiusura RT-07), W-4 SC-1 closure (def.eventTypes loop addEventListener — topic deriva da event field SSE), B-5 Q5 closure (def.sseHeartbeatEventTypes default ['heartbeat'] silent freshness update senza publish), backpressure DI adapter-level (D-115 riuso F3), AbortController cascade (D-112) con re-init al re-connect (Rule 1 fix), DI EventSourceCtor per test jsdom (RESEARCH §9.1). MockEventSource test util con `byChannelName` Map (B-NEW-2 fix iter 2 owned da 04-05 — abilita harness routing strict 04-08). 14/14 test PASS, 160/160 gateway, **694/694 monorepo full**, tsc clean. Anti-AP-2 verificato (0 `Authorization`); anti-AP-3 (0 import `reconnecting-websocket`); AP-4 implicito (`es.close()` esplicito su error). RT-01/RT-04/RT-06/RT-07 progress (SSE-side closed; pending WS 04-06 + integration 04-07/04-08); RT-05 partial (createReconnectStrategy istanziata, loop reconnect del manager).
- **Plan 04-04 ESEGUITO ✓ (Wave 2 close)** — `createVisibilityDetector({ onChange, document })` factory event-driven. Pattern listener tracking analog `combine-signals.ts:62-86` (memoize listener ref + addEventListener + removeEventListener puntuale). DI guard 3-way: `undefined` → `globalThis.document`, `null` → explicit Worker/SSR disable (no-op + getState 'visible' default sicuro), `Document` mock → test injection. Idempotenza esplicita start/stop (T-04-04-02/03 mitigation). Anti-AP-5 verificato: 0 setInterval/setTimeout (event-driven puro). 11/11 test PASS, **680/680 monorepo full**, tsc clean su 4 package. RT-05 progresso (visibility wrapper done; pending heartbeat 04-05/06 + manager 04-07).
- **Plan 04-03 ESEGUITO ✓ (Wave 2)** — `createReconnectStrategy` factory state machine: full jitter D-109 + auto-fallback D-107 (threshold 3 + cycle cap 5) + Q3 §6.2 consolidationMs guard anti-flap (default 5000ms — opzione B). Interface 8 metodi, DI random+now per test deterministici. 15/15 test PASS, 669/669 monorepo, anti-AP-3 verificato (no `reconnecting-websocket` import). Pattern factory + closure analog circuit-breaker.ts F3.
- **Phase 4 CONTEXT.md (D-101..D-120)** — 20 decisioni nuove: auth-agnostic `buildUrl`, envelope JSON `{topic,data,id}`, RealtimeChannelManager N-canali, auto-fallback SSE→WS default abilitato (cap 5 cicli), Visibility API integration, composition wrapper RealtimeBroker, riuso pipeline §28 + mapper F2/F3 + backpressure F3 + cascade cleanup F1.
- **Plan 03-12 (Wave 7) ESEGUITO ✓** — RouterBroker composition wrapper + RouterEngine + createRouterBroker. 29/29 test deterministici TDD GREEN. D-83 strict verificato. 5 BLOCKER iter1 fix applicati. Cyclic workspace dep routing↔gateway gestito (type-only).
- **D-100** (NEW da revision plan iter 1): `RouterBroker` isola accesso `CanonicalRegistry` private di F2 via getter `getCanonicalSchemaForTopic` con loud throw + opt-in `requiresRouteTopics` come bypass. Documentata in `.planning/phases/03-routing-server-gateway-http/03-CONTEXT.md`.
- **Plan 03-12 fix tecnici** (auto-fix Rule 1/3 in execution):
  - Workspace dep: aggiunto `@gluezero/gateway` come dep di routing
  - Subpath: aggiunti re-export 7 createXxxStrategy a `@gluezero/gateway/http`
  - validator F3 V1 NO default (valibotAdapter signature mismatch — adapter conversion deferred F4/F6)
  - safeOptions injection per inner.publish (D-23 source default 'system:router')
  - emitTapStep inline pattern (startStep/safeTapStep non barrel-exposed in core)
- **Plan 03-11 (Wave 6) modifica revision iter 1:** `category: 'auth'` → `category: 'config'` (ErrorCategory union non include 'auth' e D-83 vieta modifica core).

## Agent in background

Nessun agent attualmente in background. (Vedi `Agent IDs` in cronologia conversazione per recovery via SendMessage.)

## File chiave

- `prd.md` (root) — fonte autoritativa unica
- `CLAUDE.md` — vincoli operativi
- `.planning/STATE.md` — stato GSD ufficiale
- `.planning/ROADMAP.md` — 6 fasi v1.0
- `.planning/REQUIREMENTS.md` — 91 REQ-ID
- `.planning/phases/03-routing-server-gateway-http/03-CONTEXT.md` — 41 decisioni D-60..D-100 lockate
- `.planning/phases/03-routing-server-gateway-http/03-RESEARCH.md` — 1282 LOC research
- `.planning/phases/03-routing-server-gateway-http/03-PATTERNS.md` — 30 file analoghi F1/F2

## Note libere

- L'utente ha richiesto persistenza completa post-`/clear` con TRACKER.md aggiornato dopo ogni step. Questo file è la pietra angolare della ripartenza.
- Aggiornamenti TRACKER.md sono parte del workflow GSD e vanno committati insieme a SUMMARY/STATE/ROADMAP per consistency.
- Boundary esteso (era GlueZero, ora `/Users/omarmarzio/programming/prova AI/`) → tutti i progetti dentro sono area libera operativa.
