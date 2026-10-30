/** Lado maior da foto enviada, em pixels (~30-60 KB em WebP). */
export const MAX_PHOTO_SIDE = 400
/** Limite do arquivo escolhido, antes de redimensionar (evita carregar imagens gigantes na memoria). */
export const MAX_INPUT_BYTES = 15 * 1024 * 1024
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/** Reduz mantendo a proporcao; nunca amplia. */
export function fitWithin(width: number, height: number, max: number = MAX_PHOTO_SIDE) {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

export class PhotoFileError extends Error {}

/** Valida o arquivo escolhido pelo usuario; devolve mensagem amigavel ou null se estiver ok. */
export function validatePhotoFile(file: { type: string; size: number }): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return 'Escolha uma imagem JPG, PNG ou WebP.'
  if (file.size > MAX_INPUT_BYTES) return 'A imagem é grande demais. Escolha uma de até 15 MB.'
  return null
}

/** Redimensiona e converte para WebP no navegador (cai para JPEG se o navegador nao gerar WebP). */
export async function resizePhoto(file: Blob): Promise<Blob> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new PhotoFileError('Não foi possível ler essa imagem.')
  }
  const { width, height } = fitWithin(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new PhotoFileError('Não foi possível processar essa imagem.')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const toBlob = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.82))
  const webp = await toBlob('image/webp')
  if (webp && webp.type === 'image/webp') return webp
  const jpeg = await toBlob('image/jpeg')
  if (!jpeg) throw new PhotoFileError('Não foi possível processar essa imagem.')
  return jpeg
}
