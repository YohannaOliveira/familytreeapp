import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Person } from '../../api/types'
import { json, mockApi, renderApp } from '../../test/helpers'
import { PhotoUploader } from './PhotoUploader'

vi.mock('../../lib/image', async (orig) => ({
  ...(await orig<typeof import('../../lib/image')>()),
  resizePhoto: vi.fn(async () => new Blob(['x'.repeat(2000)], { type: 'image/webp' })),
}))

const person: Person = {
  id: 'p1',
  fullName: 'Maria Souza',
  gender: null,
  photoKey: null,
  notes: null,
  createdAt: '',
  updatedAt: '',
}

class FakeXhr {
  static last: FakeXhr
  upload: { onprogress?: (e: unknown) => void } = {}
  onload?: () => void
  onerror?: () => void
  status = 200
  method = ''
  url = ''
  headers: Record<string, string> = {}
  constructor() {
    FakeXhr.last = this
  }
  open(method: string, url: string) {
    this.method = method
    this.url = url
  }
  setRequestHeader(k: string, v: string) {
    this.headers[k] = v
  }
  send() {
    this.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 2 })
    queueMicrotask(() => this.onload?.())
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('PhotoUploader', () => {
  it('rejeita arquivo que nao e imagem aceita, sem chamar a API', async () => {
    const fetchMock = mockApi({})
    renderApp(<PhotoUploader person={person} />)
    const user = userEvent.setup({ applyAccept: false })
    await user.upload(
      screen.getByLabelText('Escolher foto'),
      new File(['%PDF'], 'doc.pdf', { type: 'application/pdf' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('JPG, PNG ou WebP')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('redimensiona, pede a URL, envia direto ao bucket e salva a chave na pessoa', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr)
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:preview', revokeObjectURL: () => {} }))
    const fetchMock = mockApi({
      'POST /api/v1/photos/upload-url': () =>
        json({
          uploadUrl: 'https://r2.example/put?sig=1',
          key: 'photos/abc.webp',
          headers: { 'Content-Type': 'image/webp' },
        }),
      'PUT /api/v1/people/p1/photo': () => json({ ...person, photoKey: 'photos/abc.webp' }),
    })

    renderApp(<PhotoUploader person={person} />)
    await userEvent.upload(screen.getByLabelText('Escolher foto'), new File(['img'], 'a.png', { type: 'image/png' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Trocar foto' })).toBeInTheDocument())

    const urlInit = fetchMock.mock.calls[0][1]
    expect(JSON.parse(urlInit?.body as string)).toEqual({ contentType: 'image/webp', size: 2000 })
    expect(FakeXhr.last.method).toBe('PUT')
    expect(FakeXhr.last.url).toBe('https://r2.example/put?sig=1')
    expect(FakeXhr.last.headers).toEqual({ 'Content-Type': 'image/webp' })
    const saveInit = fetchMock.mock.calls[1][1]
    expect(JSON.parse(saveInit?.body as string)).toEqual({ photoKey: 'photos/abc.webp' })
  })

  it('mostra erro amigavel quando o envio ao bucket falha', async () => {
    class FailingXhr extends FakeXhr {
      send() {
        this.status = 403
        queueMicrotask(() => this.onload?.())
      }
    }
    vi.stubGlobal('XMLHttpRequest', FailingXhr)
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:preview', revokeObjectURL: () => {} }))
    mockApi({
      'POST /api/v1/photos/upload-url': () =>
        json({ uploadUrl: 'https://r2.example/put', key: 'photos/abc.webp', headers: {} }),
    })

    renderApp(<PhotoUploader person={person} />)
    await userEvent.upload(screen.getByLabelText('Escolher foto'), new File(['img'], 'a.png', { type: 'image/png' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível enviar a foto')
  })

  it('remover foto chama DELETE e volta a oferecer "Adicionar foto"', async () => {
    const fetchMock = mockApi({ 'DELETE /api/v1/people/p1/photo': () => json(null, 204) })
    renderApp(<PhotoUploader person={{ ...person, photoKey: 'photos/old.webp' }} />)

    await userEvent.click(screen.getByRole('button', { name: 'Remover foto' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Adicionar foto' })).toBeInTheDocument())
    expect(fetchMock.mock.calls[0][1]?.method).toBe('DELETE')
  })
})
