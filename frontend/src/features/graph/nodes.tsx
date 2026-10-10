import { Handle, Position, type NodeProps } from '@xyflow/react'
import { createContext, memo, useContext } from 'react'
import type { Gender } from '../../api/types'
import type { Dir } from './derive'

export type Chip = { kind: 'expand'; count: number } | { kind: 'collapse' } | { kind: 'show' } | null

export interface PersonNodeData extends Record<string, unknown> {
  name: string
  gender: Gender | null
  generation: number
  isFocus: boolean
  selected: boolean
  dimmed: boolean
  up: Chip
  down: Chip
  partners: Chip
}

export interface GraphActions {
  expand: (id: string, dir: Dir | 'partners') => void
  toggle: (id: string, dir: Dir) => void
}

export const GraphActionsContext = createContext<GraphActions>({ expand: () => {}, toggle: () => {} })

/** Cor por geracao relativa ao foco (acima em azul, foco em verde, abaixo em ambar). */
function tone(generation: number): string {
  if (generation === 0) return 'border-emerald-700 bg-emerald-50'
  if (generation < 0) return generation === -1 ? 'border-sky-600 bg-sky-50' : 'border-indigo-500 bg-indigo-50'
  return generation === 1 ? 'border-amber-600 bg-amber-50' : 'border-orange-500 bg-orange-50'
}

const GENDER_MARK: Record<Gender, string> = { MALE: '♂', FEMALE: '♀', OTHER: '⚧' }

function ChipButton({
  chip,
  label,
  onExpand,
  onToggle,
  className,
}: {
  chip: Chip
  label: string
  onExpand: () => void
  onToggle: () => void
  className: string
}) {
  if (!chip) return null
  const text = chip.kind === 'expand' ? `+${chip.count}` : chip.kind === 'collapse' ? '−' : 'mostrar'
  const aria =
    chip.kind === 'expand'
      ? `Mostrar mais ${chip.count} ${label}`
      : chip.kind === 'collapse'
        ? `Recolher ${label}`
        : `Mostrar ${label} recolhidos`
  return (
    <button
      type="button"
      aria-label={aria}
      onClick={(e) => {
        e.stopPropagation()
        if (chip.kind === 'expand') onExpand()
        else onToggle()
      }}
      className={`nodrag nopan absolute grid min-h-7 min-w-7 place-items-center rounded-full border border-slate-400
        bg-white px-1.5 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-100 ${className}`}
    >
      {text}
    </button>
  )
}

export const PersonNode = memo(function PersonNode({ id, data }: NodeProps) {
  const d = data as PersonNodeData
  const actions = useContext(GraphActionsContext)
  return (
    <div
      aria-label={`${d.name}${d.isFocus ? ' (foco)' : ''}`}
      className={`relative flex h-[72px] w-[176px] flex-col justify-center rounded-xl border-2 px-3 shadow-sm
        ${tone(d.generation)} ${d.selected ? 'ring-4 ring-emerald-400' : ''} ${d.dimmed ? 'opacity-30' : ''}`}
    >
      <Handle type="target" position={Position.Top} id="t" className="!opacity-0" />
      <Handle type="source" position={Position.Bottom} id="b" className="!opacity-0" />
      <Handle type="target" position={Position.Left} id="l" className="!opacity-0" />
      <Handle type="source" position={Position.Right} id="r" className="!opacity-0" />
      <p className="line-clamp-2 text-sm font-semibold leading-tight text-slate-900">{d.name}</p>
      <p className="text-xs text-slate-600">
        {d.gender ? GENDER_MARK[d.gender] : ''} {d.isFocus ? 'Foco' : ''}
      </p>
      <ChipButton
        chip={d.up}
        label="pais"
        onExpand={() => actions.expand(id, 'up')}
        onToggle={() => actions.toggle(id, 'up')}
        className="-top-3.5 left-1/2 -translate-x-1/2"
      />
      <ChipButton
        chip={d.down}
        label="filhos"
        onExpand={() => actions.expand(id, 'down')}
        onToggle={() => actions.toggle(id, 'down')}
        className="-bottom-3.5 left-1/2 -translate-x-1/2"
      />
      <ChipButton
        chip={d.partners}
        label="cônjuges"
        onExpand={() => actions.expand(id, 'partners')}
        onToggle={() => {}}
        className="-right-3.5 top-1/2 -translate-y-1/2"
      />
    </div>
  )
})

export const FamilyNode = memo(function FamilyNode({ data }: NodeProps) {
  return (
    <div className={`size-3 rounded-full bg-slate-500 ${data.dimmed ? 'opacity-30' : ''}`}>
      <Handle type="target" position={Position.Top} id="t" className="!opacity-0" />
      <Handle type="source" position={Position.Bottom} id="b" className="!opacity-0" />
    </div>
  )
})
