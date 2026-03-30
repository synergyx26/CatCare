import { usePageTitle } from '@/hooks/usePageTitle'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { notify } from '@/lib/notify'
import { Cat, Lock } from 'lucide-react'
import { api } from '@/api/client'
import { Input } from '@/components/ui/input'

const schema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
  password_confirmation: z.string(),
}).refine((d) => d.password === d.password_confirmation, {
  message: "Passwords don't match",
  path: ['password_confirmation'],
})

type FormData = z.infer<typeof schema>

export function ResetPasswordPage() {
  usePageTitle('Reset Password')
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      api.resetPassword(token!, data.password, data.password_confirmation),
    onSuccess: () => {
      notify.success('Password updated! Please sign in with your new password.')
      navigate('/login', { replace: true })
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Reset link is invalid or has expired.'
      notify.error(message)
    },
  })

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-white to-cyan-50 dark:from-sky-950/20 dark:via-background dark:to-cyan-950/20 p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-3xl shadow-xl shadow-sky-500/5 border border-border/50 p-8 space-y-6">
          {/* Icon */}
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
              <Cat className="w-10 h-10 text-sky-600 dark:text-sky-400" />
            </div>
          </div>

          {/* Header */}
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Choose a new password</h1>
            <p className="text-muted-foreground text-sm">
              Enter a new password for your CatCare account.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">New password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                <Input
                  {...register('password')}
                  type="password"
                  placeholder="At least 6 characters"
                  className="pl-10 h-11 rounded-xl bg-muted/50 border-border/60 focus:bg-card"
                />
              </div>
              {errors.password && <p className="text-destructive text-xs">{errors.password.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Confirm new password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                <Input
                  {...register('password_confirmation')}
                  type="password"
                  placeholder="Repeat your password"
                  className="pl-10 h-11 rounded-xl bg-muted/50 border-border/60 focus:bg-card"
                />
              </div>
              {errors.password_confirmation && (
                <p className="text-destructive text-xs">{errors.password_confirmation.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full h-11 rounded-xl bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white font-semibold text-sm transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              {mutation.isPending ? 'Updating...' : 'Update password'}
            </button>
          </form>

          {/* Footer link */}
          <p className="text-center text-sm text-muted-foreground">
            Remember your password?{' '}
            <Link to="/login" className="text-sky-600 dark:text-sky-400 font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-muted-foreground/60 mt-6">
          CatCare — Helping you care for your feline friends
        </p>
      </div>
    </div>
  )
}
