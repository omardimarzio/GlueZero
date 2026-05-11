/**
 * @gluezero/microfrontends — Micro-frontend governance layer (v2.0).
 *
 * Registry MF + Lifecycle FSM 14 stati + 4 mount strategies + 17+7+5 standard topics
 * + EventTap MF-ready pre-instrumentato. Opt-in module extension runtime via
 * `createBroker({ modules: [microfrontendModule()] })`.
 *
 * Vincoli:
 * - Bundle ≤ 12 KB gzipped (D-V2-F8-05)
 * - Pattern S1 augment opt-in via `import '@gluezero/microfrontends/augment'` (D-V2-01)
 * - Subscription tracking via ownerId convention `mf:${id}` (D-V2-16)
 *
 * Surface pubblica popolata progressivamente dalle wave W2-W6 della Phase 8:
 * - W2: descriptor types + Valibot validator + Registry + ServiceLocator + Pattern S1 augment
 * - W3: Lifecycle FSM 14 stati + idempotency `inFlight: Map<id, Promise>`
 * - W4: Mount orchestrator 4 strategies + Contracts validator + Loader Registry
 * - W5: 17+7+5 standard topics + payload shapes + Runtime context facade + MOCK loader
 * - W6: README italiano completo + JSDoc + bundle gate finale
 *
 * @packageDocumentation
 */

// barrel populated by W2-W6 plans — see .planning/phases/08-*/08-NN-PLAN.md
export {}
