import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { ToastViewport } from './components/ui/toast'
import { LoginPage } from './pages/LoginPage'
import { PeoplePage } from './pages/PeoplePage'

const GraphPage = lazy(() => import('./pages/GraphPage').then((m) => ({ default: m.GraphPage })))

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AppLayout />}>
          <Route index element={<PeoplePage />} />
          <Route
            path="tree/:id"
            element={
              <Suspense fallback={<p className="p-6 text-center text-slate-600">Carregando…</p>}>
                <GraphPage />
              </Suspense>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastViewport />
    </>
  )
}
