import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { json, mockApi, renderApp } from '../../test/helpers'
import { useAuth } from '../auth/store'
import { useFocusHistory } from '../graph/history'
import { parentsLabel } from './api'

// O canvas (React Flow + ELK em Worker) nao roda no jsdom; aqui interessa o fluxo ao redor dele.
vi.mock('../graph/GraphView', () => ({ GraphView: () => <div data-testid="grafo" /> }))

const hit = (id: string, fullName: string, parents: string[] = [], gender: string | null = null) => ({
  id,
  fullName,
  gender,
  photoKey: null,
  parents,
})
const joao1 = hit('p1', 'João Souza', ['Carlos Souza', 'Lucia Souza'], 'MALE')
const joao2 = hit('p2', 'João Souza')

const graphOf = (id: string, name: string) =>
  json({
    focusId: id,
    persons: [{ id, fullName: name, gender: null, photoKey: null }],
    relationships: [],
    families: [],
    hiddenCounts: {},
    truncated: false,
  })

const searchCalls = (fetchMock: ReturnType<typeof mockApi>) =>
  fetchMock.mock.calls.filter(([url]) => String(url).includes('/people/search')).map(([url]) => String(url))

beforeEach(() => {
  useAuth.getState().setSession('tok', 'admin')
  useFocusHistory.getState().clear()
})

describe('parentsLabel', () => {
  it('descreve os pais conforme o sexo', () => {
    expect(parentsLabel({ gender: 'MALE', parents: ['Ana', 'Beto'] })).toBe('Filho de Ana e Beto')
    expect(parentsLabel({ gender: 'FEMALE', parents: ['Ana'] })).toBe('Filha de Ana')
    expect(parentsLabel({ gender: null, parents: ['Ana', 'Beto', 'Caio'] })).toBe('Filho(a) de Ana, Beto e Caio')
    expect(parentsLabel({ gender: null, parents: [] })).toBe('Sem pais cadastrados')
  })
})

describe('busca no topo', () => {
  it('mostra homonimos com o contexto dos pais para desambiguar', async () => {
    mockApi({
      'GET /api/v1/people?': () => json({ items: [], page: 0, size: 20, total: 0 }),
      'GET /api/v1/people/search': () => json([joao1, joao2]),
    })
    renderApp(<App />)
    await userEvent.type(await screen.findByRole('combobox', { name: 'Buscar pessoa' }), 'joao')
    const options = await screen.findAllByRole('option')
    expect(options).toHaveLength(2)
    expect(within(options[0]).getByText('Filho de Carlos Souza e Lucia Souza')).toBeInTheDocument()
    expect(within(options[1]).getByText('Sem pais cadastrados')).toBeInTheDocument()
  })

  it('espera o usuario parar de digitar e so busca com 2+ letras', async () => {
    const fetchMock = mockApi({
      'GET /api/v1/people?': () => json({ items: [], page: 0, size: 20, total: 0 }),
      'GET /api/v1/people/search': () => json([]),
    })
    renderApp(<App />)
    const box = await screen.findByRole('combobox', { name: 'Buscar pessoa' })
    await userEvent.type(box, 'j')
    await new Promise((r) => setTimeout(r, 400))
    expect(searchCalls(fetchMock)).toHaveLength(0)

    await userEvent.type(box, 'oa')
    expect(await screen.findByText('Ninguém encontrado com esse nome.')).toBeInTheDocument()
    // "jo" e "joa" foram digitados dentro da janela de 250 ms: uma unica requisicao, com o texto final
    expect(searchCalls(fetchMock)).toEqual(['/api/v1/people/search?q=joa&limit=10'])
    // e ela pode ser cancelada se for substituida
    const init = fetchMock.mock.calls.find(([url]) => String(url).includes('/people/search'))![1] as RequestInit
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('reaproveita o cache ao repetir a mesma busca', async () => {
    const fetchMock = mockApi({
      'GET /api/v1/people?': () => json({ items: [], page: 0, size: 20, total: 0 }),
      'GET /api/v1/people/search': () => json([joao1]),
    })
    renderApp(<App />)
    const box = await screen.findByRole('combobox', { name: 'Buscar pessoa' })
    await userEvent.type(box, 'joao')
    await screen.findByRole('option')
    await userEvent.clear(box)
    await userEvent.type(box, 'joao')
    await screen.findByRole('option')
    expect(searchCalls(fetchMock)).toHaveLength(1)
  })

  it('teclado: setas escolhem e Enter abre a arvore da pessoa (buscar -> centralizar)', async () => {
    const fetchMock = mockApi({
      'GET /api/v1/people?': () => json({ items: [], page: 0, size: 20, total: 0 }),
      'GET /api/v1/people/search': () => json([joao1, joao2]),
      'GET /api/v1/graph?focus=p2': () => graphOf('p2', 'João Souza'),
    })
    renderApp(<App />)
    const box = await screen.findByRole('combobox', { name: 'Buscar pessoa' })
    await userEvent.type(box, 'joao')
    await screen.findAllByRole('option')
    await userEvent.keyboard('{ArrowDown}{Enter}')

    expect(await screen.findByTestId('grafo')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Família de João Souza' })).toBeInTheDocument()
    const graphCalls = fetchMock.mock.calls.map(([u]) => String(u)).filter((u) => u.includes('/graph'))
    expect(graphCalls[0]).toContain('focus=p2')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(box).toHaveValue('')
  })

  it('"/" leva o foco para a busca; Esc fecha a lista', async () => {
    mockApi({
      'GET /api/v1/people?': () => json({ items: [], page: 0, size: 20, total: 0 }),
      'GET /api/v1/people/search': () => json([joao1]),
    })
    renderApp(<App />)
    const box = await screen.findByRole('combobox', { name: 'Buscar pessoa' })
    expect(box).not.toHaveFocus()
    await userEvent.keyboard('/')
    expect(box).toHaveFocus()
    expect(box).toHaveValue('') // a barra nao e digitada no campo
    await userEvent.type(box, 'joao')
    await screen.findByRole('option')
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})

describe('historico de foco', () => {
  it('mostra a trilha e volta ao foco anterior', async () => {
    mockApi({
      'GET /api/v1/people?': () => json({ items: [], page: 0, size: 20, total: 0 }),
      'GET /api/v1/people/search?q=ana': () => json([hit('a', 'Ana Lima')]),
      'GET /api/v1/people/search?q=beto': () => json([hit('b', 'Beto Lima')]),
      'GET /api/v1/graph?focus=a': () => graphOf('a', 'Ana Lima'),
      'GET /api/v1/graph?focus=b': () => graphOf('b', 'Beto Lima'),
    })
    renderApp(<App />)
    const box = await screen.findByRole('combobox', { name: 'Buscar pessoa' })

    await userEvent.type(box, 'ana')
    await userEvent.click(await screen.findByRole('option', { name: /Ana Lima/ }))
    await screen.findByRole('heading', { name: 'Família de Ana Lima' })
    // com um unico foco ainda nao ha trilha
    expect(screen.queryByRole('navigation', { name: 'Focos visitados' })).not.toBeInTheDocument()

    await userEvent.type(box, 'beto')
    await userEvent.click(await screen.findByRole('option', { name: /Beto Lima/ }))
    await screen.findByRole('heading', { name: 'Família de Beto Lima' })

    const trail = await screen.findByRole('navigation', { name: 'Focos visitados' })
    expect(within(trail).getByRole('link', { name: 'Ana Lima' })).toBeInTheDocument()
    expect(within(trail).getByText('Beto Lima')).toHaveAttribute('aria-current', 'page')

    await userEvent.click(within(trail).getByRole('button', { name: '← Voltar a Ana Lima' }))
    await screen.findByRole('heading', { name: 'Família de Ana Lima' })
    // voltar corta a trilha: Beto sai, e some a navegacao (so resta um foco)
    await waitFor(() => expect(useFocusHistory.getState().trail.map((e) => e.id)).toEqual(['a']))
    expect(screen.queryByRole('navigation', { name: 'Focos visitados' })).not.toBeInTheDocument()
  })
})

describe('store da trilha', () => {
  it('deduplica, limita e corta ao revisitar', () => {
    const { visit } = useFocusHistory.getState()
    visit({ id: 'a', name: 'A' })
    visit({ id: 'b', name: 'B' })
    visit({ id: 'c', name: 'C' })
    visit({ id: 'b', name: 'B2' }) // revisita B: C sai da trilha e o nome e atualizado
    expect(useFocusHistory.getState().trail).toEqual([
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B2' },
    ])
    for (let i = 0; i < 30; i++) visit({ id: `x${i}`, name: `X${i}` })
    expect(useFocusHistory.getState().trail).toHaveLength(20)
  })
})
