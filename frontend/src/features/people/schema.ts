import { z } from 'zod'
import type { Gender, PersonInput } from '../../api/types'

export const GENDER_LABELS: Record<Gender, string> = {
  MALE: 'Masculino',
  FEMALE: 'Feminino',
  OTHER: 'Outro',
}

export const personSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, 'Digite o nome da pessoa.')
    .max(200, 'O nome pode ter no máximo 200 letras.'),
  gender: z.enum(['', 'MALE', 'FEMALE', 'OTHER']),
  notes: z.string().max(10000, 'As observações podem ter no máximo 10.000 letras.'),
})

export type PersonFormValues = z.infer<typeof personSchema>

export function toInput(values: PersonFormValues): PersonInput {
  const notes = values.notes.trim()
  return {
    fullName: values.fullName.trim(),
    gender: values.gender === '' ? null : values.gender,
    notes: notes === '' ? null : notes,
  }
}
