import { useState, type FormEvent } from 'react'
import type { ParentKind, PartnerSubtype, Person, PersonSearchResult } from '../../api/types'
import { Button } from '../../components/ui/Button'
import { SelectField, TextField } from '../../components/ui/Field'
import { parentsLabel, useDebounced, useSearchPeople } from '../search/api'
import { useAddRelative, type Target } from './api'
import { KIND_LABELS, PARTNER_LABELS, ROLE_LABELS, relationshipErrorMessage, type RelativeRole } from './labels'

interface Props {
  person: Person
  role: RelativeRole
  /** true quando o usuario veio de "Vincular pessoa existente" e ainda escolhe o papel. */
  chooseRole: boolean
  initialMode: 'new' | 'existing'
  onDone: (message: string) => void
  onCancel: () => void
}

function title(role: RelativeRole, name: string, mode: 'new' | 'existing'): string {
  const who = mode === 'new' ? 'Novo(a)' : 'Vincular'
  return `${who} ${ROLE_LABELS[role].toLowerCase()} de ${name}`
}

export function AddRelativeForm({ person, role: initialRole, chooseRole, initialMode, onDone, onCancel }: Props) {
  const [role, setRole] = useState(initialRole)
  const [mode, setMode] = useState(initialMode)
  const [name, setName] = useState('')
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState<PersonSearchResult | null>(null)
  const [kind, setKind] = useState<ParentKind>('BIOLOGICAL')
  const [partnerSubtype, setPartnerSubtype] = useState<PartnerSubtype>('PARTNERS')
  const [error, setError] = useState<string | null>(null)

  const add = useAddRelative()
  const term = useDebounced(search)
  const results = useSearchPeople(mode === 'existing' ? term : '')
  const candidates = (results.data ?? []).filter((p) => p.id !== person.id)

  const trimmedName = name.trim()
  const canSubmit = mode === 'new' ? trimmedName.length > 0 : picked !== null

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!canSubmit) {
      setError(mode === 'new' ? 'Digite o nome da pessoa.' : 'Escolha uma pessoa da lista.')
      return
    }
    const target: Target = mode === 'new' ? { type: 'new', name: trimmedName } : { type: 'existing', id: picked!.id }
    const otherName = mode === 'new' ? trimmedName : picked!.fullName
    try {
      await add.mutateAsync({ person, role, target, kind, partnerSubtype })
      onDone(`${otherName} foi vinculado(a) a ${person.fullName}.`)
    } catch (err) {
      setError(relationshipErrorMessage(err, { role, personName: person.fullName, otherName }))
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <h3 className="font-medium text-slate-900">{chooseRole ? `Vincular pessoa a ${person.fullName}` : title(role, person.fullName, mode)}</h3>

      {chooseRole && (
        <SelectField label="Essa pessoa é…" value={role} onChange={(e) => setRole(e.target.value as RelativeRole)}>
          {(Object.keys(ROLE_LABELS) as RelativeRole[]).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]} de {person.fullName}
            </option>
          ))}
        </SelectField>
      )}

      {mode === 'new' ? (
        <TextField
          label="Nome completo"
          autoComplete="off"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      ) : (
        <div className="space-y-2">
          <TextField
            label="Buscar pessoa já cadastrada"
            hint="Digite pelo menos 2 letras do nome."
            autoComplete="off"
            autoFocus
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPicked(null)
            }}
          />
          {picked && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              Escolhida: <strong>{picked.fullName}</strong>
            </p>
          )}
          {!picked && term.trim().length >= 2 && (
            <ul aria-label="Resultados da busca" className="divide-y divide-slate-200 rounded-lg border border-slate-200">
              {results.isPending && <li className="px-3 py-2 text-sm text-slate-600">Buscando…</li>}
              {results.isError && <li className="px-3 py-2 text-sm text-red-800">Não foi possível buscar.</li>}
              {results.data && candidates.length === 0 && (
                <li className="px-3 py-2 text-sm text-slate-600">Ninguém encontrado.</li>
              )}
              {candidates.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setPicked(p)}
                    className="block min-h-11 w-full px-3 py-2 text-left text-slate-900 hover:bg-slate-100
                      focus-visible:outline-2 focus-visible:outline-emerald-700"
                  >
                    <span className="block">{p.fullName}</span>
                    <span className="block text-sm text-slate-600">{parentsLabel(p)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {role === 'partner' ? (
        <SelectField
          label="Tipo de união"
          value={partnerSubtype}
          onChange={(e) => setPartnerSubtype(e.target.value as PartnerSubtype)}
        >
          {(Object.keys(PARTNER_LABELS) as PartnerSubtype[]).map((s) => (
            <option key={s} value={s}>
              {PARTNER_LABELS[s]}
            </option>
          ))}
        </SelectField>
      ) : (
        <SelectField
          label="Tipo de vínculo"
          hint="Na dúvida, deixe “Biológico”."
          value={kind}
          onChange={(e) => setKind(e.target.value as ParentKind)}
        >
          {(Object.keys(KIND_LABELS) as ParentKind[]).map((k) => (
            <option key={k} value={k}>
              {KIND_LABELS[k]}
            </option>
          ))}
        </SelectField>
      )}

      {!chooseRole && (
        <button
          type="button"
          onClick={() => {
            setMode(mode === 'new' ? 'existing' : 'new')
            setError(null)
          }}
          className="min-h-11 text-sm font-medium text-emerald-800 underline focus-visible:outline-2 focus-visible:outline-emerald-700"
        >
          {mode === 'new' ? 'Escolher alguém já cadastrado' : 'Cadastrar uma pessoa nova'}
        </button>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={add.isPending}>
          {mode === 'new' ? 'Adicionar' : 'Vincular'}
        </Button>
      </div>
    </form>
  )
}
