// TopicRegistry — traccia i topic noti del broker (PRD §10, REQ CORE-03).
//
// Surface minima:
//   register(topic): boolean   // true alla prima volta, false se già presente (idempotente)
//   has(topic): boolean
//   list(): string[]           // copia ordinata alfabeticamente (no leak Set interno)
//   onRegistered(listener): () => void  // observer pattern; ritorna unsubscribe
//
// NOTA Open Questions §2 (RESEARCH 01): in F1 NON emette `system.topic.registered`
// come BrokerEvent. Il TopicRegistry è "soft" — esposto via `getTopicRegistry()`.
// F6 (Inspector) potrà estendere se servirà.
//
// Threat T-06-01 (Tampering): `list()` ritorna `[...this.topics].sort()` — copia spread
// del Set interno, NON un riferimento. Mutation esterna del result NON corrompe lo state
// del registry (verificato dal test "list returns a fresh array on each call").
//
// Threat T-06-03 (DoS — listener throw): il for-loop su `listeners` wraps ogni chiamata
// in try/catch swallow per garantire che un listener malevolo/buggy non interrompa
// la propagazione agli altri listener registrati.

export class TopicRegistry {
  private topics = new Set<string>()
  private listeners = new Set<(topic: string) => void>()

  register(topic: string): boolean {
    if (this.topics.has(topic)) return false
    this.topics.add(topic)
    for (const l of this.listeners) {
      try {
        l(topic)
      } catch {
        // T-06-03: swallow per isolare i listener tra loro
      }
    }
    return true
  }

  has(topic: string): boolean {
    return this.topics.has(topic)
  }

  list(): string[] {
    return [...this.topics].sort()
  }

  onRegistered(listener: (topic: string) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
}
