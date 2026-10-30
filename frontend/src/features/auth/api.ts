import { useMutation } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { TokenResponse } from '../../api/types'
import { useAuth } from './store'

export function useLogin() {
  const setSession = useAuth((s) => s.setSession)
  return useMutation({
    mutationFn: (input: { username: string; password: string }) =>
      api<TokenResponse>('/auth/login', { method: 'POST', body: input, auth: false }),
    onSuccess: (data, input) => setSession(data.accessToken, input.username),
  })
}
