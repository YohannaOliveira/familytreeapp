import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Navigate, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { ApiError } from '../api/client'
import { Button } from '../components/ui/Button'
import { TextField } from '../components/ui/Field'
import { useLogin } from '../features/auth/api'
import { useAuth } from '../features/auth/store'

const schema = z.object({
  username: z.string().trim().min(1, 'Digite seu usuário.'),
  password: z.string().min(1, 'Digite sua senha.'),
})
type Values = z.infer<typeof schema>

export function LoginPage() {
  const token = useAuth((s) => s.token)
  const navigate = useNavigate()
  const login = useLogin()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { username: '', password: '' } })

  if (token) return <Navigate to="/" replace />

  const submit = handleSubmit((values) =>
    login.mutateAsync(values).then(
      () => navigate('/', { replace: true }),
      () => undefined, // o erro aparece pelo estado da mutacao
    ),
  )

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-2xl font-semibold text-slate-900">Árvore da Família</h1>
        <p className="mb-6 text-slate-600">Entre para ver e cuidar da família.</p>
        <form onSubmit={submit} noValidate className="space-y-4">
          <TextField
            label="Usuário"
            autoComplete="username"
            autoFocus
            error={errors.username?.message}
            {...register('username')}
          />
          <TextField
            label="Senha"
            type="password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register('password')}
          />
          {login.isError && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-900">
              {login.error instanceof ApiError ? login.error.message : 'Não foi possível entrar.'}
            </p>
          )}
          <Button type="submit" loading={login.isPending} className="w-full">
            Entrar
          </Button>
        </form>
      </div>
    </main>
  )
}
