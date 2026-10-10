import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { PersonSearchResult } from '../../api/types'
import { MIN_QUERY_LENGTH, parentsLabel, useDebounced, useSearchPeople } from './api'

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
}

/** Busca com autocomplete (padrao ARIA combobox). Atalhos: "/" ou Ctrl/Cmd+K focam o campo. */
export function SearchBox() {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  const term = useDebounced(text)
  const results = useSearchPeople(term)
  const items: PersonSearchResult[] = results.data ?? []
  const searching = text.trim().length >= MIN_QUERY_LENGTH
  // Enquanto o termo debounced ainda e o antigo, os resultados na tela sao de outra busca.
  const stale = term.trim() !== text.trim()

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const isShortcut = (e.key === '/' && !isTypingTarget(e.target)) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')
      if (!isShortcut) return
      e.preventDefault()
      inputRef.current?.focus()
      inputRef.current?.select()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => setActive(0), [term])

  function choose(person: PersonSearchResult) {
    setOpen(false)
    setText('')
    inputRef.current?.blur()
    navigate(`/tree/${person.id}`)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (items.length === 0) return
      e.preventDefault()
      setOpen(true)
      setActive((i) => (e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length))
    } else if (e.key === 'Enter') {
      if (open && !stale && items[active]) {
        e.preventDefault()
        choose(items[active])
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.stopPropagation()
        setOpen(false)
      } else {
        setText('')
      }
    }
  }

  const showPanel = open && searching
  const optionId = (i: number) => `${listId}-opt-${i}`

  return (
    <div className="relative w-full sm:max-w-sm">
      <label htmlFor={`${listId}-input`} className="sr-only">
        Buscar pessoa
      </label>
      <input
        ref={inputRef}
        id={`${listId}-input`}
        type="search"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showPanel && items[active] ? optionId(active) : undefined}
        autoComplete="off"
        placeholder="Buscar pessoa ( / )"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className="block min-h-11 w-full rounded-lg border border-slate-400 bg-white px-3 text-base text-slate-900
          placeholder:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-700"
      />
      {showPanel && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Resultados da busca"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-lg border border-slate-300
            bg-white shadow-lg"
        >
          {(results.isPending || stale) && (
            <li role="presentation" className="px-3 py-3 text-sm text-slate-600">
              Buscando…
            </li>
          )}
          {!stale && results.isError && (
            <li role="presentation" className="px-3 py-3 text-sm text-red-800">
              Não foi possível buscar. Tente de novo.
            </li>
          )}
          {!stale && results.data && items.length === 0 && (
            <li role="presentation" className="px-3 py-3 text-sm text-slate-600">
              Ninguém encontrado com esse nome.
            </li>
          )}
          {!stale &&
            items.map((p, i) => (
              <li
                key={p.id}
                id={optionId(i)}
                role="option"
                aria-selected={i === active}
                // mouseDown (e nao click) para escolher antes do input perder o foco
                onMouseDown={(e) => {
                  e.preventDefault()
                  choose(p)
                }}
                onMouseEnter={() => setActive(i)}
                className={`min-h-11 cursor-pointer px-3 py-2 ${i === active ? 'bg-emerald-50' : ''}`}
              >
                <p className="font-medium text-slate-900">{p.fullName}</p>
                <p className="text-sm text-slate-600">{parentsLabel(p)}</p>
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}
