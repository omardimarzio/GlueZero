// __browser__/axe-a11y.test.ts — Tier-3 Playwright Chromium axe-core a11y CI gate
// (Wave 6 plan 07-13 — TEST-03 ext F7 Pitfall HIGH #5 + UI-DOC-04).
//
// Verifica: una pagina con widget marcati `data-gz-role` e ARIA esplicito
// (role/aria-label) NON ha violazioni `critical` axe-core.
//
// UI-DOC-04: `data-gz-role` è SEMANTICA VISIVA di GlueZero, NON sostituisce
// `role` o `aria-*` per assistive technology.
//
// NOTA: si usa `axe-core` direttamente (non `@axe-core/playwright`) perché il
// runner Vitest 4.x browser ha un page-iframe context, non una `Playwright Page`.
// `@axe-core/playwright` è devDep aggiunto per compat con eventuale CI Playwright
// E2E future (subpath separato V1.x deferred).

import axe from 'axe-core'
import { afterEach, describe, expect, it } from 'vitest'

const CONTAINER_ID = 'gz-axe-a11y-container'

function setupA11yPage(): HTMLElement {
  const container = document.createElement('div')
  container.id = CONTAINER_ID
  container.setAttribute('lang', 'it')
  container.innerHTML = `
    <main>
      <h1>A11y page</h1>
      <button data-gz-role="action.primary" aria-label="Salva il documento">Salva</button>
      <button data-gz-role="action.secondary" aria-label="Annulla">Annulla</button>
      <label for="email-input">Email</label>
      <input id="email-input" type="email" data-gz-role="input.text" placeholder="email@example.com" />
    </main>
  `
  document.body.appendChild(container)
  return container
}

describe('axe-core a11y (Pitfall HIGH #5 + UI-DOC-04)', () => {
  afterEach(() => {
    document.getElementById(CONTAINER_ID)?.remove()
  })

  it('zero critical violations with proper data-gz-role + ARIA coexist', async () => {
    const container = setupA11yPage()
    const results = await axe.run(container)

    const critical = (results.violations ?? []).filter(
      (v) => v.impact === 'critical',
    )

    if (critical.length > 0) {
      // Surface details when CI fails
      console.error(
        'axe-core critical violations:',
        critical.map((v) => ({
          id: v.id,
          help: v.help,
          nodeCount: v.nodes?.length,
        })),
      )
    }
    expect(critical.length).toBe(0)
  })
})
