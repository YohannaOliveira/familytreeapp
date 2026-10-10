import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { GraphPerson } from '../../api/types'
import { collapseKey, deriveFamilies, generations, lineage, loadedDegrees, visibleIds, type Dir } from './derive'
import { computeLayout, FAMILY_SIZE, PERSON_H, PERSON_W, type Positions } from './layout'
import { FamilyNode, GraphActionsContext, PersonNode, type Chip, type PersonNodeData } from './nodes'
import { hiddenOf, useGraph } from './store'

const nodeTypes = { person: PersonNode, family: FamilyNode }

interface Props {
  selectedId: string | null
  onSelect: (person: GraphPerson | null) => void
  onExpand: (id: string, dir: Dir | 'partners') => void
  onVisibleCount: (n: number) => void
}

function chipFor(hidden: number, loaded: number, collapsed: boolean): Chip {
  if (hidden > 0) return { kind: 'expand', count: hidden }
  if (collapsed) return { kind: 'show' }
  if (loaded > 0) return { kind: 'collapse' }
  return null
}

function edgeStyle(color: string, dashed: boolean, faded: boolean) {
  return { stroke: color, strokeWidth: 2, strokeDasharray: dashed ? '6 4' : undefined, opacity: faded ? 0.15 : 1 }
}

function GraphCanvas({ selectedId, onSelect, onExpand, onVisibleCount }: Props) {
  const { focusId, persons, relationships, totals, collapsed, toggleCollapsed } = useGraph()
  const flow = useReactFlow()
  const [positions, setPositions] = useState<Positions>({})
  const [layingOut, setLayingOut] = useState(false)
  const fitted = useRef<string | null>(null)

  const model = useMemo(() => {
    const rels = Object.values(relationships)
    const ids = visibleIds({ focusId, persons, relationships, collapsed })
    const gens = focusId ? generations(focusId, rels, ids) : new Map<string, number>()
    const families = deriveFamilies(rels, ids)
    // Casal com filhos em comum ja fica junto pela familia; so desenha ligacao direta para os demais.
    const coParented = (a: string, b: string) => families.some((f) => f.parentIds.includes(a) && f.parentIds.includes(b))
    const partnerPairs: [string, string][] = rels
      .filter((r) => r.type === 'PARTNER' && ids.has(r.fromId) && ids.has(r.toId) && !coParented(r.fromId, r.toId))
      .map((r) => [r.fromId, r.toId])
    return { rels, ids, gens, families, partnerPairs, degrees: loadedDegrees(rels) }
  }, [focusId, persons, relationships, collapsed])

  useEffect(() => onVisibleCount(model.ids.size), [model.ids.size, onVisibleCount])

  // So recalcula o layout quando a estrutura muda (nao a cada selecao/zoom).
  const signature = useMemo(
    () =>
      [
        [...model.ids].sort().join(','),
        model.families.map((f) => `${f.id}>${f.childIds.join(',')}`).join(';'),
        model.partnerPairs.map((p) => p.join('~')).join(';'),
      ].join('|'),
    [model],
  )

  useEffect(() => {
    if (model.ids.size === 0) return
    let cancelled = false
    setLayingOut(true)
    const gen = (id: string) => model.gens.get(id) ?? 0
    computeLayout({
      persons: [...model.ids].map((id) => ({ id, generation: gen(id) })),
      families: model.families.map((f) => ({
        id: f.id,
        parentIds: f.parentIds,
        childIds: f.childIds,
        generation: Math.min(...f.parentIds.map(gen)),
      })),
      partnerPairs: model.partnerPairs,
    })
      .then((pos) => {
        if (cancelled) return
        setPositions(pos)
        setLayingOut(false)
      })
      .catch(() => {
        if (!cancelled) setLayingOut(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  // Ao carregar um novo foco: enquadra tudo (grafo pequeno) ou centraliza nele (grafo grande).
  useEffect(() => {
    if (!focusId || layingOut || !positions[focusId] || fitted.current === focusId) return
    fitted.current = focusId
    const p = positions[focusId]
    if (model.ids.size <= 25) flow.fitView({ padding: 0.2, maxZoom: 1, duration: 400 })
    else flow.setCenter(p.x + PERSON_W / 2, p.y + PERSON_H / 2, { zoom: 0.8, duration: 400 })
  }, [focusId, layingOut, positions, model.ids.size, flow])

  const highlight = useMemo(() => (selectedId ? lineage(model.rels, selectedId) : null), [selectedId, model.rels])

  const { nodes, edges } = useMemo(() => {
    const hidden = hiddenOf({ totals, relationships }, model.degrees)
    const nodes: Node[] = []
    const edges: Edge[] = []
    const dim = (id: string) => highlight !== null && !highlight.has(id)

    for (const id of model.ids) {
      const pos = positions[id]
      const person = persons[id]
      if (!pos || !person) continue
      const h = hidden(id)
      const deg = model.degrees[id] ?? { parents: 0, children: 0, partners: 0 }
      const data: PersonNodeData = {
        name: person.fullName,
        gender: person.gender,
        generation: model.gens.get(id) ?? 0,
        isFocus: id === focusId,
        selected: id === selectedId,
        dimmed: dim(id),
        up: chipFor(h.parents, deg.parents, collapsed[collapseKey(id, 'up')] === true),
        down: chipFor(h.children, deg.children, collapsed[collapseKey(id, 'down')] === true),
        partners: h.partners > 0 ? { kind: 'expand', count: h.partners } : null,
      }
      nodes.push({ id, type: 'person', position: pos, data, width: PERSON_W, height: PERSON_H })
    }

    // "paiId>filhoId" -> true se o vinculo NAO e biologico (tracejado na tela).
    const nonBio = new Map<string, boolean>()
    for (const r of model.rels) if (r.type === 'PARENT_OF') nonBio.set(`${r.fromId}>${r.toId}`, r.kind !== 'BIOLOGICAL')

    for (const f of model.families) {
      const pos = positions[f.id]
      if (!pos) continue
      const lit = highlight === null || (f.parentIds.some((p) => highlight.has(p)) && f.childIds.some((c) => highlight.has(c)))
      nodes.push({
        id: f.id,
        type: 'family',
        position: pos,
        data: { dimmed: !lit },
        width: FAMILY_SIZE,
        height: FAMILY_SIZE,
        selectable: false,
        draggable: false,
      })
      for (const p of f.parentIds) {
        const non = f.childIds.every((c) => nonBio.get(`${p}>${c}`) !== false)
        edges.push({
          id: `${p}>${f.id}`,
          source: p,
          target: f.id,
          sourceHandle: 'b',
          targetHandle: 't',
          type: 'smoothstep',
          style: edgeStyle('#475569', non, dim(p)),
        })
      }
      for (const c of f.childIds) {
        const non = f.parentIds.every((p) => nonBio.get(`${p}>${c}`) !== false)
        edges.push({
          id: `${f.id}>${c}`,
          source: f.id,
          target: c,
          sourceHandle: 'b',
          targetHandle: 't',
          type: 'smoothstep',
          style: edgeStyle('#475569', non, dim(c)),
        })
      }
    }

    for (const [a, b] of model.partnerPairs) {
      const pa = positions[a]
      const pb = positions[b]
      if (!pa || !pb) continue
      const [left, right] = pa.x <= pb.x ? [a, b] : [b, a]
      edges.push({
        id: `${a}~${b}`,
        source: left,
        target: right,
        sourceHandle: 'r',
        targetHandle: 'l',
        type: 'straight',
        style: edgeStyle('#be185d', false, dim(a) || dim(b)),
      })
    }
    return { nodes, edges }
  }, [model, positions, persons, relationships, totals, collapsed, focusId, selectedId, highlight])

  const actions = useMemo(() => ({ expand: onExpand, toggle: toggleCollapsed }), [onExpand, toggleCollapsed])

  return (
    <GraphActionsContext.Provider value={actions}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onlyRenderVisibleElements
        nodesDraggable={false}
        nodesConnectable={false}
        minZoom={0.05}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_, node) => {
          if (node.type !== 'person') return
          const p = persons[node.id]
          if (!p) return
          onSelect(p)
          const pos = positions[node.id]
          if (pos) {
            flow.setCenter(pos.x + PERSON_W / 2, pos.y + PERSON_H / 2, {
              zoom: Math.max(flow.getZoom(), 0.8),
              duration: 500,
            })
          }
        }}
        onPaneClick={() => onSelect(null)}
      >
        <Background />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable nodeColor={(n) => (n.type === 'family' ? '#94a3b8' : '#10b981')} />
      </ReactFlow>
      {layingOut && (
        <p
          role="status"
          className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-white px-4 py-1 text-sm text-slate-700 shadow"
        >
          Organizando a árvore…
        </p>
      )}
    </GraphActionsContext.Provider>
  )
}

export function GraphView(props: Props) {
  return (
    <ReactFlowProvider>
      <GraphCanvas {...props} />
    </ReactFlowProvider>
  )
}
