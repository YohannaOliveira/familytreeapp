import { useState } from 'react'
import { ApiError } from '../../api/client'
import type { Person, PersonRelationship } from '../../api/types'
import { Button } from '../../components/ui/Button'
import { toast } from '../../components/ui/toast'
import { useRelationships, useRelatives, useRemoveRelationship } from './api'
import { AddRelativeForm } from './AddRelativeForm'
import { ROLE_LABELS, relationshipDetail, type RelativeRole } from './labels'

type View =
  | { name: 'list' }
  | { name: 'add'; role: RelativeRole; chooseRole: boolean; mode: 'new' | 'existing' }
  | { name: 'remove'; rel: PersonRelationship }

const ACTIONS: RelativeRole[] = ['father', 'mother', 'child', 'partner']

interface GroupProps {
  title: string
  items: PersonRelationship[]
  onRemove: (rel: PersonRelationship) => void
}

function Group({ title, items, onRemove }: GroupProps) {
  if (items.length === 0) return null
  return (
    <section aria-label={title}>
      <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-600">{title}</h3>
      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
        {items.map((rel) => {
          const detail = relationshipDetail(rel)
          return (
            <li key={rel.relationshipId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">{rel.person.fullName}</p>
                {detail && <p className="text-sm text-slate-600">{detail}</p>}
              </div>
              <Button
                variant="secondary"
                aria-label={`Remover vínculo com ${rel.person.fullName}`}
                onClick={() => onRemove(rel)}
              >
                Remover vínculo
              </Button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function FamilyPanel({ person }: { person: Person }) {
  const [view, setView] = useState<View>({ name: 'list' })
  const relationships = useRelationships(person.id)
  const relatives = useRelatives(person.id)
  const remove = useRemoveRelationship()

  const back = () => setView({ name: 'list' })

  async function confirmRemove(rel: PersonRelationship) {
    try {
      await remove.mutateAsync(rel.relationshipId)
      toast.success(`O vínculo entre ${person.fullName} e ${rel.person.fullName} foi removido.`)
      back()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível remover o vínculo.')
    }
  }

  if (view.name === 'add') {
    return (
      <AddRelativeForm
        person={person}
        role={view.role}
        chooseRole={view.chooseRole}
        initialMode={view.mode}
        onCancel={back}
        onDone={(message) => {
          toast.success(message)
          back()
        }}
      />
    )
  }

  if (view.name === 'remove') {
    const { rel } = view
    return (
      <div className="space-y-4">
        <p className="text-slate-800">
          Remover o vínculo entre <strong>{person.fullName}</strong> e <strong>{rel.person.fullName}</strong>?
        </p>
        <p className="text-sm text-slate-600">As duas pessoas continuam cadastradas; só a ligação familiar é desfeita.</p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={back}>
            Cancelar
          </Button>
          <Button variant="danger" loading={remove.isPending} onClick={() => confirmRemove(rel)}>
            Remover vínculo
          </Button>
        </div>
      </div>
    )
  }

  const rels = relationships.data ?? []
  const parents = rels.filter((r) => r.role === 'PARENT')
  const children = rels.filter((r) => r.role === 'CHILD')
  const partners = rels.filter((r) => r.role === 'PARTNER')
  const siblings = [...(relatives.data?.siblings ?? []), ...(relatives.data?.halfSiblings ?? [])]
  const halfIds = new Set((relatives.data?.halfSiblings ?? []).map((s) => s.id))

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2">
        {ACTIONS.map((role) => (
          <Button
            key={role}
            variant="secondary"
            onClick={() => setView({ name: 'add', role, chooseRole: false, mode: 'new' })}
          >
            + {ROLE_LABELS[role]}
          </Button>
        ))}
        <Button
          variant="secondary"
          className="col-span-2"
          onClick={() => setView({ name: 'add', role: 'father', chooseRole: true, mode: 'existing' })}
        >
          Vincular pessoa existente
        </Button>
      </div>

      {relationships.isPending && <p className="text-slate-600">Carregando a família…</p>}
      {relationships.isError && (
        <div role="alert" className="rounded-lg bg-red-50 p-3 text-red-900">
          <p className="mb-2">Não foi possível carregar os parentes.</p>
          <Button variant="secondary" onClick={() => relationships.refetch()}>
            Tentar de novo
          </Button>
        </div>
      )}

      {relationships.data && rels.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-400 px-4 py-6 text-center text-slate-600">
          {person.fullName} ainda não tem parentes ligados. Use os botões acima para começar.
        </p>
      )}

      <Group title="Pais" items={parents} onRemove={(rel) => setView({ name: 'remove', rel })} />
      <Group title="Cônjuges e parceiros" items={partners} onRemove={(rel) => setView({ name: 'remove', rel })} />
      <Group title="Filhos" items={children} onRemove={(rel) => setView({ name: 'remove', rel })} />

      {siblings.length > 0 && (
        <section aria-label="Irmãos">
          <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-600">Irmãos</h3>
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
            {siblings.map((s) => (
              <li key={s.id} className="px-3 py-2">
                <p className="font-medium text-slate-900">{s.fullName}</p>
                {halfIds.has(s.id) && <p className="text-sm text-slate-600">meio-irmão(ã)</p>}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-sm text-slate-600">Irmãos vêm dos pais em comum; para mudar, ajuste os pais.</p>
        </section>
      )}
    </div>
  )
}
