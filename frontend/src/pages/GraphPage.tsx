import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import type { GraphPerson, GraphResponse, Person } from '../api/types'
import { Button } from '../components/ui/Button'
import { BottomSheet } from '../components/ui/Dialog'
import { toast } from '../components/ui/toast'
import type { Dir } from '../features/graph/derive'
import { MAX_VISIBLE } from '../features/graph/derive'
import { useFocusHistory } from '../features/graph/history'
import { GraphView } from '../features/graph/GraphView'
import { useGraph } from '../features/graph/store'
import { FamilyPanel } from '../features/relationships/FamilyPanel'

/** Visual padrao: 2 geracoes para cima e para baixo, com parceiros. */
const graphKey = (id: string) => ['graph', id] as const

export function GraphPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [selected, setSelected] = useState<GraphPerson | null>(null)
  const [detail, setDetail] = useState<GraphPerson | null>(null)
  const [visibleCount, setVisibleCount] = useState(0)
  const inFlight = useRef(new Set<string>())

  const query = useQuery({
    queryKey: graphKey(id),
    queryFn: () => api<GraphResponse>(`/api/v1/graph?focus=${id}&up=2&down=2&partners=true`),
    staleTime: Infinity,
  })
  const truncated = useGraph((s) => s.truncated)
  const focusName = useGraph((s) => (s.focusId ? s.persons[s.focusId]?.fullName : undefined))

  useEffect(() => {
    if (query.data) useGraph.getState().load(query.data)
    return () => useGraph.getState().reset()
  }, [query.data])

  // Trilha de focos visitados (breadcrumbs / "voltar ao foco anterior").
  const trail = useFocusHistory((s) => s.trail)
  useEffect(() => {
    if (query.data && focusName && query.data.focusId === id) useFocusHistory.getState().visit({ id, name: focusName })
  }, [query.data, focusName, id])
  const previous = trail.length >= 2 && trail[trail.length - 1].id === id ? trail[trail.length - 2] : null

  useEffect(() => {
    setSelected(null)
    setDetail(null)
  }, [id])

  const expand = useCallback(async (personId: string, dir: Dir | 'partners') => {
    const key = `${personId}:${dir}`
    if (inFlight.current.has(key)) return
    if (visibleCountRef.current >= MAX_VISIBLE) {
      toast.error(`Já há ${MAX_VISIBLE} pessoas na tela. Recolha algum ramo ou escolha outra pessoa como foco.`)
      return
    }
    inFlight.current.add(key)
    try {
      const resp = await api<GraphResponse>(`/api/v1/graph/expand/${personId}?direction=${dir}`)
      useGraph.getState().merge(resp)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível carregar mais parentes.')
    } finally {
      inFlight.current.delete(key)
    }
  }, [])

  const visibleCountRef = useRef(0)
  visibleCountRef.current = visibleCount

  const limitReached = visibleCount >= MAX_VISIBLE || truncated

  return (
    <section aria-labelledby="graph-title" className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-2">
        <Link to="/" className="min-h-11 content-center text-sm font-medium text-emerald-800 underline">
          ← Pessoas
        </Link>
        <h1 id="graph-title" className="min-w-0 flex-1 truncate text-lg font-semibold text-slate-900">
          {focusName ? `Família de ${focusName}` : 'Árvore'}
        </h1>
        <p className="hidden text-sm text-slate-600 md:block">
          Clique numa pessoa para ver detalhes e destacar a linhagem. <span aria-hidden="true">┄</span> tracejado = vínculo não biológico.
        </p>
      </div>

      {trail.length >= 2 && (
        <nav aria-label="Focos visitados" className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-1">
          {previous && (
            <Button variant="secondary" className="shrink-0" onClick={() => navigate(`/tree/${previous.id}`)}>
              ← Voltar a {previous.name}
            </Button>
          )}
          <ol className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto whitespace-nowrap text-sm text-slate-700">
            {trail.map((entry, i) => (
              <li key={entry.id} className="flex items-center gap-1">
                {i > 0 && <span aria-hidden="true">›</span>}
                {entry.id === id ? (
                  <span aria-current="page" className="font-semibold text-slate-900">
                    {entry.name}
                  </span>
                ) : (
                  <Link to={`/tree/${entry.id}`} className="inline-flex min-h-11 items-center underline">
                    {entry.name}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}

      {limitReached && (
        <p role="status" className="bg-amber-50 px-4 py-2 text-sm text-amber-900">
          Muita gente na tela ({visibleCount} pessoas): para manter a fluidez, nem todos os parentes são mostrados. Recolha
          ramos ou escolha outra pessoa como foco.
        </p>
      )}

      <div className="relative min-h-0 flex-1">
        {query.isPending && <p className="p-6 text-center text-slate-600">Carregando a árvore…</p>}
        {query.isError && (
          <div role="alert" className="m-4 rounded-lg bg-red-50 p-4 text-red-900">
            <p className="mb-3">
              {query.error instanceof ApiError ? query.error.message : 'Não foi possível carregar a árvore.'}
            </p>
            <Button variant="secondary" onClick={() => query.refetch()}>
              Tentar de novo
            </Button>
          </div>
        )}
        {query.data && (
          <GraphView
            selectedId={selected?.id ?? null}
            onSelect={(p) => {
              setSelected(p)
              if (p) setDetail(p)
            }}
            onExpand={expand}
            onVisibleCount={setVisibleCount}
          />
        )}
      </div>

      <BottomSheet open={detail !== null} title={detail?.fullName ?? ''} onClose={() => setDetail(null)}>
        {detail && (
          <div className="space-y-5">
            {detail.id !== id && (
              <Button className="w-full" onClick={() => navigate(`/tree/${detail.id}`)}>
                Ver a árvore a partir de {detail.fullName}
              </Button>
            )}
            <FamilyPanel
              key={detail.id}
              person={{ ...detail, notes: null, createdAt: '', updatedAt: '' } satisfies Person}
            />
          </div>
        )}
      </BottomSheet>
    </section>
  )
}
