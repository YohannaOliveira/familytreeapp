import { useAuth } from '../features/auth/store'
import type { ErrorBody, FieldError } from './types'

const BASE_URL = import.meta.env.VITE_API_URL ?? ''

const FRIENDLY: Record<string, string> = {
  INVALID_CREDENTIALS: 'Usuário ou senha incorretos.',
  RATE_LIMITED: 'Muitas tentativas seguidas. Aguarde um pouco e tente de novo.',
  UNAUTHORIZED: 'Sua sessão expirou. Entre novamente.',
  NETWORK: 'Não foi possível falar com o servidor. Verifique sua conexão.',
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fieldErrors: FieldError[] = [],
    readonly traceId?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  /** false para rotas publicas (login): nao envia token nem derruba a sessao em 401. */
  auth?: boolean
  /** Cancela a requisicao (ex.: busca digitada ja substituida por outra). */
  signal?: AbortSignal
}

function friendlyMessage(status: number, code: string, fallback: string): string {
  if (FRIENDLY[code]) return FRIENDLY[code]
  if (status >= 500) return 'Algo deu errado do nosso lado. Tente novamente em instantes.'
  if (status === 404) return 'Não encontramos o que você procurou.'
  return fallback || 'Não foi possível concluir a ação.'
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, signal } = options
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const token = useAuth.getState().token
  if (auth && token) headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch {
    throw new ApiError(0, 'NETWORK', FRIENDLY.NETWORK)
  }

  if (response.ok) {
    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  }

  let errorBody: Partial<ErrorBody> = {}
  try {
    errorBody = await response.json()
  } catch {
    // corpo vazio ou nao-JSON: usa mensagem generica
  }
  const code = errorBody.code ?? `HTTP_${response.status}`
  if (response.status === 401 && auth) useAuth.getState().logout()
  throw new ApiError(
    response.status,
    code,
    friendlyMessage(response.status, code, errorBody.message ?? ''),
    errorBody.fieldErrors,
    errorBody.traceId,
  )
}
