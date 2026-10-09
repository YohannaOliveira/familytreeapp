import { create } from 'zustand'

type Kind = 'success' | 'error'

interface Toast {
  id: number
  kind: Kind
  message: string
}

interface ToastState {
  toasts: Toast[]
  push: (kind: Kind, message: string) => void
  dismiss: (id: number) => void
}

let nextId = 1

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (kind, message) => {
    const id = nextId++
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }))
    setTimeout(() => get().dismiss(id), 5000)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export const toast = {
  success: (message: string) => useToasts.getState().push('success', message),
  error: (message: string) => useToasts.getState().push('error', message),
}

export function ToastViewport() {
  const toasts = useToasts((s) => s.toasts)
  const dismiss = useToasts((s) => s.dismiss)
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg px-4 py-3 text-white shadow-lg
            ${t.kind === 'error' ? 'bg-red-800' : 'bg-emerald-800'}`}
        >
          <span className="flex-1">{t.message}</span>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            aria-label="Fechar aviso"
            className="-my-1 grid size-8 place-items-center rounded text-xl hover:bg-white/20"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
