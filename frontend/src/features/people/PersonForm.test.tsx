import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import { renderApp } from '../../test/helpers'
import { PersonForm } from './PersonForm'

describe('PersonForm', () => {
  it('exige o nome e nao envia vazio', async () => {
    const onSubmit = vi.fn()
    renderApp(<PersonForm onSubmit={onSubmit} onCancel={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar pessoa' }))
    expect(await screen.findByText('Digite o nome da pessoa.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('envia dados limpos: nome sem espacos, sexo e observacoes vazios viram null', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    renderApp(<PersonForm onSubmit={onSubmit} onCancel={() => {}} />)
    await userEvent.type(screen.getByLabelText('Nome completo'), '  Maria Souza  ')
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar pessoa' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ fullName: 'Maria Souza', gender: null, notes: null }))
  })

  it('envia sexo e observacoes quando preenchidos', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    renderApp(<PersonForm onSubmit={onSubmit} onCancel={() => {}} />)
    await userEvent.type(screen.getByLabelText('Nome completo'), 'Ana')
    await userEvent.selectOptions(screen.getByLabelText('Sexo'), 'FEMALE')
    await userEvent.type(screen.getByLabelText('Observações'), 'Nasceu em Recife')
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar pessoa' }))
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ fullName: 'Ana', gender: 'FEMALE', notes: 'Nasceu em Recife' }),
    )
  })

  it('na edicao vem preenchido e o botao diz "Salvar alterações"', () => {
    const person = {
      id: '1',
      fullName: 'João',
      gender: 'MALE' as const,
      photoKey: null,
      notes: 'obs',
      createdAt: '',
      updatedAt: '',
    }
    renderApp(<PersonForm person={person} onSubmit={vi.fn()} onCancel={() => {}} />)
    expect(screen.getByLabelText('Nome completo')).toHaveValue('João')
    expect(screen.getByLabelText('Sexo')).toHaveValue('MALE')
    expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeInTheDocument()
  })

  it('mostra erro de campo vindo do servidor', async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValue(new ApiError(400, 'VALIDATION_ERROR', 'x', [{ field: 'fullName', message: 'nome invalido' }]))
    renderApp(<PersonForm onSubmit={onSubmit} onCancel={() => {}} />)
    await userEvent.type(screen.getByLabelText('Nome completo'), 'Ana')
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar pessoa' }))
    expect(await screen.findByText('nome invalido')).toBeInTheDocument()
  })
})
