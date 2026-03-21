import { usePageTitle } from '@/hooks/usePageTitle'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Cat, Mail, Lock } from 'lucide-react'
import { api } from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { Input } from '@/components/ui/input'
import { GoogleOAuthButton } from '@/components/GoogleOAuthButton'
import type { User } from '@/types/api'

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
})

type FormData = z.infer<typeof schema>

export function LoginPage() {
  usePageTitle('Sign In')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectTo = searchParams.get('redirect') ?? '/dashboard'
  const setAuth = useAuthStore((s) => s.setAuth)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) => api.login({ user: data }),
    onSuccess: (res) => {
      const token = res.headers['authorization']?.replace('Bearer ', '') ?? ''
      const user: User = res.data.data
      setAuth(user, token)
      toast.success('Welcome back!')
      navigate(redirectTo, { replace: true })
    },
    onError: () => {
      toast.error('Invalid email or password.')
    },
  })

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-white to-cyan-50 dark:from-sky-950/20 dark:via-background dark:to-cyan-950/20 p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-3xl shadow-xl shadow-sky-500/5 border border-border/50 p-8 space-y-6">
          {/* Cat illustration */}
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
              <Cat className="w-10 h-10 text-sky-600 dark:text-sky-400" />
            </div>
          </div>

          {/* Header */}
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Welcome back!</h1>
            <p className="text-muted-foreground text-sm">Sign in to your CatCare account</p>
          </div>

          {/* Google OAuth */}
          <div className="flex justify-center">
            <GoogleOAuthButton redirectTo={redirectTo} />
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/60" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-3 text-muted-foreground/60">or sign in with email</span>
            </div>
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

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-muted-foreground">Password</label>
                <Link to="/forgot-password" className="text-xs text-sky-600 dark:text-sky-400 hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                <Input
                  {...register('password')}
                  type="password"
                  placeholder="Your password"
                  className="pl-10 h-11 rounded-xl bg-muted/50 border-border/60 focus:bg-card"
                />
              </div>
              {errors.password && <p className="text-destructive text-xs">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full h-11 rounded-xl bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white font-semibold text-sm transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              {mutation.isPending ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          {/* Footer link */}
          <p className="text-center text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link to="/register" className="text-sky-600 dark:text-sky-400 font-medium hover:underline">
              Sign up
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
