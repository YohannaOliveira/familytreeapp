import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError, api } from '../../api/client'
import type { Person } from '../../api/types'
import { resizePhoto } from '../../lib/image'

const PHOTO_BASE_URL = (import.meta.env.VITE_PHOTO_BASE_URL ?? '').replace(/\/+$/, '')

/** URL publica da foto (bucket publico); null se nao houver foto ou a base nao estiver configurada. */
export function photoUrl(photoKey: string | null | undefined): string | null {
  return photoKey && PHOTO_BASE_URL ? `${PHOTO_BASE_URL}/${photoKey}` : null
}

interface UploadUrl {
  uploadUrl: string
  key: string
  headers: Record<string, string>
}

/** PUT direto no R2 via XHR, unica forma de ter progresso de envio. */
export function putWithProgress(
  url: string,
  headers: Record<string, string>,
  body: Blob,
  onProgress: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total)
    }
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new ApiError(xhr.status, 'UPLOAD_FAILED', 'Não foi possível enviar a foto. Tente de novo.'))
    xhr.onerror = () => reject(new ApiError(0, 'NETWORK', 'Não foi possível enviar a foto. Verifique sua conexão.'))
    xhr.send(body)
  })
}

export function useUploadPhoto(personId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ file, onProgress }: { file: Blob; onProgress: (fraction: number) => void }) => {
      const blob = await resizePhoto(file)
      const target = await api<UploadUrl>('/api/v1/photos/upload-url', {
        method: 'POST',
        body: { contentType: blob.type, size: blob.size },
      })
      await putWithProgress(target.uploadUrl, target.headers, blob, onProgress)
      return api<Person>(`/api/v1/people/${personId}/photo`, { method: 'PUT', body: { photoKey: target.key } })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['people'] })
      qc.invalidateQueries({ queryKey: ['graph'] })
    },
  })
}

export function useRemovePhoto(personId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api<void>(`/api/v1/people/${personId}/photo`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['people'] })
      qc.invalidateQueries({ queryKey: ['graph'] })
    },
  })
}
