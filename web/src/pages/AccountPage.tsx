import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useAuthStore } from '@/store/authStore'
import { useQueryClient } from '@tanstack/react-query'
import { googleLogout } from '@react-oauth/google'
import { api } from '@/api/client'
import { notify } from '@/lib/notify'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Input } from '@/components/ui/input'
import { Shield, Trash2, Lock, ExternalLink, Mail, User } from 'lucide-react'
import type { AxiosError } from 'axios'
import type { ApiError } from '@/types/api'

// ─── Delete form schemas ──────────────────────────────────────────────────────

const emailSchema = z.object({
  password: z.string().min(1, 'Password is required'),
})

const oauthSchema = z.object({
  confirm: z.string().refine((v) => v === 'DELETE', {
    message: 'Type DELETE (all caps) to confirm',
  }),
})

type EmailForm = z.infer<typeof emailSchema>
type OAuthForm = z.infer<typeof oauthSchema>

// ─── Delete dialog ────────────────────────────────────────────────────────────

function DeleteAccountDialog({ isOAuth }: { isOAuth: boolean }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { clearAuth } = useAuthStore()
  const queryClient = useQueryClient()

  const emailForm = useForm<EmailForm>({ resolver: zodResolver(emailSchema) })
  const oauthForm = useForm<OAuthForm>({ resolver: zodResolver(oauthSchema) })

  const mutation = useMutation({
    mutationFn: (password?: string) => api.deleteAccount(password),
    onSuccess: () => {
      clearAuth()
      queryClient.clear()
      googleLogout()
      navigate('/login', { replace: true })
      notify.success('Your account has been deleted.')
    },
    onError: (err) => {
      const code    = (err as AxiosError<ApiError>).response?.data?.error
      const message = (err as AxiosError<ApiError>).response?.data?.message
      if (code === 'INVALID_PASSWORD') {
        emailForm.setError('password', { message: message ?? 'Incorrect password.' })
      } else {
        notify.error(message ?? 'Something went wrong. Please try again.')
      }
    },
  })

  function handleEmailSubmit(data: EmailForm) {
    mutation.mutate(data.password)
  }

  function handleOAuthSubmit() {
    mutation.mutate(undefined)
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-rose-200 dark:border-rose-800/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-sm font-medium transition-colors">
          <Trash2 className="w-4 h-4" />
          Delete my account
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-rose-600 dark:text-rose-400 flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            Delete account permanently
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p>
                This action <strong>cannot be undone</strong>. Here is exactly what will happen:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Your account and personal data will be permanently deleted</li>
                <li>Households where you are the only member will be deleted along with all cats and care history</li>
                <li>In shared households, your care logs will be anonymised (other members' data is preserved)</li>
                <li>Your active session will be terminated immediately</li>
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isOAuth ? (
          <form onSubmit={oauthForm.handleSubmit(handleOAuthSubmit)} className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Type <span className="font-mono font-bold">DELETE</span> to confirm
              </label>
              <Input
                {...oauthForm.register('confirm')}
                placeholder="DELETE"
                autoComplete="off"
                className="font-mono"
              />
              {oauthForm.formState.errors.confirm && (
                <p className="text-xs text-rose-500">{oauthForm.formState.errors.confirm.message}</p>
              )}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel type="button" onClick={() => { setOpen(false); oauthForm.reset() }}>
                Cancel
              </AlertDialogCancel>
              <button
                type="submit"
                disabled={mutation.isPending}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {mutation.isPending ? 'Deleting…' : 'Delete my account'}
              </button>
            </AlertDialogFooter>
          </form>
        ) : (
          <form onSubmit={emailForm.handleSubmit(handleEmailSubmit)} className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Enter your password to confirm
              </label>
              <Input
                {...emailForm.register('password')}
                type="password"
                placeholder="Your current password"
                autoComplete="current-password"
              />
              {emailForm.formState.errors.password && (
                <p className="text-xs text-rose-500">{emailForm.formState.errors.password.message}</p>
              )}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel type="button" onClick={() => { setOpen(false); emailForm.reset() }}>
                Cancel
              </AlertDialogCancel>
              <button
                type="submit"
                disabled={mutation.isPending}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {mutation.isPending ? 'Deleting…' : 'Delete my account'}
              </button>
            </AlertDialogFooter>
          </form>
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function AccountPage() {
  usePageTitle('My Account')
  const { user } = useAuthStore()
  const isOAuth = !!user?.provider

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-16">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Account</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your personal data and account settings.
        </p>
      </div>

      {/* Profile summary */}
      <section className="rounded-xl border border-border/60 bg-card divide-y divide-border/40">
        <div className="px-5 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{user?.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
          {isOAuth && (
            <span className="ml-auto shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
              Google account
            </span>
          )}
        </div>
      </section>

      {/* Data & privacy */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Shield className="w-4 h-4 text-sky-500" />
          Your data &amp; privacy
        </h2>

        <div className="rounded-xl border border-border/60 bg-card divide-y divide-border/40 text-sm">
          <div className="px-5 py-4 space-y-1">
            <p className="font-medium">What data we store about you</p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Your name, email address, subscription tier, and notification preferences. Within
              your households: care events you logged, cats you added, expenses, and medication
              records. See our{' '}
              <Link to="/privacy" className="text-sky-600 dark:text-sky-400 hover:underline underline-offset-2">
                Privacy Policy
              </Link>{' '}
              for the full breakdown.
            </p>
          </div>

          <div className="px-5 py-4 space-y-2">
            <p className="font-medium">Request a data export</p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Under GDPR and CCPA you have the right to a machine-readable copy of your personal
              data. Email us and we will send it within 30 days.
            </p>
            <a
              href={`mailto:privacy@catcare.app?subject=Data export request&body=Please send me a copy of all personal data associated with my account (${user?.email ?? ''}).`}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline underline-offset-2"
            >
              <Mail className="w-3.5 h-3.5" />
              Email privacy@catcare.app
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="px-5 py-4 space-y-1">
            <p className="font-medium">Security</p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Your password is stored as a bcrypt hash. Sessions expire after 14 days and are
              immediately revoked on sign-out. Account lockout activates after 10 failed login
              attempts and resets after 30 minutes.
            </p>
          </div>

          {!isOAuth && (
            <div className="px-5 py-4 space-y-2">
              <p className="font-medium flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                Change password
              </p>
              <p className="text-muted-foreground text-xs">
                Use the{' '}
                <Link to="/forgot-password" className="text-sky-600 dark:text-sky-400 hover:underline underline-offset-2">
                  forgot password
                </Link>{' '}
                flow to set a new password — enter your email and we'll send a reset link.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Danger zone */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-2">
          <Trash2 className="w-4 h-4" />
          Danger zone
        </h2>

        <div className="rounded-xl border border-rose-200 dark:border-rose-800/50 bg-rose-50/30 dark:bg-rose-950/10 px-5 py-4 space-y-3">
          <div>
            <p className="font-medium text-sm">Delete your account</p>
            <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
              Permanently deletes your account and all personal data. Households where you are the
              only member will be deleted entirely. In shared households, your contributions are
              anonymised so other members aren't affected. This action cannot be undone.
            </p>
          </div>
          <DeleteAccountDialog isOAuth={isOAuth} />
        </div>
      </section>

      <p className="text-xs text-muted-foreground/60 text-center">
        Questions about your data?{' '}
        <a href="mailto:privacy@catcare.app" className="hover:text-muted-foreground transition-colors">
          privacy@catcare.app
        </a>
      </p>
    </div>
  )
}
