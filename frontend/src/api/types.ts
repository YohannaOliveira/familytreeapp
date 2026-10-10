export type Gender = 'MALE' | 'FEMALE' | 'OTHER'

export interface Person {
  id: string
  fullName: string
  gender: Gender | null
  photoKey: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface PersonInput {
  fullName: string
  gender: Gender | null
  notes: string | null
}

export type ParentKind = 'BIOLOGICAL' | 'ADOPTIVE' | 'STEP' | 'FOSTER' | 'UNKNOWN'
export type PartnerSubtype = 'MARRIED' | 'PARTNERS' | 'EX'

/** Relacionamento visto de uma pessoa; role = papel da OUTRA pessoa em relacao a ela. */
export interface PersonRelationship {
  relationshipId: string
  type: 'PARENT_OF' | 'PARTNER'
  role: 'PARENT' | 'CHILD' | 'PARTNER'
  subtype: string
  kind: ParentKind | null
  person: { id: string; fullName: string }
}

export interface RelationshipInput {
  type: 'PARENT_OF' | 'PARTNER'
  fromId: string
  toId: string
  subtype: string
  kind: ParentKind | null
}

export interface Relative {
  id: string
  fullName: string
}

export interface Relatives {
  siblings: Relative[]
  halfSiblings: Relative[]
}

/** Resultado da busca: `parents` (nomes) ajuda a distinguir homonimos. */
export interface PersonSearchResult {
  id: string
  fullName: string
  gender: Gender | null
  photoKey: string | null
  parents: string[]
}

export interface Page<T> {
  items: T[]
  page: number
  size: number
  total: number
}

export interface FieldError {
  field: string
  message: string
}

export interface ErrorBody {
  code: string
  message: string
  fieldErrors?: FieldError[]
  traceId?: string
}

export interface TokenResponse {
  accessToken: string
  tokenType: string
  expiresIn: number
}

export interface GraphPerson {
  id: string
  fullName: string
  gender: Gender | null
  photoKey: string | null
}

export interface GraphRelationship {
  id: string
  type: 'PARENT_OF' | 'PARTNER'
  fromId: string
  toId: string
  subtype: string
  kind: ParentKind | null
}

export interface HiddenCount {
  parents: number
  children: number
  partners: number
}

export interface GraphResponse {
  focusId: string
  persons: GraphPerson[]
  relationships: GraphRelationship[]
  families: { parentIds: string[]; childIds: string[] }[]
  hiddenCounts: Record<string, HiddenCount>
  truncated: boolean
}
