// __browser__/test-worker.ts — Worker artifact reale per Tier-3 Playwright
// Chromium smoke test (Wave 4 plan 05-06 — D-151 #7 transferable byteLength=0
// + D-150 3-tier strategy).
//
// Espone via `Comlink.expose` un sub-set di task per esercitare:
// - structuredClone preservation Date + Map (Pitfall 7.B)
// - Transferable ownership (Pitfall 7.E — buf.byteLength === 0 post-transfer)
// - Module-type Worker loading (PRD §31.3 evergreen)
//
// Riferimento RESEARCH §9.3: Tier-3 Playwright Chromium real-browser execution.

/// <reference lib="webworker" />
import * as Comlink from 'comlink'

interface ProgressPayload {
  readonly value: number
  readonly message?: string
  readonly partialResult?: unknown
}

const api = {
  /** Echo back length per verificare ArrayBuffer transferable ownership. */
  echoBuffer: async (buf: ArrayBuffer): Promise<number> => buf.byteLength,
  /** Echo Date per verificare structuredClone Date preservation. */
  echoDate: async (d: Date): Promise<Date> => d,
  /** Echo Map per verificare structuredClone Map preservation. */
  echoMap: async (m: Map<string, number>): Promise<Map<string, number>> => m,
  /** Fast task per smoke postMessage RPC. */
  fastTask: async (n: number): Promise<number> => n * 2,
  /** Progress emit per smoke proxy callback. */
  progressTask: async (
    onProgress: Comlink.Remote<(p: ProgressPayload) => void>,
  ): Promise<string> => {
    onProgress({ value: 0.5, message: 'halfway' })
    return 'done'
  },
}

Comlink.expose(api)
