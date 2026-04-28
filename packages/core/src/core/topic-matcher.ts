// Topic naming validation + Trie segmentato per wildcard matching (CORE-08, CORE-09).
//
// Riferimento decisioni (CONTEXT 01):
// - D-08: TopicTrie segmentato (split by '.') con `*` come full segment wildcard.
//   Lookup è O(segments_topic), NON O(subscribers).
// - D-09: complessità match = O(s) dove s = numero di segmenti del topic pubblicato
//   (indipendente dal numero di subscribers totali nel trie).
// - D-10: `*` è full-segment wildcard, NON char-by-char (`weather.*` matcha
//   `weather.requested` MA NON `weather.requested.success`).
// - D-11: `*` può comparire in posizione intermedia (es. `weather.*.failed` matcha
//   `weather.alert.failed`). Il trie naviga sia il branch exact sia il branch '*'.
// - D-24: regex topic naming = lowercase, dot-separated, alfanumerico + `_` esclusi.
//   Pattern PRD §11: `<entity>.<action>.<status>` (es. `weather.requested`,
//   `auth.login.success`).
//
// Threat coverage:
// - T-05-01 (Tampering — topic injection es. `weather.../proc/etc`): regex strict
//   D-24 rifiuta `/`, `..`, uppercase. validateTopicPattern parimenti restrittiva
//   (consente solo `*` come segmento intero, non `we*`).
// - T-05-03 (DoS — wildcard malformato → infinite loop nel match): validateTopicPattern
//   chiamato al `insert`, garantisce shape valido. matchRecursive è O(segments)
//   per branch (al massimo 2 branch per livello: exact + wildcard).

import { createBrokerError } from './broker-error'

// Topic regex: D-24 — primo char alfabetico minuscolo, segmenti dot-separated,
// segmenti successivi possono includere `*` (per consentire la stessa regex sui
// pattern lato subscribe). validateTopicPattern fa il check più stringente sui
// pattern (solo `*` come segment intero).
const TOPIC_REGEX = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9*]*)*$/

// Pattern regex: ogni segmento è EITHER `*` (full wildcard) OR `[a-z][a-z0-9]*`.
const PATTERN_REGEX = /^([a-z][a-z0-9]*|\*)(\.([a-z][a-z0-9]*|\*))*$/

export function validateTopic(topic: string): void {
  if (!TOPIC_REGEX.test(topic)) {
    throw createBrokerError({
      code: 'topic.invalid',
      category: 'topic',
      message: `Invalid topic name: "${topic}". Must match pattern <entity>.<action>.<status> (lowercase, dot-separated alphanumeric).`,
      details: { topic, regex: TOPIC_REGEX.source },
    })
  }
}

export function validateTopicPattern(pattern: string): void {
  if (!PATTERN_REGEX.test(pattern)) {
    throw createBrokerError({
      code: 'topic.pattern.invalid',
      category: 'topic',
      message: `Invalid topic pattern: "${pattern}". Each segment must be lowercase alphanumeric or '*'.`,
      details: { pattern, regex: PATTERN_REGEX.source },
    })
  }
}

interface TrieNode<T> {
  // children — key = segmento (o '*' per wildcard); value = nodo figlio.
  // Map mantiene insertion order, ma noi navigiamo esplicitamente exact + '*' separatamente.
  children: Map<string, TrieNode<T>>
  // subscribers — Set per garantire idempotenza dell'insert (D-08 implicito).
  subscribers: Set<T>
}

function createNode<T>(): TrieNode<T> {
  return { children: new Map(), subscribers: new Set() }
}

export class TopicTrie<T> {
  private root: TrieNode<T> = createNode()

  // insert(pattern, item) — registra `item` come subscriber per il `pattern`.
  // Pattern validato al call-site; segmenti splittati per `.` e walked nel trie
  // (creando nodi al volo se mancanti). Item aggiunto al Set finale (idempotente).
  insert(pattern: string, item: T): void {
    validateTopicPattern(pattern)
    const segments = pattern.split('.')
    let node = this.root
    for (const seg of segments) {
      let child = node.children.get(seg)
      if (!child) {
        child = createNode()
        node.children.set(seg, child)
      }
      node = child
    }
    node.subscribers.add(item)
  }

  // remove(pattern, item) — ritorna true se item era presente e rimosso, false altrimenti.
  // Cleanup: nodi senza subscribers e senza children vengono rimossi dal parent
  // (per evitare memory leak di branch dead).
  remove(pattern: string, item: T): boolean {
    const segments = pattern.split('.')
    return this.removeRecursive(this.root, segments, 0, item)
  }

  private removeRecursive(node: TrieNode<T>, segments: string[], idx: number, item: T): boolean {
    if (idx === segments.length) {
      return node.subscribers.delete(item)
    }
    const seg = segments[idx]
    if (seg === undefined) return false
    const child = node.children.get(seg)
    if (!child) return false
    const removed = this.removeRecursive(child, segments, idx + 1, item)
    // Cleanup branch vuoto post-rimozione (depth-first sweep)
    if (child.children.size === 0 && child.subscribers.size === 0) {
      node.children.delete(seg)
    }
    return removed
  }

  // match(topic) — ritorna tutti i subscribers che matchano il topic concreto.
  // Walk simultaneo del branch exact (segment-key) e del branch wildcard ('*'),
  // entrambi se presenti. Complessità O(segments_topic * 2^depth) worst-case
  // (ma con depth piccolo per topic reali — D-09).
  match(topic: string): T[] {
    validateTopic(topic)
    const segments = topic.split('.')
    const result: T[] = []
    this.matchRecursive(this.root, segments, 0, result)
    return result
  }

  private matchRecursive(node: TrieNode<T>, segments: string[], idx: number, result: T[]): void {
    if (idx === segments.length) {
      for (const sub of node.subscribers) result.push(sub)
      return
    }
    const seg = segments[idx]
    if (seg === undefined) return
    // Exact match — segue il branch col segmento esatto se presente
    const exact = node.children.get(seg)
    if (exact) this.matchRecursive(exact, segments, idx + 1, result)
    // Wildcard match — segue il branch '*' se presente (D-11: posizione qualsiasi)
    const wild = node.children.get('*')
    if (wild) this.matchRecursive(wild, segments, idx + 1, result)
  }

  // collectAllPatterns() — debug helper: ritorna tutti i pattern con almeno un
  // subscriber (per Inspector / getDebugSnapshot in F6). Walk depth-first.
  collectAllPatterns(): string[] {
    const out: string[] = []
    this.walk(this.root, [], out)
    return out
  }

  private walk(node: TrieNode<T>, path: string[], out: string[]): void {
    if (node.subscribers.size > 0) out.push(path.join('.'))
    for (const [seg, child] of node.children) {
      this.walk(child, [...path, seg], out)
    }
  }
}
