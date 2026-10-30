import { expect, test } from '@playwright/test'
import { ID, LONG, json, mockTree, noHorizontalScroll, person, signedIn } from './helpers'

// Estados (carregando / erro / vazio) e layout no celular. A API e simulada com page.route:
// nao depende de backend nem de banco, e cada estado e deterministico.

test.describe('estados da lista de pessoas', () => {
  test.beforeEach(({ page }) => signedIn(page))

  test('carregando, depois a lista', async ({ page }) => {
    await page.route('**/api/v1/people?*', async (route) => {
      await new Promise((r) => setTimeout(r, 800))
      await json(route, { items: [person(1)], page: 0, size: 20, total: 1 })
    })
    await page.goto('/')
    await expect(page.getByText('Carregando…')).toBeVisible()
    await expect(page.getByText('Pessoa 1', { exact: true })).toBeVisible()
    await expect(page.getByText('Carregando…')).toHaveCount(0)
  })

  test('erro do servidor mostra alerta e "Tentar de novo" recupera', async ({ page }) => {
    let fail = true
    await page.route('**/api/v1/people?*', (route) =>
      fail
        ? json(route, { code: 'INTERNAL', message: 'x' }, 500)
        : json(route, { items: [person(1)], page: 0, size: 20, total: 1 }),
    )
    await page.goto('/')
    const alert = page.getByRole('alert')
    await expect(alert).toContainText('Algo deu errado do nosso lado')
    fail = false
    await alert.getByRole('button', { name: 'Tentar de novo' }).click()
    await expect(page.getByText('Pessoa 1', { exact: true })).toBeVisible()
  })

  test('sem conexao mostra mensagem de rede', async ({ page }) => {
    await page.route('**/api/v1/people?*', (route) => route.abort('connectionrefused'))
    await page.goto('/')
    await expect(page.getByRole('alert')).toContainText('Verifique sua conexão')
  })

  test('lista vazia convida a cadastrar a primeira pessoa', async ({ page }) => {
    await page.route('**/api/v1/people?*', (route) => json(route, { items: [], page: 0, size: 20, total: 0 }))
    await page.goto('/')
    await expect(page.getByText('Ainda não há ninguém na família')).toBeVisible()
    await page.getByRole('button', { name: 'Adicionar a primeira pessoa' }).click()
    await expect(page.getByRole('dialog', { name: 'Adicionar pessoa' })).toBeVisible()
  })
})

test.describe('painel da familia e arvore', () => {
  test.beforeEach(({ page }) => signedIn(page))

  test('familia sem parentes mostra o estado vazio; erro permite tentar de novo', async ({ page }) => {
    let fail = true
    await page.route('**/api/v1/people?*', (route) => json(route, { items: [person(1)], page: 0, size: 20, total: 1 }))
    await page.route('**/api/v1/people/*/relatives', (route) => json(route, { siblings: [], halfSiblings: [] }))
    await page.route('**/api/v1/people/*/relationships', (route) =>
      fail ? json(route, { code: 'INTERNAL', message: 'x' }, 500) : json(route, []),
    )
    await page.goto('/')
    await page.getByRole('button', { name: 'Família de Pessoa 1', exact: true }).click()
    const sheet = page.getByRole('dialog', { name: 'Família de Pessoa 1' })
    await expect(sheet.getByRole('alert')).toContainText('Não foi possível carregar os parentes')
    fail = false
    await sheet.getByRole('button', { name: 'Tentar de novo' }).click()
    await expect(sheet.getByText('Pessoa 1 ainda não tem parentes ligados')).toBeVisible()
  })

  test('arvore: carregando, erro 404 e "Tentar de novo"', async ({ page }) => {
    let ok = false
    await page.route('**/api/v1/graph?*', async (route) => {
      if (!ok) return json(route, { code: 'NOT_FOUND', message: 'x' }, 404)
      await json(route, {
        focusId: ID,
        persons: [{ id: ID, fullName: 'Fulana Sozinha', gender: 'FEMALE', photoKey: null }],
        relationships: [],
        families: [],
        hiddenCounts: {},
        truncated: false,
      })
    })
    await page.goto(`/tree/${ID}`)
    await expect(page.getByRole('alert')).toContainText('Não encontramos o que você procurou')
    ok = true
    await page.getByRole('button', { name: 'Tentar de novo' }).click()
    await expect(page.getByRole('heading', { name: 'Família de Fulana Sozinha' })).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
  })

  test('sessao expirada (401) volta para o login', async ({ page }) => {
    await page.route('**/api/v1/people?*', (route) => json(route, { code: 'UNAUTHORIZED', message: 'x' }, 401))
    await page.goto('/')
    await expect(page).toHaveURL(/\/login$/)
  })
})

test('arvore no desktop mostra o minimapa', async ({ page, isMobile }) => {
  test.skip(isMobile, 'so no projeto desktop')
  await mockTree(page)
  await page.goto(`/tree/${ID}`)
  await expect(page.locator('.react-flow__node').first()).toBeVisible()
  await expect(page.locator('.react-flow__minimap')).toBeVisible()
})

test.describe('layout no celular (360 px)', () => {
  test.skip(({ isMobile }) => !isMobile, 'so no projeto mobile')
  test.use({ viewport: { width: 360, height: 740 } })

  test('login, lista, formulario e painel nao geram rolagem horizontal', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()
    expect(await noHorizontalScroll(page)).toBe(true)

    await signedIn(page)
    const items = Array.from({ length: 20 }, (_, i) => person(i + 1, i % 3 === 0 ? LONG : `Pessoa ${i + 1}`))
    await page.route('**/api/v1/people?*', (route) => json(route, { items, page: 0, size: 20, total: 45 }))
    await page.route('**/api/v1/people/*/relatives', (route) => json(route, { siblings: [], halfSiblings: [] }))
    await page.route('**/api/v1/people/*/relationships', (route) => json(route, []))
    await page.route('**/api/v1/people/*/relationships/count', (route) => json(route, 3))
    await page.goto('/')
    await expect(page.getByText(LONG).first()).toBeVisible()
    expect(await noHorizontalScroll(page)).toBe(true)

    await page.getByRole('button', { name: 'Adicionar pessoa', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Adicionar pessoa' })).toBeVisible()
    expect(await noHorizontalScroll(page)).toBe(true)
    await page.getByRole('button', { name: 'Cancelar' }).click()

    await page.getByRole('button', { name: `Família de ${LONG}`, exact: true }).first().click()
    await expect(page.getByRole('dialog', { name: `Família de ${LONG}` })).toBeVisible()
    expect(await noHorizontalScroll(page)).toBe(true)
  })

  test('arvore no celular: sem rolagem horizontal e detalhes abrem em painel', async ({ page }, testInfo) => {
    await mockTree(page)
    await page.goto(`/tree/${ID}`)
    await expect(page.getByRole('heading', { name: `Família de ${LONG}` })).toBeVisible()
    await expect(page.locator('.react-flow__node').first()).toBeVisible()
    expect(await noHorizontalScroll(page)).toBe(true)
    await expect(page.locator('.react-flow__minimap')).toBeHidden()
    await page.screenshot({ path: testInfo.outputPath('tree-mobile.png') })
    await page.getByText('Pai Teste').first().click()
    await expect(page.getByRole('dialog', { name: 'Pai Teste' })).toBeVisible()
    expect(await noHorizontalScroll(page)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath('tree-mobile-sheet.png') })
  })

  test('alvos de toque tem pelo menos 44 px nas telas principais', async ({ page }) => {
    await signedIn(page)
    await page.route('**/api/v1/people?*', (route) => json(route, { items: [person(1)], page: 0, size: 20, total: 1 }))
    await page.goto('/')
    await expect(page.getByText('Pessoa 1', { exact: true })).toBeVisible()
    const small: string[] = []
    for (const el of await page.locator('main button, main a, header button, header input').all()) {
      const box = await el.boundingBox()
      if (box && box.height < 44 - 0.5) small.push(`${(await el.textContent())?.trim() || (await el.getAttribute('aria-label'))} (${Math.round(box.height)}px)`)
    }
    expect(small, `alvos pequenos: ${small.join(', ')}`).toEqual([])
  })
})
