// Plugin lifecycle state machine (PRD §15, §24, REQ CORE-05, decisione D-25).
//
// VALID_TRANSITIONS è la mappa autoritativa delle transizioni ammesse tra
// PluginState. `transitionState(reg, target, logger)` valida la transizione
// e, se ammessa, aggiorna `reg.state` in-place; altrimenti logga e lancia
// BrokerError con code='plugin.lifecycle.invalid-transition'.
//
// Ordine D-25 (CONTEXT 01):
//   unregistered → registered → mounting → mounted → unmounting → unmounted → destroyed
// Path failure raggiungibile da `mounting` o `unmounting` (failure during async hook).
// Da `failed`: → `unmounting` (recovery) o `destroyed` (force cleanup).
// `registered → unmounted` ammesso (registerPlugin che fallisce su `onRegister`
// rollback verso unmounted senza passare per mounting).
// `destroyed` è terminal (array `[]` — nessuna transizione outbound).
//
// Threat T-06-02 (DoS — race tra register/unregister concorrenti): la funzione è
// sync — race-free se chiamata da single-threaded JS event loop. Pattern async
// via microtask sarà aggiunto in plan 08 (PluginRegistry); state machine atomico
// previene salti illegittimi indipendentemente dall'orchestratore.
//
// Threat T-06-04 (Information disclosure): `details.pluginId` accept — internal,
// non PII; necessario per debug e per identificare quale plugin ha violato la
// state machine.

import type { BrokerLogger } from '../types/logger'
import type { PluginRegistration, PluginState } from '../types/plugin'
import { createBrokerError } from './broker-error'

export const VALID_TRANSITIONS: Record<PluginState, readonly PluginState[]> = {
  unregistered: ['registered'],
  registered: ['mounting', 'unmounted'],
  mounting: ['mounted', 'failed'],
  mounted: ['unmounting'],
  unmounting: ['unmounted', 'failed'],
  unmounted: ['destroyed'],
  failed: ['unmounting', 'destroyed'],
  destroyed: [],
}

export function transitionState(
  reg: PluginRegistration,
  target: PluginState,
  logger: BrokerLogger,
): void {
  const allowed = VALID_TRANSITIONS[reg.state]
  if (!allowed.includes(target)) {
    const err = createBrokerError({
      code: 'plugin.lifecycle.invalid-transition',
      category: 'plugin',
      message: `Invalid plugin lifecycle transition: ${reg.state} → ${target} (plugin: ${reg.descriptor.id})`,
      details: { from: reg.state, to: target, pluginId: reg.descriptor.id },
    })
    logger.error(err.message, { error: err })
    throw err
  }
  reg.state = target
}
