import { expect, test } from '@playwright/test'

const USER = process.env.E2E_USER ?? 'admin'
const PASSWORD = process.env.E2E_PASSWORD ?? 'bench123'

test('login → criar pessoa → adicionar filho → buscar → centralizar → excluir', async ({ page }, testInfo) => {
  // Nomes unicos por projeto/execucao: o banco pode ter dados de outras execucoes.
  const run = `${testInfo.project.name}${Date.now().toString(36)}`
  const parent = `Maria Teste ${run}`
  const child = `Joao Teste ${run}`

  // login
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  await page.getByLabel('Usuário').fill(USER)
  await page.getByLabel('Senha').fill(PASSWORD)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Pessoas' })).toBeVisible()

  // criar pessoa (o botao muda de texto com a lista vazia)
  await page.getByRole('button', { name: /^Adicionar (a primeira )?pessoa$/ }).click()
  const form = page.getByRole('dialog', { name: 'Adicionar pessoa' })
  await form.getByLabel('Nome completo').fill(parent)
  await form.getByRole('button', { name: 'Adicionar pessoa' }).click()
  await expect(page.getByText(`${parent} foi adicionada à família.`)).toBeVisible()

  // adicionar filho pelo painel da familia
  await page.getByRole('button', { name: `Família de ${parent}`, exact: true }).click()
  const family = page.getByRole('dialog', { name: `Família de ${parent}` })
  await family.getByRole('button', { name: '+ Filho' }).click()
  await family.getByLabel('Nome completo').fill(child)
  await family.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await expect(page.getByText(`${child} foi vinculado(a) a ${parent}.`)).toBeVisible()
  await expect(family.getByRole('region', { name: 'Filhos' }).getByText(child)).toBeVisible()
  await family.getByRole('button', { name: 'Fechar', exact: true }).click()

  // buscar o filho e centralizar a arvore nele
  const search = page.getByRole('combobox', { name: 'Buscar pessoa' })
  await search.fill(child)
  await page.getByRole('option', { name: new RegExp(child) }).click()
  await expect(page).toHaveURL(/\/tree\/[0-9a-f-]{36}$/)
  await expect(page.getByText(`Família de ${child}`)).toBeVisible()

  // excluir os dois (a exclusao pede confirmacao e mostra o impacto)
  await page.goto('/')
  for (const name of [child, parent]) {
    await page.getByRole('combobox', { name: 'Buscar pessoa' }).fill(name)
    await expect(page.getByRole('option', { name: new RegExp(name) })).toBeVisible()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: `Excluir ${name}`, exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Excluir pessoa?' })).toBeVisible()
    await page.getByRole('button', { name: `Excluir ${name}`, exact: true }).last().click()
    await expect(page.getByText(`${name} foi excluída.`)).toBeVisible()
    await page.getByRole('combobox', { name: 'Buscar pessoa' }).fill('')
  }
})
