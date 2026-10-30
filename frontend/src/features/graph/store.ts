import { create } from 'zustand'
import type { GraphPerson, GraphRelationship, GraphResponse } from '../../api/types'
import { collapseKey, loadedDegrees, type Degree, type Dir } from './derive'

interface GraphState {
  focusId: string | null
  /** Tudo normalizado por id: uma pessoa/aresta so existe uma vez, venha de quantas respostas vier. */
  persons: Record<string, GraphPerson>
  relationships: Record<string, GraphRelationship>
  /** Grau real de cada pessoa no servidor (arestas conhecidas + ocultas na resposta). */
  totals: Record<string, Degree>
  collapsed: Record<string, true>
  truncated: boolean
  load: (resp: GraphResponse) => void
  merge: (resp: GraphResponse) => void
  toggleCollapsed: (id: string, dir: Dir) => void
  reset: () => void
}

const empty = {
  focusId: null,
  persons: {},
  relationships: {},
  totals: {},
  collapsed: {},
  truncated: false,
}

/** Grau real das pessoas da resposta: arestas dentro dela + vizinhos que ficaram de fora. */
function responseTotals(resp: GraphResponse): Record<string, Degree> {
  const inResp = loadedDegrees(resp.relationships)
  const ids = new Set([resp.focusId, ...resp.persons.map((p) => p.id)])
  const out: Record<string, Degree> = {}
  for (const id of ids) {
    const loaded = inResp[id] ?? { parents: 0, children: 0, partners: 0 }
    const hidden = resp.hiddenCounts[id] ?? { parents: 0, children: 0, partners: 0 }
    out[id] = {
      parents: loaded.parents + hidden.parents,
      children: loaded.children + hidden.children,
      partners: loaded.partners + hidden.partners,
    }
  }
  return out
}

function mergeInto(state: Pick<GraphState, 'persons' | 'relationships' | 'totals'>, resp: GraphResponse) {
  const persons = { ...state.persons }
  for (const p of resp.persons) persons[p.id] = p
  const relationships = { ...state.relationships }
  for (const r of resp.relationships) relationships[r.id] = r
  return { persons, relationships, totals: { ...state.totals, ...responseTotals(resp) } }
}

export const useGraph = create<GraphState>((set) => ({
  ...empty,
  load: (resp) =>
    set({ ...empty, focusId: resp.focusId, truncated: resp.truncated, ...mergeInto(empty, resp) }),
  // Na expansao o foco da resposta e a pessoa expandida; o foco da tela nao muda.
  merge: (resp) =>
    set((s) => ({ ...mergeInto(s, resp), truncated: s.truncated || resp.truncated })),
  toggleCollapsed: (id, dir) =>
    set((s) => {
      const key = collapseKey(id, dir)
      const collapsed = { ...s.collapsed }
      if (collapsed[key]) delete collapsed[key]
      else collapsed[key] = true
      return { collapsed }
    }),
  reset: () => set({ ...empty }),
}))

/** Quantos vizinhos de `id` o servidor tem e o cliente ainda nao baixou. */
export function hiddenOf(
  s: Pick<GraphState, 'totals' | 'relationships'>,
  degrees: Record<string, Degree> = loadedDegrees(Object.values(s.relationships)),
): (id: string) => Degree {
  return (id) => {
    const total = s.totals[id]
    const have = degrees[id] ?? { parents: 0, children: 0, partners: 0 }
    return {
      parents: Math.max(0, (total?.parents ?? 0) - have.parents),
      children: Math.max(0, (total?.children ?? 0) - have.children),
      partners: Math.max(0, (total?.partners ?? 0) - have.partners),
    }
  }
}
