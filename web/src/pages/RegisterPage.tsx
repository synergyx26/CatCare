import { usePageTitle } from '@/hooks/usePageTitle'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { PawPrint, User as UserIcon, Mail, Lock } from 'lucide-react'
import type { AxiosError } from 'axios'
import { api } from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { Input } from '@/components/ui/input'
import { GoogleOAuthButton } from '@/components/GoogleOAuthButton'
import type { User, ApiError } from '@/types/api'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  password_confirmation: z.string(),
}).refine((d) => d.password === d.password_confirmation, {
  message: "Passwords don't match",
  path: ['password_confirmation'],
})

type FormData = z.infer<typeof schema>

export function RegisterPage() {
  usePageTitle('Create Account')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectTo = searchParams.get('redirect')
  const setAuth = useAuthStore((s) => s.setAuth)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) => api.register({ user: data }),
    onSuccess: (res) => {
      const token = res.headers['authorization']?.replace('Bearer ', '') ?? ''
      const user: User = res.data.data
      setAuth(user, token)
      toast.success('Account created!')
      navigate(redirectTo ?? '/setup', { replace: true })
    },
    onError: (err) => {
      const message = (err as AxiosError<ApiError>).response?.data?.message
        ?? 'Something went wrong. Please try again.'
      toast.error(message)
    },
  })

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-white to-cyan-50 dark:from-sky-950/20 dark:via-background dark:to-cyan-950/20 p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-3xl shadow-xl shadow-sky-500/5 border border-border/50 p-8 space-y-6">
          {/* Cat illustration */}
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
              <PawPrint className="w-10 h-10 text-sky-600 dark:text-sky-400" />
            </div>
          </div>

          {/* Header */}
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
            <p className="text-muted-foreground text-sm">Start tracking care for your cats</p>
          </div>

          {/* Google OAuth — new Google users land on /setup same as email registration */}
          <div className="flex justify-center">
            <GoogleOAuthButton redirectTo={redirectTo ?? '/setup'} />
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/60" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-3 text-muted-foreground/60">or sign up with email</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <Field label="Name" error={errors.name?.message}>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                <Input
                  {...register('name')}
                  placeholder="Your name"
                  className="pl-10 h-11 rounded-xl bg-muted/50 border-border/60 focus:bg-card"
                />
              </div>
            </Field>

            <Field label="Email" error={errors.email?.message}>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                <Input
                  {...register('email')}
                  type="email"
                  placeholder="you@example.com"
                  className="pl-10 h-11 rounded-xl bg-muted/50 border-border/60 focus:bg-card"
                />
              </div>
            </Field>

            <Field label="Password" error={errors.password?.message}>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                <Input
                  {...register('password')}
                  type="password"
                  placeholder="Min. 8 characters"
                  className="pl-10 h-11 rounded-xl bg-muted/50 border-border/60 focus:bg-card"
                />
              </div>
            </Field>

            <Field label="Confirm password" error={errors.password_confirmation?.message}>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                <Input
                  {...register('password_confirmation')}
                  type="password"
                  placeholder="Repeat password"
                  className="pl-10 h-11 rounded-xl bg-muted/50 border-border/60 focus:bg-card"
                />
              </div>
            </Field>

            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full h-11 rounded-xl bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white font-semibold text-sm transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              {mutation.isPending ? 'Creating account...' : 'Sign up'}
            </button>
          </form>

          {/* Footer link */}
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="text-sky-600 dark:text-sky-400 font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>

        {/* Branding */}
        <p className="text-center text-xs text-muted-foreground/60 mt-6">
          CatCare — Helping you care for your feline friends
        </p>
      </div>
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-muted-foreground">{label}</label>
      {children}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  )
}
