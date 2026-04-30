// Integration test (robustness) — chiusura D-41 / MAP-16 (PRD §39 #1):
// Warning runtime su alias ambiguo + verifica del resolution order D-40
// (esplicito > scoped > global > name-match).
//
// **Plan 02-12 Task 2 (TDD RED → GREEN):** verifica che il resolution order D-40 sia
// rispettato in modo deterministic e che le ambiguità tra alias (scoped vs global,
// global ↔ name-match) siano gestite SENZA throw (D-41 — warning, NON eccezione).
// NON mock-a moduli interni F2; usa AliasRegistry diretto + `createMapperHarness` per
// verifica end-to-end via MapperBroker reale.
//
// Coverage:
//   - Test 1: alias scoped + global stesso `localField` → resolve ritorna scoped (priorità D-40)
//             entrambi `ambiguous: true` ma source diverso ('scoped' vs 'global')
//   - Test 2: 2 plugin diversi con stessi localField scoped → scope isolation (D-40 livello 2)
//   - Test 3: alias che conflict con name-match → ambiguous: true source 'global' (NON name-match)
//   - Test 4: end-to-end via MapperBroker — registrare alias global poi un plugin con outputMap
//             esplicito su STESSO localField; verificare che esplicito vince (D-40 livello 1)
//   - Test 5: end-to-end — alias globali multipli si registrano senza throw; resolution
//             ritorna l'alias del localField specifico richiesto (NO ambiguity throw — D-41)
//
// Pattern: D-41 garantisce NO throw runtime; tutti i test verificano che `resolve` ritorni
// un risultato strutturalmente valido o che il broker non crash. La policy è warning, non error.

import { describe, expect, it } from 'vitest'
import { AliasRegistry } from '../alias-registry'
import { createMapperHarness } from '../test-utils/mapper-harness'
import type { CanonicalSchemaId } from '../types/canonical-schema'

describe('alias resolution ambiguity — D-41/MAP-16/D-40 chiusura PRD §39 #1', () => {
  it('scoped alias wins over global for same localField (D-40 priority)', () => {
    const registry = new AliasRegistry()
    // Stesso localField 'city' → due canonicalField diversi: scoped 'place', global 'location'
    registry.registerScoped('plugin-a', 'city', 'place')
    registry.registerGlobal('city', 'location')

    // Plugin-A vede lo scoped (livello 2 D-40 > livello 3)
    const resolvedA = registry.resolve('plugin-a', 'city')
    expect(resolvedA.canonical).toBe('place')
    expect(resolvedA.source).toBe('scoped')
    expect(resolvedA.ambiguous).toBe(true)

    // Plugin-B (senza scope) vede solo il global
    const resolvedB = registry.resolve('plugin-b', 'city')
    expect(resolvedB.canonical).toBe('location')
    expect(resolvedB.source).toBe('global')
    expect(resolvedB.ambiguous).toBe(true)
  })

  it('two plugins with same localField scoped: scope isolation (D-40 level 2 isolation)', () => {
    const registry = new AliasRegistry()
    registry.registerScoped('plugin-a', 'city', 'place_A')
    registry.registerScoped('plugin-b', 'city', 'place_B')

    // Ogni plugin vede SOLO il proprio scoped — gli scope NON si shadow tra loro
    const a = registry.resolve('plugin-a', 'city')
    const b = registry.resolve('plugin-b', 'city')

    expect(a.canonical).toBe('place_A')
    expect(b.canonical).toBe('place_B')
    expect(a.source).toBe('scoped')
    expect(b.source).toBe('scoped')
    // Plugin-c senza scope né global → name-match (D-40 livello 4)
    const c = registry.resolve('plugin-c', 'city')
    expect(c.canonical).toBe('city')
    expect(c.source).toBe('name-match')
    expect(c.ambiguous).toBe(false)
  })

  it('global alias preferred over name-match (D-40 level 3 > level 4)', () => {
    const registry = new AliasRegistry()
    // Edge case: registriamo un alias dove localField === canonicalField target diverso
    // Es.: 'location' è già un canonical valido, ma alias 'location' → 'place' overrideria
    registry.registerGlobal('location', 'place')

    const resolved = registry.resolve('plugin-x', 'location')
    expect(resolved.canonical).toBe('place')
    expect(resolved.source).toBe('global')
    expect(resolved.ambiguous).toBe(true)
  })

  it('explicit outputMap (D-40 level 1) wins over global alias — end-to-end via MapperBroker', async () => {
    // Setup: alias globale 'city' → 'location' al boot
    // + plugin con outputMap esplicito 'city' → 'place'
    // Atteso: il payload canonico ha 'place' (esplicito) NON 'location' (alias)
    const harness = createMapperHarness({
      schemas: [
        {
          id: 'sch-explicit' as CanonicalSchemaId,
          fields: {
            place: { type: 'string', required: false },
          },
        },
      ],
      aliases: { city: 'location' },
    })

    const delivered: Record<string, unknown>[] = []
    harness.broker.subscribe('explicit.topic', (e) => {
      delivered.push(e.payload as Record<string, unknown>)
    })

    await harness.broker.registerPlugin({
      id: 'p-explicit',
      canonicalSchemaId: 'sch-explicit' as CanonicalSchemaId,
      outputMap: {
        // Mapping esplicito: city → place. L'alias globale city → location NON deve applicarsi.
        place: { source: 'city' },
      },
    })

    harness.broker.publish(
      'explicit.topic',
      { city: 'Roma' },
      {
        source: { type: 'plugin', id: 'p-explicit' },
        deliveryMode: 'sync',
      },
    )

    // Flush microtasks per qualsiasi async error publish (none expected)
    await new Promise<void>((resolve) => queueMicrotask(resolve))

    // Il subscriber riceve il payload canonico con 'place', NON 'location'.
    // D-40 livello 1 (esplicito) prevale su livello 3 (alias globale).
    expect(delivered).toHaveLength(1)
    const payload = delivered[0]
    expect(payload?.place).toBe('Roma')
    expect('location' in (payload as object)).toBe(false)
  })

  it('multiple distinct global aliases coexist without throw (D-41 runtime — warning, NOT throw)', async () => {
    // D-41: il behavior runtime su alias ambiguous è EMETTERE warning (mapping.warn),
    // non throw. Questo test verifica che registrare alias globali multipli per
    // localField DIVERSI (ognuno univoco) non genera nessun warning né throw.
    // Il test documenta inoltre che `registerGlobal` di alias CONFLITTUALI sullo stesso
    // localField con canonical diverso throw `Error('alias.global.conflict: ...')` —
    // questo NON è il caso D-41 (che è ambiguous con stesso source pari ma diversi
    // canonical CO-RESOLVED), ma è il design di AliasRegistry per prevenire shadow
    // accidentale (T-02-04-03).
    const registry = new AliasRegistry()

    // Registrazione di 3 alias globali su localField diversi: nessun conflict, nessun throw
    expect(() => registry.registerGlobal('city', 'location')).not.toThrow()
    expect(() => registry.registerGlobal('country', 'nation')).not.toThrow()
    expect(() => registry.registerGlobal('addr', 'address')).not.toThrow()

    // listGlobal ritorna 3 entry deterministicamente ordinate
    const list = registry.listGlobal()
    expect(list).toHaveLength(3)
    expect(list).toEqual([
      ['addr', 'address'],
      ['city', 'location'],
      ['country', 'nation'],
    ])

    // Resolve di ognuno funziona indipendentemente — NO ambiguity issue tra entry distinte
    expect(registry.resolve('p', 'city').canonical).toBe('location')
    expect(registry.resolve('p', 'country').canonical).toBe('nation')
    expect(registry.resolve('p', 'addr').canonical).toBe('address')

    // Tentativo di shadow: stesso localField, canonical diverso → throw conflict.
    // Questo NON è D-41 (che è warning runtime); è T-02-04-03 (anti-pattern PITFALLS §3.B).
    expect(() => registry.registerGlobal('city', 'place')).toThrow(/alias\.global\.conflict/)

    // Idempotent register: stesso localField, stesso canonical → return false, NO throw
    expect(registry.registerGlobal('city', 'location')).toBe(false)
  })

  it('name-match (D-40 level 4) when no alias registered: NOT ambiguous', () => {
    const registry = new AliasRegistry()

    // Nessun alias registrato → resolve ritorna name-match (livello 4 D-40)
    const resolved = registry.resolve('plugin-x', 'location')
    expect(resolved.canonical).toBe('location')
    expect(resolved.source).toBe('name-match')
    expect(resolved.ambiguous).toBe(false)
  })

  it('cascade scoped alias removal (D-26 ext F2 LIFE-02 ext)', () => {
    const registry = new AliasRegistry()
    registry.registerScoped('plugin-a', 'city', 'place_A')
    registry.registerScoped('plugin-a', 'addr', 'address_A')
    registry.registerScoped('plugin-b', 'city', 'place_B')
    registry.registerGlobal('country', 'nation')

    // unregisterScopedAll(plugin-a) rimuove SOLO gli alias di plugin-a
    const removed = registry.unregisterScopedAll('plugin-a')
    expect(removed).toBe(2)

    // plugin-a ora vede name-match (no alias)
    const a = registry.resolve('plugin-a', 'city')
    expect(a.source).toBe('name-match')

    // plugin-b ancora ha il proprio scoped (isolation preservata)
    const b = registry.resolve('plugin-b', 'city')
    expect(b.canonical).toBe('place_B')
    expect(b.source).toBe('scoped')

    // Global aliases intatti
    expect(registry.resolve('plugin-a', 'country').canonical).toBe('nation')
  })
})
