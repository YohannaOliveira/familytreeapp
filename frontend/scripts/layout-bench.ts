// Mede o tempo do layout ELK com os mesmos dados/opcoes da UI (sem navegador: ELK bundled, thread principal).
// Uso: node scripts/layout-bench.ts [--api http://localhost:8081] [--pass bench-pass] [--focus <uuid>]
// Pre-requisito: backend + banco semeado (tools/seed). Node 22.18+/24 (executa TypeScript direto).
import ELK from 'elkjs/lib/elk.bundled.js'
import { buildElkGraph } from '../src/features/graph/elkGraph.ts'
import { deriveFamilies, generations, visibleIds } from '../src/features/graph/derive.ts'

const args = Object.fromEntries(process.argv.slice(2).flatMap((v, i, a) => (v.startsWith('--') ? [[v.slice(2), a[i + 1]]] : [])))
const API = args.api ?? 'http://localhost:8081'

const login = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: args.pass ?? 'bench-pass' }),
})
const token = (await login.json()).accessToken
const get = async (path: string) => (await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } })).json()

let focus = args.focus
if (!focus) focus = (await get('/api/v1/people?size=1')).items?.[0]?.id ?? (await get('/api/v1/people?size=1')).content?.[0]?.id
const elk = new ELK()
// Experimentos: ELK_OPTS='{"elk.layered.thoroughness":"1"}' sobrescreve opcoes do layout.
const extra = JSON.parse(process.env.ELK_OPTS ?? '{}')
const mem = () => Math.round(process.memoryUsage().heapUsed / 1048576)

for (const [label, q] of (process.env.ONLY ? [['10/10', 'up=10&down=10']] : [['2/2', 'up=2&down=2'], ['4/4', 'up=4&down=4'], ['10/10', 'up=10&down=10']])) {
  const g = await get(`/api/v1/graph?focus=${focus}&${q}`)
  const persons = Object.fromEntries(g.persons.map((p: { id: string }) => [p.id, p]))
  const relationships = Object.fromEntries(g.relationships.map((r: { id: string }) => [r.id, r]))
  const rels = Object.values(relationships) as never[]
  const ids = visibleIds({ focusId: focus, persons, relationships, collapsed: {} } as never)
  const gens = generations(focus!, rels, ids)
  const families = deriveFamilies(rels, ids)
  const co = (a: string, b: string) => families.some((f) => f.parentIds.includes(a) && f.parentIds.includes(b))
  const partnerPairs = (rels as { type: string; fromId: string; toId: string }[])
    .filter((r) => r.type === 'PARTNER' && ids.has(r.fromId) && ids.has(r.toId) && !co(r.fromId, r.toId))
    .map((r) => [r.fromId, r.toId] as [string, string])
  const gen = (id: string) => gens.get(id) ?? 0
  const input = {
    persons: [...ids].map((id) => ({ id, generation: gen(id) })),
    families: families.map((f) => ({ id: f.id, parentIds: f.parentIds, childIds: f.childIds, generation: Math.min(...f.parentIds.map(gen)) })),
    partnerPairs,
  }
  const times: number[] = []
  for (let i = 0; i < (process.env.ONLY ? 2 : 6); i++) {
    const t0 = performance.now()
    const graph = buildElkGraph(input)
    Object.assign(graph.layoutOptions!, extra)
    await elk.layout(graph)
    times.push(performance.now() - t0)
  }
  const cold = times[0]
  const warm = times.slice(1).sort((a, b) => a - b)
  console.log(`${label}: ${ids.size} nos, ${families.length} familias, ${partnerPairs.length} pares | ELK 1a=${cold.toFixed(0)} ms, mediana=${warm[Math.floor(warm.length / 2)].toFixed(0)} ms | heap Node=${mem()} MB`)
}
