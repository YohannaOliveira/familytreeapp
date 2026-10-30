import { type Page, type Route } from '@playwright/test'

export const ID = '11111111-1111-4111-8111-111111111111'
export const LONG = 'Maria Aparecida da Conceicao Santos de Albuquerque Cavalcanti Nogueira'

export const person = (n: number, name = `Pessoa ${n}`) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  fullName: name,
  gender: 'FEMALE',
  photoKey: null,
  notes: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
})

export const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

export async function signedIn(page: Page) {
  await page.addInitScript(() =>
    sessionStorage.setItem('ft-auth', JSON.stringify({ state: { token: 't', username: 'admin' }, version: 0 })),
  )
}

export const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)

export const DAD = '22222222-2222-4222-8222-222222222222'
export const MOM = '33333333-3333-4333-8333-333333333333'

export async function mockTree(page: Page) {
  await signedIn(page)
  await page.route('**/api/v1/graph?*', (route) =>
      json(route, {
        focusId: ID,
        persons: [
          { id: ID, fullName: LONG, gender: 'FEMALE', photoKey: null },
          { id: DAD, fullName: 'Pai Teste', gender: 'MALE', photoKey: null },
          { id: MOM, fullName: 'Mae Teste', gender: 'FEMALE', photoKey: null },
        ],
        relationships: [
          { id: 'a1', type: 'PARENT_OF', fromId: DAD, toId: ID, subtype: 'FATHER', kind: 'BIOLOGICAL' },
          { id: 'a2', type: 'PARENT_OF', fromId: MOM, toId: ID, subtype: 'MOTHER', kind: 'BIOLOGICAL' },
          { id: 'a3', type: 'PARTNER', fromId: DAD, toId: MOM, subtype: 'MARRIED', kind: null },
        ],
        families: [{ parentIds: [DAD, MOM], childIds: [ID] }],
        hiddenCounts: {},
        truncated: false,
      }),
    )
    await page.route('**/api/v1/people/*/relatives', (route) => json(route, { siblings: [], halfSiblings: [] }))
    await page.route('**/api/v1/people/*/relationships', (route) => json(route, []))
}
