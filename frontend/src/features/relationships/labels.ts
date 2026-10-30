import { ApiError } from '../../api/client'
import type { ParentKind, PartnerSubtype, PersonRelationship } from '../../api/types'

export type RelativeRole = 'father' | 'mother' | 'child' | 'partner'

export const ROLE_LABELS: Record<RelativeRole, string> = {
  father: 'Pai',
  mother: 'Mãe',
  child: 'Filho(a)',
  partner: 'Cônjuge/parceiro(a)',
}

export const KIND_LABELS: Record<ParentKind, string> = {
  BIOLOGICAL: 'Biológico',
  ADOPTIVE: 'Adotivo',
  STEP: 'Padrasto/madrasta ou enteado(a)',
  FOSTER: 'De criação',
  UNKNOWN: 'Não sei',
}

export const PARTNER_LABELS: Record<PartnerSubtype, string> = {
  MARRIED: 'Casados',
  PARTNERS: 'Companheiros',
  EX: 'Ex-cônjuge/ex-parceiro(a)',
}

const PARENT_SUBTYPE_LABELS: Record<string, string> = { FATHER: 'Pai', MOTHER: 'Mãe', PARENT: 'Pai ou mãe' }

/** Texto curto sobre o vinculo, mostrado ao lado do nome. */
export function relationshipDetail(rel: PersonRelationship): string {
  if (rel.role === 'PARTNER') return PARTNER_LABELS[rel.subtype as PartnerSubtype] ?? ''
  const parts: string[] = []
  if (rel.role === 'PARENT') parts.push(PARENT_SUBTYPE_LABELS[rel.subtype] ?? 'Pai ou mãe')
  if (rel.kind && rel.kind !== 'BIOLOGICAL') parts.push(KIND_LABELS[rel.kind].toLowerCase())
  return parts.join(' · ')
}

interface ErrorContext {
  role: RelativeRole
  personName: string
  otherName: string
}

/** Traduz as regras do backend (M04) para frases que um leigo entende. */
export function relationshipErrorMessage(err: unknown, ctx: ErrorContext): string {
  if (!(err instanceof ApiError)) return 'Não foi possível criar o vínculo.'
  const child = ctx.role === 'child' ? ctx.otherName : ctx.personName
  switch (err.code) {
    case 'CYCLE_DETECTED':
      return 'Isso criaria um ciclo na família: alguém acabaria sendo antepassado de si mesmo. Confira se escolheu a pessoa certa e se não inverteu pai/mãe com filho(a).'
    case 'TOO_MANY_BIOLOGICAL_PARENTS':
      return `${child} já tem 2 pais biológicos cadastrados. Se este vínculo é de adoção ou de padrasto/madrasta, escolha esse tipo.`
    case 'DUPLICATE_PARENT_ROLE':
      return `${child} já tem ${ctx.role === 'mother' ? 'uma mãe' : 'um pai'} biológico(a) cadastrado(a). Se este vínculo é de adoção ou de padrasto/madrasta, escolha esse tipo.`
    case 'DUPLICATE_RELATIONSHIP':
      return `${ctx.personName} e ${ctx.otherName} já estão ligados desta forma.`
    case 'SELF_RELATION':
      return 'Escolha outra pessoa: não dá para ligar alguém a ela mesma.'
    default:
      return err.message
  }
}
