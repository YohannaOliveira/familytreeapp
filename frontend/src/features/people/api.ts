import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { Page, Person, PersonInput } from '../../api/types'

export const PAGE_SIZE = 20

export function usePeople(page: number) {
  return useQuery({
    queryKey: ['people', page],
    queryFn: () => api<Page<Person>>(`/api/v1/people?page=${page}&size=${PAGE_SIZE}`),
    placeholderData: keepPreviousData,
  })
}

/** Quantas ligacoes familiares a pessoa tem (somem junto com ela ao excluir). */
export function useRelationshipCount(personId: string | null) {
  return useQuery({
    queryKey: ['people', personId, 'relationships'],
    queryFn: async () => (await api<unknown[]>(`/api/v1/people/${personId}/relationships`)).length,
    enabled: personId !== null,
    gcTime: 0,
  })
}

export function useSavePerson() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: PersonInput }) =>
      id
        ? api<Person>(`/api/v1/people/${id}`, { method: 'PUT', body: input })
        : api<Person>('/api/v1/people', { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['people'] }),
  })
}

export function useDeletePerson() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/api/v1/people/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['people'] }),
  })
}
