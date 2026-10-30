import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../../App'
import { json, mockApi, renderApp } from '../../test/helpers'
import { useAuth } from '../auth/store'

const person = (id: string, fullName: string, gender: string | null = null) => ({
  id,
  fullName,
  gender,
  photoKey: null,
  notes: null,
  createdAt: '',
  updatedAt: '',
})
const maria = person('p1', 'Maria Souza', 'FEMALE')
const joao = person('p2', 'João Souza', 'MALE')
const page = (items: unknown[]) => json({ items, page: 0, size: 20, total: items.length })
const noRelatives = () => json({ siblings: [], halfSiblings: [] })

const parentLink = {
  relationshipId: 'r1',
  type: 'PARENT_OF',
  role: 'PARENT',
  subtype: 'FATHER',
  kind: 'BIOLOGICAL',
  person: { id: 'p2', fullName: 'João Souza' },
}

async function openFamily(name = 'Maria Souza') {
  await userEvent.click(await screen.findByRole('button', { name: `Família de ${name}` }))
  return screen.findByRole('dialog', { name: `Família de ${name}` })
}

beforeEach(() => {
  useAuth.getState().setSession('tok', 'admin')
})

describe('relacionamentos na UI', () => {
  it('cadastra o pai em poucos cliques (cria a pessoa e o vinculo)', async () => {
    let linked = false
    let relationshipBody: unknown
    mockApi({
      'GET /api/v1/people?': () => page([maria]),
      'GET /api/v1/people/p1/relationships': () => json(linked ? [parentLink] : []),
      'GET /api/v1/people/p1/relatives': noRelatives,
      'POST /api/v1/people': (_u, init) => {
        expect(JSON.parse(init.body as string)).toEqual({ fullName: 'João Souza', gender: 'MALE', notes: null })
        return json(joao, 201)
      },
      'POST /api/v1/relationships': (_u, init) => {
        relationshipBody = JSON.parse(init.body as string)
        linked = true
        return json({ id: 'r1' }, 201)
      },
    })
    renderApp(<App />)
    const dialog = await openFamily()
    await userEvent.click(within(dialog).getByRole('button', { name: '+ Pai' }))
    await userEvent.type(within(dialog).getByLabelText('Nome completo'), 'João Souza')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Adicionar' }))

    expect(await screen.findByText('João Souza foi vinculado(a) a Maria Souza.')).toBeInTheDocument()
    expect(relationshipBody).toEqual({
      type: 'PARENT_OF',
      fromId: 'p2',
      toId: 'p1',
      subtype: 'FATHER',
      kind: 'BIOLOGICAL',
    })
    const parents = await within(dialog).findByRole('region', { name: 'Pais' })
    expect(within(parents).getByText('João Souza')).toBeInTheDocument()
  })

  it('ciclo mostra mensagem compreensivel e desfaz a pessoa recem-criada', async () => {
    let deletedNew = false
    mockApi({
      'GET /api/v1/people?': () => page([maria]),
      'GET /api/v1/people/p1/relationships': () => json([]),
      'GET /api/v1/people/p1/relatives': noRelatives,
      'POST /api/v1/people': () => json(joao, 201),
      'POST /api/v1/relationships': () => json({ code: 'CYCLE_DETECTED', message: 'ciclo' }, 409),
      'DELETE /api/v1/people/p2': () => {
        deletedNew = true
        return json(null, 204)
      },
    })
    renderApp(<App />)
    const dialog = await openFamily()
    await userEvent.click(within(dialog).getByRole('button', { name: '+ Filho(a)' }))
    await userEvent.type(within(dialog).getByLabelText('Nome completo'), 'João Souza')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Adicionar' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/criaria um ciclo na família/)
    await waitFor(() => expect(deletedNew).toBe(true))
  })

  it('terceiro pai biologico explica como resolver', async () => {
    mockApi({
      'GET /api/v1/people?': () => page([maria]),
      'GET /api/v1/people/p1/relationships': () => json([]),
      'GET /api/v1/people/p1/relatives': noRelatives,
      'POST /api/v1/people': () => json(joao, 201),
      'POST /api/v1/relationships': () =>
        json({ code: 'TOO_MANY_BIOLOGICAL_PARENTS', message: 'max' }, 409),
      'DELETE /api/v1/people/p2': () => json(null, 204),
    })
    renderApp(<App />)
    const dialog = await openFamily()
    await userEvent.click(within(dialog).getByRole('button', { name: '+ Pai' }))
    await userEvent.type(within(dialog).getByLabelText('Nome completo'), 'João Souza')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Adicionar' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Maria Souza já tem 2 pais biológicos cadastrados',
    )
  })

  it('vincula pessoa ja cadastrada escolhida na busca', async () => {
    let relationshipBody: unknown
    mockApi({
      'GET /api/v1/people?': () => page([maria, joao]),
      'GET /api/v1/people/p1/relationships': () => json([]),
      'GET /api/v1/people/p1/relatives': noRelatives,
      'GET /api/v1/people/search?q=jo': () => json([maria, joao].map((p) => ({ ...p, parents: [] }))),
      'POST /api/v1/relationships': (_u, init) => {
        relationshipBody = JSON.parse(init.body as string)
        return json({ id: 'r1' }, 201)
      },
    })
    renderApp(<App />)
    const dialog = await openFamily()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Vincular pessoa existente' }))
    await userEvent.type(within(dialog).getByLabelText('Buscar pessoa já cadastrada'), 'jo')
    const results = await within(dialog).findByRole('list', { name: 'Resultados da busca' })
    const option = await within(results).findByRole('button', { name: /^João Souza/ })
    // a propria pessoa nao aparece como candidata
    expect(within(results).queryByRole('button', { name: /^Maria Souza/ })).not.toBeInTheDocument()
    await userEvent.click(option)
    await userEvent.selectOptions(within(dialog).getByLabelText('Essa pessoa é…'), 'partner')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Vincular' }))

    // toasts de testes anteriores ficam no store global, por isso AllBy
    expect((await screen.findAllByText('João Souza foi vinculado(a) a Maria Souza.')).length).toBeGreaterThan(0)
    expect(relationshipBody).toEqual({
      type: 'PARTNER',
      fromId: 'p1',
      toId: 'p2',
      subtype: 'PARTNERS',
      kind: null,
    })
  })

  it('remover vinculo pede confirmacao e so remove ao confirmar', async () => {
    let removed = false
    const fetchMock = mockApi({
      'GET /api/v1/people?': () => page([maria]),
      'GET /api/v1/people/p1/relationships': () => json(removed ? [] : [parentLink]),
      'GET /api/v1/people/p1/relatives': noRelatives,
      'DELETE /api/v1/relationships/r1': () => {
        removed = true
        return json(null, 204)
      },
    })
    renderApp(<App />)
    const dialog = await openFamily()
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Remover vínculo com João Souza' }))

    // cancelar nao chama a API
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit)?.method === 'DELETE')).toBe(false)

    await userEvent.click(await within(dialog).findByRole('button', { name: 'Remover vínculo com João Souza' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remover vínculo' }))
    await waitFor(() => expect(removed).toBe(true))
    expect(await screen.findByText(/O vínculo entre Maria Souza e João Souza foi removido/)).toBeInTheDocument()
    expect(await within(dialog).findByText(/ainda não tem parentes ligados/)).toBeInTheDocument()
  })
})
