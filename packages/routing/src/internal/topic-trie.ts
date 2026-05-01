// internal/topic-trie.ts — Mirror copy di packages/core/src/core/topic-matcher.ts.
// RAGIONE: TopicTrie non è esposto pubblicamente da @sembridge/core (internal-only F1).
// Per evitare cross-package internal coupling, F3 mantiene una copia interna ≤120 LOC.
// RIMUOVERE quando F1 esporrà '@sembridge/core/internal' subpath o equivalente.
// Vincolo D-83: ZERO modifiche a packages/core/.
//
// Riferimento decisioni F1 (01-CONTEXT.md):
// - D-08: TopicTrie segmentato (split by '.') con `*` come full segment wildcard.
// - D-09: complessità match = O(s) dove s = numero di segmenti del topic pubblicato.
// - D-10: `*` è full-segment wildcard, NON char-by-char.
// - D-11: `*` può comparire in posizione intermedia.
// - D-24: regex topic naming = lowercase, dot-separated, alfanumerico.

import { createBrokerError } from '@sembridge/core'

// Topic regex: D-24 — primo char alfabetico minuscolo, segmenti dot-separated.
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
  children: Map<string, TrieNode<T>>
  subscribers: Set<T>
}

function createNode<T>(): TrieNode<T> {
  return { children: new Map(), subscribers: new Set() }
}

export class TopicTrie<T> {
  private root: TrieNode<T> = createNode()

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
    if (child.children.size === 0 && child.subscribers.size === 0) {
      node.children.delete(seg)
    }
    return removed
  }

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
    const exact = node.children.get(seg)
    if (exact) this.matchRecursive(exact, segments, idx + 1, result)
    const wild = node.children.get('*')
    if (wild) this.matchRecursive(wild, segments, idx + 1, result)
  }

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
