import { useEffect, useId, useRef, type ReactNode } from 'react'

interface DialogProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Base acessivel: foco preso dentro, Esc fecha, foco volta ao elemento de origem. */
function Overlay({
  open,
  title,
  onClose,
  children,
  align,
  panelClass,
}: DialogProps & { align: string; panelClass: string }) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? panel)?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !panel) return
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (items.length === 0) return
      const firstItem = items[0]
      const lastItem = items[items.length - 1]
      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault()
        lastItem.focus()
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault()
        firstItem.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previous?.focus()
    }
  }, [open])

  if (!open) return null
  return (
    <div className={`fixed inset-0 z-40 flex ${align}`}>
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative z-10 bg-white shadow-xl ${panelClass}`}
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-slate-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="grid size-11 place-items-center rounded-lg text-2xl text-slate-600 hover:bg-slate-100
              focus-visible:outline-2 focus-visible:outline-emerald-700"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

/** Janela centralizada, para confirmacoes. */
export function Modal(props: DialogProps) {
  return (
    <Overlay
      {...props}
      align="items-center justify-center p-4"
      panelClass="w-full max-w-md max-h-[90vh] flex flex-col rounded-xl"
    />
  )
}

/** No celular sobe de baixo (bottom-sheet); em tela grande vira painel lateral. */
export function BottomSheet(props: DialogProps) {
  return (
    <Overlay
      {...props}
      align="items-end justify-end"
      panelClass="w-full max-h-[90vh] flex flex-col rounded-t-2xl md:h-full md:max-h-none md:max-w-md md:rounded-none"
    />
  )
}
