import { useQueryClient } from '@tanstack/react-query'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../features/auth/store'
import { useFocusHistory } from '../features/graph/history'
import { SearchBox } from '../features/search/SearchBox'
import { Button } from './ui/Button'

/** Area protegida: topo com busca, conteudo central e botao de sair. */
export function AppLayout() {
  const token = useAuth((s) => s.token)
  const username = useAuth((s) => s.username)
  const logout = useAuth((s) => s.logout)
  const qc = useQueryClient()
  const wide = useLocation().pathname.startsWith('/tree/')

  if (!token) return <Navigate to="/login" replace />

  return (
    <div className={`bg-slate-50 text-slate-900 ${wide ? 'flex h-dvh flex-col' : 'min-h-screen'}`}>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3 px-4 py-3">
          <span className="text-lg font-semibold">Árvore da Família</span>
          <div className="order-last w-full sm:order-none sm:w-auto sm:flex-1">
            <SearchBox />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-slate-700 sm:inline">{username}</span>
            <Button
              variant="secondary"
              onClick={() => {
                logout()
                useFocusHistory.getState().clear()
                qc.clear()
              }}
            >
              Sair
            </Button>
          </div>
        </div>
      </header>
      <main className={wide ? 'min-h-0 flex-1' : 'mx-auto max-w-4xl px-4 py-6'}>
        <Outlet />
      </main>
    </div>
  )
}
