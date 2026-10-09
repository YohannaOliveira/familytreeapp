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
