import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { PersonSearchResult } from '../../api/types'

export const SEARCH_DEBOUNCE_MS = 250
export const MIN_QUERY_LENGTH = 2

export function useDebounced<T>(value: T, ms = SEARCH_DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

/**
 * Busca por nome (parcial, sem acento, sem diferenciar caixa — o backend normaliza).
 * A chave comeca com 'people' para que qualquer cadastro/edicao invalide o cache;
 * o `signal` cancela a requisicao quando o usuario continua digitando.
 */
export function useSearchPeople(term: string) {
  const q = term.trim()
  return useQuery({
    queryKey: ['people', 'search', q],
    queryFn: ({ signal }) =>
      api<PersonSearchResult[]>(`/api/v1/people/search?q=${encodeURIComponent(q)}&limit=10`, { signal }),
    enabled: q.length >= MIN_QUERY_LENGTH,
    staleTime: 60_000,
  })
}

const list = new Intl.ListFormat('pt-BR', { style: 'long', type: 'conjunction' })

/** "Filho de Ana e João" — contexto para distinguir homonimos. */
export function parentsLabel(r: Pick<PersonSearchResult, 'gender' | 'parents'>): string {
  if (r.parents.length === 0) return 'Sem pais cadastrados'
  const child = r.gender === 'MALE' ? 'Filho' : r.gender === 'FEMALE' ? 'Filha' : 'Filho(a)'
  return `${child} de ${list.format(r.parents)}`
}
