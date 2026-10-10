import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../api/client'
import type { Person, PersonInput } from '../api/types'
import { Button } from '../components/ui/Button'
import { BottomSheet } from '../components/ui/Dialog'
import { toast } from '../components/ui/toast'
import { PAGE_SIZE, useDeletePerson, usePeople, useSavePerson } from '../features/people/api'
import { DeletePersonDialog } from '../features/people/DeletePersonDialog'
import { PersonForm } from '../features/people/PersonForm'
import { GENDER_LABELS } from '../features/people/schema'
import { FamilyPanel } from '../features/relationships/FamilyPanel'

type Panel = { mode: 'create' } | { mode: 'edit'; person: Person } | null

export function PeoplePage() {
  const [page, setPage] = useState(0)
  const [panel, setPanel] = useState<Panel>(null)
  const [toDelete, setToDelete] = useState<Person | null>(null)
  const [familyOf, setFamilyOf] = useState<Person | null>(null)

  const people = usePeople(page)
  const save = useSavePerson()
  const remove = useDeletePerson()

  const data = people.data
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  // Se a ultima pagina ficou vazia (ex.: excluiu o unico item dela), volta uma pagina.
  useEffect(() => {
    if (data && data.items.length === 0 && page > 0) setPage(page - 1)
  }, [data, page])

  async function handleSave(input: PersonInput) {
    const editing = panel?.mode === 'edit' ? panel.person : undefined
    await save.mutateAsync({ id: editing?.id, input })
    toast.success(editing ? 'Alterações salvas.' : `${input.fullName} foi adicionada à família.`)
    setPanel(null)
  }

  async function handleDelete() {
    if (!toDelete) return
    try {
      await remove.mutateAsync(toDelete.id)
      toast.success(`${toDelete.fullName} foi excluída.`)
      setToDelete(null)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível excluir.')
    }
  }

  return (
    <section aria-labelledby="people-title">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 id="people-title" className="text-2xl font-semibold text-slate-900">
          Pessoas
        </h1>
        {data && data.total > 0 && <Button onClick={() => setPanel({ mode: 'create' })}>Adicionar pessoa</Button>}
      </div>

      {people.isPending && <p className="py-10 text-center text-slate-600">Carregando…</p>}

      {people.isError && (
        <div role="alert" className="rounded-lg bg-red-50 p-4 text-red-900">
          <p className="mb-3">
            {people.error instanceof ApiError ? people.error.message : 'Não foi possível carregar a lista.'}
          </p>
          <Button variant="secondary" onClick={() => people.refetch()}>
            Tentar de novo
          </Button>
        </div>
      )}

      {data && data.total === 0 && (
        <div className="rounded-xl border border-dashed border-slate-400 bg-white px-6 py-12 text-center">
          <p className="mb-1 text-lg font-medium text-slate-900">Ainda não há ninguém na família</p>
          <p className="mb-5 text-slate-600">Comece cadastrando a primeira pessoa.</p>
          <Button onClick={() => setPanel({ mode: 'create' })}>Adicionar a primeira pessoa</Button>
        </div>
      )}

      {data && data.total > 0 && (
        <>
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {data.items.map((person) => (
              <li key={person.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{person.fullName}</p>
                  <p className="text-sm text-slate-600">
                    {person.gender ? GENDER_LABELS[person.gender] : 'Sexo não informado'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    to={`/tree/${person.id}`}
                    aria-label={`Ver árvore de ${person.fullName}`}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2
                      text-base font-medium text-slate-800 hover:bg-slate-100 focus-visible:outline-2
                      focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                  >
                    Árvore
                  </Link>
                  <Button
                    variant="secondary"
                    aria-label={`Família de ${person.fullName}`}
                    onClick={() => setFamilyOf(person)}
                  >
                    Família
                  </Button>
                  <Button
                    variant="secondary"
                    aria-label={`Editar ${person.fullName}`}
                    onClick={() => setPanel({ mode: 'edit', person })}
                  >
                    Editar
                  </Button>
                  <Button variant="secondary" aria-label={`Excluir ${person.fullName}`} onClick={() => setToDelete(person)}>
                    Excluir
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          <nav aria-label="Páginas" className="mt-4 flex items-center justify-between gap-3">
            <Button variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>
              Anterior
            </Button>
            <p className="text-sm text-slate-700">
              Página {page + 1} de {totalPages} · {data.total} {data.total === 1 ? 'pessoa' : 'pessoas'}
            </p>
            <Button variant="secondary" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>
              Próxima
            </Button>
          </nav>
        </>
      )}

      <BottomSheet
        open={panel !== null}
        title={panel?.mode === 'edit' ? 'Editar pessoa' : 'Adicionar pessoa'}
        onClose={() => setPanel(null)}
      >
        {panel && (
          <PersonForm
            key={panel.mode === 'edit' ? panel.person.id : 'new'}
            person={panel.mode === 'edit' ? panel.person : undefined}
            onSubmit={handleSave}
            onCancel={() => setPanel(null)}
          />
        )}
      </BottomSheet>

      <BottomSheet
        open={familyOf !== null}
        title={familyOf ? `Família de ${familyOf.fullName}` : ''}
        onClose={() => setFamilyOf(null)}
      >
        {familyOf && <FamilyPanel key={familyOf.id} person={familyOf} />}
      </BottomSheet>

      <DeletePersonDialog
        person={toDelete}
        deleting={remove.isPending}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </section>
  )
}
