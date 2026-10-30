import { QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { createQueryClient } from '../lib/queryClient'

export function json(body: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>

/** Substitui fetch; responde o primeiro handler cuja chave "METODO caminho" e prefixo da requisicao. */
export function mockApi(routes: Record<string, Handler>) {
  const fn = vi.fn(async (url: string, init: RequestInit = {}) => {
    const key = `${init.method ?? 'GET'} ${url}`
    const match = Object.keys(routes).find((k) => key.startsWith(k))
    if (!match) throw new Error(`Rota nao mockada: ${key}`)
    return routes[match](url, init)
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

export function renderApp(ui: ReactElement, route = '/') {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}
