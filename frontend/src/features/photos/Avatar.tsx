import { photoUrl } from './api'

interface Props {
  name: string
  photoKey: string | null | undefined
  /** Classes de tamanho, ex.: "size-10". */
  className?: string
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '')).toUpperCase()
}

/** Foto redonda com carregamento lazy; sem foto, mostra as iniciais. */
export function Avatar({ name, photoKey, className = 'size-10' }: Props) {
  const src = photoUrl(photoKey)
  if (src) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        className={`${className} shrink-0 rounded-full bg-slate-200 object-cover`}
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      className={`${className} grid shrink-0 place-items-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600`}
    >
      {initials(name)}
    </span>
  )
}
