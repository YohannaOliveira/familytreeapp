import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import type {
  Gender,
  ParentKind,
  PartnerSubtype,
  Person,
  PersonRelationship,
  RelationshipInput,
  Relatives,
} from '../../api/types'
import type { RelativeRole } from './labels'

export function useRelationships(personId: string) {
  return useQuery({
    queryKey: ['people', personId, 'relationship-list'],
    queryFn: () => api<PersonRelationship[]>(`/api/v1/people/${personId}/relationships`),
  })
}

export function useRelatives(personId: string) {
  return useQuery({
    queryKey: ['people', personId, 'relatives'],
    queryFn: () => api<Relatives>(`/api/v1/people/${personId}/relatives`),
  })
}

export type Target = { type: 'new'; name: string } | { type: 'existing'; id: string }

export interface AddRelativeArgs {
  person: Person
  role: RelativeRole
  target: Target
  kind: ParentKind
  partnerSubtype: PartnerSubtype
}

/** Pai/mae do sexo da pessoa, quando conhecido; senao o papel generico. */
function parentSubtype(gender: Gender | null): string {
  return gender === 'MALE' ? 'FATHER' : gender === 'FEMALE' ? 'MOTHER' : 'PARENT'
}

export function buildRequest(args: AddRelativeArgs, otherId: string): RelationshipInput {
  const { person, role, kind, partnerSubtype } = args
  switch (role) {
    case 'father':
      return { type: 'PARENT_OF', fromId: otherId, toId: person.id, subtype: 'FATHER', kind }
    case 'mother':
      return { type: 'PARENT_OF', fromId: otherId, toId: person.id, subtype: 'MOTHER', kind }
    case 'child':
      return { type: 'PARENT_OF', fromId: person.id, toId: otherId, subtype: parentSubtype(person.gender), kind }
    case 'partner':
      return { type: 'PARTNER', fromId: person.id, toId: otherId, subtype: partnerSubtype, kind: null }
  }
}

const NEW_PERSON_GENDER: Record<RelativeRole, Gender | null> = {
  father: 'MALE',
  mother: 'FEMALE',
  child: null,
  partner: null,
}

/**
 * Cria (se preciso) a pessoa e o vinculo. Se o vinculo for recusado, apaga a pessoa recem-criada
 * para nao deixar cadastro solto — ela ainda nao tem nenhuma outra ligacao.
 */
export function useAddRelative() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: AddRelativeArgs) => {
      let otherId: string
      let createdId: string | null = null
      if (args.target.type === 'new') {
        const created = await api<Person>('/api/v1/people', {
          method: 'POST',
          body: { fullName: args.target.name, gender: NEW_PERSON_GENDER[args.role], notes: null },
        })
        otherId = created.id
        createdId = created.id
      } else {
        otherId = args.target.id
      }
      try {
        return await api('/api/v1/relationships', { method: 'POST', body: buildRequest(args, otherId) })
      } catch (err) {
        if (createdId) {
          try {
            await api<void>(`/api/v1/people/${createdId}`, { method: 'DELETE' })
          } catch {
            // melhor esforco: o erro original do vinculo e o que importa para o usuario
          }
        }
        throw err
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['people'] })
      qc.invalidateQueries({ queryKey: ['graph'] })
    },
  })
}

export function useRemoveRelationship() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (relationshipId: string) => api<void>(`/api/v1/relationships/${relationshipId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['people'] })
      qc.invalidateQueries({ queryKey: ['graph'] })
    },
  })
}
