import type { Person } from '../../api/types'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Dialog'
import { useRelationshipCount } from './api'

interface Props {
  person: Person | null
  deleting: boolean
  onConfirm: () => void
  onCancel: () => void
}

function impactText(name: string, count: number): string {
  if (count === 0) return `${name} não tem ligações com outras pessoas, então nada mais será removido.`
  const links = count === 1 ? '1 ligação familiar' : `${count} ligações familiares`
  return `${name} tem ${links} (como pai, mãe, filho ou cônjuge). Elas também serão removidas, mas as outras pessoas continuam cadastradas.`
}

export function DeletePersonDialog({ person, deleting, onConfirm, onCancel }: Props) {
  const count = useRelationshipCount(person?.id ?? null)

  return (
    <Modal open={person !== null} title="Excluir pessoa?" onClose={onCancel}>
      {person && (
        <div className="space-y-4">
          <p className="text-slate-800">
            {count.isPending
              ? 'Verificando as ligações familiares…'
              : count.isError
                ? `Não foi possível verificar as ligações de ${person.fullName}. Se continuar, elas serão removidas junto.`
                : impactText(person.fullName, count.data)}
          </p>
          <p className="text-sm text-slate-600">Esta ação não pode ser desfeita.</p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={onCancel}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={onConfirm} loading={deleting} disabled={count.isPending}>
              Excluir {person.fullName}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
