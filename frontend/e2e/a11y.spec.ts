import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { ID, json, mockTree, person, signedIn } from './helpers'

// Acessibilidade: varredura automatica (axe, WCAG 2.1 A/AA, inclui contraste) + teclado.
// A API e simulada; nao depende de backend.

async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const summary = violations.map(
    (v) => `${v.id} (${v.impact}): ${v.nodes.length}x, ex.: ${v.nodes[0]?.target.join(' ')} -> ${v.help}`,
  )
  expect(summary, summary.join('\n')).toEqual([])
}

async function mockPeople(page: Page) {
  await signedIn(page)
  const items = [person(1, 'Ana Souza'), person(2, 'Bruno Lima')]
  await page.route('**/api/v1/people?*', (route) => json(route, { items, page: 0, size: 20, total: 2 }))
  await page.route('**/api/v1/people/*/relatives', (route) => json(route, { siblings: [], halfSiblings: [] }))
  await page.route('**/api/v1/people/*/relationships', (route) => json(route, []))
  await page.route('**/api/v1/people/*/relationships/count', (route) => json(route, 2))
}

test.describe('axe', () => {
  test('login', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()
    await expectNoViolations(page)
  })

  test('login com erro de validacao', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByText('Digite seu usuário.')).toBeVisible()
    await expectNoViolations(page)
  })

  test('lista de pessoas e janelas', async ({ page }) => {
    await mockPeople(page)
    await page.goto('/')
    await expect(page.getByText('Ana Souza', { exact: true })).toBeVisible()
    await expectNoViolations(page)

    await page.getByRole('button', { name: 'Adicionar pessoa', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Adicionar pessoa' })).toBeVisible()
    await expectNoViolations(page)
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Família de Ana Souza', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Família de Ana Souza' })).toBeVisible()
    await expectNoViolations(page)
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Excluir Ana Souza', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Excluir pessoa?' })).toBeVisible()
    await expectNoViolations(page)
  })

  test('estados de erro e vazio', async ({ page }) => {
    await signedIn(page)
    await page.route('**/api/v1/people?*', (route) => json(route, { code: 'INTERNAL', message: 'x' }, 500))
    await page.goto('/')
    await expect(page.getByRole('alert')).toBeVisible()
    await expectNoViolations(page)

    await page.unroute('**/api/v1/people?*')
    await page.route('**/api/v1/people?*', (route) => json(route, { items: [], page: 0, size: 20, total: 0 }))
    await page.getByRole('button', { name: 'Tentar de novo' }).click()
    await expect(page.getByText('Ainda não há ninguém na família')).toBeVisible()
    await expectNoViolations(page)
  })

  test('arvore e painel de detalhes', async ({ page }) => {
    await mockTree(page)
    await page.goto(`/tree/${ID}`)
    await expect(page.locator('.react-flow__node').first()).toBeVisible()
    await expectNoViolations(page)

    await page.getByText('Pai Teste').first().click()
    await expect(page.getByRole('dialog', { name: 'Pai Teste' })).toBeVisible()
    await expectNoViolations(page)
  })
})

test.describe('teclado', () => {
  test('Tab chega aos botoes, mostra foco visivel e Esc devolve o foco a quem abriu', async ({ page }) => {
    await mockPeople(page)
    await page.goto('/')
    const add = page.getByRole('button', { name: 'Adicionar pessoa', exact: true })
    await expect(add).toBeVisible()
    await add.focus()
    // foco visivel: o outline do Tailwind (focus-visible) precisa existir de fato
    const outline = await add.evaluate((el) => getComputedStyle(el).outlineStyle)
    expect(outline).not.toBe('none')

    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Adicionar pessoa' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('Nome completo')).toBeFocused()

    // o foco fica preso na janela: muitos Tabs nunca saem dela
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true)
    }

    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(add).toBeFocused()
  })

  test('formulario: erro de validacao fica associado ao campo e anunciado', async ({ page }) => {
    await mockPeople(page)
    await page.goto('/')
    await page.getByRole('button', { name: 'Adicionar pessoa', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Adicionar pessoa' })
    await dialog.getByRole('button', { name: 'Adicionar pessoa' }).click()
    const field = dialog.getByLabel('Nome completo')
    await expect(field).toHaveAttribute('aria-invalid', 'true')
    const describedBy = await field.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    await expect(page.locator(`[id="${describedBy!.split(' ')[0]}"]`)).not.toBeEmpty()
  })

  test('busca: "/" foca o campo, setas escolhem e o combobox expoe estado ARIA', async ({ page }) => {
    await mockPeople(page)
    await page.route('**/api/v1/people/search?*', (route) =>
      json(route, [{ id: ID, fullName: 'Ana Souza', gender: 'FEMALE', photoKey: null, parents: [] }]),
    )
    await page.goto('/')
    await expect(page.getByText('Ana Souza', { exact: true })).toBeVisible()
    await page.keyboard.press('/')
    const box = page.getByRole('combobox', { name: 'Buscar pessoa' })
    await expect(box).toBeFocused()
    await box.fill('ana')
    await expect(page.getByRole('option', { name: /Ana Souza/ })).toBeVisible()
    await expect(box).toHaveAttribute('aria-expanded', 'true')
    await expect(box).toHaveAttribute('aria-activedescendant', /.+/)
  })
})
