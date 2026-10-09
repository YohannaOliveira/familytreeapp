import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'danger'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  loading?: boolean
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-emerald-700 text-white hover:bg-emerald-800',
  secondary: 'bg-white text-slate-800 border border-slate-300 hover:bg-slate-100',
  danger: 'bg-red-700 text-white hover:bg-red-800',
}

export function Button({ variant = 'primary', loading = false, disabled, className = '', children, ...rest }: Props) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-base font-medium
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700
        disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
    >
      {loading ? 'Aguarde…' : children}
    </button>
  )
}
