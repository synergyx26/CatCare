import { usePageTitle } from '@/hooks/usePageTitle'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Cat, Mail, ArrowLeft } from 'lucide-react'
import type { AxiosError } from 'axios'
import { api } from '@/api/client'
import { Input } from '@/components/ui/input'
import type { ApiError } from '@/types/api'

const schema = z.object({
  email: z.string().email('Invalid email'),
})

type FormData = z.infer<typeof schema>

export function ForgotPasswordPage() {
  usePageTitle('Forgot Password')

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) => api.forgotPassword(data.email),
  })

  const oauthError = mutation.isError
    ? (mutation.error as AxiosError<ApiError>).response?.data?.error === 'OAUTH_USER'
    : false

  if (mutation.isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-white to-cyan-50 dark:from-sky-950/20 dark:via-background dark:to-cyan-950/20 p-4">
        <div className="w-full max-w-md">
          <div className="bg-card rounded-3xl shadow-xl shadow-sky-500/5 border border-border/50 p-8 space-y-6 text-center">
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Mail className="w-10 h-10 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight">Check your email</h1>
              <p className="text-muted-foreground text-sm">
                If that email is registered with CatCare, you'll receive a reset link shortly.
                The link expires in 6 hours.
              </p>
            </div>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm text-sky-600 dark:text-sky-400 font-medium hover:underline"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    )
  }

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
            <h1 className="text-2xl font-bold tracking-tight">Forgot your password?</h1>
            <p className="text-muted-foreground text-sm">
              Enter your email and we'll send you a reset link.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                <Input
                  {...register('email')}
                  type="email"
                  placeholder="you@example.com"
                  className="pl-10 h-11 rounded-xl bg-muted/50 border-border/60 focus:bg-card"
                />
              </div>
              {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
            </div>

            {mutation.isError && (
              <p className="text-destructive text-xs text-center">
                {oauthError
                  ? 'This account uses Google sign-in. Use "Continue with Google" on the login page instead.'
                  : 'Something went wrong. Please try again.'}
              </p>
            )}

            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full h-11 rounded-xl bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white font-semibold text-sm transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              {mutation.isPending ? 'Sending...' : 'Send reset link'}
            </button>
          </form>

          {/* Footer link */}
          <p className="text-center text-sm text-muted-foreground">
            <Link
              to="/login"
              className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 font-medium hover:underline"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to sign in
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
