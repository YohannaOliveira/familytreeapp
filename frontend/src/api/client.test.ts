import { describe, expect, it, vi } from 'vitest'
import { useAuth } from '../features/auth/store'
import { json, mockApi } from '../test/helpers'
import { api, ApiError } from './client'

describe('api client', () => {
  it('envia o token no cabecalho Authorization', async () => {
    useAuth.getState().setSession('abc', 'admin')
    const fetchMock = mockApi({ 'GET /api/v1/people': () => json({ items: [] }) })
    await api('/api/v1/people')
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer abc')
  })

  it('envia JSON e devolve undefined em 204', async () => {
    const fetchMock = mockApi({ 'POST /x': () => json(null, 204) })
    await expect(api('/x', { method: 'POST', body: { a: 1 } })).resolves.toBeUndefined()
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.body).toBe('{"a":1}')
  })

  it('em 401 encerra a sessao e lanca erro amigavel', async () => {
    useAuth.getState().setSession('abc', 'admin')
    mockApi({ 'GET /x': () => json({ code: 'UNAUTHORIZED', message: 'x' }, 401) })
    await expect(api('/x')).rejects.toMatchObject({ status: 401, message: 'Sua sessão expirou. Entre novamente.' })
    expect(useAuth.getState().token).toBeNull()
  })

  it('401 do login (auth:false) nao derruba a sessao e traz mensagem de credenciais', async () => {
    useAuth.getState().setSession('abc', 'admin')
    mockApi({ 'POST /auth/login': () => json({ code: 'INVALID_CREDENTIALS', message: 'x' }, 401) })
    await expect(api('/auth/login', { method: 'POST', body: {}, auth: false })).rejects.toThrow(
      'Usuário ou senha incorretos.',
    )
    expect(useAuth.getState().token).toBe('abc')
  })

  it('expoe erros de campo da validacao', async () => {
    mockApi({
      'POST /p': () =>
        json(
          { code: 'VALIDATION_ERROR', message: 'Dados invalidos', fieldErrors: [{ field: 'fullName', message: 'm' }] },
          400,
        ),
    })
    const err = (await api('/p', { method: 'POST', body: {} }).catch((e) => e)) as ApiError
    expect(err).toBeInstanceOf(ApiError)
    expect(err.fieldErrors).toEqual([{ field: 'fullName', message: 'm' }])
  })

  it('erro 500 vira mensagem leiga sem detalhes tecnicos', async () => {
    mockApi({ 'GET /x': () => json({ code: 'INTERNAL_ERROR', message: 'stack' }, 500) })
    await expect(api('/x')).rejects.toThrow('Algo deu errado do nosso lado. Tente novamente em instantes.')
  })

  it('falha de rede vira erro NETWORK', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed')))
    await expect(api('/x')).rejects.toMatchObject({ code: 'NETWORK', status: 0 })
  })
})
