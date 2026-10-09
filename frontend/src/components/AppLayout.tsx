import { useQueryClient } from '@tanstack/react-query'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../features/auth/store'
import { Button } from './ui/Button'

/** Area protegida: topo com busca (ainda nao ativa), conteudo central e botao de sair. */
export function AppLayout() {
  const token = useAuth((s) => s.token)
  const username = useAuth((s) => s.username)
  const logout = useAuth((s) => s.logout)
  const qc = useQueryClient()

  if (!token) return <Navigate to="/login" replace />

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3 px-4 py-3">
          <span className="text-lg font-semibold">Árvore da Família</span>
          <div className="order-last w-full sm:order-none sm:w-auto sm:flex-1">
            <label htmlFor="search" className="sr-only">
              Buscar pessoa
            </label>
            <input
              id="search"
              type="search"
              disabled
              placeholder="Buscar pessoa (em breve)"
              className="block min-h-11 w-full rounded-lg border border-slate-300 bg-slate-100 px-3 text-base
                placeholder:text-slate-600 sm:max-w-sm"
            />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-slate-700 sm:inline">{username}</span>
            <Button
              variant="secondary"
              onClick={() => {
                logout()
                qc.clear()
              }}
            >
              Sair
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
