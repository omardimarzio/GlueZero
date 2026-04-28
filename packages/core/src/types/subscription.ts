// Subscription — handle restituito da `broker.subscribe(topic, handler, options?)`.
//
// Riferimento decisione D-27 (CONTEXT 01):
// `Subscription` handle: { unsubscribe(): void; readonly id: string; readonly topic: string;
//                          readonly active: boolean }
// Idempotente — chiamare `unsubscribe` due volte è no-op dopo la prima
// (implementazione runtime in `bus.ts`, plan 07).
//
// `SubscribeOptions.once?: boolean` — DECISIONE PLANNER (RESEARCH Open Question 1, Plan 03):
// includere il flag, valore DX significativo, costo ~15 LOC in `bus.ts`. Nessun REQ-ID lo vieta.
//
// `SubscribeOptions.priority` NON include `'critical'`: i subscriber non possono auto-elevarsi
// a priority critical — è riservato a `BrokerEvent.priority` (event-level, settabile dal publisher).

export interface Subscription {
  readonly id: string
  readonly topic: string
  readonly active: boolean
  unsubscribe(): void
}

export interface SubscribeOptions {
  readonly signal?: AbortSignal
  readonly priority?: 'low' | 'normal' | 'high'
  readonly deliveryMode?: 'sync' | 'async'
  readonly once?: boolean
}
