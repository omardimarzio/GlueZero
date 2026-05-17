/**
 * Source attribution centralizzata per ogni `broker.publish(...)` emesso da `@gluezero/compat`.
 *
 * **REVISIONE WARNING 8 (plan 12-02):** estratto come `const` condivisa per:
 * 1. Eliminare duplicazione del literal `{type:'plugin', id:'compat', name:'@gluezero/compat'}`
 *    tra `version-registry.ts` + `compat-error.ts`.
 * 2. Allineare i test (`expect(...).toHaveBeenCalledWith(...source: COMPAT_PUBLISH_SOURCE)`)
 *    con il source code via riferimento singolo (no fragile literal coupling).
 * 3. Single point of change se lo schema source cambia in V2.1.
 *
 * Pattern allineato a F11 `capability-registry.ts:125-128` (publishOpts inline literal), ma
 * con estrazione in modulo dedicato per consentire l'asserto-by-identity nei test.
 *
 * @internal — NON re-esportato dal barrel `src/index.ts`. Verifica audit-grep:
 *             `grep -r "from.*internal/compat-source" packages/compat/src/`
 *             deve ritornare SOLO consumer interni (version-registry + compat-error).
 *
 * @see plan 12-02 REVISIONE WARNING 8
 * @see packages/permissions/src/capability-registry.ts (analog F11 publishOpts inline)
 */
export const COMPAT_PUBLISH_SOURCE = {
  type: 'plugin' as const,
  id: 'compat',
  name: '@gluezero/compat',
} as const
