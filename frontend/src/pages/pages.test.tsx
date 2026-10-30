import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from '../App'
import { useAuth } from '../features/auth/store'
import { json, mockApi, renderApp } from '../test/helpers'

const maria = {
  id: 'p1',
  fullName: 'Maria Souza',
  gender: 'FEMALE',
  photoKey: null,
  notes: null,
  createdAt: '',
  updatedAt: '',
}
const page = (items: unknown[]) => json({ items, page: 0, size: 20, total: items.length })

describe('login', () => {
  it('sem sessao redireciona para o login', async () => {
    renderApp(<App />, '/')
    expect(await screen.findByRole('heading', { name: 'Árvore da Família' })).toBeInTheDocument()
    expect(screen.getByLabelText('Usuário')).toBeInTheDocument()
  })

  it('credenciais erradas mostram aviso leigo', async () => {
    mockApi({ 'POST /auth/login': () => json({ code: 'INVALID_CREDENTIALS', message: 'x' }, 401) })
    renderApp(<App />, '/login')
    await userEvent.type(screen.getByLabelText('Usuário'), 'admin')
    await userEvent.type(screen.getByLabelText('Senha'), 'errada')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('Usuário ou senha incorretos.')).toBeInTheDocument()
  })

  it('login correto guarda a sessao e abre a lista', async () => {
    mockApi({
      'POST /auth/login': () => json({ accessToken: 'tok', tokenType: 'Bearer', expiresIn: 1800 }),
      'GET /api/v1/people?': () => page([maria]),
    })
    renderApp(<App />, '/login')
    await userEvent.type(screen.getByLabelText('Usuário'), 'admin')
    await userEvent.type(screen.getByLabelText('Senha'), 'segredo')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('Maria Souza')).toBeInTheDocument()
    expect(useAuth.getState().token).toBe('tok')
  })
})

describe('pessoas', () => {
  it('lista vazia mostra "Adicionar a primeira pessoa" e cadastra', async () => {
    useAuth.getState().setSession('tok', 'admin')
    let created = false
    mockApi({
      'GET /api/v1/people?': () => page(created ? [maria] : []),
      'POST /api/v1/people': (_u, init) => {
        created = true
        expect(JSON.parse(init.body as string)).toEqual({ fullName: 'Maria Souza', gender: null, notes: null })
        return json(maria, 201)
      },
    })
    renderApp(<App />)
    await userEvent.click(await screen.findByRole('button', { name: 'Adicionar a primeira pessoa' }))
    await userEvent.type(screen.getByLabelText('Nome completo'), 'Maria Souza')
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar pessoa' }))
    expect(await screen.findByText('Maria Souza foi adicionada à família.')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Editar Maria Souza' })).toBeInTheDocument()
  })

  it('excluir mostra o impacto e so exclui apos confirmar', async () => {
    useAuth.getState().setSession('tok', 'admin')
    let deleted = false
    mockApi({
      'GET /api/v1/people/p1/relationships': () => json([{}, {}, {}]),
      'GET /api/v1/people?': () => page(deleted ? [] : [maria]),
      'DELETE /api/v1/people/p1': () => {
        deleted = true
        return json(null, 204)
      },
    })
    renderApp(<App />)
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir Maria Souza' }))
    const dialog = await screen.findByRole('dialog', { name: 'Excluir pessoa?' })
    expect(await within(dialog).findByText(/3 ligações familiares/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Excluir Maria Souza' }))
    await waitFor(() => expect(deleted).toBe(true))
    expect(await screen.findByText('Maria Souza foi excluída.')).toBeInTheDocument()
  })

  it('cancelar a exclusao nao chama a API de exclusao', async () => {
    useAuth.getState().setSession('tok', 'admin')
    const fetchMock = mockApi({
      'GET /api/v1/people/p1/relationships': () => json([]),
      'GET /api/v1/people?': () => page([maria]),
    })
    renderApp(<App />)
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir Maria Souza' }))
    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText(/nada mais será removido/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit)?.method === 'DELETE')).toBe(false)
  })

  it('sair volta para o login', async () => {
    useAuth.getState().setSession('tok', 'admin')
    mockApi({ 'GET /api/v1/people?': () => page([maria]) })
    renderApp(<App />)
    await userEvent.click(await screen.findByRole('button', { name: 'Sair' }))
    expect(await screen.findByLabelText('Usuário')).toBeInTheDocument()
  })
})
