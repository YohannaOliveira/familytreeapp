import type { GraphRelationship, HiddenCount } from '../../api/types'

/** Limite de pessoas visiveis; acima disso o desenho fica pesado e ilegivel. */
export const MAX_VISIBLE = 500

export type Dir = 'up' | 'down'
export type Degree = HiddenCount

export const collapseKey = (id: string, dir: Dir) => `${id}:${dir}`

interface Graphish {
  focusId: string | null
  persons: Record<string, unknown>
  relationships: Record<string, GraphRelationship>
  collapsed: Record<string, true>
}

/** Grau (pais/filhos/parceiros) de cada pessoa considerando so as arestas que o cliente ja tem. */
export function loadedDegrees(rels: Iterable<GraphRelationship>): Record<string, Degree> {
  const out: Record<string, Degree> = {}
  const get = (id: string) => (out[id] ??= { parents: 0, children: 0, partners: 0 })
  for (const r of rels) {
    if (r.type === 'PARENT_OF') {
      get(r.toId).parents++
      get(r.fromId).children++
    } else {
      get(r.fromId).partners++
      get(r.toId).partners++
    }
  }
  return out
}

function excluded(r: GraphRelationship, collapsed: Record<string, true>): boolean {
  return r.type === 'PARENT_OF' && (collapsed[collapseKey(r.toId, 'up')] === true || collapsed[collapseKey(r.fromId, 'down')] === true)
}

function adjacency(rels: GraphRelationship[], collapsed: Record<string, true>): Map<string, string[]> {
  const adj = new Map<string, string[]>()
  const add = (a: string, b: string) => {
    const list = adj.get(a)
    if (list) list.push(b)
    else adj.set(a, [b])
  }
  for (const r of rels) {
    if (excluded(r, collapsed)) continue
    add(r.fromId, r.toId)
    add(r.toId, r.fromId)
  }
  return adj
}

/** Pessoas alcancaveis a partir do foco sem atravessar ramos recolhidos. */
export function visibleIds(g: Graphish): Set<string> {
  const seen = new Set<string>()
  if (!g.focusId || !g.persons[g.focusId]) return seen
  const adj = adjacency(Object.values(g.relationships), g.collapsed)
  const queue = [g.focusId]
  seen.add(g.focusId)
  while (queue.length > 0) {
    const id = queue.shift()!
    for (const next of adj.get(id) ?? []) {
      if (!seen.has(next) && g.persons[next]) {
        seen.add(next)
        queue.push(next)
      }
    }
  }
  return seen
}

/** Geracao relativa ao foco: pais -1, filhos +1, parceiros na mesma. A primeira alcancada vence (endogamia). */
export function generations(focusId: string, rels: GraphRelationship[], ids: Set<string>): Map<string, number> {
  const out = new Map<string, number>([[focusId, 0]])
  const adj = new Map<string, { id: string; delta: number }[]>()
  const add = (a: string, b: string, delta: number) => {
    const list = adj.get(a)
    if (list) list.push({ id: b, delta })
    else adj.set(a, [{ id: b, delta }])
  }
  for (const r of rels) {
    if (!ids.has(r.fromId) || !ids.has(r.toId)) continue
    if (r.type === 'PARENT_OF') {
      add(r.fromId, r.toId, 1)
      add(r.toId, r.fromId, -1)
    } else {
      add(r.fromId, r.toId, 0)
      add(r.toId, r.fromId, 0)
    }
  }
  const queue = [focusId]
  while (queue.length > 0) {
    const id = queue.shift()!
    for (const n of adj.get(id) ?? []) {
      if (!out.has(n.id)) {
        out.set(n.id, out.get(id)! + n.delta)
        queue.push(n.id)
      }
    }
  }
  return out
}

export interface FamilyGroup {
  id: string
  parentIds: string[]
  childIds: string[]
}

/** Pais agrupados por filhos em comum (meio-irmaos ficam em familias diferentes). */
export function deriveFamilies(rels: GraphRelationship[], ids: Set<string>): FamilyGroup[] {
  const parentsOf = new Map<string, Set<string>>()
  for (const r of rels) {
    if (r.type !== 'PARENT_OF' || !ids.has(r.fromId) || !ids.has(r.toId)) continue
    const set = parentsOf.get(r.toId)
    if (set) set.add(r.fromId)
    else parentsOf.set(r.toId, new Set([r.fromId]))
  }
  const grouped = new Map<string, FamilyGroup>()
  for (const [child, parents] of parentsOf) {
    const sorted = [...parents].sort()
    const key = sorted.join('+')
    const g = grouped.get(key)
    if (g) g.childIds.push(child)
    else grouped.set(key, { id: `fam:${key}`, parentIds: sorted, childIds: [child] })
  }
  return [...grouped.values()].sort((a, b) => a.id.localeCompare(b.id))
}

/** Antepassados e descendentes diretos de `id` (inclui ele mesmo) para destacar a linhagem. */
export function lineage(rels: GraphRelationship[], id: string): Set<string> {
  const up = new Map<string, string[]>()
  const down = new Map<string, string[]>()
  for (const r of rels) {
    if (r.type !== 'PARENT_OF') continue
    ;(up.get(r.toId) ?? up.set(r.toId, []).get(r.toId)!).push(r.fromId)
    ;(down.get(r.fromId) ?? down.set(r.fromId, []).get(r.fromId)!).push(r.toId)
  }
  const out = new Set([id])
  for (const map of [up, down]) {
    const queue = [id]
    while (queue.length > 0) {
      for (const n of map.get(queue.shift()!) ?? []) {
        if (!out.has(n)) {
          out.add(n)
          queue.push(n)
        }
      }
    }
  }
  return out
}
