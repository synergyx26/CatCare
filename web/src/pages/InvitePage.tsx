import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Users } from 'lucide-react'
import { api } from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import type { InviteDetails } from '@/types/api'

export function InvitePage() {
  const { token } = useParams<{ token: string }>()
  const navigate  = useNavigate()
  const { token: authToken } = useAuthStore()
  const isLoggedIn = !!authToken

  const { data, isLoading, isError } = useQuery({
    queryKey: ['invite', token],
    queryFn:  () => api.getInvite(token!),
    retry:    false,
  })

  const invite: InviteDetails | undefined = data?.data?.data

  const mutation = useMutation({
    mutationFn: () => api.acceptInvite(token!),
    onSuccess: () => {
      toast.success('You joined the household!')
      navigate('/dashboard', { replace: true })
    },
    onError: () => {
      toast.error('Something went wrong. Please try again.')
    },
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-white to-cyan-50 dark:from-sky-950/20 dark:via-background dark:to-cyan-950/20">
        <p className="text-muted-foreground text-sm">Loading invite...</p>
      </div>
    )
  }

  if (isError || !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-white to-cyan-50 dark:from-sky-950/20 dark:via-background dark:to-cyan-950/20 p-4">
        <div className="w-full max-w-md">
          <div className="bg-card rounded-3xl shadow-xl shadow-sky-500/5 border border-border/50 p-8 text-center space-y-4">
            <p className="text-xl font-bold">Invite not found</p>
            <p className="text-muted-foreground text-sm">
              This invite link has expired or already been used.
            </p>
            <Link to="/login" className="text-sm text-sky-600 dark:text-sky-400 font-medium hover:underline">
              Go to sign in
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
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
              <Users className="w-8 h-8 text-sky-600 dark:text-sky-400" />
            </div>
          </div>

          {/* Invite info */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">{invite.household_name}</h1>
            <p className="text-muted-foreground text-sm">
              {invite.invited_by} invited you to join this household
            </p>
            {invite.email && (
              <p className="text-xs text-muted-foreground">Invite for {invite.email}</p>
            )}
          </div>

          {isLoggedIn ? (
            <div className="space-y-3">
              <button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
                className="w-full h-11 rounded-xl bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white font-semibold text-sm transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              >
                {mutation.isPending ? 'Joining...' : `Join ${invite.household_name}`}
              </button>

              <button
                onClick={() => navigate('/dashboard')}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Go to my dashboard instead
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-center text-sm text-muted-foreground">
                You need an account to accept this invite.
              </p>
              <Link
                to={`/register?redirect=/invites/${token}`}
                className="block w-full"
              >
                <button className="w-full h-11 rounded-xl bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white font-semibold text-sm transition-colors cursor-pointer">
                  Create account & join
                </button>
              </Link>
              <Link
                to={`/login?redirect=/invites/${token}`}
                className="block w-full text-center text-sm text-sky-600 dark:text-sky-400 font-medium hover:underline"
              >
                Already have an account? Sign in
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
