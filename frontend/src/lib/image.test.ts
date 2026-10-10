import { describe, expect, it } from 'vitest'
import { MAX_INPUT_BYTES, fitWithin, validatePhotoFile } from './image'

describe('fitWithin', () => {
  it('reduz o lado maior para 400 mantendo a proporcao', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 400, height: 300 })
    expect(fitWithin(1000, 2000)).toEqual({ width: 200, height: 400 })
  })

  it('nao amplia imagens pequenas', () => {
    expect(fitWithin(120, 80)).toEqual({ width: 120, height: 80 })
  })

  it('nunca devolve dimensao zero', () => {
    expect(fitWithin(10000, 1)).toEqual({ width: 400, height: 1 })
  })
})

describe('validatePhotoFile', () => {
  it('aceita JPG, PNG e WebP', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(validatePhotoFile({ type, size: 1000 })).toBeNull()
    }
  })

  it('rejeita tipos que nao sao imagem aceita', () => {
    expect(validatePhotoFile({ type: 'application/pdf', size: 1000 })).toMatch(/JPG, PNG ou WebP/)
    expect(validatePhotoFile({ type: 'image/gif', size: 1000 })).not.toBeNull()
  })

  it('rejeita arquivo grande demais', () => {
    expect(validatePhotoFile({ type: 'image/png', size: MAX_INPUT_BYTES + 1 })).toMatch(/grande demais/)
  })
})
