import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../../api/client'
import type { Person } from '../../api/types'
import { Button } from '../../components/ui/Button'
import { toast } from '../../components/ui/toast'
import { ACCEPTED_TYPES, PhotoFileError, validatePhotoFile } from '../../lib/image'
import { useRemovePhoto, useUploadPhoto } from './api'
import { Avatar } from './Avatar'

/** Escolher, pre-visualizar, enviar (com progresso), trocar e remover a foto de uma pessoa ja cadastrada. */
export function PhotoUploader({ person }: { person: Person }) {
  const input = useRef<HTMLInputElement>(null)
  const upload = useUploadPhoto(person.id)
  const remove = useRemovePhoto(person.id)
  const [photoKey, setPhotoKey] = useState(person.photoKey)
  const [preview, setPreview] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  async function onFile(file: File | undefined) {
    if (!file) return
    setError(null)
    const invalid = validatePhotoFile(file)
    if (invalid) {
      setError(invalid)
      return
    }
    setPreview(URL.createObjectURL(file))
    setProgress(0)
    try {
      const updated = await upload.mutateAsync({ file, onProgress: setProgress })
      setPhotoKey(updated.photoKey)
      toast.success('Foto salva.')
    } catch (err) {
      setError(
        err instanceof ApiError || err instanceof PhotoFileError ? err.message : 'Não foi possível salvar a foto.',
      )
    } finally {
      setPreview(null)
      if (input.current) input.current.value = ''
    }
  }

  async function onRemove() {
    setError(null)
    try {
      await remove.mutateAsync()
      setPhotoKey(null)
      toast.success('Foto removida.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível remover a foto.')
    }
  }

  const busy = upload.isPending || remove.isPending

  return (
    <div className="flex items-center gap-4" aria-label="Foto">
      {preview ? (
        <img src={preview} alt="Pré-visualização da foto" className="size-20 shrink-0 rounded-full object-cover" />
      ) : (
        <Avatar name={person.fullName} photoKey={photoKey} className="size-20" />
      )}
      <div className="min-w-0 flex-1 space-y-2">
        <input
          ref={input}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          className="sr-only"
          aria-label="Escolher foto"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => input.current?.click()}>
            {photoKey ? 'Trocar foto' : 'Adicionar foto'}
          </Button>
          {photoKey && !upload.isPending && (
            <Button variant="secondary" loading={remove.isPending} onClick={onRemove}>
              Remover foto
            </Button>
          )}
        </div>
        {upload.isPending && (
          <progress
            max={1}
            value={progress}
            aria-label="Enviando foto"
            className="block h-2 w-full overflow-hidden rounded"
          />
        )}
        {error && (
          <p role="alert" className="text-sm text-red-900">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
