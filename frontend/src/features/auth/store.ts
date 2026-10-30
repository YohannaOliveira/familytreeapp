import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

interface AuthState {
  token: string | null
  username: string | null
  setSession: (token: string, username: string) => void
  logout: () => void
}

/** Sessao em sessionStorage: some ao fechar a aba, o que e adequado para dados da familia. */
export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      username: null,
      setSession: (token, username) => set({ token, username }),
      logout: () => set({ token: null, username: null }),
    }),
    { name: 'ft-auth', storage: createJSONStorage(() => sessionStorage) },
  ),
)
