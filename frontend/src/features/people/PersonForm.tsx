import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { ApiError } from '../../api/client'
import type { Person, PersonInput } from '../../api/types'
import { Button } from '../../components/ui/Button'
import { SelectField, TextAreaField, TextField } from '../../components/ui/Field'
import { PhotoUploader } from '../photos/PhotoUploader'
import { GENDER_LABELS, personSchema, toInput, type PersonFormValues } from './schema'

interface Props {
  person?: Person
  onSubmit: (input: PersonInput) => Promise<unknown>
  onCancel: () => void
}

export function PersonForm({ person, onSubmit, onCancel }: Props) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PersonFormValues>({
    resolver: zodResolver(personSchema),
    defaultValues: {
      fullName: person?.fullName ?? '',
      gender: person?.gender ?? '',
      notes: person?.notes ?? '',
    },
  })

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(toInput(values))
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors.length > 0) {
        for (const fe of err.fieldErrors) {
          if (fe.field === 'fullName' || fe.field === 'notes' || fe.field === 'gender') {
            setError(fe.field, { message: fe.message })
          }
        }
      } else {
        setError('root', { message: err instanceof ApiError ? err.message : 'Não foi possível salvar.' })
      }
    }
  })

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {person ? (
        <PhotoUploader person={person} />
      ) : (
        <p className="text-sm text-slate-600">Depois de adicionar a pessoa, você poderá colocar uma foto.</p>
      )}
      <TextField
        label="Nome completo"
        autoComplete="off"
        autoFocus
        error={errors.fullName?.message}
        {...register('fullName')}
      />
      <SelectField label="Sexo" hint="Opcional." error={errors.gender?.message} {...register('gender')}>
        <option value="">Não informado</option>
        {Object.entries(GENDER_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </SelectField>
      <TextAreaField
        label="Observações"
        hint="Opcional. Ex.: cidade onde nasceu, histórias, apelidos."
        error={errors.notes?.message}
        {...register('notes')}
      />
      {errors.root && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-900">
          {errors.root.message}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {person ? 'Salvar alterações' : 'Adicionar pessoa'}
        </Button>
      </div>
    </form>
  )
}
